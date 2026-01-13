
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { Database, User, ArrowRightLeft, Tag, FileType, Box, Code2, Layers, Network, ArrowRight, Copy, Pencil, Trash2 } from 'lucide-react';

// Extend data type locally to support the injected relations
interface ExtendedNodeData extends UMLNodeData {
    relations?: { id: string; label: string; targetLabel: string; type: string }[];
    onRelationClick?: (id: string) => void;
    onRelationDelete?: (id: string) => void;
}

const ProfessionalNode = ({ data, selected }: NodeProps<ExtendedNodeData>) => {
  
  const getTypeConfig = () => {
    switch(data.type) {
        case ElementType.OWL_CLASS: 
            return { color: 'bg-indigo-500', icon: Database, label: 'Class', gradient: 'from-indigo-500/20 to-indigo-900/10' };
        case ElementType.OWL_NAMED_INDIVIDUAL: 
            return { color: 'bg-teal-500', icon: User, label: 'Individual', gradient: 'from-teal-500/20 to-teal-900/10' };
        case ElementType.OWL_OBJECT_PROPERTY: 
            return { color: 'bg-blue-500', icon: ArrowRightLeft, label: 'Object Property', gradient: 'from-blue-500/20 to-blue-900/10' };
        case ElementType.OWL_DATA_PROPERTY: 
            return { color: 'bg-emerald-500', icon: Tag, label: 'Data Property', gradient: 'from-emerald-500/20 to-emerald-900/10' };
        case ElementType.OWL_DATATYPE: 
            return { color: 'bg-amber-500', icon: FileType, label: 'Datatype', gradient: 'from-amber-500/20 to-amber-900/10' };
        default: 
            return { color: 'bg-slate-500', icon: Box, label: 'Entity', gradient: 'from-slate-500/20 to-slate-900/10' };
    }
  };

  const config = getTypeConfig();
  const Icon = config.icon;

  // Construct a rich tooltip string including description and annotations
  const getTooltipContent = () => {
      let tooltip = `${data.label} (${config.label})\n`;
      if (data.iri) tooltip += `IRI: ${data.iri}\n`;
      if (data.description) tooltip += `\n${data.description}\n`;
      
      if (data.annotations && data.annotations.length > 0) {
          tooltip += '\nAnnotations:\n';
          data.annotations.forEach(ann => {
              // Skip comment if same as description
              if (ann.property === 'rdfs:comment' && ann.value.replace(/"/g, '') === data.description) return;
              tooltip += `• ${ann.property}: ${ann.value.replace(/"/g, '')}\n`;
          });
      }
      return tooltip.trim();
  };

  return (
    <div 
        className={`relative w-[280px] rounded-xl border bg-slate-900/90 backdrop-blur-xl transition-all duration-300 shadow-2xl ${selected ? 'border-white ring-1 ring-white/50 scale-105 z-50' : 'border-slate-700 hover:border-slate-600'}`}
        title={getTooltipContent()}
    >
      
      {/* Invisible Handles for Layout */}
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />

      {/* Header */}
      <div className="p-3 border-b border-slate-700/50 flex items-center gap-3 relative overflow-hidden rounded-t-xl">
        {/* Background Gradient */}
        <div className={`absolute inset-0 bg-gradient-to-r ${config.gradient} opacity-50`} />
        
        <div className={`relative p-2 rounded-lg ${config.color} text-white shadow-lg`}>
            <Icon size={16} />
        </div>
        
        <div className="relative flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 flex items-center gap-1">
                {config.label}
                {data.isPunned && (
                    <span className="ml-auto bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[9px] flex items-center gap-1 border border-amber-500/30" title="Metamodeling (Punning): Used as both Class and Individual">
                        <Copy size={8} /> Meta
                    </span>
                )}
            </div>
            <div className="font-bold text-sm text-white truncate" title={data.label}>
                {data.label}
            </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-3 space-y-3">
        
        {/* Relations Section (Interactive) */}
        {data.relations && data.relations.length > 0 && (
            <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <Network size={10} /> Relations
                </div>
                <div className="space-y-1">
                    {data.relations.slice(0, 5).map((rel, idx) => (
                        <div 
                            key={idx} 
                            className="group flex items-center justify-between p-1.5 rounded bg-slate-800/30 border border-slate-700/30 hover:bg-slate-800 transition-colors cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); data.onRelationClick && data.onRelationClick(rel.id); }}
                        >
                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                <span className={`text-[10px] font-mono px-1.5 rounded-sm shrink-0 ${
                                    rel.type === 'subClassOf' ? 'bg-indigo-500/20 text-indigo-300' :
                                    rel.type === 'type' ? 'bg-teal-500/20 text-teal-300' :
                                    'bg-slate-700 text-slate-400'
                                }`}>
                                    {rel.type === 'subClassOf' ? 'Is-A' : (rel.label || '->')}
                                </span>
                                <ArrowRight size={10} className="text-slate-600 shrink-0" />
                                <span className="text-xs text-slate-300 font-medium truncate" title={rel.targetLabel}>{rel.targetLabel}</span>
                            </div>
                            
                            {/* Actions on Hover */}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    className="p-1 text-slate-500 hover:text-blue-400 hover:bg-slate-700 rounded"
                                    onClick={(e) => { e.stopPropagation(); data.onRelationClick && data.onRelationClick(rel.id); }}
                                    title="Edit Relation"
                                >
                                    <Pencil size={10} />
                                </button>
                                <button 
                                    className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded"
                                    onClick={(e) => { e.stopPropagation(); data.onRelationDelete && data.onRelationDelete(rel.id); }}
                                    title="Delete Relation"
                                >
                                    <Trash2 size={10} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {data.relations.length > 5 && (
                        <div className="text-[9px] text-center text-slate-500 italic py-0.5">
                            + {data.relations.length - 5} more links
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Attributes Section */}
        {data.attributes && data.attributes.length > 0 && (
            <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <Layers size={10} /> Properties
                </div>
                <div className="space-y-1">
                    {data.attributes.slice(0, 5).map(attr => (
                        <div key={attr.id} className="group flex items-center justify-between p-1.5 rounded bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <span className={`text-[10px] font-mono px-1 rounded ${
                                    attr.visibility === '+' ? 'text-emerald-400 bg-emerald-900/20' : 
                                    attr.visibility === '-' ? 'text-red-400 bg-red-900/20' : 
                                    'text-amber-400 bg-amber-900/20'
                                }`}>
                                    {attr.visibility}
                                </span>
                                <span className="text-xs text-slate-300 font-medium truncate">{attr.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono truncate max-w-[80px] text-right">
                                {attr.type}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Methods/Axioms Section */}
        {data.methods && data.methods.length > 0 && (
            <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <Code2 size={10} /> Logic
                </div>
                <div className="space-y-1">
                    {data.methods.slice(0, 3).map(method => (
                        <div key={method.id} className="flex items-center justify-between p-1.5 rounded bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase">{method.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]" title={method.returnType}>
                                {method.returnType}
                            </span>
                        </div>
                    ))}
                    {data.methods.length > 3 && (
                        <div className="text-[9px] text-center text-slate-500 italic py-1">
                            + {data.methods.length - 3} more axioms
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Empty State */}
        {(!data.attributes?.length && !data.methods?.length && !data.relations?.length) && (
            <div className="text-center py-4 text-slate-600 text-xs italic">
                No properties defined.
            </div>
        )}
      </div>

      {/* Footer / IRI */}
      {data.iri && (
          <div className="px-3 py-1.5 bg-slate-950/50 border-t border-slate-800 rounded-b-xl">
              <div className="text-[9px] text-slate-500 font-mono truncate text-center opacity-60 hover:opacity-100 transition-opacity">
                  {data.iri}
              </div>
          </div>
      )}
    </div>
  );
};

export default memo(ProfessionalNode);
