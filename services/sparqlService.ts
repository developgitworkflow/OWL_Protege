
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

// 1. Convert Graph to Triples
export const graphToTriples = (nodes: Node<UMLNodeData>[], edges: Edge[]): { triples: Triple[], labelMap: Record<string, string> } => {
    const triples: Triple[] = [];
    const labelMap: Record<string, string> = {};

    // Helper to store labels for display
    const register = (id: string, label: string) => {
        labelMap[id] = label;
        // Also map the label to itself for literals/IRIs
        labelMap[label] = label;
    };

    // Nodes -> Type Triples
    nodes.forEach(n => {
        const id = n.id;
        const label = n.data.label;
        const iri = n.data.iri || `:${label}`;
        register(id, label);
        register(iri, label);

        let typeIRI = '';
        switch(n.data.type) {
            case ElementType.OWL_CLASS: typeIRI = 'owl:Class'; break;
            case ElementType.OWL_NAMED_INDIVIDUAL: typeIRI = 'owl:NamedIndividual'; break;
            case ElementType.OWL_OBJECT_PROPERTY: typeIRI = 'owl:ObjectProperty'; break;
            case ElementType.OWL_DATA_PROPERTY: typeIRI = 'owl:DatatypeProperty'; break;
            case ElementType.OWL_DATATYPE: typeIRI = 'rdfs:Datatype'; break;
        }

        // Entity Declaration
        triples.push({ s: id, p: 'rdf:type', o: typeIRI });
        triples.push({ s: id, p: 'rdfs:label', o: label });
        
        // Attributes
        if (n.data.attributes) {
            n.data.attributes.forEach(attr => {
                // If Class, it's a Property definition usually, but simple mapping:
                // Node hasAttribute AttrName
                triples.push({ s: id, p: 'ex:hasAttribute', o: attr.name });
            });
        }
    });

    // Edges -> Relation Triples
    edges.forEach(e => {
        let pred = (e.label as string) || 'ex:relatedTo';
        
        // Normalize standard predicates
        if (pred === 'subClassOf' || pred === 'rdfs:subClassOf') pred = 'rdfs:subClassOf';
        else if (pred === 'type' || pred === 'rdf:type' || pred === 'a') pred = 'rdf:type';
        else if (pred.includes('disjoint')) pred = 'owl:disjointWith';

        triples.push({ s: e.source, p: pred, o: e.target });
    });

    return { triples, labelMap };
};

// 2. Simple Query Engine (Basic Graph Patterns)
// Supports: SELECT ?v1 ?v2 WHERE { ?s ?p ?o . ... }
export const executeSparql = (query: string, nodes: Node<UMLNodeData>[], edges: Edge[]): SparqlResult => {
    const startTime = performance.now();
    const { triples, labelMap } = graphToTriples(nodes, edges);

    // Parse (Very simplified regex parser for client-side lightness)
    // 1. Extract Variables
    const selectMatch = query.match(/SELECT\s+(.+?)\s+WHERE/i);
    if (!selectMatch) throw new Error("Invalid SPARQL: Missing SELECT clause");
    
    const varsRaw = selectMatch[1].trim();
    const isStar = varsRaw === '*';
    const variables = isStar ? [] : varsRaw.split(/\s+/).map(v => v.replace('?', ''));

    // 2. Extract Pattern
    const whereMatch = query.match(/WHERE\s*\{([\s\S]*)\}/i);
    if (!whereMatch) throw new Error("Invalid SPARQL: Missing WHERE clause");
    
    const patternStr = whereMatch[1];
    // Split by dot, filter empty
    const patterns = patternStr.split('.').map(p => p.trim()).filter(p => p.length > 0).map(p => {
        // Remove trailing dot if split missed it
        const clean = p.replace(/\.$/, '').trim();
        const parts = clean.split(/\s+/);
        if (parts.length < 3) return null;
        return { s: parts[0], p: parts[1], o: parts.slice(2).join(' ') }; // Object might have spaces if literal
    }).filter(p => p !== null) as { s: string, p: string, o: string }[];

    // 3. Execution (Join)
    // Initial solution: [{}]
    let solutions: Record<string, string>[] = [{}];

    for (const pat of patterns) {
        const newSolutions: Record<string, string>[] = [];

        for (const sol of solutions) {
            // Resolve pattern with current solution bindings
            const qS = pat.s.startsWith('?') ? (sol[pat.s.substring(1)] || null) : pat.s;
            const qP = pat.p.startsWith('?') ? (sol[pat.p.substring(1)] || null) : pat.p;
            const qO = pat.o.startsWith('?') ? (sol[pat.o.substring(1)] || null) : pat.o;

            // Find matching triples
            const matches = triples.filter(t => {
                // Match S
                if (qS && t.s !== qS) {
                    // Try matching by Label/IRI if strict ID match fails (simulating IRI awareness)
                    const sLabel = labelMap[t.s];
                    if (sLabel !== qS && t.s !== qS) return false; 
                }
                
                // Match P
                // Loose matching for predicates
                if (qP) {
                    const match = t.p === qP || t.p.endsWith(`:${qP}`) || t.p.split(':')[1] === qP;
                    if (!match) return false;
                }

                // Match O
                if (qO && t.o !== qO) {
                     const oLabel = labelMap[t.o];
                     if (oLabel !== qO && t.o !== qO) return false;
                }

                return true;
            });

            // Expand solution
            for (const m of matches) {
                const newSol = { ...sol };
                
                if (pat.s.startsWith('?') && !newSol[pat.s.substring(1)]) {
                    newSol[pat.s.substring(1)] = labelMap[m.s] || m.s;
                }
                if (pat.p.startsWith('?') && !newSol[pat.p.substring(1)]) {
                    newSol[pat.p.substring(1)] = m.p;
                }
                if (pat.o.startsWith('?') && !newSol[pat.o.substring(1)]) {
                    newSol[pat.o.substring(1)] = labelMap[m.o] || m.o;
                }
                newSolutions.push(newSol);
            }
        }
        solutions = newSolutions;
    }

    // 4. Projection
    const finalVars = isStar ? Array.from(new Set(solutions.flatMap(Object.keys))) : variables;
    
    // Filter rows to only requested vars
    const rows = solutions.map(sol => {
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
        query: `SELECT ?class WHERE {
  ?class rdf:type owl:Class
}`
    },
    {
        label: "Class Hierarchy",
        desc: "Show parent-child relationships.",
        query: `SELECT ?sub ?super WHERE {
  ?sub rdfs:subClassOf ?super
}`
    },
    {
        label: "Individuals & Types",
        desc: "List individuals and their instantiated class.",
        query: `SELECT ?indiv ?type WHERE {
  ?indiv rdf:type ?type .
  ?type rdf:type owl:Class
}`
    },
    {
        label: "Object Properties",
        desc: "Show relationships between individuals.",
        query: `SELECT ?subject ?predicate ?object WHERE {
  ?subject ?predicate ?object .
  ?subject rdf:type owl:NamedIndividual .
  ?object rdf:type owl:NamedIndividual
}`
    },
    {
        label: "Data Properties",
        desc: "Show literal values assigned to individuals.",
        query: `SELECT ?subject ?predicate ?value WHERE {
  ?subject ?predicate ?value .
  ?subject rdf:type owl:NamedIndividual .
  ?predicate rdf:type owl:DatatypeProperty
}`
    },
    {
        label: "Disjoint Classes",
        desc: "Pairs of classes that cannot share instances.",
        query: `SELECT ?c1 ?c2 WHERE {
  ?c1 owl:disjointWith ?c2
}`
    }
];
