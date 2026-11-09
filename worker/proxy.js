// Cloudflare Pages Function: GET /tools/api/proxy?url=<encoded URL>
// Fetches from a fixed allowlist of public data sources that don't allow
// direct browser access (no CORS). It is not an open proxy:
//   - only the hosts below are reachable
//   - only requests coming from this site's own pages are served
//   - responses are cached at the edge for a few minutes

const ALLOW = new Set([
  'simple.wikipedia.org',
  'export.arxiv.org',
  'api.semanticscholar.org',
  'api.github.com',
  'crt.sh',
  'archive.org',
  'web.archive.org',
  'query1.finance.yahoo.com',
  'stooq.com',
  'efts.sec.gov',
  'www.sec.gov',
  'data.sec.gov',
  'api.dictionaryapi.dev',
  'api.frankfurter.app',
  'api.osv.dev',
  'gutendex.com',
  'world.openfoodfacts.org',
  'api.datacite.org',
  'exoplanetarchive.ipac.caltech.edu',
  // fallbacks for sources that occasionally refuse direct browser requests
  'geocoding-api.open-meteo.com',
  'api.open-meteo.com',
  'air-quality-api.open-meteo.com',
  'router.project-osrm.org',
  'api.datamuse.com',
  'openlibrary.org',
  'api.coingecko.com',
  'api.openalex.org',
  'en.wikipedia.org',
  'www.wikidata.org',
  'api.duckduckgo.com',
  'nominatim.openstreetmap.org',
  'ssd-api.jpl.nasa.gov',
  'api.gdeltproject.org',
  'api.artic.edu',
  'site.api.espn.com',
  'archive-api.open-meteo.com',
  'api.nasa.gov',
  'api.nal.usda.gov',
]);

const POST_OK = new Set(['api.osv.dev']);

// "Read a page" mode: open-content and public-institution sites only, so the helper can
// never be used as a general-purpose proxy.
const READ_DOMAINS = [
  /\.(?:gov|edu|mil)$/, /\.(?:gov|ac|edu)\.[a-z]{2}$/, /\.ac\.uk$/, /\.europa\.eu$/, /\.int$/,
  /(?:^|\.)wikipedia\.org$/, /(?:^|\.)wikisource\.org$/, /(?:^|\.)wikibooks\.org$/, /(?:^|\.)wiktionary\.org$/, /(?:^|\.)wikivoyage\.org$/,
  /^(?:export\.)?arxiv\.org$/, /(?:^|\.)biorxiv\.org$/, /(?:^|\.)medrxiv\.org$/, /(?:^|\.)europepmc\.org$/, /(?:^|\.)plos\.org$/,
  /(?:^|\.)mdpi\.com$/, /(?:^|\.)frontiersin\.org$/, /(?:^|\.)peerj\.com$/, /(?:^|\.)elifesciences\.org$/, /(?:^|\.)scienceopen\.com$/,
  /(?:^|\.)gutenberg\.org$/, /(?:^|\.)archive\.org$/, /^raw\.githubusercontent\.com$/, /^github\.com$/, /(?:^|\.)openstax\.org$/,
  /(?:^|\.)libretexts\.org$/, /(?:^|\.)who\.int$/, /(?:^|\.)un\.org$/, /(?:^|\.)oecd\.org$/, /(?:^|\.)worldbank\.org$/, /(?:^|\.)nature\.com$/,
  /(?:^|\.)sciencedirect\.com$/, /(?:^|\.)springer\.com$/, /(?:^|\.)ieee\.org$/, /(?:^|\.)acm\.org$/, /(?:^|\.)jstor\.org$/, /(?:^|\.)ssrn\.com$/,
  /(?:^|\.)semanticscholar\.org$/, /(?:^|\.)openreview\.net$/, /(?:^|\.)aclanthology\.org$/, /(?:^|\.)python\.org$/, /(?:^|\.)mozilla\.org$/,
  /(?:^|\.)w3\.org$/, /(?:^|\.)ietf\.org$/, /(?:^|\.)rfc-editor\.org$/, /(?:^|\.)britannica\.com$/, /(?:^|\.)stanford\.edu$/,
];
const readable = (host) => READ_DOMAINS.some(re => re.test(host));
const MAX_READ = 15 * 1024 * 1024;

