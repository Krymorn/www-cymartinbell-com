// Files as context: PDFs, text, Markdown, code, CSV/TSV and JSON are read entirely in the
// browser (nothing is uploaded). No AI: passages are found with BM25 keyword ranking and
// summaries are extractive (the highest-scoring sentences from the document itself).

const docs = [];
let api = null; // { newCard, ask, h, engineButtons }

const STOP = new Set(('a about above after again against all am an and any are aren as at be because been before being below between both but by can cannot could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself let me more most my myself no nor not of off on once only or other ought our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why with would you your yours yourself yourselves also however thus therefore may might must shall will within without via per et al fig figure table eg ie one two three using used use based new can could would also et ' +
  'within upon among towards toward whether either neither yet still although though since unless every much many such these those').split(' '));

const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
let pdfP = null;
function loadPdfJs() {
  if (!pdfP) pdfP = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PDFJS + 'pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; res(window.pdfjsLib); };
    s.onerror = () => rej(new Error('Couldn’t load the PDF reader.'));
    document.head.append(s);
  });
  return pdfP;
}

// ---------- text helpers ----------
const stem = (w) => w.replace(/(?:ies)$/, 'y').replace(/(?:ing|edly|ed|ly|es|s)$/, '').replace(/(.)\1$/, '$1');
const tokens = (t) => (t.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) || []).map(w => w.replace(/'s$/, '')).filter(w => w.length > 1 && !STOP.has(w));
const words = (t) => t.split(/\s+/).filter(Boolean);
function sentences(t) {
  return t.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/).map(s => s.trim()).filter(Boolean);
}
function syllables(w) { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (w.length <= 3) return 1; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); const m = w.match(/[aeiouy]{1,2}/g); return m ? m.length : 1; }

function chunk(pages) {
  // Passages of ~90 words that keep their page number, overlapping a little.
  const out = [];
  for (const p of pages) {
    const ss = sentences(p.text);
    let cur = [], n = 0;
    for (const s of ss) {
      cur.push(s); n += words(s).length;
      if (n >= 90) { out.push({ page: p.n, text: cur.join(' ') }); cur = cur.slice(-1); n = words(cur[0]).length; }
    }
    if (cur.length && (n > 15 || !out.length)) out.push({ page: p.n, text: cur.join(' ') });
  }
  return out;
}

function buildIndex(doc) {
  doc.chunks = chunk(doc.pages);
  const df = new Map();
  doc.chunks.forEach(c => { c.toks = tokens(c.text).map(stem); c.tf = new Map(); c.toks.forEach(t => c.tf.set(t, (c.tf.get(t) || 0) + 1)); new Set(c.toks).forEach(t => df.set(t, (df.get(t) || 0) + 1)); });
  doc.df = df;
  doc.avgLen = doc.chunks.reduce((a, c) => a + c.toks.length, 0) / Math.max(doc.chunks.length, 1);
}

function bm25(doc, q) {
  const qt = [...new Set(tokens(q).map(stem))];
  if (!qt.length) return [];
  const N = doc.chunks.length, k1 = 1.4, b = 0.75;
  const phrase = q.toLowerCase().replace(/^["']|["']$/g, '').trim();
  return doc.chunks.map((c, i) => {
    let s = 0;
    for (const t of qt) {
      const f = c.tf.get(t); if (!f) continue;
      const idf = Math.log(1 + (N - doc.df.get(t) + 0.5) / (doc.df.get(t) + 0.5));
      s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * c.toks.length / doc.avgLen));
    }
    const hit = qt.filter(t => c.tf.has(t)).length / qt.length;
    if (phrase.split(' ').length > 1 && c.text.toLowerCase().includes(phrase)) s *= 1.8;
    return { i, s: s * (0.5 + hit), c };
  }).filter(r => r.s > 0).sort((a, b) => b.s - a.s);
}

// TextRank: sentences vote for each other by shared words; the best-connected ones win.
function summarize(text, n = 5) {
  const all = sentences(text);
  const ss = all.filter(s => { const w = words(s).length; return w >= 7 && w <= 60 && (s.match(/\d/g) || []).length < s.length * 0.15 && !/^(?:figure|fig\.|table)\s*\d/i.test(s) && !/@|[∗†‡]|https?:\/\/|\bet al\.\s*,?\s*\(?\d{4}/.test(s) && (s.match(/\b[A-Z][a-z]+\b/g) || []).length < words(s).length * 0.6; });
  if (!ss.length) return [];
  if (ss.length <= n) return ss;
  const sets = ss.map(s => new Set(tokens(s).map(stem)));
  const N = ss.length;
  const W = Array.from({ length: N }, () => new Float64Array(N));
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    let inter = 0; sets[i].forEach(t => sets[j].has(t) && inter++);
    if (!inter) continue;
    const w = inter / (Math.log(sets[i].size + 1) + Math.log(sets[j].size + 1));
    W[i][j] = W[j][i] = w;
  }
  const out = W.map(r => r.reduce((a, b) => a + b, 0) || 1);
  let score = new Float64Array(N).fill(1);
  for (let it = 0; it < 40; it++) {
    const nxt = new Float64Array(N);
    for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) if (W[j][i]) s += W[j][i] / out[j] * score[j]; nxt[i] = 0.15 + 0.85 * s; }
    score = nxt;
  }
  const ranked = [...score].map((s, i) => ({ i, s: s * (1 + 0.35 * Math.max(0, 1 - i / Math.max(N * 0.2, 4))) })).sort((a, b) => b.s - a.s);
  const picked = [];
  for (const x of ranked) {
    if (picked.length >= n) break;
    if (picked.some(p => { let inter = 0; sets[x.i].forEach(t => sets[p.i].has(t) && inter++); return inter / Math.min(sets[x.i].size, sets[p.i].size) > 0.55; })) continue;
    picked.push(x);
  }
  return picked.sort((a, b) => a.i - b.i).map(x => ss[x.i]);
}

