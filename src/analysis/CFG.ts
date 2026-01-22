// Algorithm 7: Control Flow Graph Construction (With Value Extraction)
export function buildCFG(ast: any) {
    const nodes: any[] = [];
    const edges: any[] = [];
    let nodeId = 0;

    // Helper: Tries to turn an AST node back into readable text (e.g., 10, "hello", x + 1)
    function getReadableValue(node: any): string {
        if (!node) return "unknown";
        if (node.type === "Integer") return `${node.value}`;
        if (node.type === "String") return `"${node.value}"`;
        if (node.type === "Boolean") return `${node.value}`;
        if (node.type === "Identifier") return node.name;
        if (node.type === "BinaryExpr") return "a calculated result"; // Simplification for complex math
        return "a value";
    }

    // MERGED: Accepts 'description' (for tooltip) AND 'location' (for scrolling)
    function createNode(label: string, description: string, location: any = null) {
        const id = `${nodeId++}`;
        nodes.push({ id, label, description, location });
        return id;
    }

    function createEdge(source: string, target: string, label: string = "") {
        edges.push({ source, target, label });
    }

    function traverse(node: any, previousNodeId: string): string {
        if (!node) return previousNodeId;

        // 1. Handle Block
        if (node.type === 'Program' || node.type === 'Block') {
            let currentPrev = previousNodeId;
            if (node.body && Array.isArray(node.body)) {
                node.body.forEach((child: any) => {
                    currentPrev = traverse(child, currentPrev);
                });
            }
            return currentPrev;
        }

        // 2. Handle Variables (Now shows the VALUE)
        if (node.type === 'VariableDecl') {
            const valStr = getReadableValue(node.value);
            // Dynamic description based on what is being stored
            const desc = `Initialization: This creates a '${node.varType}' variable named '${node.name}' and stores the value [ ${valStr} ] inside it.`;
            
            const id = createNode(`${node.varType} ${node.name} = ...`, desc, node.location);
            if (previousNodeId) createEdge(previousNodeId, id);
            return id;
        }
        
        // 3. Handle Assignment (Now shows the VALUE)
        if (node.type === 'Assignment') {
            const valStr = getReadableValue(node.value);
            const desc = `Update: The variable '${node.name}' is being updated. The new value stored is [ ${valStr} ].`;
            
            const id = createNode(`${node.name} = ...`, desc, node.location);
            if (previousNodeId) createEdge(previousNodeId, id);
            return id;
        }

        // 4. Handle IF Statements
        if (node.type === 'IfStatement') {
            const desc = `Decision: Checks if the condition at Line ${node.location?.start.line} is TRUE.`;
            const conditionId = createNode(`if (...)`, desc, node.location);
            if (previousNodeId) createEdge(previousNodeId, conditionId);

            const endTrue = traverse(node.body, conditionId);
            let endFalse = conditionId;
            if (node.elseBody) {
                endFalse = traverse(node.elseBody, conditionId);
            }

            const mergeId = createNode("End If", "Merge: The True and False paths rejoin here.");
            createEdge(endTrue, mergeId);
            createEdge(endFalse, mergeId);
            return mergeId;
        }

        // 5. Handle WHILE Loops
        if (node.type === 'WhileStatement') {
            const desc = `Loop: Checks if the condition is still TRUE to decide whether to repeat.`;
            const conditionId = createNode(`while (...)`, desc, node.location);
            if (previousNodeId) createEdge(previousNodeId, conditionId);

            const endBody = traverse(node.body, conditionId);
            createEdge(endBody, conditionId, "Loop");

            const exitId = createNode("End While", "Exit: The loop condition became FALSE, so we stop repeating.");
            createEdge(conditionId, exitId, "Exit");
            return exitId;
        }

        // 6. Handle Return
        if (node.type === 'ReturnStatement') {
             const valStr = getReadableValue(node.value);
             const desc = `Return: The function stops and sends the value [ ${valStr} ] back to the system.`;
             const id = createNode("Return", desc, node.location);
             if (previousNodeId) createEdge(previousNodeId, id);
             return id;
        }

        return previousNodeId;
    }

    const startId = createNode("Start", "Program Begin");
    const endId = traverse(ast, startId);
    createNode("End", "Program End");
    createEdge(endId, `${nodeId - 1}`);

    return { nodes, edges };
}