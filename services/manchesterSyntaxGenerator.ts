
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, ProjectData } from '../types';

// --- Operator Configuration ---
// Precedence: 1 (or), 2 (and), 3 (not), 4 (restrictions/atomic)
const FUN_MAP: Record<string, { op: string, type: 'n-ary' | 'unary' | 'quantifier' | 'cardinality' | 'postfix' | 'set', prec: number }> = {
    'ObjectIntersectionOf': { op: 'and', type: 'n-ary', prec: 2 },
    'DataIntersectionOf': { op: 'and', type: 'n-ary', prec: 2 },
    'ObjectUnionOf': { op: 'or', type: 'n-ary', prec: 1 },
    'DataUnionOf': { op: 'or', type: 'n-ary', prec: 1 },
    'ObjectComplementOf': { op: 'not', type: 'unary', prec: 3 },
    'DataComplementOf': { op: 'not', type: 'unary', prec: 3 },
    'ObjectOneOf': { op: '', type: 'set', prec: 4 },
    'DataOneOf': { op: '', type: 'set', prec: 4 },
    'ObjectSomeValuesFrom': { op: 'some', type: 'quantifier', prec: 4 },
    'DataSomeValuesFrom': { op: 'some', type: 'quantifier', prec: 4 },
    'ObjectAllValuesFrom': { op: 'only', type: 'quantifier', prec: 4 },
    'DataAllValuesFrom': { op: 'only', type: 'quantifier', prec: 4 },
    'ObjectHasValue': { op: 'value', type: 'quantifier', prec: 4 },
    'DataHasValue': { op: 'value', type: 'quantifier', prec: 4 },
    'ObjectHasSelf': { op: 'Self', type: 'postfix', prec: 4 },
    'ObjectMinCardinality': { op: 'min', type: 'cardinality', prec: 4 },
    'DataMinCardinality': { op: 'min', type: 'cardinality', prec: 4 },
    'ObjectMaxCardinality': { op: 'max', type: 'cardinality', prec: 4 },
    'DataMaxCardinality': { op: 'max', type: 'cardinality', prec: 4 },
    'ObjectExactCardinality': { op: 'exactly', type: 'cardinality', prec: 4 },
    'DataExactCardinality': { op: 'exactly', type: 'cardinality', prec: 4 },
};

// Basic Tokenizer for Functional Syntax
const tokenize = (str: string): string[] => {
    // Matches parens, integers, IRIs, or words
    const regex = /([()@]|"[^"]*"|<[^>]+>|[a-zA-Z0-9_:-]+|\d+)/g;
    const tokens: string[] = [];
    let match;
    while ((match = regex.exec(str)) !== null) {
        tokens.push(match[0]);
    }
    return tokens;
};

