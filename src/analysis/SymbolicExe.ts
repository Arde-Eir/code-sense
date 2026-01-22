// Replace or Update SymbolicExe.ts
export function checkMathSafety(node: any, constraints: Map<string, number> = new Map()) {
    if (!node) return;

    // 1. Handle Program / Block traversal (CRITICAL ADDITION)
    if (node.type === 'Program' || node.type === 'Block') {
        if (node.body && Array.isArray(node.body)) {
             node.body.forEach((child: any) => checkMathSafety(child, constraints));
        }
        return;
    }

    // 2. Handle Loops/Ifs traversal
    if (node.type === 'WhileStatement' || node.type === 'IfStatement') {
         checkMathSafety(node.body, constraints);
         if (node.elseBody) checkMathSafety(node.elseBody, constraints);
         return;
    }

    // 3. Update known values (Variable Declaration)
    if (node.type === 'VariableDecl' && node.value) {
        if (node.value.type === 'Integer' || node.value.type === 'Float') {
            constraints.set(node.name, node.value.value);
        }
    }
    // Handle Assignment updates
   if (node.type === 'Assignment' && node.value) {
        if (node.value.type === 'Integer' || node.value.type === 'Float') {
            constraints.set(node.name, node.value.value);
        }
    }

    // 4. CHECK: Division Safety
    if (node.type === 'BinaryExpr' && node.operator === '/') {
        const denominator = node.right;
        
        // Literal Zero (5 / 0 or 5 / 0.0)
        if ((denominator.type === 'Integer' || denominator.type === 'Float') && denominator.value === 0) {
             throw new Error(`Math Error at Line ${node.location?.start.line}: Division by Literal Zero.`);
        }}

    // Recurse into children expressions (e.g. for nested math)
    if (node.left) checkMathSafety(node.left, constraints);
    if (node.right) checkMathSafety(node.right, constraints);
    if (node.value) checkMathSafety(node.value, constraints);
}