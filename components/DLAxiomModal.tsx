import React, { useState, useMemo } from 'react';
import { X, Sigma, BookOpen, Database, User, ArrowRightLeft } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';

interface DLAxiomModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node<UMLNodeData>[];
  edges: Edge[];
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
    dl = dl.replace(/\bthat\b/gi, '.'); // "Person that hasChild..." -> Person . hasChild... roughly intersection
    
    // Clean up spaces around symbols
    dl = dl.replace(/\s*⊓\s*/g, ' ⊓ ');
    dl = dl.replace(/\s*⊔\s*/g, ' ⊔ ');
    
    return dl;
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
        case 'a': return <span>{o}({s})</span>; // Class Assertion C(a)
        
        case 'sameas': return <span>{s} = {o}</span>;
        case 'differentfrom': return <span>{s} ≠ {o}</span>;
        
        default: return <span>{s} ? {o}</span>;
    }
};

const DLAxiomModal: React.FC<DLAxiomModalProps> = ({ isOpen, onClose, nodes, edges }) => {
  const [activeTab, setActiveTab] = useState<'tbox' | 'abox' | 'rbox'>('tbox');

  const axioms = useMemo(() => {
      const tbox: React.ReactNode[] = [];
      const rbox: React.ReactNode[] = [];
      const abox: React.ReactNode[] = [];

      nodes.forEach(node => {
          const label = node.data.label;
          
          // Internal Axioms (Methods)
          node.data.methods.forEach(m => {
              const ax = (
                  <div key={`${node.id}-${m.id}`} className="py-2 border-b border-slate-800 flex items-center justify-between group">
                      <div className="font-mono text-sm text-slate-300">
                          {renderAxiom(label, m.name, m.returnType)}
                      </div>
                      <span className="text-[10px] text-slate-600 uppercase">{m.name}</span>
                  </div>
              );

              if (node.data.type === ElementType.OWL_CLASS) tbox.push(ax);
              else if (node.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
                  // Some axioms on individuals are actually ABox assertions (SameAs, DifferentFrom)
                  if (['sameas', 'differentfrom'].includes(m.name.toLowerCase())) abox.push(ax);
                  else tbox.push(ax); // Fallback
              }
              else rbox.push(ax);
          });

          // Attributes (Implicit Axioms)
          node.data.attributes.forEach(attr => {
              if (node.data.type === ElementType.OWL_CLASS) {
                  // Class Attribute -> Data Property usage, mostly schematic not strict axioms for this view
              } 
              else if (node.data.type === ElementType.OWL_OBJECT_PROPERTY) {
                  // Characteristics
                  const char = attr.name;
                  let symbol: React.ReactNode | null = null;
                  if (char === 'Transitive') symbol = <span>{label} ∘ {label} ⊑ {label}</span>;
                  if (char === 'Symmetric') symbol = <span>{label} ≡ {label}⁻</span>;
                  if (char === 'Functional') symbol = <span>⊤ ⊑ ≤1 {label}</span>;
                  if (char === 'InverseFunctional') symbol = <span>⊤ ⊑ ≤1 {label}⁻</span>;
                  if (char === 'Reflexive') symbol = <span>⊤ ⊑ ∃{label}.Self</span>;
                  
                  if (symbol) {
                      rbox.push(
                          <div key={`${node.id}-${attr.id}`} className="py-2 border-b border-slate-800 flex items-center justify-between">
                              <div className="font-mono text-sm text-blue-300">{symbol}</div>
                              <span className="text-[10px] text-slate-600 uppercase">{char}</span>
                          </div>
                      );
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
          let category = 'tbox';

          if (p === 'subClassOf' || p === 'rdfs:subClassOf') {
              ax = <span>{s} ⊑ {t}</span>;
              category = 'tbox';
          } else if (p === 'disjointWith' || p === 'owl:disjointWith') {
              ax = <span>{s} ⊓ {t} ⊑ ⊥</span>;
              category = 'tbox';
          } else if (p === 'rdf:type' || p === 'a') {
              ax = <span>{t}({s})</span>;
              category = 'abox';
          } else if (sNode.data.type === ElementType.OWL_NAMED_INDIVIDUAL && tNode.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
              // Property Assertion P(a,b)
              // Strip prefix if present
              const propName = p.includes(':') ? p.split(':')[1] : p;
              ax = <span>{propName}({s}, {t})</span>;
              category = 'abox';
          } else if (sNode.data.type === ElementType.OWL_OBJECT_PROPERTY && tNode.data.type === ElementType.OWL_OBJECT_PROPERTY) {
              if (p === 'inverseOf') ax = <span>{s} ≡ {t}⁻</span>;
              if (p === 'subPropertyOf') ax = <span>{s} ⊑ {t}</span>;
              category = 'rbox';
          }

          if (ax) {
              const item = (
                  <div key={e.id} className="py-2 border-b border-slate-800 flex items-center justify-between">
                      <div className="font-mono text-sm text-slate-300">{ax}</div>
                      <span className="text-[10px] text-slate-600 uppercase">{p}</span>
                  </div>
              );
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

      <div className="relative w-full max-w-4xl bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-700 flex flex-col h-[85vh] overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200">
        
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
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-2 rounded-full transition-all">
            <X size={20} />
          </button>
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
                    <h4 className="font-bold text-slate-300 mb-1">About DL</h4>
                    <p className="text-[10px] leading-relaxed text-slate-500">
                        Description Logics are a family of formal knowledge representation languages. 
                        This view translates your visual ontology into standard mathematical notation used in academic and formal semantic web contexts.
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col bg-slate-900">
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
                <div className="flex-1 overflow-y-auto p-6">
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
      </div>
    </div>
  );
};

export default DLAxiomModal;