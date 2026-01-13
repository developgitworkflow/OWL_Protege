
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { Database, User, FileType, ArrowRightLeft, Tag, Code2, Layers, Key } from 'lucide-react';

const UMLNode = ({ id, data, selected }: NodeProps<UMLNodeData>) => {
  const getIcon = () => {
    switch(data.type) {
        case ElementType.OWL_CLASS: return <Database className="w-3 h-3" />;
        case ElementType.OWL_OBJECT_PROPERTY: return <ArrowRightLeft className="w-3 h-3" />;
        case ElementType.OWL_DATA_PROPERTY: return <Tag className="w-3 h-3" />;
        case ElementType.OWL_NAMED_INDIVIDUAL: return <User className="w-3 h-3" />;
        case ElementType.OWL_DATATYPE: return <FileType className="w-3 h-3" />;
        default: return <Database className="w-3 h-3" />;
    }
  };

  const getStereotype = () => {
      if (data.stereotype) return `«${data.stereotype}»`;
      switch(data.type) {
          case ElementType.OWL_CLASS: return '«OWL Class»';
          case ElementType.OWL_OBJECT_PROPERTY: return '«Object Property»';
          case ElementType.OWL_DATA_PROPERTY: return '«Data Property»';
          case ElementType.OWL_NAMED_INDIVIDUAL: return '«Individual»';
          case ElementType.OWL_DATATYPE: return '«Datatype»';
          default: return '';
      }
  };

  const getColors = () => {
      switch(data.type) {
          case ElementType.OWL_CLASS: 
              return { 
                  header: 'bg-gradient-to-b from-purple-100 to-purple-200 dark:from-indigo-900 dark:to-indigo-950', 
                  border: 'border-indigo-600', 
                  text: 'text-indigo-900 dark:text-indigo-100',
                  iconColor: 'text-indigo-600 dark:text-indigo-400'
              };
          case ElementType.OWL_OBJECT_PROPERTY: 
              return { 
                  header: 'bg-gradient-to-b from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-950', 
                  border: 'border-blue-600', 
                  text: 'text-blue-900 dark:text-blue-100',
                  iconColor: 'text-blue-600 dark:text-blue-400'
              };
          case ElementType.OWL_DATA_PROPERTY: 
              return { 
                  header: 'bg-gradient-to-b from-emerald-100 to-emerald-200 dark:from-emerald-900 dark:to-emerald-950', 
                  border: 'border-emerald-600', 
                  text: 'text-emerald-900 dark:text-emerald-100',
                  iconColor: 'text-emerald-600 dark:text-emerald-400'
              };
          case ElementType.OWL_NAMED_INDIVIDUAL: 
              return { 
                  header: 'bg-gradient-to-b from-teal-100 to-teal-200 dark:from-teal-900 dark:to-teal-950', 
                  border: 'border-teal-500', 
                  text: 'text-teal-900 dark:text-teal-100',
                  iconColor: 'text-teal-600 dark:text-teal-400'
              };
          default: 
              return { 
                  header: 'bg-slate-200 dark:bg-slate-800', 
                  border: 'border-slate-500', 
                  text: 'text-slate-800 dark:text-slate-200',
                  iconColor: 'text-slate-500'
              };
      }
  };

  const colors = getColors();

  const containerClasses = `
    uml-node group w-[280px] rounded shadow-sm font-sans transition-all duration-200 ease-in-out
    ${selected 
        ? `ring-2 ring-yellow-400 shadow-xl translate-y-[-2px] z-10` 
        : data.isSearchMatch
            ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] scale-105 z-10'
            : 'shadow-md hover:shadow-lg'
    }
    bg-white dark:bg-slate-900 border ${colors.border}
  `;

  let section1Label = 'Attributes';
  let section2Label = 'Operations';
  
  if (data.type === ElementType.OWL_OBJECT_PROPERTY || data.type === ElementType.OWL_DATA_PROPERTY) {
      section1Label = 'Characteristics'; 
      section2Label = 'Axioms'; 
  } else if (data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
      section1Label = 'Facts';
      section2Label = 'Assertions';
  }

  const handleClasses = "w-2 h-2 !bg-slate-400 dark:!bg-slate-500 border border-white dark:border-slate-900 opacity-0 group-hover:opacity-100 transition-opacity hover:!bg-blue-500 hover:scale-150";

  return (
    <div 
        className={containerClasses}
        tabIndex={0} 
        data-id={id} 
        role="button" 
        aria-label={`${data.type.replace('owl_', '')}: ${data.label}`}
    >
      <Handle type="target" position={Position.Top} id="top" className={`${handleClasses} !-top-1`} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={`${handleClasses} !-bottom-1`} />
      <Handle type="source" position={Position.Right} id="right" className={`${handleClasses} !-right-1`} />
      <Handle type="target" position={Position.Left} id="left" className={`${handleClasses} !-left-1`} />
      
      {/* Header (Enterprise Architect Style) */}
      <div className={`px-2 py-1.5 border-b ${colors.border} ${colors.header} text-center`}>
        <div className={`text-[10px] ${colors.text} opacity-80 italic font-serif`}>
            {getStereotype()}
        </div>
        <div className={`font-bold ${colors.text} text-sm flex justify-center items-center gap-1.5`}>
            <span className={colors.iconColor}>{getIcon()}</span>
            <span className="truncate">{data.label}</span>
        </div>
      </div>

      {/* Attributes Compartment */}
      <div className="px-2 py-1 bg-white dark:bg-slate-950 border-b border-dashed border-slate-300 dark:border-slate-700 min-h-[20px]">
        {(data.attributes && data.attributes.length > 0) ? (
          data.attributes.slice(0, 6).map((attr) => (
            <div key={attr.id} className="flex items-center text-[11px] leading-tight py-0.5 text-slate-700 dark:text-slate-300">
               <span className="font-mono w-4 text-center text-[9px] opacity-60">{attr.visibility}</span>
               <span className="truncate mr-1">{attr.name}</span>
               {attr.type && <span className="text-slate-500 dark:text-slate-500 font-mono text-[9px] ml-auto">: {attr.type}</span>}
            </div>
          ))
        ) : (
            <div className="text-[9px] text-slate-400 dark:text-slate-600 italic py-0.5">
                {section1Label}
            </div>
        )}
      </div>

      {/* Operations/Axioms Compartment */}
      <div className="px-2 py-1 bg-white dark:bg-slate-950 min-h-[20px] rounded-b">
        {(data.methods && data.methods.length > 0) ? (
          data.methods.slice(0, 5).map((method) => (
            <div key={method.id} className="flex items-center text-[11px] leading-tight py-0.5 text-slate-700 dark:text-slate-300 border-b border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                <span className="font-mono w-4 text-center text-[9px] opacity-60">{method.visibility}</span>
                <span className="font-semibold text-[9px] uppercase tracking-wider text-slate-500 mr-1">{method.name}</span>
                <span className="text-slate-600 dark:text-slate-400 font-mono text-[9px] truncate ml-auto max-w-[60%]">
                    {method.returnType}
                </span>
            </div>
          ))
        ) : (
            <div className="text-[9px] text-slate-400 dark:text-slate-600 italic py-0.5">
                {section2Label}
            </div>
        )}
        {(data.methods?.length || 0) > 5 && (
            <div className="text-[9px] text-right text-slate-400 italic">
                + {data.methods!.length - 5} more
            </div>
        )}
      </div>
      
      {/* Footer Info (Base IRI) */}
      {data.iri && (
          <div className="px-2 py-0.5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 text-[8px] text-slate-400 font-mono truncate text-center">
              {data.iri}
          </div>
      )}
    </div>
  );
};

export default memo(UMLNode);
