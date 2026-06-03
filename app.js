/* ============================================================
   APP.JS — Site de recrutement
   ============================================================ */

// ── CONFIG PAR DÉFAUT (modifiable dans l'espace RH → Configuration)
const DEFAULT_CONFIG = {
  publicKey:   '',
  serviceId:   '',
  tplRH:       '',
  tplAccuse:   '',
  tplCharge:   '',
  tplAccept:   '',
  tplRefuse:   '',
  rhEmail:     '',
  serverName:  'MON SERVEUR',
  password:    'rh2025',
};

// ── STATE
let config     = loadConfig();
let postes     = loadPostes();
let candidatures = loadCandidatures();
let currentPoste = null;   // poste sélectionné pour postuler
let currentCand  = null;   // candidature ouverte dans le détail
let editPosteId  = null;   // id du poste en cours d'édition

// ── INIT
document.addEventListener('DOMContentLoaded', () => {
  applyConfig();
  renderPostesPublic();
  bindNav();
  bindFilters();
  bindRHLogin();
  bindFormCandidature();
  bindFormPoste();
  bindConfigForm();
  bindRHTabs();
  bindDetailModal();
});

/* ============================================================
   PERSISTANCE
   ============================================================ */
function loadConfig() {
  try { return Object.assign({}, DEFAULT_CONFIG, JSON.parse(localStorage.getItem('rh_config') || '{}')); }
  catch { return { ...DEFAULT_CONFIG }; }
}
function saveConfig() { localStorage.setItem('rh_config', JSON.stringify(config)); }

function loadPostes() {
  try { return JSON.parse(localStorage.getItem('rh_postes') || '[]'); }
  catch { return []; }
}
function savePostes() { localStorage.setItem('rh_postes', JSON.stringify(postes)); }

function loadCandidatures() {
  try { return JSON.parse(localStorage.getItem('rh_candidatures') || '[]'); }
  catch { return []; }
}
function saveCandidatures() { localStorage.setItem('rh_candidatures', JSON.stringify(candidatures)); }

/* ============================================================
   APPLIQUE LA CONFIG (nom du serveur, emailjs)
   ============================================================ */
function applyConfig() {
  const name = config.serverName || 'RECRUTEMENT';
  document.getElementById('site-name-nav').textContent = name;
  document.getElementById('footer-text').textContent = `© ${new Date().getFullYear()} — ${name}`;
  if (config.publicKey) {
    emailjs.init({ publicKey: config.publicKey });
  }
}

/* ============================================================
   RENDU POSTES PUBLICS
   ============================================================ */
function renderPostesPublic(filterCat = 'all') {
  const grid  = document.getElementById('postes-grid');
  const empty = document.getElementById('empty-postes');
  const list  = filterCat === 'all' ? postes : postes.filter(p => p.cat === filterCat);

  grid.innerHTML = '';
  if (list.length === 0) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'poste-card';
    card.innerHTML = `
      <div class="poste-card-top">
        <div class="poste-nom">${esc(p.nom)}</div>
        <span class="cat-badge cat-${p.cat}">${esc(p.cat)}</span>
      </div>
      <p class="poste-desc">${esc(p.desc)}</p>
      ${p.prereq ? `<p class="poste-prereq"><strong>Prérequis :</strong> ${esc(p.prereq)}</p>` : ''}
      <button class="btn-postuler" data-id="${p.id}">Postuler →</button>
    `;
    card.querySelector('.btn-postuler').addEventListener('click', () => openPostuler(p));
    grid.appendChild(card);
  });
}

/* ============================================================
   FILTERS
   ============================================================ */
function bindFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPostesPublic(btn.dataset.cat);
    });
  });
}

/* ============================================================
   NAV
   ============================================================ */
function bindNav() {
  document.getElementById('btn-open-rh-login').addEventListener('click', () => {
    show('modal-rh-login');
  });
}

/* ============================================================
   MODAL POSTULER
   ============================================================ */
function openPostuler(poste) {
  currentPoste = poste;
  document.getElementById('modal-poste-title').textContent = poste.nom;
  document.getElementById('form-candidature').reset();
  document.getElementById('form-error').style.display = 'none';
  show('modal-postuler');
}

document.getElementById('close-postuler').addEventListener('click', () => hide('modal-postuler'));
document.getElementById('modal-postuler').addEventListener('click', e => {
  if (e.target === e.currentTarget) hide('modal-postuler');
});

