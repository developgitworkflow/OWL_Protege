
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ProjectData, Repository, Commit, Snapshot, CommitType } from '../types';

// Simple non-cryptographic hash for simulation
const generateHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16) + Math.random().toString(16).substr(2, 8);
};

export const initRepository = (initialSnapshot: Snapshot): Repository => {
    const initHash = generateHash(JSON.stringify(initialSnapshot));
    const initCommit: Commit = {
        hash: initHash,
        shortHash: initHash.substring(0, 7),
        parentId: null,
        message: 'Initial commit',
        type: 'chore',
        scope: 'init',
        author: 'System',
        timestamp: Date.now(),
        snapshot: initialSnapshot,
        stats: {
            nodesCount: initialSnapshot.nodes.length,
            edgesCount: initialSnapshot.edges.length,
            axiomsCount: initialSnapshot.nodes.reduce((acc, n) => acc + (n.data.methods?.length || 0), 0)
        }
    };

    return {
        currentBranch: 'main',
        branches: {
            'main': { name: 'main', headCommitHash: initHash }
        },
        commits: {
            [initHash]: initCommit
        }
    };
};

export const createCommit = (
    repo: Repository, 
    snapshot: Snapshot, 
    messageData: { type: CommitType, scope?: string, subject: string, description?: string },
    author: string = 'User'
): Repository => {
    const parentHash = repo.branches[repo.currentBranch].headCommitHash;
    const contentString = JSON.stringify(snapshot);
    const hash = generateHash(contentString + parentHash + Date.now());
    
    // Format Conventional Commit Message
    // type(scope): subject
    const fullMessage = `${messageData.type}${messageData.scope ? `(${messageData.scope})` : ''}: ${messageData.subject}`;

    const newCommit: Commit = {
        hash,
        shortHash: hash.substring(0, 7),
        parentId: parentHash,
        message: fullMessage,
        description: messageData.description,
        type: messageData.type,
        scope: messageData.scope,
        author,
        timestamp: Date.now(),
        snapshot: JSON.parse(JSON.stringify(snapshot)), // Deep copy
        stats: {
            nodesCount: snapshot.nodes.length,
            edgesCount: snapshot.edges.length,
            axiomsCount: snapshot.nodes.reduce((acc, n) => acc + (n.data.methods?.length || 0), 0)
        }
    };

    return {
        ...repo,
        commits: {
            ...repo.commits,
            [hash]: newCommit
        },
        branches: {
            ...repo.branches,
            [repo.currentBranch]: {
                ...repo.branches[repo.currentBranch],
                headCommitHash: hash
            }
        }
    };
};

export const createBranch = (repo: Repository, newBranchName: string): Repository => {
    if (repo.branches[newBranchName]) {
        throw new Error(`Branch ${newBranchName} already exists.`);
    }
    const currentHead = repo.branches[repo.currentBranch].headCommitHash;
    
    return {
        ...repo,
        branches: {
            ...repo.branches,
            [newBranchName]: { name: newBranchName, headCommitHash: currentHead }
        },
        currentBranch: newBranchName
    };
};

export const checkoutBranch = (repo: Repository, branchName: string): { repo: Repository, snapshot: Snapshot | null } => {
    if (!repo.branches[branchName]) return { repo, snapshot: null };
    
    const headHash = repo.branches[branchName].headCommitHash;
    const snapshot = headHash ? repo.commits[headHash].snapshot : null;

    return {
        repo: { ...repo, currentBranch: branchName },
        snapshot
    };
};

export const mergeBranch = (repo: Repository, sourceBranch: string, targetBranch: string): { repo: Repository, mergedSnapshot: Snapshot } => {
    const sourceHeadHash = repo.branches[sourceBranch].headCommitHash;
    const targetHeadHash = repo.branches[targetBranch].headCommitHash;

    if (!sourceHeadHash || !targetHeadHash) throw new Error("Invalid branch heads");

    const sourceCommit = repo.commits[sourceHeadHash];
    
    // Simulate a Merge Commit
    // In a real system, this would do a 3-way diff. 
    // Here we assume "Source Overwrites Target" (Fast-forward simulation) 
    // but create a new commit object to represent the merge event.
    
    const mergeSnapshot = sourceCommit.snapshot;
    const hash = generateHash(`merge-${sourceBranch}-${targetBranch}-${Date.now()}`);
    
    const mergeCommit: Commit = {
        hash,
        shortHash: hash.substring(0, 7),
        parentId: targetHeadHash, // Parent is the previous head of target
        message: `merge: branch '${sourceBranch}' into '${targetBranch}'`,
        type: 'merge',
        author: 'System',
        timestamp: Date.now(),
        snapshot: mergeSnapshot,
        stats: sourceCommit.stats
    };

    return {
        repo: {
            ...repo,
            commits: { ...repo.commits, [hash]: mergeCommit },
            branches: {
                ...repo.branches,
                [targetBranch]: { ...repo.branches[targetBranch], headCommitHash: hash }
            },
            currentBranch: targetBranch // Auto-switch to target
        },
        mergedSnapshot: mergeSnapshot
    };
};
