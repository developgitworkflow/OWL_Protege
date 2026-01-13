
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, ProjectData } from '../types';

export const generateWidocoMarkdown = (nodes: Node<UMLNodeData>[], edges: Edge[], metadata: ProjectData): string => {
    const lines: string[] = [];
    const add = (s: string = '') => lines.push(s);

    // --- Helpers ---
    const getNode = (id: string) => nodes.find(n => n.id === id);
    const getLabel = (id: string) => {
        const n = getNode(id);
        return n ? n.data.label : id;
    };
    // Create anchors for links
    const getAnchor = (label: string) => label.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const getLink = (id: string) => {
        const n = getNode(id);
        return n ? `#${getAnchor(n.data.label)}` : '#';
    };
    
    const classes = nodes.filter(n => n.data.type === ElementType.OWL_CLASS).sort((a, b) => a.data.label.localeCompare(b.data.label));
    const objProps = nodes.filter(n => n.data.type === ElementType.OWL_OBJECT_PROPERTY).sort((a, b) => a.data.label.localeCompare(b.data.label));
    const dataProps = nodes.filter(n => n.data.type === ElementType.OWL_DATA_PROPERTY).sort((a, b) => a.data.label.localeCompare(b.data.label));
    const individuals = nodes.filter(n => n.data.type === ElementType.OWL_NAMED_INDIVIDUAL).sort((a, b) => a.data.label.localeCompare(b.data.label));

    // Header
    add(`---`);
    add(`title: ${metadata.name}`);
    add(`date: ${new Date().toISOString().split('T')[0]}`);
    add(`generator: Ontology Architect`);
    add(`---`);
    add(``);
    add(`# ${metadata.name}`);
    add(``);
    
    if (metadata.description) {
        add(`> ${metadata.description}`);
        add(``);
    }

    add(`## Metadata`);
    add(``);
    add(`| Key | Value |`);
    add(`| --- | --- |`);
    add(`| **IRI** | \`${metadata.ontologyIri || metadata.baseIri}\` |`);
    if (metadata.versionIri) add(`| **Version IRI** | \`${metadata.versionIri}\` |`);
    add(`| **Default Prefix** | \`${metadata.defaultPrefix || 'ex'}\` |`);
    add(``);

    // Classes
    if (classes.length > 0) {
        add(`## Classes`);
        add(``);
        classes.forEach(node => {
            const label = node.data.label;
            add(`### ${label}`);
            add(``);
            add(`**IRI:** \`${node.data.iri || `:${label}`}\``);
            add(``);
            
            const desc = node.data.description || node.data.annotations?.find(a => a.property.endsWith('comment'))?.value;
            if (desc) {
                add(`_${desc.replace(/"/g, '')}_`);
                add(``);
            }

            const parents = edges.filter(e => e.source === node.id && (e.label === 'subClassOf' || e.label === 'rdfs:subClassOf'));
            if (parents.length > 0) {
                add(`**Superclasses:**`);
                parents.forEach(e => add(`- [${getLabel(e.target)}](${getLink(e.target)})`));
                add(``);
            }
            
            if (node.data.methods && node.data.methods.length > 0) {
                add(`**Axioms:**`);
                node.data.methods.forEach(m => {
                    add(`- ${m.name}: \`${m.returnType}\``);
                });
                add(``);
            }
            add(`---`);
            add(``);
        });
    }

    return lines.join('\n');
};
