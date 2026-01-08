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
    
    // Declarations
    nodes.forEach(node => {
        const iri = node.data.iri || `:${node.data.label}`;
        const fmtIRI = iri.startsWith('http') ? `<${iri}>` : iri.includes(':') ? iri : `:${iri}`;
        
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
    
    lines.push('');

    // Axioms from Methods (Restrictions, etc.)
    nodes.forEach(node => {
        const subjectIRI = node.data.iri || `:${node.data.label}`;
        const s = subjectIRI.startsWith('http') ? `<${subjectIRI}>` : subjectIRI.includes(':') ? subjectIRI : `:${subjectIRI}`;
        
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

    // Edges
    edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
            const sIRI = sourceNode.data.iri || `:${sourceNode.data.label}`;
            const tIRI = targetNode.data.iri || `:${targetNode.data.label}`;
            
            const s = sIRI.startsWith('http') ? `<${sIRI}>` : sIRI.includes(':') ? sIRI : `:${sIRI}`;
            const t = tIRI.startsWith('http') ? `<${tIRI}>` : tIRI.includes(':') ? tIRI : `:${tIRI}`;
            
            let prop: string;
            if (typeof edge.label === 'string') {
                prop = edge.label;
            } else if (typeof edge.label === 'number') {
                prop = edge.label.toString();
            } else {
                prop = 'owl:topObjectProperty';
            }

            const p = prop.startsWith('http') ? `<${prop}>` : prop.includes(':') ? prop : `:${prop}`;
            
            if (prop === 'rdf:type' || prop === 'a') {
                lines.push(`${indent(1)}ClassAssertion( ${t} ${s} )`);
            } else if (prop === 'rdfs:subClassOf' || prop === 'subClassOf') {
                lines.push(`${indent(1)}SubClassOf( ${s} ${t} )`);
            } else if (prop === 'owl:disjointWith' || prop === 'disjointWith') {
                 lines.push(`${indent(1)}DisjointClasses( ${s} ${t} )`);
            } else {
                lines.push(`${indent(1)}ObjectPropertyAssertion( ${p} ${s} ${t} )`);
            }
        }
    });

    lines.push(')');
    return lines.join('\n');
};