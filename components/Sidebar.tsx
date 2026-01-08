import React from 'react';
import { Database, User, FileType, ArrowRightLeft, Tag } from 'lucide-react';
import { ElementType } from '../types';

const Sidebar = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string, elementType: ElementType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/elementType', elementType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full z-10 shadow-lg text-slate-200">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Toolbox</h2>
      </div>
      
      <div className="p-4 space-y-6 overflow-y-auto flex-1">
        
        {/* OWL Section */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 mb-3 uppercase">OWL 2 Entities</h3>
          <div className="space-y-2">
            <div 
              className="flex items-center p-3 bg-slate-800 border border-slate-700 rounded cursor-grab hover:bg-slate-700 transition-colors shadow-sm group"
              onDragStart={(event) => onDragStart(event, 'umlNode', ElementType.OWL_CLASS)}
              draggable
            >
              <Database className="w-5 h-5 text-purple-400 mr-3 group-hover:text-purple-300" />
              <div className="text-sm font-medium text-slate-300 group-hover:text-white">OWL Class</div>
            </div>

            <div 
              className="flex items-center p-3 bg-slate-800 border border-slate-700 rounded cursor-grab hover:bg-slate-700 transition-colors shadow-sm group"
              onDragStart={(event) => onDragStart(event, 'umlNode', ElementType.OWL_OBJECT_PROPERTY)}
              draggable
            >
              <ArrowRightLeft className="w-5 h-5 text-blue-400 mr-3 group-hover:text-blue-300" />
              <div className="text-sm font-medium text-slate-300 group-hover:text-white">Object Property</div>
            </div>

            <div 
              className="flex items-center p-3 bg-slate-800 border border-slate-700 rounded cursor-grab hover:bg-slate-700 transition-colors shadow-sm group"
              onDragStart={(event) => onDragStart(event, 'umlNode', ElementType.OWL_DATA_PROPERTY)}
              draggable
            >
              <Tag className="w-5 h-5 text-green-400 mr-3 group-hover:text-green-300" />
              <div className="text-sm font-medium text-slate-300 group-hover:text-white">Data Property</div>
            </div>

            <div 
              className="flex items-center p-3 bg-slate-800 border border-slate-700 rounded cursor-grab hover:bg-slate-700 transition-colors shadow-sm group"
              onDragStart={(event) => onDragStart(event, 'umlNode', ElementType.OWL_NAMED_INDIVIDUAL)}
              draggable
            >
              <User className="w-5 h-5 text-pink-400 mr-3 group-hover:text-pink-300" />
              <div className="text-sm font-medium text-slate-300 group-hover:text-white">Named Individual</div>
            </div>

            <div 
              className="flex items-center p-3 bg-slate-800 border border-slate-700 rounded cursor-grab hover:bg-slate-700 transition-colors shadow-sm group"
              onDragStart={(event) => onDragStart(event, 'umlNode', ElementType.OWL_DATATYPE)}
              draggable
            >
              <FileType className="w-5 h-5 text-slate-400 mr-3 group-hover:text-slate-300" />
              <div className="text-sm font-medium text-slate-300 group-hover:text-white">Datatype</div>
            </div>
          </div>
        </div>

         <div className="pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500 leading-relaxed">
                Drag elements onto the canvas. 
                <br/><br/>
                Use <strong>Properties</strong> as first-class nodes to define complex property hierarchies (SubPropertyOf) or chains.
            </p>
         </div>

      </div>
    </aside>
  );
};

export default Sidebar;