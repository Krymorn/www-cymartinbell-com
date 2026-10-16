# Cy Martin-Bell — portfolio + web design services

Static site, no build step. Deploys on Netlify from GitHub.

## Files
| File | What it is |
|---|---|
| `index.html` | Personal portfolio (about, projects, activities, gallery, contact) |
| `services.html` | Studio page for nonprofits & small businesses (services, client work, process, pricing, FAQ, project inquiry form) |
| `privacy.html`, `terms.html` | Legal templates — review before launch |
| `thanks.html` | Shown after any form is submitted |
| `404.html` | Not-found page (Netlify uses it automatically) |
| `style.css`, `script.js` | Shared design and behavior |
| `images/` | All photos |

## Filling it in
Search the project for `[` and replace every bracketed placeholder.

## Photos
Put these in `images/` (JPG, ~2000px wide max, under ~400 KB each):
- `profile.jpg` (portrait, 4:5)
- `services.jpg` (a site you've built, 16:9)
- `client1.jpg` – `client3.jpg` (client work, 16:10)
- `project1.jpg` – `project3.jpg` (16:10)
- `gallery1.jpg` – `gallery5.jpg` (gallery1 is the wide one)
- `og.jpg`, `og-services.jpg` (1200×630, used when links are shared)

Missing photos show an "Add photo" box, so nothing breaks.

## Forms
The contact form and project inquiry form use **Netlify Forms** — no code needed.
Submissions appear in Netlify → your site → Forms. Turn on email
notifications there (Forms → Form notifications).

## Deploy
1. Push this folder to GitHub.
2. Netlify → Add new site → Import an existing project → GitHub → pick repo.
3. Leave build command empty. Publish directory: `.`
4. Netlify → Domain management → add your custom domain.
