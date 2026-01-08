import React, { useState, useEffect, useRef } from 'react';
import { Node } from 'reactflow';
import { UMLNodeData, ElementType, Annotation, Method } from '../types';
import { Trash2, Plus, X, Box, ArrowRight, MousePointerClick, ListOrdered, Quote, Link2, GitMerge, GitCommit, Split } from 'lucide-react';
import AnnotationManager from './AnnotationManager';

interface PropertiesPanelProps {
  selectedNode: Node<UMLNodeData> | null;
  onUpdateNode: (id: string, data: UMLNodeData) => void;
  onDeleteNode: (id: string) => void;
}

const XSD_TYPES = [
  'xsd:string', 'xsd:integer', 'xsd:int', 'xsd:boolean', 'xsd:dateTime',
  'xsd:date', 'xsd:time', 'xsd:float', 'xsd:double', 'xsd:decimal',
  'xsd:long', 'xsd:short', 'xsd:byte', 'xsd:nonNegativeInteger',
  'xsd:base64Binary', 'xsd:anyURI', 'xsd:normalizedString', 'xsd:token',
  'xsd:language', 'rdf:PlainLiteral', 'rdf:XMLLiteral'
];

const CHARACTERISTICS = [
    'Functional', 'InverseFunctional', 'Transitive', 'Symmetric', 
    'Asymmetric', 'Reflexive', 'Irreflexive'
];

