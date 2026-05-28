// ─── CLOUDINARY (fotos e vídeos) ──────────────────────────────
const CLOUDINARY_CLOUD  = 'dvloudsbh';
const CLOUDINARY_PRESET = 'reforma_uploads';

// ─── FIREBASE (sync em tempo real) ────────────────────────────
// Cole aqui o firebaseConfig após criar o projeto no Firebase:
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCfdXfGapGJMq0839etYCyifbEJJ3C0uvM",
  authDomain: "reforma-casa-nova-131e4.firebaseapp.com",
  projectId: "reforma-casa-nova-131e4",
  storageBucket: "reforma-casa-nova-131e4.firebasestorage.app",
  messagingSenderId: "342926095105",
  appId: "1:342926095105:web:b482f455c7c42b6db2a100"
};

let db = null;
if (FIREBASE_CONFIG && typeof firebase !== 'undefined') {
  try { firebase.initializeApp(FIREBASE_CONFIG); db = firebase.firestore(); }
  catch(e) { console.warn('Firebase init error', e); }
}

// ─── MODO VISUALIZAÇÃO ────────────────────────────────────────
// Arquiteta acessa: URL + ?view   (ex: vma95.github.io/reforma-casa-nova?view)
const VIEW_MODE = new URLSearchParams(window.location.search).has('view');

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

let state       = { rooms: [], data: {} };
let currentRoom = null;
let selectedEmoji = EMOJIS[0];
let nextId      = 1;

// ─── PERSISTÊNCIA ─────────────────────────────────────────────
function save() {
  if (VIEW_MODE) return;
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

  const list = document.getElementById('room-list');

  if (state.rooms.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🏠</span>
        ${VIEW_MODE
          ? 'Nenhum lugar cadastrado ainda.'
          : 'Nenhum lugar cadastrado ainda.<br>Adicione o primeiro cômodo abaixo.'}
      </div>
      ${VIEW_MODE ? '' : `<button class="btn-add-room" onclick="openAddRoom()"><span class="plus">+</span> Novo lugar</button>`}`;
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
        ${VIEW_MODE ? '' : `<button class="btn-card-action btn-card-danger" onclick="askDeleteRoom('${r.id}')" aria-label="excluir ${escHtml(r.name)}">✕</button>`}
      </div>`;
  }).join('');

  if (!VIEW_MODE) {
    html += `<button class="btn-add-room" onclick="openAddRoom()"><span class="plus">+</span> Novo lugar</button>`;
  }

  list.innerHTML = html;
}

// ─── CÔMODO ───────────────────────────────────────────────────
function openRoom(id) {
  currentRoom = id;
  const room  = state.rooms.find(r => r.id === id);
  document.getElementById('room-title').textContent = room.icon + '  ' + room.name;

  const addBtn = document.getElementById('room-add-btn');
  if (addBtn) addBtn.style.display = VIEW_MODE ? 'none' : '';

  renderDemands();
  showScreen('room');
}

