import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, ProjectData } from '../types';

// Table 3.2: OWL 2 RDF-Based Vocabulary
const OWL_VOCABULARY = new Set([
  'AllDifferent', 'AllDisjointClasses', 'AllDisjointProperties', 'allValuesFrom', 
  'annotatedProperty', 'annotatedSource', 'annotatedTarget', 'Annotation', 
  'AnnotationProperty', 'assertionProperty', 'AsymmetricProperty', 'Axiom', 
  'backwardCompatibleWith', 'bottomDataProperty', 'bottomObjectProperty', 'cardinality', 
  'Class', 'complementOf', 'DataRange', 'datatypeComplementOf', 'DatatypeProperty', 
  'deprecated', 'DeprecatedClass', 'DeprecatedProperty', 'differentFrom', 
  'disjointUnionOf', 'disjointWith', 'distinctMembers', 'equivalentClass', 
  'equivalentProperty', 'FunctionalProperty', 'hasKey', 'hasSelf', 'hasValue', 
  'imports', 'incompatibleWith', 'intersectionOf', 'InverseFunctionalProperty', 
  'inverseOf', 'IrreflexiveProperty', 'maxCardinality', 'maxQualifiedCardinality', 
  'members', 'minCardinality', 'minQualifiedCardinality', 'NamedIndividual', 
  'NegativePropertyAssertion', 'Nothing', 'ObjectProperty', 'onClass', 'onDataRange', 
  'onDatatype', 'oneOf', 'onProperty', 'onProperties', 'Ontology', 'OntologyProperty', 
  'priorVersion', 'propertyChainAxiom', 'propertyDisjointWith', 'qualifiedCardinality', 
  'ReflexiveProperty', 'Restriction', 'sameAs', 'someValuesFrom', 'sourceIndividual', 
  'SymmetricProperty', 'targetIndividual', 'targetValue', 'Thing', 'topDataProperty', 
  'topObjectProperty', 'TransitiveProperty', 'unionOf', 'versionInfo', 'versionIRI', 
  'withRestrictions'
]);

let bnCounter = 0;
const nextBn = () => `_:b${bnCounter++}`;

