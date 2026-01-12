
import React from 'react';
import { Database, User, FileType, ArrowRightLeft, Tag, Info } from 'lucide-react';
import { ElementType, UMLNodeData } from '../types';
import { Node } from 'reactflow';

interface SidebarProps {
    selectedNode?: Node<UMLNodeData> | null;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedNode }) => {
  const onDragStart = (event: React.DragEvent, nodeType: string, elementType: ElementType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/elementType', elementType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const ToolboxItem = ({ type, label, icon: Icon, color, desc }: { type: ElementType, label: string, icon: any, color: string, desc: string }) => (
      <div className="relative group">
        <div 
            className="flex items-center p-3 bg-slate-900 border border-slate-800 rounded-lg cursor-grab hover:bg-slate-800 hover:border-slate-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            onDragStart={(event) => onDragStart(event, 'umlNode', type)}
            draggable
        >
            <div className={`p-2 rounded-md bg-slate-950 ${color.replace('text-', 'text-opacity-80 text-')}`}>
                <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="ml-3">
                <div className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{label}</div>
            </div>
        </div>
        
        {/* Tooltip */}
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl text-xs w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            <div className={`font-bold mb-1 ${color}`}>{label}</div>
            <div className="text-slate-400 leading-snug">{desc}</div>
            {/* Arrow */}
            <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-[1px] w-2 h-2 bg-slate-900 border-l border-b border-slate-700 transform rotate-45"></div>
        </div>
      </div>
  );

  const getSelectionIcon = (type: ElementType) => {
      switch(type) {
          case ElementType.OWL_CLASS: return <Database size={16} className="text-purple-400" />;
          // Updated Individual Color
          case ElementType.OWL_NAMED_INDIVIDUAL: return <User size={16} className="text-teal-400" />;
          case ElementType.OWL_OBJECT_PROPERTY: return <ArrowRightLeft size={16} className="text-blue-400" />;
          case ElementType.OWL_DATA_PROPERTY: return <Tag size={16} className="text-green-400" />;
          case ElementType.OWL_DATATYPE: return <FileType size={16} className="text-amber-400" />;
          default: return <Info size={16} className="text-slate-400" />;
      }
  };

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-full z-10 shadow-xl text-slate-200">
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            Toolbox
        </h2>
      </div>
      
      <div className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
        
        {/* OWL Section */}
        <div>
          <h3 className="text-[10px] font-bold text-slate-600 mb-3 uppercase tracking-wider ml-1">Elements</h3>
          <div className="space-y-3">
            <ToolboxItem 
                type={ElementType.OWL_CLASS} 
                label="Class" 
                icon={Database} 
                color="text-purple-400" 
                desc="A set of individuals sharing common characteristics." 
            />

            <ToolboxItem 
                type={ElementType.OWL_OBJECT_PROPERTY} 
                label="Object Property" 
                icon={ArrowRightLeft} 
                color="text-blue-400" 
                desc="A relationship between two individuals." 
            />

            <ToolboxItem 
                type={ElementType.OWL_DATA_PROPERTY} 
                label="Data Property" 
                icon={Tag} 
                color="text-green-400" 
                desc="A relationship between an individual and a literal value." 
            />

            {/* Updated Individual Color */}
            <ToolboxItem 
                type={ElementType.OWL_NAMED_INDIVIDUAL} 
                label="Individual" 
                icon={User} 
                color="text-teal-400" 
                desc="A specific instance or object." 
            />

            <ToolboxItem 
                type={ElementType.OWL_DATATYPE} 
                label="Datatype" 
                icon={FileType} 
                color="text-amber-400" 
                desc="A range of data values (integers, strings, etc)." 
            />
          </div>
        </div>

         <div className="pt-6 mt-2 border-t border-slate-800/50">
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800 text-xs text-slate-500">
                <p className="leading-relaxed">
                    <span className="text-slate-400 font-semibold">Tip:</span> Drag elements onto the canvas to start modeling. Connect them by dragging handles.
                </p>
            </div>
         </div>
      </div>

      {/* Active Selection Widget */}
      {selectedNode && (
          <div className="p-4 bg-slate-900 border-t border-slate-800 animate-in slide-in-from-left-5 duration-300 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center justify-between">
                  <span>Selected Element</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center gap-3 shadow-inner">
                  <div className="p-2 bg-slate-900 rounded-md border border-slate-800">
                      {getSelectionIcon(selectedNode.data.type)}
                  </div>
                  <div className="overflow-hidden">
                      <div className="text-sm font-bold text-slate-200 truncate">{selectedNode.data.label}</div>
                      <div className="text-[10px] text-slate-500 truncate">{selectedNode.data.type.replace('owl_', '').replace('_', ' ')}</div>
                  </div>
              </div>
          </div>
      )}
    </aside>
  );
};

export default Sidebar;
