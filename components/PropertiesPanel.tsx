import React, { useState, useEffect, useRef } from 'react';
import { Node } from 'reactflow';
import { UMLNodeData } from '../types';
import { Trash2, Plus, X, Tag, ChevronDown, Box, ArrowRight, MousePointerClick } from 'lucide-react';

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

const AXIOM_TYPES = [
  'SubClassOf', 'DisjointWith', 'EquivalentTo', 'UnionOf', 
  'IntersectionOf', 'OneOf', 'ComplementOf', 'DisjointUnionOf', 'HasKey',
  'SameAs', 'DifferentFrom'
];

const QUANTIFIERS = ['some', 'only', 'min', 'max', 'exactly', 'value', 'self'];

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedNode, onUpdateNode, onDeleteNode }) => {
  const [localData, setLocalData] = useState<UMLNodeData | null>(null);
  
  // Track focus for autocomplete
  const [activeAttrType, setActiveAttrType] = useState<string | null>(null);
  const [activeAxiomName, setActiveAxiomName] = useState<string | null>(null);
  const [activeAxiomTarget, setActiveAxiomTarget] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedNode) {
      setLocalData({ ...selectedNode.data });
    } else {
      setLocalData(null);
      setActiveAttrType(null);
      setActiveAxiomName(null);
      setActiveAxiomTarget(null);
    }
  }, [selectedNode]);

  // Click outside listener to close autocomplete
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as unknown as HTMLElement)) {
        setActiveAttrType(null);
        setActiveAxiomName(null);
        setActiveAxiomTarget(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!selectedNode || !localData) {
    return (
      <div className="w-96 bg-slate-900 border-l border-slate-800 p-6 flex flex-col items-center justify-center text-center h-full">
        <div className="bg-slate-800 p-6 rounded-full mb-6 border border-slate-700 shadow-xl">
            <Box className="w-10 h-10 text-slate-500" />
        </div>
        <h3 className="text-slate-200 font-semibold text-lg mb-2">No Selection</h3>
        <p className="text-slate-500 text-sm max-w-[200px]">Select a class, individual, or datatype from the canvas to edit its properties.</p>
      </div>
    );
  }

  const handleChange = (field: keyof UMLNodeData, value: any) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  // --- Data Attributes Logic ---
  const addAttribute = () => {
    const newAttr = { id: `attr-${Date.now()}`, name: 'newProperty', type: 'xsd:string', visibility: '+' as const };
    const newData = { ...localData, attributes: [...(localData.attributes || []), newAttr] };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  const updateAttribute = (id: string, field: string, value: string) => {
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

  // --- Axioms / Methods Logic ---
  const addMethod = () => {
    const newMethod = { id: `method-${Date.now()}`, name: 'SubClassOf', returnType: 'Thing', visibility: '+' as const };
    const newData = { ...localData, methods: [...(localData.methods || []), newMethod] };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  const updateMethod = (id: string, field: string, value: string) => {
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
          const current = method.returnType;
          // Heuristic: replace "Thing" default or append
          const newValue = current === 'Thing' ? `${textToAppend} ` : `${current.trim()} ${textToAppend} `;
          updateMethod(methodId, 'returnType', newValue);
          
          // Focus fix hack: find the input and focus it
          setTimeout(() => {
             const input = document.getElementById(`axiom-target-${methodId}`);
             input?.focus();
          }, 0);
      }
  };

  // Helper to strip "owl_" prefix for display
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
            <div className="space-y-3">
                <div className="space-y-1">
                     <label className="text-xs text-slate-500">IRI (Unique Identifier)</label>
                     <input
                        type="text"
                        className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blue-500 rounded p-2 text-xs font-mono text-slate-300 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-slate-700"
                        value={localData.iri || `http://example.org/${selectedNode.id}`}
                        onChange={(e) => handleChange('iri', e.target.value)}
                    />
                </div>
            </div>
        </div>

        {/* Annotations Section */}
        <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                Annotations
            </h3>
            
            <div className="bg-slate-950/50 rounded-lg border border-slate-800 overflow-hidden">
                {/* skos:prefLabel */}
                <div className="flex items-center gap-3 p-2 border-b border-slate-800/50">
                    <div className="flex items-center gap-1.5 w-24 shrink-0 text-slate-500 text-xs font-mono">
                        <Tag size={10} />
                        <span>prefLabel</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                        <input 
                            className="flex-1 bg-transparent text-slate-200 outline-none placeholder-slate-600 text-sm"
                            value={localData.label}
                            onChange={(e) => handleChange('label', e.target.value)}
                        />
                        <span className="text-[10px] text-slate-600 font-mono px-1.5 py-0.5 bg-slate-900 rounded border border-slate-800">en</span>
                    </div>
                </div>

                {/* skos:definition */}
                <div className="flex items-start gap-3 p-2">
                    <div className="flex items-center gap-1.5 w-24 shrink-0 text-slate-500 text-xs font-mono pt-1">
                        <Tag size={10} />
                        <span>definition</span>
                    </div>
                    <div className="flex-1 flex gap-2">
                        <textarea 
                            rows={2}
                            className="flex-1 bg-transparent text-slate-200 outline-none placeholder-slate-600 text-sm resize-none"
                            placeholder="Add a description..."
                            value={localData.description || ''}
                            onChange={(e) => handleChange('description', e.target.value)}
                        />
                        <span className="text-[10px] text-slate-600 font-mono px-1.5 py-0.5 bg-slate-900 rounded border border-slate-800 h-fit mt-1">en</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Axioms & Restrictions (Methods) - REPLACES PARENTS/RELATIONSHIPS */}
        <div className="space-y-3">
            <div className="flex justify-between items-end">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Axioms & Restrictions
                </h3>
                <button 
                    onClick={addMethod} 
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium hover:bg-blue-500/10 px-2 py-1 rounded transition-colors"
                >
                    <Plus size={14} /> Add
                </button>
            </div>

            <div className="space-y-2">
                {localData.methods?.length === 0 && (
                    <div className="p-4 border-2 border-dashed border-slate-800 rounded-lg text-center">
                        <p className="text-slate-600 text-xs">No axioms defined.</p>
                        <button onClick={addMethod} className="text-blue-500 text-xs mt-1 hover:underline">Add SubClassOf</button>
                    </div>
                )}

                {localData.methods?.map((method, index) => (
                    <div key={method.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 group hover:border-slate-700 transition-colors">
                        <div className="flex items-start gap-2 mb-2">
                            {/* Autocomplete for Axiom Type / Property */}
                            <div className="relative flex-1 min-w-[120px]">
                                <label className="text-[10px] text-slate-500 mb-0.5 block">Property / Axiom</label>
                                <div className="relative">
                                    <input 
                                        className={`w-full bg-slate-900 border ${AXIOM_TYPES.includes(method.name) ? 'text-purple-400 border-purple-500/30' : 'text-blue-400 border-slate-700'} rounded px-2 py-1.5 text-xs font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50`}
                                        value={method.name}
                                        onChange={(e) => updateMethod(method.id, 'name', e.target.value)}
                                        onFocus={() => setActiveAxiomName(method.id)}
                                        placeholder="SubClassOf"
                                    />
                                    {activeAxiomName === method.id && (
                                        <div className="absolute top-full left-0 mt-1 w-full bg-slate-800 border border-slate-700 rounded shadow-xl z-50 max-h-40 overflow-y-auto">
                                            {/* Standard Axioms */}
                                            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase">Class Axioms</div>
                                            {AXIOM_TYPES.filter(t => t.toLowerCase().includes(method.name.toLowerCase())).map(type => (
                                                <div 
                                                    key={type}
                                                    className="px-3 py-1.5 text-xs text-purple-300 hover:bg-slate-700 cursor-pointer flex justify-between"
                                                    onMouseDown={(e) => { e.preventDefault(); updateMethod(method.id, 'name', type); setActiveAxiomName(null); }}
                                                >
                                                    {type}
                                                </div>
                                            ))}
                                            <div className="border-t border-slate-700 my-1"></div>
                                            <div className="px-2 py-1 text-[10px] text-slate-500 italic">Or type a property name...</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <ArrowRight size={14} className="text-slate-600 mt-6" />

                            {/* Target Input */}
                            <div className="relative flex-[2]">
                                <label className="text-[10px] text-slate-500 mb-0.5 block">Target / Expression</label>
                                <input
                                    id={`axiom-target-${method.id}`}
                                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                    value={method.returnType}
                                    onChange={(e) => updateMethod(method.id, 'returnType', e.target.value)}
                                    onFocus={() => setActiveAxiomTarget(method.id)}
                                    placeholder="Thing"
                                />
                                <button 
                                    onClick={() => removeMethod(method.id)}
                                    className="absolute -right-2 -top-6 text-slate-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Helper Chips for Quantifiers */}
                        {activeAxiomTarget === method.id && !AXIOM_TYPES.includes(method.name) && (
                            <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-slate-800/50 animate-in fade-in slide-in-from-top-1 duration-200">
                                {QUANTIFIERS.map(q => (
                                    <button
                                        key={q}
                                        onMouseDown={(e) => { e.preventDefault(); appendToMethodTarget(method.id, q); }}
                                        className="px-2 py-0.5 bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-400 text-[10px] rounded border border-slate-700 transition-colors flex items-center gap-1"
                                    >
                                        <MousePointerClick size={8} /> {q}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>

        {/* Data Properties (Attributes) */}
        <div className="space-y-3 border-t border-slate-800 pt-5">
          <div className="flex justify-between items-end">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                 Data Properties
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
              <div key={attr.id} className="flex gap-2 items-start bg-slate-950 p-2.5 rounded-lg border border-slate-800 group hover:border-slate-700 transition-all">
                <div className="flex-1 flex flex-col gap-2">
                    {/* Name Input */}
                    <input 
                        className="bg-transparent text-sm text-slate-200 outline-none placeholder-slate-600 font-medium w-full"
                        value={attr.name}
                        onChange={(e) => updateAttribute(attr.id, 'name', e.target.value)}
                        placeholder="hasAge"
                    />
                    
                    {/* Type Input with Autocomplete */}
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
                            
                            {/* Type Dropdown */}
                            {activeAttrType === attr.id && (
                                <div className="absolute top-full left-0 mt-1 w-full bg-slate-800 border border-slate-700 rounded shadow-xl z-50 max-h-32 overflow-y-auto">
                                    {XSD_TYPES.filter(t => t.toLowerCase().includes(attr.type.toLowerCase())).map(type => (
                                        <div 
                                            key={type}
                                            className="px-3 py-1.5 text-xs text-slate-300 hover:bg-blue-600 hover:text-white cursor-pointer font-mono"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                updateAttribute(attr.id, 'type', type);
                                                setActiveAttrType(null);
                                            }}
                                        >
                                            {type}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <button 
                    onClick={() => removeAttribute(attr.id)} 
                    className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                    <X size={14} />
                </button>
              </div>
            ))}
             {(!localData.attributes || localData.attributes.length === 0) && (
                <div className="text-xs text-slate-600 italic px-2">No data properties defined.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PropertiesPanel;