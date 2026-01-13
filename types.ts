
import { Node, Edge } from 'reactflow';

export enum DiagramType {
  OWL = 'OWL'
}

export enum ElementType {
  // OWL 2
  OWL_CLASS = 'owl_class',
  OWL_DATATYPE = 'owl_datatype',
  OWL_NAMED_INDIVIDUAL = 'owl_named_individual',
  OWL_OBJECT_PROPERTY = 'owl_object_property',
  OWL_DATA_PROPERTY = 'owl_data_property'
}

export interface Annotation {
  id: string;
  property: string; // e.g. rdfs:comment, rdfs:label, owl:versionInfo
  value: string;    // e.g. "My Ontology", <http://...>, 1.0
  language?: string; // e.g. en
}

export interface Attribute {
  id: string;
  name: string;
  type: string;
  visibility: '+' | '-' | '#' | '~';
  isDerived?: boolean; // Support for derived properties (/)
  annotations?: Annotation[]; // Annotations on the property/characteristic
}

export interface Method {
  id: string;
  name: string;
  returnType: string;
  visibility: '+' | '-' | '#' | '~';
  isOrdered?: boolean; // Support for ordered lists { ordered }
  annotations?: Annotation[]; // Annotations on the axiom
}

export interface SWRLRule {
  id: string;
  name: string; // Rule ID/Label
  expression: string; // Human readable: Person(?x) ^ hasAge(?x, ?y) -> Adult(?x)
  comment?: string;
  annotations?: Annotation[];
}

export interface UMLNodeData {
  label: string;
  type: ElementType;
  iri?: string;            // Unique Resource Identifier
  attributes: Attribute[]; // Mapped to Data Properties or Property Characteristics
  methods: Method[];       // Mapped to Axioms/Restrictions
  annotations?: Annotation[]; // OWL Annotations on the entity
  stereotype?: string;     // Used for <<Stereotypes>>
  description?: string;    // Deprecated in favor of annotations
  isSearchMatch?: boolean; // UI State for search highlighting
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
  baseIri?: string;
  ontologyIri?: string; // Specific IRI for the ontology (owl:Ontology rdf:about="...")
  versionIri?: string; // owl:versionIRI
  defaultPrefix?: string;
  namespaces?: Record<string, string>; // Custom namespace prefixes
  file?: File;
  annotations?: Annotation[]; // Annotations on the Ontology itself
  rules?: SWRLRule[]; // SWRL Rules
}

export interface Snapshot {
  id: string;
  timestamp: number;
  message: string;
  nodes: Node<UMLNodeData>[];
  edges: Edge[];
  metadata: ProjectData;
}

export interface Repository {
  currentBranch: string;
  branches: Record<string, Snapshot[]>;
}
