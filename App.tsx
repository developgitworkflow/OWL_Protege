
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
  MarkerType,
  NodeChange,
  EdgeChange
} from 'reactflow';
import { Brain, CheckCircle2 } from 'lucide-react';
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
import PeirceVisualization from './components/PeirceVisualization';
import ConceptGraph from './components/ConceptGraph';
import EntityCatalog from './components/EntityCatalog';
import WorkflowView from './components/WorkflowView';
import SWRLModal from './components/SWRLModal';
import DLAxiomModal from './components/DLAxiomModal';
import ExpressivityModal from './components/ExpressivityModal';
import DatalogModal from './components/DatalogModal';
import OntoMetricsModal from './components/OntoMetricsModal';
import OWLVizVisualization from './components/OWLVizVisualization';
import { INITIAL_NODES, INITIAL_EDGES } from './constants';
import { ElementType, UMLNodeData, ProjectData } from './types';
import { generateTurtle } from './services/owlMapper';
import { validateOntology, ValidationResult } from './services/validatorService';
import { normalizeOntology } from './services/normalizationService';
import { parseFunctionalSyntax } from './services/functionalSyntaxParser';
import { parseManchesterSyntax } from './services/manchesterSyntaxParser';
import { parseTurtle } from './services/rdfParser';
import { parseRdfXml } from './services/rdfXmlParser';
import { computeInferredEdges } from './services/reasonerService';

const nodeTypes = {
  umlNode: UMLNode,
};

type ViewMode = 'design' | 'code' | 'graph' | 'mindmap' | 'tree' | 'uml' | 'peirce' | 'concept' | 'entities' | 'owlviz' | 'workflow';

