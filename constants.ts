import { Edge, Node } from 'reactflow';
import { ElementType } from './types';

export const INITIAL_NODES: Node[] = [
  {
    id: 'node-1',
    type: 'umlNode',
    position: { x: 250, y: 100 },
    data: {
      label: 'User',
      type: ElementType.CLASS,
      attributes: [
        { id: 'a1', name: 'id', type: 'UUID', visibility: '-' },
        { id: 'a2', name: 'email', type: 'String', visibility: '+' },
      ],
      methods: [
        { id: 'm1', name: 'login', returnType: 'void', visibility: '+' },
      ],
    },
  },
  {
    id: 'node-2',
    type: 'umlNode',
    position: { x: 550, y: 100 },
    data: {
      label: 'Order',
      type: ElementType.CLASS,
      attributes: [
        { id: 'o1', name: 'orderId', type: 'UUID', visibility: '-' },
        { id: 'o2', name: 'total', type: 'Decimal', visibility: '+' },
      ],
      methods: [
        { id: 'm2', name: 'calculateTotal', returnType: 'Decimal', visibility: '+' },
      ],
    },
  },
];

export const INITIAL_EDGES: Edge[] = [
  { id: 'e1-2', source: 'node-1', target: 'node-2', label: 'places', type: 'smoothstep' },
];
