// ─── GOOGLE DRIVE CONFIG ──────────────────────────────────────
// Siga o README para obter seu Client ID e cole aqui:
const GOOGLE_CLIENT_ID = '689109501553-2qii7gq214e1ds0l7maogug0radm6afr.apps.googleusercontent.com';
const DRIVE_FOLDER     = 'Reforma Casa Nova';
const DRIVE_SCOPE      = 'https://www.googleapis.com/auth/drive.file';

// ─── ESTADO GLOBAL ────────────────────────────────────────────
const STORAGE_KEY = 'reforma_casa_nova_v1';

const EMOJIS = [
  '🍳','🚿','🛋️','🛏️','🧺','🪴','🚗','🏊',
  '📚','🖥️','🪟','🚪','🛁','🔨','💡','🎸',
  '🌿','🍷','🧘','🏡','🪑','🛠️','🎨','🧱',
  '🪞','🏋️','🧳','🌳'
];
const BG_COLORS = [
  '#F0EDE6','#E8EFF0','#EEF0E8','#F0E8EE',
  '#E8EEF0','#F0EAE8','#EBF0E8','#F0EDE8'
];

let state       = { rooms: [], data: {} };
let currentRoom = null;
let selectedEmoji = EMOJIS[0];
let nextId      = 1;

// ─── DRIVE: AUTH ──────────────────────────────────────────────
let _token       = null;
let _tokenClient = null;
let _folderId    = null;
let _stateFileId = null;
let _lastMod     = null;
let _syncTimer   = null;

function driveReady() {
  return GOOGLE_CLIENT_ID !== 'SEU_CLIENT_ID.apps.googleusercontent.com'
      && typeof google !== 'undefined';
}

function isConnected() { return !!_token; }

function getToken(forcePicker = false) {
  return new Promise((resolve, reject) => {
    if (!driveReady()) { reject(new Error('Client ID não configurado')); return; }
    if (_token)        { resolve(_token); return; }

    if (!_tokenClient) {
      _tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPE,
        hint: localStorage.getItem('g_hint') || '',
        callback: r => {
          if (r.access_token) {
            _token = r.access_token;
            setTimeout(() => { _token = null; }, (r.expires_in - 60) * 1000);
            resolve(_token);
          } else {
            reject(new Error('Auth cancelado'));
          }
        }
      });
    }
    _tokenClient.requestAccessToken({ prompt: forcePicker ? 'select_account' : '' });
  });
}

// ─── DRIVE: OPERAÇÕES ─────────────────────────────────────────
async function driveRequest(method, path, { params = {}, json, form } = {}) {
  const url = new URL('https://www.googleapis.com' + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}` };
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : form
  });
  if (!res.ok) throw new Error(`Drive ${method} ${path} → ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function ensureFolder() {
  if (_folderId) return _folderId;
  const q = `name='${DRIVE_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await driveRequest('GET', '/drive/v3/files', { params: { q, fields: 'files(id)' } });
  if (res.files?.length) { _folderId = res.files[0].id; return _folderId; }
  const cr = await driveRequest('POST', '/drive/v3/files', {
    params: { fields: 'id' },
    json: { name: DRIVE_FOLDER, mimeType: 'application/vnd.google-apps.folder' }
  });
  _folderId = cr.id;
  return _folderId;
}

async function makePublic(fileId) {
  await driveRequest('POST', `/drive/v3/files/${fileId}/permissions`, {
    json: { role: 'reader', type: 'anyone' }
  });
}

async function uploadFile(file) {
  const token = await getToken();
  const folderId = await ensureFolder();
  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  const form = new FormData();
  form.append('metadata', new Blob(
    [JSON.stringify({ name: safeName, parents: [folderId] })],
    { type: 'application/json' }
  ));
  form.append('file', file);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
  );
  if (!res.ok) throw new Error(`Upload falhou: ${res.status}`);
  const { id } = await res.json();
  await makePublic(id);

  const isVideo = file.type.startsWith('video/');
  return {
    url: isVideo
      ? `https://drive.google.com/file/d/${id}/preview`
      : `https://drive.google.com/uc?id=${id}&export=view`,
    type: isVideo ? 'video' : 'image',
    driveId: id
  };
}

