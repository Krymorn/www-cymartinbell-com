// Local calculators for /tools: everything here runs in the browser with no network.
const fmt = (n, d = 6) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

// ---------- probability ----------
const erf = (x) => math.erf(x);
const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
function invPhi(p) { // Acklam's approximation
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239], b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572], c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783], d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
const logC = (n, k) => math.lgamma(n + 1) - math.lgamma(k + 1) - math.lgamma(n - k + 1);

function normal(ctx, mu, sd, lo, hi, label) {
  ctx.label('Probability');
  const pz = (x) => phi((x - mu) / sd);
  const p = (hi == null ? 1 : pz(hi)) - (lo == null ? 0 : pz(lo));
  ctx.input(label);
  ctx.add({ title: 'Probability', big: true, text: fmt(p, 6), table: [['As a percent', fmt(p * 100, 4) + '%'], ...(lo != null ? [['z (lower)', fmt((lo - mu) / sd, 4)]] : []), ...(hi != null ? [['z (upper)', fmt((hi - mu) / sd, 4)]] : []), ['Mean, SD', `${mu}, ${sd}`]] });
  const xs = [], ys = [], fx = [], fy = [];
  for (let i = 0; i <= 400; i++) { const x = mu - 4 * sd + 8 * sd * i / 400; const y = Math.exp(-0.5 * ((x - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI)); xs.push(x); ys.push(y); if ((lo == null || x >= lo) && (hi == null || x <= hi)) { fx.push(x); fy.push(y); } }
  ctx.add({ title: 'Shaded area', plot: { kind: 'line', traces: [{ name: 'shaded', x: fx, y: fy, fill: true }, { name: 'density', x: xs, y: ys }] } });
}

function binomial(ctx, n, p, k, mode) {
  ctx.label('Probability');
  const pmf = (i) => Math.exp(logC(n, i) + i * Math.log(p) + (n - i) * Math.log(1 - p));
  let pr = 0, desc;
  if (mode === 'atleast') { for (let i = k; i <= n; i++) pr += pmf(i); desc = `P(X ≥ ${k})`; }
  else if (mode === 'atmost') { for (let i = 0; i <= k; i++) pr += pmf(i); desc = `P(X ≤ ${k})`; }
  else { pr = pmf(k); desc = `P(X = ${k})`; }
  ctx.input(`Binomial: n = ${n}, p = ${p}, ${desc}`);
  ctx.add({ title: desc, big: true, text: fmt(pr, 8), table: [['Mean', fmt(n * p)], ['Standard deviation', fmt(Math.sqrt(n * p * (1 - p)))]] });
  const xs = Array.from({ length: n + 1 }, (_, i) => i);
  if (n <= 200) ctx.add({ title: 'Distribution', plot: { kind: 'bar', x: xs, y: xs.map(pmf), highlight: xs.map(i => (mode === 'atleast' ? i >= k : mode === 'atmost' ? i <= k : i === k)) } });
}

function poisson(ctx, lam, k, mode) {
  ctx.label('Probability');
  const pmf = (i) => Math.exp(-lam + i * Math.log(lam) - math.lgamma(i + 1));
  let pr = 0;
  if (mode === 'atleast') { for (let i = 0; i < k; i++) pr += pmf(i); pr = 1 - pr; } else if (mode === 'atmost') { for (let i = 0; i <= k; i++) pr += pmf(i); } else pr = pmf(k);
  const desc = mode === 'atleast' ? `P(X ≥ ${k})` : mode === 'atmost' ? `P(X ≤ ${k})` : `P(X = ${k})`;
  ctx.input(`Poisson: λ = ${lam}, ${desc}`);
  ctx.add({ title: desc, big: true, text: fmt(pr, 8) });
}

// ---------- regression ----------
function fit(ctx, pts, degree) {
  ctx.label('Curve fit');
  const n = pts.length;
  if (n < degree + 1) throw new Error(`Need at least ${degree + 1} points.`);
  const X = pts.map(([x]) => Array.from({ length: degree + 1 }, (_, j) => x ** j));
  const Y = pts.map(([, y]) => y);
  const Xt = math.transpose(X);
  const beta = math.lusolve(math.multiply(Xt, X), math.multiply(Xt, Y)).map(r => r[0]);
  const f = (x) => beta.reduce((a, b, j) => a + b * x ** j, 0);
  const mean = Y.reduce((a, b) => a + b, 0) / n;
  const ssr = pts.reduce((a, [x, y]) => a + (y - f(x)) ** 2, 0), sst = Y.reduce((a, y) => a + (y - mean) ** 2, 0);
  const r2 = 1 - ssr / sst;
  const terms = beta.map((b, j) => ({ b, j })).reverse().map(({ b, j }) => `${fmt(b, 6)}${j ? (j === 1 ? 'x' : `x^${j}`) : ''}`).join(' + ').replace(/\+ -/g, '- ');
  ctx.input(`${['', 'Linear', 'Quadratic', 'Cubic'][degree] || `Degree-${degree}`} fit to ${n} points`);
  ctx.add({ title: 'Best-fit equation', big: true, text: `y = ${terms}`, table: [['R²', fmt(r2, 6)], ...(degree === 1 ? [['Slope', fmt(beta[1], 8)], ['Intercept', fmt(beta[0], 8)], ['Correlation r', fmt(Math.sign(beta[1]) * Math.sqrt(Math.max(r2, 0)), 6)]] : [])] });
  const xs = pts.map(p => p[0]), lo = Math.min(...xs), hi = Math.max(...xs), pad = (hi - lo) * 0.1 || 1;
  const gx = Array.from({ length: 200 }, (_, i) => lo - pad + (hi - lo + 2 * pad) * i / 199);
  ctx.add({ title: 'Plot', plot: { kind: 'line', traces: [{ name: 'fit', x: gx, y: gx.map(f) }, { name: 'data', x: xs, y: Y, markers: true }] } });
}

// ---------- logic ----------
function truthTable(ctx, expr) {
  ctx.label('Logic');
  const norm = expr.replace(/\bAND\b|&&|∧|\*/gi, ' and ').replace(/\bOR\b|\|\||∨|\+/gi, ' or ').replace(/\bNOT\b|¬|~|!/gi, ' not ').replace(/\bXOR\b|⊕/gi, ' xor ').replace(/<->|<=>|↔|\biff\b/gi, ' iff ').replace(/->|=>|→|\bimplies\b/gi, ' implies ');
  const vars = [...new Set((norm.match(/\b[a-zA-Z]\w*\b/g) || []).filter(w => !['and', 'or', 'not', 'xor', 'implies', 'iff', 'true', 'false'].includes(w.toLowerCase())))].sort();
  if (!vars.length || vars.length > 8) throw new Error('Use 1 to 8 variables, e.g. truth table (p and q) or not r');
  // Build a tiny evaluator: not > and > xor > or > implies > iff
  const tok = norm.match(/\(|\)|\w+/g);
  const evalAt = (env) => {
    let i = 0;
    const peek = () => (tok[i] || '').toLowerCase();
    const prim = () => { const t = tok[i++]; if (t === '(') { const v = iff(); i++; return v; } if (t.toLowerCase() === 'not') return !prim(); if (t.toLowerCase() === 'true') return true; if (t.toLowerCase() === 'false') return false; if (!(t in env)) throw new Error(`Unexpected “${t}”`); return env[t]; };
    const and = () => { let v = prim(); while (peek() === 'and') { i++; v = prim() && v; } return v; };
    const xor = () => { let v = and(); while (peek() === 'xor') { i++; v = v !== and(); } return v; };
    const or = () => { let v = xor(); while (peek() === 'or') { i++; v = xor() || v; } return v; };
    const imp = () => { const v = or(); if (peek() === 'implies') { i++; return !v || imp(); } return v; };
    const iff = () => { let v = imp(); while (peek() === 'iff') { i++; v = v === imp(); } return v; };
    return iff();
  };
  const rows = [];
  let trues = 0;
  for (let m = 0; m < 2 ** vars.length; m++) {
    const env = {}; vars.forEach((v, j) => { env[v] = !!(m >> (vars.length - 1 - j) & 1); });
    const r = evalAt(env); if (r) trues++;
    rows.push([...vars.map(v => (env[v] ? 'T' : 'F')), r ? 'T' : 'F']);
  }
  ctx.input(expr);
  ctx.add({ title: 'Truth table', table: { head: [...vars, 'Result'], rows } });
  ctx.add({ title: 'Classification', text: trues === rows.length ? 'Tautology: always true.' : trues === 0 ? 'Contradiction: always false.' : `Satisfiable: true in ${trues} of ${rows.length} rows.` });
}

// ---------- calendar, timer, time zones, moon ----------
function calendar(ctx, month, year) {
  ctx.label('Calendar');
  const first = new Date(year, month, 1), days = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  ctx.input(first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  const rows = []; let row = Array(first.getDay()).fill('');
  for (let d = 1; d <= days; d++) { row.push(today.getFullYear() === year && today.getMonth() === month && today.getDate() === d ? `[${d}]` : String(d)); if (row.length === 7) { rows.push(row); row = []; } }
  if (row.length) rows.push(row.concat(Array(7 - row.length).fill('')));
  ctx.add({ title: first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), table: { head: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], rows } });
  const prev = new Date(year, month - 1, 1), next = new Date(year, month + 1, 1);
  ctx.add({ title: 'More', chips: [`calendar ${prev.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`, `calendar ${next.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`, `holidays ${year}`] });
}

