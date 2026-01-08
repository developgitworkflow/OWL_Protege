import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, ProjectData } from '../types';

// --- 1. Lexical Analysis (Tokenizer) ---

interface Token {
    type: 'DELIMITER' | 'STRING' | 'IDENTIFIER' | 'EOF';
    value: string;
    pos: number;
}

const DELIMITERS = new Set(['(', ')', '<', '>', '=', '@', '^']);
const WHITESPACE = new Set([' ', '\t', '\n', '\r']);

const tokenize = (input: string): Token[] => {
    const tokens: Token[] = [];
    let i = 0;

    while (i < input.length) {
        const char = input[i];

        // 1. Comments
        if (char === '#') {
            while (i < input.length && input[i] !== '\n' && input[i] !== '\r') {
                i++;
            }
            continue;
        }

        // 2. Whitespace
        if (WHITESPACE.has(char)) {
            i++;
            continue;
        }

        // 3. Delimiters
        if (DELIMITERS.has(char)) {
            tokens.push({ type: 'DELIMITER', value: char, pos: i });
            i++;
            continue;
        }

        // 4. String Literals
        if (char === '"') {
            let val = '"';
            i++;
            while (i < input.length) {
                if (input[i] === '"' && input[i - 1] !== '\\') {
                    val += '"';
                    i++;
                    break;
                }
                val += input[i];
                i++;
            }
            tokens.push({ type: 'STRING', value: val, pos: i });
            continue;
        }

        // 5. Identifiers / Keywords / PNAME / IRI parts
        // Read until a delimiter, whitespace, or comment start
        let val = '';
        while (i < input.length) {
            const c = input[i];
            if (DELIMITERS.has(c) || WHITESPACE.has(c) || c === '"' || c === '#') {
                break;
            }
            val += c;
            i++;
        }
        if (val.length > 0) {
            tokens.push({ type: 'IDENTIFIER', value: val, pos: i });
        }
    }
    tokens.push({ type: 'EOF', value: '', pos: i });
    return tokens;
};

// --- 2. Parser ---

