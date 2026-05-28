// Tools landing page client
const TOOLS = [
  { id: 'schedule',    name: 'Schedule Helper',   subtitle: 'Marathon schedule tracker (Oengus / Horaro) with operator sync.', primary: 'https://schedule.skenmy.com',   admin: null, repo: 'skenmy/schedule-helper' },
  { id: 'lowerthird',  name: 'ESA Lower Third',    subtitle: 'OBS overlay + control for ESA marathon streams.',                 primary: 'https://lowerthird.skenmy.com/source.html', admin: 'https://lowerthird.skenmy.com/control.html', repo: 'skenmy/esalowerthird' },
  { id: 'esaquiz',     name: 'ESA Quiz',           subtitle: 'Quiz overlay + control panel.',                                   primary: 'https://esaquiz.skenmy.com/source.html', admin: 'https://esaquiz.skenmy.com/control.html', repo: 'skenmy/esaquiz' },
  { id: 'blockbuster', name: 'Blockbusters',       subtitle: 'Blockbusters game-show clone with multiplayer rooms.',           primary: 'https://blockbuster.skenmy.com/display', admin: 'https://blockbuster.skenmy.com/control', repo: 'skenmy/blockbusters-game-challenges' },
];

const cardsEl = document.getElementById('cards');
const readme = document.getElementById('readme');
const readmeTitle = document.getElementById('readme-title');
const readmeBody = document.getElementById('readme-body');

cardsEl.innerHTML = TOOLS.map(t => `
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

// Top-right user pill
(async () => {
  try {
    const r = await fetch('/auth/me');
    const data = await r.json();
    const slot = document.getElementById('user');
    if (data.authenticated) {
      const u = data.user;
      slot.innerHTML = `
        <span style="display:flex;align-items:center;gap:10px;">
          ${u.avatar ? `<img class="avatar" src="${u.avatar}" alt="">` : ''}
          <span style="font-size:14px"><b>${u.display || u.login}</b>${data.root ? ' <span class="pill" style="display:inline-block;margin-left:6px;color:var(--warn)">root</span>' : ''}</span>
          <form method="post" action="/auth/logout" style="margin:0"><button class="btn ghost" style="font-size:13px;color:var(--dim)">Sign out</button></form>
        </span>`;
    }
  } catch {}
})();
