"""Verify that the delivered APK contains the current app and all offline assets."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent.parent
apk = root / '拾词-安卓安装包.apk'
with zipfile.ZipFile(apk) as package:
    assert package.testzip() is None, 'APK CRC mismatch'
    for name in ['AndroidManifest.xml', 'resources.arsc', 'classes.dex', 'res/drawable/icon.png']:
        assert name in package.namelist(), f'Missing {name}'
    assert package.read('classes.dex').startswith(b'dex\n'), 'Invalid DEX'
    for name in ['styles.css', 'core.js', 'learning-aids.js', 'app.js', 'icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest']:
        assert package.read('assets/' + name) == (root / name).read_bytes(), f'Stale bundled asset: {name}'
    assert package.read('assets/native-adapter.js') == (root / 'android/native-adapter.js').read_bytes()
    index = package.read('assets/index.html').decode('utf-8')
    assert index.index('learning-aids.js') < index.index('native-adapter.js') < index.index('./app.js')
    assert 'assets/sw.js' not in package.namelist(), 'Native app must not cache outdated packaged assets'
    forbidden = ['signing/', 'password.txt', 'shici-release.jks', 'tests/', '.android-tools/']
    assert not any(part in name for part in forbidden for name in package.namelist()), 'Private build files included'
    report = {'file': apk.name, 'bytes': apk.stat().st_size, 'sha256': hashlib.sha256(apk.read_bytes()).hexdigest(), 'offline_assets_match_source': True, 'crc_valid': True, 'device_installation_tested': False}
(root / 'android/build/verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
