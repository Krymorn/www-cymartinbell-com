"""
Symbolic math engine for /tools.
Runs inside Pyodide (a Web Worker). Entry point: handle(json_string) -> json_string.
No AI involved: everything is computed with SymPy.
"""
import json, math, io, sys, ast, base64, re
import sympy as sp
from sympy import (S, Symbol, E, I, pi, oo, zoo, nan, log, sqrt, Abs, Eq, Matrix, latex, N,
                   Integral, Lambda, Poly, Integer, Rational)
from sympy.parsing.sympy_parser import (parse_expr, standard_transformations,
                                        implicit_multiplication_application, convert_xor)

TRANS = standard_transformations + (implicit_multiplication_application, convert_xor)
_x = Symbol('x')
LOCAL = {
    'e': E, 'i': I, 'pi': pi, 'oo': oo, 'inf': oo, 'infinity': oo, 'Infinity': oo,
    'ln': sp.log, 'arcsin': sp.asin, 'arccos': sp.acos, 'arctan': sp.atan,
    'arcsec': sp.asec, 'arccsc': sp.acsc, 'arccot': sp.acot,
    'log10': Lambda(_x, sp.log(_x, 10)), 'log2': Lambda(_x, sp.log(_x, 2)),
    'cbrt': sp.cbrt, 'abs': Abs, 'sgn': sp.sign, 'fact': sp.factorial,
    'C': sp.binomial, 'nCr': sp.binomial, 'gcd': sp.gcd, 'lcm': sp.lcm,
}

REPL = [('×', '*'), ('·', '*'), ('÷', '/'), ('−', '-'), ('√', 'sqrt'), ('∞', 'oo'),
        ('π', 'pi'), ('²', '^2'), ('³', '^3'), ('≤', '<='), ('≥', '>='), ('≠', '!='),
        ('θ', 'theta'), ('°', '*pi/180')]


def _factorials(s):
    """Turn 5! or (n+1)! into factorial(...) since the tokenizer rejects '!'."""
    i = 0
    while True:
        i = s.find('!', i)
        if i < 0:
            return s
        if i + 1 < len(s) and s[i + 1] == '=':
            i += 2
            continue
        j = i - 1
        while j >= 0 and s[j] == ' ':
            j -= 1
        if j < 0:
            return s
        if s[j] == ')':
            depth = 0
            k = j
            while k >= 0:
                if s[k] == ')':
                    depth += 1
                elif s[k] == '(':
                    depth -= 1
                    if depth == 0:
                        break
                k -= 1
            start = k
        else:
            k = j
            while k >= 0 and (s[k].isalnum() or s[k] in '._'):
                k -= 1
            start = k + 1
        if start < 0 or start > j:
            return s
        s = s[:start] + 'factorial(' + s[start:j + 1] + ')' + s[i + 1:]
        i = start


def pre(s):
    s = str(s).strip()
    for a, b in REPL:
        s = s.replace(a, b)
    if '!' in s:
        s = _factorials(s)
    return s


def P(s):
    s = pre(s)
    if not s:
        raise ValueError('empty expression')
    return parse_expr(s, local_dict=dict(LOCAL), transformations=TRANS)


def split_top(s, seps=(',',)):
    """Split on separators that are not inside brackets."""
    out, depth, cur = [], 0, ''
    i = 0
    while i < len(s):
        c = s[i]
        if c in '([{':
            depth += 1
        elif c in ')]}':
            depth -= 1
        hit = None
        if depth == 0:
            for sep in seps:
                if s.startswith(sep, i):
                    hit = sep
                    break
        if hit:
            out.append(cur)
            cur = ''
            i += len(hit)
            continue
        cur += c
        i += 1
    out.append(cur)
    return [p.strip() for p in out if p.strip()]


REL_OPS = ['<=', '>=', '!=', '==', '<', '>', '=']


def parse_rel(s):
    """Return ('rel', lhs, rhs, op) or ('expr', e)."""
    s = pre(s)
    depth = 0
    for i, c in enumerate(s):
        if c in '([{':
            depth += 1
        elif c in ')]}':
            depth -= 1
        elif depth == 0:
            for op in REL_OPS:
                if s.startswith(op, i):
                    return ('rel', P(s[:i]), P(s[i + len(op):]), op)
    return ('expr', P(s))


def mkrel(l, r, op):
    return {'=': Eq, '==': Eq, '<': sp.Lt, '>': sp.Gt, '<=': sp.Le, '>=': sp.Ge, '!=': sp.Ne}[op](l, r)


# ---------- output helpers ----------

def L(e):
    try:
        return latex(e)
    except Exception:
        return str(e)


def pod(title, e=None, tex=None, text=None, **kw):
    d = {'title': title}
    if e is not None:
        d['latex'] = L(e)
        d['text'] = sp.sstr(e)
    if tex is not None:
        d['latex'] = tex
    if text is not None:
        d['text'] = text
    d.update(kw)
    return d


def approx(e, digits=15):
    try:
        v = N(e, digits)
        return v
    except Exception:
        return None


def is_num(e):
    try:
        return bool(e.is_number)
    except Exception:
        return False


def same(a, b):
    try:
        return sp.srepr(a) == sp.srepr(b)
    except Exception:
        return False


def var_order(syms):
    pref = ['x', 'y', 'z', 't', 'u', 'v', 'w', 'n', 'k']
    return sorted(syms, key=lambda s: (pref.index(s.name) if s.name in pref else 99, s.name))


def free_vars(e):
    try:
        return var_order(list(e.free_symbols))
    except Exception:
        return []


def fnum(v):
    try:
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except Exception:
        return None


# ---------- plotting (sampled here, drawn in the browser) ----------

def make_fn(expr, v):
    try:
        f = sp.lambdify(v, expr, modules=['math', 'mpmath'])
    except Exception:
        f = None

    def g(x):
        try:
            if f is not None:
                y = f(x)
            else:
                y = expr.subs(v, x).evalf()
            if isinstance(y, complex):
                return y.real if abs(y.imag) < 1e-12 else None
            try:
                import mpmath
                if isinstance(y, mpmath.mpc):
                    return float(y.real) if abs(y.imag) < 1e-12 else None
            except Exception:
                pass
            return fnum(y)
        except Exception:
            return None
    return g


def sample(expr, v, a, b, n=600):
    g = make_fn(expr, v)
    xs, ys = [], []
    for k in range(n + 1):
        x = a + (b - a) * k / n
        xs.append(x)
        ys.append(g(x))
    return xs, ys, g


def numeric_roots(xs, ys, g, limit=12):
    roots = []
    for k in range(len(xs) - 1):
        y0, y1 = ys[k], ys[k + 1]
        if y0 is None or y1 is None:
            continue
        if y0 == 0:
            roots.append(xs[k])
            continue
        if (y0 < 0) != (y1 < 0):
            lo, hi, flo = xs[k], xs[k + 1], y0
            ok = True
            for _ in range(60):
                mid = (lo + hi) / 2
                fm = g(mid)
                if fm is None:
                    ok = False
                    break
                if (fm < 0) == (flo < 0):
                    lo, flo = mid, fm
                else:
                    hi = mid
            if ok:
                r = (lo + hi) / 2
                fr = g(r)
                # skip sign changes that are really asymptotes
                if fr is not None and abs(fr) < 1e-6 * max(1, abs(y0), abs(y1)):
                    roots.append(r)
        if len(roots) >= limit:
            break
    out = []
    for r in roots:
        if not out or abs(r - out[-1]) > 1e-7:
            out.append(r)
    return out


