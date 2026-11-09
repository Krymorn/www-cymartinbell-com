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
    elif re.search(r'km/h|kph', units_used) or (re.search(r'\bkm\b|kilomet', units_used) and _PREF.get('time') == 'h'):
        _PREF['speed'] = 'km/h'
    elif imperial is None and _PREF.get('time') == 'h' and _PREF.get('length') == 'mi':
        _PREF['speed'] = 'mph'
    asked_u = re.search(r'in\s+(km per hour|km/h|kph|kilometers per hour|miles per hour|mph|m/s|meters per second|hours|minutes|seconds|km|kilometers|miles|meters|feet)\b', text.lower()[-80:])
    if asked_u:
        au = asked_u.group(1)
        if re.match(r'km per hour|km/h|kph|kilometers per hour', au): _PREF['speed'] = 'km/h'
        elif re.match(r'miles per hour|mph', au): _PREF['speed'] = 'mph'
        elif re.match(r'm/s|meters per second', au): _PREF['speed'] = 'm/s'
        elif au == 'hours': _PREF['time'] = 'h'
        elif au == 'minutes': _PREF['time'] = 'min'
        elif au == 'seconds': _PREF['time'] = 's'
        elif au in ('km', 'kilometers'): _PREF['length'] = 'km'
        elif au == 'miles': _PREF['length'] = 'mi'
        elif au == 'meters': _PREF['length'] = 'm'
        elif au == 'feet': _PREF['length'] = 'ft'
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


_ONEPARAM = {
    'square': ('s', {'perimeter': lambda t: 4 * t, 'area': lambda t: t ** 2, 'diagonal': lambda t: t * sqrt(2)}),
    'circle': ('r', {'circumference': lambda t: 2 * pi * t, 'area': lambda t: pi * t ** 2, 'diameter': lambda t: 2 * t}),
    'cube': ('s', {'volume': lambda t: t ** 3, 'surface area': lambda t: 6 * t ** 2}),
    'sphere': ('r', {'volume': lambda t: Rational(4, 3) * pi * t ** 3, 'surface area': lambda t: 4 * pi * t ** 2}),
    'equilateral triangle': ('s', {'perimeter': lambda t: 3 * t, 'area': lambda t: sqrt(3) / 4 * t ** 2}),
}


