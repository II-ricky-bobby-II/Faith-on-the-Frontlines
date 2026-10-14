#!/bin/sh
set -eu
exec ssh -i "${FOTF_SSH_KEY:-$HOME/.ssh/codex_fotf_samson_ed25519}" \
  -o IdentityAgent=none -o IdentitiesOnly=yes -o BatchMode=yes \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="${FOTF_KNOWN_HOSTS:-$HOME/.ssh/codex_fotf_samson_known_hosts}" \
  -o ConnectTimeout=15 -o ServerAliveInterval=30 \
  "fotfops@${FOTF_SSH_HOST:-192.168.88.209}" "$@"
