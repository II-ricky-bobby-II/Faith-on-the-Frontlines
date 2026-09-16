# Codex development workflow

This project uses `develop` as the integration branch and `production` as the release branch.

## Starting work

Before editing a Git checkout:

1. Identify the repository root, current branch, remotes, and worktree status.
2. Treat any uncommitted or untracked work as user-owned. If the worktree is dirty, stop and ask before switching branches or changing unrelated files.
3. Fetch `origin/develop` and fast-forward local `develop` only when it is safe to do so. Never reset, clean, force-push, merge, or rebase automatically.
4. Create a new branch from the up-to-date `develop` branch for each task. Use a descriptive prefix such as `feat/`, `fix/`, `docs/`, `chore/`, or `refactor/`.
5. Never begin feature work directly on `develop` or `production`.

If there is no Git checkout, `origin` remote, or `origin/develop` ref, report that clearly and continue only with the work that is safe in the current environment.

## Commits and verification

- Keep commits small, focused, and independently understandable.
- Prefer Conventional Commit-style messages such as `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, and `chore:`.
- Do not commit secrets, credentials, `.env` files, generated credentials, or the Cloudflare deploy token.
- Run the relevant tests, lint, type checks, and build before proposing integration. Report what ran and any limitations.
- Review the final diff and confirm that unrelated user changes were preserved.

## Completion and merge handoff

When a task or feature appears complete, do not silently merge it. First summarize the change, verification results, current branch, and remaining risks, then ask:

> This change appears ready. Would you like me to push `<branch>` and open a pull request into `develop`?

Only push the branch and open the pull request after the user explicitly agrees. The pull request should target `develop`, include a concise summary and testing notes, and request review when appropriate.

After the pull request is open and required checks/reviews are complete, ask again before merging:

> Pull request #<number> is ready to merge into `develop`. Would you like me to merge it?

Never push directly to `develop` or `production`, merge without explicit approval, or force-push. Leave branches in place unless the user separately asks to delete them.

## Release flow

Merging into `develop` is the normal integration step. Promoting `develop` to `production` is a separate release decision and requires an explicit user request and pull request. Do not modify `CLOUDFLARE_API_TOKEN` as part of this workflow.
