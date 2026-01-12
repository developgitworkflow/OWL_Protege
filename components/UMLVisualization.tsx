
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { ZoomIn, ZoomOut, Maximize, Download } from 'lucide-react';

interface UMLVisualizationProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
    searchTerm?: string;
    onNavigate?: (view: string, id: string) => void;
}

const UMLVisualization: React.FC<UMLVisualizationProps> = ({ nodes, edges, searchTerm = '', onNavigate }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svgCode, setSvgCode] = useState<string>('');
    const [scale, setScale] = useState(1);
    
    // Map safeId -> originalId for click handling
    const idMap = useRef<Map<string, string>>(new Map());

    // Initialize mermaid
    useEffect(() => {
        mermaid.initialize({ 
            startOnLoad: false,
            theme: 'dark',
            securityLevel: 'loose',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            classDiagram: {
                useMaxWidth: false,
            }
        });
    }, []);

    // Setup global callback for Mermaid clicks
    useEffect(() => {
        (window as any).onMermaidClick = (safeId: string) => {
            const originalId = idMap.current.get(safeId);
            if (originalId && onNavigate) {
                onNavigate('uml', originalId);
            }
        };
        return () => {
            (window as any).onMermaidClick = undefined;
        };
    }, [onNavigate]);

    const generateMermaidCode = () => {
        let code = 'classDiagram\n';
        
        // Reset Map
        idMap.current.clear();
        
        const renderedIds = new Set<string>();

        // Nodes
        nodes.forEach(node => {
            if (searchTerm && !node.data.label.toLowerCase().includes(searchTerm.toLowerCase())) {
                return;
            }

            // Safe ID for Mermaid class definition
            const safeId = node.id.replace(/[^a-zA-Z0-9]/g, '_');
            idMap.current.set(safeId, node.id);
            
            const label = node.data.label.replace(/"/g, "'");
            renderedIds.add(node.id);
            
            // Annotations for Stereotypes
            let stereotype = '';
            if (node.data.type === ElementType.OWL_NAMED_INDIVIDUAL) stereotype = '<<Individual>>';
            else if (node.data.stereotype) stereotype = `<<${node.data.stereotype}>>`;
            else if (node.data.type === ElementType.OWL_DATATYPE) stereotype = '<<Datatype>>';
            else if (node.data.type === ElementType.OWL_OBJECT_PROPERTY) stereotype = '<<ObjectProperty>>';
            else if (node.data.type === ElementType.OWL_DATA_PROPERTY) stereotype = '<<DataProperty>>';
            
            code += `    class ${safeId}["${label}"] {\n`;
            if (stereotype) code += `        ${stereotype}\n`;
            
            // Attributes
            node.data.attributes.forEach(attr => {
                const vis = attr.visibility === '+' ? '+' : attr.visibility === '-' ? '-' : '#';
                const type = attr.type ? attr.type.replace(/[^a-zA-Z0-9:\[\]_]/g, '') : '';
                const name = attr.name.replace(/[^a-zA-Z0-9_]/g, '_');
                code += `        ${vis}${type} ${name}\n`;
            });
            
            // Methods (Axioms)
            node.data.methods.forEach(method => {
                const vis = method.visibility === '+' ? '+' : method.visibility === '-' ? '-' : '#';
                let ret = method.returnType.length > 30 ? method.returnType.substring(0, 27) + '...' : method.returnType;
                ret = ret.replace(/"/g, "'").replace(/[(){}]/g, ''); 
                const name = method.name.replace(/[^a-zA-Z0-9_]/g, '_');
                code += `        ${vis}${name}(${ret})\n`;
            });
            
            code += `    }\n`;
            
            // Add interaction callback
            code += `    click ${safeId} call onMermaidClick("${safeId}") "Select ${label}"\n`;
            
            // Highlight search match
            if (searchTerm && node.data.label.toLowerCase().includes(searchTerm.toLowerCase())) {
                code += `    style ${safeId} fill:#854c08,stroke:#facc15,stroke-width:4px\n`;
            } else {
                if (node.data.type === ElementType.OWL_CLASS) {
                    code += `    style ${safeId} fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#fff\n`;
                } else if (node.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
                    code += `    style ${safeId} fill:#500724,stroke:#ec4899,stroke-width:2px,color:#fff\n`;
                } else if (node.data.type === ElementType.OWL_OBJECT_PROPERTY || node.data.type === ElementType.OWL_DATA_PROPERTY) {
                     code += `    style ${safeId} fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#fff\n`;
                }
            }
        });

        // Edges
        edges.forEach(edge => {
            if (!renderedIds.has(edge.source) || !renderedIds.has(edge.target)) return;

            const s = edge.source.replace(/[^a-zA-Z0-9]/g, '_');
            const t = edge.target.replace(/[^a-zA-Z0-9]/g, '_');
            const originalLabel = edge.label as string || '';
            
            let arrow = '-->';
            if (originalLabel === 'subClassOf' || originalLabel === 'rdfs:subClassOf') arrow = '--|>';
            else if (originalLabel === 'rdf:type' || originalLabel === 'a') arrow = '..>';
            else if (originalLabel === 'owl:disjointWith') arrow = '..'; 
            
            let displayLabel = originalLabel.replace(/"/g, '').replace(/\n/g, ' ').replace(/:/g, ' ').trim();
            const isStandard = ['subClassOf', 'rdfs subClassOf', 'rdf type', 'a', 'owl disjointWith'].includes(displayLabel);

            if (displayLabel && !isStandard) {
                code += `    ${s} ${arrow} ${t} : ${displayLabel}\n`;
            } else {
                code += `    ${s} ${arrow} ${t}\n`;
            }
        });

        return code;
    };

    const renderGraph = async () => {
        const element = containerRef.current;
        if (!element) return;

        const graphDefinition = generateMermaidCode();
        
        try {
            if (graphDefinition.trim() === 'classDiagram') {
                setSvgCode('<div class="flex items-center justify-center h-full text-slate-500 text-sm italic">No elements to display. Add classes to the diagram.</div>');
                return;
            }

            const { svg } = await mermaid.render(`mermaid-${Date.now()}`, graphDefinition);
            setSvgCode(svg);
        } catch (error) {
            console.error('Mermaid render error:', error);
            setSvgCode(`
                <div class="flex flex-col items-center justify-center h-full text-red-400 p-10 gap-4">
                    <div class="border border-red-900 bg-red-950/20 rounded p-4 max-w-lg">
                        <h4 class="font-bold mb-2">Rendering Error</h4>
                        <p class="text-xs font-mono whitespace-pre-wrap">${(error as Error).message}</p>
                    </div>
                    <div class="text-xs text-slate-600">Try adjusting node names or removing special characters from labels.</div>
                </div>
            `);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            renderGraph();
        }, 500);
        return () => clearTimeout(timer);
    }, [nodes, edges, searchTerm, onNavigate]);

    const handleDownload = () => {
        if (!containerRef.current) return;
        const svg = containerRef.current.querySelector('svg');
        if (svg) {
            const svgData = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'uml_diagram.svg';
            link.click();
        }
    };

    return (
        <div className="relative w-full h-full bg-slate-950 overflow-hidden flex flex-col">
            
            {/* Toolbar */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                <div className="bg-slate-900/80 backdrop-blur border border-slate-800 p-2 rounded-lg text-xs text-slate-300 shadow-xl flex flex-col gap-2">
                    <div className="flex gap-1">
                        <button onClick={() => setScale(s => Math.min(s + 0.1, 3))} className="p-1.5 hover:bg-slate-700 rounded transition-colors" title="Zoom In">
                            <ZoomIn size={16} />
                        </button>
                        <button onClick={() => setScale(s => Math.max(s - 0.1, 0.1))} className="p-1.5 hover:bg-slate-700 rounded transition-colors" title="Zoom Out">
                            <ZoomOut size={16} />
                        </button>
                        <button onClick={() => setScale(1)} className="p-1.5 hover:bg-slate-700 rounded transition-colors" title="Reset Zoom">
                            <Maximize size={16} />
                        </button>
                    </div>
                    <div className="h-px bg-slate-700"></div>
                    <button onClick={handleDownload} className="flex items-center gap-2 p-1.5 hover:bg-slate-700 rounded transition-colors text-blue-400">
                        <Download size={16} /> SVG
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 overflow-auto p-10 flex items-center justify-center cursor-move active:cursor-grabbing bg-slate-950">
                <div 
                    ref={containerRef}
                    className="transition-transform duration-200 ease-out origin-center"
                    style={{ transform: `scale(${scale})` }}
                    dangerouslySetInnerHTML={{ __html: svgCode }}
                />
            </div>
            
            {/* Info */}
            <div className="absolute bottom-4 left-6 text-[10px] text-slate-500 pointer-events-none">
                Generated via Mermaid.js • Auto-Layout • Click elements to edit properties
            </div>
        </div>
    );
};

export default UMLVisualization;
