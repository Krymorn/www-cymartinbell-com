"""
Word problems for /tools, solved without AI. Loaded after engine.py in the same namespace
(uses its pod/P/L/plot helpers). Entry point: op_wordproblem({'text': ...}).

Solvers are tried in order; each returns None if the text isn't its kind of problem:
  1. formula solver   physics/finance formulas with units (kinematics, F=ma, Ohm's law, ...)
  2. geometry         areas, volumes, perimeters of named shapes
  3. percent / money  discounts, tax, percent change, simple interest
  4. rates            work-together problems and proportions
  5. algebra          English-to-equation translation ("three more than twice a number is 11")
  6. story math       add/subtract/multiply/divide from verbs ("gives away", "each", "shared equally")
"""
import re, math
import sympy as sp
from sympy import Symbol, Rational, Eq, sqrt, pi, N

# ---------- numbers written as words ----------
_SMALL = {w: i for i, w in enumerate('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split())}
_TENS = {w: 10 * i for i, w in enumerate('_ _ twenty thirty forty fifty sixty seventy eighty ninety'.split()) if w != '_'}
_SCALE = {'hundred': 100, 'thousand': 1000, 'million': 10 ** 6, 'billion': 10 ** 9}
_FRAC = {'half': '1/2', 'halves': '1/2', 'third': '1/3', 'thirds': '1/3', 'quarter': '1/4', 'quarters': '1/4', 'fourth': '1/4', 'fourths': '1/4', 'fifth': '1/5', 'fifths': '1/5', 'sixth': '1/6', 'tenth': '1/10', 'tenths': '1/10'}
_ORD = {'first': 1, 'second': 2, 'third': 3}


def words_to_numbers(t):
    def repl(m):
        ws = re.split(r'[\s-]+', m.group(0).lower())
        total, cur = 0, 0
        for w in ws:
            if w == 'and':
                continue
            if w in _SMALL:
                cur += _SMALL[w]
            elif w in _TENS:
                cur += _TENS[w]
            elif w == 'hundred':
                cur = max(cur, 1) * 100
            elif w in _SCALE:
                total += max(cur, 1) * _SCALE[w]
                cur = 0
        return str(total + cur)
    num = r'(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)'
    t = re.sub(r'\b%s(?:(?:[\s-]+|\s+and\s+)%s)*\b' % (num, num), repl, t, flags=re.I)
    # "two thirds of" -> 2/3 of ; "half of" -> 1/2 of
    t = re.sub(r'\b(\d+)\s+(thirds|fourths|quarters|fifths|sixths|tenths)\b', lambda m: '%s/%s' % (m.group(1), _FRAC[m.group(2)].split('/')[1]), t, flags=re.I)
    t = re.sub(r'\b(?:a|one)\s+(half|third|quarter|fourth|fifth|sixth|tenth)\b', lambda m: _FRAC[m.group(1).lower()], t, flags=re.I)
    t = re.sub(r'\bhalf\b', '1/2', t, flags=re.I)
    t = re.sub(r'(\d),(\d{3})\b', r'\1\2', t)
    return t


def _num(s):
    s = s.replace(',', '')
    if '/' in s:
        a, b = s.split('/')
        return float(a) / float(b)
    return float(s)


def _fmt(x, d=6):
    try:
        x = float(x)
    except Exception:
        return str(x)
    if abs(x - round(x)) < 1e-9 and abs(x) < 1e15:
        return '{:,}'.format(int(round(x)))
    return ('{:,.%dg}' % d).format(x)


# ============================================================
# 1. Formula solver with units
# ============================================================
# unit -> (dimension, factor to SI)
UNITS = {}
def _u(dim, factor, *names):
    for n in names:
        UNITS[n] = (dim, factor)
_u('length', 1, 'm', 'meter', 'meters', 'metre', 'metres')
_u('length', 1000, 'km', 'kilometer', 'kilometers', 'kilometre', 'kilometres')
_u('length', 0.01, 'cm', 'centimeter', 'centimeters')
_u('length', 0.001, 'mm', 'millimeter', 'millimeters')
_u('length', 1609.344, 'mi', 'mile', 'miles')
_u('length', 0.3048, 'ft', 'foot', 'feet')
_u('length', 0.0254, 'in', 'inch', 'inches')
_u('length', 0.9144, 'yd', 'yard', 'yards')
_u('time', 1, 's', 'sec', 'secs', 'second', 'seconds')
_u('time', 60, 'min', 'mins', 'minute', 'minutes')
_u('time', 3600, 'h', 'hr', 'hrs', 'hour', 'hours')
_u('time', 86400, 'day', 'days')
_u('mass', 1, 'kg', 'kilogram', 'kilograms', 'kilo', 'kilos')
_u('mass', 0.001, 'g', 'gram', 'grams')
_u('mass', 0.45359237, 'lb', 'lbs', 'pound', 'pounds')
_u('mass', 1000, 'tonne', 'tonnes', 'metric ton')
_u('speed', 1, 'm/s', 'meters per second', 'metres per second', 'mps')
_u('speed', 1000 / 3600, 'km/h', 'kmh', 'kph', 'km/hr', 'kilometers per hour', 'kilometres per hour')
_u('speed', 0.44704, 'mph', 'mi/h', 'miles per hour', 'miles an hour')
_u('speed', 0.3048, 'ft/s', 'feet per second', 'fps')
_u('accel', 1, 'm/s^2', 'm/s2', 'm/s²', 'meters per second squared', 'metres per second squared', 'm/s/s')
_u('accel', 0.3048, 'ft/s^2', 'ft/s2', 'ft/s²', 'feet per second squared')
_u('force', 1, 'n', 'newton', 'newtons')
_u('force', 1000, 'kn', 'kilonewton', 'kilonewtons')
_u('energy', 1, 'j', 'joule', 'joules')
_u('energy', 1000, 'kj', 'kilojoule', 'kilojoules')
_u('energy', 4.184, 'cal', 'calorie', 'calories')
_u('energy', 3.6e6, 'kwh', 'kilowatt hour', 'kilowatt hours', 'kilowatt-hours')
_u('power', 1, 'w', 'watt', 'watts')
_u('power', 1000, 'kw', 'kilowatt', 'kilowatts')
_u('power', 745.7, 'hp', 'horsepower')
_u('voltage', 1, 'v', 'volt', 'volts')
_u('current', 1, 'a', 'amp', 'amps', 'ampere', 'amperes')
_u('current', 0.001, 'ma', 'milliamp', 'milliamps')
_u('resistance', 1, 'ohm', 'ohms', 'Ω', 'ω')
_u('resistance', 1000, 'kohm', 'kiloohm', 'kiloohms', 'kΩ')
_u('frequency', 1, 'hz', 'hertz')
_u('frequency', 1000, 'khz', 'kilohertz')
_u('pressure', 1, 'pa', 'pascal', 'pascals')
_u('pressure', 101325, 'atm', 'atmosphere', 'atmospheres')
_u('pressure', 6894.757, 'psi')
_u('volume', 0.001, 'l', 'liter', 'liters', 'litre', 'litres')
_u('volume', 1e-6, 'ml', 'milliliter', 'milliliters', 'cm^3', 'cm3', 'cc')
_u('volume', 1, 'm^3', 'm3', 'cubic meter', 'cubic meters')
_u('volume', 0.003785411784, 'gal', 'gallon', 'gallons')
_u('area', 1, 'm^2', 'm2', 'square meter', 'square meters', 'sq m')
_u('area', 1e-4, 'cm^2', 'cm2', 'square centimeters')
_u('area', 0.09290304, 'ft^2', 'ft2', 'square feet', 'sq ft')
_u('density', 1, 'kg/m^3', 'kg/m3')
_u('density', 1000, 'g/cm^3', 'g/cm3', 'g/ml')
_u('momentum', 1, 'kg m/s', 'kg*m/s', 'kg·m/s')
_u('temperature', 1, 'k', 'kelvin')

_UNIT_RE = '|'.join(sorted((re.escape(k) for k in UNITS), key=len, reverse=True))
_QTY = re.compile(r'(-?\d+(?:\.\d+)?(?:\s*[x×*]\s*10\^?-?\d+)?|-?\d*\.?\d+e-?\d+)\s*(%s)(?![a-z])' % _UNIT_RE, re.I)

DOMAINS = [
    # name, variables {sym: (dimension, description)}, equations (expr == 0), trigger words
    ('constant speed', {'d': ('length', 'distance'), 'v': ('speed', 'speed'), 't': ('time', 'time')}, ['d - v*t'], None),
    ('kinematics (constant acceleration)', {'u': ('speed', 'initial velocity'), 'v': ('speed', 'final velocity'), 'a': ('accel', 'acceleration'), 't': ('time', 'time'), 's': ('length', 'distance')},
     ['v - (u + a*t)', 's - (u*t + a*t**2/2)', 'v**2 - (u**2 + 2*a*s)', 's - (u + v)/2*t'], r'accelerat|decelerat|from rest|brak|speeds up|slows'),
    ('free fall', {'h': ('length', 'height'), 't': ('time', 'time'), 'v': ('speed', 'impact speed'), 'g': ('accel', 'gravity')},
     ['h - g*t**2/2', 'v - g*t', 'v**2 - 2*g*h'], r'\bdrop|fall|falls|fell|free[- ]fall|from a height|off a (?:cliff|building|roof|bridge)'),
    ("Newton's second law", {'F': ('force', 'force'), 'm': ('mass', 'mass'), 'a': ('accel', 'acceleration')}, ['F - m*a'], r'force|newton|push|pull'),
    ('weight', {'W': ('force', 'weight'), 'm': ('mass', 'mass'), 'g': ('accel', 'gravity')}, ['W - m*g'], r'\bweight\b|\bweigh'),
    ('kinetic energy', {'K': ('energy', 'kinetic energy'), 'm': ('mass', 'mass'), 'v': ('speed', 'speed')}, ['K - m*v**2/2'], r'kinetic|energy'),
    ('potential energy', {'U': ('energy', 'potential energy'), 'm': ('mass', 'mass'), 'h': ('length', 'height'), 'g': ('accel', 'gravity')}, ['U - m*g*h'], r'potential|lift|raise|height'),
    ('work', {'W': ('energy', 'work'), 'F': ('force', 'force'), 'd': ('length', 'distance')}, ['W - F*d'], r'\bwork\b'),
    ('power from energy', {'P': ('power', 'power'), 'E': ('energy', 'energy'), 't': ('time', 'time')}, ['P - E/t'], r'power|watt|\d\s*k?w\b|energy'),
    ("Ohm's law", {'V': ('voltage', 'voltage'), 'I': ('current', 'current'), 'R': ('resistance', 'resistance')}, ['V - I*R'], r'volt|current|resist|ohm|circuit'),
    ('electric power', {'P': ('power', 'power'), 'V': ('voltage', 'voltage'), 'I': ('current', 'current')}, ['P - V*I'], r'power|watt'),
    ('momentum', {'p': ('momentum', 'momentum'), 'm': ('mass', 'mass'), 'v': ('speed', 'velocity')}, ['p - m*v'], r'momentum'),
    ('density', {'rho': ('density', 'density'), 'm': ('mass', 'mass'), 'V': ('volume', 'volume')}, ['rho - m/V'], r'densit'),
    ('pressure', {'P': ('pressure', 'pressure'), 'F': ('force', 'force'), 'A': ('area', 'area')}, ['P - F/A'], r'pressure'),
    ('wave speed', {'v': ('speed', 'wave speed'), 'f': ('frequency', 'frequency'), 'lam': ('length', 'wavelength')}, ['v - f*lam'], r'wave|frequenc|wavelength'),
]

TARGETS = [
    (r'how far|what distance|distance (?:travel|cover)|how much distance|displacement|how many (?:miles|meters|km|kilometers|feet)', 'length'),
    (r'how (?:high|tall)|what height|from what height', 'length'),
    (r'how long|how much time|how many (?:seconds|minutes|hours)|what time|time (?:it takes|taken|needed|to)', 'time'),
    (r'how fast|speed|velocity', 'speed'),
    (r'accelerat', 'accel'),
    (r'\bforce\b|how hard', 'force'),
    (r'kinetic energy|potential energy|energy|\bwork\b', 'energy'),
    (r'\bpower\b|how many watts', 'power'),
    (r'current|how many amps', 'current'),
    (r'voltage|how many volts', 'voltage'),
    (r'resistance', 'resistance'),
    (r'\bmass\b|how heavy', 'mass'),
    (r'density', 'density'),
    (r'momentum', 'momentum'),
    (r'pressure', 'pressure'),
    (r'frequency', 'frequency'),
    (r'wavelength', 'length'),
]

DISPLAY = {'length': [('m', 1), ('km', 1000), ('ft', 0.3048), ('mi', 1609.344)], 'time': [('s', 1), ('min', 60), ('h', 3600)], 'speed': [('m/s', 1), ('km/h', 1 / 3.6), ('mph', 0.44704)],
           'accel': [('m/s²', 1), ('g', 9.80665)], 'force': [('N', 1), ('lbf', 4.44822)], 'energy': [('J', 1), ('kJ', 1000), ('kcal', 4184), ('kWh', 3.6e6)], 'power': [('W', 1), ('kW', 1000), ('hp', 745.7)],
           'voltage': [('V', 1)], 'current': [('A', 1), ('mA', 0.001)], 'resistance': [('Ω', 1), ('kΩ', 1000)], 'mass': [('kg', 1), ('g', 0.001), ('lb', 0.45359237)], 'density': [('kg/m³', 1), ('g/cm³', 1000)],
           'momentum': [('kg·m/s', 1)], 'pressure': [('Pa', 1), ('kPa', 1000), ('atm', 101325), ('psi', 6894.757)], 'frequency': [('Hz', 1), ('kHz', 1000)], 'area': [('m²', 1), ('ft²', 0.09290304)], 'volume': [('m³', 1), ('L', 0.001), ('gal', 0.003785411784)]}


_PREF = {}


def _show(val, dim):
    units = list(DISPLAY.get(dim, [('', 1)]))
    pref = _PREF.get(dim)
    if pref:
        units.sort(key=lambda u: 0 if u[0] == pref else 1)
    parts = ['%s %s' % (_fmt(val / f, 5), u) for u, f in units]
    return parts[0], ' = '.join(parts)


def extract_quantities(text):
    out = []
    for m in _QTY.finditer(text):
        raw, unit = m.group(1), m.group(2).lower()
        if unit in ('a', 'in', 'g', 's', 'h', 'm', 'v', 'w', 'k', 'n', 'l') and not re.match(r'\s?' + re.escape(m.group(2)) + r'\b', text[m.start(2):m.end(2) + 1], re.I):
            continue
        # a lone "a" or "in" after a number is usually English ("5 in the box"), not amps/inches,
        # unless clearly used as a unit
        after = text[m.end():m.end() + 12].lower()
        if unit == 'in' and re.match(r'\s+(?:the|a|an|his|her|their|total|all)\b', after):
            continue
        if unit == 'a' and re.match(r'\s+\w', after) and not re.search(r'amp|current', text, re.I):
            continue
        raw = re.sub(r'\s*[x×*]\s*10\^?', 'e', raw)
        dim, f = UNITS.get(unit, UNITS.get(m.group(2), (None, None)))
        if dim is None:
            continue
        out.append({'value': float(raw) * f, 'dim': dim, 'text': m.group(0), 'start': m.start(), 'end': m.end()})
    return out


def _context(text, q, width=48):
    return text[max(0, q['start'] - width):q['start']].lower()


def solve_formula(text):
    low = text.lower()
    qs = extract_quantities(text)
    from_rest = bool(re.search(r'from rest|starts? (?:at|from) rest|initially at rest|stationary|starting from 0', low))
    stops = bool(re.search(r'comes? to (?:a )?(?:stop|rest)|until it stops|stops completely', low))
    dropped = bool(re.search(r'\bdrop|\bfalls?\b|\bfell\b|free[- ]fall|is released', low))
    target_dim = None
    _sents = re.split(r'(?<=[.!?])\s+', text.strip())
    question = ' '.join(x for x in _sents if '?' in x) or _sents[-1]
    qlow = question.lower()
    asked = re.search(r'(?:what|find|calculate|determine|compute)\s+(?:is\s+|was\s+|will\s+be\s+|are\s+)?(?:the\s+|its\s+|their\s+|his\s+|her\s+)?((?:\w+\s+){0,2}\w+)', qlow)
    if asked:
        for pat, dim in TARGETS:
            if re.search(pat, asked.group(1)):
                target_dim = dim
                break
    if target_dim is None:
        for pat, dim in TARGETS:
            if re.search(pat, qlow):
                target_dim = dim
                break
    if target_dim is None or (len(qs) < 1 and not dropped):
        return None
    if len(qs) + from_rest + stops + dropped < 2:
        return None
    best = None
    for name, vars_, eqs, trig in DOMAINS:
        if trig and not re.search(trig, low):
            continue
        cands = [s for s, (d, _) in vars_.items() if d == target_dim]
        if not cands:
            continue
        known = {}
        used = set()
        # assign quantities to variables of matching dimension, using nearby words
        for q in qs:
            ctx = _context(text, q)
            opts = [s for s, (d, _) in vars_.items() if d == q['dim'] and s not in known]
            if not opts:
                continue
            pick = opts[0]
            if q['dim'] == 'speed' and 'u' in opts and 'v' in opts:
                pick = 'v' if re.search(r'(?:to|reach(?:es|ing)?|final|until|up to)\s*(?:a\s+)?(?:speed\s+of\s+)?$', ctx.strip()) or re.search(r'reach|final', ctx[-25:]) else 'u'
            known[pick] = q['value']
            used.add(id(q))
        if 'u' in vars_ and 'u' not in known and from_rest:
            known['u'] = 0.0
        if 'v' in vars_ and 'v' not in known and stops and 'u' in known:
            known['v'] = 0.0
        if 'g' in vars_ and 'g' not in known:
            known['g'] = 9.80665
        unknown_targets = [c for c in cands if c not in known]
        if not unknown_targets:
            continue
        # prefer a target the question names ("final velocity" vs "initial")
        tgt = unknown_targets[0]
        if len(unknown_targets) > 1 and re.search(r'initial|start', qlow) and 'u' in unknown_targets:
            tgt = 'u'
        if len(used) < len(qs) and name == 'constant speed' and re.search(r'accelerat', low):
            continue
        syms = {s: Symbol(s, real=True) for s in vars_}
        sub = {syms[k]: sp.nsimplify(v, rational=False) for k, v in known.items()}
        equations = [sp.sympify(e, locals=syms).subs(sub) for e in eqs]
        unknowns = [syms[s] for s in vars_ if s not in known]
        try:
            sols = sp.solve(equations, unknowns, dict=True)
        except Exception:
            continue
        vals = []
        for so in sols:
            if syms[tgt] in so:
                try:
                    x = complex(N(so[syms[tgt]]))
                except Exception:
                    continue
                if abs(x.imag) < 1e-9:
                    vals.append(x.real)
        if not vals:
            continue
        pos = [x for x in vals if x >= 0] or vals
        val = min(pos) if target_dim == 'time' else max(pos)
        score = len(known) + (2 if trig else 0) + (1 if len(used) == len(qs) else 0)
        if best is None or score > best[0]:
            best = (score, name, vars_, eqs, known, tgt, val)
    if not best:
        return None
    _, name, vars_, eqs, known, tgt, val = best
    units_used = ' '.join(q['text'].lower() for q in qs)
    _PREF.clear()
    imperial = re.search(r'mph|mile|\bmi\b|\bft\b|feet|foot|\blbs?\b|pound', units_used)
    if re.search(r'mph|mile|\bmi\b', units_used):
        _PREF['length'] = 'mi'
    elif re.search(r'\bft\b|feet|foot', units_used):
        _PREF['length'] = 'ft'
    elif re.search(r'km', units_used):
        _PREF['length'] = 'km'
    if re.search(r'hour|\bhr|\bh\b|mph|km/h|kph', units_used):
        _PREF['time'] = 'h'
    elif re.search(r'min', units_used):
        _PREF['time'] = 'min'
    if _PREF.get('time') == 'h':
        _PREF['energy'] = 'kWh'
    if imperial:
        _PREF['speed'] = 'mph'
        _PREF['mass'] = 'lb'
    elif re.search(r'km/h|kph', units_used):
        _PREF['speed'] = 'km/h'
    rows = []
    for k, v in known.items():
        dim, desc = vars_[k]
        rows.append([desc, '%s = %s' % (k.replace('lam', 'λ').replace('rho', 'ρ'), _show(v, dim)[1])])
    dim, desc = vars_[tgt]
    main, alll = _show(val, dim)
    tex_eqs = r',\quad '.join(sp.latex(Eq(sp.sympify(e.split(' - ', 1)[0]), sp.sympify(e.split(' - ', 1)[1]))) if ' - ' in e else e for e in eqs)
    return {'input': None, 'label': 'Word problem', 'interp': '%s: find the %s' % (name.capitalize(), desc),
            'pods': [{'title': 'What I found in the problem', 'table': rows, 'note': 'Values are converted to SI units before solving.'},
                     {'title': 'Formulas (%s)' % name, 'latex': tex_eqs},
                     {'title': 'Answer: %s' % desc, 'text': main, 'big': True, 'note': alll}]}


# ============================================================
# 2. Geometry
# ============================================================
_SHAPES = ['rectangular prism', 'right triangle', 'equilateral triangle', 'semicircle', 'circle', 'square', 'rectangle', 'triangle', 'trapezoid', 'parallelogram', 'rhombus', 'sphere', 'hemisphere', 'cube', 'cylinder', 'cone', 'box', 'pyramid', 'regular hexagon', 'hexagon']
_DIMS = {'radius': 'r', 'diameter': 'd', 'side': 's', 'side length': 's', 'edge': 's', 'length': 'l', 'width': 'w', 'height': 'h', 'depth': 'h', 'base': 'b', 'legs': 'legs', 'leg': 'legs', 'sides': 'sides', 'slant height': 'sl', 'bases': 'bases', 'hypotenuse': 'c'}
_LUNIT = r'(?:\s*(mm|cm|m|km|in|inches|inch|ft|feet|foot|yd|yards|mi|miles|units))?'


def _dims(low):
    d = {}
    unit = None
    for name in sorted(_DIMS, key=len, reverse=True):
        key = _DIMS[name]
        for m in re.finditer(r'\b%s(?:\s+(?:of|is|=|are|measures|measuring))?\s*(\d+(?:\.\d+)?(?:\s*(?:,|and|by|x)\s*\d+(?:\.\d+)?)*)%s' % (name, _LUNIT), low):
            nums = [float(x) for x in re.findall(r'\d+(?:\.\d+)?', m.group(1))]
            if key not in d:
                d[key] = nums if key in ('legs', 'sides', 'bases') else nums[0]
            unit = unit or m.group(2)
        for m in re.finditer(r'(\d+(?:\.\d+)?)%s\s+(?:long\s+)?%s\b' % (_LUNIT, name), low):
            if key not in d:
                d[key] = [float(m.group(1))] if key in ('legs', 'sides', 'bases') else float(m.group(1))
            unit = unit or m.group(2)
    m = re.search(r'(\d+(?:\.\d+)?)%s?\s*(?:by|x|×)\s*(\d+(?:\.\d+)?)%s?(?:\s*(?:by|x|×)\s*(\d+(?:\.\d+)?))?%s' % (_LUNIT, _LUNIT, _LUNIT), low)
    if m and 'l' not in d:
        d['l'], d['w'] = float(m.group(1)), float(m.group(3))
        if m.group(5):
            d['h'] = float(m.group(5))
        unit = unit or m.group(2) or m.group(4) or m.group(6)
    if unit in ('inches', 'inch'):
        unit = 'in'
    if unit in ('feet', 'foot'):
        unit = 'ft'
    return d, unit


def solve_geometry(text):
    low = text.lower()
    shape = next((s for s in _SHAPES if re.search(r'\b%s\b' % s, low)), None)
    if not shape:
        if re.search(r'pythag|hypotenuse', low):
            shape = 'right triangle'
        else:
            return None
    d, unit = _dims(low)
    if not d:
        return None
    U = (' ' + unit) if unit and unit != 'units' else ''
    S = lambda e: sp.nsimplify(e)
    r = d.get('r', d['d'] / 2 if 'd' in d else None)
    res = []  # (name, exact expr, power of unit)
    if shape in ('circle', 'semicircle') and r is not None:
        r = S(r)
        k = Rational(1, 2) if shape == 'semicircle' else 1
        res += [('Area', k * pi * r ** 2, 2), ('Circumference' if shape == 'circle' else 'Arc length', k * 2 * pi * r, 1), ('Diameter', 2 * r, 1)]
        if shape == 'semicircle':
            res.append(('Perimeter', pi * r + 2 * r, 1))
    elif shape in ('sphere', 'hemisphere') and r is not None:
        r = S(r)
        if shape == 'sphere':
            res += [('Volume', Rational(4, 3) * pi * r ** 3, 3), ('Surface area', 4 * pi * r ** 2, 2)]
        else:
            res += [('Volume', Rational(2, 3) * pi * r ** 3, 3), ('Surface area (with base)', 3 * pi * r ** 2, 2)]
    elif shape == 'cylinder' and r is not None and 'h' in d:
        r, h = S(r), S(d['h'])
        res += [('Volume', pi * r ** 2 * h, 3), ('Surface area', 2 * pi * r ** 2 + 2 * pi * r * h, 2), ('Lateral area', 2 * pi * r * h, 2)]
    elif shape == 'cone' and r is not None and 'h' in d:
        r, h = S(r), S(d['h'])
        sl = sqrt(r ** 2 + h ** 2)
        res += [('Volume', pi * r ** 2 * h / 3, 3), ('Slant height', sl, 1), ('Surface area', pi * r ** 2 + pi * r * sl, 2)]
    elif shape == 'cube' and 's' in d:
        s = S(d['s'])
        res += [('Volume', s ** 3, 3), ('Surface area', 6 * s ** 2, 2), ('Space diagonal', s * sqrt(3), 1)]
    elif shape == 'square' and 's' in d:
        s = S(d['s'])
        res += [('Area', s ** 2, 2), ('Perimeter', 4 * s, 1), ('Diagonal', s * sqrt(2), 1)]
    elif shape in ('rectangle',) and 'l' in d and 'w' in d:
        l, w = S(d['l']), S(d['w'])
        res += [('Area', l * w, 2), ('Perimeter', 2 * (l + w), 1), ('Diagonal', sqrt(l ** 2 + w ** 2), 1)]
    elif shape in ('rectangular prism', 'box') and 'l' in d and 'w' in d and 'h' in d:
        l, w, h = S(d['l']), S(d['w']), S(d['h'])
        res += [('Volume', l * w * h, 3), ('Surface area', 2 * (l * w + l * h + w * h), 2), ('Space diagonal', sqrt(l ** 2 + w ** 2 + h ** 2), 1)]
    elif shape == 'right triangle' or (shape == 'triangle' and ('legs' in d or 'c' in d)):
        legs = d.get('legs') or [x for x in (d.get('b'), d.get('h')) if x is not None]
        if len(legs) >= 2:
            a, b = S(legs[0]), S(legs[1])
            c = sqrt(a ** 2 + b ** 2)
            res += [('Hypotenuse', c, 1), ('Area', a * b / 2, 2), ('Perimeter', a + b + c, 1)]
        elif len(legs) == 1 and 'c' in d:
            a, c = S(legs[0]), S(d['c'])
            b = sqrt(c ** 2 - a ** 2)
            res += [('Other leg', b, 1), ('Area', a * b / 2, 2), ('Perimeter', a + b + c, 1)]
        else:
            return None
    elif shape == 'equilateral triangle' and 's' in d:
        s = S(d['s'])
        res += [('Area', sqrt(3) / 4 * s ** 2, 2), ('Perimeter', 3 * s, 1), ('Height', sqrt(3) / 2 * s, 1)]
    elif shape == 'triangle':
        if 'b' in d and 'h' in d:
            res += [('Area', S(d['b']) * S(d['h']) / 2, 2)]
        elif 'sides' in d and len(d['sides']) == 3:
            a, b, c = [S(x) for x in d['sides']]
            if a + b <= c or a + c <= b or b + c <= a:
                return {'input': None, 'label': 'Geometry', 'interp': 'Triangle', 'pods': [{'title': 'Not a triangle', 'text': 'Those side lengths break the triangle inequality: the two shorter sides must add up to more than the longest.'}]}
            s_ = (a + b + c) / 2
            res += [('Area (Heron’s formula)', sp.sqrt(s_ * (s_ - a) * (s_ - b) * (s_ - c)), 2), ('Perimeter', a + b + c, 1)]
            sides = sorted([a, b, c])
            kind = 'right' if sp.simplify(sides[0] ** 2 + sides[1] ** 2 - sides[2] ** 2) == 0 else 'obtuse' if sides[0] ** 2 + sides[1] ** 2 < sides[2] ** 2 else 'acute'
            res.append(('Type', kind, None))
        else:
            return None
    elif shape == 'trapezoid' and 'h' in d and ('bases' in d and len(d['bases']) >= 2):
        a, b = S(d['bases'][0]), S(d['bases'][1])
        res += [('Area', (a + b) / 2 * S(d['h']), 2)]
    elif shape in ('parallelogram', 'rhombus') and 'b' in d and 'h' in d:
        res += [('Area', S(d['b']) * S(d['h']), 2)]
    elif shape in ('regular hexagon', 'hexagon') and 's' in d:
        s = S(d['s'])
        res += [('Area', 3 * sqrt(3) / 2 * s ** 2, 2), ('Perimeter', 6 * s, 1)]
    elif shape == 'pyramid' and 'h' in d and ('s' in d or 'b' in d):
        b = S(d.get('s', d.get('b')))
        res += [('Volume (square base)', b ** 2 * S(d['h']) / 3, 3)]
    else:
        return None
    # put the measure the question asks for first
    ask = re.search(r'(area|perimeter|circumference|volume|surface area|hypotenuse|diagonal|slant height|other leg|height)', low.split('?')[0][-120:] if '?' in low else low)
    if ask:
        res.sort(key=lambda x: 0 if ask.group(1) in x[0].lower() else 1)
    pods = [{'title': 'Shape', 'text': '%s with %s' % (shape.capitalize(), ', '.join('%s = %s' % (k, v if not isinstance(v, list) else ', '.join(_fmt(x) for x in v)) for k, v in d.items()) + U)}]
    for i, (name, e, p) in enumerate(res):
        if p is None:
            pods.append({'title': name, 'text': str(e)})
            continue
        u = (U + ('²' if p == 2 else '³' if p == 3 else '')) if U else (' square units' if p == 2 else ' cubic units' if p == 3 else ' units')
        approx = float(N(e))
        exact = sp.latex(sp.simplify(e))
        pods.append({'title': name, 'latex': exact + (r' \approx %s' % _fmt(approx, 6) if not e.is_Integer and not e.is_Rational else '') + r'\text{%s}' % u, 'text': '%s%s' % (_fmt(approx, 6), u), 'big': i == 0})
    return {'input': None, 'label': 'Geometry', 'interp': shape.capitalize(), 'pods': pods}


# ============================================================
# 3. Percent and money
# ============================================================
def solve_percent(text):
    low = text.lower().replace(',', '')
    money = r'\$?\s*(\d+(?:\.\d+)?)\s*(?:dollars)?'
    m = re.search(r'%s[^.?]*?(\d+(?:\.\d+)?)\s*(?:%%|percent)\s*(off|discount|sale|markdown|cheaper)' % money, low) or re.search(r'(\d+(?:\.\d+)?)\s*(?:%%|percent)\s*(off|discount)[^.?]*?%s' % money, low)
    if m:
        if m.re.pattern.startswith('(\\d'):
            pct, price = float(m.group(1)), float(m.group(3))
        else:
            price, pct = float(m.group(1)), float(m.group(2))
        tax = re.search(r'(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:sales\s+)?tax', low)
        sale = price * (1 - pct / 100)
        rows = [['Original price', '$%.2f' % price], ['Discount (%s%%)' % _fmt(pct), '−$%.2f' % (price * pct / 100)], ['Sale price', '$%.2f' % sale]]
        final = sale
        if tax:
            t = float(tax.group(1))
            final = sale * (1 + t / 100)
            rows += [['Tax (%s%%)' % _fmt(t), '+$%.2f' % (sale * t / 100)], ['Total', '$%.2f' % final]]
        return {'input': None, 'label': 'Percent', 'interp': 'Discount%s' % (' with tax' if tax else ''), 'pods': [{'title': 'You pay', 'big': True, 'text': '$%.2f' % final}, {'title': 'Working', 'table': rows}]}
    m = re.search(r'%s[^.?]*?(\d+(?:\.\d+)?)\s*(?:%%|percent)\s*(?:sales\s+)?tax' % money, low)
    if m:
        price, t = float(m.group(1)), float(m.group(2))
        return {'input': None, 'label': 'Percent', 'interp': 'Sales tax', 'pods': [{'title': 'Total with tax', 'big': True, 'text': '$%.2f' % (price * (1 + t / 100))}, {'title': 'Working', 'table': [['Price', '$%.2f' % price], ['Tax (%s%%)' % _fmt(t), '$%.2f' % (price * t / 100)]]}]}
    m = re.search(r'(?:from|was|went from)\s+\$?(\d+(?:\.\d+)?)\s+to\s+\$?(\d+(?:\.\d+)?)', low)
    if m and re.search(r'percent|%|by how much', low):
        a, b = float(m.group(1)), float(m.group(2))
        ch = (b - a) / a * 100
        return {'input': None, 'label': 'Percent', 'interp': 'Percent change', 'pods': [{'title': 'Percent %s' % ('increase' if ch >= 0 else 'decrease'), 'big': True, 'text': '%s%%' % _fmt(abs(ch), 5)}, {'title': 'Working', 'latex': r'\frac{%s - %s}{%s}\times 100 = %s\%%' % (_fmt(b), _fmt(a), _fmt(a), _fmt(ch, 5))}]}
    m = re.search(r'%s[^.?]*?(\d+(?:\.\d+)?)\s*(?:%%|percent)[^.?]*simple interest[^.?]*?(\d+(?:\.\d+)?)\s*(years?|months?)' % money, low) or re.search(r'simple interest[^.?]*?%s[^.?]*?(\d+(?:\.\d+)?)\s*(?:%%|percent)[^.?]*?(\d+(?:\.\d+)?)\s*(years?|months?)' % money, low)
    if m:
        P_, r_, n_ = float(m.group(1)), float(m.group(2)), float(m.group(3))
        yrs = n_ / 12 if m.group(4).startswith('month') else n_
        I_ = P_ * r_ / 100 * yrs
        return {'input': None, 'label': 'Interest', 'interp': 'Simple interest', 'pods': [{'title': 'Interest earned', 'big': True, 'text': '$%.2f' % I_}, {'title': 'Working', 'latex': r'I = Prt = %s \times %s \times %s = %s' % (_fmt(P_), _fmt(r_ / 100), _fmt(yrs), _fmt(I_, 8))}, {'title': 'Total after %s %s' % (_fmt(n_), m.group(4)), 'text': '$%.2f' % (P_ + I_)}]}
    m = re.search(r'(\d+(?:\.\d+)?)\s*(?:%|percent)\s+of\s+(?:what|which)\s+(?:number\s+)?(?:is|equals)\s+(\d+(?:\.\d+)?)', low) or re.search(r'(\d+(?:\.\d+)?)\s+is\s+(\d+(?:\.\d+)?)\s*(?:%|percent)\s+of\s+(?:what|which)', low)
    if m:
        if 'of what' in m.group(0) and m.group(0).index('%' if '%' in m.group(0) else 'percent') < m.group(0).index('of'):
            pct, part = float(m.group(1)), float(m.group(2))
            if re.match(r'\d+(?:\.\d+)?\s+is', m.group(0)):
                part, pct = float(m.group(1)), float(m.group(2))
        else:
            part, pct = float(m.group(1)), float(m.group(2))
        return {'input': None, 'label': 'Percent', 'interp': 'Find the whole', 'pods': [{'title': 'The whole', 'big': True, 'text': _fmt(part / (pct / 100), 8)}, {'title': 'Working', 'latex': r'%s \div %s = %s' % (_fmt(part), _fmt(pct / 100), _fmt(part / (pct / 100), 8))}]}
    return None


# ============================================================
# 4. Rates: work together, proportions
# ============================================================
def solve_rates(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    if re.search(r'together|working together|both work|at the same time|combined', low):
        times = re.findall(r'(?:in|takes?|took)\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|days?)', low)
        if len(times) >= 2:
            ts = [float(t) for t, _ in times]
            unit = re.sub(r's$', '', times[0][1])
            total = 1 / sum(1 / t for t in ts)
            frac = sp.nsimplify(1 / sum(Rational(1, 1) / sp.nsimplify(t) for t in ts))
            return {'input': None, 'label': 'Word problem', 'interp': 'Work together', 'pods': [
                {'title': 'Time working together', 'big': True, 'text': '%s %ss' % (_fmt(total, 6), unit) + (' (%s)' % frac if not frac.is_Integer else '')},
                {'title': 'Working', 'latex': r'\frac{1}{T} = ' + ' + '.join(r'\frac{1}{%s}' % _fmt(t) for t in ts) + r' \;\Rightarrow\; T = %s' % sp.latex(frac)},
                {'title': 'Why', 'text': 'Each worker does 1/t of the job per %s. Add the rates, then flip the total to get the time for one whole job.' % unit}]}
    # proportion: "If 3 pencils cost $1.50, how much do 7 pencils cost?"
    m = re.search(r'(\d+(?:\.\d+)?)\s+([a-z]+)[^.?]*?(?:cost|costs|for|is|are|weigh|weighs|takes?|makes?|uses?|needs?|=)\s+\$?(\d+(?:\.\d+)?)\s*([a-z$]*)[^?]*?(?:how (?:much|many|long)|what)[^?]*?(\d+(?:\.\d+)?)\s+%s' % r'(?:\2|\w+)', low)
    if m:
        a, b, c = float(m.group(1)), float(m.group(3)), float(m.group(5))
        ans = b / a * c
        dollars = '$' in low
        val = ('$%.2f' % ans) if dollars else '%s %s' % (_fmt(ans, 8), m.group(4) or '')
        return {'input': None, 'label': 'Word problem', 'interp': 'Proportion', 'pods': [
            {'title': 'Answer', 'big': True, 'text': val.strip()},
            {'title': 'Working', 'latex': r'\frac{%s}{%s} = \frac{x}{%s} \;\Rightarrow\; x = %s \times \frac{%s}{%s} = %s' % (_fmt(b), _fmt(a), _fmt(c), _fmt(c), _fmt(b), _fmt(a), _fmt(ans, 8))},
            {'title': 'Unit rate', 'text': '%s per %s' % (('$%.4g' % (b / a)) if dollars else _fmt(b / a, 6), re.sub(r's$', '', m.group(2)))}]}
    return None


# ============================================================
# 5. English → algebra
# ============================================================
_ATOM = r'(?:-?\d+(?:\.\d+)?(?:/\d+)?|[xyz]|\([^()]*\))'
_LEVELS = [
    # functional phrases
    [(r'the sum of (%s) and (%s)' % (_ATOM, _ATOM), r'(\1+\2)'), (r'the difference (?:of|between) (%s) and (%s)' % (_ATOM, _ATOM), r'(\1-\2)'),
     (r'the product of (%s) and (%s)' % (_ATOM, _ATOM), r'(\1*\2)'), (r'the quotient of (%s) and (%s)' % (_ATOM, _ATOM), r'(\1/\2)'),
     (r'the ratio of (%s) to (%s)' % (_ATOM, _ATOM), r'(\1/\2)'), (r'the (?:square root|sqrt) of (%s)' % _ATOM, r'sqrt(\1)'),
     (r'the square of (%s)' % _ATOM, r'(\1)^2'), (r'the cube of (%s)' % _ATOM, r'(\1)^3'), (r'the reciprocal of (%s)' % _ATOM, r'(1/\1)'),
     (r'the opposite of (%s)' % _ATOM, r'(-\1)'), (r'the absolute value of (%s)' % _ATOM, r'Abs(\1)')],
    # unary
    [(r'\btwice (%s)' % _ATOM, r'(2*\1)'), (r'\bdouble (%s)' % _ATOM, r'(2*\1)'), (r'\b(?:triple|thrice) (%s)' % _ATOM, r'(3*\1)'),
     (r'(%s) squared' % _ATOM, r'(\1)^2'), (r'(%s) cubed' % _ATOM, r'(\1)^3'), (r'(\d+/\d+|0?\.\d+) of (%s)' % _ATOM, r'(\1*\2)'),
     (r'(%s) (?:percent|%%) of (%s)' % (_ATOM, _ATOM), r'(\1/100*\2)')],
    # multiplicative
    [(r'(%s) times (%s)' % (_ATOM, _ATOM), r'(\1*\2)'), (r'(%s) (?:divided by|over) (%s)' % (_ATOM, _ATOM), r'(\1/\2)'), (r'(%s) multiplied by (%s)' % (_ATOM, _ATOM), r'(\1*\2)')],
    # additive
    [(r'(%s) (?:more than|greater than|added to) (%s)' % (_ATOM, _ATOM), r'(\2+\1)'), (r'(%s) (?:less than|fewer than|subtracted from) (%s)' % (_ATOM, _ATOM), r'(\2-\1)'),
     (r'(%s) (?:increased by|plus|added to|and) (%s)' % (_ATOM, _ATOM), r'(\1+\2)'), (r'(%s) (?:decreased by|minus|reduced by|less) (%s)' % (_ATOM, _ATOM), r'(\1-\2)'),
     (r'(%s) (?:exceeds) (%s) by (%s)' % (_ATOM, _ATOM, _ATOM), r'(\1-\2)=\3')],
]


def english_to_math(sentence, two=False):
    s = ' ' + sentence.lower().strip().rstrip('.') + ' '
    s = s.replace(',', ' ')
    s = re.sub(r'\b(?:the|a|an)\s+(?:certain|unknown|mystery|secret)\s+number\b', ' x ', s)
    if two:
        s = re.sub(r'\b(?:the\s+)?(?:first|one|larger|bigger|greater)\s+(?:number|of the numbers|one|of them)\b|\bone number\b', ' x ', s)
        s = re.sub(r'\b(?:the\s+)?(?:second|other|smaller|lesser)\s+(?:number|one)?\b|\bthe other\b', ' y ', s)
        s = re.sub(r'\btheir sum\b|\bthe sum of (?:the|these|those)?\s*(?:two\s+|2\s+)?numbers\b', ' (x+y) ', s)
        s = re.sub(r'\btheir difference\b|\bthe difference (?:of|between) (?:the|these)?\s*(?:two\s+|2\s+)?numbers\b', ' (x-y) ', s)
        s = re.sub(r'\btheir product\b|\bthe product of (?:the|these)?\s*(?:two\s+|2\s+)?numbers\b', ' (x*y) ', s)
        s = re.sub(r'\btheir quotient\b', ' (x/y) ', s)
    s = re.sub(r'\b(?:a|the|some|my|this|that)\s+number\b|\bthe unknown\b', ' x ', s)
    s = re.sub(r'\bnumbers?\b', ' ', s)
    s = re.sub(r'\b(?:is equal to|equals|is the same as|is|was|will be|gives|yields|results in|makes|totals|amounts to|comes to|you get|we get|i get)\b', ' = ', s)
    s = re.sub(r'\b(?:is|=)\s+(?:greater than|more than) or equal to\b', ' >= ', s)
    s = re.sub(r'=\s+at least\b', ' >= ', s)
    s = re.sub(r'=\s+at most\b|=\s+no more than\b', ' <= ', s)
    s = re.sub(r'=\s+(?:greater|more) than\b(?!\s*' + _ATOM + r'\s+(?:=|$))', ' > ', s)
    s = re.sub(r'=\s+less than\b(?!\s*' + _ATOM + r'\s+(?:=|$))', ' < ', s)
    s = re.sub(r'\b(?:if|when|and|then|so|what)\b\s*(?=\s*=)', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    s = re.sub(r'\s*\(\s*', '(', s)
    s = re.sub(r'\s*\)\s*', ') ', s).strip()
    for _ in range(40):
        changed = False
        for level in _LEVELS:
            for pat, rep in level:
                new = re.sub(pat, rep, s, count=1)
                if new != s:
                    s = new
                    changed = True
                    break
            if changed:
                break
        if not changed:
            break
    s = re.sub(r'\b(?:by|of|the|than)\b', ' ', s)
    s = re.sub(r'\s+', '', s)
    if not re.fullmatch(r'[0-9xyz+\-*/^().=<>]+|.*Abs\(.*|.*sqrt\(.*', s):
        return None
    if not re.search(r'[xyz]', s) or not re.search(r'[=<>]', s):
        return None
    return s


def solve_algebra(text):
    t = words_to_numbers(text)
    low = t.lower()
    # consecutive integers
    m = re.search(r'(?:the\s+)?sum of (\d+) consecutive (even |odd )?(?:integers|numbers|whole numbers)\s+(?:is|=|equals)\s+(-?\d+)', low)
    if m:
        k, kind, total = int(m.group(1)), m.group(2), int(m.group(3))
        step = 2 if kind else 1
        x = Symbol('x')
        expr = sum(x + step * i for i in range(k))
        sol = sp.solve(Eq(expr, total), x)
        if not sol or not sol[0].is_integer:
            return {'input': None, 'label': 'Algebra', 'interp': 'Consecutive integers', 'pods': [{'title': 'No whole-number answer', 'text': 'No %d consecutive %sintegers add up to %d.' % (k, kind or '', total)}]}
        nums = [sol[0] + step * i for i in range(k)]
        return {'input': None, 'label': 'Algebra', 'interp': 'Consecutive integers', 'pods': [
            {'title': 'The numbers', 'big': True, 'text': ', '.join(map(str, nums))},
            {'title': 'Equation', 'latex': sp.latex(Eq(expr, total)) + r' \;\Rightarrow\; x = %s' % sol[0]}]}
    two = bool(re.search(r'\b(?:two|2) numbers\b|\bthe other\b|\bsecond number\b|\btheir (?:sum|difference|product)\b', low))
    sentences = [s for s in re.split(r'(?<=[.?!;])\s+|\s+and\s+(?=(?:the|their|one|a|twice|three|two)\b)', t) if s.strip()]
    eqs, shown = [], []
    for s in sentences:
        if '?' in s or re.match(r'\s*(?:find|what|which|determine|solve|how)', s, re.I):
            continue
        e = english_to_math(s, two)
        if e:
            eqs.append(e)
            shown.append((s.strip(), e))
    if not eqs:
        return None
    try:
        rels = []
        for e in eqs:
            k = parse_rel(e)
            rels.append(mkrel(k[1], k[2], k[3]) if k[0] == 'rel' else Eq(k[1], 0))
    except Exception:
        return None
    syms = sorted(set().union(*[r.free_symbols for r in rels]), key=lambda v: v.name)
    if len(syms) > len(rels) and not any(not isinstance(r, sp.Equality) for r in rels):
        return None
    pods = [{'title': 'Translated into math', 'table': [[a, b.replace('*', '·')] for a, b in shown]}]
    if any(not isinstance(r, sp.Equality) for r in rels):
        sol = sp.solveset(rels[0], syms[0], sp.S.Reals) if len(rels) == 1 else sp.reduce_inequalities(rels, syms[0]).as_set()
        nice = sol
        v0 = syms[0]
        if isinstance(sol, sp.Interval):
            if sol.end == sp.oo:
                nice = (v0 > sol.start) if sol.left_open else (v0 >= sol.start)
            elif sol.start == -sp.oo:
                nice = (v0 < sol.end) if sol.right_open else (v0 <= sol.end)
            else:
                nice = sol.as_relational(v0)
        pods.append({'title': 'Solution', 'latex': sp.latex(nice) + r'\qquad ' + sp.latex(sol), 'text': sp.sstr(nice), 'big': True})
    else:
        sols = sp.solve(rels, syms, dict=True)
        if not sols:
            pods.append({'title': 'No solution', 'text': 'These conditions contradict each other.'})
        for so in sols:
            pods.append({'title': 'Answer', 'big': True, 'latex': r',\quad '.join('%s = %s' % (sp.latex(k), sp.latex(v)) for k, v in so.items()), 'text': ', '.join('%s = %s' % (k, sp.sstr(v)) for k, v in so.items())})
        if len(rels) == 1 and len(syms) == 1:
            st = linear_steps(rels[0], syms[0])
            if st:
                pods[-1]['steps'] = st
        if sols:
            chk = all(sp.simplify(r.lhs.subs(sols[0]) - r.rhs.subs(sols[0])) == 0 for r in rels)
            pods.append({'title': 'Check', 'text': 'Substituting back: ' + '; '.join('%s = %s → %s = %s' % (sp.sstr(r.lhs), sp.sstr(r.rhs), sp.sstr(sp.simplify(r.lhs.subs(sols[0]))), sp.sstr(sp.simplify(r.rhs.subs(sols[0])))) for r in rels) + (' ✓' if chk else '')})
    return {'input': None, 'label': 'Algebra', 'interp': 'Word problem → equations', 'pods': pods}


def linear_steps(eq, v):
    """Explain solving a linear equation a·x + b = c·x + d step by step."""
    try:
        L_, R_ = sp.expand(eq.lhs), sp.expand(eq.rhs)
        if sp.Poly(L_ - R_, v).degree() != 1:
            return None
    except Exception:
        return None
    steps = [{'rule': 'Start with the equation', 'latex': sp.latex(Eq(eq.lhs, eq.rhs, evaluate=False))}]
    if not (sp.srepr(L_) == sp.srepr(eq.lhs) and sp.srepr(R_) == sp.srepr(eq.rhs)):
        steps.append({'rule': 'Expand both sides', 'latex': sp.latex(Eq(L_, R_, evaluate=False))})
    a = L_.coeff(v) - R_.coeff(v)
    const_l = L_.subs(v, 0)
    const_r = R_.subs(v, 0)
    if R_.coeff(v) != 0:
        steps.append({'rule': 'Move the %s terms to the left: subtract %s from both sides' % (v, sp.sstr(R_.coeff(v) * v)), 'latex': sp.latex(Eq(a * v + const_l, const_r, evaluate=False))})
    if const_l != 0:
        steps.append({'rule': '%s %s on both sides' % ('Subtract' if const_l > 0 else 'Add', sp.sstr(abs(const_l))), 'latex': sp.latex(Eq(a * v, const_r - const_l, evaluate=False))})
    if a != 1:
        steps.append({'rule': 'Divide both sides by %s' % sp.sstr(a), 'latex': sp.latex(Eq(v, sp.simplify((const_r - const_l) / a)))})
    return steps


# ============================================================
# 6. Story arithmetic
# ============================================================
_GIVE = r'gives?|gave|giving|eats?|ate|eaten|sells?|sold|loses?|lost|spends?|spent|uses?|used|breaks?|broke|donates?|donated|throws? away|threw away|takes? away|took away|removes?|removed|subtracts?|pays?|paid|drinks?|drank|leaves?|left with|fewer|less|minus|pops?|popped|flew away|ran away|left'
_GET = r'gets?|got|buys?|bought|finds?|found|receives?|received|adds?|added|picks?|picked|collects?|collected|earns?|earned|wins?|won|makes?|made|more|another|gains?|gained|joins?|joined|plus|saves?|saved|grows?|grew'


def solve_story(text):
    if len(extract_quantities(text)) >= 2:
        return None
    t = words_to_numbers(text)
    low = t.lower().replace(',', '')
    nums = [(m.group(0), m.start()) for m in re.finditer(r'\$?\d+(?:\.\d+)?', low)]
    if not 2 <= len(nums) <= 6 or '?' not in low and not re.search(r'\b(?:how many|how much|find|what)\b', low):
        return None
    vals = [float(n.strip('$')) for n, _ in nums]
    money = '$' in low or re.search(r'dollars?|cents?', low)
    q = low[low.rfind('.', 0, low.find('?')) + 1:] if '?' in low else low
    unit = (lambda m: m.group(1) if m else '')(re.search(r'how (?:many|much)\s+(\w+)', q))
    out = lambda v: ('$%.2f' % v) if money else '%s%s' % (_fmt(v, 8), (' ' + unit) if unit and unit not in ('more', 'does', 'do', 'did', 'is', 'are', 'will', 'money') else '')
    # equal sharing / per group
    if len(vals) == 2 and re.search(r'equally|evenly|each (?:get|gets|receive|person|friend|student|box|bag|group|row)|per (?:person|box|bag|group|row|student)|split|share|divided (?:among|between|into)|into (?:groups|bags|boxes|rows) of', low) and not re.search(r'each (?:has|have|had|cost|costs|contains?|holds?)', low):
        a, b = vals
        big_, small = max(a, b), min(a, b)
        quot, rem = divmod(big_, small) if not money else (big_ / small, 0)
        steps = [{'rule': 'Share %s equally among %s' % (_fmt(big_), _fmt(small)), 'latex': r'%s \div %s = %s' % (_fmt(big_), _fmt(small), _fmt(big_ / small, 8))}]
        txt = out(big_ / small) if (rem == 0 or money) else '%s each, with %s left over' % (_fmt(quot), _fmt(rem))
        return {'input': None, 'label': 'Word problem', 'interp': 'Division (equal sharing)', 'pods': [{'title': 'Answer', 'big': True, 'text': txt, 'steps': steps}]}
    if len(vals) == 2 and re.search(r'\beach\b|\bper\b|\bevery\b|\bholds?\b|\bcontains?\b|\bfits?\b|\bcomes? with\b|times as many|groups? of|rows? of|packs? of|boxes? of|bags? of', low) and re.search(r'how many|how much|total|altogether|in all', q):
        a, b = vals
        m_times = re.search(r'(\d+(?:\.\d+)?)\s+times as (?:many|much)', low)
        return {'input': None, 'label': 'Word problem', 'interp': 'Multiplication', 'pods': [{'title': 'Answer', 'big': True, 'text': out(a * b), 'steps': [{'rule': 'Equal groups: multiply' if not m_times else '“times as many” means multiply', 'latex': r'%s \times %s = %s' % (_fmt(a), _fmt(b), _fmt(a * b, 8))}]}]}
    if len(vals) == 2 and re.search(r'how many more|how much more|how many fewer|how much less|difference|how much (?:taller|older|longer|heavier|bigger)', q):
        a, b = vals
        return {'input': None, 'label': 'Word problem', 'interp': 'Comparison (subtraction)', 'pods': [{'title': 'Answer', 'big': True, 'text': out(abs(a - b)), 'steps': [{'rule': 'Compare by subtracting the smaller from the larger', 'latex': r'%s - %s = %s' % (_fmt(max(a, b)), _fmt(min(a, b)), _fmt(abs(a - b), 8))}]}]}
    # sequential add / subtract
    total = vals[0]
    steps = [{'rule': 'Start with %s' % _fmt(vals[0]), 'latex': _fmt(vals[0])}]
    for (n, pos), v in zip(nums[1:], vals[1:]):
        before = low[max(0, pos - 45):pos]
        nxt = re.search(r'\d', low[pos + len(n):])
        after = low[pos + len(n):pos + len(n) + (nxt.start() if nxt else 30)][:30]
        win = re.split(r'[.!?]|\band\b|,', before)[-1]
        gb = list(re.finditer(r'\b(?:%s)\b' % _GIVE, win))
        tb = list(re.finditer(r'\b(?:%s)\b' % _GET, win))
        if gb or tb:
            last_give = gb[-1].start() if gb else -1
            last_get = tb[-1].start() if tb else -1
            give = gb[-1] if last_give > last_get else None
            get = tb[-1] if last_get > last_give else None
        else:
            give = re.search(r'\b(?:%s)\b' % _GIVE, after)
            get = re.search(r'\b(?:%s)\b' % _GET, after)
            if give and get:
                give, get = (give, None) if give.start() < get.start() else (None, get)
        if give:
            total -= v
            steps.append({'rule': '“%s” means take away %s' % (give.group(0), _fmt(v)), 'latex': r'%s - %s = %s' % (_fmt(total + v), _fmt(v), _fmt(total, 8))})
        else:
            total += v
            steps.append({'rule': ('“%s” means add %s' % (get.group(0), _fmt(v))) if get else 'Add %s' % _fmt(v), 'latex': r'%s + %s = %s' % (_fmt(total - v), _fmt(v), _fmt(total, 8))})
    if not re.search(r'left|remain|now|in all|altogether|total|have|has|does|will|are there|is there', q):
        return None
    return {'input': None, 'label': 'Word problem', 'interp': 'Addition and subtraction', 'pods': [{'title': 'Answer', 'big': True, 'text': out(total), 'steps': steps, 'note': 'Worked out from the action words in the problem. Check that each step matches the story.'}]}


# ============================================================
# Entry point
# ============================================================
SOLVERS = [('formula', solve_formula), ('geometry', solve_geometry), ('percent', solve_percent), ('rates', solve_rates), ('algebra', solve_algebra), ('story', solve_story)]


def op_wordproblem(req):
    text = req['text'].strip()
    for name, fn in SOLVERS:
        try:
            r = fn(text)
        except Exception:
            r = None
        if r:
            r['solver'] = name
            return r
    return {'input': None, 'pods': [], 'notunderstood': True}


def op_check(req):
    """Check whether a proposed answer satisfies an equation: {'expr': 'x^2-9=0', 'answer': 'x=3'}"""
    rels = []
    for part in split_top(req['expr'], seps=(',', ';')):
        k = parse_rel(part)
        rels.append(mkrel(k[1], k[2], k[3]) if k[0] == 'rel' else Eq(k[1], 0))
    subs = {}
    for part in split_top(req['answer'], seps=(',', ';', ' and ')):
        if '=' in part:
            a, b = part.split('=', 1)
            subs[Symbol(a.strip())] = P(b)
    if not subs:
        v = free_vars(rels[0])
        if len(v) == 1:
            subs[v[0]] = P(req['answer'])
    oks, lines = [], []
    for rel in rels:
        lhs, rhs = sp.simplify(rel.lhs.subs(subs)), sp.simplify(rel.rhs.subs(subs))
        ok = bool(rel.subs(subs) == True) if not isinstance(rel, sp.Equality) else sp.simplify(lhs - rhs) == 0
        oks.append(ok)
        lines.append(r'%s \;\Rightarrow\; %s \;%s\; %s' % (sp.latex(rel), sp.latex(lhs), '=' if ok else r'\neq', sp.latex(rhs)))
    ok = all(oks)
    names = ', '.join('%s = %s' % (a, sp.sstr(b)) for a, b in subs.items())
    pods = [{'title': 'Correct ✓' if ok else 'Not correct ✗', 'big': True, 'text': ('Yes, %s satisfies %s.' % (names, 'every equation' if len(rels) > 1 else 'the equation')) if ok else 'No: the two sides don’t match%s.' % (' in at least one equation' if len(rels) > 1 else ''), 'error': not ok},
            {'title': 'Substitution', 'latex': r' \\ '.join(lines)}]
    if not ok:
        try:
            vs = list(subs.keys())
            sol = sp.solve(rels, vs, dict=True)
            pods.append({'title': 'The actual solution', 'text': '; '.join(', '.join('%s = %s' % (a, sp.sstr(b)) for a, b in so.items()) for so in sol) or 'No solution'})
        except Exception:
            pass
    return {'input': r', '.join(sp.latex(r) for r in rels), 'pods': pods}


OPS['wordproblem'] = op_wordproblem
OPS['check'] = op_check