def solve_geometry(text):
    text = re.sub(r'(\d+(?:\.\d+)?)\s*(feet|ft|meters?|m|yards?|yd|inches|in|cm)\s+of\s+(?:fencing|fence|trim|border|edging|ribbon|rope)\b', r'a perimeter of \1 \2', text, flags=re.I)
    text = re.sub(r'\b(?:each|every)\s+side\s+of\s+(?:an?|the)\s+([a-z ]+?)\s+(?:is|measures)\s+(\d+(?:\.\d+)?)', r'\1 with side \2', text, flags=re.I)
    low = re.sub(r'\bsquare (?=(?:feet|foot|ft|meters?|metres?|m|cm|centimeters?|inches|inch|in|miles?|mi|km|kilometers?|yards?|yd|units?)\b)', 'sq ', text.lower())
    if re.search(r'\b(?:more|less|fewer|longer|shorter|wider) than\b|\btimes (?:as|the)\b|\btwice\b', low):
        return None   # "the length is 3 more than twice the width": a relations problem
    shape = next((s for s in _SHAPES if re.search(r'\b%s\b' % s, low)), None)
    lw = {k: re.search(r'(\d+(?:\.\d+)?)%s\s+%s' % (_LUNIT, k), low) for k in ('long', 'wide', 'deep', 'high', 'tall')}
    if not shape and lw['long'] and lw['wide']:
        shape = 'box' if (lw['deep'] or lw['high'] or lw['tall']) else 'rectangle'
        d0 = {'l': float(lw['long'].group(1)), 'w': float(lw['wide'].group(1))}
        hh = lw['deep'] or lw['high'] or lw['tall']
        if hh:
            d0['h'] = float(hh.group(1))
        unit0 = lw['long'].group(2)
    else:
        d0, unit0 = None, None
    if not shape and re.search(r'\b(?:radius|diameter)\b', low) and re.search(r'\b(?:wheel|pizza|plate|coin|clock|pond|pool|table|tire|tyre|garden|rug|cake|pie|ring|track|fountain|disk|disc|lid|cookie|frisbee)\b', low):
        shape = 'circle'
    if not shape:
        if re.search(r'pythag|hypotenuse', low):
            shape = 'right triangle'
        else:
            return None
    d, unit = _dims(low)
    if d0:
        d.update(d0); unit = unit or unit0
        if unit in ('feet', 'foot'):
            unit = 'ft'
    given = None
    if shape in _ONEPARAM and not any(k in d for k in ('s', 'r', 'd')):
        # Work backwards from a measurement: "the perimeter of a square is 48 cm"
        for meas, f in _ONEPARAM[shape][1].items():
            m = re.search(r'\b%s\b[^.?\d]{0,30}?(?:is|of|=|measures|equals)\s*(\d+(?:\.\d+)?)%s' % (meas, _LUNIT), low) or re.search(r'(\d+(?:\.\d+)?)%s\s+%s' % (_LUNIT, meas), low)
            if m:
                t = Symbol('t', positive=True)
                sol = sp.solve(Eq(f(t), sp.nsimplify(m.group(1))), t)
                if sol:
                    d[_ONEPARAM[shape][0]] = float(sol[0]); unit = unit or (m.group(2) if m.lastindex and m.lastindex >= 2 else None)
                    given = (meas, m.group(1), _ONEPARAM[shape][0], sol[0])
                    break
    # One dimension missing but a measurement given: "length 15 cm and area 120", "volume 300 and radius 5"
    MULTI = {'rectangle': (('l', 'w'), {'area': lambda v: v['l'] * v['w'], 'perimeter': lambda v: 2 * (v['l'] + v['w'])}),
             'box': (('l', 'w', 'h'), {'volume': lambda v: v['l'] * v['w'] * v['h']}), 'rectangular prism': (('l', 'w', 'h'), {'volume': lambda v: v['l'] * v['w'] * v['h']}),
             'cylinder': (('r', 'h'), {'volume': lambda v: pi * v['r'] ** 2 * v['h'], 'lateral area': lambda v: 2 * pi * v['r'] * v['h']}),
             'cone': (('r', 'h'), {'volume': lambda v: pi * v['r'] ** 2 * v['h'] / 3}), 'triangle': (('b', 'h'), {'area': lambda v: v['b'] * v['h'] / 2})}
    if shape in MULTI and d:
        if 'd' in d and 'r' not in d:
            d['r'] = d['d'] / 2
        keys, forms = MULTI[shape]
        missing = [k for k in keys if k not in d]
        if len(missing) == 1:
            for meas, f in forms.items():
                mm = re.search(r'\b%s\b[^.?\d]{0,30}?(?:is|of|=|measures|equals)\s*(\d+(?:\.\d+)?)' % meas, low)
                if mm:
                    t = Symbol('t', positive=True)
                    vals = {k: (t if k == missing[0] else sp.nsimplify(d[k])) for k in keys}
                    sol = sp.solve(Eq(f(vals), sp.nsimplify(mm.group(1))), t)
                    if sol:
                        d[missing[0]] = float(sol[0])
                        nm = {'l': 'length', 'w': 'width', 'h': 'height', 'r': 'radius', 'b': 'base'}[missing[0]]
                        given = (meas, mm.group(1), missing[0], sol[0], nm)
                    break
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
    qpart = re.split(r'(?<=[.!])\s+', low.split('?')[0])[-1] if '?' in low else re.split(r'(?<=[.!])\s+', low.strip())[-1]
    asks = re.findall(r'(area|perimeter|circumference|volume|surface area|hypotenuse|diagonal|slant height|other leg|height|side length|side|radius|diameter|width|length|base)', qpart)
    if given:
        asks = [a_ for a_ in asks if a_ != given[0]]
    if asks:
        res.sort(key=lambda x: 0 if asks[-1] in x[0].lower() else 1)
    pods = [{'title': 'Shape', 'text': '%s with %s' % (shape.capitalize(), ', '.join('%s = %s' % (k, v if not isinstance(v, list) else ', '.join(_fmt(x) for x in v)) for k, v in d.items()) + U)}]
    for i, (name, e, p) in enumerate(res):
        if p is None:
            pods.append({'title': name, 'text': str(e)})
            continue
        u = (U + ('²' if p == 2 else '³' if p == 3 else '')) if U else (' square units' if p == 2 else ' cubic units' if p == 3 else ' units')
        approx = float(N(e))
        exact = sp.latex(sp.simplify(e))
        pods.append({'title': name, 'latex': exact + (r' \approx %s' % _fmt(approx, 6) if not e.is_Integer and not e.is_Rational else '') + r'\text{%s}' % u, 'text': '%s%s' % (_fmt(approx, 6), u), 'big': i == 0})
    if given:
        nm = given[4] if len(given) > 4 else {'s': 'side', 'r': 'radius'}[given[2]]
        pods.insert(1, {'title': 'Worked backwards', 'text': 'The %s is %s, so the %s is %s%s.' % (given[0], given[1], nm, _fmt(float(N(given[3])), 6), U), 'latex': r'%s = %s \Rightarrow %s = %s' % (given[0].replace(' ', r'\ '), given[1], given[2], sp.latex(given[3]))})
        if asks and asks[-1] in ('side', 'side length', 'radius', 'width', 'length', 'height', 'base') or re.search(r'what is (?:its|the) (?:width|length|height|side|radius|base)|how (?:long|wide|tall|high) is', low):
            pods.insert(0, {'title': nm.capitalize(), 'big': True, 'text': '%s%s' % (_fmt(float(N(given[3])), 6), U)})
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
def solve_rates_together(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    return solve_rates(text) if re.search(r'together|working together|both|at the same time|combined|simultaneously', low) else None


def solve_rates(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    if re.search(r'together|working together|both|at the same time|combined|simultaneously', low):
        times = re.findall(r'(?:in|takes?|took|needs?)\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|days?)', low)
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
    m = re.search(r'(?:the\s+)?sum of (\d+) consecutive (even |odd )?(?:integers|numbers|whole numbers)\s+(?:is|=|equals)\s+(-?\d+)', low) or re.search(r'(\d+) consecutive (even |odd )?(?:integers|numbers|whole numbers)\s+(?:add up to|have a sum of|total|sum to)\s+(-?\d+)', low) or re.search(r'(\d+) (?:numbers|integers) are consecutive\s*(even |odd )?(?:integers|numbers)?[^.]*\.\s*(?:their|the) sum is (-?\d+)', low)
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
    sentences = []
    for s0 in re.split(r'(?<=[.?!;])\s+', t):
        # "the sum of a number and twice the number is 51" is one statement; "x is 5 and y is 7" is two
        if re.search(r'\b(?:sum|product|difference|quotient|average) (?:of|between)\b', s0, re.I):
            sentences.append(s0)
        else:
            sentences += re.split(r'\s+and\s+(?=(?:the|their|one|a|twice|three|two)\b)', s0)
    sentences = [s for s in sentences if s.strip()]
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
    q = _qpart(low) if '?' in low else low
    # Only simple "how many / how much" questions; "which row…", "who…" need reasoning this can't do.
    if not re.search(r'how (?:many|much)|\bfind the (?:total|sum|difference|number)|what is the (?:total|sum|difference)', q) or re.search(r'\b(?:which|who|whose|heads?|legs|wheels)\b', q + ' ' + low):
        return None
    unit = (lambda m: m.group(1) if m else '')(re.search(r'how (?:many|much)\s+(\w+)', q))
    out = lambda v: ('$%.2f' % v) if money else '%s%s' % (_fmt(v, 8), (' ' + unit) if unit and unit not in ('more', 'does', 'do', 'did', 'is', 'are', 'will', 'money') else '')
    # equal sharing / per group
    if len(vals) == 2 and re.search(r'equally|evenly|each (?:get|gets|receive|person|friend|student|box|bag|group|row)|per (?:person|box|bag|group|row|student)|split|share|divided (?:among|between|into)|into (?:groups|bags|boxes|rows) of', low) and not re.search(r'each (?:\w+ )?(?:has|have|had|cost|costs|contains?|holds?|weighs?|comes with)|\b(?:in|on|per) each\b|\bwith \d+ \w+ (?:in|on) each', low):
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
    prev = None
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
        if not give and not get and prev is not None and re.search(r'(?:\band|,|then)\s*(?:another\s+|also\s+)?$', before):
            # "spends $18 on a book and $12.50 on lunch": the second amount uses the same action
            give, get = (prev, None) if re.fullmatch(r'(?:%s)' % _GIVE, prev.group(0)) else (None, prev)
        if give or get:
            prev = give or get
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
# 7. More story-problem templates (added after real-world testing)
# ============================================================
_NUMRE = r'(\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?)'


def _qpart(low):
    """The question sentence: the last sentence before '?' (decimals like 3.60 don't end a sentence)."""
    head = low[:low.find('?') + 1] if '?' in low else low
    parts = re.split(r'(?<=[.!?])\s+', head.strip())
    return parts[-1] if parts else head


def _numval(s):
    s = s.strip()
    m = re.fullmatch(r'(\d+)\s+(\d+)/(\d+)', s)
    if m:
        return int(m.group(1)) + int(m.group(2)) / int(m.group(3))
    return _num(s)


def _sing(w):
    w = (w or '').lower()
    for a, b in (('ies', 'y'), ('ches', 'ch'), ('shes', 'sh'), ('xes', 'x'), ('es', 'e'), ('s', '')):
        if w.endswith(a) and len(w) > len(a) + 1:
            return w[:-len(a)] + b
    return w


def _ans(title, text, steps=None, interp='', label='Word problem', extra=None):
    pod = {'title': title, 'big': True, 'text': text}
    if steps:
        pod['steps'] = steps
    return {'input': None, 'label': label, 'interp': interp, 'pods': [pod] + (extra or [])}


def _sol_steps(eqs, sol):
    st = [{'rule': 'Write an equation for each fact', 'latex': r' \\ '.join(sp.latex(e) for e in eqs)}]
    st.append({'rule': 'Solve the equations together', 'latex': r',\quad '.join('%s = %s' % (sp.latex(k), sp.latex(v)) for k, v in sol.items())})
    return st


# --- two kinds of item: tickets, coins, mixtures ---------------------------------------------
_COINS = {'penny': 0.01, 'pennies': 0.01, 'nickel': 0.05, 'nickels': 0.05, 'dime': 0.10, 'dimes': 0.10, 'quarter': 0.25, 'quarters': 0.25}


def solve_two_items(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    prices = []
    for m in re.finditer(r'\b([a-z]+)(?:\s+([a-z]+))?\s+(?:cost|costs|are|is|sell for|sells for|go for|priced at|cost us)\s+\$(\d+(?:\.\d+)?)', low):
        name = m.group(1) if m.group(1) not in ('the', 'a', 'an', 'and') else m.group(2)
        prices.append((name, float(m.group(3)), m.span()))
    for m in re.finditer(r'\$(\d+(?:\.\d+)?)\s+(?:for|per|each for)\s+(?:an?\s+|each\s+|every\s+)?([a-z]+)', low):
        prices.append((m.group(2), float(m.group(1)), m.span()))
    for m in re.finditer(r'\b([a-z]+)\s+(?:for|at)\s+\$(\d+(?:\.\d+)?)\s*(?:each|apiece|a piece|per \w+)?', low):
        if m.group(1) not in ('sells', 'sell', 'sold', 'them', 'it', 'and', 'tickets', 'items'):
            prices.append((m.group(1), float(m.group(2)), m.span()))
    forx = [(m.group(2), float(m.group(1)), m.span()) for m in re.finditer(r'\$(\d+(?:\.\d+)?)\s+(?:for|per)\s+(?:an?\s+|each\s+|every\s+)?([a-z]+)', low)]
    if len({_sing(n) for n, _, _ in forx}) == 2:
        prices = forx
    coins = [w for w in re.findall(r'\b(pennies|penny|nickels?|dimes?|quarters?)\b', low)]
    if len({_sing(c) for c in coins}) == 2 and len(prices) < 2:
        cs = []
        for c in coins:
            if _sing(c) not in [_sing(x) for x, _, _ in cs]:
                cs.append((c, _COINS[c], (0, 0)))
        prices = cs
    names = []
    for n, p, sp_ in prices:
        if _sing(n) not in [_sing(x[0]) for x in names]:
            names.append((n, p, sp_))
    if len(names) != 2:
        return None
    used = set()
    for _, _, (a, b) in names:
        used.update(range(a, b))
    count = money = None
    if re.search(r'\d\s+times as|twice as|as many|\d+\s+(?:more|fewer|less)\s+\w+\s+than', low):
        return None
    for m in re.finditer(r'(\$)?(\d+(?:\.\d+)?)(\s*(?:dollars|cents))?', low):
        if m.start() in used or m.start(2) in used:
            continue
        v = float(m.group(2))
        if m.group(1) or (m.group(3) and 'dollar' in m.group(3)):
            money = v if money is None else money
        elif m.group(3) and 'cent' in m.group(3):
            money = v / 100 if money is None else money
        elif count is None:
            count = v
    if count is None or money is None:
        return None
    (n1, p1, _), (n2, p2, _) = names
    a, b = Symbol(_sing(n1) or 'a'), Symbol(_sing(n2) or 'b')
    eqs = [Eq(a + b, int(count) if count == int(count) else count), Eq(sp.nsimplify(p1) * a + sp.nsimplify(p2) * b, sp.nsimplify(money))]
    sol = sp.solve(eqs, [a, b], dict=True)
    if not sol:
        return None
    sol = sol[0]
    q = re.search(r'how many\s+([a-z]+)', low)
    ask = None
    if q:
        for s_ in (a, b):
            if _sing(q.group(1)).startswith(s_.name[:4]) or s_.name.startswith(_sing(q.group(1))[:4]):
                ask = s_
    bad = any(v < 0 or not v.is_integer for v in sol.values())
    noun = (re.search(r'how many\s+[a-z]+\s+([a-z]+)\s+(?:were|are|did|do|does|was)', low) or [None, ''])[1]
    text_ = ('%s %s%s' % (sol[ask], n1 if ask == a else n2, (' ' + noun) if noun else '')) if ask is not None else ', '.join('%s %s' % (sol[s_], nm) for s_, nm in ((a, n1), (b, n2)))
    extra = [{'title': 'Both amounts', 'table': [[n1, str(sol[a])], [n2, str(sol[b])]]}]
    if bad:
        extra.append({'title': 'Heads up', 'text': 'The answer isn’t a whole, positive number, so check the numbers in the problem.'})
    return _ans('Answer', text_, _sol_steps(eqs, sol), 'Two kinds of item (system of equations)', extra=extra)


# --- ages ------------------------------------------------------------------------------------
_MULT = {'twice': 2, 'double': 2, 'thrice': 3, 'triple': 3, 'half': Rational(1, 2), '1/2': Rational(1, 2)}


def _mult(s):
    m = re.search(r'(\d+(?:\.\d+)?|\d+/\d+)\s+times', s)
    if m:
        return sp.nsimplify(_numval(m.group(1)))
    for k, v in _MULT.items():
        if re.search(r'\b%s\b' % re.escape(k), s):
            return v
    return None


def _offset(s):
    m = re.search(r'in\s+(\d+)\s+years?|(\d+)\s+years?\s+from now', s)
    if m:
        return int(m.group(1) or m.group(2))
    m = re.search(r'(\d+)\s+years?\s+ago', s)
    if m:
        return -int(m.group(1))
    return 0


def solve_ages(text):
    low = words_to_numbers(text).replace(',', '')
    if re.search(r'\b(?:her|his|their|my)\s+(?:brother|sister|mother|father|mom|dad|son|daughter|friend|cousin|uncle|aunt|grandmother|grandfather|grandma|grandpa)\b', low, re.I):
        return None
    if not re.search(r'\bold\b|\bage', low, re.I):
        return None
    sents = [s for s in re.split(r'(?<=[.?!])\s+', low) if s.strip()]
    skip = {'In', 'How', 'What', 'The', 'If', 'When', 'Then', 'Now', 'Find', 'She', 'He', 'They', 'Her', 'His', 'Their', 'Years', 'Ago', 'Together', 'Combined'}
    people = []
    for w in re.findall(r'\b[A-Z][a-z]+\b', low):
        if w not in skip and w not in people:
            people.append(w)
    if not people:
        people = ['x']
    sym = {p: Symbol(p) for p in people}
    last = [people[0]]

    def who(s):
        found = [p for p in people if re.search(r'\b%s\b' % p, s)]
        if found:
            last[0] = found[-1]
            return found
        return [last[0]]

    eqs = []
    for s in sents:
        if '?' in s or re.match(r'\s*(?:how|what|find)', s, re.I):
            continue
        sl = s.lower()
        off_all = _offset(sl)
        m = re.search(r'(.*?)\b(\d+)\s+years?\s+(older|younger)\s+than\s+(.*)', s)
        if m and len(people) >= 2:
            a = who(m.group(1))[0]; b_ = [p for p in people if re.search(r'\b%s\b' % p, m.group(4))] or [p for p in people if p != a]
            sign = 1 if m.group(3) == 'older' else -1
            eqs.append(Eq(sym[a], sym[b_[0]] + sign * int(m.group(2)))); continue
        m = re.search(r'sum of (?:their|the) ages\D*(\d+)|(?:together|combined),? they (?:are|will be)\D*(\d+)|ages add up to (\d+)', sl)
        if m and len(people) >= 2:
            eqs.append(Eq(sum(sym[p] + off_all for p in people), int(next(g for g in m.groups() if g)))); continue
        if ' as old as ' in sl:
            left, right = sl.split(' as old as ', 1)
            k = _mult(left)
            if k is None:
                continue
            lp = who(s.split(' as old as ')[0])[0]
            rp_ = [p for p in people if re.search(r'\b%s\b' % p, s.split(' as old as ')[1])]
            rp = rp_[0] if rp_ else lp
            if rp == lp and len(people) >= 2 and not re.search(r'\b(?:she|he|they)\s+(?:was|is|will)', right):
                rp = [p for p in people if p != lp][0]
            ol = _offset(left)
            orr = _offset(right) if re.search(r'\d+\s+years?\s+ago|in\s+\d+\s+years?', right) else (ol if rp != lp else 0)
            eqs.append(Eq(sym[lp] + ol, k * (sym[rp] + orr))); continue
        m = re.search(r'\b([A-Z][a-z]+)\s+is\s+(\d+)(?:\s+years?\s+old)?\s*[.,]?$', s.strip().rstrip('.'))
        if m and m.group(1) in sym:
            eqs.append(Eq(sym[m.group(1)], int(m.group(2))))
    if not eqs:
        return None
    vs = sorted(set().union(*[e.free_symbols for e in eqs]), key=lambda v: v.name)
    if len(vs) > len(eqs):
        return None
    sol = sp.solve(eqs, vs, dict=True)
    if not sol:
        return None
    sol = sol[0]
    q = sents[-1]
    asked = [p for p in people if re.search(r'\b%s\b' % p, q)] or people
    fut = _offset(q.lower())
    txt = ', '.join('%s is %s%s' % (p if p != 'x' else 'The person', sol.get(sym[p], '?'), (' now' if not fut else '')) for p in asked if sym[p] in sol)
    if fut:
        txt += ' (in %d years: %s)' % (fut, ', '.join(str(sol[sym[p]] + fut) for p in asked if sym[p] in sol))
    return _ans('Answer', txt, _sol_steps(eqs, sol), 'Age problem', extra=[{'title': 'How', 'text': 'Each age is a variable for its age now. “In N years” adds N and “N years ago” subtracts N.'}])


# --- general proportion: two quantities given, a third asked ------------------------------------
_TIMEU = {'second': 1, 'sec': 1, 'minute': 60, 'min': 60, 'hour': 3600, 'hr': 3600, 'day': 86400, 'week': 604800}


def _qtys(s):
    out = []
    for m in re.finditer(r'(\$\s?)?' + _NUMRE + r'(?:\s*(%)|\s*-?\s*([a-z]+)(?:\s+of\s+([a-z]+))?)?', s):
        if m.group(3):
            continue
        unit = '$' if m.group(1) else (m.group(4) or '')
        if unit in ('and', 'or', 'more', 'times', 'than', 'then', 'is', 'are', 'for', 'in', 'to', 'of', 'each', 'per', 'a', 'the', 'percent'):
            unit = ''
        out.append((_numval(m.group(2)), _sing(unit), m.group(5) or '', unit))
    return out


def solve_proportion(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    if '%' in low or 'percent' in low or re.search(r'together|both work|downstream|upstream', low):
        return None
    parts = re.split(r'(?<=[.?!])\s+|,\s*(?=how|what)', low)
    qi = [i for i, p in enumerate(parts) if '?' in p or re.match(r'\s*(?:how|what|find)', p)]
    if not qi:
        return None
    given = ' '.join(parts[:qi[-1]]) or parts[qi[-1]].split('how')[0]
    ques = parts[qi[-1]]
    g, qq = _qtys(given), _qtys(ques)
    if len(g) != 2 or len(qq) != 1 or not re.search(r'how (?:much|many|long|far)|what|find', ques):
        return None
    (n1, u1, s1, r1), (n2, u2, s2, r2) = g
    n3, u3, s3, r3 = qq[0]
    if not u3 and not u1 and not u2:
        return None
    match = lambda a, b: a and b and (a == b or a[:4] == b[:4])
    if match(u3, u2) and not match(u3, u1):
        (n1, u1, s1, r1), (n2, u2, s2, r2) = (n2, u2, s2, r2), (n1, u1, s1, r1)
    elif not match(u3, u1):
        return None
    ans = n2 / n1 * n3
    unit = u2 if u2 == '$' else (r2 if abs(ans - 1) > 1e-12 and r2.endswith('s') else u2)
    conv = re.search(r'\bin\s+(seconds?|minutes?|hours?|days?)\b', ques)
    if conv and _sing(u2) in _TIMEU and _sing(conv.group(1)) in _TIMEU and _sing(conv.group(1)) != _sing(u2):
        ans = ans * _TIMEU[_sing(u2)] / _TIMEU[_sing(conv.group(1))]
        unit = _sing(conv.group(1)) + ('s' if abs(ans - 1) > 1e-12 else '')
    frac = sp.nsimplify(ans, rational=True) if abs(ans * 48 - round(ans * 48)) < 1e-9 else None
    pl = '' if abs(ans - 1) < 1e-12 or unit in ('$',) else 's'
    if unit == '$':
        val = '$%.2f' % ans
    else:
        val = '%s %s%s%s' % (_fmt(ans, 6), unit, pl if unit and not unit.endswith('s') else '', (' of ' + s2) if s2 else '')
        val = val.replace(' ', ' ', 1)
        if frac is not None and not frac.is_Integer and '/' in given:
            whole, rem = divmod(frac.p, frac.q)
            val += '  (= %s%s/%s)' % ('%d ' % whole if whole else '', rem, frac.q)
    show = lambda n, u: ('$%s' % _fmt(n)) if u == '$' else '%s %s' % (_fmt(n), u)
    steps = [{'rule': 'Find the amount for one %s' % (r1[:-1] if r1.endswith('s') and n1 != 1 else r1 or u1), 'latex': r'\frac{%s}{%s} = %s \text{ per %s}' % (_fmt(n2), _fmt(n1), _fmt(n2 / n1, 6), u1)},
             {'rule': 'Multiply by %s' % show(n3, r3 or u1), 'latex': r'%s \times %s = %s' % (_fmt(n2 / n1, 6), _fmt(n3), _fmt(n2 / n1 * n3, 6))}]
    if conv and unit != u2:
        steps.append({'rule': 'Convert %ss to %s' % (u2, unit), 'latex': r'%s \text{ %ss} = %s \text{ %s}' % (_fmt(n2 / n1 * n3, 6), u2, _fmt(ans, 6), unit)})
    return _ans('Answer', val.strip(), steps, 'Proportion (scale %s → %s)' % (show(n1, r1 or u1), show(n3, r3 or u1)))


# --- percent stacking and compound interest ---------------------------------------------------
_FREQ = {'annually': 1, 'yearly': 1, 'annual': 1, 'semiannually': 2, 'semi-annually': 2, 'quarterly': 4, 'monthly': 12, 'weekly': 52, 'daily': 365}


def solve_money_more(text):
    low = text.lower().replace(',', '')
    offs = re.findall(r'(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:off|discount)', low)
    pm = re.search(r'\$\s?(\d+(?:\.\d+)?)', low)
    if len(offs) >= 2 and pm:
        price = cur = float(pm.group(1))
        rows, steps = [['Original price', '$%.2f' % price]], []
        for o in offs:
            o = float(o)
            new = cur * (1 - o / 100)
            rows.append(['%s%% off $%.2f' % (_fmt(o), cur), '−$%.2f → $%.2f' % (cur - new, new)])
            steps.append({'rule': 'Take %s%% off $%.2f' % (_fmt(o), cur), 'latex': r'%.2f \times (1 - %s) = %.2f' % (cur, _fmt(o / 100), new)})
            cur = new
        tax = re.search(r'(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:sales\s+)?tax', low)
        if tax:
            t = float(tax.group(1)); new = cur * (1 + t / 100)
            rows.append(['Tax %s%%' % _fmt(t), '+$%.2f → $%.2f' % (new - cur, new)]); cur = new
        tot = 1 - cur / price
        return _ans('Final price', '$%.2f' % cur, steps, 'Discounts applied one after another', label='Percent', extra=[
            {'title': 'Working', 'table': rows},
            {'title': 'Note', 'text': 'Stacked discounts don’t add: together they take %s%% off, not %s%%.' % (_fmt(tot * 100, 4), _fmt(sum(float(o) for o in offs)))}])
    if 'compound' in low:
        P_ = re.search(r'\$\s?(\d+(?:\.\d+)?)|(?:invest(?:s|ed)?|deposit(?:s|ed)?|principal of|borrow(?:s|ed)?|loan of)\s+\$?(\d+(?:\.\d+)?)', low)
        r_ = re.search(r'(\d+(?:\.\d+)?)\s*(?:%|percent)', low)
        t_ = re.search(r'(\d+(?:\.\d+)?)\s*(years?|months?)', low)
        if not (P_ and r_ and t_):
            return None
        P0 = float(P_.group(1) or P_.group(2)); r = float(r_.group(1)) / 100
        t = float(t_.group(1)) / (12 if t_.group(2).startswith('month') else 1)
        cont = 'continuous' in low
        n = next((v for k, v in _FREQ.items() if k in low), 1)
        A = P0 * math.exp(r * t) if cont else P0 * (1 + r / n) ** (n * t)
        f = r'A = Pe^{rt} = %s e^{%s \cdot %s}' % (_fmt(P0), _fmt(r), _fmt(t)) if cont else r'A = P\left(1 + \frac{r}{n}\right)^{nt} = %s\left(1 + \frac{%s}{%d}\right)^{%d \cdot %s}' % (_fmt(P0), _fmt(r), n, n, _fmt(t))
        return _ans('Amount after %s %s' % (_fmt(t_.group(1)), t_.group(2)), '$%.2f' % A, [{'rule': 'Compound interest formula', 'latex': f + r' = %.2f' % A}],
                    'Compound interest, %s' % ('continuously' if cont else {1: 'yearly', 2: 'twice a year', 4: 'quarterly', 12: 'monthly', 52: 'weekly', 365: 'daily'}[n]), label='Interest',
                    extra=[{'title': 'Interest earned', 'text': '$%.2f' % (A - P0)}, {'title': 'Compared with simple interest', 'text': '$%.2f' % (P0 * r * t)}])
    return None


# --- working backwards: "had some, gave away half and 6 more, left with 10" -------------------
def solve_backwards(text):
    low = words_to_numbers(text.lower()).replace(',', ' , ')
    st = re.search(r'\b(?:had|has|have|started with|starts with|begins? with|began with|brought|took)\s+(?:some|a certain number of|an unknown number of|a number of|some number of)\b', low)
    if not st and not re.search(r'start(?:ed)? with|at first|originally|in the beginning', low):
        return None
    x = Symbol('x'); cur = x; direction = None; final = None; steps = []
    body = low[st.end():] if st else low
    for cl in re.split(r',|\bthen\b|\band\b|\.|;', body):
        cl = cl.strip()
        if not cl:
            continue
        m = re.search(r'(?:leaving|left with|has|had|have|now has|there (?:are|were)|was left with|ended up with|remaining|remains?)\s+(?:only\s+|just\s+)?\$?(\d+(?:\.\d+)?)(?:\s+(?:left|remaining))?', cl)
        if m and re.search(r'leav|left|now|remain|ended', cl):
            final = float(m.group(1)); break
        if '?' in cl or re.match(r'(?:how|what)', cl):
            continue
        g = re.search(r'\b(?:%s)\b' % _GIVE, cl); t = re.search(r'\b(?:%s)\b' % _GET, cl)
        if t and t.group(0) in ('more', 'another') and not g and direction and not re.search(r'\b(?:got|gets|bought|buys|found|finds|received|earned|won|added|picked|collected)\b', cl):
            t = None; g = None
        d = ('-' if g and (not t or g.start() < t.start()) else '+') if (g or t) else direction
        if d is None:
            continue
        am = re.search(r'(\d+/\d+)(?:\s+of)?|(\d+(?:\.\d+)?)\s*(?:%|percent)|\$?(\d+(?:\.\d+)?)', cl)
        if not am:
            continue
        direction = d
        if am.group(1) or am.group(2):
            f = sp.nsimplify(am.group(1)) if am.group(1) else sp.nsimplify(am.group(2)) / 100
            new = cur - f * cur if d == '-' else cur + f * cur
            steps.append('%s %s of what was there' % ('Remove' if d == '-' else 'Add', am.group(1) or am.group(2) + '%'))
        else:
            v = sp.nsimplify(am.group(3))
            new = cur - v if d == '-' else cur + v
            steps.append('%s %s' % ('Take away' if d == '-' else 'Add', am.group(3)))
        cur = sp.simplify(new)
    if final is None or cur == x or not steps:
        return None
    eq = Eq(cur, sp.nsimplify(final))
    sol = sp.solve(eq, x)
    if not sol:
        return None
    v = sol[0]
    return _ans('Started with', _fmt(v), [{'rule': 'Call the starting amount x and follow the story: ' + ' → '.join(steps), 'latex': sp.latex(eq)},
                                           {'rule': 'Solve for x', 'latex': 'x = %s' % sp.latex(v)}], 'Working backwards (equation)',
                extra=[{'title': 'Check', 'text': 'Start with %s, follow each step, and you end with %s.' % (_fmt(v), _fmt(cur.subs(x, v)))}])


# --- with/against a current or wind -------------------------------------------------------------
def solve_current(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    dn = re.search(r'downstream|with the (?:current|wind)|tailwind', low)
    up = re.search(r'upstream|against the (?:current|wind)|headwind|into the wind', low)
    if not (dn and up):
        return None
    dist = [(float(m.group(1)), m.start()) for m in re.finditer(r'(\d+(?:\.\d+)?)\s*(?:miles?|mi|km|kilometers?|kilometres?|meters?|m)\b', low)]
    times = [(float(m.group(1)), m.start()) for m in re.finditer(r'(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b', low)]
    unit = (re.search(r'\d\s*(miles?|mi|km|kilometers?|meters?|m)\b', low).group(1)) if dist else ''
    if not dist or len(times) < 2:
        return None
    d1 = dist[0][0]; d2 = dist[1][0] if len(dist) > 1 else d1
    pairs = sorted([(dn.start(), 'down'), (up.start(), 'up')])
    order = [p[1] for p in pairs]
    sp_ = {order[0]: (d1 / times[0][0]), order[1]: (d2 / times[1][0])}
    b, c = Symbol('b'), Symbol('c')
    eqs = [Eq(b + c, sp.nsimplify(sp_['down'])), Eq(b - c, sp.nsimplify(sp_['up']))]
    sol = sp.solve(eqs, [b, c], dict=True)[0]
    su = {'mi': 'mph', 'mile': 'mph', 'miles': 'mph', 'km': 'km/h'}.get(unit, '%s per hour' % unit)
    what = 'wind' if 'wind' in low else 'current'
    vehicle = 'plane' if 'wind' in low else 'boat'
    asks_c = re.search(r'speed of the (?:current|wind|stream|river)|(?:current|wind)\'?s? speed|how fast is the (?:current|wind)', low)
    main = ('%s %s' % (_fmt(sol[c]), su)) if asks_c else ('%s %s' % (_fmt(sol[b]), su))
    return _ans('Speed of the %s' % what if asks_c else 'Speed of the %s in still %s' % (vehicle, 'air' if what == 'wind' else 'water'), main,
                [{'rule': 'Speed with the %s = %s + %s; against it = %s − %s' % (what, vehicle, what, vehicle, what), 'latex': r'b + c = %s,\quad b - c = %s' % (_fmt(sp_['down']), _fmt(sp_['up']))},
                 {'rule': 'Add and subtract the two equations', 'latex': r'b = %s,\quad c = %s' % (_fmt(sol[b]), _fmt(sol[c]))}],
                'Speed with and against a %s' % what, extra=[{'title': 'Both speeds', 'table': [['%s (still %s)' % (vehicle.title(), 'air' if what == 'wind' else 'water'), '%s %s' % (_fmt(sol[b]), su)], [what.title(), '%s %s' % (_fmt(sol[c]), su)]]}])


# --- division that must round: buses, boxes, rows -----------------------------------------------
def solve_round_division(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    nums = [float(m) for m in re.findall(r'\d+(?:\.\d+)?', low)]
    if len(nums) != 2:
        return None
    q = _qpart(low) if '?' in low else low
    qn = re.search(r'how many\s+(?:full\s+|complete\s+|whole\s+)?([a-z]+)', q)
    if not qn:
        return None
    cont = [m.group(1) for m in re.finditer(r'\b(?:each|every|one|a|per)\s+([a-z]+)\s+(?:holds?|fits?|seats?|carries|can (?:hold|carry|take|seat|fit))', low)]
    cont += [m.group(1) for m in re.finditer(r'\b([a-z]+)\s+of\s+\d', low)]
    cont += [m.group(1) for m in re.finditer(r'\b\d+\s+(?:\w+\s+)?(?:per|in each|to a|for each)\s+([a-z]+)', low)]
    if not any(_sing(c)[:3] == _sing(qn.group(1))[:3] for c in cont) and not re.search(r'left over|leftover', q):
        return None
    big_, small = max(nums), min(nums)
    whole, rem = divmod(big_, small)
    noun = (re.search(r'how many\s+(?:full\s+)?(\w+)', q) or [None, ''])[1]
    if re.search(r'left over|leftover|remain|extra', q):
        return _ans('Left over', _fmt(rem), [{'rule': 'Divide and keep the remainder', 'latex': r'%s \div %s = %s \text{ R } %s' % (_fmt(big_), _fmt(small), _fmt(whole), _fmt(rem))}], 'Division with remainder')
    if re.search(r'full|complete|can (?:be )?(?:made|filled|fill|make)|how many .*can', q) and not re.search(r'needed|need|required|take', q):
        n_ = whole; why = 'Only complete groups count, so round down.'
    else:
        n_ = whole + (1 if rem else 0); why = 'Everyone has to fit, so round up%s.' % ((' (the last %s has only %s)' % (_sing(noun) or 'one', _fmt(rem))) if rem else '')
    return _ans('Answer', '%s %s' % (_fmt(n_), noun), [{'rule': 'Divide', 'latex': r'%s \div %s = %s' % (_fmt(big_), _fmt(small), _fmt(big_ / small, 6))}, {'rule': why, 'latex': _fmt(n_)}], 'Division, rounded to make sense')


# ============================================================
# 8. General relation problems: entities + "more than / times as many / together" sentences
#    become a system of equations. Covers most "Sam has 3 more than twice ..." story problems.
# ============================================================
_SKIPW = {'The', 'A', 'An', 'If', 'How', 'What', 'There', 'In', 'Each', 'Every', 'They', 'He', 'She', 'It', 'Together', 'Find', 'Then',
          'Now', 'When', 'Who', 'Which', 'After', 'Before', 'Both', 'Altogether', 'All', 'One', 'Two', 'Three', 'His', 'Her', 'Their', 'This',
          'That', 'These', 'Those', 'Some', 'Last', 'Next', 'On', 'At', 'For', 'Of', 'And', 'But', 'So', 'We', 'I', 'You', 'Mr', 'Mrs', 'Ms', 'Dr',
          'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December', 'Write', 'Solve', 'Let', 'Use', 'Given'}
_VERB = r'(?:will be|would be|has|have|had|is|are|was|were|weighs|weigh|weighed|costs?|cost|earns?|earned|scored?|ran|runs|reads?|read|sold|sells|collected|collects|owns|got|gets|saved|saves|spent|spends|made|makes|ate|eats|drove|drives|walked|walks|swam|swims|bought|buys|caught|catches|picked|picks|is worth|are worth|contains?|holds?|grew|grows|received|receives|baked|bakes|wrote|writes|took|takes|needs?)'


def _entities(text):
    ents = []
    def add(key, sym, pat):
        if key not in [e[0] for e in ents]:
            ents.append((key, Symbol(sym), pat))
    for m in re.finditer(r'\b(?:the\s+)?(first|second|third|larger|smaller|bigger|greater|lesser|other|largest|smallest|middle)\s+(?:number|integer|one)\b', text, re.I):
        k = m.group(1).lower()
        add(k + ' number', {'first': 'a', 'second': 'b', 'third': 'c', 'larger': 'L', 'bigger': 'L', 'greater': 'L', 'largest': 'L', 'smaller': 'S', 'lesser': 'S', 'smallest': 'S', 'middle': 'M', 'other': 'b'}[k],
            r'(?:the\s+)?%s\s+(?:number|integer|one)' % k)
    mo = re.search(r'\b(?:one|1) (number|piece|part|board|side|angle|bag|box|shelf|team|group|class|account|investment|tank|pile|car|plant|book)\b', text, re.I)
    if (mo or re.search(r'\b(?:one|1) of (?:them|the numbers)\b', text, re.I)) and re.search(r'\bthe other\b', text, re.I):
        nn = mo.group(1).lower() if mo else 'number'
        add('one ' + nn, 'a', r'\b(?:one|1) (?:%s|of (?:them|the numbers))\b' % nn)
        add('the other ' + nn, 'b', r'\bthe other(?:\s+(?:%s|one))?\b' % nn)
    if re.search(r'\b(?:rectangle|rectangular|garden|field|room|yard|lot|pool|frame|poster|court|playground|table|board)\b', text, re.I):
        for k in ('length', 'width'):
            if re.search(r'\b%s\b' % k, text, re.I):
                add(k, k[0].upper(), r'(?:the\s+|its\s+)?%s(?:\s+of\s+(?:the|a)\s+\w+)?' % k)
    for m in re.finditer(r'\b[A-Z][a-z]+\b', text):
        w = m.group(0)
        if w in _SKIPW or w.lower() in ('number', 'length', 'width'):
            continue
        add(w, w, r'\b%s\b(?:\'s)?' % w)
    for m in re.finditer(r'\b(?:her|his|their|my|your)\s+(brother|sister|mother|father|mom|dad|friend|cousin|son|daughter|uncle|aunt|grandmother|grandfather|grandma|grandpa|wife|husband|partner|teammate|classmate|neighbor|boss)\b', text):
        add(m.group(1), m.group(1), r'\b(?:her|his|their|my|your|the)\s+%s\b' % m.group(1))
    for m in re.finditer(r'\b(?:a|an|the|each)\s+([a-z]+)\s+%s\b[^.]*?\bthan\s+(?:a|an|the|each)\s+([a-z]+)' % _VERB, text, re.I):
        for g in (m.group(1), m.group(2)):
            add(_sing(g), _sing(g), r'\b(?:a|an|the|each)?\s*%ss?\b' % re.escape(_sing(g)))
    for m in re.finditer(r'as (?:many|much)\s+([a-z]+)\s+([a-z]+)\s+as\s+(?:there are\s+|she has\s+|he has\s+)?([a-z]+)\s+([a-z]+)|\d+\s+(?:more|fewer|less)\s+([a-z]+)\s+([a-z]+)\s+than\s+([a-z]+)\s+([a-z]+)', text):
        g = [x for x in m.groups() if x]
        if len(g) == 4 and _sing(g[1]) == _sing(g[3]) and g[0] not in ('of', 'the', 'there') and g[2] not in ('of', 'the', 'there'):
            # "red marbles … blue marbles": the colour/kind tells them apart
            for adj in (g[0], g[2]):
                add(adj + ' ' + _sing(g[1]), adj + '_' + _sing(g[1]), r'\b%s\s+%ss?\b' % (adj, re.escape(_sing(g[1]))))
    for m in re.finditer(r'as (?:many|much)\s+([a-z]+)\s+as\s+(?:there are\s+|she has\s+|he has\s+)?([a-z]+)|\d+\s+(?:more|fewer|less)\s+([a-z]+)\s+than\s+([a-z]+)', text):
        for g in (m.group(1), m.group(2), m.group(3), m.group(4)):
            if g and g not in ('there', 'she', 'he', 'they', 'it', 'the', 'a', 'an', 'his', 'her', 'their'):
                add(_sing(g), _sing(g), r'\b%ss?\b' % re.escape(_sing(g)))
    return ents


def _find_ent(seg, ents, prefer_last=False):
    hits = []
    for key, sym, pat in ents:
        for m in re.finditer(pat, seg, re.I):
            hits.append((m.start(), sym, key))
    if not hits:
        if re.search(r'\b(?:its|her|his|their)\s+width\b', seg, re.I):
            return next((e[1] for e in ents if e[0] == 'width'), None)
        return None
    hits.sort(key=lambda h: h[0])
    return (hits[-1] if prefer_last else hits[0])[1]


def solve_relations(text):
    low = words_to_numbers(text).replace(',', '')
    ents = _entities(low)
    if len(ents) < 2:
        return None
    syms = [e[1] for e in ents]
    eqs, used, rel = [], [], 0
    tot_seen = [False]
    sents = [s for s in re.split(r'(?<=[.!?;])\s+|\s+(?:and|while|but)\s+(?=[A-Z][a-z]+\s+%s\b)' % _VERB, low) if s.strip()]
    qs = [s for s in sents if '?' in s or re.match(r'\s*(?:how|what|find|determine|who|which)', s, re.I)]
    named = [e for e in ents if re.match(r'^[A-Z]', e[0])]
    last_named = [None]
    for s in sents:
        if s in qs and not re.search(r'\bif\b', s, re.I):
            continue
        # "she / he" refers to the last person named
        hit = [e for e in named if re.search(e[2], s)]
        if hit:
            last_named[0] = hit[0][0]
        elif last_named[0] and re.search(r'\b(?:she|he)\b', s, re.I):
            s = re.sub(r'\b(?:she|he)\b', last_named[0], s, count=1, flags=re.I)
        sl = s.lower()
        # ages: "in 12 years …", "5 years ago …" shift every age in the sentence
        aoff = 0
        if re.search(r'\bold\b|\bage', sl):
            mo = re.search(r'\bin\s+(\d+)\s+years?|(\d+)\s+years?\s+from now', sl)
            ma = re.search(r'(\d+)\s+years?\s+ago', sl)
            aoff = int(mo.group(1) or mo.group(2)) if mo else (-int(ma.group(1)) if ma else 0)
            if aoff:
                sl = re.sub(r'\bin\s+\d+\s+years?,?|\d+\s+years?\s+(?:from now|ago),?', ' ', sl)
                s = re.sub(r'\b[Ii]n\s+\d+\s+years?,?|\d+\s+years?\s+(?:from now|ago),?', ' ', s)
        # coin values: "$3.40 in dimes and quarters", "the coins are worth $1.75"
        coin_ents = [e for e in ents if e[0] in _COINS]
        mvc = re.search(r'\$(\d+(?:\.\d+)?)', sl)
        if len(coin_ents) >= 2 and mvc and not re.search(r'\b(?:more|fewer|less|than|times|twice)\b', sl):
            eqs.append(Eq(sum(sp.nsimplify(_COINS[e[0]]) * e[1] for e in coin_ents), sp.nsimplify(mvc.group(1)))); used.append(s); rel += 1; continue
        # a group total with no named parts: "There are 42 students in a club"
        if len(ents) >= 2 and not any(re.search(e[2], s, re.I) for e in ents) and not tot_seen[0]:
            mg = re.search(r'\b(?:there are|there were|has|have|had|contains|includes|is made up of)\s+(\d+)\s+([a-z]+)', sl) or (re.search(r'(\d+(?:\.\d+)?)\s*([a-z]+)\b[^.]*\b(?:cut|divided|split|broken|separated)\s+into\s+(?:2|two)\b', sl))
            if mg and _sing(mg.group(2)) not in [e[0] for e in ents]:
                eqs.append(Eq(sum(syms), sp.nsimplify(mg.group(1)))); used.append(s); rel += 1; tot_seen[0] = True; continue
            mv = re.search(r'\$(\d+(?:\.\d+)?)\s*(?:in total|total|altogether|in all|in coins)?', sl)
            coinvals = [_COINS.get(e[0]) for e in ents]
            if mv and all(coinvals):
                eqs.append(Eq(sum(sp.nsimplify(v) * e[1] for v, e in zip(coinvals, ents)), sp.nsimplify(mv.group(1)))); used.append(s); rel += 1; tot_seen[0] = True; continue
        # together / total / sum
        m = re.search(r'(?:together|altogether|combined|in all|in total|a total of|total of|sum of[^.]*? is|total is|add up to|have|has|had|cost|weigh)\D{0,25}?\$?(\d+(?:\.\d+)?)', sl)
        tot = re.search(r'\b(?:together|altogether|combined|in all|in total|total|sum|add up)\b', sl)
        if tot and not m:
            m = re.search(r'\$?(\d+(?:\.\d+)?)', sl)
        if tot and m and not re.search(r'\b(?:than|times|as many|as much)\b', sl):
            things = [e for e in ents if not re.match(r'^[A-Z]', e[0])]
            pool = things if len(things) >= 2 else ents          # "Marco has 36 marbles in all": count the marbles, not Marco
            members = [sym for key, sym, pat in pool if re.search(pat, s, re.I)]
            if len(members) < 2 or re.search(r'\b(?:they|their|all|both|fruits?|animals?|pets?|students?|people|coins|items|altogether)\b', sl):
                members = members if len(members) >= 2 else [e[1] for e in pool]
                if re.search(r'\b(?:they|all|altogether)\b', sl) and len(members) < len(pool):
                    members = [e[1] for e in pool]
            eqs.append(Eq(sum(mm + aoff for mm in members), sp.nsimplify(m.group(1)))); used.append(s); rel += 1; continue
        m = re.search(r'difference (?:between|of) (.+?) and (.+?) is\s+\$?(\d+(?:\.\d+)?)', s, re.I)
        if m:
            a, b = _find_ent(m.group(1), ents), _find_ent(m.group(2), ents)
            if a is not None and b is not None and a != b:
                eqs.append(Eq(a - b, sp.nsimplify(m.group(3)))); used.append(s); rel += 1; continue
        m = re.search(r'\b(perimeter|area)\b[^.]*?\b(?:is|of|equals|=)\s+(\d+(?:\.\d+)?)', s, re.I)
        if m and any(e[0] == 'length' for e in ents) and any(e[0] == 'width' for e in ents):
            L_, W_ = Symbol('L'), Symbol('W')
            eqs.append(Eq(2 * L_ + 2 * W_, sp.nsimplify(m.group(2))) if m.group(1).lower() == 'perimeter' else Eq(L_ * W_, sp.nsimplify(m.group(2)))); used.append(s); continue
        # comparison: E1 VERB ... (than|as) E2
        m = re.search(r'^(.*?)\b(?:%s)\b(.*?)\b(than|as)\b(.*)$' % _VERB, s, re.I)
        if m:
            a = _find_ent(m.group(1), ents, prefer_last=True)
            b = _find_ent(m.group(4), ents)
            # "Kevin has 5 more nickels than dimes": the nickels are compared, not Kevin
            in2 = _find_ent(m.group(2), ents)
            if in2 is not None and in2 != b:
                a = in2
            # "Marco has twice as many red marbles as blue marbles": compare the two kinds, not Marco
            if m.group(3).lower() == 'as':
                in4 = sorted([(mm.start(), e[1]) for e in ents for mm in re.finditer(e[2], m.group(4), re.I)])
                if len(in4) >= 2 and in4[0][1] != in4[-1][1]:
                    a, b = in4[0][1], in4[-1][1]
            if a is None and re.match(r'\s*there\b', m.group(1), re.I):
                # "there are 3 times as many apples as oranges"
                a = _find_ent(m.group(2), ents) or _find_ent(m.group(4), ents)
                b = _find_ent(m.group(4), ents, prefer_last=True)
            if a is not None and b is not None and a != b:
                mid = (m.group(2) + ' ' + m.group(3) + ' ' + m.group(4)).lower()
                k = _mult(mid)
                if k is None and re.search(r'\bas\b', m.group(3)) and re.search(r'as (?:many|much|old|long|tall|heavy|far|fast)', mid):
                    k = 1
                k = 1 if k is None else k
                add = 0
                n = re.search(r'(\d+(?:\.\d+)?)\s*(?:\w+\s+){0,2}?(more|greater|older|longer|taller|heavier|bigger|larger|extra|less|fewer|younger|shorter|lighter|smaller)', mid)
                if n:
                    add = sp.nsimplify(n.group(1)) * (1 if n.group(2) in ('more', 'greater', 'older', 'longer', 'taller', 'heavier', 'bigger', 'larger', 'extra') else -1)
                pct = re.search(r'(\d+(?:\.\d+)?)\s*%\s*(more|less)', mid)
                if pct:
                    k = 1 + sp.nsimplify(pct.group(1)) / 100 * (1 if pct.group(2) == 'more' else -1); add = 0
                eqs.append(Eq(a + aoff, k * (b + aoff) + add)); used.append(s); rel += 1; continue
        # "one number is 3 times the other", "A is twice B", "A is half of B"
        m = re.search(r'^(.*?)\b(?:%s)\s+((?:\d+(?:\.\d+)?\s+times|twice|double|triple|half|thrice)(?:\s+of)?)\s+(.+)$' % _VERB, s, re.I)
        if m:
            a = _find_ent(m.group(1), ents, prefer_last=True); b = _find_ent(m.group(3), ents)
            k = _mult(m.group(2).lower())
            if a is not None and b is not None and a != b and k is not None:
                eqs.append(Eq(a + aoff, k * (b + aoff))); used.append(s); rel += 1; continue
        # plain value: "Ben ran 10 miles"
        m = re.search(r'^(.*?)\b(?:%s)\s+\$?(\d+(?:\.\d+)?)\b(?!\s*(?:%%|times|more|less|fewer|years? older|years? younger))' % _VERB, s, re.I)
        if m:
            a = _find_ent(m.group(1), ents, prefer_last=True)
            if a is not None and not re.search(r'\b(?:than|as many|as much)\b', s, re.I):
                eqs.append(Eq(a, sp.nsimplify(m.group(2)))); used.append(s); continue
    if not eqs or not rel:
        return None
    vs = sorted(set().union(*[e.free_symbols for e in eqs]), key=lambda v: v.name)
    if len(eqs) < len(vs):
        return None
    sols = sp.solve(eqs, vs, dict=True)
    sols = [x for x in sols if all(v.is_real for v in x.values())]
    if not sols:
        return None
    sol = next((x for x in sols if all(v > 0 for v in x.values())), sols[0])
    q = ' '.join(qs) if qs else sents[-1]
    asked = [sym for key, sym, pat in ents if re.search(pat, q, re.I) and sym in sol]
    if not asked or re.search(r'\b(?:each|both|all|the numbers|dimensions|how many does each|how much does each)\b', q, re.I):
        asked = [s_ for s_ in syms if s_ in sol]
    keyof = {e[1]: e[0] for e in ents}
    name = lambda s_: keyof.get(s_, s_.name)
    unit = (re.search(r'how (?:many|much)\s+([a-z]+)', q.lower()) or [None, ''])[1]
    unit = '' if unit in ('does', 'do', 'did', 'is', 'are', 'money', 'more') else unit
    money = '$' in text and not unit
    fmtv = lambda v: ('$' + _fmt(v)) if money else _fmt(v) + (' ' + unit if unit else '')
    def one(s_):
        k = name(s_)
        if k.islower() and (' ' not in k or (k.split()[0] not in ('one', 'the', 'first', 'second', 'third', 'larger', 'smaller', 'bigger', 'greater', 'lesser', 'other', 'largest', 'smallest', 'middle'))) and k not in ('length', 'width', 'brother', 'sister', 'mother', 'father', 'friend', 'cousin', 'son', 'daughter') and not money:
            v = sol[s_]
            return '%s %s' % (_fmt(v), k if v == 1 else (k + 's' if not k.endswith('s') else k))
        return '%s: %s' % (k, fmtv(sol[s_]))
    txt = ', '.join(one(s_) for s_ in asked)
    bad = any(v < 0 for v in sol.values()) or (not money and any(not v.is_integer for v in sol.values()) and re.search(r'how many', q, re.I))
    extra = [{'title': 'All values', 'table': [[name(s_), fmtv(v)] for s_, v in sol.items()]}]
    extra.append({'title': 'Check', 'text': 'Every sentence holds with these values: ' + '; '.join('%s = %s ✓' % (sp.sstr(e.lhs.subs(sol)), sp.sstr(e.rhs.subs(sol))) for e in eqs)})
    if bad:
        extra.append({'title': 'Heads up', 'text': 'Some values are negative or not whole numbers, which is unusual for this kind of problem, so double-check how it was read.'})
    return _ans('Answer', txt, _sol_steps(eqs, sol), 'Relations between quantities (one equation per sentence)', extra=extra)


# ============================================================
# 8b. Heads and legs / wheels: "chickens and cows, 30 heads and 74 legs"
# ============================================================
_LEGS = {'chicken': 2, 'hen': 2, 'duck': 2, 'goose': 2, 'bird': 2, 'turkey': 2, 'ostrich': 2, 'person': 2, 'people': 2, 'kid': 2, 'child': 2,
         'cow': 4, 'pig': 4, 'horse': 4, 'sheep': 4, 'goat': 4, 'dog': 4, 'cat': 4, 'rabbit': 4, 'lamb': 4, 'cattle': 4, 'donkey': 4, 'spider': 8, 'insect': 6, 'ant': 6, 'beetle': 6,
         'bicycle': 2, 'bike': 2, 'motorcycle': 2, 'tricycle': 3, 'car': 4, 'truck': 4, 'wagon': 4, 'unicycle': 1, 'stool': 3, 'chair': 4, 'table': 4}


def solve_heads_legs(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    feet = re.search(r'(\d+)\s+(legs|feet|wheels)', low)
    heads = re.search(r'(\d+)\s+(heads|animals|vehicles|creatures|total|in all|altogether|of them|bikes and|seats)', low) or re.search(r'(\d+)\s+(?:\w+\s+){0,3}(?:in total|altogether|in all)', low)
    if not feet:
        return None
    kinds = []
    for w in re.findall(r'[a-z]+', low):
        sg = _sing(w) if w not in ('people', 'sheep', 'cattle', 'geese') else {'geese': 'goose'}.get(w, w)
        if sg in _LEGS and sg not in [k for k, _ in kinds]:
            kinds.append((sg, _LEGS[sg]))
    for m in re.finditer(r'([a-z]+)\s+(?:with|have|has)\s+(\d+)\s+(?:legs|wheels|feet)', low):
        sg = _sing(m.group(1))
        if sg in ('vehicle', 'animal', 'creature', 'thing', 'there', 'they', 'total') or int(m.group(2)) > 20:
            continue
        kinds = [(k, v) for k, v in kinds if k != sg] + [(sg, int(m.group(2)))]
    if len(kinds) > 2:
        pair = re.search(r'([a-z]+)\s+and\s+([a-z]+)', low)
        names2 = [_sing(pair.group(1)), _sing(pair.group(2))] if pair else []
        kk = [k for k in kinds if k[0] in names2]
        kinds = kk if len(kk) == 2 else kinds
    if len(kinds) != 2:
        return None
    if not heads:
        nums = [int(x) for x in re.findall(r'\d+', low) if int(x) != int(feet.group(1)) and int(x) not in (kinds[0][1], kinds[1][1])]
        if len(nums) != 1:
            return None
        H = nums[0]
    else:
        H = int(heads.group(1))
    F = int(feet.group(1))
    (k1, l1), (k2, l2) = kinds
    a, b = Symbol(k1), Symbol(k2)
    eqs = [Eq(a + b, H), Eq(l1 * a + l2 * b, F)]
    sol = sp.solve(eqs, [a, b], dict=True)
    if not sol:
        return None
    sol = sol[0]
    if any(v < 0 or not v.is_integer for v in sol.values()):
        return _ans('No whole-number answer', 'These numbers don’t work out', _sol_steps(eqs, sol), 'Heads and %s' % feet.group(2), extra=[{'title': 'Check the problem', 'text': 'The equations give %s, which isn’t possible for counting things.' % ', '.join('%s = %s' % (k, v) for k, v in sol.items())}])
    q = re.search(r'how many\s+([a-z]+)', low)
    ask = [s_ for s_ in (a, b) if q and _sing(q.group(1)).startswith(s_.name[:3])] or [a, b]
    plural = lambda k, v: k + ('' if v == 1 else ('' if k in ('sheep', 'people', 'cattle') else 's'))
    txt = ', '.join('%s %s' % (sol[s_], plural(s_.name, sol[s_])) for s_ in ask)
    steps = _sol_steps(eqs, sol)
    steps.insert(1, {'rule': 'Shortcut: if all %d were %ss there would be %d %s; each %s adds %d more' % (H, k1 if l1 < l2 else k2, H * min(l1, l2), feet.group(2), k2 if l1 < l2 else k1, abs(l2 - l1)), 'latex': r'\frac{%d - %d}{%d} = %s' % (F, H * min(l1, l2), abs(l2 - l1), _fmt((F - H * min(l1, l2)) / abs(l2 - l1)))})
    return _ans('Answer', txt, steps, 'Heads and %s (two equations)' % feet.group(2), extra=[{'title': 'Both', 'table': [[plural(k1, 2), str(sol[a])], [plural(k2, 2), str(sol[b])]]}])


# ============================================================
# 9. Two movers: toward each other, opposite directions, catching up
# ============================================================
def solve_two_movers(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    if not re.search(r'toward(?:s)? each other|opposite directions?|catch(?:es)? up|overtakes?|meet|apart|same direction', low):
        return None
    sp_ = [float(x) for x in re.findall(r'(\d+(?:\.\d+)?)\s*(?:mph|miles per hour|km/h|kph|kilometers per hour|km per hour|m/s|meters per second|ft/s)', low)]
    if len(sp_) < 2:
        return None
    unit = (re.search(r'\d\s*(mph|miles per hour|km/h|kph|kilometers per hour|km per hour|m/s|meters per second)', low).group(1))
    du = {'mph': 'miles', 'miles per hour': 'miles', 'km/h': 'km', 'kph': 'km', 'kilometers per hour': 'km', 'km per hour': 'km', 'm/s': 'm', 'meters per second': 'm'}.get(unit, '')
    tu = 'seconds' if unit in ('m/s', 'meters per second') else 'hours'
    v1, v2 = sp_[0], sp_[1]
    dist = re.search(r'(\d+(?:\.\d+)?)\s*(?:miles?|mi|km|kilometers?|meters?|m)\b(?:\s+apart)?', low)
    head = re.search(r'(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\s+(?:later|after|earlier|head start|ahead)', low)
    clock = re.findall(r'\b(\d{1,2})(?::(\d\d))?\s*(am|pm|a\.m\.|p\.m\.)', low)
    if not head and len(clock) >= 2:
        tt = [(int(h) % 12 + (12 if p_.startswith('p') else 0)) + (int(mn or 0) / 60) for h, mn, p_ in clock[:2]]
        if tt[1] > tt[0]:
            class _H:  # behaves like the regex match used below
                def __init__(self, v): self.v = v
                def group(self, i): return str(self.v) if i == 1 else 'hours'
            head = _H(tt[1] - tt[0]); start2 = tt[1]
    else:
        start2 = None
    if re.search(r'catch(?:es)? up|overtake|catches|same direction', low):
        if not head:
            return None
        h = float(head.group(1)) / (60 if head.group(2).startswith('min') else 1)
        slow, fast = (v1, v2) if v1 < v2 else (v2, v1)
        t = slow * h / (fast - slow)
        steps = [{'rule': 'Head start distance = slower speed × head start', 'latex': r'%s \times %s = %s' % (_fmt(slow), _fmt(h), _fmt(slow * h))},
                 {'rule': 'The faster one closes the gap at the difference in speeds', 'latex': r't = \frac{%s}{%s - %s} = %s' % (_fmt(slow * h), _fmt(fast), _fmt(slow), _fmt(t, 6))}]
        when = ''
        if start2 is not None:
            tc = start2 + t
            hh = int(tc) % 24; mm = round((tc - int(tc)) * 60)
            when = ', at %d:%02d %s' % ((hh % 12) or 12, mm, 'pm' if hh >= 12 else 'am')
        return _ans('Time to catch up', '%s %s after the second one starts%s' % (_fmt(t, 4), tu, when), steps, 'Catch-up problem',
                    extra=[{'title': 'Where', 'text': '%s %s from the start' % (_fmt(fast * t, 4), du)}])
    if not dist:
        return None
    d = float(dist.group(1))
    t = d / (v1 + v2)
    which = 'meet' if re.search(r'toward|meet', low) else 'be %s %s apart' % (_fmt(d), du)
    steps = [{'rule': 'Moving %s, the gap changes by the sum of the speeds' % ('toward each other' if which == 'meet' else 'apart'), 'latex': r'%s + %s = %s' % (_fmt(v1), _fmt(v2), _fmt(v1 + v2))},
             {'rule': 'time = distance ÷ combined speed', 'latex': r't = \frac{%s}{%s} = %s' % (_fmt(d), _fmt(v1 + v2), _fmt(t, 6))}]
    hm = '' if tu != 'hours' else ' (%d h %d min)' % (int(t), round((t - int(t)) * 60))
    return _ans('Time to %s' % ('meet' if which == 'meet' else 'reach that distance'), '%s %s%s' % (_fmt(t, 4), tu, hm), steps, 'Two movers',
                extra=[{'title': 'Distances covered', 'table': [['First (%s %s)' % (_fmt(v1), unit), '%s %s' % (_fmt(v1 * t, 4), du)], ['Second (%s %s)' % (_fmt(v2), unit), '%s %s' % (_fmt(v2 * t, 4), du)]]}])


# ============================================================
# 10. Mixtures: solutions (percent) and blends (price per unit)
# ============================================================
_AMT = r'(\d+(?:\.\d+)?)\s*(liters?|litres?|l|ml|milliliters?|gallons?|gal|quarts?|ounces?|oz|grams?|g|kg|kilograms?|pounds?|lbs?|cups?)'


def solve_mixture(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    if not re.search(r'\bmix|\bmixed|\bcombine|\bblend|solution|alloy|added to|to make|to get|to produce|to obtain', low):
        return None
    # rates: percents, or $ per unit
    items = []
    for m in re.finditer(r'(?:' + _AMT + r'\s+of\s+(?:an?\s+|the\s+)?)?(\d+(?:\.\d+)?)\s*%|(?:' + _AMT + r'\s+of\s+(?:\w+\s+){0,3}?)?(?:worth|costing|that costs?|at|selling for|priced at)\s+\$(\d+(?:\.\d+)?)\s*(?:per|a|/|each)\s*(\w+)', low):
        if m.group(3):
            items.append({'amt': float(m.group(1)) if m.group(1) else None, 'rate': float(m.group(3)) / 100, 'pos': m.start(), 'kind': '%', 'unit': m.group(2) or ''})
        else:
            items.append({'amt': float(m.group(4)) if m.group(4) else None, 'rate': float(m.group(6)), 'pos': m.start(), 'kind': '$', 'unit': m.group(5) or '', 'per': m.group(7)})
    if len(items) < 3:
        return None
    kind = items[0]['kind']
    a, b, target = items[0], items[1], items[2]
    # the target is the one after "to make / get / produce / so that / final"
    tm = re.search(r'to (?:make|get|produce|obtain|create|end up with)|so that|resulting|final|the mixture', low)
    if tm:
        after = [it for it in items if it['pos'] > tm.start()]
        if after:
            target = after[0]
            rest = [it for it in items if it is not target]
            a, b = rest[0], rest[1]
    tot = re.search(r'(?:to (?:make|get|produce|obtain|create)|total of|end up with)\s+' + _AMT, low)
    if tot and target['amt'] is None:
        target['amt'] = float(tot.group(1)); target['unit'] = tot.group(2)
    x, y = Symbol('x'), Symbol('y')
    A = a['amt'] if a['amt'] is not None else x
    B = b['amt'] if b['amt'] is not None else (y if a['amt'] is None else x)
    T = target['amt'] if target['amt'] is not None else (A + B)
    eqs = [Eq(sp.nsimplify(a['rate']) * A + sp.nsimplify(b['rate']) * B, sp.nsimplify(target['rate']) * T)]
    if target['amt'] is not None and (a['amt'] is None or b['amt'] is None):
        eqs.append(Eq(A + B, T))
    vs = sorted(set().union(*[e.free_symbols for e in eqs]), key=lambda v: v.name)
    if not vs or len(vs) > len(eqs):
        return None
    sol = sp.solve(eqs, vs, dict=True)
    if not sol:
        return None
    sol = sol[0]
    unit = next((it['unit'] for it in items if it['unit']), '') or (tot.group(2) if tot else '')
    per = next((it.get('per') for it in items if it.get('per')), 'unit')
    show = lambda r: ('%s%%' % _fmt(r * 100)) if kind == '%' else '$%s per %s' % (_fmt(r), per)
    if kind == '$' and not unit:
        unit = per + 's'
    rows = [[show(a['rate']), '%s %s' % (_fmt(A.subs(sol) if hasattr(A, 'subs') else A), unit)], [show(b['rate']), '%s %s' % (_fmt(B.subs(sol) if hasattr(B, 'subs') else B), unit)],
            ['Result: ' + show(target['rate']), '%s %s' % (_fmt(T.subs(sol) if hasattr(T, 'subs') else T), unit)]]
    txt = '; '.join('%s %s of the %s' % (_fmt(v), unit, show(a['rate'] if (k == A) else b['rate'])) for k, v in sol.items())
    return _ans('Amounts', txt, _sol_steps(eqs, sol), 'Mixture: (rate × amount) adds up', extra=[{'title': 'Mixture table', 'table': rows}])


# ============================================================
# 11. Linear growth: a starting amount plus a fixed amount per unit (phone plans, savings, growth)
# ============================================================
_PER = r'(?:per|a|an|each|every)\s+(week|month|year|day|hour|minute|text|message|mile|km|kilometer|ticket|item|person|visit|class|lesson|game|page|gallon|pound|unit|ride|night|session|call|minute)'


def solve_linear_growth(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    rates = list(re.finditer(r'(\$?)(\d+(?:\.\d+)?)\s*(?:dollars?\s*|cents?\s*|[a-z]+\s+){0,2}?' + _PER, low))
    if not rates:
        return None
    qtxt = _qpart(low) if '?' in low else low
    rate = next((r_ for r_ in rates if re.search(r'\b%ss?\b' % r_.group(3), qtxt)), rates[-1] if len(rates) > 1 else rates[0])
    fixed_other = next((r_ for r_ in rates if r_ is not rate and r_.group(3) in ('month', 'week', 'year', 'day')), None)
    if len(rates) >= 2 and re.search(r'how much|total|cost|pay|bill', qtxt):
        # "$40 per day plus $0.25 per mile … for 3 days and 100 miles": add up rate × amount for each
        rest = low
        for r_ in rates:
            rest = rest.replace(r_.group(0), ' ')
        amts, taken = [], {}
        for r_ in rates:
            u_ = r_.group(3)
            occ = [float(x) for x in re.findall(r'(\d+(?:\.\d+)?)\s+(?:[a-z]+\s+)?%ss?\b' % u_, rest)]
            i_ = taken.get(u_, 0); taken[u_] = i_ + 1
            amts.append(occ[i_] if i_ < len(occ) else None)
        if all(a_ is not None for a_ in amts):
            parts = [(float(r_.group(2)) / (100 if re.search(r'\d\s*cents?', r_.group(0)) else 1), a_, r_.group(3)) for r_, a_ in zip(rates, amts)]
            T = sum(p_ * a_ for p_, a_, _ in parts)
            return _ans('Total cost', '$%.2f' % T, [{'rule': 'Multiply each rate by how much is used, then add', 'latex': ' + '.join(r'%s \times %s' % (_fmt(p_), _fmt(a_)) for p_, a_, _ in parts) + ' = %.2f' % T}], 'Several rates added together', label='Money',
                        extra=[{'title': 'Breakdown', 'table': [['$%s per %s × %s' % (_fmt(p_), u_, _fmt(a_)), '$%.2f' % (p_ * a_)] for p_, a_, u_ in parts]}])
    if re.search(r'\d\s*(?:%|percent)', low):
        return None
    R = float(rate.group(2)) / (100 if re.search(r'\d\s*cents?', rate.group(0)) else 1)
    per = rate.group(3)
    money = bool(rate.group(1)) or '$' in low
    # starting / fixed amount
    base = re.search(r'(?:plus|and|with|has|had|starts? (?:with|at)|is|was|already|currently|now|flat fee of|fee of|base (?:fee|price|cost) of|costs?|charges?)\s+(?:an?\s+)?\$?(\d+(?:\.\d+)?)\s*(?:dollars?|feet|ft|inches|cm|meters|m|pounds|lbs|tall|high|long|in (?:the )?bank|saved)?(?!\s*(?:per|a|an|each|every)\s)', low[:rate.start()] + ' ' + low[rate.end():])
    B = 0.0
    if fixed_other is not None:
        B = float(fixed_other.group(2))      # "$25 per month plus $0.10 per text": one month's fee is the fixed part
    elif base and float(base.group(1)) != R:
        B = float(base.group(1))
    q = _qpart(low) if '?' in low else re.split(r'(?<=[.!])\s+', low.strip())[-1]
    after_n = re.search(r'(?:after|in|for|over)\s+(\d+(?:\.\d+)?)\s+%ss?' % per, low)
    total = re.search(r'(?:bill is|total (?:is|was|of)|have|has|reach|reaches|be|pays?|paid|costs?|spent|grow to|is \$?\d+ (?:tall|long))\s+\$?(\d+(?:\.\d+)?)', q) or re.search(r'(?:bill (?:is|was)|total (?:is|was)|paid)\s+\$?(\d+(?:\.\d+)?)', low)
    if re.search(r'how many|after how many|how long|when will', q) and total:
        T = float(total.group(1))
        if T in (R, B):
            return None
        n = (T - B) / R
        n_disp = _fmt(n, 6)
        steps = [{'rule': 'Total = start + rate × number of %ss' % per, 'latex': r'%s + %s n = %s' % (_fmt(B), _fmt(R), _fmt(T))},
                 {'rule': 'Solve for n', 'latex': r'n = \frac{%s - %s}{%s} = %s' % (_fmt(T), _fmt(B), _fmt(R), n_disp)}]
        unitw = (re.search(r'how many\s+([a-z]+)', q) or [None, per + 's'])[1]
        return _ans('Answer', '%s %s' % (n_disp, unitw if unitw not in ('more',) else per + 's'), steps, 'Start + rate × count', extra=[{'title': 'Check', 'text': '%s + %s × %s = %s' % (_fmt(B), _fmt(R), n_disp, _fmt(B + R * n))}])
    noun = re.search(r'\d(?:\.\d+)?\s+([a-z]+)\s+(?:per|a|an|each|every)\s', rate.group(0))
    if noun and B == 0 and re.search(r'how long|how many %ss|how much time' % per, q):
        tq = re.search(r'(\d+(?:\.\d+)?)\s+%s' % re.escape(noun.group(1)), low[rate.end():]) or re.search(r'(\d+(?:\.\d+)?)\s+%s' % re.escape(noun.group(1)), low[:rate.start()])
        if tq:
            T = float(tq.group(1)); n = T / R
            return _ans('Time', '%s %ss' % (_fmt(n, 6), per), [{'rule': 'time = amount ÷ rate', 'latex': r'\frac{%s}{%s} = %s' % (_fmt(T), _fmt(R), _fmt(n, 6))}], 'Rate × time')
    if after_n and re.search(r'how (?:much|tall|long|far|many|high|big)|what will|what is the total|find the total', q):
        n = float(after_n.group(1))
        T = B + R * n
        steps = [{'rule': 'Total = start + rate × number of %ss' % per, 'latex': r'%s + %s \times %s = %s' % (_fmt(B), _fmt(R), _fmt(n), _fmt(T))}]
        val = ('$%.2f' % T) if money else _fmt(T, 6) + ((' ' + re.search(r'\d\s*(feet|ft|inches|cm|meters|m|pounds|lbs|miles|km)\b', low).group(1)) if re.search(r'\d\s*(feet|ft|inches|cm|meters|m|pounds|lbs|miles|km)\b', low) else '')
        return _ans('Answer', val, steps, 'Start + rate × count')
    return None


# ============================================================
# 12. Inverse proportion: more workers, fewer days
# ============================================================
def solve_inverse(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    m = re.search(r'(\d+(?:\.\d+)?)\s+(workers?|people|men|women|machines?|painters?|builders?|pumps?|pipes?|printers?|cooks?|students?|friends?|trucks?|robots?|employees?|crews?)\b[^.?]*?(\d+(?:\.\d+)?)\s+(days?|hours?|minutes?|weeks?)', low)
    n = re.search(r'(?:how (?:long|many (?:days|hours|minutes|weeks))|how much time)[^?]*?(\d+(?:\.\d+)?)\s+(?:workers?|people|men|women|machines?|painters?|builders?|pumps?|pipes?|printers?|cooks?|students?|friends?|trucks?|robots?|employees?|crews?)', low)
    if not (m and n):
        return None
    a, t, b = float(m.group(1)), float(m.group(3)), float(n.group(1))
    ans = a * t / b
    unit = m.group(4) if m.group(4).endswith('s') else m.group(4) + 's'
    steps = [{'rule': 'The total work is the same: workers × time', 'latex': r'%s \times %s = %s \text{ worker-%s}' % (_fmt(a), _fmt(t), _fmt(a * t), unit)},
             {'rule': 'Share it among %s' % _fmt(b), 'latex': r'\frac{%s}{%s} = %s' % (_fmt(a * t), _fmt(b), _fmt(ans, 6))}]
    return _ans('Time', '%s %s' % (_fmt(ans, 6), unit), steps, 'Inverse proportion (more %s, less time)' % m.group(2), extra=[{'title': 'Note', 'text': 'Assumes everyone works at the same speed and the job can be shared evenly.'}])


# ============================================================
# 13. Shopping totals: "3 notebooks at $2.50 each and 2 pens at $1.25 each", change from $20
# ============================================================
def solve_shopping(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    items = re.findall(r'(\d+(?:\.\d+)?)\s+([a-z]+(?:\s+[a-z]+)?)\s+(?:at|for|costing|that cost|priced at)\s+\$(\d+(?:\.\d+)?)\s*(?:each|apiece|a piece|per \w+|an? \w+)?', low)
    q_ = _qpart(low) if '?' in low else ''
    pl = {_sing(n_): float(p_) for n_, p_ in re.findall(r'\b(?:a|an|one|each)\s+([a-z]+)\s+(?:costs?|is|sells for)\s+\$(\d+(?:\.\d+)?)', low)}
    asked = re.findall(r'(\d+)\s+([a-z]+)', q_)
    if len(pl) >= 2 and asked and all(_sing(n_) in pl for _, n_ in asked):
        items = [(c_, n_, str(pl[_sing(n_)])) for c_, n_ in asked]
        rows = [['%s %s × $%s' % (c_, n_, _fmt(pl[_sing(n_)])), '$%.2f' % (int(c_) * pl[_sing(n_)])] for c_, n_ in asked]
        tot = sum(int(c_) * pl[_sing(n_)] for c_, n_ in asked)
        return _ans('Total', '$%.2f' % tot, [{'rule': 'Multiply each quantity by its price and add', 'latex': ' + '.join(r'%s \times %s' % (c_, _fmt(pl[_sing(n_)])) for c_, n_ in asked) + r' = %.2f' % tot}], 'Shopping', label='Money', extra=[{'title': 'Receipt', 'table': rows}])
    singles = [('1', n_, p_) for n_, p_ in re.findall(r'\b(?:a|an|one|the)\s+([a-z]+(?:\s+[a-z]+)?)\s+(?:for|at|costing|that costs?|priced at)\s+\$(\d+(?:\.\d+)?)', low)]
    items = items + singles
    if len(items) < 2 and not re.search(r'change|left', low):
        items = []
    if len(items) < 1 or not re.search(r'how much|total|spend|spent|cost|change|left|pay', low):
        return None
    if len(items) == 1 and not re.search(r'change|left|tax|tip', low):
        return None
    rows, tot = [], 0.0
    for q_, name, pr in items:
        v = float(q_) * float(pr); tot += v
        rows.append(['%s %s × $%s' % (_fmt(q_), name, pr), '$%.2f' % v])
    tax = re.search(r'(\d+(?:\.\d+)?)\s*%\s*(?:sales\s+)?tax', low)
    tip = re.search(r'(\d+(?:\.\d+)?)\s*%\s*tip', low)
    if tax:
        t = tot * float(tax.group(1)) / 100; rows.append(['Tax %s%%' % tax.group(1), '$%.2f' % t]); tot += t
    if tip:
        t = tot * float(tip.group(1)) / 100; rows.append(['Tip %s%%' % tip.group(1), '$%.2f' % t]); tot += t
    paid = re.search(r'(?:pays?|paid|gave|gives|hands?|with|has|had)\s+(?:the cashier\s+|a\s+)?\$(\d+(?:\.\d+)?)(?:\s+bill)?', low)
    q = low.split('?')[0][-120:]
    if paid and re.search(r'change|left|remain', q):
        P0 = float(paid.group(1))
        return _ans('Change', '$%.2f' % (P0 - tot), [{'rule': 'Add up the items, then subtract from what was paid', 'latex': r'%.2f - %.2f = %.2f' % (P0, tot, P0 - tot)}], 'Shopping', label='Money', extra=[{'title': 'Receipt', 'table': rows + [['Total', '$%.2f' % tot]]}])
    return _ans('Total', '$%.2f' % tot, [{'rule': 'Multiply each quantity by its price and add', 'latex': ' + '.join(r'%s \times %s' % (_fmt(a_), b_) for a_, _, b_ in items) + r' = %.2f' % tot}], 'Shopping', label='Money', extra=[{'title': 'Receipt', 'table': rows + [['Total', '$%.2f' % tot]]}])


# ============================================================
# 14. Parts of a whole: "eats 3/8 of the pizza and Jerry eats 1/4. What fraction is left?"
# ============================================================
def solve_fraction_parts(text):
    low = words_to_numbers(text.lower())
    if not re.search(r'fraction|left|remain|rest|what part|how much (?:of|is)', low):
        return None
    fr = [sp.Rational(int(a), int(b)) for a, b in re.findall(r'(?<![\d.])(\d+)\s*/\s*(\d+)(?![\d/])', low)]
    pc = [sp.Rational(p_) / 100 for p_ in re.findall(r'(\d+(?:\.\d+)?)\s*%', low)]
    parts = fr + pc
    if len(parts) < 2 or sum(parts) > 1:
        return None
    whole = re.search(r'(?:cut into|divided into|has|of)\s+(\d+)\s+(slices|pieces|parts|students|pages|people|cookies|marbles|questions|members)', low)
    left = 1 - sum(parts)
    steps = [{'rule': 'Add the parts that were used', 'latex': ' + '.join(sp.latex(p_) for p_ in parts) + ' = ' + sp.latex(sum(parts))}, {'rule': 'Subtract from the whole', 'latex': '1 - %s = %s' % (sp.latex(sum(parts)), sp.latex(left))}]
    extra = [{'title': 'As a percent', 'text': '%s%%' % _fmt(float(left) * 100, 4)}]
    if whole:
        extra.insert(0, {'title': 'In %s' % whole.group(2), 'text': '%s of %s %s' % (_fmt(float(left) * int(whole.group(1)), 4), whole.group(1), whole.group(2))})
    return _ans('Fraction left', '%s' % left, steps, 'Parts of a whole', extra=extra)


# ============================================================
# 15. Chains of percent changes: markup then discount, raise then cut
# ============================================================
def solve_percent_chain(text):
    low = text.lower().replace(',', '')
    ch = []
    for m in re.finditer(r'(?:(marks? up|marked up|raises?|raised|increases?|increased|grows?|grew|rises?|rose|up)\s+(?:\S+\s+){0,4}?by\s+(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*(off|discount|markup|increase|decrease|more|less|higher|lower|raise|cut|drop)|(decreases?|decreased|drops?|dropped|falls?|fell|reduced|reduces?|cuts?|lowered|down)\s+(?:\S+\s+){0,4}?by\s+(\d+(?:\.\d+)?)\s*%)', low):
        if m.group(2):
            ch.append(float(m.group(2)))
        elif m.group(3):
            ch.append(float(m.group(3)) * (1 if m.group(4) in ('markup', 'increase', 'more', 'higher', 'raise') else -1))
        else:
            ch.append(-float(m.group(6)))
    for m in re.finditer(r'(?:then|and)\s+(?:\w+\s+){0,2}?by\s+another\s+(\d+(?:\.\d+)?)\s*%|another\s+(\d+(?:\.\d+)?)\s*%\s*(?!off)', low):
        if ch:
            v_ = float(m.group(1) or m.group(2)); ch.append(v_ if ch[-1] > 0 else -v_)
    pm = re.search(r'\$\s?(\d+(?:\.\d+)?)', low)
    if len(ch) < 2 or not pm or (all(c < 0 for c in ch) and re.search(r'\boff\b', low)):
        return None
    cur = P0 = float(pm.group(1))
    rows, steps = [['Start', '$%.2f' % cur]], []
    for c in ch:
        new = cur * (1 + c / 100)
        rows.append(['%s %s%%' % ('+' if c > 0 else '−', _fmt(abs(c))), '$%.2f' % new])
        steps.append({'rule': '%s %s%%' % ('Increase by' if c > 0 else 'Decrease by', _fmt(abs(c))), 'latex': r'%.2f \times %s = %.2f' % (cur, _fmt(1 + c / 100), new)})
        cur = new
    net = (cur / P0 - 1) * 100
    return _ans('Final price', '$%.2f' % cur, steps, 'Percent changes, one after another', label='Percent',
                extra=[{'title': 'Working', 'table': rows}, {'title': 'Net change', 'text': '%s%s%% overall (percent changes multiply; they don’t add)' % ('+' if net >= 0 else '−', _fmt(abs(net), 4))}])


# ============================================================
# 16. Quantities that build on the previous one: "45 pages on Saturday and twice as many on Sunday"
# ============================================================
def solve_sequence(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    if not re.search(r'(?:twice|\d+(?:\.\d+)?\s+times|half|triple|double) as (?:many|much)|\d+(?:\.\d+)?\s+(?:more|fewer|less)\b(?!\s+than\s+[a-z]+\s+(?:has|had|have))', low):
        return None
    if re.search(r'\bthan\s+(?:[A-Z]|her|his|their)', text) or len([w for w in re.findall(r'\b[A-Z][a-z]+\b', text) if w not in _SKIPW]) > 1:
        return None
    first = re.search(r'(\d+(?:\.\d+)?)\s+([a-z]+)', low)
    if not first:
        return None
    vals = [float(first.group(1))]
    labels = [low[max(0, first.start() - 0):first.end() + 25].split('.')[0].split(' and ')[0].strip()]
    for m in re.finditer(r'(?:and|then|,)\s+(?:\w+\s+){0,4}?((?:twice|double|triple|half|\d+(?:\.\d+)?\s+times) as (?:many|much)|(\d+(?:\.\d+)?)\s+(more|fewer|less))([^.,]*)', low[first.end():]):
        prevv = vals[-1]
        if m.group(2):
            v = prevv + float(m.group(2)) * (1 if m.group(3) == 'more' else -1)
        else:
            k = _mult(m.group(1))
            if k is None:
                return None
            v = prevv * float(k)
        vals.append(v); labels.append((m.group(0)).strip(' ,'))
    if len(vals) < 2:
        return None
    q = _qpart(low) if '?' in low else low
    unit = first.group(2)
    if re.search(r'total|altogether|in all|in total|combined|both days|all together', q):
        ans = sum(vals); title = 'Total'
    elif re.search(r'how many|how much', q):
        ans = vals[-1]; title = 'Answer'
    else:
        return None
    rows = [[l[:60], _fmt(v)] for l, v in zip(labels, vals)]
    return _ans(title, '%s %s' % (_fmt(ans), unit), [{'rule': 'Work out each amount from the one before', 'latex': ' + '.join(_fmt(v) for v in vals) + (' = %s' % _fmt(sum(vals)) if title == 'Total' else '')}], 'Amounts built from the previous one', extra=[{'title': 'Each amount', 'table': rows}])


# ============================================================
# 17. Ratios: "the ratio of boys to girls is 3:4 … 28 students"
# ============================================================
def solve_ratio(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    m = re.search(r'ratio of ([a-z]+(?: [a-z]+)?) to ([a-z]+)(?: to ([a-z]+))?(?:\s+(?:at|in|on|of|for)\s+[a-z ]+?)? (?:is|was|=)\s*(\d+(?:\.\d+)?)\s*(?::|to)\s*(\d+(?:\.\d+)?)(?:\s*(?::|to)\s*(\d+(?:\.\d+)?))?', low) \
        or re.search(r'for every (\d+(?:\.\d+)?) ([a-z]+)(?: there (?:are|is|were))? (\d+(?:\.\d+)?) ([a-z]+)', low)
    if not m:
        return None
    if m.re.pattern.startswith('for every'):
        names, parts = [m.group(2), m.group(4)], [float(m.group(1)), float(m.group(3))]
    else:
        names = [x for x in (m.group(1), m.group(2), m.group(3)) if x]
        parts = [float(x) for x in (m.group(4), m.group(5), m.group(6)) if x]
    if len(names) != len(parts):
        return None
    rest = low[:m.start()] + ' ' + low[m.end():]
    tot = re.search(r'(\d+(?:\.\d+)?)\s+(?:[a-z]+\s+)?(?:students|people|total|in all|altogether|children|kids|animals|marbles|coins|members|players|items|pets|cars|books|balls|fruits?|candies|beads|tickets|employees|workers|dollars)', rest) or re.search(r'total of \$?(\d+(?:\.\d+)?)|\$(\d+(?:\.\d+)?)', rest)
    known = [(i, float(x.group(1))) for i, n in enumerate(names) for x in [re.search(r'(\d+(?:\.\d+)?)\s+%s' % re.escape(n), rest)] if x]
    q = _qpart(low) if '?' in low else low
    if tot and not known:
        T = float(tot.group(1) or tot.group(2)); unit = T / sum(parts)
        vals = [p_ * unit for p_ in parts]
        steps = [{'rule': 'Add the ratio parts', 'latex': ' + '.join(_fmt(p_) for p_ in parts) + ' = %s' % _fmt(sum(parts))}, {'rule': 'One part is the total divided by that', 'latex': r'\frac{%s}{%s} = %s' % (_fmt(T), _fmt(sum(parts)), _fmt(unit, 6))}]
    elif known:
        i, v = known[0]; unit = v / parts[i]; vals = [p_ * unit for p_ in parts]
        steps = [{'rule': '%s %s are %s parts, so one part is %s' % (_fmt(v), names[i], _fmt(parts[i]), _fmt(unit, 6)), 'latex': r'\frac{%s}{%s} = %s' % (_fmt(v), _fmt(parts[i]), _fmt(unit, 6))}]
    else:
        return None
    asked = [i for i, n in enumerate(names) if re.search(r'\b%s' % re.escape(n[:5]), q)] or list(range(len(names)))
    if re.search(r'total|altogether|in all', q) and known:
        return _ans('Total', _fmt(sum(vals)), steps, 'Ratio', extra=[{'title': 'Each group', 'table': [[n, _fmt(v)] for n, v in zip(names, vals)]}])
    txt = ', '.join('%s %s' % (_fmt(vals[i]), names[i]) for i in asked)
    steps.append({'rule': 'Multiply each ratio number by one part', 'latex': ',\\ '.join('%s \\times %s = %s' % (_fmt(p_), _fmt(unit, 6), _fmt(v)) for p_, v in zip(parts, vals))})
    return _ans('Answer', txt, steps, 'Ratio %s' % ':'.join(_fmt(p_) for p_ in parts), extra=[{'title': 'Each group', 'table': [[n, _fmt(v)] for n, v in zip(names, vals)]}])


# ============================================================
# 18. Right-triangle situations: ladders, ramps, kites, TV diagonals
# ============================================================
def solve_right_triangle_story(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    if not re.search(r'ladder|leans?|ramp|kite|string|guy wire|wire|diagonal|across the field|walks? \d+.*(?:north|south|east|west)', low):
        return None
    L = re.search(r'(?:ladder|ramp|string|wire|rope|pole)\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*(feet|ft|foot|meters?|m|yards?|yd|inches|in|cm)\s*(?:long)?|(\d+(?:\.\d+)?)\s*-?\s*(feet|ft|foot|meters?|m|yards?|yd|inches|in|cm)(?:\s+long)?\s+(?:ladder|ramp|string|wire|rope)', low)
    D = re.search(r'(?:bottom|base|foot)[^.]*?(\d+(?:\.\d+)?)\s*(?:feet|ft|foot|meters?|m|yards?|yd|inches|in|cm)?\s*(?:from|away)', low)
    H = re.search(r'(?:reaches|touches|top)[^.]*?(\d+(?:\.\d+)?)\s*(?:feet|ft|foot|meters?|m|yards?|yd|inches|in|cm)?\s*(?:up|high)', low)
    unit = (L and (L.group(2) or L.group(4))) or ''
    if L and (D or H):
        c = float(L.group(1) or L.group(3)); a = float((D or H).group(1))
        if a >= c:
            return None
        b = math.sqrt(c * c - a * a)
        what = 'Height up the wall' if D else 'Distance from the wall'
        return _ans(what, '%s %s' % (_fmt(b, 6), unit), [{'rule': 'The %s is the hypotenuse of a right triangle' % ('ladder' if 'ladder' in low else 'long side'), 'latex': r'b = \sqrt{%s^2 - %s^2} = \sqrt{%s} = %s' % (_fmt(c), _fmt(a), _fmt(c * c - a * a), _fmt(b, 6))}], 'Pythagorean theorem', label='Geometry')
    return None


# ============================================================
# 19. Changes from a starting value: temperatures, elevations, scores, bank balances
# ============================================================
def solve_changes(text):
    low = words_to_numbers(text.lower()).replace(',', '').replace('−', '-')
    if not re.search(r'temperature|degrees?|°|elevation|altitude|sea level|balance|account|bank|stock|share price|score|depth|below|above|level|thermometer|-\d', low):
        return None
    if not re.search(r'\b(?:rose|rises|risen|increased|went up|climbed|warmed|gained|dropped|fell|falls|decreased|went down|cooled|sank|lost|descended|ascended|deposited|withdrew|withdraws)\b', low):
        return None
    st = re.search(r'(?:was|is|were|at|started at|starts at|began at|of|had|has)\s+(-?\$?-?\d+(?:\.\d+)?)', low)
    if not st:
        return None
    v0 = float(st.group(1).replace('$', ''))
    cur, steps = v0, [{'rule': 'Start at %s' % _fmt(v0), 'latex': _fmt(v0)}]
    n = 0
    for m in re.finditer(r'\b(rose|rises|increased|went up|climbed|warmed|gained|ascended|deposited|deposits|added)\s+(?:by\s+|another\s+|up\s+)?\$?(\d+(?:\.\d+)?)|\b(dropped|fell|falls|decreased|went down|cooled|sank|lost|descended|withdrew|withdraws|spent)\s+(?:by\s+|another\s+)?\$?(\d+(?:\.\d+)?)', low[st.end():]):
        if m.group(1):
            v = float(m.group(2)); cur += v; steps.append({'rule': '“%s” %s: add' % (m.group(1), _fmt(v)), 'latex': '%s + %s = %s' % (_fmt(cur - v), _fmt(v), _fmt(cur))})
        else:
            v = float(m.group(4)); cur -= v; steps.append({'rule': '“%s” %s: subtract' % (m.group(3), _fmt(v)), 'latex': '%s - %s = %s' % (_fmt(cur + v), _fmt(v), _fmt(cur))})
        n += 1
    if not n:
        return None
    unit = '°' if re.search(r'degree|temperature|°', low) else ''
    money = '$' in low
    val = ('$%.2f' % cur) if money else '%s%s' % (_fmt(cur), unit)
    return _ans('Answer', val, steps, 'Changes from a starting value', extra=[{'title': 'Net change', 'text': '%s%s' % ('+' if cur - v0 >= 0 else '', _fmt(cur - v0))}])


# ============================================================
# 20. Emptying / filling at a rate: "holds 500 liters, draining at 25 liters per minute"
# ============================================================
def solve_drain(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    if not re.search(r'empty|run out|used up|drain|leak|fill(?:ed)? up|full|burns? down|melts?', low):
        return None
    cap = re.search(r'(?:holds?|contains?|has|capacity of|with|filled with|starts? with)\s+(\d+(?:\.\d+)?)\s*([a-z]+)', low)
    rate = re.search(r'(\d+(?:\.\d+)?)\s*([a-z]+)\s+(?:per|a|an|every|each)\s+(second|minute|hour|day|week)', low)
    if not (cap and rate):
        return None
    already = re.search(r'(?:already|currently|now)\s+(?:has|contains|holds)\s+(\d+(?:\.\d+)?)', low)
    C = float(cap.group(1)); R = float(rate.group(1))
    after = re.search(r'(?:after|in)\s+(\d+(?:\.\d+)?)\s+%ss?' % rate.group(3), low)
    if after and re.search(r'how much[^?]*(?:left|remain|still|in it|in the tank)|what (?:is|will be) left', low):
        t = float(after.group(1)); left = C - R * t
        return _ans('Left', '%s %s' % (_fmt(max(left, 0), 6), cap.group(2)), [{'rule': 'start − rate × time', 'latex': r'%s - %s \times %s = %s' % (_fmt(C), _fmt(R), _fmt(t), _fmt(left, 6))}], 'Rate problem (emptying)')
    filling = re.search(r'fill(?:ed)? up|until (?:it is )?full|to fill', low) and not re.search(r'drain|leak|empty', low)
    amount = (C - float(already.group(1))) if (filling and already) else C
    t = amount / R
    unit = rate.group(3) + ('s' if t != 1 else '')
    return _ans('Time', '%s %s' % (_fmt(t, 6), unit), [{'rule': 'time = amount ÷ rate', 'latex': r'\frac{%s}{%s} = %s' % (_fmt(amount), _fmt(R), _fmt(t, 6))}], 'Rate problem (%s)' % ('filling' if filling else 'emptying'))


# ============================================================
# 21. Percent of an unknown: "a number increased by 15% is 92", "30% of what number is 12"
# ============================================================
def solve_percent_reverse(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    x = Symbol('x')
    m = re.search(r'(?:a number|a price|the original (?:price|number|amount|value)|a value|an amount|the number|it)\s+(increased|decreased|raised|reduced|marked up|discounted|lowered)\s+by\s+(\d+(?:\.\d+)?)\s*%\s*(?:is|was|gives|equals|becomes|=)\s*\$?(\d+(?:\.\d+)?)', low)
    if m:
        k = 1 + float(m.group(2)) / 100 * (1 if m.group(1) in ('increased', 'raised', 'marked up') else -1)
        eq = Eq(sp.nsimplify(k) * x, sp.nsimplify(m.group(3)))
    else:
        m = re.search(r'(\d+(?:\.\d+)?)\s*%\s*of\s+(?:a number|what(?: number)?|the number|it|x)\s+(?:is|was|=|equals)\s*\$?(\d+(?:\.\d+)?)', low) or re.search(r'\$?(\d+(?:\.\d+)?)\s+is\s+(\d+(?:\.\d+)?)\s*%\s+of\s+(?:what|a number|which number)', low)
        if not m:
            m2 = re.search(r'after (?:a |an )?(\d+(?:\.\d+)?)\s*%\s*(discount|increase|raise|markup|decrease|cut)[^.?]*?\$(\d+(?:\.\d+)?)[^?]*?(?:original|before|was it|what was)', low)
            if not m2 and re.search(r'original|regular price|before the (?:discount|sale|increase)|what was the price', low):
                m3 = re.search(r'(\d+(?:\.\d+)?)\s*%\s*(off|discount|increase|markup|raise)', low)
                pz = re.search(r'\$(\d+(?:\.\d+)?)\s*(?:after|on sale|now|with the)|(?:is|costs?|pays?|paid|for)\s+\$(\d+(?:\.\d+)?)', low)
                if m3 and pz:
                    class _M:
                        def __init__(self, a, b, c): self.g = (None, a, b, c)
                        def group(self, i): return self.g[i]
                    m2 = _M(m3.group(1), {'off': 'cut', 'discount': 'cut'}.get(m3.group(2), m3.group(2)), pz.group(1) or pz.group(2))
            if not m2:
                return None
            k = 1 + float(m2.group(1)) / 100 * (1 if m2.group(2) in ('increase', 'raise', 'markup') else -1)
            eq = Eq(sp.nsimplify(k) * x, sp.nsimplify(m2.group(3)))
        elif m.re.pattern.startswith(r'(\d'):
            eq = Eq(sp.nsimplify(m.group(1)) / 100 * x, sp.nsimplify(m.group(2)))
        else:
            eq = Eq(sp.nsimplify(m.group(2)) / 100 * x, sp.nsimplify(m.group(1)))
    v = sp.solve(eq, x)[0]
    money = '$' in low
    return _ans('Answer', ('$%.2f' % float(v)) if money else _fmt(float(v), 8), [{'rule': 'Write it as an equation', 'latex': sp.latex(eq)}, {'rule': 'Divide both sides', 'latex': 'x = %s' % sp.latex(v)}], 'Percent of an unknown', label='Percent')


# ============================================================
# 22. Averages: "scored 85, 92 and 78 … average", "what score is needed on the 4th test to average 85"
# ============================================================
def solve_average(text):
    low = words_to_numbers(text.lower()).replace(',', ' ,')
    if not re.search(r'average|mean', low) or re.search(r'average (?:\w+\s+){0,2}(?:speed|velocity|rate|pace)|mean (?:speed|velocity)|what does .* mean|normal|\bsd\b|standard deviation|std|binomial|z-?score|variance|between', low):
        return None
    nums = [float(x) for x in re.findall(r'(?<![\d.])(\d+(?:\.\d+)?)(?![\d.]*\s*(?:tests?|quizzes?|games?|days?|exams?|subjects?|students?|scores?)\b)', low)]
    target = re.search(r'(?:average|mean)\s+(?:of\s+|score of\s+)?(\d+(?:\.\d+)?)', low)
    need = re.search(r'(?:what|how much|which)[^?]*?(?:need|must|has to|have to|should)', low)
    if need and target:
        t = float(target.group(1))
        vals = [v for v in nums if v != t]
        cnt = re.search(r'(\d+)(?:st|nd|rd|th)\s+(?:test|quiz|exam|game)', low)
        n = int(cnt.group(1)) if cnt else len(vals) + 1
        x = t * n - sum(vals)
        return _ans('Score needed', _fmt(x), [{'rule': 'An average of %s over %d means a total of %s' % (_fmt(t), n, _fmt(t * n)), 'latex': r'%s \times %d = %s' % (_fmt(t), n, _fmt(t * n))}, {'rule': 'Subtract what you already have', 'latex': r'%s - %s = %s' % (_fmt(t * n), _fmt(sum(vals)), _fmt(x))}], 'Average (working backwards)')
    if len(nums) < 2:
        return None
    avg = sum(nums) / len(nums)
    return _ans('Average', _fmt(avg, 6), [{'rule': 'Add them up, then divide by how many there are', 'latex': r'\frac{%s}{%d} = %s' % (' + '.join(_fmt(v) for v in nums), len(nums), _fmt(avg, 6))}], 'Mean of %d numbers' % len(nums))


# ============================================================
# 23. Tax and tip on one price
# ============================================================
def solve_tax_tip(text):
    low = text.lower().replace(',', '')
    pm = re.search(r'\$\s?(\d+(?:\.\d+)?)', low)
    tt = re.search(r'(\d+(?:\.\d+)?)\s*%\s*(sales tax|tax|tip|gratuity|service charge|fee|commission|deposit|down payment)', low)
    if not tt:
        t2 = re.search(r'(sales tax|tax|tip|gratuity|service charge)\s+(?:rate\s+)?(?:is|of|=)\s+(\d+(?:\.\d+)?)\s*%', low)
        if t2:
            class _T:
                def __init__(self, a, b): self.g = (None, a, b)
                def group(self, i): return self.g[i]
            tt = _T(t2.group(2), t2.group(1))
    if not (pm and tt) or re.search(r'off|discount|sale for', low):
        return None
    P0, r = float(pm.group(1)), float(tt.group(1)) / 100
    amt = P0 * r
    asks_total = re.search(r'total|altogether|in all|how much (?:will|does|did|do) (?:\w+ )?(?:pay|cost|spend)|final', low) and not re.search(r'how much (?:is|was) the (?:tip|tax)|(?:tip|tax) (?:is|be) how much|what is the (?:tip|tax)|is how much', low)
    word = tt.group(2)
    if asks_total:
        return _ans('Total', '$%.2f' % (P0 + amt), [{'rule': '%s = %s%% of $%s' % (word.capitalize(), _fmt(r * 100), _fmt(P0)), 'latex': r'%s \times %s = %.2f' % (_fmt(P0), _fmt(r), amt)}, {'rule': 'Add it on', 'latex': '%.2f + %.2f = %.2f' % (P0, amt, P0 + amt)}], 'Price plus %s' % word, label='Percent')
    return _ans(word.capitalize(), '$%.2f' % amt, [{'rule': '%s%% of $%s' % (_fmt(r * 100), _fmt(P0)), 'latex': r'%s \times %s = %.2f' % (_fmt(P0), _fmt(r), amt)}], '%s amount' % word.capitalize(), label='Percent', extra=[{'title': 'Total with %s' % word, 'text': '$%.2f' % (P0 + amt)}])


# ============================================================
# 24. How many can you buy / fit: "$480 … each ticket costs $16"
# ============================================================
def solve_how_many_afford(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    q = _qpart(low) if '?' in low else low
    if not re.search(r'how many', q):
        return None
    pr = re.search(r'(?:each|one|a|per|every)\s+([a-z]+)\s+(?:costs?|is|sells for|goes for|weighs|uses|needs|takes)\s+\$?(\d+(?:\.\d+)?)|\$?(\d+(?:\.\d+)?)\s+(?:for each|each|per|a|an)\s+([a-z]+)', low)
    tot = re.search(r'(?:has|have|had|raised|saved|earned|budget of|with|collected|spend|total of)\s+\$?(\d+(?:\.\d+)?)', low)
    if not (pr and tot):
        return None
    price = float(pr.group(2) or pr.group(3)); item = pr.group(1) or pr.group(4)
    T = float(tot.group(1))
    if price == T or price <= 0:
        return None
    n, rem = divmod(T, price)
    return _ans('Answer', '%s %s' % (_fmt(n), item + ('s' if n != 1 and not item.endswith('s') else '')), [{'rule': 'Divide what you have by the cost of one, and round down', 'latex': r'%s \div %s = %s' % (_fmt(T), _fmt(price), _fmt(T / price, 6))}], 'Division (whole items only)', extra=[{'title': 'Left over', 'text': ('$%.2f' % rem) if '$' in low else _fmt(rem)}])


# ============================================================
# 25. A fraction or percent of a quantity: "3/4 full … holds 60 gallons"
# ============================================================
def solve_fraction_of(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    fr = re.search(r'(?<![\d/])(\d+)\s*/\s*(\d+)(?![\d/])\s*(?:of|full|empty|filled|done|complete|finished|left)?', low)
    pc = re.search(r'(\d+(?:\.\d+)?)\s*%\s+of\s+(?:the\s+|its\s+|his\s+|her\s+|their\s+)?(?:\$?(\d+(?:\.\d+)?))?', low) or re.search(r'(\d+(?:\.\d+)?)\s*%\s+(?:are|were|is|was|of them|like|have|own|said|voted|chose|prefer)', low)
    if pc and re.search(r'%\s*(?:off|discount|tax|tip|interest|more|less|increase|decrease)', low):
        return None
    whole = re.search(r'(?:holds?|contains?|has|have|had|of|total of|capacity of|out of|there are|there were|survey of|surveyed|collected|baked|made)\s+\$?(\d+(?:\.\d+)?)\s*([a-z]*)', low)
    if not (fr or pc) or not whole:
        return None
    k = sp.Rational(int(fr.group(1)), int(fr.group(2))) if fr else sp.nsimplify(pc.group(1)) / 100
    W = float(whole.group(1))
    if fr and (int(fr.group(1)) == W or int(fr.group(2)) == W):
        whole2 = [m for m in re.finditer(r'(?:holds?|contains?|has|of|total of|capacity of|out of)\s+\$?(\d+(?:\.\d+)?)\s*([a-z]*)', low) if float(m.group(1)) not in (int(fr.group(1)), int(fr.group(2)))]
        if not whole2:
            return None
        whole = whole2[0]; W = float(whole.group(1))
    empty = fr and re.search(r'\d+\s*/\s*\d+\s*(?:empty|left|remaining|used)', low) and re.search(r'how (?:much|many)[^?]*(?:in it|left|remain|still)', low)
    v = float(k) * W
    unit = whole.group(2) if whole.group(2) not in ('when', 'and', 'the', 'a') else ''
    q = _qpart(low) if '?' in low else low
    rest = re.search(r'\b(?:not|aren\'t|isn\'t|don\'t|didn\'t|left|remain|remaining|still|now)\b', q) and (re.search(r'\b(?:gives?|gave|ate|eats|spends?|spent|loses?|lost|uses?|used|sold|sells|donates?|donated|throws?|threw|took|takes)\b', low) or re.search(r'\bnot\b|n\'t', q))
    if rest:
        r_ = W - v
        return _ans('Answer', ('$%.2f' % r_) if '$' in low else '%s %s' % (_fmt(r_, 6), unit), [{'rule': 'Find the part', 'latex': r'%s \times %s = %s' % (sp.latex(k), _fmt(W), _fmt(v, 6))}, {'rule': 'Subtract it from the whole', 'latex': '%s - %s = %s' % (_fmt(W), _fmt(v, 6), _fmt(r_, 6))}], 'Part of a whole (what remains)')
    return _ans('Answer', ('$%.2f' % v) if '$' in low else '%s %s' % (_fmt(v, 6), unit), [{'rule': 'Multiply the whole by the fraction', 'latex': r'%s \times %s = %s' % (sp.latex(k), _fmt(W), _fmt(v, 6))}], 'Part of a whole')


# ============================================================
# 26. Angles: triangle sums, supplementary and complementary pairs
# ============================================================
def solve_angles(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    if not re.search(r'angle', low):
        return None
    total = 180 if re.search(r'triangle|supplementary|straight line|linear pair', low) else 90 if re.search(r'complementary|right angle', low) else 360 if re.search(r'quadrilateral|around a point|rectangle|square|parallelogram|trapezoid', low) else None
    if total is None:
        m = re.search(r'(\d+)\s*-?\s*(?:sided|gon)|(pentagon|hexagon|heptagon|octagon|nonagon|decagon)', low)
        if m:
            n = int(m.group(1)) if m.group(1) else {'pentagon': 5, 'hexagon': 6, 'heptagon': 7, 'octagon': 8, 'nonagon': 9, 'decagon': 10}[m.group(2)]
            total = (n - 2) * 180
    if total is None:
        return None
    rel = re.search(r'(?:one|1) (?:angle )?is (\d+(?:\.\d+)?)\s*(?:degrees?|°)?\s*(more|less|larger|smaller|greater) than (twice |(\d+) times )?the other', low) or re.search(r'(?:one|1) (?:angle )?is (twice|three times|four times|\d+ times|half) (?:as large as |the size of |)the other', low)
    x = Symbol('x')
    if rel and re.search(r'supplementary|complementary', low):
        if rel.re.pattern.startswith('(?:one|1) (?:angle )?is (\\d'):
            k = 2 if rel.group(3) == 'twice ' else (int(rel.group(4)) if rel.group(4) else 1)
            other = k * x + float(rel.group(1)) * (1 if rel.group(2) in ('more', 'larger', 'greater') else -1)
        else:
            other = _mult(rel.group(1)) * x
        sol = sp.solve(Eq(x + other, total), x)[0]
        a1, a2 = float(sol), float(other.subs(x, sol))
        return _ans('Angles', '%s° and %s°' % (_fmt(a1, 6), _fmt(a2, 6)), [{'rule': '%s angles add up to %d°' % ('Supplementary' if total == 180 else 'Complementary', total), 'latex': sp.latex(Eq(x + other, total))}, {'rule': 'Solve', 'latex': 'x = %s' % _fmt(a1, 6)}], 'Angle pair')
    given = [float(v) for v in re.findall(r'(\d+(?:\.\d+)?)\s*(?:degrees?|°)', low)]
    if not given:
        return None
    missing = total - sum(given)
    if missing <= 0:
        return None
    return _ans('Missing angle', '%s°' % _fmt(missing, 6), [{'rule': 'The angles add up to %d°' % total, 'latex': '%d - (%s) = %s' % (total, ' + '.join(_fmt(g) for g in given), _fmt(missing, 6))}], 'Angle sum')


# ============================================================
# 27. Adding or comparing measurements: "2.5 km to school and 3.2 km home … in total"
# ============================================================
_MU = r'(km|kilometers?|kilometres?|miles?|mi|meters?|metres?|m|cm|mm|feet|ft|inches|in|yards?|yd|hours?|hrs?|minutes?|mins?|seconds?|secs?|kg|kilograms?|grams?|g|pounds?|lbs?|ounces?|oz|liters?|litres?|l|ml|gallons?|gal|cups?|laps|pages|points)'


def solve_measure_sum(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    qs = re.findall(r'(\d+(?:\.\d+)?)\s*' + _MU + r'\b', low)
    allnums = re.findall(r'\d+(?:\.\d+)?', low)
    if len(qs) < 2 or len(qs) != len(allnums):
        return None
    units = {_sing(u) for _, u in qs}
    if len(units) != 1:
        return None
    q = _qpart(low) if '?' in low else low
    vals = [float(v) for v, _ in qs]
    u = qs[0][1]
    if re.search(r'in total|total|altogether|in all|combined|both|how far did|how long did|how much did', q):
        t = sum(vals)
        return _ans('Total', '%s %s' % (_fmt(t, 6), u), [{'rule': 'Add the amounts', 'latex': ' + '.join(_fmt(v) for v in vals) + ' = %s' % _fmt(t, 6)}], 'Adding measurements')
    if len(vals) == 2 and re.search(r'how much (?:farther|further|longer|more|less|shorter|heavier|lighter)|difference|how many more', q):
        d = abs(vals[0] - vals[1])
        return _ans('Difference', '%s %s' % (_fmt(d, 6), u), [{'rule': 'Subtract the smaller from the larger', 'latex': '%s - %s = %s' % (_fmt(max(vals)), _fmt(min(vals)), _fmt(d, 6))}], 'Comparing measurements')
    return None


# ============================================================
# 28. Repeated distances: "8 laps of a 400 meter track", unit price "pack of 6 … $4.20"
# ============================================================
_LEN_M = {'m': 1, 'meter': 1, 'metre': 1, 'km': 1000, 'kilometer': 1000, 'kilometre': 1000, 'mile': 1609.344, 'mi': 1609.344, 'foot': 0.3048, 'feet': 0.3048, 'ft': 0.3048, 'yard': 0.9144, 'yd': 0.9144, 'cm': 0.01, 'inch': 0.0254, 'inches': 0.0254}


def solve_repeat(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    m = re.search(r'(\d+(?:\.\d+)?)\s+(laps|times|trips|lengths|rounds|loops)\s+(?:of|around|across|on|along)\s+(?:a|an|the)\s+(\d+(?:\.\d+)?)\s*-?\s*(meters?|metres?|m|km|kilometers?|miles?|mi|feet|foot|ft|yards?|yd)\b', low)
    if m:
        n, L, u = float(m.group(1)), float(m.group(3)), m.group(4)
        tot = n * L
        conv = re.search(r'how (?:many|far)[^?]*?\b(kilometers?|km|miles?|meters?|m|feet|yards?)\b', low[m.end():])
        unit, val = u, tot
        if conv:
            cu = conv.group(1)
            val = tot * _LEN_M[_sing(u) if _sing(u) in _LEN_M else u] / _LEN_M[_sing(cu) if _sing(cu) in _LEN_M else cu]; unit = cu
        return _ans('Total distance', '%s %s' % (_fmt(val, 6), unit), [{'rule': 'Multiply the number of %s by the length of one' % m.group(2), 'latex': r'%s \times %s = %s \text{ %s}' % (_fmt(n), _fmt(L), _fmt(tot), u)}] + ([{'rule': 'Convert to %s' % unit, 'latex': r'%s \text{ %s} = %s \text{ %s}' % (_fmt(tot), u, _fmt(val, 6), unit)}] if unit != u else []), 'Repeated distance')
    m = re.search(r'(?:pack|box|bag|set|case|carton|bundle|dozen|bunch)\s+of\s+(\d+)\s+([a-z]+(?:\s+[a-z]+)?)\s+(?:costs?|is|sells for|for)\s+\$(\d+(?:\.\d+)?)|\$(\d+(?:\.\d+)?)\s+for\s+(?:a\s+(?:pack|box|bag|set|case|carton)\s+of\s+)?(\d+)\s+([a-z]+)', low)
    if m and re.search(r'per|each|one|unit price|a single|apiece', low[m.end():] if m.end() < len(low) else low):
        n_, item, P0 = (float(m.group(1)), m.group(2), float(m.group(3))) if m.group(1) else (float(m.group(5)), m.group(6), float(m.group(4)))
        return _ans('Price each', '$%.2f' % (P0 / n_), [{'rule': 'Divide the price by how many', 'latex': r'\frac{%.2f}{%s} = %.4g' % (P0, _fmt(n_), P0 / n_)}], 'Unit price', label='Money')
    return None


# ============================================================
# 29. Repeated percent change over time: depreciation, population growth
# ============================================================
def solve_exponential(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    m = re.search(r'(drops?|decreases?|depreciates?|loses?|falls?|declines?|shrinks?|grows?|increases?|appreciates?|rises?|goes up|goes down)\s+(?:in value\s+)?(?:by\s+)?(\d+(?:\.\d+)?)\s*%\s*(?:each|every|per|a|an)\s+(year|month|week|day|decade|hour)', low)
    if not m:
        return None
    r = float(m.group(2)) / 100 * (-1 if re.match(r'drop|decreas|depreciat|lose|fall|declin|shrink|goes down', m.group(1)) else 1)
    P_ = re.search(r'\$\s?(\d+(?:\.\d+)?)', low) or re.search(r'(?:worth|is|of|has|population of|value of|starts? (?:at|with))\s+(\d+(?:\.\d+)?)', low)
    t_ = re.search(r'(?:in|after|for|over)\s+(\d+(?:\.\d+)?)\s+%ss?' % m.group(3), low)
    if not (P_ and t_):
        return None
    P0, t = float(P_.group(1)), float(t_.group(1))
    A = P0 * (1 + r) ** t
    money = '$' in low
    return _ans('After %s %ss' % (_fmt(t), m.group(3)), ('$%.2f' % A) if money else _fmt(A, 6), [{'rule': 'Each %s multiply by %s' % (m.group(3), _fmt(1 + r)), 'latex': r'%s \times %s^{%s} = %s' % (_fmt(P0), _fmt(1 + r), _fmt(t), _fmt(A, 6))}], 'Repeated %s of %s%% per %s' % ('growth' if r > 0 else 'decrease', _fmt(abs(r) * 100), m.group(3)), extra=[{'title': 'Why not just %s%% × %s?' % (_fmt(abs(r) * 100), _fmt(t)), 'text': 'Each %s’s change is a percent of the new, already-changed amount, so the changes compound.' % m.group(3)}])


# ============================================================
# 30. Sum and difference of two numbers, in any order
# ============================================================
def solve_sum_diff(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    if not re.search(r'two numbers|2 numbers', low):
        return None
    S_ = re.search(r'sum\b(?:\s+of\s+(?:the\s+)?(?:2|two)\s+numbers)?(?:\s+(?:of|is|equals|=))\s+(-?\d+(?:\.\d+)?)(?!\s+(?:numbers|integers))|add up to\s+(-?\d+(?:\.\d+)?)|total (?:of|is)\s+(-?\d+(?:\.\d+)?)', low)
    D_ = re.search(r'difference\b(?:\s+of\s+(?:the\s+)?(?:2|two)\s+numbers)?(?:\s+(?:of|is|equals|=))\s+(-?\d+(?:\.\d+)?)(?!\s+(?:numbers|integers))|differ by\s+(-?\d+(?:\.\d+)?)', low)
    if not (S_ and D_):
        return None
    Sv = float(next(g for g in S_.groups() if g)); Dv = float(next(g for g in D_.groups() if g))
    big_, small = (Sv + Dv) / 2, (Sv - Dv) / 2
    q = low.split('?')[0][-80:]
    main = _fmt(big_) if re.search(r'larger|bigger|greater', q) else _fmt(small) if re.search(r'smaller|lesser', q) else '%s and %s' % (_fmt(big_), _fmt(small))
    return _ans('Answer', main, [{'rule': 'Add the sum and difference, then halve: that’s the larger number', 'latex': r'\frac{%s + %s}{2} = %s' % (_fmt(Sv), _fmt(Dv), _fmt(big_))}, {'rule': 'The smaller is the sum minus the larger', 'latex': '%s - %s = %s' % (_fmt(Sv), _fmt(big_), _fmt(small))}], 'Sum and difference')


# ============================================================
# 31. Sharing that doesn't divide evenly: "four friends share 3 pizzas"
# ============================================================
def solve_share(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    m = re.search(r'(\d+)\s+([a-z]+)\s+(?:share|split|divide)\s+(\d+(?:\.\d+)?)\s+([a-z]+)', low) or re.search(r'(?:share|split|divide)\s+(\d+(?:\.\d+)?)\s+([a-z]+)\s+(?:equally\s+)?(?:among|between|by)\s+(\d+)\s+([a-z]+)', low)
    if not m:
        return None
    if m.re.pattern.startswith(r'(\d+)\s+([a-z]+)\s+(?:share'):
        people, what, n = float(m.group(1)), m.group(4), float(m.group(3))
    else:
        n, what, people = float(m.group(1)), m.group(2), float(m.group(3))
    each = sp.Rational(int(n), int(people)) if n == int(n) and people == int(people) else n / people
    txt = '%s %s each' % (sp.sstr(each) if not getattr(each, 'is_Integer', False) else str(each), what if n / people > 1 else _sing(what))
    if not getattr(each, 'is_Integer', True):
        txt += ' (%s)' % _fmt(float(each), 4)
    return _ans('Each gets', txt, [{'rule': 'Divide what is shared by the number sharing', 'latex': r'\frac{%s}{%s} = %s' % (_fmt(n), _fmt(people), sp.latex(each) if hasattr(each, 'q') else _fmt(each, 6))}], 'Equal sharing')


# ============================================================
# 32. Dimensional analysis: a general fallback.
#     Every number gets a unit ("32 miles per gallon" = miles/gallon, "$450 a week" = $/week,
#     "20%" = a fraction). The question says which unit the answer needs ("how far" → miles).
#     Then it searches for the product/quotient of the given quantities whose units cancel to
#     exactly that unit, preferring the one that uses every number. It's how people check
#     physics and chemistry answers, and it covers a lot of everyday problems.
# ============================================================
_UNIT_ALIAS = {'mph': ('mile', 'hour'), 'kph': ('km', 'hour'), 'km/h': ('km', 'hour'), 'mpg': ('mile', 'gallon'), 'wpm': ('word', 'minute'), 'bpm': ('beat', 'minute'), 'rpm': ('revolution', 'minute')}
_UNIT_NORM = {'ml': 'milliliter', 'milliliters': 'milliliter', 'millilitres': 'milliliter', 'liter': 'liter', 'cents': 'cent', 'miles': 'mile', 'mi': 'mile', 'kilometers': 'km', 'kilometres': 'km', 'kilometer': 'km', 'hours': 'hour', 'hrs': 'hour', 'hr': 'hour', 'h': 'hour', 'minutes': 'minute', 'mins': 'minute', 'min': 'minute',
              'seconds': 'second', 'secs': 'second', 's': 'second', 'gallons': 'gallon', 'gal': 'gallon', 'liters': 'liter', 'litres': 'liter', 'l': 'liter', 'cups': 'cup', 'dollars': '$', 'dollar': '$', 'bucks': '$',
              'pounds': 'pound', 'lbs': 'pound', 'lb': 'pound', 'feet': 'foot', 'ft': 'foot', 'meters': 'meter', 'metres': 'meter', 'm': 'meter', 'weeks': 'week', 'days': 'day', 'months': 'month', 'years': 'year',
              'pages': 'page', 'people': 'person', 'persons': 'person', 'children': 'child', 'men': 'man', 'women': 'woman', 'teaspoons': 'teaspoon', 'tsp': 'teaspoon', 'tablespoons': 'tablespoon', 'tbsp': 'tablespoon',
              'ounces': 'ounce', 'oz': 'ounce', 'grams': 'gram', 'g': 'gram', 'kg': 'kilogram', 'kilograms': 'kilogram', 'inches': 'inch', 'in': 'inch', 'yards': 'yard', 'yd': 'yard', 'cm': 'centimeter'}
_SKIP_UNIT = {'and', 'or', 'the', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'for', 'is', 'are', 'was', 'were', 'more', 'less', 'times', 'than', 'each', 'per', 'every', 'how', 'what', 'it', 'if', 'then', 'with', 'by', 'from', 'that', 'this', 'he', 'she', 'they', 'can', 'will'}


def _u(w):
    w = (w or '').lower().strip()
    if w in _UNIT_NORM:
        return _UNIT_NORM[w]
    return _sing(w) if w not in ('gas', 'glass', 'class', 'bus', 'gas') else w


def _uadd(a, b, k=1):
    out = dict(a)
    for key, v in b.items():
        out[key] = out.get(key, 0) + k * v
        if out[key] == 0:
            del out[key]
    return out


def _dim_quantities(low):
    qs = []
    taken = []
    def free(a, b):
        return all(b <= x or a >= y for x, y in taken)
    def push(m, val, unit, label):
        if free(*m.span()):
            qs.append({'v': val, 'u': unit, 'pos': m.start(), 'label': label}); taken.append(m.span())
    NUM = r'(\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?)'
    # rates: "$450 a week", "32 miles per gallon", "2/3 cup of sugar for each batch", "4 liters per hour"
    for m in re.finditer(r'(\$\s?)?' + NUM + r'\s*(?:([a-z]+)(?:\s+of\s+[a-z]+)?\s+)?(?:(?:per|a|an|each|every|for each|for every)\s+|/\s*)([a-z]+)\b', low):
        if m.group(4) in _SKIP_UNIT or (m.group(3) in _SKIP_UNIT and m.group(3)):
            continue
        top = '$' if m.group(1) else _u(m.group(3))
        if not top:
            continue
        push(m, _numval(m.group(2)), {top: 1, _u(m.group(4)): -1}, m.group(0))
    for m in re.finditer(r'(\$\s?)?' + NUM + r'\s*([a-z]+)\s+(?:in|on|for|at)\s+(?:each|every|a|one)\s+([a-z]+)\b', low):
        top = '$' if m.group(1) else _u(m.group(3))
        if top and top not in _SKIP_UNIT and m.group(4) not in _SKIP_UNIT:
            push(m, _numval(m.group(2)), {top: 1, _u(m.group(4)): -1}, m.group(0))
    for m in re.finditer(NUM + r'\s*(mph|kph|km/h|mpg|wpm|bpm|rpm)\b', low):
        a, b = _UNIT_ALIAS[m.group(2)]
        push(m, _numval(m.group(1)), {a: 1, b: -1}, m.group(0))
    for m in re.finditer(r'(?:each|every|one|a|per)\s+([a-z]+)(?:\s+of\s+[a-z]+)?\s+(?:has|holds|contains|weighs|costs|uses|needs|makes|serves|gets|is)\s+(\$\s?)?' + NUM + r'\s*([a-z]+)?', low):
        top = '$' if m.group(2) else _u(m.group(4))
        if top and top not in _SKIP_UNIT:
            # "each box weighs 450 g" is a rate only if boxes are counted somewhere ("6 boxes")
            per_noun = _u(m.group(1))
            counted = any(_u(w) == per_noun for w in re.findall(r'\d+(?:\.\d+)?\s+([a-z]+)', low))
            push(m, _numval(m.group(3)), {top: 1, per_noun: -1} if counted else {top: 1}, m.group(0))
    for m in re.finditer(r'(?:a\s+)?dozen\s+([a-z]+)', low):
        push(m, 12.0, {_u(m.group(1)): 1}, m.group(0))
    for m in re.finditer(NUM + r'\s*(?:%|percent)', low):
        push(m, _numval(m.group(1)) / 100, {}, m.group(0))
    for m in re.finditer(r'\$\s?' + NUM, low):
        push(m, _numval(m.group(1)), {'$': 1}, m.group(0))
    for m in re.finditer(NUM + r'\s*(?:-?\s*)([a-z]+)(?:\s+of\s+([a-z]+))?', low):
        u = m.group(2)
        if u in _SKIP_UNIT:
            push(m, _numval(m.group(1)), {}, m.group(0)); continue
        push(m, _numval(m.group(1)), {_u(u): 1}, m.group(0))
    for m in re.finditer(r'(?<![\d.$/])' + NUM + r'(?![\d./%])', low):
        push(m, _numval(m.group(1)), {}, m.group(0))
    qs.sort(key=lambda q: q['pos'])
    return qs


_CONV = [('day', 'week', 7), ('hour', 'day', 24), ('minute', 'hour', 60), ('second', 'minute', 60), ('second', 'hour', 3600), ('month', 'year', 12), ('week', 'year', 52), ('day', 'year', 365),
         ('inch', 'foot', 12), ('foot', 'yard', 3), ('foot', 'mile', 5280), ('meter', 'km', 1000), ('centimeter', 'meter', 100), ('milliliter', 'liter', 1000), ('gram', 'kilogram', 1000), ('ounce', 'pound', 16),
         ('cent', '$', 100), ('egg', 'dozen', 12), ('item', 'dozen', 12), ('quart', 'gallon', 4), ('cup', 'quart', 4), ('teaspoon', 'tablespoon', 3)]


def T_any(qs):
    return any(u in ('hour', 'minute', 'second', 'day', 'week', 'month', 'year') for x in qs for u in x['u'])


def _target_unit(q, qs):
    units = set(k for x in qs for k in x['u'])
    m = re.search(r'how many\s+([a-z]+)\s+(?:per|a|an|each|for each|/)\s+([a-z]+)', q) or re.search(r'\bin\s+([a-z]+)\s+(?:per|an?|/)\s+([a-z]+)\b', q) or re.search(r'how (?:many|much)\s+([a-z]+)\b[^?]*?\b(?:in|on|for|to) (?:each|every|one)\s+([a-z]+)', q) or re.search(r'how many\s+([a-z]+)\b[^?]*?\b(?:per|each|every|an?)\s+(hour|minute|second|day|week|month|year|person|student|box|bag|team|page|mile|gallon)\b', q)
    if m:
        return {_u(m.group(1)): 1, _u(m.group(2)): -1}
    m = re.search(r'\b(mph|mpg|km/h|kph)\b', q)
    if m and re.search(r'what|how', q):
        a, b = _UNIT_ALIAS[m.group(1)]; return {a: 1, b: -1}
    if re.search(r'how much (?:money|does (?:it|one|1|each|a|an)\b.*\bcost|will (?:it|they|he|she) (?:cost|save|earn|pay|make|spend)|does (?:he|she|they|it) (?:save|earn|pay|make|spend|owe)|did (?:he|she|they|it) (?:save|earn|pay|make|spend))|what (?:is|was) the (?:cost|price|total cost)|how much (?:is|was|are|were) (?:it|one|each)|how much (?:does|do) \w+ (?:cost|weigh)', q):
        if re.search(r'weigh', q):
            w_ = [u for u in units if u in ('pound', 'kilogram', 'gram', 'ounce')]
            return {w_[0]: 1} if w_ else None
        out = {'$': 1}
        one = re.search(r'(?:one|1|each|a single|per|an?)\s+([a-z]+)', q[q.find('how'):] if 'how' in q else q)
        if one and _u(one.group(1)) in units and re.search(r'how much (?:does|is|would) (?:one|1|each|a|an)\b', q):
            out[_u(one.group(1))] = -1
        return out
    if re.search(r'how far|what distance|how many (?:miles|km|kilometers|meters|feet)', q):
        L = [u for u in units if u in ('mile', 'km', 'meter', 'foot', 'yard', 'inch', 'centimeter')]
        mm = re.search(r'how many (miles|km|kilometers|meters|feet)', q)
        return {_u(mm.group(1)): 1} if mm else ({L[0]: 1} if L else None)
    if re.search(r'how long|how much time|how many (?:hours|minutes|days|weeks|seconds|months|years)', q):
        mm = re.search(r'how many (hours|minutes|days|weeks|seconds|months|years)', q)
        if mm:
            return {_u(mm.group(1)): 1}
        if re.search(r'how long', q) and not T_any(qs):
            return None
        T = [u for u in units if u in ('hour', 'minute', 'second', 'day', 'week', 'month', 'year')]
        return {T[0]: 1} if T else None
    m = re.search(r'how (?:many|much)\s+(?:more\s+)?([a-z]+)', q)
    if m and m.group(1) not in ('does', 'do', 'did', 'is', 'are', 'will', 'would', 'can', 'more'):
        w = _u(m.group(1))
        if w in units:
            return {w: 1}
        # "how much sugar" → the unit used with sugar ("2/3 cup of sugar")
        for x in qs:
            if re.search(r'of\s+%s' % re.escape(m.group(1)), x['label']):
                top = [k for k, v in x['u'].items() if v > 0]
                if top:
                    return {top[0]: 1}
    return None


def solve_dimensional(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    if '?' not in low and not re.search(r'\bhow\b|\bwhat\b|\bfind\b', low):
        return None
    q = _qpart(low) if '?' in low else re.split(r'(?<=[.!])\s+', low.strip())[-1]
    qq = re.sub(r'how (?:many|much|long|far)(?:\s+[a-z]+)?', ' ', q)
    qq = re.sub(r'\b(?:1|one|each|a|an|per)\s+[a-z]+\s+(?:cost|weigh|take|need|use)', ' ', qq)   # "how much does 1 egg cost"
    given_part = low[:len(low) - len(q)] + ' ' + qq
    qs = [x for x in _dim_quantities(given_part) if x['v'] != 0 and (x['u'] or re.search(r'%|percent', x['label']))]
    if not 2 <= len(qs) <= 6:
        return None
    tgt = _target_unit(q, qs)
    if not tgt:
        return None
    import itertools
    # unit conversions the story leaves implicit ("4 km every day … in 2 weeks" needs 7 days per week)
    present = set(k for x in qs for k in x['u']) | set(tgt)
    nreq = len(qs)
    for small, big_, k in _CONV:
        if small in present and big_ in present:
            qs.append({'v': float(k), 'u': {small: 1, big_: -1}, 'pos': 10 ** 6, 'label': '%s %ss per %s' % (_fmt(k), small, big_), 'conv': True})
    best = None
    n = len(qs)
    for size in range(n, 0, -1):
        for combo in itertools.combinations(range(n), size):
            for signs in itertools.product((1, -1), repeat=size):
                if 1 not in signs:
                    continue
                u, v = {}, 1.0
                for i, sg in zip(combo, signs):
                    u = _uadd(u, qs[i]['u'], sg)
                    v = v * qs[i]['v'] if sg == 1 else v / qs[i]['v']
                if u != tgt:
                    continue
                # dimensionless numbers dividing are rare; and more than one percent factor is a percent-change problem, not this
                pen = sum(1 for i, sg in zip(combo, signs) if not qs[i]['u'] and sg == -1) + sum(1 for i in combo if qs[i].get('conv'))
                if sum(1 for i in combo if not qs[i]['u']) > 1:
                    continue
                ukeys = [tuple(sorted(qs[i]['u'].items())) for i in combo if qs[i]['u']]
                if len(ukeys) != len(set(ukeys)):
                    continue   # two amounts in the same unit get added or subtracted, not multiplied
                cand = (size, -pen, -sum(1 for sg in signs if sg == -1), v, combo, signs)
                if best is None or cand[:3] > best[:3]:
                    best = cand
        if best and best[0] == size:
            break
    if not best or best[0] < 2:
        return None
    size, _, _, v, combo, signs = best
    if sum(1 for i in combo if not qs[i].get('conv')) < len([x for x in qs if x['u'] and not x.get('conv')]):
        return None   # some unit-carrying numbers weren't used: probably needs adding or subtracting, not this
    def ustr(u):
        top = [k for k, p_ in u.items() if p_ > 0]; bot = [k for k, p_ in u.items() if p_ < 0]
        name = lambda k: k if k == '$' else (k + 's' if not k.endswith('s') else k)
        return ' '.join(name(k) for k in top) + ((' per ' + ' per '.join(bot)) if bot else '')
    order = sorted(zip(combo, signs), key=lambda t: -t[1])
    combo, signs = [o[0] for o in order], [o[1] for o in order]
    expr = ''
    for i, sg in zip(combo, signs):
        part = '%s (%s)' % (_fmt(qs[i]['v'], 6), qs[i]['label'].strip())
        expr += ('' if not expr else (' × ' if sg == 1 else ' ÷ ')) + part
    unit_txt = ustr(tgt)
    val = ('$%.2f' % v) if tgt == {'$': 1} else ('%s %s' % (_fmt(v, 6), unit_txt) if tgt != {'$': 1} else '')
    if '$' in tgt and len(tgt) > 1:
        val = '$%s per %s' % (_fmt(v, 4), [k for k, p_ in tgt.items() if p_ < 0][0])
    steps = [{'rule': 'Match the units: the answer must come out in %s' % unit_txt, 'latex': r'\text{%s}' % expr.replace('$', r'\$').replace('%', r'\%')},
             {'rule': 'Work it out', 'latex': _fmt(v, 6)}]
    return _ans('Answer', val, steps, 'Units analysis (the units cancel to %s)' % unit_txt,
                extra=[{'title': 'How', 'text': 'Each number was tagged with its unit, then I found the multiplication/division of them whose units cancel to what the question asks for. Check it makes sense for the story.'}])


# ============================================================
# 33. Border or path around a rectangle
# ============================================================
def solve_border(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    m = re.search(r'(\d+(?:\.\d+)?)\s*(m|ft|feet|meters?|yards?|cm|inches|in)?\s*(?:by|x|×)\s*(\d+(?:\.\d+)?)', low)
    w = re.search(r'(?:path|border|frame|walkway|sidewalk|strip|deck|margin|mat)\s+(?:that is\s+|of\s+)?(\d+(?:\.\d+)?)\s*(?:m|ft|feet|meters?|yards?|cm|inches|in)?\s*wide|(\d+(?:\.\d+)?)\s*(?:m|ft|feet|meters?|yards?|cm|inches|in)?\s*-?\s*wide\s+(?:path|border|frame|walkway|sidewalk|strip|deck|margin)', low)
    if not (m and w and re.search(r'around|surrounds?|border|outside|frame', low)):
        return None
    L, W, b = float(m.group(1)), float(m.group(3)), float(w.group(1) or w.group(2))
    inside = 'inside' in low and 'outside' not in low
    big_ = (L + 2 * b) * (W + 2 * b) if not inside else L * W
    small = L * W if not inside else (L - 2 * b) * (W - 2 * b)
    u = m.group(2) or ''
    return _ans('Area of the %s' % (re.search(r'path|border|frame|walkway|sidewalk|strip|deck|margin|mat', low).group(0)), '%s square %s' % (_fmt(big_ - small), u or 'units'),
                [{'rule': 'Outer rectangle: add the width on both sides', 'latex': r'(%s + 2 \times %s)(%s + 2 \times %s) = %s' % (_fmt(L), _fmt(b), _fmt(W), _fmt(b), _fmt(big_))}, {'rule': 'Subtract the inner rectangle', 'latex': '%s - %s = %s' % (_fmt(big_), _fmt(small), _fmt(big_ - small))}], 'Border area', label='Geometry')


# ============================================================
# 34. Trips in legs: "50 km/h for 2 hours, then 80 km/h for 1.5 hours"
# ============================================================
def solve_legs(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    legs = re.findall(r'(?:at|averaging|going)\s+(\d+(?:\.\d+)?)\s*(mph|km/h|kph|miles per hour|kilometers per hour|m/s)\s+for\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|seconds?)', low)
    if len(legs) < 2:
        return None
    du = {'mph': 'miles', 'miles per hour': 'miles', 'km/h': 'km', 'kph': 'km', 'kilometers per hour': 'km', 'm/s': 'm'}
    dist, time_h, parts = 0.0, 0.0, []
    for v, u, t, tu in legs:
        tt = float(t) / (60 if tu.startswith('min') else 3600 if tu.startswith('sec') else 1)
        if u == 'm/s':
            tt = float(t) * (60 if tu.startswith('min') else 3600 if tu.startswith('hour') or tu.startswith('hr') else 1)
        d = float(v) * tt
        dist += d; time_h += tt; parts.append(r'%s \times %s' % (_fmt(v), _fmt(tt, 4)))
    unit = du.get(legs[0][1], '')
    if re.search(r'average speed', low):
        return _ans('Average speed', '%s %s' % (_fmt(dist / time_h, 5), legs[0][1]), [{'rule': 'Total distance ÷ total time (not the average of the speeds)', 'latex': r'\frac{%s}{%s} = %s' % (_fmt(dist, 6), _fmt(time_h, 4), _fmt(dist / time_h, 5))}], 'Trip in parts')
    return _ans('Total distance', '%s %s' % (_fmt(dist, 6), unit), [{'rule': 'Distance for each part is speed × time; add them', 'latex': ' + '.join(parts) + ' = %s' % _fmt(dist, 6)}], 'Trip in parts', extra=[{'title': 'Average speed', 'text': '%s %s' % (_fmt(dist / time_h, 5), legs[0][1])}])


# ============================================================
# 35. Buying and selling: markup, profit, loss
# ============================================================
def solve_markup(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    m = re.search(r'(?:buys?|bought|pays?|paid|costs?|purchased?)\s+(?:\w+\s+){0,4}?(?:for\s+)?\$(\d+(?:\.\d+)?)[^.?]*?(?:sells?|sold|resells?|resold)\s+(?:\w+\s+){0,3}?(?:for\s+)?\$(\d+(?:\.\d+)?)', low) or re.search(r'(?:from|was)\s+\$(\d+(?:\.\d+)?)\s+to\s+\$(\d+(?:\.\d+)?)', low) or re.search(r'(?:cost|costs|was|were|priced at|used to cost|originally)\s+\$(\d+(?:\.\d+)?)\s+(?:is|are|costs?|sells? for)\s+now\s+\$(\d+(?:\.\d+)?)', low)
    if not m:
        return None
    a, b = float(m.group(1)), float(m.group(2))
    if re.search(r'discount|off|sale', low[-100:]) and b < a:
        return _ans('Percent discount', '%s%%' % _fmt((a - b) / a * 100, 4), [{'rule': 'Amount off ÷ original price × 100', 'latex': r'\frac{%s - %s}{%s} \times 100 = %s\%%' % (_fmt(a), _fmt(b), _fmt(a), _fmt((a - b) / a * 100, 4))}], 'Discount', label='Percent', extra=[{'title': 'Amount off', 'text': '$%.2f' % (a - b)}])
    ch = (b - a) / a * 100
    q = low[-120:]
    word = 'markup' if re.search(r'markup|mark-up', q) else 'profit' if re.search(r'profit|gain', q) and b > a else 'loss' if b < a and re.search(r'loss|lose', q) else ('increase' if b > a else 'decrease')
    if re.search(r'how much (?:profit|money|did|does)|what (?:is|was) the (?:profit|loss)', q) and not re.search(r'percent|%', q):
        return _ans(word.capitalize(), '$%.2f' % abs(b - a), [{'rule': 'Subtract', 'latex': '%.2f - %.2f = %.2f' % (b, a, b - a)}], 'Buying and selling', label='Money', extra=[{'title': 'As a percent of the cost', 'text': '%s%%' % _fmt(abs(ch), 4)}])
    return _ans('Percent %s' % word, '%s%%' % _fmt(abs(ch), 4), [{'rule': 'Change ÷ original × 100', 'latex': r'\frac{%s - %s}{%s} \times 100 = %s\%%' % (_fmt(b), _fmt(a), _fmt(a), _fmt(ch, 4))}], 'Percent change', label='Percent', extra=[{'title': 'In dollars', 'text': '$%.2f' % abs(b - a)}])


# ============================================================
# 36. Fraction / percent / probability of one group: "4 red, 6 blue and 10 green marbles"
# ============================================================
def solve_part_of_groups(text):
    low = words_to_numbers(text.lower()).replace(',', ' ,')
    if not re.search(r'what (?:fraction|percent|percentage|portion|part|proportion)|probability|chance|what are the odds', low):
        return None
    groups = re.findall(r'(\d+)\s+([a-z]+)(?=\s*(?:,|and|\b(?:[a-z]+\s+){0,1}(?:marbles|balls|socks|cards|candies|students|cars|pens|shirts|cookies|apples|beads|chips|tiles|books|flowers)\b))', low)
    if len(groups) < 2:
        groups = re.findall(r'(\d+)\s+([a-z]+)\s+(?:marbles|balls|socks|cards|candies|students|cars|pens|shirts|cookies|apples|beads|chips|tiles|books|flowers)', low)
    if len(groups) < 2:
        return None
    q = _qpart(low) if '?' in low else low
    total = sum(int(n) for n, _ in groups)
    want = [g for g in groups if re.search(r'\b%s\b' % g[1], q)]
    if not want:
        return None
    k = sum(int(n) for n, _ in want)
    fr = sp.Rational(k, total)
    name = ' or '.join(w for _, w in want)
    head = 'Probability' if re.search(r'probability|chance|odds', q) else 'Fraction'
    return _ans(head, '%s' % fr, [{'rule': 'Part ÷ whole', 'latex': r'\frac{%d}{%s} = %s' % (k, ' + '.join(n for n, _ in groups), sp.latex(fr))}], '%s %s out of %d' % (k, name, total), extra=[{'title': 'As a percent', 'text': '%s%%' % _fmt(float(fr) * 100, 4)}, {'title': 'As a decimal', 'text': _fmt(float(fr), 6)}])


# ============================================================
# 37. Clock times: start + duration, or duration between two times
# ============================================================
def _clock(h, m_, ap):
    h = int(h) % 12 + (12 if ap and ap.startswith('p') else 0)
    return h * 60 + int(m_ or 0)


def _fmt_clock(mins):
    mins %= 24 * 60
    h, m_ = divmod(mins, 60)
    return '%d:%02d %s' % ((h % 12) or 12, m_, 'pm' if h >= 12 else 'am')


def solve_clock(text):
    low = text.lower().replace('.', '')
    times = re.findall(r'\b(\d{1,2})(?::(\d\d))?\s*(am|pm|a m|p m)\b', low)
    dur = re.search(r'(?:(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b)?\s*(?:and\s+)?(?:(\d+)\s*(?:minutes?|mins?|m)\b)?', low[low.find(times[0][-1]) + 2:] if times else '')
    durs = re.findall(r'(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b', low)
    if len(times) >= 2 and re.search(r'how long|how many (?:hours|minutes)|how much time|elapsed', low):
        a = _clock(*times[0]); b = _clock(*times[1])
        d = (b - a) % (24 * 60)
        return _ans('Time between', '%d h %d min' % divmod(d, 60), [{'rule': 'From %s to %s' % (_fmt_clock(a), _fmt_clock(b)), 'latex': r'%d \text{ minutes}' % d}], 'Elapsed time')
    if len(times) == 1 and durs and re.search(r'when|what time|end|finish|arrive|done|get there|be over', low):
        start = _clock(*times[0])
        add = 0
        for v, u in durs:
            add += float(v) * (60 if u.startswith('h') else 1)
        sign = -1 if re.search(r'before|earlier|ago|leave by|must leave', low) else 1
        end = start + sign * add
        return _ans('Time', _fmt_clock(int(round(end))), [{'rule': '%s %s' % ('Subtract' if sign < 0 else 'Add', ' and '.join('%s %s' % (v, u) for v, u in durs)), 'latex': r'%s %s %d \text{ min} = %s' % (_fmt_clock(start).replace(' ', r'\ '), '-' if sign < 0 else '+', add, _fmt_clock(int(round(end))).replace(' ', r'\ '))}], 'Clock arithmetic')
    return None


# ============================================================
# 38. Cutting into equal pieces: "12 meters long … pieces 1.5 meters long"
# ============================================================
def solve_cut_pieces(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    m = re.search(r'(\d+(?:\.\d+)?)\s*(meters?|m|feet|ft|foot|inches|in|yards?|cm|km|miles?)\s+long[^.?]*?[.?]?[^?]*?(?:cut|divided|split|broken)\s+into\s+(?:equal\s+)?pieces\s+(?:that are\s+|each\s+|of\s+)?(\d+(?:\.\d+)?)\s*(meters?|m|feet|ft|foot|inches|in|yards?|cm)', low)
    if not m:
        return None
    L, p_ = float(m.group(1)), float(m.group(3))
    n, rem = divmod(L, p_)
    return _ans('Pieces', '%s pieces' % _fmt(n), [{'rule': 'Total length ÷ length of one piece', 'latex': r'%s \div %s = %s' % (_fmt(L), _fmt(p_), _fmt(L / p_, 6))}], 'Division', extra=[{'title': 'Left over', 'text': '%s %s' % (_fmt(rem, 6), m.group(2))}] if rem > 1e-9 else [])


# ============================================================
# 39. Converting a mixed amount: "3 minutes 45 seconds … how many seconds", "5 feet 8 inches in inches"
# ============================================================
_MIX = {('hour', 'minute'): 60, ('minute', 'second'): 60, ('foot', 'inch'): 12, ('pound', 'ounce'): 16, ('yard', 'foot'): 3, ('meter', 'centimeter'): 100, ('day', 'hour'): 24, ('week', 'day'): 7, ('year', 'month'): 12}


def solve_mixed_units(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    m = re.search(r'(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|feet|foot|ft|pounds?|lbs?|yards?|meters?|m|days?|weeks?|years?)\s+(?:and\s+)?(\d+(?:\.\d+)?)\s*(minutes?|mins?|seconds?|secs?|inches|inch|in|ounces?|oz|feet|ft|centimeters?|cm|hours?|days?|months?)\b', low)
    q = re.search(r'how many\s+(seconds|minutes|inches|ounces|feet|centimeters|hours|days|months)', low)
    if not (m and q):
        return None
    big_, small = _u(m.group(2)), _u(m.group(4))
    k = _MIX.get((big_, small))
    if not k or _u(q.group(1)) != small:
        return None
    v = float(m.group(1)) * k + float(m.group(3))
    return _ans('Answer', '%s %s' % (_fmt(v), q.group(1)), [{'rule': '1 %s = %d %ss' % (big_, k, small), 'latex': r'%s \times %d + %s = %s' % (m.group(1), k, m.group(3), _fmt(v))}], 'Unit conversion')


# ============================================================
# 40. Shadows and other similar triangles
# ============================================================
def solve_shadow(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    if 'shadow' not in low:
        return None
    pairs = re.findall(r'(?:(\d+(?:\.\d+)?)\s*-?\s*(?:m|meters?|ft|feet|foot|cm|inches|in)?\s*(?:tall|high|long)?\s+([a-z]+)|(?:a|an|the)\s+([a-z]+))\s+(?:[a-z]+\s+){0,2}?casts?\s+(?:a\s+)?(\d+(?:\.\d+)?)\s*-?\s*(m|meters?|ft|feet|foot|cm|inches|in)\b', low)
    known = [(float(h), float(sh)) for h, n1, n2, sh, u in pairs if h]
    unknown = [(n2 or n1, float(sh), u) for h, n1, n2, sh, u in pairs if not h]
    if len(known) != 1 or len(unknown) != 1:
        return None
    (h, sh), (name, sh2, u) = known[0], unknown[0]
    ans = h / sh * sh2
    return _ans('Height of the %s' % name, '%s %s' % (_fmt(ans, 6), u), [{'rule': 'Same sun angle, so height ÷ shadow is the same for both', 'latex': r'\frac{%s}{%s} = \frac{x}{%s} \Rightarrow x = %s' % (_fmt(h), _fmt(sh), _fmt(sh2), _fmt(ans, 6))}], 'Similar triangles', label='Geometry')


# ============================================================
# 41. One discount on one price: "25% off the original price of $36"
# ============================================================
def solve_discount(text):
    low = text.lower().replace(',', '')
    d = re.findall(r'(\d+(?:\.\d+)?)\s*%\s*(?:off|discount)', low)
    pm = re.findall(r'\$\s?(\d+(?:\.\d+)?)', low)
    if re.search(r'tax|tip|mark(?:s|ed)? up|markup|raise|increase|then', low):
        return None
    if len(d) != 1 or len(pm) != 1 or re.search(r'tax|tip|original|before', low[low.find('?') - 60:] if '?' in low else '') and re.search(r'what was the original|what is the original|before the', low):
        return None
    P0, r = float(pm[0]), float(d[0]) / 100
    q = _qpart(low.replace('$', ' $')) if '?' in low else low
    if re.search(r'how much (?:is|was) the discount|how much (?:do|does|did|will) (?:you|he|she|they|i) save|amount (?:off|saved)', q):
        return _ans('Discount', '$%.2f' % (P0 * r), [{'rule': '%s%% of $%s' % (_fmt(r * 100), _fmt(P0)), 'latex': r'%s \times %s = %.2f' % (_fmt(P0), _fmt(r), P0 * r)}], 'Discount', label='Percent', extra=[{'title': 'Sale price', 'text': '$%.2f' % (P0 * (1 - r))}])
    return _ans('Sale price', '$%.2f' % (P0 * (1 - r)), [{'rule': 'Take %s%% off' % _fmt(r * 100), 'latex': r'%s \times (1 - %s) = %.2f' % (_fmt(P0), _fmt(r), P0 * (1 - r))}], 'Discount', label='Percent', extra=[{'title': 'You save', 'text': '$%.2f' % (P0 * r)}])


# ============================================================
# 42. Rows of seats, then some taken: "18 rows of 24 seats. 350 seats are filled"
# ============================================================
def solve_rows_filled(text):
    low = words_to_numbers(text.lower()).replace(',', '')
    m = re.search(r'(\d+)\s+(rows|shelves|boxes|bags|packs|teams|groups|tables|pages|trays|crates|cartons)\s+(?:of|with)\s+(\d+)\s+([a-z]+)', low) or re.search(r'(\d+)\s+(rows|shelves|tables)\s+with\s+(\d+)\s+([a-z]+)\s+(?:in|on)\s+each', low)
    if not m:
        return None
    total = int(m.group(1)) * int(m.group(3))
    used = re.search(r'(\d+)\s+(?:of the\s+)?(?:%s\s+)?(?:are|were|is|have been|got)\s+(filled|taken|occupied|sold|used|eaten|broken|full|reserved|booked|empty|left)' % re.escape(m.group(4)), low[m.end():])
    q = _qpart(low) if '?' in low else low
    steps = [{'rule': 'Total = %s × %s' % (m.group(1), m.group(3)), 'latex': r'%s \times %s = %d' % (m.group(1), m.group(3), total)}]
    if used and re.search(r'empty|left|available|unsold|free|remaining|not', q):
        u = int(used.group(1))
        steps.append({'rule': 'Subtract the ones %s' % used.group(2), 'latex': '%d - %d = %d' % (total, u, total - u)})
        return _ans('Answer', '%d %s' % (total - u, m.group(4)), steps, 'Multiply, then subtract')
    if re.search(r'how many', q):
        return _ans('Answer', '%d %s' % (total, m.group(4)), steps, 'Equal groups: multiply')
    return None


# ============================================================
# Entry point
# ============================================================
SOLVERS = [('rows_filled', solve_rows_filled), ('mixed_units', solve_mixed_units), ('shadow', solve_shadow), ('clock', solve_clock), ('part_of_groups', solve_part_of_groups), ('cut_pieces', solve_cut_pieces), ('border', solve_border), ('legs', solve_legs), ('markup', solve_markup), ('sum_diff', solve_sum_diff), ('share', solve_share), ('repeat', solve_repeat), ('exponential', solve_exponential), ('angles', solve_angles), ('average', solve_average), ('tax_tip', solve_tax_tip), ('discount', solve_discount), ('heads_legs', solve_heads_legs), ('ratio', solve_ratio), ('right_triangle_story', solve_right_triangle_story), ('percent_reverse', solve_percent_reverse), ('drain', solve_drain), ('percent_chain', solve_percent_chain), ('fraction_parts', solve_fraction_parts), ('shopping', solve_shopping), ('inverse', solve_inverse), ('current', solve_current), ('two_movers', solve_two_movers), ('mixture', solve_mixture), ('two_items', solve_two_items), ('ages', solve_ages), ('money', solve_money_more), ('backwards', solve_backwards), ('round_division', solve_round_division), ('formula', solve_formula), ('geometry', solve_geometry), ('percent', solve_percent), ('rates_together', solve_rates_together), ('linear_growth', solve_linear_growth), ('proportion', solve_proportion), ('rates', solve_rates), ('relations', solve_relations), ('sequence', solve_sequence), ('changes', solve_changes), ('afford', solve_how_many_afford), ('measure_sum', solve_measure_sum), ('fraction_of', solve_fraction_of), ('algebra', solve_algebra), ('dimensional', solve_dimensional), ('story', solve_story)]


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


def op_features(req):
    """Vertex, intercepts, axis of symmetry, domain/range, extrema of a function of x."""
    f = P(req['expr'])
    v = sorted(f.free_symbols, key=lambda s_: s_.name)
    x = v[0] if v else Symbol('x')
    rows, pods = [], []
    try:
        poly = sp.Poly(sp.expand(f), x)
        deg = poly.degree()
    except Exception:
        poly, deg = None, None
    if deg == 2:
        a, b, c = poly.all_coeffs()
        h = sp.nsimplify(-b / (2 * a)); k = sp.simplify(f.subs(x, h))
        pods.append({'title': 'Vertex', 'big': True, 'latex': r'\left(%s,\ %s\right)' % (sp.latex(h), sp.latex(k)), 'text': '(%s, %s)' % (h, k),
                     'steps': [{'rule': 'For ax² + bx + c the vertex is at x = −b/(2a)', 'latex': r'x = -\frac{%s}{2 \cdot %s} = %s' % (sp.latex(b), sp.latex(a), sp.latex(h))},
                               {'rule': 'Plug that x back in to get y', 'latex': r'y = %s' % sp.latex(k)}]})
        rows += [['Axis of symmetry', 'x = %s' % h], ['Opens', 'upward (minimum at the vertex)' if a > 0 else 'downward (maximum at the vertex)'],
                 ['Vertex form', sp.sstr(sp.Mul(a, (x - h) ** 2, evaluate=False) + k if a != 1 else (x - h) ** 2 + k).replace('**', '^')], ['Range', 'y ≥ %s' % k if a > 0 else 'y ≤ %s' % k]]
    roots = sp.solve(f, x)
    rows += [['x-intercepts (roots)', ', '.join('(%s, 0)' % sp.sstr(r_) for r_ in roots if r_.is_real) or 'none (no real roots)'], ['y-intercept', '(0, %s)' % sp.sstr(f.subs(x, 0))]]
    try:
        dom = sp.calculus.util.continuous_domain(f, x, sp.S.Reals)
        rows.append(['Domain', sp.sstr(dom).replace('Reals', 'all real numbers')])
    except Exception:
        pass
    if deg != 2:
        crit = [c_ for c_ in sp.solve(sp.diff(f, x), x) if c_.is_real]
        if crit:
            rows.append(['Turning points', ', '.join('(%s, %s)' % (sp.sstr(c_), sp.sstr(sp.simplify(f.subs(x, c_)))) for c_ in crit[:6])])
    pods.append({'title': 'Features', 'table': rows})
    try:
        pods.append(plot_pod(plot2d([f], x, roots=[float(r_) for r_ in roots if r_.is_real])))
    except Exception:
        pass
    return {'input': sp.latex(f), 'pods': pods}


OPS['features'] = op_features
OPS['wordproblem'] = op_wordproblem
OPS['check'] = op_check
