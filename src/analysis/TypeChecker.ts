import { SymbolTable } from './SymbolTable';

export function performTypeCheck(ast: any, symbols: SymbolTable) {
  if (!ast) return;
  traverse(ast, symbols);
}

function traverse(node: any, symbols: SymbolTable) {
    if (!node) return;

    // 1. Handle Variable Declaration (int x = 10;)
    if (node.type === 'VariableDecl') {
        const declaredType = node.varType; // e.g., "int"
        const valueType = inferType(node.value, symbols); // We need this to return "int"

        // Register the variable in the symbol table
        symbols.define(node.name, declaredType);

        // Check for mismatches (e.g., int x = "hello";)
        if (valueType !== 'unknown' && valueType !== declaredType) {
             throw new Error(`Type Error at Line ${node.location?.start.line}: Cannot assign value of type '${valueType}' to variable '${node.name}' (expects '${declaredType}').`);
        }
    }
    
    // 2. Handle Assignment (x = 5;)
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

    // Match the exact types from your Grammar
    if (node.type === 'Integer') return 'int';
    if (node.type === 'Float') return 'float'; // <--- NEW LINE ADDED
    if (node.type === 'String') return 'string';
    if (node.type === 'Boolean') return 'bool';
    
    // Look up variables
    if (node.type === 'Identifier') {
        return symbols.lookup(node.name) || 'unknown';
    }

    // Handle Math (x + 1)
    if (node.type === 'BinaryExpr') {
        const leftType = inferType(node.left, symbols);
        
        // If comparing (>, <, ==), result is bool
        if (['>', '<', '>=', '<=', '==', '!='].includes(node.operator)) {
            return 'bool';
        }

        // If doing math (+, -), result is int/float
        return leftType; 
    }

    return 'unknown';
}