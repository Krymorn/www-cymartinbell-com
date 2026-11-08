// More data sources for /tools (see sources.js for the shared fetch helper).
import { get, enc, countryCode } from './sources.js';

const cut = (s, n = 400) => (s && s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s || '');
const strip = (html) => { if (!html) return ''; const d = new DOMParser().parseFromString(html, 'text/html'); return (d.body.textContent || '').replace(/\s+/g, ' ').trim(); };
const fmt = (n, d = 2) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d }));
const big = (n) => { const a = Math.abs(n); return a >= 1e9 ? (n / 1e9).toFixed(2) + ' billion' : a >= 1e6 ? (n / 1e6).toFixed(2) + ' million' : fmt(n, 0); };
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const safe = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);

async function geo(place) {
  const d = await get(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=${enc(place.replace(/,.*$/, '').trim())}`);
  const r = d.results && d.results[0];
  if (!r) throw new Error(`Couldn't find a place called "${place}".`);
  r.label = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
  return r;
}

// ---------- countries & places ----------
export async function country(ctx, name) {
  ctx.label('Country');
  const cc = countryCode(name);
  if (!cc) throw new Error(`I don't recognise "${name}" as a country.`);
  const [info, ...ind] = await Promise.all([
    get(`https://api.worldbank.org/v2/country/${cc}?format=json`),
    ...['SP.POP.TOTL', 'NY.GDP.MKTP.CD', 'NY.GDP.PCAP.CD', 'AG.LND.TOTL.K2', 'SP.DYN.LE00.IN', 'SP.URB.TOTL.IN.ZS', 'IT.NET.USER.ZS'].map(code => get(`https://api.worldbank.org/v2/country/${cc}/indicator/${code}?format=json&mrnev=1`).catch(() => null)),
  ]);
  const c = info[1][0];
  const v = (i) => { const p = ind[i] && ind[i][1] && ind[i][1][0]; return p && p.value != null ? p : null; };
  const row = (label, i, f) => { const p = v(i); return p ? [label, `${f(p.value)} (${p.date})`] : null; };
  ctx.input(c.name);
  ctx.add({ title: c.name, image: `https://flagcdn.com/w320/${cc.toLowerCase()}.png`, imageSide: true, table: [
    ['Capital', c.capitalCity || '—'], ['Region', c.region.value], ['Income level', c.incomeLevel.value],
    row('Population', 0, big), row('GDP', 1, x => '$' + big(x)), row('GDP per person', 2, x => '$' + fmt(x, 0)), row('Land area', 3, x => `${fmt(x, 0)} km² (${fmt(x * 0.386102, 0)} mi²)`),
    row('Life expectancy', 4, x => `${fmt(x, 1)} years`), row('Living in cities', 5, x => `${fmt(x, 1)}%`), row('Internet users', 6, x => `${fmt(x, 1)}%`),
  ].filter(Boolean) });
  ctx.add({ title: 'More about it', chips: [`population of ${c.name}`, `gdp of ${c.name}`, `life expectancy in ${c.name}`, `holidays in ${c.name}`, `time in ${c.capitalCity || c.name}`, `weather in ${c.capitalCity || c.name}`, `wiki ${c.name}`] });
  ctx.source('World Bank', `https://data.worldbank.org/country/${cc}`);
}

export async function zip(ctx, code, cc = 'us') {
  ctx.label('Postal code');
  const r = await get(`https://api.zippopotam.us/${cc}/${enc(code)}`);
  ctx.input(`${r['post code']} (${r.country})`);
  ctx.add({ title: 'Places', table: { head: ['Place', 'State', 'Coordinates'], rows: r.places.map(p => [p['place name'], p.state, `${p.latitude}, ${p.longitude}`]) } });
  ctx.add({ title: 'More', chips: [`weather in ${r.places[0]['place name']}, ${r.places[0]['state abbreviation'] || r.places[0].state}`, `sunrise in ${r.places[0]['place name']}`] });
}

export async function tides(ctx, place) {
  ctx.label('Tides');
  const g = await geo(place);
  const st = await get('https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions');
  const d2 = (s) => (s.lat - g.latitude) ** 2 + ((s.lng - g.longitude) * Math.cos(g.latitude * Math.PI / 180)) ** 2;
  const best = st.stations.reduce((a, b) => (d2(b) < d2(a) ? b : a));
  const km = Math.sqrt(d2(best)) * 111;
  if (km > 150) throw new Error('No US tide station near there (NOAA covers US coasts).');
  ctx.input(`Tides near ${g.label}`);
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const r = await get(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${best.id}&product=predictions&datum=MLLW&time_zone=lst_ldt&units=english&format=json&interval=hilo&begin_date=${day}&range=72`);
  ctx.add({ title: `Station: ${best.name}, ${best.state} (${fmt(km * 0.621, 1)} mi away)`, table: { head: ['When', 'Tide', 'Height'], rows: r.predictions.map(p => [new Date(p.t.replace(' ', 'T')).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }), p.type === 'H' ? 'High' : 'Low', `${(+p.v).toFixed(1)} ft`]) } });
  const h = await get(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${best.id}&product=predictions&datum=MLLW&time_zone=lst_ldt&units=english&format=json&interval=30&begin_date=${day}&range=48`);
  ctx.add({ title: 'Next 48 hours', plot: { kind: 'line', xdate: true, ytitle: 'ft', traces: [{ name: 'water level', x: h.predictions.map(p => p.t.replace(' ', 'T')), y: h.predictions.map(p => +p.v) }] } });
  ctx.source('NOAA Tides & Currents', `https://tidesandcurrents.noaa.gov/stationhome.html?id=${best.id}`);
}

export async function pastWeather(ctx, place, date) {
  ctx.label('Weather history');
  const g = await geo(place);
  const iso = date.toISOString().slice(0, 10);
  ctx.input(`Weather in ${g.label} on ${date.toLocaleDateString('en-US', { dateStyle: 'long' })}`);
  const r = await get(`https://archive-api.open-meteo.com/v1/archive?latitude=${g.latitude}&longitude=${g.longitude}&start_date=${iso}&end_date=${iso}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_speed_10m_max&temperature_unit=fahrenheit&precipitation_unit=inch&wind_speed_unit=mph&timezone=auto`);
  const d = r.daily;
  ctx.add({ title: 'That day', table: [['High', `${Math.round(d.temperature_2m_max[0])}°F`], ['Low', `${Math.round(d.temperature_2m_min[0])}°F`], ['Rain/melted snow', `${d.precipitation_sum[0]} in`], ['Snowfall', `${(d.snowfall_sum[0] / 2.54).toFixed(1)} in`], ['Max wind', `${Math.round(d.wind_speed_10m_max[0])} mph`]] });
  ctx.source('Open-Meteo historical weather', 'https://open-meteo.com/en/docs/historical-weather-api');
}

// ---------- science ----------
let periodic = null;
export async function element(ctx, q) {
  ctx.label('Element');
  if (!periodic) periodic = (await get('https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON')).Table;
  const cols = periodic.Columns.Column;
  const rows = periodic.Row.map(r => Object.fromEntries(cols.map((c, i) => [c, r.Cell[i]])));
  const k = q.trim().toLowerCase();
  const e = rows.find(r => r.Name.toLowerCase() === k || r.Symbol.toLowerCase() === k || r.AtomicNumber === k);
  if (!e) throw new Error(`No element called "${q}".`);
  ctx.input(`${e.Name} (${e.Symbol})`);
  ctx.add({ title: `${e.AtomicNumber} · ${e.Symbol} · ${e.Name}`, big: true, text: e.GroupBlock, table: [['Atomic mass', `${e.AtomicMass} u`], ['Electron configuration', e.ElectronConfiguration], ['Standard state', e.StandardState], ['Melting point', e.MeltingPoint ? `${e.MeltingPoint} K (${fmt(+e.MeltingPoint - 273.15, 1)} °C)` : '—'], ['Boiling point', e.BoilingPoint ? `${e.BoilingPoint} K (${fmt(+e.BoilingPoint - 273.15, 1)} °C)` : '—'], ['Density', e.Density ? `${e.Density} g/cm³` : '—'], ['Electronegativity', e.Electronegativity || '—'], ['Oxidation states', e.OxidationStates || '—'], ['Atomic radius', e.AtomicRadius ? `${e.AtomicRadius} pm` : '—'], ['Ionization energy', e.IonizationEnergy ? `${e.IonizationEnergy} eV` : '—'], ['Discovered', e.YearDiscovered]] });
  ctx.add({ title: 'More', chips: [`compound ${e.Name}`, `wiki ${e.Name}`] });
  ctx.source('PubChem periodic table', 'https://pubchem.ncbi.nlm.nih.gov/periodic-table/');
}

export async function apod(ctx) {
  ctx.label('Space');
  let r;
  try { r = await get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&thumbs=true'); }
  catch (_) {
    ctx.input('Astronomy Picture of the Day');
    ctx.add({ title: 'NASA’s picture service is busy', text: 'The shared free key is rate-limited right now. Open today’s picture directly:', buttons: [{ label: 'Today’s picture on apod.nasa.gov', url: 'https://apod.nasa.gov/apod/astropix.html' }] });
    return;
  }
  ctx.input(`Astronomy Picture of the Day: ${r.title}`);
  ctx.add({ title: r.title, image: r.media_type === 'image' ? safe(r.url) : safe(r.thumbnail_url), text: r.explanation, note: r.copyright ? `© ${r.copyright.trim()}` : undefined, links: [{ label: 'Full resolution', url: r.hdurl || r.url }] });
  ctx.source('NASA APOD', 'https://apod.nasa.gov');
}

export async function asteroids(ctx) {
  ctx.label('Space');
  ctx.input('Asteroids passing close to Earth in the next 60 days');
  const r = await get('https://ssd-api.jpl.nasa.gov/cad.api?date-min=now&date-max=%2B60&dist-max=0.05&sort=date', { proxy: true });
  const i = Object.fromEntries(r.fields.map((f, k) => [f, k]));
  ctx.add({ title: `${r.count} close approaches (within 0.05 AU)`, table: { head: ['Object', 'Date', 'Distance', 'Speed', 'Size (est.)'], rows: r.data.slice(0, 20).map(d => [d[i.des], d[i.cd].slice(0, 11), `${fmt(+d[i.dist] * 389.17, 1)} × Moon distance`, `${fmt(+d[i.v_rel] * 2236.94, 0)} mph`, d[i.h] ? `~${fmt(1329 / Math.sqrt(0.14) * Math.pow(10, -0.2 * +d[i.h]) * 1000, 0)} m` : '—']) }, note: 'Size is estimated from brightness, so treat it as rough.' });
  ctx.source('NASA JPL Center for Near-Earth Object Studies', 'https://cneos.jpl.nasa.gov/ca/');
}

export async function exoplanet(ctx, q) {
  ctx.label('Exoplanets');
  const term = q.replace(/'/g, '').toLowerCase();
  const sql = `select pl_name,hostname,disc_year,discoverymethod,pl_orbper,pl_rade,pl_bmasse,pl_eqt,sy_dist from ps where default_flag=1 and (lower(pl_name) like '%${term}%' or lower(hostname) like '%${term}%')`;
  const r = await get(`https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=${enc(sql)}&format=json`, { proxy: true, timeout: 25000 });
  if (!r.length) throw new Error('No confirmed exoplanets match that.');
  ctx.input(`Exoplanets matching “${q}”`);
  ctx.add({ title: `${r.length} planet${r.length > 1 ? 's' : ''}`, table: { head: ['Planet', 'Found', 'Method', 'Year length', 'Radius (Earth = 1)', 'Mass (Earth = 1)', 'Temp.', 'Distance'], rows: r.slice(0, 30).map(p => [p.pl_name, String(p.disc_year), p.discoverymethod, p.pl_orbper ? `${fmt(p.pl_orbper, 2)} days` : '—', fmt(p.pl_rade, 2), fmt(p.pl_bmasse, 2), p.pl_eqt ? `${fmt(p.pl_eqt, 0)} K` : '—', p.sy_dist ? `${fmt(p.sy_dist * 3.2616, 1)} ly` : '—']) } });
  ctx.source('NASA Exoplanet Archive', 'https://exoplanetarchive.ipac.caltech.edu');
}

// ---------- history & culture ----------
export async function onThisDay(ctx, month, day) {
  ctx.label('History');
  const d = new Date(2024, month - 1, day);
  ctx.input(`On this day: ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`);
  const r = await get(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`);
  const pick = (arr, n) => (arr || []).slice(0, n).map(e => ({ title: `${e.year}`, snippet: e.text, url: e.pages && e.pages[0] && e.pages[0].content_urls ? e.pages[0].content_urls.desktop.page : null }));
  if (r.selected && r.selected.length) ctx.add({ title: 'Highlights', list: pick(r.selected, 6) });
  ctx.add({ title: 'Events', list: pick(r.events, 10) });
  ctx.add({ title: 'Born', list: pick(r.births, 8) });
  ctx.source('Wikipedia', 'https://en.wikipedia.org');
}

export async function art(ctx, q) {
  ctx.label('Art');
  ctx.input(q);
  let r;
  try { r = await get(`https://api.artic.edu/api/v1/artworks/search?q=${enc(q)}&limit=8&fields=id,title,artist_display,date_display,image_id,medium_display,place_of_origin`); }
  catch (_) { return metArt(ctx, q); }
  if (!r.data.length) return metArt(ctx, q);
  const base = r.config.iiif_url;
  ctx.add({ title: 'Art Institute of Chicago', list: r.data.map(a => ({ title: a.title, url: `https://www.artic.edu/artworks/${a.id}`, meta: [a.artist_display && a.artist_display.split('\n')[0], a.date_display].filter(Boolean).join(' · '), snippet: a.medium_display || '', thumb: a.image_id ? `${base}/${a.image_id}/full/200,/0/default.jpg` : null })) });
  ctx.source('Art Institute of Chicago API', 'https://api.artic.edu');
}

async function metArt(ctx, q) {
  const s = await get(`https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${enc(q)}`);
  const ids = (s.objectIDs || []).slice(0, 8);
  if (!ids.length) throw new Error('No artworks found.');
  const objs = (await Promise.all(ids.map(id => get(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`).catch(() => null)))).filter(Boolean);
  ctx.add({ title: 'The Metropolitan Museum of Art', list: objs.map(o => ({ title: o.title, url: safe(o.objectURL), meta: [o.artistDisplayName, o.objectDate].filter(Boolean).join(' · '), snippet: o.medium || '', thumb: safe(o.primaryImageSmall) })) });
  ctx.source('The Met Collection API', 'https://metmuseum.github.io');
}

export async function recipe(ctx, q, drink = false) {
  ctx.label(drink ? 'Cocktail' : 'Recipe');
  const r = await get(`https://www.the${drink ? 'cocktail' : 'meal'}db.com/api/json/v1/1/search.php?s=${enc(q)}`);
  const list = drink ? r.drinks : r.meals;
  if (!list) throw new Error(`No ${drink ? 'cocktail' : 'recipe'} found for "${q}".`);
  const m = list[0];
  const name = drink ? m.strDrink : m.strMeal;
  ctx.input(name);
  const ing = [];
  for (let i = 1; i <= 20; i++) { const n = m['strIngredient' + i]; if (n && n.trim()) ing.push(`${(m['strMeasure' + i] || '').trim()} ${n.trim()}`.trim()); }
  ctx.add({ title: name, image: safe(m[drink ? 'strDrinkThumb' : 'strMealThumb']), imageSide: true, table: [['Category', m.strCategory || '—'], [drink ? 'Glass' : 'Cuisine', (drink ? m.strGlass : m.strArea) || '—']] });
  ctx.add({ title: 'Ingredients', numbered: ing });
  const steps = (m.strInstructions || '').split(/\r?\n+|(?<=\.)\s+(?=[A-Z])/).map(s => s.replace(/^(step\s*)?\d+[.):]?\s*/i, '').trim()).filter(s => s.length > 3);
  ctx.add({ title: 'Steps', numbered: steps });
  if (list.length > 1) ctx.add({ title: 'Other matches', chips: list.slice(1, 8).map(x => `${drink ? 'cocktail' : 'recipe'} ${drink ? x.strDrink : x.strMeal}`) });
  if (m.strYoutube && safe(m.strYoutube)) ctx.add({ title: 'Video', links: [{ label: 'Watch on YouTube', url: m.strYoutube }] });
}

async function offNutrition(ctx, q) {
  const r = await get(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${enc(q)}&search_simple=1&json=1&page_size=5&fields=product_name,brands,nutriments,code`, { proxy: true });
  const p = (r.products || []).find(x => x.nutriments && x.nutriments['energy-kcal_100g'] != null);
  if (!p) throw new Error('No nutrition data found.');
  const n = p.nutriments;
  ctx.input(`${p.product_name}${p.brands ? ' (' + p.brands.split(',')[0] + ')' : ''}, per 100 g`);
  const rows = [['Energy', `${fmt(n['energy-kcal_100g'], 0)} kcal`], ['Protein', n.proteins_100g], ['Fat', n.fat_100g], ['Saturated fat', n['saturated-fat_100g']], ['Carbohydrate', n.carbohydrates_100g], ['Sugars', n.sugars_100g], ['Fiber', n.fiber_100g], ['Salt', n.salt_100g]].filter(r => r[1] != null).map(([k, v]) => [k, typeof v === 'number' ? `${fmt(v, 1)} g` : v]);
  ctx.add({ title: 'Per 100 grams', table: rows });
  ctx.source('Open Food Facts', `https://world.openfoodfacts.org/product/${p.code}`);
}

export async function nutrition(ctx, q) {
  ctx.label('Nutrition');
  let r;
  try { r = await get(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&pageSize=5&dataType=Foundation,SR%20Legacy&query=${enc(q)}`); }
  catch (_) { return offNutrition(ctx, q); }
  const term = q.toLowerCase().replace(/s$/, '');
  const rank = (x) => { const d = x.description.toLowerCase(); return (d.includes('raw') ? -5 : 0) + (d.startsWith(term) ? -3 : 0) + d.split(',').length; };
  r.foods = (r.foods || []).sort((a, b) => rank(a) - rank(b));
  const f = r.foods[0];
  if (!f) throw new Error('No food found.');
  ctx.input(`${cap(f.description.toLowerCase())} (per 100 g)`);
  const want = [['Energy', 'kcal'], ['Protein', 'g'], ['Total lipid (fat)', 'g'], ['Carbohydrate, by difference', 'g'], ['Fiber, total dietary', 'g'], ['Sugars, total including NLEA', 'g'], ['Sugars, Total', 'g'], ['Sodium, Na', 'mg'], ['Potassium, K', 'mg'], ['Calcium, Ca', 'mg'], ['Iron, Fe', 'mg'], ['Vitamin C, total ascorbic acid', 'mg'], ['Cholesterol', 'mg'], ['Caffeine', 'mg']];
  const rows = [];
  for (const [n, u] of want) { const x = f.foodNutrients.find(z => z.nutrientName === n && (z.unitName || '').toLowerCase() === u.toLowerCase()); if (x && !rows.some(r => r[0].startsWith(n.split(',')[0]))) rows.push([n.replace(/, by difference|, total dietary|, total including NLEA|, Total|, total ascorbic acid|, [A-Z][a-z]?$/g, ''), `${fmt(x.value, 1)} ${u}`]); }
  ctx.add({ title: 'Per 100 grams', table: rows });
  if (r.foods.length > 1) ctx.add({ title: 'Other matches', chips: r.foods.slice(1).map(x => `nutrition ${x.description.toLowerCase()}`) });
  ctx.source('USDA FoodData Central', `https://fdc.nal.usda.gov/food-details/${f.fdcId}/nutrients`);
}

export async function bible(ctx, ref) {
  ctx.label('Scripture');
  const r = await get(`https://bible-api.com/${enc(ref)}?translation=kjv`);
  ctx.input(`${r.reference} (King James Version)`);
  ctx.add({ title: r.reference, text: r.text.trim() });
  ctx.source('bible-api.com', 'https://bible-api.com');
}

export async function isbn(ctx, code) {
  ctx.label('Book');
  const r = await get(`https://openlibrary.org/isbn/${enc(code)}.json`);
  ctx.input(r.title);
  let authors = [];
  try { authors = await Promise.all((r.authors || []).slice(0, 3).map(a => get(`https://openlibrary.org${a.key}.json`).then(x => x.name))); } catch (_) {}
  ctx.add({ title: r.title + (r.subtitle ? `: ${r.subtitle}` : ''), image: r.covers ? `https://covers.openlibrary.org/b/id/${r.covers[0]}-M.jpg` : undefined, imageSide: true, table: [['Author', authors.join(', ') || '—'], ['Publisher', (r.publishers || []).join(', ') || '—'], ['Published', r.publish_date || '—'], ['Pages', r.number_of_pages ? String(r.number_of_pages) : '—'], ['ISBN', code]] });
  ctx.source('Open Library', `https://openlibrary.org${r.key}`);
}

export async function pokemon(ctx, name) {
  ctx.label('Pokémon');
  const p = await get(`https://pokeapi.co/api/v2/pokemon/${enc(name.toLowerCase().trim())}`);
  ctx.input(cap(p.name));
  ctx.add({ title: `#${p.id} ${cap(p.name)}`, image: safe(p.sprites.other && p.sprites.other['official-artwork'] && p.sprites.other['official-artwork'].front_default) || safe(p.sprites.front_default), imageSide: true, table: [['Type', p.types.map(t => cap(t.type.name)).join(' / ')], ['Height', `${p.height / 10} m`], ['Weight', `${p.weight / 10} kg`], ['Abilities', p.abilities.map(a => a.ability.name).join(', ')], ...p.stats.map(s => [cap(s.stat.name.replace('-', ' ')), String(s.base_stat)])] });
}

// ---------- sports ----------
const LEAGUES = { nfl: 'football/nfl', 'college football': 'football/college-football', ncaaf: 'football/college-football', nba: 'basketball/nba', wnba: 'basketball/wnba', 'college basketball': 'basketball/mens-college-basketball', mlb: 'baseball/mlb', nhl: 'hockey/nhl', mls: 'soccer/usa.1', 'premier league': 'soccer/eng.1', epl: 'soccer/eng.1', 'la liga': 'soccer/esp.1', 'serie a': 'soccer/ita.1', bundesliga: 'soccer/ger.1', 'champions league': 'soccer/uefa.champions' };
export const LEAGUE_KEYS = Object.keys(LEAGUES).sort((a, b) => b.length - a.length);
export async function scores(ctx, league) {
  ctx.label('Sports');
  const path = LEAGUES[league.toLowerCase()];
  const r = await get(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`);
  ctx.input(`${r.leagues && r.leagues[0] ? r.leagues[0].name : league.toUpperCase()} scoreboard`);
  if (!r.events.length) { ctx.add({ title: 'No games', text: 'No games on the current scoreboard.' }); return; }
  ctx.add({ title: r.day && r.day.date ? new Date(r.day.date + 'T12:00').toLocaleDateString('en-US', { dateStyle: 'full' }) : 'Games', table: { head: ['Away', '', 'Home', '', 'Status'], rows: r.events.map(e => { const c = e.competitions[0]; const away = c.competitors.find(x => x.homeAway === 'away'), home = c.competitors.find(x => x.homeAway === 'home'); return [away.team.displayName, away.score ?? '', home.team.displayName, home.score ?? '', e.status.type.shortDetail]; }) } });
  ctx.source('ESPN', 'https://www.espn.com');
}

// ---------- news & papers ----------
export async function news(ctx, q) {
  ctx.label('News');
  ctx.input(`News: ${q}`);
  const r = await get(`https://api.gdeltproject.org/api/v2/doc/doc?query=${enc(q + ' sourcelang:english')}&mode=artlist&format=json&maxrecords=15&sort=datedesc&timespan=7d`, { proxy: true, timeout: 20000 });
  const arts = (r.articles || []).filter(a => safe(a.url));
  if (!arts.length) throw new Error('No news in the past week for that.');
  ctx.add({ title: 'Past 7 days', list: arts.map(a => ({ title: a.title, url: a.url, meta: `${a.domain} · ${a.seendate ? a.seendate.replace(/(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d).*/, '$1-$2-$3 $4:$5') : ''}` })) });
  ctx.add({ title: 'More', buttons: [{ label: 'Google News', url: `https://news.google.com/search?q=${enc(q)}` }, { label: 'Bing News', url: `https://www.bing.com/news/search?q=${enc(q)}` }] });
  ctx.source('GDELT Project', 'https://www.gdeltproject.org');
}

export async function europePmc(ctx, q) {
  const r = await get(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${enc(q)}&format=json&pageSize=6&resultType=lite`);
  const list = r.resultList.result;
  if (!list.length) return;
  ctx.add({ title: `Europe PMC — ${fmt(r.hitCount, 0)} results`, list: list.map(p => ({ title: p.title, url: p.doi ? `https://doi.org/${p.doi}` : `https://europepmc.org/article/${p.source}/${p.id}`, meta: [p.authorString && cut(p.authorString, 80), p.journalTitle, p.pubYear, p.citedByCount != null ? `${p.citedByCount} citations` : null].filter(Boolean).join(' · '), actions: [...(p.isOpenAccess === 'Y' && p.pmcid ? [{ label: 'Free full text', url: `https://europepmc.org/article/PMC/${p.pmcid}` }] : []), ...(p.doi ? [{ label: 'Cite', query: `cite ${p.doi}` }] : [])] })) });
}

export async function doaj(ctx, q) {
  const r = await get(`https://doaj.org/api/search/articles/${enc(q)}?pageSize=6`);
  if (!r.results || !r.results.length) return;
  ctx.add({ title: `DOAJ open-access journals — ${fmt(r.total, 0)} results`, list: r.results.map(x => { const b = x.bibjson; const doi = (b.identifier || []).find(i => i.type === 'doi'); const link = (b.link || []).find(l => l.type === 'fulltext'); return { title: b.title, url: safe(link && link.url) || (doi ? `https://doi.org/${doi.id}` : null), meta: [(b.author || []).slice(0, 3).map(a => a.name).join(', '), b.journal && b.journal.title, b.year].filter(Boolean).join(' · '), actions: doi ? [{ label: 'Cite', query: `cite ${doi.id}` }] : [] }; }) });
}

export async function crossrefSearch(ctx, q) {
  const r = await get(`https://api.crossref.org/works?query=${enc(q)}&rows=6&select=DOI,title,author,issued,container-title,is-referenced-by-count`);
  const items = r.message.items;
  if (!items.length) return;
  ctx.add({ title: `Crossref — ${fmt(r.message['total-results'], 0)} records`, list: items.map(w => ({ title: (w.title || ['(untitled)'])[0], url: `https://doi.org/${w.DOI}`, meta: [(w.author || []).slice(0, 3).map(a => a.family).join(', '), (w['container-title'] || [])[0], w.issued && w.issued['date-parts'] && w.issued['date-parts'][0][0], `${w['is-referenced-by-count']} citations`].filter(Boolean).join(' · '), actions: [{ label: 'Cite', query: `cite ${w.DOI}` }] })) });
}

// ---------- software security ----------
export async function osv(ctx, eco, pkg, version) {
  ctx.label('Vulnerabilities');
  const E = { npm: 'npm', pypi: 'PyPI', pip: 'PyPI', python: 'PyPI', maven: 'Maven', go: 'Go', cargo: 'crates.io', rust: 'crates.io', rubygems: 'RubyGems', gem: 'RubyGems', nuget: 'NuGet', packagist: 'Packagist', composer: 'Packagist' }[eco.toLowerCase()];
  if (!E) throw new Error('Ecosystem must be npm, pypi, maven, go, cargo, rubygems, nuget or composer.');
  ctx.input(`${pkg}${version ? '@' + version : ''} (${E})`);
  const body = JSON.stringify({ package: { name: pkg, ecosystem: E }, ...(version ? { version } : {}) });
  let r;
  try { r = await get('https://api.osv.dev/v1/query', { init: { method: 'POST', body, headers: { 'Content-Type': 'application/json' } } }); }
  catch (_) { r = await get('https://api.osv.dev/v1/query', { proxy: true, init: { method: 'POST', body, headers: { 'Content-Type': 'application/json' } } }); }
  const v = r.vulns || [];
  ctx.add({ title: v.length ? `${v.length} known vulnerabilit${v.length === 1 ? 'y' : 'ies'}` : 'No known vulnerabilities', list: v.slice(0, 20).map(x => ({ title: `${x.id}${x.aliases && x.aliases.length ? ' (' + x.aliases.slice(0, 2).join(', ') + ')' : ''}`, url: `https://osv.dev/vulnerability/${x.id}`, snippet: cut(x.summary || x.details, 220), meta: (x.database_specific && x.database_specific.severity) || '' })) });
  ctx.source('OSV (Open Source Vulnerabilities)', 'https://osv.dev');
}

// ---------- economics ----------
export async function inflation(ctx, amount, fromYear, toYear) {
  ctx.label('Inflation');
  const r = await get('https://api.worldbank.org/v2/country/US/indicator/FP.CPI.TOTL?format=json&per_page=80');
  const cpi = Object.fromEntries((r[1] || []).filter(p => p.value != null).map(p => [+p.date, p.value]));
  const years = Object.keys(cpi).map(Number).sort();
  const last = years[years.length - 1];
  toYear = toYear || last;
  if (!cpi[fromYear] || !cpi[toYear]) throw new Error(`US price data covers ${years[0]}–${last}.`);
  const v = amount * cpi[toYear] / cpi[fromYear];
  ctx.input(`$${fmt(amount)} in ${fromYear} → ${toYear} dollars`);
  ctx.add({ title: 'Same buying power', big: true, text: `$${fmt(v, 2)}`, table: [['Total price change', `${fmt((cpi[toYear] / cpi[fromYear] - 1) * 100, 1)}%`], ['Average per year', `${fmt((Math.pow(cpi[toYear] / cpi[fromYear], 1 / Math.max(toYear - fromYear, 1)) - 1) * 100, 2)}%`]], note: 'Based on the US consumer price index (annual averages).' });
  const xs = years.filter(y => y >= Math.min(fromYear, toYear) && y <= Math.max(fromYear, toYear));
  ctx.add({ title: `Value of $${fmt(amount)} from ${fromYear}`, plot: { kind: 'line', ytitle: '$', traces: [{ name: 'equivalent', x: xs, y: xs.map(y => amount * cpi[y] / cpi[fromYear]) }] } });
  ctx.source('World Bank (US CPI)', 'https://data.worldbank.org/indicator/FP.CPI.TOTL?locations=US');
}

export async function historicalCurrency(ctx, amount, from, to, date) {
  ctx.label('Currency');
  const iso = date.toISOString().slice(0, 10);
  const r = await get(`https://api.frankfurter.app/${iso}?from=${from}&to=${to}`, { proxy: true });
  ctx.input(`${fmt(amount)} ${from} → ${to} on ${r.date}`);
  ctx.add({ title: 'Result', big: true, text: `${fmt(amount)} ${from} = ${fmt(amount * r.rates[to], 2)} ${to}`, table: [['Rate on that date', `1 ${from} = ${fmt(r.rates[to], 6)} ${to}`]] });
  ctx.source('European Central Bank via Frankfurter', 'https://www.frankfurter.app');
}
