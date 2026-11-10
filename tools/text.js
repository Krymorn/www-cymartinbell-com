// Text tools: grammar (LanguageTool's rule engine), readability, style, word frequency and n-grams,
// similarity, flashcards → Anki/Quizlet, cloze and self-quizzes, word games over the 60k word list,
// case/line/cleanup transforms, extraction, ciphers, number encodings, hashes, colors and CSS units.
import * as K from './kit.js';
const { enc, fmt } = K;

let WORDS = null;
const words = async () => (WORDS ||= await fetch(new URL('./data/words.txt', import.meta.url)).then(r => r.text()).then(t => t.split('\n').filter(w => /^[a-z]+$/.test(w))));
const tokens = (t) => (t.toLowerCase().match(/[a-z0-9]+(?:['’][a-z]+)?/g) || []);
const STOP = new Set('a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those i you he she we they me him her us them my your his our their not no so do does did have has had will would can could should may might must than then there here what which who whom whose when where why how all any each few more most other some such only own same too very just also into over under about after before between out up down off again further once s t'.split(' '));
const sentences = (t) => t.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["”’)]*|[^.!?]+$/g)?.map(s => s.trim()).filter(Boolean) || [];
function syllables(w) {
  w = w.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0; if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

// ------------------------------------------------------------ writing quality
async function grammar(ctx, text, d) {
  ctx.label('Grammar'); ctx.input(text.length > 80 ? text.slice(0, 80) + '…' : text);
  if (text.length > 6000) throw new Error('Grammar check takes up to about 6,000 characters at a time. Paste one section.');
  const r = await d.get(`https://api.languagetool.org/v2/check?language=auto&text=${enc(text)}`);
  const ms = r.matches || [];
  if (!ms.length) { ctx.add({ title: 'No issues found', big: true, text: 'LanguageTool’s grammar rules found nothing to fix.', note: 'Rule-based checks miss some things (wrong-but-real words, logic, tone). Read it aloud once.' }); return; }
  // Apply first suggestion of each match (from the end so offsets stay valid)
  let fixed = text;
  for (const m of [...ms].sort((a, b) => b.offset - a.offset)) if (m.replacements[0]) fixed = fixed.slice(0, m.offset) + m.replacements[0].value + fixed.slice(m.offset + m.length);
  ctx.add({ title: `${ms.length} issue${ms.length > 1 ? 's' : ''}`, table: { head: ['Problem', 'In context', 'Suggestion', 'Type'], rows: ms.slice(0, 40).map(m => [m.message, '…' + m.context.text.slice(Math.max(0, m.context.offset - 15), m.context.offset) + '[' + m.context.text.substr(m.context.offset, m.context.length) + ']' + m.context.text.slice(m.context.offset + m.context.length, m.context.offset + m.context.length + 15) + '…', m.replacements.slice(0, 3).map(x => x.value).join(' / ') || '—', m.rule.category.name]) } });
  ctx.add({ title: 'With all first suggestions applied', text: fixed, note: 'Review each change: the first suggestion is not always right.' });
  ctx.source('LanguageTool (rule-based, open source)', 'https://languagetool.org');
}
function readability(ctx, text) {
  const S = sentences(text), W = tokens(text).filter(w => /[a-z]/.test(w));
  if (W.length < 20) throw new Error('Paste at least a few sentences (20+ words).');
  const syl = W.map(syllables), totSyl = K.sum(syl), poly = syl.filter(s => s >= 3).length, chars = W.join('').length;
  const wps = W.length / S.length, spw = totSyl / W.length;
  const fre = 206.835 - 1.015 * wps - 84.6 * spw;
  const fk = 0.39 * wps + 11.8 * spw - 15.59;
  const fog = 0.4 * (wps + 100 * poly / W.length);
  const smog = 1.043 * Math.sqrt(poly * 30 / S.length) + 3.1291;
  const cli = 0.0588 * (chars / W.length * 100) - 0.296 * (S.length / W.length * 100) - 15.8;
  const ari = 4.71 * chars / W.length + 0.5 * wps - 21.43;
  const avg = (fk + fog + smog + cli + ari) / 5;
  const band = fre >= 90 ? 'Very easy (5th grade)' : fre >= 80 ? 'Easy (6th grade)' : fre >= 70 ? 'Fairly easy (7th)' : fre >= 60 ? 'Plain English (8th–9th)' : fre >= 50 ? 'Fairly difficult (10th–12th)' : fre >= 30 ? 'Difficult (college)' : 'Very difficult (graduate)';
  ctx.label('Readability'); ctx.input(`${W.length} words, ${S.length} sentences`);
  ctx.add({ title: 'Reading level', big: true, text: `Grade ${fmt(avg, 1)} · ${band}` });
  ctx.add({ title: 'Scores', table: { head: ['Formula', 'Score', 'Means'], rows: [['Flesch Reading Ease', fmt(fre, 1), '0–100, higher is easier'], ['Flesch–Kincaid Grade', fmt(fk, 1), 'U.S. grade level'], ['Gunning Fog', fmt(fog, 1), 'Years of schooling'], ['SMOG', fmt(smog, 1), 'Grade (best for 30+ sentences)'], ['Coleman–Liau', fmt(cli, 1), 'Grade (letters-based)'], ['Automated Readability', fmt(ari, 1), 'Grade (characters-based)']] } });
  const long = S.map(s => [s, tokens(s).length]).filter(x => x[1] > 30).sort((a, b) => b[1] - a[1]);
  ctx.add({ title: 'Details', table: [['Words per sentence', fmt(wps, 1)], ['Syllables per word', fmt(spw, 2)], ['Complex words (3+ syllables)', `${poly} (${fmt(100 * poly / W.length, 1)}%)`], ['Reading time', `${Math.max(1, Math.round(W.length / 238))} min`], ['Speaking time', `${Math.max(1, Math.round(W.length / 150))} min`]] });
  if (long.length) ctx.add({ title: 'Longest sentences (consider splitting)', list: long.slice(0, 5).map(([s, n]) => ({ title: `${n} words`, snippet: s })) });
  ctx.add({ title: 'More', chips: ['style check: ' + text.slice(0, 400), 'check grammar: ' + text.slice(0, 400)] });
}
const WEAK = { 'very': 'cut it or use a stronger word', 'really': 'usually cuttable', 'just': 'usually cuttable', 'basically': 'cut', 'actually': 'often cuttable', 'quite': 'vague', 'somewhat': 'vague', 'a lot': 'many / much / a specific number', 'lots of': 'many / much', 'things': 'name the thing', 'stuff': 'name it', 'good': 'be specific', 'bad': 'be specific', 'in order to': 'to', 'due to the fact that': 'because', 'at this point in time': 'now', 'in the event that': 'if', 'for the purpose of': 'to / for', 'the reason why is because': 'because', 'it is important to note that': 'cut', 'each and every': 'each', 'absolutely essential': 'essential', 'end result': 'result', 'past history': 'history', 'utilize': 'use', 'in my opinion': 'cut in academic writing', 'i think': 'cut in academic writing', 'i feel': 'cut in academic writing', 'there is': 'often a weak opener', 'there are': 'often a weak opener', 'gonna': 'going to', 'wanna': 'want to', 'kinda': 'somewhat', 'can not': 'cannot', 'alot': 'a lot', 'irregardless': 'regardless', 'could of': 'could have', 'should of': 'should have', 'would of': 'would have' };
function styleCheck(ctx, text) {
  const out = [];
  const low = text.toLowerCase();
  for (const [w, fix] of Object.entries(WEAK)) { const re = new RegExp(`\\b${w}\\b`, 'gi'); const n = (low.match(re) || []).length; if (n) out.push([`“${w}”`, n, fix]); }
  const passive = [...text.matchAll(/\b(?:is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?(\w+(?:ed|en|wn|ung|ept|ought|aught|ade|id|ot))\b(?:\s+by\b)?/gi)].map(m => m[0]);
  const adverbs = (text.match(/\b\w{3,}ly\b/gi) || []).filter(w => !/^(?:only|family|early|reply|apply|supply|july|italy|daily|likely|rely|ally|fly|holy|ugly|belly|jelly|bully|rally|tally|lily|imply|comply)$/i.test(w));
  const S = sentences(text);
  const starts = {}; S.forEach(s => { const w = tokens(s)[0]; if (w) starts[w] = (starts[w] || 0) + 1; });
  const rep = Object.entries(starts).filter(([, n]) => n >= 3 && n / S.length > 0.2);
  const freq = {}; tokens(text).filter(w => w.length > 4 && !STOP.has(w)).forEach(w => (freq[w] = (freq[w] || 0) + 1));
  const over = Object.entries(freq).filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).slice(0, 8);
  ctx.label('Style check'); ctx.input(`${tokens(text).length} words`);
  ctx.add({ title: 'Wordy / weak phrases', table: out.length ? { head: ['Phrase', 'Times', 'Try'], rows: out } : [['None found', '']] });
  ctx.add({ title: `Possible passive voice (${passive.length})`, list: passive.slice(0, 12).map(p => ({ title: p })), note: passive.length ? 'Passive is fine in lab reports; elsewhere, active voice is usually clearer (“the team tested it”, not “it was tested”).' : undefined });
  if (adverbs.length) ctx.add({ title: `-ly adverbs (${adverbs.length})`, text: [...new Set(adverbs.map(a => a.toLowerCase()))].join(', ') });
  if (rep.length) ctx.add({ title: 'Repetitive sentence openers', table: rep.map(([w, n]) => [`“${w}…”`, `${n} of ${S.length} sentences`]) });
  if (over.length) ctx.add({ title: 'Overused words', table: over.map(([w, n]) => [w, `${n}×`]), buttons: over.slice(0, 4).map(([w]) => ({ label: `Synonyms: ${w}`, query: `synonyms for ${w}` })) });
}
function wordFreq(ctx, text, n = 1, keepStop = false) {
  const T = tokens(text);
  const grams = {};
  for (let i = 0; i + n <= T.length; i++) { const g = T.slice(i, i + n); if (!keepStop && (n === 1 ? STOP.has(g[0]) : STOP.has(g[0]) || STOP.has(g[n - 1]))) continue; const k = g.join(' '); grams[k] = (grams[k] || 0) + 1; }
  const rows = Object.entries(grams).sort((a, b) => b[1] - a[1]);
  const total = K.sum(rows.map(r => r[1])) || 1;
  const label = n === 1 ? 'Word' : n === 2 ? 'Bigram' : n === 3 ? 'Trigram' : `${n}-gram`;
  ctx.label('Frequency'); ctx.input(`${T.length} words · ${rows.length} distinct ${label.toLowerCase()}s`);
  ctx.add({ title: `Top ${label.toLowerCase()}s`, table: { head: [label, 'Count', '%'], rows: rows.slice(0, 30).map(([w, c]) => [w, c, fmt(100 * c / total, 2)]) } });
  ctx.add({ title: 'Chart', plot: { kind: 'bar', x: rows.slice(0, 20).map(r => r[0]), y: rows.slice(0, 20).map(r => r[1]) } });
  ctx.add(K.filesPod(K.tableFiles(`${label.toLowerCase()}-frequency`, [label, 'Count', 'Percent'], rows.map(([w, c]) => [w, c, K.round(100 * c / total, 3)]))));
  if (n === 1) ctx.add({ title: 'Also', chips: ['bigrams: ' + text.slice(0, 500), 'trigrams: ' + text.slice(0, 500)] });
}
function similarity(ctx, a, b) {
  const ta = tokens(a), tb = tokens(b);
  const vec = (t) => { const v = {}; t.filter(w => !STOP.has(w)).forEach(w => (v[w] = (v[w] || 0) + 1)); return v; };
  const va = vec(ta), vb = vec(tb);
  let dot = 0; for (const k in va) if (vb[k]) dot += va[k] * vb[k];
  const norm = (v) => Math.sqrt(K.sum(Object.values(v).map(x => x * x))) || 1;
  const cos = dot / (norm(va) * norm(vb));
  const sa = new Set(Object.keys(va)), sb = new Set(Object.keys(vb));
  const inter = [...sa].filter(x => sb.has(x));
  const jac = inter.length / (new Set([...sa, ...sb]).size || 1);
  const sh = (t, n) => new Set(t.map((_, i) => t.slice(i, i + n).join(' ')).filter(g => g.split(' ').length === n));
  const g5a = sh(ta, 5), g5b = sh(tb, 5); const shared5 = [...g5a].filter(x => g5b.has(x));
  // merge overlapping shared 5-grams into phrases
  const phrases = []; let cur = null;
  for (let i = 0; i + 5 <= ta.length; i++) { const g = ta.slice(i, i + 5).join(' '); if (g5b.has(g)) { if (cur && cur.end >= i) cur.end = i + 5; else { cur = { start: i, end: i + 5 }; phrases.push(cur); } } }
  const copied = new Set(); phrases.forEach(p => { for (let i = p.start; i < p.end; i++) copied.add(i); });
  ctx.label('Similarity'); ctx.input('Text A vs text B');
  ctx.add({ title: 'Similarity', table: [['Cosine (word use)', `${fmt(100 * cos, 1)}%`], ['Jaccard (shared vocabulary)', `${fmt(100 * jac, 1)}%`], ['Text A covered by phrases also in B', `${fmt(100 * copied.size / (ta.length || 1), 1)}%`], ['Shared 5-word phrases', shared5.length]], note: 'This compares only these two texts. It isn’t a plagiarism database check: overlapping wording with a source still needs quotation marks and a citation.' });
  if (phrases.length) ctx.add({ title: 'Matching passages', list: phrases.sort((x, y) => (y.end - y.start) - (x.end - x.start)).slice(0, 10).map(p => ({ title: `${p.end - p.start} words`, snippet: ta.slice(p.start, p.end).join(' ') })) });
  ctx.add({ title: 'Shared key words', text: inter.sort((x, y) => (va[y] + vb[y]) - (va[x] + vb[x])).slice(0, 30).join(', ') || '—' });
}

// ------------------------------------------------------------ study aids
function parseCards(text) {
  const lines = text.split(/\n|;(?=\s*\S)/).map(l => l.trim()).filter(Boolean);
  const cards = [];
  for (const l of lines) {
    const m = /^(.+?)\s*(?:\t|\s[-–—:=]\s|:\s|\s?=\s?|\s->\s|\|)\s*(.+)$/.exec(l);
    if (m) cards.push([m[1].replace(/^[-*•\d.)\s]+/, '').trim(), m[2].trim()]);
  }
  return cards;
}
function flashcards(ctx, text) {
  const cards = parseCards(text);
  if (cards.length < 2) throw new Error('Write one card per line as “term - definition” (or term: definition).');
  ctx.label('Flashcards'); ctx.input(`${cards.length} cards`);
  ctx.add({ title: 'Study', custom: (el) => {
    let order = cards.map((_, i) => i), i = 0, flipped = false, known = new Set();
    const box = document.createElement('div'); box.className = 'flashcard'; box.tabIndex = 0;
    const meta = document.createElement('p'); meta.className = 'note';
    const show = () => { const c = cards[order[i]]; box.textContent = flipped ? c[1] : c[0]; box.classList.toggle('back', flipped); meta.textContent = `Card ${i + 1} of ${order.length} · ${known.size} known · click or Space to flip, ←/→ to move`; };
    box.onclick = () => { flipped = !flipped; show(); };
    box.onkeydown = (e) => { if (e.key === ' ') { e.preventDefault(); box.onclick(); } if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') { i = (i - 1 + order.length) % order.length; flipped = false; show(); } };
    const next = () => { i = (i + 1) % order.length; flipped = false; show(); };
    const mk = (t, f) => { const b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.textContent = t; b.onclick = f; return b; };
    const bar = document.createElement('div'); bar.className = 'btns';
    bar.append(mk('← Prev', () => { i = (i - 1 + order.length) % order.length; flipped = false; show(); }), mk('Flip', () => box.onclick()), mk('Next →', next), mk('✓ I know it', () => { known.add(order[i]); next(); }), mk('Shuffle', () => { order = K.shuffle(order); i = 0; flipped = false; show(); }), mk('Only unknown', () => { const u = order.filter(x => !known.has(x)); if (u.length) { order = u; i = 0; flipped = false; show(); } }), mk('Swap sides', () => { cards.forEach(c => c.reverse()); show(); }));
    el.append(box, bar, meta); show();
  } });
  ctx.add(K.filesPod([{ label: 'Anki (.csv)', name: 'flashcards-anki.csv', mime: 'text/csv', data: K.toCSV(null, cards).replace(/^\r\n/, '') }, { label: 'Quizlet import (.txt)', name: 'flashcards-quizlet.txt', mime: 'text/plain', data: cards.map(c => `${c[0]}\t${c[1]}`).join('\n') }, ...K.tableFiles('flashcards', ['Term', 'Definition'], cards).filter(f => /xlsx|json/i.test(f.name))], 'Export', 'Anki: File → Import, fields separated by comma. Quizlet: Create set → Import, “Tab” between term and definition, “New line” between cards.'));
  ctx.add({ title: 'Test yourself', chips: ['quiz me: ' + text, 'matching game: ' + text].map(s => s.slice(0, 2000)) });
}
function quizMe(ctx, text) {
  const cards = parseCards(text);
  if (cards.length < 4) throw new Error('Give at least 4 “term - definition” lines to build a multiple-choice quiz.');
  const qs = K.shuffle(cards).map(([t, d]) => ({ q: d, a: t, opts: K.shuffle([t, ...K.shuffle(cards.filter(c => c[0] !== t)).slice(0, 3).map(c => c[0])]) }));
  ctx.label('Quiz'); ctx.input(`${qs.length} questions`);
  ctx.add({ title: 'Multiple choice', custom: (el) => {
    let score = 0, done = 0;
    const sc = document.createElement('p'); sc.className = 'big-text';
    qs.forEach((x, n) => {
      const d = document.createElement('div'); d.className = 'quiz-q';
      const p = document.createElement('p'); p.textContent = `${n + 1}. ${x.q}`; d.append(p);
      const bx = document.createElement('div'); bx.className = 'btns';
      x.opts.forEach(o => { const b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.textContent = o; b.onclick = () => { if (d.dataset.done) return; d.dataset.done = 1; done++; if (o === x.a) { score++; b.classList.add('ok'); } else { b.classList.add('bad'); [...bx.children].find(c => c.textContent === x.a).classList.add('ok'); } sc.textContent = `Score: ${score}/${done}${done === qs.length ? ` · ${Math.round(100 * score / qs.length)}%` : ''}`; }; bx.append(b); });
      d.append(bx); el.append(d);
    });
    el.append(sc);
  } });
  ctx.add(K.filesPod([{ label: 'Printable quiz + key (.txt)', name: 'quiz.txt', mime: 'text/plain', data: qs.map((x, n) => `${n + 1}. ${x.q}\n${x.opts.map((o, j) => `   ${'ABCD'[j]}) ${o}`).join('\n')}`).join('\n\n') + '\n\nANSWER KEY\n' + qs.map((x, n) => `${n + 1}. ${'ABCD'[x.opts.indexOf(x.a)]}`).join('  ') }]));
}
function matching(ctx, text) {
  const cards = K.shuffle(parseCards(text)).slice(0, 8);
  if (cards.length < 3) throw new Error('Give at least 3 “term - definition” lines.');
  ctx.label('Matching'); ctx.input(`${cards.length} pairs`);
  ctx.add({ title: 'Click a term, then its definition', custom: (el) => {
    const grid = document.createElement('div'); grid.className = 'match-grid';
    let sel = null, left = cards.length; const t0 = Date.now();
    const msg = document.createElement('p'); msg.className = 'note';
    const items = K.shuffle([...cards.map((c, i) => ({ t: c[0], i, side: 0 })), ...cards.map((c, i) => ({ t: c[1], i, side: 1 }))]);
    items.forEach(it => { const b = document.createElement('button'); b.className = 'chip match'; b.type = 'button'; b.textContent = it.t; b.onclick = () => { if (b.disabled) return; if (!sel) { sel = { it, b }; b.classList.add('sel'); return; } if (sel.b === b) { b.classList.remove('sel'); sel = null; return; } if (sel.it.i === it.i && sel.it.side !== it.side) { b.disabled = sel.b.disabled = true; b.classList.add('ok'); sel.b.classList.add('ok'); sel.b.classList.remove('sel'); if (--left === 0) msg.textContent = `Done in ${Math.round((Date.now() - t0) / 1000)} s`; } else { sel.b.classList.remove('sel'); b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 500); } sel = null; }; grid.append(b); });
    el.append(grid, msg);
  } });
}
function cloze(ctx, text) {
  const T = tokens(text); const f = {}; T.filter(w => w.length > 4 && !STOP.has(w)).forEach(w => (f[w] = (f[w] || 0) + 1));
  const S = sentences(text);
  const out = [], anki = [];
  for (const s of S) {
    const cands = (s.match(/\b[A-Za-z][\w-]{4,}\b/g) || []).filter(w => !STOP.has(w.toLowerCase()));
    if (!cands.length || tokens(s).length < 6) continue;
    const best = cands.sort((a, b) => ((/^[A-Z]/.test(b) ? 2 : 0) + (f[b.toLowerCase()] || 0) + b.length / 10) - ((/^[A-Z]/.test(a) ? 2 : 0) + (f[a.toLowerCase()] || 0) + a.length / 10))[0];
    out.push([s.replace(new RegExp(`\\b${best}\\b`), '_____'), best]);
    anki.push([s.replace(new RegExp(`\\b${best}\\b`), `{{c1::${best}}}`), '']);
  }
  if (!out.length) throw new Error('Paste a few full sentences of notes.');
  ctx.label('Fill in the blank'); ctx.input(`${out.length} questions from your notes`);
  ctx.add({ title: 'Questions (click to reveal)', custom: (el) => { const ol = document.createElement('ol'); out.forEach(([q, a]) => { const li = document.createElement('li'); li.textContent = q + ' '; const b = document.createElement('button'); b.className = 'icon-btn'; b.textContent = 'Show'; b.onclick = () => (b.textContent = a); li.append(b); ol.append(li); }); el.append(ol); } });
  ctx.add(K.filesPod([{ label: 'Anki cloze (.txt)', name: 'cloze-anki.txt', mime: 'text/plain', data: anki.map(r => r[0]).join('\n') }, { label: 'Worksheet + key (.txt)', name: 'fill-in-the-blank.txt', mime: 'text/plain', data: out.map((r, i) => `${i + 1}. ${r[0]}`).join('\n') + '\n\nKEY\n' + out.map((r, i) => `${i + 1}. ${r[1]}`).join('\n') }], 'Export', 'Anki: import as note type “Cloze”.'));
}

// ------------------------------------------------------------ word games
const sortL = (w) => [...w].sort().join('');
async function anagrams(ctx, letters, mode) {
  const W = await words(); const L = letters.toLowerCase().replace(/[^a-z?]/g, '');
  const blanks = (L.match(/\?/g) || []).length; const base = L.replace(/\?/g, '');
  const can = (w) => { const c = {}; for (const ch of base) c[ch] = (c[ch] || 0) + 1; let b = blanks; for (const ch of w) { if (c[ch]) c[ch]--; else if (b) b--; else return false; } return true; };
  ctx.label(mode === 'exact' ? 'Anagrams' : 'Unscramble'); ctx.input(letters);
  if (mode === 'exact') { const key = sortL(base); const res = W.filter(w => w.length === L.length && (blanks ? can(w) : sortL(w) === key) && w !== base); ctx.add({ title: res.length ? `${res.length} anagram${res.length > 1 ? 's' : ''}` : 'No single-word anagrams', text: res.slice(0, 80).join(', ') || '—' }); return; }
  const res = W.filter(w => w.length >= 2 && w.length <= L.length && can(w));
  const by = {}; res.forEach(w => (by[w.length] ||= []).push(w));
  const SCR = { a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3, n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10 };
  const score = (w) => K.sum([...w].map(c => SCR[c]));
  ctx.add({ title: `${res.length} words`, table: { head: ['Letters', 'Words'], rows: Object.keys(by).sort((a, b) => b - a).map(n => [n, by[n].slice(0, 40).join(', ') + (by[n].length > 40 ? ` … (+${by[n].length - 40})` : '')]) } });
  ctx.add({ title: 'Best Scrabble scores', table: res.map(w => [w, score(w)]).sort((a, b) => b[1] - a[1]).slice(0, 8) });
}
async function pattern(ctx, pat, label) {
  const W = await words();
  const re = new RegExp('^' + pat.toLowerCase().replace(/[^a-z?_.*]/g, '').replace(/[?_.]/g, '[a-z]').replace(/\*/g, '[a-z]*') + '$');
  const res = W.filter(w => re.test(w));
  ctx.label(label || 'Word pattern'); ctx.input(pat);
  ctx.add({ title: `${res.length} matches (most common first)`, text: res.slice(0, 150).join(', ') || 'None', note: '? or _ = one letter, * = any number of letters.' });
}
async function wordFilter(ctx, kind, s, len) {
  const W = await words(); s = s.toLowerCase();
  const f = kind === 'start' ? (w) => w.startsWith(s) : kind === 'end' ? (w) => w.endsWith(s) : kind === 'contain' ? (w) => w.includes(s) : (w) => [...s].every(c => !w.includes(c));
  const res = W.filter(w => f(w) && (!len || w.length === +len));
  ctx.label('Words'); ctx.input(`${len ? len + '-letter ' : ''}words ${kind === 'start' ? 'starting with' : kind === 'end' ? 'ending in' : kind === 'contain' ? 'containing' : 'without'} “${s}”`);
  ctx.add({ title: `${res.length} words (most common first)`, text: res.slice(0, 150).join(', ') || 'None' });
}
async function wordle(ctx, spec) {
  // spec: pattern like "cr_n_" with green letters, +letters present (yellow), -letters absent, and optional "a@2" = yellow a not in position 2
  const W = (await words()).filter(w => w.length === 5);
  const first = spec.trim().split(/\s+/)[0]; const green = (/^[a-z_?.*]{5}$/i.test(first) ? first : '?????').toLowerCase().replace(/[_.*]/g, '?');
  const yellow = ((/\+([a-z]+)/i.exec(spec) || [])[1] || '').toLowerCase();
  const gray = ((/-([a-z]+)/i.exec(spec) || [])[1] || '').toLowerCase();
  const notAt = [...spec.matchAll(/([a-z])@(\d)/gi)].map(m => [m[1].toLowerCase(), +m[2] - 1]);
  const res = W.filter(w => [...green].every((c, i) => !/[a-z]/.test(c) || w[i] === c) && [...yellow].every(c => w.includes(c)) && [...gray].every(c => !w.includes(c) || green.includes(c) || yellow.includes(c)) && notAt.every(([c, i]) => w[i] !== c && w.includes(c)));
  const freq = {}; res.forEach(w => new Set(w).forEach(c => (freq[c] = (freq[c] || 0) + 1)));
  const best = [...res].sort((a, b) => K.sum([...new Set(b)].map(c => freq[c])) - K.sum([...new Set(a)].map(c => freq[c])));
  ctx.label('Wordle helper'); ctx.input(spec);
  ctx.add({ title: `${res.length} possible words`, text: res.slice(0, 120).join(', ') || 'None', note: 'Format: known letters with ? for unknown, +yellow letters, -gray letters, a@2 = “a is in the word but not position 2”. Example: wordle cr?n? +a -steil' });
  if (best.length > 2) ctx.add({ title: 'Best next guesses (cover common letters)', text: best.slice(0, 8).join(', ') });
}

// ------------------------------------------------------------ transforms
const splitWords = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean);
const CASES = {
  camel: (s) => splitWords(s).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join(''),
  pascal: (s) => splitWords(s).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(''),
  snake: (s) => splitWords(s).map(w => w.toLowerCase()).join('_'),
  kebab: (s) => splitWords(s).map(w => w.toLowerCase()).join('-'),
  constant: (s) => splitWords(s).map(w => w.toUpperCase()).join('_'),
  dot: (s) => splitWords(s).map(w => w.toLowerCase()).join('.'),
  sentence: (s) => s.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bi\b/g, 'I'),
  title: (s) => s.toLowerCase().replace(/\b[\w']+/g, (w, i) => (i && /^(?:a|an|the|and|but|or|for|nor|on|at|to|by|of|in|up|as|via|vs)$/.test(w) ? w : w[0].toUpperCase() + w.slice(1))),
  alternating: (s) => [...s].map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase())).join(''),
  inverse: (s) => [...s].map(c => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join(''),
  upper: (s) => s.toUpperCase(), lower: (s) => s.toLowerCase(),
};
function caseAll(ctx, s) {
  ctx.label('Case'); ctx.input(s.slice(0, 80));
  ctx.add({ title: 'All cases', table: Object.entries(CASES).map(([k, f]) => [k, f(s)]), copyRows: true });
}
const LINE_OPS = {
  'sort lines': (L) => [...L].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),
  'sort lines descending': (L) => [...L].sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })),
  'sort lines by length': (L) => [...L].sort((a, b) => a.length - b.length),
  'sort numbers': (L) => [...L].sort((a, b) => parseFloat(a) - parseFloat(b)),
  'remove duplicate lines': (L) => [...new Set(L)],
  'dedupe': (L) => [...new Set(L)],
  'reverse lines': (L) => [...L].reverse(),
  'shuffle lines': (L) => K.shuffle(L),
  'number lines': (L) => L.map((l, i) => `${i + 1}. ${l}`),
  'remove empty lines': (L) => L.filter(l => l.trim()),
  'trim lines': (L) => L.map(l => l.trim()),
  'join lines': (L) => [L.map(l => l.trim()).filter(Boolean).join(' ')],
  'add commas': (L) => [L.map(l => l.trim()).filter(Boolean).join(', ')],
  'quote lines': (L) => L.map(l => `"${l.replace(/"/g, '\\"')}"`),
  'lines to array': (L) => ['[' + L.map(l => JSON.stringify(l.trim())).join(', ') + ']'],
  'count duplicate lines': (L) => { const c = {}; L.forEach(l => (c[l] = (c[l] || 0) + 1)); return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([l, n]) => `${n}\t${l}`); },
};
const CLEAN = {
  'remove line breaks': (t) => t.replace(/-\n(?=[a-z])/g, '').replace(/\s*\n\s*/g, ' ').trim(),
  'fix pdf text': (t) => t.replace(/-\n(?=[a-z])/g, '').replace(/([^\n.!?:])\n(?=[a-z(])/g, '$1 ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(),
  'remove extra spaces': (t) => t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim(),
  'straight quotes': (t) => t.replace(/[‘’‚‛]/g, "'").replace(/[“”„‟]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...'),
  'smart quotes': (t) => t.replace(/(^|[\s(\[{])"/g, '$1“').replace(/"/g, '”').replace(/(^|[\s(\[{])'/g, '$1‘').replace(/'/g, '’').replace(/--/g, '—'),
  'remove accents': (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, ''),
  'strip html': (t) => new DOMParser().parseFromString(t, 'text/html').body.textContent,
  'remove punctuation': (t) => t.replace(/[^\w\s]|_/g, ''),
  'remove numbers': (t) => t.replace(/\d+/g, ''),
  'remove emojis': (t) => t.replace(/\p{Extended_Pictographic}|️|‍/gu, ''),
  'pig latin': (t) => t.replace(/[A-Za-z]+/g, (w) => { const m = /^([^aeiouAEIOU]*)(.*)$/.exec(w); const r = m[1] ? m[2] + m[1] + 'ay' : w + 'way'; return /^[A-Z]/.test(w) ? r[0].toUpperCase() + r.slice(1).toLowerCase() : r; }),
  'reverse words': (t) => t.split(/\s+/).reverse().join(' '),
  'upside down': (t) => { const f = 'abcdefghijklmnopqrstuvwxyz', u = 'ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz'; return [...t.toLowerCase()].reverse().map(c => (f.includes(c) ? u[f.indexOf(c)] : c === '?' ? '¿' : c === '!' ? '¡' : c === '.' ? '˙' : c)).join(''); },
  'markdown to html': (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/^# (.*)$/gm, '<h1>$1</h1>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>').replace(/^[-*] (.*)$/gm, '<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>\n${m}</ul>\n`).replace(/^(?!<[hul]|<li|$)(.+)$/gm, '<p>$1</p>'),
  'html to markdown': (t) => { const d = new DOMParser().parseFromString(t, 'text/html').body; const walk = (n) => [...n.childNodes].map(c => { if (c.nodeType === 3) return c.textContent; const i = walk(c), tag = c.tagName; return /^H[1-6]$/.test(tag) ? `\n${'#'.repeat(+tag[1])} ${i}\n` : tag === 'P' ? `\n${i}\n` : tag === 'STRONG' || tag === 'B' ? `**${i}**` : tag === 'EM' || tag === 'I' ? `*${i}*` : tag === 'CODE' ? '`' + i + '`' : tag === 'A' ? `[${i}](${c.getAttribute('href')})` : tag === 'LI' ? `- ${i}\n` : tag === 'BR' ? '\n' : i; }).join(''); return walk(d).replace(/\n{3,}/g, '\n\n').trim(); },
};
const EXTRACT = {
  emails: /[\w.+-]+@[\w-]+\.[\w.-]+/g,
  urls: /https?:\/\/[^\s<>"')\]]+/g,
  'phone numbers': /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  numbers: /-?\$?\d[\d,]*(?:\.\d+)?%?/g,
  hashtags: /#[\p{L}\d_]+/gu,
  mentions: /@[\w.]+/g,
  dates: /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d\d-\d\d|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{0,4})\b/gi,
  'ip addresses': /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  'capitalized names': /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g,
  'dollar amounts': /\$\s?\d[\d,]*(?:\.\d\d)?(?:\s?(?:million|billion|k|m|bn))?/gi,
  'quotes': /[“"]([^”"]{3,})[”"]/g,
};
function extract(ctx, kind, text) {
  const k = Object.keys(EXTRACT).find(x => x.startsWith(kind.toLowerCase().replace(/s?$/, ''))) || kind;
  const re = EXTRACT[k];
  const found = [...new Set(text.match(re) || [])];
  ctx.label('Extract'); ctx.input(`${k} from text`);
  ctx.add({ title: `${found.length} ${k}`, pre: found.join('\n') || '(none)' });
  if (found.length) ctx.add(K.filesPod(K.tableFiles(k.replace(/\s+/g, '-'), [K.cap(k)], found.map(x => [x]))));
}
const NATO = { a: 'Alfa', b: 'Bravo', c: 'Charlie', d: 'Delta', e: 'Echo', f: 'Foxtrot', g: 'Golf', h: 'Hotel', i: 'India', j: 'Juliett', k: 'Kilo', l: 'Lima', m: 'Mike', n: 'November', o: 'Oscar', p: 'Papa', q: 'Quebec', r: 'Romeo', s: 'Sierra', t: 'Tango', u: 'Uniform', v: 'Victor', w: 'Whiskey', x: 'X-ray', y: 'Yankee', z: 'Zulu', 0: 'Zero', 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Niner' };
function vigenere(t, key, dec) { key = key.toLowerCase().replace(/[^a-z]/g, ''); let j = 0; return t.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; const k = key.charCodeAt(j++ % key.length) - 97; return String.fromCharCode((c.charCodeAt(0) - b + (dec ? 26 - k : k)) % 26 + b); }); }
const atbash = (t) => t.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(25 - (c.charCodeAt(0) - b) + b); });
function letterFreq(ctx, t) {
  const L = t.toLowerCase().replace(/[^a-z]/g, ''); const c = {}; for (const ch of L) c[ch] = (c[ch] || 0) + 1;
  const EN = 'etaoinshrdlcumwfgypbvkjxqz';
  const rows = Object.entries(c).sort((a, b) => b[1] - a[1]);
  ctx.label('Letter frequency'); ctx.input(`${L.length} letters`);
  ctx.add({ title: 'Letters', plot: { kind: 'bar', x: rows.map(r => r[0]), y: rows.map(r => K.round(100 * r[1] / L.length, 2)) }, note: `English order is ${EN.toUpperCase()}. If a shift cipher, the top letter is probably E: shift ${(rows[0] ? (rows[0][0].charCodeAt(0) - 101 + 26) % 26 : 0)}.` });
  ctx.add({ title: 'Try', chips: [`caesar ${-((rows[0] ? (rows[0][0].charCodeAt(0) - 101 + 26) % 26 : 0))} ${t.slice(0, 200)}`, `brute force caesar ${t.slice(0, 200)}`] });
}

// ------------------------------------------------------------ numbers & encodings
const SMALL = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, a: 1 };
const BIG = { thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12, quadrillion: 1e15 };
function wordsToNum(s) {
  let total = 0, cur = 0, neg = false, dec = '';
  const parts = s.toLowerCase().replace(/-/g, ' ').replace(/,/g, '').split(/\s+/).filter(w => w && w !== 'and');
  const pi = parts.indexOf('point'); if (pi >= 0) { dec = parts.slice(pi + 1).map(w => SMALL[w]).join(''); parts.length = pi; }
  for (const w of parts) {
    if (w === 'minus' || w === 'negative') neg = true;
    else if (w in SMALL) cur += SMALL[w];
    else if (w === 'hundred') cur *= 100;
    else if (w in BIG) { total += cur * BIG[w]; cur = 0; }
    else if (/^\d+$/.test(w)) cur += +w;
    else return null;
  }
  const v = +(String(total + cur) + (dec ? '.' + dec : ''));
  return neg ? -v : v;
}
function ieee754(ctx, x) {
  const v = Number(x); const b64 = new DataView(new ArrayBuffer(8)); b64.setFloat64(0, v); const b32 = new DataView(new ArrayBuffer(4)); b32.setFloat32(0, v);
  const bits = (dv, n) => [...Array(n)].map((_, i) => dv.getUint8(i).toString(2).padStart(8, '0')).join('');
  const s32 = bits(b32, 4), s64 = bits(b64, 8);
  ctx.label('IEEE 754'); ctx.input(String(x));
  ctx.add({ title: 'Single precision (32-bit)', table: [['Sign', s32[0]], ['Exponent (8)', `${s32.slice(1, 9)} = ${parseInt(s32.slice(1, 9), 2)} − 127 = ${parseInt(s32.slice(1, 9), 2) - 127}`], ['Mantissa (23)', s32.slice(9)], ['Hex', '0x' + b32.getUint32(0).toString(16).toUpperCase().padStart(8, '0')], ['Stored value', String(b32.getFloat32(0))], ['Rounding error', String(b32.getFloat32(0) - v)]] });
  ctx.add({ title: 'Double precision (64-bit)', table: [['Sign', s64[0]], ['Exponent (11)', `${s64.slice(1, 12)} = ${parseInt(s64.slice(1, 12), 2)} − 1023 = ${parseInt(s64.slice(1, 12), 2) - 1023}`], ['Mantissa (52)', s64.slice(12)], ['Hex', '0x' + b64.getBigUint64(0).toString(16).toUpperCase().padStart(16, '0')], ['Exact stored value', v.toPrecision(21).replace(/0+$/, '')]] });
}
function twos(ctx, n, bits) {
  const B = BigInt(bits), mod = 1n << B; let v = BigInt(n);
  const min = -(1n << (B - 1n)), max = (1n << (B - 1n)) - 1n;
  if (v < min || v >= mod) throw new Error(`${n} doesn’t fit in ${bits} bits (signed range ${min} to ${max}).`);
  const u = ((v % mod) + mod) % mod; const bin = u.toString(2).padStart(bits, '0');
  const signed = u > max ? u - mod : u;
  ctx.label('Two’s complement'); ctx.input(`${n} in ${bits} bits`);
  ctx.add({ title: 'Binary', big: true, mono: true, text: bin.replace(/(.{4})(?=.)/g, '$1 ') });
  ctx.add({ title: 'Details', table: [['Hex', '0x' + u.toString(16).toUpperCase().padStart(bits / 4, '0')], ['As unsigned', u.toString()], ['As signed', signed.toString()], ['Signed range', `${min} to ${max}`], ['Unsigned range', `0 to ${mod - 1n}`], ['How (negatives)', 'Write |n| in binary, flip every bit, add 1']] });
}
function bitwise(ctx, a, op, b) {
  const A = BigInt(a), Bn = BigInt(b); const o = op.toLowerCase();
  const r = o === 'and' || o === '&' ? A & Bn : o === 'or' || o === '|' ? A | Bn : o === 'xor' || o === '^' ? A ^ Bn : o === '<<' || o === 'shl' ? A << Bn : o === '>>' || o === 'shr' ? A >> Bn : o === 'nand' ? ~(A & Bn) : o === 'nor' ? ~(A | Bn) : null;
  if (r == null) return false;
  const w = Math.max(A.toString(2).length, Bn.toString(2).length, r >= 0n ? r.toString(2).length : 8);
  const pad = (x) => (x < 0n ? x.toString() : x.toString(2).padStart(w, '0'));
  ctx.label('Bitwise'); ctx.input(`${a} ${op.toUpperCase()} ${b}`);
  ctx.add({ title: 'Result', big: true, text: `${r} (0x${(r < 0n ? r : r).toString(16)})` });
  ctx.add({ title: 'In binary', pre: `  ${pad(A)}  (${a})\n${op.padEnd(2)}${pad(Bn)}  (${b})\n  ${'-'.repeat(w)}\n  ${pad(r)}` });
}
function luhn(ctx, s) {
  const d = s.replace(/\D/g, ''); let sum = 0;
  for (let i = 0; i < d.length; i++) { let x = +d[d.length - 1 - i]; if (i % 2) { x *= 2; if (x > 9) x -= 9; } sum += x; }
  const ok = sum % 10 === 0;
  let check = 0; { let s2 = 0; for (let i = 0; i < d.length; i++) { let x = +d[d.length - 1 - i]; if (i % 2 === 0) { x *= 2; if (x > 9) x -= 9; } s2 += x; } check = (10 - s2 % 10) % 10; }
  const brand = /^4/.test(d) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(d) ? 'Mastercard' : /^3[47]/.test(d) ? 'American Express' : /^6(011|5)/.test(d) ? 'Discover' : /^97[89]/.test(d) && d.length === 13 ? 'ISBN-13 (uses a different check)' : '—';
  ctx.label('Luhn check'); ctx.input(d.replace(/(\d{4})(?=\d)/g, '$1 '));
  ctx.add({ title: ok ? 'Valid checksum' : 'Invalid checksum', big: true, error: !ok, text: ok ? 'Passes the Luhn check.' : 'Fails the Luhn check (typo?).' });
  ctx.add({ title: 'Details', table: [['Digits', d.length], ['Card network (by prefix)', brand], ['Check digit to append to this number', check]], note: 'Only checks the math. It says nothing about whether an account exists.' });
}
function crc32(str) { let c, crc = 0xFFFFFFFF; const T = crc32.t ||= Array.from({ length: 256 }, (_, n) => { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }); for (const b of new TextEncoder().encode(str)) crc = T[(crc ^ b) & 0xFF] ^ (crc >>> 8); return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0'); }
function md5(str) { // compact RFC 1321
  const s = unescape(encodeURIComponent(str)); const k = [], r = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476;
  const bytes = [...s].map(c => c.charCodeAt(0)); const bl = bytes.length * 8; bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 0; i < 8; i++) bytes.push(Math.floor(bl / 2 ** (8 * i)) & 0xff);
  for (let o = 0; o < bytes.length; o += 64) {
    const w = []; for (let i = 0; i < 16; i++) w[i] = bytes[o + i * 4] | (bytes[o + i * 4 + 1] << 8) | (bytes[o + i * 4 + 2] << 16) | (bytes[o + i * 4 + 3] << 24);
    let a = h0, b = h1, c = h2, d = h3;
    for (let i = 0; i < 64; i++) { let f, g; if (i < 16) { f = (b & c) | (~b & d); g = i; } else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; } else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; } else { f = c ^ (b | ~d); g = (7 * i) % 16; } const t = d; d = c; c = b; const x = (a + f + k[i] + w[g]) | 0; b = (b + ((x << r[i]) | (x >>> (32 - r[i])))) | 0; a = t; }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
  }
  return [h0, h1, h2, h3].map(v => [0, 8, 16, 24].map(sh => ((v >>> sh) & 0xff).toString(16).padStart(2, '0')).join('')).join('');
}
async function hmac(ctx, algo, key, msg) {
  const a = { sha1: 'SHA-1', sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' }[algo.toLowerCase().replace('-', '')] || 'SHA-256';
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: a }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)));
  ctx.label('HMAC'); ctx.input(`HMAC-${a}`);
  ctx.add({ title: 'Hex', mono: true, text: [...sig].map(b => b.toString(16).padStart(2, '0')).join('') });
  ctx.add({ title: 'Base64', mono: true, text: btoa(String.fromCharCode(...sig)) });
}
function baseAny(ctx, n, from, to) {
  const D = '0123456789abcdefghijklmnopqrstuvwxyz';
  let v = 0n; for (const ch of n.toLowerCase()) { const d = D.indexOf(ch); if (d < 0 || d >= from) throw new Error(`“${ch}” isn’t a digit in base ${from}.`); v = v * BigInt(from) + BigInt(d); }
  let out = ''; let x = v; if (x === 0n) out = '0'; while (x > 0n) { out = D[Number(x % BigInt(to))] + out; x /= BigInt(to); }
  ctx.label('Base conversion'); ctx.input(`${n} (base ${from}) → base ${to}`);
  ctx.add({ title: `Base ${to}`, big: true, mono: true, text: out.toUpperCase() });
  ctx.add({ title: 'Also', table: [['Decimal', v.toString()], ['Binary', v.toString(2)], ['Octal', v.toString(8)], ['Hex', v.toString(16).toUpperCase()], ['Base 36', v.toString(36)]] });
}

// ------------------------------------------------------------ color & CSS
function parseColor(s) {
  s = s.trim().toLowerCase();
  let m;
  if ((m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s))) { let h = m[1]; if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
  if ((m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(s))) return [+m[1], +m[2], +m[3]];
  if ((m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/.exec(s))) return hsl2rgb(+m[1], +m[2], +m[3]);
  const c = document.createElement('canvas').getContext('2d'); c.fillStyle = '#010203'; c.fillStyle = s; if (c.fillStyle === '#010203' && s !== '#010203') return null; return parseColor(c.fillStyle);
}
function hsl2rgb(h, s, l) { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l); return [0, 8, 4].map(n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))))); }
function rgb2hsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]; }
const hex = (rgb) => '#' + rgb.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
const lum = (rgb) => { const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
function contrast(ctx, a, b) {
  const A = parseColor(a), B = parseColor(b); if (!A || !B) throw new Error('Couldn’t read one of the colors.');
  const r = (Math.max(lum(A), lum(B)) + 0.05) / (Math.min(lum(A), lum(B)) + 0.05);
  const p = (x) => (x ? 'Pass ✓' : 'Fail ✗');
  ctx.label('Contrast'); ctx.input(`${hex(A)} on ${hex(B)}`);
  ctx.add({ title: 'Contrast ratio', big: true, text: `${fmt(r, 2)} : 1`, custom: (el) => { const d = document.createElement('div'); d.style.cssText = `background:${hex(B)};color:${hex(A)};padding:14px;border-radius:8px;font-size:18px`; d.innerHTML = 'Sample text <b>bold</b> <small>small</small>'; el.append(d); } });
  ctx.add({ title: 'WCAG 2', table: { head: ['Use', 'AA', 'AAA'], rows: [['Normal text', p(r >= 4.5), p(r >= 7)], ['Large text (18pt / 14pt bold)', p(r >= 3), p(r >= 4.5)], ['UI components & graphics', p(r >= 3), '—']] } });
}
function palette(ctx, s, kind) {
  const c = parseColor(s); if (!c) throw new Error('Couldn’t read that color.');
  const [h, S, L] = rgb2hsl(c);
  const rot = (d) => hex(hsl2rgb((h + d + 360) % 360, S, L));
  const sets = { complementary: [0, 180], triadic: [0, 120, 240], tetradic: [0, 90, 180, 270], analogous: [-30, 0, 30], 'split complementary': [0, 150, 210] };
  const rows = [];
  for (const [k, ds] of Object.entries(sets)) if (!kind || kind.startsWith(k.split(' ')[0])) rows.push([k, ds.map(rot)]);
  rows.push(['tints', [0.15, 0.3, 0.45, 0.6, 0.75].map(t => hex(c.map(x => x + (255 - x) * t)))]);
  rows.push(['shades', [0.15, 0.3, 0.45, 0.6, 0.75].map(t => hex(c.map(x => x * (1 - t))))]);
  rows.push(['monochrome', [20, 35, 50, 65, 80].map(l => hex(hsl2rgb(h, S, l)))]);
  ctx.label('Palette'); ctx.input(hex(c));
  ctx.add({ title: 'Palettes', custom: (el) => { for (const [k, cols] of rows) { const r = document.createElement('div'); r.className = 'pal-row'; const lab = document.createElement('span'); lab.textContent = k; lab.className = 'pal-lab'; r.append(lab); cols.forEach(x => { const b = document.createElement('button'); b.className = 'pal-sw'; b.style.background = x; b.title = x; b.textContent = x; b.style.color = lum(parseColor(x)) > 0.4 ? '#000' : '#fff'; b.onclick = () => navigator.clipboard.writeText(x); r.append(b); }); el.append(r); } } });
  const css = ':root {\n' + rows.flatMap(([k, cols]) => cols.map((x, i) => `  --${k.replace(/\s+/g, '-')}-${i + 1}: ${x};`)).join('\n') + '\n}';
  ctx.add({ title: 'CSS variables', pre: css });
  ctx.add(K.filesPod([{ label: 'palette.css', name: 'palette.css', mime: 'text/css', data: css }, { label: 'palette.json', name: 'palette.json', mime: 'application/json', data: JSON.stringify(Object.fromEntries(rows), null, 2) }]));
}
function colorConvert(ctx, s) {
  const c = parseColor(s); if (!c) return false;
  const [h, S, L] = rgb2hsl(c);
  const k = 1 - Math.max(...c) / 255; const cmyk = k >= 1 ? [0, 0, 0, 100] : [...c.map(x => Math.round(100 * (1 - x / 255 - k) / (1 - k))), Math.round(100 * k)];
  const v = Math.max(...c) / 255, sv = v ? (v - Math.min(...c) / 255) / v : 0;
  ctx.label('Color'); ctx.input(s);
  ctx.add({ title: hex(c), swatch: hex(c), table: [['HEX', hex(c)], ['RGB', `rgb(${c.join(', ')})`], ['HSL', `hsl(${h}, ${S}%, ${L}%)`], ['HSV/HSB', `${h}°, ${Math.round(sv * 100)}%, ${Math.round(v * 100)}%`], ['CMYK', cmyk.map(x => x + '%').join(', ')], ['RGB 0–1', c.map(x => K.round(x / 255, 3)).join(', ')], ['Luminance', fmt(lum(c), 3)], ['Text on it', lum(c) > 0.179 ? 'black' : 'white'], ['LaTeX', `\\definecolor{mycolor}{HTML}{${hex(c).slice(1).toUpperCase()}}`]], copyRows: false });
  ctx.add({ title: 'More', chips: [`palette ${hex(c)}`, `contrast ${hex(c)} on white`, `contrast ${hex(c)} on black`] });
}

export const TEXT_RULES = [
  [/^(?:check (?:my )?grammar|grammar check|proofread|fix (?:my )?grammar|correct (?:my )?(?:grammar|writing))\s*(?:of|in|for)?\s*:?\s*([\s\S]{3,})$/i, (c, m, q, d) => grammar(c, m[1].trim(), d)],
  [/^(?:spell ?check|check (?:my )?spelling)\s*:?\s*([\s\S]+)$/i, async (c, m, q, d) => { const { correct } = await import('./spell.js'); const out = await correct(m[1]); c.label('Spelling'); c.input(m[1].slice(0, 80)); const a = m[1].split(/\s+/), b = out.split(/\s+/); const ch = a.map((w, i) => (w !== b[i] ? [w, b[i]] : null)).filter(Boolean); c.add({ title: ch.length ? `${ch.length} likely misspelling${ch.length > 1 ? 's' : ''}` : 'No misspellings found', table: ch.length ? { head: ['Written', 'Suggested'], rows: ch } : undefined, text: ch.length ? undefined : 'Every word is in the dictionary.' }); if (ch.length) c.add({ title: 'Corrected', text: out }); c.add({ title: 'Deeper check', chips: ['check grammar: ' + m[1].slice(0, 1000)] }); }],
  [/^(?:readability|reading level|grade level|flesch(?:[- ]kincaid)?)\s*(?:of|for)?\s*:?\s*([\s\S]{60,})$/i, (c, m) => readability(c, m[1])],
  [/^(?:style check|check (?:my )?style|wordiness|passive voice(?: check)?|improve (?:my )?writing|writing feedback)\s*:?\s*([\s\S]{40,})$/i, (c, m) => styleCheck(c, m[1])],
  [/^(?:word frequency|word freq|keyword density|most common words|frequency of words|word cloud)\s*(?:in|of)?\s*:?\s*([\s\S]{20,})$/i, (c, m) => wordFreq(c, m[1], 1)],
  [/^(bigrams?|trigrams?|(\d)-?grams?|n-?grams?|common phrases)\s*(?:in|of)?\s*:?\s*([\s\S]{20,})$/i, (c, m) => wordFreq(c, m[3], /^bi/i.test(m[1]) || /^n|common/i.test(m[1]) ? 2 : /^tri/i.test(m[1]) ? 3 : +m[2])],
  [/^(?:compare texts?|text similarity|similarity|how similar are|plagiarism check|paraphrase check)\s*:?\s*([\s\S]+?)\s*(?:\n-{3,}\n|\|\|\||\n\s*vs\.?\s*\n|\s+---\s+)\s*([\s\S]+)$/i, (c, m) => similarity(c, m[1], m[2])],
  [/^(?:flash ?cards?|make flash ?cards?|study cards?|anki|quizlet)\s*(?:from|for)?\s*:?\s*([\s\S]+)$/i, (c, m) => flashcards(c, m[1])],
  [/^(?:quiz me|make a quiz|practice quiz|multiple choice quiz|test me)\s*(?:on|from)?\s*:?\s*([\s\S]+\n[\s\S]+)$/i, (c, m) => quizMe(c, m[1])],
  [/^(?:matching game|match game|matching)\s*:?\s*([\s\S]+)$/i, (c, m) => matching(c, m[1])],
  [/^(?:cloze|fill in the blanks?|fill-in-the-blank|make blanks|blank out)\s*(?:from|for|quiz)?\s*:?\s*([\s\S]{60,})$/i, (c, m) => cloze(c, m[1])],
  [/^(?:unscramble|words from|words (?:i can make )?(?:with|using) (?:the )?letters|scrabble|words with letters)\s+([a-z?]{2,15})$/i, (c, m) => anagrams(c, m[1], 'sub')],
  [/^(?:anagrams?|anagram of|anagrams of)\s+([a-z?]{2,15})$/i, (c, m) => anagrams(c, m[1], 'exact')],
  [/^(?:crossword|crossword help|words matching|pattern|match pattern)\s+([a-z?_.*]{2,20})$/i, (c, m) => pattern(c, m[1], 'Crossword')],
  [/^(?:(\d+)[- ]letter\s+)?words\s+(starting with|beginning with|that start with|ending (?:in|with)|that end (?:in|with)|containing|that contain|with|without)\s+["“]?([a-z]+)["”]?(?:\s+(?:that are\s+)?(\d+)\s+letters?(?:\s+long)?)?$/i, (c, m) => wordFilter(c, /start|begin/i.test(m[2]) ? 'start' : /end/i.test(m[2]) ? 'end' : /without/i.test(m[2]) ? 'without' : 'contain', m[3], m[1] || m[4])],
  [/^wordle(?: helper| solver)?\s+(.+)$/i, (c, m) => wordle(c, m[1])],
  [/^(?:syllables?|count syllables|how many syllables)\s+(?:in\s+|are in\s+)?["“]?([a-z' -]+?)["”]?(?:\s+have)?$/i, (c, m) => { const w = m[1].trim().split(/\s+/); c.label('Syllables'); c.input(m[1]); c.add({ title: 'Syllables', big: true, text: String(K.sum(w.map(syllables))), table: w.length > 1 ? w.map(x => [x, syllables(x)]) : undefined, note: 'Estimated by vowel groups; a few words (e.g. “fire”, “poem”) vary by accent.' }); }],
  [/^(?:is\s+)?["“]?(.+?)["”]?\s+(?:a\s+)?palindrome\??$|^palindrome\s+(?:check\s+)?(.+)$/i, (c, m) => { const t = (m[1] || m[2]); const s = t.toLowerCase().replace(/[^a-z0-9]/g, ''); const ok = s.length > 1 && s === [...s].reverse().join(''); c.label('Palindrome'); c.input(t); c.add({ title: ok ? 'Yes, it’s a palindrome' : 'Not a palindrome', big: true, text: ok ? `Reads “${s}” both ways (ignoring spaces, case and punctuation).` : `Backwards: “${[...t].reverse().join('')}”` }); }],
  [/^acronym\s+(?:for|of)\s+(.+)$/i, (c, m) => { const W = m[1].split(/\s+/); c.label('Acronym'); c.input(m[1]); c.add({ title: 'Acronym', big: true, text: W.filter(w => !STOP.has(w.toLowerCase()) || W.length < 3).map(w => w[0].toUpperCase()).join(''), note: `Every word: ${W.map(w => w[0].toUpperCase()).join('')}` }); }],
  // transforms
  [/^(?:all cases|case convert(?:er)?|convert case|cases)\s*:?\s*(.+)$/i, (c, m) => caseAll(c, m[1])],
  [/^(camel ?case|pascal ?case|snake ?case|kebab ?case|constant ?case|screaming snake case|dot ?case|sentence case|alternating case|spongebob case|inverse case|title case)\s*:?\s*([\s\S]+)$/i, (c, m) => { const k = m[1].toLowerCase().replace(/\s*case/, '').replace(/\s+/g, '').replace('screamingsnake', 'constant').replace('spongebob', 'alternating'); const f = CASES[k]; if (!f) return false; c.label('Case'); c.input(m[1]); c.add({ title: K.cap(m[1]), mono: true, big: m[2].length < 60, text: f(m[2]) }); }],
  [new RegExp(`^(${Object.keys(LINE_OPS).join('|')})\\s*:?\\s*\\n?([\\s\\S]+)$`, 'i'), (c, m) => { const L = m[2].split('\n'); const out = LINE_OPS[m[1].toLowerCase()](L); c.label('Lines'); c.input(`${m[1]} (${L.length} lines → ${out.length})`); c.add({ title: 'Result', pre: out.join('\n') }); c.add(K.filesPod([{ label: '.txt', name: 'lines.txt', mime: 'text/plain', data: out.join('\n') }])); }],
  [new RegExp(`^(${Object.keys(CLEAN).join('|')})\\s*(?:from|in|of)?\\s*:?\\s*([\\s\\S]+)$`, 'i'), (c, m) => { const out = CLEAN[m[1].toLowerCase()](m[2]); c.label('Text'); c.input(m[1]); c.add({ title: 'Result', pre: out }); }],
  [/^(?:replace|find and replace|swap)\s+["“]?(.+?)["”]?\s+with\s+["“]?(.*?)["”]?\s+in\s*:?\s*([\s\S]+)$/i, (c, m) => { const re = /^\/(.+)\/([gimsu]*)$/.exec(m[1]); const pat = re ? new RegExp(re[1], re[2].includes('g') ? re[2] : re[2] + 'g') : new RegExp(m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'); const n = (m[3].match(pat) || []).length; c.label('Replace'); c.input(`“${m[1]}” → “${m[2]}” (${n} replaced)`); c.add({ title: 'Result', pre: m[3].replace(pat, m[2]) }); }],
  [/^(?:extract|find all|get all|pull out|list all)\s+(?:the\s+)?(emails?|urls?|links?|phone numbers?|numbers?|hashtags?|mentions?|dates?|ip addresses?|capitalized names?|names|dollar amounts?|money|quotes?)\s+(?:from|in)\s*:?\s*([\s\S]+)$/i, (c, m) => extract(c, m[1].replace(/^links?$/i, 'urls').replace(/^names$/i, 'capitalized names').replace(/^money$/i, 'dollar amounts'), m[2])],
  [/^(?:nato|phonetic|nato alphabet|spell (?:it )?phonetically)\s*:?\s*(.*)$/i, (c, m) => { c.label('NATO alphabet'); if (!m[1].trim()) { c.add({ title: 'NATO phonetic alphabet', table: Object.entries(NATO).map(([k, v]) => [k.toUpperCase(), v]) }); return; } c.input(m[1]); c.add({ title: 'Spelled out', text: [...m[1].toLowerCase()].map(ch => NATO[ch] || (ch === ' ' ? '(space)' : ch)).join(' · ') }); }],
  [/^vigen[eè]re\s+(encrypt|decrypt|encode|decode)\s+(?:key\s+)?["“]?(\w+)["”]?\s*:?\s+(.+)$/i, (c, m) => { c.label('Cipher'); c.input(`Vigenère, key “${m[2]}”`); c.add({ title: 'Result', big: true, mono: true, text: vigenere(m[3], m[2], /de/i.test(m[1])) }); }],
  [/^atbash\s+(.+)$/i, (c, m) => { c.label('Cipher'); c.input('Atbash'); c.add({ title: 'Result', big: true, mono: true, text: atbash(m[1]) }); }],
  [/^(?:brute ?force caesar|crack caesar|decode caesar|all caesar shifts)\s+(.+)$/i, (c, m) => { const sh = (t, k) => t.replace(/[a-z]/gi, (ch) => { const b = ch <= 'Z' ? 65 : 97; return String.fromCharCode((ch.charCodeAt(0) - b + k) % 26 + b); }); c.label('Cipher'); c.input('All 25 Caesar shifts'); const E = 'etaoinshr'; const rows = Array.from({ length: 25 }, (_, i) => { const t = sh(m[1], 26 - (i + 1)); const sc = [...t.toLowerCase()].filter(ch => E.includes(ch)).length; return [i + 1, t, sc]; }); const best = [...rows].sort((a, b) => b[2] - a[2])[0]; c.add({ title: 'Most English-looking', big: true, text: `Shift ${best[0]}: ${best[1]}` }); c.add({ title: 'All shifts', table: { head: ['Shift', 'Text'], rows: rows.map(r => [r[0], r[1]]) } }); }],
  [/^(?:letter frequency|frequency analysis|character frequency)\s*:?\s*([\s\S]+)$/i, (c, m) => letterFreq(c, m[1])],
  // numbers & encodings
  [/^(?:convert\s+)?(?:words to number|number from words|as a number|in digits)\s*:?\s*([a-z ,-]+)$|^([a-z][a-z ,-]*(?:hundred|thousand|million|billion|trillion|teen|ty|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?: point(?: [a-z]+)+)?)\s+(?:in digits|as a number|in numbers|to number)$/i, (c, m) => { const v = wordsToNum(m[1] || m[2]); if (v == null || isNaN(v)) return false; c.label('Number'); c.input(m[1] || m[2]); c.add({ title: 'In digits', big: true, text: v.toLocaleString('en-US', { maximumFractionDigits: 10 }) }); }],
  [/^(?:ieee ?754|float(?:ing point)? (?:representation|bits)(?: of)?|floating point)\s+(-?[\d.e+-]+|nan|infinity)$/i, (c, m) => ieee754(c, m[1])],
  [/^(?:two'?s|2'?s) complement\s+(?:of\s+)?(-?\d+)(?:\s+(?:in\s+)?(\d+)[- ]?bits?)?$/i, (c, m) => twos(c, m[1], +(m[2] || 8))],
  [/^(-?\d+)\s+(and|or|xor|nand|nor|<<|>>|shl|shr|&|\||\^)\s+(-?\d+)(?:\s+bitwise)?$|^bitwise\s+(-?\d+)\s+(and|or|xor|nand|nor|<<|>>|&|\||\^)\s+(-?\d+)$/i, (c, m) => (/\bbitwise\b|<<|>>|[&|^]|xor|nand|nor|shl|shr/i.test(m[0]) ? bitwise(c, m[1] || m[4], m[2] || m[5], m[3] || m[6]) : false)],
  [/^(?:luhn(?: check)?|validate (?:credit )?card(?: number)?|check digit|is this a valid card number)\s*:?\s*([\d -]{8,25})$/i, (c, m) => luhn(c, m[1])],
  [/^crc-?32\s+([\s\S]+)$/i, (c, m) => { c.label('CRC-32'); c.add({ title: 'CRC-32', big: true, mono: true, text: crc32(m[1]) }); }],
  [/^md5\s+([\s\S]+)$/i, (c, m) => { c.label('MD5'); c.add({ title: 'MD5', big: true, mono: true, text: md5(m[1]), note: 'MD5 is broken for security. Use it only for checksums; use SHA-256 for anything else.' }); }],
  [/^hmac[- ]?(sha-?1|sha-?256|sha-?384|sha-?512)?\s+(?:key\s+)?["“]?(\S+?)["”]?\s+(?:message\s+|msg\s+)?:?\s*([\s\S]+)$/i, (c, m) => hmac(c, m[1] || 'sha256', m[2], m[3])],
  [/^(?:convert\s+)?([0-9a-z]+)\s+(?:from\s+)?base\s*(\d{1,2})\s+to\s+base\s*(\d{1,2})$/i, (c, m) => (+m[2] >= 2 && +m[2] <= 36 && +m[3] >= 2 && +m[3] <= 36 ? baseAny(c, m[1], +m[2], +m[3]) : false)],
  [/^(?:unicode|char(?:acter)? info|what character is|code point(?: of)?)\s+(?:u\+([0-9a-f]{2,6})|(.{1,4}))$/i, (c, m) => { const ch = m[1] ? String.fromCodePoint(parseInt(m[1], 16)) : [...m[2]][0]; const cp = ch.codePointAt(0); const u8 = [...new TextEncoder().encode(ch)]; c.label('Unicode'); c.input(ch); c.add({ title: ch, big: true, table: [['Code point', 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')], ['Decimal', cp], ['UTF-8 bytes', u8.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')], ['UTF-16', [...Array(ch.length)].map((_, i) => ch.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')).join(' ')], ['HTML', `&#${cp}; or &#x${cp.toString(16)};`], ['CSS', `\\${cp.toString(16)}`], ['JavaScript', cp > 0xffff ? `\\u{${cp.toString(16)}}` : `\\u${cp.toString(16).padStart(4, '0')}`], ['Python', `\\U${cp.toString(16).padStart(8, '0')}`], ['Category', /\p{L}/u.test(ch) ? 'Letter' : /\p{N}/u.test(ch) ? 'Number' : /\p{P}/u.test(ch) ? 'Punctuation' : /\p{S}/u.test(ch) ? 'Symbol' : /\p{Extended_Pictographic}/u.test(ch) ? 'Emoji' : 'Other']] }); }],
  // colors & CSS
  [/^(?:contrast(?: ratio)?|color contrast|wcag contrast)\s+(?:of\s+|between\s+)?(.+?)\s+(?:on|and|vs\.?|against|with)\s+(.+)$/i, (c, m) => contrast(c, m[1], m[2])],
  [/^(?:(complementary|triadic|tetradic|analogous|split complementary)\s+)?(?:colou?r\s+)?(?:palette|scheme|colors?)\s+(?:for|from|of)\s+(.+)$/i, (c, m) => palette(c, m[2], m[1] && m[1].toLowerCase())],
  [/^(?:convert\s+)?(?:colou?r\s+)?(#?[0-9a-f]{6}|#?[0-9a-f]{3}|rgb\([^)]+\)|hsl\([^)]+\))\s+(?:to|in)\s+(?:rgb|hsl|hex|cmyk|hsv|all)$/i, (c, m) => colorConvert(c, m[1])],
  [/^([\d.]+)\s*(px|rem|em|pt)\s+(?:to|in)\s+(px|rem|em|pt)(?:\s+(?:at|with|base)\s+([\d.]+)\s*px)?$/i, (c, m) => { const base = +(m[4] || 16), v = +m[1]; const px = m[2] === 'pt' ? v * 4 / 3 : /r?em/.test(m[2]) ? v * base : v; const out = m[3] === 'pt' ? px * 0.75 : /r?em/.test(m[3]) ? px / base : px; c.label('CSS units'); c.input(`${m[1]}${m[2]} → ${m[3]} (base ${base}px)`); c.add({ title: 'Result', big: true, text: `${K.round(out, 4)}${m[3]}` }); c.add({ title: 'Common', table: { head: ['px', 'rem', 'pt'], rows: [10, 12, 14, 16, 18, 20, 24, 32, 48].map(p => [p, K.round(p / base, 4), K.round(p * 0.75, 2)]) } }); }],
  [/^(?:aspect ratio|ratio)\s+(?:of\s+)?(\d+)\s*[x×:]\s*(\d+)(?:\s+(?:at|to|with)\s+(width|height)\s+(\d+))?$|^resize\s+(\d+)\s*[x×]\s*(\d+)\s+to\s+(width|height)\s+(\d+)$/i, (c, m) => { const w = +(m[1] || m[5]), h = +(m[2] || m[6]); const g = (a, b) => (b ? g(b, a % b) : a); const d = g(w, h); c.label('Aspect ratio'); c.input(`${w} × ${h}`); c.add({ title: 'Ratio', big: true, text: `${w / d}:${h / d}  (${fmt(w / h, 4)}:1)` }); const which = m[3] || m[7], val = +(m[4] || m[8]); if (which) c.add({ title: 'Resized', big: true, text: which.toLowerCase() === 'width' ? `${val} × ${Math.round(val * h / w)}` : `${Math.round(val * w / h)} × ${val}` }); c.add({ title: 'Same ratio', table: { head: ['Width', 'Height'], rows: [320, 640, 1280, 1920, 2560, 3840].map(x => [x, K.round(x * h / w, 1)]) } }); }],
];
export const TEXT_FEATURES = ['Grammar check (LanguageTool rules)', 'Spell check', 'Readability: 6 formulas + grade', 'Style check: wordiness, passive voice, adverbs, repetition', 'Word frequency + CSV/Excel', 'Bigrams/trigrams/n-grams', 'Text similarity + matching passages', 'Flashcards (interactive) → Anki/Quizlet/Excel', 'Multiple-choice self-quiz + printable key', 'Matching game', 'Cloze/fill-in-the-blank from notes → Anki cloze', 'Unscramble + Scrabble scores', 'Anagrams', 'Crossword pattern search', 'Words starting/ending/containing/without', 'Wordle helper', 'Syllable counter', 'Palindrome check', 'Acronym maker', '12 case styles (camel, snake, kebab…)', '16 line tools (sort, dedupe, shuffle, number…)', '15 cleanups (fix PDF text, quotes, accents, HTML, pig latin, Markdown ⇄ HTML…)', 'Find and replace (incl. regex)', 'Extract emails/URLs/phones/numbers/dates/hashtags/names/money/quotes', 'NATO alphabet', 'Vigenère cipher', 'Atbash cipher', 'Caesar brute force', 'Letter frequency analysis', 'Words → number', 'IEEE 754 floats', 'Two’s complement', 'Bitwise operations', 'Luhn check digit', 'CRC-32', 'MD5', 'HMAC', 'Any base 2–36 conversion', 'Unicode character info', 'WCAG contrast checker', 'Color palettes (8 kinds) + CSS', 'Color conversions (HEX/RGB/HSL/HSV/CMYK/LaTeX)', 'px/rem/em/pt', 'Aspect ratio + resize'];
