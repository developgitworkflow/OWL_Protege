import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { Database, User, FileType } from 'lucide-react';

const UMLNode = ({ data, selected }: NodeProps<UMLNodeData>) => {
  const getIcon = () => {
    switch(data.type) {
        case ElementType.OWL_CLASS: return <Database className="w-4 h-4 mr-2 text-purple-400" />;
        case ElementType.OWL_NAMED_INDIVIDUAL: return <User className="w-4 h-4 mr-2 text-pink-400" />;
        case ElementType.OWL_DATATYPE: return <FileType className="w-4 h-4 mr-2 text-slate-400" />;
        default: return <Database className="w-4 h-4 mr-2 text-slate-500" />;
    }
  };

  const getHeaderStyle = () => {
      if (data.type === ElementType.OWL_CLASS) return 'bg-purple-900/30 text-purple-200 border-purple-800/50';
      if (data.type === ElementType.OWL_NAMED_INDIVIDUAL) return 'bg-pink-900/30 text-pink-200 border-pink-800/50';
      if (data.type === ElementType.OWL_DATATYPE) return 'bg-slate-700/50 text-slate-200 border-slate-600';
      return 'bg-slate-800 text-slate-200 border-slate-700';
  }

  const borderColor = selected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-600';
  
  // Always use Ontology Labels
  const section1Label = 'Data Properties';
  const section2Label = 'Restrictions / Axioms';

  return (
    <div className={`w-64 bg-slate-800 rounded-md shadow-lg border ${borderColor} text-xs font-sans overflow-hidden transition-all duration-200`}>
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-3 !h-2 !rounded-sm" />
      
      {/* Header */}
      <div className={`px-3 py-2 border-b flex flex-col items-center justify-center ${getHeaderStyle()}`}>
        <div className="flex items-center font-bold">
            {getIcon()}
            <span className="truncate">{data.label}</span>
        </div>
        {data.stereotype && <span className="text-[10px] opacity-75 font-mono text-current">{data.stereotype}</span>}
        {!data.stereotype && <span className="text-[9px] opacity-60 font-mono text-current">IRI: :{data.label}</span>}
      </div>

      {/* Section 1: Data Properties */}
      <div className="px-3 py-2 border-b border-slate-700 min-h-[20px]">
        <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1 tracking-wider">{section1Label}</div>
        {data.attributes && data.attributes.length > 0 ? (
          data.attributes.map((attr) => (
            <div key={attr.id} className="flex items-center py-0.5 text-slate-300">
              <span className="font-semibold mr-1">{attr.name}</span>
              <span className="text-slate-500 mx-1">:</span>
              <span className="text-slate-400 italic text-[10px]">{attr.type}</span>
            </div>
          ))
        ) : (
          <div className="text-slate-600 italic text-[10px]">No properties</div>
        )}
      </div>

      {/* Section 2: Axioms */}
      <div className="px-3 py-2 min-h-[20px]">
        <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1 tracking-wider">{section2Label}</div>
        {data.methods && data.methods.length > 0 ? (
          data.methods.map((method) => (
            <div key={method.id} className="flex items-center py-0.5 text-slate-300">
               <div className="flex flex-col leading-tight">
                   <span className="font-medium text-slate-300">{method.name}</span>
                   <span className="text-[9px] text-slate-500">{method.returnType}</span>
               </div>
            </div>
          ))
        ) : (
          <div className="text-slate-600 italic text-[10px]">No axioms</div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-3 !h-2 !rounded-sm" />
    </div>
  );
};

export default memo(UMLNode);