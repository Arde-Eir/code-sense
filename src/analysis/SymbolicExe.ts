export function checkMathSafety(node: any, constraints: Map<string, number> = new Map()) {
    if (!node) return;
  
    // 1. Traverse Program/Block
    if (node.type === 'Program' || node.type === 'Block') {
        if (node.body && Array.isArray(node.body)) {
             node.body.forEach((child: any) => checkMathSafety(child, constraints));
        }
        return;
    }
  
    // 2. Traverse Loops/Ifs
    if (node.type === 'WhileStatement' || node.type === 'IfStatement') {
         checkMathSafety(node.condition, constraints); 
         checkMathSafety(node.body, constraints);
         if (node.elseBody) checkMathSafety(node.elseBody, constraints);
         return;
    }
  
    // 3. Update Variables
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
    if (node.type === 'BinaryExpr' && node.operator === '/') {
        const denominator = node.right;
        
        // CHECK A: Literal Zero (0 or 0.0)
        // We convert to Number() to handle cases where parser returns string "0.0"
        if ((denominator.type === 'Integer' || denominator.type === 'Float')) {
             const val = Number(denominator.value);
             if (val === 0) {
                 const err = new Error(`Math Error: Division by Literal Zero.`);
                 (err as any).location = node.location;
                 throw err;
             }
        }

        // CHECK B: Variable Zero
        if (denominator.type === 'Identifier') {
             const val = constraints.get(denominator.name);
             if (val === 0) {
                 const err = new Error(`Math Error: Division by Zero. Variable '${denominator.name}' is known to be 0.`);
                 (err as any).location = node.location;
                 throw err;
             }
        }
    }
  
    // 5. Recursion (Drill down into nested expressions)
    if (node.left) checkMathSafety(node.left, constraints);
    if (node.right) checkMathSafety(node.right, constraints);
    if (node.value) checkMathSafety(node.value, constraints);
    if (node.condition) checkMathSafety(node.condition, constraints);
}