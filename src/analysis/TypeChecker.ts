import { SymbolTable } from './SymbolTable';

export function performTypeCheck(ast: any, symbols: SymbolTable) {
  if (!ast) return;
  traverse(ast, symbols);
}

function traverse(node: any, symbols: SymbolTable) {
    if (!node) return;

    // 1. Handle Variable Declaration 
    if (node.type === 'VariableDecl') {
        const declaredType = node.varType; 
        const valueType = inferType(node.value, symbols); 

        // Register the variable in the symbol table
        symbols.define(node.name, declaredType);

        // Check for mismatches 
        if (valueType !== 'unknown' && valueType !== declaredType) {
             throw new Error(`Type Error at Line ${node.location?.start.line}: Cannot assign value of type '${valueType}' to variable '${node.name}' (expects '${declaredType}').`);
        }
    }
    
    // 2. Handle Assignment 
    else if (node.type === 'Assignment') {
        const varType = symbols.lookup(node.name);
        if (!varType) {
             throw new Error(`Error at Line ${node.location?.start.line}: Variable '${node.name}' is not declared.`);
        }
        
        const valueType = inferType(node.value, symbols);
        if (valueType !== 'unknown' && valueType !== varType) {
             throw new Error(`Type Error: Cannot assign '${valueType}' to '${node.name}' (expects '${varType}').`);
        }
    }
    
    // 3. Traverse into Blocks ( { ... } )
    else if (node.type === 'Program' || node.type === 'Block') {
        if (node.body && Array.isArray(node.body)) {
             node.body.forEach((child: any) => traverse(child, symbols));
        }
    }
    
    // 4. Traverse into Loops and Ifs
    else if (node.type === 'WhileStatement' || node.type === 'IfStatement') {
        traverse(node.body, symbols);
        if(node.elseBody) traverse(node.elseBody, symbols);
    }
}

function inferType(node: any, symbols: SymbolTable): string {
    if (!node) return 'unknown';

    if (node.type === 'Integer') return 'int';
    if (node.type === 'Float') return 'float';
    if (node.type === 'String') return 'string';
    if (node.type === 'Boolean') return 'bool';
    
    if (node.type === 'Identifier') {
        return symbols.lookup(node.name) || 'unknown';
    }

    if (node.type === 'BinaryExpr') {
        const leftType = inferType(node.left, symbols);
        const rightType = inferType(node.right, symbols); // Get right type
        
        // Boolean operations always return bool
        if (['>', '<', '>=', '<=', '==', '!='].includes(node.operator)) {
            return 'bool';
        }

        // Math operations: Promote to float if either side is float
        if (leftType === 'float' || rightType === 'float') {
            return 'float';
        }

        // Otherwise, default to the left type (e.g., int + int = int)
        return leftType; 
    }

    return 'unknown';
}