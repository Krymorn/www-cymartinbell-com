// /tools — type anything, get an answer. No AI: rules route each query to
// math engines running in the browser or to public data sources.
import * as S from './sources.js';
import * as S2 from './sources2.js';
import * as F from './files.js';
import { EXTRA_RULES } from './extras.js';
import { MORE_RULES, cleanTopic, placeAlias } from './more.js';
import { correct as spellCorrect } from './spell.js';

const $ = (s, el = document) => el.querySelector(s);
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const enc = encodeURIComponent;
const fmt = (n, d = 2) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
const money = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };

const feed = $('#feed');
const input = $('#q');
const form = $('#ask');
const statusEl = $('#engine-status');

// ============================================================
// Symbolic engine (Python + SymPy in a Web Worker)
// ============================================================
const Engine = {
  w: null, ready: false, seq: 0, pend: new Map(),
  start() {
    this.ready = false;
    setStatus('loading');
    this.w = new Worker('worker.js');
    this.w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'ready') { this.ready = true; setStatus('ready'); return; }
      if (m.type === 'failed') { setStatus('failed'); return; }
      const p = this.pend.get(m.id);
      if (!p) return;
      clearTimeout(p.t); this.pend.delete(m.id);
      m.ok ? p.res(m.out) : p.rej(new Error(m.error));
    };
    this.w.onerror = () => setStatus('failed');
  },
  call(req, ms = 45000) {
    return new Promise((res, rej) => {
      const id = ++this.seq;
      const t = setTimeout(() => {
        this.pend.delete(id);
        rej(new Error('That took too long, so I stopped it. Try a simpler form, or narrow the range.'));
        this.restart();
      }, ms + (this.ready ? 0 : 90000));
      this.pend.set(id, { res, rej, t });
      this.w.postMessage({ id, req });
    });
  },
  restart() {
    this.w.terminate();
    for (const [, p] of this.pend) { clearTimeout(p.t); p.rej(new Error('Engine restarted.')); }
    this.pend.clear();
    this.start();
  },
};

function setStatus(s) {
  statusEl.dataset.state = s;
  statusEl.textContent = { loading: 'Math engine loading…', ready: 'Math engine ready', failed: 'Math engine unavailable' }[s];
}

async function runEngine(ctx, req, label) {
  if (label) ctx.label(label);
  const wait = Engine.ready ? null : ctx.add({ title: 'Working', text: 'Loading the symbolic math engine. The first time takes about 10 seconds; after that it’s instant.', loading: true });
  try {
    const out = await Engine.call(req);
    if (wait) wait.remove();
    if (!out.ok) throw new Error(friendlyEngineError(out.error));
    if (out.input) ctx.inputTex(out.input);
    for (const p of out.pods) ctx.add(p);
    return true;
  } catch (e) {
    if (wait) wait.remove();
    throw e;
  }
}

function friendlyEngineError(msg) {
  if (/SyntaxError|TokenError|could not parse/i.test(msg)) return 'I couldn’t read that as math. Check the brackets and operators, e.g. 2*x^2 + 3x - 1.';
  if (/NotImplementedError/i.test(msg)) return 'SymPy can’t solve this one in closed form. Try plotting it to find numeric answers.';
  return msg;
}

// ============================================================
// math.js: instant numeric math, units, variables
// ============================================================
const scope = {};
const MATH_WORDS = new Set(('sin cos tan sec csc cot asin acos atan atan2 arcsin arccos arctan sinh cosh tanh asinh acosh atanh sqrt cbrt exp log ln log10 log2 abs floor ceil round fix sign ' +
  'pi e i inf infinity phi tau to in mod deg rad factorial gamma nthroot pow hypot max min mean median mode std variance sum prod gcd lcm det inv transpose eigs trace cross dot norm ' +
  'combinations permutations random randomInt isPrime nCr nPr re im conj arg and or not xor true false theta alpha beta gamma delta lambda mu sigma omega').split(' '));
const isUnitWord = (w) => { try { return math.Unit.isValuelessUnit(w); } catch (_) { return false; } };

function mathy(q) {
  if (!/[\d)(\]]|pi|sqrt|sin|cos|tan|log|ln|exp|\^/.test(q)) return false;
  const words = q.match(/[A-Za-z_]+/g) || [];
  return words.every(w => w.length === 1 || MATH_WORDS.has(w) || MATH_WORDS.has(w.toLowerCase()) || isUnitWord(w) || w in scope);
}

const UNIT_GROUPS = [
  ['m', 'km', 'cm', 'mm', 'mi', 'yd', 'ft', 'in', 'nmi', 'lightyear'], ['kg', 'g', 'mg', 'lb', 'oz', 'ton', 'tonne'], ['s', 'min', 'h', 'day', 'week', 'year'],
  ['degC', 'degF', 'K'], ['m/s', 'km/h', 'mph', 'knot', 'ft/s'], ['L', 'mL', 'gal', 'qt', 'cup', 'floz', 'tbsp', 'tsp', 'm^3'], ['m^2', 'km^2', 'ft^2', 'acre', 'hectare', 'mi^2'],
  ['J', 'kJ', 'cal', 'kcal', 'Wh', 'kWh', 'BTU', 'eV'], ['W', 'kW', 'hp'], ['Pa', 'kPa', 'bar', 'atm', 'psi', 'mmHg'], ['b', 'B', 'kB', 'MB', 'GB', 'TB', 'KiB', 'MiB', 'GiB'], ['N', 'lbf', 'kN'],
];

function isMathResult(r) {
  return typeof r === 'number' || (r && (r.isBigNumber || r.isComplex || r.isFraction || r.isMatrix || r.isUnit || r.isResultSet)) || Array.isArray(r) || typeof r === 'function' || typeof r === 'boolean';
}

async function tryMath(ctx, q) {
  const assign = /^\s*([A-Za-z_]\w*)\s*(\(([^)]*)\))?\s*=(?!=)/.exec(q);
  let r, err = null;
  try { r = math.evaluate(q.replace(/\*\*/g, '^'), scope); } catch (e) { err = e; }
  if (!err && isMathResult(r)) {
    ctx.label('Math');
    ctx.input(q);
    if (typeof r === 'function') { ctx.add({ title: 'Defined', text: `${assign ? assign[1] : 'f'}(${assign && assign[3] || ''}) is ready to use, e.g. ${assign ? assign[1] : 'f'}(2)` }); renderVars(); return true; }
    if (assign) { scope.ans = r; ctx.add({ title: 'Stored', big: true, text: `${assign[1]} = ${math.format(r, { precision: 14 })}`, note: 'Variables carry over to later queries. Clear them with the × next to the variable list.' }); renderVars(); return true; }
    if (r && r.isResultSet) { ctx.add({ title: 'Results', table: r.entries.map((x, i) => [`#${i + 1}`, math.format(x, { precision: 14 })]) }); return true; }
    scope.ans = r;
    if (r && r.isUnit) { unitPods(ctx, r); return true; }
    const quick = ctx.add({ title: 'Result', big: true, text: math.format(r, { precision: 14 }) });
    // Ask the symbolic engine for the exact form and number facts.
    const usesVars = (q.match(/[A-Za-z_]\w*/g) || []).some(w => w in scope);
    if (!assign && !usesVars && !/[A-Za-z]{2,}\s*\(/.test(q.replace(/\b(sqrt|sin|cos|tan|log|ln|exp|abs|factorial|asin|acos|atan|log10|log2|cbrt|sinh|cosh|tanh|floor|ceil|gcd|lcm)\b/g, ''))) {
      try {
        const out = await Engine.call({ op: 'auto', expr: q });
        if (out.ok && out.pods.length) { quick.remove(); out.pods.forEach(p => ctx.add(p)); }
      } catch (_) { /* keep the quick answer */ }
    }
    return true;
  }
  if (err && /Undefined symbol|Unexpected|Undefined function|Unit .* not found|Parenthesis/i.test(err.message)) {
    await runEngine(ctx, { op: 'auto', expr: q }, 'Math');
    return true;
  }
  return false;
}

function unitPods(ctx, r) {
  ctx.label('Units');
  ctx.add({ title: 'Result', big: true, text: math.format(r, { precision: 10 }) });
  const rows = [];
  for (const g of UNIT_GROUPS) {
    let base;
    try { base = math.unit(1, g[0]); } catch (_) { continue; }
    if (!r.equalBase(base)) continue;
    for (const u of g) {
      try { const c = r.to(u); rows.push([u, math.format(c.toNumber(u), { precision: 8 })]); } catch (_) {}
    }
  }
  if (rows.length) ctx.add({ title: 'Same amount in other units', table: rows });
}

function renderVars() {
  const box = $('#vars');
  const names = Object.keys(scope).filter(k => k !== 'ans');
  box.replaceChildren();
  box.hidden = !names.length;
  if (!names.length) return;
  box.append(h('span', 'vars-label', 'Variables:'));
  for (const n of names) {
    const v = scope[n];
    box.append(h('code', 'var', typeof v === 'function' ? `${n}(…)` : `${n} = ${math.format(v, { precision: 6 })}`));
  }
  const x = h('button', 'vars-clear', '×');
  x.title = 'Clear variables';
  x.onclick = () => { for (const k of Object.keys(scope)) delete scope[k]; renderVars(); };
  box.append(x);
}

// ============================================================
// Everyday tools computed right here
// ============================================================
function stats(ctx, nums) {
  ctx.label('Statistics');
  ctx.input(`${nums.length} values`);
  const s = [...nums].sort((a, b) => a - b);
  const q = (p) => math.quantileSeq(s, p);
  const mode = math.mode(nums);
  const rows = [['Count', nums.length], ['Sum', math.sum(nums)], ['Mean', math.mean(nums)], ['Median', math.median(nums)], ['Mode', mode.length === nums.length ? 'none' : mode.join(', ')],
    ['Min', s[0]], ['Max', s[s.length - 1]], ['Range', s[s.length - 1] - s[0]], ['Q1 / Q3', `${fmt(q(0.25), 6)} / ${fmt(q(0.75), 6)}`], ['IQR', q(0.75) - q(0.25)]];
  if (nums.length > 1) rows.push(['Std. deviation (sample)', math.std(nums)], ['Std. deviation (population)', math.std(nums, 'uncorrected')], ['Variance (sample)', math.variance(nums)], ['Std. error of mean', math.std(nums) / Math.sqrt(nums.length)]);
  ctx.add({ title: 'Summary', table: rows.map(([k, v]) => [k, typeof v === 'number' ? fmt(v, 8) : String(v)]) });
  ctx.add({ title: 'Distribution', plot: { kind: 'stats', values: nums } });
}

function baseConvert(ctx, raw, target, baseN) {
  ctx.label('Number bases');
  let n;
  const t = raw.trim().toLowerCase();
  try {
    if (/^-?0x[0-9a-f]+$/.test(t)) n = BigInt(t);
    else if (/^-?0b[01]+$/.test(t)) n = BigInt(t);
    else if (/^-?0o[0-7]+$/.test(t)) n = BigInt(t);
    else if (/^-?\d+$/.test(t)) n = BigInt(t);
    else if (/^[mdclxvi]+$/i.test(t)) n = BigInt(fromRoman(t));
    else { n = BigInt(Math.round(math.evaluate(t))); }
  } catch (_) { throw new Error('I can only convert whole numbers between bases.'); }
  ctx.input(`${raw} → ${target}`);
  const toR = (x) => (x > 0n && x < 4000n ? toRoman(Number(x)) : '—');
  const b = { binary: 2, bin: 2, hex: 16, hexadecimal: 16, octal: 8, oct: 8, decimal: 10, dec: 10 }[target.toLowerCase()] || (baseN ? +baseN : null);
  const main = /roman/i.test(target) ? toR(n) : b ? (b === 16 ? '0x' : b === 2 ? '0b' : b === 8 ? '0o' : '') + n.toString(b).toUpperCase() : n.toString();
  ctx.add({ title: 'Result', big: true, text: main });
  ctx.add({ title: 'All bases', table: [['Decimal', n.toString()], ['Binary', n.toString(2)], ['Octal', n.toString(8)], ['Hexadecimal', n.toString(16).toUpperCase()], ['Base 36', n.toString(36)], ['Roman numerals', toR(n)], ['Bits needed', String(n.toString(2).replace('-', '').length)]] });
}
function toRoman(n) { const v = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let o = ''; for (const [a, s] of v) while (n >= a) { o += s; n -= a; } return o; }
function fromRoman(s) { const m = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 }; let t = 0; s = s.toLowerCase(); for (let i = 0; i < s.length; i++) { const a = m[s[i]], b = m[s[i + 1]] || 0; t += a < b ? -a : a; } return t; }

