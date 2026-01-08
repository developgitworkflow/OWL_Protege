import React, { useState, useRef } from 'react';
import { X, Settings, Download, Upload, Save, Globe } from 'lucide-react';
import { ProjectData } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectData: ProjectData;
  onUpdateProjectData: (data: ProjectData) => void;
  onExportJSON: () => void;
  onExportTurtle: () => void;
  onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  projectData, 
  onUpdateProjectData,
  onExportJSON,
  onExportTurtle,
  onImportJSON
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'export'>('general');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleChange = (field: keyof ProjectData, value: string) => {
    onUpdateProjectData({ ...projectData, [field]: value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-700 flex flex-col max-h-[90vh] overflow-hidden border border-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-slate-100">Project Settings</h2>
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
                    General
                </button>
                <button 
                    onClick={() => setActiveTab('export')}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'export' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                >
                    <Download size={16} />
                    Import / Export
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-900">
                
                {activeTab === 'general' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-md font-medium text-white mb-1">Project Details</h3>
                            <p className="text-xs text-slate-500 mb-4">Configure the basic metadata for your ontology.</p>
                            
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
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Base IRI</label>
                                    <input 
                                        type="text" 
                                        value={projectData.baseIri || 'http://example.org/ontology#'}
                                        onChange={(e) => handleChange('baseIri', e.target.value)}
                                        placeholder="http://example.org/ontology#"
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">The default namespace for entities without an absolute IRI.</p>
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
                                    <p className="text-[10px] text-slate-500 mt-1">The prefix used in the generated Turtle output (e.g., <code>ex:MyClass</code>).</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
                                    <textarea 
                                        rows={3}
                                        value={projectData.description || ''}
                                        onChange={(e) => handleChange('description', e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'export' && (
                    <div className="space-y-8">
                        {/* Export Section */}
                        <div>
                            <h3 className="text-md font-medium text-white mb-3 flex items-center gap-2">
                                <Download size={18} /> Export Data
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={onExportJSON}
                                    className="p-4 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 hover:border-blue-500 transition-all text-left group"
                                >
                                    <div className="font-semibold text-slate-200 group-hover:text-blue-400 mb-1">JSON Project</div>
                                    <p className="text-xs text-slate-500">Full project backup including layout positions and metadata.</p>
                                </button>
                                <button 
                                    onClick={onExportTurtle}
                                    className="p-4 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 hover:border-green-500 transition-all text-left group"
                                >
                                    <div className="font-semibold text-slate-200 group-hover:text-green-400 mb-1">Turtle (RDF/OWL)</div>
                                    <p className="text-xs text-slate-500">Standard semantic web format (.ttl) for use in Protégé, etc.</p>
                                </button>
                            </div>
                        </div>

                        {/* Import Section */}
                        <div>
                            <h3 className="text-md font-medium text-white mb-3 flex items-center gap-2">
                                <Upload size={18} /> Import Data
                            </h3>
                            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 text-center">
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    onChange={onImportJSON}
                                    accept=".json"
                                    className="hidden"
                                />
                                <div className="mb-3">
                                    <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mx-auto text-slate-400">
                                        <Upload size={24} />
                                    </div>
                                </div>
                                <h4 className="text-sm font-medium text-slate-200 mb-1">Import JSON Project</h4>
                                <p className="text-xs text-slate-500 mb-4 max-w-xs mx-auto">
                                    Restore a previously saved project file. This will replace the current canvas.
                                </p>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors"
                                >
                                    Select File
                                </button>
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