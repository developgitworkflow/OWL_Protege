
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, ProjectData } from '../types';

export const generateManchesterSyntax = (nodes: Node<UMLNodeData>[], edges: Edge[], metadata: ProjectData): string => {
    const lines: string[] = [];
    const indent = '    ';

    const baseIRI = metadata.baseIri || 'http://example.org/ontology#';
    const defaultPrefix = metadata.defaultPrefix || 'ex';
    
    // --- Helper: IRI Formatting ---
    const fmt = (str: string) => {
        if (!str) return 'owl:Thing';
        if (str.startsWith('http')) return `<${str}>`;
        if (str.includes(':')) return str;
        // Check for standard types
        if (['string', 'integer', 'int', 'boolean', 'float', 'double'].includes(str)) return `xsd:${str}`;
        return `${defaultPrefix}:${str.replace(/\s+/g, '_')}`;
    };

    const getNodeLabel = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        return node ? fmt(node.data.label) : nodeId;
    };

    // --- Helper: Expression Conversion (Functional -> Manchester Heuristics) ---
    const toManchesterExpr = (expr: string): string => {
        let s = expr.trim();
        s = s.replace(/ObjectIntersectionOf/g, 'and')
             .replace(/ObjectUnionOf/g, 'or')
             .replace(/ObjectComplementOf/g, 'not')
             .replace(/ObjectOneOf/g, '{')
             .replace(/DataIntersectionOf/g, 'and')
             .replace(/DataUnionOf/g, 'or')
             .replace(/DataOneOf/g, '{');
        
        if (s.includes('{') && !s.includes('}')) s += '}'; // close brace if we opened one

        return s;
    };

    const renderAnnotations = (node: Node<UMLNodeData>) => {
        // Fallback: if description exists but not in annotations, add it as rdfs:comment
        const annotations = [...(node.data.annotations || [])];
        if (node.data.description && !annotations.some(a => a.property === 'rdfs:comment')) {
            annotations.push({
                id: 'desc-fallback',
                property: 'rdfs:comment',
                value: `"${node.data.description}"`
            });
        }
        
        if (annotations.length > 0) {
            const lines: string[] = [];
            lines.push(`${indent}Annotations:`);
            // Usually comma separated
            const annStr = annotations.map(a => {
                let val = a.value;
                if (a.language) {
                    val = `${val.replace(/@\w+$/, '')}@${a.language}`; // Ensure lang tag
                }
                return `${a.property} ${val}`;
            }).join(', ');
            lines.push(`${indent}    ${annStr}`);
            return lines;
        }
        return [];
    };

    // --- Header ---
    lines.push(`Prefix: xsd: <http://www.w3.org/2001/XMLSchema#>`);
    lines.push(`Prefix: owl: <http://www.w3.org/2002/07/owl#>`);
    lines.push(`Prefix: rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>`);
    lines.push(`Prefix: rdfs: <http://www.w3.org/2000/01/rdf-schema#>`);
    lines.push(`Prefix: : <${baseIRI}>`);
    if (defaultPrefix !== ':') lines.push(`Prefix: ${defaultPrefix}: <${baseIRI}>`);
    
    if (metadata.namespaces) {
        Object.entries(metadata.namespaces).forEach(([p, iri]) => {
            lines.push(`Prefix: ${p}: <${iri}>`);
        });
    }

    lines.push('');
    const ontIri = metadata.ontologyIri || baseIRI.replace(/#$/, '');
    lines.push(`Ontology: <${ontIri}>`);
    if (metadata.versionIri) {
        lines.push(`${indent}<${metadata.versionIri}>`);
    }
    
    // Ontology Annotations
    if (metadata.description || (metadata.annotations && metadata.annotations.length > 0)) {
        lines.push(`${indent}Annotations:`);
        const ontAnns = [];
        if (metadata.description) ontAnns.push(`rdfs:comment "${metadata.description}"`);
        if (metadata.annotations) {
            metadata.annotations.forEach(a => {
                let val = a.value;
                if (a.language) val = `${val.replace(/@\w+$/, '')}@${a.language}`;
                ontAnns.push(`${a.property} ${val}`);
            });
        }
        lines.push(`${indent}    ${ontAnns.join(', ')}`);
    }
    
    lines.push('');

    // --- 1. Object Properties ---
    const objProps = nodes.filter(n => n.data.type === ElementType.OWL_OBJECT_PROPERTY);
    if (objProps.length > 0) {
        objProps.forEach(node => {
            lines.push(`ObjectProperty: ${fmt(node.data.label)}`);
            
            lines.push(...renderAnnotations(node));

            // Characteristics
            const chars: string[] = [];
            node.data.attributes.forEach(attr => {
                chars.push(attr.name); 
            });
            if (chars.length > 0) {
                lines.push(`${indent}Characteristics: ${chars.join(', ')}`);
            }

            // Axioms
            node.data.methods.forEach(m => {
                const type = m.name.toLowerCase();
                const target = toManchesterExpr(m.returnType);
                
                if (type === 'domain') lines.push(`${indent}Domain: ${target}`);
                else if (type === 'range') lines.push(`${indent}Range: ${target}`);
                else if (type === 'subpropertyof') lines.push(`${indent}SubPropertyOf: ${target}`);
                else if (type === 'inverseof') lines.push(`${indent}InverseOf: ${target}`);
            });
            lines.push('');
        });
    }

    // --- 2. Data Properties ---
    const dataProps = nodes.filter(n => n.data.type === ElementType.OWL_DATA_PROPERTY);
    if (dataProps.length > 0) {
        dataProps.forEach(node => {
            lines.push(`DataProperty: ${fmt(node.data.label)}`);
            
            lines.push(...renderAnnotations(node));

            const chars: string[] = [];
            node.data.attributes.forEach(attr => chars.push(attr.name));
            if (chars.length > 0) {
                lines.push(`${indent}Characteristics: ${chars.join(', ')}`);
            }

            node.data.methods.forEach(m => {
                const type = m.name.toLowerCase();
                const target = toManchesterExpr(m.returnType);
                if (type === 'domain') lines.push(`${indent}Domain: ${target}`);
                else if (type === 'range') lines.push(`${indent}Range: ${target}`);
                else if (type === 'subpropertyof') lines.push(`${indent}SubPropertyOf: ${target}`);
            });
            lines.push('');
        });
    }

    // --- 3. Classes ---
    const classes = nodes.filter(n => n.data.type === ElementType.OWL_CLASS);
    classes.forEach(node => {
        const s = fmt(node.data.label);
        lines.push(`Class: ${s}`);
        
        lines.push(...renderAnnotations(node));

        // SubClassOf from Edges
        const parentEdges = edges.filter(e => e.source === node.id && (e.label === 'subClassOf' || e.label === 'rdfs:subClassOf'));
        if (parentEdges.length > 0) {
            const parents = parentEdges.map(e => getNodeLabel(e.target));
            lines.push(`${indent}SubClassOf: ${parents.join(', ')}`);
        }

        // Explicit Axioms (Methods)
        const groups: Record<string, string[]> = {};
        
        node.data.methods.forEach(m => {
            let key = '';
            let val = toManchesterExpr(m.returnType);
            const n = m.name.toLowerCase();

            if (n === 'subclassof') key = 'SubClassOf';
            else if (n === 'equivalentto' || n === 'equivalentclass') key = 'EquivalentTo';
            else if (n === 'disjointwith') key = 'DisjointWith';
            else if (n === 'disjointunionof') key = 'DisjointUnionOf';
            else if (n === 'haskey') key = 'HasKey';
            else key = 'SubClassOf'; 
            
            if (key) {
                if (!groups[key]) groups[key] = [];
                groups[key].push(val);
            }
        });

        // Implicit Restrictions from Attributes
        node.data.attributes.forEach(attr => {
            if (!groups['SubClassOf']) groups['SubClassOf'] = [];
            const prop = fmt(attr.name);
            const range = attr.type ? fmt(attr.type) : 'rdfs:Literal';
            groups['SubClassOf'].push(`${prop} some ${range}`);
        });

        Object.entries(groups).forEach(([k, vals]) => {
            lines.push(`${indent}${k}: ${vals.join(', ')}`);
        });

        lines.push('');
    });

    // --- 4. Individuals ---
    const individuals = nodes.filter(n => n.data.type === ElementType.OWL_NAMED_INDIVIDUAL);
    individuals.forEach(node => {
        lines.push(`Individual: ${fmt(node.data.label)}`);
        
        lines.push(...renderAnnotations(node));

        // Types from Edges (rdf:type)
        const typeEdges = edges.filter(e => e.source === node.id && (e.label === 'rdf:type' || e.label === 'a'));
        if (typeEdges.length > 0) {
            lines.push(`${indent}Types: ${typeEdges.map(e => getNodeLabel(e.target)).join(', ')}`);
        }

        // Facts (Property Assertions from Edges)
        const factEdges = edges.filter(e => e.source === node.id && e.label !== 'rdf:type' && e.label !== 'a');
        if (factEdges.length > 0) {
            const facts = factEdges.map(e => {
                let prop = e.label as string;
                if (!prop.includes(':')) prop = fmt(prop);
                return `${prop} ${getNodeLabel(e.target)}`;
            });
            lines.push(`${indent}Facts: ${facts.join(', ')}`);
        }

        // SameAs / DifferentFrom from methods
        node.data.methods.forEach(m => {
            const n = m.name.toLowerCase();
            if (n === 'sameas') lines.push(`${indent}SameAs: ${toManchesterExpr(m.returnType)}`);
            if (n === 'differentfrom') lines.push(`${indent}DifferentFrom: ${toManchesterExpr(m.returnType)}`);
        });

        lines.push('');
    });

    return lines.join('\n');
};
