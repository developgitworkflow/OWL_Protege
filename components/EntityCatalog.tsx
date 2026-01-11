
import React, { useState, useMemo } from 'react';
import { Node } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { Database, ArrowRightLeft, Tag, User, FileType, Plus, Trash2, Search, Edit3, Settings } from 'lucide-react';

interface EntityCatalogProps {
    nodes: Node<UMLNodeData>[];
    onAddNode: (type: ElementType, label: string) => void;
    onDeleteNode: (id: string) => void;
    onSelectNode: (id: string) => void;
}

type TabType = 'classes' | 'objectProps' | 'dataProps' | 'individuals' | 'datatypes';

const EntityCatalog: React.FC<EntityCatalogProps> = ({ nodes, onAddNode, onDeleteNode, onSelectNode }) => {
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
                                <thead className="bg-slate-900 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Entity Label</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">IRI</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {filteredNodes.map(node => (
                                        <tr key={node.id} className="group hover:bg-slate-800/30 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg bg-slate-950 border border-slate-800 ${currentTabInfo.color.replace('text-', 'text-opacity-80 text-')}`}>
                                                        <currentTabInfo.icon size={16} />
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                                                        {node.data.label}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-xs font-mono text-slate-500">
                                                    {node.data.iri || 'No IRI set'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
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
                                    ))}
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
