export function calculateScore(node: any, nestingDepth: number = 0): number {
    if (!node) return 0;
    
    let score = 0;
    
    // Check if this node is a "Control Structure" that adds complexity
    const isControlStructure = 
        node.type === 'IfStatement' || 
        node.type === 'WhileStatement' || 
        node.type === 'ForStatement';

    if (isControlStructure) {
        score += 1;             // Base cost
        score += nestingDepth;  // Penalty for nesting (The deeper, the worse)
    }

    // Calculate next depth
    const nextDepth = isControlStructure ? nestingDepth + 1 : nestingDepth;

    // Recurse children
    if (node.body) {
        if (Array.isArray(node.body)) {
            // Add ': any' to the parameter
node.body.forEach((child: any) => {
    score += calculateScore(child, nextDepth);
});
        } else {
            score += calculateScore(node.body, nextDepth);
        }
    }
    
    // Also check 'else' blocks or 'left/right' in expressions if needed
    
    return score;
}

export function getRank(score: number): string {
    if (score === 0) return "S+ (Perfectly Flat)";
    if (score <= 3) return "A (Clean)";
    if (score <= 6) return "B (Acceptable)";
    if (score <= 10) return "C (Complex)";
    return "F (Spaghetti Code)";
}