function bindFormCandidature() {
  document.getElementById('form-candidature').addEventListener('submit', async e => {
    e.preventDefault();
    const prenom = val('f-prenom'), nom = val('f-nom'), rp = val('f-rp'),
          email  = val('f-email'), motiv = val('f-motivation'),
          cv     = val('f-cv'),   extra = val('f-extra');

    if (!prenom || !nom || !rp || !email || !motiv) {
      showFormError('form-error', 'Merci de remplir tous les champs obligatoires.');
      return;
    }
    if (!emailValid(email)) {
      showFormError('form-error', 'Adresse email invalide.');
      return;
    }

    const btnText   = document.getElementById('btn-submit-text');
    const btnLoader = document.getElementById('btn-submit-loader');
    const btnSubmit = document.getElementById('btn-submit-cand');
    btnText.style.display   = 'none';
    btnLoader.style.display = '';
    btnSubmit.disabled = true;

    const cand = {
      id:       Date.now().toString(),
      posteId:  currentPoste.id,
      posteNom: currentPoste.nom,
      posteCat: currentPoste.cat,
      prenom, nom, rp, email, motiv, cv, extra,
      statut:   'en_attente',
      date:     new Date().toLocaleDateString('fr-FR'),
    };

    candidatures.push(cand);
    saveCandidatures();

    // Envoi mails
    await sendMailCandidature(cand);
    await sendMailAccuse(cand);

    btnText.style.display   = '';
    btnLoader.style.display = 'none';
    btnSubmit.disabled = false;

    hide('modal-postuler');
    toast('✓ Candidature envoyée avec succès !', 'success');
  });
}

/* ============================================================
   RH LOGIN
   ============================================================ */
function bindRHLogin() {
  document.getElementById('close-rh-login').addEventListener('click', () => hide('modal-rh-login'));
  document.getElementById('modal-rh-login').addEventListener('click', e => {
    if (e.target === e.currentTarget) hide('modal-rh-login');
  });
  document.getElementById('form-rh-login').addEventListener('submit', e => {
    e.preventDefault();
    const pwd = val('rh-password');
    if (pwd === config.password) {
      hide('modal-rh-login');
      openDashboard();
    } else {
      document.getElementById('login-error').style.display = '';
    }
  });
}

/* ============================================================
   DASHBOARD RH
   ============================================================ */
function openDashboard() {
  document.getElementById('navbar').style.display = 'none';
  document.getElementById('hero').style.display   = 'none';
  document.getElementById('postes').style.display = 'none';
  document.querySelector('footer').style.display  = 'none';
  document.getElementById('rh-dashboard').style.display = '';
  renderCandidaturesRH();
  renderPostesRH();
  fillConfigForm();
}

function closeDashboard() {
  document.getElementById('navbar').style.display = '';
  document.getElementById('hero').style.display   = '';
  document.getElementById('postes').style.display = '';
  document.querySelector('footer').style.display  = '';
  document.getElementById('rh-dashboard').style.display = 'none';
}

document.getElementById('btn-logout').addEventListener('click', () => closeDashboard());

function bindRHTabs() {
  document.querySelectorAll('.rh-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.rh-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.rh-content').forEach(c => c.style.display = 'none');
      document.getElementById(`tab-${tab.dataset.tab}`).style.display = '';
    });
  });
}

/* ── CANDIDATURES RH ── */
function renderCandidaturesRH() {
  const statusFilter = document.getElementById('filter-status').value;
  const catFilter    = document.getElementById('filter-cat-cand').value;
  const list = candidatures.filter(c => {
    if (statusFilter !== 'all' && c.statut !== statusFilter) return false;
    if (catFilter    !== 'all' && c.posteCat !== catFilter)  return false;
    return true;
  });

  const container = document.getElementById('candidatures-list');
  const empty     = document.getElementById('empty-cands');
  container.innerHTML = '';

  if (list.length === 0) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  // tri : les plus récentes en premier
  [...list].reverse().forEach(c => {
    const card = document.createElement('div');
    card.className = 'cand-card';
    card.innerHTML = `
      <div class="cand-avatar">${c.prenom[0]}${c.nom[0]}</div>
      <div class="cand-info">
        <div class="cand-name">${esc(c.prenom)} ${esc(c.nom)}</div>
        <div class="cand-meta">
          <span>RP : <strong>${esc(c.rp)}</strong></span>
          <span>${esc(c.posteNom)}</span>
          <span class="cat-badge cat-${c.posteCat}">${esc(c.posteCat)}</span>
        </div>
      </div>
      <div class="cand-right">
        <span class="status-badge status-${c.statut}">${statusLabel(c.statut)}</span>
        <span class="cand-date">${c.date}</span>
      </div>
    `;
    card.addEventListener('click', () => openCandDetail(c));
    container.appendChild(card);
  });
}