function timer(ctx, seconds, label) {
  ctx.label(seconds ? 'Timer' : 'Stopwatch');
  ctx.input(label);
  ctx.add({ title: seconds ? 'Timer' : 'Stopwatch', custom: (el) => {
    const disp = h('div', 'big-text timer', '0:00');
    const bar = h('div', 'btns');
    const start = h('button', 'btn-sm', 'Start'), reset = h('button', 'btn-sm', 'Reset'), lap = h('button', 'btn-sm', 'Lap');
    const laps = h('ol', 'numbered');
    let t0 = null, acc = 0, raf = null, done = false;
    const elapsed = () => acc + (t0 ? performance.now() - t0 : 0);
    const show = () => {
      const ms = seconds ? Math.max(seconds * 1000 - elapsed(), 0) : elapsed();
      const s = Math.floor(ms / 1000), hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60, cs = Math.floor(ms % 1000 / 10);
      disp.textContent = `${hh ? hh + ':' + String(mm).padStart(2, '0') : mm}:${String(ss).padStart(2, '0')}${seconds ? '' : '.' + String(cs).padStart(2, '0')}`;
      if (seconds && ms <= 0 && !done) { done = true; t0 = null; start.textContent = 'Start'; beep(); disp.classList.add('ring'); try { if (Notification.permission === 'granted') new Notification('Timer done', { body: label }); } catch (_) {} }
      if (t0) raf = requestAnimationFrame(show);
    };
    start.onclick = () => { if (t0) { acc = elapsed(); t0 = null; start.textContent = 'Start'; } else { if (done) { acc = 0; done = false; disp.classList.remove('ring'); } t0 = performance.now(); start.textContent = 'Pause'; try { if (seconds && Notification.permission === 'default') Notification.requestPermission(); } catch (_) {} show(); } };
    reset.onclick = () => { acc = 0; t0 = null; done = false; start.textContent = 'Start'; disp.classList.remove('ring'); laps.replaceChildren(); cancelAnimationFrame(raf); show(); };
    lap.onclick = () => laps.append(h('li', null, disp.textContent));
    bar.append(start, reset); if (!seconds) bar.append(lap);
    el.append(disp, bar, laps);
    show(); start.click();
  } });
}
function beep() { try { const a = new AudioContext(); [0, 0.35, 0.7].forEach(t => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(0.2, a.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + t + 0.3); o.start(a.currentTime + t); o.stop(a.currentTime + t + 0.3); }); } catch (_) {} }