function renderDemands() {
  const list    = document.getElementById('demand-list');
  const demands = state.data[currentRoom] || [];

  if (demands.length === 0) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">📋</span>${
      VIEW_MODE ? 'Nenhuma demanda neste cômodo.' : 'Nenhuma demanda ainda.<br>Toque no + para adicionar.'
    }</div>`;
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
      mediaHtml = `<div class="${cls}">` + items.map((m, idx) => {
        const key = escHtml(m.url);
        if (m.type === 'video') {
          return `<div class="media-wrap" onclick="openLightbox('${key}','video')">
            <video src="${key}" class="demand-media-item" playsinline muted></video>
            <div class="play-overlay">▶</div>
          </div>`;
        }
        return `<img src="${key}" class="demand-media-item" alt="" loading="lazy" onclick="openLightbox('${key}','image')" style="cursor:pointer">`;
      }).join('') + '</div>';
    }

    return `
      <div class="demand-card">
        <div class="demand-header">
          <div class="demand-title">${escHtml(d.title)}</div>
          ${VIEW_MODE ? '' : `
            <div class="card-actions">
              <button class="btn-card-action" onclick="openEditDemand(${d.id})" aria-label="editar">✎</button>
              <button class="btn-card-action btn-card-danger" onclick="askDeleteDemand(${d.id})" aria-label="excluir">✕</button>
            </div>`}
        </div>
        ${d.desc ? `<div class="demand-desc">${escHtml(d.desc)}</div>` : ''}
        ${mediaHtml}
        <div class="demand-meta">📅 ${d.date}</div>
      </div>`;
  }).join('');
}

// ─── ADICIONAR / EDITAR DEMANDA ───────────────────────────────
let uploadedMedia    = [];
let isUploading      = false;
let editingDemandId  = null;

function openAddDemand() {
  if (VIEW_MODE) return;
  editingDemandId = null;
  document.getElementById('demand-form-title').textContent = 'Nova demanda';
  document.getElementById('demand-save-btn').textContent   = 'Salvar demanda';
  document.getElementById('inp-title').value = '';
  document.getElementById('inp-desc').value  = '';
  uploadedMedia = [];
  isUploading   = false;
  renderMediaArea();
  showScreen('add-demand');
}

function openEditDemand(id) {
  if (VIEW_MODE) return;
  const demand = (state.data[currentRoom] || []).find(d => d.id === id);
  if (!demand) return;

  editingDemandId = id;
  document.getElementById('demand-form-title').textContent = 'Editar demanda';
  document.getElementById('demand-save-btn').textContent   = 'Salvar alterações';
  document.getElementById('inp-title').value = demand.title;
  document.getElementById('inp-desc').value  = demand.desc || '';

  // Pré-popula com mídia existente (compatível com formato antigo)
  const items = [...(demand.media || [])];
  if (demand.photo && !items.find(m => m.url === demand.photo)) items.unshift({ url: demand.photo, type: 'image' });
  if (demand.video && !items.find(m => m.url === demand.video)) items.push({ url: demand.video, type: 'video' });
  uploadedMedia = items;

  isUploading = false;
  renderMediaArea();
  showScreen('add-demand');
}

function cancelDemandForm() {
  editingDemandId = null;
  showScreen('room');
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
    const res  = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`,
      { method: 'POST', body: formData }
    );
    const data = await res.json();
    if (data.secure_url) {
      uploadedMedia.push({ url: data.secure_url, type: resourceType });
    }
  } catch(e) { /* silencioso */ }

  isUploading = false;
  renderMediaArea();
}

function saveDemand() {
  if (VIEW_MODE) return;
  const title = document.getElementById('inp-title').value.trim();
  const desc  = document.getElementById('inp-desc').value.trim();
  if (!title)      { document.getElementById('inp-title').focus(); return; }
  if (isUploading) return;

  if (!state.data[currentRoom]) state.data[currentRoom] = [];

  if (editingDemandId !== null) {
    const idx = state.data[currentRoom].findIndex(d => d.id === editingDemandId);
    if (idx !== -1) {
      state.data[currentRoom][idx] = {
        ...state.data[currentRoom][idx],
        title, desc,
        media: [...uploadedMedia],
        photo: null,
        video: null
      };
    }
    editingDemandId = null;
  } else {
    const today = new Date();
    const date  = String(today.getDate()).padStart(2,'0') + '/' +
                  String(today.getMonth()+1).padStart(2,'0') + '/' +
                  today.getFullYear();
    state.data[currentRoom].push({ id: nextId++, title, desc, media: [...uploadedMedia], date });
  }

  save();
  renderDemands();
  renderHome();
  showScreen('room');
}

