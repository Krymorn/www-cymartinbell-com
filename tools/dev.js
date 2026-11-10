// Developer tools: packages in every ecosystem, GitHub, error explanations, running and checking
// code, formatting, diffs, code examples, regex, SQL, cron, git/terminal recipes, web lookups.
import * as K from './kit.js';
const { enc, fmt } = K;
const ago = (d) => { const s = (Date.now() - new Date(d)) / 1000; const u = [[31536e3, 'year'], [2592e3, 'month'], [604800, 'week'], [86400, 'day'], [3600, 'hour']].find(([n]) => s >= n); return u ? `${Math.floor(s / u[0])} ${u[1]}${Math.floor(s / u[0]) > 1 ? 's' : ''} ago` : 'just now'; };
const short = (s, n = 160) => (s && s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s || '');

// ============================================================ packages
async function crates(ctx, q, get) {
  const r = await get(`https://crates.io/api/v1/crates?q=${enc(q)}&per_page=10`);
  ctx.label('crates.io (Rust)'); ctx.input(q);
  ctx.add({ title: 'Crates', list: r.crates.map(c => ({ title: c.name, url: `https://crates.io/crates/${c.name}`, meta: `v${c.max_version} · ${fmt(c.downloads, 0)} downloads · updated ${ago(c.updated_at)}`, snippet: c.description })) });
  ctx.source('crates.io', 'https://crates.io');
}
async function rubygems(ctx, q, get) {
  const r = await get(`https://rubygems.org/api/v1/search.json?query=${enc(q)}`, { proxy: true });
  ctx.label('RubyGems'); ctx.input(q);
  ctx.add({ title: 'Gems', list: r.slice(0, 10).map(g => ({ title: g.name, url: g.project_uri, meta: `v${g.version} · ${fmt(g.downloads, 0)} downloads`, snippet: short(g.info) })) });
}
async function packagist(ctx, q, get) {
  const r = await get(`https://packagist.org/search.json?q=${enc(q)}&per_page=10`);
  ctx.label('Packagist (PHP)'); ctx.input(q);
  ctx.add({ title: 'Packages', list: r.results.map(p => ({ title: p.name, url: p.url, meta: `${fmt(p.downloads, 0)} downloads · ${fmt(p.favers, 0)} stars`, snippet: p.description })) });
}
async function nuget(ctx, q, get) {
  const r = await get(`https://azuresearch-usnc.nuget.org/query?q=${enc(q)}&take=10`);
  ctx.label('NuGet (.NET)'); ctx.input(q);
  ctx.add({ title: 'Packages', list: r.data.map(p => ({ title: p.id, url: `https://www.nuget.org/packages/${p.id}`, meta: `v${p.version} · ${fmt(p.totalDownloads, 0)} downloads`, snippet: short(p.description) })) });
}
async function maven(ctx, q, get) {
  const r = await get(`https://search.maven.org/solrsearch/select?q=${enc(q)}&rows=10&wt=json`, { proxy: true });
  ctx.label('Maven Central (Java)'); ctx.input(q);
  ctx.add({ title: 'Artifacts', list: r.response.docs.map(d => ({ title: `${d.g}:${d.a}`, url: `https://central.sonatype.com/artifact/${d.g}/${d.a}`, meta: `latest ${d.latestVersion} · ${d.versionCount} versions`, snippet: `<dependency><groupId>${d.g}</groupId><artifactId>${d.a}</artifactId><version>${d.latestVersion}</version></dependency>` })) });
}
async function hexpm(ctx, q, get) {
  const r = await get(`https://hex.pm/api/packages?search=${enc(q)}&sort=downloads`, { proxy: true });
  ctx.label('Hex (Elixir/Erlang)'); ctx.input(q);
  ctx.add({ title: 'Packages', list: r.slice(0, 10).map(p => ({ title: p.name, url: p.html_url, meta: `${fmt(p.downloads.all, 0)} downloads`, snippet: short(p.meta.description) })) });
}
async function pubdev(ctx, q, get) {
  const r = await get(`https://pub.dev/api/search?q=${enc(q)}`, { proxy: true });
  ctx.label('pub.dev (Dart/Flutter)'); ctx.input(q);
  ctx.add({ title: 'Packages', list: r.packages.slice(0, 12).map(p => ({ title: p.package, url: `https://pub.dev/packages/${p.package}` })) });
}
async function cran(ctx, q, get) {
  const r = await get(`https://r-universe.dev/api/search?q=${enc(q)}&limit=10`, { proxy: true });
  ctx.label('R packages'); ctx.input(q);
  ctx.add({ title: 'Packages', list: (r.results || []).map(p => ({ title: p.Package, url: `https://${p._user}.r-universe.dev/${p.Package}`, meta: p._user, snippet: short(p.Title || p.Description) })) });
}
async function brew(ctx, q, get) {
  const name = q.trim().toLowerCase();
  const r = await get(`https://formulae.brew.sh/api/formula/${enc(name)}.json`).catch(() => get(`https://formulae.brew.sh/api/cask/${enc(name)}.json`));
  ctx.label('Homebrew'); ctx.input(name);
  ctx.add({ title: r.name ? (Array.isArray(r.name) ? r.name[0] : r.name) : name, text: r.desc, table: [['Install', `brew install ${r.token ? '--cask ' + r.token : r.name}`], ['Version', (r.versions && r.versions.stable) || r.version || ''], ['Homepage', r.homepage || '']] });
}
async function dockerhub(ctx, q, get) {
  const r = await get(`https://hub.docker.com/v2/search/repositories/?query=${enc(q)}&page_size=10`, { proxy: true });
  ctx.label('Docker Hub'); ctx.input(q);
  ctx.add({ title: 'Images', list: r.results.map(i => ({ title: i.repo_name, url: `https://hub.docker.com/${i.is_official ? '_/' : 'r/'}${i.repo_name}`, meta: `${i.is_official ? 'Official · ' : ''}${fmt(i.star_count, 0)} stars · ${fmt(i.pull_count, 0)} pulls`, snippet: `docker pull ${i.repo_name}` })) });
}
async function conda(ctx, q, get) {
  const r = await get(`https://api.anaconda.org/search?name=${enc(q)}`, { proxy: true });
  ctx.label('Anaconda'); ctx.input(q);
  ctx.add({ title: 'Packages', list: r.slice(0, 10).map(p => ({ title: `${p.owner}/${p.name}`, url: p.html_url, meta: `latest ${p.latest_version}`, snippet: `conda install -c ${p.owner} ${p.name}` })) });
}
async function npmInfo(ctx, name, get) {
  const [meta, dl] = await Promise.all([get(`https://registry.npmjs.org/${name}`), get(`https://api.npmjs.org/downloads/range/last-month/${name}`).catch(() => null)]);
  const latest = meta['dist-tags'].latest, v = meta.versions[latest];
  ctx.label('npm'); ctx.input(name);
  ctx.add({ title: name, text: meta.description, table: [['Latest', `${latest} (${ago(meta.time[latest])})`], ['License', v.license || '—'], ['Dependencies', String(Object.keys(v.dependencies || {}).length)], ['Install', `npm install ${name}`], ['Repository', ((meta.repository && meta.repository.url) || '').replace(/^git\+|\.git$/g, '')], ['Downloads last month', dl ? fmt(K.sum(dl.downloads.map(d => d.downloads)), 0) : '—']] });
  if (dl) ctx.add({ title: 'Daily downloads', plot: { kind: 'line', xdate: true, traces: [{ name: 'Downloads', x: dl.downloads.map(d => d.day), y: dl.downloads.map(d => d.downloads) }] } });
  const size = await get(`https://bundlephobia.com/api/size?package=${enc(name)}`, { proxy: true }).catch(() => null);
  if (size) ctx.add({ title: 'Bundle size', table: [['Minified', `${fmt(size.size / 1024, 1)} kB`], ['Min + gzip', `${fmt(size.gzip / 1024, 1)} kB`]], source: { name: 'Bundlephobia', url: `https://bundlephobia.com/package/${name}` } });
  ctx.add({ title: 'Links', buttons: [{ label: 'npm page', url: `https://www.npmjs.com/package/${name}` }, { label: 'Security advisories', query: `vulns npm ${name} ${latest}` }] });
}
async function comparePackages(ctx, a, b, get) {
  const one = async (n) => { const [m, d] = await Promise.all([get(`https://registry.npmjs.org/${n}`), get(`https://api.npmjs.org/downloads/point/last-month/${n}`).catch(() => ({ downloads: null }))]); const repo = ((m.repository && m.repository.url) || '').match(/github\.com[/:]([^/]+\/[^/.#]+)/); const gh = repo ? await get(`https://api.github.com/repos/${repo[1]}`).catch(() => null) : null; return { n, latest: m['dist-tags'].latest, upd: m.time[m['dist-tags'].latest], dl: d.downloads, stars: gh && gh.stargazers_count, issues: gh && gh.open_issues_count, license: m.license || (m.versions[m['dist-tags'].latest] || {}).license }; };
  const [x, y] = await Promise.all([one(a), one(b)]);
  ctx.label('npm compare'); ctx.input(`${a} vs ${b}`);
  ctx.add({ title: 'Side by side', table: { head: ['', a, b], rows: [['Latest version', x.latest, y.latest], ['Last release', ago(x.upd), ago(y.upd)], ['Downloads (month)', fmt(x.dl, 0), fmt(y.dl, 0)], ['GitHub stars', fmt(x.stars, 0), fmt(y.stars, 0)], ['Open issues', fmt(x.issues, 0), fmt(y.issues, 0)], ['License', x.license, y.license]] }, note: 'Popularity isn’t quality: also check docs, maintenance and fit for your project.' });
}
async function pypiStats(ctx, name, get) {
  const r = await get(`https://pypistats.org/api/packages/${enc(name.toLowerCase())}/recent`, { proxy: true });
  ctx.label('PyPI'); ctx.input(name);
  ctx.add({ title: `${name} downloads`, table: [['Last day', fmt(r.data.last_day, 0)], ['Last week', fmt(r.data.last_week, 0)], ['Last month', fmt(r.data.last_month, 0)]], source: { name: 'pypistats', url: `https://pypistats.org/packages/${name}` } });
}
async function packageFor(ctx, need, lang, get) {
  const L = (lang || '').toLowerCase().replace(/^js$/, 'javascript').replace(/^ts$/, 'typescript').replace(/^py$/, 'python').replace(/^c#|csharp$/, 'c#');
  const q = `${need} in:name,description,topics${L ? ` language:${L.replace('c#', 'csharp').replace('c++', 'cpp')}` : ''} stars:>50`;
  const r = await get(`https://api.github.com/search/repositories?q=${enc(q)}&sort=stars&per_page=10`);
  ctx.label('Libraries'); ctx.input(`${need}${L ? ` for ${L}` : ''}`);
  ctx.add({ title: 'Most-starred libraries on GitHub', list: r.items.map(i => ({ title: i.full_name, url: i.html_url, meta: `★ ${fmt(i.stargazers_count, 0)} · ${i.language || ''} · updated ${ago(i.pushed_at)}${i.license ? ' · ' + i.license.spdx_id : ''}`, snippet: i.description })) });
  const reg = { python: [`pypi`, 'https://pypi.org/search/?q='], javascript: ['npm', 'https://www.npmjs.com/search?q='], typescript: ['npm', 'https://www.npmjs.com/search?q='], rust: ['crates', 'https://crates.io/search?q='], ruby: ['gems', 'https://rubygems.org/search?query='], java: ['maven', 'https://central.sonatype.com/search?q='], go: ['pkg.go.dev', 'https://pkg.go.dev/search?q='], 'c#': ['nuget', 'https://www.nuget.org/packages?q='], php: ['packagist', 'https://packagist.org/?query='], r: ['CRAN', 'https://r-universe.dev/search?q='] }[L];
  ctx.add({ title: 'Also search', buttons: [...(reg ? [{ label: `${reg[0]} registry`, url: reg[1] + enc(need) }] : []), { label: `awesome lists`, query: `awesome ${need}` }, { label: 'Stack Overflow', query: `stackoverflow ${need} ${L}` }] });
}
async function ghRepo(ctx, full, get) {
  const [r, langs, rel, readme] = await Promise.all([get(`https://api.github.com/repos/${full}`), get(`https://api.github.com/repos/${full}/languages`).catch(() => ({})), get(`https://api.github.com/repos/${full}/releases/latest`).catch(() => null), get(`https://api.github.com/repos/${full}/readme`, { init: { headers: { Accept: 'application/vnd.github.raw' } }, type: 'text' }).catch(() => '')]);
  ctx.label('GitHub'); ctx.input(r.full_name);
  ctx.add({ title: r.full_name, text: r.description, table: [['Stars', fmt(r.stargazers_count, 0)], ['Forks', fmt(r.forks_count, 0)], ['Open issues + PRs', fmt(r.open_issues_count, 0)], ['License', r.license ? r.license.name : 'None listed'], ['Created', new Date(r.created_at).toDateString()], ['Last push', ago(r.pushed_at)], ['Latest release', rel ? `${rel.tag_name} (${ago(rel.published_at)})` : '—'], ['Default branch', r.default_branch], ['Clone', `git clone ${r.clone_url}`]] });
  const tot = K.sum(Object.values(langs));
  if (tot) ctx.add({ title: 'Languages', table: Object.entries(langs).slice(0, 8).map(([k, v]) => [k, `${(v / tot * 100).toFixed(1)}%`]) });
  if (readme) ctx.add({ title: 'README (start)', pre: readme.slice(0, 2500) });
  ctx.add({ title: 'More', buttons: [{ label: 'Open on GitHub', url: r.html_url }, { label: 'Issues', url: `${r.html_url}/issues` }, { label: 'Contributors', url: `${r.html_url}/graphs/contributors` }] });
}
async function ghUser(ctx, user, get) {
  const [u, repos] = await Promise.all([get(`https://api.github.com/users/${enc(user)}`), get(`https://api.github.com/users/${enc(user)}/repos?sort=updated&per_page=100`)]);
  ctx.label('GitHub'); ctx.input(u.login);
  ctx.add({ title: u.name || u.login, text: u.bio, image: u.avatar_url, imageSide: true, table: [['Public repos', u.public_repos], ['Followers', u.followers], ['Joined', new Date(u.created_at).toDateString()], ['Location', u.location || '—'], ['Company', u.company || '—'], ['Blog', u.blog || '—']] });
  ctx.add({ title: 'Top repositories', list: repos.sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 8).map(r => ({ title: r.name, url: r.html_url, meta: `★ ${r.stargazers_count} · ${r.language || ''} · ${ago(r.pushed_at)}`, snippet: r.description })) });
}
async function ghTrending(ctx, lang, period, get) {
  const days = /month/.test(period) ? 30 : /year/.test(period) ? 365 : /day|today/.test(period) ? 1 : 7;
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const r = await get(`https://api.github.com/search/repositories?q=${enc(`created:>${since}${lang ? ` language:${lang}` : ''}`)}&sort=stars&order=desc&per_page=15`);
  ctx.label('GitHub'); ctx.input(`New repos gaining stars since ${since}${lang ? ` (${lang})` : ''}`);
  ctx.add({ title: 'Trending (by stars, created recently)', list: r.items.map(i => ({ title: i.full_name, url: i.html_url, meta: `★ ${fmt(i.stargazers_count, 0)} · ${i.language || ''}`, snippet: i.description })) });
}
async function ghIssues(ctx, q, get) {
  const r = await get(`https://api.github.com/search/issues?q=${enc(q + ' is:issue')}&sort=reactions&per_page=10`);
  ctx.label('GitHub issues'); ctx.input(q);
  ctx.add({ title: 'Matching issues', list: r.items.map(i => ({ title: i.title, url: i.html_url, meta: `${i.state} · ${i.comments} comments · ${i.repository_url.split('/').slice(-2).join('/')} · ${ago(i.created_at)}` })) });
}
async function awesome(ctx, topic, get) {
  const r = await get(`https://api.github.com/search/repositories?q=${enc(`awesome ${topic} in:name,description`)}&sort=stars&per_page=10`);
  ctx.label('Awesome lists'); ctx.input(topic);
  ctx.add({ title: 'Curated “awesome” lists', list: r.items.map(i => ({ title: i.full_name, url: i.html_url, meta: `★ ${fmt(i.stargazers_count, 0)}`, snippet: i.description })), note: '“Awesome lists” are community-curated link collections: a great starting point for tools, papers and tutorials.' });
}
async function license(ctx, key, get) {
  const k = key.toLowerCase().replace(/\s+/g, '-').replace(/^gpl$/, 'gpl-3.0').replace(/^apache$/, 'apache-2.0').replace(/^bsd$/, 'bsd-3-clause').replace(/^lgpl$/, 'lgpl-3.0').replace(/^agpl$/, 'agpl-3.0').replace(/^mpl$/, 'mpl-2.0');
  const r = await get(`https://api.github.com/licenses/${enc(k)}`);
  ctx.label('License'); ctx.input(r.name);
  ctx.add({ title: r.name, text: r.description, table: [['You may', r.permissions.join(', ')], ['You must', r.conditions.join(', ') || 'nothing'], ['Limits', r.limitations.join(', ')]] });
  const body = r.body.replace(/\[year\]/g, String(new Date().getFullYear())).replace(/\[fullname\]/g, 'Your Name');
  ctx.add({ title: 'LICENSE file', pre: body });
  ctx.add(K.filesPod([{ label: 'LICENSE', name: 'LICENSE', mime: 'text/plain', data: body }]));
  ctx.add({ title: 'Other licenses', chips: ['mit', 'apache-2.0', 'gpl-3.0', 'bsd-3-clause', 'mpl-2.0', 'unlicense'].filter(x => x !== k).map(x => `license ${x}`) });
}
async function gitignore(ctx, lang, get) {
  const list = await get('https://api.github.com/gitignore/templates');
  const name = list.find(n => n.toLowerCase() === lang.toLowerCase().replace(/\s+/g, '')) || list.find(n => n.toLowerCase().startsWith(lang.toLowerCase().slice(0, 4)));
  if (!name) throw new Error(`No template for ${lang}. Some available: ${list.slice(0, 20).join(', ')}…`);
  const r = await get(`https://api.github.com/gitignore/templates/${name}`);
  ctx.label('.gitignore'); ctx.input(name);
  ctx.add({ title: `.gitignore for ${name}`, pre: r.source });
  ctx.add(K.filesPod([{ label: '.gitignore', name: 'gitignore.txt', mime: 'text/plain', data: r.source }], 'Download', 'Saved as gitignore.txt because browsers hide dot-files; rename it to .gitignore.'));
}

// ============================================================ error explanations (no AI: a curated table)
const ERRORS = [
  // Python
  [/NameError: name '(\w+)' is not defined/, 'Python', (m) => `The name “${m[1]}” is used before it exists.`, (m) => ['Check spelling and capitalization.', 'Define or import it before this line (e.g. `import math` for math.sqrt).', 'If it’s inside a function, make sure it isn’t only defined in another function.']],
  [/TypeError: '(\w+)' object is not (subscriptable|callable|iterable)/, 'Python', (m) => `You used a ${m[1]} as if it were ${{ subscriptable: 'a list or dict ([ ] indexing)', callable: 'a function (with ( ))', iterable: 'something you can loop over' }[m[2]]}.`, (m) => ['Print the variable and its type() just before the error.', 'A common cause: a variable name shadows a function (e.g. list = [...] then list(...)).', 'If it’s None, a function you called probably forgot to return a value.']],
  [/TypeError: unsupported operand type\(s\) for (.+?): '(\w+)' and '(\w+)'/, 'Python', (m) => `You can’t use ${m[1]} between a ${m[2]} and a ${m[3]}.`, (m) => ['Convert first: int(x), float(x), str(x).', 'input() always returns a string; wrap it in int() for numbers.']],
  [/TypeError: can only concatenate str \(not "(\w+)"\) to str/, 'Python', (m) => `You joined text with a ${m[1]} using +.`, (m) => ['Use an f-string: f"Total: {x}"', 'Or convert: "Total: " + str(x)']],
  [/TypeError: (\w+)\(\) (?:takes|missing) .*argument/, 'Python', (m) => `${m[1]}() was called with the wrong number of arguments.`, (m) => ['Compare the call with the def line.', 'Methods need self as their first parameter.', 'Calling a method on the class instead of an instance can also cause this.']],
  [/IndexError: (list|string|tuple) index out of range/, 'Python', (m) => `You asked for a position past the end of a ${m[1]}.`, (m) => ['Indexes start at 0, so the last item is len(x) - 1.', 'Loop with for item in x, or range(len(x)).', 'Check whether the list is empty.']],
  [/KeyError: (.+)/, 'Python', (m) => `The dictionary has no key ${m[1]}.`, (m) => ['Use d.get(key, default) to avoid the crash.', 'Print d.keys() to see what’s there; watch for spaces and capitalization.']],
  [/AttributeError: 'NoneType' object has no attribute '(\w+)'/, 'Python', (m) => `You called .${m[1]} on None: a variable you expected to hold something is empty.`, (m) => ['A function returned nothing (no return statement).', 'In-place methods like list.sort() return None; don’t assign their result.', 'A regex or find() that didn’t match returns None.']],
  [/AttributeError: '(\w+)' object has no attribute '(\w+)'/, 'Python', (m) => `${m[1]} objects don’t have “${m[2]}”.`, (m) => ['Check spelling, or use dir(obj) to list what exists.', 'You may have the wrong type: print(type(obj)).']],
  [/IndentationError: (.+)/, 'Python', (m) => `Python found inconsistent indentation: ${m[1]}.`, (m) => ['Use 4 spaces per level and don’t mix tabs and spaces.', 'Every line ending in : needs an indented block after it.']],
  [/SyntaxError: (?:invalid syntax|expected ':')/, 'Python', () => 'Python couldn’t parse the line (often the one above the reported line).', ['Look for a missing ) ] } or quote, or a missing : after if/for/def/class.', 'Using = instead of == in a condition.']],
  [/SyntaxError: unterminated string literal|EOL while scanning string literal/, 'Python', () => 'A string is missing its closing quote.', ['Match every " or \' on the line.', 'For text across lines use triple quotes """ … """.']],
  [/ModuleNotFoundError: No module named '([\w.]+)'/, 'Python', (m) => `Python can’t find the package “${m[1]}”.`, (m) => [`Install it: pip install ${m[1].split('.')[0]} (note: some names differ, e.g. cv2 → opencv-python, sklearn → scikit-learn, PIL → pillow, yaml → pyyaml, bs4 → beautifulsoup4).`, 'Make sure pip and python are the same environment: python -m pip install …', 'Activate your virtual environment first.']],
  [/ZeroDivisionError/, 'Python', () => 'You divided by zero.', ['Check the denominator before dividing: if d != 0.', 'An empty list gives len() = 0 when computing an average.']],
  [/ValueError: invalid literal for int\(\) with base 10: '(.*)'/, 'Python', (m) => `int() can’t turn “${m[1]}” into a whole number.`, (m) => ['Strip spaces: int(s.strip()).', 'Use float() for decimals, then int() if needed.', 'Check for empty strings or stray characters.']],
  [/ValueError: too many values to unpack|not enough values to unpack/, 'Python', () => 'The number of variables on the left doesn’t match the items on the right.', ['a, b = pair needs exactly two items.', 'Looping over a dict gives keys; use .items() for key, value.']],
  [/RecursionError: maximum recursion depth exceeded/, 'Python', () => 'A function called itself too many times (usually forever).', ['Make sure there’s a base case that stops the recursion.', 'Check the recursive call moves toward the base case.']],
  [/FileNotFoundError: \[Errno 2\] No such file or directory: '(.+)'/, 'Python', (m) => `Python can’t find “${m[1]}”.`, (m) => ['Paths are relative to where you run the script, not where the .py file is.', 'Print os.getcwd() and os.listdir() to see where you are.', 'On Windows use raw strings r"C:\\path" or forward slashes.']],
  [/UnicodeDecodeError: '(\w+)' codec can't decode/, 'Python', () => 'The file isn’t in the text encoding Python assumed.', ['open(path, encoding="utf-8") or encoding="latin-1".', 'For binary files use "rb".']],
  [/ImportError: cannot import name '(\w+)'/, 'Python', (m) => `“${m[1]}” isn’t available from that module.`, (m) => ['Check the spelling and the library version (names change between versions).', 'Circular imports: two files importing each other.']],
  [/UnboundLocalError: (?:local variable|cannot access local variable) '(\w+)'/, 'Python', (m) => `“${m[1]}” is assigned inside the function, so Python treats it as local, but it’s used before that assignment.`, (m) => ['Pass it in as a parameter, or declare global/nonlocal if you really mean the outer one.']],
  [/externally-managed-environment/, 'pip', () => 'Your system Python is protected from pip installs.', ['Create a virtual environment: python3 -m venv .venv && source .venv/bin/activate', 'Or use pipx for command-line tools.']],
  [/CUDA out of memory|OutOfMemoryError/, 'PyTorch', () => 'The GPU ran out of memory.', ['Lower the batch size.', 'Use torch.no_grad() during evaluation.', 'Delete unused tensors and call torch.cuda.empty_cache().', 'Try mixed precision (torch.autocast).']],
  [/SettingWithCopyWarning/, 'pandas', () => 'You may be editing a copy of a DataFrame slice, not the original.', ['Use df.loc[rows, col] = value.', 'Or make an explicit copy: sub = df[...].copy().']],
  [/KeyError: .*\bnot in index\b|None of \[.*\] are in the \[columns\]/, 'pandas', () => 'That column name doesn’t exist in the DataFrame.', ['print(df.columns) and watch for spaces: df.columns = df.columns.str.strip().']],
  // JavaScript
  [/TypeError: Cannot read propert(?:y|ies) of (undefined|null)(?: \(reading '(\w+)'\))?/, 'JavaScript', (m) => `You read ${m[2] ? `.${m[2]}` : 'a property'} from something that is ${m[1]}.`, ['Use optional chaining: obj?.prop', 'Check the data actually loaded (async code may not have finished).', 'console.log the object right before this line.']],
  [/TypeError: (\S+) is not a function/, 'JavaScript', (m) => `${m[1]} isn’t a function at that moment.`, (m) => ['Check spelling and that it’s imported/exported correctly.', 'For arrays, map/filter only exist on arrays, not objects or NodeLists (use Array.from).', 'A variable with the same name may be shadowing the function.']],
  [/ReferenceError: (\w+) is not defined/, 'JavaScript', (m) => `“${m[1]}” doesn’t exist in this scope.`, (m) => ['Declare it with let/const, or import it.', 'In Node, browser globals like window/document don’t exist.', 'Variables declared with let inside { } aren’t visible outside.']],
  [/SyntaxError: Unexpected token '?(.)'?/, 'JavaScript', (m) => `The parser hit an unexpected “${m[1]}”.`, (m) => ['Look for missing commas, brackets or quotes just before.', 'If it says Unexpected token < in JSON, the server returned HTML (an error page) instead of JSON.']],
  [/Cannot use import statement outside a module/, 'JavaScript', () => 'import/export syntax needs ES modules.', ['Add "type": "module" to package.json, or use .mjs.', 'In HTML use <script type="module">.', 'Or switch to require().']],
  [/has been blocked by CORS policy|No 'Access-Control-Allow-Origin'/, 'Browser', () => 'The server didn’t allow your page’s origin to read its response.', ['This is a server setting: you can’t fix it in front-end code.', 'Call the API from your own backend/proxy, or use the API’s documented CORS option.', 'In development, use your bundler’s dev-server proxy.']],
  [/Unhandled ?Promise ?Rejection|Uncaught \(in promise\)/, 'JavaScript', () => 'An async operation failed and nothing caught the error.', ['Wrap await calls in try/catch, or add .catch().']],
  [/Maximum call stack size exceeded/, 'JavaScript', () => 'Infinite recursion (a function calling itself without stopping), or a setter calling itself.', ['Add a base case; check React components aren’t updating state during render.']],
  [/ERESOLVE unable to resolve dependency tree/, 'npm', () => 'Two packages need incompatible versions of a peer dependency.', ['Upgrade the conflicting packages to compatible versions.', 'As a stopgap: npm install --legacy-peer-deps.']],
  [/EADDRINUSE.*:(\d+)/, 'Node', (m) => `Port ${m[1]} is already in use.`, (m) => [`Find and stop it: lsof -i :${m[1]} then kill <PID> (Windows: netstat -ano | findstr :${m[1]}).`, 'Or run on another port.']],
  [/Module not found: (?:Error: )?Can't resolve '(.+?)'/, 'Webpack/Vite', (m) => `The bundler can’t find “${m[1]}”.`, (m) => [`npm install ${m[1].replace(/^(@[^/]+\/[^/]+|[^/]+).*/, '$1')}`, 'Check relative paths and file extensions.']],
  // Java
  [/java\.lang\.NullPointerException/, 'Java', () => 'You used an object reference that is null.', ['Find the variable on the reported line; check it was initialized (new …).', 'Use Objects.requireNonNull or Optional to catch it earlier.']],
  [/ArrayIndexOutOfBoundsException: (?:Index )?(-?\d+)/, 'Java', (m) => `Index ${m[1]} is outside the array.`, (m) => ['Valid indexes are 0 to length - 1; check loop conditions use < not <=.']],
  [/java\.lang\.ClassNotFoundException|NoClassDefFoundError/, 'Java', () => 'A class isn’t on the classpath at runtime.', ['Check dependencies in Maven/Gradle and the -cp flag.', 'Run from the right directory with the package name: java com.example.Main.']],
  [/ConcurrentModificationException/, 'Java', () => 'A collection was changed while being looped over.', ['Use an Iterator and iterator.remove(), or removeIf().']],
  [/NumberFormatException: For input string: "(.*)"/, 'Java', (m) => `“${m[1]}” isn’t a valid number.`, (m) => ['trim() the string and validate before Integer.parseInt.']],
  [/error: cannot find symbol/, 'Java', () => 'The compiler doesn’t know a name you used.', ['Check spelling, imports and that the variable is in scope.']],
  [/error: incompatible types: (.+)/, 'Java', (m) => `Type mismatch: ${m[1]}.`, (m) => ['Cast explicitly or change the variable type.']],
  // C / C++
  [/Segmentation fault|SIGSEGV/, 'C/C++', () => 'The program touched memory it doesn’t own.', ['Common causes: null or uninitialized pointers, array index out of bounds, using memory after free, stack overflow from deep recursion.', 'Compile with -g -fsanitize=address and run again for the exact line.', 'Use gdb: run, then bt for the backtrace.']],
  [/undefined reference to [`'](\w+)/, 'C/C++ linker', (m) => `The linker can’t find the definition of ${m[1]}.`, (m) => ['Compile and link all .c/.cpp files together.', 'Link libraries with -l (e.g. -lm for math).', 'Make sure the function is defined, not only declared.']],
  [/error: expected ';'/, 'C/C++', () => 'A statement is missing its semicolon (often on the previous line).', ['Also check struct/class definitions end with };']],
  [/was not declared in this scope|use of undeclared identifier '(\w+)'/, 'C/C++', (m) => `${m[1] || 'A name'} isn’t declared where it’s used.`, (m) => ['#include the right header (e.g. <iostream>, <vector>, <string>).', 'Add std:: or using namespace std;']],
  [/free\(\): invalid pointer|double free/, 'C/C++', () => 'Memory was freed twice or freed when it wasn’t from malloc.', ['Set pointers to NULL after free; prefer smart pointers in C++.']],
  // Git
  [/CONFLICT \(content\): Merge conflict in (.+)/, 'Git', (m) => `Both branches changed the same lines in ${m[1]}.`, (m) => ['Open the file, keep the right code between <<<<<<< ======= >>>>>>>, delete the markers.', 'git add the file, then git commit (or git rebase --continue).']],
  [/\[rejected\].*\(fetch first\)|Updates were rejected because the remote contains work/, 'Git', () => 'The remote has commits you don’t have.', ['git pull --rebase, fix any conflicts, then git push.']],
  [/fatal: not a git repository/, 'Git', () => 'You’re not inside a Git repository.', ['cd into the project folder, or run git init.']],
  [/Permission denied \(publickey\)/, 'Git/SSH', () => 'GitHub didn’t accept your SSH key.', ['ssh-keygen -t ed25519, then add ~/.ssh/id_ed25519.pub to GitHub → Settings → SSH keys.', 'Test with ssh -T git@github.com', 'Or use the HTTPS URL with a personal access token.']],
  [/detached HEAD/, 'Git', () => 'You checked out a commit, not a branch.', ['To keep work: git switch -c new-branch', 'To go back: git switch main']],
  // SQL
  [/no such table: (\w+)|relation "(\w+)" does not exist|Table '.*?(\w+)' doesn't exist/, 'SQL', (m) => `Table ${m[1] || m[2] || m[3]} doesn’t exist.`, (m) => ['Check spelling/case and that you’re connected to the right database/schema.']],
  [/column "?(\w+)"? (?:does not exist|not found)|no such column: (\w+)|Unknown column '(\w+)'/, 'SQL', (m) => `Column ${m[1] || m[2] || m[3]} doesn’t exist.`, (m) => ['Check spelling; in PostgreSQL text values need single quotes (double quotes mean a column name).']],
  [/must appear in the GROUP BY clause|not in GROUP BY|isn't in GROUP BY/, 'SQL', () => 'Every selected column must be grouped or aggregated.', ['Add it to GROUP BY, or wrap it in an aggregate like MAX(col).']],
  [/syntax error at or near "(\w+)"|near "(\w+)": syntax error|You have an error in your SQL syntax/, 'SQL', (m) => `SQL syntax problem near “${m[1] || m[2] || 'that point'}”.`, (m) => ['Check commas between columns, keyword order (SELECT … FROM … WHERE … GROUP BY … ORDER BY), and quotes.']],
  // LaTeX
  [/Undefined control sequence/, 'LaTeX', () => 'A command isn’t defined.', ['Check the spelling after the backslash.', 'Load the package that provides it (e.g. \\usepackage{amsmath} for \\text, amssymb for \\mathbb).']],
  [/Missing \$ inserted/, 'LaTeX', () => 'Math was used outside math mode.', ['Wrap formulas in $ … $; underscores and ^ only work in math (use \\_ for a literal underscore).']],
  [/File `(.+?)' not found/, 'LaTeX', (m) => `LaTeX can’t find ${m[1]}.`, (m) => ['Install the package (TeX Live: tlmgr install …) or use Overleaf, which has all packages.', 'For images, check the path and extension.']],
  [/Overfull \\hbox/, 'LaTeX', () => 'A line is wider than the text block (a warning, not an error).', ['Usually a long URL or word: use \\url{} or allow hyphenation; ignore if it looks fine.']],
  [/Runaway argument|File ended while scanning/, 'LaTeX', () => 'A { is never closed.', ['Count braces near the reported line.']],
  // misc
  [/command not found: (\w+)|'(\w+)' is not recognized as an internal or external command/, 'Shell', (m) => `The shell can’t find the program ${m[1] || m[2]}.`, (m) => ['Install it, or add its folder to PATH.', 'For Python tools try python -m <tool>.']],
  [/Permission denied/, 'Shell', () => 'You don’t have permission for that file or folder.', ['Check ownership with ls -l; make scripts runnable with chmod +x file.', 'Avoid sudo for pip/npm; use a virtual env or user install.']],
  [/ECONNREFUSED|Connection refused/, 'Network', () => 'Nothing is listening at that address/port.', ['Start the server, and check host and port (localhost vs 127.0.0.1, Docker networking).']],
  [/certificate verify failed|SSL: CERTIFICATE_VERIFY_FAILED|unable to get local issuer certificate/, 'SSL', () => 'Your system can’t verify the server’s HTTPS certificate.', ['Update certificates (macOS Python: run “Install Certificates.command”; pip install --upgrade certifi).', 'Behind a school/company proxy, you may need its root certificate.']],
  [/Exception in thread "main"|Traceback \(most recent call last\)/, 'Generic', () => 'A runtime error. The most useful line is usually the last one, plus the lowest line from your own file.', ['Read the error type on the last line, then look at your own code’s line number in the trace.']],
];
function explainError(ctx, text) {
  const hits = [];
  for (const [re, lang, why, fixes] of ERRORS) { const m = re.exec(text); if (m && !hits.some(h => h.lang === lang && h.why === why(m))) hits.push({ lang, why: why(m), fixes: typeof fixes === 'function' ? fixes(m) : fixes, at: m.index }); }
  const specific = hits.filter(h => h.lang !== 'Generic');
  const use = (specific.length ? specific : hits).sort((a, b) => b.at - a.at).slice(0, 3);
  const line = (/line (\d+)/.exec(text) || /:(\d+):\d+/.exec(text) || /\.java:(\d+)/.exec(text) || [])[1];
  const lastLine = text.trim().split('\n').filter(Boolean).pop();
  ctx.label('Error'); ctx.input(lastLine.slice(0, 140));
  if (!use.length) {
    ctx.add({ title: 'Not in my list', text: 'I don’t recognize this exact error, but searching its text usually finds the fix.', warn: true });
  }
  for (const h of use) ctx.add({ title: `${h.lang}: what it means`, big: true, text: h.why, numbered: h.fixes });
  if (line) ctx.add({ title: 'Where', text: `Line ${line} (in a traceback, look at the lowest line that’s in your own file).` });
  const key = lastLine.replace(/(['"]).*?\1/g, '').replace(/0x[0-9a-f]+|\d{3,}/gi, '').slice(0, 120);
  ctx.add({ title: 'Search for this error', buttons: [{ label: 'Stack Overflow', query: `stackoverflow ${key}` }, { label: 'GitHub issues', query: `github issues ${key}` }, { label: 'Web', url: `https://duckduckgo.com/?q=${enc(key)}` }] });
}

// ============================================================ running & checking code
function runJS(ctx, code) {
  ctx.label('JavaScript'); ctx.input('Runs in a sandboxed worker in your browser (no page access, 5 s limit)');
  const slot = ctx.add({ title: 'Running…', loading: true });
  const src = `const out=[];const fmt=(v)=>{try{return typeof v==='string'?v:JSON.stringify(v,(k,x)=>typeof x==='bigint'?x+'n':x,2)??String(v)}catch(e){return String(v)}};const c={log:(...a)=>out.push(a.map(fmt).join(' ')),error:(...a)=>out.push('Error: '+a.map(fmt).join(' ')),warn:(...a)=>out.push('Warning: '+a.map(fmt).join(' ')),table:(t)=>out.push(fmt(t)),info:(...a)=>out.push(a.map(fmt).join(' '))};self.console=c;self.onmessage=async(e)=>{try{const r=await (0,eval)(e.data);postMessage({out,result:r===undefined?undefined:fmt(r)})}catch(err){postMessage({out,error:String(err&&err.stack||err)})}}`;
  const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  const timer = setTimeout(() => { w.terminate(); slot.remove(); ctx.add({ title: 'Stopped', error: true, text: 'Took longer than 5 seconds (infinite loop?).' }); }, 5000);
  return new Promise((res) => {
    w.onmessage = (e) => {
      clearTimeout(timer); w.terminate(); slot.remove();
      const { out, result, error } = e.data;
      if (out.length) ctx.add({ title: 'Console', pre: out.join('\n') });
      if (result !== undefined) ctx.add({ title: 'Result', pre: result });
      if (error) { ctx.add({ title: 'Error', error: true, pre: error }); explainErrorInline(ctx, error); }
      if (!out.length && result === undefined && !error) ctx.add({ title: 'Done', text: 'Ran with no output. Use console.log(...) to print.' });
      res();
    };
    w.postMessage(code);
  });
}
function explainErrorInline(ctx, err) {
  for (const [re, lang, why, fixes] of ERRORS) { const m = re.exec(err); if (m && lang !== 'Generic') { ctx.add({ title: 'What it means', text: why(m), numbered: typeof fixes === 'function' ? fixes(m) : fixes }); return; } }
}
async function checkSyntax(ctx, kind, body) {
  ctx.label('Validate'); ctx.input(kind.toUpperCase());
  const ok = (t) => ctx.add({ title: 'Valid ✓', big: true, text: t });
  const bad = (t, line) => { ctx.add({ title: 'Problem', error: true, text: t }); if (line) { const ls = body.split('\n'); ctx.add({ title: `Around line ${line}`, pre: ls.slice(Math.max(0, line - 3), line + 2).map((l, i) => `${Math.max(1, line - 2) + i}${Math.max(1, line - 2) + i === line ? ' →' : '  '} ${l}`).join('\n') }); } };
  if (/json/i.test(kind)) {
    try { const o = JSON.parse(body); ok(`Valid JSON (${Array.isArray(o) ? `array of ${o.length}` : typeof o === 'object' && o ? `object with ${Object.keys(o).length} keys` : typeof o}).`); ctx.add({ title: 'Formatted', pre: JSON.stringify(o, null, 2) }); }
    catch (e) { const pos = +((/position (\d+)/.exec(e.message) || [])[1] || -1); const line = pos >= 0 ? body.slice(0, pos).split('\n').length : (/line (\d+)/.exec(e.message) || [])[1]; bad(`${e.message}${/'/.test(body) ? '. JSON needs double quotes, not single quotes.' : ''}${/,\s*[}\]]/.test(body) ? ' Trailing commas aren’t allowed in JSON.' : ''}`, +line || null); }
  } else if (/ya?ml/i.test(kind)) {
    const Y = await K.loadYAML();
    try { const o = Y.load(body); ok('Valid YAML.'); ctx.add({ title: 'As JSON', pre: JSON.stringify(o, null, 2) }); } catch (e) { bad(e.reason || e.message, e.mark ? e.mark.line + 1 : null); }
  } else if (/xml|html|svg/i.test(kind)) {
    const d = new DOMParser().parseFromString(body, /html/i.test(kind) ? 'text/html' : 'application/xml');
    const err = d.querySelector('parsererror');
    if (err) bad(err.textContent.replace(/\s+/g, ' ').slice(0, 300), +((/line (\d+)/i.exec(err.textContent) || [])[1]) || null);
    else ok(/html/i.test(kind) ? 'Parsed (browsers are forgiving with HTML; use validator.w3.org for strict checks).' : 'Well-formed XML.');
  } else if (/csv/i.test(kind)) {
    const { head, rows } = K.parseTable(body);
    const n = (head || rows[0]).length;
    const badRows = rows.map((r, i) => [i + 2, r.length]).filter(([, l]) => l !== n);
    if (badRows.length) bad(`Expected ${n} columns; these rows differ: ${badRows.slice(0, 10).map(([i, l]) => `row ${i} has ${l}`).join(', ')}`); else ok(`${rows.length} rows × ${n} columns, consistent.`);
  } else if (/^(?:js|javascript)$/i.test(kind)) {
    try { new Function(body); ok('No syntax errors.'); } catch (e) { bad(e.message); }
  }
}
async function formatCode(ctx, lang, body) {
  ctx.label('Format');
  let out;
  const l = lang.toLowerCase();
  if (l === 'json') out = JSON.stringify(JSON.parse(body), null, 2);
  else if (l === 'sql') { await K.loadScript('https://cdn.jsdelivr.net/npm/sql-formatter@15.4.2/dist/sql-formatter.min.js', 'sqlFormatter'); out = window.sqlFormatter.format(body); }
  else { await K.loadScript('https://cdnjs.cloudflare.com/ajax/libs/js-beautify/1.15.1/beautify.min.js', 'js_beautify'); await K.loadScript('https://cdnjs.cloudflare.com/ajax/libs/js-beautify/1.15.1/beautify-html.min.js', 'html_beautify'); await K.loadScript('https://cdnjs.cloudflare.com/ajax/libs/js-beautify/1.15.1/beautify-css.min.js', 'css_beautify'); out = (/html|xml|svg/.test(l) ? window.html_beautify : /css/.test(l) ? window.css_beautify : window.js_beautify)(body, { indent_size: 2 }); }
  ctx.input(`${lang.toUpperCase()}, formatted`);
  ctx.add({ title: 'Formatted', pre: out });
}
function minify(ctx, lang, body) {
  let out = body;
  if (/json/i.test(lang)) out = JSON.stringify(JSON.parse(body));
  else if (/css/i.test(lang)) out = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim();
  else if (/html/i.test(lang)) out = body.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();
  ctx.label('Minify'); ctx.input(`${lang.toUpperCase()}: ${body.length} → ${out.length} characters (${Math.round((1 - out.length / body.length) * 100)}% smaller)`);
  ctx.add({ title: 'Minified', pre: out });
}
// line diff (LCS)
function diff(ctx, a, b) {
  const A = a.split('\n'), B = b.split('\n');
  const n = A.length, m = B.length;
  if (n * m > 4e6) throw new Error('Too long to compare here (keep each side under ~2000 lines).');
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = []; let i = 0, j = 0, add = 0, del = 0;
  while (i < n && j < m) { if (A[i] === B[j]) { out.push(`  ${A[i]}`); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) { out.push(`- ${A[i++]}`); del++; } else { out.push(`+ ${B[j++]}`); add++; } }
  while (i < n) { out.push(`- ${A[i++]}`); del++; } while (j < m) { out.push(`+ ${B[j++]}`); add++; }
  ctx.label('Diff'); ctx.input(`${del} line${del === 1 ? '' : 's'} removed, ${add} added`);
  ctx.add({ title: 'Differences', custom: (el) => { const pre = document.createElement('pre'); pre.className = 'pre diff'; for (const l of out) { const s = document.createElement('div'); s.textContent = l; if (l[0] === '+') s.style.background = 'rgba(46,160,67,.15)'; if (l[0] === '-') s.style.background = 'rgba(248,81,73,.15)'; pre.append(s); } el.append(pre); } });
  const sim = 2 * L[0][0] / (n + m || 1);
  ctx.add({ title: 'Similarity', text: `${(sim * 100).toFixed(1)}% of lines match` });
  ctx.add(K.filesPod([{ label: 'Patch (.diff)', name: 'changes.diff', mime: 'text/plain', data: `--- a\n+++ b\n${out.join('\n')}` }]));
}
// Big-O hints from loop structure (heuristic)
function bigO(ctx, code) {
  const lines = code.split('\n');
  let depth = 0, maxDepth = 0; const stack = [];
  const loopRe = /^\s*(for|while)\b|\.forEach\(|\.map\(|\.filter\(|\.reduce\(/;
  for (const l of lines) {
    const ind = l.match(/^\s*/)[0].length;
    while (stack.length && ind <= stack[stack.length - 1]) stack.pop();
    if (loopRe.test(l)) { stack.push(ind); maxDepth = Math.max(maxDepth, stack.length); }
  }
  const halving = /\/\/=\s*2|\/=\s*2|>>=\s*1|\*=\s*2|mid\s*=|\blo\b.*\bhi\b|\blow\b.*\bhigh\b/.test(code);
  const recursion = (() => { const f = /def\s+(\w+)|function\s+(\w+)/.exec(code); if (!f) return 0; const name = f[1] || f[2]; return (code.match(new RegExp(`\\b${name}\\s*\\(`, 'g')) || []).length - 1; })();
  const sorts = /\.sort\(|sorted\(|Arrays\.sort|std::sort/.test(code);
  let est = maxDepth === 0 ? 'O(1)' : maxDepth === 1 ? 'O(n)' : `O(n^${maxDepth})`;
  if (halving && maxDepth <= 1) est = maxDepth ? 'O(log n)' : 'O(log n)';
  if (halving && maxDepth === 2) est = 'O(n log n)';
  if (recursion >= 2) est = halving ? 'O(n log n) (divide and conquer)' : 'O(2^n) (two recursive calls each time) unless memoized';
  else if (recursion === 1 && !maxDepth) est = halving ? 'O(log n)' : 'O(n)';
  if (sorts && /O\(n\)|O\(1\)/.test(est)) est = 'O(n log n) (sorting dominates)';
  ctx.label('Complexity'); ctx.input('Estimated from the loop and recursion structure');
  ctx.add({ title: 'Time complexity (estimate)', big: true, text: est, table: [['Deepest loop nesting', String(maxDepth)], ['Halving/doubling pattern', halving ? 'yes' : 'no'], ['Recursive calls in body', String(Math.max(recursion, 0))], ['Uses sort', sorts ? 'yes' : 'no']], note: 'A heuristic, not a proof: loops that don’t run n times, early exits, and library calls can change the answer.' });
  ctx.add({ title: 'Reference', chips: ['big o cheat sheet'] });
}
const BIGO = { head: ['Structure / algorithm', 'Access', 'Search', 'Insert', 'Delete', 'Notes'], rows: [['Array / list', 'O(1)', 'O(n)', 'O(n)', 'O(n)', 'append is O(1) amortized'], ['Linked list', 'O(n)', 'O(n)', 'O(1)', 'O(1)', 'at a known node'], ['Stack / queue', 'O(n)', 'O(n)', 'O(1)', 'O(1)', ''], ['Hash table / dict / set', '—', 'O(1) avg', 'O(1) avg', 'O(1) avg', 'O(n) worst'], ['Binary search tree (balanced)', 'O(log n)', 'O(log n)', 'O(log n)', 'O(log n)', 'unbalanced worst O(n)'], ['Heap', 'O(1) min', 'O(n)', 'O(log n)', 'O(log n)', 'priority queue'], ['Trie', '—', 'O(k)', 'O(k)', 'O(k)', 'k = key length'], ['Binary search', '', 'O(log n)', '', '', 'sorted data'], ['Merge sort', '', '', '', '', 'O(n log n) always, O(n) memory'], ['Quick sort', '', '', '', '', 'O(n log n) avg, O(n²) worst'], ['Heap sort', '', '', '', '', 'O(n log n), O(1) memory'], ['Insertion / bubble sort', '', '', '', '', 'O(n²), O(n) if nearly sorted'], ['Counting / radix sort', '', '', '', '', 'O(n + k)'], ['BFS / DFS', '', '', '', '', 'O(V + E)'], ['Dijkstra (binary heap)', '', '', '', '', 'O((V + E) log V)'], ['Bellman–Ford', '', '', '', '', 'O(VE)'], ['Floyd–Warshall', '', '', '', '', 'O(V³)'], ['Kruskal / Prim', '', '', '', '', 'O(E log V)'], ['Topological sort', '', '', '', '', 'O(V + E)']] };

// ============================================================ code examples
const SNIP = {
  'binary search': { python: 'def binary_search(a, target):\n    lo, hi = 0, len(a) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if a[mid] == target:\n            return mid\n        if a[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\n\nprint(binary_search([1, 3, 5, 7, 9], 7))  # 3', javascript: 'function binarySearch(a, target) {\n  let lo = 0, hi = a.length - 1;\n  while (lo <= hi) {\n    const mid = (lo + hi) >> 1;\n    if (a[mid] === target) return mid;\n    if (a[mid] < target) lo = mid + 1; else hi = mid - 1;\n  }\n  return -1;\n}\nconsole.log(binarySearch([1, 3, 5, 7, 9], 7)); // 3', java: 'static int binarySearch(int[] a, int target) {\n    int lo = 0, hi = a.length - 1;\n    while (lo <= hi) {\n        int mid = lo + (hi - lo) / 2;\n        if (a[mid] == target) return mid;\n        if (a[mid] < target) lo = mid + 1; else hi = mid - 1;\n    }\n    return -1;\n}', 'c++': 'int binarySearch(const std::vector<int>& a, int target) {\n    int lo = 0, hi = (int)a.size() - 1;\n    while (lo <= hi) {\n        int mid = lo + (hi - lo) / 2;\n        if (a[mid] == target) return mid;\n        if (a[mid] < target) lo = mid + 1; else hi = mid - 1;\n    }\n    return -1;\n}', c: 'int binary_search(int a[], int n, int target) {\n    int lo = 0, hi = n - 1;\n    while (lo <= hi) {\n        int mid = lo + (hi - lo) / 2;\n        if (a[mid] == target) return mid;\n        if (a[mid] < target) lo = mid + 1; else hi = mid - 1;\n    }\n    return -1;\n}' },
  'merge sort': { python: 'def merge_sort(a):\n    if len(a) <= 1:\n        return a\n    mid = len(a) // 2\n    left, right = merge_sort(a[:mid]), merge_sort(a[mid:])\n    out, i, j = [], 0, 0\n    while i < len(left) and j < len(right):\n        if left[i] <= right[j]:\n            out.append(left[i]); i += 1\n        else:\n            out.append(right[j]); j += 1\n    return out + left[i:] + right[j:]\n\nprint(merge_sort([5, 2, 9, 1, 5, 6]))', javascript: 'function mergeSort(a) {\n  if (a.length <= 1) return a;\n  const mid = a.length >> 1, l = mergeSort(a.slice(0, mid)), r = mergeSort(a.slice(mid));\n  const out = [];\n  while (l.length && r.length) out.push(l[0] <= r[0] ? l.shift() : r.shift());\n  return [...out, ...l, ...r];\n}\nconsole.log(mergeSort([5, 2, 9, 1, 5, 6]));' },
  'quick sort|quicksort': { python: 'def quick_sort(a):\n    if len(a) <= 1:\n        return a\n    pivot = a[len(a) // 2]\n    return (quick_sort([x for x in a if x < pivot])\n            + [x for x in a if x == pivot]\n            + quick_sort([x for x in a if x > pivot]))\n\nprint(quick_sort([3, 6, 1, 8, 2, 9]))', javascript: 'const quickSort = (a) => a.length <= 1 ? a : (() => {\n  const p = a[a.length >> 1];\n  return [...quickSort(a.filter(x => x < p)), ...a.filter(x => x === p), ...quickSort(a.filter(x => x > p))];\n})();\nconsole.log(quickSort([3, 6, 1, 8, 2, 9]));' },
  'bubble sort': { python: 'def bubble_sort(a):\n    a = a[:]\n    for i in range(len(a)):\n        swapped = False\n        for j in range(len(a) - 1 - i):\n            if a[j] > a[j + 1]:\n                a[j], a[j + 1] = a[j + 1], a[j]\n                swapped = True\n        if not swapped:\n            break\n    return a', javascript: 'function bubbleSort(a) {\n  a = [...a];\n  for (let i = 0; i < a.length; i++)\n    for (let j = 0; j < a.length - 1 - i; j++)\n      if (a[j] > a[j + 1]) [a[j], a[j + 1]] = [a[j + 1], a[j]];\n  return a;\n}' },
  'bfs|breadth first search': { python: 'from collections import deque\n\ndef bfs(graph, start):\n    seen, order, q = {start}, [], deque([start])\n    while q:\n        node = q.popleft()\n        order.append(node)\n        for nxt in graph[node]:\n            if nxt not in seen:\n                seen.add(nxt)\n                q.append(nxt)\n    return order\n\ng = {"A": ["B", "C"], "B": ["D"], "C": ["D"], "D": []}\nprint(bfs(g, "A"))', javascript: 'function bfs(graph, start) {\n  const seen = new Set([start]), order = [], q = [start];\n  while (q.length) {\n    const n = q.shift(); order.push(n);\n    for (const m of graph[n]) if (!seen.has(m)) { seen.add(m); q.push(m); }\n  }\n  return order;\n}\nconsole.log(bfs({ A: ["B", "C"], B: ["D"], C: ["D"], D: [] }, "A"));' },
  'dfs|depth first search': { python: 'def dfs(graph, node, seen=None):\n    seen = seen if seen is not None else set()\n    seen.add(node)\n    for nxt in graph[node]:\n        if nxt not in seen:\n            dfs(graph, nxt, seen)\n    return seen', javascript: 'function dfs(graph, node, seen = new Set()) {\n  seen.add(node);\n  for (const m of graph[node]) if (!seen.has(m)) dfs(graph, m, seen);\n  return seen;\n}' },
  'dijkstra|shortest path': { python: 'import heapq\n\ndef dijkstra(graph, src):\n    dist = {n: float("inf") for n in graph}\n    dist[src] = 0\n    pq = [(0, src)]\n    while pq:\n        d, u = heapq.heappop(pq)\n        if d > dist[u]:\n            continue\n        for v, w in graph[u]:\n            if d + w < dist[v]:\n                dist[v] = d + w\n                heapq.heappush(pq, (dist[v], v))\n    return dist\n\ng = {"A": [("B", 1), ("C", 4)], "B": [("C", 2)], "C": []}\nprint(dijkstra(g, "A"))' },
  'linked list': { python: 'class Node:\n    def __init__(self, val, nxt=None):\n        self.val, self.next = val, nxt\n\nclass LinkedList:\n    def __init__(self):\n        self.head = None\n    def push(self, val):\n        self.head = Node(val, self.head)\n    def __iter__(self):\n        n = self.head\n        while n:\n            yield n.val\n            n = n.next\n\nll = LinkedList()\nfor x in [3, 2, 1]:\n    ll.push(x)\nprint(list(ll))', java: 'class Node {\n    int val; Node next;\n    Node(int v, Node n) { val = v; next = n; }\n}\nNode head = null;\nhead = new Node(1, head); // push to front', 'c++': 'struct Node { int val; Node* next; };\nNode* push(Node* head, int v) { return new Node{v, head}; }' },
  'stack|queue': { python: 'stack = []\nstack.append(1); stack.append(2)\nprint(stack.pop())  # 2 (last in, first out)\n\nfrom collections import deque\nq = deque()\nq.append(1); q.append(2)\nprint(q.popleft())  # 1 (first in, first out)', javascript: 'const stack = []; stack.push(1); stack.push(2); console.log(stack.pop()); // 2\nconst q = []; q.push(1); q.push(2); console.log(q.shift()); // 1' },
  'fibonacci|memoization|dynamic programming': { python: 'from functools import lru_cache\n\n@lru_cache(maxsize=None)\ndef fib(n):\n    return n if n < 2 else fib(n - 1) + fib(n - 2)\n\n# bottom-up (tabulation)\ndef fib_dp(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n\nprint(fib(50), fib_dp(50))', javascript: 'const memo = new Map();\nfunction fib(n) {\n  if (n < 2) return n;\n  if (!memo.has(n)) memo.set(n, fib(n - 1) + fib(n - 2));\n  return memo.get(n);\n}\nconsole.log(fib(50));' },
  'factorial|recursion': { python: 'def factorial(n):\n    if n <= 1:          # base case\n        return 1\n    return n * factorial(n - 1)  # recursive case\n\nprint(factorial(5))  # 120', javascript: 'const factorial = (n) => (n <= 1 ? 1 : n * factorial(n - 1));\nconsole.log(factorial(5)); // 120', java: 'static long factorial(int n) {\n    return n <= 1 ? 1 : n * factorial(n - 1);\n}', c: 'long factorial(int n) { return n <= 1 ? 1 : n * factorial(n - 1); }' },
  'read file|read a file|file io|write file': { python: 'with open("notes.txt", encoding="utf-8") as f:\n    text = f.read()          # whole file\n\nwith open("notes.txt", encoding="utf-8") as f:\n    for line in f:           # line by line\n        print(line.rstrip())\n\nwith open("out.txt", "w", encoding="utf-8") as f:\n    f.write("hello\\n")', javascript: '// Node.js\nimport { readFile, writeFile } from "node:fs/promises";\nconst text = await readFile("notes.txt", "utf8");\nawait writeFile("out.txt", "hello\\n");', java: 'import java.nio.file.*;\nString text = Files.readString(Path.of("notes.txt"));\nFiles.writeString(Path.of("out.txt"), "hello\\n");', 'c++': '#include <fstream>\n#include <string>\nstd::ifstream in("notes.txt");\nstd::string line;\nwhile (std::getline(in, line)) { /* use line */ }\nstd::ofstream out("out.txt");\nout << "hello\\n";', c: 'FILE *f = fopen("notes.txt", "r");\nchar line[256];\nwhile (fgets(line, sizeof line, f)) { /* use line */ }\nfclose(f);' },
  'csv|read csv': { python: 'import csv\nwith open("data.csv", newline="", encoding="utf-8") as f:\n    for row in csv.DictReader(f):\n        print(row["name"], row["age"])\n\n# with pandas\nimport pandas as pd\ndf = pd.read_csv("data.csv")\nprint(df.describe())', javascript: '// browser: parse a simple CSV string\nconst rows = text.trim().split("\\n").map(l => l.split(","));\nconst [head, ...data] = rows;' },
  'json|parse json': { python: 'import json\ndata = json.loads(\'{"a": 1}\')\ntext = json.dumps(data, indent=2)\nwith open("data.json") as f:\n    obj = json.load(f)', javascript: 'const data = JSON.parse(\'{"a": 1}\');\nconst text = JSON.stringify(data, null, 2);', java: '// with Jackson\nObjectMapper m = new ObjectMapper();\nMap<String,Object> data = m.readValue(json, Map.class);' },
  'http request|api request|fetch|get request': { python: 'import requests\nr = requests.get("https://api.github.com/repos/python/cpython", timeout=10)\nr.raise_for_status()\nprint(r.json()["stargazers_count"])', javascript: 'const r = await fetch("https://api.github.com/repos/python/cpython");\nif (!r.ok) throw new Error(r.status);\nconst data = await r.json();\nconsole.log(data.stargazers_count);', java: 'HttpClient c = HttpClient.newHttpClient();\nHttpRequest req = HttpRequest.newBuilder(URI.create("https://api.github.com")).build();\nString body = c.send(req, HttpResponse.BodyHandlers.ofString()).body();' },
  'class|classes|object oriented|inheritance': { python: 'class Animal:\n    def __init__(self, name):\n        self.name = name\n    def speak(self):\n        return "..."\n\nclass Dog(Animal):          # inheritance\n    def speak(self):        # override\n        return f"{self.name} says woof"\n\nprint(Dog("Rex").speak())', javascript: 'class Animal {\n  constructor(name) { this.name = name; }\n  speak() { return "..."; }\n}\nclass Dog extends Animal {\n  speak() { return `${this.name} says woof`; }\n}\nconsole.log(new Dog("Rex").speak());', java: 'class Animal {\n    protected String name;\n    Animal(String name) { this.name = name; }\n    String speak() { return "..."; }\n}\nclass Dog extends Animal {\n    Dog(String n) { super(n); }\n    @Override String speak() { return name + " says woof"; }\n}', 'c++': 'class Animal {\npublic:\n    explicit Animal(std::string n) : name(std::move(n)) {}\n    virtual std::string speak() const { return "..."; }\n    virtual ~Animal() = default;\nprotected:\n    std::string name;\n};\nclass Dog : public Animal {\npublic:\n    using Animal::Animal;\n    std::string speak() const override { return name + " says woof"; }\n};' },
  'exception|try catch|error handling': { python: 'try:\n    x = int(input("Number: "))\nexcept ValueError as e:\n    print("Not a number:", e)\nelse:\n    print("Got", x)\nfinally:\n    print("done")', javascript: 'try {\n  JSON.parse("{bad json}");\n} catch (err) {\n  console.error("Parse failed:", err.message);\n} finally {\n  console.log("done");\n}', java: 'try {\n    int x = Integer.parseInt("abc");\n} catch (NumberFormatException e) {\n    System.out.println("Not a number: " + e.getMessage());\n} finally {\n    System.out.println("done");\n}' },
  'async|async await|promises': { python: 'import asyncio\n\nasync def work(n):\n    await asyncio.sleep(1)\n    return n * 2\n\nasync def main():\n    results = await asyncio.gather(*(work(i) for i in range(3)))\n    print(results)\n\nasyncio.run(main())', javascript: 'const wait = (ms) => new Promise(r => setTimeout(r, ms));\nasync function work(n) { await wait(1000); return n * 2; }\nconst results = await Promise.all([0, 1, 2].map(work));\nconsole.log(results);' },
  'list comprehension|map filter': { python: 'squares = [x * x for x in range(10)]\nevens = [x for x in range(10) if x % 2 == 0]\nlookup = {w: len(w) for w in ["a", "bb"]}\ndoubled = list(map(lambda x: x * 2, [1, 2, 3]))', javascript: 'const squares = [...Array(10).keys()].map(x => x * x);\nconst evens = squares.filter(x => x % 2 === 0);\nconst total = evens.reduce((s, x) => s + x, 0);' },
  'sort|sort list of dicts|sort objects': { python: 'people = [{"name": "Ann", "age": 30}, {"name": "Bob", "age": 25}]\npeople.sort(key=lambda p: p["age"])                 # in place\nby_name = sorted(people, key=lambda p: p["name"], reverse=True)', javascript: 'const people = [{ name: "Ann", age: 30 }, { name: "Bob", age: 25 }];\npeople.sort((a, b) => a.age - b.age);\npeople.sort((a, b) => a.name.localeCompare(b.name));', java: 'people.sort(Comparator.comparingInt(Person::getAge));' },
  'string formatting|f string|format string': { python: 'name, score = "Ann", 92.456\nprint(f"{name} scored {score:.1f}%")\nprint(f"{1234567:,}")      # 1,234,567\nprint(f"{\'left\':<10}|")', javascript: 'const name = "Ann", score = 92.456;\nconsole.log(`${name} scored ${score.toFixed(1)}%`);\nconsole.log((1234567).toLocaleString());', java: 'String s = String.format("%s scored %.1f%%", name, score);', c: 'printf("%s scored %.1f%%\\n", name, score);' },
  'regex|regular expression': { python: 'import re\ntext = "Call 555-1234 or 555-9876"\nprint(re.findall(r"\\d{3}-\\d{4}", text))\nm = re.search(r"(\\d{3})-(\\d{4})", text)\nif m:\n    print(m.group(1))\nprint(re.sub(r"\\d", "#", text))', javascript: 'const text = "Call 555-1234 or 555-9876";\nconsole.log(text.match(/\\d{3}-\\d{4}/g));\nconsole.log(text.replace(/\\d/g, "#"));' },
  'dates|date time|datetime': { python: 'from datetime import datetime, timedelta, date\nnow = datetime.now()\nprint(now.strftime("%Y-%m-%d %H:%M"))\nprint(date(2026, 12, 25) - date.today())\nd = datetime.strptime("2026-03-01", "%Y-%m-%d") + timedelta(days=30)', javascript: 'const now = new Date();\nconsole.log(now.toISOString());\nconst inThirtyDays = new Date(Date.now() + 30 * 864e5);\nconsole.log(now.toLocaleDateString("en-US", { dateStyle: "long" }));' },
  'random': { python: 'import random\nrandom.randint(1, 6)       # die roll\nrandom.choice(["a", "b"])\nrandom.shuffle(my_list)\nrandom.sample(range(100), 5)', javascript: 'const roll = 1 + Math.floor(Math.random() * 6);\nconst pick = arr[Math.floor(Math.random() * arr.length)];', java: 'Random r = new Random();\nint roll = r.nextInt(6) + 1;', 'c++': '#include <random>\nstd::mt19937 rng(std::random_device{}());\nstd::uniform_int_distribution<int> die(1, 6);\nint roll = die(rng);' },
  'command line arguments|argparse|cli': { python: 'import argparse\np = argparse.ArgumentParser(description="Demo")\np.add_argument("file")\np.add_argument("-n", type=int, default=10)\nargs = p.parse_args()\nprint(args.file, args.n)', javascript: '// node app.js input.txt\nconst [, , file] = process.argv;', c: 'int main(int argc, char *argv[]) {\n    for (int i = 1; i < argc; i++) printf("%s\\n", argv[i]);\n}' },
  'unit test|testing|pytest': { python: '# test_math.py  →  run: pytest\ndef add(a, b):\n    return a + b\n\ndef test_add():\n    assert add(2, 3) == 5', javascript: '// sum.test.js  →  run: npx vitest (or jest)\nimport { test, expect } from "vitest";\ntest("adds", () => { expect(1 + 2).toBe(3); });', java: '// JUnit 5\n@Test\nvoid adds() { assertEquals(5, add(2, 3)); }' },
  'hash map|dictionary|counter': { python: 'from collections import Counter, defaultdict\ncounts = Counter("mississippi")\nprint(counts.most_common(2))\ngroups = defaultdict(list)\ngroups["a"].append(1)', javascript: 'const counts = new Map();\nfor (const ch of "mississippi") counts.set(ch, (counts.get(ch) || 0) + 1);', java: 'Map<Character,Integer> counts = new HashMap<>();\nfor (char c : s.toCharArray()) counts.merge(c, 1, Integer::sum);', 'c++': 'std::unordered_map<char,int> counts;\nfor (char c : s) counts[c]++;' },
  'two pointers|sliding window': { python: '# longest substring without repeating characters\ndef longest_unique(s):\n    seen, left, best = {}, 0, 0\n    for right, ch in enumerate(s):\n        if ch in seen and seen[ch] >= left:\n            left = seen[ch] + 1\n        seen[ch] = right\n        best = max(best, right - left + 1)\n    return best\n\nprint(longest_unique("abcabcbb"))  # 3' },
  'matplotlib|plot|chart': { python: 'import matplotlib.pyplot as plt\nx = [1, 2, 3, 4]\ny = [1, 4, 9, 16]\nplt.plot(x, y, marker="o", label="x²")\nplt.xlabel("x"); plt.ylabel("y"); plt.title("Squares")\nplt.legend(); plt.grid(True)\nplt.savefig("plot.png", dpi=200)\nplt.show()' },
  'pandas|dataframe': { python: 'import pandas as pd\ndf = pd.read_csv("data.csv")\nprint(df.head())\nprint(df.describe())\nby_major = df.groupby("major")["gpa"].mean().sort_values()\nfiltered = df[df["age"] > 20]\ndf.to_excel("out.xlsx", index=False)' },
  'numpy|arrays': { python: 'import numpy as np\na = np.array([[1, 2], [3, 4]])\nprint(a.T, a @ a, np.linalg.inv(a))\nx = np.linspace(0, 1, 5)\nprint(x.mean(), x.std())' },
  'flask|web server|api server': { python: 'from flask import Flask, jsonify\napp = Flask(__name__)\n\n@app.get("/api/hello")\ndef hello():\n    return jsonify(message="hi")\n\nif __name__ == "__main__":\n    app.run(debug=True)', javascript: '// Express\nimport express from "express";\nconst app = express();\napp.get("/api/hello", (req, res) => res.json({ message: "hi" }));\napp.listen(3000);' },
  'sql|database|sqlite': { python: 'import sqlite3\ncon = sqlite3.connect("app.db")\ncon.execute("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)")\ncon.execute("INSERT INTO users (name) VALUES (?)", ("Ann",))  # parameters prevent SQL injection\ncon.commit()\nfor row in con.execute("SELECT * FROM users"):\n    print(row)' },
  'threads|threading|multithreading': { python: 'from concurrent.futures import ThreadPoolExecutor\n\ndef work(n):\n    return n * n\n\nwith ThreadPoolExecutor(max_workers=4) as ex:\n    print(list(ex.map(work, range(10))))', java: 'ExecutorService ex = Executors.newFixedThreadPool(4);\nFuture<Integer> f = ex.submit(() -> 6 * 7);\nSystem.out.println(f.get());\nex.shutdown();' },
  'input|user input': { python: 'name = input("Name: ")\nage = int(input("Age: "))  # input() returns text', java: 'Scanner sc = new Scanner(System.in);\nString name = sc.nextLine();\nint age = sc.nextInt();', 'c++': 'std::string name; int age;\nstd::getline(std::cin, name);\nstd::cin >> age;', c: 'char name[50]; int age;\nscanf("%49s %d", name, &age);' },
  'vector|dynamic array|arraylist': { 'c++': '#include <vector>\nstd::vector<int> v = {3, 1, 2};\nv.push_back(4);\nstd::sort(v.begin(), v.end());\nfor (int x : v) std::cout << x << " ";', java: 'List<Integer> v = new ArrayList<>(List.of(3, 1, 2));\nv.add(4);\nCollections.sort(v);', python: 'v = [3, 1, 2]\nv.append(4)\nv.sort()' },
  'pointers': { c: 'int x = 5;\nint *p = &x;   // p holds the address of x\n*p = 7;        // changes x through the pointer\nprintf("%d\\n", x);  // 7\n\nint *arr = malloc(10 * sizeof *arr);\nif (arr) { arr[0] = 1; free(arr); }', 'c++': 'int x = 5;\nint* p = &x;\n*p = 7;\nauto ptr = std::make_unique<int>(42); // freed automatically' },
};
const LANG_ALIAS = { py: 'python', python3: 'python', js: 'javascript', node: 'javascript', typescript: 'javascript', ts: 'javascript', cpp: 'c++', 'c plus plus': 'c++', 'c#': 'csharp', golang: 'go' };
async function example(ctx, topic, lang, get) {
  const t = topic.toLowerCase().trim(), L = LANG_ALIAS[(lang || '').toLowerCase()] || (lang || '').toLowerCase();
  const key = Object.keys(SNIP).find(k => k.split('|').some(n => t === n || t.includes(n) || n.includes(t)));
  ctx.label('Code example'); ctx.input(`${topic}${L ? ` in ${L}` : ''}`);
  if (key) {
    const entry = SNIP[key];
    const langs = L ? (entry[L] ? [L] : []) : Object.keys(entry);
    for (const l of langs) ctx.add({ title: K.cap(l), pre: entry[l] });
    if (langs.length) {
      if (entry.python && (!L || L === 'python')) ctx.add({ title: 'Try it', chips: [`py: ${entry.python}`] });
      if (entry.javascript && (!L || L === 'javascript')) ctx.add({ title: 'Try it', chips: [`js: ${entry.javascript.replace(/^import .*$/m, '')}`] });
      ctx.add({ title: 'Other languages', chips: Object.keys(entry).filter(l => !langs.includes(l)).map(l => `example of ${key.split('|')[0]} in ${l}`) });
      return;
    }
  }
  // Rosetta Code has the same tasks solved in hundreds of languages.
  const s = await get(`https://rosettacode.org/w/api.php?action=query&list=search&srsearch=${enc(topic)}&srlimit=5&format=json&origin=*`, { proxy: true }).catch(() => null);
  const hits = (s && s.query && s.query.search) || [];
  if (!hits.length) {
    const q2 = `${topic} ${L || ''}`.trim();
    ctx.add({ title: `No built-in example for “${topic}”`, text: 'Good places to find a worked example:', buttons: [{ label: 'Rosetta Code', url: `https://rosettacode.org/w/index.php?search=${enc(topic)}` }, { label: 'GitHub code search', url: `https://github.com/search?type=code&q=${enc(q2)}` }, { label: 'Stack Overflow', url: `https://stackoverflow.com/search?q=${enc(q2)}` }, { label: 'Google', url: `https://www.google.com/search?q=${enc(q2 + ' example')}` }], note: 'Built-in examples cover tasks like “binary search”, “read a csv”, “http request”, “classes”, “sort a list”. Type “example of binary search in java”.' });
    return;
  }
  const title = hits[0].title;
  const page = await get(`https://rosettacode.org/w/api.php?action=parse&page=${enc(title)}&prop=wikitext&format=json&origin=*`, { proxy: true });
  const wt = page.parse.wikitext['*'];
  const want = L || 'python';
  const sec = new RegExp(`==\\{\\{header\\|${want.replace(/[+#]/g, '\\$&')}\\}\\}==([\\s\\S]*?)(?:\\n==\\{\\{header|$)`, 'i').exec(wt);
  const code = sec && (/<(?:syntaxhighlight|lang)[^>]*>([\s\S]*?)<\/(?:syntaxhighlight|lang)>/i.exec(sec[1]) || [])[1];
  if (!code) { ctx.add({ title: title, text: `Rosetta Code has this task, but not in ${want}.`, buttons: [{ label: 'Open on Rosetta Code', url: `https://rosettacode.org/wiki/${enc(title.replace(/ /g, '_'))}` }] }); return; }
  ctx.add({ title: `${title} (${want})`, pre: code.trim() });
  ctx.add({ title: 'Source', note: 'From Rosetta Code (GFDL). Check it fits your assignment’s requirements.', buttons: [{ label: 'All languages', url: `https://rosettacode.org/wiki/${enc(title.replace(/ /g, '_'))}` }] });
}

// ============================================================ regex library + explainer
const REGEX = {
  email: ['^[\\w.+-]+@[\\w-]+\\.[\\w.-]+$', 'name@example.com'], 'phone number|us phone': ['^\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}$', '(555) 123-4567'], 'url|link': ['^https?:\\/\\/[\\w.-]+(?:\\.[\\w.-]+)+[\\w\\-._~:/?#[\\]@!$&\'()*+,;=%]*$', 'https://example.com/a?b=1'],
  'date|yyyy-mm-dd': ['^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$', '2026-11-09'], 'us date|mm/dd/yyyy': ['^(0[1-9]|1[0-2])\\/(0[1-9]|[12]\\d|3[01])\\/\\d{4}$', '11/09/2026'], 'time|24 hour time': ['^([01]\\d|2[0-3]):[0-5]\\d$', '13:45'], '12 hour time': ['^(1[0-2]|0?[1-9]):[0-5]\\d\\s?(AM|PM|am|pm)$', '1:45 PM'],
  'zip code|zip': ['^\\d{5}(-\\d{4})?$', '01776'], 'ipv4|ip address': ['^((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)$', '192.168.1.1'], 'hex color|color': ['^#(?:[0-9a-fA-F]{3}){1,2}$', '#2f5d50'],
  'strong password|password': ['^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s]).{8,}$', 'Abcdef1!'], 'username': ['^[a-zA-Z0-9_]{3,16}$', 'cy_mb'], 'integer|whole number': ['^-?\\d+$', '-42'], 'decimal|number|float': ['^-?\\d+(\\.\\d+)?$', '3.14'],
  'credit card': ['^(?:\\d[ -]?){13,19}$', '4111 1111 1111 1111'], 'ssn|social security': ['^\\d{3}-\\d{2}-\\d{4}$', '123-45-6789'], 'html tag': ['<\\/?[a-zA-Z][^>]*>', '<div class="x">'], 'whitespace|extra spaces': ['\\s{2,}', 'a   b'],
  'hashtag': ['#[A-Za-z0-9_]+', '#robotics'], 'mention|@mention': ['@[A-Za-z0-9_]+', '@cy'], 'uuid': ['^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', crypto.randomUUID ? '123e4567-e89b-42d3-a456-426614174000' : ''], 'mac address': ['^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$', '00:1A:2B:3C:4D:5E'],
  'domain': ['^(?:[a-z0-9-]+\\.)+[a-z]{2,}$', 'cymartinbell.com'], 'slug': ['^[a-z0-9]+(?:-[a-z0-9]+)*$', 'my-post-title'], 'duplicate words|repeated words': ['\\b(\\w+)\\s+\\1\\b', 'the the'], 'isbn': ['^(?:97[89][- ]?)?\\d{1,5}[- ]?\\d+[- ]?\\d+[- ]?[\\dX]$', '978-0-441-17271-9'], 'roman numeral': ['^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$', 'MMXXVI'],
};
function regexFor(ctx, what) {
  const w = what.toLowerCase();
  const key = Object.keys(REGEX).find(k => k.split('|').some(n => w.includes(n)));
  if (!key) return false;
  const [re, ex] = REGEX[key];
  ctx.label('Regex'); ctx.input(`Pattern for ${key.split('|')[0]}`);
  ctx.add({ title: 'Pattern', big: true, mono: true, text: re });
  ctx.add({ title: 'In code', pre: `JavaScript:  /${re}/.test(s)\nPython:      re.fullmatch(r"${re.replace(/^\^|\$$/g, '')}", s)\nJava:        s.matches("${re.replace(/\\/g, '\\\\').replace(/^\^|\$$/g, '')}")` });
  ctx.add({ title: 'Explained', chips: [`explain regex ${re}`], note: `Matches e.g. “${ex}”. Patterns for real-world formats (emails, URLs) are approximations; validate important data another way too.` });
  ctx.add({ title: 'Test it', chips: [`regex /${re}/ on ${ex}`] });
}
function explainRegex(ctx, re) {
  const parts = [];
  const tok = /\\[dDwWsSbB]|\\.|\[\^?(?:\\.|[^\]])*\]|\(\?:|\(\?=|\(\?!|\(\?<=|\(\?<!|\(\?<\w+>|\(|\)|\{\d+(?:,\d*)?\}|[*+?]\??|\^|\$|\||\.|[^\\[\](){}*+?^$|.]+/g;
  const D = { '\\d': 'a digit 0–9', '\\D': 'a non-digit', '\\w': 'a word character (letter, digit or _)', '\\W': 'a non-word character', '\\s': 'whitespace (space, tab, newline)', '\\S': 'non-whitespace', '\\b': 'a word boundary', '\\B': 'not a word boundary', '^': 'start of the text (or line)', '$': 'end of the text (or line)', '.': 'any character except newline', '|': 'OR', '(': 'start of a capturing group', '(?:': 'start of a non-capturing group', '(?=': 'start of a lookahead (must be followed by…)', '(?!': 'start of a negative lookahead (must NOT be followed by…)', '(?<=': 'start of a lookbehind', '(?<!': 'start of a negative lookbehind', ')': 'end of group', '*': 'repeat the previous item 0 or more times', '+': 'repeat the previous item 1 or more times', '?': 'make the previous item optional', '*?': '0 or more, as few as possible', '+?': '1 or more, as few as possible' };
  for (const t of re.match(tok) || []) {
    let d = D[t];
    if (!d && /^\{/.test(t)) { const [a, b] = t.slice(1, -1).split(','); d = b === undefined ? `exactly ${a} times` : b === '' ? `${a} or more times` : `between ${a} and ${b} times`; }
    if (!d && /^\[/.test(t)) d = `${t[1] === '^' ? 'any character NOT in' : 'one character from'} the set ${t}`;
    if (!d && /^\(\?<\w+>/.test(t)) d = `start of a group named “${t.slice(3, -1)}”`;
    if (!d && /^\\./.test(t)) d = `a literal “${t[1]}”`;
    if (!d) d = `the literal text “${t}”`;
    parts.push([t, d]);
  }
  try { new RegExp(re); } catch (e) { ctx.add({ title: 'Invalid', error: true, text: e.message }); }
  ctx.label('Regex'); ctx.input(`/${re}/`);
  ctx.add({ title: 'Piece by piece', table: { head: ['Token', 'Means'], rows: parts } });
  ctx.add({ title: 'Try it on text', chips: [`regex /${re}/ on `] });
}

// ============================================================ SQL (runs on SQLite in the browser; loaded files become tables)
let sqlDb = null;
async function sqlRun(ctx, query, F) {
  await K.loadScript('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js', 'initSqlJs');
  const SQL = await window.initSqlJs({ locateFile: (f) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}` });
  if (!sqlDb) sqlDb = new SQL.Database();
  // tables from the user's CSV/Excel files
  const made = [];
  for (const d of (F && F.tables ? F.tables() : [])) {
    const name = d.name.replace(/\.[^.]+$/, '').replace(/\W+/g, '_').toLowerCase().replace(/^(\d)/, 't_$1');
    const exists = sqlDb.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`);
    if (exists.length) continue;
    const cols = d.head.map(h => `"${String(h).replace(/"/g, '')}"`);
    sqlDb.run(`CREATE TABLE ${name} (${cols.join(', ')})`);
    const stmt = sqlDb.prepare(`INSERT INTO ${name} VALUES (${cols.map(() => '?').join(', ')})`);
    for (const r of d.rows) stmt.run(d.head.map((_, i) => { const v = r[i]; return v === '' || v == null ? null : !isNaN(+v) ? +v : String(v); }));
    stmt.free(); made.push(name);
  }
  ctx.label('SQL'); ctx.input('SQLite, running in your browser');
  if (made.length) ctx.add({ title: 'Tables from your files', text: made.join(', ') });
  const res = sqlDb.exec(query);
  if (!res.length) { ctx.add({ title: 'Done', text: `OK. ${sqlDb.getRowsModified()} row(s) changed.` }); }
  for (const r of res) {
    const rows = r.values.map(v => v.map(x => (x == null ? 'NULL' : String(x))));
    ctx.add({ title: `${rows.length} row${rows.length === 1 ? '' : 's'}`, table: { head: r.columns, rows: rows.slice(0, 200) } });
    ctx.add(K.filesPod(K.tableFiles('query-result', r.columns, rows)));
  }
  const tables = sqlDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
  if (tables.length) ctx.add({ title: 'Tables in this session', chips: tables[0].values.map(([t]) => `sql: SELECT * FROM ${t} LIMIT 10`) });
}
const SQL_RECIPES = [
  [/count|how many/, 'SELECT COUNT(*) FROM students WHERE major = \'Biology\';'], [/average|avg|mean/, 'SELECT major, AVG(gpa) AS avg_gpa\nFROM students\nGROUP BY major\nORDER BY avg_gpa DESC;'],
  [/top|highest|largest|best|first \d+/, 'SELECT name, gpa\nFROM students\nORDER BY gpa DESC\nLIMIT 5;'], [/join|combine|two tables|match/, 'SELECT s.name, c.title\nFROM students AS s\nJOIN enrollments AS e ON e.student_id = s.id\nJOIN courses AS c ON c.id = e.course_id;'],
  [/left join|missing|without|no match/, 'SELECT s.name\nFROM students s\nLEFT JOIN enrollments e ON e.student_id = s.id\nWHERE e.student_id IS NULL;  -- students with no enrollments'], [/duplicate/, 'SELECT email, COUNT(*) AS n\nFROM users\nGROUP BY email\nHAVING COUNT(*) > 1;'],
  [/group|per|each|by category/, 'SELECT department, COUNT(*) AS people, SUM(salary) AS payroll\nFROM employees\nGROUP BY department\nHAVING COUNT(*) > 3;'], [/insert|add a row/, 'INSERT INTO students (name, major, gpa)\nVALUES (\'Ann Lee\', \'Physics\', 3.8);'],
  [/update|change|modify/, 'UPDATE students\nSET gpa = 3.9\nWHERE id = 42;   -- always use WHERE, or every row changes'], [/delete|remove/, 'DELETE FROM students\nWHERE graduated = 1;   -- run as SELECT first to check'],
  [/create table|new table|schema/, 'CREATE TABLE students (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL,\n  major TEXT,\n  gpa REAL CHECK (gpa BETWEEN 0 AND 4),\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);'], [/index/, 'CREATE INDEX idx_students_major ON students(major);'],
  [/rank|running total|window|row number/, 'SELECT name, major, gpa,\n  RANK() OVER (PARTITION BY major ORDER BY gpa DESC) AS rank_in_major,\n  SUM(gpa) OVER (ORDER BY id) AS running_total\nFROM students;'], [/date|between|last \d+ days|month/, "SELECT *\nFROM orders\nWHERE order_date >= DATE('now', '-30 days');"],
  [/search|contains|like|starts with/, "SELECT * FROM books WHERE title LIKE '%robot%';"], [/null|empty/, 'SELECT * FROM students WHERE email IS NULL;'], [/distinct|unique/, 'SELECT DISTINCT major FROM students;'],
  [/subquery|above average/, 'SELECT name, gpa FROM students\nWHERE gpa > (SELECT AVG(gpa) FROM students);'], [/case|if|categor/, "SELECT name,\n  CASE WHEN gpa >= 3.5 THEN 'Honors' WHEN gpa >= 2.0 THEN 'Good standing' ELSE 'Probation' END AS status\nFROM students;"],
];
function sqlRecipe(ctx, want) {
  const w = want.toLowerCase();
  const hits = SQL_RECIPES.filter(([re]) => re.test(w));
  if (!hits.length) return false;
  ctx.label('SQL'); ctx.input(`Example query: ${want}`);
  hits.slice(0, 3).forEach(([, q], i) => ctx.add({ title: i ? 'Also relevant' : 'Query', pre: q }));
  ctx.add({ title: 'Run SQL here', chips: ['sql: SELECT 1 + 1 AS two'], note: 'Type sql: followed by a query to run it on SQLite in your browser. Drop CSV or Excel files first and they become tables.' });
}

// ============================================================ cron
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function explainCron(ctx, expr) {
  const f = expr.trim().split(/\s+/);
  if (f.length < 5) throw new Error('A cron expression has 5 fields: minute hour day-of-month month day-of-week.');
  const [mi, hr, dom, mon, dow] = f;
  const part = (v, unit, names) => v === '*' ? `every ${unit}` : /^\*\/(\d+)$/.test(v) ? `every ${v.slice(2)} ${unit}s` : v.split(',').map(x => (/^(\d+)-(\d+)$/.test(x) ? `${names ? names[+x.split('-')[0]] : x.split('-')[0]} through ${names ? names[+x.split('-')[1]] : x.split('-')[1]}` : names ? names[+x] || x : x)).join(', ');
  const time = /^\d+$/.test(mi) && /^\d+$/.test(hr) ? `at ${String(hr).padStart(2, '0')}:${String(mi).padStart(2, '0')}` : `${mi === '*' ? 'every minute' : `minute ${part(mi, 'minute')}`} of ${hr === '*' ? 'every hour' : `hour ${part(hr, 'hour')}`}`;
  const days = [dom !== '*' ? `on day ${part(dom, 'day')} of the month` : '', mon !== '*' ? `in ${part(mon, 'month', [, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])}` : '', dow !== '*' ? `on ${part(dow, 'weekday', DOW)}` : ''].filter(Boolean).join(' ');
  ctx.label('Cron'); ctx.input(expr);
  ctx.add({ title: 'Runs', big: true, text: `${K.cap(time)}${days ? ' ' + days : ', every day'}.` });
  ctx.add({ title: 'Fields', table: { head: ['Minute', 'Hour', 'Day of month', 'Month', 'Day of week'], rows: [f.slice(0, 5)] } });
}
function makeCron(ctx, text) {
  const t = text.toLowerCase();
  let mi = '0', hr = '*', dom = '*', mon = '*', dow = '*';
  const tm = /(?:at\s+)?(\d{1,2})(?::(\d\d))?\s*(am|pm)?/.exec(t.replace(/every \d+ (?:minutes|hours)/, ''));
  if (/every minute/.test(t)) { mi = '*'; }
  else if (/every (\d+) minutes/.test(t)) mi = `*/${/every (\d+) minutes/.exec(t)[1]}`;
  else if (/every (\d+) hours/.test(t)) { hr = `*/${/every (\d+) hours/.exec(t)[1]}`; }
  else if (/every hour|hourly/.test(t)) { /* hr * */ }
  else if (tm) { hr = String(+tm[1] % 12 + (tm[3] === 'pm' ? 12 : 0) + (tm[3] === 'am' && +tm[1] === 12 ? -0 : 0)); mi = String(+(tm[2] || 0)); if (!tm[3] && +tm[1] < 24) hr = tm[1]; }
  else hr = '0';
  if (/midnight/.test(t)) { hr = '0'; mi = '0'; } if (/noon/.test(t)) { hr = '12'; mi = '0'; }
  if (/weekday/.test(t)) dow = '1-5'; else if (/weekend/.test(t)) dow = '0,6';
  else { const ds = DOW.map((d, i) => (new RegExp(d.slice(0, 3).toLowerCase()).test(t) ? i : -1)).filter(i => i >= 0); if (ds.length) dow = ds.join(','); }
  const dm = /(?:on the |day )(\d{1,2})(?:st|nd|rd|th)?/.exec(t); if (dm || /monthly|every month/.test(t)) dom = dm ? dm[1] : '1';
  const expr = `${mi} ${hr} ${dom} ${mon} ${dow}`;
  explainCron(ctx, expr);
  ctx.add({ title: 'Expression', big: true, mono: true, text: expr });
}

// ============================================================ chmod
function chmod(ctx, v) {
  const R = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
  let oct, sym;
  if (/^[0-7]{3,4}$/.test(v)) { oct = v.slice(-3); sym = [...oct].map(d => R[+d]).join(''); }
  else if (/^[rwx-]{9}$/.test(v)) { sym = v; oct = [0, 3, 6].map(i => R.indexOf(v.slice(i, i + 3))).join(''); }
  else return false;
  const who = ['Owner', 'Group', 'Others'];
  ctx.label('chmod'); ctx.input(`${oct} = ${sym}`);
  ctx.add({ title: 'Permissions', table: { head: ['', 'Read', 'Write', 'Execute'], rows: who.map((w, i) => [w, ...[0, 1, 2].map(j => (sym[i * 3 + j] !== '-' ? '✓' : ''))]) } });
  ctx.add({ title: 'Command', pre: `chmod ${oct} file` });
}

// ============================================================ git / terminal / docker recipes
const RECIPES = [
  ['git', 'undo last commit (keep changes)', 'git reset --soft HEAD~1'], ['git', 'undo last commit (discard changes)', 'git reset --hard HEAD~1   # careful: deletes the work'], ['git', 'undo a pushed commit', 'git revert <commit-sha>   # makes a new commit that undoes it'],
  ['git', 'discard local changes to a file', 'git restore path/to/file'], ['git', 'unstage a file', 'git restore --staged path/to/file'], ['git', 'change last commit message', 'git commit --amend -m "New message"'],
  ['git', 'create and switch to a branch', 'git switch -c feature-name'], ['git', 'delete a branch', 'git branch -d feature-name\ngit push origin --delete feature-name'], ['git', 'rename a branch', 'git branch -m old-name new-name'],
  ['git', 'see history', 'git log --oneline --graph --decorate --all'], ['git', 'stash changes', 'git stash\ngit stash pop'], ['git', 'update branch with main', 'git switch my-branch\ngit fetch origin\ngit rebase origin/main   # or: git merge origin/main'],
  ['git', 'resolve merge conflict', '# edit files, keep the right lines, remove <<<<<<< ======= >>>>>>>\ngit add <file>\ngit commit   # or git rebase --continue'], ['git', 'clone a repo', 'git clone https://github.com/user/repo.git'], ['git', 'set up a new repo and push', 'git init\ngit add .\ngit commit -m "Initial commit"\ngit branch -M main\ngit remote add origin https://github.com/you/repo.git\ngit push -u origin main'],
  ['git', 'ignore a file already committed', 'echo "secret.env" >> .gitignore\ngit rm --cached secret.env\ngit commit -m "Stop tracking secret.env"'], ['git', 'see what changed', 'git status\ngit diff            # unstaged\ngit diff --staged   # staged'], ['git', 'squash commits', 'git rebase -i HEAD~3   # mark commits as "squash"'],
  ['git', 'cherry pick', 'git cherry-pick <commit-sha>'], ['git', 'find who changed a line', 'git blame path/to/file'], ['git', 'tag a release', 'git tag -a v1.0.0 -m "Version 1.0.0"\ngit push origin v1.0.0'], ['git', 'remove untracked files', 'git clean -n   # preview\ngit clean -fd  # delete'],
  ['git', 'set name and email', 'git config --global user.name "Your Name"\ngit config --global user.email "you@example.com"'], ['git', 'recover deleted branch or commit', 'git reflog   # find the sha\ngit switch -c recovered <sha>'],
  ['terminal', 'find files by name', 'find . -name "*.py"'], ['terminal', 'search text in files', 'grep -rn "TODO" .   # or: rg TODO'], ['terminal', 'disk usage of folders', 'du -sh * | sort -h'], ['terminal', 'free disk space', 'df -h'],
  ['terminal', 'what is using a port', 'lsof -i :3000\n# Windows: netstat -ano | findstr :3000'], ['terminal', 'kill a process', 'kill <PID>\nkill -9 <PID>   # force\n# Windows: taskkill /PID <PID> /F'], ['terminal', 'count lines in files', 'wc -l *.py'],
  ['terminal', 'make a script executable', 'chmod +x script.sh\n./script.sh'], ['terminal', 'add to path', 'export PATH="$HOME/.local/bin:$PATH"   # add to ~/.bashrc or ~/.zshrc'], ['terminal', 'environment variables', 'export API_KEY=abc123\necho $API_KEY'],
  ['terminal', 'ssh into a server', 'ssh user@host\nssh -i ~/.ssh/key.pem user@host'], ['terminal', 'copy files to a server', 'scp file.txt user@host:/path/\nrsync -avz folder/ user@host:/path/'], ['terminal', 'compress and extract', 'tar -czf archive.tar.gz folder/\ntar -xzf archive.tar.gz\nzip -r archive.zip folder/'],
  ['terminal', 'download a file', 'curl -LO https://example.com/file.zip\nwget https://example.com/file.zip'], ['terminal', 'watch a log file', 'tail -f app.log'], ['terminal', 'run in background', 'nohup python train.py > train.log 2>&1 &'], ['terminal', 'system info', 'uname -a\ntop   # or htop'],
  ['python', 'create a virtual environment', 'python3 -m venv .venv\nsource .venv/bin/activate     # Windows: .venv\\Scripts\\activate\npip install -r requirements.txt'], ['python', 'save requirements', 'pip freeze > requirements.txt'], ['python', 'install a package', 'python -m pip install package-name'],
  ['python', 'conda environment', 'conda create -n myenv python=3.12\nconda activate myenv'], ['python', 'jupyter notebook', 'pip install jupyterlab\njupyter lab'], ['python', 'run a module', 'python -m http.server 8000   # quick web server'],
  ['node', 'start a project', 'npm init -y\nnpm install express'], ['node', 'update packages', 'npm outdated\nnpm update'], ['node', 'fix vulnerabilities', 'npm audit\nnpm audit fix'], ['node', 'run a script', 'npm run dev'], ['node', 'new react app', 'npm create vite@latest my-app -- --template react'],
  ['docker', 'build and run', 'docker build -t myapp .\ndocker run -p 8000:8000 myapp'], ['docker', 'list and stop containers', 'docker ps -a\ndocker stop <id>\ndocker rm <id>'], ['docker', 'shell into a container', 'docker exec -it <id> sh'], ['docker', 'clean up space', 'docker system prune -a'],
  ['docker', 'compose up', 'docker compose up -d\ndocker compose logs -f\ndocker compose down'], ['docker', 'dockerfile for python', 'FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nCMD ["python", "app.py"]'],
  ['ros2', 'create a package', 'ros2 pkg create --build-type ament_python my_pkg'], ['ros2', 'build workspace', 'cd ~/ros2_ws\ncolcon build --symlink-install\nsource install/setup.bash'], ['ros2', 'list topics', 'ros2 topic list\nros2 topic echo /cmd_vel'], ['ros2', 'run a node', 'ros2 run my_pkg my_node'],
];
function recipe(ctx, tool, want) {
  const w = want.toLowerCase().replace(/\b(?:how (?:do i|to)|in|with|using|a|an|the|my)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const words = w.split(' ').filter(x => x.length > 2);
  const scored = RECIPES.filter(r => !tool || r[0] === tool).map(r => ({ r, s: words.filter(x => r[1].includes(x) || r[1].includes(x.replace(/s$/, ''))).length })).filter(x => x.s).sort((a, b) => b.s - a.s);
  if (!scored.length) return false;
  ctx.label(K.cap(scored[0].r[0])); ctx.input(scored[0].r[1]);
  scored.slice(0, 3).forEach((x, i) => ctx.add({ title: i ? `Also: ${x.r[1]}` : K.cap(x.r[1]), pre: x.r[2] }));
}

// ============================================================ web/dev lookups
const HTTP = { 100: 'Continue', 101: 'Switching Protocols', 200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 206: 'Partial Content', 301: 'Moved Permanently', 302: 'Found (temporary redirect)', 304: 'Not Modified (use your cached copy)', 307: 'Temporary Redirect', 308: 'Permanent Redirect', 400: 'Bad Request (malformed request)', 401: 'Unauthorized (not logged in / missing token)', 403: 'Forbidden (logged in but not allowed)', 404: 'Not Found', 405: 'Method Not Allowed', 408: 'Request Timeout', 409: 'Conflict', 410: 'Gone', 413: 'Payload Too Large', 415: 'Unsupported Media Type', 418: 'I’m a teapot (a joke)', 422: 'Unprocessable Entity (validation failed)', 429: 'Too Many Requests (rate limited)', 500: 'Internal Server Error (bug on the server)', 501: 'Not Implemented', 502: 'Bad Gateway (upstream server failed)', 503: 'Service Unavailable (overloaded or down)', 504: 'Gateway Timeout' };
const MIME = { html: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', xml: 'application/xml', csv: 'text/csv', txt: 'text/plain', md: 'text/markdown', pdf: 'application/pdf', zip: 'application/zip', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', ico: 'image/x-icon', mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm', woff2: 'font/woff2', wasm: 'application/wasm', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: K.XLSX_MIME, pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ics: 'text/calendar', yaml: 'application/yaml' };
const PORTS = { 20: 'FTP data', 21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP (email)', 53: 'DNS', 67: 'DHCP', 80: 'HTTP', 110: 'POP3', 123: 'NTP', 143: 'IMAP', 443: 'HTTPS', 465: 'SMTPS', 587: 'SMTP submission', 993: 'IMAPS', 1433: 'SQL Server', 1883: 'MQTT', 3000: 'Node/React dev servers', 3306: 'MySQL', 3389: 'Remote Desktop', 5000: 'Flask default', 5173: 'Vite dev server', 5432: 'PostgreSQL', 5672: 'RabbitMQ', 6379: 'Redis', 8000: 'Django / python -m http.server', 8080: 'HTTP alternate', 8888: 'Jupyter', 9000: 'various', 9090: 'Prometheus', 11311: 'ROS master', 27017: 'MongoDB' };
function semverCmp(a, b) { const p = (v) => v.replace(/^v/, '').split(/[.-]/).map(x => (isNaN(+x) ? x : +x)); const A = p(a), B = p(b); for (let i = 0; i < Math.max(A.length, B.length); i++) { if (A[i] === B[i]) continue; if (A[i] === undefined) return 1; if (B[i] === undefined) return -1; return A[i] > B[i] ? 1 : -1; } return 0; }
function cidr(ctx, ip, bits) {
  const toInt = (s) => s.split('.').reduce((a, b) => (a << 8) + +b, 0) >>> 0;
  const toIp = (n) => [24, 16, 8, 0].map(s => (n >>> s) & 255).join('.');
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  const net = (toInt(ip) & mask) >>> 0, bc = (net | (~mask >>> 0)) >>> 0;
  const hosts = bits >= 31 ? 2 ** (32 - bits) : 2 ** (32 - bits) - 2;
  ctx.label('Subnet'); ctx.input(`${ip}/${bits}`);
  ctx.add({ title: 'Network', table: [['Network address', toIp(net)], ['Broadcast', toIp(bc)], ['Subnet mask', toIp(mask)], ['Wildcard', toIp(~mask >>> 0)], ['Usable hosts', fmt(hosts, 0)], ['Host range', bits >= 31 ? `${toIp(net)} – ${toIp(bc)}` : `${toIp(net + 1)} – ${toIp(bc - 1)}`], ['Private range?', /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) ? 'Yes (RFC 1918)' : 'No'], ['Binary mask', [24, 16, 8, 0].map(s => ((mask >>> s) & 255).toString(2).padStart(8, '0')).join('.')]] });
}
function parseUrl(ctx, u) {
  const x = new URL(u);
  ctx.label('URL'); ctx.input(u);
  ctx.add({ title: 'Parts', table: [['Protocol', x.protocol], ['Host', x.hostname], ['Port', x.port || '(default)'], ['Path', x.pathname], ['Query', x.search || '—'], ['Fragment', x.hash || '—'], ['Origin', x.origin]] });
  const qs = [...x.searchParams.entries()];
  if (qs.length) ctx.add({ title: 'Query parameters', table: { head: ['Name', 'Value (decoded)'], rows: qs } });
}

export const DEV_RULES = [
  // packages
  [/^(?:crates?|cargo|rust (?:crate|package)s?)\s+(.+)$/i, (c, m, q, d) => crates(c, m[1], d.get)],
  [/^(?:gems?|rubygems?|ruby (?:gem|package)s?)\s+(.+)$/i, (c, m, q, d) => rubygems(c, m[1], d.get)],
  [/^(?:packagist|composer|php (?:package|library)s?)\s+(.+)$/i, (c, m, q, d) => packagist(c, m[1], d.get)],
  [/^(?:nuget|\.net (?:package|library)s?|c# (?:package|library)s?)\s+(.+)$/i, (c, m, q, d) => nuget(c, m[1], d.get)],
  [/^(?:maven|gradle|java (?:package|library|librarie)s?)\s+(.+)$/i, (c, m, q, d) => maven(c, m[1], d.get)],
  [/^(?:hex|elixir (?:package|library)s?)\s+(.+)$/i, (c, m, q, d) => hexpm(c, m[1], d.get)],
  [/^(?:pub\.?dev|dart (?:package|library)s?|flutter (?:package|library)s?)\s+(.+)$/i, (c, m, q, d) => pubdev(c, m[1], d.get)],
  [/^(?:cran|r (?:package|library)s?)\s+(.+)$/i, (c, m, q, d) => cran(c, m[1], d.get)],
  [/^(?:brew|homebrew)\s+(.+)$/i, (c, m, q, d) => brew(c, m[1], d.get)],
  [/^(?:docker(?:hub)?|docker images?|container images?)\s+(?!run|build|ps|compose|stop|exec|clean|rm\b)(.+)$/i, (c, m, q, d) => dockerhub(c, m[1], d.get)],
  [/^(?:conda|anaconda)\s+(.+)$/i, (c, m, q, d) => conda(c, m[1], d.get)],
  [/^npm\s+(?:info|package|details|stats)\s+(@?[\w./-]+)$/i, (c, m, q, d) => npmInfo(c, m[1], d.get)],
  [/^(?:compare\s+)?(?:npm\s+)?(@?[\w.-]+)\s+vs\.?\s+(@?[\w.-]+)\s+(?:npm|packages?|library|libraries)$/i, (c, m, q, d) => comparePackages(c, m[1], m[2], d.get)],
  [/^compare (?:npm |js |javascript )?(?:packages|libraries|libs)\s*:?\s*(@?[\w.-]+)\s+(?:vs\.?|and|,|or)\s+(@?[\w.-]+)$/i, (c, m, q, d) => comparePackages(c, m[1], m[2], d.get)],
  [/^npm compare\s+(@?[\w.-]+)\s+(?:vs\.?|and|,)\s+(@?[\w.-]+)$/i, (c, m, q, d) => comparePackages(c, m[1], m[2], d.get)],
  [/^(?:pypi|pip)\s+(?:downloads|stats)\s+([\w.-]+)$/i, (c, m, q, d) => pypiStats(c, m[1], d.get)],
  [/^(?:best |good |a |top )?(?:package|library|libraries|packages|module|tool|framework)s?\s+(?:for|to)\s+(.+?)(?:\s+in\s+(python|javascript|js|typescript|ts|java|rust|go|golang|ruby|php|c\+\+|c#|r|swift|kotlin|dart|julia))?$/i, (c, m, q, d) => packageFor(c, m[1], m[2], d.get)],
  [/^(python|javascript|js|typescript|java|rust|go|ruby|php|c\+\+|c#|r|swift|kotlin)\s+(?:package|library|libraries|packages|module)s?\s+(?:for|to)\s+(.+)$/i, (c, m, q, d) => packageFor(c, m[2], m[1], d.get)],
  // GitHub
  [/^(?:https?:\/\/)?github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git|\/.*)?$/i, (c, m, q, d) => ghRepo(c, m[1], d.get)],
  [/^(?:github\s+)?(?:repo|repository)\s+([\w.-]+\/[\w.-]+)$/i, (c, m, q, d) => ghRepo(c, m[1], d.get)],
  [/^github (?:user|profile|org|organization)\s+([\w-]+)$/i, (c, m, q, d) => ghUser(c, m[1], d.get)],
  [/^(?:github\s+)?trending(?:\s+(?:repos?|repositories|projects))?(?:\s+(?:in\s+)?([\w+#]+))?(?:\s+(today|this week|this month|this year))?$/i, (c, m, q, d) => ghTrending(c, m[1] && !/^(?:today|this)$/i.test(m[1]) ? m[1] : '', m[2] || 'week', d.get)],
  [/^(?:github|gh)\s+issues?\s+(.+)$/i, (c, m, q, d) => ghIssues(c, m[1], d.get)],
  [/^awesome\s+(.+)$/i, (c, m, q, d) => awesome(c, m[1], d.get)],
  [/^(?:license|licence)\s+([\w.-]+)$|^([\w.-]+)\s+license$/i, (c, m, q, d) => license(c, m[1] || m[2], d.get)],
  [/^(?:\.?gitignore)\s+(?:for\s+)?(.+)$/i, (c, m, q, d) => gitignore(c, m[1], d.get)],
  [/^(?:readme template|make a readme|readme)$/i, (c) => { const t = '# Project Name\n\nOne-sentence description of what it does and who it’s for.\n\n## Features\n- Feature one\n- Feature two\n\n## Getting started\n```bash\ngit clone https://github.com/you/project.git\ncd project\npip install -r requirements.txt   # or npm install\n```\n\n## Usage\n```bash\npython main.py --help\n```\n\n## Screenshots\n![screenshot](docs/screenshot.png)\n\n## How it works\nShort explanation of the architecture.\n\n## Contributing\nPull requests welcome. For big changes, open an issue first.\n\n## License\nMIT\n'; c.label('README'); c.add({ title: 'README.md', pre: t }); c.add(K.filesPod([{ label: 'README.md', name: 'README.md', mime: 'text/markdown', data: t }])); }],
  // errors & debugging
  [/^(?:explain|debug|fix|what does this error mean|why)?\s*(?:this\s+)?(?:error|traceback|exception|stack trace)?\s*:?\s*([\s\S]*(?:\b[A-Z]\w*(?:Error|Exception|Warning)\b\s*[:(]|\b[A-Z]\w*(?:Error|Exception)$|Traceback \(most recent|\berror(?:\[\w+\])?:|fatal:|CONFLICT \(|Segmentation fault|Undefined control sequence|Missing \$ inserted|ERESOLVE|EADDRINUSE|ECONNREFUSED|Permission denied|SettingWithCopy|blocked by CORS|undefined reference|npm ERR!|command not found|No such file or directory|cannot find symbol|NullPointerException|IndentationError|is not defined|is not a function|Cannot read propert)[\s\S]*)$/, (c, m) => explainError(c, m[1])],
  [/^(?:run\s+)?(?:js|javascript|node)\s*[:>]\s*([\s\S]+)$/i, (c, m) => runJS(c, m[1])],
  [/^(git|docker|npm|pip|conda|ros2)\s+(?!clone\b|status\b|init\b|log\b|diff\b|images?\b|hub\b)(.{6,})$/i, (c, m) => recipe(c, m[1].toLowerCase(), m[2])],
  [/^how (?:do i|to|can i|do you)\s+(.+?)\s+in\s+(python|javascript|js|typescript|java|c\+\+|cpp|c#|go|golang|rust|ruby|php|swift|kotlin|r|bash)$/i, (c, m, q, d) => example(c, m[1], m[2], d.get)],
  [/^(?:validate|check|lint|is this valid)\s+(json|ya?ml|xml|html|svg|csv|js|javascript)\s*:?\s*([\s\S]+)$/i, (c, m) => checkSyntax(c, m[1], m[2])],
  [/^(?:format|beautify|prettify|pretty print|indent)\s+(json|sql|html|xml|css|js|javascript|svg)\s*:?\s*([\s\S]+)$/i, (c, m) => formatCode(c, m[1], m[2])],
  [/^minify\s+(json|css|html)\s*:?\s*([\s\S]+)$/i, (c, m) => minify(c, m[1], m[2])],
  [/^(?:diff|compare)\s*:?\s*([\s\S]+?)\n\s*(?:-{3,}|={3,}|\|\|\||vs\.?)\s*\n([\s\S]+)$/i, (c, m) => diff(c, m[1], m[2])],
  [/^(?:big ?o|time complexity|complexity)\s+(?:of\s+)?(?:this\s+)?(?:code)?\s*:?\s*([\s\S]{8,})$/i, (c, m) => bigO(c, m[1])],
  [/^(?:big ?o|time complexity|complexity)\s*(?:cheat ?sheet|table|of data structures|of algorithms)?$/i, (c) => { c.label('Reference'); c.add({ title: 'Big-O cheat sheet', table: BIGO }); c.add(K.filesPod(K.tableFiles('big-o', BIGO.head, BIGO.rows))); }],
  [/^(?:example|examples|sample code|code (?:example|sample)|show me|how (?:do i|to) (?:write|implement|code|do))\s+(?:of|for)?\s*(?:an?\s+|the\s+)?(.+?)\s+in\s+(python|py|javascript|js|typescript|ts|java|c\+\+|cpp|c|c#|go|golang|rust|ruby|php|swift|kotlin|r|haskell|scala|julia|lua|perl|matlab|bash)$/i, (c, m, q, d) => example(c, m[1], m[2], d.get)],
  [/^(?:example|examples|sample code|code (?:example|sample))\s+(?:of|for)\s+(?:an?\s+|the\s+)?(.+)$/i, (c, m, q, d) => example(c, m[1], '', d.get)],
  [/^rosetta(?: code)?\s+(.+?)(?:\s+in\s+(.+))?$/i, (c, m, q, d) => example(c, m[1], m[2] || 'python', d.get)],
  // regex
  [/^(?:regex|regexp|regular expression|pattern)\s+(?:for|to match|matching)\s+(?:an?\s+)?(.+)$/i, (c, m) => regexFor(c, m[1])],
  [/^explain\s+(?:this\s+)?(?:regex|regexp|regular expression|pattern)\s*:?\s*\/?(.+?)\/?[gimsuy]*$/i, (c, m) => explainRegex(c, m[1])],
  // SQL
  [/^sql\s*[:>]\s*([\s\S]+)$/i, (c, m, q, d) => sqlRun(c, m[1], d.F)],
  [/^(?:sql|sql query|query)\s+(?:to|for|example|that)\s+(.+)$/i, (c, m) => sqlRecipe(c, m[1])],
  // cron, chmod
  [/^(?:explain\s+)?cron\s+((?:[\d*/,-]+\s+){4}[\d*/,-]+)$/i, (c, m) => explainCron(c, m[1])],
  [/^cron(?: expression)?\s+(?:for\s+)?(every .+|at .+|daily.+|weekly.+|monthly.+|(?:on )?(?:mon|tue|wed|thu|fri|sat|sun).+)$/i, (c, m) => makeCron(c, m[1])],
  [/^chmod\s+([0-7]{3,4}|[rwx-]{9})$/i, (c, m) => chmod(c, m[1])],
  // recipes
  [/^(git|terminal|bash|linux|mac|shell|docker|python|pip|conda|node|npm|ros2?)\s*(?::|how (?:do i|to))\s*(.+)$/i, (c, m) => recipe(c, ({ bash: 'terminal', linux: 'terminal', mac: 'terminal', shell: 'terminal', pip: 'python', conda: 'python', npm: 'node', ros: 'ros2' })[m[1].toLowerCase()] || m[1].toLowerCase(), m[2])],
  [/^how (?:do i|to|can i)\s+(.+?)\s+(?:in|with|using)\s+(git|docker|terminal|bash|linux|the terminal|the command line|ros2|npm|pip|conda)$/i, (c, m) => recipe(c, ({ bash: 'terminal', linux: 'terminal', 'the terminal': 'terminal', 'the command line': 'terminal', pip: 'python', conda: 'python', npm: 'node' })[m[2].toLowerCase()] || m[2].toLowerCase(), m[1])],
  [/^(?:how (?:do i|to|can i)\s+)?(undo (?:my |the )?last commit|undo a pushed commit|stash (?:my )?changes|create (?:a )?(?:virtual|virtual env|venv)|virtual environment|resolve (?:a )?merge conflict|kill (?:a )?process(?: on (?:a )?port)?|what is using (?:a )?port.*|squash commits|rename a branch|delete a branch)$/i, (c, m) => recipe(c, '', m[1])],
  // web lookups
  [/^(?:http\s+)?(?:status\s+)?(?:code\s+)?([1-5]\d\d)(?:\s+(?:status|error|code))?$/i, (c, m) => { const s = HTTP[m[1]]; if (!s) return false; c.label('HTTP'); c.input(`Status ${m[1]}`); c.add({ title: `${m[1]} ${s.split(' (')[0]}`, big: true, text: s, note: { 2: 'Success.', 3: 'Redirect.', 4: 'Client error: something about the request.', 5: 'Server error: something went wrong on the server.' }[m[1][0]] }); }],
  [/^(?:http (?:status )?codes?|status codes)$/i, (c) => { c.label('HTTP'); c.add({ title: 'Status codes', table: Object.entries(HTTP) }); }],
  [/^mime(?: type)?\s+(?:for\s+)?\.?(\w+)$|^\.?(\w+)\s+mime type$/i, (c, m) => { const e = (m[1] || m[2]).toLowerCase(); c.label('MIME'); c.add({ title: `.${e}`, big: true, mono: true, text: MIME[e] || 'application/octet-stream (generic binary)' }); }],
  [/^(?:port|what (?:is|uses) port)\s+(\d{1,5})$/i, (c, m) => { c.label('Port'); c.add({ title: `Port ${m[1]}`, big: true, text: PORTS[m[1]] || 'No well-known service for that port.' }); }],
  [/^(?:common )?ports$/i, (c) => { c.label('Ports'); c.add({ title: 'Common ports', table: Object.entries(PORTS) }); }],
  [/^(?:semver|compare versions?)\s+v?([\w.-]+)\s+(?:vs\.?|and|,)\s+v?([\w.-]+)$/i, (c, m) => { const r = semverCmp(m[1], m[2]); c.label('Versions'); c.add({ title: 'Newer', big: true, text: r === 0 ? 'They are the same version' : `${r > 0 ? m[1] : m[2]} is newer`, note: 'Compared part by part as numbers: 1.10.0 is newer than 1.9.0.' }); }],
  [/^(?:subnet|cidr|ip range)?\s*((?:\d{1,3}\.){3}\d{1,3})\s*\/\s*(\d{1,2})$/i, (c, m) => cidr(c, m[1], +m[2])],
  [/^(?:parse|split|explain)\s+(?:url|link)\s+(https?:\/\/\S+)$/i, (c, m) => parseUrl(c, m[1])],
  [/^(?:url ?encode|percent encode|encodeuricomponent)\s+([\s\S]+)$/i, (c, m) => { c.label('URL'); c.add({ title: 'Encoded', mono: true, text: encodeURIComponent(m[1]) }); }],
  [/^(?:url ?decode|percent decode)\s+([\s\S]+)$/i, (c, m) => { c.label('URL'); c.add({ title: 'Decoded', mono: true, text: decodeURIComponent(m[1]) }); }],
  [/^(?:html ?escape|escape html)\s+([\s\S]+)$/i, (c, m) => { c.label('HTML'); c.add({ title: 'Escaped', mono: true, text: m[1].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') }); }],
  [/^(?:html ?unescape|unescape html|decode html entities)\s+([\s\S]+)$/i, (c, m) => { const t = document.createElement('textarea'); t.innerHTML = m[1]; c.label('HTML'); c.add({ title: 'Unescaped', text: t.value }); }],
  [/^(?:json ?escape|escape (?:for )?json|string escape)\s+([\s\S]+)$/i, (c, m) => { c.label('Escape'); c.add({ title: 'JSON string', mono: true, text: JSON.stringify(m[1]) }); }],
  [/^(?:my )?user ?agent$/i, (c) => { const ua = navigator.userAgent; const b = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Unknown'; const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? (/iPhone|iPad/.test(ua) ? 'iOS' : 'macOS') : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : 'Unknown'; c.label('Browser'); c.add({ title: 'Your browser', table: [['Browser', b], ['System', os], ['Screen', `${screen.width}×${screen.height} @${devicePixelRatio}x`], ['Language', navigator.language], ['Cores', String(navigator.hardwareConcurrency || '?')], ['Time zone', Intl.DateTimeFormat().resolvedOptions().timeZone], ['User agent', ua]] }); }],
];
export const DEV_FEATURES = ['crates.io', 'RubyGems', 'Packagist', 'NuGet', 'Maven Central', 'Hex', 'pub.dev', 'R packages', 'Homebrew', 'Docker Hub', 'Anaconda', 'npm package details + downloads + bundle size', 'Compare npm packages', 'PyPI download stats', 'Find a library for a task in a language', 'GitHub repo details', 'GitHub user profiles', 'Trending repos', 'GitHub issue search', 'Awesome lists', 'License explanations + LICENSE file', '.gitignore templates', 'README template', 'Error explainer (70 common errors across 12 languages/tools)', 'Run JavaScript (sandboxed)', 'Validate JSON/YAML/XML/HTML/CSV/JS', 'Format JSON/SQL/HTML/CSS/JS', 'Minify JSON/CSS/HTML', 'Text/code diff + .diff', 'Big-O estimate of code', 'Big-O cheat sheet', 'Code examples (35 tasks × up to 5 languages)', 'Rosetta Code examples in any language', 'Regex library (28 patterns)', 'Regex explainer', 'Run SQL (SQLite in browser) on your CSV/Excel files', 'SQL query recipes', 'Cron explainer', 'Cron builder', 'chmod calculator', 'git/terminal/Python/Node/Docker/ROS 2 recipes (65)', 'HTTP status codes', 'MIME types', 'Port numbers', 'Version comparison', 'Subnet/CIDR calculator', 'URL parser', 'URL encode/decode', 'HTML escape/unescape', 'JSON string escape', 'Browser info'];