// ---- dates ----
const DAY = 864e5;
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function nthWeekday(year, month, weekday, n) { const d = new Date(year, month, 1); const add = (weekday - d.getDay() + 7) % 7; return new Date(year, month, 1 + add + 7 * (n - 1)); }
function parseDate(s, { future = false } = {}) {
  const t = s.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/^the\s+/, '');
  const today = startOfDay(new Date());
  if (t === 'today' || t === 'now') return today;
  if (t === 'tomorrow') return new Date(+today + DAY);
  if (t === 'yesterday') return new Date(+today - DAY);
  const y = today.getFullYear();
  const named = { christmas: [11, 25], 'christmas day': [11, 25], 'christmas eve': [11, 24], halloween: [9, 31], 'new year': [0, 1], 'new years': [0, 1], "new year's": [0, 1], 'new years day': [0, 1], "new year's day": [0, 1], 'valentines day': [1, 14], "valentine's day": [1, 14], 'independence day': [6, 4], 'july 4th': [6, 4], 'new years eve': [11, 31], "new year's eve": [11, 31], 'st patricks day': [2, 17] };
  const pick = (mk) => { let d = mk(y); if (future && d < today) d = mk(y + 1); return d; };
  if (named[t]) return pick(yy => new Date(yy, named[t][0], named[t][1]));
  if (t === 'thanksgiving') return pick(yy => nthWeekday(yy, 10, 4, 4));
  if (t === 'easter') return pick(easter);
  if (t === 'summer') return pick(yy => new Date(yy, 5, 21));
  if (t === 'winter') return pick(yy => new Date(yy, 11, 21));
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)) { const [a, b, c] = t.split('-').map(Number); return new Date(a, b - 1, c); }
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(t)) { let [a, b, c] = t.split('/').map(Number); if (c < 100) c += 2000; return new Date(c, a - 1, b); }
  const wdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const wm = /^(?:(next|this|last)\s+)?(sun|mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?)(?:day)?$/.exec(t);
  if (wm) { const target = wdays.findIndex(w => w.startsWith(wm[2].slice(0, 3))); let add = (target - today.getDay() + 7) % 7; if (wm[1] === 'next' && add === 0) add = 7; if (wm[1] === 'last') add = add - 7 || -7; return new Date(+today + add * DAY); }
  if (!/\d|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/.test(t)) return null;
  const hasYear = /\b\d{4}\b/.test(t);
  const d = new Date(hasYear ? t : `${t} ${y}`);
  if (isNaN(d)) return null;
  if (!hasYear && future && d < today) d.setFullYear(y + 1);
  return startOfDay(d);
}
function easter(Y) { const a = Y % 19, b = Math.floor(Y / 100), c = Y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), hh = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - hh - k) % 7, m = Math.floor((a + 11 * hh + 22 * l) / 451); return new Date(Y, Math.floor((hh + l - 7 * m + 114) / 31) - 1, ((hh + l - 7 * m + 114) % 31) + 1); }
const longDate = (d) => d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
function spanParts(a, b) {
  let [from, to] = a <= b ? [a, b] : [b, a];
  let yrs = to.getFullYear() - from.getFullYear(), mos = to.getMonth() - from.getMonth(), days = to.getDate() - from.getDate();
  if (days < 0) { mos--; days += new Date(to.getFullYear(), to.getMonth(), 0).getDate(); }
  if (mos < 0) { yrs--; mos += 12; }
  return [yrs && `${yrs} year${yrs > 1 ? 's' : ''}`, mos && `${mos} month${mos > 1 ? 's' : ''}`, days && `${days} day${days > 1 ? 's' : ''}`].filter(Boolean).join(', ') || '0 days';
}
function dateSpan(ctx, a, b, labelA, labelB) {
  ctx.label('Dates');
  const days = Math.round((b - a) / DAY);
  let weekdays = 0; for (let t = +a; t < +b; t += DAY) { const g = new Date(t).getDay(); if (g && g < 6) weekdays++; }
  ctx.input(`${labelA} → ${labelB}`);
  ctx.add({ title: 'Difference', big: true, text: `${fmt(Math.abs(days), 0)} day${Math.abs(days) === 1 ? '' : 's'}${days < 0 ? ' ago' : ''}`, table: [['From', longDate(a)], ['To', longDate(b)], ['In years, months, days', spanParts(a, b)], ['In weeks', `${fmt(Math.abs(days) / 7, 2)} weeks`], ['Weekdays (Mon–Fri)', fmt(Math.abs(weekdays), 0)], ['Hours', fmt(Math.abs(days) * 24, 0)]] });
}
function dateShift(ctx, base, sign, n, unit, label) {
  ctx.label('Dates');
  const d = new Date(base);
  const k = sign === '-' ? -n : n;
  if (/^day/.test(unit)) d.setDate(d.getDate() + k);
  else if (/^week/.test(unit)) d.setDate(d.getDate() + 7 * k);
  else if (/^month/.test(unit)) d.setMonth(d.getMonth() + k);
  else if (/^year/.test(unit)) d.setFullYear(d.getFullYear() + k);
  ctx.input(`${label} ${sign} ${n} ${unit}`);
  ctx.add({ title: 'Result', big: true, text: longDate(d), table: [['Days from today', fmt(Math.round((startOfDay(d) - startOfDay(new Date())) / DAY), 0)], ['Day of the year', String(Math.round((d - new Date(d.getFullYear(), 0, 0)) / DAY))], ['ISO date', d.toISOString().slice(0, 10)]] });
}
function dateInfo(ctx, d, label) {
  ctx.label('Dates');
  ctx.input(label);
  const today = startOfDay(new Date());
  const diff = Math.round((d - today) / DAY);
  const wk = (() => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / DAY + 1) / 7); })();
  ctx.add({ title: 'Date', big: true, text: longDate(d), table: [['Relative to today', diff === 0 ? 'Today' : diff > 0 ? `In ${fmt(diff, 0)} days` : `${fmt(-diff, 0)} days ago`], ['Day of the year', String(Math.round((d - new Date(d.getFullYear(), 0, 0)) / DAY))], ['ISO week', String(wk)], ['Leap year', (d.getFullYear() % 4 === 0 && (d.getFullYear() % 100 !== 0 || d.getFullYear() % 400 === 0)) ? 'Yes' : 'No'], ['Unix timestamp', String(Math.floor(d / 1000))]] });
}

// ---- money ----
const numK = (s) => { s = String(s).replace(/[$,\s]/g, '').toLowerCase(); const m = s.endsWith('k') ? 1e3 : s.endsWith('m') ? 1e6 : 1; return parseFloat(s) * m; };
function loan(ctx, P, rate, n, unit) {
  ctx.label('Loan');
  const months = /month/.test(unit) ? n : n * 12;
  const r = rate / 100 / 12;
  const pay = r ? P * r / (1 - Math.pow(1 + r, -months)) : P / months;
  ctx.input(`${money(P)} at ${rate}% for ${n} ${unit}`);
  ctx.add({ title: 'Monthly payment', big: true, text: money(pay), table: [['Total paid', money(pay * months)], ['Total interest', money(pay * months - P)], ['Number of payments', String(months)]] });
  const bal = [], int = [], prin = [], xs = [];
  let b = P, ci = 0, cp = 0;
  for (let m = 1; m <= months; m++) { const i = b * r; ci += i; cp += pay - i; b -= pay - i; if (m % 12 === 0 || m === months) { xs.push(m / 12); bal.push(Math.max(b, 0)); int.push(ci); prin.push(cp); } }
  ctx.add({ title: 'Over time', plot: { kind: 'line', ytitle: '$', xtitle: 'Years', traces: [{ name: 'Balance left', x: xs, y: bal }, { name: 'Interest paid', x: xs, y: int }, { name: 'Principal paid', x: xs, y: prin }] } });
}
function compound(ctx, P, rate, years, add = 0, per = 'month') {
  ctx.label('Investment');
  const months = years * 12, r = rate / 100 / 12, monthlyAdd = per === 'year' ? add / 12 : add;
  let v = P, put = P; const xs = [0], vals = [P], puts = [P];
  for (let m = 1; m <= months; m++) { v = v * (1 + r) + monthlyAdd; put += monthlyAdd; if (m % 12 === 0) { xs.push(m / 12); vals.push(v); puts.push(put); } }
  ctx.input(`${money(P)} at ${rate}% for ${years} years${add ? `, adding ${money(add)} per ${per}` : ''}`);
  ctx.add({ title: 'Final value', big: true, text: money(v), table: [['Money put in', money(put)], ['Growth', money(v - put)], ['Rule of 72 (years to double)', rate ? fmt(72 / rate, 1) : '—']] });
  ctx.add({ title: 'Growth', plot: { kind: 'line', ytitle: '$', xtitle: 'Years', traces: [{ name: 'Value', x: xs, y: vals }, { name: 'Money put in', x: xs, y: puts }] } });
}

// ---- text, random, hashing, colour ----
async function hash(ctx, algo, text) {
  ctx.label('Hash');
  const name = { sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' }[algo.toLowerCase()];
  const buf = await crypto.subtle.digest(name, new TextEncoder().encode(text));
  ctx.input(`${name} of “${text.length > 60 ? text.slice(0, 60) + '…' : text}”`);
  ctx.add({ title: name, text: [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''), mono: true });
}
function textStats(ctx, t) {
  ctx.label('Text');
  ctx.input('Text statistics');
  const words = t.trim().split(/\s+/).filter(Boolean);
  const sentences = t.split(/[.!?]+(\s|$)/).filter(s => s && s.trim()).length;
  ctx.add({ title: 'Counts', table: [['Words', fmt(words.length, 0)], ['Characters', fmt(t.length, 0)], ['Characters (no spaces)', fmt(t.replace(/\s/g, '').length, 0)], ['Sentences', fmt(sentences, 0)], ['Paragraphs', fmt(t.split(/\n\s*\n/).filter(p => p.trim()).length, 0)], ['Reading time', `${Math.max(1, Math.round(words.length / 238))} min`], ['Speaking time', `${Math.max(1, Math.round(words.length / 150))} min`]] });
}
const rnd = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
function color(ctx, c) {
  ctx.label('Colour');
  const el = h('div'); el.style.color = c; document.body.append(el);
  const rgb = getComputedStyle(el).color; el.remove();
  const m = rgb.match(/[\d.]+/g);
  if (!m) throw new Error('Not a colour I recognise.');
  const [r, g, b] = m.map(Number);
  const hex = '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
  const rn = r / 255, gn = g / 255, bn = b / 255, mx = Math.max(rn, gn, bn), mn = Math.min(rn, gn, bn), l = (mx + mn) / 2;
  let hh = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : mx === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4; hh *= 60; }
  const lum = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b);
  ctx.input(hex.toUpperCase());
  ctx.add({ title: 'Colour', swatch: hex, table: [['HEX', hex.toUpperCase()], ['RGB', `rgb(${r}, ${g}, ${b})`], ['HSL', `hsl(${Math.round(hh)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`], ['Contrast on white', `${((1.05) / (L + 0.05)).toFixed(2)} : 1`], ['Contrast on black', `${((L + 0.05) / 0.05).toFixed(2)} : 1`]] });
}

// ============================================================
// Search & dorks
// ============================================================
const OPS_HELP = { site: 'only this website or domain', filetype: 'only this file type', ext: 'only this file extension', intitle: 'word must be in the page title', allintitle: 'all words in the title', inurl: 'word must be in the URL', allinurl: 'all words in the URL', intext: 'word must be in the page text', allintext: 'all words in the page text', before: 'published before this date', after: 'published after this date', related: 'sites similar to this one', cache: 'Google’s cached copy' };

function engineButtons(q) { return S.ENGINES.map(([label, url]) => ({ label, url: url + enc(q) })); }

