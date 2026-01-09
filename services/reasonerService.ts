import { Node, Edge } from 'reactflow';
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

    // Initialize structures
    nodes.forEach(n => {
        const label = n.data.label;
        labelToId[label] = n.id;
        // Handle Prefix stripping for lookups (e.g. "ex:Person" -> "Person")
        if (label.includes(':')) labelToId[label.split(':')[1]] = n.id;
        
        subClassOf[n.id] = new Set();
        superClassOf[n.id] = new Set();
        instances[n.id] = new Set();
        types[n.id] = new Set();
        outgoingEdges[n.id] = [];
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
        n.data.methods.forEach(m => {
            if (m.name.toLowerCase() === 'subclassof') {
                const targetId = labelToId[m.returnType];
                if (targetId) {
                    subClassOf[n.id].add(targetId);
                    superClassOf[targetId].add(n.id);
                }
            }
        });
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

    // 2. Propagate Instances (Inheritance)
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

    classifiedIndex = { nodeMap, labelToId, subClassOf, superClassOf, instances, types, outgoingEdges };
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
        
        // Find entities that exist in ALL sets
        // (Simplified Intersection logic: works for Instances and Subclasses if they appear in all result sets)
        // Note: For finding Subclasses of (A and B), we ideally want classes C where C sub A AND C sub B.
        // This logic finds existing nodes that satisfy all conditions.
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

        // Find nodes that have an outgoing edge 'propLabel' pointing to any 'targetNodes'
        // OR have an axiom saying they do.
        
        // A. Check explicit edges
        Object.keys(outgoingEdges).forEach(sourceId => {
            const edges = outgoingEdges[sourceId];
            const hasEdge = edges.some(e => 
                (e.label === propLabel || e.label.endsWith(`:${propLabel}`)) && 
                targetNodes.has(e.target)
            );
            if (hasEdge) result.add(sourceId);
        });

        // B. Check Axioms (e.g. Professor: teaches some Course)
        nodeMap.forEach(node => {
            node.data.methods.forEach(m => {
                if (m.name === 'SubClassOf') {
                    // Primitive string match: "teaches some Course"
                    // In a real reasoner this would be parsed deeper, but here we match the expression
                    if (m.returnType.includes(`${propLabel} some`)) {
                        // Check if the target in the string roughly matches our target expression
                        // Simplified: if target is "Course" and axiom is "teaches some Course" -> Match
                        if (m.returnType.includes(targetExpr)) {
                            result.add(node.id);
                        }
                    }
                }
            });
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

        // Check explicit edges
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

    // 0. Meta-Queries (Get all entities of a type)
    // These bypass the standard DL parser to provide list functionality
    if (['owl:class', 'class', 'classes'].includes(lowerQuery)) {
        return Array.from(nodeMap.values()).filter(n => n.data.type === ElementType.OWL_CLASS);
    }
    if (['owl:namedindividual', 'namedindividual', 'individual', 'individuals'].includes(lowerQuery)) {
        return Array.from(nodeMap.values()).filter(n => n.data.type === ElementType.OWL_NAMED_INDIVIDUAL);
    }
    if (['owl:objectproperty', 'objectproperty', 'object properties'].includes(lowerQuery)) {
        return Array.from(nodeMap.values()).filter(n => n.data.type === ElementType.OWL_OBJECT_PROPERTY);
    }
    if (['owl:datatypeproperty', 'datatypeproperty', 'data properties', 'dataproperty'].includes(lowerQuery)) {
        return Array.from(nodeMap.values()).filter(n => n.data.type === ElementType.OWL_DATA_PROPERTY);
    }
    if (['owl:datatype', 'datatype', 'datatypes'].includes(lowerQuery)) {
        return Array.from(nodeMap.values()).filter(n => n.data.type === ElementType.OWL_DATATYPE);
    }

    // 1. Resolve Expression
    let targetClasses = resolveExpression(query);

    // 2. Handle owl:Thing (Universal)
    if (!targetClasses && (lowerQuery === 'thing' || lowerQuery === 'owl:thing')) {
        if (queryType === 'instances') {
             // Instances of Thing = All Individuals
             return Array.from(nodeMap.values()).filter(n => n.data.type === ElementType.OWL_NAMED_INDIVIDUAL);
        } else {
             // Subclasses of Thing = All Classes (Simplified)
             return Array.from(nodeMap.values()).filter(n => n.data.type === ElementType.OWL_CLASS);
        }
    }

    if (!targetClasses || targetClasses.size === 0) return [];

    const resultIds = new Set<string>();

    if (queryType === 'instances') {
        // Find instances of ANY of the target classes
        // OR if the result of resolveExpression was ALREADY individuals (e.g. via "value" restriction or direct lookup)
        
        targetClasses.forEach(id => {
            const node = nodeMap.get(id);
            // If the resolved node is an Individual, add it directly
            if (node?.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
                resultIds.add(id);
            }
            // If it's a class, find its instances
            const insts = instances[id];
            if (insts) insts.forEach(i => resultIds.add(i));
        });
    }
    else if (queryType === 'subclasses') {
        targetClasses.forEach(clsId => {
            // Add explicit subclasses
            const children = superClassOf[clsId]; 
            if (children) children.forEach(c => resultIds.add(c));
            
            // Note: resolveExpression might return "Implicit Classes" logic by returning nodes that fit criteria
            // If the query was "teaches some Course", resolveExpression returns "Professor".
            // "Professor" is arguably a subclass of the anonymous class expression "teaches some Course".
            // So we also include the resolved nodes themselves if they are Classes.
            const node = nodeMap.get(clsId);
            if (node?.data.type === ElementType.OWL_CLASS) {
                // Determine if we should include the node itself as a 'result' of the query logic?
                // Standard DL Query "Subclasses of X" usually doesn't include X unless "Descendant" mode.
                // But if X is an expression, we want Named Classes that are SubClasses of Expr.
                resultIds.add(clsId);
            }
        });
    }
    else if (queryType === 'superclasses') {
         targetClasses.forEach(clsId => {
            const parents = subClassOf[clsId];
            if (parents) parents.forEach(p => resultIds.add(p));
            
            // See note above
            const node = nodeMap.get(clsId);
            if (node?.data.type === ElementType.OWL_CLASS) {
                 resultIds.add(clsId);
            }
        });
    }

    return Array.from(resultIds).map(id => nodeMap.get(id)!).filter(n => !!n);
};