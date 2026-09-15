"""
fix_mojibake_v2.py
------------------
Fixes double-encoded (UTF-8 bytes re-saved as cp1252→UTF-8) mojibake
in the frontend TSX files.

The corruption pattern:
  Original UTF-8 bytes of a Unicode char were read as Windows-1252
  (cp1252) and then re-saved as UTF-8, producing garbled text.

Fix: for each run of non-ASCII chars in the file, re-encode them
  as cp1252 bytes, then decode those bytes as UTF-8.
"""

import os
import re

FILES = [
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
    r'bob-ai-hackathon-ThinkTankX\src\frontend\app\components\ChatBot.tsx',
    r'bob-ai-hackathon-ThinkTankX\src\frontend\app\context.tsx',
    r'bob-ai-hackathon-ThinkTankX\src\frontend\app\layout.tsx',
    r'bob-ai-hackathon-ThinkTankX\src\frontend\app\providers.tsx',
    r'bob-ai-hackathon-ThinkTankX\src\frontend\src\lib\store.tsx',
    r'bob-ai-hackathon-ThinkTankX\src\frontend\src\services\api.ts',
]


def fix_mojibake_chunk(s: str) -> str:
    """
    Try to reverse the cp1252-reinterpretation of UTF-8 bytes.
    If the re-encoded bytes decode as valid UTF-8, return the fixed char.
    Otherwise return the original string unchanged.
    """
    try:
        raw_bytes = s.encode('cp1252')
        return raw_bytes.decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return s


def fix_text(text: str) -> str:
    """
    Find all maximal runs of non-ASCII characters and attempt to fix each.
    ASCII characters are left untouched.
    """
    # Split on runs of non-ASCII characters
    parts = re.split(r'([\x00-\x7f]+)', text)
    result = []
    for part in parts:
        if not part:
            continue
        # ASCII run — keep as-is
        if re.match(r'^[\x00-\x7f]+$', part):
            result.append(part)
        else:
            # Non-ASCII run — try to un-mojibake
            fixed = fix_mojibake_chunk(part)
            result.append(fixed)
    return ''.join(result)


def process_file(path: str) -> None:
    if not os.path.exists(path):
        print(f'SKIP (not found): {path}')
        return

    with open(path, 'rb') as f:
        raw = f.read()

    # Strip UTF-8 BOM if present
    had_bom = raw[:3] == b'\xef\xbb\xbf'
    if had_bom:
        raw = raw[3:]

    text = raw.decode('utf-8')
    fixed = fix_text(text)

    if fixed == text and not had_bom:
        print(f'CLEAN: {path}')
        return

    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(fixed)
    print(f'FIXED: {path}')


if __name__ == '__main__':
    for f in FILES:
        process_file(f)
    print('Done.')
