
import React, { useState, useMemo, useRef } from 'react';
import { X, Play, Code, Database, Table, FileJson, FileSpreadsheet, BookOpen, Layers, List, Tag, ArrowRight, User } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { executeSparql, SPARQL_TEMPLATES, SparqlResult } from '../services/sparqlService';

interface SPARQLModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node<UMLNodeData>[];
  edges: Edge[];
  onNavigate?: (view: string, id: string) => void;
}

// Prefixes for display shortening
const DISPLAY_PREFIXES: Record<string, string> = {
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#': 'rdf:',
    'http://www.w3.org/2000/01/rdf-schema#': 'rdfs:',
    'http://www.w3.org/2002/07/owl#': 'owl:',
    'http://www.w3.org/2001/XMLSchema#': 'xsd:',
    'http://example.org/ontology#': ':', // Default
};

const formatIRI = (iri: string) => {
    if (!iri) return '';
    for (const [ns, pfx] of Object.entries(DISPLAY_PREFIXES)) {
        if (iri.startsWith(ns)) {
            return iri.replace(ns, pfx);
        }
    }
    // Fallback for generic http
    if (iri.startsWith('http://')) {
        const parts = iri.split(/[#/]/);
        return `...${parts[parts.length - 1]}`;
    }
    return iri;
};

const SPARQLModal: React.FC<SPARQLModalProps> = ({ isOpen, onClose, nodes, edges, onNavigate }) => {
  const [query, setQuery] = useState(SPARQL_TEMPLATES[0].query);
  const [result, setResult] = useState<SparqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'results'>('editor');
  const [sidebarMode, setSidebarMode] = useState<'templates' | 'schema'>('templates');
  const backdropRef = useRef<HTMLDivElement>(null);

  const schemaItems = useMemo(() => {
      const classes = nodes.filter(n => n.data.type === ElementType.OWL_CLASS);
      const props = nodes.filter(n => n.data.type === ElementType.OWL_OBJECT_PROPERTY || n.data.type === ElementType.OWL_DATA_PROPERTY);
      const indivs = nodes.filter(n => n.data.type === ElementType.OWL_NAMED_INDIVIDUAL);
      return { classes, props, indivs };
  }, [nodes]);

  const handleRun = () => {
      try {
          setError(null);
          const res = executeSparql(query, nodes, edges);
          setResult(res);
          setActiveTab('results');
      } catch (e) {
          setError((e as Error).message);
          setResult(null);
      }
  };

  const insertText = (text: string) => {
      setQuery(prev => prev + ' ' + text);
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
      if (backdropRef.current) {
          backdropRef.current.scrollTop = e.currentTarget.scrollTop;
          backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
  };

  const renderHighlightedQuery = () => {
      // Basic highlighting regex
      const parts = query.split(/(\b(?:SELECT|WHERE|PREFIX|LIMIT|FILTER|OPTIONAL|UNION|DISTINCT)\b|[?][a-zA-Z0-9_]+|[<][^>]+[>]|[:][a-zA-Z0-9_]+)/g);
      
      return parts.map((part, i) => {
          if (['SELECT', 'WHERE', 'PREFIX', 'LIMIT', 'FILTER', 'OPTIONAL', 'UNION', 'DISTINCT'].includes(part)) {
              return <span key={i} className="text-purple-400 font-bold">{part}</span>;
          }
          if (part.startsWith('?')) {
              return <span key={i} className="text-amber-400">{part}</span>;
          }
          if (part.startsWith('<') || part.includes(':')) {
              return <span key={i} className="text-blue-300">{part}</span>;
          }
          return <span key={i} className="text-slate-300">{part}</span>;
      });
  };

  const renderCell = (value: string) => {
    if (!value) return <span className="text-slate-600 italic">null</span>;
    
    // Format IRI for display
    const displayValue = formatIRI(value);
    
    // Attempt to find node by matching IRI or Label
    // Note: executeSparql returns IRIs.
    const node = nodes.find(n => 
        (n.data.iri && n.data.iri === value) || 
        n.data.label === value || 
        value.endsWith(n.data.label)
    );

    if (node && onNavigate) {
        return (
            <div className="flex items-center justify-between group/cell gap-2">
                <span className="font-mono text-blue-300 truncate" title={value}>{displayValue}</span>
                <div className="flex gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity bg-slate-800 rounded p-0.5 border border-slate-700 shadow-lg z-10 shrink-0">
                    <button 
                        onClick={() => { onNavigate('design', node.id); onClose(); }}
                        className="p-1 hover:bg-indigo-500/20 hover:text-indigo-400 rounded transition-colors"
                        title="View in Graph"
                    >
                        <Layers size={12} />
                    </button>
                    <button 
                        onClick={() => { onNavigate('entities', node.id); onClose(); }}
                        className="p-1 hover:bg-blue-500/20 hover:text-blue-400 rounded transition-colors"
                        title="View in Catalog"
                    >
                        <List size={12} />
                    </button>
                </div>
            </div>
        );
    }
    
    return <span className="text-slate-300 truncate font-mono" title={value}>{displayValue}</span>;
  };

  const downloadJSON = () => {
      if (!result) return;
      const blob = new Blob([JSON.stringify(result.rows, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'query_results.json';
      a.click();
  };

  const downloadCSV = () => {
      if (!result) return;
      const headers = result.columns.join(',');
      const rows = result.rows.map(r => result.columns.map(c => `"${r[c] || ''}"`).join(',')).join('\n');
      const csv = `${headers}\n${rows}`;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'query_results.csv';
      a.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-6xl bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-700 flex flex-col h-[85vh] overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-pink-900/30 rounded-lg border border-pink-800 text-pink-400">
                 <Database size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-100">SPARQL Endpoint</h2>
                <p className="text-xs text-slate-400">Execute graph pattern queries against the active ontology</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-2 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            
            {/* Sidebar */}
            <div className="w-64 bg-slate-950/50 border-r border-slate-800 flex flex-col">
                <div className="flex border-b border-slate-800">
                    <button 
                        onClick={() => setSidebarMode('templates')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${sidebarMode === 'templates' ? 'text-pink-400 border-b-2 border-pink-500 bg-slate-800/30' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Templates
                    </button>
                    <button 
                        onClick={() => setSidebarMode('schema')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${sidebarMode === 'schema' ? 'text-blue-400 border-b-2 border-blue-500 bg-slate-800/30' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Schema
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {sidebarMode === 'templates' ? (
                        SPARQL_TEMPLATES.map((tpl, i) => (
                            <button
                                key={i}
                                onClick={() => { setQuery(tpl.query); setError(null); }}
                                className="w-full text-left p-3 rounded-lg hover:bg-slate-800 transition-colors group border border-transparent hover:border-slate-700"
                            >
                                <div className="text-sm font-bold text-slate-300 group-hover:text-blue-300 mb-1">{tpl.label}</div>
                                <div className="text-[10px] text-slate-500 leading-snug">{tpl.desc}</div>
                            </button>
                        ))
                    ) : (
                        <div className="space-y-4 p-2">
                            {schemaItems.classes.length > 0 && (
                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Layers size={10}/> Classes</h4>
                                    <div className="space-y-1">
                                        {schemaItems.classes.map(c => (
                                            <button key={c.id} onClick={() => insertText(`:${c.data.label}`)} className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-slate-800 text-xs text-purple-300 hover:text-white transition-colors">
                                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                                                {c.data.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {schemaItems.props.length > 0 && (
                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Tag size={10}/> Properties</h4>
                                    <div className="space-y-1">
                                        {schemaItems.props.map(p => (
                                            <button key={p.id} onClick={() => insertText(`:${p.data.label}`)} className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-slate-800 text-xs text-blue-300 hover:text-white transition-colors">
                                                <div className="w-1.5 h-1.5 rounded-sm bg-blue-500"></div>
                                                {p.data.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {schemaItems.indivs.length > 0 && (
                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1"><User size={10}/> Individuals</h4>
                                    <div className="space-y-1">
                                        {schemaItems.indivs.map(i => (
                                            <button key={i.id} onClick={() => insertText(`:${i.data.label}`)} className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-slate-800 text-xs text-teal-300 hover:text-white transition-colors">
                                                <div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div>
                                                {i.data.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col bg-slate-900">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                        <button 
                            onClick={() => setActiveTab('editor')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'editor' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Code size={14} /> Editor
                        </button>
                        <button 
                            onClick={() => setActiveTab('results')}
                            disabled={!result}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'results' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white disabled:opacity-50'}`}
                        >
                            <Table size={14} /> Results {result && `(${result.rows.length})`}
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button 
                            onClick={handleRun}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-green-900/20"
                        >
                            <Play size={16} fill="currentColor" /> Run Query
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    {activeTab === 'editor' && (
                        <div className="h-full flex flex-col relative">
                            {/* Editor with Backdrop for Highlight */}
                            <div className="flex-1 relative font-mono text-sm">
                                {/* Backdrop */}
                                <div 
                                    ref={backdropRef}
                                    className="absolute inset-0 p-6 whitespace-pre-wrap break-words pointer-events-none overflow-hidden leading-relaxed text-transparent bg-slate-950 z-0"
                                    aria-hidden="true"
                                >
                                    {renderHighlightedQuery()}
                                </div>
                                {/* Input */}
                                <textarea 
                                    className="absolute inset-0 w-full h-full bg-transparent p-6 text-transparent caret-white outline-none resize-none leading-relaxed z-10"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onScroll={handleScroll}
                                    spellCheck={false}
                                    autoCapitalize="off"
                                />
                            </div>
                            
                            {error && (
                                <div className="absolute bottom-0 left-0 right-0 bg-red-900/90 border-t border-red-700 p-4 text-red-100 text-sm font-mono flex items-center gap-3 z-20">
                                    <div className="p-1 bg-red-800 rounded"><X size={14}/></div>
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'results' && result && (
                        <div className="h-full flex flex-col">
                            <div className="flex-1 overflow-auto bg-slate-950 p-6">
                                <table className="w-full text-left border-collapse table-fixed">
                                    <thead>
                                        <tr>
                                            {result.columns.map(col => (
                                                <th key={col} className="p-3 border-b border-slate-800 bg-slate-900/50 text-xs font-bold text-slate-400 uppercase tracking-wider sticky top-0 text-left">
                                                    ?{col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50 font-mono text-xs">
                                        {result.rows.map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                                {result.columns.map(col => (
                                                    <td key={col} className="p-3 text-slate-300 truncate relative group/cell">
                                                        {renderCell(row[col] || '')}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {result.rows.length === 0 && (
                                    <div className="text-center py-12 text-slate-600 italic">No results found.</div>
                                )}
                            </div>
                            
                            <div className="p-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center text-xs text-slate-500">
                                <div>Execution Time: {result.executionTime.toFixed(2)}ms</div>
                                <div className="flex gap-2">
                                    <button onClick={downloadJSON} className="flex items-center gap-1 hover:text-blue-400"><FileJson size={14}/> JSON</button>
                                    <button onClick={downloadCSV} className="flex items-center gap-1 hover:text-green-400"><FileSpreadsheet size={14}/> CSV</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default SPARQLModal;