function dork(ctx, q) {
  ctx.label('Advanced search');
  const raw = q.replace(/^dorks?\s*:?\s*/i, '');
  const ops = [...raw.matchAll(/(-?)(\w+):("[^"]+"|\S+)/g)].filter(m => OPS_HELP[m[2].toLowerCase()]);
  ctx.input(raw || 'Dork builder');
  if (ops.length || /"[^"]+"|\s-\w|\bOR\b/.test(raw)) {
    const rows = ops.map(m => [`${m[1]}${m[2]}:${m[3]}`, (m[1] ? 'exclude: ' : '') + OPS_HELP[m[2].toLowerCase()]]);
    for (const p of raw.matchAll(/(?<!\w:)"([^"]+)"/g)) rows.push([`"${p[1]}"`, 'exact phrase']);
    for (const p of raw.matchAll(/(?:^|\s)-(\w[\w-]*)(?=\s|$)/g)) rows.push([`-${p[1]}`, 'leave out results with this word']);
    if (/\bOR\b/.test(raw)) rows.push(['OR', 'either word can match']);
    ctx.add({ title: 'What this query does', table: rows });
    ctx.add({ title: 'Run it', buttons: engineButtons(raw).slice(0, 5) });
  }
  const plain = raw.replace(/(-?)(\w+):("[^"]+"|\S+)/g, '').replace(/"[^"]+"/g, '').trim();
  ctx.add({ title: 'Dork builder', custom: (el) => dorkBuilder(el, plain) });
}

function dorkBuilder(root, preset = '') {
  const f = {};
  const fields = [['all', 'All of these words', preset], ['exact', 'This exact phrase', ''], ['any', 'Any of these words', ''], ['none', 'None of these words', ''], ['site', 'Site or domain', '', 'e.g. edu, gov, mit.edu, reddit.com'], ['title', 'Words in the title', ''], ['url', 'Words in the URL', ''], ['after', 'After (date)', '', 'YYYY-MM-DD'], ['before', 'Before (date)', '', 'YYYY-MM-DD']];
  const grid = h('div', 'dork-grid');
  for (const [k, label, val, ph] of fields) {
    const l = h('label', 'field'); l.append(h('span', null, label));
    const i = h('input'); i.value = val || ''; i.placeholder = ph || ''; i.oninput = upd; f[k] = i; l.append(i); grid.append(l);
  }
  const ftl = h('label', 'field'); ftl.append(h('span', null, 'File type'));
  const sel = h('select');
  for (const t of ['', 'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'txt', 'json', 'xml', 'epub']) { const o = h('option', null, t || 'Any'); o.value = t; sel.append(o); }
  sel.onchange = upd; f.type = sel; ftl.append(sel); grid.append(ftl);
  const out = h('code', 'dork-out');
  const btns = h('div', 'btns');
  const tpl = h('div', 'chips');
  const templates = [['PDFs from universities', { site: 'edu', type: 'pdf' }], ['Government reports', { site: 'gov', type: 'pdf' }], ['Slide decks', { any: 'filetype:ppt filetype:pptx' }], ['Datasets', { any: 'filetype:csv filetype:xlsx' }], ['Theses & dissertations', { any: 'thesis dissertation', type: 'pdf' }], ['Course syllabi', { title: 'syllabus' }], ['arXiv only', { site: 'arxiv.org' }], ['Forums & discussion', { any: 'site:reddit.com site:news.ycombinator.com site:stackexchange.com' }], ['Last 12 months', { after: new Date(Date.now() - 365 * DAY).toISOString().slice(0, 10) }]];
  for (const [label, vals] of templates) { const b = h('button', 'chip', label); b.type = 'button'; b.onclick = () => { for (const [k, v] of Object.entries(vals)) (k === 'type' ? sel : f[k]).value = v; upd(); }; tpl.append(b); }
  function build() {
    const parts = [];
    if (f.all.value.trim()) parts.push(f.all.value.trim());
    if (f.exact.value.trim()) parts.push(`"${f.exact.value.trim().replace(/"/g, '')}"`);
    if (f.any.value.trim()) parts.push('(' + f.any.value.trim().split(/\s+/).join(' OR ') + ')');
    if (f.none.value.trim()) parts.push(f.none.value.trim().split(/\s+/).map(w => '-' + w).join(' '));
    if (f.site.value.trim()) parts.push('site:' + f.site.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
    if (sel.value) parts.push('filetype:' + sel.value);
    if (f.title.value.trim()) parts.push(f.title.value.trim().split(/\s+/).map(w => 'intitle:' + w).join(' '));
    if (f.url.value.trim()) parts.push(f.url.value.trim().split(/\s+/).map(w => 'inurl:' + w).join(' '));
    if (f.after.value.trim()) parts.push('after:' + f.after.value.trim());
    if (f.before.value.trim()) parts.push('before:' + f.before.value.trim());
    return parts.join(' ');
  }
  function upd() {
    const q = build();
    out.textContent = q || '(fill in a field)';
    btns.replaceChildren(...engineButtons(q).slice(0, 5).map(b => linkBtn(b.label, b.url)));
  }
  root.append(h('p', 'note', 'Templates:'), tpl, grid, h('p', 'note', 'Your query:'), out, btns);
  upd();
}

async function universal(ctx, q, keepLabel) {
  if (!keepLabel) { ctx.label('Search'); ctx.input(q); }
  const sWeb = ctx.slot(), sDdg = ctx.slot(), sWiki = ctx.slot(), sPapers = ctx.slot();
  ctx.add({ title: 'Search the web', buttons: [...engineButtons(q), { label: 'Advanced search builder', query: `dork ${q}` }] });
  const jobs = [
    S.webResults(sWeb, q).catch(() => 0),
    S.ddg(sDdg, q).catch(() => 0),
    S.wiki(sWiki, q, { quiet: true }).then(() => 1).catch(() => 0),
  ];
  if (q.split(/\s+/).length >= 2) {
    jobs.push(S.get(`https://api.openalex.org/works?search=${enc(q)}&per-page=4&select=title,doi,publication_year,cited_by_count,open_access`).then(r => {
      if (!r.results.length) return 0;
      sPapers.add({ title: 'Research papers', list: r.results.map(w => ({ title: w.title, url: w.doi, meta: `${w.publication_year} · ${fmt(w.cited_by_count, 0)} citations`, actions: w.open_access && w.open_access.oa_url ? [{ label: 'PDF', url: w.open_access.oa_url }] : [] })), links: [{ label: 'More papers →', query: `papers on ${q}` }] });
      return 1;
    }).catch(() => 0));
  }
  const counts = await Promise.all(jobs);
  if (!counts.some(Boolean) && !keepLabel) ctx.add({ title: 'No direct answer', text: 'None of the built-in sources had an answer. Use the search buttons above, or type "help" to see what I understand.' });
}

// ============================================================
// Help
// ============================================================
const EXAMPLES = [
  ['Math', ['integrate x^2 sin x', 'derivative of x^3 e^x', 'solve x^2 + 2x - 8 = 0', "y'' + 3y' + 2y = 0, y(0)=1, y'(0)=0", 'limit sin(x)/x as x -> 0', 'plot sin x, cos x from -pi to pi', 'x^2 + y^2', 'maximize x(10-2x)', 'laplace transform of sin(3t)', 'taylor series of cos x', 'sum 1/n^2 from n=1 to oo', '[[2,1],[1,3]]', 'pi to 200 digits', '1000th prime', 'factor x^4 - 16']],
  ['Science', ['balance C3H8 + O2 -> CO2 + H2O', 'molar mass of caffeine', 'element iron', 'speed of light', 'avogadro', 'species red fox', 'exoplanets around trappist-1', 'asteroids', 'astronomy picture of the day', 'moon phase', 'normal mean 100 sd 15 between 85 and 115', 'binomial n=10 p=0.5 k>=7', 'linear fit (1,2) (2,4.1) (3,5.9) (4,8.2)', 'truth table (p and q) or not r']],
  ['Everyday', ['I got 87 out of 95', 'will it rain in Boston tomorrow at 3pm', 'what can I make with chicken and rice', 'how far is Boston from NYC', '10 km to miles', '3pm EST to Tokyo', 'mean 4, 8, 15, 16, 23, 42', '255 in binary', 'days until christmas', 'timer 5 minutes', 'calendar december 2026', '$100 in 1990 to 2024', '18% tip on 64.50', 'mortgage 350k at 6.5% for 30 years', 'bmi 150 lb 5\'10"', 'roll 3d6', 'random password 20', '1234567 in words', 'qr https://cymartinbell.com']],
  ['Research', ['papers on quadruped locomotion ros2', 'most cited papers on transformers', 'open access papers on vehicle recalls', 'arxiv voynich manuscript', 'pubmed caffeine sleep', 'cite 10.1038/nature14539', 'author Geoffrey Hinton', 'clinical trials for migraine', 'datasets on air pollution']],
  ['Knowledge', ['who is Ada Lovelace', 'what is photosynthesis', 'japan facts', 'population of japan', 'define serendipity', 'synonyms for happy', 'translate good morning to japanese', 'on this day', 'art by monet', 'recipe lasagna', 'nutrition banana', 'john 3:16']],
  ['Live', ['weather in Sudbury MA', 'weather in Boston on 2015-02-09', 'tides in Boston', 'time in Tokyo', 'air quality in Los Angeles', '100 usd to eur', 'bitcoin price', 'AAPL stock', 'nfl scores', 'robotics news', 'earthquakes', 'where is the iss', 'upcoming launches', 'distance from Boston to New York']],
  ['Lookups', ['5YJ3E1EA7KF317000', 'recalls 2021 tesla model 3', 'dns cymartinbell.com', 'whois github.com', 'my ip', 'CVE-2021-44228', 'vulns npm lodash 4.17.15', 'github ros2 quadruped', 'pypi sympy', 'isbn 9780441172719', 'zip 01776', 'song bohemian rhapsody']],
  ['Word problems', ['Adult tickets cost $8 and kid tickets cost $5. They sold 120 tickets for $780. How many adult tickets were sold?', 'In 5 years Maya will be twice as old as she was 3 years ago. How old is she now?', '130 students ride buses that hold 40 each. How many buses are needed?', '$5,000 invested at 4% compounded monthly for 3 years', 'A car accelerates from rest at 3 m/s² for 5 s. How far does it travel?', 'Three more than twice a number is 11. What is the number?', 'The sum of two numbers is 30 and their difference is 4. Find the numbers.', 'A $80 jacket is 30% off with 6% sales tax. How much do you pay?', 'What is the volume of a cylinder with radius 3 cm and height 10 cm?', 'John can paint a fence in 6 hours and Mary in 3 hours. How long together?', 'Sam has 12 apples, gives 4 to Ann and buys 7 more. How many does he have?', 'A ball is dropped from a height of 20 m. How long until it hits the ground?', 'check x=3 in 2x+3=9', '1. solve 2x+3=11\n2. derivative of x^2 sin x\n3. area of a circle with radius 4']],
  ['Text & sources', ['explain photosynthesis', 'difference between mitosis and meiosis', 'explain this code: for i in range(10): print(i*i)', 'what does "irony" mean in this sentence: The fire station burned down', 'find the vertex of x^2 - 4x + 3', 'eli5 black holes', 'how does a transistor work', 'how tall is the eiffel tower', 'who founded tesla', 'when was MIT founded', 'what is the capital of australia', 'how old is Paul McCartney', 'https://en.wikipedia.org/wiki/Voynich_manuscript', 'https://arxiv.org/abs/1706.03762', 'Paste any long text to get its key sentences, names, places and a glossary']],
  ['Search', ['dork robotics competition rules', 'site:edu filetype:pdf quadruped gait', 'how do penguins sleep']],
  ['Your files', ['Drop a PDF, text, CSV or JSON file anywhere on the page, or use the 📎 button', 'summarize', 'main idea', 'what do I need to do', 'find results', 'references', 'outline']],
  ['Code & text', ['sha256 hello world', 'base64 encode hello', 'morse hello world', 'rot13 hello', '{"a":1,"b":[1,2]}', 'regex /\\d+/ on abc123def45', 'word count the quick brown fox', '#2f5d50']],
  ['Python', ['py: import numpy as np\nnp.linalg.eig([[2,1],[1,3]])', 'py: import matplotlib.pyplot as plt\nplt.plot([1,4,9,16]); plt.title("squares")']],
];

function help(ctx) {
  ctx.label('Help');
  ctx.input('What you can type');
  for (const [cat, ex] of EXAMPLES) ctx.add({ title: cat, chips: ex.filter(x => !/^(?:Drop a |Paste any )/.test(x)), note: cat === 'Your files' ? 'Drop a PDF, Word, PowerPoint, Excel, image or text file anywhere on the page, or use the 📎 button. Photos and scans are read with OCR. Files are read on your device and never uploaded.' : undefined });
  ctx.add({ title: 'Tips', numbered: ['Press / to jump to the search box, ↑ and ↓ to recall past queries, Shift+Enter for a new line.', 'Variables carry over: type a = 5, then a^2.', 'Every answer has a share button that copies a link to it.', 'Start with py: to run real Python (NumPy, SciPy, pandas, Matplotlib and SymPy all work).', 'Drop files onto the page: every later answer also shows matching passages from them. Files never leave your device.', 'Paste a whole homework sheet with numbered problems (1. 2. 3.) and each gets its own answer.', 'Paste a long article or essay to get key sentences, names and places, and a glossary of hard words. Paste a link to read a page.', 'Word problems are solved by rules, not AI: check the “What I found” table to confirm it read the problem correctly.', 'If nothing matches, I search the web, Wikipedia, DuckDuckGo and research papers at once.'] });
}

// ============================================================
// Router: ordered rules, first match wins
// ============================================================
const LOC = '([\\w .,\'-]+)';
const R = (s) => new RegExp(s, 'i');
const COINS = 'bitcoin|btc|ethereum|eth|ether|solana|sol|dogecoin|doge|xrp|ripple|cardano|ada|litecoin|ltc|bnb|polkadot|dot|avalanche|avax|chainlink|link|polygon|matic|tron|trx|shiba inu|shib|monero|xmr|toncoin|ton|usdc|tether|usdt';

async function papersAll(ctx, q, opts = {}) {
  const extra = (opts.source || 'all') === 'all' ? [S2.europePmc(ctx, q), S2.doaj(ctx, q), S2.crossrefSearch(ctx, q)].map(p => p.catch(() => {})) : [];
  await Promise.all([S.papers(ctx, q, opts), ...extra]);
}

const ANSWER_ONLY = /^\s*[a-z]\s*=\s*-?[\d./]+(?:\s*(?:,|and)\s*[a-z]\s*=\s*-?[\d./]+)*\s*$/i;
function checkAnswer(c, a1, a2) {
  const [answer, expr] = ANSWER_ONLY.test(a1) || /^-?[\d./]+$/.test(a1.trim()) ? [a1, a2] : [a2, a1];
  return runEngine(c, { op: 'check', expr, answer: answer.replace(/\band\b/g, ',') }, 'Check');
}

const RULES = [
  [/^(?:py|python)\s*[:>]\s*([\s\S]+)$/i, (c, m) => runEngine(c, { op: 'python', code: m[1] }, 'Python')],
  [/^(?:read|open|summari[sz]e|analy[sz]e|fetch)?\s*(https?:\/\/\S+)$/i, (c, m) => F.addUrl(c, m[1])],
  [/^(?:summari[sz]e|tl;?dr|key points(?: of)?|main idea(?: of)?)\s*:?\s*([\s\S]{120,})$/i, (c, m) => F.analyzeText(c, m[1], { focus: 'summary' })],
  [/^(?:analy[sz]e|extract (?:info|information|names|facts|data)(?: from)?|explain|simplify|break down|define (?:the )?(?:hard )?words in)\s*(?:this|the following|text)?\s*:?\s*([\s\S]{120,})$/i, (c, m) => F.analyzeText(c, m[1])],
  ...MORE_RULES.map(([re, fn]) => [re, (c, m, q) => fn(c, m, q, { S, S2, runEngine, engineButtons, ask, get: S.get })]),
  [/^(?:check|verify)\s+(?:if\s+|whether\s+|that\s+)?(.+?)\s+(?:is (?:a |the )?(?:solution|answer|root) (?:of|to|for)|solves|satisfies|in|for|with|using|when|where)\s+(.+)$/i, (c, m) => checkAnswer(c, m[1], m[2])],
  [/^is\s+(.+?)\s+(?:a |the )?(?:solution|answer|root) (?:of|to|for)\s+(.+)$/i, (c, m) => checkAnswer(c, m[1], m[2])],
  [/^(?:explain like i'?m (?:5|five|a kid|a child)|eli5|simply explain|explain simply|explain in simple terms)\s*:?\s*(.{2,80})$/i, (c, m) => S.explain(c, cleanTopic(m[1]), { simple: true })],
  [/^(?:explain in (?:depth|detail)|in-depth explanation of)\s*:?\s*(.{2,80})$/i, (c, m) => S.explain(c, cleanTopic(m[1]), { simple: false })],
  [/^(?:explain|teach me(?: about)?|help me understand|what is the meaning of|give me an explanation of|tell me how)\s*:?\s*(?!.*[=^])(.{2,80})$/i, (c, m) => S.explain(c, cleanTopic(m[1]), { simple: /like i'?m|eli5|simpl|kid/i.test(m[0]) })],
  [/^how (?:does|do) (?:a |an |the )?(.{2,60}) work$/i, (c, m) => S.explain(c, cleanTopic(m[1]))],
  ...S.QA.map(([re, props, label]) => [re, (c, m) => (/\d{2,}|[=^]/.test(m[1]) ? false : S.directAnswer(c, props, label, m[1]))]),
  [/^(?:help|\?|what can you do|examples|commands)$/i, (c) => help(c)],

  // research
  [/^(?:cite|citation(?:\s+for)?|reference(?:\s+for)?)\s+(?:doi:?\s*)?(10\.\d{4,9}\/\S+)$/i, (c, m) => S.doi(c, m[1], true)],
  [/^(?:doi:?\s*|https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/\S+)$/i, (c, m) => S.doi(c, m[1])],
  [/^(?:most[- ]cited|top|best|influential)\s+(?:papers?|research|articles?|studies)\s+(?:on|about|in)\s+(.+)$/i, (c, m) => papersAll(c, m[1], { sort: 'cited' })],
  [/^(?:recent|latest|new|newest)\s+(?:papers?|research|articles?|studies)\s+(?:on|about|in)\s+(.+)$/i, (c, m) => papersAll(c, m[1], { sort: 'recent' })],
  [/^(?:find\s+|search\s+(?:for\s+)?)?(?:research\s+|academic\s+|scientific\s+|scholarly\s+)?(?:papers?|research|articles?|studies|literature|publications?|journals?)\s+(?:on|about|regarding|for|into|in)\s+(.+)$/i, (c, m) => papersAll(c, m[1])],
  [/^(.+?)\s+(?:research\s+papers?|papers|studies|literature review)$/i, (c, m) => papersAll(c, m[1])],
  [/^(?:open[- ]access|free|oa)\s+(?:papers?|research|articles?|studies)\s+(?:on|about)\s+(.+)$/i, (c, m) => papersAll(c, m[1], { sort: 'oa' })],
  [/^arxiv\s+(.+)$/i, (c, m) => S.papers(c, m[1], { source: 'arxiv' })],
  [/^(?:pubmed|medline)\s+(.+)$/i, (c, m) => S.papers(c, m[1], { source: 'pubmed' })],
  [/^(?:semantic scholar|s2)\s+(.+)$/i, (c, m) => S.papers(c, m[1], { source: 'semantic' })],
  [/^openalex\s+(.+)$/i, (c, m) => S.papers(c, m[1], { source: 'openalex' })],
  [/^(?:clinical\s+trials?|trials?)\s+(?:for|on|about|of)?\s*(.+)$/i, (c, m) => S.trials(c, m[1])],
  [/^datasets?\s+(?:on|about|for|of)?\s*(.+)$/i, (c, m) => S.datasets(c, m[1])],
  [/^(?:author|researcher|scientist|scholar|papers by|research by|publications by)\s+(.+)$/i, (c, m) => S.author(c, m[1])],

  // more knowledge & data
  [/^(?:country|country facts|facts about)\s+(.+)$/i, (c, m) => (S.countryCode(m[1]) ? S2.country(c, m[1]) : false)],
  [/^(.+?)\s+(?:country\s+)?facts$/i, (c, m) => (S.countryCode(m[1]) ? S2.country(c, m[1]) : false)],
  [/^(?:zip|zip code|zipcode|postal code)\s+(\d{5})$/i, (c, m) => S2.zip(c, m[1])],
  [/^(?:tides?|tide times?|high tide|low tide)\s+(?:in|at|for|near)?\s*(.+)$/i, (c, m) => S2.tides(c, m[1])],
  [/^(?:weather|temperature)\s+(?:in|at|for)\s+(.+?)\s+(?:on|in)\s+(.+\d.*|yesterday|last week)$/i, (c, m) => { const d = parseDate(m[2]); if (!d || d >= startOfDay(new Date())) return false; return S2.pastWeather(c, m[1], d); }],
  [/^(?:element|atomic number of|properties of element)\s+(\w+)$/i, (c, m) => S2.element(c, m[1])],
  [/^(\w+)\s+element$/i, (c, m) => S2.element(c, m[1])],
  [/^(?:apod|astronomy picture(?: of the day)?|nasa picture(?: of the day)?|space picture)$/i, (c) => S2.apod(c)],
  [/\b(?:asteroids?|near[- ]earth objects?|neos?|close approaches)\b/i, (c) => S2.asteroids(c)],
  [/^(?:exoplanets?|planets?)\s+(?:around|orbiting|of|near|in)?\s*(?:the\s+)?(?:star\s+)?(.+)$/i, (c, m) => S2.exoplanet(c, m[1])],
  [/^(?:on this day|this day in history|today in history)$/i, (c) => { const d = new Date(); return S2.onThisDay(c, d.getMonth() + 1, d.getDate()); }],
  [/^(?:what happened|on this day|history)\s+(?:on\s+)?([a-z]+\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}\/\d{1,2})$/i, (c, m) => { const d = parseDate(m[1]); if (!d) return false; return S2.onThisDay(c, d.getMonth() + 1, d.getDate()); }],
  [/^(?:art|artwork|painting|paintings)\s+(?:by\s+)?(.+)$/i, (c, m) => S2.art(c, m[1])],
  [/^(?:recipe|recipes|how to (?:make|cook))\s+(?:for\s+)?(.+)$/i, (c, m) => S2.recipe(c, m[1])],
  [/^(?:cocktail|drink|how to make a)\s+(.+)$/i, (c, m) => S2.recipe(c, m[1], true)],
  [/^(?:nutrition(?: facts)?|calories|calories in|nutrition (?:of|in)|macros(?: of| in)?|protein in)\s+(?:a\s+|an\s+)?(.+)$/i, (c, m) => S2.nutrition(c, m[1])],
  [/^(?:bible\s+)?((?:[1-3]\s?)?[a-z]+\s+\d{1,3}:\d{1,3}(?:-\d{1,3})?)$/i, (c, m) => S2.bible(c, m[1])],
  [/^(?:isbn\s*:?\s*)((?:97[89])?\d{9}[\dX])$|^((?:97[89])\d{10})$/i, (c, m) => S2.isbn(c, m[1] || m[2])],
  [/^pok[eé]mon\s+(.+)$/i, (c, m) => S2.pokemon(c, m[1])],
  [R(`^(${S2.LEAGUE_KEYS.join('|')})\\s+(?:scores?|games?|scoreboard|results)$|^(?:scores?|scoreboard)\\s+(${S2.LEAGUE_KEYS.join('|')})$`), (c, m) => S2.scores(c, m[1] || m[2])],
  [/^(?:news|headlines|latest news)\s+(?:on|about)?\s*(.+)$/i, (c, m) => S2.news(c, m[1])],
  [/^(.+?)\s+news$/i, (c, m) => S2.news(c, m[1])],
  [/^(?:vulns?|vulnerabilities|cves?|security)\s+(?:for\s+|in\s+)?(npm|pypi|pip|python|maven|go|cargo|rust|rubygems|gem|nuget|packagist|composer)\s+(\S+?)(?:[@\s]+(\S+))?$/i, (c, m) => S2.osv(c, m[1], m[2], m[3])],
  [/^\$?([\d,.]+)\s*(?:dollars?|usd)?\s+(?:in|from)\s+(\d{4})(?:\s+dollars)?(?:\s+(?:to|in)\s+(\d{4}|today|now)(?:\s+dollars)?)?$/i, (c, m) => S2.inflation(c, numK(m[1]), +m[2], m[3] && /^\d/.test(m[3]) ? +m[3] : null)],
  [/^inflation\s+(?:from\s+)?(\d{4})\s+(?:to\s+)?(\d{4}|today|now)?$/i, (c, m) => S2.inflation(c, 100, +m[1], m[2] && /^\d/.test(m[2]) ? +m[2] : null)],
  [/^([\d.,]+)\s*([a-z]{3})\s+(?:to|in)\s+([a-z]{3})\s+(?:on|in|at)\s+(.+)$/i, (c, m) => { const a = S.curCode(m[2]), b = S.curCode(m[3]); const d = parseDate(/^\d{4}$/.test(m[4]) ? `${m[4]}-01-02` : m[4]); return a && b && d ? S2.historicalCurrency(c, numK(m[1]), a, b, d) : false; }],

  // lookups
  [/^(cve-\d{4}-\d{4,})$/i, (c, m) => S.cve(c, m[1])],
  [/^(?:vin\s+|decode\s+)?((?=[A-HJ-NPR-Z0-9]*\d)[A-HJ-NPR-Z0-9]{17})$/i, (c, m) => S.vin(c, m[1])],
  [/^recalls?\s+(?:for\s+|on\s+)?(?:a\s+|the\s+|my\s+)?(\d{4})\s+(\S+)\s+(.+)$/i, (c, m) => S.recalls(c, m[1], m[2], m[3])],
  [/^(\d{4})\s+(\S+)\s+(.+?)\s+recalls?$/i, (c, m) => S.recalls(c, m[1], m[2], m[3])],
  [/^(?:what(?:'s| is)\s+)?my\s+ip(?:\s+address)?$/i, (c) => S.ipInfo(c, null)],
  [/^(?:ip\s+(?:address\s+)?|lookup\s+)?(\d{1,3}(?:\.\d{1,3}){3})$/i, (c, m) => S.ipInfo(c, m[1])],
  [/^(?:dns|nslookup|dig|records(?: for)?)\s+([a-z0-9.-]+\.[a-z]{2,})$/i, (c, m) => S.dns(c, m[1])],
  [/^(?:whois|rdap|who owns|domain|registrar(?: of)?)\s+([a-z0-9.-]+\.[a-z]{2,})$/i, (c, m) => S.whois(c, m[1])],
  [/^(?:certs?|certificates?|subdomains?(?:\s+of)?|crt\.?sh)\s+([a-z0-9.-]+\.[a-z]{2,})$/i, (c, m) => S.certs(c, m[1])],
  [/^(?:wayback|archive|archived|web archive(?: of)?)\s+(\S+\.\S+)$/i, (c, m) => S.wayback(c, m[1])],

  // dorks / advanced search
  [/^dorks?\b/i, (c, m, q) => dork(c, q)],
  [/(?:^|\s)-?(?:site|filetype|ext|intitle|allintitle|inurl|allinurl|intext|allintext|before|after|related):\S/i, (c, m, q) => dork(c, q)],

  // live data
  [/\b(?:iss|international space station)\b/i, (c) => S.iss(c)],
  [/\b(?:rocket\s+)?launch(?:es)?\b.*\b(?:upcoming|next|schedule)|\b(?:upcoming|next)\s+(?:rocket\s+|spacex\s+)?launch(?:es)?\b/i, (c) => S.launches(c)],
  [/\b(?:kp index|space weather|aurora(?:s)?(?: forecast)?|geomagnetic(?: storm)?|northern lights)\b/i, (c) => S.spaceWeather(c)],
  [/\bearthquakes?\b/i, (c) => S.earthquakes(c)],
  [/^(?:weather|forecast|temperature)$/i, async (c) => { const g = await S.get('https://ipapi.co/json/'); return S.weather(c, g.city || 'New York'); }],
  [R(`^(?:what(?:'s| is) the\\s+)?(?:weather|forecast|temperature)(?:\\s+like)?(?:\\s+(?:in|for|at))\\s+${LOC}$`), (c, m) => S.weather(c, m[1])],
  [R(`^(?:weather|forecast)\\s+${LOC}$`), (c, m) => S.weather(c, m[1])],
  [R(`^${LOC}\\s+(?:weather|forecast)$`), (c, m) => S.weather(c, m[1])],
  [R(`^(?:air quality|aqi|pollution)\\s+(?:in|for|at)?\\s*${LOC}$`), (c, m) => S.airQuality(c, m[1])],
  [R(`^(?:what\\s+)?(?:time|current time|local time)(?:\\s+is\\s+it)?\\s+in\\s+${LOC}$`), (c, m) => S.timeIn(c, m[1])],
  [R(`^(?:when is\\s+)?(?:sunrise|sunset|sunrise and sunset|daylight|golden hour)\\s+(?:in|at|for)\\s+${LOC}$`), (c, m) => S.sun(c, m[1])],
  [/^(?:directions|distance|drive|driving|route|how far(?: is it)?)\s+(?:from\s+)?(.+?)\s+to\s+(.+)$/i, (c, m) => S.directions(c, m[1], m[2])],
  [/^how far is\s+(.+?)\s+from\s+(.+)$/i, (c, m) => S.directions(c, m[2], m[1])],
  [/^(?:map(?:\s+of)?|where is|where's)\s+(.+)$/i, (c, m) => S.place(c, m[1])],
  [/^(?:public\s+|federal\s+|bank\s+)?holidays?(?:\s+(?:in|for))?(?:\s+(\d{4}))?(?:\s+(?:in\s+)?([a-z .]+?))?(?:\s+(\d{4}))?$/i, (c, m) => S.holidays(c, (m[2] || 'US').trim(), +(m[1] || m[3] || new Date().getFullYear()))],

  // money
  [/^(?:convert\s+)?([$€£¥])?\s*([\d.,]+\s*[km]?)\s*([a-z$€£¥]+)?\s+(?:to|in|into)\s+([a-z$€£¥]+)$/i, (c, m) => {
    const from = S.curCode(m[1] || m[3] || ''), to = S.curCode(m[4]);
    if (from && to) return S.currency(c, numK(m[2]), from, to);
    const coin = new RegExp(`^(?:${COINS})$`, 'i');
    if (m[3] && coin.test(m[3]) && to) return S.crypto(c, m[3], numK(m[2]), to.toLowerCase());
    return false;
  }],
  [/^(?:exchange rate\s+)?([a-z]{3})\s*(?:to|\/|in)\s*([a-z]{3})(?:\s+(?:exchange\s+)?rate)?$/i, (c, m) => { const a = S.curCode(m[1]), b = S.curCode(m[2]); return a && b ? S.currency(c, 1, a, b) : false; }],
  [R(`^(?:price of\\s+|how much is\\s+(?:a\\s+|one\\s+)?)?([\\d.]+\\s*)?(${COINS})(?:\\s+(?:price|value|worth))?(?:\\s+(?:in|to)\\s+(usd|eur|gbp))?$`), (c, m) => S.crypto(c, m[2], m[1] ? parseFloat(m[1]) : 1, (m[3] || 'usd').toLowerCase())],
  [/^(?:crypto|coin)\s+(.+)$/i, (c, m) => S.crypto(c, m[1])],
  [/^(?:stock|shares?|ticker|quote)\s+\$?([a-z.^-]{1,10})$/i, (c, m) => S.stock(c, m[1])],
  [/^\$?([A-Za-z.^-]{1,6})\s+(?:stock|shares?|share price|stock price|quote)$/i, (c, m) => S.stock(c, m[1])],
  [/^(?:mortgage|loan|payment(?:\s+on)?|car loan)\s+(?:of\s+)?\$?([\d.,]+\s*[km]?)\s+(?:at\s+)?([\d.]+)\s*%\s+(?:for|over)\s+(\d+)\s*(years?|yrs?|months?)$/i, (c, m) => loan(c, numK(m[1]), +m[2], +m[3], /m/i.test(m[4][0]) ? 'months' : 'years')],
  [/^(?:compound interest|invest(?:ment)?|savings?)\s+(?:of\s+)?\$?([\d.,]+\s*[km]?)\s+at\s+([\d.]+)\s*%\s+(?:for|over)\s+(\d+)\s*years?(?:,?\s+(?:adding|plus|with|contributing)\s+\$?([\d.,]+)\s*(?:a|per|\/|each)\s*(month|year))?$/i, (c, m) => compound(c, numK(m[1]), +m[2], +m[3], m[4] ? numK(m[4]) : 0, m[5] || 'month')],
  [/^(?:tip\s+(?:of\s+)?)?([\d.]+)\s*%\s*tip\s+(?:on|for)\s+\$?([\d.,]+)(?:\s+(?:split|between|for)\s+(\d+)(?:\s+people)?)?$|^tip\s+([\d.]+)\s*%\s+(?:on|for)\s+\$?([\d.,]+)(?:\s+(?:split|between|for)\s+(\d+))?$/i, (c, m) => {
    const pct = +(m[1] || m[4]), bill = numK(m[2] || m[5]), n = +(m[3] || m[6] || 1);
    c.label('Tip'); c.input(`${pct}% tip on ${money(bill)}${n > 1 ? `, split ${n} ways` : ''}`);
    const tip = bill * pct / 100;
    c.add({ title: 'Tip', big: true, text: money(tip), table: [['Total', money(bill + tip)], ...(n > 1 ? [['Each person pays', money((bill + tip) / n)]] : []), ['15% / 18% / 20% / 25%', [15, 18, 20, 25].map(p => money(bill * p / 100)).join(' / ')]] });
  }],
  [/^([\d.]+)\s*%\s+of\s+([\d.,]+\s*[km]?)$/i, (c, m) => { c.label('Percent'); c.input(m[0]); c.add({ title: 'Result', big: true, text: fmt(m[1] / 100 * numK(m[2]), 6) }); }],
  [/^([\d.,]+)\s+is\s+what\s+(?:percent|%)\s+of\s+([\d.,]+)$/i, (c, m) => { c.label('Percent'); c.input(m[0]); c.add({ title: 'Result', big: true, text: fmt(numK(m[1]) / numK(m[2]) * 100, 6) + '%' }); }],
  [/^(?:percent(?:age)?\s+change|%\s*change|change)\s+(?:from\s+)?([\d.,]+)\s+to\s+([\d.,]+)$/i, (c, m) => { const a = numK(m[1]), b = numK(m[2]); c.label('Percent'); c.input(`${m[1]} → ${m[2]}`); c.add({ title: 'Change', big: true, text: `${b >= a ? '+' : ''}${fmt((b - a) / a * 100, 4)}%`, table: [['Difference', fmt(b - a, 6)], ['Ratio', fmt(b / a, 6) + '×']] }); }],

  // words
  [/^(?:define|definition(?:\s+of)?|meaning(?:\s+of)?|what does)\s+(.+?)(?:\s+mean)?$/i, (c, m) => S.define(c, m[1].replace(/^["']|["']$/g, ''))],
  [/^(\w[\w' -]*?)\s+(?:definition|meaning)$/i, (c, m) => S.define(c, m[1])],
  [/^(synonyms|antonyms|rhymes|words like|sounds like|words related to|adjectives for|words that describe)\s+(?:for\s+|of\s+|with\s+|to\s+)?(.+)$/i, (c, m) => S.words(c, m[1].toLowerCase(), m[2])],
  [/^(?:what\s+)?rhymes?\s+with\s+(.+)$/i, (c, m) => S.words(c, 'rhymes', m[1])],
  [/^(?:slang|urban(?: dictionary)?)\s+(.+)$/i, (c, m) => S.slang(c, m[1])],
  [/^translate\s+["“]?(.+?)["”]?(?:\s+from\s+([a-z ]+?))?\s+(?:to|into)\s+([a-z ]+)$/i, (c, m) => S.translate(c, m[1], m[3], m[2] || 'english')],
  [/^how (?:do you|do i|to) say\s+["“]?(.+?)["”]?\s+in\s+([a-z ]+)$/i, (c, m) => S.translate(c, m[1], m[2])],

  // science & health
  [/^(?:molar mass|molecular weight|molecular mass|formula|chemical formula|structure|smiles)\s+(?:of\s+)?(.+)$/i, (c, m) => S.chem(c, m[1])],
  [/^(?:compound|molecule|chemical|element)\s+(.+)$/i, (c, m) => S.chem(c, m[1])],
  [/^(?:drug|medication|medicine|side effects(?:\s+of)?|uses\s+(?:of|for)|warnings\s+for)\s+(.+)$/i, (c, m) => S.drug(c, m[1])],
  [/^(?:species|animal|plant|bird|insect|fish|taxonomy(?:\s+of)?|taxon)\s+(.+)$/i, (c, m) => S.species(c, m[1])],

  // countries
  [R(`^(?:what(?:'s| is) the\\s+)?(${S.WB_KEYS.join('|')})\\s+(?:of|in|for)\\s+(.+)$`), async (c, m) => { if (S.countryCode(m[2])) return S.countryStat(c, m[1].toLowerCase(), m[2]); if (/\d/.test(m[2])) return false; if (/population/i.test(m[1]) && await S.directAnswer(c, ['P1082'], 'Population', m[2]).catch(() => false)) return; return S.wiki(c, `${m[1]} of ${m[2]}`); }],

  // media
  [/^(?:books?|novels?)\s+(?:by|about|called|named|on)?\s*(.+)$/i, (c, m) => S.books(c, m[1])],
  [/^(?:songs?|music|tracks?|artist|album)\s+(?:by\s+|called\s+)?(.+)$/i, (c, m) => S.music(c, m[1])],
  [/^(?:tv|tv show|tv series)\s+(.+)$/i, (c, m) => S.tv(c, m[1])],

  // developer
  [/^(?:github|gh|repos?|repositories)\s+(.+)$/i, (c, m) => S.github(c, m[1])],
  [/^(?:stackoverflow|stack overflow|so)\s+(.+)$/i, (c, m) => S.stackoverflow(c, m[1])],
  [/^npm\s+(.+)$/i, (c, m) => S.npm(c, m[1])],
  [/^(?:pypi|pip)\s+(.+)$/i, (c, m) => S.pypi(c, m[1])],
  [/^(?:hn|hacker news)\s+(.+)$/i, (c, m) => S.hackernews(c, m[1])],
  [/^reddit\s+(.+)$/i, (c, m) => S.reddit(c, m[1])],
  [/^(?:wiki|wikipedia)\s+(.+)$/i, (c, m) => S.wiki(c, m[1])],
  [/^(?:search|google|look up|lookup)\s+(.+)$/i, (c, m) => universal(c, m[1])],

  // calculus & algebra (symbolic engine)
  [/^(?:plot|graph|draw|sketch|chart)\s+(?:the\s+)?(?:graph\s+of\s+)?(?:the\s+)?(?:function\s+|parabola\s+|curve\s+)?(?:y\s*=\s*|f\(x\)\s*=\s*)?(.+?)(?:\s+(?:from|for|over)\s+(?:([a-z])\s*=\s*)?(-?[^\s]+)\s+to\s+(-?[^\s]+))?$/i, (c, m) => runEngine(c, { op: 'plot', exprs: splitList(m[1]), var: m[2], a: m[3], b: m[4] }, 'Plot')],
  [/^(?:integrate|integral(?:\s+of)?|antiderivative(?:\s+of)?|∫)\s*(.+)$/i, (c, m) => {
    let s = m[1], a, b, v;
    const fr = /\s+from\s+(.+?)\s+to\s+(.+?)$/i.exec(s);
    if (fr) { a = fr[1]; b = fr[2]; s = s.slice(0, fr.index); }
    const dv = /\s*(?:d([a-z])|with respect to ([a-z])|wrt ([a-z]))\s*$/i.exec(s);
    if (dv) { v = dv[1] || dv[2] || dv[3]; s = s.slice(0, dv.index); }
    const fr2 = /\s+from\s+(.+?)\s+to\s+(.+?)$/i.exec(s);
    if (fr2) { a = fr2[1]; b = fr2[2]; s = s.slice(0, fr2.index); }
    return runEngine(c, { op: 'integrate', expr: s, var: v, a, b }, 'Integral');
  }],
  [/^(?:(first|second|third|fourth|fifth|\d+)(?:st|nd|rd|th)?\s+)?(?:derivative|differentiate|diff)(?:\s+of)?\s+(.+?)(?:\s+(?:with respect to|wrt|by)\s+([a-z]))?$/i, (c, m) => runEngine(c, { op: 'diff', expr: m[2], var: m[3], n: ordinal(m[1]) }, 'Derivative')],
  [/^d\/d([a-z])\s*(.+)$/i, (c, m) => runEngine(c, { op: 'diff', expr: m[2], var: m[1] }, 'Derivative')],
  [/^(?:limit|lim)(?:\s+of)?\s+(.+?)\s+(?:as|when)\s+([a-z])\s*(?:->|→|approaches|goes to|tends to|to)\s*(.+?)(?:\s+from the (left|right))?$/i, (c, m) => {
    let p = m[3].trim(), dir = m[4] ? (m[4] === 'right' ? '+' : '-') : '+-';
    if (/[+-]$/.test(p) && !/^[+-]?(oo|inf|infinity)$/i.test(p)) { dir = p.slice(-1); p = p.slice(0, -1); }
    return runEngine(c, { op: 'limit', expr: m[1], var: m[2], point: p, dir }, 'Limit');
  }],
  [/^(?:taylor|maclaurin|power)\s+(?:series|expansion|polynomial)?\s*(?:of\s+|for\s+)?(.+?)(?:\s+(?:at|around|about|near)\s+(?:([a-z])\s*=\s*)?([^\s]+))?(?:\s+(?:to|up to)?\s*(?:order|degree)\s+(\d+))?$/i, (c, m) => runEngine(c, { op: 'series', expr: m[1], var: m[2], point: m[3] || '0', n: m[4] ? +m[4] + 1 : 6 }, 'Series')],
  [/^series\s+(?:of\s+|for\s+)?(.+?)(?:\s+(?:at|around|about)\s+(?:([a-z])\s*=\s*)?([^\s]+))?$/i, (c, m) => runEngine(c, { op: 'series', expr: m[1], var: m[2], point: m[3] || '0' }, 'Series')],
  [/^(?:solve\s+|dsolve\s+|differential equation\s+|ode\s+)?(.*(?:\by'|\by\s*''|dy\s*\/\s*d[a-z]|d\^?2\s*y\s*\/\s*d[a-z]).*)$/i, (c, m) => runEngine(c, { op: 'ode', expr: m[1] }, 'Differential equation')],
  [/^(inverse laplace|laplace|inverse fourier|fourier)\s+(?:transform\s+)?(?:of\s+)?(.+)$/i, (c, m) => runEngine(c, { op: 'itransform', kind: m[1].toLowerCase(), expr: m[2] }, 'Transform')],
  [/^(?:balance\s+)?((?:\d*\s*[A-Z][\w()·.*]*\s*\+\s*)*\d*\s*[A-Z][\w()·.*]*\s*(?:->|→|=>|⟶|=)\s*(?:\d*\s*[A-Z][\w()·.*]*\s*\+\s*)*\d*\s*[A-Z][\w()·.*]*)$/, (c, m) => runEngine(c, { op: 'balance', expr: m[1] }, 'Chemistry')],
  [/^balance\s+(.+)$/i, (c, m) => runEngine(c, { op: 'balance', expr: m[1] }, 'Chemistry')],
  [/^(maximi[sz]e|minimi[sz]e|max(?:imum)?(?: value)? of|min(?:imum)?(?: value)? of|critical points of|extrema of|optimi[sz]e)\s+(.+?)(?:\s+(?:on|over|for)\s+\[?\s*(-?[^,\]\s]+)\s*(?:,|to|and)\s*(-?[^\]\s]+?)\s*\]?)?$/i, (c, m) => runEngine(c, { op: 'optimize', expr: m[2], a: m[3], b: m[4], goal: /max/i.test(m[1]) ? 'max' : /min/i.test(m[1]) ? 'min' : null }, 'Optimization')],
  [/^(?:fibonacci|fib)\s+(?:number\s+)?(\d+)$|^(\d+)(?:st|nd|rd|th)\s+fibonacci(?:\s+number)?$/i, (c, m) => runEngine(c, { op: 'nt', kind: 'fibonacci', n: m[1] || m[2] }, 'Number theory')],
  [/^(?:nth prime|prime number)\s+(\d+)$|^(?:the\s+)?(\d+)(?:st|nd|rd|th)\s+prime(?:\s+number)?$/i, (c, m) => runEngine(c, { op: 'nt', kind: 'prime', n: m[1] || m[2] }, 'Number theory')],
  [/^primes?\s+(?:between|from)\s+(\d+)\s+(?:and|to)\s+(\d+)$|^primes?\s+(?:up to|below|under|less than)\s+(\d+)$/i, (c, m) => runEngine(c, { op: 'nt', kind: 'primes', n: m[1] || '2', m: m[2] || m[3] }, 'Number theory')],
  [/^collatz\s+(?:sequence\s+)?(?:of\s+|for\s+)?(\d+)$/i, (c, m) => runEngine(c, { op: 'nt', kind: 'collatz', n: m[1] }, 'Number theory')],
  [/^(?:modular\s+)?inverse\s+of\s+(\d+)\s+mod(?:ulo)?\s+(\d+)$/i, (c, m) => runEngine(c, { op: 'nt', kind: 'modinv', n: m[1], m: m[2] }, 'Number theory')],
  [/^(?:totient|phi|euler'?s? totient)\s+(?:of\s+)?(\d+)$/i, (c, m) => runEngine(c, { op: 'nt', kind: 'totient', n: m[1] }, 'Number theory')],
  [/^(gcd|gcf|hcf|lcm|greatest common (?:divisor|factor)|least common multiple)\s+(?:of\s+)?([\d,\s]+(?:and\s+\d+)?)$/i, (c, m) => runEngine(c, { op: 'nt', kind: /lcm|least/i.test(m[1]) ? 'lcm' : 'gcd', list: m[2].replace(/and/g, ',') }, 'Number theory')],
  [/^(.+?)\s+to\s+(\d+)\s+(?:digits|decimal places|places|dp)$/i, (c, m) => runEngine(c, { op: 'digits', expr: m[1].replace(/^(?:the\s+)?/, ''), n: +m[2] }, 'Digits')],
  [/^(?:solve|roots of|zeros of|zeroes of|find (?:the )?roots of|find (?:the )?zeros of)\s+(.+?)(?:\s+for\s+([a-z](?:\s*,\s*[a-z])*))?$/i, (c, m) => runEngine(c, { op: 'solve', expr: m[1], vars: m[2] }, 'Solve')],
  [/^(factor|factorise|factorize|expand|simplify|partial fractions?(?:\s+of)?|apart|combine|together|rationali[sz]e|trig simplify)\s+(.+)$/i, (c, m, q) => {
    const k = m[1].toLowerCase();
    if (/^factor/.test(k) && /^\d+$/.test(m[2].trim())) return runEngine(c, { op: 'auto', expr: m[2] }, 'Number');
    const kind = /^factor/.test(k) ? 'factor' : k === 'expand' ? 'expand' : k === 'simplify' ? 'simplify' : /partial|apart/.test(k) ? 'apart' : /combine|together/.test(k) ? 'together' : /trig/.test(k) ? 'trigsimp' : 'rationalize';
    return runEngine(c, { op: 'transform', kind, expr: m[2] }, 'Algebra');
  }],
  [/^(sum|product|Σ|∏)\s+(?:of\s+)?(.+?)\s+(?:for|from|,)\s*([a-z])\s*=\s*(.+?)\s+(?:to|\.\.)\s+(.+)$/i, (c, m) => runEngine(c, { op: 'sum', expr: m[2], var: m[3], a: m[4], b: m[5], prod: /product|∏/i.test(m[1]) }, m[1].toLowerCase() === 'product' ? 'Product' : 'Sum')],
  [/^(?:determinant|det|inverse|eigenvalues|eigenvectors|rank|transpose|rref|matrix)\s+(?:of\s+)?(\[.+\])$/i, (c, m) => runEngine(c, { op: 'auto', expr: m[1] }, 'Matrix')],

  ...EXTRA_RULES.map(([re, fn]) => [re, (c, m, q) => fn(c, m, q, parseDate)]),

  // everyday computation
  [/^(?:mean|average|avg|median|mode|std|stdev|standard deviation|variance|range|stats|statistics|summary|describe|quartiles)\s+(?:of\s+)?([-\d.,\s]+)$/i, (c, m) => stats(c, m[1].split(/[,\s]+/).filter(Boolean).map(Number))],
  [/^(-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?){3,})$/, (c, m) => stats(c, m[1].split(/\s*,\s*/).map(Number))],
  [/^(.+?)\s+(?:in|to|into|as)\s+(binary|bin|hex|hexadecimal|octal|oct|decimal|dec|base\s*(\d+)|roman(?:\s+numerals?)?)$/i, (c, m) => baseConvert(c, m[1], m[2], m[3])],
  [/^(?:how many\s+)?days?\s+(?:until|till|til|to|before)\s+(.+)$/i, (c, m) => { const d = parseDate(m[1], { future: true }); if (!d) return false; return dateSpan(c, startOfDay(new Date()), d, 'Today', m[1]); }],
  [/^(?:how many\s+)?days?\s+(?:since|from)\s+(.+?)(?:\s+(?:to|until)\s+(.+))?$/i, (c, m) => { const a = parseDate(m[1]); const b = m[2] ? parseDate(m[2]) : startOfDay(new Date()); if (!a || !b) return false; return dateSpan(c, a, b, m[1], m[2] || 'today'); }],
  [/^(?:days|time|weeks|how long)\s+between\s+(.+?)\s+and\s+(.+)$/i, (c, m) => { const a = parseDate(m[1]), b = parseDate(m[2]); if (!a || !b) return false; return dateSpan(c, a, b, m[1], m[2]); }],
  [/^(.+?)\s*([+-])\s*(\d+)\s*(days?|weeks?|months?|years?)$/i, (c, m) => { const d = parseDate(m[1]); if (!d) return false; return dateShift(c, d, m[2], +m[3], m[4].toLowerCase(), m[1]); }],
  [/^(\d+)\s*(days?|weeks?|months?|years?)\s+(from|after|before|ago)(?:\s+(.+))?$/i, (c, m) => { const d = m[4] ? parseDate(m[4]) : startOfDay(new Date()); if (!d) return false; return dateShift(c, d, /before|ago/i.test(m[3]) ? '-' : '+', +m[1], m[2].toLowerCase(), m[4] || 'today'); }],
  [/^(?:what day (?:is|was|will be|of the week is|of the week was)|when is|date of)\s+(.+)$/i, (c, m) => { const d = parseDate(m[1], { future: !/was/i.test(m[0]) }); if (!d) return false; return dateInfo(c, d, m[1]); }],
  [/^(?:age|how old (?:is|am) (?:someone|i|a person))\s+(?:born\s+)?(?:on\s+|in\s+)?(.+)$/i, (c, m) => { const d = parseDate(m[1]); if (!d) return false; c.label('Age'); c.input(`Born ${longDate(d)}`); c.add({ title: 'Age', big: true, text: spanParts(d, startOfDay(new Date())), table: [['Days alive', fmt(Math.round((startOfDay(new Date()) - d) / DAY), 0)], ['Born on a', d.toLocaleDateString('en-US', { weekday: 'long' })]] }); }],
  [/^(?:what(?:'s| is) )?(?:today(?:'s date)?|the date(?: today)?|date)$/i, (c) => dateInfo(c, startOfDay(new Date()), 'Today')],
  [/^(?:random number|rand(?:om)?)(?:\s+(?:between|from)\s+(-?\d+)\s+(?:and|to)\s+(-?\d+))?$/i, (c, m) => { const a = +(m[1] ?? 1), b = +(m[2] ?? 100); c.label('Random'); c.input(`Random whole number from ${a} to ${b}`); c.add({ title: 'Result', big: true, text: String(a + rnd(b - a + 1)), note: 'From your browser’s cryptographic random generator.' }); }],
  [/^(?:flip|toss)\s+(?:a\s+)?coins?(?:\s+(\d+)\s+times)?$/i, (c, m) => { const n = Math.min(+(m[1] || 1), 1000); const r = Array.from({ length: n }, () => (rnd(2) ? 'Heads' : 'Tails')); c.label('Random'); c.input(`Flip ${n} coin${n > 1 ? 's' : ''}`); c.add({ title: 'Result', big: true, text: n === 1 ? r[0] : `${r.filter(x => x === 'Heads').length} heads, ${r.filter(x => x === 'Tails').length} tails` }); }],
  [/^roll\s+(?:a\s+)?(\d*)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?$|^roll\s+(?:a\s+)?(?:die|dice)$/i, (c, m) => { const n = Math.min(+(m[1] || 1), 100), s = +(m[2] || 6), mod = m[3] ? (m[3] === '-' ? -1 : 1) * +m[4] : 0; const r = Array.from({ length: n }, () => 1 + rnd(s)); c.label('Random'); c.input(`Roll ${n}d${s}${mod ? (mod > 0 ? '+' : '') + mod : ''}`); c.add({ title: 'Total', big: true, text: String(r.reduce((a, b) => a + b, 0) + mod), note: n > 1 ? `Rolls: ${r.join(', ')}` : undefined }); }],
  [/^(?:random\s+)?(?:password|passphrase)(?:\s+(\d+))?$/i, (c, m) => { const n = Math.min(Math.max(+(m[1] || 20), 6), 128); const set = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+'; const out = Array.from({ length: n }, () => set[rnd(set.length)]).join(''); c.label('Password'); c.input(`${n}-character password`); c.add({ title: 'Password', text: out, mono: true, big: true, note: `About ${Math.round(n * Math.log2(set.length))} bits of entropy. Generated in your browser and never sent anywhere.` }); }],
  [/^(?:uuid|guid)$/i, (c) => { c.label('UUID'); c.input('Random UUID v4'); c.add({ title: 'UUID', text: crypto.randomUUID(), mono: true, big: true }); }],
  [/^(?:pick|choose)\s+(?:one\s+)?(?:from|of|between)?\s*:?\s*(.+)$/i, (c, m) => { const opts = m[1].split(/\s*(?:,|\bor\b)\s*/i).filter(Boolean); if (opts.length < 2) return false; c.label('Random'); c.input(`Pick from ${opts.length} options`); c.add({ title: 'Picked', big: true, text: opts[rnd(opts.length)] }); }],
  [/^(sha1|sha-1|sha256|sha-256|sha384|sha-384|sha512|sha-512)\s+([\s\S]+)$/i, (c, m) => hash(c, m[1].replace('-', ''), m[2])],
  [/^base64\s+(encode|decode)\s+([\s\S]+)$/i, (c, m) => { c.label('Base64'); c.input(`Base64 ${m[1]}`); const out = m[1].toLowerCase() === 'encode' ? btoa(String.fromCharCode(...new TextEncoder().encode(m[2]))) : new TextDecoder().decode(Uint8Array.from(atob(m[2].trim()), ch => ch.charCodeAt(0))); c.add({ title: 'Result', text: out, mono: true }); }],
  [/^url\s+(encode|decode)\s+([\s\S]+)$/i, (c, m) => { c.label('URL'); c.input(`URL ${m[1]}`); c.add({ title: 'Result', text: m[1].toLowerCase() === 'encode' ? encodeURIComponent(m[2]) : decodeURIComponent(m[2]), mono: true }); }],
  [/^(?:word count|count words|character count|count characters|text stats)\s*(?:in|of|for)?\s*:?\s*([\s\S]+)$/i, (c, m) => textStats(c, m[1])],
  [/^(uppercase|lowercase|title case|reverse|slugify)\s+([\s\S]+)$/i, (c, m) => { const k = m[1].toLowerCase(), t = m[2]; const out = k === 'uppercase' ? t.toUpperCase() : k === 'lowercase' ? t.toLowerCase() : k === 'title case' ? t.toLowerCase().replace(/\b\w/g, x => x.toUpperCase()) : k === 'reverse' ? [...t].reverse().join('') : t.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-'); c.label('Text'); c.input(cap(k)); c.add({ title: 'Result', text: out }); }],
  [/^(?:colou?r\s+)?(#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/i, (c, m) => color(c, m[1])],
  [/^colou?r\s+([a-z]+)$/i, (c, m) => color(c, m[1])],
  [/^(?:unix\s+)?timestamp\s+(\d{9,13})$|^(\d{10}|\d{13})$/i, (c, m) => { const n = +(m[1] || m[2]); const d = new Date(n < 1e12 ? n * 1000 : n); c.label('Timestamp'); c.input(String(n)); c.add({ title: 'Date', big: true, text: d.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' }), table: [['UTC', d.toUTCString()], ['ISO', d.toISOString()]] }); }],
];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
function ordinal(s) { if (!s) return 1; const w = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 }[s.toLowerCase()]; return w || parseInt(s, 10) || 1; }
function splitList(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s.replace(/\s+and\s+/gi, ',')) { if ('([{'.includes(ch)) depth++; if (')]}'.includes(ch)) depth--; if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

const QUESTION = /^(?:what(?:'s| is| are| was| were)|whats|calculate|compute|evaluate|how much is|find|tell me|show me|give me|=)\s+(?:the\s+)?/i;
const WHO = /^(?:who|what|where)\s+(?:is|are|was|were)\s+(.+)$/i;

const NUMWORD = /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|thousand|twice|half|double|triple|dozen)\b/i;
const NUMWORD_G = new RegExp(NUMWORD.source, "gi");
function looksLikeWordProblem(raw) {
  const t = raw.trim();
  const wc = t.split(/\s+/).length;
  if (wc < 6 || t.length > 1500) return false;
  if (!/\d/.test(t) && !NUMWORD.test(t)) return false;
  if (/^(?:py|python)\s*[:>]/i.test(t)) return false;
  // Stories and articles aren't word problems: lots of sentences, dialogue, few numbers.
  const sents = (t.match(/[.!?](?:\s|$)/g) || []).length;
  const digits = (t.match(/\d+(?:\.\d+)?/g) || []).length;
  if ((t.length > 420 && sents >= 5) || (/[“"].+[”"]/.test(t) && sents >= 4)) return false;
  if (digits === 0 && (t.match(NUMWORD_G) || []).length < 2) return false;
  return /\?|\b(?:how (?:many|much|far|long|fast|high|tall|old)|what (?:is|was|will|are)|find|calculate|determine|compute|solve|work out)\b/i.test(t) || (wc >= 8 && digits >= 2) || /\b(?:invested|compounded|interest|discount|tax|percent|%)/i.test(t);
}

async function tryWordProblem(ctx, raw) {
  const wait = Engine.ready ? null : ctx.add({ title: 'Working', text: 'Loading the math engine (about 10 seconds the first time)…', loading: true });
  let out;
  try { out = await Engine.call({ op: 'wordproblem', text: raw.trim() }); } catch (_) { out = null; } finally { if (wait) wait.remove(); }
  if (!out || !out.ok || out.notunderstood || !out.pods.length) { ctx.wpMiss = raw.trim(); return false; }
  ctx.label(out.label || 'Word problem');
  ctx.input(out.interp || '');
  out.pods.forEach(p => ctx.add(p));
  ctx.add({ title: 'How this was solved', note: 'Rule-based: I picked out the numbers, units and keywords, matched them to a formula or equation, and solved it exactly. Read the “What I found” part to make sure I understood the problem the way you meant it.' });
  return true;
}

// ---------- cleaning up pasted math ----------
// Symbols copied from PDFs, Google Docs and phones → plain math the engine reads.
const UNI = [[/[÷]/g, '/'], [/[×✕⋅·]/g, '*'], [/[−–—]/g, '-'], [/≤/g, '<='], [/≥/g, '>='], [/≠/g, '!='], [/π/g, 'pi'], [/∞/g, 'oo'],
  [/½/g, '(1/2)'], [/⅓/g, '(1/3)'], [/⅔/g, '(2/3)'], [/¼/g, '(1/4)'], [/¾/g, '(3/4)'], [/⅕/g, '(1/5)'], [/⅛/g, '(1/8)'],
  [/²/g, '^2'], [/³/g, '^3'], [/⁴/g, '^4'], [/⁻¹/g, '^(-1)'], [/[“”]/g, '"'], [/[‘’]/g, "'"],
  [/√\s*\(([^()]*)\)/g, 'sqrt($1)'], [/√\s*([A-Za-z0-9.]+)/g, 'sqrt($1)'], [/∛\s*([A-Za-z0-9.]+)/g, 'cbrt($1)']];
function normalizeMath(t) { for (const [re, rep] of UNI) t = t.replace(re, rep); return t; }

// LaTeX pasted from a worksheet or Overleaf → the plain syntax the router understands.
function latexToPlain(t) {
  if (!/\\[a-zA-Z]+|\$[^$]+\$/.test(t)) return t;
  let s = t.replace(/\$\$?/g, ' ').replace(/\\left|\\right|\\displaystyle|\\,|\;|\\!|\\quad/g, ' ');
  const brace = String.raw`\{((?:[^{}]|\{[^{}]*\})*)\}`;
  for (let i = 0; i < 6; i++) {
    s = s.replace(new RegExp(String.raw`\\[dt]?frac\s*` + brace + String.raw`\s*` + brace, 'g'), '(($1)/($2))')
         .replace(new RegExp(String.raw`\\sqrt\s*\[(\d+)\]\s*` + brace, 'g'), '(($2)^(1/$1))')
         .replace(new RegExp(String.raw`\\sqrt\s*` + brace, 'g'), 'sqrt($1)')
         .replace(new RegExp(String.raw`\^\s*` + brace, 'g'), '^($1)')
         .replace(new RegExp(String.raw`_\s*` + brace, 'g'), '_$1');
  }
  s = s.replace(/\(\(d\)\/\(d([a-z])\)\)\s*/g, 'derivative wrt $1 of ')
       .replace(/\\int_?\{?([^}\s^]*)\}?\^?\{?([^}\s]*)\}?\s*(.+?)\s*\\?,?\s*d([a-z])\b/g, (m, a, b, f, v) => a && b ? `integrate ${f} from ${a} to ${b}` : `integrate ${f} d${v}`)
       .replace(/\\lim_?\{?\s*([a-z])\s*\\to\s*([^}\s]+)\}?\s*(.+)/g, 'limit of $3 as $1 -> $2')
       .replace(/\\sum_?\{?([a-z])\s*=\s*([^}\s]+)\}?\^\{?([^}\s]+)\}?\s*(.+)/g, 'sum $4 for $1 from $2 to $3')
       .replace(/\\(?:cdot|times)/g, '*').replace(/\\div/g, '/').replace(/\\pm/g, '+-').replace(/\\leq?/g, '<=').replace(/\\geq?/g, '>=').replace(/\\neq/g, '!=')
       .replace(/\\(sin|cos|tan|sec|csc|cot|ln|log|exp|arcsin|arccos|arctan|sinh|cosh|tanh)\b/g, '$1').replace(/\\pi\b/g, 'pi').replace(/\\infty/g, 'oo').replace(/\\theta/g, 'theta').replace(/\\alpha/g, 'alpha')
       .replace(/[{}]/g, m => (m === '{' ? '(' : ')')).replace(/\\/g, ' ');
  s = s.replace(/derivative wrt x of /, 'derivative of ').replace(/\s+/g, ' ').trim();
  return s;
}

// Lines broken in the middle of an equation ("4x - 7 =\n2x + 9") are glued back together.
function joinBroken(t) { return t.replace(/([=+\-*/^(,])[ \t]*\n\s*/g, '$1 ').replace(/\n[ \t]*(?=[=+*/^)])/g, ' '); }

// "Solve for x: ..." / "Simplify:" → "solve ... for x"
function tidyCommand(q) {
  return q.replace(/^\s*(solve|simplify|factor|factorise|factorize|evaluate|expand|compute|calculate|differentiate|integrate|graph|plot)\s+for\s+([a-z])\s*[:,]\s*(.+)$/i, '$1 $3 for $2')
          .replace(/^\s*(solve|simplify|factor|factorise|factorize|evaluate|expand|compute|calculate|differentiate|integrate|graph|plot|find)\s*:\s*/i, '$1 ');
}

const NUM_ITEM = /^\s*(?:\(?\d{1,2}[.)]|q\s?\d{1,2}[.:)]?|problem\s+\d{1,2}[.:)]?|question\s+\d{1,2}[.:)]?|#\d{1,2})\s+/i;
const LET_ITEM = /^\s*\(?([a-h]|i{1,3}|iv|v)[.)]\s+/i;
const ITEM = new RegExp(`${NUM_ITEM.source}|${LET_ITEM.source}`, 'i');
const IMPERATIVE = /^\s*(?:solve|simplify|factor|factorise|factorize|expand|evaluate|find|compute|calculate|differentiate|integrate|graph|plot|sketch|convert|what is|how many|how much|determine|write|prove|show that|derivative|integral|limit)\b/i;

// Turn a sub-part ("a) find the roots") into a full question using its stem ("For f(x) = x^2 - 4x + 3:").
function withStem(stem, sub) {
  const fm = /([a-zA-Z])\s*\(\s*([a-z])\s*\)\s*=\s*([^:;]+?)\s*[:.;,]?\s*$/.exec(stem);
  const eqm = !fm && /(?:^|for|given|let|if)\s*([^:]*[=<>][^:]*?)\s*:?\s*$/i.exec(stem);
  const expr = fm ? fm[3] : null;
  if (expr) {
    if (new RegExp(`\\b${fm[1]}\\s*\\(\\s*(-?[\\d.]+)\\s*\\)`).test(sub)) return sub.replace(new RegExp(`\\b${fm[1]}\\s*\\(\\s*(-?[\\d.]+)\\s*\\)`, 'g'), `(${expr}) at ${fm[2]} = $1`).replace(/^(?:find|what is|compute|calculate)\s+/i, 'evaluate ');
    let r = sub.replace(/\b(?:the function|the graph|f\(x\)|it)\b(?!\s+of)/gi, m => (/graph/i.test(m) ? 'graph' : expr));
    if (r === sub || !r.includes(expr)) r = `${sub.replace(/[.?]$/, '')} of ${expr}`;
    return r;
  }
  if (eqm) return `${sub.replace(/[.?]$/, '')}: ${eqm[1]}`;
  return `${stem.replace(/[:.]$/, '')}. ${sub}`;
}

function splitHomework(raw) {
  const lines = joinBroken(raw).split(/\n/);
  const items = [];          // {text, subs: []}
  let header = '';
  for (const line of lines) {
    const tl = line.trim();
    if (!tl) continue;
    const isNum = NUM_ITEM.test(line), isLet = LET_ITEM.test(line);
    if (isNum) items.push({ text: line.replace(NUM_ITEM, '').trim(), subs: [] });
    else if (isLet && items.length) items[items.length - 1].subs.push(line.replace(LET_ITEM, '').trim());
    else if (isLet) items.push({ text: line.replace(LET_ITEM, '').trim(), subs: [] });
    else if (items.length) {
      const last = items[items.length - 1];
      if (last.subs.length) last.subs[last.subs.length - 1] += ' ' + tl; else last.text += ' ' + tl;
    } else header += (header ? ' ' : '') + tl;
  }
  let out = [];
  for (const it of items) {
    if (it.subs.length) out.push(...it.subs.map(sb => withStem(it.text, sb)));
    else out.push(it.text);
  }
  if (out.filter(Boolean).length < 2) {
    // No numbering: problems separated by blank lines, or one per line starting with a command.
    const blocks = joinBroken(raw).split(/\n\s*\n/).map(b => b.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
    const perLine = joinBroken(raw).split(/\n/).map(l => l.trim()).filter(Boolean);
    if (blocks.length >= 2 && blocks.every(b => b.length < 300 && (IMPERATIVE.test(b) || (b.match(/[.!?](\s|$)/g) || []).length <= 3))) { out = blocks; header = ''; }
    else if (perLine.length >= 2 && perLine.length <= 30 && perLine.every(l => IMPERATIVE.test(l) || (mathy(l) && l.length < 120))) { out = perLine; header = ''; }
    else return null;
    // a leading instruction line ("Show your work.") isn't a problem
    if (out.length > 2 && !IMPERATIVE.test(out[0]) && !mathy(out[0]) && !/\d/.test(out[0])) { header = out.shift(); }
  }
  out = out.filter(Boolean);
  if (out.length < 2) return null;
  out.header = header;
  return out;
}

let lastQ = null;
const FOLLOW = /^(?:and|what about|how about|and what about|same for|and for|what of|now)\s+(?:for\s+|in\s+)?(.+?)\??$/i;
function followUp(q) {
  const m = FOLLOW.exec(q);
  if (!m || !lastQ || m[1].split(/\s+/).length > 5) return null;
  const x = m[1].trim();
  let r = lastQ.replace(/\b(of|in|for|at|about|on|from)\s+([^,?]+?)(\s+(?:in|on|at|for|from|to)\s+[^,?]+)?\??$/i, (all, prep, obj, tail) => `${prep} ${x}${tail || ''}`);
  if (r === lastQ) { const caps = lastQ.match(/\b[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*)*/g); if (caps && caps.length) { const last = caps[caps.length - 1]; const i = lastQ.lastIndexOf(last); r = lastQ.slice(0, i) + x + lastQ.slice(i + last.length); } }
  if (r === lastQ) r = `${lastQ} ${x}`;
  return r;
}
const TYPOS = { teh: 'the', hte: 'the', waht: 'what', wat: 'what', whta: 'what', hwo: 'how', woh: 'who', adn: 'and', nad: 'and', taht: 'that', thsi: 'this', ot: 'to', fo: 'of', si: 'is', wehre: 'where', whre: 'where', wher: 'where', whne: 'when', becuase: 'because', recieve: 'receive', definately: 'definitely', seperate: 'separate', untill: 'until', wich: 'which', thier: 'their', goverment: 'government', enviroment: 'environment', populaton: 'population', popluation: 'population', captial: 'capital', calender: 'calendar' };
async function spellSuggest(q, { strict = false } = {}) {
  let fixed = q.split(/(\s+)/).map(w => TYPOS[w.toLowerCase()] || w).join('');
  try { fixed = (await spellCorrect(fixed, { strict })).text; } catch (_) {}
  if (strict) return fixed.toLowerCase() !== q.toLowerCase() ? fixed : null;
  for (let i = 0; i < 3; i++) { const n = await wikiSuggest(fixed); if (!n || n === fixed.toLowerCase()) break; fixed = n; }
  return fixed.toLowerCase() !== q.toLowerCase() ? fixed : null;
}
async function wikiSuggest(q) {
  if (q.split(/\s+/).length < 2 || mathy(q) || /\d{3,}|https?:/.test(q) || q.length > 120) return null;
  try {
    const r = await S.get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc(q)}&srinfo=suggestion&srlimit=1&format=json&origin=*`);
    const sug = r.query && r.query.searchinfo && r.query.searchinfo.suggestion;
    if (!sug || sug.toLowerCase() === q.toLowerCase()) return null;
    const a = q.toLowerCase().split(/\s+/), b = sug.toLowerCase().split(/\s+/);
    return a.length === b.length ? sug : null;
  } catch (_) { return null; }
}

async function route(ctx, raw, opts = {}) {
  raw = normalizeMath(raw);
  if (/\\[a-zA-Z]+/.test(raw) && raw.length < 600) raw = latexToPlain(raw);
  let q = raw.trim();
  // A pasted list of problems: answer each one on its own card.
  const hw = raw.includes('\n') ? splitHomework(raw) : null;
  if (hw && hw.length <= 30) {
    ctx.label('Homework');
    ctx.input(`${hw.length} problems, each answered below`);
    const rnd = /round(?:ed)? to the nearest (tenth|hundredth|thousandth|whole number|integer)/i.exec(hw.header || '');
    ctx.add({ title: 'Problems', numbered: hw, note: 'Each problem gets its own answer card below this one, in order.' + (hw.header ? ` Instructions noted: “${hw.header}”` : '') + (rnd ? ` Round answers to the nearest ${rnd[1]} yourself from the decimals shown.` : '') });
    askMany(hw);
    return 'file';
  }
  q = joinBroken(q);
  if (!/^(?:py|python)\s*[:>]/i.test(q)) q = q.replace(/\s+/g, ' ').replace(/\?+$/, '').replace(/([A-Za-z]{2,})[.!]+$/, '$1').trim();
  q = tidyCommand(q);
  const fu = followUp(q);
  if (fu) { lastQ = fu; ctx.input(`Following up: ${fu}`); ctx.add({ title: 'Read as', text: fu, note: `Built from your last question, “${lastQ}”.` }); return route(ctx, fu, opts); }
  if (!q) return;
  const noFiles = /^web\s*:\s*/i.test(q);
  if (noFiles) q = q.replace(/^web\s*:\s*/i, '');
  if (!noFiles && F.hasDocs() && await F.fileCommand(ctx, q)) return 'file';
  if (looksLikeWordProblem(raw) && !mathy(q) && !/^(?:summari[sz]e|analy[sz]e|explain|translate|define|py|papers?|search|dork|cite)\b/i.test(q) && await tryWordProblem(ctx, raw)) return;
  // Long pasted prose with no specific request: analyse it and keep it as context.
  if (raw.length > 280 && (raw.match(/[.!?](\s|$)/g) || []).length >= 3 && !mathy(q) && !/^(?:py|python)\s*[:>]/i.test(q)) { F.analyzeText(ctx, raw.trim()); return 'file'; }
  // A question your own files clearly answer: show that first, then add web facts if they come.
  if (!noFiles && F.strongAnswer(q)) {
    F.fileContext(ctx, q); ctx.label('Your files'); ctx.input(q);
    ctx.add({ title: 'Not what you meant?', buttons: [{ label: 'Answer without my files', query: `web: ${q}` }, ...engineButtons(q).slice(0, 2)] });
    return 'file';
  }
  if (await tryRules(ctx, q)) return;
  // "what is the derivative of x^2" → try again without the question words
  if (QUESTION.test(q)) {
    const rest = q.replace(QUESTION, '');
    if (await tryRules(ctx, rest)) return;
    if (mathy(rest) && await tryMath(ctx, rest)) return;
  }
  if (mathy(q) && await tryMath(ctx, q)) return;
  // Nothing matched: maybe a typo. Clear one-letter slips are fixed offline first.
  if (!opts.corrected && !(F.hasDocs() && !noFiles)) {
    const sug = await spellSuggest(q, { strict: true });
    if (sug) { ctx.add({ title: 'Spelling', text: `Showing results for “${sug}”`, buttons: [{ label: `Search for “${q}” instead`, query: `web: ${q}` }] }); return route(ctx, sug, { corrected: true }); }
  }
  // Nothing specific matched: if the user has files loaded, their own documents come first.
  const fromFiles = !noFiles && F.hasDocs() && F.fileContext(ctx, q);
  if (fromFiles) { ctx.label('Your files'); ctx.input(q); }
  const done = (v) => (fromFiles ? 'file' : v);
  const who = WHO.exec(q);
  if (who && !mathy(who[1])) { try { await S.wiki(ctx, who[1].replace(/^(?:the|a|an)\s+/i, '')); return done(); } catch (_) {} }
  if (/^[A-Za-z]/.test(q) && q.split(' ').length <= 4 && !/\d/.test(q) && !/^(?:how|why|when|which|can|could|should|would|will|does|do|did|is|are|was|were|has|have)\b/i.test(q)) {
    // Short phrases ("ada lovelace", "photosynthesis") read best as an encyclopedia entry.
    try { await S.wiki(ctx, q); ctx.add({ title: 'Not what you meant?', buttons: [{ label: 'Search everywhere', query: `search ${q}` }, ...engineButtons(q).slice(0, 3)] }); return done(); } catch (_) {}
  }
  // A word problem none of the solvers could set up: say so plainly and show what was found,
  // rather than unrelated web results.
  if (!opts.corrected && !fromFiles && !ctx.wpMiss) {
    const sug = await spellSuggest(q);
    if (sug) { ctx.add({ title: 'Spelling', text: `Showing results for “${sug}”`, buttons: [{ label: `Search for “${q}” instead`, query: `web: ${q}` }] }); return route(ctx, sug, { corrected: true }); }
  }
  if (ctx.wpMiss && !fromFiles && (ctx.wpMiss.match(/\d+(?:\.\d+)?/g) || []).length >= 2 && ctx.wpMiss.split(/\s+/).length >= 10 && !/^(?:who|when|where)\b/i.test(ctx.wpMiss)) { wordProblemMiss(ctx, ctx.wpMiss); return; }
  await universal(ctx, q, fromFiles);
  return done();
}

function wordProblemMiss(ctx, text) {
  ctx.label('Word problem');
  ctx.input('Couldn’t set this one up automatically');
  const nums = [...text.matchAll(/(\$\s?)?(\d[\d,]*(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(%|[a-zA-Z/²³°]+(?:\s+(?:per|an?)\s+[a-z]+)?)?/g)].map(m => `${m[1] || ''}${m[2]}${m[3] && !/^(?:and|or|the|a|an|of|to|in|is|are|was|with|for|if|then|but)$/i.test(m[3]) ? ' ' + m[3] : ''}`);
  const qm = /[^.?!]*\?\s*$/.exec(text) || /(?:^|[.!]\s+)((?:find|what|how|determine|calculate)[^.?!]*)[.?!]?\s*$/i.exec(text);
  ctx.add({ title: 'What I found', table: [['Numbers', nums.join(' · ') || 'none'], ['Question', qm ? (qm[1] || qm[0]).trim() : 'not sure']] });
  ctx.add({ title: 'Ways to get an answer', numbered: [
    'Write the equation yourself, using a letter for each unknown, e.g. “solve 8a + 5k = 780, a + k = 120”. I solve it exactly and show steps.',
    'Or split it into steps: ask each smaller calculation on its own line.',
    'Or rephrase using common wording: “X is 3 more than twice Y”, “together they have 40”, “at 60 mph for 2 hours”.'],
    note: 'Word problems are solved by matching known patterns (rates, ages, mixtures, money, geometry, “more than / times as many”). This one didn’t fit any of them closely enough to trust an answer.' });
  ctx.add({ title: 'Search for a worked example', buttons: engineButtons(text.slice(0, 200)).slice(0, 3) });
}

async function tryRules(ctx, q) {
  for (const [re, fn] of RULES) {
    const m = re.exec(q);
    if (!m) continue;
    const res = await fn(ctx, m, q);
    if (res !== false) return true;
  }
  return false;
}

// ============================================================
// Cards & pods
// ============================================================
function linkBtn(label, url) { const a = h('a', 'btn-sm', label); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
function queryBtn(label, q) { const b = h('button', 'btn-sm', label); b.type = 'button'; b.onclick = () => ask(q); return b; }
const okUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);

function copyBtn(getText, label = 'Copy') {
  const b = h('button', 'icon-btn', label); b.type = 'button';
  b.onclick = async () => { try { await navigator.clipboard.writeText(getText()); b.textContent = 'Copied'; setTimeout(() => (b.textContent = label), 1400); } catch (_) {} };
  return b;
}

function newCard(q) {
  const card = h('article', 'card');
  const head = h('header', 'card-head');
  const top = h('div', 'card-top');
  const tag = h('span', 'tag'); tag.hidden = true;
  const qEl = h('h2', 'card-q', q.length > 160 ? q.slice(0, 160) + '…' : q);
  const acts = h('div', 'card-acts');
  const share = h('button', 'icon-btn', 'Share'); share.type = 'button';
  share.onclick = async () => { const url = `${location.origin}${location.pathname}?q=${enc(q)}`; try { await navigator.clipboard.writeText(url); share.textContent = 'Link copied'; setTimeout(() => (share.textContent = 'Share'), 1500); } catch (_) { prompt('Copy this link', url); } };
  const again = h('button', 'icon-btn', 'Edit'); again.type = 'button'; again.onclick = () => { input.value = q; autosize(); input.focus(); };
  const close = h('button', 'icon-btn', '×'); close.type = 'button'; close.title = 'Remove'; close.onclick = () => card.remove();
  acts.append(share, again, close);
  top.append(tag, acts);
  const interp = h('div', 'interp');
  head.append(top, qEl, interp);
  const body = h('div', 'pods');
  const foot = h('footer', 'card-foot');
  card.append(head, body, foot);
  feed.prepend(card);

  const makeCtx = (container) => ({
    label(t) { tag.textContent = t; tag.hidden = false; },
    input(t) { interp.textContent = t ? `Interpreted as: ${t}` : ''; },
    inputTex(tex) { interp.replaceChildren(h('span', null, 'Interpreted as: ')); const k = h('span'); renderTex(k, tex, false); interp.append(k); },
    add(p) {
      const node = renderPod(p);
      container.append(node);
      return { node, remove() { node.remove(); } };
    },
    slot() { const d = h('div', 'slot'); container.append(d); return makeCtx(d); },
    source(name, url) {
      foot.replaceChildren(h('span', null, 'Source: '));
      if (okUrl(url)) foot.append(linkBtn(name, url)); else foot.append(h('span', null, name));
    },
  });
  return { card, ctx: makeCtx(body), body };
}

function renderTex(el, tex, display = true) {
  try { katex.render(tex, el, { throwOnError: false, displayMode: display, maxSize: 20, maxExpand: 500 }); } catch (_) { el.textContent = tex; }
}

function cellNode(v) {
  if (v && typeof v === 'object' && v.text != null) { if (okUrl(v.url)) return linkBtn(v.text, v.url); return h('span', null, v.text); }
  return h('span', null, v == null ? '' : String(v));
}

function renderPod(p) {
  const sec = h('section', 'pod');
  if (p.big) sec.classList.add('big');
  if (p.error) sec.classList.add('err');
  if (p.warn) sec.classList.add('warn');
  if (p.loading) sec.classList.add('loading');
  const head = h('div', 'pod-head');
  head.append(h('h3', null, p.title || ''));
  const acts = h('div', 'pod-acts');
  if (p.text && !p.loading) acts.append(copyBtn(() => p.text));
  if (p.latex) acts.append(copyBtn(() => p.latex, 'LaTeX'));
  if (p.pre && typeof p.pre === 'string') acts.append(copyBtn(() => p.pre));
  head.append(acts);
  sec.append(head);
  const body = h('div', 'pod-body');
  sec.append(body);

  let main = body;
  if (p.image && p.imageSide) { const row = h('div', 'side'); main = h('div', 'side-main'); const im = h('img', 'side-img'); im.src = p.image; im.alt = p.title || ''; im.loading = 'lazy'; row.append(main, im); body.append(row); }
  if (p.swatch) { const sw = h('div', 'swatch'); sw.style.background = p.swatch; main.append(sw); }
  if (p.latex) { const k = h('div', 'tex'); renderTex(k, p.latex); main.append(k); }
  else if (p.text != null && p.text !== '') {
    const t = h(p.pre === true || p.mono ? 'pre' : 'p', p.big ? 'big-text' : 'text', p.text);
    if (p.mono) t.classList.add('mono');
    main.append(t);
  }
  if (typeof p.pre === 'string') main.append(h('pre', p.error ? 'pre err-pre' : 'pre', p.pre));
  if (p.image && !p.imageSide) { const im = h('img', 'pod-img'); im.src = p.image; im.alt = p.title || ''; main.append(im); }
  if (p.audio) { const a = h('audio'); a.controls = true; a.preload = 'none'; a.src = p.audio; main.append(a); }
  if (p.table) main.append(renderTable(p));
  if (p.numbered) { const ol = h('ol', 'numbered'); p.numbered.forEach(x => ol.append(h('li', null, x))); main.append(ol); }
  if (p.list) main.append(renderList(p.list));
  if (p.chips) { const box = h('div', 'chips'); p.chips.forEach(x => box.append(queryBtn(x.length > 60 ? x.split('\n')[0] + ' …' : x, x))); main.append(box); }
  if (p.buttons) { const box = h('div', 'btns'); p.buttons.forEach(b => box.append(b.query ? queryBtn(b.label, b.query) : okUrl(b.url) ? linkBtn(b.label, b.url) : h('span'))); main.append(box); }
  if (p.links && p.links.length) { const box = h('div', 'links'); p.links.forEach(b => box.append(b.query ? queryBtn(b.label, b.query) : okUrl(b.url) ? linkBtn(b.label, b.url) : h('span'))); main.append(box); }
  if (p.iframe && /^https:\/\/www\.openstreetmap\.org\/export\/embed\.html/.test(p.iframe)) { const f = h('iframe', 'map'); f.src = p.iframe; f.loading = 'lazy'; f.title = 'Map'; f.referrerPolicy = 'no-referrer'; main.append(f); }
  if (p.plot) { const box = h('div', 'plot'); main.append(box); drawPlot(box, p.plot); }
  if (p.custom) p.custom(main);
  if (p.steps && p.steps.length) {
    const d = h('details', 'steps');
    d.append(h('summary', null, `Step-by-step (${p.steps.length} step${p.steps.length > 1 ? 's' : ''})`));
    const ol = h('ol');
    for (const s of p.steps) { const li = h('li'); li.append(h('div', 'rule', s.rule)); const k = h('div', 'tex'); renderTex(k, s.latex); li.append(k); ol.append(li); }
    d.append(ol);
    main.append(d);
  }
  if (p.note) main.append(h('p', 'note', p.note));
  if (p.source && okUrl(p.source.url)) { const s = h('p', 'note'); s.append('Source: ', linkBtn(p.source.name, p.source.url)); main.append(s); }
  return sec;
}

function renderTable(p) {
  const t = h('table', 'tbl');
  const data = Array.isArray(p.table) ? { rows: p.table } : p.table;
  if (data.head) { const tr = h('tr'); data.head.forEach(x => tr.append(h('th', null, x))); const th = h('thead'); th.append(tr); t.append(th); }
  else t.classList.add('kv');
  const tb = h('tbody');
  for (const row of data.rows) {
    const tr = h('tr');
    row.forEach((cell, i) => {
      const td = h(i === 0 && !data.head ? 'th' : 'td');
      const node = cellNode(cell);
      if (p.copyRows && i === 1) { const pre = h('pre', 'cite', String(cell)); td.append(pre, copyBtn(() => String(cell))); }
      else td.append(node);
      tr.append(td);
    });
    tb.append(tr);
  }
  t.append(tb);
  const wrap = h('div', 'tbl-wrap'); wrap.append(t);
  return wrap;
}

function renderList(items) {
  const ul = h('ul', 'results');
  for (const it of items) {
    const li = h('li');
    if (it.thumb && okUrl(it.thumb)) { const im = h('img', 'thumb'); im.src = it.thumb; im.alt = ''; im.loading = 'lazy'; li.append(im); li.classList.add('has-thumb'); }
    const box = h('div', 'res');
    const title = it.query ? queryBtn(it.title || '(untitled)', it.query) : okUrl(it.url) ? linkBtn(it.title || '(untitled)', it.url) : h('strong', null, it.title || '');
    title.classList.add('res-title');
    box.append(title);
    if (it.meta) box.append(h('div', 'res-meta', it.meta));
    if (it.snippet) box.append(h('div', 'res-snip', it.snippet));
    if (it.audio) { const a = h('audio'); a.controls = true; a.preload = 'none'; a.src = it.audio; box.append(a); }
    if (it.actions && it.actions.length) { const r = h('div', 'res-acts'); it.actions.forEach(a => r.append(a.query ? queryBtn(a.label, a.query) : okUrl(a.url) ? linkBtn(a.label, a.url) : h('span'))); box.append(r); }
    li.append(box);
    ul.append(li);
  }
  return ul;
}

// ============================================================
// Plots (Plotly, loaded on first use)
// ============================================================
let plotlyP = null;
function loadPlotly() {
  if (!plotlyP) plotlyP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/plotly.min.js'; s.onload = res; s.onerror = () => rej(new Error('Couldn’t load the graphing library.')); document.head.append(s); });
  return plotlyP;
}
const PAL = ['#2f5d50', '#c2410c', '#2563eb', '#a21caf', '#ca8a04', '#0891b2'];
function robustRange(ys) {
  const v = ys.flat().filter(y => y != null && isFinite(y)).sort((a, b) => a - b);
  if (!v.length) return undefined;
  const lo = v[Math.floor(v.length * 0.02)], hi = v[Math.ceil(v.length * 0.98) - 1];
  const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.2 || 1;
  return [lo - pad, hi + pad];
}

async function drawPlot(box, pl) {
  box.textContent = 'Drawing…';
  try { await loadPlotly(); } catch (e) { box.textContent = e.message; return; }
  box.textContent = '';
  const font = { family: 'Inter, system-ui, sans-serif', size: 12, color: '#3b3a36' };
  const base = { margin: { l: 52, r: 16, t: 10, b: 40 }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font, showlegend: false, hovermode: 'closest', dragmode: 'pan' };
  const ax = { gridcolor: '#ebe7df', zerolinecolor: '#b8b2a6', linecolor: '#d8d3c8' };
  const cfg = { responsive: true, displaylogo: false, scrollZoom: true, modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'] };
  let data = [], layout = { ...base };
  if (pl.kind === '2d') {
    data = pl.traces.map((t, i) => ({ x: t.x, y: t.y, name: t.name, type: 'scatter', mode: 'lines', line: { color: PAL[i % PAL.length], width: 2.4 }, connectgaps: false, hovertemplate: `${pl.xlabel} = %{x:.4g}<br>%{y:.6g}<extra>${(t.text || '').slice(0, 40)}</extra>` }));
    if (pl.shade) { const t = pl.traces[0]; const xs = [], ys = []; t.x.forEach((x, i) => { if (x >= pl.shade[0] && x <= pl.shade[1] && t.y[i] != null) { xs.push(x); ys.push(t.y[i]); } }); data.unshift({ x: xs, y: ys, type: 'scatter', mode: 'lines', fill: 'tozeroy', fillcolor: 'rgba(47,93,80,0.18)', line: { width: 0 }, hoverinfo: 'skip' }); }
    if (pl.points && pl.points.x.length) data.push({ x: pl.points.x, y: pl.points.y, type: 'scatter', mode: 'markers', marker: { color: '#c2410c', size: 9 }, hovertemplate: '(%{x:.6g}, %{y:.6g})<extra></extra>' });
    if (pl.roots && pl.roots.length) data.push({ x: pl.roots, y: pl.roots.map(() => 0), type: 'scatter', mode: 'markers', marker: { color: '#c2410c', size: 8 }, name: 'roots', hovertemplate: 'root %{x:.8g}<extra></extra>' });
    layout = { ...base, showlegend: pl.traces.length > 1, legend: { orientation: 'h', y: 1.12 }, xaxis: { ...ax, title: pl.xlabel }, yaxis: { ...ax, range: robustRange(pl.traces.map(t => t.y)) } };
  } else if (pl.kind === '3d') {
    data = [{ type: 'surface', x: pl.x, y: pl.y, z: pl.z, colorscale: [[0, '#1f3d35'], [0.5, '#6fa595'], [1, '#f4e3c3']], showscale: false, contours: { z: { show: true, usecolormap: true, project: { z: true } } } }];
    layout = { ...base, margin: { l: 0, r: 0, t: 0, b: 0 }, scene: { xaxis: { title: pl.xlabel }, yaxis: { title: pl.ylabel }, zaxis: { title: '' } } };
    box.classList.add('tall');
  } else if (pl.kind === 'line') {
    data = pl.traces.map((t, i) => {
      if (pl.bars) return { x: t.x, y: t.y, name: t.name, type: 'bar', marker: { color: PAL[i % PAL.length] } };
      const tr = { x: t.x, y: t.y, name: t.name, type: 'scatter', mode: t.markers ? 'markers' : 'lines', line: { color: t.fill ? 'rgba(0,0,0,0)' : PAL[i % PAL.length], width: 2.2, dash: t.dash ? 'dot' : 'solid' } };
      if (t.yaxis) tr.yaxis = t.yaxis;
      if (t.fill) { tr.fill = 'tozeroy'; tr.fillcolor = 'rgba(47,93,80,0.22)'; }
      if (t.markers) tr.marker = { color: '#c2410c', size: 8 };
      return tr;
    });
    layout = { ...base, barmode: 'group', showlegend: pl.traces.length > 1, legend: { orientation: 'h', y: 1.15 }, xaxis: { ...ax, type: pl.xdate ? 'date' : pl.bars ? 'category' : undefined, title: pl.xtitle }, yaxis: { ...ax, title: pl.ytitle }, ...(pl.y2title ? { yaxis2: { ...ax, title: pl.y2title, overlaying: 'y', side: 'right', range: [0, 100], showgrid: false } } : {}) };
    if (pl.y2title) layout.margin = { ...base.margin, r: 48 };
  } else if (pl.kind === 'bar') {
    data = [{ x: pl.x, y: pl.y, type: 'bar', marker: { color: pl.highlight ? pl.highlight.map(b => (b ? '#c2410c' : '#2f5d50')) : '#2f5d50' } }];
    layout = { ...base, xaxis: { ...ax, type: 'category', automargin: true }, yaxis: { ...ax } };
  } else if (pl.kind === 'stats') {
    data = [{ x: pl.values, type: 'histogram', marker: { color: '#2f5d50', line: { color: '#fbfaf7', width: 1 } }, xaxis: 'x', yaxis: 'y' }, { x: pl.values, type: 'box', boxpoints: 'all', jitter: 0.4, marker: { color: '#c2410c', size: 5 }, line: { color: '#2f5d50' }, xaxis: 'x', yaxis: 'y2', name: '' }];
    layout = { ...base, grid: { rows: 2, columns: 1 }, xaxis: { ...ax }, yaxis: { ...ax, domain: [0.3, 1], title: 'count' }, yaxis2: { ...ax, domain: [0, 0.2], showticklabels: false } };
  } else if (pl.kind === 'geo') {
    data = [{ type: 'scattergeo', lat: pl.lat, lon: pl.lon, text: pl.text, mode: 'markers', marker: { size: pl.size.map(s => Math.max(5, (s - 3) * 5)), color: '#c2410c', opacity: 0.75, line: { color: '#fff', width: 0.5 } }, hoverinfo: 'text' }];
    layout = { ...base, margin: { l: 0, r: 0, t: 0, b: 0 }, geo: { projection: { type: pl.projection || 'natural earth' }, showland: true, landcolor: '#efeadf', showocean: true, oceancolor: '#e3ece9', countrycolor: '#cfc9bc', coastlinecolor: '#b8b2a6', showcountries: true, bgcolor: 'rgba(0,0,0,0)' } };
  }
  Plotly.newPlot(box, data, layout, cfg);
}

// ============================================================
// Asking, history, URL
// ============================================================
let history = store.get('tools.history', []);
let hIdx = -1;

async function ask(q) {
  q = String(q || '').trim();
  if (!q) return;
  $('#home').hidden = true;
  history = [q, ...history.filter(x => x !== q)].slice(0, 200);
  store.set('tools.history', history);
  hIdx = -1;
  if (q.length < 1500) { const url = new URL(location.href); url.searchParams.set('q', q); window.history.replaceState(null, '', url); }
  const made = newCard(q);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await runQuery(made, q);
}

// Several queries at once (homework): cards appear in order, answered one after another.
async function askMany(items) {
  const anchor = feed.firstElementChild;
  const made = items.map(q => { const m = newCard(q); if (anchor) anchor.after(m.card); return m; });
  // newCard prepends; move them below the homework card in the original order
  let prev = anchor;
  for (const m of made) { if (prev) prev.after(m.card); prev = m.card; m.card.classList.add('busy'); }
  for (let i = 0; i < items.length; i++) await runQuery(made[i], items[i]);
}

async function runQuery({ card, ctx }, q) {
  card.classList.add('busy');
  try {
    const how = await route(ctx, q);
    if (!FOLLOW.test(q.trim()) && q.length < 200 && !q.includes('\n')) lastQ = q.trim().replace(/\?+$/, '');
    if (how !== 'file' && F.hasDocs()) F.fileContext(ctx, q);
  } catch (e) {
    console.error(e);
    ctx.add({ title: 'Something went wrong', text: e && e.message ? e.message : String(e), error: true });
    ctx.add({ title: 'Try instead', buttons: [{ label: 'Search everywhere', query: `search ${q}` }, ...engineButtons(q).slice(0, 3)] });
  } finally {
    card.classList.remove('busy');
  }
}

function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 320) + 'px'; }

form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value; input.value = ''; autosize(); ask(q); });
input.addEventListener('input', autosize);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  else if (e.key === 'ArrowUp' && !input.value.includes('\n') && (input.selectionStart === 0 || !input.value)) { if (hIdx < history.length - 1) { hIdx++; input.value = history[hIdx]; autosize(); e.preventDefault(); } }
  else if (e.key === 'ArrowDown' && !input.value.includes('\n') && hIdx >= 0) { hIdx--; input.value = hIdx >= 0 ? history[hIdx] : ''; autosize(); e.preventDefault(); }
  else if (e.key === 'Escape') { input.value = ''; autosize(); }
});
document.addEventListener('keydown', (e) => { if (e.key === '/' && document.activeElement !== input && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); } });

function buildHome() {
  const home = $('#home');
  const grid = h('div', 'home-grid');
  for (const [cat, ex] of EXAMPLES.filter(([c]) => c !== 'Python' && c !== 'Code & text')) {
    const col = h('div', 'home-col');
    col.append(h('h3', null, cat));
    if (cat === 'Text & sources') { ex.slice(0, 5).forEach(x => col.append(queryBtn(x, x))); col.append(h('span', 'home-hint', 'paste a link or long text')); grid.append(col); continue; }
    if (cat === 'Your files') { col.append(h('p', 'note', 'Drop a PDF, Word file, photo or text file anywhere, or use 📎. It stays on your device.')); ['summarize', 'find …', 'references'].forEach(x => col.append(h('span', 'home-hint', x))); grid.append(col); continue; }
    ex.slice(0, 5).forEach(x => col.append(queryBtn(x, x)));
    grid.append(col);
  }
  home.append(grid);
  if (history.length) {
    const r = h('div', 'recent');
    r.append(h('h3', null, 'Recent'));
    const box = h('div', 'chips');
    history.slice(0, 12).forEach(x => box.append(queryBtn(x.length > 50 ? x.slice(0, 50) + '…' : x, x)));
    const clr = h('button', 'chip ghost', 'Clear history'); clr.type = 'button'; clr.onclick = () => { history = []; store.set('tools.history', []); r.remove(); };
    box.append(clr);
    r.append(box);
    home.append(r);
  }
}

Engine.start();
F.initFiles({ newCard, ask, h, engineButtons, stats });
buildHome();
renderVars();
const initial = new URL(location.href).searchParams.get('q');
if (initial) ask(initial); else input.focus();
