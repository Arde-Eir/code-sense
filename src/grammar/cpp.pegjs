// --- C++ Grammar for Code Sense (Real-World Compatible) ---

// 1. UPDATED START RULE: Allows headers before main()
Start
  = _ pre:Preamble* main:MainFunction { return main; }

// Rules to handle (and ignore) C++ boilerplate
Preamble
  = _ item:(PreprocessorDirective
  / UsingNamespace
  / GlobalVar
  / Comment) { return item; }

PreprocessorDirective
  = "#" [^\n]* { return null; } // Matches #include, #define, etc.

UsingNamespace
  = "using" _ "namespace" _ "std" _ ";" { return null; }

GlobalVar
  = Type _ Identifier _ ";" { return null; } // Simple globals (ignored for scope of thesis)

// 2. The Main Function (The core of your analysis)
MainFunction
  = _ "int" _ "main" _ "(" _ ")" _ "{" _ body:Statement* _ "}" _ {
      // Filter null comments
      const cleanBody = body.filter(s => s !== null);
      
      return { 
        type: "Program", 
        body: cleanBody 
      }; 
    }

Statement
  = _ stmt:(Declaration
  / Assignment
  / IfStatement
  / WhileStatement
  / Block
  / ReturnStatement  
  / Comment) { return stmt; }

// --- 3. Control Structures ---

Declaration
  = type:Type _ name:Identifier _ "=" _ value:Expression _ ";" {
      return { 
        type: "VariableDecl", 
        varType: type, 
        name: name.name, 
        value: value,
        location: location() 
      }; 
    }

Assignment
  = name:Identifier _ "=" _ value:Expression _ ";" {
      return {
        type: "Assignment",
        name: name.name,
        value: value,
        location: location()
      };
    }

WhileStatement
  = "while" _ "(" _ condition:Expression _ ")" _ body:Statement {
      return { 
        type: "WhileStatement", 
        condition: condition, 
        body: body,
        location: location()
      };
    }

IfStatement
  = "if" _ "(" _ condition:Expression _ ")" _ body:Statement _ elseBody:ElseClause? {
      return {
        type: "IfStatement",
        condition: condition,
        body: body,
        elseBody: elseBody, 
        location: location()
      };
    }

ReturnStatement
  = "return" _ value:Expression _ ";" {
      return {
        type: "ReturnStatement",
        value: value,
        location: location()
      };
    }

ElseClause
  = "else" _ body:Statement { return body; }

Block
  = "{" _ body:Statement* _ "}" { 
      // FIX: Filter out null comments here too
      return { 
        type: "Block", 
        body: body.filter(s => s !== null) 
      }; 
    }

Comment
  = "//" [^\n]* [\n]? { return null; }

// --- 4. Expressions & Math ---

Expression
  = Comparison

Comparison
  = left:BinaryExpression _ op:(">" / "<" / ">=" / "<=" / "==" / "!=") _ right:BinaryExpression {
      return { type: "BinaryExpr", operator: op, left, right };
    }
  / BinaryExpression

BinaryExpression
  = head:Term tail:(_ ("+" / "-") _ Term)* {
      return tail.reduce(function(result, element) {
        return {
          type: "BinaryExpr",
          operator: element[1],
          left: result,
          right: element[3],
          location: location() // <--- ADD THIS LINE
        };
      }, head);
    }

Term
  = head:Factor tail:(_ ("*" / "/" / "%") _ Factor)* {
      return tail.reduce(function(result, element) {
        return {
          type: "BinaryExpr",
          operator: element[1],
          left: result,
          right: element[3]
        };
      }, head);
    }

Factor
  = "(" _ expr:Expression _ ")" { return expr; }
  / Float
  / Integer
  / Identifier
  / StringLiteral
  / BooleanLiteral

// --- 5. Lexical Tokens ---

// UPDATED: Supports double, char, long, short, etc.
Type
  = ("long" _ "long" 
  / "long" 
  / "short" 
  / "double" 
  / "char" 
  / "int" 
  / "float" 
  / "string" 
  / "bool" 
  / "void") { return text(); }

Integer "integer"
  = [0-9]+ { return { type: "Integer", value: parseInt(text(), 10) }; }

BooleanLiteral
  = ("true" / "false") { return { type: "Boolean", value: text() === "true" }; }

StringLiteral
  = '"' chars:[^"]* '"' { return { type: "String", value: chars.join("") }; }

Float "float"
  = [0-9]+ "." [0-9]+ { return { type: "Float", value: parseFloat(text()) }; }

Identifier "identifier"
  = !Keyword [a-zA-Z_][a-zA-Z0-9_]* { return { type: "Identifier", name: text() }; }

// UPDATED: Includes all standard C++ type keywords
Keyword
  = "int" / "float" / "double" / "char" / "string" / "bool" / "void" 
  / "long" / "short" 
  / "if" / "else" / "while" / "return" / "true" / "false"

_ "whitespace"
  = [ \t\n\r]*