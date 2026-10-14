#!/bin/bash
# Root-only first boot; installs no model account or production credentials.
set -euo pipefail
umask 027
install -d -o fotf -g fotf -m 0700 /srv/faith-on-the-frontlines /srv/fotf-archive /var/lib/fotf-bridge
install -d -m 0755 /opt/fotf
cat >/etc/ssh/sshd_config.d/10-fotf.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
AllowUsers fotfops
AllowAgentForwarding no
AllowTcpForwarding yes
X11Forwarding no
PermitTunnel no
EOF
install -d -m 0755 /run/sshd
sshd -t
systemctl enable --now ssh
systemctl reload ssh
cat >/etc/sysctl.d/90-fotf.conf <<'EOF'
net.ipv4.ip_forward=0
net.ipv6.conf.all.disable_ipv6=1
net.ipv6.conf.default.disable_ipv6=1
EOF
sysctl --system >/dev/null
# Miniflare connects its runtime inspector at 127.0.0.1. Keep localhost IPv4
# when IPv6 is disabled, including the cloud-init template used after reboot.
python3 - <<'PY'
from pathlib import Path
for filename in ['/etc/hosts', '/etc/cloud/templates/hosts.debian.tmpl']:
    path = Path(filename)
    lines = []
    for line in path.read_text().splitlines(keepends=True):
        head, marker, comment = line.rstrip('\n').partition('#')
        fields = head.split()
        if fields and fields[0] == '::1' and 'localhost' in fields[1:]:
            fields.remove('localhost')
            line = ' '.join(fields) + (' #' + comment if marker else '') + '\n'
        lines.append(line)
    path.write_text(''.join(lines))
PY
if ! test -f /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  printf '/swapfile none swap sw 0 0\n' >>/etc/fstab
fi
NODE_VERSION=22.23.3
NODE_SHA256=df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de
curl --fail --location --silent --show-error "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" -o /var/tmp/fotf-node.tar.xz
printf '%s  /var/tmp/fotf-node.tar.xz\n' "$NODE_SHA256" | sha256sum --check --status
tar -xJf /var/tmp/fotf-node.tar.xz -C /opt/fotf
for binary in node npm npx; do
  ln -sfn "/opt/fotf/node-v${NODE_VERSION}-linux-x64/bin/$binary" "/usr/local/bin/$binary"
done
rm /var/tmp/fotf-node.tar.xz
# Tailscale's signed Ubuntu package repository. Enrollment is a separate step.
curl --fail --silent --show-error https://pkgs.tailscale.com/stable/ubuntu/noble.noarmor.gpg -o /usr/share/keyrings/tailscale-archive-keyring.gpg
curl --fail --silent --show-error https://pkgs.tailscale.com/stable/ubuntu/noble.tailscale-keyring.list -o /etc/apt/sources.list.d/tailscale.list
chmod 0644 /usr/share/keyrings/tailscale-archive-keyring.gpg /etc/apt/sources.list.d/tailscale.list
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq tailscale
systemctl enable --now tailscaled
systemctl enable --now unattended-upgrades
timedatectl set-timezone America/Los_Angeles
touch /var/lib/fotf-bootstrap-complete
