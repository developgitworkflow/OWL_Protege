import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { ZoomIn, ZoomOut, RefreshCw, Move, Maximize } from 'lucide-react';

interface GraphVisualizationProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
    searchTerm?: string;
}

interface D3Node extends d3.SimulationNodeDatum {
    id: string;
    label: string;
    type: ElementType;
    iri?: string;
    color: string;
    radius: number;
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
    isMatch?: boolean;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
    id: string;
    label: string;
}

const GraphVisualization: React.FC<GraphVisualizationProps> = ({ nodes, edges, searchTerm = '' }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    
    const [hoveredNode, setHoveredNode] = useState<D3Node | null>(null);
    const [tooltip, setTooltip] = useState<{x: number, y: number, content: React.ReactNode} | null>(null);
    
    // Store simulation data refs to access in event handlers without stale closures
    const simulationNodes = useRef<D3Node[]>([]);
    const simulationLinks = useRef<D3Link[]>([]);
    const adjList = useRef<Map<string, Set<string>>>(new Map());

    // --- Helpers ---
    const getColor = (type: ElementType) => {
        switch (type) {
            case ElementType.OWL_CLASS: return '#6366f1'; // Indigo-500
            case ElementType.OWL_NAMED_INDIVIDUAL: return '#ec4899'; // Pink-500
            case ElementType.OWL_DATA_PROPERTY: return '#10b981'; // Emerald-500
            case ElementType.OWL_OBJECT_PROPERTY: return '#3b82f6'; // Blue-500
            case ElementType.OWL_DATATYPE: return '#f59e0b'; // Amber-500
            default: return '#94a3b8'; // Slate-400
        }
    };

    const getRadius = (type: ElementType) => {
        switch (type) {
            case ElementType.OWL_CLASS: return 35;
            case ElementType.OWL_NAMED_INDIVIDUAL: return 25;
            default: return 20;
        }
    };

    // --- Search Logic ---
    useEffect(() => {
        if (!svgRef.current) return;
        
        const svg = d3.select(svgRef.current);
        const nodeGroup = svg.selectAll('.node-group');
        const linkGroup = svg.selectAll('.link-group');

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            nodeGroup.style('opacity', (d: any) => {
                const match = d.label.toLowerCase().includes(term);
                return match ? 1 : 0.1;
            });
            // Also dim links unless connected to match? Simplest is just dim links
            linkGroup.style('opacity', 0.1);
            
            // Highlight circles of matches
            nodeGroup.select('circle')
                .attr('stroke', (d: any) => d.label.toLowerCase().includes(term) ? '#facc15' : '#fff')
                .attr('stroke-width', (d: any) => d.label.toLowerCase().includes(term) ? 4 : 2);

        } else {
            // Reset
            nodeGroup.style('opacity', 1);
            linkGroup.style('opacity', 1);
            nodeGroup.select('circle')
                .attr('stroke', '#fff')
                .attr('stroke-width', 2);
        }

    }, [searchTerm]);

    // --- Graph Initialization ---
    useEffect(() => {
        if (!svgRef.current || !containerRef.current) return;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        // 1. Prepare Data
        simulationNodes.current = nodes.map(n => ({
            id: n.id,
            label: n.data.label,
            type: n.data.type,
            iri: n.data.iri,
            color: getColor(n.data.type),
            radius: getRadius(n.data.type),
            x: n.position.x + 100, // Offset to center vaguely if not simulated yet
            y: n.position.y + 100
        }));

        simulationLinks.current = edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: (typeof e.label === 'string' ? e.label : '').replace('owl:', '').replace('rdf:', '')
        }));

        // Build Adjacency List for fast neighbor lookup
        const adj = new Map<string, Set<string>>();
        simulationLinks.current.forEach(l => {
            // Note: d3 converts source/target to Node objects after simulation start, 
            // but initially they are strings. We handle strings here for init.
            const s = (l.source as any).id || l.source;
            const t = (l.target as any).id || l.target;
            if (!adj.has(s)) adj.set(s, new Set());
            if (!adj.has(t)) adj.set(t, new Set());
            adj.get(s)?.add(t);
            adj.get(t)?.add(s);
        });
        adjList.current = adj;

        // 2. Clear & Setup SVG
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        // Markers
        const defs = svg.append("defs");
        defs.append("marker")
            .attr("id", "arrowhead")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 28)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "#64748b");

        // Main Group
        const g = svg.append("g");
        gRef.current = g;

        // Zoom Behavior
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });
        zoomRef.current = zoom;
        svg.call(zoom);

        // 3. Simulation Setup
        const simulation = d3.forceSimulation(simulationNodes.current)
            .force("link", d3.forceLink(simulationLinks.current).id((d: any) => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-800))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius((d: any) => d.radius + 15).iterations(2));

        // 4. Rendering
        const linkGroup = g.append("g").attr("class", "links");
        const nodeGroup = g.append("g").attr("class", "nodes");

        // Edges
        const link = linkGroup.selectAll("g")
            .data(simulationLinks.current)
            .join("g")
            .attr("class", "link-group");

        const linkPath = link.append("path")
            .attr("class", "edge-path")
            .attr("stroke", "#475569")
            .attr("stroke-width", 2)
            .attr("fill", "none")
            .attr("marker-end", "url(#arrowhead)");

        const linkLabelGroup = link.append("g").attr("class", "edge-label");
        
        linkLabelGroup.append("rect")
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("fill", "#1e293b")
            .attr("stroke", "#475569")
            .attr("stroke-width", 1);

        linkLabelGroup.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.3em")
            .attr("fill", "#cbd5e1")
            .attr("font-size", "9px")
            .text(d => d.label)
            .each(function() {
                const bbox = this.getBBox();
                // Store bbox for rect sizing in tick
                (this as any)._bbox = bbox;
            });

        // Resize rects once
        linkLabelGroup.select("rect")
            .attr("width", function() { 
                const parent = (this as unknown as Element).parentNode as Element;
                return ((parent.querySelector('text') as any)._bbox.width || 0) + 8; 
            })
            .attr("height", function() { 
                const parent = (this as unknown as Element).parentNode as Element;
                return ((parent.querySelector('text') as any)._bbox.height || 0) + 4; 
            })
            .attr("x", function() { 
                const parent = (this as unknown as Element).parentNode as Element;
                return -(((parent.querySelector('text') as any)._bbox.width || 0) + 8) / 2; 
            })
            .attr("y", function() { 
                const parent = (this as unknown as Element).parentNode as Element;
                return -(((parent.querySelector('text') as any)._bbox.height || 0) + 4) / 2; 
            });

        // Nodes
        const node = nodeGroup.selectAll("g")
            .data(simulationNodes.current)
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

        // Hover Interactions
        node.on('mouseenter', (event, d) => {
            setHoveredNode(d);
            
            // Tooltip
            const containerRect = containerRef.current?.getBoundingClientRect();
            if (containerRect) {
                 setTooltip({
                     x: event.clientX - containerRect.left,
                     y: event.clientY - containerRect.top - 20,
                     content: (
                         <div className="flex flex-col gap-1">
                             <span className="font-bold text-sm text-white">{d.label}</span>
                             <span className="text-[10px] text-slate-400 font-mono">{d.iri || d.id}</span>
                             <span className="text-[10px] uppercase bg-slate-800 px-1 rounded w-fit text-blue-300">{d.type.replace('owl_', '').replace('_', ' ')}</span>
                         </div>
                     )
                 });
            }

            // Highlight Logic (only if not filtering search)
            if (!searchTerm.trim()) {
                const connectedSet = new Set<string>();
                connectedSet.add(d.id);
                if (adjList.current.has(d.id)) {
                    adjList.current.get(d.id)!.forEach(n => connectedSet.add(n));
                }

                node.transition().duration(200).style('opacity', o => connectedSet.has(o.id) ? 1 : 0.1);
                link.transition().duration(200).style('opacity', o => 
                    (o.source as any).id === d.id || (o.target as any).id === d.id ? 1 : 0.05
                );
                linkLabelGroup.transition().duration(200).style('opacity', o => 
                    (o.source as any).id === d.id || (o.target as any).id === d.id ? 1 : 0.05
                );
            }

        }).on('mouseleave', () => {
            setHoveredNode(null);
            setTooltip(null);
            
            // Reset (respect search)
            if (!searchTerm.trim()) {
                node.transition().duration(200).style('opacity', 1);
                link.transition().duration(200).style('opacity', 1);
                linkLabelGroup.transition().duration(200).style('opacity', 1);
            }
        });

        // Circle
        node.append("circle")
            .attr("r", d => d.radius)
            .attr("fill", d => d.color)
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .attr("class", "node-circle shadow-lg");

        // Label
        node.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.3em")
            .attr("fill", "#fff")
            .attr("font-weight", "bold")
            .attr("font-size", d => Math.min(12, d.radius / 2.5) + "px")
            .attr("pointer-events", "none")
            .style("text-shadow", "0px 1px 2px rgba(0,0,0,0.8)")
            .text(d => d.label.length > 8 ? d.label.substring(0, 7) + ".." : d.label);

        // Simulation Tick
        simulation.on("tick", () => {
            linkPath.attr("d", (d: any) => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                const dr = Math.sqrt(dx * dx + dy * dy);
                const r = d.target.radius + 5; 
                if (dr === 0) return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`; // Handle stacked nodes
                const offsetX = (dx * r) / dr;
                const offsetY = (dy * r) / dr;
                return `M${d.source.x},${d.source.y}L${d.target.x - offsetX},${d.target.y - offsetY}`;
            });

            linkLabelGroup.attr("transform", (d: any) => {
                 const x = (d.source.x + d.target.x) / 2;
                 const y = (d.source.y + d.target.y) / 2;
                 return `translate(${x}, ${y})`;
            });

            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });

        // Cleanup
        return () => {
            simulation.stop();
        };
    }, [nodes, edges]);


    // --- Controls ---

    const handleZoomIn = useCallback(() => {
        if (!svgRef.current || !zoomRef.current) return;
        d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.3);
    }, []);

    const handleZoomOut = useCallback(() => {
        if (!svgRef.current || !zoomRef.current) return;
        d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.7);
    }, []);

    const handleFitView = useCallback(() => {
        if (!svgRef.current || !zoomRef.current || !gRef.current) return;
        const bounds = gRef.current.node()?.getBBox();
        if (!bounds) return;

        const parent = svgRef.current.parentElement;
        if (!parent) return;

        const width = parent.clientWidth;
        const height = parent.clientHeight;
        const dx = bounds.width;
        const dy = bounds.height;
        const x = bounds.x + dx / 2;
        const y = bounds.y + dy / 2;
        
        // Calculate scale
        const scale = Math.max(0.1, Math.min(3, 0.9 / Math.max(dx / width, dy / height)));
        const translate = [width / 2 - scale * x, height / 2 - scale * y];

        d3.select(svgRef.current).transition().duration(750).call(
            zoomRef.current.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
    }, []);

    return (
        <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden group/canvas">
            
            {/* Top Toolbar: Search Hint or Legend */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 pointer-events-none">
                {/* Right: Legend */}
                <div className="bg-slate-900/80 backdrop-blur border border-slate-800 p-3 rounded-lg text-xs text-slate-300 pointer-events-auto shadow-xl">
                    <h3 className="font-bold mb-2 text-slate-500 uppercase tracking-wider text-[10px]">Legend</h3>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></span> Class</div>
                        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.6)]"></span> Individual</div>
                        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span> Data Prop</div>
                        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span> Object Prop</div>
                    </div>
                </div>
            </div>

            {/* Bottom Left: Zoom Controls */}
            <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2 pointer-events-auto">
                <div className="bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-1 shadow-lg flex flex-col gap-1">
                    <button onClick={handleZoomIn} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors" title="Zoom In">
                        <ZoomIn size={20} />
                    </button>
                    <button onClick={handleZoomOut} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors" title="Zoom Out">
                        <ZoomOut size={20} />
                    </button>
                    <div className="h-px bg-slate-700 mx-1 my-0.5"></div>
                    <button onClick={handleFitView} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors" title="Fit to Screen">
                        <Maximize size={20} />
                    </button>
                    <button onClick={() => window.location.reload()} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors" title="Reset Simulation">
                        <RefreshCw size={20} />
                    </button>
                </div>
            </div>

            {/* Custom Tooltip */}
            {tooltip && (
                <div 
                    className="absolute z-50 bg-slate-900/95 border border-slate-700 p-3 rounded-lg shadow-2xl pointer-events-none transform -translate-x-1/2 min-w-[150px] animate-in fade-in zoom-in-95 duration-150"
                    style={{ left: tooltip.x, top: tooltip.y }}
                >
                    {tooltip.content}
                    {/* Little arrow at bottom */}
                    <div className="absolute left-1/2 -bottom-1.5 w-3 h-3 bg-slate-900 border-r border-b border-slate-700 transform rotate-45 -translate-x-1/2"></div>
                </div>
            )}

            <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing touch-none" />
        </div>
    );
};

export default GraphVisualization;