
import React, { useState, useMemo } from 'react';
import { X, GitBranch, GitCommit, GitPullRequest, History, Save, RotateCcw, Plus, ArrowRight, Check, AlertCircle, Play, UploadCloud, DownloadCloud, Tag, FileDiff, Box } from 'lucide-react';
import { Repository, Commit, CommitType, Snapshot, UMLNodeData } from '../types';
import { createCommit, createBranch, checkoutBranch, mergeBranch } from '../services/versionControlService';
import { Node, Edge } from 'reactflow';

interface VersionControlModalProps {
    isOpen: boolean;
    onClose: () => void;
    repository: Repository;
    onUpdateRepository: (repo: Repository) => void;
    currentSnapshot: Snapshot;
    onRestoreSnapshot: (snapshot: Snapshot) => void;
}

const COMMIT_TYPES: { type: CommitType, label: string, color: string }[] = [
    { type: 'feat', label: 'Feature', color: 'text-green-400 bg-green-900/30 border-green-800' },
    { type: 'fix', label: 'Fix', color: 'text-red-400 bg-red-900/30 border-red-800' },
    { type: 'docs', label: 'Docs', color: 'text-blue-400 bg-blue-900/30 border-blue-800' },
    { type: 'style', label: 'Style', color: 'text-pink-400 bg-pink-900/30 border-pink-800' },
    { type: 'refactor', label: 'Refactor', color: 'text-amber-400 bg-amber-900/30 border-amber-800' },
    { type: 'chore', label: 'Chore', color: 'text-slate-400 bg-slate-800 border-slate-700' },
];

