
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { ZoomIn, ZoomOut, RefreshCw, Maximize, Database, User, Tag, ArrowRightLeft, Plus, Check } from 'lucide-react';

interface GraphVisualizationProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
    searchTerm?: string;
    selectedNodeId?: string | null;
    onNavigate?: (view: string, id: string) => void;
    onCreateIndividual?: (classId: string, name: string, dataValues?: Record<string, string>) => void;
    baseIri?: string;
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

const GraphVisualization: React.FC<GraphVisualizationProps> = ({ nodes, edges, searchTerm = '', selectedNodeId, onNavigate, onCreateIndividual, baseIri = 'http://example.org/ontology#' }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<SVGGElement | null>(null);
    
    const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
    const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const [tooltip, setTooltip] = useState<{x: number, y: number, node: SimNode} | null>(null);
    
    // Add Individual UI
    const [newIndivName, setNewIndivName] = useState('');
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [dataPropertyValues, setDataPropertyValues] = useState<Record<string, string>>({});

    // Track selection changes to update UI state
    useEffect(() => {
        if (selectedNodeId) {
            const node = nodes.find(n => n.id === selectedNodeId);
            if (node && node.data.type === ElementType.OWL_CLASS) {
                setSelectedClassId(node.id);
                setDataPropertyValues({}); // Reset property values when class changes
            } else {
                setSelectedClassId(null);
            }
        } else {
            setSelectedClassId(null);
        }
    }, [selectedNodeId, nodes]);

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

        // Premium Gradients
        const gradClass = defs.append("radialGradient").attr("id", "grad-class").attr("cx", "50%").attr("cy", "50%").attr("r", "50%");
        gradClass.append("stop").attr("offset", "0%").attr("stop-color", "#818cf8"); // indigo-400
        gradClass.append("stop").attr("offset", "100%").attr("stop-color", "#4f46e5"); // indigo-600

        const gradIndiv = defs.append("radialGradient").attr("id", "grad-indiv").attr("cx", "50%").attr("cy", "50%").attr("r", "50%");
        gradIndiv.append("stop").attr("offset", "0%").attr("stop-color", "#2dd4bf"); // teal-400
        gradIndiv.append("stop").attr("offset", "100%").attr("stop-color", "#0f766e"); // teal-700

        const gradProp = defs.append("radialGradient").attr("id", "grad-prop").attr("cx", "50%").attr("cy", "50%").attr("r", "50%");
        gradProp.append("stop").attr("offset", "0%").attr("stop-color", "#60a5fa"); // blue-400
        gradProp.append("stop").attr("offset", "100%").attr("stop-color", "#2563eb"); // blue-600

        const gradData = defs.append("radialGradient").attr("id", "grad-data").attr("cx", "50%").attr("cy", "50%").attr("r", "50%");
        gradData.append("stop").attr("offset", "0%").attr("stop-color", "#34d399"); // emerald-400
        gradData.append("stop").attr("offset", "100%").attr("stop-color", "#059669"); // emerald-600

        // Arrowheads
        const createMarker = (id: string, color: string) => {
            defs.append("marker")
                .attr("id", id)
                .attr("viewBox", "0 -5 10 10")
                .attr("refX", 28) // Pushed back due to larger node radius + stroke
                .attr("refY", 0)
                .attr("markerWidth", 5)
                .attr("markerHeight", 5)
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
            let colorUrl = "url(#grad-class)";
            if (n.data.type === ElementType.OWL_NAMED_INDIVIDUAL) colorUrl = "url(#grad-indiv)";
            if (n.data.type === ElementType.OWL_OBJECT_PROPERTY) colorUrl = "url(#grad-prop)";
            if (n.data.type === ElementType.OWL_DATA_PROPERTY) colorUrl = "url(#grad-data)";
            if (n.data.type === ElementType.OWL_DATATYPE) colorUrl = "#f59e0b";

            return {
                id: n.id,
                label: n.data.label,
                type: n.data.type,
                iri: n.data.iri,
                description: n.data.description,
                color: colorUrl,
                radius: n.data.type === ElementType.OWL_NAMED_INDIVIDUAL ? 20 : 30,
                x: old ? old.x : (Math.random() - 0.5) * 50,
                y: old ? old.y : (Math.random() - 0.5) * 50,
                vx: old ? old.vx : 0,
                vy: old ? old.vy : 0
            };
        });

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
            .force("link", d3.forceLink<SimNode, SimLink>(newLinks).id(d => d.id).distance(180))
            .force("charge", d3.forceManyBody().strength(-600))
            .force("center", d3.forceCenter(0, 0)) 
            .force("collide", d3.forceCollide().radius((d: any) => d.radius + 30).iterations(3));

        simulationRef.current = simulation;

        // --- Render Elements ---

        // 1. Links (Curved)
        const linkSelection = linkLayer.selectAll<SVGPathElement, SimLink>("path.link-path")
            .data(newLinks, (d) => d.id)
            .join("path")
            .attr("class", "link-path")
            .attr("fill", "none")
            .attr("stroke-width", 1.5)
            .attr("stroke", d => d.isInferred ? "#fbbf24" : "#64748b")
            .attr("stroke-dasharray", d => d.isInferred ? "4,4" : "")
            .attr("marker-end", d => d.isInferred ? "url(#arrow-inferred)" : "url(#arrow-std)");

        // 2. Labels
        const labelGroupSelection = labelLayer.selectAll<SVGGElement, SimLink>("g.edge-label")
            .data(newLinks, (d) => d.id)
            .join("g")
            .attr("class", "edge-label")
            .style("pointer-events", "none");

        labelGroupSelection.append("rect")
            .attr("rx", 6)
            .attr("ry", 6)
            .attr("fill", "#0f172a")
            .attr("fill-opacity", 0.9)
            .attr("stroke-width", 1)
            .attr("stroke", d => d.isInferred ? "#fbbf24" : "#334155");

        labelGroupSelection.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.3em")
            .attr("font-size", "9px")
            .attr("font-weight", "600")
            .attr("font-family", "monospace")
            .text(d => d.label)
            .attr("fill", d => d.isInferred ? "#fbbf24" : "#94a3b8")
            .each(function(d) {
                const bbox = this.getBBox();
                const padX = 10, padY = 6;
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

        // Node Circle
        nodeGroupSelection.append("circle")
            .attr("r", d => d.radius)
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .style("fill", d => d.color)
            .style("filter", "drop-shadow(0px 4px 6px rgba(0,0,0,0.3))");

        // Icon Character (Simplified)
        nodeGroupSelection.append("text")
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .attr("fill", "rgba(255,255,255,0.9)")
            .attr("font-weight", "bold")
            .text(d => {
                if (d.type === ElementType.OWL_CLASS) return "C";
                if (d.type === ElementType.OWL_NAMED_INDIVIDUAL) return "I";
                if (d.type === ElementType.OWL_OBJECT_PROPERTY) return "OP";
                if (d.type === ElementType.OWL_DATA_PROPERTY) return "DP";
                return "";
            })
            .style("pointer-events", "none");

        // Label
        nodeGroupSelection.append("text")
            .attr("class", "node-label")
            .attr("dy", d => d.radius + 15)
            .attr("text-anchor", "middle")
            .attr("font-size", "11px")
            .attr("fill", "#cbd5e1")
            .attr("font-weight", "500")
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
            
            // Dim others
            nodeGroupSelection.transition().style("opacity", n => n.id === d.id ? 1 : 0.2);
            linkSelection.transition().style("opacity", l => 
                (l.source as SimNode).id === d.id || (l.target as SimNode).id === d.id ? 1 : 0.05
            );
            labelGroupSelection.transition().style("opacity", l => 
                (l.source as SimNode).id === d.id || (l.target as SimNode).id === d.id ? 1 : 0.05
            );
        });
        
        nodeGroupSelection.on("mouseleave", () => {
            setTooltip(null);
            nodeGroupSelection.transition().style("opacity", 1);
            linkSelection.transition().style("opacity", 1);
            labelGroupSelection.transition().style("opacity", 1);
        });

        // Apply Selection Halo
        nodeGroupSelection.select("circle")
            .attr("stroke", d => d.id === selectedNodeId ? "#fff" : "#fff")
            .attr("stroke-width", d => d.id === selectedNodeId ? 3 : 2)
            .style("filter", d => d.id === selectedNodeId ? "url(#glow)" : null);

        // Apply Search Filter
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            nodeGroupSelection.style("opacity", d => d.label.toLowerCase().includes(lower) ? 1 : 0.1);
        }

        // Ticker
        simulation.on("tick", () => {
            linkSelection.attr("d", d => {
                const s = d.source as SimNode;
                const t = d.target as SimNode;
                // Curved lines
                const dx = t.x! - s.x!;
                const dy = t.y! - s.y!;
                const dr = Math.sqrt(dx * dx + dy * dy);
                // Straight line if distance is short to avoid extreme curves, else arc
                if (dr < 100) return `M${s.x},${s.y}L${t.x},${t.y}`;
                return `M${s.x},${s.y}A${dr},${dr} 0 0,1 ${t.x},${t.y}`;
            });

            labelGroupSelection.attr("transform", d => {
                const s = d.source as SimNode;
                const t = d.target as SimNode;
                // Position label on arc midpoint approx
                const dx = t.x! - s.x!;
                const dy = t.y! - s.y!;
                // Midpoint of straight line is easy, arc is harder. Approximation:
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
            const scale = Math.max(0.1, Math.min(2, 0.85 / Math.max(bounds.width / width, bounds.height / height)));
            d3.select(svgRef.current).transition().duration(750).call(
                zoomBehaviorRef.current.transform,
                d3.zoomIdentity.translate(width / 2, height / 2).scale(scale)
            );
        }
    }, []);

    const handleAddIndividual = (e: React.FormEvent) => {
        e.preventDefault();
        if (onCreateIndividual && selectedClassId && newIndivName.trim()) {
            onCreateIndividual(selectedClassId, newIndivName.trim(), dataPropertyValues);
            setNewIndivName('');
            setDataPropertyValues({});
        }
    };

    const handlePropValueChange = (propName: string, value: string) => {
        setDataPropertyValues(prev => ({
            ...prev,
            [propName]: value
        }));
    };

    const selectedClassNode = nodes.find(n => n.id === selectedClassId);
    
    // Find relevant data properties for the selected class
    // In this app, data properties are typically stored as 'attributes' on the class node
    const classDataProperties = useMemo(() => {
        if (!selectedClassNode) return [];
        return selectedClassNode.data.attributes || [];
    }, [selectedClassNode]);

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

            {/* Instantiation Panel (Bottom Right) */}
            {selectedClassId && onCreateIndividual && (
                <div className="absolute bottom-6 right-6 z-20 animate-in slide-in-from-bottom-4 fade-in duration-300">
                    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-4 w-72 max-h-[60vh] overflow-y-auto custom-scrollbar flex flex-col">
                        <div className="flex items-center gap-2 mb-3 text-slate-200 shrink-0">
                            <User size={16} className="text-teal-400" />
                            <h3 className="font-bold text-sm">Instantiate Class</h3>
                        </div>
                        <div className="mb-3 text-xs text-slate-400 shrink-0">
                            Creating new Individual of type <span className="font-bold text-indigo-400">{selectedClassNode?.data.label}</span>
                        </div>
                        
                        <form onSubmit={handleAddIndividual} className="flex flex-col gap-3">
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                    <input 
                                        autoFocus
                                        className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500 placeholder-slate-500"
                                        placeholder="Individual Name..."
                                        value={newIndivName}
                                        onChange={(e) => setNewIndivName(e.target.value)}
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={!newIndivName.trim()}
                                        className="bg-teal-600 hover:bg-teal-500 text-white p-2 rounded disabled:opacity-50 transition-colors shadow-lg"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono break-all bg-slate-950 p-1.5 rounded border border-slate-800">
                                    {baseIri}{newIndivName.trim().replace(/\s+/g, '_') || '...'}
                                </div>
                            </div>

                            {classDataProperties.length > 0 && (
                                <div className="space-y-2 pt-2 border-t border-slate-700/50">
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Tag size={10} /> Data Properties
                                    </h4>
                                    {classDataProperties.map(attr => (
                                        <div key={attr.id} className="space-y-1">
                                            <label className="text-xs text-slate-300 font-medium block truncate" title={attr.name}>{attr.name}</label>
                                            <input 
                                                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-teal-500 placeholder-slate-600"
                                                placeholder={attr.type || "Value"}
                                                value={dataPropertyValues[attr.name] || ''}
                                                onChange={(e) => handlePropValueChange(attr.name, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="absolute top-4 right-4 z-10 pointer-events-none">
                <div className="bg-slate-900/80 backdrop-blur border border-slate-800 p-3 rounded-lg text-xs text-slate-300 shadow-xl pointer-events-auto">
                    <h3 className="font-bold mb-2 text-slate-500 uppercase tracking-wider text-[10px]">Graph Elements</h3>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-sm"></div> Class</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gradient-to-br from-teal-400 to-teal-700 shadow-sm"></div> Individual</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-sm"></div> Property</div>
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
                            {tooltip.node.type === ElementType.OWL_NAMED_INDIVIDUAL && <User size={14} className="text-teal-400" />}
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
