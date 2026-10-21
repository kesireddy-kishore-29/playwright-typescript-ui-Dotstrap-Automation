// Relay — the self-hosted demo app. Vanilla JS, no build step: the point is a deterministic,
// accessible UI with real API calls that tests can seed, mock and observe.

const app = document.getElementById('app');
const NAV = [
  { path: '/inbox', label: 'Inbox' },
  { path: '/items', label: 'Items' },
  { path: '/settings', label: 'Settings' },
];

const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

// ---- theme ---------------------------------------------------------------------------------
function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('relay-theme', theme);
  } catch {
    // Storage can be blocked; the theme still applies for this page.
  }
}

// ---- API -----------------------------------------------------------------------------------
class ApiError extends Error {
  constructor(status, code) {
    super(code || `HTTP ${status}`);
    this.status = status;
    this.code = code;
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (response.status === 401 && !path.startsWith('/api/auth/')) {
    const next = encodeURIComponent(location.pathname);
    navigate(`/login?next=${next}`, { replace: true });
    throw new ApiError(401, 'unauthenticated');
  }
  if (!response.ok) {
    let code;
    try {
      code = (await response.json()).error;
    } catch {
      code = undefined;
    }
    throw new ApiError(response.status, code);
  }
  return response.status === 204 ? null : response.json();
}

// ---- routing -------------------------------------------------------------------------------
function navigate(path, { replace = false } = {}) {
  if (replace) {
    history.replaceState({}, '', path);
  } else {
    history.pushState({}, '', path);
  }
  render();
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-link]');
  if (link) {
    event.preventDefault();
    navigate(link.getAttribute('href'));
  }
});
window.addEventListener('popstate', render);

function render() {
  const path = location.pathname === '/' ? '/inbox' : location.pathname;
  if (path === '/login') {
    renderLogin();
  } else if (path === '/items') {
    renderShell('Items', renderItems);
  } else if (path === '/settings') {
    renderShell('Settings', renderSettings);
  } else {
    renderShell('Inbox', renderInbox);
  }
}

// ---- toast ---------------------------------------------------------------------------------
function toast(text) {
  const region = document.getElementById('toast');
  if (region) {
    region.textContent = text;
  }
}

