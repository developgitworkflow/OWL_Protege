
import React, { useMemo, useState } from 'react';
import { X, Copy, Download, BookOpen, Check } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ProjectData } from '../types';
import { generateWidocoMarkdown } from '../services/documentationService';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node<UMLNodeData>[];
  edges: Edge[];
  projectData: ProjectData;
}

const DocumentationModal: React.FC<DocumentationModalProps> = ({ isOpen, onClose, nodes, edges, projectData }) => {
  const [copied, setCopied] = useState(false);

  const markdown = useMemo(() => {
      if (!isOpen) return '';
      return generateWidocoMarkdown(nodes, edges, projectData);
  }, [nodes, edges, projectData, isOpen]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-5xl bg-slate-900 rounded-xl shadow-2xl border border-slate-800 flex flex-col h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-900/30 rounded-lg border border-blue-800 text-blue-400">
                 <BookOpen size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-100">Ontology Documentation</h2>
                <p className="text-xs text-slate-400">Markdown Generator</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-2 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            <div className="w-64 border-r border-slate-800 bg-slate-950/50 p-6 flex flex-col gap-6">
                <div className="space-y-4">
                    <button onClick={handleCopy} className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-200 transition-colors">
                        {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                        {copied ? 'Copied' : 'Copy Markdown'}
                    </button>
                    <button onClick={handleDownload} className="w-full flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
                        <Download size={16} /> Download .md
                    </button>
                </div>
            </div>
            <div className="flex-1 bg-slate-900 overflow-y-auto p-8">
                <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300 leading-relaxed max-w-3xl mx-auto">{markdown}</pre>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentationModal;
