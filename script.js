// ══════════════════════════════════════════════════════════════
//  IndexedDB wrapper
// ══════════════════════════════════════════════════════════════
const DB_NAME    = 'DaftarAirdropDB';
const DB_VERSION = 1;
const STORE      = 'kv';   // simple key-value object store

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE);
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = e  => reject(e.target.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = e  => reject(e.target.error);
  });
}

async function idbDel(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = e  => reject(e.target.error);
  });
}

// ── Wallet keys ────────────────────────────────────────────────────────────
const KEY_WALLETS  = 'daftarAirdrop_wallets';
const KEY_ACTIVE_W = 'daftarAirdrop_activeWallet';

function walletMainKey(wid)    { return `daftarAirdrop_v1__${wid}`; }
function walletArchiveKey(wid) { return `daftarAirdrop_arsip__${wid}`; }

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ── Wallet state ────────────────────────────────────────────────────────────
let wallets       = [];
let activeWalletId = null;
let isArchiveView  = false;

// ── DOM refs ────────────────────────────────────────────────────────────────
const body             = document.getElementById('body');
const empty            = document.getElementById('empty');
const pageTitle        = document.getElementById('pageTitle');
const switchArchiveBtn = document.getElementById('switchArchive');
const walletSelect     = document.getElementById('walletSelect');

// ── Current storage key ─────────────────────────────────────────────────────
function currentKey() {
  return isArchiveView
    ? walletArchiveKey(activeWalletId)
    : walletMainKey(activeWalletId);
}

// ── Wallet persistence ──────────────────────────────────────────────────────
async function saveWallets() {
  await idbSet(KEY_WALLETS,  wallets);
  await idbSet(KEY_ACTIVE_W, activeWalletId);
}

async function loadWallets() {
  wallets = (await idbGet(KEY_WALLETS)) || [];

  if (wallets.length === 0) {
    // Migrate from localStorage (legacy) if present
    const legacyWallets  = localStorage.getItem(KEY_WALLETS);
    const legacyActive   = localStorage.getItem(KEY_ACTIVE_W);

    if (legacyWallets) {
      wallets = JSON.parse(legacyWallets);

      // Copy each wallet's data from localStorage into IndexedDB
      for (const w of wallets) {
        const main    = localStorage.getItem(walletMainKey(w.id));
        const archive = localStorage.getItem(walletArchiveKey(w.id));
        if (main)    await idbSet(walletMainKey(w.id),    JSON.parse(main));
        if (archive) await idbSet(walletArchiveKey(w.id), JSON.parse(archive));
      }

      activeWalletId = legacyActive || wallets[0].id;
      await saveWallets();

      // Clean up old localStorage keys (optional, but tidy)
      localStorage.removeItem(KEY_WALLETS);
      localStorage.removeItem(KEY_ACTIVE_W);
      wallets.forEach(w => {
        localStorage.removeItem(walletMainKey(w.id));
        localStorage.removeItem(walletArchiveKey(w.id));
      });

    } else {
      // Brand-new install: check for very old single-wallet localStorage data
      const legacyMain    = localStorage.getItem('daftarAirdrop_v1');
      const legacyArchive = localStorage.getItem('daftarAirdrop_arsip');
      const def = { id: genId(), name: 'Wallet Utama' };
      wallets.push(def);
      if (legacyMain)    await idbSet(walletMainKey(def.id),    JSON.parse(legacyMain));
      if (legacyArchive) await idbSet(walletArchiveKey(def.id), JSON.parse(legacyArchive));
      activeWalletId = def.id;
      await saveWallets();
    }
  } else {
    const savedActive = await idbGet(KEY_ACTIVE_W);
    activeWalletId = wallets.find(w => w.id === savedActive)
      ? savedActive
      : wallets[0].id;
    await idbSet(KEY_ACTIVE_W, activeWalletId);
  }
}

// ── Render wallet dropdown ──────────────────────────────────────────────────
function renderWalletSelect() {
  walletSelect.innerHTML = '';
  wallets.forEach(w => {
    const opt = document.createElement('option');
    opt.value = w.id;
    opt.textContent = w.name;
    if (w.id === activeWalletId) opt.selected = true;
    walletSelect.appendChild(opt);
  });
}

// ── Wallet CRUD ─────────────────────────────────────────────────────────────
async function addWallet() {
  const name = prompt('Nama wallet baru:');
  if (!name || !name.trim()) return;
  const w = { id: genId(), name: name.trim() };
  wallets.push(w);
  activeWalletId = w.id;
  await saveWallets();
  renderWalletSelect();
  await load();
}

