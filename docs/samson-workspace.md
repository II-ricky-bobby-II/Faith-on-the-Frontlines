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

The original dev server duplicated `nodejs_compat` and bundled a May 2026
runtime that could not accept the project's September compatibility date.
The duplicate Vite flag is removed and `workerd` is pinned to 1.20261006.1;
the production compatibility date and other framework versions are retained.

`npm start` previews the compiled Worker locally with Wrangler on loopback
port 3000 after `npm run build`, using the root `.wrangler/state` database shared
with development. Wrangler's default for a generated build configuration would
create an empty database beneath `dist/server`. Running `cloudflare:` imports
through the Node-only `vinext start` path fails. The API service permits `AF_NETLINK` for
Node's interface lookup, needed to start the dev server inside the service;
its existing user, privilege and network boundaries still apply.
The VM maps `localhost` to IPv4 only, including its cloud-init hosts template.
This avoids Miniflare's inspector hang when IPv6 is disabled and its runtime
binds `::1` while the controller connects to `127.0.0.1`. The original IPv6
restrictions are retained. See the
[upstream Miniflare issue](https://github.com/cloudflare/workers-sdk/issues/14077).

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
The same SSH wrapper is installed separately on the Mac as
`~/.local/bin/fotf-samson`, so operator access survives retiring the checkout.
For a browser preview, keep the dev command running and open another operator
connection with `ops/samson/ssh.sh -L 3000:127.0.0.1:3000`, then browse
`http://localhost:3000`. This preview path depends on the operator device;
Cloud's project file and job API does not.

## Codex Cloud execution boundary

Codex Cloud uses an OpenAI-managed VM; it does not turn this Proxmox guest into
its native filesystem. The documented private-network path is HTTP/HTTPS over
the environment's configured Tailscale connection. General SSH through that
connection has not been verified. This setup uses the documented HTTPS path.

The cloud task fetches the root-owned `/opt/fotf/remote.py` into
`work/fotf-remote.py` through the authenticated `/client` endpoint. This survives
branch changes and prevents project writes from changing Cloud bootstrap code.
Files and
commands operate on the guest; temporary edit files and the client itself can
exist in Cloud. No nested Codex process, API billing account or model login is
needed in the guest for this workflow.

The private API provides authenticated file reads/writes and bounded jobs. It
binds only to `127.0.0.1:8787`, runs as `fotf`, has no sudo permission and is
published through Tailscale Serve on HTTPS 443. Its token grants command
execution as the project user; treat it as a credential for the entire
development workspace. Tailscale Funnel and public port forwarding are not
part of this setup.

Individual API file transfers are limited to 2 MiB and job diagnostics to
512 KiB. Large exports are retained on the VM and in the server archive;
operator SSH has no API transfer limit.

The guest accepts Tailscale TCP443 only. Proxmox independently prevents its
LAN interface from initiating private-network connections except DNS to the
router. This boundary remains outside the guest. Cloud receives no Proxmox
credential, production deploy token or access to another project VM.

## Tailscale connection

Separate identities are configured for the persistent guest and disposable
Cloud tasks. The approved policy grants Cloud only the guest's HTTPS API;
existing member-device, Horizons, Arise and Atlas rules are preserved.
The following is the recovery procedure, not outstanding setup:

1. Add tags `tag:fotf-vm` and `tag:fotf-cloud`, owned by tailnet administrators.
2. Grant `tag:fotf-cloud` only `tcp:443` to `tag:fotf-vm`. Check existing wildcard
   grants; adding a narrow rule does not cancel a broader existing rule.
   Preserve existing device access while excluding the Cloud and VM tags from
   any default allow-all source rule. Recheck the live policy immediately
   before saving; archived proposals are not live configuration.
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

5. The verified guest IPv4 is `100.117.38.123` and MagicDNS FQDN is
   `fotf-workspace.tail13a215.ts.net`. Use the hostname over HTTPS 443.
6. Create a separate reusable **and ephemeral**, tagged `tag:fotf-cloud` auth
   key for the Codex Cloud environment's Advanced > VPN configuration.
   Record its expiration and renew before it expires. Do not snapshot an
   already authenticated Tailscale daemon into the Cloud template.

The guest's tagged device identity has **key expiry disabled**; its machine
detail explicitly reports **No expiry**. Its single-use enrollment credential
has been consumed and removed. Tailscale Serve is private; Funnel is disabled.

The reusable Cloud enrollment auth key expires **2027-01-04**. Tailscale auth
keys have a 90-day maximum; disabling a device's expiry does not extend an auth
key used to enroll fresh Cloud sessions. Tailscale OAuth credentials can mint
keys indefinitely, but the available Codex VPN field/documentation does not
establish support for OAuth credentials and their required device tags. Do
not label this Cloud credential non-expiring. Renew its scoped auth key before
that date unless Codex adds a verified OAuth or automatic renewal mechanism.
The protected recovery copy is `/etc/fotf/cloud-enrollment.key` on the guest;
no copy is committed to Git.

Merge this grant into the existing tailnet policy after inspecting it:

```json
{"src":["tag:fotf-cloud"],"dst":["tag:fotf-vm"],"ip":["tcp:443"]}
```

Verify policy tests allow the guest on 443 and deny guest SSH, other guests,
Samson management and subnet routes. Do not overwrite the whole tailnet
policy with this fragment.

## Codex Cloud environment configuration

The private environment **Faith on the Frontlines — Samson** is published with
`II-ricky-bobby-II/Faith-on-the-Frontlines` attached. The bootstrap fetches its
client from the VM independently of the branch in the Cloud checkout; use
`develop` for integration work after approval.
The default Cloud VM is sufficient; no larger paid Cloud VM is needed.

| Field | Value |
|---|---|
| Visibility | Only me |
| Internet | Package managers plus the exact guest FQDN |
| VPN | Dedicated reusable, ephemeral `tag:fotf-cloud` Tailscale key |
| Environment variable | `FOTF_VM_URL=https://fotf-workspace.tail13a215.ts.net` |
| Network secret | `FOTF_VM_TOKEN`, allowed only for that guest FQDN |
| Install script | Paste `ops/samson/bootstrap-cloud-client.sh` into the field |
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

The managed execution sandbox can block a connection to the configured proxy.
Use the runtime's supported network approval/escalation when that occurs;
the tested installer succeeds through that path with the VPN, policy and
secret bindings ready. Keep the proxy and TLS verification enabled.

## Recovery and maintenance

GitHub is source control; the VM is the development workspace. Important
uncommitted work, private artifacts and local database state need VM backups.
The guest should be included in Samson's existing Sunday 04:15 Pacific backup
job with four weekly recovery points, plus a verified initial backup.

VM 111 was added to that job on 2026-10-06. The original roster and all other
job settings were preserved; its name still includes `nightly`, but its actual
schedule is weekly.

These recovery copies are on Samson's backup storage. They protect against
guest mistakes and disk-volume loss, but are not an offsite copy for loss of
the entire server. No project-specific local Codex automation was found.

On the guest, inspect `systemctl status fotf-bridge tailscaled fotf-firewall`
and `journalctl -u fotf-bridge`. Completed job records retain 14 days of
diagnostics; logs retain their final 512 KiB. Root-owned installed service
and client code is separate from editable project code; reinstall using
`sudo bash ops/samson/install-bridge.sh` after reviewing infrastructure changes.

Use BTH and Samson's guest agent if Tailscale expires. Keep credentials outside
Git. Rotate `/etc/fotf/bridge-token`, restart the API, update the Cloud network
secret and verify from a new task when revoking Cloud access.

References: [OpenAI Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments),
[Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve),
[auth key expiry](https://tailscale.com/docs/features/access-control/auth-keys),
[OAuth clients](https://tailscale.com/docs/features/oauth-clients).

## Verified migration status — 2026-10-06

The guest passes the production build, three existing site tests, lint and
generated-binding TypeScript checking. Five HTTP API tests pass on macOS and
Linux. The installed API also ran build, tests, lint and types successfully as
the unprivileged `fotf` account inside its systemd restrictions.

After reboot, cloud-init reports done with no errors, all required services
start, file read/write/conflict/delete checks pass, and guest connections to
router SSH, Proxmox administration and the QA guest remain blocked. Public
HTTPS works. The SSH host identity is retained and pinned.

Tailscale is enrolled and private HTTPS Serve survives reboot. The approved
policy and denial tests are saved. A temporary userspace peer with exactly
`tag:fotf-cloud` passed MagicDNS, verified HTTPS, authenticated health, a
conflict-checked file round trip and a command as `fotf`; VM SSH was unreachable.
The temporary peer was removed afterward. This is separate from validation of
OpenAI's managed HTTPS proxy. The private environment is now **published**, and
a new managed Cloud task passed acceptance on source commit `ff49df3` after
the runtime corrections. Its verbatim installer, VPN, enforced network policy
and secret bindings are ready. It used verified TLS and the managed proxy,
with the supported execution permission, without Mac-local paths or tools.
The receipt is `outputs/samson-migration/cloud-acceptance.json` on the VM.

Cloud verified authenticated health, file create/read/update/delete, stale-hash
rejection, executable-mode preservation, wrong-token and traversal rejection,
commands as `fotf` without sudo, and sequential build/tests, lint, types and
all five bridge tests. Other private destinations were forbidden by the proxy;
the VM's SSH path was unavailable. These are scoped-path diagnostics; Cloud
did not independently read the live tailnet ACL.

From Cloud, both dev and built previews return HTTP 200 for home/events.
Invitation validation, honeypot handling and a signup returning 201 passed;
both modes use the existing root D1. Synthetic signups were read back, removed
exactly, and existing records preserved. No preview processes remain. This
does not exercise production D1 or email delivery.

VM runtime images pass compressed-stream and VMA integrity verification. The
2026-10-06 image was also fully restored to temporary VM 70111. Its network
adapter and cloud-init media were removed before boot, so its copied identity
never contacted the LAN or tailnet. The restored guest verified all 82 source
hashes, both JSONL archives, the expected clean Git commit, required services,
the root-owned client, actual API health/authentication/path boundaries, a job
as `fotf`, and all five HTTP API tests. The temporary VM was then removed.
The receipt is `outputs/samson-migration/restore-receipt.json` on the project
workspace. Normal weekly retention replaces older
same-week images. A separate portable archive preserves the Git refs, source,
documents and refreshed session exports, with every source checksum and both
JSONL exports verified. Current recovery paths, hashes and the captured source
commit are recorded at `/mnt/samson-backup/fotf-migration/recovery-receipt.json`
on the Samson hypervisor, alongside protected checksum sidecars.
The Mac working checkout is no longer needed for Cloud execution. Retire only
that project directory after checking the current recovery receipt; retain the
operator key/wrapper and shared Codex account files outside it. Existing local
chats do not change execution host. For new work, select Cloud and **Faith on
the Frontlines — Samson**. Keep an independent copy of private recovery data
before permanently discarding the last local backup; Samson's recovery storage
is still on the same server.
