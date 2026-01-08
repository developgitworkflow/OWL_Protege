import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, Attribute, Method } from '../types';

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

export const validateOntology = (nodes: Node<UMLNodeData>[], edges: Edge[]): ValidationResult => {
  const issues: ValidationIssue[] = [];

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

  // --- 3. Build Class Hierarchy & Disjointness Matrix ---
  const adjacency: Record<string, string[]> = {}; 
  const disjointPairs: [string, string][] = [];

  // Init adjacency
  nodes.forEach(n => adjacency[n.id] = []);

  // Populate from Edges
  edges.forEach(e => {
    const label = typeof e.label === 'string' ? e.label : '';
    if (label === 'rdfs:subClassOf' || label === 'subClassOf') {
        adjacency[e.source].push(e.target);
    }
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
              if (name === 'subclassof') adjacency[n.id].push(targetId);
              if (name === 'disjointwith') disjointPairs.push([n.id, targetId]);
          }

          // DisjointUnionOf / AllDisjointClasses
          if (name === 'disjointunionof' || name === 'alldisjointclasses') {
              const targets = m.returnType.replace(/[()]/g, '').trim().split(/\s+/);
              const ids = targets.map(t => labelToId[t]).filter(id => !!id);
              for (let i = 0; i < ids.length; i++) {
                   for (let j = i + 1; j < ids.length; j++) {
                       disjointPairs.push([ids[i], ids[j]]);
                   }
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
            issues.push({
                id: `cycle-${nodeId}`,
                elementId: nodeId,
                severity: 'error',
                title: 'Cyclic Inheritance',
                message: `Circular dependency: ${path.map(id => getLabel(id)).join(' -> ')} -> ${getLabel(childId)}.`
            });
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
                  message: `Property '${label}' is used as both ObjectProperty and DataProperty in the diagram (Punning violation).`
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
      const targetNode = nodeMap.get(e.target);
      // Valid assertions are Indiv -> Indiv (ObjectProp) OR Indiv -> Literal/Data (DataProp)
      
      if (sourceNode?.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
          let propId = labelToId[e.label as string];
          if (propId && propertyMeta[propId]) {
              facts.push({ subject: e.source, propertyId: propId, object: e.target, edgeId: e.id });
          }
      }
  });

  const groupedBySubjectProp: Record<string, string[]> = {}; 

  facts.forEach(f => {
      const prop = propertyMeta[f.propertyId];
      if (!prop) return;

      const key = `${f.subject}_${f.propertyId}`;
      if (!groupedBySubjectProp[key]) groupedBySubjectProp[key] = [];
      groupedBySubjectProp[key].push(f.object);

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
      
      // Domain/Range Check
      if (prop.domains.length > 0) {
          const subjectTypes = individualTypes[f.subject] || [];
          for (const typeId of subjectTypes) {
              for (const domainId of prop.domains) {
                  if (areClassesDisjoint(typeId, domainId)) {
                       issues.push({
                          id: `domain-clash-${f.edgeId}`,
                          elementId: f.edgeId,
                          severity: 'error',
                          title: 'Domain Violation',
                          message: `Individual '${getLabel(f.subject)}' is type '${getLabel(typeId)}', which is disjoint from the domain '${getLabel(domainId)}' of property '${prop.label}'.`
                      });
                  }
              }
          }
      }

      // Range check only applicable if target is Individual (ObjectProperty)
      // Data property range checks require checking value types (out of scope for graph check unless node holds type)
      if (prop.type === ElementType.OWL_OBJECT_PROPERTY && prop.ranges.length > 0) {
          const objectTypes = individualTypes[f.object] || [];
          for (const typeId of objectTypes) {
              for (const rangeId of prop.ranges) {
                  if (areClassesDisjoint(typeId, rangeId)) {
                       issues.push({
                          id: `range-clash-${f.edgeId}`,
                          elementId: f.edgeId,
                          severity: 'error',
                          title: 'Range Violation',
                          message: `Target '${getLabel(f.object)}' is type '${getLabel(typeId)}', which is disjoint from the range '${getLabel(rangeId)}' of property '${prop.label}'.`
                      });
                  }
              }
          }
      }
  });

  Object.entries(groupedBySubjectProp).forEach(([key, objects]) => {
      const [subjId, propId] = key.split('_');
      const prop = propertyMeta[propId];
      const distinctObjects = new Set(objects);
      
      if (prop && prop.characteristics.has('Functional') && distinctObjects.size > 1) {
          issues.push({
              id: `functional-${key}`,
              elementId: subjId,
              severity: 'error',
              title: 'Cardinality Violation',
              message: `Property '${prop.label}' is Functional (max 1), but '${getLabel(subjId)}' has ${distinctObjects.size} distinct values.`
          });
      }
  });

  Object.entries(individualTypes).forEach(([indivId, types]) => {
      for (let i = 0; i < types.length; i++) {
          for (let j = i + 1; j < types.length; j++) {
              if (areClassesDisjoint(types[i], types[j])) {
                   issues.push({
                      id: `indiv-disjoint-${indivId}-${i}-${j}`,
                      elementId: indivId,
                      severity: 'error',
                      title: 'Inconsistent Individual',
                      message: `Individual '${getLabel(indivId)}' belongs to disjoint classes '${getLabel(types[i])}' and '${getLabel(types[j])}'.`
                  });
              }
          }
      }
  });

  // --- 8. Structural Equivalence Check (OWL 2 Spec) ---
  const areStructurallyEquivalent = (n1: Node<UMLNodeData>, n2: Node<UMLNodeData>): boolean => {
      // 1. Same UML Class (e.g. both are OWL_CLASS)
      if (n1.data.type !== n2.data.type) return false;

      // 2. Attribute Equivalence (Unordered Set)
      const attrEq = (a: Attribute, b: Attribute) => 
          a.name === b.name && 
          a.type === b.type && 
          a.visibility === b.visibility && 
          !!a.isDerived === !!b.isDerived;

      const attrs1 = n1.data.attributes || [];
      const attrs2 = n2.data.attributes || [];
      if (!isSetEquivalent(attrs1, attrs2, attrEq)) return false;

      // 3. Axioms Equivalence (Mixed Set/List)
      const methodEq = (m1: Method, m2: Method) => {
          if (m1.name !== m2.name) return false;
          if (!!m1.isOrdered !== !!m2.isOrdered) return false;
          
          // Tokens are atomic values
          const tokens1 = m1.returnType.trim().split(/\s+/).filter(t => t);
          const tokens2 = m2.returnType.trim().split(/\s+/).filter(t => t);
          const atomicEq = (x: string, y: string) => x === y;

          if (m1.isOrdered) {
              return isListEquivalent(tokens1, tokens2, atomicEq);
          } else {
              return isSetEquivalent(tokens1, tokens2, atomicEq);
          }
      };

      const methods1 = n1.data.methods || [];
      const methods2 = n2.data.methods || [];
      if (!isSetEquivalent(methods1, methods2, methodEq)) return false;

      // 4. Edges Equivalence (Associations)
      // We assume order of edges doesn't matter (Unordered Set)
      const edges1 = edges.filter(e => e.source === n1.id);
      const edges2 = edges.filter(e => e.source === n2.id);

      const edgeEq = (e1: Edge, e2: Edge) => {
          if (e1.label !== e2.label) return false;
          // For structure, we compare the 'value' of the target.
          // In this model, the value is the Label/IRI of the target node.
          const t1 = nodeMap.get(e1.target);
          const t2 = nodeMap.get(e2.target);
          if (!t1 || !t2) return false; // Should not happen if graph is valid
          return t1.data.label === t2.data.label; 
      };

      if (!isSetEquivalent(edges1, edges2, edgeEq)) return false;

      return true;
  };

  // Run Structural Equivalence check on all pairs
  const processed = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
      if (processed.has(nodes[i].id)) continue;
      
      const duplicates: string[] = [];
      for (let j = i + 1; j < nodes.length; j++) {
          if (areStructurallyEquivalent(nodes[i], nodes[j])) {
              duplicates.push(nodes[j].id);
              processed.add(nodes[j].id);
          }
      }

      if (duplicates.length > 0) {
          issues.push({
              id: `struct-equiv-${nodes[i].id}`,
              elementId: nodes[i].id,
              severity: 'warning',
              title: 'Structural Equivalence Detected',
              message: `This entity is structurally equivalent to ${duplicates.length} other entit${duplicates.length > 1 ? 'ies' : 'y'} (${duplicates.map(id => getLabel(id)).join(', ')}). This may indicate redundant definitions.`
          });
      }
  }

  return {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    issues
  };
};