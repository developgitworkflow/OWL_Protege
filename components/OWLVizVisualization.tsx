
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import dagre from 'dagre';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { ZoomIn, ZoomOut, Maximize, Download, ArrowDown, ArrowRight, Layout, Settings2, Share2, Layers, Database, User, Box, Tag, Sigma } from 'lucide-react';

interface OWLVizVisualizationProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
    searchTerm?: string;
    selectedNodeId?: string | null;
}

// Modern Dark Theme matching the app's aesthetic
const THEME = {
    bg: '#020617',         // slate-950
    
    // Node Colors
    classStroke: '#6366f1',    // Indigo-500
    classFill: '#1e1b4b',      // Indigo-950
    classText: '#e0e7ff',      // Indigo-100
    
    indivStroke: '#ec4899',    // Pink-500
    indivFill: '#500724',      // Pink-950
    indivText: '#fce7f3',      // Pink-100
    
    // Edges
    edgeDefault: '#475569',    // Slate-600
    edgeInferred: '#fbbf24',   // Amber-400
    
    // Selection
    selection: '#facc15',      // Yellow-400
};

interface LayoutNode {
    id: string;
    label: string;
    type: ElementType;
    width: number;
    height: number;
    x?: number;
    y?: number;
}

interface LayoutEdge {
    source: string;
    target: string;
    label: string;
    points?: { x: number, y: number }[];
    isInferred: boolean;
    type: 'subclass' | 'instance' | 'relation';
}

interface TooltipData {
    x: number;
    y: number;
    data: UMLNodeData;
}

