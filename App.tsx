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
import CreateProjectModal from './components/CreateProjectModal';
import SettingsModal from './components/SettingsModal';
import ValidationModal from './components/ValidationModal';
import { INITIAL_NODES, INITIAL_EDGES } from './constants';
import { ElementType, UMLNodeData, ProjectData } from './types';
import { generateTurtle } from './services/owlMapper';
import { validateOntology, ValidationResult } from './services/validatorService';
import { normalizeOntology } from './services/normalizationService';
import { parseFunctionalSyntax } from './services/functionalSyntaxParser';

// Must be defined outside component to avoid re-creation
const nodeTypes = {
  umlNode: UMLNode,
};

const Flow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const [projectMetadata, setProjectMetadata] = useState<ProjectData>({ 
      name: 'Untitled Project',
      baseIri: 'http://example.org/ontology#',
      defaultPrefix: 'ex'
  });

  const onConnect = useCallback((params: Connection) => {
      setEdges((eds) => addEdge({ ...params, type: 'smoothstep', label: 'use', style: { stroke: '#94a3b8' }, labelStyle: { fill: '#cbd5e1' } }, eds));
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
      const normalizedNodes = normalizeOntology(newNodes);
      setNodes(normalizedNodes);
      setEdges(newEdges.map(e => ({ ...e, style: { stroke: '#94a3b8' }, labelStyle: { fill: '#cbd5e1' } })));
  }, [setNodes, setEdges]);

  const handleSaveJSON = () => {
      const data = JSON.stringify({ metadata: projectMetadata, nodes, edges });
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectMetadata.name.replace(/\s+/g, '_') || 'diagram'}.json`;
      link.click();
  };

  const handleSaveTurtle = () => {
      const turtle = generateTurtle(nodes, edges, projectMetadata);
      const blob = new Blob([turtle], { type: 'text/turtle' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectMetadata.name.replace(/\s+/g, '_') || 'ontology'}.ttl`;
      link.click();
  };

  const handleLoadContent = (content: string, fileName: string) => {
      try {
          // 1. Try JSON Project Format
          try {
              const flow = JSON.parse(content);
              if (flow.nodes && flow.edges) {
                  const normalizedNodes = normalizeOntology(flow.nodes);
                  setNodes(normalizedNodes);
                  setEdges(flow.edges);
                  if (flow.metadata) setProjectMetadata(flow.metadata);
                  return;
              }
          } catch (e) {
              // Not valid JSON, continue to parser
          }

          // 2. Try OWL Functional Syntax
          if (content.includes('Ontology') || content.includes('Declaration') || fileName.endsWith('.ofn') || fileName.endsWith('.owl')) {
              const result = parseFunctionalSyntax(content);
              if (result.nodes.length > 0) {
                  const normalizedNodes = normalizeOntology(result.nodes);
                  setNodes(normalizedNodes);
                  setEdges(result.edges);
                  setProjectMetadata(prev => ({ ...prev, ...result.metadata }));
                  return;
              }
          }

          throw new Error("Unknown format");
      } catch (err) {
          console.error("Failed to load file", err);
          alert("Invalid file format. Supported: JSON (Project) or OWL Functional Syntax.");
      }
  };

  const handleLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
              const content = e.target?.result as string;
              handleLoadContent(content, file.name);
          };
          reader.readAsText(file);
      }
      event.target.value = '';
  };

  const handleCreateProject = (data: ProjectData) => {
    setProjectMetadata({
        ...data,
        baseIri: data.baseIri || 'http://example.org/ontology#',
        defaultPrefix: data.defaultPrefix || 'ex'
    });
    
    if (data.file) {
      const reader = new FileReader();
      reader.onload = (e) => {
          const content = e.target?.result as string;
          handleLoadContent(content, data.file?.name || '');
      };
      reader.readAsText(data.file);
    } else {
      // Start fresh
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
    }
    setIsCreateModalOpen(false);
  };

  const handleValidate = () => {
      const result = validateOntology(nodes, edges);
      setValidationResult(result);
      setIsValidationModalOpen(true);
  };

  const selectedNode = useMemo(() => {
      return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-200 font-sans">
      <TopBar 
        onSaveJSON={handleSaveJSON} 
        onSaveTurtle={handleSaveTurtle}
        onLoad={handleLoad} 
        onNewProject={() => setIsCreateModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onValidate={handleValidate}
      />
      
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
            className="bg-slate-950"
          >
            <Background color="#334155" gap={16} size={1} />
            <Controls className="!bg-slate-800 !border-slate-700 !shadow-sm !rounded-md [&>button]:!fill-slate-400 [&>button:hover]:!bg-slate-700" />
            <MiniMap 
                nodeColor={(n) => {
                    if (n.type === 'umlNode') return '#6366f1';
                    return '#334155';
                }}
                className="!bg-slate-800 !border-slate-700 !shadow-sm !rounded-md"
                maskColor="rgba(15, 23, 42, 0.6)"
            />
            <Panel position="top-right" className="bg-slate-800/80 backdrop-blur-sm p-2 rounded text-xs text-slate-400 border border-slate-700/50">
                {projectMetadata.name} • {projectMetadata.defaultPrefix || 'ex'}
            </Panel>
            <Panel position="bottom-left" className="bg-slate-800/80 backdrop-blur-sm p-2 rounded text-xs text-slate-400 ml-12 border border-slate-700/50">
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

      <CreateProjectModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateProject}
      />

      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        projectData={projectMetadata}
        onUpdateProjectData={setProjectMetadata}
        onExportJSON={handleSaveJSON}
        onExportTurtle={handleSaveTurtle}
        onImportJSON={handleLoad}
      />

      <ValidationModal 
        isOpen={isValidationModalOpen}
        onClose={() => setIsValidationModalOpen(false)}
        result={validationResult}
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