
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, ProjectData, SWRLRule } from '../types';
import { convertFunctionalToHuman } from './swrlService';

// --- 1. Lexical Analysis (Tokenizer) ---

type TokenType = 
    | 'WHITESPACE' | 'COMMENT' | 'STRING' | 'FULL_IRI' | 'ABBREV_IRI' 
    | 'DATATYPE_SEP' | 'NODE_ID' | 'OPEN_PAREN' | 'CLOSE_PAREN' 
    | 'EQUALS' | 'KEYWORD' | 'EOF';

interface Token {
    type: TokenType;
    value: string;
    pos: number;
}

const tokenize = (input: string): Token[] => {
    const tokens: Token[] = [];
    let pos = 0;

    // Regex patterns
    const patterns: { type: TokenType, regex: RegExp }[] = [
        { type: 'COMMENT', regex: /^#[^\n\r]*/ },
        { type: 'WHITESPACE', regex: /^[\s]+/ },
        { type: 'STRING', regex: /^"(?:[^"\\]|\\.)*"/ },
        { type: 'FULL_IRI', regex: /^<[^>]*>/ },
        { type: 'DATATYPE_SEP', regex: /^\^\^/ },
        { type: 'NODE_ID', regex: /^_:[a-zA-Z0-9._-]+/ },
        { type: 'OPEN_PAREN', regex: /^\(/ },
        { type: 'CLOSE_PAREN', regex: /^\)/ },
        { type: 'EQUALS', regex: /^=/ },
        // Expanded to capture QNames like rdf:type or :Person
        { type: 'ABBREV_IRI', regex: /^[a-zA-Z0-9._-]*:[a-zA-Z0-9._-]*/ }, 
        // Keywords / Identifiers
        { type: 'KEYWORD', regex: /^[a-zA-Z][a-zA-Z0-9._-]*/ }, 
    ];

    while (pos < input.length) {
        let matched = false;

        for (const { type, regex } of patterns) {
            const substr = input.slice(pos);
            const match = substr.match(regex);

            if (match) {
                const val = match[0];
                if (type !== 'WHITESPACE' && type !== 'COMMENT') {
                    tokens.push({ type, value: val, pos });
                }
                pos += val.length;
                matched = true;
                break;
            }
        }

        if (!matched) {
            // Safe skip for unknown chars to prevent infinite loop
            console.warn(`Unexpected character at ${pos}: ${input[pos]}`);
            pos++;
        }
    }

    tokens.push({ type: 'EOF', value: '', pos });
    return tokens;
};

// --- 2. Parser ---

const STANDARD_PREFIXES: Record<string, string> = {
    'rdf:': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'rdfs:': 'http://www.w3.org/2000/01/rdf-schema#',
    'xsd:': 'http://www.w3.org/2001/XMLSchema#',
    'owl:': 'http://www.w3.org/2002/07/owl#',
};

