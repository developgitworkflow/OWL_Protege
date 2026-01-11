
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
import Toast, { ToastMessage, ToastType } from './components/Toast';
import ConfirmDialog from './components/ConfirmDialog';
import ImportUrlModal from './components/ImportUrlModal';
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // History State
  const [past, setPast] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [future, setFuture] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);

  // Reasoner State
  const [isReasonerActive, setIsReasonerActive] = useState(false);
  const [showInferred, setShowInferred] = useState(false);
  const [inferredEdges, setInferredEdges] = useState<Edge[]>([]);
  const [unsatisfiableIds, setUnsatisfiableIds] = useState<string[]>([]);
  
  // UI State
  const [edgeTooltip, setEdgeTooltip] = useState<{ id: string, x: number, y: number, label: string, type?: string } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [isDLQueryModalOpen, setIsDLQueryModalOpen] = useState(false);
  const [isSWRLModalOpen, setIsSWRLModalOpen] = useState(false);
  const [isDLAxiomModalOpen, setIsDLAxiomModalOpen] = useState(false);
  const [isExpressivityModalOpen, setIsExpressivityModalOpen] = useState(false);
  const [isDatalogModalOpen, setIsDatalogModalOpen] = useState(false);
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
  const [isImportUrlModalOpen, setIsImportUrlModalOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const [projectMetadata, setProjectMetadata] = useState<ProjectData>({ 
      name: 'Untitled Project',
      baseIri: 'http://example.org/ontology#',
      defaultPrefix: 'ex',
      rules: []
  });

  // Sync sidebar visibility with view mode
  useEffect(() => {
      setIsSidebarOpen(viewMode === 'design');
  }, [viewMode]);

  // --- Notifications ---
  const addToast = useCallback((message: string, type: ToastType = 'success') => {
      const id = Math.random().toString(36).substr(2, 9);
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
      setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

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
      addToast('Undo successful', 'info');
  }, [past, nodes, edges, setNodes, setEdges, addToast]);

  const redo = useCallback(() => {
      if (future.length === 0) return;
      const next = future[future.length - 1];
      const newFuture = future.slice(0, -1);

      setPast(p => [...p, { nodes, edges }]);
      setFuture(newFuture);
      setNodes(next.nodes);
      setEdges(next.edges);
      addToast('Redo successful', 'info');
  }, [future, nodes, edges, setNodes, setEdges, addToast]);

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
              addToast('Validation failed: Inconsistencies detected', 'error');
              return;
          }

          // 2. Classification & Inference (Only if Consistent)
          const inferred = computeInferredEdges(nodes, edges);
          setInferredEdges(inferred);
          setIsReasonerActive(true);
          setShowInferred(true);
          addToast('Reasoner completed successfully', 'success');
      }
  }, [nodes, edges, isReasonerActive, projectMetadata, addToast]);

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
      addToast(`Created new ${elementType}`, 'success');
    }, [setNodes, saveHistory, addToast]);

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

  const performDeleteNode = useCallback((id: string) => {
      saveHistory();
      const node = nodes.find(n => n.id === id);
      setNodes((nds) => nds.filter(n => n.id !== id));
      setEdges((eds) => eds.filter(e => e.source !== id && e.target !== id));
      setSelectedNodeId(null);
      addToast(`Deleted ${node?.data.label || 'element'}`, 'success');
  }, [nodes, setNodes, setEdges, saveHistory, addToast]);

  const deleteNode = useCallback((id: string) => {
      const node = nodes.find(n => n.id === id);
      setConfirmConfig({
          title: `Delete ${node?.data.label || 'Element'}?`,
          message: "Are you sure you want to delete this element? This action cannot be undone unless you use the history undo.",
          onConfirm: () => {
              performDeleteNode(id);
              setConfirmConfig(null);
          }
      });
  }, [nodes, performDeleteNode]);

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
      addToast(`Created individual '${name}'`, 'success');
  }, [nodes, setNodes, setEdges, saveHistory, addToast]);

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
      addToast(`Created ${label}`, 'success');
      return newId; // Return ID for selection
  }, [setNodes, projectMetadata, saveHistory, addToast]);

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
      addToast('Diagram generated from AI description', 'success');
  }, [setNodes, setEdges, saveHistory, addToast]);

  const handleSaveJSON = () => {
      const data = JSON.stringify({ metadata: projectMetadata, nodes, edges });
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectMetadata.name.replace(/\s+/g, '_') || 'diagram'}.json`;
      link.click();
      addToast('Project JSON exported', 'success');
  };

  const handleSaveTurtle = () => {
      const turtle = generateTurtle(nodes, edges, projectMetadata);
      const blob = new Blob([turtle], { type: 'text/turtle' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectMetadata.name.replace(/\s+/g, '_') || 'ontology'}.ttl`;
      link.click();
      addToast('Turtle (TTL) exported', 'success');
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
              addToast('Code imported successfully', 'success');
          } else {
              throw new Error("No valid entities found in code.");
          }
      } catch (e) {
          console.error(e);
          addToast(`Failed to parse ${syntax}: ${(e as Error).message}`, 'error');
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
                  addToast('Project loaded', 'success');
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
                      addToast('RDF/XML loaded', 'success');
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
                    addToast('Functional Syntax loaded', 'success');
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
                  addToast('Turtle loaded', 'success');
                  return;
              }
          } catch (rdfErr) { }

          throw new Error("Unknown format or parsing failed.");
      } catch (err) {
          console.error("Failed to load file", err);
          addToast(`Failed to load file: ${(err as Error).message}`, 'error');
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

  const handleLoadUrl = async (url: string) => {
      try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const content = await response.text();
          // Heuristic for filename based on URL to help parser
          const filename = url.split('/').pop() || 'download';
          await handleLoadContent(content, filename);
      } catch (e) {
          throw e; // Modal handles display
      }
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
      addToast('New project created', 'success');
    }
    setIsCreateModalOpen(false);
  };

  const handleValidate = () => {
      const result = validateOntology(nodes, edges, projectMetadata);
      setValidationResult(result);
      setUnsatisfiableIds(result.unsatisfiableNodeIds);
      setIsValidationModalOpen(true);
      if (result.isValid) {
          addToast('Ontology is consistent', 'success');
      } else {
          addToast('Validation found issues', 'error');
      }
  };

  const handleOntologyUpdate = useCallback((newNodes: Node<UMLNodeData>[], newEdges: Edge[]) => {
      saveHistory();
      setNodes(newNodes);
      setEdges(newEdges);
      addToast('Ontology updated from axioms', 'success');
  }, [setNodes, setEdges, saveHistory, addToast]);

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
      <Toast toasts={toasts} onDismiss={removeToast} />
      
      <ConfirmDialog 
        isOpen={!!confirmConfig}
        title={confirmConfig?.title || ''}
        message={confirmConfig?.message || ''}
        onConfirm={confirmConfig?.onConfirm || (() => {})}
        onCancel={() => setConfirmConfig(null)}
      />

      <ImportUrlModal 
        isOpen={isImportUrlModalOpen}
        onClose={() => setIsImportUrlModalOpen(false)}
        onImport={handleLoadUrl}
      />

      <TopBar 
        onSaveJSON={handleSaveJSON} 
        onSaveTurtle={handleSaveTurtle}
        onLoad={handleLoad}
        onLoadUrl={() => setIsImportUrlModalOpen(true)}
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
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isSidebarOpen={isSidebarOpen}
        showSidebarToggle={viewMode === 'design'}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar restricted to design mode */}
        {isSidebarOpen && viewMode === 'design' && (
            <Sidebar selectedNode={selectedNode} />
        )}
        
        <div className="flex-1 relative h-full bg-slate-900" onDrop={onDrop} onDragOver={onDragOver}>
          {viewMode === 'design' && (
            <ReactFlow
              nodes={visibleNodes}
              edges={visibleEdges}
              onNodesChange={onNodesChangeWrapped}
              onEdgesChange={onEdgesChangeWrapped}
              onConnect={onConnect}
              onNodeDragStart={onNodeDragStart}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onEdgeMouseEnter={onEdgeMouseEnter}
              onEdgeMouseLeave={onEdgeMouseLeave}
              fitView
              className="bg-slate-950"
              minZoom={0.1}
            >
              <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#334155" />
              <Controls className="bg-slate-800 border-slate-700 fill-slate-400 text-slate-400" />
              <MiniMap 
                nodeColor={(n) => {
                  switch(n.data.type) {
                    case ElementType.OWL_CLASS: return '#6366f1';
                    case ElementType.OWL_NAMED_INDIVIDUAL: return '#ec4899';
                    case ElementType.OWL_OBJECT_PROPERTY: return '#3b82f6';
                    case ElementType.OWL_DATA_PROPERTY: return '#10b981';
                    default: return '#64748b';
                  }
                }}
                className="bg-slate-900 border-slate-800" 
                maskColor="rgba(15, 23, 42, 0.7)"
              />
              {edgeTooltip && (
                  <div 
                      className="absolute z-50 px-2 py-1 bg-amber-900/90 text-amber-200 text-xs rounded border border-amber-700/50 pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-10px]"
                      style={{ top: edgeTooltip.y, left: edgeTooltip.x }}
                  >
                      <div className="font-bold">{edgeTooltip.label}</div>
                      <div className="text-[10px] italic">{edgeTooltip.type}</div>
                  </div>
              )}
            </ReactFlow>
          )}

          {viewMode === 'code' && (
              <CodeViewer 
                  nodes={nodes} 
                  edges={edges} 
                  metadata={projectMetadata} 
                  onImportCode={handleCodeUpdate}
                  searchTerm={searchTerm}
              />
          )}

          {viewMode === 'graph' && (
              <GraphVisualization 
                  nodes={nodes} 
                  edges={edges} 
                  searchTerm={searchTerm}
                  selectedNodeId={selectedNodeId}
                  onNavigate={handleNavigate}
              />
          )}

          {viewMode === 'mindmap' && (
              <MindmapVisualization 
                  nodes={nodes} 
                  edges={edges} 
                  searchTerm={searchTerm}
                  selectedNodeId={selectedNodeId}
              />
          )}

          {viewMode === 'tree' && (
              <TreeVisualization 
                  nodes={nodes} 
                  edges={edges} 
                  searchTerm={searchTerm}
                  selectedNodeId={selectedNodeId}
                  onNavigate={handleNavigate}
              />
          )}

          {viewMode === 'uml' && (
              <UMLVisualization nodes={nodes} edges={edges} searchTerm={searchTerm} />
          )}

          {viewMode === 'peirce' && (
              <PeirceVisualization nodes={nodes} edges={edges} />
          )}

          {viewMode === 'concept' && (
              <ConceptGraph 
                  nodes={nodes} 
                  edges={edges} 
                  searchTerm={searchTerm}
                  selectedNodeId={selectedNodeId}
                  onNavigate={handleNavigate}
              />
          )}

          {viewMode === 'entities' && (
              <EntityCatalog 
                  nodes={nodes} 
                  edges={edges}
                  isReasonerActive={isReasonerActive}
                  unsatisfiableNodeIds={unsatisfiableIds}
                  onAddNode={handleCreateNode}
                  onDeleteNode={deleteNode}
                  onSelectNode={setSelectedNodeId}
                  onViewInGraph={(id) => handleNavigate('concept', id)}
                  selectedNodeId={selectedNodeId}
              />
          )}

          {viewMode === 'workflow' && (
              <WorkflowView 
                  nodes={nodes}
                  edges={edges}
                  isReasonerActive={isReasonerActive}
                  validationStatus={validationResult?.isValid ? 'valid' : (validationResult ? 'invalid' : 'unknown')}
                  onNavigate={handleNavigate}
                  onRunReasoner={handleRunReasoner}
                  onValidate={handleValidate}
                  onExport={handleSaveTurtle}
                  onCreateClass={() => { handleNavigate('design'); handleCreateNode(ElementType.OWL_CLASS, 'NewClass'); }}
              />
          )}

          {viewMode === 'owlviz' && (
              <OWLVizVisualization 
                  nodes={nodes} 
                  edges={edges} 
                  searchTerm={searchTerm}
                  selectedNodeId={selectedNodeId}
              />
          )}

          <AIAssistant 
              onDiagramGenerated={onDiagramGenerated} 
              currentNodes={nodes} 
              currentEdges={edges} 
          />
        </div>

        {/* Properties Panel Sliding Container */}
        <div className={`transition-all duration-300 ease-in-out border-l border-slate-800 bg-slate-900 overflow-hidden ${selectedNode ? 'w-96 translate-x-0' : 'w-0 translate-x-full border-none'}`}>
            <PropertiesPanel 
              selectedNode={selectedNode} 
              onUpdateNode={updateNodeData} 
              onDeleteNode={deleteNode}
              onCreateIndividual={handleCreateIndividual}
              onClose={() => setSelectedNodeId(null)}
            />
        </div>
      </div>

      {/* Modals */}
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
        edges={activeEdges}
        onNavigate={handleNavigate}
      />

      <SWRLModal
        isOpen={isSWRLModalOpen}
        onClose={() => setIsSWRLModalOpen(false)}
        projectData={projectMetadata}
        onUpdateProjectData={(data) => { saveHistory(); setProjectMetadata(data); }}
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

export default Flow;
