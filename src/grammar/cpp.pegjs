//
// --- C++ Grammar for Code Sense (Real-World Compatible) ---

// 1. UPDATED START RULE: Allows whitespace/newlines at the very start
Start
  = _ Preamble* main:MainFunction { return main; }

// Rules to handle (and ignore) C++ boilerplate
Preamble
  = _ item:(PreprocessorDirective
  / UsingNamespace
  / GlobalVar
  / Comment) { return item; }

PreprocessorDirective
  = "#" [^\n]* { return null; }

UsingNamespace
  = "using" _ "namespace" _ "std" _ ";" { return null; }

GlobalVar
  = Type _ Identifier _ ";" { return null; }

// 2. The Main Function
MainFunction
  = _ "int" _ "main" _ "(" _ ")" _ "{" _ body:Statement* _ "}" _ {
      // Filter null comments
      const cleanBody = body.filter(s => s !== null);
      return { type: "Program", body: cleanBody }; 
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
      return { type: "BinaryExpr", operator: op, left, right, location: location() };
    }
  / BinaryExpression

// FIX: Added 'location: location()' here so Math Safety knows where to flag errors
BinaryExpression
  = head:Term tail:(_ ("+" / "-") _ Term)* {
      return tail.reduce(function(result, element) {
        return {
          type: "BinaryExpr",
          operator: element[1],
          left: result,
          right: element[3],
          location: location() 
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
          right: element[3],
          location: location() 
        };
      }, head);
    }

Factor
  = "(" _ expr:Expression _ ")" { return expr; }
  / Float    // <--- CRITICAL: Float MUST be before Integer to catch "0.0"
  / Integer
  / Identifier
  / StringLiteral
  / BooleanLiteral

// --- 5. Lexical Tokens ---

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

// Float Rule
Float "float"
  = [0-9]+ "." [0-9]+ { return { type: "Float", value: parseFloat(text()) }; }

Identifier "identifier"
  = !Keyword [a-zA-Z_][a-zA-Z0-9_]* { return { type: "Identifier", name: text() }; }

Keyword
  = "int" / "float" / "double" / "char" / "string" / "bool" / "void" 
  / "long" / "short" 
  / "if" / "else" / "while" / "return" / "true" / "false"

_ "whitespace"
  = [ \t\n\r]*