
import React from 'react';
import { Layers, Search, Brain, CheckCircle2, Undo2, Redo2, Settings, PanelLeftClose, PanelLeftOpen, Box, GitBranch, List, Workflow, Map, Feather, GitGraph, FolderTree, Terminal, Eye, EyeOff, ShieldCheck, Activity, Calculator, ScrollText, Sigma } from 'lucide-react';

interface TopBarProps {
    onOpenSettings: () => void;
    currentView: 'design' | 'code' | 'graph' | 'mindmap' | 'tree' | 'uml' | 'peirce' | 'concept' | 'entities' | 'owlviz' | 'workflow';
    onViewChange: (view: 'design' | 'code' | 'graph' | 'mindmap' | 'tree' | 'uml' | 'peirce' | 'concept' | 'entities' | 'owlviz' | 'workflow') => void;
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
    onOpenMetrics
}) => {

  const views = [
      { id: 'workflow', label: 'Workflow', icon: GitBranch },
      { id: 'design', label: 'Design', icon: Layers },
      { id: 'entities', label: 'Catalog', icon: List },
      { id: 'concept', label: 'Concept', icon: Workflow },
      { id: 'uml', label: 'UML', icon: Box },
      { id: 'owlviz', label: 'Map', icon: Map },
      { id: 'peirce', label: 'Peirce', icon: Feather },
      { id: 'mindmap', label: 'Mindmap', icon: GitGraph },
      { id: 'tree', label: 'Tree', icon: FolderTree },
      { id: 'code', label: 'Code', icon: Terminal },
  ];

  return (
    <div className="flex flex-col z-20 shadow-md">
        {/* Primary Toolbar */}
        <div className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 text-white gap-4">
        
        {/* Left: Branding & Sidebar */}
        <div className="flex items-center gap-3 shrink-0">
            {showSidebarToggle && (
                <button 
                    onClick={onToggleSidebar}
                    className="text-slate-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
                    title={isSidebarOpen ? "Hide Toolbox" : "Show Toolbox"}
                >
                    {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                </button>
            )}
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                <Layers className="text-white w-5 h-5" />
            </div>
            <div className="hidden md:block">
                <h1 className="font-bold text-lg tracking-tight leading-none">Ontology <span className="text-blue-400 font-light">Architect</span></h1>
            </div>
        </div>

        {/* Center: Navigation Views */}
        <div className="flex-1 flex justify-center overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
                {views.map(view => (
                    <button 
                        key={view.id}
                        onClick={() => onViewChange(view.id as any)}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-all flex items-center gap-1.5 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 focus:z-10 ${
                            currentView === view.id 
                            ? 'bg-blue-600 text-white shadow-sm' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                        title={view.label}
                    >
                        <view.icon size={12} />
                        <span className="hidden xl:inline">{view.label}</span>
                    </button>
                ))}
            </div>
        </div>

        {/* Right: Actions & Tools */}
        <div className="flex items-center gap-3 shrink-0">
            
            {/* Search */}
            <div className="relative hidden lg:block">
                <input 
                    className="bg-slate-800 border border-slate-700 rounded-full pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-40 transition-all focus:w-60 placeholder-slate-500"
                    placeholder="Search entities..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>

            <div className="h-6 w-px bg-slate-700"></div>

            {/* Undo/Redo */}
            <div className="flex gap-1">
                <button 
                    onClick={onUndo} 
                    disabled={!canUndo}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Undo (Ctrl+Z)"
                >
                    <Undo2 size={18} />
                </button>
                <button 
                    onClick={onRedo} 
                    disabled={!canRedo}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Redo (Ctrl+Y)"
                >
                    <Redo2 size={18} />
                </button>
            </div>

            <div className="h-6 w-px bg-slate-700"></div>

            {/* Reasoner */}
            <div className="flex items-center gap-2">
                <button 
                    onClick={onRunReasoner}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        isReasonerActive 
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 hover:bg-amber-500/30 hover:border-amber-400' 
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                    }`}
                    title={isReasonerActive ? "Stop/Reset Reasoner" : "Run HermiT-like Reasoner"}
                >
                    {isReasonerActive ? <CheckCircle2 size={14} /> : <Brain size={14} />}
                    <span className="hidden sm:inline">{isReasonerActive ? 'Active' : 'Reasoner'}</span>
                </button>
                
                {isReasonerActive && (
                    <div className="flex items-center bg-slate-900 rounded-md border border-slate-700 p-0.5">
                        <button
                            onClick={() => onToggleInferred()}
                            className={`p-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${!showInferred ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                            title="Show Asserted"
                        >
                            <Layers size={12} />
                        </button>
                        <button
                            onClick={() => onToggleInferred()}
                            className={`p-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${showInferred ? 'bg-amber-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                            title="Show Inferred"
                        >
                            <Brain size={12} />
                        </button>
                    </div>
                )}
            </div>

            <div className="h-6 w-px bg-slate-700"></div>

            {/* Settings Main Action */}
            <button 
                onClick={onOpenSettings}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-md text-xs font-bold border border-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Settings, Project & Import/Export"
            >
                <Settings size={14} />
            </button>
        </div>
        </div>

        {/* Secondary Toolbar (Ontology Tools) */}
        <div className="h-10 bg-slate-950 border-b border-slate-800 flex items-center px-4 gap-4 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 border-r border-slate-800 pr-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Visibility</span>
                <button 
                    onClick={onToggleIndividuals}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${showIndividuals ? 'bg-pink-900/20 text-pink-400 border border-pink-900/30' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
                    title={showIndividuals ? "Hide Individuals" : "Show Individuals"}
                >
                    {showIndividuals ? <Eye size={12} /> : <EyeOff size={12} />}
                    Individuals
                </button>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Analysis</span>
                <button onClick={onValidate} className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-400 hover:text-emerald-400 hover:bg-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <ShieldCheck size={12} /> Validate
                </button>
                <button onClick={onOpenMetrics} className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-400 hover:text-cyan-400 hover:bg-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <Activity size={12} /> Metrics
                </button>
                <button onClick={onOpenExpressivity} className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-400 hover:text-pink-400 hover:bg-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <Calculator size={12} /> Complexity
                </button>
            </div>

            <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Logic</span>
                <button onClick={onOpenDLQuery} className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-400 hover:text-purple-400 hover:bg-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <Search size={12} /> DL Query
                </button>
                <button onClick={onOpenSWRL} className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-400 hover:text-amber-400 hover:bg-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <ScrollText size={12} /> SWRL
                </button>
                <button onClick={onOpenDLAxioms} className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-400 hover:text-indigo-400 hover:bg-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <Sigma size={12} /> Axioms
                </button>
                <button onClick={onOpenDatalog} className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-400 hover:text-emerald-400 hover:bg-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <Terminal size={12} /> Datalog
                </button>
            </div>
        </div>
    </div>
  );
};

export default TopBar;
