
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { ZoomIn, ZoomOut, RefreshCw, Maximize, Database, User, Tag, ArrowRightLeft } from 'lucide-react';

interface GraphVisualizationProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
    searchTerm?: string;
    selectedNodeId?: string | null;
    onNavigate?: (view: string, id: string) => void;
}

// Extended D3 Node type to hold simulation state
interface SimNode extends d3.SimulationNodeDatum {
    id: string;
    label: string;
    type: ElementType;
    iri?: string;
    description?: string;
    color: string;
    radius: number;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
    id: string;
    source: string | SimNode;
    target: string | SimNode;
    label: string;
    isInferred: boolean;
}

const COLORS = {
    [ElementType.OWL_CLASS]: '#6366f1', // Indigo
    [ElementType.OWL_NAMED_INDIVIDUAL]: '#ec4899', // Pink
    [ElementType.OWL_OBJECT_PROPERTY]: '#3b82f6', // Blue
    [ElementType.OWL_DATA_PROPERTY]: '#10b981', // Emerald
    [ElementType.OWL_DATATYPE]: '#f59e0b', // Amber
    'default': '#94a3b8' // Slate
};

const GraphVisualization: React.FC<GraphVisualizationProps> = ({ nodes, edges, searchTerm = '', selectedNodeId, onNavigate }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<SVGGElement | null>(null);
    
    const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
    const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const [tooltip, setTooltip] = useState<{x: number, y: number, node: SimNode} | null>(null);

    // --- Initialization & Data Update ---
    useEffect(() => {
        if (!svgRef.current || !containerRef.current) return;

        const svg = d3.select(svgRef.current);
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        // Clear previous render to prevent duplication (Blackbox pattern)
        svg.selectAll("*").remove();

        const defs = svg.append("defs");
        // Glow Filter
        const glow = defs.append("filter").attr("id", "glow");
        glow.append("feGaussianBlur").attr("stdDeviation", "3.5").attr("result", "coloredBlur");
        const feMerge = glow.append("feMerge");
        feMerge.append("feMergeNode").attr("in", "coloredBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");

        // Arrowheads
        const createMarker = (id: string, color: string) => {
            defs.append("marker")
                .attr("id", id)
                .attr("viewBox", "0 -5 10 10")
                .attr("refX", 24)
                .attr("refY", 0)
                .attr("markerWidth", 6)
                .attr("markerHeight", 6)
                .attr("orient", "auto")
                .append("path")
                .attr("d", "M0,-5L10,0L0,5")
                .attr("fill", color);
        };
        createMarker("arrow-std", "#64748b");
        createMarker("arrow-active", "#f8fafc");
        createMarker("arrow-inferred", "#fbbf24");

        // Main Wrapper
        const g = svg.append("g");
        wrapperRef.current = g.node();

        // Layers
        const linkLayer = g.append("g").attr("class", "links");
        const labelLayer = g.append("g").attr("class", "labels");
        const nodeLayer = g.append("g").attr("class", "nodes");

        // Zoom Behavior
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });
        
        zoomBehaviorRef.current = zoom;
        svg.call(zoom);
        svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8));

        // Data Prep
        const oldNodes = new Map<string, SimNode>();
        if (simulationRef.current) {
            simulationRef.current.nodes().forEach(n => oldNodes.set(n.id, n));
            simulationRef.current.stop();
        }

        const newNodes: SimNode[] = nodes.map(n => {
            const old = oldNodes.get(n.id);
            return {
                id: n.id,
                label: n.data.label,
                type: n.data.type,
                iri: n.data.iri,
                description: n.data.description,
                color: COLORS[n.data.type] || COLORS['default'],
                radius: n.data.type === ElementType.OWL_NAMED_INDIVIDUAL ? 20 : 30,
                x: old ? old.x : (Math.random() - 0.5) * 50,
                y: old ? old.y : (Math.random() - 0.5) * 50,
                vx: old ? old.vx : 0,
                vy: old ? old.vy : 0
            };
        });

        // SAFETY: Filter links to ensure source/target exist in newNodes
        const nodeIds = new Set(newNodes.map(n => n.id));
        const newLinks: SimLink[] = edges
            .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
            .map(e => ({
                id: e.id,
                source: e.source,
                target: e.target,
                label: (typeof e.label === 'string' ? e.label : '').replace(/^(owl:|rdf:|rdfs:)/, ''),
                isInferred: e.data?.isInferred || false
            }));

        // Simulation
        const simulation = d3.forceSimulation<SimNode, SimLink>(newNodes)
            .force("link", d3.forceLink<SimNode, SimLink>(newLinks).id(d => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-500))
            .force("center", d3.forceCenter(0, 0)) 
            .force("collide", d3.forceCollide().radius((d: any) => d.radius + 20).iterations(2));

        simulationRef.current = simulation;

        // --- Render Elements ---

        // 1. Links
        const linkSelection = linkLayer.selectAll<SVGPathElement, SimLink>("path.link-path")
            .data(newLinks, (d) => d.id)
            .join("path")
            .attr("class", "link-path")
            .attr("fill", "none")
            .attr("stroke-width", 2)
            .attr("stroke", d => d.isInferred ? "#fbbf24" : "#475569")
            .attr("stroke-dasharray", d => d.isInferred ? "4,4" : "")
            .attr("marker-end", d => d.isInferred ? "url(#arrow-inferred)" : "url(#arrow-std)");

        // 2. Labels
        const labelGroupSelection = labelLayer.selectAll<SVGGElement, SimLink>("g.edge-label")
            .data(newLinks, (d) => d.id)
            .join("g")
            .attr("class", "edge-label")
            .style("pointer-events", "none");

        labelGroupSelection.append("rect")
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("fill", "#0f172a")
            .attr("fill-opacity", 0.8)
            .attr("stroke-width", 1)
            .attr("stroke", d => d.isInferred ? "#fbbf24" : "#475569");

        labelGroupSelection.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("font-size", "10px")
            .attr("font-weight", "500")
            .text(d => d.label)
            .attr("fill", d => d.isInferred ? "#fbbf24" : "#cbd5e1")
            .each(function(d) {
                const bbox = this.getBBox();
                const padX = 8, padY = 4;
                // Update parent rect size based on text
                const parent = d3.select(this.parentNode as any);
                parent.select("rect")
                    .attr("x", -bbox.width/2 - padX/2)
                    .attr("y", -bbox.height/2 - padY/2)
                    .attr("width", bbox.width + padX)
                    .attr("height", bbox.height + padY);
            });

        // 3. Nodes
        const nodeGroupSelection = nodeLayer.selectAll<SVGGElement, SimNode>("g.node")
            .data(newNodes, (d) => d.id)
            .join("g")
            .attr("class", "node")
            .style("cursor", "pointer")
            .call(d3.drag<SVGGElement, SimNode>()
                .on("start", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x; d.fy = d.y;
                })
                .on("drag", (event, d) => {
                    d.fx = event.x; d.fy = event.y;
                })
                .on("end", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null; d.fy = null;
                })
            );

        nodeGroupSelection.append("circle")
            .attr("r", d => d.radius)
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .attr("fill", d => d.color);

        nodeGroupSelection.append("text")
            .attr("class", "node-label")
            .attr("dy", d => d.radius + 12)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .attr("fill", "#f1f5f9")
            .attr("font-weight", "600")
            .style("text-shadow", "0 2px 4px rgba(0,0,0,0.8)")
            .style("pointer-events", "none")
            .text(d => d.label.length > 15 ? d.label.substring(0,12) + '...' : d.label);

        // Interactions
        nodeGroupSelection.on("click", (e, d) => {
            e.stopPropagation();
            if (onNavigate) onNavigate('graph', d.id);
        });

        nodeGroupSelection.on("mouseenter", (e, d) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if(rect) {
                setTooltip({ 
                    x: e.clientX - rect.left, 
                    y: e.clientY - rect.top, 
                    node: d 
                });
            }
            
            // Highlight connections
            linkSelection.transition().style("opacity", l => 
                (l.source as SimNode).id === d.id || (l.target as SimNode).id === d.id ? 1 : 0.1
            ).attr("stroke", l => 
                (l.source as SimNode).id === d.id || (l.target as SimNode).id === d.id ? "#fff" : (l.isInferred ? "#fbbf24" : "#475569")
            );
            
            labelGroupSelection.transition().style("opacity", l => 
                (l.source as SimNode).id === d.id || (l.target as SimNode).id === d.id ? 1 : 0.1
            );
            
            nodeGroupSelection.transition().style("opacity", n => {
                const isNeighbor = newLinks.some(l => 
                    ((l.source as SimNode).id === d.id && (l.target as SimNode).id === n.id) || 
                    ((l.target as SimNode).id === d.id && (l.source as SimNode).id === n.id)
                );
                return n.id === d.id || isNeighbor ? 1 : 0.1;
            });
        });
        
        nodeGroupSelection.on("mouseleave", () => {
            setTooltip(null);
            linkSelection.transition().style("opacity", 1).attr("stroke", d => d.isInferred ? "#fbbf24" : "#475569");
            labelGroupSelection.transition().style("opacity", 1);
            nodeGroupSelection.transition().style("opacity", 1);
        });

        // Apply Selection Style
        nodeGroupSelection.select("circle")
            .attr("stroke", d => d.id === selectedNodeId ? "#fff" : "#fff")
            .attr("stroke-width", d => d.id === selectedNodeId ? 4 : 2)
            .style("filter", d => d.id === selectedNodeId ? "url(#glow)" : null);

        // Apply Search Filter
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            nodeGroupSelection.style("opacity", d => d.label.toLowerCase().includes(lower) ? 1 : 0.1);
            nodeGroupSelection.select("circle").attr("stroke", d => d.label.toLowerCase().includes(lower) ? "#facc15" : "#fff");
        }

        // Ticker
        simulation.on("tick", () => {
            linkSelection.attr("d", d => {
                const s = d.source as SimNode;
                const t = d.target as SimNode;
                return `M${s.x},${s.y} L${t.x},${t.y}`;
            });

            labelGroupSelection.attr("transform", d => {
                const s = d.source as SimNode;
                const t = d.target as SimNode;
                return `translate(${(s.x! + t.x!) / 2}, ${(s.y! + t.y!) / 2})`;
            });

            nodeGroupSelection.attr("transform", d => `translate(${d.x},${d.y})`);
        });

        return () => {
            simulation.stop();
        };

    }, [nodes, edges, searchTerm, selectedNodeId]);

    // --- External Focus Control ---
    useEffect(() => {
        if (selectedNodeId && zoomBehaviorRef.current && svgRef.current && containerRef.current && simulationRef.current) {
            const node = simulationRef.current.nodes().find(n => n.id === selectedNodeId);
            if (node) {
                const width = containerRef.current.clientWidth;
                const height = containerRef.current.clientHeight;
                d3.select(svgRef.current).transition().duration(1000).call(
                    zoomBehaviorRef.current.transform,
                    d3.zoomIdentity.translate(width / 2, height / 2).scale(1.2).translate(-node.x!, -node.y!)
                );
            }
        }
    }, [selectedNodeId]);

    const handleZoomIn = useCallback(() => {
        if (svgRef.current && zoomBehaviorRef.current) d3.select(svgRef.current).transition().call(zoomBehaviorRef.current.scaleBy, 1.3);
    }, []);
    const handleZoomOut = useCallback(() => {
        if (svgRef.current && zoomBehaviorRef.current) d3.select(svgRef.current).transition().call(zoomBehaviorRef.current.scaleBy, 0.7);
    }, []);
    const handleFit = useCallback(() => {
        if (svgRef.current && zoomBehaviorRef.current && wrapperRef.current && containerRef.current) {
            const bounds = wrapperRef.current.getBBox();
            if (bounds.width === 0 || bounds.height === 0) return;
            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;
            const dx = bounds.width;
            const dy = bounds.height;
            const x = bounds.x + dx / 2;
            const y = bounds.y + dy / 2;
            const scale = Math.max(0.1, Math.min(2, 0.85 / Math.max(dx / width, dy / height)));
            d3.select(svgRef.current).transition().duration(750).call(
                zoomBehaviorRef.current.transform,
                d3.zoomIdentity.translate(width / 2 - scale * x, height / 2 - scale * y).scale(scale)
            );
        }
    }, []);

    return (
        <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden group/canvas">
            <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing touch-none" />

            {/* Controls */}
            <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2">
                <div className="bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-1 shadow-lg flex flex-col gap-1">
                    <button onClick={handleZoomIn} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><ZoomIn size={20}/></button>
                    <button onClick={handleZoomOut} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><ZoomOut size={20}/></button>
                    <button onClick={handleFit} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><Maximize size={20}/></button>
                    <button onClick={() => window.location.reload()} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><RefreshCw size={20}/></button>
                </div>
            </div>

            {/* Top Right Legend */}
            <div className="absolute top-4 right-4 z-10 pointer-events-none">
                <div className="bg-slate-900/80 backdrop-blur border border-slate-800 p-3 rounded-lg text-xs text-slate-300 shadow-xl pointer-events-auto">
                    <h3 className="font-bold mb-2 text-slate-500 uppercase tracking-wider text-[10px]">Model Elements</h3>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-500"></div> Class</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-pink-500"></div> Individual</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Object Property</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Data Property</div>
                    </div>
                </div>
            </div>

            {/* Tooltip */}
            {tooltip && (
                <div 
                    className="absolute z-50 bg-slate-900/95 border border-slate-700 p-3 rounded-lg shadow-2xl pointer-events-none transform -translate-x-1/2 min-w-[150px] animate-in fade-in zoom-in-95 duration-150"
                    style={{ left: tooltip.x, top: tooltip.y - 20 }}
                >
                    <div className="flex flex-col gap-1 mb-2">
                        <div className="flex items-center gap-2">
                            {tooltip.node.type === ElementType.OWL_CLASS && <Database size={14} className="text-indigo-400" />}
                            {tooltip.node.type === ElementType.OWL_NAMED_INDIVIDUAL && <User size={14} className="text-pink-400" />}
                            {tooltip.node.type === ElementType.OWL_OBJECT_PROPERTY && <ArrowRightLeft size={14} className="text-blue-400" />}
                            {tooltip.node.type === ElementType.OWL_DATA_PROPERTY && <Tag size={14} className="text-emerald-400" />}
                            <span className="font-bold text-sm text-white">{tooltip.node.label}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono break-all">{tooltip.node.iri || tooltip.node.id}</span>
                        {tooltip.node.description && (
                            <div className="mt-2 pt-2 border-t border-slate-700/50">
                                <p className="text-[10px] text-slate-300 italic leading-snug">"{tooltip.node.description}"</p>
                            </div>
                        )}
                    </div>
                    <div className="absolute left-1/2 -bottom-1.5 w-3 h-3 bg-slate-900 border-r border-b border-slate-700 transform rotate-45 -translate-x-1/2"></div>
                </div>
            )}
        </div>
    );
};

export default GraphVisualization;
