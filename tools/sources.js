// Data-source handlers for /tools. Every function takes a `ctx` (the result card)
// and adds "pods" to it. Remote text is always inserted as plain text, never as HTML.

const PROXY = '/tools/api/proxy?url=';

// Sources that sometimes refuse direct browser requests (CORS on error pages, rate limits):
// if a direct request fails at the network level, retry once through the site's own helper.
const FALLBACK = new Set(['geocoding-api.open-meteo.com', 'api.open-meteo.com', 'air-quality-api.open-meteo.com', 'router.project-osrm.org', 'api.datamuse.com', 'openlibrary.org', 'api.coingecko.com', 'api.openalex.org', 'en.wikipedia.org', 'www.wikidata.org', 'api.duckduckgo.com', 'nominatim.openstreetmap.org', 'api.github.com', 'api.artic.edu', 'site.api.espn.com', 'archive-api.open-meteo.com', 'api.nasa.gov', 'api.nal.usda.gov']);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function get(url, { proxy = false, type = 'json', timeout = 15000, init, retries = 1 } = {}) {
  const host = new URL(url).hostname;
  const u = proxy ? PROXY + encodeURIComponent(url) : url;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  let r;
  const opts = { ...(init || {}), signal: ctl.signal };
  if (!proxy && /(^|\.)(wikipedia|wikidata)\.org$/.test(host)) opts.headers = { ...(opts.headers || {}), 'Api-User-Agent': 'cymartinbell.com-tools/1.0' };
  try {
    r = await fetch(u, opts);
  } catch (e) {
    clearTimeout(t);
    if (e.name === 'AbortError') throw new Error(`${host} took too long to answer. Try again in a moment.`);
    if (!proxy && FALLBACK.has(host)) return get(url, { proxy: true, type, timeout, init, retries: 0 });
    throw new Error(`Couldn't reach ${host}.`);
  }
  clearTimeout(t);
  if ((r.status === 429 || r.status >= 500) && retries > 0) {
    await sleep(r.status === 429 ? 1500 : 700);
    return get(url, { proxy, type, timeout, init, retries: retries - 1 });
  }
  // Still rate-limited: the site's helper asks from a different address.
  if (r.status === 429 && !proxy && FALLBACK.has(host)) return get(url, { proxy: true, type, timeout, init, retries: 0 });
  if (!r.ok) {
    if (r.status === 429) throw new Error(`${host} is busy right now (rate limit). Try again in a minute.`);
    if (r.status === 404) throw new Error(`Nothing found at ${host} for that.`);
    throw new Error(`${host} returned an error (${r.status}).`);
  }
  return type === 'json' ? r.json() : r.text();
}

export const enc = encodeURIComponent;
const strip = (html) => { if (!html) return ''; const d = new DOMParser().parseFromString(html, 'text/html'); return (d.body.textContent || '').replace(/\s+/g, ' ').trim(); };
const cut = (s, n = 400) => (s && s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s || '');
const fmtNum = (n, d = 2) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d }));
const fmtBig = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + ' trillion';
  if (a >= 1e9) return (n / 1e9).toFixed(2) + ' billion';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + ' million';
  return fmtNum(n, 2);
};
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);

// ---------- shared lookups ----------

const REGION_NAMES = (() => {
  const out = {};
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' });
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const a of A) for (const b of A) {
      const code = a + b;
      try { const n = dn.of(code); if (n && n !== code) out[n.toLowerCase()] = code; } catch (_) {}
    }
  } catch (_) {}
  Object.assign(out, { usa: 'US', 'united states of america': 'US', america: 'US', us: 'US', uk: 'GB', britain: 'GB', 'great britain': 'GB', england: 'GB', russia: 'RU', 'south korea': 'KR', korea: 'KR', 'north korea': 'KP', uae: 'AE', holland: 'NL', vietnam: 'VN', czechia: 'CZ', 'czech republic': 'CZ', 'ivory coast': 'CI', burma: 'MM' });
  return out;
})();
export const countryCode = (name) => REGION_NAMES[String(name || '').toLowerCase().trim().replace(/^the\s+/, '')] || null;
const regionName = (cc) => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(cc); } catch (_) { return cc; } };

const LANGS = (() => {
  const out = {};
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'language' });
    'af am ar az be bg bn bs ca cs cy da de el en eo es et eu fa fi fil fr ga gl gu ha he hi hr ht hu hy id ig is it ja jv ka kk km kn ko ku ky la lb lo lt lv mg mi mk ml mn mr ms mt my ne nl no ny pa pl ps pt ro ru rw sd si sk sl sm sn so sq sr st su sv sw ta te tg th tk tl tr tt ug uk ur uz vi xh yi yo zh zu'.split(' ')
      .forEach(c => { try { out[dn.of(c).toLowerCase()] = c; } catch (_) {} });
  } catch (_) {}
  Object.assign(out, { chinese: 'zh', mandarin: 'zh', farsi: 'fa', persian: 'fa', tagalog: 'tl', filipino: 'tl', hebrew: 'he' });
  return out;
})();
export const langCode = (name) => { const n = String(name || '').toLowerCase().trim(); return LANGS[n] || (/^[a-z]{2}$/.test(n) ? n : null); };