def auto_range(expr, v, real_roots=None):
    if real_roots:
        lo, hi = min(real_roots), max(real_roots)
        w = max(hi - lo, 2)
        return lo - 0.6 * w, hi + 0.6 * w
    if expr.has(sp.sin, sp.cos, sp.tan, sp.sec, sp.csc, sp.cot):
        return -2 * math.pi, 2 * math.pi
    if expr.has(sp.log):
        return 0.01, 10
    if expr.has(sp.exp) or isinstance(expr, sp.Pow) and not expr.base.has(v):
        return -4, 4
    return -10, 10


def plot2d(exprs, v, a=None, b=None, names=None, roots=None):
    traces = []
    if a is None or b is None:
        a, b = auto_range(exprs[0], v, roots)
    found = []
    for idx, ex in enumerate(exprs):
        xs, ys, g = sample(ex, v, a, b)
        traces.append({'name': (names[idx] if names else sp.sstr(ex)), 'x': xs, 'y': ys, 'text': sp.sstr(ex)})
        if idx == 0:
            found = numeric_roots(xs, ys, g)
    return {'kind': '2d', 'traces': traces, 'xlabel': v.name, 'roots': found}


def plot3d(expr, vx, vy, r=4, n=45):
    f = sp.lambdify((vx, vy), expr, modules=['math', 'mpmath'])
    xs = [-r + 2 * r * k / n for k in range(n + 1)]
    z = []
    for y in xs:
        row = []
        for x in xs:
            try:
                val = f(x, y)
                if isinstance(val, complex):
                    val = val.real if abs(val.imag) < 1e-12 else None
                row.append(fnum(val) if val is not None else None)
            except Exception:
                row.append(None)
        z.append(row)
    return {'kind': '3d', 'x': xs, 'y': xs, 'z': z, 'xlabel': vx.name, 'ylabel': vy.name}


def plot_pod(p, title='Plot'):
    return {'title': title, 'plot': p}


# ---------- step-by-step ----------

def dd(v):
    return r'\frac{d}{d%s}' % latex(v)


def deriv_steps(e, v, out=None, depth=0):
    if out is None:
        out = []
    if depth > 7 or len(out) > 30:
        return out
    D = dd(v)
    res = sp.diff(e, v)
    lhs = r'%s\left[%s\right]' % (D, L(e))
    if not e.has(v):
        out.append({'rule': 'Constant rule', 'latex': lhs + ' = 0'})
        return out
    if e == v:
        return out
    if e.is_Add:
        terms = ' + '.join(r'%s\left[%s\right]' % (D, L(t)) for t in e.args)
        out.append({'rule': 'Sum rule: differentiate each term', 'latex': lhs + ' = ' + terms})
        for t in e.args:
            deriv_steps(t, v, out, depth + 1)
        return out
    if e.is_Mul:
        c, rest = e.as_independent(v, as_Add=False)
        if c != 1:
            out.append({'rule': 'Constant multiple rule', 'latex': lhs + r' = %s \cdot %s\left[%s\right]' % (L(c), D, L(rest))})
            deriv_steps(rest, v, out, depth + 1)
            return out
        f = e.args[0]
        g = sp.Mul(*e.args[1:])
        out.append({'rule': "Product rule: (fg)' = f'g + fg'",
                    'latex': lhs + r' = %s\left[%s\right]\cdot %s + %s\cdot %s\left[%s\right]' % (D, L(f), L(g), L(f), D, L(g))})
        deriv_steps(f, v, out, depth + 1)
        deriv_steps(g, v, out, depth + 1)
        return out
    if e.is_Pow:
        b, n = e.args
        if not n.has(v):
            if b == v:
                out.append({'rule': 'Power rule', 'latex': lhs + ' = ' + L(res)})
            else:
                out.append({'rule': 'Power rule with the chain rule',
                            'latex': lhs + r' = %s\cdot %s^{%s}\cdot %s\left[%s\right]' % (L(n), '\\left(' + L(b) + '\\right)', L(n - 1), D, L(b))})
                deriv_steps(b, v, out, depth + 1)
            return out
        if not b.has(v):
            out.append({'rule': 'Exponential rule' + (' with the chain rule' if n != v else ''),
                        'latex': lhs + r' = %s\cdot\ln\left(%s\right)\cdot %s\left[%s\right]' % (L(e), L(b), D, L(n))})
            if n != v:
                deriv_steps(n, v, out, depth + 1)
            return out
        out.append({'rule': 'Logarithmic differentiation', 'latex': lhs + ' = ' + L(res)})
        return out
    if isinstance(e, sp.Function) and len(e.args) == 1:
        u = e.args[0]
        name = e.func.__name__
        outer = sp.diff(e.func(_x), _x).subs(_x, u)
        if u == v:
            out.append({'rule': 'Derivative of %s' % name, 'latex': lhs + ' = ' + L(res)})
        else:
            out.append({'rule': 'Chain rule (derivative of %s)' % name,
                        'latex': lhs + r' = %s\cdot %s\left[%s\right]' % (L(outer), D, L(u))})
            deriv_steps(u, v, out, depth + 1)
        return out
    out.append({'rule': 'Differentiate', 'latex': lhs + ' = ' + L(res)})
    return out


RULE_NAMES = {
    'ConstantRule': 'Constant rule', 'ConstantTimesRule': 'Pull out the constant',
    'PowerRule': 'Power rule', 'AddRule': 'Sum rule: integrate each term',
    'URule': 'u-substitution', 'PartsRule': 'Integration by parts',
    'CyclicPartsRule': 'Integration by parts (cyclic)', 'TrigRule': 'Standard trig integral',
    'ExpRule': 'Exponential rule', 'ReciprocalRule': 'Reciprocal rule (gives ln)',
    'ArctanRule': 'Arctangent rule', 'RewriteRule': 'Rewrite the integrand',
    'TrigSubstitutionRule': 'Trig substitution', 'PiecewiseRule': 'Piecewise',
    'DerivativeRule': 'Integral of a derivative', 'HeavisideRule': 'Heaviside',
    'SinRule': 'Integral of sin', 'CosRule': 'Integral of cos', 'SecTanRule': 'Integral of sec·tan',
    'Sec2Rule': 'Integral of sec²', 'Csc2Rule': 'Integral of csc²', 'CscCotRule': 'Integral of csc·cot',
    'NestedPowRule': 'Nested power rule', 'PartialFractionRule': 'Partial fractions',
}


