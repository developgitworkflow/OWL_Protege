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
    // This attempts to convert internal representations to Manchester if they look like Functional syntax,
    // otherwise preserves them if they look like simple class names.
    const toManchesterExpr = (expr: string): string => {
        let s = expr.trim();
        
        // Handle common quantifiers if written in "min 1 prop" style or similar
        // Or if written in functional style "ObjectSomeValuesFrom(prop filler)"
        
        // Simple replacements for common keywords if not already in correct format
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

    // --- Header ---
    lines.push(`Prefix: xsd: <http://www.w3.org/2001/XMLSchema#>`);
    lines.push(`Prefix: owl: <http://www.w3.org/2002/07/owl#>`);
    lines.push(`Prefix: rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>`);
    lines.push(`Prefix: rdfs: <http://www.w3.org/2000/01/rdf-schema#>`);
    lines.push(`Prefix: : <${baseIRI}>`);
    if (defaultPrefix !== ':') lines.push(`Prefix: ${defaultPrefix}: <${baseIRI}>`);
    lines.push('');
    lines.push(`Ontology: <${baseIRI.replace('#', '')}>`);
    if (metadata.description) {
        lines.push(`${indent}Annotations: rdfs:comment "${metadata.description}"`);
    }
    lines.push('');

    // --- 1. Object Properties ---
    const objProps = nodes.filter(n => n.data.type === ElementType.OWL_OBJECT_PROPERTY);
    if (objProps.length > 0) {
        objProps.forEach(node => {
            lines.push(`ObjectProperty: ${fmt(node.data.label)}`);
            
            // Characteristics
            const chars: string[] = [];
            node.data.attributes.forEach(attr => {
                // In our model, attributes on properties are flags like "Functional"
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
        
        // Annotations
        lines.push(`${indent}Annotations: rdfs:label "${node.data.label}"`);
        if (node.data.description) {
             lines.push(`${indent}Annotations: rdfs:comment "${node.data.description}"`);
        }

        // SubClassOf from Edges
        const parentEdges = edges.filter(e => e.source === node.id && (e.label === 'subClassOf' || e.label === 'rdfs:subClassOf'));
        if (parentEdges.length > 0) {
            const parents = parentEdges.map(e => getNodeLabel(e.target));
            lines.push(`${indent}SubClassOf: ${parents.join(', ')}`);
        }

        // Explicit Axioms (Methods)
        // Group by type for cleaner output
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
            else {
                // It's likely a restriction where the method name is the property or quantifier?
                // In our model, 'name' is often the axiom type, but sometimes user might put property name there.
                // Assuming standard "SubClassOf" mostly.
                // If it is a Restriction not marked as SubClassOf explicitly in data model (implicit), we treat as SubClassOf
                // But usually the model stores "SubClassOf" -> "prop some value"
                key = 'SubClassOf'; 
                // If the return type looks like a raw string, assume it's a class expression
            }
            
            if (key) {
                if (!groups[key]) groups[key] = [];
                groups[key].push(val);
            }
        });

        // Implicit Restrictions from Attributes (Data Properties on Class)
        // Class: C -> DataProperty: p -> Range: xsd:int
        // This implies SubClassOf: p some xsd:int
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