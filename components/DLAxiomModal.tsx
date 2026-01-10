import React, { useState, useMemo, useRef } from 'react';
import { X, Sigma, BookOpen, Database, User, ArrowRightLeft, Info, Plus, Check } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';

interface DLAxiomModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node<UMLNodeData>[];
  edges: Edge[];
  onUpdateOntology: (nodes: Node<UMLNodeData>[], edges: Edge[]) => void;
}

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

  const handleAddAxiom = () => {
      if (!newSubject.trim() || !newObject.trim()) return;

      // 1. Resolve or Create Subject Node
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

      // 2. Process Object & Relation
      // If object is simple named entity and valid edge type -> Edge
      // Else -> Method (Axiom)
      const objectStr = fromDL(newObject);
      const simpleEntity = objectStr.match(/^[a-zA-Z0-9_]+$/) && !['some','only','and','or','not'].includes(objectStr);
      
      let addedAsEdge = false;

      // Try to resolve object node if simple
      if (simpleEntity) {
          let objectNode = newNodes.find(n => n.data.label === objectStr);
          if (!objectNode) {
              // Create placeholder node?
              // For robustness, let's create it if it looks like a class/individual name
              let objType = ElementType.OWL_CLASS;
              if (newPredicate === 'Type') objType = ElementType.OWL_CLASS; // Instance OF Class
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

          // Map predicate to edge label
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
          // Must update specific node in newNodes array
          const idx = newNodes.findIndex(n => n.id === subjectNode!.id);
          if (idx !== -1) {
              const updatedNode = { ...newNodes[idx], data: { ...newNodes[idx].data, methods: [...newNodes[idx].data.methods, newMethod] } };
              newNodes[idx] = updatedNode;
          }
      }

      onUpdateOntology(newNodes, newEdges);
      
      // Reset
      setNewObject('');
      setIsAdding(false);
  };

  const axioms = useMemo(() => {
      const tbox: React.ReactNode[] = [];
      const rbox: React.ReactNode[] = [];
      const abox: React.ReactNode[] = [];

      const createRow = (key: string, content: React.ReactNode, label: string, explanation: string) => (
          <div 
            key={key} 
            className="py-2 px-3 -mx-3 border-b border-slate-800 flex items-center justify-between group hover:bg-slate-800/50 transition-colors cursor-help rounded"
            onMouseMove={(e) => handleMouseMove(e, explanation)}
            onMouseLeave={handleMouseLeave}
          >
              <div className="font-mono text-sm text-slate-300">
                  {content}
              </div>
              <span className="text-[10px] text-slate-600 uppercase group-hover:text-slate-400">{label}</span>
          </div>
      );

      nodes.forEach(node => {
          const label = node.data.label;
          
          // Internal Axioms (Methods)
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

          // Attributes (Implicit Axioms)
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

      // Edge Axioms
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
                <h2 className="text-lg font-bold text-slate-100">Description Logic Axioms</h2>
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
                        <div className="flex items-center gap-2">
                            <input 
                                className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 w-1/4 outline-none focus:border-blue-500 placeholder-slate-600"
                                placeholder="Subject (e.g. Person)"
                                value={newSubject}
                                onChange={(e) => setNewSubject(e.target.value)}
                            />
                            
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

                            <div className="flex-1 relative group">
                                <input 
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500 font-mono placeholder-slate-600"
                                    placeholder="Expression (e.g. ∃hasChild.Person)"
                                    value={newObject}
                                    onChange={(e) => setNewObject(e.target.value)}
                                />
                                {/* Symbol Palette */}
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-focus-within:opacity-100 transition-opacity bg-slate-950/80 p-0.5 rounded">
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
                        <p className="text-[9px] text-slate-500 mt-2">
                            New subjects will be created as nodes. Symbols ($\exists, \forall, etc.$) are converted to Manchester Syntax on save.
                        </p>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-slate-800">
                    <button 
                        onClick={() => setActiveTab('tbox')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${activeTab === 'tbox' ? 'border-b-2 border-indigo-500 text-indigo-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Database size={14} /> TBox (Classes)
                    </button>
                    <button 
                        onClick={() => setActiveTab('rbox')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${activeTab === 'rbox' ? 'border-b-2 border-blue-500 text-blue-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <ArrowRightLeft size={14} /> RBox (Properties)
                    </button>
                    <button 
                        onClick={() => setActiveTab('abox')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${activeTab === 'abox' ? 'border-b-2 border-pink-500 text-pink-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <User size={14} /> ABox (Individuals)
                    </button>
                </div>

                {/* Axiom List */}
                <div className="flex-1 overflow-y-auto p-6 relative">
                    {activeTab === 'tbox' && (
                        <div>
                            {axioms.tbox.length > 0 ? axioms.tbox : <div className="text-center text-slate-600 italic mt-10">No Class axioms defined.</div>}
                        </div>
                    )}
                    {activeTab === 'rbox' && (
                        <div>
                            {axioms.rbox.length > 0 ? axioms.rbox : <div className="text-center text-slate-600 italic mt-10">No Property axioms defined.</div>}
                        </div>
                    )}
                    {activeTab === 'abox' && (
                        <div>
                            {axioms.abox.length > 0 ? axioms.abox : <div className="text-center text-slate-600 italic mt-10">No Individual assertions defined.</div>}
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