// ---- shell: header, bell, theme, nav ------------------------------------------------------------
function renderShell(title, renderPage) {
  document.title = `Relay — ${title.toLowerCase()}`;
  const current = location.pathname === '/' ? '/inbox' : location.pathname;
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="/inbox" data-link>Relay</a>
        <div class="bell">
          <button type="button" id="bell" aria-expanded="false" aria-controls="bell-panel">
            Notifications<span class="badge" data-test="unread-count" hidden>0</span>
          </button>
          <div class="panel" id="bell-panel" role="dialog" aria-label="Notifications" hidden></div>
        </div>
        <button type="button" id="theme-toggle" aria-pressed="${currentTheme() === 'dark'}">
          <span aria-hidden="true">${currentTheme() === 'dark' ? '☀' : '☾'}</span>
          <span class="theme-label">Dark theme</span><span class="visually-hidden"> toggle</span>
        </button>
        <button type="button" id="sign-out">Sign out</button>
      </header>
      <nav class="sidenav" aria-label="Main">
        <ul>
          ${NAV.map(
            (n) =>
              `<li><a href="${n.path}" data-link${n.path === current ? ' aria-current="page"' : ''}>${n.label}</a></li>`,
          ).join('')}
        </ul>
      </nav>
      <main id="main">
        <h1>${title}</h1>
        <div id="page"></div>
      </main>
      <div class="toast" id="toast" role="status" aria-live="polite"></div>
    </div>`;

  document.getElementById('theme-toggle').addEventListener('click', () => {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    render();
  });
  document.getElementById('sign-out').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    navigate('/login');
  });
  const bell = document.getElementById('bell');
  bell.addEventListener('click', () => toggleBellPanel(bell));
  refreshUnreadCount();
  renderPage(document.getElementById('page'));
}

async function refreshUnreadCount() {
  const badge = document.querySelector('[data-test="unread-count"], [data-test="unread-badge"]');
  const bell = document.getElementById('bell');
  if (!badge || !bell) {
    return;
  }
  try {
    const { count } = await api('/api/notifications/unread-count');
    badge.textContent = String(count);
    badge.hidden = count === 0;
    bell.setAttribute('aria-label', `Notifications, ${count} unread`);
  } catch (error) {
    if (error.status !== 401) {
      badge.hidden = true;
    }
  }
}

async function toggleBellPanel(bell) {
  const panel = document.getElementById('bell-panel');
  const open = bell.getAttribute('aria-expanded') === 'true';
  if (open) {
    panel.hidden = true;
    bell.setAttribute('aria-expanded', 'false');
    return;
  }
  bell.setAttribute('aria-expanded', 'true');
  panel.hidden = false;
  panel.innerHTML = '<p role="status">Loading…</p>';
  try {
    const { items } = await api('/api/messages');
    const unread = items.filter((m) => !m.read);
    panel.innerHTML = unread.length
      ? `<h2>Unread</h2><ul>${unread.map((m) => `<li>${escapeHtml(m.subject)}</li>`).join('')}</ul>
         <button type="button" class="primary" id="read-all">Mark all as read</button>`
      : '<p>You are all caught up.</p>';
    const readAll = document.getElementById('read-all');
    if (readAll) {
      readAll.addEventListener('click', async () => {
        await api('/api/messages/read-all', { method: 'POST' });
        panel.hidden = true;
        bell.setAttribute('aria-expanded', 'false');
        toast('All messages marked as read');
        render();
      });
    }
  } catch {
    panel.innerHTML = '<p role="alert">Notifications are unavailable right now.</p>';
  }
}

// ---- inbox --------------------------------------------------------------------------------
const RATE_MESSAGES = {
  rate_limited: 'You are sending requests too quickly. Wait a moment, then try again.',
  quota_exceeded: "You have used this month's allowance. It resets on the 1st.",
};

function renderInbox(page) {
  page.innerHTML = `
    <section class="card" aria-labelledby="usage-heading">
      <h2 id="usage-heading">Usage</h2>
      <div id="usage"><p class="meta">Loading usage…</p></div>
    </section>
    <section class="card" aria-labelledby="messages-heading">
      <h2 id="messages-heading">Messages</h2>
      <div id="messages"></div>
    </section>`;
  loadUsage();
  loadMessages();
}

async function loadUsage() {
  const box = document.getElementById('usage');
  try {
    const usage = await api('/api/usage');
    box.innerHTML = `<p><strong>${escapeHtml(usage.plan)}</strong> plan · ${usage.used} of ${usage.limit} used</p>`;
  } catch (error) {
    if (error.status !== 401) {
      box.innerHTML = '<p class="meta" role="note">Usage is unavailable right now.</p>';
    }
  }
}

async function loadMessages() {
  const box = document.getElementById('messages');
  box.innerHTML = `<p role="status">Loading messages…</p>
    <div class="skeleton" aria-hidden="true"></div><div class="skeleton" aria-hidden="true"></div>`;
  try {
    const { items } = await api('/api/messages');
    if (items.length === 0) {
      box.innerHTML = '<p class="empty">No messages yet. New messages will appear here.</p>';
      return;
    }
    box.innerHTML = `<ul class="messages" aria-label="Messages">${items
      .map(
        (m) => `
        <li class="${m.read ? 'read' : 'unread'}" data-test="message-row" data-id="${m.id}">
          <span class="dot" data-test="unread-dot" aria-hidden="true"></span>
          <div class="grow">
            <span class="subject">${escapeHtml(m.subject)}${m.read ? '' : '<span class="visually-hidden"> (unread)</span>'}</span>
            <span class="meta">From ${escapeHtml(m.from)}</span>
          </div>
          ${m.read ? '' : `<button type="button" data-action="read" aria-label="Mark ${escapeHtml(m.subject)} as read">Mark read</button>`}
        </li>`,
      )
      .join('')}</ul>`;
    box.querySelectorAll('button[data-action="read"]').forEach((button) =>
      button.addEventListener('click', async () => {
        const id = button.closest('li').dataset.id;
        await api(`/api/messages/${id}/read`, { method: 'POST' });
        toast('Marked as read');
        loadMessages();
        refreshUnreadCount();
      }),
    );
  } catch (error) {
    if (error.status === 401) {
      return;
    }
    const text =
      error.status === 429 && RATE_MESSAGES[error.code]
        ? RATE_MESSAGES[error.code]
        : "We couldn't load your messages.";
    box.innerHTML = `<div class="alert" role="alert"><span>${text}</span>
      <button type="button" id="retry">Try again</button></div>`;
    document.getElementById('retry').addEventListener('click', loadMessages);
  }
}

// ---- items ----------------------------------------------------------------------------------
async function renderItems(page) {
  page.innerHTML = '<p role="status">Loading items…</p>';
  try {
    const { items } = await api('/api/items');
    if (items.length === 0) {
      page.innerHTML = '<p class="empty">No items yet.</p>';
      return;
    }
    page.innerHTML = `
      <div class="card">
        <table data-test="items-table">
          <caption>${items.length} item${items.length === 1 ? '' : 's'}</caption>
          <thead><tr><th scope="col">Name</th><th scope="col">Status</th><th scope="col">Owner</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
          <tbody>${items
            .map(
              (
                i,
              ) => `<tr data-id="${i.id}"><td>${escapeHtml(i.name)}</td><td>${i.status}</td><td>${escapeHtml(i.owner)}</td>
              <td><button type="button" class="danger" data-action="delete" aria-label="Delete ${escapeHtml(i.name)}">Delete</button></td></tr>`,
            )
            .join('')}</tbody>
        </table>
      </div>
      <dialog id="confirm" aria-labelledby="confirm-title">
        <h2 id="confirm-title">Delete item?</h2>
        <p id="confirm-text"></p>
        <form method="dialog"><button value="cancel">Cancel</button> <button value="delete" class="primary">Delete</button></form>
      </dialog>`;
    const dialog = document.getElementById('confirm');
    page.querySelectorAll('button[data-action="delete"]').forEach((button) =>
      button.addEventListener('click', () => {
        const row = button.closest('tr');
        document.getElementById('confirm-text').textContent =
          `"${row.cells[0].textContent}" will be removed.`;
        dialog.returnValue = '';
        dialog.onclose = async () => {
          if (dialog.returnValue === 'delete') {
            await api(`/api/items/${row.dataset.id}`, { method: 'DELETE' });
            toast('Item deleted');
            renderItems(page);
          }
        };
        dialog.showModal();
      }),
    );
  } catch (error) {
    if (error.status !== 401) {
      page.innerHTML = `<div class="alert" role="alert"><span>We couldn't load your items.</span></div>`;
    }
  }
}

