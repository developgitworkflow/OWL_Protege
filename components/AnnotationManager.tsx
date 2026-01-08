import React, { useState } from 'react';
import { Annotation } from '../types';
import { Plus, X, Quote } from 'lucide-react';

interface AnnotationManagerProps {
    annotations: Annotation[] | undefined;
    onUpdate: (annotations: Annotation[]) => void;
    title?: string;
    compact?: boolean;
}

const ANNOTATION_PROPS = [
    'rdfs:label', 'rdfs:comment', 'rdfs:seeAlso', 'rdfs:isDefinedBy', 
    'owl:versionInfo', 'owl:backwardCompatibleWith', 'owl:incompatibleWith', 
    'owl:deprecated', 'skos:prefLabel', 'skos:altLabel', 'skos:definition', 
    'skos:note', 'dc:title', 'dc:description', 'dc:creator', 'dc:date'
];

const AnnotationManager: React.FC<AnnotationManagerProps> = ({ annotations = [], onUpdate, title = "Annotations", compact = false }) => {
    const [activeAnnProp, setActiveAnnProp] = useState<string | null>(null);

    const addAnnotation = () => {
        const newAnn: Annotation = {
            id: `ann-${Date.now()}-${Math.random()}`,
            property: 'rdfs:comment',
            value: '"New Annotation"',
            language: 'en'
        };
        onUpdate([...annotations, newAnn]);
    };

    const updateAnnotation = (id: string, field: keyof Annotation, value: string) => {
        const newAnns = annotations.map(a => a.id === id ? { ...a, [field]: value } : a);
        onUpdate(newAnns);
    };

    const removeAnnotation = (id: string) => {
        onUpdate(annotations.filter(a => a.id !== id));
    };

    return (
        <div className={`space-y-2 ${compact ? 'text-xs' : 'text-sm'}`}>
            <div className="flex justify-between items-end">
                <h3 className={`font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 ${compact ? 'text-[10px]' : 'text-xs'}`}>
                    <Quote size={compact ? 10 : 12} /> {title}
                </h3>
                <button 
                    onClick={addAnnotation} 
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium hover:bg-blue-500/10 px-2 py-1 rounded transition-colors text-[10px]"
                >
                    <Plus size={12} /> Add
                </button>
            </div>
            
            <div className="space-y-2">
                {annotations.length > 0 ? (
                    annotations.map(ann => (
                        <div key={ann.id} className="bg-slate-950 border border-slate-800 rounded p-2 group hover:border-slate-700 transition-colors">
                            <div className="flex items-start gap-2">
                                <div className={`${compact ? 'w-20' : 'w-24'} shrink-0 relative`}>
                                    <input 
                                        className="w-full bg-slate-900 border border-slate-700 text-[10px] text-slate-400 font-mono rounded px-1 py-1 focus:outline-none focus:border-blue-500"
                                        value={ann.property}
                                        onChange={(e) => updateAnnotation(ann.id, 'property', e.target.value)}
                                        onFocus={() => setActiveAnnProp(ann.id)}
                                        placeholder="rdfs:comment"
                                    />
                                    {activeAnnProp === ann.id && (
                                        <div className="absolute top-full left-0 mt-1 w-32 bg-slate-800 border border-slate-700 rounded shadow-xl z-50 max-h-32 overflow-y-auto">
                                            {ANNOTATION_PROPS.filter(p => p.toLowerCase().includes(ann.property.toLowerCase())).map(p => (
                                                <div 
                                                    key={p}
                                                    className="px-2 py-1 text-[10px] text-slate-300 hover:bg-blue-600 hover:text-white cursor-pointer font-mono"
                                                    onMouseDown={(e) => { e.preventDefault(); updateAnnotation(ann.id, 'property', p); setActiveAnnProp(null); }}
                                                >
                                                    {p}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <textarea 
                                        rows={compact ? 1 : 2}
                                        className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded px-1 py-1 focus:outline-none focus:border-blue-500 resize-none"
                                        value={ann.value}
                                        onChange={(e) => updateAnnotation(ann.id, 'value', e.target.value)}
                                        placeholder='"Value"'
                                    />
                                </div>
                                <div className="w-10 shrink-0">
                                     <input 
                                        className="w-full bg-slate-900 border border-slate-700 text-[10px] text-slate-400 font-mono rounded px-1 py-1 focus:outline-none focus:border-blue-500 text-center"
                                        value={ann.language || ''}
                                        onChange={(e) => updateAnnotation(ann.id, 'language', e.target.value)}
                                        placeholder="en"
                                    />
                                </div>
                                <button 
                                    onClick={() => removeAnnotation(ann.id)}
                                    className="text-slate-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                     <div className="text-center py-2 border border-dashed border-slate-800 rounded text-slate-600 text-[10px]">
                        No annotations.
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnnotationManager;