
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Play, Code, Database, Table, FileJson, FileSpreadsheet, Layers, List, Tag, User, Copy, Check, Trash2, AlignLeft, Search as SearchIcon, Download, Box, ArrowRight, FolderTree, Network, Info, Globe, ExternalLink, Type, Braces, Sigma, Key, GitBranch } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { executeSparql, SPARQL_TEMPLATES, SparqlResult } from '../services/sparqlService';

interface SPARQLModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node<UMLNodeData>[];
  edges: Edge[];
  onNavigate?: (view: string, id: string) => void;
  baseIri?: string;
}

const SPARQLModal: React.FC<SPARQLModalProps> = ({ isOpen, onClose, nodes, edges, onNavigate, baseIri = 'http://example.org/ontology#' }) => {
  const [query, setQuery] = useState(SPARQL_TEMPLATES[0].query);
  const [result, setResult] = useState<SparqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'results'>('editor');
  const [copied, setCopied] = useState(false);
  const [resultFilter, setResultFilter] = useState('');
  
  // Tooltip State
  const [hoverNode, setHoverNode] = useState<{ node: Node<UMLNodeData>, x: number, y: number } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const backdropRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Sync scroll between textarea, backdrop (highlighting), and line numbers
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
      const scrollTop = e.currentTarget.scrollTop;
      const scrollLeft = e.currentTarget.scrollLeft;
      
      if (backdropRef.current) {
          backdropRef.current.scrollTop = scrollTop;
          backdropRef.current.scrollLeft = scrollLeft;
      }
      if (lineNumbersRef.current) {
          lineNumbersRef.current.scrollTop = scrollTop;
      }
  };

  const handleRun = () => {
      try {
          setError(null);
          const res = executeSparql(query, nodes, edges, baseIri);
          setResult(res);
          setActiveTab('results');
      } catch (e) {
          setError((e as Error).message);
          setResult(null);
      }
  };

  const handleFormat = () => {
      // Basic SPARQL formatting
      let formatted = query
          .replace(/\s+/g, ' ') // Collapse whitespace
          .replace(/ \./g, ' .\n') // Newline after dot
          .replace(/ \{/g, ' {\n  ') // Indent after {
          .replace(/ \}/g, '\n}') // Newline before }
          .replace(/;/g, ';\n  ') // Newline after ;
          .replace(/WHERE/g, '\nWHERE')
          .replace(/PREFIX/g, '\nPREFIX')
          .replace(/SELECT/g, '\nSELECT')
          .replace(/^\n+/, ''); // Remove leading newline
      setQuery(formatted);
  };

  const handleCopy = () => {
      navigator.clipboard.writeText(query);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
      setQuery('');
      setResult(null);
      setError(null);
  };

  const handleDownloadJSON = () => {
      if (!result) return;
      const blob = new Blob([JSON.stringify(result.rows, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'query_results.json';
      a.click();
  };

  const handleDownloadCSV = () => {
      if (!result) return;
      const header = result.columns.join(',');
      const rows = result.rows.map(row => result.columns.map(col => `"${row[col] || ''}"`).join(','));
      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'query_results.csv';
      a.click();
  };

  // --- Tooltip Logic ---
  const handleCellEnter = (e: React.MouseEvent, node: Node<UMLNodeData>) => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      
      const rect = e.currentTarget.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      // Determine position (prefer bottom-right of cursor/element, flip if needed)
      // Expanded width to 384px (w-96)
      const CARD_HEIGHT = 400; 
      const CARD_WIDTH = 384; 

      let y = rect.bottom + 10;
      let x = rect.left;

      if (y + CARD_HEIGHT > viewportHeight) {
          y = rect.top - CARD_HEIGHT; // Flip up
      }
      if (x + CARD_WIDTH > viewportWidth) {
          x = viewportWidth - CARD_WIDTH - 20; // Flip left/adjust
      }

      setHoverNode({ node, x, y });
  };

  const handleCellLeave = () => {
      hoverTimeoutRef.current = setTimeout(() => {
          setHoverNode(null);
      }, 300); // Grace period to move mouse into tooltip
  };

  const renderCell = (value: string) => {
    if (!value) return <span className="text-slate-700 italic text-[10px]">null</span>;
    
    // 1. Internal Node Match (Entity)
    const node = nodes.find(n => n.data.iri === value || n.data.label === value || value.endsWith(n.data.label) || value === `<${n.data.iri}>`);
    
    if (node) {
        let Icon = Box;
        let colorClass = "text-slate-400 bg-slate-800/50 border-slate-700";
        
        if (node.data.type === ElementType.OWL_CLASS) { 
            Icon = Database; 
            colorClass = "text-indigo-400 bg-indigo-950/30 border-indigo-500/30"; 
        } else if (node.data.type === ElementType.OWL_NAMED_INDIVIDUAL) { 
            Icon = User; 
            colorClass = "text-teal-400 bg-teal-950/30 border-teal-500/30"; 
        } else if (node.data.type === ElementType.OWL_OBJECT_PROPERTY) { 
            Icon = ArrowRight; 
            colorClass = "text-blue-400 bg-blue-950/30 border-blue-500/30"; 
        } else if (node.data.type === ElementType.OWL_DATA_PROPERTY) { 
            Icon = Tag; 
            colorClass = "text-emerald-400 bg-emerald-950/30 border-emerald-500/30"; 
        }

        return (
            <div 
                className="relative inline-block group"
                onMouseEnter={(e) => handleCellEnter(e, node)}
                onMouseLeave={handleCellLeave}
            >
                <button 
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium transition-all hover:brightness-110 ${colorClass}`}
                    onClick={() => { if(onNavigate) { onNavigate('design', node.id); onClose(); } }}
                >
                    <Icon size={12} />
                    <span className="truncate max-w-[150px]">{node.data.label}</span>
                </button>
            </div>
        );
    }
    
    // 2. External URL (IRI)
    if (value.startsWith('http') || value.startsWith('<http')) {
        const cleanUrl = value.replace(/^<|>$/g, '');
        return (
            <a 
                href={cleanUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center gap-2 max-w-full w-fit bg-cyan-950/20 hover:bg-cyan-950/40 border border-cyan-900/50 rounded px-2 py-1 group transition-colors" 
                title={cleanUrl}
            >
                <Globe size={10} className="text-cyan-500 shrink-0" />
                <span className="text-cyan-400 text-[11px] font-mono truncate underline decoration-dotted decoration-cyan-700 hover:decoration-solid underline-offset-2">
                    {cleanUrl}
                </span>
                <ExternalLink size={10} className="text-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </a>
        );
    }
    
    // 3. Literal
    let displayValue = value;
    let badge = null;

    if (value.startsWith('"')) {
        // Strip quotes
        displayValue = value.replace(/^"|"(?:\^\^<[^>]+>|@[a-zA-Z-]+)?$/g, '');
        
        // Check for Lang tag
        const langMatch = value.match(/"@([a-zA-Z-]+)$/);
        if (langMatch) {
            badge = <span className="text-[9px] bg-slate-800 text-slate-500 px-1 rounded ml-1 uppercase">{langMatch[1]}</span>;
        } 
        // Check for Type
        else {
            const typeMatch = value.match(/"\^\^<?([^>]+)>?$/);
            if (typeMatch) {
                const type = typeMatch[1].split('#').pop() || typeMatch[1];
                badge = <span className="text-[9px] bg-amber-950/30 text-amber-500 px-1 rounded ml-1 font-mono">{type}</span>;
            }
        }
        
        return (
            <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-900/30 px-2 py-1 rounded border border-slate-800/50 w-fit max-w-full" title={value}>
                <Type size={10} className="text-slate-600 shrink-0" />
                <span className="truncate">{displayValue}</span>
                {badge}
            </div>
        );
    }

    // Default Fallback
    return <span className="text-slate-400 truncate text-xs font-mono" title={value}>{value}</span>;
  };

  const highlightSPARQL = (code: string) => {
    if (!code) return null;
    const parts = code.split(/(\s+|[{}().,;]|#.*$|"[^"]*"|'[^']*'|<[^>]*>|\?[a-zA-Z0-9_]+|[a-zA-Z0-9_]+:[a-zA-Z0-9_]+)/m);
    
    return parts.map((token, i) => {
        if (!token) return null;
        if (/^\s+$/.test(token)) return token;
        
        if (token.startsWith('#')) return <span key={i} className="text-slate-500 italic">{token}</span>;
        if (token.startsWith('"') || token.startsWith("'")) return <span key={i} className="text-green-400">{token}</span>;
        if (token.startsWith('<') && token.endsWith('>')) return <span key={i} className="text-cyan-400">{token}</span>;
        if (token.startsWith('?')) return <span key={i} className="text-amber-400 font-bold">{token}</span>;
        if (/^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$/.test(token)) return <span key={i} className="text-blue-300">{token}</span>;
        
        const keywords = ['SELECT', 'WHERE', 'LIMIT', 'PREFIX', 'OPTIONAL', 'UNION', 'FILTER', 'DISTINCT', 'ORDER', 'BY', 'AS', 'BASE', 'FROM', 'GRAPH', 'a', 'OFFSET', 'VALUES', 'BIND', 'MINUS', 'SERVICE'];
        if (keywords.includes(token.toUpperCase())) return <span key={i} className="text-purple-400 font-bold">{token}</span>;
        
        return <span key={i} className="text-slate-200">{token}</span>;
    });
  };

  const lineCount = useMemo(() => query.split('\n').length, [query]);
  const filteredRows = useMemo(() => {
      if (!result) return [];
      if (!resultFilter) return result.rows;
      const lower = resultFilter.toLowerCase();
      // Fix: Explicitly cast value to string before toLowerCase
      return result.rows.filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(lower)));
  }, [result, resultFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-6xl bg-slate-900 rounded-xl shadow-2xl flex flex-col h-[85vh] overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-pink-900/30 rounded-lg border border-pink-800 text-pink-400"><Database size={20} /></div>
             <div>
                <h2 className="text-lg font-bold text-slate-100">SPARQL Endpoint</h2>
                <p className="text-xs text-slate-400">Execute semantic queries against the in-memory graph</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white hover:bg-slate-800 p-2 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Templates */}
            <div className="w-64 bg-slate-950/50 border-r border-slate-800 flex flex-col p-2 space-y-1">
                <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Templates</span>
                    <span className="bg-slate-800 text-slate-400 px-1.5 rounded">{SPARQL_TEMPLATES.length}</span>
                </div>
                {SPARQL_TEMPLATES.map((tpl, i) => (
                    <button
                        key={i}
                        onClick={() => { setQuery(tpl.query); setActiveTab('editor'); }}
                        className="w-full text-left p-3 rounded-lg hover:bg-slate-800 transition-colors group border border-transparent hover:border-slate-700"
                    >
                        <div className="text-sm font-bold text-slate-300 group-hover:text-blue-300 mb-1">{tpl.label}</div>
                        <div className="text-[10px] text-slate-500 leading-snug group-hover:text-slate-400">{tpl.desc}</div>
                    </button>
                ))}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-slate-900">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex gap-2">
                        <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                            <button onClick={() => setActiveTab('editor')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${activeTab === 'editor' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
                                <Code size={14} /> Editor
                            </button>
                            <button onClick={() => setActiveTab('results')} disabled={!result} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${activeTab === 'results' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white disabled:opacity-50'}`}>
                                <Table size={14} /> Results
                                {result && <span className="bg-blue-500 text-white text-[9px] px-1 rounded-full">{result.rows.length}</span>}
                            </button>
                        </div>

                        {activeTab === 'editor' && (
                            <>
                                <div className="w-px h-6 bg-slate-800 mx-1"></div>
                                <button onClick={handleFormat} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded" title="Format Query">
                                    <AlignLeft size={16} />
                                </button>
                                <button onClick={handleCopy} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded" title="Copy Query">
                                    {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                                </button>
                                <button onClick={handleClear} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded" title="Clear">
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}
                        
                        {activeTab === 'results' && result && (
                            <>
                                <div className="w-px h-6 bg-slate-800 mx-1"></div>
                                <button onClick={handleDownloadJSON} className="flex items-center gap-1.5 px-2 py-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded text-xs font-medium transition-colors">
                                    <FileJson size={14} /> JSON
                                </button>
                                <button onClick={handleDownloadCSV} className="flex items-center gap-1.5 px-2 py-1.5 text-slate-400 hover:text-green-400 hover:bg-slate-800 rounded text-xs font-medium transition-colors">
                                    <FileSpreadsheet size={14} /> CSV
                                </button>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {activeTab === 'results' && (
                            <div className="relative">
                                <SearchIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input 
                                    className="bg-slate-800 border border-slate-700 rounded-full pl-8 pr-3 py-1 text-xs text-slate-200 outline-none focus:border-blue-500 w-40"
                                    placeholder="Filter results..."
                                    value={resultFilter}
                                    onChange={(e) => setResultFilter(e.target.value)}
                                />
                            </div>
                        )}
                        <button onClick={handleRun} className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-md text-sm font-bold transition-all shadow-lg hover:shadow-green-500/20">
                            <Play size={16} fill="currentColor" /> Run Query
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden relative bg-slate-950">
                    {activeTab === 'editor' && (
                        <div className="h-full flex font-mono text-sm">
                            {/* Line Numbers */}
                            <div 
                                ref={lineNumbersRef}
                                className="w-12 bg-slate-900 border-r border-slate-800 text-slate-600 text-right pr-3 pt-4 select-none overflow-hidden text-xs leading-relaxed"
                            >
                                {Array.from({ length: lineCount }).map((_, i) => (
                                    <div key={i}>{i + 1}</div>
                                ))}
                            </div>

                            {/* Editor Container */}
                            <div className="flex-1 relative">
                                {/* Backdrop for highlighting */}
                                <div 
                                    ref={backdropRef}
                                    className="absolute inset-0 p-4 whitespace-pre-wrap break-words pointer-events-none text-transparent z-0 overflow-auto leading-relaxed"
                                    aria-hidden="true"
                                >
                                    {highlightSPARQL(query)}
                                </div>

                                {/* Editable Textarea */}
                                <textarea 
                                    ref={textareaRef}
                                    className="absolute inset-0 w-full h-full bg-transparent p-4 text-transparent caret-white outline-none resize-none leading-relaxed z-10 font-mono"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onScroll={handleScroll}
                                    spellCheck={false}
                                    autoCapitalize="off"
                                    autoComplete="off"
                                />
                            </div>
                            
                            {error && (
                                <div className="absolute bottom-0 left-12 right-0 bg-red-900/95 border-t border-red-700 p-3 text-red-100 text-xs font-mono flex items-center gap-3 z-20 backdrop-blur-sm animate-in slide-in-from-bottom-2">
                                    <div className="p-1 bg-red-800 rounded shrink-0"><X size={14}/></div>
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'results' && result && (
                        <div className="h-full flex flex-col">
                            <div className="flex-1 overflow-auto bg-slate-950">
                                {filteredRows.length > 0 ? (
                                    <table className="w-full text-left border-collapse table-auto min-w-full">
                                        <thead className="sticky top-0 z-10">
                                            <tr>
                                                <th className="w-12 p-3 border-b border-slate-800 bg-slate-900 text-xs font-bold text-slate-500 text-center">#</th>
                                                {result.columns.map(col => (
                                                    <th key={col} className="p-3 border-b border-slate-800 bg-slate-900 text-xs font-bold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                                                        ?{col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50 font-mono text-xs">
                                            {filteredRows.map((row, i) => (
                                                <tr key={i} className="hover:bg-slate-800/30 transition-colors group">
                                                    <td className="p-3 text-slate-600 text-center align-top pt-4">{i + 1}</td>
                                                    {result.columns.map(col => (
                                                        <td key={col} className="p-3 max-w-[300px] align-top">
                                                            {renderCell(row[col] || '')}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                                        <SearchIcon size={32} className="opacity-20" />
                                        <p>No results match your filter.</p>
                                    </div>
                                )}
                            </div>
                            <div className="p-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center text-xs text-slate-500">
                                <div className="flex gap-4">
                                    <span>Time: <span className="text-slate-300 font-mono">{result.executionTime.toFixed(2)}ms</span></span>
                                    <span>Rows: <span className="text-slate-300 font-mono">{result.rows.length}</span></span>
                                </div>
                                {result.rows.length > filteredRows.length && (
                                    <div className="text-amber-500">Filtered: Showing {filteredRows.length} of {result.rows.length}</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
        
        {/* Floating Tooltip for Entity Details */}
        {hoverNode && (
            <div 
                className="fixed z-[100] w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                style={{ left: hoverNode.x, top: hoverNode.y }}
                onMouseEnter={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); }}
                onMouseLeave={() => { setHoverNode(null); }}
            >
                {/* 1. Identity Header */}
                <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-start justify-between">
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg border bg-slate-900 ${
                            hoverNode.node.data.type === ElementType.OWL_CLASS ? 'border-indigo-500/30 text-indigo-400' :
                            hoverNode.node.data.type === ElementType.OWL_NAMED_INDIVIDUAL ? 'border-teal-500/30 text-teal-400' :
                            hoverNode.node.data.type === ElementType.OWL_OBJECT_PROPERTY ? 'border-blue-500/30 text-blue-400' :
                            'border-emerald-500/30 text-emerald-400'
                        }`}>
                            {hoverNode.node.data.type === ElementType.OWL_CLASS && <Database size={18} />}
                            {hoverNode.node.data.type === ElementType.OWL_NAMED_INDIVIDUAL && <User size={18} />}
                            {hoverNode.node.data.type === ElementType.OWL_OBJECT_PROPERTY && <ArrowRight size={18} />}
                            {hoverNode.node.data.type === ElementType.OWL_DATA_PROPERTY && <Tag size={18} />}
                        </div>
                        <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                                {hoverNode.node.data.type.replace('owl_', '').replace('_', ' ')}
                            </div>
                            <div className="text-base font-bold text-white leading-tight">{hoverNode.node.data.label}</div>
                        </div>
                    </div>
                </div>

                <div className="max-h-[320px] overflow-y-auto p-4 space-y-4 bg-slate-900">
                    
                    {/* 2. IRI */}
                    <div className="space-y-1">
                        <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                            <Globe size={10} /> Identifier (IRI)
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono break-all bg-slate-950 p-2 rounded border border-slate-800/50 select-all">
                            {hoverNode.node.data.iri || baseIri + hoverNode.node.data.label}
                        </div>
                    </div>
                    
                    {/* 3. Description/Annotations */}
                    {(hoverNode.node.data.description || (hoverNode.node.data.annotations && hoverNode.node.data.annotations.length > 0)) && (
                        <div className="space-y-2">
                            <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                                <Info size={10} /> Definitions & Metadata
                            </div>
                            <div className="space-y-1.5">
                                {hoverNode.node.data.description && (
                                    <div className="text-xs text-slate-300 italic leading-snug border-l-2 border-slate-700 pl-2">
                                        {hoverNode.node.data.description}
                                    </div>
                                )}
                                {hoverNode.node.data.annotations?.map((ann, i) => (
                                    <div key={i} className="flex gap-2 text-[10px]">
                                        <span className="font-mono text-slate-500 shrink-0">{ann.property}:</span>
                                        <span className="text-slate-400 truncate">{ann.value.replace(/"/g, '')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 4. Logic & Axioms */}
                    {(hoverNode.node.data.methods && hoverNode.node.data.methods.length > 0) && (
                        <div className="space-y-2">
                            <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                                <Sigma size={10} /> Formal Axioms
                            </div>
                            <div className="space-y-1">
                                {hoverNode.node.data.methods.slice(0, 4).map((m, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-slate-950/50 p-1.5 rounded border border-slate-800/50">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                            m.name === 'SubClassOf' ? 'bg-indigo-900/30 text-indigo-400' : 
                                            m.name === 'DisjointWith' ? 'bg-red-900/30 text-red-400' :
                                            'bg-slate-800 text-slate-400'
                                        }`}>{m.name}</span>
                                        <span className="text-[10px] font-mono text-slate-300 truncate flex-1" title={m.returnType}>{m.returnType}</span>
                                    </div>
                                ))}
                                {hoverNode.node.data.methods.length > 4 && (
                                    <div className="text-[9px] text-slate-500 italic pl-1">
                                        +{hoverNode.node.data.methods.length - 4} more axioms...
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 5. Data Properties / Characteristics */}
                    {(hoverNode.node.data.attributes && hoverNode.node.data.attributes.length > 0) && (
                        <div className="space-y-2">
                            <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                                {hoverNode.node.data.type === ElementType.OWL_CLASS ? <Tag size={10} /> : <GitBranch size={10} />}
                                {hoverNode.node.data.type === ElementType.OWL_CLASS ? 'Attributes' : 'Characteristics'}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {hoverNode.node.data.attributes.slice(0, 6).map((attr, i) => (
                                    <span key={i} className="text-[10px] px-2 py-1 bg-slate-800 rounded text-slate-300 border border-slate-700 flex items-center gap-1">
                                        {attr.name}
                                        {attr.type && <span className="text-slate-500 text-[9px] opacity-70">({attr.type})</span>}
                                    </span>
                                ))}
                                {hoverNode.node.data.attributes.length > 6 && <span className="text-[10px] text-slate-500">...</span>}
                            </div>
                        </div>
                    )}

                    {/* 6. Graph Topology Summary */}
                    <div className="pt-2 border-t border-slate-800/50">
                        <div className="text-[10px] text-slate-500 flex justify-between">
                            <span>Relations: {edges.filter(e => e.source === hoverNode.node.id || e