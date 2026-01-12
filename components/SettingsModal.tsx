
import React, { useState, useRef } from 'react';
import { X, Settings, Download, Upload, Save, Globe, Plus, Trash2, Link as LinkIcon, FilePlus, Wrench, ShieldCheck, Calculator, Search, ScrollText, Sigma, Terminal, Activity, CloudDownload, FileCode, FileType, Database, Braces } from 'lucide-react';
import { ProjectData } from '../types';
import AnnotationManager from './AnnotationManager';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectData: ProjectData;
  onUpdateProjectData: (data: ProjectData) => void;
  onNewProject: () => void;
  onExport: (format: 'json' | 'rdf' | 'turtle' | 'manchester' | 'functional') => void;
  onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenImportUrl: () => void;
  // Tools
  onValidate: () => void;
  onOpenDLQuery: () => void;
  onOpenSWRL: () => void;
  onOpenDLAxioms: () => void;
  onOpenExpressivity: () => void;
  onOpenDatalog: () => void;
  onOpenMetrics: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  projectData, 
  onUpdateProjectData,
  onNewProject,
  onExport,
  onImportJSON,
  onOpenImportUrl,
  onValidate,
  onOpenDLQuery,
  onOpenSWRL,
  onOpenDLAxioms,
  onOpenExpressivity,
  onOpenDatalog,
  onOpenMetrics
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'tools' | 'data'>('general');
  
  // State for new namespace entry
  const [newPrefix, setNewPrefix] = useState('');
  const [newNamespaceIRI, setNewNamespaceIRI] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleChange = (field: keyof ProjectData, value: any) => {
    onUpdateProjectData({ ...projectData, [field]: value });
  };

  const handleAddNamespace = () => {
      if (newPrefix && newNamespaceIRI) {
          const currentNamespaces = projectData.namespaces || {};
          handleChange('namespaces', { ...currentNamespaces, [newPrefix]: newNamespaceIRI });
          setNewPrefix('');
          setNewNamespaceIRI('');
      }
  };

  const handleRemoveNamespace = (prefix: string) => {
      const currentNamespaces = { ...projectData.namespaces };
      delete currentNamespaces[prefix];
      handleChange('namespaces', currentNamespaces);
  };

  const tools = [
      { id: 'validate', label: 'Validate Ontology', icon: ShieldCheck, desc: 'Check for logical inconsistencies and errors.', action: onValidate, color: 'text-emerald-400' },
      { id: 'metrics', label: 'Ontology Metrics', icon: Activity, desc: 'View statistics and structural analysis.', action: onOpenMetrics, color: 'text-cyan-400' },
      { id: 'expressivity', label: 'DL Expressivity', icon: Calculator, desc: 'Calculate the Description Logic complexity profile.', action: onOpenExpressivity, color: 'text-pink-400' },
      { id: 'dlquery', label: 'DL Query', icon: Search, desc: 'Execute Manchester Syntax queries against the reasoner.', action: onOpenDLQuery, color: 'text-purple-400' },
      { id: 'swrl', label: 'SWRL Rules', icon: ScrollText, desc: 'Edit Semantic Web Rule Language definitions.', action: onOpenSWRL, color: 'text-amber-400' },
      { id: 'axioms', label: 'Logical Axioms', icon: Sigma, desc: 'View TBox, RBox, and ABox axioms explicitly.', action: onOpenDLAxioms, color: 'text-indigo-400' },
      { id: 'datalog', label: 'Datalog Export', icon: Terminal, desc: 'Translate ontology to Datalog rules.', action: onOpenDatalog, color: 'text-green-400' },
  ];

  const exportOptions = [
      { id: 'rdf', label: 'RDF/XML', ext: '.owl', desc: 'Standard W3C Exchange Format. Default for Protégé.', icon: FileCode, color: 'text-orange-400' },
      { id: 'turtle', label: 'Turtle', ext: '.ttl', desc: 'Human-readable RDF format. Concise and common.', icon: FileType, color: 'text-green-400' },
      { id: 'manchester', label: 'Manchester', ext: '.omn', desc: 'User-friendly syntax for Description Logics.', icon: FileType, color: 'text-purple-400' },
      { id: 'functional', label: 'Functional', ext: '.ofn', desc: 'OWL 2 Structural Specification Syntax.', icon: Braces, color: 'text-slate-400' },
      { id: 'json', label: 'Project JSON', ext: '.json', desc: 'Full project backup including visual layout.', icon: Database, color: 'text-blue-400' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-4xl bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-700 flex flex-col max-h-[90vh] overflow-hidden border border-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-slate-100">Settings & Tools</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-2 rounded-full transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sidebar + Content Layout */}
        <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Tabs */}
            <div className="w-48 border-r border-slate-800 bg-slate-950/50 p-2 space-y-1">
                <button 
                    onClick={() => setActiveTab('general')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'general' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                >
                    <Globe size={16} />
                    Project
                </button>
                <button 
                    onClick={() => setActiveTab('tools')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'tools' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                >
                    <Wrench size={16} />
                    Ontology Tools
                </button>
                <button 
                    onClick={() => setActiveTab('data')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'data' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                >
                    <Download size={16} />
                    Import / Export
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-900">
                
                {activeTab === 'general' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-md font-medium text-white mb-1">Project Metadata</h3>
                                <p className="text-xs text-slate-500">Configure the basic identity of your ontology.</p>
                            </div>
                            <button 
                                onClick={() => { onNewProject(); onClose(); }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 hover:border-red-500/50 hover:bg-slate-800 text-slate-300 hover:text-red-400 rounded-md text-xs font-medium transition-all"
                            >
                                <FilePlus size={14} /> New Project
                            </button>
                        </div>
                            
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Project Name</label>
                                <input 
                                    type="text" 
                                    value={projectData.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Base Namespace IRI</label>
                                    <input 
                                        type="text" 
                                        value={projectData.baseIri || 'http://example.org/ontology#'}
                                        onChange={(e) => handleChange('baseIri', e.target.value)}
                                        placeholder="http://example.org/ontology#"
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">Default namespace for entities.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Default Prefix</label>
                                    <input 
                                        type="text" 
                                        value={projectData.defaultPrefix || 'ex'}
                                        onChange={(e) => handleChange('defaultPrefix', e.target.value)}
                                        placeholder="ex"
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">Prefix for generated Turtle/Manchester.</p>
                                </div>
                            </div>

                            <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg space-y-3">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                                    <LinkIcon size={12} /> Ontology Identity
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Ontology IRI (rdf:about)</label>
                                    <input 
                                        type="text" 
                                        value={projectData.ontologyIri || projectData.baseIri?.replace(/#$/, '') || ''}
                                        onChange={(e) => handleChange('ontologyIri', e.target.value)}
                                        placeholder="http://example.org/ontology"
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Version IRI (owl:versionIRI)</label>
                                    <input 
                                        type="text" 
                                        value={projectData.versionIri || ''}
                                        onChange={(e) => handleChange('versionIri', e.target.value)}
                                        placeholder="http://example.org/ontology/1.0.0"
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
                                <textarea 
                                    rows={2}
                                    value={projectData.description || ''}
                                    onChange={(e) => handleChange('description', e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                                />
                            </div>

                            {/* Custom Namespaces Section */}
                            <div className="pt-4 border-t border-slate-800">
                                <label className="block text-sm font-medium text-slate-400 mb-2">Additional Namespaces</label>
                                
                                {/* List */}
                                <div className="space-y-2 mb-3">
                                    {Object.entries(projectData.namespaces || {}).map(([prefix, iri]) => (
                                        <div key={prefix} className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-md p-2">
                                            <span className="font-mono text-blue-400 text-xs w-20 truncate">{prefix}:</span>
                                            <span className="font-mono text-slate-400 text-xs flex-1 truncate">&lt;{iri}&gt;</span>
                                            <button 
                                                onClick={() => handleRemoveNamespace(prefix)}
                                                className="text-slate-600 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Add New */}
                                <div className="flex gap-2">
                                    <input 
                                        placeholder="prefix" 
                                        className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                                        value={newPrefix}
                                        onChange={(e) => setNewPrefix(e.target.value)}
                                    />
                                    <input 
                                        placeholder="http://example.org/ns#" 
                                        className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                                        value={newNamespaceIRI}
                                        onChange={(e) => setNewNamespaceIRI(e.target.value)}
                                    />
                                    <button 
                                        onClick={handleAddNamespace}
                                        disabled={!newPrefix || !newNamespaceIRI}
                                        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="pt-2 border-t border-slate-800">
                                <AnnotationManager 
                                    annotations={projectData.annotations} 
                                    onUpdate={(anns) => handleChange('annotations', anns)}
                                    title="Ontology Annotations"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'tools' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-md font-medium text-white mb-1">Reasoning & Analysis</h3>
                            <p className="text-xs text-slate-500 mb-4">Tools for validating, querying, and analyzing your ontology.</p>
                            
                            <div className="grid grid-cols-2 gap-4">
                                {tools.map(tool => (
                                    <button
                                        key={tool.id}
                                        onClick={() => { tool.action(); onClose(); }}
                                        className="flex items-start gap-4 p-4 bg-slate-800 border border-slate-700 rounded-lg hover:border-blue-500/50 hover:bg-slate-800/80 transition-all text-left group"
                                    >
                                        <div className={`p-2 rounded-md bg-slate-900 ${tool.color}`}>
                                            <tool.icon size={20} />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-200 text-sm mb-1 group-hover:text-white">{tool.label}</div>
                                            <p className="text-xs text-slate-500 leading-relaxed">{tool.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="space-y-8">
                        {/* Export Section */}
                        <div>
                            <h3 className="text-md font-medium text-white mb-3 flex items-center gap-2">
                                <Download size={18} /> Export Data
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {exportOptions.map((opt) => (
                                    <button 
                                        key={opt.id}
                                        onClick={() => onExport(opt.id as any)}
                                        className="p-3 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-750 hover:border-blue-500 transition-all text-left group relative overflow-hidden"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <opt.icon size={16} className={opt.color} />
                                                <span className="font-semibold text-slate-200 text-sm">{opt.label}</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{opt.ext}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 leading-snug">{opt.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Import Section */}
                        <div>
                            <h3 className="text-md font-medium text-white mb-3 flex items-center gap-2">
                                <Upload size={18} /> Import Data
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 text-center hover:border-blue-500/30 transition-all">
                                    <input 
                                        type="file" 
                                        ref={fileInputRef}
                                        onChange={onImportJSON}
                                        accept=".json,.ttl,.rdf,.nt,.owl,.ofn,.xml"
                                        className="hidden"
                                    />
                                    <div className="mb-3">
                                        <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center mx-auto text-slate-400">
                                            <Upload size={20} />
                                        </div>
                                    </div>
                                    <h4 className="text-sm font-medium text-slate-200 mb-1">Local File</h4>
                                    <p className="text-[10px] text-slate-500 mb-4 max-w-[150px] mx-auto">
                                        Upload JSON, Turtle, RDF/XML, or OWL files.
                                    </p>
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md transition-colors"
                                    >
                                        Select File
                                    </button>
                                </div>

                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 text-center hover:border-blue-500/30 transition-all">
                                    <div className="mb-3">
                                        <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center mx-auto text-slate-400">
                                            <CloudDownload size={20} />
                                        </div>
                                    </div>
                                    <h4 className="text-sm font-medium text-slate-200 mb-1">From URL</h4>
                                    <p className="text-[10px] text-slate-500 mb-4 max-w-[150px] mx-auto">
                                        Import an ontology directly from a web address.
                                    </p>
                                    <button 
                                        onClick={() => { onOpenImportUrl(); onClose(); }}
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-md transition-colors border border-slate-600"
                                    >
                                        Enter URL
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex justify-end">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium shadow-lg transition-colors flex items-center gap-2"
            >
                <Save size={16} />
                Done
            </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
