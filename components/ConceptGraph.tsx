
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { ZoomIn, ZoomOut, RefreshCw, Maximize, Database, X } from 'lucide-react';

interface ConceptGraphProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
    searchTerm?: string;
    selectedNodeId?: string | null;
    onNavigate?: (view: string, id: string) => void;
}

interface SimNode extends d3.SimulationNodeDatum {
    id: string;
    label: string;
    type: ElementType | 'literal';
    originalId: string;
    radius: number;
    color: string;
    stroke: string;
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
    id: string;
    source: string | SimNode;
    target: string | SimNode;
    label: string;
    type: 'subclass' | 'type' | 'property';
    isInferred: boolean;
}

const THEME = {
    classStart: '#3b82f6',
    classEnd: '#1d4ed8',
    indivStart: '#d946ef',
    indivEnd: '#a21caf',
    dataStart: '#fbbf24',
    dataEnd: '#d97706',
    literalStart: '#94a3b8',
    literalEnd: '#64748b',
    line: '#64748b',
    lineInferred: '#fbbf24',
};

const ConceptGraph: React.FC<ConceptGraphProps> = ({ nodes, edges, searchTerm = '', selectedNodeId, onNavigate }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<SVGGElement>(null);
    
    const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
    const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    
    const [selectedEntity, setSelectedEntity] = useState<Partial<SimNode> | null>(null);
    const [showAttributes, setShowAttributes] = useState(false);

    useEffect(() => {
        if (!svgRef.current || !wrapperRef.current || !containerRef.current) return;

        const svg = d3.select(svgRef.current);
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                d3.select(wrapperRef.current).attr("transform", event.transform);
            });
        zoomBehaviorRef.current = zoom;
        svg.call(zoom);
        
        svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8));

        // Setup Defs using D3 to populate the React-rendered <defs>
        const defs = d3.select(svgRef.current).select("defs");
        defs.selectAll("*").remove();

        const createGradient = (id: string, start: string, end: string) => {
            const grad = defs.append("radialGradient")
                .attr("id", id)
                .attr("cx", "30%")
                .attr("cy", "30%")
                .attr("r", "70%");
            grad.append("stop").attr("offset", "0%").attr("stop-color", start);
            grad.append("stop").attr("offset", "100%").attr("stop-color", end);
        };

        createGradient("grad-class", THEME.classStart, THEME.classEnd);
        createGradient("grad-indiv", THEME.indivStart, THEME.indivEnd);
        createGradient("grad-data", THEME.dataStart, THEME.dataEnd);
        createGradient("grad-literal", THEME.literalStart, THEME.literalEnd);

        const filter = defs.append("filter").attr("id", "shadow").attr("x", "-20%").attr("y", "-20%").attr("width", "140%").attr("height", "140%");
        filter.append("feGaussianBlur").attr("in", "SourceAlpha").attr("stdDeviation", 2).attr("result", "blur");
        filter.append("feOffset").attr("in", "blur").attr("dx", 2).attr("dy", 2).attr("result", "offsetBlur");
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode").attr("in", "offsetBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");

        defs.append("marker")
            .attr("id", "arrow-std")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 28)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#64748b");

        const subMarker = defs.append("marker")
            .attr("id", "arrow-sub")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 32)
            .attr("refY", 0)
            .attr("markerWidth", 10)
            .attr("markerHeight", 10)
            .attr("orient", "auto");
        subMarker.append("path").attr("d", "M0,-5L10,0L0,5Z").attr("fill", "#0f172a").attr("stroke", "#64748b").attr("stroke-width", 1.5);

        defs.append("marker")
            .attr("id", "arrow-inf")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 28)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#fbbf24");

        const sim = d3.forceSimulation<SimNode, SimLink>()
            .force("link", d3.forceLink<SimNode, SimLink>().id(d => d.id).distance(180))
            .force("charge", d3.forceManyBody().strength(-800))
            .force("center", d3.forceCenter(0, 0))
            .force("collide", d3.forceCollide().radius((d: any) => d.radius + 30).iterations(3));
        
        simulationRef.current = sim;

        return () => { sim.stop(); };
    }, []);

    useEffect(() => {
        if (!simulationRef.current || !wrapperRef.current) return;
        const simulation = simulationRef.current;
        const g = d3.select(wrapperRef.current);

        const oldNodes = new Map<string, SimNode>();
        simulation.nodes().forEach(n => oldNodes.set(n.id, n));
        
        const newNodes: SimNode[] = [];
        const newLinks: SimLink[] = [];

        nodes.forEach(n => {
            let radius = 35;
            let color = "url(#grad-class)";
            let stroke = THEME.classEnd;

            if (n.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
                radius = 20;
                color = "url(#grad-indiv)";
                stroke = THEME.indivEnd;
            } else if (n.data.type === ElementType.OWL_DATATYPE) {
                radius = 25;
                color = "url(#grad-data)";
                stroke = THEME.dataEnd;
            }

            const old = oldNodes.get(n.id);
            newNodes.push({
                id: n.id,
                label: n.data.label,
                type: n.data.type,
                originalId: n.id,
                radius,
                color,
                stroke,
                x: old ? old.x : (Math.random() - 0.5) * 100,
                y: old ? old.y : (Math.random() - 0.5) * 100,
                fx: old ? old.fx : null,
                fy: old ? old.fy : null
            });

            if (showAttributes && n.data.attributes) {
                n.data.attributes.forEach((attr, i) => {
                    const attrId = `${n.id}_attr_${i}`;
                    const existingAttr = oldNodes.get(attrId);
                    
                    newNodes.push({
                        id: attrId,
                        label: attr.name,
                        type: 'literal',
                        originalId: n.id,
                        radius: 0,
                        color: "url(#grad-literal)",
                        stroke: THEME.literalEnd,
                        x: existingAttr ? existingAttr.x : (old?.x || 0) + 50,
                        y: existingAttr ? existingAttr.y : (old?.y || 0) + 50
                    });

                    newLinks.push({
                        id: `${n.id}-${attrId}`,
                        source: n.id,
                        target: attrId,
                        label: '',
                        type: 'property',
                        isInferred: false
                    });
                });
            }
        });

        edges.forEach(e => {
            if (!newNodes.find(n => n.id === e.source) || !newNodes.find(n => n.id === e.target)) return;

            let type: SimLink['type'] = 'property';
            let label = e.label as string || '';
            const lowerLabel = label.toLowerCase();

            if (['subclassof', 'rdfs:subclassof'].includes(lowerLabel)) type = 'subclass';
            else if (['rdf:type', 'a'].includes(lowerLabel)) type = 'type';

            label = label.replace(/^(owl:|rdf:|rdfs:)/, '');

            newLinks.push({
                id: e.id,
                source: e.source,
                target: e.target,
                label,
                type,
                isInferred: e.data?.isInferred || false
            });
        });

        simulation.nodes(newNodes);
        (simulation.force("link") as d3.ForceLink<SimNode, SimLink>).links(newLinks);
        simulation.alpha(0.3).restart();

        const linkGroup = g.select(".links").size() === 0 ? g.append("g").attr("class", "links") : g.select(".links");
        const link = ((linkGroup as any).selectAll("path.link") as any).data(newLinks, (d: any) => d.id);

        const linkEnter = link.enter().append("path")
            .attr("class", "link")
            .attr("fill", "none")
            .attr("stroke-width", 1.5);

        const linkMerge = linkEnter.merge(link)
            .attr("stroke", (d: any) => d.isInferred ? THEME.lineInferred : THEME.line)
            .attr("stroke-dasharray", (d: any) => (d.isInferred || d.type === 'type') ? "5,5" : "")
            .attr("marker-end", (d: any) => {
                if (d.isInferred) return "url(#arrow-inf)";
                if (d.type === 'subclass') return "url(#arrow-sub)";
                return "url(#arrow-std)";
            });

        link.exit().remove();

        const labelGroup = g.select(".labels").size() === 0 ? g.append("g").attr("class", "labels") : g.select(".labels");
        const label = ((labelGroup as any).selectAll("g.label") as any).data(newLinks, (d: any) => d.id);

        const labelEnter = label.enter().append("g")
            .attr("class", "label")
            .style("display", (d: any) => d.type === 'subclass' ? 'none' : 'block')
            .style("cursor", "pointer");

        labelEnter.append("rect")
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("fill", "#0f172a")
            .attr("stroke", "#475569")
            .attr("stroke-width", 1);

        labelEnter.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.3em")
            .attr("font-size", "9px")
            .attr("fill", "#cbd5e1");

        const labelMerge = labelEnter.merge(label);
        
        labelMerge.select("text")
            .text((d: any) => d.label)
            .each(function(this: SVGTextElement) {
                const bbox = this.getBBox();
                const parent = d3.select(this.parentNode as any);
                parent.select("rect")
                    .attr("x", -bbox.width/2 - 4)
                    .attr("y", -bbox.height/2 - 2)
                    .attr("width", bbox.width + 8)
                    .attr("height", bbox.height + 4);
            });

        label.exit().remove();

        const nodeGroup = g.select(".nodes").size() === 0 ? g.append("g").attr("class", "nodes") : g.select(".nodes");
        const node = ((nodeGroup as any).selectAll("g.node") as any).data(newNodes, (d: any) => d.id);

        const nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .style("cursor", "grab")
            .call(d3.drag<SVGGElement, SimNode>()
                .on("start", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x; d.fy = d.y;
                })
                .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
                .on("end", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null; d.fy = null;
                }));

        nodeEnter.each(function(d: any) {
            const el = d3.select(this);
            if (d.type === 'literal' || d.type === ElementType.OWL_DATATYPE) {
                el.append("rect")
                    .attr("width", 80)
                    .attr("height", 24)
                    .attr("x", -40)
                    .attr("y", -12)
                    .attr("fill", d.color)
                    .attr("stroke", d.stroke)
                    .attr("stroke-width", 2)
                    .attr("filter", "url(#shadow)");
            } else {
                el.append("circle")
                    .attr("r", d.radius)
                    .attr("fill", d.color)
                    .attr("stroke", d.stroke)
                    .attr("stroke-width", 2)
                    .attr("filter", "url(#shadow)");
            }

            el.append("text")
                .text(d.label)
                .attr("text-anchor", "middle")
                .attr("dy", "0.3em")
                .attr("fill", "#fff")
                .attr("font-size", d.type === ElementType.OWL_NAMED_INDIVIDUAL ? "10px" : "11px")
                .attr("font-weight", "600")
                .style("pointer-events", "none")
                .style("text-shadow", "0 1px 2px rgba(0,0,0,0.8)");
        });

        const nodeMerge = nodeEnter.merge(node);

        nodeMerge.select("circle")
            .attr("stroke", (d: any) => d.id === selectedNodeId ? "#fff" : d.stroke)
            .attr("stroke-width", (d: any) => d.id === selectedNodeId ? 4 : 2);
        
        nodeMerge.select("rect")
            .attr("stroke", (d: any) => d.id === selectedNodeId ? "#fff" : d.stroke)
            .attr("stroke-width", (d: any) => d.id === selectedNodeId ? 4 : 2);

        nodeMerge.style("opacity", (d: any) => searchTerm && !d.label.toLowerCase().includes(searchTerm.toLowerCase()) ? 0.2 : 1);

        nodeMerge.on("click", (e: any, d: any) => {
            e.stopPropagation();
            if (d.originalId) {
                const entity = { 
                    id: d.id,
                    label: d.label,
                    type: d.type,
                    originalId: d.originalId
                };
                setSelectedEntity(entity);
            }
        });

        node.exit().remove();

        simulation.on("tick", () => {
            linkMerge.attr("d", (d: any) => `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`);
            
            labelMerge.attr("transform", (d: any) => {
                const x = (d.source.x + d.target.x) / 2;
                const y = (d.source.y + d.target.y) / 2;
                return `translate(${x},${y})`;
            });

            nodeMerge.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
        });

    }, [nodes, edges, searchTerm, showAttributes, selectedNodeId]);

    const handleZoomIn = useCallback(() => {
        if (svgRef.current && zoomBehaviorRef.current) d3.select(svgRef.current).transition().call(zoomBehaviorRef.current.scaleBy, 1.3);
    }, []);
    const handleZoomOut = useCallback(() => {
        if (svgRef.current && zoomBehaviorRef.current) d3.select(svgRef.current).transition().call(zoomBehaviorRef.current.scaleBy, 0.7);
    }, []);
    const handleFit = useCallback(() => {
        if (svgRef.current && zoomBehaviorRef.current && containerRef.current) {
            const w = containerRef.current.clientWidth;
            const h = containerRef.current.clientHeight;
            d3.select(svgRef.current).transition().call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(w/2, h/2).scale(0.8));
        }
    }, []);

    const getNodeReal = (id: string) => nodes.find(n => n.id === id);

    return (
        <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden">
            <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing touch-none">
                <defs></defs>
                <g ref={wrapperRef}>
                    <g className="links"></g>
                    <g className="labels"></g>
                    <g className="nodes"></g>
                </g>
            </svg>

            <div className="absolute top-4 right-4 z-10 pointer-events-none">
                <div className="bg-slate-900/80 backdrop-blur border border-slate-800 p-3 rounded-lg text-xs text-slate-300 shadow-xl pointer-events-auto">
                    <h3 className="font-bold mb-2 text-slate-500 uppercase tracking-wider text-[10px]">VOWL Notation</h3>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-600 border border-blue-400"></div> Class
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-fuchsia-600 border border-fuchsia-400"></div> Individual
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm bg-amber-500 border border-amber-400"></div> Datatype / Literal
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-0 border-t-2 border-slate-500"></div> Property
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-0 border-t-2 border-amber-400 border-dashed"></div> Inferred
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute top-4 left-6 flex bg-slate-800 rounded-lg p-1 border border-slate-700 shadow-xl z-20">
                <button 
                    onClick={() => setShowAttributes(!showAttributes)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded transition-all ${showAttributes ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    <Database size={14} /> {showAttributes ? 'Hide' : 'Show'} Attributes
                </button>
            </div>

            <div className="absolute bottom-6 left-6 flex flex-col gap-2">
                <div className="bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-1 shadow-lg flex flex-col gap-1">
                    <button onClick={handleZoomIn} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><ZoomIn size={20}/></button>
                    <button onClick={handleZoomOut} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><ZoomOut size={20}/></button>
                    <button onClick={handleFit} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><Maximize size={20}/></button>
                    <button onClick={() => window.location.reload()} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><RefreshCw size={20}/></button>
                </div>
            </div>

            {selectedEntity && (
                <div className="absolute top-4 right-44 w-72 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl flex flex-col animate-in slide-in-from-right-10 fade-in duration-200 z-30">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-start">
                        <div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Selected Entity
                            </div>
                            <h2 className="text-lg font-bold text-white break-words">{selectedEntity.label}</h2>
                            <div className="text-[10px] text-slate-400 font-mono mt-1">
                                {selectedEntity.originalId ? (getNodeReal(selectedEntity.originalId)?.data.iri || selectedEntity.id) : selectedEntity.id}
                            </div>
                        </div>
                        <button onClick={() => setSelectedEntity(null)} className="text-slate-500 hover:text-white"><X size={16}/></button>
                    </div>
                    {onNavigate && selectedEntity.originalId && (
                        <div className="p-3 bg-slate-950 rounded-b-xl flex gap-2">
                            <button 
                                onClick={() => onNavigate('design', selectedEntity.originalId!)}
                                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded border border-slate-700 transition-colors"
                            >
                                Edit in Designer
                            </button>
                            <button 
                                onClick={() => onNavigate('entities', selectedEntity.originalId!)}
                                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded border border-slate-700 transition-colors"
                            >
                                Catalog
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ConceptGraph;