const PLACE_ALIAS = { nyc: 'New York City', la: 'Los Angeles', sf: 'San Francisco', dc: 'Washington', 'washington dc': 'Washington', 'washington d.c.': 'Washington', philly: 'Philadelphia', vegas: 'Las Vegas', nola: 'New Orleans' };
const STATE_AB = { al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas', ca: 'california', co: 'colorado', ct: 'connecticut', de: 'delaware', fl: 'florida', ga: 'georgia', hi: 'hawaii', id: 'idaho', il: 'illinois', in: 'indiana', ia: 'iowa', ks: 'kansas', ky: 'kentucky', la: 'louisiana', me: 'maine', md: 'maryland', ma: 'massachusetts', mi: 'michigan', mn: 'minnesota', ms: 'mississippi', mo: 'missouri', mt: 'montana', ne: 'nebraska', nv: 'nevada', nh: 'new hampshire', nj: 'new jersey', nm: 'new mexico', ny: 'new york', nc: 'north carolina', nd: 'north dakota', oh: 'ohio', ok: 'oklahoma', or: 'oregon', pa: 'pennsylvania', ri: 'rhode island', sc: 'south carolina', sd: 'south dakota', tn: 'tennessee', tx: 'texas', ut: 'utah', vt: 'vermont', va: 'virginia', wa: 'washington', wv: 'west virginia', wi: 'wisconsin', wy: 'wyoming', on: 'ontario', bc: 'british columbia', qc: 'quebec', uk: 'united kingdom' };
async function geocode(place) {
  place = PLACE_ALIAS[place.trim().toLowerCase()] || place;
  // "Sudbury MA" / "Sudbury, Massachusetts": use the region to choose between places with the same name
  let name = place.replace(/,.*$/, '').trim(), hint = (place.split(',')[1] || '').trim().toLowerCase();
  const tail = /^(.+?)\s+([A-Za-z]{2})$/.exec(name);
  if (!hint && tail && STATE_AB[tail[2].toLowerCase()]) { name = tail[1]; hint = tail[2].toLowerCase(); }
  hint = STATE_AB[hint] || hint;
  const d = await get(`https://geocoding-api.open-meteo.com/v1/search?count=6&language=en&name=${enc(name)}`);
  let all = d.results || [];
  if (hint) all = [...all].sort((a, b) => ((b.admin1 || '').toLowerCase().startsWith(hint) || (b.country || '').toLowerCase().startsWith(hint) || (b.country_code || '').toLowerCase() === hint) - ((a.admin1 || '').toLowerCase().startsWith(hint) || (a.country || '').toLowerCase().startsWith(hint) || (a.country_code || '').toLowerCase() === hint));
  let r = all[0];
  if (r) r.others = all.slice(1, 5).map(o => [o.name, o.admin1, o.country_code].filter(Boolean).join(', '));
  if (!r) {
    const n = await get(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${enc(place)}`);
    if (!n[0]) throw new Error(`Couldn't find a place called "${place}".`);
    return { name: n[0].display_name.split(',')[0], label: n[0].display_name, latitude: +n[0].lat, longitude: +n[0].lon, timezone: null, country_code: null };
  }
  r.label = [r.name, r.admin1, r.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');
  return r;
}

const osmMap = (lat, lon, zoom = 0.08) => `https://www.openstreetmap.org/export/embed.html?bbox=${lon - zoom},${lat - zoom / 2},${lon + zoom},${lat + zoom / 2}&layer=mapnik&marker=${lat},${lon}`;

// ---------- weather, time, sun, air ----------

const WMO = { 0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Freezing fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Light showers', 81: 'Showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm with hail' };
const fc = (f) => `${Math.round(f)}°F (${Math.round((f - 32) * 5 / 9)}°C)`;

export async function weather(ctx, place) {
  ctx.label('Weather');
  const g = await geocode(place);
  ctx.input(`Weather in ${g.label}`);
  const w = await get(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&timezone=auto&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&forecast_days=7&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,precipitation,cloud_cover,pressure_msl,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset&hourly=temperature_2m,precipitation_probability`);
  const c = w.current;
  ctx.add({ title: 'Right now', text: `${WMO[c.weather_code] || ''}, ${fc(c.temperature_2m)}`, big: true, table: [
    ['Feels like', fc(c.apparent_temperature)], ['Humidity', c.relative_humidity_2m + '%'], ['Wind', `${Math.round(c.wind_speed_10m)} mph (gusts ${Math.round(c.wind_gusts_10m)} mph)`],
    ['Cloud cover', c.cloud_cover + '%'], ['Precipitation', c.precipitation + ' in'], ['Pressure', Math.round(c.pressure_msl) + ' hPa'], ['UV index', String(c.uv_index ?? '—')],
    ['Local time', new Date().toLocaleString('en-US', { timeZone: w.timezone, weekday: 'short', hour: 'numeric', minute: '2-digit' })],
  ] });
  const d = w.daily;
  ctx.add({ title: '7-day forecast', table: { head: ['Day', 'Conditions', 'High', 'Low', 'Rain chance'], rows: d.time.map((t, i) => [
    new Date(t + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), WMO[d.weather_code[i]] || '', Math.round(d.temperature_2m_max[i]) + '°', Math.round(d.temperature_2m_min[i]) + '°', (d.precipitation_probability_max[i] ?? '—') + '%']) } });
  const h = w.hourly;
  ctx.add({ title: 'Next 48 hours', plot: { kind: 'line', xdate: true, ytitle: '°F', traces: [{ name: 'Temperature', x: h.time.slice(0, 48), y: h.temperature_2m.slice(0, 48) }, { name: 'Rain chance %', x: h.time.slice(0, 48), y: h.precipitation_probability.slice(0, 48), yaxis: 'y2', dash: true }], y2title: '%' } });
  ctx.add({ title: 'Sun', table: [['Sunrise', new Date(d.sunrise[0]).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })], ['Sunset', new Date(d.sunset[0]).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })]] });
  airQuality(ctx, g, true).catch(() => {});
  if (g.country_code === 'US' || /united states/i.test(g.label)) nwsAlerts(ctx, g).catch(() => {});
  if (g.others && g.others.length) ctx.add({ title: `Not this ${g.name}?`, chips: g.others.map(o => `weather in ${o}`) });
  ctx.source('Open-Meteo', 'https://open-meteo.com');
}

export async function airQuality(ctx, placeOrGeo, quiet) {
  const g = typeof placeOrGeo === 'string' ? await geocode(placeOrGeo) : placeOrGeo;
  if (!quiet) { ctx.label('Air quality'); ctx.input(`Air quality in ${g.label}`); }
  const a = await get(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${g.latitude}&longitude=${g.longitude}&current=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,carbon_monoxide,uv_index`);
  const q = a.current.us_aqi;
  const band = q <= 50 ? 'Good' : q <= 100 ? 'Moderate' : q <= 150 ? 'Unhealthy for sensitive groups' : q <= 200 ? 'Unhealthy' : q <= 300 ? 'Very unhealthy' : 'Hazardous';
  ctx.add({ title: 'Air quality', text: `US AQI ${q}: ${band}`, table: [['PM2.5', a.current.pm2_5 + ' μg/m³'], ['PM10', a.current.pm10 + ' μg/m³'], ['Ozone', a.current.ozone + ' μg/m³'], ['NO₂', a.current.nitrogen_dioxide + ' μg/m³']] });
}

async function nwsAlerts(ctx, g) {
  const a = await get(`https://api.weather.gov/alerts/active?point=${g.latitude.toFixed(4)},${g.longitude.toFixed(4)}`, { init: { headers: { Accept: 'application/geo+json' } } });
  if (!a.features || !a.features.length) return;
  ctx.add({ title: '⚠ Active weather alerts', warn: true, list: a.features.slice(0, 5).map(f => ({ title: f.properties.event, meta: `${f.properties.severity} · until ${new Date(f.properties.expires).toLocaleString('en-US')}`, snippet: cut(f.properties.headline, 240) })) });
}

export async function timeIn(ctx, place) {
  ctx.label('Time');
  const g = await geocode(place);
  const tz = g.timezone || 'UTC';
  const now = new Date();
  const local = now.toLocaleString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const offset = (z) => { const s = now.toLocaleString('en-US', { timeZone: z, timeZoneName: 'longOffset' }); return (s.match(/GMT[+-−]?\d*:?\d*/) || ['GMT'])[0]; };
  const toMin = (z) => { const p = new Intl.DateTimeFormat('en-US', { timeZone: z, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(now).reduce((o, x) => (o[x.type] = x.value, o), {}); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) / 60000; };
  const diffH = (toMin(tz) - toMin(Intl.DateTimeFormat().resolvedOptions().timeZone)) / 60;
  ctx.input(`Current time in ${g.label}`);
  ctx.add({ title: 'Local time', text: local, big: true, table: [['Time zone', `${tz} (${offset(tz)})`], ['Compared with you', diffH === 0 ? 'Same time' : `${Math.abs(diffH)} hour${Math.abs(diffH) === 1 ? '' : 's'} ${diffH > 0 ? 'ahead' : 'behind'}`]] });
}

export async function sun(ctx, place) {
  ctx.label('Sunrise & sunset');
  const g = await geocode(place);
  ctx.input(`Sunrise and sunset in ${g.label}`);
  const s = await get(`https://api.sunrise-sunset.org/json?lat=${g.latitude}&lng=${g.longitude}&formatted=0`);
  const tz = g.timezone || undefined;
  const t = (x) => new Date(x).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
  const r = s.results;
  ctx.add({ title: 'Today', table: [['Sunrise', t(r.sunrise)], ['Sunset', t(r.sunset)], ['Solar noon', t(r.solar_noon)], ['Day length', `${Math.floor(r.day_length / 3600)} h ${Math.round(r.day_length % 3600 / 60)} min`], ['Civil twilight', `${t(r.civil_twilight_begin)} – ${t(r.civil_twilight_end)}`], ['Golden hour (approx.)', `${t(new Date(r.sunset).getTime() - 3600000)} – ${t(r.sunset)}`]] });
  ctx.source('sunrise-sunset.org', 'https://sunrise-sunset.org');
}

export async function directions(ctx, from, to) {
  ctx.label('Directions');
  const [a, b] = await Promise.all([geocode(from), geocode(to)]);
  ctx.input(`${a.label} → ${b.label}`);
  const r = await get(`https://router.project-osrm.org/route/v1/driving/${a.longitude},${a.latitude};${b.longitude},${b.latitude}?overview=false`);
  if (!r.routes || !r.routes.length) throw new Error('No driving route found.');
  const rt = r.routes[0];
  const mi = rt.distance / 1609.344;
  const toRad = (d) => d * Math.PI / 180;
  const R = 3958.8, dLat = toRad(b.latitude - a.latitude), dLon = toRad(b.longitude - a.longitude);
  const crow = 2 * R * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2));
  ctx.add({ title: 'Driving', big: true, text: `${fmtNum(mi, 1)} mi · ${Math.floor(rt.duration / 3600)} h ${Math.round(rt.duration % 3600 / 60)} min`, table: [['Distance', `${fmtNum(mi, 1)} mi (${fmtNum(rt.distance / 1000, 1)} km)`], ['Straight-line distance', `${fmtNum(crow, 1)} mi (${fmtNum(crow * 1.609344, 1)} km)`], ['Flight time (approx., 500 mph)', crow > 150 ? `${(crow / 500 + 0.5).toFixed(1)} h` : '—']] });
  ctx.add({ title: 'Open in a map', buttons: [{ label: 'Google Maps', url: `https://www.google.com/maps/dir/${enc(a.label)}/${enc(b.label)}` }, { label: 'OpenStreetMap', url: `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${a.latitude},${a.longitude};${b.latitude},${b.longitude}` }] });
  ctx.source('OSRM + OpenStreetMap', 'https://www.openstreetmap.org/copyright');
}

export async function place(ctx, q) {
  ctx.label('Map');
  const g = await geocode(q);
  ctx.input(g.label);
  ctx.add({ title: 'Location', table: [['Coordinates', `${g.latitude.toFixed(4)}, ${g.longitude.toFixed(4)}`], ...(g.population ? [['Population', fmtNum(g.population, 0)]] : []), ...(g.elevation != null ? [['Elevation', `${fmtNum(g.elevation * 3.28084, 0)} ft (${g.elevation} m)`]] : []), ...(g.timezone ? [['Time zone', g.timezone]] : [])] });
  ctx.add({ title: 'Map', iframe: osmMap(g.latitude, g.longitude, 0.2) });
}

// ---------- money ----------

const FIAT = new Set('USD EUR GBP JPY CAD AUD CHF CNY INR MXN BRL KRW SEK NOK DKK NZD SGD HKD ZAR PLN TRY CZK HUF ILS THB IDR MYR PHP ISK RON BGN'.split(' '));
const CUR_WORDS = { dollar: 'USD', dollars: 'USD', usd: 'USD', '$': 'USD', euro: 'EUR', euros: 'EUR', '€': 'EUR', pound: 'GBP', pounds: 'GBP', '£': 'GBP', yen: 'JPY', '¥': 'JPY', rupee: 'INR', rupees: 'INR', peso: 'MXN', pesos: 'MXN', yuan: 'CNY', won: 'KRW', franc: 'CHF', francs: 'CHF' };
export const curCode = (s) => { const k = String(s).toLowerCase().trim(); return CUR_WORDS[k] || (FIAT.has(k.toUpperCase()) ? k.toUpperCase() : null); };

export async function currency(ctx, amount, from, to) {
  ctx.label('Currency');
  ctx.input(`${fmtNum(amount)} ${from} → ${to}`);
  const r = await get(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, { proxy: true });
  const rate = r.rates[to];
  ctx.add({ title: 'Result', big: true, text: `${fmtNum(amount)} ${from} = ${fmtNum(amount * rate, 2)} ${to}`, table: [[`1 ${from}`, `${fmtNum(rate, 6)} ${to}`], [`1 ${to}`, `${fmtNum(1 / rate, 6)} ${from}`], ['Rate date', r.date]] });
  const start = new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10);
  const h = await get(`https://api.frankfurter.app/${start}..?from=${from}&to=${to}`, { proxy: true });
  const days = Object.keys(h.rates);
  ctx.add({ title: '6-month history', plot: { kind: 'line', xdate: true, ytitle: `${to} per ${from}`, traces: [{ name: `${from}/${to}`, x: days, y: days.map(d => h.rates[d][to]) }] } });
  ctx.source('European Central Bank via Frankfurter', 'https://www.frankfurter.app');
}

export async function crypto(ctx, coinQuery, amount = 1, vs = 'usd') {
  ctx.label('Crypto');
  const s = await get(`https://api.coingecko.com/api/v3/search?query=${enc(coinQuery)}`);
  const coin = s.coins && s.coins[0];
  if (!coin) throw new Error(`No cryptocurrency matched "${coinQuery}".`);
  ctx.input(`${coin.name} (${coin.symbol})`);
  const p = await get(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=${vs}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`);
  const d = p[coin.id];
  ctx.add({ title: 'Price', big: true, text: `${amount !== 1 ? fmtNum(amount) + ' ' + coin.symbol + ' = ' : ''}${fmtNum(d[vs] * amount, d[vs] < 1 ? 6 : 2)} ${vs.toUpperCase()}`, table: [['24h change', `${fmtNum(d[`${vs}_24h_change`], 2)}%`], ['Market cap', fmtBig(d[`${vs}_market_cap`]) + ' ' + vs.toUpperCase()], ['24h volume', fmtBig(d[`${vs}_24h_vol`]) + ' ' + vs.toUpperCase()]] });
  const ch = await get(`https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=${vs}&days=90`);
  ctx.add({ title: '90-day price', plot: { kind: 'line', xdate: true, ytitle: vs.toUpperCase(), traces: [{ name: coin.symbol, x: ch.prices.map(p => new Date(p[0]).toISOString()), y: ch.prices.map(p => p[1]) }] } });
  ctx.source('CoinGecko', 'https://www.coingecko.com');
}

export async function stock(ctx, symbol) {
  ctx.label('Stock');
  symbol = symbol.toUpperCase();
  const r = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${enc(symbol)}?range=6mo&interval=1d`, { proxy: true });
  const res = r.chart && r.chart.result && r.chart.result[0];
  if (!res) throw new Error(`No stock found for "${symbol}".`);
  const m = res.meta;
  ctx.input(`${m.longName || m.shortName || symbol} (${symbol})`);
  const chg = m.regularMarketPrice - m.chartPreviousClose;
  ctx.add({ title: 'Price', big: true, text: `${fmtNum(m.regularMarketPrice)} ${m.currency}`, table: [['Change (vs. 6 months ago)', `${chg >= 0 ? '+' : ''}${fmtNum(chg)} (${fmtNum(chg / m.chartPreviousClose * 100)}%)`], ['Day range', `${fmtNum(m.regularMarketDayLow)} – ${fmtNum(m.regularMarketDayHigh)}`], ['52-week range', `${fmtNum(m.fiftyTwoWeekLow)} – ${fmtNum(m.fiftyTwoWeekHigh)}`], ['Exchange', m.fullExchangeName || m.exchangeName]] });
  ctx.add({ title: '6-month chart', plot: { kind: 'line', xdate: true, ytitle: m.currency, traces: [{ name: symbol, x: res.timestamp.map(t => new Date(t * 1000).toISOString()), y: res.indicators.quote[0].close }] } });
  ctx.add({ title: 'More', buttons: [{ label: 'SEC filings', url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${enc(symbol)}&type=10-K` }, { label: 'Yahoo Finance', url: `https://finance.yahoo.com/quote/${enc(symbol)}` }] });
  ctx.source('Yahoo Finance (delayed)', `https://finance.yahoo.com/quote/${enc(symbol)}`);
}

// ---------- words & language ----------

export async function define(ctx, word) {
  ctx.label('Dictionary');
  ctx.input(word);
  let data = null;
  try { data = await get(`https://api.dictionaryapi.dev/api/v2/entries/en/${enc(word)}`, { proxy: true }); } catch (_) {}
  if (data && data[0]) {
    const e = data[0];
    const ph = (e.phonetics || []).find(p => p.text) || {};
    const audio = (e.phonetics || []).map(p => p.audio).find(a => a);
    ctx.add({ title: e.word, text: ph.text || '', audio: safeUrl(audio) || undefined });
    for (const m of e.meanings.slice(0, 4)) {
      ctx.add({ title: cap(m.partOfSpeech), numbered: m.definitions.slice(0, 4).map(d => d.definition + (d.example ? ` — “${d.example}”` : '')), note: m.synonyms && m.synonyms.length ? 'Synonyms: ' + m.synonyms.slice(0, 8).join(', ') : undefined });
    }
  }
  const [syn, ant, rhy] = await Promise.all(['rel_syn', 'rel_ant', 'rel_rhy'].map(k => get(`https://api.datamuse.com/words?${k}=${enc(word)}&max=12`).catch(() => [])));
  const rows = [];
  if (syn.length) rows.push(['Synonyms', syn.map(w => w.word).join(', ')]);
  if (ant.length) rows.push(['Antonyms', ant.map(w => w.word).join(', ')]);
  if (rhy.length) rows.push(['Rhymes', rhy.map(w => w.word).join(', ')]);
  if (rows.length) ctx.add({ title: 'Related words', table: rows });
  if (!data && !rows.length) throw new Error(`No definition found for "${word}".`);
  ctx.source('Free Dictionary API + Datamuse', 'https://dictionaryapi.dev');
}

export async function words(ctx, kind, word) {
  const map = { synonyms: 'rel_syn', antonyms: 'rel_ant', rhymes: 'rel_rhy', 'words like': 'ml', 'sounds like': 'sl', 'words that describe': 'rel_jjb', 'adjectives for': 'rel_jjb', 'words related to': 'ml' };
  ctx.label('Words');
  ctx.input(`${cap(kind)} ${word}`);
  const r = await get(`https://api.datamuse.com/words?${map[kind] || 'ml'}=${enc(word)}&max=40`);
  if (!r.length) throw new Error('Nothing found.');
  ctx.add({ title: cap(kind), text: r.map(w => w.word).join(', ') });
  ctx.source('Datamuse', 'https://www.datamuse.com/api/');
}

export async function slang(ctx, term) {
  ctx.label('Slang');
  ctx.input(term);
  const r = await get(`https://api.urbandictionary.com/v0/define?term=${enc(term)}`);
  if (!r.list.length) throw new Error('No slang definition found.');
  ctx.add({ title: 'Top definitions', note: 'User-submitted. Can be crude or wrong.', list: r.list.sort((a, b) => b.thumbs_up - a.thumbs_up).slice(0, 3).map(d => ({ title: d.word, snippet: cut(d.definition.replace(/[[\]]/g, ''), 350), meta: `👍 ${d.thumbs_up}` })) });
  ctx.source('Urban Dictionary', `https://www.urbandictionary.com/define.php?term=${enc(term)}`);
}

export async function translate(ctx, text, toLang, fromLang = 'en') {
  ctx.label('Translate');
  const to = langCode(toLang), from = langCode(fromLang) || 'en';
  if (!to) throw new Error(`Unknown language "${toLang}".`);
  ctx.input(`${text} (${fromLang} → ${toLang})`);
  const r = await get(`https://api.mymemory.translated.net/get?q=${enc(text)}&langpair=${from}|${to}`);
  const norm = (x) => String(x || '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').trim();
  const ms = (r.matches || []).filter(m => m.translation);
  // Prefer a human translation of exactly this text over the machine guess.
  // Keep the service's own pick unless it came from scraped web text or a machine, and a
  // human-translated exact match exists.
  const top = r.responseData.translatedText;
  const topSrc = (ms.find(m => m.translation === top) || {})['created-by'] || 'MT';
  const human = ms.filter(m => norm(m.segment) === norm(text) && +m.match >= 0.99 && !['MT', 'Public Web'].includes(m['created-by']))
    .sort((a, b) => (+b['usage-count'] || 0) - (+a['usage-count'] || 0) || (+b.quality || 0) - (+a.quality || 0));
  const best = ['MT', 'Public Web'].includes(topSrc) && human[0] ? human[0].translation : top;
  ctx.add({ title: cap(toLang), big: true, text: best });
  const others = [...new Set(ms.map(m => m.translation).concat(r.responseData.translatedText))].filter(x => x !== best).slice(0, 4);
  if (others.length) ctx.add({ title: 'Other translations', list: others.map(x => ({ title: x })) });
  ctx.add({ title: 'Compare', buttons: [{ label: 'Google Translate', url: `https://translate.google.com/?sl=${from}&tl=${to}&text=${enc(text)}` }, { label: 'DeepL', url: `https://www.deepl.com/translator#${from}/${to}/${enc(text)}` }] });
  ctx.source('MyMemory (translation memory)', 'https://mymemory.translated.net');
}

// ---------- knowledge: Wikipedia, Wikidata, DuckDuckGo ----------

const WD_PROPS = [
  ['P31', 'Instance of', 'item'], ['P279', 'Type of', 'item'], ['P569', 'Born', 'time'], ['P19', 'Birthplace', 'item'], ['P570', 'Died', 'time'], ['P20', 'Place of death', 'item'],
  ['P27', 'Citizenship', 'item'], ['P106', 'Occupation', 'items'], ['P69', 'Educated at', 'items'], ['P166', 'Awards', 'items'], ['P800', 'Notable work', 'items'],
  ['P17', 'Country', 'item'], ['P36', 'Capital', 'item'], ['P1082', 'Population', 'quantity'], ['P2046', 'Area', 'quantity'], ['P2044', 'Elevation', 'quantity'],
  ['P37', 'Official language', 'items'], ['P38', 'Currency', 'item'], ['P35', 'Head of state', 'item'], ['P6', 'Head of government', 'item'], ['P2131', 'GDP (nominal)', 'quantity'],
  ['P571', 'Founded', 'time'], ['P112', 'Founded by', 'items'], ['P169', 'CEO', 'item'], ['P159', 'Headquarters', 'item'], ['P452', 'Industry', 'items'], ['P1128', 'Employees', 'quantity'], ['P2139', 'Revenue', 'quantity'],
  ['P50', 'Author', 'items'], ['P57', 'Director', 'items'], ['P577', 'Published', 'time'], ['P136', 'Genre', 'items'], ['P2047', 'Duration', 'quantity'], ['P175', 'Performer', 'items'],
  ['P2067', 'Mass', 'quantity'], ['P2048', 'Height', 'quantity'], ['P2043', 'Length', 'quantity'], ['P274', 'Chemical formula', 'string'], ['P1086', 'Atomic number', 'quantity'],
  ['P225', 'Scientific name', 'string'], ['P105', 'Taxon rank', 'item'], ['P141', 'Conservation status', 'item'], ['P61', 'Discoverer / inventor', 'items'], ['P575', 'Discovered', 'time'],
  ['P856', 'Official website', 'url'],
];

function wdTime(v) {
  const m = /([+-])(\d+)-(\d\d)-(\d\d)/.exec(v.time);
  if (!m) return v.time;
  const y = +m[2] * (m[1] === '-' ? -1 : 1);
  const yr = y < 0 ? `${-y} BC` : String(y);
  if (v.precision >= 11) return new Date(Date.UTC(Math.max(y, 1), +m[3] - 1, +m[4])).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).replace(/\d{4}$/, yr);
  if (v.precision === 10) return new Date(Date.UTC(2000, +m[3] - 1, 1)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' }) + ' ' + yr;
  return yr;
}

async function wikidataFacts(qid) {
  const e = (await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json&origin=*`)).entities[qid];
  const claims = e.claims || {};
  const pick = (arr) => { const pref = arr.filter(c => c.rank === 'preferred'); return pref.length ? pref : arr.filter(c => c.rank !== 'deprecated'); };
  const rows = [];
  const need = new Set();
  for (const [p, label, kind] of WD_PROPS) {
    const cs = claims[p] ? pick(claims[p]) : null;
    if (!cs || !cs.length) continue;
    const vals = [];
    const use = kind === 'items' ? cs.slice(0, 4) : [cs[cs.length - 1]];
    for (const c of use) {
      const dv = c.mainsnak && c.mainsnak.datavalue;
      if (!dv) continue;
      if (kind === 'item' || kind === 'items') { vals.push({ id: dv.value.id }); need.add(dv.value.id); }
      else if (kind === 'time') vals.push(wdTime(dv.value));
      else if (kind === 'quantity') {
        const unit = dv.value.unit && dv.value.unit.split('/').pop();
        if (unit && unit !== '1') need.add(unit);
        vals.push({ amount: +dv.value.amount, unit: unit !== '1' ? unit : null });
      } else if (kind === 'url') vals.push({ url: dv.value });
      else vals.push(String(dv.value));
    }
    if (vals.length) rows.push([label, vals, kind]);
  }
  const labels = {};
  const ids = [...need];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.slice(i, i + 50).join('|')}&props=labels&languages=en&format=json&origin=*`);
    for (const [id, ent] of Object.entries(r.entities)) labels[id] = ent.labels && ent.labels.en ? ent.labels.en.value : id;
  }
  const UNIT = { Q712226: 'km²', Q11573: 'm', Q11570: 'kg', Q828224: 'km', Q4917: 'USD', Q4916: 'EUR', Q25250: 'GBP', Q11574: 's', Q7727: 'min', Q174728: 'cm', Q3241121: 'mm', Q25343: 'm²', Q41803: 'g', Q35852: 'ha' };
  return rows.map(([label, vals, kind]) => [label, vals.map(v => {
    if (v && v.id) return labels[v.id] || v.id;
    if (v && v.amount != null) { const u = v.unit ? (UNIT[v.unit] || labels[v.unit] || '') : ''; return (Math.abs(v.amount) >= 1e6 ? fmtBig(v.amount) : fmtNum(v.amount)) + (u ? ' ' + u : ''); }
    if (v && v.url) return { text: v.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), url: v.url };
    return v;
  }).reduce((acc, x) => (typeof x === 'object' ? x : acc ? acc + ', ' + x : x), '')]);
}

export async function wiki(ctx, query, { quiet = false } = {}) {
  if (!quiet) ctx.label('Knowledge');
  const s = await get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc(query)}&srlimit=6&format=json&origin=*`);
  const hits = s.query.search;
  if (!hits.length) throw new Error(`Nothing on Wikipedia for "${query}".`);
  const title = hits[0].title;
  const sum = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${enc(title.replace(/ /g, '_'))}`);
  if (!quiet) ctx.input(sum.title + (sum.description ? ` — ${sum.description}` : ''));
  ctx.add({ title: sum.title, text: sum.extract, image: sum.thumbnail ? safeUrl(sum.thumbnail.source) : undefined, imageSide: true, links: [{ label: 'Read on Wikipedia', url: sum.content_urls.desktop.page }] });
  if (sum.wikibase_item) {
    wikidataFacts(sum.wikibase_item).then(rows => { if (rows.length) ctx.add({ title: 'Facts', table: rows, source: { name: 'Wikidata', url: `https://www.wikidata.org/wiki/${sum.wikibase_item}` } }); }).catch(() => {});
  }
  if (sum.coordinates) ctx.add({ title: 'Map', iframe: osmMap(sum.coordinates.lat, sum.coordinates.lon, 0.5) });
  if (hits.length > 1) ctx.add({ title: 'Other matches', list: hits.slice(1).map(h => ({ title: h.title, url: `https://en.wikipedia.org/wiki/${enc(h.title.replace(/ /g, '_'))}`, snippet: strip(h.snippet), query: h.title })) });
  ctx.source('Wikipedia', sum.content_urls.desktop.page);
}

export async function ddg(ctx, q) {
  let r;
  try { r = await get(`https://api.duckduckgo.com/?q=${enc(q)}&format=json&no_html=1&skip_disambig=1&t=cymartinbell-tools`); } catch (_) { return 0; }
  const added = [];
  if (r.Answer) added.push(ctx.add({ title: 'Instant answer', big: true, text: String(r.Answer) }));
  if (r.Definition) added.push(ctx.add({ title: 'Definition', text: r.Definition, links: safeUrl(r.DefinitionURL) ? [{ label: r.DefinitionSource, url: r.DefinitionURL }] : [] }));
  if (r.AbstractText) added.push(ctx.add({ title: r.Heading || 'Summary', text: r.AbstractText, links: safeUrl(r.AbstractURL) ? [{ label: r.AbstractSource, url: r.AbstractURL }] : [] }));
  const rel = (r.RelatedTopics || []).flatMap(t => t.Topics || [t]).filter(t => t.Text && t.FirstURL).slice(0, 6);
  if (rel.length && !r.AbstractText) added.push(ctx.add({ title: 'Related', list: rel.map(t => ({ title: t.Text.split(' - ')[0], snippet: t.Text, url: t.FirstURL })) }));
  return added.length;
}

// ---------- research ----------

function oaAbstract(inv) {
  if (!inv) return '';
  const words = [];
  for (const [w, idx] of Object.entries(inv)) for (const i of idx) words[i] = w;
  return words.join(' ');
}
const authorsShort = (names) => (names.length > 3 ? names.slice(0, 3).join(', ') + ' et al.' : names.join(', '));

export async function papers(ctx, q, { sort = 'relevance', source = 'all' } = {}) {
  ctx.label('Research papers');
  ctx.input(`Papers on: ${q}`);
  const tasks = [];
  if (source === 'all' || source === 'openalex') tasks.push(openAlex(ctx, q, sort));
  if (source === 'all' || source === 'arxiv') tasks.push(arxiv(ctx, q));
  if (source === 'all' || source === 'semantic') tasks.push(semanticScholar(ctx, q));
  if (source === 'all' || source === 'pubmed') tasks.push(pubmed(ctx, q));
  ctx.add({ title: 'Search elsewhere', buttons: [
    { label: 'Google Scholar', url: `https://scholar.google.com/scholar?q=${enc(q)}` }, { label: 'Semantic Scholar', url: `https://www.semanticscholar.org/search?q=${enc(q)}` },
    { label: 'arXiv', url: `https://arxiv.org/search/?query=${enc(q)}&searchtype=all` }, { label: 'PubMed', url: `https://pubmed.ncbi.nlm.nih.gov/?term=${enc(q)}` },
    { label: 'ScienceOpen', url: `https://www.scienceopen.com/search#('v'~4_'id'~''_'queryType'~1_'context'~null_'kind'~77_'order'~0_'orderLowestFirst'~false_'query'~'${enc(q)}'_'filters'~!*)` },
    { label: 'CORE (open access)', url: `https://core.ac.uk/search?q=${enc(q)}` }, { label: 'PDFs via Google', url: `https://www.google.com/search?q=${enc(q + ' filetype:pdf')}` },
  ] });
  const results = await Promise.allSettled(tasks);
  if (results.every(r => r.status === 'rejected')) throw new Error('No paper sources answered. Try again in a moment.');
}

async function openAlex(ctx, q, sort) {
  const sortParam = sort === 'cited' ? '&sort=cited_by_count:desc' : sort === 'recent' ? '&sort=publication_date:desc' : sort === 'oa' ? '&filter=is_oa:true' : '';
  const r = await get(`https://api.openalex.org/works?search=${enc(q)}&per-page=10${sortParam}&select=id,doi,title,publication_year,cited_by_count,authorships,primary_location,open_access,type,abstract_inverted_index`);
  if (!r.results.length) return;
  ctx.add({ title: `OpenAlex — ${fmtNum(r.meta.count, 0)} works${sort === 'cited' ? ', most cited' : sort === 'recent' ? ', newest' : sort === 'oa' ? ', open access only' : ''}`, list: r.results.map(w => paperItem({
    title: w.title, year: w.publication_year, cites: w.cited_by_count, authors: (w.authorships || []).map(a => a.author.display_name),
    venue: w.primary_location && w.primary_location.source && w.primary_location.source.display_name, doi: w.doi && w.doi.replace('https://doi.org/', ''),
    url: w.doi || w.id, pdf: w.open_access && w.open_access.oa_url, abstract: oaAbstract(w.abstract_inverted_index),
  })) });
}

async function arxiv(ctx, q) {
  const xml = await get(`https://export.arxiv.org/api/query?search_query=all:${enc(q)}&start=0&max_results=8&sortBy=relevance`, { proxy: true, type: 'text' });
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const items = [...doc.getElementsByTagName('entry')].map(e => {
    const t = (n) => (e.getElementsByTagName(n)[0] || {}).textContent || '';
    const link = [...e.getElementsByTagName('link')];
    const pdf = link.find(l => l.getAttribute('title') === 'pdf');
    return paperItem({ title: t('title').replace(/\s+/g, ' ').trim(), year: t('published').slice(0, 4), authors: [...e.getElementsByTagName('author')].map(a => a.textContent.trim()), venue: 'arXiv', url: t('id').trim(), pdf: pdf && pdf.getAttribute('href'), abstract: t('summary').trim() });
  });
  if (items.length) ctx.add({ title: 'arXiv preprints', list: items });
}

async function semanticScholar(ctx, q) {
  const r = await get(`https://api.semanticscholar.org/graph/v1/paper/search?query=${enc(q)}&limit=8&fields=title,year,authors,citationCount,url,openAccessPdf,venue,externalIds,abstract`, { proxy: true });
  if (!r.data || !r.data.length) return;
  ctx.add({ title: 'Semantic Scholar', list: r.data.map(p => paperItem({ title: p.title, year: p.year, cites: p.citationCount, authors: (p.authors || []).map(a => a.name), venue: p.venue, url: p.url, pdf: p.openAccessPdf && p.openAccessPdf.url, doi: p.externalIds && p.externalIds.DOI, abstract: p.abstract })) });
}

async function pubmed(ctx, q) {
  const s = await get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=8&sort=relevance&term=${enc(q)}`);
  const ids = s.esearchresult.idlist;
  if (!ids.length) return;
  const d = await get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`);
  ctx.add({ title: `PubMed — ${fmtNum(+s.esearchresult.count, 0)} articles`, list: ids.map(id => d.result[id]).filter(Boolean).map(p => paperItem({ title: p.title, year: (p.pubdate || '').slice(0, 4), authors: (p.authors || []).map(a => a.name), venue: p.fulljournalname || p.source, url: `https://pubmed.ncbi.nlm.nih.gov/${p.uid}/`, doi: (p.articleids || []).find(a => a.idtype === 'doi')?.value })) });
}

function paperItem(p) {
  const meta = [p.authors && p.authors.length ? authorsShort(p.authors) : null, p.venue, p.year, p.cites != null ? `${fmtNum(p.cites, 0)} citations` : null].filter(Boolean).join(' · ');
  const actions = [];
  if (safeUrl(p.pdf)) actions.push({ label: 'PDF', url: p.pdf });
  if (p.doi) actions.push({ label: 'Cite', query: `cite ${p.doi}` });
  return { title: p.title, url: safeUrl(p.url), meta, snippet: cut(p.abstract, 300), actions };
}

export async function doi(ctx, id, citeOnly = false) {
  ctx.label(citeOnly ? 'Citation' : 'Paper');
  id = id.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();
  const r = await get(`https://api.crossref.org/works/${enc(id)}`);
  const w = r.message;
  const title = (w.title || [''])[0];
  const authors = (w.author || []).map(a => ({ given: a.given || '', family: a.family || a.name || '' }));
  const year = ((w.issued && w.issued['date-parts'] && w.issued['date-parts'][0]) || [])[0] || 'n.d.';
  const journal = (w['container-title'] || [''])[0];
  ctx.input(title);
  if (!citeOnly) {
    ctx.add({ title: 'Paper', text: title, table: [['Authors', authors.map(a => `${a.given} ${a.family}`.trim()).join(', ') || '—'], ['Published in', journal || w.publisher || '—'], ['Year', String(year)], ['Type', w.type], ['Cited by (Crossref)', fmtNum(w['is-referenced-by-count'], 0)], ['DOI', { text: id, url: `https://doi.org/${id}` }]] });
    if (w.abstract) ctx.add({ title: 'Abstract', text: strip(w.abstract) });
    get(`https://api.openalex.org/works/doi:${enc(id)}?select=open_access,cited_by_count,referenced_works_count`).then(o => {
      ctx.add({ title: 'Access', table: [['Open access', o.open_access && o.open_access.is_oa ? 'Yes' : 'No'], ...(safeUrl(o.open_access && o.open_access.oa_url) ? [['Free copy', { text: 'Open', url: o.open_access.oa_url }]] : []), ['Cited by (OpenAlex)', fmtNum(o.cited_by_count, 0)], ['References', fmtNum(o.referenced_works_count, 0)]] });
    }).catch(() => {});
  }
  const ini = (g) => g.split(/[\s-]+/).filter(Boolean).map(x => x[0] + '.').join(' ');
  const apaList = (authors.length > 20 ? authors.slice(0, 19).concat([authors[authors.length - 1]]) : authors).map(a => `${a.family}${a.given ? ', ' + ini(a.given) : ''}`);
  const apaAuth = apaList.length <= 1 ? (apaList[0] || '') : apaList.slice(0, -1).join(', ') + ', & ' + apaList[apaList.length - 1];
  const mlaAuth = authors.length === 0 ? '' : authors.length === 1 ? `${authors[0].family}, ${authors[0].given}` : authors.length === 2 ? `${authors[0].family}, ${authors[0].given}, and ${authors[1].given} ${authors[1].family}` : `${authors[0].family}, ${authors[0].given}, et al`;
  const vol = w.volume ? `, ${w.volume}` : '', iss = w.issue ? `(${w.issue})` : '', pages = w.page ? `, ${w.page}` : '';
  const key = ((authors[0] && authors[0].family) || 'ref').replace(/\W/g, '') + year;
  ctx.add({ title: 'Citations', copyRows: true, table: [
    ['APA', `${apaAuth} (${year}). ${title}. ${journal ? journal + vol + iss + pages + '. ' : ''}https://doi.org/${id}`],
    ['MLA', `${mlaAuth}. “${title}.” ${journal ? journal + (w.volume ? `, vol. ${w.volume}` : '') + (w.issue ? `, no. ${w.issue}` : '') + `, ${year}` + (w.page ? `, pp. ${w.page}` : '') + '. ' : ''}https://doi.org/${id}.`],
    ['Chicago', `${authors.map(a => `${a.given} ${a.family}`).join(', ')}. “${title}.” ${journal ? journal + (w.volume ? ' ' + w.volume : '') + (w.issue ? `, no. ${w.issue}` : '') + ` (${year})` + (w.page ? `: ${w.page}` : '') + '. ' : ''}https://doi.org/${id}.`],
    ['BibTeX', `@article{${key},\n  title = {${title}},\n  author = {${authors.map(a => `${a.family}, ${a.given}`).join(' and ')}},\n  journal = {${journal}},\n  year = {${year}},${w.volume ? `\n  volume = {${w.volume}},` : ''}${w.issue ? `\n  number = {${w.issue}},` : ''}${w.page ? `\n  pages = {${w.page.replace('-', '--')}},` : ''}\n  doi = {${id}}\n}`],
  ] });
  ctx.source('Crossref', `https://doi.org/${id}`);
}

export async function trials(ctx, q) {
  ctx.label('Clinical trials');
  ctx.input(`Clinical trials: ${q}`);
  const r = await get(`https://clinicaltrials.gov/api/v2/studies?query.term=${enc(q)}&pageSize=10&countTotal=true`);
  if (!r.studies.length) throw new Error('No trials found.');
  ctx.add({ title: `${fmtNum(r.totalCount, 0)} studies`, list: r.studies.map(s => { const p = s.protocolSection; const id = p.identificationModule.nctId; return { title: p.identificationModule.briefTitle, url: `https://clinicaltrials.gov/study/${id}`, meta: [id, p.statusModule.overallStatus, (p.designModule && p.designModule.phases || []).join('/'), p.statusModule.startDateStruct && p.statusModule.startDateStruct.date].filter(Boolean).join(' · '), snippet: (p.conditionsModule && p.conditionsModule.conditions || []).join(', ') }; }) });
  ctx.source('ClinicalTrials.gov', `https://clinicaltrials.gov/search?term=${enc(q)}`);
}

export async function datasets(ctx, q) {
  ctx.label('Datasets');
  ctx.input(`Datasets: ${q}`);
  const r = await get(`https://zenodo.org/api/records?q=${enc(q)}&size=10&type=dataset`);
  ctx.add({ title: 'Zenodo', list: r.hits.hits.map(h => ({ title: h.metadata.title, url: h.links.self_html, meta: [h.metadata.publication_date, (h.metadata.creators || []).slice(0, 2).map(c => c.name).join('; ')].filter(Boolean).join(' · '), snippet: cut(strip(h.metadata.description), 220) })) });
  ctx.add({ title: 'Search elsewhere', buttons: [{ label: 'Google Dataset Search', url: `https://datasetsearch.research.google.com/search?query=${enc(q)}` }, { label: 'Kaggle', url: `https://www.kaggle.com/search?q=${enc(q)}` }, { label: 'data.gov', url: `https://catalog.data.gov/dataset?q=${enc(q)}` }, { label: 'Hugging Face', url: `https://huggingface.co/datasets?search=${enc(q)}` }] });
}

export async function author(ctx, name) {
  ctx.label('Researcher');
  ctx.input(name);
  const r = await get(`https://api.openalex.org/authors?search=${enc(name)}&per-page=5`);
  if (!r.results.length) throw new Error('No researcher found.');
  const a = r.results[0];
  ctx.add({ title: a.display_name, table: [['Institution', (a.last_known_institutions && a.last_known_institutions[0] && a.last_known_institutions[0].display_name) || '—'], ['Works', fmtNum(a.works_count, 0)], ['Citations', fmtNum(a.cited_by_count, 0)], ['h-index', String(a.summary_stats ? a.summary_stats.h_index : '—')], ['Topics', (a.topics || []).slice(0, 4).map(t => t.display_name).join(', ') || '—'], ...(a.orcid ? [['ORCID', { text: a.orcid.replace('https://orcid.org/', ''), url: a.orcid }]] : [])] });
  const w = await get(`https://api.openalex.org/works?filter=author.id:${a.id.split('/').pop()}&sort=cited_by_count:desc&per-page=8&select=title,publication_year,cited_by_count,doi,open_access,primary_location`);
  ctx.add({ title: 'Most cited work', list: w.results.map(x => paperItem({ title: x.title, year: x.publication_year, cites: x.cited_by_count, url: x.doi, doi: x.doi && x.doi.replace('https://doi.org/', ''), pdf: x.open_access && x.open_access.oa_url, venue: x.primary_location && x.primary_location.source && x.primary_location.source.display_name })) });
  if (r.results.length > 1) ctx.add({ title: 'Other people with this name', list: r.results.slice(1).map(x => ({ title: x.display_name, meta: `${fmtNum(x.works_count, 0)} works · ${(x.last_known_institutions && x.last_known_institutions[0] && x.last_known_institutions[0].display_name) || ''}` })) });
  ctx.source('OpenAlex', a.id);
}

// ---------- science, health, nature ----------

export async function chem(ctx, name) {
  ctx.label('Chemistry');
  const base = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${enc(name)}`;
  const r = await get(`${base}/property/Title,MolecularFormula,MolecularWeight,ExactMass,IUPACName,XLogP,Charge,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,TPSA/JSON`);
  const p = r.PropertyTable.Properties[0];
  ctx.input(p.Title || name);
  ctx.add({ title: p.Title || cap(name), image: `${base}/PNG?image_size=300x300`, imageSide: true, table: [['Formula', p.MolecularFormula], ['Molar mass', `${p.MolecularWeight} g/mol`], ['Exact mass', `${p.ExactMass} Da`], ['IUPAC name', p.IUPACName || '—'], ['Charge', String(p.Charge)], ['LogP (XLogP)', p.XLogP != null ? String(p.XLogP) : '—'], ['H-bond donors / acceptors', `${p.HBondDonorCount} / ${p.HBondAcceptorCount}`], ['Polar surface area', p.TPSA != null ? p.TPSA + ' Å²' : '—']] });
  ctx.add({ title: 'More', buttons: [{ label: 'PubChem page', url: `https://pubchem.ncbi.nlm.nih.gov/compound/${p.CID}` }, { label: '3D structure', url: `https://pubchem.ncbi.nlm.nih.gov/compound/${p.CID}#section=3D-Conformer` }, { label: 'Safety (GHS)', url: `https://pubchem.ncbi.nlm.nih.gov/compound/${p.CID}#section=Safety-and-Hazards` }] });
  ctx.source('PubChem (NIH)', `https://pubchem.ncbi.nlm.nih.gov/compound/${p.CID}`);
}

export async function drug(ctx, name) {
  ctx.label('Medication');
  ctx.input(name);
  const q = `openfda.brand_name:"${name}"+openfda.generic_name:"${name}"`;
  const r = await get(`https://api.fda.gov/drug/label.json?search=${enc(q).replace(/%2B/g, '+')}&limit=1`);
  const d = r.results[0];
  const f = d.openfda || {};
  const first = (k) => (d[k] && d[k][0]) || '';
  ctx.add({ title: (f.brand_name || [cap(name)])[0], note: 'From the official FDA label. Not medical advice: ask a pharmacist or doctor about your situation.', table: [['Generic name', (f.generic_name || []).join(', ') || '—'], ['Manufacturer', (f.manufacturer_name || []).join(', ') || '—'], ['Route', (f.route || []).join(', ') || '—'], ['Type', (f.product_type || []).join(', ') || '—']] });
  for (const [k, t] of [['purpose', 'Purpose'], ['indications_and_usage', 'Uses'], ['warnings', 'Warnings'], ['do_not_use', 'Do not use'], ['stop_use', 'Stop use and ask a doctor if'], ['adverse_reactions', 'Side effects']]) {
    if (first(k)) ctx.add({ title: t, text: cut(first(k).replace(/^\s*(?:purpose|uses|warnings|indications and usage|adverse reactions|\d+\s+\w+(?:\s+\w+)?)\s*/i, ''), 900) });
  }
  ctx.source('openFDA drug labels', 'https://open.fda.gov');
}

export async function species(ctx, q) {
  ctx.label('Species');
  const r = await get(`https://api.inaturalist.org/v1/taxa?q=${enc(q)}&per_page=1&locale=en`);
  const t = r.results[0];
  if (!t) throw new Error('No species found.');
  ctx.input(`${t.preferred_common_name ? cap(t.preferred_common_name) + ' — ' : ''}${t.name}`);
  const full = (await get(`https://api.inaturalist.org/v1/taxa/${t.id}?locale=en`)).results[0];
  const anc = (full.ancestors || []).filter(a => ['kingdom', 'phylum', 'class', 'order', 'family', 'genus'].includes(a.rank));
  ctx.add({ title: cap(t.preferred_common_name || t.name), text: cut(strip(full.wikipedia_summary), 600), image: t.default_photo && safeUrl(t.default_photo.medium_url), imageSide: true, table: [['Scientific name', t.name], ['Rank', t.rank], ...anc.map(a => [cap(a.rank), a.name + (a.preferred_common_name ? ` (${a.preferred_common_name})` : '')]), ['Observations', fmtNum(t.observations_count, 0)], ...(full.conservation_status ? [['Conservation status', cap(full.conservation_status.status_name || full.conservation_status.status)]] : [])] });
  ctx.source('iNaturalist', `https://www.inaturalist.org/taxa/${t.id}`);
}

export async function earthquakes(ctx) {
  ctx.label('Earthquakes');
  ctx.input('Recent earthquakes');
  const r = await get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson');
  const f = r.features.sort((a, b) => b.properties.time - a.properties.time);
  ctx.add({ title: `${f.length} earthquakes of magnitude 4.5+ in the past week`, table: { head: ['Magnitude', 'Where', 'When'], rows: f.slice(0, 15).map(e => [e.properties.mag.toFixed(1), { text: e.properties.place, url: e.properties.url }, new Date(e.properties.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })]) } });
  ctx.add({ title: 'Map', plot: { kind: 'geo', lat: f.map(e => e.geometry.coordinates[1]), lon: f.map(e => e.geometry.coordinates[0]), size: f.map(e => e.properties.mag), text: f.map(e => `M${e.properties.mag} ${e.properties.place}`) } });
  ctx.source('USGS', 'https://earthquake.usgs.gov/earthquakes/map/');
}

