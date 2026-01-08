import React, { useMemo } from 'react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ProjectData } from '../types';
import { generateFunctionalSyntax } from '../services/functionalSyntaxGenerator';
import { Copy, FileCode } from 'lucide-react';

interface CodeViewerProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
    metadata: ProjectData;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ nodes, edges, metadata }) => {
    const code = useMemo(() => {
        return generateFunctionalSyntax(nodes, edges, metadata);
    }, [nodes, edges, metadata]);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
    };

    return (
        <div className="h-full flex flex-col bg-slate-900 text-slate-200 font-mono text-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
                <div className="flex items-center gap-3">
                    <FileCode className="text-blue-500 w-5 h-5" />
                    <div>
                        <h2 className="font-semibold text-slate-100">OWL 2 Functional Syntax</h2>
                        <p className="text-xs text-slate-500">Generated structure based on current diagram.</p>
                    </div>
                </div>
                <button 
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition-colors"
                >
                    <Copy size={14} />
                    Copy to Clipboard
                </button>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-slate-950">
                <pre className="whitespace-pre font-mono text-xs leading-relaxed text-blue-100">
                    {code}
                </pre>
            </div>
        </div>
    );
};

export default CodeViewer;