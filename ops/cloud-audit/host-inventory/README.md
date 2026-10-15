# Faith host inventory — offline proposal, not qualified execution

This branch prepares a single **inventory-only** workflow for independent review.
It does not activate the accepted containment code, install software, load an
application/runtime image, execute candidate code or authorize a future run.
Accepted H `94cf4c116e6eb0fd5cb45c9cf19de8bf3f90d0f1` and its archived packet remain
unchanged in the other worktree. This separate branch starts at current develop
`8edc411319b91ac9b30e2804fd2c4508f1adf995`.

The only intentional baseline change is `.github/workflows/cloud-audit.yml` on
this unpublished probe branch. It reuses the historically registered path/ID
383566525; the workflow on develop and all release checks remain unchanged.
Do not merge this probe replacement into develop or production. Publishing this
exact ref, independent review and an owner-dispatched attempt each remain gated.
Actual provider dispatch access and selected-ref behavior are not established by
these inert tests. No run/attempt is reserved and no UNKNOWN request is replayed.

## Exact execution and authority boundary

- Manual dispatch only, exact same numeric repository ID 1355135878 and owner
  II-ricky-bobby-II/116130409, exact branch
  `chore/faith-host-inventory-offline`, attempt 1, public repository, and the
  independently approved full probe SHA matching both run and workflow SHA.
  External review/approval still supplies authority: `probe_sha` and the storage
  checkbox are consistency/acknowledgement inputs, not self-issued approval.
- One standard GitHub-hosted x64 `ubuntu-22.04` VM; refuse ImageOS/image/kernel/
  architecture drift from ubuntu22 / 20261004.315.1 / 6.8.0-1064-azure / x86_64
  before tool, filesystem inventory or command queries. Retain only bounded
  observed host labels on refusal. No auto-update of expected values or fallback.
- Empty workflow/job `permissions: {}`. No checkout, GitHub API access, secrets
  context, repository token, OIDC, deployment, service/container, package manager,
  setup action, software installation or image pull/build. The runner loads the
  workflow normally; only the existing SHA-pinned upload-artifact action uses its
  platform-provided job service credentials. The collector never reads them.
- The canonical collector is embedded as a JSON string, hashed before execution,
  with no external source loader. This avoids any repository/candidate checkout
  or credential-bearing fetch. `render_workflow.py` produces the exact workflow;
  tests reconstruct and compare every embedded byte. Live execution would use
  `/usr/bin/env -i` with only the explicit metadata keys and fixed PATH/LANG/
  LC_ALL, then `/usr/bin/python3 -I -S -B`: platform service credentials never
  enter the collector process; no user import path, site/.pth startup or pyc writes.
  Only the self-authored collector and pre-existing root-owned OS query tools run.
- No arbitrary argv, shell, executable input, environment dump, event payload,
  secret file, other process environment, image/runtime binary or device ioctl.
  Child commands receive only fixed PATH/LANG/LC_ALL, never inherited credentials,
  proxies or SSH/Actions/GitHub environment. Root-owned tool/library bytes are
  hashed as data; readelf does not execute inspected binaries and ldd is not used.

## Measurements and their limits

The historical audit job 115525577345 in run 38463795310 identified the expected
image and runner 2.337.0. Its official image README lists package/version defaults.
That does not describe a newly allocated VM's provisioning, boot configuration,
live namespace, security policy, remaining resources or exact tool bytes.

| Measured facts | Why they are necessary; what the image inventory cannot prove |
| --- | --- |
| Run/source/workflow/owner/repository IDs, image, kernel, architecture | Bind the artifact to the selected immutable probe and expected host class. A rolling label and historical image README do not identify the next allocation. Fresh recovery must independently fetch the actual run/job and source. |
| Tool real paths, uid/mode, SHA256, dpkg ownership/versions, readelf and helper hashes | Detect substituted/missing binaries or a different installation. Version names alone do not establish bytes, ownership or package closure. Known `/usr`-merge aliases are queried only for the same measured file's package provenance. |
| ELF DT_NEEDED/PT_INTERP dependency paths/hashes/packages | Record the interpreter/shared-library closure without executing a target binary. This excludes dynamic dlopen/NSS/Python modules; whole-OS/package provenance and physical qualification remain additional work. |
| CPU, memory, free bytes/inodes and current uid/gid | Test feasibility against 8,320 MiB future work volumes plus images/evidence/reserve. Advertised hardware does not establish free capacity at job time; no data is pruned to make room. |
| Existing cgroup v2 controllers/subtree/type/events and kill/freeze path facts | Establish presence and current namespace visibility. No cgroup is created and no control file is written, so delegation, enforcement and successful kill/freeze are **not** proven. |
| Current namespace IDs, userns/AppArmor controls, only runner's subuid/subgid records and sudo `id -u` | Identify inherited restrictions/mappings and whether a bounded noninteractive root query succeeds. The probe does not create a namespace, edit mappings, change AppArmor or grant future root execution. |
| Filesystem/mount metadata, loop support and loop-control metadata | Identify ext4/SquashFS/loop presence and propagation context. No mount, loop ioctl, modprobe or device creation occurs; successful private bounded mounts remain a live prerequisite. |
| Current forwarding, links/routes/netns, inherited nftables rules | Identify incompatible topology/rules/backend and whether root read access exists. Image package lists cannot describe job-time state; a read-only listing cannot prove allowed/denied traffic or containment. |
| Current public IPv4 answers for registry.npmjs.org | Record the dynamic CDN set needed for a later approval-bound registry policy. `getent ahostsv4` performs only an ordinary resolver query, with no DNS/route/config change. No HTTP download, new listener or guest egress is opened. Answers are not an automatic future allowlist. |

