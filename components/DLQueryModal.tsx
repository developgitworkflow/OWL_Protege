
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, Database, User, ArrowDownCircle, ArrowUpCircle, CheckCircle2, Lightbulb, Sparkles, Loader2, ArrowRight, BookOpen, ExternalLink } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { classifyOntology, executeDLQuery, QueryType } from '../services/reasonerService';
import { generateDLQuery } from '../services/geminiService';
import { generateManchesterSyntax } from '../services/manchesterSyntaxGenerator';
import UMLNode from './UMLNode';

interface DLQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node<UMLNodeData>[];
  edges: Edge[];
}

const STATIC_EXAMPLES = [
    { label: 'All Classes', query: 'owl:Class', type: 'subclasses' as QueryType, desc: 'List all defined OWL Classes' },
    { label: 'All Individuals', query: 'owl:NamedIndividual', type: 'instances' as QueryType, desc: 'List all defined Individuals' },
];

const DLQueryModal: React.FC<DLQueryModalProps> = ({ isOpen, onClose, nodes, edges }) => {
  const [query, setQuery] = useState('');
  const [queryType, setQueryType] = useState<QueryType>('subclasses');
  const [results, setResults] = useState<Node<UMLNodeData>[]>([]);
  const [isClassified, setIsClassified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // AI State
  const [naturalLanguage, setNaturalLanguage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSyntaxGuide, setShowSyntaxGuide] = useState(false);

  // Editor Refs
  const backdropRef = useRef<HTMLDivElement>(null);

  // Auto-classify on open (Simulating a Reasoner sync)
  useEffect(() => {
      if (isOpen) {
          try {
              classifyOntology(nodes, edges);
              setIsClassified(true);
              setResults([]);
              setError(null);
              // Do not clear naturalLanguage to allow persistence if user closes/reopens quickly
          } catch (e) {
              setError("Failed to classify ontology.");
          }
      }
  }, [isOpen, nodes, edges]);

  // --- Dynamic Examples Generator ---
  const { suggestedPrompts, dynamicSyntaxExamples } = useMemo(() => {
      const classes = nodes.filter(n => n.data.type === ElementType.OWL_CLASS);
      const props = nodes.filter(n => n.data.type === ElementType.OWL_OBJECT_PROPERTY);
      
      const prompts = new Set<string>();
      const syntaxEx: typeof STATIC_EXAMPLES = [];

      // 1. Class Examples
      if (classes.length > 0) {
          const c = classes[Math.floor(Math.random() * classes.length)];
          prompts.add(`Show me all subclasses of ${c.data.label}`);
          prompts.add(`Find every ${c.data.label}`);
      }

      // 2. Property / Relationship Examples from Edges
      // Look for S --p--> O patterns
      const relEdges = edges.filter(e => !['subClassOf', 'rdf:type', 'rdfs:subClassOf', 'a'].includes(e.label as string));
      const relationships: {s:string, p:string, o:string}[] = [];

      relEdges.forEach(e => {
          const s = nodes.find(n => n.id === e.source);
          const t = nodes.find(n => n.id === e.target);
          if (s && t && s.data.type === ElementType.OWL_CLASS && t.data.type === ElementType.OWL_CLASS) {
              let pName = (e.label as string);
              if (pName.includes(':')) pName = pName.split(':')[1];
              relationships.push({ s: s.data.label, p: pName, o: t.data.label });
          }
      });

      // Shuffle and pick a few
      const pickedRels = relationships.sort(() => 0.5 - Math.random()).slice(0, 3);
      
      pickedRels.forEach(rel => {
          // Natural Language Pattern
          prompts.add(`${rel.s} that ${rel.p} some ${rel.o}`);
          
          // Manchester Syntax Pattern
          syntaxEx.push({
              label: `${rel.p} some ${rel.o}`,
              query: `${rel.p} some ${rel.o}`,
              type: 'subclasses',
              desc: `Classes related to ${rel.o}`
          });
      });

      // 3. Intersection Example if we have enough classes
      if (classes.length >= 2 && Math.random() > 0.5) {
          const c1 = classes[0].data.label;
          const c2 = classes[1].data.label;
          prompts.add(`Everything that is both ${c1} and ${c2}`);
          syntaxEx.push({
              label: `${c1} and ${c2}`,
              query: `${c1} and ${c2}`,
              type: 'subclasses',
              desc: 'Intersection of classes'
          });
      }

      return {
          suggestedPrompts: Array.from(prompts).slice(0, 4),
          dynamicSyntaxExamples: syntaxEx
      };
  }, [nodes, edges]);

  const allExamples = [...dynamicSyntaxExamples, ...STATIC_EXAMPLES];

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

  const loadExample = (ex: typeof STATIC_EXAMPLES[0]) => {
      setQuery(ex.query);
      setQueryType(ex.type);
      handleExecute(ex.query, ex.type);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleExecute();
      }
  };

  const handleGenerateQuery = async () => {
      if (!naturalLanguage.trim()) return;
      
      setIsGenerating(true);
      
      // Build Context String using Manchester Syntax Generator
      // This provides the AI with the full structure (Classes, Properties, Axioms, Individuals)
      // allowing it to infer relationships correctly.
      const context = generateManchesterSyntax(nodes, edges, { 
          name: 'QueryContext', 
          baseIri: 'http://context.org#', 
          defaultPrefix: '' 
      });
      
      const generatedQuery = await generateDLQuery(naturalLanguage, context);
      
      if (generatedQuery) {
          setQuery(generatedQuery);
          setError(null);
      } else {
          setError("Could not generate query. Please try specific terms matching your ontology.");
      }
      
      setIsGenerating(false);
  };

  // --- Highlighting Logic ---
  const renderHighlightedQuery = () => {
      if (!query) return <span className="text-slate-600 italic select-none">e.g. Person and teaches some Course</span>;
      
      const keywords = new Set(['and', 'or', 'not', 'some', 'only', 'value', 'min', 'max', 'exactly', 'self', 'that']);
      // Split by delimiters, keeping delimiters in the array
      const parts = query.split(/(\b(?:and|or|not|some|only|value|min|max|exactly|self|that)\b)/g);
      
      return parts.map((part, i) => {
          if (keywords.has(part)) {
              return <span key={i} className="text-purple-400 font-bold">{part}</span>;
          }
          // Highlight standard types slightly differently? For now keep slate-200
          return <span key={i} className="text-slate-200">{part}</span>;
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
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-5xl bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-700 flex flex-col h-[85vh] overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200">
        
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
            <div className="w-96 border-r border-slate-800 bg-slate-950/50 flex flex-col p-5 space-y-5 overflow-y-auto">
                
                {/* AI Natural Language Input */}
                <div className="space-y-3 pb-4 border-b border-slate-800">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles size={14} /> Natural Language
                        </label>
                    </div>
                    
                    <div className="relative group">
                        <textarea 
                            className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:border-blue-500 outline-none placeholder-slate-600 resize-none leading-relaxed transition-all shadow-inner"
                            placeholder="Describe your query in plain English..."
                            value={naturalLanguage}
                            onChange={(e) => setNaturalLanguage(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerateQuery(); } }}
                        />
                        <button 
                            onClick={handleGenerateQuery}
                            disabled={isGenerating || !naturalLanguage.trim()}
                            className="absolute bottom-2 right-2 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-md transition-all disabled:opacity-50 shadow-lg hover:shadow-blue-500/20"
                            title="Generate DL Query"
                        >
                            {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
                        </button>
                    </div>

                    {/* Contextual Examples */}
                    {suggestedPrompts.length > 0 && (
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase">Try asking:</span>
                            <div className="flex flex-wrap gap-2">
                                {suggestedPrompts.map((p, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setNaturalLanguage(p)}
                                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500/30 rounded-md text-xs text-slate-300 hover:text-blue-300 transition-all text-left truncate max-w-full shadow-sm"
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* DL Query Input with Syntax Highlighting */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Class Expression (Manchester)</label>
                        <button 
                            onClick={() => setShowSyntaxGuide(!showSyntaxGuide)}
                            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors ${showSyntaxGuide ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-blue-400'}`}
                        >
                            <BookOpen size={12} /> Syntax
                        </button>
                    </div>
                    
                    {/* Syntax Cheat Sheet */}
                    {showSyntaxGuide && (
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 animate-in fade-in slide-in-from-top-2 shadow-xl">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-mono text-slate-400">
                                <div><span className="text-purple-400 font-bold">and</span> Intersection</div>
                                <div><span className="text-purple-400 font-bold">or</span> Union</div>
                                <div><span className="text-purple-400 font-bold">not</span> Negation</div>
                                <div><span className="text-purple-400 font-bold">some</span> Existential</div>
                                <div><span className="text-purple-400 font-bold">only</span> Universal</div>
                                <div><span className="text-purple-400 font-bold">value</span> Specific</div>
                                <div><span className="text-purple-400 font-bold">min</span> At least</div>
                                <div><span className="text-purple-400 font-bold">max</span> At most</div>
                                <div><span className="text-purple-400 font-bold">exactly</span> Exact</div>
                                <div><span className="text-purple-400 font-bold">self</span> Self ref</div>
                            </div>
                            <a 
                                href="https://protegeproject.github.io/protege/class-expression-syntax/" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 mt-3 text-[10px] text-blue-400 hover:text-blue-300 hover:underline border-t border-slate-800 pt-2"
                            >
                                Protege Documentation <ExternalLink size={10} />
                            </a>
                        </div>
                    )}

                    {/* Layered Text Editor */}
                    <div className="relative w-full h-32 rounded-lg border border-slate-700 bg-slate-900 shadow-inner focus-within:ring-1 focus-within:ring-purple-500/50 focus-within:border-purple-500 overflow-hidden transition-all">
                        {/* Backdrop (Syntax Highlighter) */}
                        <div 
                            ref={backdropRef}
                            className="absolute inset-0 p-3 text-sm font-mono whitespace-pre-wrap break-words pointer-events-none overflow-hidden leading-relaxed"
                            aria-hidden="true"
                        >
                            {renderHighlightedQuery()}
                        </div>
                        
                        {/* Transparent Input */}
                        <textarea 
                            className="absolute inset-0 w-full h-full bg-transparent p-3 text-sm font-mono text-transparent caret-white resize-none outline-none z-10 leading-relaxed"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onScroll={handleScroll}
                            spellCheck={false}
                            autoCapitalize="off"
                            autoComplete="off"
                        />
                    </div>

                    <button 
                        onClick={() => handleExecute()}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-sm font-medium transition-colors shadow-lg"
                    >
                        Execute Query
                    </button>
                    {error && <div className="text-xs text-red-400 px-1 bg-red-950/20 p-2 rounded border border-red-900/30">{error}</div>}
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Query For</label>
                    <div className="grid grid-cols-3 gap-1">
                        <button 
                            onClick={() => setQueryType('subclasses')}
                            className={`px-2 py-2 rounded-md text-[10px] font-medium flex flex-col items-center gap-1 transition-colors ${queryType === 'subclasses' ? 'bg-purple-900/30 text-purple-300 border border-purple-800' : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'}`}
                        >
                            <ArrowDownCircle size={14} /> Sub
                        </button>
                        <button 
                            onClick={() => setQueryType('superclasses')}
                            className={`px-2 py-2 rounded-md text-[10px] font-medium flex flex-col items-center gap-1 transition-colors ${queryType === 'superclasses' ? 'bg-purple-900/30 text-purple-300 border border-purple-800' : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'}`}
                        >
                            <ArrowUpCircle size={14} /> Super
                        </button>
                        <button 
                            onClick={() => setQueryType('instances')}
                            className={`px-2 py-2 rounded-md text-[10px] font-medium flex flex-col items-center gap-1 transition-colors ${queryType === 'instances' ? 'bg-purple-900/30 text-purple-300 border border-purple-800' : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'}`}
                        >
                            <User size={14} /> Instances
                        </button>
                    </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800 flex-1 overflow-y-auto">
                     <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                         <Lightbulb size={12} /> Syntax Examples
                     </label>
                     <div className="space-y-1">
                         {allExamples.map((ex, i) => (
                             <button
                                key={i}
                                onClick={() => loadExample(ex)}
                                className="w-full text-left px-3 py-2 rounded-md border border-slate-800 hover:border-purple-500/30 bg-slate-900 hover:bg-slate-800 transition-all group"
                             >
                                 <div className="flex justify-between items-center mb-0.5">
                                    <span className="text-xs font-bold text-slate-300 group-hover:text-purple-300 truncate">{ex.label}</span>
                                    <span className="text-[9px] uppercase text-slate-600 bg-slate-950 px-1 rounded shrink-0">{ex.type.slice(0,3)}</span>
                                 </div>
                                 <div className="text-[10px] text-slate-500 font-mono truncate">{ex.desc}</div>
                             </button>
                         ))}
                     </div>
                </div>
            </div>

            {/* Right: Results */}
            <div className="flex-1 bg-slate-900 flex flex-col">
                <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                    <h3 className="text-sm font-medium text-slate-300">Results</h3>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-full">{results.length} found</span>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-slate-900/50">
                    {results.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {results.map(node => (
                                <div key={node.id} className="relative group">
                                    <div className="absolute inset-0 bg-purple-500/5 rounded-lg blur opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="relative flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-lg shadow-sm hover:border-purple-500/50 transition-colors">
                                        <div className={`p-2 rounded-md ${node.data.type === ElementType.OWL_NAMED_INDIVIDUAL ? 'bg-pink-900/20 text-pink-400' : (node.data.type === ElementType.OWL_OBJECT_PROPERTY || node.data.type === ElementType.OWL_DATA_PROPERTY ? 'bg-green-900/20 text-green-400' : 'bg-blue-900/20 text-blue-400')}`}>
                                            {node.data.type === ElementType.OWL_NAMED_INDIVIDUAL ? <User size={18} /> : (node.data.type === ElementType.OWL_CLASS ? <Database size={18} /> : <ArrowDownCircle size={18} />)}
                                        </div>
                                        <div className="overflow-hidden">
                                            <div className="text-sm font-medium text-slate-200 truncate">{node.data.label}</div>
                                            <div className="text-[10px] text-slate-500 font-mono truncate">{node.data.iri || node.id}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-4">
                             <div className="p-4 bg-slate-800/50 rounded-full">
                                <Search size={32} className="opacity-20" />
                             </div>
                             <div className="text-center">
                                <p className="text-sm font-medium">No results found.</p>
                                <p className="text-xs opacity-50 mt-1 max-w-xs mx-auto">Try using the AI generator or select an example from the sidebar.</p>
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

export default DLQueryModal;
