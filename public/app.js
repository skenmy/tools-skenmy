// Tools landing page client
// Mirror of the TOOLS array in server/index.js — keep both in step.
const TOOLS = [
  // ── Apps ──
  { id: 'skenos', name: 'skenOS', subtitle: 'The desktop-OS portfolio at the apex, and DAEMON.', primary: 'https://skenmy.com', admin: null, repo: 'skenmy/skenos', public: true },
  { id: 'daemon', name: 'DAEMON', subtitle: 'Bullet-hell terminal game with a server-verified leaderboard.', primary: 'https://daemon.skenmy.com', admin: null, repo: 'skenmy/skenos', public: true },
  { id: 'notes', name: 'Notes', subtitle: 'Obsidian vault, rendered on the box and served as static pages.', primary: 'https://skenmy.com/notes/', admin: null, repo: 'skenmy/notes', public: true },
  { id: 'gist', name: 'Opengist', subtitle: 'Code snippets — public to read, sign-in to write.', primary: 'https://gist.skenmy.com', admin: null, repo: null, public: true },
  { id: 'zipline', name: 'Zipline', subtitle: 'File and screenshot host that mints short links.', primary: 'https://z.skenmy.com', admin: null, repo: null, public: false },
  { id: 'ntfy', name: 'ntfy', subtitle: 'Push notifications — every alert on the box lands here.', primary: 'https://ntfy.skenmy.com', admin: null, repo: null, public: true },
  { id: 'atuin', name: 'Atuin', subtitle: 'Encrypted shell-history sync; only ciphertext is stored.', primary: 'https://atuin.skenmy.com', admin: null, repo: null, public: false },

  // ── Marathon tooling ──
  { id: 'schedule', name: 'Schedule Helper', subtitle: 'Marathon schedule tracker (Oengus / Horaro) with operator sync.', primary: 'https://schedule.skenmy.com', admin: null, repo: 'skenmy/schedule-helper', public: true },
  { id: 'lowerthird', name: 'ESA Lower Third', subtitle: 'OBS overlay + control for ESA marathon streams.', primary: 'https://lowerthird.skenmy.com/source.html', admin: 'https://lowerthird.skenmy.com/control.html', repo: 'skenmy/esalowerthird', public: true },
  { id: 'esaquiz', name: 'ESA Quiz', subtitle: 'Quiz overlay + control panel.', primary: 'https://esaquiz.skenmy.com/source.html', admin: 'https://esaquiz.skenmy.com/control.html', repo: 'skenmy/esaquiz', public: true },
  { id: 'blockbuster', name: 'Blockbusters', subtitle: 'Blockbusters game-show clone with multiplayer rooms.', primary: 'https://blockbuster.skenmy.com/display', admin: 'https://blockbuster.skenmy.com/control', repo: 'skenmy/blockbusters-game-challenges', public: true },

  // ── Personal ──
  { id: 'fares', name: 'Fares Tracker', subtitle: 'Daily fare scrape for the Birmingham–Stafford commute.', primary: 'https://fares.skenmy.com', admin: null, repo: 'skenmy/fares-tracker', public: false },
  { id: 'rss', name: 'Miniflux', subtitle: 'RSS reader (tailnet only).', primary: 'https://rss.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'links', name: 'Linkding', subtitle: 'Bookmarks (tailnet only).', primary: 'https://links.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'watch', name: 'changedetection', subtitle: 'Watches pages for changes and pings ntfy (tailnet only).', primary: 'https://watch.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'ittools', name: 'IT-Tools', subtitle: 'Offline dev utility belt (tailnet only).', primary: 'https://tools.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'glance', name: 'Glance', subtitle: 'Dashboard, configured from the infra repo (tailnet only).', primary: 'https://home.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'code', name: 'code-server', subtitle: 'VS Code in the browser (tailnet only).', primary: 'https://code.ts.skenmy.com', admin: null, repo: null, public: false },

  // ── Running the box ──
  { id: 'url-shortener', name: 'URL Shortener', subtitle: 'skenmy.com slug shortener with per-link stats.', primary: 'https://skenmy.com/admin', admin: null, repo: 'skenmy/url-shortener', public: false },
  { id: 'status', name: 'Status', subtitle: 'Public status page — Gatus, with checks declared in the infra repo.', primary: 'https://status.skenmy.com', admin: null, repo: 'skenmy/skenmy-vps', public: true },
  { id: 'grafana', name: 'Grafana', subtitle: 'Metrics, dashboards and alert rules (tailnet only).', primary: 'https://grafana.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'logs', name: 'VictoriaLogs', subtitle: 'Searchable container logs, 30 days (tailnet only).', primary: 'https://logs.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'dozzle', name: 'Dozzle', subtitle: 'Live container log tail (tailnet only).', primary: 'https://dozzle.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'healthchecks', name: 'Healthchecks', subtitle: 'Dead-man\'s switch for backups and CI (tailnet only).', primary: 'https://healthchecks.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'git', name: 'Forgejo', subtitle: 'Local git mirror, so a GitHub outage can\'t stop a deploy (tailnet only).', primary: 'https://git.ts.skenmy.com', admin: null, repo: null, public: false },
  { id: 'analytics', name: 'Umami', subtitle: 'Privacy-friendly web analytics.', primary: 'https://analytics.skenmy.com', admin: null, repo: null, public: false },
  { id: 'infra', name: 'skenmy-vps', subtitle: 'The infrastructure repo — compose, Caddy, host state, backups.', primary: 'https://github.com/skenmy/skenmy-vps', admin: null, repo: 'skenmy/skenmy-vps', public: false },
];

const cardsEl = document.getElementById('cards');
const readme = document.getElementById('readme');
const readmeTitle = document.getElementById('readme-title');
const readmeBody = document.getElementById('readme-body');

function renderCards(showAll) {
  const visible = showAll ? TOOLS : TOOLS.filter(t => t.public);
  cardsEl.innerHTML = visible.map(t => `
    <div class="card" data-id="${t.id}">
      <div class="pill">${t.id}</div>
      <h3>${t.name}</h3>
      <div class="subtitle">${t.subtitle}</div>
      <div class="actions">
        <a class="btn go" href="${t.primary}" target="_blank" rel="noopener">Open →</a>
        ${t.admin ? `<a class="btn" href="${t.admin}" target="_blank" rel="noopener">Admin</a>` : ''}
        ${t.repo ? `<button class="btn ghost" data-readme="${t.id}">README</button>` : ''}
        ${t.repo ? `<a class="btn ghost" href="https://github.com/${t.repo}" target="_blank" rel="noopener">GitHub ↗</a>` : ''}
      </div>
    </div>
  `).join('');
}

cardsEl.addEventListener('click', async e => {
  const btn = e.target.closest('[data-readme]');
  if (!btn) return;
  const id = btn.dataset.readme;
  const tool = TOOLS.find(t => t.id === id);
  if (!tool) return;
  readmeTitle.textContent = `${tool.name} · README`;
  readmeBody.innerHTML = '<p class="dim">Loading…</p>';
  readme.classList.remove('hidden');
  readme.scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    const r = await fetch(`/api/readme/${id}`);
    const data = await r.json();
    readmeBody.innerHTML = data.html || '<p class="dim">No README found.</p>';
  } catch (err) {
    readmeBody.innerHTML = `<p class="dim">Failed: ${err.message}</p>`;
  }
});
document.getElementById('readme-close').addEventListener('click', () => readme.classList.add('hidden'));

// Resolve auth state first so we can render the full deck for signed-in users
// and only the public subset for everyone else.
(async () => {
  let authenticated = false;
  try {
    const r = await fetch('/auth/me');
    const data = await r.json();
    authenticated = !!data.authenticated;
    if (authenticated) {
      const u = data.user;
      document.getElementById('user').innerHTML = `
        <span style="display:flex;align-items:center;gap:10px;">
          ${u.avatar ? `<img class="avatar" src="${u.avatar}" alt="">` : ''}
          <span style="font-size:14px"><b>${u.display || u.login}</b>${data.root ? ' <span class="pill" style="display:inline-block;margin-left:6px;color:var(--warn)">root</span>' : ''}</span>
          <form method="post" action="/auth/logout" style="margin:0"><button class="btn ghost" style="font-size:13px;color:var(--dim)">Sign out</button></form>
        </span>`;
    }
  } catch {}
  renderCards(authenticated);
})();
