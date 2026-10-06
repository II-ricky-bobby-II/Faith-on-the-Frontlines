#!/bin/bash
# Run as root in the FOTF VM after transferring the project.
set -euo pipefail
test "$(hostname)" = fotf-workspace
test "$(id -u)" = 0
source_dir=$(cd -- "$(dirname -- "$0")" && pwd)
install -d -m 0700 /etc/fotf
install -d -o fotf -g fotf -m 0700 /var/lib/fotf-bridge/home
if ! test -f /etc/fotf/bridge-token; then
  python3 - <<'PY'
import os, secrets
fd = os.open('/etc/fotf/bridge-token', os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
with os.fdopen(fd, 'w') as stream:
    stream.write(secrets.token_urlsafe(48) + '\n')
PY
fi
printf '{"workstream":"global_fellowship","project":"faith-on-the-frontlines"}\n' >/etc/fotf/workstream.json
install -o root -g root -m 0644 "$source_dir/bridge.py" /opt/fotf/bridge.py
install -o root -g root -m 0644 "$source_dir/bridge.service" /etc/systemd/system/fotf-bridge.service
install -o root -g root -m 0644 "$source_dir/guest-firewall.nft" /etc/fotf/guest-firewall.nft
install -o root -g root -m 0644 "$source_dir/firewall.service" /etc/systemd/system/fotf-firewall.service
nft --check -f /etc/fotf/guest-firewall.nft
systemd-analyze verify /etc/systemd/system/fotf-bridge.service
systemctl daemon-reload
if ! nft list table inet fotf >/dev/null 2>&1; then
  systemctl enable --now fotf-firewall.service
else
  systemctl enable fotf-firewall.service
fi
systemctl enable --now fotf-bridge.service
systemctl restart fotf-bridge.service
systemctl is-active --quiet fotf-bridge.service
printf 'Workspace API running on loopback. Tailscale enrollment and HTTPS publication are separate.\n'
