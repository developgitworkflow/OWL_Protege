
import { Node, Edge } from 'reactflow';
import { ProjectData, Repository, Snapshot, UMLNodeData } from '../types';

export const createSnapshot = (
    nodes: Node<UMLNodeData>[], 
    edges: Edge[], 
    metadata: ProjectData, 
    message: string
): Snapshot => {
    return {
        id: `snap-${Date.now()}`,
        timestamp: Date.now(),
        message,
        nodes: JSON.parse(JSON.stringify(nodes)), // Deep copy
        edges: JSON.parse(JSON.stringify(edges)),
        metadata: JSON.parse(JSON.stringify(metadata))
    };
};

export const initRepository = (initialState: { nodes: Node<UMLNodeData>[], edges: Edge[], metadata: ProjectData }): Repository => {
    const initialSnapshot = createSnapshot(initialState.nodes, initialState.edges, initialState.metadata, "Initial Commit");
    return {
        currentBranch: 'main',
        branches: {
            'main': [initialSnapshot]
        }
    };
};

export const commitToRepository = (
    repo: Repository, 
    nodes: Node<UMLNodeData>[], 
    edges: Edge[], 
    metadata: ProjectData, 
    message: string
): Repository => {
    const snapshot = createSnapshot(nodes, edges, metadata, message);
    const branch = repo.branches[repo.currentBranch] || [];
    
    return {
        ...repo,
        branches: {
            ...repo.branches,
            [repo.currentBranch]: [snapshot, ...branch] // Newest first
        }
    };
};
