"""Export the existing app icon at Microsoft package/listing sizes; requires Pillow."""
from pathlib import Path
import argparse
from PIL import Image

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--package-assets', type=Path, required=True)
args = parser.parse_args()
args.package_assets.mkdir(parents=True, exist_ok=True)
source = Image.open(root / 'assets-source/app-icon.png').convert('RGBA')
for name, size in [('StoreLogo', 50), ('Square44x44Logo', 44), ('Square71x71Logo', 71),
                   ('Square150x150Logo', 150), ('Square310x310Logo', 310), ('AppTileIcon', 300)]:
    source.resize((size, size), Image.Resampling.LANCZOS).save(args.package_assets / f'{name}.png')
wide = Image.new('RGBA', (310, 150), '#171a12')
wide.alpha_composite(source.resize((150, 150), Image.Resampling.LANCZOS), (80, 0))
wide.save(args.package_assets / 'Wide310x150Logo.png')
print('Exported 7 package/listing icons from the original artwork.')
