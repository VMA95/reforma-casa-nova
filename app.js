// ─── CLOUDINARY ───────────────────────────────────────────────
const CLOUDINARY_CLOUD  = 'dvloudsbh';
const CLOUDINARY_PRESET = 'reforma_uploads';

// ─── FIREBASE ─────────────────────────────────────────────────
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
const VIEW_MODE = new URLSearchParams(window.location.search).has('view');

// ─── ESTADO ───────────────────────────────────────────────────
const STORAGE_KEY = 'reforma_casa_nova_v1';

const EMOJIS = [
  // Cômodos internos
  '🍳','🛋️','🛏️','🚿','🛁','🍽️','📚','🖥️',
  // Áreas especiais
  '🏋️','🎸','🍷','🪞','🧺','🧳','🎨','🪑',
  // Externos
  '🌳','🪴','🌿','🚗','🏊','🏡','🏗️','🪜',
  // Construção / reforma
  '🔨','🔧','⚡','💡','💧','🧱','🪵','🔑',
  // Sistemas / ambientes
  '🌡️','🔥','🪟','🚪','🛠️','🪣','🧹','🏠',
  // Gourmet / alimentação
  '🍖','🥩','🥂','☕','🫙','🍕',
  // Entretenimento
  '📺','🎮','🎯','🎱',
  // Kids / família
  '🧸','🧩','🛌','👶',
  // Bem-estar
  '🧖','🛀','🧘',
  // Jardim / externo
  '🌱','🌻','⛱️','🪨',
  // Outros ambientes
  '🐕','💼','🚽','🛖','🎪','🏺'
];

const EMOJI_LABELS = {
  '🍳':'Cozinha','🛋️':'Sala de estar','🛏️':'Quarto','🚿':'Banheiro',
  '🛁':'Banheiro','🍽️':'Sala de jantar','📚':'Biblioteca','🖥️':'Escritório',
  '🏋️':'Academia','🎸':'Sala de música','🍷':'Adega','🪞':'Closet',
  '🧺':'Lavanderia','🧳':'Depósito','🎨':'Ateliê','🪑':'Copa / sala',
  '🌳':'Jardim','🪴':'Varanda','🌿':'Área verde','🚗':'Garagem',
  '🏊':'Piscina','🏡':'Casa','🏗️':'Obra','🪜':'Área de serviço',
  '🔨':'Marcenaria','🔧':'Instalações','⚡':'Elétrica','💡':'Iluminação',
  '💧':'Hidráulica','🧱':'Alvenaria','🪵':'Madeira','🔑':'Entrada',
  '🌡️':'Climatização','🔥':'Aquecimento','🪟':'Janelas','🚪':'Portas',
  '🛠️':'Manutenção','🪣':'Limpeza','🧹':'Limpeza','🏠':'Geral',
  '🍖':'Área gourmet','🥩':'Churrasqueira','🥂':'Bar','☕':'Copa',
  '🫙':'Despensa','🍕':'Cozinha / gourmet',
  '📺':'Home theater','🎮':'Sala de jogos','🎯':'Sala de jogos','🎱':'Salão de jogos',
  '🧸':'Quarto infantil','🧩':'Brinquedoteca','🛌':'Quarto de hóspedes','👶':'Quarto de bebê',
  '🧖':'Sauna / spa','🛀':'Banheiro / spa','🧘':'Sala de meditação',
  '🌱':'Horta','🌻':'Jardim','⛱️':'Deck / área externa','🪨':'Jardim zen',
  '🐕':'Espaço pet','💼':'Escritório','🚽':'Lavabo','🛖':'Edícula',
  '🎪':'Salão de festas','🏺':'Sala de estar'
};
const BG_COLORS = [
  '#F0EDE6','#E8EFF0','#EEF0E8','#F0E8EE',
  '#E8EEF0','#F0EAE8','#EBF0E8','#F0EDE8'
];

let state         = { rooms: [], data: {}, items: [] };
let currentRoom   = null;
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
      const p   = JSON.parse(raw);
      state     = p.state  || { rooms: [], data: {}, items: [] };
      if (!state.items) state.items = [];
      nextId    = p.nextId || 1;
    }
  } catch(e) { state = { rooms: [], data: {}, items: [] }; }
}

// ─── NAVEGAÇÃO ────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

function goSection(name) {
  if (name === 'home')  renderHome();
  if (name === 'items') renderItems();
  showScreen(name);
}

