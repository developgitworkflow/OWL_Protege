
import React, { useEffect, useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  ConnectionMode,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  Position
} from 'reactflow';
import dagre from 'dagre';
import { UMLNodeData, ElementType } from '../types';
import ProfessionalNode from './ProfessionalNode';
import { Download, Layout } from 'lucide-react';

interface UMLVisualizationProps {
    nodes: Node<UMLNodeData>[];
    edges: Edge[];
    searchTerm?: string;
    onNavigate?: (view: string, id: string) => void;
}

const nodeTypes = {
  professional: ProfessionalNode,
};

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 300; // Width of ProfessionalNode + spacing
  const nodeHeight = 220; // Estimated height with new relations section

  dagreGraph.setGraph({ rankdir: direction, ranksep: 100, nodesep: 60 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    return {
      ...node,
      targetPosition: direction === 'LR' ? Position.Left : Position.Top,
      sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

const UMLCanvas: React.FC<UMLVisualizationProps> = ({ nodes, edges, searchTerm, onNavigate }) => {
    const { fitView } = useReactFlow();
    const [layoutNodes, setLayoutNodes, onNodesChange] = useNodesState([]);
    const [layoutEdges, setLayoutEdges, onEdgesChange] = useEdgesState([]);

    // Transform and Layout
    useEffect(() => {
        // 1. Transform Nodes to Professional Type and Inject Relations
        const transformedNodes = nodes.map(n => {
            // Find outgoing edges for this node
            const outgoing = edges.filter(e => e.source === n.id).map(e => {
                const targetNode = nodes.find(tn => tn.id === e.target);
                let relLabel = (e.label as string) || '';
                
                // Format label for display
                if (relLabel === 'subClassOf' || relLabel === 'rdfs:subClassOf') relLabel = 'subClassOf';
                else if (relLabel === 'rdf:type' || relLabel === 'a') relLabel = 'type';
                else relLabel = relLabel.replace('owl:', '').replace(':', '');

                return {
                    label: relLabel,
                    targetLabel: targetNode?.data.label || 'Unknown',
                    type: relLabel
                };
            });

            return {
                ...n,
                type: 'professional',
                data: { 
                    ...n.data, 
                    isSearchMatch: searchTerm ? n.data.label.toLowerCase().includes(searchTerm.toLowerCase()) : false,
                    relations: outgoing // Inject relations here
                }
            };
        });

        // 2. Transform Edges to Professional Style with Custom Markers
        const transformedEdges = edges.map(e => {
            const label = (e.label as string) || '';
            const isSubClass = label === 'subClassOf' || label === 'rdfs:subClassOf';
            const isType = label === 'rdf:type' || label === 'a';
            
            return {
                ...e,
                type: 'smoothstep',
                animated: false,
                style: { 
                    stroke: isSubClass ? '#6366f1' : (isType ? '#14b8a6' : '#64748b'), 
                    strokeWidth: 2,
                    strokeDasharray: isType ? '5,5' : 'none'
                },
                labelStyle: { fill: '#94a3b8', fontWeight: 600, fontSize: 11 },
                labelBgStyle: { fill: '#020617', opacity: 0.8 },
                labelBgPadding: [4, 4] as [number, number],
                labelBgBorderRadius: 4,
                markerEnd: isSubClass ? 'url(#uml-triangle)' : 'url(#uml-arrow)'
            };
        });

        // 3. Compute Layout
        const { nodes: lNodes, edges: lEdges } = getLayoutedElements(transformedNodes, transformedEdges);
        
        setLayoutNodes(lNodes);
        setLayoutEdges(lEdges);

        // Fit view after a brief delay
        setTimeout(() => fitView({ padding: 0.2 }), 50);

    }, [nodes, edges, searchTerm, fitView, setLayoutNodes, setLayoutEdges]);

    const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        if (onNavigate) {
            onNavigate('uml', node.id);
        }
    }, [onNavigate]);

    return (
        <ReactFlow
            nodes={layoutNodes}
            edges={layoutEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            connectionMode={ConnectionMode.Loose}
            minZoom={0.1}
            nodesDraggable={true}
            nodesConnectable={false}
            fitView
            className="bg-slate-950"
        >
            {/* Custom SVG Definitions for UML Arrows */}
            <svg>
                <defs>
                    <marker id="uml-triangle" markerWidth="12" markerHeight="12" viewBox="0 0 12 12" refX="12" refY="6" orient="auto">
                        <path d="M0,0 L0,12 L12,6 z" fill="#020617" stroke="#6366f1" strokeWidth="1.5" />
                    </marker>
                    <marker id="uml-arrow" markerWidth="10" markerHeight="10" viewBox="0 0 10 10" refX="10" refY="5" orient="auto">
                        <path d="M0,0 L0,10 L10,5 z" fill="#64748b" />
                    </marker>
                </defs>
            </svg>

            <Background color="#1e293b" gap={20} size={1} />
            <Controls className="bg-slate-800 border-slate-700 fill-slate-400" />
            <MiniMap 
                nodeColor={(n) => {
                    switch(n.data.type) {
                        case ElementType.OWL_CLASS: return '#6366f1';
                        case ElementType.OWL_NAMED_INDIVIDUAL: return '#14b8a6';
                        default: return '#64748b';
                    }
                }}
                className="bg-slate-900 border-slate-800 rounded-lg overflow-hidden" 
                maskColor="rgba(2, 6, 23, 0.7)"
            />
            
            <Panel position="top-right" className="flex gap-2">
                <div className="bg-slate-900/90 backdrop-blur border border-slate-700 p-2 rounded-lg shadow-xl text-xs text-slate-400 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Layout size={14} />
                        <span>Auto-Layout Active</span>
                    </div>
                    <div className="h-4 w-px bg-slate-700"></div>
                    <div className="flex gap-3">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-indigo-500"></div> Class
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-teal-500"></div> Individual
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-6 h-0.5 bg-indigo-500"></div> Is-A
                        </div>
                    </div>
                </div>
            </Panel>
        </ReactFlow>
    );
};

const UMLVisualization: React.FC<UMLVisualizationProps> = (props) => {
    return (
        <div className="w-full h-full bg-slate-950">
            <ReactFlowProvider>
                <UMLCanvas {...props} />
            </ReactFlowProvider>
        </div>
    );
};

export default UMLVisualization;
