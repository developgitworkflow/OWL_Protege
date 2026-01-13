
import React from 'react';
import { Layers, Search, Brain, CheckCircle2, Undo2, Redo2, Settings, PanelLeftClose, PanelLeftOpen, Box, GitBranch, List, Map, Feather, GitGraph, FolderTree, Terminal, Eye, EyeOff, ShieldCheck, Activity, Calculator, ScrollText, Sigma, ChevronRight, GitCommit, FileText, FolderOpen, Database } from 'lucide-react';

interface TopBarProps {
    onOpenSettings: () => void;
    currentView: 'design' | 'code' | 'graph' | 'mindmap' | 'tree' | 'uml' | 'peirce' | 'entities' | 'owlviz' | 'workflow';
    onViewChange: (view: 'design' | 'code' | 'graph' | 'mindmap' | 'tree' | 'uml' | 'peirce' | 'entities' | 'owlviz' | 'workflow') => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    isReasonerActive: boolean;
    onRunReasoner: () => void;
    showInferred: boolean;
    onToggleInferred: () => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onToggleSidebar: () => void;
    isSidebarOpen: boolean;
    showSidebarToggle: boolean;
    
    // Ontology Tools
    showIndividuals: boolean;
    onToggleIndividuals: () => void;
    onValidate: () => void;
    onOpenDLQuery: () => void;
    onOpenSWRL: () => void;
    onOpenDLAxioms: () => void;
    onOpenExpressivity: () => void;
    onOpenDatalog: () => void;
    onOpenMetrics: () => void;
    onOpenVersionControl: () => void;
    onOpenDocs: () => void;
    onImport: () => void;
    onOpenSPARQL: () => void;
    currentBranch: string;
}

