
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';

interface Triple {
    s: string;
    p: string;
    o: string;
}

export interface SparqlResult {
    columns: string[];
    rows: Record<string, string>[];
    executionTime: number;
}

const STANDARD_PREFIXES: Record<string, string> = {
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
    'owl': 'http://www.w3.org/2002/07/owl#',
    'xsd': 'http://www.w3.org/2001/XMLSchema#'
};

// Helper: Normalize to full IRI if possible
const resolveIRI = (val: string, prefixes: Record<string, string>): string => {
    if (!val) return '';
    const clean = val.trim();
    if (clean.startsWith('<') && clean.endsWith('>')) return clean.slice(1, -1);
    
    // Handle "a" keyword for rdf:type
    if (clean === 'a') return prefixes['rdf'] + 'type';

    const parts = clean.split(':');
    if (parts.length === 2) {
        const p = parts[0];
        const local = parts[1];
        if (prefixes[p] !== undefined) return prefixes[p] + local;
    } else if (clean.indexOf(':') === -1) {
        // Empty prefix or base? Assumed logic handled elsewhere or treated as full IRI if no match
        // If strict, we might check for empty prefix mapping
        if (prefixes[':'] !== undefined) return prefixes[':'] + clean;
    }
    return clean;
};

// 1. Convert Graph to Triples (IRI-centric)
export const graphToTriples = (nodes: Node<UMLNodeData>[], edges: Edge[], defaultBaseIRI = 'http://example.org/ontology#'): { triples: Triple[], labelMap: Record<string, string> } => {
    const triples: Triple[] = [];
    const labelMap: Record<string, string> = {}; // IRI -> Label

    // Ensure base ends with # or /
    const base = defaultBaseIRI.endsWith('#') || defaultBaseIRI.endsWith('/') ? defaultBaseIRI : defaultBaseIRI + '#';

    // Helper to get Node IRI
    const getNodeIRI = (n: Node<UMLNodeData>) => {
        if (n.data.iri) return n.data.iri;
        // Generate a local IRI based on label if missing
        return `${base}${n.data.label.replace(/\s+/g, '_')}`;
    };

    // Helper to register label
    const register = (iri: string, label: string) => {
        labelMap[iri] = label;
        labelMap[label] = label; 
    };

    const nodeIdToIRI = new Map<string, string>();

    // Pass 1: Map IDs to IRIs
    nodes.forEach(n => {
        const iri = getNodeIRI(n);
        nodeIdToIRI.set(n.id, iri);
        register(iri, n.data.label);
        register(n.id, n.data.label); // Fallback for ID lookups
    });

    // Pass 2: Generate Node Triples
    nodes.forEach(n => {
        const s = nodeIdToIRI.get(n.id)!;
        const label = n.data.label;

        // Type Definition
        let typeIRI = '';
        switch(n.data.type) {
            case ElementType.OWL_CLASS: typeIRI = STANDARD_PREFIXES.owl + 'Class'; break;
            case ElementType.OWL_NAMED_INDIVIDUAL: typeIRI = STANDARD_PREFIXES.owl + 'NamedIndividual'; break;
            case ElementType.OWL_OBJECT_PROPERTY: typeIRI = STANDARD_PREFIXES.owl + 'ObjectProperty'; break;
            case ElementType.OWL_DATA_PROPERTY: typeIRI = STANDARD_PREFIXES.owl + 'DatatypeProperty'; break;
            case ElementType.OWL_DATATYPE: typeIRI = STANDARD_PREFIXES.rdfs + 'Datatype'; break;
        }

        if (typeIRI) triples.push({ s, p: STANDARD_PREFIXES.rdf + 'type', o: typeIRI });
        triples.push({ s, p: STANDARD_PREFIXES.rdfs + 'label', o: `"${label}"` });
        
        // Attributes
        if (n.data.attributes) {
            n.data.attributes.forEach(attr => {
                triples.push({ s, p: base + 'hasAttribute', o: `"${attr.name}"` });
            });
        }
    });

    // Pass 3: Edge Triples
    edges.forEach(e => {
        const s = nodeIdToIRI.get(e.source);
        const o = nodeIdToIRI.get(e.target);
        if (!s || !o) return;

        let pred = (e.label as string) || 'relatedTo';
        let pIRI = pred;

        // Resolve standard predicates
        if (pred === 'subClassOf' || pred === 'rdfs:subClassOf') pIRI = STANDARD_PREFIXES.rdfs + 'subClassOf';
        else if (pred === 'type' || pred === 'rdf:type' || pred === 'a') pIRI = STANDARD_PREFIXES.rdf + 'type';
        else if (pred.includes('disjoint')) pIRI = STANDARD_PREFIXES.owl + 'disjointWith';
        else {
            // Check if it's a known property IRI from nodes
            const propNode = nodes.find(n => n.data.label === pred && (n.data.type === ElementType.OWL_OBJECT_PROPERTY || n.data.type === ElementType.OWL_DATA_PROPERTY));
            if (propNode) {
                pIRI = getNodeIRI(propNode);
            } else if (!pred.startsWith('http')) {
                // Assume local property
                pIRI = `${base}${pred.replace(/\s+/g, '_')}`;
            }
        }

        triples.push({ s, p: pIRI, o });
    });

    return { triples, labelMap };
};

