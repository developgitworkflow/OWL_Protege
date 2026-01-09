import { describe, it, expect } from 'vitest';
import { validateOntology } from './validatorService';
import { ElementType, UMLNodeData } from '../types';
import { Node, Edge } from 'reactflow';

// Helper to create mock nodes easily
const createNode = (id: string, label: string, type: ElementType, methods: any[] = []): Node<UMLNodeData> => ({
    id,
    type: 'umlNode',
    position: { x: 0, y: 0 },
    data: { label, type, attributes: [], methods }
});

describe('Validator Service', () => {
    
    describe('Cycle Detection', () => {
        it('should detect cyclic inheritance in class hierarchy', () => {
            const nodes = [
                createNode('1', 'A', ElementType.OWL_CLASS),
                createNode('2', 'B', ElementType.OWL_CLASS),
                createNode('3', 'C', ElementType.OWL_CLASS),
            ];
            const edges: Edge[] = [
                { id: 'e1', source: '1', target: '2', label: 'subClassOf' }, // A sub B
                { id: 'e2', source: '2', target: '3', label: 'subClassOf' }, // B sub C
                { id: 'e3', source: '3', target: '1', label: 'subClassOf' }, // C sub A (Cycle)
            ];

            const result = validateOntology(nodes, edges);
            expect(result.isValid).toBe(false);
            expect(result.issues.some(i => i.title === 'Cyclic Inheritance')).toBe(true);
        });

        it('should not flag non-cyclic hierarchies', () => {
            const nodes = [
                createNode('1', 'A', ElementType.OWL_CLASS),
                createNode('2', 'B', ElementType.OWL_CLASS),
            ];
            const edges: Edge[] = [
                { id: 'e1', source: '2', target: '1', label: 'subClassOf' }, // B sub A
            ];

            const result = validateOntology(nodes, edges);
            expect(result.isValid).toBe(true);
        });
    });

    describe('Class Unsatisfiability', () => {
        it('should detect inconsistency when inheriting from disjoint classes', () => {
            const nodes = [
                createNode('1', 'Animal', ElementType.OWL_CLASS),
                createNode('2', 'Plant', ElementType.OWL_CLASS),
                createNode('3', 'Triffid', ElementType.OWL_CLASS),
            ];
            const edges: Edge[] = [
                { id: 'e1', source: '1', target: '2', label: 'owl:disjointWith' }, // Animal disjoint Plant
                { id: 'e2', source: '3', target: '1', label: 'subClassOf' }, // Triffid sub Animal
                { id: 'e3', source: '3', target: '2', label: 'subClassOf' }, // Triffid sub Plant
            ];

            const result = validateOntology(nodes, edges);
            expect(result.isValid).toBe(false);
            expect(result.issues.some(i => i.title === 'Unsatisfiable Class')).toBe(true);
        });
    });

    describe('Individual Consistency', () => {
        it('should detect disjoint type assertions on an individual', () => {
             const nodes = [
                createNode('1', 'Cat', ElementType.OWL_CLASS),
                createNode('2', 'Dog', ElementType.OWL_CLASS),
                createNode('3', 'Fido', ElementType.OWL_NAMED_INDIVIDUAL),
            ];
            const edges: Edge[] = [
                { id: 'e1', source: '1', target: '2', label: 'owl:disjointWith' }, // Cat disjoint Dog
                { id: 'e2', source: '3', target: '1', label: 'rdf:type' }, // Fido is Cat
                { id: 'e3', source: '3', target: '2', label: 'rdf:type' }, // Fido is Dog
            ];

            const result = validateOntology(nodes, edges);
            expect(result.isValid).toBe(false);
            expect(result.issues.some(i => i.title === 'Inconsistent Individual')).toBe(true);
        });
    });

    describe('Property Type Checking', () => {
        it('should flag ambiguous property usage (Punning violation)', () => {
            const nodes = [
                createNode('1', 'A', ElementType.OWL_CLASS),
                createNode('2', 'B', ElementType.OWL_CLASS),
                createNode('3', 'D', ElementType.OWL_DATATYPE),
            ];
            const edges: Edge[] = [
                { id: 'e1', source: '1', target: '2', label: 'hasProp' }, // Object Property usage
                { id: 'e2', source: '1', target: '3', label: 'hasProp' }, // Data Property usage
            ];

            const result = validateOntology(nodes, edges);
            expect(result.isValid).toBe(false);
            expect(result.issues.some(i => i.title === 'Ambiguous Property Usage')).toBe(true);
        });
    });
});