export const generateTurtle = (nodes: Node<UMLNodeData>[], edges: Edge[], metadata: ProjectData): string => {
  bnCounter = 0;
  const lines: string[] = [];
  const add = (s: string) => lines.push(s);

  const userPrefix = metadata.defaultPrefix || 'ex';
  const userIRI = metadata.baseIri || 'http://example.org/ontology#';

  // Standard Prefixes (Table 1 Context)
  const prefixes: Record<string, string> = {
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    owl: 'http://www.w3.org/2002/07/owl#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    skos: 'http://www.w3.org/2004/02/skos/core#',
    [userPrefix]: userIRI
  };

  Object.entries(prefixes).forEach(([p, uri]) => add(`@prefix ${p}: <${uri}> .`));
  add('');

  // Ontology Header (Table 1: Ontology(...))
  const ontologyId = `${userPrefix}:${metadata.name.replace(/\s+/g, '_')}`;
  add(`${ontologyId} rdf:type owl:Ontology .`);
  if (metadata.description) {
      add(`${ontologyId} skos:definition "${metadata.description}"@en .`);
  }
  add('');

  // Helper to format Resource (U)
  const fmt = (str: string | undefined, defaultPrefix = userPrefix) => {
      if (!str) return `${userPrefix}:Unknown`;
      if (str.startsWith('http')) return `<${str}>`;
      if (str.includes(':')) return str; // already prefixed
      
      // Table 3.2: OWL 2 RDF-Based Vocabulary Check
      if (OWL_VOCABULARY.has(str)) return `owl:${str}`;
      if (str.startsWith('xsd:')) return str;
      return `${defaultPrefix}:${str.replace(/\s+/g, '_')}`;
  };

  const getNodeIRI = (node: Node<UMLNodeData>) => {
      return node.data.iri ? fmt(node.data.iri) : fmt(node.data.label);
  };

  // Helper for T(SEQ y1 ... yn) -> ( T(y1) ... T(yn) )
  const formatList = (str: string) => {
      if (!str) return '()';
      return `( ${str.split(' ').map(s => fmt(s)).join(' ')} )`;
  };

  // Iterate Nodes
  nodes.forEach(node => {
      const s = getNodeIRI(node);

      // --- DECLARATIONS ---
      if (node.data.type === ElementType.OWL_CLASS) {
          add(`${s} rdf:type owl:Class .`);
          add(`${s} skos:prefLabel "${node.data.label}"@en .`);
      }
      else if (node.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
          add(`${s} rdf:type owl:NamedIndividual .`);
          add(`${s} skos:prefLabel "${node.data.label}"@en .`);
      }
      else if (node.data.type === ElementType.OWL_DATATYPE) {
          add(`${s} rdf:type rdfs:Datatype .`);
      }
      // NEW: Property Entities
      else if (node.data.type === ElementType.OWL_OBJECT_PROPERTY) {
          add(`${s} rdf:type owl:ObjectProperty .`);
          add(`${s} rdfs:label "${node.data.label}" .`);
      }
      else if (node.data.type === ElementType.OWL_DATA_PROPERTY) {
          add(`${s} rdf:type owl:DatatypeProperty .`);
          add(`${s} rdfs:label "${node.data.label}" .`);
      }

      // Annotations (Table 1: TANN)
      if (node.data.description) {
          add(`${s} skos:definition "${node.data.description}"@en .`);
      }

      // Attributes (Mixed Semantics based on Type)
      if (node.data.attributes) {
          node.data.attributes.forEach(attr => {
              // If it's a CLASS, these are Data Properties
              if (node.data.type === ElementType.OWL_CLASS) {
                  const dp = fmt(attr.name);
                  add(`${dp} rdf:type owl:DatatypeProperty .`);
                  add(`${dp} rdfs:label "${attr.name}" .`);
                  add(`${dp} rdfs:domain ${s} .`);
                  if (attr.type) add(`${dp} rdfs:range ${fmt(attr.type, 'xsd')} .`);
              } 
              // If it's a PROPERTY, these are Characteristics (Flags)
              else if (node.data.type === ElementType.OWL_OBJECT_PROPERTY || node.data.type === ElementType.OWL_DATA_PROPERTY) {
                  // e.g. Functional, Transitive
                  const characteristic = `owl:${attr.name}Property`; // Very heuristic mapping
                  // Special cases map
                  const map: Record<string, string> = {
                      'Functional': 'owl:FunctionalProperty',
                      'InverseFunctional': 'owl:InverseFunctionalProperty',
                      'Transitive': 'owl:TransitiveProperty',
                      'Symmetric': 'owl:SymmetricProperty',
                      'Asymmetric': 'owl:AsymmetricProperty',
                      'Reflexive': 'owl:ReflexiveProperty',
                      'Irreflexive': 'owl:IrreflexiveProperty'
                  };
                  const type = map[attr.name] || characteristic;
                  add(`${s} rdf:type ${type} .`);
              }
          });
      }

      // Axioms & Restrictions (Methods)
      if (node.data.methods) {
          node.data.methods.forEach(method => {
              const { name, returnType } = method;
              const n = name.toLowerCase().replace(/\s+/g, '');
              const v = returnType;
              const isProp = node.data.type === ElementType.OWL_OBJECT_PROPERTY || node.data.type === ElementType.OWL_DATA_PROPERTY;

              // --- PROPERTY AXIOMS ---
              if (isProp) {
                  if (n === 'subpropertyof') {
                      add(`${s} rdfs:subPropertyOf ${fmt(v)} .`);
                  } else if (n === 'inverseof') {
                      add(`${s} owl:inverseOf ${fmt(v)} .`);
                  } else if (n === 'domain') {
                      add(`${s} rdfs:domain ${fmt(v)} .`);
                  } else if (n === 'range') {
                      add(`${s} rdfs:range ${fmt(v)} .`);
                  } else if (n === 'propertychainaxiom') {
                      // List semantics
                      add(`${s} owl:propertyChainAxiom ${formatList(v)} .`);
                  }
              }
              
              // --- CLASS AXIOMS ---
              else {
                // SubClassOf(CE1 CE2)
                if (n === 'subclassof') {
                     add(`${s} rdfs:subClassOf ${fmt(v)} .`);
                } 
                else if (n === 'disjointwith') {
                     add(`${s} owl:disjointWith ${fmt(v)} .`);
                } 
                else if (n === 'equivalentto' || n === 'equivalentclass') {
                     add(`${s} owl:equivalentClass ${fmt(v)} .`);
                } 
                else if (n === 'unionof') {
                     add(`${s} owl:unionOf ${formatList(v)} .`);
                } 
                else if (n === 'intersectionof') {
                     add(`${s} owl:intersectionOf ${formatList(v)} .`);
                } 
                else if (n === 'oneof') {
                     add(`${s} owl:oneOf ${formatList(v)} .`);
                } 
                else if (n === 'complementof') {
                     add(`${s} owl:complementOf ${fmt(v)} .`);
                }
                else if (n === 'disjointunionof') {
                     add(`${s} owl:disjointUnionOf ${formatList(v)} .`);
                }
                else if (n === 'haskey') {
                     add(`${s} owl:hasKey ${formatList(v)} .`);
                }
                else if (n === 'sameas' || n === 'sameindividual') {
                     add(`${s} owl:sameAs ${fmt(v)} .`);
                }
                else if (n === 'differentfrom' || n === 'differentindividuals') {
                     add(`${s} owl:differentFrom ${fmt(v)} .`);
                }
                else {
                    // Implicit Restrictions
                    const parts = v.split(' ');
                    if (parts.length >= 1) {
                        const quantifier = parts[0].toLowerCase();
                        const targetStr = parts.slice(1).join(' '); 
                        const bn = nextBn();
                        add(`${s} rdfs:subClassOf ${bn} .`);
                        add(`${bn} rdf:type owl:Restriction .`);
                        add(`${bn} owl:onProperty ${fmt(name)} .`);

                        if (quantifier === 'some') add(`${bn} owl:someValuesFrom ${fmt(targetStr)} .`);
                        else if (quantifier === 'only' || quantifier === 'all') add(`${bn} owl:allValuesFrom ${fmt(targetStr)} .`);
                        else if (quantifier === 'value' || quantifier === 'hasvalue') add(`${bn} owl:hasValue ${targetStr.startsWith('"') ? targetStr : fmt(targetStr)} .`);
                        else if (quantifier === 'self') add(`${bn} owl:hasSelf "true"^^xsd:boolean .`);
                        else if (['min', 'max', 'exactly', 'cardinality'].includes(quantifier)) {
                           const [num, ...rest] = targetStr.split(' ');
                           const cls = rest.join(' ');
                           let pred = '';
                           let isQualified = cls.length > 0;
                           if (quantifier === 'min') pred = isQualified ? 'owl:minQualifiedCardinality' : 'owl:minCardinality';
                           else if (quantifier === 'max') pred = isQualified ? 'owl:maxQualifiedCardinality' : 'owl:maxCardinality';
                           else pred = isQualified ? 'owl:qualifiedCardinality' : 'owl:cardinality';
                           add(`${bn} ${pred} "${num}"^^xsd:nonNegativeInteger .`);
                           if (isQualified) {
                               const onProp = cls.startsWith('xsd:') ? 'owl:onDataRange' : 'owl:onClass';
                               add(`${bn} ${onProp} ${fmt(cls)} .`);
                           }
                        }
                    }
                }
              }
          });
      }
  });

  return lines.join('\n');
};