async function readPage(raw) {
  let target;
  try { target = new URL(raw); } catch (_) { return json({ error: 'Bad url' }, 400); }
  // Public Google Docs / Sheets / Slides, export links only (they redirect to googleusercontent.com).
  const gdoc = target.hostname === 'docs.google.com' && /^\/(?:document|spreadsheets|presentation)\/d\/[\w-]+\/export/.test(target.pathname);
  if (!/^https?:$/.test(target.protocol) || !(gdoc || readable(target.hostname))) return json({ error: 'Site not on the reading list' }, 403);
  const r = await fetch(target.toString(), { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; cymartinbell.com-tools/1.0; reader)', 'Accept': 'text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.5' }, cf: { cacheTtl: 3600, cacheEverything: true } });
  const finalHost = new URL(r.url).hostname;
  if (gdoc && /accounts\.google\.com$/.test(finalHost)) return json({ error: 'This Google file is not shared publicly' }, 401);
  if (!readable(finalHost) && !(gdoc && /(?:^|\.)(?:googleusercontent\.com|docs\.google\.com)$/.test(finalHost))) return json({ error: 'Redirected off the reading list' }, 403);
  const type = r.headers.get('Content-Type') || '';
  if (!/text\/html|application\/xhtml|application\/pdf|text\/plain|text\/csv|application\/xml|text\/xml/i.test(type)) return json({ error: 'Unsupported content type' }, 415);
  const len = +(r.headers.get('Content-Length') || 0);
  if (len > MAX_READ) return json({ error: 'File too large' }, 413);
  const buf = await r.arrayBuffer();
  if (buf.byteLength > MAX_READ) return json({ error: 'File too large' }, 413);
  return new Response(buf, { status: r.status, headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=3600', 'X-Robots-Tag': 'noindex' } });
}

export async function onRequest({ request, env }) {
  const self = new URL(request.url);

  // Only serve this site's own pages.
  const ref = request.headers.get('Referer') || request.headers.get('Origin') || '';
  let refHost = '';
  try { refHost = new URL(ref).host; } catch (_) {}
  if (refHost !== self.host) return json({ error: 'Forbidden' }, 403);

  if (self.searchParams.get('read')) return readPage(self.searchParams.get('read'));

  // Optional web search (Brave Search API). Add BRAVE_KEY in Cloudflare →
  // Settings → Variables and Secrets to turn it on. Free tier available.
  if (self.searchParams.get('search')) {
    if (!env.BRAVE_KEY) return json({ error: 'web search not configured' }, 501);
    const q = self.searchParams.get('search');
    const r = await fetch('https://api.search.brave.com/res/v1/web/search?count=10&q=' + encodeURIComponent(q), {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': env.BRAVE_KEY },
    });
    return new Response(r.body, { status: r.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' } });
  }

  let target;
  try { target = new URL(self.searchParams.get('url') || ''); } catch (_) { return json({ error: 'Bad url' }, 400); }
  if (target.protocol !== 'https:' || !ALLOW.has(target.hostname)) return json({ error: 'Host not allowed' }, 403);

  const method = request.method === 'POST' && POST_OK.has(target.hostname) ? 'POST' : 'GET';
  const init = {
    method,
    headers: {
      'User-Agent': 'cymartinbell.com-tools/1.0',
      'Accept': request.headers.get('Accept') || '*/*',
    },
    // Cache at Cloudflare's edge so repeat questions don't hit the source again (and its rate limits).
    cf: { cacheTtl: ttlFor(target.hostname), cacheEverything: method === 'GET', cacheTtlByStatus: { '200-299': ttlFor(target.hostname), '404': 600, '429': 0, '500-599': 0 } },
  };
  if (method === 'POST') {
    init.body = await request.text();
    init.headers['Content-Type'] = 'application/json';
  }

  const upstream = await fetch(target.toString(), init);
  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('Content-Type') || 'text/plain');
  headers.set('Cache-Control', upstream.ok ? `public, max-age=${Math.min(ttlFor(target.hostname), 3600)}` : 'no-store');
  headers.set('X-Robots-Tag', 'noindex');
  return new Response(upstream.body, { status: upstream.status, headers });
}

// Reference data barely changes; live data (weather, prices, scores) does.
function ttlFor(host) {
  if (/wikipedia\.org$|wikidata\.org$|dictionaryapi\.dev$|datamuse\.com$|openlibrary\.org$|crossref\.org$|openalex\.org$|arxiv\.org$|themealdb\.com$|artic\.edu$/.test(host)) return 86400;
  if (/open-meteo\.com$|coingecko\.com$|finance\.yahoo\.com$|espn\.com$|stooq\.com$|frankfurter\.app$/.test(host)) return 300;
  return 1800;
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
