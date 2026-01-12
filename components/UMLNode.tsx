
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { Database, User, FileType, ArrowRightLeft, Tag, Info } from 'lucide-react';

const UMLNode = ({ id, data, selected }: NodeProps<UMLNodeData>) => {
  const getIcon = () => {
    switch(data.type) {
        case ElementType.OWL_CLASS: return <Database className="w-3.5 h-3.5 text-white/90" />;
        case ElementType.OWL_OBJECT_PROPERTY: return <ArrowRightLeft className="w-3.5 h-3.5 text-white/90" />;
        case ElementType.OWL_DATA_PROPERTY: return <Tag className="w-3.5 h-3.5 text-white/90" />;
        case ElementType.OWL_NAMED_INDIVIDUAL: return <User className="w-3.5 h-3.5 text-white/90" />;
        case ElementType.OWL_DATATYPE: return <FileType className="w-3.5 h-3.5 text-white/90" />;
        default: return <Database className="w-3.5 h-3.5 text-white/90" />;
    }
  };

  const getTooltipText = () => {
      switch(data.type) {
          case ElementType.OWL_CLASS: return "Class";
          case ElementType.OWL_OBJECT_PROPERTY: return "Object Property";
          case ElementType.OWL_DATA_PROPERTY: return "Data Property";
          case ElementType.OWL_NAMED_INDIVIDUAL: return "Individual";
          case ElementType.OWL_DATATYPE: return "Datatype";
          default: return "";
      }
  };

  const getGradient = () => {
      switch(data.type) {
          case ElementType.OWL_CLASS: return 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-500';
          case ElementType.OWL_OBJECT_PROPERTY: return 'bg-gradient-to-r from-blue-600 to-cyan-600 border-blue-500';
          case ElementType.OWL_DATA_PROPERTY: return 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-500';
          // Updated to Teal/Cyan gradient
          case ElementType.OWL_NAMED_INDIVIDUAL: return 'bg-gradient-to-r from-teal-600 to-cyan-600 border-teal-500';
          case ElementType.OWL_DATATYPE: return 'bg-gradient-to-r from-amber-600 to-orange-600 border-amber-500';
          default: return 'bg-slate-700 border-slate-600';
      }
  }

  // Visual state for selection and search match
  const containerClasses = `
    uml-node group w-64 rounded-lg text-xs font-sans transition-all duration-300 ease-in-out
    ${selected 
        ? 'ring-2 ring-white/50 shadow-[0_0_20px_rgba(0,0,0,0.5)] translate-y-[-2px]' 
        : data.isSearchMatch
            ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] scale-105 z-10'
            : 'shadow-lg hover:shadow-2xl hover:translate-y-[-2px]'
    }
    bg-slate-900 border border-slate-700 overflow-hidden
  `;

  // Dynamic Labels based on type
  let section1Label = 'Data Properties';
  let section2Label = 'Axioms';
  
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
    <div 
        className={containerClasses}
        tabIndex={0} 
        data-id={id} 
        role="button" 
        aria-label={`${data.type.replace('owl_', '')}: ${data.label}`}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-slate-400 !w-2 !h-2 !-top-1 opacity-0 group-hover:opacity-100 transition-opacity" 
      />
      
      {/* Header */}
      <div className={`relative px-3 py-2 flex flex-col justify-center ${getGradient()}`}>
        
        {/* Type Badge */}
        <div className="absolute top-1 right-2 text-[9px] uppercase tracking-wider text-white/60 font-bold">
            {getTooltipText()}
        </div>

        <div className="flex items-center gap-2 mb-0.5">
            {getIcon()}
            <span className="font-bold text-white text-sm truncate drop-shadow-md">{data.label}</span>
        </div>
        
        <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/60 font-mono truncate max-w-[80%]" title={data.iri}>{displayIRI}</span>
            {data.stereotype && <span className="text-[9px] text-white/80 italic">{`«${data.stereotype}»`}</span>}
        </div>
      </div>

      {/* Annotations Section */}
      {hasAnnotations && (
        <div className="px-3 py-2 border-b border-slate-800 bg-slate-800/30">
            {data.annotations && data.annotations.length > 0 ? (
                data.annotations.slice(0, 2).map(ann => (
                     <div key={ann.id} className="flex gap-1.5 text-[10px] items-baseline mb-0.5 last:mb-0">
                        <span className="text-slate-500 font-mono shrink-0 select-none">{ann.property.split(':').pop()}:</span>
                        <span className="text-slate-300 italic truncate">{ann.value.replace(/"/g, '')}</span>
                     </div>
                ))
            ) : (
                <div className="text-[10px] text-slate-400 italic line-clamp-2 leading-relaxed">
                    {data.description}
                </div>
            )}
            {(data.annotations?.length || 0) > 2 && <div className="text-[9px] text-slate-600 mt-0.5">+{data.annotations!.length - 2} more</div>}
        </div>
      )}

      {/* Attributes */}
      <div className="px-3 py-2 border-b border-slate-800 bg-slate-900">
        {(data.attributes && data.attributes.length > 0) ? (
          data.attributes.slice(0, 5).map((attr) => (
            <div key={attr.id} className="flex items-center py-0.5 text-xs">
               <span className={`font-mono mr-1.5 w-3 text-center ${getVisibilityColor(attr.visibility)}`}>
                   {attr.visibility}
               </span>
              <span className="text-slate-300 font-medium mr-1 truncate">
                  {attr.isDerived && <span className="text-slate-500 mr-0.5">/</span>}
                  {attr.name}
              </span>
              {attr.type && (
                  <span className="text-slate-500 text-[10px] ml-auto font-mono truncate max-w-[40%]">{attr.type}</span>
              )}
            </div>
          ))
        ) : (
          <div className="text-[10px] text-slate-700 italic py-1">No {section1Label.toLowerCase()}</div>
        )}
        {(data.attributes?.length || 0) > 5 && <div className="text-[9px] text-slate-600 mt-1 italic">...and more</div>}
      </div>

      {/* Methods / Axioms */}
      <div className="px-3 py-2 bg-slate-900">
        {(data.methods && data.methods.length > 0) ? (
          data.methods.slice(0, 4).map((method) => (
            <div key={method.id} className="flex flex-col py-1 text-xs border-b border-slate-800/50 last:border-0">
                <div className="flex justify-between items-center text-slate-400">
                    <span className="font-mono text-[9px] uppercase tracking-wide">{method.name.slice(0,3)}</span>
                    <span className={`font-mono ${getVisibilityColor(method.visibility)}`}>{method.visibility}</span>
                </div>
                <span className="text-slate-300 text-[10px] font-mono truncate pl-1 border-l-2 border-slate-700 ml-0.5 mt-0.5">
                    {method.returnType}
                </span>
            </div>
          ))
        ) : (
          <div className="text-[10px] text-slate-700 italic py-1">No {section2Label.toLowerCase()}</div>
        )}
        {(data.methods?.length || 0) > 4 && <div className="text-[9px] text-slate-600 mt-1 italic">...and more</div>}
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!bg-slate-400 !w-2 !h-2 !-bottom-1 opacity-0 group-hover:opacity-100 transition-opacity" 
      />
    </div>
  );
};

export default memo(UMLNode);
