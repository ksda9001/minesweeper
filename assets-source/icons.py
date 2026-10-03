"""Package the generated icon for Web, Windows, and Android. Requires Pillow."""
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
# The Blender numbers.py script must not shadow Python's numeric module.
sys.path[0] = str(root)
from PIL import Image

source = Image.open(root / 'assets-source/app-icon.png').convert('RGBA')
web = root / 'apps/web/public'
res = root / 'apps/mobile/android/app/src/main/res'
for size in (256, 512):
    source.resize((size, size), Image.Resampling.LANCZOS).save(web / f'icon-{size}.png')
source.save(root / 'apps/desktop/src-tauri/icons/icon.ico', sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
for density, size, foreground in [('mdpi', 48, 108), ('hdpi', 72, 162), ('xhdpi', 96, 216), ('xxhdpi', 144, 324), ('xxxhdpi', 192, 432)]:
    directory = res / f'mipmap-{density}'
    icon = source.resize((size, size), Image.Resampling.LANCZOS)
    for name in ('ic_launcher.png', 'ic_launcher_round.png'):
        icon.save(directory / name)
    canvas = Image.new('RGBA', (foreground, foreground))
    inset = source.resize((foreground * 2 // 3, foreground * 2 // 3), Image.Resampling.LANCZOS)
    offset = (foreground - inset.width) // 2
    canvas.alpha_composite(inset, (offset, offset))
    canvas.save(directory / 'ic_launcher_foreground.png')
print('Web, Windows and Android launcher icons updated.')
