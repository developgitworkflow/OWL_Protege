import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, ProjectData, SWRLRule } from '../types';
import { convertFunctionalToHuman } from './swrlService';

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
    { type: 'KEYWORD', regex: /^[a-zA-Z][a-zA-Z0-9_-]*/ }, // Matches any identifier
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
            // Skip unknown char if safe, or throw. For now throw to find issues.
            throw new Error(`Syntax Error: Unexpected character '${input[pos]}' at position ${pos}`);
        }

        // 2. Boundary Check (Simplified)
        if (bestMatch.type !== 'WHITESPACE' && bestMatch.type !== 'COMMENT') {
            const lastChar = bestMatch.value[bestMatch.value.length - 1];
            const nextChar = (pos + bestMatch.value.length < input.length) ? input[pos + bestMatch.value.length] : '';
            const isLastDelim = DELIMITERS.has(lastChar);
            const isNextDelim = DELIMITERS.has(nextChar) || nextChar === '' || /[\s#]/.test(nextChar);

            // Allow keywords/identifiers to be followed by anything that breaks a token
            // The regex matching ensures we consumed the full identifier.
        }

        // 3. Emit Token
        if (bestMatch.type !== 'WHITESPACE' && bestMatch.type !== 'COMMENT') {
            tokens.push({ type: bestMatch.type, value: bestMatch.value, pos });
        }

        pos += bestMatch.value.length;
    }

    tokens.push({ type: 'EOF', value: '', pos });
    return tokens;
};

// --- 2. Parser ---

// Standard Prefixes
const STANDARD_PREFIXES: Record<string, string> = {
    'rdf:': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'rdfs:': 'http://www.w3.org/2000/01/rdf-schema#',
    'xsd:': 'http://www.w3.org/2001/XMLSchema#',
    'owl:': 'http://www.w3.org/2002/07/owl#',
    'swrl:': 'http://www.w3.org/2003/11/swrl#',
    'swrlb:': 'http://www.w3.org/2003/11/swrlb#'
};

