const SAVE_SERVER = 'https://save.pokelike.xyz';

const SYNC_KEYS = [
  'poke_trainer', 'poke_tutorial_seen', 'poke_settings',
  'poke_achievements', 'poke_dex', 'poke_shiny_dex',
  'poke_elite_wins', 'poke_hall_of_fame', 'poke_last_run_won',
  'poke_stat_buffs',
];

function _getSaveUuid() { return localStorage.getItem('poke_save_uuid'); }
function _getUsername()  { return localStorage.getItem('poke_username'); }

function _getLocalSave() {
  const save = { lastSaved: Date.now() };
  for (const key of SYNC_KEYS) {
    const val = localStorage.getItem(key);
    if (val !== null) save[key] = val;
  }
  return save;
}

function _applyCloudSave(save) {
  for (const key of SYNC_KEYS) {
    if (save[key] === undefined) continue;

    if (key === 'poke_hall_of_fame') {
      const parse = s => { try { return JSON.parse(s || '[]'); } catch { return []; } };
      const local = parse(localStorage.getItem(key));
      const cloud = parse(save[key]);
      // Pass 1: keep every local entry unconditionally, index by savedAt
      const merged = [...local];
      const localSavedAts = new Set(local.map(e => e.savedAt).filter(Boolean).map(String));
      // Pass 2: append cloud entries that are genuinely absent from local
      for (const e of cloud) {
        if (e.savedAt) {
          if (!localSavedAts.has(String(e.savedAt))) merged.push(e);
        } else {
          // Legacy entry (no savedAt): append unless local already has identical runNumber+date+endless
          const dup = local.some(l => !l.savedAt && l.runNumber === e.runNumber && l.date === e.date && !!l.endless === !!e.endless);
          if (!dup) merged.push(e);
        }
      }
      localStorage.setItem(key, JSON.stringify(merged));
      continue;
    }

    if (key === 'poke_achievements') {
      const parse = s => { try { return JSON.parse(s || '[]'); } catch { return []; } };
      const merged = [...new Set([...parse(localStorage.getItem(key)), ...parse(save[key])])];
      localStorage.setItem(key, JSON.stringify(merged));
      continue;
    }

    if (key === 'poke_elite_wins') {
      const localVal = parseInt(localStorage.getItem(key) || '0', 10);
      const cloudVal = parseInt(save[key] || '0', 10);
      localStorage.setItem(key, String(Math.max(localVal, cloudVal)));
      continue;
    }

    localStorage.setItem(key, save[key]);
  }
  localStorage.setItem('poke_last_cloud_sync', String(save.lastSaved));
  if (typeof applyDarkMode === 'function') applyDarkMode();
}