def integral_steps_list(e, v):
    try:
        from sympy.integrals.manualintegrate import integral_steps
    except Exception:
        return []
    try:
        from sympy.integrals.manualintegrate import _manualintegrate
    except Exception:
        _manualintegrate = None
    try:
        root = integral_steps(e, v)
    except Exception:
        return []
    out = []

    def ev(node):
        try:
            return node.eval()
        except Exception:
            try:
                return _manualintegrate(node) if _manualintegrate else None
            except Exception:
                return None

    def kids(node):
        try:
            d = dict(vars(node))
        except TypeError:
            try:
                d = node._asdict()
            except Exception:
                d = {}
        res = []
        for k, val in d.items():
            if k == 'alternatives' and isinstance(val, (list, tuple)) and val:
                res.append(val[0])
            elif hasattr(val, 'integrand'):
                res.append(val)
            elif isinstance(val, (list, tuple)):
                res.extend(x for x in val if hasattr(x, 'integrand'))
        return res

    def walk(node, depth):
        if node is None or depth > 10 or len(out) > 30:
            return
        name = type(node).__name__
        if name in ('AlternativeRule',):
            for k in kids(node)[:1]:
                walk(k, depth)
            return
        if name == 'DontKnowRule':
            out.append({'rule': 'No elementary rule found', 'latex': r'\int %s\,d%s' % (L(node.integrand), L(node.variable))})
            return
        integ = getattr(node, 'integrand', None)
        var = getattr(node, 'variable', v)
        r = ev(node)
        if integ is not None:
            tex = r'\int %s\,d%s' % (L(integ), L(var))
            if r is not None:
                tex += ' = ' + L(r)
            extra = ''
            if name == 'URule':
                try:
                    extra = ' with u = ' + sp.sstr(node.u_func)
                except Exception:
                    pass
            if name == 'PartsRule':
                try:
                    extra = ' with u = %s, dv = %s d%s' % (sp.sstr(node.u), sp.sstr(node.dv), var)
                except Exception:
                    pass
            out.append({'rule': RULE_NAMES.get(name, re.sub(r'(?<!^)(?=[A-Z])', ' ', name.replace('Rule', '')).strip() or name) + extra, 'latex': tex})
        for k in kids(node):
            walk(k, depth + 1)

    walk(root, 0)
    return out


def quadratic_steps(eq_expr, v):
    try:
        p = Poly(eq_expr, v)
    except Exception:
        return None
    if p.degree() != 2:
        return None
    a, b, c = p.all_coeffs()
    disc = sp.simplify(b ** 2 - 4 * a * c)
    steps = [
        {'rule': 'Write in standard form ax² + bx + c = 0', 'latex': L(p.as_expr()) + ' = 0'},
        {'rule': 'Identify the coefficients', 'latex': r'a = %s,\quad b = %s,\quad c = %s' % (L(a), L(b), L(c))},
        {'rule': 'Compute the discriminant', 'latex': r'\Delta = b^2 - 4ac = %s' % L(disc)},
        {'rule': 'Apply the quadratic formula', 'latex': r'%s = \frac{-b \pm \sqrt{\Delta}}{2a} = \frac{%s \pm \sqrt{%s}}{%s}' % (L(v), L(-b), L(disc), L(2 * a))},
    ]
    sols = sp.solve(p.as_expr(), v)
    steps.append({'rule': 'Simplify', 'latex': r',\quad '.join('%s = %s' % (L(v), L(s)) for s in sols)})
    return steps


# ---------- number analysis ----------

def roman(n):
    vals = [(1000, 'M'), (900, 'CM'), (500, 'D'), (400, 'CD'), (100, 'C'), (90, 'XC'),
            (50, 'L'), (40, 'XL'), (10, 'X'), (9, 'IX'), (5, 'V'), (4, 'IV'), (1, 'I')]
    out = ''
    for v, s in vals:
        while n >= v:
            out += s
            n -= v
    return out


def number_pods(e, src_expr=None):
    pods = []
    if src_expr is not None and not same(src_expr, e):
        pods.append(pod('Input', src_expr))
    if e.is_Integer:
        n = int(e)
        pods.append(pod('Result', e))
        rows = []
        if abs(n) < 10 ** 60:
            if n > 1:
                f = sp.factorint(n)
                tex = r' \times '.join(('%d^{%d}' % (p, k) if k > 1 else str(p)) for p, k in sorted(f.items()))
                pods.append(pod('Prime factorization', tex=tex, text=' × '.join(('%d^%d' % (p, k) if k > 1 else str(p)) for p, k in sorted(f.items()))))
                rows.append(['Prime?', 'Yes' if sp.isprime(n) else 'No'])
            if 0 < n < 10 ** 13:
                ds = sp.divisors(n)
                rows.append(['Number of divisors', str(len(ds))])
                rows.append(['Sum of divisors', str(sum(ds))])
                if len(ds) <= 40:
                    rows.append(['Divisors', ', '.join(map(str, ds))])
        rows.append(['Binary', bin(n)])
        rows.append(['Hexadecimal', hex(n)])
        rows.append(['Octal', oct(n)])
        if 0 < n < 4000:
            rows.append(['Roman numerals', roman(n)])
        rows.append(['Digit sum', str(sum(int(c) for c in str(abs(n))))])
        rows.append(['Number of digits', str(len(str(abs(n))))])
        if 0 <= n <= 170:
            rows.append(['Factorial (n!)', sp.sstr(sp.factorial(n)) if n <= 25 else '%.6e' % float(sp.factorial(n))])
        if n > 0:
            try:
                rows.append(['Next prime', str(sp.nextprime(n))])
                if n > 2:
                    rows.append(['Previous prime', str(sp.prevprime(n))])
            except Exception:
                pass
        pods.append({'title': 'Properties', 'table': rows})
        return pods
    if e.is_Rational:
        pods.append(pod('Exact result', e))
        pods.append(pod('Decimal', text=str(N(e, 40)), tex=None))
        pnum, q = int(e.p), int(e.q)
        if abs(pnum) > q:
            w = int(pnum / q)
            r = abs(pnum - w * q)
            pods.append(pod('Mixed number', tex=r'%d\tfrac{%d}{%d}' % (w, r, q), text='%d %d/%d' % (w, r, q)))
        return pods
    simp = e
    try:
        simp = sp.nsimplify(e) if e.is_Float else sp.simplify(e)
    except Exception:
        pass
    if simp.is_real is False or (simp.has(I) and not simp.is_real):
        pods.append(pod('Result', simp))
        try:
            re_, im_ = simp.as_real_imag()
            pods.append(pod('Rectangular form', re_ + im_ * I))
            pods.append(pod('Polar form', tex=r'%s \, e^{%s i}' % (L(sp.simplify(Abs(simp))), L(sp.simplify(sp.arg(simp)))),
                            text='%s * exp(%s*I)' % (sp.sstr(sp.simplify(Abs(simp))), sp.sstr(sp.simplify(sp.arg(simp))))))
            pods.append(pod('Decimal', text=sp.sstr(N(simp, 20))))
        except Exception:
            pass
        return pods
    pods.append(pod('Exact result', simp))
    d = approx(simp, 50)
    if d is not None:
        pods.append(pod('Decimal', text=str(d)))
    return pods


# ---------- operations ----------

