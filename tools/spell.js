// Spelling correction without AI: Peter Norvig's method. Candidates one or two edits away
// (delete, swap, replace, insert a letter) are looked up in a 60,000-word list ranked by how
// common each word is in English (from the wordfreq project), and the most common one wins.
// Word list: derived from wordfreq by Robyn Speer (https://github.com/rspeer/wordfreq), CC BY-SA 4.0.
let WORDS = null, RANK = null, loading = null;
async function load() {
  if (RANK) return;
  if (!loading) loading = fetch(new URL('./data/words.txt', import.meta.url)).then(r => r.text()).then(t => { WORDS = t.split('\n'); RANK = new Map(WORDS.map((w, i) => [w, i + 1])); });
  return loading;
}
const LETTERS = "abcdefghijklmnopqrstuvwxyz'";
function edits1(w) {
  const out = [];
  for (let i = 0; i <= w.length; i++) {
    const a = w.slice(0, i), b = w.slice(i);
    if (b) out.push({ w: a + b.slice(1), k: 'del' });
    if (b.length > 1) out.push({ w: a + b[1] + b[0] + b.slice(2), k: 'swap' });
    for (const c of LETTERS) {
      if (b) out.push({ w: a + c + b.slice(1), k: 'rep' });
      out.push({ w: a + c + b, k: 'ins' });
    }
  }
  return out;
}
// Lower is better: common words win; swaps (teh → the) are the most likely typo.
const cost = (rank, kind, w, orig) => Math.log(rank) + (kind === 'swap' ? -0.7 : 0) + (w[0] !== orig[0] ? 1.2 : 0) + (kind === 'edit2' ? 2.2 : 0);
function editDist(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
function best(w) {
  let b = null;
  const consider = (cand, kind) => { const r = RANK.get(cand); if (!r) return; const c = cost(r, kind, cand, w); if (!b || c < b.c) b = { w: cand, c, r, k: kind }; };
  const e1 = edits1(w);
  for (const e of e1) consider(e.w, e.k);
  if (b || w.length < 5) return b;
  for (const e of e1) for (const e2 of edits1(e.w)) consider(e2.w, 'edit2');
  return b;
}
// Real words used in the wrong place, fixed from the words around them.
const CONFUSED = [[/\bcapitol of\b/gi, 'capital of'], [/\b(how|what|why|where|when|who) dose\b/gi, '$1 does'], [/\bdose (?:it|this|that|he|she|a|an|the)\b/gi, (m) => m.replace(/dose/i, 'does')],
  [/\bwether (?:in|for|at|today|tomorrow|tonight|this|next|forecast)\b/gi, (m) => m.replace(/wether/i, 'weather')], [/\bwhether (?:in|forecast)\b/gi, (m) => m.replace(/whether/i, 'weather')],
  [/^were (is|are|was|do|does|did|can)\b/i, 'where $1'], [/\bwitch (is|one|of)\b/gi, 'which $1'], [/\bloose weight\b/gi, 'lose weight'], [/\bwho's (car|book|house|phone|idea)\b/gi, 'whose $1'],
  [/\bwhat time is it (?:on|in) (?:the )?(\w+)\b/gi, (m) => m], [/\bdefiantly\b/gi, 'definitely'], [/\bpeak (?:my|your|his|her) interest\b/gi, (m) => m.replace(/peak/i, 'pique')]];
const KEEP = /^(?:km|mph|kph|kg|mg|ml|cm|mm|ft|lbs?|oz|hrs?|mins?|secs?|usd|eur|gbp|btc|eth|ph|dna|rna|gdp|cpi|nasa|mit|ucla|nyc|eli5|tldr|vs|etc|pdf|csv|json|url|api|sql|html|css|js|py|ok|okay)$/i;

export async function correct(text, { strict = false } = {}) {
  await load();
  const changes = [];
  let first = true;
  const out = text.replace(/[A-Za-z][A-Za-z']*/g, (tok, idx) => {
    const isFirst = first; first = false;
    const low = tok.toLowerCase();
    if (low.length < 3 || KEEP.test(low)) return tok;
    if (/[A-Z]/.test(tok.slice(1)) || (/^[A-Z]/.test(tok) && !isFirst && text !== text.toLowerCase())) return tok; // names, acronyms
    if (/[\d=+*/^]/.test(text.slice(Math.max(0, idx - 2), idx + tok.length + 2)) && low.length <= 4) return tok; // math variables
    const r = RANK.get(low);
    let fix = null;
    if (!r) {
      const b = best(low);
      if (b && (strict ? b.c < Math.log(low.length >= 8 ? 60000 : 20000) && (low.length >= 4 || (b.k === 'swap' && b.r < 2000)) && !/edit2/.test(b.k || '') && editDist(low, b.w) === 1 : (b.r < 40000 || low.length > 6))) fix = b.w;
    } else if (r > 15000 && !strict) {
      // a rare "word" that's a swap away from a very common one is almost always a typo (becuase → because)
      for (const e of edits1(low)) if (e.k === 'swap') { const r2 = RANK.get(e.w); if (r2 && r2 * 200 < r) { fix = e.w; break; } }
    }
    if (!fix || fix === low) return tok;
    changes.push([tok, fix]);
    return /^[A-Z]/.test(tok) ? fix[0].toUpperCase() + fix.slice(1) : fix;
  });
  let fixed = out;
  for (const [re, rep] of CONFUSED) fixed = fixed.replace(re, rep);
  return { text: fixed, changes, changed: fixed !== text };
}
export const isWord = async (w) => { await load(); return RANK.has(w.toLowerCase()); };