const Flow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('design');
  const [showIndividuals, setShowIndividuals] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // History State
  const [past, setPast] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [future, setFuture] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);

  // Reasoner State
  const [isReasonerActive, setIsReasonerActive] = useState(false);
  const [showInferred, setShowInferred] = useState(false);
  const [inferredEdges, setInferredEdges] = useState<Edge[]>([]);
  const [unsatisfiableIds, setUnsatisfiableIds] = useState<string[]>([]);
  
  // Edge Tooltip State
  const [edgeTooltip, setEdgeTooltip] = useState<{ id: string, x: number, y: number, label: string, type?: string } | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [isDLQueryModalOpen, setIsDLQueryModalOpen] = useState(false);
  const [isSWRLModalOpen, setIsSWRLModalOpen] = useState(false);
  const [isDLAxiomModalOpen, setIsDLAxiomModalOpen] = useState(false);
  const [isExpressivityModalOpen, setIsExpressivityModalOpen] = useState(false);
  const [isDatalogModalOpen, setIsDatalogModalOpen] = useState(false);
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const [projectMetadata, setProjectMetadata] = useState<ProjectData>({ 
      name: 'Untitled Project',
      baseIri: 'http://example.org/ontology#',
      defaultPrefix: 'ex',
      rules: []
  });

  // --- History Management ---

  const saveHistory = useCallback(() => {
      setPast(p => {
          const newPast = [...p, { nodes, edges }];
          // Limit history to 50 steps
          if (newPast.length > 50) newPast.shift();
          return newPast;
      });
      setFuture([]); // Clear future on new action
  }, [nodes, edges]);

  const undo = useCallback(() => {
      if (past.length === 0) return;
      const previous = past[past.length - 1];
      const newPast = past.slice(0, -1);
      
      setFuture(f => [...f, { nodes, edges }]);
      setPast(newPast);
      setNodes(previous.nodes);
      setEdges(previous.edges);
  }, [past, nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
      if (future.length === 0) return;
      const next = future[future.length - 1];
      const newFuture = future.slice(0, -1);

      setPast(p => [...p, { nodes, edges }]);
      setFuture(newFuture);
      setNodes(next.nodes);
      setEdges(next.edges);
  }, [future, nodes, edges, setNodes, setEdges]);

  // Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
              if (e.shiftKey) {
                  redo();
              } else {
                  undo();
              }
              e.preventDefault();
          } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
              redo();
              e.preventDefault();
          }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Wrapped Change Handlers to capture History on Deletion
  const onNodesChangeWrapped = useCallback((changes: NodeChange[]) => {
      // Capture history only on 'remove' from keyboard or interaction, ignoring drag updates here
      if (changes.some(c => c.type === 'remove')) {
          saveHistory();
      }
      onNodesChange(changes);
  }, [onNodesChange, saveHistory]);

  const onEdgesChangeWrapped = useCallback((changes: EdgeChange[]) => {
      if (changes.some(c => c.type === 'remove')) {
          saveHistory();
      }
      onEdgesChange(changes);
  }, [onEdgesChange, saveHistory]);

  const onNodeDragStart = useCallback(() => {
      // Save state before move begins
      saveHistory();
  }, [saveHistory]);

  // When model changes, invalidate inferred state
  useEffect(() => {
      if (isReasonerActive) {
          setIsReasonerActive(false);
          setShowInferred(false);
          setInferredEdges([]);
          setUnsatisfiableIds([]);
      }
  }, [nodes, edges]);

  const handleRunReasoner = useCallback(() => {
      if (isReasonerActive) {
          // Deactivate
          setIsReasonerActive(false);
          setShowInferred(false);
          setInferredEdges([]);
          setUnsatisfiableIds([]);
          setValidationResult(null);
      } else {
          // 1. Consistency Check First
          const result = validateOntology(nodes, edges, projectMetadata);
          setValidationResult(result);
          setUnsatisfiableIds(result.unsatisfiableNodeIds);

          if (!result.isValid) {
              // Found inconsistencies - Stop and Show Report
              setIsValidationModalOpen(true);
              return;
          }

          // 2. Classification & Inference (Only if Consistent)
          const inferred = computeInferredEdges(nodes, edges);
          setInferredEdges(inferred);
          setIsReasonerActive(true);
          setShowInferred(true);
      }
  }, [nodes, edges, isReasonerActive, projectMetadata]);

  // Determine which edges to pass to visualizations
  const activeEdges = useMemo(() => {
      return showInferred ? inferredEdges : edges;
  }, [showInferred, edges, inferredEdges]);

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
      // If showing inferred, we use activeEdges (which are already computed). 
      // Then filter by individual visibility if needed.
      const baseEdges = activeEdges;
      
      if (showIndividuals) return baseEdges;
      
      const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
      // Only show edges where both source and target are visible
      return baseEdges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  }, [activeEdges, visibleNodes, showIndividuals]);

  const onConnect = useCallback((params: Connection) => {
      saveHistory();
      setEdges((eds) => addEdge({ 
          ...params, 
          type: 'smoothstep', 
          label: 'use',
          style: { stroke: '#64748b', strokeWidth: 1.5 },
          labelStyle: { fill: '#cbd5e1', fontWeight: 500 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' }
      }, eds));
  }, [setEdges, saveHistory]);

  const onEdgeMouseEnter = useCallback((event: React.MouseEvent, edge: Edge) => {
      if (edge.data?.isInferred) {
          setEdgeTooltip({
              id: edge.id,
              x: event.clientX,
              y: event.clientY,
              label: edge.label as string,
              type: edge.data.inferenceType
          });
      }
  }, []);

  const onEdgeMouseLeave = useCallback(() => {
      setEdgeTooltip(null);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      const elementType = event.dataTransfer.getData('application/elementType');
      if (typeof type === 'undefined' || !type) return;

      saveHistory();

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
    }, [setNodes, saveHistory]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const updateNodeData = useCallback((id: string, newData: UMLNodeData) => {
    // Note: We do NOT save history here to avoid flooding it with every keystroke in PropertiesPanel.
    // Major structural changes should use dedicated handlers.
    setNodes((nds) => nds.map((node) => node.id === id ? { ...node, data: newData } : node));
  }, [setNodes]);

  const deleteNode = useCallback((id: string) => {
      saveHistory();
      setNodes((nds) => nds.filter(n => n.id !== id));
      setEdges((eds) => eds.filter(e => e.source !== id && e.target !== id));
      setSelectedNodeId(null);
  }, [setNodes, setEdges, saveHistory]);

  const handleCreateIndividual = useCallback((classNodeId: string, name: string) => {
      const classNode = nodes.find(n => n.id === classNodeId);
      if (!classNode) return;

      saveHistory();

      const newId = `node-${Date.now()}`;
      const newNode: Node = {
          id: newId,
          type: 'umlNode',
          position: { 
              x: classNode.position.x + (Math.random() * 100 - 50), 
              y: classNode.position.y + 150 + (Math.random() * 50)
          },
          data: {
              label: name,
              type: ElementType.OWL_NAMED_INDIVIDUAL,
              attributes: [],
              methods: []
          }
      };

      const newEdge: Edge = {
          id: `e-${newId}-${classNodeId}`,
          source: newId,
          target: classNodeId,
          label: 'rdf:type',
          type: 'smoothstep',
          style: { stroke: '#64748b', strokeWidth: 1.5 },
          labelStyle: { fill: '#cbd5e1', fontSize: 11 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' }
      };

      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => [...eds, newEdge]);
  }, [nodes, setNodes, setEdges, saveHistory]);

  const handleCreateNode = useCallback((type: ElementType, label: string) => {
      saveHistory();
      const newId = `node-${Date.now()}`;
      
      const randomX = Math.random() * 600 + 100;
      const randomY = Math.random() * 400 + 100;

      const newNode: Node = {
          id: newId,
          type: 'umlNode',
          position: { x: randomX, y: randomY },
          data: {
              label: label,
              type: type,
              attributes: [],
              methods: [],
              iri: `${projectMetadata.baseIri || 'http://example.org/ontology#'}${label.replace(/\s+/g, '_')}`
          }
      };
      setNodes((nds) => [...nds, newNode]);
      return newId; // Return ID for selection
  }, [setNodes, projectMetadata, saveHistory]);

  const onDiagramGenerated = useCallback((newNodes: Node[], newEdges: Edge[]) => {
      saveHistory();
      const normalizedNodes = normalizeOntology(newNodes);
      setNodes(normalizedNodes);
      setEdges(newEdges.map(e => ({ 
          ...e, 
          style: { stroke: '#64748b', strokeWidth: 1.5 }, 
          labelStyle: { fill: '#cbd5e1' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' }
      })));
  }, [setNodes, setEdges, saveHistory]);

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
              saveHistory();
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
          saveHistory();
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
          } catch (e) { }

          // 2. Try RDF/XML
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
              } catch (xmlErr) { }
          }

          // 3. Try OWL Functional Syntax
          if (/Ontology\s*\(/.test(content) || /Declaration\s*\(/.test(content) || /Prefix\s*\(/.test(content) || fileName.endsWith('.ofn')) {
              try {
                const result = parseFunctionalSyntax(content);
                if (result.nodes.length > 0) {
                    const normalizedNodes = normalizeOntology(result.nodes);
                    setNodes(normalizedNodes);
                    setEdges(result.edges);
                    setProjectMetadata(prev => ({ ...prev, ...result.metadata }));
                    return;
                }
              } catch (fnErr) { }
          }

          // 4. Try Turtle/RDF
          try {
              const result = await parseTurtle(content);
              if (result.nodes.length > 0) {
                  const normalizedNodes = normalizeOntology(result.nodes);
                  setNodes(normalizedNodes);
                  setEdges(result.edges);
                  setProjectMetadata(prev => ({ ...prev, ...result.metadata }));
                  return;
              }
          } catch (rdfErr) { }

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
    saveHistory();
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
      setUnsatisfiableIds(result.unsatisfiableNodeIds);
      setIsValidationModalOpen(true);
  };

  const handleOntologyUpdate = useCallback((newNodes: Node<UMLNodeData>[], newEdges: Edge[]) => {
      saveHistory();
      setNodes(newNodes);
      setEdges(newEdges);
  }, [setNodes, setEdges, saveHistory]);

  const selectedNode = useMemo(() => {
      return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  // Generic Navigation Handler
  const handleNavigate = useCallback((targetView: string, nodeId?: string) => {
      if (nodeId) setSelectedNodeId(nodeId);
      setViewMode(targetView as ViewMode);
  }, []);

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
        onOpenExpressivity={() => setIsExpressivityModalOpen(true)}
        onOpenDatalog={() => setIsDatalogModalOpen(true)}
        onOpenMetrics={() => setIsMetricsModalOpen(true)}
        currentView={viewMode}
        onViewChange={setViewMode}
        showIndividuals={showIndividuals}
        onToggleIndividuals={() => setShowIndividuals(!showIndividuals)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        isReasonerActive={isReasonerActive}
        onRunReasoner={handleRunReasoner}
        showInferred={showInferred}
        onToggleInferred={() => setShowInferred(!showInferred)}
        onUndo={undo}
        onRedo={redo}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
      />
      
      <div className="flex flex-1 overflow-hidden">
        {viewMode === 'design' && (
            <>
                <Sidebar />
                <div className="flex-1 h-full relative" onDrop={onDrop} onDragOver={onDragOver}>
                    <ReactFlow
                        nodes={visibleNodes}
                        edges={visibleEdges} 
                        onNodesChange={onNodesChangeWrapped}
                        onEdgesChange={onEdgesChangeWrapped}
                        onConnect={onConnect}
                        onNodeDragStart={onNodeDragStart}
                        onEdgeMouseEnter={onEdgeMouseEnter}
                        onEdgeMouseLeave={onEdgeMouseLeave}
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
                            {showInferred && <span className="ml-2 text-amber-400 font-bold">• Inferred View</span>}
                        </Panel>
                    </ReactFlow>
                    
                    {edgeTooltip && (
                        <div 
                            className="fixed z-50 pointer-events-none bg-slate-900 border border-amber-500/50 text-slate-200 text-xs px-3 py-2 rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-1"
                            style={{ top: edgeTooltip.y - 60, left: edgeTooltip.x - 20 }}
                        >
                            <div className="flex items-center gap-2 font-bold text-amber-400">
                                <Brain size={14} />
                                {edgeTooltip.type || 'Inferred by Reasoner'}
                            </div>
                            <div className="text-slate-400 italic font-mono text-[10px]">{edgeTooltip.label}</div>
                            <div className="absolute left-6 -bottom-1.5 w-3 h-3 bg-slate-900 border-r border-b border-amber-500/50 transform rotate-45"></div>
                        </div>
                    )}
                </div>
                {selectedNodeId && (
                    <PropertiesPanel 
                        selectedNode={selectedNode} 
                        onUpdateNode={updateNodeData} 
                        onDeleteNode={deleteNode}
                        onCreateIndividual={handleCreateIndividual}
                        onClose={() => setSelectedNodeId(null)}
                    />
                )}
            </>
        )}

        {viewMode === 'entities' && (
            <div className="flex-1 h-full flex">
                <div className="flex-1 overflow-hidden">
                    <EntityCatalog 
                        nodes={nodes}
                        edges={activeEdges}
                        isReasonerActive={isReasonerActive}
                        unsatisfiableNodeIds={unsatisfiableIds}
                        onAddNode={handleCreateNode}
                        onDeleteNode={deleteNode}
                        onSelectNode={setSelectedNodeId}
                        onViewInGraph={(id) => handleNavigate('concept', id)}
                        selectedNodeId={selectedNodeId}
                    />
                </div>
                {selectedNodeId && (
                    <PropertiesPanel 
                        selectedNode={selectedNode} 
                        onUpdateNode={updateNodeData} 
                        onDeleteNode={deleteNode}
                        onCreateIndividual={handleCreateIndividual}
                        onClose={() => setSelectedNodeId(null)}
                    />
                )}
            </div>
        )}

        {viewMode === 'workflow' && (
            <div className="flex-1 h-full">
                <WorkflowView 
                    nodes={nodes}
                    edges={edges}
                    isReasonerActive={isReasonerActive}
                    validationStatus={validationResult?.isValid ? 'valid' : (validationResult ? 'invalid' : 'unknown')}
                    onNavigate={handleNavigate}
                    onRunReasoner={handleRunReasoner}
                    onValidate={handleValidate}
                    onExport={() => setIsSettingsModalOpen(true)}
                    onCreateClass={() => {
                        handleCreateNode(ElementType.OWL_CLASS, 'NewClass');
                        handleNavigate('entities');
                    }}
                />
            </div>
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
                    selectedNodeId={selectedNodeId}
                    onNavigate={handleNavigate}
                />
            </div>
        )}

        {viewMode === 'concept' && (
            <div className="flex-1 h-full">
                <ConceptGraph 
                    nodes={visibleNodes} 
                    edges={visibleEdges} 
                    searchTerm={searchTerm}
                    selectedNodeId={selectedNodeId}
                    onNavigate={handleNavigate}
                />
            </div>
        )}

        {viewMode === 'mindmap' && (
            <div className="flex-1 h-full">
                <MindmapVisualization 
                    nodes={visibleNodes} 
                    edges={visibleEdges}
                    searchTerm={searchTerm}
                    selectedNodeId={selectedNodeId}
                />
            </div>
        )}

        {viewMode === 'tree' && (
            <div className="flex-1 h-full">
                <TreeVisualization 
                    nodes={visibleNodes} 
                    edges={visibleEdges}
                    searchTerm={searchTerm}
                    selectedNodeId={selectedNodeId}
                    onNavigate={handleNavigate}
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

        {viewMode === 'owlviz' && (
            <div className="flex-1 h-full">
                <OWLVizVisualization 
                    nodes={visibleNodes} 
                    edges={visibleEdges}
                    searchTerm={searchTerm}
                    selectedNodeId={selectedNodeId}
                />
            </div>
        )}

        {viewMode === 'peirce' && (
            <div className="flex-1 h-full">
                <PeirceVisualization 
                    nodes={visibleNodes} 
                    edges={visibleEdges}
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

      <ExpressivityModal 
        isOpen={isExpressivityModalOpen}
        onClose={() => setIsExpressivityModalOpen(false)}
        nodes={nodes}
        edges={edges}
      />

      <DatalogModal 
        isOpen={isDatalogModalOpen}
        onClose={() => setIsDatalogModalOpen(false)}
        nodes={nodes}
        edges={edges}
      />

      <OntoMetricsModal 
        isOpen={isMetricsModalOpen}
        onClose={() => setIsMetricsModalOpen(false)}
        nodes={nodes}
        edges={edges}
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
