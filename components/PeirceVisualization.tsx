
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { ZoomIn, ZoomOut, Maximize, Scroll, RefreshCw, Feather, Brain } from 'lucide-react';

interface PeirceVisualizationProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
}

// --- Theme Colors ---
const THEME = {
    bg: '#0f172a', // slate-950
    line: '#475569', // slate-600
    lineText: '#94a3b8', // slate-400
    lineTextBg: '#1e293b', // slate-800
    nodeText: '#f1f5f9', // slate-100
    individual: '#ec4899', // pink-500
    classBorder: '#6366f1', // indigo-500
    cutStroke: '#cbd5e1', // slate-300
    inferredStroke: '#fbbf24', // amber-400
    sidebarBg: '#0f172a', // slate-900
    sidebarBorder: '#334155' // slate-700
};

// --- 1. Logic Visualization (The Scrolls) ---

const ScrollRenderer: React.FC<{ s: string, p: string, o: string, type: 'subclass' | 'disjoint', isInferred?: boolean }> = ({ s, p, o, type, isInferred }) => {
    // Renders the specific "Cut" geometry for simple axioms
    return (
        <div className="flex flex-col items-center mb-6 group relative">
            {isInferred && (
                <div className="absolute top-0 right-4 bg-slate-900 border border-amber-500/50 text-amber-400 rounded-full p-1 shadow-lg z-10" title="Inferred Axiom">
                    <Brain size={12} />
                </div>
            )}
            <svg width="200" height="120" className="overflow-visible">
                <defs>
                    <filter id="scribble">
                        <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" result="noise" />
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
                    </filter>
                </defs>
                
                {type === 'subclass' ? (
                    // SubClassOf(A, B) -> If A then B -> Cut( A Cut( B ) )
                    <g filter="url(#scribble)">
                        {/* Outer Cut (Negation of A...) */}
                        <ellipse cx="100" cy="60" rx="95" ry="55" fill="none" stroke={isInferred ? THEME.inferredStroke : THEME.cutStroke} strokeWidth={isInferred ? "2.5" : "2"} strokeDasharray={isInferred ? "5,3" : ""} />
                        
                        {/* A (Antecedent) */}
                        <text x="40" y="65" textAnchor="middle" fontFamily="sans-serif" fontSize="12" fill={THEME.nodeText} fontWeight="bold">{s}</text>
                        
                        {/* Inner Cut ( ... and Not B) */}
                        <ellipse cx="140" cy="60" rx="40" ry="30" fill="none" stroke={isInferred ? THEME.inferredStroke : THEME.cutStroke} strokeWidth={isInferred ? "2.5" : "2"} strokeDasharray={isInferred ? "5,3" : ""} />
                        
                        {/* B (Consequent) */}
                        <text x="140" y="65" textAnchor="middle" fontFamily="sans-serif" fontSize="12" fill={THEME.nodeText} fontWeight="bold">{o}</text>
                    </g>
                ) : (
                    // DisjointWith(A, B) -> Not(A and B) -> Cut( A B )
                    <g filter="url(#scribble)">
                        <ellipse cx="100" cy="60" rx="90" ry="50" fill="none" stroke={isInferred ? THEME.inferredStroke : THEME.cutStroke} strokeWidth={isInferred ? "2.5" : "2"} strokeDasharray={isInferred ? "5,3" : ""} />
                        <text x="60" y="65" textAnchor="middle" fontFamily="sans-serif" fontSize="12" fill={THEME.nodeText} fontWeight="bold">{s}</text>
                        <text x="140" y="65" textAnchor="middle" fontFamily="sans-serif" fontSize="12" fill={THEME.nodeText} fontWeight="bold">{o}</text>
                    </g>
                )}
            </svg>
            <div className="text-[10px] font-mono text-slate-500 mt-2 flex gap-2 justify-center opacity-50 group-hover:opacity-100 transition-opacity">
                <span className={`px-1 rounded ${isInferred ? 'bg-amber-900/30 text-amber-400' : 'bg-slate-800'}`}>
                    {type === 'subclass' ? 'Implication' : 'Exclusion'}
                </span>
                <span className="italic">{type === 'subclass' ? `If ${s} then ${o}` : `Not (${s} and ${o})`}</span>
            </div>
        </div>
    );
};

