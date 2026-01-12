
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { ZoomIn, ZoomOut, RefreshCw, Maximize, Database, Layers, X, Brain, ArrowRight, Tag, Info, BookOpen, Quote, Key, GitCommit, Split, Shield, Globe, List, FolderTree, Box, Sigma, User } from 'lucide-react';

interface ConceptGraphProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
    searchTerm?: string;
    selectedNodeId?: string | null;
    onNavigate?: (view: string, id: string) => void;
}

// Custom types for the VOWL-like simulation
interface SimNode extends d3.SimulationNodeDatum {
    id: string;
    label: string;
    type: 'class' | 'individual' | 'datatype' | 'property_object' | 'property_data' | 'subclass' | 'literal' | 'disjoint';
    originalId?: string; // For linking back to ReactFlow nodes
    radius: number;
    width?: number; // For property rects
    height?: number;
    color: string;
    stroke: string;
    textColor: string;
    isProperty: boolean;
    x?: number;
    y?: number;
    iri?: string;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
    source: string | SimNode;
    target: string | SimNode;
    isArrow: boolean; // Only draw arrow on the second half of the link
    role?: 'domain' | 'range' | 'attribute' | 'value' | 'subclass' | 'instance' | 'disjoint_link'; 
    isInferred?: boolean;
    label?: string;
}

// VOWL-aligned Theme (Dark Mode Optimized)
const THEME = {
    class: '#3b82f6',        // Blue-500
    classStroke: '#60a5fa',  // Blue-400
    
    individual: '#a855f7',   // Purple-500
    individualStroke: '#c084fc', // Purple-400
    
    datatype: '#f59e0b',     // Amber-500
    datatypeStroke: '#fbbf24', // Amber-400
    
    objProp: '#60a5fa',      // Blue-400
    objPropStroke: '#93c5fd', // Blue-300
    
    dataProp: '#10b981',     // Emerald-500
    dataPropStroke: '#34d399', // Emerald-400
    
    literal: '#64748b',      // Slate-500
    literalStroke: '#94a3b8', // Slate-400
    
    disjoint: '#ef4444',     // Red-500
    
    inferred: '#fbbf24',     // Amber-400 (for inferred edges)
    inferredStroke: '#f59e0b', 

    text: '#ffffff',
    line: '#475569',         // Slate-600
    bg: '#0f172a'            // Slate-950
};

// --- DL Helper Functions ---
const toDL = (expr: string): string => {
    if (!expr) return '';
    let dl = expr;
    dl = dl.replace(/\band\b/gi, '⊓');
    dl = dl.replace(/\bor\b/gi, '⊔');
    dl = dl.replace(/\bnot\b/gi, '¬');
    dl = dl.replace(/\bsome\b/gi, '∃');
    dl = dl.replace(/\bonly\b/gi, '∀');
    dl = dl.replace(/\bvalue\b/gi, '∋');
    dl = dl.replace(/\bmin\s+(\d+)/gi, '≥$1');
    dl = dl.replace(/\bmax\s+(\d+)/gi, '≤$1');
    dl = dl.replace(/\bexactly\s+(\d+)/gi, '=$1');
    dl = dl.replace(/\bself\b/gi, 'Self');
    
    // Clean up spaces around operators
    dl = dl.replace(/\s*⊓\s*/g, ' ⊓ ');
    dl = dl.replace(/\s*⊔\s*/g, ' ⊔ ');
    
    return dl;
};

const formatDLAxiom = (methodName: string, subject: string, objectStr: string) => {
    const type = methodName.toLowerCase().replace(/[^a-z]/g, '');
    const o = toDL(objectStr);
    
    switch (type) {
        case 'subclassof': return `${subject} ⊑ ${o}`;
        case 'equivalentto':
        case 'equivalentclass': return `${subject} ≡ ${o}`;
        case 'disjointwith': return `${subject} ⊓ ${o} ⊑ ⊥`;
        
        case 'subpropertyof': return `${subject} ⊑ ${o}`;
        case 'inverseof': return `${subject} ≡ ${o}⁻`;
        case 'domain': return `∃${subject}.⊤ ⊑ ${o}`;
        case 'range': return `⊤ ⊑ ∀${subject}.${o}`;
        
        case 'type': return `${o}(${subject})`;
        case 'sameas': return `${subject} = ${o}`;
        case 'differentfrom': return `${subject} ≠ ${o}`;
        
        default: return `${subject} ${methodName} ${o}`;
    }
};