export const parseFunctionalSyntax = (input: string): { nodes: Node<UMLNodeData>[], edges: Edge[], metadata: ProjectData } => {
    const tokens = tokenize(input);
    let current = 0;

    const nodes: Node<UMLNodeData>[] = [];
    const edges: Edge[] = [];
    const metadata: ProjectData = { name: 'Imported Ontology', defaultPrefix: 'ex', baseIri: 'http://example.org/ontology#', rules: [] };
    
    const prefixes: Record<string, string> = { ...STANDARD_PREFIXES };
    const iriToNodeId: Record<string, string> = {};
    let nodeCounter = 0;

    // --- Helper Functions ---

    const peek = () => tokens[current];
    const consume = () => tokens[current++];
    
    const match = (val: string) => {
        if (peek().value === val) {
            current++;
            return true;
        }
        return false;
    };

    const expect = (val: string) => {
        if (!match(val)) throw new Error(`Expected '${val}' but got '${peek().value}' at pos ${peek().pos}`);
    };

    const parseIRI = (): string | null => {
        const t = peek();
        if (t.type === 'FULL_IRI' || t.type === 'ABBREV_IRI') {
            return consume().value;
        }
        // Sometimes "owl:Thing" is tokenized as KEYWORD if the colon logic is loose, 
        // but our ABBREV_IRI regex should catch it.
        if (t.type === 'KEYWORD' && t.value.includes(':')) {
             return consume().value;
        }
        return null;
    };

    // Recursively consume balanced parentheses
    const consumeBalanced = (): string => {
        let str = '';
        let balance = 0;
        
        // Initial token should be parsed outside or we start here
        if (peek().type !== 'OPEN_PAREN' && balance === 0) {
             // Just a single token
             return consume().value;
        }

        do {
            const t = consume();
            str += t.value + ' ';
            if (t.type === 'OPEN_PAREN') balance++;
            if (t.type === 'CLOSE_PAREN') balance--;
        } while (balance > 0 && peek().type !== 'EOF');
        
        return str.trim();
    };

    const resolveIRI = (raw: string): string => {
        if (raw.startsWith('<')) return raw.replace(/[<>]/g, '');
        const parts = raw.split(':');
        if (parts.length === 2) {
            const p = parts[0] + ':';
            if (prefixes[p]) return prefixes[p] + parts[1];
        }
        return raw;
    };

    const getOrCreateNodeId = (rawIRI: string, type: ElementType): string => {
        const fullIRI = resolveIRI(rawIRI);
        if (iriToNodeId[fullIRI]) return iriToNodeId[fullIRI];

        // Label extraction
        let label = rawIRI;
        if (label.startsWith('<')) label = label.split(/[#/]/).pop()?.replace('>', '') || 'Entity';
        else if (label.includes(':')) label = label.split(':')[1];

        const id = `node-${++nodeCounter}`;
        
        const newNode: Node<UMLNodeData> = {
            id,
            type: 'umlNode',
            position: { x: 0, y: 0 }, // Layout calculated later
            data: {
                label,
                type,
                iri: fullIRI,
                attributes: [],
                methods: []
            }
        };
        
        nodes.push(newNode);
        iriToNodeId[fullIRI] = id;
        return id;
    };

    // --- Grammar Parsing ---

    // 1. PrefixDeclaration := 'Prefix' '(' prefixName '=' fullIRI ')'
    while (peek().value === 'Prefix') {
        consume(); // Prefix
        expect('(');
        
        let pName = ':';
        if (peek().type === 'ABBREV_IRI' || peek().type === 'KEYWORD') {
            pName = consume().value; // e.g. "xsd:" or ":"
        }
        
        expect('=');
        const iriTok = consume(); // <http://...>
        expect(')');

        if (pName.endsWith(':')) {
            prefixes[pName] = iriTok.value.replace(/[<>]/g, '');
            if (pName === ':') metadata.baseIri = prefixes[pName];
            else metadata.defaultPrefix = pName.replace(':', '');
        }
    }

    // 2. Ontology := 'Ontology' '(' [ ontologyIRI [ versionIRI ] ] directlyImportsDocuments ontologyAnnotations axioms ')'
    if (match('Ontology')) {
        expect('(');
        
        // Optional IRIs
        const first = parseIRI();
        if (first) {
            metadata.ontologyIri = resolveIRI(first);
            const second = parseIRI();
            if (second) {
                metadata.versionIri = resolveIRI(second);
            }
        }

        // Parse Body: Imports, Annotations, Axioms
        while (peek().type !== 'CLOSE_PAREN' && peek().type !== 'EOF') {
            const token = peek();

            if (token.value === 'Import') {
                consume(); expect('(');
                parseIRI(); // Consume import IRI
                expect(')');
            } 
            else if (token.value === 'Annotation') {
                consume(); expect('(');
                consumeBalanced(); // Skip annotation content for now or parse it
            }
            else if (token.value === 'Declaration') {
                // Declaration( EntityType( IRI ) )
                consume(); expect('(');
                const entityType = consume().value;
                expect('(');
                const iri = parseIRI();
                expect(')'); // Close EntityType
                expect(')'); // Close Declaration

                if (iri) {
                    let type: ElementType | null = null;
                    if (entityType === 'Class') type = ElementType.OWL_CLASS;
                    else if (entityType === 'NamedIndividual') type = ElementType.OWL_NAMED_INDIVIDUAL;
                    else if (entityType === 'ObjectProperty') type = ElementType.OWL_OBJECT_PROPERTY;
                    else if (entityType === 'DataProperty') type = ElementType.OWL_DATA_PROPERTY;
                    else if (entityType === 'Datatype') type = ElementType.OWL_DATATYPE;

                    if (type) getOrCreateNodeId(iri, type);
                }
            }
            else if (token.value === 'SubClassOf') {
                // SubClassOf( sub super )
                consume(); expect('(');
                const sub = parseIRI();
                const sup = parseIRI();
                
                // If simple inheritance
                if (sub && sup) {
                    const sId = getOrCreateNodeId(sub, ElementType.OWL_CLASS);
                    const tId = getOrCreateNodeId(sup, ElementType.OWL_CLASS);
                    edges.push({ id: `e-${Math.random()}`, source: sId, target: tId, label: 'subClassOf', type: 'smoothstep' });
                } 
                // If complex (Expression)
                else if (sub) {
                    // sub is IRI, sup is expression
                    // We need to consume the expression
                    const expr = consumeBalanced(); // consumes super class expression
                    const sId = getOrCreateNodeId(sub, ElementType.OWL_CLASS);
                    const node = nodes.find(n => n.id === sId);
                    if (node) {
                        node.data.methods.push({ 
                            id: `m-${Math.random()}`, 
                            name: 'SubClassOf', 
                            returnType: expr.replace(/\)$/, ''), 
                            visibility: '+' 
                        });
                    }
                } else {
                    // Complex sub and super (General Class Axiom), skip for diagram
                    consumeBalanced();
                }
                
                if (peek().type === 'CLOSE_PAREN') consume();
            }
            else if (token.value === 'ClassAssertion') {
                // ClassAssertion( type individual )
                consume(); expect('(');
                const cls = parseIRI();
                const ind = parseIRI();
                expect(')');
                
                if (cls && ind) {
                    const cId = getOrCreateNodeId(cls, ElementType.OWL_CLASS);
                    const iId = getOrCreateNodeId(ind, ElementType.OWL_NAMED_INDIVIDUAL);
                    edges.push({ id: `e-${Math.random()}`, source: iId, target: cId, label: 'rdf:type', type: 'smoothstep' });
                }
            }
            else if (token.value === 'ObjectPropertyAssertion') {
                consume(); expect('(');
                const prop = parseIRI();
                const sub = parseIRI();
                const obj = parseIRI();
                expect(')');

                if (prop && sub && obj) {
                    const sId = getOrCreateNodeId(sub, ElementType.OWL_NAMED_INDIVIDUAL);
                    const oId = getOrCreateNodeId(obj, ElementType.OWL_NAMED_INDIVIDUAL);
                    
                    let label = prop;
                    if (label.includes(':')) label = label.split(':')[1];
                    else if (label.startsWith('<')) label = label.split(/[#/]/).pop()?.replace('>', '') || label;

                    edges.push({ id: `e-${Math.random()}`, source: sId, target: oId, label: label, type: 'smoothstep' });
                }
            }
            else if (token.value === 'DataPropertyAssertion') {
                consume(); expect('(');
                const prop = parseIRI();
                const sub = parseIRI();
                const lit = consume().value; // Literal value
                // Optional type
                if (peek().type === 'DATATYPE_SEP') {
                    consume(); // ^^
                    consume(); // type
                }
                expect(')');

                if (prop && sub) {
                    const sId = getOrCreateNodeId(sub, ElementType.OWL_NAMED_INDIVIDUAL);
                    const node = nodes.find(n => n.id === sId);
                    if (node) {
                        let label = prop;
                        if (label.includes(':')) label = label.split(':')[1];
                        node.data.attributes.push({
                            id: `attr-${Math.random()}`,
                            name: `${label} = ${lit}`,
                            type: 'Literal',
                            visibility: '+'
                        });
                    }
                }
            }
            else if (token.value === 'DLSafeRule') {
                consume(); 
                const fullRuleStr = consumeBalanced(); // Everything inside DLSafeRule(...)
                
                // Extract optional annotation
                let comment = '';
                if (fullRuleStr.includes('Annotation')) {
                    // Primitive extraction
                    const match = fullRuleStr.match(/"([^"]+)"/);
                    if (match) comment = match[1];
                }

                // Convert to human readable
                const humanExpr = convertFunctionalToHuman(fullRuleStr);
                
                metadata.rules = metadata.rules || [];
                metadata.rules.push({
                    id: `rule-${Math.random()}`,
                    name: `Rule-${metadata.rules.length + 1}`,
                    expression: humanExpr,
                    comment
                });
            }
            else {
                // Generic Axiom Consumer (consume until balanced)
                // e.g. DisjointClasses, EquivalentClasses, etc.
                const axiomKeyword = consume().value;
                if (peek().type === 'OPEN_PAREN') {
                    expect('(');
                    // We try to attach these to the first entity found in the axiom if possible
                    const possibleSubject = parseIRI();
                    const remainder = consumeBalanced(); // Consumes rest of args and closing paren
                    
                    // Note: consumeBalanced returns string without the final paren usually if called inside loop
                    // But here we are at top level axiom.
                    // Let's simplified: just attach as method if subject exists
                    if (possibleSubject) {
                        const sId = getOrCreateNodeId(possibleSubject, ElementType.OWL_CLASS); // Assume class context mostly
                        const node = nodes.find(n => n.id === sId);
                        if (node) {
                            node.data.methods.push({
                                id: `m-${Math.random()}`,
                                name: axiomKeyword,
                                returnType: remainder.replace(/\)$/, ''),
                                visibility: '+'
                            });
                        }
                    }
                }
            }
        }
        
        expect(')'); // Close Ontology
    }

    // Grid Layout for nodes
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const SPACING_X = 350;
    const SPACING_Y = 200;
    nodes.forEach((n, idx) => {
        n.position = { 
            x: (idx % cols) * SPACING_X + 100, 
            y: Math.floor(idx / cols) * SPACING_Y + 100 
        };
    });

    return { nodes, edges, metadata };
};
