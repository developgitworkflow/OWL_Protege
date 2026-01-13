
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { ChevronRight, ChevronDown, Database, User, Tag, ArrowRightLeft, FileType, Box, Layers, Brain } from 'lucide-react';

interface TreeVisualizationProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
    searchTerm?: string;
    selectedNodeId?: string | null;
    onNavigate?: (view: string, id: string) => void;
}

interface TreeNode {
    id: string;
    label: string;
    type: ElementType;
    isInferred?: boolean; 
    children: TreeNode[];
}

const TreeNodeItem: React.FC<{ 
    node: TreeNode; 
    level: number; 
    searchTerm: string; 
    selectedNodeId?: string | null; 
    onNavigate?: (view: string, id: string) => void 
}> = ({ node, level, searchTerm, selectedNodeId, onNavigate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedNodeId === node.id;
    const rowRef = useRef<HTMLDivElement>(null);
    
    // Check match
    const isMatch = searchTerm && node.label.toLowerCase().includes(searchTerm.toLowerCase());
    const isDimmed = searchTerm && !isMatch;

    // Auto-expand path if selected or search match
    useEffect(() => {
        if (isSelected) {
            if (rowRef.current) {
                rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [isSelected]);

    // Propagate open state up if children selected (handled via parent logic usually, but here simple expansion)
    useEffect(() => {
        if (isMatch) setIsOpen(true);
    }, [isMatch]);

    const getIcon = () => {
        switch (node.type) {
            case ElementType.OWL_CLASS: return <Database size={14} className="text-purple-400" />;
            case ElementType.OWL_NAMED_INDIVIDUAL: return <User size={14} className="text-pink-400" />;
            case ElementType.OWL_OBJECT_PROPERTY: return <ArrowRightLeft size={14} className="text-blue-400" />;
            case ElementType.OWL_DATA_PROPERTY: return <Tag size={14} className="text-green-400" />;
            case ElementType.OWL_DATATYPE: return <FileType size={14} className="text-amber-400" />;
            default: return <Box size={14} className="text-slate-400" />;
        }
    };

    return (
        <div className="select-none">
            <div 
                ref={rowRef}
                className={`flex items-center gap-2 py-1 px-2 hover:bg-slate-800 rounded cursor-pointer transition-colors group relative ${level === 0 ? 'mb-1' : ''} ${isMatch ? 'bg-yellow-900/30 border border-yellow-700/50' : ''} ${isSelected ? 'bg-blue-900/30 border-l-2 border-blue-500' : ''}`}
                style={{ paddingLeft: `${level * 16 + 8}px`, opacity: isDimmed ? 0.3 : 1 }}
                onClick={(e) => { 
                    if (hasChildren) setIsOpen(!isOpen); 
                    if (onNavigate) onNavigate('tree', node.id); 
                }}
            >
                <div className="w-4 flex items-center justify-center shrink-0">
                    {hasChildren ? (
                        isOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />
                    ) : (
                        <span className="w-4" />
                    )}
                </div>
                {getIcon()}
                <span className={`text-sm truncate ${isMatch ? 'text-yellow-200 font-bold' : (isSelected ? 'text-white font-medium' : (node.type === ElementType.OWL_NAMED_INDIVIDUAL ? 'text-pink-200' : 'text-slate-200'))} ${node.isInferred ? 'italic text-amber-300' : ''}`}>
                    {node.label}
                </span>
                {node.isInferred && (
                    <span title="Inferred by Reasoner">
                        <Brain size={10} className="text-amber-500 ml-1" />
                    </span>
                )}
            </div>
            {isOpen && hasChildren && (
                <div>
                    {node.children.map((child, idx) => (
                        <TreeNodeItem 
                            key={`${child.id}-${idx}`} 
                            node={child} 
                            level={level + 1} 
                            searchTerm={searchTerm} 
                            selectedNodeId={selectedNodeId}
                            onNavigate={onNavigate}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const TreeSection: React.FC<{ 
    title: string; 
    icon: React.ReactNode; 
    nodes: TreeNode[]; 
    searchTerm: string;
    selectedNodeId?: string | null;
    onNavigate?: (view: string, id: string) => void;
}> = ({ title, icon, nodes, searchTerm, selectedNodeId, onNavigate }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (nodes.length === 0) return null;

    return (
        <div className="mb-6">
            <div 
                className="flex items-center gap-2 p-2 bg-slate-900 border-b border-slate-800 mb-2 cursor-pointer hover:text-white text-slate-400 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                {icon}
                <h3 className="font-bold text-xs uppercase tracking-wider">{title}</h3>
                <span className="ml-auto text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-500">{nodes.length} Items</span>
            </div>
            {isExpanded && (
                <div className="border-l border-slate-800 ml-4">
                    {nodes.map((node, i) => (
                        <TreeNodeItem 
                            key={i} 
                            node={node} 
                            level={0} 
                            searchTerm={searchTerm} 
                            selectedNodeId={selectedNodeId}
                            onNavigate={onNavigate}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const TreeVisualization: React.FC<TreeVisualizationProps> = ({ nodes, edges, searchTerm = '', selectedNodeId, onNavigate }) => {
    
    const { classRoots, objPropRoots, dataPropRoots, datatypes, individuals } = useMemo(() => {
        const nodeMap = new Map<string, Node<UMLNodeData>>(nodes.map(n => [n.id, n]));
        
        // Relationships
        const subClassOf = new Map<string, { id: string, isInferred: boolean }[]>(); // Parent -> Children
        const subPropOf = new Map<string, string[]>();
        const classInstances = new Map<string, { id: string, isInferred: boolean }[]>(); // Class -> Individuals
        
        // Track child status to find roots
        const isChildClass = new Set<string>();
        const isChildProp = new Set<string>();

        edges.forEach(e => {
            const label = (e.label as string) || '';
            const s = e.source;
            const t = e.target;
            const isInferred = (e.data && e.data.isInferred) || false;

            // Inheritance
            if (['subClassOf', 'rdfs:subClassOf'].includes(label)) {
                if (!subClassOf.has(t)) subClassOf.set(t, []);
                subClassOf.get(t)!.push({ id: s, isInferred });
                isChildClass.add(s);
            }
            else if (['subPropertyOf', 'rdfs:subPropertyOf'].includes(label)) {
                if (!subPropOf.has(t)) subPropOf.set(t, []);
                subPropOf.get(t)!.push(s);
                isChildProp.add(s);
            }
            // Instantiation
            else if (['rdf:type', 'a'].includes(label)) {
                if (!classInstances.has(t)) classInstances.set(t, []);
                classInstances.get(t)!.push({ id: s, isInferred });
            }
        });

        // Recursive Builder
        const buildClassTree = (classId: string, visited: Set<string> = new Set(), relInferred = false): TreeNode => {
            const n = nodeMap.get(classId)!;
            if (visited.has(classId)) {
                return { id: classId, label: `${n.data.label} (cycle)`, type: n.data.type, children: [], isInferred: relInferred };
            }
            const newVisited = new Set(visited).add(classId);

            const childClasses = (subClassOf.get(classId) || [])
                .map(item => {
                    const node = nodeMap.get(item.id);
                    if (!node) return null;
                    return buildClassTree(node.id, newVisited, item.isInferred);
                })
                .filter(Boolean) as TreeNode[];
            
            const childInstances = (classInstances.get(classId) || [])
                .map(item => {
                    const node = nodeMap.get(item.id);
                    if (!node) return null;
                    return {
                        id: node.id,
                        label: node.data.label,
                        type: ElementType.OWL_NAMED_INDIVIDUAL,
                        children: [],
                        isInferred: item.isInferred
                    };
                })
                .filter(Boolean) as TreeNode[];

            const children = [
                ...childClasses.sort((a,b) => a.label.localeCompare(b.label)),
                ...childInstances.sort((a,b) => a.label.localeCompare(b.label))
            ];

            return {
                id: n.id,
                label: n.data.label,
                type: n.data.type,
                isInferred: relInferred,
                children
            };
        };

        const buildPropTree = (propId: string, visited: Set<string> = new Set()): TreeNode => {
            const n = nodeMap.get(propId)!;
            if (visited.has(propId)) return { id: propId, label: n.data.label, type: n.data.type, children: [] };
            
            const newVisited = new Set(visited).add(propId);
            const childProps = (subPropOf.get(propId) || [])
                .map(pid => nodeMap.get(pid))
                .filter(Boolean)
                .map(p => buildPropTree(p!.id, newVisited))
                .sort((a,b) => a.label.localeCompare(b.label));

            return {
                id: n.id,
                label: n.data.label,
                type: n.data.type,
                children: childProps
            };
        };

        const classRoots = nodes
            .filter((n: Node<UMLNodeData>) => n.data.type === ElementType.OWL_CLASS && !isChildClass.has(n.id))
            .map((n: Node<UMLNodeData>) => buildClassTree(n.id))
            .sort((a,b) => a.label.localeCompare(b.label));

        const objPropRoots = nodes
            .filter((n: Node<UMLNodeData>) => n.data.type === ElementType.OWL_OBJECT_PROPERTY && !isChildProp.has(n.id))
            .map((n: Node<UMLNodeData>) => buildPropTree(n.id))
            .sort((a,b) => a.label.localeCompare(b.label));

        const dataPropRoots = nodes
            .filter((n: Node<UMLNodeData>) => n.data.type === ElementType.OWL_DATA_PROPERTY && !isChildProp.has(n.id))
            .map((n: Node<UMLNodeData>) => buildPropTree(n.id))
            .sort((a,b) => a.label.localeCompare(b.label));

        const datatypes = nodes
            .filter((n: Node<UMLNodeData>) => n.data.type === ElementType.OWL_DATATYPE)
            .map((n: Node<UMLNodeData>) => ({ id: n.id, label: n.data.label, type: n.data.type, children: [] }))
            .sort((a,b) => a.label.localeCompare(b.label));

        const individuals = nodes
            .filter((n: Node<UMLNodeData>) => n.data.type === ElementType.OWL_NAMED_INDIVIDUAL)
            .map((n: Node<UMLNodeData>) => ({ id: n.id, label: n.data.label, type: n.data.type, children: [] }))
            .sort((a,b) => a.label.localeCompare(b.label));

        return { classRoots, objPropRoots, dataPropRoots, datatypes, individuals };

    }, [nodes, edges]);

    return (
        <div className="h-full bg-slate-950 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            <div className="max-w-3xl mx-auto">
                <div className="mb-8 pb-4 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-3">
                        <Layers className="text-blue-500" />
                        Ontology Hierarchy
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Hierarchical view. Inferred relationships are marked in <span className="text-amber-400 italic">gold</span>.
                    </p>
                </div>

                <TreeSection title="Class Hierarchy" icon={<Database size={16} className="text-purple-400"/>} nodes={classRoots} searchTerm={searchTerm} selectedNodeId={selectedNodeId} onNavigate={onNavigate} />
                <TreeSection title="Object Properties" icon={<ArrowRightLeft size={16} className="text-blue-400"/>} nodes={objPropRoots} searchTerm={searchTerm} selectedNodeId={selectedNodeId} onNavigate={onNavigate} />
                <TreeSection title="Data Properties" icon={<Tag size={16} className="text-green-400"/>} nodes={dataPropRoots} searchTerm={searchTerm} selectedNodeId={selectedNodeId} onNavigate={onNavigate} />
                <TreeSection title="Datatypes" icon={<FileType size={16} className="text-amber-400"/>} nodes={datatypes} searchTerm={searchTerm} selectedNodeId={selectedNodeId} onNavigate={onNavigate} />
                <TreeSection title="Named Individuals" icon={<User size={16} className="text-pink-400"/>} nodes={individuals} searchTerm={searchTerm} selectedNodeId={selectedNodeId} onNavigate={onNavigate} />
            </div>
        </div>
    );
};

export default TreeVisualization;