export async function iss(ctx) {
  ctx.label('Space');
  ctx.input('Where is the International Space Station?');
  const r = await get('https://api.wheretheiss.at/v1/satellites/25544');
  ctx.add({ title: 'ISS right now', table: [['Latitude', r.latitude.toFixed(3)], ['Longitude', r.longitude.toFixed(3)], ['Altitude', `${fmtNum(r.altitude * 0.621371, 0)} mi (${fmtNum(r.altitude, 0)} km)`], ['Speed', `${fmtNum(r.velocity * 0.621371, 0)} mph`], ['In', r.visibility === 'daylight' ? 'Daylight' : 'Earth’s shadow']] });
  ctx.add({ title: 'Ground position', plot: { kind: 'geo', lat: [r.latitude], lon: [r.longitude], size: [14], text: ['ISS'], projection: 'natural earth' } });
  ctx.source('wheretheiss.at', 'https://wheretheiss.at');
}

export async function launches(ctx) {
  ctx.label('Space');
  ctx.input('Upcoming rocket launches');
  const r = await get('https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=8&mode=list');
  ctx.add({ title: 'Upcoming launches', list: r.results.map(l => ({ title: l.name, meta: `${new Date(l.net).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${l.status && l.status.abbrev || ''}`, snippet: l.location || (l.pad && l.pad.location && l.pad.location.name) || '' })) });
  ctx.source('The Space Devs', 'https://thespacedevs.com');
}

