
import { Node, Edge, MarkerType } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';

export type QueryType = 'subclasses' | 'superclasses' | 'instances' | 'equivalent';

interface OntologyIndex {
    nodeMap: Map<string, Node<UMLNodeData>>;
    labelToId: Record<string, string>;
    subClassOf: Record<string, Set<string>>; // child -> parents
    superClassOf: Record<string, Set<string>>; // parent -> children
    instances: Record<string, Set<string>>; // class -> instances
    types: Record<string, Set<string>>; // instance -> classes
    // Adjacency for property restrictions
    outgoingEdges: Record<string, { label: string, target: string }[]>; 
    // Property Reasoning
    subPropertyOf: Record<string, Set<string>>; // subPropLabel -> Set<superPropLabel>
    propertyCharacteristics: Record<string, Set<string>>; // propLabel -> Set<Characteristic>
}

// Global cache to simulate "Reasoner state"
let classifiedIndex: OntologyIndex | null = null;

// --- 1. Classification (Build Hierarchy) ---

export const classifyOntology = (nodes: Node<UMLNodeData>[], edges: Edge[]) => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const labelToId: Record<string, string> = {};
    const subClassOf: Record<string, Set<string>> = {};
    const superClassOf: Record<string, Set<string>> = {};
    const instances: Record<string, Set<string>> = {};
    const types: Record<string, Set<string>> = {};
    const outgoingEdges: Record<string, { label: string, target: string }[]> = {};
    const subPropertyOf: Record<string, Set<string>> = {};
    const propertyCharacteristics: Record<string, Set<string>> = {};

    // Initialize structures
    nodes.forEach(n => {
        if (!n.data) return; // Skip invalid nodes

        const label = n.data.label;
        labelToId[label] = n.id;
        // Handle Prefix stripping for lookups (e.g. "ex:Person" -> "Person")
        if (label.includes(':')) labelToId[label.split(':')[1]] = n.id;
        
        subClassOf[n.id] = new Set();
        superClassOf[n.id] = new Set();
        instances[n.id] = new Set();
        types[n.id] = new Set();
        outgoingEdges[n.id] = [];

        // Property Metadata
        if (n.data.type === ElementType.OWL_OBJECT_PROPERTY || n.data.type === ElementType.OWL_DATA_PROPERTY) {
            if (!propertyCharacteristics[label]) propertyCharacteristics[label] = new Set();
            if (n.data.attributes) {
                n.data.attributes.forEach(attr => propertyCharacteristics[label].add(attr.name));
            }
            
            // Internal SubPropertyOf Axioms
            if (n.data.methods) {
                n.data.methods.forEach(m => {
                    if (m.name.toLowerCase() === 'subpropertyof') {
                        if (!subPropertyOf[label]) subPropertyOf[label] = new Set();
                        subPropertyOf[label].add(m.returnType);
                    }
                });
            }
        }
    });

    // Process Explicit Edges
    edges.forEach(e => {
        const label = (e.label as string) || '';
        
        if (!outgoingEdges[e.source]) outgoingEdges[e.source] = [];
        outgoingEdges[e.source].push({ label, target: e.target });

        // SubClassOf
        if (label === 'rdfs:subClassOf' || label === 'subClassOf') {
            if (!subClassOf[e.source]) subClassOf[e.source] = new Set();
            subClassOf[e.source].add(e.target);

            if (!superClassOf[e.target]) superClassOf[e.target] = new Set();
            superClassOf[e.target].add(e.source);
        }

        // SubPropertyOf
        if (label === 'rdfs:subPropertyOf' || label === 'subPropertyOf') {
            const sNode = nodeMap.get(e.source);
            const tNode = nodeMap.get(e.target);
            if (sNode && sNode.data && tNode && tNode.data) {
                const s = sNode.data.label;
                const t = tNode.data.label;
                if (!subPropertyOf[s]) subPropertyOf[s] = new Set();
                subPropertyOf[s].add(t);
            }
        }

        // Class Assertion (Instances)
        if (label === 'rdf:type' || label === 'a') {
            if (!types[e.source]) types[e.source] = new Set();
            types[e.source].add(e.target);

            if (!instances[e.target]) instances[e.target] = new Set();
            instances[e.target].add(e.source);
        }
    });

    // Also process Axioms (Methods) into the graph structure for reasoning
    nodes.forEach(n => {
        if (n.data && n.data.methods) {
            n.data.methods.forEach(m => {
                if (m.name.toLowerCase() === 'subclassof') {
                    const targetId = labelToId[m.returnType];
                    if (targetId) {
                        subClassOf[n.id].add(targetId);
                        superClassOf[targetId].add(n.id);
                    }
                }
            });
        }
    });

    // Transitive Closure (Reasoning)
    
    // 1. Propagate SubClasses
    let changed = true;
    while(changed) {
        changed = false;
        Object.keys(subClassOf).forEach(child => {
            const parents = Array.from(subClassOf[child]);
            parents.forEach(p => {
                const grandParents = subClassOf[p];
                if (grandParents) {
                    grandParents.forEach(gp => {
                        if (!subClassOf[child].has(gp)) {
                            subClassOf[child].add(gp);
                            if(!superClassOf[gp]) superClassOf[gp] = new Set();
                            superClassOf[gp].add(child);
                            changed = true;
                        }
                    });
                }
            });
        });
    }

    // 2. Propagate SubProperties
    changed = true;
    while(changed) {
        changed = false;
        Object.keys(subPropertyOf).forEach(sub => {
            const supers = Array.from(subPropertyOf[sub]);
            supers.forEach(sup => {
                if (subPropertyOf[sup]) {
                    subPropertyOf[sup].forEach(superSup => {
                        if (!subPropertyOf[sub].has(superSup)) {
                            subPropertyOf[sub].add(superSup);
                            changed = true;
                        }
                    });
                }
            });
        });
    }

    // 3. Propagate Instances (Inheritance)
    // If Alice is Type Student, and Student SubClassOf Person, Alice is Type Person
    Object.keys(types).forEach(instanceId => {
        const directTypes = Array.from(types[instanceId]);
        directTypes.forEach(clsId => {
            const parents = subClassOf[clsId];
            if (parents) {
                parents.forEach(p => {
                    types[instanceId].add(p);
                    if (!instances[p]) instances[p] = new Set();
                    instances[p].add(instanceId);
                });
            }
        });
    });

    classifiedIndex = { nodeMap, labelToId, subClassOf, superClassOf, instances, types, outgoingEdges, subPropertyOf, propertyCharacteristics };
    return classifiedIndex;
};

