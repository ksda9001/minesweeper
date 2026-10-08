"""Check the Store identity, native architecture, bundled runtime, and block hashes."""
import hashlib
import base64
import struct
import sys
import xml.etree.ElementTree as ET
from zipfile import ZipFile
from io import BytesIO
from urllib.parse import quote
from PIL import Image

def check(path):
    with ZipFile(path) as package:
        assert package.testzip() is None, 'Corrupt ZIP member'
        manifest = ET.fromstring(package.read('AppxManifest.xml'))
        ns = {'p': 'http://schemas.microsoft.com/appx/manifest/foundation/windows10'}
        identity = manifest.find('p:Identity', ns)
        assert identity.get('Name') == 'NornsInteractive.realisticminesweeper'
        assert identity.get('Publisher') == 'CN=57D5F6C5-4C07-4795-B390-4860843E2094'
        assert identity.get('ProcessorArchitecture') == 'x64'
        version = list(map(int, identity.get('Version').split('.')))
        assert len(version) == 4 and version[0] > 0
        assert all(0 <= v <= 65535 for v in version) and version[-1] == 0
        assert manifest.find('p:Properties/p:PublisherDisplayName', ns).text == 'Norns Interactive'
        assert {r.get('Language') for r in manifest.find('p:Resources', ns)} == {'en-US', 'zh-CN'}
        assert [c.get('Name') for c in manifest.find('p:Capabilities', ns)] == ['runFullTrust']
        assert 'AppxSignature.p7x' not in package.namelist(), 'Store upload is deliberately unsigned'
        for name in ['App/realistic-minesweeper.exe', 'App/WebView2/msedgewebview2.exe']:
            data = package.read(name)
            offset = struct.unpack_from('<I', data, 0x3c)[0]
            assert data[offset:offset+4] == b'PE\0\0'
            assert struct.unpack_from('<H', data, offset+4)[0] == 0x8664, f'{name} is not x64'
        for name, size in [('StoreLogo', 50), ('Square44x44Logo', 44), ('Square150x150Logo', 150)]:
            assert Image.open(BytesIO(package.read(f'Assets/{name}.png'))).size == (size, size)
        blockmap = ET.fromstring(package.read('AppxBlockMap.xml'))
        assert blockmap.get('HashMethod') == 'http://www.w3.org/2001/04/xmlenc#sha256'
        for file in blockmap:
            name = file.get('Name').replace('\\', '/')
            if name not in package.namelist():
                name = quote(name, safe='/')
            data = package.read(name)
            assert len(data) == int(file.get('Size'))
            blocks = [b for b in file if b.tag.endswith('}Block')]
            assert len(blocks) == (len(data) + 65535) // 65536
            for i, block in enumerate(blocks):
                digest = base64.b64encode(hashlib.sha256(data[i*65536:(i+1)*65536]).digest()).decode()
                assert digest == block.get('Hash'), file.get('Name')
        print(f'PASS: Store identity, x64 binaries, icons, SHA-256 block map ({len(package.namelist())} files).')

if __name__ == '__main__':
    check(sys.argv[1])
