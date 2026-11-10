// Research: citations in 9 styles from a DOI, ISBN or web page, a saved bibliography, and
// OpenAlex-powered paper/journal/institution/topic analytics; open data and media searches;
// search-query builders and study/writing templates.
import * as K from './kit.js';
const { enc, fmt } = K;
const strip = (h) => (h ? new DOMParser().parseFromString(h, 'text/html').body.textContent.replace(/\s+/g, ' ').trim() : '');
const short = (s, n = 220) => (s && s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s || '');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ============================================================ citation records → styles
// rec: {type:'article'|'book'|'web'|'chapter', authors:[{given,family}], title, container, year, month, day, volume, issue, pages, doi, url, publisher, place, edition, isbn, accessed}
const ini = (g) => (g || '').split(/[\s-]+/).filter(Boolean).map(x => x[0].toUpperCase() + '.').join(' ');
const full = (a) => `${a.given} ${a.family}`.trim();
const titleCase = (s) => s.replace(/\w\S*/g, (w, i) => (i && /^(?:a|an|the|and|but|or|for|nor|on|at|to|by|of|in|up|as)$/i.test(w) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1)));
const sentenceCase = (s) => s; // titles are kept as published; APA prefers sentence case, which can't be done reliably without knowing proper nouns
function apa(r) {
  const A = r.authors.length > 20 ? r.authors.slice(0, 19).concat([r.authors[r.authors.length - 1]]) : r.authors;
  const names = A.map(a => (a.given ? `${a.family}, ${ini(a.given)}` : a.family));
  const au = names.length === 0 ? '' : names.length === 1 ? names[0] : names.length === 2 ? `${names[0]}, & ${names[1]}` : names.slice(0, -1).join(', ') + ', & ' + names[names.length - 1];
  const date = r.type === 'web' && r.month ? `${r.year || 'n.d.'}, ${MONTHS[r.month - 1]}${r.day ? ' ' + r.day : ''}` : (r.year || 'n.d.');
  const link = r.doi ? `https://doi.org/${r.doi}` : r.url || '';
  if (r.type === 'book') return `${au ? au + ' ' : ''}(${date}). *${sentenceCase(r.title)}*${r.edition ? ` (${r.edition} ed.)` : ''}. ${r.publisher || ''}.${link ? ' ' + link : ''}`.replace(/\.\./g, '.');
  if (r.type === 'web') return au ? `${au} (${date}). *${r.title}*. ${r.container ? r.container + '. ' : ''}${link}` : `${r.container || r.title}. (${date}). *${r.title}*. ${link}`.replace(/^(.+?)\. \((.+?)\)\. \*\1\*\. /, '*$1*. ($2). ');
  return `${au ? au + ' ' : ''}(${date}). ${sentenceCase(r.title)}. *${r.container || ''}*${r.volume ? `, *${r.volume}*` : ''}${r.issue ? `(${r.issue})` : ''}${r.pages ? `, ${r.pages}` : ''}.${link ? ' ' + link : ''}`;
}
function mla(r) {
  const a = r.authors;
  const au = !a.length ? '' : a.length === 1 ? `${a[0].family}${a[0].given ? ', ' + a[0].given : ''}` : a.length === 2 ? `${a[0].family}, ${a[0].given}, and ${full(a[1])}` : `${a[0].family}, ${a[0].given}, et al`;
  const link = r.doi ? `https://doi.org/${r.doi}` : (r.url || '').replace(/^https?:\/\//, '');
  if (r.type === 'book') return `${au ? au + '. ' : ''}*${titleCase(r.title)}*. ${r.edition ? r.edition + ' ed., ' : ''}${r.publisher || ''}, ${r.year || 'n.d.'}.`;
  if (r.type === 'web') return `${au ? au + '. ' : ''}“${titleCase(r.title)}.” *${r.container || ''}*, ${r.day ? r.day + ' ' : ''}${r.month ? MONTHS[r.month - 1].slice(0, 3) + '. ' : ''}${r.year || ''}, ${link}.${r.accessed ? ` Accessed ${r.accessed}.` : ''}`.replace(/\*\*, /, '').replace(/, ,/g, ',');
  return `${au ? au + '. ' : ''}“${titleCase(r.title)}.” *${r.container || ''}*${r.volume ? `, vol. ${r.volume}` : ''}${r.issue ? `, no. ${r.issue}` : ''}, ${r.year || 'n.d.'}${r.pages ? `, pp. ${r.pages}` : ''}${link ? ', ' + link : ''}.`;
}
function chicago(r) {
  const a = r.authors;
  const au = !a.length ? '' : a.length === 1 ? `${a[0].family}, ${a[0].given}` : a.length <= 10 ? `${a[0].family}, ${a[0].given}, ${a.slice(1, -1).map(full).join(', ')}${a.length > 2 ? ',' : ''} and ${full(a[a.length - 1])}` : `${a[0].family}, ${a[0].given}, et al.`;
  const link = r.doi ? `https://doi.org/${r.doi}` : r.url || '';
  if (r.type === 'book') return `${au ? au + '. ' : ''}*${titleCase(r.title)}*. ${r.place ? r.place + ': ' : ''}${r.publisher || ''}, ${r.year || 'n.d.'}.`;
  if (r.type === 'web') return `${au ? au + '. ' : ''}“${titleCase(r.title)}.” ${r.container ? r.container + '. ' : ''}${r.month ? MONTHS[r.month - 1] + ' ' + (r.day ? r.day + ', ' : '') : ''}${r.year || ''}. ${link}.`;
  return `${au ? au + '. ' : ''}“${titleCase(r.title)}.” *${r.container || ''}* ${r.volume || ''}${r.issue ? `, no. ${r.issue}` : ''} (${r.year || 'n.d.'})${r.pages ? `: ${r.pages}` : ''}. ${link}.`.replace(/\s+\./g, '.');
}
function harvard(r) {
  const n = r.authors.map(a => `${a.family}${a.given ? ', ' + ini(a.given) : ''}`);
  const au = n.length <= 1 ? (n[0] || '') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
  const link = r.doi ? ` doi:${r.doi}` : r.url ? ` Available at: ${r.url}${r.accessed ? ` (Accessed: ${r.accessed})` : ''}` : '';
  if (r.type === 'book') return `${au} (${r.year || 'n.d.'}) *${r.title}*. ${r.edition ? r.edition + ' edn. ' : ''}${r.place ? r.place + ': ' : ''}${r.publisher || ''}.`;
  if (r.type === 'web') return `${au || r.container || ''} (${r.year || 'n.d.'}) *${r.title}*.${link}.`;
  return `${au} (${r.year || 'n.d.'}) ‘${r.title}’, *${r.container || ''}*${r.volume ? `, ${r.volume}` : ''}${r.issue ? `(${r.issue})` : ''}${r.pages ? `, pp. ${r.pages}` : ''}.${link}.`;
}
function ieee(r) {
  const n = r.authors.map(a => `${ini(a.given)} ${a.family}`.trim());
  const au = n.length > 6 ? `${n[0]} et al.` : n.length <= 2 ? n.join(' and ') : n.slice(0, -1).join(', ') + ', and ' + n[n.length - 1];
  const mo = r.month ? MONTHS[r.month - 1].slice(0, 3) + '. ' : '';
  if (r.type === 'book') return `${au}, *${r.title}*${r.edition ? `, ${r.edition} ed` : ''}. ${r.place ? r.place + ': ' : ''}${r.publisher || ''}, ${r.year || ''}.`;
  if (r.type === 'web') return `${au ? au + ', ' : ''}“${r.title},” *${r.container || ''}*. [Online]. Available: ${r.url}${r.accessed ? `. [Accessed: ${r.accessed}]` : ''}.`;
  return `${au}, “${r.title},” *${r.container || ''}*${r.volume ? `, vol. ${r.volume}` : ''}${r.issue ? `, no. ${r.issue}` : ''}${r.pages ? `, pp. ${r.pages.replace('-', '–')}` : ''}, ${mo}${r.year || ''}${r.doi ? `, doi: ${r.doi}` : ''}.`;
}
function vancouver(r) {
  const n = r.authors.slice(0, 6).map(a => `${a.family} ${(a.given || '').split(/[\s-]+/).map(x => x[0] || '').join('')}`);
  const au = n.join(', ') + (r.authors.length > 6 ? ', et al' : '');
  if (r.type === 'book') return `${au}. ${r.title}. ${r.place ? r.place + ': ' : ''}${r.publisher || ''}; ${r.year || ''}.`;
  if (r.type === 'web') return `${au ? au + '. ' : ''}${r.title} [Internet]. ${r.container || ''}; ${r.year || ''}. Available from: ${r.url}`;
  return `${au}. ${r.title}. ${r.container || ''}. ${r.year || ''}${r.volume ? `;${r.volume}` : ''}${r.issue ? `(${r.issue})` : ''}${r.pages ? `:${r.pages}` : ''}.${r.doi ? ` doi:${r.doi}` : ''}`;
}
function bibtex(r) {
  const key = ((r.authors[0] && r.authors[0].family) || 'ref').replace(/\W/g, '') + (r.year || '') + (r.title || '').split(/\s+/)[0].replace(/\W/g, '').toLowerCase();
  const t = r.type === 'book' ? 'book' : r.type === 'web' ? 'misc' : 'article';
  const f = [['title', `{${r.title}}`], ['author', r.authors.map(a => `${a.family}, ${a.given}`).join(' and ')], [t === 'article' ? 'journal' : t === 'misc' ? 'howpublished' : 'publisher', t === 'misc' ? (r.url ? `\\url{${r.url}}` : '') : t === 'article' ? r.container : r.publisher], ['year', r.year], ['volume', r.volume], ['number', r.issue], ['pages', r.pages && r.pages.replace(/[-–]/, '--')], ['doi', r.doi], ['isbn', r.isbn], ['url', t !== 'misc' ? r.url : ''], ['note', r.accessed ? `Accessed ${r.accessed}` : '']].filter(([, v]) => v);
  return `@${t}{${key},\n${f.map(([k, v]) => `  ${k} = {${v}}`).join(',\n')}\n}`;
}
function ris(r) {
  const ty = r.type === 'book' ? 'BOOK' : r.type === 'web' ? 'ELEC' : 'JOUR';
  const L = [`TY  - ${ty}`, ...r.authors.map(a => `AU  - ${a.family}, ${a.given}`), `TI  - ${r.title}`, r.container && `${ty === 'JOUR' ? 'JO' : 'T2'}  - ${r.container}`, r.year && `PY  - ${r.year}`, r.volume && `VL  - ${r.volume}`, r.issue && `IS  - ${r.issue}`, r.pages && `SP  - ${r.pages.split(/[-–]/)[0]}`, r.pages && r.pages.includes('-') && `EP  - ${r.pages.split(/[-–]/)[1]}`, r.publisher && `PB  - ${r.publisher}`, r.doi && `DO  - ${r.doi}`, r.url && `UR  - ${r.url}`, r.isbn && `SN  - ${r.isbn}`, 'ER  - '];
  return L.filter(Boolean).join('\n');
}
function inText(r) {
  const a = r.authors, y = r.year || 'n.d.';
  const fam = (i) => (a[i] ? a[i].family : r.container || r.title.split(' ').slice(0, 3).join(' '));
  const apaIn = a.length >= 3 ? `(${fam(0)} et al., ${y})` : a.length === 2 ? `(${fam(0)} & ${fam(1)}, ${y})` : `(${fam(0)}, ${y})`;
  const mlaIn = a.length >= 3 ? `(${fam(0)} et al.)` : a.length === 2 ? `(${fam(0)} and ${fam(1)})` : `(${fam(0)})`;
  return [['APA', apaIn], ['MLA', mlaIn], ['Chicago (author-date)', `(${fam(0)}${a.length >= 4 ? ' et al.' : a.length > 1 ? ' and ' + fam(1) : ''} ${y})`], ['Harvard', `(${fam(0)}${a.length > 2 ? ' et al.' : a.length === 2 ? ' and ' + fam(1) : ''}, ${y})`], ['IEEE', '[1]']];
}
const STYLES = { APA: apa, MLA: mla, Chicago: chicago, Harvard: harvard, IEEE: ieee, Vancouver: vancouver };
const md2plain = (s) => s.replace(/\*/g, '');
const md2html = (s) => s.replace(/\*([^*]+)\*/g, '<i>$1</i>');
function showCitation(ctx, rec, only) {
  ctx.label('Citation'); ctx.input(rec.title);
  const want = only ? Object.keys(STYLES).filter(s => s.toLowerCase() === only.toLowerCase()) : Object.keys(STYLES);
  ctx.add({ title: 'Reference list', custom: (el) => {
    const t = document.createElement('table'); t.className = 'tbl kv';
    for (const s of want) { const tr = document.createElement('tr'); const th = document.createElement('th'); th.textContent = s; const td = document.createElement('td'); td.innerHTML = md2html(STYLES[s](rec).replace(/&/g, '&amp;').replace(/</g, '&lt;')); td.style.paddingLeft = '2em'; td.style.textIndent = '-2em'; const b = document.createElement('button'); b.className = 'icon-btn'; b.textContent = 'Copy'; b.onclick = async () => { const html = md2html(STYLES[s](rec)); try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([md2plain(STYLES[s](rec))], { type: 'text/plain' }) })]); } catch (_) { await navigator.clipboard.writeText(md2plain(STYLES[s](rec))); } b.textContent = 'Copied'; }; td.append(' ', b); tr.append(th, td); t.append(tr); }
    const w = document.createElement('div'); w.className = 'tbl-wrap'; w.append(t); el.append(w);
    const p = document.createElement('p'); p.className = 'note'; p.textContent = 'Copy keeps the italics when pasted into Word or Google Docs. Check capitalization: APA wants sentence case for article titles, which needs a human eye for proper nouns.'; el.append(p);
  } });
  if (!only) {
    ctx.add({ title: 'In-text', table: inText(rec) });
    ctx.add({ title: 'BibTeX', pre: bibtex(rec) });
    ctx.add({ title: 'Save', custom: (el) => {
      const box = document.createElement('div'); box.className = 'btns';
      const add = document.createElement('button'); add.className = 'chip'; add.type = 'button'; add.textContent = '＋ Add to my bibliography';
      add.onclick = () => { const b = bibLoad(); if (!b.some(x => x.title === rec.title)) b.push(rec); bibSave(b); add.textContent = `Added (${b.length} saved)`; };
      box.append(add); el.append(box);
    } });
    ctx.add(K.filesPod([{ label: '.bib', name: 'citation.bib', mime: 'application/x-bibtex', data: bibtex(rec) }, { label: '.ris (Zotero/EndNote/Mendeley)', name: 'citation.ris', mime: 'application/x-research-info-systems', data: ris(rec) }]));
  }
}
const BIB_KEY = 'tools-bibliography';
const bibLoad = () => { try { return JSON.parse(localStorage.getItem(BIB_KEY) || '[]'); } catch (_) { return []; } };
const bibSave = (b) => { try { localStorage.setItem(BIB_KEY, JSON.stringify(b)); } catch (_) {} };
function bibliography(ctx, style = 'APA') {
  const b = bibLoad();
  ctx.label('Bibliography');
  if (!b.length) { ctx.input('Empty'); ctx.add({ title: 'Nothing saved yet', text: 'Cite something (cite 10.1038/nature14539, cite isbn 9780441172719, cite https://…) and press “Add to my bibliography”.' }); return; }
  const S = STYLES[Object.keys(STYLES).find(s => s.toLowerCase() === style.toLowerCase()) || 'APA'];
  const sorted = [...b].sort((x, y) => md2plain(S(x)).localeCompare(md2plain(S(y))));
  ctx.input(`${b.length} sources, ${style}`);
  ctx.add({ title: style === 'IEEE' || style === 'Vancouver' ? 'References' : style === 'MLA' ? 'Works Cited' : 'References', custom: (el) => { const ol = document.createElement(style === 'IEEE' || style === 'Vancouver' ? 'ol' : 'div'); for (const r of (style === 'IEEE' || style === 'Vancouver' ? b : sorted)) { const p = document.createElement(ol.tagName === 'OL' ? 'li' : 'p'); p.innerHTML = md2html(S(r).replace(/&/g, '&amp;').replace(/</g, '&lt;')); p.style.paddingLeft = '2em'; p.style.textIndent = ol.tagName === 'OL' ? '0' : '-2em'; ol.append(p); } el.append(ol); } });
  ctx.add({ title: 'Other styles', chips: Object.keys(STYLES).filter(s => s.toLowerCase() !== style.toLowerCase()).map(s => `bibliography ${s}`).concat(['clear bibliography']) });
  const html = `<!doctype html><meta charset="utf-8"><title>References</title><body style="font:12pt 'Times New Roman';line-height:2"><h3 style="text-align:center">${style === 'MLA' ? 'Works Cited' : 'References'}</h3>${sorted.map(r => `<p style="padding-left:.5in;text-indent:-.5in;margin:0">${md2html(S(r))}</p>`).join('')}</body>`;
  ctx.add(K.filesPod([{ label: 'Word-ready (.doc)', name: 'references.doc', mime: 'application/msword', data: html }, { label: '.bib', name: 'references.bib', mime: 'application/x-bibtex', data: b.map(bibtex).join('\n\n') }, { label: '.ris', name: 'references.ris', mime: 'application/x-research-info-systems', data: b.map(ris).join('\n') }, { label: 'Text', name: 'references.txt', mime: 'text/plain', data: sorted.map(r => md2plain(S(r))).join('\n\n') }]));
}
async function recFromDoi(doi, get) {
  doi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();
  const w = (await get(`https://api.crossref.org/works/${enc(doi)}`)).message;
  const dp = (w.issued && w.issued['date-parts'] && w.issued['date-parts'][0]) || [];
  const book = /book/.test(w.type) && !/chapter/.test(w.type);
  return { type: book ? 'book' : 'article', authors: (w.author || []).map(a => ({ given: a.given || '', family: a.family || a.name || '' })), title: strip((w.title || [''])[0]), container: (w['container-title'] || [''])[0], year: dp[0], month: dp[1], volume: w.volume, issue: w.issue, pages: w.page, doi, publisher: w.publisher, isbn: (w.ISBN || [])[0] };
}
async function recFromIsbn(isbn, get) {
  const id = isbn.replace(/[^\dX]/gi, '');
  const r = await get(`https://openlibrary.org/api/books?bibkeys=ISBN:${id}&format=json&jscmd=data`);
  const b = r[`ISBN:${id}`];
  if (!b) throw new Error('Open Library doesn’t know that ISBN.');
  const year = ((b.publish_date || '').match(/\d{4}/) || [])[0];
  return { type: 'book', authors: (b.authors || []).map(a => { const p = a.name.split(' '); return { given: p.slice(0, -1).join(' '), family: p[p.length - 1] }; }), title: b.title + (b.subtitle ? `: ${b.subtitle}` : ''), year, publisher: (b.publishers || [{}])[0].name, place: (b.publish_places || [{}])[0].name, isbn: id, url: b.url };
}
async function recFromUrl(url, get) {
  const today = new Date();
  const accessed = `${today.getDate()} ${MONTHS[today.getMonth()].slice(0, 3)}. ${today.getFullYear()}`;
  let html = '';
  try { html = await get(`${location.origin}/tools/api/proxy?read=${enc(url)}`, { type: 'text' }); } catch (_) {}
  const doc = new DOMParser().parseFromString(html || '<html></html>', 'text/html');
  const meta = (n) => { const e = doc.querySelector(`meta[name="${n}"],meta[property="${n}"]`); return e && e.content; };
  const metas = (n) => [...doc.querySelectorAll(`meta[name="${n}"]`)].map(e => e.content);
  const doi = meta('citation_doi') || meta('dc.identifier');
  if (doi && /^10\./.test(doi)) return recFromDoi(doi, get);
  const authorsRaw = metas('citation_author').length ? metas('citation_author') : [meta('author') || meta('article:author') || ''].filter(Boolean);
  const authors = authorsRaw.filter(a => !/^https?:/.test(a)).map(a => (a.includes(',') ? { family: a.split(',')[0].trim(), given: a.split(',')[1].trim() } : { given: a.split(' ').slice(0, -1).join(' '), family: a.split(' ').slice(-1)[0] }));
  const date = meta('citation_publication_date') || meta('article:published_time') || meta('date') || meta('dc.date') || '';
  const d = date ? new Date(date) : null;
  const host = new URL(url).hostname.replace(/^www\./, '');
  return { type: 'web', authors, title: meta('citation_title') || meta('og:title') || (doc.title || '').trim() || host, container: meta('og:site_name') || meta('citation_journal_title') || host, year: d && !isNaN(d) ? d.getFullYear() : null, month: d && !isNaN(d) ? d.getMonth() + 1 : null, day: d && !isNaN(d) ? d.getDate() : null, url, accessed, partial: !html };
}

