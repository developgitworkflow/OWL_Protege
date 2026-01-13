
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Controls,
  Background,
  ReactFlowProvider,
  BackgroundVariant,
  MiniMap,
  useReactFlow,
  ConnectionMode,
  Panel
} from 'reactflow';

import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import PropertiesPanel from './components/PropertiesPanel';
import UMLNode from './components/UMLNode';
import AIAssistant from './components/AIAssistant';
import Toast, { ToastMessage, ToastType } from './components/Toast';
import ConfirmDialog from './components/ConfirmDialog';
import ImportUrlModal from './components/ImportUrlModal';
import ShortcutsModal from './components/ShortcutsModal';

// Visualizations & Views
import GraphVisualization from './components/GraphVisualization';
import MindmapVisualization from './components/MindmapVisualization';
import TreeVisualization from './components/TreeVisualization';
import UMLVisualization from './components/UMLVisualization';
import PeirceVisualization from './components/PeirceVisualization';
import OWLVizVisualization from './components/OWLVizVisualization';
import WorkflowView from './components/WorkflowView';
import EntityCatalog from './components/EntityCatalog';
import CodeViewer from './components/CodeViewer';

// Modals
import SettingsModal from './components/SettingsModal';
import CreateProjectModal from './components/CreateProjectModal';
import ValidationModal from './components/ValidationModal';
import DLQueryModal from './components/DLQueryModal';
import SWRLModal from './components/SWRLModal';
import DLAxiomModal from './components/DLAxiomModal';
import ExpressivityModal from './components/ExpressivityModal';
import DatalogModal from './components/DatalogModal';
import OntoMetricsModal from './components/OntoMetricsModal';
import VersionControlModal from './components/VersionControlModal';
import DocumentationModal from './components/DocumentationModal';
import SPARQLModal from './components/SPARQLModal';

import { INITIAL_NODES, INITIAL_EDGES } from './constants';
import { UMLNodeData, ElementType, ProjectData, Repository, Snapshot } from './types';
import { validateOntology, ValidationResult } from './services/validatorService';
import { computeInferredEdges } from './services/reasonerService';
import { parseTurtle } from './services/rdfParser';
import { parseRdfXml } from './services/rdfXmlParser';
import { parseManchesterSyntax } from './services/manchesterSyntaxParser';
import { parseFunctionalSyntax } from './services/functionalSyntaxParser';
import { initRepository } from './services/versionControlService';

const nodeTypes = {
  umlNode: UMLNode,
};

