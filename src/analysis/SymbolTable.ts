export class SymbolTable {
    private scopes: Map<string, string>[];

    constructor() {
        this.scopes = [new Map()]; // Start with global scope
    }

    enterScope() {
        this.scopes.push(new Map());
    }

    exitScope() {
        this.scopes.pop();
    }

    // Register a variable
    define(name: string, type: string) {
        this.scopes[this.scopes.length - 1].set(name, type);
    }

    // Find a variable's type
    lookup(name: string): string | undefined {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(name)) {
                return this.scopes[i].get(name);
            }
        }
        return undefined;
    }
}