// ============================================================ OpenAlex analytics
const OA = 'https://api.openalex.org';
const workItem = (w) => ({ title: w.display_name || w.title, url: (w.open_access && w.open_access.oa_url) || (w.doi ? w.doi : w.id), meta: `${(w.authorships || []).slice(0, 3).map(a => a.author.display_name).join(', ')}${(w.authorships || []).length > 3 ? ' et al.' : ''} · ${w.publication_year || ''} · cited ${fmt(w.cited_by_count, 0)}${w.open_access && w.open_access.is_oa ? ' · open access' : ''}`, actions: w.doi ? [{ label: 'Cite', query: `cite ${w.doi.replace('https://doi.org/', '')}` }, { label: 'Cited by', query: `cited by ${w.doi.replace('https://doi.org/', '')}` }] : [] });
async function findWork(q, get) {
  const doi = /10\.\d{4,9}\/\S+/.exec(q);
  if (doi) return get(`${OA}/works/doi:${enc(doi[0])}`);
  const r = await get(`${OA}/works?search=${enc(q.replace(/^["“]|["”]$/g, ''))}&per_page=1`);
  if (!r.results.length) throw new Error('No paper found with that title.');
  return r.results[0];
}
async function paperByTitle(ctx, q, get) {
  const w = await findWork(q, get);
  ctx.label('Paper'); ctx.input(w.display_name);
  ctx.add({ title: w.display_name, table: [['Authors', (w.authorships || []).map(a => a.author.display_name).join(', ')], ['Year', w.publication_year], ['Venue', (w.primary_location && w.primary_location.source && w.primary_location.source.display_name) || '—'], ['Cited by', fmt(w.cited_by_count, 0)], ['Open access', w.open_access && w.open_access.is_oa ? 'Yes' : 'No'], ['Retracted', w.is_retracted ? 'YES: do not rely on it' : 'No'], ['DOI', w.doi ? { text: w.doi.replace('https://doi.org/', ''), url: w.doi } : '—']] });
  if (w.abstract_inverted_index) { const pos = []; for (const [word, ix] of Object.entries(w.abstract_inverted_index)) ix.forEach(i => (pos[i] = word)); ctx.add({ title: 'Abstract', text: pos.join(' ') }); }
  const btns = [];
  if (w.open_access && w.open_access.oa_url) btns.push({ label: 'Free full text', url: w.open_access.oa_url });
  if (w.doi) btns.push({ label: 'Cite', query: `cite ${w.doi.replace('https://doi.org/', '')}` }, { label: 'Who cites it', query: `cited by ${w.doi.replace('https://doi.org/', '')}` }, { label: 'Its references', query: `references of ${w.doi.replace('https://doi.org/', '')}` }, { label: 'Related papers', query: `related to ${w.doi.replace('https://doi.org/', '')}` });
  ctx.add({ title: 'Next', buttons: btns });
  ctx.source('OpenAlex', w.id);
}
async function citedBy(ctx, q, get) {
  const w = await findWork(q, get);
  const r = await get(`${OA}/works?filter=cites:${w.id.split('/').pop()}&sort=cited_by_count:desc&per_page=15`);
  ctx.label('Citations'); ctx.input(`Papers citing “${w.display_name}”`);
  ctx.add({ title: `${fmt(r.meta.count, 0)} citing works (most cited first)`, list: r.results.map(workItem) });
  const by = await get(`${OA}/works?filter=cites:${w.id.split('/').pop()}&group_by=publication_year`).catch(() => null);
  if (by) { const g = by.group_by.sort((a, b) => a.key - b.key); ctx.add({ title: 'Citations per year', plot: { kind: 'bar', x: g.map(x => x.key), y: g.map(x => x.count) } }); }
}
async function referencesOf(ctx, q, get) {
  const w = await findWork(q, get);
  const ids = (w.referenced_works || []).slice(0, 50).map(u => u.split('/').pop());
  if (!ids.length) throw new Error('OpenAlex has no reference list for that work.');
  const r = await get(`${OA}/works?filter=openalex:${ids.join('|')}&per_page=50&sort=cited_by_count:desc`);
  ctx.label('References'); ctx.input(`What “${w.display_name}” cites`);
  ctx.add({ title: `${ids.length} references (most cited first)`, list: r.results.map(workItem) });
}
async function related(ctx, q, get) {
  const w = await findWork(q, get);
  const ids = (w.related_works || []).slice(0, 20).map(u => u.split('/').pop());
  const r = ids.length ? await get(`${OA}/works?filter=openalex:${ids.join('|')}&per_page=20`) : { results: [] };
  ctx.label('Related'); ctx.input(w.display_name);
  ctx.add({ title: 'Related papers', list: r.results.map(workItem) });
}
async function journal(ctx, name, get) {
  const r = await get(`${OA}/sources?search=${enc(name)}&per_page=1`);
  const s = r.results[0]; if (!s) throw new Error('No journal found.');
  ctx.label('Journal'); ctx.input(s.display_name);
  ctx.add({ title: s.display_name, table: [['Publisher', s.host_organization_name || '—'], ['ISSN', (s.issn || []).join(', ') || '—'], ['Type', s.type], ['Open access journal', s.is_oa ? 'Yes' : 'No'], ['In DOAJ', s.is_in_doaj ? 'Yes' : 'No'], ['Works', fmt(s.works_count, 0)], ['Total citations', fmt(s.cited_by_count, 0)], ['2-year mean citedness (≈ impact factor)', fmt(s.summary_stats && s.summary_stats['2yr_mean_citedness'], 2)], ['h-index', fmt(s.summary_stats && s.summary_stats.h_index, 0)], ['APC (publication fee)', s.apc_usd ? `$${fmt(s.apc_usd, 0)}` : '—']], note: '“2-year mean citedness” is OpenAlex’s open alternative to the Journal Impact Factor; numbers differ from Clarivate’s.' });
  if (s.homepage_url) ctx.add({ title: 'Links', buttons: [{ label: 'Homepage', url: s.homepage_url }] });
}
async function institution(ctx, name, get) {
  const r = await get(`${OA}/institutions?search=${enc(name)}&per_page=1`);
  const i = r.results[0]; if (!i) throw new Error('No institution found.');
  ctx.label('Institution'); ctx.input(i.display_name);
  ctx.add({ title: i.display_name, table: [['Country', i.country_code], ['Type', i.type], ['Works', fmt(i.works_count, 0)], ['Citations', fmt(i.cited_by_count, 0)], ['h-index', fmt(i.summary_stats && i.summary_stats.h_index, 0)]] });
  const topics = await get(`${OA}/works?filter=institutions.id:${i.id.split('/').pop()},from_publication_date:${new Date().getFullYear() - 3}-01-01&group_by=primary_topic.field.id`).catch(() => null);
  if (topics) ctx.add({ title: 'Research fields (last 3 years)', plot: { kind: 'bar', x: topics.group_by.slice(0, 12).map(g => g.key_display_name), y: topics.group_by.slice(0, 12).map(g => g.count) } });
  const top = await get(`${OA}/works?filter=institutions.id:${i.id.split('/').pop()}&sort=cited_by_count:desc&per_page=8`).catch(() => null);
  if (top) ctx.add({ title: 'Most cited works', list: top.results.map(workItem) });
}
async function topicTrend(ctx, topic, get) {
  const r = await get(`${OA}/works?search=${enc(topic)}&group_by=publication_year`);
  const g = r.group_by.filter(x => +x.key >= 1990 && +x.key <= new Date().getFullYear()).sort((a, b) => a.key - b.key);
  ctx.label('Trend'); ctx.input(`Papers per year mentioning “${topic}”`);
  ctx.add({ title: 'Publications per year', plot: { kind: 'line', traces: [{ name: topic, x: g.map(x => +x.key), y: g.map(x => x.count) }], xtitle: 'Year', ytitle: 'Works' } });
  ctx.add(K.filesPod(K.tableFiles('topic-trend', ['Year', 'Works'], g.map(x => [x.key, x.count]))));
  const [auth, ven, inst] = await Promise.all([get(`${OA}/works?search=${enc(topic)}&group_by=authorships.author.id`).catch(() => null), get(`${OA}/works?search=${enc(topic)}&group_by=primary_location.source.id`).catch(() => null), get(`${OA}/works?search=${enc(topic)}&group_by=authorships.institutions.id`).catch(() => null)]);
  if (auth) ctx.add({ title: 'Most prolific authors', table: { head: ['Author', 'Works'], rows: auth.group_by.slice(0, 10).map(x => [{ text: x.key_display_name, query: `author ${x.key_display_name}` }, fmt(x.count, 0)]) } });
  if (ven) ctx.add({ title: 'Top venues', table: { head: ['Journal / conference', 'Works'], rows: ven.group_by.slice(0, 10).map(x => [x.key_display_name, fmt(x.count, 0)]) } });
  if (inst) ctx.add({ title: 'Top institutions', table: { head: ['Institution', 'Works'], rows: inst.group_by.slice(0, 10).map(x => [x.key_display_name, fmt(x.count, 0)]) } });
}
async function oaFinder(ctx, q, get) {
  const w = await findWork(q, get);
  const locs = (w.locations || []).filter(l => l.is_oa && (l.pdf_url || l.landing_page_url));
  ctx.label('Open access'); ctx.input(w.display_name);
  if (!locs.length) {
    ctx.add({ title: 'No free version found', text: 'OpenAlex knows no legal free copy. Options:', numbered: ['Your library: search the title in your school library (interlibrary loan is free for students).', 'Email the author: most are happy to send a copy.', 'Look for a preprint on arXiv, bioRxiv or SSRN under a slightly different title.'], buttons: [{ label: 'Google Scholar (all versions)', url: `https://scholar.google.com/scholar?q=${enc(w.display_name)}` }] });
    return;
  }
  ctx.add({ title: 'Free, legal copies', list: locs.map(l => ({ title: (l.source && l.source.display_name) || new URL(l.pdf_url || l.landing_page_url).hostname, url: l.pdf_url || l.landing_page_url, meta: `${l.version || ''}${l.license ? ' · ' + l.license : ''}${l.pdf_url ? ' · PDF' : ''}` })) });
}

