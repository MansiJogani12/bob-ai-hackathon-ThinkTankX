import os

files = [
    r'bob-ai-hackathon-ThinkTankX\src\frontend\app\page.tsx',
    r'bob-ai-hackathon-ThinkTankX\src\frontend\app\dashboard\ui.tsx',
    r'bob-ai-hackathon-ThinkTankX\src\frontend\app\dashboard\wafer\page.tsx',
    r'bob-ai-hackathon-ThinkTankX\src\frontend\app\dashboard\page.tsx',
    r'bob-ai-hackathon-ThinkTankX\src\frontend\app\dashboard\defects\page.tsx',
    r'bob-ai-hackathon-ThinkTankX\src\frontend\app\dashboard\corrective\page.tsx',
    r'bob-ai-hackathon-ThinkTankX\src\frontend\app\dashboard\process\page.tsx',
    r'bob-ai-hackathon-ThinkTankX\src\frontend\app\dashboard\batchrisk\page.tsx',
    r'bob-ai-hackathon-ThinkTankX\src\frontend\app\dashboard\batch\page.tsx',
    r'bob-ai-hackathon-ThinkTankX\src\frontend\app\dashboard\rootcause\page.tsx',
]

# Each tuple: (mojibake bytes decoded as latin-1, correct unicode char)
# These are UTF-8 bytes misread as latin-1/cp1252
replacements = [
    ('\u00e2\u0094\u0080', '\u2500'),   # BOX DRAWINGS LIGHT HORIZONTAL ─
    ('\u00e2\u0095\u0090', '\u2550'),   # BOX DRAWINGS DOUBLE HORIZONTAL ═
    ('\u00e2\u0080\u00a2', '\u2022'),   # BULLET •
    ('\u00e2\u0080\u0094', '\u2014'),   # EM DASH —
    ('\u00e2\u0080\u0093', '\u2013'),   # EN DASH –
    ('\u00e2\u0086\u0092', '\u2192'),   # RIGHTWARDS ARROW →
    ('\u00e2\u0086\u0090', '\u2190'),   # LEFTWARDS ARROW ←
    ('\u00e2\u0086\u0093', '\u2193'),   # DOWNWARDS ARROW ↓
    ('\u00e2\u0086\u0091', '\u2191'),   # UPWARDS ARROW ↑
    ('\u00e2\u0096\u00bc', '\u25bc'),   # BLACK DOWN-POINTING TRIANGLE ▼
    ('\u00e2\u0096\u00b2', '\u25b2'),   # BLACK UP-POINTING TRIANGLE ▲
    ('\u00e2\u009a\u00a0', '\u26a0'),   # WARNING SIGN ⚠
    ('\u00e2\u009c\u0093', '\u2713'),   # CHECK MARK ✓
    ('\u00e2\u009c\u0094', '\u2714'),   # HEAVY CHECK MARK ✔
    ('\u00e2\u009c\u0095', '\u2715'),   # MULTIPLICATION X ✕
    ('\u00e2\u0080\u009c', '\u201c'),   # LEFT DOUBLE QUOTATION MARK "
    ('\u00e2\u0080\u009d', '\u201d'),   # RIGHT DOUBLE QUOTATION MARK "
    ('\u00e2\u0080\u0098', '\u2018'),   # LEFT SINGLE QUOTATION MARK '
    ('\u00e2\u0080\u0099', '\u2019'),   # RIGHT SINGLE QUOTATION MARK '
    ('\u00ef\u00bb\u00bf', ''),         # BOM (zero-width no-break space)
]

for f in files:
    if not os.path.exists(f):
        print('SKIP (not found):', f)
        continue
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()
    original = content
    for bad, good in replacements:
        content = content.replace(bad, good)
    if content != original:
        with open(f, 'w', encoding='utf-8', newline='') as fh:
            fh.write(content)
        print('FIXED:', f)
    else:
        print('CLEAN:', f)

print('Done.')
