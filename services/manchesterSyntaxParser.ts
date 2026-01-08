import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, ProjectData } from '../types';

// Standard Prefixes
const STANDARD_PREFIXES: Record<string, string> = {
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
    'xsd': 'http://www.w3.org/2001/XMLSchema#',
    'owl': 'http://www.w3.org/2002/07/owl#',
    'skos': 'http://www.w3.org/2004/02/skos/core#'
};

export const parseManchesterSyntax = (input: string): { nodes: Node<UMLNodeData>[], edges: Edge[], metadata: ProjectData } => {
    const nodes: Node<UMLNodeData>[] = [];
    const edges: Edge[] = [];
    const metadata: ProjectData = { name: 'Imported Ontology', defaultPrefix: 'ex', baseIri: 'http://example.org/ontology#' };
    
    const prefixes: Record<string, string> = { ...STANDARD_PREFIXES };
    const iriToNodeId: Record<string, string> = {};
    let nodeCounter = 0;

    // --- Helpers ---

    const resolveIRI = (str: string): string => {
        if (str.startsWith('<') && str.endsWith('>')) return str.slice(1, -1);
        const parts = str.split(':');
        if (parts.length === 2) {
            const prefix = parts[0];
            const local = parts[1];
            if (prefixes[prefix]) return prefixes[prefix] + local;
            // If prefix not found, return as is (best effort)
            return str;
        }
        return str; // No prefix, might be default or local
    };

    const getOrCreateNodeId = (labelOrIRI: string, type: ElementType): string => {
        // Simple deduplication key
        const key = labelOrIRI; 
        if (iriToNodeId[key]) return iriToNodeId[key];

        const id = `node-${++nodeCounter}`;
        let label = labelOrIRI;
        let iri = undefined;

        // Try to determine if input is IRI or Label
        if (labelOrIRI.includes(':') || labelOrIRI.includes('<')) {
            iri = resolveIRI(labelOrIRI);
            // Extract a display label
            if (labelOrIRI.startsWith('<')) {
                label = labelOrIRI.split('/').pop()?.replace('>', '') || 'Entity';
                if (label.includes('#')) label = label.split('#')[1].replace('>', '');
            } else {
                label = labelOrIRI.split(':')[1];
            }
        }

        const newNode: Node<UMLNodeData> = {
            id,
            type: 'umlNode',
            position: { x: Math.random() * 800, y: Math.random() * 600 },
            data: {
                label,
                type,
                iri,
                attributes: [],
                methods: []
            }
        };
        nodes.push(newNode);
        iriToNodeId[key] = id;
        return id;
    };

    const addEdge = (source: string, target: string, label: string) => {
        edges.push({
            id: `e-${Math.random().toString(36).substr(2, 9)}`,
            source,
            target,
            label,
            type: 'smoothstep',
            style: { stroke: '#94a3b8' }, 
            labelStyle: { fill: '#cbd5e1' }
        });
    };

    // --- Parsing Logic ---
    
    // Normalize input: remove comments, normalize spaces
    const cleanInput = input.replace(/#[^\n]*/g, '').trim();
    
    // Split by Frames. Manchester syntax doesn't have a strict end delimiter for frames other than the start of the next frame.
    // We'll regex split by Keywords that start a frame, ensuring they are at the start of a line or after a newline.
    
    // 1. Parse Prefixes & Ontology Header
    const prefixRegex = /Prefix:\s+([a-zA-Z0-9_-]*:)\s+<([^>]+)>/g;
    let match;
    while ((match = prefixRegex.exec(cleanInput)) !== null) {
        const pName = match[1].replace(':', '');
        const pUri = match[2];
        prefixes[pName] = pUri;
        if (pName !== 'owl' && pName !== 'rdf' && pName !== 'rdfs' && pName !== 'xsd') {
            metadata.defaultPrefix = pName;
        }
    }
    
    const ontologyRegex = /Ontology:\s*(<[^>]+>)?/g;
    const ontMatch = ontologyRegex.exec(cleanInput);
    if (ontMatch && ontMatch[1]) {
        metadata.baseIri = resolveIRI(ontMatch[1]);
    }

    // 2. Identify Frames
    // We will iterate line by line to maintain context
    const lines = cleanInput.split('\n');
    let currentEntityId: string | null = null;
    let currentEntityType: ElementType | null = null;
    let currentSection: string | null = null;

    const frameKeywords = ['Class:', 'ObjectProperty:', 'DataProperty:', 'AnnotationProperty:', 'Individual:', 'Datatype:'];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (line.startsWith('Prefix:') || line.startsWith('Ontology:') || line.startsWith('Namespace:')) continue;

        // Check if new Frame
        const frameKw = frameKeywords.find(kw => line.startsWith(kw));
        if (frameKw) {
            const entityName = line.substring(frameKw.length).trim();
            currentSection = null;
            
            if (frameKw === 'Class:') {
                currentEntityType = ElementType.OWL_CLASS;
                currentEntityId = getOrCreateNodeId(entityName, ElementType.OWL_CLASS);
            } else if (frameKw === 'ObjectProperty:') {
                currentEntityType = ElementType.OWL_OBJECT_PROPERTY;
                currentEntityId = getOrCreateNodeId(entityName, ElementType.OWL_OBJECT_PROPERTY);
            } else if (frameKw === 'DataProperty:') {
                currentEntityType = ElementType.OWL_DATA_PROPERTY;
                currentEntityId = getOrCreateNodeId(entityName, ElementType.OWL_DATA_PROPERTY);
            } else if (frameKw === 'Individual:') {
                currentEntityType = ElementType.OWL_NAMED_INDIVIDUAL;
                currentEntityId = getOrCreateNodeId(entityName, ElementType.OWL_NAMED_INDIVIDUAL);
            } else if (frameKw === 'Datatype:') {
                currentEntityType = ElementType.OWL_DATATYPE;
                currentEntityId = getOrCreateNodeId(entityName, ElementType.OWL_DATATYPE);
            } else {
                currentEntityId = null; // Ignore AnnotationProperty for diagram
            }
            continue;
        }

        // Check if Section Header (e.g. "SubClassOf:", "Types:", "Facts:")
        // Matches "Keyword:" at start of line
        const sectionMatch = line.match(/^([a-zA-Z]+):/);
        if (sectionMatch && currentEntityId) {
            currentSection = sectionMatch[1];
            // The rest of the line might contain content
            const content = line.substring(sectionMatch[0].length).trim();
            if (content) {
                processLineContent(currentEntityId, currentEntityType!, currentSection, content, nodes, addEdge, getOrCreateNodeId);
            }
            continue;
        }

        // Continuation of previous section
        if (currentEntityId && currentSection) {
            // Remove leading comma if present (multi-line lists)
            const cleanLine = line.replace(/^,\s*/, '');
            processLineContent(currentEntityId, currentEntityType!, currentSection, cleanLine, nodes, addEdge, getOrCreateNodeId);
        }
    }

    // Layout (Simple Grid)
    const cols = Math.ceil(Math.sqrt(nodes.length));
    nodes.forEach((n, idx) => {
        n.position = { x: (idx % cols) * 320 + 50, y: Math.floor(idx / cols) * 250 + 50 };
    });

    return { nodes, edges, metadata };
};

