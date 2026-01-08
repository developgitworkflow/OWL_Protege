import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, ProjectData } from '../types';

// --- 1. Lexical Analysis (Tokenizer) ---

type TokenType = 
    | 'WHITESPACE' | 'COMMENT' | 'STRING' | 'FULL_IRI' | 'LANGTAG' 
    | 'DATATYPE_SEP' | 'PNAME_LN' | 'PNAME_NS' | 'NODE_ID' 
    | 'FLOAT' | 'DECIMAL' | 'INTEGER' | 'DELIMITER' | 'KEYWORD' | 'EOF';

interface Token {
    type: TokenType;
    value: string;
    pos: number;
}

// Delimiters defined in OWL 2 Specification
const DELIMITERS = new Set(['(', ')', '<', '>', '=', '@', '^']);

// Known Keywords for strict lexical checking (Subset of OWL 2 Functional Syntax)
const KEYWORDS = new Set([
  'Ontology', 'Import', 'Declaration', 'Class', 'ObjectProperty', 'DataProperty', 
  'AnnotationProperty', 'NamedIndividual', 'Datatype', 'SubClassOf', 'EquivalentClasses', 
  'DisjointClasses', 'DisjointUnion', 'SubObjectPropertyOf', 'EquivalentObjectProperties', 
  'DisjointObjectProperties', 'InverseObjectProperties', 'ObjectPropertyDomain', 
  'ObjectPropertyRange', 'FunctionalObjectProperty', 'InverseFunctionalObjectProperty', 
  'ReflexiveObjectProperty', 'IrreflexiveObjectProperty', 'SymmetricObjectProperty', 
  'AsymmetricObjectProperty', 'TransitiveObjectProperty', 'SubDataPropertyOf', 
  'EquivalentDataProperties', 'DisjointDataProperties', 'DataPropertyDomain', 
  'DataPropertyRange', 'FunctionalDataProperty', 'DatatypeDefinition', 'HasKey', 
  'SameIndividual', 'DifferentIndividuals', 'ClassAssertion', 'ObjectPropertyAssertion', 
  'DataPropertyAssertion', 'NegativeObjectPropertyAssertion', 'NegativeDataPropertyAssertion', 
  'AnnotationAssertion', 'Prefix', 'Annotation', 'ObjectSomeValuesFrom', 'ObjectAllValuesFrom', 
  'ObjectUnionOf', 'ObjectIntersectionOf', 'ObjectComplementOf', 'ObjectOneOf', 'ObjectHasValue', 
  'ObjectHasSelf', 'ObjectMinCardinality', 'ObjectMaxCardinality', 'ObjectExactCardinality', 
  'DataSomeValuesFrom', 'DataAllValuesFrom', 'DataUnionOf', 'DataIntersectionOf', 
  'DataComplementOf', 'DataOneOf', 'DataHasValue', 'DataMinCardinality', 'DataMaxCardinality', 
  'DataExactCardinality', 'DataProperty'
]);

// Regex Definitions (Order matters for greedy matching!)
const TERMINALS: { type: TokenType, regex: RegExp }[] = [
    { type: 'COMMENT', regex: /^#[^\x0A\x0D]*/ },
    { type: 'STRING', regex: /^"(?:[^"\\]|\\.)*"/ },
    { type: 'FULL_IRI', regex: /^<[^>]*>/ },
    { type: 'LANGTAG', regex: /^@[a-zA-Z]+(?:-[a-zA-Z0-9]+)*/ },
    { type: 'DATATYPE_SEP', regex: /^\^\^/ },
    { type: 'NODE_ID', regex: /^_:[a-zA-Z0-9._-]+/ },
    { type: 'PNAME_LN', regex: /^(?:[a-zA-Z][a-zA-Z0-9_-]*)?:[a-zA-Z0-9._-]+/ },
    { type: 'PNAME_NS', regex: /^(?:[a-zA-Z][a-zA-Z0-9_-]*)?:/ },
    { type: 'FLOAT', regex: /^[+-]?(?:[0-9]+\.[0-9]*|\.[0-9]+|[0-9]+)[eE][+-]?[0-9]+/ },
    { type: 'DECIMAL', regex: /^[+-]?[0-9]*\.[0-9]+/ },
    { type: 'INTEGER', regex: /^[+-]?[0-9]+/ },
    { type: 'DELIMITER', regex: /^[()<>@=^]/ },
    { type: 'KEYWORD', regex: /^[a-zA-Z][a-zA-Z0-9_-]*/ }, // Candidate regex, validated against Set
    { type: 'WHITESPACE', regex: /^[\x20\x09\x0A\x0D]+/ }
];

