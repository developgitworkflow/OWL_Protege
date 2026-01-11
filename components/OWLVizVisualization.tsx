
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { ZoomIn, ZoomOut, Maximize, Download, RefreshCw, Map as MapIcon, BoxSelect } from 'lucide-react';

interface OWLVizVisualizationProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
    searchTerm?: string;
}

interface SimNode extends d3.SimulationNodeDatum {
    id: string;
    label: string;
    type: ElementType;
    iri?: string;
    color: string;
    width?: number;
    height?: number;
    radius?: number;
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
    source: string | SimNode;
    target: string | SimNode;
    label: string;
    type: 'subclass' | 'type' | 'relation';
    isInferred: boolean;
}

const THEME = {
    classFill: '#1e293b', // slate-800
    classStroke: '#6366f1', // indigo-500
    indivFill: '#831843', // pink-900
    indivStroke: '#ec4899', // pink-500
    text: '#f8fafc',
    line: '#94a3b8',
    lineInferred: '#fbbf24',
    bg: '#0f172a'
};

const OWLVizVisualization: React.FC<OWLVizVisualizationProps> = ({ nodes, edges, searchTerm = '' }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [tooltip, setTooltip] = useState<{x: number, y: number, content: React.ReactNode} | null>(null);
    
    // Simulation refs to maintain state across renders without re-simulating unnecessarily
    const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
    const simNodes = useRef<SimNode[]>([]);
    const simLinks = useRef<SimLink[]>([]);

    useEffect(() => {
        if (!svgRef.current || !containerRef.current) return;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        // --- Data Preparation ---
        const relevantNodes = nodes.filter(n => 
            n.data.type === ElementType.OWL_CLASS || 
            n.data.type === ElementType.OWL_NAMED_INDIVIDUAL
        );
        const nodeSet = new Set(relevantNodes.map(n => n.id));

        simNodes.current = relevantNodes.map(n => {
            const isClass = n.data.type === ElementType.OWL_CLASS;
            // Approximate text width
            const textLen = n.data.label.length * 8 + 20;
            return {
                id: n.id,
                label: n.data.label,
                type: n.data.type,
                iri: n.data.iri,
                color: isClass ? THEME.classStroke : THEME.indivStroke,
                width: Math.max(80, textLen),
                height: 30,
                radius: isClass ? 0 : 20, // 0 implies rect
                x: n.position.x + width/2 - 200, // Offset initial pos
                y: n.position.y + height/2 - 200
            };
        });

        simLinks.current = [];
        
        // 1. Edges
        edges.forEach(e => {
            if (!nodeSet.has(e.source) || !nodeSet.has(e.target)) return;
            
            let type: SimLink['type'] = 'relation';
            let label = e.label as string || '';
            const lowerLabel = label.toLowerCase();

            if (['subclassof', 'rdfs:subclassof'].includes(lowerLabel)) type = 'subclass';
            else if (['rdf:type', 'a'].includes(lowerLabel)) type = 'type';
            
            // Clean label
            label = label.replace('owl:', '').replace('rdf:', '').replace('rdfs:', '');

            simLinks.current.push({
                source: e.source,
                target: e.target,
                label,
                type,
                isInferred: e.data?.isInferred || false
            });
        });

        // 2. Internal Axioms (SubClassOf only for map structure)
        relevantNodes.forEach(n => {
            n.data.methods.forEach(m => {
                if (m.name.toLowerCase() === 'subclassof') {
                    const targetName = m.returnType;
                    const targetNode = relevantNodes.find(rn => rn.data.label === targetName);
                    if (targetNode) {
                        // Check duplicate
                        const exists = simLinks.current.some(l => 
                            (l.source === n.id || (l.source as SimNode).id === n.id) && 
                            (l.target === targetNode.id || (l.target as SimNode).id === targetNode.id) &&
                            l.type === 'subclass'
                        );
                        if (!exists) {
                            simLinks.current.push({
                                source: n.id,
                                target: targetNode.id,
                                label: 'subClassOf',
                                type: 'subclass',
                                isInferred: false
                            });
                        }
                    }
                }
            });
        });

        // --- D3 Render ---
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const defs = svg.append("defs");
        
        // Markers
        const markers = [
            { id: 'arrow-rel', color: '#64748b', filled: true },
            { id: 'arrow-sub', color: '#f8fafc', filled: false }, // Hollow triangle
            { id: 'arrow-inf', color: '#fbbf24', filled: true }
        ];

        markers.forEach(m => {
            defs.append("marker")
                .attr("id", m.id)
                .attr("viewBox", "0 -5 10 10")
                .attr("refX", 22) // Offset for node boundary
                .attr("refY", 0)
                .attr("markerWidth", 8)
                .attr("markerHeight", 8)
                .attr("orient", "auto")
                .append("path")
                .attr("d", m.id === 'arrow-sub' ? "M0,-5L10,0L0,5Z" : "M0,-5L10,0L0,5")
                .attr("fill", m.filled ? m.color : "none")
                .attr("stroke", m.color)
                .attr("stroke-width", 1.5);
        });

        const g = svg.append("g");

        // Zoom
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => g.attr("transform", event.transform));
        svg.call(zoom);

        // Simulation
        const simulation = d3.forceSimulation(simNodes.current)
            .force("link", d3.forceLink(simLinks.current).id((d: any) => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-500))
            .force("center", d3.forceCenter(width / 2, height / 2))
            // Separate Classes and Individuals vertically
            .force("y", d3.forceY((d: any) => d.type === ElementType.OWL_NAMED_INDIVIDUAL ? height * 0.7 : height * 0.3).strength(0.3))
            .force("collide", d3.forceCollide().radius((d: any) => (d.width || 40)/1.5).iterations(2));
        
        simulationRef.current = simulation;

        // --- Layers ---
        // Box Layer (Behind)
        const boxLayer = g.append("g").attr("class", "box-layer");
        const linkGroup = g.append("g").attr("class", "links");
        const nodeGroup = g.append("g").attr("class", "nodes");

        // Individual Bounding Box
        const indivBoxGroup = boxLayer.append("g").style("display", "none");
        const indivBoxRect = indivBoxGroup.append("rect")
            .attr("fill", "rgba(236, 72, 153, 0.05)") // Pink tint
            .attr("stroke", "rgba(236, 72, 153, 0.3)")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "4,4")
            .attr("rx", 16);
        
        const indivBoxLabel = indivBoxGroup.append("text")
            .attr("fill", "rgba(236, 72, 153, 0.6)")
            .attr("font-size", "10px")
            .attr("font-weight", "bold")
            .attr("text-anchor", "start")
            .style("text-transform", "uppercase")
            .style("letter-spacing", "1px")
            .text("Named Individuals");

        // Links
        const link = linkGroup
            .selectAll("g")
            .data(simLinks.current)
            .join("g")
            .attr("class", "link-group");

        const linkPath = link.append("path")
            .attr("fill", "none")
            .attr("stroke", d => d.isInferred ? THEME.lineInferred : THEME.line)
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", d => {
                if (d.isInferred) return "5,5";
                if (d.type === 'type') return "3,3";
                return "";
            })
            .attr("marker-end", d => {
                if (d.isInferred) return "url(#arrow-inf)";
                if (d.type === 'subclass') return "url(#arrow-sub)";
                return "url(#arrow-rel)";
            });

        // Link Labels
        const linkLabelGroup = link.append("g").style("display", d => d.type === 'subclass' ? 'none' : 'block');
        
        linkLabelGroup.append("rect")
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("fill", THEME.bg)
            .attr("fill-opacity", 0.8)
            .attr("stroke", d => d.isInferred ? THEME.lineInferred : THEME.line)
            .attr("stroke-width", 0.5);

        linkLabelGroup.append("text")
            .text(d => d.label)
            .attr("text-anchor", "middle")
            .attr("dy", "0.3em")
            .attr("font-size", "9px")
            .attr("fill", d => d.isInferred ? THEME.lineInferred : "#94a3b8")
            .each(function() {
                const bbox = this.getBBox();
                (this as any)._bbox = bbox;
            });

        linkLabelGroup.select("rect")
            .attr("width", function() { return ((this.parentNode as any).querySelector('text')._bbox.width || 0) + 6; })
            .attr("height", function() { return ((this.parentNode as any).querySelector('text')._bbox.height || 0) + 4; })
            .attr("x", function() { return -(((this.parentNode as any).querySelector('text')._bbox.width || 0) + 6) / 2; })
            .attr("y", function() { return -(((this.parentNode as any).querySelector('text')._bbox.height || 0) + 4) / 2; });

        // Nodes
        const node = nodeGroup
            .selectAll("g")
            .data(simNodes.current)
            .join("g")
            .attr("class", "node-group")
            .call(d3.drag<any, any>()
                .on("start", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on("drag", (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on("end", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                })
            );

        // Class Rects
        node.filter(d => d.type === ElementType.OWL_CLASS)
            .append("rect")
            .attr("width", d => d.width!)
            .attr("height", d => d.height!)
            .attr("x", d => -d.width! / 2)
            .attr("y", d => -d.height! / 2)
            .attr("rx", 6)
            .attr("fill", THEME.classFill)
            .attr("stroke", THEME.classStroke)
            .attr("stroke-width", 2)
            .attr("class", "shadow-sm cursor-grab active:cursor-grabbing");

        // Individual Circles
        node.filter(d => d.type === ElementType.OWL_NAMED_INDIVIDUAL)
            .append("circle")
            .attr("r", 20)
            .attr("fill", THEME.indivFill)
            .attr("stroke", THEME.indivStroke)
            .attr("stroke-width", 2)
            .attr("class", "cursor-grab active:cursor-grabbing");

        // Labels
        node.append("text")
            .text(d => d.label)
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("fill", THEME.text)
            .attr("font-size", "11px")
            .attr("font-weight", "600")
            .style("pointer-events", "none")
            .style("text-shadow", "0 1px 2px rgba(0,0,0,0.8)");

        // Tick
        simulation.on("tick", () => {
            linkPath.attr("d", (d: any) => {
                // Adjust endpoint for markers based on target shape
                return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
            });

            linkLabelGroup.attr("transform", (d: any) => `translate(${(d.source.x + d.target.x)/2},${(d.source.y + d.target.y)/2})`);

            node.attr("transform", d => `translate(${d.x},${d.y})`);

            // Update Individual Box Position
            const indivs = simNodes.current.filter(n => n.type === ElementType.OWL_NAMED_INDIVIDUAL);
            if (indivs.length > 0) {
                const padding = 30;
                const xMin = d3.min(indivs, n => (n.x || 0) - (n.radius || 20)) || 0;
                const xMax = d3.max(indivs, n => (n.x || 0) + (n.radius || 20)) || 0;
                const yMin = d3.min(indivs, n => (n.y || 0) - (n.radius || 20)) || 0;
                const yMax = d3.max(indivs, n => (n.y || 0) + (n.radius || 20)) || 0;
                
                indivBoxGroup.style("display", "block");
                indivBoxRect
                    .attr("x", xMin - padding)
                    .attr("y", yMin - padding)
                    .attr("width", xMax - xMin + padding * 2)
                    .attr("height", yMax - yMin + padding * 2);
                
                indivBoxLabel
                    .attr("x", xMin - padding + 10)
                    .attr("y", yMin - padding - 8);
            } else {
                indivBoxGroup.style("display", "none");
            }
        });

        // Hover interactions
        node.on("mouseenter", (event, d) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                setTooltip({
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                    content: (
                        <div className="flex flex-col gap-1">
                            <div className="font-bold text-sm">{d.label}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{d.iri || d.id}</div>
                            <div className="text-[10px] bg-slate-800 rounded px-1 w-fit border border-slate-700">
                                {d.type === ElementType.OWL_CLASS ? 'Class' : 'Individual'}
                            </div>
                        </div>
                    )
                });
            }
        }).on("mouseleave", () => setTooltip(null));

        // Cleanup
        return () => {
            simulation.stop();
        };

    }, [nodes, edges, searchTerm]);

    // Search Highlight
    useEffect(() => {
        if (!svgRef.current || !searchTerm) {
            d3.select(svgRef.current).selectAll('.node-group, .link-group').style('opacity', 1);
            return;
        }
        
        const lowerTerm = searchTerm.toLowerCase();
        d3.select(svgRef.current).selectAll('.node-group').style('opacity', (d: any) => 
            d.label.toLowerCase().includes(lowerTerm) ? 1 : 0.1
        );
        d3.select(svgRef.current).selectAll('.link-group').style('opacity', 0.1);

    }, [searchTerm]);

    const handleZoomIn = () => {
        if (svgRef.current) d3.select(svgRef.current).transition().call(d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 1.3);
    };
    const handleZoomOut = () => {
        if (svgRef.current) d3.select(svgRef.current).transition().call(d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 0.7);
    };
    const handleReset = () => {
        if (svgRef.current && containerRef.current) {
            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;
            d3.select(svgRef.current).transition().call(
                d3.zoom<SVGSVGElement, unknown>().transform as any, 
                d3.zoomIdentity.translate(width/2 - 100, height/2 - 100).scale(1)
            );
            simulationRef.current?.alpha(1).restart();
        }
    };

    const handleDownload = () => {
        if (!containerRef.current) return;
        const svg = containerRef.current.querySelector('svg');
        if (svg) {
            const svgData = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'ontomap.svg';
            link.click();
        }
    };

    return (
        <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden">
            
            {/* Toolbar */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                <div className="bg-slate-900/80 backdrop-blur border border-slate-800 p-2 rounded-lg text-xs text-slate-300 shadow-xl flex flex-col gap-2">
                    <div className="flex gap-1">
                        <button onClick={handleZoomIn} className="p-1.5 hover:bg-slate-700 rounded transition-colors" title="Zoom In">
                            <ZoomIn size={16} />
                        </button>
                        <button onClick={handleZoomOut} className="p-1.5 hover:bg-slate-700 rounded transition-colors" title="Zoom Out">
                            <ZoomOut size={16} />
                        </button>
                        <button onClick={handleReset} className="p-1.5 hover:bg-slate-700 rounded transition-colors" title="Reset View">
                            <Maximize size={16} />
                        </button>
                    </div>
                    <div className="h-px bg-slate-700"></div>
                    <button onClick={handleDownload} className="flex items-center gap-2 p-1.5 hover:bg-slate-700 rounded transition-colors text-blue-400">
                        <Download size={16} /> SVG
                    </button>
                </div>
            </div>

            {/* Legend */}
            <div className="absolute top-4 left-6 pointer-events-none">
                <div className="bg-slate-900/80 backdrop-blur border border-slate-800 p-3 rounded-lg shadow-xl text-slate-300">
                    <div className="flex items-center gap-2 mb-2 font-bold text-sm text-indigo-400">
                        <MapIcon size={16} /> Ontology Map
                    </div>
                    <div className="space-y-1.5 text-[10px]">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 border border-indigo-500 bg-slate-800 rounded-sm"></span> Class
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 border border-pink-500 bg-pink-900 rounded-full"></span> Individual
                        </div>
                        <div className="h-px bg-slate-700 my-1"></div>
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-0.5 bg-slate-400"></span> Relation
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-0.5 border-t border-white border-dashed"></span> SubClass (Hollow)
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-0.5 border-t-2 border-amber-400 border-dashed"></span> Inferred
                        </div>
                    </div>
                </div>
            </div>

            {/* Tooltip */}
            {tooltip && (
                <div 
                    className="absolute z-50 bg-slate-900/95 border border-slate-700 p-2 rounded-lg shadow-2xl pointer-events-none transform -translate-x-1/2 min-w-[120px] text-white animate-in fade-in zoom-in-95 duration-75"
                    style={{ left: tooltip.x, top: tooltip.y - 10 }}
                >
                    {tooltip.content}
                </div>
            )}

            <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing touch-none" />
        </div>
    );
};

export default OWLVizVisualization;
