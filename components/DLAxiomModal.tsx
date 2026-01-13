
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Sigma, BookOpen, Database, User, ArrowRightLeft, Info, Plus, Check, ListFilter, Tag, Command } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { validateManchesterSyntax } from '../services/manchesterValidator';

interface DLAxiomModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node<UMLNodeData>[];
  edges: Edge[];
  onUpdateOntology: (nodes: Node<UMLNodeData>[], edges: Edge[]) => void;
}

const MANCHESTER_KEYWORDS = [
    'and', 'or', 'not', 'some', 'only', 'value', 'min', 'max', 'exactly', 'that', 'self'
];

// --- DL Conversion Helpers ---

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

// Convert DL symbols back to Manchester syntax for internal storage
const fromDL = (dl: string): string => {
    let s = dl;
    s = s.replace(/⊓/g, ' and ');
    s = s.replace(/⊔/g, ' or ');
    s = s.replace(/¬/g, ' not ');
    s = s.replace(/∃/g, ' some ');
    s = s.replace(/∀/g, ' only ');
    s = s.replace(/∋/g, ' value ');
    s = s.replace(/≥/g, ' min ');
    s = s.replace(/≤/g, ' max ');
    s = s.replace(/=/g, ' exactly '); // CAREFUL: strict equal vs exactly. Simple heuristic.
    s = s.replace(/⁻/g, ''); // Inverse not easily handled in inline string without 'inverse ' keyword
    s = s.replace(/\s+/g, ' ').trim();
    return s;
};

const renderAxiom = (subject: string, type: string, object: string) => {
    const s = subject;
    const o = toDL(object);
    
    switch (type.toLowerCase()) {
        case 'subclassof': return <span>{s} ⊑ {o}</span>;
        case 'equivalentto':
        case 'equivalentclass': return <span>{s} ≡ {o}</span>;
        case 'disjointwith': return <span>{s} ⊓ {o} ⊑ ⊥</span>;
        
        case 'subpropertyof': return <span>{s} ⊑ {o}</span>;
        case 'inverseof': return <span>{s} ≡ {o}⁻</span>;
        case 'domain': return <span>∃{s}.⊤ ⊑ {o}</span>;
        case 'range': return <span>⊤ ⊑ ∀{s}.{o}</span>;
        
        case 'rdf:type':
        case 'a': return <span>{o}({s})</span>; 
        
        case 'sameas': return <span>{s} = {o}</span>;
        case 'differentfrom': return <span>{s} ≠ {o}</span>;
        
        default: return <span>{s} ? {o}</span>;
    }
};

const getAxiomExplanation = (s: string, type: string, o: string) => {
    const t = type.toLowerCase();
    switch (t) {
        case 'subclassof': return `Every instance of '${s}' is also an instance of '${o}'.`;
        case 'equivalentto':
        case 'equivalentclass': return `'${s}' and '${o}' are equivalent classes (they share the exact same instances).`;
        case 'disjointwith': return `No individual can be an instance of both '${s}' and '${o}'.`;
        case 'subpropertyof': return `If '${s}' relates two things, then '${o}' also relates them.`;
        case 'inverseof': return `'${s}' is the inverse of '${o}'. If A ${s} B, then B ${o} A.`;
        case 'domain': return `Any subject that has the property '${s}' must be of type '${o}'.`;
        case 'range': return `Any value of the property '${s}' must be of type '${o}'.`;
        case 'rdf:type':
        case 'a': return `'${s}' is an individual of type '${o}'.`;
        case 'sameas': return `'${s}' and '${o}' refer to the same real-world entity.`;
        case 'differentfrom': return `'${s}' and '${o}' are distinct individuals.`;
        default: return `${s} has relation ${type} with ${o}.`;
    }
};

const getCharacteristicExplanation = (prop: string, char: string) => {
    switch(char) {
        case 'Transitive': return `If x ${prop} y and y ${prop} z, then x ${prop} z.`;
        case 'Symmetric': return `If x ${prop} y, then y ${prop} x.`;
        case 'Asymmetric': return `If x ${prop} y, then y cannot be ${prop} x.`;
        case 'Functional': return `x can have at most one ${prop} value.`;
        case 'InverseFunctional': return `Two different subjects cannot share the same ${prop} value.`;
        case 'Reflexive': return `Every x is related to itself via ${prop}.`;
        case 'Irreflexive': return `No x is related to itself via ${prop}.`;
        default: return `${prop} is ${char}.`;
    }
};