// ─── DRIVE: SYNC DE ESTADO ────────────────────────────────────
async function saveStateToDrive() {
  if (!isConnected()) return;
  const token  = _token;
  const folder = await ensureFolder();
  const body   = JSON.stringify({ state, nextId });

  if (_stateFileId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${_stateFileId}?uploadType=media&fields=modifiedTime`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body }
    );
    const d = await res.json();
    _lastMod = d.modifiedTime;
  } else {
    const form = new FormData();
    form.append('metadata', new Blob(
      [JSON.stringify({ name: 'state.json', parents: [folder] })],
      { type: 'application/json' }
    ));
    form.append('file', new Blob([body], { type: 'application/json' }));
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime',
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
    );
    const d = await res.json();
    _stateFileId = d.id;
    _lastMod     = d.modifiedTime;
  }
}

async function loadStateFromDrive() {
  const folder = await ensureFolder();
  const q      = `name='state.json' and '${folder}' in parents and trashed=false`;
  const res    = await driveRequest('GET', '/drive/v3/files', {
    params: { q, fields: 'files(id,modifiedTime)' }
  });

  if (!res.files?.length) {
    // Primeira vez no Drive: migra dados locais
    loadLocal();
    if (state.rooms.length > 0 || nextId > 1) await saveStateToDrive();
    return;
  }

  const file   = res.files[0];
  _stateFileId = file.id;
  _lastMod     = file.modifiedTime;

  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers: { Authorization: `Bearer ${_token}` } }
  );
  const d = await r.json();
  state   = d.state  || { rooms: [], data: {} };
  nextId  = d.nextId || 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, nextId }));
}

async function pollDrive() {
  if (!isConnected() || !_stateFileId) return;
  try {
    const res = await driveRequest('GET', `/drive/v3/files/${_stateFileId}`, {
      params: { fields: 'modifiedTime' }
    });
    if (res.modifiedTime && res.modifiedTime !== _lastMod) {
      _lastMod  = res.modifiedTime;
      const r   = await fetch(
        `https://www.googleapis.com/drive/v3/files/${_stateFileId}?alt=media`,
        { headers: { Authorization: `Bearer ${_token}` } }
      );
      const d   = await r.json();
      state     = d.state  || { rooms: [], data: {} };
      nextId    = d.nextId || 1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, nextId }));
      refreshUI();
    }
  } catch(e) { /* silencioso */ }
}

function startPolling() {
  if (_syncTimer) clearInterval(_syncTimer);
  _syncTimer = setInterval(pollDrive, 30000); // checa a cada 30s
}

// ─── DRIVE: CONNECT ───────────────────────────────────────────
async function connectDrive() {
  const btn = document.getElementById('drive-status');
  if (btn) { btn.textContent = '⏳ Conectando…'; btn.disabled = true; }
  try {
    await getToken(true);
    localStorage.setItem('g_hint', 'connected');
    await loadStateFromDrive();
    updateDriveStatus(true);
    startPolling();
    refreshUI();
  } catch(e) {
    console.warn('Drive error:', e);
    if (btn) { btn.textContent = '🔗 Conectar Drive'; btn.disabled = false; }
  }
}

async function trySilentConnect() {
  if (!driveReady() || !localStorage.getItem('g_hint')) return;
  try {
    await getToken(false);         // tentativa silenciosa
    await loadStateFromDrive();
    updateDriveStatus(true);
    startPolling();
  } catch(e) { /* silencioso — usuário precisa clicar */ }
}

function updateDriveStatus(connected) {
  const btn = document.getElementById('drive-status');
  if (!btn) return;
  btn.textContent  = connected ? '✅ Drive' : '🔗 Conectar Drive';
  btn.disabled     = false;
  btn.classList.toggle('connected', connected);
}

