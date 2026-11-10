// LaTeX: code for expressions, symbols, matrices, tables, document templates (with Overleaf),
// a formula library across subjects, cheat sheets, and LaTeX ⇄ Unicode / MathML.
import * as K from './kit.js';

// ---------- symbols ----------
const SYM = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  times: '×', div: '÷', pm: '±', mp: '∓', cdot: '·', ast: '∗', star: '⋆', circ: '∘', bullet: '•', oplus: '⊕', otimes: '⊗',
  leq: '≤', geq: '≥', neq: '≠', approx: '≈', equiv: '≡', sim: '∼', simeq: '≃', cong: '≅', propto: '∝', ll: '≪', gg: '≫', prec: '≺', succ: '≻', perp: '⊥', parallel: '∥', mid: '∣',
  in: '∈', notin: '∉', ni: '∋', subset: '⊂', supset: '⊃', subseteq: '⊆', supseteq: '⊇', cup: '∪', cap: '∩', setminus: '∖', emptyset: '∅', varnothing: '∅',
  forall: '∀', exists: '∃', nexists: '∄', neg: '¬', land: '∧', lor: '∨', implies: '⟹', iff: '⟺', therefore: '∴', because: '∵', top: '⊤', bot: '⊥', vdash: '⊢', models: '⊨',
  to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔', Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', mapsto: '↦', uparrow: '↑', downarrow: '↓', longrightarrow: '⟶', hookrightarrow: '↪', rightleftharpoons: '⇌',
  infty: '∞', partial: '∂', nabla: '∇', sum: '∑', prod: '∏', coprod: '∐', int: '∫', iint: '∬', iiint: '∭', oint: '∮', sqrt: '√', angle: '∠', triangle: '△', square: '□', degree: '°', prime: '′', hbar: 'ℏ', ell: 'ℓ', Re: 'ℜ', Im: 'ℑ', aleph: 'ℵ', wp: '℘',
  mathbb: '', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', R: 'ℝ', C: 'ℂ', ldots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱', langle: '⟨', rangle: '⟩', lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', dagger: '†', ddagger: '‡', S: '§', P: '¶', checkmark: '✓', copyright: '©',
};
const SYM_WORDS = {
  'integral': 'int', 'double integral': 'iint', 'triple integral': 'iiint', 'contour integral': 'oint', 'sum': 'sum', 'summation': 'sum', 'product': 'prod', 'infinity': 'infty', 'partial derivative': 'partial', 'gradient': 'nabla', 'del': 'nabla', 'nabla': 'nabla',
  'less than or equal': 'leq', 'greater than or equal': 'geq', 'not equal': 'neq', 'approximately': 'approx', 'approximately equal': 'approx', 'equivalent': 'equiv', 'congruent': 'cong', 'proportional': 'propto', 'plus minus': 'pm', 'plus or minus': 'pm', 'times': 'times', 'multiply': 'times', 'divide': 'div', 'dot': 'cdot', 'degree': 'degree', 'degrees': 'degree',
  'element of': 'in', 'in': 'in', 'not in': 'notin', 'subset': 'subset', 'subset or equal': 'subseteq', 'union': 'cup', 'intersection': 'cap', 'empty set': 'emptyset', 'set minus': 'setminus', 'for all': 'forall', 'there exists': 'exists', 'exists': 'exists', 'not': 'neg', 'and': 'land', 'or': 'lor', 'implies': 'implies', 'if and only if': 'iff', 'therefore': 'therefore', 'because': 'because',
  'arrow': 'rightarrow', 'right arrow': 'rightarrow', 'left arrow': 'leftarrow', 'double arrow': 'Rightarrow', 'maps to': 'mapsto', 'equilibrium': 'rightleftharpoons', 'reversible': 'rightleftharpoons', 'angle': 'angle', 'perpendicular': 'perp', 'parallel': 'parallel', 'h bar': 'hbar', 'hbar': 'hbar', 'real numbers': 'mathbb{R}', 'integers': 'mathbb{Z}', 'natural numbers': 'mathbb{N}', 'rationals': 'mathbb{Q}', 'rational numbers': 'mathbb{Q}', 'complex numbers': 'mathbb{C}',
  'dots': 'ldots', 'ellipsis': 'ldots', 'square root': 'sqrt{x}', 'fraction': 'frac{a}{b}', 'nth root': 'sqrt[n]{x}', 'hat': 'hat{x}', 'bar': 'bar{x}', 'vector': 'vec{v}', 'vector arrow': 'vec{v}', 'tilde': 'tilde{x}', 'overline': 'overline{AB}', 'limit': 'lim_{x \\to a}', 'derivative': 'frac{d}{dx}', 'binomial': 'binom{n}{k}', 'floor': 'lfloor x \\rfloor', 'ceiling': 'lceil x \\rceil', 'absolute value': 'lvert x \\rvert', 'norm': 'lVert x \\rVert', 'bra ket': 'langle \\psi | \\phi \\rangle', 'expected value': 'mathbb{E}[X]', 'transpose': 'A^{\\mathsf{T}}', 'dagger': 'dagger',
};
function symbolLookup(ctx, what) {
  const w = what.trim().replace(/^(?:the\s+)?(?:symbol\s+(?:for\s+)?)?/i, '').replace(/\s+(?:symbol|sign)$/i, '').toLowerCase();
  let name = SYM_WORDS[w] || (SYM[w] !== undefined ? w : Object.keys(SYM).find(k => k.toLowerCase() === w));
  if (!name) { const uni = Object.entries(SYM).find(([, v]) => v === what.trim()); if (uni) name = uni[0]; }
  if (!name) return false;
  const code = name.includes('{') || name.includes('\\') ? `\\${name}` : `\\${name}`;
  ctx.label('LaTeX'); ctx.input(`LaTeX for ${what}`);
  ctx.add({ title: 'Code', big: true, mono: true, text: code, latex: undefined });
  ctx.add({ title: 'Looks like', latex: code });
  if (SYM[name]) ctx.add({ title: 'Unicode character', text: SYM[name] });
  if (/^mathbb/.test(name)) ctx.add({ title: 'Needs', note: '\\usepackage{amssymb} (or amsfonts) in your preamble.' });
}

// ---------- LaTeX ⇄ Unicode / plain ----------
function latexToUnicode(t) {
  let s = t.replace(/\\mathbb\{([NZQRC])\}/g, (m, x) => SYM[x]).replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)').replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
    .replace(/\\([A-Za-z]+)/g, (m, x) => (SYM[x] !== undefined && SYM[x] !== '' ? SYM[x] : m)).replace(/\^\{?([0-9n+\-=()])\}?/g, (m, x) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+x] || { n: 'ⁿ', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾' }[x] || m)
    .replace(/_\{?([0-9])\}?/g, (m, x) => '₀₁₂₃₄₅₆₇₈₉'[+x]).replace(/[{}]/g, '').replace(/\\,|\\;|\\!|\\quad/g, ' ');
  return s;
}
function unicodeToLatex(t) {
  const rev = {};
  for (const [k, v] of Object.entries(SYM)) if (v && !rev[v]) rev[v] = k;
  return t.replace(/[^\x00-\x7F]/g, (ch) => {
    const sup = '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(ch); if (sup >= 0) return `^{${sup}}`;
    const sub = '₀₁₂₃₄₅₆₇₈₉'.indexOf(ch); if (sub >= 0) return `_{${sub}}`;
    if (ch === '√') return '\\sqrt';
    if (ch === 'ℝ') return '\\mathbb{R}'; if (ch === 'ℕ') return '\\mathbb{N}'; if (ch === 'ℤ') return '\\mathbb{Z}'; if (ch === 'ℚ') return '\\mathbb{Q}'; if (ch === 'ℂ') return '\\mathbb{C}';
    return rev[ch] ? `\\${rev[ch]} ` : ch;
  }).replace(/\s+([_^])/g, '$1');
}

