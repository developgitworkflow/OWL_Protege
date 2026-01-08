import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { ZoomIn, ZoomOut, RefreshCw, Move } from 'lucide-react';

interface GraphVisualizationProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
}

interface D3Node extends d3.SimulationNodeDatum {
    id: string;
    label: string;
    type: ElementType;
    color: string;
    radius: number;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
    id: string;
    label: string;
}

const GraphVisualization: React.FC<GraphVisualizationProps> = ({ nodes, edges }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoomLevel, setZoomLevel] = useState(1);

    // Color Palette matching Neo4j vibes but adapted to our theme
    const getColor = (type: ElementType) => {
        switch (type) {
            case ElementType.OWL_CLASS: return '#6366f1'; // Indigo (Classes)
            case ElementType.OWL_NAMED_INDIVIDUAL: return '#ec4899'; // Pink (Individuals)
            case ElementType.OWL_DATA_PROPERTY: return '#10b981'; // Emerald (Data Props)
            case ElementType.OWL_OBJECT_PROPERTY: return '#3b82f6'; // Blue (Object Props)
            case ElementType.OWL_DATATYPE: return '#f59e0b'; // Amber (Datatypes)
            default: return '#94a3b8'; // Slate
        }
    };

    const getRadius = (type: ElementType) => {
        switch (type) {
            case ElementType.OWL_CLASS: return 35;
            case ElementType.OWL_NAMED_INDIVIDUAL: return 25;
            default: return 20;
        }
    };

    useEffect(() => {
        if (!svgRef.current || !containerRef.current) return;

        // 1. Prepare Data
        // Deep copy to prevent mutation of props by D3
        const d3Nodes: D3Node[] = nodes.map(n => ({
            id: n.id,
            label: n.data.label,
            type: n.data.type,
            color: getColor(n.data.type),
            radius: getRadius(n.data.type),
            // Initialize position to help stability if re-rendering
            x: n.position.x,
            y: n.position.y
        }));

        const d3Links: D3Link[] = edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: (typeof e.label === 'string' ? e.label : '').replace('owl:', '').replace('rdf:', '')
        }));

        // 2. Setup SVG
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove(); // Clear previous render

        // Defs for arrows
        const defs = svg.append("defs");
        defs.append("marker")
            .attr("id", "arrowhead")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 28) // Position relative to node radius (will need dynamic adjustment or standard)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "#64748b"); // Slate-500

        // Zoom Container
        const g = svg.append("g");
        
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
                setZoomLevel(event.transform.k);
            });

        svg.call(zoom);

        // 3. Simulation
        const simulation = d3.forceSimulation(d3Nodes)
            .force("link", d3.forceLink(d3Links).id((d: any) => d.id).distance(180))
            .force("charge", d3.forceManyBody().strength(-800))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius((d: any) => d.radius + 10).iterations(2));

        // 4. Render Elements

        // Links Group
        const linkGroup = g.append("g").attr("class", "links");
        
        const link = linkGroup.selectAll("g")
            .data(d3Links)
            .join("g");

        const linkPath = link.append("path")
            .attr("stroke", "#475569")
            .attr("stroke-width", 2)
            .attr("fill", "none")
            .attr("marker-end", "url(#arrowhead)");

        // Link Labels (Neo4j style: pill background)
        const linkLabelGroup = link.append("g");
        
        const linkLabelRect = linkLabelGroup.append("rect")
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("fill", "#1e293b") // Slate-800
            .attr("stroke", "#475569")
            .attr("stroke-width", 1);

        const linkLabelText = linkLabelGroup.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.3em")
            .attr("fill", "#cbd5e1")
            .attr("font-size", "10px")
            .text(d => d.label);
        
        // Sizing the rect based on text
        linkLabelGroup.each(function() {
            const group = d3.select(this);
            const text = group.select("text").node() as SVGTextElement;
            const bbox = text.getBBox();
            group.select("rect")
                .attr("x", -bbox.width / 2 - 4)
                .attr("y", -bbox.height / 2 - 2)
                .attr("width", bbox.width + 8)
                .attr("height", bbox.height + 4);
        });


        // Nodes Group
        const node = g.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(d3Nodes)
            .join("g")
            .call(d3.drag<any, any>()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        // Node Circle
        node.append("circle")
            .attr("r", d => d.radius)
            .attr("fill", d => d.color)
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .attr("cursor", "grab");

        // Node Label
        node.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.3em")
            .attr("fill", "#fff")
            .attr("font-weight", "bold")
            .attr("font-size", d => Math.min(12, d.radius / 2) + "px") // simple scaling
            .attr("pointer-events", "none")
            .text(d => {
                const label = d.label;
                return label.length > 8 ? label.substring(0, 7) + "..." : label;
            });

        // 5. Ticks
        simulation.on("tick", () => {
            linkPath.attr("d", (d: any) => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                const dr = Math.sqrt(dx * dx + dy * dy);
                // Adjust arrow endpoint to stop at circle edge
                const r = d.target.radius + 5; 
                const offsetX = (dx * r) / dr;
                const offsetY = (dy * r) / dr;
                return `M${d.source.x},${d.source.y}L${d.target.x - offsetX},${d.target.y - offsetY}`;
            });

            linkLabelGroup.attr("transform", (d: any) => {
                const x = (d.source.x + d.target.x) / 2;
                const y = (d.source.y + d.target.y) / 2;
                // Calculate angle for rotation if desired, but horizontal usually reads better for labels
                return `translate(${x}, ${y})`; 
            });

            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });

        // Drag functions
        function dragstarted(event: any, d: any) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
            d3.select(this).select("circle").attr("cursor", "grabbing");
        }

        function dragged(event: any, d: any) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event: any, d: any) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
            d3.select(this).select("circle").attr("cursor", "grab");
        }

        return () => {
            simulation.stop();
        };
    }, [nodes, edges]);

    const handleZoomIn = () => {
        const svg = d3.select(svgRef.current);
        const zoom = d3.zoom<SVGSVGElement, unknown>();
        svg.transition().call(zoom.scaleBy, 1.2);
    };

    const handleZoomOut = () => {
        const svg = d3.select(svgRef.current);
        const zoom = d3.zoom<SVGSVGElement, unknown>();
        svg.transition().call(zoom.scaleBy, 0.8);
    };
    
    const handleFit = () => {
         // Reset zoom logic could be complex without storing zoom instance
         // Re-rendering triggers re-center due to forceCenter, simple enough for now
    };

    return (
        <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden">
             {/* Toolbar */}
             <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-1 shadow-lg flex flex-col gap-1">
                    <button onClick={handleZoomIn} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded" title="Zoom In">
                        <ZoomIn size={20} />
                    </button>
                    <button onClick={handleZoomOut} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded" title="Zoom Out">
                        <ZoomOut size={20} />
                    </button>
                    <button onClick={() => window.location.reload()} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded" title="Reset Simulation">
                        <RefreshCw size={20} />
                    </button>
                </div>
            </div>

            <div className="absolute top-4 right-4 z-10 bg-slate-900/80 backdrop-blur border border-slate-800 p-3 rounded-lg text-xs text-slate-300 pointer-events-none select-none">
                <h3 className="font-bold mb-2 text-slate-500 uppercase">Legend</h3>
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-indigo-500 border border-white"></span> Class</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-pink-500 border border-white"></span> Individual</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 border border-white"></span> Data Prop</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500 border border-white"></span> Object Prop</div>
                </div>
            </div>

            <svg ref={svgRef} className="w-full h-full cursor-move" />
        </div>
    );
};

export default GraphVisualization;