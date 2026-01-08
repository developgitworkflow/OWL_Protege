import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, ProjectData } from '../types';

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
      // Primitive check for XSD types to avoid 'ex:xsd:string'
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

      // Declaration(Class(C)) -> T(C) rdf:type owl:Class
      if (node.data.type === ElementType.OWL_CLASS) {
          add(`${s} rdf:type owl:Class .`);
          add(`${s} skos:prefLabel "${node.data.label}"@en .`);
      }
      // Declaration(NamedIndividual(a)) -> T(a) rdf:type owl:NamedIndividual
      else if (node.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
          add(`${s} rdf:type owl:NamedIndividual .`);
          add(`${s} skos:prefLabel "${node.data.label}"@en .`);
      }
      // Declaration(Datatype(DT)) -> T(DT) rdf:type rdfs:Datatype
      else if (node.data.type === ElementType.OWL_DATATYPE) {
          add(`${s} rdf:type rdfs:Datatype .`);
      }

      // Annotations (Table 1: TANN)
      if (node.data.description) {
          add(`${s} skos:definition "${node.data.description}"@en .`);
      }

      // Data Properties (Attributes) -> Declaration(DataProperty(DP))
      if (node.data.attributes) {
          node.data.attributes.forEach(attr => {
              const dp = fmt(attr.name);
              add(`${dp} rdf:type owl:DatatypeProperty .`); // Declaration
              add(`${dp} rdfs:label "${attr.name}" .`);
              
              if (node.data.type === ElementType.OWL_CLASS) {
                  // DataPropertyDomain(DPE CE) -> T(DPE) rdfs:domain T(CE)
                  add(`${dp} rdfs:domain ${s} .`);
              }
              
              if (attr.type) {
                  // DataPropertyRange(DPE DR) -> T(DPE) rdfs:range T(DR)
                  // Use 'xsd' prefix for standard types
                  add(`${dp} rdfs:range ${fmt(attr.type, 'xsd')} .`);
              }
          });
      }

      // Axioms & Restrictions (Methods)
      if (node.data.methods) {
          node.data.methods.forEach(method => {
              const { name, returnType } = method;
              const n = name.toLowerCase().replace(/\s+/g, '');
              const v = returnType;

              // --- Class Axioms & Boolean Connectives ---
              
              // SubClassOf(CE1 CE2)
              if (n === 'subclassof') {
                   add(`${s} rdfs:subClassOf ${fmt(v)} .`);
              } 
              // DisjointClasses(CE1 CE2)
              else if (n === 'disjointwith') {
                   add(`${s} owl:disjointWith ${fmt(v)} .`);
              } 
              // EquivalentClasses(CE1...CEn)
              else if (n === 'equivalentto' || n === 'equivalentclass') {
                   add(`${s} owl:equivalentClass ${fmt(v)} .`);
              } 
              // ObjectUnionOf(CE1 ... CEn)
              else if (n === 'unionof') {
                   add(`${s} owl:unionOf ${formatList(v)} .`);
              } 
              // ObjectIntersectionOf(CE1 ... CEn)
              else if (n === 'intersectionof') {
                   add(`${s} owl:intersectionOf ${formatList(v)} .`);
              } 
              // ObjectOneOf(a1 ... an) or DataOneOf
              else if (n === 'oneof') {
                   add(`${s} owl:oneOf ${formatList(v)} .`);
              } 
              // ObjectComplementOf(CE)
              else if (n === 'complementof') {
                   add(`${s} owl:complementOf ${fmt(v)} .`);
              }
              // DisjointUnion(C CE1 ... CEn)
              else if (n === 'disjointunionof') {
                   add(`${s} owl:disjointUnionOf ${formatList(v)} .`);
              }
              
              // --- Individual Axioms ---
              else if (n === 'sameas' || n === 'sameindividual') {
                   add(`${s} owl:sameAs ${fmt(v)} .`);
              }
              else if (n === 'differentfrom' || n === 'differentindividuals') {
                   add(`${s} owl:differentFrom ${fmt(v)} .`);
              }

              // --- Property Restrictions (Table 1: ObjectSomeValuesFrom, etc.) ---
              else {
                  // Implicit Restriction via implicit grammar: "Property Quantifier Target"
                  // e.g. name="hasPart", returnType="some Wheel"
                  
                  const parts = v.split(' ');
                  if (parts.length >= 1) {
                      const quantifier = parts[0].toLowerCase();
                      const targetStr = parts.slice(1).join(' '); // Can be empty for some quantifiers
                      
                      const bn = nextBn();
                      // T(C) rdfs:subClassOf _:x (The node is a subclass of the restriction)
                      add(`${s} rdfs:subClassOf ${bn} .`);
                      add(`${bn} rdf:type owl:Restriction .`);
                      add(`${bn} owl:onProperty ${fmt(name)} .`);

                      // ObjectSomeValuesFrom / DataSomeValuesFrom
                      if (quantifier === 'some') {
                          add(`${bn} owl:someValuesFrom ${fmt(targetStr)} .`);
                      }
                      // ObjectAllValuesFrom / DataAllValuesFrom
                      else if (quantifier === 'only' || quantifier === 'all') {
                          add(`${bn} owl:allValuesFrom ${fmt(targetStr)} .`);
                      }
                      // ObjectHasValue / DataHasValue
                      else if (quantifier === 'value' || quantifier === 'hasvalue') {
                          // Check if target is string/number literal or IRI
                          const target = targetStr.startsWith('"') || !isNaN(Number(targetStr)) ? targetStr : fmt(targetStr);
                          add(`${bn} owl:hasValue ${target} .`);
                      }
                      // ObjectHasSelf
                      else if (quantifier === 'self') {
                          add(`${bn} owl:hasSelf "true"^^xsd:boolean .`);
                      }
                      // Cardinality (Min, Max, Exact)
                      else if (['min', 'max', 'exactly', 'cardinality'].includes(quantifier)) {
                         // Syntax: "min <n> [Class]"
                         const [num, ...rest] = targetStr.split(' ');
                         const cls = rest.join(' ');
                         
                         // Determine Property URI (Qualified vs Unqualified)
                         let pred = '';
                         let isQualified = cls.length > 0;

                         if (quantifier === 'min') pred = isQualified ? 'owl:minQualifiedCardinality' : 'owl:minCardinality';
                         else if (quantifier === 'max') pred = isQualified ? 'owl:maxQualifiedCardinality' : 'owl:maxCardinality';
                         else pred = isQualified ? 'owl:qualifiedCardinality' : 'owl:cardinality';

                         add(`${bn} ${pred} "${num}"^^xsd:nonNegativeInteger .`);
                         
                         if (isQualified) {
                             // Check if it's a data range or class expression. 
                             // Simplify: use onClass (or onDataRange if xsd).
                             const onProp = cls.startsWith('xsd:') ? 'owl:onDataRange' : 'owl:onClass';
                             add(`${bn} ${onProp} ${fmt(cls)} .`);
                         }
                      }
                  }
              }
          });
      }
  });

  // Iterate Edges -> Object Properties
  edges.forEach(edge => {
      const src = nodes.find(n => n.id === edge.source);
      const tgt = nodes.find(n => n.id === edge.target);
      if (!src || !tgt) return;

      const s = getNodeIRI(src);
      const o = getNodeIRI(tgt);
      // Ensure label is a string before formatting
      const p = (typeof edge.label === 'string') ? fmt(edge.label) : `${userPrefix}:relatedTo`;

      if (p === 'rdfs:subClassOf' || p.endsWith('subClassOf')) {
          add(`${s} rdfs:subClassOf ${o} .`);
      } else if (p === 'owl:disjointWith' || p.endsWith('disjointWith')) {
          add(`${s} owl:disjointWith ${o} .`);
      } else if (p === 'rdf:type' || p === 'a') {
          add(`${s} rdf:type ${o} .`);
      } else if (p === 'owl:inverseOf' || p.endsWith('inverseOf')) {
           // InverseObjectProperties( OPE1 OPE2 )
           add(`${s} owl:inverseOf ${o} .`);
      } else {
          // ObjectProperty Assertion or Declaration inferred
          if (src.data.type === ElementType.OWL_CLASS && tgt.data.type === ElementType.OWL_CLASS) {
             add(`${p} rdf:type owl:ObjectProperty .`);
             add(`${p} rdfs:domain ${s} .`);
             add(`${p} rdfs:range ${o} .`);
          } else {
             // ObjectPropertyAssertion( OP a1 a2 )
             add(`${s} ${p} ${o} .`);
          }
      }
  });

  return lines.join('\n');
};