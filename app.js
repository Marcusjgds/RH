/* ============================================================
   APP.JS — Firebase Firestore compat (CDN, pas de bundler)
   ============================================================ */

// ─── FIREBASE CONFIG ───────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyA04uU6I2b4PDvjwHyeUuQvKrs5Jo3_56Y",
  authDomain:        "site-11-58f78.firebaseapp.com",
  projectId:         "site-11-58f78",
  storageBucket:     "site-11-58f78.firebasestorage.app",
  messagingSenderId: "1010449432094",
  appId:             "1:1010449432094:web:b17a0ad2e790681c62f80f",
};
// ──────────────────────────────────────────────────────────────

const FORMSUBMIT_URL = (email) => `https://formsubmit.co/ajax/${encodeURIComponent(email)}`;

const DEFAULT_CONFIG = { rhEmail: '', serverName: 'SCP SITE 11', password: 'RH2026' };

let config       = loadConfig();
let postes       = [];
let candidatures = [];
let currentPoste = null;
let currentCand  = null;
let editPosteId  = null;
let db           = null;

/* ── INIT ── */
window.addEventListener('load', () => {
  firebase.initializeApp(FIREBASE_CONFIG);
  db = firebase.firestore();

  applyConfig();
  bindNav();
  bindFilters();
  bindRHLogin();
  bindFormCandidature();
  bindFormPoste();
  bindConfigForm();
  bindRHTabs();
  bindDetailModal();
  listenPostes();
  listenCandidatures();
});

/* ============================================================
   CONFIG LOCALE (localStorage)
   ============================================================ */
function loadConfig() {
  try { return Object.assign({}, DEFAULT_CONFIG, JSON.parse(localStorage.getItem('rh_config') || '{}')); }
  catch { return { ...DEFAULT_CONFIG }; }
}
function saveConfig() { localStorage.setItem('rh_config', JSON.stringify(config)); }

function applyConfig() {
  const name = config.serverName || 'RECRUTEMENT';
  document.getElementById('site-name-nav').textContent = name;
  document.getElementById('footer-text').textContent = `© ${new Date().getFullYear()} — ${name}`;
}

/* ============================================================
   FIRESTORE — ÉCOUTE EN TEMPS RÉEL
   ============================================================ */
function listenPostes() {
  db.collection('postes').orderBy('createdAt', 'desc').onSnapshot(snap => {
    postes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const activeCat = document.querySelector('.filter-btn.active')?.dataset.cat || 'all';
    renderPostesPublic(activeCat);
    if (document.getElementById('rh-dashboard').style.display !== 'none') renderPostesRH();
  });
}

function listenCandidatures() {
  db.collection('candidatures').orderBy('createdAt', 'desc').onSnapshot(snap => {
    candidatures = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (document.getElementById('rh-dashboard').style.display !== 'none') renderCandidaturesRH();
    // Met à jour la modal de détail si ouverte
    if (currentCand && document.getElementById('modal-cand-detail').style.display !== 'none') {
      const updated = candidatures.find(c => c.id === currentCand.id);
      if (updated) { currentCand = updated; renderDetailActions(updated); }
    }
  });
}

