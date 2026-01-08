import React, { useMemo, useState, useEffect } from 'react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ProjectData } from '../types';
import { generateFunctionalSyntax } from '../services/functionalSyntaxGenerator';
import { generateManchesterSyntax } from '../services/manchesterSyntaxGenerator';
import { Copy, FileCode, AlignLeft, Edit3, Play, AlertCircle, BookOpen } from 'lucide-react';

interface CodeViewerProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
    metadata: ProjectData;
    onImportCode?: (code: string, syntax: 'functional' | 'manchester') => void;
}

const EXAMPLE_MANCHESTER = `Prefix: : <http://example.org/university#>
Prefix: owl: <http://www.w3.org/2002/07/owl#>
Prefix: rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
Prefix: rdfs: <http://www.w3.org/2000/01/rdf-schema#>
Prefix: xsd: <http://www.w3.org/2001/XMLSchema#>

Ontology: <http://example.org/university>

# --- Properties ---

ObjectProperty: teaches
    Domain: Professor
    Range: Course
    InverseOf: isTaughtBy

ObjectProperty: isTaughtBy
    Characteristics: Functional

# --- Classes ---

Class: Person
    Annotations: rdfs:comment "A general human being in the university system."

Class: Professor
    SubClassOf: Person,
        teaches some Course,
        teaches min 1 Course
    DisjointWith: Student

Class: Student
    SubClassOf: Person,
        enrolledIn some Course

Class: Course
    Annotations: rdfs:label "University Course"

# --- Complex Defined Class ---

Class: OverworkedProfessor
    EquivalentTo: Professor and (teaches min 4 Course)
    
# --- Individuals ---

Individual: Alan_Turing
    Types: Professor
    Facts: teaches Artificial_Intelligence_101

Individual: Artificial_Intelligence_101
    Types: Course`;

