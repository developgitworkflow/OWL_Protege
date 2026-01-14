
import React, { useMemo, useState } from 'react';
import { X, Copy, Download, Database, User, ArrowRightLeft, Tag, FileType, Box, Circle, Filter, Eye, EyeOff, Layers, List, Network, FolderTree, Code2, Search } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ProjectData, ElementType } from '../types';
import { generateManchesterSyntax } from '../services/manchesterSyntaxGenerator';

interface ManchesterSyntaxModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node<UMLNodeData>[];
  edges: Edge[];
  projectData: ProjectData;
  onNavigate: (view: string, id: string) => void;
}

const MANCHESTER_KEYWORDS = [
    'some', 'only', 'value', 'min', 'max', 'exactly', 'that', 'not', 'and', 'or', 'self'
];

const getIcon = (type: ElementType) => {
    switch(type) {
        case ElementType.OWL_CLASS: 
            return <div className="p-1.5 bg-indigo-500/20 rounded border border-indigo-500/50 text-indigo-400"><Database size={16} /></div>;
        case ElementType.OWL_NAMED_INDIVIDUAL: 
            return <div className="p-1.5 bg-teal-500/20 rounded border border-teal-500/50 text-teal-400"><User size={16} /></div>;
        case ElementType.OWL_OBJECT_PROPERTY: 
            return <div className="p-1.5 bg-blue-500/20 rounded border border-blue-500/50 text-blue-400"><ArrowRightLeft size={16} /></div>;
        case ElementType.OWL_DATA_PROPERTY: 
            return <div className="p-1.5 bg-emerald-500/20 rounded border border-emerald-500/50 text-emerald-400"><Tag size={16} /></div>;
        case ElementType.OWL_DATATYPE: 
            return <div className="p-1.5 bg-amber-500/20 rounded border border-amber-500/50 text-amber-400"><FileType size={16} /></div>;
        default: 
            return <div className="p-1.5 bg-slate-700/50 rounded border border-slate-600 text-slate-400"><Box size={16} /></div>;
    }
};

const ManchesterText = ({ text }: { text: string }) => {
    const parts = text.split(/(\b(?:some|only|value|min|max|exactly|that|not|and|or|self)\b)/gi);
    return (
        <span className="font-mono text-xs sm:text-sm leading-relaxed text-slate-300 break-words">
            {parts.map((part, i) => {
                if (MANCHESTER_KEYWORDS.includes(part.toLowerCase())) {
                    return <span key={i} className="text-fuchsia-400 font-bold mx-1">{part}</span>; 
                }
                if (part.trim().length > 1 && !part.match(/^\d+$/) && !part.match(/^[(){}\[\],]+$/)) {
                     if (/^[A-Z]/.test(part.trim())) return <span key={i} className="text-indigo-300 font-medium">{part}</span>;
                     if (/^[a-z]/.test(part.trim())) return <span key={i} className="text-blue-300">{part}</span>;
                     if (part.includes(':')) return <span key={i} className="text-cyan-300">{part}</span>;
                }
                return <span key={i} className="text-slate-400">{part}</span>;
            })}
        </span>
    );
};

interface EntityFrameProps { 
    node: Node<UMLNodeData>;
    edges: Edge[];
    nodes: Node<UMLNodeData>[]; // Needed to lookup target labels
    onNavigate: (view: string, id: string) => void;
    onClose: () => void;
}