// Rebind les filtres RH
document.getElementById('filter-status').addEventListener('change', renderCandidaturesRH);
document.getElementById('filter-cat-cand').addEventListener('change', renderCandidaturesRH);

/* ── POSTES RH ── */
function renderPostesRH() {
  const container = document.getElementById('postes-rh-list');
  container.innerHTML = '';
  if (postes.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Aucun poste créé.</p></div>';
    return;
  }
  postes.forEach(p => {
    const row = document.createElement('div');
    row.className = 'poste-rh-row';
    row.innerHTML = `
      <span class="cat-badge cat-${p.cat}">${esc(p.cat)}</span>
      <div class="poste-rh-info">
        <div class="poste-rh-nom">${esc(p.nom)}</div>
        <div class="poste-rh-desc">${esc(p.desc)}</div>
      </div>
      <div class="poste-rh-actions">
        <button class="btn-sm" data-edit="${p.id}">Modifier</button>
        <button class="btn-sm danger" data-del="${p.id}">Supprimer</button>
      </div>
    `;
    row.querySelector('[data-edit]').addEventListener('click', () => openEditPoste(p));
    row.querySelector('[data-del]').addEventListener('click', () => deletePoste(p.id));
    container.appendChild(row);
  });
}

/* ── NOUVEAU / MODIFIER POSTE ── */
document.getElementById('btn-nouveau-poste').addEventListener('click', () => {
  editPosteId = null;
  document.getElementById('nouveau-poste-title').textContent = 'Nouveau poste';
  document.getElementById('btn-submit-poste').textContent = 'Créer le poste';
  document.getElementById('form-poste').reset();
  show('modal-nouveau-poste');
});

document.getElementById('close-nouveau-poste').addEventListener('click', () => hide('modal-nouveau-poste'));
document.getElementById('modal-nouveau-poste').addEventListener('click', e => {
  if (e.target === e.currentTarget) hide('modal-nouveau-poste');
});

function openEditPoste(p) {
  editPosteId = p.id;
  document.getElementById('nouveau-poste-title').textContent = 'Modifier le poste';
  document.getElementById('btn-submit-poste').textContent = 'Enregistrer';
  document.getElementById('poste-nom').value    = p.nom;
  document.getElementById('poste-cat').value    = p.cat;
  document.getElementById('poste-desc').value   = p.desc;
  document.getElementById('poste-prereq').value = p.prereq || '';
  show('modal-nouveau-poste');
}

function bindFormPoste() {
  document.getElementById('form-poste').addEventListener('submit', e => {
    e.preventDefault();
    const nom    = val('poste-nom');
    const cat    = val('poste-cat');
    const desc   = val('poste-desc');
    const prereq = val('poste-prereq');
    if (!nom || !cat || !desc) return;

    if (editPosteId) {
      const idx = postes.findIndex(p => p.id === editPosteId);
      if (idx !== -1) postes[idx] = { ...postes[idx], nom, cat, desc, prereq };
    } else {
      postes.push({ id: Date.now().toString(), nom, cat, desc, prereq });
    }
    savePostes();
    renderPostesRH();
    renderPostesPublic();
    hide('modal-nouveau-poste');
    toast(editPosteId ? '✓ Poste modifié' : '✓ Poste créé', 'success');
  });
}

function deletePoste(id) {
  if (!confirm('Supprimer ce poste ?')) return;
  postes = postes.filter(p => p.id !== id);
  savePostes();
  renderPostesRH();
  renderPostesPublic();
  toast('Poste supprimé', 'success');
}

/* ============================================================
   DETAIL CANDIDATURE
   ============================================================ */
function bindDetailModal() {
  document.getElementById('close-cand-detail').addEventListener('click', () => hide('modal-cand-detail'));
  document.getElementById('modal-cand-detail').addEventListener('click', e => {
    if (e.target === e.currentTarget) hide('modal-cand-detail');
  });
}

