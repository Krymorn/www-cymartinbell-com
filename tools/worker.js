// Runs Pyodide (Python compiled to WebAssembly) + SymPy off the main thread.
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

let py = null;
let handle = null;

const ready = (async () => {
  py = await loadPyodide();
  await py.loadPackage(['sympy']);
  const [src, wp] = await Promise.all(['engine.py', 'wordproblems.py'].map(f => fetch(f, { cache: 'no-cache' }).then(r => r.text())));
  py.runPython(src);
  py.runPython(wp);
  handle = py.globals.get('handle');
  postMessage({ type: 'ready' });
})().catch(err => {
  postMessage({ type: 'failed', error: String(err) });
  throw err;
});

onmessage = async (e) => {
  const { id, req } = e.data;
  try {
    await ready;
    if (req.op === 'python') {
      // Fetch any packages the cell imports (numpy, matplotlib, pandas, scipy, ...).
      await py.loadPackagesFromImports(req.code);
    }
    const out = handle(JSON.stringify(req));
    postMessage({ id, ok: true, out: JSON.parse(out) });
  } catch (err) {
    postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
