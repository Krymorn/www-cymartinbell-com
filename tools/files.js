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

function loadScript(src, global) {
  return new Promise((res, rej) => {
    if (window[global]) return res(window[global]);
    const s = document.createElement('script'); s.src = src;
    s.onload = () => res(window[global]); s.onerror = () => rej(new Error(`Couldn’t load ${src.split('/').pop()}.`));
    document.head.append(s);
  });
}
const loadZip = () => loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'JSZip');
const loadOcr = () => loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js', 'Tesseract');

// OCR (reading text in images) with Tesseract: a classic OCR engine (an LSTM line recognizer),
// not a transformer or language model. Runs in the browser; the image never leaves the device.
let ocrWorker = null;
async function ocr(images, progress) {
  const T = await loadOcr();
  if (!ocrWorker) ocrWorker = await T.createWorker('eng');
  const out = [];
  for (let i = 0; i < images.length; i++) {
    progress && progress(`Reading text from ${images.length > 1 ? `page ${i + 1} of ${images.length}` : 'the image'}…`);
    const { data } = await ocrWorker.recognize(images[i]);
    out.push({ text: data.text || '', conf: data.confidence });
  }
  return out;
}

// Word, PowerPoint, Excel and OpenDocument files are zip archives of XML.
async function readOffice(file, ext) {
  const JSZip = await loadZip();
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = async (path) => { const f = zip.file(path); return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null; };
  const textOf = (el, pTag, tTag) => [...el.getElementsByTagName(pTag)].map(p => [...p.getElementsByTagName(tTag)].map(t => t.textContent).join('')).filter(x => x.trim()).join('\n');
  if (ext === 'docx') {
    const d = await xml('word/document.xml');
    if (!d) throw new Error('This doesn’t look like a Word document.');
    const paras = [...d.getElementsByTagName('w:p')].map(p => { const st = p.getElementsByTagName('w:pStyle')[0]; const t = [...p.getElementsByTagName('w:t')].map(t => t.textContent).join(''); return { t, head: st && /heading|title/i.test(st.getAttribute('w:val') || '') }; }).filter(x => x.t.trim());
    return { pages: [{ n: 1, text: paras.map(x => x.t).join('\n\n') }], outline: paras.filter(x => x.head).map(x => x.t).slice(0, 60) };
  }
  if (ext === 'pptx') {
    const slides = Object.keys(zip.files).filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
    const pages = [];
    for (const f of slides) { const d = await xml(f); pages.push({ n: pages.length + 1, text: textOf(d, 'a:p', 'a:t') }); }
    return { pages, outline: pages.map(p => p.text.split('\n')[0]).filter(Boolean) };
  }
  if (ext === 'xlsx') {
    const ss = await xml('xl/sharedStrings.xml');
    const shared = ss ? [...ss.getElementsByTagName('si')].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join('')) : [];
    const sh = await xml('xl/worksheets/sheet1.xml');
    if (!sh) throw new Error('No worksheet found.');
    const rows = [...sh.getElementsByTagName('row')].map(r => {
      const out = [];
      for (const c of r.getElementsByTagName('c')) {
        const ref = c.getAttribute('r') || ''; const col = ref.replace(/\d+/g, '').split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
        const v = (c.getElementsByTagName('v')[0] || {}).textContent ?? (c.getElementsByTagName('t')[0] || {}).textContent ?? '';
        out[col] = c.getAttribute('t') === 's' ? shared[+v] : v;
      }
      return Array.from(out, x => x ?? '');
    }).filter(r => r.some(x => x !== ''));
    return { table: { head: (rows.shift() || []).map((h, i) => String(h).trim() || `col${i + 1}`), rows } };
  }
  if (['odt', 'odp', 'ods'].includes(ext)) {
    const d = await xml('content.xml');
    return { pages: [{ n: 1, text: [...d.getElementsByTagName('text:p'), ...d.getElementsByTagName('text:h')].map(p => p.textContent).filter(Boolean).join('\n\n') }] };
  }
  throw new Error('Unsupported file type.');
}

