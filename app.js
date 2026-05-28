// ─── CLOUDINARY ───────────────────────────────────────────────
const CLOUDINARY_CLOUD = 'dvloudsbh';
const CLOUDINARY_PRESET = 'reforma_uploads';

// ─── FIREBASE (sync entre dispositivos) ───────────────────────
// Para sincronizar celular ↔ PC, siga o README e cole sua config aqui:
const FIREBASE_CONFIG = null;
// Exemplo do que colocar:
// const FIREBASE_CONFIG = {
//   apiKey: "AIza...",
//   authDomain: "meu-projeto.firebaseapp.com",
//   projectId: "meu-projeto",
//   storageBucket: "meu-projeto.appspot.com",
//   messagingSenderId: "123456789",
//   appId: "1:123456789:web:abc123"
// };

let db = null;
if (FIREBASE_CONFIG && typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
  } catch(e) { console.warn('Firebase init error', e); }
}

// ─── ESTADO ───────────────────────────────────────────────────
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

let state = { rooms: [], data: {} };
let currentRoom = null;
let selectedEmoji = EMOJIS[0];
let nextId = 1;

// ─── PERSISTÊNCIA ─────────────────────────────────────────────
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, nextId }));
  if (db) {
    db.collection('reforma').doc('main').set({ state, nextId })
      .catch(e => console.warn('Firebase save error', e));
  }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = parsed.state || { rooms: [], data: {} };
      nextId = parsed.nextId || 1;
    }
  } catch(e) {
    state = { rooms: [], data: {} };
  }
}

// ─── NAVEGAÇÃO ────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  ['home','report'].forEach(t => {
    const el = document.getElementById('nav-' + t);
    if (el) el.classList.toggle('active', t === name);
  });
}

function goTab(name) {
  if (name === 'report') renderReport();
  if (name === 'home') renderHome();
  showScreen(name);
}

// ─── HOME ─────────────────────────────────────────────────────
function renderHome() {
  const total = state.rooms.reduce((s, r) => s + (state.data[r.id] || []).length, 0);
  const syncBadge = db ? ' · 🔄 sincronizado' : '';
  document.getElementById('home-sub').textContent =
    (total === 0 ? 'nenhuma demanda ainda' :
    total === 1 ? '1 demanda cadastrada' :
    `${total} demandas cadastradas`) + syncBadge;

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

function renderDemands() {
  const list = document.getElementById('demand-list');
  const demands = state.data[currentRoom] || [];
  if (demands.length === 0) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">📋</span>Nenhuma demanda ainda.<br>Toque no + para adicionar.</div>`;
    return;
  }
  list.innerHTML = demands.map(d => {
    // Suporta formato antigo (photo/video) e novo (media array)
    const items = [...(d.media || [])];
    if (d.photo && !items.find(m => m.url === d.photo)) items.unshift({ url: d.photo, type: 'image' });
    if (d.video && !items.find(m => m.url === d.video)) items.push({ url: d.video, type: 'video' });

    let mediaHtml = '';
    if (items.length > 0) {
      const cls = items.length === 1 ? 'demand-media-grid single' : 'demand-media-grid';
      mediaHtml = `<div class="${cls}">` + items.map(m =>
        m.type === 'video'
          ? `<video src="${escHtml(m.url)}" class="demand-media-item" controls playsinline></video>`
          : `<img src="${escHtml(m.url)}" class="demand-media-item" alt="" loading="lazy">`
      ).join('') + '</div>';
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
let isUploading = false;

function openAddDemand() {
  document.getElementById('inp-title').value = '';
  document.getElementById('inp-desc').value = '';
  uploadedMedia = [];
  isUploading = false;
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
        ? `<video src="${m.url}" class="media-thumb"></video>`
        : `<img src="${m.url}" class="media-thumb" alt="">`;
      html += `<div class="media-thumb-wrap">${thumb}<button class="btn-remove-media" onclick="removeMedia(${i})">✕</button></div>`;
    });
    html += '</div>';
  }

  if (isUploading) {
    html += `<div class="upload-loading"><span class="spinner"></span> Enviando…</div>`;
  } else if (uploadedMedia.length === 0) {
    html += `
      <label class="upload-trigger" for="photo-file-input">
        <span class="upload-icon">📸</span>
        <span>Toque para adicionar foto ou vídeo</span>
        <span class="upload-hint">JPG, PNG, HEIC ou MP4</span>
      </label>`;
  } else {
    html += `<label class="upload-add-more" for="photo-file-input">+ Adicionar outra foto ou vídeo</label>`;
  }

  if (!isUploading) {
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
  const isVideo = file.type.startsWith('video/');

  isUploading = true;
  renderMediaArea();

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);

    const resourceType = isVideo ? 'video' : 'image';
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.secure_url) {
      uploadedMedia.push({ url: data.secure_url, type: resourceType });
    }
  } catch(e) {
    // silently fail, user can try again
  }

  isUploading = false;
  renderMediaArea();
}

