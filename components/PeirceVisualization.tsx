
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { ZoomIn, ZoomOut, Maximize, Scroll, RefreshCw, Feather, Brain, Eraser } from 'lucide-react';

interface PeirceVisualizationProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
}

// --- Theme Colors (Clean Technical Style) ---
const THEME = {
    bg: '#0f172a', // slate-950
    line: '#94a3b8', // slate-400
    lineInferred: '#fbbf24', // amber-400
    nodeText: '#f8fafc', // slate-50
    nodeSub: '#64748b', // slate-500
    cutStroke: '#475569', // slate-600
    spot: '#ec4899', // pink-500
    predicate: '#60a5fa', // blue-400
    panelBg: '#1e293b', // slate-800
    panelBorder: '#334155' // slate-700
};

// --- 1. Logic Visualization (The Scrolls / Alpha Graphs) ---

const ScrollRenderer: React.FC<{ s: string, p: string, o: string, type: 'subclass' | 'disjoint', isInferred?: boolean }> = ({ s, p, o, type, isInferred }) => {
    // Renders the specific "Cut" geometry for simple axioms
    return (
        <div className="flex flex-col items-center mb-8 group relative">
            {isInferred && (
                <div className="absolute -top-2 -right-2 bg-transparent text-amber-400 p-1 z-10" title="Inferred Axiom">
                    <Brain size={14} />
                </div>
            )}
            <svg width="240" height="140" className="overflow-visible">
                
                {type === 'subclass' ? (
                    // SubClassOf(A, B) -> If A then B -> Cut( A Cut( B ) )
                    <g>
                        {/* Outer Cut (Negation of A...) */}
                        <ellipse cx="120" cy="70" rx="110" ry="60" fill="none" stroke={isInferred ? THEME.lineInferred : THEME.cutStroke} strokeWidth="1.5" strokeDasharray={isInferred ? "4,4" : ""} />
                        
                        {/* A (Antecedent) */}
                        <text x="60" y="75" textAnchor="middle" fontSize="14" fill={THEME.nodeText} fontWeight="600">{s}</text>
                        
                        {/* Inner Cut ( ... and Not B) */}
                        <ellipse cx="160" cy="70" rx="55" ry="40" fill="none" stroke={isInferred ? THEME.lineInferred : THEME.cutStroke} strokeWidth="1.5" strokeDasharray={isInferred ? "4,4" : ""} />
                        
                        {/* B (Consequent) */}
                        <text x="160" y="75" textAnchor="middle" fontSize="14" fill={THEME.nodeText} fontWeight="600">{o}</text>
                    </g>
                ) : (
                    // DisjointWith(A, B) -> Not(A and B) -> Cut( A B )
                    <g>
                        <ellipse cx="120" cy="70" rx="100" ry="55" fill="none" stroke={isInferred ? THEME.lineInferred : THEME.cutStroke} strokeWidth="1.5" strokeDasharray={isInferred ? "4,4" : ""} />
                        <text x="70" y="75" textAnchor="middle" fontSize="14" fill={THEME.nodeText} fontWeight="600">{s}</text>
                        <text x="170" y="75" textAnchor="middle" fontSize="14" fill={THEME.nodeText} fontWeight="600">{o}</text>
                    </g>
                )}
            </svg>
            <div className="text-[10px] text-slate-500 mt-2 flex gap-2 justify-center bg-slate-900 px-2 py-1 rounded border border-slate-800">
                <span className="font-mono">{type === 'subclass' ? `If ${s} then ${o}` : `Not (${s} and ${o})`}</span>
            </div>
        </div>
    );
};

// --- 2. Graph Visualization (The Sheet of Assertion / Beta Graphs) ---

