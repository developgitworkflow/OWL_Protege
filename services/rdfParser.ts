import { Parser } from 'n3';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, ProjectData, Annotation, Method } from '../types';

// Constants for RDF mapping
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const RDFS_COMMENT = 'http://www.w3.org/2000/01/rdf-schema#comment';
const RDFS_SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
const OWL_CLASS = 'http://www.w3.org/2002/07/owl#Class';
const OWL_OBJECT_PROPERTY = 'http://www.w3.org/2002/07/owl#ObjectProperty';
const OWL_DATA_PROPERTY = 'http://www.w3.org/2002/07/owl#DatatypeProperty';
const OWL_NAMED_INDIVIDUAL = 'http://www.w3.org/2002/07/owl#NamedIndividual';
const OWL_DATATYPE = 'http://www.w3.org/2000/01/rdf-schema#Datatype';
const OWL_ONTOLOGY = 'http://www.w3.org/2002/07/owl#Ontology';
const OWL_RESTRICTION = 'http://www.w3.org/2002/07/owl#Restriction';
const OWL_ON_PROPERTY = 'http://www.w3.org/2002/07/owl#onProperty';
const OWL_SOME_VALUES_FROM = 'http://www.w3.org/2002/07/owl#someValuesFrom';
const OWL_ALL_VALUES_FROM = 'http://www.w3.org/2002/07/owl#allValuesFrom';
const OWL_HAS_VALUE = 'http://www.w3.org/2002/07/owl#hasValue';

interface ParsedQuad {
    subject: string;
    predicate: string;
    object: string;
    graph: string;
}