// ─── EXCLUSÃO ─────────────────────────────────────────────────
function askDeleteDemand(id) {
  if (VIEW_MODE) return;
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
  if (VIEW_MODE) return;
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
  if (VIEW_MODE) return;
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
  if (VIEW_MODE) return;
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
  const now       = new Date();
  const dateStr   = String(now.getDate()).padStart(2,'0') + '/' +
                    String(now.getMonth()+1).padStart(2,'0') + '/' +
                    now.getFullYear();

  let html = `
    <div class="report-doc">
      <div class="report-doc-header">
        <div class="report-doc-title">Reforma Casa Nova</div>
        <div class="report-doc-meta">Relatório de demandas · ${dateStr}</div>
        <div class="report-doc-divider"></div>
      </div>`;

  if (total === 0) {
    html += `<div class="empty-state"><span class="empty-icon">📋</span>Adicione demandas para gerar o relatório.</div>`;
    html += `</div>`;
    container.innerHTML = html;
    return;
  }

  state.rooms.forEach(r => {
    const demands = state.data[r.id] || [];
    if (!demands.length) return;

    html += `<div class="report-section">
      <div class="report-section-title">${r.icon} ${escHtml(r.name)}</div>`;

    demands.forEach((d, i) => {
      const items  = [...(d.media || [])];
      if (d.photo && !items.find(m => m.url === d.photo)) items.unshift({ url: d.photo, type: 'image' });
      const images = items.filter(m => m.type === 'image');

      let photosHtml = '';
      if (images.length === 1) {
        photosHtml = `<div class="report-photos-full">
          <img src="${escHtml(images[0].url)}" class="report-photo-full" alt="" loading="lazy">
        </div>`;
      } else if (images.length > 1) {
        photosHtml = `<div class="report-photos-grid">` +
          images.map(m => `<img src="${escHtml(m.url)}" class="report-photo-grid" alt="" loading="lazy">`).join('') +
          `</div>`;
      }

      html += `<div class="report-demand-block${i > 0 ? ' has-border' : ''}">
        <div class="report-demand-row">
          <span class="report-demand-num">${i + 1}</span>
          <div class="report-demand-body">
            <div class="report-demand-name">${escHtml(d.title)}</div>
            ${d.desc ? `<div class="report-demand-obs">${escHtml(d.desc)}</div>` : ''}
            ${photosHtml}
          </div>
          <span class="report-demand-date">${d.date}</span>
        </div>
      </div>`;
    });

    html += `</div>`;
  });

  html += `</div>`;

  if (!VIEW_MODE) {
    html += `<div class="export-hint">
      <strong>Exportar como PDF</strong>
      Toque no botão ↓ acima → "Imprimir" → salvar como PDF → enviar para a arquiteta.
    </div>`;
  }

  container.innerHTML = html;
}

function exportReport() { window.print(); }

// ─── LIGHTBOX ─────────────────────────────────────────────────
function openLightbox(url, type) {
  const content = document.getElementById('lightbox-content');
  content.innerHTML = type === 'video'
    ? `<video src="${url}" class="lightbox-media" controls autoplay playsinline></video>`
    : `<img src="${url}" class="lightbox-media" alt="">`;
  document.getElementById('lightbox').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeLightbox(e) {
  if (e && e.target === document.getElementById('lightbox-content')) return;
  if (e && e.target.closest('.lightbox-content')) return;
  const lb = document.getElementById('lightbox');
  lb.style.display = 'none';
  document.getElementById('lightbox-content').innerHTML = '';
  document.body.style.overflow = '';
}

// ─── UTILITÁRIOS ──────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── INIT ─────────────────────────────────────────────────────
if (VIEW_MODE) document.body.classList.add('view-mode');

if (db) {
  db.collection('reforma').doc('main').onSnapshot(
    doc => {
      if (doc.exists) {
        const d = doc.data();
        state  = d.state  || { rooms: [], data: {} };
        nextId = d.nextId || 1;
        if (!VIEW_MODE) localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, nextId }));
      } else if (!VIEW_MODE) {
        loadLocal();
        if (state.rooms.length > 0) save();
      }
      refreshUI();
    },
    err => { console.warn('Firebase error:', err); loadLocal(); refreshUI(); }
  );
} else {
  loadLocal();
  refreshUI();
}

renderMediaArea();
