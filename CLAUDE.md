# CLAUDE.md

Operational notes for working in this repo. The user-facing description
lives in `README.md` — read that first.

## Shape

Single-file Express app:

- `server/index.js` — everything: OAuth, cookies, forward-auth, admin API,
  README proxy, static serving. No router split, no middleware modules.
- `public/` — three static pages (`index.html`, `admin.html`) + the
  drop-in `embed.js` + shared `app.js`/`style.css`.
- `db/` is empty in-repo; SQLite lives at `${DATA_DIR}/auth.db` at runtime
  (defaults to `/data` in container, `../data` in dev).

## Adding a tool

Edit the `TOOLS` array near the top of `server/index.js`. Fields:
`id, name, subtitle, primary, admin, repo`. The landing page reads this,
the admin grant UI reads this (via `/api/grants`), and the README proxy
fetches `https://raw.githubusercontent.com/<repo>/main/README.md` and
caches the rendered HTML for 10 minutes.

That's it — no separate registry, no DB seeding.

## Auth model invariants

- Session cookie: `skenmy_sess`, `Domain=.skenmy.com`, HttpOnly, Secure,
  SameSite=Lax, 30d. HMAC-SHA256 over a base64url JSON payload — no JWT
  lib. Changing the cookie name or domain breaks every embed.
- `/auth/verify` is the gate (used by Caddy `forward_auth`).
  `/auth/me` is read-only state for the embed pill — do not gate on it.
- CORS allowlist is a regex (`^https:\/\/[a-z0-9-]+\.skenmy\.com$`).
  Credentials + wildcard is rejected by browsers, so any new origin must
  match that pattern.
- Root admins come from `ROOT_ADMIN_LOGINS` env (comma-separated Twitch
  logins, lowercased). They bypass the grants table everywhere
  (`hasGrant`, `requireRootAdmin`).
- Grants are `(twitch_login, app, role)` with `UNIQUE` on the triple.
  `role` defaults to `admin`; the UI offers `admin|operator|viewer`.

## Deploy

`.github/workflows/ci.yml` on push-to-main:

1. Builds `ghcr.io/skenmy/tools-skenmy` with tags `latest`, `sha-<short>`.
2. `gh workflow run deploy.yml` against the **`skenmy-vps`** repo,
   passing `service=tools-skenmy` and `tag=sha-<short>`.

The actual container reload happens in `skenmy-vps`, not here. Needs
`INFRA_DISPATCH_TOKEN` secret.

## Local dev gotchas

- `npm run dev` uses `node --watch`, no nodemon.
- Without `COOKIE_SECRET`, sessions silently fail (warning at boot).
- Without `TWITCH_CLIENT_ID`/`SECRET`, `/auth/twitch/login` returns 503.
- `better-sqlite3` is native; Dockerfile installs `build-essential` as a
  fallback in case prebuilt binaries are unavailable for the platform.

## Conventions

- ES modules (`"type": "module"`).
- No TS, no bundler, no framework on the client — vanilla JS in `public/`.
- Inline styles in `embed.js` (self-contained, no external CSS deps —
  this is intentional so any subdomain can drop it in).
- Keep edits surgical; this codebase favours single-file readability over
  modularisation.