def op_auto(req):
    src = req['expr']
    kind = parse_rel(src)
    if kind[0] == 'rel':
        return op_solve({'expr': src})
    e0 = kind[1]
    if isinstance(e0, (list, tuple)):
        return op_matrix(e0)
    if isinstance(e0, sp.MatrixBase):
        return op_matrix(e0.tolist())
    if is_num(e0):
        e = sp.simplify(e0) if not e0.is_Integer else e0
        try:
            e = e0.doit()
        except Exception:
            e = e0
        return {'input': L(e0), 'pods': number_pods(e, e0)}
    vs = free_vars(e0)
    pods = [pod('Input', e0)]
    if len(vs) == 1:
        v = vs[0]
        roots_exact = None
        try:
            if e0.is_polynomial(v):
                p = Poly(e0, v)
                if p.degree() <= 4:
                    roots_exact = sp.solve(e0, v)
                else:
                    roots_exact = p.nroots(n=12)
        except Exception:
            roots_exact = None
        real_roots = []
        if roots_exact:
            for r in roots_exact:
                c = complex(N(r))
                if abs(c.imag) < 1e-12:
                    real_roots.append(c.real)
        pl = plot2d([e0], v, roots=real_roots or None)
        pods.append(plot_pod(pl))
        for title, fn in (('Simplified', sp.simplify), ('Expanded', sp.expand), ('Factored', sp.factor)):
            try:
                r = fn(e0)
                if not same(r, e0) and not any(same(r, sp.sympify(q.get('text', '0'))) for q in pods if 'text' in q and q['title'] in ('Simplified', 'Expanded', 'Factored')):
                    pods.append(pod(title, r))
            except Exception:
                pass
        try:
            if e0.is_rational_function(v):
                r = sp.apart(e0, v)
                if not same(r, e0) and len(sp.Add.make_args(r)) > 1:
                    pods.append(pod('Partial fractions', r))
        except Exception:
            pass
        if roots_exact is not None:
            if roots_exact:
                pods.append(pod('Roots', tex=r',\quad '.join('%s = %s' % (L(v), L(r)) for r in roots_exact),
                                text=', '.join('%s = %s' % (v, sp.sstr(r)) for r in roots_exact)))
            else:
                pods.append(pod('Roots', text='No roots'))
        elif pl['roots']:
            pods.append(pod('Real roots (numeric, in plotted range)', text=', '.join('%s ≈ %.10g' % (v, r) for r in pl['roots'])))
        try:
            d = sp.diff(e0, v)
            pods.append(pod('Derivative', tex=r'\frac{d}{d%s}\left[%s\right] = %s' % (L(v), L(e0), L(sp.simplify(d))), text=sp.sstr(sp.simplify(d)),
                            steps=deriv_steps(e0, v)))
        except Exception:
            pass
        try:
            from sympy.integrals.manualintegrate import manualintegrate
            F = manualintegrate(e0, v)
            if not F.has(Integral):
                Fd = nice(F, v)
                pods.append(pod('Indefinite integral', tex=r'\int %s\,d%s = %s + C' % (L(e0), L(v), L(Fd)), text=sp.sstr(Fd) + ' + C',
                                steps=integral_steps_list(e0, v)))
        except Exception:
            pass
        try:
            if e0.is_polynomial(v) is False or Poly(e0, v).degree() > 6:
                s = sp.series(e0, v, 0, 6)
                if not s.has(sp.Order) or len(s.args) > 1:
                    pods.append(pod('Series expansion at %s = 0' % v, s))
        except Exception:
            pass
        for side, val in (('+∞', oo), ('−∞', -oo)):
            try:
                lim = sp.limit(e0, v, val)
                if lim.is_finite or lim in (oo, -oo):
                    pods.append(pod('Limit as %s → %s' % (v, side), lim))
            except Exception:
                pass
    elif len(vs) == 2:
        a, b = vs
        try:
            pods.append(plot_pod(plot3d(e0, a, b), '3D plot'))
        except Exception:
            pass
        for title, fn in (('Simplified', sp.simplify), ('Expanded', sp.expand), ('Factored', sp.factor)):
            try:
                r = fn(e0)
                if not same(r, e0):
                    pods.append(pod(title, r))
            except Exception:
                pass
        for v in vs:
            try:
                pods.append(pod('Partial derivative ∂/∂%s' % v, tex=r'\frac{\partial}{\partial %s} = %s' % (L(v), L(sp.simplify(sp.diff(e0, v)))), text=sp.sstr(sp.diff(e0, v))))
            except Exception:
                pass
    else:
        for title, fn in (('Simplified', sp.simplify), ('Expanded', sp.expand), ('Factored', sp.factor)):
            try:
                r = fn(e0)
                if not same(r, e0):
                    pods.append(pod(title, r))
            except Exception:
                pass
    return {'input': L(e0), 'pods': pods}


def parse_vars(s):
    if not s:
        return None
    return [Symbol(t.strip()) for t in re.split(r'[,\s]+', s) if t.strip()]


def op_solve(req):
    src = req['expr']
    parts = split_top(re.sub(r'\s+and\s+', ',', src), seps=(',', ';'))
    rels = []
    for p in parts:
        k = parse_rel(p)
        rels.append(mkrel(k[1], k[2], k[3]) if k[0] == 'rel' else Eq(k[1], 0))
    allsyms = set()
    for r in rels:
        allsyms |= r.free_symbols
    vs = parse_vars(req.get('vars')) or var_order(list(allsyms))
    pods = [pod('Input', tex=r',\quad '.join(L(r) for r in rels), text='; '.join(sp.sstr(r) for r in rels))]
    inequality = any(not isinstance(r, sp.Equality) for r in rels)
    if inequality:
        try:
            sol = sp.reduce_inequalities(rels, vs[0])
            pods.append(pod('Solution', sol))
            try:
                pods.append(pod('Interval notation', sp.solveset(rels[0], vs[0], S.Reals) if len(rels) == 1 else sol.as_set()))
            except Exception:
                pass
        except Exception as ex:
            pods.append(pod('Solution', text='Could not solve: %s' % ex))
        return {'input': pods[0]['latex'], 'pods': pods}
    if len(rels) == 1 and len(vs) >= 1:
        v = vs[0]
        expr = rels[0].lhs - rels[0].rhs
        sols = []
        try:
            sols = sp.solve(rels[0], v)
        except Exception:
            sols = []
        if sols:
            real = [s for s in sols if s.is_real is not False]
            cplx = [s for s in sols if s.is_real is False]
            if real:
                pods.append(pod('Real solutions' if cplx else 'Solutions', tex=r',\quad '.join('%s = %s' % (L(v), L(s)) for s in real),
                                text=', '.join('%s = %s' % (v, sp.sstr(s)) for s in real)))
            if cplx:
                pods.append(pod('Complex solutions', tex=r',\quad '.join('%s = %s' % (L(v), L(s)) for s in cplx),
                                text=', '.join('%s = %s' % (v, sp.sstr(s)) for s in cplx)))
            decs = []
            for s in sols:
                a = approx(s, 12)
                if a is not None and not same(a, s):
                    decs.append('%s ≈ %s' % (v, sp.sstr(a)))
            if decs:
                pods.append(pod('Decimal approximations', text=', '.join(decs)))
            qs = quadratic_steps(expr, v)
            if not qs and 'linear_steps' in globals():
                try:
                    qs = globals()['linear_steps'](rels[0], v)
                except Exception:
                    qs = None
            if qs:
                pods[-1 if not decs else -2]['steps'] = qs
        if len(free_vars(expr)) == 1:
            sides = [rels[0].lhs, rels[0].rhs]
            names = ['left side', 'right side']
            real_roots = []
            for s in sols:
                a = fnum(approx(s)) if s.is_real is not False else None
                if a is not None:
                    real_roots.append(a)
            if all(is_num(sd) for sd in sides[1:]) and rels[0].rhs == 0:
                pl = plot2d([sides[0]], v, roots=real_roots or None, names=[sp.sstr(sides[0])])
            else:
                pl = plot2d(sides, v, roots=real_roots or None, names=names)
                pl['roots'] = []
            pods.append(plot_pod(pl))
            if not sols:
                xs, ys, g = sample(expr, v, -50, 50, 4000)
                nr = numeric_roots(xs, ys, g)
                pods.append(pod('Numeric solutions (−50 to 50)', text=', '.join('%s ≈ %.12g' % (v, r) for r in nr) if nr else 'None found in range'))
        return {'input': pods[0]['latex'], 'pods': pods}
    try:
        sols = sp.solve(rels, vs, dict=True)
        if not sols:
            pods.append(pod('Solution', text='No solution'))
        for k, sd in enumerate(sols):
            pods.append(pod('Solution' + (' %d' % (k + 1) if len(sols) > 1 else ''), tex=r',\quad '.join('%s = %s' % (L(a), L(b)) for a, b in sd.items()),
                            text=', '.join('%s = %s' % (a, sp.sstr(b)) for a, b in sd.items())))
    except Exception as ex:
        pods.append(pod('Solution', text='Could not solve: %s' % ex))
    return {'input': pods[0]['latex'], 'pods': pods}


