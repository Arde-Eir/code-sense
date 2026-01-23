import React, { useState, useRef } from 'react';
import './App.css'; 

// --- IMPORTS ---
// @ts-ignore
import * as parserModule from './grammar/cppParser.js'; 
import { SymbolTable } from './analysis/SymbolTable';
import { performTypeCheck } from './analysis/TypeChecker';
import { analyzeDataFlow } from './analysis/DataFlow';
import { checkMathSafety } from './analysis/SymbolicExe';
import { calculateScore, getRank } from './gamification/Score';
import { Visualizer } from './UI/Visualizer';

// ========================================================
// HELPER FUNCTIONS
// ========================================================

// --- HELPER 1: Token Generation ---
const extractTokens = (node: any, tokens: any[] = []) => {
  if (!node) return tokens;

  if (node.type === 'Program') {
    // ... existing Program logic ...
    tokens.push({ type: 'Keyword', value: 'int' });
    tokens.push({ type: 'Identifier', value: 'main' });
    tokens.push({ type: 'Separator', value: '(' });
    tokens.push({ type: 'Separator', value: ')' });
    tokens.push({ type: 'Separator', value: '{' });
    if (node.body) { (Array.isArray(node.body) ? node.body : [node.body]).forEach((child: any) => extractTokens(child, tokens)); }
    tokens.push({ type: 'Separator', value: '}' });
  }
  else if (node.type === 'VariableDecl') {
    // ... existing VariableDecl logic ...
    tokens.push({ type: 'Keyword', value: node.varType }); 
    tokens.push({ type: 'Identifier', value: node.name }); 
    if (node.value) {
      tokens.push({ type: 'Operator', value: '=' });
      extractTokens(node.value, tokens);
    }
    tokens.push({ type: 'Separator', value: ';' });
  }
  else if (node.type === 'Assignment') {
    // ... existing Assignment logic ...
    tokens.push({ type: 'Identifier', value: node.name });
    tokens.push({ type: 'Operator', value: '=' });
    extractTokens(node.value, tokens);
    tokens.push({ type: 'Separator', value: ';' });
  }
  else if (node.type === 'BinaryExpr') {
    // ... existing BinaryExpr logic ...
    extractTokens(node.left, tokens);
    tokens.push({ type: 'Operator', value: node.operator });
    extractTokens(node.right, tokens);
  }
  else if (node.type === 'WhileStatement') {
    // ... existing WhileStatement logic ...
    tokens.push({ type: 'Keyword', value: 'while' });
    tokens.push({ type: 'Separator', value: '(' });
    extractTokens(node.condition, tokens);
    tokens.push({ type: 'Separator', value: ')' });
    tokens.push({ type: 'Separator', value: '{' });
    if (node.body) { (Array.isArray(node.body) ? node.body : [node.body]).forEach((child: any) => extractTokens(child, tokens)); }
    tokens.push({ type: 'Separator', value: '}' });
  }
  // --- ADD THE NEW IF STATEMENT LOGIC HERE ---
  else if (node.type === 'IfStatement') {
    tokens.push({ type: 'Keyword', value: 'if' });
    tokens.push({ type: 'Separator', value: '(' });
    extractTokens(node.condition, tokens);
    tokens.push({ type: 'Separator', value: ')' });
    
    // Check if the body exists and extract its tokens
    if (node.body) extractTokens(node.body, tokens);
    
    // If there is an 'else' part, handle it too
    if (node.elseBody) {
      tokens.push({ type: 'Keyword', value: 'else' });
      extractTokens(node.elseBody, tokens);
    }
  }
  else if (node.type === 'ReturnStatement') {
    // ... existing ReturnStatement logic ...
    tokens.push({ type: 'Keyword', value: 'return' });
    extractTokens(node.value, tokens);
    tokens.push({ type: 'Separator', value: ';' });
  }
  // ... existing literal and identifier logic ...
  else if (node.type === 'Integer') tokens.push({ type: 'Literal', value: node.value.toString() });
  else if (node.type === 'Float') tokens.push({ type: 'Literal', value: node.value.toString() }); 
  else if (node.type === 'String') tokens.push({ type: 'Literal', value: `"${node.value}"` });
  else if (node.type === 'Identifier') tokens.push({ type: 'Identifier', value: node.name });

  return tokens;
};

