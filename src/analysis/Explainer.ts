// 1. THE KNOWLEDGE BASE (Templates)
const TEMPLATES = {
    VariableDecl: (name: string, type: string, val: string) => 
        `You are declaring a new variable named **${name}**. It is a storage box that holds **${type}** data. You have initialized it with the value **${val}**.`,
    
    WhileStatement: (cond: string) => 
        `This is a **Loop**. The computer will keep repeating the code inside this block as long as the condition **(${cond})** remains True. Be careful of infinite loops!`,
    
    IfStatement: (cond: string) => 
        `This is a **Decision Gate**. The computer checks **(${cond})**. If it is True, it enters the block. If False, it skips it.`,
    
    Assignment: (name: string, val: string) => 
        `You are updating the value of **${name}**. The old value is erased, and **${val}** is stored in its place.`
};

// 2. THE TRANSLATOR FUNCTION
export function explainNode(node: any): string {
    if (!node) return "";

    switch (node.type) {
        case 'VariableDecl':
            // Extract raw values for the template
            // Note: In a real app, you might pretty-print the 'value' expression
            return TEMPLATES.VariableDecl(node.name, node.varType, JSON.stringify(node.value));

        case 'WhileStatement':
            // "Synthesize" the condition string from the AST
            const condStr = synthesizeExpression(node.condition);
            return TEMPLATES.WhileStatement(condStr);

        case 'IfStatement':
            const ifCond = synthesizeExpression(node.condition);
            return TEMPLATES.IfStatement(ifCond);

        default:
            return "This is a C++ statement.";
    }
}

// Helper to turn AST Expression back into string for the explanation
function synthesizeExpression(expr: any): string {
    if (expr.type === 'BinaryExpr') {
        return `${synthesizeExpression(expr.left)} ${expr.operator} ${synthesizeExpression(expr.right)}`;
    }
    if (expr.type === 'Identifier') return expr.name;
    if (expr.type === 'Integer') return expr.value.toString();
    return "...";
}