const TopBar: React.FC<TopBarProps> = ({ 
    onOpenSettings, 
    currentView,
    onViewChange,
    searchTerm,
    onSearchChange,
    isReasonerActive,
    onRunReasoner,
    showInferred,
    onToggleInferred,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onToggleSidebar,
    isSidebarOpen,
    showSidebarToggle,
    showIndividuals,
    onToggleIndividuals,
    onValidate,
    onOpenDLQuery,
    onOpenSWRL,
    onOpenDLAxioms,
    onOpenExpressivity,
    onOpenDatalog,
    onOpenMetrics,
    onOpenVersionControl,
    onOpenDocs,
    onImport,
    onOpenSPARQL,
    currentBranch
}) => {

  const views = [
      { id: 'workflow', label: 'Workflow', icon: GitBranch },
      { id: 'design', label: 'Design', icon: Layers },
      { id: 'entities', label: 'Catalog', icon: List },
      { id: 'uml', label: 'UML', icon: Box },
      { id: 'owlviz', label: 'Hierarchical', icon: Map },
      { id: 'peirce', label: 'Peirce', icon: Feather },
      { id: 'mindmap', label: 'Mindmap', icon: GitGraph },
      { id: 'tree', label: 'Tree', icon: FolderTree },
      { id: 'code', label: 'Code', icon: Terminal },
  ];

  return (
    <div className="flex flex-col z-20 shadow-xl bg-slate-950 border-b border-slate-800">
        {/* Primary Toolbar */}
        <div className="h-16 flex items-center justify-between px-4 gap-4 bg-slate-900/50 backdrop-blur-md">
        
            {/* Left: Branding & Sidebar */}
            <div className="flex items-center gap-4 shrink-0">
                {showSidebarToggle && (
                    <button 
                        onClick={onToggleSidebar}
                        className="text-slate-400 hover:text-white transition-colors focus:outline-none p-1.5 hover:bg-slate-800 rounded-lg"
                        title={isSidebarOpen ? "Hide Toolbox" : "Show Toolbox"}
                    >
                        {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                    </button>
                )}
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 ring-1 ring-white/10">
                        <Layers className="text-white w-5 h-5" />
                    </div>
                    <div className="hidden md:block">
                        <h1 className="font-bold text-lg tracking-tight leading-none text-slate-100">Ontology <span className="text-blue-400 font-light">Architect</span></h1>
                        <div className="text-[10px] text-slate-500 font-medium tracking-wider uppercase">Visual Modeling Suite</div>
                    </div>
                </div>
            </div>

            {/* Center: Navigation Views */}
            <div className="flex-1 flex justify-center overflow-x-auto no-scrollbar mask-gradient">
                <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 shadow-inner">
                    {views.map(view => (
                        <button 
                            key={view.id}
                            onClick={() => onViewChange(view.id as any)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap focus:outline-none ${
                                currentView === view.id 
                                ? 'bg-slate-800 text-blue-400 shadow-sm ring-1 ring-slate-700' 
                                : 'text-slate-500 hover:text-slate-200 hover:bg-slate-900'
                            }`}
                            title={view.label}
                        >
                            <view.icon size={14} className={currentView === view.id ? "text-blue-400" : "opacity-70"} />
                            <span className="hidden xl:inline">{view.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right: Actions & Tools */}
            <div className="flex items-center gap-3 shrink-0">
                
                {/* Search */}
                <div className="relative hidden lg:block group">
                    <input 
                        className="bg-slate-900 border border-slate-700 rounded-full pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-48 transition-all group-hover:bg-slate-800 placeholder-slate-500"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                </div>

                <div className="h-8 w-px bg-slate-800 mx-1"></div>

                {/* Git Version Control */}
                <button 
                    onClick={onOpenVersionControl}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-lg transition-all text-xs font-bold group"
                    title="Version Control (Git)"
                >
                    <GitCommit size={16} className="text-green-400" />
                    <span className="font-mono text-xs">{currentBranch}</span>
                </button>

                {/* History */}
                <div className="flex bg-slate-900 rounded-lg border border-slate-800 p-0.5">
                    <button 
                        onClick={onUndo} 
                        disabled={!canUndo}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 size={16} />
                    </button>
                    <button 
                        onClick={onRedo} 
                        disabled={!canRedo}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo2 size={16} />
                    </button>
                </div>

                <div className="h-8 w-px bg-slate-800 mx-1"></div>

                {/* Reasoner */}
                <div className="flex items-center gap-2">
                    <button 
                        onClick={onRunReasoner}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border shadow-sm ${
                            isReasonerActive 
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' 
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                        }`}
                        title={isReasonerActive ? "Stop/Reset Reasoner" : "Run HermiT-like Reasoner"}
                    >
                        {isReasonerActive ? <CheckCircle2 size={16} /> : <Brain size={16} />}
                        <span className="hidden sm:inline">{isReasonerActive ? 'Active' : 'Reasoner'}</span>
                    </button>
                    
                    {isReasonerActive && (
                        <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800 p-0.5">
                            <button
                                onClick={() => onToggleInferred()}
                                className={`p-1.5 rounded-md transition-all ${!showInferred ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                title="Show Asserted"
                            >
                                <Layers size={14} />
                            </button>
                            <button
                                onClick={() => onToggleInferred()}
                                className={`p-1.5 rounded-md transition-all ${showInferred ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                title="Show Inferred"
                            >
                                <Brain size={14} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Import */}
                <button
                    onClick={onImport}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full border border-slate-700 transition-all shadow-sm group"
                    title="Import Ontology"
                >
                    <FolderOpen size={18} className="group-hover:text-blue-400 transition-colors" />
                </button>

                {/* Settings */}
                <button 
                    onClick={onOpenSettings}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full border border-slate-700 transition-all shadow-sm"
                    title="Settings"
                >
                    <Settings size={18} />
                </button>
            </div>
        </div>

        {/* Secondary Toolbar (Grouped Tools) */}
        <div className="h-11 bg-slate-950 flex items-center px-4 gap-6 overflow-x-auto no-scrollbar text-xs border-t border-slate-900">
            
            {/* View Group */}
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                    <Eye size={10} /> View
                </span>
                <button 
                    onClick={onToggleIndividuals}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors border ${showIndividuals ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-900 hover:text-slate-300'}`}
                >
                    {showIndividuals ? "Individuals On" : "Individuals Off"}
                </button>
            </div>

            <div className="h-4 w-px bg-slate-800"></div>

            {/* Analysis Group */}
            <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mr-2 flex items-center gap-1">
                    <Activity size={10} /> Analysis
                </span>
                <button onClick={onValidate} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-slate-400 hover:text-emerald-400 hover:bg-slate-900 transition-colors">
                    <ShieldCheck size={14} /> Validate
                </button>
                <button onClick={onOpenMetrics} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-slate-400 hover:text-cyan-400 hover:bg-slate-900 transition-colors">
                    <Activity size={14} /> Metrics
                </button>
                <button onClick={onOpenExpressivity} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-slate-400 hover:text-pink-400 hover:bg-slate-900 transition-colors">
                    <Calculator size={14} /> Complexity
                </button>
                <button onClick={onOpenDocs} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-slate-400 hover:text-blue-400 hover:bg-slate-900 transition-colors">
                    <FileText size={14} /> Docs
                </button>
            </div>

            <div className="h-4 w-px bg-slate-800"></div>

            {/* Logic Group */}
            <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mr-2 flex items-center gap-1">
                    <Terminal size={10} /> Logic
                </span>
                <button onClick={onOpenDLQuery} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-slate-400 hover:text-purple-400 hover:bg-slate-900 transition-colors">
                    <Search size={14} /> Query
                </button>
                <button onClick={onOpenSPARQL} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-slate-400 hover:text-pink-400 hover:bg-slate-900 transition-colors">
                    <Database size={14} /> SPARQL
                </button>
                <button onClick={onOpenSWRL} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-900 transition-colors">
                    <ScrollText size={14} /> SWRL
                </button>
                <button onClick={onOpenDLAxioms} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-slate-400 hover:text-indigo-400 hover:bg-slate-900 transition-colors">
                    <Sigma size={14} /> Axioms
                </button>
                <button onClick={onOpenDatalog} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-slate-400 hover:text-emerald-400 hover:bg-slate-900 transition-colors">
                    <Terminal size={14} /> Datalog
                </button>
            </div>
        </div>
    </div>
  );
};

export default TopBar;
