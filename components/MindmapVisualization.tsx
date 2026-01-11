import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { ZoomIn, ZoomOut, RefreshCw, Maximize } from 'lucide-react';

interface MindmapVisualizationProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
    searchTerm?: string;
}

interface HierarchyNode {
    name: string;
    id: string;
    type: string;
    children?: HierarchyNode[];
    _children?: HierarchyNode[]; // For collapsing
}

const MindmapVisualization: React.FC<MindmapVisualizationProps> = ({ nodes, edges, searchTerm = '' }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

    const [rootData, setRootData] = useState<HierarchyNode | null>(null);

    // --- Data Transformation ---
    useEffect(() => {
        if (nodes.length === 0) return;

        const nodeMap = new Map<string, Node<UMLNodeData>>(nodes.map(n => [n.id, n]));
        const childrenMap = new Map<string, string[]>();
        const parentSet = new Set<string>();

        // Build Adjacency (Parent -> Children)
        edges.forEach(e => {
            const label = (e.label as string) || '';
            const isSubClass = label === 'subClassOf' || label === 'rdfs:subClassOf';
            const isType = label === 'rdf:type' || label === 'a';
            
            let parentId: string | null = null;
            let childId: string | null = null;

            // SubClassOf: Source is Child, Target is Parent
            if (isSubClass) {
                parentId = e.target;
                childId = e.source;
            } 
            // Type: Source is Instance, Target is Class (Parent)
            else if (isType) {
                parentId = e.target;
                childId = e.source;
            }

            if (parentId && childId && nodeMap.has(parentId) && nodeMap.has(childId)) {
                if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
                // Avoid duplicates
                if (!childrenMap.get(parentId)!.includes(childId)) {
                    childrenMap.get(parentId)!.push(childId);
                    parentSet.add(childId);
                }
            }
        });

        // Find Roots (Nodes that are not children of anything in this hierarchy context)
        // Prefer Classes as roots.
        const roots = nodes.filter(n => !parentSet.has(n.id) && (n.data.type === ElementType.OWL_CLASS));
        
        // If no class roots found, look for any unconnected nodes or use all classes
        let effectiveRoots = roots.length > 0 ? roots : nodes.filter(n => n.data.type === ElementType.OWL_CLASS);
        if (effectiveRoots.length === 0) effectiveRoots = nodes; // Fallback to everything

        const traverse = (nodeId: string, visited: Set<string>): HierarchyNode => {
            const node = nodeMap.get(nodeId)!;
            const hNode: HierarchyNode = {
                name: node.data.label,
                id: node.id,
                type: node.data.type,
                children: []
            };

            if (visited.has(nodeId)) return { ...hNode, name: `${hNode.name} (cycle)`, children: undefined };
            visited.add(nodeId);

            const kids = childrenMap.get(nodeId) || [];
            if (kids.length > 0) {
                hNode.children = kids.map(kidId => traverse(kidId, new Set(visited)));
            } else {
                hNode.children = undefined;
            }
            return hNode;
        };

        let hierarchy: HierarchyNode;
        if (effectiveRoots.length === 1) {
            hierarchy = traverse(effectiveRoots[0].id, new Set());
        } else {
            // Virtual Root
            hierarchy = {
                name: "Ontology Root",
                id: "virtual-root",
                type: "root",
                children: effectiveRoots.map(r => traverse(r.id, new Set()))
            };
        }

        setRootData(hierarchy);
    }, [nodes, edges]);

    // --- D3 Rendering ---
    useEffect(() => {
        if (!rootData || !svgRef.current || !containerRef.current) return;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const g = svg.append("g");
        gRef.current = g;

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => g.attr("transform", event.transform));
        zoomRef.current = zoom;
        svg.call(zoom);

        // Center initially
        svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2 - 50, height / 2).scale(1));

        const root = d3.hierarchy(rootData);
        
        const update = (source: any) => {
            const treeLayout = d3.tree().nodeSize([30, 150]); // height, width spacing
            treeLayout(root as any);

            // Compute the new tree layout.
            const nodes = root.descendants().reverse();
            const links = root.links();

            // Normalize for fixed-depth.
            nodes.forEach((d: any) => { d.y = d.depth * 180; });

            // --- Nodes ---
            const node = g.selectAll<SVGGElement, d3.HierarchyNode<HierarchyNode>>("g.node")
                .data(nodes, (d: any) => d.data.id);

            const nodeEnter = node.enter().append("g")
                .attr("class", "node")
                .attr("transform", (d: any) => `translate(${source.y0 || 0},${source.x0 || 0})`)
                .on("click", (event, d) => {
                    if (d.children) {
                        (d as any)._children = d.children;
                        d.children = null;
                    } else {
                        d.children = (d as any)._children;
                        (d as any)._children = null;
                    }
                    update(d);
                });

            nodeEnter.append("circle")
                .attr("r", 10)
                .style("fill", (d: any) => {
                    if (d.data.type === ElementType.OWL_CLASS) return "#6366f1"; // Indigo
                    if (d.data.type === ElementType.OWL_NAMED_INDIVIDUAL) return "#ec4899"; // Pink
                    return "#64748b";
                })
                .style("stroke", "#1e293b")
                .style("stroke-width", 2)
                .style("cursor", "pointer");

            nodeEnter.append("text")
                .attr("dy", ".35em")
                .attr("x", (d: any) => d.children || (d as any)._children ? -15 : 15)
                .attr("text-anchor", (d: any) => d.children || (d as any)._children ? "end" : "start")
                .text((d: any) => d.data.name)
                .style("fill", "#cbd5e1")
                .style("font-size", "12px")
                .style("font-family", "sans-serif")
                .style("text-shadow", "2px 2px 4px #0f172a");

            const nodeUpdate = nodeEnter.merge(node);
            
            nodeUpdate.transition().duration(200)
                .attr("transform", (d: any) => `translate(${d.y},${d.x})`);

            // Apply Search Highlighting
            nodeUpdate.select("circle")
                .style("fill", (d: any) => {
                    const match = searchTerm && d.data.name.toLowerCase().includes(searchTerm.toLowerCase());
                    if (match) return "#facc15"; // Yellow for match
                    if (d._children) return "#fbbf24";
                    if (d.data.type === ElementType.OWL_CLASS) return "#6366f1";
                    if (d.data.type === ElementType.OWL_NAMED_INDIVIDUAL) return "#ec4899";
                    return "#64748b";
                })
                .style("stroke", (d: any) => {
                    const match = searchTerm && d.data.name.toLowerCase().includes(searchTerm.toLowerCase());
                    return match ? "#fff" : "#1e293b";
                })
                .style("stroke-width", (d: any) => {
                    const match = searchTerm && d.data.name.toLowerCase().includes(searchTerm.toLowerCase());
                    return match ? 3 : 2;
                });
            
            // Dim text if searching
            nodeUpdate.select("text")
                .style("opacity", (d: any) => {
                    if (!searchTerm) return 1;
                    return d.data.name.toLowerCase().includes(searchTerm.toLowerCase()) ? 1 : 0.3;
                })
                .style("font-weight", (d: any) => {
                    if (searchTerm && d.data.name.toLowerCase().includes(searchTerm.toLowerCase())) return "bold";
                    return "normal";
                });

            const nodeExit = node.exit().transition().duration(200)
                .attr("transform", (d: any) => `translate(${source.y},${source.x})`)
                .remove();
            
            nodeExit.select("circle").attr("r", 1e-6);
            nodeExit.select("text").style("fill-opacity", 1e-6);

            // --- Links ---
            const link = g.selectAll<SVGPathElement, d3.HierarchyLink<HierarchyNode>>("path.link")
                .data(links, (d: any) => d.target.data.id);

            const linkEnter = link.enter().insert("path", "g")
                .attr("class", "link")
                .attr("d", (d: any) => {
                    const o = { x: source.x0 || 0, y: source.y0 || 0 };
                    return diagonal(o, o);
                })
                .style("fill", "none")
                .style("stroke", "#475569")
                .style("stroke-width", 1.5);

            const linkUpdate = linkEnter.merge(link);
            
            linkUpdate.transition().duration(200)
                .attr("d", (d: any) => diagonal(d.source, d.target));
            
            // Dim links on search
            linkUpdate.style("opacity", searchTerm ? 0.1 : 1);

            link.exit().transition().duration(200)
                .attr("d", (d: any) => {
                    const o = { x: source.x, y: source.y };
                    return diagonal(o, o);
                })
                .remove();

            nodes.forEach((d: any) => {
                d.x0 = d.x;
                d.y0 = d.y;
            });
        };

        // Helper for curved paths
        const diagonal = (s: any, d: any) => {
            return `M ${s.y} ${s.x}
                    C ${(s.y + d.y) / 2} ${s.x},
                      ${(s.y + d.y) / 2} ${d.x},
                      ${d.y} ${d.x}`;
        };

        // Initialize root position
        (root as any).x0 = height / 2;
        (root as any).y0 = 0;

        update(root);

    }, [rootData, searchTerm]);

    const handleZoomIn = useCallback(() => {
        if (!svgRef.current || !zoomRef.current) return;
        d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.3);
    }, []);

    const handleZoomOut = useCallback(() => {
        if (!svgRef.current || !zoomRef.current) return;
        d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.7);
    }, []);

    const handleFitView = useCallback(() => {
         // Re-center basic logic
         if (!svgRef.current || !zoomRef.current || !containerRef.current) return;
         const width = containerRef.current.clientWidth;
         const height = containerRef.current.clientHeight;
         d3.select(svgRef.current).transition().duration(750).call(
             zoomRef.current.transform,
             d3.zoomIdentity.translate(width / 5, height / 2).scale(1)
         );
    }, []);

    return (
        <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden">
             {/* Controls */}
            <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2">
                <div className="bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-1 shadow-lg flex flex-col gap-1">
                    <button onClick={handleZoomIn} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">
                        <ZoomIn size={20} />
                    </button>
                    <button onClick={handleZoomOut} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">
                        <ZoomOut size={20} />
                    </button>
                    <div className="h-px bg-slate-700 mx-1 my-0.5"></div>
                    <button onClick={handleFitView} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">
                        <Maximize size={20} />
                    </button>
                </div>
            </div>

            <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur border border-slate-800 p-3 rounded-lg text-xs text-slate-300 pointer-events-none">
                 <h3 className="font-bold mb-2 text-slate-500 uppercase tracking-wider text-[10px]">Hierarchy</h3>
                 <div className="flex items-center gap-2 mb-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Class</div>
                 <div className="flex items-center gap-2 mb-1"><span className="w-2.5 h-2.5 rounded-full bg-pink-500"></span> Individual</div>
                 <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Collapsed</div>
            </div>

            <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing touch-none" />
        </div>
    );
};

export default MindmapVisualization;