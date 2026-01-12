
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { ZoomIn, ZoomOut, RefreshCw, Maximize, Brain } from 'lucide-react';

interface MindmapVisualizationProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
    searchTerm?: string;
    selectedNodeId?: string | null;
    onNavigate?: (view: string, id: string) => void;
}

interface HierarchyNode {
    name: string;
    id: string;
    type: string;
    isInferred?: boolean;
    children?: HierarchyNode[];
    _children?: HierarchyNode[]; // For collapsing
}

const MindmapVisualization: React.FC<MindmapVisualizationProps> = ({ nodes, edges, searchTerm = '', selectedNodeId, onNavigate }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

    const [rootData, setRootData] = useState<HierarchyNode | null>(null);

    // --- Data Transformation ---
    useEffect(() => {
        if (nodes.length === 0) return;

        const nodeMap = new Map<string, Node<UMLNodeData>>(nodes.map(n => [n.id, n]));
        const childrenMap = new Map<string, { id: string, isInferred: boolean }[]>();
        const parentSet = new Set<string>();

        // Build Adjacency (Parent -> Children)
        edges.forEach(e => {
            const label = (e.label as string) || '';
            const isSubClass = label === 'subClassOf' || label === 'rdfs:subClassOf';
            const isType = label === 'rdf:type' || label === 'a';
            const isInferred = e.data?.isInferred || false;
            
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
                // Avoid duplicates based on ID
                const existing = childrenMap.get(parentId)!.find(c => c.id === childId);
                if (!existing) {
                    childrenMap.get(parentId)!.push({ id: childId, isInferred });
                    parentSet.add(childId);
                }
            }
        });

        // Find Roots
        const roots = nodes.filter(n => !parentSet.has(n.id) && (n.data.type === ElementType.OWL_CLASS));
        let effectiveRoots = roots.length > 0 ? roots : nodes.filter(n => n.data.type === ElementType.OWL_CLASS);
        if (effectiveRoots.length === 0) effectiveRoots = nodes;

        const traverse = (nodeId: string, visited: Set<string>, inferredRel: boolean): HierarchyNode => {
            const node = nodeMap.get(nodeId)!;
            const hNode: HierarchyNode = {
                name: node.data.label,
                id: node.id,
                type: node.data.type,
                isInferred: inferredRel,
                children: []
            };

            if (visited.has(nodeId)) return { ...hNode, name: `${hNode.name} (cycle)`, children: undefined };
            visited.add(nodeId);

            const kids = childrenMap.get(nodeId) || [];
            if (kids.length > 0) {
                hNode.children = kids.map(kid => traverse(kid.id, new Set(visited), kid.isInferred));
            } else {
                hNode.children = undefined;
            }
            return hNode;
        };

        let hierarchy: HierarchyNode;
        if (effectiveRoots.length === 1) {
            hierarchy = traverse(effectiveRoots[0].id, new Set(), false);
        } else {
            // Virtual Root
            hierarchy = {
                name: "Ontology Root",
                id: "virtual-root",
                type: "root",
                children: effectiveRoots.map(r => traverse(r.id, new Set(), false))
            };
        }

        setRootData(hierarchy);
    }, [nodes, edges]);

    // --- D3 Rendering (Structure Only) ---
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
            const treeLayout = d3.tree().nodeSize([35, 160]);
            treeLayout(root as any);

            const nodes = root.descendants().reverse();
            const links = root.links();

            nodes.forEach((d: any) => { d.y = d.depth * 180; });

            // --- Nodes ---
            const node = g.selectAll<SVGGElement, d3.HierarchyNode<HierarchyNode>>("g.node")
                .data(nodes, (d: any) => d.data.id);

            const nodeEnter = node.enter().append("g")
                .attr("class", "node")
                .attr("transform", (d: any) => `translate(${source.y0 || 0},${source.x0 || 0})`)
                .on("click", (event, d) => {
                    // Trigger Selection for Properties Panel
                    if (d.data.id && d.data.id !== 'virtual-root' && onNavigate) {
                        onNavigate('mindmap', d.data.id);
                    }
                    
                    // Toggle Children
                    if (d.children) {
                        (d as any)._children = d.children;
                        d.children = null;
                    } else {
                        d.children = (d as any)._children;
                        (d as any)._children = null;
                    }
                    update(d);
                    event.stopPropagation();
                });

            // Circle
            nodeEnter.append("circle")
                .attr("r", 10)
                .style("fill", (d: any) => {
                    if (d.data.type === ElementType.OWL_CLASS) return "#6366f1"; // Indigo
                    if (d.data.type === ElementType.OWL_NAMED_INDIVIDUAL) return "#ec4899"; // Pink
                    return "#64748b";
                })
                .style("stroke", (d: any) => d.data.isInferred ? "#fbbf24" : "#1e293b")
                .style("stroke-width", (d: any) => d.data.isInferred ? 3 : 2)
                .style("cursor", "pointer");

            // Text Label
            const textGroup = nodeEnter.append("text")
                .attr("dy", ".35em")
                .attr("x", (d: any) => d.children || (d as any)._children ? -15 : 15)
                .attr("text-anchor", (d: any) => d.children || (d as any)._children ? "end" : "start")
                .style("fill", (d: any) => d.data.isInferred ? "#fbbf24" : "#cbd5e1")
                .style("font-size", "12px")
                .style("font-family", "sans-serif")
                .style("text-shadow", "2px 2px 4px #0f172a")
                .style("cursor", "pointer");
            
            textGroup.append("tspan")
                .text((d: any) => d.data.name);

            const nodeUpdate = nodeEnter.merge(node);
            
            nodeUpdate.transition().duration(200)
                .attr("transform", (d: any) => `translate(${d.y},${d.x})`);

            nodeUpdate.select("text")
                .attr("x", (d: any) => d.children || (d as any)._children ? -15 : 15)
                .attr("text-anchor", (d: any) => d.children || (d as any)._children ? "end" : "start");

            // Highlight selected
            nodeUpdate.select("circle")
                .style("stroke", (d: any) => d.data.id === selectedNodeId ? "#ffffff" : (d.data.isInferred ? "#fbbf24" : "#1e293b"))
                .style("stroke-width", (d: any) => d.data.id === selectedNodeId ? 3 : (d.data.isInferred ? 3 : 2));

            const nodeExit = node.exit().transition().duration(200)
                .attr("transform", (d: any) => `translate(${source.y},${source.x})`)
                .remove();
            
            nodeExit.select("circle").attr("r", 1e-6);
            nodeExit.select("text").style("fill-opacity", 1e-6);

            const link = g.selectAll<SVGPathElement, d3.HierarchyLink<HierarchyNode>>("path.link")
                .data(links, (d: any) => d.target.data.id);

            const linkEnter = link.enter().insert("path", "g")
                .attr("class", "link")
                .attr("d", (d: any) => {
                    const o = { x: source.x0 || 0, y: source.y0 || 0 };
                    return diagonal(o, o);
                })
                .style("fill", "none")
                .style("stroke", (d: any) => d.target.data.isInferred ? "#fbbf24" : "#475569")
                .style("stroke-width", 1.5)
                .style("stroke-dasharray", (d: any) => d.target.data.isInferred ? "4,4" : "none")
                .style("opacity", (d: any) => d.target.data.isInferred ? 0.8 : 1);

            const linkUpdate = linkEnter.merge(link);
            
            linkUpdate.transition().duration(200)
                .attr("d", (d: any) => diagonal(d.source, d.target));

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

        const diagonal = (s: any, d: any) => {
            return `M ${s.y} ${s.x}
                    C ${(s.y + d.y) / 2} ${s.x},
                      ${(s.y + d.y) / 2} ${d.x},
                      ${d.y} ${d.x}`;
        };

        (root as any).x0 = height / 2;
        (root as any).y0 = 0;

        update(root);

    }, [rootData, selectedNodeId]); // Add selectedNodeId to dependency to re-render highlights

    // --- Styling & Selection Effect ---
    useEffect(() => {
        if (!gRef.current) return;

        // Apply Search Highlight
        gRef.current.selectAll("g.node").each(function(d: any) {
            const el = d3.select(this);
            const isMatch = searchTerm && d.data.name.toLowerCase().includes(searchTerm.toLowerCase());
            
            el.select("text")
                .style("fill", () => {
                    if (isMatch) return "#facc15";
                    return d.data.isInferred ? "#fbbf24" : "#cbd5e1";
                })
                .style("font-weight", () => isMatch ? "bold" : "normal");
        });

    }, [searchTerm]);

    const handleZoomIn = useCallback(() => {
        if (!svgRef.current || !zoomRef.current) return;
        d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.3);
    }, []);

    const handleZoomOut = useCallback(() => {
        if (!svgRef.current || !zoomRef.current) return;
        d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.7);
    }, []);

    const handleFitView = useCallback(() => {
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
            <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2">
                <div className="bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg p-1 shadow-lg flex flex-col gap-1">
                    <button onClick={handleZoomIn} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><ZoomIn size={20}/></button>
                    <button onClick={handleZoomOut} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><ZoomOut size={20}/></button>
                    <div className="h-px bg-slate-700 mx-1 my-0.5"></div>
                    <button onClick={handleFitView} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"><Maximize size={20}/></button>
                </div>
            </div>
            <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing touch-none" />
        </div>
    );
};

export default MindmapVisualization;
