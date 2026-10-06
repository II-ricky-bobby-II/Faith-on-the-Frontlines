#!/bin/sh
# Codex Cloud install field: no nested model runtime or VPN daemon required.
set -eu
command -v python3 >/dev/null
python3 -c 'import ssl, urllib.request, json, base64'
python3 -m py_compile ops/samson/remote.py
printf 'Cloud client ready. Configure VPN, VM hostname and network secret before startup.\n'
