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

const OWL_KEYWORDS = new Set([
  'Ontology', 'Import', 'Declaration', 'Class', 'ObjectProperty', 'DataProperty', 
  'AnnotationProperty', 'NamedIndividual', 'Datatype', 'SubClassOf', 'EquivalentClasses', 
  'DisjointClasses', 'DisjointUnion', 'SubObjectPropertyOf', 'EquivalentObjectProperties', 
  'DisjointObjectProperties', 'InverseObjectProperties', 'ObjectPropertyDomain', 
  'ObjectPropertyRange', 'FunctionalObjectProperty', 'InverseFunctionalObjectProperty', 
  'ReflexiveObjectProperty', 'IrreflexiveObjectProperty', 'SymmetricObjectProperty', 
  'AsymmetricObjectProperty', 'TransitiveObjectProperty', 'SubDataPropertyOf', 
  'EquivalentDataProperties', 'DisjointDataProperties', 'DataPropertyDomain', 
  'DataPropertyRange', 'FunctionalDataProperty', 'DatatypeDefinition', 'HasKey', 
  'SameIndividual', 'DifferentIndividuals', 'ClassAssertion', 'ObjectPropertyAssertion', 
  'DataPropertyAssertion', 'NegativeObjectPropertyAssertion', 'NegativeDataPropertyAssertion', 
  'AnnotationAssertion', 'Prefix', 'Annotation', 'ObjectSomeValuesFrom', 'ObjectAllValuesFrom', 
  'ObjectUnionOf', 'ObjectIntersectionOf', 'ObjectComplementOf', 'ObjectOneOf', 'ObjectHasValue', 
  'ObjectHasSelf', 'ObjectMinCardinality', 'ObjectMaxCardinality', 'ObjectExactCardinality', 
  'DataSomeValuesFrom', 'DataAllValuesFrom', 'DataUnionOf', 'DataIntersectionOf', 
  'DataComplementOf', 'DataOneOf', 'DataHasValue', 'DataMinCardinality', 'DataMaxCardinality', 
  'DataExactCardinality'
]);

const tokenize = (code: string) => {
    const tokens: { text: string, className: string }[] = [];
    let remaining = code;
    
    while (remaining.length > 0) {
        let match;
        
        // 1. Comment
        if ((match = remaining.match(/^#[^\n]*/))) {
            tokens.push({ text: match[0], className: 'text-slate-500 italic' });
            remaining = remaining.slice(match[0].length);
            continue;
        }

        // 2. String
        if ((match = remaining.match(/^"(?:[^"\\]|\\.)*"/))) {
            tokens.push({ text: match[0], className: 'text-emerald-400' });
            remaining = remaining.slice(match[0].length);
            continue;
        }

        // 3. Full IRI
        if ((match = remaining.match(/^<[^>]*>/))) {
             tokens.push({ text: match[0], className: 'text-cyan-400' });
             remaining = remaining.slice(match[0].length);
             continue;
        }

        // 4. Prefix/PNAME (e.g. rdf:type, :Person, ex:Thing)
        // Matches "prefix:suffix" or ":suffix" or "prefix:"
        if ((match = remaining.match(/^([a-zA-Z0-9_-]*:[a-zA-Z0-9._-]+)/)) || (match = remaining.match(/^([a-zA-Z0-9_-]*:)/))) {
            const val = match[0];
            let color = 'text-blue-300';
            if (val.startsWith('xsd:') || val.startsWith('owl:') || val.startsWith('rdf:') || val.startsWith('rdfs:')) {
                color = 'text-amber-400';
            }
            tokens.push({ text: val, className: color });
            remaining = remaining.slice(val.length);
            continue;
        }

        // 5. Keywords / Identifiers
        if ((match = remaining.match(/^[a-zA-Z][a-zA-Z0-9_-]*/))) {
            const val = match[0];
            if (OWL_KEYWORDS.has(val)) {
                tokens.push({ text: val, className: 'text-purple-400 font-bold' });
            } else {
                 tokens.push({ text: val, className: 'text-slate-200' });
            }
            remaining = remaining.slice(val.length);
            continue;
        }
        
        // 6. Delimiters
        if ((match = remaining.match(/^[()=]/))) {
             tokens.push({ text: match[0], className: 'text-slate-500' });
             remaining = remaining.slice(match[0].length);
             continue;
        }

        // 7. Whitespace
        if ((match = remaining.match(/^\s+/))) {
             tokens.push({ text: match[0], className: '' });
             remaining = remaining.slice(match[0].length);
             continue;
        }

        // Fallback char
        tokens.push({ text: remaining[0], className: 'text-slate-200' });
        remaining = remaining.slice(1);
    }
    return tokens;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ nodes, edges, metadata }) => {
    const code = useMemo(() => {
        return generateFunctionalSyntax(nodes, edges, metadata);
    }, [nodes, edges, metadata]);

    const tokens = useMemo(() => tokenize(code), [code]);

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
                <pre className="whitespace-pre font-mono text-xs leading-relaxed">
                    {tokens.map((token, i) => (
                        <span key={i} className={token.className}>{token.text}</span>
                    ))}
                </pre>
            </div>
        </div>
    );
};

export default CodeViewer;