const PeirceVisualization: React.FC<PeirceVisualizationProps> = ({ nodes, edges }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [showLogic, setShowLogic] = useState(false);

    // Extract TBox Axioms for the Scroll View
    const axioms = useMemo(() => {
        const list: { id: string, s: string, p: string, o: string, type: 'subclass' | 'disjoint', isInferred: boolean }[] = [];
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        
        // From Edges
        edges.forEach(e => {
            const sNode = nodeMap.get(e.source);
            const tNode = nodeMap.get(e.target);
            if (!sNode || !tNode) return;
            
            const isInferred = e.data?.isInferred || false;

            if (e.label === 'subClassOf' || e.label === 'rdfs:subClassOf') {
                list.push({ id: e.id, s: sNode.data.label, p: 'is a', o: tNode.data.label, type: 'subclass', isInferred });
            } else if (e.label === 'owl:disjointWith' || e.label === 'disjointWith') {
                list.push({ id: e.id, s: sNode.data.label, p: '!=', o: tNode.data.label, type: 'disjoint', isInferred });
            }
        });

        // From Internal Methods
        nodes.forEach(n => {
            n.data.methods.forEach(m => {
                const name = m.name.toLowerCase();
                if (name === 'subclassof') {
                    list.push({ id: `${n.id}-${m.id}`, s: n.data.label, p: 'is a', o: m.returnType, type: 'subclass', isInferred: false });
                }
                if (name === 'disjointwith') {
                    list.push({ id: `${n.id}-${m.id}`, s: n.data.label, p: '!=', o: m.returnType, type: 'disjoint', isInferred: false });
                }
            });
        });

        return list;
    }, [nodes, edges]);

    // D3 Beta Graph Render
    useEffect(() => {
        if (!svgRef.current || !containerRef.current) return;
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        const svg = d3.select(svgRef.current);
        svg.selectAll(".graph-content").remove();

        const g = svg.append("g").attr("class", "graph-content");

        // Zoom
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on("zoom", (e) => g.attr("transform", e.transform));
        svg.call(zoom);

        // --- Data Prep for Beta Graph ---
        
        const simNodes = nodes.map(n => ({
            id: n.id,
            label: n.data.label,
            type: n.data.type,
            radius: n.data.type === ElementType.OWL_NAMED_INDIVIDUAL ? 5 : 25, // Small dots for individuals
            x: n.position.x + 100,
            y: n.position.y + 100
        }));

        const nodeIds = new Set(simNodes.map(n => n.id));

        const simLinks = edges
            .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target)) // Safety Check
            .map(e => ({
                source: e.source,
                target: e.target,
                label: (typeof e.label === 'string' ? e.label : ''),
                isInferred: e.data?.isInferred || false
            }))
            .filter(l => !['subClassOf', 'rdfs:subClassOf', 'owl:disjointWith'].includes(l.label)); // Filter logic edges

        const simulation = d3.forceSimulation(simNodes as any)
            .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(180))
            .force("charge", d3.forceManyBody().strength(-400))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius(50));

        // --- Rendering ---
        
        // Define Markers
        const defs = svg.append("defs");
        defs.append("marker")
            .attr("id", "arrow-peirce")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 25)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", THEME.line);

        // Edges (Lines of Identity)
        const link = g.append("g")
            .selectAll("g")
            .data(simLinks)
            .enter().append("g");

        // Smooth Line of Identity
        link.append("path")
            .attr("class", "link-path")
            .attr("stroke", d => d.isInferred ? THEME.lineInferred : THEME.line) 
            .attr("stroke-width", d => d.isInferred ? 1.5 : 2)
            .attr("stroke-dasharray", d => d.isInferred ? "5,5" : "")
            .attr("fill", "none")
            .attr("opacity", 0.8)
            .attr("marker-end", "url(#arrow-peirce)"); // Optional, Peirce lines are often undirected but we add small arrow for readability

        // Predicate Label on Line
        const labelGroup = link.append("g").attr("class", "label-group");
        
        labelGroup.append("rect")
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("fill", THEME.bg)
            .attr("stroke", d => d.isInferred ? THEME.lineInferred : THEME.line)
            .attr("stroke-width", 1)
            .attr("opacity", 0.9);

        labelGroup.append("text")
            .text(d => d.label.replace(':', ' ').replace('owl', '').replace('rdf', ''))
            .attr("text-anchor", "middle")
            .attr("dy", "0.3em")
            .attr("font-size", "10px")
            .attr("fill", d => d.isInferred ? THEME.lineInferred : THEME.predicate)
            .attr("font-weight", "500")
            .each(function() {
                const bbox = this.getBBox();
                (this as any)._bbox = bbox;
            });
            
        labelGroup.select("rect")
            .attr("width", function() { 
                const parent = (this as unknown as Element).parentNode as Element;
                return ((parent.querySelector('text') as any)._bbox.width || 0) + 12; 
            })
            .attr("height", function() { 
                const parent = (this as unknown as Element).parentNode as Element;
                return ((parent.querySelector('text') as any)._bbox.height || 0) + 6; 
            })
            .attr("x", function() { 
                const parent = (this as unknown as Element).parentNode as Element;
                return -(((parent.querySelector('text') as any)._bbox.width || 0) + 12) / 2; 
            })
            .attr("y", function() { 
                const parent = (this as unknown as Element).parentNode as Element;
                return -(((parent.querySelector('text') as any)._bbox.height || 0) + 6) / 2; 
            });

        // Nodes (Terminals)
        const node = g.append("g")
            .selectAll("g")
            .data(simNodes)
            .enter().append("g")
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
                }));

        node.each(function(d) {
            const el = d3.select(this);
            
            if (d.type === ElementType.OWL_NAMED_INDIVIDUAL) {
                // Individuals are heavy spots
                el.append("circle")
                    .attr("r", 6)
                    .attr("fill", THEME.spot)
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 2);
                
                el.append("text")
                    .text(d.label)
                    .attr("dx", 12)
                    .attr("dy", 4)
                    .attr("font-weight", "600")
                    .attr("font-size", "12px")
                    .attr("fill", THEME.nodeText)
                    .style("text-shadow", "0 2px 4px rgba(0,0,0,0.8)");
            } else {
                // Classes are Text Terms (Rhemas)
                // We add a subtle background capsule for better legibility
                const bg = el.append("rect")
                    .attr("rx", 12)
                    .attr("ry", 12)
                    .attr("fill", THEME.panelBg)
                    .attr("stroke", THEME.line)
                    .attr("stroke-width", 1);

                const txt = el.append("text")
                    .text(d.label)
                    .attr("text-anchor", "middle")
                    .attr("dy", "0.3em")
                    .attr("font-size", "13px")
                    .attr("font-weight", "600")
                    .attr("fill", THEME.nodeText);
                
                const bbox = txt.node()?.getBBox();
                if (bbox) {
                    bg.attr("width", bbox.width + 24)
                      .attr("height", bbox.height + 12)
                      .attr("x", -(bbox.width + 24)/2)
                      .attr("y", -(bbox.height + 12)/2);
                }
            }
        });

        simulation.on("tick", () => {
            link.select("path")
                .attr("d", (d: any) => {
                    const dx = d.target.x - d.source.x;
                    const dy = d.target.y - d.source.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist === 0) return `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`;
                    
                    return `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`;
                });

            labelGroup.attr("transform", (d: any) => {
                const x = (d.source.x + d.target.x) / 2;
                const y = (d.source.y + d.target.y) / 2;
                return `translate(${x},${y})`;
            });

            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });

        return () => { simulation.stop(); };
    }, [nodes, edges]);

    const handleZoomIn = () => {
        if (!svgRef.current) return;
        d3.select(svgRef.current).transition().call(d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 1.3);
    };
    const handleZoomOut = () => {
        if (!svgRef.current) return;
        d3.select(svgRef.current).transition().call(d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 0.7);
    };

    return (
        <div className="relative w-full h-full flex overflow-hidden bg-slate-950 font-sans">
            {/* Main Canvas (Beta Graph) */}
            <div ref={containerRef} className="flex-1 relative h-full">
                <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
                
                {/* Canvas Controls */}
                <div className="absolute bottom-6 left-6 flex flex-col gap-2">
                    <div className="bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-1 shadow-lg flex flex-col gap-1">
                        <button onClick={handleZoomIn} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><ZoomIn size={20}/></button>
                        <button onClick={handleZoomOut} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><ZoomOut size={20}/></button>
                        <button onClick={() => window.location.reload()} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><RefreshCw size={20}/></button>
                    </div>
                </div>

                <div className="absolute top-4 right-4 pointer-events-none">
                    <div className="bg-slate-900/80 backdrop-blur border border-slate-800 p-4 rounded-lg shadow-xl text-slate-300">
                        <h1 className="font-bold text-lg text-slate-100 flex items-center gap-2 mb-2">
                            <Feather size={18} className="text-amber-500" />
                            Existential Graphs
                        </h1>
                        <div className="space-y-2 text-xs opacity-80">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-pink-500"></div> Individual (Spot)</div>
                            <div className="flex items-center gap-2"><span className="font-bold text-slate-200">Term</span> Class / Rhema</div>
                            <div className="flex items-center gap-2"><div className="w-6 h-0.5 bg-slate-400"></div> Line of Identity</div>
                            <div className="flex items-center gap-2"><div className="w-6 h-0.5 border-t-2 border-amber-400 border-dashed"></div> Inferred</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar Logic Toggle */}
            <div className={`absolute top-0 right-0 h-full bg-slate-900 border-l border-slate-800 shadow-2xl transition-all duration-300 transform z-20 ${showLogic ? 'translate-x-0 w-96' : 'translate-x-full w-0'}`}>
                <div className="p-6 h-full overflow-y-auto custom-scrollbar">
                    <h2 className="text-xl font-bold text-slate-100 mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
                        <Scroll size={20} className="text-amber-500" /> Alpha Graphs
                    </h2>
                    <div className="text-xs text-slate-400 mb-8 leading-relaxed bg-slate-800 p-4 rounded border border-slate-700">
                        <p className="mb-2">In Peirce's logic:</p>
                        <ul className="list-disc list-inside space-y-1 ml-1">
                            <li>The <strong>Sheet</strong> represents Truth.</li>
                            <li>A <strong>Cut</strong> (oval) represents Negation.</li>
                            <li>Nesting represents <span className="text-amber-400">Implication</span> (If A then B).</li>
                        </ul>
                    </div>
                    
                    <div className="space-y-6">
                        {axioms.length > 0 ? (
                            axioms.map(ax => (
                                <ScrollRenderer key={ax.id} {...ax} />
                            ))
                        ) : (
                            <div className="text-center text-xs text-slate-600 italic py-10">
                                <Eraser size={24} className="mx-auto mb-2 opacity-50" />
                                No logical axioms detected on the sheet.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Logic Toggle Button */}
            <button 
                onClick={() => setShowLogic(!showLogic)}
                className={`absolute top-6 transition-all duration-300 bg-slate-900 text-slate-200 p-3 rounded-l-lg shadow-xl border-y border-l border-slate-700 hover:bg-slate-800 flex items-center gap-2 z-30 ${showLogic ? 'right-96' : 'right-0'}`}
                title="Toggle Peirce Logic Scrolls"
            >
                {showLogic ? <Maximize size={18} /> : <Scroll size={18} />}
            </button>

        </div>
    );
};

export default PeirceVisualization;