const TZ = { est: 'America/New_York', edt: 'America/New_York', et: 'America/New_York', eastern: 'America/New_York', cst: 'America/Chicago', cdt: 'America/Chicago', ct: 'America/Chicago', central: 'America/Chicago', mst: 'America/Denver', mdt: 'America/Denver', mt: 'America/Denver', mountain: 'America/Denver', pst: 'America/Los_Angeles', pdt: 'America/Los_Angeles', pt: 'America/Los_Angeles', pacific: 'America/Los_Angeles', akst: 'America/Anchorage', hst: 'Pacific/Honolulu', utc: 'UTC', gmt: 'Europe/London', bst: 'Europe/London', uk: 'Europe/London', london: 'Europe/London', cet: 'Europe/Paris', cest: 'Europe/Paris', paris: 'Europe/Paris', berlin: 'Europe/Berlin', ist: 'Asia/Kolkata', india: 'Asia/Kolkata', jst: 'Asia/Tokyo', tokyo: 'Asia/Tokyo', japan: 'Asia/Tokyo', kst: 'Asia/Seoul', seoul: 'Asia/Seoul', china: 'Asia/Shanghai', beijing: 'Asia/Shanghai', shanghai: 'Asia/Shanghai', 'hong kong': 'Asia/Hong_Kong', singapore: 'Asia/Singapore', sydney: 'Australia/Sydney', aest: 'Australia/Sydney', 'new york': 'America/New_York', nyc: 'America/New_York', boston: 'America/New_York', chicago: 'America/Chicago', denver: 'America/Denver', 'los angeles': 'America/Los_Angeles', la: 'America/Los_Angeles', 'san francisco': 'America/Los_Angeles', seattle: 'America/Los_Angeles', dubai: 'Asia/Dubai', moscow: 'Europe/Moscow', 'sao paulo': 'America/Sao_Paulo', mexico: 'America/Mexico_City', toronto: 'America/Toronto', madrid: 'Europe/Madrid', rome: 'Europe/Rome', 'local': Intl.DateTimeFormat().resolvedOptions().timeZone, 'my time': Intl.DateTimeFormat().resolvedOptions().timeZone, me: Intl.DateTimeFormat().resolvedOptions().timeZone };
export const tzOf = (s) => TZ[String(s).toLowerCase().trim()] || (/^[A-Za-z]+\/[A-Za-z_]+$/.test(s) ? s : null);
function wallToUtc(y, mo, d, hh, mm, zone) {
  // find the UTC instant whose wall-clock time in `zone` is the given one
  let t = Date.UTC(y, mo, d, hh, mm);
  for (let k = 0; k < 3; k++) {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(t)).reduce((o, x) => (o[x.type] = +x.value, o), {});
    t -= Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Date.UTC(y, mo, d, hh, mm);
  }
  return new Date(t);
}
function tzConvert(ctx, timeStr, fromZ, toZ, fromLabel, toLabel) {
  ctx.label('Time zones');
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(timeStr.trim().replace(/\s+/g, ' ')) || (/^noon$/i.test(timeStr) ? [0, '12', '00', 'pm'] : /^midnight$/i.test(timeStr) ? [0, '12', '00', 'am'] : null);
  if (!m) return false;
  let hh = +m[1] % 12 + (m[3] && m[3].toLowerCase() === 'pm' ? 12 : 0); if (!m[3] && +m[1] === 12) hh = 12; if (!m[3] && +m[1] < 12) hh = +m[1];
  const now = new Date();
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: fromZ }).format(now).split('-').map(Number);
  const inst = wallToUtc(ymd[0], ymd[1] - 1, ymd[2], hh, +(m[2] || 0), fromZ);
  const show = (z) => inst.toLocaleString('en-US', { timeZone: z, weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  ctx.input(`${timeStr} ${fromLabel} → ${toLabel}`);
  ctx.add({ title: toLabel, big: true, text: show(toZ), table: [[fromLabel, show(fromZ)], ['UTC', show('UTC')], ['You', show(Intl.DateTimeFormat().resolvedOptions().timeZone)]] });
}

function moon(ctx, date, label) {
  ctx.label('Moon');
  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
  const age = (((date - ref) / 864e5) % syn + syn) % syn;
  const illum = (1 - Math.cos(2 * Math.PI * age / syn)) / 2;
  const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  const icons = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
  const idx = Math.floor(((age / syn) * 8 + 0.5)) % 8;
  const next = (target) => new Date(+date + (((target - age) % syn + syn) % syn) * 864e5);
  ctx.input(label);
  ctx.add({ title: 'Moon phase', big: true, text: `${icons[idx]} ${names[idx]}`, table: [['Illuminated', `${Math.round(illum * 100)}%`], ['Moon age', `${age.toFixed(1)} days`], ['Next full moon', next(syn / 2).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })], ['Next new moon', next(0).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })]], note: 'Calculated from the average lunar cycle, accurate to within about a day.' });
}

