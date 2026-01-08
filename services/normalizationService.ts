import { Node } from 'reactflow';
import { UMLNodeData } from '../types';

/**
 * Flattens OWL 2 class expressions by removing duplicates in Set-based axioms.
 * Example: ObjectUnionOf( a:Person a:Animal a:Animal ) -> ObjectUnionOf( a:Person a:Animal )
 */
export const normalizeOntology = (nodes: Node<UMLNodeData>[]): Node<UMLNodeData>[] => {
  return nodes.map(node => {
    // If no methods, skip
    if (!node.data.methods || node.data.methods.length === 0) return node;

    const newMethods = node.data.methods.map(method => {
        // If explicitly marked ordered (e.g. PropertyChain), skip deduplication
        if (method.isOrdered) return method;

        const name = method.name.toLowerCase().replace(/[^a-z]/g, '');
        
        // Axioms that represent Sets of entities (Unordered, Non-unique not allowed)
        // Based on OWL 2 Structural Specification
        const setAxioms = [
            'unionof',              // ObjectUnionOf, DataUnionOf
            'intersectionof',       // ObjectIntersectionOf, DataIntersectionOf
            'oneof',                // ObjectOneOf, DataOneOf
            'disjointunionof',      // DisjointUnion
            'equivalentto',         // EquivalentClasses
            'equivalentclass',
            'equivalentproperty',
            'disjointwith',         // DisjointClasses (pairwise or set)
            'sameas',               // SameIndividual
            'differentfrom',        // DifferentIndividuals
            'haskey',               // HasKey
            'alldisjointclasses',
            'alldisjointproperties'
        ];

        // Check if current method is a Set axiom
        if (setAxioms.some(ax => name.includes(ax))) {
             // Split by whitespace to get individual tokens (IRIs/ClassNames)
             const tokens = method.returnType.split(/\s+/).filter(t => t.trim().length > 0);
             
             // Create Set to deduplicate
             const unique = Array.from(new Set(tokens));
             
             // Only return new object if changed
             if (unique.length !== tokens.length) {
                 return { ...method, returnType: unique.join(' ') };
             }
        }
        return method;
    });
    
    return { ...node, data: { ...node.data, methods: newMethods } };
  });
};