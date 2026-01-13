
import React, { useMemo, useState } from 'react';
import { X, Copy, Download, BookOpen, Check, Eye, Code, FileText, ToggleLeft, ToggleRight, Settings2 } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ProjectData } from '../types';
import { generateWidocoMarkdown, DocOptions } from '../services/documentationService';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node<UMLNodeData>[];
  edges: Edge[];
  projectData: ProjectData;
}

// Simple Markdown Renderer component to avoid heavy dependencies
const MarkdownPreview: React.FC<{ content: string }> = ({ content }) => {
    // Basic parsing logic for preview purposes
    const renderLines = () => {
        return content.split('\n').map((line, i) => {
            // Headers
            if (line.startsWith('# ')) return <h1 key={i} className="text-3xl font-bold text-white mt-8 mb-4 pb-2 border-b border-slate-700">{line.replace('# ', '')}</h1>;
            if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-blue-300 mt-6 mb-3 flex items-center gap-2"><span className="w-1 h-6 bg-blue-500 rounded-full"></span>{line.replace('## ', '')}</h2>;
            if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-slate-200 mt-4 mb-2">{line.replace('### ', '')}</h3>;
            
            // Blockquotes
            if (line.startsWith('> ')) return <blockquote key={i} className="border-l-4 border-slate-600 pl-4 italic text-slate-400 my-2 bg-slate-800/30 p-2 rounded-r">{line.replace('> ', '')}</blockquote>;
            
            // HR
            if (line.startsWith('---')) return <hr key={i} className="border-slate-800 my-8" />;
            
            // Lists
            if (line.trim().startsWith('- ')) {
                const text = line.trim().replace('- ', '');
                // Handle basic bold/code inside list
                return (
                    <li key={i} className="ml-4 list-disc text-slate-300 mb-1 marker:text-slate-500">
                        <span dangerouslySetInnerHTML={{ __html: parseInline(text) }} />
                    </li>
                );
            }

            // Tables (Basic rendering)
            if (line.startsWith('|')) {
                return <div key={i} className="font-mono text-xs text-slate-400 whitespace-pre overflow-x-auto bg-slate-950 p-2 rounded border border-slate-800 my-2">{line}</div>;
            }
            
            // Code Blocks
            if (line.startsWith('```')) {
                return <div key={i} className="h-0" />; // Skip markers in preview for now or handle block
            }

            // Empty
            if (!line.trim()) return <div key={i} className="h-2" />;

            // Paragraph
            return <p key={i} className="text-slate-300 mb-1 leading-relaxed text-sm" dangerouslySetInnerHTML={{ __html: parseInline(line) }} />;
        });
    };

    const parseInline = (text: string) => {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
            .replace(/`(.*?)`/g, '<code class="bg-slate-800 px-1 py-0.5 rounded text-amber-300 font-mono text-xs">$1</code>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-blue-400 hover:underline">$1</a>')
            .replace(/\*(.*?)\*/g, '<em class="text-slate-400">$1</em>');
    };

    return <div className="markdown-preview p-2">{renderLines()}</div>;
};

const DocumentationModal: React.FC<DocumentationModalProps> = ({ isOpen, onClose, nodes, edges, projectData }) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('preview');
  
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

  const markdown = useMemo(() => {
      if (!isOpen) return '';
      return generateWidocoMarkdown(nodes, edges, projectData, options);
  }, [nodes, edges, projectData, isOpen, options]);

  const handleCopy = () => {
      navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectData.name.replace(/\s+/g, '_')}_docs.md`;
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
                <p className="text-xs text-slate-400">Standard W3C Ontology Documentation</p>
             </div>
          </div>
          
          <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button 
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'preview' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
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
                        <Download size={16} /> Download .md
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-slate-900 overflow-y-auto custom-scrollbar">
                <div className="max-w-4xl mx-auto p-8">
                    {viewMode === 'code' ? (
                        <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300 leading-relaxed bg-slate-950 p-6 rounded-lg border border-slate-800">{markdown}</pre>
                    ) : (
                        <div className="prose prose-invert prose-sm max-w-none">
                            <MarkdownPreview content={markdown} />
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
