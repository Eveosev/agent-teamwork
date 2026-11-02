# agent-teamwork

A deliberately small TypeScript HTTP service used as the end-to-end target for an
AI agent team. It is realistic enough to support issues, pull requests, and CI,
while staying small enough to understand in one sitting.

- **Runtime:** Node.js 22+ (built-in `node:http`, no web framework)
- **Language:** TypeScript, strict mode
- **Package manager:** pnpm 11
- **Tests:** Vitest (Node environment)
- **CI:** GitHub Actions — install, typecheck, test on every push and PR

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Then check it is alive:

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

`.env` is optional; when present, `pnpm dev` and `pnpm start` load it via Node's
`--env-file-if-exists` flag. Environment variables take precedence over the
built-in demo defaults.

## Scripts

| Command           | What it does                                      |
| ----------------- | ------------------------------------------------- |
| `pnpm dev`        | Start the server with `tsx watch` and reload on change |
| `pnpm start`      | Start the server once with `tsx`                  |
| `pnpm typecheck`  | `tsc --noEmit` over `src/`, `tests/`, config      |
| `pnpm test`       | Run the Vitest suite once                         |
| `pnpm test:watch` | Run Vitest in watch mode                          |

Run `pnpm typecheck && pnpm test` before opening a PR; CI runs the same checks.

## API

All responses are JSON. Errors use `{ "error": "<message>" }`.

| Method   | Path             | Auth                     | Success | Description |
| -------- | ---------------- | ------------------------ | ------- | ----------- |
| `GET`    | `/health`        | none                     | `200`   | Liveness probe — `{ status: "ok" }` |
| `POST`   | `/sessions`      | none                     | `201`   | Exchange demo credentials for a session token |
| `GET`    | `/sessions/:id`  | `Authorization: Bearer <id>` | `200` | Return the session if it is still active |
| `DELETE` | `/sessions/:id`  | `Authorization: Bearer <id>` | `204` | Revoke the session |

Login uses the credentials from `DEMO_EMAIL` / `DEMO_PASSWORD`
(`demo@example.com` / `password123` by default). A session's lifetime comes from
`SESSION_TTL` (default `1h`) and is returned as an epoch-milliseconds
`expiresAt`.

```bash
curl -s -X POST http://localhost:3000/sessions \
  -H 'content-type: application/json' \
  -d '{"email":"demo@example.com","password":"password123"}'
# {"token":"<uuid>","userId":"demo@example.com","expiresAt":...}

curl -s http://localhost:3000/sessions/<uuid> \
  -H 'authorization: Bearer <uuid>'
```

Sessions live in memory only; restarting the process clears them. The bearer
token is the session id, which is acceptable for this demo but not a pattern to
copy into production.

## Project layout

```
src/
  app.ts                 HTTP routing, request handling, JSON responses
  server.ts              Process entrypoint, port/TTL env wiring, shutdown
  auth/session.ts        In-memory SessionStore (create, get, revoke, eviction)
  http/validation.ts     Body parsing, credential and bearer-token validation
  utils/time.ts          parseDuration and isExpired helpers
tests/
  app.test.ts            End-to-end HTTP tests against an ephemeral port
  session.test.ts        Session lifecycle and eviction
  validation.test.ts     Request parsing and validation rules
  time.test.ts           Duration parsing and expiry checks (contains skipped bug test)
```

## Known issue #1 — session expiry boundary

`isExpired(expiresAt, now)` documents that a deadline is expired once the
current time **reaches or passes** it, but the implementation uses
`now > expiresAt`. A session therefore survives for one extra instant at
`now === expiresAt`.

The intended behaviour is encoded in a **skipped** test in
`tests/time.test.ts` ("treats the exact deadline instant as expired"). It is
skipped so CI stays green on the seeded repo; the fix is starter issue 1 below.
The bug is intentionally left in place — do not "fix" it while working on
unrelated issues.

## Starter issues

These are seeded for an agent team. Each is scoped to a small, reviewable PR.

### 1. Fix the session expiry boundary

**Files:** `src/utils/time.ts`, `tests/time.test.ts`, `tests/session.test.ts`

`isExpired` returns `false` at exactly `expiresAt`. Treat `now >= expiresAt` as
expired so sessions cannot be used at the boundary instant.

**Acceptance criteria**

- [ ] `isExpired(expiresAt, expiresAt)` returns `true`; before the boundary it still returns `false`.
- [ ] The skipped test in `tests/time.test.ts` is enabled and passes (no test changes beyond removing `.skip`).
- [ ] A `SessionStore` test covers lookup at exactly `expiresAt` (session evicted, returns `undefined`).
- [ ] `pnpm typecheck` and `pnpm test` pass; no other behaviour changes.

### 2. Harden `POST /sessions` request handling

**Files:** `src/http/validation.ts`, `src/app.ts`, `tests/app.test.ts`

The endpoint accepts any content type and only checks the size limit after the
body has been read. Make the contract explicit and covered by tests.

**Acceptance criteria**

- [ ] Requests without `content-type: application/json` return `415`.
- [ ] Bodies larger than 16 KiB return `413` with a JSON error.
- [ ] A missing or empty body returns `400` with a helpful message.
- [ ] Integration tests cover all three cases; existing success/401/400 tests still pass.
- [ ] No new runtime dependencies.

### 3. Add missing tests for expiry cleanup and DELETE auth

**Files:** `tests/app.test.ts`, `tests/session.test.ts`

`DELETE /sessions/:id` only has a happy-path test, and the HTTP layer has no
test for an expired session being evicted.

**Acceptance criteria**

- [ ] A test proves `GET /sessions/:id` returns `404` once the session TTL has elapsed (use an injectable/short TTL, not a long sleep).
- [ ] Tests cover `DELETE` with a missing token (`401`), a token for another session (`403`), and an unknown session (`404`).
- [ ] Tests are deterministic and do not depend on wall-clock timing beyond a few milliseconds.
- [ ] `pnpm test` passes and total suite runtime stays under 5 seconds.

### 4. Extract the router from `src/app.ts`

**Files:** `src/app.ts`, new `src/http/router.ts`, `tests/app.test.ts`

`createApp` currently mixes HTTP routing, body reading, and response helpers.
Split routing into a small table while keeping behaviour identical.

**Acceptance criteria**

- [ ] A `router` module owns method/path matching and dispatches to handlers.
- [ ] `src/app.ts` only wires dependencies, middleware/error handling, and the server.
- [ ] `tests/app.test.ts` passes without changes (no response/status changes).
- [ ] `pnpm typecheck` and `pnpm test` pass; no new dependencies.

### 5. Document the API and error contract

**Files:** `README.md`, new `docs/api.md` (or inline section)

The README shows happy paths but not the full error model or session lifecycle.

**Acceptance criteria**

- [ ] Every endpoint is documented with method, path, auth, request body, status codes, and response shape.
- [ ] All error statuses used by `src/app.ts` (400, 401, 403, 404, 413, 500) are listed with an example body.
- [ ] Session lifecycle (create → use → expire/revoke) is described, including that storage is in-memory.
- [ ] At least one runnable `curl` example per endpoint, verified against a running server.
- [ ] README links to the new document; no code changes.

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and on every pull request:

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck`
3. `pnpm test`

Keep the lockfile committed. The skipped expiry test is intentional and does not
fail CI.

## Contributing

See [AGENTS.md](AGENTS.md) for branch naming, PR expectations, scope rules, and
the commands agents must run before requesting review.
