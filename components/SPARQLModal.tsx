
import React, { useState, useEffect } from 'react';
import { X, Play, Code, Database, Table, Download, FileJson, FileSpreadsheet, Sparkles, BookOpen, Layers, List } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData } from '../types';
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

  const handleTemplateClick = (tQuery: string) => {
      setQuery(tQuery);
      setError(null);
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

  const renderCell = (value: string) => {
    if (!value) return <span className="text-slate-600 italic">null</span>;
    
    // Attempt to find node
    // Remove <> if present
    const cleanVal = value.startsWith('<') && value.endsWith('>') ? value.slice(1, -1) : value;
    
    const node = nodes.find(n => 
        n.id === cleanVal || 
        n.data.label === cleanVal || 
        n.data.iri === cleanVal ||
        (n.data.label && cleanVal.includes(n.data.label)) // Loose match for prefixed like ex:Person
    );

    if (node && onNavigate) {
        return (
            <div className="flex items-center justify-between group/cell">
                <span className="font-medium text-blue-200">{value}</span>
                <div className="flex gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity bg-slate-800 rounded p-0.5 border border-slate-700 absolute right-2 top-1/2 -translate-y-1/2 shadow-lg z-10">
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
    
    return value;
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
                <p className="text-xs text-slate-400">Query your ontology using standard patterns</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-2 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            
            {/* Sidebar: Templates */}
            <div className="w-64 bg-slate-950/50 border-r border-slate-800 flex flex-col">
                <div className="p-4 border-b border-slate-800">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <BookOpen size={14} /> Templates
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {SPARQL_TEMPLATES.map((tpl, i) => (
                        <button
                            key={i}
                            onClick={() => handleTemplateClick(tpl.query)}
                            className="w-full text-left p-3 rounded-lg hover:bg-slate-800 transition-colors group border border-transparent hover:border-slate-700"
                        >
                            <div className="text-sm font-bold text-slate-300 group-hover:text-blue-300 mb-1">{tpl.label}</div>
                            <div className="text-[10px] text-slate-500 leading-snug">{tpl.desc}</div>
                        </button>
                    ))}
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
                        <div className="h-full flex flex-col">
                            <textarea 
                                className="flex-1 w-full bg-slate-950 p-6 font-mono text-sm text-slate-200 outline-none resize-none leading-relaxed"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                spellCheck={false}
                                placeholder="SELECT * WHERE { ?s ?p ?o }"
                            />
                            {error && (
                                <div className="absolute bottom-0 left-0 right-0 bg-red-900/90 border-t border-red-700 p-4 text-red-100 text-sm font-mono flex items-center gap-3">
                                    <div className="p-1 bg-red-800 rounded"><X size={14}/></div>
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'results' && result && (
                        <div className="h-full flex flex-col">
                            <div className="flex-1 overflow-auto bg-slate-950 p-6">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr>
                                            {result.columns.map(col => (
                                                <th key={col} className="p-3 border-b border-slate-800 bg-slate-900/50 text-xs font-bold text-slate-400 uppercase tracking-wider sticky top-0">
                                                    ?{col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50 font-mono text-xs">
                                        {result.rows.map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                                {result.columns.map(col => (
                                                    <td key={col} className="p-3 text-slate-300 relative group/cell">
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
