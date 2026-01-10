import { SWRLRule } from "../types";

// Helper to format atoms for Functional Syntax
const parseAtom = (atomStr: string, defaultPrefix: string): string => {
    const clean = atomStr.trim();
    if (!clean) return '';

    // 1. Built-ins: swrlb:greaterThan(?x, 18)
    if (clean.includes(':') && !clean.includes('(')) {
        // Might be just a predicate without args, invalid in SWRL but we handle robustly
        return clean;
    }
    
    // Parse Predicate(Args)
    const match = clean.match(/^([^(\s]+)\s*\((.*)\)$/);
    if (!match) return ''; // Invalid atom

    const predicate = match[1];
    const argsStr = match[2];
    
    // Split args by comma, respecting quotes if any
    const args = argsStr.split(',').map(a => a.trim());

    // Format Argument
    const fmtArg = (arg: string) => {
        if (arg.startsWith('?')) return `Variable( var:${arg.substring(1)} )`;
        if (arg.startsWith('"') || !isNaN(Number(arg))) return `"${arg.replace(/"/g, '')}"^^xsd:integer`; // Simplification
        // Assume Individual/DataValue if not variable
        // Check if it looks like a CURIE
        if (arg.includes(':')) return arg;
        return `${defaultPrefix}:${arg}`; 
    };

    const fmtPred = (pred: string) => {
        if (pred.includes(':')) return pred;
        return `${defaultPrefix}:${pred}`;
    }

    // Heuristics for Atom Type
    // If built-in
    if (predicate.startsWith('swrlb:')) {
        return `BuiltInAtom( ${predicate} ${args.map(fmtArg).join(' ')} )`;
    }
    
    // ClassAtom (1 arg) vs PropertyAtom (2 args)
    if (args.length === 1) {
        return `ClassAtom( ${fmtPred(predicate)} ${fmtArg(args[0])} )`;
    } else if (args.length === 2) {
        // Hard to distinguish ObjectProperty from DataProperty without ontology context.
        // Defaulting to ObjectPropertyAtom for now, or DataPropertyAtom if arg2 is literal.
        const isLiteral = args[1].startsWith('"') || !isNaN(Number(args[1]));
        const type = isLiteral ? 'DataPropertyAtom' : 'ObjectPropertyAtom';
        return `${type}( ${fmtPred(predicate)} ${fmtArg(args[0])} ${fmtArg(args[1])} )`;
    }

    return '';
};

export const convertRuleToFunctional = (rule: SWRLRule, defaultPrefix: string): string => {
    // Expected format: Body -> Head
    // Body and Head are `^` separated atoms
    const parts = rule.expression.split(/->|→/);
    if (parts.length !== 2) return ''; // Invalid rule structure

    const bodyStr = parts[0].trim();
    const headStr = parts[1].trim();

    const parseAtoms = (str: string) => {
        if (!str) return '';
        return str.split(/\^|∧/)
            .map(s => parseAtom(s, defaultPrefix))
            .filter(s => s)
            .join(' ');
    };

    const body = parseAtoms(bodyStr);
    const head = parseAtoms(headStr);

    const annotation = rule.comment ? `Annotation( rdfs:comment "${rule.comment}" )` : '';

    return `DLSafeRule( ${annotation} Body( ${body} ) Head( ${head} ) )`;
};

// --- Reverse Parsing (Functional -> Human) ---
// Note: This is a best-effort reverse parser for the UI
export const convertFunctionalToHuman = (functionalStr: string): string => {
    // Extract Body and Head content
    const bodyMatch = functionalStr.match(/Body\s*\((.*?)\)\s*Head/s);
    const headMatch = functionalStr.match(/Head\s*\((.*?)\)\s*\)/s);
    
    if (!bodyMatch || !headMatch) return "Invalid Rule";

    const processContent = (content: string) => {
        // We need to parse atoms like ClassAtom( ex:Person Variable(var:x) )
        // This regex is tricky due to nested parens.
        // We will do a simple token replacement strategy for display purposes.
        
        let display = content
            .replace(/ClassAtom\s*\(\s*([^ ]+)\s+Variable\s*\(\s*var:([^)]+)\s*\)\s*\)/g, '$1(?$2)')
            .replace(/ObjectPropertyAtom\s*\(\s*([^ ]+)\s+Variable\s*\(\s*var:([^)]+)\s*\)\s+Variable\s*\(\s*var:([^)]+)\s*\)\s*\)/g, '$1(?$2, ?$3)')
            .replace(/DataPropertyAtom\s*\(\s*([^ ]+)\s+Variable\s*\(\s*var:([^)]+)\s*\)\s+Variable\s*\(\s*var:([^)]+)\s*\)\s*\)/g, '$1(?$2, ?$3)')
            .replace(/BuiltInAtom\s*\(\s*([^ ]+)\s+Variable\s*\(\s*var:([^)]+)\s*\)\s+"([^"]+)"\^\^[^ ]+\s*\)/g, '$1(?$2, $3)')
            .replace(/BuiltInAtom\s*\(\s*([^ ]+)\s+Variable\s*\(\s*var:([^)]+)\s*\)\s+([\d]+)\s*\)/g, '$1(?$2, $3)')
            // Cleanup namespaces for readability
            .replace(/[a-zA-Z0-9_-]+:/g, (match) => match === 'var:' ? '' : match);
            
        // Join atoms with ^
        // The regex replacement above consumes the wrapper, leaving raw strings separated by spaces usually
        // We need to insert ^ between the closing parenthesis of one atom and the start of the next
        return display.replace(/\)\s+([a-zA-Z0-9_]+)\(/g, ') ^ $1(');
    };

    const bodyHuman = processContent(bodyMatch[1]);
    const headHuman = processContent(headMatch[1]);

    return `${bodyHuman} -> ${headHuman}`;
};