// --- 2. Query Logic ---

/**
 * Resolves a class expression string to a Set of Node IDs.
 * Supports: Named Classes, "and", "or", "some", "value"
 */
const resolveExpression = (expr: string): Set<string> | null => {
    if (!classifiedIndex) return null;
    const { labelToId, nodeMap, outgoingEdges } = classifiedIndex;
    let cleanExpr = expr.trim();

    // 1. Intersection (AND)
    if (cleanExpr.includes(' and ')) {
        const parts = cleanExpr.split(' and ');
        const sets = parts.map(p => resolveExpression(p)).filter(s => s !== null) as Set<string>[];
        if (sets.length === 0) return new Set();
        
        const allCandidates = new Set<string>();
        sets.forEach(s => s.forEach(id => allCandidates.add(id)));
        
        const result = new Set<string>();
        allCandidates.forEach(id => {
             if (sets.every(s => s.has(id))) result.add(id);
        });
        return result;
    }

    // 2. Union (OR)
    if (cleanExpr.includes(' or ')) {
        const parts = cleanExpr.split(' or ');
        const result = new Set<string>();
        parts.forEach(p => {
            const s = resolveExpression(p);
            s?.forEach(id => result.add(id));
        });
        return result;
    }

    // 3. Object Property Restriction: "prop some Class" (Existential)
    const someMatch = cleanExpr.match(/^(\w+)\s+some\s+(.+)$/);
    if (someMatch) {
        const propLabel = someMatch[1];
        const targetExpr = someMatch[2];
        const targetNodes = resolveExpression(targetExpr);
        
        const result = new Set<string>();
        if (!targetNodes) return result;

        Object.keys(outgoingEdges).forEach(sourceId => {
            const edges = outgoingEdges[sourceId];
            const hasEdge = edges.some(e => 
                (e.label === propLabel || e.label.endsWith(`:${propLabel}`)) && 
                targetNodes.has(e.target)
            );
            if (hasEdge) result.add(sourceId);
        });

        nodeMap.forEach(node => {
            if (node.data && node.data.methods) {
                node.data.methods.forEach(m => {
                    if (m.name === 'SubClassOf') {
                        if (m.returnType.includes(`${propLabel} some`)) {
                            if (m.returnType.includes(targetExpr)) {
                                result.add(node.id);
                            }
                        }
                    }
                });
            }
        });

        return result;
    }

    // 4. Value Restriction: "prop value Individual"
    const valueMatch = cleanExpr.match(/^(\w+)\s+value\s+(.+)$/);
    if (valueMatch) {
        const propLabel = valueMatch[1];
        const targetName = valueMatch[2];
        const targetId = labelToId[targetName];
        
        const result = new Set<string>();
        if (!targetId) return result;

        Object.keys(outgoingEdges).forEach(sourceId => {
            const edges = outgoingEdges[sourceId];
            const hasEdge = edges.some(e => 
                (e.label === propLabel || e.label.endsWith(`:${propLabel}`)) && 
                e.target === targetId
            );
            if (hasEdge) result.add(sourceId);
        });
        return result;
    }

    // 5. Base Case: Named Class / Individual
    if (labelToId[cleanExpr]) {
        return new Set([labelToId[cleanExpr]]);
    }
    
    // Attempt fallback for non-prefixed
    const keys = Object.keys(labelToId);
    const found = keys.find(k => k.toLowerCase() === cleanExpr.toLowerCase());
    if (found) return new Set([labelToId[found]]);

    return null; 
};