const tokenize = (input: string): Token[] => {
    const tokens: Token[] = [];
    let pos = 0;

    while (pos < input.length) {
        let bestMatch: { type: TokenType, value: string } | null = null;

        // 1. Greedy Match
        for (const term of TERMINALS) {
            const match = input.substring(pos).match(term.regex);
            if (match) {
                const val = match[0];
                if (!bestMatch || val.length > bestMatch.value.length) {
                    bestMatch = { type: term.type, value: val };
                }
            }
        }

        if (!bestMatch) {
            throw new Error(`Syntax Error: Unexpected character '${input[pos]}' at position ${pos}`);
        }

        // 2. Validate Keywords
        if (bestMatch.type === 'KEYWORD') {
             if (!KEYWORDS.has(bestMatch.value)) {
                 // If strictly not a keyword, and didn't match PNAME/IRI, it's invalid.
                 throw new Error(`Syntax Error: Unknown keyword or identifier '${bestMatch.value}' at position ${pos}. Bare identifiers are not allowed unless they are keywords.`);
             }
        }

        // 3. Step 6: Boundary Check
        // If match is not Whitespace/Comment, check delimiters
        if (bestMatch.type !== 'WHITESPACE' && bestMatch.type !== 'COMMENT') {
            const lastChar = bestMatch.value[bestMatch.value.length - 1];
            const nextChar = (pos + bestMatch.value.length < input.length) ? input[pos + bestMatch.value.length] : '';

            const isLastDelim = DELIMITERS.has(lastChar);
            const isNextDelim = DELIMITERS.has(nextChar) || nextChar === ''; // EOF counts as boundary

            if (!isLastDelim && !isNextDelim) {
                // Must be followed by whitespace or comment
                const rest = input.substring(pos + bestMatch.value.length);
                const wsMatch = rest.match(/^[\x20\x09\x0A\x0D]+/);
                const commentMatch = rest.match(/^#[^\x0A\x0D]*/);
                
                if (!wsMatch && !commentMatch) {
                    throw new Error(`Syntax Error: Missing delimiter or whitespace after '${bestMatch.value}' at position ${pos}`);
                }
            }
        }

        // 4. Emit Token (Skip WS/Comment)
        if (bestMatch.type !== 'WHITESPACE' && bestMatch.type !== 'COMMENT') {
            tokens.push({ type: bestMatch.type, value: bestMatch.value, pos });
        }

        pos += bestMatch.value.length;
    }

    tokens.push({ type: 'EOF', value: '', pos });
    return tokens;
};

// --- 2. Parser ---

export const parseFunctionalSyntax = (input: string): { nodes: Node<UMLNodeData>[], edges: Edge[], metadata: ProjectData } => {
    let tokens: Token[];
    try {
        tokens = tokenize(input);
    } catch (e) {
        console.error(e);
        alert((e as Error).message);
        return { nodes: [], edges: [], metadata: { name: 'Error', defaultPrefix: 'ex' } };
    }

    let current = 0;
    const nodes: Node<UMLNodeData>[] = [];
    const edges: Edge[] = [];
    const metadata: ProjectData = { name: 'Imported Ontology', defaultPrefix: 'ex', baseIri: 'http://example.org/ontology#' };
    
    const iriToNodeId: Record<string, string> = {};
    const labelToNodeId: Record<string, string> = {};
    let nodeCounter = 0;

    const getOrCreateNodeId = (iriOrLabel: string, type: ElementType, isIRI = false): string => {
        const cleanKey = iriOrLabel.replace(/[<>]/g, '');
        if (iriToNodeId[cleanKey]) return iriToNodeId[cleanKey];
        if (labelToNodeId[cleanKey]) return labelToNodeId[cleanKey];

        const id = `node-${++nodeCounter}`;
        let label = cleanKey;
        if (isIRI && cleanKey.includes('#')) label = cleanKey.split('#')[1];
        else if (cleanKey.includes(':')) label = cleanKey.split(':')[1];

        const newNode: Node<UMLNodeData> = {
            id,
            type: 'umlNode',
            position: { x: Math.random() * 800, y: Math.random() * 600 },
            data: {
                label,
                type,
                iri: isIRI ? cleanKey : undefined,
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
    const expect = (val: string) => {
        if (!match(val)) throw new Error(`Expected '${val}' but got '${peek().value}' at pos ${peek().pos}`);
    };

    // Parse IRI: FullIRI or PNAME
    const parseIRI = (): string | null => {
        const t = peek();
        if (t.type === 'FULL_IRI' || t.type === 'PNAME_LN' || t.type === 'PNAME_NS') {
            return consume().value;
        }
        return null;
    };

    // Consumes a balanced expression for Axiom targets
    const consumeBalanced = (): string => {
        let str = '';
        let balance = 0;
        
        do {
            const t = consume();
            str += t.value + ' ';
            if (t.value === '(') balance++;
            if (t.value === ')') balance--;
        } while (balance > 0 && current < tokens.length);
        
        return str.trim();
    };

    // --- Parsing Logic ---

    while (current < tokens.length - 1) { // -1 for EOF
        const t = peek();

        if (t.type === 'KEYWORD') {
            if (t.value === 'Ontology') {
                consume();
                expect('(');
                const iri = parseIRI();
                if (iri) metadata.baseIri = iri.replace(/[<>]/g, '');
                // Skip version IRI if present
                if (peek().type === 'FULL_IRI') consume();
                
                // Parse Headers (Import, Annotations, etc. inside Ontology(...))
                // For simplicity, we loop until we hit Declarations or End
                // But in functional syntax, Ontology wraps everything. 
                // We just continue loop, expecting declarations inside.
                continue;
            }
            else if (t.value === 'Declaration') {
                consume();
                expect('(');
                const typeTok = consume();
                expect('(');
                const iri = parseIRI();
                expect(')');
                expect(')');

                if (iri) {
                    let type: ElementType | null = null;
                    if (typeTok.value === 'Class') type = ElementType.OWL_CLASS;
                    if (typeTok.value === 'NamedIndividual') type = ElementType.OWL_NAMED_INDIVIDUAL;
                    if (typeTok.value === 'ObjectProperty') type = ElementType.OWL_OBJECT_PROPERTY;
                    if (typeTok.value === 'DataProperty') type = ElementType.OWL_DATA_PROPERTY;
                    if (typeTok.value === 'Datatype') type = ElementType.OWL_DATATYPE;

                    if (type) getOrCreateNodeId(iri, type, true);
                }
            }
            else if (t.value === 'Prefix') {
                consume();
                expect('(');
                let pName = '';
                if (peek().type === 'PNAME_NS') {
                    pName = consume().value.replace(':', '');
                }
                expect('=');
                const iri = parseIRI();
                expect(')');
                
                if (iri) {
                    const cleanIRI = iri.replace(/[<>]/g, '');
                    if (pName === '') metadata.baseIri = cleanIRI;
                    else if (!['xsd','owl','rdf','rdfs'].includes(pName)) metadata.defaultPrefix = pName;
                }
            }
            else if (['SubClassOf', 'DisjointClasses', 'ObjectPropertyAssertion', 'ClassAssertion', 'DataPropertyAssertion'].includes(t.value)) {
                const axiom = consume().value;
                expect('(');
                
                if (axiom === 'SubClassOf') {
                    const sub = parseIRI();
                    if (sub) {
                        const supIRI = parseIRI();
                        if (supIRI) {
                            // Simple SubClassOf(A B)
                            const subId = getOrCreateNodeId(sub, ElementType.OWL_CLASS, true);
                            const supId = getOrCreateNodeId(supIRI, ElementType.OWL_CLASS, true);
                             edges.push({
                                id: `e-${Math.random()}`,
                                source: subId,
                                target: supId,
                                label: 'rdfs:subClassOf',
                                type: 'smoothstep'
                            });
                        } else {
                            // Complex: SubClassOf(A Expr)
                            // We already consumed sub. Now consume complex expr.
                            // Note: parseIRI() only consumes if it matches. If complex, it didn't match.
                            // So we consume expression.
                            // But parseIRI didn't consume anything if it returned null.
                            // We need to parse complex expression properly (balanced parens)
                            const expr = consumeBalanced(); // consumes starting from current
                            const subId = getOrCreateNodeId(sub, ElementType.OWL_CLASS, true);
                            const node = nodes.find(n => n.id === subId);
                            if(node) {
                                // Clean up trailing ')' from balanced consume if it took the closing axiom paren?
                                // consumeBalanced consumes until balance 0. 
                                // SubClassOf ( A ObjectUnionOf ( ... ) )
                                // balance starts at 0.
                                // Actually consumeBalanced assumes we passed the first '('. 
                                // Here we are inside SubClassOf( sub ... )
                                // If 'sup' was simple, we took it.
                                // If not simple, we need to grab tokens until the closing ')' of SubClassOf.
                                // This is hard with simple logic. 
                                // Simplified approach: Just attach to node as text
                                node.data.methods.push({
                                     id: `m-${Math.random()}`,
                                     name: 'SubClassOf',
                                     returnType: expr.replace(/\)$/, ''), // Hacky cleanup
                                     visibility: '+'
                                });
                            }
                        }
                    }
                    // Clean up closing ')'
                    if (peek().value === ')') consume();
                }
                else if (axiom === 'ClassAssertion') {
                    const cls = parseIRI();
                    const indiv = parseIRI();
                    if (peek().value === ')') consume();
                    
                    if (cls && indiv) {
                        const cId = getOrCreateNodeId(cls, ElementType.OWL_CLASS, true);
                        const iId = getOrCreateNodeId(indiv, ElementType.OWL_NAMED_INDIVIDUAL, true);
                        edges.push({ id: `e-${Math.random()}`, source: iId, target: cId, label: 'rdf:type', type: 'smoothstep' });
                    }
                }
                else if (axiom === 'ObjectPropertyAssertion') {
                    const prop = parseIRI();
                    const sub = parseIRI();
                    const obj = parseIRI();
                    if (peek().value === ')') consume();
                    
                    if (prop && sub && obj) {
                         const sId = getOrCreateNodeId(sub, ElementType.OWL_NAMED_INDIVIDUAL, true);
                         const oId = getOrCreateNodeId(obj, ElementType.OWL_NAMED_INDIVIDUAL, true);
                         edges.push({ id: `e-${Math.random()}`, source: sId, target: oId, label: prop.replace(/[<>]/g,''), type: 'smoothstep' });
                    }
                }
                else {
                    // Generic consume
                    consumeBalanced();
                }
            }
            else {
                // Unknown keyword / Axiom we don't handle specifically
                // Just consume it balanced to skip
                if (peek().value === '(') {
                    consumeBalanced();
                } else {
                    // Simple keyword?
                }
            }
        } 
        else if (t.type === 'DELIMITER' && t.value === ')') {
            // Closing Ontology?
            consume();
        }
        else {
            // unexpected
            consume();
        }
    }

    // Grid Layout
    const cols = Math.ceil(Math.sqrt(nodes.length));
    nodes.forEach((n, idx) => {
        n.position = { x: (idx % cols) * 320 + 50, y: Math.floor(idx / cols) * 250 + 50 };
    });

    return { nodes, edges, metadata };
};