const processLineContent = (
    entityId: string, 
    entityType: ElementType, 
    section: string, 
    content: string, 
    nodes: Node<UMLNodeData>[], 
    addEdge: (s: string, t: string, l: string) => void,
    getOrCreateNodeId: (l: string, t: ElementType) => string
) => {
    // Handling comma-separated lists for some sections
    // Note: This is naive splitting. Complex axioms with commas (e.g. "max 1, min 2") might break.
    // For robust parsing, we'd need a token stream. This is a heuristic view builder.
    const parts = content.split(',').map(s => s.trim()).filter(s => s);

    const node = nodes.find(n => n.id === entityId);
    if (!node) return;

    parts.forEach(part => {
        // --- 1. Edges (Simple References) ---
        const isSimpleRef = part.match(/^[a-zA-Z0-9_:-]+$/) || (part.startsWith('<') && part.endsWith('>'));

        if (section === 'SubClassOf' && entityType === ElementType.OWL_CLASS && isSimpleRef) {
            const targetId = getOrCreateNodeId(part, ElementType.OWL_CLASS);
            addEdge(entityId, targetId, 'subClassOf');
            return;
        }

        if (section === 'Types' && entityType === ElementType.OWL_NAMED_INDIVIDUAL && isSimpleRef) {
            const targetId = getOrCreateNodeId(part, ElementType.OWL_CLASS);
            addEdge(entityId, targetId, 'rdf:type');
            return;
        }

        if (section === 'Facts' && entityType === ElementType.OWL_NAMED_INDIVIDUAL) {
            // Format: property individual
            const factMatch = part.match(/^([^\s]+)\s+([^\s]+)$/);
            if (factMatch) {
                const prop = factMatch[1];
                const target = factMatch[2];
                // Try to guess if target is individual
                const targetId = getOrCreateNodeId(target, ElementType.OWL_NAMED_INDIVIDUAL);
                addEdge(entityId, targetId, prop);
                return;
            }
        }

        // --- 2. Characteristics / Attributes ---
        if (section === 'Characteristics') {
            node.data.attributes.push({
                id: `attr-${Math.random()}`,
                name: part,
                type: '',
                visibility: '+'
            });
            return;
        }

        // --- 3. Axioms (Methods) ---
        // Store everything else as text axioms
        
        // Annotations handling
        if (section === 'Annotations') {
            const annotationMatch = part.match(/rdfs:comment\s+"([^"]*)"/);
            if (annotationMatch) {
                node.data.description = annotationMatch[1];
            }
            // Ignore other annotations for diagram cleanliness
            return;
        }

        // Standard Axioms
        let methodName = section;
        if (methodName === 'SubClassOf') methodName = 'SubClassOf';
        if (methodName === 'EquivalentTo') methodName = 'EquivalentTo';
        if (methodName === 'DisjointWith') methodName = 'DisjointWith';
        if (methodName === 'Domain') methodName = 'Domain';
        if (methodName === 'Range') methodName = 'Range';
        if (methodName === 'InverseOf') methodName = 'InverseOf';
        if (methodName === 'SubPropertyOf') methodName = 'SubPropertyOf';

        node.data.methods.push({
            id: `m-${Math.random()}`,
            name: methodName,
            returnType: part,
            visibility: '+'
        });
    });
};
