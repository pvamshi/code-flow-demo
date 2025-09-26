import { useEffect, useMemo, useState } from 'react';
import { instrumentAndRun, RunResult } from './instrumentation';

const SAMPLE = `
interface User { name: string; age: number }
const user: User = { name: 'Alice', age: 25 };
let x = 5;
let y = 10;
let sum = x + y;
console.log('Sum:', sum, user.name);
`;

export default function App() {
  const [code, setCode] = useState<string>(SAMPLE);
  const [result, setResult] = useState<RunResult | null>(null);
  const [autoRun, setAutoRun] = useState<boolean>(true);

  const run = () => {
    const res = instrumentAndRun(code);
    setResult(res);
  };

  useEffect(() => {
    if (!autoRun) return;
    const id = setTimeout(() => run(), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, autoRun]);

  return (
    <div>
      <h1>Code Flow (Web)</h1>
      <div style={{ marginBottom: 8 }}>
        <span style={{ marginRight: 12 }}>Legend: <span title="Has state">●</span> has state, <span title="No state">○</span> no state. Hover lines to inspect values.</span>
        <label style={{ marginLeft: 12 }}>
          <input type="checkbox" checked={autoRun} onChange={(e) => setAutoRun(e.target.checked)} /> Auto-run
        </label>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={20}
            cols={60}
          />
          <div>
            <button onClick={run}>Run</button>
          </div>
        </div>
        <CodeView code={code} runResult={result} />
      </div>
      {result?.error && (
        <div>
          <h3>Error</h3>
          <pre>{result.error}</pre>
        </div>
      )}
    </div>
  );
}

function CodeView({ code, runResult }: { code: string; runResult: RunResult | null }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const lines = useMemo(() => code.replace(/\n$/, '').split('\n'), [code]);
  const lineState = useMemo(() => {
    const map = new Map<number, Record<string, any>>();
    if (!runResult) return map;
    for (const entry of runResult.log) {
      map.set(entry.line, entry.variables);
    }
    return map;
  }, [runResult]);

  return (
    <div>
      <h3>Code</h3>
      <pre style={{ margin: 0 }}>
        {lines.map((text, idx) => {
          const lineNo = idx + 1;
          const vars = lineState.get(lineNo);
          const isHovered = hovered === lineNo;
          return (
            <div
              key={lineNo}
              onMouseEnter={() => setHovered(lineNo)}
              onMouseLeave={() => setHovered(null)}
              style={{ display: 'flex', opacity: vars ? 1 : 0.5, position: 'relative' }}
            >
              <span style={{ width: 18, textAlign: 'center' }}>{vars ? '●' : '○'}</span>
              <span style={{ width: 40 }}>{lineNo.toString().padStart(3, ' ')}</span>
              <code style={{ whiteSpace: 'pre-wrap' }}>{text || ' '}</code>
              {isHovered && vars && (
                <div
                  style={{
                    position: 'absolute',
                    left: '100%',
                    top: 0,
                    marginLeft: 8,
                    padding: 4,
                    border: '1px solid #ccc',
                    background: '#fff',
                    zIndex: 1,
                    maxWidth: 360,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  <pre style={{ margin: 0 }}>{JSON.stringify(vars, null, 2)}</pre>
                </div>
              )}
            </div>
          );
        })}
      </pre>
    </div>
  );
}