export const executeDLQuery = (query: string, queryType: QueryType): Node<UMLNodeData>[] => {
    if (!classifiedIndex) return [];
    const { nodeMap, subClassOf, superClassOf, instances } = classifiedIndex;

    const lowerQuery = query.toLowerCase().trim();

    if (['owl:class', 'class', 'classes'].includes(lowerQuery)) {
        return Array.from(nodeMap.values()).filter(n => n.data?.type === ElementType.OWL_CLASS);
    }
    if (['owl:namedindividual', 'namedindividual', 'individual', 'individuals'].includes(lowerQuery)) {
        return Array.from(nodeMap.values()).filter(n => n.data?.type === ElementType.OWL_NAMED_INDIVIDUAL);
    }
    if (['owl:objectproperty', 'objectproperty', 'object properties'].includes(lowerQuery)) {
        return Array.from(nodeMap.values()).filter(n => n.data?.type === ElementType.OWL_OBJECT_PROPERTY);
    }
    if (['owl:datatypeproperty', 'datatypeproperty', 'data properties', 'dataproperty'].includes(lowerQuery)) {
        return Array.from(nodeMap.values()).filter(n => n.data?.type === ElementType.OWL_DATA_PROPERTY);
    }
    if (['owl:datatype', 'datatype', 'datatypes'].includes(lowerQuery)) {
        return Array.from(nodeMap.values()).filter(n => n.data?.type === ElementType.OWL_DATATYPE);
    }

    let targetClasses = resolveExpression(query);

    if (!targetClasses && (lowerQuery === 'thing' || lowerQuery === 'owl:thing')) {
        if (queryType === 'instances') {
             return Array.from(nodeMap.values()).filter(n => n.data?.type === ElementType.OWL_NAMED_INDIVIDUAL);
        } else {
             return Array.from(nodeMap.values()).filter(n => n.data?.type === ElementType.OWL_CLASS);
        }
    }

    if (!targetClasses || targetClasses.size === 0) return [];

    const resultIds = new Set<string>();

    if (queryType === 'instances') {
        targetClasses.forEach(id => {
            const node = nodeMap.get(id);
            if (node?.data?.type === ElementType.OWL_NAMED_INDIVIDUAL) {
                resultIds.add(id);
            }
            const insts = instances[id];
            if (insts) insts.forEach(i => resultIds.add(i));
        });
    }
    else if (queryType === 'subclasses') {
        targetClasses.forEach(clsId => {
            const children = superClassOf[clsId]; 
            if (children) children.forEach(c => resultIds.add(c));
            const node = nodeMap.get(clsId);
            if (node?.data?.type === ElementType.OWL_CLASS) {
                resultIds.add(clsId);
            }
        });
    }
    else if (queryType === 'superclasses') {
         targetClasses.forEach(clsId => {
            const parents = subClassOf[clsId];
            if (parents) parents.forEach(p => resultIds.add(p));
            const node = nodeMap.get(clsId);
            if (node?.data?.type === ElementType.OWL_CLASS) {
                 resultIds.add(clsId);
            }
        });
    }

    return Array.from(resultIds).map(id => nodeMap.get(id)!).filter(n => !!n);
};

