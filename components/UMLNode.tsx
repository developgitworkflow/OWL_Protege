import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { Database, User, FileType } from 'lucide-react';

const UMLNode = ({ data, selected }: NodeProps<UMLNodeData>) => {
  const getIcon = () => {
    switch(data.type) {
        case ElementType.OWL_CLASS: return <Database className="w-4 h-4 mr-2 text-purple-600" />;
        case ElementType.OWL_NAMED_INDIVIDUAL: return <User className="w-4 h-4 mr-2 text-pink-600" />;
        case ElementType.OWL_DATATYPE: return <FileType className="w-4 h-4 mr-2 text-slate-600" />;
        default: return <Database className="w-4 h-4 mr-2 text-gray-400" />;
    }
  };

  const getHeaderStyle = () => {
      if (data.type === ElementType.OWL_CLASS) return 'bg-purple-100 text-purple-900 border-purple-200';
      if (data.type === ElementType.OWL_NAMED_INDIVIDUAL) return 'bg-pink-100 text-pink-900 border-pink-200';
      if (data.type === ElementType.OWL_DATATYPE) return 'bg-slate-100 text-slate-900 border-slate-200';
      return 'bg-gray-100 text-gray-900 border-gray-200';
  }

  const borderColor = selected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300';
  
  // Always use Ontology Labels
  const section1Label = 'Data Properties';
  const section2Label = 'Restrictions / Axioms';

  return (
    <div className={`w-64 bg-white rounded-md shadow-sm border ${borderColor} text-xs font-sans overflow-hidden transition-all duration-200`}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-2 !rounded-sm" />
      
      {/* Header */}
      <div className={`px-3 py-2 border-b flex flex-col items-center justify-center ${getHeaderStyle()}`}>
        <div className="flex items-center font-bold">
            {getIcon()}
            <span className="truncate">{data.label}</span>
        </div>
        {data.stereotype && <span className="text-[10px] opacity-75 font-mono">{data.stereotype}</span>}
        {!data.stereotype && <span className="text-[9px] opacity-60 font-mono">IRI: :{data.label}</span>}
      </div>

      {/* Section 1: Data Properties */}
      <div className="px-3 py-2 border-b border-gray-100 min-h-[20px]">
        <div className="text-[9px] text-gray-400 uppercase font-semibold mb-1 tracking-wider">{section1Label}</div>
        {data.attributes && data.attributes.length > 0 ? (
          data.attributes.map((attr) => (
            <div key={attr.id} className="flex items-center py-0.5 text-gray-700">
              <span className="font-semibold mr-1">{attr.name}</span>
              <span className="text-gray-400 mx-1">:</span>
              <span className="text-gray-500 italic text-[10px]">{attr.type}</span>
            </div>
          ))
        ) : (
          <div className="text-gray-300 italic text-[10px]">No properties</div>
        )}
      </div>

      {/* Section 2: Axioms */}
      <div className="px-3 py-2 min-h-[20px]">
        <div className="text-[9px] text-gray-400 uppercase font-semibold mb-1 tracking-wider">{section2Label}</div>
        {data.methods && data.methods.length > 0 ? (
          data.methods.map((method) => (
            <div key={method.id} className="flex items-center py-0.5 text-gray-700">
               <div className="flex flex-col leading-tight">
                   <span className="font-medium text-gray-600">{method.name}</span>
                   <span className="text-[9px] text-gray-400">{method.returnType}</span>
               </div>
            </div>
          ))
        ) : (
          <div className="text-gray-300 italic text-[10px]">No axioms</div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3 !h-2 !rounded-sm" />
    </div>
  );
};

export default memo(UMLNode);
