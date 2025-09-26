import * as Babel from '@babel/standalone';

export interface ExecutionLogEntry {
  line: number;
  variables: Record<string, any>;
  timestamp: number;
}

export interface RunResult {
  instrumented: string;
  log: ExecutionLogEntry[];
  error?: string;
}

// Babel plugin to instrument code; uses Babel Standalone API types
function instrumentationPlugin(babel: any) {
  const t = babel.types;
  let declaredVars = new Set<string>();

  return {
    visitor: {
      Program: {
        enter() {
          declaredVars = new Set();
        },
      },

      VariableDeclarator(path: any) {
        if (path.node.id.type === 'Identifier') {
          const varName = path.node.id.name;
          declaredVars.add(varName);

          const lineNumber = path.node.loc ? path.node.loc.start.line : 0;
          const parentPath = path.findParent((p: any) => p.isStatement());

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
                  t.numericLiteral(lineNumber),
                ]
              )
            );

            parentPath.insertAfter(trackCall);
          }
        }
      },

      Statement(path: any) {
        if (path.isBlockStatement() || path.isExpressionStatement()) return;

        const lineNumber = path.node.loc ? path.node.loc.start.line : 0;

        const varProperties = Array.from(declaredVars).map((varName) =>
          t.objectProperty(
            t.stringLiteral(varName),
            t.conditionalExpression(
              t.binaryExpression(
                '!==',
                t.unaryExpression('typeof', t.identifier(varName)),
                t.stringLiteral('undefined')
              ),
              t.identifier(varName),
              t.stringLiteral('undefined')
            )
          )
        );

        const trackCall = t.expressionStatement(
          t.callExpression(
            t.memberExpression(t.identifier('__debugTracker'), t.identifier('trackLine')),
            [t.numericLiteral(lineNumber), t.objectExpression(varProperties)]
          )
        );

        path.insertBefore(trackCall);
      },
    },
  };
}

export function instrumentAndRun(userCode: string): RunResult {
  let executionLog: ExecutionLogEntry[] = [];

  const debugTracker = {
    trackLine: (line: number, vars: Record<string, any>) => {
      executionLog.push({ line, variables: { ...vars }, timestamp: Date.now() });
      // Mirror console output for visibility in devtools
      // eslint-disable-next-line no-console
      console.log(`Line ${line}:`, vars);
    },
    trackVar: (varName: string, value: any, line: number) => {
      // eslint-disable-next-line no-console
      console.log(`Var ${varName} @${line} =`, value);
    },
  } as const;

  (window as any).__debugTracker = debugTracker;

  try {
    // Register preset 'typescript' is built-in to Babel Standalone
    const result = Babel.transform(userCode, {
      filename: 'user-code.ts',
      plugins: [instrumentationPlugin],
      presets: ['typescript'],
      babelrc: false,
      configFile: false,
    });

    if (!result || !result.code) {
      return { instrumented: '', log: executionLog, error: 'Failed to transform code' };
    }

    // eslint-disable-next-line no-eval
    eval(result.code);

    return { instrumented: result.code, log: executionLog };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { instrumented: '', log: executionLog, error: msg };
  }
}
