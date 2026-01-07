import React from 'react';
import { Database, User, FileType } from 'lucide-react';
import { ElementType } from '../types';

const Sidebar = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string, elementType: ElementType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/elementType', elementType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-64 bg-white border-l border-gray-200 flex flex-col h-full z-10 shadow-lg">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Toolbox</h2>
      </div>
      
      <div className="p-4 space-y-6 overflow-y-auto flex-1">
        
        {/* OWL Section */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase">OWL 2 Elements</h3>
          <div className="space-y-2">
            <div 
              className="flex items-center p-3 bg-white border border-gray-200 rounded cursor-grab hover:bg-purple-50 hover:border-purple-200 transition-colors shadow-sm"
              onDragStart={(event) => onDragStart(event, 'umlNode', ElementType.OWL_CLASS)}
              draggable
            >
              <Database className="w-5 h-5 text-purple-500 mr-3" />
              <div className="text-sm font-medium text-gray-700">OWL Class</div>
            </div>

            <div 
              className="flex items-center p-3 bg-white border border-gray-200 rounded cursor-grab hover:bg-pink-50 hover:border-pink-200 transition-colors shadow-sm"
              onDragStart={(event) => onDragStart(event, 'umlNode', ElementType.OWL_NAMED_INDIVIDUAL)}
              draggable
            >
              <User className="w-5 h-5 text-pink-500 mr-3" />
              <div className="text-sm font-medium text-gray-700">Named Individual</div>
            </div>

            <div 
              className="flex items-center p-3 bg-white border border-gray-200 rounded cursor-grab hover:bg-slate-50 hover:border-slate-200 transition-colors shadow-sm"
              onDragStart={(event) => onDragStart(event, 'umlNode', ElementType.OWL_DATATYPE)}
              draggable
            >
              <FileType className="w-5 h-5 text-slate-500 mr-3" />
              <div className="text-sm font-medium text-gray-700">Datatype</div>
            </div>
          </div>
        </div>

         <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 leading-relaxed">
                Drag elements onto the canvas. Use the handles to connect them with relations (Object Properties).
            </p>
         </div>

      </div>
    </aside>
  );
};

export default Sidebar;
