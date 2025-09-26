// TypeScript version of the Babel code instrumentation demo
import * as babel from '@babel/core';
const t = require('@babel/types');

// Type definitions
interface ExecutionLogEntry {
  line: number;
  variables: Record<string, any>;
  timestamp: number;
}

interface DebugTracker {
  trackLine: (line: number, vars: Record<string, any>) => void;
  trackVar: (varName: string, value: any, line: number) => void;
}

// Global state tracker
let executionLog: ExecutionLogEntry[] = [];
let currentLine = 0;

// Debug logger that captures state
const debugTracker: DebugTracker = {
  trackLine: (line: number, vars: Record<string, any>) => {
    executionLog.push({
      line: line,
      variables: { ...vars },
      timestamp: Date.now()
    });
    console.log(`📍 Line ${line}:`, vars);
  },

  trackVar: (varName: string, value: any, line: number) => {
    console.log(`🔄 Line ${line}: ${varName} = ${value}`);
  }
};

// Set global reference for eval'd code
(global as any).__debugTracker = debugTracker;

// Babel plugin to instrument code
const instrumentationPlugin = (): babel.PluginObj => {
  let declaredVars = new Set<string>();

  return {
    visitor: {
      // Track variable declarations and add individual tracking
      VariableDeclarator(path) {
        if (path.node.id.type === 'Identifier') {
          const varName = path.node.id.name;
          declaredVars.add(varName);

          const lineNumber = path.node.loc ? path.node.loc.start.line : ++currentLine;
          const parentPath = path.findParent((p) => p.isStatement());

          if (parentPath) {
            const trackCall = t.expressionStatement(
              t.callExpression(
                t.memberExpression(
                  t.identifier('__debugTracker'),
                  t.identifier('trackVar')
                ),
                [
                  t.stringLiteral(varName),
                  t.identifier(varName),
                  t.numericLiteral(lineNumber)
                ]
              )
            );

            parentPath.insertAfter(trackCall);
          }
        }
      },

      // Intercept all statements
      Statement(path) {
        if (path.isBlockStatement() || path.isExpressionStatement()) return;

        const lineNumber = path.node.loc ? path.node.loc.start.line : ++currentLine;

        // Create object properties for all declared variables
        const varProperties = Array.from(declaredVars).map(varName =>
          t.objectProperty(
            t.stringLiteral(varName),
            t.conditionalExpression(
              t.binaryExpression('!==', t.unaryExpression('typeof', t.identifier(varName)), t.stringLiteral('undefined')),
              t.identifier(varName),
              t.stringLiteral('undefined')
            )
          )
        );

        // Create tracking call with actual variable values
        const trackCall = t.expressionStatement(
          t.callExpression(
            t.memberExpression(
              t.identifier('__debugTracker'),
              t.identifier('trackLine')
            ),
            [
              t.numericLiteral(lineNumber),
              t.objectExpression(varProperties)
            ]
          )
        );

        path.insertBefore(trackCall);
      }
    }
  };
};

// Function to instrument and execute code
function runCodeWithTracking(userCode: string): void {
  console.log('🚀 Original Code:');
  console.log(userCode);
  console.log('\n📝 Execution Trace:');

  // Reset state
  executionLog = [];
  currentLine = 0;

  try {
    // Transform code with instrumentation
    const result = babel.transformSync(userCode, {
      filename: 'user-code.ts',
      plugins: [instrumentationPlugin],
      presets: ['@babel/preset-typescript'] // Support TypeScript
    });

    if (!result || !result.code) {
      throw new Error('Failed to transform code');
    }

    console.log('\n🔧 Instrumented Code:');
    console.log(result.code);
    console.log('\n▶️  Running...\n');

    // Execute instrumented code
    eval(result.code);

    console.log('\n📊 Final Execution Log:');
    console.log(executionLog);

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  }
}

// Demo code samples
console.log('='.repeat(60));
console.log('🧪 BABEL CODE INSTRUMENTATION DEMO');
console.log('='.repeat(60));

// Test 1: Simple JavaScript
console.log('\n🔬 Test 1: Simple Variables');
runCodeWithTracking(`
let x = 5;
let y = 10;
let sum = x + y;
console.log('Sum:', sum);
`);

console.log('\n' + '='.repeat(60));

// Test 2: TypeScript with types
console.log('\n🔬 Test 2: TypeScript Code');
runCodeWithTracking(`
interface User {
  name: string;
  age: number;
}

const user: User = { name: "Alice", age: 25 };
let greeting: string = "Hello " + user.name;
console.log(greeting);
`);

console.log('\n' + '='.repeat(60));

// Test 3: Functions and control flow
console.log('\n🔬 Test 3: Functions and Control Flow');
runCodeWithTracking(`
function calculateTotal(price: number, tax: number): number {
  let total = price + (price * tax);
  return total;
}

let price = 100;
let taxRate = 0.1;
let finalPrice = calculateTotal(price, taxRate);

if (finalPrice > 100) {
  console.log('Expensive item:', finalPrice);
} else {
  console.log('Affordable item:', finalPrice);
}
`);