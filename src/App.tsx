import React, { useState, useRef } from 'react';
import './App.css'; 
// @ts-ignore
import * as parserModule from './grammar/cppParser.js';
import { SymbolTable } from './analysis/SymbolTable';
import { performTypeCheck } from './analysis/TypeChecker';
import { analyzeDataFlow } from './analysis/DataFlow';
import { checkMathSafety } from './analysis/SymbolicExe';
import { calculateScore, getRank } from './gamification/Score';
import { Visualizer } from './UI/Visualizer';

// --- HELPER 1: Token Generation for Lexical Analysis ---
// This reconstructs the token stream to show Keywork, Identifier, etc.
const extractTokens = (node: any, tokens: any[] = []) => {
  if (!node) return tokens;

  // 1. Program / Main Function Structure
  if (node.type === 'Program') {
    // Manually add the "int main() {" wrapper tokens
    tokens.push({ type: 'Keyword', value: 'int' });
    tokens.push({ type: 'Identifier', value: 'main' });
    tokens.push({ type: 'Separator', value: '(' });
    tokens.push({ type: 'Separator', value: ')' });
    tokens.push({ type: 'Separator', value: '{' });
    
    // Process Body
    if (node.body) {
      (Array.isArray(node.body) ? node.body : [node.body]).forEach((child: any) => extractTokens(child, tokens));
    }

    tokens.push({ type: 'Separator', value: '}' });
  }

  // 2. Variable Declaration (int x = 10;)
  else if (node.type === 'VariableDecl') {
    tokens.push({ type: 'Keyword', value: node.varType }); // "int"
    tokens.push({ type: 'Identifier', value: node.name }); // "x"
    if (node.value) {
      tokens.push({ type: 'Operator', value: '=' });
      extractTokens(node.value, tokens);
    }
    tokens.push({ type: 'Separator', value: ';' });
  }

  // 3. Assignment (x = x + 1;)
  else if (node.type === 'Assignment') {
    tokens.push({ type: 'Identifier', value: node.name });
    tokens.push({ type: 'Operator', value: '=' });
    extractTokens(node.value, tokens);
    tokens.push({ type: 'Separator', value: ';' });
  }

  // 4. Binary Expressions (x + 1)
  else if (node.type === 'BinaryExpr') {
    extractTokens(node.left, tokens);
    tokens.push({ type: 'Operator', value: node.operator });
    extractTokens(node.right, tokens);
  }

  // 5. Loops (while(x > 0) { ... })
  else if (node.type === 'WhileStatement') {
    tokens.push({ type: 'Keyword', value: 'while' });
    tokens.push({ type: 'Separator', value: '(' });
    extractTokens(node.condition, tokens);
    tokens.push({ type: 'Separator', value: ')' });
    tokens.push({ type: 'Separator', value: '{' });
    if (node.body) {
      (Array.isArray(node.body) ? node.body : [node.body]).forEach((child: any) => extractTokens(child, tokens));
    }
    tokens.push({ type: 'Separator', value: '}' });
  }

  // 6. Return Statement
  else if (node.type === 'ReturnStatement') {
    tokens.push({ type: 'Keyword', value: 'return' });
    extractTokens(node.value, tokens);
    tokens.push({ type: 'Separator', value: ';' });
  }

  // 7. Literals & Identifiers
  else if (node.type === 'Integer') tokens.push({ type: 'Literal', value: node.value.toString() });
  else if (node.type === 'Float') tokens.push({ type: 'Literal', value: node.value.toString() }); // <--- NEW LINE ADDED
  else if (node.type === 'String') tokens.push({ type: 'Literal', value: `"${node.value}"` });
  else if (node.type === 'Identifier') tokens.push({ type: 'Identifier', value: node.name });

  return tokens;
};