const QUANTIFIERS = ['some', 'only', 'min', 'max', 'exactly', 'value', 'self'];

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedNode, onUpdateNode, onDeleteNode }) => {
  const [localData, setLocalData] = useState<UMLNodeData | null>(null);
  const [activeAttrType, setActiveAttrType] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedNode) {
      setLocalData({ ...selectedNode.data });
      setExpandedId(null);
    } else {
      setLocalData(null);
      setExpandedId(null);
    }
  }, [selectedNode]);

  if (!selectedNode || !localData) {
    return (
      <div className="w-96 bg-slate-900 border-l border-slate-800 p-6 flex flex-col items-center justify-center text-center h-full">
        <div className="bg-slate-800 p-6 rounded-full mb-6 border border-slate-700 shadow-xl">
            <Box className="w-10 h-10 text-slate-500" />
        </div>
        <h3 className="text-slate-200 font-semibold text-lg mb-2">No Selection</h3>
        <p className="text-slate-500 text-sm max-w-[200px]">Select a class, individual, property or datatype from the canvas to edit its properties.</p>
      </div>
    );
  }

  const isPropertyNode = localData.type === ElementType.OWL_OBJECT_PROPERTY || localData.type === ElementType.OWL_DATA_PROPERTY;
  const isObjectProperty = localData.type === ElementType.OWL_OBJECT_PROPERTY;
  const isClassNode = localData.type === ElementType.OWL_CLASS;

  const handleChange = (field: keyof UMLNodeData, value: any) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  const handleAnnotationsUpdate = (newAnnotations: Annotation[]) => {
      handleChange('annotations', newAnnotations);
  };

  const toggleExpand = (id: string) => {
      setExpandedId(expandedId === id ? null : id);
  };

  // --- Attributes (Characteristics / Data Properties) ---
  const addAttribute = () => {
    const defaultName = isPropertyNode ? 'Functional' : 'newProperty';
    const defaultType = isPropertyNode ? '' : 'xsd:string'; 
    const newAttr = { 
        id: `attr-${Date.now()}`, 
        name: defaultName, 
        type: defaultType, 
        visibility: '+' as const,
        isDerived: false,
        annotations: []
    };
    const newData = { ...localData, attributes: [...(localData.attributes || []), newAttr] };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  const updateAttribute = (id: string, field: string, value: any) => {
    const newAttrs = localData.attributes.map(a => a.id === id ? { ...a, [field]: value } : a);
    const newData = { ...localData, attributes: newAttrs };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };
  
  const removeAttribute = (id: string) => {
      const newAttrs = localData.attributes.filter(a => a.id !== id);
      const newData = { ...localData, attributes: newAttrs };
      setLocalData(newData);
      onUpdateNode(selectedNode.id, newData);
  };

  // --- Axioms / Methods Helper ---
  const addMethod = (type: string, defaultTarget = 'Target') => {
    const newMethod = { 
        id: `method-${Date.now()}-${Math.random()}`, 
        name: type, 
        returnType: defaultTarget, 
        visibility: '+' as const,
        isOrdered: false,
        annotations: []
    };
    const newData = { ...localData, methods: [...(localData.methods || []), newMethod] };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  const updateMethod = (id: string, field: string, value: any) => {
    const newMethods = localData.methods.map(m => m.id === id ? { ...m, [field]: value } : m);
    const newData = { ...localData, methods: newMethods };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  const removeMethod = (id: string) => {
      const newMethods = localData.methods.filter(m => m.id !== id);
      const newData = { ...localData, methods: newMethods };
      setLocalData(newData);
      onUpdateNode(selectedNode.id, newData);
  };

  const appendToMethodTarget = (methodId: string, textToAppend: string) => {
      const method = localData.methods.find(m => m.id === methodId);
      if (method) {
          const current = method.returnType === 'Target' ? '' : method.returnType;
          const newValue = `${current.trim()} ${textToAppend} `;
          updateMethod(methodId, 'returnType', newValue);
      }
  };

  // --- Render Helpers ---

  const renderAxiomGroup = (title: string, types: string[], icon?: React.ReactNode, placeholder = 'Target', ordered = false) => {
      const axioms = localData.methods.filter(m => types.includes(m.name));
      
      return (
          <div className="space-y-2">
              <div className="flex justify-between items-end">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      {icon} {title}
                  </h4>
                  <button 
                      onClick={() => addMethod(types[0], placeholder)}
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 p-1 rounded transition-colors"
                  >
                      <Plus size={14} />
                  </button>
              </div>
              <div className="space-y-2">
                  {axioms.length > 0 ? axioms.map(method => (
                      <div key={method.id} className="bg-slate-950 border border-slate-800 rounded-lg p-2 group hover:border-slate-700 transition-colors">
                          <div className="flex items-start gap-2">
                              <div className="flex-1">
                                  <input
                                      className="w-full bg-transparent text-xs text-slate-200 focus:outline-none placeholder-slate-700 font-mono"
                                      value={method.returnType}
                                      onChange={(e) => updateMethod(method.id, 'returnType', e.target.value)}
                                      placeholder={placeholder}
                                  />
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {ordered && (
                                     <button 
                                        onClick={() => updateMethod(method.id, 'isOrdered', !method.isOrdered)}
                                        className={`p-1 rounded ${method.isOrdered ? 'text-blue-400' : 'text-slate-600'}`}
                                        title="Ordered List"
                                     >
                                         <ListOrdered size={12} />
                                     </button>
                                  )}
                                  <button 
                                      onClick={() => toggleExpand(method.id)}
                                      className={`p-1 rounded ${expandedId === method.id ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'}`}
                                  >
                                      <Quote size={12} />
                                  </button>
                                  <button 
                                      onClick={() => removeMethod(method.id)}
                                      className="p-1 text-slate-600 hover:text-red-400"
                                  >
                                      <X size={12} />
                                  </button>
                              </div>
                          </div>
                          {expandedId === method.id && (
                              <div className="mt-2 pt-2 border-t border-slate-800/50">
                                  <AnnotationManager 
                                      annotations={method.annotations} 
                                      onUpdate={(anns) => updateMethod(method.id, 'annotations', anns)}
                                      title="Axiom Annotations"
                                      compact
                                  />
                              </div>
                          )}
                      </div>
                  )) : (
                      <div className="text-[10px] text-slate-700 italic px-2">None</div>
                  )}
              </div>
          </div>
      );
  };

  const displayType = localData.type.replace('owl_', '').replace(/_/g, ' ');

  return (
    <div ref={panelRef} className="w-96 bg-slate-900 border-l border-slate-800 h-full overflow-y-auto flex flex-col font-sans text-sm text-slate-200">
      
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{displayType}</span>
            <div className="font-bold text-lg text-white truncate max-w-[200px]" title={localData.label}>{localData.label}</div>
        </div>
        <button 
            onClick={() => onDeleteNode(selectedNode.id)}
            className="text-slate-500 hover:text-red-400 hover:bg-slate-800 p-2 rounded-full transition-all"
            title="Delete Entity"
        >
            <Trash2 size={18} />
        </button>
      </div>

      <div className="p-5 space-y-8">
        
        {/* IRI Section */}
        <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                Identity
            </h3>
            <div className="space-y-1">
                 <label className="text-xs text-slate-500">IRI (Unique Identifier)</label>
                 <input
                    type="text"
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 rounded p-2 text-xs font-mono text-slate-300 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-slate-700"
                    value={localData.iri || `http://example.org/${selectedNode.id}`}
                    onChange={(e) => handleChange('iri', e.target.value)}
                />
            </div>
             <div className="space-y-1">
                 <label className="text-xs text-slate-500">Label (Display Name)</label>
                 <input
                    type="text"
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 rounded p-2 text-xs font-mono text-slate-300 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-slate-700"
                    value={localData.label}
                    onChange={(e) => handleChange('label', e.target.value)}
                />
            </div>
        </div>

        {/* Annotations */}
        <AnnotationManager 
            annotations={localData.annotations} 
            onUpdate={handleAnnotationsUpdate}
        />

        {/* Specialized Views based on Entity Type */}
        {isObjectProperty ? (
            <div className="space-y-6 pt-4 border-t border-slate-800">
                {/* Characteristics */}
                 <div className="space-y-2">
                     <div className="flex justify-between items-end">
                         <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Characteristics</h3>
                         <button onClick={addAttribute} className="text-blue-400 hover:bg-blue-500/10 p-1 rounded"><Plus size={14}/></button>
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                         {localData.attributes.map(attr => (
                             <div key={attr.id} className="bg-slate-950 border border-slate-800 rounded px-2 py-1 flex justify-between items-center group">
                                 <select 
                                     className="bg-transparent text-[10px] text-slate-300 outline-none w-full"
                                     value={attr.name}
                                     onChange={(e) => updateAttribute(attr.id, 'name', e.target.value)}
                                 >
                                     {CHARACTERISTICS.map(c => <option key={c} value={c}>{c}</option>)}
                                 </select>
                                 <button onClick={() => removeAttribute(attr.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100"><X size={10}/></button>
                             </div>
                         ))}
                     </div>
                 </div>

                 {renderAxiomGroup('Domains (Intersection)', ['Domain'], <ArrowRight size={12} />, 'Class')}
                 {renderAxiomGroup('Ranges (Intersection)', ['Range'], <ArrowRight size={12} />, 'Class')}
                 {renderAxiomGroup('Super Properties', ['SubPropertyOf'], <GitMerge size={12} />, 'Property')}
                 {renderAxiomGroup('Inverse Properties', ['InverseOf'], <GitMerge size={12} className="rotate-180" />, 'Property')}
                 {renderAxiomGroup('Equivalent Properties', ['EquivalentTo'], <Link2 size={12} />, 'Property')}
                 {renderAxiomGroup('Disjoint Properties', ['DisjointWith'], <Split size={12} />, 'Property')}
                 {renderAxiomGroup('Property Chains', ['PropertyChainAxiom'], <GitCommit size={12} />, 'prop1 o prop2', true)}
            </div>
        ) : (
            // Default View for Classes, DataProps, Individuals
            <>
                <div className="space-y-3 pt-4 border-t border-slate-800">
                    <div className="flex justify-between items-end">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            {isPropertyNode ? 'Characteristics' : 'Data Properties'}
                        </h3>
                        <button 
                            onClick={addAttribute} 
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium hover:bg-blue-500/10 px-2 py-1 rounded transition-colors"
                        >
                            <Plus size={14} /> Add
                        </button>
                    </div>
                    
                    <div className="space-y-2">
                        {localData.attributes?.map((attr) => (
                        <div key={attr.id} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 group hover:border-slate-700 transition-all">
                            <div className="flex gap-2 items-start">
                                <div className="flex-1 flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => updateAttribute(attr.id, 'isDerived', !attr.isDerived)}
                                            className={`p-1 rounded text-[10px] font-mono border ${attr.isDerived ? 'bg-blue-900/30 border-blue-500/50 text-blue-300' : 'bg-slate-900 border-slate-700 text-slate-600'}`}
                                            title="Derived Property (/)"
                                        >
                                            /
                                        </button>
                                        
                                        {isPropertyNode ? (
                                            <div className="flex-1 relative">
                                                <select
                                                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                                                    value={attr.name}
                                                    onChange={(e) => updateAttribute(attr.id, 'name', e.target.value)}
                                                >
                                                    {CHARACTERISTICS.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                        ) : (
                                            <input 
                                                className="bg-transparent text-sm text-slate-200 outline-none placeholder-slate-600 font-medium w-full"
                                                value={attr.name}
                                                onChange={(e) => updateAttribute(attr.id, 'name', e.target.value)}
                                                placeholder="hasAge"
                                            />
                                        )}
                                        <button 
                                            onClick={() => toggleExpand(attr.id)}
                                            className={`text-slate-500 hover:text-blue-400 transition-colors ml-1 ${expandedId === attr.id ? 'text-blue-400' : ''}`}
                                        >
                                            <Quote size={12} />
                                        </button>
                                    </div>
                                    {!isPropertyNode && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Range</span>
                                            <div className="relative flex-1">
                                                <input 
                                                    className="bg-slate-900/50 border border-slate-800 focus:border-blue-500/50 rounded px-2 py-1 text-xs text-blue-300 outline-none placeholder-slate-600 w-full font-mono transition-colors"
                                                    value={attr.type}
                                                    onChange={(e) => updateAttribute(attr.id, 'type', e.target.value)}
                                                    onFocus={() => setActiveAttrType(attr.id)}
                                                    placeholder="xsd:string"
                                                    autoComplete="off"
                                                />
                                                {activeAttrType === attr.id && (
                                                    <div className="absolute top-full left-0 mt-1 w-full bg-slate-800 border border-slate-700 rounded shadow-xl z-50 max-h-32 overflow-y-auto">
                                                        {XSD_TYPES.filter(t => t.toLowerCase().includes(attr.type.toLowerCase())).map(type => (
                                                            <div 
                                                                key={type}
                                                                className="px-3 py-1.5 text-xs text-slate-300 hover:bg-blue-600 hover:text-white cursor-pointer font-mono"
                                                                onMouseDown={(e) => { e.preventDefault(); updateAttribute(attr.id, 'type', type); setActiveAttrType(null); }}
                                                            >
                                                                {type}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => removeAttribute(attr.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"><X size={14} /></button>
                            </div>
                            {expandedId === attr.id && (
                                <div className="mt-2 pt-2 border-t border-slate-800/50 pl-2 border-l-2 border-l-blue-900/30">
                                    <AnnotationManager annotations={attr.annotations} onUpdate={(anns) => updateAttribute(attr.id, 'annotations', anns)} title="Annotations" compact />
                                </div>
                            )}
                        </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-800">
                    <div className="flex justify-between items-end">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Axioms</h3>
                        <button onClick={() => addMethod('SubClassOf')} className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium hover:bg-blue-500/10 px-2 py-1 rounded transition-colors"><Plus size={14} /> Add</button>
                    </div>
                    {/* Simplified Axiom List for Non-ObjectProperties */}
                    <div className="space-y-2">
                        {localData.methods?.map((method) => (
                             <div key={method.id} className="bg-slate-950 border border-slate-800 rounded-lg p-2 group hover:border-slate-700 transition-colors flex gap-2 items-center">
                                 <input 
                                     className="w-1/3 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-purple-300 font-mono"
                                     value={method.name}
                                     onChange={(e) => updateMethod(method.id, 'name', e.target.value)}
                                 />
                                 <ArrowRight size={10} className="text-slate-600" />
                                 <div className="flex-1 relative">
                                    <input 
                                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-300 font-mono"
                                        value={method.returnType}
                                        onChange={(e) => updateMethod(method.id, 'returnType', e.target.value)}
                                        placeholder="Target"
                                    />
                                    {isClassNode && (
                                         <div className="absolute right-0 top-0 bottom-0 flex items-center pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                             <div className="flex gap-0.5">
                                                 {QUANTIFIERS.slice(0, 3).map(q => (
                                                     <button key={q} onMouseDown={(e) => { e.preventDefault(); appendToMethodTarget(method.id, q); }} className="px-1 bg-slate-700 text-[8px] rounded text-slate-400 hover:bg-blue-600 hover:text-white">{q}</button>
                                                 ))}
                                             </div>
                                         </div>
                                    )}
                                 </div>
                                 <button onClick={() => toggleExpand(method.id)} className={`text-slate-500 hover:text-blue-400 ${expandedId === method.id ? 'text-blue-400' : ''}`}><Quote size={12}/></button>
                                 <button onClick={() => removeMethod(method.id)} className="text-slate-600 hover:text-red-400"><X size={12}/></button>
                                 
                                 {expandedId === method.id && (
                                    <div className="absolute left-0 right-0 mt-8 bg-slate-900 border border-slate-700 z-10 p-2 rounded shadow-xl">
                                        <AnnotationManager annotations={method.annotations} onUpdate={(anns) => updateMethod(method.id, 'annotations', anns)} title="Axiom Annotations" compact />
                                    </div>
                                )}
                             </div>
                        ))}
                    </div>
                </div>
            </>
        )}

      </div>
    </div>
  );
};

export default PropertiesPanel;