// tools.skenmy.com — landing page + Twitch OAuth + forward-auth + admin grant store.
//
// Responsibilities:
//   - Serve a landing page listing every tool with quick links + README excerpts.
//   - Twitch OAuth login → signed JWT-like cookie (HMAC over a JSON payload).
//   - /auth/verify endpoint that Caddy `forward_auth` hits to gate admin areas.
//   - Admin UI + API to grant/revoke per-(twitch user, app, role) access.

import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Database from 'better-sqlite3';
import MarkdownIt from 'markdown-it';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS so the embed.js auth pill (served from tools.skenmy.com) can be
// loaded by sibling subdomains and call /auth/me with cookies attached.
// Restrict to *.skenmy.com — credentials with wildcard is rejected by browsers.
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (/^https:\/\/[a-z0-9-]+\.skenmy\.com$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// ─── env / config ────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || 'https://tools.skenmy.com';
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';
const COOKIE_SECRET = process.env.COOKIE_SECRET || '';
const ROOT_ADMIN_LOGINS = (process.env.ROOT_ADMIN_LOGINS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const COOKIE_NAME = 'skenmy_sess';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

fs.mkdirSync(DATA_DIR, { recursive: true });

if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) console.warn('[auth] Twitch OAuth disabled — set TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET');
if (!COOKIE_SECRET) console.warn('[auth] COOKIE_SECRET not set — sessions cannot be issued or verified');
if (!ROOT_ADMIN_LOGINS.length) console.warn('[auth] ROOT_ADMIN_LOGINS empty — no one can manage grants');

// ─── catalogue: edit here to register a new tool ─────────────────
// The catalogue the landing page renders.
//
// DUPLICATED in public/app.js, which renders the same cards client-side.
// The two must stay in step; there is no check that they do. If you edit
// one, edit the other in the same commit.
//
// `public: true` renders the card for anonymous visitors. Anything on
// *.ts.skenmy.com resolves only to a private tailnet address, so those
// are `false` and say "(tailnet only)" in the subtitle — an anonymous
// visitor being shown a link they cannot possibly load is worse than not
// showing it.
const TOOLS = [
  // ── Apps ──
  { id: 'skenos', name: 'skenOS', subtitle: 'The desktop-OS portfolio at the apex, and DAEMON', primary: 'https://skenmy.com', admin: null, repo: 'skenmy/skenos', public: true },
  { id: 'daemon', name: 'DAEMON', subtitle: 'Bullet-hell terminal game with a server-verified leaderboard', primary: 'https://daemon.skenmy.com', admin: null, repo: 'skenmy/skenos', public: true },
  { id: 'notes', name: 'Notes', subtitle: 'Obsidian vault, rendered on the box and served as static pages', primary: 'https://skenmy.com/notes/', admin: null, repo: 'skenmy/notes', public: true },
  { id: 'gist', name: 'Opengist', subtitle: 'Code snippets — public to read, sign-in to write', primary: 'https://gist.skenmy.com', admin: null, repo: null, public: true },
  { id: 'zipline', name: 'Zipline', subtitle: 'File and screenshot host that mints short links', primary: 'https://z.skenmy.com', admin: null, repo: null, public: false },
  { id: 'ntfy', name: 'ntfy', subtitle: 'Push notifications — every alert on the box lands here', primary: 'https://ntfy.skenmy.com', admin: null, repo: null, public: true },
  { id: 'atuin', name: 'Atuin', subtitle: 'Encrypted shell-history sync; only ciphertext is stored', primary: 'https://atuin.skenmy.com', admin: null, repo: null, public: false },

  // ── Marathon tooling ──
  { id: 'schedule', name: 'Schedule Helper', subtitle: 'Marathon schedule tracker (Oengus / Horaro) with operator sync', primary: 'https://schedule.skenmy.com', admin: null, repo: 'skenmy/schedule-helper', public: true },
  { id: 'lowerthird', name: 'ESA Lower Third', subtitle: 'OBS overlay + control for ESA marathon streams', primary: 'https://lowerthird.skenmy.com/source.html', admin: 'https://lowerthird.skenmy.com/control.html', repo: 'skenmy/esalowerthird', public: true },
  { id: 'esaquiz', name: 'ESA Quiz', subtitle: 'Quiz overlay + control panel', primary: 'https://esaquiz.skenmy.com/source.html', admin: 'https://esaquiz.skenmy.com/control.html', repo: 'skenmy/esaquiz', public: true },
  { id: 'blockbuster', name: 'Blockbusters', subtitle: 'Blockbusters game-show clone with multiplayer rooms', primary: 'https://blockbuster.skenmy.com/display', admin: 'https://blockbuster.skenmy.com/control', repo: 'skenmy/blockbusters-game-challenges', public: true },

  // ── Personal ──
  { id: 'fares', name: 'Fares Tracker', subtitle: 'Daily fare scrape for the Birmingham–Stafford commute', primary: 'https://fares.skenmy.com', admin: null, repo: 'skenmy/fares-tracker', public: false },
  { id: 'rss', name: 'Miniflux', subtitle: 'RSS reader (tailnet only)', primary: 'https://rss.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'links', name: 'Linkding', subtitle: 'Bookmarks (tailnet only)', primary: 'https://links.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'watch', name: 'changedetection', subtitle: 'Watches pages for changes and pings ntfy (tailnet only)', primary: 'https://watch.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'ittools', name: 'IT-Tools', subtitle: 'Offline dev utility belt (tailnet only)', primary: 'https://tools.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'glance', name: 'Glance', subtitle: 'Dashboard, configured from the infra repo (tailnet only)', primary: 'https://home.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'code', name: 'code-server', subtitle: 'VS Code in the browser (tailnet only)', primary: 'https://code.ts.skenmy.com', admin: null, repo: null, public: false },

  // ── Running the box ──
  { id: 'url-shortener', name: 'URL Shortener', subtitle: 'skenmy.com slug shortener with per-link stats', primary: 'https://skenmy.com/admin', admin: null, repo: 'skenmy/url-shortener', public: false },
  { id: 'status', name: 'Status', subtitle: 'Public status page — Gatus, with checks declared in the infra repo', primary: 'https://status.skenmy.com', admin: null, repo: 'skenmy/skenmy-vps', public: true },
  { id: 'grafana', name: 'Grafana', subtitle: 'Metrics, dashboards and alert rules (tailnet only)', primary: 'https://grafana.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'logs', name: 'VictoriaLogs', subtitle: 'Searchable container logs, 30 days (tailnet only)', primary: 'https://logs.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'dozzle', name: 'Dozzle', subtitle: 'Live container log tail (tailnet only)', primary: 'https://dozzle.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'healthchecks', name: 'Healthchecks', subtitle: 'Dead-man\'s switch for backups and CI (tailnet only)', primary: 'https://healthchecks.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'git', name: 'Forgejo', subtitle: 'Local git mirror, so a GitHub outage can\'t stop a deploy (tailnet only)', primary: 'https://git.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'analytics', name: 'Umami', subtitle: 'Privacy-friendly web analytics', primary: 'https://analytics.skenmy.com', admin: null, repo: null, public: false },
  { id: 'infra', name: 'skenmy-vps', subtitle: 'The infrastructure repo — compose, Caddy, host state, backups', primary: 'https://github.com/skenmy/skenmy-vps', admin: null, repo: 'skenmy/skenmy-vps', public: false },
];

// ─── db (per-tool grants) ────────────────────────────────────────
const db = new Database(path.join(DATA_DIR, 'auth.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS grants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    twitch_login TEXT NOT NULL,
    twitch_id    TEXT,
    app          TEXT NOT NULL,
    role         TEXT NOT NULL,
    granted_by   TEXT NOT NULL,
    granted_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(twitch_login, app, role)
  );
  CREATE INDEX IF NOT EXISTS grants_lookup ON grants(twitch_login, app);
`);

// ─── tiny cookie + HMAC helpers (no JWT lib needed) ──────────────
function sign(payload) {
  if (!COOKIE_SECRET) throw new Error('COOKIE_SECRET not set');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', COOKIE_SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}
function verify(token) {
  if (!token || !COOKIE_SECRET) return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const body = token.slice(0, dot), mac = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', COOKIE_SECRET).update(body).digest('base64url');
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (p.exp && Date.now() / 1000 > p.exp) return null;
    return p;
  } catch { return null; }
}
function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}
function setSessionCookie(res, payload) {
  const token = sign(payload);
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Domain=.skenmy.com; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
  ]);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=; Domain=.skenmy.com; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
  ]);
}

function currentUser(req) {
  return verify(readCookie(req, COOKIE_NAME));
}
function isRootAdmin(user) {
  return !!(user && ROOT_ADMIN_LOGINS.includes((user.login || '').toLowerCase()));
}
function hasGrant(user, app, role = 'admin') {
  if (!user || !user.login) return false;
  if (isRootAdmin(user)) return true;
  const login = user.login.toLowerCase();
  const row = db.prepare('SELECT 1 FROM grants WHERE LOWER(twitch_login)=? AND app=? AND role=? LIMIT 1').get(login, app, role);
  return !!row;
}

// ─── OAuth: Twitch ───────────────────────────────────────────────
const TWITCH_AUTH = 'https://id.twitch.tv/oauth2/authorize';
const TWITCH_TOKEN = 'https://id.twitch.tv/oauth2/token';
const TWITCH_USERS = 'https://api.twitch.tv/helix/users';

function randomState() { return crypto.randomBytes(16).toString('hex'); }
const pendingStates = new Map(); // state → { redirect, createdAt }
setInterval(() => { const now = Date.now(); for (const [k, v] of pendingStates) if (now - v.createdAt > 10 * 60 * 1000) pendingStates.delete(k); }, 60_000).unref();

app.get('/auth/twitch/login', (req, res) => {
  if (!TWITCH_CLIENT_ID) return res.status(503).send('Twitch OAuth not configured');
  const redirect = String(req.query.redirect || '/');
  const state = randomState();
  pendingStates.set(state, { redirect, createdAt: Date.now() });
  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    redirect_uri: `${PUBLIC_ORIGIN}/auth/twitch/callback`,
    response_type: 'code',
    scope: 'user:read:email',
    state,
  });
  res.redirect(`${TWITCH_AUTH}?${params}`);
});

app.get('/auth/twitch/callback', async (req, res) => {
  const { code, state } = req.query;
  const pending = state && pendingStates.get(state);
  if (!code || !pending) return res.status(400).send('Bad OAuth state');
  pendingStates.delete(state);
  try {
    const body = new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${PUBLIC_ORIGIN}/auth/twitch/callback`,
    });
    const tokenRes = await fetch(TWITCH_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!tokenRes.ok) throw new Error(`token exchange ${tokenRes.status}`);
    const tok = await tokenRes.json();
    const userRes = await fetch(TWITCH_USERS, { headers: { Authorization: `Bearer ${tok.access_token}`, 'Client-Id': TWITCH_CLIENT_ID } });
    if (!userRes.ok) throw new Error(`/helix/users ${userRes.status}`);
    const user = (await userRes.json()).data?.[0];
    if (!user) throw new Error('no user returned from Twitch');
    const payload = {
      sub: user.id,
      login: user.login,
      display: user.display_name,
      avatar: user.profile_image_url,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE,
    };
    setSessionCookie(res, payload);
    res.redirect(pending.redirect || '/');
  } catch (e) {
    console.error('[auth] callback failed:', e.message);
    res.status(500).send('Login failed: ' + e.message);
  }
});

