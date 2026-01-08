import React, { useState, useEffect, useRef } from 'react';
import { Node } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { Trash2, Plus, X, Tag, ChevronDown, Box, ArrowRight, MousePointerClick, ListOrdered, Hash, Quote } from 'lucide-react';

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

const ANNOTATION_PROPS = [
    'rdfs:label', 'rdfs:comment', 'rdfs:seeAlso', 'rdfs:isDefinedBy', 
    'owl:versionInfo', 'owl:backwardCompatibleWith', 'owl:incompatibleWith', 
    'owl:deprecated', 'skos:prefLabel', 'skos:altLabel', 'skos:definition', 
    'skos:note', 'dc:title', 'dc:description', 'dc:creator', 'dc:date'
];

const CLASS_AXIOMS = [
  'SubClassOf', 'DisjointWith', 'EquivalentTo', 'UnionOf', 
  'IntersectionOf', 'OneOf', 'ComplementOf', 'DisjointUnionOf', 'HasKey',
  'SameAs', 'DifferentFrom'
];

const PROPERTY_AXIOMS = [
  'SubPropertyOf', 'EquivalentTo', 'DisjointWith', 'InverseOf', 
  'PropertyChainAxiom', 'Domain', 'Range'
];

const CHARACTERISTICS = [
    'Functional', 'InverseFunctional', 'Transitive', 'Symmetric', 
    'Asymmetric', 'Reflexive', 'Irreflexive'
];

