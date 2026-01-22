export function checkMathSafety(node: any, constraints: Map<string, number> = new Map()) {
    
    // Update known values
    if (node.type === 'VariableDecl' && typeof node.value === 'number') {
        constraints.set(node.name, node.value);
    }

    // CHECK: Division
    if (node.type === 'BinaryExpr' && node.operator === '/') {
        const denominator = node.right;
        
        // 1. Literal Zero (5 / 0)
        if (typeof denominator === 'number' && denominator === 0) {
             throw new Error("Math Error: Division by Literal Zero.");
        }

        // 2. Symbolic Zero (5 / x, where x is 0)
        if (denominator.type === 'Identifier') {
            const val = constraints.get(denominator.name);
            if (val === 0) {
                throw new Error(`Math Error: Division by Zero. Variable '${denominator.name}' is known to be 0.`);
            }
        }
    }

    // Recurse
    // ... (standard recursion similar to other files)
}