const FUNCTIONAL_KEYWORDS = new Set([
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

const MANCHESTER_KEYWORDS = new Set([
    'Ontology:', 'Namespace:', 'Prefix:', 'Class:', 'Individual:', 'ObjectProperty:', 'DataProperty:',
    'AnnotationProperty:', 'Types:', 'Facts:', 'SubClassOf:', 'EquivalentTo:', 'DisjointWith:',
    'DisjointUnionOf:', 'SubPropertyOf:', 'InverseOf:', 'Domain:', 'Range:', 'Characteristics:',
    'Annotations:', 'and', 'or', 'not', 'some', 'only', 'value', 'min', 'max', 'exactly', 'that',
    'Functional', 'InverseFunctional', 'Reflexive', 'Irreflexive', 'Symmetric', 'Asymmetric', 'Transitive'
]);

const tokenize = (code: string, mode: 'functional' | 'manchester') => {
    const tokens: { text: string, className: string }[] = [];
    let remaining = code;
    
    const keywords = mode === 'functional' ? FUNCTIONAL_KEYWORDS : MANCHESTER_KEYWORDS;
    
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
            if (mode === 'manchester' && keywords.has(val)) {
                color = 'text-purple-400 font-bold';
            } else if (val.startsWith('xsd:') || val.startsWith('owl:') || val.startsWith('rdf:') || val.startsWith('rdfs:')) {
                color = 'text-amber-400';
            }
            tokens.push({ text: val, className: color });
            remaining = remaining.slice(val.length);
            continue;
        }

        // 5. Keywords / Identifiers
        if ((match = remaining.match(/^[a-zA-Z][a-zA-Z0-9_-]*/))) {
            const val = match[0];
            if (keywords.has(val)) {
                tokens.push({ text: val, className: 'text-purple-400 font-bold' });
            } else {
                 tokens.push({ text: val, className: 'text-slate-200' });
            }
            remaining = remaining.slice(val.length);
            continue;
        }
        
        // 6. Delimiters
        if ((match = remaining.match(/^[()={}\[\],]/))) {
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

const CodeViewer: React.FC<CodeViewerProps> = ({ nodes, edges, metadata, onImportCode }) => {
    const [syntax, setSyntax] = useState<'functional' | 'manchester'>('functional');
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Initial code generation
    const generatedCode = useMemo(() => {
        if (syntax === 'manchester') {
            return generateManchesterSyntax(nodes, edges, metadata);
        }
        return generateFunctionalSyntax(nodes, edges, metadata);
    }, [nodes, edges, metadata, syntax]);

    // Sync editor with generated code when not editing
    useEffect(() => {
        if (!isEditing) {
            setEditContent(generatedCode);
        }
    }, [generatedCode, isEditing]);

    const tokens = useMemo(() => tokenize(generatedCode, syntax), [generatedCode, syntax]);

    const handleCopy = () => {
        navigator.clipboard.writeText(isEditing ? editContent : generatedCode);
    };

    const handleApply = () => {
        if (onImportCode) {
            try {
                onImportCode(editContent, syntax);
                setIsEditing(false);
                setError(null);
            } catch (e) {
                setError((e as Error).message);
            }
        }
    };

    const handleLoadExample = () => {
        setSyntax('manchester');
        setEditContent(EXAMPLE_MANCHESTER);
        setIsEditing(true);
        setError(null);
    };

    return (
        <div className="h-full flex flex-col bg-slate-900 text-slate-200 font-mono text-sm relative">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-100 font-semibold">
                        <FileCode className="text-blue-500 w-5 h-5" />
                        OWL 2 Syntax
                    </div>
                    
                    {/* Syntax Toggle */}
                    <div className="bg-slate-800 p-1 rounded-lg flex border border-slate-700">
                        <button 
                            onClick={() => { setSyntax('functional'); setIsEditing(false); }}
                            className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                                syntax === 'functional' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Functional
                        </button>
                        <button 
                            onClick={() => { setSyntax('manchester'); setIsEditing(false); }}
                            className={`px-3 py-1 text-xs font-medium rounded transition-all flex items-center gap-1 ${
                                syntax === 'manchester' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <AlignLeft size={12} />
                            Manchester
                        </button>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                     <button 
                        onClick={handleLoadExample}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition-colors text-purple-400 hover:text-purple-300"
                        title="Load University Ontology Example"
                    >
                        <BookOpen size={14} />
                        Example
                    </button>

                    <div className="w-px h-6 bg-slate-800 mx-1" />

                    {isEditing ? (
                        <>
                            <button 
                                onClick={() => { setIsEditing(false); setError(null); }}
                                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleApply}
                                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded text-xs transition-colors shadow-sm"
                            >
                                <Play size={14} />
                                Apply Changes
                            </button>
                        </>
                    ) : (
                         <button 
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition-colors"
                        >
                            <Edit3 size={14} />
                            Edit
                        </button>
                    )}

                    <button 
                        onClick={handleCopy}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs transition-colors"
                    >
                        <Copy size={14} />
                        Copy
                    </button>
                </div>
            </div>

            {error && (
                <div className="absolute top-16 left-0 right-0 mx-6 z-10 bg-red-900/90 border border-red-700 text-red-100 px-4 py-2 rounded flex items-center gap-2 text-xs">
                    <AlertCircle size={14} />
                    {error}
                </div>
            )}

            <div className="flex-1 overflow-hidden relative">
                {isEditing ? (
                    <textarea
                        className="w-full h-full bg-slate-950 p-6 text-xs font-mono text-slate-200 outline-none resize-none leading-relaxed"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        spellCheck={false}
                        placeholder={`Paste or type ${syntax} syntax here...`}
                    />
                ) : (
                    <div className="w-full h-full overflow-auto p-6 bg-slate-950">
                        <pre className="whitespace-pre font-mono text-xs leading-relaxed">
                            {tokens.map((token, i) => (
                                <span key={i} className={token.className}>{token.text}</span>
                            ))}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CodeViewer;