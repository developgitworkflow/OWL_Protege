import { describe, it, expect } from 'vitest';
import { classifyOntology, executeDLQuery } from './reasonerService';
import { ElementType, UMLNodeData } from '../types';
import { Node, Edge } from 'reactflow';

const createNode = (id: string, label: string, type: ElementType): Node<UMLNodeData> => ({
    id,
    type: 'umlNode',
    position: { x: 0, y: 0 },
    data: { label, type, attributes: [], methods: [] }
});

describe('Reasoner Service', () => {
    
    describe('Hierarchy Classification', () => {
        it('should infer transitive subclasses', () => {
            const nodes = [
                createNode('1', 'LivingThing', ElementType.OWL_CLASS),
                createNode('2', 'Animal', ElementType.OWL_CLASS),
                createNode('3', 'Cat', ElementType.OWL_CLASS),
            ];
            const edges: Edge[] = [
                { id: 'e1', source: '2', target: '1', label: 'subClassOf' }, // Animal sub LivingThing
                { id: 'e2', source: '3', target: '2', label: 'subClassOf' }, // Cat sub Animal
            ];

            const index = classifyOntology(nodes, edges);
            
            // Check if Cat (3) is inferred as subclass of LivingThing (1)
            expect(index.subClassOf['3'].has('1')).toBe(true);
            // Check if LivingThing (1) knows about descendant Cat (3)
            expect(index.superClassOf['1'].has('3')).toBe(true);
        });
    });

    describe('Instance Inference', () => {
        it('should infer types based on class hierarchy', () => {
             const nodes = [
                createNode('1', 'Person', ElementType.OWL_CLASS),
                createNode('2', 'Student', ElementType.OWL_CLASS),
                createNode('3', 'John', ElementType.OWL_NAMED_INDIVIDUAL),
            ];
            const edges: Edge[] = [
                { id: 'e1', source: '2', target: '1', label: 'subClassOf' }, // Student sub Person
                { id: 'e2', source: '3', target: '2', label: 'rdf:type' },   // John type Student
            ];

            classifyOntology(nodes, edges);
            
            // Querying for instances of Person should return John
            const result = executeDLQuery('Person', 'instances');
            expect(result.some(n => n.id === '3')).toBe(true);
        });
    });

    describe('DL Queries', () => {
        it('should resolve intersection queries (AND)', () => {
            const nodes = [
                createNode('1', 'Person', ElementType.OWL_CLASS),
                createNode('2', 'Teacher', ElementType.OWL_CLASS),
                createNode('3', 'Alice', ElementType.OWL_NAMED_INDIVIDUAL),
                createNode('4', 'Bob', ElementType.OWL_NAMED_INDIVIDUAL),
            ];
            const edges: Edge[] = [
                // Alice is Person and Teacher
                { id: 'e1', source: '3', target: '1', label: 'rdf:type' }, 
                { id: 'e2', source: '3', target: '2', label: 'rdf:type' },
                // Bob is only Person
                { id: 'e3', source: '4', target: '1', label: 'rdf:type' },
            ];

            classifyOntology(nodes, edges);
            
            const result = executeDLQuery('Person and Teacher', 'instances');
            expect(result.some(n => n.id === '3')).toBe(true); // Alice
            expect(result.some(n => n.id === '4')).toBe(false); // Bob
        });

        it('should resolve simple existential property restrictions (some)', () => {
            const nodes = [
                createNode('1', 'Course', ElementType.OWL_CLASS),
                createNode('2', 'Professor', ElementType.OWL_CLASS),
                createNode('3', 'Math101', ElementType.OWL_NAMED_INDIVIDUAL),
                createNode('4', 'DrSmith', ElementType.OWL_NAMED_INDIVIDUAL),
            ];
            
            // Math101 type Course
            const edges: Edge[] = [
                { id: 'e1', source: '3', target: '1', label: 'rdf:type' },
                // DrSmith teaches Math101
                { id: 'e2', source: '4', target: '3', label: 'teaches' },
            ];

            classifyOntology(nodes, edges);

            // Query: Who teaches some Course?
            // "teaches some Course" should match DrSmith because he teaches Math101 (which is a Course)
            
            // Note: The simple reasoner primarily looks for edges. 
            // We need to ensure the query resolver handles the transitive type check for the object.
            
            const result = executeDLQuery('teaches some Course', 'instances');
            expect(result.some(n => n.id === '4')).toBe(true);
        });
    });
});