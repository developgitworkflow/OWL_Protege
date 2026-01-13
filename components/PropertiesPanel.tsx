
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Node as FlowNode, Edge } from 'reactflow';
import { UMLNodeData, ElementType, Annotation, Method } from '../types';
import { Trash2, Plus, X, Box, ArrowRight, MousePointerClick, ListOrdered, Quote, Link2, GitMerge, GitCommit, Split, Globe, Lock, Shield, Eye, BookOpen, Check, User, AlertOctagon, Tag, ArrowRightLeft, Sparkles, Command, AlertCircle, Layers, Settings, Database, ChevronDown, ChevronRight, List, Network } from 'lucide-react';
import AnnotationManager from './AnnotationManager';
import { validateManchesterSyntax } from '../services/manchesterValidator';

interface PropertiesPanelProps {
  selectedNode: FlowNode<UMLNodeData> | null;
  selectedEdge?: Edge | null;
  allNodes: FlowNode<UMLNodeData>[];
  onUpdateNode: (id: string, data: UMLNodeData) => void;
  onUpdateEdge?: (id: string, label: string) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge?: (id: string) => void;
  onCreateIndividual?: (classId: string, name: string) => void;
  onNavigate: (view: string, id: string) => void;
  onClose: () => void;
}

const XSD_TYPES = [
  'xsd:string', 'xsd:integer', 'xsd:int', 'xsd:boolean', 'xsd:dateTime',
  'xsd:date', 'xsd:time', 'xsd:float', 'xsd:double', 'xsd:decimal',
  'xsd:long', 'xsd:short', 'xsd:byte', 'xsd:nonNegativeInteger',
  'xsd:base64Binary', 'xsd:anyURI', 'xsd:normalizedString', 'xsd:token',
  'xsd:language', 'rdf:PlainLiteral', 'rdf:XMLLiteral'
];

const CHARACTERISTICS = [
    'Functional', 'InverseFunctional', 'Transitive', 'Symmetric', 
    'Asymmetric', 'Reflexive', 'Irreflexive'
];

const VISIBILITY_OPTIONS = [
    { value: '+', label: 'Public', icon: Globe, color: 'text-emerald-400', desc: 'Visible to all' },
    { value: '-', label: 'Private', icon: Lock, color: 'text-red-400', desc: 'Restricted access' },
    { value: '#', label: 'Protected', icon: Shield, color: 'text-amber-400', desc: 'Visible to subclasses' },
    { value: '~', label: 'Package', icon: Box, color: 'text-blue-400', desc: 'Visible in package' },
];

const MANCHESTER_KEYWORDS = [
    'some', 'only', 'value', 'min', 'max', 'exactly', 'that', 'not', 'and', 'or', 'self'
];

// --- Components ---

const AccordionSection: React.FC<{ 
    title: string; 
    icon: React.ReactNode; 
    children: React.ReactNode; 
    defaultOpen?: boolean 
}> = ({ title, icon, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border border-slate-800 rounded-lg bg-slate-900/50 overflow-hidden mb-3">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition-colors text-xs font-bold text-slate-300 uppercase tracking-wider"
            >
                <div className="flex items-center gap-2">
                    {icon} {title}
                </div>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {isOpen && (
                <div className="p-4 border-t border-slate-800 bg-slate-900">
                    {children}
                </div>
            )}
        </div>
    );
};