def nice(F, v):
    try:
        if F.is_polynomial(v):
            return sp.expand(F)
    except Exception:
        pass
    return sp.simplify(F)


def pick_var(e, name=None):
    if name:
        return Symbol(name)
    vs = free_vars(e)
    return vs[0] if vs else Symbol('x')


def op_integrate(req):
    e = P(req['expr'])
    v = pick_var(e, req.get('var'))
    a, b = req.get('a'), req.get('b')
    pods = []
    if a not in (None, '') and b not in (None, ''):
        A, B = P(a), P(b)
        I_ = Integral(e, (v, A, B))
        pods.append(pod('Definite integral', I_))
        res = sp.integrate(e, (v, A, B))
        if res.has(Integral):
            val = approx(I_.evalf(), 20)
            pods.append(pod('Numeric value', text=str(val)))
        else:
            pods.append(pod('Result', tex=L(I_) + ' = ' + L(sp.simplify(res)), text=sp.sstr(sp.simplify(res))))
            d = approx(res, 20)
            if d is not None and not same(d, res):
                pods.append(pod('Decimal', text=str(d)))
        F = None
        try:
            from sympy.integrals.manualintegrate import manualintegrate
            F = manualintegrate(e, v)
        except Exception:
            pass
        if F is not None and not F.has(Integral):
            pods.append(pod('Antiderivative used', tex=r'\int %s\,d%s = %s + C' % (L(e), L(v), L(F)), steps=integral_steps_list(e, v)))
        if len(free_vars(e)) <= 1:
            try:
                fa, fb = float(N(A)), float(N(B))
                if all(map(math.isfinite, (fa, fb))):
                    pad = (fb - fa) * 0.25 or 1
                    pl = plot2d([e], v, fa - pad, fb + pad)
                    pl['shade'] = [fa, fb]
                    pl['roots'] = []
                    pods.insert(1, plot_pod(pl, 'Area under the curve'))
            except Exception:
                pass
    else:
        I_ = Integral(e, v)
        pods.append(pod('Integral', I_))
        steps = integral_steps_list(e, v)
        res = sp.integrate(e, v)
        if res.has(Integral):
            pods.append(pod('Result', text='No closed form found.'))
        else:
            simp = nice(res, v)
            pods.append(pod('Result', tex=L(I_) + ' = ' + L(simp) + ' + C', text=sp.sstr(simp) + ' + C', steps=steps))
            if len(free_vars(e)) == 1:
                pods.append(plot_pod(plot2d([e, simp], v, names=['f(%s)' % v, 'antiderivative']), 'Plot'))
    return {'input': pods[0]['latex'], 'pods': pods}


def op_diff(req):
    e = P(req['expr'])
    v = pick_var(e, req.get('var'))
    n = int(req.get('n') or 1)
    d = sp.diff(e, v, n)
    simp = sp.simplify(d)
    lhs = r'\frac{d%s}{d%s%s}\left[%s\right]' % ('^{%d}' % n if n > 1 else '', L(v), '^{%d}' % n if n > 1 else '', L(e))
    pods = [pod('Input', tex=lhs, text='d^%d/d%s^%d %s' % (n, v, n, sp.sstr(e)))]
    pods.append(pod('Result', tex=lhs + ' = ' + L(simp), text=sp.sstr(simp), steps=deriv_steps(e, v) if n == 1 else None))
    if not same(sp.expand(d), simp):
        pods.append(pod('Expanded', sp.expand(d)))
    if len(free_vars(e)) == 1:
        pods.append(plot_pod(plot2d([e, simp], v, names=['f(%s)' % v, "derivative"])))
    return {'input': lhs, 'pods': [p for p in pods if p]}


def op_limit(req):
    e = P(req['expr'])
    v = pick_var(e, req.get('var'))
    pt = P(req.get('point') or '0')
    dr = req.get('dir') or '+-'
    if dr == '+-':
        try:
            lp = sp.limit(e, v, pt, '+')
            lm = sp.limit(e, v, pt, '-')
        except Exception:
            lp = lm = sp.limit(e, v, pt)
        res = lp if lp == lm else None
    else:
        res = sp.limit(e, v, pt, dr)
        lp = lm = res
    tex = r'\lim_{%s \to %s%s} %s' % (L(v), L(pt), '^{%s}' % dr if dr in '+-' and dr != '+-' else '', L(e))
    pods = [pod('Input', tex=tex)]
    if res is not None:
        pods.append(pod('Result', tex=tex + ' = ' + L(res), text=sp.sstr(res)))
    else:
        pods.append(pod('Result', text='The limit does not exist: the two sides disagree.'))
        pods.append(pod('From the right', lp))
        pods.append(pod('From the left', lm))
    if len(free_vars(e)) == 1 and pt.is_finite:
        c = float(N(pt))
        pl = plot2d([e], v, c - 4, c + 4)
        pl['roots'] = []
        pods.append(plot_pod(pl))
    return {'input': tex, 'pods': pods}


def op_series(req):
    e = P(req['expr'])
    v = pick_var(e, req.get('var'))
    pt = P(req.get('point') or '0')
    n = int(req.get('n') or 6)
    s = sp.series(e, v, pt, n)
    pods = [pod('Input', e), pod('Series expansion at %s = %s' % (v, sp.sstr(pt)), s)]
    poly = s.removeO()
    if len(free_vars(e)) == 1:
        c = float(N(pt))
        pods.append(plot_pod(plot2d([e, poly], v, c - 3, c + 3, names=['function', 'approximation'])))
    return {'input': L(e), 'pods': pods}


def op_transform(req):
    kind = req['kind']
    e = P(req['expr'])
    fn = {'factor': sp.factor, 'expand': sp.expand, 'simplify': sp.simplify, 'apart': sp.apart,
          'together': sp.together, 'trigsimp': sp.trigsimp, 'expand_trig': sp.expand_trig,
          'cancel': sp.cancel, 'rationalize': sp.radsimp}[kind]
    r = fn(e)
    names = {'factor': 'Factored', 'expand': 'Expanded', 'simplify': 'Simplified', 'apart': 'Partial fractions',
             'together': 'Combined', 'trigsimp': 'Simplified', 'expand_trig': 'Expanded', 'cancel': 'Cancelled', 'rationalize': 'Rationalized'}
    pods = [pod('Input', e), pod(names[kind], r)]
    if kind == 'factor' and e.is_Integer:
        pods = number_pods(e)
    return {'input': L(e), 'pods': pods}


