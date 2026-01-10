import React, { useState } from 'react';
import { Download, Upload, Layers, FilePlus, ChevronDown, Settings, ShieldCheck, Search, Network, GitGraph, ScrollText, Eye, EyeOff, FolderTree, X, Box, Sigma, Calculator } from 'lucide-react';

interface TopBarProps {
    onSaveJSON: () => void;
    onSaveTurtle: () => void;
    onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onNewProject: () => void;
    onOpenSettings: () => void;
    onValidate: () => void;
    onOpenDLQuery: () => void;
    onOpenSWRL: () => void;
    onOpenDLAxioms: () => void;
    onOpenExpressivity: () => void;
    currentView: 'design' | 'code' | 'graph' | 'mindmap' | 'tree' | 'uml';
    onViewChange: (view: 'design' | 'code' | 'graph' | 'mindmap' | 'tree' | 'uml') => void;
    showIndividuals: boolean;
    onToggleIndividuals: () => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
}

const TopBar: React.FC<TopBarProps> = ({ 
    onSaveJSON, 
    onSaveTurtle, 
    onLoad, 
    onNewProject, 
    onOpenSettings, 
    onValidate,
    onOpenDLQuery,
    onOpenSWRL,
    onOpenDLAxioms,
    onOpenExpressivity,
    currentView,
    onViewChange,
    showIndividuals,
    onToggleIndividuals,
    searchTerm,
    onSearchChange
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <div className="h-16 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-6 shadow-md z-20 text-white">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
            <Layers className="text-white w-5 h-5" />
        </div>
        <div>
            <h1 className="font-bold text-lg tracking-tight">Ontology <span className="text-blue-400 font-light">Architect</span></h1>
            <p className="text-[10px] text-slate-400 -mt-1 uppercase tracking-wider">Semantic Modeling Platform</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
         
         {/* Group 1: Views */}
         <div className="hidden md:flex gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700/50">
            <button 
                onClick={() => onViewChange('design')}
                className={`px-3 py-1.5 text-xs font-medium rounded shadow-sm transition-all flex items-center gap-1 ${currentView === 'design' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                title="Canvas Design View"
            >
                <Layers size={12} />
                Design
            </button>
            <button 
                onClick={() => onViewChange('uml')}
                className={`px-3 py-1.5 text-xs font-medium rounded shadow-sm transition-all flex items-center gap-1 ${currentView === 'uml' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                title="UML Class Diagram"
            >
                <Box size={12} />
                UML
            </button>
            <button 
                onClick={() => onViewChange('graph')}
                className={`px-3 py-1.5 text-xs font-medium rounded shadow-sm transition-all flex items-center gap-1 ${currentView === 'graph' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                title="Force Directed Graph"
            >
                <Network size={12} />
                Graph
            </button>
            <button 
                onClick={() => onViewChange('mindmap')}
                className={`px-3 py-1.5 text-xs font-medium rounded shadow-sm transition-all flex items-center gap-1 ${currentView === 'mindmap' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                title="Hierarchy Mindmap"
            >
                <GitGraph size={12} />
                Mindmap
            </button>
            <button 
                onClick={() => onViewChange('tree')}
                className={`px-3 py-1.5 text-xs font-medium rounded shadow-sm transition-all flex items-center gap-1 ${currentView === 'tree' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                title="Tree List"
            >
                <FolderTree size={12} />
                Tree
            </button>
            <button 
                onClick={() => onViewChange('code')}
                className={`px-3 py-1.5 text-xs font-medium rounded shadow-sm transition-all flex items-center gap-1 ${currentView === 'code' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                title="Code Editor"
            >
                <Network size={12} />
                Code
            </button>
         </div>

         <div className="h-6 w-px bg-slate-700 mx-1"></div>

         {/* Group 2: Visibility */}
         <button 
            onClick={onToggleIndividuals}
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${showIndividuals ? 'text-pink-400 hover:text-pink-300' : 'text-slate-500 hover:text-slate-400'}`}
            title={showIndividuals ? "Hide Individuals" : "Show Individuals"}
         >
            {showIndividuals ? <Eye size={16} /> : <EyeOff size={16} />}
         </button>

         <div className="h-6 w-px bg-slate-700 mx-1"></div>

         {/* Group 3: Ontology Tools */}
         <div className="flex items-center gap-3">
             <button 
                onClick={onValidate}
                className="flex items-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                title="Validate Ontology"
             >
                <ShieldCheck size={16} />
                <span className="hidden xl:inline">Validate</span>
             </button>

             <button 
                onClick={onOpenExpressivity}
                className="flex items-center gap-2 text-sm font-medium text-pink-400 hover:text-pink-300 transition-colors"
                title="Calculate DL Expressivity"
             >
                <Calculator size={16} />
                <span className="hidden xl:inline">Calc</span>
             </button>

             <button 
                onClick={onOpenDLQuery}
                className="flex items-center gap-2 text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors"
                title="DL Query"
             >
                <Search size={16} />
                <span className="hidden xl:inline">Query</span>
             </button>

             <button 
                onClick={onOpenSWRL}
                className="flex items-center gap-2 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
                title="SWRL Rules"
             >
                <ScrollText size={16} />
                <span className="hidden xl:inline">Rules</span>
             </button>

             <button 
                onClick={onOpenDLAxioms}
                className="flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                title="Description Logic Axioms"
             >
                <Sigma size={16} />
                <span className="hidden xl:inline">Axioms</span>
             </button>
         </div>

         <div className="h-6 w-px bg-slate-700 mx-1"></div>

         {/* Group 4: Project Actions */}
         <div className="flex items-center gap-3">
             <button 
                onClick={onNewProject}
                className="flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                title="New Project"
             >
                <FilePlus size={16} />
             </button>

             <label className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer" title="Import File">
                <Upload size={16} />
                <input type="file" className="hidden" accept=".json,.ttl,.rdf,.nt,.owl,.ofn,.xml" onChange={onLoad} />
             </label>

             {/* Export Dropdown */}
             <div className="relative">
                 <button 
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors focus:outline-none"
                    title="Export Project"
                 >
                    <Download size={16} />
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
         </div>

         <div className="h-6 w-px bg-slate-700 mx-1"></div>

         {/* Group 5: Search & Settings */}
         <div className="relative group hidden lg:block">
             <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                 <Search size={14} className="text-slate-500 group-focus-within:text-blue-400 transition-colors" />
             </div>
             <input 
                type="text" 
                placeholder="Find item..." 
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-md pl-8 pr-8 py-1.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 w-32 focus:w-48 transition-all"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
             />
             {searchTerm && (
                 <button 
                    onClick={() => onSearchChange('')}
                    className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-500 hover:text-white"
                 >
                     <X size={12} />
                 </button>
             )}
         </div>

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