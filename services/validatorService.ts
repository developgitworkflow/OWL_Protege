
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, Attribute, Method, ProjectData } from '../types';

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  elementId?: string;
  severity: IssueSeverity;
  title: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  unsatisfiableNodeIds: string[]; // IDs of classes found to be unsatisfiable
  punnedNodeIds: string[]; // IDs of entities involved in metamodeling
}

// --- Helpers for Structural Equivalence ---

// Check if two lists are equivalent (Ordered Association)
const isListEquivalent = <T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): boolean => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (!eq(a[i], b[i])) return false;
    }
    return true;
};

// Check if two sets are equivalent (Unordered Association)
const isSetEquivalent = <T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): boolean => {
    if (a.length !== b.length) return false;
    const matchedIndices = new Set<number>();
    
    for (const itemA of a) {
        let found = false;
        for (let i = 0; i < b.length; i++) {
            if (!matchedIndices.has(i) && eq(itemA, b[i])) {
                matchedIndices.add(i);
                found = true;
                break;
            }
        }
        if (!found) return false;
    }
    return true;
};

export const validateOntology = (nodes: Node<UMLNodeData>[], edges: Edge[], metadata?: ProjectData): ValidationResult => {
  const issues: ValidationIssue[] = [];
  const unsatisfiableNodeIds = new Set<string>();
  const punnedNodeIds = new Set<string>();

  // --- 1. Build Index Maps ---
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const labelToId: Record<string, string> = {};
  
  nodes.forEach(n => {
      labelToId[n.data.label] = n.id;
      // Handle prefix lookup (e.g., "ex:Person" -> "Person")
      if (n.data.label.includes(':')) {
          const parts = n.data.label.split(':');
          if (parts.length > 1) labelToId[parts[1]] = n.id;
      }
      // Handle IRI lookup
      if (n.data.iri) {
          labelToId[n.data.iri] = n.id;
      }
  });

  const getLabel = (id: string) => nodeMap.get(id)?.data.label || id;

  // --- 2. Syntax & Structure Checks ---
  nodes.forEach(node => {
    if (node.data.iri && /\s/.test(node.data.iri)) {
      issues.push({
        id: `iri-space-${node.id}`,
        elementId: node.id,
        severity: 'error',
        title: 'Invalid IRI Syntax',
        message: `IRI '${node.data.iri}' contains spaces.`
      });
    }

    node.data.methods.forEach(m => {
        if (!m.returnType || m.returnType.trim() === '') {
             issues.push({
                id: `axiom-empty-${m.id}`,
                elementId: node.id,
                severity: 'warning',
                title: 'Incomplete Axiom',
                message: `Axiom '${m.name}' has no target.`
             });
        }
    });
  });

  // --- 3. Build Class Hierarchy ---
  const adjacency: Record<string, string[]> = {}; 
  const disjointPairs: [string, string][] = [];
  
  // Init adjacency
  nodes.forEach(n => adjacency[n.id] = []);

  // Populate from Edges
  edges.forEach(e => {
    const label = typeof e.label === 'string' ? e.label : '';
    
    // SubClassOf (Class -> Class)
    if (label === 'rdfs:subClassOf' || label === 'subClassOf') {
        adjacency[e.source].push(e.target);
    }
    
    // Disjoint (Class -> Class)
    if (label === 'owl:disjointWith' || label.includes('disjoint')) {
        disjointPairs.push([e.source, e.target]);
    }
  });

  // Populate from Axioms
  nodes.forEach(n => {
      n.data.methods.forEach(m => {
          const name = m.name.toLowerCase().replace(/[^a-z]/g, '');
          const targetId = labelToId[m.returnType.trim()]; // Simple resolution
          
          if (targetId) {
              if (name === 'subclassof') {
                  adjacency[n.id].push(targetId);
              }
              if (name === 'disjointwith') {
                  disjointPairs.push([n.id, targetId]);
              }
          }
      });
  });

  // Cycle Detection (DFS)
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function isCyclic(nodeId: string, path: string[]): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    const children = adjacency[nodeId] || [];
    for (const childId of children) {
        if (!visited.has(childId)) {
            if (isCyclic(childId, [...path, childId])) return true;
        } else if (recursionStack.has(childId)) {
            const issueId = `cycle-${nodeId}`;
            issues.push({
                id: issueId,
                elementId: nodeId,
                severity: 'error',
                title: 'Cyclic Inheritance',
                message: `Circular dependency: ${path.map(id => getLabel(id)).join(' -> ')} -> ${getLabel(childId)}.`
            });
            // Mark all in cycle as potentially problematic, mostly structural error
            return true;
        }
    }
    recursionStack.delete(nodeId);
    return false;
  }

  nodes.forEach(n => {
      if (n.data.type === ElementType.OWL_CLASS && !visited.has(n.id)) {
          isCyclic(n.id, [n.id]);
      }
  });

  // Transitive Closure for Ancestors
  const ancestors: Record<string, Set<string>> = {};
  const getAncestors = (id: string): Set<string> => {
      if (ancestors[id]) return ancestors[id];
      const set = new Set<string>();
      const parents = adjacency[id] || [];
      for (const p of parents) {
          set.add(p);
          const grandParents = getAncestors(p);
          grandParents.forEach(gp => set.add(gp));
      }
      ancestors[id] = set;
      return set;
  };
  nodes.forEach(n => getAncestors(n.id));

  // Helper: Check logical disjointness between two classes
  const areClassesDisjoint = (clsA: string, clsB: string): boolean => {
      if (clsA === clsB) return false; // Self is not disjoint from self (unless unsatisfiable)
      const ancA = getAncestors(clsA);
      const ancB = getAncestors(clsB);
      
      for (const [x, y] of disjointPairs) {
          // Check if clsA IS x or SubClassOf x, AND clsB IS y or SubClassOf y (or vice versa)
          const aIsX = clsA === x || ancA.has(x);
          const bIsY = clsB === y || ancB.has(y);
          if (aIsX && bIsY) return true;

          const aIsY = clsA === y || ancA.has(y);
          const bIsX = clsB === x || ancB.has(x);
          if (aIsY && bIsX) return true;
      }
      return false;
  };

  // --- 4. Class Unsatisfiability Check ---
  nodes.forEach(n => {
      if (n.data.type === ElementType.OWL_CLASS) {
          const myAncestors = Array.from(getAncestors(n.id));
          // Check self against ancestors for disjointness (e.g. A sub B, A disjoint B)
          for (const anc of myAncestors) {
             if (areClassesDisjoint(n.id, anc)) {
                  unsatisfiableNodeIds.add(n.id);
                  issues.push({
                      id: `unsat-self-${n.id}`,
                      elementId: n.id,
                      severity: 'error',
                      title: 'Unsatisfiable Class',
                      message: `Class '${n.data.label}' is inconsistent because it inherits from disjoint class '${getLabel(anc)}'.`
                  });
             }
          }
          // Check ancestors against each other
          for (let i=0; i<myAncestors.length; i++) {
              for (let j=i+1; j<myAncestors.length; j++) {
                  if (areClassesDisjoint(myAncestors[i], myAncestors[j])) {
                      unsatisfiableNodeIds.add(n.id);
                      issues.push({
                          id: `unsat-anc-${n.id}-${i}`,
                          elementId: n.id,
                          severity: 'error',
                          title: 'Unsatisfiable Class',
                          message: `Class '${n.data.label}' cannot inherit from both '${getLabel(myAncestors[i])}' and '${getLabel(myAncestors[j])}'.`
                      });
                  }
              }
          }
      }
  });

  // --- 5. Property Metadata Collection (Domain, Range, Characteristics) ---
  interface PropMeta {
      id: string;
      label: string;
      type: ElementType.OWL_OBJECT_PROPERTY | ElementType.OWL_DATA_PROPERTY | 'Unknown';
      characteristics: Set<string>;
      domains: string[];
      ranges: string[];
  }
  const propertyMeta: Record<string, PropMeta> = {};

  // Initialize explicit properties
  nodes.forEach(n => {
      if (n.data.type === ElementType.OWL_OBJECT_PROPERTY || n.data.type === ElementType.OWL_DATA_PROPERTY) {
          const characteristics = new Set<string>();
          const domains: string[] = [];
          const ranges: string[] = [];

          n.data.attributes.forEach(attr => characteristics.add(attr.name)); 
          n.data.methods.forEach(m => {
              const name = m.name.toLowerCase();
              const targetId = labelToId[m.returnType.trim()];
              if (targetId) {
                  if (name === 'domain') domains.push(targetId);
                  if (name === 'range') ranges.push(targetId);
              }
          });

          propertyMeta[n.id] = { id: n.id, label: n.data.label, type: n.data.type, characteristics, domains, ranges };
          labelToId[n.data.label] = n.id;
      }
  });

  // --- 6. Edge Property Type Inference & Validation ---
  const STANDARD_LABELS = new Set(['rdf:type', 'a', 'rdfs:subClassOf', 'subClassOf', 'owl:disjointWith', 'disjointWith']);
  
  // Track inferred usage of properties that aren't explicit nodes
  const inferredUsage: Record<string, 'Object' | 'Data' | 'Ambiguous'> = {};

  edges.forEach(e => {
      const label = e.label as string;
      if (!label || STANDARD_LABELS.has(label)) return;

      const targetNode = nodeMap.get(e.target);
      if (!targetNode) return;

      const explicitPropId = labelToId[label] || labelToId[label.split(':')[1] || ''];
      
      // Determine implied type based on target
      const targetIsDatatype = targetNode.data.type === ElementType.OWL_DATATYPE;
      const usageType = targetIsDatatype ? ElementType.OWL_DATA_PROPERTY : ElementType.OWL_OBJECT_PROPERTY;

      // 1. Validate against explicit definition
      if (explicitPropId && propertyMeta[explicitPropId]) {
          const def = propertyMeta[explicitPropId];
          if (def.type !== usageType) {
              issues.push({
                  id: `prop-type-mismatch-${e.id}`,
                  elementId: e.id,
                  severity: 'error',
                  title: 'Property Type Mismatch',
                  message: `Property '${label}' is defined as ${def.type === ElementType.OWL_OBJECT_PROPERTY ? 'ObjectProperty' : 'DataProperty'}, but is connected to a ${targetIsDatatype ? 'Datatype' : 'Class/Individual'}.`
              });
          }
      } 
      // 2. Validate consistency of inferred usage
      else {
          const currentUsage = inferredUsage[label];
          const newUsage = targetIsDatatype ? 'Data' : 'Object';
          
          if (!currentUsage) {
              inferredUsage[label] = newUsage;
          } else if (currentUsage !== newUsage && currentUsage !== 'Ambiguous') {
              inferredUsage[label] = 'Ambiguous';
              issues.push({
                  id: `prop-ambiguous-${e.id}`,
                  elementId: e.id,
                  severity: 'error',
                  title: 'Ambiguous Property Usage',
                  message: `Property '${label}' is used as both ObjectProperty and DataProperty in the diagram.`
              });
          }
      }
  });

  // --- 7. Individual Assertion Logic ---
  
  interface Fact { subject: string; propertyId: string; object: string; edgeId: string; }
  const facts: Fact[] = [];
  const individualTypes: Record<string, string[]> = {};

  edges.forEach(e => {
      const isTypeEdge = e.label === 'rdf:type' || e.label === 'a';
      if (isTypeEdge) {
          if (!individualTypes[e.source]) individualTypes[e.source] = [];
          individualTypes[e.source].push(e.target);
      }
  });

  edges.forEach(e => {
      const sourceNode = nodeMap.get(e.source);
      // Valid assertions are Indiv -> Indiv (ObjectProp) OR Indiv -> Literal/Data (DataProp)
      
      if (sourceNode?.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
          let propId = labelToId[e.label as string];
          if (propId && propertyMeta[propId]) {
              facts.push({ subject: e.source, propertyId: propId, object: e.target, edgeId: e.id });
          }
      }
  });

  // Check characteristics violations (Irreflexive, Asymmetric)
  facts.forEach(f => {
      const prop = propertyMeta[f.propertyId];
      if (!prop) return;

      if (prop.characteristics.has('Irreflexive') && f.subject === f.object) {
          issues.push({
              id: `irreflexive-${f.edgeId}`,
              elementId: f.edgeId,
              severity: 'error',
              title: 'Irreflexive Violation',
              message: `Property '${prop.label}' is Irreflexive, but connects '${getLabel(f.subject)}' to itself.`
          });
      }

      if (prop.characteristics.has('Asymmetric')) {
          const inverseExists = facts.some(inv => 
              inv.propertyId === f.propertyId && 
              inv.subject === f.object && 
              inv.object === f.subject
          );
          if (inverseExists) {
               issues.push({
                  id: `asymmetric-${f.edgeId}`,
                  elementId: f.edgeId,
                  severity: 'error',
                  title: 'Asymmetry Violation',
                  message: `Property '${prop.label}' is Asymmetric, but is used bidirectionally between '${getLabel(f.subject)}' and '${getLabel(f.object)}'.`
              });
          }
      }
  });

  // --- 8. Structural Equivalence Check ---
  const processed = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
      if (processed.has(nodes[i].id)) continue;
      
      // Simplified equivalence check for this context
      for (let j = i + 1; j < nodes.length; j++) {
          if (nodes[i].data.label === nodes[j].data.label && nodes[i].data.type === nodes[j].data.type && nodes[i].data.iri === nodes[j].data.iri) {
              issues.push({
                  id: `duplicate-${nodes[i].id}`,
                  elementId: nodes[i].id,
                  severity: 'warning',
                  title: 'Duplicate Entity',
                  message: `Entity '${getLabel(nodes[i].id)}' appears to be duplicated.`
              });
          }
      }
  }

  return {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    unsatisfiableNodeIds: Array.from(unsatisfiableNodeIds),
    punnedNodeIds: Array.from(punnedNodeIds)
  };
};
