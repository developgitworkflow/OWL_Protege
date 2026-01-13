
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
    
    const parts = clean.split(':');
    if (parts.length === 2) {
        const p = parts[0];
        const local = parts[1];
        if (prefixes[p]) return prefixes[p] + local;
    }
    return clean;
};

// 1. Convert Graph to Triples (IRI-centric)
export const graphToTriples = (nodes: Node<UMLNodeData>[], edges: Edge[], defaultBaseIRI = 'http://example.org/ontology#'): { triples: Triple[], labelMap: Record<string, string> } => {
    const triples: Triple[] = [];
    const labelMap: Record<string, string> = {}; // IRI -> Label

    // Helper to get Node IRI
    const getNodeIRI = (n: Node<UMLNodeData>) => {
        if (n.data.iri) return n.data.iri;
        // Generate a local IRI based on label if missing
        return `${defaultBaseIRI}${n.data.label.replace(/\s+/g, '_')}`;
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

        triples.push({ s, p: STANDARD_PREFIXES.rdf + 'type', o: typeIRI });
        triples.push({ s, p: STANDARD_PREFIXES.rdfs + 'label', o: label });
        
        // Attributes
        if (n.data.attributes) {
            n.data.attributes.forEach(attr => {
                triples.push({ s, p: defaultBaseIRI + 'hasAttribute', o: attr.name });
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
                pIRI = `${defaultBaseIRI}${pred.replace(/\s+/g, '_')}`;
            }
        }

        triples.push({ s, p: pIRI, o });
    });

    return { triples, labelMap };
};

// 2. Query Engine
export const executeSparql = (query: string, nodes: Node<UMLNodeData>[], edges: Edge[]): SparqlResult => {
    const startTime = performance.now();
    const { triples, labelMap } = graphToTriples(nodes, edges);

    // 1. Parse Prefixes
    const queryPrefixes: Record<string, string> = { ...STANDARD_PREFIXES };
    // Default base for this session (mock)
    queryPrefixes[':'] = 'http://example.org/ontology#';
    queryPrefixes['ex'] = 'http://example.org/ontology#';

    const prefixLines = query.match(/PREFIX\s+([a-zA-Z0-9_-]*:)\s*<([^>]+)>/gi);
    if (prefixLines) {
        prefixLines.forEach(line => {
            const match = line.match(/PREFIX\s+([a-zA-Z0-9_-]*:)\s*<([^>]+)>/i);
            if (match) {
                queryPrefixes[match[1].replace(':', '')] = match[2];
            }
        });
    }

    // 2. Parse Variables & Limit
    const selectMatch = query.match(/SELECT\s+(.+?)\s+(WHERE|FROM|LIMIT)/i);
    if (!selectMatch) throw new Error("Invalid SPARQL: Missing SELECT clause");
    
    const varsRaw = selectMatch[1].trim();
    const isStar = varsRaw === '*';
    const variables = isStar ? [] : varsRaw.split(/\s+/).map(v => v.replace('?', ''));

    const limitMatch = query.match(/LIMIT\s+(\d+)/i);
    const limit = limitMatch ? parseInt(limitMatch[1], 10) : Infinity;

    // 3. Extract WHERE pattern
    const whereMatch = query.match(/WHERE\s*\{([\s\S]*)\}/i);
    if (!whereMatch) throw new Error("Invalid SPARQL: Missing WHERE clause");
    
    const patternBlock = whereMatch[1];
    
    const patterns = patternBlock.split('.')
        .map(p => p.trim())
        .filter(p => p.length > 0 && !p.startsWith('#'))
        .map(p => {
            const parts = p.split(/\s+/);
            if (parts.length < 3) return null;
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

    const finalVars = isStar ? Array.from(new Set(solutions.flatMap(Object.keys))) : variables;
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

SELECT ?class WHERE {
  ?class rdf:type owl:Class
}`
    },
    {
        label: "Class Hierarchy",
        desc: "Show parent-child relationships.",
        query: `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?sub ?super WHERE {
  ?sub rdfs:subClassOf ?super
}`
    },
    {
        label: "Individuals & Types",
        desc: "List individuals and their instantiated class.",
        query: `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

SELECT ?indiv ?type WHERE {
  ?indiv rdf:type ?type .
  ?type rdf:type owl:Class
} LIMIT 50`
    }
];
