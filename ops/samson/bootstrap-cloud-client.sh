#!/bin/sh
# Paste into the Cloud install field. It also works as a startup fallback.
set -eu
cd /workspace/Faith-on-the-Frontlines
python3 - <<'PY'
import base64, hashlib, json, os, urllib.request
from pathlib import Path
url = os.environ['FOTF_VM_URL'].rstrip('/')
if not url.startswith('https://'):
    raise RuntimeError('Verified HTTPS is required')
request = urllib.request.Request(url + '/files?path=ops/samson/remote.py',
    headers={'Authorization': 'Bearer ' + os.environ['FOTF_VM_TOKEN']})
# urllib honors the managed HTTPS proxy; do not bypass it or disable TLS.
with urllib.request.urlopen(request, timeout=30) as response:
    result = json.load(response)
content = base64.b64decode(result['base64'], validate=True)
if hashlib.sha256(content).hexdigest() != result['sha256']:
    raise RuntimeError('Remote client checksum mismatch')
destination = Path('work/fotf-remote.py')
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_bytes(content)
print('Installed the verified Faith VM client')
PY
python3 work/fotf-remote.py health
python3 work/fotf-remote.py exec --timeout 60 -- git status --short --branch