// ---------- matrices ----------
function matrixLatex(ctx, src, kind = 'bmatrix') {
  let rows;
  try { rows = JSON.parse(src.replace(/'/g, '"')); } catch (_) { rows = src.split(/;|\n/).map(r => r.trim().split(/[\s,]+/).filter(Boolean)); }
  if (!Array.isArray(rows[0])) rows = [rows];
  const tex = `\\begin{${kind}}\n` + rows.map(r => '  ' + r.join(' & ')).join(' \\\\\n') + `\n\\end{${kind}}`;
  ctx.label('LaTeX'); ctx.input(`${rows.length}×${rows[0].length} matrix`);
  ctx.add({ title: 'Code', pre: tex });
  ctx.add({ title: 'Preview', latex: tex });
  ctx.add({ title: 'Other brackets', chips: ['pmatrix', 'vmatrix', 'Bmatrix', 'matrix'].filter(k => k !== kind).map(k => `latex ${k} ${src}`), note: 'Needs \\usepackage{amsmath}.' });
}

// ---------- templates ----------
const PRE = (extra = '') => `\\documentclass[11pt]{article}\n\\usepackage[margin=1in]{geometry}\n\\usepackage{amsmath,amssymb,amsthm}\n\\usepackage{graphicx}\n\\usepackage{hyperref}\n${extra}`;
const TEX_TEMPLATES = {
  article: () => `${PRE()}\n\\title{Title}\n\\author{Your Name}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\n\\begin{abstract}\nOne paragraph summary.\n\\end{abstract}\n\n\\section{Introduction}\nText.\n\n\\section{Methods}\n\n\\section{Results}\n\n\\section{Conclusion}\n\n\\bibliographystyle{plain}\n% \\bibliography{refs}\n\\end{document}\n`,
  homework: (items = ['', '', '']) => `${PRE('\\usepackage{enumitem}\n\\newtheorem*{solution}{Solution}')}\n\\title{Homework \\#1}\n\\author{Your Name \\\\ Course 101}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\n\\begin{enumerate}[label=\\textbf{\\arabic*.}]\n${items.map(t => `  \\item ${t || 'Problem statement.'}\n  \\begin{solution}\n    % Your work here. Inline math: $x^2$. Display:\n    \\[ \\]\n  \\end{solution}\n`).join('\n')}\\end{enumerate}\n\\end{document}\n`,
  'lab report': () => `${PRE('\\usepackage{siunitx}\n\\usepackage{booktabs}')}\n\\title{Lab Report: Experiment Name}\n\\author{Your Name \\\\ Lab partner(s)}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\n\\section{Purpose}\n\\section{Background}\n\\section{Materials and Methods}\n\\section{Data}\n\\begin{table}[h]\\centering\n\\begin{tabular}{lSS}\\toprule\nTrial & {Measurement (\\si{\\meter})} & {Uncertainty} \\\\ \\midrule\n1 & 1.23 & 0.01 \\\\\n\\bottomrule\\end{tabular}\n\\caption{Raw data.}\n\\end{table}\n\\section{Analysis}\n\\section{Error Analysis}\n\\section{Conclusion}\n\\end{document}\n`,
  beamer: () => `\\documentclass{beamer}\n\\usetheme{Madrid}\n\\title{Presentation Title}\n\\author{Your Name}\n\\date{\\today}\n\n\\begin{document}\n\\frame{\\titlepage}\n\n\\begin{frame}{Outline}\n  \\tableofcontents\n\\end{frame}\n\n\\section{Introduction}\n\\begin{frame}{Introduction}\n  \\begin{itemize}\n    \\item First point\n    \\item<2-> Appears on click\n  \\end{itemize}\n\\end{frame}\n\n\\begin{frame}{An equation}\n  \\[ E = mc^2 \\]\n\\end{frame}\n\\end{document}\n`,
  resume: () => `\\documentclass[10pt]{article}\n\\usepackage[margin=0.7in]{geometry}\n\\usepackage{enumitem,hyperref}\n\\setlist{nosep,leftmargin=*}\n\\pagenumbering{gobble}\n\\newcommand{\\entry}[4]{\\textbf{#1} \\hfill #2 \\\\ \\textit{#3} \\hfill \\textit{#4}}\n\n\\begin{document}\n\\begin{center}\n{\\LARGE \\textbf{Your Name}} \\\\\nemail@example.com $\\cdot$ (555) 555-5555 $\\cdot$ \\href{https://github.com/you}{github.com/you}\n\\end{center}\n\n\\section*{Education}\n\\entry{University Name}{City, ST}{B.S. Major, GPA 3.9}{Expected May 2031}\n\n\\section*{Experience}\n\\entry{Role}{Month 2025 -- Present}{Organization}{City, ST}\n\\begin{itemize}\n  \\item Did something measurable.\n\\end{itemize}\n\n\\section*{Projects}\n\\entry{Project}{2026}{Tools used}{}\n\\begin{itemize}\n  \\item What it does and why it matters.\n\\end{itemize}\n\n\\section*{Skills}\nPython, C++, ROS2, LaTeX\n\\end{document}\n`,
  letter: () => `\\documentclass{letter}\n\\signature{Your Name}\n\\address{Street \\\\ City, ST 00000}\n\\begin{document}\n\\begin{letter}{Recipient \\\\ Organization \\\\ Address}\n\\opening{Dear Dr. Smith,}\n\nBody of the letter.\n\n\\closing{Sincerely,}\n\\end{letter}\n\\end{document}\n`,
  'mla essay': () => `\\documentclass[12pt]{article}\n\\usepackage[margin=1in]{geometry}\n\\usepackage{setspace,times,fancyhdr}\n\\pagestyle{fancy}\\fancyhf{}\\rhead{Lastname \\thepage}\\renewcommand{\\headrulewidth}{0pt}\n\\doublespacing\n\\begin{document}\n\\noindent Your Name\\\\ Professor Name\\\\ Course\\\\ \\today\n\\begin{center}Title of Essay\\end{center}\n\\setlength{\\parindent}{0.5in}\nFirst paragraph with thesis.\n\n\\newpage\n\\begin{center}Works Cited\\end{center}\n\\end{document}\n`,
  'cheat sheet': () => `\\documentclass[8pt]{extarticle}\n\\usepackage[margin=0.3in,landscape]{geometry}\n\\usepackage{amsmath,amssymb,multicol}\n\\setlength{\\parindent}{0pt}\n\\pagestyle{empty}\n\\begin{document}\n\\begin{multicols*}{3}\n\\section*{Topic 1}\n$\\displaystyle \\frac{d}{dx}x^n = nx^{n-1}$\n\n\\section*{Topic 2}\n\\end{multicols*}\n\\end{document}\n`,
  thesis: () => `\\documentclass[12pt]{report}\n\\usepackage[margin=1in]{geometry}\n\\usepackage{amsmath,amssymb,graphicx,hyperref,setspace}\n\\onehalfspacing\n\\title{Thesis Title}\n\\author{Your Name}\n\\date{Month Year}\n\\begin{document}\n\\maketitle\n\\begin{abstract}\n\\end{abstract}\n\\tableofcontents\n\\chapter{Introduction}\n\\chapter{Literature Review}\n\\chapter{Methods}\n\\chapter{Results}\n\\chapter{Discussion}\n\\chapter{Conclusion}\n\\bibliographystyle{plain}\n% \\bibliography{refs}\n\\end{document}\n`,
  poster: () => `\\documentclass[25pt,a0paper,portrait]{tikzposter}\n\\title{Poster Title}\\author{Your Name}\\institute{School}\n\\usetheme{Simple}\n\\begin{document}\n\\maketitle\n\\begin{columns}\n\\column{0.5}\n\\block{Introduction}{Text}\n\\block{Methods}{Text}\n\\column{0.5}\n\\block{Results}{Text}\n\\block{Conclusion}{Text}\n\\end{columns}\n\\end{document}\n`,
  'cover letter': () => `\\documentclass[11pt]{letter}\n\\usepackage[margin=1in]{geometry}\n\\signature{Your Name}\n\\address{you@example.com \\\\ (555) 555-5555}\n\\begin{document}\n\\begin{letter}{Hiring Manager \\\\ Company}\n\\opening{Dear Hiring Manager,}\nI am applying for the ... position. (Why you, why them, what you'd do.)\n\n\\closing{Sincerely,}\n\\end{letter}\n\\end{document}\n`,
  exam: () => `\\documentclass[11pt,addpoints]{exam}\n\\usepackage{amsmath}\n\\begin{document}\n\\begin{center}\\textbf{Quiz 1} \\\\ Name: \\rule{2in}{0.4pt}\\end{center}\n\\begin{questions}\n\\question[5] Solve $x^2 = 4$.\n\\vspace{1in}\n\\question[5] Which is prime?\n\\begin{choices}\\choice 4 \\CorrectChoice 5 \\choice 6\\end{choices}\n\\end{questions}\n\\end{document}\n`,
};
function texTemplate(ctx, kind, items) {
  const tex = TEX_TEMPLATES[kind](items);
  ctx.label('LaTeX'); ctx.input(`${K.cap(kind)} template`);
  ctx.add({ title: `${K.cap(kind)}.tex`, pre: tex });
  ctx.add(K.texFilePod(`${kind.replace(/\s+/g, '-')}.tex`, tex));
  ctx.add({ title: 'Other templates', chips: Object.keys(TEX_TEMPLATES).filter(k => k !== kind).map(k => `latex ${k} template`) });
}

// ---------- formula library ----------
// [names, latex, variables, category]
const F = [
  // algebra & geometry
  ['quadratic formula', 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}', 'a, b, c: coefficients of ax² + bx + c = 0', 'Algebra'],
  ['slope|slope formula', 'm = \\frac{y_2 - y_1}{x_2 - x_1}', '(x₁, y₁), (x₂, y₂): two points', 'Algebra'],
  ['point slope form|point-slope', 'y - y_1 = m(x - x_1)', 'm: slope, (x₁, y₁): a point', 'Algebra'],
  ['slope intercept form|slope-intercept', 'y = mx + b', 'm: slope, b: y-intercept', 'Algebra'],
  ['distance formula', 'd = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}', 'two points', 'Algebra'],
  ['midpoint formula', 'M = \\left(\\frac{x_1 + x_2}{2}, \\frac{y_1 + y_2}{2}\\right)', 'two points', 'Algebra'],
  ['difference of squares', 'a^2 - b^2 = (a - b)(a + b)', '', 'Algebra'],
  ['binomial theorem', '(a + b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{n-k} b^k', '', 'Algebra'],
  ['arithmetic sequence', 'a_n = a_1 + (n - 1)d, \\qquad S_n = \\frac{n}{2}(a_1 + a_n)', 'd: common difference', 'Algebra'],
  ['geometric sequence|geometric series', 'a_n = a_1 r^{n-1}, \\qquad S_n = a_1\\frac{1 - r^n}{1 - r}, \\qquad S_\\infty = \\frac{a_1}{1 - r}\\ (|r|<1)', 'r: common ratio', 'Algebra'],
  ['exponential growth|exponential decay', 'A = A_0 e^{kt}', 'k > 0 growth, k < 0 decay', 'Algebra'],
  ['logarithm rules|log rules', '\\log(xy) = \\log x + \\log y,\\quad \\log\\frac{x}{y} = \\log x - \\log y,\\quad \\log x^n = n\\log x,\\quad \\log_b x = \\frac{\\ln x}{\\ln b}', '', 'Algebra'],
  ['area of a circle|circle area', 'A = \\pi r^2', 'r: radius', 'Geometry'],
  ['circumference', 'C = 2\\pi r = \\pi d', '', 'Geometry'],
  ['area of a triangle|triangle area', 'A = \\tfrac{1}{2}bh', 'b: base, h: height', 'Geometry'],
  ['herons formula|heron', 'A = \\sqrt{s(s-a)(s-b)(s-c)},\\quad s = \\frac{a+b+c}{2}', 'a, b, c: sides', 'Geometry'],
  ['pythagorean theorem|pythagoras', 'a^2 + b^2 = c^2', 'c: hypotenuse', 'Geometry'],
  ['area of a trapezoid|trapezoid', 'A = \\tfrac{1}{2}(b_1 + b_2)h', '', 'Geometry'],
  ['volume of a sphere|sphere volume', 'V = \\tfrac{4}{3}\\pi r^3', '', 'Geometry'],
  ['surface area of a sphere', 'A = 4\\pi r^2', '', 'Geometry'],
  ['volume of a cylinder|cylinder volume', 'V = \\pi r^2 h', '', 'Geometry'],
  ['volume of a cone|cone volume', 'V = \\tfrac{1}{3}\\pi r^2 h', '', 'Geometry'],
  ['law of cosines', 'c^2 = a^2 + b^2 - 2ab\\cos C', '', 'Trigonometry'],
  ['law of sines', '\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C}', '', 'Trigonometry'],
  ['pythagorean identity', '\\sin^2\\theta + \\cos^2\\theta = 1', '', 'Trigonometry'],
  ['double angle|double angle formulas', '\\sin 2\\theta = 2\\sin\\theta\\cos\\theta,\\quad \\cos 2\\theta = \\cos^2\\theta - \\sin^2\\theta', '', 'Trigonometry'],
  ['angle addition|sum formulas', '\\sin(a \\pm b) = \\sin a\\cos b \\pm \\cos a\\sin b,\\quad \\cos(a \\pm b) = \\cos a\\cos b \\mp \\sin a\\sin b', '', 'Trigonometry'],
  ['eulers formula|euler formula', 'e^{i\\theta} = \\cos\\theta + i\\sin\\theta', '', 'Complex numbers'],
  // calculus
  ['power rule', '\\frac{d}{dx}x^n = nx^{n-1}', '', 'Calculus'],
  ['product rule', '(fg)\' = f\'g + fg\'', '', 'Calculus'],
  ['quotient rule', '\\left(\\frac{f}{g}\\right)\' = \\frac{f\'g - fg\'}{g^2}', '', 'Calculus'],
  ['chain rule', '\\frac{d}{dx}f(g(x)) = f\'(g(x))\\,g\'(x)', '', 'Calculus'],
  ['integration by parts', '\\int u\\,dv = uv - \\int v\\,du', '', 'Calculus'],
  ['fundamental theorem of calculus|ftc', '\\int_a^b f(x)\\,dx = F(b) - F(a),\\quad F\' = f', '', 'Calculus'],
  ['definition of derivative|limit definition of derivative', 'f\'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}', '', 'Calculus'],
  ['taylor series', 'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x - a)^n', '', 'Calculus'],
  ['arc length', 'L = \\int_a^b \\sqrt{1 + [f\'(x)]^2}\\,dx', '', 'Calculus'],
  ['mean value theorem', 'f\'(c) = \\frac{f(b) - f(a)}{b - a}', '', 'Calculus'],
  ['lhopitals rule|l hopital', '\\lim_{x\\to a}\\frac{f(x)}{g(x)} = \\lim_{x\\to a}\\frac{f\'(x)}{g\'(x)}', 'for 0/0 or ∞/∞ forms', 'Calculus'],
  // stats
  ['mean|average', '\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i', '', 'Statistics'],
  ['standard deviation', 's = \\sqrt{\\frac{1}{n-1}\\sum_{i=1}^{n}(x_i - \\bar{x})^2}', 'sample (use n for a population)', 'Statistics'],
  ['variance', 's^2 = \\frac{1}{n-1}\\sum_{i=1}^{n}(x_i - \\bar{x})^2', '', 'Statistics'],
  ['z score|z-score', 'z = \\frac{x - \\mu}{\\sigma}', '', 'Statistics'],
  ['standard error', 'SE = \\frac{s}{\\sqrt{n}}', '', 'Statistics'],
  ['confidence interval', '\\bar{x} \\pm t^{*}\\frac{s}{\\sqrt{n}}', '', 'Statistics'],
  ['t statistic|t test', 't = \\frac{\\bar{x} - \\mu_0}{s/\\sqrt{n}}', '', 'Statistics'],
  ['correlation coefficient|pearson correlation', 'r = \\frac{\\sum (x_i-\\bar{x})(y_i-\\bar{y})}{\\sqrt{\\sum (x_i-\\bar{x})^2 \\sum (y_i-\\bar{y})^2}}', '', 'Statistics'],
  ['linear regression|least squares', '\\hat{y} = b_0 + b_1 x,\\quad b_1 = r\\frac{s_y}{s_x},\\quad b_0 = \\bar{y} - b_1\\bar{x}', '', 'Statistics'],
  ['bayes theorem|bayes', 'P(A \\mid B) = \\frac{P(B \\mid A)\\,P(A)}{P(B)}', '', 'Probability'],
  ['binomial probability|binomial distribution', 'P(X = k) = \\binom{n}{k}p^k(1-p)^{n-k}', '', 'Probability'],
  ['normal distribution', 'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}', '', 'Probability'],
  ['poisson distribution', 'P(X = k) = \\frac{\\lambda^k e^{-\\lambda}}{k!}', '', 'Probability'],
  ['combinations', '\\binom{n}{k} = \\frac{n!}{k!(n-k)!}', '', 'Probability'],
  ['permutations', 'P(n,k) = \\frac{n!}{(n-k)!}', '', 'Probability'],
  ['chi square|chi-square', '\\chi^2 = \\sum \\frac{(O - E)^2}{E}', '', 'Statistics'],
  // physics
  ['kinematics|kinematic equations|suvat', 'v = v_0 + at,\\quad x = x_0 + v_0t + \\tfrac{1}{2}at^2,\\quad v^2 = v_0^2 + 2a\\Delta x', '', 'Physics'],
  ['newtons second law|f=ma|newton second law', 'F = ma', '', 'Physics'],
  ['weight', 'W = mg', 'g ≈ 9.81 m/s²', 'Physics'],
  ['friction', 'f = \\mu N', '', 'Physics'],
  ['kinetic energy', 'KE = \\tfrac{1}{2}mv^2', '', 'Physics'],
  ['potential energy|gravitational potential energy', 'PE = mgh', '', 'Physics'],
  ['work', 'W = Fd\\cos\\theta', '', 'Physics'],
  ['power', 'P = \\frac{W}{t} = Fv', '', 'Physics'],
  ['momentum', 'p = mv', '', 'Physics'],
  ['impulse', 'J = F\\Delta t = \\Delta p', '', 'Physics'],
  ['centripetal acceleration|centripetal force', 'a_c = \\frac{v^2}{r},\\quad F_c = \\frac{mv^2}{r}', '', 'Physics'],
  ['universal gravitation|newtons law of gravitation|gravity', 'F = G\\frac{m_1 m_2}{r^2}', 'G = 6.674×10⁻¹¹ N·m²/kg²', 'Physics'],
  ['hookes law|spring force', 'F = -kx', '', 'Physics'],
  ['spring potential energy', 'U = \\tfrac{1}{2}kx^2', '', 'Physics'],
  ['period of a pendulum|pendulum', 'T = 2\\pi\\sqrt{\\frac{L}{g}}', '', 'Physics'],
  ['period of a spring|mass spring', 'T = 2\\pi\\sqrt{\\frac{m}{k}}', '', 'Physics'],
  ['torque', '\\tau = rF\\sin\\theta', '', 'Physics'],
  ['wave speed|wave equation', 'v = f\\lambda', '', 'Physics'],
  ['ohms law', 'V = IR', '', 'Electricity'],
  ['electric power', 'P = IV = I^2R = \\frac{V^2}{R}', '', 'Electricity'],
  ['coulombs law', 'F = k\\frac{q_1 q_2}{r^2}', 'k = 8.99×10⁹ N·m²/C²', 'Electricity'],
  ['capacitance', 'C = \\frac{Q}{V},\\quad C = \\varepsilon_0\\frac{A}{d}', '', 'Electricity'],
  ['resistors in series', 'R_{eq} = R_1 + R_2 + \\cdots', '', 'Electricity'],
  ['resistors in parallel', '\\frac{1}{R_{eq}} = \\frac{1}{R_1} + \\frac{1}{R_2} + \\cdots', '', 'Electricity'],
  ['faradays law', '\\mathcal{E} = -N\\frac{d\\Phi_B}{dt}', '', 'Electricity'],
  ['maxwells equations|maxwell', '\\nabla\\cdot\\mathbf{E} = \\frac{\\rho}{\\varepsilon_0},\\ \\nabla\\cdot\\mathbf{B} = 0,\\ \\nabla\\times\\mathbf{E} = -\\frac{\\partial\\mathbf{B}}{\\partial t},\\ \\nabla\\times\\mathbf{B} = \\mu_0\\mathbf{J} + \\mu_0\\varepsilon_0\\frac{\\partial\\mathbf{E}}{\\partial t}', '', 'Electricity'],
  ['snells law', 'n_1\\sin\\theta_1 = n_2\\sin\\theta_2', '', 'Optics'],
  ['lens equation|thin lens', '\\frac{1}{f} = \\frac{1}{d_o} + \\frac{1}{d_i}', '', 'Optics'],
  ['photon energy|planck', 'E = hf = \\frac{hc}{\\lambda}', 'h = 6.626×10⁻³⁴ J·s', 'Modern physics'],
  ['mass energy|e=mc2|einstein', 'E = mc^2', '', 'Modern physics'],
  ['de broglie wavelength|de broglie', '\\lambda = \\frac{h}{p}', '', 'Modern physics'],
  ['schrodinger equation|schrödinger equation', 'i\\hbar\\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi', '', 'Modern physics'],
  ['time dilation|lorentz factor', '\\Delta t = \\gamma\\Delta t_0,\\quad \\gamma = \\frac{1}{\\sqrt{1 - v^2/c^2}}', '', 'Modern physics'],
  ['first law of thermodynamics', '\\Delta U = Q - W', '', 'Thermodynamics'],
  ['heat|specific heat', 'Q = mc\\Delta T', '', 'Thermodynamics'],
  ['efficiency|carnot efficiency', '\\eta = 1 - \\frac{T_C}{T_H}', '', 'Thermodynamics'],
  ['bernoulli|bernoullis equation', 'P + \\tfrac{1}{2}\\rho v^2 + \\rho gh = \\text{constant}', '', 'Fluids'],
  ['density', '\\rho = \\frac{m}{V}', '', 'Fluids'],
  ['pressure', 'P = \\frac{F}{A}', '', 'Fluids'],
  ['buoyancy|archimedes', 'F_b = \\rho_{fluid} V g', '', 'Fluids'],
  // chemistry
  ['ideal gas law', 'PV = nRT', 'R = 8.314 J/(mol·K) = 0.08206 L·atm/(mol·K)', 'Chemistry'],
  ['combined gas law', '\\frac{P_1V_1}{T_1} = \\frac{P_2V_2}{T_2}', '', 'Chemistry'],
  ['molarity', 'M = \\frac{n}{V}', 'n: moles, V: liters', 'Chemistry'],
  ['dilution', 'M_1V_1 = M_2V_2', '', 'Chemistry'],
  ['ph', '\\mathrm{pH} = -\\log[\\mathrm{H^+}],\\quad \\mathrm{pH} + \\mathrm{pOH} = 14', '', 'Chemistry'],
  ['henderson hasselbalch|henderson-hasselbalch', '\\mathrm{pH} = \\mathrm{p}K_a + \\log\\frac{[\\mathrm{A^-}]}{[\\mathrm{HA}]}', '', 'Chemistry'],
  ['gibbs free energy|gibbs', '\\Delta G = \\Delta H - T\\Delta S', '', 'Chemistry'],
  ['arrhenius equation|arrhenius', 'k = Ae^{-E_a/RT}', '', 'Chemistry'],
  ['nernst equation|nernst', 'E = E^\\circ - \\frac{RT}{nF}\\ln Q', '', 'Chemistry'],
  ['rate law', '\\text{rate} = k[A]^m[B]^n', '', 'Chemistry'],
  ['half life|half-life', 'N = N_0\\left(\\tfrac{1}{2}\\right)^{t/t_{1/2}},\\quad t_{1/2} = \\frac{\\ln 2}{k}', '', 'Chemistry'],
  ['beer lambert|beer-lambert|beers law', 'A = \\varepsilon l c', '', 'Chemistry'],
  ['percent yield', '\\%\\text{ yield} = \\frac{\\text{actual}}{\\text{theoretical}}\\times 100', '', 'Chemistry'],
  // biology
  ['hardy weinberg|hardy-weinberg', 'p^2 + 2pq + q^2 = 1,\\quad p + q = 1', '', 'Biology'],
  ['population growth|logistic growth', '\\frac{dN}{dt} = rN\\left(1 - \\frac{N}{K}\\right)', '', 'Biology'],
  ['michaelis menten|michaelis-menten', 'v = \\frac{V_{max}[S]}{K_m + [S]}', '', 'Biology'],
  // finance & economics
  ['compound interest', 'A = P\\left(1 + \\frac{r}{n}\\right)^{nt}', '', 'Finance'],
  ['continuous compounding', 'A = Pe^{rt}', '', 'Finance'],
  ['simple interest', 'I = Prt', '', 'Finance'],
  ['present value', 'PV = \\frac{FV}{(1 + r)^n}', '', 'Finance'],
  ['loan payment|mortgage payment|amortization formula', 'M = P\\frac{r(1+r)^n}{(1+r)^n - 1}', 'r: monthly rate, n: number of payments', 'Finance'],
  ['annuity|future value of annuity', 'FV = PMT\\frac{(1+r)^n - 1}{r}', '', 'Finance'],
  ['npv|net present value', 'NPV = \\sum_{t=0}^{n}\\frac{C_t}{(1+r)^t}', '', 'Finance'],
  ['cagr', 'CAGR = \\left(\\frac{V_f}{V_i}\\right)^{1/t} - 1', '', 'Finance'],
  ['price elasticity|elasticity', 'E_d = \\frac{\\%\\Delta Q}{\\%\\Delta P}', '', 'Economics'],
  ['gdp', 'GDP = C + I + G + (X - M)', '', 'Economics'],
  // CS / info
  ['entropy|shannon entropy', 'H(X) = -\\sum_i p_i \\log_2 p_i', '', 'Computer science'],
  ['master theorem', 'T(n) = aT\\!\\left(\\frac{n}{b}\\right) + f(n)', '', 'Computer science'],
  ['softmax', '\\sigma(z)_i = \\frac{e^{z_i}}{\\sum_j e^{z_j}}', '', 'Computer science'],
  ['sigmoid', '\\sigma(x) = \\frac{1}{1 + e^{-x}}', '', 'Computer science'],
  ['cross entropy', 'L = -\\sum_i y_i\\log \\hat{y}_i', '', 'Computer science'],
];
const CALC = { 'quadratic formula': 'solve a x^2 + b x + c = 0 for x', 'kinetic energy': 'A 2 kg ball moves at 3 m/s. What is its kinetic energy?', 'compound interest': '$1000 at 5% compounded monthly for 10 years', 'ideal gas law': 'ideal gas P=1 atm V=22.4 L T=273 K', 'pythagorean theorem': 'A right triangle has legs 3 and 4. What is the hypotenuse?', 'ohms law': 'A circuit has a voltage of 12 V and a resistance of 4 ohms. What is the current?', 'dilution': 'dilution M1=2 V1=50 M2=0.5', 'z score': 'z score 85 mean 70 sd 10' };
function findFormula(q) { const s = q.toLowerCase().replace(/['’]/g, '').replace(/[^\w\s=-]/g, ' ').trim(); return F.find(f => f[0].split('|').some(n => s === n || s.includes(n))) ; }
function formula(ctx, q) {
  const f = findFormula(q);
  if (!f) return false;
  const name = f[0].split('|')[0];
  ctx.label('Formula'); ctx.input(`${K.cap(name)} (${f[3]})`);
  ctx.add({ title: K.cap(name), big: true, latex: f[1] });
  if (f[2]) ctx.add({ title: 'Where', text: f[2] });
  ctx.add({ title: 'LaTeX code', pre: f[1] });
  if (CALC[name]) ctx.add({ title: 'Try it', chips: [CALC[name]] });
  const same = F.filter(x => x[3] === f[3] && x !== f).slice(0, 8).map(x => `formula for ${x[0].split('|')[0]}`);
  ctx.add({ title: `More ${f[3]} formulas`, chips: [...same, `${f[3].toLowerCase()} formula sheet`] });
}
function formulaSheet(ctx, cat) {
  const c = cat.toLowerCase();
  const list = F.filter(f => f[3].toLowerCase().includes(c) || (c === 'math' && /algebra|geometry|trig|calculus/i.test(f[3])) || (c === 'physics' && /physics|electric|optics|thermo|fluids/i.test(f[3])));
  if (!list.length) return false;
  ctx.label('Formula sheet'); ctx.input(`${K.cap(cat)}: ${list.length} formulas`);
  for (const f of list) ctx.add({ title: K.cap(f[0].split('|')[0]), latex: f[1], note: f[2] || undefined });
  const tex = `\\documentclass[10pt]{article}\n\\usepackage[margin=0.6in]{geometry}\n\\usepackage{amsmath,amssymb,multicol}\n\\pagestyle{empty}\n\\begin{document}\n\\section*{${K.texEsc(K.cap(cat))} formula sheet}\n\\begin{multicols}{2}\n` + list.map(f => `\\textbf{${K.texEsc(K.cap(f[0].split('|')[0]))}}\\\\\n$\\displaystyle ${f[1]}$\\\\[4pt]`).join('\n') + '\n\\end{multicols}\n\\end{document}\n';
  ctx.add(K.texFilePod(`${c.replace(/\s+/g, '-')}-formulas.tex`, tex, 'Printable sheet'));
}

// ---------- reference tables ----------
const TABLES = {
  'derivative table|derivatives table|table of derivatives|common derivatives': [['f(x)', "f'(x)"], [['x^n', 'nx^{n-1}'], ['e^x', 'e^x'], ['a^x', 'a^x \\ln a'], ['\\ln x', '1/x'], ['\\log_a x', '\\frac{1}{x\\ln a}'], ['\\sin x', '\\cos x'], ['\\cos x', '-\\sin x'], ['\\tan x', '\\sec^2 x'], ['\\sec x', '\\sec x\\tan x'], ['\\csc x', '-\\csc x\\cot x'], ['\\cot x', '-\\csc^2 x'], ['\\arcsin x', '\\frac{1}{\\sqrt{1-x^2}}'], ['\\arccos x', '-\\frac{1}{\\sqrt{1-x^2}}'], ['\\arctan x', '\\frac{1}{1+x^2}'], ['\\sinh x', '\\cosh x'], ['\\cosh x', '\\sinh x']]],
  'integral table|integrals table|table of integrals|common integrals': [['f(x)', '\\int f(x)\\,dx'], [['x^n\\ (n\\neq -1)', '\\frac{x^{n+1}}{n+1} + C'], ['1/x', '\\ln|x| + C'], ['e^x', 'e^x + C'], ['a^x', '\\frac{a^x}{\\ln a} + C'], ['\\sin x', '-\\cos x + C'], ['\\cos x', '\\sin x + C'], ['\\sec^2 x', '\\tan x + C'], ['\\tan x', '-\\ln|\\cos x| + C'], ['\\frac{1}{1+x^2}', '\\arctan x + C'], ['\\frac{1}{\\sqrt{1-x^2}}', '\\arcsin x + C'], ['\\ln x', 'x\\ln x - x + C'], ['\\frac{1}{a^2+x^2}', '\\frac{1}{a}\\arctan\\frac{x}{a} + C']]],
  'trig identities|trigonometric identities': [['Identity', ''], [['\\sin^2\\theta + \\cos^2\\theta = 1', ''], ['1 + \\tan^2\\theta = \\sec^2\\theta', ''], ['1 + \\cot^2\\theta = \\csc^2\\theta', ''], ['\\sin 2\\theta = 2\\sin\\theta\\cos\\theta', ''], ['\\cos 2\\theta = 1 - 2\\sin^2\\theta = 2\\cos^2\\theta - 1', ''], ['\\tan 2\\theta = \\frac{2\\tan\\theta}{1-\\tan^2\\theta}', ''], ['\\sin^2\\theta = \\frac{1 - \\cos 2\\theta}{2}', ''], ['\\cos^2\\theta = \\frac{1 + \\cos 2\\theta}{2}', ''], ['\\sin(-\\theta) = -\\sin\\theta', ''], ['\\cos(-\\theta) = \\cos\\theta', '']]],
  'unit circle': [['Angle', '(cos, sin)'], [['0', '(1, 0)'], ['\\pi/6\\ (30°)', '(\\tfrac{\\sqrt3}{2}, \\tfrac12)'], ['\\pi/4\\ (45°)', '(\\tfrac{\\sqrt2}{2}, \\tfrac{\\sqrt2}{2})'], ['\\pi/3\\ (60°)', '(\\tfrac12, \\tfrac{\\sqrt3}{2})'], ['\\pi/2\\ (90°)', '(0, 1)'], ['2\\pi/3\\ (120°)', '(-\\tfrac12, \\tfrac{\\sqrt3}{2})'], ['3\\pi/4\\ (135°)', '(-\\tfrac{\\sqrt2}{2}, \\tfrac{\\sqrt2}{2})'], ['5\\pi/6\\ (150°)', '(-\\tfrac{\\sqrt3}{2}, \\tfrac12)'], ['\\pi\\ (180°)', '(-1, 0)'], ['7\\pi/6\\ (210°)', '(-\\tfrac{\\sqrt3}{2}, -\\tfrac12)'], ['5\\pi/4\\ (225°)', '(-\\tfrac{\\sqrt2}{2}, -\\tfrac{\\sqrt2}{2})'], ['4\\pi/3\\ (240°)', '(-\\tfrac12, -\\tfrac{\\sqrt3}{2})'], ['3\\pi/2\\ (270°)', '(0, -1)'], ['5\\pi/3\\ (300°)', '(\\tfrac12, -\\tfrac{\\sqrt3}{2})'], ['7\\pi/4\\ (315°)', '(\\tfrac{\\sqrt2}{2}, -\\tfrac{\\sqrt2}{2})'], ['11\\pi/6\\ (330°)', '(\\tfrac{\\sqrt3}{2}, -\\tfrac12)']]],
  'greek alphabet|greek letters': [['Letter', 'LaTeX'], ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega'].map(g => [`${SYM[g]}\\ ${SYM[K.cap(g)] || ''}`.replace(/\\ $/, ''), `\\verb|\\${g}|`])],
  'laplace transform table|laplace table': [['f(t)', 'F(s)'], [['1', '\\frac{1}{s}'], ['t^n', '\\frac{n!}{s^{n+1}}'], ['e^{at}', '\\frac{1}{s-a}'], ['\\sin bt', '\\frac{b}{s^2+b^2}'], ['\\cos bt', '\\frac{s}{s^2+b^2}'], ['e^{at}\\sin bt', '\\frac{b}{(s-a)^2+b^2}'], ['e^{at}\\cos bt', '\\frac{s-a}{(s-a)^2+b^2}'], ["f'(t)", 'sF(s) - f(0)'], ['u(t-a)', '\\frac{e^{-as}}{s}'], ['\\delta(t-a)', 'e^{-as}']]],
  'si prefixes|metric prefixes': [['Prefix', 'Factor'], [['tera (T)', '10^{12}'], ['giga (G)', '10^{9}'], ['mega (M)', '10^{6}'], ['kilo (k)', '10^{3}'], ['hecto (h)', '10^{2}'], ['deci (d)', '10^{-1}'], ['centi (c)', '10^{-2}'], ['milli (m)', '10^{-3}'], ['micro (\\mu)', '10^{-6}'], ['nano (n)', '10^{-9}'], ['pico (p)', '10^{-12}'], ['femto (f)', '10^{-15}']]],
};
function refTable(ctx, key) {
  const [head, rows] = TABLES[key];
  ctx.label('Reference'); ctx.input(K.cap(key.split('|')[0]));
  ctx.add({ title: K.cap(key.split('|')[0]), custom: (el) => { const t = document.createElement('table'); t.className = 'tbl'; const tr0 = document.createElement('tr'); head.forEach(x => { const th = document.createElement('th'); th.textContent = x; tr0.append(th); }); t.append(tr0); for (const r of rows) { const tr = document.createElement('tr'); for (const cell of r) { const td = document.createElement('td'); if (cell && !/^\\verb/.test(cell)) { try { window.katex.render(cell, td, { throwOnError: false }); } catch (_) { td.textContent = cell; } } else td.textContent = cell.replace(/^\\verb\|(.*)\|$/, '$1'); tr.append(td); } t.append(tr); } const w = document.createElement('div'); w.className = 'tbl-wrap'; w.append(t); el.append(w); } });
  const tex = `\\begin{tabular}{ll}\n\\hline\n${head.join(' & ')} \\\\\n\\hline\n${rows.map(r => r.map(c => (/^\\verb/.test(c) ? c : `$${c}$`)).join(' & ') + ' \\\\').join('\n')}\n\\hline\n\\end{tabular}`;
  ctx.add({ title: 'LaTeX', pre: tex });
}

// ---------- expressions → LaTeX ----------
function exprToLatex(ctx, expr) {
  const m = window.math;
  let tex;
  const T = (e) => m.parse(e.trim().replace(/\*\*/g, '^')).toTex({ parenthesis: 'auto', implicit: 'hide' });
  const v = (e) => ((/\b([a-z])\b/.exec(e.replace(/\b(?:sin|cos|tan|log|ln|exp|sqrt|pi|e)\b/g, '')) || [, 'x'])[1]);
  let k;
  try {
    if ((k = /^(?:the\s+)?(?:definite\s+)?integral\s+of\s+(.+?)(?:\s+d([a-z]))?\s+from\s+(\S+)\s+to\s+(\S+)$/i.exec(expr))) tex = `\\int_{${T(k[3])}}^{${T(k[4])}} ${T(k[1])}\\,d${k[2] || v(k[1])}`;
    else if ((k = /^(?:the\s+)?(?:indefinite\s+)?integral\s+of\s+(.+?)(?:\s+d([a-z]))?$/i.exec(expr))) tex = `\\int ${T(k[1])}\\,d${k[2] || v(k[1])}`;
    else if ((k = /^(?:the\s+)?derivative\s+of\s+(.+?)(?:\s+(?:with respect to|wrt)\s+([a-z]))?$/i.exec(expr))) tex = `\\frac{d}{d${k[2] || v(k[1])}}\\left(${T(k[1])}\\right)`;
    else if ((k = /^(?:the\s+)?limit\s+(?:of\s+)?(.+?)\s+as\s+([a-z])\s*(?:->|→|approaches|goes to|to)\s*(\S+)$/i.exec(expr))) tex = `\\lim_{${k[2]} \\to ${/^inf/i.test(k[3]) ? '\\infty' : T(k[3])}} ${T(k[1])}`;
    else if ((k = /^(?:the\s+)?sum\s+(?:of\s+)?(.+?)\s+(?:for|from)\s+([a-z])\s*=\s*(\S+)\s+to\s+(\S+)$/i.exec(expr))) tex = `\\sum_{${k[2]}=${T(k[3])}}^{${/^inf/i.test(k[4]) ? '\\infty' : T(k[4])}} ${T(k[1])}`;
    else if ((k = /^(?:the\s+)?(?:square root|sqrt)\s+of\s+(.+)$/i.exec(expr))) tex = `\\sqrt{${T(k[1])}}`;
    else tex = T(expr);
  } catch (e) { throw new Error(`I couldn’t read that expression: ${e.message}`); }
  ctx.label('LaTeX'); ctx.input(expr);
  ctx.add({ title: 'LaTeX', big: true, mono: true, text: tex });
  ctx.add({ title: 'Preview', latex: tex });
  ctx.add({ title: 'Inline / display', pre: `$${tex}$\n\n\\[ ${tex} \\]\n\n\\begin{equation}\n  ${tex}\n\\end{equation}` });
}
function renderLatex(ctx, tex) {
  ctx.label('LaTeX'); ctx.input('Rendered with KaTeX');
  ctx.add({ title: 'Preview', latex: tex });
  let mml = '';
  try { mml = window.katex.renderToString(tex, { output: 'mathml', throwOnError: false }).replace(/^<span class="katex">|<\/span>$/g, ''); } catch (_) {}
  ctx.add({ title: 'As Unicode text', text: latexToUnicode(tex) });
  if (mml) ctx.add({ title: 'MathML (for Word, web pages)', pre: mml, note: 'Paste MathML into Word with Ctrl+V; it becomes an editable equation.' });
  ctx.add(K.filesPod([{ label: 'HTML', name: 'equation.html', mime: 'text/html', data: `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">${window.katex.renderToString(tex, { displayMode: true, throwOnError: false })}` }, { label: '.tex', name: 'equation.tex', mime: 'application/x-tex', data: `\\[ ${tex} \\]` }]));
}

// pgfplots code for a function
function pgfplot(ctx, f, a = -5, b = 5) {
  const expr = f.replace(/\^/g, '^').replace(/\bsin\b/g, 'sin(deg(').replace(/\bcos\b/g, 'cos(deg(');
  const fixed = f.replace(/\b(sin|cos|tan)\s*\(([^()]+)\)/g, '$1(deg($2))').replace(/\b(sin|cos|tan)\s+x\b/g, '$1(deg(x))').replace(/e\^/g, 'exp(1)^');
  const tex = `\\documentclass{standalone}\n\\usepackage{pgfplots}\n\\pgfplotsset{compat=1.18}\n\\begin{document}\n\\begin{tikzpicture}\n\\begin{axis}[axis lines=middle, xlabel=$x$, ylabel=$y$, samples=200, domain=${a}:${b}, grid=major]\n  \\addplot[blue, thick] {${fixed}};\n\\end{axis}\n\\end{tikzpicture}\n\\end{document}\n`;
  ctx.label('LaTeX'); ctx.input(`pgfplots graph of y = ${f}`);
  ctx.add({ title: 'TikZ / pgfplots code', pre: tex, note: 'pgfplots works in degrees, so trig functions are wrapped in deg(…).' });
  ctx.add(K.texFilePod('plot.tex', tex));
  ctx.add({ title: 'See it now', chips: [`plot ${f} from ${a} to ${b}`] });
}

export const LATEX_RULES = [
  [/^(?:latex|tex)\s+(?:symbol\s+)?(?:for|of)\s+(?:the\s+)?(.+?)(?:\s+symbol|\s+sign)?$/i, (c, m) => (findFormula(m[1]) && !/symbol|sign/i.test(m[0]) ? formula(c, m[1]) : symbolLookup(c, m[1]))],
  [/^how (?:do i|to) (?:write|type|make)\s+(?:an?\s+|the\s+)?(.+?)\s+(?:in|using)\s+latex$/i, (c, m) => symbolLookup(c, m[1])],
  [/^(?:latex|tex)\s+(pmatrix|bmatrix|vmatrix|Bmatrix|matrix)?\s*(?:matrix\s+)?(\[\[[\s\S]+\]\])$/i, (c, m) => matrixLatex(c, m[2], m[1] || 'bmatrix')],
  [/^(?:latex|tex)\s+(article|homework|lab report|beamer|slides|presentation|resume|cv|letter|mla essay|essay|cheat sheet|thesis|poster|cover letter|exam|quiz)\s*(?:template|document)?$/i, (c, m) => texTemplate(c, ({ slides: 'beamer', presentation: 'beamer', cv: 'resume', essay: 'mla essay', quiz: 'exam' })[m[1].toLowerCase()] || m[1].toLowerCase())],
  [/^(?:latex\s+)?templates?\s+(?:for\s+)?latex$|^latex templates?$/i, (c) => { c.label('LaTeX'); c.add({ title: 'Templates', chips: Object.keys(TEX_TEMPLATES).map(k => `latex ${k} template`) }); }],
  [/^(?:latex|tex)\s+homework\s*(?:for|from|with)?\s*:\s*([\s\S]+)$/i, (c, m) => { const items = m[1].split(/\n+|\s*(?:^|\s)\d+[.)]\s+/).map(x => x.trim()).filter(Boolean); texTemplate(c, 'homework', items.map(K.texEsc)); }],
  [/^(?:latex|tex)\s+(?:table|tabular)\s*(?:from|of|for)?\s*:?\s*([\s\S]+)$/i, (c, m) => { const { head, rows } = K.parseTable(m[1]); const tex = K.toLatexTable(head, rows); c.label('LaTeX'); c.input(`${rows.length}-row table`); c.add({ title: 'Table', table: { head, rows } }); c.add({ title: 'LaTeX', pre: tex }); c.add(K.filesPod([{ label: '.tex', name: 'table.tex', mime: 'application/x-tex', data: tex }])); }],
  [/^(?:latex|tex)\s+(?:plot|graph|pgfplots|tikz)\s+(?:of\s+)?(?:y\s*=\s*)?(.+?)(?:\s+from\s+(-?[\d.]+)\s+to\s+(-?[\d.]+))?$/i, (c, m) => pgfplot(c, m[1], +(m[2] ?? -5), +(m[3] ?? 5))],
  [/^(?:latex|tex)\s+(?:chem(?:ical)?(?: equation)?|reaction|mhchem)\s*:?\s*(.+)$/i, (c, m) => { const code = `\\ce{${m[1].replace(/->|→/g, '->').replace(/<=>|⇌/g, '<=>')}}`; c.label('LaTeX'); c.input('Chemical equation with mhchem'); c.add({ title: 'Code', pre: `% \\usepackage[version=4]{mhchem}\n${code}` }); c.add({ title: 'Preview', latex: m[1].replace(/(\d+)/g, '_{$1}').replace(/->|→/g, '\\rightarrow ').replace(/<=>/g, '\\rightleftharpoons ') }); }],
  [/^(?:latex|tex)\s+(?:units?|siunitx)\s*:?\s*([\d.eE+-]+)\s*(.+)$/i, (c, m) => { c.label('LaTeX'); c.add({ title: 'siunitx', pre: `% \\usepackage{siunitx}\n\\SI{${m[1]}}{${m[2].trim().split(/\s*[*·]\s*|\s+/).map(u => u.replace(/^(\w+)\^(-?\d)$/, '\\$1\\tothe{$2}').replace(/^([a-zA-Z]+)$/, (x) => ({ m: '\\meter', s: '\\second', kg: '\\kilogram', g: '\\gram', N: '\\newton', J: '\\joule', W: '\\watt', K: '\\kelvin', mol: '\\mole', A: '\\ampere', V: '\\volt', Pa: '\\pascal', Hz: '\\hertz', L: '\\liter' })[x] || x)).join('\\per ').replace(/\\per \\per/g, '\\per')}}` }); }],
  [/^(?:latex|tex)\s+(?:system|align|equations?|cases|piecewise)\s*:?\s*(.+)$/i, (c, m) => { const parts = m[1].split(/\s*[;,]\s*/); const piece = /piecewise|cases/i.test(m[0]); const tex = piece ? `f(x) = \\begin{cases}\n${parts.map(p => { const [a, b] = p.split(/\s+if\s+/); return `  ${a} & \\text{if } ${b || ''}`; }).join(' \\\\\n')}\n\\end{cases}` : `\\begin{align}\n${parts.map(p => '  ' + p.replace('=', '&=')).join(' \\\\\n')}\n\\end{align}`; c.label('LaTeX'); c.add({ title: 'Code', pre: tex }); c.add({ title: 'Preview', latex: tex.replace(/\\begin\{align\}/, '\\begin{aligned}').replace(/\\end\{align\}/, '\\end{aligned}') }); }],
  [/^(?:render|preview|show|display)\s+(?:latex|tex|katex)?\s*:?\s*(\$?\$?[\s\S]*\\[\s\S]+)$/i, (c, m) => renderLatex(c, m[1].replace(/^\$+|\$+$/g, ''))],
  [/^(?:latex|tex)\s+to\s+(?:unicode|text|plain(?: text)?)\s*:?\s*([\s\S]+)$/i, (c, m) => { c.label('LaTeX'); c.add({ title: 'Unicode', big: true, text: latexToUnicode(m[1]) }); }],
  [/^(?:unicode|text)\s+to\s+(?:latex|tex)\s*:?\s*([\s\S]+)$/i, (c, m) => { const t = unicodeToLatex(m[1]); c.label('LaTeX'); c.add({ title: 'LaTeX', big: true, mono: true, text: t }); c.add({ title: 'Preview', latex: t }); }],
  [/^(?:latex|tex)\s+to\s+mathml\s*:?\s*([\s\S]+)$/i, (c, m) => renderLatex(c, m[1])],
  [/^(?:latex|tex|latexify|to latex)\s*(?:of|for|code for)?\s*:?\s*(.+)$/i, (c, m) => (/[\\{}]/.test(m[1]) ? renderLatex(c, m[1]) : exprToLatex(c, m[1]))],
  [/^(?:what(?:'s| is) the\s+)?(?:formula|equation)\s+(?:for|of)\s+(?:the\s+)?(.+)$/i, (c, m) => formula(c, m[1])],
  [/^(.+?)\s+(?:formula|equation)$/i, (c, m) => (findFormula(m[1]) ? formula(c, m[1]) : false)],
  [/^(.+?)\s+formula\s+sheet$|^formula\s+sheet\s+(?:for\s+)?(.+)$/i, (c, m) => formulaSheet(c, (m[1] || m[2]).trim())],
  [new RegExp(`^(?:show\\s+(?:me\\s+)?(?:a|the)?\\s*)?(${Object.keys(TABLES).join('|')})$`, 'i'), (c, m) => refTable(c, Object.keys(TABLES).find(k => k.split('|').includes(m[1].toLowerCase())))],
  [/^latex (?:cheat ?sheet|help|commands)$/i, (c) => { c.label('LaTeX'); c.add({ title: 'Common LaTeX', table: { head: ['What', 'Code'], rows: [['Fraction', '\\frac{a}{b}'], ['Power / index', 'x^{2}, x_{i}'], ['Root', '\\sqrt{x}, \\sqrt[3]{x}'], ['Sum', '\\sum_{i=1}^{n}'], ['Integral', '\\int_{a}^{b} f(x)\\,dx'], ['Limit', '\\lim_{x \\to 0}'], ['Vector', '\\vec{v}, \\mathbf{v}'], ['Text in math', '\\text{if } x > 0'], ['Bold', '\\textbf{bold}'], ['Italic', '\\textit{italic}'], ['List', '\\begin{itemize} \\item … \\end{itemize}'], ['Numbered', '\\begin{enumerate} \\item … \\end{enumerate}'], ['Figure', '\\includegraphics[width=0.5\\textwidth]{file}'], ['Citation', '\\cite{key}'], ['Reference', '\\label{eq:1} … \\eqref{eq:1}'], ['Align equations', '\\begin{align} a &= b \\\\ c &= d \\end{align}'], ['Matrix', '\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}'], ['Piecewise', '\\begin{cases} 1 & x>0 \\\\ 0 & \\text{else} \\end{cases}'], ['Spacing', '\\, \\; \\quad \\qquad'], ['Footnote', '\\footnote{text}']] } }); c.add({ title: 'More', chips: ['latex symbol for integral', 'greek alphabet', 'latex homework template', 'latex [[1,2],[3,4]]', 'latex x^2/3 + sqrt(x)'] }); }],
];
export const LATEX_FEATURES = ['LaTeX symbol lookup (~150 symbols by name)', 'Expression → LaTeX', 'Render/preview LaTeX + MathML + HTML', 'Matrices (pmatrix/bmatrix/…)', 'Tables → LaTeX tabular', '13 document templates + Open in Overleaf', 'Homework doc from a problem list', 'pgfplots graphs', 'Chemical equations (mhchem)', 'siunitx units', 'align/cases environments', 'LaTeX ⇄ Unicode', '140-formula library across 15 subjects', 'Printable formula sheets (.tex)', 'Reference tables: derivatives, integrals, trig, unit circle, Greek, Laplace, SI prefixes', 'LaTeX cheat sheet'];
