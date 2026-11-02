# AGENTS.md

Repository conventions for human and AI contributors. Read this before making
changes.

## Purpose

This repo is a small, intentionally imperfect TypeScript service used to
exercise an AI agent team end to end: issue → branch → PR → CI → review. Keep
changes small, reviewable, and covered by tests.

## Toolchain

- **Node.js 22+** (CI uses Node 22)
- **pnpm 11** — do not use npm or yarn; do not commit `package-lock.json` or `yarn.lock`
- Install with `pnpm install` (`--frozen-lockfile` in CI)
- The lockfile (`pnpm-lock.yaml`) is committed; update it only when dependencies actually change
- ESLint/Prettier are not configured; match the existing style (2-space indent, double quotes, semicolons, `import type` for type-only imports)

## Required commands

Run these from the repo root before opening or updating a PR:

```bash
pnpm typecheck
pnpm test
```

Both must pass. The one deliberately skipped test in `tests/time.test.ts`
documents known issue #1; do not delete it or the issue. Only enable it as part
of fixing that issue.

## Branching and commits

- Branch from `main` using `agent/<ticket>-<slug>`, e.g. `agent/12-fix-session-expiry`.
- One issue per branch/PR. Keep diffs scoped to the ticket.
- Do not commit directly to `main`.
- Commit messages: imperative, prefixed, e.g. `fix(session): treat expiry boundary as expired`.
- Rebase or merge `main` as needed; never force-push shared branches.

## Pull requests

- Every change lands via a pull request; `main` is protected by convention and CI.
- PR description must include: linked issue (`Closes #<n>`), summary, test plan, and any follow-ups.
- CI must be green (`typecheck` and `test`) before review.
- A PR is complete only when acceptance criteria in the linked issue are all met.
- Do not mix refactors, formatting churn, and behaviour changes in one PR.

## Scope and safety

- Keep changes scoped to the ticket; open a follow-up issue instead of drive-by fixes.
- Do not add runtime dependencies without a clear justification in the PR; prefer Node built-ins.
- **Never commit secrets or credentials.** Do not create, read, or modify CI
  secrets, environment secrets, or repository settings; do not echo `.env`
  contents. `.env.example` contains demo-only values and is safe to edit.
- Do not edit `.github/workflows/ci.yml` unless the ticket explicitly asks for it.
- Do not weaken tests (`.skip`, `.todo`, deleting assertions) to make CI pass.
- Do not change public HTTP behaviour without updating README, tests, and the issue.
- Generated files (`node_modules/`, `dist/`, `coverage/`, `.env`) must stay untracked.

## Code conventions for this repo

- HTTP layer uses the Node built-in `node:http`; no framework.
- Validation failures throw `ValidationError` with the HTTP status to return.
- Keep route handlers thin; business logic belongs in `src/auth/` or `src/utils/`.
- New behaviour needs a test in `tests/`; bug fixes need a regression test.
- TypeScript is strict with `noUncheckedIndexedAccess`; avoid `any` and non-null assertions unless unavoidable.
- Prefer deterministic tests (inject `now`/TTL) over sleeps.
