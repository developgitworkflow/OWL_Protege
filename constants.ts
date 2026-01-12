
import type { Edge, Node } from 'reactflow';
import { ElementType } from './types';

export const INITIAL_NODES: Node[] = [
  {
    id: 'node-1',
    type: 'umlNode',
    position: { x: 250, y: 100 },
    data: {
      label: 'Person',
      type: ElementType.OWL_CLASS,
      iri: 'http://example.org/ontology#Person',
      attributes: [
        { id: 'a1', name: 'hasAge', type: 'xsd:integer', visibility: '+' },
      ],
      methods: [],
    },
  },
  {
    id: 'node-2',
    type: 'umlNode',
    position: { x: 550, y: 100 },
    data: {
      label: 'Mary',
      type: ElementType.OWL_NAMED_INDIVIDUAL,
      iri: 'http://example.org/ontology#Mary',
      attributes: [],
      methods: [],
    },
  },
];

export const INITIAL_EDGES: Edge[] = [
  { id: 'e1-2', source: 'node-2', target: 'node-1', label: 'rdf:type', type: 'smoothstep' },
];
