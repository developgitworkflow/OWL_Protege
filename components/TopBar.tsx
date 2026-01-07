import React from 'react';
import { Download, Upload, Share2, Layers, FilePlus } from 'lucide-react';

interface TopBarProps {
    onSave: () => void;
    onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onNewProject: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onSave, onLoad, onNewProject }) => {
  return (
    <div className="h-16 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-6 shadow-md z-20 text-white">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
            <Layers className="text-white w-5 h-5" />
        </div>
        <div>
            <h1 className="font-bold text-lg tracking-tight">Enterprise Architect <span className="text-blue-400 font-light">Web</span></h1>
            <p className="text-[10px] text-slate-400 -mt-1 uppercase tracking-wider">UML & OWL2 Modeler</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
         <div className="hidden md:flex gap-1 bg-slate-800 p-1 rounded-lg">
            <button className="px-3 py-1.5 text-xs font-medium bg-slate-700 rounded shadow-sm text-white">Design</button>
            <button className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors">Code</button>
         </div>

         <div className="h-6 w-px bg-slate-700 mx-2"></div>
         
         <button 
            onClick={onNewProject}
            className="flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
         >
            <FilePlus size={16} />
            <span className="hidden sm:inline">New</span>
         </button>

         <button 
            onClick={onSave}
            className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
         >
            <Download size={16} />
            <span className="hidden sm:inline">Export</span>
         </button>

         <label className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer">
            <Upload size={16} />
            <span className="hidden sm:inline">Import</span>
            <input type="file" className="hidden" accept=".json" onChange={onLoad} />
         </label>

         <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-bold shadow-lg transition-all transform hover:scale-105">
            Share
         </button>
      </div>
    </div>
  );
};

export default TopBar;