function refreshUI() {
  renderLanding();
  const id = document.querySelector('.screen.active')?.id;
  if (id === 'screen-home')                          renderHome();
  if (id === 'screen-room'         && currentRoom)   renderDemands();
  if (id === 'screen-items')                         renderItems();
  if (id === 'screen-items-group'  && currentItemGroup) renderItemGroup();
}

// ─── LANDING ──────────────────────────────────────────────────
function renderLanding() {
  const totalRooms   = state.rooms.length;
  const totalDemands = state.rooms.reduce((s, r) => s + (state.data[r.id] || []).length, 0);
  const doneDemands  = state.rooms.reduce((s, r) => s + (state.data[r.id] || []).filter(d => d.done).length, 0);
  const totalItems   = (state.items || []).length;
  const ownedItems   = (state.items || []).filter(i => i.owned).length;

  const landingSub = document.getElementById('landing-sub');
  if (landingSub) landingSub.textContent = db ? '🔄 sincronizado' : '';

  const roomsSub = document.getElementById('landing-rooms-sub');
  if (roomsSub) {
    roomsSub.textContent = totalDemands === 0
      ? 'Nenhuma demanda ainda'
      : `${doneDemands} de ${totalDemands} concluídas`;
  }

  const itemsSub = document.getElementById('landing-items-sub');
  if (itemsSub) {
    itemsSub.textContent = totalItems === 0
      ? 'Nenhum item cadastrado ainda'
      : `${ownedItems} tenho · ${totalItems - ownedItems} quero`;
  }
}

// ─── HOME (cômodos) ───────────────────────────────────────────
function renderHome() {
  const list = document.getElementById('room-list');
  if (state.rooms.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🏗️</span>
        Nenhum cômodo cadastrado ainda.<br>Adicione o primeiro abaixo.
      </div>
      ${VIEW_MODE ? '' : `<button class="btn-add-room" onclick="openAddRoom()"><span class="plus">+</span> Novo cômodo</button>`}`;
    return;
  }

  let html = state.rooms.map(r => {
    const demands   = state.data[r.id] || [];
    const count     = demands.length;
    const doneCount = demands.filter(d => d.done).length;
    const countLabel = count === 0 ? 'Nenhuma demanda' :
      doneCount === count ? `${count} de ${count} concluídas ✓` :
      doneCount > 0 ? `${doneCount} de ${count} concluídas` :
      count + ' demanda' + (count !== 1 ? 's' : '');
    return `
      <div class="room-card">
        <div class="room-icon-wrap" style="background:${r.bg};" onclick="openRoom('${r.id}')">${r.icon}</div>
        <div class="room-info" onclick="openRoom('${r.id}')">
          <div class="room-name">${escHtml(r.name)}</div>
          <div class="room-count">${countLabel}</div>
        </div>
        ${VIEW_MODE ? '' : `
          <div class="card-actions">
            <button class="btn-card-action" onclick="openEditRoom('${r.id}')" aria-label="editar ${escHtml(r.name)}">✎</button>
            <button class="btn-card-action btn-card-danger" onclick="askDeleteRoom('${r.id}')" aria-label="excluir ${escHtml(r.name)}">✕</button>
          </div>`}
      </div>`;
  }).join('');

  if (!VIEW_MODE) {
    html += `<button class="btn-add-room" onclick="openAddRoom()"><span class="plus">+</span> Novo cômodo</button>`;
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
    const items = [...(d.media || [])];
    if (d.photo && !items.find(m => m.url === d.photo)) items.unshift({ url: d.photo, type: 'image' });
    if (d.video && !items.find(m => m.url === d.video)) items.push({ url: d.video, type: 'video' });

    let mediaHtml = '';
    if (items.length > 0) {
      const cls = items.length === 1 ? 'demand-media-grid single' : 'demand-media-grid';
      mediaHtml = `<div class="${cls}">` + items.map(m => {
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
      <div class="demand-card${d.done ? ' demand-done' : ''}">
        <div class="demand-header">
          <button class="btn-check${d.done ? ' checked' : ''}"
            onclick="${VIEW_MODE ? '' : `toggleDemandDone(${d.id})`}"
            ${VIEW_MODE ? 'disabled' : ''}
            aria-label="${d.done ? 'desmarcar' : 'marcar como concluída'}">
            ${d.done ? '✓' : ''}
          </button>
          <div class="demand-title${d.done ? ' title-done' : ''}">${escHtml(d.title)}</div>
          ${VIEW_MODE ? '' : `
            <div class="card-actions">
              <button class="btn-card-action" onclick="openEditDemand(${d.id})" aria-label="editar">✎</button>
              <button class="btn-card-action btn-card-danger" onclick="askDeleteDemand(${d.id})" aria-label="excluir">✕</button>
            </div>`}
        </div>
        ${d.desc ? `<div class="demand-desc">${linkifyText(d.desc)}</div>` : ''}
        ${mediaHtml}
        <div class="demand-meta">📅 ${d.date}</div>
      </div>`;
  }).join('');
}

