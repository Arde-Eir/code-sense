export function checkMathSafety(node: any, constraints: Map<string, number> = new Map()) {
    if (!node) return;
  
    // 1. Handle Program / Block traversal (Execute statements in order)
    if (node.type === 'Program' || node.type === 'Block') {
        if (node.body && Array.isArray(node.body)) {
             node.body.forEach((child: any) => checkMathSafety(child, constraints));
        }
        return;
    }
  
    // 2. Handle Loops/Ifs traversal
    if (node.type === 'WhileStatement' || node.type === 'IfStatement') {
         checkMathSafety(node.condition, constraints); // Check condition for math errors too
         checkMathSafety(node.body, constraints);
         if (node.elseBody) checkMathSafety(node.elseBody, constraints);
         return;
    }
  
    // 3. Update known values (Variable Declaration)
    if (node.type === 'VariableDecl' && node.value) {
        if (node.value.type === 'Integer' || node.value.type === 'Float') {
            constraints.set(node.name, Number(node.value.value));
        } else {
            // If we assign a complex expression, we lose track of the value
            constraints.delete(node.name);
        }
    }

    // Handle Assignment 
    if (node.type === 'Assignment') {
        // Case 1: Simple Number (e.g., x = 5;)
        if (node.value && (node.value.type === 'Integer' || node.value.type === 'Float')) {
            constraints.set(node.name, Number(node.value.value));
        } 
        // Case 2: Complex Expression (e.g., x = x + 1;)
        else {
            constraints.delete(node.name);
        }
    }
  
    // 4. CHECK: Division Safety (THE FIX IS HERE)
    if (node.type === 'BinaryExpr' && node.operator === '/') {
        const denominator = node.right;
        
        // Check A: Literal Zero (5 / 0 or 5 / 0.0)
        if ((denominator.type === 'Integer' || denominator.type === 'Float') && Number(denominator.value) === 0) {
             const err = new Error(`Math Error: Division by Literal Zero.`);
             (err as any).location = node.location;
             throw err;
        }

        // Check B: Variable Zero (5 / zero) <--- THIS WAS MISSING
        if (denominator.type === 'Identifier') {
             const val = constraints.get(denominator.name);
             if (val === 0) {
                 const err = new Error(`Math Error: Division by Zero. Variable '${denominator.name}' is known to be 0.`);
                 (err as any).location = node.location;
                 throw err;
             }
        }
    }
  
    // Recurse into children expressions (for nested math like "1 + (x / y)")
    if (node.left) checkMathSafety(node.left, constraints);
    if (node.right) checkMathSafety(node.right, constraints);
    if (node.value) checkMathSafety(node.value, constraints);
    if (node.condition) checkMathSafety(node.condition, constraints);
}