// ---------- constants ----------
const CONSTANTS = [
  [['speed of light', 'c'], 'Speed of light in vacuum', '299,792,458 m/s', 'exact'], [['gravitational constant', 'big g', 'newton constant'], 'Gravitational constant G', '6.67430 × 10⁻¹¹ m³ kg⁻¹ s⁻²', ''],
  [['planck constant', 'planck', 'h'], 'Planck constant h', '6.62607015 × 10⁻³⁴ J·s', 'exact'], [['reduced planck constant', 'hbar', 'h bar'], 'Reduced Planck constant ħ', '1.054571817 × 10⁻³⁴ J·s', ''],
  [['boltzmann constant', 'boltzmann'], 'Boltzmann constant k', '1.380649 × 10⁻²³ J/K', 'exact'], [['avogadro', 'avogadro constant', 'avogadros number', "avogadro's number"], 'Avogadro constant', '6.02214076 × 10²³ mol⁻¹', 'exact'],
  [['elementary charge', 'electron charge', 'charge of an electron'], 'Elementary charge e', '1.602176634 × 10⁻¹⁹ C', 'exact'], [['electron mass', 'mass of an electron'], 'Electron mass', '9.1093837015 × 10⁻³¹ kg', ''],
  [['proton mass', 'mass of a proton'], 'Proton mass', '1.67262192369 × 10⁻²⁷ kg', ''], [['neutron mass', 'mass of a neutron'], 'Neutron mass', '1.67492749804 × 10⁻²⁷ kg', ''],
  [['gas constant', 'ideal gas constant', 'r'], 'Molar gas constant R', '8.314462618 J mol⁻¹ K⁻¹', ''], [['standard gravity', 'acceleration due to gravity', 'gravity', 'g'], 'Standard gravity g', '9.80665 m/s² (32.174 ft/s²)', 'exact'],
  [['vacuum permittivity', 'epsilon 0', 'permittivity of free space'], 'Vacuum permittivity ε₀', '8.8541878128 × 10⁻¹² F/m', ''], [['vacuum permeability', 'mu 0'], 'Vacuum permeability μ₀', '1.25663706212 × 10⁻⁶ N/A²', ''],
  [['coulomb constant', 'coulombs constant'], 'Coulomb constant k', '8.9875517923 × 10⁹ N·m²/C²', ''], [['stefan boltzmann constant'], 'Stefan–Boltzmann constant σ', '5.670374419 × 10⁻⁸ W m⁻² K⁻⁴', ''],
  [['fine structure constant'], 'Fine-structure constant α', '7.2973525693 × 10⁻³ (≈ 1/137.036)', ''], [['speed of sound'], 'Speed of sound (dry air, 20 °C)', '343 m/s (767 mph)', ''],
  [['earth mass', 'mass of the earth', 'mass of earth'], 'Mass of Earth', '5.972 × 10²⁴ kg', ''], [['earth radius', 'radius of the earth', 'radius of earth'], 'Mean radius of Earth', '6,371 km (3,959 mi)', ''],
  [['sun mass', 'mass of the sun', 'solar mass'], 'Mass of the Sun', '1.989 × 10³⁰ kg', ''], [['astronomical unit', 'au', 'distance to the sun'], 'Astronomical unit', '149,597,870.7 km (92.96 million mi)', 'exact'],
  [['light year', 'lightyear'], 'Light-year', '9.4607 × 10¹² km (5.879 trillion mi)', ''], [['absolute zero'], 'Absolute zero', '0 K = −273.15 °C = −459.67 °F', 'exact'],
  [['golden ratio', 'phi'], 'Golden ratio φ', '1.6180339887498948482…', ''], [['eulers number', "euler's number", 'e'], 'Euler’s number e', '2.7182818284590452353…', ''], [['pi'], 'π', '3.1415926535897932384…', ''],
];
export function constant(ctx, q) {
  const k = q.toLowerCase().replace(/^(?:the\s+|what is the\s+|value of (?:the\s+)?)/, '').replace(/[?]/g, '').trim();
  const c = CONSTANTS.find(([names]) => names.includes(k));
  if (!c) return false;
  ctx.label('Constant');
  ctx.input(c[1]);
  ctx.add({ title: c[1], big: true, text: c[2], note: c[3] === 'exact' ? 'Exact by definition (SI 2019).' : 'CODATA recommended value.' });
  return true;
}

