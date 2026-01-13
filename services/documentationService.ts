
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, ProjectData } from '../types';
import { generateTurtle } from './owlMapper';

export interface DocOptions {
    // Front Matter
    metadata: boolean;
    abstract: boolean;
    
    // Indices
    crossReference: boolean; 
    
    // Entity Details
    classes: boolean;
    objectProperties: boolean;
    dataProperties: boolean;
    individuals: boolean;
    
    // Granularity
    axioms: boolean; // Logical axioms (SubClassOf, Disjoint, etc.)
    annotations: boolean; // rdfs:comment, labels
    
    // Appendix
    serialization: boolean; // Turtle snippet
}

export const generateWidocoMarkdown = (
    nodes: Node<UMLNodeData>[], 
    edges: Edge[], 
    metadata: ProjectData,
    options: DocOptions = { 
        metadata: true, 
        abstract: true,
        crossReference: true,
        classes: true, 
        objectProperties: true, 
        dataProperties: true, 
        individuals: true, 
        axioms: true, 
        annotations: true,
        serialization: false
    }
): string => {
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
    
    // Filter and Sort Entities
    const classes = nodes.filter(n => n.data.type === ElementType.OWL_CLASS).sort((a, b) => a.data.label.localeCompare(b.data.label));
    const objProps = nodes.filter(n => n.data.type === ElementType.OWL_OBJECT_PROPERTY).sort((a, b) => a.data.label.localeCompare(b.data.label));
    const dataProps = nodes.filter(n => n.data.type === ElementType.OWL_DATA_PROPERTY).sort((a, b) => a.data.label.localeCompare(b.data.label));
    const individuals = nodes.filter(n => n.data.type === ElementType.OWL_NAMED_INDIVIDUAL).sort((a, b) => a.data.label.localeCompare(b.data.label));

    // --- 1. Header & Metadata ---
    if (options.metadata) {
        add(`---`);
        add(`title: ${metadata.name}`);
        add(`date: ${new Date().toISOString().split('T')[0]}`);
        add(`generator: Ontology Architect`);
        add(`---`);
        add(``);
        add(`# ${metadata.name}`);
        add(``);
        
        add(`## Metadata`);
        add(``);
        add(`| Metadata | Value |`);
        add(`| --- | --- |`);
        add(`| **IRI** | \`${metadata.ontologyIri || metadata.baseIri}\` |`);
        if (metadata.versionIri) add(`| **Version IRI** | \`${metadata.versionIri}\` |`);
        if (metadata.defaultPrefix) add(`| **Prefix** | \`${metadata.defaultPrefix}\` |`);
        add(`| **Created** | ${new Date().toLocaleDateString()} |`);
        
        // Stats
        add(`| **Classes** | ${classes.length} |`);
        add(`| **Properties** | ${objProps.length + dataProps.length} |`);
        add(`| **Individuals** | ${individuals.length} |`);
        
        if (metadata.annotations) {
            metadata.annotations.forEach(ann => {
                if (ann.property !== 'rdfs:comment') {
                    add(`| **${ann.property}** | ${ann.value.replace(/"/g, '')} |`);
                }
            });
        }
        add(``);
    }

    // --- 2. Abstract / Description ---
    if (options.abstract) {
        if (metadata.description) {
            add(`## Abstract`);
            add(``);
            add(`> ${metadata.description}`);
            add(``);
        }
    }

    // --- 3. Cross Reference (Index) ---
    if (options.crossReference) {
        add(`## Cross Reference`);
        add(``);
        add(`This section provides an index of all entities defined in the ontology.`);
        add(``);
        
        if (classes.length > 0) {
            add(`### Classes`);
            add(classes.map(c => `[${c.data.label}](${getLink(c.id)})`).join(', '));
            add(``);
        }
        
        if (objProps.length > 0) {
            add(`### Object Properties`);
            add(objProps.map(p => `[${p.data.label}](${getLink(p.id)})`).join(', '));
            add(``);
        }

        if (dataProps.length > 0) {
            add(`### Data Properties`);
            add(dataProps.map(p => `[${p.data.label}](${getLink(p.id)})`).join(', '));
            add(``);
        }

        if (individuals.length > 0) {
            add(`### Named Individuals`);
            add(individuals.map(i => `[${i.data.label}](${getLink(i.id)})`).join(', '));
            add(``);
        }
        add(`---`);
        add(``);
    }

    // --- Helper to render a section for a node ---
    const renderEntitySection = (node: Node<UMLNodeData>, typeName: string) => {
        const label = node.data.label;
        add(`### ${label}`);
        add(``);
        add(`*${typeName}*`);
        add(``);
        add(`**IRI:** \`${node.data.iri || `:${label}`}\``);
        add(``);
        
        // Definition (rdfs:comment)
        const desc = node.data.description || node.data.annotations?.find(a => a.property.endsWith('comment'))?.value;
        if (desc) {
            add(`> ${desc.replace(/"/g, '')}`);
            add(``);
        }

        // Annotations (Other)
        if (options.annotations) {
            const otherAnns = node.data.annotations?.filter(a => !a.property.endsWith('comment')) || [];
            if (otherAnns.length > 0) {
                add(`**Annotations**`);
                add(``);
                add(`| Property | Value |`);
                add(`| --- | --- |`);
                otherAnns.forEach(a => {
                    add(`| \`${a.property}\` | ${a.value.replace(/"/g, '')} |`);
                });
                add(``);
            }
        }

        // Logic / Axioms
        if (options.axioms) {
            // Inheritance
            const parents = edges.filter(e => e.source === node.id && (e.label === 'subClassOf' || e.label === 'rdfs:subClassOf'));
            const supers = node.data.methods.filter(m => m.name === 'SubClassOf');
            
            if (parents.length > 0 || supers.length > 0) {
                add(`**Superclasses**`);
                parents.forEach(e => add(`- [${getLabel(e.target)}](${getLink(e.target)})`));
                supers.forEach(m => add(`- ${m.returnType}`)); // Anonymous superclasses
                add(``);
            }

            // Disjointness
            const disjointEdges = edges.filter(e => (e.source === node.id || e.target === node.id) && (e.label === 'owl:disjointWith'));
            const disjointAxioms = node.data.methods.filter(m => m.name === 'DisjointWith');
            
            if (disjointEdges.length > 0 || disjointAxioms.length > 0) {
                add(`**Disjoint With**`);
                disjointEdges.forEach(e => {
                    const targetId = e.source === node.id ? e.target : e.source;
                    add(`- [${getLabel(targetId)}](${getLink(targetId)})`);
                });
                disjointAxioms.forEach(m => add(`- ${m.returnType}`));
                add(``);
            }

            // Properties / Attributes (DataProps or Characteristics)
            if (node.data.attributes && node.data.attributes.length > 0) {
                const isClass = node.data.type === ElementType.OWL_CLASS;
                add(`**${isClass ? 'Data Properties' : 'Characteristics'}**`);
                node.data.attributes.forEach(a => {
                    const typeStr = a.type ? ` [${a.type}]` : '';
                    add(`- ${a.name}${typeStr}`);
                });
                add(``);
            }

            // Other Axioms (Equivalence, etc.)
            const otherAxioms = node.data.methods.filter(m => 
                m.name !== 'SubClassOf' && m.name !== 'DisjointWith'
            );
            if (otherAxioms.length > 0) {
                add(`**Other Axioms**`);
                otherAxioms.forEach(m => {
                    add(`- **${m.name}**: \`${m.returnType}\``);
                });
                add(``);
            }
        }
        
        add(`---`);
        add(``);
    };

    // --- Entity Sections ---
    if (options.classes && classes.length > 0) {
        add(`## Classes`);
        add(``);
        classes.forEach(node => renderEntitySection(node, 'Class'));
    }

    if (options.objectProperties && objProps.length > 0) {
        add(`## Object Properties`);
        add(``);
        objProps.forEach(node => renderEntitySection(node, 'Object Property'));
    }

    if (options.dataProperties && dataProps.length > 0) {
        add(`## Data Properties`);
        add(``);
        dataProps.forEach(node => renderEntitySection(node, 'Data Property'));
    }

    if (options.individuals && individuals.length > 0) {
        add(`## Named Individuals`);
        add(``);
        individuals.forEach(node => renderEntitySection(node, 'Named Individual'));
    }

    // --- Serialization ---
    if (options.serialization) {
        add(`## Serialization`);
        add(``);
        add(`\`\`\`turtle`);
        add(generateTurtle(nodes, edges, metadata));
        add(`\`\`\``);
        add(``);
    }

    return lines.join('\n');
};
