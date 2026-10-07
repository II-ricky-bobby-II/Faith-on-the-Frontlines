# Faith on the Frontlines develop events

Private MCP 2.0 event plugin and direct GitHub Actions sender. Every PR merged
into `develop` generates `github.develop.merged`, regardless of author. Opened
PRs and closed-but-unmerged PRs do not wake David. There is no scheduled GitHub
polling and no notification hop through Samson.

## Delivery and coordination

1. David subscribes through this Site's private plugin. ChatGPT supplies the
   callback URL and signing secret. The bridge verifies the signed callback
   challenge and encrypts persistent subscription credentials in D1.
2. The trusted `pull_request_target: closed` workflow checks out its base
   commit, never the contributor's head. It authenticates to the bridge with
   GitHub OIDC, scoped to this repository, this workflow, and `develop`.
3. The Action requests the active subscriptions, signs the event with Standard
   Webhooks, and sends it **directly** to ChatGPT's callback. A private Sites
   service credential admits the Action through Sites' hosting boundary; it
   does not give the Action a user identity or authorize arbitrary MCP calls.
4. A stable merge event ID survives retries. A successful receipt is recorded
   and skipped on reruns. Delivery retries are bounded, and a `410` deactivates
   the subscription. A missing subscription or failed delivery fails the
   workflow visibly; it is never reported as success.
5. David independently reads the PR from GitHub, not just the event claims,
   then follows `release_policy`. A received webhook is not a release approval.

The worker restricts callback hosts to ChatGPT/OpenAI provider domains and
checks public DNS during verification. The Node Action checks DNS again for
each event attempt and pins its HTTPS connection to the validated address,
preserving certificate verification and SNI. Redirects are rejected. Delivery
keys are never returned by user-facing tools or included in logs.

## Current GitHub workflow

Mitchell contributes through reviewed feature PRs into `develop`. Existing
`quality.yml` runs lint/build/tests for integration and release PRs, plus pushes
to `develop`. Releases use a separate `develop` → `production` PR. Only the
repository owner `II-ricky-bobby-II` may merge the release, and the production
push then starts the existing Cloudflare deployment.

PR #5 (`chore/samson-vm-cloud`) remains open as of 2026-10-07. Its Linux runtime
and generated Cloudflare type corrections are prerequisites for normal
verification on Samson. This notification work lives on an isolated worktree
and does not change that pending migration or the live website.

## Activation

Bridge Site: https://fotf-develop-events.risencode.chatgpt.site

1. Publish this isolated Site with logical D1 binding `DB` and capability `mcp`.
   Configure runtime secret `SUBSCRIPTION_KEY` as a random 32-byte base64 AES key;
   configure `ACTION_AUDIENCE` to the exact HTTPS Site origin. Do not rotate the
   encryption key without migrating stored encrypted subscriptions.
2. Install/connect its provisioned private plugin through ChatGPT, and make it
   available to David. Ask David to read `release_policy`, then use the
   instructions in `docs/david-instructions.md` to subscribe. This chat cannot
   silently modify David's profile or assume that he has subscribed.
3. After the repository's required push/PR approval, copy
   `github/notify-develop-merge.yml` to `.github/workflows/notify-develop-merge.yml`
   and `github/release-candidate.yml` to `.github/workflows/release-candidate.yml`,
   and this source to `ops/develop-events`. Review and merge the setup PR into
   `develop`. The trusted workflow and sender must exist on the base branch.
4. Set repository variable `FOTF_EVENTS_URL` to the Site origin. Set repository
   secret `FOTF_EVENTS_SITE_TOKEN` to the private Site's service-access token
   through a private settings form; never put it in source, chat, an issue,
   or a command line. The bridge also verifies GitHub OIDC, so that hosting
   credential alone cannot retrieve subscription secrets.
5. Add `release-candidate` to the required production branch checks, preserving
   the existing quality/review and owner-only merge rules. A release PR must
   contain exactly one line `Verified develop commit: ` followed by the full
   tested SHA enclosed in backticks. This check verifies freshness, not audit
   authenticity. Owner review still confirms the attached evidence. Have it
   run on a release PR before requiring its check name in branch protection.
6. Verify the installation with a controlled, owner-approved test merge.
   Confirm its GitHub Action succeeds, the bridge records the receipt, David
   receives the actual event, and the owner-authored test correctly follows
   the unexpected-author pause path. Approve that known test explicitly before
   proceeding. Then verify an expected-author event from Mitchell.
7. Test duplicate workflow execution, stopped/expired subscriptions, unrelated
   branches, and closed-but-unmerged PRs. No release or live production writes
   are part of activation.

## David's verification task

The policy includes the exact account IDs, verification steps, permission
gates, and Samson capability description. It treats a Codex agent using
Mitchell's `mitchell-FOF` account as Mitchell. A separate bot identity is
**not** automatically trusted. Its exact login and immutable ID must first be
confirmed and explicitly approved. `github-actions[bot]`, a Codex label, or a
commit coauthor line alone does not establish an approved PR author.

Each cloud task audits the immutable merge SHA and the full unreleased diff
since production. A changed `develop` head supersedes earlier release evidence.
Repairs go through a separate PR into `develop`; the release PR retains
`develop` as its source. Blake's production approval is always separate.

## Local verification

```sh
npm ci --ignore-scripts
npm run db:generate # only when schema changes
npm run check
npm test
npm run build
```

Tests use the generated SQL in an in-memory SQLite database, real RSA and HMAC
verification, isolated callback fixtures, and bounded delivery retries. They
do not imply a live subscription, GitHub repository secret, Cloud task, or
production deployment has been activated.

Native Sites setup/publishing helpers are absent from the selected Cloud
executor. This package has a direct Worker build and reproducible archive
layout, preserving source-to-build identity for native publication.

References: [MCP Events](https://developers.openai.com/plugins/build/mcp-events),
[GitHub OIDC](https://docs.github.com/en/actions/concepts/security/openid-connect),
[dots cloud threads](https://learn.chatgpt.com/docs/dots/computers-and-apps).