// ─── PERSISTÊNCIA ─────────────────────────────────────────────
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, nextId }));
  saveStateToDrive().catch(() => {});
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      state  = p.state  || { rooms: [], data: {} };
      nextId = p.nextId || 1;
    }
  } catch(e) { state = { rooms: [], data: {} }; }
}

// ─── NAVEGAÇÃO ────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  ['home', 'report'].forEach(t => {
    const el = document.getElementById('nav-' + t);
    if (el) el.classList.toggle('active', t === name);
  });
}

function goTab(name) {
  if (name === 'report') renderReport();
  if (name === 'home')   renderHome();
  showScreen(name);
}

function refreshUI() {
  renderHome();
  const id = document.querySelector('.screen.active')?.id;
  if (id === 'screen-room'   && currentRoom) renderDemands();
  if (id === 'screen-report')               renderReport();
}

// ─── HOME ─────────────────────────────────────────────────────
function renderHome() {
  const total = state.rooms.reduce((s, r) => s + (state.data[r.id] || []).length, 0);
  document.getElementById('home-sub').textContent =
    total === 0 ? 'nenhuma demanda ainda' :
    total === 1 ? '1 demanda cadastrada' :
    `${total} demandas cadastradas`;

  updateDriveStatus(isConnected());

  const list = document.getElementById('room-list');
  if (state.rooms.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🏠</span>
        Nenhum lugar cadastrado ainda.<br>Adicione o primeiro cômodo abaixo.
      </div>
      <button class="btn-add-room" onclick="openAddRoom()">
        <span class="plus">+</span> Novo lugar
      </button>`;
    return;
  }

  let html = state.rooms.map(r => {
    const count = (state.data[r.id] || []).length;
    return `
      <div class="room-card">
        <div class="room-icon-wrap" style="background:${r.bg};" onclick="openRoom('${r.id}')">${r.icon}</div>
        <div class="room-info" onclick="openRoom('${r.id}')">
          <div class="room-name">${escHtml(r.name)}</div>
          <div class="room-count">${count === 0 ? 'Nenhuma demanda' : count + ' demanda' + (count !== 1 ? 's' : '')}</div>
        </div>
        <button class="btn-room-delete" onclick="askDeleteRoom('${r.id}')" aria-label="excluir ${escHtml(r.name)}">🗑</button>
      </div>`;
  }).join('');
  html += `<button class="btn-add-room" onclick="openAddRoom()"><span class="plus">+</span> Novo lugar</button>`;
  list.innerHTML = html;
}

// ─── CÔMODO ───────────────────────────────────────────────────
function openRoom(id) {
  currentRoom = id;
  const room = state.rooms.find(r => r.id === id);
  document.getElementById('room-title').textContent = room.icon + '  ' + room.name;
  renderDemands();
  showScreen('room');
}

function mediaTag(m) {
  if (m.type === 'video') {
    // Vídeos do Drive usam iframe; outros usam <video>
    if (m.url.includes('drive.google.com')) {
      return `<iframe src="${escHtml(m.url)}" class="demand-media-item drive-video" allowfullscreen frameborder="0"></iframe>`;
    }
    return `<video src="${escHtml(m.url)}" class="demand-media-item" controls playsinline></video>`;
  }
  return `<img src="${escHtml(m.url)}" class="demand-media-item" alt="" loading="lazy">`;
}

function renderDemands() {
  const list    = document.getElementById('demand-list');
  const demands = state.data[currentRoom] || [];
  if (demands.length === 0) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">📋</span>Nenhuma demanda ainda.<br>Toque no + para adicionar.</div>`;
    return;
  }
  list.innerHTML = demands.map(d => {
    // Compatível com formato antigo (photo/video) e novo (media array)
    const items = [...(d.media || [])];
    if (d.photo && !items.find(m => m.url === d.photo)) items.unshift({ url: d.photo, type: 'image' });
    if (d.video && !items.find(m => m.url === d.video)) items.push({ url: d.video, type: 'video' });

    let mediaHtml = '';
    if (items.length > 0) {
      const cls = items.length === 1 ? 'demand-media-grid single' : 'demand-media-grid';
      mediaHtml = `<div class="${cls}">` + items.map(mediaTag).join('') + '</div>';
    }

    return `
      <div class="demand-card">
        <div class="demand-header">
          <div class="demand-title">${escHtml(d.title)}</div>
          <button class="btn-demand-delete" onclick="askDeleteDemand(${d.id})" aria-label="excluir">🗑</button>
        </div>
        ${d.desc ? `<div class="demand-desc">${escHtml(d.desc)}</div>` : ''}
        ${mediaHtml}
        <div class="demand-meta">📅 ${d.date}</div>
      </div>`;
  }).join('');
}