// --- 3. Compute Full Inferred Edge Set (The HermiT-like Output) ---

export const computeInferredEdges = (nodes: Node<UMLNodeData>[], explicitEdges: Edge[]): Edge[] => {
    // 1. Run Classification
    const index = classifyOntology(nodes, explicitEdges);
    
    const inferredEdges: Edge[] = [];
    // Helper to check duplicates
    const exists = new Set<string>(explicitEdges.map(e => `${e.source}-${e.target}-${e.label}`));

    const addEdge = (s: string, t: string, label: string, reason: string) => {
        if (s === t) return; // Prevent circular self-references in inference visualization
        
        const key = `${s}-${t}-${label}`;
        if (!exists.has(key)) {
            // Use deterministic ID based on content so ReactFlow doesn't re-mount edges on every render
            inferredEdges.push({
                id: `inferred-${s}-${t}-${label}`,
                source: s,
                target: t,
                label: label,
                type: 'smoothstep',
                animated: true, // Visually distinguish inferred edges
                style: { stroke: '#fbbf24', strokeWidth: 1.5, strokeDasharray: '5,5' },
                labelStyle: { fill: '#fbbf24', fontStyle: 'italic' },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#fbbf24' },
                data: { isInferred: true, inferenceType: reason }
            });
            exists.add(key);
        }
    };

    // A. Output SubClassOf Hierarchy (Transitive)
    Object.entries(index.subClassOf).forEach(([childId, parents]) => {
        parents.forEach(parentId => {
            // Already filtered in loop, but double check handled by addEdge guard
            addEdge(childId, parentId, 'rdfs:subClassOf', 'Transitive Subclass');
        });
    });

    // B. Output Type Assertions (Realization)
    Object.entries(index.types).forEach(([indivId, classes]) => {
        classes.forEach(classId => {
            addEdge(indivId, classId, 'rdf:type', 'Inferred Type');
        });
    });

    // C. Property Inference (Domain/Range/Inverse)
    explicitEdges.forEach(e => {
        if (!['rdf:type', 'subClassOf', 'rdfs:subClassOf', 'owl:disjointWith', 'disjointWith'].includes(e.label as string)) {
            // Find property node to get domain/range
            // Safety check for data
            const propNode = nodes.find(n => n.data && (n.data.label === e.label || n.data.label === (e.label as string).split(':')[1]));
            
            if (propNode && propNode.data && propNode.data.methods) {
                // Domain
                propNode.data.methods.forEach(m => {
                    if (m.name.toLowerCase() === 'domain') {
                        const domainId = index.labelToId[m.returnType];
                        if (domainId) {
                            addEdge(e.source, domainId, 'rdf:type', `Domain of ${e.label}`);
                        }
                    }
                    if (m.name.toLowerCase() === 'range') {
                        const rangeId = index.labelToId[m.returnType];
                        if (rangeId) {
                            addEdge(e.target, rangeId, 'rdf:type', `Range of ${e.label}`);
                        }
                    }
                    if (m.name.toLowerCase() === 'inverseof') {
                        const invPropName = m.returnType;
                        // Inverse logic might produce cycle if symmetric, addEdge handles self-loop
                        // Explicit inverse edge creation logic:
                        if (e.target !== e.source) {
                            const invKey = `${e.target}-${e.source}-${invPropName}`;
                            if (!exists.has(invKey)) {
                                inferredEdges.push({
                                    id: `inferred-inv-${e.target}-${e.source}-${invPropName}`,
                                    source: e.target,
                                    target: e.source,
                                    label: invPropName,
                                    type: 'smoothstep',
                                    animated: true,
                                    style: { stroke: '#a78bfa', strokeWidth: 1.5, strokeDasharray: '5,5' }, // different color for inverse
                                    labelStyle: { fill: '#a78bfa', fontStyle: 'italic' },
                                    markerEnd: { type: MarkerType.ArrowClosed, color: '#a78bfa' },
                                    data: { isInferred: true, inferenceType: 'Inverse Property' }
                                });
                                exists.add(invKey);
                            }
                        }
                    }
                });
            }
        }
    });

    // D. Property Assertion Inference (SubProperties, Symmetry, Transitivity)
    
    // Helper to get transitive closure of a single property type on graph
    const computeTransitiveClosure = (propLabel: string, baseEdges: Edge[]) => {
        // Build adjacency for this specific property
        const adj = new Map<string, string[]>();
        baseEdges.forEach(e => {
            if (e.label === propLabel) {
                if (!adj.has(e.source)) adj.set(e.source, []);
                adj.get(e.source)!.push(e.target);
            }
        });

        // DFS for each node
        Object.keys(index.outgoingEdges).forEach(startNode => {
            // Simple DFS to find all reachable nodes via 'propLabel' edges
            const queue = [startNode];
            const localVisited = new Set<string>();
            localVisited.add(startNode);

            while(queue.length > 0) {
                const u = queue.shift()!;
                const neighbors = adj.get(u) || [];
                neighbors.forEach(v => {
                    if (!localVisited.has(v)) {
                        localVisited.add(v);
                        queue.push(v);
                        // Add inferred edge from startNode to v
                        addEdge(startNode, v, propLabel, 'Transitive Property');
                    }
                });
            }
        });
    };

    // Filter for Property Assertions (Object/Data properties between individuals/nodes)
    const assertionEdges = explicitEdges.filter(e => 
        !['rdf:type', 'a', 'subClassOf', 'rdfs:subClassOf', 'owl:disjointWith', 'disjointWith', 'subPropertyOf', 'rdfs:subPropertyOf'].includes(e.label as string)
    );

    // 1. SubPropertyOf Inference: if P subProp Q, and x P y, then x Q y
    // Also handles the base assertions for symmetry/transitivity steps
    const activeAssertions = [...assertionEdges]; // We will grow this list with inferred props for transitivity check

    assertionEdges.forEach(e => {
        const p = e.label as string;
        // Check super properties
        if (index.subPropertyOf[p]) {
            index.subPropertyOf[p].forEach(q => {
                addEdge(e.source, e.target, q, 'Sub-Property');
                // Add to active set for further reasoning (e.g. if q is transitive)
                activeAssertions.push({ ...e, label: q, id: `temp-${Math.random()}` });
            });
        }
    });

    // 2. Symmetry: if P Symmetric, x P y -> y P x
    activeAssertions.forEach(e => {
        const p = e.label as string;
        const chars = index.propertyCharacteristics[p];
        if (chars && chars.has('Symmetric')) {
            addEdge(e.target, e.source, p, 'Symmetric Property');
        }
    });

    // 3. Transitivity: if P Transitive, x P y & y P z -> x P z
    // We need to identify which properties are transitive
    const transitiveProps = new Set<string>();
    Object.entries(index.propertyCharacteristics).forEach(([prop, chars]) => {
        if (chars.has('Transitive')) transitiveProps.add(prop);
    });

    transitiveProps.forEach(prop => {
        // We use the full set of edges (explicit + inferred subprops/symmetric)
        // We filter activeAssertions to those matching 'prop'
        // Since we didn't push symmetric inferred edges to activeAssertions, we might miss some transitive chains involving symmetric steps.
        // For full correctness, one would run a fixpoint iteration. 
        // Here we do a single pass of closure on the current known edges for that property.
        
        // Construct edges for this property from explicit + inferred so far
        const relevantEdges = [
            ...explicitEdges.filter(e => e.label === prop),
            ...inferredEdges.filter(e => e.label === prop)
        ];
        
        computeTransitiveClosure(prop, relevantEdges);
    });

    return [...explicitEdges, ...inferredEdges];
};