Fixed query vocabulary: sudo `-n id -u`; ip JSON link/route/netns **show/list**;
sudo nft JSON **list ruleset**; dpkg-query **-S/-W**; readelf **-d/-l**; ldconfig
**-p**; getent **ahostsv4 registry.npmjs.org**. All tools and helpers must already
exist in fixed system paths, be root-owned and lack group/world write permission.
A missing/untrusted tool fails without installation or alternate execution.
Only named `/proc`, `/sys` and runner-mapping metadata are read; no secrets are
collected. The command log contains query names, arguments, exits and hashes,
never raw stderr. No host-controlled command output is emitted to Actions stdout.

## Bounds, evidence and cost

Job timeout is **five minutes**; collector budget **120 seconds**, per-command
budget **five seconds**, collector step cap three minutes and artifact step one
minute. Commands have a combined stdout/stderr cap **128 KiB**, metadata reads
**32 KiB**, each system-file hash **64 MiB** and the ELF graph **64** inspected
objects/dependencies. On abnormal pipe completion, kill the owned utility group
before reaping its leader. No child/runtime daemon is intentionally started.
Underlying kernel I/O stalls are not disproved by these bounds; job timeout and
disposal of the hosted VM are the outer boundary. There is no automatic job retry.

The only collector writes are two new mode-0600 files in a new mode-0700
`host-inventory-evidence` folder: inventory.json and manifest.json, capped at
**1 MiB combined**. Existing/symlink destinations are refused; files and directory
metadata are synced. An oversized report becomes a compact explicit failure,
never a truncated success. An incomplete/missing query or provenance remains
failed/incomplete. Artifact upload runs even on refusal and retains only those
two files for **90 days**. A write/sync/upload failure fails the job; absence of
complete evidence is not success. Fresh recovery must check the real GitHub job
conclusion, exact source and every manifest entry. The numeric job ID is resolved
from the provider after a run; the in-job job label is `inventory`.

This is a public-repository standard runner: current GitHub documentation lists
standard compute as free. Maximum artifact retention is 1 MiB × 90 days = 0.088
GiB-days before platform accounting. Existing account storage/quota is unverified;
the owner must confirm capacity before dispatch. The checkbox is not a billing
API verification. No paid storage, larger runner, subscription, permission or
credential change is approved. Concurrency serializes inventory jobs without
cancelling another job; the owner/coordinator must reconcile outstanding runs
before authorizing one attempt. Concurrency is not cross-run approval deduplication.

Every result states `qualification: false`, `releaseReady: false` and
`externalApprovalVerified: false`. Even successful inventory does not test
candidate/browser/runtime compatibility, isolation, limits, cleanup or release.
Do not treat it as a qualified host profile or substitute it for the accepted
containment and unchanged release gates.

## Offline verification and next gates

Run only the self-authored inert suite in Cloud:

```text
python3 -B -m unittest discover -s ops/cloud-audit/host-inventory/tests -v
```

All host ports and subprocess launches in these tests are inert/mocked. The
tests do not run this probe, inspect the Cloud host or invoke OS query tools.
Only private temporary evidence files are written. PyYAML is already available
in the saved Cloud environment for static workflow parsing; no dependency was
installed and the workflow itself uses only the Python standard library.

Independent review must approve this exact commit/tree, workflow and collector
hashes. Then separately request publication of this named probe ref (not a merge
to develop), verify the supported selected-ref dispatch path and owner/storage
authority, reconcile runs, and request one exact owner dispatch. No publication
or dispatch is authorized by this preparation. No candidate/runtime/images or
privileged setup can follow automatically. A measured inventory still requires
new review, image artifacts and separate live-qualification approval.

Official references: [workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax),
[default variables](https://docs.github.com/en/actions/reference/workflows-and-actions/variables),
[workflow triggering](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow),
[historical image](https://raw.githubusercontent.com/actions/runner-images/ubuntu22/20261004.315/images/ubuntu/Ubuntu2204-Readme.md),
[runner specifications](https://docs.github.com/en/actions/reference/runners/github-hosted-runners),
[billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
