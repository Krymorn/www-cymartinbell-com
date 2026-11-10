// Shared helpers for the feature modules: downloads, spreadsheet/LaTeX/Markdown writers,
// script loading, small math and text utilities. No AI anywhere.

export const enc = encodeURIComponent;
export const fmt = (n, d = 4) => (n == null || Number.isNaN(+n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d }));
export const round = (x, d = 6) => Math.round(x * 10 ** d) / 10 ** d;
export const sum = (a) => a.reduce((s, x) => s + x, 0);
export const mean = (a) => sum(a) / a.length;
export const nums = (s) => (String(s).match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi) || []).map(Number);
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const loaded = {};
export function loadScript(src, global) {
  if (global && window[global]) return Promise.resolve(window[global]);
  if (!loaded[src]) loaded[src] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src;
    s.onload = () => res(global ? window[global] : true); s.onerror = () => rej(new Error(`Couldn’t load ${src.split('/').pop()}.`));
    document.head.append(s);
  });
  return loaded[src];
}
export const loadXLSX = () => loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX');
export const loadYAML = () => loadScript('https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js', 'jsyaml');

// ---------- downloads ----------
export function download(name, data, mime = 'text/plain') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: `${mime};charset=utf-8` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
// A pod that offers files: files = [{label, name, mime, data | make()}]
export function filesPod(files, title = 'Download', note) {
  return {
    title, note, custom: (el) => {
      const box = document.createElement('div'); box.className = 'btns';
      for (const f of files) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = `⬇ ${f.label}`;
        b.onclick = async () => { try { const d = f.make ? await f.make() : f.data; download(f.name, d, f.mime); } catch (e) { b.textContent = `Couldn’t make it: ${e.message}`; } };
        box.append(b);
      }
      el.append(box);
    },
  };
}

