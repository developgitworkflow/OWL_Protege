
import React, { useState, useEffect } from 'react';
import { X, ScrollText, Plus, Trash2, Save, AlertCircle, ArrowRight, Check, Code, Sparkles, Loader2, ShieldCheck, AlertTriangle, Lightbulb, GitBranch, Calculator, Users, Filter, Zap, Wand2 } from 'lucide-react';
import { ProjectData, SWRLRule, ElementType, UMLNodeData } from '../types';
import { Node, Edge } from 'reactflow';
import { generateSWRLRule, suggestSWRLRules } from '../services/geminiService';

interface SWRLModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectData: ProjectData;
  onUpdateProjectData: (data: ProjectData) => void;
  nodes?: Node<UMLNodeData>[]; // Optional for context
  edges?: Edge[];
}

interface VerificationResult {
    status: 'success' | 'warning' | 'error';
    message: string;
    issues: string[];
}

const SWRL_EXAMPLES = [
    { label: "Adult Classification", rule: "Person(?p) ^ hasAge(?p, ?age) ^ swrlb:greaterThan(?age, 17) -> Adult(?p)", desc: "Classifies a person as an Adult if age > 17." },
    { label: "Uncle Definition", rule: "hasParent(?x, ?y) ^ hasBrother(?y, ?z) -> hasUncle(?x, ?z)", desc: "Infers uncle relationship via parent's brother." },
    { label: "High Value Customer", rule: "Customer(?c) ^ totalPurchases(?c, ?t) ^ swrlb:greaterThan(?t, 1000) -> HighValue(?c)", desc: "Classifies customers based on purchase threshold." },
    { label: "Sibling Relation", rule: "hasParent(?x, ?p) ^ hasParent(?y, ?p) -> Sibling(?x, ?y)", desc: "Infers sibling relationship if sharing a parent." },
    { label: "Free Shipping", rule: "Order(?o) ^ totalWeight(?o, ?w) ^ swrlb:lessThan(?w, 10) -> FreeShipping(?o)", desc: "Business rule based on weight limit." }
];

const COMMON_PATTERNS = [
    { 
        label: "Composition", 
        icon: GitBranch, 
        rule: "hasParent(?x, ?y) ^ hasParent(?y, ?z) -> hasGrandparent(?x, ?z)", 
        desc: "Chain two relations to infer a third (A->B->C implies A->C)." 
    },
    { 
        label: "Prop Transfer", 
        icon: ArrowRight, 
        rule: "owns(?x, ?y) ^ hasPart(?y, ?z) -> owns(?x, ?z)", 
        desc: "Transfer a property across another relation (e.g., owning the whole implies owning the parts)." 
    },
    { 
        label: "Classification", 
        icon: Filter, 
        rule: "Person(?p) ^ age(?p, ?a) ^ swrlb:greaterThan(?a, 65) -> Senior(?p)", 
        desc: "Classify individuals into a new Class based on data values." 
    },
    { 
        label: "Identity Logic", 
        icon: Users, 
        rule: "hasSSN(?x, ?s) ^ hasSSN(?y, ?s) -> sameAs(?x, ?y)", 
        desc: "Infer that two individuals are the same if they share a unique key." 
    },
    { 
        label: "Calculation", 
        icon: Calculator, 
        rule: "hasPrice(?x, ?p) ^ swrlb:multiply(?t, ?p, 0.2) -> hasTax(?x, ?t)", 
        desc: "Derive new values using mathematical built-ins." 
    }
];