// ---------- words & codes ----------
const ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const TENS = 'zero ten twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion'];
function words3(n) { const hu = Math.floor(n / 100), r = n % 100; return [hu ? ONES[hu] + ' hundred' : '', r ? (r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? '-' + ONES[r % 10] : '')) : ''].filter(Boolean).join(' '); }
export function numberWords(n) {
  if (n === 0n) return 'zero';
  const neg = n < 0n; if (neg) n = -n;
  const parts = []; let i = 0;
  while (n > 0n) { const chunk = Number(n % 1000n); if (chunk) parts.unshift(words3(chunk) + (SCALES[i] ? ' ' + SCALES[i] : '')); n /= 1000n; i++; if (i >= SCALES.length && n > 0n) throw new Error('Number too large.'); }
  return (neg ? 'minus ' : '') + parts.join(' ');
}
const MORSE = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.', '@': '.--.-.', "'": '.----.' };
const UNMORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
const shift = (t, k) => t.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b + k % 26 + 26) % 26 + b); });

// ---------- QR ----------
let qrP = null;
function loadQR() { if (!qrP) qrP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'; s.onload = () => res(window.qrcode); s.onerror = () => rej(new Error('Couldn’t load the QR library.')); document.head.append(s); }); return qrP; }
async function qr(ctx, text) {
  ctx.label('QR code');
  ctx.input(text.length > 80 ? text.slice(0, 80) + '…' : text);
  const lib = await loadQR();
  const q = lib(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), scale = 8, pad = 4;
  const cv = document.createElement('canvas'); cv.width = cv.height = (n + pad * 2) * scale;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect((c + pad) * scale, (r + pad) * scale, scale, scale);
  const url = cv.toDataURL('image/png');
  ctx.add({ title: 'QR code', custom: (el) => { const im = h('img', 'qr'); im.src = url; im.alt = 'QR code'; const a = h('a', 'btn-sm', 'Download PNG'); a.href = url; a.download = 'qr.png'; const b = h('div', 'btns'); b.append(a); el.append(im, b); } });
}

// ---------- JSON / JWT / regex ----------
function b64url(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0))); }

// ---------- rules ----------
const num = (s) => parseFloat(String(s).replace(/,/g, ''));
const MONTHS = 'january february march april may june july august september october november december'.split(' ');