const QUANTIFIERS = ['some', 'only', 'min', 'max', 'exactly', 'value', 'self'];

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedNode, onUpdateNode, onDeleteNode }) => {
  const [localData, setLocalData] = useState<UMLNodeData | null>(null);
  
  const [activeAttrType, setActiveAttrType] = useState<string | null>(null);
  const [activeAxiomName, setActiveAxiomName] = useState<string | null>(null);
  const [activeAxiomTarget, setActiveAxiomTarget] = useState<string | null>(null);
  const [activeAnnProp, setActiveAnnProp] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedNode) {
      setLocalData({ ...selectedNode.data });
    } else {
      setLocalData(null);
      setActiveAttrType(null);
      setActiveAxiomName(null);
      setActiveAxiomTarget(null);
      setActiveAnnProp(null);
    }
  }, [selectedNode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as unknown as HTMLElement)) {
        setActiveAttrType(null);
        setActiveAxiomName(null);
        setActiveAxiomTarget(null);
        setActiveAnnProp(null);
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
        <p className="text-slate-500 text-sm max-w-[200px]">Select a class, individual, property or datatype from the canvas to edit its properties.</p>
      </div>
    );
  }

  const isPropertyNode = localData.type === ElementType.OWL_OBJECT_PROPERTY || localData.type === ElementType.OWL_DATA_PROPERTY;
  const isClassNode = localData.type === ElementType.OWL_CLASS;

  const handleChange = (field: keyof UMLNodeData, value: any) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  // --- Annotations ---
  const addAnnotation = () => {
    const newAnn = {
        id: `ann-${Date.now()}`,
        property: 'rdfs:comment',
        value: '"New Annotation"',
        language: 'en'
    };
    const newData = { ...localData, annotations: [...(localData.annotations || []), newAnn] };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  const updateAnnotation = (id: string, field: string, value: any) => {
    const newAnns = (localData.annotations || []).map(a => a.id === id ? { ...a, [field]: value } : a);
    const newData = { ...localData, annotations: newAnns };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  const removeAnnotation = (id: string) => {
    const newAnns = (localData.annotations || []).filter(a => a.id !== id);
    const newData = { ...localData, annotations: newAnns };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  }

  // --- Attributes (Data Props or Characteristics) ---
  const addAttribute = () => {
    const defaultName = isPropertyNode ? 'Functional' : 'newProperty';
    const defaultType = isPropertyNode ? '' : 'xsd:string'; 
    
    const newAttr = { 
        id: `attr-${Date.now()}`, 
        name: defaultName, 
        type: defaultType, 
        visibility: '+' as const,
        isDerived: false 
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

  // --- Axioms ---
  const addMethod = () => {
    const defaultName = isPropertyNode ? 'SubPropertyOf' : 'SubClassOf';
    const newMethod = { 
        id: `method-${Date.now()}`, 
        name: defaultName, 
        returnType: 'Target', 
        visibility: '+' as const,
        isOrdered: false 
    };
    const newData = { ...localData, methods: [...(localData.methods || []), newMethod] };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  const updateMethod = (id: string, field: string, value: any) => {
    let finalValue = value;
    if (field === 'returnType') {
        const method = localData.methods.find(m => m.id === id);
        if (method && !method.isOrdered) {
             const name = method.name.toLowerCase();
             const setAxioms = [
                'unionof', 'intersectionof', 'oneof', 'disjointunionof', 
                'equivalentto', 'equivalentclass', 'equivalentproperty',
                'disjointwith', 'sameas', 'differentfrom', 'haskey'
            ];
            if (setAxioms.some(ax => name.includes(ax))) {
                 if (value.endsWith(' ')) {
                     // preserve trailing space
                 } else {
                     // simple dedup might interfere with typing if not careful
                 }
            }
        }
    }

    const newMethods = localData.methods.map(m => m.id === id ? { ...m, [field]: finalValue } : m);
    const newData = { ...localData, methods: newMethods };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  const handleBlurMethod = (id: string) => {
      const method = localData.methods.find(m => m.id === id);
      if (method && !method.isOrdered && method.returnType) {
          const name = method.name.toLowerCase();
          const setAxioms = [
            'unionof', 'intersectionof', 'oneof', 'disjointunionof', 
            'equivalentto', 'equivalentclass', 'equivalentproperty',
            'disjointwith', 'sameas', 'differentfrom', 'haskey'
          ];
          if (setAxioms.some(ax => name.includes(ax))) {
                const tokens = method.returnType.split(/\s+/).filter(t => t.trim().length > 0);
                const unique = Array.from(new Set(tokens));
                const normalized = unique.join(' ');
                if (normalized !== method.returnType.trim()) {
                    updateMethod(id, 'returnType', normalized);
                }
          }
      }
  }

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
          setTimeout(() => {
             const input = document.getElementById(`axiom-target-${methodId}`);
             input?.focus();
          }, 0);
      }
  };

  const displayType = localData.type.replace('owl_', '').replace(/_/g, ' ');
  const relevantAxioms = isPropertyNode ? PROPERTY_AXIOMS : CLASS_AXIOMS;

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
        <div className="space-y-3">
             <div className="flex justify-between items-end">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Quote size={12} /> Annotations
                </h3>
                <button 
                    onClick={addAnnotation} 
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium hover:bg-blue-500/10 px-2 py-1 rounded transition-colors"
                >
                    <Plus size={14} /> Add
                </button>
            </div>
            
            <div className="space-y-2">
                {(localData.annotations && localData.annotations.length > 0) ? (
                    localData.annotations.map(ann => (
                        <div key={ann.id} className="bg-slate-950 border border-slate-800 rounded p-2 group hover:border-slate-700 transition-colors">
                            <div className="flex items-start gap-2">
                                <div className="w-24 shrink-0 relative">
                                    <input 
                                        className="w-full bg-slate-900 border border-slate-700 text-[10px] text-slate-400 font-mono rounded px-1 py-1 focus:outline-none focus:border-blue-500"
                                        value={ann.property}
                                        onChange={(e) => updateAnnotation(ann.id, 'property', e.target.value)}
                                        onFocus={() => setActiveAnnProp(ann.id)}
                                        placeholder="rdfs:comment"
                                    />
                                    {activeAnnProp === ann.id && (
                                        <div className="absolute top-full left-0 mt-1 w-32 bg-slate-800 border border-slate-700 rounded shadow-xl z-50 max-h-32 overflow-y-auto">
                                            {ANNOTATION_PROPS.filter(p => p.toLowerCase().includes(ann.property.toLowerCase())).map(p => (
                                                <div 
                                                    key={p}
                                                    className="px-2 py-1 text-[10px] text-slate-300 hover:bg-blue-600 hover:text-white cursor-pointer font-mono"
                                                    onMouseDown={(e) => { e.preventDefault(); updateAnnotation(ann.id, 'property', p); setActiveAnnProp(null); }}
                                                >
                                                    {p}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <textarea 
                                        rows={2}
                                        className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded px-1 py-1 focus:outline-none focus:border-blue-500 resize-none"
                                        value={ann.value}
                                        onChange={(e) => updateAnnotation(ann.id, 'value', e.target.value)}
                                        placeholder='"Value"'
                                    />
                                </div>
                                <div className="w-10 shrink-0">
                                     <input 
                                        className="w-full bg-slate-900 border border-slate-700 text-[10px] text-slate-400 font-mono rounded px-1 py-1 focus:outline-none focus:border-blue-500 text-center"
                                        value={ann.language || ''}
                                        onChange={(e) => updateAnnotation(ann.id, 'language', e.target.value)}
                                        placeholder="en"
                                    />
                                </div>
                                <button 
                                    onClick={() => removeAnnotation(ann.id)}
                                    className="text-slate-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                     <div className="text-center py-4 border border-dashed border-slate-800 rounded text-slate-600 text-xs">
                        No annotations.
                    </div>
                )}
            </div>
        </div>

        {/* Axioms (Methods) */}
        <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex justify-between items-end">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {isPropertyNode ? 'Property Axioms' : 'Class Axioms'}
                </h3>
                <button 
                    onClick={addMethod} 
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium hover:bg-blue-500/10 px-2 py-1 rounded transition-colors"
                >
                    <Plus size={14} /> Add
                </button>
            </div>

            <div className="space-y-2">
                {localData.methods?.map((method, index) => (
                    <div key={method.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 group hover:border-slate-700 transition-colors">
                        <div className="flex items-start gap-2 mb-2">
                            {/* Autocomplete for Axiom Name */}
                            <div className="relative flex-1 min-w-[120px]">
                                <label className="text-[10px] text-slate-500 mb-0.5 block">Type</label>
                                <div className="relative">
                                    <input 
                                        className={`w-full bg-slate-900 border ${relevantAxioms.includes(method.name) ? 'text-purple-400 border-purple-500/30' : 'text-blue-400 border-slate-700'} rounded px-2 py-1.5 text-xs font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50`}
                                        value={method.name}
                                        onChange={(e) => updateMethod(method.id, 'name', e.target.value)}
                                        onFocus={() => setActiveAxiomName(method.id)}
                                        placeholder="SubClassOf"
                                    />
                                    {activeAxiomName === method.id && (
                                        <div className="absolute top-full left-0 mt-1 w-full bg-slate-800 border border-slate-700 rounded shadow-xl z-50 max-h-40 overflow-y-auto">
                                            {relevantAxioms.map(type => (
                                                <div 
                                                    key={type}
                                                    className="px-3 py-1.5 text-xs text-purple-300 hover:bg-slate-700 cursor-pointer"
                                                    onMouseDown={(e) => { e.preventDefault(); updateMethod(method.id, 'name', type); setActiveAxiomName(null); }}
                                                >
                                                    {type}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <ArrowRight size={14} className="text-slate-600 mt-6" />

                            {/* Target Input */}
                            <div className="relative flex-[2]">
                                <div className="flex justify-between mb-0.5">
                                    <label className="text-[10px] text-slate-500 block">Target / Expression</label>
                                    {/* List / Set Toggle for specific axioms */}
                                    {['PropertyChainAxiom', 'HasKey', 'DisjointUnionOf'].some(a => method.name.includes(a)) && (
                                        <button 
                                            onClick={() => updateMethod(method.id, 'isOrdered', !method.isOrdered)}
                                            className={`flex items-center gap-1 text-[9px] px-1 rounded ${method.isOrdered ? 'bg-blue-900/50 text-blue-300 border border-blue-800' : 'bg-slate-800 text-slate-500'}`}
                                            title="Toggle Ordered List Semantics { ordered, nonunique }"
                                        >
                                            <ListOrdered size={10} />
                                            {method.isOrdered ? 'Ordered' : 'Set'}
                                        </button>
                                    )}
                                </div>
                                <input
                                    id={`axiom-target-${method.id}`}
                                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                    value={method.returnType}
                                    onChange={(e) => updateMethod(method.id, 'returnType', e.target.value)}
                                    onBlur={() => handleBlurMethod(method.id)}
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

                        {/* Helper Chips for Quantifiers (Only for Classes) */}
                        {isClassNode && activeAxiomTarget === method.id && (
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

        {/* Section 2: Attributes OR Characteristics */}
        <div className="space-y-3 border-t border-slate-800 pt-5">
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
              <div key={attr.id} className="flex gap-2 items-start bg-slate-950 p-2.5 rounded-lg border border-slate-800 group hover:border-slate-700 transition-all">
                <div className="flex-1 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        {/* Derived Toggle (/) */}
                        <button
                            onClick={() => updateAttribute(attr.id, 'isDerived', !attr.isDerived)}
                            className={`p-1 rounded text-[10px] font-mono border ${attr.isDerived ? 'bg-blue-900/30 border-blue-500/50 text-blue-300' : 'bg-slate-900 border-slate-700 text-slate-600'}`}
                            title="Derived Property (/)"
                        >
                            /
                        </button>
                        
                        {isPropertyNode ? (
                            // For Properties, "Name" is actually a selection of Characteristics
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
                            // For Classes, standard input
                            <input 
                                className="bg-transparent text-sm text-slate-200 outline-none placeholder-slate-600 font-medium w-full"
                                value={attr.name}
                                onChange={(e) => updateAttribute(attr.id, 'name', e.target.value)}
                                placeholder="hasAge"
                            />
                        )}
                    </div>
                    
                    {/* Type Input (Only for Classes) */}
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
                    )}
                </div>
                <button 
                    onClick={() => removeAttribute(attr.id)} 
                    className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                    <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PropertiesPanel;