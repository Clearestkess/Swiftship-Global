'use strict';

const ADMIN_STATUS_OPTIONS = ['Processing', 'In Transit', 'Customs Clearance', 'Out for Delivery', 'Delivered'];
const ADMIN_MODE_OPTIONS = ['Air Freight', 'Sea Freight', 'Road Freight', 'Rail Freight', 'Warehousing'];

const state = {
  user: null,
  data: {
    shipments: [],
    quotes: [],
    contacts: [],
    chats: []
  },
  authSource: null
};

const els = {};

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showAlert(type, message) {
  const errorBanner = $('errorBanner');
  const successBanner = $('successBanner');
  if (!errorBanner || !successBanner) return;

  errorBanner.style.display = 'none';
  successBanner.style.display = 'none';

  if (!message) return;

  if (type === 'success') {
    $('successMsg').textContent = message;
    successBanner.style.display = 'flex';
  } else {
    $('errorMsg').textContent = message;
    errorBanner.style.display = 'flex';
  }
}

function clearAlerts() {
  showAlert('', '');
}

function setLoginLoading(loading) {
  const loginBtn = $('loginBtn');
  const btnText = $('btnText');
  const btnSpinner = $('btnSpinner');
  if (!loginBtn || !btnText || !btnSpinner) return;
  loginBtn.disabled = loading;
  btnText.style.display = loading ? 'none' : 'flex';
  btnSpinner.style.display = loading ? 'flex' : 'none';
}

function showLoginView() {
  document.body.classList.remove('dashboard-active');
  els.wrapper.classList.remove('dashboard-mode');
  els.card.classList.remove('dashboard-card');
  if ($('authCheckingBanner')) $('authCheckingBanner').style.display = 'none';
  if ($('forgotForm')) $('forgotForm').style.display = 'none';
  if ($('loginForm')) $('loginForm').style.display = 'block';
}

function showForgotView() {
  if ($('loginForm')) $('loginForm').style.display = 'none';
  if ($('forgotForm')) $('forgotForm').style.display = 'block';
  clearAlerts();
}

function hideForgotView() {
  if ($('forgotForm')) $('forgotForm').style.display = 'none';
  if ($('loginForm')) $('loginForm').style.display = 'block';
  clearAlerts();
}

function readSavedEmail() {
  const saved = localStorage.getItem('swiftship_remember_email');
  if (saved && $('email')) {
    $('email').value = saved;
    if ($('rememberMe')) $('rememberMe').checked = true;
  }
}