function openCandDetail(c) {
  currentCand = c;
  document.getElementById('detail-cat').textContent         = c.posteCat;
  document.getElementById('detail-cat').className           = `modal-tag cat-badge cat-${c.posteCat}`;
  document.getElementById('detail-poste').textContent       = c.posteNom;
  document.getElementById('detail-nom').textContent         = `${c.prenom} ${c.nom}`;
  document.getElementById('detail-rp').textContent          = c.rp;
  document.getElementById('detail-email').textContent       = c.email;
  document.getElementById('detail-motivation').textContent  = c.motiv;
  document.getElementById('detail-extra').textContent       = c.extra || '—';

  const cvEl = document.getElementById('detail-cv');
  if (c.cv) {
    cvEl.innerHTML = `<a href="${esc(c.cv)}" target="_blank" style="color:var(--accent)">${esc(c.cv)}</a>`;
  } else {
    cvEl.textContent = '—';
  }

  renderDetailActions(c);
  show('modal-cand-detail');
}

function renderDetailActions(c) {
  const container = document.getElementById('detail-actions');
  container.innerHTML = '';

  if (c.statut === 'en_attente') {
    container.appendChild(makeActionBtn('Prendre en charge', 'charge', async () => {
      await actionCand(c, 'en_charge');
    }));
  }
  if (c.statut !== 'accepte' && c.statut !== 'refuse') {
    container.appendChild(makeActionBtn('✓ Accepter', 'accept', async () => {
      await actionCand(c, 'accepte');
    }));
    container.appendChild(makeActionBtn('✕ Refuser', 'refuse', async () => {
      await actionCand(c, 'refuse');
    }));
  }
  if (c.statut === 'accepte') {
    container.innerHTML = `<span style="color:var(--green);font-weight:600">✓ Candidature acceptée</span>`;
  }
  if (c.statut === 'refuse') {
    container.innerHTML = `<span style="color:var(--red);font-weight:600">✕ Candidature refusée</span>`;
  }
}

function makeActionBtn(label, cls, handler) {
  const btn = document.createElement('button');
  btn.className = `btn-action ${cls}`;
  btn.textContent = label;
  btn.addEventListener('click', handler);
  return btn;
}

async function actionCand(c, newStatut) {
  const idx = candidatures.findIndex(x => x.id === c.id);
  if (idx === -1) return;
  candidatures[idx].statut = newStatut;
  saveCandidatures();
  currentCand = candidatures[idx];

  // Envoi mail
  if (newStatut === 'en_charge') await sendMailCharge(candidatures[idx]);
  if (newStatut === 'accepte')   await sendMailAccept(candidatures[idx]);
  if (newStatut === 'refuse')    await sendMailRefuse(candidatures[idx]);

  renderDetailActions(candidatures[idx]);
  renderCandidaturesRH();
  toast(
    newStatut === 'en_charge' ? '📧 Email de prise en charge envoyé' :
    newStatut === 'accepte'   ? '✓ Candidature acceptée — email envoyé' :
                                '✕ Candidature refusée — email envoyé',
    newStatut === 'refuse' ? 'error' : 'success'
  );
}

/* ============================================================
   CONFIG FORM
   ============================================================ */
function fillConfigForm() {
  document.getElementById('cfg-public-key').value  = config.publicKey  || '';
  document.getElementById('cfg-service-id').value  = config.serviceId  || '';
  document.getElementById('cfg-tpl-rh').value      = config.tplRH      || '';
  document.getElementById('cfg-tpl-accuse').value  = config.tplAccuse  || '';
  document.getElementById('cfg-tpl-charge').value  = config.tplCharge  || '';
  document.getElementById('cfg-tpl-accept').value  = config.tplAccept  || '';
  document.getElementById('cfg-tpl-refuse').value  = config.tplRefuse  || '';
  document.getElementById('cfg-rh-email').value    = config.rhEmail    || '';
  document.getElementById('cfg-server-name').value = config.serverName || '';
  document.getElementById('cfg-password').value    = '';
}