const OWLVizVisualization: React.FC<OWLVizVisualizationProps> = ({ nodes, edges, searchTerm = '', selectedNodeId }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    
    const [direction, setDirection] = useState<'TB' | 'LR'>('TB');
    const [graphData, setGraphData] = useState<{ nodes: LayoutNode[], edges: LayoutEdge[] } | null>(null);
    const [tooltip, setTooltip] = useState<TooltipData | null>(null);

    // --- Layout Calculation (Dagre) ---
    useEffect(() => {
        const g = new dagre.graphlib.Graph();
        g.setGraph({ 
            rankdir: direction, 
            nodesep: 60, 
            ranksep: 80, 
            marginx: 50, 
            marginy: 50,
            edgesep: 30 
        });
        g.setDefaultEdgeLabel(() => ({}));

        // 1. Filter Relevant Nodes
        const relevantNodes = nodes.filter(n => 
            n.data.type === ElementType.OWL_CLASS || 
            n.data.type === ElementType.OWL_NAMED_INDIVIDUAL
        );
        const nodeIds = new Set(relevantNodes.map(n => n.id));

        // 2. Add Nodes
        relevantNodes.forEach(n => {
            // Estimate width/height
            const labelLen = n.data.label.length;
            const width = Math.max(120, labelLen * 8 + 30);
            const height = 40; 
            g.setNode(n.id, { label: n.data.label, width, height, type: n.data.type });
        });

        // 3. Add Edges
        const relevantEdges: LayoutEdge[] = [];
        
        edges.forEach(e => {
            if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) return;

            let label = e.label as string || '';
            const lowerLabel = label.toLowerCase();
            const isInferred = e.data?.isInferred || false;
            
            let type: LayoutEdge['type'] = 'relation';
            
            if (['subclassof', 'rdfs:subclassof'].includes(lowerLabel)) {
                type = 'subclass';
                // Parent -> Child for Top-Down hierarchy usually means Parent is Higher (Lower Y)
                g.setEdge(e.target, e.source, { minlen: 2 });
            } 
            else if (['rdf:type', 'a'].includes(lowerLabel)) {
                type = 'instance';
                // Class -> Individual (Class at top)
                g.setEdge(e.target, e.source, { minlen: 1 });
            } 
            else {
                // Ignore other edges for layout rank to prevent distortion
            }

            relevantEdges.push({
                source: e.source,
                target: e.target,
                label: label.replace(/^(owl:|rdf:|rdfs:)/, ''),
                isInferred,
                type,
                points: []
            });
        });

        dagre.layout(g);

        // 4. Map back
        const mappedNodes: LayoutNode[] = [];
        g.nodes().forEach(v => {
            const nodeInfo = g.node(v);
            mappedNodes.push({
                id: v,
                label: nodeInfo.label,
                type: nodeInfo.type,
                width: nodeInfo.width,
                height: nodeInfo.height,
                x: nodeInfo.x,
                y: nodeInfo.y
            });
        });

        // 5. Edges
        const mappedEdges = relevantEdges.map(e => {
            // Check if this edge was used in Dagre (reversed or not)
            const dagreEdgeReversed = g.edge(e.target, e.source);
            
            let points: { x: number, y: number }[] = [];
            
            if (dagreEdgeReversed) {
                // Reverse points back to Child -> Parent
                points = [...dagreEdgeReversed.points].reverse();
            } else {
                // Direct calculation for non-layout edges
                const sNode = mappedNodes.find(n => n.id === e.source);
                const tNode = mappedNodes.find(n => n.id === e.target);
                if (sNode && tNode) {
                    // Simple straight line or curve
                    points = [
                        { x: sNode.x!, y: sNode.y! },
                        { x: tNode.x!, y: tNode.y! }
                    ];
                }
            }
            return { ...e, points };
        });

        setGraphData({ nodes: mappedNodes, edges: mappedEdges });

    }, [nodes, edges, direction]);

    // --- D3 Render ---
    useEffect(() => {
        if (!graphData || !svgRef.current) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        // -- Defs (Glows & Markers) --
        const defs = svg.append("defs");
        
        // Glow Filter
        const filter = defs.append("filter").attr("id", "node-glow");
        filter.append("feGaussianBlur").attr("stdDeviation", "2.5").attr("result", "coloredBlur");
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode").attr("in", "coloredBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");

        // Markers
        const markerAttrs = { viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" };
        
        // 1. Subclass (Hollow Triangle)
        defs.append("marker")
            .attr("id", "arrow-sub")
            .attr("viewBox", "0 0 12 12")
            .attr("refX", 12)
            .attr("refY", 6)
            .attr("markerWidth", 10)
            .attr("markerHeight", 10)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,0 L12,6 L0,12 L2,6 Z") // Triangleish
            .attr("fill", THEME.bg)
            .attr("stroke", THEME.edgeDefault)
            .attr("stroke-width", 1.5);

        // 2. Standard (Filled)
        defs.append("marker")
            .attr("id", "arrow-std")
            .attr("viewBox", "0 0 10 10")
            .attr("refX", 10)
            .attr("refY", 5)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,0 L10,5 L0,10 z")
            .attr("fill", THEME.edgeDefault);

        // 3. Inferred (Amber)
        defs.append("marker")
            .attr("id", "arrow-inf")
            .attr("viewBox", "0 0 10 10")
            .attr("refX", 10)
            .attr("refY", 5)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,0 L10,5 L0,10 z")
            .attr("fill", THEME.edgeInferred);

        // -- Scene --
        const g = svg.append("g");
        gRef.current = g;

        // Zoom
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 3])
            .on("zoom", (e) => g.attr("transform", e.transform));
        zoomRef.current = zoom;
        svg.call(zoom);

        // -- Edges --
        // Use a Basis curve for smooth hierarchy
        const lineGen = d3.line<{x: number, y: number}>()
            .x(d => d.x)
            .y(d => d.y)
            .curve(d3.curveBasis);

        const edgeGroup = g.append("g").attr("class", "edges");
        
        graphData.edges.forEach(e => {
            if (!e.points || e.points.length < 2) return;
            
            const isSub = e.type === 'subclass';
            const color = e.isInferred ? THEME.edgeInferred : THEME.edgeDefault;
            const marker = e.isInferred ? "url(#arrow-inf)" : (isSub ? "url(#arrow-sub)" : "url(#arrow-std)");
            const dash = e.isInferred ? "4,4" : "";

            // Path
            edgeGroup.append("path")
                .datum(e.points)
                .attr("d", lineGen)
                .attr("fill", "none")
                .attr("stroke", color)
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", dash)
                .attr("marker-end", marker)
                .attr("opacity", 0.8);
                
            // Label (if not subclass)
            if (!isSub && e.label) {
                // Find midpoint roughly
                const mid = e.points[Math.floor(e.points.length / 2)];
                if (mid) {
                    const lg = edgeGroup.append("g")
                        .attr("transform", `translate(${mid.x}, ${mid.y})`);
                    
                    lg.append("rect")
                        .attr("rx", 4)
                        .attr("fill", THEME.bg)
                        .attr("stroke", color)
                        .attr("stroke-width", 1)
                        .attr("opacity", 0.9);
                        
                    const txt = lg.append("text")
                        .text(e.label)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "middle")
                        .attr("font-size", "10px")
                        .attr("fill", color)
                        .style("pointer-events", "none");
                        
                    // Resize box
                    const bbox = txt.node()?.getBBox();
                    if (bbox) {
                        lg.select("rect")
                            .attr("x", -bbox.width/2 - 4)
                            .attr("y", -bbox.height/2 - 2)
                            .attr("width", bbox.width + 8)
                            .attr("height", bbox.height + 4);
                    }
                }
            }
        });

        // -- Nodes --
        const nodeGroup = g.append("g").attr("class", "nodes");
        
        graphData.nodes.forEach(n => {
            const isClass = n.type === ElementType.OWL_CLASS;
            const stroke = isClass ? THEME.classStroke : THEME.indivStroke;
            const fill = isClass ? THEME.classFill : THEME.indivFill;
            const textFill = isClass ? THEME.classText : THEME.indivText;
            
            const ng = nodeGroup.append("g")
                .attr("transform", `translate(${n.x}, ${n.y})`)
                .attr("cursor", "pointer");

            // Glow if selected or matched
            const isSelected = n.id === selectedNodeId;
            const isMatch = searchTerm && n.label.toLowerCase().includes(searchTerm.toLowerCase());
            
            if (isSelected || isMatch) {
                ng.style("filter", "url(#node-glow)");
            }

            // Shape
            ng.append("rect")
                .attr("x", -n.width / 2)
                .attr("y", -n.height / 2)
                .attr("width", n.width)
                .attr("height", n.height)
                .attr("rx", 8)
                .attr("ry", 8)
                .attr("fill", fill)
                .attr("stroke", isSelected || isMatch ? THEME.selection : stroke)
                .attr("stroke-width", isSelected ? 2.5 : 1.5)
                .transition().duration(300);

            // Icon Placeholder (Optional dot)
            ng.append("circle")
                .attr("cx", -n.width / 2 + 15)
                .attr("cy", 0)
                .attr("r", 4)
                .attr("fill", stroke);

            // Label
            ng.append("text")
                .text(n.label)
                .attr("x", 0)
                .attr("y", 0)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .attr("font-size", "12px")
                .attr("font-weight", "600")
                .attr("fill", textFill)
                .style("pointer-events", "none");

            // --- Tooltip Event Handlers ---
            ng.on("mouseenter", (event) => {
                const original = nodes.find(node => node.id === n.id);
                if (original && containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    setTooltip({
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top,
                        data: original.data
                    });
                }
                d3.select(event.currentTarget).transition().duration(200).attr("transform", `translate(${n.x}, ${n.y}) scale(1.05)`);
            })
            .on("mousemove", (event) => {
                if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    setTooltip(prev => prev ? { ...prev, x: event.clientX - rect.left, y: event.clientY - rect.top } : null);
                }
            })
            .on("mouseleave", (event) => {
                setTooltip(null);
                d3.select(event.currentTarget).transition().duration(200).attr("transform", `translate(${n.x}, ${n.y}) scale(1)`);
            });
        });

    }, [graphData, selectedNodeId, searchTerm, nodes]); // Added 'nodes' dependency to ensure tooltip data is fresh

    // Initial Zoom Fit
    useEffect(() => {
        if (graphData && svgRef.current && containerRef.current && graphData.nodes.length > 0) {
            handleFit();
        }
    }, [graphData]);

    const handleZoomIn = () => { if (svgRef.current) d3.select(svgRef.current).transition().call(zoomRef.current!.scaleBy, 1.2); };
    const handleZoomOut = () => { if (svgRef.current) d3.select(svgRef.current).transition().call(zoomRef.current!.scaleBy, 0.8); };
    const handleFit = () => {
        if (svgRef.current && containerRef.current && zoomRef.current && gRef.current) {
            const bounds = gRef.current.node()?.getBBox();
            if (!bounds) return;
            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;
            const dx = bounds.width;
            const dy = bounds.height;
            const x = bounds.x + dx / 2;
            const y = bounds.y + dy / 2;
            const scale = Math.max(0.1, Math.min(2, 0.9 / Math.max(dx / width, dy / height)));
            const transform = d3.zoomIdentity.translate(width / 2 - scale * x, height / 2 - scale * y).scale(scale);
            d3.select(svgRef.current).transition().duration(750).call(zoomRef.current.transform, transform);
        }
    };

    const handleDownload = () => {
        if (!containerRef.current) return;
        const svg = containerRef.current.querySelector('svg');
        if (svg) {
            const serializer = new XMLSerializer();
            let source = serializer.serializeToString(svg);
            // Namespace hack for standalone SVG
            if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
                source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
            }
            const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "hierarchical_view.svg";
            link.click();
        }
    };

    return (
        <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden">
            {/* SVG Canvas */}
            <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing touch-none" />

            {/* Floating Shadcn-like Toolbar */}
            <div className="absolute top-6 right-6 flex flex-col items-end gap-4 pointer-events-none">
                
                {/* Main Controls Panel */}
                <div className="pointer-events-auto bg-slate-900/80 backdrop-blur-md border border-slate-800 p-1.5 rounded-xl shadow-2xl flex flex-col gap-1 transition-all hover:border-slate-700">
                    
                    {/* Direction Toggle Segmented Control */}
                    <div className="flex bg-slate-950/50 p-1 rounded-lg border border-slate-800/50 mb-1">
                        <button 
                            onClick={() => setDirection('TB')}
                            className={`flex-1 flex items-center justify-center p-1.5 rounded-md text-xs font-medium transition-all ${
                                direction === 'TB' 
                                ? 'bg-slate-800 text-indigo-400 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                            title="Top to Bottom"
                        >
                            <ArrowDown size={16} />
                        </button>
                        <button 
                            onClick={() => setDirection('LR')}
                            className={`flex-1 flex items-center justify-center p-1.5 rounded-md text-xs font-medium transition-all ${
                                direction === 'LR' 
                                ? 'bg-slate-800 text-indigo-400 shadow-sm' 
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                            title="Left to Right"
                        >
                            <ArrowRight size={16} />
                        </button>
                    </div>

                    <div className="h-px bg-slate-800 mx-1 my-0.5" />

                    <div className="flex flex-col gap-1">
                        <button onClick={handleZoomIn} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 group">
                            <ZoomIn size={18} /> <span className="text-[10px] w-0 overflow-hidden group-hover:w-auto transition-all duration-300">Zoom In</span>
                        </button>
                        <button onClick={handleZoomOut} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 group">
                            <ZoomOut size={18} /> <span className="text-[10px] w-0 overflow-hidden group-hover:w-auto transition-all duration-300">Zoom Out</span>
                        </button>
                        <button onClick={handleFit} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 group">
                            <Maximize size={18} /> <span className="text-[10px] w-0 overflow-hidden group-hover:w-auto transition-all duration-300">Fit View</span>
                        </button>
                        <div className="h-px bg-slate-800 mx-1 my-0.5" />
                        <button onClick={handleDownload} className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 group">
                            <Download size={18} /> <span className="text-[10px] w-0 overflow-hidden group-hover:w-auto transition-all duration-300">Export</span>
                        </button>
                    </div>
                </div>

                {/* Legend Card */}
                <div className="pointer-events-auto bg-slate-900/80 backdrop-blur-md border border-slate-800 p-4 rounded-xl shadow-xl max-w-[200px]">
                    <div className="flex items-center gap-2 mb-3 text-slate-400">
                        <Layers size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Hierarchy</span>
                    </div>
                    <div className="space-y-2 text-xs font-medium text-slate-300">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                            <span>Class</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-pink-600 shadow-[0_0_8px_rgba(236,72,153,0.5)]"></div>
                            <span>Individual</span>
                        </div>
                        <div className="flex items-center gap-3 opacity-60">
                            <div className="w-6 h-px bg-slate-400 relative">
                                <div className="absolute right-0 -top-1 border-4 border-transparent border-l-slate-400"></div>
                            </div>
                            <span>SubClassOf</span>
                        </div>
                        <div className="flex items-center gap-3 opacity-60">
                            <div className="w-6 h-px border-t border-amber-500 border-dashed relative"></div>
                            <span className="text-amber-500">Inferred</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hover Tooltip Overlay */}
            {tooltip && (
                <div 
                    className="absolute z-50 p-4 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] text-slate-200 pointer-events-none min-w-[220px] max-w-[280px] animate-in fade-in zoom-in-95 duration-150"
                    style={{ 
                        left: Math.min(tooltip.x + 20, (containerRef.current?.clientWidth || 0) - 300), 
                        top: Math.min(tooltip.y + 20, (containerRef.current?.clientHeight || 0) - 200)
                    }}
                >
                    <div className="flex flex-col gap-3">
                        {/* Header */}
                        <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${
                                tooltip.data.type === ElementType.OWL_CLASS ? 'bg-indigo-500/20 text-indigo-400' :
                                tooltip.data.type === ElementType.OWL_NAMED_INDIVIDUAL ? 'bg-pink-500/20 text-pink-400' :
                                'bg-slate-800 text-slate-400'
                            }`}>
                                {tooltip.data.type === ElementType.OWL_CLASS ? <Database size={16} /> : 
                                 tooltip.data.type === ElementType.OWL_NAMED_INDIVIDUAL ? <User size={16} /> : <Box size={16} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm text-white truncate">{tooltip.data.label}</div>
                                <div className="font-mono text-[10px] text-slate-500 truncate">{tooltip.data.iri || 'Local Entity'}</div>
                            </div>
                        </div>

                        {/* Stats / Counts */}
                        <div className="flex gap-2">
                            {(tooltip.data.attributes?.length || 0) > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-900/50">
                                    {tooltip.data.attributes.length} Props
                                </span>
                            )}
                            {(tooltip.data.methods?.length || 0) > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/30 text-indigo-400 border border-indigo-900/50">
                                    {tooltip.data.methods.length} Axioms
                                </span>
                            )}
                        </div>

                        {/* Divider */}
                        {((tooltip.data.attributes?.length || 0) > 0 || (tooltip.data.methods?.length || 0) > 0) && <div className="h-px bg-slate-800/80" />}

                        {/* Attributes */}
                        {(tooltip.data.attributes?.length || 0) > 0 && (
                            <div className="space-y-1.5">
                                <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                                    <Tag size={10} /> Properties
                                </div>
                                <div className="space-y-1">
                                    {tooltip.data.attributes.slice(0, 3).map((attr: any) => (
                                        <div key={attr.id} className="text-xs flex items-baseline justify-between bg-slate-800/30 p-1 rounded px-2">
                                            <span className="text-slate-300 font-medium truncate max-w-[60%]">{attr.name}</span>
                                            <span className="font-mono text-[9px] text-slate-500">{attr.type || 'Literal'}</span>
                                        </div>
                                    ))}
                                    {tooltip.data.attributes.length > 3 && (
                                        <div className="text-[9px] text-slate-500 italic px-1">
                                            +{tooltip.data.attributes.length - 3} more
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Axioms */}
                        {(tooltip.data.methods?.length || 0) > 0 && (
                            <div className="space-y-1.5">
                                <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                                    <Sigma size={10} /> Logic
                                </div>
                                <div className="space-y-1">
                                    {tooltip.data.methods.slice(0, 3).map((m: any) => (
                                        <div key={m.id} className="text-xs bg-slate-800/30 p-1 rounded px-2">
                                            <div className="text-indigo-300 text-[10px] font-bold mb-0.5">{m.name}</div>
                                            <div className="font-mono text-slate-400 text-[10px] truncate">{m.returnType}</div>
                                        </div>
                                    ))}
                                    {tooltip.data.methods.length > 3 && (
                                        <div className="text-[9px] text-slate-500 italic px-1">
                                            +{tooltip.data.methods.length - 3} more
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default OWLVizVisualization;