function togglePassword() {
  const passwordInput = $('password');
  const eyeIcon = $('eyeIcon');
  if (!passwordInput || !eyeIcon) return;
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  eyeIcon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function renderOptions(options, selectedValue) {
  return options.map((option) => {
    const selected = option === selectedValue ? 'selected' : '';
    return `<option value="${escapeHtml(option)}" ${selected}>${escapeHtml(option)}</option>`;
  }).join('');
}

function emptyState(title, text) {
  return `
    <div class="empty-state">
      <i class="fas fa-inbox"></i>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(text)}</span>
    </div>
  `;
}

async function getIdToken(forceRefresh = false) {
  if (!state.user) throw new Error('Not authenticated');
  return state.user.getIdToken(forceRefresh);
}

async function apiFetch(path, init = {}, retry = true) {
  const token = await getIdToken(false);
  const response = await fetch(path, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {})
    }
  });

  if ((response.status === 401 || response.status === 403) && retry) {
    const refreshedToken = await getIdToken(true);
    return fetch(path, {
      ...init,
      headers: {
        authorization: `Bearer ${refreshedToken}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.headers || {})
      }
    });
  }

  return response;
}

async function apiJson(path, init = {}) {
  const response = await apiFetch(path, init);
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const error = new Error(payload.error || 'Request failed');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function statusClass(value) {
  return String(value || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function renderShipments() {
  const shipments = state.data.shipments;
  if (!shipments.length) return emptyState('No shipments yet', 'Create the first shipment record from the protected admin API.');

  return shipments.map((item) => `
    <article class="admin-item-card">
      <div class="admin-item-top">
        <div>
          <span class="pill pill-primary">${escapeHtml(item.trackingId || 'Pending ID')}</span>
          <h4>${escapeHtml(item.sender || 'Unknown sender')} → ${escapeHtml(item.receiver || 'Unknown receiver')}</h4>
        </div>
        <span class="status-badge status-${statusClass(item.status)}">${escapeHtml(item.status || 'Unknown')}</span>
      </div>
      <div class="meta-grid">
        <div><span>Origin</span><strong>${escapeHtml(item.origin || '—')}</strong></div>
        <div><span>Destination</span><strong>${escapeHtml(item.destination || '—')}</strong></div>
        <div><span>Mode</span><strong>${escapeHtml(item.mode || '—')}</strong></div>
        <div><span>ETA</span><strong>${escapeHtml(item.eta || '—')}</strong></div>
      </div>
      <div class="admin-item-actions">
        <label>
          <span>Status</span>
          <select data-action="shipment-status" data-id="${escapeHtml(item.id)}">
            ${renderOptions(ADMIN_STATUS_OPTIONS, item.status || 'Processing')}
          </select>
        </label>
        <button class="btn-secondary btn-small" data-action="delete-shipment" data-id="${escapeHtml(item.id)}">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    </article>
  `).join('');
}

function renderQuotes() {
  const quotes = state.data.quotes;
  if (!quotes.length) return emptyState('No quote requests', 'New public quote submissions will appear here.');

  return quotes.map((item) => `
    <article class="admin-list-row">
      <div>
        <strong>${escapeHtml(item.name || 'Unnamed requester')}</strong>
        <p>${escapeHtml(item.company || 'No company')} · ${escapeHtml(item.email || 'No email')}</p>
        <small>${escapeHtml(item.origin || '—')} → ${escapeHtml(item.destination || '—')} · ${escapeHtml(item.mode || '—')}</small>
      </div>
      <div class="row-actions">
        <select data-action="quote-status" data-id="${escapeHtml(item.id)}">
          ${renderOptions(['new', 'reviewing', 'quoted', 'closed'], item.status || 'new')}
        </select>
        <button class="btn-secondary btn-small" data-action="delete-quote" data-id="${escapeHtml(item.id)}">Delete</button>
      </div>
    </article>
  `).join('');
}

function renderContacts() {
  const contacts = state.data.contacts;
  if (!contacts.length) return emptyState('No contact messages', 'Protected customer messages will show up here.');

  return contacts.map((item) => `
    <article class="admin-list-row ${item.read ? '' : 'is-unread'}">
      <div>
        <strong>${escapeHtml(item.subject || 'General inquiry')}</strong>
        <p>${escapeHtml(item.name || 'Unknown sender')} · ${escapeHtml(item.email || 'No email')}</p>
        <small>${escapeHtml(item.message || '').slice(0, 140) || 'No message body'}</small>
      </div>
      <div class="row-actions">
        <button class="btn-secondary btn-small" data-action="toggle-contact" data-id="${escapeHtml(item.id)}" data-read="${item.read ? 'true' : 'false'}">
          ${item.read ? 'Mark unread' : 'Mark read'}
        </button>
        <button class="btn-secondary btn-small" data-action="delete-contact" data-id="${escapeHtml(item.id)}">Delete</button>
      </div>
    </article>
  `).join('');
}

function renderChats() {
  const chats = state.data.chats;
  if (!chats.length) return emptyState('No live chats', 'Recent visitor chat sessions will appear here.');

  return chats.slice(0, 10).map((item) => `
    <article class="chat-card">
      <div class="chat-card-head">
        <strong>${escapeHtml(item.userName || 'Visitor')}</strong>
        <span class="pill ${String(item.status || '').toLowerCase() === 'active' ? 'pill-success' : 'pill-muted'}">${escapeHtml(item.status || 'unknown')}</span>
      </div>
      <p>${escapeHtml(item.lastMessage || 'No recent message')}</p>
      <small>${escapeHtml(item.userEmail || 'No email')} · ${formatDate(item.lastAt)}</small>
    </article>
  `).join('');
}

function renderDashboard(notice = '') {
  const stats = {
    shipments: state.data.shipments.length,
    quotes: state.data.quotes.length,
    contacts: state.data.contacts.length,
    unreadContacts: state.data.contacts.filter((item) => item.read !== true).length,
    activeChats: state.data.chats.filter((item) => String(item.status || '').toLowerCase() === 'active').length
  };

  document.body.classList.add('dashboard-active');
  els.wrapper.classList.add('dashboard-mode');
  els.card.classList.add('dashboard-card');

  const authLabel = state.authSource ? `Authorized via ${state.authSource}` : 'Server-side admin authorization enabled';

  els.card.innerHTML = `
    <section class="dashboard-shell">
      <div class="dashboard-topbar">
        <div>
          <p class="eyebrow">SwiftShip admin area</p>
          <h2>Protected operations dashboard</h2>
          <span class="dashboard-subtitle">${escapeHtml(state.user?.email || 'Authorized admin')} · ${escapeHtml(authLabel)}</span>
        </div>
        <div class="dashboard-top-actions">
          <button class="btn-secondary" data-action="refresh-dashboard"><i class="fas fa-rotate-right"></i> Refresh</button>
          <button class="btn-login dashboard-signout" data-action="sign-out"><i class="fas fa-sign-out-alt"></i> Sign out</button>
        </div>
      </div>

      ${notice ? `<div class="dashboard-notice"><i class="fas fa-shield-halved"></i><span>${escapeHtml(notice)}</span></div>` : ''}

      <div class="stats-grid">
        <article class="stat-card"><span>Shipments</span><strong>${stats.shipments}</strong></article>
        <article class="stat-card"><span>Quote requests</span><strong>${stats.quotes}</strong></article>
        <article class="stat-card"><span>Contact messages</span><strong>${stats.contacts}</strong></article>
        <article class="stat-card"><span>Unread messages</span><strong>${stats.unreadContacts}</strong></article>
        <article class="stat-card"><span>Active chats</span><strong>${stats.activeChats}</strong></article>
      </div>

      <div class="dashboard-grid">
        <div class="dashboard-main">
          <section class="panel-card">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Shipment management</p>
                <h3>Create and update shipments</h3>
              </div>
            </div>
            <form id="shipmentForm" class="shipment-form">
              <div class="form-grid">
                <label><span>Sender</span><input id="shipSender" required placeholder="ABC Corp" /></label>
                <label><span>Receiver</span><input id="shipReceiver" required placeholder="XYZ Ltd" /></label>
                <label><span>Origin</span><input id="shipOrigin" required placeholder="New York, USA" /></label>
                <label><span>Destination</span><input id="shipDestination" required placeholder="London, UK" /></label>
                <label><span>Mode</span><select id="shipMode">${renderOptions(ADMIN_MODE_OPTIONS, 'Air Freight')}</select></label>
                <label><span>Status</span><select id="shipStatus">${renderOptions(ADMIN_STATUS_OPTIONS, 'Processing')}</select></label>
                <label><span>Weight</span><input id="shipWeight" placeholder="500 kg" /></label>
                <label><span>ETA</span><input id="shipEta" type="date" /></label>
              </div>
              <label class="form-block"><span>Timeline note</span><textarea id="shipNote" rows="3" placeholder="Shipment created by authorized admin"></textarea></label>
              <div class="panel-actions">
                <button class="btn-login" type="submit"><i class="fas fa-plus"></i> Create shipment</button>
              </div>
            </form>
            <div class="panel-list">${renderShipments()}</div>
          </section>
        </div>

        <aside class="dashboard-side">
          <section class="panel-card compact-panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Customer pipeline</p>
                <h3>Quote requests</h3>
              </div>
            </div>
            <div class="stack-list">${renderQuotes()}</div>
          </section>

          <section class="panel-card compact-panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Inbox</p>
                <h3>Contact messages</h3>
              </div>
            </div>
            <div class="stack-list">${renderContacts()}</div>
          </section>

          <section class="panel-card compact-panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Support</p>
                <h3>Live chat sessions</h3>
              </div>
            </div>
            <div class="stack-list">${renderChats()}</div>
          </section>
        </aside>
      </div>
    </section>
  `;
}

function renderDashboardLoading() {
  document.body.classList.add('dashboard-active');
  els.wrapper.classList.add('dashboard-mode');
  els.card.classList.add('dashboard-card');
  els.card.innerHTML = `
    <section class="dashboard-shell">
      <div class="dashboard-loading">
        <i class="fas fa-circle-notch fa-spin"></i>
        <strong>Loading protected admin data…</strong>
        <span>Verifying your Firebase identity and fetching server-side dashboard data.</span>
      </div>
    </section>
  `;
}

async function loadDashboardData() {
  const payload = await apiJson('/api/admin/dashboard');
  state.data = payload.data || { shipments: [], quotes: [], contacts: [], chats: [] };
  state.authSource = payload.auth?.source || null;
}

async function enterDashboard(notice = '') {
  renderDashboardLoading();
  await loadDashboardData();
  renderDashboard(notice);
}

function validationError(message) {
  renderDashboard(message);
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  clearAlerts();

  if (($('hp_name')?.value || '').trim()) return;
  if (Date.now() - window.__swiftshipLoginLoadTime < 1500) {
    showAlert('error', 'Please wait a moment before submitting.');
    return;
  }

  const email = ($('email')?.value || '').trim();
  const password = $('password')?.value || '';

  let valid = true;
  $('emailError').textContent = '';
  $('passwordError').textContent = '';

  if (!email) {
    $('emailError').textContent = 'Email is required.';
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    $('emailError').textContent = 'Enter a valid email.';
    valid = false;
  }
  if (!password) {
    $('passwordError').textContent = 'Password is required.';
    valid = false;
  }
  if (!valid) return;

  if ($('rememberMe')?.checked) localStorage.setItem('swiftship_remember_email', email);
  else localStorage.removeItem('swiftship_remember_email');

  setLoginLoading(true);

  try {
    let result;
    if (typeof signIn === 'function') {
      result = await signIn(email, password);
    } else if (window.firebase?.auth) {
      result = await firebase.auth().signInWithEmailAndPassword(email, password);
    } else {
      throw new Error('Firebase Authentication is unavailable on this page.');
    }

    state.user = result.user || result;
    localStorage.setItem('swiftship_admin_session', JSON.stringify({ email: state.user?.email || email, loginAt: Date.now() }));
    await enterDashboard('Login successful. Server-side admin protection is active.');
  } catch (err) {
    console.error('[Admin Login] Error:', err);
    if (err.status === 403) {
      await handleSignOut(false);
      showAlert('error', 'You are signed in, but this account is not authorized for the admin area.');
    } else {
      const code = err?.code || '';
      if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(code)) {
        showAlert('error', 'Invalid email or password. Please try again.');
      } else if (code === 'auth/too-many-requests') {
        showAlert('error', 'Too many failed attempts. Please wait a few minutes and try again.');
      } else if (code === 'auth/network-request-failed') {
        showAlert('error', 'Network error. Check your connection and try again.');
      } else {
        showAlert('error', err?.message || 'Sign in failed.');
      }
    }
  } finally {
    setLoginLoading(false);
  }
}

async function handlePasswordReset() {
  const email = ($('resetEmail')?.value || '').trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAlert('error', 'Please enter a valid email address.');
    return;
  }

  const spinner = $('resetSpinner');
  const text = $('resetBtnText');
  spinner.style.display = 'inline-block';
  text.style.display = 'none';

  try {
    if (typeof sendPasswordReset === 'function') await sendPasswordReset(email);
    else if (window.firebase?.auth) await firebase.auth().sendPasswordResetEmail(email);
    else throw new Error('Firebase Authentication is unavailable.');
    showAlert('success', 'Password reset email sent to ' + email + '.');
    hideForgotView();
  } catch (err) {
    showAlert('error', 'Failed to send reset email: ' + (err?.message || 'Unknown error'));
  } finally {
    spinner.style.display = 'none';
    text.style.display = 'block';
  }
}

async function refreshDashboard(notice = 'Dashboard refreshed from the protected admin API.') {
  await enterDashboard(notice);
}

async function handleShipmentCreate(event) {
  event.preventDefault();

  const payload = {
    sender: $('shipSender')?.value?.trim(),
    receiver: $('shipReceiver')?.value?.trim(),
    origin: $('shipOrigin')?.value?.trim(),
    destination: $('shipDestination')?.value?.trim(),
    mode: $('shipMode')?.value || 'Air Freight',
    status: $('shipStatus')?.value || 'Processing',
    weight: $('shipWeight')?.value?.trim(),
    eta: $('shipEta')?.value || '',
    timeline: [{
      status: $('shipStatus')?.value || 'Processing',
      date: new Date().toISOString().slice(0, 10),
      note: ($('shipNote')?.value || 'Shipment created by authorized admin').trim()
    }]
  };

  if (!payload.sender || !payload.receiver || !payload.origin || !payload.destination) {
    validationError('Please fill in sender, receiver, origin, and destination.');
    return;
  }

  await apiJson('/api/admin/shipments', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  await refreshDashboard('Shipment created successfully.');
}

function findShipment(id) {
  return state.data.shipments.find((item) => item.id === id);
}

async function updateShipmentStatus(id, status) {
  const current = findShipment(id);
  const timeline = Array.isArray(current?.timeline) ? [...current.timeline] : [];
  timeline.push({
    status,
    date: new Date().toISOString().slice(0, 10),
    note: 'Status updated by authorized admin'
  });

  await apiJson(`/api/admin/shipments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, timeline })
  });

  await refreshDashboard('Shipment status updated.');
}

