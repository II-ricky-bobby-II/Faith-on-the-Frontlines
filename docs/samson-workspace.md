# Faith on the Frontlines on Samson

This moves the development workspace off the Mac. The production website and
Cloudflare D1 remain in their existing hosted services. The workstream is
`global_fellowship`.

## VM and files

| Setting | Value |
|---|---|
| Hypervisor | Samson, `192.168.88.247` |
| Guest | VM 111, `fotf-workspace` |
| Resources | 2 vCPUs, 4 GiB RAM, 24 GiB thin disk, 2 GiB swap |
| OS | Clean Ubuntu 24.04 image dated 2026-09-26 |
| LAN | `192.168.88.209`, reserved for `BC:24:11:F0:01:11` |
| Project | `/srv/faith-on-the-frontlines` |
| Operator / runtime | `fotfops` / `fotf` |
| Node | 22.23.3, checksum verified |
| Startup | Guest starts with Samson; private workspace API starts with guest |

The migration includes source, assets, the complete Git directory and refs,
ignored Drizzle migration files, Wrangler state and two locally identified
Codex session snapshots. Mac `node_modules`, build caches and Python bytecode
are excluded because they are disposable or platform-specific. Linux
dependencies are reinstalled from `package-lock.json`.

Use `npm run typecheck` to build the effective Cloudflare configuration,
generate its runtime/binding declarations, then run TypeScript. A fresh
checkout's plain `npx tsc --noEmit` lacks those generated declarations.

Session snapshots are an archive, not a supported import into Codex's chat
database. The sidebar project, chat execution hosts and shared Codex settings
are separate from the repository. Do not copy the Mac's entire Codex account
directory, SSH directory, browser profile or other business workspaces.

## Operator access

Use the existing Bethany Back to Home VPN, then:

```sh
ops/samson/ssh.sh
sudo -iu fotf
cd /srv/faith-on-the-frontlines
npm run dev -- --host 127.0.0.1 --port 3000
```

The SSH key lives outside the repository at
`~/.ssh/codex_fotf_samson_ed25519`; host keys are pinned in
`~/.ssh/codex_fotf_samson_known_hosts` after obtaining them through Samson's
authenticated guest agent. Do not copy the private operator key into Cloud.
For a browser preview, keep the dev command running and open another operator
connection with `ops/samson/ssh.sh -L 3000:127.0.0.1:3000`, then browse
`http://localhost:3000`. This preview path depends on the operator device;
Cloud's project file and job API does not.

## Codex Cloud execution boundary

Codex Cloud uses an OpenAI-managed VM; it does not turn this Proxmox guest into
its native filesystem. The documented private-network path is HTTP/HTTPS over
the environment's configured Tailscale connection. General SSH through that
connection has not been verified. This setup uses the documented HTTPS path.

The cloud task controls the guest through `ops/samson/remote.py`. Files and
commands operate on the guest; temporary edit files and the client itself can
exist in Cloud. No nested Codex process, API billing account or model login is
needed in the guest for this workflow.

The private API provides authenticated file reads/writes and bounded jobs. It
binds only to `127.0.0.1:8787`, runs as `fotf`, has no sudo permission and is
published through Tailscale Serve on HTTPS 443. Its token grants command
execution as the project user; treat it as a credential for the entire
development workspace. Tailscale Funnel and public port forwarding are not
part of this setup.

The guest accepts Tailscale TCP443 only. Proxmox independently prevents its
LAN interface from initiating private-network connections except DNS to the
router. This boundary remains outside the guest. Cloud receives no Proxmox
credential, production deploy token or access to another project VM.

## Tailscale connection to finish

Use separate identities for the persistent guest and disposable cloud tasks:

1. Add tags `tag:fotf-vm` and `tag:fotf-cloud`, owned by tailnet administrators.
2. Grant `tag:fotf-cloud` only `tcp:443` to `tag:fotf-vm`. Check existing wildcard
   grants; adding a narrow rule does not cancel a broader existing rule.
   The private migration review contains an exact proposed policy and denial
   tests. Preserve existing device access while excluding the new Cloud and
   VM tags from any default allow-all source rule. Recheck the live policy
   immediately before saving; the proposal is not a live configuration.
3. Enroll the guest as persistent, tagged `tag:fotf-vm`; disable routes, exit
   node, accepted routes, accepted DNS and Tailscale SSH. Use a single-use,
   non-ephemeral enrollment key. Keep any key in a root-only temporary file,
   never a command argument, Git file, chat message or transcript.
