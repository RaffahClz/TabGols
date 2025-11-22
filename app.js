// TabGols - client-side app
const STORAGE_KEY = 'tabgols-data-v1';
const ADMIN_KEY = 'tabgols-admin'; // secure admin credential storage (salt+hash)
const ADMIN_FAIL_KEY = 'tabgols-admin-fail';
const THEME_KEY = 'tabgols-theme';

let state = {
  teams: [], // {id, name}
  matches: [] // {id, homeId, awayId, homeGoals, awayGoals}
};

// ---- Helpers ----
const $ = (id) => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

// ---- Persistence ----
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) state = JSON.parse(raw);
}

// ---- Data manipulation ----
function addTeam(name) {
  if (!name) return;
  const shieldInput = document.getElementById('teamShield');
  const shield = shieldInput ? shieldInput.value.trim() : '';
  state.teams.push({ id: uid(), name, shield: shield || '' });
  save();
  renderAll();
}

function addMatch(homeId, awayId) {
  if (!homeId || !awayId || homeId === awayId) return;
  state.matches.push({ id: uid(), homeId, awayId, homeGoals: 0, awayGoals: 0, createdAt: Date.now() });
  save();
  renderAll();
}

function setGoals(matchId, homeGoals, awayGoals) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;
  m.homeGoals = Math.max(0, parseInt(homeGoals) || 0);
  m.awayGoals = Math.max(0, parseInt(awayGoals) || 0);
  save();
  renderAll();
}

function incGoals(matchId, side, delta) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;
  if (side === 'home') m.homeGoals = Math.max(0, m.homeGoals + delta);
  else m.awayGoals = Math.max(0, m.awayGoals + delta);
  save();
  renderAll();
}

function resetData() {
  if (!confirm('Confirma resetar todos os dados?')) return;
  state = { teams: [], matches: [] };
  save();
  renderAll();
}

// ---- Web Crypto helpers for admin password hashing ----
function toBase64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function fromBase64(str) { const bin = atob(str); const arr = new Uint8Array(bin.length); for (let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i); return arr; }

async function generateSalt() { const s = crypto.getRandomValues(new Uint8Array(16)); return toBase64(s); }