// --- 2. Graph Visualization (The Sheet of Assertion) ---

const PeirceVisualization: React.FC<PeirceVisualizationProps> = ({ nodes, edges }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [showLogic, setShowLogic] = useState(false);

    // Extract TBox Axioms for the Scroll View
    const axioms = useMemo(() => {
        const list: { id: string, s: string, p: string, o: string, type: 'subclass' | 'disjoint', isInferred: boolean }[] = [];
        
        // From Edges
        edges.forEach(e => {
            const sNode = nodes.find(n => n.id === e.source);
            const tNode = nodes.find(n => n.id === e.target);
            if (!sNode || !tNode) return;
            
            const isInferred = e.data?.isInferred || false;

            if (e.label === 'subClassOf' || e.label === 'rdfs:subClassOf') {
                list.push({ id: e.id, s: sNode.data.label, p: 'is a', o: tNode.data.label, type: 'subclass', isInferred });
            } else if (e.label === 'owl:disjointWith' || e.label === 'disjointWith') {
                list.push({ id: e.id, s: sNode.data.label, p: '!=', o: tNode.data.label, type: 'disjoint', isInferred });
            }
        });

        // From Internal Methods (Always Explicit usually, unless we start generating methods from inference)
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
        svg.selectAll("*").remove();

        const g = svg.append("g");

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
            radius: n.data.type === ElementType.OWL_NAMED_INDIVIDUAL ? 8 : 25,
            x: n.position.x + 100,
            y: n.position.y + 100
        }));

        const simLinks = edges.map(e => ({
            source: e.source,
            target: e.target,
            label: (typeof e.label === 'string' ? e.label : ''),
            isInferred: e.data?.isInferred || false
        })).filter(l => !['subClassOf', 'rdfs:subClassOf', 'owl:disjointWith'].includes(l.label)); // Filter logic edges

        const simulation = d3.forceSimulation(simNodes as any)
            .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-500))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius(50));

        // --- Rendering ---
        
        // 1. Lines of Identity (Edges)
        const link = g.append("g")
            .selectAll("line")
            .data(simLinks)
            .enter().append("g");

        // Thick line for identity/relation
        link.append("line")
            .attr("stroke", d => d.isInferred ? THEME.inferredStroke : THEME.line) 
            .attr("stroke-width", d => d.isInferred ? 2.5 : 2)
            .attr("stroke-dasharray", d => d.isInferred ? "5,5" : "")
            .attr("opacity", 0.6);

        // Predicate Label on the line (The "Spot")
        // Use a pill shape for the relation label
        link.append("rect")
            .attr("rx", 6)
            .attr("ry", 6)
            .attr("fill", THEME.lineTextBg)
            .attr("stroke", d => d.isInferred ? THEME.inferredStroke : THEME.line)
            .attr("stroke-width", 1);
            
        link.append("text")
            .text(d => d.label.replace(':', ' ').replace('owl', '').replace('rdf', ''))
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("font-family", "ui-monospace, monospace")
            .attr("font-size", "10px")
            .attr("fill", d => d.isInferred ? THEME.inferredStroke : THEME.lineText);

        // 2. Terminals (Nodes)
        const node = g.append("g")
            .selectAll("g")
            .data(simNodes)
            .enter().append("g")
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

        // Node Visuals
        node.each(function(d) {
            const el = d3.select(this);
            
            if (d.type === ElementType.OWL_NAMED_INDIVIDUAL) {
                // Individuals are heavy dots
                el.append("circle")
                    .attr("r", 6)
                    .attr("fill", THEME.individual)
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 1.5);
                
                el.append("text")
                    .text(d.label)
                    .attr("dx", 12)
                    .attr("dy", 4)
                    .attr("font-family", "sans-serif")
                    .attr("font-weight", "bold")
                    .attr("font-size", "12px")
                    .attr("fill", THEME.nodeText);
            } else {
                // Classes are Predicate Spots
                el.append("text")
                    .text(d.label)
                    .attr("text-anchor", "middle")
                    .attr("dy", "0.35em")
                    .attr("font-family", "sans-serif")
                    .attr("font-size", "14px")
                    .attr("font-weight", "bold")
                    .attr("fill", "#fff");
                
                // Loose oval for Class spot
                el.append("ellipse")
                    .attr("rx", (d.label.length * 4) + 12)
                    .attr("ry", 18)
                    .attr("fill", "none")
                    .attr("stroke", THEME.classBorder)
                    .attr("stroke-dasharray", "4,2")
                    .attr("stroke-width", 1.5);
            }
        });

        simulation.on("tick", () => {
            link.select("line")
                .attr("x1", (d: any) => d.source.x)
                .attr("y1", (d: any) => d.source.y)
                .attr("x2", (d: any) => d.target.x)
                .attr("y2", (d: any) => d.target.y);

            link.select("text")
                .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
                .attr("y", (d: any) => (d.source.y + d.target.y) / 2);
            
            // Background rect for text readability
            link.select("rect")
                .attr("x", function() { 
                    const t = (this as unknown as Element).parentNode?.querySelector('text') as SVGTextElement;
                    const bbox = t.getBBox();
                    return bbox.x - 4;
                })
                .attr("y", function() { 
                    const t = (this as unknown as Element).parentNode?.querySelector('text') as SVGTextElement;
                    const bbox = t.getBBox();
                    return bbox.y - 2;
                })
                .attr("width", function() { 
                    const t = (this as unknown as Element).parentNode?.querySelector('text') as SVGTextElement;
                    const bbox = t.getBBox();
                    return bbox.width + 8;
                })
                .attr("height", function() { 
                    const t = (this as unknown as Element).parentNode?.querySelector('text') as SVGTextElement;
                    const bbox = t.getBBox();
                    return bbox.height + 4;
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
        <div className="relative w-full h-full flex overflow-hidden bg-slate-950">
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
                    <div className="bg-slate-900/80 backdrop-blur border border-slate-800 p-3 rounded-lg text-xs text-slate-300 shadow-xl">
                        <h1 className="font-bold text-slate-100 flex items-center gap-2">
                            <Feather size={14} className="text-amber-500" />
                            Sheet of Assertion
                        </h1>
                        <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-pink-500"></span> Individual</div>
                            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full border border-indigo-500 border-dashed"></span> Class</div>
                            <div className="flex items-center gap-2"><span className="w-4 h-0.5 bg-slate-600"></span> Line of Identity</div>
                            <div className="flex items-center gap-2"><span className="w-4 h-0.5 border-t-2 border-amber-400 border-dotted"></span> Inferred Line</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar Logic Toggle */}
            <div className={`absolute top-0 right-0 h-full bg-slate-900 border-l border-slate-800 shadow-2xl transition-all duration-300 transform z-20 ${showLogic ? 'translate-x-0 w-80' : 'translate-x-full w-0'}`}>
                <div className="p-6 h-full overflow-y-auto">
                    <h2 className="text-lg font-bold text-slate-100 mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
                        <Scroll size={18} className="text-amber-500" /> Alpha Graphs
                    </h2>
                    <p className="text-xs text-slate-400 mb-6 leading-relaxed bg-slate-950/50 p-3 rounded border border-slate-800">
                        Peirce logic visualizes implication via inclusion. A "Cut" (oval) represents negation. 
                        Nested cuts represent <span className="font-mono text-amber-400">If...Then</span>.
                        <br/><br/>
                        <span className="flex items-center gap-1"><Brain size={10} className="text-amber-400"/> Inferred axioms are dashed.</span>
                    </p>
                    
                    <div className="space-y-4">
                        {axioms.length > 0 ? (
                            axioms.map(ax => (
                                <ScrollRenderer key={ax.id} {...ax} />
                            ))
                        ) : (
                            <div className="text-center text-xs text-slate-600 italic py-10">
                                No Class Axioms detected.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Logic Toggle Button */}
            <button 
                onClick={() => setShowLogic(!showLogic)}
                className={`absolute top-6 transition-all duration-300 bg-slate-800 text-slate-200 p-3 rounded-l-lg shadow-lg border-y border-l border-slate-700 hover:bg-slate-700 flex items-center gap-2 z-30 ${showLogic ? 'right-80' : 'right-0'}`}
                title="Toggle Peirce Logic Scrolls"
            >
                {showLogic ? <Maximize size={18} /> : <Scroll size={18} />}
            </button>

        </div>
    );
};

export default PeirceVisualization;