4. Enable tailnet HTTPS certificates, then run on the guest:

   ```sh
   sudo tailscale serve --bg --https=443 http://127.0.0.1:8787
   sudo tailscale serve status
   sudo tailscale status
   ```

5. Record the guest's actual MagicDNS FQDN. The expected name is
   `fotf-workspace.tail13a215.ts.net`, but verify rather than assume it.
6. Create a separate reusable **and ephemeral**, tagged `tag:fotf-cloud` auth
   key for the Codex Cloud environment's Advanced > VPN configuration.
   Record its expiration and renew before it expires. Do not snapshot an
   already authenticated Tailscale daemon into the Cloud template.

Merge this grant into the existing tailnet policy after inspecting it:

```json
{"src":["tag:fotf-cloud"],"dst":["tag:fotf-vm"],"ip":["tcp:443"]}
```

Verify policy tests allow the guest on 443 and deny guest SSH, other guests,
Samson management and subnet routes. Do not overwrite the whole tailnet
policy with this fragment.

## Codex Cloud environment configuration

Create a private environment named **Faith on the Frontlines — Samson** with
`II-ricky-bobby-II/Faith-on-the-Frontlines` attached. Prepare the operations
files from this reviewed branch, then use `develop` for integration work.
The default Cloud VM is sufficient; no larger paid Cloud VM is needed.

| Field | Value |
|---|---|
| Visibility | Only me |
| Internet | Package managers plus the exact guest FQDN |
| VPN | Dedicated reusable, ephemeral `tag:fotf-cloud` Tailscale key |
| Environment variable | `FOTF_VM_URL=https://<verified-guest-fqdn>` |
| Network secret | `FOTF_VM_TOKEN`, allowed only for that guest FQDN |
| Install script | `sh ops/samson/install-cloud.sh` |
| Start instructions | Contents of `docs/samson-cloud-start.md` |

The guest token is generated at `/etc/fotf/bridge-token`, mode 0600. Enter it
directly into the Cloud network-secret configuration without printing it in
chat. Cloud processes receive a placeholder; the proxy replaces it only for
the allowed HTTPS destination on port 443. Preserve the managed HTTPS proxy
and TLS verification. A domain allowance does not provide authentication.

Publish after setup succeeds, then verify in a **new** Cloud task. Required
proof: health; remote file read; conflict-checked temporary file round trip;
remote lint, types, tests and build; denied paths and wrong token; denied
private-network destinations. The task must use no Mac-local paths or tools.
Only after that proof and a verified server backup should the Mac checkout be
retired. Existing local chats keep their original execution mode.

## Recovery and maintenance

GitHub is source control; the VM is the development workspace. Important
uncommitted work, private artifacts and local database state need VM backups.
The guest should be included in Samson's existing Sunday 04:15 Pacific backup
job with four weekly recovery points, plus a verified initial backup.

VM 111 was added to that job on 2026-10-06. The original roster and all other
job settings were preserved; its name still includes `nightly`, but its actual
schedule is weekly.

On the guest, inspect `systemctl status fotf-bridge tailscaled fotf-firewall`
and `journalctl -u fotf-bridge`. Completed job records retain 14 days of
diagnostics; logs retain their final 512 KiB. Root-owned installed service
code is separate from editable project code; reinstall using
`sudo bash ops/samson/install-bridge.sh` after reviewing infrastructure changes.

Use BTH and Samson's guest agent if Tailscale expires. Keep credentials outside
Git. Rotate `/etc/fotf/bridge-token`, restart the API, update the Cloud network
secret and verify from a new task when revoking Cloud access.

References: [OpenAI Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments),
[Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve).

## Verified migration status — 2026-10-06

The guest passes the production build, three existing site tests, lint and
generated-binding TypeScript checking. Four HTTP API tests pass on macOS and
Linux. The installed API also ran build, tests, lint and types successfully as
the unprivileged `fotf` account inside its systemd restrictions.

After reboot, cloud-init reports done with no errors, all required services
start, file read/write/conflict/delete checks pass, and guest connections to
router SSH, Proxmox administration and the QA guest remain blocked. Public
HTTPS works. The SSH host identity is retained and pinned.

Tailscale is installed but unenrolled. No Cloud environment has been published
for this workspace. Tailnet permission changes and new credentials require
the pending browser confirmation. The Mac copy remains a rollback copy until
a fresh Cloud task proves laptop-independent access and the backup is verified.