function bindConfigForm() {
  document.getElementById('btn-save-config').addEventListener('click', () => {
    config.publicKey   = val('cfg-public-key');
    config.serviceId   = val('cfg-service-id');
    config.tplRH       = val('cfg-tpl-rh');
    config.tplAccuse   = val('cfg-tpl-accuse');
    config.tplCharge   = val('cfg-tpl-charge');
    config.tplAccept   = val('cfg-tpl-accept');
    config.tplRefuse   = val('cfg-tpl-refuse');
    config.rhEmail     = val('cfg-rh-email');
    config.serverName  = val('cfg-server-name') || 'MON SERVEUR';
    const newPwd = val('cfg-password');
    if (newPwd) config.password = newPwd;
    saveConfig();
    applyConfig();
    const ok = document.getElementById('config-success');
    ok.style.display = '';
    setTimeout(() => ok.style.display = 'none', 3000);
  });
}

/* ============================================================
   EMAILJS — ENVOI MAILS
   ============================================================ */
function ejsReady() {
  if (!config.publicKey || !config.serviceId) {
    console.warn('[EmailJS] Public Key ou Service ID manquant.');
    return false;
  }
  return true;
}

async function sendMailCandidature(c) {
  if (!ejsReady() || !config.tplRH || !config.rhEmail) {
    console.warn('[EmailJS] Config mail RH incomplète.');
    return;
  }
  try {
    const res = await emailjs.send(config.serviceId, config.tplRH, {
      to_email:       config.rhEmail,
      server_name:    config.serverName,
      poste_nom:      c.posteNom,
      poste_cat:      c.posteCat,
      candidat_nom:   `${c.prenom} ${c.nom}`,
      candidat_rp:    c.rp,
      candidat_email: c.email,
      motivation:     c.motiv,
      cv:             c.cv || 'Non fourni',
      extra:          c.extra || 'Aucune',
      date:           c.date,
    });
    console.log('[EmailJS] Mail RH envoyé :', res.status);
  } catch(err) { console.error('[EmailJS] Erreur mail RH :', err); }
}

async function sendMailAccuse(c) {
  if (!ejsReady() || !config.tplAccuse) { console.warn('[EmailJS] Template accusé manquant.'); return; }
  try {
    const res = await emailjs.send(config.serviceId, config.tplAccuse, {
      to_email:    c.email,
      to_name:     c.prenom,
      server_name: config.serverName,
      poste_nom:   c.posteNom,
    });
    console.log('[EmailJS] Accusé de réception envoyé :', res.status);
  } catch(err) { console.error('[EmailJS] Erreur accusé :', err); }
}

async function sendMailCharge(c) {
  if (!ejsReady() || !config.tplCharge) { console.warn('[EmailJS] Template prise en charge manquant.'); return; }
  try {
    const res = await emailjs.send(config.serviceId, config.tplCharge, {
      to_email:    c.email,
      to_name:     c.prenom,
      server_name: config.serverName,
      poste_nom:   c.posteNom,
    });
    console.log('[EmailJS] Mail prise en charge envoyé :', res.status);
  } catch(err) { console.error('[EmailJS] Erreur prise en charge :', err); }
}

async function sendMailAccept(c) {
  if (!ejsReady() || !config.tplAccept) { console.warn('[EmailJS] Template accepté manquant.'); return; }
  try {
    const res = await emailjs.send(config.serviceId, config.tplAccept, {
      to_email:    c.email,
      to_name:     c.prenom,
      server_name: config.serverName,
      poste_nom:   c.posteNom,
    });
    console.log('[EmailJS] Mail accepté envoyé :', res.status);
  } catch(err) { console.error('[EmailJS] Erreur accepté :', err); }
}

async function sendMailRefuse(c) {
  if (!ejsReady() || !config.tplRefuse) { console.warn('[EmailJS] Template refusé manquant.'); return; }
  try {
    const res = await emailjs.send(config.serviceId, config.tplRefuse, {
      to_email:    c.email,
      to_name:     c.prenom,
      server_name: config.serverName,
      poste_nom:   c.posteNom,
    });
    console.log('[EmailJS] Mail refusé envoyé :', res.status);
  } catch(err) { console.error('[EmailJS] Erreur refusé :', err); }
}

/* ============================================================
   UTILITAIRES
   ============================================================ */
function show(id) { document.getElementById(id).style.display = 'flex'; }
function hide(id) { document.getElementById(id).style.display = 'none'; }
function val(id)  { return document.getElementById(id).value.trim(); }
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function emailValid(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function showFormError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.style.display = '';
}
function statusLabel(s) {
  return { en_attente: 'En attente', en_charge: 'Pris en charge', accepte: 'Accepté', refuse: 'Refusé' }[s] || s;
}

let toastTimer = null;
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}
