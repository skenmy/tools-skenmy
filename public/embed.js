// tools.skenmy.com embed — floats a "who's signed in" pill into any
// *.skenmy.com page that includes this script.
//
// Usage:
//   <script src="https://tools.skenmy.com/embed.js" data-app="lowerthird" data-role="admin"></script>
//
// The pill calls /auth/me?app=<app>&role=<role> with credentials so it
// picks up the shared .skenmy.com session cookie. If unauthenticated
// it shows a sign-in link; otherwise shows avatar + display name + role
// chip + a small ↗ link back to tools.skenmy.com.
(function () {
  const script = document.currentScript || (function () {
    const s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();
  const APP  = (script && script.dataset.app)  || 'unknown';
  const ROLE = (script && script.dataset.role) || 'admin';
  const ORIGIN = 'https://tools.skenmy.com';

  const css = `
    .sk-auth-pill {
      position: fixed; right: 16px; top: 16px; z-index: 2147483600;
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 10px;
      background: rgba(14,16,20,.92); backdrop-filter: blur(8px);
      color: #ebedf1; font-family: Inter, system-ui, sans-serif; font-size: 13px;
      border: 1px solid #21252e; border-radius: 999px;
      box-shadow: 0 6px 20px rgba(0,0,0,.4);
      line-height: 1;
    }
    .sk-auth-pill img { width: 22px; height: 22px; border-radius: 50%; }
    .sk-auth-pill .sk-name { font-weight: 600; }
    .sk-auth-pill .sk-role {
      font-family: ui-monospace, "JetBrains Mono", monospace;
      font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
      padding: 2px 7px; border-radius: 3px;
    }
    .sk-auth-pill.write   .sk-role { background: rgba(52,211,153,.18); color: #34d399; }
    .sk-auth-pill.readonly .sk-role { background: rgba(122,128,139,.22); color: #c5cad2; }
    .sk-auth-pill.readonly { border-color: rgba(122,128,139,.4); }
    .sk-auth-pill a { color: #7a808b; text-decoration: none; padding: 0 4px; }
    .sk-auth-pill a:hover { color: #ebedf1; }
    .sk-auth-pill.anon { background: rgba(14,16,20,.8); border-style: dashed; }
    .sk-auth-pill.anon .sk-signin { color: #34d399; font-weight: 600; padding: 0 4px; text-decoration: none; }
    .sk-auth-pill.anon .sk-signin:hover { text-decoration: underline; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const pill = document.createElement('div');
  pill.className = 'sk-auth-pill';
  pill.innerHTML = '<span class="sk-name" style="color:#7a808b">checking…</span>';
  function mount() {
    if (document.body) document.body.appendChild(pill);
    else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(pill));
  }
  mount();

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function render(data) {
    if (!data || !data.authenticated) {
      pill.className = 'sk-auth-pill anon';
      const here = encodeURIComponent(location.href);
      pill.innerHTML = `<a class="sk-signin" href="${ORIGIN}/auth/twitch/login?redirect=${here}">Sign in with Twitch</a>`;
      return;
    }
    const role = data.root ? 'root' : data.canWrite ? ROLE : 'viewer';
    const cls  = data.canWrite ? 'write' : 'readonly';
    pill.className = 'sk-auth-pill ' + cls;
    pill.innerHTML = `
      ${data.user.avatar ? `<img src="${esc(data.user.avatar)}" alt="">` : ''}
      <span class="sk-name">${esc(data.user.display || data.user.login)}</span>
      <span class="sk-role">${role}</span>
      <a href="${ORIGIN}/" target="_blank" rel="noopener" title="Manage on tools.skenmy.com">↗</a>
    `;
  }

  fetch(`${ORIGIN}/auth/me?app=${encodeURIComponent(APP)}&role=${encodeURIComponent(ROLE)}`, {
    credentials: 'include',
  }).then(r => r.json()).then(render).catch(() => {
    pill.className = 'sk-auth-pill anon';
    pill.innerHTML = `<span class="sk-name" style="color:#7a808b">auth check failed</span>`;
  });
})();