export async function spaceWeather(ctx) {
  ctx.label('Space weather');
  ctx.input('Geomagnetic activity (Kp index)');
  const r = await get('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json');
  const last = r[r.length - 1];
  const kp = last.kp_index;
  ctx.add({ title: 'Kp index now', big: true, text: `${kp} — ${kp >= 7 ? 'Strong storm: auroras possible far south' : kp >= 5 ? 'Geomagnetic storm: auroras possible in the northern US' : kp >= 4 ? 'Active' : 'Quiet'}` });
  ctx.add({ title: 'Last few hours', plot: { kind: 'line', xdate: true, ytitle: 'Kp', traces: [{ name: 'Kp', x: r.slice(-360).map(x => x.time_tag + 'Z'), y: r.slice(-360).map(x => x.estimated_kp) }] } });
  ctx.source('NOAA Space Weather Prediction Center', 'https://www.swpc.noaa.gov');
}

// ---------- countries & data ----------

const WB = { population: ['SP.POP.TOTL', 'Population', ''], gdp: ['NY.GDP.MKTP.CD', 'GDP', 'US$'], 'gdp per capita': ['NY.GDP.PCAP.CD', 'GDP per person', 'US$'], 'life expectancy': ['SP.DYN.LE00.IN', 'Life expectancy', 'years'], inflation: ['FP.CPI.TOTL.ZG', 'Inflation', '%'], unemployment: ['SL.UEM.TOTL.ZS', 'Unemployment', '%'], 'fertility rate': ['SP.DYN.TFRT.IN', 'Births per woman', ''], 'internet users': ['IT.NET.USER.ZS', 'Internet users', '% of people'], area: ['AG.LND.TOTL.K2', 'Land area', 'km²'], 'co2 emissions': ['EN.GHG.CO2.PC.CE.AR5', 'CO₂ emissions per person', 't'], literacy: ['SE.ADT.LITR.ZS', 'Literacy rate', '%'], gini: ['SI.POV.GINI', 'Gini (inequality)', ''], 'military spending': ['MS.MIL.XPND.GD.ZS', 'Military spending', '% of GDP'], 'electricity access': ['EG.ELC.ACCS.ZS', 'Access to electricity', '%'] };
export const WB_KEYS = Object.keys(WB).sort((a, b) => b.length - a.length);