def op_sum(req):
    e = P(req['expr'])
    v = Symbol(req.get('var') or 'n')
    a, b = P(req['a']), P(req['b'])
    f = sp.Product if req.get('prod') else sp.Sum
    s = f(e, (v, a, b))
    r = s.doit()
    pods = [pod('Input', s)]
    if r.has(sp.Sum) or r.has(sp.Product):
        pods.append(pod('Numeric value', text=str(approx(s.evalf(), 20))))
    else:
        pods.append(pod('Result', tex=L(s) + ' = ' + L(sp.simplify(r)), text=sp.sstr(sp.simplify(r))))
        d = approx(r, 20)
        if d is not None and not same(d, r) and is_num(r):
            pods.append(pod('Decimal', text=str(d)))
    try:
        if not req.get('prod') and b == oo:
            conv = s.is_convergent()
            pods.append(pod('Convergence', text='Converges' if conv else 'Diverges'))
    except Exception:
        pass
    return {'input': L(s), 'pods': pods}


def op_plot(req):
    exprs = [P(x) for x in req['exprs']]
    vs = set()
    for e in exprs:
        vs |= e.free_symbols
    vs = var_order(list(vs))
    if req.get('var'):
        vs = [Symbol(req['var'])] + [s for s in vs if s.name != req['var']]
    if len(vs) >= 2 and len(exprs) == 1:
        return {'input': L(exprs[0]), 'pods': [pod('Input', exprs[0]), plot_pod(plot3d(exprs[0], vs[0], vs[1]), '3D plot')]}
    v = vs[0] if vs else Symbol('x')
    a = float(N(P(req['a']))) if req.get('a') else None
    b = float(N(P(req['b']))) if req.get('b') else None
    pl = plot2d(exprs, v, a, b, names=[sp.sstr(e) for e in exprs])
    pods = [pod('Input', tex=r',\quad '.join(L(e) for e in exprs)), plot_pod(pl)]
    if pl['roots'] and len(exprs) == 1:
        pods.append(pod('Real roots in this range', text=', '.join('%s ≈ %.10g' % (v, r) for r in pl['roots'])))
    return {'input': pods[0]['latex'], 'pods': pods}


def op_matrix(rows):
    M = Matrix(rows)
    pods = [pod('Matrix', M)]
    rows_ = []
    rows_.append(['Size', '%d × %d' % M.shape])
    rows_.append(['Rank', str(M.rank())])
    pods.append({'title': 'Properties', 'table': rows_})
    if M.is_square:
        det = sp.simplify(M.det())
        pods.append(pod('Determinant', det))
        if det != 0:
            pods.append(pod('Inverse', sp.simplify(M.inv())))
        else:
            pods.append(pod('Inverse', text='Not invertible (determinant is 0)'))
        if M.shape[0] <= 4:
            try:
                ev = M.eigenvals()
                pods.append(pod('Eigenvalues', tex=r',\quad '.join(r'\lambda = %s%s' % (L(k), r'\ (\times %d)' % m if m > 1 else '') for k, m in ev.items()),
                                text=', '.join('%s (x%d)' % (sp.sstr(k), m) for k, m in ev.items())))
                vecs = M.eigenvects()
                pods.append(pod('Eigenvectors', tex=r',\quad '.join(r'\lambda=%s:\ %s' % (L(val), ', '.join(L(vv.T) for vv in vs)) for val, m, vs in vecs)))
            except Exception:
                pass
            lam = Symbol('lambda')
            pods.append(pod('Characteristic polynomial', sp.factor(M.charpoly(lam).as_expr())))
        pods.append(pod('Trace', M.trace()))
    pods.append(pod('Transpose', M.T))
    pods.append(pod('Reduced row echelon form', M.rref()[0]))
    return {'input': L(M), 'pods': pods}


# ---------- differential equations ----------

def _ode_prep(src, fn='y'):
    """Turn y'' + y = 0 / dy/dx = x*y into SymPy syntax. Returns (string, independent var name)."""
    s = pre(src)
    var = 't' if re.search(r'\bt\b', s) and not re.search(r'\bx\b', s) else 'x'
    m = re.search(r'd\s*' + fn + r'\s*/\s*d\s*([a-z])', s)
    if m:
        var = m.group(1)
    toks = {}
    def tok(n):
        k = '__D%d__' % n
        toks[k] = 'Derivative(%s(%s),%s,%d)' % (fn, var, var, n)
        return k
    s = re.sub(r'd\^?(\d)\s*' + fn + r'\s*/\s*d\s*[a-z]\s*\^?\s*\d', lambda m: tok(int(m.group(1))), s)
    s = re.sub(r'd\s*' + fn + r'\s*/\s*d\s*[a-z]', lambda m: tok(1), s)
    s = re.sub(r"(?<![A-Za-z_])" + fn + r"('+)", lambda m: tok(len(m.group(1))), s)
    s = re.sub(r"(?<![A-Za-z_])" + fn + r"(?![A-Za-z_(])", '%s(%s)' % (fn, var), s)
    for k, v in toks.items():
        s = s.replace(k, v)
    return s, var


def op_ode(req):
    src = req['expr']
    fn = 'y'
    parts = split_top(src, seps=(',', ';', ' with ', ' where '))
    eq_parts, ic_parts = [], []
    for p in parts:
        (ic_parts if re.match(r"^\s*" + fn + r"'*\s*\(\s*[-\d.]+\s*\)\s*=", p) else eq_parts).append(p)
    eq_src = eq_parts[0]
    s, var = _ode_prep(eq_src, fn)
    X = Symbol(var)
    Y = sp.Function(fn)
    loc = dict(LOCAL); loc.update({fn: Y, var: X, 'Derivative': sp.Derivative})
    if '=' in s:
        l, r = s.split('=', 1)
        eq = Eq(parse_expr(l, local_dict=loc, transformations=TRANS), parse_expr(r, local_dict=loc, transformations=TRANS))
    else:
        eq = Eq(parse_expr(s, local_dict=loc, transformations=TRANS), 0)
    ics = {}
    for p in ic_parts:
        m = re.match(r"^\s*" + fn + r"('*)\s*\(\s*([-\d.]+)\s*\)\s*=\s*(.+)$", p)
        if m:
            n, at, val = len(m.group(1)), P(m.group(2)), P(m.group(3))
            key = Y(at) if n == 0 else Y(X).diff(X, n).subs(X, at)
            ics[key] = val
    sol = sp.dsolve(eq, Y(X), ics=ics or None)
    sols = sol if isinstance(sol, list) else [sol]
    pods = [pod('Differential equation', tex=L(eq) + (r',\quad ' + r',\quad '.join('%s = %s' % (L(k), L(v)) for k, v in ics.items()) if ics else ''))]
    try:
        kind = sp.classify_ode(eq, Y(X))[0].replace('_', ' ')
        pods.append(pod('Type', text=kind))
    except Exception:
        pass
    for k, so in enumerate(sols):
        pods.append(pod('Solution' if len(sols) == 1 else 'Solution %d' % (k + 1), so, note=None if ics else 'C1, C2, … are arbitrary constants. Add initial conditions like y(0)=1 to pin them down.'))
    if ics and len(sols) == 1 and not sols[0].rhs.free_symbols - {X}:
        pods.append(plot_pod(plot2d([sols[0].rhs], X, -5, 5, names=['%s(%s)' % (fn, var)]), 'Plot of the solution'))
    try:
        ok = sp.checkodesol(eq, sols[0])
        pods.append(pod('Check', text='Verified: substituting the solution back satisfies the equation.' if ok[0] else 'Could not verify symbolically.'))
    except Exception:
        pass
    return {'input': pods[0]['latex'], 'pods': pods}


