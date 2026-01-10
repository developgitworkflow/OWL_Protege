import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  Panel,
  BackgroundVariant,
  MarkerType
} from 'reactflow';
import Sidebar from './components/Sidebar';
import PropertiesPanel from './components/PropertiesPanel';
import TopBar from './components/TopBar';
import UMLNode from './components/UMLNode';
import AIAssistant from './components/AIAssistant';
import CreateProjectModal from './components/CreateProjectModal';
import SettingsModal from './components/SettingsModal';
import ValidationModal from './components/ValidationModal';
import DLQueryModal from './components/DLQueryModal';
import CodeViewer from './components/CodeViewer';
import GraphVisualization from './components/GraphVisualization';
import MindmapVisualization from './components/MindmapVisualization';
import TreeVisualization from './components/TreeVisualization';
import UMLVisualization from './components/UMLVisualization';
import SWRLModal from './components/SWRLModal';
import DLAxiomModal from './components/DLAxiomModal';
import { INITIAL_NODES, INITIAL_EDGES } from './constants';
import { ElementType, UMLNodeData, ProjectData } from './types';
import { generateTurtle } from './services/owlMapper';
import { validateOntology, ValidationResult } from './services/validatorService';
import { normalizeOntology } from './services/normalizationService';
import { parseFunctionalSyntax } from './services/functionalSyntaxParser';
import { parseManchesterSyntax } from './services/manchesterSyntaxParser';
import { parseTurtle } from './services/rdfParser';
import { parseRdfXml } from './services/rdfXmlParser';

const nodeTypes = {
  umlNode: UMLNode,
};