async function deriveKeyBase64(password, saltB64, iterations=150000) {
  const pwUtf8 = new TextEncoder().encode(password);
  const salt = fromBase64(saltB64);
  const keyMaterial = await crypto.subtle.importKey('raw', pwUtf8, { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256);
  return toBase64(bits);
}

async function setAdminPassword(plain) {
  const salt = await generateSalt();
  const hash = await deriveKeyBase64(plain, salt);
  const obj = { salt, hash, iterations: 150000 };
  localStorage.setItem(ADMIN_KEY, JSON.stringify(obj));
  // remove legacy storage if exists
  if (localStorage.getItem('tabgols-admin-pass')) localStorage.removeItem('tabgols-admin-pass');
}

async function verifyAdminPassword(plain) {
  const raw = localStorage.getItem(ADMIN_KEY);
  if (!raw) return false;
  try {
    const obj = JSON.parse(raw);
    const hash = await deriveKeyBase64(plain, obj.salt, obj.iterations || 150000);
    // constant-time comparison
    if (hash.length !== obj.hash.length) return false;
    let diff = 0; for (let i=0;i<hash.length;i++) diff |= hash.charCodeAt(i) ^ obj.hash.charCodeAt(i);
    return diff === 0;
  } catch (e) { return false; }
}

function recordFailedAttempt() {
  const raw = localStorage.getItem(ADMIN_FAIL_KEY);
  const now = Date.now();
  let obj = raw ? JSON.parse(raw) : { count:0, last:0, lockedUntil:0 };
  obj.count = (obj.count || 0) + 1; obj.last = now;
  if (obj.count >= 5) obj.lockedUntil = now + 5*60*1000; // lock 5 minutes
  localStorage.setItem(ADMIN_FAIL_KEY, JSON.stringify(obj));
}

function checkLocked() {
  const raw = localStorage.getItem(ADMIN_FAIL_KEY);
  if (!raw) return false;
  const obj = JSON.parse(raw);
  if (obj.lockedUntil && Date.now() < obj.lockedUntil) return true;
  return false;
}

function clearFailedAttempts() { localStorage.removeItem(ADMIN_FAIL_KEY); }

// ---- Computation of standings ----
function computeTable() {
  // Initialize
  const map = new Map();
  state.teams.forEach(t => map.set(t.id, { id: t.id, name: t.name, shield: t.shield || '', played:0, gf:0, ga:0, points:0 }));

  state.matches.forEach(m => {
    const home = map.get(m.homeId);
    const away = map.get(m.awayId);
    if (!home || !away) return;
    home.played += 1; away.played += 1;
    home.gf += m.homeGoals; home.ga += m.awayGoals;
    away.gf += m.awayGoals; away.ga += m.homeGoals;
    home.points += m.homeGoals;
    away.points += m.awayGoals;
  });

  const arr = Array.from(map.values());
  // compute saldo
  arr.forEach(r => r.gd = r.gf - r.ga);
  // sort: pontos desc, saldo desc, gols pró desc, nome asc
  arr.sort((a,b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
  return arr;
}

// ---- Theme handling ----
function applyTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  const btn = $('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const cur = localStorage.getItem(THEME_KEY) || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

// remove a team and any matches referencing it
function removeTeam(teamId) {
  if (!teamId) return;
  if (!confirm('Confirma remover este time? Isso também removerá partidas relacionadas.')) return;
  state.teams = state.teams.filter(t => t.id !== teamId);
  state.matches = state.matches.filter(m => m.homeId !== teamId && m.awayId !== teamId);
  save();
  renderAll();
}

// ---- Rendering ----
function renderTable() {
  const body = $('tableBody');
  body.innerHTML = '';
  const table = computeTable();
  table.forEach((row,i) => {
    const tr = document.createElement('tr');
    const tdPos = document.createElement('td'); tdPos.textContent = String(i+1);
    const tdName = document.createElement('td'); tdName.style.textAlign = 'left';
    // create name cell with optional shield image
    const wrapper = document.createElement('div'); wrapper.style.display = 'flex'; wrapper.style.alignItems = 'center';
    if (row.shield) {
      const img = document.createElement('img');
      img.src = row.shield;
      img.alt = row.name + ' escudo';
      img.className = 'team-shield';
      img.loading = 'lazy';
      // fallback: se a imagem não carregar, substituir por um placeholder SVG com a inicial
      img.onerror = function() {
        try {
          const initial = (row.name || '').trim().charAt(0).toUpperCase() || '';
          const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'><rect width='100%' height='100%' fill='%23e6eef6'/><text x='50%' y='50%' dy='.35em' font-family='Inter, system-ui' font-size='12' text-anchor='middle' fill='%236b7280'>${initial}</text></svg>`;
          this.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
        } catch (e) { this.style.display = 'none'; }
      };
      wrapper.appendChild(img);
    }
    const span = document.createElement('span'); span.textContent = row.name;
    wrapper.appendChild(span);
    if (isAdmin()) {
      const delTeamBtn = document.createElement('button');
      delTeamBtn.dataset.action = 'delTeam';
      delTeamBtn.dataset.id = row.id;
      delTeamBtn.className = 'team-del-btn';
      delTeamBtn.title = 'Remover time';
      delTeamBtn.textContent = '✕';
      delTeamBtn.style.marginLeft = '10px';
      wrapper.appendChild(delTeamBtn);
    }
    tdName.appendChild(wrapper);
    const tdPts = document.createElement('td'); tdPts.textContent = String(row.points);
    const tdJ = document.createElement('td'); tdJ.textContent = String(row.played);
    const tdGC = document.createElement('td'); tdGC.textContent = String(row.ga);
    const tdGD = document.createElement('td'); tdGD.textContent = String(row.gd);
    tr.appendChild(tdPos); tr.appendChild(tdName); tr.appendChild(tdPts); tr.appendChild(tdJ); tr.appendChild(tdGC); tr.appendChild(tdGD);
    body.appendChild(tr);
  });
}

function populateTeamSelects() {
  const home = $('homeSelect');
  const away = $('awaySelect');
  home.innerHTML = '';
  away.innerHTML = '';
  state.teams.forEach(t => {
    const opt1 = document.createElement('option'); opt1.value = t.id; opt1.text = t.name;
    const opt2 = document.createElement('option'); opt2.value = t.id; opt2.text = t.name;
    home.appendChild(opt1); away.appendChild(opt2);
  });
}

function renderMatches() {
  const cont = $('matches');
  cont.innerHTML = '';
  if (state.matches.length === 0) { const p = document.createElement('p'); p.className='small'; p.textContent='Nenhuma partida. Adicione uma partida acima.'; cont.appendChild(p); return; }

  // ordenar partidas por createdAt (mais recentes primeiro)
  const matchesSorted = [...state.matches].sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
  matchesSorted.forEach(m => {
    const home = state.teams.find(t => t.id === m.homeId);
    const away = state.teams.find(t => t.id === m.awayId);
    const div = document.createElement('div'); div.className = 'match';

    // left column (home)
    const left = document.createElement('div'); left.className = 'team-column';
    const nameH = document.createElement('div'); nameH.className = 'team-name'; nameH.textContent = home ? home.name : '—';
    const scoreH = document.createElement('div'); scoreH.className = 'team-score';
    if (isAdmin()) {
      const dec = document.createElement('button'); dec.dataset.action='dec'; dec.dataset.id=m.id; dec.dataset.side='home'; dec.textContent='-'; dec.className='score-btn';
      const spanH = document.createElement('span'); spanH.className='score'; spanH.dataset.id=m.id; spanH.dataset.side='home'; spanH.textContent = String(m.homeGoals);
      const inc = document.createElement('button'); inc.dataset.action='inc'; inc.dataset.id=m.id; inc.dataset.side='home'; inc.textContent='+'; inc.className='score-btn';
      scoreH.appendChild(dec); scoreH.appendChild(spanH); scoreH.appendChild(inc);
    } else {
      const spanH = document.createElement('div'); spanH.className='score'; spanH.textContent = String(m.homeGoals);
      scoreH.appendChild(spanH);
    }
    left.appendChild(nameH); left.appendChild(scoreH);

    // right column (away)
    const right = document.createElement('div'); right.className = 'team-column';
    const nameA = document.createElement('div'); nameA.className = 'team-name'; nameA.textContent = away ? away.name : '—';
    const scoreA = document.createElement('div'); scoreA.className = 'team-score';
    if (isAdmin()) {
      const dec2 = document.createElement('button'); dec2.dataset.action='dec'; dec2.dataset.id=m.id; dec2.dataset.side='away'; dec2.textContent='-'; dec2.className='score-btn';
      const spanA = document.createElement('span'); spanA.className='score'; spanA.dataset.id=m.id; spanA.dataset.side='away'; spanA.textContent = String(m.awayGoals);
      const inc2 = document.createElement('button'); inc2.dataset.action='inc'; inc2.dataset.id=m.id; inc2.dataset.side='away'; inc2.textContent='+'; inc2.className='score-btn';
      scoreA.appendChild(dec2); scoreA.appendChild(spanA); scoreA.appendChild(inc2);
    } else {
      const spanA = document.createElement('div'); spanA.className='score'; spanA.textContent = String(m.awayGoals);
      scoreA.appendChild(spanA);
    }
    right.appendChild(nameA); right.appendChild(scoreA);

    // center area (actions for admin)
    const center = document.createElement('div'); center.className = 'match-center';
    const vs = document.createElement('div'); vs.className='vs'; vs.textContent = 'vs';
    center.appendChild(vs);
    if (isAdmin()) {
      const del = document.createElement('button'); del.dataset.action='del'; del.dataset.id=m.id; del.textContent='Excluir'; del.className='del-btn';
      center.appendChild(del);
    }

    div.appendChild(left); div.appendChild(center); div.appendChild(right);
    cont.appendChild(div);
  });
}

// ---- Admin handling ----
function isAdmin() { return sessionStorage.getItem('tabgols-isAdmin') === '1'; }

function setAdmin(val) {
  if (val) sessionStorage.setItem('tabgols-isAdmin', '1');
  else sessionStorage.removeItem('tabgols-isAdmin');
  document.body.classList.toggle('is-admin', !!val);
  toggleAdminResetButton(!!val);
  renderAll();
}

function handleAdminToggle() {
  const current = isAdmin();
  if (current) { setAdmin(false); return; }
  // attempt to login
  if (checkLocked()) { alert('Muitas tentativas incorretas. Tente novamente mais tarde.'); return; }
  const raw = localStorage.getItem(ADMIN_KEY);
  if (!raw) {
    const pass = prompt('Defina uma senha de administrador (será salva localmente e protegida):');
    if (!pass) return alert('Senha não definida.');
    setAdminPassword(pass).then(() => { setAdmin(true); clearFailedAttempts(); alert('Senha salva com segurança. Agora você está no modo Admin.'); });
    return;
  }
  const attempt = prompt('Senha de administrador:');
  if (attempt === null) return;
  verifyAdminPassword(attempt).then(valid => {
    if (valid) { setAdmin(true); clearFailedAttempts(); alert('Entrou no modo Admin.'); }
    else { recordFailedAttempt(); alert('Senha incorreta.'); }
  });
}

function renderAll() {
  populateTeamSelects();
  renderTable();
  renderMatches();
}

// ---- Admin-only reset button management ----
function toggleAdminResetButton(show) {
  const container = document.querySelector('.footer-actions');
  if (!container) return;
  const existing = document.getElementById('resetBtn');
  if (show) {
    if (!existing) {
      const btn = document.createElement('button');
      btn.id = 'resetBtn';
      btn.textContent = 'Resetar dados';
      btn.className = '';
      btn.addEventListener('click', () => {
        if (!confirm('Confirma resetar todos os dados?')) return;
        state = { teams: [], matches: [] };
        save();
        renderAll();
      });
      container.appendChild(btn);
    }
  } else {
    if (existing) existing.remove();
  }
}

// ---- Events ----
function attachEvents() {
  // secret admin triggers:
  // 1) atalho de teclado Ctrl+Alt+A
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'a') {
      handleAdminToggle();
    }
  });
  // 2) 5 cliques rápidos no título
  const title = document.getElementById('appTitle');
  if (title) {
    let clickCount = 0; let clickTimer = null;
    title.addEventListener('click', () => {
      clickCount++;
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => { clickCount = 0; clickTimer = null; }, 1500);
      if (clickCount >= 5) { clickCount = 0; handleAdminToggle(); }
    });
  }
  // 3) hotspot (bottom-right) - click or long-press on mobile
  const hotspot = document.getElementById('adminHotspot');
  if (hotspot) {
    hotspot.addEventListener('click', (e) => { e.preventDefault(); handleAdminToggle(); });
    // long-press support for mobile: press >= 700ms triggers admin
    let pressTimer = null;
    hotspot.addEventListener('touchstart', (ev) => {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = setTimeout(() => { handleAdminToggle(); pressTimer = null; }, 700);
    }, { passive: true });
    hotspot.addEventListener('touchend', () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });
    hotspot.addEventListener('touchmove', () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });
  }

  $('addTeamBtn').addEventListener('click', () => {
    const name = $('teamName').value.trim();
    if (!name) return alert('Informe o nome do time');
    addTeam(name);
    $('teamName').value = '';
    const sh = $('teamShield'); if (sh) sh.value = '';
  });

  $('addMatchBtn').addEventListener('click', () => {
    const home = $('homeSelect').value;
    const away = $('awaySelect').value;
    if (!home || !away || home === away) return alert('Selecione dois times diferentes');
    addMatch(home, away);
  });

  // theme toggle
  const themeBtn = $('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', () => { toggleTheme(); });

  $('matches').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const side = btn.dataset.side;
    if (action === 'inc') incGoals(id, side, 1);
    if (action === 'dec') incGoals(id, side, -1);
    if (action === 'del') {
      if (!confirm('Excluir essa partida?')) return;
      state.matches = state.matches.filter(m => m.id !== id);
      save(); renderAll();
    }
  });

  // table team actions (delegation) - delete team
  const tableBody = document.getElementById('tableBody');
  if (tableBody) {
    tableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'delTeam') {
        removeTeam(id);
      }
    });
  }

  // reset/export/import
  // reset button is created dynamically when admin; no static listener here

  // allow editing score by clicking the score text
  $('matches').addEventListener('dblclick', (e) => {
    if (!isAdmin()) return; // only admins can edit by dblclick
    const span = e.target.closest('span.score');
    if (!span) return;
    const id = span.dataset.id; const side = span.dataset.side;
    const val = prompt('Novo número de gols:', span.textContent);
    if (val === null) return;
    const m = state.matches.find(x => x.id === id);
    if (!m) return;
    if (side === 'home') m.homeGoals = Math.max(0, parseInt(val) || 0);
    else m.awayGoals = Math.max(0, parseInt(val) || 0);
    save(); renderAll();
  });
}

// ---- Init ----
async function init() {
  load();
  // Ensure admin credential storage exists and is secure.
  // If legacy plaintext password exists, migrate it; otherwise ensure default password is set (as requested).
  if (!localStorage.getItem(ADMIN_KEY)) {
    const legacy = localStorage.getItem('tabgols-admin-pass');
    if (legacy) {
      await setAdminPassword(legacy);
      localStorage.removeItem('tabgols-admin-pass');
    } else {
      // set default password requested earlier
      await setAdminPassword('Fayla9132Santos');
    }
  }
  // if no teams yet, create example teams
  if (!state.teams || state.teams.length === 0) {
    state.teams = [ {id: uid(), name: 'Flamengo'}, {id: uid(), name: 'Palmeiras'}, {id: uid(), name: 'Fluminense'} ];
    state.matches = [];
    save();
  }
  attachEvents();
  // apply saved or system theme
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) applyTheme(savedTheme);
  else {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
  // ensure reset button appears if session already in admin mode
  toggleAdminResetButton(isAdmin());
  renderAll();
}

init();