const EntityFrame: React.FC<EntityFrameProps> = ({ node, edges, nodes, onNavigate, onClose }) => {
    const { data } = node;
    const methods = data.methods || [];
    const attributes = data.attributes || [];
    
    const equivalent = methods.filter(m => ['equivalentto', 'equivalentclass'].includes(m.name.toLowerCase()));
    const subClass = methods.filter(m => ['subclassof'].includes(m.name.toLowerCase()));
    const disjoint = methods.filter(m => ['disjointwith'].includes(m.name.toLowerCase()));
    const general = methods.filter(m => !['subclassof', 'equivalentto', 'equivalentclass', 'disjointwith'].includes(m.name.toLowerCase()));
    
    const connectedEdges = edges.filter(e => e.source === node.id);
    const parentEdges = connectedEdges.filter(e => e.label === 'subClassOf' || e.label === 'rdfs:subClassOf');
    
    const hasContent = equivalent.length > 0 || subClass.length > 0 || disjoint.length > 0 || general.length > 0 || parentEdges.length > 0 || attributes.length > 0;

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm mb-4 group/frame hover:border-slate-700 transition-colors">
            {/* Entity Header */}
            <div className="bg-slate-900/50 px-4 py-3 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-3">
                    {getIcon(data.type)}
                    <div>
                        <div className="font-bold text-slate-100 text-base">{data.label}</div>
                        <div className="text-slate-500 text-[10px] font-mono opacity-70">{data.iri || data.label}</div>
                    </div>
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover/frame:opacity-100 transition-opacity bg-slate-800/80 backdrop-blur-sm rounded-lg border border-slate-700 p-1 shadow-lg">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onNavigate('design', node.id); onClose(); }} 
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 rounded transition-colors"
                        title="View in Graph"
                    >
                        <Layers size={14} />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onNavigate('entities', node.id); onClose(); }} 
                        className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors"
                        title="View in Catalog"
                    >
                        <List size={14} />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onNavigate('owlviz', node.id); onClose(); }} 
                        className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-700 rounded transition-colors"
                        title="View Hierarchy"
                    >
                        <Network size={14} />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onNavigate('tree', node.id); onClose(); }} 
                        className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded transition-colors"
                        title="View in Tree"
                    >
                        <FolderTree size={14} />
                    </button>
                </div>
            </div>

            {/* Content Body */}
            <div className="p-0 text-sm">
                
                {/* Annotations Section */}
                {(data.description || (data.annotations && data.annotations.length > 0)) && (
                    <div className="border-b border-slate-800/50">
                        <div className="px-4 py-1 bg-slate-950/30 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <Code2 size={10} /> Annotations
                        </div>
                        <div className="p-3 space-y-1">
                            {data.description && (
                                <div className="flex gap-3 text-xs">
                                    <span className="text-slate-500 font-bold min-w-[80px] font-mono">comment</span>
                                    <span className="text-slate-300 italic">"{data.description}"</span>
                                </div>
                            )}
                            {data.annotations?.map((ann, i) => (
                                <div key={i} className="flex gap-3 text-xs">
                                    <span className="text-slate-500 font-bold min-w-[80px] font-mono">{ann.property}</span>
                                    <span className="text-slate-300">"{ann.value.replace(/"/g, '')}"</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Asserted Conditions Header */}
                {hasContent && (
                    <div className="px-4 py-1.5 bg-slate-950/50 border-y border-slate-800 flex justify-between items-center">
                        <span className="font-bold text-slate-400 text-xs uppercase tracking-wider">Asserted Axioms</span>
                    </div>
                )}

                <div className="divide-y divide-slate-800/50">
                    
                    {/* Equivalent Classes (Necessary & Sufficient) */}
                    {equivalent.length > 0 && (
                        <div className="bg-slate-800/10">
                            {equivalent.map(m => (
                                <div key={m.id} className="flex items-start gap-3 px-4 py-2 hover:bg-white/5 transition-colors">
                                    <div className="w-6 mt-0.5 flex justify-center text-amber-500 font-bold text-lg leading-none" title="Equivalent To">≡</div>
                                    <div className="flex-1"><ManchesterText text={m.returnType} /></div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* SubClassOf (Necessary) */}
                    {(subClass.length > 0 || parentEdges.length > 0 || attributes.length > 0) && (
                        <div>
                            {parentEdges.map(e => {
                                const targetNode = nodes.find(n => n.id === e.target);
                                const label = targetNode ? targetNode.data.label : 'Unknown';
                                return (
                                    <div key={e.id} className="flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors">
                                        <div className="w-6 flex justify-center text-slate-500">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50" />
                                        </div>
                                        <div className="flex-1"><span className="text-indigo-200 font-medium">{label}</span></div>
                                    </div>
                                );
                            })}
                            
                            {subClass.map(m => (
                                <div key={m.id} className="flex items-start gap-3 px-4 py-2 hover:bg-white/5 transition-colors">
                                    <div className="w-6 mt-1.5 flex justify-center text-slate-500">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                                    </div>
                                    <div className="flex-1"><ManchesterText text={m.returnType} /></div>
                                </div>
                            ))}

                            {/* Attributes as Data Properties Restrictions */}
                            {attributes.map(attr => (
                                <div key={attr.id} className="flex items-start gap-3 px-4 py-2 hover:bg-white/5 transition-colors">
                                    <div className="w-6 mt-1.5 flex justify-center text-slate-500">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                                    </div>
                                    <div className="flex-1 text-sm">
                                        <span className="text-emerald-200">{attr.name}</span> <span className="text-fuchsia-400 font-bold text-xs mx-1">some</span> <span className="text-amber-200">{attr.type || 'Literal'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Disjoint With */}
                    {disjoint.length > 0 && (
                        <div className="bg-red-900/5">
                            {disjoint.map(m => (
                                <div key={m.id} className="flex items-start gap-3 px-4 py-2 hover:bg-white/5 transition-colors">
                                    <div className="w-6 mt-0.5 flex justify-center text-red-400 font-bold text-lg leading-none" title="Disjoint With">⊥</div>
                                    <div className="flex-1"><ManchesterText text={m.returnType} /></div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Other Axioms (Domain, Range, etc) */}
                    {general.length > 0 && (
                        <div>
                            {general.map(m => (
                                <div key={m.id} className="flex items-start gap-3 px-4 py-2 hover:bg-white/5 transition-colors">
                                    <div className="w-20 text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider text-right">{m.name}</div>
                                    <div className="flex-1"><ManchesterText text={m.returnType} /></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                {!hasContent && (
                    <div className="p-4 text-center text-slate-600 text-xs italic">
                        No logical axioms defined.
                    </div>
                )}
            </div>
        </div>
    );
};

const ManchesterSyntaxModal: React.FC<ManchesterSyntaxModalProps> = ({ isOpen, onClose, nodes, edges, projectData, onNavigate }) => {
  const [copied, setCopied] = useState(false);
  
  // Filter States
  const [showClasses, setShowClasses] = useState(true);
  const [showObjProps, setShowObjProps] = useState(true);
  const [showDataProps, setShowDataProps] = useState(true);
  const [showIndividuals, setShowIndividuals] = useState(true);
  const [showDatatypes, setShowDatatypes] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Background string generation for copy/download
  const code = useMemo(() => {
      if (!isOpen) return '';
      return generateManchesterSyntax(nodes, edges, projectData);
  }, [nodes, edges, projectData, isOpen]);

  const handleCopy = () => {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
      const blob = new Blob([code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectData.name.replace(/\s+/g, '_')}.omn`;
      link.click();
  };

  const counts = useMemo(() => {
      return {
          classes: nodes.filter(n => n.data.type === ElementType.OWL_CLASS).length,
          objProps: nodes.filter(n => n.data.type === ElementType.OWL_OBJECT_PROPERTY).length,
          dataProps: nodes.filter(n => n.data.type === ElementType.OWL_DATA_PROPERTY).length,
          individuals: nodes.filter(n => n.data.type === ElementType.OWL_NAMED_INDIVIDUAL).length,
          datatypes: nodes.filter(n => n.data.type === ElementType.OWL_DATATYPE).length
      }
  }, [nodes]);

  const filteredNodes = useMemo(() => {
      let filtered = nodes;
      
      // Filter by Search
      if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          filtered = filtered.filter(n => n.data.label.toLowerCase().includes(lower) || (n.data.iri && n.data.iri.toLowerCase().includes(lower)));
      }

      // Filter by Type Toggle
      filtered = filtered.filter(n => {
          if (!showClasses && n.data.type === ElementType.OWL_CLASS) return false;
          if (!showObjProps && n.data.type === ElementType.OWL_OBJECT_PROPERTY) return false;
          if (!showDataProps && n.data.type === ElementType.OWL_DATA_PROPERTY) return false;
          if (!showIndividuals && n.data.type === ElementType.OWL_NAMED_INDIVIDUAL) return false;
          if (!showDatatypes && n.data.type === ElementType.OWL_DATATYPE) return false;
          return true;
      });

      return filtered.sort((a,b) => a.data.label.localeCompare(b.data.label));
  }, [nodes, searchTerm, showClasses, showObjProps, showDataProps, showIndividuals, showDatatypes]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-5xl bg-slate-950 rounded-xl shadow-2xl ring-1 ring-slate-700 flex flex-col h-[90vh] overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-900/30 rounded-lg border border-indigo-800 text-indigo-400">
                 <Code2 size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-100">Manchester Syntax</h2>
                <p className="text-xs text-slate-400">Compact Class Descriptions</p>
             </div>
          </div>
          <div className="flex gap-2">
            <button 
                onClick={handleCopy} 
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-300 transition-colors font-medium"
            >
                {copied ? 'Copied!' : 'Copy'}
            </button>
            <button 
                onClick={handleDownload}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-300 transition-colors font-medium flex items-center gap-2"
            >
                <Download size={14} /> Export
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-2 rounded-full transition-all">
                <X size={20} />
            </button>
          </div>
        </div>

        {/* Filter Toolbar (Mini Topbar) */}
        <div className="flex flex-col sm:flex-row items-center gap-4 px-6 py-3 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            
            {/* Search */}
            <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                    type="text"
                    placeholder="Filter entities..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-full pl-9 pr-4 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500 transition-colors placeholder-slate-600"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>

            {/* Filters */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-2 shrink-0">
                    <Filter size={10} /> View:
                </div>
                
                <button onClick={() => setShowClasses(!showClasses)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${showClasses ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' : 'bg-slate-900 text-slate-500 border-slate-800 opacity-60 hover:opacity-100'}`}>
                    <Database size={10} /> Classes ({counts.classes})
                </button>

                <button onClick={() => setShowObjProps(!showObjProps)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${showObjProps ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' : 'bg-slate-900 text-slate-500 border-slate-800 opacity-60 hover:opacity-100'}`}>
                    <ArrowRightLeft size={10} /> Obj ({counts.objProps})
                </button>

                <button onClick={() => setShowDataProps(!showDataProps)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${showDataProps ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-slate-900 text-slate-500 border-slate-800 opacity-60 hover:opacity-100'}`}>
                    <Tag size={10} /> Data ({counts.dataProps})
                </button>

                <button onClick={() => setShowIndividuals(!showIndividuals)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${showIndividuals ? 'bg-teal-500/10 text-teal-300 border-teal-500/30' : 'bg-slate-900 text-slate-500 border-slate-800 opacity-60 hover:opacity-100'}`}>
                    <User size={10} /> Indiv ({counts.individuals})
                </button>

                <button onClick={() => setShowDatatypes(!showDatatypes)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${showDatatypes ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-slate-900 text-slate-500 border-slate-800 opacity-60 hover:opacity-100'}`}>
                    <FileType size={10} /> Types ({counts.datatypes})
                </button>
            </div>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
            {/* Main List Area */}
            <div className="flex-1 overflow-y-auto bg-slate-950 p-6 scrollbar-thin scrollbar-thumb-slate-800">
                 <div className="max-w-4xl mx-auto">
                    {filteredNodes.length > 0 ? (
                        filteredNodes.map(node => <EntityFrame key={node.id} node={node} edges={edges} nodes={nodes} onNavigate={onNavigate} onClose={onClose} />)
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-600">
                            <EyeOff size={48} className="opacity-20 mb-2" />
                            <p className="text-sm">No matching entities found.</p>
                        </div>
                    )}
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ManchesterSyntaxModal;
