import React, { useState, useEffect } from 'react';
import { X, Search, Database, User, ArrowDownCircle, ArrowUpCircle, CheckCircle2, Lightbulb } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { classifyOntology, executeDLQuery, QueryType } from '../services/reasonerService';
import UMLNode from './UMLNode';

interface DLQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node<UMLNodeData>[];
  edges: Edge[];
}

const EXAMPLE_QUERIES = [
    { label: 'All Persons', query: 'Person', type: 'subclasses' as QueryType, desc: 'Finds all subclasses of Person' },
    { label: 'Courses Taught', query: 'teaches some Course', type: 'superclasses' as QueryType, desc: 'Classes that must teach at least one Course' },
    { label: 'Specific Teacher', query: 'teaches value Artificial_Intelligence_101', type: 'instances' as QueryType, desc: 'Individuals who teach this specific course' },
    { label: 'Intersection', query: 'Professor and Person', type: 'subclasses' as QueryType, desc: 'Standard intersection logic' },
    { label: 'Unknown Class', query: 'Martian', type: 'subclasses' as QueryType, desc: 'Example of a query returning no results' },
];

const DLQueryModal: React.FC<DLQueryModalProps> = ({ isOpen, onClose, nodes, edges }) => {
  const [query, setQuery] = useState('');
  const [queryType, setQueryType] = useState<QueryType>('subclasses');
  const [results, setResults] = useState<Node<UMLNodeData>[]>([]);
  const [isClassified, setIsClassified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-classify on open (Simulating a Reasoner sync)
  useEffect(() => {
      if (isOpen) {
          try {
              classifyOntology(nodes, edges);
              setIsClassified(true);
              setResults([]);
              setError(null);
          } catch (e) {
              setError("Failed to classify ontology.");
          }
      }
  }, [isOpen, nodes, edges]);

  const handleExecute = (overrideQuery?: string, overrideType?: QueryType) => {
      const q = overrideQuery || query;
      const t = overrideType || queryType;
      
      if (!q.trim()) return;
      
      try {
          const res = executeDLQuery(q, t);
          setResults(res);
          setError(null);
      } catch (e) {
          setError("Invalid query syntax or unknown class.");
          setResults([]);
      }
  };

  const loadExample = (ex: typeof EXAMPLE_QUERIES[0]) => {
      setQuery(ex.query);
      setQueryType(ex.type);
      handleExecute(ex.query, ex.type);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleExecute();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-4xl bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-700 flex flex-col h-[80vh] overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-purple-900/30 rounded-lg border border-purple-800 text-purple-400">
                 <Search size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-100">DL Query</h2>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className={`flex items-center gap-1 ${isClassified ? 'text-green-400' : 'text-amber-400'}`}>
                        <CheckCircle2 size={10} /> {isClassified ? 'Reasoner Active' : 'Classifying...'}
                    </span>
                    <span>•</span>
                    <span>Manchester Syntax</span>
                </div>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-2 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            {/* Left: Query Input & Settings */}
            <div className="w-1/3 border-r border-slate-800 bg-slate-950/50 flex flex-col p-4 space-y-4 overflow-y-auto">
                
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Class Expression</label>
                    <textarea 
                        className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-purple-500 font-mono resize-none shadow-inner"
                        placeholder="e.g. Person and hasAge some integer"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                    />
                    <button 
                        onClick={() => handleExecute()}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-sm font-medium transition-colors shadow-lg"
                    >
                        Execute
                    </button>
                    {error && <div className="text-xs text-red-400 px-1">{error}</div>}
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Query For</label>
                    <div className="space-y-1">
                        <button 
                            onClick={() => setQueryType('subclasses')}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${queryType === 'subclasses' ? 'bg-purple-900/30 text-purple-300 border border-purple-800' : 'text-slate-400 hover:bg-slate-800'}`}
                        >
                            <ArrowDownCircle size={16} /> Sub Classes
                        </button>
                        <button 
                            onClick={() => setQueryType('superclasses')}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${queryType === 'superclasses' ? 'bg-purple-900/30 text-purple-300 border border-purple-800' : 'text-slate-400 hover:bg-slate-800'}`}
                        >
                            <ArrowUpCircle size={16} /> Super Classes
                        </button>
                        <button 
                            onClick={() => setQueryType('instances')}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${queryType === 'instances' ? 'bg-purple-900/30 text-purple-300 border border-purple-800' : 'text-slate-400 hover:bg-slate-800'}`}
                        >
                            <User size={16} /> Instances
                        </button>
                    </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                     <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                         <Lightbulb size={12} /> Example Queries
                     </label>
                     <div className="space-y-1">
                         {EXAMPLE_QUERIES.map((ex, i) => (
                             <button
                                key={i}
                                onClick={() => loadExample(ex)}
                                className="w-full text-left px-3 py-2 rounded-md border border-slate-800 hover:border-slate-600 bg-slate-900 hover:bg-slate-800 transition-all group"
                             >
                                 <div className="flex justify-between items-center mb-0.5">
                                    <span className="text-xs font-bold text-slate-300 group-hover:text-purple-300">{ex.label}</span>
                                    <span className="text-[9px] uppercase text-slate-600 bg-slate-950 px-1 rounded">{ex.type.slice(0,3)}</span>
                                 </div>
                                 <div className="text-[10px] text-slate-500 font-mono truncate">{ex.query}</div>
                             </button>
                         ))}
                     </div>
                </div>
            </div>

            {/* Right: Results */}
            <div className="flex-1 bg-slate-900 flex flex-col">
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                    <h3 className="text-sm font-medium text-slate-300">Results</h3>
                    <span className="text-xs text-slate-500">{results.length} found</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {results.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {results.map(node => (
                                <div key={node.id} className="relative group">
                                    <div className="absolute inset-0 bg-purple-500/5 rounded-lg blur opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="relative flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-lg shadow-sm hover:border-purple-500/50 transition-colors">
                                        <div className={`p-2 rounded-md ${node.data.type === ElementType.OWL_NAMED_INDIVIDUAL ? 'bg-pink-900/20 text-pink-400' : 'bg-blue-900/20 text-blue-400'}`}>
                                            {node.data.type === ElementType.OWL_NAMED_INDIVIDUAL ? <User size={18} /> : <Database size={18} />}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-200">{node.data.label}</div>
                                            <div className="text-[10px] text-slate-500 font-mono">{node.data.iri || node.id}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-2">
                             <Search size={32} className="opacity-20" />
                             <p className="text-sm">No results found.</p>
                             {query && <p className="text-xs opacity-50">Check your spelling or ontology logic.</p>}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DLQueryModal;