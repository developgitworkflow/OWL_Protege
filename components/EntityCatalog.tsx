
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, Method } from '../types';
import { Database, ArrowRightLeft, Tag, User, FileType, Plus, Trash2, Search, Edit3, Settings, ArrowRight, GitMerge, List, BookOpen, Brain, AlertTriangle, Sigma, Key, Link2, MessageSquare, Layers } from 'lucide-react';

interface EntityCatalogProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
    isReasonerActive?: boolean;
    unsatisfiableNodeIds?: string[];
    onAddNode: (type: ElementType, label: string) => void;
    onDeleteNode: (id: string) => void;
    onSelectNode: (id: string) => void;
    onViewInGraph?: (id: string) => void;
    selectedNodeId?: string | null;
}

type TabType = 'classes' | 'objectProps' | 'dataProps' | 'individuals' | 'datatypes';

const EntityCatalog: React.FC<EntityCatalogProps> = ({ 
    nodes, 
    edges, 
    isReasonerActive, 
    unsatisfiableNodeIds = [], 
    onAddNode, 
    onDeleteNode, 
    onSelectNode, 
    onViewInGraph,
    selectedNodeId 
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('classes');
    const [searchTerm, setSearchTerm] = useState('');
    const [newName, setNewName] = useState('');
    const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

    const tabs = [
        { id: 'classes', label: 'Classes', icon: Database, color: 'text-purple-400', border: 'border-purple-500', type: ElementType.OWL_CLASS },
        { id: 'objectProps', label: 'Object Properties', icon: ArrowRightLeft, color: 'text-blue-400', border: 'border-blue-500', type: ElementType.OWL_OBJECT_PROPERTY },
        { id: 'dataProps', label: 'Data Properties', icon: Tag, color: 'text-green-400', border: 'border-green-500', type: ElementType.OWL_DATA_PROPERTY },
        { id: 'individuals', label: 'Individuals', icon: User, color: 'text-pink-400', border: 'border-pink-500', type: ElementType.OWL_NAMED_INDIVIDUAL },
        { id: 'datatypes', label: 'Datatypes', icon: FileType, color: 'text-amber-400', border: 'border-amber-500', type: ElementType.OWL_DATATYPE },
    ];

    const currentTabInfo = tabs.find(t => t.id === activeTab)!;

    // Auto-switch tab and scroll when selectedNodeId changes
    useEffect(() => {
        if (selectedNodeId) {
            const node = nodes.find(n => n.id === selectedNodeId);
            if (node) {
                // 1. Switch Tab if needed
                const targetTab = tabs.find(t => t.type === node.data.type);
                if (targetTab && targetTab.id !== activeTab) {
                    setActiveTab(targetTab.id as TabType);
                }

                // 2. Scroll into view (needs a timeout to allow render after tab switch)
                setTimeout(() => {
                    const row = rowRefs.current.get(selectedNodeId);
                    if (row) {
                        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
            }
        }
    }, [selectedNodeId, nodes]);

    const filteredNodes = useMemo(() => {
        return nodes.filter(n => {
            if (n.data.type !== currentTabInfo.type) return false;
            if (searchTerm && !n.data.label.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        }).sort((a, b) => a.data.label.toLowerCase().localeCompare(b.data.label.toLowerCase()));
    }, [nodes, activeTab, searchTerm, currentTabInfo]);

    // --- Data Extraction Helpers ---

    const getNodeLabel = (id: string) => {
        const n = nodes.find(node => node.id === id);
        return n ? n.data.label : id;
    };

    const getRelationships = (node: Node<UMLNodeData>) => {
        const rels: { type: string, values: { label: string, inferred?: boolean }[] }[] = [];

        // 1. Classes
        if (node.data.type === ElementType.OWL_CLASS) {
            // Superclasses from Edges
            const parentEdges = edges.filter(e => e.source === node.id && (e.label === 'subClassOf' || e.label === 'rdfs:subClassOf'));
            if (parentEdges.length > 0) {
                rels.push({ 
                    type: 'Parents', 
                    values: parentEdges.map(e => ({ 
                        label: getNodeLabel(e.target), 
                        inferred: e.data?.isInferred 
                    })).sort((a, b) => a.label.localeCompare(b.label)) 
                });
            }
            // Disjointness
            const disjointEdges = edges.filter(e => (e.source === node.id || e.target === node.id) && (e.label === 'owl:disjointWith' || e.label === 'disjointWith'));
            if (disjointEdges.length > 0) {
                 const disjoints = disjointEdges.map(e => ({
                     label: e.source === node.id ? getNodeLabel(e.target) : getNodeLabel(e.source),
                     inferred: e.data?.isInferred
                 })).sort((a, b) => a.label.localeCompare(b.label));
                 rels.push({ type: 'Disjoint', values: disjoints });
            }
            
            // HasKey
            const keys = node.data.methods.filter(m => m.name.toLowerCase() === 'haskey').map(m => ({ label: m.returnType, inferred: false }));
            if (keys.length > 0) rels.push({ type: 'Keys', values: keys });
        }

        // 2. Individuals
        if (node.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
            // Types
            const typeEdges = edges.filter(e => e.source === node.id && (e.label === 'rdf:type' || e.label === 'a'));
            if (typeEdges.length > 0) {
                rels.push({ 
                    type: 'Types', 
                    values: typeEdges.map(e => ({
                        label: getNodeLabel(e.target),
                        inferred: e.data?.isInferred
                    })).sort((a, b) => a.label.localeCompare(b.label)) 
                });
            }
        }

        // 3. Properties
        if (node.data.type === ElementType.OWL_OBJECT_PROPERTY || node.data.type === ElementType.OWL_DATA_PROPERTY) {
            // Characteristics
            const chars = node.data.attributes.map(a => ({ label: a.name, inferred: false })).sort((a, b) => a.label.localeCompare(b.label));
            if (chars.length > 0) rels.push({ type: 'Flags', values: chars });
            
            // Domains/Ranges (Inferred edges might exist for these if reasoning expanded them, but usually they are axioms)
            const domains = node.data.methods.filter(m => m.name.toLowerCase() === 'domain').map(m => ({ label: m.returnType, inferred: false })).sort((a, b) => a.label.localeCompare(b.label));
            const ranges = node.data.methods.filter(m => m.name.toLowerCase() === 'range').map(m => ({ label: m.returnType, inferred: false })).sort((a, b) => a.label.localeCompare(b.label));
            
            if (domains.length > 0) rels.push({ type: 'Domain', values: domains });
            if (ranges.length > 0) rels.push({ type: 'Range', values: ranges });

            // Property Chains
            const chains = node.data.methods.filter(m => m.name.toLowerCase() === 'propertychainaxiom').map(m => ({ label: m.returnType, inferred: false }));
            if (chains.length > 0) rels.push({ type: 'Chains', values: chains });

            // Disjoint Properties
            const disjoints = node.data.methods.filter(m => m.name.toLowerCase() === 'propertydisjointwith' || m.name.toLowerCase() === 'disjointwith').map(m => ({ label: m.returnType, inferred: false }));
            if (disjoints.length > 0) rels.push({ type: 'Disjoint', values: disjoints });
        }

        return rels;
    };

    // --- Description Logic Converters ---

    const toDL = (expr: string): string => {
        if (!expr) return '';
        let dl = expr;
        
        // Keywords to Symbols
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
        dl = dl.replace(/\bthat\b/gi, '.'); 
        
        // Clean up spaces
        dl = dl.replace(/\s*⊓\s*/g, ' ⊓ ');
        dl = dl.replace(/\s*⊔\s*/g, ' ⊔ ');
        
        return dl;
    };

    const getDLAxiom = (method: Method, subject: string) => {
        const type = method.name.toLowerCase().replace(/[^a-z]/g, '');
        const o = toDL(method.returnType);
        
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
            case 'haskey': return `${subject} HasKey(${o})`;
            case 'propertychainaxiom': return `${o} ⊑ ${subject}`;
            default: return `${subject} ${method.name} ${o}`;
        }
    };

    const getHumanReadableAxiom = (method: Method) => {
        const type = method.name.toLowerCase();
        let prefix = method.name;
        let color = 'text-slate-500';
        
        if (type === 'subclassof') { prefix = 'Is a'; color = 'text-blue-400'; }
        else if (type.includes('equivalent')) { prefix = 'Defined as'; color = 'text-green-400'; }
        else if (type.includes('disjoint')) { prefix = 'Not a'; color = 'text-red-400'; }
        else if (type === 'domain') { prefix = 'Applies to'; color = 'text-purple-400'; }
        else if (type === 'range') { prefix = 'Points to'; color = 'text-purple-400'; }
        else if (type === 'inverseof') { prefix = 'Inverse of'; color = 'text-amber-400'; }
        else if (type === 'subpropertyof') { prefix = 'Sub-prop of'; color = 'text-blue-400'; }
        else if (type === 'type') { prefix = 'Type'; color = 'text-pink-400'; }
        else if (type === 'haskey') { prefix = 'Key'; color = 'text-yellow-400'; }
        else if (type === 'propertychainaxiom') { prefix = 'Chain'; color = 'text-cyan-400'; }
        
        return { prefix, target: method.returnType, color };
    };

    const highlightSyntax = (text: string) => {
        const parts = text.split(/(\b(?:some|only|value|min|max|exactly|that|not|and|or)\b)/g);
        return parts.map((part, i) => {
            if (['some', 'only', 'value', 'min', 'max', 'exactly', 'that', 'not', 'and', 'or'].includes(part.toLowerCase())) {
                return <span key={i} className="text-purple-400 font-bold">{part}</span>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    const handleCreate = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newName.trim()) return;
        
        onAddNode(currentTabInfo.type, newName.trim());
        setNewName('');
    };

    return (
        <div className="h-full bg-slate-950 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-800 bg-slate-900 flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                        <Settings className="text-blue-500" />
                        Entity Catalog
                    </h2>
                    <p className="text-slate-400 mt-1">
                        Manage ontology vocabulary. View axioms, annotations, and logical characteristics.
                    </p>
                </div>
                {isReasonerActive && (
                    <div className="flex items-center gap-2 bg-amber-900/30 border border-amber-700/50 text-amber-400 px-3 py-1.5 rounded-full text-xs font-bold animate-pulse shadow-lg">
                        <Brain size={14} />
                        Reasoner Active
                    </div>
                )}
            </div>

            {/* Main Layout */}
            <div className="flex flex-1 overflow-hidden">
                
                {/* Sidebar Navigation */}
                <div className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col p-4 gap-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                                activeTab === tab.id 
                                ? `bg-slate-800 text-white shadow-md border-l-4 ${tab.border}` 
                                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                            }`}
                        >
                            <tab.icon size={18} className={activeTab === tab.id ? tab.color : 'text-slate-500'} />
                            {tab.label}
                            <span className="ml-auto text-xs bg-slate-950 px-2 py-0.5 rounded-full text-slate-500">
                                {nodes.filter(n => n.data.type === tab.type).length}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col bg-slate-950 p-6 overflow-hidden">
                    
                    {/* Controls */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        {/* Search */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input 
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-600"
                                placeholder={`Search ${currentTabInfo.label}...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Quick Add */}
                        <form onSubmit={handleCreate} className="flex-1 flex gap-2">
                            <input 
                                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all placeholder-slate-600"
                                placeholder={`New ${currentTabInfo.label.slice(0, -1)} Name...`}
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                            />
                            <button 
                                type="submit"
                                disabled={!newName.trim()}
                                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 shadow-sm"
                            >
                                <Plus size={18} />
                                Create
                            </button>
                        </form>
                    </div>

                    {/* Entity List */}
                    <div className="flex-1 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl shadow-inner">
                        {filteredNodes.length > 0 ? (
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-900 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 w-1/4">Label & IRI</th>
                                        
                                        {/* Dynamic Headers based on Type */}
                                        {activeTab === 'classes' && <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 w-1/5">Hierarchy & Logic</th>}
                                        {(activeTab === 'objectProps' || activeTab === 'dataProps') && <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 w-1/5">Signature & Flags</th>}
                                        {activeTab === 'individuals' && <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 w-1/5">Type Assertions</th>}
                                        
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Formal Definition & Annotations</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 text-right w-32">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {filteredNodes.map(node => {
                                        const rels = getRelationships(node);
                                        const isUnsatisfiable = unsatisfiableNodeIds.includes(node.id);
                                        const isSelected = selectedNodeId === node.id;
                                        
                                        // Sort axioms alphabetically for display consistency
                                        const sortedMethods = [...node.data.methods].sort((a, b) => {
                                            const typeCompare = a.name.localeCompare(b.name);
                                            if (typeCompare !== 0) return typeCompare;
                                            return a.returnType.localeCompare(b.returnType);
                                        });

                                        return (
                                            <tr 
                                                key={node.id} 
                                                ref={el => { if (el) rowRefs.current.set(node.id, el); }}
                                                className={`group transition-colors ${
                                                    isSelected 
                                                    ? 'bg-blue-900/30 border-l-2 border-l-blue-500' 
                                                    : 'hover:bg-slate-800/30'
                                                }`}
                                            >
                                                {/* 1. Identity */}
                                                <td className="p-4 align-top">
                                                    <div className="flex items-start gap-3">
                                                        <div className={`p-2 rounded-lg bg-slate-950 border ${isUnsatisfiable ? 'border-red-500 text-red-500' : 'border-slate-800'} ${currentTabInfo.color.replace('text-', 'text-opacity-80 text-')}`}>
                                                            {isUnsatisfiable ? <AlertTriangle size={16} /> : <currentTabInfo.icon size={16} />}
                                                        </div>
                                                        <div>
                                                            <div className={`text-sm font-bold group-hover:text-white transition-colors ${isUnsatisfiable ? 'text-red-400 line-through' : (isSelected ? 'text-white' : 'text-slate-200')}`}>
                                                                {node.data.label}
                                                            </div>
                                                            <div className="text-[10px] font-mono text-slate-500 truncate max-w-[150px] mt-0.5" title={node.data.iri}>
                                                                {node.data.iri || 'No explicit IRI'}
                                                            </div>
                                                            {isUnsatisfiable && <span className="text-[9px] text-red-500 font-bold block mt-1">UNSATISFIABLE</span>}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* 2. Type-Specific Logic Column */}
                                                {(activeTab === 'classes' || activeTab === 'individuals' || activeTab === 'objectProps' || activeTab === 'dataProps') && (
                                                    <td className="p-4 align-top">
                                                        <div className="flex flex-col gap-2">
                                                            {rels.length > 0 ? rels.map((rel, idx) => (
                                                                <div key={idx} className="flex flex-wrap gap-1 items-baseline">
                                                                    <span className="text-[10px] uppercase font-bold text-slate-500 mr-1">{rel.type}:</span>
                                                                    {rel.values.map((v, vIdx) => (
                                                                        <span 
                                                                            key={vIdx} 
                                                                            className={`text-[11px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                                                                                v.inferred && isReasonerActive
                                                                                ? 'bg-amber-900/20 text-amber-300 border-amber-800/50' 
                                                                                : 'bg-slate-800 text-slate-300 border-slate-700'
                                                                            }`}
                                                                            title={v.inferred ? 'Inferred by Reasoner' : undefined}
                                                                        >
                                                                            {v.label}
                                                                            {v.inferred && isReasonerActive && <Brain size={8} className="text-amber-500" />}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )) : (
                                                                <span className="text-xs text-slate-600 italic">No relations defined</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}

                                                {/* 3. Description & Axioms */}
                                                <td className="p-4 align-top">
                                                    {/* Enhanced Annotations */}
                                                    {node.data.annotations && node.data.annotations.length > 0 && (
                                                        <div className="mb-3">
                                                            <div className="text-[10px] uppercase font-bold text-slate-600 mb-1 flex items-center gap-1">
                                                                <MessageSquare size={10} /> Annotations
                                                            </div>
                                                            <div className="space-y-1">
                                                                {node.data.annotations.map((ann, i) => (
                                                                    <div key={i} className="text-xs flex gap-1.5 items-start">
                                                                        <span className="text-slate-500 font-mono text-[10px] shrink-0 mt-0.5">{ann.property}:</span>
                                                                        <span className="text-slate-400 leading-snug">{ann.value.replace(/"/g, '')}</span>
                                                                        {ann.language && <span className="text-[9px] bg-slate-800 px-1 rounded text-slate-500">@{ann.language}</span>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Axioms */}
                                                    {sortedMethods.length > 0 && (
                                                        <div className="space-y-1.5">
                                                            <div className="text-[10px] uppercase font-bold text-slate-600 mb-1 flex items-center gap-1">
                                                                <BookOpen size={10} /> Formal Definition
                                                            </div>
                                                            {sortedMethods.slice(0, 5).map((m, mIdx) => {
                                                                const { prefix, target, color } = getHumanReadableAxiom(m);
                                                                const dlString = getDLAxiom(m, node.data.label);
                                                                
                                                                return (
                                                                    <div key={mIdx} className="flex flex-col gap-1 text-xs bg-slate-900/50 p-1.5 rounded border border-slate-800/50 hover:border-slate-700 hover:bg-slate-800 transition-colors">
                                                                        <div className="flex items-baseline gap-2">
                                                                            <span className={`font-semibold ${color} shrink-0 text-[11px] w-20 text-right`}>{prefix}</span>
                                                                            <span className="text-slate-300 font-mono text-[11px] truncate">
                                                                                {highlightSyntax(target)}
                                                                            </span>
                                                                        </div>
                                                                        {/* DL Representation */}
                                                                        <div className="flex items-center gap-2 pl-[5.5rem] opacity-60">
                                                                            <span className="text-[9px] text-slate-500 font-serif border border-slate-700 px-1 rounded bg-slate-950 flex items-center gap-1"><Sigma size={8} /> DL</span>
                                                                            <span className="font-serif text-slate-400 text-[11px] truncate">{dlString}</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {sortedMethods.length > 5 && (
                                                                <span className="text-[9px] text-slate-500 pl-2">
                                                                    ... and {sortedMethods.length - 5} more axioms
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {!node.data.description && (!node.data.annotations || node.data.annotations.length === 0) && sortedMethods.length === 0 && (
                                                        <span className="text-[10px] text-slate-600 italic">No description or axioms</span>
                                                    )}
                                                </td>

                                                {/* 4. Actions */}
                                                <td className="p-4 align-top text-right">
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => onViewInGraph && onViewInGraph(node.id)}
                                                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors"
                                                            title="View in Graph"
                                                        >
                                                            <Layers size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => onSelectNode(node.id)}
                                                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                                                            title="Edit Properties"
                                                        >
                                                            <Edit3 size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => onDeleteNode(node.id)}
                                                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <currentTabInfo.icon size={48} className="opacity-20 mb-4" />
                                <p className="text-sm">No {currentTabInfo.label.toLowerCase()} found.</p>
                                <p className="text-xs mt-1 opacity-60">Use the form above to create one.</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default EntityCatalog;
