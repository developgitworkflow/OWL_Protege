import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';

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

export const validateOntology = (nodes: Node<UMLNodeData>[], edges: Edge[]): ValidationResult => {
  const issues: ValidationIssue[] = [];

  // 1. Build Lookup Maps
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const adjacency: Record<string, string[]> = {}; // For subclass hierarchy
  const labelToId: Record<string, string> = {};

  nodes.forEach(n => {
      adjacency[n.id] = [];
      labelToId[n.data.label] = n.id;
      // Handle prefix if present in label for lookup
      if (n.data.label.includes(':')) {
          const parts = n.data.label.split(':');
          labelToId[parts[1]] = n.id;
      }
  });

  // 2. Structural & Syntax Checks
  nodes.forEach(node => {
    // Check IRI syntax
    if (node.data.iri && /\s/.test(node.data.iri)) {
      issues.push({
        id: `iri-space-${node.id}`,
        elementId: node.id,
        severity: 'error',
        title: 'Invalid IRI Syntax',
        message: `IRI for '${node.data.label}' contains spaces. IRIs must be valid URIs.`
      });
    }

    // Check Attributes (Data Properties)
    node.data.attributes.forEach(attr => {
        if (!attr.type) {
             issues.push({
                id: `attr-missing-type-${attr.id}`,
                elementId: node.id,
                severity: 'warning',
                title: 'Missing Datatype',
                message: `Data property '${attr.name}' in '${node.data.label}' has no type specified.`
            });
        }
        if (/\s/.test(attr.name)) {
             issues.push({
                id: `attr-name-space-${attr.id}`,
                elementId: node.id,
                severity: 'warning',
                title: 'Not a valid QName',
                message: `Property '${attr.name}' contains spaces. Consider using camelCase.`
             });
        }
    });

    // Check Axioms syntax
    node.data.methods.forEach(m => {
        if (!m.returnType || m.returnType.trim() === '') {
             issues.push({
                id: `axiom-empty-${m.id}`,
                elementId: node.id,
                severity: 'error',
                title: 'Incomplete Axiom',
                message: `Axiom '${m.name}' has no target defined.`
             });
        }
    });
  });

  // 3. Logical Checks: Hierarchy Construction
  
  // Add edge-based subclass relations
  edges.forEach(e => {
    const label = typeof e.label === 'string' ? e.label : '';
    if (label === 'rdfs:subClassOf' || label === 'subClassOf') {
        if (adjacency[e.source]) adjacency[e.source].push(e.target);
    }
  });

  // Add axiom-based subclass relations (heuristic: matches name label)
  nodes.forEach(n => {
      n.data.methods.forEach(m => {
          if (m.name.toLowerCase() === 'subclassof') {
              const targetLabel = m.returnType.trim();
              const targetId = labelToId[targetLabel];
              if (targetId && targetId !== n.id) {
                  adjacency[n.id].push(targetId);
              }
          }
      });
  });

  // 4. Cycle Detection (DFS)
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
            // Cycle found
            const node = nodeMap.get(nodeId);
            issues.push({
                id: `cycle-${nodeId}`,
                elementId: nodeId,
                severity: 'error',
                title: 'Cyclic Inheritance',
                message: `Circular dependency detected: ${path.map(id => nodeMap.get(id)?.data.label).join(' -> ')} -> ${nodeMap.get(childId)?.data.label}. A class cannot be a subclass of itself.`
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

  // 5. Unsatisfiability (Disjointness)
  const disjointPairs: [string, string][] = [];
  
  // Collect disjoints from edges
  edges.forEach(e => {
      const label = typeof e.label === 'string' ? e.label : '';
      if (label === 'owl:disjointWith' || label.toLowerCase().includes('disjoint')) {
          disjointPairs.push([e.source, e.target]);
      }
  });

  // Collect disjoints from Axioms
  nodes.forEach(n => {
      n.data.methods.forEach(m => {
           const axiomName = m.name.toLowerCase().replace(/[^a-z]/g, '');
           
           // Direct DisjointWith
           if (axiomName === 'disjointwith') {
               const targetId = labelToId[m.returnType.trim()];
               if (targetId) {
                   disjointPairs.push([n.id, targetId]);
               }
           }
           
           // DisjointUnionOf (A B C) -> Implies Pairwise Disjointness between A, B, C
           // Also implies n is equivalent to Union(A, B, C), but for consistency we care about disjointness
           else if (axiomName === 'disjointunionof' || axiomName === 'alldisjointclasses') {
               // Heuristic parser: Remove parens, split by space
               const targets = m.returnType.replace(/[()]/g, '').trim().split(/\s+/);
               const ids = targets.map(t => labelToId[t]).filter(id => !!id);
               
               // Pairwise disjointness
               for (let i = 0; i < ids.length; i++) {
                   for (let j = i + 1; j < ids.length; j++) {
                       disjointPairs.push([ids[i], ids[j]]);
                   }
               }
           }
      });
  });

  // Compute all ancestors for each node (Transitive Closure of SubClassOf)
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
  }

  nodes.forEach(n => getAncestors(n.id));

  // Check if any node inherits from two disjoint classes
  nodes.forEach(n => {
      if (n.data.type === ElementType.OWL_CLASS) {
          const myAncestors = ancestors[n.id] || new Set();
          
          for (const [a, b] of disjointPairs) {
              // A node is conflicting if it IS 'a' OR inherits 'a', AND IS 'b' OR inherits 'b'
              const isA = n.id === a || myAncestors.has(a);
              const isB = n.id === b || myAncestors.has(b);
              
              if (isA && isB) {
                  const labelA = nodeMap.get(a)?.data.label;
                  const labelB = nodeMap.get(b)?.data.label;
                  issues.push({
                      id: `unsat-${n.id}-${a}-${b}`,
                      elementId: n.id,
                      severity: 'error',
                      title: 'Unsatisfiable Class',
                      message: `Class '${n.data.label}' is logically impossible (Nothing) because it inherits from disjoint classes '${labelA}' and '${labelB}'.`
                  });
              }
          }
      }
  });

  // 6. Individual Consistency
  // Check if an individual is typed with an unsatisfiable class or two disjoint classes
  nodes.forEach(n => {
      if (n.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
          // Find type edges
          const typeEdges = edges.filter(e => e.source === n.id && (e.label === 'rdf:type' || e.label === 'a'));
          const explicitTypes = typeEdges.map(e => e.target);
          
          // Check if explicit types are disjoint
           for (const [a, b] of disjointPairs) {
              if (explicitTypes.includes(a) && explicitTypes.includes(b)) {
                   const labelA = nodeMap.get(a)?.data.label;
                   const labelB = nodeMap.get(b)?.data.label;
                   issues.push({
                      id: `indiv-unsat-${n.id}`,
                      elementId: n.id,
                      severity: 'error',
                      title: 'Inconsistent Individual',
                      message: `Individual '${n.data.label}' cannot belong to both '${labelA}' and '${labelB}' as they are disjoint.`
                  });
              }
           }
           
           // Check if any type is an unsatisfiable class (inherits from disjoints)
           // We do this by checking if any 'explicitType' is 'unsat' (based on the previous check loop, but strictly we need to re-verify)
           // A simpler way: Check if an individual's inferred types contain disjoints.
           
           const individualAncestors = new Set<string>();
           explicitTypes.forEach(t => {
               individualAncestors.add(t);
               getAncestors(t).forEach(a => individualAncestors.add(a));
           });

           for (const [a, b] of disjointPairs) {
               if (individualAncestors.has(a) && individualAncestors.has(b)) {
                   const labelA = nodeMap.get(a)?.data.label;
                   const labelB = nodeMap.get(b)?.data.label;
                   // Avoid duplicate reporting if handled by explicit types
                   if (!explicitTypes.includes(a) || !explicitTypes.includes(b)) {
                       issues.push({
                           id: `indiv-inferred-unsat-${n.id}-${a}-${b}`,
                           elementId: n.id,
                           severity: 'error',
                           title: 'Inconsistent Individual (Inferred)',
                           message: `Individual '${n.data.label}' is inconsistent because its types imply membership in disjoint classes '${labelA}' and '${labelB}'.`
                       });
                   }
               }
           }
      }
  });

  return {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    issues
  };
};