async function deleteShipmentRecord(id) {
  if (!window.confirm('Delete this shipment?')) return;
  await apiJson(`/api/admin/shipments/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await refreshDashboard('Shipment deleted.');
}

async function updateQuoteRecord(id, status) {
  await apiJson(`/api/admin/quotes/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
  await refreshDashboard('Quote status updated.');
}

async function deleteQuoteRecord(id) {
  if (!window.confirm('Delete this quote request?')) return;
  await apiJson(`/api/admin/quotes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await refreshDashboard('Quote request deleted.');
}

async function toggleContactRead(id, currentRead) {
  await apiJson(`/api/admin/contacts/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ read: !currentRead })
  });
  await refreshDashboard(currentRead ? 'Message marked unread.' : 'Message marked read.');
}

async function deleteContactRecord(id) {
  if (!window.confirm('Delete this contact message?')) return;
  await apiJson(`/api/admin/contacts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await refreshDashboard('Contact message deleted.');
}

async function handleSignOut(reload = true) {
  try {
    if (typeof signOut === 'function') await signOut();
    else if (window.firebase?.auth) await firebase.auth().signOut();
  } catch (err) {
    console.warn('[Admin Dashboard] Sign-out failed:', err?.message || err);
  }

  state.user = null;
  localStorage.removeItem('swiftship_admin_session');
  if (reload) location.reload();
}

function bindEvents() {
  els.card.addEventListener('submit', async (event) => {
    const target = event.target;
    if (target?.id === 'loginForm') return handleLoginSubmit(event);
    if (target?.id === 'shipmentForm') return handleShipmentCreate(event);
  });

  els.card.addEventListener('click', async (event) => {
    try {
      const actionEl = event.target.closest('[data-action]');

      if (event.target.closest('#togglePw')) return togglePassword();
      if (event.target.closest('#forgotBtn')) return showForgotView();
      if (event.target.closest('#backToLoginBtn')) return hideForgotView();
      if (event.target.closest('#sendResetBtn')) return handlePasswordReset();
      if (!actionEl) return;

      const action = actionEl.dataset.action;
      const id = actionEl.dataset.id;

      if (action === 'refresh-dashboard') return refreshDashboard();
      if (action === 'sign-out') return handleSignOut();
      if (action === 'delete-shipment') return deleteShipmentRecord(id);
      if (action === 'delete-quote') return deleteQuoteRecord(id);
      if (action === 'delete-contact') return deleteContactRecord(id);
      if (action === 'toggle-contact') return toggleContactRead(id, actionEl.dataset.read === 'true');
    } catch (err) {
      console.error(err);
      validationError(err?.message || 'Action failed.');
    }
  });

  els.card.addEventListener('change', async (event) => {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;

    try {
      const action = actionEl.dataset.action;
      const id = actionEl.dataset.id;
      const value = event.target.value;

      if (action === 'shipment-status') return updateShipmentStatus(id, value);
      if (action === 'quote-status') return updateQuoteRecord(id, value);
    } catch (err) {
      console.error(err);
      validationError(err?.message || 'Update failed.');
    }
  });
}

function setupFirebaseAuth() {
  const authBanner = $('authCheckingBanner');
  if (!window.firebase || typeof onAuthStateChanged !== 'function') {
    if (authBanner) authBanner.style.display = 'none';
    showLoginView();
    showAlert('error', 'Firebase Authentication failed to load.');
    return;
  }

  onAuthStateChanged(async (user) => {
    if (authBanner) authBanner.style.display = 'none';

    if (user) {
      state.user = user;
      try {
        await enterDashboard('Authenticated with Firebase and verified by the server.');
      } catch (err) {
        console.error('[Admin Auth] Authorization failed:', err);
        if (err.status === 403) {
          await handleSignOut(false);
          showLoginView();
          showAlert('error', 'This Firebase account is not authorized for the protected admin area.');
        } else {
          showLoginView();
          showAlert('error', err?.message || 'Failed to verify admin access.');
        }
      }
    } else {
      showLoginView();
    }
  });
}

function init() {
  els.wrapper = document.querySelector('.login-wrapper');
  els.card = document.querySelector('.login-card');
  if (!els.wrapper || !els.card) return;

  window.__swiftshipLoginLoadTime = Date.now();
  readSavedEmail();
  bindEvents();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(setupFirebaseAuth, 250));
  } else {
    setTimeout(setupFirebaseAuth, 250);
  }
}

init();