// ─── ADICIONAR DEMANDA ────────────────────────────────────────
let uploadedMedia = [];
let isUploading   = false;

function openAddDemand() {
  document.getElementById('inp-title').value = '';
  document.getElementById('inp-desc').value  = '';
  uploadedMedia = [];
  isUploading   = false;
  renderMediaArea();
  showScreen('add-demand');
}

function renderMediaArea() {
  const area = document.getElementById('photo-upload-area');
  if (!area) return;
  let html = '';

  if (uploadedMedia.length > 0) {
    html += '<div class="media-preview-grid">';
    uploadedMedia.forEach((m, i) => {
      const thumb = m.type === 'video'
        ? `<div class="media-thumb video-ph">🎥</div>`
        : `<img src="${m.url}" class="media-thumb" alt="">`;
      html += `<div class="media-thumb-wrap">${thumb}<button class="btn-remove-media" onclick="removeMedia(${i})">✕</button></div>`;
    });
    html += '</div>';
  }

  if (isUploading) {
    html += `<div class="upload-loading"><span class="spinner"></span> Enviando para o Drive…</div>`;
  } else if (uploadedMedia.length === 0) {
    if (!isConnected() && driveReady()) {
      html += `<div class="drive-warn">
        <span>📁 Conecte o Google Drive para salvar fotos</span>
        <button onclick="connectDrive()">Conectar</button>
      </div>`;
    } else {
      html += `
        <label class="upload-trigger" for="photo-file-input">
          <span class="upload-icon">📸</span>
          <span>Toque para adicionar foto ou vídeo</span>
          <span class="upload-hint">JPG, PNG, HEIC ou MP4</span>
        </label>`;
    }
  } else {
    html += `<label class="upload-add-more" for="photo-file-input">+ Adicionar outra foto ou vídeo</label>`;
  }

  if (!isUploading && (isConnected() || uploadedMedia.length > 0)) {
    html += `<input type="file" id="photo-file-input" accept="image/*,video/*" style="display:none" onchange="handleFileSelect(this)">`;
  }

  area.innerHTML = html;
}

function removeMedia(index) {
  uploadedMedia.splice(index, 1);
  renderMediaArea();
}

async function handleFileSelect(input) {
  const file = input.files[0];
  if (!file) return;

  isUploading = true;
  renderMediaArea();

  try {
    const media = await uploadFile(file);
    uploadedMedia.push(media);
  } catch(e) {
    console.warn('Upload error:', e);
  }

  isUploading = false;
  renderMediaArea();
}

function saveDemand() {
  const title = document.getElementById('inp-title').value.trim();
  const desc  = document.getElementById('inp-desc').value.trim();
  if (!title)       { document.getElementById('inp-title').focus(); return; }
  if (isUploading)  return;

  const today = new Date();
  const date  = String(today.getDate()).padStart(2,'0') + '/' +
                String(today.getMonth()+1).padStart(2,'0') + '/' +
                today.getFullYear();

  if (!state.data[currentRoom]) state.data[currentRoom] = [];
  state.data[currentRoom].push({ id: nextId++, title, desc, media: [...uploadedMedia], date });
  save();
  renderDemands();
  renderHome();
  showScreen('room');
}

