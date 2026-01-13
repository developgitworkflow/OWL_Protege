
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
    [userPrefix]: userIRI,
    ...metadata.namespaces // Merge custom namespaces
  };

  Object.entries(prefixes).forEach(([p, uri]) => add(`@prefix ${p}: <${uri}> .`));
  add('');

  // Ontology Header (Table 1: Ontology(...))
  // Determine Ontology IRI: explicit > baseIRI sans fragment > default
  const ontologyIriString = metadata.ontologyIri || userIRI.replace(/#$/, '');
  const ontologyId = `<${ontologyIriString}>`;
  
  add(`${ontologyId} rdf:type owl:Ontology .`);
  
  if (metadata.versionIri) {
      add(`${ontologyId} owl:versionIRI <${metadata.versionIri}> .`);
  }
  
  if (metadata.description) {
      add(`${ontologyId} skos:definition "${metadata.description}"@en .`);
  }
  add('');

  // Helper to format Resource (U)
  const fmt = (str: string | undefined, defaultPrefix = userPrefix) => {
      if (!str) return `${userPrefix}:Unknown`;
      const trimmed = str.trim();
      if (trimmed.startsWith('http')) return `<${trimmed}>`;
      if (trimmed.includes(':')) return trimmed; // already prefixed
      
      // Table 3.2: OWL 2 RDF-Based Vocabulary Check
      if (OWL_VOCABULARY.has(trimmed)) return `owl:${trimmed}`;
      if (trimmed.startsWith('xsd:')) return trimmed;
      if (trimmed === 'true' || trimmed === 'false') return `"${trimmed}"^^xsd:boolean`;
      if (!isNaN(Number(trimmed))) return `"${trimmed}"^^xsd:integer`;
      
      return `${defaultPrefix}:${trimmed.replace(/\s+/g, '_')}`;
  };

  const getNodeIRI = (node: Node<UMLNodeData>) => {
      return node.data.iri ? fmt(node.data.iri) : fmt(node.data.label);
  };

  // Helper for T(SEQ y1 ... yn) -> ( T(y1) ... T(yn) )
  const formatList = (str: string) => {
      if (!str) return '()';
      // If it contains Manchester operators, parsing as list is tricky.
      // Assuming simple list for now if not expression.
      return `( ${str.split(' ').map(s => fmt(s)).join(' ')} )`;
  };

  /**
   * RECURSIVE MANCHESTER PARSER TO TURTLE
   * Generates Turtle structure (Resource or BNode) for a class expression string.
   */
  const parseManchesterExpression = (expr: string): string => {
      let clean = expr.trim();
      
      // 1. Parentheses: (A and B)
      // Strip outer parens if matched
      if (clean.startsWith('(') && clean.endsWith(')')) {
          // Verify they match
          let depth = 0;
          let matched = true;
          for(let i=0; i<clean.length-1; i++) {
              if (clean[i] === '(') depth++;
              if (clean[i] === ')') depth--;
              if (depth === 0) { matched = false; break; }
          }
          if (matched) return parseManchesterExpression(clean.substring(1, clean.length - 1));
      }

      // 2. Boolean Operators: 'or', 'and'
      // We need to split by top-level operators
      const splitByOp = (text: string, op: string) => {
          const parts: string[] = [];
          let current = '';
          let depth = 0;
          const opRegex = new RegExp(`^\\s+${op}\\s+`, 'i');
          
          let i = 0;
          while (i < text.length) {
              if (text[i] === '(') depth++;
              if (text[i] === ')') depth--;
              
              if (depth === 0 && text.substring(i).match(opRegex)) {
                  parts.push(current.trim());
                  current = '';
                  // consume op
                  const match = text.substring(i).match(opRegex);
                  i += match![0].length;
                  continue;
              }
              current += text[i];
              i++;
          }
          if (current) parts.push(current.trim());
          return parts;
      };

      const orParts = splitByOp(clean, 'or');
      if (orParts.length > 1) {
          const bn = nextBn();
          add(`${bn} rdf:type owl:Class .`);
          const members = orParts.map(p => parseManchesterExpression(p)).join(' ');
          add(`${bn} owl:unionOf ( ${members} ) .`);
          return bn;
      }

      const andParts = splitByOp(clean, 'and');
      if (andParts.length > 1) {
          const bn = nextBn();
          add(`${bn} rdf:type owl:Class .`);
          const members = andParts.map(p => parseManchesterExpression(p)).join(' ');
          add(`${bn} owl:intersectionOf ( ${members} ) .`);
          return bn;
      }

      // 3. Negation: 'not'
      if (clean.toLowerCase().startsWith('not ')) {
          const target = clean.substring(4);
          const bn = nextBn();
          add(`${bn} rdf:type owl:Class .`);
          add(`${bn} owl:complementOf ${parseManchesterExpression(target)} .`);
          return bn;
      }

      // 4. Restrictions: property some/only/value/min/max C
      // Regex to find "prop keyword target"
      const restrictionRegex = /^([a-zA-Z0-9_:-]+)\s+(some|only|value|min|max|exactly)\s+(.*)$/i;
      const match = clean.match(restrictionRegex);
      
      if (match) {
          const prop = fmt(match[1]);
          const type = match[2].toLowerCase();
          const rest = match[3];
          
          const bn = nextBn();
          add(`${bn} rdf:type owl:Restriction .`);
          add(`${bn} owl:onProperty ${prop} .`);

          if (type === 'some') {
              if (rest.trim().toLowerCase() === 'self') {
                  add(`${bn} owl:hasSelf "true"^^xsd:boolean .`);
              } else {
                  add(`${bn} owl:someValuesFrom ${parseManchesterExpression(rest)} .`);
              }
          } 
          else if (type === 'only') {
              add(`${bn} owl:allValuesFrom ${parseManchesterExpression(rest)} .`);
          }
          else if (type === 'value') {
              add(`${bn} owl:hasValue ${fmt(rest)} .`);
          }
          else {
              // Cardinality
              // Format: "1 Class" or just "1" (Unqualified)
              // Updated Regex to handle optional Class part
              const cardMatch = rest.match(/^(\d+)(\s+.*)?$/);
              if (cardMatch) {
                  const num = cardMatch[1];
                  const targetRaw = cardMatch[2] ? cardMatch[2].trim() : '';
                  const isQualified = targetRaw && targetRaw !== 'owl:Thing' && targetRaw !== 'Thing';
                  
                  let pred = 'owl:cardinality';
                  if (type === 'min') pred = isQualified ? 'owl:minQualifiedCardinality' : 'owl:minCardinality';
                  if (type === 'max') pred = isQualified ? 'owl:maxQualifiedCardinality' : 'owl:maxCardinality';
                  if (type === 'exactly') pred = isQualified ? 'owl:qualifiedCardinality' : 'owl:cardinality';
                  
                  add(`${bn} ${pred} "${num}"^^xsd:nonNegativeInteger .`);
                  
                  if (isQualified) {
                      const onProp = targetRaw.startsWith('xsd:') ? 'owl:onDataRange' : 'owl:onClass';
                      add(`${bn} ${onProp} ${parseManchesterExpression(targetRaw)} .`);
                  }
              }
          }
          return bn;
      }

      // 5. Fallback: Simple Named Class / Datatype
      return fmt(clean);
  };

  // 1. Explicit Nodes
  const explicitProperties = new Set<string>();

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
          explicitProperties.add(s);
      }
      else if (node.data.type === ElementType.OWL_DATA_PROPERTY) {
          add(`${s} rdf:type owl:DatatypeProperty .`);
          add(`${s} rdfs:label "${node.data.label}" .`);
          explicitProperties.add(s);
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
                     // Check if v is simple named class or expression
                     const target = parseManchesterExpression(v);
                     add(`${s} rdfs:subClassOf ${target} .`);
                } 
                else if (n === 'disjointwith') {
                     const target = parseManchesterExpression(v);
                     add(`${s} owl:disjointWith ${target} .`);
                } 
                else if (n === 'equivalentto' || n === 'equivalentclass') {
                     const target = parseManchesterExpression(v);
                     add(`${s} owl:equivalentClass ${target} .`);
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
                    // Implicit Restrictions fallback (for "Legacy" simple string format)
                    const target = parseManchesterExpression(v);
                    // Assume subclass if unknown axiom type but valid expression
                    if (target) {
                        add(`${s} rdfs:subClassOf ${target} .`);
                    }
                }
              }
          });
      }
  });

  // 2. Infer Properties from Edges
  const STANDARD_LABELS = new Set(['rdf:type', 'a', 'rdfs:subClassOf', 'subClassOf', 'owl:disjointWith', 'disjointWith']);
  const inferredProperties = new Map<string, string>(); // IRI -> owl:ObjectProperty | owl:DatatypeProperty

  edges.forEach(edge => {
      let label = edge.label as string || '';
      if (STANDARD_LABELS.has(label)) return;

      const pIRI = fmt(label);
      if (explicitProperties.has(pIRI)) return;

      const targetNode = nodes.find(n => n.id === edge.target);
      if (targetNode) {
          if (targetNode.data.type === ElementType.OWL_DATATYPE) {
              inferredProperties.set(pIRI, 'owl:DatatypeProperty');
          } else {
              // Only set to ObjectProp if not already set as DataProp
              if (inferredProperties.get(pIRI) !== 'owl:DatatypeProperty') {
                  inferredProperties.set(pIRI, 'owl:ObjectProperty');
              }
          }
      }
  });

  // Emit Inferred Property Definitions
  inferredProperties.forEach((type, iri) => {
      add(`${iri} rdf:type ${type} .`);
  });

  // 3. Edges -> Triples
  edges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      if (sourceNode && targetNode) {
          const s = getNodeIRI(sourceNode);
          const t = getNodeIRI(targetNode);
          
          let prop = (typeof edge.label === 'string') ? edge.label : 'owl:topObjectProperty';
          const p = fmt(prop);

          // Handle standard mappings
          if (prop === 'rdf:type' || prop === 'a') {
              add(`${s} rdf:type ${t} .`);
          } else if (prop === 'rdfs:subClassOf' || prop === 'subClassOf') {
              add(`${s} rdfs:subClassOf ${t} .`);
          } else if (prop === 'owl:disjointWith' || prop === 'disjointWith') {
              add(`${s} owl:disjointWith ${t} .`);
          } else {
              add(`${s} ${p} ${t} .`);
          }
      }
  });

  return lines.join('\n');
};
