# Faith Cloud audit workflow

Status: prepared for review; replacement qualification is pending. Business role:
`global_fellowship`. Existing Mac source/recovery and VM111 retirement remain under
their separate owner chat. This runner does not use Samson, a permanent Mac
checkout, a VPN, production D1, or production deployment/email credentials.

## Execution and evidence

Every actual PR merge into develop wakes David through the existing private
signed MCP Events bridge. No scheduled polling is added. Before dispatch, David
independently reads repository ID `1355135878`, the actual merged PR and its full
immutable merge SHA. Author must be `mitchell-FOF` / `324176645`. Allowed merge
actors are that account and `II-ricky-bobby-II` / `116130409`. Both login and
numeric ID must match. Unexpected identities still generate notifications; David
alerts Blake and pauses. An owner-authored setup PR is therefore a deliberate
pause-path test, never an implicit author exception.

The target private environment is **Faith on the Frontlines — Cloud audits**.
Each audit uses a fresh GitHub checkout at the exact candidate, covering the
complete production-to-candidate diff. `ops/cloud-audit/verify-candidate.mjs`
independently verifies GitHub metadata and ancestry. Cloud coordinates source
review and artifact recovery; the reviewed GitHub Actions job executes candidate
code. The October 13 Cloud setup could not launch sandboxed Chromium and exposed
platform GitHub authentication and a Docker socket, so it is not qualified to
execute arbitrary candidate code. Keep the browser sandbox enabled and do not
use Docker to bypass that limit. `run.mjs` checks the clean
checkout, preserves the candidate, runs lint/build/unit/generated-binding type
checks, verifies event/candidate guards, and starts workerd with a separate
synthetic D1 database and local Payload fixture. Chromium checks eight routes at
390, 768 and 1280px, keyboard navigation, form validation, signup/upsert/readback,
CMS list/detail rendering and WCAG axe rules. Browser traffic is restricted to
the loopback preview. No production binding or inherited application credential
is passed to the fixture process.

The environment filter is not an OS sandbox. Candidate code and dependency
installation must run in a fresh executor without credential files, production
service identity or access to another workstream's resources. Independently
verify that custody before treating an executor as qualified. Keep separately
scoped Actions dispatch access outside candidate execution.

These deterministic checks supplement a fresh Cloud code review, the installed
Codex Security plugin's canonical diff scan, manual visual/accessibility review,
and checks for the actual changed feature. `report.json` always says
`releaseReady: false`: a green runner alone cannot approve release. The inquiry
endpoint currently accepts input without sending email/CRM; the suite explicitly
records that limitation.

The manually dispatched `cloud-audit.yml` runs only from develop. It independently
checks identity before its audit job can start, checks out the candidate by SHA,
uses reviewed develop's harness, and retains failed as well as successful
results. It has read-only repository permission and no production environment.
David can request this workflow from a fresh Cloud task using separately scoped
Actions dispatch access. A webhook receipt, an Actions run, and a completed
Cloud review are three distinct pieces of evidence.

Artifacts retain identity decisions, exact candidate/tree/lock hashes, the full
unreleased patch, logs, screenshots, browser/accessibility findings, CMS hits and
D1 readback. `manifest.json` hashes exported files; `results.mjs` detects candidate
mismatch or modified files. GitHub stores artifacts for **90 days**, subject to
repository limits. Export any needed long-term history before expiration; do
not treat task-local files or a cached environment as a permanent archive.
Security reports and manual review outcomes must be attached to the same exact
candidate through the approved artifact destination before release review.

## Repeatable commands

