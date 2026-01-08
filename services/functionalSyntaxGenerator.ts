import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, ProjectData } from '../types';

export const generateFunctionalSyntax = (nodes: Node<UMLNodeData>[], edges: Edge[], metadata: ProjectData): string => {
    const lines: string[] = [];
    const indent = (lvl: number) => '    '.repeat(lvl);

    const baseIRI = metadata.baseIri || 'http://example.org/ontology#';
    const prefix = metadata.defaultPrefix || 'ex';
    
    // Header
    lines.push(`Prefix( xsd:=<http://www.w3.org/2001/XMLSchema#> )`);
    lines.push(`Prefix( owl:=<http://www.w3.org/2002/07/owl#> )`);
    lines.push(`Prefix( xml:=<http://www.w3.org/XML/1998/namespace> )`);
    lines.push(`Prefix( rdf:=<http://www.w3.org/1999/02/22-rdf-syntax-ns#> )`);
    lines.push(`Prefix( rdfs:=<http://www.w3.org/2000/01/rdf-schema#> )`);
    lines.push(`Prefix( : =<${baseIRI}> )`); 
    if (prefix !== ':') lines.push(`Prefix( ${prefix}:=<${baseIRI}> )`);
    
    lines.push('');
    lines.push(`Ontology( <${baseIRI.replace('#', '')}>`);
    
    // Helper to format IRIs
    const fmt = (str: string) => {
        if (!str) return `:${str}`;
        if (str.startsWith('http')) return `<${str}>`;
        if (str.includes(':')) return str;
        return `:${str}`;
    };

    // 1. Explicit Declarations from Nodes
    const declaredIRIs = new Set<string>();

    nodes.forEach(node => {
        const iri = node.data.iri || `:${node.data.label}`;
        const fmtIRI = fmt(iri);
        declaredIRIs.add(fmtIRI);
        
        let typeStr = '';
        switch(node.data.type) {
            case ElementType.OWL_CLASS: typeStr = 'Class'; break;
            case ElementType.OWL_NAMED_INDIVIDUAL: typeStr = 'NamedIndividual'; break;
            case ElementType.OWL_OBJECT_PROPERTY: typeStr = 'ObjectProperty'; break;
            case ElementType.OWL_DATA_PROPERTY: typeStr = 'DataProperty'; break;
            case ElementType.OWL_DATATYPE: typeStr = 'Datatype'; break;
        }
        
        if (typeStr) {
            lines.push(`${indent(1)}Declaration( ${typeStr}( ${fmtIRI} ) )`);
        }
        
        // Annotations
        lines.push(`${indent(1)}AnnotationAssertion( rdfs:label ${fmtIRI} "${node.data.label}" )`);
        if (node.data.description) {
             lines.push(`${indent(1)}AnnotationAssertion( rdfs:comment ${fmtIRI} "${node.data.description}" )`);
        }
    });

    // 2. Infer Property Types from Edges
    const inferredProps = new Map<string, 'ObjectProperty' | 'DataProperty'>();
    const STANDARD_LABELS = new Set(['rdf:type', 'a', 'rdfs:subClassOf', 'subClassOf', 'owl:disjointWith', 'disjointWith']);

    edges.forEach(edge => {
        let label = edge.label as string || '';
        if (STANDARD_LABELS.has(label)) return;

        const pIRI = fmt(label);
        if (declaredIRIs.has(pIRI)) return; // Already declared explicitly

        const targetNode = nodes.find(n => n.id === edge.target);
        if (targetNode) {
            // If target is a Datatype, it's a DataProperty. Otherwise ObjectProperty.
            if (targetNode.data.type === ElementType.OWL_DATATYPE) {
                inferredProps.set(pIRI, 'DataProperty');
            } else {
                // If it was already seen as DataProperty, don't overwrite (inconsistency handled by validator)
                if (inferredProps.get(pIRI) !== 'DataProperty') {
                    inferredProps.set(pIRI, 'ObjectProperty');
                }
            }
        }
    });

    // Generate Inferred Declarations
    inferredProps.forEach((type, iri) => {
        lines.push(`${indent(1)}Declaration( ${type}( ${iri} ) )`);
    });
    
    lines.push('');

    // 3. Axioms from Methods (Restrictions, etc.)
    nodes.forEach(node => {
        const subjectIRI = node.data.iri || `:${node.data.label}`;
        const s = fmt(subjectIRI);
        
        node.data.methods.forEach(method => {
            const op = method.name; 
            let target = method.returnType;
            
            // Heuristic formatting for target
            const tokens = target.split(' ');
            const fmtTarget = tokens.map(p => {
                 // Skip keywords
                 if (['ObjectUnionOf', 'ObjectIntersectionOf', 'ObjectOneOf', 'DataUnionOf', 'DataIntersectionOf', 'DataOneOf'].some(k => p.includes(k))) return p;
                 if (p.startsWith('xsd:') || p.startsWith('owl:') || p.startsWith('rdf:') || p.startsWith('rdfs:')) return p;
                 if (p.startsWith('<') || p.includes(':')) return p;
                 if (p.match(/^[a-zA-Z0-9_]+$/) && !['some', 'only', 'value', 'min', 'max', 'exactly', 'that', 'not', 'and', 'or'].includes(p.toLowerCase())) return `:${p}`;
                 return p;
            }).join(' ');

            lines.push(`${indent(1)}${op}( ${s} ${fmtTarget} )`);
        });
        
        // Attributes (Data Properties / Characteristics)
        node.data.attributes.forEach(attr => {
            const attrName = attr.name.includes(':') ? attr.name : `:${attr.name}`;
            
            if (node.data.type === ElementType.OWL_CLASS) {
                 // Class Attribute -> Data Property usage
                 // Ideally this implies DataPropertyDomain( attr :Class )
                 lines.push(`${indent(1)}DataPropertyDomain( ${attrName} ${s} )`);
                 if (attr.type) {
                     lines.push(`${indent(1)}DataPropertyRange( ${attrName} ${attr.type} )`);
                 }
            } else if (node.data.type === ElementType.OWL_OBJECT_PROPERTY) {
                // Object Property Characteristic
                if (['Functional', 'InverseFunctional', 'Transitive', 'Symmetric', 'Asymmetric', 'Reflexive', 'Irreflexive'].includes(attr.name)) {
                     lines.push(`${indent(1)}${attr.name}ObjectProperty( ${s} )`);
                }
            }
        });
    });

    // 4. Edges -> Assertions
    edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
            const s = fmt(sourceNode.data.iri || sourceNode.data.label);
            const t = fmt(targetNode.data.iri || targetNode.data.label);
            
            let prop: string;
            if (typeof edge.label === 'string') {
                prop = edge.label;
            } else if (typeof edge.label === 'number') {
                prop = edge.label.toString();
            } else {
                prop = 'owl:topObjectProperty';
            }

            const p = fmt(prop);
            
            if (prop === 'rdf:type' || prop === 'a') {
                lines.push(`${indent(1)}ClassAssertion( ${t} ${s} )`);
            } else if (prop === 'rdfs:subClassOf' || prop === 'subClassOf') {
                lines.push(`${indent(1)}SubClassOf( ${s} ${t} )`);
            } else if (prop === 'owl:disjointWith' || prop === 'disjointWith') {
                 lines.push(`${indent(1)}DisjointClasses( ${s} ${t} )`);
            } else {
                // Determine if Object or Data Assertion
                // Priority: Explicit Type -> Inferred from Target
                let isDataProp = false;
                
                // Check if explicit node exists for property
                const propNode = nodes.find(n => (n.data.iri === p || `:${n.data.label}` === p) && n.data.type === ElementType.OWL_DATA_PROPERTY);
                if (propNode) {
                    isDataProp = true;
                } else if (targetNode.data.type === ElementType.OWL_DATATYPE) {
                    // Inference
                    isDataProp = true;
                }

                if (isDataProp) {
                     lines.push(`${indent(1)}DataPropertyAssertion( ${p} ${s} ${t} )`);
                } else {
                     lines.push(`${indent(1)}ObjectPropertyAssertion( ${p} ${s} ${t} )`);
                }
            }
        }
    });

    lines.push(')');
    return lines.join('\n');
};