const SWRLModal: React.FC<SWRLModalProps> = ({ isOpen, onClose, projectData, onUpdateProjectData, nodes = [], edges = [] }) => {
  const [rules, setRules] = useState<SWRLRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  
  // Edit State
  const [editName, setEditName] = useState('');
  const [editExpression, setEditExpression] = useState('');
  const [editComment, setEditComment] = useState('');
  const [naturalLanguage, setNaturalLanguage] = useState('');
  
  // AI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{ label: string, rule: string, desc: string }[]>([]);
  
  const [error, setError] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

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
      setAiSuggestions([]); // Clear previous suggestions
      setError(null);
      setVerificationResult(null);
  };

  const loadExample = (ex: { label: string, rule: string, desc: string }) => {
      setEditExpression(ex.rule);
      setEditComment(ex.desc);
      if (!editName || editName.startsWith('NewRule')) {
          setEditName(ex.label.replace(/\s+/g, ''));
      }
      setVerificationResult(null);
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
      setVerificationResult(null);
  };

  const insertSymbol = (sym: string) => {
      setEditExpression(prev => prev + ' ' + sym + ' ');
  };

  const getOntologyContext = () => {
      // Build Context String from Nodes
      const classes = nodes.filter(n => n.data.type === ElementType.OWL_CLASS).map(n => n.data.label).join(', ');
      const properties = nodes
          .filter(n => n.data.type === ElementType.OWL_OBJECT_PROPERTY || n.data.type === ElementType.OWL_DATA_PROPERTY)
          .map(n => n.data.label).join(', ');
      // Also get attributes that serve as data properties
      const attributes = nodes.flatMap(n => n.data.attributes?.map(a => a.name) || []).join(', ');
      
      return `Classes: [${classes}]. Properties: [${properties}, ${attributes}]`;
  };

  const handleGenerateRule = async () => {
      if (!naturalLanguage.trim()) return;
      
      setIsGenerating(true);
      const context = getOntologyContext();
      
      const generatedRule = await generateSWRLRule(naturalLanguage, context);
      
      if (generatedRule) {
          setEditExpression(generatedRule);
          if (!editComment) setEditComment(`Generated from: "${naturalLanguage}"`);
          setError(null);
          setVerificationResult(null);
      } else {
          setError("Could not generate rule. Please try a different description.");
      }
      
      setIsGenerating(false);
  };

  const handleSuggestRules = async () => {
      setIsSuggesting(true);
      const context = getOntologyContext();
      
      const suggestions = await suggestSWRLRules(context);
      
      if (suggestions && suggestions.length > 0) {
          setAiSuggestions(suggestions);
      } else {
          setError("Could not infer any rules from the current ontology.");
      }
      
      setIsSuggesting(false);
  };

  const handleVerifyRule = () => {
      const issues: string[] = [];
      
      // 1. Syntax Check
      if (!editExpression.includes('->') && !editExpression.includes('→')) {
          setVerificationResult({ status: 'error', message: "Syntax Error", issues: ["Missing implication arrow '->'"] });
          return;
      }

      const parts = editExpression.split(/->|→/);
      const body = parts[0];
      const head = parts[1];

      // Regex to capture Predicate(args)
      const atomRegex = /([a-zA-Z0-9_:-]+)\s*\(([^)]+)\)/g;
      
      const getAtoms = (str: string) => {
          const atoms: { pred: string, args: string[] }[] = [];
          let match;
          while ((match = atomRegex.exec(str)) !== null) {
              atoms.push({ pred: match[1], args: match[2].split(',').map(s => s.trim()) });
          }
          return atoms;
      };

      const bodyAtoms = getAtoms(body);
      const headAtoms = getAtoms(head);
      
      if (bodyAtoms.length === 0 && body.trim().length > 0) issues.push("Warning: Could not parse Body atoms. Check syntax.");
      if (headAtoms.length === 0 && head.trim().length > 0) issues.push("Warning: Could not parse Head atoms. Check syntax.");

      // 2. Vocabulary Check
      const allAtoms = [...bodyAtoms, ...headAtoms];
      const builtIns = ['swrlb:', 'swrl:'];

      allAtoms.forEach(atom => {
          const isBuiltIn = builtIns.some(p => atom.pred.startsWith(p));
          if (isBuiltIn) return;

          // Check if predicate exists in nodes
          // We search by label (e.g. Person) or IRI fragment or Attribute Name (Data Props on Classes)
          const node = nodes.find(n => {
              // Direct Match
              if (n.data.label === atom.pred) return true;
              // Safe check for IRI matching with correct operator precedence
              if (n.data.iri === atom.pred) return true;
              if (n.data.iri && (n.data.iri.endsWith(`:${atom.pred}`) || n.data.iri.endsWith(`#${atom.pred}`))) return true;
              
              // Attribute Match (e.g. Class Person has attribute 'hasAge')
              // Only if atom has 2 args (Property)
              if (atom.args.length === 2 && n.data.attributes?.some(a => a.name === atom.pred)) return true;
              
              return false;
          });

          // Check Attributes in isolation if not found as Node
          const isAttribute = !node && nodes.some(n => n.data.attributes?.some(a => a.name === atom.pred));

          if (!node && !isAttribute) {
              issues.push(`Entity '${atom.pred}' not found in ontology.`);
          } else if (node) {
              // Type Check
              if (atom.args.length === 1) {
                  // Class Atom: Expects Class
                  if (node.data.type !== ElementType.OWL_CLASS) {
                      issues.push(`Entity '${atom.pred}' is used as a Class (1 arg), but defined as ${node.data.type.replace('owl_', '')}.`);
                  }
              } else if (atom.args.length === 2) {
                  // Property Atom: Expects Property
                  if (node.data.type !== ElementType.OWL_OBJECT_PROPERTY && node.data.type !== ElementType.OWL_DATA_PROPERTY) {
                      // It might be valid if it's a class with an attribute of this name, but we found the Class Node first?
                      // If 'node' matched because of label 'Person', but 'pred' was 'Person' used with 2 args...
                      // Wait, if pred is 'hasAge' and 'hasAge' is an attribute of Person, `node` found might be Person if names collide?
                      // Unlikely. But if `node` found is the Property Node, check type.
                      issues.push(`Entity '${atom.pred}' is used as a Property (2 args), but defined as ${node.data.type.replace('owl_', '')}.`);
                  }
              }
          }
      });

      // 3. DL-Safety Check (Variables in Head must appear in Body)
      const getVars = (atoms: { args: string[] }[]) => {
          const vars = new Set<string>();
          atoms.forEach(a => a.args.forEach(arg => {
              if (arg.startsWith('?')) vars.add(arg);
          }));
          return vars;
      };

      const bodyVars = getVars(bodyAtoms);
      const headVars = getVars(headAtoms);

      headVars.forEach(v => {
          if (!bodyVars.has(v)) {
              issues.push(`Safety Violation: Variable '${v}' used in Head must also appear in Body (DL-Safe Rule).`);
          }
      });

      if (issues.length > 0) {
          setVerificationResult({ status: 'warning', message: "Verification found potential issues:", issues });
      } else {
          setVerificationResult({ status: 'success', message: "Rule is syntactically valid and compliant with ontology.", issues: [] });
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-5xl bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-700 flex flex-col h-[85vh] overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200">
        
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
                                <div className="flex-1 flex justify-end gap-2">
                                    <button 
                                        onClick={handleVerifyRule}
                                        className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 rounded text-sm font-medium transition-colors"
                                    >
                                        <ShieldCheck size={16} />
                                        Verify
                                    </button>
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
                                <div className="space-y-3">
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
                                    
                                    {/* Auto-Discover Button */}
                                    <div className="pl-8 pt-1">
                                        <button 
                                            onClick={handleSuggestRules}
                                            disabled={isSuggesting}
                                            className="text-xs flex items-center gap-2 text-purple-400 hover:text-purple-300 hover:bg-purple-900/20 px-2 py-1 rounded transition-colors disabled:opacity-50"
                                        >
                                            {isSuggesting ? <Loader2 className="animate-spin" size={12} /> : <Wand2 size={12} />}
                                            Auto-Discover Rules from Ontology
                                        </button>
                                    </div>

                                    {/* AI Suggestions Display */}
                                    {aiSuggestions.length > 0 && (
                                        <div className="mt-3 pl-8 grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-top-2">
                                            {aiSuggestions.map((sugg, i) => (
                                                <button 
                                                    key={i}
                                                    onClick={() => loadExample(sugg)}
                                                    className="flex flex-col gap-1 p-2 bg-slate-950/50 border border-purple-900/30 hover:border-purple-500/50 rounded text-left transition-colors group"
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs font-bold text-purple-300 group-hover:text-purple-200">{sugg.label}</span>
                                                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">AI Suggestion</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">{sugg.desc}</div>
                                                    <div className="text-[10px] font-mono text-slate-500 group-hover:text-slate-300 truncate w-full">{sugg.rule}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
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
                                    onChange={(e) => { setEditExpression(e.target.value); setVerificationResult(null); setError(null); }}
                                    placeholder="Person(?p) ^ hasAge(?p, ?age) ^ swrlb:greaterThan(?age, 18) -> Adult(?p)"
                                />
                                {error && (
                                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 p-2 rounded border border-red-900/50">
                                        <AlertCircle size={14} />
                                        {error}
                                    </div>
                                )}
                                
                                {/* Verification Report */}
                                {verificationResult && (
                                    <div className={`mt-2 rounded-lg p-3 border ${
                                        verificationResult.status === 'success' 
                                        ? 'bg-green-950/20 border-green-900/50 text-green-300' 
                                        : 'bg-amber-950/20 border-amber-900/50 text-amber-300'
                                    }`}>
                                        <div className="flex items-center gap-2 mb-1 font-bold text-xs">
                                            {verificationResult.status === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
                                            {verificationResult.message}
                                        </div>
                                        {verificationResult.issues.length > 0 && (
                                            <ul className="list-disc list-inside text-xs opacity-90 space-y-0.5 ml-1">
                                                {verificationResult.issues.map((iss, i) => (
                                                    <li key={i}>{iss}</li>
                                                ))}
                                            </ul>
                                        )}
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

                            {/* Quick Patterns Section */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                                    <Zap size={12} /> Quick Patterns
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                    {COMMON_PATTERNS.map((pat, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => loadExample(pat)}
                                            className="flex flex-col items-center justify-center gap-2 p-3 bg-slate-800 border border-slate-700 rounded-lg hover:border-blue-500 hover:bg-slate-700 hover:shadow-lg transition-all group h-full"
                                            title={pat.desc}
                                        >
                                            <pat.icon size={20} className="text-slate-400 group-hover:text-blue-400 transition-colors" />
                                            <span className="text-[10px] font-bold text-slate-300 group-hover:text-white text-center leading-tight">
                                                {pat.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-800">
                                    <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Cheat Sheet</h4>
                                    <ul className="text-xs text-slate-400 space-y-1 font-mono">
                                        <li><span className="text-blue-400">Class Atom:</span> Person(?x)</li>
                                        <li><span className="text-blue-400">Property Atom:</span> hasParent(?x, ?y)</li>
                                        <li><span className="text-blue-400">Built-in:</span> swrlb:greaterThan(?age, 18)</li>
                                        <li><span className="text-blue-400">Implication:</span> Body -&gt; Head</li>
                                    </ul>
                                </div>

                                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-800">
                                    <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                                        <Lightbulb size={12} /> Templates
                                    </h4>
                                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                                        {SWRL_EXAMPLES.map((ex, i) => (
                                            <button 
                                                key={i} 
                                                onClick={() => loadExample(ex)}
                                                className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700/50 group transition-colors border border-transparent hover:border-slate-700"
                                            >
                                                <div className="text-xs font-bold text-slate-300 group-hover:text-blue-300">{ex.label}</div>
                                                <div className="text-[10px] text-slate-500 truncate font-mono">{ex.rule}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
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
