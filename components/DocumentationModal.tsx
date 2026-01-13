
import React, { useMemo, useState } from 'react';
import { X, Copy, Download, BookOpen, Eye, Code, FileText, ToggleLeft, ToggleRight, Settings2, Sigma, Check } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ProjectData } from '../types';
import { generateWidocoMarkdown, generateLatex, DocOptions } from '../services/documentationService';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node<UMLNodeData>[];
  edges: Edge[];
  projectData: ProjectData;
}

const MarkdownPreview: React.FC<{ content: string }> = ({ content }) => {
    return (
        <div className="markdown-preview p-2 whitespace-pre-wrap font-sans text-sm text-slate-300">
            {content.split('\n').map((line, i) => {
                if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold text-white mt-4 mb-2">{line.replace('# ', '')}</h1>;
                if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-blue-300 mt-4 mb-2">{line.replace('## ', '')}</h2>;
                if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-slate-200 mt-2 mb-1">{line.replace('### ', '')}</h3>;
                if (line.startsWith('> ')) return <blockquote key={i} className="border-l-4 border-slate-600 pl-4 italic text-slate-400 my-2">{line.replace('> ', '')}</blockquote>;
                return <p key={i} className="mb-1">{line}</p>;
            })}
        </div>
    );
};

const DocumentationModal: React.FC<DocumentationModalProps> = ({ isOpen, onClose, nodes, edges, projectData }) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('preview');
  const [format, setFormat] = useState<'markdown' | 'latex'>('markdown');
  
  const [options, setOptions] = useState<DocOptions>({
      metadata: true,
      abstract: true,
      crossReference: true,
      classes: true,
      objectProperties: true,
      dataProperties: true,
      individuals: true,
      axioms: true,
      annotations: true,
      serialization: false
  });

  const content = useMemo(() => {
      if (!isOpen) return '';
      if (format === 'latex') return generateLatex(nodes, edges, projectData, options);
      return generateWidocoMarkdown(nodes, edges, projectData, options);
  }, [nodes, edges, projectData, isOpen, options, format]);

  const handleFormatChange = (newFormat: 'markdown' | 'latex') => {
      setFormat(newFormat);
      // Force 'code' view for LaTeX since we can't render it in-browser easily
      if (newFormat === 'latex') {
          setViewMode('code');
      } else {
          setViewMode('preview');
      }
  };

  const handleCopy = () => {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
      const type = format === 'latex' ? 'application/x-latex' : 'text/markdown';
      const ext = format === 'latex' ? 'tex' : 'md';
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectData.name.replace(/\s+/g, '_')}_docs.${ext}`;
      link.click();
  };

  const toggleOption = (key: keyof DocOptions) => {
      setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!isOpen) return null;

  const OptionToggle = ({ label, prop }: { label: string, prop: keyof DocOptions }) => (
      <button onClick={() => toggleOption(prop)} className="flex items-center justify-between w-full p-2 rounded hover:bg-slate-800 transition-colors group">
          <span className="text-sm text-slate-300">{label}</span>
          {options[prop] ? <ToggleRight className="text-blue-500" /> : <ToggleLeft className="text-slate-600" />}
      </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-6xl bg-slate-900 rounded-xl shadow-2xl border border-slate-800 flex flex-col h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-900/30 rounded-lg border border-blue-800 text-blue-400">
                 <BookOpen size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-100">Documentation</h2>
                <p className="text-xs text-slate-400">Generate documentation in Markdown or LaTeX</p>
             </div>
          </div>
          
          <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button 
                onClick={() => setViewMode('preview')}
                disabled={format === 'latex'}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'preview' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'}`}
                title={format === 'latex' ? 'Preview not available for LaTeX' : 'View Rendered'}
              >
                  <Eye size={14} /> Preview
              </button>
              <button 
                onClick={() => setViewMode('code')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'code' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
              >
                  <Code size={14} /> Source
              </button>
          </div>

          <button onClick={onClose} className="text-slate-500 hover:text-white p-2 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            
            {/* Sidebar Settings */}
            <div className="w-72 border-r border-slate-800 bg-slate-950/50 flex flex-col">
                <div className="p-4 border-b border-slate-800">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Settings2 size={12} /> Configuration
                    </h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 block">Format</label>
                        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                            <button 
                                onClick={() => handleFormatChange('markdown')}
                                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-colors ${format === 'markdown' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                <FileText size={12} /> Markdown
                            </button>
                            <button 
                                onClick={() => handleFormatChange('latex')}
                                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-colors ${format === 'latex' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                <Sigma size={12} /> LaTeX
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-slate-800" />

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 mb-2 block">General</label>
                        <OptionToggle label="Metadata" prop="metadata" />
                        <OptionToggle label="Abstract" prop="abstract" />
                    </div>

                    <div className="h-px bg-slate-800" />

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 mb-2 block">Entities</label>
                        <OptionToggle label="Classes" prop="classes" />
                        <OptionToggle label="Object Properties" prop="objectProperties" />
                        <OptionToggle label="Data Properties" prop="dataProperties" />
                        <OptionToggle label="Individuals" prop="individuals" />
                    </div>

                    <div className="h-px bg-slate-800" />

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 mb-2 block">Details</label>
                        <OptionToggle label="Logical Axioms" prop="axioms" />
                        <OptionToggle label="Annotations" prop="annotations" />
                    </div>

                    <div className="h-px bg-slate-800" />

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 mb-2 block">Appendix</label>
                        <OptionToggle label="Cross Reference" prop="crossReference" />
                        <OptionToggle label="Turtle Serialization" prop="serialization" />
                    </div>
                </div>

                <div className="p-4 border-t border-slate-800 space-y-3">
                    <button onClick={handleCopy} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-200 transition-colors">
                        {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                        {copied ? 'Copied' : 'Copy Text'}
                    </button>
                    <button onClick={handleDownload} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
                        <Download size={16} /> Download .{format === 'latex' ? 'tex' : 'md'}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-slate-900 overflow-y-auto custom-scrollbar">
                <div className="max-w-4xl mx-auto p-8">
                    {viewMode === 'code' ? (
                        <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300 leading-relaxed bg-slate-950 p-6 rounded-lg border border-slate-800">{content}</pre>
                    ) : (
                        <div className="prose prose-invert prose-sm max-w-none">
                            <MarkdownPreview content={content} />
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentationModal;