async function editWallet() {
  const w = wallets.find(w => w.id === activeWalletId);
  if (!w) return;
  const name = prompt('Edit nama wallet:', w.name);
  if (!name || !name.trim()) return;
  w.name = name.trim();
  await saveWallets();
  renderWalletSelect();
}

async function deleteWallet() {
  if (wallets.length === 1) {
    alert('Minimal harus ada satu wallet.');
    return;
  }
  const w = wallets.find(w => w.id === activeWalletId);
  if (!confirm(`Hapus wallet "${w.name}" beserta semua datanya?`)) return;

  await idbDel(walletMainKey(activeWalletId));
  await idbDel(walletArchiveKey(activeWalletId));

  wallets = wallets.filter(w => w.id !== activeWalletId);
  activeWalletId = wallets[0].id;
  await saveWallets();
  renderWalletSelect();
  await load();
}

// ── Sample row ──────────────────────────────────────────────────────────────
const sampleRow = () => ({
  nama: ['Contoh Airdrop'],
  deskripsi: ['Ringkasan singkat'],
  type: ['DeFi'],
  status: false,
  links: [{ url: 'https://example.com', type: 'normal' }]
});

// ── UI helpers ───────────────────────────────────────────────────────────────
function refreshPlusPosition(wrap) {
  const plus = wrap.querySelector('.add-item');
  if (plus && plus !== wrap.lastElementChild) wrap.appendChild(plus);
}

function toggleEmpty() {
  empty.classList.toggle('hidden', body.children.length > 0);
}

// ── Item ────────────────────────────────────────────────────────────────────
function makeItem(text = '') {
  const d = document.createElement('div');
  d.className = 'item';
  d.contentEditable = true;
  d.textContent = text;
  d.dataset.value = text;

  d.addEventListener('input', e => {
    e.target.dataset.value = e.target.textContent;
    save();
    refreshPlusPosition(e.target.parentElement);
  });

  d.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  });

  return d;
}

// ── Link ────────────────────────────────────────────────────────────────────
function makeLink(linkData = '') {
  const isObj = typeof linkData === 'object' && linkData !== null;
  const url   = isObj ? (linkData.url  || '') : linkData;
  const type  = isObj ? (linkData.type || 'normal') : 'normal';

  const a = document.createElement('a');
  a.className = 'link';
  a.href = '#';
  a.dataset.url      = url;
  a.dataset.linkType = type;

  function applyAppearance() {
    const isRef = a.dataset.linkType === 'ref';
    a.textContent = isRef ? '🏷️' : '🔗';
    a.classList.toggle('link-ref', isRef);
    a.title = isRef
      ? `[Ref-Link] ${a.dataset.url || '—'}\nKlik: copy URL · Shift+Klik: edit · Klik kanan: ubah jenis`
      : `[Link] ${a.dataset.url || '—'}\nKlik: buka URL · Shift+Klik: edit · Klik kanan: ubah jenis`;
  }

  applyAppearance();

  a.addEventListener('click', e => {
    e.preventDefault();

    if (e.shiftKey) {
      const nu = prompt('Edit URL:', a.dataset.url || '');
      if (nu === null) return;
      a.dataset.url = nu.trim();
      applyAppearance();
      save();
      return;
    }

    if (a.dataset.linkType === 'ref') {
      const txt = a.dataset.url || '';
      const flash = (ok) => {
        const prev = a.textContent;
        a.textContent = ok ? '✅' : '❌';
        setTimeout(() => { a.textContent = prev; }, 1300);
      };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(txt).then(() => flash(true)).catch(() => flash(false));
      } else {
        const ta = document.createElement('textarea');
        ta.value = txt;
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); flash(true); } catch { flash(false); }
        document.body.removeChild(ta);
      }
    } else {
      if (a.dataset.url) window.open(a.dataset.url, '_blank', 'noopener,noreferrer');
    }
  });

  a.addEventListener('contextmenu', e => {
    e.preventDefault();
    a.dataset.linkType = a.dataset.linkType === 'ref' ? 'normal' : 'ref';
    applyAppearance();
    save();
  });

  return a;
}

// ── Row extractor ────────────────────────────────────────────────────────────
function extractRowData(tr) {
  const tds  = tr.querySelectorAll('td');
  const grab = i =>
    Array.from(tds[i].querySelectorAll('.item'))
      .map(d => d.dataset.value?.trim() || d.textContent.trim())
      .filter(Boolean);
  return {
    nama:      grab(0),
    deskripsi: grab(1),
    type:      grab(2),
    status:    tds[3].querySelector('input').checked,
    links: Array.from(tds[4].querySelectorAll('.link')).map(a => ({
      url:  a.dataset.url      || '',
      type: a.dataset.linkType || 'normal'
    }))
  };
}