const VersionControlModal: React.FC<VersionControlModalProps> = ({ 
    isOpen, 
    onClose, 
    repository, 
    onUpdateRepository, 
    currentSnapshot,
    onRestoreSnapshot
}) => {
    const [activeTab, setActiveTab] = useState<'commit' | 'history' | 'branches' | 'remote'>('commit');
    
    // Commit State
    const [commitType, setCommitType] = useState<CommitType>('feat');
    const [scope, setScope] = useState('');
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    
    // Branch State
    const [newBranchName, setNewBranchName] = useState('');
    
    // PR State
    const [prSource, setPrSource] = useState('');
    const [prTarget, setPrTarget] = useState('main');

    if (!isOpen) return null;

    // --- Helpers ---
    const currentHeadHash = repository.branches[repository.currentBranch]?.headCommitHash;
    const currentHeadCommit = currentHeadHash ? repository.commits[currentHeadHash] : null;

    // Derive changes stats (Current Canvas vs HEAD)
    const statsDiff = useMemo(() => {
        if (!currentHeadCommit) return { nodes: 0, edges: 0, axioms: 0 };
        const currentAxioms = currentSnapshot.nodes.reduce((acc, n) => acc + (n.data.methods?.length || 0), 0);
        return {
            nodes: currentSnapshot.nodes.length - currentHeadCommit.stats.nodesCount,
            edges: currentSnapshot.edges.length - currentHeadCommit.stats.edgesCount,
            axioms: currentAxioms - currentHeadCommit.stats.axiomsCount
        };
    }, [currentSnapshot, currentHeadCommit]);

    // Build History Array (linked list traversal)
    const history = useMemo(() => {
        const list: Commit[] = [];
        let curr = currentHeadHash;
        while (curr) {
            const commit = repository.commits[curr];
            if (commit) {
                list.push(commit);
                curr = commit.parentId;
            } else {
                break;
            }
        }
        return list;
    }, [repository, currentHeadHash]);

    // --- Actions ---

    const handleCommit = () => {
        if (!subject.trim()) return;
        const newRepo = createCommit(repository, currentSnapshot, {
            type: commitType,
            scope: scope.trim(),
            subject: subject.trim(),
            description: description.trim()
        });
        onUpdateRepository(newRepo);
        // Reset form
        setSubject('');
        setDescription('');
        setActiveTab('history');
    };

    const handleCreateBranch = () => {
        if (!newBranchName.trim()) return;
        try {
            const newRepo = createBranch(repository, newBranchName.trim());
            onUpdateRepository(newRepo);
            setNewBranchName('');
        } catch (e) {
            alert((e as Error).message);
        }
    };

    const handleCheckout = (branchName: string) => {
        const { repo, snapshot } = checkoutBranch(repository, branchName);
        onUpdateRepository(repo);
        if (snapshot) onRestoreSnapshot(snapshot);
    };

    const handleRestoreCommit = (commit: Commit) => {
        // "Detached HEAD" state logic could go here, but for simplicity
        // we just restore the canvas. User must commit to a branch to save this state properly.
        onRestoreSnapshot(commit.snapshot);
        onClose();
    };

    const handleMerge = () => {
        if (prSource === prTarget) return;
        try {
            const { repo, mergedSnapshot } = mergeBranch(repository, prSource, prTarget);
            onUpdateRepository(repo);
            onRestoreSnapshot(mergedSnapshot);
            setActiveTab('history');
        } catch (e) {
            alert("Merge failed.");
        }
    };

    // --- Renderers ---

    const getTypeBadge = (type: string) => {
        const conf = COMMIT_TYPES.find(c => c.type === type) || COMMIT_TYPES[5];
        return (
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${conf.color}`}>
                {conf.type}
            </span>
        );
    };

    const renderDiffStat = (val: number, label: string) => {
        if (val === 0) return null;
        const color = val > 0 ? 'text-green-400' : 'text-red-400';
        const sign = val > 0 ? '+' : '';
        return <span className={`text-xs font-mono ${color}`}>{sign}{val} {label}</span>;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
            
            <div className="relative w-full max-w-5xl bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-700 flex flex-col h-[85vh] overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-blue-400">
                            <GitBranch size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                                Version Control
                                <span className="text-xs font-mono font-normal text-slate-500 px-2 py-0.5 bg-slate-800 rounded-full border border-slate-700 flex items-center gap-1">
                                    <GitBranch size={10} /> {repository.currentBranch}
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400">Manage ontology versions, branches, and merges.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-2 rounded-full transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Sidebar + Content */}
                <div className="flex flex-1 overflow-hidden">
                    
                    {/* Tabs */}
                    <div className="w-48 border-r border-slate-800 bg-slate-950/50 p-2 flex flex-col gap-1">
                        <button onClick={() => setActiveTab('commit')} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'commit' ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                            <GitCommit size={16} /> Changes
                        </button>
                        <button onClick={() => setActiveTab('history')} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                            <History size={16} /> History
                        </button>
                        <button onClick={() => setActiveTab('branches')} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'branches' ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                            <GitBranch size={16} /> Branches
                        </button>
                        <button onClick={() => setActiveTab('remote')} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'remote' ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                            <GitPullRequest size={16} /> Pull Request
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 bg-slate-900 p-6 overflow-y-auto">
                        
                        {/* --- COMMIT TAB --- */}
                        {activeTab === 'commit' && (
                            <div className="space-y-6 max-w-2xl mx-auto">
                                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-300 mb-1 flex items-center gap-2"><FileDiff size={16} /> Unstaged Changes</h3>
                                        <div className="flex gap-4 text-xs text-slate-500">
                                            {renderDiffStat(statsDiff.nodes, 'Nodes') || <span className="text-slate-600">0 Nodes changed</span>}
                                            {renderDiffStat(statsDiff.edges, 'Edges')}
                                            {renderDiffStat(statsDiff.axioms, 'Axioms')}
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500 font-mono">
                                        Parent: <span className="text-blue-400">{currentHeadCommit?.shortHash || 'None'}</span>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                                            <select 
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                                                value={commitType}
                                                onChange={(e) => setCommitType(e.target.value as CommitType)}
                                            >
                                                {COMMIT_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-span-2 space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Scope (Optional)</label>
                                            <input 
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500 placeholder-slate-600"
                                                placeholder="e.g. users, ontology-header"
                                                value={scope}
                                                onChange={(e) => setScope(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Subject</label>
                                        <input 
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500 placeholder-slate-600"
                                            placeholder="Short description of the change"
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Description (Optional)</label>
                                        <textarea 
                                            className="w-full h-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500 placeholder-slate-600 resize-none"
                                            placeholder="Longer explanation of the changes..."
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                        />
                                    </div>

                                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-400">
                                        <span className="text-slate-600">Preview: </span>
                                        <span className={COMMIT_TYPES.find(c => c.type === commitType)?.color.split(' ')[0]}>{commitType}</span>
                                        {scope && <span className="text-slate-300">({scope})</span>}
                                        <span className="text-slate-200">: {subject || '<subject>'}</span>
                                    </div>

                                    <button 
                                        onClick={handleCommit}
                                        disabled={!subject}
                                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2"
                                    >
                                        <Check size={16} /> Commit Changes
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* --- HISTORY TAB --- */}
                        {activeTab === 'history' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                                    <h3 className="text-sm font-bold text-slate-300">Commit History ({repository.currentBranch})</h3>
                                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-full">{history.length} commits</span>
                                </div>
                                <div className="space-y-0 relative">
                                    {/* Timeline Line */}
                                    <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-800 z-0"></div>

                                    {history.map((commit, idx) => (
                                        <div key={commit.hash} className="relative z-10 flex gap-4 p-3 hover:bg-slate-800/50 rounded-lg group transition-colors">
                                            <div className={`w-10 h-10 rounded-full border-4 border-slate-900 flex items-center justify-center shrink-0 ${idx === 0 ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                                <GitCommit size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {getTypeBadge(commit.type)}
                                                    <span className="font-mono text-xs text-blue-400 cursor-pointer hover:underline" title={commit.hash}>{commit.shortHash}</span>
                                                    <span className="text-xs text-slate-500">• {new Date(commit.timestamp).toLocaleTimeString()}</span>
                                                    {idx === 0 && <span className="text-[10px] bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded border border-blue-800">HEAD</span>}
                                                </div>
                                                <div className="text-sm font-medium text-slate-200 truncate">{commit.message}</div>
                                                {commit.description && <div className="text-xs text-slate-500 mt-1 line-clamp-1">{commit.description}</div>}
                                                
                                                {/* Stats */}
                                                <div className="flex gap-3 mt-2 text-[10px] text-slate-500 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <span>{commit.stats.nodesCount} Nodes</span>
                                                    <span>{commit.stats.edgesCount} Edges</span>
                                                    <span>{commit.stats.axiomsCount} Axioms</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleRestoreCommit(commit)}
                                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded text-xs font-medium flex items-center gap-2 transition-colors"
                                                >
                                                    <RotateCcw size={12} /> Restore
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* --- BRANCHES TAB --- */}
                        {activeTab === 'branches' && (
                            <div className="space-y-6 max-w-2xl mx-auto">
                                <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Create Branch</h4>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg flex items-center px-3">
                                            <GitBranch size={14} className="text-slate-500 mr-2" />
                                            <input 
                                                className="bg-transparent py-2 text-sm text-slate-200 outline-none w-full placeholder-slate-600"
                                                placeholder="New branch name (e.g. feature/login)"
                                                value={newBranchName}
                                                onChange={(e) => setNewBranchName(e.target.value)}
                                            />
                                        </div>
                                        <button 
                                            onClick={handleCreateBranch}
                                            className="px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-colors"
                                        >
                                            Create
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Available Branches</h4>
                                    <div className="space-y-2">
                                        {Object.values(repository.branches).map(branch => (
                                            <div key={branch.name} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${branch.name === repository.currentBranch ? 'bg-blue-900/10 border-blue-800' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1.5 rounded-md ${branch.name === repository.currentBranch ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                                        <GitBranch size={16} />
                                                    </div>
                                                    <div>
                                                        <div className={`font-bold text-sm ${branch.name === repository.currentBranch ? 'text-blue-400' : 'text-slate-300'}`}>
                                                            {branch.name}
                                                        </div>
                                                        <div className="text-xs text-slate-500 font-mono">
                                                            Head: {branch.headCommitHash?.substring(0, 7) || 'Empty'}
                                                        </div>
                                                    </div>
                                                </div>
                                                {branch.name !== repository.currentBranch && (
                                                    <button 
                                                        onClick={() => handleCheckout(branch.name)}
                                                        className="text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 hover:bg-slate-800 rounded transition-colors"
                                                    >
                                                        Checkout
                                                    </button>
                                                )}
                                                {branch.name === repository.currentBranch && (
                                                    <span className="text-[10px] uppercase font-bold text-blue-500 px-2">Current</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- REMOTE / PR TAB --- */}
                        {activeTab === 'remote' && (
                            <div className="space-y-6 max-w-2xl mx-auto">
                                <div className="text-center py-6">
                                    <div className="inline-flex p-3 rounded-full bg-slate-800 mb-4 text-slate-400">
                                        <UploadCloud size={32} />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-200">Remote Repository</h3>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Simulate interaction with a remote Git server (e.g. GitHub/GitLab).
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <button className="flex flex-col items-center gap-2 p-4 bg-slate-950 border border-slate-800 hover:border-blue-500/50 rounded-xl transition-all group">
                                        <UploadCloud size={24} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
                                        <span className="font-bold text-slate-300">Push Origin</span>
                                    </button>
                                    <button className="flex flex-col items-center gap-2 p-4 bg-slate-950 border border-slate-800 hover:border-emerald-500/50 rounded-xl transition-all group">
                                        <DownloadCloud size={24} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
                                        <span className="font-bold text-slate-300">Pull Origin</span>
                                    </button>
                                </div>

                                <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-5">
                                    <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                        <GitPullRequest size={16} className="text-purple-400" /> Create Pull Request
                                    </h4>
                                    
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 flex items-center justify-between">
                                            <span className="text-xs text-slate-500 ml-2">Source</span>
                                            <select 
                                                className="bg-transparent text-sm font-bold text-slate-200 outline-none text-right"
                                                value={prSource}
                                                onChange={(e) => setPrSource(e.target.value)}
                                            >
                                                <option value="">Select Branch</option>
                                                {Object.keys(repository.branches).filter(b => b !== prTarget).map(b => (
                                                    <option key={b} value={b}>{b}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <ArrowRight size={16} className="text-slate-600" />
                                        <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 flex items-center justify-between">
                                            <span className="text-xs text-slate-500 ml-2">Target</span>
                                            <select 
                                                className="bg-transparent text-sm font-bold text-slate-200 outline-none text-right"
                                                value={prTarget}
                                                onChange={(e) => setPrTarget(e.target.value)}
                                            >
                                                {Object.keys(repository.branches).map(b => (
                                                    <option key={b} value={b}>{b}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {prSource && prTarget && (
                                        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                                                    <Check size={12} /> Able to merge
                                                </span>
                                                <span className="text-xs text-slate-500">Fast-forward simulation</span>
                                            </div>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                Merging <strong>{prSource}</strong> into <strong>{prTarget}</strong> will update the ontology graph with changes from the source branch.
                                            </p>
                                        </div>
                                    )}

                                    <button 
                                        onClick={handleMerge}
                                        disabled={!prSource || !prTarget || prSource === prTarget}
                                        className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm shadow-lg transition-all"
                                    >
                                        Merge Pull Request
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default VersionControlModal;