app.post('/auth/logout', (req, res) => { clearSessionCookie(res); res.redirect('/'); });
app.get('/auth/me', (req, res) => {
  const u = currentUser(req);
  const app_ = String(req.query.app || '');
  const role = String(req.query.role || 'admin');
  if (!u) return res.json({ authenticated: false, canWrite: false, app: app_ || null, role });
  const canWrite = !!app_ && (isRootAdmin(u) || hasGrant(u, app_, role));
  res.json({
    authenticated: true,
    user: { login: u.login, display: u.display, avatar: u.avatar },
    root: isRootAdmin(u),
    canWrite,
    app: app_ || null,
    role,
  });
});

// Forward-auth endpoint for Caddy `forward_auth tools-skenmy:3000 { uri /auth/verify?app=<id> }`
app.get('/auth/verify', (req, res) => {
  const app_ = String(req.query.app || '');
  const role = String(req.query.role || 'admin');
  const u = currentUser(req);
  if (!u) {
    res.setHeader('X-Auth-Login-Url', `${PUBLIC_ORIGIN}/auth/twitch/login?redirect=${encodeURIComponent(req.headers['x-original-url'] || '/')}`);
    return res.status(401).end();
  }
  if (!hasGrant(u, app_, role)) return res.status(403).end();
  res.setHeader('X-Forwarded-User', u.login);
  res.setHeader('X-Forwarded-User-Display', u.display || u.login);
  res.status(200).end();
});

