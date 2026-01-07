import { Node, Edge } from 'reactflow';

export enum DiagramType {
  UML = 'UML',
  OWL = 'OWL'
}

export enum ElementType {
  CLASS = 'class',
  INTERFACE = 'interface',
  ENUM = 'enum',
  OWL_CLASS = 'owl_class',
  OWL_DATATYPE = 'owl_datatype'
}

export interface Attribute {
  id: string;
  name: string;
  type: string;
  visibility: '+' | '-' | '#' | '~';
}

export interface Method {
  id: string;
  name: string;
  returnType: string;
  visibility: '+' | '-' | '#' | '~';
}

export interface UMLNodeData {
  label: string;
  type: ElementType;
  attributes: Attribute[];
  methods: Method[];
  stereotype?: string;
  description?: string;
}

export type UMLNode = Node<UMLNodeData>;
export type UMLDiagram = {
  nodes: UMLNode[];
  edges: Edge[];
};

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface ProjectData {
  name: string;
  language?: string;
  description?: string;
  file?: File;
}
