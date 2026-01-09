import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, ProjectData } from '../types';

export const parseRdfXml = (xmlContent: string): { nodes: Node<UMLNodeData>[], edges: Edge[], metadata: ProjectData } => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, "text/xml");
    
    // Check for parse errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
        throw new Error("Invalid XML: " + parserError.textContent);
    }

    const nodes: Node<UMLNodeData>[] = [];
    const edges: Edge[] = [];
    const metadata: ProjectData = { name: 'Imported RDF/XML', defaultPrefix: 'ex', baseIri: 'http://example.org/ontology#' };

    // Find RDF root
    const rdf = doc.getElementsByTagNameNS('http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'RDF')[0] 
             || doc.getElementsByTagName('rdf:RDF')[0]
             || doc.documentElement;
    
    if (!rdf) throw new Error("No RDF root element found");

    // Base IRI
    const xmlBase = rdf.getAttribute('xml:base');
    if (xmlBase) metadata.baseIri = xmlBase;

    // Helper to get text content
    const getText = (el: Element, tagName: string): string | null => {
        const children = el.getElementsByTagName(tagName);
        if (children.length > 0) return children[0].textContent;
        const parts = tagName.split(':');
        if (parts.length > 1) {
             const childrenNS = el.getElementsByTagNameNS('*', parts[1]);
             if (childrenNS.length > 0) return childrenNS[0].textContent;
        }
        return null;
    };

    // Helper to get ID/IRI
    const getIRI = (el: Element): string => {
        const about = el.getAttribute('rdf:about') || el.getAttribute('about');
        if (about) return about;
        const id = el.getAttribute('rdf:ID') || el.getAttribute('ID');
        if (id) return (metadata.baseIri || '#') + id;
        return `_:b${Math.random().toString(36).substr(2, 9)}`;
    };

    const getShortLabel = (iri: string): string => {
        if (iri.includes('#')) return iri.split('#')[1];
        if (iri.includes('/')) return iri.split('/').pop() || iri;
        return iri;
    };

    const nodeMap = new Map<string, string>(); // IRI -> NodeID
    let nodeCounter = 0;

    const createNode = (el: Element, type: ElementType): string => {
        const iri = getIRI(el);
        if (nodeMap.has(iri)) return nodeMap.get(iri)!;

        const id = `node-${++nodeCounter}`;
        const label = getText(el, 'rdfs:label') || getShortLabel(iri);
        const description = getText(el, 'rdfs:comment');
        
        nodes.push({
            id,
            type: 'umlNode',
            position: { x: Math.random() * 800, y: Math.random() * 600 },
            data: {
                label,
                type,
                iri,
                description: description || undefined,
                attributes: [],
                methods: [],
                annotations: []
            }
        });
        nodeMap.set(iri, id);
        return id;
    };

    // Process Ontology Header
    const ontologies = doc.getElementsByTagName('owl:Ontology');
    if (ontologies.length > 0) {
        const ont = ontologies[0];
        const iri = getIRI(ont);
        metadata.baseIri = iri;
        metadata.description = getText(ont, 'rdfs:comment') || undefined;
    }

    // Process Entities by iterating all children of RDF root
    const children = Array.from(rdf.children);
    
    children.forEach(el => {
        const tag = el.tagName;
        let type: ElementType | null = null;
        
        // Simple tag matching
        if (tag.includes('Class') && !tag.includes('Assertion')) type = ElementType.OWL_CLASS;
        else if (tag.includes('ObjectProperty')) type = ElementType.OWL_OBJECT_PROPERTY;
        else if (tag.includes('DatatypeProperty')) type = ElementType.OWL_DATA_PROPERTY;
        else if (tag.includes('NamedIndividual')) type = ElementType.OWL_NAMED_INDIVIDUAL;
        else if (tag.includes('Datatype')) type = ElementType.OWL_DATATYPE;
        else if (tag.includes('Description')) {
            // Check rdf:type child to determine specific type if available
            const types = el.getElementsByTagName('rdf:type');
            for(let i=0; i<types.length; i++) {
                const res = types[i].getAttribute('rdf:resource');
                if (res?.endsWith('Class')) type = ElementType.OWL_CLASS;
                else if (res?.endsWith('ObjectProperty')) type = ElementType.OWL_OBJECT_PROPERTY;
                else if (res?.endsWith('DatatypeProperty')) type = ElementType.OWL_DATA_PROPERTY;
                else if (res?.endsWith('NamedIndividual')) type = ElementType.OWL_NAMED_INDIVIDUAL;
            }
        }

        if (type) {
            createNode(el, type);
        }
    });

    // Process Relationships (Edges) & Attributes
    children.forEach(el => {
        const sourceIRI = getIRI(el);
        const sourceId = nodeMap.get(sourceIRI);
        if (!sourceId) return;
        
        const sourceNode = nodes.find(n => n.id === sourceId);

        const childNodes = Array.from(el.children);
        childNodes.forEach(child => {
            if (child.nodeType !== 1) return; // Element Node only

            const pred = child.tagName;
            const targetIRI = child.getAttribute('rdf:resource') || child.getAttribute('resource');
            const textContent = child.textContent;

            // 1. Edges (Object Properties / Relations)
            if (targetIRI) {
                const targetId = nodeMap.get(targetIRI);
                if (targetId) {
                    let label = pred;
                    if (pred.includes('subClassOf')) label = 'subClassOf';
                    else if (pred.includes('type')) label = 'rdf:type';
                    else if (pred.includes('disjointWith')) label = 'owl:disjointWith';
                    else label = pred.split(':').pop() || pred;

                    edges.push({
                        id: `e-${Math.random()}`,
                        source: sourceId,
                        target: targetId,
                        label,
                        type: 'smoothstep'
                    });
                }
            } 
            // 2. Attributes (Data Properties)
            else if (textContent && sourceNode) {
                 // Skip standard annotations processed earlier
                 if (!pred.includes('label') && !pred.includes('comment') && !pred.includes('type')) {
                     // Add as attribute
                     sourceNode.data.attributes.push({
                         id: `attr-${Math.random()}`,
                         name: pred.split(':').pop() || pred,
                         type: 'xsd:string',
                         visibility: '+'
                     });
                 }
            }
        });
    });
    
    // Grid Layout
    const cols = Math.ceil(Math.sqrt(nodes.length));
    nodes.forEach((n, idx) => {
        n.position = { x: (idx % cols) * 320 + 50, y: Math.floor(idx / cols) * 250 + 50 };
    });

    return { nodes, edges, metadata };
};