function saveDemand() {
  const title = document.getElementById('inp-title').value.trim();
  const desc = document.getElementById('inp-desc').value.trim();
  if (!title) { document.getElementById('inp-title').focus(); return; }
  if (isUploading) return;

  const today = new Date();
  const date = String(today.getDate()).padStart(2,'0') + '/' +
               String(today.getMonth()+1).padStart(2,'0') + '/' +
               today.getFullYear();

  if (!state.data[currentRoom]) state.data[currentRoom] = [];
  state.data[currentRoom].push({
    id: nextId++, title, desc,
    media: [...uploadedMedia],
    date
  });
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
      save();
      renderDemands();
      renderHome();
    }
  );
}

function askDeleteRoom(id) {
  const room = state.rooms.find(r => r.id === id);
  const count = (state.data[id] || []).length;
  const msg = count > 0
    ? `Excluir "${room.name}" e ${count} demanda${count !== 1 ? 's' : ''} dentro dele? Essa ação não pode ser desfeita.`
    : `Excluir "${room.name}"? Essa ação não pode ser desfeita.`;
  openConfirm('Excluir lugar', msg, () => {
    state.rooms = state.rooms.filter(r => r.id !== id);
    delete state.data[id];
    save();
    renderHome();
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
function openModal(id) {
  document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

function overlayClick(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}

function openConfirm(title, msg, cb) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-btn').onclick = () => { closeModal('modal-confirm'); cb(); };
  openModal('modal-confirm');
}

// ─── RELATÓRIO ────────────────────────────────────────────────
function renderReport() {
  const total = state.rooms.reduce((s, r) => s + (state.data[r.id] || []).length, 0);
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
    if (demands.length === 0) return;
    html += `<div class="report-room">
      <div class="report-room-title">${r.icon}  ${escHtml(r.name)}</div>`;
    demands.forEach(d => {
      html += `<div class="report-row">
        <span>${escHtml(d.title)}</span>
        <span>${d.date}</span>
      </div>`;
    });
    html += `</div>`;
  });

  html += `<div class="export-area">
    <strong>Como compartilhar com a arquiteta</strong>
    Use o botão de compartilhar do seu navegador (Safari ou Chrome) → "Imprimir" → salvar como PDF.
    Ou tire um print da tela e envie por WhatsApp.
  </div>`;

  container.innerHTML = html;
}

function exportReport() {
  window.print();
}

// ─── UTILITÁRIOS ──────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ─── INIT ─────────────────────────────────────────────────────
function refreshUI() {
  renderHome();
  const activeId = document.querySelector('.screen.active')?.id;
  if (activeId === 'screen-room' && currentRoom) renderDemands();
  if (activeId === 'screen-report') renderReport();
}

if (db) {
  db.collection('reforma').doc('main').onSnapshot(
    doc => {
      if (doc.exists) {
        const d = doc.data();
        state = d.state || { rooms: [], data: {} };
        nextId = d.nextId || 1;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, nextId }));
      } else {
        // Primeira vez com Firebase: migra dados do localStorage
        loadLocal();
        if (state.rooms.length > 0) {
          db.collection('reforma').doc('main').set({ state, nextId });
        }
      }
      refreshUI();
    },
    err => {
      console.warn('Firebase error:', err);
      loadLocal();
      refreshUI();
    }
  );
} else {
  loadLocal();
  refreshUI();
}

renderMediaArea();