// ─── ADICIONAR / EDITAR DEMANDA ───────────────────────────────
let uploadedMedia   = [];
let isUploading     = false;
let editingDemandId = null;

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
  const items = [...(demand.media || [])];
  if (demand.photo && !items.find(m => m.url === demand.photo)) items.unshift({ url: demand.photo, type: 'image' });
  if (demand.video && !items.find(m => m.url === demand.video)) items.push({ url: demand.video, type: 'video' });
  uploadedMedia = items;
  isUploading   = false;
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
    html += `<label class="upload-trigger" for="photo-file-input">
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
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${isVideo ? 'video' : 'image'}/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.secure_url) uploadedMedia.push({ url: data.secure_url, type: isVideo ? 'video' : 'image' });
  } catch(e) {}
  isUploading = false;
  renderMediaArea();
}

function saveDemand() {
  if (VIEW_MODE) return;
  const title = document.getElementById('inp-title').value.trim();
  const desc  = document.getElementById('inp-desc').value.trim();
  if (!title) { document.getElementById('inp-title').focus(); return; }
  if (isUploading) return;
  if (!state.data[currentRoom]) state.data[currentRoom] = [];

  if (editingDemandId !== null) {
    const idx = state.data[currentRoom].findIndex(d => d.id === editingDemandId);
    if (idx !== -1) {
      state.data[currentRoom][idx] = { ...state.data[currentRoom][idx], title, desc, media: [...uploadedMedia], photo: null, video: null };
    }
    editingDemandId = null;
  } else {
    const today = new Date();
    const date  = String(today.getDate()).padStart(2,'0') + '/' + String(today.getMonth()+1).padStart(2,'0') + '/' + today.getFullYear();
    state.data[currentRoom].push({ id: nextId++, title, desc, media: [...uploadedMedia], date });
  }
  save(); renderDemands(); renderHome(); renderLanding(); showScreen('room');
}

// ─── CHECK (concluída) ────────────────────────────────────────
function toggleDemandDone(id) {
  if (VIEW_MODE) return;
  const demand = (state.data[currentRoom] || []).find(d => d.id === id);
  if (!demand) return;
  demand.done = !demand.done;
  save(); renderDemands(); renderLanding();
}

// ─── EXCLUSÃO DEMANDA ─────────────────────────────────────────
function askDeleteDemand(id) {
  if (VIEW_MODE) return;
  openConfirm('Excluir demanda', 'Tem certeza? Essa ação não pode ser desfeita.', () => {
    state.data[currentRoom] = (state.data[currentRoom] || []).filter(d => d.id !== id);
    save(); renderDemands(); renderLanding();
  });
}

function askDeleteRoom(id) {
  if (VIEW_MODE) return;
  const room  = state.rooms.find(r => r.id === id);
  const count = (state.data[id] || []).length;
  const msg   = count > 0
    ? `Excluir "${room.name}" e ${count} demanda${count !== 1 ? 's' : ''}? Não pode ser desfeito.`
    : `Excluir "${room.name}"? Não pode ser desfeito.`;
  openConfirm('Excluir cômodo', msg, () => {
    state.rooms = state.rooms.filter(r => r.id !== id);
    delete state.data[id];
    save(); renderHome(); renderLanding();
  });
}

// ─── NOVO / EDITAR CÔMODO ────────────────────────────────────
let editingRoomId = null;

function openAddRoom() {
  if (VIEW_MODE) return;
  editingRoomId = null;
  selectedEmoji = EMOJIS[0];
  document.getElementById('room-name-inp').value = '';
  document.getElementById('modal-room-title').textContent = 'Novo lugar';
  document.getElementById('room-save-btn').textContent = 'Criar';
  const grid = document.getElementById('emoji-grid');
  grid.innerHTML = EMOJIS.map((e, i) =>
    `<div class="emoji-opt${i === 0 ? ' selected' : ''}" onclick="selectEmoji('${e}', this)" title="${EMOJI_LABELS[e] || ''}">
      ${e}<span class="emoji-label">${EMOJI_LABELS[e] || ''}</span>
    </div>`
  ).join('');
  openModal('modal-room');
  setTimeout(() => document.getElementById('room-name-inp').focus(), 50);
}

function openEditRoom(id) {
  if (VIEW_MODE) return;
  const room = state.rooms.find(r => r.id === id);
  if (!room) return;
  editingRoomId = id;
  selectedEmoji = room.icon;
  document.getElementById('room-name-inp').value = room.name;
  document.getElementById('modal-room-title').textContent = 'Editar lugar';
  document.getElementById('room-save-btn').textContent = 'Salvar alterações';
  const grid = document.getElementById('emoji-grid');
  grid.innerHTML = EMOJIS.map(e =>
    `<div class="emoji-opt${e === room.icon ? ' selected' : ''}" onclick="selectEmoji('${e}', this)" title="${EMOJI_LABELS[e] || ''}">
      ${e}<span class="emoji-label">${EMOJI_LABELS[e] || ''}</span>
    </div>`
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

  if (editingRoomId !== null) {
    const room = state.rooms.find(r => r.id === editingRoomId);
    if (room) {
      room.name = name;
      room.icon = selectedEmoji;
      if (currentRoom === room.id) {
        document.getElementById('room-title').textContent = selectedEmoji + '  ' + name;
      }
    }
    editingRoomId = null;
  } else {
    const id = 'room_' + Date.now();
    const bg = BG_COLORS[state.rooms.length % BG_COLORS.length];
    state.rooms.push({ id, name, icon: selectedEmoji, bg });
    state.data[id] = [];
  }
  save(); closeModal('modal-room'); renderHome(); renderLanding();
}

// ─── ITENS ────────────────────────────────────────────────────
let editingItemId       = null;
let itemUploadedMedia   = [];
let isItemUploading     = false;
let currentItemOwned    = true;
let currentItemGroup    = null;

function renderItems() {
  const list  = document.getElementById('item-list');
  const items = state.items || [];
  const addBtn = document.getElementById('item-add-btn');
  if (addBtn) addBtn.style.display = VIEW_MODE ? 'none' : '';

  if (items.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <span class="empty-icon">📦</span>
      ${VIEW_MODE ? 'Nenhum item cadastrado ainda.' : 'Nenhum item ainda.<br>Toque no + para adicionar.'}
    </div>`;
    return;
  }

  const owned  = items.filter(i => i.owned);
  const wanted = items.filter(i => !i.owned);

  const makeGroupCard = (group, icon, label, count) => `
    <div class="group-card" onclick="openItemGroup('${group}')">
      <div class="group-card-badge ${group}">${icon}</div>
      <div class="group-card-info">
        <div class="group-card-title">${label}</div>
        <div class="group-card-sub">${count} ${count === 1 ? 'item' : 'itens'}</div>
      </div>
      <span class="group-card-arrow">→</span>
    </div>`;

  let html = '';
  if (owned.length  || !VIEW_MODE) html += makeGroupCard('owned',  '✓', 'Eu Tenho', owned.length);
  if (wanted.length || !VIEW_MODE) html += makeGroupCard('wanted', '◎', 'Eu Quero', wanted.length);
  list.innerHTML = html;
}

