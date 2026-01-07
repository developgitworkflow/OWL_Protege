import React, { useState, useCallback, useMemo } from 'react';
import ReactFlow, { 
  Node, 
  Edge, 
  Connection, 
  addEdge, 
  Background, 
  Controls, 
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Panel
} from 'reactflow';
import Sidebar from './components/Sidebar';
import PropertiesPanel from './components/PropertiesPanel';
import TopBar from './components/TopBar';
import UMLNode from './components/UMLNode';
import AIAssistant from './components/AIAssistant';
import { INITIAL_NODES, INITIAL_EDGES } from './constants';
import { ElementType, UMLNodeData } from './types';

// Must be defined outside component to avoid re-creation
const nodeTypes = {
  umlNode: UMLNode,
};

const Flow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const onConnect = useCallback((params: Connection) => {
      setEdges((eds) => addEdge({ ...params, type: 'smoothstep', label: 'use' }, eds));
  }, [setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const elementType = event.dataTransfer.getData('application/elementType');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      // Get drop position relative to window (simplified)
      // In a real app, use reactFlowInstance.project()
      const position = {
        x: event.clientX - 300, // Approximate offset for sidebar
        y: event.clientY - 100, // Approximate offset for header
      };

      const newNode: Node = {
        id: `node-${Date.now()}`,
        type,
        position,
        data: { 
            label: `New ${elementType}`, 
            type: elementType as ElementType,
            attributes: [],
            methods: []
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const updateNodeData = useCallback((id: string, newData: UMLNodeData) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: newData };
        }
        return node;
      })
    );
  }, [setNodes]);

  const deleteNode = useCallback((id: string) => {
      setNodes((nds) => nds.filter(n => n.id !== id));
      setEdges((eds) => eds.filter(e => e.source !== id && e.target !== id));
      setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  const onDiagramGenerated = useCallback((newNodes: Node[], newEdges: Edge[]) => {
      setNodes(newNodes);
      setEdges(newEdges);
  }, [setNodes, setEdges]);

  const handleSave = () => {
      const data = JSON.stringify({ nodes, edges });
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'diagram.json';
      link.click();
  };

  const handleLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
              try {
                  const content = e.target?.result as string;
                  const flow = JSON.parse(content);
                  if (flow.nodes && flow.edges) {
                      setNodes(flow.nodes);
                      setEdges(flow.edges);
                  }
              } catch (err) {
                  console.error("Failed to load file", err);
                  alert("Invalid file format");
              }
          };
          reader.readAsText(file);
      }
  };

  const selectedNode = useMemo(() => {
      return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 text-gray-900 font-sans">
      <TopBar onSave={handleSave} onLoad={handleLoad} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <div className="flex-1 h-full relative" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            className="bg-slate-50"
          >
            <Background color="#cbd5e1" gap={16} size={1} />
            <Controls className="!bg-white !border-gray-200 !shadow-sm !rounded-md" />
            <MiniMap 
                nodeColor={(n) => {
                    if (n.type === 'umlNode') return '#3b82f6';
                    return '#eee';
                }}
                className="!bg-white !border-gray-200 !shadow-sm !rounded-md" 
            />
            <Panel position="top-right" className="bg-white/80 backdrop-blur-sm p-2 rounded text-xs text-gray-500">
                Double-click canvas to deselect • Drag from sidebar to add
            </Panel>
          </ReactFlow>
        </div>

        {selectedNodeId && (
            <PropertiesPanel 
                selectedNode={selectedNode} 
                onUpdateNode={updateNodeData} 
                onDeleteNode={deleteNode}
            />
        )}
      </div>

      <AIAssistant 
        onDiagramGenerated={onDiagramGenerated} 
        currentNodes={nodes}
        currentEdges={edges}
      />
    </div>
  );
};

export default function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
