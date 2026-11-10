// Study calculators: grades, stats tests, chemistry, physics/electronics, biology, discrete math,
// finance, health and time. Everything is closed-form math in the browser; results that are tables
// can be downloaded as CSV/Excel.
import * as K from './kit.js';
const { fmt, round, sum, mean } = K;
const numList = (s) => (String(s).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
const sig = (x, n = 4) => (x === 0 || !isFinite(x) ? String(x) : Math.abs(x) >= 1e6 || Math.abs(x) < 1e-3 ? x.toExponential(n - 1) : String(+x.toPrecision(n)));
const kv = (s) => { const o = {}; for (const m of s.matchAll(/\b([a-zA-Zα-ωΔθ][\w₀-₉]*)\s*[=:]?\s*(-?\d*\.?\d+(?:e-?\d+)?)\s?([a-zA-Zµμ°%/²³]*)(?![\wµμ°%/²³]*\s*[=:])(?!\s*\d)/g)) o[m[1].toLowerCase()] = { v: +m[2], u: m[3] }; return o; };
const pStr = (p) => (p < 1e-4 ? p.toExponential(2) : fmt(p, 4));
const verdict = (p, a = 0.05) => (p < a ? `Significant at α = ${a} (p < ${a}): reject H₀.` : `Not significant at α = ${a} (p ≥ ${a}): fail to reject H₀.`);

// ============================================================ grades
const LETTER = { 'a+': 4, a: 4, 'a-': 3.7, 'b+': 3.3, b: 3, 'b-': 2.7, 'c+': 2.3, c: 2, 'c-': 1.7, 'd+': 1.3, d: 1, 'd-': 0.7, f: 0 };
function gpa(ctx, s) {
  const items = [...s.replace(/[−–]/g, '-').matchAll(/\b([abcdf][+-]?|\d(?:\.\d+)?)(?=[\s,(:x×]|$)\s*(?:[(:x×,]\s*)?(\d+(?:\.\d+)?)\s*(?:cr(?:edits?)?|hrs?|hours?|units?)?\)?/gi)].map(m => ({ g: m[1], pts: LETTER[m[1].toLowerCase()] ?? +m[1], cr: +m[2] })).filter(x => x.pts <= 4.3 && x.cr > 0 && x.cr <= 12);
  if (!items.length) throw new Error('List grades with credits, e.g. “gpa A 3, B+ 4, A- 3, C 2”.');
  const cr = sum(items.map(x => x.cr)), qp = sum(items.map(x => x.pts * x.cr));
  ctx.label('GPA'); ctx.input(`${items.length} courses, ${cr} credits`);
  ctx.add({ title: 'GPA', big: true, text: fmt(qp / cr, 3) });
  ctx.add({ title: 'Breakdown', table: { head: ['Grade', 'Points', 'Credits', 'Quality points'], rows: [...items.map(x => [x.g.toUpperCase(), x.pts, x.cr, round(x.pts * x.cr, 2)]), ['Total', '', cr, round(qp, 2)]] } });
  ctx.add(K.filesPod(K.tableFiles('gpa', ['Grade', 'Points', 'Credits', 'Quality points'], items.map((x, i) => [x.g.toUpperCase(), x.pts, x.cr, `=B${i + 2}*C${i + 2}`]).concat([['GPA', '', `=SUM(C2:C${items.length + 1})`, `=SUM(D2:D${items.length + 1})/C${items.length + 2}`]]))));
  ctx.add({ title: 'Scale used', text: 'A/A+ 4.0 · A− 3.7 · B+ 3.3 · B 3.0 · B− 2.7 · C+ 2.3 · C 2.0 · C− 1.7 · D+ 1.3 · D 1.0 · F 0. Some schools give A+ 4.3; check yours.' });
}
function cumGpa(ctx, g1, c1, g2, c2) {
  const g = (g1 * c1 + g2 * c2) / (c1 + c2);
  ctx.label('Cumulative GPA'); ctx.input(`${g1} over ${c1} credits + ${g2} over ${c2}`);
  ctx.add({ title: 'New cumulative GPA', big: true, text: fmt(g, 3) });
  ctx.add({ title: 'To reach a target next term (same credits)', table: { head: ['Target', 'Term GPA needed'], rows: [3, 3.3, 3.5, 3.7, 3.9].map(t => [t, ((t * (c1 + c2 + c2) - g * (c1 + c2)) / c2) > 4 ? 'Not possible in one term' : fmt((t * (c1 + c2 + c2) - g * (c1 + c2)) / c2, 2)]) } });
}
function finalNeeded(ctx, cur, w, want) {
  w = w > 1 ? w / 100 : w;
  const need = (want - cur * (1 - w)) / w;
  ctx.label('Final exam'); ctx.input(`Current ${cur}%, final worth ${round(w * 100, 2)}%, goal ${want}%`);
  ctx.add({ title: 'You need on the final', big: true, text: need <= 0 ? 'Already locked in (even a 0 works)' : need > 100 ? `${fmt(need, 1)}% (above 100%, not reachable without extra credit)` : `${fmt(need, 1)}%` });
  ctx.add({ title: 'Other goals', table: { head: ['Final grade goal', 'Score needed'], rows: [[97, 'A+'], [93, 'A'], [90, 'A−'], [87, 'B+'], [83, 'B'], [80, 'B−'], [77, 'C+'], [73, 'C'], [70, 'C−'], [60, 'D']].map(([g, l]) => [`${l} (${g}%)`, fmt(Math.max(0, (g - cur * (1 - w)) / w), 1) + '%']) } });
  ctx.add({ title: 'If you score…', table: { head: ['Final exam', 'Course grade'], rows: [100, 90, 80, 70, 60, 50].map(f => [f + '%', fmt(cur * (1 - w) + f * w, 1) + '%']) } });
}
function weightedGrade(ctx, s) {
  const parts = [...s.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:%|percent)?\s*(?:\(|@|at|x|×|weight(?:ed)?|worth)?\s*(\d+(?:\.\d+)?)\s*%/gi)].map(m => [+m[1], +m[2]]);
  if (parts.length < 1) throw new Error('Write scores with weights, e.g. “weighted grade 92 (30%), 85 (50%), 78 (20%)”.');
  const W = sum(parts.map(p => p[1])); const g = sum(parts.map(p => p[0] * p[1])) / W;
  ctx.label('Weighted grade'); ctx.input(parts.map(p => `${p[0]} @ ${p[1]}%`).join(', '));
  ctx.add({ title: W < 100 ? `Grade so far (${W}% of the course graded)` : 'Weighted grade', big: true, text: `${fmt(g, 2)}%` });
  if (W < 100) ctx.add({ title: `Average needed on the remaining ${100 - W}%`, table: [90, 80, 70].map(t => [`For ${t}% overall`, fmt((t * 100 - g * W) / (100 - W), 1) + '%']) });
  if (W > 100.01) ctx.add({ title: 'Check the weights', warn: true, text: `They add to ${W}%, not 100%. The result is normalized by ${W}.` });
}

// ============================================================ measurement & error
function sigFigs(ctx, s) {
  const t = s.trim().replace(/,/g, '');
  const m = /^[-+]?(\d*)(?:\.(\d*))?(?:e[-+]?\d+)?$/i.exec(t); if (!m) return false;
  const [ip, fp] = [m[1] || '', m[2]];
  let n;
  if (fp !== undefined) n = (ip.replace(/^0+/, '') + fp).replace(/^0+/, '').length || (fp.length ? fp.length : 1);
  else n = ip.replace(/^0+/, '').replace(/0+$/, '').length || 1;
  const v = Number(t);
  ctx.label('Significant figures'); ctx.input(t);
  ctx.add({ title: 'Significant figures', big: true, text: String(n), note: fp === undefined && /0$/.test(ip) ? 'Trailing zeros without a decimal point are ambiguous; counted as not significant. Write 1.20×10³ or “1200.” to show they are.' : undefined });
  ctx.add({ title: 'Rounded to', table: [1, 2, 3, 4, 5, 6].map(k => [`${k} s.f.`, Number(v.toPrecision(k)).toString(), v.toExponential(k - 1)]) });
}
function sciNot(ctx, x) {
  const v = Number(x.replace(/,/g, ''));
  const e = Math.floor(Math.log10(Math.abs(v)));
  ctx.label('Scientific notation'); ctx.input(x);
  ctx.add({ title: 'Scientific notation', big: true, latex: `${round(v / 10 ** e, 10)} \\times 10^{${e}}` });
  const eng = Math.floor(e / 3) * 3;
  ctx.add({ title: 'Forms', table: [['E notation', v.toExponential()], ['Engineering', `${round(v / 10 ** eng, 10)} × 10^${eng}`], ['Standard', v.toLocaleString('en-US', { maximumFractionDigits: 20 })], ['LaTeX', `${round(v / 10 ** e, 10)} \\times 10^{${e}}`]] });
}
function percentError(ctx, meas, exact) {
  const pe = Math.abs(meas - exact) / Math.abs(exact) * 100;
  ctx.label('Percent error'); ctx.input(`Measured ${meas}, accepted ${exact}`);
  ctx.add({ title: 'Percent error', big: true, latex: `\\frac{|${meas} - ${exact}|}{|${exact}|}\\times 100\\% = ${round(pe, 4)}\\%` });
  ctx.add({ title: 'Also', table: [['Absolute error', round(Math.abs(meas - exact), 8)], ['Relative error', round(Math.abs(meas - exact) / Math.abs(exact), 8)], ['Signed % difference', `${round((meas - exact) / exact * 100, 4)}%`], ['Percent difference (no accepted value)', `${round(Math.abs(meas - exact) / ((meas + exact) / 2) * 100, 4)}%`]] });
}
function errorProp(ctx, expr, vars) {
  // vars: {x:[val, unc], ...}; numeric partial derivatives
  const names = Object.keys(vars);
  const f = new Function(...names, `with (Math) { return (${expr.replace(/\^/g, '**')}); }`);
  const vals = names.map(n => vars[n][0]);
  const y = f(...vals);
  let s2 = 0; const rows = [];
  names.forEach((n, i) => { const h = Math.abs(vals[i]) * 1e-6 || 1e-6; const up = [...vals]; up[i] += h; const dn = [...vals]; dn[i] -= h; const d = (f(...up) - f(...dn)) / (2 * h); const c = (d * vars[n][1]) ** 2; s2 += c; rows.push([n, `${vars[n][0]} ± ${vars[n][1]}`, sig(d, 5), sig(Math.abs(d * vars[n][1]), 4)]); });
  const u = Math.sqrt(s2);
  ctx.label('Error propagation'); ctx.input(`f = ${expr}`);
  ctx.add({ title: 'Result', big: true, text: `${sig(y, 6)} ± ${sig(u, 2)}  (${fmt(100 * u / Math.abs(y), 2)}%)` });
  ctx.add({ title: 'Contributions', table: { head: ['Variable', 'Value', '∂f/∂x', '|∂f/∂x|·σ'], rows } });
  ctx.add({ title: 'Formula', latex: `\\sigma_f = \\sqrt{\\sum_i \\left(\\frac{\\partial f}{\\partial x_i}\\sigma_{x_i}\\right)^2}`, note: 'Assumes independent, uncorrelated uncertainties (standard first-order propagation).' });
}

// ============================================================ statistics
const variance = (a) => { const m = mean(a); return sum(a.map(x => (x - m) ** 2)) / (a.length - 1); };
const sd = (a) => Math.sqrt(variance(a));
function tOne(ctx, m, s, n, mu, label) {
  const se = s / Math.sqrt(n), t = (m - mu) / se, df = n - 1;
  const p2 = 2 * (1 - K.tCdf(Math.abs(t), df));
  const tc = K.tInv(0.975, df);
  ctx.label('t-test'); ctx.input(label || `One-sample t-test, H₀: μ = ${mu}`);
  ctx.add({ title: 'Result', big: true, text: `t(${df}) = ${fmt(t, 3)}, p = ${pStr(p2)}`, note: verdict(p2) });
  ctx.add({ title: 'Details', table: [['Sample mean', fmt(m, 4)], ['Sample SD', fmt(s, 4)], ['n', n], ['Standard error', fmt(se, 4)], ['p (one-tailed, mean > μ)', pStr(1 - K.tCdf(t, df))], ['p (one-tailed, mean < μ)', pStr(K.tCdf(t, df))], ['95% CI for the mean', `${fmt(m - tc * se, 4)} to ${fmt(m + tc * se, 4)}`], ["Cohen's d", fmt((m - mu) / s, 3)]] });
  ctx.add({ title: 'APA write-up', text: `t(${df}) = ${fmt(t, 2)}, p ${p2 < 0.001 ? '< .001' : '= ' + fmt(p2, 3).replace(/^0/, '')}, d = ${fmt((m - mu) / s, 2)}` });
}
function tTwo(ctx, a, b, paired) {
  if (paired) { if (a.length !== b.length) throw new Error('Paired t-test needs the same number of values in each group.'); const d = a.map((x, i) => x - b[i]); return tOne(ctx, mean(d), sd(d), d.length, 0, `Paired t-test (n = ${d.length} pairs), H₀: mean difference = 0`); }
  const m1 = mean(a), m2 = mean(b), v1 = variance(a), v2 = variance(b), n1 = a.length, n2 = b.length;
  const se = Math.sqrt(v1 / n1 + v2 / n2), t = (m1 - m2) / se;
  const df = (v1 / n1 + v2 / n2) ** 2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1));
  const p = 2 * (1 - K.tCdf(Math.abs(t), df));
  const sp = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2)), tp = (m1 - m2) / (sp * Math.sqrt(1 / n1 + 1 / n2)), pp = 2 * (1 - K.tCdf(Math.abs(tp), n1 + n2 - 2));
  ctx.label('t-test'); ctx.input(`Two-sample t-test: group A (n=${n1}) vs B (n=${n2})`);
  ctx.add({ title: 'Welch’s t-test (unequal variances, the safer default)', big: true, text: `t(${fmt(df, 2)}) = ${fmt(t, 3)}, p = ${pStr(p)}`, note: verdict(p) });
  const tc = K.tInv(0.975, df);
  ctx.add({ title: 'Details', table: { head: ['', 'Group A', 'Group B'], rows: [['Mean', fmt(m1, 4), fmt(m2, 4)], ['SD', fmt(Math.sqrt(v1), 4), fmt(Math.sqrt(v2), 4)], ['n', n1, n2], ['Mean difference', fmt(m1 - m2, 4), ''], ['95% CI of difference', `${fmt(m1 - m2 - tc * se, 4)} to ${fmt(m1 - m2 + tc * se, 4)}`, ''], ["Cohen's d (pooled)", fmt((m1 - m2) / sp, 3), ''], ['Student’s t (equal variances)', `t(${n1 + n2 - 2}) = ${fmt(tp, 3)}, p = ${pStr(pp)}`, '']] } });
  ctx.add({ title: 'Plot', plot: { kind: 'box', traces: [{ name: 'A', y: a }, { name: 'B', y: b }] } });
}
function chiSquare(ctx, obs, exp) {
  if (!exp) { const t = sum(obs); exp = obs.map(() => t / obs.length); }
  if (exp.length !== obs.length) throw new Error('Observed and expected need the same number of categories.');
  const tE = sum(exp), tO = sum(obs); if (Math.abs(tE - tO) > 1e-6 && tE <= 1.0001) exp = exp.map(e => e * tO); // proportions given
  const chi = sum(obs.map((o, i) => (o - exp[i]) ** 2 / exp[i])), df = obs.length - 1, p = 1 - K.chi2Cdf(chi, df);
  ctx.label('Chi-square'); ctx.input('Goodness of fit');
  ctx.add({ title: 'Result', big: true, text: `χ²(${df}) = ${fmt(chi, 3)}, p = ${pStr(p)}`, note: verdict(p) });
  ctx.add({ title: 'Table', table: { head: ['Category', 'Observed', 'Expected', '(O−E)²/E'], rows: obs.map((o, i) => [i + 1, o, fmt(exp[i], 3), fmt((o - exp[i]) ** 2 / exp[i], 4)]) } });
  if (exp.some(e => e < 5)) ctx.add({ title: 'Caution', warn: true, text: 'Some expected counts are below 5, so the χ² approximation is unreliable. Combine categories or use an exact test.' });
}
function chiIndep(ctx, M) {
  const R = M.map(r => sum(r)), C = M[0].map((_, j) => sum(M.map(r => r[j]))), N = sum(R);
  const E = M.map((r, i) => r.map((_, j) => R[i] * C[j] / N));
  const chi = sum(M.flatMap((r, i) => r.map((o, j) => (o - E[i][j]) ** 2 / E[i][j])));
  const df = (M.length - 1) * (M[0].length - 1), p = 1 - K.chi2Cdf(chi, df);
  const V = Math.sqrt(chi / (N * (Math.min(M.length, M[0].length) - 1)));
  ctx.label('Chi-square'); ctx.input(`Test of independence (${M.length}×${M[0].length})`);
  ctx.add({ title: 'Result', big: true, text: `χ²(${df}, N = ${N}) = ${fmt(chi, 3)}, p = ${pStr(p)}`, note: verdict(p) });
  ctx.add({ title: 'Expected counts', table: { head: ['', ...C.map((_, j) => `Col ${j + 1}`), 'Total'], rows: [...E.map((r, i) => [`Row ${i + 1}`, ...r.map(x => fmt(x, 2)), R[i]]), ['Total', ...C, N]] } });
  ctx.add({ title: 'Effect size', table: [["Cramér's V", fmt(V, 3)], ['Interpretation', V < 0.1 ? 'negligible' : V < 0.3 ? 'small' : V < 0.5 ? 'medium' : 'large']] });
}
function anova(ctx, groups) {
  const all = groups.flat(), gm = mean(all), k = groups.length, N = all.length;
  const ssb = sum(groups.map(g => g.length * (mean(g) - gm) ** 2)), ssw = sum(groups.map(g => sum(g.map(x => (x - mean(g)) ** 2))));
  const dfb = k - 1, dfw = N - k, F = (ssb / dfb) / (ssw / dfw), p = 1 - K.fCdf(F, dfb, dfw);
  ctx.label('ANOVA'); ctx.input(`One-way ANOVA, ${k} groups, N = ${N}`);
  ctx.add({ title: 'Result', big: true, text: `F(${dfb}, ${dfw}) = ${fmt(F, 3)}, p = ${pStr(p)}`, note: verdict(p) + (p < 0.05 ? ' At least one group mean differs; use a post-hoc test (e.g. Tukey) to see which.' : '') });
  ctx.add({ title: 'ANOVA table', table: { head: ['Source', 'SS', 'df', 'MS', 'F', 'p'], rows: [['Between', fmt(ssb, 4), dfb, fmt(ssb / dfb, 4), fmt(F, 4), pStr(p)], ['Within', fmt(ssw, 4), dfw, fmt(ssw / dfw, 4), '', ''], ['Total', fmt(ssb + ssw, 4), N - 1, '', '', '']] } });
  ctx.add({ title: 'Groups', table: { head: ['Group', 'n', 'Mean', 'SD'], rows: groups.map((g, i) => [i + 1, g.length, fmt(mean(g), 4), fmt(sd(g), 4)]) } });
  ctx.add({ title: 'η² (effect size)', text: `${fmt(ssb / (ssb + ssw), 3)}  (small ≈ .01, medium ≈ .06, large ≈ .14)` });
  ctx.add({ title: 'Plot', plot: { kind: 'box', traces: groups.map((g, i) => ({ name: `Group ${i + 1}`, y: g })) } });
}
function ciMean(ctx, m, s, n, conf) {
  const df = n - 1, tc = K.tInv(1 - (1 - conf) / 2, df), zc = K.normInv(1 - (1 - conf) / 2), se = s / Math.sqrt(n);
  ctx.label('Confidence interval'); ctx.input(`${round(conf * 100, 2)}% CI for a mean (n = ${n})`);
  ctx.add({ title: `${round(conf * 100, 2)}% confidence interval`, big: true, text: `${fmt(m - tc * se, 4)} to ${fmt(m + tc * se, 4)}`, latex: `\\bar x \\pm t^*\\frac{s}{\\sqrt n} = ${fmt(m, 4)} \\pm ${fmt(tc, 3)}\\cdot\\frac{${fmt(s, 4)}}{\\sqrt{${n}}}` });
  ctx.add({ title: 'Details', table: [['Margin of error', fmt(tc * se, 4)], ['t*', fmt(tc, 4)], ['Standard error', fmt(se, 4)], ['If σ were known (z*)', `${fmt(m - zc * se, 4)} to ${fmt(m + zc * se, 4)}`]] });
}
function ciProp(ctx, x, n, conf) {
  const p = x / n, z = K.normInv(1 - (1 - conf) / 2), se = Math.sqrt(p * (1 - p) / n);
  const den = 1 + z * z / n, ctr = (p + z * z / (2 * n)) / den, hw = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den;
  ctx.label('Confidence interval'); ctx.input(`${round(conf * 100, 2)}% CI for a proportion: ${x}/${n}`);
  ctx.add({ title: `${round(conf * 100, 2)}% interval (Wilson, recommended)`, big: true, text: `${fmt(100 * (ctr - hw), 2)}% to ${fmt(100 * (ctr + hw), 2)}%` });
  ctx.add({ title: 'Details', table: [['Sample proportion', `${fmt(100 * p, 2)}%`], ['Wald interval (textbook)', `${fmt(100 * (p - z * se), 2)}% to ${fmt(100 * (p + z * se), 2)}%`], ['Margin of error (Wald)', `±${fmt(100 * z * se, 2)} points`], ['z*', fmt(z, 4)]] });
}
function sampleSize(ctx, moe, conf, sdv, p = 0.5) {
  const z = K.normInv(1 - (1 - conf) / 2);
  const n = sdv ? (z * sdv / moe) ** 2 : z * z * p * (1 - p) / (moe ** 2);
  ctx.label('Sample size'); ctx.input(sdv ? `Mean within ±${moe}, σ = ${sdv}, ${conf * 100}% confidence` : `Proportion within ±${round(moe * 100, 3)}%, ${conf * 100}% confidence`);
  ctx.add({ title: 'Sample size needed', big: true, text: String(Math.ceil(n)), latex: sdv ? `n = \\left(\\frac{z^* \\sigma}{E}\\right)^2 = \\left(\\frac{${fmt(z, 3)}\\cdot ${sdv}}{${moe}}\\right)^2` : `n = \\frac{z^{*2}\\,p(1-p)}{E^2} = \\frac{${fmt(z, 3)}^2 \\cdot ${p}(1-${p})}{${moe}^2}` });
  if (!sdv) ctx.add({ title: 'Other margins', table: { head: ['Margin', '90%', '95%', '99%'], rows: [0.01, 0.02, 0.03, 0.05, 0.1].map(e => [`±${e * 100}%`, ...[0.9, 0.95, 0.99].map(c => Math.ceil(K.normInv(1 - (1 - c) / 2) ** 2 * 0.25 / e ** 2))]) }, note: 'p = 0.5 is the most conservative assumption. Add ~10–20% for non-response.' });
}
function zScore(ctx, x, m, s) {
  const z = (x - m) / s, pc = K.normCdf(z);
  ctx.label('z-score'); ctx.input(`x = ${x}, μ = ${m}, σ = ${s}`);
  ctx.add({ title: 'z-score', big: true, latex: `z = \\frac{${x} - ${m}}{${s}} = ${round(z, 4)}` });
  ctx.add({ title: 'Probabilities', table: [['Percentile', `${fmt(100 * pc, 2)}th`], ['P(X < x)', fmt(pc, 4)], ['P(X > x)', fmt(1 - pc, 4)], ['P(|Z| > |z|) (two-tailed)', fmt(2 * (1 - K.normCdf(Math.abs(z))), 4)]] });
}
function pValue(ctx, dist, stat, df, df2) {
  let lo, two, label;
  if (dist === 'z') { lo = K.normCdf(stat); two = 2 * (1 - K.normCdf(Math.abs(stat))); label = `z = ${stat}`; }
  else if (dist === 't') { lo = K.tCdf(stat, df); two = 2 * (1 - K.tCdf(Math.abs(stat), df)); label = `t = ${stat}, df = ${df}`; }
  else if (dist === 'chi') { lo = K.chi2Cdf(stat, df); two = null; label = `χ² = ${stat}, df = ${df}`; }
  else { lo = K.fCdf(stat, df, df2); two = null; label = `F = ${stat}, df = ${df}, ${df2}`; }
  ctx.label('p-value'); ctx.input(label);
  ctx.add({ title: 'p-value', big: true, text: two != null ? `two-tailed p = ${pStr(two)}` : `right-tailed p = ${pStr(1 - lo)}` });
  ctx.add({ title: 'All tails', table: [['Left tail P(≤)', pStr(lo)], ['Right tail P(≥)', pStr(1 - lo)], ...(two != null ? [['Two-tailed', pStr(two)]] : [])] });
}
function freqTable(ctx, a, bins) {
  const s = [...a].sort((x, y) => x - y);
  const distinct = [...new Set(s)];
  ctx.label('Frequency table'); ctx.input(`${a.length} values`);
  let rows;
  if (distinct.length <= 15 && !bins) { let cum = 0; rows = distinct.map(v => { const f = s.filter(x => x === v).length; cum += f; return [v, f, fmt(f / a.length, 4), cum, fmt(cum / a.length, 4)]; }); ctx.add({ title: 'Frequency table', table: { head: ['Value', 'Freq', 'Rel. freq', 'Cum. freq', 'Cum. rel.'], rows } }); }
  else {
    const k = bins || Math.ceil(Math.log2(a.length) + 1), lo = s[0], hi = s[s.length - 1], w = (hi - lo) / k || 1; let cum = 0;
    rows = Array.from({ length: k }, (_, i) => { const L = lo + i * w, H = L + w; const f = s.filter(x => x >= L && (i === k - 1 ? x <= H : x < H)).length; cum += f; return [`${round(L, 4)} – ${round(H, 4)}`, f, fmt(f / a.length, 4), cum, fmt(cum / a.length, 4)]; });
    ctx.add({ title: `Frequency table (${k} bins, Sturges’ rule)`, table: { head: ['Class', 'Freq', 'Rel. freq', 'Cum. freq', 'Cum. rel.'], rows } });
  }
  ctx.add({ title: 'Histogram', plot: { kind: 'histogram', x: a } });
  ctx.add(K.filesPod(K.tableFiles('frequency-table', ['Class', 'Freq', 'Rel freq', 'Cum freq', 'Cum rel'], rows)));
}
function fiveNum(ctx, a) {
  const s = [...a].sort((x, y) => x - y), q = (p) => { const i = (s.length - 1) * p, l = Math.floor(i); return s[l] + (s[Math.ceil(i)] - s[l]) * (i - l); };
  const med = (arr) => { const n = arr.length; return n % 2 ? arr[(n - 1) / 2] : (arr[n / 2 - 1] + arr[n / 2]) / 2; };
  const n = s.length, lowH = s.slice(0, Math.floor(n / 2)), upH = s.slice(Math.ceil(n / 2));
  const Q1 = med(lowH), Q3 = med(upH), iqr = Q3 - Q1, out = s.filter(x => x < Q1 - 1.5 * iqr || x > Q3 + 1.5 * iqr);
  ctx.label('Five-number summary'); ctx.input(`${n} values`);
  ctx.add({ title: 'Five-number summary', table: { head: ['Min', 'Q1', 'Median', 'Q3', 'Max'], rows: [[s[0], round(Q1, 6), round(med(s), 6), round(Q3, 6), s[n - 1]]] }, note: 'Quartiles by the median-of-halves method (TI-84/AP Stats). Excel QUARTILE.INC gives Q1 = ' + round(q(0.25), 4) + ', Q3 = ' + round(q(0.75), 4) + '.' });
  ctx.add({ title: 'Spread & outliers', table: [['IQR', round(iqr, 6)], ['Lower fence (Q1 − 1.5·IQR)', round(Q1 - 1.5 * iqr, 6)], ['Upper fence (Q3 + 1.5·IQR)', round(Q3 + 1.5 * iqr, 6)], ['Outliers', out.join(', ') || 'none'], ['Range', s[n - 1] - s[0]]] });
  ctx.add({ title: 'Box plot', plot: { kind: 'box', traces: [{ name: 'data', y: a }] } });
}