// 2. Query Engine
export const executeSparql = (query: string, nodes: Node<UMLNodeData>[], edges: Edge[], baseIri = 'http://example.org/ontology#'): SparqlResult => {
    const startTime = performance.now();
    const { triples, labelMap } = graphToTriples(nodes, edges, baseIri);

    // 1. Parse Prefixes
    const queryPrefixes: Record<string, string> = { ...STANDARD_PREFIXES };
    // Default base
    queryPrefixes[':'] = baseIri.endsWith('#') || baseIri.endsWith('/') ? baseIri : baseIri + '#';
    queryPrefixes['ex'] = baseIri.endsWith('#') || baseIri.endsWith('/') ? baseIri : baseIri + '#';

    // Remove comments
    const cleanQuery = query.replace(/#.*$/gm, '');

    const prefixRegex = /PREFIX\s+([a-zA-Z0-9_-]*:)\s*<([^>]+)>/gi;
    let prefixMatch;
    while ((prefixMatch = prefixRegex.exec(cleanQuery)) !== null) {
        const pName = prefixMatch[1].replace(':', '');
        queryPrefixes[pName] = prefixMatch[2];
        if (pName === '') queryPrefixes[':'] = prefixMatch[2]; // Handle empty prefix :
    }

    // 2. Parse Variables & Limit & Distinct
    const isDistinct = /SELECT\s+DISTINCT/i.test(cleanQuery);
    
    // Improved Regex for SELECT: Captures vars until { or WHERE or FROM or LIMIT
    const selectMatch = cleanQuery.match(/SELECT\s+(?:DISTINCT\s+)?(.+?)(?=\s*\{|\s+WHERE|\s+FROM|\s+LIMIT|$)/i);
    if (!selectMatch) throw new Error("Invalid SPARQL: Missing SELECT clause");
    
    const varsRaw = selectMatch[1].trim();
    const isStar = varsRaw === '*';
    const variables = isStar ? [] : varsRaw.split(/\s+/).map(v => v.replace('?', ''));

    const limitMatch = cleanQuery.match(/LIMIT\s+(\d+)/i);
    const limit = limitMatch ? parseInt(limitMatch[1], 10) : Infinity;

    // 3. Extract Pattern Block (implicit WHERE support)
    // Matches { ... } that is not part of the prefix or select line
    // We look for the first outer {
    const blockStart = cleanQuery.indexOf('{');
    const blockEnd = cleanQuery.lastIndexOf('}');
    
    if (blockStart === -1 || blockEnd === -1) throw new Error("Invalid SPARQL: Missing pattern block { ... }");
    
    const patternBlock = cleanQuery.substring(blockStart + 1, blockEnd);
    
    // Split patterns by dot, ignoring dots inside quotes
    // Simple split for this mock engine (robust splitting is complex)
    const patterns = patternBlock.split('.')
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => {
            // Split by whitespace
            const parts = p.match(/(?:[^\s"]+|"[^"]*")+/g);
            if (!parts || parts.length < 3) return null;
            const s = parts[0];
            const pred = parts[1];
            const o = parts.slice(2).join(' '); 
            return { s, p: pred, o };
        })
        .filter(p => p !== null) as { s: string, p: string, o: string }[];

    // 4. Execution (Join)
    let solutions: Record<string, string>[] = [{}];

    for (const pat of patterns) {
        const newSolutions: Record<string, string>[] = [];

        for (const sol of solutions) {
            const qS = pat.s.startsWith('?') ? (sol[pat.s.substring(1)] || null) : resolveIRI(pat.s, queryPrefixes);
            const qP = pat.p.startsWith('?') ? (sol[pat.p.substring(1)] || null) : resolveIRI(pat.p, queryPrefixes);
            const qO = pat.o.startsWith('?') ? (sol[pat.o.substring(1)] || null) : resolveIRI(pat.o, queryPrefixes);

            const matches = triples.filter(t => {
                if (qS && t.s !== qS) return false;
                if (qP && t.p !== qP) return false;
                if (qO) {
                    if (t.o === qO) return true;
                    // Handle potential literal quoting differences
                    const cleanTO = t.o.replace(/^"|"$/g, '');
                    const cleanQO = qO.replace(/^"|"$/g, '');
                    if (cleanTO !== cleanQO) return false;
                }
                return true;
            });

            for (const m of matches) {
                const newSol = { ...sol };
                if (pat.s.startsWith('?') && !newSol[pat.s.substring(1)]) newSol[pat.s.substring(1)] = m.s;
                if (pat.p.startsWith('?') && !newSol[pat.p.substring(1)]) newSol[pat.p.substring(1)] = m.p;
                if (pat.o.startsWith('?') && !newSol[pat.o.substring(1)]) newSol[pat.o.substring(1)] = m.o;
                newSolutions.push(newSol);
            }
        }
        solutions = newSolutions;
    }

    let finalVars = isStar ? Array.from(new Set(solutions.flatMap(Object.keys))) : variables;
    
    // Filter out rows that don't have all requested variables (INNER JOIN semantic)
    // Only if not star select (Star select usually implies all bound variables)
    if (!isStar) {
        solutions = solutions.filter(sol => finalVars.every(v => sol[v] !== undefined));
    }

    // Apply DISTINCT
    if (isDistinct) {
        const seen = new Set<string>();
        solutions = solutions.filter(sol => {
            // Create a key based on selected variables
            const key = finalVars.map(v => sol[v]).join('||');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    const limitedSolutions = solutions.slice(0, limit);
    
    const rows = limitedSolutions.map(sol => {
        const row: Record<string, string> = {};
        finalVars.forEach(v => row[v] = sol[v] || '');
        return row;
    });

    return {
        columns: finalVars,
        rows: rows,
        executionTime: performance.now() - startTime
    };
};

export const SPARQL_TEMPLATES = [
    {
        label: "All Classes",
        desc: "List every defined class in the ontology.",
        query: `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

SELECT ?class {
  ?class rdf:type owl:Class .
}`
    },
    {
        label: "Class Hierarchy",
        desc: "Show parent-child relationships.",
        query: `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?sub ?super WHERE {
  ?sub rdfs:subClassOf ?super .
}`
    },
    {
        label: "Individuals & Types",
        desc: "List individuals and their instantiated class.",
        query: `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

SELECT DISTINCT ?indiv ?type {
  ?indiv rdf:type ?type .
  ?type rdf:type owl:Class .
} LIMIT 50`
    }
];
