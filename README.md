# tools.skenmy.com

Landing page + Twitch-OAuth forward-auth gateway for the apps I run on
`skenmy.com`. Two surfaces:

1. **`/`** — a card grid of every tool with quick links to the public
   surface, the admin/operator surface, and an inline README viewer
   (fetched live from each repo's `README.md`).
2. **`/auth/verify`** — a [forward_auth](https://caddyserver.com/docs/caddyfile/directives/forward_auth)
   endpoint Caddy calls to gate the admin URLs of other subdomains.
   The cookie is shared on `.skenmy.com`, so signing in once works
   everywhere.

The auth model is intentionally tiny:

- Sign in with Twitch (OAuth code flow, single `user:read:email` scope).
- A signed cookie (HMAC over a JSON payload) holds your Twitch login
  + display name + avatar for 30 days.
- Root admins (`ROOT_ADMIN_LOGINS` env var, comma-separated Twitch logins)
  manage the grants table at `/admin`.
- Each grant is `(twitch_login, app, role)`; the calling Caddy fragment
  passes the `app=` query param, and `/auth/verify` returns 200/401/403.

## Env

```
PORT=3000
PUBLIC_ORIGIN=https://tools.skenmy.com
COOKIE_SECRET=<openssl rand -hex 32>
TWITCH_CLIENT_ID=<from https://dev.twitch.tv/console/apps>
TWITCH_CLIENT_SECRET=
ROOT_ADMIN_LOGINS=skenmy
DATA_DIR=/data   # SQLite grants db lives here
```

Set the Twitch app's OAuth redirect to `${PUBLIC_ORIGIN}/auth/twitch/callback`.

## Wiring another app's admin behind this gate

In that app's Caddy fragment in `skenmy-vps/conf.d/`:

```caddy
example.skenmy.com {
    @admin path /admin /admin/*
    handle @admin {
        forward_auth tools-skenmy:3000 {
            uri /auth/verify?app=example&role=admin
            copy_headers X-Forwarded-User X-Forwarded-User-Display
        }
    }
    reverse_proxy example:3000 { ... }
}
```

Unauthenticated requests get a 401 with `X-Auth-Login-Url` pointing back
at `tools.skenmy.com`'s Twitch login; the front-end can redirect.

## Deploy

This repo follows the standard pattern: CI builds and pushes
`ghcr.io/skenmy/tools-skenmy:latest`, then dispatches the
`skenmy-vps` deploy workflow which pins the new tag and reloads
the container.