export const parseTurtle = async (content: string): Promise<{ nodes: Node<UMLNodeData>[], edges: Edge[], metadata: ProjectData }> => {
    const parser = new Parser({ format: 'Turtle' });
    const quads: ParsedQuad[] = [];
    const prefixes: Record<string, string> = {};

    // 1. Parse into Quads
    await new Promise<void>((resolve, reject) => {
        parser.parse(content, (error, quad, parsedPrefixes) => {
            if (error) reject(error);
            if (quad) {
                quads.push({
                    subject: quad.subject.value,
                    predicate: quad.predicate.value,
                    object: quad.object.value,
                    graph: quad.graph.value
                });
            } else {
                if (parsedPrefixes) Object.assign(prefixes, parsedPrefixes);
                resolve();
            }
        });
    });

    const nodes: Node<UMLNodeData>[] = [];
    const edges: Edge[] = [];
    const metadata: ProjectData = { name: 'Imported RDF', defaultPrefix: 'ex', baseIri: 'http://example.org/ontology#' };
    
    // Reverse Prefix lookup
    const getShortIRI = (iri: string) => {
        if (!iri) return '';
        if (iri.startsWith('http://www.w3.org/2001/XMLSchema#')) return 'xsd:' + iri.split('#')[1];
        if (iri.startsWith('http://www.w3.org/2002/07/owl#')) return 'owl:' + iri.split('#')[1];
        if (iri.startsWith('http://www.w3.org/1999/02/22-rdf-syntax-ns#')) return 'rdf:' + iri.split('#')[1];
        if (iri.startsWith('http://www.w3.org/2000/01/rdf-schema#')) return 'rdfs:' + iri.split('#')[1];
        
        for (const [prefix, uri] of Object.entries(prefixes)) {
            if (iri.startsWith(uri)) {
                return `${prefix}:${iri.substring(uri.length)}`;
            }
        }
        // Fallback: use fragment or last path segment
        if (iri.includes('#')) return ':' + iri.split('#')[1];
        if (iri.includes('/')) return ':' + iri.split('/').pop();
        return `<${iri}>`;
    };

    // Helper: Identify element type
    const subjects = new Set(quads.map(q => q.subject));
    const entityTypes = new Map<string, ElementType>();
    const nodeDataMap = new Map<string, Partial<UMLNodeData>>();
    const restrictions = new Map<string, any>(); // Map for blank nodes representing restrictions

    // Pass 1: Identify Entities and Metadata
    quads.forEach(q => {
        if (q.predicate === RDF_TYPE) {
            if (q.object === OWL_CLASS) entityTypes.set(q.subject, ElementType.OWL_CLASS);
            else if (q.object === OWL_OBJECT_PROPERTY) entityTypes.set(q.subject, ElementType.OWL_OBJECT_PROPERTY);
            else if (q.object === OWL_DATA_PROPERTY) entityTypes.set(q.subject, ElementType.OWL_DATA_PROPERTY);
            else if (q.object === OWL_NAMED_INDIVIDUAL) entityTypes.set(q.subject, ElementType.OWL_NAMED_INDIVIDUAL);
            else if (q.object === OWL_DATATYPE) entityTypes.set(q.subject, ElementType.OWL_DATATYPE);
            else if (q.object === OWL_ONTOLOGY) {
                metadata.baseIri = q.subject;
                metadata.name = getShortIRI(q.subject).replace(':', '') || 'Ontology';
            }
            else if (q.object === OWL_RESTRICTION) {
                // Mark as restriction bnode
                restrictions.set(q.subject, {});
            }
        }
    });

    // Determine default prefix from found metadata
    for(const [p, u] of Object.entries(prefixes)) {
        if (u === metadata.baseIri || u === metadata.baseIri + '#') {
            metadata.defaultPrefix = p;
            break;
        }
    }

    // Pass 2: Collect Properties for Entities (Label, Comment, Annotations)
    // And collect Restriction details
    quads.forEach(q => {
        // Handle Restrictions (Blank Nodes)
        if (restrictions.has(q.subject)) {
            const r = restrictions.get(q.subject);
            if (q.predicate === OWL_ON_PROPERTY) r.onProperty = q.object;
            if (q.predicate === OWL_SOME_VALUES_FROM) { r.type = 'some'; r.target = q.object; }
            if (q.predicate === OWL_ALL_VALUES_FROM) { r.type = 'only'; r.target = q.object; }
            if (q.predicate === OWL_HAS_VALUE) { r.type = 'value'; r.target = q.object; }
            if (q.predicate.includes('Cardinality')) { r.type = getShortIRI(q.predicate).replace('owl:', ''); r.target = q.object; }
            return;
        }

        if (!entityTypes.has(q.subject)) return;

        if (!nodeDataMap.has(q.subject)) {
            nodeDataMap.set(q.subject, { 
                iri: q.subject, 
                label: getShortIRI(q.subject).split(':')[1] || 'Entity',
                annotations: [],
                attributes: [],
                methods: []
            });
        }
        const data = nodeDataMap.get(q.subject)!;

        if (q.predicate === RDFS_LABEL) {
            data.label = q.object.replace(/^"|"$/g, '');
        } else if (q.predicate === RDFS_COMMENT) {
            data.description = q.object.replace(/^"|"$/g, '');
        } else {
            // Treat other properties as Annotations
            // Skip type and basic structure
            if (q.predicate !== RDF_TYPE && !q.predicate.startsWith(OWL_ON_PROPERTY)) {
                // If the object is a literal, clean quotes
                let val = q.object;
                let lang = undefined;
                // Basic literal parsing
                if (val.startsWith('"')) {
                   // regex for lang tag
                   const match = val.match(/"(.*)"(@[a-zA-Z-]+)?/);
                   if (match) {
                       val = `"${match[1]}"`;
                       if (match[2]) lang = match[2].substring(1);
                   }
                } else {
                    val = getShortIRI(val);
                }

                data.annotations?.push({
                    id: `ann-${Math.random()}`,
                    property: getShortIRI(q.predicate),
                    value: val,
                    language: lang
                });
            }
        }
    });

    // Pass 3: Create Nodes
    let nodeCounter = 0;
    const iriToId: Record<string, string> = {};

    entityTypes.forEach((type, iri) => {
        // Skip blank nodes for top-level entities usually, unless NamedIndividual
        if (iri.startsWith('_:') && type !== ElementType.OWL_NAMED_INDIVIDUAL) return;

        const id = `node-${++nodeCounter}`;
        iriToId[iri] = id;
        
        const data = nodeDataMap.get(iri)!;
        
        nodes.push({
            id,
            type: 'umlNode',
            position: { x: Math.random() * 800, y: Math.random() * 600 },
            data: {
                label: data.label || 'Unknown',
                type: type,
                iri: iri,
                annotations: data.annotations || [],
                attributes: [],
                methods: [],
                description: data.description
            }
        });
    });

    // Pass 4: Edges & Axioms
    quads.forEach(q => {
        const sourceId = iriToId[q.subject];
        if (!sourceId) return;
        const sourceNode = nodes.find(n => n.id === sourceId);
        if (!sourceNode) return;

        // Relationships
        if (q.predicate === RDFS_SUBCLASS_OF) {
             // Case A: Named Class
             if (iriToId[q.object]) {
                 edges.push({
                     id: `e-${Math.random()}`,
                     source: sourceId,
                     target: iriToId[q.object],
                     label: 'subClassOf',
                     type: 'smoothstep'
                 });
             } 
             // Case B: Restriction (Blank Node)
             else if (restrictions.has(q.object)) {
                 const r = restrictions.get(q.object);
                 if (r.onProperty && r.target) {
                     const prop = getShortIRI(r.onProperty);
                     const target = getShortIRI(r.target);
                     const type = r.type || 'some';
                     
                     sourceNode.data.methods.push({
                         id: `m-${Math.random()}`,
                         name: 'SubClassOf',
                         returnType: `${prop} ${type} ${target}`,
                         visibility: '+'
                     });
                 }
             }
        }
        else if (q.predicate === RDF_TYPE && iriToId[q.object]) {
            // Instance Of
            edges.push({
                id: `e-${Math.random()}`,
                source: sourceId,
                target: iriToId[q.object],
                label: 'rdf:type',
                type: 'smoothstep'
            });
        }
        // Domain / Range
        else if (q.predicate === 'http://www.w3.org/2000/01/rdf-schema#domain' && iriToId[q.object]) {
            sourceNode.data.methods.push({ id: `m-${Math.random()}`, name: 'Domain', returnType: getShortIRI(q.object), visibility: '+' });
        }
        else if (q.predicate === 'http://www.w3.org/2000/01/rdf-schema#range' && iriToId[q.object]) {
            sourceNode.data.methods.push({ id: `m-${Math.random()}`, name: 'Range', returnType: getShortIRI(q.object), visibility: '+' });
        }
        // Object Property Assertions
        else {
            const targetId = iriToId[q.object];
            if (targetId && sourceNode.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
                 edges.push({
                     id: `e-${Math.random()}`,
                     source: sourceId,
                     target: targetId,
                     label: getShortIRI(q.predicate),
                     type: 'smoothstep'
                 });
            }
        }
    });

    // Layout (Simple Grid)
    const cols = Math.ceil(Math.sqrt(nodes.length));
    nodes.forEach((n, idx) => {
        n.position = { x: (idx % cols) * 320 + 50, y: Math.floor(idx / cols) * 250 + 50 };
    });

    return { nodes, edges, metadata };
};