// ─── EXCLUSÃO ─────────────────────────────────────────────────
function askDeleteDemand(id) {
  openConfirm(
    'Excluir demanda',
    'Tem certeza que quer excluir essa demanda? Essa ação não pode ser desfeita.',
    () => {
      state.data[currentRoom] = (state.data[currentRoom] || []).filter(d => d.id !== id);
      save(); renderDemands(); renderHome();
    }
  );
}

function askDeleteRoom(id) {
  const room  = state.rooms.find(r => r.id === id);
  const count = (state.data[id] || []).length;
  const msg   = count > 0
    ? `Excluir "${room.name}" e ${count} demanda${count !== 1 ? 's' : ''} dentro dele? Essa ação não pode ser desfeita.`
    : `Excluir "${room.name}"? Essa ação não pode ser desfeita.`;
  openConfirm('Excluir lugar', msg, () => {
    state.rooms = state.rooms.filter(r => r.id !== id);
    delete state.data[id];
    save(); renderHome();
  });
}

// ─── NOVO CÔMODO ──────────────────────────────────────────────
function openAddRoom() {
  selectedEmoji = EMOJIS[0];
  document.getElementById('room-name-inp').value = '';
  const grid = document.getElementById('emoji-grid');
  grid.innerHTML = EMOJIS.map((e, i) =>
    `<div class="emoji-opt${i === 0 ? ' selected' : ''}" onclick="selectEmoji('${e}', this)">${e}</div>`
  ).join('');
  openModal('modal-room');
  setTimeout(() => document.getElementById('room-name-inp').focus(), 50);
}

function selectEmoji(emoji, el) {
  selectedEmoji = emoji;
  document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}

function saveRoom() {
  const name = document.getElementById('room-name-inp').value.trim();
  if (!name) { document.getElementById('room-name-inp').focus(); return; }
  const id = 'room_' + Date.now();
  const bg = BG_COLORS[state.rooms.length % BG_COLORS.length];
  state.rooms.push({ id, name, icon: selectedEmoji, bg });
  state.data[id] = [];
  save();
  closeModal('modal-room');
  renderHome();
}

// ─── MODAL ────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function overlayClick(e, id) { if (e.target === document.getElementById(id)) closeModal(id); }

function openConfirm(title, msg, cb) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent   = msg;
  document.getElementById('confirm-btn').onclick = () => { closeModal('modal-confirm'); cb(); };
  openModal('modal-confirm');
}

// ─── RELATÓRIO ────────────────────────────────────────────────
function renderReport() {
  const total     = state.rooms.reduce((s, r) => s + (state.data[r.id] || []).length, 0);
  const container = document.getElementById('report-content');

  let html = `<div class="report-header">
    ${total === 0 ? 'Nenhuma demanda cadastrada.' : `${total} demanda${total !== 1 ? 's' : ''} no total`}
  </div>`;

  if (total === 0) {
    html += `<div class="empty-state"><span class="empty-icon">📋</span>Adicione demandas para gerar o relatório.</div>`;
    container.innerHTML = html;
    return;
  }

  state.rooms.forEach(r => {
    const demands = state.data[r.id] || [];
    if (!demands.length) return;
    html += `<div class="report-room"><div class="report-room-title">${r.icon}  ${escHtml(r.name)}</div>`;
    demands.forEach(d => {
      html += `<div class="report-row"><span>${escHtml(d.title)}</span><span>${d.date}</span></div>`;
    });
    html += `</div>`;
  });

  html += `<div class="export-area">
    <strong>Como compartilhar com a arquiteta</strong>
    Use o botão de compartilhar do seu navegador → "Imprimir" → salvar como PDF.
  </div>`;

  container.innerHTML = html;
}

function exportReport() { window.print(); }

// ─── UTILITÁRIOS ──────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── INIT ─────────────────────────────────────────────────────
loadLocal();
refreshUI();
renderMediaArea();

// Tenta conectar silenciosamente se já conectou antes
window.addEventListener('load', () => trySilentConnect().then(refreshUI).catch(() => {}));
