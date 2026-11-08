# Cy Martin-Bell — portfolio + web design services

Static site, no build step. Hosted on Cloudflare Pages from GitHub.

## Files
| File | What it is |
|---|---|
| `index.html` | Personal portfolio (about, projects, activities, gallery, contact) |
| `services.html` | Studio page for nonprofits & small businesses (services, client work, process, pricing, FAQ, project inquiry form) |
| `privacy.html`, `terms.html` | Legal templates — review before launch |
| `thanks.html` | Shown after a form is sent |
| `404.html` | Not-found page (Cloudflare uses it automatically) |
| `style.css`, `script.js` | Shared design and behavior |
| `images/` | All photos |

## Filling it in
Search the project for `[` and replace every bracketed placeholder.

## Photos
Put these in `images/` (JPG, ~2000px wide max, under ~400 KB each):
- `profile.jpg` (portrait, 4:5)
- `services.jpg` (a site you've built, 16:9)
- `client1.jpg` – `client3.jpg` (client work, 16:10)
- `project1.jpg` – `project6.jpg` (16:10)
- `gallery1.jpg` – `gallery5.jpg` (gallery1 is the wide one)
- `og.jpg`, `og-services.jpg` (1200×630, used when links are shared)

Missing photos show an "Add photo" box, so nothing breaks.

## Forms (Web3Forms, free: 250 messages/month)
Cloudflare Pages has no built-in form handling, so both forms send through Web3Forms,
which emails each message to you.

1. Go to https://web3forms.com, enter cymartinbell@gmail.com, and copy the access key it emails you.
2. In `index.html` and `services.html`, replace `YOUR_WEB3FORMS_ACCESS_KEY` with that key.
3. Push. Done. Test it once on the live site.

The access key is meant to be public, so it's fine in the HTML.

## Deploy (Cloudflare Pages)
1. Push this folder to GitHub.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick the repo.
3. Framework preset: **None**. Build command: leave empty. Build output directory: `/`
4. Custom domains → add cymartinbell.com.

Every push to `main` redeploys automatically.

- `_headers` sets security headers (Cloudflare reads it automatically).
- `404.html` is used automatically for missing pages.
- Cloudflare serves clean URLs: `/services` works, and `/services.html` redirects to it.

## Tools page (/tools)
A "type anything" answer engine at `cymartinbell.com/tools`. It isn't linked anywhere,
isn't in the sitemap, and tells search engines not to index it. "Hidden" isn't the same as
private: anyone who has the link can open it.

No AI is used. Queries are matched against hand-written rules; math runs on SymPy and math.js
in the browser; facts come from public APIs; files are searched with keyword ranking (BM25).

| File | What it does |
|---|---|
| `tools/index.html`, `tools.css` | The page |
| `tools/app.js` | Query router (the `RULES` list), result cards, charts |
| `tools/sources.js`, `sources2.js` | Data sources (Wikipedia, OpenAlex, PubMed, NHTSA, Open-Meteo, NOAA, PubChem, World Bank…) |
| `tools/extras.js` | Local calculators (probability, curve fits, truth tables, timers, time zones, QR codes…) |
| `tools/files.js` | Files as context: PDFs, text, CSV, JSON are read on the visitor's device, never uploaded |
| `tools/engine.py`, `worker.js` | Symbolic math engine (SymPy running in the browser via Pyodide) |
| `worker/proxy.js` | Cloudflare Function that fetches from an allowlist of sources that block direct browser access. Deployed automatically. Free tier: 100k requests/day |

**Optional keys** (Cloudflare → Pages project → Settings → Variables and Secrets):
- `BRAVE_KEY`: free Brave Search API key (https://brave.com/search/api/). Adds live web results to the fallback search.

To add a new kind of query: add a `[regex, handler]` line to `RULES` in `tools/app.js`.

## Hosting note
This repo deploys as a Cloudflare **Worker with static assets** (Workers Builds), configured by
`wrangler.jsonc`. All files are served as-is; only `/tools/api/proxy` runs code (`worker/`).
`.assetsignore` keeps config and README files from being served. To enable the optional web
search, add a secret named `BRAVE_KEY` under the Worker's Settings → Variables and Secrets.
