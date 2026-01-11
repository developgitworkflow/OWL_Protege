
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { ZoomIn, ZoomOut, RefreshCw, Maximize, Database, Layers } from 'lucide-react';

interface ConceptGraphProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
    searchTerm?: string;
}

// Custom types for the VOWL-like simulation
interface SimNode extends d3.SimulationNodeDatum {
    id: string;
    label: string;
    type: 'class' | 'individual' | 'datatype' | 'property_object' | 'property_data' | 'subclass' | 'literal';
    originalId?: string; // For linking back to ReactFlow nodes
    radius: number;
    width?: number; // For property rects
    height?: number;
    color: string;
    isProperty: boolean;
    x?: number;
    y?: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
    source: string | SimNode;
    target: string | SimNode;
    isArrow: boolean; // Only draw arrow on the second half of the link
}

const THEME = {
    class: '#6366f1', // Indigo
    individual: '#ec4899', // Pink
    datatype: '#f59e0b', // Amber
    objProp: '#3b82f6', // Blue
    dataProp: '#10b981', // Green
    literal: '#94a3b8', // Slate (Values)
    subclass: '#94a3b8', // Slate
    text: '#f8fafc',
    bg: '#0f172a'
};

const ConceptGraph: React.FC<ConceptGraphProps> = ({ nodes, edges, searchTerm = '' }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [tooltip, setTooltip] = useState<{x: number, y: number, content: string} | null>(null);
    const [showAttributes, setShowAttributes] = useState(false);

    const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);

    useEffect(() => {
        if (!svgRef.current || !containerRef.current) return;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        // --- 1. Data Transformation (The VOWL Logic) ---
        
        const simNodes: SimNode[] = [];
        const simLinks: SimLink[] = [];
        const nodeMap = new Map<string, SimNode>();

        // A. Transform Entities
        nodes.forEach(n => {
            let type: SimNode['type'] = 'class';
            let color = THEME.class;
            let radius = 35;

            if (n.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
                type = 'individual';
                color = THEME.individual;
                radius = 25;
            } else if (n.data.type === ElementType.OWL_DATATYPE) {
                type = 'datatype';
                color = THEME.datatype;
                radius = 25; // Logic handled in renderer for rect shape
            }

            const sNode: SimNode = {
                id: n.id,
                label: n.data.label,
                type,
                originalId: n.id,
                radius,
                color,
                isProperty: false,
                x: n.position.x + 100,
                y: n.position.y + 100
            };
            
            simNodes.push(sNode);
            nodeMap.set(n.id, sNode);

            // A.1 Attributes (Data Properties) - VISUALIZE AS NODES IF ENABLED
            if (showAttributes && n.data.attributes) {
                n.data.attributes.forEach((attr, idx) => {
                    const attrId = `${n.id}_attr_${idx}`;
                    const valId = `${n.id}_val_${idx}`;
                    
                    // 1. The Property Node (The Link Badge)
                    const propNode: SimNode = {
                        id: attrId,
                        label: attr.name,
                        type: 'property_data',
                        radius: 12,
                        width: attr.name.length * 6 + 12,
                        height: 18,
                        color: THEME.dataProp,
                        isProperty: true,
                        x: sNode.x! + (Math.random() - 0.5) * 50,
                        y: sNode.y! + (Math.random() - 0.5) * 50
                    };
                    simNodes.push(propNode);

                    // 2. The Value/Type Node (Leaf)
                    const isType = n.data.type === ElementType.OWL_CLASS;
                    const valLabel = attr.type || (isType ? 'Literal' : 'Value');
                    
                    const valNode: SimNode = {
                        id: valId,
                        label: valLabel,
                        type: isType ? 'datatype' : 'literal', // Class -> Datatype, Indiv -> Literal
                        radius: 15,
                        color: isType ? THEME.datatype : THEME.literal,
                        isProperty: false, // It's a terminal node
                        x: sNode.x! + (Math.random() - 0.5) * 100,
                        y: sNode.y! + (Math.random() - 0.5) * 100
                    };
                    simNodes.push(valNode);

                    // 3. Links
                    simLinks.push({ source: sNode.id, target: attrId, isArrow: false });
                    simLinks.push({ source: attrId, target: valId, isArrow: true });
                });
            }
        });

        // B. Transform Relations (Reification)
        // Instead of A -> B, we do A -> [PropNode] -> B
        edges.forEach(e => {
            const source = nodeMap.get(e.source);
            const target = nodeMap.get(e.target);
            if (!source || !target) return;

            const label = (e.label as string) || '';
            const cleanLabel = label.replace('owl:', '').replace('rdf:', '');
            
            // Determine Property Type
            const isSubClass = cleanLabel === 'subClassOf' || cleanLabel === 'rdfs:subClassOf';

            if (isSubClass) {
                // Direct link for SubClass to keep hierarchy clear, but distinct style
                simLinks.push({ source: source.id, target: target.id, isArrow: true });
                return; // Skip creating a property node for inheritance
            }

            // Create Property Node
            const propId = `prop-${e.id}`;
            let propType: SimNode['type'] = 'property_object';
            let propColor = THEME.objProp;

            if (target.type === 'datatype') {
                propType = 'property_data';
                propColor = THEME.dataProp;
            }

            // Calculate approximate text width for the rectangle
            const textWidth = cleanLabel.length * 7 + 16; 

            const propNode: SimNode = {
                id: propId,
                label: cleanLabel,
                type: propType,
                radius: 15, // Height mostly
                width: textWidth,
                height: 20,
                color: propColor,
                isProperty: true,
                x: (source.x! + target.x!) / 2,
                y: (source.y! + target.y!) / 2
            };

            simNodes.push(propNode);

            // Link Source -> Prop
            simLinks.push({ source: source.id, target: propId, isArrow: false });
            // Link Prop -> Target (Arrow here)
            simLinks.push({ source: propId, target: target.id, isArrow: true });
        });

        // --- 2. D3 Setup ---

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove(); // Clear canvas

        // Defs for Arrows
        const defs = svg.append("defs");
        
        // Standard Arrow
        defs.append("marker")
            .attr("id", "arrow-std")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 10) // Tweak based on node radius? handled in link logic
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "#64748b");

        // Subclass Arrow (Hollow Triangle)
        defs.append("marker")
            .attr("id", "arrow-sub")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 38) // Offset for class radius
            .attr("refY", 0)
            .attr("markerWidth", 8)
            .attr("markerHeight", 8)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5Z")
            .attr("fill", "white")
            .attr("stroke", "#64748b");

        const g = svg.append("g");

        // Zoom
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on("zoom", (e) => g.attr("transform", e.transform));
        svg.call(zoom);

        // Simulation
        const simulation = d3.forceSimulation(simNodes)
            .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance((d: any) => {
                // Short distance for properties, longer for hierarchy
                if (d.target.isProperty || d.source.isProperty) return 60;
                return 150;
            }))
            .force("charge", d3.forceManyBody().strength(-500))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius((d: any) => d.isProperty ? 30 : d.radius + 10).iterations(3));

        simulationRef.current = simulation;

        // --- 3. Rendering ---

        // Links
        const link = g.append("g")
            .selectAll("path")
            .data(simLinks)
            .join("path")
            .attr("stroke", "#475569")
            .attr("stroke-width", 1.5)
            .attr("fill", "none")
            .attr("marker-end", d => {
                if (!d.isArrow) return null;
                // If direct link between classes (SubClass), use specific arrow
                const src = d.source as SimNode;
                const tgt = d.target as SimNode;
                if (!src.isProperty && !tgt.isProperty) return "url(#arrow-sub)";
                return "url(#arrow-std)";
            })
            // Dashed line for pure structural links (Source -> Prop) to indicate they are part of one edge
            .attr("stroke-dasharray", d => !d.isArrow ? "3,3" : "");

        // Nodes Group
        const node = g.append("g")
            .selectAll("g")
            .data(simNodes)
            .join("g")
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

        // Draw Shapes based on Type
        node.each(function(d) {
            const el = d3.select(this);
            
            // A. Property Node (Rectangle Badge)
            if (d.isProperty) {
                const w = d.width || 60;
                const h = d.height || 20;
                
                el.append("rect")
                    .attr("x", -w / 2)
                    .attr("y", -h / 2)
                    .attr("width", w)
                    .attr("height", h)
                    .attr("rx", 4)
                    .attr("fill", d.color)
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 1.5)
                    .attr("class", "shadow-sm cursor-pointer hover:stroke-yellow-400");
                
                el.append("text")
                    .text(d.label)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .attr("font-size", "10px")
                    .attr("fill", "#fff")
                    .attr("font-weight", "bold")
                    .style("pointer-events", "none");
            } 
            // B. Datatype / Literal (Rectangle)
            else if (d.type === 'datatype' || d.type === 'literal') {
                // Adjust width based on text
                const charW = 6;
                const w = Math.max(60, d.label.length * charW + 10);
                
                el.append("rect")
                    .attr("x", -w/2)
                    .attr("y", -15)
                    .attr("width", w)
                    .attr("height", 30)
                    .attr("fill", d.color)
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 2);
                
                el.append("text")
                    .text(d.label)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .attr("font-size", "11px")
                    .attr("fill", "#fff")
                    .style("pointer-events", "none");
            }
            // C. Class / Individual (Circle)
            else {
                el.append("circle")
                    .attr("r", d.radius)
                    .attr("fill", d.color)
                    .attr("stroke", "#fff")
                    .attr("stroke-width", d.type === 'class' ? 3 : 2)
                    .attr("class", "cursor-pointer hover:stroke-yellow-400 transition-colors");

                // Label (truncated if too long)
                const displayLabel = d.label.length > 10 ? d.label.substring(0, 8) + '..' : d.label;
                
                el.append("text")
                    .text(displayLabel)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .attr("font-size", d.type === 'class' ? "12px" : "10px")
                    .attr("font-weight", "bold")
                    .attr("fill", "#fff")
                    .style("pointer-events", "none")
                    .style("text-shadow", "0px 1px 3px rgba(0,0,0,0.5)");
            }
        });

        // Hover Tooltip
        node.on('mouseenter', (event, d) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                setTooltip({
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                    content: d.label
                });
            }
        }).on('mouseleave', () => {
            setTooltip(null);
        });

        // Search Highlight
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            node.style('opacity', d => d.label.toLowerCase().includes(lower) ? 1 : 0.1);
            link.style('opacity', 0.1);
        }

        // Tick
        simulation.on("tick", () => {
            link.attr("d", (d: any) => {
                const srcR = d.source.isProperty ? 0 : (d.source.radius || 20); // Property is rect, handled by marker logic partly, but simple math here
                const tgtR = d.target.isProperty ? 0 : (d.target.radius || 20);
                
                // Simple line for now, markers handle endpoint visuals
                return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
            });

            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });

        return () => {
            simulation.stop();
        };

    }, [nodes, edges, searchTerm, showAttributes]);

    const handleZoomIn = () => {
        if (svgRef.current) d3.select(svgRef.current).transition().call(d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 1.3);
    };
    const handleZoomOut = () => {
        if (svgRef.current) d3.select(svgRef.current).transition().call(d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 0.7);
    };
    const handleFit = () => {
        // Reset zoom logic
        if (svgRef.current && containerRef.current) {
             const width = containerRef.current.clientWidth;
             const height = containerRef.current.clientHeight;
             d3.select(svgRef.current).transition().call(
                 d3.zoom<SVGSVGElement, unknown>().transform as any, 
                 d3.zoomIdentity.translate(width/2, height/2).scale(1).translate(-width/2, -height/2) // Rough center reset
             );
        }
    };

    return (
        <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden">
            <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
            
            {/* Legend */}
            <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur border border-slate-800 p-3 rounded-lg text-xs text-slate-300 shadow-xl pointer-events-none">
                <h3 className="font-bold mb-2 text-slate-500 uppercase tracking-wider text-[10px]">Concept Map</h3>
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-indigo-500 border border-white/20"></span> Class</div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-pink-500 border border-white/20"></span> Individual</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-amber-500 border border-white/20"></span> Datatype</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-2 rounded-sm bg-blue-500 border border-white/20"></span> Object Prop</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-2 rounded-sm bg-emerald-500 border border-white/20"></span> Data Prop</div>
                    {showAttributes && <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-slate-400 border border-white/20"></span> Value/Literal</div>}
                </div>
            </div>

            {/* Top Left Controls: Detail Toggle */}
            <div className="absolute top-4 left-6 flex bg-slate-800 rounded-lg p-1 border border-slate-700 shadow-xl z-20">
                <button 
                    onClick={() => setShowAttributes(!showAttributes)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded transition-all ${showAttributes ? 'bg-green-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    title="Toggle Data Properties/Attributes"
                >
                    <Database size={14} /> {showAttributes ? 'Hide' : 'Show'} Attributes
                </button>
            </div>

            {/* Zoom Controls */}
            <div className="absolute bottom-6 left-6 flex flex-col gap-2">
                <div className="bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-1 shadow-lg flex flex-col gap-1">
                    <button onClick={handleZoomIn} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><ZoomIn size={20}/></button>
                    <button onClick={handleZoomOut} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><ZoomOut size={20}/></button>
                    <button onClick={handleFit} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><Maximize size={20}/></button>
                    <button onClick={() => window.location.reload()} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><RefreshCw size={20}/></button>
                </div>
            </div>

            {/* Tooltip */}
            {tooltip && (
                <div className="absolute px-2 py-1 bg-slate-800 text-white text-xs rounded border border-slate-700 pointer-events-none z-50 transform -translate-x-1/2 -translate-y-full mt-[-10px]"
                     style={{ left: tooltip.x, top: tooltip.y }}>
                    {tooltip.content}
                </div>
            )}
        </div>
    );
};

export default ConceptGraph;
