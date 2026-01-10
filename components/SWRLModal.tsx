import React, { useState, useEffect } from 'react';
import { X, ScrollText, Plus, Trash2, Save, AlertCircle, ArrowRight, Check, Code, Sparkles, Loader2 } from 'lucide-react';
import { ProjectData, SWRLRule, ElementType, UMLNodeData } from '../types';
import { Node, Edge } from 'reactflow';
import { generateSWRLRule } from '../services/geminiService';

interface SWRLModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectData: ProjectData;
  onUpdateProjectData: (data: ProjectData) => void;
  nodes?: Node<UMLNodeData>[]; // Optional for context
  edges?: Edge[];
}

const SWRLModal: React.FC<SWRLModalProps> = ({ isOpen, onClose, projectData, onUpdateProjectData, nodes = [], edges = [] }) => {
  const [rules, setRules] = useState<SWRLRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  
  // Edit State
  const [editName, setEditName] = useState('');
  const [editExpression, setEditExpression] = useState('');
  const [editComment, setEditComment] = useState('');
  const [naturalLanguage, setNaturalLanguage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectData.rules) {
        setRules(projectData.rules);
        if (projectData.rules.length > 0 && !selectedRuleId) {
            selectRule(projectData.rules[0]);
        }
    }
  }, [projectData.rules, isOpen]);

  const selectRule = (rule: SWRLRule) => {
      setSelectedRuleId(rule.id);
      setEditName(rule.name);
      setEditExpression(rule.expression);
      setEditComment(rule.comment || '');
      setNaturalLanguage(''); // Reset generator input
      setError(null);
  };

  const handleAddRule = () => {
      const newRule: SWRLRule = {
          id: `rule-${Date.now()}`,
          name: `NewRule${rules.length + 1}`,
          expression: 'Person(?p) -> Human(?p)',
          comment: ''
      };
      const updatedRules = [...rules, newRule];
      setRules(updatedRules);
      onUpdateProjectData({ ...projectData, rules: updatedRules });
      selectRule(newRule);
  };

  const handleDeleteRule = (id: string) => {
      const updatedRules = rules.filter(r => r.id !== id);
      setRules(updatedRules);
      onUpdateProjectData({ ...projectData, rules: updatedRules });
      if (selectedRuleId === id) {
          if (updatedRules.length > 0) selectRule(updatedRules[0]);
          else setSelectedRuleId(null);
      }
  };

  const handleSaveCurrent = () => {
      if (!selectedRuleId) return;
      
      // Basic Validation
      if (!editExpression.includes('->') && !editExpression.includes('→')) {
          setError("Rule must contain an implication symbol '->'");
          return;
      }

      const updatedRules = rules.map(r => 
          r.id === selectedRuleId 
          ? { ...r, name: editName, expression: editExpression, comment: editComment }
          : r
      );
      setRules(updatedRules);
      onUpdateProjectData({ ...projectData, rules: updatedRules });
      setError(null);
  };

  const insertSymbol = (sym: string) => {
      setEditExpression(prev => prev + ' ' + sym + ' ');
  };

  const handleGenerateRule = async () => {
      if (!naturalLanguage.trim()) return;
      
      setIsGenerating(true);
      
      // Build Context String from Nodes
      const classes = nodes.filter(n => n.data.type === ElementType.OWL_CLASS).map(n => n.data.label).join(', ');
      const properties = nodes
          .filter(n => n.data.type === ElementType.OWL_OBJECT_PROPERTY || n.data.type === ElementType.OWL_DATA_PROPERTY)
          .map(n => n.data.label).join(', ');
      // Also get attributes that serve as data properties
      const attributes = nodes.flatMap(n => n.data.attributes?.map(a => a.name) || []).join(', ');
      
      const context = `Classes: [${classes}]. Properties: [${properties}, ${attributes}]`;
      
      const generatedRule = await generateSWRLRule(naturalLanguage, context);
      
      if (generatedRule) {
          setEditExpression(generatedRule);
          if (!editComment) setEditComment(`Generated from: "${naturalLanguage}"`);
      } else {
          setError("Could not generate rule. Please try a different description.");
      }
      
      setIsGenerating(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-5xl bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-700 flex flex-col h-[80vh] overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-amber-900/30 rounded-lg border border-amber-800 text-amber-400">
                 <ScrollText size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-100">SWRL Rules</h2>
                <p className="text-xs text-slate-400">Semantic Web Rule Language Editor</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-2 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            
            {/* Sidebar List */}
            <div className="w-64 border-r border-slate-800 bg-slate-950/50 flex flex-col">
                <div className="p-3 border-b border-slate-800 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rules List</span>
                    <button 
                        onClick={handleAddRule}
                        className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded shadow transition-colors"
                        title="Add Rule"
                    >
                        <Plus size={14} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {rules.length > 0 ? (
                        rules.map(rule => (
                            <button
                                key={rule.id}
                                onClick={() => selectRule(rule)}
                                className={`w-full text-left px-3 py-2.5 rounded-md text-sm border transition-all flex justify-between items-center group ${
                                    selectedRuleId === rule.id 
                                    ? 'bg-blue-900/20 border-blue-800 text-blue-300' 
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                }`}
                            >
                                <span className="truncate font-mono">{rule.name}</span>
                                {selectedRuleId === rule.id && (
                                    <Trash2 
                                        size={14} 
                                        className="text-red-400 opacity-50 hover:opacity-100 transition-opacity"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteRule(rule.id); }}
                                    />
                                )}
                            </button>
                        ))
                    ) : (
                        <div className="text-center py-8 text-slate-600 text-xs italic">
                            No rules defined.
                        </div>
                    )}
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 bg-slate-900 flex flex-col overflow-hidden">
                {selectedRuleId ? (
                    <div className="flex flex-col h-full">
                        {/* Toolbar */}
                        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                            <div className="flex items-center gap-4 w-full">
                                <div className="flex flex-col gap-1 w-1/3">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Rule Name</label>
                                    <input 
                                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:border-blue-500 outline-none font-mono"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                    />
                                </div>
                                <div className="flex-1 flex justify-end">
                                    <button 
                                        onClick={handleSaveCurrent}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium shadow-sm transition-colors"
                                    >
                                        <Save size={16} />
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Editor Inputs */}
                        <div className="p-6 flex-1 overflow-y-auto space-y-6">
                            
                            {/* AI Generation Section */}
                            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 rounded-lg border border-slate-700/50 relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                <div className="flex items-start gap-3">
                                    <Sparkles className="text-blue-400 mt-1 shrink-0" size={18} />
                                    <div className="flex-1 space-y-2">
                                        <label className="text-xs font-bold text-blue-300 uppercase tracking-wider">Natural Language to SWRL</label>
                                        <div className="flex gap-2">
                                            <input 
                                                className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none placeholder-slate-600"
                                                placeholder="e.g. If a Person has age > 18, then they are an Adult."
                                                value={naturalLanguage}
                                                onChange={(e) => setNaturalLanguage(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleGenerateRule()}
                                            />
                                            <button 
                                                onClick={handleGenerateRule}
                                                disabled={isGenerating || !naturalLanguage.trim()}
                                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg"
                                            >
                                                {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                                Generate
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Code size={14} /> Rule Expression
                                    </label>
                                    <div className="flex gap-1">
                                        <button onClick={() => insertSymbol('?')} className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 hover:bg-slate-700 font-mono" title="Variable">?</button>
                                        <button onClick={() => insertSymbol('^')} className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 hover:bg-slate-700 font-mono" title="And">^</button>
                                        <button onClick={() => insertSymbol('->')} className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 hover:bg-slate-700 font-mono" title="Imply">-&gt;</button>
                                    </div>
                                </div>
                                <textarea 
                                    className="w-full h-32 bg-slate-950 border border-slate-700 rounded-lg p-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono leading-relaxed resize-none shadow-inner"
                                    value={editExpression}
                                    onChange={(e) => setEditExpression(e.target.value)}
                                    placeholder="Person(?p) ^ hasAge(?p, ?age) ^ swrlb:greaterThan(?age, 18) -> Adult(?p)"
                                />
                                {error && (
                                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 p-2 rounded border border-red-900/50">
                                        <AlertCircle size={14} />
                                        {error}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comment / Description</label>
                                <textarea 
                                    className="w-full h-24 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 focus:outline-none focus:border-blue-500 font-sans resize-none"
                                    value={editComment}
                                    onChange={(e) => setEditComment(e.target.value)}
                                    placeholder="Explain what this rule implies..."
                                />
                            </div>

                            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-800">
                                <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Cheat Sheet</h4>
                                <ul className="text-xs text-slate-400 space-y-1 font-mono">
                                    <li><span className="text-blue-400">Class Atom:</span> Person(?x)</li>
                                    <li><span className="text-blue-400">Property Atom:</span> hasParent(?x, ?y)</li>
                                    <li><span className="text-blue-400">Built-in:</span> swrlb:greaterThan(?age, 18)</li>
                                    <li><span className="text-blue-400">Implication:</span> Body -&gt; Head</li>
                                </ul>
                            </div>

                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600">
                        <ScrollText size={48} className="opacity-20 mb-4" />
                        <p className="text-sm">Select a rule to edit or create a new one.</p>
                    </div>
                )}
            </div>

        </div>
      </div>
    </div>
  );
};

export default SWRLModal;