// ── Row builder ──────────────────────────────────────────────────────────────
function createRow(data = null) {
  const d  = data || sampleRow();
  const tr = document.createElement('tr');
  if (d.status) tr.classList.add('completed');

  const makeTd = (items) => {
    const td   = document.createElement('td');
    const wrap = document.createElement('div');
    wrap.className = 'cell';
    (items || []).forEach(it => wrap.appendChild(makeItem(it)));

    const plus = document.createElement('span');
    plus.className = 'add-item';
    plus.textContent = '+';
    plus.addEventListener('click', () => {
      const it = makeItem('');
      wrap.insertBefore(it, plus);
      it.focus();
      save();
      refreshPlusPosition(wrap);
      updateFilterOptions();
    });

    wrap.appendChild(plus);
    td.appendChild(wrap);
    return td;
  };

  tr.appendChild(makeTd(d.nama));
  tr.appendChild(makeTd(d.deskripsi));
  tr.appendChild(makeTd(d.type));

  const tdStatus = document.createElement('td');
  const chk      = document.createElement('input');
  chk.type    = 'checkbox';
  chk.checked = !!d.status;
  chk.addEventListener('change', () => {
    tr.classList.toggle('completed', chk.checked);
    save();
  });
  tdStatus.appendChild(chk);
  tr.appendChild(tdStatus);

  const tdLink        = document.createElement('td');
  const linkContainer = document.createElement('div');
  linkContainer.className = 'cell';
  (d.links || []).forEach(u => linkContainer.appendChild(makeLink(u)));
  const addLink = document.createElement('span');
  addLink.className   = 'add-item';
  addLink.textContent = '+ link';
  addLink.addEventListener('click', () => {
    const url = prompt('Masukkan URL:');
    if (!url || !url.trim()) return;
    const isRef = confirm(
      'Pilih jenis link:\n\n' +
      '✅ OK       → Ref-Link 🏷️  (klik = copy URL)\n' +
      '❌ Batal  → Link Biasa 🔗 (klik = buka URL)'
    );
    linkContainer.insertBefore(
      makeLink({ url: url.trim(), type: isRef ? 'ref' : 'normal' }),
      addLink
    );
    save();
    refreshPlusPosition(linkContainer);
  });
  linkContainer.appendChild(addLink);
  tdLink.appendChild(linkContainer);
  tr.appendChild(tdLink);

  const tdA     = document.createElement('td');
  tdA.className = 'btns';

  const moveBtn = document.createElement('button');
  moveBtn.textContent = isArchiveView ? '↩ Kembalikan' : '📦 Arsipkan';
  moveBtn.addEventListener('click', () => moveRow(tr, !isArchiveView));
  tdA.appendChild(moveBtn);

  const del = document.createElement('button');
  del.textContent = '✖';
  del.addEventListener('click', () => {
    if (confirm('Hapus baris ini?')) {
      tr.remove();
      save();
      updateFilterOptions();
    }
  });
  tdA.appendChild(del);

  tr.appendChild(tdA);
  return tr;
}

// ── Archive / main swap ──────────────────────────────────────────────────────
async function moveRow(tr, toArchive) {
  const fromKey = toArchive ? walletMainKey(activeWalletId)    : walletArchiveKey(activeWalletId);
  const toKey   = toArchive ? walletArchiveKey(activeWalletId) : walletMainKey(activeWalletId);
  const rowData = extractRowData(tr);

  const fromData = ((await idbGet(fromKey)) || [])
    .filter(r => JSON.stringify(r) !== JSON.stringify(rowData));
  const toData = (await idbGet(toKey)) || [];

  await idbSet(fromKey, fromData);
  toData.push(rowData);
  await idbSet(toKey, toData);

  tr.remove();
  toggleEmpty();
  updateFilterOptions();
}

