
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { ZoomIn, ZoomOut, RefreshCw, Maximize, Workflow, Database, User, Tag, ArrowRightLeft, FileType } from 'lucide-react';

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
    color: string;
    radius: number;
    // D3 state
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
    const wrapperRef = useRef<SVGGElement>(null); // The g element that gets transformed
    
    // State to keep track of simulation instances and data
    const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
    const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    
    // Tooltip State
    const [tooltip, setTooltip] = useState<{x: number, y: number, node: SimNode} | null>(null);

    // --- 1. Initialization (Run Once) ---
    useEffect(() => {
        if (!svgRef.current || !wrapperRef.current || !containerRef.current) return;

        const svg = d3.select(svgRef.current);
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        // A. Setup Zoom
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                d3.select(wrapperRef.current).attr("transform", event.transform);
            });
        
        zoomBehaviorRef.current = zoom;
        svg.call(zoom);
        
        // Initial centering
        svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8));

        // B. Define Filters/Markers
        const defs = svg.select("defs").size() === 0 ? svg.append("defs") : svg.select("defs");
        (defs as any).selectAll("*").remove(); // Clean reload

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
                .attr("refX", 24) // Offset for node radius
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

        // C. Initialize Simulation
        const simulation = d3.forceSimulation<SimNode, SimLink>()
            .force("link", d3.forceLink<SimNode, SimLink>().id(d => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-500))
            .force("center", d3.forceCenter(0, 0)) // Center at 0,0 relative to group
            .force("collide", d3.forceCollide().radius((d: any) => d.radius + 20).iterations(2));

        simulationRef.current = simulation;

        return () => {
            simulation.stop();
        };
    }, []);

    // --- 2. Data Update Loop ---
    useEffect(() => {
        if (!simulationRef.current || !wrapperRef.current) return;

        const simulation = simulationRef.current;
        const g = d3.select(wrapperRef.current);

        // --- Data Merge Strategy ---
        // We want to preserve x,y,vx,vy of existing nodes if they still exist
        const oldNodes = new Map(simulation.nodes().map(n => [n.id, n]));
        
        const newNodes: SimNode[] = nodes.map(n => {
            const old = oldNodes.get(n.id);
            return {
                id: n.id,
                label: n.data.label,
                type: n.data.type,
                iri: n.data.iri,
                color: COLORS[n.data.type] || COLORS['default'],
                radius: n.data.type === ElementType.OWL_NAMED_INDIVIDUAL ? 20 : 30,
                // Inherit pos if exists, else random spread around center
                x: old ? old.x : (Math.random() - 0.5) * 50,
                y: old ? old.y : (Math.random() - 0.5) * 50,
                vx: old ? old.vx : 0,
                vy: old ? old.vy : 0
            };
        });

        const newLinks: SimLink[] = edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: (typeof e.label === 'string' ? e.label : '').replace(/^(owl:|rdf:|rdfs:)/, ''),
            isInferred: e.data?.isInferred || false
        }));

        // Update Simulation Data
        simulation.nodes(newNodes);
        (simulation.force("link") as d3.ForceLink<SimNode, SimLink>).links(newLinks);
        simulation.alpha(0.3).restart(); // Gentle restart

        // --- Rendering (Enter/Update/Exit) ---

        // 1. Links
        const linkGroup = g.select(".links").size() === 0 ? g.append("g").attr("class", "links") : g.select(".links");
        
        const link = (linkGroup.selectAll("path.link-path") as any)
            .data(newLinks, (d: any) => d.id);

        const linkEnter = link.enter().append("path")
            .attr("class", "link-path")
            .attr("fill", "none")
            .attr("stroke-width", 2);

        const linkMerge = linkEnter.merge(link)
            .attr("stroke", (d: any) => d.isInferred ? "#fbbf24" : "#475569")
            .attr("stroke-dasharray", (d: any) => d.isInferred ? "4,4" : "")
            .attr("marker-end", (d: any) => d.isInferred ? "url(#arrow-inferred)" : "url(#arrow-std)");

        link.exit().remove();

        // 2. Edge Labels
        const labelGroup = g.select(".labels").size() === 0 ? g.append("g").attr("class", "labels") : g.select(".labels");
        const edgeLabel = (labelGroup.selectAll("g.edge-label") as any)
            .data(newLinks, (d: any) => d.id);

        const edgeLabelEnter = edgeLabel.enter().append("g")
            .attr("class", "edge-label")
            .style("pointer-events", "none"); // Let clicks pass through to links if needed

        edgeLabelEnter.append("rect")
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("fill", "#0f172a")
            .attr("fill-opacity", 0.8)
            .attr("stroke-width", 1);

        edgeLabelEnter.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("font-size", "10px")
            .attr("font-weight", "500");

        const edgeLabelMerge = edgeLabelEnter.merge(edgeLabel);
        
        edgeLabelMerge.select("rect")
            .attr("stroke", (d: any) => d.isInferred ? "#fbbf24" : "#475569");

        edgeLabelMerge.select("text")
            .text((d: any) => d.label)
            .attr("fill", (d: any) => d.isInferred ? "#fbbf24" : "#cbd5e1")
            .each(function(this: SVGTextElement) {
                // Dynamic sizing for bg rect
                const bbox = this.getBBox();
                const padX = 8, padY = 4;
                const parent = d3.select(this.parentNode as any);
                parent.select("rect")
                    .attr("x", -bbox.width/2 - padX/2)
                    .attr("y", -bbox.height/2 - padY/2)
                    .attr("width", bbox.width + padX)
                    .attr("height", bbox.height + padY);
            });

        edgeLabel.exit().remove();

        // 3. Nodes
        const nodeGroup = g.select(".nodes").size() === 0 ? g.append("g").attr("class", "nodes") : g.select(".nodes");
        const node = (nodeGroup.selectAll("g.node") as any)
            .data(newNodes, (d: any) => d.id);

        const nodeEnter = node.enter().append("g")
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

        // Circle
        nodeEnter.append("circle")
            .attr("r", (d: any) => d.radius)
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .attr("fill", (d: any) => d.color);

        // Icon/Text fallback
        nodeEnter.append("text")
            .attr("class", "node-icon")
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("fill", "#fff")
            .attr("font-family", "lucide") // Assuming font is loaded or fallback
            .attr("font-size", (d: any) => d.radius)
            .style("pointer-events", "none");

        // Label (Below)
        nodeEnter.append("text")
            .attr("class", "node-label")
            .attr("dy", (d: any) => d.radius + 12)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .attr("fill", "#f1f5f9")
            .attr("font-weight", "600")
            .style("text-shadow", "0 2px 4px rgba(0,0,0,0.8)")
            .style("pointer-events", "none")
            .text((d: any) => d.label.length > 15 ? d.label.substring(0,12) + '...' : d.label);

        const nodeMerge = nodeEnter.merge(node);

        // --- Interactions ---
        nodeMerge.on("click", (e: any, d: any) => {
            e.stopPropagation();
            if (onNavigate) onNavigate('graph', d.id);
        });

        nodeMerge.on("mouseenter", (e: any, d: any) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if(rect) {
                setTooltip({ 
                    x: e.clientX - rect.left, 
                    y: e.clientY - rect.top, 
                    node: d 
                });
            }
            
            // Highlight connections
            linkMerge.transition().style("opacity", (l: any) => 
                (l.source as SimNode).id === d.id || (l.target as SimNode).id === d.id ? 1 : 0.1
            ).attr("stroke", (l: any) => 
                (l.source as SimNode).id === d.id || (l.target as SimNode).id === d.id ? "#fff" : (l.isInferred ? "#fbbf24" : "#475569")
            );
            
            nodeMerge.transition().style("opacity", (n: any) => {
                const isNeighbor = newLinks.some(l => 
                    ((l.source as SimNode).id === d.id && (l.target as SimNode).id === n.id) || 
                    ((l.target as SimNode).id === d.id && (l.source as SimNode).id === n.id)
                );
                return n.id === d.id || isNeighbor ? 1 : 0.1;
            });
        }).on("mouseleave", () => {
            setTooltip(null);
            linkMerge.transition().style("opacity", 1).attr("stroke", (d: any) => d.isInferred ? "#fbbf24" : "#475569");
            nodeMerge.transition().style("opacity", 1);
        });

        // --- Selection Highlighting ---
        nodeMerge.select("circle")
            .attr("stroke", (d: any) => d.id === selectedNodeId ? "#fff" : "#fff")
            .attr("stroke-width", (d: any) => d.id === selectedNodeId ? 4 : 2)
            .style("filter", (d: any) => d.id === selectedNodeId ? "url(#glow)" : null);

        // --- Search Highlighting ---
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            nodeMerge.style("opacity", (d: any) => d.label.toLowerCase().includes(lower) ? 1 : 0.1);
            nodeMerge.select("circle").attr("stroke", (d: any) => d.label.toLowerCase().includes(lower) ? "#facc15" : "#fff");
        } else {
            nodeMerge.style("opacity", 1);
        }

        node.exit().remove();

        // --- Tick Function ---
        simulation.on("tick", () => {
            linkMerge.attr("d", (d: any) => {
                const s = d.source as SimNode;
                const t = d.target as SimNode;
                // Basic straight line
                return `M${s.x},${s.y} L${t.x},${t.y}`;
            });

            edgeLabelMerge.attr("transform", (d: any) => {
                const s = d.source as SimNode;
                const t = d.target as SimNode;
                return `translate(${(s.x! + t.x!) / 2}, ${(s.y! + t.y!) / 2})`;
            });

            nodeMerge.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
        });

    }, [nodes, edges, searchTerm, selectedNodeId]); // Re-run when data changes

    // --- 3. External Focus Control ---
    useEffect(() => {
        if (selectedNodeId && zoomBehaviorRef.current && svgRef.current && containerRef.current && simulationRef.current) {
            const node = simulationRef.current.nodes().find(n => n.id === selectedNodeId);
            if (node) {
                const width = containerRef.current.clientWidth;
                const height = containerRef.current.clientHeight;
                // Smooth transition to center on node
                d3.select(svgRef.current).transition().duration(1000).call(
                    zoomBehaviorRef.current.transform,
                    d3.zoomIdentity.translate(width / 2, height / 2).scale(1.2).translate(-node.x!, -node.y!)
                );
            }
        }
    }, [selectedNodeId]);

    // --- Controls Handlers ---
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
            const translate = [width / 2 - scale * x, height / 2 - scale * y];

            d3.select(svgRef.current).transition().duration(750).call(
                zoomBehaviorRef.current.transform,
                d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
            );
        }
    }, []);

    return (
        <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden group/canvas">
            <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing touch-none">
                <g ref={wrapperRef}>
                    <g className="links"></g>
                    <g className="labels"></g>
                    <g className="nodes"></g>
                </g>
            </svg>

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
                    </div>
                    {onNavigate && (
                        <div className="pt-2 border-t border-slate-700/50 flex justify-center pointer-events-auto">
                            <button 
                                onClick={() => onNavigate('concept', tooltip.node.id)}
                                className="flex items-center gap-2 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white px-2 py-1 rounded text-[10px] font-bold transition-colors w-full justify-center"
                            >
                                <Workflow size={12} /> Concept View
                            </button>
                        </div>
                    )}
                    <div className="absolute left-1/2 -bottom-1.5 w-3 h-3 bg-slate-900 border-r border-b border-slate-700 transform rotate-45 -translate-x-1/2"></div>
                </div>
            )}
        </div>
    );
};

export default GraphVisualization;
