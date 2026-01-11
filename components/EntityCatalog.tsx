
import React, { useState, useMemo } from 'react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { Database, ArrowRightLeft, Tag, User, FileType, Plus, Trash2, Search, Edit3, Settings, ArrowRight, GitMerge, List } from 'lucide-react';

interface EntityCatalogProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
    onAddNode: (type: ElementType, label: string) => void;
    onDeleteNode: (id: string) => void;
    onSelectNode: (id: string) => void;
}

type TabType = 'classes' | 'objectProps' | 'dataProps' | 'individuals' | 'datatypes';

const EntityCatalog: React.FC<EntityCatalogProps> = ({ nodes, edges, onAddNode, onDeleteNode, onSelectNode }) => {
    const [activeTab, setActiveTab] = useState<TabType>('classes');
    const [searchTerm, setSearchTerm] = useState('');
    const [newName, setNewName] = useState('');

    const tabs = [
        { id: 'classes', label: 'Classes', icon: Database, color: 'text-purple-400', border: 'border-purple-500', type: ElementType.OWL_CLASS },
        { id: 'objectProps', label: 'Object Properties', icon: ArrowRightLeft, color: 'text-blue-400', border: 'border-blue-500', type: ElementType.OWL_OBJECT_PROPERTY },
        { id: 'dataProps', label: 'Data Properties', icon: Tag, color: 'text-green-400', border: 'border-green-500', type: ElementType.OWL_DATA_PROPERTY },
        { id: 'individuals', label: 'Individuals', icon: User, color: 'text-pink-400', border: 'border-pink-500', type: ElementType.OWL_NAMED_INDIVIDUAL },
        { id: 'datatypes', label: 'Datatypes', icon: FileType, color: 'text-amber-400', border: 'border-amber-500', type: ElementType.OWL_DATATYPE },
    ];

    const currentTabInfo = tabs.find(t => t.id === activeTab)!;

    const filteredNodes = useMemo(() => {
        return nodes.filter(n => {
            if (n.data.type !== currentTabInfo.type) return false;
            if (searchTerm && !n.data.label.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        }).sort((a, b) => a.data.label.localeCompare(b.data.label));
    }, [nodes, activeTab, searchTerm]);

    // --- Data Extraction Helpers ---

    const getNodeLabel = (id: string) => {
        const n = nodes.find(node => node.id === id);
        return n ? n.data.label : id;
    };

    const getRelationships = (node: Node<UMLNodeData>) => {
        const rels: { type: string, values: string[] }[] = [];

        // 1. Classes
        if (node.data.type === ElementType.OWL_CLASS) {
            // Superclasses from Edges
            const parentEdges = edges.filter(e => e.source === node.id && (e.label === 'subClassOf' || e.label === 'rdfs:subClassOf'));
            if (parentEdges.length > 0) {
                rels.push({ type: 'Parents', values: parentEdges.map(e => getNodeLabel(e.target)) });
            }
            // Disjointness
            const disjoint = node.data.methods.filter(m => m.name.toLowerCase() === 'disjointwith').map(m => m.returnType);
            if (disjoint.length > 0) {
                rels.push({ type: 'Disjoint', values: disjoint });
            }
        }

        // 2. Individuals
        if (node.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
            // Types
            const typeEdges = edges.filter(e => e.source === node.id && (e.label === 'rdf:type' || e.label === 'a'));
            if (typeEdges.length > 0) {
                rels.push({ type: 'Types', values: typeEdges.map(e => getNodeLabel(e.target)) });
            }
        }

        // 3. Properties
        if (node.data.type === ElementType.OWL_OBJECT_PROPERTY || node.data.type === ElementType.OWL_DATA_PROPERTY) {
            const domains = node.data.methods.filter(m => m.name.toLowerCase() === 'domain').map(m => m.returnType);
            const ranges = node.data.methods.filter(m => m.name.toLowerCase() === 'range').map(m => m.returnType);
            
            if (domains.length > 0) rels.push({ type: 'Domain', values: domains });
            if (ranges.length > 0) rels.push({ type: 'Range', values: ranges });
            
            // Characteristics
            const chars = node.data.attributes.map(a => a.name);
            if (chars.length > 0) rels.push({ type: 'Flags', values: chars });
        }

        return rels;
    };

    const getDescription = (node: Node<UMLNodeData>) => {
        if (node.data.description) return node.data.description;
        const comment = node.data.annotations?.find(a => a.property === 'rdfs:comment' || a.property === 'skos:definition');
        return comment ? comment.value.replace(/"/g, '') : '';
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
            <div className="px-8 py-6 border-b border-slate-800 bg-slate-900">
                <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                    <Settings className="text-blue-500" />
                    Entity Catalog
                </h2>
                <p className="text-slate-400 mt-1">
                    Manage ontology vocabulary. Quickly create and organize classes, properties, and individuals.
                </p>
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
                                        {activeTab === 'classes' && <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 w-1/4">Hierarchy</th>}
                                        {(activeTab === 'objectProps' || activeTab === 'dataProps') && <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 w-1/4">Signature</th>}
                                        {activeTab === 'individuals' && <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 w-1/4">Type Assertions</th>}
                                        
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Description / Details</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 text-right w-24">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {filteredNodes.map(node => {
                                        const rels = getRelationships(node);
                                        const description = getDescription(node);

                                        return (
                                            <tr key={node.id} className="group hover:bg-slate-800/30 transition-colors">
                                                {/* 1. Identity */}
                                                <td className="p-4 align-top">
                                                    <div className="flex items-start gap-3">
                                                        <div className={`p-2 rounded-lg bg-slate-950 border border-slate-800 ${currentTabInfo.color.replace('text-', 'text-opacity-80 text-')}`}>
                                                            <currentTabInfo.icon size={16} />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
                                                                {node.data.label}
                                                            </div>
                                                            <div className="text-[10px] font-mono text-slate-500 truncate max-w-[150px] mt-0.5" title={node.data.iri}>
                                                                {node.data.iri || 'No explicit IRI'}
                                                            </div>
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
                                                                        <span key={vIdx} className="text-[11px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                                                                            {v}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )) : (
                                                                <span className="text-xs text-slate-600 italic">No relations defined</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}

                                                {/* 3. Description / Details */}
                                                <td className="p-4 align-top">
                                                    {description ? (
                                                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2" title={description}>
                                                            {description}
                                                        </p>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-600 italic">No description</span>
                                                    )}
                                                    
                                                    {/* Additional Axiom Hint */}
                                                    {node.data.methods.length > 0 && (
                                                        <div className="mt-2 flex items-center gap-1 text-[10px] text-blue-400/70">
                                                            <List size={10} />
                                                            {node.data.methods.length} {node.data.methods.length === 1 ? 'Axiom' : 'Axioms'} defined
                                                        </div>
                                                    )}
                                                </td>

                                                {/* 4. Actions */}
                                                <td className="p-4 align-top text-right">
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
