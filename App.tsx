
import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  useReactFlow
} from 'reactflow';

import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import PropertiesPanel from './components/PropertiesPanel';
import UMLNode from './components/UMLNode';
import AIAssistant from './components/AIAssistant';
import Toast, { ToastMessage, ToastType } from './components/Toast';
import ConfirmDialog from './components/ConfirmDialog';
import ImportUrlModal from './components/ImportUrlModal';

// Visualizations & Views
import GraphVisualization from './components/GraphVisualization';
import MindmapVisualization from './components/MindmapVisualization';
import TreeVisualization from './components/TreeVisualization';
import UMLVisualization from './components/UMLVisualization';
import PeirceVisualization from './components/PeirceVisualization';
import ConceptGraph from './components/ConceptGraph';
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

import { INITIAL_NODES, INITIAL_EDGES } from './constants';
import { UMLNodeData, ElementType, ProjectData } from './types';
import { validateOntology, ValidationResult } from './services/validatorService';
import { computeInferredEdges } from './services/reasonerService';
import { parseTurtle } from './services/rdfParser';
import { parseRdfXml } from './services/rdfXmlParser';
import { parseManchesterSyntax } from './services/manchesterSyntaxParser';
import { parseFunctionalSyntax } from './services/functionalSyntaxParser';

const nodeTypes = {
  umlNode: UMLNode,
};

