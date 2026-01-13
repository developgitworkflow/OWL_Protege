
import React, { useMemo } from 'react';
import { UMLNodeData } from '../types';
import { verbalizeNode } from '../services/verbalizer';
import { BookOpen, Info } from 'lucide-react';

interface ElementDescriptionPanelProps {
    node: UMLNodeData | null;
}

const ElementDescriptionPanel: React.FC<ElementDescriptionPanelProps> = ({ node }) => {
    
    const content = useMemo(() => {
        if (!node) return null;
        return verbalizeNode(node);
    }, [node]);

    if (!node || !content) {
        return (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 md:left-6 md:translate-x-0 z-40 w-[90vw] md:w-[400px] bg-slate-900/80 backdrop-blur-md border border-slate-800 p-4 rounded-xl shadow-2xl pointer-events-none transition-all duration-500 opacity-60">
                <div className="flex items-center gap-3 text-slate-500">
                    <Info size={18} />
                    <span className="text-xs font-medium">Hover over or select an element to see its description.</span>
                </div>
            </div>
        );
    }

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 md:left-6 md:translate-x-0 z-40 w-[90vw] md:w-[400px] bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 p-5 rounded-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-4 fade-in">
            <div className="flex items-start gap-4">
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg shrink-0">
                    <BookOpen size={20} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{content.title}</h3>
                    <p className="text-[10px] text-slate-400 font-mono truncate mb-3 border-b border-slate-800 pb-2">
                        {content.subtitle}
                    </p>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                        {content.description.map((line, idx) => {
                            // Simple bold formatting parsing
                            const parts = line.split(/(\*\*.*?\*\*)/);
                            return (
                                <p key={idx} className="text-xs text-slate-300 leading-relaxed">
                                    {parts.map((part, i) => 
                                        part.startsWith('**') && part.endsWith('**') 
                                        ? <span key={i} className="font-bold text-indigo-300">{part.slice(2, -2)}</span>
                                        : part
                                    )}
                                </p>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ElementDescriptionPanel;