Use Node `22.13.0` (CI's exact version); Node 24 is also supported by current
dependencies. Preserve the managed Cloud network proxy and CA verification.

```sh
npm ci
node node_modules/playwright/cli.js install --with-deps chromium
node ops/cloud-audit/verify-candidate.mjs <PR_NUMBER> <FULL_MERGE_SHA> outputs/candidate.json
node ops/cloud-audit/run.mjs --pr <PR_NUMBER> --candidate <FULL_MERGE_SHA>
```

Before checking out an older candidate, use the runner from the reviewed published
environment, or keep a separate clean checkout of reviewed develop as the
harness. The two-checkout form is:

```sh
node /path/to/reviewed/harness/ops/cloud-audit/run.mjs --site /path/to/candidate --pr <PR_NUMBER> --candidate <FULL_MERGE_SHA> --production <FULL_PRODUCTION_SHA> --out /path/to/evidence
```

For local runner preparation, `--qualification` exercises the technical
checks against a clean committed task branch. The manually dispatched Actions
workflow also permits `qualify_executor=true` only for the numeric owner acting
on an independently verified owner-authored, owner-merged PR. It preserves the
unexpected-author pause and records the requesting owner; it does not add an
author to the allowlist or accept an arbitrary identity. Its report is labelled
`runner-qualification`; it does not assert an actual expected-author merge or
expected-author Cloud/event acceptance. It must never be used as release evidence.

## Cloud configuration to review

Configure only this GitHub repository. Keep the environment private; no VPN or
outbound cloud identity is needed. Install only reviewed coordinator tooling in
Cloud. Candidate dependency installation, Chromium and its Linux dependencies
belong in the isolated Actions runner. The start instructions are in
`ops/cloud-audit/cloud-start.md`.

Allow the standard package-manager hosts plus `api.github.com` for independent
metadata checks and artifact recovery. Chromium downloads require the official
`cdn.playwright.dev` and `storage.googleapis.com` hosts. Add only hosts actually
needed and tested by setup. A saved allowlist is not proof of task access: verify
GitHub reads and denied unrelated destinations from a **new** task after
publication. Do not disable TLS checks, proxy controls or browser sandboxing.
Prefer the existing GitHub connection. If a separate token is required, keep it
scoped to this repository and its required read/Actions operations, as a network
secret limited to GitHub destinations. Production deploy and application secrets
do not belong in this environment. Security/credential changes in browser UI
require action-time owner confirmation or handoff.

## Activation and qualification gates

1. Review this replacement branch separately from PRs #5/#6. Obtain AGENTS.md's
   approval to push/open its PR into develop, then separate approval to merge.
   Preserve current review/quality and owner-only production rules.
2. Recover authenticated access to the recorded bridge's owning workspace. At
   October 13 the current connector returned project-not-found, and the browser
   listed Risen Code as Deactivated. This is an access/health gap, not proof of
   deletion. Do not recreate it, rotate its subscription encryption key, or fall
   back to another workstream's account. Inspect the exact private project and
   connection/subscription/receipt status before changing it.
3. Publish only reviewed environment configuration through the supported Cloud
   editor. A draft setup was started October 13 from existing develop; its base
   build/lint/unit results do not qualify this replacement candidate. Record the
   published environment identity and tested source revision.
   Its generated local workaround lowers compatibility to May 22, 2026 and
   retains the production database identifier for local emulation. Replace that
   draft with this branch's corrected runtime and synthetic fixture configuration;
   do not publish that workaround as a release-equivalent runner.
4. Connect the recorded private release-coordination plugin to David and subscribe
   to `github.develop.merged`. Configure repository variable `FOTF_EVENTS_URL` and
   private secret `FOTF_EVENTS_SITE_TOKEN` only after authenticated bridge review.
   Never print secret values. At October 13 both fields were absent.
5. Observe an owner-approved actual develop merge waking David. Independently
   verify PR/candidate/identity, signed callback receipt, and the expected pause
   for the owner-authored test. Approval of that particular pause does not add
   an author to the allowlist. Qualify the expected-author path using an actual
   Mitchell contribution; never impersonate his account.
6. Re-run the same completed notification workflow. Confirm stable event ID and
   no second coordination. Test transient failures, expired/stopped subscription,
   closed-unmerged PR and unrelated branch. Local fixtures already cover protocol
   behavior; actual signed provider delivery and David deduplication still need
   live evidence. A failed event path must alert and stay unqualified, without
   a polling fallback. Record how the provider renews the seven-day subscription.
7. From a fresh published Cloud task, verify the exact actual merge, run code /
   security review, and dispatch browser/integration execution through the same
   candidate's artifact workflow. Retain the actual run/artifact IDs, artifact digest and
   candidate. Start another fresh Cloud task, download that exact artifact,
   verify `results.mjs`, independently re-read the merged PR, and recover the
   report without Mac or VM111 access. Hashes prove integrity only relative to
   the manifest; also verify the trusted GitHub run provenance.

Production remains a separate owner-approved develop-to-production PR. Re-read
both branches before proposing it; movement supersedes earlier evidence. First
observe `release-candidate` on a controlled release PR before proposing it as a
required check. Its SHA marker verifies freshness, not audit authenticity.
No automatic production merge/deploy or release authorization is introduced.