// --- HELPER 2: Extract Math Operations ---
const extractMathOps = (node: any, list: any[] = []) => {
  if (!node) return list;
  if (node.type === 'BinaryExpr') {
    list.push({ 
      op: node.operator, 
      left: node.left.type === 'Identifier' ? node.left.name : (node.left.value ?? '?'), 
      right: node.right.type === 'Identifier' ? node.right.name : (node.right.value ?? '?'),
      line: node.location?.start.line 
    });
  }
  if (node.body) {
    (Array.isArray(node.body) ? node.body : [node.body]).forEach((child: any) => extractMathOps(child, list));
  }
  if (node.left) extractMathOps(node.left, list);
  if (node.right) extractMathOps(node.right, list);
  if (node.condition) extractMathOps(node.condition, list);
  if (node.value) extractMathOps(node.value, list);
  return list;
};

// --- HELPER 3: Extract Variables ---
const extractVariables = (node: any, list: any[] = []) => {
  if (!node) return list;
  if (node.type === 'VariableDecl') {
    list.push({ type: node.varType, name: node.name, line: node.location?.start.line });
  }
  if (node.body) {
    (Array.isArray(node.body) ? node.body : [node.body]).forEach((child: any) => extractVariables(child, list));
  }
  return list;
};

function App() {
  const [code, setCode] = useState(`int main() {
  int x = 10;
  int y = 5;
  int result = 0;

  while(x > 0) {
    result = x / y; // Math Check
    x = x - 1;
  }
  return 0;
}`);
  
  const [ast, setAst] = useState<any>(null);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [gamification, setGamification] = useState<{score: number, rank: string} | null>(null);
  
  // UPDATED: Added 'lexical' tab
  const [activeTab, setActiveTab] = useState<'lexical' | 'syntactic' | 'symbols' | 'math' | 'logs'>('lexical');
  const [tokens, setTokens] = useState<any[]>([]);
  const [mathOps, setMathOps] = useState<any[]>([]);
  const [symbolData, setSymbolData] = useState<any[]>([]);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const handleAnalyze = () => {
    setConsoleOutput([]); 
    const logs: string[] = [];
    const log = (msg: string) => logs.push(msg);

    // --- NEW DEBUG BLOCK ---
    console.log("Parser Module Loaded:", parserModule);
    
    let parseFunction;
    // Try to find the 'parse' function in the imported module
    if (parserModule && typeof parserModule.parse === 'function') {
      parseFunction = parserModule.parse;
    } else if (parserModule && (parserModule as any).default && typeof (parserModule as any).default.parse === 'function') {
      parseFunction = (parserModule as any).default.parse;
    }

    if (!parseFunction) {
       alert("CRITICAL ERROR: Parser not found!\nThe import failed. Check console for 'parserModule'.");
       log("❌ Critical Error: Parser import failed.");
       setConsoleOutput(logs);
       return;
    }

    try {
      log("1. Starting Lexical & Syntactic Analysis...");
      const parsedAst = parseFunction(code);
      log("✅ Parsing Successful! AST Generated.");

      log("2. Running Semantic Safety Checks...");
      const symbols = new SymbolTable();
      performTypeCheck(parsedAst, symbols);
      log("✅ Type Safety: Passed.");

      analyzeDataFlow(parsedAst);
      log("✅ Data Flow: No uninitialized variables found.");

      checkMathSafety(parsedAst); 
      log("✅ Mathematical Safety: No division by zero detected.");

      const score = calculateScore(parsedAst);
      const rank = getRank(score);
      setGamification({ score, rank });
      log(`🏆 Gamification: Complexity Score ${score} (Rank ${rank})`);

      // UPDATE STATE FOR TABS
      setAst(parsedAst);
      
      // 1. Generate Lexical Tokens
      const lexTokens: any[] = [];
      extractTokens(parsedAst, lexTokens);
      setTokens(lexTokens);

      // 2. Generate other data
      setMathOps(extractMathOps(parsedAst));
      setSymbolData(extractVariables(parsedAst));

      // Auto-switch to Lexical tab
      setActiveTab('lexical');

      log("3. Generating Control Flow Graph...");

    } catch (error: any) {
      if (error.location) {
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
    const lineHeight = 20; 
    const scrollPos = (location.start.line - 1) * lineHeight;
    textAreaRef.current.scrollTop = scrollPos - 40; 
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Code Sense 🎓 (v2)</h1>
        <p>C++ Static Analysis & Visualization Tool</p>
      </header>

      <div className="main-content">
        {/* LEFT PANEL */}
        <div className="editor-panel">
          <h3>Source Code Input</h3>
          <textarea 
            ref={textAreaRef} 
            value={code} 
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
          />
          <button onClick={handleAnalyze} className="analyze-btn">Analyze Code 🚀</button>

          {/* DEEP DIVE PANEL */}
          <div className="logs-panel" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
            
            {/* UPDATED TAB ORDER */}
            <div className="tabs-header">
              <button className={`tab-btn ${activeTab === 'lexical' ? 'active' : ''}`} onClick={() => setActiveTab('lexical')}>1. Lexical</button>
              <button className={`tab-btn ${activeTab === 'syntactic' ? 'active' : ''}`} onClick={() => setActiveTab('syntactic')}>2. Syntactic</button>
              <button className={`tab-btn ${activeTab === 'symbols' ? 'active' : ''}`} onClick={() => setActiveTab('symbols')}>3. Symbols</button>
              <button className={`tab-btn ${activeTab === 'math' ? 'active' : ''}`} onClick={() => setActiveTab('math')}>4. Math</button>
              <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>5. Logs</button>
            </div>

            {/* TAB CONTENT */}
            <div className="tab-content">
              
              {/* TAB 1: LEXICAL ANALYSIS (Token Table) */}
              {activeTab === 'lexical' && (
                tokens.length > 0 ? (
                  <table className="data-table">
                    <thead><tr><th>Token Type</th><th>Value</th></tr></thead>
                    <tbody>
                      {tokens.map((t, i) => (
                        <tr key={i}>
                          <td style={{ 
                            color: t.type === 'Keyword' ? '#c586c0' : 
                                   t.type === 'Identifier' ? '#9cdcfe' : 
                                   t.type === 'Literal' ? '#b5cea8' : 
                                   t.type === 'Operator' ? '#d4d4d4' : '#808080'
                          }}>{t.type}</td>
                          <td>{t.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <div>No tokens generated yet.</div>
              )}

              {/* TAB 2: SYNTACTIC ANALYSIS (AST JSON) */}
              {activeTab === 'syntactic' && (
                <div className="json-view">
                  {ast ? JSON.stringify(ast, null, 2) : "No AST generated."}
                </div>
              )}

              {/* TAB 3: Symbol Table */}
              {activeTab === 'symbols' && (
                symbolData.length > 0 ? (
                  <table className="data-table">
                    <thead><tr><th>Type</th><th>Variable</th><th>Line</th></tr></thead>
                    <tbody>
                      {symbolData.map((s, i) => (
                        <tr key={i}><td>{s.type}</td><td>{s.name}</td><td>{s.line}</td></tr>
                      ))}
                    </tbody>
                  </table>
                ) : <div>No variables detected.</div>
              )}

              {/* TAB 4: Math Safety */}
              {activeTab === 'math' && (
                mathOps.length > 0 ? (
                  <table className="data-table">
                    <thead><tr><th>Line</th><th>Operation</th><th>Status</th></tr></thead>
                    <tbody>
                      {mathOps.map((op, i) => (
                        <tr key={i}>
                          <td>{op.line}</td>
                          <td>{op.left} {op.op} {op.right}</td>
                          <td style={{color: op.right == 0 && op.op === '/' ? 'red' : '#4ec9b0'}}>
                             {op.right == 0 && op.op === '/' ? '⚠️ UNSAFE' : '✅ SAFE'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <div>No math operations detected.</div>
              )}

              {/* TAB 5: System Logs */}
              {activeTab === 'logs' && consoleOutput.map((line, i) => (
                <div key={i} className={line.includes("Error") ? "log-error" : "log-success"}>{line}</div>
              ))}

            </div>

          </div>
        </div>

        {/* RIGHT PANEL */}
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