const ConceptGraph: React.FC<ConceptGraphProps> = ({ nodes, edges, searchTerm = '', selectedNodeId, onNavigate }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [tooltip, setTooltip] = useState<{x: number, y: number, content: React.ReactNode} | null>(null);
    const [showAttributes, setShowAttributes] = useState(false);
    const [selectedEntity, setSelectedEntity] = useState<SimNode | null>(null);

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
            let stroke = THEME.classStroke;
            let radius = 35; // Standard Class Radius

            if (n.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
                type = 'individual';
                color = THEME.individual;
                stroke = THEME.individualStroke;
                radius = 20; // Smaller Individuals
            } else if (n.data.type === ElementType.OWL_DATATYPE) {
                type = 'datatype';
                color = THEME.datatype;
                stroke = THEME.datatypeStroke;
                radius = 30; 
            }

            const sNode: SimNode = {
                id: n.id,
                label: n.data.label,
                type,
                originalId: n.id,
                radius,
                color,
                stroke,
                textColor: THEME.text,
                isProperty: false,
                x: n.position.x + 100,
                y: n.position.y + 100,
                iri: n.data.iri
            };
            
            simNodes.push(sNode);
            nodeMap.set(n.id, sNode);

            // A.1 Attributes (Data Properties)
            if (showAttributes && n.data.attributes) {
                n.data.attributes.forEach((attr, idx) => {
                    const attrId = `${n.id}_attr_${idx}`;
                    const valId = `${n.id}_val_${idx}`;
                    
                    const propNode: SimNode = {
                        id: attrId,
                        label: attr.name,
                        type: 'property_data',
                        radius: 12,
                        width: attr.name.length * 6 + 20,
                        height: 20,
                        color: THEME.dataProp,
                        stroke: THEME.dataPropStroke,
                        textColor: '#fff',
                        isProperty: true,
                        x: sNode.x! + (Math.random() - 0.5) * 50,
                        y: sNode.y! + (Math.random() - 0.5) * 50
                    };
                    simNodes.push(propNode);

                    const isType = n.data.type === ElementType.OWL_CLASS;
                    const valLabel = attr.type || (isType ? 'Literal' : 'Value');
                    
                    const valNode: SimNode = {
                        id: valId,
                        label: valLabel,
                        type: isType ? 'datatype' : 'literal',
                        radius: 20,
                        color: isType ? THEME.datatype : THEME.literal,
                        stroke: isType ? THEME.datatypeStroke : THEME.literalStroke,
                        textColor: isType ? '#000' : '#fff',
                        isProperty: false,
                        x: sNode.x! + (Math.random() - 0.5) * 100,
                        y: sNode.y! + (Math.random() - 0.5) * 100
                    };
                    simNodes.push(valNode);

                    simLinks.push({ source: sNode.id, target: attrId, isArrow: false, role: 'attribute', isInferred: false });
                    simLinks.push({ source: attrId, target: valId, isArrow: true, role: 'value', isInferred: false });
                });
            }
        });

        // B. Transform Relations (Reification)
        edges.forEach(e => {
            const source = nodeMap.get(e.source);
            const target = nodeMap.get(e.target);
            if (!source || !target) return;

            const label = (e.label as string) || '';
            const cleanLabel = label.replace(/^owl:/, '').replace(/^rdf:/, '').replace(/^rdfs:/, '');
            const lowerLabel = cleanLabel.toLowerCase();
            const isInferred = e.data?.isInferred || false;
            
            // 1. SubClass (Solid Line, Hollow Arrow)
            if (lowerLabel === 'subclassof') {
                simLinks.push({ source: source.id, target: target.id, isArrow: true, role: 'subclass', isInferred });
                return;
            }

            // 2. Instance Of (Dashed Line, Standard Arrow) - DIRECT LINK
            if (lowerLabel === 'type' || label === 'a') {
                simLinks.push({ source: source.id, target: target.id, isArrow: true, role: 'instance', isInferred });
                return;
            }

            // 3. Disjoint (Circular Node)
            if (lowerLabel.includes('disjoint')) {
                const disjointId = `disjoint-${e.id}`;
                const disjointNode: SimNode = {
                    id: disjointId,
                    label: '⊥',
                    type: 'disjoint',
                    radius: 15,
                    color: THEME.bg,
                    stroke: isInferred ? THEME.inferredStroke : THEME.disjoint,
                    textColor: isInferred ? THEME.inferred : THEME.disjoint,
                    isProperty: false,
                    x: (source.x! + target.x!) / 2,
                    y: (source.y! + target.y!) / 2
                };
                simNodes.push(disjointNode);
                simLinks.push({ source: source.id, target: disjointId, isArrow: false, role: 'disjoint_link', isInferred });
                simLinks.push({ source: target.id, target: disjointId, isArrow: false, role: 'disjoint_link', isInferred });
                return;
            }

            // 4. Object/Data Properties (Rectangular Node)
            const propId = `prop-${e.id}`;
            let propType: SimNode['type'] = 'property_object';
            let propColor = isInferred ? THEME.inferred : THEME.objProp;
            let propStroke = isInferred ? THEME.inferredStroke : THEME.objPropStroke;

            if (target.type === 'datatype') {
                propType = 'property_data';
                propColor = isInferred ? THEME.inferred : THEME.dataProp;
                propStroke = isInferred ? THEME.inferredStroke : THEME.dataPropStroke;
            }

            const textWidth = cleanLabel.length * 6 + 24; 

            const propNode: SimNode = {
                id: propId,
                label: cleanLabel,
                type: propType,
                radius: 12,
                width: textWidth,
                height: 22,
                color: propColor,
                stroke: propStroke,
                textColor: '#fff',
                isProperty: true,
                x: (source.x! + target.x!) / 2,
                y: (source.y! + target.y!) / 2
            };

            simNodes.push(propNode);

            // Link Source -> Prop (Domain)
            simLinks.push({ source: source.id, target: propId, isArrow: false, role: 'domain', isInferred });
            // Link Prop -> Target (Range)
            simLinks.push({ source: propId, target: target.id, isArrow: true, role: 'range', isInferred });
        });

        // --- Handle External Selection ---
        if (selectedNodeId) {
            const found = simNodes.find(n => n.originalId === selectedNodeId);
            if (found) setSelectedEntity(found);
        }

        // --- 2. D3 Setup ---

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove(); 

        const defs = svg.append("defs");
        
        // Filter
        const filter = defs.append("filter").attr("id", "drop-shadow").attr("height", "140%");
        filter.append("feGaussianBlur").attr("in", "SourceAlpha").attr("stdDeviation", 3).attr("result", "blur");
        filter.append("feOffset").attr("in", "blur").attr("dx", 2).attr("dy", 2).attr("result", "offsetBlur");
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode").attr("in", "offsetBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");

        // Markers
        defs.append("marker").attr("id", "arrow-std").attr("viewBox", "0 -5 10 10").attr("refX", 8).attr("refY", 0).attr("markerWidth", 5).attr("markerHeight", 5).attr("orient", "auto")
            .append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#94a3b8");

        defs.append("marker").attr("id", "arrow-sub").attr("viewBox", "0 -5 10 10").attr("refX", 38).attr("refY", 0).attr("markerWidth", 8).attr("markerHeight", 8).attr("orient", "auto")
            .append("path").attr("d", "M0,-5L10,0L0,5Z").attr("fill", "#0f172a").attr("stroke", "#94a3b8");

        defs.append("marker").attr("id", "arrow-inst").attr("viewBox", "0 -5 10 10").attr("refX", 38).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
            .append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#94a3b8");
            
        defs.append("marker").attr("id", "arrow-inf").attr("viewBox", "0 -5 10 10").attr("refX", 38).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
            .append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#fbbf24");

        const g = svg.append("g");

        const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]).on("zoom", (e) => g.attr("transform", e.transform));
        svg.call(zoom);

        const simulation = d3.forceSimulation(simNodes)
            .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance((d: any) => {
                if (d.target.isProperty || d.source.isProperty) return 80;
                if (d.role === 'instance') return 120;
                return 180;
            }))
            .force("charge", d3.forceManyBody().strength(-600))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius((d: any) => d.isProperty ? 40 : d.radius + 20).iterations(3));

        simulationRef.current = simulation;

        // --- 3. Rendering ---

        // --- Layers ---
        const boxLayer = g.append("g").attr("class", "box-layer");
        const linkGroupSelection = g.append("g").attr("class", "links");
        const nodeGroupSelection = g.append("g").attr("class", "nodes");

        // --- Class Group Box ---
        const classBoxGroup = boxLayer.append("g").style("display", "none");
        const classBoxRect = classBoxGroup.append("rect")
            .attr("fill", "rgba(99, 102, 241, 0.03)") 
            .attr("stroke", "rgba(99, 102, 241, 0.2)")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "8,4")
            .attr("rx", 24);
        const classBoxLabel = classBoxGroup.append("text")
            .attr("fill", "rgba(99, 102, 241, 0.6)")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .attr("text-anchor", "start")
            .style("text-transform", "uppercase")
            .style("letter-spacing", "2px")
            .text("Classes (TBox)");

        // --- Individual Group Box ---
        const indivBoxGroup = boxLayer.append("g").style("display", "none");
        const indivBoxRect = indivBoxGroup.append("rect")
            .attr("fill", "rgba(236, 72, 153, 0.03)") 
            .attr("stroke", "rgba(236, 72, 153, 0.2)")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "8,4")
            .attr("rx", 24);
        const indivBoxLabel = indivBoxGroup.append("text")
            .attr("fill", "rgba(236, 72, 153, 0.6)")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .attr("text-anchor", "start")
            .style("text-transform", "uppercase")
            .style("letter-spacing", "2px")
            .text("Individuals (ABox)");

        const link = linkGroupSelection
            .selectAll("g")
            .data(simLinks)
            .join("g")
            .attr("class", "link-group");

        const linkPath = link.append("path")
            .attr("stroke", (d: any) => d.isInferred ? THEME.inferredStroke : THEME.line)
            .attr("stroke-width", (d: any) => d.isInferred ? 1.5 : 1.5)
            .attr("fill", "none")
            .attr("marker-end", (d: any) => {
                if (!d.isArrow) return null;
                if (d.isInferred) return "url(#arrow-inf)";
                const src = d.source as SimNode;
                const tgt = d.target as SimNode;
                if (d.role === 'instance') return "url(#arrow-inst)";
                if (!src.isProperty && !tgt.isProperty) return "url(#arrow-sub)";
                return "url(#arrow-std)";
            })
            .attr("stroke-dasharray", (d: any) => (d.role === 'instance' || d.role === 'disjoint_link' || !d.isArrow || d.isInferred) ? "4,4" : "");

        const linkLabelGroup = link.append("g").style("display", (d: any) => d.role === 'subclass' ? 'none' : 'block');
        
        linkLabelGroup.append("rect")
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("fill", THEME.bg)
            .attr("fill-opacity", 0.8)
            .attr("stroke", (d: any) => d.isInferred ? THEME.inferredStroke : THEME.line)
            .attr("stroke-width", 0.5);

        linkLabelGroup.append("text")
            .text((d: any) => d.label)
            .attr("text-anchor", "middle")
            .attr("dy", "0.3em")
            .attr("font-size", "9px")
            .attr("fill", (d: any) => d.isInferred ? THEME.inferred : "#94a3b8")
            .each(function() {
                const bbox = this.getBBox();
                (this as any)._bbox = bbox;
            });

        linkLabelGroup.select("rect")
            .attr("width", function() { 
                const parent = (this as unknown as Element).parentNode as Element;
                return ((parent.querySelector('text') as any)._bbox.width || 0) + 6; 
            })
            .attr("height", function() { 
                const parent = (this as unknown as Element).parentNode as Element;
                return ((parent.querySelector('text') as any)._bbox.height || 0) + 4; 
            })
            .attr("x", function() { 
                const parent = (this as unknown as Element).parentNode as Element;
                return -(((parent.querySelector('text') as any)._bbox.width || 0) + 6) / 2; 
            })
            .attr("y", function() { 
                const parent = (this as unknown as Element).parentNode as Element;
                return -(((parent.querySelector('text') as any)._bbox.height || 0) + 4) / 2; 
            });

        const node = nodeGroupSelection
            .selectAll("g")
            .data(simNodes)
            .join("g")
            .attr("class", "node-group")
            .call(d3.drag<any, any>()
                .on("start", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x; d.fy = d.y;
                })
                .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
                .on("end", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null; d.fy = null;
                }));

        node.on('click', (event, d) => { event.stopPropagation(); setSelectedEntity(d); });

        node.each(function(d) {
            const el = d3.select(this);
            
            // 1. Property Node (Rectangular "Sticker")
            if (d.isProperty) {
                const w = d.width || 70;
                const h = 22;
                el.append("rect")
                    .attr("x", -w / 2)
                    .attr("y", -h / 2)
                    .attr("width", w)
                    .attr("height", h)
                    .attr("rx", 4)
                    .attr("fill", d.color)
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 1.5)
                    .style("filter", "url(#drop-shadow)")
                    .attr("class", "cursor-pointer");
                
                el.append("text")
                    .text(d.label)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .attr("font-size", "10px")
                    .attr("fill", "#fff")
                    .attr("font-weight", "bold")
                    .style("pointer-events", "none");
            } 
            // 2. Disjoint (Small Circle)
            else if (d.type === 'disjoint') {
                el.append("circle")
                    .attr("r", 12)
                    .attr("fill", THEME.bg)
                    .attr("stroke", d.stroke)
                    .attr("stroke-width", 2);
                
                el.append("text")
                    .text("⊥") // Mathematical disjoint
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .attr("font-size", "14px")
                    .attr("fill", d.textColor)
                    .attr("font-weight", "bold");
            }
            // 3. Datatype (Rectangle)
            else if (d.type === 'datatype' || d.type === 'literal') {
                const w = Math.max(80, d.label.length * 7 + 10);
                const h = 28;
                el.append("rect")
                    .attr("x", -w/2)
                    .attr("y", -h/2)
                    .attr("width", w)
                    .attr("height", h)
                    .attr("rx", 0) // Sharp corners for data/literals
                    .attr("fill", d.color)
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 2)
                    .style("filter", "url(#drop-shadow)");
                
                el.append("text")
                    .text(d.label)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .attr("font-size", "11px")
                    .attr("fill", "#000") // Black text on Amber
                    .attr("font-weight", "600")
                    .style("pointer-events", "none");
            }
            // 4. Class / Individual (Circle)
            else {
                el.append("circle")
                    .attr("r", d.radius)
                    .attr("fill", d.color)
                    .attr("stroke", "#fff") // White border
                    .attr("stroke-width", d.type === 'class' ? 3 : 2)
                    .style("filter", "url(#drop-shadow)")
                    .attr("class", "cursor-pointer");
                
                const displayLabel = d.label.length > 12 ? d.label.substring(0, 10) + '..' : d.label;
                
                el.append("text")
                    .text(displayLabel)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .attr("font-size", d.type === 'class' ? "11px" : "10px")
                    .attr("font-weight", "600")
                    .attr("fill", "#fff")
                    .style("pointer-events", "none")
                    .style("text-shadow", "0px 1px 2px rgba(0,0,0,0.8)");
            }
        });

        node.on('mouseenter', (event, d) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                setTooltip({
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                    content: (
                        <div className="flex flex-col gap-1">
                            <div className="font-bold text-sm">{d.label}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{d.iri || d.id}</div>
                            <div className="text-[10px] bg-slate-800 rounded px-1 w-fit border border-slate-700 flex items-center gap-1">
                                {d.type === 'class' ? <Database size={10} className="text-indigo-400"/> : <User size={10} className="text-pink-400"/>}
                                {d.type === 'class' ? 'Class' : 'Individual'}
                            </div>
                        </div>
                    )
                });
            }
        }).on("mouseleave", () => setTooltip(null));

        simulation.on("tick", () => {
            linkPath.attr("d", (d: any) => `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`);
            linkLabelGroup.attr("transform", (d: any) => `translate(${(d.source.x + d.target.x)/2},${(d.source.y + d.target.y)/2})`);
            node.attr("transform", d => `translate(${d.x},${d.y})`);

            // --- Update Group Boxes ---
            const padding = 40;

            // Classes Box
            const classes = simNodes.filter(n => n.type === 'class');
            if (classes.length > 0) {
                const xMin = d3.min(classes, n => (n.x || 0) - (n.width || 0)/2) || 0;
                const xMax = d3.max(classes, n => (n.x || 0) + (n.width || 0)/2) || 0;
                const yMin = d3.min(classes, n => (n.y || 0) - (n.height || 0)/2) || 0;
                const yMax = d3.max(classes, n => (n.y || 0) + (n.height || 0)/2) || 0;
                
                classBoxGroup.style("display", "block");
                classBoxRect
                    .attr("x", xMin - padding)
                    .attr("y", yMin - padding - 10)
                    .attr("width", Math.max(200, xMax - xMin + padding * 2))
                    .attr("height", yMax - yMin + padding * 2 + 10);
                
                classBoxLabel
                    .attr("x", xMin - padding + 10)
                    .attr("y", yMin - padding - 20);
            } else {
                classBoxGroup.style("display", "none");
            }

            // Individuals Box
            const indivs = simNodes.filter(n => n.type === 'individual');
            if (indivs.length > 0) {
                const xMin = d3.min(indivs, n => (n.x || 0) - (n.radius || 20)) || 0;
                const xMax = d3.max(indivs, n => (n.x || 0) + (n.radius || 20)) || 0;
                const yMin = d3.min(indivs, n => (n.y || 0) - (n.radius || 20)) || 0;
                const yMax = d3.max(indivs, n => (n.y || 0) + (n.radius || 20)) || 0;
                
                indivBoxGroup.style("display", "block");
                indivBoxRect
                    .attr("x", xMin - padding)
                    .attr("y", yMin - padding - 10)
                    .attr("width", Math.max(200, xMax - xMin + padding * 2))
                    .attr("height", yMax - yMin + padding * 2 + 10);
                
                indivBoxLabel
                    .attr("x", xMin - padding + 10)
                    .attr("y", yMin - padding - 20);
            } else {
                indivBoxGroup.style("display", "none");
            }
        });

        return () => {
            simulation.stop();
        };

    }, [nodes, edges, searchTerm, showAttributes, selectedNodeId]); // Re-run on selection

    const handleZoomIn = () => { if (svgRef.current) d3.select(svgRef.current).transition().call(d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 1.3); };
    const handleZoomOut = () => { if (svgRef.current) d3.select(svgRef.current).transition().call(d3.zoom<SVGSVGElement, unknown>().scaleBy as any, 0.7); };
    const handleFit = () => {
        if (svgRef.current && containerRef.current) {
             const width = containerRef.current.clientWidth;
             const height = containerRef.current.clientHeight;
             d3.select(svgRef.current).transition().call(d3.zoom<SVGSVGElement, unknown>().transform as any, d3.zoomIdentity.translate(width/2, height/2).scale(1).translate(-width/2, -height/2));
        }
    };

    const handleDownload = () => {
        if (!containerRef.current) return;
        const svg = containerRef.current.querySelector('svg');
        if (svg) {
            const svgData = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'ontomap.svg';
            link.click();
        }
    };

    const highlightSyntax = (text: string) => {
        if (!text) return null;
        const parts = text.split(/(\b(?:some|only|value|min|max|exactly|that|not|and|or)\b)/g);
        return parts.map((part, i) => {
            if (['some', 'only', 'value', 'min', 'max', 'exactly', 'that', 'not', 'and', 'or'].includes(part.toLowerCase())) {
                return <span key={i} className="text-purple-400 font-bold">{part}</span>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    const selectedDetails = useMemo(() => {
        if (!selectedEntity) return null;
        let originalNode = nodes.find(n => n.id === selectedEntity.originalId);
        if (!originalNode && selectedEntity.isProperty) {
            originalNode = nodes.find(n => n.data.label === selectedEntity.label && (n.data.type === ElementType.OWL_OBJECT_PROPERTY || n.data.type === ElementType.OWL_DATA_PROPERTY));
        }
        const connectedEdges = edges.filter(e => {
            if (originalNode) return e.source === originalNode.id || e.target === originalNode.id;
            return false;
        });
        const inferred = connectedEdges.filter(e => e.data?.isInferred);
        const tboxAxioms: any[] = [];
        const rboxAxioms: any[] = [];
        const aboxAxioms: any[] = [];

        if (originalNode) {
            if (originalNode.data.methods) {
                originalNode.data.methods.forEach(m => {
                    const name = m.name.toLowerCase().replace(/[^a-z]/g, '');
                    if (['subclassof', 'equivalentto', 'disjointwith', 'disjointunionof', 'haskey', 'oneof', 'unionof', 'intersectionof'].includes(name)) {
                        tboxAxioms.push(m);
                    } else if (['subpropertyof', 'inverseof', 'propertychainaxiom', 'domain', 'range'].includes(name)) {
                        rboxAxioms.push(m);
                    } else if (['type', 'sameas', 'differentfrom'].includes(name)) {
                        aboxAxioms.push(m);
                    } else {
                        if (originalNode?.data.type === ElementType.OWL_CLASS) tboxAxioms.push(m);
                        else if (originalNode?.data.type === ElementType.OWL_OBJECT_PROPERTY) rboxAxioms.push(m);
                        else aboxAxioms.push(m);
                    }
                });
            }
            if (originalNode.data.attributes) {
                originalNode.data.attributes.forEach(attr => {
                    if (originalNode?.data.type === ElementType.OWL_OBJECT_PROPERTY || originalNode?.data.type === ElementType.OWL_DATA_PROPERTY) {
                        rboxAxioms.push({ id: attr.id, name: attr.name, returnType: 'True', isCharacteristic: true });
                    }
                });
            }
        }

        return {
            node: originalNode,
            simNode: selectedEntity,
            inferredEdges: inferred,
            assertedEdges: connectedEdges.filter(e => !e.data?.isInferred),
            tbox: tboxAxioms,
            rbox: rboxAxioms,
            abox: aboxAxioms
        };
    }, [selectedEntity, nodes, edges]);

    const getNodeLabel = (id: string) => nodes.find(n => n.id === id)?.data.label || id;

    // Focus Logic
    useEffect(() => {
        if (selectedNodeId && svgRef.current && containerRef.current && simulationRef.current) {
            const node = simulationRef.current.nodes().find(n => n.originalId === selectedNodeId);
            if (node && node.x !== undefined && node.y !== undefined) {
                const width = containerRef.current.clientWidth;
                const height = containerRef.current.clientHeight;
                const scale = 1.2;
                const transform = d3.zoomIdentity.translate(width / 2, height / 2).scale(scale).translate(-node.x, -node.y);
                d3.select(svgRef.current).transition().duration(750).call(d3.zoom<SVGSVGElement, unknown>().transform as any, transform);
            }
        }
    }, [selectedNodeId]);

    return (
        <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden">
            <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" onClick={() => setSelectedEntity(null)} />
            
            {/* Legend */}
            <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur border border-slate-800 p-3 rounded-lg text-xs text-slate-300 shadow-xl pointer-events-none">
                <h3 className="font-bold mb-2 text-slate-500 uppercase tracking-wider text-[10px]">VOWL Notation</h3>
                <div className="space-y-2">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white/80"></span> Class</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-2 rounded bg-blue-400 border border-white/80"></span> Object Property</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-amber-500 border border-white/80"></span> Datatype</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-2 rounded bg-emerald-500 border border-white/80"></span> Data Property</div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-purple-500 border border-white/80"></span> Individual</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-0 border-t border-dashed border-slate-400"></div> Instantiation</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-0 border-t border-dashed border-amber-400"></div> Inferred</div>
                    {showAttributes && <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-slate-600 border border-slate-400"></span> Literal</div>}
                </div>
            </div>

            {/* Controls */}
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

            {/* Entity Details Overlay */}
            {selectedEntity && (
                <div className="absolute top-4 right-44 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-right-10 fade-in duration-200 z-30">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-start bg-slate-900">
                        <div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                {selectedDetails?.node?.data.type ? selectedDetails.node.data.type.replace('owl_', '') : selectedEntity.type}
                            </div>
                            <h2 className="text-xl font-bold text-white break-words">{selectedEntity.label}</h2>
                            {selectedDetails?.node?.data.iri && (
                                <div className="text-[10px] text-slate-500 font-mono mt-1 break-all">
                                    {selectedDetails.node.data.iri}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 items-start">
                            {selectedDetails?.node && onNavigate && (
                                <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg border border-slate-800">
                                    <button onClick={() => onNavigate('entities', selectedDetails.node!.id)} className="text-slate-400 hover:text-blue-400 p-1 rounded hover:bg-slate-800 transition-colors" title="Catalog"><List size={14}/></button>
                                    <button onClick={() => onNavigate('design', selectedDetails.node!.id)} className="text-slate-400 hover:text-indigo-400 p-1 rounded hover:bg-slate-800 transition-colors" title="Design"><Layers size={14}/></button>
                                    <button onClick={() => onNavigate('tree', selectedDetails.node!.id)} className="text-slate-400 hover:text-emerald-400 p-1 rounded hover:bg-slate-800 transition-colors" title="Tree"><FolderTree size={14}/></button>
                                    <button onClick={() => onNavigate('uml', selectedDetails.node!.id)} className="text-slate-400 hover:text-amber-400 p-1 rounded hover:bg-slate-800 transition-colors" title="UML"><Box size={14}/></button>
                                </div>
                            )}
                            <button onClick={() => setSelectedEntity(null)} className="text-slate-500 hover:text-white transition-colors p-1">
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {/* Logic Content */}
                        {selectedDetails && selectedDetails.inferredEdges.length > 0 && (
                            <div className="bg-amber-950/20 border border-amber-900/50 rounded-lg p-3">
                                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Brain size={14} /> Reasoner Execution</h3>
                                <div className="space-y-2">
                                    {selectedDetails.inferredEdges.map((edge) => (
                                        <div key={edge.id} className="flex flex-col gap-0.5 bg-amber-900/10 p-2 rounded border border-amber-900/30">
                                            <div className="flex justify-between text-xs text-amber-200">
                                                <span className="font-bold">{edge.label}</span>
                                                <span className="opacity-70">{edge.source === selectedEntity.id ? '->' : '<-'} {getNodeLabel(edge.source === selectedEntity.id ? edge.target : edge.source)}</span>
                                            </div>
                                            <div className="text-[10px] text-amber-500/80 italic">{edge.data?.inferenceType || 'Inferred Axiom'}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedDetails?.node?.data.annotations && selectedDetails.node.data.annotations.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Info size={12} /> Annotations</h3>
                                <div className="space-y-1">
                                    {selectedDetails.node.data.annotations.map(ann => (
                                        <div key={ann.id} className="text-xs bg-slate-800/50 p-2 rounded border border-slate-800 flex justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-blue-400 font-mono text-[10px] block mb-0.5">{ann.property}</span>
                                                <span className="text-slate-300">{ann.value.replace(/"/g, '')}</span>
                                            </div>
                                            {ann.language && <span className="text-[9px] text-slate-500 self-start bg-slate-900 px-1 rounded ml-2">@{ann.language}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedDetails && selectedDetails.tbox.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Database size={12} /> TBox (Schema)</h3>
                                <div className="space-y-1">
                                    {selectedDetails.tbox.map(method => (
                                        <div key={method.id} className="text-xs bg-indigo-950/20 p-2 rounded border border-indigo-900/30">
                                            <div className="flex items-baseline gap-2 mb-0.5">
                                                {method.name.toLowerCase() === 'haskey' && <Key size={10} className="text-yellow-400" />}
                                                {method.name.toLowerCase().includes('disjoint') && <Split size={10} className="text-red-400" />}
                                                <span className="text-indigo-400 font-bold text-[10px] uppercase">{method.name}</span>
                                            </div>
                                            <div className="text-slate-300 font-mono text-[11px] break-words leading-relaxed">{highlightSyntax(method.returnType)}</div>
                                            <div className="mt-1 pt-1 border-t border-indigo-900/20 text-[10px] text-slate-500 font-serif flex items-center gap-1">
                                                <Sigma size={10} /> <span className="italic">DL:</span>
                                                <span className="text-slate-400">{formatDLAxiom(method.name, selectedEntity.label, method.returnType)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedDetails && selectedDetails.rbox.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><BookOpen size={12} /> RBox (Properties)</h3>
                                <div className="space-y-1">
                                    {selectedDetails.rbox.map(method => (
                                        <div key={method.id} className="text-xs bg-blue-950/20 p-2 rounded border border-blue-900/30">
                                            <div className="flex items-baseline gap-2 mb-0.5">
                                                {method.name.toLowerCase() === 'propertychainaxiom' && <GitCommit size={10} className="text-cyan-400" />}
                                                {method.isCharacteristic && <Shield size={10} className="text-emerald-400" />}
                                                <span className={`font-bold text-[10px] uppercase ${method.isCharacteristic ? 'text-emerald-400' : 'text-blue-400'}`}>{method.name}{method.isCharacteristic ? ' Property' : ''}</span>
                                            </div>
                                            {!method.isCharacteristic && <div className="text-slate-300 font-mono text-[11px] break-words leading-relaxed">{highlightSyntax(method.returnType)}</div>}
                                            {!method.isCharacteristic && (
                                                <div className="mt-1 pt-1 border-t border-blue-900/20 text-[10px] text-slate-500 font-serif flex items-center gap-1">
                                                    <Sigma size={10} /> <span className="italic">DL:</span>
                                                    <span className="text-slate-400">{formatDLAxiom(method.name, selectedEntity.label, method.returnType)}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedDetails && selectedDetails.abox.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Globe size={12} /> ABox (Assertions)</h3>
                                <div className="space-y-1">
                                    {selectedDetails.abox.map(method => (
                                        <div key={method.id} className="text-xs bg-pink-950/20 p-2 rounded border border-pink-900/30">
                                            <div className="flex items-baseline gap-2 mb-0.5">
                                                <span className="text-pink-400 font-bold text-[10px] uppercase">{method.name}</span>
                                            </div>
                                            <div className="text-slate-300 font-mono text-[11px] break-words leading-relaxed">{highlightSyntax(method.returnType)}</div>
                                            <div className="mt-1 pt-1 border-t border-pink-900/20 text-[10px] text-slate-500 font-serif flex items-center gap-1">
                                                <Sigma size={10} /> <span className="italic">DL:</span>
                                                <span className="text-slate-400">{formatDLAxiom(method.name, selectedEntity.label, method.returnType)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedDetails && selectedDetails.assertedEdges.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><ArrowRight size={12} /> Direct Facts</h3>
                                <div className="space-y-1">
                                    {selectedDetails.assertedEdges.map(edge => {
                                        const isOutgoing = edge.source === selectedEntity.id;
                                        const otherId = isOutgoing ? edge.target : edge.source;
                                        return (
                                            <div key={edge.id} className="flex items-center justify-between text-xs bg-slate-800/50 p-2 rounded border border-slate-800">
                                                <span className="text-blue-300 font-medium">{edge.label || 'related'}</span>
                                                <div className="flex items-center gap-1 text-slate-400">
                                                    {isOutgoing ? <ArrowRight size={10} /> : <ArrowRight size={10} className="rotate-180" />}
                                                    <span>{getNodeLabel(otherId)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {!selectedDetails?.node && <div className="text-center py-8 text-slate-600 text-xs italic">Use the entity catalog or canvas tools to define detailed properties for this node.</div>}
                    </div>
                </div>
            )}

            {/* Tooltip */}
            {tooltip && !selectedEntity && (
                <div className="absolute z-50 bg-slate-900/95 border border-slate-700 p-3 rounded-lg shadow-2xl pointer-events-none transform -translate-x-1/2 min-w-[150px] text-white animate-in fade-in zoom-in-95 duration-75" style={{ left: tooltip.x, top: tooltip.y - 15 }}>
                    {tooltip.content}
                    {/* Tooltip Arrow */}
                    <div className="absolute left-1/2 -bottom-1.5 w-3 h-3 bg-slate-900 border-r border-b border-slate-700 transform rotate-45 -translate-x-1/2"></div>
                </div>
            )}
            <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing touch-none" />
        </div>
    );
};

export default ConceptGraph;