// ---------- text helpers ----------
const stem = (w) => (w.length <= 4 ? w.replace(/s$/, '') : w.replace(/(?:ies)$/, 'y').replace(/(?:ing|edly|ed|ly|es|s)$/, '').replace(/(.)\1$/, '$1'));
const tokens = (t) => (t.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) || []).map(w => w.replace(/'s$/, '')).filter(w => w.length > 1 && !STOP.has(w));
const words = (t) => t.split(/\s+/).filter(Boolean);
const ABBR = /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Mt|Gen|Col|Lt|Sgt|Rep|Sen|Gov|Inc|Ltd|Co|Corp|vs|etc|approx|dept|est|fig|no|vol|e\.g|i\.e|U\.S|U\.K|a\.m|p\.m)\.(?=\s)/gi;
function sentences(t) {
  const marked = t.replace(/\r/g, '')
    .replace(/^(\s*(?:From|To|Cc|Bcc|Subject|Re|Date|Sent|Fwd):[^\n]*)$/gim, '$1 ¶')
    .replace(/\n\s*\n/g, ' ¶ ')
    .replace(/\n(?=\s*(?:\d{1,2}[.)]|[-*•])\s)/g, ' ¶ ')
    .replace(ABBR, '$1§');
  return marked.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])|\s*¶\s*/).map(s => s.replace(/§/g, '.').trim()).filter(s => s && s !== '¶');
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
  const re = /\b([A-Z][a-zA-Z'’.-]+(?:[ \t]+(?:of|the|de|da|van|von|and|for|&)?[ \t]*[A-Z][a-zA-Z'’.-]+){0,4})/g;
  let m;
  while ((m = re.exec(text))) {
    let name = m[1].split(/(?<=[a-z]{2})\.\s+/)[0].replace(/\.$/, '').replace(/[’']s$/, '').replace(/\s+(?:of|the|and|for|&)$/, '').trim();
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
async function readFile(file, progress) {
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
    if (doc.text.replace(/\s/g, '').length < 50 * pdf.numPages * 0.2) {
      // A scan: render the pages and read them with OCR (first 15 pages).
      doc.scanned = true;
      const imgs = [];
      for (let n = 1; n <= Math.min(pdf.numPages, 15); n++) {
        const page = await pdf.getPage(n);
        const vp = page.getViewport({ scale: 2 });
        const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
        await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        imgs.push(cv);
      }
      const res = await ocr(imgs, progress);
      doc.pages = res.map((r, i) => ({ n: i + 1, text: r.text }));
      doc.text = doc.pages.map(p => p.text).join('\n');
      doc.ocr = { conf: res.reduce((a, r) => a + r.conf, 0) / Math.max(res.length, 1), pages: res.length, of: pdf.numPages };
    }
  } else if (['docx', 'pptx', 'xlsx', 'odt', 'odp', 'ods'].includes(ext)) {
    const r = await readOffice(file, ext);
    if (r.table) { doc.kind = 'table'; doc.table = r.table; doc.text = [r.table.head, ...r.table.rows].map(x => x.join('\t')).join('\n'); doc.pages = [{ n: 1, text: doc.text }]; }
    else { doc.kind = ext === 'pptx' || ext === 'odp' ? 'slides' : 'text'; doc.pages = r.pages; doc.text = r.pages.map(p => p.text).join('\n\n'); doc.outline = r.outline; }
  } else if (/^image\//.test(file.type) || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'heic'].includes(ext)) {
    const res = await ocr([file], progress);
    doc.kind = 'image';
    doc.text = res[0].text;
    doc.pages = [{ n: 1, text: doc.text }];
    doc.ocr = { conf: res[0].conf, pages: 1, of: 1 };
  } else if (['doc', 'ppt', 'xls', 'pages', 'key', 'numbers'].includes(ext)) {
    throw new Error(`Old or Apple ${ext.toUpperCase()} files can’t be read in the browser. Save it as ${ext === 'xls' || ext === 'numbers' ? '.xlsx or .csv' : ext === 'ppt' || ext === 'key' ? '.pptx or PDF' : '.docx or PDF'} and drop that in instead.`);
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
      const doc = await readFile(file, (msg) => { const t = wait.querySelector && wait.querySelector('.text, p'); if (t) t.textContent = msg; });
      if (!doc.text.trim() && doc.kind !== 'table') throw new Error(doc.ocr ? 'No readable text was found, even with OCR. Try a sharper, straighter photo.' : 'This file has no text in it.');
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
  const rows = [['Type', doc.kind === 'pdf' ? (doc.ocr ? 'PDF (scanned)' : 'PDF') : doc.kind === 'web' ? 'Web page' : doc.kind === 'image' ? 'Image' : doc.name.startsWith('Pasted') ? 'Pasted text' : ({ docx: 'Word document', pptx: 'PowerPoint', xlsx: 'Excel', odt: 'OpenDocument text' }[doc.ext] || doc.ext.toUpperCase() || 'Text')], ...(doc.meta.title ? [['Title', doc.meta.title]] : []), ...(doc.meta.author ? [['Author', doc.meta.author]] : []), ...(doc.meta.date ? [['Published', String(doc.meta.date).slice(0, 10)]] : []), ...(doc.meta.pages ? [['Pages', String(doc.meta.pages)]] : []),
    ['Words', w.toLocaleString()], ['Characters', doc.text.length.toLocaleString()], ['Reading time', `${Math.max(1, Math.round(w / 238))} min`]];
  if (doc.kind !== 'table' && w > 100) rows.push(['Readability (Flesch)', `${Math.round(flesch)} — ${flesch >= 70 ? 'easy' : flesch >= 50 ? 'fairly difficult' : flesch >= 30 ? 'difficult (college level)' : 'very difficult (graduate level)'}`]);
  const lang = guessLang(doc.text);
  if (lang !== 'English') rows.push(['Language', lang + (lang === 'unknown' ? '' : ' (guessed from common words)')]);
  const note = doc.ocr ? `Read with OCR (text recognition)${doc.ocr.of > doc.ocr.pages ? `, first ${doc.ocr.pages} of ${doc.ocr.of} pages` : ''}. Confidence ${Math.round(doc.ocr.conf)}%, so expect some misread characters, especially in math symbols.` : undefined;
  ctx.add({ title: 'Overview', table: rows, note });
  doc.lang = lang;

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
  if (w > 40 && lang === 'English') { const slot = ctx.slot(); glossary(doc.text).then(g => { if (g.length) slot.add({ title: 'Harder words, explained', table: g, source: { name: 'WordNet via Datamuse', url: 'https://www.datamuse.com/api/' } }); }).catch(() => {}); }
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
  if (doc.ocr && /(?:^|\n)\s*\d{1,2}[.)]\s+\S/.test(doc.text)) ctx.add({ title: 'Looks like a worksheet', buttons: [{ label: 'Solve the problems in it', query: doc.text.trim().slice(0, 3000) }], note: 'Sends the recognized text as homework. Fix any misread symbols first if needed.' });
  ctx.add({ title: 'Try', chips: ['summarize', 'main idea', 'outline', `find ${terms[0] || 'results'}`, 'page 1'] });
}

const LANGS = { English: 'the and of to is in that it was for on are with as be by this have from', Spanish: 'el la de que y en los las del se por un una con para es su al lo como más', French: 'le la les de des et en un une du que est pour dans qui sur au avec ne pas', German: 'der die das und ist nicht ein eine zu den von mit sich des auf für im dem', Portuguese: 'o a os as de que e do da em um uma para com não é no na', Italian: 'il la di che e un una per non con del della sono le gli' };
function guessLang(text) {
  const ws = (text.toLowerCase().match(/[a-zà-ÿ]+/g) || []).slice(0, 3000);
  if (ws.length < 15) return 'English';
  let best = 'unknown', bs = 0;
  for (const [k, list] of Object.entries(LANGS)) { const set = new Set(list.split(' ')); const sc = ws.filter(w => set.has(w)).length / ws.length; if (sc > bs) { bs = sc; best = k; } }
  return bs > 0.08 ? best : 'unknown';
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

// ============================================================
// Question answering over your files (no AI)
// 1. Work out the question type (when / who / where / why / how many / which / what).
// 2. Score every sentence in the best-matching passages by shared words (with a small synonym
//    list), rare words counting more, plus cues for the question type (e.g. "because" for why).
// 3. Pull the asked-for piece out of the winning sentence with patterns for that type.
// ============================================================
const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?';
const DAY = '(?:Mon|Tues?|Wed(?:nes)?|Thu(?:rs)?|Fri|Sat(?:ur)?|Sun)(?:day)?';
const SYN = [
  ['start', 'found', 'launch', 'begin', 'began', 'establish', 'creat', 'open', 'set up', 'start'],
  ['cost', 'price', 'pay', 'spend', 'spent', 'rang', 'charg', 'fee', 'cost'],
  ['caus', 'becaus', 'due', 'reason', 'lead', 'result', 'driv', 'why'],
  ['lay', 'laid', 'layoff', 'cut', 'fire', 'job', 'eliminat'],
  ['insid', 'contain', 'held', 'hold'],
  ['find', 'found', 'discover', 'locat', 'dug', 'buri'],
  ['build', 'built', 'construct', 'made', 'creat', 'design'],
  ['leav', 'left', 'quit', 'depart', 'resign'],
  ['big', 'larg', 'size'], ['small', 'tiny', 'littl'], ['buy', 'bought', 'purchas'], ['sell', 'sold'],
  ['attend', 'came', 'present', 'show'], ['meet', 'meeting'], ['need', 'must', 'requir', 'should', 'have to'],
  ['money', 'fund', 'rais', 'invest', 'dollar'], ['employ', 'worker', 'staff', 'peopl'], ['compani', 'firm', 'busi', 'startup'],
  ['revenu', 'sale', 'incom', 'earn'], ['grow', 'growth', 'increas'], ['kill', 'die', 'death'], ['win', 'won', 'victor'],
];
const SYN_OF = new Map();
for (const g of SYN) for (const w of g) { const s = sstem(w); SYN_OF.set(s, new Set([...(SYN_OF.get(s) || []), ...g.map(sstem)])); }
function sstem(w) { return stem(w.toLowerCase()).replace(/e$/, ''); }
const qTokens = (q) => [...new Set(tokens(q).filter(t => !/^(?:did|does|do|was|were|is|are|happen|happened|kind|thing|way|much|many|long|far|need|needs|get|got|make|made|use|used)$/.test(t)).map(sstem))].filter(t => t && t.length > 1);
function hitTok(t, set) {
  if (set.has(t)) return true;
  const syn = SYN_OF.get(t);
  if (syn) for (const s of syn) if (set.has(s)) return true;
  for (const s of set) if (s.length > 4 && t.length > 4 && (s.startsWith(t) || t.startsWith(s))) return true;
  return false;
}
function qType(q) {
  const s = q.toLowerCase();
  if (/^(?:when|what (?:year|date|day|time)|in what year|by when|how soon)/.test(s)) return 'when';
  if (/^(?:who|whom|whose|which (?:person|people|company|companies|organi[sz]ation))/.test(s)) return 'who';
  if (/^(?:where|in what (?:city|country|state|place))/.test(s)) return 'where';
  if (/^(?:why|what (?:caused|causes|led to|made|is the reason|was the reason|were the reasons))|\bhow come\b/.test(s)) return 'why';
  if (/^(?:how (?:many|much|long|far|big|old|fast|tall|heavy|often|large|high)|what (?:percent|percentage|number|rate|amount|proportion|share|is the (?:total|price|cost|rate)))/.test(s)) return 'num';
  if (/^(?:what|which)\b/.test(s) && /\b(?:rate|percent|percentage|share|number|amount|cost|price|total|average|mean|median|ratio|proportion|count|speed|temperature|score|revenue|growth|profit|salary|population)\b/.test(s)) return 'num';
  if (/^which\b/.test(s)) return 'which';
  if (/^(?:is|are|was|were|does|do|did|can|could|has|have|will|should)\b/.test(s)) return 'yesno';
  return 'what';
}
const NEG = /\b(?:not|no|never|n't|without|absent|missed|failed to|none)\b|n’t/i;
const CUES = {
  why: /\b(?:because|since|due to|as a result|so that|in order to|reason|caused by|led to|necessary|after|following|owing to|thanks to)\b/i,
  when: new RegExp(`\\b(?:${MONTH}|${DAY}|(?:1[5-9]|20)\\d\\d|tomorrow|tonight|today|yesterday|next (?:week|month|year)|this (?:week|weekend)|noon|midnight|\\d{1,2}(?::\\d\\d)?\\s?(?:am|pm))\\b`, 'i'),
  num: /\d/,
  who: /\b[A-Z][a-z]+/,
};

function numberNear(sentence, qt) {
  const re = /(?:between\s+)?(?:[$€£]\s?)?-?\d[\d,]*(?:\.\d+)?(?:\s+\d+\/\d+|\/\d+)?(?:\s?(?:%|percent|million|billion|thousand|[kmb]n?\b|[KMB]\b))?(?:\s*(?:to|–|-|and)\s*(?:[$€£]\s?)?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|percent|million|billion|thousand|[KMB]\b))?)?(?:\s+(?:[a-z]+\s+)?(?:of\s+)?[a-z]+)?/g;
  const cands = [];
  for (const m of sentence.matchAll(re)) {
    let v = m[0].trim();
    // keep the unit word only if it isn't a stop word
    const parts = v.split(/\s+/);
    while (parts.length > 1 && (STOP.has(parts[parts.length - 1].toLowerCase()) || /^(?:about|roughly|around|some)$/i.test(parts[parts.length - 1]))) parts.pop();
    v = parts.join(' ');
    if (/^(?:1[5-9]|20)\d\d$/.test(v)) continue; // a year isn't a count
    if (/^\d+[.)]$/.test(v)) continue;
    cands.push({ v: v.replace(/^between\s+/i, ''), i: m.index, len: m[0].length });
  }
  if (!cands.length) return null;
  const low = sentence.toLowerCase();
  const pos = [];
  for (const t of qt) { const re2 = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'); for (const m of low.matchAll(re2)) pos.push(m.index); }
  if (!pos.length) return cands[0].v;
  let best = cands[0], bd = Infinity;
  for (const c of cands) {
    // a number usually comes just before its noun ("120 employees", "1 1/4 cups milk")
    const d = Math.min(...pos.map(p => (p >= c.i ? (p - c.i - c.len) * 0.6 : (c.i - p) * 1.4)));
    if (d < bd) { bd = d; best = c; }
  }
  return best.v;
}

function answerIn(sentence, q, type = qType(q)) {
  const qs = q.toLowerCase();
  const qWords = new Set(tokens(q).map(sstem));
  const qt = qTokens(q);
  let m;
  if (type === 'when') {
    const re = new RegExp(`\\b(?:(?:on|by|before|after|until)\\s+)?(?:${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}|\\d{1,2}\\s+${MONTH}\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2}|${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?|${MONTH}\\s+\\d{4}|${DAY}(?:\\s+(?:at\\s+)?(?:noon|night|morning|afternoon|evening|\\d{1,2}(?::\\d\\d)?\\s?(?:am|pm)))?|(?:in\\s+)?(?:1[5-9]|20)\\d\\d(?:s)?|the (?:19|20)\\d0s|tomorrow|tonight|next (?:week|month|year)|this (?:week|weekend))\\b`, 'gi');
    const all = [...sentence.matchAll(re)].map(x => ({ v: x[0].replace(/^in\s+/i, ''), i: x.index }));
    if (!all.length) return null;
    const low = sentence.toLowerCase();
    const pos = qt.map(t => low.indexOf(t)).filter(i => i >= 0);
    if (!pos.length) return all[0].v;
    return all.sort((a, b) => Math.min(...pos.map(p => Math.abs(p - a.i))) - Math.min(...pos.map(p => Math.abs(p - b.i))))[0].v;
  }
  if (type === 'num') return numberNear(sentence, qt);
  if (type === 'who') {
    const names = [];
    const re = /\b(?:(?:Mr|Mrs|Ms|Dr|Prof)\.?\s+)?[A-Z][a-z'’-]+(?:\s+(?:[A-Z]\.\s*)?[A-Z][a-z'’-]+)*/g;
    for (const x of sentence.matchAll(re)) {
      const n = x[0];
      if (/^(?:The|A|An|In|On|At|But|And|Or|If|When|While|However|He|She|They|It|We|I|You|His|Her|Their|Its|This|That|Chief|Analysts?|Everyone|Someone|Please|Hi|Thanks|Got)$/.test(n)) continue;
      if (tokens(n).map(sstem).every(t => qWords.has(t))) continue;
      names.push({ n, i: x.index });
    }
    if (!names.length) return null;
    if (NEG.test(q)) {
      const ni = sentence.search(NEG);
      const before = names.filter(x => x.i < ni);
      if (before.length) return before.slice(-3).map(x => x.n).join(' and ');
    }
    // "Priya and Sam did ..." → both names
    const first = names[0];
    const joined = new RegExp(`${first.n}((?:,\\s*[A-Z][a-z]+)*,?\\s+and\\s+[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)`).exec(sentence);
    if (joined && names.length > 1) return first.n + joined[1];
    // prefer people (two-word names) over companies when the question is about a person
    const person = names.find(x => /^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(x.n) && !ORG_RE.test(x.n));
    if (/\b(?:found|start|creat|build|built|invent|wrote|writ|design|discover|lead|led|run|own|said)/i.test(qs)) {
      const by = /\bby\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:(?:\s*,\s*|\s+and\s+)(?:[a-z]+\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)*)/.exec(sentence);
      if (by) return by[1].trim();
    }
    return (person || first).n;
  }
  if (type === 'where') {
    const verb = qt.find(t => new RegExp(`\\b${t}`).test(sentence.toLowerCase()));
    const from = verb ? sentence.toLowerCase().search(new RegExp(`\\b${verb}`)) : 0;
    const rest = sentence.slice(Math.max(0, from));
    m = /\b(?:in|at|under(?:neath)?|near|inside|behind|beside|next to|on top of|on|by|from|into|outside|across|along|below|above|over)\s+(?:the\s+|a\s+|an\s+|his\s+|her\s+|their\s+)?[^,.;!?]{2,60}/i.exec(rest) || /\b(?:in|at|from|near)\s+((?:the\s+)?[A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+)*)/.exec(sentence);
    return m ? m[0].replace(/\s+(?:before|after|when|while|and|but)\b.*$/i, '').trim() : null;
  }
  if (type === 'why') {
    m = /\b(?:because(?: of)?|since|due to|owing to|thanks to|as a result of|caused by|in order to|so that)\s+([^.;!?]+)/i.exec(sentence);
    if (m) return m[0].trim();
    m = /\b(?:the (?:main |primary )?(?:cause|reason)\s+(?:identified\s+)?(?:was|is|were|are))\s+([^.;!?]+)/i.exec(sentence);
    if (m) return m[1].trim();
    return null;
  }
  if (type === 'what') {
    // "what was inside the box" → the words after "inside was"; "what is X" → what follows "X is"
    const low = sentence.toLowerCase();
    for (const t of qt) {
      const i = low.search(new RegExp(`\\b${t}\\w*\\s+(?:was|were|is|are|contained|held|read|said|showed|included)\\b`));
      if (i >= 0) {
        const after = sentence.slice(i).replace(/^\S+\s+\S+\s+/, '');
        const clip = after.split(/[,;.!?](?:\s|$)/)[0].split(/\s+/).slice(0, 18).join(' ').replace(/\s+(?:that|which|who)\s+(?:read|said|says|reads|was|is)$/i, '');
        if (clip.length > 2) return clip;
      }
    }
    return null;
  }
  return null;
}

