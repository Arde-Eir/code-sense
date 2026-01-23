// src/analysis/SymbolicExe.ts

/**
 * Performs symbolic execution to detect mathematical safety issues like division by zero.
 */
export function checkMathSafety(node: any, constraints: Map<string, number> = new Map()): Map<string, number> {
    if (!node) return constraints;

    // 1. Traverse Program/Block
    // Removed the 'blockConstraints' copy to allow variable changes to persist globally.
    if (node.type === 'Program' || node.type === 'Block') {
        if (node.body && Array.isArray(node.body)) {
            node.body.forEach((child: any) => checkMathSafety(child, constraints));
        }
        return constraints;
    }

    // 2. Traverse Loops/Ifs
    // Changes made inside an 'if' block (like factor = 0) will now be remembered after the block ends.
    if (node.type === 'WhileStatement' || node.type === 'IfStatement') {
    checkMathSafety(node.condition, constraints);
    
    // Pass the actual constraints map so changes (like y = 0) persist
    checkMathSafety(node.body, constraints);
    
    if (node.elseBody) {
        checkMathSafety(node.elseBody, constraints);
    }
    return constraints; // Path-specific return for TypeScript compliance
}

    // 3. Update Variables
    // Tracks literals and identifier assignments to build a "memory" of variable values.
    if (node.type === 'VariableDecl' || node.type === 'Assignment') {
        const valueNode = node.value;
        if (valueNode) {
            // Case A: Assignment to a literal number (e.g., x = 5)
            if (valueNode.type === 'Integer' || valueNode.type === 'Float') {
                constraints.set(node.name, Number(valueNode.value));
            } 
            // Case B: Assignment to another variable (e.g., b = a)
            else if (valueNode.type === 'Identifier') {
                const existingValue = constraints.get(valueNode.name);
                if (existingValue !== undefined) {
                    constraints.set(node.name, existingValue);
                } else {
                    constraints.delete(node.name);
                }
            } 
            // Case C: Complex expression or unknown (e.g., x = y + 2)
            else {
                constraints.delete(node.name);
            }
        }
    }

    // 4. CRITICAL: Check Division Safety
    // Detects both literal zeros and variables that the engine has tracked as being zero.
    if (node.type === 'BinaryExpr' && (node.operator === '/' || node.operator === '%')) {
        const denominator = node.right;
        
        // CHECK A: Literal Zero (0 or 0.0)
        if ((denominator.type === 'Integer' || denominator.type === 'Float')) {
             const val = Number(denominator.value);
             if (val === 0) {
                 const err = new Error(`Math Error: Division by Literal Zero.`);
                 (err as any).location = node.location;
                 throw err;
             }
        }

        // CHECK B: Variable Zero (Uses the persistent constraints map)
        if (denominator.type === 'Identifier') {
             const val = constraints.get(denominator.name);
             if (val === 0) {
                 const err = new Error(`Math Error: Division by Zero. Variable '${denominator.name}' is known to be 0.`);
                 (err as any).location = node.location;
                 throw err;
             }
        }
    }

    // 5. Recursion 
    if (node.left) checkMathSafety(node.left, constraints);
    if (node.right) checkMathSafety(node.right, constraints);
    if (node.value) checkMathSafety(node.value, constraints);
    if (node.condition) checkMathSafety(node.condition, constraints);

    // FINAL RETURN: Ensures TypeScript always receives a Map, clearing the 'void' and 'missing return' errors.
    return constraints;
}