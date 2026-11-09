// More rules, added after testing /tools with messy real-world questions.
// Each rule: [regex, (ctx, match, query, deps) => ...]; return false to let other rules try.
// deps = { S, S2, runEngine, engineButtons, ask, get }
// Nothing here uses AI: it's patterns, small lookup tables and public data sources.

const enc = encodeURIComponent;
const fmt = (n, d = 2) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d });

// ---------- grades ----------
function letter(p) {
  const L = [[97, 'A+'], [93, 'A'], [90, 'A−'], [87, 'B+'], [83, 'B'], [80, 'B−'], [77, 'C+'], [73, 'C'], [70, 'C−'], [67, 'D+'], [63, 'D'], [60, 'D−'], [0, 'F']];
  return L.find(([c]) => p >= c)[1];
}
function grade(ctx, got, of) {
  const p = got / of * 100;
  ctx.label('Grade');
  ctx.input(`${fmt(got)} out of ${fmt(of)}`);
  ctx.add({ title: 'Score', big: true, text: `${fmt(p, 2)}%  ·  ${letter(p)}`, table: [['Points missed', fmt(of - got)], ['GPA points (4.0 scale)', fmt({ 'A+': 4, A: 4, 'A−': 3.7, 'B+': 3.3, B: 3, 'B−': 2.7, 'C+': 2.3, C: 2, 'C−': 1.7, 'D+': 1.3, D: 1, 'D−': 0.7, F: 0 }[letter(p)], 1)], ['Points needed for an A (93%)', p >= 93 ? 'Already there' : fmt(Math.ceil(of * 0.93 - got))], ['Points needed for a B (83%)', p >= 83 ? 'Already there' : fmt(Math.ceil(of * 0.83 - got))]] , note: 'Uses the common US scale (93+ A, 90 A−, 87 B+ …). Your school’s cutoffs may differ.' });
}

// ---------- subject help ----------
const SUBJECTS = {
  math: ['solve 2x + 3 = 11', 'factor x^2 + 5x + 6', 'plot x^2 - 4x + 3', 'A train travels 60 mph for 2.5 hours. How far does it go?'],
  algebra: ['solve 3x - 7 = 2x + 9', 'solve x^2 - 5x + 6 = 0', 'expand (x+2)^3', 'The sum of two numbers is 30 and their difference is 4. Find the numbers.'],
  geometry: ['area of a circle with radius 4', 'A right triangle has legs 5 and 12. What is the hypotenuse?', 'volume of a cylinder with radius 3 and height 10', 'triangle with sides 5, 6, 7'],
  calculus: ['derivative of x^2 sin x', 'integrate x e^x', 'limit sin(x)/x as x -> 0', 'taylor series of e^x'],
  statistics: ['mean 4, 8, 15, 16, 23, 42', 'normal mean 100 sd 15 between 85 and 115', 'binomial n=10 p=0.5 k>=7', 'linear fit (1,2) (2,4.1) (3,5.9)'],
  chemistry: ['balance Fe + O2 -> Fe2O3', 'molar mass of H2SO4', 'element sodium', 'avogadro', 'caffeine'],
  physics: ['A car accelerates from rest at 3 m/s² for 5 s. How far does it travel?', 'What force accelerates a 1200 kg car at 2.5 m/s^2?', 'speed of light', '60 mph to m/s'],
  biology: ['explain photosynthesis', 'explain the difference between mitosis and meiosis', 'species red fox', 'pubmed crispr'],
  history: ['on this day', 'who was Abraham Lincoln', 'when did world war 2 end', 'explain the industrial revolution'],
  english: ['define serendipity', 'synonyms for happy', 'what does "irony" mean', 'summarize: (paste a passage)'],
  spanish: ['translate where is the library to spanish', 'translate buenos días to english', 'define biblioteca'],
  economics: ['inflation $100 in 1990', 'gdp of japan', 'compound interest $1000 at 5% for 10 years', 'explain supply and demand'],
  'computer science': ['explain this code: for i in range(10): print(i*i)', 'py: sorted([5, 2, 9])', '255 in binary', 'github sorting algorithms'],
};
SUBJECTS.chem = SUBJECTS.chemistry; SUBJECTS.bio = SUBJECTS.biology; SUBJECTS.stats = SUBJECTS.statistics; SUBJECTS.calc = SUBJECTS.calculus; SUBJECTS.cs = SUBJECTS['computer science']; SUBJECTS.science = [...SUBJECTS.chemistry.slice(0, 2), ...SUBJECTS.physics.slice(0, 2)]; SUBJECTS.precalc = SUBJECTS.algebra; SUBJECTS.trig = ['sin(30 deg)', 'solve sin(x) = 1/2', 'plot sin x, cos x from -pi to pi', 'law of cosines a=5 b=7 C=40 deg'];

