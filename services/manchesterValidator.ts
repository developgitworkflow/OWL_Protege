
export const validateManchesterSyntax = (expression: string): { isValid: boolean; error: string | null } => {
    if (!expression || !expression.trim()) return { isValid: false, error: 'Expression cannot be empty' };
    
    const text = expression.trim();
    
    // 1. Parentheses Balance
    let balance = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '(') balance++;
        if (text[i] === ')') balance--;
        if (balance < 0) return { isValid: false, error: 'Unexpected closing parenthesis' };
    }
    if (balance !== 0) return { isValid: false, error: 'Unbalanced parentheses' };

    // 2. Token Analysis
    // Split by delimiters to inspect sequence
    const tokens = text.split(/([()<>=\s]+)/).map(t => t.trim()).filter(t => t);
    
    if (tokens.length === 0) return { isValid: false, error: 'Empty expression' };

    // Start/End checks
    const first = tokens[0].toLowerCase();
    const last = tokens[tokens.length - 1].toLowerCase();

    if (['and', 'or', 'that'].includes(first)) return { isValid: false, error: 'Cannot start with binary operator' };
    if (['and', 'or', 'not', 'that', 'some', 'only', 'value', 'min', 'max', 'exactly'].includes(last)) {
        // Exception: 'Self' can be at end
        if (last !== 'self') return { isValid: false, error: `Cannot end with operator '${last}'` };
    }

    for (let i = 0; i < tokens.length; i++) {
        const curr = tokens[i].toLowerCase();
        const next = i < tokens.length - 1 ? tokens[i+1].toLowerCase() : null;

        // Cardinality check
        if (['min', 'max', 'exactly'].includes(curr)) {
            if (!next) return { isValid: false, error: `${curr} requires a number` };
            if (isNaN(Number(next))) return { isValid: false, error: `${curr} must be followed by a number` };
        }

        // Binary operators cannot follow each other
        if (['and', 'or'].includes(curr)) {
            if (next && ['and', 'or', 'that'].includes(next)) return { isValid: false, error: `Invalid sequence: ${curr} ${next}` };
        }
        
        // Quantifiers should not be followed immediately by binary operators
        if (['some', 'only', 'value'].includes(curr)) {
             if (next && ['and', 'or', 'that'].includes(next)) return { isValid: false, error: `Invalid sequence: ${curr} ${next}` };
        }
    }

    return { isValid: true, error: null };
};
