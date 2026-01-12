
import type { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, ProjectData } from '../types';

export const parseManchesterSyntax = (content: string): { nodes: Node<UMLNodeData>[], edges: Edge[], metadata: ProjectData } => {
    const nodes: Node<UMLNodeData>[] = [];
    const edges: Edge[] = [];
    const metadata: ProjectData = { name: 'Imported Ontology', defaultPrefix: 'ex', baseIri: 'http://example.org/ontology#' };
    
    const lines = content.split('\n');
    let currentFrame: 'Class' | 'ObjectProperty' | 'DataProperty' | 'Individual' | 'None' = 'None';
    let currentEntityId: string | null = null;
    const labelToId: Record<string, string> = {};
    let nodeCounter = 0;

    const getOrCreateNode = (label: string, type: ElementType): string => {
        const cleanLabel = label.trim();
        if (labelToId[cleanLabel]) return labelToId[cleanLabel];

        const id = `node-${++nodeCounter}`;
        nodes.push({
            id,
            type: 'umlNode',
            position: { x: Math.random() * 800, y: Math.random() * 600 },
            data: {
                label: cleanLabel,
                type: type,
                attributes: [],
                methods: [],
                annotations: []
            }
        });
        labelToId[cleanLabel] = id;
        return id;
    };

    const parseFrameLine = (line: string) => {
        const idx = line.indexOf(':');
        if (idx === -1) return;

        const keyword = line.substring(0, idx).trim();
        const rest = line.substring(idx + 1).trim();

        if (keyword === 'Class') {
            currentFrame = 'Class';
            currentEntityId = getOrCreateNode(rest, ElementType.OWL_CLASS);
        } else if (keyword === 'ObjectProperty') {
            currentFrame = 'ObjectProperty';
            currentEntityId = getOrCreateNode(rest, ElementType.OWL_OBJECT_PROPERTY);
        } else if (keyword === 'DataProperty') {
            currentFrame = 'DataProperty';
            currentEntityId = getOrCreateNode(rest, ElementType.OWL_DATA_PROPERTY);
        } else if (keyword === 'Individual' || keyword === 'NamedIndividual') {
            currentFrame = 'Individual';
            currentEntityId = getOrCreateNode(rest, ElementType.OWL_NAMED_INDIVIDUAL);
        } else if (keyword === 'Ontology') {
            metadata.ontologyIri = rest.replace(/[<>]/g, '');
        } else if (keyword === 'Prefix') {
            // Prefix handling optional here
        } else if (currentEntityId) {
            const node = nodes.find(n => n.id === currentEntityId);
            if (!node) return;

            if (keyword === 'SubClassOf') {
                const parents = rest.split(',').map(s => s.trim());
                parents.forEach(p => {
                    const isSimpleClass = p.match(/^[a-zA-Z0-9_:]+$/) && !['some', 'only', 'value', 'min', 'max', 'exactly'].some(k => p.includes(k));
                    
                    if (isSimpleClass) {
                        const targetId = getOrCreateNode(p, ElementType.OWL_CLASS);
                        edges.push({
                            id: `e-${Math.random()}`,
                            source: currentEntityId!,
                            target: targetId,
                            label: 'subClassOf',
                            type: 'smoothstep'
                        });
                    } else {
                        node.data.methods.push({
                            id: `m-${Math.random()}`,
                            name: 'SubClassOf',
                            returnType: p,
                            visibility: '+'
                        });
                    }
                });
            } 
            else if (keyword === 'DisjointWith') {
                 node.data.methods.push({ id: `m-${Math.random()}`, name: 'DisjointWith', returnType: rest, visibility: '+' });
            } 
            else if (keyword === 'EquivalentTo') {
                 node.data.methods.push({ id: `m-${Math.random()}`, name: 'EquivalentTo', returnType: rest, visibility: '+' });
            } 
            else if (keyword === 'Types' && currentFrame === 'Individual') {
                 const types = rest.split(',').map(s => s.trim());
                 types.forEach(t => {
                     const targetId = getOrCreateNode(t, ElementType.OWL_CLASS);
                     edges.push({ id: `e-${Math.random()}`, source: currentEntityId!, target: targetId, label: 'rdf:type', type: 'smoothstep' });
                 });
            } 
            else if (keyword === 'Facts' && currentFrame === 'Individual') {
                const factMatch = rest.match(/^([^ ]+) (.+)$/);
                if (factMatch) {
                    const prop = factMatch[1];
                    const obj = factMatch[2];
                    const targetId = getOrCreateNode(obj, ElementType.OWL_NAMED_INDIVIDUAL);
                    edges.push({ id: `e-${Math.random()}`, source: currentEntityId!, target: targetId, label: prop, type: 'smoothstep' });
                }
            } 
            else if (keyword === 'Domain') {
                 node.data.methods.push({ id: `m-${Math.random()}`, name: 'Domain', returnType: rest, visibility: '+' });
            } 
            else if (keyword === 'Range') {
                 node.data.methods.push({ id: `m-${Math.random()}`, name: 'Range', returnType: rest, visibility: '+' });
            } 
            else if (keyword === 'Characteristics') {
                 const chars = rest.split(',').map(s => s.trim());
                 chars.forEach(c => {
                     node.data.attributes.push({ id: `a-${Math.random()}`, name: c, type: '', visibility: '+' });
                 });
            }
            else if (keyword === 'Annotations') {
                const parts = rest.split(' ');
                if (parts.length >= 2) {
                    node.data.annotations?.push({
                        id: `ann-${Math.random()}`,
                        property: parts[0],
                        value: parts.slice(1).join(' ').replace(/"/g, '')
                    });
                }
            }
        }
    };

    lines.forEach(line => {
        if (!line.trim()) return;
        if (line.trim().startsWith('#')) return;
        parseFrameLine(line.trim());
    });

    const cols = Math.ceil(Math.sqrt(nodes.length)) || 1;
    nodes.forEach((n, idx) => {
        n.position = { x: (idx % cols) * 300 + 50, y: Math.floor(idx / cols) * 200 + 50 };
    });

    return { nodes, edges, metadata };
};
