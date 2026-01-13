
import React, { useMemo } from 'react';
import { X, Activity, Layers, Network, Database, GitGraph, Info, TrendingUp } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';

interface OntoMetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node<UMLNodeData>[];
  edges: Edge[];
}

interface MetricCardProps {
    title: string;
    value: string | number;
    subValue?: string;
    icon: React.ReactNode;
    description: string;
    color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subValue, icon, description, color }) => (
    <div className={`bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 relative overflow-hidden group hover:border-${color.split('-')[1]}-500/30 transition-all`}>
        <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
            {icon}
        </div>
        <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-md bg-slate-900 ${color}`}>
                    {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 16 }) : icon}
                </div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</h3>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-black text-slate-100">{value}</span>
                {subValue && <span className="text-xs font-mono text-slate-500">{subValue}</span>}
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed max-w-[90%]">
                {description}
            </p>
        </div>
    </div>
);

const OntoMetricsModal: React.FC<OntoMetricsModalProps> = ({ isOpen, onClose, nodes, edges }) => {
  
  const metrics = useMemo(() => {
      if (nodes.length === 0) return null;

      // --- 1. Complexity Counts ---
      const numClasses = nodes.filter(n => n.data.type === ElementType.OWL_CLASS).length;
      const numIndividuals = nodes.filter(n => n.data.type === ElementType.OWL_NAMED_INDIVIDUAL).length;
      const numObjProps = nodes.filter(n => n.data.type === ElementType.OWL_OBJECT_PROPERTY).length;
      const numDataProps = nodes.filter(n => n.data.type === ElementType.OWL_DATA_PROPERTY).length;
      const numAxioms = nodes.reduce((acc, n) => acc + (n.data.methods?.length || 0), 0) + edges.length;

      // --- 2. Hierarchy Analysis (Depth & Breadth) ---
      // Build Adjacency List for Classes (SubClassOf)
      // Map: Parent -> Children
      const classChildren = new Map<string, string[]>();
      const classParents = new Map<string, string[]>();
      const classIds = new Set<string>(nodes.filter(n => n.data.type === ElementType.OWL_CLASS).map(n => n.id));

      // Init maps
      classIds.forEach(id => {
          classChildren.set(id, []);
          classParents.set(id, []);
      });

      let inheritanceEdgesCount = 0;

      // Process Edges
      edges.forEach(e => {
          if (['subClassOf', 'rdfs:subClassOf'].includes(e.label as string) && classIds.has(e.source) && classIds.has(e.target)) {
              classChildren.get(e.target)?.push(e.source);
              classParents.get(e.source)?.push(e.target);
              inheritanceEdgesCount++;
          }
      });

      // Process Internal Axioms (Methods)
      nodes.forEach(n => {
          if (n.data.type === ElementType.OWL_CLASS) {
              n.data.methods.forEach(m => {
                  if (m.name.toLowerCase() === 'subclassof') {
                      // We need to resolve the target name to an ID to traverse
                      const targetNode = nodes.find(t => t.data.label === m.returnType && t.data.type === ElementType.OWL_CLASS);
                      if (targetNode) {
                          classChildren.get(targetNode.id)?.push(n.id);
                          classParents.get(n.id)?.push(targetNode.id);
                          inheritanceEdgesCount++;
                      }
                  }
              });
          }
      });

      // Calculate Depth (Max path from Root to Leaf)
      // Roots are nodes with no parents
      const roots = Array.from(classIds).filter(id => (classParents.get(id)?.length || 0) === 0);
      
      const getDepth = (id: string, currentDepth: number): number => {
          const children = classChildren.get(id) || [];
          if (children.length === 0) return currentDepth;
          return Math.max(...children.map(child => getDepth(child, currentDepth + 1)));
      };

      const maxDepth = roots.length > 0 ? Math.max(...roots.map(r => getDepth(r, 1))) : (classIds.size > 0 ? 1 : 0);

      // Calculate Breadth (Max Branching Factor)
      let maxBreadth = 0;
      classChildren.forEach(children => {
          if (children.length > maxBreadth) maxBreadth = children.length;
      });

      // --- 3. Inheritance Richness (IR) ---
      // Avg number of subclasses per class: |H| / |C|
      const inheritanceRichness = numClasses > 0 ? (inheritanceEdgesCount / numClasses) : 0;
      let irDesc = "Balanced hierarchy.";
      if (inheritanceRichness > 3) irDesc = "Very deep/specific hierarchy.";
      if (inheritanceRichness < 0.5 && numClasses > 1) irDesc = "Very flat hierarchy; lacks detail.";

      // --- 4. Cohesion (Relationship Richness) ---
      // Ratio of non-inheritance relationships to total relationships
      // |P| / (|H| + |P|)
      const hierarchyCount = inheritanceEdgesCount;
      // Count other relationships (Object Properties usage)
      let relationshipCount = 0;
      
      // From edges
      edges.forEach(e => {
          if (!['subClassOf', 'rdfs:subClassOf', 'rdf:type', 'a'].includes(e.label as string)) {
              relationshipCount++;
          }
      });
      // From axioms (Domain, Range, Some/Only restrictions)
      nodes.forEach(n => {
          n.data.methods.forEach(m => {
              if (!['subclassof', 'disjointwith'].includes(m.name.toLowerCase())) {
                  relationshipCount++;
              }
          });
      });

      const totalRels = hierarchyCount + relationshipCount;
      const cohesion = totalRels > 0 ? (relationshipCount / totalRels) : 0;
      
      let cohesionDesc = "Moderate connectivity.";
      if (cohesion > 0.6) cohesionDesc = "High cohesion; strongly interrelated entities.";
      if (cohesion < 0.2) cohesionDesc = "Low cohesion; mainly taxonomic structure.";

      return {
          complexity: { numClasses, numIndividuals, numObjProps, numDataProps, numAxioms },
          hierarchy: { maxDepth, maxBreadth },
          inheritanceRichness: inheritanceRichness.toFixed(2),
          irDesc,
          cohesion: (cohesion * 100).toFixed(1) + '%',
          cohesionDesc
      };
  }, [nodes, edges, isOpen]);

  if (!isOpen || !metrics) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-4xl bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-700 flex flex-col max-h-[85vh] overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-900/30 rounded-lg border border-blue-800 text-blue-400">
                 <Activity size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-100">OntoMetrics</h2>
                <p className="text-xs text-slate-400">Ontology Quality & Structural Analysis</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-2 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-950">
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Complexity Section */}
                <MetricCard 
                    title="Total Classes"
                    value={metrics.complexity.numClasses}
                    icon={<Database />}
                    description="Total number of concept definitions ($C$)."
                    color="text-indigo-400"
                />
                <MetricCard 
                    title="Properties"
                    value={metrics.complexity.numObjProps + metrics.complexity.numDataProps}
                    subValue={`(${metrics.complexity.numObjProps} Obj / ${metrics.complexity.numDataProps} Data)`}
                    icon={<Network />}
                    description="Total relations ($P$) and attributes defined."
                    color="text-blue-400"
                />
                <MetricCard 
                    title="Individuals"
                    value={metrics.complexity.numIndividuals}
                    icon={<Layers />}
                    description="Number of instantiated entities ($I$) in the ABox."
                    color="text-teal-400"
                />
                <MetricCard 
                    title="Logical Axioms"
                    value={metrics.complexity.numAxioms}
                    icon={<Info />}
                    description="Total explicit statements defining the logic."
                    color="text-slate-400"
                />
            </div>

            <div className="space-y-6">
                <h3 className="text-sm font-bold text-slate-300 border-b border-slate-800 pb-2 flex items-center gap-2">
                    <TrendingUp size={16} /> Structural Analysis
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <MetricCard 
                        title="Inheritance Richness"
                        value={metrics.inheritanceRichness}
                        icon={<GitGraph />}
                        description={`Average subclasses per class. ${metrics.irDesc}`}
                        color="text-emerald-400"
                    />
                    <MetricCard 
                        title="Cohesion"
                        value={metrics.cohesion}
                        icon={<Network />}
                        description={`Relationship Richness. ${metrics.cohesionDesc}`}
                        color="text-amber-400"
                    />
                </div>

                <div className="bg-slate-800/30 rounded-lg border border-slate-800 p-6 flex flex-col md:flex-row gap-8 items-center justify-between">
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 text-purple-400 font-bold mb-1">
                            <Layers size={18} /> Hierarchy Dimensions
                        </div>
                        <p className="text-xs text-slate-400">
                            Analyzes the shape of the taxonomy tree. Deep trees allow for fine-grained inference, while flat trees act more like simple categories.
                        </p>
                    </div>
                    <div className="flex gap-8">
                        <div className="text-center">
                            <div className="text-3xl font-black text-slate-200">{metrics.hierarchy.maxDepth}</div>
                            <div className="text-[10px] uppercase font-bold text-slate-500 mt-1">Max Depth</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-black text-slate-200">{metrics.hierarchy.maxBreadth}</div>
                            <div className="text-[10px] uppercase font-bold text-slate-500 mt-1">Max Breadth</div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default OntoMetricsModal;
