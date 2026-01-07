import React, { useState, useEffect, useRef } from 'react';
import { Node } from 'reactflow';
import { UMLNodeData } from '../types';
import { Trash2, Plus, X, Tag, Sparkles } from 'lucide-react';

interface PropertiesPanelProps {
  selectedNode: Node<UMLNodeData> | null;
  onUpdateNode: (id: string, data: UMLNodeData) => void;
  onDeleteNode: (id: string) => void;
}

const XSD_TYPES = [
  'xsd:string',
  'xsd:integer',
  'xsd:int',
  'xsd:boolean',
  'xsd:dateTime',
  'xsd:date',
  'xsd:time',
  'xsd:float',
  'xsd:double',
  'xsd:decimal',
  'xsd:long',
  'xsd:short',
  'xsd:byte',
  'xsd:nonNegativeInteger',
  'xsd:base64Binary',
  'xsd:anyURI',
  'xsd:normalizedString',
  'xsd:token',
  'xsd:language',
  'rdf:PlainLiteral',
  'rdf:XMLLiteral'
];

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedNode, onUpdateNode, onDeleteNode }) => {
  const [localData, setLocalData] = useState<UMLNodeData | null>(null);
  // Track which attribute's type input is currently focused
  const [activeAttrId, setActiveAttrId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedNode) {
      setLocalData({ ...selectedNode.data });
    } else {
      setLocalData(null);
      setActiveAttrId(null);
    }
  }, [selectedNode]);

  // Click outside listener to close autocomplete
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Cast to HTMLElement to avoid conflict with ReactFlow Node type
      if (panelRef.current && !panelRef.current.contains(event.target as unknown as HTMLElement)) {
        setActiveAttrId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!selectedNode || !localData) {
    return (
      <div className="w-80 bg-[#262626] border-l border-[#333] p-6 flex flex-col items-center justify-center text-center h-full">
        <div className="bg-[#333] p-4 rounded-full mb-4">
            <svg className="w-8 h-8 text-[#666]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
        </div>
        <p className="text-[#888] font-medium text-sm">Select an entity to edit properties</p>
      </div>
    );
  }

  const handleChange = (field: keyof UMLNodeData, value: any) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  const addAttribute = () => {
    const newAttr = { id: `attr-${Date.now()}`, name: 'newProperty', type: 'xsd:string', visibility: '+' as const };
    const newData = { ...localData, attributes: [...(localData.attributes || []), newAttr] };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
    // Automatically focus the new type input logic could go here, 
    // but simplified to just adding for now.
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
  }

  const handleTypeSelect = (attrId: string, type: string) => {
      updateAttribute(attrId, 'type', type);
      setActiveAttrId(null);
  };

  // Helper to strip "owl_" prefix for display
  const displayType = localData.type.replace('owl_', '').replace(/_/g, ' ');

  return (
    <div ref={panelRef} className="w-96 bg-[#262626] border-l border-[#404040] h-full overflow-y-auto flex flex-col font-sans text-sm text-gray-200">
      
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#404040] flex justify-between items-center bg-[#2d2d2d]">
        <div className="flex items-center gap-2">
            <div className="font-bold text-lg text-white capitalize">{displayType}: <span className="text-blue-400">{localData.label}</span></div>
        </div>
        <div className="flex gap-2">
            <button 
            onClick={() => onDeleteNode(selectedNode.id)}
            className="text-[#888] hover:text-red-400 p-1.5 rounded transition-colors"
            title="Delete Entity"
            >
            <Trash2 size={16} />
            </button>
        </div>
      </div>

      <div className="p-5 space-y-8">
        
        {/* IRI Section */}
        <div className="space-y-2">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
                IRI
            </h3>
            <div className="group relative">
                <input
                    type="text"
                    className="w-full bg-[#1a1a1a] border border-transparent hover:border-[#444] focus:border-blue-500 rounded p-2 text-sm text-gray-300 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-[#555]"
                    value={localData.iri || `http://webprotege.stanford.edu/${selectedNode.id}`}
                    onChange={(e) => handleChange('iri', e.target.value)}
                />
            </div>
        </div>

        {/* Annotations Section */}
        <div className="space-y-3">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
                Annotations
            </h3>
            
            {/* skos:prefLabel */}
            <div className="flex items-center gap-2 border-b border-[#333] pb-2">
                 <div className="flex items-center gap-1 w-24 shrink-0 text-[#aaa] text-xs font-mono">
                    <Tag size={12} />
                    <span>skos:prefLabel</span>
                 </div>
                 <div className="flex-1 flex bg-[#1a1a1a] border border-[#333] rounded overflow-hidden">
                    <input 
                        className="flex-1 bg-transparent px-2 py-1 text-white outline-none"
                        value={localData.label}
                        onChange={(e) => handleChange('label', e.target.value)}
                    />
                    <div className="bg-[#333] px-2 py-1 text-xs text-[#888] border-l border-[#444] flex items-center">en</div>
                    <button className="px-2 hover:bg-[#444] text-[#666] hover:text-white transition-colors"><X size={12}/></button>
                 </div>
            </div>

            {/* skos:definition */}
            <div className="flex items-center gap-2 border-b border-[#333] pb-2">
                 <div className="flex items-center gap-1 w-24 shrink-0 text-[#aaa] text-xs font-mono">
                    <Tag size={12} />
                    <span>skos:definition</span>
                 </div>
                 <div className="flex-1 flex bg-[#1a1a1a] border border-[#333] rounded overflow-hidden">
                    <input 
                        className="flex-1 bg-transparent px-2 py-1 text-white outline-none placeholder-[#444]"
                        placeholder="Enter definition..."
                        value={localData.description || ''}
                        onChange={(e) => handleChange('description', e.target.value)}
                    />
                     <div className="bg-[#333] px-2 py-1 text-xs text-[#888] border-l border-[#444] flex items-center">en</div>
                     <button className="px-2 hover:bg-[#444] text-[#666] hover:text-white transition-colors"><X size={12}/></button>
                 </div>
            </div>
            
            {/* Placeholder for new annotation */}
             <div className="flex items-center gap-2 pt-1 opacity-50 hover:opacity-100 transition-opacity">
                 <input className="w-24 bg-transparent border-b border-[#444] text-xs text-[#666] px-1 py-1 outline-none focus:border-blue-500" placeholder="Enter property" />
                 <input className="flex-1 bg-transparent border-b border-[#444] text-xs text-[#666] px-1 py-1 outline-none focus:border-blue-500" placeholder="Enter value" />
                 <div className="w-8 text-xs text-[#666] text-right">lang</div>
            </div>
        </div>

        {/* Parents Section */}
        <div className="space-y-2">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
                Parents
            </h3>
            <div className="border-b border-[#333] pb-2">
                <input 
                    className="w-full bg-transparent text-sm text-[#888] placeholder-[#444] outline-none" 
                    placeholder="Enter a class name" 
                />
            </div>
        </div>

        {/* Relationships Section */}
        <div className="space-y-2">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
                Relationships
            </h3>
            <div className="flex items-center gap-2 border-b border-[#333] pb-2">
                <input className="flex-1 bg-transparent text-sm text-[#888] placeholder-[#444] outline-none" placeholder="Enter property" />
                <input className="flex-1 bg-transparent text-sm text-[#888] placeholder-[#444] outline-none" placeholder="Enter value" />
                <div className="w-8 text-xs text-[#444] text-right">lang</div>
            </div>
        </div>

        {/* Data Properties (Attributes) */}
        <div className="space-y-3 pt-4 border-t border-[#444]">
          <div className="flex justify-between items-center">
             <h3 className="text-md font-bold text-white flex items-center gap-2">
                 Data Properties
             </h3>
             <button onClick={addAttribute} className="text-blue-400 hover:bg-[#333] p-1.5 rounded transition-colors">
                <Plus size={16} />
             </button>
          </div>
          
          <div className="space-y-2 pb-20">
            {localData.attributes?.map((attr) => (
              <div key={attr.id} className="flex gap-2 items-start bg-[#333] p-2 rounded border border-[#444] group relative z-0 hover:z-10">
                <div className="flex-1 flex flex-col gap-1">
                    <input 
                        className="bg-transparent text-sm text-white outline-none placeholder-[#666] font-semibold"
                        value={attr.name}
                        onChange={(e) => updateAttribute(attr.id, 'name', e.target.value)}
                        placeholder="Property Name"
                    />
                    <div className="flex items-center gap-1 relative">
                        <span className="text-xs text-[#888] whitespace-nowrap">Range:</span>
                        
                        {/* IntelliSense Input Wrapper */}
                        <div className="relative w-full">
                            <input 
                                className="bg-transparent text-xs text-blue-300 outline-none placeholder-[#666] w-full"
                                value={attr.type}
                                onChange={(e) => updateAttribute(attr.id, 'type', e.target.value)}
                                onFocus={() => setActiveAttrId(attr.id)}
                                placeholder="xsd:string"
                                autoComplete="off"
                            />
                            
                            {/* Autocomplete Dropdown */}
                            {activeAttrId === attr.id && (
                                <div className="absolute top-full left-0 mt-1 w-48 bg-[#1f1f1f] border border-[#555] rounded shadow-xl z-50 max-h-40 overflow-y-auto">
                                    {XSD_TYPES.filter(t => t.toLowerCase().includes(attr.type.toLowerCase())).length > 0 ? (
                                        XSD_TYPES.filter(t => t.toLowerCase().includes(attr.type.toLowerCase())).map(type => (
                                            <div 
                                                key={type}
                                                className="px-3 py-1.5 text-xs text-gray-300 hover:bg-blue-600 hover:text-white cursor-pointer"
                                                onMouseDown={(e) => {
                                                    e.preventDefault(); // Prevent input blur before click registers
                                                    handleTypeSelect(attr.id, type);
                                                }}
                                            >
                                                {type}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="px-3 py-1.5 text-xs text-gray-500 italic">No matching XSD types</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <button onClick={() => removeAttribute(attr.id)} className="text-[#666] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={14} />
                </button>
              </div>
            ))}
             {(!localData.attributes || localData.attributes.length === 0) && (
                <p className="text-xs text-[#555] italic">No data properties defined.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PropertiesPanel;