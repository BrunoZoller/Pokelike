const SAVE_SERVER = 'https://save.pokelike.xyz';

const SYNC_KEYS = [
  'poke_trainer', 'poke_tutorial_seen', 'poke_settings',
  'poke_achievements', 'poke_dex', 'poke_shiny_dex',
  'poke_elite_wins', 'poke_hall_of_fame', 'poke_last_run_won',
  'poke_stat_buffs',
];

function _getSaveUuid() {
  let uuid = localStorage.getItem('poke_save_uuid');
  if (!uuid) {
    uuid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    localStorage.setItem('poke_save_uuid', uuid);
  }
  return uuid;
}

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
    if (save[key] !== undefined) localStorage.setItem(key, save[key]);
  }
  localStorage.setItem('poke_last_cloud_sync', String(save.lastSaved));
  if (typeof applyDarkMode === 'function') applyDarkMode();
}

async function syncToCloud() {
  try {
    const uuid = _getSaveUuid();
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
  try {
    const uuid = _getSaveUuid();
    const res = await fetch(`${SAVE_SERVER}/save/${uuid}`);
    if (!res.ok) { await syncToCloud(); return; }
    const cloudSave = await res.json();
    // Cloud is always authoritative on load — no timestamp comparison.
    // First visit with existing local data: confirm before overwriting.
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
  const btn = document.getElementById('btn-cloud-sync');
  const info = document.getElementById('cloud-sync-info');
  if (!btn) return;
  const uuid = _getSaveUuid();
  btn.textContent = '☁ Save Code';
  btn.onclick = _showSyncModal;
  if (info) {
    info.textContent = `Code: ${uuid.slice(0, 8)}…`;
    info.style.display = 'block';
  }
}

function _showSyncModal() {
  document.getElementById('save-sync-modal')?.remove();
  const uuid = _getSaveUuid();
  const modal = document.createElement('div');
  modal.id = 'save-sync-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:9999;';
  modal.innerHTML = `
    <div style="background:var(--bg2);border:2px solid var(--border);padding:24px;max-width:420px;width:90%;font-family:monospace;display:flex;flex-direction:column;gap:12px;">
      <div style="font-family:'Press Start 2P',monospace;font-size:10px;color:var(--accent);">☁ SAVE SYNC</div>
      <div style="font-size:10px;color:var(--text-dim);">Your save code — use this to load your save on another device.</div>
      <div style="display:flex;gap:6px;align-items:center;">
        <input id="sync-uuid-display" readonly value="${uuid}"
          style="flex:1;background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:6px 8px;font-size:10px;font-family:monospace;">
        <button id="sync-copy-btn" class="btn-secondary" style="white-space:nowrap;font-size:9px;">Copy</button>
      </div>
      <div style="border-top:1px solid var(--border);padding-top:12px;font-size:10px;color:var(--text-dim);">Import a code from another device:</div>
      <div style="display:flex;gap:6px;align-items:center;">
        <input id="sync-import-input" placeholder="Paste code here"
          style="flex:1;background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:6px 8px;font-size:10px;font-family:monospace;">
        <button id="sync-import-btn" class="btn-secondary" style="white-space:nowrap;font-size:9px;">Import</button>
      </div>
      <button id="sync-close-btn" class="btn-secondary" style="width:100%;margin-top:4px;">Close</button>
    </div>`;
  document.body.appendChild(modal);

  document.getElementById('sync-copy-btn').onclick = () => {
    navigator.clipboard?.writeText(uuid).then(() => {
      document.getElementById('sync-copy-btn').textContent = 'Copied!';
    });
  };

  document.getElementById('sync-import-btn').onclick = async () => {
    const input = document.getElementById('sync-import-input').value.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input)) {
      alert('Invalid save code format.'); return;
    }
    if (!confirm('This will overwrite your current local save. Continue?')) return;
    localStorage.setItem('poke_save_uuid', input);
    localStorage.removeItem('poke_last_cloud_sync');
    modal.remove();
    await _loadFromServer();
    if (typeof initGame === 'function') initGame();
  };

  document.getElementById('sync-close-btn').onclick = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function initFirebase() {
  _updateSyncUI();
  _loadFromServer();
}