// ---------- names, places, organisations (no AI: capitalisation + cue words) ----------
const US_STATES = 'Alabama Alaska Arizona Arkansas California Colorado Connecticut Delaware Florida Georgia Hawaii Idaho Illinois Indiana Iowa Kansas Kentucky Louisiana Maine Maryland Massachusetts Michigan Minnesota Mississippi Missouri Montana Nebraska Nevada Ohio Oklahoma Oregon Pennsylvania Tennessee Texas Utah Vermont Virginia Washington Wisconsin Wyoming'.split(' ').concat(['New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Rhode Island', 'South Carolina', 'South Dakota', 'West Virginia']);
const PLACE_SET = new Set(US_STATES.map(s => s.toLowerCase()));
try { const dn = new Intl.DisplayNames(['en'], { type: 'region' }); for (const a of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') for (const b of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') { try { const n = dn.of(a + b); if (n && n !== a + b) PLACE_SET.add(n.toLowerCase()); } catch (_) {} } } catch (_) {}
['europe', 'asia', 'africa', 'america', 'north america', 'south america', 'antarctica', 'australia', 'london', 'paris', 'tokyo', 'beijing', 'boston', 'chicago', 'los angeles', 'san francisco', 'berlin', 'moscow', 'rome', 'madrid', 'toronto', 'sydney', 'washington, d.c.', 'silicon valley', 'middle east'].forEach(p => PLACE_SET.add(p));
const ORG_RE = /\b(?:Inc|Corp|Corporation|Company|Co|LLC|Ltd|University|College|Institute|Institution|School|Academy|Agency|Administration|Association|Department|Ministry|Bank|Foundation|Society|Council|Committee|Commission|Hospital|Laboratory|Laboratories|Lab|Labs|Group|Party|Organization|Organisation|Center|Centre|Museum|Board|Bureau|Service|Office|Court|Senate|Congress|Parliament|Army|Navy|Force|Federation|Union|League|Club|Network|Press|Times|Journal|Motors|Systems|Technologies|Industries|Partners)\b/;
const TITLES = /\b(?:Mr|Mrs|Ms|Dr|Prof|Professor|President|Senator|Governor|Mayor|Judge|Justice|Chancellor|Minister|Secretary|Rep|Representative|Gen|General|Captain|Sir|Dame|Lord|Lady|King|Queen|Prince|Princess|Pope|Saint|St|CEO|founder)\.?\s+$/;
export function entities(text) {
  const counts = new Map();
  const re = /\b([A-Z][a-zA-Z'’.-]+(?:\s+(?:of|the|de|da|van|von|and|for|&)?\s*[A-Z][a-zA-Z'’.-]+){0,4})/g;
  let m;
  while ((m = re.exec(text))) {
    let name = m[1].replace(/[’']s$/, '').replace(/\s+(?:of|the|and|for|&)$/, '').trim();
    name = name.replace(/^(?:Abstract|Introduction|Background|Methods?|Results?|Discussion|Conclusions?|References|Acknowledg\w+|Appendix|Summary|Overview)\s+(?=[A-Z])/, '');
    name = name.replace(/^(?:The|A|An|In|On|At|For|But|And|Or|If|When|While|However|This|That|These|Those|Our|Their|His|Her|Its|As|By|From|To|With|Unlike|Like|Since|After|Before|During)\s+(?=[A-Z])/, '');
    if (name.length < 3) continue;
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    const sentenceStart = /(?:^|[.!?]\s+|\n\s*)$/.test(before);
    const single = !name.includes(' ');
    if (sentenceStart && single && STOP.has(name.toLowerCase())) continue;
    if (single && /^(?:The|A|An|This|That|These|Those|In|On|At|For|But|And|Or|If|When|While|However|Although|Because|After|Before|During|It|We|They|He|She|I|You|Our|Their|His|Her|Its|There|Here|What|Which|Who|How|Why|Figure|Table|Section|Chapter|January|February|March|April|May|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/.test(name)) continue;
    const c = counts.get(name) || { n: 0, sentStart: 0, title: false, inPlace: false };
    c.n++; if (sentenceStart) c.sentStart++;
    if (TITLES.test(before)) c.title = true;
    if (/\b(?:in|at|from|near|to|across|throughout)\s+(?:the\s+)?$/i.test(before)) c.inPlace = true;
    counts.set(name, c);
  }
  const people = [], places = [], orgs = [], other = [];
  for (const [name, c] of counts) {
    if (c.n === c.sentStart && c.n < 2 && !name.includes(' ')) continue;
    const low = name.toLowerCase();
    if (PLACE_SET.has(low)) places.push([name, c.n]);
    else if (ORG_RE.test(name) || /^[A-Z]{2,6}$/.test(name)) orgs.push([name, c.n]);
    else if (c.title || (/^[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z'’-]+$/.test(name) && !c.inPlace)) people.push([name, c.n]);
    else if (c.inPlace && !name.includes(' of ')) places.push([name, c.n]);
    else other.push([name, c.n]);
  }
  const top = (a, k = 15) => a.sort((x, y) => y[1] - x[1]).slice(0, k).map(([n, c]) => (c > 1 ? `${n} (${c})` : n));
  const money = [...new Set(text.match(/(?:[$€£]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|billion|trillion|thousand|[kmb]n?))?|\b\d[\d,]*(?:\.\d+)?\s?(?:dollars|euros|pounds|USD|EUR|GBP))/gi) || [])].slice(0, 15);
  const years = [...new Set(text.match(/\b(?:1[5-9]\d\d|20\d\d)\b/g) || [])].sort().slice(0, 25);
  return { people: top(people), places: top(places), orgs: top(orgs), other: top(other, 12), money, years };
}

// ---------- glossary of hard words (Datamuse word frequencies + WordNet definitions) ----------
async function glossary(text, k = 8) {
  const cand = new Map();
  for (const w of (text.match(/\b[a-z]{7,}\b/g) || [])) if (!STOP.has(w) && syllables(w) >= 3) cand.set(w, (cand.get(w) || 0) + 1);
  const pick = [...cand.keys()].sort((a, b) => b.length - a.length).slice(0, 28);
  const res = await Promise.all(pick.map(w => fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(w)}&md=fd&max=1`).then(r => r.json()).then(d => d[0]).catch(() => null)));
  return res.filter(r => r && r.defs && r.tags).map(r => ({ word: r.word, freq: parseFloat((r.tags.find(t => t.startsWith('f:')) || 'f:999').slice(2)), def: r.defs[0].split('\t') }))
    .filter(r => r.freq < 6).sort((a, b) => a.freq - b.freq).slice(0, k)
    .map(r => [r.word, `(${{ n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' }[r.def[0]] || r.def[0]}) ${r.def[1]}`]);
}

function keyTerms(text, n = 18) {
  const ws = tokens(text).filter(w => !/^\d+$/.test(w) && w.length > 2);
  const uni = new Map(), bi = new Map();
  ws.forEach((w, i) => { uni.set(w, (uni.get(w) || 0) + 1); if (i) { const k = ws[i - 1] + ' ' + w; bi.set(k, (bi.get(k) || 0) + 1); } });
  const phrases = [...bi].filter(([, c]) => c >= 3).map(([k, c]) => [k, c * 2.2]);
  const singles = [...uni].map(([k, c]) => [k, c * Math.min(1, k.length / 6)]);
  const all = [...phrases, ...singles].sort((a, b) => b[1] - a[1]);
  const out = [];
  for (const [k] of all) { if (out.length >= n) break; if (out.some(o => o.includes(k) || k.includes(o))) continue; out.push(k); }
  return out;
}

function detect(text) {
  const uniq = (a) => [...new Set(a)];
  return {
    dois: uniq((text.match(/\b10\.\d{4,9}\/[^\s"<>,;)\]]+/g) || []).map(d => d.replace(/[.]+$/, ''))).slice(0, 40),
    urls: uniq((text.match(/https?:\/\/[^\s"<>)\]]+/g) || []).map(u => u.replace(/[.,;]+$/, ''))).slice(0, 40),
    emails: uniq(text.match(/[\w.+-]+@[\w-]+\.[\w.-]+\w/g) || []).slice(0, 20),
    dates: uniq(text.match(/\b(?:\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.? \d{1,2},? \d{4}|\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4})\b/g) || []).slice(0, 20),
    percents: uniq(text.match(/\b\d+(?:\.\d+)?\s?%/g) || []).slice(0, 20),
  };
}

function references(doc) {
  const t = doc.text;
  const m = /\n\s*(references|bibliography|works cited|literature cited)\s*\n/i.exec(t) || /\b(references|bibliography)\b(?![\s\S]*\b(references|bibliography)\b)/i.exec(t);
  if (!m) return [];
  const tail = t.slice(m.index + m[0].length, m.index + m[0].length + 60000);
  let refs = tail.split(/\n(?=\s*(?:\[\d+\]|\d+\.\s|[A-Z][a-zA-Z'-]+,\s+[A-Z]\.))/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 30 && s.length < 600);
  if (refs.length < 3) refs = tail.split(/(?=\[\d+\])/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 30 && s.length < 600);
  return refs.slice(0, 150);
}

// ---------- CSV ----------
function parseCSV(text) {
  const delim = (text.split('\n')[0].match(/\t/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? '\t' : (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); if (row.some(x => x !== '')) rows.push(row); }
  const head = rows.shift() || [];
  return { head: head.map((h, i) => h.trim() || `col${i + 1}`), rows };
}
const numOf = (v) => { const s = String(v).replace(/[$,%\s]/g, ''); return s !== '' && !isNaN(s) ? +s : null; };

// ---------- loading ----------
async function readFile(file) {
  const name = file.name;
  const ext = (name.split('.').pop() || '').toLowerCase();
  const doc = { id: crypto.randomUUID(), name, size: file.size, ext, pages: [], text: '', meta: {} };
  if (ext === 'pdf' || file.type === 'application/pdf') {
    const pdfjs = await loadPdfJs();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    doc.kind = 'pdf';
    doc.meta.pages = pdf.numPages;
    try { const md = await pdf.getMetadata(); doc.meta.title = md.info && md.info.Title; doc.meta.author = md.info && md.info.Author; } catch (_) {}
    try { const ol = await pdf.getOutline(); doc.outline = (ol || []).map(o => o.title).slice(0, 60); } catch (_) {}
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const tc = await page.getTextContent();
      let t = '';
      for (const it of tc.items) { t += it.str; t += it.hasEOL ? '\n' : ' '; }
      doc.pages.push({ n, text: t.replace(/[ \t]+/g, ' ').replace(/-\n(?=[a-z])/g, '') });
    }
    doc.text = doc.pages.map(p => p.text).join('\n');
    if (doc.text.replace(/\s/g, '').length < 50 * pdf.numPages * 0.2) doc.scanned = true;
  } else {
    const text = await file.text();
    doc.text = text;
    if (['csv', 'tsv'].includes(ext)) { doc.kind = 'table'; doc.table = parseCSV(text); }
    else if (ext === 'json') { doc.kind = 'json'; try { doc.json = JSON.parse(text); } catch (e) { doc.jsonError = e.message; } }
    else doc.kind = 'text';
    if (['html', 'htm', 'xml', 'svg'].includes(ext)) doc.text = new DOMParser().parseFromString(text, 'text/html').body.textContent || text;
    const lines = doc.text.split('\n');
    for (let i = 0; i < lines.length; i += 60) doc.pages.push({ n: Math.floor(i / 60) + 1, text: lines.slice(i, i + 60).join('\n') });
  }
  buildIndex(doc);
  return doc;
}

const MAX = 60 * 1024 * 1024;
export async function addFiles(fileList) {
  for (const file of fileList) {
    if (file.size > MAX) { const { ctx } = api.newCard(file.name); ctx.add({ title: 'Too large', text: 'Files up to 60 MB are supported.', error: true }); continue; }
    const { card, ctx } = api.newCard(`📄 ${file.name}`);
    card.classList.add('busy');
    ctx.label('File');
    const wait = ctx.add({ title: 'Reading', text: 'Reading the file in your browser. Nothing is uploaded.', loading: true });
    try {
      const doc = await readFile(file);
      docs.push(doc);
      renderChips();
      wait.remove();
      overview(ctx, doc);
    } catch (e) {
      wait.remove();
      ctx.add({ title: 'Couldn’t read this file', text: e.message || String(e), error: true });
    } finally { card.classList.remove('busy'); }
  }
}

function overview(ctx, doc) {
  const w = words(doc.text).length;
  const ss = sentences(doc.text);
  const syl = words(doc.text).slice(0, 20000).reduce((a, x) => a + syllables(x), 0) / Math.max(Math.min(w, 20000), 1);
  const flesch = 206.835 - 1.015 * (w / Math.max(ss.length, 1)) - 84.6 * syl;
  ctx.input(`${doc.name} is now part of your context. Ask about it, or try “summarize”, “find …”, “outline”, “references”.`);
  const rows = [['Type', doc.kind === 'pdf' ? 'PDF' : doc.kind === 'web' ? 'Web page' : doc.name.startsWith('Pasted') ? 'Pasted text' : doc.ext.toUpperCase() || 'Text'], ...(doc.meta.title ? [['Title', doc.meta.title]] : []), ...(doc.meta.author ? [['Author', doc.meta.author]] : []), ...(doc.meta.date ? [['Published', String(doc.meta.date).slice(0, 10)]] : []), ...(doc.meta.pages ? [['Pages', String(doc.meta.pages)]] : []),
    ['Words', w.toLocaleString()], ['Characters', doc.text.length.toLocaleString()], ['Reading time', `${Math.max(1, Math.round(w / 238))} min`]];
  if (doc.kind !== 'table' && w > 100) rows.push(['Readability (Flesch)', `${Math.round(flesch)} — ${flesch >= 70 ? 'easy' : flesch >= 50 ? 'fairly difficult' : flesch >= 30 ? 'difficult (college level)' : 'very difficult (graduate level)'}`]);
  ctx.add({ title: 'Overview', table: rows, note: doc.scanned ? 'This PDF has little selectable text, so it’s probably a scan. Only the text layer can be read.' : undefined });

  if (doc.kind === 'table') return tableOverview(ctx, doc);
  if (doc.kind === 'json') {
    if (doc.jsonError) ctx.add({ title: 'Invalid JSON', text: doc.jsonError, error: true });
    else { ctx.add({ title: 'Structure', table: jsonShape(doc.json) }); ctx.add({ title: 'Formatted', pre: JSON.stringify(doc.json, null, 2).slice(0, 20000) }); }
    return;
  }
  const sum = summarize(doc.text, w > 3000 ? 7 : w > 400 ? 5 : 3);
  if (sum.length) ctx.add({ title: 'Key sentences', numbered: sum, note: 'The most central sentences, ranked with TextRank. Quoted from the text, not rewritten.' });
  const ents = entities(doc.text);
  const erows = [['People', ents.people.join(', ')], ['Places', ents.places.join(', ')], ['Organizations', ents.orgs.join(', ')], ['Other names', ents.other.join(', ')], ['Money', ents.money.join(', ')], ['Years', ents.years.join(', ')]].filter(r => r[1]);
  if (erows.length) ctx.add({ title: 'Names and facts mentioned', table: erows, note: 'Found from capitalization and cue words, so expect a few mislabels.' });
  if (w > 40) { const slot = ctx.slot(); glossary(doc.text).then(g => { if (g.length) slot.add({ title: 'Harder words, explained', table: g, source: { name: 'WordNet via Datamuse', url: 'https://www.datamuse.com/api/' } }); }).catch(() => {}); }
  const terms = keyTerms(doc.text);
  if (terms.length) ctx.add({ title: 'Key terms', chips: terms.map(t => `find ${t}`) });
  if (doc.outline && doc.outline.length) ctx.add({ title: 'Outline', numbered: doc.outline });
  const d = detect(doc.text);
  if (d.dois.length) ctx.add({ title: `DOIs found (${d.dois.length})`, chips: d.dois.map(x => `cite ${x}`) });
  if (d.urls.length) ctx.add({ title: `Links found (${d.urls.length})`, list: d.urls.slice(0, 15).map(u => ({ title: u, url: u })) });
  const misc = [];
  if (d.emails.length) misc.push(['Emails', d.emails.join(', ')]);
  if (d.dates.length) misc.push(['Dates', d.dates.join(', ')]);
  if (d.percents.length) misc.push(['Percentages', d.percents.join(', ')]);
  if (misc.length) ctx.add({ title: 'Also found', table: misc });
  ctx.add({ title: 'Try', chips: ['summarize', 'references', 'outline', `find ${terms[0] || 'results'}`, 'page 1'] });
}

function jsonShape(j, path = '$', out = [], depth = 0) {
  if (out.length > 40 || depth > 4) return out;
  if (Array.isArray(j)) { out.push([path, `array of ${j.length}`]); if (j.length) jsonShape(j[0], path + '[0]', out, depth + 1); }
  else if (j && typeof j === 'object') { out.push([path, `object with ${Object.keys(j).length} keys`]); for (const k of Object.keys(j).slice(0, 15)) jsonShape(j[k], `${path}.${k}`, out, depth + 1); }
  else out.push([path, `${typeof j}: ${String(j).slice(0, 60)}`]);
  return out;
}

function tableOverview(ctx, doc) {
  const { head, rows } = doc.table;
  ctx.add({ title: `Preview (${rows.length.toLocaleString()} rows × ${head.length} columns)`, table: { head, rows: rows.slice(0, 15) } });
  const colStats = head.map((hd, j) => {
    const vals = rows.map(r => r[j]).filter(v => v != null && v !== '');
    const nums = vals.map(numOf).filter(v => v != null);
    if (nums.length >= vals.length * 0.8 && nums.length) {
      const s = [...nums].sort((a, b) => a - b), mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      return { hd, numeric: true, nums, row: [hd, 'number', `${nums.length}`, `${fmt(s[0])} – ${fmt(s[s.length - 1])}`, `mean ${fmt(mean)} · median ${fmt(s[Math.floor(s.length / 2)])}`] };
    }
    const counts = new Map(); vals.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, c]) => `${k} (${c})`).join(', ');
    return { hd, numeric: false, row: [hd, 'text', `${vals.length}`, `${counts.size} unique`, `most common: ${top}`] };
  });
  ctx.add({ title: 'Columns', table: { head: ['Column', 'Type', 'Values', 'Range / unique', 'Summary'], rows: colStats.map(c => c.row) } });
  const numCols = colStats.filter(c => c.numeric);
  if (numCols.length) {
    const x0 = colStats[0].numeric ? null : colStats[0];
    const xs = x0 ? rows.map(r => r[0]) : rows.map((_, i) => i + 1);
    ctx.add({ title: 'Chart', plot: { kind: 'line', bars: !!x0 && rows.length <= 60, xtitle: x0 ? x0.hd : 'row', traces: numCols.slice(0, 4).map(c => ({ name: c.hd, x: xs, y: rows.map(r => numOf(r[head.indexOf(c.hd)])) })) } });
    ctx.add({ title: 'Try', chips: numCols.slice(0, 4).map(c => `stats of column ${c.hd}`) });
  }
}
const fmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 4 });

// ---------- context chips ----------
function renderChips() {
  const box = document.getElementById('ctx');
  box.replaceChildren();
  box.hidden = !docs.length;
  if (!docs.length) return;
  box.append(api.h('span', 'vars-label', 'Your files:'));
  for (const d of docs) {
    const chip = api.h('span', 'ctx-chip');
    chip.append(api.h('span', null, `📄 ${d.name}`));
    const x = api.h('button', 'ctx-x', '×'); x.type = 'button'; x.title = `Remove ${d.name}`;
    x.onclick = () => { docs.splice(docs.indexOf(d), 1); renderChips(); };
    chip.append(x);
    box.append(chip);
  }
}

// ---------- queries over files ----------
function highlight(text, q) {
  const terms = [...new Set(tokens(q))].filter(t => t.length > 2).map(t => stem(t)).filter(Boolean);
  const frag = document.createDocumentFragment();
  if (!terms.length) { frag.append(text); return frag; }
  const re = new RegExp(`\\b(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\w*`, 'gi');
  let last = 0;
  for (const m of text.matchAll(re)) { frag.append(text.slice(last, m.index)); const mk = document.createElement('mark'); mk.textContent = m[0]; frag.append(mk); last = m.index + m[0].length; }
  frag.append(text.slice(last));
  return frag;
}

function passagesPod(hits, q, title) {
  return {
    title,
    custom: (el) => {
      const ul = api.h('ul', 'results');
      for (const { c, doc } of hits) {
        const li = api.h('li');
        const box = api.h('div', 'res');
        box.append(api.h('div', 'res-meta', `${doc.name}${doc.kind === 'pdf' ? ` · page ${c.page}` : ''}`));
        const p = api.h('div', 'res-snip passage');
        p.append(highlight(c.text.length > 700 ? c.text.slice(0, 700) + '…' : c.text, q));
        box.append(p);
        li.append(box); ul.append(li);
      }
      el.append(ul);
    },
  };
}

function searchAll(q, k = 4) {
  const all = [];
  for (const doc of docs) for (const r of bm25(doc, q).slice(0, k)) all.push({ ...r, doc });
  return all.sort((a, b) => b.s - a.s).slice(0, k);
}

export const hasDocs = () => docs.length > 0;

// Explicit file commands. Returns true if handled.
export async function fileCommand(ctx, q) {
  if (!docs.length) return false;
  let m;
  if ((m = /^(?:summari[sz]e|summary|tl;?dr|key points|main points|main ideas?)(?:\s+(?:of\s+)?(?:the\s+|my\s+|this\s+)?(?:file|document|doc|pdf|paper|text|page|article)s?)?(?:\s+in\s+(\d+)\s+(?:sentences|points|bullets|lines))?$/i.exec(q))) {
    ctx.label('Your files');
    for (const doc of docs) {
      ctx.input('Key sentences from your files');
      const s = summarize(doc.text, m[1] ? +m[1] : words(doc.text).length > 3000 ? 8 : 5);
      ctx.add({ title: doc.name, numbered: s.length ? s : ['Not enough running text to pick key sentences from.'] });
      const t = keyTerms(doc.text, 12);
      if (t.length) ctx.add({ title: 'Key terms', chips: t.map(x => `find ${x}`) });
    }
    return true;
  }
  if ((m = /^(?:find|search|where does it (?:say|mention)|look for|locate|grep)\s+(?:for\s+)?(.+?)(?:\s+in\s+(?:the\s+|my\s+)?(?:file|document|doc|pdf|paper)s?)?$/i.exec(q))) {
    ctx.label('Your files');
    ctx.input(`Searching your files for: ${m[1]}`);
    const hits = searchAll(m[1], 6);
    const exact = [];
    const needle = m[1].toLowerCase().replace(/^["']|["']$/g, '');
    for (const doc of docs) { let n = 0, i = -1; const low = doc.text.toLowerCase(); while ((i = low.indexOf(needle, i + 1)) >= 0) n++; exact.push([doc.name, `${n} exact match${n === 1 ? '' : 'es'}`]); }
    ctx.add({ title: 'Matches', table: exact });
    if (hits.length) ctx.add(passagesPod(hits, m[1], 'Best passages'));
    else ctx.add({ title: 'Nothing found', text: 'No passage mentions those words.' });
    return true;
  }
  if (/^(?:references|bibliography|citations|works cited|sources)(?:\s+(?:in|of)\s+.+)?$/i.test(q)) {
    ctx.label('Your files');
    ctx.input('References in your files');
    for (const doc of docs) {
      const refs = references(doc);
      ctx.add(refs.length ? { title: `${doc.name}: ${refs.length} references`, numbered: refs } : { title: doc.name, text: 'No references section found.' });
      const d = detect(doc.text).dois;
      if (d.length) ctx.add({ title: 'Look up a DOI', chips: d.slice(0, 25).map(x => `cite ${x}`) });
    }
    return true;
  }
  if (/^(?:outline|contents|table of contents|headings|sections)$/i.test(q)) {
    ctx.label('Your files'); ctx.input('Outline of your files');
    for (const doc of docs) {
      let ol = doc.outline && doc.outline.length ? doc.outline : doc.text.split('\n').map(l => l.trim()).filter(l => /^(?:\d+(?:\.\d+)*\.?\s+[A-Z]|#{1,4}\s|[A-Z][A-Z \-:]{4,60}$)/.test(l) && l.length < 90).slice(0, 60);
      ctx.add(ol.length ? { title: doc.name, numbered: ol } : { title: doc.name, text: 'No headings found.' });
    }
    return true;
  }
  if ((m = /^(?:page|p\.?)\s*(\d+)$/i.exec(q))) {
    ctx.label('Your files');
    const n = +m[1];
    for (const doc of docs) { const p = doc.pages.find(x => x.n === n); if (p) ctx.add({ title: `${doc.name} · ${doc.kind === 'pdf' ? 'page' : 'section'} ${n}`, pre: p.text.slice(0, 15000) }); }
    ctx.input(`Page ${n}`);
    return true;
  }
  if ((m = /^(?:count|how many times (?:does|is)?)\s+["']?(.+?)["']?(?:\s+(?:appear|appears|mentioned|occur|occurs))?(?:\s+in\s+.+)?$/i.exec(q))) {
    ctx.label('Your files'); ctx.input(`Count “${m[1]}”`);
    const needle = m[1].toLowerCase();
    ctx.add({ title: 'Occurrences', table: docs.map(doc => { let n = 0, i = -1; const low = doc.text.toLowerCase(); while ((i = low.indexOf(needle, i + 1)) >= 0) n++; return [doc.name, String(n)]; }) });
    return true;
  }
  if (/^(?:names|people|places|entities|who is mentioned|organizations)$/i.test(q)) {
    ctx.label('Your files'); ctx.input('Names mentioned in your files');
    for (const doc of docs) { const e = entities(doc.text); ctx.add({ title: doc.name, table: [['People', e.people.join(', ')], ['Places', e.places.join(', ')], ['Organizations', e.orgs.join(', ')], ['Other names', e.other.join(', ')], ['Money', e.money.join(', ')], ['Years', e.years.join(', ')]].filter(r => r[1]) }); }
    return true;
  }
  if (/^(?:glossary|hard words|difficult words|vocabulary|define (?:the )?hard words)$/i.test(q)) {
    ctx.label('Your files'); ctx.input('Harder words in your files, explained');
    for (const doc of docs) { const g = await glossary(doc.text, 15); ctx.add(g.length ? { title: doc.name, table: g } : { title: doc.name, text: 'No unusual words found.' }); }
    return true;
  }
  if (/^(?:word count|readability|stats|statistics|overview|info)$/i.test(q)) {
    for (const doc of docs) overview(ctx, doc);
    ctx.label('Your files');
    return true;
  }
  if ((m = /^(?:stats|statistics|summary|describe|chart|plot|graph)\s+(?:of\s+)?(?:column\s+)?(.+)$/i.exec(q))) {
    const t = docs.find(d => d.kind === 'table' && d.table.head.some(hd => hd.toLowerCase() === m[1].toLowerCase().trim()));
    if (!t) return false;
    const j = t.table.head.findIndex(hd => hd.toLowerCase() === m[1].toLowerCase().trim());
    const nums = t.table.rows.map(r => numOf(r[j])).filter(v => v != null);
    ctx.label('Your files');
    ctx.input(`Column “${t.table.head[j]}” of ${t.name}`);
    if (nums.length) { api.stats(ctx, nums); return true; }
    const counts = new Map(); t.table.rows.forEach(r => counts.set(r[j], (counts.get(r[j]) || 0) + 1));
    const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 25);
    ctx.add({ title: 'Most common values', table: { head: ['Value', 'Count'], rows: top.map(([k, c]) => [k, String(c)]) } });
    ctx.add({ title: 'Chart', plot: { kind: 'bar', x: top.map(x => x[0]), y: top.map(x => x[1]) } });
    return true;
  }
  return false;
}

// Answer-type extraction: find the sentence that best matches the question, then pull out
// the kind of thing asked for (a date for "when", a number for "how many", a name for "who").
const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?';
function answerIn(sentence, q) {
  const qs = q.toLowerCase();
  const qWords = new Set(tokens(q).map(stem));
  let m;
  if (/^(?:when|what year|what date|in what year)/.test(qs)) m = sentence.match(new RegExp(`\\b(?:${MONTH}\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\s+${MONTH}\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2}|${MONTH}\\s+\\d{4}|(?:1[5-9]|20)\\d\\d(?:s)?)\\b`));
  else if (/^(?:how (?:many|much|long|far|big|old|fast|tall)|what (?:percent|percentage|number|rate|amount|proportion))/.test(qs) || (/^(?:what|which)\b/.test(qs) && /\b(?:rate|percent|percentage|share|number|amount|cost|price|total|average|mean|median|ratio|proportion|count|speed|temperature|score)\b/.test(qs))) { const all = sentence.match(/(?:[$€£]\s?)?\d[\d,]*(?:\.\d+)?\s?(?:%|percent|million|billion|thousand|years?|months?|days?|hours?|minutes?|seconds?|[a-z]{1,12})?/gi) || [];
    const ok = all.filter(x => !/^(?:1[5-9]|20)\d\d$/.test(x.trim()) || /how many|number/.test(qs));
    const pool = ok.length ? ok : all;
    m = pool.length ? [/\b(?:now|today|current|currently|latest|these days|nowadays)\b/.test(qs) ? pool[pool.length - 1] : pool[0]] : null; }
  else if (/^(?:who|whom|whose)/.test(qs)) { const cands = sentence.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z'’-]+)+/g) || []; m = cands.filter(c => !tokens(c).map(stem).every(t => qWords.has(t))); m = m.length ? [m[0]] : null; }
  else if (/^where/.test(qs)) { const c = sentence.match(/\b(?:in|at|from|near)\s+((?:the\s+)?[A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+)*)/); m = c ? [c[1]] : null; }
  return m ? m[0].trim() : null;
}

function bestAnswer(q) {
  const hits = searchAll(q, 5);
  let best = null;
  const qt = new Set(tokens(q).map(stem));
  for (const h of hits) {
    for (const s of sentences(h.c.text)) {
      const st = tokens(s).map(stem);
      let overlap = 0; new Set(st).forEach(t => qt.has(t) && overlap++);
      const ans = answerIn(s, q);
      const hitFrac = overlap / Math.max(qt.size, 1);
      const score = hitFrac + (ans ? 0.6 : 0) + h.s * 0.05;
      if (!best || score > best.score) best = { score, s, ans, doc: h.doc, page: h.c.page, hitFrac, hits: overlap };
    }
  }
  return best && best.score > 0.45 && best.hitFrac >= 0.5 && best.hits >= Math.min(2, qt.size) ? best : null;
}

// True when the user's own files clearly answer the question (most of its words in one sentence).
export function strongAnswer(q) {
  if (!docs.length || !/^(?:who|what|when|where|which|how|why)\b/i.test(q)) return false;
  const b = bestAnswer(q);
  return !!(b && b.ans && b.hitFrac >= 0.75);
}

// After any other answer: show the best-matching passages from the user's files.
export function fileContext(ctx, q) {
  if (!docs.length || q.length < 3) return false;
  let shown = false;
  if (/^(?:who|what|when|where|which|why|how|is|are|does|did|do|was|were|can)\b/i.test(q)) {
    const b = bestAnswer(q);
    if (b) {
      ctx.add({ title: 'Answer from your files', custom: (el) => {
        if (b.ans) el.append(api.h('p', 'big-text', b.ans));
        const p = api.h('p', 'res-snip passage'); p.append(highlight(b.s, q + ' ' + (b.ans || ''))); el.append(p);
        el.append(api.h('p', 'note', `${b.doc.name}${b.doc.kind === 'pdf' ? ` · page ${b.page}` : ''}. Found by matching your question’s words, so check it in context.`));
      } });
      shown = true;
    }
  }
  const hits = searchAll(q, 3).filter(h => h.s > 1.2);
  if (hits.length) ctx.add(passagesPod(hits, q, shown ? 'Related passages' : 'From your files'));
  return shown || hits.length > 0;
}

// ---------- pasted text & web pages become documents too ----------
let pasteN = 0;
function makeDoc(name, text, kind = 'text', extra = {}) {
  const doc = { id: crypto.randomUUID(), name, size: text.length, ext: kind === 'web' ? 'html' : 'txt', pages: [], text, meta: {}, kind, ...extra };
  const paras = text.split(/\n{2,}/);
  let buf = '', n = 1;
  for (const p of paras) { buf += p + '\n\n'; if (buf.length > 3500) { doc.pages.push({ n: n++, text: buf }); buf = ''; } }
  if (buf.trim()) doc.pages.push({ n, text: buf });
  buildIndex(doc);
  return doc;
}

export function analyzeText(ctx, text, { keep = true, focus } = {}) {
  const doc = makeDoc(`Pasted text ${++pasteN}`, text);
  if (keep) { docs.push(doc); renderChips(); }
  ctx.label('Text');
  if (focus === 'summary') {
    ctx.input('Summary of your text');
    const m = /in (\d+) (?:sentences|points|bullets)/i.exec(focus);
    ctx.add({ title: 'Key sentences', numbered: summarize(text, 4), note: 'Ranked with TextRank and quoted from your text.' });
    ctx.add({ title: 'Key terms', chips: keyTerms(text, 12).map(t => `find ${t}`) });
    return;
  }
  overview(ctx, doc);
  ctx.input(keep ? 'Your text is now part of your context: ask questions about it, or try “find …”.' : 'Text analysis');
}

const PROXY_READ = '/tools/api/proxy?read=';
export async function addUrl(ctx, url) {
  ctx.label('Web page');
  let u = url.trim();
  const ax = /arxiv\.org\/(?:abs|pdf)\/([\w.\/-]+?)(?:v\d+)?(?:\.pdf)?$/i.exec(u);
  if (ax) u = `https://arxiv.org/pdf/${ax[1]}`;
  const wait = ctx.add({ title: 'Reading', text: `Fetching ${u}…`, loading: true });
  let r;
  try { r = await fetch(PROXY_READ + encodeURIComponent(u)); } finally { wait.remove(); }
  if (r.status === 403) throw new Error('That site isn’t on the reading list. I can read .gov, .edu, Wikipedia, arXiv, PubMed Central, PLOS, MDPI, Frontiers, Project Gutenberg, GitHub and similar open sources. For other pages, save the page as a PDF and drop it in.');
  if (!r.ok) throw new Error(`The page returned an error (${r.status}).`);
  const type = r.headers.get('Content-Type') || '';
  let doc;
  if (/pdf/i.test(type) || /\.pdf($|\?)/i.test(u)) {
    const blob = await r.blob();
    doc = await readFile(new File([blob], decodeURIComponent(u.split('/').pop() || 'document') + (/\.pdf$/i.test(u) ? '' : '.pdf'), { type: 'application/pdf' }));
    doc.url = u;
  } else {
    const html = await r.text();
    const d = new DOMParser().parseFromString(html, 'text/html');
    const meta = (n) => (d.querySelector(`meta[property="${n}"], meta[name="${n}"]`) || {}).content;
    const title = meta('og:title') || (d.querySelector('title') || {}).textContent || u;
    d.querySelectorAll('script,style,noscript,nav,header,footer,aside,form,iframe,svg,button,.navbox,.reflist,.mw-editsection,.infobox,#toc,.toc,[role=navigation],[aria-hidden=true]').forEach(e => e.remove());
    const tables = [...d.querySelectorAll('table')].filter(t => t.querySelectorAll('tr').length >= 3).slice(0, 4).map(t => [...t.querySelectorAll('tr')].slice(0, 25).map(tr => [...tr.children].map(c => c.textContent.replace(/\s+/g, ' ').trim()).slice(0, 8)));
    let root = d.querySelector('article, main, [role=main], #mw-content-text, .mw-parser-output');
    if (!root) { let best = d.body, bestN = 0; d.querySelectorAll('div, section').forEach(el => { const n = [...el.children].filter(c => c.tagName === 'P').reduce((a, p) => a + p.textContent.length, 0); if (n > bestN) { bestN = n; best = el; } }); root = best; }
    const blocks = [...root.querySelectorAll('h1,h2,h3,h4,p,li,blockquote,pre,dd')].map(el => (/^H\d/.test(el.tagName) ? '\n' + el.textContent.trim() + '\n' : el.textContent.replace(/\s+/g, ' ').trim())).filter(t => t.length > 1);
    const text = blocks.join('\n\n').replace(/\[\d+\]/g, '');
    const outline = [...root.querySelectorAll('h2,h3')].map(h => h.textContent.replace(/\[edit\]/g, '').trim()).filter(Boolean).slice(0, 40);
    doc = makeDoc(title.trim(), text, 'web', { url: u, outline, meta: { title: title.trim(), author: meta('author') || meta('article:author') || meta('citation_author'), date: meta('article:published_time') || meta('citation_publication_date') || meta('date') }, tables });
  }
  docs.push(doc); renderChips();
  overview(ctx, doc);
  (doc.tables || []).forEach((t, i) => t.length && ctx.add({ title: `Table ${i + 1}`, table: { head: t[0], rows: t.slice(1) } }));
  ctx.add({ title: 'Source', buttons: [{ label: 'Open the original', url: doc.url }] });
}

export function initFiles(deps) {
  api = deps;
  const input = document.getElementById('file');
  document.getElementById('attach').onclick = () => input.click();
  input.onchange = () => { addFiles([...input.files]); input.value = ''; };
  const drop = document.getElementById('drop');
  let depth = 0;
  window.addEventListener('dragenter', (e) => { if ([...(e.dataTransfer && e.dataTransfer.types || [])].includes('Files')) { depth++; drop.hidden = false; } });
  window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) drop.hidden = true; });
  window.addEventListener('dragover', (e) => { if (!drop.hidden) e.preventDefault(); });
  window.addEventListener('drop', (e) => { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); depth = 0; drop.hidden = true; addFiles([...e.dataTransfer.files]); });
  window.addEventListener('paste', (e) => { const f = [...(e.clipboardData && e.clipboardData.files || [])]; if (f.length) { e.preventDefault(); addFiles(f); } });
}