const DLAxiomModal: React.FC<DLAxiomModalProps> = ({ isOpen, onClose, nodes, edges, onUpdateOntology }) => {
  const [activeTab, setActiveTab] = useState<'tbox' | 'abox' | 'rbox'>('tbox');
  const [tooltip, setTooltip] = useState<{x: number, y: number, text: string} | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Add Axiom State
  const [isAdding, setIsAdding] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newPredicate, setNewPredicate] = useState('SubClassOf');
  const [newObject, setNewObject] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Intellisense State
  const [suggestions, setSuggestions] = useState<{label: string, type: string}[]>([]);
  const [activeInput, setActiveInput] = useState<'subject' | 'object' | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleMouseMove = (e: React.MouseEvent, text: string) => {
      if (!modalRef.current) return;
      const rect = modalRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setTooltip({ x, y, text });
  };

  const handleMouseLeave = () => {
      setTooltip(null);
  };

  const insertSymbol = (sym: string) => {
      setNewObject(prev => prev + sym);
  };

  // --- Intellisense Logic ---

  const getEntitySuggestions = (query: string) => {
      const q = query.toLowerCase();
      return nodes
          .filter(n => n.data.label.toLowerCase().includes(q))
          .map(n => ({ 
              label: n.data.label, 
              type: n.data.type === ElementType.OWL_CLASS ? 'Class' : 
                    n.data.type === ElementType.OWL_NAMED_INDIVIDUAL ? 'Individual' : 'Property' 
          }));
  };

  const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setNewSubject(val);
      if (val.length > 0) {
          const matches = getEntitySuggestions(val);
          setSuggestions(matches.slice(0, 8));
          setActiveInput('subject');
          setSelectedIndex(0);
      } else {
          setSuggestions([]);
          setActiveInput(null);
      }
  };

  const handleObjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setNewObject(val);
      setValidationError(null); // Clear error on typing
      
      // Suggest based on the last word being typed
      const words = val.split(/([\s()]+)/);
      const lastToken = words[words.length - 1];
      
      if (lastToken && lastToken.trim().length > 0) {
          const q = lastToken.toLowerCase();
          const entityMatches = getEntitySuggestions(lastToken);
          const keywordMatches = MANCHESTER_KEYWORDS
              .filter(k => k.startsWith(q))
              .map(k => ({ label: k, type: 'Keyword' }));
          
          const allMatches = [...keywordMatches, ...entityMatches].slice(0, 8);
          if (allMatches.length > 0) {
              setSuggestions(allMatches);
              setActiveInput('object');
              setSelectedIndex(0);
          } else {
              setSuggestions([]);
              setActiveInput(null);
          }
      } else {
          setSuggestions([]);
          setActiveInput(null);
      }
  };

  const applySuggestion = (suggestion: {label: string}) => {
      if (activeInput === 'subject') {
          setNewSubject(suggestion.label);
      } else if (activeInput === 'object') {
          const words = newObject.split(/(\s+|[()])/);
          let i = words.length - 1;
          while (i >= 0 && !words[i]) i--; 
          
          if (i >= 0) {
              words[i] = suggestion.label + ' '; 
              setNewObject(words.join(''));
          } else {
              setNewObject(suggestion.label + ' ');
          }
      }
      setSuggestions([]);
      setActiveInput(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (suggestions.length > 0) {
          if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelectedIndex(prev => (prev + 1) % suggestions.length);
          } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              applySuggestion(suggestions[selectedIndex]);
          } else if (e.key === 'Escape') {
              setSuggestions([]);
              setActiveInput(null);
          }
      }
  };

  // --- End Intellisense ---

  const handleAddAxiom = () => {
      if (!newSubject.trim() || !newObject.trim()) return;

      // 1. Validate Syntax
      const objectStr = fromDL(newObject);
      const validation = validateManchesterSyntax(objectStr);
      if (!validation.isValid) {
          setValidationError(validation.error);
          return;
      }

      // 2. Resolve or Create Subject Node
      let subjectNode = nodes.find(n => n.data.label === newSubject);
      const newNodes = [...nodes];
      const newEdges = [...edges];

      if (!subjectNode) {
          // Infer type from relation
          let type = ElementType.OWL_CLASS;
          if (['Type', 'SameAs', 'DifferentFrom'].includes(newPredicate)) type = ElementType.OWL_NAMED_INDIVIDUAL;
          
          subjectNode = {
              id: `node-${Date.now()}`,
              type: 'umlNode',
              position: { x: Math.random() * 400, y: Math.random() * 400 },
              data: {
                  label: newSubject,
                  type: type,
                  attributes: [],
                  methods: []
              }
          };
          newNodes.push(subjectNode);
      }

      // 3. Process Object & Relation
      const simpleEntity = objectStr.match(/^[a-zA-Z0-9_]+$/) && !['some','only','and','or','not'].includes(objectStr);
      
      let addedAsEdge = false;

      // Try to resolve object node if simple
      if (simpleEntity) {
          let objectNode = newNodes.find(n => n.data.label === objectStr);
          if (!objectNode) {
              let objType = ElementType.OWL_CLASS;
              if (newPredicate === 'Type') objType = ElementType.OWL_CLASS; 
              else if (['SameAs', 'DifferentFrom'].includes(newPredicate)) objType = ElementType.OWL_NAMED_INDIVIDUAL;
              else if (subjectNode.data.type === ElementType.OWL_CLASS) objType = ElementType.OWL_CLASS;

              objectNode = {
                  id: `node-${Date.now()}-obj`,
                  type: 'umlNode',
                  position: { x: Math.random() * 400, y: Math.random() * 400 },
                  data: { label: objectStr, type: objType, attributes: [], methods: [] }
              };
              newNodes.push(objectNode);
          }

          let edgeLabel = '';
          if (newPredicate === 'SubClassOf') edgeLabel = 'subClassOf';
          else if (newPredicate === 'Type') edgeLabel = 'rdf:type';
          else if (newPredicate === 'DisjointWith') edgeLabel = 'owl:disjointWith';
          
          if (edgeLabel) {
              newEdges.push({
                  id: `e-${Date.now()}`,
                  source: subjectNode.id,
                  target: objectNode.id,
                  label: edgeLabel,
                  type: 'smoothstep'
              });
              addedAsEdge = true;
          }
      }

      if (!addedAsEdge) {
          // Add as Method (Axiom)
          const newMethod = {
              id: `m-${Date.now()}`,
              name: newPredicate,
              returnType: objectStr,
              visibility: '+' as const
          };
          const idx = newNodes.findIndex(n => n.id === subjectNode!.id);
          if (idx !== -1) {
              const updatedNode = { ...newNodes[idx], data: { ...newNodes[idx].data, methods: [...newNodes[idx].data.methods, newMethod] } };
              newNodes[idx] = updatedNode;
          }
      }

      onUpdateOntology(newNodes, newEdges);
      
      // Reset
      setNewObject('');
      setValidationError(null);
      setIsAdding(false);
  };

  const axioms = useMemo(() => {
      const tbox: React.ReactNode[] = [];
      const rbox: React.ReactNode[] = [];
      const abox: React.ReactNode[] = [];

      const createRow = (key: string, content: React.ReactNode, label: string, explanation: string) => (
          <div 
            key={key} 
            className="py-2.5 px-3 border-b border-slate-800 flex items-center justify-between group hover:bg-slate-800/50 transition-colors cursor-help rounded-md my-0.5"
            onMouseMove={(e) => handleMouseMove(e, explanation)}
            onMouseLeave={handleMouseLeave}
          >
              <div className="font-mono text-sm text-slate-300">
                  {content}
              </div>
              <span className="text-[9px] bg-slate-950 text-slate-500 px-1.5 py-0.5 rounded border border-slate-800 uppercase tracking-tight group-hover:border-slate-700 transition-colors">{label}</span>
          </div>
      );

      nodes.forEach(node => {
          const label = node.data.label;
          
          node.data.methods.forEach(m => {
              const explanation = getAxiomExplanation(label, m.name, m.returnType);
              const ax = createRow(
                  `${node.id}-${m.id}`, 
                  renderAxiom(label, m.name, m.returnType), 
                  m.name, 
                  explanation
              );

              if (node.data.type === ElementType.OWL_CLASS) tbox.push(ax);
              else if (node.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
                  if (['sameas', 'differentfrom'].includes(m.name.toLowerCase())) abox.push(ax);
                  else tbox.push(ax); 
              }
              else rbox.push(ax);
          });

          node.data.attributes.forEach(attr => {
              if (node.data.type === ElementType.OWL_OBJECT_PROPERTY) {
                  const char = attr.name;
                  let symbol: React.ReactNode | null = null;
                  if (char === 'Transitive') symbol = <span>{label} ∘ {label} ⊑ {label}</span>;
                  if (char === 'Symmetric') symbol = <span>{label} ≡ {label}⁻</span>;
                  if (char === 'Functional') symbol = <span>⊤ ⊑ ≤1 {label}</span>;
                  if (char === 'InverseFunctional') symbol = <span>⊤ ⊑ ≤1 {label}⁻</span>;
                  if (char === 'Reflexive') symbol = <span>⊤ ⊑ ∃{label}.Self</span>;
                  
                  if (symbol) {
                      const explanation = getCharacteristicExplanation(label, char);
                      rbox.push(createRow(`${node.id}-${attr.id}`, <div className="text-blue-300">{symbol}</div>, char, explanation));
                  }
              }
          });
      });

      edges.forEach(e => {
          const sNode = nodes.find(n => n.id === e.source);
          const tNode = nodes.find(n => n.id === e.target);
          if (!sNode || !tNode) return;

          const s = sNode.data.label;
          const t = tNode.data.label;
          const p = (e.label as string) || '';

          let ax: React.ReactNode = null;
          let explanation = '';
          let category = 'tbox';

          if (p === 'subClassOf' || p === 'rdfs:subClassOf') {
              ax = <span>{s} ⊑ {t}</span>;
              explanation = `Every instance of '${s}' is also an instance of '${t}'.`;
              category = 'tbox';
          } else if (p === 'disjointWith' || p === 'owl:disjointWith') {
              ax = <span>{s} ⊓ {t} ⊑ ⊥</span>;
              explanation = `No individual can be an instance of both '${s}' and '${t}'.`;
              category = 'tbox';
          } else if (p === 'rdf:type' || p === 'a') {
              ax = <span>{t}({s})</span>;
              explanation = `'${s}' is an individual of type '${t}'.`;
              category = 'abox';
          } else if (sNode.data.type === ElementType.OWL_NAMED_INDIVIDUAL && tNode.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
              const propName = p.includes(':') ? p.split(':')[1] : p;
              ax = <span>{propName}({s}, {t})</span>;
              explanation = `Individual '${s}' is related to '${t}' via property '${propName}'.`;
              category = 'abox';
          } else if (sNode.data.type === ElementType.OWL_OBJECT_PROPERTY && tNode.data.type === ElementType.OWL_OBJECT_PROPERTY) {
              if (p === 'inverseOf') {
                  ax = <span>{s} ≡ {t}⁻</span>;
                  explanation = `'${s}' is the inverse property of '${t}'.`;
              }
              if (p === 'subPropertyOf') {
                  ax = <span>{s} ⊑ {t}</span>;
                  explanation = `Property '${s}' is a sub-property of '${t}'.`;
              }
              category = 'rbox';
          }

          if (ax) {
              const item = createRow(e.id, ax, p, explanation);
              if (category === 'tbox') tbox.push(item);
              if (category === 'abox') abox.push(item);
              if (category === 'rbox') rbox.push(item);
          }
      });

      return { tbox, rbox, abox };
  }, [nodes, edges]);

  const getSuggestionIcon = (type: string) => {
      switch(type) {
          case 'Class': return <Database size={10} className="text-purple-400" />;
          case 'Individual': return <User size={10} className="text-teal-400" />;
          case 'Property': return <ArrowRightLeft size={10} className="text-blue-400" />;
          case 'Keyword': return <Command size={10} className="text-amber-400" />;
          default: return <Info size={10} />;
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div ref={modalRef} className="relative w-full max-w-4xl bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-700 flex flex-col h-[85vh] overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-900/30 rounded-lg border border-indigo-800 text-indigo-400">
                 <Sigma size={20} />
             </div>
             <div>
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-100">Description Logic Axioms</h2>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                        Total: {axioms.tbox.length + axioms.rbox.length + axioms.abox.length}
                    </span>
                </div>
                <p className="text-xs text-slate-400">Formal definitions (TBox, RBox, ABox)</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
              {!isAdding && (
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
                  >
                      <Plus size={14} /> Add Axiom
                  </button>
              )}
              <button onClick={onClose} className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-2 rounded-full transition-all">
                <X size={20} />
              </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
            {/* Sidebar / Legend */}
            <div className="w-64 border-r border-slate-800 bg-slate-950/50 flex flex-col p-4 overflow-y-auto">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <BookOpen size={14} /> Symbol Legend
                </h3>
                <div className="space-y-3 text-xs text-slate-400">
                    <div className="flex justify-between items-center"><span className="font-mono text-indigo-400">⊓</span> Intersection (AND)</div>
                    <div className="flex justify-between items-center"><span className="font-mono text-indigo-400">⊔</span> Union (OR)</div>
                    <div className="flex justify-between items-center"><span className="font-mono text-indigo-400">¬</span> Negation (NOT)</div>
                    <div className="flex justify-between items-center"><span className="font-mono text-indigo-400">∃</span> Existential (SOME)</div>
                    <div className="flex justify-between items-center"><span className="font-mono text-indigo-400">∀</span> Universal (ONLY)</div>
                    <div className="flex justify-between items-center"><span className="font-mono text-indigo-400">⊑</span> Subsumption (SubClass)</div>
                    <div className="flex justify-between items-center"><span className="font-mono text-indigo-400">≡</span> Equivalence</div>
                    <div className="flex justify-between items-center"><span className="font-mono text-indigo-400">⊥</span> Bottom (Empty)</div>
                    <div className="flex justify-between items-center"><span className="font-mono text-indigo-400">⊤</span> Top (Thing)</div>
                    <div className="flex justify-between items-center"><span className="font-mono text-indigo-400">⁻</span> Inverse</div>
                </div>
                
                <div className="mt-8 p-3 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <Info size={12} className="text-blue-400" />
                        <h4 className="font-bold text-slate-300 text-xs">Axiom Explainer</h4>
                    </div>
                    <p className="text-[10px] leading-relaxed text-slate-500">
                        Hover over any axiom in the list to see a natural language explanation of its logical meaning.
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-slate-900">
                {/* Axiom Constructor */}
                {isAdding && (
                    <div className="p-4 bg-slate-800/50 border-b border-slate-700 animate-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xs font-bold text-slate-300 uppercase">Construct Axiom</h3>
                            <button onClick={() => setIsAdding(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                        </div>
                        <div className="flex items-center gap-2 relative">
                            {/* Subject Input */}
                            <div className="relative w-1/4">
                                <input 
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500 placeholder-slate-600"
                                    placeholder="Subject (e.g. Person)"
                                    value={newSubject}
                                    onChange={handleSubjectChange}
                                    onKeyDown={handleKeyDown}
                                />
                                {activeInput === 'subject' && suggestions.length > 0 && (
                                    <div className="absolute top-full left-0 w-full bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 mt-1 max-h-40 overflow-y-auto">
                                        {suggestions.map((s, i) => (
                                            <button 
                                                key={i} 
                                                className={`w-full text-left px-2 py-1.5 text-xs flex items-center gap-2 ${i === selectedIndex ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                                                onClick={() => applySuggestion(s)}
                                            >
                                                {getSuggestionIcon(s.type)}
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            <select 
                                className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-blue-400 font-bold outline-none focus:border-blue-500"
                                value={newPredicate}
                                onChange={(e) => setNewPredicate(e.target.value)}
                            >
                                <option value="SubClassOf">⊑ (SubClass)</option>
                                <option value="EquivalentTo">≡ (Equivalent)</option>
                                <option value="DisjointWith">⊓..⊑⊥ (Disjoint)</option>
                                <option value="Type">: (Instance Of)</option>
                            </select>

                            {/* Object Input */}
                            <div className="flex-1 relative group">
                                <input 
                                    className={`w-full bg-slate-950 border rounded px-2 py-1.5 text-xs text-slate-200 outline-none font-mono placeholder-slate-600 ${validationError ? 'border-red-500 focus:border-red-600' : 'border-slate-700 focus:border-blue-500'}`}
                                    placeholder="Expression (e.g. ∃hasChild.Person)"
                                    value={newObject}
                                    onChange={handleObjectChange}
                                    onKeyDown={handleKeyDown}
                                />
                                
                                {activeInput === 'object' && suggestions.length > 0 && (
                                    <div className="absolute top-full left-0 min-w-[200px] bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 mt-1 max-h-40 overflow-y-auto">
                                        {suggestions.map((s, i) => (
                                            <button 
                                                key={i} 
                                                className={`w-full text-left px-2 py-1.5 text-xs flex items-center gap-2 ${i === selectedIndex ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                                                onClick={() => applySuggestion(s)}
                                            >
                                                {getSuggestionIcon(s.type)}
                                                <span className="font-mono">{s.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Symbol Palette */}
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-focus-within:opacity-100 transition-opacity bg-slate-950/80 p-0.5 rounded pointer-events-none group-hover:pointer-events-auto">
                                    <button onClick={() => insertSymbol('∃')} className="w-5 h-5 flex items-center justify-center bg-slate-800 hover:bg-blue-600 rounded text-[10px] text-white">∃</button>
                                    <button onClick={() => insertSymbol('∀')} className="w-5 h-5 flex items-center justify-center bg-slate-800 hover:bg-blue-600 rounded text-[10px] text-white">∀</button>
                                    <button onClick={() => insertSymbol('⊓')} className="w-5 h-5 flex items-center justify-center bg-slate-800 hover:bg-blue-600 rounded text-[10px] text-white">⊓</button>
                                    <button onClick={() => insertSymbol('⊔')} className="w-5 h-5 flex items-center justify-center bg-slate-800 hover:bg-blue-600 rounded text-[10px] text-white">⊔</button>
                                    <button onClick={() => insertSymbol('¬')} className="w-5 h-5 flex items-center justify-center bg-slate-800 hover:bg-blue-600 rounded text-[10px] text-white">¬</button>
                                </div>
                            </div>

                            <button 
                                onClick={handleAddAxiom}
                                className="bg-green-600 hover:bg-green-500 text-white p-1.5 rounded transition-colors"
                                title="Add to Ontology"
                            >
                                <Check size={16} />
                            </button>
                        </div>
                        {validationError && (
                            <div className="mt-2 text-[10px] text-red-400 bg-red-950/20 p-1.5 rounded border border-red-900/30 flex items-center gap-2">
                                <Info size={12} /> {validationError}
                            </div>
                        )}
                        <p className="text-[9px] text-slate-500 mt-2">
                            New subjects will be created as nodes. Symbols ($\exists, \forall, etc.$) are converted to Manchester Syntax on save.
                        </p>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-slate-800">
                    <button 
                        onClick={() => setActiveTab('tbox')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-between px-6 gap-2 ${activeTab === 'tbox' ? 'border-b-2 border-indigo-500 text-indigo-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Database size={14} /> <span>TBox (Classes)</span>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'tbox' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'}`}>
                            {axioms.tbox.length}
                        </span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('rbox')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-between px-6 gap-2 ${activeTab === 'rbox' ? 'border-b-2 border-blue-500 text-blue-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <div className="flex items-center gap-2">
                            <ArrowRightLeft size={14} /> <span>RBox (Properties)</span>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'rbox' ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-500'}`}>
                            {axioms.rbox.length}
                        </span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('abox')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-between px-6 gap-2 ${activeTab === 'abox' ? 'border-b-2 border-teal-500 text-teal-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <div className="flex items-center gap-2">
                            <User size={14} /> <span>ABox (Individuals)</span>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'abox' ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-800 text-slate-500'}`}>
                            {axioms.abox.length}
                        </span>
                    </button>
                </div>

                {/* Axiom List */}
                <div className="flex-1 overflow-y-auto p-6 relative">
                    {activeTab === 'tbox' && (
                        <div>
                            {axioms.tbox.length > 0 ? axioms.tbox : (
                                <div className="flex flex-col items-center justify-center py-10 text-slate-600 gap-2">
                                    <ListFilter size={24} className="opacity-20" />
                                    <span className="italic text-xs">No Class axioms defined.</span>
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === 'rbox' && (
                        <div>
                            {axioms.rbox.length > 0 ? axioms.rbox : (
                                <div className="flex flex-col items-center justify-center py-10 text-slate-600 gap-2">
                                    <ListFilter size={24} className="opacity-20" />
                                    <span className="italic text-xs">No Property axioms defined.</span>
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === 'abox' && (
                        <div>
                            {axioms.abox.length > 0 ? axioms.abox : (
                                <div className="flex flex-col items-center justify-center py-10 text-slate-600 gap-2">
                                    <ListFilter size={24} className="opacity-20" />
                                    <span className="italic text-xs">No Individual assertions defined.</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Floating Tooltip */}
        {tooltip && (
            <div 
                className="absolute z-50 px-3 py-2 bg-slate-800 border border-slate-700 shadow-xl rounded-lg text-xs text-slate-200 pointer-events-none max-w-xs animate-in fade-in zoom-in-95 duration-150"
                style={{ 
                    top: tooltip.y - 45, // Position above cursor
                    left: tooltip.x - 20,
                }}
            >
                {tooltip.text}
                {/* Arrow */}
                <div className="absolute left-6 -bottom-1 w-2 h-2 bg-slate-800 border-r border-b border-slate-700 transform rotate-45"></div>
            </div>
        )}

      </div>
    </div>
  );
};

export default DLAxiomModal;
