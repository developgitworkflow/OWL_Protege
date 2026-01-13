
import React, { useState, useMemo, useRef } from 'react';
import { X, Play, Code, Database, Table, FileJson, FileSpreadsheet, Layers, List, Tag, User } from 'lucide-react';
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

const SPARQLModal: React.FC<SPARQLModalProps> = ({ isOpen, onClose, nodes, edges, onNavigate }) => {
  const [query, setQuery] = useState(SPARQL_TEMPLATES[0].query);
  const [result, setResult] = useState<SparqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'results'>('editor');
  const backdropRef = useRef<HTMLDivElement>(null);
  
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

  const renderCell = (value: string) => {
    if (!value) return <span className="text-slate-600 italic">null</span>;
    // Simple logic to find node from IRI/Label match
    const node = nodes.find(n => n.data.iri === value || n.data.label === value || value.endsWith(n.data.label));
    
    if (node && onNavigate) {
        return (
            <button onClick={() => { onNavigate('design', node.id); onClose(); }} className="text-blue-400 hover:underline text-left">
                {value}
            </button>
        );
    }
    return <span className="text-slate-300 truncate" title={value}>{value}</span>;
  };

  const highlightSPARQL = (code: string) => {
    if (!code) return null;
    // Split by delimiters but keep them
    const parts = code.split(/(\s+|[{}().,;]|#.*$|"[^"]*"|'[^']*'|<[^>]*>|\?[a-zA-Z0-9_]+|[a-zA-Z0-9_]+:[a-zA-Z0-9_]+)/m);
    
    return parts.map((token, i) => {
        if (!token) return null;
        if (/^\s+$/.test(token)) return token;
        
        // Comments
        if (token.startsWith('#')) return <span key={i} className="text-slate-500 italic">{token}</span>;
        
        // Strings
        if (token.startsWith('"') || token.startsWith("'")) return <span key={i} className="text-green-400">{token}</span>;
        
        // IRIs
        if (token.startsWith('<') && token.endsWith('>')) return <span key={i} className="text-cyan-400">{token}</span>;
        
        // Variables
        if (token.startsWith('?')) return <span key={i} className="text-amber-400">{token}</span>;
        
        // Prefixed Names
        if (/^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$/.test(token)) return <span key={i} className="text-blue-300">{token}</span>;
        
        // Keywords
        const keywords = ['SELECT', 'WHERE', 'LIMIT', 'PREFIX', 'OPTIONAL', 'UNION', 'FILTER', 'DISTINCT', 'ORDER', 'BY', 'AS', 'BASE', 'FROM', 'GRAPH', 'a'];
        if (keywords.includes(token.toUpperCase())) return <span key={i} className="text-purple-400 font-bold">{token}</span>;
        
        // Default
        return <span key={i} className="text-slate-200">{token}</span>;
    });
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
      if (backdropRef.current) {
          backdropRef.current.scrollTop = e.currentTarget.scrollTop;
          backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-6xl bg-slate-900 rounded-xl shadow-2xl flex flex-col h-[85vh] overflow-hidden border border-slate-800">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-pink-900/30 rounded-lg border border-pink-800 text-pink-400"><Database size={20} /></div>
             <div>
                <h2 className="text-lg font-bold text-slate-100">SPARQL Endpoint</h2>
                <p className="text-xs text-slate-400">Query the ontology graph using standard SPARQL syntax</p>
             </div>
          </div>
          <button onClick={onClose}><X size={20} className="text-slate-500 hover:text-white" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            <div className="w-64 bg-slate-950/50 border-r border-slate-800 flex flex-col p-2 space-y-1">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider p-2">Templates</h3>
                {SPARQL_TEMPLATES.map((tpl, i) => (
                    <button
                        key={i}
                        onClick={() => setQuery(tpl.query)}
                        className="w-full text-left p-3 rounded-lg hover:bg-slate-800 transition-colors group"
                    >
                        <div className="text-sm font-bold text-slate-300 group-hover:text-blue-300 mb-1">{tpl.label}</div>
                        <div className="text-[10px] text-slate-500 leading-snug">{tpl.desc}</div>
                    </button>
                ))}
            </div>

            <div className="flex-1 flex flex-col bg-slate-900">
                <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                        <button onClick={() => setActiveTab('editor')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'editor' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                            <Code size={14} /> Editor
                        </button>
                        <button onClick={() => setActiveTab('results')} disabled={!result} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === 'results' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white disabled:opacity-50'}`}>
                            <Table size={14} /> Results
                        </button>
                    </div>
                    <button onClick={handleRun} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-bold transition-all">
                        <Play size={16} fill="currentColor" /> Run
                    </button>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    {activeTab === 'editor' && (
                        <div className="h-full relative font-mono text-sm">
                            {/* Backdrop for highlighting */}
                            <div 
                                ref={backdropRef}
                                className="absolute inset-0 p-6 whitespace-pre-wrap break-words pointer-events-none text-transparent z-0 overflow-hidden leading-relaxed"
                                aria-hidden="true"
                            >
                                {highlightSPARQL(query)}
                            </div>

                            {/* Transparent Textarea for input */}
                            <textarea 
                                className="absolute inset-0 w-full h-full bg-transparent p-6 text-transparent caret-white outline-none resize-none leading-relaxed z-10"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onScroll={handleScroll}
                                spellCheck={false}
                                autoCapitalize="off"
                                autoComplete="off"
                            />
                            
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
                                                <th key={col} className="p-3 border-b border-slate-800 bg-slate-900/50 text-xs font-bold text-slate-400 uppercase tracking-wider sticky top-0">?{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50 font-mono text-xs">
                                        {result.rows.map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                                {result.columns.map(col => (
                                                    <td key={col} className="p-3 truncate">{renderCell(row[col] || '')}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center text-xs text-slate-500">
                                <div>Execution Time: {result.executionTime.toFixed(2)}ms</div>
                                <div>{result.rows.length} results</div>
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