async function syncToCloud() {
  const uuid = _getSaveUuid();
  if (!uuid) return;
  try {
    const save = _getLocalSave();
    const res = await fetch(`${SAVE_SERVER}/save/${uuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(save),
    });
    if (res.ok) localStorage.setItem('poke_last_cloud_sync', String(save.lastSaved));
  } catch (e) {
    console.warn('Sync failed:', e);
  }
}

async function _loadFromServer() {
  const uuid = _getSaveUuid();
  if (!uuid) return;
  try {
    const res = await fetch(`${SAVE_SERVER}/save/${uuid}`);
    if (!res.ok) { await syncToCloud(); return; }
    const cloudSave = await res.json();
    const hasLocal = SYNC_KEYS.some(k => localStorage.getItem(k) !== null);
    const firstTime = !localStorage.getItem('poke_last_cloud_sync');
    if (hasLocal && firstTime) {
      if (confirm('A cloud save was found. Load it? (Local progress will be overwritten)')) {
        _applyCloudSave(cloudSave);
      } else {
        await syncToCloud();
      }
    } else {
      _applyCloudSave(cloudSave);
    }
  } catch (e) {
    console.warn('Load from server failed:', e);
  }
}

function _updateSyncUI() {
  const btn  = document.getElementById('btn-cloud-sync');
  const info = document.getElementById('cloud-sync-info');
  if (!btn) return;
  const username = _getUsername();
  if (username) {
    btn.textContent = `☁ ${username}`;
    btn.onclick = _showAccountModal;
    if (info) { info.textContent = 'cloud save active'; info.style.display = 'block'; }
  } else {
    btn.textContent = '☁ Log In / Register';
    btn.onclick = _showAuthModal;
    if (info) info.style.display = 'none';
  }
}

function _showAuthModal() {
  document.getElementById('save-auth-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'save-auth-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:9999;';
  modal.innerHTML = `
    <div style="background:var(--bg2);border:2px solid var(--border);padding:24px;max-width:360px;width:90%;font-family:monospace;display:flex;flex-direction:column;gap:10px;">
      <div style="font-family:'Press Start 2P',monospace;font-size:10px;color:var(--accent);">☁ CLOUD SAVE</div>
      <input id="auth-username" placeholder="Username" autocomplete="username"
        style="background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:8px;font-size:12px;font-family:monospace;">
      <input id="auth-password" type="password" placeholder="Password" autocomplete="current-password"
        style="background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:8px;font-size:12px;font-family:monospace;">
      <div id="auth-error" style="color:#e05050;font-size:9px;display:none;"></div>
      <div style="display:flex;gap:8px;">
        <button id="auth-login-btn" class="btn-secondary" style="flex:1;">Log In</button>
        <button id="auth-register-btn" class="btn-secondary" style="flex:1;">Register</button>
      </div>
      <button id="auth-close-btn" class="btn-secondary" style="width:100%;margin-top:2px;">Cancel</button>
    </div>`;
  document.body.appendChild(modal);

  const errEl = document.getElementById('auth-error');
  const showErr = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };

  async function doAuth(endpoint) {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!username || !password) { showErr('Enter username and password.'); return; }
    errEl.style.display = 'none';
    const btn = document.getElementById(endpoint === '/login' ? 'auth-login-btn' : 'auth-register-btn');
    btn.disabled = true; btn.textContent = '...';
    try {
      const res = await fetch(`${SAVE_SERVER}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { showErr(data.error || 'Something went wrong.'); btn.disabled = false; btn.textContent = endpoint === '/login' ? 'Log In' : 'Register'; return; }
      localStorage.setItem('poke_save_uuid', data.uuid);
      localStorage.setItem('poke_username', data.username);
      modal.remove();
      _updateSyncUI();
      await _loadFromServer();
      if (typeof initGame === 'function') initGame();
    } catch (e) {
      showErr('Could not reach save server.'); btn.disabled = false; btn.textContent = endpoint === '/login' ? 'Log In' : 'Register';
    }
  }

  document.getElementById('auth-login-btn').onclick    = () => doAuth('/login');
  document.getElementById('auth-register-btn').onclick = () => doAuth('/register');
  document.getElementById('auth-close-btn').onclick    = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Submit on Enter
  modal.addEventListener('keydown', e => { if (e.key === 'Enter') doAuth('/login'); });
}

function _showAccountModal() {
  document.getElementById('save-auth-modal')?.remove();
  const username = _getUsername();
  const modal = document.createElement('div');
  modal.id = 'save-auth-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:9999;';
  modal.innerHTML = `
    <div style="background:var(--bg2);border:2px solid var(--border);padding:24px;max-width:360px;width:90%;font-family:monospace;display:flex;flex-direction:column;gap:10px;">
      <div style="font-family:'Press Start 2P',monospace;font-size:10px;color:var(--accent);">☁ CLOUD SAVE</div>
      <div style="font-size:11px;color:var(--text);">Signed in as <b>${username}</b></div>
      <div style="font-size:9px;color:var(--text-dim);">Saves sync automatically.</div>
      <button id="account-signout-btn" class="btn-secondary" style="width:100%;margin-top:4px;">Sign Out</button>
      <button id="account-close-btn" class="btn-secondary" style="width:100%;">Close</button>
    </div>`;
  document.body.appendChild(modal);

  document.getElementById('account-signout-btn').onclick = () => {
    if (!confirm('Sign out? Your local save will remain but won\'t sync until you log back in.')) return;
    localStorage.removeItem('poke_save_uuid');
    localStorage.removeItem('poke_username');
    localStorage.removeItem('poke_last_cloud_sync');
    modal.remove();
    _updateSyncUI();
  };
  document.getElementById('account-close-btn').onclick = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function initCloudSave() {
  _updateSyncUI();
  if (_getSaveUuid()) _loadFromServer();
}