function openItemGroup(group) {
  currentItemGroup = group;
  const title = group === 'owned' ? '✓  Eu Tenho' : '◎  Eu Quero';
  document.getElementById('items-group-title').textContent = title;
  const addBtn = document.getElementById('items-group-add-btn');
  if (addBtn) addBtn.style.display = VIEW_MODE ? 'none' : '';
  renderItemGroup();
  showScreen('items-group');
}

function renderItemGroup() {
  const list = document.getElementById('items-group-list');
  if (!list) return;
  const items = (state.items || []).filter(i => currentItemGroup === 'owned' ? i.owned : !i.owned);
  if (items.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <span class="empty-icon">📦</span>
      ${VIEW_MODE ? 'Nenhum item aqui.' : 'Nenhum item ainda.<br>Toque no + para adicionar.'}
    </div>`;
    return;
  }
  list.innerHTML = items.map(renderItemCard).join('');
}

function renderItemCard(item) {
  const firstImg  = (item.media || []).find(m => m.type === 'image');
  const dims      = [item.height, item.width, item.depth].filter(v => v && v !== '');
  const dimsStr   = dims.length === 3 ? `${dims[0]} × ${dims[1]} × ${dims[2]} cm` : '';

  return `
    <div class="item-card">
      <div class="item-header">
        ${firstImg
          ? `<img src="${escHtml(firstImg.url)}" class="item-thumb" alt="" onclick="openLightbox('${escHtml(firstImg.url)}','image')" style="cursor:pointer">`
          : `<div class="item-thumb-placeholder">📦</div>`}
        <div class="item-info">
          <div class="item-name">${escHtml(item.name)}</div>
          <div class="item-meta-row">
            ${dimsStr   ? `<span class="item-meta-tag">📐 ${dimsStr}</span>` : ''}
            ${item.weight ? `<span class="item-meta-tag">⚖️ ${item.weight} kg</span>` : ''}
          </div>
          <span class="item-badge ${item.owned ? 'owned' : 'wanted'}">
            ${item.owned ? '✓ Tenho' : '◎ Quero'}
          </span>
        </div>
        ${VIEW_MODE ? '' : `
          <div class="card-actions">
            <button class="btn-card-action" onclick="openEditItem(${item.id})" aria-label="editar">✎</button>
            <button class="btn-card-action btn-card-danger" onclick="askDeleteItem(${item.id})" aria-label="excluir">✕</button>
          </div>`}
      </div>
      ${item.notes ? `<div class="item-notes">${linkifyText(item.notes)}</div>` : ''}
      ${(item.media || []).length > 1 ? renderItemMediaGrid(item.media) : ''}
    </div>`;
}

function renderItemMediaGrid(media) {
  const all = media.slice(1); // primeira já aparece como thumb
  if (!all.length) return '';
  return `<div class="item-media-extra">` + all.map(m => {
    const key = escHtml(m.url);
    if (m.type === 'video') {
      return `<div class="media-wrap small" onclick="openLightbox('${key}','video')">
        <video src="${key}" class="demand-media-item" playsinline muted></video>
        <div class="play-overlay">▶</div>
      </div>`;
    }
    return `<img src="${key}" class="item-extra-img" alt="" loading="lazy" onclick="openLightbox('${key}','image')" style="cursor:pointer">`;
  }).join('') + `</div>`;
}

function openAddItem() {
  if (VIEW_MODE) return;
  editingItemId     = null;
  currentItemOwned  = true;
  document.getElementById('item-form-title').textContent = 'Novo item';
  document.getElementById('item-save-btn').textContent   = 'Salvar item';
  document.getElementById('inp-item-name').value  = '';
  document.getElementById('inp-height').value     = '';
  document.getElementById('inp-width').value      = '';
  document.getElementById('inp-depth').value      = '';
  document.getElementById('inp-weight').value     = '';
  document.getElementById('inp-item-notes').value = '';
  itemUploadedMedia = [];
  isItemUploading   = false;
  setOwned(true);
  renderItemUploadArea();
  showScreen('add-item');
}

function openEditItem(id) {
  if (VIEW_MODE) return;
  const item = (state.items || []).find(i => i.id === id);
  if (!item) return;
  editingItemId    = id;
  currentItemOwned = item.owned;
  document.getElementById('item-form-title').textContent = 'Editar item';
  document.getElementById('item-save-btn').textContent   = 'Salvar alterações';
  document.getElementById('inp-item-name').value  = item.name || '';
  document.getElementById('inp-height').value     = item.height || '';
  document.getElementById('inp-width').value      = item.width  || '';
  document.getElementById('inp-depth').value      = item.depth  || '';
  document.getElementById('inp-weight').value     = item.weight || '';
  document.getElementById('inp-item-notes').value = item.notes  || '';
  itemUploadedMedia = [...(item.media || [])];
  isItemUploading   = false;
  setOwned(item.owned);
  renderItemUploadArea();
  showScreen('add-item');
}

function cancelItemForm() {
  editingItemId = null;
  showScreen('items');
}

function setOwned(val) {
  currentItemOwned = val;
  document.getElementById('btn-owned-yes').classList.toggle('active', val);
  document.getElementById('btn-owned-no').classList.toggle('active', !val);
}

function renderItemUploadArea() {
  const area = document.getElementById('item-upload-area');
  if (!area) return;
  let html = '';
  if (itemUploadedMedia.length > 0) {
    html += '<div class="media-preview-grid">';
    itemUploadedMedia.forEach((m, i) => {
      const thumb = m.type === 'video'
        ? `<div class="media-thumb video-ph">🎥</div>`
        : `<img src="${m.url}" class="media-thumb" alt="">`;
      html += `<div class="media-thumb-wrap">${thumb}<button class="btn-remove-media" onclick="removeItemMedia(${i})">✕</button></div>`;
    });
    html += '</div>';
  }
  if (isItemUploading) {
    html += `<div class="upload-loading"><span class="spinner"></span> Enviando…</div>`;
  } else if (itemUploadedMedia.length === 0) {
    html += `<label class="upload-trigger" for="item-file-input">
      <span class="upload-icon">📸</span>
      <span>Toque para adicionar foto</span>
      <span class="upload-hint">JPG, PNG ou HEIC</span>
    </label>`;
  } else {
    html += `<label class="upload-add-more" for="item-file-input">+ Adicionar outra foto</label>`;
  }
  if (!isItemUploading) {
    html += `<input type="file" id="item-file-input" accept="image/*,video/*" style="display:none" onchange="handleItemFileSelect(this)">`;
  }
  area.innerHTML = html;
}

function removeItemMedia(index) {
  itemUploadedMedia.splice(index, 1);
  renderItemUploadArea();
}

async function handleItemFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  const isVideo = file.type.startsWith('video/');
  isItemUploading = true;
  renderItemUploadArea();
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${isVideo ? 'video' : 'image'}/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.secure_url) itemUploadedMedia.push({ url: data.secure_url, type: isVideo ? 'video' : 'image' });
  } catch(e) {}
  isItemUploading = false;
  renderItemUploadArea();
}

function saveItem() {
  if (VIEW_MODE) return;
  const name = document.getElementById('inp-item-name').value.trim();
  if (!name) { document.getElementById('inp-item-name').focus(); return; }
  if (isItemUploading) return;

  const item = {
    name,
    owned:  currentItemOwned,
    height: document.getElementById('inp-height').value.trim(),
    width:  document.getElementById('inp-width').value.trim(),
    depth:  document.getElementById('inp-depth').value.trim(),
    weight: document.getElementById('inp-weight').value.trim(),
    notes:  document.getElementById('inp-item-notes').value.trim(),
    media:  [...itemUploadedMedia]
  };

  if (!state.items) state.items = [];

  if (editingItemId !== null) {
    const idx = state.items.findIndex(i => i.id === editingItemId);
    if (idx !== -1) state.items[idx] = { ...state.items[idx], ...item };
    editingItemId = null;
  } else {
    state.items.push({ id: nextId++, ...item });
  }

  save(); renderItems(); renderLanding(); showScreen('items');
}

function askDeleteItem(id) {
  if (VIEW_MODE) return;
  openConfirm('Excluir item', 'Tem certeza? Essa ação não pode ser desfeita.', () => {
    state.items = (state.items || []).filter(i => i.id !== id);
    save(); renderItems(); renderLanding();
  });
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
  if (e && e.target.closest('.lightbox-content')) return;
  document.getElementById('lightbox').style.display = 'none';
  document.getElementById('lightbox-content').innerHTML = '';
  document.body.style.overflow = '';
}

// ─── UTILITÁRIOS ──────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function linkifyText(str) {
  const escaped  = escHtml(str);
  const urlRegex = /(https?:\/\/[^\s&<>"]+)/g;
  return escaped
    .replace(/\n/g, '<br>')
    .replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener" class="auto-link">${url}</a>`);
}

// ─── INIT ─────────────────────────────────────────────────────
if (VIEW_MODE) document.body.classList.add('view-mode');

if (db) {
  db.collection('reforma').doc('main').onSnapshot(
    doc => {
      if (doc.exists) {
        const d    = doc.data();
        state      = d.state  || { rooms: [], data: {}, items: [] };
        if (!state.items) state.items = [];
        nextId     = d.nextId || 1;
        if (!VIEW_MODE) localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, nextId }));
      } else if (!VIEW_MODE) {
        loadLocal();
        if (state.rooms.length > 0 || (state.items || []).length > 0) save();
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
renderItemUploadArea();
