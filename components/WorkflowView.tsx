
import React, { useMemo } from 'react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';
import { Database, ArrowRightLeft, Brain, User, ShieldCheck, Download, ChevronRight, Activity, GitBranch, Share2, Plus, Play, CheckCircle2, AlertTriangle, Layers, BookOpen, List } from 'lucide-react';

interface WorkflowViewProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
    isReasonerActive: boolean;
    validationStatus: 'valid' | 'invalid' | 'unknown';
    onNavigate: (view: string, id?: string) => void;
    onRunReasoner: () => void;
    onValidate: () => void;
    onExport: () => void;
    onCreateClass: () => void;
}

const WorkflowView: React.FC<WorkflowViewProps> = ({ 
    nodes, 
    edges, 
    isReasonerActive, 
    validationStatus,
    onNavigate,
    onRunReasoner,
    onValidate,
    onExport,
    onCreateClass
}) => {

    const stats = useMemo(() => {
        const classes = nodes.filter(n => n.data.type === ElementType.OWL_CLASS).length;
        const objProps = nodes.filter(n => n.data.type === ElementType.OWL_OBJECT_PROPERTY).length;
        const dataProps = nodes.filter(n => n.data.type === ElementType.OWL_DATA_PROPERTY).length;
        const individuals = nodes.filter(n => n.data.type === ElementType.OWL_NAMED_INDIVIDUAL).length;
        
        // Rough axiom count
        const restrictions = nodes.reduce((acc, n) => acc + (n.data.methods?.length || 0), 0);
        const hierarchyEdges = edges.filter(e => e.label === 'subClassOf' || e.label === 'rdfs:subClassOf').length;

        return { classes, objProps, dataProps, individuals, restrictions, hierarchyEdges };
    }, [nodes, edges]);

    const steps = [
        {
            id: 'concepts',
            title: 'Conceptualization',
            subtitle: 'Define the vocabulary and taxonomy.',
            icon: Database,
            color: 'text-purple-400',
            bg: 'bg-purple-900/20',
            border: 'border-purple-500/30',
            stats: [
                { label: 'Classes', value: stats.classes },
                { label: 'Hierarchy Links', value: stats.hierarchyEdges }
            ],
            status: stats.classes > 0 ? 'active' : 'pending',
            actions: [
                { label: 'Catalog', onClick: () => onNavigate('entities'), icon: List },
                { label: 'Visual Design', onClick: () => onNavigate('design'), icon: Layers },
                { label: 'Add Class', onClick: onCreateClass, icon: Plus, primary: true }
            ]
        },
        {
            id: 'properties',
            title: 'Characterization',
            subtitle: 'Define relationships and attributes.',
            icon: ArrowRightLeft,
            color: 'text-blue-400',
            bg: 'bg-blue-900/20',
            border: 'border-blue-500/30',
            stats: [
                { label: 'Object Properties', value: stats.objProps },
                { label: 'Data Properties', value: stats.dataProps }
            ],
            status: (stats.objProps > 0 || stats.dataProps > 0) ? 'active' : 'pending',
            actions: [
                { label: 'Manage Properties', onClick: () => onNavigate('entities'), icon: ArrowRightLeft }
            ]
        },
        {
            id: 'axioms',
            title: 'Formalization',
            subtitle: 'Add logical restrictions and rules.',
            icon: BookOpen,
            color: 'text-indigo-400',
            bg: 'bg-indigo-900/20',
            border: 'border-indigo-500/30',
            stats: [
                { label: 'Axioms & Restrictions', value: stats.restrictions }
            ],
            status: stats.restrictions > 0 ? 'active' : 'pending',
            actions: [
                { label: 'Edit Axioms', onClick: () => onNavigate('entities'), icon: Activity },
                { label: 'View Logic', onClick: () => onNavigate('peirce'), icon: Brain }
            ]
        },
        {
            id: 'instances',
            title: 'Instantiation',
            subtitle: 'Populate the ontology with data (ABox).',
            icon: User,
            color: 'text-pink-400',
            bg: 'bg-pink-900/20',
            border: 'border-pink-500/30',
            stats: [
                { label: 'Named Individuals', value: stats.individuals }
            ],
            status: stats.individuals > 0 ? 'active' : 'pending',
            actions: [
                { label: 'Add Individuals', onClick: () => onNavigate('graph'), icon: User }
            ]
        },
        {
            id: 'verification',
            title: 'Verification',
            subtitle: 'Check consistency and infer knowledge.',
            icon: ShieldCheck,
            color: isReasonerActive ? 'text-emerald-400' : 'text-amber-400',
            bg: isReasonerActive ? 'bg-emerald-900/20' : 'bg-amber-900/20',
            border: isReasonerActive ? 'border-emerald-500/30' : 'border-amber-500/30',
            stats: [
                { label: 'Reasoner', value: isReasonerActive ? 'Active' : 'Inactive' },
                { label: 'Consistency', value: validationStatus === 'valid' ? 'Pass' : (validationStatus === 'invalid' ? 'Fail' : 'Unknown') }
            ],
            status: isReasonerActive ? 'active' : 'pending',
            actions: [
                { label: isReasonerActive ? 'Reset Reasoner' : 'Run Reasoner', onClick: onRunReasoner, icon: Play, primary: !isReasonerActive },
                { label: 'Validate', onClick: onValidate, icon: CheckCircle2 }
            ]
        },
        {
            id: 'publication',
            title: 'Publication',
            subtitle: 'Serialize and export the ontology.',
            icon: Share2,
            color: 'text-slate-400',
            bg: 'bg-slate-800/50',
            border: 'border-slate-700',
            stats: [],
            status: 'pending', // Always available
            actions: [
                { label: 'Export Data', onClick: onExport, icon: Download, primary: true }
            ]
        }
    ];

    return (
        <div className="h-full bg-slate-950 overflow-y-auto p-8 flex flex-col items-center">
            <div className="max-w-4xl w-full">
                
                <div className="mb-10 text-center">
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-3">
                        <GitBranch size={32} className="text-blue-500" />
                        Ontology Engineering Workflow
                    </h1>
                    <p className="text-slate-400">
                        A structured approach to building semantic models. Follow the steps below to create a robust OWL 2 ontology.
                    </p>
                </div>

                <div className="relative">
                    {/* Vertical Connecting Line */}
                    <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-slate-800" />

                    <div className="space-y-8 relative">
                        {steps.map((step, idx) => (
                            <div key={step.id} className="flex gap-6 group">
                                {/* Timeline Node */}
                                <div className={`relative z-10 w-16 h-16 rounded-2xl border-4 flex items-center justify-center shrink-0 shadow-xl transition-all duration-300 ${step.status === 'active' ? 'bg-slate-900 border-blue-500' : 'bg-slate-900 border-slate-700 grayscale'}`}>
                                    <step.icon size={28} className={step.color} />
                                    {step.status === 'active' && (
                                        <div className="absolute -bottom-2 -right-2 bg-blue-500 rounded-full p-1 border-2 border-slate-900">
                                            <CheckCircle2 size={12} className="text-white" />
                                        </div>
                                    )}
                                </div>

                                {/* Content Card */}
                                <div className={`flex-1 rounded-xl border p-5 transition-all duration-300 ${step.bg} ${step.border} hover:border-opacity-100 border-opacity-50 hover:shadow-lg`}>
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Step {idx + 1}</span>
                                                {step.id === 'verification' && validationStatus === 'invalid' && (
                                                    <span className="text-[10px] font-bold text-red-400 bg-red-900/30 px-2 rounded-full flex items-center gap-1">
                                                        <AlertTriangle size={10} /> Issues Detected
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className={`text-xl font-bold ${step.color} mb-1`}>{step.title}</h3>
                                            <p className="text-sm text-slate-400 mb-4">{step.subtitle}</p>
                                            
                                            {/* Stats Grid */}
                                            {step.stats.length > 0 && (
                                                <div className="flex flex-wrap gap-3 mb-4">
                                                    {step.stats.map((stat, i) => (
                                                        <div key={i} className="bg-slate-900/50 border border-slate-700/50 rounded px-3 py-1.5 flex flex-col">
                                                            <span className="text-[10px] text-slate-500 uppercase">{stat.label}</span>
                                                            <span className="text-sm font-mono font-bold text-slate-200">{stat.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-row md:flex-col gap-2 shrink-0">
                                            {step.actions.map((action, i) => (
                                                <button
                                                    key={i}
                                                    onClick={action.onClick}
                                                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                                        action.primary 
                                                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md hover:shadow-blue-500/20' 
                                                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
                                                    }`}
                                                >
                                                    {action.icon && <action.icon size={14} />}
                                                    {action.label}
                                                    {!action.primary && <ChevronRight size={12} className="opacity-50" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-12 text-center text-xs text-slate-600 border-t border-slate-800 pt-6">
                    <p>OWL 2 Web Ontology Language • Methodology based on METHONTOLOGY & NeOn</p>
                </div>
            </div>
        </div>
    );
};

export default WorkflowView;