// ============================================================ other open sources
async function eric(ctx, q, get) {
  const r = await get(`https://api.ies.ed.gov/eric/?search=${enc(q)}&rows=10&format=json&fields=id,title,author,publicationdateyear,description,url,peerreviewed,e_fulltextauth`, { proxy: true });
  ctx.label('ERIC (education research)'); ctx.input(q);
  ctx.add({ title: `${fmt(r.response.numFound, 0)} results`, list: r.response.docs.map(d => ({ title: d.title, url: `https://eric.ed.gov/?id=${d.id}`, meta: `${(d.author || []).slice(0, 3).join(', ')} · ${d.publicationdateyear || ''}${d.peerreviewed === 'T' ? ' · peer reviewed' : ''}${d.e_fulltextauth === 1 ? ' · full text' : ''}`, snippet: short(d.description) })) });
}
async function zenodo(ctx, q, type, get) {
  const r = await get(`https://zenodo.org/api/records?q=${enc(q)}&size=10&sort=bestmatch${type ? `&type=${type}` : ''}`, { proxy: true });
  ctx.label('Zenodo'); ctx.input(`${q}${type ? ` (${type})` : ''}`);
  ctx.add({ title: `${fmt(r.hits.total, 0)} records`, list: r.hits.hits.map(h => ({ title: h.metadata.title, url: h.links.self_html || `https://zenodo.org/records/${h.id}`, meta: `${h.metadata.resource_type && h.metadata.resource_type.title} · ${h.metadata.publication_date}${h.metadata.doi ? ' · ' + h.metadata.doi : ''}`, snippet: short(strip(h.metadata.description)) })) });
}
async function huggingface(ctx, q, kind, get) {
  const r = await get(`https://huggingface.co/api/${kind}?search=${enc(q)}&limit=12&sort=downloads&direction=-1`, { proxy: true });
  ctx.label(`Hugging Face ${kind}`); ctx.input(q);
  ctx.add({ title: K.cap(kind), list: r.map(m => ({ title: m.id, url: `https://huggingface.co/${kind === 'datasets' ? 'datasets/' : ''}${m.id}`, meta: `${fmt(m.downloads, 0)} downloads · ${fmt(m.likes, 0)} likes${m.pipeline_tag ? ' · ' + m.pipeline_tag : ''}` })), note: kind === 'models' ? 'A catalogue search only: nothing here runs a model.' : undefined });
}
async function datagov(ctx, q, get) {
  const r = await get(`https://catalog.data.gov/search?q=${enc(q)}`, { proxy: true });
  const res = (r.results || []).slice(0, 10);
  ctx.label('Data.gov'); ctx.input(q);
  if (!res.length) { ctx.add({ title: 'No datasets found', buttons: [{ label: 'Search data.gov', url: `https://catalog.data.gov/dataset?q=${enc(q)}` }] }); return; }
  ctx.add({ title: 'U.S. government datasets', list: res.map(d => ({ title: d.title, url: `https://catalog.data.gov/dataset/${d.slug}`, meta: `${d.publisher || (d.organization && d.organization.name) || ''}${(d.distribution_titles || []).length ? ' · ' + [...new Set(d.distribution_titles)].slice(0, 4).join(', ') : ''}`, snippet: short(d.description) })) });
  ctx.add({ title: 'More', buttons: [{ label: 'All results on data.gov', url: `https://catalog.data.gov/dataset?q=${enc(q)}` }] });
}
async function loc(ctx, q, get) {
  const r = await get(`https://www.loc.gov/search/?q=${enc(q)}&fo=json&c=10`, { timeout: 30000 });
  ctx.label('Library of Congress'); ctx.input(q);
  ctx.add({ title: 'Collections', list: r.results.map(x => ({ title: x.title, url: x.id, thumb: (x.image_url || [])[0], meta: `${(x.original_format || []).join(', ')} · ${x.date || ''}` })) });
}
async function archive(ctx, q, media, get) {
  const r = await get(`https://archive.org/advancedsearch.php?q=${enc(q)}${media ? `+AND+mediatype:${media}` : ''}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=year&fl[]=mediatype&rows=12&output=json&sort[]=downloads+desc`, { proxy: true });
  ctx.label('Internet Archive'); ctx.input(`${q}${media ? ` (${media})` : ''}`);
  ctx.add({ title: `${fmt(r.response.numFound, 0)} items`, list: r.response.docs.map(d => ({ title: d.title, url: `https://archive.org/details/${d.identifier}`, thumb: `https://archive.org/services/img/${d.identifier}`, meta: `${[].concat(d.creator || []).slice(0, 2).join(', ')} · ${d.year || ''} · ${d.mediatype}` })) });
}
async function fatcat(ctx, q, get) {
  const r = await get(`https://scholar.archive.org/search?q=${enc(q)}&format=json`, { proxy: true }).catch(() => null);
  ctx.label('Scholar archive'); ctx.input(q);
  if (!r || !r.results) { ctx.add({ title: 'Search', buttons: [{ label: 'scholar.archive.org', url: `https://scholar.archive.org/search?q=${enc(q)}` }] }); return; }
  ctx.add({ title: 'Preserved papers with full text', list: r.results.slice(0, 10).map(x => ({ title: x.biblio.title, url: x.fulltext ? x.fulltext.access_url : `https://scholar.archive.org/search?q=${enc(x.biblio.title)}`, meta: `${(x.biblio.contrib_names || []).slice(0, 3).join(', ')} · ${x.biblio.release_year || ''} · ${x.biblio.container_name || ''}` })) });
}
async function openverse(ctx, q, kind, get) {
  const r = await get(`https://api.openverse.org/v1/${kind}/?q=${enc(q)}&page_size=12`, { proxy: true });
  ctx.label(`Openverse ${kind}`); ctx.input(`${q} (Creative Commons and public domain)`);
  ctx.add({ title: `${fmt(r.result_count, 0)} results`, list: r.results.map(x => ({ title: x.title || '(untitled)', url: x.foreign_landing_url, thumb: kind === 'images' ? x.thumbnail : undefined, audio: kind === 'audio' ? x.url : undefined, meta: `${x.creator || 'Unknown'} · ${String(x.license).toUpperCase()} ${x.license_version || ''}`, snippet: x.attribution })), note: 'Each result shows the attribution text to paste under the image/audio. CC0 and PDM need no attribution.' });
}
async function commons(ctx, q, get) {
  const r = await get(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${enc(q)}&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=300&format=json&origin=*`);
  const pages = Object.values((r.query && r.query.pages) || {});
  ctx.label('Wikimedia Commons'); ctx.input(q);
  ctx.add({ title: 'Free images', list: pages.map(p => { const i = p.imageinfo[0], md = i.extmetadata || {}; return { title: p.title.replace(/^File:/, ''), url: i.descriptionurl, thumb: i.thumburl, meta: `${strip((md.Artist || {}).value || '')} · ${(md.LicenseShortName || {}).value || ''}` }; }) });
}
async function quotes(ctx, who, get) {
  const p = await get(`https://en.wikiquote.org/w/api.php?action=parse&page=${enc(who.replace(/ /g, '_'))}&prop=text&section=1&format=json&origin=*&redirects=1`, { proxy: true });
  const doc = new DOMParser().parseFromString(p.parse.text['*'], 'text/html');
  const qs = [...doc.querySelectorAll('ul > li')].map(li => { const c = li.cloneNode(true); c.querySelectorAll('ul').forEach(u => u.remove()); return c.textContent.trim(); }).filter(t => t.length > 20 && t.length < 400).slice(0, 12);
  if (!qs.length) throw new Error('No quotes found on Wikiquote.');
  ctx.label('Quotes'); ctx.input(p.parse.title);
  ctx.add({ title: `Quotes: ${p.parse.title}`, numbered: qs, note: 'From Wikiquote’s sourced section. Check the source listed there before quoting in a paper.' });
  ctx.add({ title: 'Source', buttons: [{ label: 'Wikiquote page', url: `https://en.wikiquote.org/wiki/${enc(p.parse.title.replace(/ /g, '_'))}` }] });
}
async function etymology(ctx, word, get) {
  const p = await get(`https://en.wiktionary.org/w/api.php?action=parse&page=${enc(word.toLowerCase())}&prop=wikitext&format=json&origin=*`);
  const wt = p.parse.wikitext['*'];
  const en = (wt.split(/\n==English==\n/)[1] || wt).split(/\n==[^=]/)[0];
  const ety = (/===Etymology(?: \d)?===\n([\s\S]*?)\n===/.exec(en) || [])[1];
  if (!ety) throw new Error('No etymology found.');
  const LN = { en: 'English', enm: 'Middle English', ang: 'Old English', fr: 'French', frm: 'Middle French', fro: 'Old French', la: 'Latin', 'la-lat': 'Late Latin', 'la-med': 'Medieval Latin', 'la-new': 'New Latin', grc: 'Ancient Greek', el: 'Greek', de: 'German', gmh: 'Middle High German', goh: 'Old High German', non: 'Old Norse', nl: 'Dutch', dum: 'Middle Dutch', it: 'Italian', es: 'Spanish', pt: 'Portuguese', cs: 'Czech', ru: 'Russian', pl: 'Polish', ar: 'Arabic', fa: 'Persian', xno: 'Anglo-Norman', 'en-GB': 'British English', sa: 'Sanskrit', hi: 'Hindi', ja: 'Japanese', zh: 'Chinese', 'gem-pro': 'Proto-Germanic', 'ine-pro': 'Proto-Indo-European', 'itc-pro': 'Proto-Italic', 'sla-pro': 'Proto-Slavic', 'gmw-pro': 'Proto-West Germanic', 'cel-pro': 'Proto-Celtic', ga: 'Irish', cy: 'Welsh', he: 'Hebrew', tr: 'Turkish', sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish', hu: 'Hungarian', ko: 'Korean' };
  const tpl = (body) => { const a = body.split('|').filter(x => !/=/.test(x)); const t = a[0]; const lang = (c) => LN[c] || c; const word = (w, g) => `${w || ''}${g ? ` (“${g}”)` : ''}`;
    if (/^(?:inh\+?|der\+?|bor\+?|lbor|slbor|ubor|cal|calque|lbor|learned borrowing|uder|inh-lite|der-lite)$/.test(t)) return `${lang(a[2])} ${word(a[3], a[5])}`.trim();
    if (/^(?:cog|noncog|nc)$/.test(t)) return `${lang(a[1])} ${word(a[2], a[4])}`.trim();
    if (/^(?:m|l|mention|link|m\+)$/.test(t)) return word(a[2], a[4]);
    if (/^(?:af|affix|compound|com|suffix|prefix|confix)$/.test(t)) return a.slice(2).filter(Boolean).join(' + ');
    if (/^(?:gloss|gl)$/.test(t)) return `(“${a[1]}”)`;
    if (/^(?:etydate|root|rfe|etystub|ety|nonlemma|wikipedia|w|sense|IPA|q|qualifier|lb)$/.test(t)) return t === 'w' ? a[1] || '' : '';
    return ''; };
  let txt = ety; for (let i = 0; i < 4; i++) txt = txt.replace(/\{\{([^{}]*)\}\}/g, (_, b) => tpl(b));
  const clean = txt.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1').replace(/''+/g, '').replace(/<ref[\s\S]*?<\/ref>|<[^>]+>/g, '').replace(/\(\s*\)/g, '').replace(/\s+([,.;])/g, '$1').replace(/\s+/g, ' ').trim();
  ctx.label('Etymology'); ctx.input(word);
  ctx.add({ title: `Origin of “${word}”`, text: clean || 'See Wiktionary.', source: { name: 'Wiktionary', url: `https://en.wiktionary.org/wiki/${enc(word)}#Etymology` } });
}

// ============================================================ search helpers
function searchBuilder(ctx, spec) {
  const q = [];
  const exact = [...spec.matchAll(/"([^"]+)"/g)].map(m => `"${m[1]}"`);
  let rest = spec.replace(/"[^"]+"/g, ' ');
  const take = (re) => { const m = re.exec(rest); if (m) rest = rest.replace(m[0], ' '); return m; };
  const site = take(/\bsite\s*[:=]?\s*([\w.-]+\.[a-z]{2,}|edu|gov|org)\b/i), ft = take(/\b(?:filetype|type)\s*[:=]?\s*(pdf|docx?|pptx?|xlsx?|csv|txt)\b/i), after = take(/\bafter\s*[:=]?\s*(\d{4}(?:-\d\d-\d\d)?)/i), before = take(/\bbefore\s*[:=]?\s*(\d{4}(?:-\d\d-\d\d)?)/i), not = [...rest.matchAll(/\b(?:not|without|exclude|-)\s*(\w+)/gi)];
  for (const n of not) rest = rest.replace(n[0], ' ');
  const intitle = take(/\bintitle\s*[:=]?\s*(\w+)/i);
  const words = rest.replace(/\s+/g, ' ').trim();
  if (words) q.push(words); q.push(...exact);
  if (intitle) q.push(`intitle:${intitle[1]}`);
  if (site) q.push(`site:${/\./.test(site[1]) ? site[1] : '.' + site[1]}`);
  if (ft) q.push(`filetype:${ft[1]}`);
  for (const n of not) q.push(`-${n[1]}`);
  const g = q.join(' ') + (after ? ` after:${after[1]}` : '') + (before ? ` before:${before[1]}` : '');
  ctx.label('Search'); ctx.input(g);
  ctx.add({ title: 'Query', big: true, mono: true, text: g });
  ctx.add({ title: 'Run it', buttons: [{ label: 'Google', url: `https://www.google.com/search?q=${enc(g)}` }, { label: 'Bing', url: `https://www.bing.com/search?q=${enc(q.join(' '))}` }, { label: 'DuckDuckGo', url: `https://duckduckgo.com/?q=${enc(q.join(' '))}` }, { label: 'Google Scholar', url: `https://scholar.google.com/scholar?q=${enc(words + ' ' + exact.join(' '))}${after ? `&as_ylo=${after[1].slice(0, 4)}` : ''}${before ? `&as_yhi=${before[1].slice(0, 4)}` : ''}` }] });
}
const OPERATORS = [['"exact phrase"', 'Only pages with those words in that order'], ['-word', 'Exclude a word'], ['site:edu', 'Only that domain or ending (site:mit.edu, site:gov)'], ['filetype:pdf', 'Only that file type (pdf, docx, pptx, xlsx)'], ['intitle:word', 'Word must be in the page title'], ['inurl:word', 'Word must be in the URL'], ['OR', 'Either term: robot OR drone'], ['( )', 'Group terms: (cat OR dog) training'], ['*', 'Wildcard for a missing word: "the * of physics"'], ['before:2020 after:2015', 'Date limits (Google)'], ['related:site.com', 'Similar sites'], ['define:word', 'Definition'], ['cache:url', 'Cached copy (sometimes)'], ['Google Scholar: author:"name"', 'Papers by an author']];
const DORKS = { 'lecture notes': (t) => `"${t}" lecture notes filetype:pdf site:edu`, 'past exams': (t) => `"${t}" (exam OR midterm OR final) solutions filetype:pdf site:edu`, syllabus: (t) => `"${t}" syllabus site:edu`, 'problem sets': (t) => `"${t}" (problem set OR homework) solutions filetype:pdf site:edu`, slides: (t) => `"${t}" lecture slides filetype:pdf OR filetype:pptx site:edu`, 'study guide': (t) => `"${t}" study guide filetype:pdf`, 'cheat sheet': (t) => `"${t}" cheat sheet filetype:pdf`, 'government reports': (t) => `"${t}" report filetype:pdf site:gov`, theses: (t) => `"${t}" (thesis OR dissertation) filetype:pdf site:edu` };
function findPdf(ctx, title) {
  ctx.label('Find a PDF'); ctx.input(title);
  ctx.add({ title: 'Legal places to look', buttons: [{ label: 'Open-access finder', query: `open access ${title}` }, { label: 'Google Scholar', url: `https://scholar.google.com/scholar?q=${enc('"' + title + '"')}` }, { label: 'Semantic Scholar', url: `https://www.semanticscholar.org/search?q=${enc(title)}` }, { label: 'arXiv', url: `https://arxiv.org/a/search?query=${enc(title)}` }, { label: 'CORE', url: `https://core.ac.uk/search?q=${enc('"' + title + '"')}` }, { label: 'Internet Archive', query: `archive texts ${title}` }, { label: 'PDF on .edu', url: `https://www.google.com/search?q=${enc(`"${title}" filetype:pdf`)}` }], note: 'If none work, your school library can usually get it free through interlibrary loan.' });
}
function textbooks(ctx, subject) {
  ctx.label('Free textbooks'); ctx.input(subject);
  ctx.add({ title: 'Free, legal textbooks', buttons: [{ label: 'OpenStax', url: `https://openstax.org/search?q=${enc(subject)}` }, { label: 'LibreTexts', url: `https://libretexts.org/search?q=${enc(subject)}` }, { label: 'Open Textbook Library', url: `https://open.umn.edu/opentextbooks/textbooks?term=${enc(subject)}` }, { label: 'MIT OpenCourseWare', url: `https://ocw.mit.edu/search/?q=${enc(subject)}` }, { label: 'Project Gutenberg', query: `books ${subject}` }, { label: 'Open Library (borrow)', url: `https://openlibrary.org/search?q=${enc(subject)}&mode=everything&has_fulltext=true` }, { label: 'Internet Archive texts', query: `archive texts ${subject}` }] });
}
function courses(ctx, topic) {
  ctx.label('Courses'); ctx.input(topic);
  ctx.add({ title: 'Free courses and lectures', buttons: [{ label: 'MIT OpenCourseWare', url: `https://ocw.mit.edu/search/?q=${enc(topic)}` }, { label: 'Khan Academy', url: `https://www.khanacademy.org/search?page_search_query=${enc(topic)}` }, { label: 'Coursera (audit free)', url: `https://www.coursera.org/search?query=${enc(topic)}` }, { label: 'edX', url: `https://www.edx.org/search?q=${enc(topic)}` }, { label: 'YouTube lectures', url: `https://www.youtube.com/results?search_query=${enc(topic + ' full lecture course')}` }, { label: 'Stanford Online', url: `https://online.stanford.edu/search-catalog?keywords=${enc(topic)}` }, { label: 'freeCodeCamp', url: `https://www.freecodecamp.org/news/search/?query=${enc(topic)}` }] });
  ctx.add({ title: 'Study materials', chips: Object.keys(DORKS).slice(0, 5).map(k => `${k} ${topic}`) });
}

// ============================================================ writing templates
const EMAILS = {
  'extension request': ['Extension request: [Course] [Assignment]', 'Dear Professor [Name],\n\nI’m writing to ask for an extension on [assignment], due [date]. [One honest sentence on why: illness, family matter, overlapping deadlines.] I’ve completed [what you’ve done so far] and could submit it by [proposed date].\n\nI understand if this isn’t possible, and I appreciate your consideration.\n\nThank you,\n[Your name]\n[Course and section]'],
  'office hours': ['Question about [topic] in [Course]', 'Hi Professor [Name],\n\nI’m in your [course, section] and I’m stuck on [specific concept/problem]. I’ve tried [what you tried], but [where you get lost].\n\nWould it be possible to meet during office hours on [day], or another time that works for you?\n\nThanks,\n[Your name]'],
  'recommendation letter': ['Recommendation letter request', 'Dear Professor [Name],\n\nI hope you’re well. I took your [course] in [term] and earned a [grade]; I especially enjoyed [specific project or topic].\n\nI’m applying to [program/job], due [date], and I’d be grateful if you would write a letter of recommendation. I’ve attached my resume, a draft statement and a list of what I did in your class to make it easier.\n\nPlease let me know if you’re able to, and if you need anything else.\n\nThank you,\n[Your name]'],
  absence: ['Absence on [date]: [Course]', 'Dear Professor [Name],\n\nI will miss class on [date] because [brief reason]. I’ll review the notes and slides, and I’ll check with a classmate about anything I missed. Please let me know if there’s anything I should complete.\n\nThank you,\n[Your name]'],
  'grade question': ['Question about my grade on [assignment]', 'Hi Professor [Name],\n\nThank you for the feedback on [assignment]. I’d like to understand [specific question/comment] so I can improve. Would you be able to explain, or could I stop by office hours?\n\nBest,\n[Your name]'],
  'research position': ['Interest in undergraduate research in your lab', 'Dear Professor [Name],\n\nI’m a [year] studying [major] at [school]. I read your paper “[title]” and was especially interested in [specific idea]. I have experience with [skills, e.g. Python, ROS 2, lab techniques], including [project].\n\nI’d love to contribute to your lab’s work on [topic] and would be glad to start with any task. My resume is attached.\n\nThank you for your time,\n[Your name]'],
  'thank you': ['Thank you', 'Dear [Name],\n\nThank you for [specific thing]. It helped me [specific impact]. I really appreciate the time you took.\n\nBest,\n[Your name]'],
  'internship inquiry': ['Internship inquiry: [role] at [company]', 'Hello [Name],\n\nI’m a [year] studying [major] at [school], and I’m interested in [role] opportunities at [company], especially your work on [specific product/project]. Recently I [relevant project with a result].\n\nWould you be open to a 15-minute call, or could you point me to the right person? My resume is attached.\n\nThank you,\n[Your name]'],
  'follow up': ['Following up: [topic]', 'Hi [Name],\n\nI’m following up on my email from [date] about [topic]. I know you’re busy, so no worries if you haven’t had a chance yet. [Restate the request in one line.]\n\nThanks again,\n[Your name]'],
  'group project': ['[Course] project: plan and roles', 'Hi everyone,\n\nTo get our [project] started, here’s a proposed plan:\n- [Name]: [task], by [date]\n- [Name]: [task], by [date]\n- [Name]: [task], by [date]\n\nCould we meet [day/time] to agree on this? Reply with any changes.\n\nThanks,\n[Your name]'],
};
const OUTLINES = {
  'argumentative essay': ['Introduction: hook, background, thesis (your claim + 2–3 reasons)', 'Body 1: reason 1 + evidence + explanation', 'Body 2: reason 2 + evidence + explanation', 'Body 3: reason 3 + evidence + explanation', 'Counterargument: the strongest opposing view, then your rebuttal', 'Conclusion: restate thesis in new words, why it matters, call to action'],
  'compare and contrast essay': ['Introduction: the two subjects and your thesis about how they relate', 'Point 1: how A and B compare on it', 'Point 2: how A and B compare on it', 'Point 3: how A and B compare on it', 'Conclusion: what the comparison reveals'],
  'lab report': ['Title', 'Abstract (purpose, method, key result, conclusion in ~150 words)', 'Introduction (background, hypothesis)', 'Methods (enough detail to repeat it)', 'Results (data tables and figures with captions, no interpretation)', 'Discussion (interpret results, compare with expected, sources of error)', 'Conclusion', 'References'],
  'research paper': ['Introduction: context, gap, research question, contribution', 'Literature review', 'Methods', 'Results', 'Discussion: meaning, limitations, future work', 'Conclusion', 'References', 'Appendix'],
  'literary analysis': ['Introduction: title, author, thesis about meaning/technique', 'Body: claim → quote → analysis (how the language creates the effect) → link to thesis (repeat 3×)', 'Conclusion: broader significance'],
  'personal statement': ['Opening scene or moment (show, don’t tell)', 'What you did and how you thought about it', 'What it taught you / how you changed', 'Connection to what you want to study and why this school/program', 'Closing image that echoes the opening'],
  'presentation': ['Title + hook (a question, number or story)', 'Why it matters', '3 main points, one per slide or section', 'Evidence/demo for each', 'Summary + one takeaway', 'Questions'],
  'cause and effect essay': ['Introduction with thesis about the cause–effect chain', 'Cause 1 → effects', 'Cause 2 → effects', 'Cause 3 → effects', 'Conclusion'],
  'rhetorical analysis': ['Introduction: text, author, audience, purpose, thesis about the strategies used', 'Ethos: how credibility is built', 'Pathos: emotional appeals', 'Logos: logic and evidence', 'Conclusion: how effective the text is overall'],
};

export const RESEARCH_RULES = [
  // citations
  [/^cite\s+(?:in\s+)?(apa|mla|chicago|harvard|ieee|vancouver)?\s*(?:style\s+)?:?\s*(?:doi\s*:?\s*)?(10\.\d{4,9}\/\S+)(?:\s+(?:in\s+)?(apa|mla|chicago|harvard|ieee|vancouver))?$/i, async (c, m, q, d) => showCitation(c, await recFromDoi(m[2], d.get), m[1] || m[3])],
  [/^cite\s+(?:in\s+)?(apa|mla|chicago|harvard|ieee|vancouver)?\s*(?:book\s+|isbn\s*:?\s*)(97[89][\d-]{10,14}|[\dX-]{10,13})(?:\s+(?:in\s+)?(apa|mla|chicago|harvard|ieee|vancouver))?$/i, async (c, m, q, d) => showCitation(c, await recFromIsbn(m[2], d.get), m[1] || m[3])],
  [/^cite\s+(?:in\s+)?(apa|mla|chicago|harvard|ieee|vancouver)?\s*(?:website\s+|url\s+|page\s+)?(https?:\/\/\S+)(?:\s+(?:in\s+)?(apa|mla|chicago|harvard|ieee|vancouver))?$/i, async (c, m, q, d) => { const r = await recFromUrl(m[2], d.get); showCitation(c, r, m[1] || m[3]); if (r.partial) c.add({ title: 'Check this one', warn: true, text: 'I couldn’t read the page (only open sites like .gov/.edu/Wikipedia can be read), so author and date are missing. Add them by hand if the page lists them.' }); }],
  [/^cite\s+(?:in\s+)?(apa|mla|chicago|harvard|ieee|vancouver)?\s*(?:the\s+)?(?:paper|article)\s+["“]?(.+?)["”]?$/i, async (c, m, q, d) => { const w = await findWork(m[2], d.get); if (!w.doi) throw new Error('Found the paper but it has no DOI to cite from.'); showCitation(c, await recFromDoi(w.doi, d.get), m[1]); }],
  [/^(?:bibliography|works cited|reference list|my references|my citations)(?:\s+(?:in\s+)?(apa|mla|chicago|harvard|ieee|vancouver))?$/i, (c, m) => bibliography(c, (m[1] || 'APA').replace(/^\w/, x => x.toUpperCase()).replace(/^(Apa|Mla|Ieee)$/, s => s.toUpperCase()))],
  [/^clear (?:my )?bibliography$/i, (c) => { bibSave([]); c.label('Bibliography'); c.add({ title: 'Cleared', text: 'Your saved citations were removed from this browser.' }); }],
  [/^(?:bibtex|bib)\s+to\s+(apa|mla|chicago|harvard|ieee|vancouver)\s*:?\s*(@[\s\S]+)$/i, (c, m) => {
    const f = (k) => { const mm = new RegExp(`\\b${k}\\s*=\\s*(?:\\{((?:[^{}]|\\{[^{}]*\\})*)\\}|"([^"]*)"|(\\w+))`, 'i').exec(m[2]); return mm ? (mm[1] ?? mm[2] ?? mm[3] ?? '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim() : ''; };
    const rec = { type: /@book/i.test(m[2]) ? 'book' : /@(?:misc|online)/i.test(m[2]) ? 'web' : 'article', authors: f('author').split(/\s+and\s+/i).filter(Boolean).map(a => (a.includes(',') ? { family: a.split(',')[0].trim(), given: a.split(',')[1].trim() } : { given: a.split(' ').slice(0, -1).join(' '), family: a.split(' ').slice(-1)[0] })), title: f('title'), container: f('journal') || f('booktitle'), year: f('year'), volume: f('volume'), issue: f('number'), pages: f('pages').replace('--', '–'), doi: f('doi'), url: f('url'), publisher: f('publisher') };
    showCitation(c, rec, m[1]);
  }],
  // papers & analytics
  [/^(?:find|look up|lookup|get)?\s*(?:the\s+)?(?:paper|article)\s+(?:called\s+|titled\s+)?["“](.+?)["”]$|^(?:find|look up|lookup)\s+(?:the\s+)?paper\s+(.+)$/i, (c, m, q, d) => paperByTitle(c, m[1] || m[2], d.get)],
  [/^(?:cited by|citations of|who cites|papers citing)\s+(.+)$/i, (c, m, q, d) => citedBy(c, m[1], d.get)],
  [/^(?:references (?:of|in|from)|bibliography of|what does (.+?) cite)\s*(.*)$/i, (c, m, q, d) => referencesOf(c, m[1] || m[2], d.get)],
  [/^(?:related to|related papers?(?: to)?|similar papers? to)\s+(.+)$/i, (c, m, q, d) => related(c, m[1], d.get)],
  [/^(?:journal|journal info|impact factor(?: of)?|venue)\s+(.+)$/i, (c, m, q, d) => journal(c, m[1], d.get)],
  [/^(?:institution|university research|research output(?: of)?)\s+(.+)$/i, (c, m, q, d) => institution(c, m[1], d.get)],
  [/^(?:trend|topic trend|research trend|how popular is research on|publications per year(?: on)?)\s+(.+)$/i, (c, m, q, d) => topicTrend(c, m[1], d.get)],
  [/^(?:open access|free (?:version|copy|pdf) of|oa)\s+(.+)$/i, (c, m, q, d) => oaFinder(c, m[1], d.get)],
  [/^(?:is it retracted|retracted|retraction check)\s+(.+)$/i, async (c, m, q, d) => { const w = await findWork(m[1], d.get); c.label('Retraction check'); c.input(w.display_name); c.add({ title: w.is_retracted ? 'Retracted' : 'Not marked as retracted', big: true, error: w.is_retracted, text: w.is_retracted ? 'This paper has been retracted. Don’t cite it as valid evidence.' : 'OpenAlex has no retraction flag for this work. For high-stakes use, also check Retraction Watch.', buttons: [{ label: 'Retraction Watch search', url: `https://retractiondatabase.org/RetractionSearch.aspx?ttl=${enc(w.display_name)}` }] }); }],
  [/^(?:preprints?|biorxiv|medrxiv)\s+(?:on\s+|about\s+)?(.+)$/i, async (c, m, q, d) => { const r = await d.get(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${enc(m[1] + ' AND SRC:PPR')}&format=json&pageSize=12&resultType=lite`); c.label('Preprints'); c.input(m[1]); c.add({ title: `${fmt(r.hitCount, 0)} preprints (bioRxiv, medRxiv, Research Square…)`, list: r.resultList.result.map(x => ({ title: x.title, url: x.doi ? `https://doi.org/${x.doi}` : `https://europepmc.org/article/PPR/${x.id}`, meta: `${x.authorString || ''} · ${x.firstPublicationDate || x.pubYear} · ${x.bookOrReportDetails ? x.bookOrReportDetails.publisher : 'preprint'}` })), note: 'Preprints are not peer-reviewed yet.' }); }],
  [/^(?:eric|education research)\s+(.+)$/i, (c, m, q, d) => eric(c, m[1], d.get)],
  [/^zenodo\s+(?:(datasets?|software|publications?)\s+)?(.+)$/i, (c, m, q, d) => zenodo(c, m[2], m[1] ? m[1].replace(/s$/, '').replace('publication', 'publication').replace('dataset', 'dataset') : '', d.get)],
  [/^(?:hugging ?face|hf)\s+(datasets?|models?)\s+(.+)$/i, (c, m, q, d) => huggingface(c, m[2], m[1].toLowerCase().startsWith('d') ? 'datasets' : 'models', d.get)],
  [/^(?:data\.gov|government data(?:sets)?|us data(?:sets)?)\s+(.+)$/i, (c, m, q, d) => datagov(c, m[1], d.get)],
  [/^(?:library of congress|loc)\s+(.+)$/i, (c, m, q, d) => loc(c, m[1], d.get)],
  [/^(?:internet archive|archive\.org|archive)\s+(texts|audio|movies|software|image)?\s*(.+)$/i, (c, m, q, d) => archive(c, m[2], m[1] || '', d.get)],
  [/^(?:scholar archive|fatcat)\s+(.+)$/i, (c, m, q, d) => fatcat(c, m[1], d.get)],
  [/^(?:free|cc|creative commons|openverse|public domain)\s+(images?|photos?|pictures?|audio|sounds?|music)\s+(?:of\s+|for\s+)?(.+)$/i, (c, m, q, d) => openverse(c, m[2], /aud|sound|music/i.test(m[1]) ? 'audio' : 'images', d.get)],
  [/^(?:wikimedia commons|commons|wikimedia)\s+(.+)$/i, (c, m, q, d) => commons(c, m[1], d.get)],
  [/^(?:quotes?|quotations?)\s+(?:by|from|of)\s+(?!the day|today)(.+)$/i, (c, m, q, d) => quotes(c, m[1], d.get)],
  [/^(?:etymology|word origin|origin of the word)\s+(?:of\s+)?(?:the\s+word\s+)?["“]?([a-z-]+)["”]?$/i, (c, m, q, d) => etymology(c, m[1], d.get)],
  // search & study
  [/^(?:search builder|build (?:a )?search|advanced search)\s*:?\s*(.+)$/i, (c, m) => searchBuilder(c, m[1])],
  [/^(?:search operators|google operators|search tips|how to search)$/i, (c) => { c.label('Search'); c.add({ title: 'Search operators', table: { head: ['Operator', 'Does'], rows: OPERATORS } }); c.add({ title: 'Build one', chips: ['search builder: robot dog "motor driver" site:edu filetype:pdf after:2020'] }); }],
  [new RegExp(`^(${Object.keys(DORKS).join('|')})\\s+(?:for|on|about)?\\s*(.+)$`, 'i'), (c, m) => { const g = DORKS[m[1].toLowerCase()](m[2]); c.label('Search'); c.input(g); c.add({ title: 'Query', mono: true, big: true, text: g, buttons: [{ label: 'Google', url: `https://www.google.com/search?q=${enc(g)}` }, { label: 'Bing', url: `https://www.bing.com/search?q=${enc(g)}` }] }); }],
  [/^(?:find (?:a |the )?pdf (?:of|for)|pdf of|download paper)\s+(.+)$/i, (c, m) => findPdf(c, m[1].replace(/^["“]|["”]$/g, ''))],
  [/^(?:free )?(?:textbooks?|open textbooks?|free books?)\s+(?:for|on|about)\s+(.+)$/i, (c, m) => textbooks(c, m[1])],
  [/^(?:free )?(?:courses?|lectures?|online classes)\s+(?:for|on|about|in)\s+(.+)$/i, (c, m) => courses(c, m[1])],
  [/^(?:email|e-mail|message)\s+(?:template\s+)?(?:to\s+(?:my\s+)?(?:professor|teacher|prof|ta|boss|recruiter)\s+)?(?:for|about|asking for|requesting)?\s*(?:an?\s+)?(extension(?: request)?|office hours|recommendation(?: letter)?|absence|missing class|grade(?: question)?|research(?: position)?|thank you|internship(?: inquiry)?|follow ?up|group project)$/i, (c, m) => { const k = Object.keys(EMAILS).find(e => e.startsWith(m[1].toLowerCase().split(' ')[0].replace('missing', 'absence').replace('followup', 'follow'))); const [subj, body] = EMAILS[k]; c.label('Email template'); c.input(k); c.add({ title: 'Subject', mono: true, text: subj }); c.add({ title: 'Body', pre: body, note: 'Fill in the [brackets]. Keep it short, specific and polite; send from your school email.' }); c.add({ title: 'Other templates', chips: Object.keys(EMAILS).filter(x => x !== k).map(x => `email template ${x}`) }); c.add({ title: 'Open', buttons: [{ label: 'Open in mail app', url: `mailto:?subject=${enc(subj)}&body=${enc(body)}` }] }); }],
  [/^(?:email templates?|emails? to professors?)$/i, (c) => { c.label('Email'); c.add({ title: 'Templates', chips: Object.keys(EMAILS).map(x => `email template ${x}`) }); }],
  [new RegExp(`^(?:outline|structure|template)\\s+(?:for\\s+)?(?:an?\\s+)?(${Object.keys(OUTLINES).join('|')})$|^(${Object.keys(OUTLINES).join('|')})\\s+(?:outline|structure|template)$`, 'i'), (c, m) => { const k = (m[1] || m[2]).toLowerCase(); c.label('Outline'); c.input(k); c.add({ title: K.cap(k), numbered: OUTLINES[k] }); const md = `# ${K.cap(k)}\n\n` + OUTLINES[k].map((x, i) => `${i + 1}. ${x}`).join('\n'); c.add(K.filesPod([{ label: 'Markdown', name: `${k.replace(/\s+/g, '-')}-outline.md`, mime: 'text/markdown', data: md }])); c.add({ title: 'Others', chips: Object.keys(OUTLINES).filter(x => x !== k).map(x => `outline for ${x}`) }); }],
  [/^(?:mla|apa)\s+(?:heading|header|title page|format)(?:\s+for\s+(.+))?$/i, (c, m, q) => { const mla = /mla/i.test(q); const d = new Date(); c.label(mla ? 'MLA' : 'APA'); if (mla) c.add({ title: 'MLA heading (top left, double-spaced)', pre: `Your Name\nProfessor Name\nCourse Number\n${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}\n\n                    Title of Your Paper`, note: 'Header: last name and page number, top right. 12 pt Times New Roman, 1-inch margins, double-spaced, first-line indent 0.5 in.' }); else c.add({ title: 'APA 7 student title page (centered, bold title)', pre: `Title of the Paper\n\nYour Name\nDepartment, University\nCourse Number: Course Name\nInstructor Name\n${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`, note: 'Page number top right on every page. 12 pt Times New Roman or 11 pt Calibri, double-spaced, 1-inch margins.' }); c.add({ title: 'LaTeX version', chips: [mla ? 'latex mla essay template' : 'latex article template'] }); }],
];
export const RESEARCH_FEATURES = ['Citations in APA, MLA, Chicago, Harvard, IEEE, Vancouver', 'BibTeX + RIS export', 'In-text citation forms', 'Cite from DOI', 'Cite from ISBN', 'Cite from a web page', 'Cite a paper by title', 'Saved bibliography (sorted, Word/.bib/.ris/.txt)', 'BibTeX → any style', 'Find paper by title (abstract, retraction status)', 'Who cites a paper (+ per-year chart)', 'A paper’s reference list', 'Related papers', 'Journal metrics', 'Institution research profile', 'Topic trends + top authors/venues/institutions', 'Open-access finder', 'Retraction check', 'Preprints', 'ERIC education research', 'Zenodo', 'Hugging Face datasets & models catalogue', 'Data.gov datasets', 'Library of Congress', 'Internet Archive', 'Scholar archive', 'Openverse CC images & audio', 'Wikimedia Commons', 'Wikiquote quotes', 'Etymology', 'Search query builder', 'Search operators', '10 study-material dorks', 'Find a PDF legally', 'Free textbooks', 'Free courses', '10 email templates', '9 essay/report outlines', 'MLA/APA headings'];