const VisibilitySelector: React.FC<{ value: string; onChange: (val: string) => void }> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const current = VISIBILITY_OPTIONS.find(o => o.value === value) || VISIBILITY_OPTIONS[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-1.5 rounded-md border border-slate-700 bg-slate-800 hover:border-slate-500 transition-colors ${current.color}`}
                title={`Visibility: ${current.label}`}
            >
                <current.icon size={12} />
            </button>
            
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="py-1">
                        {VISIBILITY_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-700 flex items-center gap-2 transition-colors group"
                            >
                                <opt.icon size={12} className={opt.color} />
                                <div>
                                    <div className="text-slate-200 font-medium">{opt.label}</div>
                                    <div className="text-[9px] text-slate-500">{opt.desc}</div>
                                </div>
                                {value === opt.value && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Smart Axiom Input ---

interface AxiomInputProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    allNodes: FlowNode<UMLNodeData>[];
}

const AxiomInput: React.FC<AxiomInputProps> = ({ value, onChange, placeholder, allNodes }) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [cursorIdx, setCursorIdx] = useState(0);
    const [matchToken, setMatchToken] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Validation State
    const validation = useMemo(() => validateManchesterSyntax(value), [value]);

    const suggestions = useMemo(() => {
        if (!matchToken) return [];
        const term = matchToken.toLowerCase();
        
        const entities = allNodes
            .filter(n => n.data.label.toLowerCase().includes(term))
            .map(n => ({ label: n.data.label, type: n.data.type, isKeyword: false }));
            
        const keywords = MANCHESTER_KEYWORDS
            .filter(k => k.startsWith(term))
            .map(k => ({ label: k, type: 'keyword', isKeyword: true }));
            
        return [...keywords, ...entities].slice(0, 5);
    }, [matchToken, allNodes]);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        const pos = e.target.selectionEnd;
        onChange(val);

        // Detect word before cursor
        const left = val.slice(0, pos);
        const match = left.match(/([a-zA-Z0-9_:]+)$/);
        
        if (match) {
            setMatchToken(match[1]);
            setShowSuggestions(true);
            setCursorIdx(0);
        } else {
            setShowSuggestions(false);
        }
    };

    const insertToken = (token: string) => {
        if (!textareaRef.current) return;
        const pos = textareaRef.current.selectionEnd;
        const val = value;
        const left = val.slice(0, pos);
        const right = val.slice(pos);
        
        // If replacing a token
        const match = left.match(/([a-zA-Z0-9_:]+)$/);
        let newLeft = left;
        if (match && showSuggestions) {
            newLeft = left.slice(0, match.index) + token;
        } else {
            newLeft = left + (left.endsWith(' ') ? '' : ' ') + token;
        }
        
        onChange(newLeft + (right.startsWith(' ') ? '' : ' ') + right);
        setShowSuggestions(false);
        textareaRef.current.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showSuggestions && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursorIdx(i => (i + 1) % suggestions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursorIdx(i => (i - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertToken(suggestions[cursorIdx].label);
            } else if (e.key === 'Escape') {
                setShowSuggestions(false);
            }
        }
    };

    const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
            setShowSuggestions(false);
        }
    };

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getTypeColor = (type: string) => {
        if (type === 'keyword') return 'text-amber-400';
        if (type === ElementType.OWL_CLASS) return 'text-purple-400';
        if (type === ElementType.OWL_NAMED_INDIVIDUAL) return 'text-pink-400';
        return 'text-blue-400';
    };

    return (
        <div className="relative w-full group/input" ref={containerRef}>
            {/* Syntax Toolbar */}
            <div className="flex gap-1 mb-1.5 opacity-0 group-focus-within/input:opacity-100 group-hover/input:opacity-100 transition-opacity absolute bottom-full left-0 bg-slate-800 p-1 rounded-t-md border border-b-0 border-slate-700 pointer-events-none group-focus-within/input:pointer-events-auto z-10">
                {['some', 'only', 'and', 'or', 'not'].map(kw => (
                    <button 
                        key={kw} 
                        onClick={() => insertToken(kw)}
                        className="px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-400 hover:text-amber-300 hover:bg-slate-700 rounded transition-colors"
                    >
                        {kw}
                    </button>
                ))}
            </div>

            <div className="relative">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    rows={2}
                    className={`w-full bg-slate-950 border rounded px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:ring-1 resize-none overflow-hidden min-h-[50px] ${!validation.isValid && value ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-800 focus:border-blue-500/50 focus:ring-blue-500/20'}`}
                    style={{ height: Math.max(50, value.split('\n').length * 20) + 'px' }}
                />
                
                {/* Validation Icon */}
                {!validation.isValid && value && (
                    <div className="absolute right-2 top-2 text-red-500 group/err">
                        <AlertCircle size={12} />
                        <div className="absolute right-0 top-full mt-1 w-48 bg-red-950 border border-red-800 text-red-200 text-[10px] p-2 rounded shadow-xl opacity-0 group-hover/err:opacity-100 pointer-events-none transition-opacity z-20">
                            {validation.error}
                        </div>
                    </div>
                )}
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 w-full z-50 mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-75">
                    {suggestions.map((item, i) => (
                        <button
                            key={i}
                            onClick={() => insertToken(item.label)}
                            className={`w-full text-left px-3 py-1.5 text-[10px] flex items-center justify-between font-mono transition-colors ${i === cursorIdx ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                        >
                            <span>{item.label}</span>
                            <span className={`text-[8px] uppercase tracking-wider ${i === cursorIdx ? 'text-blue-200' : getTypeColor(item.type)}`}>
                                {item.isKeyword ? 'KW' : item.type.replace('owl_', '').replace('named_', '')}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Main Component ---

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedNode, selectedEdge, allNodes, onUpdateNode, onUpdateEdge, onDeleteNode, onDeleteEdge, onCreateIndividual, onNavigate, onClose }) => {
  const [localData, setLocalData] = useState<UMLNodeData | null>(null);
  const [edgeLabel, setEdgeLabel] = useState('');
  const [activeAttrType, setActiveAttrType] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSyntaxHelp, setShowSyntaxHelp] = useState<string | null>(null);
  const [newIndivName, setNewIndivName] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedNode) {
      setLocalData({ ...selectedNode.data });
      setExpandedId(null);
      setShowSyntaxHelp(null);
      setNewIndivName('');
    } else {
      setLocalData(null);
    }

    if (selectedEdge) {
        setEdgeLabel(typeof selectedEdge.label === 'string' ? selectedEdge.label : '');
    } else {
        setEdgeLabel('');
    }
  }, [selectedNode, selectedEdge]);

  // Handle Edge Editing View
  if (selectedEdge) {
      return (
        <div ref={panelRef} className="w-full h-full overflow-y-auto flex flex-col font-sans text-sm text-slate-200 bg-slate-950">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 backdrop-blur-sm sticky top-0 z-20">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-blue-400 font-bold flex items-center gap-1">
                        <ArrowRightLeft size={14} /> Relation
                    </span>
                    <div className="font-bold text-lg text-white truncate max-w-[200px]">Edge Properties</div>
                </div>
                <button 
                    onClick={onClose}
                    className="text-slate-500 hover:text-white hover:bg-slate-800 p-2 rounded-full transition-all"
                    title="Hide Panel"
                >
                    <X size={20} />
                </button>
            </div>

            <div className="p-5 space-y-8 flex-1">
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        Predicate
                    </h3>
                    <div className="space-y-1">
                        <label className="text-xs text-slate-500">Label (IRI)</label>
                        <input
                            type="text"
                            className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-blue-500 rounded p-2 text-xs font-mono text-slate-300 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-slate-700"
                            value={edgeLabel}
                            onChange={(e) => {
                                setEdgeLabel(e.target.value);
                                if (onUpdateEdge) onUpdateEdge(selectedEdge.id, e.target.value);
                            }}
                            placeholder="e.g., rdfs:subClassOf, hasPart"
                        />
                        <p className="text-[10px] text-slate-500">
                            The property linking the source to the target. Use standard prefixes (rdf, rdfs, owl) or custom names.
                        </p>
                    </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-800">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Common Predicates</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {['rdfs:subClassOf', 'rdf:type', 'owl:disjointWith', 'owl:sameAs', 'rdfs:domain', 'rdfs:range'].map(p => (
                            <button
                                key={p}
                                onClick={() => {
                                    setEdgeLabel(p);
                                    if (onUpdateEdge) onUpdateEdge(selectedEdge.id, p);
                                }}
                                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[10px] font-mono text-slate-400 hover:text-blue-300 transition-colors text-left"
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 px-5 pb-5">
                <button 
                    onClick={() => onDeleteEdge && onDeleteEdge(selectedEdge.id)}
                    className="w-full flex items-center justify-center gap-2 bg-red-950/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 rounded-lg p-2 text-xs font-bold transition-colors"
                >
                    <AlertOctagon size={14} />
                    Delete Relation
                </button>
            </div>
        </div>
      );
  }

  // If no node selection (and no edge selection handled above), render null
  if (!selectedNode || !localData) {
    return null;
  }

  // --- Node Editing Logic ---

  const isPropertyNode = localData.type === ElementType.OWL_OBJECT_PROPERTY || localData.type === ElementType.OWL_DATA_PROPERTY;
  const isObjectProperty = localData.type === ElementType.OWL_OBJECT_PROPERTY;
  const isClassNode = localData.type === ElementType.OWL_CLASS;

  const handleChange = (field: keyof UMLNodeData, value: any) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  const handleAnnotationsUpdate = (newAnnotations: Annotation[]) => {
      handleChange('annotations', newAnnotations);
  };

  const toggleExpand = (id: string) => {
      setExpandedId(expandedId === id ? null : id);
  };

  const handleCreateIndiv = () => {
      if (newIndivName.trim() && onCreateIndividual) {
          onCreateIndividual(selectedNode.id, newIndivName.trim());
          setNewIndivName('');
      }
  };

  // --- Attributes (Characteristics / Data Properties) ---
  const addAttribute = () => {
    const defaultName = isPropertyNode ? 'Functional' : 'newProperty';
    const defaultType = isPropertyNode ? '' : 'xsd:string'; 
    const newAttr = { 
        id: `attr-${Date.now()}`, 
        name: defaultName, 
        type: defaultType, 
        visibility: '+' as const,
        isDerived: false,
        annotations: []
    };
    const newData = { ...localData, attributes: [...(localData.attributes || []), newAttr] };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  const updateAttribute = (id: string, field: string, value: any) => {
    const newAttrs = localData.attributes.map(a => a.id === id ? { ...a, [field]: value } : a);
    const newData = { ...localData, attributes: newAttrs };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };
  
  const removeAttribute = (id: string) => {
      const newAttrs = localData.attributes.filter(a => a.id !== id);
      const newData = { ...localData, attributes: newAttrs };
      setLocalData(newData);
      onUpdateNode(selectedNode.id, newData);
  };

  // --- Axioms / Methods Helper ---
  const addMethod = (type: string, defaultTarget = '') => {
    const newMethod = { 
        id: `method-${Date.now()}-${Math.random()}`, 
        name: type, 
        returnType: defaultTarget, 
        visibility: '+' as const,
        isOrdered: false,
        annotations: []
    };
    const newData = { ...localData, methods: [...(localData.methods || []), newMethod] };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  const updateMethod = (id: string, field: string, value: any) => {
    const newMethods = localData.methods.map(m => m.id === id ? { ...m, [field]: value } : m);
    const newData = { ...localData, methods: newMethods };
    setLocalData(newData);
    onUpdateNode(selectedNode.id, newData);
  };

  const removeMethod = (id: string) => {
      const newMethods = localData.methods.filter(m => m.id !== id);
      const newData = { ...localData, methods: newMethods };
      setLocalData(newData);
      onUpdateNode(selectedNode.id, newData);
  };

  // --- Render Helpers ---

  const renderAxiomGroup = (title: string, types: string[], icon?: React.ReactNode, placeholder = 'Target', ordered = false) => {
      const axioms = localData.methods.filter(m => types.includes(m.name));
      
      return (
          <div className="space-y-2 mb-4">
              <div className="flex justify-between items-end">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 ml-1">
                      {icon} {title}
                  </h4>
                  <button 
                      onClick={() => addMethod(types[0], placeholder)}
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 p-1 rounded transition-colors"
                  >
                      <Plus size={14} />
                  </button>
              </div>
              <div className="space-y-2">
                  {axioms.length > 0 ? axioms.map(method => (
                      <div key={method.id} className="bg-slate-950 border border-slate-800 rounded-lg p-2 group hover:border-slate-700 transition-colors">
                          <div className="flex items-start gap-2">
                              <div className="flex-1">
                                  <AxiomInput
                                      value={method.returnType}
                                      onChange={(val) => updateMethod(method.id, 'returnType', val)}
                                      placeholder={placeholder}
                                      allNodes={allNodes}
                                  />
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {ordered && (
                                     <button 
                                        onClick={() => updateMethod(method.id, 'isOrdered', !method.isOrdered)}
                                        className={`p-1 rounded ${method.isOrdered ? 'text-blue-400' : 'text-slate-600'}`}
                                        title="Ordered List"
                                     >
                                         <ListOrdered size={12} />
                                     </button>
                                  )}
                                  <button 
                                      onClick={() => toggleExpand(method.id)}
                                      className={`p-1 rounded ${expandedId === method.id ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'}`}
                                  >
                                      <Quote size={12} />
                                  </button>
                                  <button 
                                      onClick={() => removeMethod(method.id)}
                                      className="p-1 text-slate-600 hover:text-red-400"
                                  >
                                      <X size={12} />
                                  </button>
                              </div>
                          </div>
                          {expandedId === method.id && (
                              <div className="mt-2 pt-2 border-t border-slate-800/50">
                                  <AnnotationManager 
                                      annotations={method.annotations} 
                                      onUpdate={(anns) => updateMethod(method.id, 'annotations', anns)}
                                      title="Axiom Annotations"
                                      compact
                                  />
                              </div>
                          )}
                      </div>
                  )) : (
                      <div className="text-[10px] text-slate-700 italic px-2">None</div>
                  )}
              </div>
          </div>
      );
  };

  const displayType = localData.type.replace('owl_', '').replace(/_/g, ' ');

  return (
    <div ref={panelRef} className="w-full h-full overflow-y-auto flex flex-col font-sans text-sm text-slate-200 bg-slate-950">
      
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-blue-400 font-bold flex items-center gap-1">
                {isClassifiedIcon(localData.type)} {displayType}
            </span>
            <div className="font-bold text-lg text-white truncate max-w-[200px]" title={localData.label}>{localData.label}</div>
        </div>
        
        <div className="flex items-center gap-1">
            {/* View Navigation */}
            <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700 mr-2">
                <button 
                    onClick={() => onNavigate('design', selectedNode.id)}
                    className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-indigo-400 transition-colors"
                    title="Focus in Graph"
                >
                    <Layers size={14} />
                </button>
                <button 
                    onClick={() => onNavigate('entities', selectedNode.id)}
                    className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition-colors"
                    title="View in Catalog"
                >
                    <List size={14} />
                </button>
                <button 
                    onClick={() => onNavigate('owlviz', selectedNode.id)}
                    className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors"
                    title="View Hierarchy"
                >
                    <Network size={14} />
                </button>
            </div>

            <button 
                onClick={onClose}
                className="text-slate-500 hover:text-white hover:bg-slate-800 p-2 rounded-full transition-all"
                title="Hide Panel"
            >
                <X size={20} />
            </button>
        </div>
      </div>

      <div className="p-4 space-y-2 flex-1">
        
        {/* 1. Identity Section */}
        <AccordionSection title="Identity" icon={<Settings size={14} className="text-slate-400"/>} defaultOpen>
            <div className="space-y-4">
                <div className="space-y-1">
                     <label className="text-[10px] font-bold text-slate-500 uppercase">Label</label>
                     <input
                        type="text"
                        className="w-full bg-slate-950 border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded p-2 text-xs font-mono text-slate-300 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-slate-700"
                        value={localData.label}
                        onChange={(e) => handleChange('label', e.target.value)}
                    />
                </div>

                <div className="space-y-1">
                     <label className="text-[10px] font-bold text-slate-500 uppercase">IRI</label>
                     <input
                        type="text"
                        className="w-full bg-slate-950 border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded p-2 text-xs font-mono text-slate-300 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-slate-700"
                        value={localData.iri || `http://example.org/${selectedNode.id}`}
                        onChange={(e) => handleChange('iri', e.target.value)}
                    />
                </div>
            </div>
        </AccordionSection>

        {/* 2. Axioms Section */}
        {(isObjectProperty || isClassNode) && (
            <AccordionSection title="Logical Axioms" icon={<Layers size={14} className="text-indigo-400"/>} defaultOpen>
                {isObjectProperty ? (
                    // Object Property Axioms
                    <div className="space-y-4">
                        {renderAxiomGroup('Domains', ['Domain'], <ArrowRight size={12} />, 'Class')}
                        {renderAxiomGroup('Ranges', ['Range'], <ArrowRight size={12} />, 'Class')}
                        {renderAxiomGroup('Super Properties', ['SubPropertyOf'], <GitMerge size={12} />, 'Property')}
                        {renderAxiomGroup('Inverse Properties', ['InverseOf'], <GitMerge size={12} className="rotate-180" />, 'Property')}
                        {renderAxiomGroup('Equivalent', ['EquivalentTo'], <Link2 size={12} />, 'Property')}
                        {renderAxiomGroup('Disjoint', ['DisjointWith'], <Split size={12} />, 'Property')}
                        {renderAxiomGroup('Chains', ['PropertyChainAxiom'], <GitCommit size={12} />, 'prop1 o prop2', true)}
                    </div>
                ) : (
                    // General Axioms (Classes)
                    <div className="space-y-3">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-[10px] text-slate-500">Defines relationships and constraints.</span>
                            <button onClick={() => addMethod('SubClassOf')} className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium hover:bg-blue-500/10 px-2 py-1 rounded transition-colors"><Plus size={14} /> Add</button>
                        </div>
                        
                        <div className="space-y-2">
                            {localData.methods?.map((method) => (
                                 <div key={method.id} className="relative">
                                     <div className={`bg-slate-950 border border-slate-800 rounded-lg p-2 group hover:border-slate-700 transition-colors flex gap-2 items-start ${showSyntaxHelp === method.id ? 'ring-1 ring-purple-500/50 border-purple-500/30' : ''}`}>
                                         {/* Optional Visibility for Axioms/Operations */}
                                         <div className="mt-0.5">
                                            <VisibilitySelector 
                                                value={method.visibility} 
                                                onChange={(v) => updateMethod(method.id, 'visibility', v)} 
                                            />
                                         </div>

                                         <div className="flex-1 flex flex-col gap-1.5">
                                             <div className="flex gap-2 items-center">
                                                <select 
                                                    className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-purple-300 font-bold font-mono focus:outline-none focus:border-purple-500"
                                                    value={method.name}
                                                    onChange={(e) => updateMethod(method.id, 'name', e.target.value)}
                                                >
                                                    <option value="SubClassOf">SubClassOf</option>
                                                    <option value="EquivalentTo">EquivalentTo</option>
                                                    <option value="DisjointWith">DisjointWith</option>
                                                    <option value="Type">Type (Instance)</option>
                                                    <option value="SameAs">SameAs</option>
                                                </select>
                                                <ArrowRight size={10} className="text-slate-600" />
                                             </div>
                                             <div className="relative">
                                                <AxiomInput 
                                                    value={method.returnType}
                                                    onChange={(val) => updateMethod(method.id, 'returnType', val)}
                                                    placeholder="Expression (e.g. hasPart some Wheel)"
                                                    allNodes={allNodes}
                                                />
                                             </div>
                                         </div>
                                         
                                         <div className="flex flex-col gap-1">
                                            <button onClick={() => toggleExpand(method.id)} className={`text-slate-500 hover:text-blue-400 ${expandedId === method.id ? 'text-blue-400' : ''}`}><Quote size={14}/></button>
                                            <button onClick={() => removeMethod(method.id)} className="text-slate-600 hover:text-red-400"><X size={14}/></button>
                                         </div>
                                     </div>

                                     {expandedId === method.id && (
                                        <div className="mt-2 bg-slate-900 border border-slate-700 z-10 p-2 rounded shadow-xl">
                                            <AnnotationManager annotations={method.annotations} onUpdate={(anns) => updateMethod(method.id, 'annotations', anns)} title="Axiom Annotations" compact />
                                        </div>
                                    )}
                                 </div>
                            ))}
                        </div>
                    </div>
                )}
            </AccordionSection>
        )}

        {/* 3. Attributes / Characteristics Section */}
        <AccordionSection title={isObjectProperty ? "Characteristics" : "Data Properties"} icon={isObjectProperty ? <Settings size={14} className="text-slate-400"/> : <Tag size={14} className="text-green-400"/>}>
            {isObjectProperty ? (
                 <div className="space-y-2">
                     <div className="flex justify-between items-end mb-2">
                         <span className="text-[10px] text-slate-500">Logical flags for the property.</span>
                         <button onClick={addAttribute} className="text-blue-400 hover:bg-blue-500/10 p-1 rounded"><Plus size={14}/></button>
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                         {localData.attributes.map(attr => (
                             <div key={attr.id} className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 flex justify-between items-center group hover:border-slate-600 transition-colors">
                                 <select 
                                     className="bg-transparent text-[10px] text-slate-300 outline-none w-full appearance-none cursor-pointer"
                                     value={attr.name}
                                     onChange={(e) => updateAttribute(attr.id, 'name', e.target.value)}
                                 >
                                     {CHARACTERISTICS.map(c => <option key={c} value={c}>{c}</option>)}
                                 </select>
                                 <button onClick={() => removeAttribute(attr.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={10}/></button>
                             </div>
                         ))}
                     </div>
                 </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-[10px] text-slate-500">Attributes with literal values.</span>
                        <button 
                            onClick={addAttribute} 
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium hover:bg-blue-500/10 px-2 py-1 rounded transition-colors"
                        >
                            <Plus size={14} /> Add
                        </button>
                    </div>
                    
                    <div className="space-y-2">
                        {localData.attributes?.map((attr) => (
                        <div key={attr.id} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 group hover:border-slate-700 transition-all">
                            <div className="flex gap-2 items-start">
                                {/* Visibility Selector */}
                                <div className="pt-0.5">
                                    <VisibilitySelector 
                                        value={attr.visibility} 
                                        onChange={(v) => updateAttribute(attr.id, 'visibility', v)} 
                                    />
                                </div>

                                <div className="flex-1 flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => updateAttribute(attr.id, 'isDerived', !attr.isDerived)}
                                            className={`p-1 rounded text-[10px] font-mono border ${attr.isDerived ? 'bg-blue-900/30 border-blue-500/50 text-blue-300' : 'bg-slate-900 border-slate-700 text-slate-600'}`}
                                            title="Derived Property (/)"
                                        >
                                            /
                                        </button>
                                        
                                        <input 
                                            className="bg-transparent text-sm text-slate-200 outline-none placeholder-slate-600 font-medium w-full"
                                            value={attr.name}
                                            onChange={(e) => updateAttribute(attr.id, 'name', e.target.value)}
                                            placeholder="hasAge"
                                        />
                                        <button 
                                            onClick={() => toggleExpand(attr.id)}
                                            className={`text-slate-500 hover:text-blue-400 transition-colors ml-1 ${expandedId === attr.id ? 'text-blue-400' : ''}`}
                                        >
                                            <Quote size={12} />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Range</span>
                                        <div className="relative flex-1">
                                            <input 
                                                className="bg-slate-900/50 border border-slate-800 focus:border-blue-500/50 rounded px-2 py-1 text-xs text-blue-300 outline-none placeholder-slate-600 w-full font-mono transition-colors"
                                                value={attr.type}
                                                onChange={(e) => updateAttribute(attr.id, 'type', e.target.value)}
                                                onFocus={() => setActiveAttrType(attr.id)}
                                                placeholder="xsd:string"
                                                autoComplete="off"
                                            />
                                            {activeAttrType === attr.id && (
                                                <div className="absolute top-full left-0 mt-1 w-full bg-slate-800 border border-slate-700 rounded shadow-xl z-50 max-h-32 overflow-y-auto">
                                                    {XSD_TYPES.filter(t => t.toLowerCase().includes(attr.type.toLowerCase())).map(type => (
                                                        <div 
                                                            key={type}
                                                            className="px-3 py-1.5 text-xs text-slate-300 hover:bg-blue-600 hover:text-white cursor-pointer font-mono"
                                                            onMouseDown={(e) => { e.preventDefault(); updateAttribute(attr.id, 'type', type); setActiveAttrType(null); }}
                                                        >
                                                            {type}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => removeAttribute(attr.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"><X size={14} /></button>
                            </div>
                            {expandedId === attr.id && (
                                <div className="mt-2 pt-2 border-t border-slate-800/50 pl-2 border-l-2 border-l-blue-900/30">
                                    <AnnotationManager annotations={attr.annotations} onUpdate={(anns) => updateAttribute(attr.id, 'annotations', anns)} title="Annotations" compact />
                                </div>
                            )}
                        </div>
                        ))}
                    </div>
                </div>
            )}
        </AccordionSection>

        {/* 4. Instances Section */}
        {isClassNode && (
            <AccordionSection title="Instances" icon={<User size={14} className="text-pink-400"/>}>
                <div className="space-y-3">
                    <p className="text-[10px] text-slate-500">
                        Create a new NamedIndividual and link it to {localData.label}.
                    </p>
                    <div className="flex gap-2">
                        <input 
                            className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 placeholder-slate-600"
                            placeholder="New Individual Name..."
                            value={newIndivName}
                            onChange={(e) => setNewIndivName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateIndiv()}
                        />
                        <button 
                            onClick={handleCreateIndiv}
                            disabled={!newIndivName.trim()}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white p-2 rounded transition-colors"
                            title="Add Individual"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                </div>
            </AccordionSection>
        )}

        {/* 5. Annotations Section */}
        <AccordionSection title="Annotations" icon={<Quote size={14} className="text-slate-400"/>}>
            <AnnotationManager 
                annotations={localData.annotations} 
                onUpdate={handleAnnotationsUpdate}
            />
        </AccordionSection>

      </div>

      {/* Danger Zone */}
      <div className="mt-4 pt-4 border-t border-slate-800 px-5 pb-5">
          <button 
              onClick={() => onDeleteNode(selectedNode.id)}
              className="w-full flex items-center justify-center gap-2 bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-900/30 hover:border-red-900/50 rounded-lg p-2.5 text-xs font-bold transition-all"
          >
              <AlertOctagon size={14} />
              Delete {displayType}
          </button>
      </div>
    </div>
  );
};

// Helper for header icon
const isClassifiedIcon = (type: ElementType) => {
    switch (type) {
        case ElementType.OWL_CLASS: return <Box size={14} />;
        case ElementType.OWL_OBJECT_PROPERTY: return <GitMerge size={14} />;
        case ElementType.OWL_DATA_PROPERTY: return <Tag size={14} />;
        case ElementType.OWL_NAMED_INDIVIDUAL: return <User size={14} />;
        default: return <Box size={14} />;
    }
}

export default PropertiesPanel;
