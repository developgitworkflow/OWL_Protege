import React, { useState } from 'react';
import { Download, Upload, Layers, FilePlus, ChevronDown, Settings, ShieldCheck } from 'lucide-react';

interface TopBarProps {
    onSaveJSON: () => void;
    onSaveTurtle: () => void;
    onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onNewProject: () => void;
    onOpenSettings: () => void;
    onValidate: () => void;
    currentView: 'design' | 'code';
    onViewChange: (view: 'design' | 'code') => void;
}

const TopBar: React.FC<TopBarProps> = ({ 
    onSaveJSON, 
    onSaveTurtle, 
    onLoad, 
    onNewProject, 
    onOpenSettings, 
    onValidate,
    currentView,
    onViewChange
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

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
            <button 
                onClick={() => onViewChange('design')}
                className={`px-3 py-1.5 text-xs font-medium rounded shadow-sm transition-all ${currentView === 'design' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
                Design
            </button>
            <button 
                onClick={() => onViewChange('code')}
                className={`px-3 py-1.5 text-xs font-medium rounded shadow-sm transition-all ${currentView === 'code' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
                Code
            </button>
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
            onClick={onValidate}
            className="flex items-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            title="Validate Ontology"
         >
            <ShieldCheck size={16} />
            <span className="hidden sm:inline">Validate</span>
         </button>

         {/* Export Dropdown */}
         <div className="relative">
             <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors focus:outline-none"
             >
                <Download size={16} />
                <span className="hidden sm:inline">Export</span>
                <ChevronDown size={14} className="opacity-50" />
             </button>
             
             {showExportMenu && (
                 <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-md shadow-xl z-50">
                     <button 
                        onClick={() => { onSaveJSON(); setShowExportMenu(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 first:rounded-t-md"
                     >
                        JSON (Project)
                     </button>
                     <button 
                        onClick={() => { onSaveTurtle(); setShowExportMenu(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 last:rounded-b-md"
                     >
                        Turtle (RDF .ttl)
                     </button>
                 </div>
             )}
             
             {showExportMenu && (
                 <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
             )}
         </div>

         <label className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer">
            <Upload size={16} />
            <span className="hidden sm:inline">Import</span>
            <input type="file" className="hidden" accept=".json,.ttl,.rdf,.nt,.owl,.ofn" onChange={onLoad} />
         </label>

         <button 
            onClick={onOpenSettings}
            className="text-slate-300 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
            title="Settings"
         >
            <Settings size={20} />
         </button>

         <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-bold shadow-lg transition-all transform hover:scale-105">
            Share
         </button>
      </div>
    </div>
  );
};

export default TopBar;