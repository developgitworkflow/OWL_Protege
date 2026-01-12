
import React from 'react';
import { X, Save, Maximize, Database, ArrowRightLeft, Tag, User, Quote, Layers, Settings } from 'lucide-react';
import { UMLNodeData, ElementType, Method } from '../types';
import { Node as FlowNode } from 'reactflow';
import AnnotationManager from './AnnotationManager';
import { AxiomInput } from './AxiomInput';

interface ExpandedEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    section: 'identity' | 'axioms' | 'properties' | 'instances' | 'annotations' | null;
    node: FlowNode<UMLNodeData> | null;
    allNodes: FlowNode<UMLNodeData>[];
    onUpdate: (data: UMLNodeData) => void;
}

const ExpandedEditorModal: React.FC<ExpandedEditorModalProps> = ({ isOpen, onClose, section, node, allNodes, onUpdate }) => {
    if (!isOpen || !node || !section) return null;

    const data = node.data;

    const handleChange = (field: keyof UMLNodeData, value: any) => {
        onUpdate({ ...data, [field]: value });
    };

    const getIcon = () => {
        switch(section) {
            case 'identity': return <Settings size={24} className="text-slate-400" />;
            case 'axioms': return <Layers size={24} className="text-indigo-400" />;
            case 'properties': return <Tag size={24} className="text-green-400" />;
            case 'instances': return <User size={24} className="text-pink-400" />;
            case 'annotations': return <Quote size={24} className="text-amber-400" />;
            default: return <Database size={24} />;
        }
    };

    const getTitle = () => {
        switch(section) {
            case 'identity': return 'Edit Identity';
            case 'axioms': return 'Logical Axioms & Restrictions';
            case 'properties': return data.type === ElementType.OWL_CLASS ? 'Data Properties' : 'Characteristics';
            case 'instances': return 'Linked Instances';
            case 'annotations': return 'Annotations & Metadata';
            default: return 'Edit Node';
        }
    };

    // --- Content Renderers ---

    const renderIdentity = () => (
        <div className="space-y-6">
            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-400 uppercase tracking-wide">Label (Name)</label>
                <input 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium placeholder-slate-600"
                    value={data.label}
                    onChange={(e) => handleChange('label', e.target.value)}
                    placeholder="Entity Name"
                    autoFocus
                />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-400 uppercase tracking-wide">Full IRI</label>
                <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                    <span className="pl-4 text-slate-500 font-mono select-none">{'<'}</span>
                    <input 
                        className="w-full bg-transparent border-none px-1 py-3 text-sm text-blue-300 font-mono focus:ring-0 placeholder-slate-700"
                        value={data.iri || `http://example.org/ontology#${data.label}`}
                        onChange={(e) => handleChange('iri', e.target.value)}
                        placeholder="http://example.org/ontology#Entity"
                    />
                    <span className="pr-4 text-slate-500 font-mono select-none">{'>'}</span>
                </div>
            </div>
            {/* Description fallback for older format */}
            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-400 uppercase tracking-wide">Description (skos:definition)</label>
                <textarea 
                    className="w-full h-32 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                    value={data.description || ''}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Provide a natural language definition..."
                />
            </div>
        </div>
    );

    const renderAxioms = () => {
        const updateMethod = (id: string, field: string, val: any) => {
            const newMethods = data.methods.map(m => m.id === id ? { ...m, [field]: val } : m);
            handleChange('methods', newMethods);
        };
        const removeMethod = (id: string) => {
            handleChange('methods', data.methods.filter(m => m.id !== id));
        };
        const addMethod = () => {
            const newM: Method = { id: `m-${Date.now()}`, name: 'SubClassOf', returnType: '', visibility: '+' };
            handleChange('methods', [...data.methods, newM]);
        };

        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-800">
                    <div className="text-sm text-slate-400">
                        Define logical constraints using Manchester Syntax.
                    </div>
                    <button onClick={addMethod} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2">
                        <Maximize size={16} className="rotate-45" /> Add Axiom
                    </button>
                </div>

                <div className="space-y-3">
                    {data.methods.map((m, idx) => (
                        <div key={m.id} className="flex gap-4 items-start p-4 bg-slate-950/50 border border-slate-800 rounded-xl hover:border-slate-600 transition-colors group">
                            <div className="w-40 pt-1">
                                <select 
                                    className="w-full bg-slate-900 border border-slate-700 text-indigo-300 font-bold text-sm rounded px-2 py-2 focus:border-indigo-500 focus:outline-none"
                                    value={m.name}
                                    onChange={(e) => updateMethod(m.id, 'name', e.target.value)}
                                >
                                    <option value="SubClassOf">SubClassOf</option>
                                    <option value="EquivalentTo">EquivalentTo</option>
                                    <option value="DisjointWith">DisjointWith</option>
                                    <option value="Domain">Domain (Prop)</option>
                                    <option value="Range">Range (Prop)</option>
                                    <option value="Type">Type (Assertion)</option>
                                </select>
                            </div>
                            <div className="flex-1">
                                <AxiomInput 
                                    value={m.returnType}
                                    onChange={(val) => updateMethod(m.id, 'returnType', val)}
                                    placeholder="Class Expression (e.g. hasPart some Wheel)"
                                    allNodes={allNodes}
                                    large
                                />
                            </div>
                            <button 
                                onClick={() => removeMethod(m.id)}
                                className="text-slate-600 hover:text-red-400 p-2 rounded hover:bg-slate-900 transition-colors self-center"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    ))}
                    {data.methods.length === 0 && (
                        <div className="text-center py-12 text-slate-600 border-2 border-dashed border-slate-800 rounded-xl">
                            No explicit axioms defined yet.
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderProperties = () => {
        // Re-using logic from panel but expanded
        const isProp = data.type === ElementType.OWL_OBJECT_PROPERTY || data.type === ElementType.OWL_DATA_PROPERTY;
        
        const updateAttr = (id: string, field: string, val: any) => {
            const newAttrs = data.attributes.map(a => a.id === id ? { ...a, [field]: val } : a);
            handleChange('attributes', newAttrs);
        };
        const removeAttr = (id: string) => handleChange('attributes', data.attributes.filter(a => a.id !== id));
        const addAttr = () => {
            handleChange('attributes', [...data.attributes, { id: `a-${Date.now()}`, name: isProp ? 'Functional' : 'newProp', type: isProp ? '' : 'xsd:string', visibility: '+' }]);
        };

        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{isProp ? 'Characteristics' : 'Data Properties'}</h3>
                    <button onClick={addAttr} className="text-blue-400 hover:text-white hover:bg-blue-600 px-3 py-1.5 rounded-md text-xs font-bold transition-colors border border-blue-900/50 bg-blue-900/10">
                        + Add New
                    </button>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                    {data.attributes.map(attr => (
                        <div key={attr.id} className="flex items-center gap-4 p-3 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-600 transition-all">
                            {isProp ? (
                                <select 
                                    className="flex-1 bg-transparent text-slate-200 text-sm font-medium focus:outline-none p-2"
                                    value={attr.name}
                                    onChange={(e) => updateAttr(attr.id, 'name', e.target.value)}
                                >
                                    {['Functional', 'InverseFunctional', 'Transitive', 'Symmetric', 'Asymmetric', 'Reflexive', 'Irreflexive'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            ) : (
                                <>
                                    <input 
                                        className="flex-1 bg-transparent text-slate-200 text-base font-medium focus:outline-none border-b border-transparent focus:border-blue-500 pb-1"
                                        value={attr.name}
                                        onChange={(e) => updateAttr(attr.id, 'name', e.target.value)}
                                        placeholder="hasName"
                                    />
                                    <div className="w-px h-6 bg-slate-800" />
                                    <input 
                                        className="w-1/3 bg-transparent text-slate-400 text-sm font-mono focus:outline-none border-b border-transparent focus:border-green-500 pb-1"
                                        value={attr.type}
                                        onChange={(e) => updateAttr(attr.id, 'type', e.target.value)}
                                        placeholder="xsd:string"
                                    />
                                </>
                            )}
                            <button onClick={() => removeAttr(attr.id)} className="text-slate-600 hover:text-red-400 p-2"><X size={16}/></button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderAnnotations = () => (
        <div className="h-full flex flex-col">
            <AnnotationManager 
                annotations={data.annotations} 
                onUpdate={(anns) => handleChange('annotations', anns)}
                title="" // No title needed inside modal
                compact={false}
            />
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl bg-slate-900 rounded-2xl shadow-2xl ring-1 ring-slate-700 flex flex-col max-h-[90vh] overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="px-8 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 shadow-inner">
                            {getIcon()}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">{getTitle()}</h2>
                            <p className="text-sm text-slate-500 font-medium">For <span className="text-blue-400">{data.label}</span></p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-700">
                            Cancel
                        </button>
                        <button onClick={onClose} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2">
                            <Save size={16} /> Done
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-950/50">
                    <div className="max-w-3xl mx-auto">
                        {section === 'identity' && renderIdentity()}
                        {section === 'axioms' && renderAxioms()}
                        {section === 'properties' && renderProperties()}
                        {section === 'annotations' && renderAnnotations()}
                        {/* Instances usually handled graphically, placeholder for list view */}
                        {section === 'instances' && (
                            <div className="text-center text-slate-500 py-20">
                                <User size={48} className="mx-auto mb-4 opacity-20" />
                                <p>Manage instances via the Graph View or Catalog for better visualization.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ExpandedEditorModal;