const Flow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'design' | 'code' | 'graph' | 'mindmap' | 'tree' | 'uml'>('design');
  const [showIndividuals, setShowIndividuals] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [isDLQueryModalOpen, setIsDLQueryModalOpen] = useState(false);
  const [isSWRLModalOpen, setIsSWRLModalOpen] = useState(false);
  const [isDLAxiomModalOpen, setIsDLAxiomModalOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const [projectMetadata, setProjectMetadata] = useState<ProjectData>({ 
      name: 'Untitled Project',
      baseIri: 'http://example.org/ontology#',
      defaultPrefix: 'ex',
      rules: []
  });

  // --- Filtering & Search Logic for Visibility ---
  
  // Update nodes with search highlight status
  useEffect(() => {
      setNodes((nds) => nds.map(n => {
          const isMatch = searchTerm && n.data.label.toLowerCase().includes(searchTerm.toLowerCase());
          // Only update if changed to avoid loop
          if (!!n.data.isSearchMatch !== !!isMatch) {
              return { ...n, data: { ...n.data, isSearchMatch: !!isMatch } };
          }
          return n;
      }));
  }, [searchTerm, setNodes]);

  const visibleNodes = useMemo(() => {
      if (showIndividuals) return nodes;
      return nodes.filter(n => n.data.type !== ElementType.OWL_NAMED_INDIVIDUAL);
  }, [nodes, showIndividuals]);

  const visibleEdges = useMemo(() => {
      if (showIndividuals) return edges;
      const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
      // Only show edges where both source and target are visible
      return edges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  }, [edges, visibleNodes, showIndividuals]);

  const onConnect = useCallback((params: Connection) => {
      setEdges((eds) => addEdge({ 
          ...params, 
          type: 'smoothstep', 
          label: 'use',
          style: { stroke: '#64748b', strokeWidth: 1.5 },
          labelStyle: { fill: '#cbd5e1', fontWeight: 500 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' }
      }, eds));
  }, [setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      const elementType = event.dataTransfer.getData('application/elementType');
      if (typeof type === 'undefined' || !type) return;

      const position = {
        x: event.clientX - 300, 
        y: event.clientY - 100, 
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
    }, [setNodes]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const updateNodeData = useCallback((id: string, newData: UMLNodeData) => {
    setNodes((nds) => nds.map((node) => node.id === id ? { ...node, data: newData } : node));
  }, [setNodes]);

  const deleteNode = useCallback((id: string) => {
      setNodes((nds) => nds.filter(n => n.id !== id));
      setEdges((eds) => eds.filter(e => e.source !== id && e.target !== id));
      setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  const onDiagramGenerated = useCallback((newNodes: Node[], newEdges: Edge[]) => {
      const normalizedNodes = normalizeOntology(newNodes);
      setNodes(normalizedNodes);
      setEdges(newEdges.map(e => ({ 
          ...e, 
          style: { stroke: '#64748b', strokeWidth: 1.5 }, 
          labelStyle: { fill: '#cbd5e1' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' }
      })));
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

  const handleCodeUpdate = async (code: string, syntax: 'functional' | 'manchester' | 'turtle') => {
      try {
          let result;
          if (syntax === 'manchester') {
              result = parseManchesterSyntax(code);
          } else if (syntax === 'turtle') {
              result = await parseTurtle(code);
          } else {
              result = parseFunctionalSyntax(code);
          }

          if (result.nodes.length > 0) {
              const normalizedNodes = normalizeOntology(result.nodes);
              setNodes(normalizedNodes);
              setEdges(result.edges);
              setProjectMetadata(prev => ({ ...prev, ...result.metadata }));
          } else {
              throw new Error("No valid entities found in code.");
          }
      } catch (e) {
          console.error(e);
          throw new Error(`Failed to parse ${syntax} syntax: ${(e as Error).message}`);
      }
  };

  const handleLoadContent = async (content: string, fileName: string) => {
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
              // Not valid JSON, continue
          }

          // 2. Try Turtle/RDF (Async)
          if (fileName.endsWith('.ttl') || fileName.endsWith('.rdf') || fileName.endsWith('.nt')) {
              try {
                  const result = await parseTurtle(content);
                  if (result.nodes.length > 0) {
                      const normalizedNodes = normalizeOntology(result.nodes);
                      setNodes(normalizedNodes);
                      setEdges(result.edges);
                      setProjectMetadata(prev => ({ ...prev, ...result.metadata }));
                      return;
                  }
              } catch (rdfErr) {
                  console.warn("RDF Parse failed, trying other formats...", rdfErr);
              }
          }

          // 3. Try RDF/XML (Check content or extension)
          if (content.trim().startsWith('<') || fileName.endsWith('.xml') || fileName.endsWith('.rdf') || fileName.endsWith('.owl')) {
              try {
                  const result = parseRdfXml(content);
                  if (result.nodes.length > 0) {
                      const normalizedNodes = normalizeOntology(result.nodes);
                      setNodes(normalizedNodes);
                      setEdges(result.edges);
                      setProjectMetadata(prev => ({ ...prev, ...result.metadata }));
                      return;
                  }
              } catch (xmlErr) {
                  console.warn("XML Parse failed, trying Functional Syntax...", xmlErr);
              }
          }

          // 4. Try OWL Functional Syntax
          if (content.includes('Ontology') || content.includes('Declaration') || fileName.endsWith('.ofn') || fileName.endsWith('.owl')) {
              try {
                const result = parseFunctionalSyntax(content);
                if (result.nodes.length > 0) {
                    const normalizedNodes = normalizeOntology(result.nodes);
                    setNodes(normalizedNodes);
                    setEdges(result.edges);
                    setProjectMetadata(prev => ({ ...prev, ...result.metadata }));
                    return;
                }
              } catch (fnErr) {
                 console.warn("Functional Syntax Parse failed", fnErr);
                 throw fnErr;
              }
          }

          throw new Error("Unknown format or parsing failed.");
      } catch (err) {
          console.error("Failed to load file", err);
          alert(`Failed to load file: ${(err as Error).message}`);
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
        defaultPrefix: data.defaultPrefix || 'ex',
        rules: []
    });
    
    if (data.file) {
      const reader = new FileReader();
      reader.onload = (e) => {
          const content = e.target?.result as string;
          handleLoadContent(content, data.file?.name || '');
      };
      reader.readAsText(data.file);
    } else {
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
    }
    setIsCreateModalOpen(false);
  };

  const handleValidate = () => {
      const result = validateOntology(nodes, edges, projectMetadata);
      setValidationResult(result);
      setIsValidationModalOpen(true);
  };

  const handleOntologyUpdate = useCallback((newNodes: Node<UMLNodeData>[], newEdges: Edge[]) => {
      setNodes(newNodes);
      setEdges(newEdges);
  }, [setNodes, setEdges]);

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
        onOpenDLQuery={() => setIsDLQueryModalOpen(true)}
        onOpenSWRL={() => setIsSWRLModalOpen(true)}
        onOpenDLAxioms={() => setIsDLAxiomModalOpen(true)}
        currentView={viewMode}
        onViewChange={setViewMode}
        showIndividuals={showIndividuals}
        onToggleIndividuals={() => setShowIndividuals(!showIndividuals)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />
      
      <div className="flex flex-1 overflow-hidden">
        {viewMode === 'design' && (
            <>
                <Sidebar />
                <div className="flex-1 h-full relative" onDrop={onDrop} onDragOver={onDragOver}>
                    <ReactFlow
                        nodes={visibleNodes}
                        edges={visibleEdges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        fitView
                        className="bg-slate-950"
                        snapToGrid={true}
                        snapGrid={[16, 16]}
                        defaultEdgeOptions={{
                            type: 'smoothstep',
                            style: { stroke: '#64748b', strokeWidth: 2 },
                            labelStyle: { fill: '#cbd5e1', fontWeight: 500, fontSize: 11 },
                            markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' }
                        }}
                        connectionLineStyle={{ stroke: '#60a5fa', strokeWidth: 2 }}
                    >
                        <Background 
                            color="#334155" 
                            gap={20} 
                            size={1.5} 
                            variant={BackgroundVariant.Dots}
                            className="opacity-50"
                        />
                        <Controls className="!bg-slate-800 !border-slate-700 !shadow-sm !rounded-md" />
                        <MiniMap 
                            nodeColor={(n) => {
                                if (n.type === 'umlNode') return '#6366f1';
                                return '#334155';
                            }}
                            className="!bg-slate-800 !border-slate-700 !shadow-sm !rounded-md"
                            maskColor="rgba(15, 23, 42, 0.6)"
                        />
                        <Panel position="top-right" className="bg-slate-800/80 backdrop-blur-sm p-2 rounded text-xs text-slate-400 border border-slate-700/50 shadow-sm pointer-events-none select-none">
                            {projectMetadata.name} • {projectMetadata.defaultPrefix || 'ex'}
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
            </>
        )}

        {viewMode === 'code' && (
            <div className="flex-1 h-full">
                <CodeViewer 
                    nodes={nodes} 
                    edges={edges} 
                    metadata={projectMetadata} 
                    onImportCode={handleCodeUpdate}
                    searchTerm={searchTerm}
                />
            </div>
        )}

        {viewMode === 'graph' && (
            <div className="flex-1 h-full">
                <GraphVisualization 
                    nodes={visibleNodes} 
                    edges={visibleEdges} 
                    searchTerm={searchTerm}
                />
            </div>
        )}

        {viewMode === 'mindmap' && (
            <div className="flex-1 h-full">
                <MindmapVisualization 
                    nodes={visibleNodes} 
                    edges={visibleEdges}
                    searchTerm={searchTerm}
                />
            </div>
        )}

        {viewMode === 'tree' && (
            <div className="flex-1 h-full">
                <TreeVisualization 
                    nodes={visibleNodes} 
                    edges={visibleEdges} 
                    searchTerm={searchTerm}
                />
            </div>
        )}

        {viewMode === 'uml' && (
            <div className="flex-1 h-full">
                <UMLVisualization 
                    nodes={visibleNodes} 
                    edges={visibleEdges} 
                    searchTerm={searchTerm}
                />
            </div>
        )}
      </div>

      {viewMode === 'design' && (
        <AIAssistant 
            onDiagramGenerated={onDiagramGenerated} 
            currentNodes={nodes}
            currentEdges={edges}
        />
      )}

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

      <DLQueryModal 
        isOpen={isDLQueryModalOpen}
        onClose={() => setIsDLQueryModalOpen(false)}
        nodes={nodes}
        edges={edges}
      />

      <SWRLModal 
        isOpen={isSWRLModalOpen}
        onClose={() => setIsSWRLModalOpen(false)}
        projectData={projectMetadata}
        onUpdateProjectData={setProjectMetadata}
        nodes={nodes}
        edges={edges}
      />

      <DLAxiomModal 
        isOpen={isDLAxiomModalOpen}
        onClose={() => setIsDLAxiomModalOpen(false)}
        nodes={nodes}
        edges={edges}
        onUpdateOntology={handleOntologyUpdate}
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