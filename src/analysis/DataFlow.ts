export function analyzeDataFlow(node: any, initializedVars: Set<string> = new Set()) {
    if (!node) return;

    // CASE: Declaration (int x = 5;)
    if (node.type === 'VariableDecl') {
        // 1. Check if the value we are assigning is valid
        analyzeDataFlow(node.value, initializedVars); 
        
        // 2. Mark 'x' as initialized in the CURRENT scope
        initializedVars.add(node.name);
    }

    // CASE: Assignment (x = 10;)
    if (node.type === 'Assignment') {
        // 1. Check if the value is valid
        analyzeDataFlow(node.value, initializedVars);

        // 2. Check if 'x' exists (we can assign to existing vars)
        initializedVars.add(node.name); 
    }

    // CASE: Usage (y = x + 1)
    if (node.type === 'Identifier') {
        if (!initializedVars.has(node.name)) {
            throw new Error(
                `Logic Error at Line ${node.location?.start.line}: ` +
                `Variable '${node.name}' is used here, but it has not been initialized yet.`
            );
        }
    }

    // CASE: Return Statement (return x;)
    if (node.type === 'ReturnStatement') {
        analyzeDataFlow(node.value, initializedVars);
    }

    // Recursion for Expressions (Binary Math)
    if (node.type === 'BinaryExpr') {
        analyzeDataFlow(node.left, initializedVars);
        analyzeDataFlow(node.right, initializedVars);
    }

    // Recursion for Control Structures (If, While)
    if (node.type === 'IfStatement') {
        analyzeDataFlow(node.condition, initializedVars);
        
        // Create a branched scope for the 'If' body
        // (Variables declared inside IF shouldn't leak out)
        analyzeDataFlow(node.body, new Set(initializedVars));
        
        if (node.elseBody) {
            analyzeDataFlow(node.elseBody, new Set(initializedVars));
        }
    }

    else if (node.type === 'WhileStatement') {
        analyzeDataFlow(node.condition, initializedVars);
        // Loop body gets its own scope
        analyzeDataFlow(node.body, new Set(initializedVars));
    }

    // Recursion for Blocks ( { ... } ) and Programs
    else if (node.body) {
         if (Array.isArray(node.body)) {
             // Create ONE local scope for this entire block
             // This ensures "int x" on line 1 is seen by line 2
             const blockScope = new Set(initializedVars); 

             // Add type '(n: any)' to silence the TypeScript error
             node.body.forEach((n: any) => analyzeDataFlow(n, blockScope));
         } else {
             // Single statement body
             analyzeDataFlow(node.body, new Set(initializedVars));
         }
    }
}