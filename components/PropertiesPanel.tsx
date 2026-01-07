import React, { useState, useEffect } from 'react';
import { Node } from 'reactflow';
import { UMLNodeData } from '../types';
import { Trash2, Plus, X } from 'lucide-react';

interface PropertiesPanelProps {
  selectedNode: Node<UMLNodeData> | null;
  onUpdateNode: (id: string, data: UMLNodeData) => void;
  onDeleteNode: (id: string) => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedNode, onUpdateNode, onDeleteNode }) => {
  const [localData, setLocalData] = useState<UMLNodeData | null>(null);

  useEffect(() => {
    if (selectedNode) {
      setLocalData({ ...selectedNode.data });
    } else {
      setLocalData(null);
    }
  }, [selectedNode]);

  if (!selectedNode || !localData) {
    return (
      <div className="w-80 bg-gray-50 border-l border-gray-200 p-6 flex flex-col items-center justify-center text-center h-full">
        <div className="bg-gray-200 p-4 rounded-full mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
        </div>
        <p className="text-gray-500 font-medium">Select an element to edit properties</p>
      </div>
    );
  }

  const handleChange = (field: keyof UMLNodeData, value: any) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  const addAttribute = () => {
    const newAttr = { id: `attr-${Date.now()}`, name: 'newAttr', type: 'String', visibility: '-' as const };
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
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 h-full overflow-y-auto flex flex-col">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h2 className="font-bold text-gray-800">Properties</h2>
        <button 
          onClick={() => onDeleteNode(selectedNode.id)}
          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors"
          title="Delete Element"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Basic Info */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-gray-500 uppercase">Name</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            value={localData.label}
            onChange={(e) => handleChange('label', e.target.value)}
          />
        </div>

        {/* Stereotype */}
        <div className="space-y-3">
            <label className="block text-xs font-semibold text-gray-500 uppercase">Stereotype</label>
             <input
                type="text"
                className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={localData.stereotype || ''}
                placeholder="e.g. <<Service>>"
                onChange={(e) => handleChange('stereotype', e.target.value)}
             />
        </div>

        {/* Attributes */}
        <div>
          <div className="flex justify-between items-center mb-3">
             <label className="block text-xs font-semibold text-gray-500 uppercase">Attributes</label>
             <button onClick={addAttribute} className="text-blue-600 hover:bg-blue-50 p-1 rounded">
                <Plus size={14} />
             </button>
          </div>
          
          <div className="space-y-2">
            {localData.attributes?.map((attr) => (
              <div key={attr.id} className="flex gap-1 items-center bg-gray-50 p-1.5 rounded border border-gray-100">
                <select 
                    value={attr.visibility} 
                    onChange={(e) => updateAttribute(attr.id, 'visibility', e.target.value)}
                    className="bg-transparent text-xs font-mono border-none focus:ring-0 p-0 w-8 text-center cursor-pointer"
                >
                    <option value="+">+</option>
                    <option value="-">-</option>
                    <option value="#">#</option>
                    <option value="~">~</option>
                </select>
                <input 
                    className="bg-transparent border-b border-transparent focus:border-blue-300 w-20 text-xs px-1 outline-none"
                    value={attr.name}
                    onChange={(e) => updateAttribute(attr.id, 'name', e.target.value)}
                />
                <span className="text-gray-400">:</span>
                 <input 
                    className="bg-transparent border-b border-transparent focus:border-blue-300 w-16 text-xs px-1 outline-none text-gray-600"
                    value={attr.type}
                    onChange={(e) => updateAttribute(attr.id, 'type', e.target.value)}
                />
                <button onClick={() => removeAttribute(attr.id)} className="ml-auto text-gray-400 hover:text-red-500">
                    <X size={12} />
                </button>
              </div>
            ))}
             {(!localData.attributes || localData.attributes.length === 0) && (
                <p className="text-xs text-gray-400 italic">No attributes defined.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PropertiesPanel;
