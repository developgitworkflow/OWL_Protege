import { Node, Edge } from 'reactflow';

export enum DiagramType {
  OWL = 'OWL'
}

export enum ElementType {
  // OWL 2
  OWL_CLASS = 'owl_class',
  OWL_DATATYPE = 'owl_datatype',
  OWL_NAMED_INDIVIDUAL = 'owl_named_individual'
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
  iri?: string;            // Unique Resource Identifier
  attributes: Attribute[]; // Mapped to Data Properties
  methods: Method[];       // Mapped to Axioms/Restrictions
  stereotype?: string;     // Used for <<Stereotypes>>
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