// ── Filter Tipe ──────────────────────────────────────────────────────────────
function setupFilter() {
  const filterButton = document.getElementById('filter');
  let filterContainer = document.querySelector('.filter-container');
  if (!filterContainer) {
    filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container';
    filterButton.parentNode.insertBefore(filterContainer, filterButton.nextSibling);
  }

  filterButton.addEventListener('click', () => {
    filterContainer.classList.toggle('active');
    updateFilterOptions();
  });

  window.updateFilterOptions = function () {
    const types = new Set();
    body.querySelectorAll('tr').forEach(tr => {
      tr.querySelectorAll('td:nth-child(3) .item').forEach(item => {
        if (item.textContent.trim()) types.add(item.textContent.trim());
      });
    });

    filterContainer.innerHTML = '';

    const allOption = document.createElement('span');
    allOption.className   = 'filter-option active';
    allOption.textContent = 'Semua';
    allOption.dataset.filter = 'all';
    allOption.addEventListener('click', () => {
      document.querySelectorAll('.filter-option').forEach(opt => opt.classList.remove('active'));
      allOption.classList.add('active');
      body.querySelectorAll('tr').forEach(tr => tr.style.display = '');
    });
    filterContainer.appendChild(allOption);

    types.forEach(type => {
      const option = document.createElement('span');
      option.className   = 'filter-option';
      option.textContent = type;
      option.dataset.filter = type;
      option.addEventListener('click', () => {
        document.querySelectorAll('.filter-option').forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        body.querySelectorAll('tr').forEach(tr => {
          const typeItems = Array.from(tr.querySelectorAll('td:nth-child(3) .item'))
            .map(item => item.textContent.trim());
          tr.style.display = typeItems.includes(type) ? '' : 'none';
        });
      });
      filterContainer.appendChild(option);
    });
  };
}

// ── Save / load ──────────────────────────────────────────────────────────────
function save() {
  const rows = Array.from(body.querySelectorAll('tr')).map(extractRowData);
  idbSet(currentKey(), rows).catch(err => console.error('Gagal simpan:', err));
  toggleEmpty();
}

async function load() {
  const raw = (await idbGet(currentKey())) || [];
  body.innerHTML = '';
  raw.forEach(r => body.appendChild(createRow(r)));
  toggleEmpty();
  if (typeof updateFilterOptions === 'function') updateFilterOptions();
}

// ── Export / Import ──────────────────────────────────────────────────────────
document.getElementById('exportData').addEventListener('click', async () => {
  const walletData = await Promise.all(wallets.map(async w => ({
    id:      w.id,
    name:    w.name,
    main:    (await idbGet(walletMainKey(w.id)))    || [],
    archive: (await idbGet(walletArchiveKey(w.id))) || [],
  })));

  const payload = {
    version: 2,
    wallets: walletData,
    activeWalletId,
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'daftar-airdrop.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('importData').addEventListener('click', () => {
  document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);

      if (!confirm('Import akan menimpa data saat ini. Lanjutkan?')) return;

      if (data.version === 2 && Array.isArray(data.wallets)) {
        for (const w of data.wallets) {
          await idbSet(walletMainKey(w.id),    w.main    || []);
          await idbSet(walletArchiveKey(w.id), w.archive || []);
        }
        wallets = data.wallets.map(({ id, name }) => ({ id, name }));
        activeWalletId = data.activeWalletId || wallets[0].id;
      } else if (data.main || data.archive) {
        await idbSet(walletMainKey(activeWalletId),    data.main    || []);
        await idbSet(walletArchiveKey(activeWalletId), data.archive || []);
      } else {
        alert('Format file tidak valid');
        return;
      }

      await saveWallets();
      renderWalletSelect();
      await load();
      alert('Import berhasil');
    } catch (err) {
      alert('Gagal membaca file JSON');
    }
  };

  reader.readAsText(file);
  e.target.value = '';
});

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadWallets();
  renderWalletSelect();
  await load();
  setupFilter();

  walletSelect.addEventListener('change', async () => {
    activeWalletId = walletSelect.value;
    await idbSet(KEY_ACTIVE_W, activeWalletId);
    await load();
  });

  document.getElementById('addWallet').addEventListener('click', addWallet);
  document.getElementById('editWallet').addEventListener('click', editWallet);
  document.getElementById('deleteWallet').addEventListener('click', deleteWallet);

  document.getElementById('addRow').addEventListener('click', () => {
    const row = createRow();
    body.insertBefore(row, body.firstChild);
    save();
    updateFilterOptions();
  });

  document.getElementById('resetStatus').addEventListener('click', () => {
    body.querySelectorAll('input[type="checkbox"]').forEach(c => {
      c.checked = false;
      c.closest('tr').classList.remove('completed');
    });
    save();
  });

  document.getElementById('clearAll').addEventListener('click', async () => {
    if (confirm('Hapus semua data?')) {
      await idbDel(currentKey());
      body.innerHTML = '';
      toggleEmpty();
      updateFilterOptions();
    }
  });

  switchArchiveBtn.addEventListener('click', async () => {
    isArchiveView = !isArchiveView;
    document.body.classList.toggle('archive-mode', isArchiveView);
    pageTitle.textContent       = isArchiveView ? 'Arsip Airdrop' : 'Daftar Airdrop';
    switchArchiveBtn.textContent = isArchiveView ? '⬅ Kembali ke Utama' : '📁 Arsip';
    await load();
  });
});