def op_integral_transform(req):
    kind = req['kind']
    e = P(req['expr'])
    if kind == 'laplace':
        t = pick_var(e, req.get('var') or ('t' if Symbol('t') in e.free_symbols else None))
        s_ = Symbol('s')
        r = sp.laplace_transform(e, t, s_, noconds=True)
        tex = r'\mathcal{L}\left\{%s\right\}(s) = %s' % (L(e), L(sp.simplify(r)))
    elif kind == 'inverse laplace':
        s_ = Symbol('s')
        t = Symbol('t', positive=True)
        r = sp.inverse_laplace_transform(e, s_, t)
        tex = r'\mathcal{L}^{-1}\left\{%s\right\}(t) = %s' % (L(e), L(sp.simplify(r)))
    elif kind == 'fourier':
        x = pick_var(e, req.get('var'))
        k = Symbol('k')
        r = sp.fourier_transform(e, x, k)
        tex = r'\mathcal{F}\left\{%s\right\}(k) = %s' % (L(e), L(sp.simplify(r)))
    else:
        x = pick_var(e, req.get('var'))
        k = Symbol('k')
        r = sp.inverse_fourier_transform(e, k if Symbol('k') in e.free_symbols else x, x if Symbol('k') in e.free_symbols else Symbol('t'))
        tex = r'\mathcal{F}^{-1}\left\{%s\right\} = %s' % (L(e), L(sp.simplify(r)))
    return {'input': L(e), 'pods': [pod('Input', e), pod('Result', tex=tex, text=sp.sstr(sp.simplify(r)))]}


# ---------- chemistry: balancing equations ----------

def _parse_formula(f):
    f = f.replace('·', '*').replace('.', '*')
    total = {}
    for part in f.split('*'):
        m = re.match(r'^(\d+)(.*)$', part)
        mult = int(m.group(1)) if m and m.group(2) else 1
        body = m.group(2) if m and m.group(2) else part
        stack = [{}]
        i = 0
        while i < len(body):
            c = body[i]
            if c in '([':
                stack.append({}); i += 1
            elif c in ')]':
                i += 1
                n = re.match(r'\d+', body[i:])
                k = int(n.group()) if n else 1
                i += len(n.group()) if n else 0
                top = stack.pop()
                for el, v in top.items():
                    stack[-1][el] = stack[-1].get(el, 0) + v * k
            else:
                m2 = re.match(r'([A-Z][a-z]?)(\d*)', body[i:])
                if not m2:
                    raise ValueError('Could not read the formula "%s"' % f)
                el, n = m2.group(1), int(m2.group(2) or 1)
                stack[-1][el] = stack[-1].get(el, 0) + n
                i += len(m2.group())
        for el, v in stack[0].items():
            total[el] = total.get(el, 0) + v * mult
    return total