export async function countryStat(ctx, stat, country) {
  ctx.label('Country data');
  const cc = countryCode(country);
  if (!cc) throw new Error(`I don't recognise "${country}" as a country.`);
  const [code, label, unit] = WB[stat];
  ctx.input(`${label} of ${regionName(cc)}`);
  const r = await get(`https://api.worldbank.org/v2/country/${cc}/indicator/${code}?format=json&per_page=70`);
  const pts = (r[1] || []).filter(p => p.value != null).reverse();
  if (!pts.length) throw new Error('No data for that.');
  const last = pts[pts.length - 1];
  const val = (v) => (unit === 'US$' ? '$' + fmtBig(v) : unit === '%' || unit === '% of GDP' || unit === '% of people' ? fmtNum(v, 1) + '%' : fmtBig(v) + (unit && !unit.startsWith('%') ? ' ' + unit : ''));
  ctx.add({ title: label, big: true, text: `${val(last.value)} (${last.date})` });
  ctx.add({ title: 'Over time', plot: { kind: 'line', ytitle: unit, traces: [{ name: label, x: pts.map(p => p.date), y: pts.map(p => p.value) }] } });
  ctx.source('World Bank', `https://data.worldbank.org/indicator/${code}?locations=${cc}`);
}

export async function holidays(ctx, country = 'US', year = new Date().getFullYear()) {
  ctx.label('Holidays');
  const cc = countryCode(country) || country.toUpperCase();
  ctx.input(`Public holidays in ${regionName(cc)}, ${year}`);
  const r = await get(`https://date.nager.at/api/v3/PublicHolidays/${year}/${cc}`);
  const today = new Date().toISOString().slice(0, 10);
  ctx.add({ title: `${r.length} public holidays`, table: { head: ['Date', 'Holiday', ''], rows: r.map(h => [new Date(h.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), h.name, h.date >= today ? (h.date === today ? 'Today' : `in ${Math.round((new Date(h.date) - new Date(today)) / 864e5)} days`) : '']) } });
  ctx.source('Nager.Date', 'https://date.nager.at');
}