// ---------- explaining code without AI: one pattern per common construct ----------
function explainExpr(e) {
  return e.trim()
    .replace(/\b(\w+)\s*\*\*\s*2\b/g, '$1 squared').replace(/\b(\w+)\s*\*\s*\1\b/g, '$1 × $1 ($1 squared)')
    .replace(/\s*\*\*\s*/g, ' to the power of ').replace(/\s*\/\/\s*/g, ' divided by (whole number) ').replace(/\s*%\s*/g, ' remainder after dividing by ')
    .replace(/\s*==\s*/g, ' equals ').replace(/\s*!=\s*/g, ' is not equal to ').replace(/\s*<=\s*/g, ' is at most ').replace(/\s*>=\s*/g, ' is at least ')
    .replace(/\s*&&\s*|\s+and\s+/g, ' and ').replace(/\s*\|\|\s*|\s+or\s+/g, ' or ').replace(/!(\w)/g, 'not $1')
    .replace(/\blen\(([^()]+)\)/g, 'the length of $1').replace(/\bstr\(([^()]+)\)/g, '$1 as text').replace(/\bint\(([^()]+)\)/g, '$1 as a whole number')
    .replace(/\b(\w+)\.length\b/g, 'the length of $1').replace(/\bMath\.(\w+)\(/g, '$1(');
}
function explainLine(line, lang) {
  const s = line.trim().replace(/;$/, '');
  let m;
  if (!s) return null;
  if (/^(#|\/\/)/.test(s)) return 'A comment: a note for people reading the code. It doesn’t run.';
  if (lang === 'py') {
    if ((m = /^for\s+(\w+)\s+in\s+range\(\s*([^,()]+)\s*\)\s*:$/.exec(s))) return `Repeat the indented code once for each ${m[1]} from 0 up to ${m[2]} − 1 (${/^\d+$/.test(m[2]) ? `${m[2]} times: ${m[1]} = 0, 1, …, ${+m[2] - 1}` : `${m[2]} times`}).`;
    if ((m = /^for\s+(\w+)\s+in\s+range\(\s*([^,]+),\s*([^,]+?)(?:,\s*([^,]+))?\s*\)\s*:$/.exec(s))) return `Repeat for each ${m[1]} starting at ${m[2]}, going up${m[4] ? ` in steps of ${m[4]}` : ''} and stopping before ${m[3]}.`;
    if ((m = /^for\s+(.+?)\s+in\s+enumerate\((.+)\)\s*:$/.exec(s))) return `Go through ${m[2]} one item at a time, getting both the position and the item (${m[1]}).`;
    if ((m = /^for\s+(.+?)\s+in\s+(.+)\s*:$/.exec(s))) return `Go through each item in ${m[2]}, calling the current one ${m[1]}, and run the indented code for it.`;
    if ((m = /^while\s+(.+):$/.exec(s))) return m[1] === 'True' ? 'Repeat the indented code forever (until a break or return).' : `Keep repeating the indented code as long as ${explainExpr(m[1])}.`;
    if ((m = /^if\s+(.+):$/.exec(s))) return `Only if ${explainExpr(m[1])}, run the indented code.`;
    if ((m = /^elif\s+(.+):$/.exec(s))) return `Otherwise, if ${explainExpr(m[1])}, run this part instead.`;
    if (/^else\s*:$/.test(s)) return 'Otherwise (none of the conditions above were true), run this part.';
    if ((m = /^def\s+(\w+)\((.*)\)\s*(?:->\s*\w+)?:$/.exec(s))) return `Define a function called ${m[1]}${m[2] ? ` that takes ${m[2]}` : ' with no inputs'}. The indented code runs each time it’s called.`;
    if ((m = /^class\s+(\w+)(?:\((.*)\))?:$/.exec(s))) return `Define a new kind of object called ${m[1]}${m[2] ? `, based on ${m[2]}` : ''}.`;
    if ((m = /^return\s+(.+)$/.exec(s))) return `Send back ${explainExpr(m[1])} as the function’s result and stop the function.`;
    if ((m = /^print\((.*)\)$/.exec(s))) return `Show ${m[1] ? explainExpr(m[1]) : 'a blank line'} on the screen.`;
    if ((m = /^import\s+(.+)$/.exec(s))) return `Load the ${m[1]} library so its tools can be used.`;
    if ((m = /^from\s+(\S+)\s+import\s+(.+)$/.exec(s))) return `Load ${m[2]} from the ${m[1]} library.`;
    if ((m = /^(\w+)\.append\((.+)\)$/.exec(s))) return `Add ${explainExpr(m[2])} to the end of the list ${m[1]}.`;
    if ((m = /^with\s+open\((.+?)\)\s+as\s+(\w+):$/.exec(s))) return `Open the file ${m[1].split(',')[0]} as ${m[2]}; it closes automatically afterwards.`;
    if (/^try:$/.test(s)) return 'Try the indented code; if it causes an error, jump to the except part instead of crashing.';
    if ((m = /^except\s*(.*):$/.exec(s))) return `If an error${m[1] ? ` of type ${m[1]}` : ''} happened above, run this part.`;
    if (s === 'break') return 'Leave the loop right now.';
    if (s === 'continue') return 'Skip the rest of this loop round and start the next one.';
    if (s === 'pass') return 'Do nothing (a placeholder).';
    if ((m = /^(\w+)\s*=\s*input\((.*)\)$/.exec(s))) return `Ask the user to type something${m[2] ? ` (showing ${m[2]})` : ''} and store what they type in ${m[1]} as text.`;
    if ((m = /^(\w+)\s*=\s*\[(.+)\s+for\s+(\w+)\s+in\s+(.+?)(?:\s+if\s+(.+))?\]$/.exec(s))) return `Build a list ${m[1]}: for each ${m[3]} in ${m[4]}${m[5] ? ` where ${explainExpr(m[5])}` : ''}, include ${explainExpr(m[2])}.`;
  } else {
    if ((m = /^for\s*\(\s*(?:let|var|const)?\s*(\w+)\s*=\s*([^;]+);\s*\1\s*(<=?)\s*([^;]+);\s*\1(\+\+|\+=\s*\d+)\s*\)\s*\{?$/.exec(s))) return `Repeat the code in braces with ${m[1]} starting at ${m[2]} and going up${m[5] === '++' ? ' by 1' : ` by ${m[5].replace('+=', '').trim()}`} while ${m[1]} ${m[3] === '<' ? 'is less than' : 'is at most'} ${m[4]}.`;
    if ((m = /^for\s*\(\s*(?:const|let|var)\s+(\w+)\s+of\s+(.+?)\)\s*\{?$/.exec(s))) return `Go through each item in ${m[2]}, calling it ${m[1]}.`;
    if ((m = /^while\s*\((.+)\)\s*\{?$/.exec(s))) return `Keep repeating while ${explainExpr(m[1])}.`;
    if ((m = /^if\s*\((.+)\)\s*\{?$/.exec(s))) return `Only if ${explainExpr(m[1])}, run the code in braces.`;
    if ((m = /^\}?\s*else if\s*\((.+)\)\s*\{?$/.exec(s))) return `Otherwise, if ${explainExpr(m[1])}, run this part.`;
    if (/^\}?\s*else\s*\{?$/.test(s)) return 'Otherwise, run this part.';
    if ((m = /^(?:async\s+)?function\s+(\w+)\s*\((.*)\)\s*\{?$/.exec(s))) return `Define a function ${m[1]}${m[2] ? ` taking ${m[2]}` : ''}.`;
    if ((m = /^(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(?([\w,\s]*)\)?\s*=>/.exec(s))) return `Define a function ${m[1]}${m[2] ? ` taking ${m[2]}` : ''} (arrow-function style).`;
    if ((m = /^console\.log\((.*)\)$/.exec(s))) return `Print ${explainExpr(m[1])} to the console.`;
    if ((m = /^return\s+(.+)$/.exec(s))) return `Send back ${explainExpr(m[1])} as the result.`;
    if ((m = /^(\w+)\.push\((.+)\)$/.exec(s))) return `Add ${m[2]} to the end of the array ${m[1]}.`;
    if (/^\}$/.test(s)) return 'End of the block.';
    if ((m = /^(const|let|var)\s+(\w+)\s*=\s*(.+)$/.exec(s))) return `Create a ${m[1] === 'const' ? 'constant (can’t be reassigned)' : 'variable'} ${m[2]} and set it to ${explainExpr(m[3])}.`;
  }
  if ((m = /^(\w+)\s*\+=\s*(.+)$/.exec(s))) return `Add ${explainExpr(m[2])} to ${m[1]}.`;
  if ((m = /^(\w+)\s*-=\s*(.+)$/.exec(s))) return `Subtract ${explainExpr(m[2])} from ${m[1]}.`;
  if ((m = /^(\w+)\s*\*=\s*(.+)$/.exec(s))) return `Multiply ${m[1]} by ${explainExpr(m[2])}.`;
  if ((m = /^(\w+)\s*(\+\+|--)$/.exec(s))) return `${m[2] === '++' ? 'Add 1 to' : 'Subtract 1 from'} ${m[1]}.`;
  if ((m = /^([\w.[\]'"]+)\s*=\s*(.+)$/.exec(s))) return `Store ${explainExpr(m[2])} in ${m[1]}.`;
  if ((m = /^(\w+)\((.*)\)$/.exec(s))) return `Call (run) the function ${m[1]}${m[2] ? ` with ${m[2]}` : ''}.`;
  return null;
}
function splitCode(code, lang) {
  // "for i in range(10): print(i*i)" → header + indented body
  const out = [];
  for (const raw of code.replace(/\r/g, '').split('\n')) {
    const ind = raw.match(/^\s*/)[0].length;
    if (lang === 'py') {
      const m = /^(\s*(?:for|while|if|elif|else|def|with|try|except|class)\b[^:#]*:)\s*(\S.*)$/.exec(raw);
      if (m && !/^\s*(?:lambda)/.test(m[2])) { out.push({ t: m[1], ind }); out.push({ t: m[2], ind: ind + 4 }); continue; }
      for (const part of raw.split(/;\s*/)) if (part.trim()) out.push({ t: part.trim(), ind });
    } else {
      for (const part of raw.split(/;\s*(?=\S)/)) if (part.trim()) out.push({ t: part.trim(), ind });
    }
  }
  return out;
}
function explainCode(ctx, code, deps) {
  const lang = /console\.log|=>|\b(?:let|const|var)\s|function\s*\w*\(|[{}];?\s*$/m.test(code) ? 'js' : /\b(?:print|def|range|elif|import|input)\b|:\s*$/m.test(code) ? 'py' : /#include|printf|cout/.test(code) ? 'c' : 'py';
  ctx.label('Code');
  ctx.input(`${{ py: 'Python', js: 'JavaScript', c: 'C/C++' }[lang]} code, explained line by line`);
  const lines = splitCode(code, lang);
  const rows = lines.map(l => [' '.repeat(Math.min(l.ind, 12)) + l.t, explainLine(l.t, lang) || '(not sure what this line does: no pattern for it)']);
  ctx.add({ title: 'Line by line', table: { head: ['Code', 'What it does'], rows }, note: 'Explained by matching common patterns (loops, conditions, functions, printing), not by AI. Indented lines belong to the line above them.' });
  if (lang === 'py' && !/\binput\(|open\(|while\s+True/.test(code)) {
    const py = lines.map(l => ' '.repeat(l.ind) + l.t).join('\n');
    ctx.add({ title: 'Run it', buttons: [{ label: 'Run this Python', query: `py: ${py}` }], note: 'Runs in your browser with Pyodide and shows the output.' });
  }
}

// ---------- word sense in context (simplified Lesk: pick the definition sharing most words with the sentence) ----------
const STOPW = new Set('a an the of to in on at for and or but is are was were be been it this that with as by from his her their its my your our not no'.split(' '));
const toks = (s) => (s.toLowerCase().match(/[a-z]+/g) || []).filter(w => w.length > 2 && !STOPW.has(w)).map(w => w.replace(/(?:ing|ed|es|s)$/, ''));
async function defineInContext(ctx, word, sentence, deps) {
  ctx.label('Dictionary');
  ctx.input(`“${word}” in: ${sentence}`);
  const data = await deps.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${enc(word)}`, { proxy: true }).catch(() => null);
  if (!data || !data[0]) return deps.S.define(ctx, word);
  const ctxT = new Set(toks(sentence).filter(t => t !== toks(word)[0]));
  const senses = [];
  for (const e of data) for (const mm of e.meanings) for (const d of mm.definitions) {
    const bag = toks(`${d.definition} ${d.example || ''} ${(d.synonyms || []).join(' ')} ${(mm.synonyms || []).join(' ')}`);
    const overlap = bag.filter(t => ctxT.has(t)).length;
    senses.push({ pos: mm.partOfSpeech, def: d.definition, ex: d.example, overlap });
  }
  const best = [...senses].sort((a, b) => b.overlap - a.overlap)[0];
  const cue = best.overlap > 0;
  ctx.add({ title: cue ? 'Best fit in your sentence' : 'Most common meaning', big: true, text: `(${best.pos}) ${cue ? best.def : senses[0].def}`, note: cue ? `Chosen because it shares words with your sentence (the Lesk method). Other meanings are below.` : 'None of the definitions share words with your sentence, so this is the first-listed meaning. Check the others below.' });
  if (word.toLowerCase() === 'irony' || /ironic/.test(word)) ctx.add({ title: 'In your sentence', text: 'Situational irony: the outcome is the opposite of what you’d expect (a fire station is the last place you’d expect to burn down).' });
  ctx.add({ title: 'All meanings', numbered: senses.slice(0, 10).map(s => `(${s.pos}) ${s.def}${s.ex ? ` — “${s.ex}”` : ''}`) });
  ctx.source('Free Dictionary API', 'https://dictionaryapi.dev');
}

// ---------- recipes from ingredients ----------
async function recipesWith(ctx, ingredients, deps) {
  const ings = ingredients.split(/\s*(?:,|\band\b|&|\+)\s*/).map(s => s.trim().replace(/^(?:some|a|an|the|leftover)\s+/, '').replace(/s$/, '')).filter(Boolean).slice(0, 4);
  ctx.label('Recipes');
  ctx.input(`Meals using ${ings.join(' + ')}`);
  const lists = await Promise.all(ings.map(i => deps.get(`https://www.themealdb.com/api/json/v1/1/filter.php?i=${enc(i.replace(/\s+/g, '_'))}`).then(r => r.meals || []).catch(() => [])));
  const byId = new Map();
  lists.forEach((l, k) => l.forEach(m => { const e = byId.get(m.idMeal) || { m, n: 0, has: [] }; e.n++; e.has.push(ings[k]); byId.set(m.idMeal, e); }));
  // also search meal names ("chicken rice" → "Chicken Fried Rice")
  const named = await deps.get(`https://www.themealdb.com/api/json/v1/1/search.php?s=${enc(ings.join(' '))}`).then(r => r.meals || []).catch(() => []);
  for (const m of named) { const e = byId.get(m.idMeal) || { m, n: 0, has: [] }; e.n = Math.max(e.n, ings.length); e.has = ings; byId.set(m.idMeal, e); }
  const ranked = [...byId.values()].sort((a, b) => b.n - a.n);
  if (!ranked.length) throw new Error(`No recipes found with ${ings.join(' and ')}.`);
  const all = ranked.filter(r => r.n >= ings.length);
  const show = (all.length ? all : ranked).slice(0, 12);
  ctx.add({ title: all.length ? `Uses all of: ${ings.join(', ')}` : `No recipe uses all of them. Closest matches`, list: show.map(r => ({ title: r.m.strMeal, thumb: r.m.strMealThumb, meta: `uses ${r.has.join(', ')}`, query: `recipe ${r.m.strMeal}` })), note: 'Tap one for ingredients and steps.' });
  ctx.source('TheMealDB', 'https://www.themealdb.com');
}

// ---------- shopping / opinions: no made-up recommendations ----------
function shopping(ctx, thing, q) {
  ctx.label('Shopping');
  ctx.input(q);
  ctx.add({ title: 'No opinions here', text: 'This page only answers from data it can check, so it won’t pick a “best” product. These reviewers test products and explain their picks:', buttons: [
    { label: 'Wirecutter', url: `https://www.nytimes.com/wirecutter/search/?s=${enc(thing)}` }, { label: 'RTINGS', url: `https://www.rtings.com/search?q=${enc(thing)}` },
    { label: 'Consumer Reports', url: `https://www.consumerreports.org/search/?query=${enc(thing)}` }, { label: 'Reddit discussions', url: `https://www.google.com/search?q=${enc(q + ' site:reddit.com')}` },
    { label: 'Compare prices', url: `https://www.google.com/search?tbm=shop&q=${enc(thing)}` }] });
}

// ---------- weather at a specific time ----------
async function weatherAt(ctx, what, place, when, time, deps) {
  ctx.label('Weather');
  const geo = await deps.get(`https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name=${enc(place.replace(/,.*$/, '').trim())}`);
  let cands = geo.results || [];
  const hint = (place.split(',')[1] || '').trim().toLowerCase();
  if (hint) cands = [...cands].sort((a, b) => (b.admin1 || '').toLowerCase().startsWith(hint) - (a.admin1 || '').toLowerCase().startsWith(hint) || (b.country_code || '').toLowerCase() === hint);
  const g = cands[0];
  if (!g) throw new Error(`Couldn't find a place called "${place}".`);
  const label = [g.name, g.admin1, g.country].filter(Boolean).join(', ');
  const w = await deps.get(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&timezone=auto&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&forecast_days=8&hourly=temperature_2m,precipitation_probability,precipitation,snowfall,weather_code,wind_speed_10m,cloud_cover`);
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: w.timezone }));
  const day = new Date(now); day.setHours(0, 0, 0, 0);
  const wd = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const wl = (when || 'today').toLowerCase();
  if (wl === 'tomorrow') day.setDate(day.getDate() + 1);
  else if (wd.some(x => wl.includes(x))) { const t = wd.findIndex(x => wl.includes(x)); let add = (t - day.getDay() + 7) % 7; if (add === 0 && /next/.test(wl)) add = 7; day.setDate(day.getDate() + add); }
  let hour = null;
  if (time) { const tm = /(\d{1,2})(?::(\d\d))?\s*(am|pm)?/i.exec(time); if (tm) { hour = +tm[1] % 12 + (/pm/i.test(tm[3] || '') || (!tm[3] && +tm[1] < 8) ? 12 : 0); if (/noon/i.test(time)) hour = 12; } if (/noon/i.test(time)) hour = 12; if (/morning/i.test(time)) hour = 9; if (/afternoon/i.test(time)) hour = 15; if (/evening|tonight/i.test(time)) hour = 19; if (/night/i.test(time) && hour == null) hour = 21; }
  const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  const idx = w.hourly.time.map((t, i) => [t, i]).filter(([t]) => t.startsWith(ymd));
  if (!idx.length) throw new Error('That day is past the 7-day forecast.');
  const pick = hour != null ? idx.find(([t]) => +t.slice(11, 13) === hour) || idx[12] : null;
  const H = w.hourly;
  const dayName = day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  ctx.input(`${label}, ${dayName}${pick ? ` at ${new Date(pick[0]).toLocaleTimeString('en-US', { hour: 'numeric' })}` : ''}`);
  const snow = /snow/.test(what);
  if (pick) {
    const i = pick[1];
    const p = H.precipitation_probability[i];
    const yes = p >= 50 ? 'Likely' : p >= 25 ? 'Possible' : 'Unlikely';
    ctx.add({ title: `${snow ? 'Snow' : 'Rain'} at that time`, big: true, text: `${yes}: ${p}% chance`, table: [['Temperature', `${Math.round(H.temperature_2m[i])}°F`], ['Expected amount', `${H[snow ? 'snowfall' : 'precipitation'][i]} ${snow ? 'cm' : 'in'}`], ['Clouds', `${H.cloud_cover[i]}%`], ['Wind', `${Math.round(H.wind_speed_10m[i])} mph`]] });
  }
  const hrs = idx.filter((_, k) => k % 1 === 0);
  const maxP = Math.max(...hrs.map(([, i]) => H.precipitation_probability[i] ?? 0));
  ctx.add({ title: `${dayName}, hour by hour`, plot: { kind: 'line', xdate: true, ytitle: '% chance', traces: [{ name: `${snow ? 'Snow' : 'Rain'} chance %`, x: hrs.map(([t]) => t), y: hrs.map(([, i]) => H.precipitation_probability[i]), bars: true }, { name: 'Temperature °F', x: hrs.map(([t]) => t), y: hrs.map(([, i]) => H.temperature_2m[i]), yaxis: 'y2' }], y2title: '°F' }, note: `Highest chance that day: ${maxP}%.` });
  if (cands.length > 1) ctx.add({ title: `Not this ${g.name}?`, chips: cands.slice(1, 5).map(c => `will it rain in ${[c.name, c.admin1, c.country_code].filter(Boolean).join(', ')} ${when || 'today'}${time ? ' at ' + time : ''}`) });
  ctx.source('Open-Meteo', 'https://open-meteo.com');
}

// ---------- compare two things ("difference between X and Y", "X vs Y") ----------
async function compare(ctx, a, b, deps) {
  ctx.label('Comparison');
  ctx.input(`${a} vs ${b}`);
  const sum = async (t) => {
    for (const host of ['simple.wikipedia.org', 'en.wikipedia.org']) {
      try {
        const s = await deps.get(`https://${host}/w/api.php?action=query&list=search&srsearch=${enc(t)}&srlimit=3&format=json&origin=*`);
        const hit = (s.query.search || []).find(x => x.title.toLowerCase().includes(t.toLowerCase().replace(/s$/, ''))) || (s.query.search || [])[0];
        if (!hit) continue;
        const p = await deps.get(`https://${host}/api/rest_v1/page/summary/${enc(hit.title.replace(/ /g, '_'))}`);
        const full = await deps.get(`https://${host}/w/api.php?action=query&prop=extracts&explaintext=1&exintro=0&exchars=12000&titles=${enc(hit.title)}&format=json&origin=*`).catch(() => null);
        const text = full ? Object.values(full.query.pages)[0].extract || '' : '';
        return { title: p.title, extract: p.extract, text, url: p.content_urls.desktop.page, host };
      } catch (e) { /* busy or missing: try the next source */ }
    }
    const d = await deps.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(t)}&format=json&no_html=1&skip_disambig=1`).catch(() => null);
    return d && d.AbstractText ? { title: d.Heading || t, extract: d.AbstractText, text: d.AbstractText, url: d.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(t)}` } : null;
  };
  const [A, B] = await Promise.all([sum(a), sum(b)]);
  if (!A && !B) throw new Error(`Couldn't find either "${a}" or "${b}".`);
  for (const X of [A, B]) if (X) ctx.add({ title: X.title, text: X.extract, links: [{ label: 'Read more', url: X.url }] });
  // sentences in one article that mention the other: these usually state the difference
  const mention = (X, other) => X && X.text ? X.text.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/).filter(s => new RegExp(`\\b${other.replace(/s$/, '')}`, 'i').test(s) && s.length < 350).slice(0, 3) : [];
  const both = [...mention(A, b), ...mention(B, a)];
  const diff = both.filter(s => /\bunlike|whereas|while|differ|in contrast|compared|but|instead|however|only|both\b/i.test(s));
  if (both.length) ctx.add({ title: 'Where the sources compare them', numbered: (diff.length ? diff : both).slice(0, 5), note: 'Sentences from each article that mention the other one, quoted as written.' });
  ctx.add({ title: 'Learn more', buttons: [{ label: 'Khan Academy', url: `https://www.khanacademy.org/search?page_search_query=${enc(a + ' ' + b)}` }, { label: 'YouTube explainers', url: `https://www.youtube.com/results?search_query=${enc(`${a} vs ${b} explained`)}` }] });
  ctx.source('Wikipedia', (A || B).url);
}

const ALIAS = { nyc: 'New York City', 'new york city': 'New York City', la: 'Los Angeles', sf: 'San Francisco', dc: 'Washington, D.C.', 'washington dc': 'Washington, D.C.', philly: 'Philadelphia', vegas: 'Las Vegas', nola: 'New Orleans', chi: 'Chicago', atx: 'Austin' };
export const placeAlias = (p) => ALIAS[p.trim().toLowerCase()] || p.trim();

export const MORE_RULES = [
  // features of a function
  [/^(?:find\s+|what is\s+|what are\s+)?(?:the\s+)?(vertex|axis of symmetry|y-?intercepts?|x-?intercepts?|intercepts|turning points?|domain|range|key features|features|minimum|maximum|max|min)(?:\s+(?:and|,)\s+[a-z -]+?)?\s+(?:of\s+)?(?:the\s+)?(?:function\s+|parabola\s+|graph of\s+)?(?:y\s*=\s*|f\(x\)\s*=\s*)?([^a-z]*x[^?]*)$/i, (c, m, q, d) => d.runEngine(c, { op: 'features', expr: m[2] }, 'Function')],
  // code
  [/^(?:explain|what does|walk me through|describe)\s+(?:this|the following|my)?\s*(?:python|javascript|js|code|program|script|snippet)(?:\s+do)?\s*[:\-]?\s*([\s\S]{4,})$/i, (c, m, q, d) => explainCode(c, m[1].replace(/^```\w*\n?|```$/g, ''), d)],
  // word in context
  [/^what does\s+["“']?([a-z][a-z'-]*)["”']?\s+mean\s+in\s+(?:this|the following|my|that)\s+(?:sentence|context|passage|line|quote)\s*[:\-]?\s*(.+)$/i, (c, m, q, d) => defineInContext(c, m[1], m[2], d)],
  [/^what does\s+["“']([^"”']+)["”']\s+mean(?:\s+here)?$/i, (c, m, q, d) => d.S.define(c, m[1])],
  // grades
  [/^(?:i\s+)?(?:got|scored|have|earned|had)?\s*(\d+(?:\.\d+)?)\s*(?:out of|\/|of)\s*(\d+(?:\.\d+)?)(?:\s*(?:points|pts))?(?:[,.]?\s*(?:what(?:'s| is)?|is that|as a|in|to)?\s*(?:my|the|a)?\s*(?:percent(?:age)?|grade|letter grade|score|%)(?:\s+and\s+(?:letter\s+)?grade)?(?:\s+is\s+that)?)?$/i, (c, m) => (+m[2] > 0 && +m[1] <= +m[2] * 1.5 ? grade(c, +m[1], +m[2]) : false)],
  [/^(?:what(?:'s| is) )?(?:my )?(?:grade|percent(?:age)?|score)\s+(?:for|if i got|with)\s+(\d+(?:\.\d+)?)\s*(?:out of|\/|of)\s*(\d+(?:\.\d+)?)$/i, (c, m) => grade(c, +m[1], +m[2])],
  // subject help
  [/^(?:can you\s+)?(?:help(?: me)?(?: with)?|i need help(?: with)?|stuck on)\s+(?:my\s+)?(.+?)\s*(?:homework|hw|assignment|class|test|exam|quiz|problems?|work)?$/i, (c, m) => {
    const k = m[1].toLowerCase().trim();
    const list = SUBJECTS[k] || SUBJECTS[k.replace(/s$/, '')];
    if (!list) return false;
    c.label('Help'); c.input(`What I can do for ${k}`);
    c.add({ title: `Try these for ${k}`, chips: list, note: 'Or paste a problem, a whole worksheet (numbered problems are answered one by one), or drop in a PDF or photo of it.' });
  }],
  // follow-ups are handled in app.js (they need the previous question)
  // weather at a time
  [/^(?:will|is) it (?:going to )?(rain|snow|storm|be (?:sunny|rainy|cold|hot|warm|windy))\s+(?:in|at|near)\s+(.+?)\s*(today|tonight|tomorrow|on (?:next )?\w+day|(?:next |this )?\w+day)?(?:\s+(?:at|around|by|in the)\s+(.+))?$/i, (c, m, q, d) => weatherAt(c, m[1], placeAlias(m[2]), (m[3] || 'today').replace(/^on\s+/, ''), m[4] || (/tonight/i.test(m[3] || '') ? 'tonight' : null), d)],
  [/^(?:will|is) it (?:going to )?(rain|snow)\s*(today|tonight|tomorrow|on \w+day|\w+day)?(?:\s+(?:at|around)\s+(.+?))?\s+(?:in|at)\s+(.+)$/i, (c, m, q, d) => weatherAt(c, m[1], placeAlias(m[4]), (m[2] || 'today').replace(/^on\s+/, ''), m[3], d)],
  // distance + drive time in one question
  [/^how far is\s+(?:it\s+)?from\s+(.+?)\s+to\s+(.+?)(?:\s*(?:,|and|&)\s*how long.*)?$/i, (c, m, q, d) => d.S.directions(c, placeAlias(m[1]), placeAlias(m[2]))],
  [/^how far is\s+(.+?)\s+from\s+(.+?)(?:\s*(?:,|and|&)\s*how long.*)?$/i, (c, m, q, d) => d.S.directions(c, placeAlias(m[2]), placeAlias(m[1]))],
  [/^(?:distance|directions|drive|driving time)\s+(?:from\s+)?(.+?)\s+to\s+(.+)$/i, (c, m, q, d) => d.S.directions(c, placeAlias(m[1]), placeAlias(m[2]))],
  [/^how long (?:does it take )?(?:is the |to )?(?:drive|driving|get|travel|go)\s+from\s+(.+?)\s+to\s+(.+)$/i, (c, m, q, d) => d.S.directions(c, placeAlias(m[1]), placeAlias(m[2]))],
  // recipes from ingredients
  [/^(?:what (?:can|should|could) i (?:make|cook|have)(?: for (?:dinner|lunch|breakfast))?|recipes?|meals?|dinner ideas?|something to cook)\s+(?:with|using|from|that uses?)\s+(.+)$/i, (c, m, q, d) => recipesWith(c, m[1], d)],
  [/^what (?:should|can) i (?:make|cook|have) for (?:dinner|lunch|breakfast)(?: tonight)?\s+(?:with|using)\s+(.+)$/i, (c, m, q, d) => recipesWith(c, m[1], d)],
  // shopping
  [/^(?:what(?:'s| is| are) the )?(?:best|top|good|cheapest|recommended)\s+(.+?)(?:\s+(?:for|under|below|around|with)\s+.+)?$/i, (c, m, q) => (/\b(?:way|time|method|practice|algorithm|answer|friend|picture|movie|song|book)\b/i.test(m[1]) ? false : shopping(c, m[1], q))],
  [/^(?:should i (?:buy|get))\s+(.+)$/i, (c, m, q) => shopping(c, m[1], q)],
  // comparisons
  [/^(?:explain\s+|what(?:'s| is)\s+)?(?:the\s+)?(?:difference|differences|diff)\s+between\s+(?:a\s+|an\s+)?(.+?)\s+and\s+(?:a\s+|an\s+)?(.+)$/i, (c, m, q, d) => compare(c, m[1], m[2], d)],
  [/^(?:compare\s+)?([a-z][\w' -]{2,40}?)\s+(?:vs\.?|versus|or|compared to|compared with)\s+([a-z][\w' -]{2,40})$/i, (c, m, q, d) => (/^(?:compare)/i.test(q) || /\bvs\.?\b|versus/i.test(q) ? compare(c, m[1], m[2], d) : false)],
];

// Clean up "explain like I'm 5 how loans work" → "loan".
export function cleanTopic(t) {
  let s = t.trim().replace(/[?.!]+$/, '');
  s = s.replace(/^(?:like i'?m (?:5|five|a kid|a child|ten|10)|to me like i'?m \w+|simply|in simple terms|to a kid|to a beginner)\s*,?\s*/i, '');
  s = s.replace(/^(?:how|why|what)\s+(?:do|does|did|is|are)\s+(?:a |an |the )?(.+?)\s+(?:work|works|function|happen)s?$/i, '$1');
  s = s.replace(/^how\s+(?:a |an |the )?(.+?)\s+works?$/i, '$1');
  s = s.replace(/^(?:what (?:is|are)|about|the concept of|the idea of)\s+/i, '');
  if (/^[a-z]+s$/i.test(s) && !/(?:ss|us|is|ics)$/i.test(s)) s = s.replace(/ies$/i, 'y').replace(/([^aeiou])s$/i, '$1');
  return s;
}