function App() {
  // State
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [projectData, setProjectData] = useState<ProjectData>({ name: 'Untitled Ontology', defaultPrefix: 'ex' });
  
  const [viewMode, setViewMode] = useState<'design' | 'code' | 'graph' | 'mindmap' | 'tree' | 'uml' | 'peirce' | 'entities' | 'owlviz' | 'workflow'>('design');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Logic State
  const [isReasonerActive, setIsReasonerActive] = useState(false);
  const [showInferred, setShowInferred] = useState(false);
  const [showIndividuals, setShowIndividuals] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  
  // Modals State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [isDLQueryOpen, setIsDLQueryOpen] = useState(false);
  const [isSWRLOpen, setIsSWRLOpen] = useState(false);
  const [isAxiomsOpen, setIsAxiomsOpen] = useState(false);
  const [isExpressivityOpen, setIsExpressivityOpen] = useState(false);
  const [isDatalogOpen, setIsDatalogOpen] = useState(false);
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);
  const [isImportUrlOpen, setIsImportUrlOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isVCOpen, setIsVCOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isSPARQLOpen, setIsSPARQLOpen] = useState(false);
  
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  // Version Control State
  const [repository, setRepository] = useState<Repository>(() => initRepository({ nodes: INITIAL_NODES, edges: INITIAL_EDGES, metadata: { name: 'Init', defaultPrefix: 'ex' } }));

  // Hooks & Refs
  const { screenToFlowPosition, fitView } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---

  const handleToggleAnnotations = useCallback(() => {
      setShowAnnotations(prev => {
          const next = !prev;
          setNodes(nds => nds.map(n => ({
              ...n,
              data: { ...n.data, showAnnotations: next }
          })));
          return next;
      });
  }, [setNodes]);

  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  const removeToast = (id: string) => {
      setToasts(prev => prev.filter(t => t.id !== id));
  };

  const onConnect = useCallback((params: Connection) => {
    const sourceNode = nodes.find(n => n.id === params.source);
    const targetNode = nodes.find(n => n.id === params.target);
    
    let label = 'rel';
    
    if (sourceNode && targetNode) {
        if (sourceNode.data.type === ElementType.OWL_CLASS && targetNode.data.type === ElementType.OWL_CLASS) {
            label = 'subClassOf';
        } else if (sourceNode.data.type === ElementType.OWL_NAMED_INDIVIDUAL && targetNode.data.type === ElementType.OWL_CLASS) {
            label = 'rdf:type';
        } else if (sourceNode.data.type === ElementType.OWL_NAMED_INDIVIDUAL && targetNode.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
            label = 'knows';
        }
    }

    setEdges((eds) => addEdge({ ...params, type: 'smoothstep', label }, eds));
  }, [setEdges, nodes]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  // --- Drag & Drop Handlers ---
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      // 1. Handle File Drops (Import)
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
          const file = event.dataTransfer.files[0];
          handleImportFile(file);
          return;
      }

      // 2. Handle Sidebar Item Drops
      const type = event.dataTransfer.getData('application/reactflow');
      const elementType = event.dataTransfer.getData('application/elementType') as ElementType;

      if (typeof type === 'undefined' || !type || !elementType) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let label = 'New Entity';
      if (elementType === ElementType.OWL_CLASS) label = 'NewClass';
      else if (elementType === ElementType.OWL_NAMED_INDIVIDUAL) label = 'NewIndividual';
      else if (elementType === ElementType.OWL_OBJECT_PROPERTY) label = 'newProp';
      else if (elementType === ElementType.OWL_DATA_PROPERTY) label = 'newDataProp';
      else if (elementType === ElementType.OWL_DATATYPE) label = 'string';

      const newNode: Node<UMLNodeData> = {
        id: `node-${Date.now()}`,
        type,
        position,
        data: { 
            label: label, 
            type: elementType,
            attributes: [],
            methods: [],
            showAnnotations: showAnnotations
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setSelectedNodeId(newNode.id);
      setSelectedEdgeId(null);
      addToast(`Created ${label}`, 'success');
    },
    [screenToFlowPosition, setNodes, showAnnotations]
  );

  const handleNavigate = (view: string, id?: string) => {
    setViewMode(view as any);
    if (id) {
        const isNode = nodes.some(n => n.id === id);
        const isEdge = edges.some(e => e.id === id);
        
        if (isNode) {
            setSelectedNodeId(id);
            setSelectedEdgeId(null);
        } else if (isEdge) {
            setSelectedEdgeId(id);
            setSelectedNodeId(null);
        }
    }
  };

  const handleUpdateNode = (id: string, data: UMLNodeData) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data } : n));
  };

  const handleUpdateEdge = (id: string, label: string) => {
    setEdges(eds => eds.map(e => e.id === id ? { ...e, label } : e));
  };

  const handleDeleteNode = (id: string) => {
    const node = nodes.find(n => n.id === id);
    setConfirmConfig({
        title: `Delete ${node?.data.label || 'Element'}?`,
        message: "Are you sure you want to delete this element? This action cannot be undone.",
        onConfirm: () => {
            setNodes(nds => nds.filter(n => n.id !== id));
            setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
            setSelectedNodeId(null);
            setConfirmConfig(null);
            addToast('Element deleted', 'success');
        }
    });
  };

  const handleDeleteEdge = (id: string) => {
    setConfirmConfig({
        title: "Delete Relation?",
        message: "Are you sure you want to remove this relationship?",
        onConfirm: () => {
            setEdges(eds => eds.filter(e => e.id !== id));
            setSelectedEdgeId(null);
            setConfirmConfig(null);
            addToast('Relation deleted', 'success');
        }
    });
  };

  useEffect(() => {
      const handleFocusIn = (e: FocusEvent) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains('uml-node')) {
              const nodeId = target.getAttribute('data-id');
              if (nodeId) {
                  setSelectedNodeId(nodeId);
                  setSelectedEdgeId(null);
              }
          }
      };
      document.addEventListener('focusin', handleFocusIn);
      return () => document.removeEventListener('focusin', handleFocusIn);
  }, []);

  // ... (Keyboard Shortcuts logic remains the same)

  const handleAddNode = (type: ElementType, label: string) => {
      const newNode: Node<UMLNodeData> = {
          id: `node-${Date.now()}`,
          type: 'umlNode',
          position: { x: Math.random() * 500, y: Math.random() * 500 },
          data: {
              label,
              type,
              attributes: [],
              methods: [],
              showAnnotations: showAnnotations
          }
      };
      setNodes(nds => [...nds, newNode]);
      setSelectedNodeId(newNode.id);
      setSelectedEdgeId(null);
      addToast(`Created ${label}`, 'success');
      if (viewMode !== 'design' && viewMode !== 'entities') {
          setViewMode('design');
      }
  };

  const handleRunReasoner = () => {
      setIsReasonerActive((prev) => {
          const newState = !prev;
          if (newState) {
              addToast('Reasoner activated. Inferences computed.', 'success');
              setShowInferred(true);
          } else {
              addToast('Reasoner deactivated.', 'info');
              setShowInferred(false);
          }
          return newState;
      });
  };

  const handleValidate = () => {
      const res = validateOntology(nodes, edges, projectData);
      setValidationResult(res);
      setIsValidationOpen(true);
      
      // Update nodes with punning information
      if (res.punnedNodeIds.length > 0) {
          setNodes(nds => nds.map(n => ({
              ...n,
              data: {
                  ...n.data,
                  isPunned: res.punnedNodeIds.includes(n.id)
              }
          })));
      }
  };

  const handleLoadContent = async (content: string, fileName: string) => {
      try {
          let result: any = null;
          const lowerName = fileName.toLowerCase();
          
          if (lowerName.endsWith('.json')) {
              result = JSON.parse(content);
          } else if (lowerName.endsWith('.ofn')) {
              result = parseFunctionalSyntax(content);
          } else if (lowerName.endsWith('.owl') || lowerName.endsWith('.rdf') || lowerName.endsWith('.xml')) {
              try {
                  result = parseRdfXml(content);
              } catch (xmlError) {
                  console.warn("XML parse failed, trying Turtle/N-Triples fallback for OWL file", xmlError);
                  result = await parseTurtle(content);
              }
          } else if (lowerName.endsWith('.ttl') || lowerName.endsWith('.nt') || lowerName.endsWith('.n3')) {
              result = await parseTurtle(content);
          } else if (lowerName.endsWith('.omn') || lowerName.endsWith('.manchester')) {
              result = parseManchesterSyntax(content);
          } else {
              // Fallback chain
              try { result = parseFunctionalSyntax(content); }
              catch {
                  try { result = await parseTurtle(content); }
                  catch { result = parseRdfXml(content); }
              }
          }

          if (result && result.nodes) {
              const validNodeIds = new Set(result.nodes.map((n: any) => n.id));
              const validEdges = (result.edges || []).filter((e: any) => 
                  validNodeIds.has(e.source) && validNodeIds.has(e.target)
              );

              // Preserve showAnnotations state on import
              const nodesWithState = result.nodes.map((n: any) => ({
                  ...n,
                  data: { ...n.data, showAnnotations: showAnnotations }
              }));

              setNodes(nodesWithState);
              setEdges(validEdges);
              
              if (result.metadata) setProjectData(prev => ({ ...prev, ...result.metadata }));
              addToast(`Imported ${result.nodes.length} entities.`, 'success');
              
              setRepository(initRepository({ nodes: result.nodes, edges: validEdges, metadata: result.metadata || projectData }));
              setTimeout(() => fitView(), 100);
          }
      } catch (e) {
          console.error(e);
          addToast(`Failed to import: ${(e as Error).message}`, 'error');
      }
  };

  const handleImportFile = (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          const content = e.target?.result as string;
          handleLoadContent(content, file.name);
      };
      reader.readAsText(file);
  };

  // ... (handleLoadUrl, handleRestoreSnapshot remains the same)

  const visibleNodes = useMemo(() => {
      return showIndividuals 
        ? nodes 
        : nodes.filter(n => n.data.type !== ElementType.OWL_NAMED_INDIVIDUAL);
  }, [nodes, showIndividuals]);

  const displayEdges = useMemo(() => {
      let currentEdges = edges;
      if (isReasonerActive && showInferred) {
          currentEdges = computeInferredEdges(nodes, edges);
      }
      
      const visibleIds = new Set(visibleNodes.map(n => n.id));
      return currentEdges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
  }, [nodes, edges, isReasonerActive, showInferred, visibleNodes]);

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [selectedNodeId, nodes]);
  const selectedEdge = useMemo(() => edges.find(e => e.id === selectedEdgeId) || null, [selectedEdgeId, edges]);

  useEffect(() => {
      if (viewMode === 'design') {
          setIsSidebarOpen(true);
      }
  }, [viewMode]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
        <input 
            type="file" 
            ref={fileInputRef}
            onChange={(e) => { if(e.target.files?.[0]) handleImportFile(e.target.files[0]); }}
            accept=".json,.ttl,.rdf,.nt,.owl,.ofn,.xml,.omn"
            className="hidden"
        />

        <TopBar 
            // ... (Props passed as before)
            onOpenSettings={() => setIsSettingsOpen(true)}
            currentView={viewMode}
            onViewChange={setViewMode}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            isReasonerActive={isReasonerActive}
            onRunReasoner={handleRunReasoner}
            showInferred={showInferred}
            onToggleInferred={() => setShowInferred(!showInferred)}
            onUndo={() => {}} 
            onRedo={() => {}}
            canUndo={false}
            canRedo={false}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            isSidebarOpen={isSidebarOpen}
            showSidebarToggle={viewMode === 'design'}
            showIndividuals={showIndividuals}
            onToggleIndividuals={() => setShowIndividuals(!showIndividuals)}
            onValidate={handleValidate}
            onOpenDLQuery={() => setIsDLQueryOpen(true)}
            onOpenSWRL={() => setIsSWRLOpen(true)}
            onOpenDLAxioms={() => setIsAxiomsOpen(true)}
            onOpenExpressivity={() => setIsExpressivityOpen(true)}
            onOpenDatalog={() => setIsDatalogOpen(true)}
            onOpenMetrics={() => setIsMetricsOpen(true)}
            onOpenVersionControl={() => setIsVCOpen(true)}
            onOpenDocs={() => setIsDocsOpen(true)}
            onOpenSPARQL={() => setIsSPARQLOpen(true)}
            onImport={() => fileInputRef.current?.click()}
            currentBranch={repository.currentBranch}
        />

        <div className="flex flex-1 overflow-hidden relative">
            {viewMode === 'design' && isSidebarOpen && (
                <Sidebar selectedNode={selectedNode} />
            )}

            <div className="flex-1 relative bg-slate-950">
                {viewMode === 'design' && (
                    <ReactFlow
                        nodes={visibleNodes}
                        edges={displayEdges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        onEdgeClick={onEdgeClick}
                        onPaneClick={onPaneClick}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        nodeTypes={nodeTypes}
                        connectionMode={ConnectionMode.Loose}
                        fitView
                        className="bg-slate-950"
                        minZoom={0.1}
                        deleteKeyCode={null}
                    >
                        {showGrid && <Background variant={BackgroundVariant.Lines} gap={20} size={1} color="#1e293b" />}
                        <Controls className="bg-slate-800 border-slate-700 fill-slate-400 text-slate-400 shadow-xl" showInteractive={false} />
                        <MiniMap 
                            nodeColor={(n) => {
                                switch(n.data.type) {
                                    case ElementType.OWL_CLASS: return '#6366f1';
                                    case ElementType.OWL_NAMED_INDIVIDUAL: return '#14b8a6';
                                    case ElementType.OWL_OBJECT_PROPERTY: return '#3b82f6';
                                    case ElementType.OWL_DATA_PROPERTY: return '#10b981';
                                    default: return '#64748b';
                                }
                            }}
                            className="bg-slate-900 border-slate-800 rounded-lg overflow-hidden shadow-2xl" 
                            maskColor="rgba(2, 6, 23, 0.7)"
                        />
                        <Panel position="bottom-right" className="bg-transparent text-slate-500 text-xs font-mono opacity-50 pointer-events-none">
                            OWL 2 Functional Syntax Compatible
                        </Panel>
                    </ReactFlow>
                )}

                {/* ... (Other views remain the same) */}
                {viewMode === 'workflow' && (
                    <WorkflowView 
                        nodes={nodes} 
                        edges={edges}
                        isReasonerActive={isReasonerActive}
                        validationStatus={validationResult?.isValid ? 'valid' : (validationResult ? 'invalid' : 'unknown')}
                        onNavigate={handleNavigate}
                        onRunReasoner={handleRunReasoner}
                        onValidate={handleValidate}
                        onExport={() => setIsSettingsOpen(true)}
                        onCreateClass={() => handleAddNode(ElementType.OWL_CLASS, 'NewClass')}
                    />
                )}

                {viewMode === 'entities' && (
                    <EntityCatalog 
                        nodes={nodes} 
                        edges={displayEdges}
                        isReasonerActive={isReasonerActive}
                        onAddNode={handleAddNode}
                        onDeleteNode={handleDeleteNode}
                        onSelectNode={setSelectedNodeId}
                        onNavigate={handleNavigate}
                        selectedNodeId={selectedNodeId}
                        unsatisfiableNodeIds={validationResult?.unsatisfiableNodeIds}
                    />
                )}

                {viewMode === 'graph' && (
                    <GraphVisualization 
                        nodes={visibleNodes} 
                        edges={displayEdges} 
                        searchTerm={searchTerm} 
                        selectedNodeId={selectedNodeId}
                        onNavigate={handleNavigate}
                    />
                )}

                {viewMode === 'mindmap' && (
                    <MindmapVisualization 
                        nodes={visibleNodes} 
                        edges={displayEdges}
                        searchTerm={searchTerm}
                        selectedNodeId={selectedNodeId}
                        onNavigate={handleNavigate}
                    />
                )}

                {viewMode === 'tree' && (
                    <TreeVisualization 
                        nodes={visibleNodes} 
                        edges={displayEdges}
                        searchTerm={searchTerm}
                        selectedNodeId={selectedNodeId}
                        onNavigate={handleNavigate}
                    />
                )}

                {viewMode === 'uml' && (
                    <UMLVisualization nodes={visibleNodes} edges={edges} searchTerm={searchTerm} onNavigate={handleNavigate} />
                )}

                {viewMode === 'peirce' && (
                    <PeirceVisualization nodes={visibleNodes} edges={edges} onNavigate={handleNavigate} />
                )}

                {viewMode === 'owlviz' && (
                    <OWLVizVisualization 
                        nodes={visibleNodes} 
                        edges={displayEdges}
                        searchTerm={searchTerm} 
                        selectedNodeId={selectedNodeId} 
                        onNavigate={handleNavigate}
                    />
                )}

                {viewMode === 'code' && (
                    <CodeViewer nodes={nodes} edges={edges} metadata={projectData} onImportCode={(code, syntax) => {
                        handleLoadContent(code, `import.${syntax === 'turtle' ? 'ttl' : (syntax === 'manchester' ? 'omn' : 'ofn')}`);
                    }} />
                )}

                <AIAssistant 
                    currentNodes={nodes} 
                    currentEdges={edges} 
                    onDiagramGenerated={(newNodes, newEdges) => {
                        setNodes(newNodes);
                        setEdges(newEdges);
                        addToast('Diagram generated from AI.', 'success');
                    }} 
                />
            </div>

            <div className={`transition-all duration-300 ease-in-out border-l border-slate-800 bg-slate-900 overflow-hidden ${selectedNode || selectedEdge ? 'w-80 translate-x-0' : 'w-0 translate-x-full border-none'}`}>
                <PropertiesPanel 
                    selectedNode={selectedNode}
                    selectedEdge={selectedEdge}
                    allNodes={nodes}
                    onUpdateNode={handleUpdateNode}
                    onUpdateEdge={handleUpdateEdge}
                    onDeleteNode={handleDeleteNode}
                    onDeleteEdge={handleDeleteEdge}
                    onCreateIndividual={(clsId, name) => {
                        const newIndiv: Node<UMLNodeData> = {
                            id: `indiv-${Date.now()}`,
                            type: 'umlNode',
                            position: { x: Math.random() * 500, y: Math.random() * 500 },
                            data: { label: name, type: ElementType.OWL_NAMED_INDIVIDUAL, attributes: [], methods: [] }
                        };
                        setNodes(nds => [...nds, newIndiv]);
                        setEdges(eds => addEdge({ id: `e-${Date.now()}`, source: newIndiv.id, target: clsId, label: 'rdf:type', type: 'smoothstep' }, eds));
                        addToast(`Created Individual ${name}`, 'success');
                    }}
                    onClose={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
                    onNavigate={handleNavigate}
                />
            </div>
        </div>

        {/* ... (Modals remain mostly same, simplified for brevity here) ... */}
        <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
            projectData={projectData}
            onUpdateProjectData={(d) => setProjectData(d)}
            onNewProject={() => { setNodes([]); setEdges([]); setProjectData({ name: 'New Project', defaultPrefix: 'ex' }); setRepository(initRepository({ nodes: [], edges: [], metadata: { name: 'New Project', defaultPrefix: 'ex' } })); }}
            onExportJSON={() => {}}
            onExportTurtle={() => {}}
            onImportJSON={(e) => { if (e.target.files?.[0]) handleImportFile(e.target.files[0]); }}
            onOpenImportUrl={() => setIsImportUrlOpen(true)}
            onValidate={handleValidate}
            onOpenDLQuery={() => setIsDLQueryOpen(true)}
            onOpenSWRL={() => setIsSWRLOpen(true)}
            onOpenDLAxioms={() => setIsAxiomsOpen(true)}
            onOpenExpressivity={() => setIsExpressivityOpen(true)}
            onOpenDatalog={() => setIsDatalogOpen(true)}
            onOpenMetrics={() => setIsMetricsOpen(true)}
            onExportDocs={() => setIsDocsOpen(true)}
            onOpenSPARQL={() => setIsSPARQLOpen(true)}
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid(!showGrid)}
            showAnnotations={showAnnotations}
            onToggleAnnotations={handleToggleAnnotations}
        />
        <CreateProjectModal 
            isOpen={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            onCreate={(data) => {
                setProjectData(data);
                setNodes([]);
                setEdges([]);
                if (data.file) handleImportFile(data.file);
                setRepository(initRepository({ nodes: [], edges: [], metadata: data }));
                setIsCreateOpen(false);
            }}
        />
        <ValidationModal 
            isOpen={isValidationOpen} 
            onClose={() => setIsValidationOpen(false)} 
            result={validationResult} 
            onNavigate={handleNavigate}
        />
        <DLQueryModal isOpen={isDLQueryOpen} onClose={() => setIsDLQueryOpen(false)} nodes={nodes} edges={edges} onNavigate={handleNavigate} />
        <SWRLModal 
            isOpen={isSWRLOpen} 
            onClose={() => setIsSWRLOpen(false)} 
            projectData={projectData} 
            onUpdateProjectData={(d) => setProjectData(d)} 
            nodes={nodes}
            edges={edges}
        />
        <DLAxiomModal 
            isOpen={isAxiomsOpen} 
            onClose={() => setIsAxiomsOpen(false)} 
            nodes={nodes} 
            edges={edges} 
            onUpdateOntology={(n, e) => { setNodes(n); setEdges(e); }} 
        />
        <ExpressivityModal isOpen={isExpressivityOpen} onClose={() => setIsExpressivityOpen(false)} nodes={nodes} edges={edges} />
        <DatalogModal isOpen={isDatalogOpen} onClose={() => setIsDatalogOpen(false)} nodes={nodes} edges={edges} />
        <OntoMetricsModal isOpen={isMetricsOpen} onClose={() => setIsMetricsOpen(false)} nodes={nodes} edges={edges} />
        <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
        <VersionControlModal 
            isOpen={isVCOpen} 
            onClose={() => setIsVCOpen(false)} 
            repository={repository} 
            onUpdateRepository={(repo) => setRepository(repo)}
            currentSnapshot={{ nodes, edges, metadata: projectData }}
            onRestoreSnapshot={(s) => { setNodes(s.nodes); setEdges(s.edges); setProjectData(s.metadata); }}
        />
        <DocumentationModal 
            isOpen={isDocsOpen} 
            onClose={() => setIsDocsOpen(false)} 
            nodes={nodes} 
            edges={edges} 
            projectData={projectData} 
        />
        <SPARQLModal 
            isOpen={isSPARQLOpen} 
            onClose={() => setIsSPARQLOpen(false)} 
            nodes={nodes} 
            edges={edges} 
            onNavigate={handleNavigate}
        />
        
        <ConfirmDialog 
            isOpen={!!confirmConfig}
            title={confirmConfig?.title || ''}
            message={confirmConfig?.message || ''}
            onConfirm={confirmConfig?.onConfirm || (() => {})}
            onCancel={() => setConfirmConfig(null)}
        />

        <ImportUrlModal 
            isOpen={isImportUrlOpen} 
            onClose={() => setIsImportUrlOpen(false)} 
            onImport={(url) => { /* logic in handleLoadUrl */ }}
        />
        
        <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default function AppWrapper() {
  return (
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  );
}