export const generateManchesterSyntax = (nodes: Node<UMLNodeData>[], edges: Edge[], metadata: ProjectData): string => {
    const lines: string[] = [];
    const indent = '    ';

    const baseIRI = metadata.baseIri || 'http://example.org/ontology#';
    const defaultPrefix = metadata.defaultPrefix || 'ex';
    
    // --- IRI Formatting ---
    const fmt = (str: string) => {
        const s = str.trim();
        if (!s) return 'owl:Thing';
        if (s === 'Thing' || s === 'owl:Thing') return 'owl:Thing';
        if (s.startsWith('<') && s.endsWith('>')) return s;
        if (s.startsWith('http')) return `<${s}>`;
        if (s.includes(':')) return s;
        
        // Standard XSD types
        if (['string', 'integer', 'int', 'boolean', 'float', 'double', 'dateTime'].includes(s)) return `xsd:${s}`;
        
        return `${defaultPrefix}:${s.replace(/\s+/g, '_')}`;
    };

    const getNodeLabel = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        return node ? fmt(node.data.label) : nodeId;
    };

    // --- Expression Converter ---
    const convertExpression = (expr: string): string => {
        const cleanExpr = expr.trim();
        
        // If it doesn't look like Functional Syntax, assume it's already Manchester or a simple IRI
        // Functional syntax usually starts with a keyword from our map and a parenthesis
        const firstToken = cleanExpr.split(/[\s(]/)[0];
        if (!FUN_MAP[firstToken]) {
            // It might be "hasPart some Person" (Manchester) or ":Person" (IRI)
            // We just format IRIs inside if possible, but identifying mixed syntax is hard.
            // For now, assume if it's not Functional, we just return it (maybe running fmt on atoms if it looks like a single atom)
            if (!cleanExpr.includes(' ')) return fmt(cleanExpr);
            return cleanExpr; 
        }

        const tokens = tokenize(cleanExpr);
        let pos = 0;

        const parse = (precContext: number): string => {
            if (pos >= tokens.length) return '';
            
            const token = tokens[pos++];
            
            if (token === '(') {
                const inner = parse(0);
                // Consume ')'
                if (pos < tokens.length && tokens[pos] === ')') pos++;
                return `(${inner})`;
            }

            if (FUN_MAP[token]) {
                const config = FUN_MAP[token];
                // Expect '('
                if (pos < tokens.length && tokens[pos] === '(') pos++;
                
                let res = '';
                
                if (config.type === 'n-ary') {
                    const args: string[] = [];
                    while (pos < tokens.length && tokens[pos] !== ')') {
                        args.push(parse(config.prec));
                    }
                    res = args.join(` ${config.op} `);
                } 
                else if (config.type === 'unary') {
                    const arg = parse(config.prec);
                    res = `${config.op} ${arg}`;
                }
                else if (config.type === 'set') {
                    // ObjectOneOf( a b ) -> { a, b }
                    const args: string[] = [];
                    while (pos < tokens.length && tokens[pos] !== ')') {
                        args.push(fmt(parse(0))); // Format individuals
                    }
                    res = `{ ${args.join(', ')} }`;
                }
                else if (config.type === 'quantifier') {
                    // ObjectSomeValuesFrom( prop Class )
                    const prop = fmt(parse(0)); // property is usually atomic or simple
                    const filler = parse(config.prec);
                    res = `${prop} ${config.op} ${filler}`;
                }
                else if (config.type === 'cardinality') {
                    // ObjectMinCardinality( n prop Class )
                    const n = tokens[pos++]; // number
                    const prop = fmt(parse(0));
                    
                    // Optional class (if missing in functional, it's implicitly Thing, but parser usually finds it)
                    // If the next token is ')', then it's unqualified (Thing)
                    let filler = '';
                    if (tokens[pos] !== ')') {
                        filler = parse(config.prec);
                    }
                    
                    if (filler && filler !== 'owl:Thing') {
                        res = `${prop} ${config.op} ${n} ${filler}`;
                    } else {
                        res = `${prop} ${config.op} ${n}`;
                    }
                }
                else if (config.type === 'postfix') {
                    // ObjectHasSelf( prop )
                    const prop = fmt(parse(0));
                    res = `${prop} ${config.op}`;
                }

                // Consume closing ')'
                if (pos < tokens.length && tokens[pos] === ')') pos++;

                // Wrap if context precedence is tighter than current operator
                // Exception: n-ary operators usually associative, but mixed might need parens
                if (config.prec < precContext) {
                    return `(${res})`;
                }
                return res;
            }

            // Atom / IRI / Literal
            // If it starts with quote, return as is (Literal)
            if (token.startsWith('"')) {
                // Check for datatype ^^
                if (pos < tokens.length && tokens[pos] === '^^') {
                    pos++;
                    const dt = tokens[pos++];
                    return `${token}^^${fmt(dt)}`;
                }
                // Check for lang tag @
                if (pos < tokens.length && tokens[pos] === '@') {
                    pos++; // skip @ (the tokenizer might have split it?) 
                    // Tokenizer regex splits @ but also keeps it? 
                    // My regex `[()@]` captures @.
                    const lang = tokens[pos++];
                    return `${token}@${lang}`;
                }
                return token;
            }
            
            // Format Atom
            return fmt(token);
        };

        try {
            return parse(0);
        } catch (e) {
            console.error("Error parsing functional syntax for Manchester export", e);
            return expr; // Fallback
        }
    };

    const renderAnnotations = (node: Node<UMLNodeData>) => {
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
            const annStr = annotations.map(a => {
                let val = a.value;
                if (a.language) {
                    val = `${val.replace(/@\w+$/, '')}@${a.language}`;
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
                const target = convertExpression(m.returnType);
                
                if (type === 'domain') lines.push(`${indent}Domain: ${target}`);
                else if (type === 'range') lines.push(`${indent}Range: ${target}`);
                else if (type === 'subpropertyof') lines.push(`${indent}SubPropertyOf: ${target}`);
                else if (type === 'inverseof') lines.push(`${indent}InverseOf: ${target}`);
                else if (type === 'propertychainaxiom') lines.push(`${indent}SubPropertyChain: ${target}`); // Correct keyword
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
                const target = convertExpression(m.returnType);
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
            let val = convertExpression(m.returnType);
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

        // Implicit Restrictions from Attributes (Data Properties)
        node.data.attributes.forEach(attr => {
            if (!groups['SubClassOf']) groups['SubClassOf'] = [];
            const prop = fmt(attr.name);
            const range = attr.type ? fmt(attr.type) : 'rdfs:Literal';
            // Default to 'some' for attributes
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

        // Types from Edges
        const typeEdges = edges.filter(e => e.source === node.id && (e.label === 'rdf:type' || e.label === 'a'));
        if (typeEdges.length > 0) {
            lines.push(`${indent}Types: ${typeEdges.map(e => getNodeLabel(e.target)).join(', ')}`);
        }

        // Facts
        const factEdges = edges.filter(e => e.source === node.id && e.label !== 'rdf:type' && e.label !== 'a');
        if (factEdges.length > 0) {
            const facts = factEdges.map(e => {
                let prop = e.label as string;
                if (!prop.includes(':')) prop = fmt(prop);
                return `${prop} ${getNodeLabel(e.target)}`;
            });
            lines.push(`${indent}Facts: ${facts.join(', ')}`);
        }

        node.data.methods.forEach(m => {
            const n = m.name.toLowerCase();
            if (n === 'sameas') lines.push(`${indent}SameAs: ${convertExpression(m.returnType)}`);
            if (n === 'differentfrom') lines.push(`${indent}DifferentFrom: ${convertExpression(m.returnType)}`);
        });

        lines.push('');
    });

    return lines.join('\n');
};