function scoreSentence(s, qt, type, q, near = new Set(), docWide = new Set()) {
  const st = new Set(tokens(s).map(sstem));
  let hits = 0, w = 0, tw = 0;
  for (const t of qt) {
    const wt = t.length > 6 ? 1.4 : 1; tw += wt;
    if (hitTok(t, st)) { hits++; w += wt; }
    else if (hitTok(t, near) || docWide.has(t)) { hits++; w += wt * 0.5; }   // said in a neighbouring sentence, or the document's own subject
  }
  let score = w / Math.max(tw, 1);
  if (CUES[type] && CUES[type].test(s)) score += 0.25;
  const qNeg = NEG.test(q), sNeg = NEG.test(s);
  if (qNeg && !sNeg) score -= 0.5;
  if (qNeg && sNeg) score += 0.2;
  if (s.length > 400) score -= 0.2;
  if (/^[A-Z][^.!?]{0,60}$/.test(s) && !/[.!?]$/.test(s)) score -= 0.15; // a heading, not a sentence
  return { score, hits, hitFrac: hits / Math.max(qt.length, 1) };
}

function bestAnswer(q) {
  const type = qType(q);
  const qt = qTokens(q);
  if (!qt.length) return null;
  const hits = searchAll(qExpand(q), 8);
  let best = null;
  const seen = new Set();
  // Proper nouns from the question that the document is about count everywhere in it ("who founded Brightline?").
  const caps = (q.match(/\b[A-Z][a-zA-Z]+/g) || []).slice(/^(?:What|Who|When|Where|Why|How|Which|Is|Are|Was|Were|Did|Do|Does)$/.test((q.match(/^\w+/) || [''])[0]) ? 1 : 0).map(sstem);
  for (const h of hits) {
    const docWide = new Set(caps.filter(c => h.doc.text.toLowerCase().includes(c)));
    const ss = sentences(h.c.text);
    ss.forEach((s, i) => {
      if (seen.has(s)) return; seen.add(s);
      const near = new Set([...(ss[i - 1] ? tokens(ss[i - 1]) : []), ...(ss[i + 1] ? tokens(ss[i + 1]) : [])].map(sstem));
      const sc = scoreSentence(s, qt, type, q, near, docWide);
      let ans = answerIn(s, q, type), shown = s;
      // "why" answers are often in the next sentence ("... laid off 120 people. The cuts were necessary because ...")
      if (!ans && type === 'why' && ss[i + 1]) { const a2 = answerIn(ss[i + 1], q, type); if (a2) { ans = a2; shown = `${s} ${ss[i + 1]}`; } }
      const score = sc.score + (ans ? 0.45 : 0) + h.s * 0.02;
      if (!best || score > best.score) best = { score, s: shown, ans, doc: h.doc, page: h.c.page, hitFrac: sc.hitFrac, hits: sc.hits, type };
    });
  }
  return best && best.score > 0.5 && best.hitFrac >= 0.5 && best.hits >= Math.min(2, qt.length) ? best : null;
}
function qExpand(q) { const extra = []; for (const t of qTokens(q)) { const syn = SYN_OF.get(t); if (syn) extra.push(...[...syn].slice(0, 3)); } return q + ' ' + extra.join(' '); }

