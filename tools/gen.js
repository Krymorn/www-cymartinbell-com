// Generators: tables and files (CSV, Excel, JSON, LaTeX, Markdown, ICS), data conversion,
// sample datasets, spreadsheet templates with live formulas, schedules, and random things.
import * as K from './kit.js';

const { fmt, filesPod, tableFiles, parseTable } = K;

// ---------- sample data ----------
const FIRST = 'Ava Liam Olivia Noah Emma Mateo Sophia Lucas Mia Elijah Isabella James Amelia Ethan Harper Benjamin Evelyn Henry Aria Theo Chloe Jack Layla Leo Nora Owen Zoe Sam Maya Kai Priya Arjun Wei Mei Omar Fatima Diego Lucia Hana Kenji'.split(' ');
const LAST = 'Smith Johnson Williams Brown Jones Garcia Miller Davis Rodriguez Martinez Hernandez Lopez Gonzalez Wilson Anderson Thomas Taylor Moore Jackson Martin Lee Perez Thompson White Harris Clark Lewis Robinson Walker Young Patel Kim Nguyen Chen Singh Cohen Rossi Muller Silva Sato'.split(' ');
const CITIES = [['Boston', 'MA'], ['New York', 'NY'], ['Chicago', 'IL'], ['Austin', 'TX'], ['Seattle', 'WA'], ['Denver', 'CO'], ['Miami', 'FL'], ['Atlanta', 'GA'], ['Phoenix', 'AZ'], ['Portland', 'OR'], ['San Diego', 'CA'], ['Nashville', 'TN']];
const MAJORS = ['Biology', 'Computer Science', 'Economics', 'English', 'History', 'Mathematics', 'Mechanical Engineering', 'Physics', 'Psychology', 'Chemistry', 'Political Science', 'Art'];
const COMPANIES = ['Acme Corp', 'Globex', 'Initech', 'Umbrella Labs', 'Stark Industries', 'Wayne Enterprises', 'Hooli', 'Vandelay Imports', 'Soylent Co', 'Wonka Foods'];
const PRODUCTS = ['Notebook', 'Pen', 'Backpack', 'Laptop stand', 'Water bottle', 'Headphones', 'Desk lamp', 'Calculator', 'USB drive', 'Planner'];
const WORDS = 'river stone light cloud maple ember quiet bright north field garden signal paper silver orbit harbor meadow copper lantern velvet'.split(' ');
const randDate = (a = new Date(2024, 0, 1), b = new Date(2026, 11, 31)) => new Date(+a + Math.random() * (b - a)).toISOString().slice(0, 10);
const gauss = (m, s) => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const FIELD = {
  id: (i) => i + 1, name: () => `${K.pick(FIRST)} ${K.pick(LAST)}`, 'first name': () => K.pick(FIRST), 'last name': () => K.pick(LAST),
  email: (i, r) => `${String(r.name || K.pick(FIRST)).toLowerCase().replace(/\s+/g, '.')}${K.rint(1, 99)}@example.com`,
  age: () => K.rint(18, 65), 'student age': () => K.rint(17, 24), gpa: () => Math.min(4, Math.max(1.5, gauss(3.2, 0.45))).toFixed(2),
  grade: () => K.pick(['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'F']), score: () => Math.round(Math.min(100, Math.max(40, gauss(80, 11)))),
  'test score': () => Math.round(Math.min(100, Math.max(40, gauss(78, 12)))), height: () => Math.round(gauss(170, 9)), weight: () => Math.round(gauss(72, 12)),
  date: () => randDate(), birthday: () => randDate(new Date(1960, 0, 1), new Date(2007, 0, 1)), city: () => K.pick(CITIES)[0], state: () => K.pick(CITIES)[1],
  country: () => K.pick(['USA', 'Canada', 'Mexico', 'UK', 'Germany', 'France', 'Japan', 'India', 'Brazil', 'Australia']),
  phone: () => `(${K.rint(200, 989)}) 555-${String(K.rint(0, 9999)).padStart(4, '0')}`, major: () => K.pick(MAJORS), company: () => K.pick(COMPANIES),
  product: () => K.pick(PRODUCTS), price: () => (Math.round(gauss(25, 12) * 100) / 100).toFixed(2), quantity: () => K.rint(1, 20), salary: () => Math.round(gauss(65000, 15000) / 100) * 100,
  revenue: () => Math.round(gauss(50000, 20000)), temperature: () => (gauss(20, 8)).toFixed(1), rating: () => K.rint(1, 5), 'yes/no': () => K.pick(['Yes', 'No']), boolean: () => K.pick([true, false]),
  uuid: () => crypto.randomUUID(), color: () => K.pick(['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'black', 'white']), word: () => K.pick(WORDS),
  sentence: () => `${K.cap(K.pick(WORDS))} ${K.pick(WORDS)} ${K.pick(['near', 'over', 'beside', 'under'])} the ${K.pick(WORDS)}.`, number: () => K.rint(1, 1000), 'random number': () => K.rint(1, 1000),
  'zip code': () => String(K.rint(10000, 99999)), year: () => K.rint(2000, 2026), month: () => K.pick(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']),
  'hours studied': () => Math.max(0, gauss(10, 4)).toFixed(1), attendance: () => `${K.rint(70, 100)}%`, department: () => K.pick(['Sales', 'Engineering', 'Marketing', 'HR', 'Finance', 'Support']),
};
const ALIASES = { names: 'name', emails: 'email', ages: 'age', grades: 'grade', scores: 'score', gpas: 'gpa', cities: 'city', states: 'state', dates: 'date', prices: 'price', 'first names': 'first name', 'last names': 'last name', majors: 'major', salaries: 'salary', phones: 'phone', 'phone number': 'phone', 'phone numbers': 'phone', products: 'product', companies: 'company', countries: 'country', heights: 'height', weights: 'weight', ratings: 'rating', 'test scores': 'test score', zip: 'zip code', zips: 'zip code', 'grade point average': 'gpa', departments: 'department' };
function sampleData(ctx, n, fieldsText, what) {
  let fields = fieldsText.split(/\s*(?:,|\band\b|&|\+)\s*/).map(f => f.trim().toLowerCase().replace(/^(?:a|an|the|their|with)\s+/, '')).filter(Boolean).map(f => ALIASES[f] || f);
  if (!fields.length) fields = ['name', 'age', 'email'];
  if (!fields.includes('id')) fields.unshift('id');
  const unknown = fields.filter(f => !FIELD[f]);
  n = Math.min(Math.max(n, 1), 5000);
  const rows = [];
  for (let i = 0; i < n; i++) { const r = {}; for (const f of fields) r[f] = FIELD[f] ? FIELD[f](i, r) : `${f} ${i + 1}`; rows.push(fields.map(f => r[f])); }
  const head = fields.map(K.cap);
  ctx.label('Sample data');
  ctx.input(`${n} made-up ${what || 'rows'} with ${fields.join(', ')}`);
  ctx.add({ title: `Preview (first ${Math.min(n, 15)} of ${n})`, table: { head, rows: rows.slice(0, 15).map(r => r.map(String)) }, note: unknown.length ? `I don’t have a generator for “${unknown.join('”, “')}”, so those columns are placeholders. Known types: ${Object.keys(FIELD).join(', ')}.` : 'Randomly generated, not real people. Good for practicing spreadsheets, SQL or pandas.' });
  ctx.add(filesPod([...tableFiles(`sample-${what || 'data'}`.replace(/\s+/g, '-'), head, rows), { label: 'SQL inserts', name: 'sample.sql', mime: 'text/plain', make: () => sqlInserts(what || 'data', head, rows) }]));
}
function sqlInserts(table, head, rows) {
  const t = table.replace(/\W+/g, '_').toLowerCase();
  const cols = head.map(h => h.replace(/\W+/g, '_').toLowerCase());
  const type = (i) => (rows.every(r => r[i] === '' || !isNaN(+r[i])) ? (rows.every(r => Number.isInteger(+r[i])) ? 'INTEGER' : 'REAL') : 'TEXT');
  const v = (x) => (x === '' || x == null ? 'NULL' : !isNaN(+x) && typeof x !== 'boolean' ? x : `'${String(x).replace(/'/g, "''")}'`);
  return `CREATE TABLE ${t} (\n${cols.map((c, i) => `  ${c} ${type(i)}`).join(',\n')}\n);\n\n` + rows.map(r => `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${r.map(v).join(', ')});`).join('\n');
}

// ---------- conversions between formats ----------
async function convert(ctx, from, to, body) {
  ctx.label('Convert');
  let head = null, rows = null, obj = null;
  from = from.toLowerCase(); to = to.toLowerCase();
  if (/json/.test(from)) obj = JSON.parse(body);
  else if (/ya?ml/.test(from)) obj = (await K.loadYAML()).load(body);
  else if (/xml/.test(from)) obj = xmlToObj(new DOMParser().parseFromString(body, 'application/xml').documentElement);
  else ({ head, rows } = parseTable(body));
  if (obj && /csv|excel|xlsx|table|latex|markdown|md|html|sql|tsv/.test(to)) {
    const arr = Array.isArray(obj) ? obj : Object.values(obj).find(Array.isArray) || [obj];
    head = [...new Set(arr.flatMap(o => (o && typeof o === 'object' ? Object.keys(o) : ['value'])))];
    rows = arr.map(o => head.map(k => { const v = o && typeof o === 'object' ? o[k] : o; return v && typeof v === 'object' ? JSON.stringify(v) : v ?? ''; }));
  }
  if (!obj && rows && /json|ya?ml|xml/.test(to)) obj = head ? rows.map(r => Object.fromEntries(head.map((k, i) => [k, r[i] !== '' && !isNaN(+r[i]) ? +r[i] : r[i]]))) : rows;
  let out = '', name = 'converted', mime = 'text/plain';
  if (/^json/.test(to)) { out = JSON.stringify(obj, null, 2); name += '.json'; mime = 'application/json'; }
  else if (/ya?ml/.test(to)) { out = (await K.loadYAML()).dump(obj); name += '.yaml'; }
  else if (/xml/.test(to)) { out = '<?xml version="1.0" encoding="UTF-8"?>\n' + objToXml(obj, 'root'); name += '.xml'; mime = 'application/xml'; }
  else if (/csv/.test(to)) { out = K.toCSV(head, rows); name += '.csv'; mime = 'text/csv'; }
  else if (/tsv/.test(to)) { out = K.toTSV(head, rows); name += '.tsv'; }
  else if (/latex|tex/.test(to)) { out = K.toLatexTable(head, rows); name += '.tex'; }
  else if (/markdown|md/.test(to)) { out = K.toMarkdownTable(head, rows); name += '.md'; }
  else if (/html/.test(to)) { out = K.toHTMLTable(head, rows); name += '.html'; mime = 'text/html'; }
  else if (/sql/.test(to)) { out = sqlInserts('my_table', head || rows[0].map((_, i) => `col${i + 1}`), rows); name += '.sql'; }
  else if (/excel|xlsx/.test(to)) { ctx.input(`Table → Excel (${rows.length} rows)`); ctx.add({ title: 'Table', table: { head, rows: rows.slice(0, 50) } }); ctx.add(filesPod([{ label: 'Excel', name: 'converted.xlsx', mime: K.XLSX_MIME, make: () => K.toXLSX([{ name: 'Sheet1', head, rows }]) }])); return; }
  else throw new Error(`I can convert to JSON, YAML, XML, CSV, TSV, Excel, LaTeX, Markdown, HTML or SQL.`);
  ctx.input(`${from.toUpperCase()} → ${to.toUpperCase()}`);
  if (head || rows) ctx.add({ title: 'Read as a table', table: { head, rows: (rows || []).slice(0, 12).map(r => r.map(String)) }, note: rows && rows.length > 12 ? `${rows.length} rows in total.` : undefined });
  ctx.add({ title: 'Result', pre: out.length > 20000 ? out.slice(0, 20000) + '\n…' : out });
  ctx.add(filesPod([{ label: name, name, mime, data: out }]));
}
function xmlToObj(el) {
  const kids = [...el.children];
  if (!kids.length) return el.textContent;
  const o = {};
  for (const a of el.attributes || []) o[`@${a.name}`] = a.value;
  for (const k of kids) { const v = xmlToObj(k); if (k.tagName in o) { if (!Array.isArray(o[k.tagName])) o[k.tagName] = [o[k.tagName]]; o[k.tagName].push(v); } else o[k.tagName] = v; }
  return o;
}
function objToXml(o, tag, ind = '') {
  const t = String(tag).replace(/[^\w.-]/g, '_').replace(/^(\d)/, '_$1');
  if (Array.isArray(o)) return o.map(x => objToXml(x, t === 'root' ? 'item' : t, ind)).join('\n');
  if (o && typeof o === 'object') return `${ind}<${t}>\n${Object.entries(o).map(([k, v]) => objToXml(v, k, ind + '  ')).join('\n')}\n${ind}</${t}>`;
  return `${ind}<${t}>${String(o ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</${t}>`;
}

// ---------- spreadsheet templates with working formulas ----------
const TEMPLATES = {
  budget: { title: 'Monthly budget', head: ['Category', 'Planned', 'Actual', 'Difference'], rows: [['Rent', 900, 900], ['Groceries', 300, 0], ['Transport', 80, 0], ['Phone', 40, 0], ['Eating out', 100, 0], ['Books & supplies', 60, 0], ['Savings', 150, 0], ['Fun', 80, 0]].map((r, i) => [...r, `=B${i + 2}-C${i + 2}`]), total: true, extra: [['Income', 1800], ['Left over', '=B12-C10']] },
  'grade tracker': { title: 'Grade tracker', head: ['Assignment', 'Category', 'Score', 'Out of', 'Percent', 'Weight'], rows: [['Homework 1', 'Homework', 18, 20], ['Homework 2', 'Homework', 19, 20], ['Quiz 1', 'Quizzes', 8, 10], ['Midterm', 'Exams', 82, 100], ['Lab report', 'Labs', 45, 50], ['Final', 'Exams', '', 100]].map((r, i) => [...r, `=IF(C${i + 2}="","",C${i + 2}/D${i + 2})`, '']), extra: [['Weighted average (fill in weights per category in column F as decimals)', '=IFERROR(SUMPRODUCT(E2:E7*(E2:E7<>""),F2:F7)/SUMPRODUCT((E2:E7<>"")*F2:F7),"")']] },
  'study schedule': { title: 'Weekly study schedule', head: ['Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], rows: ['8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'].map(t => [t, '', '', '', '', '', '', '']) },
  'habit tracker': { title: 'Habit tracker', head: ['Habit', ...Array.from({ length: 31 }, (_, i) => String(i + 1)), 'Done', 'Rate'], rows: ['Exercise', 'Read 20 min', 'Sleep by 11', 'Drink water', 'Study 2 h'].map((hb, i) => [hb, ...Array(31).fill(''), `=COUNTIF(B${i + 2}:AF${i + 2},"x")`, `=AG${i + 2}/31`]) },
  'workout log': { title: 'Workout log', head: ['Date', 'Exercise', 'Sets', 'Reps', 'Weight', 'Volume'], rows: Array.from({ length: 10 }, (_, i) => ['', '', '', '', '', `=C${i + 2}*D${i + 2}*E${i + 2}`]) },
  'expense split': { title: 'Split expenses', head: ['Item', 'Paid by', 'Amount'], rows: [['Groceries', 'Ann', 60], ['Gas', 'Ben', 40], ['Tickets', 'Cy', 90]], extra: [['Total', '=SUM(C2:C4)'], ['People', 3], ['Each owes', '=B6/B7']] },
  'lab data': { title: 'Lab data', head: ['Trial', 'Independent variable', 'Measurement 1', 'Measurement 2', 'Measurement 3', 'Mean', 'Std dev', '% error vs. expected'], rows: Array.from({ length: 8 }, (_, i) => [i + 1, '', '', '', '', `=IFERROR(AVERAGE(C${i + 2}:E${i + 2}),"")`, `=IFERROR(STDEV(C${i + 2}:E${i + 2}),"")`, '']) },
  invoice: { title: 'Invoice', head: ['Description', 'Hours / qty', 'Rate', 'Amount'], rows: [['Website design', 10, 50], ['Hosting setup', 1, 75], ['Content updates', 3, 50]].map((r, i) => [...r, `=B${i + 2}*C${i + 2}`]), extra: [['Subtotal', '', '', '=SUM(D2:D4)'], ['Tax rate', '', '', 0.0625], ['Tax', '', '', '=D6*D7'], ['Total', '', '', '=D6+D8']] },
  'reading log': { title: 'Reading log', head: ['Title', 'Author', 'Pages', 'Start', 'Finish', 'Days', 'Pages/day', 'Rating'], rows: Array.from({ length: 10 }, (_, i) => ['', '', '', '', '', `=IF(E${i + 2}="","",E${i + 2}-D${i + 2})`, `=IFERROR(C${i + 2}/F${i + 2},"")`, '']) },
  'assignment tracker': { title: 'Assignment tracker', head: ['Course', 'Assignment', 'Due date', 'Days left', 'Status', 'Priority'], rows: Array.from({ length: 12 }, (_, i) => ['', '', '', `=IF(C${i + 2}="","",C${i + 2}-TODAY())`, 'Not started', '']) },
  'savings goal': { title: 'Savings goal', head: ['Month', 'Deposit', 'Balance'], rows: Array.from({ length: 12 }, (_, i) => [i + 1, 100, i ? `=C${i + 1}+B${i + 2}` : '=B2']), extra: [['Goal', 1500], ['Still needed', '=MAX(0,B15-C13)']] },
  'meal plan': { title: 'Meal plan', head: ['Day', 'Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Groceries needed'], rows: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => [d, '', '', '', '', '']) },
  'time sheet': { title: 'Time sheet', head: ['Date', 'Start', 'End', 'Break (h)', 'Hours'], rows: Array.from({ length: 7 }, (_, i) => ['', '', '', 0.5, `=IF(C${i + 2}="","",(C${i + 2}-B${i + 2})*24-D${i + 2})`]), extra: [['Total hours', '', '', '', '=SUM(E2:E8)']] },
  'project plan': { title: 'Project plan', head: ['Task', 'Owner', 'Start', 'End', 'Duration (days)', 'Status', '% done'], rows: [['Research', '', '', '', '', 'Not started', 0], ['Outline', '', '', '', '', 'Not started', 0], ['Draft', '', '', '', '', 'Not started', 0], ['Review', '', '', '', '', 'Not started', 0], ['Final', '', '', '', '', 'Not started', 0]].map((r, i) => { r[4] = `=IF(D${i + 2}="","",D${i + 2}-C${i + 2})`; return r; }) },
  'contact list': { title: 'Contacts', head: ['Name', 'Email', 'Phone', 'Organization', 'Notes'], rows: Array.from({ length: 10 }, () => ['', '', '', '', '']) },
  'inventory': { title: 'Inventory', head: ['Item', 'SKU', 'In stock', 'Reorder at', 'Unit cost', 'Value', 'Reorder?'], rows: Array.from({ length: 10 }, (_, i) => ['', '', '', '', '', `=C${i + 2}*E${i + 2}`, `=IF(C${i + 2}<=D${i + 2},"Yes","")`]) },
};
function template(ctx, key) {
  const t = TEMPLATES[key];
  ctx.label('Spreadsheet');
  ctx.input(`${t.title} template`);
  const rows = t.rows.map(r => r.map(x => x));
  if (t.total) rows.push(['Total', `=SUM(B2:B${rows.length + 1})`, `=SUM(C2:C${rows.length + 1})`, `=SUM(D2:D${rows.length + 1})`]);
  const all = [...rows, ...(t.extra ? [[], ...t.extra] : [])];
  ctx.add({ title: t.title, table: { head: t.head, rows: all.slice(0, 20).map(r => r.map(x => String(x ?? ''))) }, note: 'Cells starting with = are live formulas in the Excel file. Opens in Excel, Google Sheets (File → Import) or Numbers.' });
  ctx.add(filesPod([{ label: 'Excel (with formulas)', name: `${key.replace(/\s+/g, '-')}.xlsx`, mime: K.XLSX_MIME, make: () => K.toXLSX([{ name: t.title, head: t.head, rows: all }]) }, { label: 'CSV (values only)', name: `${key.replace(/\s+/g, '-')}.csv`, mime: 'text/csv', data: K.toCSV(t.head, all) }]));
  ctx.add({ title: 'Other templates', chips: Object.keys(TEMPLATES).filter(k => k !== key).map(k => `${k} template`) });
}

// ---------- schedules & finance tables ----------
function amortize(ctx, P, ratePct, years, extra = 0) {
  const r = ratePct / 100 / 12, n = Math.round(years * 12);
  const pay = r ? P * r / (1 - (1 + r) ** -n) : P / n;
  let bal = P, rows = [], totI = 0, m = 0;
  while (bal > 0.005 && m < n + 1) {
    m++; const i = bal * r; let pr = pay - i + extra; if (pr > bal) pr = bal; bal -= pr; totI += i;
    rows.push([m, (pr + i).toFixed(2), pr.toFixed(2), i.toFixed(2), Math.max(bal, 0).toFixed(2)]);
  }
  ctx.label('Loan');
  ctx.input(`$${fmt(P, 2)} at ${ratePct}% for ${years} years${extra ? `, +$${extra}/month extra` : ''}`);
  ctx.add({ title: 'Monthly payment', big: true, text: `$${(pay + extra).toFixed(2)}`, table: [['Payments', `${rows.length} months`], ['Total interest', `$${fmt(totI, 2)}`], ['Total paid', `$${fmt(P + totI, 2)}`]] });
  const head = ['Month', 'Payment', 'Principal', 'Interest', 'Balance'];
  ctx.add({ title: 'Schedule (first 24 months)', table: { head, rows: rows.slice(0, 24) } });
  ctx.add({ title: 'Balance over time', plot: { kind: 'line', traces: [{ name: 'Balance', x: rows.map(r => r[0]), y: rows.map(r => +r[4]) }], xtitle: 'Month', ytitle: '$' } });
  ctx.add(filesPod(tableFiles('amortization', head, rows), 'Full schedule'));
}
function savingsPlan(ctx, monthly, ratePct, years, start = 0) {
  const r = ratePct / 100 / 12; let bal = start; const rows = [];
  for (let m = 1; m <= Math.round(years * 12); m++) { const i = bal * r; bal += i + monthly; if (m % 12 === 0 || m === Math.round(years * 12)) rows.push([Math.ceil(m / 12), (start + monthly * m).toFixed(2), bal.toFixed(2), (bal - start - monthly * m).toFixed(2)]); }
  ctx.label('Savings');
  ctx.input(`$${monthly}/month at ${ratePct}% for ${years} years${start ? `, starting with $${start}` : ''}`);
  ctx.add({ title: 'Ending balance', big: true, text: `$${fmt(bal, 2)}`, note: 'Monthly compounding, deposits at the end of each month.' });
  const head = ['Year', 'Deposited', 'Balance', 'Interest earned'];
  ctx.add({ title: 'By year', table: { head, rows } });
  ctx.add({ title: 'Growth', plot: { kind: 'line', traces: [{ name: 'Balance', x: rows.map(r => r[0]), y: rows.map(r => +r[2]) }, { name: 'Deposited', x: rows.map(r => r[0]), y: rows.map(r => +r[1]) }], xtitle: 'Year', ytitle: '$' } });
  ctx.add(filesPod(tableFiles('savings-plan', head, rows)));
}

// ---------- calendar files ----------
function icsDate(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
function makeICS(events) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//cymartinbell.com//tools//EN', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${crypto.randomUUID()}@cymartinbell.com`, `DTSTAMP:${icsDate(new Date())}`);
    if (e.allDay) { const d = e.start.toISOString().slice(0, 10).replace(/-/g, ''); const n = new Date(+e.start + 864e5).toISOString().slice(0, 10).replace(/-/g, ''); lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${n}`); }
    else lines.push(`DTSTART:${icsDate(e.start)}`, `DTEND:${icsDate(e.end)}`);
    lines.push(`SUMMARY:${e.title.replace(/[,;]/g, '\\$&')}`);
    if (e.rrule) lines.push(`RRULE:${e.rrule}`);
    if (e.alarm) lines.push('BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', `DESCRIPTION:${e.title}`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
function eventFile(ctx, title, dateText, parseDate, timeText, durText, repeat) {
  const d = parseDate(dateText);
  if (!d) throw new Error(`I couldn’t read the date “${dateText}”.`);
  let allDay = !timeText, start = new Date(d);
  if (timeText) { const m = /(\d{1,2})(?::(\d\d))?\s*(am|pm)?/i.exec(timeText); let hh = +m[1] % 12 + (/pm/i.test(m[3] || '') || (!m[3] && +m[1] < 8) ? 12 : 0); if (/noon/i.test(timeText)) hh = 12; start.setHours(hh, +(m[2] || 0), 0, 0); }
  let mins = 60;
  if (durText) { const h = /(\d+(?:\.\d+)?)\s*h/i.exec(durText), mm = /(\d+)\s*m(?!o)/i.exec(durText); mins = (h ? +h[1] * 60 : 0) + (mm ? +mm[1] : 0) || 60; }
  const end = new Date(+start + mins * 60000);
  const rr = repeat ? { daily: 'FREQ=DAILY', weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' }[repeat.toLowerCase()] : null;
  const ics = makeICS([{ title, start, end, allDay, rrule: rr, alarm: !allDay }]);
  ctx.label('Calendar');
  ctx.input(`${title}: ${start.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', ...(allDay ? {} : { hour: 'numeric', minute: '2-digit' }) })}${allDay ? ' (all day)' : `, ${mins} min`}${rr ? `, repeats ${repeat}` : ''}`);
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${K.enc(title)}&dates=${allDay ? `${icsDate(start).slice(0, 8)}/${icsDate(new Date(+start + 864e5)).slice(0, 8)}` : `${icsDate(start)}/${icsDate(end)}`}`;
  ctx.add(filesPod([{ label: 'Calendar file (.ics)', name: `${title.replace(/\W+/g, '-').toLowerCase()}.ics`, mime: 'text/calendar', data: ics }], 'Add to your calendar', 'The .ics file opens in Apple Calendar, Outlook and Google Calendar (Import).'));
  ctx.add({ title: 'Or', buttons: [{ label: 'Add to Google Calendar', url: gcal }] });
}
function studyPlan(ctx, items, parseDate) {
  // "study plan: biology exam dec 10, calc exam dec 14"
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exams = items.map(x => { const m = /^(.+?)\s+(?:on\s+)?((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\.?\s+\d{1,2}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|tomorrow|next \w+|\w+day)$/i.exec(x.trim()); return m ? { name: m[1].trim(), date: parseDate(m[2]) } : null; }).filter(e => e && e.date && e.date > today).sort((a, b) => a.date - b.date);
  if (!exams.length) throw new Error('List exams like “study plan: biology exam dec 10, calculus exam dec 14”.');
  const last = exams[exams.length - 1].date;
  const rows = [], events = [];
  for (let d = new Date(+today + 864e5); d <= last; d = new Date(+d + 864e5)) {
    const upcoming = exams.filter(e => e.date >= d);
    // weight each exam by how close it is (spaced practice, more time as it nears)
    const w = upcoming.map(e => 1 / Math.max(1, (e.date - d) / 864e5));
    const tot = K.sum(w);
    const blocks = upcoming.map((e, i) => ({ e, h: Math.round((3 * w[i] / tot) * 2) / 2 })).filter(b => b.h > 0);
    const isExam = exams.find(e => +e.date === +d);
    rows.push([d.toISOString().slice(0, 10), d.toLocaleDateString('en-US', { weekday: 'short' }), isExam ? `EXAM: ${isExam.name}` : blocks.map(b => `${b.e.name} ${b.h} h`).join(' · ')]);
    if (!isExam) blocks.forEach((b, i) => { const s = new Date(d); s.setHours(16 + i * 1, 0, 0, 0); events.push({ title: `Study: ${b.e.name}`, start: s, end: new Date(+s + b.h * 3600e3) }); });
  }
  ctx.label('Study plan');
  ctx.input(`${exams.length} exam${exams.length > 1 ? 's' : ''}, ${rows.length} days`);
  const head = ['Date', 'Day', 'Plan (about 3 hours a day)'];
  ctx.add({ title: 'Plan', table: { head, rows }, note: 'Time is shared between upcoming exams, with more going to whichever is closest. Mix in practice problems and self-testing rather than rereading.' });
  ctx.add(filesPod([...tableFiles('study-plan', head, rows).slice(0, 2), { label: 'Calendar (.ics)', name: 'study-plan.ics', mime: 'text/calendar', make: () => makeICS(events) }]));
}

// ---------- random ----------
function passphrase(n) { return Array.from({ length: n }, () => WORDS[K.secureInt(WORDS.length)] + K.secureInt(10)).join('-'); }
function password(n, simple) {
  const sets = simple ? ['abcdefghijkmnpqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789'] : ['abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '0123456789', '!@#$%^&*()-_=+[]{};:,.?'];
  const all = sets.join('');
  let p = sets.map(s => s[K.secureInt(s.length)]);
  while (p.length < n) p.push(all[K.secureInt(all.length)]);
  for (let i = p.length - 1; i > 0; i--) { const j = K.secureInt(i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  return p.join('');
}
const LOREM = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum'.split(' ');
function lorem(paras) { return Array.from({ length: paras }, () => { const s = Array.from({ length: K.rint(4, 7) }, () => { const w = Array.from({ length: K.rint(8, 16) }, () => K.pick(LOREM)); return K.cap(w.join(' ')) + '.'; }); return s.join(' '); }).join('\n\n'); }

export const GEN_RULES = [
  // sample data
  [/^(?:generate|make|create|give me)?\s*(?:a\s+)?(?:fake|sample|random|dummy|mock|test)\s+(?:data(?:set)?|csv|spreadsheet|table|excel(?: sheet)?)\s*(?:of|with|for)?\s*(\d+)?\s*([a-z ]+?)?\s*(?:with|having|columns?:?|fields?:?)\s+(.+)$/i, (c, m) => sampleData(c, +(m[1] || 50), m[3], (m[2] || '').trim())],
  [/^(?:generate|make|create)\s+(?:a\s+)?(?:csv|spreadsheet|excel(?: sheet)?|dataset|table)\s+of\s+(\d+)\s+(?:random\s+|fake\s+|sample\s+)?([a-z ]+?)\s+with\s+(.+)$/i, (c, m) => sampleData(c, +m[1], m[3], m[2])],
  [/^(\d+)\s+(?:random|fake|sample)\s+([a-z ]+?)\s+with\s+(.+)$/i, (c, m) => sampleData(c, +m[1], m[3], m[2])],
  // build a table/csv/excel from inline data
  [/^(?:make|create|build|turn (?:this|it) into)\s+(?:a\s+|an\s+)?(csv|excel(?: file| sheet)?|spreadsheet|xlsx|table|latex table|markdown table|json)\s*(?:from|of|with)?\s*:\s*([\s\S]+)$/i, async (c, m) => {
    const { head, rows } = parseTable(m[2]);
    c.label('Table'); c.input(`${rows.length} rows × ${(head || rows[0]).length} columns`);
    c.add({ title: 'Table', table: { head, rows } });
    const want = m[1].toLowerCase();
    if (/latex/.test(want)) c.add({ title: 'LaTeX', pre: K.toLatexTable(head, rows) });
    if (/markdown/.test(want)) c.add({ title: 'Markdown', pre: K.toMarkdownTable(head, rows) });
    c.add(filesPod(tableFiles('table', head, rows)));
  }],
  // conversions
  [/^(?:convert\s+)?(json|csv|tsv|ya?ml|xml|table|markdown table)\s+(?:to|→|->|into)\s+(json|csv|tsv|ya?ml|xml|excel|xlsx|latex|tex|markdown|md|html|sql)\s*:?\s*([\s\S]+)$/i, (c, m) => convert(c, m[1], m[2], m[3])],
  // spreadsheet templates
  [new RegExp(`^(?:(?:make|create|give me)\\s+(?:a|an|me a)?\\s*)?(${Object.keys(TEMPLATES).join('|')})(?:\\s+(?:template|spreadsheet|sheet|excel|tracker))*$`, 'i'), (c, m) => template(c, m[1].toLowerCase())],
  [/^(?:spreadsheet|excel|sheet)\s+templates?$/i, (c) => { c.label('Spreadsheet'); c.input('Templates with working formulas'); c.add({ title: 'Pick one', chips: Object.keys(TEMPLATES).map(k => `${k} template`) }); }],
  // loans & savings
  [/^(?:amortization|amortisation|loan)\s*(?:schedule|table)?\s*(?:for\s+)?\$?([\d,.]+)\s*(k)?\s*(?:at|@)\s*([\d.]+)\s*%\s*(?:for|over)\s*([\d.]+)\s*(years?|yrs?|months?)(?:\s*(?:with|\+)\s*\$?([\d.]+)\s*extra)?/i, (c, m) => amortize(c, parseFloat(m[1].replace(/,/g, '')) * (m[2] ? 1000 : 1), +m[3], /^m/i.test(m[5]) ? +m[4] / 12 : +m[4], +(m[6] || 0))],
  [/^(?:savings|save|saving plan|savings plan)\s*(?:of\s+)?\$?([\d,.]+)\s*(?:a|per|\/|each)\s*month\s*(?:at|@)\s*([\d.]+)\s*%\s*(?:for|over)\s*([\d.]+)\s*years?(?:\s*(?:starting with|with|from)\s*\$?([\d,.]+))?/i, (c, m) => savingsPlan(c, +m[1].replace(/,/g, ''), +m[2], +m[3], +(m[4] || '0').replace(/,/g, ''))],
  // multiplication / times tables
  [/^(?:multiplication|times)\s+table\s*(?:of|for|up to)?\s*(\d+)?(?:\s*(?:x|by|to)\s*(\d+))?$/i, (c, m) => {
    const a = Math.min(+(m[1] || 12), 30), b = Math.min(+(m[2] || a), 30);
    const head = ['×', ...Array.from({ length: b }, (_, i) => String(i + 1))];
    const rows = Array.from({ length: a }, (_, i) => [String(i + 1), ...Array.from({ length: b }, (_, j) => String((i + 1) * (j + 1)))]);
    c.label('Table'); c.input(`${a} × ${b} multiplication table`); c.add({ title: 'Table', table: { head, rows } }); c.add(filesPod(tableFiles('times-table', head, rows)));
  }],
  // calendar events and study plans
  [/^(?:calendar event|event|add (?:an? )?event|ics|remind me of|schedule)\s*:?\s*(.+?)\s+(?:on|for)\s+(.+?)(?:\s+(?:at|@)\s+(\d{1,2}(?::\d\d)?\s*(?:am|pm)?|noon))?(?:\s+for\s+(\d+(?:\.\d+)?\s*(?:hours?|h|hrs?)(?:\s*\d+\s*m(?:in(?:utes?)?)?)?|\d+\s*m(?:in(?:utes?)?)?))?(?:\s+(?:every|repeating|repeats?)\s+(day|daily|week|weekly|month|monthly|year|yearly))?$/i, (c, m, q, d) => eventFile(c, m[1].trim(), m[2].trim(), d.parseDate, m[3], m[4], m[5] && ({ day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' }[m[5].toLowerCase()] || m[5]))],
  [/^(?:study plan|study schedule|exam plan|revision plan)\s*(?:for)?\s*:?\s*(.+)$/i, (c, m, q, d) => studyPlan(c, m[1].split(/\s*(?:,|;|\band\b)\s*/), d.parseDate)],
  // random things
  [/^(?:random number|rand|pick a number|random integer)\s*(?:between|from)?\s*(-?\d+)?\s*(?:-|to|and)?\s*(-?\d+)?$/i, (c, m) => { const a = +(m[1] ?? 1), b = +(m[2] ?? (m[1] ? m[1] : 100)); const lo = Math.min(a, m[2] ? b : 1), hi = Math.max(a, b); c.label('Random'); c.input(`Whole number from ${lo} to ${hi}`); c.add({ title: 'Result', big: true, text: String(K.rint(lo, hi)), chips: [`random number ${lo} to ${hi}`] }); }],
  [/^(?:pick|choose|select)\s+(?:a\s+random\s+|one\s+|randomly\s+)?(?:from|between|among|one of)?\s*:?\s*(.+,.+)$/i, (c, m) => { const opts = m[1].split(/\s*,\s*|\s+or\s+/).filter(Boolean); c.label('Random'); c.input(`One of ${opts.length}`); c.add({ title: 'Picked', big: true, text: K.pick(opts), chips: [m[0]] }); }],
  [/^shuffle\s*:?\s*(.+)$/i, (c, m) => { const opts = m[1].split(/\s*,\s*/); c.label('Random'); c.input(`Shuffle ${opts.length} items`); c.add({ title: 'Shuffled', numbered: K.shuffle(opts), chips: [m[0]] }); }],
  [/^(?:make |split into |random )?(\d+)\s+(?:random\s+)?(?:teams|groups)\s+(?:from|of|with)\s*:?\s*(.+)$/i, (c, m) => { const ppl = K.shuffle(m[2].split(/\s*,\s*/)); const k = +m[1]; const g = Array.from({ length: k }, () => []); ppl.forEach((p, i) => g[i % k].push(p)); c.label('Random'); c.input(`${ppl.length} people into ${k} groups`); c.add({ title: 'Groups', table: g.map((x, i) => [`Group ${i + 1}`, x.join(', ')]), chips: [m[0]] }); }],
  [/^(?:make |split into |random )?(?:teams|groups) of (\d+)\s+(?:from|with|for)\s*:?\s*(.+)$/i, (c, m, q, d) => { const n = m[2].split(/\s*,\s*/).length; return GEN_RULES.find(r => r[0].source.startsWith('^(?:make |split into |random )?(\\d+)'))[1](c, [m[0], String(Math.max(1, Math.round(n / +m[1]))), m[2]], q, d); }],
  [/^(?:roll\s+)?(\d*)d(\d+)(?:\s*([+-])\s*(\d+))?$/i, (c, m) => { const n = Math.min(+(m[1] || 1), 100), s = +m[2]; const r = Array.from({ length: n }, () => K.rint(1, s)); const mod = m[3] ? (m[3] === '+' ? 1 : -1) * +m[4] : 0; c.label('Dice'); c.input(`${n}d${s}${mod ? (mod > 0 ? '+' : '') + mod : ''}`); c.add({ title: 'Total', big: true, text: String(K.sum(r) + mod), table: [['Rolls', r.join(', ')], ['Possible range', `${n + mod} to ${n * s + mod}`], ['Average', String(n * (s + 1) / 2 + mod)]], chips: [m[0]] }); }],
  [/^(?:roll (?:a |the )?dice?|roll a die)$/i, (c) => { c.label('Dice'); c.add({ title: 'Rolled', big: true, text: String(K.rint(1, 6)), chips: ['roll a die', '2d6', '1d20'] }); }],
  [/^(?:flip|toss) (?:a )?coin(?:\s+(\d+)\s+times)?$/i, (c, m) => { const n = Math.min(+(m[1] || 1), 10000); const r = Array.from({ length: n }, () => (Math.random() < 0.5 ? 'H' : 'T')); const h = r.filter(x => x === 'H').length; c.label('Coin'); c.input(`${n} flip${n > 1 ? 's' : ''}`); c.add({ title: n === 1 ? 'Result' : 'Results', big: true, text: n === 1 ? (r[0] === 'H' ? 'Heads' : 'Tails') : `${h} heads, ${n - h} tails`, note: n > 1 && n <= 200 ? r.join(' ') : undefined, chips: ['flip a coin', 'flip a coin 100 times'] }); }],
  [/^(?:generate (?:a )?)?(?:strong |secure |random )?password(?:\s+(\d+))?(?:\s+(?:chars?|characters))?(\s+(?:simple|easy|no symbols))?$/i, (c, m) => { const n = Math.min(Math.max(+(m[1] || 16), 6), 128); c.label('Password'); c.input(`${n} characters, made with your browser’s secure random generator`); c.add({ title: 'Password', big: true, mono: true, text: password(n, !!m[2]) }); c.add({ title: 'Also', table: [['Passphrase (easier to type)', passphrase(5)], ['Another', password(n, !!m[2])]], chips: [m[0]] }); c.add({ title: 'Note', note: 'Generated on your device and never sent anywhere. Use a password manager to store it.' }); }],
  [/^(?:generate (?:a )?)?passphrase(?:\s+(\d+))?$/i, (c, m) => { c.label('Password'); c.add({ title: 'Passphrase', big: true, mono: true, text: passphrase(+(m[1] || 5)), chips: [m[0]] }); }],
  [/^(?:uuid|guid)s?(?:\s+(\d+))?$|^(?:generate|new) (?:a )?(?:uuid|guid)$/i, (c, m) => { const n = Math.min(+(m && m[1] || 1), 100); c.label('UUID'); c.input(`${n} random version-4 UUID${n > 1 ? 's' : ''}`); c.add({ title: 'UUID', mono: true, pre: Array.from({ length: n }, () => crypto.randomUUID()).join('\n') }); }],
  [/^(?:lorem(?: ipsum)?|placeholder text|filler text)\s*(\d+)?\s*(?:paragraphs?|paras?)?$/i, (c, m) => { const t = lorem(Math.min(+(m[1] || 3), 20)); c.label('Text'); c.add({ title: 'Lorem ipsum', text: t }); c.add(filesPod([{ label: 'Text file', name: 'lorem.txt', mime: 'text/plain', data: t }])); }],
  [/^random (?:date)(?:\s+between\s+(.+?)\s+and\s+(.+))?$/i, (c, m, q, d) => { const a = m[1] ? d.parseDate(m[1]) : new Date(2000, 0, 1), b = m[2] ? d.parseDate(m[2]) : new Date(); c.label('Random'); c.add({ title: 'Date', big: true, text: new Date(+a + Math.random() * (b - a)).toDateString() }); }],
  [/^random (?:colou?r|hex colou?r)$/i, (c, m, q, d) => { const hex = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'); c.label('Random'); c.add({ title: 'Color', big: true, text: hex, swatch: hex, chips: [hex, 'random color'] }); }],
  [/^random (?:name|names)(?:\s+(\d+))?$/i, (c, m) => { const n = Math.min(+(m[1] || 10), 500); c.label('Random'); c.add({ title: 'Names', numbered: Array.from({ length: n }, () => `${K.pick(FIRST)} ${K.pick(LAST)}`) }); }],
  // barcodes
  [/^barcode\s+(.+)$/i, async (c, m) => {
    await K.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js', 'JsBarcode');
    c.label('Barcode'); c.input(`Code 128 barcode for “${m[1]}”`);
    c.add({ title: 'Barcode', custom: (el) => { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); el.append(svg); window.JsBarcode(svg, m[1], { format: 'CODE128', displayValue: true }); const b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.textContent = '⬇ SVG'; b.onclick = () => K.download('barcode.svg', new XMLSerializer().serializeToString(svg), 'image/svg+xml'); el.append(b); } });
  }],
];
export const GEN_FEATURES = ['Sample datasets (40 field types) to CSV/Excel/JSON/SQL', 'Tables from pasted data', 'JSON/CSV/TSV/YAML/XML/Markdown conversions', 'CSV → LaTeX/Markdown/HTML/SQL', '16 spreadsheet templates with formulas', 'Loan amortization schedules', 'Savings plans', 'Multiplication tables', 'Calendar events (.ics + Google Calendar)', 'Exam study plans (+ .ics)', 'Random numbers, picks, shuffles, teams, dice, coins', 'Secure passwords and passphrases', 'UUIDs', 'Lorem ipsum', 'Random dates, colors, names', 'Barcodes'];