// ---- settings ----------------------------------------------------------------------------------
function renderSettings(page) {
  const theme = currentTheme();
  page.innerHTML = `
    <form class="card" id="settings">
      <fieldset>
        <legend>Theme</legend>
        <label><input type="radio" name="theme" value="light" ${theme === 'light' ? 'checked' : ''}> Light</label>
        <label><input type="radio" name="theme" value="dark" ${theme === 'dark' ? 'checked' : ''}> Dark</label>
      </fieldset>
    </form>`;
  page.querySelectorAll('input[name="theme"]').forEach((input) =>
    input.addEventListener('change', () => {
      setTheme(input.value);
      toast(`${input.value === 'dark' ? 'Dark' : 'Light'} theme on`);
      render();
    }),
  );
}

// ---- login -----------------------------------------------------------------------------------
function renderLogin() {
  document.title = 'Relay — sign in';
  app.innerHTML = `
    <main id="main">
      <form class="login card" id="login" novalidate>
        <h1>Sign in to Relay</h1>
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="username" required>
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required>
        <p id="login-error" class="alert" role="alert" hidden></p>
        <p><button type="submit" class="primary">Sign in</button></p>
      </form>
    </main>`;
  document.getElementById('login').addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.getElementById('login-error');
    try {
      await api('/api/auth/token', {
        method: 'POST',
        body: JSON.stringify({
          email: document.getElementById('email').value,
          password: document.getElementById('password').value,
        }),
      });
      const next = new URLSearchParams(location.search).get('next');
      navigate(next && next.startsWith('/') ? next : '/inbox');
    } catch {
      error.textContent = 'Email or password is incorrect.';
      error.hidden = false;
    }
  });
}

render();