export const EXTRA_RULES = [
  // probability
  [/^(?:normal|gaussian)?\s*(?:cdf|p)\s*\(?\s*z\s*([<>]=?)\s*(-?[\d.]+)\s*\)?$|^(?:normal|standard normal)\s+cdf\s+(?:of\s+)?(-?[\d.]+)$/i, (c, m) => { const z = num(m[2] ?? m[3]); const gt = m[1] && m[1][0] === '>'; normal(c, 0, 1, gt ? z : null, gt ? null : z, `P(Z ${gt ? '>' : '<'} ${z})`); }],
  [/^normal\s+(?:distribution\s+)?(?:mean|mu|μ)\s*=?\s*(-?[\d.]+)\s*,?\s*(?:sd|std|sigma|σ|standard deviation)\s*=?\s*([\d.]+)\s*,?\s*(?:(between)\s+(-?[\d.]+)\s+and\s+(-?[\d.]+)|(below|less than|under|<)\s*(-?[\d.]+)|(above|more than|over|greater than|>)\s*(-?[\d.]+))$/i, (c, m) => { const mu = num(m[1]), sd = num(m[2]); if (m[3]) normal(c, mu, sd, num(m[4]), num(m[5]), `Normal(${mu}, ${sd}): between ${m[4]} and ${m[5]}`); else if (m[6]) normal(c, mu, sd, null, num(m[7]), `Normal(${mu}, ${sd}): below ${m[7]}`); else normal(c, mu, sd, num(m[9]), null, `Normal(${mu}, ${sd}): above ${m[9]}`); }],
  [/^(?:inverse normal|z score for|z for|critical value)\s+(?:p\s*=?\s*)?([\d.]+)\s*(%)?(?:\s+confidence)?$/i, (c, m) => { let p = num(m[1]); if (m[2] || p > 1) p /= 100; const two = /confidence|critical/i.test(m[0]); const z = two ? invPhi(1 - (1 - p) / 2) : invPhi(p); c.label('Probability'); c.input(two ? `Critical z for ${p * 100}% confidence` : `z with ${p} of the area below it`); c.add({ title: 'z', big: true, text: fmt(z, 6) }); }],
  [/^binomial\s+(?:n\s*=?\s*)?(\d+)\s*,?\s*(?:p\s*=?\s*)?([\d.]+)\s*,?\s*(?:k|x)\s*(=|>=|≥|<=|≤)?\s*(\d+)$/i, (c, m) => binomial(c, +m[1], num(m[2]), +m[4], /[>≥]/.test(m[3] || '') ? 'atleast' : /[<≤]/.test(m[3] || '') ? 'atmost' : 'exact')],
  [/^(?:probability of\s+)?(?:(at least|at most|exactly)\s+)?(\d+)\s+heads?\s+in\s+(\d+)\s+(?:coin\s+)?(?:flips|tosses)$/i, (c, m) => binomial(c, +m[3], 0.5, +m[2], m[1] && /least/i.test(m[1]) ? 'atleast' : m[1] && /most/i.test(m[1]) ? 'atmost' : 'exact')],
  [/^poisson\s+(?:lambda|λ|mean)?\s*=?\s*([\d.]+)\s*,?\s*(?:k|x)\s*(=|>=|≥|<=|≤)?\s*(\d+)$/i, (c, m) => poisson(c, num(m[1]), +m[3], /[>≥]/.test(m[2] || '') ? 'atleast' : /[<≤]/.test(m[2] || '') ? 'atmost' : 'exact')],
  [/^(\d+)\s*(?:choose|c|nCr)\s*(\d+)$|^(?:combinations|nCr)\s*\(?\s*(\d+)\s*,\s*(\d+)\s*\)?$/i, (c, m) => { const n = BigInt(m[1] || m[3]), k = BigInt(m[2] || m[4]); let r = 1n; for (let i = 0n; i < k; i++) r = r * (n - i) / (i + 1n); c.label('Combinatorics'); c.input(`${n} choose ${k}`); c.add({ title: 'Combinations (order doesn’t matter)', big: true, text: r.toLocaleString('en-US') }); let p = 1n; for (let i = 0n; i < k; i++) p *= (n - i); c.add({ title: 'Permutations (order matters)', text: p.toLocaleString('en-US') }); }],
  [/^(?:permutations|nPr)\s*\(?\s*(\d+)\s*,?\s*(\d+)\s*\)?$/i, (c, m) => { const n = BigInt(m[1]), k = BigInt(m[2]); let p = 1n; for (let i = 0n; i < k; i++) p *= (n - i); c.label('Combinatorics'); c.input(`Permutations of ${n} taken ${k}`); c.add({ title: 'Permutations', big: true, text: p.toLocaleString('en-US') }); }],

  // regression
  [/^(linear|quadratic|cubic|polynomial|exponential)?\s*(?:fit|regression|line of best fit|best fit)(?:\s+(?:of|for|to|through))?\s*:?\s*(.+)$/i, (c, m) => {
    const pairs = [...m[2].matchAll(/\(?\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)?/g)].map(x => [num(x[1]), num(x[2])]);
    if (pairs.length < 2) return false;
    const deg = { quadratic: 2, cubic: 3, polynomial: 3 }[(m[1] || '').toLowerCase()] || 1;
    if ((m[1] || '').toLowerCase() === 'exponential') {
      if (pairs.some(p => p[1] <= 0)) throw new Error('Exponential fits need positive y values.');
      const lp = pairs.map(([x, y]) => [x, Math.log(y)]);
      const n = lp.length, sx = lp.reduce((a, p) => a + p[0], 0), sy = lp.reduce((a, p) => a + p[1], 0), sxx = lp.reduce((a, p) => a + p[0] * p[0], 0), sxy = lp.reduce((a, p) => a + p[0] * p[1], 0);
      const b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = Math.exp((sy - b * sx) / n);
      c.label('Curve fit'); c.input(`Exponential fit to ${n} points`);
      c.add({ title: 'Best-fit equation', big: true, text: `y = ${fmt(a)} · e^(${fmt(b)}x)`, table: [['Growth per unit x', `${fmt((Math.exp(b) - 1) * 100, 3)}%`], ['Doubling (or halving) time', fmt(Math.log(2) / Math.abs(b), 4)]] });
      const xs = pairs.map(p => p[0]); const lo = Math.min(...xs), hi = Math.max(...xs); const gx = Array.from({ length: 200 }, (_, i) => lo + (hi - lo) * i / 199);
      c.add({ title: 'Plot', plot: { kind: 'line', traces: [{ name: 'fit', x: gx, y: gx.map(x => a * Math.exp(b * x)) }, { name: 'data', x: xs, y: pairs.map(p => p[1]), markers: true }] } });
      return;
    }
    fit(c, pairs, deg);
  }],

  // logic
  [/^truth table\s+(?:for\s+|of\s+)?(.+)$/i, (c, m) => truthTable(c, m[1])],

  // calendar, timers, time zones, moon
  [/^calendar(?:\s+(?:for\s+)?([a-z]+))?(?:\s+(\d{4}))?$/i, (c, m) => { const now = new Date(); let mo = m[1] ? MONTHS.findIndex(x => x.startsWith(m[1].toLowerCase().slice(0, 3))) : now.getMonth(); if (mo < 0) return false; calendar(c, mo, m[2] ? +m[2] : now.getFullYear()); }],
  [/^(?:set\s+(?:a\s+)?)?timer\s+(?:for\s+)?(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?)?\s*(?:(\d+)\s*s(?:ec(?:ond)?s?)?)?$|^(\d+(?:\.\d+)?)\s*(minute|min|second|sec|hour)s?\s+timer$/i, (c, m) => { let s; if (m[4]) s = num(m[4]) * ({ minute: 60, min: 60, second: 1, sec: 1, hour: 3600 }[m[5].toLowerCase()]); else s = (num(m[1] || 0) * 3600) + (num(m[2] || 0) * 60) + (num(m[3] || 0)); if (!s) return false; timer(c, s, `Timer: ${m[0].replace(/^set\s+(a\s+)?/i, '')}`); }],
  [/^(?:stopwatch|start (?:a )?stopwatch)$/i, (c) => timer(c, 0, 'Stopwatch')],
  [/^(?:convert\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon|midnight)\s+(?:in\s+)?([a-z][a-z /_]*?)\s+(?:to|in)\s+([a-z][a-z /_]*)$/i, (c, m) => { const a = tzOf(m[2]), b = tzOf(m[3]); if (!a || !b) return false; return tzConvert(c, m[1], a, b, m[2].toUpperCase().length <= 4 ? m[2].toUpperCase() : cap(m[2]), m[3].toUpperCase().length <= 4 ? m[3].toUpperCase() : cap(m[3])); }],
  [/^(?:moon phase|moon|phase of the moon|lunar phase)(?:\s+(?:on|for)\s+(.+))?$|^(?:when is the )?next (?:full|new) moon$/i, (c, m, q, parseDate) => { const d = m[1] ? parseDate(m[1]) : new Date(); if (!d) return false; d.setHours(12); moon(c, d, m[1] ? `Moon on ${m[1]}` : 'The moon today'); }],

  // constants
  [/^(?:what is\s+)?(?:the\s+)?(?:value of\s+(?:the\s+)?)?([a-z' ]+?)(?:\s+constant)?$/i, (c, m, q) => (constant(c, q) ? undefined : false)],

  // words, codes, ciphers
  [/^(-?\d[\d,]*)\s+in\s+words$|^(?:spell out|write out|say)\s+(-?\d[\d,]*)$/i, (c, m) => { const n = BigInt((m[1] || m[2]).replace(/,/g, '')); c.label('Number words'); c.input(n.toLocaleString('en-US')); c.add({ title: 'In words', big: true, text: numberWords(n) }); }],
  [/^(?:to\s+)?morse(?:\s+code)?(?:\s+(?:for|of))?\s+(.+)$/i, (c, m) => { c.label('Morse code'); const t = m[1].trim(); const isMorse = /^[.\-\s/]+$/.test(t); c.input(isMorse ? 'Decode Morse' : 'Encode as Morse'); c.add({ title: isMorse ? 'Text' : 'Morse', big: true, mono: !isMorse, text: isMorse ? t.split(/\s*\/\s*|\s{3,}/).map(w => w.split(/\s+/).map(x => UNMORSE[x] || '?').join('')).join(' ').toUpperCase() : t.toLowerCase().split(/\s+/).map(w => [...w].map(ch => MORSE[ch] || '').join(' ')).join(' / ') }); }],
  [/^rot-?13\s+(.+)$/i, (c, m) => { c.label('Cipher'); c.input('ROT13'); c.add({ title: 'Result', big: true, text: shift(m[1], 13) }); }],
  [/^caesar(?:\s+cipher)?\s+(?:shift\s+)?(-?\d+)\s+(.+)$/i, (c, m) => { c.label('Cipher'); c.input(`Caesar shift ${m[1]}`); c.add({ title: 'Result', big: true, text: shift(m[2], +m[1]) }); c.add({ title: 'All 25 shifts (for cracking)', table: Array.from({ length: 25 }, (_, i) => [String(i + 1), shift(m[2], i + 1)]) }); }],
  [/^(?:text\s+)?to\s+binary\s+(.+)$|^binary\s+(?:of|for)\s+["']?(.+?)["']?$/i, (c, m) => { const t = m[1] || m[2]; c.label('Encoding'); c.input('Text → binary'); c.add({ title: 'Binary (UTF-8)', mono: true, text: [...new TextEncoder().encode(t)].map(b => b.toString(2).padStart(8, '0')).join(' ') }); c.add({ title: 'Hex', mono: true, text: [...new TextEncoder().encode(t)].map(b => b.toString(16).padStart(2, '0')).join(' ') }); }],
  [/^(?:binary to text|from binary)\s+([01\s]+)$/i, (c, m) => { c.label('Encoding'); c.input('Binary → text'); c.add({ title: 'Text', big: true, text: new TextDecoder().decode(Uint8Array.from(m[1].trim().split(/\s+/).map(b => parseInt(b, 2)))) }); }],

  // QR, JSON, JWT, regex
  [/^(?:qr|qr code|qrcode|make a qr code)\s+(?:for\s+)?([\s\S]+)$/i, (c, m) => qr(c, m[1].trim())],
  [/^(?:json|format json|pretty json|prettify)\s+([\[{][\s\S]+)$|^(\{[\s\S]*\})$/i, (c, m) => { let j; try { j = JSON.parse(m[1] || m[2]); } catch (e) { if (m[2]) return false; throw new Error('Invalid JSON: ' + e.message); } c.label('JSON'); c.input('Formatted JSON'); c.add({ title: 'Formatted', pre: JSON.stringify(j, null, 2) }); c.add({ title: 'Minified', pre: JSON.stringify(j) }); }],
  [/^(?:jwt|decode jwt|decode)\s+(eyJ[\w-]+\.[\w-]+\.[\w-]*)$|^(eyJ[\w-]+\.eyJ[\w-]+\.[\w-]*)$/i, (c, m) => { const t = m[1] || m[2]; const [hd, pl] = t.split('.'); const payload = JSON.parse(b64url(pl)); c.label('JWT'); c.input('Decoded token (signature not verified)'); c.add({ title: 'Header', pre: JSON.stringify(JSON.parse(b64url(hd)), null, 2) }); c.add({ title: 'Payload', pre: JSON.stringify(payload, null, 2) }); const t2 = []; for (const k of ['iat', 'nbf', 'exp']) if (payload[k]) t2.push([k, new Date(payload[k] * 1000).toLocaleString('en-US')]); if (t2.length) c.add({ title: 'Times', table: t2, note: payload.exp && payload.exp * 1000 < Date.now() ? 'This token has expired.' : undefined }); }],
  [/^(?:regex|regexp|test regex)\s+\/(.+)\/([gimsuy]*)\s+(?:on|against|in)\s+([\s\S]+)$/i, (c, m) => { const re = new RegExp(m[1], m[2].includes('g') ? m[2] : m[2] + 'g'); const hits = [...m[3].matchAll(re)].slice(0, 200); c.label('Regex'); c.input(`/${m[1]}/${m[2]}`); c.add({ title: `${hits.length} match${hits.length === 1 ? '' : 'es'}`, table: { head: ['#', 'Match', 'At', 'Groups'], rows: hits.map((x, i) => [String(i + 1), x[0], String(x.index), x.slice(1).join(' | ')]) } }); }],

  // health
  [/^bmi\s+(?:for\s+)?([\d.]+)\s*(kg|lbs?|pounds?)\s*,?\s*(?:(\d+)\s*(?:'|ft|feet)\s*(\d+)?\s*(?:"|in(?:ches)?)?|([\d.]+)\s*(cm|m|in(?:ches)?))$/i, (c, m) => {
    const kg = /kg/i.test(m[2]) ? num(m[1]) : num(m[1]) * 0.45359237;
    const meters = m[3] ? (num(m[3]) * 12 + num(m[4] || 0)) * 0.0254 : /cm/i.test(m[6]) ? num(m[5]) / 100 : /^m$/i.test(m[6]) ? num(m[5]) : num(m[5]) * 0.0254;
    const bmi = kg / meters ** 2;
    c.label('BMI'); c.input(`${fmt(kg, 1)} kg, ${fmt(meters * 100, 1)} cm`);
    c.add({ title: 'Body mass index', big: true, text: fmt(bmi, 1), table: [['Category', bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy weight' : bmi < 30 ? 'Overweight' : 'Obesity'], ['Healthy weight range for this height', `${fmt(18.5 * meters ** 2, 1)}–${fmt(24.9 * meters ** 2, 1)} kg (${fmt(18.5 * meters ** 2 / 0.4536, 0)}–${fmt(24.9 * meters ** 2 / 0.4536, 0)} lb)`]], note: 'BMI is a rough screening number. It doesn’t account for muscle, age or build.' });
  }],
];