/* ============================================================
   POSTES PUBLICS
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
      <button class="btn-postuler">Postuler →</button>
    `;
    card.querySelector('.btn-postuler').addEventListener('click', () => openPostuler(p));
    grid.appendChild(card);
  });
}

function bindFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPostesPublic(btn.dataset.cat);
    });
  });
}

function bindNav() {
  document.getElementById('btn-open-rh-login').addEventListener('click', () => show('modal-rh-login'));
}

/* ============================================================
   POSTULER
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

    setBtnLoading(true);

    const cand = {
      posteId:  currentPoste.id,
      posteNom: currentPoste.nom,
      posteCat: currentPoste.cat,
      prenom, nom, rp, email, motiv,
      cv: cv || '', extra: extra || '',
      statut: 'en_attente',
      date: new Date().toLocaleDateString('fr-FR'),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('candidatures').add(cand);
    await sendMailRH(cand);
    await sendMailAccuse(cand);

    setBtnLoading(false);
    hide('modal-postuler');
    toast('✓ Candidature envoyée avec succès !', 'success');
  });
}

function setBtnLoading(loading) {
  document.getElementById('btn-submit-text').style.display   = loading ? 'none' : '';
  document.getElementById('btn-submit-loader').style.display = loading ? '' : 'none';
  document.getElementById('btn-submit-cand').disabled = loading;
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
    if (val('rh-password') === config.password) {
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
  document.getElementById('navbar').style.display  = 'none';
  document.getElementById('hero').style.display    = 'none';
  document.getElementById('postes').style.display  = 'none';
  document.querySelector('footer').style.display   = 'none';
  document.getElementById('rh-dashboard').style.display = '';
  renderCandidaturesRH();
  renderPostesRH();
  fillConfigForm();
}

function closeDashboard() {
  document.getElementById('navbar').style.display  = '';
  document.getElementById('hero').style.display    = '';
  document.getElementById('postes').style.display  = '';
  document.querySelector('footer').style.display   = '';
  document.getElementById('rh-dashboard').style.display = 'none';
}

document.getElementById('btn-logout').addEventListener('click', closeDashboard);

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

/* ── CANDIDATURES ── */
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

  list.forEach(c => {
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

document.getElementById('btn-nouveau-poste').addEventListener('click', () => {
  editPosteId = null;
  document.getElementById('nouveau-poste-title').textContent = 'Nouveau poste';
  document.getElementById('btn-submit-poste').textContent    = 'Créer le poste';
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
  document.getElementById('btn-submit-poste').textContent    = 'Enregistrer';
  document.getElementById('poste-nom').value    = p.nom;
  document.getElementById('poste-cat').value    = p.cat;
  document.getElementById('poste-desc').value   = p.desc;
  document.getElementById('poste-prereq').value = p.prereq || '';
  show('modal-nouveau-poste');
}

function bindFormPoste() {
  document.getElementById('form-poste').addEventListener('submit', async e => {
    e.preventDefault();
    const nom    = val('poste-nom');
    const cat    = val('poste-cat');
    const desc   = val('poste-desc');
    const prereq = val('poste-prereq');
    if (!nom || !cat || !desc) return;

    if (editPosteId) {
      await db.collection('postes').doc(editPosteId).update({ nom, cat, desc, prereq });
    } else {
      await db.collection('postes').add({
        nom, cat, desc, prereq,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    hide('modal-nouveau-poste');
    toast(editPosteId ? '✓ Poste modifié' : '✓ Poste créé', 'success');
  });
}

async function deletePoste(id) {
  if (!confirm('Supprimer ce poste ?')) return;
  await db.collection('postes').doc(id).delete();
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
  document.getElementById('detail-cat').textContent        = c.posteCat;
  document.getElementById('detail-cat').className          = `modal-tag cat-badge cat-${c.posteCat}`;
  document.getElementById('detail-poste').textContent      = c.posteNom;
  document.getElementById('detail-nom').textContent        = `${c.prenom} ${c.nom}`;
  document.getElementById('detail-rp').textContent         = c.rp;
  document.getElementById('detail-email').textContent      = c.email;
  document.getElementById('detail-motivation').textContent = c.motiv;
  document.getElementById('detail-extra').textContent      = c.extra || '—';
  const cvEl = document.getElementById('detail-cv');
  cvEl.innerHTML = c.cv
    ? `<a href="${esc(c.cv)}" target="_blank" style="color:var(--yellow)">${esc(c.cv)}</a>`
    : '—';
  renderDetailActions(c);
  show('modal-cand-detail');
}

function renderDetailActions(c) {
  const container = document.getElementById('detail-actions');
  container.innerHTML = '';
  if (c.statut === 'accepte') {
    container.innerHTML = `<span style="color:var(--green);font-weight:700;font-size:13px;letter-spacing:0.05em">✓ CANDIDATURE ACCEPTÉE</span>`;
    return;
  }
  if (c.statut === 'refuse') {
    container.innerHTML = `<span style="color:var(--red);font-weight:700;font-size:13px;letter-spacing:0.05em">✕ CANDIDATURE REFUSÉE</span>`;
    return;
  }
  if (c.statut === 'en_attente') {
    container.appendChild(makeActionBtn('Prendre en charge', 'charge', () => actionCand(c, 'en_charge')));
  }
  container.appendChild(makeActionBtn('✓ Accepter', 'accept', () => actionCand(c, 'accepte')));
  container.appendChild(makeActionBtn('✕ Refuser',  'refuse', () => actionCand(c, 'refuse')));
}

function makeActionBtn(label, cls, handler) {
  const btn = document.createElement('button');
  btn.className = `btn-action ${cls}`;
  btn.textContent = label;
  btn.addEventListener('click', handler);
  return btn;
}

async function actionCand(c, newStatut) {
  await db.collection('candidatures').doc(c.id).update({ statut: newStatut });
  const updated = { ...c, statut: newStatut };
  currentCand = updated;
  if (newStatut === 'en_charge') await sendMailCharge(updated);
  if (newStatut === 'accepte')   await sendMailAccept(updated);
  if (newStatut === 'refuse')    await sendMailRefuse(updated);
  renderDetailActions(updated);
  toast(
    newStatut === 'en_charge' ? '📧 Email de prise en charge envoyé' :
    newStatut === 'accepte'   ? '✓ Candidature acceptée — email envoyé' :
                                '✕ Candidature refusée — email envoyé',
    newStatut === 'refuse' ? 'error' : 'success'
  );
}

/* ============================================================
   CONFIG
   ============================================================ */
function fillConfigForm() {
  document.getElementById('cfg-rh-email').value    = config.rhEmail    || '';
  document.getElementById('cfg-server-name').value = config.serverName || '';
  document.getElementById('cfg-password').value    = '';
}

function bindConfigForm() {
  document.getElementById('btn-save-config').addEventListener('click', () => {
    config.rhEmail    = val('cfg-rh-email');
    config.serverName = val('cfg-server-name') || 'MON SERVEUR';
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
   FORMSUBMIT — MAILS (tes textes conservés)
   ============================================================ */
async function fsSend(to, subject, body) {
  if (!to) return;
  try {
    const res = await fetch(FORMSUBMIT_URL(to), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        subject, message: body,
        _subject: subject, _captcha: 'false', _template: 'box',
        from_name: config.serverName || 'Recrutement',
      }),
    });
    const data = await res.json();
    console.log(data.success ? `[Mail] ✅ Envoyé à ${to}` : `[Mail] ❌ ${data.message}`);
  } catch(err) { console.error('[Mail] ❌ Réseau :', err); }
}

async function sendMailRH(c) {
  if (!config.rhEmail) return;
  await fsSend(config.rhEmail,
    `[${config.serverName}] Nouvelle candidature — ${c.posteNom}`,
    `Nouvelle candidature sur ${config.serverName}.\n\nPoste : ${c.posteNom} (${c.posteCat})\nCandidat : ${c.prenom} ${c.nom}\nRP : ${c.rp}\nEmail : ${c.email}\nDate : ${c.date}\n\nMOTIVATION :\n${c.motiv}\n\nCV : ${c.cv || 'Non fourni'}\n\nINFOS SUPP. :\n${c.extra || 'Aucune'}`
  );
}

async function sendMailAccuse(c) {
  await fsSend(c.email,
    `[${config.serverName}] Candidature reçue — ${c.posteNom}`,
    `Bonjour ${c.prenom},\n\nNous avons bien reçu votre candidature et nous vous remercions de la confiance que vous nous témoignez.\n\nVotre dossier a été transmis à la personne en charge de ce recrutement, qui reviendra vers vous si votre candidature correspond à la recherche en cours. Si vous n'êtes pas contacté prochainement, veuillez considérer que votre profil ne correspond pas à la recherche en cours.\n\nNéanmoins, votre profil est susceptible de nous intéresser pour d'autres postes que nous aurions à pourvoir.\n\nAussi, sauf avis contraire de votre part, nous vous proposons de conserver votre dossier afin de pouvoir vous recontacter en fonction de futures opportunités.\n\nLe service des Ressources Humaines`
  );
}

async function sendMailCharge(c) {
  await fsSend(c.email,
    `[${config.serverName}] Ta candidature est prise en charge`,
    `Bonjour ${c.prenom},\n\nVotre candidature pour le poste ${c.posteNom} sur ${config.serverName} — Nous accusons réception de votre candidature et nous vous remercions de l'intérêt que vous portez à la société. Votre dossier sera traité dans les plus brefs délais.\n\nCependant si aucune réponse ne vous a été formulée dans un délai de deux mois suivant votre candidature, considérez que votre dossier n'est pas retenu.\n\nNous vous prions d'agréer, nos salutations les meilleures.\n\nLe service des Ressources Humaines`
  );
}

async function sendMailAccept(c) {
  await fsSend(c.email,
    `[${config.serverName}] Candidature acceptée !`,
    `Bonjour ${c.prenom},\n\nVotre candidature pour le poste ${c.posteNom} sur ${config.serverName} a été acceptée.\n\nBienvenue dans l'équipe ! Nous allons vous recontacter prochainement.\n\nLe service des Ressources Humaines`
  );
}

async function sendMailRefuse(c) {
  await fsSend(c.email,
    `[${config.serverName}] Résultat de ta candidature`,
    `Bonjour ${c.prenom},\n\nMalgré tout l'intérêt de votre candidature pour le poste ${c.posteNom} sur ${config.serverName}, nous sommes dans le regret de ne pas pouvoir donner suite à votre demande. Nous vous souhaitons de trouver satisfaction dans votre recherche.\n\nLe service des Ressources Humaines`
  );
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
