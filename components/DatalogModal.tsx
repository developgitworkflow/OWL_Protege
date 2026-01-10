
import React, { useMemo, useState } from 'react';
import { X, FileCode, Copy, Download, AlertTriangle, Check, Terminal } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData } from '../types';
import { generateDatalog } from '../services/datalogMapper';

interface DatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node<UMLNodeData>[];
  edges: Edge[];
}

const DatalogModal: React.FC<DatalogModalProps> = ({ isOpen, onClose, nodes, edges }) => {
  const [copied, setCopied] = useState(false);

  const datalogCode = useMemo(() => {
      if (!isOpen) return '';
      return generateDatalog(nodes, edges);
  }, [nodes, edges, isOpen]);

  const handleCopy = () => {
      navigator.clipboard.writeText(datalogCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
      const blob = new Blob([datalogCode], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ontology.dl';
      link.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-4xl bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-700 flex flex-col h-[80vh] overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-emerald-900/30 rounded-lg border border-emerald-800 text-emerald-400">
                 <Terminal size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-100">Datalog Export</h2>
                <p className="text-xs text-slate-400">OWL 2 RL to Logic Programming Translation</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-2 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            
            {/* Main Code Area */}
            <div className="flex-1 flex flex-col bg-slate-950 p-6 overflow-hidden">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Generated Program (.dl)</span>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleCopy} 
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-300 transition-colors"
                        >
                            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                        <button 
                            onClick={handleDownload}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition-colors"
                        >
                            <Download size={12} /> Download
                        </button>
                    </div>
                </div>
                <textarea 
                    className="flex-1 w-full bg-slate-900 border border-slate-800 rounded-lg p-4 font-mono text-xs text-emerald-100/90 focus:outline-none resize-none leading-relaxed"
                    value={datalogCode}
                    readOnly
                    spellCheck={false}
                />
            </div>

            {/* Sidebar Info */}
            <div className="w-72 border-l border-slate-800 bg-slate-900 flex flex-col p-5 overflow-y-auto">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    Logic Profile
                </h3>
                
                <div className="space-y-4">
                    <div className="p-3 bg-emerald-950/20 border border-emerald-900/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1 text-emerald-400 font-bold text-xs">
                            <FileCode size={14} /> OWL 2 RL
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                            This translation targets the <strong>OWL 2 RL</strong> profile, which is designed for scalable reasoning using rule-based engines.
                        </p>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold text-slate-500 mb-2">Supported Features</h4>
                        <ul className="text-[10px] text-slate-400 space-y-1.5 list-disc list-inside">
                            <li>SubClassOf & SubPropertyOf</li>
                            <li>Domain & Range</li>
                            <li>Transitive, Symmetric Properties</li>
                            <li>InverseOf</li>
                            <li>Property Chains</li>
                            <li>DisjointWith (as constraints)</li>
                            <li>Intersection (in SubClass position)</li>
                        </ul>
                    </div>

                    <div className="p-3 bg-amber-950/20 border border-amber-900/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1 text-amber-400 font-bold text-xs">
                            <AlertTriangle size={14} /> Limitations
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                            Standard Datalog does not support <strong>existential quantification</strong> in the rule head (e.g., <code>A SubClassOf p some B</code>). 
                            <br/><br/>
                            These axioms are commented out in the output or require a Datalog+/- engine (like Vadalog).
                        </p>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default DatalogModal;
