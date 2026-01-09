import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { Database, User, FileType, ArrowRightLeft, Tag } from 'lucide-react';

const UMLNode = ({ data, selected }: NodeProps<UMLNodeData>) => {
  const getIcon = () => {
    switch(data.type) {
        case ElementType.OWL_CLASS: return <Database className="w-4 h-4 mr-2 text-purple-400" />;
        case ElementType.OWL_OBJECT_PROPERTY: return <ArrowRightLeft className="w-4 h-4 mr-2 text-blue-400" />;
        case ElementType.OWL_DATA_PROPERTY: return <Tag className="w-4 h-4 mr-2 text-green-400" />;
        case ElementType.OWL_NAMED_INDIVIDUAL: return <User className="w-4 h-4 mr-2 text-pink-400" />;
        case ElementType.OWL_DATATYPE: return <FileType className="w-4 h-4 mr-2 text-slate-400" />;
        default: return <Database className="w-4 h-4 mr-2 text-slate-500" />;
    }
  };

  const getHeaderStyle = () => {
      if (data.type === ElementType.OWL_CLASS) return 'bg-purple-900/30 text-purple-200 border-purple-800/50';
      if (data.type === ElementType.OWL_OBJECT_PROPERTY) return 'bg-blue-900/30 text-blue-200 border-blue-800/50';
      if (data.type === ElementType.OWL_DATA_PROPERTY) return 'bg-green-900/30 text-green-200 border-green-800/50';
      if (data.type === ElementType.OWL_NAMED_INDIVIDUAL) return 'bg-pink-900/30 text-pink-200 border-pink-800/50';
      if (data.type === ElementType.OWL_DATATYPE) return 'bg-slate-700/50 text-slate-200 border-slate-600';
      return 'bg-slate-800 text-slate-200 border-slate-700';
  }

  // Visual state for selection
  const containerClasses = `
    group w-64 bg-slate-800 rounded-md text-xs font-sans overflow-hidden transition-all duration-300
    ${selected 
        ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] ring-1 ring-blue-500' 
        : 'border-slate-600 shadow-lg hover:border-slate-500 hover:shadow-xl'
    }
    border
  `;

  // Dynamic Labels based on type
  let section1Label = 'Data Properties';
  let section2Label = 'Restrictions / Axioms';
  
  if (data.type === ElementType.OWL_OBJECT_PROPERTY || data.type === ElementType.OWL_DATA_PROPERTY) {
      section1Label = 'Characteristics'; 
      section2Label = 'Property Axioms'; 
  }

  const displayIRI = data.iri ? (data.iri.includes('#') ? `:${data.iri.split('#')[1]}` : data.iri) : `:${data.label}`;
  const hasAnnotations = (data.annotations && data.annotations.length > 0) || data.description;

  const getVisibilityColor = (v: string) => {
      switch(v) {
          case '+': return 'text-green-400';
          case '-': return 'text-red-400';
          case '#': return 'text-amber-400';
          case '~': return 'text-blue-400';
          default: return 'text-slate-500';
      }
  };

  return (
    <div className={containerClasses}>
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-slate-500 !w-3 !h-2 !rounded-sm !border-none group-hover:!bg-blue-400 transition-colors duration-200" 
      />
      
      {/* Header */}
      <div className={`px-3 py-2 border-b flex flex-col items-center justify-center backdrop-blur-sm ${getHeaderStyle()}`}>
        <div className="flex items-center font-bold">
            {getIcon()}
            <span className="truncate">{data.label}</span>
        </div>
        {data.stereotype && <span className="text-[10px] opacity-75 font-mono text-current">{data.stereotype}</span>}
        <span className="text-[9px] opacity-60 font-mono text-current mt-0.5 truncate max-w-full" title={data.iri}>{displayIRI}</span>
      </div>

      {/* Annotations Section */}
      {hasAnnotations && (
        <div className="px-3 py-1.5 border-b border-slate-700 bg-slate-900/30">
            {data.annotations && data.annotations.length > 0 ? (
                data.annotations.map(ann => (
                     <div key={ann.id} className="flex gap-1 text-[10px] items-start mb-0.5 last:mb-0">
                        <span className="text-slate-500 font-mono shrink-0">{ann.property}:</span>
                        <span className="text-slate-300 italic truncate">{ann.value}</span>
                        {ann.language && <span className="text-slate-600 text-[8px] bg-slate-800 px-1 rounded">{ann.language}</span>}
                     </div>
                ))
            ) : (
                <div className="text-[10px] text-slate-400 italic">
                    {data.description}
                </div>
            )}
        </div>
      )}

      {/* Section 1: Attributes */}
      <div className="px-3 py-2 border-b border-slate-700 min-h-[20px] bg-slate-800/50">
        <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1 tracking-wider">{section1Label}</div>
        {data.attributes && data.attributes.length > 0 ? (
          data.attributes.map((attr) => (
            <div key={attr.id} className="flex items-center py-0.5 text-slate-300">
               {/* Visibility Symbol */}
               <span className={`font-mono mr-1.5 w-2 text-center ${getVisibilityColor(attr.visibility)}`}>
                   {attr.visibility}
               </span>
              <span className="font-semibold mr-1">
                  {attr.isDerived && <span className="text-slate-500 mr-0.5">/</span>}
                  {attr.name}
              </span>
              {attr.type && (
                  <>
                    <span className="text-slate-500 mx-1">:</span>
                    <span className="text-slate-400 italic text-[10px]">{attr.type}</span>
                  </>
              )}
            </div>
          ))
        ) : (
          <div className="text-slate-600 italic text-[10px]">Empty</div>
        )}
      </div>

      {/* Section 2: Axioms */}
      <div className="px-3 py-2 min-h-[20px] bg-slate-800/50">
        <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1 tracking-wider">{section2Label}</div>
        {data.methods && data.methods.length > 0 ? (
          data.methods.map((method) => (
            <div key={method.id} className="flex items-center py-0.5 text-slate-300">
               <div className="flex flex-col leading-tight w-full">
                   <div className="flex justify-between items-center">
                        <div className="flex items-center">
                             {/* Visibility Symbol */}
                            <span className={`font-mono mr-1.5 w-2 text-center text-[10px] ${getVisibilityColor(method.visibility)}`}>
                                {method.visibility}
                            </span>
                            <span className="font-medium text-slate-300">{method.name}</span>
                        </div>
                        {method.isOrdered && <span className="text-[8px] px-1 bg-slate-700 rounded text-slate-400 ml-2">{`{ordered}`}</span>}
                   </div>
                   <span className="text-[9px] text-slate-500 break-words pl-4">{method.returnType}</span>
               </div>
            </div>
          ))
        ) : (
          <div className="text-slate-600 italic text-[10px]">No axioms</div>
        )}
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!bg-slate-500 !w-3 !h-2 !rounded-sm !border-none group-hover:!bg-blue-400 transition-colors duration-200" 
      />
    </div>
  );
};

export default memo(UMLNode);