
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType, ProjectData } from '../types';

export const generateRdfXml = (nodes: Node<UMLNodeData>[], edges: Edge[], metadata: ProjectData): string => {
  const lines: string[] = [];
  const indent = (lvl: number) => '    '.repeat(lvl);
  const baseIri = metadata.baseIri || 'http://example.org/ontology#';
  const cleanBase = baseIri.endsWith('#') || baseIri.endsWith('/') ? baseIri : baseIri + '#';
  
  // Header
  lines.push('<?xml version="1.0"?>');
  lines.push(`<rdf:RDF xmlns="${cleanBase}"`);
  lines.push(`${indent(1)}xml:base="${cleanBase}"`);
  lines.push(`${indent(1)}xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"`);
  lines.push(`${indent(1)}xmlns:owl="http://www.w3.org/2002/07/owl#"`);
  lines.push(`${indent(1)}xmlns:xml="http://www.w3.org/XML/1998/namespace"`);
  lines.push(`${indent(1)}xmlns:xsd="http://www.w3.org/2001/XMLSchema#"`);
  lines.push(`${indent(1)}xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#">`);
  
  // Ontology Declaration
  const ontIri = metadata.ontologyIri || baseIri.replace(/#$/, '');
  lines.push(`${indent(1)}<owl:Ontology rdf:about="${ontIri}">`);
  
  if (metadata.versionIri) {
      lines.push(`${indent(2)}<owl:versionIRI rdf:resource="${metadata.versionIri}"/>`);
  }

  if (metadata.description) {
      lines.push(`${indent(2)}<rdfs:comment>${metadata.description}</rdfs:comment>`);
  }
  lines.push(`${indent(1)}</owl:Ontology>`);
  lines.push('');

  // Helper: Resolve IRI
  const getIRI = (node: Node<UMLNodeData> | undefined) => {
      if (!node) return '#Unknown';
      if (node.data.iri) return node.data.iri;
      // If no IRI, assume local to base
      return `${cleanBase}${node.data.label.replace(/\s+/g, '_')}`;
  };

  const getTargetIRI = (edge: Edge) => {
      const targetNode = nodes.find(n => n.id === edge.target);
      return getIRI(targetNode);
  };

  // Helper: Render common entity content (Annotations, etc.)
  const renderCommon = (node: Node<UMLNodeData>, level: number) => {
      lines.push(`${indent(level)}<rdfs:label>${node.data.label}</rdfs:label>`);
      if (node.data.description) {
          lines.push(`${indent(level)}<rdfs:comment>${node.data.description}</rdfs:comment>`);
      }
      if (node.data.annotations) {
          node.data.annotations.forEach(ann => {
              // Primitive handling of common annotation props
              if (ann.property.includes(':')) {
                  // e.g. rdfs:seeAlso -> <rdfs:seeAlso>...</rdfs:seeAlso>
                  // We need to ensure the prefix is defined or use full IRI. 
                  // For simplicity, we assume standard prefixes or just output tags if simple.
                  const [pfx, local] = ann.property.split(':');
                  if (['rdfs', 'owl', 'skos', 'dc'].includes(pfx)) {
                      lines.push(`${indent(level)}<${ann.property}>${ann.value.replace(/"/g, '')}</${ann.property}>`);
                  }
              }
          });
      }
  };

  // 1. Classes
  nodes.filter(n => n.data.type === ElementType.OWL_CLASS).forEach(n => {
      lines.push(`${indent(1)}<owl:Class rdf:about="${getIRI(n)}">`);
      renderCommon(n, 2);

      // SubClassOf Edges
      edges.filter(e => e.source === n.id && (e.label === 'subClassOf' || e.label === 'rdfs:subClassOf'))
           .forEach(e => {
               lines.push(`${indent(2)}<rdfs:subClassOf rdf:resource="${getTargetIRI(e)}"/>`);
           });

      // DisjointWith Edges
      edges.filter(e => e.source === n.id && (e.label === 'disjointWith' || e.label === 'owl:disjointWith'))
           .forEach(e => {
               lines.push(`${indent(2)}<owl:disjointWith rdf:resource="${getTargetIRI(e)}"/>`);
           });
           
      lines.push(`${indent(1)}</owl:Class>`);
      lines.push('');
  });

  // 2. Object Properties
  nodes.filter(n => n.data.type === ElementType.OWL_OBJECT_PROPERTY).forEach(n => {
      lines.push(`${indent(1)}<owl:ObjectProperty rdf:about="${getIRI(n)}">`);
      renderCommon(n, 2);
      
      // Characteristics
      n.data.attributes.forEach(attr => {
           if (['Functional', 'InverseFunctional', 'Transitive', 'Symmetric', 'Asymmetric', 'Reflexive', 'Irreflexive'].includes(attr.name)) {
               lines.push(`${indent(2)}<rdf:type rdf:resource="http://www.w3.org/2002/07/owl#${attr.name}Property"/>`);
           }
      });
      
      lines.push(`${indent(1)}</owl:ObjectProperty>`);
      lines.push('');
  });

  // 3. Data Properties
  nodes.filter(n => n.data.type === ElementType.OWL_DATA_PROPERTY).forEach(n => {
      lines.push(`${indent(1)}<owl:DatatypeProperty rdf:about="${getIRI(n)}">`);
      renderCommon(n, 2);
      if (n.data.attributes.some(a => a.name === 'Functional')) {
           lines.push(`${indent(2)}<rdf:type rdf:resource="http://www.w3.org/2002/07/owl#FunctionalProperty"/>`);
      }
      lines.push(`${indent(1)}</owl:DatatypeProperty>`);
      lines.push('');
  });

  // 4. Individuals
  nodes.filter(n => n.data.type === ElementType.OWL_NAMED_INDIVIDUAL).forEach(n => {
      lines.push(`${indent(1)}<owl:NamedIndividual rdf:about="${getIRI(n)}">`);
      renderCommon(n, 2);

      // Types
      edges.filter(e => e.source === n.id && (e.label === 'rdf:type' || e.label === 'a'))
           .forEach(e => {
               lines.push(`${indent(2)}<rdf:type rdf:resource="${getTargetIRI(e)}"/>`);
           });

      // Facts (Object Property Assertions)
      edges.filter(e => e.source === n.id && e.label !== 'rdf:type' && e.label !== 'a')
           .forEach(e => {
               // Heuristic: check if label looks like a URI or a local name
               let propTag = e.label as string;
               if (!propTag.includes(':')) propTag = `:${propTag}`; // assume local
               
               // We need to resolve the tag to XML valid QName if possible
               // Since we don't have full custom prefix map logic here, we output full element if possible or standard prefix
               // For simplicity in this view, we use the raw label if it has a prefix
               
               // Better approach: use rdf:Description or just <prop>
               if (propTag.startsWith('http')) {
                   lines.push(`${indent(2)}<rdf:Description>`);
                   lines.push(`${indent(3)}<rdf:type rdf:resource="${propTag}"/>`);
                   lines.push(`${indent(3)}<rdf:object rdf:resource="${getTargetIRI(e)}"/>`);
                   lines.push(`${indent(2)}</rdf:Description>`);
               } else {
                   // Assume it matches a prefix we defined or empty prefix
                   const tagName = propTag.startsWith(':') ? propTag.substring(1) : propTag;
                   lines.push(`${indent(2)}<${tagName} rdf:resource="${getTargetIRI(e)}"/>`);
               }
           });

      lines.push(`${indent(1)}</owl:NamedIndividual>`);
      lines.push('');
  });

  lines.push('</rdf:RDF>');
  return lines.join('\n');
};