// --- HELPER 2: Extract Math Operations (FIXED: Handles 0.0 & Recursion) ---
const extractMathOps = (node: any, list: any[] = []) => {
  if (!node) return list;

  if (node.type === 'BinaryExpr') {
    let rightVal = '?';
    
    // Robust right-side handling for UI display
    if (node.right.type === 'Identifier') {
        rightVal = node.right.name;
    } else if (node.right.type === 'Integer' || node.right.type === 'Float') {
        rightVal = node.right.value.toString();
    } else if (node.right.type === 'BinaryExpr') {
        rightVal = '(Expr)'; 
    }

    list.push({ 
      op: node.operator, 
      left: node.left.type === 'Identifier' ? node.left.name : (node.left.value ?? '?'), 
      right: rightVal, 
      rightRaw: node.right.value, 
      line: node.location?.start?.line || 0 
    });
  }

  // Recursively check all children
  if (node.body) { (Array.isArray(node.body) ? node.body : [node.body]).forEach((child: any) => extractMathOps(child, list)); }
  if (node.left) extractMathOps(node.left, list);
  if (node.right) extractMathOps(node.right, list);
  if (node.condition) extractMathOps(node.condition, list);
  if (node.value) extractMathOps(node.value, list);
  if (node.elseBody) extractMathOps(node.elseBody, list); 

  return list;
};

// --- HELPER 3: Extract Variables ---
const extractVariables = (node: any, list: any[] = []) => {
  if (!node) return list;
  if (node.type === 'VariableDecl') {
    list.push({ type: node.varType, name: node.name, line: node.location?.start?.line || 0 });
  }
  if (node.body) { (Array.isArray(node.body) ? node.body : [node.body]).forEach((child: any) => extractVariables(child, list)); }
  return list;
};

