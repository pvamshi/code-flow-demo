// package.json - Run: npm init -y && npm install @babel/core @babel/preset-typescript
const babel = require('@babel/core');
const t = require('@babel/types');

// Global state tracker
let executionLog = [];
let currentLine = 0;

// Debug logger that captures state
global.__debugTracker = {
  trackLine: (line, vars) => {
    executionLog.push({
      line: line,
      variables: { ...vars },
      timestamp: Date.now()
    });
    console.log(`📍 Line ${line}:`, vars);
  },

  trackVar: (varName, value, line) => {
    console.log(`🔄 Line ${line}: ${varName} = ${value}`);
  }
};

// Babel plugin to instrument code
const instrumentationPlugin = () => ({
  visitor: {
    // Intercept all statements
    Statement(path) {
      if (path.isBlockStatement() || path.isExpressionStatement()) return;

      const lineNumber = path.node.loc ? path.node.loc.start.line : ++currentLine;

      // Create tracking call: __debugTracker.trackLine(lineNum, {vars})
      const trackCall = t.expressionStatement(
        t.callExpression(
          t.memberExpression(
            t.identifier('__debugTracker'),
            t.identifier('trackLine')
          ),
          [
            t.numericLiteral(lineNumber),
            t.objectExpression([]) // We'll add variables here in real implementation
          ]
        )
      );

      path.insertBefore(trackCall);
    },

    // Track variable declarations
    VariableDeclarator(path) {
      if (path.node.id.type === 'Identifier') {
        const varName = path.node.id.name;
        const lineNumber = path.node.loc ? path.node.loc.start.line : ++currentLine;

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

        path.insertAfter(trackCall);
      }
    }
  }
});

// Function to instrument and execute code
function runCodeWithTracking(userCode) {
  console.log('🚀 Original Code:');
  console.log(userCode);
  console.log('\n📝 Execution Trace:');

  // Reset state
  executionLog = [];
  currentLine = 0;

  try {
    // Transform code with instrumentation
    const result = babel.transformSync(userCode, {
      plugins: [instrumentationPlugin],
      presets: ['@babel/preset-typescript'] // Support TypeScript
    });

    console.log('\n🔧 Instrumented Code:');
    console.log(result.code);
    console.log('\n▶️  Running...\n');

    // Execute instrumented code
    eval(result.code);

    console.log('\n📊 Final Execution Log:');
    console.log(executionLog);

  } catch (error) {
    console.error('❌ Error:', error.message);
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
function calculateTotal(price, tax) {
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
