
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, ProjectData } from '../types';
import { generateTurtle } from './owlMapper';

export interface DocOptions {
    metadata: boolean;
    abstract: boolean;
    crossReference: boolean; 
    classes: boolean;
    objectProperties: boolean;
    dataProperties: boolean;
    individuals: boolean;
    axioms: boolean;
    annotations: boolean;
    serialization: boolean;
}

const texEscape = (text: string | undefined) => {
    if (!text) return '';
    return text
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/([&%$#_{}])/g, '\\$1')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}')
        .replace(/</g, '\\textless{}')
        .replace(/>/g, '\\textgreater{}');
};

export const generateWidocoMarkdown = (
    nodes: Node<UMLNodeData>[], 
    edges: Edge[], 
    metadata: ProjectData,
    options: DocOptions
): string => {
    const lines: string[] = [];
    const add = (s: string = '') => lines.push(s);

    const getNode = (id: string) => nodes.find(n => n.id === id);
    const getLabel = (id: string) => getNode(id)?.data.label || id;
    const getLink = (id: string) => `#${getLabel(id).toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    // Header
    if (options.metadata) {
        add(`---`);
        add(`title: ${metadata.name}`);
        add(`date: ${new Date().toISOString().split('T')[0]}`);
        add(`generator: Ontology Architect`);
        add(`---`);
        add(``);
        add(`# ${metadata.name}`);
        add(``);
        add(`**IRI:** \`${metadata.ontologyIri || metadata.baseIri}\``);
        add(``);
    }

    if (options.abstract && metadata.description) {
        add(`## Abstract`);
        add(`> ${metadata.description}`);
        add(``);
    }

    const renderEntity = (node: Node<UMLNodeData>, type: string) => {
        add(`### ${node.data.label}`);
        add(`*${type}*`);
        add(``);
        add(`**IRI:** \`${node.data.iri || ':' + node.data.label}\``);
        
        if (node.data.description) add(`> ${node.data.description}`);
        add(``);

        if (options.annotations && node.data.annotations?.length) {
            add(`**Annotations**`);
            node.data.annotations.forEach(a => add(`- \`${a.property}\`: ${a.value}`));
            add(``);
        }

        if (options.axioms) {
            // Edges
            const outgoing = edges.filter(e => e.source === node.id);
            if (outgoing.length > 0) {
                add(`**Relationships**`);
                outgoing.forEach(e => {
                    const labelStr = typeof e.label === 'string' ? e.label : String(e.label || '');
                    add(`- ${labelStr} [${getLabel(e.target)}](${getLink(e.target)})`);
                });
                add(``);
            }

            // Methods (Axioms)
            if (node.data.methods && node.data.methods.length > 0) {
                add(`**Description Logic Axioms**`); // RENAMED SECTION
                node.data.methods.forEach(m => {
                    add(`- ${m.name}: \`${m.returnType}\``);
                });
                add(``);
            }
        }
        add(`---`);
    };

    if (options.classes) {
        add(`## Classes`);
        nodes.filter(n => n.data.type === ElementType.OWL_CLASS).forEach(n => renderEntity(n, 'Class'));
    }
    if (options.objectProperties) {
        add(`## Object Properties`);
        nodes.filter(n => n.data.type === ElementType.OWL_OBJECT_PROPERTY).forEach(n => renderEntity(n, 'Object Property'));
    }
    if (options.dataProperties) {
        add(`## Data Properties`);
        nodes.filter(n => n.data.type === ElementType.OWL_DATA_PROPERTY).forEach(n => renderEntity(n, 'Data Property'));
    }
    if (options.individuals) {
        add(`## Individuals`);
        nodes.filter(n => n.data.type === ElementType.OWL_NAMED_INDIVIDUAL).forEach(n => renderEntity(n, 'Named Individual'));
    }

    if (options.serialization) {
        add(`## Serialization (Turtle)`);
        add(`\`\`\`turtle`);
        add(generateTurtle(nodes, edges, metadata));
        add(`\`\`\``);
    }

    return lines.join('\n');
};

export const generateLatex = (
    nodes: Node<UMLNodeData>[], 
    edges: Edge[], 
    metadata: ProjectData,
    options: DocOptions
): string => {
    const lines: string[] = [];
    const add = (s: string = '') => lines.push(s);

    const getLabel = (id: string) => nodes.find(n => n.id === id)?.data.label || id;

    // Preamble
    add(`\\documentclass{article}`);
    add(`\\usepackage[utf8]{inputenc}`);
    add(`\\usepackage[T1]{fontenc}`);
    add(`\\usepackage{hyperref}`);
    add(`\\usepackage{geometry}`);
    add(`\\geometry{a4paper, margin=1in}`);
    add(`\\title{${texEscape(metadata.name)}}`);
    add(`\\date{\\today}`);
    add(`\\author{Ontology Architect}`);
    add(`\\begin{document}`);
    add(`\\maketitle`);
    add(`\\tableofcontents`);
    add(`\\newpage`);

    if (options.metadata) {
        add(`\\section*{Metadata}`);
        add(`\\begin{description}`);
        add(`\\item[IRI] \\texttt{${texEscape(metadata.ontologyIri || metadata.baseIri)}}`);
        if (metadata.versionIri) add(`\\item[Version] \\texttt{${texEscape(metadata.versionIri)}}`);
        add(`\\end{description}`);
    }

    if (options.abstract && metadata.description) {
        add(`\\section*{Abstract}`);
        add(texEscape(metadata.description));
    }

    const renderEntityTex = (node: Node<UMLNodeData>, type: string) => {
        add(`\\subsection{${texEscape(node.data.label)}}`);
        add(`\\textit{${type}}`);
        add(``);
        add(`\\noindent \\textbf{IRI:} \\texttt{${texEscape(node.data.iri || ':' + node.data.label)}}`);
        add(``);
        
        if (node.data.description) {
            add(`\\begin{quote}`);
            add(texEscape(node.data.description));
            add(`\\end{quote}`);
        }

        if (options.annotations && node.data.annotations?.length) {
            add(`\\subsubsection*{Annotations}`);
            add(`\\begin{itemize}`);
            node.data.annotations.forEach(a => {
                add(`\\item \\textbf{${texEscape(a.property)}}: ${texEscape(a.value)}`);
            });
            add(`\\end{itemize}`);
        }

        if (options.axioms) {
            // Edges
            const outgoing = edges.filter(e => e.source === node.id);
            if (outgoing.length > 0) {
                add(`\\subsubsection*{Relationships}`);
                add(`\\begin{itemize}`);
                outgoing.forEach(e => {
                    const label = typeof e.label === 'string' ? e.label : String(e.label || '');
                    add(`\\item ${texEscape(label)} \\textbf{${texEscape(getLabel(e.target))}}`);
                });
                add(`\\end{itemize}`);
            }

            // Axioms
            if (node.data.methods && node.data.methods.length > 0) {
                add(`\\subsubsection*{Description Logic Axioms}`); // RENAMED SECTION
                add(`\\begin{itemize}`);
                node.data.methods.forEach(m => {
                    add(`\\item \\textbf{${texEscape(m.name)}}: \\texttt{${texEscape(m.returnType)}}`);
                });
                add(`\\end{itemize}`);
            }
        }
    };

    if (options.classes) {
        add(`\\section{Classes}`);
        nodes.filter(n => n.data.type === ElementType.OWL_CLASS).forEach(n => renderEntityTex(n, 'Class'));
    }
    if (options.objectProperties) {
        add(`\\section{Object Properties}`);
        nodes.filter(n => n.data.type === ElementType.OWL_OBJECT_PROPERTY).forEach(n => renderEntityTex(n, 'Object Property'));
    }
    if (options.dataProperties) {
        add(`\\section{Data Properties}`);
        nodes.filter(n => n.data.type === ElementType.OWL_DATA_PROPERTY).forEach(n => renderEntityTex(n, 'Data Property'));
    }
    if (options.individuals) {
        add(`\\section{Individuals}`);
        nodes.filter(n => n.data.type === ElementType.OWL_NAMED_INDIVIDUAL).forEach(n => renderEntityTex(n, 'Named Individual'));
    }

    if (options.serialization) {
        add(`\\section{Serialization}`);
        add(`\\begin{verbatim}`);
        add(generateTurtle(nodes, edges, metadata));
        add(`\\end{verbatim}`);
    }

    add(`\\end{document}`);
    return lines.join('\n');
};