export const parseFunctionalSyntax = (input: string): { nodes: Node<UMLNodeData>[], edges: Edge[], metadata: ProjectData } => {
    const tokens = tokenize(input);
    let current = 0;

    const nodes: Node<UMLNodeData>[] = [];
    const edges: Edge[] = [];
    const metadata: ProjectData = { name: 'Imported Ontology', defaultPrefix: 'ex', baseIri: 'http://example.org/' };
    
    // Maps for resolving IDs
    const iriToNodeId: Record<string, string> = {};
    const labelToNodeId: Record<string, string> = {};
    let nodeCounter = 0;

    // Helper: Create or Get Node ID
    const getOrCreateNodeId = (iriOrLabel: string, type: ElementType, isIRI = false): string => {
        const cleanKey = iriOrLabel;
        if (iriToNodeId[cleanKey]) return iriToNodeId[cleanKey];
        if (labelToNodeId[cleanKey]) return labelToNodeId[cleanKey];

        const id = `node-${++nodeCounter}`;
        
        // Extract readable label
        let label = cleanKey;
        if (isIRI && cleanKey.includes('#')) label = cleanKey.split('#')[1];
        else if (cleanKey.includes(':')) label = cleanKey.split(':')[1];
        else if (isIRI) {
             const parts = cleanKey.split('/');
             if(parts.length > 0) label = parts[parts.length-1];
        }

        const newNode: Node<UMLNodeData> = {
            id,
            type: 'umlNode',
            position: { x: Math.random() * 800, y: Math.random() * 600 }, // Initial layout needed
            data: {
                label: label.replace(/[<>]/g, ''),
                type,
                iri: isIRI ? cleanKey.replace(/[<>]/g, '') : undefined,
                attributes: [],
                methods: []
            }
        };
        nodes.push(newNode);
        
        if (isIRI) iriToNodeId[cleanKey] = id;
        else labelToNodeId[cleanKey] = id;
        
        return id;
    };

    const peek = () => tokens[current];
    const consume = () => tokens[current++];
    const match = (val: string) => {
        if (peek().value === val) {
            current++;
            return true;
        }
        return false;
    };

    // Helper to consume a full IRI (which might be split by tokens like < http... >)
    const parseIRI = (): string | null => {
        const t = peek();
        if (t.type === 'DELIMITER' && t.value === '<') {
            consume(); // <
            let iri = '';
            while(peek().type !== 'EOF' && peek().value !== '>') {
                iri += consume().value;
            }
            consume(); // >
            return `<${iri}>`;
        }
        if (t.type === 'IDENTIFIER') {
            return consume().value; // Prefixed name or simple name
        }
        return null;
    };

    // Helper to consume a balanced expression as a string (for complex axioms)
    const consumeExpressionString = (): string => {
        let str = '';
        let balance = 0;
        
        // First token
        str += peek().value;
        if (peek().value === '(') balance++;
        consume();

        while (current < tokens.length) {
            const t = peek();
            if (t.type === 'DELIMITER') {
                if (t.value === '(') balance++;
                if (t.value === ')') balance--;
            }
            
            // formatting
            if (t.type !== 'DELIMITER') str += ' ';
            str += t.value;
            
            consume();
            if (balance === 0) break;
        }
        return str;
    };

    // Main Parser Loop
    while (current < tokens.length) {
        const t = peek();
        
        if (t.type === 'EOF') break;

        if (t.type === 'IDENTIFIER') {
            const keyword = t.value;
            
            if (keyword === 'Ontology') {
                consume();
                match('(');
                const possibleIRI = parseIRI();
                if (possibleIRI) metadata.baseIri = possibleIRI.replace(/[<>]/g, '');
                // Skip the rest of Ontology header until we hit a keyword or closing )
                // This is a simplification; we scan declarations
            }
            else if (keyword === 'Declaration') {
                consume(); // Declaration
                match('('); // (
                const entityType = consume().value; // Class, NamedIndividual, ObjectProperty...
                match('('); // (
                const iri = parseIRI();
                match(')'); // )
                match(')'); // )

                if (iri) {
                    let type: ElementType | null = null;
                    if (entityType === 'Class') type = ElementType.OWL_CLASS;
                    if (entityType === 'NamedIndividual') type = ElementType.OWL_NAMED_INDIVIDUAL;
                    if (entityType === 'ObjectProperty') type = ElementType.OWL_OBJECT_PROPERTY;
                    if (entityType === 'DataProperty') type = ElementType.OWL_DATA_PROPERTY;
                    if (entityType === 'Datatype') type = ElementType.OWL_DATATYPE;

                    if (type) {
                        getOrCreateNodeId(iri, type, true);
                    }
                }
            }
            else if (['SubClassOf', 'DisjointClasses', 'EquivalentClasses', 'ObjectPropertyAssertion', 'ClassAssertion', 'SubObjectPropertyOf'].includes(keyword)) {
                consume(); // Keyword
                match('(');
                
                // --- SubClassOf( Sub Super ) ---
                if (keyword === 'SubClassOf') {
                    const subIRI = parseIRI();
                    // Check if Super is a simple named class
                    const tNext = peek();
                    if ((tNext.type === 'IDENTIFIER' || tNext.value === '<') && subIRI) {
                        // Likely simple IRI
                        const superIRI = parseIRI();
                        match(')');

                        // If both exist as nodes, create Edge
                        if (subIRI && superIRI && (iriToNodeId[subIRI] || labelToNodeId[subIRI]) && (iriToNodeId[superIRI] || labelToNodeId[superIRI])) {
                            const source = iriToNodeId[subIRI] || labelToNodeId[subIRI];
                            const target = iriToNodeId[superIRI] || labelToNodeId[superIRI];
                            edges.push({
                                id: `e-${source}-${target}-${Math.random()}`,
                                source,
                                target,
                                label: 'rdfs:subClassOf',
                                type: 'smoothstep'
                            });
                        } else if (subIRI && superIRI) {
                             // Complex or missing node: Add as method on Subject
                             const nodeId = iriToNodeId[subIRI] || getOrCreateNodeId(subIRI, ElementType.OWL_CLASS, true);
                             const node = nodes.find(n => n.id === nodeId);
                             if (node) {
                                 node.data.methods.push({
                                     id: `m-${Math.random()}`,
                                     name: 'SubClassOf',
                                     returnType: superIRI.replace(/[<>]/g, ''),
                                     visibility: '+'
                                 });
                             }
                        }
                    } else if (subIRI) {
                         // Complex expression
                         const expr = consumeExpressionString(); // Consume the rest
                         // Add as method
                         const nodeId = iriToNodeId[subIRI] || getOrCreateNodeId(subIRI, ElementType.OWL_CLASS, true);
                         const node = nodes.find(n => n.id === nodeId);
                         if (node) {
                             node.data.methods.push({
                                 id: `m-${Math.random()}`,
                                 name: 'SubClassOf',
                                 returnType: expr,
                                 visibility: '+'
                             });
                         }
                    }
                } 
                // --- ClassAssertion( Class Individual ) ---
                else if (keyword === 'ClassAssertion') {
                    const classIRI = parseIRI();
                    const indivIRI = parseIRI();
                    match(')');

                    if (classIRI && indivIRI) {
                        const classId = iriToNodeId[classIRI] || getOrCreateNodeId(classIRI, ElementType.OWL_CLASS, true);
                        const indivId = iriToNodeId[indivIRI] || getOrCreateNodeId(indivIRI, ElementType.OWL_NAMED_INDIVIDUAL, true);
                        
                        edges.push({
                            id: `e-${indivId}-${classId}-${Math.random()}`,
                            source: indivId,
                            target: classId,
                            label: 'rdf:type',
                            type: 'smoothstep'
                        });
                    }
                }
                // --- ObjectPropertyAssertion( Prop Subj Obj ) ---
                else if (keyword === 'ObjectPropertyAssertion') {
                     const propIRI = parseIRI();
                     const subjIRI = parseIRI();
                     const objIRI = parseIRI();
                     match(')');

                     if (propIRI && subjIRI && objIRI) {
                         const subjId = iriToNodeId[subjIRI] || getOrCreateNodeId(subjIRI, ElementType.OWL_NAMED_INDIVIDUAL, true);
                         const objId = iriToNodeId[objIRI] || getOrCreateNodeId(objIRI, ElementType.OWL_NAMED_INDIVIDUAL, true);
                         
                         edges.push({
                            id: `e-${subjId}-${objId}-${Math.random()}`,
                            source: subjId,
                            target: objId,
                            label: propIRI.replace(/[<>]/g, ''),
                            type: 'smoothstep'
                         });
                     }
                }
                else {
                    // Generic Axiom consumption
                    // Consumes ( ... )
                    // We need to attach this to a node if possible, or just ignore if global
                    // For simplicity in this demo, we skip complex global axioms or consume until )
                    let balance = 1; // We matched first (
                    while (balance > 0 && current < tokens.length) {
                        const t = consume();
                        if (t.value === '(') balance++;
                        if (t.value === ')') balance--;
                    }
                }
            } 
            else if (keyword === 'Prefix') {
                consume(); // Prefix
                match('('); // (
                
                // Prefix( name := <iri> )
                // Token stream: name, :, =, <, iri, >
                // OR Prefix( := <iri> ) for default
                
                let pName = '';
                if (peek().value !== ':') {
                   pName = consume().value;
                }
                match(':'); // : part of name or separator? 
                // Wait, tokenizer splits at delimiters. : is NOT delimiter.
                // So "ex:" is one token.
                // But prompt BNF says name = PNAME_NS.
                // Let's rely on standard: "ex" is PNAME_NS (without colon) usually or "ex:" is token.
                // My tokenizer treats "ex:" as identifier.
                // "Prefix(ex:=<...>)" -> "Prefix", "(", "ex:", "=", "<...>", ")"
                
                // Backtrack logic for safety if my tokenizer grouped differently
                if (pName === '') {
                    // Try consuming "name:"
                    const t = peek();
                    if (t.value.endsWith(':')) {
                        pName = consume().value.slice(0, -1);
                    } else if (t.value === '=') {
                        // Default prefix
                    }
                }

                match('=');
                const pIRI = parseIRI();
                match(')');
                
                if (pName === '' && pIRI) metadata.baseIri = pIRI.replace(/[<>]/g, '');
                if (pName !== '' && pName !== 'xsd' && pName !== 'owl' && pName !== 'rdf' && pName !== 'rdfs') {
                    metadata.defaultPrefix = pName;
                }
            }
            else {
                // Unknown keyword or structure, skip token
                consume();
            }
        } else {
            // Skip non-identifiers (delimiters outside expected structure)
            consume();
        }
    }

    // Post-processing layout: Simple grid to avoid all nodes at 0,0
    const cols = Math.ceil(Math.sqrt(nodes.length));
    nodes.forEach((n, idx) => {
        n.position = {
            x: (idx % cols) * 300 + 50,
            y: Math.floor(idx / cols) * 200 + 50
        };
    });

    return { nodes, edges, metadata };
};