// ========================================================
// MAIN COMPONENT
// ========================================================
function App() {
  const [code, setCode] = useState(`int main() {
  int x = 10;
  int y = 5;
  int result = 0;

  while(x > 0) {
    result = x / y; // Math Check
    x = x - 1/0.0;
  }
  return 0;
}`);
  
  const [ast, setAst] = useState<any>(null);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [gamification, setGamification] = useState<{score: number, rank: string} | null>(null);
  
  const [activeTab, setActiveTab] = useState<'lexical' | 'syntactic' | 'symbols' | 'math' | 'logs'>('lexical');
  const [tokens, setTokens] = useState<any[]>([]);
  const [mathOps, setMathOps] = useState<any[]>([]);
  const [symbolData, setSymbolData] = useState<any[]>([]);

  const [solvedValues, setSolvedValues] = useState<Map<string, number>>(new Map());

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
      if (textAreaRef.current && lineNumbersRef.current) {
          lineNumbersRef.current.scrollTop = textAreaRef.current.scrollTop;
      }
  };

  const handleAnalyze = () => {
    setConsoleOutput([]); 
    const logs: string[] = [];
    const log = (msg: string) => logs.push(msg);

    // 1. DYNAMIC PARSER LOADING (Revised for Namespace Imports)
    let parseFunction;

    if (parserModule && typeof parserModule.parse === 'function') {
      // Standard for "import * as parserModule"
      parseFunction = parserModule.parse;
    } else if (typeof parserModule === 'function') {
      // In some environments, the module itself is the function
      parseFunction = parserModule;
    } else if (parserModule && (parserModule as any).default) {
      // Fallback for default exports if they existed
      const def = (parserModule as any).default;
      parseFunction = typeof def.parse === 'function' ? def.parse : def;
    }

    if (!parseFunction) {
       console.error("DEBUG: parserModule structure:", parserModule);
       alert("CRITICAL ERROR: Parser 'parse' function not found!");
       log("❌ Critical Error: Parser module does not contain a 'parse' function.");
       setConsoleOutput(logs);
       return;
    }

    try {
      // 1. PARSING PHASE
      log("1. Starting Lexical & Syntactic Analysis...");
      const parsedAst = parseFunction(code);
      log("✅ Parsing Successful! AST Generated.");

      // --- 3. ANALYSIS PHASE ---
      
      // A. Type Checking
      log("2. Running Semantic Safety Checks...");
      const symbols = new SymbolTable();
      performTypeCheck(parsedAst, symbols);
      log("✅ Type Safety: Passed.");

      // B. Data Flow Analysis
      analyzeDataFlow(parsedAst);
      log("✅ Data Flow: Checked.");

      // C. Gamification
      const score = calculateScore(parsedAst);
      const rank = getRank(score);
      setGamification({ score, rank });

      // 4. UPDATE UI STATE (Do this BEFORE checks that might throw errors)
      setAst(parsedAst);
setTokens(extractTokens(parsedAst));
setMathOps(extractMathOps(parsedAst));
setSymbolData(extractVariables(parsedAst));

      // D. MATH SAFETY (Place this last so UI updates even if it fails)
      const finalValues = checkMathSafety(parsedAst); 
      setSolvedValues(finalValues); // Store this for the Math Tab!
      log("✅ Mathematical Safety: No division by zero detected.");

setActiveTab('lexical');
      log("3. Generating Control Flow Graph...");

      // D. MATH SAFETY (Place this last so UI updates even if it fails)
      checkMathSafety(parsedAst); 
      log("✅ Mathematical Safety: No division by zero detected.");

    } catch (error: any) {
      // SAFE ERROR HANDLING (Prevents UI Freeze)
      console.error("Analysis Error:", error);
      if (error.location && error.location.start) {
        log(`❌ Error at Line ${error.location.start.line}: ${error.message}`);
      } else {
        log(`❌ System Error: ${error.message}`);
      }
      setAst(null); 
    }
    setConsoleOutput(logs);
  };

  const handleNodeHover = (location: any) => {
    if (!location || !textAreaRef.current) return;
    const startIndex = location.start.offset;
    const endIndex = location.end.offset;
    textAreaRef.current.focus();
    textAreaRef.current.setSelectionRange(startIndex, endIndex);
    const lineHeight = 21; 
    const scrollPos = (location.start.line - 1) * lineHeight;
    textAreaRef.current.scrollTop = scrollPos - 40; 
  };

  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className="app-container">
      <header className="header">
        <h1>Code Sense 🎓 (v2)</h1>
      </header>

      <div className="main-content">
        <div className="editor-panel">
          <h3>Source Code Input</h3>
          
          <div className="code-editor-wrapper">
              <div className="line-numbers" ref={lineNumbersRef}>
                  {lineNumbers.map(num => ( <div key={num}>{num}</div> ))}
              </div>
              <textarea 
                ref={textAreaRef} 
                value={code} 
                onChange={(e) => setCode(e.target.value)}
                onScroll={handleScroll} 
                spellCheck={false}
              />
          </div>

          <button onClick={handleAnalyze} className="analyze-btn">Analyze Code 🚀</button>

          <div className="logs-panel" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
            <div className="tabs-header">
              <button className={`tab-btn ${activeTab === 'lexical' ? 'active' : ''}`} onClick={() => setActiveTab('lexical')}>1. Lexical</button>
              <button className={`tab-btn ${activeTab === 'syntactic' ? 'active' : ''}`} onClick={() => setActiveTab('syntactic')}>2. Syntactic</button>
              <button className={`tab-btn ${activeTab === 'symbols' ? 'active' : ''}`} onClick={() => setActiveTab('symbols')}>3. Symbols</button>
              <button className={`tab-btn ${activeTab === 'math' ? 'active' : ''}`} onClick={() => setActiveTab('math')}>4. Math</button>
              <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>5. Logs</button>
            </div>

            <div className="tab-content">
              {activeTab === 'lexical' && (
                tokens.length > 0 ? (
                  <table className="data-table">
                    <thead><tr><th>Token Type</th><th>Value</th></tr></thead>
                    <tbody>
                      {tokens.map((t, i) => (
                        <tr key={i}>
                          <td style={{ color: t.type === 'Keyword' ? '#c586c0' : t.type === 'Identifier' ? '#9cdcfe' : t.type === 'Literal' ? '#b5cea8' : '#d4d4d4' }}>{t.type}</td>
                          <td>{t.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <div>No tokens generated yet.</div>
              )}

              {activeTab === 'syntactic' && <div className="json-view">{ast ? JSON.stringify(ast, null, 2) : "No AST generated."}</div>}

              {activeTab === 'symbols' && (
                symbolData.length > 0 ? (
                  <table className="data-table">
                    <thead><tr><th>Type</th><th>Variable</th><th>Line</th></tr></thead>
                    <tbody>
                      {symbolData.map((s, i) => ( <tr key={i}><td>{s.type}</td><td>{s.name}</td><td>{s.line}</td></tr> ))}
                    </tbody>
                  </table>
                ) : <div>No variables detected.</div>
              )}

              {activeTab === 'math' && (
                mathOps.length > 0 ? (
                  <table className="data-table">
                    <thead><tr><th>Line</th><th>Operation</th><th>Status</th></tr></thead>
                    <tbody>
                      {mathOps.map((op, i) => {
  const isZero = op.right == 0 || op.right === "0" || op.right === "0.0";
  // Check for BOTH / and % to match your SymbolicExe logic
  const isUnsafe = (op.op === '/' || op.op === '%') && isZero; 
  
  return (
    <tr key={i}>
      <td>{op.line}</td>
      <td>{op.left} {op.op} {op.right}</td>
      <td style={{color: isUnsafe ? '#f44336' : '#4ec9b0', fontWeight: isUnsafe ? 'bold' : 'normal'}}>
          {isUnsafe ? '⚠️ UNSAFE' : '✅ SAFE'}
      </td>
    </tr>
  );
})}
                    </tbody>
                  </table>
                ) : <div>No math operations detected.</div>
              )}

              {activeTab === 'logs' && consoleOutput.map((line, i) => (
                <div key={i} className={line.includes("Error") ? "log-error" : "log-success"}>{line}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="visualizer-panel">
          <div className="viz-header">
            <h3>Control Flow Graph</h3>
            {gamification && <span className="badge">Rank: <strong>{gamification.rank}</strong></span>}
          </div>
          <div className="canvas-container">
             <Visualizer ast={ast} onNodeHover={handleNodeHover} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;