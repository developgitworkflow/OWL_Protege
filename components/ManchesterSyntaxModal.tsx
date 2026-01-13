
import React, { useMemo, useState } from 'react';
import { X, Copy, Download, Database, User, ArrowRightLeft, Tag, FileType, Box, Circle } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ProjectData, ElementType } from '../types';
import { generateManchesterSyntax } from '../services/manchesterSyntaxGenerator';

interface ManchesterSyntaxModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node<UMLNodeData>[];
  edges: Edge[];
  projectData: ProjectData;
}

const MANCHESTER_KEYWORDS = [
    'some', 'only', 'value', 'min', 'max', 'exactly', 'that', 'not', 'and', 'or', 'self'
];

const ManchesterSyntaxModal: React.FC<ManchesterSyntaxModalProps> = ({ isOpen, onClose, nodes, edges, projectData }) => {
  const [copied, setCopied] = useState(false);

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

  const getIcon = (type: ElementType) => {
      switch(type) {
          // Using colors similar to Protege (Classes = Yellow/Orangeish in image, but standard Protege 5 uses Yellow)
          case ElementType.OWL_CLASS: return <div className="w-4 h-4 rounded-full bg-[#e3c800] border border-[#bfa900] shadow-sm" />; 
          case ElementType.OWL_NAMED_INDIVIDUAL: return <div className="w-4 h-4 transform rotate-45 bg-[#8b5cf6] border border-[#7c3aed] shadow-sm" />;
          case ElementType.OWL_OBJECT_PROPERTY: return <div className="w-4 h-4 bg-[#3b82f6] border border-[#2563eb] rounded-sm shadow-sm" />;
          case ElementType.OWL_DATA_PROPERTY: return <div className="w-4 h-4 bg-[#10b981] border border-[#059669] rounded-sm shadow-sm" />;
          case ElementType.OWL_DATATYPE: return <div className="w-4 h-4 bg-[#f59e0b] border border-[#d97706] rounded-sm shadow-sm" />;
          default: return <div className="w-4 h-4 bg-slate-500 rounded-sm" />;
      }
  };

  // Syntax Highlighter Component
  const ManchesterText = ({ text }: { text: string }) => {
      const parts = text.split(/(\b(?:some|only|value|min|max|exactly|that|not|and|or|self)\b)/gi);
      return (
          <span className="font-mono text-sm text-slate-300">
              {parts.map((part, i) => {
                  if (MANCHESTER_KEYWORDS.includes(part.toLowerCase())) {
                      return <span key={i} className="text-[#d946ef] font-bold mx-1">{part}</span>; // Pink/Purple for keywords
                  }
                  // Highlight Entity Names (Simple heuristic: capitalized words or contain :)
                  if (part.trim().length > 1 && !part.match(/^\d+$/) && !part.match(/^[(){}\[\],]+$/)) {
                      // Check if it matches a known class/prop for extra style? 
                      // For now just standard text color
                      return <span key={i} className="text-slate-200">{part}</span>;
                  }
                  return <span key={i}>{part}</span>;
              })}
          </span>
      );
  };

  // Renders a single entity's frame (Protege Style)
  const EntityFrame = ({ node }: { node: Node<UMLNodeData> }) => {
      const { data } = node;
      
      // Group Axioms
      const equivalent = data.methods.filter(m => ['equivalentto', 'equivalentclass'].includes(m.name.toLowerCase()));
      const subClass = data.methods.filter(m => ['subclassof'].includes(m.name.toLowerCase()));
      const disjoint = data.methods.filter(m => ['disjointwith'].includes(m.name.toLowerCase()));
      const general = data.methods.filter(m => !['subclassof', 'equivalentto', 'equivalentclass', 'disjointwith'].includes(m.name.toLowerCase()));
      
      // Add Edges to SubClass
      const connectedEdges = edges.filter(e => e.source === node.id);
      const parentEdges = connectedEdges.filter(e => e.label === 'subClassOf' || e.label === 'rdfs:subClassOf');
      
      const hasContent = equivalent.length > 0 || subClass.length > 0 || disjoint.length > 0 || general.length > 0 || parentEdges.length > 0 || (data.attributes && data.attributes.length > 0);

      return (
          <div className="bg-[#1e293b] border border-slate-700 rounded-lg overflow-hidden shadow-sm mb-6">
              {/* Entity Header */}
              <div className="bg-[#334155] px-4 py-2 flex items-center gap-3 border-b border-slate-600">
                  {getIcon(data.type)}
                  <span className="font-bold text-slate-100 text-lg">{data.label}</span>
                  <span className="text-slate-400 text-xs font-mono ml-auto opacity-70">{data.iri || data.label}</span>
              </div>

              {/* Content Body */}
              <div className="p-0">
                  
                  {/* Annotations Section */}
                  {(data.description || (data.annotations && data.annotations.length > 0)) && (
                      <div className="border-b border-slate-700/50">
                          <div className="px-4 py-1.5 bg-[#0f172a]/30 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              Annotations
                          </div>
                          <div className="p-3 space-y-2">
                              {data.description && (
                                  <div className="flex gap-3">
                                      <span className="text-xs text-slate-400 font-bold min-w-[80px]">comment</span>
                                      <span className="text-xs text-slate-300 italic">"{data.description}"</span>
                                  </div>
                              )}
                              {data.annotations?.map((ann, i) => (
                                  <div key={i} className="flex gap-3">
                                      <span className="text-xs text-slate-400 font-bold min-w-[80px]">{ann.property}</span>
                                      <span className="text-xs text-slate-300">"{ann.value.replace(/"/g, '')}"</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}

                  {/* Asserted Conditions Header */}
                  {hasContent && (
                      <div className="px-4 py-2 bg-[#f1f5f9] dark:bg-[#0f172a] border-y border-slate-700 flex justify-between items-center">
                          <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">Asserted Conditions</span>
                      </div>
                  )}

                  <div className="divide-y divide-slate-800">
                      
                      {/* Equivalent Classes (Necessary & Sufficient) */}
                      {equivalent.length > 0 && (
                          <div className="bg-[#475569]/10">
                              {equivalent.map(m => (
                                  <div key={m.id} className="flex items-start px-4 py-2 hover:bg-white/5 transition-colors">
                                      <div className="w-6 mt-1 flex justify-center text-orange-400 font-bold">≡</div>
                                      <div className="flex-1"><ManchesterText text={m.returnType} /></div>
                                  </div>
                              ))}
                          </div>
                      )}

                      {/* SubClassOf (Necessary) */}
                      {(subClass.length > 0 || parentEdges.length > 0 || data.attributes.length > 0) && (
                          <div>
                              {parentEdges.map(e => {
                                  const targetNode = nodes.find(n => n.id === e.target);
                                  const label = targetNode ? targetNode.data.label : 'Unknown';
                                  return (
                                      <div key={e.id} className="flex items-start px-4 py-2 hover:bg-white/5 transition-colors">
                                          <div className="w-6 mt-1 flex justify-center text-slate-500">
                                              {/* Simple SubClass Icon */}
                                              <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                                          </div>
                                          <div className="flex-1"><span className="text-slate-200 font-bold">{label}</span></div>
                                      </div>
                                  );
                              })}
                              
                              {subClass.map(m => (
                                  <div key={m.id} className="flex items-start px-4 py-2 hover:bg-white/5 transition-colors">
                                      <div className="w-6 mt-1 flex justify-center text-slate-500">
                                          <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                      </div>
                                      <div className="flex-1"><ManchesterText text={m.returnType} /></div>
                                  </div>
                              ))}

                              {/* Attributes as Data Properties Restrictions */}
                              {data.attributes.map(attr => (
                                  <div key={attr.id} className="flex items-start px-4 py-2 hover:bg-white/5 transition-colors">
                                      <div className="w-6 mt-1 flex justify-center text-slate-500">
                                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      </div>
                                      <div className="flex-1">
                                          <span className="text-slate-200">{attr.name}</span> <span className="text-[#d946ef] font-bold">some</span> <span className="text-slate-200">{attr.type || 'Literal'}</span>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}

                      {/* Disjoint With */}
                      {disjoint.length > 0 && (
                          <div className="bg-red-900/10">
                              <div className="px-4 py-1 text-[10px] font-bold text-red-400 uppercase tracking-wider">Disjoint With</div>
                              {disjoint.map(m => (
                                  <div key={m.id} className="flex items-start px-4 py-2 hover:bg-white/5 transition-colors">
                                      <div className="w-6 mt-1 flex justify-center text-red-500 font-bold">⊥</div>
                                      <div className="flex-1"><ManchesterText text={m.returnType} /></div>
                                  </div>
                              ))}
                          </div>
                      )}

                      {/* Other Axioms (Domain, Range, etc) */}
                      {general.length > 0 && (
                          <div>
                              {general.map(m => (
                                  <div key={m.id} className="flex items-start px-4 py-2 hover:bg-white/5 transition-colors">
                                      <div className="w-20 text-[10px] font-bold text-slate-500 uppercase mt-1">{m.name}</div>
                                      <div className="flex-1"><ManchesterText text={m.returnType} /></div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  
                  {!hasContent && (
                      <div className="p-4 text-center text-slate-500 text-sm italic">
                          No logical axioms defined.
                      </div>
                  )}
              </div>
          </div>
      );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-5xl bg-slate-950 rounded-xl shadow-2xl ring-1 ring-slate-700 flex flex-col h-[85vh] overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-900/30 rounded-lg border border-indigo-800 text-indigo-400">
                 <Database size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-100">Manchester Syntax Visualization</h2>
                <p className="text-xs text-slate-400">Class Description View</p>
             </div>
          </div>
          <div className="flex gap-2">
            <button 
                onClick={handleCopy} 
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-300 transition-colors"
            >
                {copied ? 'Copied!' : 'Copy Code'}
            </button>
            <button 
                onClick={handleDownload}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-300 transition-colors"
            >
                <Download size={14} />
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-2 rounded-full transition-all">
                <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
            {/* Main List Area */}
            <div className="flex-1 overflow-y-auto bg-slate-950 p-6 scrollbar-thin scrollbar-thumb-slate-700">
                 <div className="max-w-3xl mx-auto">
                    {/* Sort nodes: Classes first, then Props, then Indivs */}
                    {nodes
                        .sort((a,b) => a.data.label.localeCompare(b.data.label))
                        .filter(n => n.data.type === ElementType.OWL_CLASS)
                        .map(node => <EntityFrame key={node.id} node={node} />)
                    }
                    {nodes
                        .sort((a,b) => a.data.label.localeCompare(b.data.label))
                        .filter(n => n.data.type === ElementType.OWL_OBJECT_PROPERTY || n.data.type === ElementType.OWL_DATA_PROPERTY)
                        .map(node => <EntityFrame key={node.id} node={node} />)
                    }
                    {nodes
                        .sort((a,b) => a.data.label.localeCompare(b.data.label))
                        .filter(n => n.data.type === ElementType.OWL_NAMED_INDIVIDUAL)
                        .map(node => <EntityFrame key={node.id} node={node} />)
                    }
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ManchesterSyntaxModal;