// Proper nouns in the question that the files never mention mean it's about something else.
function namesMissing(q) {
  const caps = (q.match(/\b[A-Z][a-zA-Z]{1,}\b/g) || []).filter((w, i) => i > 0 || !/^(?:What|Who|When|Where|Why|How|Which|Is|Are|Was|Were|Do|Does|Did|Can|In|The)$/.test(w));
  const all = docs.map(d => d.text).join(' ').toLowerCase();
  return caps.some(c => !all.includes(c.toLowerCase()));
}

// ---------- tables hiding in PDF text ("Region Revenue Growth Northeast $1.2M 4% ...") ----------
const VAL = String.raw`(?:[-–]?[$€£]?\s?[-–]?\d[\d,]*(?:\.\d+)?\s?(?:%|[KMB]\b|k\b|m\b|bn\b)?|n\/a|—|-)`;
function inlineTables(text) {
  const out = [];
  const rowRe = new RegExp(String.raw`([A-Z][A-Za-z.&'’-]*(?: [A-Z][A-Za-z.&'’-]*){0,3})((?:\s+${VAL}){1,8})(?=\s|$)`, 'g');
  const flat = text.replace(/\s+/g, ' ');
  let cur = null, lastEnd = -1;
  for (const m of flat.matchAll(rowRe)) {
    const vals = m[2].trim().split(new RegExp(String.raw`\s+(?=[-–$€£\d]|n\/a|—)`)).filter(Boolean);
    if (cur && m.index - lastEnd <= 2 && vals.length === cur.k) cur.rows.push([m[1], ...vals]);
    else {
      if (cur && cur.rows.length >= 2) out.push(cur);
      const nameW = m[1].split(' ');
      let head, first = m[1];
      if (nameW.length >= vals.length + 2) { head = nameW.slice(0, vals.length + 1); first = nameW.slice(vals.length + 1).join(' '); }
      else head = flat.slice(Math.max(0, m.index - 120), m.index).trim().split(' ').slice(-(vals.length + 1));
      cur = { k: vals.length, rows: [[first, ...vals]], head };
    }
    lastEnd = m.index + m[0].length;
  }
  if (cur && cur.rows.length >= 2) out.push(cur);
  return out.filter(t => t.rows.length >= 2 && t.head.every(w => /^[A-Z]/.test(w)));
}
function tableAnswer(q) {
  const ql = q.toLowerCase();
  for (const doc of docs) {
    const tabs = doc.kind === 'table' ? [{ head: doc.table.head, rows: doc.table.rows }] : inlineTables(doc.text);
    for (const t of tabs) {
      const head = t.head.map(h => String(h).toLowerCase());
      const col = head.findIndex((h, j) => j > 0 && ql.includes(sstem(h)));
      const row = t.rows.find(r => new RegExp(`\\b${String(r[0]).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(ql));
      if (row && col > 0) return { ans: `${row[col]}`, detail: `${row[0]}: ${t.head[col]} ${row[col]}`, t, doc };
      if (row) return { ans: row.slice(1).map((v, j) => `${t.head[j + 1]} ${v}`).join(', '), detail: row[0], t, doc };
      const num = (v) => { const n = parseFloat(String(v).replace(/[$€£,\s]/g, '').replace(/[–]/g, '-')); return isNaN(n) ? null : n * (/B\b|bn/i.test(v) ? 1e9 : /M\b|m\b/.test(v) ? 1e6 : /K\b|k\b/.test(v) ? 1e3 : 1); };
      const c = col > 0 ? col : (head.length === 2 ? 1 : -1);
      if (c > 0) {
        if (/\bnegative|below zero|decline|fell|loss/.test(ql)) { const r = t.rows.filter(r => (num(r[c]) ?? 0) < 0); if (r.length) return { ans: r.map(x => x[0]).join(', '), detail: r.map(x => `${x[0]} ${x[c]}`).join(', '), t, doc }; }
        const hi = /\b(?:highest|most|largest|biggest|top|best|max(?:imum)?|greatest|fastest)\b/.test(ql), lo = /\b(?:lowest|least|smallest|worst|min(?:imum)?|fewest|slowest)\b/.test(ql);
        if (hi || lo) { const r = [...t.rows].filter(r => num(r[c]) != null).sort((a, b) => (num(b[c]) - num(a[c])) * (hi ? 1 : -1))[0]; if (r) return { ans: r[0], detail: `${r[0]}: ${t.head[c]} ${r[c]}`, t, doc }; }
        if (/\b(?:total|sum|altogether|combined)\b/.test(ql)) { const s = t.rows.reduce((a, r) => a + (num(r[c]) || 0), 0); return { ans: s.toLocaleString(), detail: `Sum of ${t.head[c]} over ${t.rows.length} rows`, t, doc }; }
        if (/\b(?:average|mean)\b/.test(ql)) { const v = t.rows.map(r => num(r[c])).filter(x => x != null); return { ans: (v.reduce((a, b) => a + b, 0) / v.length).toLocaleString(undefined, { maximumFractionDigits: 3 }), detail: `Average of ${t.head[c]}`, t, doc }; }
      }
    }
  }
  return null;
}

// ---------- things to do, deadlines ----------
const OBLIG = /\b(?:need(?:s)? to|must|should|please|have to|has to|required to|is due|are due|due (?:on|by)|deadline|make sure|remember to|don['’]t forget|will need|can someone|could someone|bring)\b/i;
function actionItems(q) {
  const dayRe = new RegExp(`\\b(${DAY}|tomorrow|tonight|today|${MONTH}\\s+\\d{1,2}|next week|this week(?:end)?)\\b`, 'i');
  const want = dayRe.exec(q);
  const me = /\b(?:i|me|my)\b/i.test(q);
  const out = [];
  for (const doc of docs) for (const s of sentences(doc.text)) {
    if (!OBLIG.test(s)) continue;
    if (want && !new RegExp(want[1].slice(0, 3), 'i').test(s)) continue;
    out.push({ s, doc, everyone: /\b(?:everyone|all|you|please|team|each)\b/i.test(s) });
  }
  if (me) out.sort((a, b) => b.everyone - a.everyone);
  return out;
}

// ---------- "which happened first, A or B?" ----------
function whichFirst(q) {
  const m = /^which (?:happened|came|occurred|was) (?:first|earlier|sooner|last|later)\s*[,:]?\s*(.+?)\s+or\s+(.+?)$/i.exec(q.replace(/\?$/, '')) || /^(?:did|was)\s+(.+?)\s+(?:happen\s+)?before\s+(.+?)$/i.exec(q.replace(/\?$/, ''));
  if (!m) return null;
  const late = /last|later/i.test(q);
  const when = (opt) => {
    const b = bestAnswer(`when ${opt.replace(/^the\s+/i, '')}`);
    if (!b || !b.ans) return null;
    const y = /\b(1[5-9]\d\d|20\d\d)\b/.exec(b.ans);
    const d = new Date(b.ans);
    return { opt, ans: b.ans, s: b.s, t: !isNaN(d) ? d.getTime() : y ? Date.UTC(+y[1], 0, 1) : null };
  };
  const a = when(m[1]), b = when(m[2]);
  if (!a || !b || a.t == null || b.t == null) return { fail: true, a, b };
  const first = (a.t <= b.t) !== late ? a : b;
  return { first, a, b, late, before: /before/i.test(q) && !/^which/i.test(q) };
}

// After any other answer: show the best-matching passages from the user's files.
export function fileContext(ctx, q, { strongOnly = false } = {}) {
  if (!docs.length || q.length < 3) return false;
  let shown = false;
  const isQ = /^(?:who|what|when|where|which|why|how|is|are|does|did|do|was|were|can|could|should|will|has|have)\b/i.test(q);
  if (isQ) {
    const wf = whichFirst(q);
    if (wf && !wf.fail) {
      ctx.add({ title: 'Answer from your files', custom: (el) => {
        el.append(api.h('p', 'big-text', wf.before ? (wf.first === wf.a ? 'Yes' : 'No') : wf.first.opt.replace(/^the\s+/i, '')));
        el.append(api.h('p', 'note', `${wf.a.opt}: ${wf.a.ans} · ${wf.b.opt}: ${wf.b.ans}`));
        for (const x of [wf.a, wf.b]) { const p = api.h('p', 'res-snip passage'); p.append(highlight(x.s, x.opt)); el.append(p); }
      } });
      return true;
    }
    const tb = tableAnswer(q);
    if (tb) {
      ctx.add({ title: 'Answer from your files', custom: (el) => {
        el.append(api.h('p', 'big-text', tb.ans));
        el.append(api.h('p', 'note', `${tb.detail} · from a table in ${tb.doc.name}`));
      } });
      ctx.add({ title: 'The table', table: { head: tb.t.head, rows: tb.t.rows.map(r => r.map(String)) } });
      return true;
    }
    if (/what (?:do|should|must|have) (?:i|we|you)(?: need to| have to)? do|action items?|to-?do|what(?:'s| is| are) due|deadlines?|what (?:needs|has) to (?:be done|happen)|what am i supposed to/i.test(q)) {
      const items = actionItems(q);
      if (items.length) {
        ctx.add({ title: 'To do, from your files', numbered: items.slice(0, 12).map(x => x.s), note: 'Sentences with “need to”, “must”, “please”, deadlines and similar. Check who each one is for.' });
        return true;
      }
    }
    if (/\b(?:main (?:idea|point|argument|claim|message|takeaway|theme)s?|thesis|gist|what(?:'s| is) (?:this|it|the (?:text|article|story|passage|email|paper|document|file|pdf)) (?:mainly |mostly )?about|what is the (?:author|writer)['’]?s? (?:point|argument|view))\b/i.test(q)) {
      const d = docs[docs.length - 1];
      const s = summarize(d.text, 2);
      ctx.add({ title: 'Main idea', numbered: s, note: 'The most central sentences (TextRank). An extractive summary, so it quotes rather than paraphrases.' });
      return true;
    }
    if (strongOnly && namesMissing(q)) return false;
    const b = bestAnswer(q);
    if (b && !(strongOnly && !b.ans && b.hitFrac < 0.75)) {
      ctx.add({ title: 'Answer from your files', custom: (el) => {
        if (b.ans) el.append(api.h('p', 'big-text', b.ans.charAt(0).toUpperCase() + b.ans.slice(1)));
        const p = api.h('p', 'res-snip passage'); p.append(highlight(b.s, q + ' ' + (b.ans || ''))); el.append(p);
        el.append(api.h('p', 'note', `${b.doc.name}${b.doc.kind === 'pdf' ? ` · page ${b.page}` : ''}. Found by matching your question’s words, so check it in context.`));
      } });
      shown = true;
    } else if (strongOnly) return false;
  }
  const hits = searchAll(q, 3).filter(h => h.s > 1.2);
  if (hits.length && !(shown && hits.length === 1)) ctx.add(passagesPod(hits, q, shown ? 'Related passages' : 'From your files'));
  return shown || hits.length > 0;
}

// True when the user's files clearly answer the question.
export function strongAnswer(q) {
  if (!docs.length || !/^(?:who|what|when|where|which|how|why|is|are|was|were|did|does|do)\b/i.test(q)) return false;
  if (whichFirst(q) || tableAnswer(q)) return true;
  if (/what (?:do|should|must|have) (?:i|we|you)(?: need to| have to)? do|action items?|to-?do|deadlines?|main (?:idea|point|argument)|what(?:'s| is) (?:this|it|the (?:text|article|story|email|paper)) about|author['’]?s? (?:main )?(?:point|argument)/i.test(q)) return true;
  if (namesMissing(q)) return false;
  const b = bestAnswer(q);
  return !!(b && (b.ans ? b.hitFrac >= 0.5 : b.hitFrac >= 0.75));
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
  const gd = /docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([\w-]+)/.exec(u);
  if (gd) u = `https://docs.google.com/${gd[1]}/d/${gd[2]}/export${gd[1] === 'presentation' ? '/txt' : `?format=${gd[1] === 'spreadsheets' ? 'csv' : 'txt'}`}`;
  const wait = ctx.add({ title: 'Reading', text: `Fetching ${u}…`, loading: true });
  let r;
  try { r = await fetch(PROXY_READ + encodeURIComponent(u)); } finally { wait.remove(); }
  if (r.status === 401 || (gd && r.status === 403)) throw new Error('That Google file isn’t public. In Google Docs choose Share → “Anyone with the link”, or use File → Download → PDF and drop the PDF here.');
  if (r.status === 403) throw new Error('That site isn’t on the reading list. I can read .gov, .edu, Wikipedia, arXiv, PubMed Central, PLOS, MDPI, Frontiers, Project Gutenberg, GitHub and similar open sources. For other pages, save the page as a PDF and drop it in.');
  if (!r.ok) throw new Error(`The page returned an error (${r.status}).`);
  const type = r.headers.get('Content-Type') || '';
  let doc;
  if (gd) {
    const text = await r.text();
    const name = `Google ${({ document: 'Doc', spreadsheets: 'Sheet', presentation: 'Slides' })[gd[1]]}`;
    doc = gd[1] === 'spreadsheets' ? Object.assign(makeDoc(name, text, 'table'), { table: parseCSV(text) }) : makeDoc(name, text.replace(/^\uFEFF/, ''), 'text');
    doc.url = url;
  } else if (/pdf/i.test(type) || /\.pdf($|\?)/i.test(u)) {
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
