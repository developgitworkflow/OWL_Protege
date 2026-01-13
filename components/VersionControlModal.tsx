
import React, { useState } from 'react';
import { X, GitCommit, GitBranch, RotateCcw, Clock, Plus } from 'lucide-react';
import { Repository, Snapshot, ProjectData, UMLNodeData } from '../types';
import { Node, Edge } from 'reactflow';
import { commitToRepository } from '../services/versionControlService';

interface VersionControlModalProps {
    isOpen: boolean;
    onClose: () => void;
    repository: Repository;
    onUpdateRepository: (repo: Repository) => void;
    currentSnapshot: { nodes: Node<UMLNodeData>[], edges: Edge[], metadata: ProjectData };
    onRestoreSnapshot: (snapshot: Snapshot) => void;
}

const VersionControlModal: React.FC<VersionControlModalProps> = ({ 
    isOpen, onClose, repository, onUpdateRepository, currentSnapshot, onRestoreSnapshot 
}) => {
    const [commitMsg, setCommitMsg] = useState('');
    
    if (!isOpen) return null;

    const handleCommit = () => {
        if (!commitMsg.trim()) return;
        const newRepo = commitToRepository(
            repository, 
            currentSnapshot.nodes, 
            currentSnapshot.edges, 
            currentSnapshot.metadata, 
            commitMsg
        );
        onUpdateRepository(newRepo);
        setCommitMsg('');
    };

    const history = repository.branches[repository.currentBranch] || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-slate-900 rounded-xl shadow-2xl border border-slate-800 flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <GitBranch className="text-green-400" />
                        <h2 className="text-lg font-bold text-slate-100">Version Control</h2>
                        <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full border border-slate-700 font-mono">
                            {repository.currentBranch}
                        </span>
                    </div>
                    <button onClick={onClose}><X className="text-slate-500 hover:text-white" /></button>
                </div>

                <div className="p-4 border-b border-slate-800 bg-slate-950/50">
                    <div className="flex gap-2">
                        <input 
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                            placeholder="Commit message..."
                            value={commitMsg}
                            onChange={(e) => setCommitMsg(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCommit()}
                        />
                        <button 
                            onClick={handleCommit}
                            disabled={!commitMsg.trim()}
                            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2"
                        >
                            <Plus size={16} /> Commit
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {history.length > 0 ? history.map((snap) => (
                        <div key={snap.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex justify-between items-start group hover:border-blue-500/50 transition-colors">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <GitCommit size={16} className="text-slate-400" />
                                    <span className="font-bold text-slate-200">{snap.message}</span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                    <span className="font-mono">{snap.id.split('-')[1]}</span>
                                    <span className="flex items-center gap-1"><Clock size={10} /> {new Date(snap.timestamp).toLocaleString()}</span>
                                    <span>{snap.nodes.length} nodes, {snap.edges.length} edges</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => { onRestoreSnapshot(snap); onClose(); }}
                                className="bg-slate-900 hover:bg-blue-600 text-slate-400 hover:text-white px-3 py-1.5 rounded text-xs font-medium border border-slate-700 transition-colors flex items-center gap-2"
                            >
                                <RotateCcw size={12} /> Restore
                            </button>
                        </div>
                    )) : (
                        <div className="text-center text-slate-500 py-8">No commits yet.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VersionControlModal;