// ============================================================ chemistry
const MASS = Object.fromEntries('H 1.008 He 4.0026 Li 6.94 Be 9.0122 B 10.81 C 12.011 N 14.007 O 15.999 F 18.998 Ne 20.180 Na 22.990 Mg 24.305 Al 26.982 Si 28.085 P 30.974 S 32.06 Cl 35.45 Ar 39.948 K 39.098 Ca 40.078 Sc 44.956 Ti 47.867 V 50.942 Cr 51.996 Mn 54.938 Fe 55.845 Co 58.933 Ni 58.693 Cu 63.546 Zn 65.38 Ga 69.723 Ge 72.630 As 74.922 Se 78.971 Br 79.904 Kr 83.798 Rb 85.468 Sr 87.62 Y 88.906 Zr 91.224 Nb 92.906 Mo 95.95 Tc 98 Ru 101.07 Rh 102.91 Pd 106.42 Ag 107.87 Cd 112.41 In 114.82 Sn 118.71 Sb 121.76 Te 127.60 I 126.90 Xe 131.29 Cs 132.91 Ba 137.33 La 138.91 Ce 140.12 Pr 140.91 Nd 144.24 Pm 145 Sm 150.36 Eu 151.96 Gd 157.25 Tb 158.93 Dy 162.50 Ho 164.93 Er 167.26 Tm 168.93 Yb 173.05 Lu 174.97 Hf 178.49 Ta 180.95 W 183.84 Re 186.21 Os 190.23 Ir 192.22 Pt 195.08 Au 196.97 Hg 200.59 Tl 204.38 Pb 207.2 Bi 208.98 Po 209 At 210 Rn 222 Fr 223 Ra 226 Ac 227 Th 232.04 Pa 231.04 U 238.03 Np 237 Pu 244'.split(' ').reduce((a, x, i, arr) => (i % 2 ? a : a.concat([[x, +arr[i + 1]]])), []));
export function parseFormula(f) {
  f = f.replace(/\s+/g, '').replace(/[₀-₉]/g, (d) => '₀₁₂₃₄₅₆₇₈₉'.indexOf(d));
  const parts = f.split(/[·.*](?=\d*[A-Z(])/);
  const total = {};
  for (let part of parts) {
    let mult = 1; const lead = /^(\d+)(?=[A-Z(\[])/.exec(part); if (lead && parts.length > 1) { mult = +lead[1]; part = part.slice(lead[1].length); }
    const stack = [{}]; let i = 0;
    while (i < part.length) {
      const ch = part[i];
      if (ch === '(' || ch === '[') { stack.push({}); i++; }
      else if (ch === ')' || ch === ']') { i++; const n = /^\d+/.exec(part.slice(i)); const k = n ? +n[0] : 1; if (n) i += n[0].length; const top = stack.pop(); for (const e in top) stack[stack.length - 1][e] = (stack[stack.length - 1][e] || 0) + top[e] * k; }
      else { const m = /^([A-Z][a-z]?)(\d*)/.exec(part.slice(i)); if (!m || !(m[1] in MASS)) throw new Error(`Unknown element near “${part.slice(i, i + 3)}”.`); stack[stack.length - 1][m[1]] = (stack[stack.length - 1][m[1]] || 0) + (m[2] ? +m[2] : 1); i += m[0].length; }
    }
    if (stack.length !== 1) throw new Error('Unbalanced parentheses.');
    for (const e in stack[0]) total[e] = (total[e] || 0) + stack[0][e] * mult;
  }
  return total;
}
const molarMass = (f) => { const c = parseFormula(f); return sum(Object.entries(c).map(([e, n]) => MASS[e] * n)); };
function composition(ctx, f) {
  const c = parseFormula(f), M = molarMass(f);
  ctx.label('Percent composition'); ctx.input(f);
  ctx.add({ title: 'Molar mass', big: true, text: `${fmt(M, 3)} g/mol` });
  ctx.add({ title: 'By mass', table: { head: ['Element', 'Atoms', 'Mass (g/mol)', '% by mass'], rows: Object.entries(c).map(([e, n]) => [e, n, fmt(MASS[e] * n, 3), fmt(100 * MASS[e] * n / M, 3) + '%']) } });
  ctx.add({ title: 'Pie', plot: { kind: 'pie', labels: Object.keys(c), values: Object.entries(c).map(([e, n]) => MASS[e] * n) } });
}
function empirical(ctx, s) {
  const parts = [...s.matchAll(/([A-Z][a-z]?)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(%|g)?/g)].filter(m => m[1] in MASS);
  if (parts.length < 2) throw new Error('Give each element with its % or grams, e.g. “empirical formula C 40% H 6.7% O 53.3%”.');
  const mol = parts.map(m => [m[1], +m[2] / MASS[m[1]]]); const mn = Math.min(...mol.map(x => x[1]));
  let ratio = mol.map(([e, n]) => [e, n / mn]);
  let mult = 1; for (const k of [1, 2, 3, 4, 5, 6]) { if (ratio.every(([, r]) => Math.abs(r * k - Math.round(r * k)) < 0.1)) { mult = k; break; } }
  ratio = ratio.map(([e, r]) => [e, Math.round(r * mult)]);
  const formula = ratio.map(([e, n]) => e + (n > 1 ? n : '')).join('');
  ctx.label('Empirical formula'); ctx.input(parts.map(m => m[0]).join(', '));
  ctx.add({ title: 'Empirical formula', big: true, text: formula });
  ctx.add({ title: 'Work', table: { head: ['Element', 'Given', '÷ molar mass = mol', '÷ smallest', `× ${mult}`], rows: mol.map(([e, n], i) => [e, parts[i][2] + (parts[i][3] || ''), fmt(n, 4), fmt(n / mn, 3), ratio[i][1]]) } });
  const mm = /molar mass\s*(?:of\s*)?(\d+(?:\.\d+)?)/i.exec(s);
  if (mm) { const k = Math.round(+mm[1] / molarMass(formula)); ctx.add({ title: 'Molecular formula', big: true, text: ratio.map(([e, n]) => e + (n * k > 1 ? n * k : '')).join(''), note: `${mm[1]} ÷ ${fmt(molarMass(formula), 3)} ≈ ${k}` }); }
}
function molesGrams(ctx, amt, unit, f) {
  const M = molarMass(f); const isG = /^g|gram/i.test(unit), isMol = /^mol/i.test(unit);
  const g = isG ? amt : isMol ? amt * M : null, mol = isMol ? amt : g / M;
  ctx.label('Moles ⇄ grams'); ctx.input(`${amt} ${unit} ${f}`);
  ctx.add({ title: isG ? 'Moles' : 'Grams', big: true, latex: isG ? `${amt}\\text{ g} \\div ${fmt(M, 3)}\\text{ g/mol} = ${sig(mol, 5)}\\text{ mol}` : `${amt}\\text{ mol} \\times ${fmt(M, 3)}\\text{ g/mol} = ${sig(g, 5)}\\text{ g}` });
  ctx.add({ title: 'Also', table: [['Molar mass', `${fmt(M, 3)} g/mol`], ['Molecules', sig(mol * 6.02214076e23, 4)], ['Gas volume at STP (22.414 L/mol)', `${sig(mol * 22.414, 4)} L`]] });
}
function molarity(ctx, s) {
  const g = /(\d+(?:\.\d+)?)\s*g(?:rams?)?\s+(?:of\s+)?([A-Z][\w()]*)/.exec(s), molq = /(\d+(?:\.\d+)?)\s*mol(?:es?)?\s+(?:of\s+)?([A-Z][\w()]*)?/.exec(s), v = /(\d+(?:\.\d+)?)\s*(m?l|liters?|millilit(?:er|re)s?)\b/i.exec(s.replace(/\bmol\w*/gi, ''));
  if (!v || (!g && !molq)) return false;
  const L = /^m/i.test(v[2]) ? +v[1] / 1000 : +v[1];
  const mol = g ? +g[1] / molarMass(g[2]) : +molq[1];
  ctx.label('Molarity'); ctx.input(s);
  ctx.add({ title: 'Concentration', big: true, latex: `M = \\frac{n}{V} = \\frac{${sig(mol, 5)}\\text{ mol}}{${L}\\text{ L}} = ${sig(mol / L, 5)}\\text{ M}` });
  if (g) ctx.add({ title: 'Work', table: [['Molar mass ' + g[2], `${fmt(molarMass(g[2]), 3)} g/mol`], ['Moles', sig(mol, 5)], ['Mass concentration', `${sig(+g[1] / L, 4)} g/L`]] });
}
function dilution(ctx, M1, V1, M2, V2, vu) {
  const known = [M1, V1, M2, V2].filter(x => x != null).length; if (known !== 3) return false;
  const res = M1 == null ? ['M₁', M2 * V2 / V1, 'M'] : V1 == null ? ['V₁', M2 * V2 / M1, vu] : M2 == null ? ['M₂', M1 * V1 / V2, 'M'] : ['V₂', M1 * V1 / M2, vu];
  ctx.label('Dilution'); ctx.input('M₁V₁ = M₂V₂');
  ctx.add({ title: res[0], big: true, text: `${sig(res[1], 5)} ${res[2]}` });
  if (res[0] === 'V₁') ctx.add({ title: 'How to make it', text: `Take ${sig(res[1], 4)} ${vu} of the ${M1} M stock and add solvent up to ${V2} ${vu} total (add ${sig(V2 - res[1], 4)} ${vu}).` });
  if (res[0] === 'V₂') ctx.add({ title: 'Water to add', text: `${sig(res[1] - V1, 4)} ${vu}` });
}
const STRONG_ACIDS = /^(hcl|hbr|hi|hno3|h2so4|hclo4|hclo3)$/i, STRONG_BASES = /^(naoh|koh|lioh|rboh|csoh|ca\(oh\)2|ba\(oh\)2|sr\(oh\)2)$/i;
const KA = { ch3cooh: 1.8e-5, 'acetic acid': 1.8e-5, hf: 6.8e-4, hcooh: 1.8e-4, 'formic acid': 1.8e-4, hcn: 6.2e-10, h2co3: 4.3e-7, 'carbonic acid': 4.3e-7, nh4: 5.6e-10, hno2: 4.5e-4, 'benzoic acid': 6.3e-5, c6h5cooh: 6.3e-5, hclo: 3.0e-8, h3po4: 7.5e-3, 'phosphoric acid': 7.5e-3, 'citric acid': 7.4e-4, 'lactic acid': 1.4e-4 };
const KB = { nh3: 1.8e-5, ammonia: 1.8e-5, ch3nh2: 4.4e-4, methylamine: 4.4e-4, c5h5n: 1.7e-9, pyridine: 1.7e-9, 'aniline': 4.3e-10 };
function pH(ctx, s) {
  let m, H, how;
  const low = s.toLowerCase().trim();
  if ((m = /^\[?h\+?\]?\s*=?\s*([\d.e+-]+)/.exec(low)) || (m = /^h3o\+?\s*=?\s*([\d.e+-]+)/.exec(low))) { H = +m[1]; how = 'from [H⁺]'; }
  else if ((m = /^\[?oh-?\]?\s*=?\s*([\d.e+-]+)/.exec(low))) { H = 1e-14 / +m[1]; how = 'from [OH⁻]'; }
  else if ((m = /^poh\s*=?\s*([\d.]+)/.exec(low))) { H = 10 ** -(14 - +m[1]); how = 'from pOH'; }
  else if ((m = /^([\d.e-]+)\s*m\s+(?:of\s+)?(.+?)(?:\s+(?:with\s+)?k([ab])\s*=?\s*([\d.e-]+))?$/.exec(low))) {
    const C = +m[1], sp = m[2].replace(/\s+/g, ' ').trim();
    const ka = m[3] === 'a' ? +m[4] : KA[sp.replace(/\s/g, '')] || KA[sp], kb = m[3] === 'b' ? +m[4] : KB[sp.replace(/\s/g, '')] || KB[sp];
    const nOH = /\((oh)\)2/.test(sp) ? 2 : 1;
    if (STRONG_ACIDS.test(sp.replace(/\s/g, ''))) { H = C * (/h2so4/.test(sp) ? 1 : 1); how = `strong acid, fully dissociated: [H⁺] = ${C} M${/h2so4/.test(sp) ? ' (first proton only; the second adds a little more)' : ''}`; }
    else if (STRONG_BASES.test(sp.replace(/\s/g, ''))) { H = 1e-14 / (C * nOH); how = `strong base: [OH⁻] = ${C * nOH} M`; }
    else if (ka && m[3] !== 'b') { H = (-ka + Math.sqrt(ka * ka + 4 * ka * C)) / 2; how = `weak acid, Ka = ${ka}: solved x²/(C − x) = Ka exactly`; }
    else if (kb) { const OH = (-kb + Math.sqrt(kb * kb + 4 * kb * C)) / 2; H = 1e-14 / OH; how = `weak base, Kb = ${kb}: [OH⁻] = ${sig(OH, 4)} M`; }
    else return false;
  } else return false;
  const p = -Math.log10(H);
  ctx.label('pH'); ctx.input(s);
  ctx.add({ title: 'pH', big: true, text: fmt(p, 3), note: p < 7 ? 'Acidic' : p > 7 ? 'Basic' : 'Neutral' });
  ctx.add({ title: 'Details', table: [['Method', how], ['[H⁺]', `${sig(H, 4)} M`], ['[OH⁻]', `${sig(1e-14 / H, 4)} M`], ['pOH', fmt(14 - p, 3)]], note: 'At 25 °C (Kw = 1.0×10⁻¹⁴).' });
}
function halfLife(ctx, N0, t12, t, unit) {
  const N = N0 * 0.5 ** (t / t12), k = Math.LN2 / t12;
  ctx.label('Half-life'); ctx.input(`${N0} with half-life ${t12} ${unit}, after ${t} ${unit}`);
  ctx.add({ title: 'Remaining', big: true, latex: `N = ${N0}\\left(\\tfrac12\\right)^{${t}/${t12}} = ${sig(N, 5)}` });
  ctx.add({ title: 'Details', table: [['Half-lives elapsed', fmt(t / t12, 4)], ['Fraction left', `${fmt(100 * N / N0, 3)}%`], ['Decay constant k', `${sig(k, 4)} per ${unit}`], ['Mean lifetime', `${sig(1 / k, 4)} ${unit}`]] });
  const xs = Array.from({ length: 61 }, (_, i) => i * Math.max(t, 5 * t12) / 60);
  ctx.add({ title: 'Decay curve', plot: { kind: 'line', traces: [{ name: 'Amount', x: xs, y: xs.map(x => N0 * 0.5 ** (x / t12)) }], xtitle: unit, ytitle: 'Amount' } });
}
function idealGas(ctx, s) {
  const R = 0.082057; const o = {};
  const grab = (re, conv) => { const m = re.exec(s); if (m) return conv(+m[1], (m[2] || '').toLowerCase()); return null; };
  o.P = grab(/\bp\s*=?\s*([\d.e-]+)\s*(atm|kpa|pa|mmhg|torr|bar|psi)?/i, (v, u) => (u === 'kpa' ? v / 101.325 : u === 'pa' ? v / 101325 : u === 'mmhg' || u === 'torr' ? v / 760 : u === 'bar' ? v / 1.01325 : u === 'psi' ? v / 14.696 : v));
  o.V = grab(/\bv\s*=?\s*([\d.e-]+)\s*(l|ml|m3|cm3)?/i, (v, u) => (u === 'ml' || u === 'cm3' ? v / 1000 : u === 'm3' ? v * 1000 : v));
  o.n = grab(/\bn\s*=?\s*([\d.e-]+)\s*(mol)?/i, (v) => v);
  o.T = grab(/\bt\s*=?\s*(-?[\d.e-]+)\s*(k|c|°c|f|°f)?/i, (v, u) => (/c/.test(u) ? v + 273.15 : /f/.test(u) ? (v - 32) * 5 / 9 + 273.15 : v));
  const miss = Object.keys(o).filter(k => o[k] == null);
  if (miss.length !== 1) throw new Error('Give exactly three of P, V, n, T, e.g. “ideal gas P=1 atm V=22.4 L T=0 C”.');
  const k = miss[0];
  const val = k === 'P' ? o.n * R * o.T / o.V : k === 'V' ? o.n * R * o.T / o.P : k === 'n' ? o.P * o.V / (R * o.T) : o.P * o.V / (o.n * R);
  const unit = { P: 'atm', V: 'L', n: 'mol', T: 'K' }[k];
  ctx.label('Ideal gas law'); ctx.input('PV = nRT');
  ctx.add({ title: k, big: true, text: `${sig(val, 5)} ${unit}` });
  const extra = k === 'P' ? [['kPa', sig(val * 101.325, 5)], ['mmHg', sig(val * 760, 5)]] : k === 'T' ? [['°C', sig(val - 273.15, 5)]] : k === 'V' ? [['mL', sig(val * 1000, 5)]] : [];
  ctx.add({ title: 'Work', table: [['R', '0.082057 L·atm/(mol·K)'], ...['P', 'V', 'n', 'T'].filter(x => x !== k).map(x => [x, `${sig(o[x], 5)} ${({ P: 'atm', V: 'L', n: 'mol', T: 'K' })[x]}`]), ...extra] });
}

// ============================================================ physics & electronics
function projectile(ctx, v, deg, h0 = 0, g = 9.81) {
  const th = deg * Math.PI / 180, vx = v * Math.cos(th), vy = v * Math.sin(th);
  const T = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g, R = vx * T, H = h0 + vy * vy / (2 * g);
  ctx.label('Projectile motion'); ctx.input(`${v} m/s at ${deg}°${h0 ? `, from ${h0} m` : ''}`);
  ctx.add({ title: 'Results', table: [['Range', `${sig(R, 5)} m`], ['Max height', `${sig(H, 5)} m`], ['Time of flight', `${sig(T, 5)} s`], ['Time to peak', `${sig(vy / g, 5)} s`], ['Horizontal velocity', `${sig(vx, 5)} m/s`], ['Initial vertical velocity', `${sig(vy, 5)} m/s`], ['Impact speed', `${sig(Math.hypot(vx, vy - g * T), 5)} m/s`], ['Impact angle', `${sig(Math.atan2(g * T - vy, vx) * 180 / Math.PI, 4)}° below horizontal`]], note: `g = ${g} m/s², no air resistance.` });
  const ts = Array.from({ length: 81 }, (_, i) => i * T / 80);
  ctx.add({ title: 'Trajectory', plot: { kind: 'line', traces: [{ name: 'path', x: ts.map(t => vx * t), y: ts.map(t => h0 + vy * t - g * t * t / 2) }], xtitle: 'x (m)', ytitle: 'y (m)', equal: true } });
  ctx.add(K.filesPod(K.tableFiles('trajectory', ['t (s)', 'x (m)', 'y (m)'], ts.map(t => [round(t, 4), round(vx * t, 4), round(h0 + vy * t - g * t * t / 2, 4)]))));
}
function suvat(ctx, s) {
  const o = kv(s.replace(/\bv0\b/gi, 'u').replace(/\bvi\b/gi, 'u').replace(/\bvf\b/gi, 'v').replace(/\bd\b|\bx\b|\bΔx\b/gi, 's'));
  const g = (k) => (o[k] ? o[k].v : null);
  let [S, u, v, a, t] = ['s', 'u', 'v', 'a', 't'].map(g);
  const known = [S, u, v, a, t].filter(x => x != null).length;
  if (known < 3) throw new Error('Give any three of s (displacement), u (initial velocity), v (final velocity), a, t, e.g. “kinematics u=0 a=9.8 t=3”.');
  for (let it = 0; it < 3; it++) {
    if (v == null && u != null && a != null && t != null) v = u + a * t;
    if (S == null && u != null && t != null && a != null) S = u * t + a * t * t / 2;
    if (S == null && u != null && v != null && t != null) S = (u + v) / 2 * t;
    if (a == null && u != null && v != null && t != null) a = (v - u) / t;
    if (t == null && u != null && v != null && a != null && a) t = (v - u) / a;
    if (v == null && u != null && a != null && S != null) v = Math.sqrt(Math.max(0, u * u + 2 * a * S));
    if (u == null && v != null && a != null && S != null) u = Math.sqrt(Math.max(0, v * v - 2 * a * S));
    if (a == null && u != null && v != null && S != null && S) a = (v * v - u * u) / (2 * S);
    if (u == null && v != null && a != null && t != null) u = v - a * t;
    if (t == null && u != null && a != null && S != null) { t = a ? (-u + Math.sqrt(u * u + 2 * a * S)) / a : S / u; }
    if (u == null && S != null && t != null && a != null) u = (S - a * t * t / 2) / t;
  }
  ctx.label('Kinematics'); ctx.input('Constant acceleration (SUVAT)');
  ctx.add({ title: 'All five', table: [['s (displacement)', S, 'm'], ['u (initial velocity)', u, 'm/s'], ['v (final velocity)', v, 'm/s'], ['a (acceleration)', a, 'm/s²'], ['t (time)', t, 's']].map(([k, x, un]) => [k, x == null ? '—' : `${sig(x, 6)} ${un}`]) });
  ctx.add({ title: 'Equations', latex: `\\begin{aligned} v &= u + at \\\\ s &= ut + \\tfrac12 at^2 \\\\ v^2 &= u^2 + 2as \\\\ s &= \\tfrac{u+v}{2}t \\end{aligned}` });
}
const COLORS = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white'];
const TOL = { brown: '±1%', red: '±2%', green: '±0.5%', blue: '±0.25%', violet: '±0.1%', grey: '±0.05%', gold: '±5%', silver: '±10%', none: '±20%' };
const ohm = (r) => (r >= 1e6 ? `${round(r / 1e6, 3)} MΩ` : r >= 1e3 ? `${round(r / 1e3, 3)} kΩ` : `${round(r, 3)} Ω`);
function resistorColors(ctx, bands) {
  const b = bands.map(x => x.toLowerCase().replace('gray', 'grey').replace('purple', 'violet'));
  const digits = b.length >= 5 ? 3 : 2;
  const d = b.slice(0, digits).map(x => COLORS.indexOf(x)); if (d.some(x => x < 0)) throw new Error('Unknown digit color.');
  const mc = b[digits]; const mult = mc === 'gold' ? 0.1 : mc === 'silver' ? 0.01 : 10 ** COLORS.indexOf(mc);
  const R = +d.join('') * mult;
  ctx.label('Resistor'); ctx.input(bands.join(' '));
  ctx.add({ title: 'Resistance', big: true, text: `${ohm(R)} ${TOL[b[digits + 1]] || (b.length > digits + 1 ? '' : '±20%')}` });
}
const E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2], E24 = [1, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2, 2.2, 2.4, 2.7, 3, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];
const nearestStd = (r, series = E24) => { const e = Math.floor(Math.log10(r)); let best = null; for (const k of [e - 1, e, e + 1]) for (const s of series) { const v = round(s * 10 ** k, 6); if (!best || Math.abs(Math.log(v / r)) < Math.abs(Math.log(best / r))) best = v; } return best; };
const parseR = (s) => { const m = /^([\d.]+)\s*([kKmMrR]?)\s*([\d]*)\s*(?:ohms?|Ω)?$/.exec(s.trim()); if (!m) return NaN; const mult = { k: 1e3, K: 1e3, m: 1e6, M: 1e6, r: 1, R: 1, '': 1 }[m[2]]; return +(m[1] + (m[3] ? '.' + m[3] : '')) * mult; };
function resistorFor(ctx, s) {
  const R = parseR(s); if (!R) return false;
  const str = R.toPrecision(3).replace('.', ''); const exp = Math.floor(Math.log10(R)) - 1;
  const d = String(Math.round(R / 10 ** exp)).padStart(2, '0').slice(0, 2);
  ctx.label('Resistor'); ctx.input(ohm(R));
  ctx.add({ title: '4-band colors', big: true, text: `${COLORS[+d[0]]} · ${COLORS[+d[1]]} · ${exp >= 0 ? COLORS[exp] : exp === -1 ? 'gold' : 'silver'} · gold (±5%)`, custom: (el) => { const box = document.createElement('div'); box.className = 'resistor'; const hexes = { black: '#000', brown: '#7b3f00', red: '#e00', orange: '#f80', yellow: '#fd0', green: '#0a0', blue: '#03f', violet: '#90c', grey: '#888', white: '#fff', gold: '#d4af37', silver: '#c0c0c0' }; [COLORS[+d[0]], COLORS[+d[1]], exp >= 0 ? COLORS[exp] : exp === -1 ? 'gold' : 'silver', 'gold'].forEach(c => { const sp = document.createElement('span'); sp.style.background = hexes[c]; box.append(sp); }); el.append(box); } });
  ctx.add({ title: 'Nearest standard values', table: [['E12 (10%)', ohm(nearestStd(R, E12))], ['E24 (5%)', ohm(nearestStd(R, E24))]] });
  void str;
}
function combine(ctx, kind, mode, vals) {
  const inv = (a) => 1 / sum(a.map(x => 1 / x));
  const series = (kind === 'c' ? mode === 'parallel' : mode === 'series');
  const r = series ? sum(vals) : inv(vals);
  const unit = kind === 'r' ? 'Ω' : kind === 'c' ? 'F' : 'H';
  ctx.label(kind === 'r' ? 'Resistors' : kind === 'c' ? 'Capacitors' : 'Inductors'); ctx.input(`${vals.join(', ')} in ${mode}`);
  ctx.add({ title: 'Equivalent', big: true, text: kind === 'r' ? ohm(r) : `${sig(r, 5)} (same units as given)`, latex: series ? `${kind.toUpperCase()}_{eq} = ${vals.join(' + ')}` : `\\frac{1}{${kind.toUpperCase()}_{eq}} = ${vals.map(v => `\\frac{1}{${v}}`).join(' + ')}` });
  if (kind === 'r' && vals.length === 2 && !series) ctx.add({ title: 'Shortcut for two', latex: `\\frac{R_1 R_2}{R_1 + R_2} = \\frac{${vals[0]}\\cdot${vals[1]}}{${vals[0]}+${vals[1]}}` });
  void unit;
}
function divider(ctx, vin, r1, r2) {
  const vout = vin * r2 / (r1 + r2), I = vin / (r1 + r2);
  ctx.label('Voltage divider'); ctx.input(`Vin ${vin} V, R1 ${ohm(r1)}, R2 ${ohm(r2)}`);
  ctx.add({ title: 'Vout (across R2)', big: true, latex: `V_{out} = V_{in}\\frac{R_2}{R_1+R_2} = ${sig(vout, 5)}\\text{ V}` });
  ctx.add({ title: 'Details', table: [['Current', `${sig(I * 1000, 4)} mA`], ['Power in R1', `${sig(I * I * r1 * 1000, 4)} mW`], ['Power in R2', `${sig(I * I * r2 * 1000, 4)} mW`], ['Note', 'A load on Vout acts in parallel with R2 and lowers Vout.']] });
}
function ledResistor(ctx, vs, vf, ma) {
  const R = (vs - vf) / (ma / 1000);
  ctx.label('LED resistor'); ctx.input(`${vs} V supply, ${vf} V LED, ${ma} mA`);
  if (R <= 0) throw new Error('Supply voltage must be above the LED forward voltage.');
  const std = E12.flatMap(x => [x, x * 10, x * 100, x * 1000, x * 1e4]).filter(x => x >= R).sort((a, b) => a - b)[0];
  ctx.add({ title: 'Resistor', big: true, text: `${ohm(R)} → use ${ohm(std)} (next standard value up)` });
  ctx.add({ title: 'Details', table: [['Actual current with ' + ohm(std), `${sig((vs - vf) / std * 1000, 4)} mA`], ['Resistor power', `${sig((vs - vf) ** 2 / std * 1000, 3)} mW (a ¼ W resistor handles 250 mW)`], ['Typical Vf', 'red 1.8–2.2 V · yellow/green 2.0–2.2 · blue/white 3.0–3.3']] });
}
function ohmsLaw(ctx, s) {
  const o = kv(s);
  let V = o.v ? o.v.v : null, I = o.i ? o.i.v * (/^ma$/i.test(o.i.u) ? 1e-3 : 1) : null, R = o.r ? o.r.v * (/^k/i.test(o.r.u) ? 1e3 : /^M/.test(o.r.u) ? 1e6 : 1) : null, P = o.p ? o.p.v * (/^mw$/i.test(o.p.u) ? 1e-3 : 1) : null;
  const n = [V, I, R, P].filter(x => x != null).length; if (n < 2) return false;
  for (let k = 0; k < 2; k++) {
    if (V == null && I != null && R != null) V = I * R; if (I == null && V != null && R != null) I = V / R; if (R == null && V != null && I != null) R = V / I;
    if (P == null && V != null && I != null) P = V * I; if (V == null && P != null && I != null) V = P / I; if (I == null && P != null && V != null) I = P / V;
    if (V == null && P != null && R != null) V = Math.sqrt(P * R); if (I == null && P != null && R != null) I = Math.sqrt(P / R);
  }
  ctx.label('Ohm’s law'); ctx.input(s);
  ctx.add({ title: 'Values', table: [['Voltage V', `${sig(V, 5)} V`], ['Current I', `${sig(I, 5)} A (${sig(I * 1000, 4)} mA)`], ['Resistance R', ohm(R)], ['Power P', `${sig(P, 5)} W`]] });
  ctx.add({ title: 'Formulas', latex: 'V = IR \\quad P = VI = I^2R = \\frac{V^2}{R}' });
}
function rcTime(ctx, R, C, kind = 'RC') {
  const tau = kind === 'RC' ? R * C : C / R; // for RL, C holds L
  ctx.label(`${kind} circuit`); ctx.input(kind === 'RC' ? `R = ${ohm(R)}, C = ${sig(C, 4)} F` : `R = ${ohm(R)}, L = ${sig(C, 4)} H`);
  ctx.add({ title: 'Time constant τ', big: true, text: tau >= 1 ? `${sig(tau, 4)} s` : tau >= 1e-3 ? `${sig(tau * 1e3, 4)} ms` : `${sig(tau * 1e6, 4)} µs` });
  ctx.add({ title: 'Charging', table: { head: ['Time', '% of final'], rows: [1, 2, 3, 4, 5].map(k => [`${k}τ = ${sig(k * tau, 4)} s`, `${fmt(100 * (1 - Math.exp(-k)), 2)}%`]) } });
  if (kind === 'RC') ctx.add({ title: 'As a low-pass filter', text: `Cutoff frequency f = 1/(2πRC) = ${sig(1 / (2 * Math.PI * tau), 5)} Hz` });
}
function photon(ctx, val, unit) {
  const c = 299792458, h = 6.62607015e-34, eV = 1.602176634e-19;
  let lam;
  if (/nm/.test(unit)) lam = val * 1e-9; else if (/µm|um/.test(unit)) lam = val * 1e-6; else if (/^m$/.test(unit)) lam = val;
  else if (/thz/i.test(unit)) lam = c / (val * 1e12); else if (/ghz/i.test(unit)) lam = c / (val * 1e9); else if (/mhz/i.test(unit)) lam = c / (val * 1e6); else if (/khz/i.test(unit)) lam = c / (val * 1e3); else if (/hz/i.test(unit)) lam = c / val;
  else if (/ev/i.test(unit)) lam = h * c / (val * eV); else if (/^j$/i.test(unit)) lam = h * c / val; else return false;
  const f = c / lam, E = h * f;
  const band = lam < 1e-11 ? 'Gamma ray' : lam < 1e-8 ? 'X-ray' : lam < 380e-9 ? 'Ultraviolet' : lam < 450e-9 ? 'Visible (violet)' : lam < 495e-9 ? 'Visible (blue)' : lam < 570e-9 ? 'Visible (green)' : lam < 590e-9 ? 'Visible (yellow)' : lam < 620e-9 ? 'Visible (orange)' : lam < 750e-9 ? 'Visible (red)' : lam < 1e-3 ? 'Infrared' : lam < 1 ? 'Microwave' : 'Radio';
  ctx.label('Electromagnetic wave'); ctx.input(`${val} ${unit}`);
  ctx.add({ title: band, table: [['Wavelength', lam >= 1 ? `${sig(lam, 5)} m` : lam >= 1e-6 ? `${sig(lam * 1e6, 5)} µm` : `${sig(lam * 1e9, 5)} nm`], ['Frequency', `${sig(f, 5)} Hz`], ['Photon energy', `${sig(E, 5)} J = ${sig(E / eV, 5)} eV`], ['Energy per mole of photons', `${sig(E * 6.02214076e23 / 1000, 5)} kJ/mol`]] });
  ctx.add({ title: 'Formulas', latex: 'c = \\lambda f \\qquad E = hf = \\frac{hc}{\\lambda}' });
}
function lens(ctx, f, dO, dI) {
  if (f == null) f = 1 / (1 / dO + 1 / dI); else if (dI == null) dI = 1 / (1 / f - 1 / dO); else dO = 1 / (1 / f - 1 / dI);
  const M = -dI / dO;
  ctx.label('Thin lens / mirror'); ctx.input('1/f = 1/dₒ + 1/dᵢ');
  ctx.add({ title: 'Results', table: [['Focal length f', sig(f, 5)], ['Object distance dₒ', sig(dO, 5)], ['Image distance dᵢ', sig(dI, 5)], ['Magnification', sig(M, 4)], ['Image', `${dI > 0 ? 'Real' : 'Virtual'}, ${M < 0 ? 'inverted' : 'upright'}, ${Math.abs(M) > 1 ? 'enlarged' : Math.abs(M) < 1 ? 'reduced' : 'same size'}`]], note: 'Sign convention: real image distances positive; diverging lens / convex mirror has negative f.' });
}
function snell(ctx, n1, n2, a1) {
  const s = n1 * Math.sin(a1 * Math.PI / 180) / n2;
  ctx.label('Snell’s law'); ctx.input(`n₁ = ${n1}, n₂ = ${n2}, θ₁ = ${a1}°`);
  if (Math.abs(s) > 1) ctx.add({ title: 'Total internal reflection', big: true, text: 'No refracted ray: θ₁ is beyond the critical angle.' });
  else ctx.add({ title: 'Refraction angle θ₂', big: true, text: `${sig(Math.asin(s) * 180 / Math.PI, 5)}°`, latex: `n_1\\sin\\theta_1 = n_2\\sin\\theta_2` });
  if (n1 > n2) ctx.add({ title: 'Critical angle', text: `${sig(Math.asin(n2 / n1) * 180 / Math.PI, 5)}°` });
}
const BODIES = { earth: [5.972e24, 6.371e6], moon: [7.342e22, 1.737e6], mars: [6.417e23, 3.39e6], sun: [1.989e30, 6.957e8], jupiter: [1.898e27, 6.9911e7], venus: [4.867e24, 6.052e6], mercury: [3.301e23, 2.44e6], saturn: [5.683e26, 5.8232e7] };
function orbit(ctx, alt, body = 'earth') {
  const [M, R] = BODIES[body] || BODIES.earth; const G = 6.674e-11, r = R + alt * 1000, mu = G * M;
  const v = Math.sqrt(mu / r), T = 2 * Math.PI * Math.sqrt(r ** 3 / mu);
  ctx.label('Circular orbit'); ctx.input(`${alt} km above ${K.cap(body)}`);
  ctx.add({ title: 'Orbit', table: [['Orbital speed', `${sig(v / 1000, 5)} km/s`], ['Period', T > 86400 ? `${sig(T / 86400, 4)} days` : `${sig(T / 60, 5)} min`], ['Escape speed there', `${sig(Math.sqrt(2) * v / 1000, 5)} km/s`], ['Gravity there', `${sig(mu / r ** 2, 4)} m/s²`], ['Geostationary altitude (Earth)', '35,786 km']] });
}
function decibel(ctx, kind, x) {
  ctx.label('Decibels'); ctx.input(`${kind} ${x}`);
  if (kind === 'to ratio') ctx.add({ title: `${x} dB is`, table: [['Power ratio', sig(10 ** (x / 10), 5)], ['Voltage / amplitude ratio', sig(10 ** (x / 20), 5)]] });
  else ctx.add({ title: `Ratio ${x} is`, table: [['As power', `${sig(10 * Math.log10(x), 5)} dB`], ['As voltage / amplitude', `${sig(20 * Math.log10(x), 5)} dB`]] });
  ctx.add({ title: 'Rules of thumb', text: '+3 dB ≈ double power · +6 dB ≈ double voltage · +10 dB = 10× power · +20 dB = 10× voltage' });
}

// ============================================================ biology
const CODON = (() => { const b = 'UCAG', aa = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG'; const t = {}; let i = 0; for (const x of b) for (const y of b) for (const z of b) t[x + y + z] = aa[i++]; return t; })();
const AA3 = { A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', E: 'Glu', Q: 'Gln', G: 'Gly', H: 'His', I: 'Ile', L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe', P: 'Pro', S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val', '*': 'Stop' };
const AAMW = { A: 71.0788, R: 156.1875, N: 114.1038, D: 115.0886, C: 103.1388, E: 129.1155, Q: 128.1307, G: 57.0519, H: 137.1411, I: 113.1594, L: 113.1594, K: 128.1741, M: 131.1926, F: 147.1766, P: 97.1167, S: 87.0782, T: 101.1051, W: 186.2132, Y: 163.1760, V: 99.1326 };
function dna(ctx, seq) {
  const s = seq.toUpperCase().replace(/[^ACGTU]/g, ''); const isRNA = s.includes('U') && !s.includes('T');
  const d = s.replace(/U/g, 'T');
  const comp = d.replace(/[ACGT]/g, c => ({ A: 'T', T: 'A', C: 'G', G: 'C' })[c]);
  const mrna = d.replace(/T/g, 'U');
  const gc = (d.match(/[GC]/g) || []).length / d.length;
  const tm = d.length < 14 ? 2 * (d.match(/[AT]/g) || []).length + 4 * (d.match(/[GC]/g) || []).length : 64.9 + 41 * ((d.match(/[GC]/g) || []).length - 16.4) / d.length;
  const translate = (r) => { let p = ''; for (let i = 0; i + 3 <= r.length; i += 3) p += CODON[r.slice(i, i + 3)]; return p; };
  const start = mrna.indexOf('AUG');
  const orf = start >= 0 ? translate(mrna.slice(start)).split('*')[0] : '';
  ctx.label(isRNA ? 'RNA' : 'DNA'); ctx.input(`${d.length} nt`);
  const g = (x) => x.replace(/(.{10})(?=.)/g, '$1 ');
  ctx.add({ title: 'Strands', table: [['Given (5′→3′)', g(d)], ['Complement (3′→5′)', g(comp)], ['Reverse complement (5′→3′)', g([...comp].reverse().join(''))], ['mRNA (transcribed from this coding strand)', g(mrna)]], copyRows: false });
  ctx.add({ title: 'Translation', table: [['Frame 1', translate(mrna)], ['From first AUG (ORF)', orf ? `${orf}  (${orf.length} aa)` : 'no AUG'], ['3-letter', orf ? [...orf].map(a => AA3[a]).join('-') : '—']] });
  ctx.add({ title: 'Properties', table: [['Length', `${d.length} nt`], ['GC content', `${fmt(100 * gc, 2)}%`], ['Melting temp (est.)', `${fmt(tm, 1)} °C (${d.length < 14 ? 'Wallace rule' : 'basic GC formula'})`], ['A / C / G / T', ['A', 'C', 'G', 'T'].map(b => (d.match(new RegExp(b, 'g')) || []).length).join(' / ')], ['MW (dsDNA, approx.)', `${sig(d.length * 617.96 + 36, 5)} g/mol`]] });
}
function protein(ctx, seq) {
  const s = seq.toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g, '');
  const mw = sum([...s].map(a => AAMW[a])) + 18.015;
  const cnt = {}; [...s].forEach(a => (cnt[a] = (cnt[a] || 0) + 1));
  const eps = (cnt.W || 0) * 5500 + (cnt.Y || 0) * 1490 + Math.floor((cnt.C || 0) / 2) * 125;
  ctx.label('Protein'); ctx.input(`${s.length} aa`);
  ctx.add({ title: 'Molecular weight', big: true, text: `${fmt(mw, 2)} Da (${fmt(mw / 1000, 2)} kDa)` });
  ctx.add({ title: 'Composition', table: { head: ['Amino acid', 'Count', '%'], rows: Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([a, n]) => [`${a} (${AA3[a]})`, n, fmt(100 * n / s.length, 1)]) } });
  ctx.add({ title: 'Other', table: [['Extinction coefficient (280 nm)', `${eps} M⁻¹cm⁻¹ (cystines assumed)`], ['Charged residues (D+E / K+R)', `${(cnt.D || 0) + (cnt.E || 0)} / ${(cnt.K || 0) + (cnt.R || 0)}`]] });
}
function punnett(ctx, p1, p2) {
  const genes = (g) => { const pairs = g.match(/[A-Za-z]{2}/g); return pairs; };
  const a = genes(p1), b = genes(p2);
  if (!a || !b || a.length !== b.length || a.length > 3) throw new Error('Write parents like “Aa x Aa” or “AaBb x aabb” (up to 3 genes).');
  const gametes = (pairs) => pairs.reduce((acc, p) => acc.flatMap(x => [x + p[0], x + p[1]]), ['']);
  const ga = gametes(a), gb = gametes(b);
  const norm = (x, y) => [...Array(a.length)].map((_, i) => [x[i], y[i]].sort((u, v) => (u === u.toUpperCase() ? -1 : 1) - (v === v.toUpperCase() ? -1 : 1) || u.localeCompare(v)).join('')).join('');
  const grid = ga.map(x => gb.map(y => norm(x, y)));
  const geno = {}, pheno = {};
  grid.flat().forEach(g => { geno[g] = (geno[g] || 0) + 1; const ph = (g.match(/../g)).map(p => (/[A-Z]/.test(p) ? p[0].toUpperCase() + '_' : p)).join(''); pheno[ph] = (pheno[ph] || 0) + 1; });
  const N = grid.flat().length;
  ctx.label('Punnett square'); ctx.input(`${p1} × ${p2}`);
  ctx.add({ title: 'Square', table: { head: ['', ...gb], rows: ga.map((x, i) => [x, ...grid[i]]) } });
  ctx.add({ title: 'Genotypes', table: { head: ['Genotype', 'Count', 'Fraction', '%'], rows: Object.entries(geno).map(([g, n]) => [g, n, `${n}/${N}`, fmt(100 * n / N, 2)]) } });
  ctx.add({ title: 'Phenotypes (complete dominance)', table: { head: ['Phenotype', 'Count', '%'], rows: Object.entries(pheno).sort((x, y) => y[1] - x[1]).map(([g, n]) => [g, n, fmt(100 * n / N, 2)]) }, note: `Ratio ${Object.values(pheno).sort((x, y) => y - x).join(' : ')}. “A_” means at least one dominant allele.` });
}
function hardy(ctx, kind, x) {
  let p, q;
  if (kind === 'q2') { q = Math.sqrt(x); p = 1 - q; } else if (kind === 'p2') { p = Math.sqrt(x); q = 1 - p; } else if (kind === 'q') { q = x; p = 1 - x; } else { p = x; q = 1 - x; }
  ctx.label('Hardy–Weinberg'); ctx.input(`${kind} = ${x}`);
  ctx.add({ title: 'Frequencies', table: [['p (dominant allele)', fmt(p, 4)], ['q (recessive allele)', fmt(q, 4)], ['p² (homozygous dominant)', `${fmt(p * p, 4)} (${fmt(100 * p * p, 2)}%)`], ['2pq (heterozygous / carriers)', `${fmt(2 * p * q, 4)} (${fmt(200 * p * q, 2)}%)`], ['q² (homozygous recessive)', `${fmt(q * q, 4)} (${fmt(100 * q * q, 2)}%)`]] });
  ctx.add({ title: 'Equations', latex: 'p + q = 1 \\qquad p^2 + 2pq + q^2 = 1' });
}

// ============================================================ discrete math
function parseSet(s) { return s.replace(/[{}[\]]/g, '').split(/\s*,\s*|\s+/).filter(Boolean).map(x => (isNaN(x) ? x : +x)); }
function setOps(ctx, A, B) {
  const a = [...new Set(A)], b = [...new Set(B)];
  const has = (arr, x) => arr.some(y => y === x);
  const show = (arr) => `{${arr.join(', ')}}`;
  ctx.label('Sets'); ctx.input(`A = ${show(a)}, B = ${show(b)}`);
  ctx.add({ title: 'Operations', table: [['A ∪ B', show([...a, ...b.filter(x => !has(a, x))])], ['A ∩ B', show(a.filter(x => has(b, x)))], ['A − B', show(a.filter(x => !has(b, x)))], ['B − A', show(b.filter(x => !has(a, x)))], ['A △ B', show([...a.filter(x => !has(b, x)), ...b.filter(x => !has(a, x))])], ['|A|, |B|', `${a.length}, ${b.length}`], ['A ⊆ B?', a.every(x => has(b, x)) ? 'Yes' : 'No'], ['B ⊆ A?', b.every(x => has(a, x)) ? 'Yes' : 'No'], ['Disjoint?', a.some(x => has(b, x)) ? 'No' : 'Yes'], ['|A × B|', a.length * b.length]] });
  if (a.length * b.length <= 36) ctx.add({ title: 'A × B', text: show(a.flatMap(x => b.map(y => `(${x}, ${y})`))) });
}
function listPerms(ctx, items, k, kind) {
  const out = [];
  const perm = (pre, rest) => { if (out.length > 5040) return; if (pre.length === k) { out.push(pre); return; } rest.forEach((x, i) => perm([...pre, x], rest.filter((_, j) => j !== i))); };
  const comb = (start, pre) => { if (out.length > 5040) return; if (pre.length === k) { out.push(pre); return; } for (let i = start; i < items.length; i++) comb(i + 1, [...pre, items[i]]); };
  if (kind === 'perm') perm([], items); else if (kind === 'comb') comb(0, []); else for (let m = 0; m < 1 << items.length && m < 4096; m++) out.push(items.filter((_, i) => m >> i & 1));
  ctx.label(kind === 'perm' ? 'Permutations' : kind === 'comb' ? 'Combinations' : 'Power set'); ctx.input(`${items.join(', ')}${kind !== 'power' ? `, choose ${k}` : ''}`);
  ctx.add({ title: `${out.length}${out.length > 5040 ? '+' : ''} ${kind === 'power' ? 'subsets' : 'arrangements'}`, pre: out.slice(0, 720).map(x => (kind === 'power' ? `{${x.join(', ')}}` : x.join(items.every(i => String(i).length === 1) ? '' : ' '))).join('\n') + (out.length > 720 ? '\n…' : '') });
  ctx.add(K.filesPod(K.tableFiles(kind, ['#', 'Items'], out.map((x, i) => [i + 1, x.join(' ')]))));
}
function decToFrac(ctx, s) {
  let m = /^(-?)(\d*)\.(\d*)\((\d+)\)$/.exec(s.replace(/\s/g, '')) || /^(-?)(\d*)\.(\d*?)(\d+)\.\.\.$/.exec(s.replace(/\s/g, ''));
  let num, den;
  const g = (a, b) => (b ? g(b, a % b) : a);
  if (m && (s.includes('(') || s.includes('...'))) {
    const [, sign, ip, nr, rp] = m; const whole = BigInt((ip || '0') + nr + rp) - BigInt((ip || '0') + nr);
    const d = BigInt('9'.repeat(rp.length) + '0'.repeat(nr.length)); const gg = (a, b) => (b ? gg(b, a % b) : a); const k = gg(whole, d);
    num = (sign ? -1n : 1n) * whole / k; den = d / k;
  } else {
    const v = s.trim(); if (!/^-?\d*\.\d+$/.test(v)) return false;
    const dp = v.split('.')[1].length; let n = Math.round(Math.abs(+v) * 10 ** dp), d = 10 ** dp; const k = g(n, d); num = (v.startsWith('-') ? -1 : 1) * n / k; den = d / k;
  }
  ctx.label('Fraction'); ctx.input(s);
  const N = BigInt(num), D = BigInt(den), whole = N / D, rem = (N < 0n ? -N : N) % D;
  ctx.add({ title: 'As a fraction', big: true, latex: `\\frac{${N}}{${D}}` });
  if (whole !== 0n && rem !== 0n) ctx.add({ title: 'Mixed number', latex: `${whole}\\tfrac{${rem}}{${D}}` });
}
function dijkstra(ctx, s, from, to) {
  const edges = [...s.matchAll(/([A-Za-z0-9_]+)\s*(?:-|–|to|->|—)\s*([A-Za-z0-9_]+)\s*(?:[:=,]|\s)\s*(\d+(?:\.\d+)?)/g)].map(m => [m[1], m[2], +m[3]]);
  if (!edges.length) throw new Error('List edges like “A-B 4, B-C 2, A-C 7”.');
  const directed = /directed|->/.test(s);
  const G = {}; edges.forEach(([a, b, w]) => { (G[a] ||= []).push([b, w]); if (!directed) (G[b] ||= []).push([a, w]); G[b] ||= []; });
  const nodes = Object.keys(G); from ||= nodes[0];
  const D = Object.fromEntries(nodes.map(n => [n, Infinity])), P = {}; D[from] = 0; const Q = new Set(nodes);
  while (Q.size) { const u = [...Q].reduce((a, b) => (D[a] <= D[b] ? a : b)); Q.delete(u); for (const [v, w] of G[u]) if (D[u] + w < D[v]) { D[v] = D[u] + w; P[v] = u; } }
  const path = (t) => { const p = [t]; while (P[p[0]]) p.unshift(P[p[0]]); return p[0] === from ? p : null; };
  ctx.label('Shortest path'); ctx.input(`Dijkstra from ${from}${directed ? ' (directed)' : ''}`);
  if (to) ctx.add({ title: `${from} → ${to}`, big: true, text: D[to] === Infinity ? 'No path' : `${path(to).join(' → ')}  (total ${D[to]})` });
  ctx.add({ title: 'Distances from ' + from, table: { head: ['Node', 'Distance', 'Path'], rows: nodes.map(n => [n, D[n] === Infinity ? '∞' : D[n], D[n] === Infinity ? '—' : path(n).join(' → ')]) } });
  // MST (Kruskal) for undirected graphs
  if (!directed) { const par = Object.fromEntries(nodes.map(n => [n, n])); const f = (x) => (par[x] === x ? x : (par[x] = f(par[x]))); const mst = [...edges].sort((a, b) => a[2] - b[2]).filter(([a, b]) => { const ra = f(a), rb = f(b); if (ra === rb) return false; par[ra] = rb; return true; }); ctx.add({ title: `Minimum spanning tree (Kruskal), total ${sum(mst.map(e => e[2]))}`, text: mst.map(([a, b, w]) => `${a}–${b} (${w})`).join(', ') }); }
}
function lineThrough(ctx, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  ctx.label('Line'); ctx.input(`(${x1}, ${y1}) and (${x2}, ${y2})`);
  if (dx === 0) { ctx.add({ title: 'Vertical line', big: true, latex: `x = ${x1}` }); return; }
  const m = dy / dx, b = y1 - m * x1;
  const g = (a, c) => (c ? g(c, a % c) : Math.abs(a)); const isInt = Number.isInteger(dx) && Number.isInteger(dy);
  const mTex = isInt && !Number.isInteger(m) ? `${dy * dx < 0 ? '-' : ''}\\frac{${Math.abs(dy) / g(dy, dx)}}{${Math.abs(dx) / g(dy, dx)}}` : String(round(m, 6));
  ctx.add({ title: 'Equation', big: true, latex: `y = ${mTex}x ${b >= 0 ? '+' : '-'} ${round(Math.abs(b), 6)}` });
  ctx.add({ title: 'Details', table: [['Slope', `${round(m, 6)}${isInt ? ` = ${dy}/${dx}` : ''}`], ['y-intercept', round(b, 6)], ['x-intercept', m ? round(-b / m, 6) : 'none'], ['Point-slope', `y − ${y1} = ${round(m, 6)}(x − ${x1})`], ['Standard form', isInt ? `${dy}x − ${dx}y = ${dy * x1 - dx * y1}` : '—'], ['Distance', `${round(Math.hypot(dx, dy), 6)}`], ['Midpoint', `(${round((x1 + x2) / 2, 6)}, ${round((y1 + y2) / 2, 6)})`], ['Perpendicular slope', m ? round(-1 / m, 6) : 'undefined'], ['Angle with x-axis', `${round(Math.atan(m) * 180 / Math.PI, 4)}°`]] });
}
function triangle(ctx, s) {
  const o = {}; for (const m of s.matchAll(/\b([abcABC])\s*=\s*([\d.]+)/g)) o[m[1]] = +m[2];
  let { a, b, c, A, B, C } = o; const r = Math.PI / 180;
  const known = Object.keys(o).length; if (known < 3 || ![a, b, c].some(x => x)) throw new Error('Give 3 values including at least one side, e.g. “triangle a=5 b=7 C=40” (lowercase sides, uppercase angles in degrees).');
  const notes = [];
  let alt = null;
  for (let k = 0; k < 4; k++) {
    const angs = [A, B, C].filter(x => x != null); if (angs.length === 2) { if (A == null) A = 180 - B - C; if (B == null) B = 180 - A - C; if (C == null) C = 180 - A - B; }
    if (a && b && c && A == null) { A = Math.acos((b * b + c * c - a * a) / (2 * b * c)) / r; B = Math.acos((a * a + c * c - b * b) / (2 * a * c)) / r; C = 180 - A - B; notes.push('SSS: law of cosines'); }
    if (a == null && b && c && A != null) { a = Math.sqrt(b * b + c * c - 2 * b * c * Math.cos(A * r)); notes.push('SAS: law of cosines'); }
    if (b == null && a && c && B != null) { b = Math.sqrt(a * a + c * c - 2 * a * c * Math.cos(B * r)); notes.push('SAS: law of cosines'); }
    if (c == null && a && b && C != null) { c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(C * r)); notes.push('SAS: law of cosines'); }
    const pairs = [['a', 'A'], ['b', 'B'], ['c', 'C']]; const vals = { a, b, c, A, B, C };
    const full = pairs.find(([s1, an]) => vals[s1] && vals[an] != null);
    if (full) { const ratio = vals[full[0]] / Math.sin(vals[full[1]] * r);
      for (const [s1, an] of pairs) {
        if (vals[an] != null && !vals[s1]) { vals[s1] = ratio * Math.sin(vals[an] * r); notes.push('Law of sines'); }
        else if (vals[s1] && vals[an] == null) { const sn = vals[s1] / ratio; if (sn > 1) throw new Error('No triangle has those measurements.'); const ang = Math.asin(sn) / r; const other = [A, B, C].filter(x => x != null)[0]; if (180 - ang + other < 180 && Math.abs(180 - ang - ang) > 1e-9 && vals[s1] > 0 && pairs.filter(p => vals[p[1]] != null).length === 1) alt = { an, ang: 180 - ang }; vals[an] = ang; notes.push('Law of sines (SSA: check for a second triangle)'); }
      }
      ({ a, b, c, A, B, C } = vals);
    }
  }
  if ([a, b, c, A, B, C].some(x => x == null || isNaN(x))) throw new Error('Not enough information to solve that triangle.');
  const area = 0.5 * a * b * Math.sin(C * r);
  ctx.label('Triangle'); ctx.input(s);
  ctx.add({ title: 'Solved', table: { head: ['', 'Side', 'Opposite angle'], rows: [['a / A', round(a, 5), `${round(A, 4)}°`], ['b / B', round(b, 5), `${round(B, 4)}°`], ['c / C', round(c, 5), `${round(C, 4)}°`]] } });
  ctx.add({ title: 'Properties', table: [['Perimeter', round(a + b + c, 5)], ['Area', round(area, 5)], ['Type', `${[A, B, C].some(x => Math.abs(x - 90) < 1e-6) ? 'Right' : [A, B, C].some(x => x > 90) ? 'Obtuse' : 'Acute'}, ${Math.abs(a - b) < 1e-9 && Math.abs(b - c) < 1e-9 ? 'equilateral' : Math.abs(a - b) < 1e-9 || Math.abs(b - c) < 1e-9 || Math.abs(a - c) < 1e-9 ? 'isosceles' : 'scalene'}`], ['Circumradius', round(a / (2 * Math.sin(A * r)), 5)], ['Inradius', round(2 * area / (a + b + c), 5)], ['Method', [...new Set(notes)].join('; ')]] });
  if (alt) ctx.add({ title: 'Ambiguous case', warn: true, text: `SSA can give two triangles. The other has ${alt.an} = ${round(alt.ang, 4)}°. Try it with that angle given.` });
}
function oeis(ctx, seq, d) {
  return d.get(`https://oeis.org/search?q=${K.enc(seq.join(','))}&fmt=json`, { proxy: true }).then(r => {
    const res = (Array.isArray(r) ? r : r && r.results) || [];
    ctx.label('Sequence'); ctx.input(seq.join(', '));
    if (!res.length) { ctx.add({ title: 'Not in the OEIS', text: 'No known integer sequence starts like that.' }); return; }
    const top = res[0], terms = top.data.split(',').map(Number); const i = terms.findIndex((_, j) => seq.every((x, k) => terms[j + k] === x));
    ctx.add({ title: `A${String(top.number).padStart(6, '0')}: ${top.name}`, big: false, text: i >= 0 ? `Next terms: ${terms.slice(i + seq.length, i + seq.length + 8).join(', ')}` : top.data.slice(0, 200) });
    if (top.formula) ctx.add({ title: 'Formula', pre: top.formula.slice(0, 4).join('\n') });
    ctx.add({ title: 'Other matches', list: res.slice(1, 8).map(x => ({ title: `A${String(x.number).padStart(6, '0')}`, url: `https://oeis.org/A${String(x.number).padStart(6, '0')}`, snippet: x.name })) });
    ctx.source('OEIS', `https://oeis.org/A${String(top.number).padStart(6, '0')}`);
  });
}
function qmSimplify(ctx, minterms, nvars, dc = [], names) {
  names ||= 'ABCDEFGH'.slice(0, nvars).split('');
  const bits = (n) => n.toString(2).padStart(nvars, '0');
  let groups = [...minterms, ...dc].map(m => ({ t: bits(m), m: [m], used: false }));
  const primes = [];
  while (groups.length) {
    const next = []; const seen = new Set();
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i].t, b = groups[j].t; let diff = 0, pos = -1;
      for (let k = 0; k < nvars; k++) if (a[k] !== b[k]) { diff++; pos = k; }
      if (diff === 1 && (a[pos] !== '-' && b[pos] !== '-')) { groups[i].used = groups[j].used = true; const t = a.slice(0, pos) + '-' + a.slice(pos + 1); if (!seen.has(t)) { seen.add(t); next.push({ t, m: [...new Set([...groups[i].m, ...groups[j].m])], used: false }); } }
    }
    groups.filter(g => !g.used).forEach(g => { if (!primes.some(p => p.t === g.t)) primes.push(g); });
    groups = next;
  }
  // cover minterms: essential first, then greedy
  const left = new Set(minterms), chosen = [];
  for (const m of minterms) { const c = primes.filter(p => p.m.includes(m)); if (c.length === 1 && !chosen.includes(c[0])) chosen.push(c[0]); }
  chosen.forEach(p => p.m.forEach(m => left.delete(m)));
  while (left.size) { const best = primes.reduce((a, b) => (b.m.filter(m => left.has(m)).length > a.m.filter(m => left.has(m)).length ? b : a)); chosen.push(best); best.m.forEach(m => left.delete(m)); }
  const term = (t) => [...t].map((c, i) => (c === '1' ? names[i] : c === '0' ? names[i] + "'" : '')).join('') || '1';
  const sop = minterms.length === 0 ? '0' : chosen.map(p => term(p.t)).join(' + ');
  ctx.add({ title: 'Simplified (sum of products)', big: true, mono: true, text: sop });
  ctx.add({ title: 'Prime implicants', table: { head: ['Pattern', 'Term', 'Covers'], rows: primes.map(p => [p.t, term(p.t), p.m.join(', ')]) } });
  ctx.add({ title: 'LaTeX', latex: sop.replace(/([A-H])'/g, '\\overline{$1}').replace(/\+/g, ' + ') });
}
function boolSimplify(ctx, expr) {
  const vars = [...new Set((expr.match(/\b[A-Za-z]\b/g) || []).filter(v => !/^[vV]$/.test(v) || true))].sort();
  if (!vars.length || vars.length > 8) throw new Error('Use single-letter variables (up to 8).');
  const js = expr.replace(/\bAND\b|∧|·|\*|&&?/gi, '&&').replace(/\bOR\b|∨|\+|\|\|?/gi, '||').replace(/\bXOR\b|⊕/gi, '^').replace(/\bNOT\s*/gi, '!').replace(/[¬~]/g, '!').replace(/([A-Za-z)])\s*'/g, '$1!').replace(/([A-Za-z])!/g, '!$1');
  const fixed = js.replace(/([A-Za-z)])\s+(?=[A-Za-z(!])/g, '$1&&').replace(/([A-Za-z)])(?=[A-Za-z(!])/g, '$1&&');
  const f = new Function(...vars, `return !!(${fixed});`);
  const mins = []; for (let i = 0; i < 1 << vars.length; i++) { const v = vars.map((_, k) => !!(i >> (vars.length - 1 - k) & 1)); if (f(...v)) mins.push(i); }
  ctx.label('Boolean algebra'); ctx.input(expr);
  ctx.add({ title: 'Minterms', text: `Σm(${mins.join(', ')})` });
  qmSimplify(ctx, mins, vars.length, [], vars);
  ctx.add({ title: 'More', chips: [`truth table ${expr}`] });
}

// ============================================================ finance
function npv(ctx, rate, cfs) {
  const r = rate / 100; const v = sum(cfs.map((c, t) => c / (1 + r) ** t));
  ctx.label('NPV'); ctx.input(`${rate}% on ${cfs.join(', ')}`);
  ctx.add({ title: 'Net present value', big: true, text: `$${fmt(v, 2)}`, note: v > 0 ? 'Positive: worth more than it costs at this discount rate.' : 'Negative: doesn’t earn the required rate.' });
  ctx.add({ title: 'Cash flows', table: { head: ['Year', 'Cash flow', 'Discount factor', 'Present value'], rows: cfs.map((c, t) => [t, fmt(c, 2), fmt(1 / (1 + r) ** t, 5), fmt(c / (1 + r) ** t, 2)]) } });
  ctx.add(K.filesPod(K.tableFiles('npv', ['Year', 'Cash flow', 'Discount factor', 'PV'], [...cfs.map((c, t) => [t, c, `=1/(1+${r})^A${t + 2}`, `=B${t + 2}*C${t + 2}`]), ['NPV', '', '', `=SUM(D2:D${cfs.length + 1})`]])));
  irrBlock(ctx, cfs);
}
function irrBlock(ctx, cfs) {
  const f = (r) => sum(cfs.map((c, t) => c / (1 + r) ** t));
  let lo = -0.99, hi = 10; if (f(lo) * f(hi) > 0) { ctx.add({ title: 'IRR', text: 'No IRR (cash flows don’t change sign once).' }); return; }
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; }
  let cum = 0, pb = null; for (let t = 0; t < cfs.length; t++) { const prev = cum; cum += cfs[t]; if (pb == null && prev < 0 && cum >= 0) pb = t - 1 + (-prev / cfs[t]); }
  ctx.add({ title: 'IRR & payback', table: [['Internal rate of return', `${fmt(100 * (lo + hi) / 2, 3)}%`], ['Payback period', pb == null ? 'never' : `${fmt(pb, 2)} years`]] });
}
function breakEven(ctx, fixed, price, varCost) {
  const cm = price - varCost; if (cm <= 0) throw new Error('Price must be above the variable cost per unit.');
  const units = fixed / cm;
  ctx.label('Break-even'); ctx.input(`Fixed $${fmt(fixed, 2)}, price $${price}, variable $${varCost}`);
  ctx.add({ title: 'Break-even', big: true, text: `${fmt(Math.ceil(units), 0)} units ($${fmt(units * price, 2)} revenue)` });
  ctx.add({ title: 'Details', table: [['Contribution margin / unit', `$${fmt(cm, 2)}`], ['Contribution margin ratio', `${fmt(100 * cm / price, 2)}%`]] });
  const xs = Array.from({ length: 21 }, (_, i) => Math.round(i * units * 2 / 20));
  ctx.add({ title: 'Chart', plot: { kind: 'line', traces: [{ name: 'Revenue', x: xs, y: xs.map(x => x * price) }, { name: 'Total cost', x: xs, y: xs.map(x => fixed + x * varCost) }], xtitle: 'Units', ytitle: '$' } });
}
function payoff(ctx, bal, apr, pay) {
  const r = apr / 1200; if (pay <= bal * r) throw new Error(`The payment must be more than the monthly interest ($${fmt(bal * r, 2)}) or the balance never goes down.`);
  let b = bal, n = 0, int = 0; const rows = [];
  while (b > 0.005 && n < 1200) { const i = b * r; const p = Math.min(pay, b + i); b = b + i - p; int += i; n++; rows.push([n, round(p, 2), round(i, 2), round(p - i, 2), round(b, 2)]); }
  const minN = Math.log(pay / (pay - bal * r)) / Math.log(1 + r);
  ctx.label('Debt payoff'); ctx.input(`$${fmt(bal, 2)} at ${apr}% APR, $${pay}/month`);
  ctx.add({ title: 'Paid off in', big: true, text: `${n} months (${fmt(n / 12, 1)} years)`, note: `Total interest $${fmt(int, 2)} · total paid $${fmt(bal + int, 2)}` });
  ctx.add({ title: 'Pay more?', table: { head: ['Monthly payment', 'Months', 'Total interest'], rows: [1.25, 1.5, 2].map(k => { const p = pay * k; const m = Math.ceil(Math.log(p / (p - bal * r)) / Math.log(1 + r)); return [`$${fmt(p, 2)}`, m, `$${fmt(m * p - bal, 2)}`]; }) } });
  ctx.add({ title: 'Balance', plot: { kind: 'line', traces: [{ name: 'Balance', x: rows.map(r => r[0]), y: rows.map(r => r[4]) }], xtitle: 'Month', ytitle: '$' } });
  ctx.add(K.filesPod(K.tableFiles('payoff-schedule', ['Month', 'Payment', 'Interest', 'Principal', 'Balance'], rows)));
  void minN;
}
function salary(ctx, amt, per, hours = 40, weeks = 52) {
  const y = per === 'hour' ? amt * hours * weeks : per === 'week' ? amt * weeks : per === 'month' ? amt * 12 : per === 'biweekly' ? amt * 26 : per === 'day' ? amt * (hours / 8) * weeks : amt;
  ctx.label('Pay'); ctx.input(`$${fmt(amt, 2)} per ${per} (${hours} h/week, ${weeks} weeks)`);
  ctx.add({ title: 'Equivalent', table: [['Hourly', `$${fmt(y / (hours * weeks), 2)}`], ['Daily (8 h)', `$${fmt(y / (hours * weeks) * 8, 2)}`], ['Weekly', `$${fmt(y / weeks, 2)}`], ['Biweekly', `$${fmt(y / 26, 2)}`], ['Semimonthly', `$${fmt(y / 24, 2)}`], ['Monthly', `$${fmt(y / 12, 2)}`], ['Yearly', `$${fmt(y, 2)}`]], note: 'Before taxes. A common rough rule: take-home is 70–80% of gross, depending on state and benefits.' });
}
function cagr(ctx, a, b, yrs) {
  const g = (b / a) ** (1 / yrs) - 1;
  ctx.label('CAGR'); ctx.input(`${a} → ${b} over ${yrs} years`);
  ctx.add({ title: 'Compound annual growth rate', big: true, latex: `\\left(\\frac{${b}}{${a}}\\right)^{1/${yrs}} - 1 = ${round(100 * g, 4)}\\%` });
  ctx.add({ title: 'Total growth', text: `${fmt(100 * (b / a - 1), 2)}% overall` });
}
function unitPrice(ctx, s) {
  const items = [...s.matchAll(/\$?\s*(\d+(?:\.\d+)?)\s*(?:for|\/|per|@)\s*(\d+(?:\.\d+)?)\s*([a-z]+(?:\s?oz)?)?/gi)].map(m => ({ p: +m[1], q: +m[2], u: (m[3] || 'unit').toLowerCase() }));
  if (items.length < 2) return false;
  const best = items.reduce((a, b) => (b.p / b.q < a.p / a.q ? b : a));
  ctx.label('Unit price'); ctx.input(items.map(x => `$${x.p} for ${x.q} ${x.u}`).join(' vs '));
  ctx.add({ title: 'Best deal', big: true, text: `$${best.p} for ${best.q} ${best.u}  ($${fmt(best.p / best.q, 4)} per ${best.u})` });
  ctx.add({ title: 'Comparison', table: { head: ['Option', 'Unit price', 'vs best'], rows: items.map(x => [`$${x.p} / ${x.q} ${x.u}`, `$${fmt(x.p / x.q, 4)}`, x === best ? 'best' : `+${fmt(100 * ((x.p / x.q) / (best.p / best.q) - 1), 1)}%`]) }, note: items.some(x => x.u !== items[0].u) ? 'Units differ: convert them to the same unit first for a fair comparison.' : undefined });
}

// ============================================================ health
function bmr(ctx, sex, age, kg, cm, act) {
  const b = 10 * kg + 6.25 * cm - 5 * age + (sex === 'm' ? 5 : -161);
  const L = [['Sedentary', 1.2], ['Light (1–3 days/week)', 1.375], ['Moderate (3–5 days)', 1.55], ['Active (6–7 days)', 1.725], ['Very active', 1.9]];
  ctx.label('Energy'); ctx.input(`${sex === 'm' ? 'Male' : 'Female'}, ${age} y, ${round(kg, 1)} kg, ${round(cm, 1)} cm`);
  ctx.add({ title: 'Basal metabolic rate (Mifflin–St Jeor)', big: true, text: `${fmt(b, 0)} kcal/day` });
  ctx.add({ title: 'Daily energy by activity (TDEE)', table: L.map(([k, f]) => [k, `${fmt(b * f, 0)} kcal`]), note: 'An estimate (±10% for most people). A doctor or registered dietitian can give advice for your situation.' });
  void act;
}
function hrZones(ctx, age, rest) {
  const max = 208 - 0.7 * age;
  const Z = [['Zone 1 (recovery)', 0.5, 0.6], ['Zone 2 (endurance)', 0.6, 0.7], ['Zone 3 (tempo)', 0.7, 0.8], ['Zone 4 (threshold)', 0.8, 0.9], ['Zone 5 (max)', 0.9, 1]];
  const hr = (p) => Math.round(rest ? rest + p * (max - rest) : p * max);
  ctx.label('Heart rate zones'); ctx.input(`Age ${age}${rest ? `, resting ${rest}` : ''}`);
  ctx.add({ title: 'Max heart rate (Tanaka)', big: true, text: `${Math.round(max)} bpm` });
  ctx.add({ title: rest ? 'Zones (Karvonen, uses resting HR)' : 'Zones (% of max)', table: { head: ['Zone', 'bpm'], rows: Z.map(([k, a, b]) => [k, `${hr(a)}–${hr(b)}`]) } });
}
function sleep(ctx, mode, t) {
  const fmtT = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const base = t ? (() => { const m = /(\d{1,2})(?::(\d\d))?\s*(am|pm)?/i.exec(t); const d = new Date(); let h = +m[1]; if (m[3]) { h %= 12; if (/pm/i.test(m[3])) h += 12; } d.setHours(h, +(m[2] || 0), 0, 0); return d; })() : new Date();
  ctx.label('Sleep cycles');
  if (mode === 'wake') { ctx.input(`Wake up at ${fmtT(base)}`); ctx.add({ title: 'Go to bed at', table: [6, 5, 4, 3].map(c => [fmtT(new Date(base - (c * 90 + 15) * 60000)), `${c} cycles (${c * 1.5} h of sleep)`]), note: 'Assumes ~15 min to fall asleep and 90-min cycles; waking between cycles feels less groggy. Adults usually need 5–6 cycles.' }); }
  else { ctx.input(`Going to sleep at ${fmtT(base)}`); ctx.add({ title: 'Wake up at', table: [3, 4, 5, 6].map(c => [fmtT(new Date(+base + (c * 90 + 15) * 60000)), `${c} cycles (${c * 1.5} h)`]), note: 'Assumes ~15 min to fall asleep and 90-minute cycles.' }); }
}
const DIST = { '5k': 5, '10k': 10, 'half marathon': 21.0975, half: 21.0975, marathon: 42.195, mile: 1.609344, '1 mile': 1.609344, '1k': 1, '1500m': 1.5, '400m': 0.4, '800m': 0.8, '15k': 15 };
const hms = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(x).padStart(2, '0')}`; };
const parseHMS = (t) => { const p = t.split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60; };
function pace(ctx, km, secs) {
  const pk = secs / km, pm = pk * 1.609344;
  ctx.label('Pace'); ctx.input(`${round(km, 3)} km in ${hms(secs)}`);
  ctx.add({ title: 'Pace', big: true, text: `${hms(pk)} /km · ${hms(pm)} /mile` });
  ctx.add({ title: 'Speed', text: `${fmt(km / (secs / 3600), 2)} km/h · ${fmt(km / 1.609344 / (secs / 3600), 2)} mph` });
  ctx.add({ title: 'Same pace, other distances', table: { head: ['Distance', 'Time'], rows: [['1 km', 1], ['1 mile', 1.609344], ['5K', 5], ['10K', 10], ['Half marathon', 21.0975], ['Marathon', 42.195]].map(([k, d]) => [k, hms(pk * d)]) } });
  ctx.add({ title: 'Predicted race times (Riegel)', table: { head: ['Race', 'Predicted'], rows: [['5K', 5], ['10K', 10], ['Half', 21.0975], ['Marathon', 42.195]].map(([k, d]) => [k, hms(secs * (d / km) ** 1.06)]) } });
}

// ============================================================ time
function businessDays(ctx, a, b) {
  let n = 0, d = new Date(a); const end = new Date(b); const step = end >= d ? 1 : -1;
  while ((step > 0 ? d < end : d > end)) { d.setDate(d.getDate() + step); const w = d.getDay(); if (w !== 0 && w !== 6) n++; }
  ctx.label('Business days'); ctx.input(`${a.toDateString()} → ${end.toDateString()}`);
  ctx.add({ title: 'Weekdays', big: true, text: String(n), note: 'Mon–Fri, not counting the start date. Public holidays aren’t subtracted (see “holidays 2026”).' });
}
function addBusinessDays(ctx, a, n) {
  const d = new Date(a); let k = 0; while (k < n) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) k++; }
  ctx.label('Business days'); ctx.input(`${n} business days after ${a.toDateString()}`);
  ctx.add({ title: 'Date', big: true, text: d.toDateString() });
}
function weekNum(ctx, d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); const w = Math.ceil(((t - ys) / 86400000 + 1) / 7);
  const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  ctx.label('Week number'); ctx.input(d.toDateString());
  ctx.add({ title: 'ISO week', big: true, text: `Week ${w} of ${t.getUTCFullYear()}` });
  ctx.add({ title: 'Also', table: [['Day of year', doy], ['Days left in year', (new Date(d.getFullYear(), 11, 31) - d) / 86400000 | 0], ['Quarter', `Q${Math.floor(d.getMonth() / 3) + 1}`], ['US week (Sunday start)', Math.ceil((doy + new Date(d.getFullYear(), 0, 1).getDay()) / 7)]] });
}
const durSecs = (s) => { let t = 0; for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*(h|hrs?|hours?|m|mins?|minutes?|s|secs?|seconds?|d|days?)\b/gi)) t += +m[1] * (/^d/i.test(m[2]) ? 86400 : /^h/i.test(m[2]) ? 3600 : /^m/i.test(m[2]) ? 60 : 1); for (const m of s.matchAll(/(?<![\w:])(\d+):(\d\d)(?::(\d\d))?(?![\w:])/g)) t += +m[1] * 3600 + +m[2] * 60 + +(m[3] || 0); return t; };
function durations(ctx, s) {
  const parts = s.split(/\s*([+-])\s*/); let tot = 0, sign = 1;
  for (const p of parts) { if (p === '+') sign = 1; else if (p === '-') sign = -1; else if (p.trim()) tot += sign * durSecs(p); }
  const a = Math.abs(tot);
  ctx.label('Durations'); ctx.input(s);
  ctx.add({ title: 'Total', big: true, text: `${tot < 0 ? '−' : ''}${Math.floor(a / 3600)} h ${Math.floor(a % 3600 / 60)} min${a % 60 ? ` ${a % 60} s` : ''}` });
  ctx.add({ title: 'As', table: [['Hours (decimal)', fmt(tot / 3600, 4)], ['Minutes', fmt(tot / 60, 2)], ['Seconds', tot], ['hh:mm:ss', hms(a).padStart(4, '0')]] });
}
const clock = (t) => { const m = /(\d{1,2})(?::(\d\d))?\s*(am|pm|a|p)?/i.exec(t); if (!m) return null; let h = +m[1]; if (m[3]) { h %= 12; if (/p/i.test(m[3])) h += 12; } return h * 60 + +(m[2] || 0); };
function timeCard(ctx, s) {
  const shifts = [...s.matchAll(/(\d{1,2}(?::\d\d)?\s*(?:(?:am|pm|a|p)\b)?)\s*(?:-|–|to)\s*(\d{1,2}(?::\d\d)?\s*(?:(?:am|pm|a|p)\b)?)(?:\s*(?:break|lunch|minus|-)\s*(\d+)\s*m(?:in)?)?/gi)];
  if (!shifts.length) return false;
  const rate = /\$\s?(\d+(?:\.\d+)?)\s*(?:\/|per|an?)\s*h(?:ou)?r/i.exec(s);
  const ot = /overtime|\bot\b/i.test(s);
  const rows = shifts.map(m => { let a = clock(m[1]), b = clock(m[2]); if (b <= a) b += /am|pm|a|p/i.test(m[1] + m[2]) ? 1440 : 720; const mins = b - a - +(m[3] || 0); return [m[1].trim(), m[2].trim(), m[3] ? `${m[3]} min` : '—', fmt(mins / 60, 2)]; });
  const H = sum(rows.map(r => +r[3]));
  ctx.label('Time card'); ctx.input(`${rows.length} shifts`);
  ctx.add({ title: 'Total hours', big: true, text: `${fmt(H, 2)} h (${Math.floor(H)} h ${Math.round(H % 1 * 60)} min)` });
  ctx.add({ title: 'Shifts', table: { head: ['In', 'Out', 'Break', 'Hours'], rows } });
  if (rate) { const r = +rate[1], reg = ot ? Math.min(H, 40) : H, over = ot ? Math.max(0, H - 40) : 0; ctx.add({ title: 'Gross pay', big: true, text: `$${fmt(reg * r + over * r * 1.5, 2)}`, note: over ? `${fmt(reg, 2)} h × $${r} + ${fmt(over, 2)} overtime h × $${r * 1.5}` : `${fmt(H, 2)} h × $${r}` }); }
  ctx.add(K.filesPod(K.tableFiles('timecard', ['In', 'Out', 'Break', 'Hours'], [...rows, ['', '', 'Total', `=SUM(D2:D${rows.length + 1})`]])));
}

// ============================================================ rules
const c0 = (x) => x;
const conf = (s) => { const m = /(\d{2}(?:\.\d+)?)\s*%/.exec(s || ''); return m ? +m[1] / 100 : 0.95; };
const groupsOf = (s) => s.split(/\s*(?:\||;|\bvs\.?\b|\bversus\b|\band\b(?=\s*[-\d.]))\s*|\n+/i).map(numList).filter(g => g.length);
export const CALC_RULES = [
  // grades
  [/^(?:gpa|calculate (?:my )?gpa|my gpa)\s*:?\s*(.+)$/i, (c, m) => (/\d/.test(m[1]) ? gpa(c, m[1]) : false)],
  [/^cumulative gpa\s+(?:current\s+)?([\d.]+)\s+(?:over|with|for|in)\s+(\d+)\s*(?:credits?|hours?)?\s*(?:,|plus|and|\+|new|this (?:term|semester))?\s*(?:new\s+)?([\d.]+)\s+(?:over|with|for|in)\s+(\d+)/i, (c, m) => cumGpa(c, +m[1], +m[2], +m[3], +m[4])],
  [/^(?:what (?:do i need|grade do i need|score do i need) on (?:the|my) final|final exam(?: grade)?(?: calculator)?|final grade needed)\s*:?\s*(.+)$/i, (c, m) => { const s = m[1]; const cur = /(?:current(?:ly)?|have|grade(?: is)?|at)\s*(?:an?\s+)?([\d.]+)/i.exec(s), w = /(?:final(?: is)?(?: worth)?|worth|weight(?:ed)?|counts? (?:for|as))\s*([\d.]+)\s*%/i.exec(s), want = /(?:want|need|goal|target|get)\s*(?:an?\s+)?([\d.]+)/i.exec(s); const n = numList(s); if (cur && w && want) return finalNeeded(c, +cur[1], +w[1], +want[1]); if (n.length >= 3) return finalNeeded(c, n[0], n[1], n[2]); throw new Error('Say your current grade, what the final is worth, and the grade you want, e.g. “final exam: current 84, worth 25%, want 90”.'); }],
  [/^(?:weighted (?:grade|average)|grade calculator|calculate (?:my )?grade)\s*:?\s*(.+%.*)$/i, (c, m) => weightedGrade(c, m[1])],
  // measurement
  [/^(?:how many\s+)?(?:sig(?:nificant)? ?figs?|significant figures|sf)\s+(?:in\s+|of\s+|for\s+)?([-\d.,e+]+)$/i, (c, m) => sigFigs(c, m[1])],
  [/^(?:round\s+)?([-\d.e+]+)\s+to\s+(\d+)\s+(?:sig(?:nificant)? ?(?:figs?|figures?|digits?)|s\.?f\.?)$/i, (c, m) => { c.label('Significant figures'); c.input(m[0]); c.add({ title: 'Result', big: true, text: String(Number(Number(m[1]).toPrecision(+m[2]))), note: `Scientific: ${Number(m[1]).toExponential(+m[2] - 1)}` }); }],
  [/^(?:([-\d.,]+)\s+in\s+scientific notation|scientific notation\s+(?:of\s+|for\s+)?([-\d.,e+]+)|([-\d.,]+)\s+(?:to|as)\s+(?:scientific|standard form|engineering notation))$/i, (c, m) => sciNot(c, m[1] || m[2] || m[3])],
  [/^(?:percent(?:age)? error|% error)\s+(?:measured\s*|experimental\s*)?=?\s*(-?[\d.]+)\s*,?\s*(?:accepted|actual|theoretical|true|expected)?\s*=?\s*(-?[\d.]+)$/i, (c, m) => percentError(c, +m[1], +m[2])],
  [/^(?:error propagation|propagate (?:error|uncertainty)|uncertainty (?:of|in))\s+(?:f\s*=\s*)?(.+?)\s+(?:with|where|for)\s+(.+)$/i, (c, m) => { const vars = {}; for (const v of m[2].matchAll(/([a-z]\w*)\s*=\s*(-?[\d.e-]+)\s*(?:±|\+-|\+\/-)\s*([\d.e-]+)/gi)) vars[v[1]] = [+v[2], +v[3]]; if (!Object.keys(vars).length) throw new Error('Give values like “x = 2.0 ± 0.1, y = 3.5 ± 0.2”.'); errorProp(c, m[1], vars); }],
  // statistics
  [/^(paired\s+)?(?:t[- ]?test|ttest|student'?s t)\s+(?:on\s+)?(.+?)\s+(?:vs\.?|versus|and|\|)\s+(.+)$/i, (c, m) => tTwo(c, numList(m[2]), numList(m[3]), !!m[1] || /paired/i.test(m[0]))],
  [/^(?:one[- ]sample\s+)?(?:t[- ]?test|ttest)\s+(?:mean|x̄|xbar)\s*=?\s*([-\d.]+)\s*,?\s*(?:sd|s|std)\s*=?\s*([\d.]+)\s*,?\s*n\s*=?\s*(\d+)\s*,?\s*(?:mu|μ|μ0|mu0|h0|null)\s*=?\s*([-\d.]+)$/i, (c, m) => tOne(c, +m[1], +m[2], +m[3], +m[4])],
  [/^(?:one[- ]sample\s+)?(?:t[- ]?test|ttest)\s+(?:data\s*)?:?\s*([-\d.,\s]+?)\s*,?\s*(?:mu|μ|μ0|mu0|h0|null|against|vs|mean)\s*=?\s*([-\d.]+)$/i, (c, m) => { const a = numList(m[1]); tOne(c, mean(a), sd(a), a.length, +m[2]); }],
  [/^(?:chi[- ]?squared?|χ2|χ²)\s+(?:test\s+)?(?:goodness of fit\s+)?(?:observed\s*:?\s*)([\d.,\s]+?)\s*(?:expected\s*:?\s*([\d.,\s]+))?$/i, (c, m) => chiSquare(c, numList(m[1]), m[2] ? numList(m[2]) : null)],
  [/^(?:chi[- ]?squared?|χ2|χ²)\s+(?:test\s+)?(?:of\s+)?(?:independence\s*)?:?\s*(\[\s*\[.+\]\s*\]|[\d\s,]+(?:;[\d\s,]+)+)$/i, (c, m) => { const M = m[1].startsWith('[') ? JSON.parse(m[1]) : m[1].split(';').map(numList); chiIndep(c, M); }],
  [/^(?:one[- ]way\s+)?anova\s*:?\s*(.+)$/is, (c, m) => { const g = groupsOf(m[1]); if (g.length < 2) throw new Error('Separate groups with | or ;, e.g. “anova 1,2,3 | 4,5,6 | 7,8,9”.'); anova(c, g); }],
  [/^(?:(\d{2}(?:\.\d+)?)\s*%\s*)?(?:confidence interval|ci)\s*(?:of\s+|for\s+)?(?:(\d{2}(?:\.\d+)?)\s*%\s*)?(?:the\s+)?(?:mean\s+)?(?:mean|x̄|xbar)\s*=?\s*([-\d.]+)\s*,?\s*(?:sd|s|σ|std)\s*=?\s*([\d.]+)\s*,?\s*n\s*=?\s*(\d+)(?:\s*,?\s*(\d{2}(?:\.\d+)?)\s*%)?$/i, (c, m) => ciMean(c, +m[3], +m[4], +m[5], (+(m[1] || m[2] || m[6] || 95)) / 100)],
  [/^(?:(\d{2}(?:\.\d+)?)\s*%\s*)?(?:confidence interval|ci)\s*(?:for\s+)?(?:a\s+)?proportion\s*:?\s*(\d+)\s*(?:of|out of|\/)\s*(\d+)(?:\s*,?\s*(\d{2}(?:\.\d+)?)\s*%)?$/i, (c, m) => ciProp(c, +m[2], +m[3], (+(m[1] || m[4] || 95)) / 100)],
  [/^(?:(\d{2}(?:\.\d+)?)\s*%\s*)?(?:confidence interval|ci)\s*(?:for|of)\s*:?\s*([-\d.,\s]{5,})$/i, (c, m) => { const a = numList(m[2]); ciMean(c, mean(a), sd(a), a.length, (+(m[1] || 95)) / 100); }],
  [/^sample size\s+(?:for\s+(?:a\s+)?)?(?:(?:proportion|survey|poll)\s*)?(?:margin(?: of error)?|moe|error|within|e)\s*=?\s*±?([\d.]+)\s*(%)?\s*,?\s*(?:at\s+)?(\d{2}(?:\.\d+)?)?\s*%?\s*(?:confidence)?(?:\s*,?\s*(?:p\s*=?\s*([\d.]+)))?$/i, (c, m) => sampleSize(c, m[2] || +m[1] >= 1 ? +m[1] / 100 : +m[1], (+(m[3] || 95)) / 100, null, m[4] ? +m[4] : 0.5)],
  [/^sample size\s+(?:for\s+(?:a\s+)?)?mean\s*,?\s*(?:sd|σ|sigma)\s*=?\s*([\d.]+)\s*,?\s*(?:margin(?: of error)?|moe|error|e)\s*=?\s*±?([\d.]+)\s*,?\s*(?:at\s+)?(\d{2}(?:\.\d+)?)?\s*%?\s*(?:confidence)?$/i, (c, m) => sampleSize(c, +m[2], (+(m[3] || 95)) / 100, +m[1])],
  [/^(?:z[- ]?score|standardi[sz]e)\s+(?:of\s+|for\s+)?(?:x\s*=?\s*)?(-?[\d.]+)\s*,?\s*(?:with\s+)?(?:mean|μ|mu)\s*=?\s*(-?[\d.]+)\s*,?\s*(?:sd|σ|sigma|std|standard deviation)\s*=?\s*([\d.]+)$/i, (c, m) => zScore(c, +m[1], +m[2], +m[3])],
  [/^p[- ]?value\s+(?:for\s+|of\s+)?(z|t|chi[- ]?squared?|χ²|chi|f)\s*=?\s*(-?[\d.]+)(?:\s*,?\s*(?:df|dof|degrees of freedom)\s*=?\s*(\d+)(?:\s*,\s*(\d+))?)?$/i, (c, m) => pValue(c, /^z/i.test(m[1]) ? 'z' : /^t/i.test(m[1]) ? 't' : /^f/i.test(m[1]) ? 'f' : 'chi', +m[2], +m[3], +m[4])],
  [/^(?:frequency (?:table|distribution)|histogram|tally)\s*(?:of|for)?\s*:?\s*([-\d.,\s]{5,}?)(?:\s+(?:with\s+)?(\d+)\s+bins)?$/i, (c, m) => freqTable(c, numList(m[1]), m[2] ? +m[2] : null)],
  [/^(?:five[- ]number summary|5[- ]number summary|box ?plot|box and whisker(?: plot)?|iqr|outliers|interquartile range)\s*(?:of|for)?\s*:?\s*([-\d.,\s]{5,})$/i, (c, m) => fiveNum(c, numList(m[1]))],
  // chemistry
  [/^(?:percent(?:age)? composition|mass percent|% composition|composition)\s+(?:of\s+)?([A-Z][A-Za-z0-9()·.\[\]]*)$/, (c, m) => composition(c, m[1])],
  [/^(?:empirical formula|molecular formula)\s*(?:from|for|of)?\s*:?\s*(.+)$/i, (c, m) => empirical(c, m[1])],
  [/^(?:convert\s+)?([\d.e-]+)\s*(g|grams?|mol|moles?)\s+(?:of\s+)?([A-Z][A-Za-z0-9()·.]*)\s+(?:to|in(?:to)?)\s+(?:g|grams?|mol|moles?|molecules)$/, (c, m) => molesGrams(c, +m[1], m[2], m[3])],
  [/^(?:how many\s+)?(moles?|grams?)\s+(?:(?:are\s+)?in|of)\s+([\d.e-]+)\s*(g|grams?|mol|moles?)\s+(?:of\s+)?([A-Z][A-Za-z0-9()·.]*)$/i, (c, m) => molesGrams(c, +m[2], m[3], m[4])],
  [/^(?:molarity|concentration)\s+(?:of\s+)?(.+)$/i, (c, m) => molarity(c, m[1])],
  [/^dilut(?:e|ion)\s+(.+)$/i, (c, m) => { const s = m[1]; const Ms = [...s.matchAll(/([\d.]+)\s*M\b/g)].map(x => +x[1]); const Vs = [...s.matchAll(/([\d.]+)\s*(ml|mL|L|l)\b/g)]; const vu = Vs[0] ? Vs[0][2] : 'mL'; const V = Vs.map(x => +x[1]); const toFind = /how much|what volume|v1\s*=\s*\?/i.test(s) ? 'V1' : null; if (Ms.length === 2 && V.length === 1) return dilution(c, Ms[0], toFind || /to make|make/i.test(s) ? null : V[0], Ms[1], toFind || /to make|make/i.test(s) ? V[0] : null, vu); if (Ms.length === 1 && V.length === 2) return dilution(c, Ms[0], V[0], null, V[1], vu); throw new Error('Try “dilution 2 M stock to make 100 mL of 0.5 M” or “dilute 50 mL of 2 M to 200 mL”.'); }],
  [/^(?:ph|p\.h\.)\s+(?:of\s+)?(.+)$/i, (c, m) => pH(c, m[1])],
  [/^(?:half[- ]life|radioactive decay|decay)\s*:?\s*([\d.]+)\s*(?:g|grams?|mg|kg|%|atoms|units)?\s*,?\s*(?:with\s+)?(?:a\s+)?half[- ]life(?: of)?\s*=?\s*([\d.]+)\s*([a-z]+)\s*,?\s*(?:after|for|t\s*=)\s*([\d.]+)\s*([a-z]*)$/i, (c, m) => halfLife(c, +m[1], +m[2], +m[4], m[3])],
  [/^(?:ideal gas(?: law)?|pv\s*=\s*nrt|gas law)\s*:?\s*(.+)$/i, (c, m) => idealGas(c, m[1])],
  // physics & electronics
  [/^(?:projectile(?: motion)?|launch|throw)\s+(?:at\s+)?([\d.]+)\s*(?:m\/s|mps)?\s*(?:at\s+)?(?:an?\s+)?(?:angle\s+(?:of\s+)?)?([\d.]+)\s*(?:°|deg(?:rees?)?)(?:\s*(?:from|at|height|h)\s*=?\s*([\d.]+)\s*m?)?$/i, (c, m) => projectile(c, +m[1], +m[2], +(m[3] || 0))],
  [/^(?:kinematics|suvat|constant acceleration)\s*:?\s*(.+)$/i, (c, m) => suvat(c, m[1])],
  [/^(?:resistor(?: colou?r(?: code)?)?|colou?r code)\s+((?:black|brown|red|orange|yellow|green|blue|violet|purple|gr[ae]y|white|gold|silver)(?:[\s,-]+(?:black|brown|red|orange|yellow|green|blue|violet|purple|gr[ae]y|white|gold|silver)){2,5})$/i, (c, m) => resistorColors(c, m[1].split(/[\s,-]+/))],
  [/^(?:resistor colou?rs?(?: for)?|colou?r code (?:for|of)|what colou?rs? (?:is|are) (?:a\s+)?)\s*([\d.]+\s*[kKmMrR]?\d*)\s*(?:ohms?|Ω)?(?:\s+resistor)?$/i, (c, m) => resistorFor(c, m[1])],
  [/^(resistors?|capacitors?|caps?|inductors?)\s+in\s+(series|parallel)\s*:?\s*(.+)$|^(series|parallel)\s+(resistors?|capacitors?|caps?|inductors?)\s*:?\s*(.+)$/i, (c, m) => { const kind = (m[1] || m[5]).toLowerCase()[0] === 'r' ? 'r' : (m[1] || m[5]).toLowerCase()[0] === 'i' ? 'l' : 'c'; const vals = (m[3] || m[6]).split(/[\s,]+/).filter(Boolean).map(x => (kind === 'r' ? parseR(x) : numList(x)[0])); combine(c, kind, (m[2] || m[4]).toLowerCase(), vals); }],
  [/^voltage divider\s+(?:vin\s*=?\s*)?([\d.]+)\s*v?\s*,?\s*(?:r1\s*=?\s*)?([\d.]+\s*[kKmM]?)\s*(?:ohms?|Ω)?\s*,?\s*(?:r2\s*=?\s*)?([\d.]+\s*[kKmM]?)\s*(?:ohms?|Ω)?$/i, (c, m) => divider(c, +m[1], parseR(m[2].replace(/\s/g, '')), parseR(m[3].replace(/\s/g, '')))],
  [/^led resistor\s+(?:for\s+)?(?:supply\s*=?\s*)?([\d.]+)\s*v\s*,?\s*(?:led\s*|vf\s*=?\s*)?([\d.]+)\s*v\s*,?\s*(?:at\s+)?([\d.]+)\s*ma$/i, (c, m) => ledResistor(c, +m[1], +m[2], +m[3])],
  [/^(?:ohm'?s law|ohms)\s*:?\s*(.+)$/i, (c, m) => ohmsLaw(c, m[1])],
  [/^(rc|rl)\s+(?:time constant|circuit|filter)?\s*:?\s*(?:r\s*=?\s*)?([\d.]+\s*[kKmM]?)\s*(?:ohms?|Ω)?\s*,?\s*(?:[cl]\s*=?\s*)?([\d.]+)\s*(pf|nf|uf|µf|μf|mf|f|uh|µh|mh|h)$/i, (c, m) => { const mult = { pf: 1e-12, nf: 1e-9, uf: 1e-6, 'µf': 1e-6, 'μf': 1e-6, mf: 1e-3, f: 1, uh: 1e-6, 'µh': 1e-6, mh: 1e-3, h: 1 }[m[4].toLowerCase()]; rcTime(c, parseR(m[2].replace(/\s/g, '')), +m[3] * mult, m[1].toUpperCase()); }],
  [/^(?:photon|wavelength|frequency|light|em wave|photon energy)\s+(?:of\s+|for\s+)?([\d.e+-]+)\s*(nm|µm|um|m|hz|khz|mhz|ghz|thz|ev|j)$/i, (c, m) => photon(c, +m[1], m[2].toLowerCase())],
  [/^(?:thin lens|lens|mirror|lens equation)\s*:?\s*(.+)$/i, (c, m) => { const o = kv(m[1].replace(/do\b|object(?: distance)?/gi, 'do').replace(/di\b|image(?: distance)?/gi, 'di').replace(/focal(?: length)?/gi, 'f')); const g = (k) => (o[k] ? o[k].v : null); if ([g('f'), g('do'), g('di')].filter(x => x != null).length !== 2) return false; lens(c, g('f'), g('do'), g('di')); }],
  [/^snell'?s?(?: law)?\s*:?\s*n1\s*=?\s*([\d.]+)\s*,?\s*n2\s*=?\s*([\d.]+)\s*,?\s*(?:angle|θ1?|theta1?|a1?)\s*=?\s*([\d.]+)/i, (c, m) => snell(c, +m[1], +m[2], +m[3])],
  [/^(?:orbit(?:al)?(?: speed| velocity| period)?|satellite)\s+(?:at\s+)?([\d.]+)\s*km(?:\s+(?:altitude|above|high))?(?:\s+(?:above|around|of)\s+(earth|moon|mars|sun|jupiter|venus|mercury|saturn))?$/i, (c, m) => orbit(c, +m[1], (m[2] || 'earth').toLowerCase())],
  [/^(-?[\d.]+)\s*db\s+(?:to|as|in)\s+(?:a\s+)?ratio$|^(?:ratio\s+)?([\d.]+)\s*(?:x|times)?\s+(?:to|in)\s+(?:db|decibels)$/i, (c, m) => decibel(c, m[1] ? 'to ratio' : 'from ratio', +(m[1] || m[2]))],
  // biology
  [/^(?:dna|rna|reverse complement|complement|transcribe|translate|gc content|sequence)\s*(?:of\s+)?:?\s*([ACGTUacgtu\s]{6,})$/i, (c, m) => dna(c, m[1])],
  [/^(?:protein|peptide)\s+(?:mw|molecular weight|mass|composition)?\s*(?:of\s+)?:?\s*([ACDEFGHIKLMNPQRSTVWYacdefghiklmnpqrstvwy\s]{4,})$/i, (c, m) => protein(c, m[1])],
  [/^(?:punnett(?: square)?|cross|genetic cross)\s+([A-Za-z]{2,6})\s*(?:x|×|\*|and|with)\s*([A-Za-z]{2,6})$/i, (c, m) => punnett(c, m[1], m[2])],
  [/^(?:hardy[- ]weinberg|hwe)\s*:?\s*(p2|p²|q2|q²|p|q)\s*=?\s*([\d.]+)\s*(%)?$/i, (c, m) => hardy(c, m[1].replace('²', '2').toLowerCase(), +m[2] / (m[3] ? 100 : 1))],
  [/^(?:codon table|genetic code)$/i, (c) => { c.label('Genetic code'); const b = 'UCAG'; c.add({ title: 'mRNA codon table', table: { head: ['1st \\ 2nd', ...b], rows: [...b].flatMap(x => [...b].map(z => [`${x}··${z}`, ...[...b].map(y => `${x}${y}${z} ${AA3[CODON[x + y + z]]}`)])) }, note: 'AUG = Met (start). UAA, UAG, UGA = stop.' }); }],
  [/^codon\s+([ACGUTacgut]{3})$/i, (c, m) => { const k = m[1].toUpperCase().replace(/T/g, 'U'); c.label('Codon'); c.input(k); c.add({ title: 'Codes for', big: true, text: `${AA3[CODON[k]]} (${CODON[k]})` }); }],
  // discrete math
  [/^(?:sets?\s+)?a\s*=\s*(\{[^}]*\}|\[[^\]]*\])\s*,?\s*(?:and\s+)?b\s*=\s*(\{[^}]*\}|\[[^\]]*\])$/i, (c, m) => setOps(c, parseSet(m[1]), parseSet(m[2]))],
  [/^(?:union|intersection|set operations?|sets)\s+(?:of\s+)?(\{[^}]*\})\s*(?:and|,|with)\s*(\{[^}]*\})$/i, (c, m) => setOps(c, parseSet(m[1]), parseSet(m[2]))],
  [/^(?:list\s+)?(?:all\s+)?(permutations|arrangements|combinations|subsets of size)\s+(?:of\s+)?(.+?)(?:\s+(?:choose|taken|pick|of size|k\s*=)\s*(\d+)(?:\s+at a time)?)?$/i, (c, m) => { const raw = m[2].trim().replace(/[{}[\]]/g, ''); const items = /[,\s]/.test(raw) ? raw.split(/[\s,]+/).filter(Boolean) : [...raw]; if (!/\bof\b|list|all/i.test(c0(m[0])) && items.length <= 2 && items.every(x => /^\d+$/.test(x))) return false; if (items.length > 10 && !m[3]) throw new Error('Up to 10 items, please.'); const kind = /comb|subsets/i.test(m[1]) ? 'comb' : 'perm'; const k = +(m[3] || (kind === 'comb' ? 2 : items.length)); listPerms(c, items, k, kind); }],
  [/^power ?set\s+(?:of\s+)?(.+)$/i, (c, m) => { const items = parseSet(m[1]); if (items.length > 12) throw new Error('Up to 12 elements.'); listPerms(c, items, 0, 'power'); }],
  [/^(?:convert\s+)?(-?\d*\.\d*(?:\(\d+\)|\d+\.\.\.)?)\s+(?:to|as|into)\s+(?:a\s+)?fraction$|^(?:decimal to fraction|fraction of|repeating decimal)\s+(-?\d*\.[\d()]+(?:\.\.\.)?)$/i, (c, m) => decToFrac(c, m[1] || m[2])],
  [/^(?:shortest path|dijkstra|minimum spanning tree|mst)\s*(?:from\s+(\w+)\s+to\s+(\w+))?\s*:?\s*(.+?)(?:\s+from\s+(\w+)\s+to\s+(\w+))?$/i, (c, m) => dijkstra(c, m[3], m[1] || m[4], m[2] || m[5])],
  [/^(?:(?:equation of )?(?:the\s+)?line\s+(?:through|between|passing through)|slope (?:between|of)|midpoint (?:of|between)|distance between)\s*\(?\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)?\s*(?:and|,|to)\s*\(?\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)?$/i, (c, m) => lineThrough(c, +m[1], +m[2], +m[3], +m[4])],
  [/^(?:solve\s+(?:the\s+)?)?triangle\s*:?\s*(.*[abcABC]\s*=.+)$/i, (c, m) => triangle(c, m[1])],
  [/^(?:law of (?:sines|cosines))\s*:?\s*(.*[abcABC]\s*=.+)$/i, (c, m) => triangle(c, m[1])],
  [/^(?:oeis|what comes next|next (?:number|term) in(?: the)? (?:sequence)?|identify (?:the )?sequence|sequence)\s*:?\s*(-?\d+(?:\s*,\s*-?\d+){3,})\s*,?\s*(?:\.\.\.|…|_|\?)?$/i, (c, m, q, d) => oeis(c, numList(m[1]), d)],
  [/^(?:simplify\s+(?:the\s+)?(?:boolean|logic)(?:\s+expression)?|boolean simplify|k-?map|karnaugh(?: map)?|minimi[sz]e)\s*:?\s*(.+)$/i, (c, m) => { const mt = /^(?:minterms?\s*|σm|sum\s*m|m)\s*\(?([\d,\s]+)\)?(?:\s*(?:d|dc|don'?t cares?)\s*\(?([\d,\s]+)\)?)?(?:\s+(\d)\s+var(?:iable)?s?)?$/i.exec(m[1].trim()); if (mt) { const mins = numList(mt[1]), dc = mt[2] ? numList(mt[2]) : []; const nv = +(mt[3] || Math.max(1, Math.ceil(Math.log2(Math.max(...mins, ...dc) + 1)))); c.label('Boolean algebra'); c.input(`Σm(${mins.join(',')})${dc.length ? ` + d(${dc.join(',')})` : ''}, ${nv} variables`); return qmSimplify(c, mins, nv, dc); } boolSimplify(c, m[1]); }],
  // finance
  [/^npv\s+(?:at\s+)?([\d.]+)\s*%\s*(?:of|for|on|:)?\s*(.+)$/i, (c, m) => npv(c, +m[1], numList(m[2].replace(/\$/g, '')))],
  [/^irr\s*(?:of|for|:)?\s*(.+)$/i, (c, m) => { c.label('IRR'); c.input(m[1]); irrBlock(c, numList(m[1].replace(/\$/g, ''))); }],
  [/^break[- ]?even\s*:?\s*(?:fixed(?: costs?)?\s*=?\s*)\$?([\d,.]+)\s*,?\s*(?:price\s*=?\s*)\$?([\d.]+)\s*,?\s*(?:variable(?: cost)?\s*=?\s*)\$?([\d.]+)/i, (c, m) => breakEven(c, +m[1].replace(/,/g, ''), +m[2], +m[3])],
  [/^(?:credit card|pay off|payoff|debt payoff|how long to pay off)\s+\$?([\d,.]+)\s+(?:at|with)\s+([\d.]+)\s*%(?:\s*apr)?\s*,?\s*(?:paying|with payments of|at)?\s*\$?([\d,.]+)\s*(?:\/|a|per)\s*mo(?:nth)?$/i, (c, m) => payoff(c, +m[1].replace(/,/g, ''), +m[2], +m[3].replace(/,/g, ''))],
  [/^\$?([\d,.]+\s*k?)\s*(?:an?|per|\/)\s*(hour|hr|week|wk|month|mo|year|yr|day|biweekly)\s+(?:salary\s+)?(?:to|in|as|is how much)\s*(?:an?\s+)?(?:hourly|salary|yearly|annual|monthly|weekly|per hour|a year|an hour)?(?:\s+(?:at\s+)?(\d+)\s*(?:hours?|h)(?:\s*(?:a|per|\/)\s*week)?)?$|^\$?([\d,.]+\s*k?)\s+salary\s+(?:to|in)\s+hourly$/i, (c, m) => { const raw = (m[1] || m[4]).replace(/,/g, ''); const v = /k$/i.test(raw.trim()) ? parseFloat(raw) * 1000 : +raw; const per = m[4] ? 'year' : ({ hr: 'hour', wk: 'week', mo: 'month', yr: 'year' })[m[2].toLowerCase()] || m[2].toLowerCase(); salary(c, v, per, +(m[3] || 40)); }],
  [/^cagr\s+(?:from\s+)?\$?([\d,.]+)\s+to\s+\$?([\d,.]+)\s+(?:over|in)\s+([\d.]+)\s*(?:years?|yrs?)$/i, (c, m) => cagr(c, +m[1].replace(/,/g, ''), +m[2].replace(/,/g, ''), +m[3])],
  [/^(?:rule of 72|how long to double|doubling time)\s+(?:at\s+)?([\d.]+)\s*%$/i, (c, m) => { const r = +m[1]; c.label('Doubling time'); c.input(`${r}% per year`); c.add({ title: 'Years to double', big: true, text: `${fmt(72 / r, 2)} (rule of 72)`, note: `Exact with annual compounding: ${fmt(Math.log(2) / Math.log(1 + r / 100), 3)} years.` }); }],
  [/^(?:unit price|which is cheaper|better deal|compare prices)\s*:?\s*(.+)$/i, (c, m) => unitPrice(c, m[1])],
  [/^roi\s+(?:cost\s*=?\s*)?\$?([\d,.]+)\s*,?\s*(?:return|gain|value|revenue)\s*=?\s*\$?([\d,.]+)(?:\s+(?:over|in)\s+([\d.]+)\s*years?)?$/i, (c, m) => { const a = +m[1].replace(/,/g, ''), b = +m[2].replace(/,/g, ''); c.label('ROI'); c.input(`Cost $${fmt(a, 2)}, return $${fmt(b, 2)}`); c.add({ title: 'Return on investment', big: true, text: `${fmt(100 * (b - a) / a, 2)}%` }); if (m[3]) c.add({ title: 'Annualized', text: `${fmt(100 * ((b / a) ** (1 / +m[3]) - 1), 2)}% per year` }); }],
  // health
  [/^(?:bmr|tdee|maintenance calories|calories (?:i )?burn(?:ed)? per day)\s*:?\s*(.+)$/i, (c, m) => { const s = m[1].toLowerCase(); const sex = /\b(?:female|woman|f)\b/.test(s) ? 'f' : /\b(?:male|man|m)\b/.test(s) ? 'm' : null; const age = /(\d+)\s*(?:y|yo|years?|yrs?)?(?:\s*old)?\b/.exec(s.replace(/\d+(?:\.\d+)?\s*(?:kg|lbs?|pounds?|cm|in|ft|')/g, '')); const kg = /([\d.]+)\s*kg/.exec(s), lb = /([\d.]+)\s*(?:lbs?|pounds?)/.exec(s), cm = /([\d.]+)\s*cm/.exec(s), ft = /(\d)\s*(?:'|ft|feet)\s*(\d+)?/.exec(s); if (!sex || !age || !(kg || lb) || !(cm || ft)) throw new Error('Give sex, age, weight and height, e.g. “bmr female 20 60 kg 165 cm” or “tdee male 25 170 lbs 5 ft 10”.'); bmr(c, sex, +age[1], kg ? +kg[1] : +lb[1] * 0.453592, cm ? +cm[1] : (+ft[1] * 12 + +(ft[2] || 0)) * 2.54); }],
  [/^(?:heart rate zones?|target heart rate|hr zones?|max heart rate)\s+(?:for\s+)?(?:age\s+)?(\d+)(?:\s*,?\s*(?:resting|rhr)\s*(?:hr)?\s*=?\s*(\d+))?$/i, (c, m) => hrZones(c, +m[1], m[2] ? +m[2] : null)],
  [/^(?:sleep calculator|when should i (?:go to )?(?:sleep|bed)|bedtime)\s*(?:to|if i)?\s*(?:wake up|wake|get up)\s*(?:at\s+)?(.+)$/i, (c, m) => sleep(c, 'wake', m[1])],
  [/^(?:if i (?:go to )?(?:sleep|bed)(?: now| at (.+?))?,? when should i wake(?: up)?|when should i wake up(?: if i sleep (?:now|at (.+)))?|sleep now)$/i, (c, m) => sleep(c, 'sleep', m[1] || m[2])],
  [/^(?:pace|running pace|race pace)\s+(?:for\s+)?(?:a\s+)?(5k|10k|15k|1k|half marathon|half|marathon|mile|1 mile|1500m|800m|400m|[\d.]+\s*(?:km|k|mi|miles?|m))\s+(?:in|at|time)\s+([\d:]+)\s*(?:min(?:utes)?)?$/i, (c, m) => { const d = m[1].toLowerCase(); const km = DIST[d] ?? (/mi/.test(d) ? parseFloat(d) * 1.609344 : /km|k$/.test(d) ? parseFloat(d) : parseFloat(d) / 1000); pace(c, km, parseHMS(m[2])); }],
  // time
  [/^(?:business days|working days|weekdays)\s+(?:between|from)\s+(.+?)\s+(?:and|to|until)\s+(.+)$/i, (c, m, q, d) => { const a = d.parseDate(m[1]), b = d.parseDate(m[2]); if (!a || !b) return false; businessDays(c, a, b); }],
  [/^(\d+)\s+(?:business|working) days\s+(?:from|after)\s+(.+)$/i, (c, m, q, d) => { const a = /^(?:now|today)$/i.test(m[2]) ? new Date() : d.parseDate(m[2]); if (!a) return false; addBusinessDays(c, a, +m[1]); }],
  [/^(?:what )?week (?:number|of the year)(?:\s+(?:is it|for|of|on)\s*(.*))?$|^what week is it$/i, (c, m, q, d) => { const dt = m[1] && m[1].trim() ? d.parseDate(m[1]) : new Date(); if (!dt) return false; weekNum(c, dt); }],
  [/^(?:add (?:up )?(?:times?|durations?|hours)\s*:?\s*)?((?:\d+(?:\.\d+)?\s*(?:h|hrs?|hours?|m|mins?|minutes?|s|secs?|seconds?)\b\s*)+(?:\s*[+-]\s*(?:\d+(?:\.\d+)?\s*(?:h|hrs?|hours?|m|mins?|minutes?|s|secs?|seconds?)\b\s*)+)+)$/i, (c, m) => durations(c, m[1])],
  [/^(?:add (?:up )?(?:times?|durations?))\s*:?\s*(.+)$/i, (c, m) => durations(c, m[1])],
  [/^(?:time card|timecard|timesheet|hours worked|total hours)\s*:?\s*(.+)$/is, (c, m) => timeCard(c, m[1])],
  [/^(?:time|hours|how long)\s+(?:between|from)\s+(\d{1,2}(?::\d\d)?\s*(?:am|pm)?)\s+(?:and|to|until)\s+(\d{1,2}(?::\d\d)?\s*(?:am|pm)?)$/i, (c, m) => timeCard(c, `${m[1]} - ${m[2]}`)],
];
export const CALC_FEATURES = ['GPA from letter grades + Excel with formulas', 'Cumulative GPA + target planner', 'Final exam grade needed', 'Weighted grade (incl. what you need on the rest)', 'Significant figures count', 'Round to sig figs', 'Scientific/engineering notation', 'Percent error/difference', 'Error propagation (any formula)', 'One-sample t-test (data or summary)', 'Two-sample Welch + Student t-test', 'Paired t-test', 'Chi-square goodness of fit', 'Chi-square independence + Cramér’s V', 'One-way ANOVA + η²', 'CI for a mean (data or summary)', 'CI for a proportion (Wilson + Wald)', 'Sample size (proportion or mean)', 'z-score + percentile', 'p-values for z, t, χ², F', 'Frequency table + histogram + Excel', 'Five-number summary + box plot + outliers', 'Percent composition + molar mass', 'Empirical & molecular formula', 'Moles ⇄ grams ⇄ molecules', 'Molarity', 'Dilution (M₁V₁ = M₂V₂)', 'pH: strong/weak acids and bases, [H⁺], [OH⁻], pOH', 'Half-life decay + curve', 'Ideal gas law (any unknown, any units)', 'Projectile motion + trajectory CSV', 'Kinematics (SUVAT) solver', 'Resistor color code → value', 'Value → resistor colors + E12/E24', 'Series/parallel R, C, L', 'Voltage divider', 'LED resistor', 'Ohm’s law + power', 'RC/RL time constant + cutoff', 'Wavelength/frequency/photon energy', 'Thin lens/mirror', 'Snell’s law + critical angle', 'Orbits around 8 bodies', 'Decibels', 'DNA/RNA: complement, reverse complement, transcription, translation, ORF, GC, Tm', 'Protein MW + composition', 'Punnett squares (1–3 genes)', 'Hardy–Weinberg', 'Codon table + codon lookup', 'Set operations', 'List permutations/combinations', 'Power set', 'Decimal/repeating decimal → fraction', 'Shortest path (Dijkstra) + minimum spanning tree', 'Line through two points (slope, forms, distance, midpoint)', 'Triangle solver (SSS/SAS/ASA/AAS/SSA)', 'OEIS sequence lookup + next terms', 'Boolean simplification (Quine–McCluskey) from expression or minterms', 'NPV + Excel', 'IRR + payback', 'Break-even + chart', 'Credit card payoff + schedule', 'Salary ⇄ hourly', 'CAGR', 'Rule of 72', 'Unit price comparison', 'ROI', 'BMR/TDEE', 'Heart rate zones', 'Sleep cycle calculator', 'Running pace + race predictions', 'Business days between dates', 'Add business days', 'ISO week number', 'Add/subtract durations', 'Time card + pay + overtime'];
