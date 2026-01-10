
import { Node, Edge } from 'reactflow';
import { UMLNodeData, ElementType } from '../types';

export const generateDatalog = (nodes: Node<UMLNodeData>[], edges: Edge[]): string => {
    let lines: string[] = [];
    
    // --- Helpers ---
    
    // Sanitizes a string to be a valid Datalog predicate (lowercase, alphanumeric, underscores)
    const toPred = (str: string): string => {
        let clean = str.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
        // Ensure it starts with a lowercase letter
        if (!/^[a-z]/.test(clean)) clean = 'p_' + clean;
        return clean;
    };

    // Sanitizes a string to be a valid Datalog constant (quoted string or lowercase atom)
    const toConst = (str: string): string => {
        // If it's a number/boolean, keep as is
        if (!isNaN(Number(str)) || str === 'true' || str === 'false') return str;
        // Otherwise wrap in quotes
        return `'${str.replace(/'/g, "\\'")}'`;
    };

    // --- 1. Facts (ABox) ---
    lines.push(`% --- Facts (ABox) ---`);
    
    // Individuals
    const individuals = nodes.filter(n => n.data.type === ElementType.OWL_NAMED_INDIVIDUAL);
    
    // Class Assertions (from Edges: rdf:type)
    edges.forEach(e => {
        if (e.label === 'rdf:type' || e.label === 'a') {
            const subj = nodes.find(n => n.id === e.source);
            const obj = nodes.find(n => n.id === e.target);
            if (subj?.data.type === ElementType.OWL_NAMED_INDIVIDUAL && obj?.data.type === ElementType.OWL_CLASS) {
                lines.push(`${toPred(obj.data.label)}(${toConst(subj.data.label)}).`);
            }
        }
    });

    // Property Assertions (from Edges: custom labels)
    edges.forEach(e => {
        if (['rdf:type', 'a', 'subClassOf', 'rdfs:subClassOf', 'owl:disjointWith'].includes(e.label as string)) return;
        
        const subj = nodes.find(n => n.id === e.source);
        const obj = nodes.find(n => n.id === e.target);
        
        if (subj?.data.type === ElementType.OWL_NAMED_INDIVIDUAL && obj?.data.type === ElementType.OWL_NAMED_INDIVIDUAL) {
            let pred = (e.label as string);
            if (pred.includes(':')) pred = pred.split(':')[1];
            lines.push(`${toPred(pred)}(${toConst(subj.data.label)}, ${toConst(obj.data.label)}).`);
        }
    });

    lines.push('');
    lines.push(`% --- Rules (TBox) ---`);

    // --- 2. Class Hierarchy ---
    // SubClassOf(A, B) -> B(X) :- A(X).
    edges.forEach(e => {
        if (e.label === 'subClassOf' || e.label === 'rdfs:subClassOf') {
            const sub = nodes.find(n => n.id === e.source);
            const sup = nodes.find(n => n.id === e.target);
            if (sub?.data.type === ElementType.OWL_CLASS && sup?.data.type === ElementType.OWL_CLASS) {
                lines.push(`${toPred(sup.data.label)}(X) :- ${toPred(sub.data.label)}(X).`);
            }
        }
    });

    // --- 3. Property Hierarchy ---
    // SubPropertyOf(P, Q) -> Q(X, Y) :- P(X, Y).
    // Domain(P, C) -> C(X) :- P(X, Y).
    // Range(P, C) -> C(Y) :- P(X, Y).
    
    nodes.forEach(node => {
        if (node.data.type === ElementType.OWL_OBJECT_PROPERTY || node.data.type === ElementType.OWL_DATA_PROPERTY) {
            const p = toPred(node.data.label);
            
            node.data.methods.forEach(m => {
                const type = m.name.toLowerCase();
                const target = m.returnType;
                const tPred = toPred(target);

                if (type === 'subpropertyof') {
                    lines.push(`${tPred}(X, Y) :- ${p}(X, Y).`);
                } else if (type === 'inverseof') {
                    lines.push(`${p}(X, Y) :- ${tPred}(Y, X).`);
                    lines.push(`${tPred}(X, Y) :- ${p}(Y, X).`);
                } else if (type === 'domain') {
                    lines.push(`${tPred}(X) :- ${p}(X, _).`); // _ is anonymous var
                } else if (type === 'range') {
                    lines.push(`${tPred}(Y) :- ${p}(_, Y).`);
                }
            });

            // Characteristics
            node.data.attributes.forEach(attr => {
                if (attr.name === 'Symmetric') {
                    lines.push(`${p}(Y, X) :- ${p}(X, Y).`);
                } else if (attr.name === 'Transitive') {
                    lines.push(`${p}(X, Z) :- ${p}(X, Y), ${p}(Y, Z).`);
                } else if (attr.name === 'Reflexive') {
                    // Requires a universe of discourse or applied to all known individuals
                    // Datalog safety usually prevents "X(x) :- true." without domain.
                    // We skip unsafe reflexive generation or comment it out.
                    lines.push(`% ${p}(X, X) :- person(X). % Unsafe Reflexive rule omitted`);
                }
            });
        }
    });

    // --- 4. Complex Class Axioms (Method Parsing) ---
    nodes.filter(n => n.data.type === ElementType.OWL_CLASS).forEach(node => {
        const clsPred = toPred(node.data.label);

        node.data.methods.forEach(m => {
            const type = m.name.toLowerCase();
            const expr = m.returnType;

            // EquivalentTo (A = B) -> A :- B. AND B :- A.
            // DisjointWith (A ^ B -> False) -> :- A(X), B(X).
            
            if (type === 'disjointwith') {
                const target = toPred(expr);
                lines.push(`:- ${clsPred}(X), ${target}(X).`);
            }
            else if (type === 'equivalentto' || type === 'equivalentclass') {
                // Handle simple named class equivalence
                if (!expr.includes(' ')) {
                    const target = toPred(expr);
                    lines.push(`${clsPred}(X) :- ${target}(X).`);
                    lines.push(`${target}(X) :- ${clsPred}(X).`);
                }
                // Handle intersection: A EquivalentTo B and C
                // A(X) :- B(X), C(X).
                // B(X) :- A(X).  C(X) :- A(X).
                else if (expr.includes(' and ')) {
                    const parts = expr.split(' and ').map(p => toPred(p.trim()));
                    const body = parts.map(p => `${p}(X)`).join(', ');
                    
                    // Direction 1: Intersection -> Class
                    lines.push(`${clsPred}(X) :- ${body}.`);
                    
                    // Direction 2: Class -> Intersection parts
                    parts.forEach(part => {
                        lines.push(`${part}(X) :- ${clsPred}(X).`);
                    });
                }
            }
            else if (type === 'subclassof') {
                // Handle "prop some Class" in SUPERCLASS position
                // A SubClassOf p some C
                // This implies: For all x in A, there exists y such that p(x,y) and C(y).
                // This requires Existential Rules (Datalog+/-), not standard Datalog.
                // We add a comment.
                
                // Handle "prop some Class" in SUBCLASS position
                // p some C SubClassOf A
                // A(X) :- p(X, Y), C(Y).
                // This needs complex parsing, but let's try a simple regex for "some".
                
                // Note: The UI stores methods on the SUBJECT node.
                // So if Node A has method "SubClassOf: B", it means A <= B.
                // B(X) :- A(X).
                
                if (expr.includes(' some ')) {
                    const match = expr.match(/^(\w+)\s+some\s+(\w+)$/);
                    if (match) {
                        // A <= p some C
                        // Constraint / TGD. Not valid standard Datalog.
                        lines.push(`% Rule omitted: ${node.data.label} SubClassOf ${expr} (Existential Head not supported in standard Datalog)`);
                    }
                } else if (!expr.includes(' ')) {
                    // Simple named class
                    const target = toPred(expr);
                    lines.push(`${target}(X) :- ${clsPred}(X).`);
                }
            }
        });
    });

    // --- 5. Property Chains ---
    nodes.filter(n => n.data.type === ElementType.OWL_OBJECT_PROPERTY).forEach(node => {
        const p = toPred(node.data.label);
        node.data.methods.forEach(m => {
            if (m.name.toLowerCase() === 'propertychainaxiom') {
                // e.g. "hasParent hasBrother" -> "hasUncle"
                const chain = m.returnType.split(/\s+|o/).filter(s => s.trim().length > 0 && s !== 'o');
                if (chain.length === 2) {
                    const p1 = toPred(chain[0]);
                    const p2 = toPred(chain[1]);
                    lines.push(`${p}(X, Z) :- ${p1}(X, Y), ${p2}(Y, Z).`);
                }
            }
        });
    });

    return lines.join('\n');
};
