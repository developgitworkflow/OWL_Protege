
import { UMLNodeData, ElementType, Method, Attribute } from '../types';

/**
 * Translates Manchester Syntax fragments to Natural Language
 */
const translateExpression = (expr: string): string => {
    let s = expr;
    
    // Quantifiers
    s = s.replace(/(\w+)\s+some\s+(\w+)/g, "relates via '$1' to at least one '$2'");
    s = s.replace(/(\w+)\s+only\s+(\w+)/g, "relates via '$1' only to '$2'");
    s = s.replace(/(\w+)\s+value\s+(\w+)/g, "relates via '$1' specifically to '$2'");
    
    // Cardinality (Qualified & Unqualified)
    // Regex: property min/max/exactly N Class(optional)
    
    // Qualified: prop min N Class
    s = s.replace(/(\w+)\s+min\s+(\d+)\s+(\w+)/g, "has at least $2 '$1' relationships to '$3'");
    s = s.replace(/(\w+)\s+max\s+(\d+)\s+(\w+)/g, "has at most $2 '$1' relationships to '$3'");
    s = s.replace(/(\w+)\s+exactly\s+(\d+)\s+(\w+)/g, "has exactly $2 '$1' relationships to '$3'");
    
    // Unqualified: prop min N (followed by end of string or non-word)
    s = s.replace(/(\w+)\s+min\s+(\d+)(?!\s+\w)/g, "has at least $2 '$1' relationships");
    s = s.replace(/(\w+)\s+max\s+(\d+)(?!\s+\w)/g, "has at most $2 '$1' relationships");
    s = s.replace(/(\w+)\s+exactly\s+(\d+)(?!\s+\w)/g, "has exactly $2 '$1' relationships");
    
    // Logical Operators
    s = s.replace(/\band\b/g, "and");
    s = s.replace(/\bor\b/g, "or");
    s = s.replace(/\bnot\b/g, "is not");
    
    // Self
    s = s.replace(/(\w+)\s+some\s+Self/gi, "is related to itself via '$1'");

    return s;
};

export const verbalizeNode = (node: UMLNodeData): { title: string, subtitle: string, description: string[] } => {
    const lines: string[] = [];
    
    // 1. Basic Definition
    if (node.description) {
        lines.push(node.description);
    }

    // 2. Annotations
    if (node.annotations && node.annotations.length > 0) {
        node.annotations.forEach(ann => {
            // Skip if this is the comment we just showed as description
            if (ann.property === 'rdfs:comment' && ann.value.replace(/^"|"$/g, '') === node.description) return;
            
            const cleanProp = ann.property.split(/[:#]/).pop();
            const cleanVal = ann.value.replace(/^"|"$/g, '');
            lines.push(`**${cleanProp}**: ${cleanVal}`);
        });
    }

    // 3. Type Specific Verbalization
    if (node.type === ElementType.OWL_CLASS) {
        const parents: string[] = [];
        const restrictions: string[] = [];
        const equivalents: string[] = [];
        const disjoints: string[] = [];

        node.methods.forEach(m => {
            const name = m.name.toLowerCase().replace(/[^a-z]/g, '');
            const target = translateExpression(m.returnType);

            if (name === 'subclassof') {
                // Heuristic: if target is a single word, it's a parent class
                if (/^[a-zA-Z0-9_:]+$/.test(m.returnType)) {
                    parents.push(target);
                } else {
                    restrictions.push(target);
                }
            } else if (name === 'equivalentto' || name === 'equivalentclass') {
                equivalents.push(target);
            } else if (name === 'disjointwith') {
                disjoints.push(target);
            }
        });

        // Implicit attributes as data properties
        node.attributes.forEach(attr => {
            const type = attr.type ? attr.type : 'Literal';
            restrictions.push(`has the data property '${attr.name}' (type: ${type})`);
        });

        if (parents.length > 0) lines.push(`Is a kind of **${parents.join(', ')}**.`);
        if (equivalents.length > 0) lines.push(`Is defined as equivalent to: ${equivalents.join('; ')}.`);
        if (restrictions.length > 0) {
            lines.push("Necessary criteria:");
            restrictions.forEach(r => lines.push(`• ${r}`));
        }
        if (disjoints.length > 0) lines.push(`Cannot be: ${disjoints.join(', ')}.`);

    } 
    else if (node.type === ElementType.OWL_NAMED_INDIVIDUAL) {
        const types: string[] = [];
        const facts: string[] = [];

        // We assume edge analysis happens outside or axioms are stored in methods
        // Here we just look at stored methods/attributes
        node.methods.forEach(m => {
            const name = m.name.toLowerCase();
            if (name === 'type') types.push(m.returnType);
            else if (name === 'sameas') lines.push(`Is the same individual as ${m.returnType}.`);
            else if (name === 'differentfrom') lines.push(`Is different from ${m.returnType}.`);
            else if (name !== 'subclassof') {
                // Property assertion
                facts.push(`**${name}**: ${m.returnType}`);
            }
        });

        if (types.length > 0) lines.push(`Is an instance of **${types.join(', ')}**.`);
        if (facts.length > 0) {
            lines.push("Facts:");
            facts.forEach(f => lines.push(`• ${f}`));
        }
    }
    else if (node.type === ElementType.OWL_OBJECT_PROPERTY) {
        const characteristics: string[] = [];
        node.attributes.forEach(a => characteristics.push(a.name));
        
        if (characteristics.length > 0) {
            lines.push(`Characteristics: ${characteristics.join(', ')}.`);
            
            // Explain specific characteristics
            if (characteristics.includes('Functional')) lines.push("• Each subject can have at most one value for this property.");
            if (characteristics.includes('InverseFunctional')) lines.push("• Two different subjects cannot share the same value.");
            if (characteristics.includes('Transitive')) lines.push("• If A relates to B, and B relates to C, then A relates to C.");
            if (characteristics.includes('Symmetric')) lines.push("• If A relates to B, then B relates to A.");
        }

        node.methods.forEach(m => {
            const name = m.name.toLowerCase();
            if (name === 'domain') lines.push(`Applies to instances of **${m.returnType}**.`);
            if (name === 'range') lines.push(`Points to instances of **${m.returnType}**.`);
            if (name === 'inverseof') lines.push(`Is the inverse of **${m.returnType}**.`);
            if (name === 'subpropertyof') lines.push(`Is a specialization of **${m.returnType}**.`);
        });
    }

    if (lines.length === 0) {
        lines.push("No logical axioms defined.");
    }

    let subtitle = node.type.replace('owl_', '').replace('_', ' ');
    if (node.iri) subtitle += ` (${node.iri})`;

    return {
        title: node.label,
        subtitle: subtitle,
        description: lines
    };
};
