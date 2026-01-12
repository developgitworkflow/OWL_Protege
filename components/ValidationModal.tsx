
import React from 'react';
import { X, AlertTriangle, CheckCircle, Info, ShieldAlert, ShieldCheck, Layers, List } from 'lucide-react';
import { ValidationResult, ValidationIssue } from '../services/validatorService';

interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ValidationResult | null;
  onNavigate: (view: string, id: string) => void;
}

const ValidationModal: React.FC<ValidationModalProps> = ({ isOpen, onClose, result, onNavigate }) => {
  if (!isOpen || !result) return null;

  const errorCount = result.issues.filter(i => i.severity === 'error').length;
  const warningCount = result.issues.filter(i => i.severity === 'warning').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-700 flex flex-col max-h-[85vh] overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${result.isValid ? 'border-green-900/50 bg-green-950/20' : 'border-red-900/50 bg-red-950/20'}`}>
          <div className="flex items-center gap-3">
            {result.isValid ? (
                <div className="p-2 bg-green-900/30 rounded-full border border-green-800 text-green-400">
                    <ShieldCheck size={24} />
                </div>
            ) : (
                <div className="p-2 bg-red-900/30 rounded-full border border-red-800 text-red-400">
                    <ShieldAlert size={24} />
                </div>
            )}
            <div>
                <h2 className={`text-lg font-bold ${result.isValid ? 'text-green-400' : 'text-red-400'}`}>
                    {result.isValid ? 'Ontology Consistent' : 'Inconsistencies Detected'}
                </h2>
                <p className="text-xs text-slate-400">
                    Reasoning complete. {errorCount} Errors, {warningCount} Warnings.
                </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-2 rounded-full transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900">
            {result.issues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle className="w-16 h-16 text-green-500 mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-slate-200">No Issues Found</h3>
                    <p className="text-slate-500 max-w-sm mt-2">
                        The ontology structure appears logically consistent and follows OWL 2 syntax rules.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {result.issues.map((issue) => (
                        <div key={issue.id} className={`flex items-start gap-4 p-4 rounded-lg border ${
                            issue.severity === 'error' ? 'bg-red-950/10 border-red-900/50' : 
                            issue.severity === 'warning' ? 'bg-yellow-950/10 border-yellow-900/50' : 
                            'bg-blue-950/10 border-blue-900/50'
                        }`}>
                            <div className="shrink-0 mt-0.5">
                                {issue.severity === 'error' && <AlertTriangle className="text-red-500 w-5 h-5" />}
                                {issue.severity === 'warning' && <AlertTriangle className="text-yellow-500 w-5 h-5" />}
                                {issue.severity === 'info' && <Info className="text-blue-500 w-5 h-5" />}
                            </div>
                            <div>
                                <h4 className={`text-sm font-bold mb-1 ${
                                    issue.severity === 'error' ? 'text-red-400' : 
                                    issue.severity === 'warning' ? 'text-yellow-400' : 
                                    'text-blue-400'
                                }`}>
                                    {issue.title}
                                </h4>
                                <p className="text-sm text-slate-300 leading-relaxed">
                                    {issue.message}
                                </p>
                                {issue.elementId && (
                                    <div className="mt-3 flex gap-2">
                                        <button 
                                            onClick={() => { onNavigate('design', issue.elementId!); onClose(); }}
                                            className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-slate-300 transition-colors"
                                        >
                                            <Layers size={12} /> Graph
                                        </button>
                                        <button 
                                            onClick={() => { onNavigate('entities', issue.elementId!); onClose(); }}
                                            className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-slate-300 transition-colors"
                                        >
                                            <List size={12} /> Catalog
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
        
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex justify-end">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-sm font-medium border border-slate-700 transition-colors"
            >
                Close Report
            </button>
        </div>
      </div>
    </div>
  );
};

export default ValidationModal;
