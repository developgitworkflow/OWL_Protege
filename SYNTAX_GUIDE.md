
# OWL 2 Functional Syntax Guide for Ontology Architect

**Ontology Architect** uses W3C OWL 2 Functional Syntax as its primary intermediate representation. This document outlines how visual elements in the application map to Functional Syntax structures and how to utilize the Code Editor for manual modeling.

## 1. Ontology Structure

Every project starts with an Ontology header and Prefix declarations.

### Prefixes
The application automatically manages standard prefixes. Custom namespaces added in **Settings** are serialized here.

```lisp
Prefix( xsd:=<http://www.w3.org/2001/XMLSchema#> )
Prefix( owl:=<http://www.w3.org/2002/07/owl#> )
Prefix( : =<http://example.org/ontology#> )
Prefix( ex:=<http://example.org/ontology#> )

Ontology( <http://example.org/ontology>
    AnnotationAssertion( rdfs:comment <http://example.org/ontology> "My Description" )
    ...
)
```

## 2. Entity Declarations

Visual nodes on the canvas translate directly to `Declaration` axioms.

| Visual Element | Functional Syntax | Notes |
| :--- | :--- | :--- |
| **Class Node** (Purple) | `Declaration( Class( :Person ) )` | Represents a set of individuals. |
| **Object Property** (Blue) | `Declaration( ObjectProperty( :teaches ) )` | Relationship between two individuals. |
| **Data Property** (Green) | `Declaration( DataProperty( :hasAge ) )` | Relationship between individual and literal. |
| **Individual** (Pink) | `Declaration( NamedIndividual( :Mary ) )` | A specific instance. |
| **Datatype** (Amber) | `Declaration( Datatype( :integer ) )` | e.g., `xsd:integer`. |

## 3. Relationships (Edges)

Edges drawn between nodes on the canvas are serialized based on the source and target types.

### Hierarchy & Instantiation
*   **SubClassOf:** Drawn between two Classes.
    ```lisp
    SubClassOf( :Student :Person )
    ```
*   **Class Assertion:** Drawn from an Individual to a Class (Edge label: `rdf:type` or `a`).
    ```lisp
    ClassAssertion( :Person :Mary )
    ```

### Property Assertions
*   **Object Property:** Drawn from Individual `A` to Individual `B`.
    ```lisp
    ObjectPropertyAssertion( :knows :Mary :John )
    ```
*   **Data Property:** Drawn from Individual `A` to a Literal value (or implied by attributes).
    ```lisp
    DataPropertyAssertion( :hasAge :Mary "25"^^xsd:integer )
    ```

## 4. Logical Axioms (Properties Panel)

Complex logic defined in the **Properties Panel** ("Axioms" section) generates specific functional structures.

### Class Axioms
| Logic Type | Functional Syntax |
| :--- | :--- |
| **Disjoint** | `DisjointClasses( :Cat :Dog )` |
| **Equivalent** | `EquivalentClasses( :HappyPerson ObjectIntersectionOf( :Person :Smiling ) )` |
| **Union** | `SubClassOf( :Fruit ObjectUnionOf( :Apple :Banana ) )` |

### Property Axioms
| Logic Type | Functional Syntax |
| :--- | :--- |
| **Domain** | `ObjectPropertyDomain( :teaches :Professor )` |
| **Range** | `ObjectPropertyRange( :teaches :Course )` |
| **Inverse** | `InverseObjectProperties( :teaches :isTaughtBy )` |
| **SubProperty** | `SubObjectPropertyOf( :hasWife :hasSpouse )` |
| **Chain** | `SubObjectPropertyOf( ObjectPropertyChain( :hasParent :hasBrother ) :hasUncle )` |

### Property Characteristics
Toggled flags in the Properties Panel generate specific axioms:
*   `FunctionalObjectProperty( :hasBirthMother )`
*   `TransitiveObjectProperty( :ancestorOf )`
*   `SymmetricObjectProperty( :isSiblingOf )`

## 5. SWRL Rules

Ontology Architect supports SWRL rules via the **SWRL Editor**. These are serialized as `DLSafeRule`.

**Structure:** `Body -> Head`

**Example:**
*   *Human Readable:* `Person(?p) ^ hasAge(?p, ?a) ^ swrlb:greaterThan(?a, 17) -> Adult(?p)`
*   *Functional Syntax:*
    ```lisp
    DLSafeRule(
        Body(
            ClassAtom( :Person Variable(var:p) )
            DataPropertyAtom( :hasAge Variable(var:p) Variable(var:a) )
            BuiltInAtom( swrlb:greaterThan Variable(var:a) "17"^^xsd:integer )
        )
        Head(
            ClassAtom( :Adult Variable(var:p) )
        )
    )
    ```

## 6. Importing Code

You can paste Functional Syntax directly into the **Code View** to generate a diagram.

**Parser capabilities:**
1.  **Layout Generation:** The parser uses a grid-based auto-layout algorithm to position new nodes created from code.
2.  **Anonymous Expressions:** Complex nested expressions (e.g., `ObjectIntersectionOf(...)`) are parsed into the `methods` property of the node, preserving the logic even if it cannot be fully visualized as a node graph.
3.  **Partial Updates:** You can define new entities in the code view, click "Apply", and they will appear on the canvas without deleting existing entities if IDs match.