// ---------- cars ----------

export async function vin(ctx, v) {
  ctx.label('VIN decoder');
  ctx.input(v.toUpperCase());
  const r = await get(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${enc(v)}?format=json`);
  const d = r.Results[0];
  const keys = [['ModelYear', 'Year'], ['Make', 'Make'], ['Model', 'Model'], ['Trim', 'Trim'], ['BodyClass', 'Body'], ['VehicleType', 'Type'], ['DriveType', 'Drive'], ['FuelTypePrimary', 'Fuel'], ['ElectrificationLevel', 'Electrification'], ['EngineCylinders', 'Cylinders'], ['DisplacementL', 'Engine (L)'], ['EngineHP', 'Horsepower'], ['TransmissionStyle', 'Transmission'], ['Doors', 'Doors'], ['Manufacturer', 'Manufacturer'], ['PlantCity', 'Built in'], ['PlantCountry', 'Country built']];
  ctx.add({ title: `${d.ModelYear} ${d.Make} ${d.Model}`.trim(), table: keys.filter(([k]) => d[k]).map(([k, l]) => [l, d[k]]), note: d.ErrorCode && d.ErrorCode !== '0' ? d.ErrorText : undefined });
  if (d.Make && d.Model && d.ModelYear) await recalls(ctx, d.ModelYear, d.Make, d.Model, true);
  ctx.source('NHTSA vPIC', 'https://vpic.nhtsa.dot.gov');
}

export async function recalls(ctx, year, make, model, quiet) {
  if (!quiet) { ctx.label('Vehicle recalls'); ctx.input(`${year} ${make} ${model}`); }
  const r = await get(`https://api.nhtsa.gov/recalls/recallsByVehicle?make=${enc(make)}&model=${enc(model)}&modelYear=${enc(year)}`);
  const list = r.results || [];
  if (!list.length) { ctx.add({ title: 'Recalls', text: `No recalls on file for the ${year} ${make} ${model}.` }); return; }
  const ota = list.filter(x => /over[- ]the[- ]air|OTA/i.test((x.Remedy || '') + (x.Notes || '')));
  ctx.add({ title: `${list.length} recall${list.length === 1 ? '' : 's'}${ota.length ? ` (${ota.length} fixed over the air)` : ''}`, list: list.map(x => ({ title: x.Component, url: `https://www.nhtsa.gov/?nhtsaId=${enc(x.NHTSACampaignNumber)}`, meta: `${x.NHTSACampaignNumber} · ${x.ReportReceivedDate} · ${x.PotentialNumberofUnitsAffected ? fmtNum(x.PotentialNumberofUnitsAffected, 0) + ' vehicles' : ''}`, snippet: cut(x.Summary, 300) })) });
  if (!quiet) ctx.source('NHTSA', 'https://www.nhtsa.gov/recalls');
}

// ---------- media & books ----------

export async function books(ctx, q) {
  ctx.label('Books');
  ctx.input(q);
  const r = await get(`https://openlibrary.org/search.json?q=${enc(q)}&limit=8&fields=key,title,author_name,first_publish_year,cover_i,number_of_pages_median,edition_count,subject`);
  if (!r.docs.length) throw new Error('No books found.');
  ctx.add({ title: `${fmtNum(r.numFound, 0)} results`, list: r.docs.map(b => ({ title: b.title, url: `https://openlibrary.org${b.key}`, meta: [(b.author_name || []).slice(0, 2).join(', '), b.first_publish_year, b.number_of_pages_median ? b.number_of_pages_median + ' pages' : null, b.edition_count ? b.edition_count + ' editions' : null].filter(Boolean).join(' · '), thumb: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-S.jpg` : null })) });
  ctx.source('Open Library', `https://openlibrary.org/search?q=${enc(q)}`);
}

export async function music(ctx, q) {
  ctx.label('Music');
  ctx.input(q);
  const r = await get(`https://itunes.apple.com/search?term=${enc(q)}&entity=song&limit=10`);
  if (!r.results.length) throw new Error('No songs found.');
  ctx.add({ title: 'Songs', list: r.results.map(s => ({ title: s.trackName, url: safeUrl(s.trackViewUrl), meta: `${s.artistName} · ${s.collectionName} · ${(s.releaseDate || '').slice(0, 4)} · ${Math.floor(s.trackTimeMillis / 60000)}:${String(Math.round(s.trackTimeMillis / 1000 % 60)).padStart(2, '0')}`, thumb: safeUrl(s.artworkUrl60), audio: safeUrl(s.previewUrl) })) });
  ctx.source('Apple iTunes Search', 'https://www.apple.com/itunes/');
}

export async function tv(ctx, q) {
  ctx.label('TV');
  const r = await get(`https://api.tvmaze.com/singlesearch/shows?q=${enc(q)}&embed=episodes`);
  ctx.input(r.name);
  const eps = (r._embedded && r._embedded.episodes) || [];
  const seasons = new Set(eps.map(e => e.season)).size;
  ctx.add({ title: r.name, text: cut(strip(r.summary), 600), image: r.image && safeUrl(r.image.medium), imageSide: true, table: [['Premiered', r.premiered || '—'], ['Ended', r.ended || (r.status === 'Running' ? 'Still running' : '—')], ['Network', (r.network && r.network.name) || (r.webChannel && r.webChannel.name) || '—'], ['Genres', r.genres.join(', ') || '—'], ['Rating', r.rating && r.rating.average ? r.rating.average + '/10' : '—'], ['Seasons / episodes', `${seasons} / ${eps.length}`]] });
  ctx.source('TVmaze', r.url);
}

// ---------- developer ----------

export async function github(ctx, q) {
  ctx.label('GitHub');
  ctx.input(q);
  const r = await get(`https://api.github.com/search/repositories?q=${enc(q)}&per_page=10`, { init: { headers: { Accept: 'application/vnd.github+json' } } });
  ctx.add({ title: `${fmtNum(r.total_count, 0)} repositories`, list: r.items.map(x => ({ title: x.full_name, url: x.html_url, meta: `★ ${fmtNum(x.stargazers_count, 0)} · ${x.language || ''} · updated ${x.pushed_at.slice(0, 10)}`, snippet: x.description || '' })) });
}

export async function stackoverflow(ctx, q) {
  ctx.label('Stack Overflow');
  ctx.input(q);
  const r = await get(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${enc(q)}&site=stackoverflow&pagesize=10`);
  ctx.add({ title: 'Questions', list: r.items.map(x => ({ title: strip(x.title), url: x.link, meta: `${x.score} votes · ${x.answer_count} answers${x.is_answered ? ' · ✓ answered' : ''} · ${x.tags.slice(0, 4).join(', ')}` })) });
}

export async function npm(ctx, q) {
  ctx.label('npm');
  ctx.input(q);
  const r = await get(`https://registry.npmjs.org/-/v1/search?text=${enc(q)}&size=8`);
  ctx.add({ title: 'Packages', list: r.objects.map(o => ({ title: `${o.package.name}@${o.package.version}`, url: `https://www.npmjs.com/package/${o.package.name}`, snippet: o.package.description || '', meta: `npm install ${o.package.name}` })) });
}

export async function pypi(ctx, q) {
  ctx.label('PyPI');
  const r = await get(`https://pypi.org/pypi/${enc(q.trim())}/json`);
  const i = r.info;
  ctx.input(`${i.name} ${i.version}`);
  ctx.add({ title: i.name, text: i.summary || '', table: [['Latest version', i.version], ['Install', `pip install ${i.name}`], ['License', cut(i.license || '—', 60)], ['Requires Python', i.requires_python || '—'], ['Author', i.author || i.maintainer || '—'], ['Released', ((r.urls[0] || {}).upload_time || '').slice(0, 10) || '—']] });
  ctx.source('PyPI', i.package_url);
}

export async function hackernews(ctx, q) {
  ctx.label('Hacker News');
  ctx.input(q);
  const r = await get(`https://hn.algolia.com/api/v1/search?query=${enc(q)}&tags=story&hitsPerPage=10`);
  ctx.add({ title: 'Stories', list: r.hits.map(h => ({ title: h.title, url: safeUrl(h.url) || `https://news.ycombinator.com/item?id=${h.objectID}`, meta: `${h.points} points · ${h.num_comments} comments · ${h.created_at.slice(0, 10)}` })) });
}

export async function reddit(ctx, q) {
  // Reddit blocks requests from cloud servers, so this opens searches instead of fetching.
  ctx.label('Reddit');
  ctx.input(q);
  ctx.add({ title: 'Search Reddit', note: 'Reddit doesn’t allow outside sites to read results, so these open in a new tab.', buttons: [
    { label: 'Reddit search', url: `https://www.reddit.com/search/?q=${enc(q)}` }, { label: 'Top posts this year', url: `https://www.reddit.com/search/?q=${enc(q)}&sort=top&t=year` },
    { label: 'Via Google', url: `https://www.google.com/search?q=${enc(q + ' site:reddit.com')}` }, { label: 'Via DuckDuckGo', url: `https://duckduckgo.com/?q=${enc(q + ' site:reddit.com')}` }] });
}

// ---------- network & security lookups ----------

export async function dns(ctx, domain) {
  ctx.label('DNS');
  ctx.input(domain);
  const types = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'CAA'];
  const res = await Promise.all(types.map(t => get(`https://dns.google/resolve?name=${enc(domain)}&type=${t}`).catch(() => ({}))));
  const rows = [];
  res.forEach((r, i) => (r.Answer || []).filter(a => a.type === { A: 1, AAAA: 28, CNAME: 5, MX: 15, NS: 2, TXT: 16, CAA: 257 }[types[i]]).forEach(a => rows.push([types[i], a.data, a.TTL + 's'])));
  if (!rows.length) throw new Error('No DNS records found.');
  ctx.add({ title: 'Records', table: { head: ['Type', 'Value', 'TTL'], rows } });
  ctx.source('Google Public DNS', 'https://dns.google');
}

export async function whois(ctx, domain) {
  ctx.label('Domain registration');
  ctx.input(domain);
  const r = await get(`https://rdap.org/domain/${enc(domain)}`);
  const ev = Object.fromEntries((r.events || []).map(e => [e.eventAction, e.eventDate.slice(0, 10)]));
  const reg = (r.entities || []).find(e => (e.roles || []).includes('registrar'));
  const regName = reg && reg.vcardArray ? ((reg.vcardArray[1] || []).find(v => v[0] === 'fn') || [])[3] : null;
  ctx.add({ title: r.ldhName || domain, table: [['Registrar', regName || '—'], ['Registered', ev.registration || '—'], ['Expires', ev.expiration || '—'], ['Last changed', ev['last changed'] || '—'], ['Status', (r.status || []).join(', ') || '—'], ['Name servers', (r.nameservers || []).map(n => n.ldhName.toLowerCase()).join(', ') || '—'], ['DNSSEC', r.secureDNS && r.secureDNS.delegationSigned ? 'Signed' : 'Not signed']] });
  ctx.source('RDAP', `https://rdap.org/domain/${domain}`);
}

export async function ipInfo(ctx, ip) {
  ctx.label('IP address');
  const me = !ip;
  const geo = await get(me ? 'https://ipapi.co/json/' : `https://ipapi.co/${enc(ip)}/json/`);
  ip = ip || geo.ip;
  ctx.input(me ? `Your IP address: ${ip}` : ip);
  ctx.add({ title: me ? 'You' : 'Location', table: [['IP', geo.ip], ['Approx. location', [geo.city, geo.region, geo.country_name].filter(Boolean).join(', ') || '—'], ['Network', geo.org || '—'], ['ASN', geo.asn || '—'], ['Time zone', geo.timezone || '—']] });
  if (!me) {
    try {
      const s = await get(`https://internetdb.shodan.io/${enc(ip)}`);
      ctx.add({ title: 'Public exposure', table: [['Open ports', (s.ports || []).join(', ') || 'none seen'], ['Hostnames', (s.hostnames || []).join(', ') || '—'], ['Tags', (s.tags || []).join(', ') || '—'], ['Known vulnerabilities', (s.vulns || []).slice(0, 12).join(', ') || 'none listed']] });
    } catch (_) {}
  }
  ctx.source('ipapi.co + Shodan InternetDB', 'https://internetdb.shodan.io');
}

export async function certs(ctx, domain) {
  ctx.label('Certificates');
  ctx.input(domain);
  const r = await get(`https://crt.sh/?q=${enc('%.' + domain)}&output=json`, { proxy: true, timeout: 45000, retries: 0 });
  const names = [...new Set(r.flatMap(c => c.name_value.split('\n')).map(n => n.toLowerCase().replace(/^\*\./, '')))].filter(n => n.endsWith(domain)).sort();
  ctx.add({ title: `${names.length} names seen in certificates`, text: names.slice(0, 200).join('\n'), pre: true });
  ctx.add({ title: 'Recent certificates', table: { head: ['Issued', 'Issuer', 'Names'], rows: r.slice(0, 10).map(c => [c.not_before.slice(0, 10), (c.issuer_name.match(/O=([^,]+)/) || [, c.issuer_name])[1], cut(c.name_value.replace(/\n/g, ', '), 80)]) } });
  ctx.source('crt.sh (Certificate Transparency)', `https://crt.sh/?q=${enc(domain)}`);
}

export async function wayback(ctx, url) {
  ctx.label('Web archive');
  ctx.input(url);
  const r = await get(`https://archive.org/wayback/available?url=${enc(url)}`, { proxy: true });
  const s = r.archived_snapshots && r.archived_snapshots.closest;
  ctx.add({ title: 'Wayback Machine', text: s ? `Latest snapshot: ${s.timestamp.replace(/(\d{4})(\d\d)(\d\d).*/, '$1-$2-$3')}` : 'No snapshots found.', buttons: [...(s ? [{ label: 'Open snapshot', url: s.url }] : []), { label: 'All snapshots', url: `https://web.archive.org/web/*/${url}` }, { label: 'Save it now', url: `https://web.archive.org/save/${url}` }] });
}

export async function cve(ctx, id) {
  ctx.label('Vulnerability');
  id = id.toUpperCase();
  ctx.input(id);
  const r = await get(`https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${enc(id)}`);
  const v = r.vulnerabilities[0] && r.vulnerabilities[0].cve;
  if (!v) throw new Error('CVE not found.');
  const m = v.metrics || {};
  const cv = (m.cvssMetricV31 || m.cvssMetricV30 || m.cvssMetricV2 || [])[0];
  ctx.add({ title: id, text: (v.descriptions.find(d => d.lang === 'en') || {}).value, table: [['Severity', cv ? `${cv.cvssData.baseScore} ${cv.cvssData.baseSeverity || cv.baseSeverity || ''}` : '—'], ['Published', v.published.slice(0, 10)], ['Last modified', v.lastModified.slice(0, 10)], ['Weakness', (v.weaknesses || []).flatMap(w => w.description.map(d => d.value)).join(', ') || '—']] });
  ctx.add({ title: 'References', list: (v.references || []).slice(0, 8).map(x => ({ title: x.url, url: x.url, meta: (x.tags || []).join(', ') })) });
  ctx.source('NIST National Vulnerability Database', `https://nvd.nist.gov/vuln/detail/${id}`);
}

// ---------- general web search ----------

export async function webResults(ctx, q) {
  const r = await fetch(PROXY.replace('url=', 'search=') + enc(q));
  if (r.status === 501) return 0;
  if (!r.ok) return 0;
  const d = await r.json();
  const items = (d.web && d.web.results) || [];
  if (!items.length) return 0;
  ctx.add({ title: 'Web results', list: items.map(x => ({ title: strip(x.title), url: safeUrl(x.url), meta: x.meta_url ? x.meta_url.hostname : '', snippet: strip(x.description) })), source: { name: 'Brave Search', url: 'https://search.brave.com' } });
  return items.length;
}

export const ENGINES = [
  ['Google', 'https://www.google.com/search?q='], ['Bing', 'https://www.bing.com/search?q='], ['DuckDuckGo', 'https://duckduckgo.com/?q='], ['Brave', 'https://search.brave.com/search?q='],
  ['Google Scholar', 'https://scholar.google.com/scholar?q='], ['YouTube', 'https://www.youtube.com/results?search_query='], ['Reddit', 'https://www.reddit.com/search/?q='], ['Wikipedia', 'https://en.wikipedia.org/w/index.php?search='],
];

// ---------- direct answers from Wikidata ----------
// Each question shape maps to Wikidata properties; the entity is found through Wikipedia search.
export const QA = [
  [/^how (?:tall|high) (?:is|was|are) (?:the )?(.+)$/i, ['P2048', 'P2044'], 'Height'],
  [/^what is the (?:height|elevation) of (?:the )?(.+)$/i, ['P2048', 'P2044'], 'Height'],
  [/^how old (?:is|was) (.+)$/i, ['P569'], 'Age'],
  [/^when (?:was|were) (.+?) born$/i, ['P569'], 'Born'],
  [/^(?:what is |what's )?(.+?)(?:'s|’s) (?:birthday|birth date|date of birth)$/i, ['P569'], 'Born'],
  [/^when did (.+?) die$/i, ['P570'], 'Died'],
  [/^where (?:was|were) (.+?) born$/i, ['P19'], 'Birthplace'],
  [/^where did (.+?) die$/i, ['P20'], 'Place of death'],
  [/^when (?:was|were|did) (?:the )?(.+?) (?:founded|established|created|formed|start|started|begin|began|incorporated)$/i, ['P571', 'P580'], 'Founded'],
  [/^when (?:was|were) (?:the )?(.+?) (?:built|constructed|completed|opened|erected)$/i, ['P1619', 'P571'], 'Built / opened'],
  [/^when (?:was|were) (?:the )?(.+?) (?:invented|discovered|first made)$/i, ['P575', 'P571'], 'Invented / discovered'],
  [/^when (?:was|were|did) (?:the )?(.+?) (?:released|published|come out|came out|premiere|air)$/i, ['P577'], 'Released'],
  [/^who (?:founded|started|created|established) (?:the )?(.+)$/i, ['P112', 'P170'], 'Founded by'],
  [/^who (?:invented|discovered) (?:the )?(.+)$/i, ['P61', 'P170'], 'Invented / discovered by'],
  [/^who (?:wrote|authored) (?:the )?(.+)$/i, ['P50'], 'Written by'],
  [/^who directed (?:the )?(.+)$/i, ['P57'], 'Directed by'],
  [/^who (?:painted|sculpted|designed|made|built) (?:the )?(.+)$/i, ['P170', 'P84', 'P176'], 'Made by'],
  [/^who (?:composed|sang|performed) (?:the )?(.+)$/i, ['P86', 'P175'], 'By'],
  [/^who (?:is|was|'s) the (?:ceo|chief executive|head|boss) of (?:the )?(.+)$/i, ['P169', 'P488'], 'CEO / head'],
  [/^who (?:is|was|'s) the (?:president|head of state|king|queen|monarch|emperor) of (?:the )?(.+)$/i, ['P35'], 'Head of state'],
  [/^who (?:is|was|'s) the (?:prime minister|premier|chancellor|head of government|mayor|governor|leader) of (?:the )?(.+)$/i, ['P6'], 'Head of government'],
  [/^(?:what is |what's )?the capital (?:city )?of (?:the )?(.+)$/i, ['P36'], 'Capital'],
  [/^(?:what )?(?:currency|money) (?:does|do|is used in|of) (?:the )?(.+?)(?: use)?$/i, ['P38'], 'Currency'],
  [/^(?:what )?languages? (?:is |are )?(?:spoken in|of|do they speak in|does) (?:the )?(.+?)(?: speak)?$/i, ['P37', 'P2936'], 'Language'],
  [/^how long is (?:the )?(.+)$/i, ['P2043', 'P2047'], 'Length / duration'],
  [/^how (?:big|large) is (?:the )?(.+)$/i, ['P2046', 'P2386', 'P2067'], 'Size'],
  [/^how deep is (?:the )?(.+)$/i, ['P4511', 'P2044'], 'Depth'],
  [/^how much does (?:the |a |an )?(.+?) weigh$/i, ['P2067'], 'Mass'],
  [/^how (?:many people live in|populated is) (?:the )?(.+)$/i, ['P1082'], 'Population'],
  [/^(?:what is )?the population of (?:the )?(.+)$/i, ['P1082'], 'Population'],
  [/^how many employees does (?:the )?(.+?) have$/i, ['P1128'], 'Employees'],
  [/^who (?:is|was) (.+?) married to$/i, ['P26'], 'Spouse'],
  [/^who (?:is|was) (.+?)(?:'s|’s) (?:wife|husband|spouse|partner)$/i, ['P26'], 'Spouse'],
  [/^(?:what is |what's )?(.+?)(?:'s|’s) (?:net worth)$/i, ['P2218'], 'Net worth'],
  [/^where is (?:the )?(.+?) (?:located|headquartered|based)$/i, ['P159', 'P131', 'P17'], 'Location'],
  [/^what (?:country|state) is (?:the )?(.+?) in$/i, ['P17', 'P131'], 'Location'],
  [/^what (?:is|was) (.+?)(?:'s|’s) (?:job|occupation|profession)$/i, ['P106'], 'Occupation'],
  [/^what is the (?:atomic number|symbol) of (.+)$/i, ['P1086', 'P246'], 'Element'],
  [/^how far is (?:the )?(.+?) from (?:the )?earth$/i, ['P2583'], 'Distance from Earth'],
  [/^what is the boiling point of (.+)$/i, ['P2102'], 'Boiling point'],
  [/^what is the melting point of (.+)$/i, ['P2101'], 'Melting point'],
];

async function wdEntity(name) {
  const s = await get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc(name)}&srlimit=1&format=json&origin=*`);
  const hit = s.query.search[0];
  if (!hit) return null;
  const sum = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${enc(hit.title.replace(/ /g, '_'))}`);
  return sum.wikibase_item ? { qid: sum.wikibase_item, title: sum.title, description: sum.description, extract: sum.extract, url: sum.content_urls.desktop.page, thumb: sum.thumbnail && sum.thumbnail.source } : null;
}

export async function directAnswer(ctx, props, label, name) {
  const ent = await wdEntity(name.replace(/[?.!]+$/, ''));
  if (!ent) return false;
  const e = (await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ent.qid}&props=claims&format=json&origin=*`)).entities[ent.qid];
  let prop = props.find(p => e.claims && e.claims[p] && e.claims[p].length);
  if (!prop) return false;
  const pick = (arr) => { const pref = arr.filter(c => c.rank === 'preferred'); return pref.length ? pref : arr.filter(c => c.rank !== 'deprecated'); };
  const claims = pick(e.claims[prop]).slice(-6);
  const ids = new Set(), vals = [];
  for (const c of claims) {
    const dv = c.mainsnak && c.mainsnak.datavalue;
    if (!dv) continue;
    if (dv.type === 'wikibase-entityid') { ids.add(dv.value.id); vals.push({ id: dv.value.id }); }
    else if (dv.type === 'time') vals.push({ time: dv.value });
    else if (dv.type === 'quantity') { const u = dv.value.unit.split('/').pop(); if (u !== '1') ids.add(u); vals.push({ q: +dv.value.amount, unit: u !== '1' ? u : null }); }
    else vals.push({ s: String(dv.value.text || dv.value) });
  }
  const labels = {};
  if (ids.size) { const r = await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${[...ids].join('|')}&props=labels&languages=en&format=json&origin=*`); for (const [k, v] of Object.entries(r.entities)) labels[k] = v.labels && v.labels.en ? v.labels.en.value : k; }
  const UNIT = { Q11573: 'm', Q828224: 'km', Q3710: 'ft', Q11570: 'kg', Q712226: 'km²', Q25343: 'm²', Q11574: 's', Q7727: 'min', Q25235: 'h', Q4917: 'USD', Q25267: '°C', Q42289: '°F', Q11579: 'K', Q531: 'light-years', Q12129: 'parsecs' };
  const toText = (v) => {
    if (v.id) return labels[v.id] || v.id;
    if (v.time) return wdTime(v.time);
    if (v.q != null) { const u = v.unit ? (UNIT[v.unit] || labels[v.unit] || '') : ''; let t = (Math.abs(v.q) >= 1e6 ? fmtBig(v.q) : fmtNum(v.q)) + (u ? ' ' + u : ''); if (u === 'm') t += ` (${fmtNum(v.q * 3.28084, 0)} ft)`; if (u === 'km²') t += ` (${fmtNum(v.q * 0.386102, 0)} mi²)`; return t; }
    return v.s;
  };
  let answer = [...new Set(vals.map(toText))].join(', ');
  if (label === 'Age') {
    const b = vals[0] && vals[0].time && /([+-])(\d+)-(\d\d)-(\d\d)/.exec(vals[0].time.time);
    if (b) {
      const born = new Date(+b[2], +b[3] - 1, +b[4] || 1);
      const died = e.claims.P570 && e.claims.P570[0].mainsnak.datavalue && /(\d+)-(\d\d)-(\d\d)/.exec(e.claims.P570[0].mainsnak.datavalue.value.time);
      const end = died ? new Date(+died[1], +died[2] - 1, +died[3] || 1) : new Date();
      let yrs = end.getFullYear() - born.getFullYear(); if (end < new Date(end.getFullYear(), born.getMonth(), born.getDate())) yrs--;
      answer = died ? `Died at age ${yrs} (born ${wdTime(vals[0].time)})` : `${yrs} years old (born ${wdTime(vals[0].time)})`;
    }
  }
  if (prop === 'P1082' && claims.length > 1) answer = toText(vals[vals.length - 1]);
  ctx.label('Answer');
  ctx.input(`${label}: ${ent.title}${ent.description ? ` (${ent.description})` : ''}`);
  ctx.add({ title: label, big: true, text: answer });
  ctx.add({ title: ent.title, text: cut(ent.extract, 320), image: safeUrl(ent.thumb) || undefined, imageSide: true, links: [{ label: 'Wikipedia', url: ent.url }, { label: 'All facts', query: `wiki ${ent.title}` }] });
  ctx.source('Wikidata', `https://www.wikidata.org/wiki/${ent.qid}#${prop}`);
  return true;
}

// ---------- explanations ----------
export async function explain(ctx, topic, { simple = true } = {}) {
  ctx.label('Explanation');
  const t = topic.replace(/^(?:the|a|an)\s+/i, '').replace(/[?.!]+$/, '');
  const look = async (host) => {
    const s = await get(`https://${host}/w/api.php?action=query&list=search&srsearch=${enc(t)}&srlimit=5&format=json&origin=*`);
    if (!s.query.search.length) return null;
    const words = t.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !/^(?:what|does|work|works|how|why|the|and|with)$/.test(w)).map(w => w.replace(/(?:ies|es|s)$/, ''));
    const fits = (x) => words.some(w => x.title.toLowerCase().includes(w));
    const question = /^(?:why|how|what makes|what causes)\b/i.test(t);
    const hit = s.query.search.find(x => x.title.toLowerCase() === t.toLowerCase()) || (question ? s.query.search[0] : s.query.search.find(fits)) || s.query.search[0];
    if (host.startsWith('simple') && !question && !fits(hit) && words.length) return null;
    const sum = await get(`https://${host}/api/rest_v1/page/summary/${enc(hit.title.replace(/ /g, '_'))}`);
    return { sum, others: s.query.search.filter(x => x !== hit).map(x => x.title) };
  };
  let lastErr = null;
  const [simpleR, enR] = await Promise.all([look('simple.wikipedia.org').catch(e => { lastErr = e; return null; }), look('en.wikipedia.org').catch(e => { lastErr = e; return null; })]);
  if (!simpleR && !enR) throw lastErr && /busy|reach|long/.test(lastErr.message) ? lastErr : new Error(`I couldn't find an explanation of "${t}".`);
  const main = (simple && simpleR) ? simpleR : enR;
  ctx.input(main.sum.title);
  ctx.add({ title: simple && simpleR ? 'In plain words' : main.sum.title, text: main.sum.extract, image: main.sum.thumbnail ? safeUrl(main.sum.thumbnail.source) : undefined, imageSide: true, note: simple && simpleR ? 'From Simple English Wikipedia, written for younger readers and English learners.' : undefined });
  if (enR && main !== enR) ctx.add({ title: 'In more depth', text: enR.sum.extract, links: [{ label: 'Full article', url: enR.sum.content_urls.desktop.page }] });
  const terms = (enR ? enR.sum.extract : '').match(/\b[a-z]{9,}\b/g) || [];
  const hard = [...new Set(terms)].slice(0, 12);
  if (hard.length) {
    const defs = (await Promise.all(hard.map(w => get(`https://api.datamuse.com/words?sp=${enc(w)}&md=fd&max=1`).then(d => d[0]).catch(() => null))))
      .filter(r => r && r.defs && r.tags).map(r => ({ w: r.word, f: parseFloat((r.tags.find(x => x.startsWith('f:')) || 'f:99').slice(2)), d: r.defs[0].split('\t')[1] })).filter(r => r.f < 8 && r.d && !/[|=]|thumb|alt=/.test(r.d)).slice(0, 6);
    if (defs.length) ctx.add({ title: 'Words to know', table: defs.map(r => [r.w, r.d]) });
  }
  const related = [...new Set([...(enR ? enR.others : []), ...(simpleR ? simpleR.others : [])])].slice(0, 6);
  if (related.length) ctx.add({ title: 'Related ideas', chips: related.map(r => `explain ${r}`) });
  ctx.add({ title: 'Learn more', buttons: [{ label: 'Khan Academy', url: `https://www.khanacademy.org/search?page_search_query=${enc(t)}` }, { label: 'YouTube explainers', url: `https://www.youtube.com/results?search_query=${enc(t + ' explained')}` }, { label: 'OpenStax textbooks', url: `https://openstax.org/search?q=${enc(t)}` }] });
  ctx.source('Wikipedia / Simple English Wikipedia', main.sum.content_urls.desktop.page);
}
