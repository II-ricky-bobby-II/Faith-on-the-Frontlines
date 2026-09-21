# Contributing

## Branches

- `develop` is the default integration branch.
- `production` is the protected release branch.
- Start each task from an up-to-date `develop` branch and create a short-lived branch named `feat/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>`, or `refactor/<name>`.
- Do not commit directly to `develop` or `production`.

## Commits

Make focused commits that tell the story of one logical change. Conventional Commit prefixes are encouraged (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`). Never commit secrets or local `.env` files.

## Pull requests

Open pull requests from the task branch into `develop`. Include:

- what changed and why;
- tests, lint, type checks, or build commands that were run;
- screenshots or deployment notes when the change affects the website UI or hosting;
- any follow-up work or known limitations.

Wait for the required `quality` check and review before merging. A release into
`production` must be a separate pull request from `develop`. Only the repository
owner, `II-ricky-bobby-II`, may merge that release pull request.

## Cleanup

After a merge, delete the local or remote task branch only when the owner explicitly asks for cleanup.