def op_balance(req):
    src = re.sub(r'\s+', ' ', req['expr'].replace('→', '->').replace('⟶', '->').replace('=>', '->'))
    if '->' not in src:
        src = src.replace('=', '->')
    left, right = src.split('->')
    strip_coef = lambda x: re.sub(r'^\d+\s*', '', x.strip())
    react = [strip_coef(x) for x in left.split(' + ') if x.strip()] or [strip_coef(x) for x in left.split('+')]
    prod = [strip_coef(x) for x in right.split(' + ') if x.strip()] or [strip_coef(x) for x in right.split('+')]
    react = [r.replace(' ', '') for r in react]
    prod = [r.replace(' ', '') for r in prod]
    species = react + prod
    comps = [_parse_formula(sx) for sx in species]
    elements = sorted({e for c in comps for e in c})
    M = Matrix([[comps[j].get(el, 0) * (1 if j < len(react) else -1) for j in range(len(species))] for el in elements])
    ns = M.nullspace()
    if not ns:
        raise ValueError('This reaction can’t be balanced as written. Check the formulas.')
    v = ns[0]
    lcm = sp.ilcm(*[sp.fraction(x)[1] for x in v])
    v = [int(x * lcm) for x in v]
    if all(x <= 0 for x in v):
        v = [-x for x in v]
    if any(x <= 0 for x in v):
        raise ValueError('No positive balance exists: check that every product can form from the reactants.')
    g = sp.igcd(*v)
    v = [x // g for x in v]
    def tex_f(f):
        return re.sub(r'(\d+)', r'_{\1}', f).replace('*', r'\cdot ')
    def side(names, coefs):
        return ' + '.join(('%d\\,' % c if c != 1 else '') + r'\mathrm{%s}' % tex_f(n) for n, c in zip(names, coefs))
    def side_t(names, coefs):
        return ' + '.join(('%d ' % c if c != 1 else '') + n for n, c in zip(names, coefs))
    tex = side(react, v[:len(react)]) + r' \longrightarrow ' + side(prod, v[len(react):])
    rows = [[el, str(sum(comps[j].get(el, 0) * v[j] for j in range(len(react)))), str(sum(comps[j].get(el, 0) * v[j] for j in range(len(react), len(species))))] for el in elements]
    return {'input': tex, 'pods': [pod('Balanced equation', tex=tex, text=side_t(react, v[:len(react)]) + ' -> ' + side_t(prod, v[len(react):])),
                                   {'title': 'Atom check', 'table': {'head': ['Element', 'Left side', 'Right side'], 'rows': rows}}]}


# ---------- optimisation ----------

def op_optimize(req):
    e = P(req['expr'])
    v = pick_var(e, req.get('var'))
    a = P(req['a']) if req.get('a') else None
    b = P(req['b']) if req.get('b') else None
    d1 = sp.diff(e, v)
    d2 = sp.diff(e, v, 2)
    try:
        crit = [c for c in sp.solve(d1, v) if c.is_real is not False]
    except Exception:
        crit = []
    if a is not None:
        crit = [c for c in crit if (N(c) >= N(a)) and (N(c) <= N(b))]
    rows = []
    cands = []
    for c in crit:
        val = sp.simplify(e.subs(v, c))
        sec = sp.simplify(d2.subs(v, c))
        kind = 'local minimum' if sec.is_positive else 'local maximum' if sec.is_negative else 'inconclusive (second derivative is 0)'
        rows.append(['%s = %s' % (v, sp.sstr(c)), sp.sstr(val), kind])
        cands.append((c, val))
    if a is not None:
        for c in (a, b):
            val = sp.simplify(e.subs(v, c))
            rows.append(['%s = %s (endpoint)' % (v, sp.sstr(c)), sp.sstr(val), 'endpoint'])
            cands.append((c, val))
    pods = [pod('Function', e), pod('Derivative', tex=r"f'(%s) = %s" % (L(v), L(sp.simplify(d1))))]
    pods.append({'title': 'Critical points', 'table': {'head': ['Point', 'Value', 'Type'], 'rows': rows}} if rows else pod('Critical points', text='None found.'))
    try:
        numeric = [(c, float(N(val))) for c, val in cands if is_num(val)]
        if numeric:
            want = req.get('goal')
            if want in ('max', 'min') or a is not None:
                best_max = max(numeric, key=lambda t: t[1]); best_min = min(numeric, key=lambda t: t[1])
                lim_hi = lim_lo = None
                if a is None:
                    lim_hi = sp.limit(e, v, oo); lim_lo = sp.limit(e, v, -oo)
                if want != 'min':
                    unb = a is None and (lim_hi == oo or lim_lo == oo)
                    pods.append(pod('Maximum', text='No global maximum: the function grows without bound.' if unb else 'max = %s at %s = %s' % (sp.sstr(sp.simplify(e.subs(v, best_max[0]))), v, sp.sstr(best_max[0]))))
                if want != 'max':
                    unb = a is None and (lim_hi == -oo or lim_lo == -oo)
                    pods.append(pod('Minimum', text='No global minimum: the function decreases without bound.' if unb else 'min = %s at %s = %s' % (sp.sstr(sp.simplify(e.subs(v, best_min[0]))), v, sp.sstr(best_min[0]))))
    except Exception:
        pass
    if len(free_vars(e)) == 1:
        xs = [float(N(c)) for c, _ in cands if is_num(c)]
        lo, hi = (float(N(a)), float(N(b))) if a is not None else ((min(xs) - 3, max(xs) + 3) if xs else (-10, 10))
        pl = plot2d([e], v, lo, hi)
        pl['roots'] = []
        pl['points'] = {'x': xs, 'y': [fnum(N(e.subs(v, c))) for c, _ in cands if is_num(c)]}
        pods.append(plot_pod(pl))
    return {'input': L(e), 'pods': pods}


# ---------- number theory & digits ----------

def op_nt(req):
    k = req['kind']
    n = int(P(req['n'])) if req.get('n') not in (None, '') else None
    m = int(P(req['m'])) if req.get('m') not in (None, '') else None
    if k == 'fibonacci':
        val = sp.fibonacci(n)
        return {'input': 'F_{%d}' % n, 'pods': [pod('Fibonacci number F(%d)' % n, val), pod('First terms', text=', '.join(str(sp.fibonacci(i)) for i in range(min(n, 30) + 1)))]}
    if k == 'prime':
        val = sp.prime(n)
        return {'input': 'p_{%d}' % n, 'pods': [pod('The %s prime' % ordinal_s(n), val)]}
    if k == 'primes':
        ps = list(sp.primerange(n, m + 1))
        return {'input': None, 'pods': [pod('%d primes between %d and %d' % (len(ps), n, m), text=', '.join(map(str, ps[:2000])) + (' …' if len(ps) > 2000 else ''))]}
    if k == 'collatz':
        seq = [n]
        while seq[-1] != 1 and len(seq) < 10000:
            x = seq[-1]
            seq.append(x // 2 if x % 2 == 0 else 3 * x + 1)
        pl = {'kind': 'line', 'xtitle': 'step', 'traces': [{'name': 'value', 'x': list(range(len(seq))), 'y': seq}]}
        return {'input': None, 'pods': [pod('Collatz sequence from %d' % n, text=' → '.join(map(str, seq[:200])) + (' …' if len(seq) > 200 else '')),
                                        {'title': 'Facts', 'table': [['Steps to reach 1', str(len(seq) - 1)], ['Highest value', str(max(seq))]]}, plot_pod(pl)]}
    if k == 'modinv':
        return {'input': None, 'pods': [pod('Inverse of %d mod %d' % (n, m), Integer(sp.mod_inverse(n, m)))]}
    if k == 'totient':
        return {'input': None, 'pods': [pod('Euler’s totient φ(%d)' % n, sp.totient(n))]}
    if k in ('gcd', 'lcm'):
        nums = [int(P(x)) for x in re.split(r'[,\s]+', req['list']) if x]
        val = sp.igcd(*nums) if k == 'gcd' else sp.ilcm(*nums)
        return {'input': None, 'pods': [pod(('Greatest common divisor' if k == 'gcd' else 'Least common multiple') + ' of ' + ', '.join(map(str, nums)), Integer(val))]}
    raise ValueError('unknown number operation')


def ordinal_s(n):
    return '%d%s' % (n, 'th' if 11 <= n % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th'))


def op_digits(req):
    e = P(req['expr'])
    d = max(1, min(int(req.get('n') or 100), 20000))
    v = N(e, d + 5)
    s = sp.sstr(v)
    if '.' in s:
        ip, fp = s.split('.')
        s = ip + '.' + fp[:d]
    return {'input': L(e), 'pods': [pod('%s to %d digits' % (sp.sstr(e), d), text=s, mono=True)]}


# ---------- Python notebook cells ----------

PY_GLOBALS = {'__name__': '__main__'}


def run_python(code):
    import os
    os.environ.setdefault('MPLBACKEND', 'AGG')
    buf = io.StringIO()
    old_out, old_err = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = buf
    val = None
    err = None
    try:
        tree = ast.parse(code)
        last = None
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            last = ast.Expression(tree.body.pop().value)
        exec(compile(tree, '<cell>', 'exec'), PY_GLOBALS)
        if last is not None:
            val = eval(compile(last, '<cell>', 'eval'), PY_GLOBALS)
    except Exception:
        import traceback
        err = traceback.format_exc(limit=3)
    finally:
        sys.stdout, sys.stderr = old_out, old_err
    pods = []
    out = buf.getvalue()
    if out:
        pods.append({'title': 'Output', 'pre': out[-20000:]})
    if err:
        pods.append({'title': 'Error', 'pre': err, 'error': True})
    if val is not None:
        if isinstance(val, sp.Basic):
            pods.append(pod('Result', val))
        else:
            pods.append({'title': 'Result', 'pre': repr(val)[:20000]})
    if 'matplotlib.pyplot' in sys.modules:
        plt = sys.modules['matplotlib.pyplot']
        for num in plt.get_fignums():
            fig = plt.figure(num)
            b = io.BytesIO()
            fig.savefig(b, format='png', dpi=120, bbox_inches='tight')
            pods.append({'title': 'Figure %d' % num, 'image': 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()})
        plt.close('all')
    if not pods:
        pods.append({'title': 'Done', 'text': 'Ran with no output.'})
    return {'input': None, 'pods': pods}


OPS = {'auto': op_auto, 'solve': op_solve, 'integrate': op_integrate, 'diff': op_diff,
       'limit': op_limit, 'series': op_series, 'transform': op_transform, 'sum': op_sum,
       'plot': op_plot, 'ode': op_ode, 'itransform': op_integral_transform, 'balance': op_balance,
       'optimize': op_optimize, 'nt': op_nt, 'digits': op_digits}


def _clean(o):
    if isinstance(o, float):
        return o if math.isfinite(o) else None
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items() if v is not None}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    return o


def handle(req_json):
    req = json.loads(req_json)
    try:
        if req.get('op') == 'python':
            res = run_python(req['code'])
        else:
            res = OPS[req.get('op', 'auto')](req)
        res['ok'] = True
    except Exception as ex:
        res = {'ok': False, 'error': '%s: %s' % (type(ex).__name__, ex)}
    return json.dumps(_clean(res))