export const parseFunctionalSyntax = (input: string): { nodes: Node<UMLNodeData>[], edges: Edge[], metadata: ProjectData } => {
    let tokens: Token[];
    try {
        tokens = tokenize(input);
    } catch (e) {
        console.error("Tokenization failed", e);
        throw e;
    }

    let current = 0;
    const nodes: Node<UMLNodeData>[] = [];
    const edges: Edge[] = [];
    const metadata: ProjectData = { name: 'Imported Ontology', defaultPrefix: 'ex', baseIri: 'http://example.org/ontology#', rules: [] };
    
    const prefixes: Record<string, string> = { ...STANDARD_PREFIXES };
    const declaredPrefixes = new Set<string>();
    const iriToNodeId: Record<string, string> = {};
    let nodeCounter = 0;

    // Helper: Expand Abbreviated IRIs
    const resolveIRI = (tokenValue: string): string => {
        if (tokenValue.startsWith('<')) return tokenValue.replace(/[<>]/g, '');
        const colonIndex = tokenValue.indexOf(':');
        if (colonIndex !== -1) {
            const prefix = tokenValue.substring(0, colonIndex + 1);
            const local = tokenValue.substring(colonIndex + 1);
            if (prefixes[prefix]) return prefixes[prefix] + local;
            // Best effort fallback
            return tokenValue;
        }
        return tokenValue;
    };

    const getOrCreateNodeId = (iriOrLabel: string, type: ElementType, isIRI = false): string => {
        const fullIRI = isIRI ? resolveIRI(iriOrLabel) : undefined;
        const key = fullIRI || iriOrLabel;
        if (iriToNodeId[key]) return iriToNodeId[key];
        
        let label = iriOrLabel;
        if (isIRI) {
            if (label.startsWith('<')) label = label.replace(/[<>]/g, '');
            if (label.includes('#')) label = label.split('#')[1];
            else if (label.includes('/')) label = label.split('/').pop() || label;
            else if (label.includes(':')) label = label.split(':')[1];
        }

        const id = `node-${++nodeCounter}`;
        const newNode: Node<UMLNodeData> = {
            id,
            type: 'umlNode',
            position: { x: Math.random() * 800, y: Math.random() * 600 },
            data: { label, type, iri: fullIRI, attributes: [], methods: [] }
        };
        nodes.push(newNode);
        iriToNodeId[key] = id;
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

    const parseIRI = (): string | null => {
        const t = peek();
        if (t.type === 'FULL_IRI' || t.type === 'PNAME_LN' || t.type === 'PNAME_NS' || t.type === 'KEYWORD') {
            return consume().value;
        }
        return null;
    };

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

    // --- Parser Loop ---
    
    // 1. Prefix Declarations
    while (peek().value === 'Prefix') {
        consume(); 
        expect('(');
        let prefixName = ':'; 
        // Prefix name can be PNAME_NS (foo:) or just KEYWORD (foo) if parser is loose
        if (peek().type === 'PNAME_NS' || peek().type === 'KEYWORD') {
            prefixName = consume().value;
            // Normalize "foo" to "foo:" if needed, though usually it appears as PNAME_NS
        }
        expect('=');
        const iriTok = consume();
        expect(')');

        if (prefixName.endsWith(':')) {
            prefixes[prefixName] = iriTok.value.replace(/[<>]/g, '');
            declaredPrefixes.add(prefixName);
            if (prefixName === ':') metadata.baseIri = prefixes[prefixName];
            else metadata.defaultPrefix = prefixName.replace(':', '');
        }
    }

    // 2. Ontology Header
    if (match('Ontology')) {
        expect('(');
        if (peek().value !== ')' && peek().value !== 'Import' && peek().value !== 'Annotation') {
             const iri = parseIRI();
             if (iri) metadata.baseIri = resolveIRI(iri);
             if (peek().value !== ')' && peek().value !== 'Import') parseIRI(); // Version IRI
        }
    }

    // 3. Imports & Annotations
    while (peek().value === 'Import' || peek().value === 'Annotation') {
        consume();
        expect('(');
        consumeBalanced();
    }

    // 4. Axioms
    while (peek().value !== ')' && peek().type !== 'EOF') {
        const t = peek();
        
        if (t.value === 'Declaration') {
            consume();
            expect('(');
            const typeTok = consume();
            expect('(');
            const iri = parseIRI();
            consumeBalanced(); // Consume remaining parens
            
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
        else if (t.value === 'SubClassOf') {
            consume(); expect('(');
            const sub = parseIRI();
            const supIRI = parseIRI();
            if (sub && supIRI) {
                const subId = getOrCreateNodeId(sub, ElementType.OWL_CLASS, true);
                const supId = getOrCreateNodeId(supIRI, ElementType.OWL_CLASS, true);
                edges.push({ id: `e-${Math.random()}`, source: subId, target: supId, label: 'rdfs:subClassOf', type: 'smoothstep' });
            } else if (sub) {
                 const expr = consumeBalanced();
                 const subId = getOrCreateNodeId(sub, ElementType.OWL_CLASS, true);
                 const node = nodes.find(n => n.id === subId);
                 if(node) node.data.methods.push({ id: `m-${Math.random()}`, name: 'SubClassOf', returnType: expr.replace(/\)$/, ''), visibility: '+' });
            } else {
                consumeBalanced();
            }
            if (peek().value === ')') consume();
        }
        else if (t.value === 'ClassAssertion') {
             consume(); expect('(');
             const cls = parseIRI();
             const indiv = parseIRI();
             if (peek().value === ')') consume();
             if (cls && indiv) {
                 const cId = getOrCreateNodeId(cls, ElementType.OWL_CLASS, true);
                 const iId = getOrCreateNodeId(indiv, ElementType.OWL_NAMED_INDIVIDUAL, true);
                 edges.push({ id: `e-${Math.random()}`, source: iId, target: cId, label: 'rdf:type', type: 'smoothstep' });
             }
        }
        else if (t.value === 'ObjectPropertyAssertion') {
             consume(); expect('(');
             const prop = parseIRI();
             const sub = parseIRI();
             const obj = parseIRI();
             if (peek().value === ')') consume();
             if (prop && sub && obj) {
                 const sId = getOrCreateNodeId(sub, ElementType.OWL_NAMED_INDIVIDUAL, true);
                 const oId = getOrCreateNodeId(obj, ElementType.OWL_NAMED_INDIVIDUAL, true);
                 edges.push({ id: `e-${Math.random()}`, source: sId, target: oId, label: resolveIRI(prop), type: 'smoothstep' });
             }
        }
        else if (t.value === 'DLSafeRule') {
             // Parse SWRL Rule
             // Format: DLSafeRule( Annotation(...) Body(...) Head(...) )
             consume(); 
             const fullRuleStr = consumeBalanced(); // This gets everything inside DLSafeRule()
             
             // Extract optional annotation for comment
             let comment = '';
             const annMatch = fullRuleStr.match(/Annotation\s*\(\s*rdfs:comment\s+"([^"]+)"\s*\)/);
             if (annMatch) comment = annMatch[1];
             
             // Convert functional body/head to human readable
             const humanExpr = convertFunctionalToHuman(fullRuleStr);
             
             const newRule: SWRLRule = {
                 id: `rule-${Math.random()}`,
                 name: `Rule-${(metadata.rules?.length || 0) + 1}`,
                 expression: humanExpr,
                 comment: comment
             };
             
             if (!metadata.rules) metadata.rules = [];
             metadata.rules.push(newRule);
        }
        else {
            // Skip unknown axiom
            if (peek().value === '(') consumeBalanced();
            else {
                consume();
                if (peek().value === '(') consumeBalanced();
            }
        }
    }

    // Grid Layout
    const cols = Math.ceil(Math.sqrt(nodes.length));
    nodes.forEach((n, idx) => {
        n.position = { x: (idx % cols) * 320 + 50, y: Math.floor(idx / cols) * 250 + 50 };
    });

    return { nodes, edges, metadata };
};