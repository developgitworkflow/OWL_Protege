
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Node as FlowNode } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { validateManchesterSyntax } from '../services/manchesterValidator';
import { AlertCircle } from 'lucide-react';

interface AxiomInputProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    allNodes: FlowNode<UMLNodeData>[];
    large?: boolean; // New prop for larger modal usage
}

const MANCHESTER_KEYWORDS = [
    'some', 'only', 'value', 'min', 'max', 'exactly', 'that', 'not', 'and', 'or', 'self'
];

export const AxiomInput: React.FC<AxiomInputProps> = ({ value, onChange, placeholder, allNodes, large = false }) => {
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
            
        return [...keywords, ...entities].slice(0, 8);
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
        if (type.includes('property')) return 'text-blue-400';
        return 'text-slate-400';
    };

    return (
        <div className="relative w-full group/input" ref={containerRef}>
            {/* Syntax Toolbar */}
            <div className="flex gap-1 mb-1.5 opacity-0 group-focus-within/input:opacity-100 group-hover/input:opacity-100 transition-opacity absolute bottom-full left-0 bg-slate-800 p-1 rounded-t-md border border-b-0 border-slate-700 pointer-events-none group-focus-within/input:pointer-events-auto z-10">
                {['some', 'only', 'and', 'or', 'not', 'min', 'max'].map(kw => (
                    <button 
                        key={kw} 
                        onClick={() => insertToken(kw)}
                        className="px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-400 hover:text-amber-300 hover:bg-slate-700 rounded transition-colors"
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
                    rows={large ? 3 : 1}
                    className={`w-full bg-slate-950 border rounded px-3 py-2 font-mono focus:outline-none focus:ring-1 resize-none overflow-hidden
                        ${large ? 'text-sm' : 'text-xs'}
                        ${!validation.isValid && value ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-800 focus:border-blue-500/50 focus:ring-blue-500/20 text-slate-200'}
                    `}
                    style={{ minHeight: large ? '80px' : '38px', height: 'auto' }}
                />
                
                {/* Validation Icon */}
                {!validation.isValid && value && (
                    <div className="absolute right-2 top-2 text-red-500 group/err">
                        <AlertCircle size={large ? 16 : 14} />
                        <div className="absolute right-0 top-full mt-1 w-64 bg-red-950 border border-red-800 text-red-200 text-xs p-2 rounded shadow-xl opacity-0 group-hover/err:opacity-100 pointer-events-none transition-opacity z-20">
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
                            className={`w-full text-left px-3 py-2 flex items-center justify-between font-mono transition-colors border-b border-slate-700/50 last:border-0 ${large ? 'text-sm' : 'text-xs'} ${i === cursorIdx ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                        >
                            <span>{item.label}</span>
                            <span className={`text-[9px] uppercase tracking-wider ${i === cursorIdx ? 'text-blue-200' : getTypeColor(item.type)}`}>
                                {item.isKeyword ? 'KW' : item.type.replace('owl_', '').replace('named_', '')}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
