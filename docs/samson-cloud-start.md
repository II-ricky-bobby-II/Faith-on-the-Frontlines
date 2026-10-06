# Startup instructions for the Faith on the Frontlines Cloud environment

You are working for Blake in his Global Fellowship role. The workstream is
`global_fellowship`. The authoritative development project is on the dedicated
Samson VM at `/srv/faith-on-the-frontlines`; your Cloud filesystem is a separate
workspace. Do not fall back to Blake's Mac or another business workstream.

1. Run `python3 ops/samson/remote.py health`. Require `ready=true`. If VPN, DNS,
   HTTPS or authentication fails, report that failure; do not bypass TLS or
   the configured HTTPS proxy. Never echo the VM token or VPN key.
2. Run `python3 ops/samson/remote.py exec -- git status --short --branch` and
   `python3 ops/samson/remote.py get AGENTS.md`. Follow the repository's current
   instructions. Inspect the VM's Git state before editing. Use an up-to-date
   `develop` base and a new task branch; preserve uncommitted user work.
3. Use remote commands and file transfers for the VM project. Native shell,
   file-edit and Git tools in Cloud operate on Cloud files, not the VM.
   For example, `python3 ops/samson/remote.py exec -- rg --files` runs on the VM.
   For an edit, get the remote file into a Cloud temporary file, retain its
   returned SHA-256, edit the temporary file, then `put` with that expected
   hash. If the hash changed, reread and reconcile; do not overwrite blindly.
4. Use one task at a time in the shared checkout. The API serializes jobs and
   checks file hashes, but does not provide a task-wide editing lock. For
   parallel work, obtain a separate Git worktree and coordinate explicitly.
5. Run remote verification before proposing integration:

   ```sh
   python3 ops/samson/remote.py exec --timeout 900 -- npm test
   python3 ops/samson/remote.py exec --timeout 900 -- npm run lint
   python3 ops/samson/remote.py exec --timeout 900 -- npm run typecheck
   ```

   `npm test` includes the production build. Inspect the final remote diff.
   Push, PR creation, merges and production releases require the approvals in
   AGENTS.md. The VM intentionally has no GitHub write or production deploy
   credential; report missing authorization instead of copying a broader token.
6. Write durable project artifacts on the VM, commit authorized source work,
   and report the actual VM branch and verification results. Keep private
   credentials, raw session archives and generated state out of Git. Remote
   jobs time out after at most 900 seconds and are killed when the service
   restarts; they are not a scheduler for long-lived agents or services.

File round trip example:

```sh
python3 ops/samson/remote.py get README.md --output /tmp/fotf-readme.md
# Retain the returned SHA-256; make the requested edit to the temporary file.
python3 ops/samson/remote.py put README.md /tmp/fotf-readme.md --expected-sha256 <returned-hash>
```