// ─── admin API ──────────────────────────────────────────────────
function requireRootAdmin(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'login required' });
  if (!isRootAdmin(u)) return res.status(403).json({ error: 'root admin only' });
  req.user = u;
  next();
}
app.get('/api/grants', requireRootAdmin, (req, res) => {
  const rows = db.prepare('SELECT id, twitch_login, app, role, granted_by, granted_at FROM grants ORDER BY app, twitch_login').all();
  res.json({ grants: rows, tools: TOOLS.map(t => ({ id: t.id, name: t.name })) });
});
app.post('/api/grants', requireRootAdmin, (req, res) => {
  const { twitch_login, app, role = 'admin' } = req.body || {};
  if (!twitch_login || !app) return res.status(400).json({ error: 'twitch_login + app required' });
  try {
    db.prepare('INSERT OR IGNORE INTO grants (twitch_login, app, role, granted_by) VALUES (?, ?, ?, ?)').run(twitch_login.toLowerCase(), app, role, req.user.login);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/grants/:id', requireRootAdmin, (req, res) => {
  db.prepare('DELETE FROM grants WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ─── README endpoint (proxy GitHub raw) ──────────────────────────
const READMES = {}; // id → { html, fetchedAt }
const md = new MarkdownIt({ html: false, linkify: true, breaks: false });
async function readmeFor(tool) {
  if (!tool.repo) return null;
  const cached = READMES[tool.id];
  if (cached && (Date.now() - cached.fetchedAt) < 10 * 60 * 1000) return cached;
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${tool.repo}/main/README.md`);
    if (!r.ok) throw new Error(`gh raw ${r.status}`);
    const text = await r.text();
    const html = md.render(text);
    READMES[tool.id] = { html, fetchedAt: Date.now() };
    return READMES[tool.id];
  } catch (e) { return { html: `<p class="dim">README unavailable: ${e.message}</p>`, fetchedAt: Date.now() }; }
}
app.get('/api/readme/:id', async (req, res) => {
  const tool = TOOLS.find(t => t.id === req.params.id);
  if (!tool) return res.status(404).json({ error: 'unknown tool' });
  const r = await readmeFor(tool);
  res.json({ id: tool.id, name: tool.name, repo: tool.repo, html: r?.html || '' });
});

// ─── pages ──────────────────────────────────────────────────────
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));
app.get('/healthz', (req, res) => res.send('ok'));

app.listen(PORT, () => {
  console.log(`[tools-skenmy] listening on ${PORT}`);
  if (TWITCH_CLIENT_ID) console.log(`[auth] Twitch OAuth enabled · root admins: ${ROOT_ADMIN_LOGINS.join(', ') || '(none)'}`);
});