// ---------- table writers ----------
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCSV = (head, rows) => [head, ...rows].filter(Boolean).map(r => r.map(csvCell).join(',')).join('\r\n');
export const toTSV = (head, rows) => [head, ...rows].filter(Boolean).map(r => r.map(x => String(x ?? '').replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
export const texEsc = (s) => String(s ?? '').replace(/\\/g, '\\textbackslash{}').replace(/([&%$#_{}])/g, '\\$1').replace(/~/g, '\\textasciitilde{}').replace(/\^/g, '\\textasciicircum{}');
export function toLatexTable(head, rows, caption = '') {
  const n = Math.max(head ? head.length : 0, ...rows.map(r => r.length));
  const align = Array.from({ length: n }, (_, i) => (rows.every(r => r[i] == null || r[i] === '' || !isNaN(+r[i])) ? 'r' : 'l')).join('');
  const line = (r) => '    ' + Array.from({ length: n }, (_, i) => texEsc(r[i] ?? '')).join(' & ') + ' \\\\';
  return ['\\begin{table}[h]', '  \\centering', `  \\begin{tabular}{${align}}`, '    \\hline', ...(head ? [line(head).replace(/^ {4}/, '    '), '    \\hline'] : []), ...rows.map(line), '    \\hline', '  \\end{tabular}', caption ? `  \\caption{${texEsc(caption)}}` : null, '\\end{table}'].filter(Boolean).join('\n');
}
export function toMarkdownTable(head, rows) {
  const h = head || rows[0].map((_, i) => `Col ${i + 1}`);
  const esc = (x) => String(x ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [`| ${h.map(esc).join(' | ')} |`, `| ${h.map(() => '---').join(' | ')} |`, ...rows.map(r => `| ${h.map((_, i) => esc(r[i])).join(' | ')} |`)].join('\n');
}
export function toHTMLTable(head, rows) {
  const e = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<table>\n${head ? `  <tr>${head.map(x => `<th>${e(x)}</th>`).join('')}</tr>\n` : ''}${rows.map(r => `  <tr>${r.map(x => `<td>${e(x)}</td>`).join('')}</tr>`).join('\n')}\n</table>`;
}
// sheets = [{name, head, rows, formulas?: true}] → .xlsx Blob. Cells starting with "=" become formulas.
export async function toXLSX(sheets) {
  const X = await loadXLSX();
  const wb = X.utils.book_new();
  const used = new Set();
  for (const sh of sheets) {
    const aoa = [sh.head, ...sh.rows].filter(Boolean).map(r => r.map(v => (typeof v === 'string' && v !== '' && !isNaN(+v) && !/^0\d/.test(v) ? +v : v)));
    const ws = X.utils.aoa_to_sheet(aoa);
    for (const addr of Object.keys(ws)) { const c = ws[addr]; if (c && typeof c.v === 'string' && c.v.startsWith('=')) { c.f = c.v.slice(1); delete c.v; c.t = 'n'; } }
    ws['!cols'] = (aoa[0] || []).map((_, i) => ({ wch: Math.min(40, Math.max(8, ...aoa.map(r => String(r[i] ?? '').length + 2))) }));
    let name = String(sh.name || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet';
    while (used.has(name)) name = name.slice(0, 28) + used.size;
    used.add(name);
    X.utils.book_append_sheet(wb, ws, name);
  }
  const out = X.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Standard set of downloads for one table.
export function tableFiles(base, head, rows, sheetName) {
  return [
    { label: 'CSV', name: `${base}.csv`, mime: 'text/csv', make: () => '\ufeff' + toCSV(head, rows) },
    { label: 'Excel', name: `${base}.xlsx`, mime: XLSX_MIME, make: () => toXLSX([{ name: sheetName || base, head, rows }]) },
    { label: 'JSON', name: `${base}.json`, mime: 'application/json', make: () => JSON.stringify(head ? rows.map(r => Object.fromEntries(head.map((k, i) => [k, r[i]]))) : rows, null, 2) },
    { label: 'LaTeX', name: `${base}.tex`, mime: 'application/x-tex', make: () => toLatexTable(head, rows) },
    { label: 'Markdown', name: `${base}.md`, mime: 'text/markdown', make: () => toMarkdownTable(head, rows) },
  ];
}

// Parse a pasted table: CSV, TSV, Markdown, or columns separated by 2+ spaces / semicolons.
export function parseTable(text) {
  let t = text.trim().replace(/\r/g, '');
  if (/^\|.*\|\s*$/m.test(t)) {
    const lines = t.split('\n').filter(l => /\|/.test(l) && !/^\s*\|?\s*:?-{2,}/.test(l));
    const rows = lines.map(l => l.replace(/^\s*\||\|\s*$/g, '').split('|').map(x => x.trim()));
    return { head: rows[0], rows: rows.slice(1) };
  }
  const lines = t.split(/\n|;\s*(?=[^;]*[,\t])/).filter(l => l.trim());
  const sep = lines.every(l => l.includes('\t')) ? '\t' : lines.every(l => l.includes(',')) ? ',' : lines.every(l => /\s{2,}/.test(l)) ? /\s{2,}/ : lines.every(l => l.includes(';')) ? ';' : ',';
  const split = (l) => {
    if (sep !== ',') return l.split(sep).map(x => x.trim());
    const out = []; let cur = '', q = false;
    for (let i = 0; i < l.length; i++) { const c = l[i]; if (c === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (c === ',' && !q) { out.push(cur.trim()); cur = ''; } else cur += c; }
    out.push(cur.trim()); return out;
  };
  const rows = lines.map(split);
  const headLike = rows.length > 1 && rows[0].every(x => isNaN(+x) || x === '') && rows.slice(1).some(r => r.some(x => x !== '' && !isNaN(+x)));
  return headLike || rows.length > 1 ? { head: rows[0], rows: rows.slice(1) } : { head: null, rows };
}

// ---------- tiny stats ----------
export function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
export const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
export function normInv(p) { let lo = -10, hi = 10; for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (normCdf(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
function lgamma(z) { const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z); z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i); const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x); }
function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d; for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c; aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; } return h; }
export function ibeta(x, a, b) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
export const tCdf = (t, df) => { const x = df / (df + t * t); const p = 0.5 * ibeta(x, df / 2, 0.5); return t > 0 ? 1 - p : p; };
export function tInv(p, df) { let lo = -100, hi = 100; for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (tCdf(m, df) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
function gammainc(a, x) { if (x <= 0) return 0; if (x < a + 1) { let sum = 1 / a, del = sum, ap = a; for (let n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; } return sum * Math.exp(-x + a * Math.log(x) - lgamma(a)); } let b = x + 1 - a, c = 1e300, d = 1 / b, h = d; for (let i = 1; i < 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break; } return 1 - Math.exp(-x + a * Math.log(x) - lgamma(a)) * h; }
export const chi2Cdf = (x, k) => gammainc(k / 2, x / 2);
export const fCdf = (f, d1, d2) => ibeta(d1 * f / (d1 * f + d2), d1 / 2, d2 / 2);
export function describe(a) {
  const s = [...a].sort((x, y) => x - y), n = s.length, m = mean(s);
  const q = (p) => { const i = (n - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
  const sd = Math.sqrt(sum(s.map(x => (x - m) ** 2)) / (n - 1 || 1));
  return { n, mean: m, sd, var: sd * sd, min: s[0], max: s[n - 1], q1: q(0.25), med: q(0.5), q3: q(0.75), sorted: s };
}

// ---------- seeded-free random helpers ----------
export const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function shuffle(a) { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
export function secureInt(n) { const u = new Uint32Array(1); crypto.getRandomValues(u); return u[0] % n; }

// Overleaf: open a .tex snippet as a new project (form POST, documented by Overleaf).
export function openInOverleaf(tex) {
  const f = document.createElement('form');
  f.method = 'POST'; f.action = 'https://www.overleaf.com/docs'; f.target = '_blank';
  const i = document.createElement('textarea'); i.name = 'snip'; i.value = tex; f.append(i);
  document.body.append(f); f.submit(); f.remove();
}
export function texFilePod(name, tex, title = 'Use it') {
  return {
    title, custom: (el) => {
      const box = document.createElement('div'); box.className = 'btns';
      const b1 = document.createElement('button'); b1.type = 'button'; b1.className = 'chip'; b1.textContent = `⬇ ${name}`; b1.onclick = () => download(name, tex, 'application/x-tex');
      const b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'chip'; b2.textContent = 'Open in Overleaf'; b2.onclick = () => openInOverleaf(tex);
      const b3 = document.createElement('button'); b3.type = 'button'; b3.className = 'chip'; b3.textContent = 'Copy'; b3.onclick = async () => { try { await navigator.clipboard.writeText(tex); b3.textContent = 'Copied'; } catch (_) {} };
      box.append(b1, b2, b3); el.append(box);
    },
  };
}