function App() {
  // State
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [projectData, setProjectData] = useState<ProjectData>({ name: 'Untitled Ontology', defaultPrefix: 'ex' });
  
  const [viewMode, setViewMode] = useState<'design' | 'code' | 'graph' | 'mindmap' | 'tree' | 'uml' | 'peirce' | 'concept' | 'entities' | 'owlviz' | 'workflow'>('design');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Logic State
  const [isReasonerActive, setIsReasonerActive] = useState(false);
  const [showInferred, setShowInferred] = useState(false);
  const [showIndividuals, setShowIndividuals] = useState(true);
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
  
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  // --- Handlers ---

  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  const removeToast = (id: string) => {
      setToasts(prev => prev.filter(t => t.id !== id));
  };

  const onConnect = useCallback((params: Connection) => {
    // Smart Connection Labeling
    const sourceNode = nodes.find(n => n.id === params.source);
    const targetNode = nodes.find(n => n.id === params.target);
    
    let label = 'rel';
    
    if (sourceNode && targetNode) {
        if (sourceNode.data.type === ElementType.OWL_CLASS && targetNode.data.type === ElementType.OWL_CLASS) {
            label = 'subClassOf';
        } else if (sourceNode.data.type === ElementType.OWL_NAMED_INDIVIDUAL && targetNode.data.type === ElementType.OWL_CLASS) {
            label = 'rdf:type';
        } else if (sourceNode.data.type === ElementType.OWL_NAMED_INDIVIDUAL && targetNode.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
            label = 'knows'; // Default object property example
        }
    }

    setEdges((eds) => addEdge({ ...params, type: 'smoothstep', label }, eds));
  }, [setEdges, nodes]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handleNavigate = (view: string, id?: string) => {
    setViewMode(view as any);
    if (id) setSelectedNodeId(id);
  };

  const handleUpdateNode = (id: string, data: UMLNodeData) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data } : n));
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

  // --- Keyboard Navigation ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // Ignore if user is typing in an input
          if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
              return;
          }

          // Delete Shortcut
          if (e.key === 'Delete' || e.key === 'Backspace') {
              if (selectedNodeId) {
                  e.preventDefault(); // Prevent browser back
                  handleDeleteNode(selectedNodeId);
              }
          }

          // Escape Shortcut
          if (e.key === 'Escape') {
              setSelectedNodeId(null);
          }

          // Spatial Navigation (Alt + Arrows)
          if (selectedNodeId && e.key.startsWith('Arrow') && e.altKey) {
              e.preventDefault();
              const current = nodes.find(n => n.id === selectedNodeId);
              if (!current) return;

              const candidates = nodes.filter(n => n.id !== selectedNodeId);
              let bestCandidate: Node | null = null;
              let minDist = Infinity;

              candidates.forEach(target => {
                  const dx = target.position.x - current.position.x;
                  const dy = target.position.y - current.position.y;
                  
                  let isValid = false;
                  // Right: x increases, y change is minimal
                  if (e.key === 'ArrowRight') isValid = dx > 0;
                  if (e.key === 'ArrowLeft') isValid = dx < 0;
                  if (e.key === 'ArrowDown') isValid = dy > 0;
                  if (e.key === 'ArrowUp') isValid = dy < 0;

                  if (isValid) {
                      // Weigh distance and angle. Prefer targets closer to the axis.
                      const dist = Math.sqrt(dx*dx + dy*dy);
                      // Angle penalty: prioritize nodes directly in direction
                      const angle = Math.atan2(Math.abs(dy), Math.abs(dx)); 
                      const score = dist * (1 + angle); // Simple heuristic

                      if (score < minDist) {
                          minDist = score;
                          bestCandidate = target;
                      }
                  }
              });

              if (bestCandidate) {
                  setSelectedNodeId((bestCandidate as Node).id);
              }
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, nodes]);

  const handleAddNode = (type: ElementType, label: string) => {
      const newNode: Node<UMLNodeData> = {
          id: `node-${Date.now()}`,
          type: 'umlNode',
          position: { x: Math.random() * 500, y: Math.random() * 500 },
          data: {
              label,
              type,
              attributes: [],
              methods: []
          }
      };
      setNodes(nds => [...nds, newNode]);
      setSelectedNodeId(newNode.id);
      addToast(`Created ${label}`, 'success');
      if (viewMode !== 'design' && viewMode !== 'entities') {
          setViewMode('design'); // Switch to view where we can see it usually
      }
  };

  const handleRunReasoner = () => {
      setIsReasonerActive((prev) => {
          const newState = !prev;
          if (newState) {
              addToast('Reasoner activated. Inferences computed.', 'success');
              setShowInferred(true); // Auto-show inferred edges when running
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
  };

  const handleLoadContent = async (content: string, fileName: string) => {
      try {
          let result: any = null;
          const lowerName = fileName.toLowerCase();
          
          if (lowerName.endsWith('.json')) {
              result = JSON.parse(content);
              if (result.nodes && result.edges) {
                  setNodes(result.nodes);
                  setEdges(result.edges);
                  if (result.metadata) setProjectData(result.metadata);
              }
          } else if (lowerName.endsWith('.ttl') || lowerName.endsWith('.nt')) {
              result = await parseTurtle(content);
          } else if (lowerName.endsWith('.rdf') || lowerName.endsWith('.xml') || lowerName.endsWith('.owl')) {
              result = parseRdfXml(content);
          } else if (lowerName.endsWith('.ofn')) {
              result = parseFunctionalSyntax(content);
          } else if (lowerName.endsWith('.omn') || lowerName.endsWith('.manchester')) {
              result = parseManchesterSyntax(content);
          } else {
              // Fallback to Turtle if unknown ext but looks like text
              result = await parseTurtle(content);
          }

          if (result && result.nodes) {
              setNodes(result.nodes);
              setEdges(result.edges || []);
              if (result.metadata) setProjectData(prev => ({ ...prev, ...result.metadata }));
              addToast(`Imported ${result.nodes.length} entities.`, 'success');
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

  const handleLoadUrl = async (url: string) => {
      try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const content = await response.text();
          const filename = url.split('/').pop() || 'download.ttl';
          await handleLoadContent(content, filename);
      } catch (e) {
          throw e; // Modal handles error display
      }
  };

  // Filter visible nodes based on "Show Individuals" toggle
  const visibleNodes = useMemo(() => {
      return showIndividuals 
        ? nodes 
        : nodes.filter(n => n.data.type !== ElementType.OWL_NAMED_INDIVIDUAL);
  }, [nodes, showIndividuals]);

  // Helper for derived edges (with inferences if enabled)
  // Must filter edges to ensuring both source and target exist in visibleNodes
  const displayEdges = useMemo(() => {
      let currentEdges = edges;
      if (isReasonerActive && showInferred) {
          currentEdges = computeInferredEdges(nodes, edges);
      }
      
      const visibleIds = new Set(visibleNodes.map(n => n.id));
      // Strict filtering: Source AND Target must be in visibleIds
      // This prevents ReactFlow crashing with "node not found" when edges point to hidden/filtered nodes
      return currentEdges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
  }, [nodes, edges, isReasonerActive, showInferred, visibleNodes]);

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [selectedNodeId, nodes]);

  // Sync sidebar visibility with view mode
  useEffect(() => {
      if (viewMode === 'design') {
          setIsSidebarOpen(true);
      }
  }, [viewMode]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
        <TopBar 
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
        />

        <div className="flex flex-1 overflow-hidden relative">
            {/* Left Sidebar (Only in Design Mode) */}
            {viewMode === 'design' && isSidebarOpen && (
                <Sidebar selectedNode={selectedNode} />
            )}

            {/* Main Content Area */}
            <div className="flex-1 relative bg-slate-950">
                {viewMode === 'design' && (
                    <ReactFlow
                        nodes={visibleNodes}
                        edges={displayEdges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        nodeTypes={nodeTypes}
                        fitView
                        className="bg-slate-950"
                        minZoom={0.1}
                        deleteKeyCode={null} // Disable default delete to use custom handler with dialog
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
                    </ReactFlow>
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
                        onExport={() => setIsSettingsOpen(true)}
                        onCreateClass={() => handleAddNode(ElementType.OWL_CLASS, 'NewClass')}
                    />
                )}

                {viewMode === 'entities' && (
                    <EntityCatalog 
                        nodes={nodes} 
                        edges={displayEdges} // Use displayEdges to show inferred relations
                        isReasonerActive={isReasonerActive}
                        onAddNode={handleAddNode}
                        onDeleteNode={handleDeleteNode}
                        onSelectNode={setSelectedNodeId}
                        selectedNodeId={selectedNodeId}
                        onViewInGraph={(id) => handleNavigate('design', id)}
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
                    <UMLVisualization nodes={visibleNodes} edges={edges} searchTerm={searchTerm} />
                )}

                {viewMode === 'peirce' && (
                    <PeirceVisualization nodes={visibleNodes} edges={edges} />
                )}

                {viewMode === 'concept' && (
                    <ConceptGraph 
                        nodes={visibleNodes} 
                        edges={displayEdges} // Use displayEdges for reasoning view
                        searchTerm={searchTerm}
                        selectedNodeId={selectedNodeId}
                        onNavigate={handleNavigate}
                    />
                )}

                {viewMode === 'owlviz' && (
                    <OWLVizVisualization 
                        nodes={visibleNodes} 
                        edges={displayEdges} // Use displayEdges for reasoning view
                        searchTerm={searchTerm} 
                        selectedNodeId={selectedNodeId} 
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

            {/* Properties Panel Sliding Container */}
            <div className={`transition-all duration-300 ease-in-out border-l border-slate-800 bg-slate-900 overflow-hidden ${selectedNode ? 'w-80 translate-x-0' : 'w-0 translate-x-full border-none'}`}>
                <PropertiesPanel 
                    selectedNode={selectedNode}
                    onUpdateNode={handleUpdateNode}
                    onDeleteNode={handleDeleteNode}
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
                    onClose={() => setSelectedNodeId(null)}
                />
            </div>
        </div>

        {/* Modals */}
        <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
            projectData={projectData}
            onUpdateProjectData={setProjectData}
            onNewProject={() => { setNodes([]); setEdges([]); setProjectData({ name: 'New Project', defaultPrefix: 'ex' }); }}
            onExportJSON={() => {}} // Todo: Implement logic similar to previous versions if needed or rely on code viewer
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
        />
        <CreateProjectModal 
            isOpen={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            onCreate={(data) => {
                setProjectData(data);
                setNodes([]);
                setEdges([]);
                if (data.file) handleImportFile(data.file);
                setIsCreateOpen(false);
            }}
        />
        <ValidationModal isOpen={isValidationOpen} onClose={() => setIsValidationOpen(false)} result={validationResult} />
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
            onImport={handleLoadUrl}
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
