import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { Box, Braces, Code, Database } from 'lucide-react';

const UMLNode = ({ data, selected }: NodeProps<UMLNodeData>) => {
  const isOWL = data.type === ElementType.OWL_CLASS || data.type === ElementType.OWL_DATATYPE;
  
  const getIcon = () => {
    switch(data.type) {
        case ElementType.INTERFACE: return <Code className="w-4 h-4 mr-2" />;
        case ElementType.OWL_CLASS: return <Database className="w-4 h-4 mr-2 text-purple-600" />;
        default: return <Box className="w-4 h-4 mr-2 text-blue-600" />;
    }
  };

  const borderColor = selected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300';
  const headerColor = isOWL ? 'bg-purple-100 text-purple-900' : (data.type === ElementType.INTERFACE ? 'bg-green-50 text-green-900' : 'bg-yellow-50 text-yellow-900');

  return (
    <div className={`w-64 bg-white rounded-md shadow-sm border ${borderColor} text-xs font-sans overflow-hidden transition-all duration-200`}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-2 !rounded-sm" />
      
      {/* Header */}
      <div className={`px-3 py-2 border-b border-gray-200 flex items-center justify-center font-bold ${headerColor}`}>
        {getIcon()}
        <span className="truncate">{data.type === ElementType.INTERFACE ? `<<Interface>> ${data.label}` : data.label}</span>
      </div>

      {/* Attributes */}
      <div className="px-3 py-2 border-b border-gray-100 min-h-[20px]">
        {data.attributes && data.attributes.length > 0 ? (
          data.attributes.map((attr) => (
            <div key={attr.id} className="flex items-center py-0.5 text-gray-700">
              <span className="w-4 font-mono text-gray-500">{attr.visibility}</span>
              <span className="font-semibold mr-1">{attr.name}:</span>
              <span className="text-gray-500 italic">{attr.type}</span>
            </div>
          ))
        ) : (
          <div className="text-gray-300 italic text-[10px]">No attributes</div>
        )}
      </div>

      {/* Methods */}
      <div className="px-3 py-2 min-h-[20px]">
        {data.methods && data.methods.length > 0 ? (
          data.methods.map((method) => (
            <div key={method.id} className="flex items-center py-0.5 text-gray-700">
              <span className="w-4 font-mono text-gray-500">{method.visibility}</span>
              <span className="font-semibold mr-1">{method.name}():</span>
              <span className="text-gray-500 italic">{method.returnType}</span>
            </div>
          ))
        ) : (
          <div className="text-gray-300 italic text-[10px]">No methods</div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3 !h-2 !rounded-sm" />
    </div>
  );
};

export default memo(UMLNode);
