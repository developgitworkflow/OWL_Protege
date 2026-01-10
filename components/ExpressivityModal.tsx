import React, { useMemo } from 'react';
import { X, Calculator, Info, BookOpen, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';

interface ExpressivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node<UMLNodeData>[];
  edges: Edge[];
}

interface LogicFeature {
    code: string;
    name: string;
    description: string;
    detected: boolean;
    triggers: string[]; // List of element names that triggered this
}

const ExpressivityModal: React.FC<ExpressivityModalProps> = ({ isOpen, onClose, nodes, edges }) => {
  
  const analysis = useMemo(() => {
      const features: Record<string, LogicFeature> = {
          AL: { code: 'AL', name: 'Attributive Language', description: 'Base logic (Atomic negation, intersection, universal restriction)', detected: true, triggers: [] },
          C: { code: 'C', name: 'Complex Negation', description: 'Full negation/complement of arbitrary concepts', detected: true, triggers: [] }, // Assumed in OWL editors
          S: { code: 'S', name: 'Transitive Roles', description: 'Transitive properties (ALC + Transitivity)', detected: false, triggers: [] },
          H: { code: 'H', name: 'Role Hierarchy', description: 'Subproperties (rdfs:subPropertyOf)', detected: false, triggers: [] },
          O: { code: 'O', name: 'Nominals', description: 'Enumerated classes (OneOf) or value restrictions ({a})', detected: false, triggers: [] },
          I: { code: 'I', name: 'Inverse Roles', description: 'Inverse properties (owl:inverseOf)', detected: false, triggers: [] },
          N: { code: 'N', name: 'Number Restrictions', description: 'Unqualified cardinality (min/max/exactly)', detected: false, triggers: [] },
          Q: { code: 'Q', name: 'Qualified Number Restrictions', description: 'Cardinality on specific classes (min 2 hasChild.Girl)', detected: false, triggers: [] },
          D: { code: '(D)', name: 'Datatypes', description: 'Use of data properties and XML Schema types', detected: false, triggers: [] },
          R: { code: 'R', name: 'Role Chains', description: 'Complex role inclusions (property chains)', detected: false, triggers: [] },
      };

      // Scan Nodes
      nodes.forEach(node => {
          const label = node.data.label;

          // 1. Datatypes (D)
          if (node.data.type === ElementType.OWL_DATATYPE || node.data.type === ElementType.OWL_DATA_PROPERTY) {
              features.D.detected = true;
              features.D.triggers.push(label);
          }
          if (node.data.attributes?.some(a => a.type && a.type.startsWith('xsd:'))) {
              features.D.detected = true;
          }

          // 2. Transitive (S) logic marker
          if (node.data.type === ElementType.OWL_OBJECT_PROPERTY) {
              if (node.data.attributes?.some(a => a.name === 'Transitive')) {
                  features.S.detected = true;
                  features.S.triggers.push(label);
              }
              // Inverse (I)
              if (node.data.attributes?.some(a => a.name === 'InverseFunctional') || 
                  node.data.methods?.some(m => m.name.toLowerCase() === 'inverseof')) {
                  features.I.detected = true;
                  features.I.triggers.push(label);
              }
              // Hierarchy (H)
              if (node.data.methods?.some(m => m.name.toLowerCase() === 'subpropertyof')) {
                  features.H.detected = true;
                  features.H.triggers.push(label);
              }
              // Role Chains (R)
              if (node.data.methods?.some(m => m.name.toLowerCase() === 'propertychainaxiom')) {
                  features.R.detected = true;
                  features.R.triggers.push(label);
              }
          }

          // 3. Class Restrictions
          if (node.data.type === ElementType.OWL_CLASS) {
              node.data.methods?.forEach(m => {
                  const target = m.returnType;
                  
                  // Nominals (O) - OneOf
                  if (m.name.toLowerCase().includes('oneof') || target.includes('{')) {
                      features.O.detected = true;
                      features.O.triggers.push(`${label} (Enumeration)`);
                  }
                  
                  // Cardinality (N/Q)
                  if (target.match(/\b(min|max|exactly)\s+\d+/)) {
                      // Check if qualified
                      // Unqualified usually implies Thing, Qualified implies a Class
                      // Simplified heuristic: if it mentions a class name, it's Q.
                      const parts = target.split(/\s+/);
                      const hasClass = parts.some(p => 
                          p !== 'Thing' && p !== 'owl:Thing' && 
                          !['min','max','exactly','some','only','value','and','or','not'].includes(p.toLowerCase()) && 
                          isNaN(Number(p))
                      );

                      if (hasClass) {
                          features.Q.detected = true;
                          features.Q.triggers.push(`${label} (Qualified Card.)`);
                      } else {
                          features.N.detected = true;
                          features.N.triggers.push(`${label} (Card.)`);
                      }
                  }

                  // Value Restriction (O) - hasValue
                  if (target.includes(' value ')) {
                      features.O.detected = true;
                      features.O.triggers.push(`${label} (hasValue)`);
                  }
              });
          }
      });

      // Scan Edges
      edges.forEach(e => {
          if (e.label === 'rdfs:subPropertyOf' || e.label === 'subPropertyOf') {
              features.H.detected = true;
          }
          if (e.label === 'owl:inverseOf' || e.label === 'inverseOf') {
              features.I.detected = true;
          }
      });

      // Construct Formula
      // Base logic: ALC
      // If S is detected, it usually supersedes ALC -> S
      let base = 'ALC';
      if (features.S.detected) base = 'S';

      let formula = base;
      if (features.H.detected) formula += 'H';
      if (features.O.detected) formula += 'O';
      if (features.I.detected) formula += 'I';
      
      // Q supersedes N
      if (features.Q.detected) formula += 'Q';
      else if (features.N.detected) formula += 'N';

      if (features.R.detected) formula = 'SROIQ'; // OWL 2 jump usually implied by R
      
      if (features.D.detected) formula += '(D)';

      // Determine Profile
      let profile = "OWL Lite";
      let profileDesc = "Low complexity, suitable for large classifications.";
      let color = "text-green-400";

      // OWL Lite Constraints (Very rough approximation)
      // No Unions, No Complements (except disjoint), No OneOf, No HasValue, No Q, No R
      if (features.O.detected || features.Q.detected || features.R.detected || features.C.detected) {
          profile = "OWL DL";
          profileDesc = "Maximum expressivity while maintaining computational completeness (decidable).";
          color = "text-blue-400";
      }

      // SROIQ is OWL 2
      if (features.R.detected || (features.Q.detected && features.O.detected && features.I.detected)) {
          profile = "OWL 2 (SROIQ)";
          profileDesc = "The latest standard. Very high expressivity, includes property chains and qualified cardinality.";
          color = "text-purple-400";
      }

      return { formula, features, profile, profileDesc, color };
  }, [nodes, edges]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-3xl bg-slate-900 rounded-xl shadow-2xl ring-1 ring-slate-700 flex flex-col max-h-[85vh] overflow-hidden border border-slate-800 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-pink-900/30 rounded-lg border border-pink-800 text-pink-400">
                 <Calculator size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-100">Expressivity & Complexity</h2>
                <p className="text-xs text-slate-400">Description Logic Calculator</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-2 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-900">
            
            {/* Main Result */}
            <div className="flex flex-col items-center justify-center mb-10">
                <div className="text-sm text-slate-500 uppercase tracking-widest font-bold mb-2">Calculated Expressivity</div>
                <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 font-mono tracking-tight mb-4">
                    {analysis.formula}
                </div>
                <div className={`px-4 py-1 rounded-full bg-slate-800 border border-slate-700 text-sm font-bold ${analysis.color} flex items-center gap-2`}>
                    <CheckCircle2 size={16} />
                    {analysis.profile}
                </div>
                <p className="text-slate-400 text-sm mt-3 text-center max-w-md">
                    {analysis.profileDesc}
                </p>
            </div>

            {/* Translation Logic Info */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-8">
                <div className="flex items-start gap-3">
                    <BookOpen className="text-blue-400 shrink-0 mt-1" size={18} />
                    <div className="space-y-2">
                        <h3 className="text-sm font-bold text-slate-200">OWL ↔ Description Logic Mapping</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            OWL is based on Description Logics (DL). The complexity of an ontology is determined by the constructors used.
                        </p>
                        <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside ml-1">
                            <li><span className="text-slate-200 font-bold">OWL Lite</span> corresponds to <span className="font-mono text-pink-300">SHIN(D)</span> (roughly).</li>
                            <li><span className="text-slate-200 font-bold">OWL DL</span> corresponds to <span className="font-mono text-pink-300">SHOIN(D)</span>.</li>
                            <li><span className="text-slate-200 font-bold">OWL 2</span> corresponds to <span className="font-mono text-pink-300">SROIQ(D)</span>.</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.values(analysis.features).map((feat) => (
                    <div 
                        key={feat.code} 
                        className={`p-4 rounded-lg border transition-all ${
                            feat.detected 
                            ? 'bg-slate-800 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.1)]' 
                            : 'bg-slate-950 border-slate-800 opacity-60'
                        }`}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <span className={`text-xl font-mono font-bold ${feat.detected ? 'text-blue-400' : 'text-slate-600'}`}>
                                    {feat.code}
                                </span>
                                <span className="text-sm font-bold text-slate-300">{feat.name}</span>
                            </div>
                            {feat.detected && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>}
                        </div>
                        <p className="text-[11px] text-slate-500 mb-2">{feat.description}</p>
                        
                        {feat.triggers.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-700/50">
                                <span className="text-[10px] text-slate-500 uppercase font-bold">Detected In:</span>
                                <div className="text-[10px] text-slate-400 font-mono mt-1 break-words">
                                    {feat.triggers.slice(0, 3).join(', ')}
                                    {feat.triggers.length > 3 && `, +${feat.triggers.length - 3} more`}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

        </div>
      </div>
    </div>
  );
};

export default ExpressivityModal;
