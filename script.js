// ── Wallet keys ────────────────────────────────────────────────────────────
const KEY_WALLETS   = 'daftarAirdrop_wallets';   // [{id, name}]
const KEY_ACTIVE_W  = 'daftarAirdrop_activeWallet';

// ── Per‑wallet storage helpers ──────────────────────────────────────────────
function walletMainKey(wid)    { return `daftarAirdrop_v1__${wid}`; }
function walletArchiveKey(wid) { return `daftarAirdrop_arsip__${wid}`; }

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ── Wallet state ────────────────────────────────────────────────────────────
let wallets = [];         // [{id, name}]
let activeWalletId = null;
let isArchiveView = false;

// ── DOM refs ────────────────────────────────────────────────────────────────
const body           = document.getElementById('body');
const empty          = document.getElementById('empty');
const pageTitle      = document.getElementById('pageTitle');
const switchArchiveBtn = document.getElementById('switchArchive');
const walletSelect   = document.getElementById('walletSelect');

// ── Current storage key ─────────────────────────────────────────────────────
function currentKey() {
  return isArchiveView
    ? walletArchiveKey(activeWalletId)
    : walletMainKey(activeWalletId);
}

// ── Wallet persistence ──────────────────────────────────────────────────────
function saveWallets() {
  localStorage.setItem(KEY_WALLETS, JSON.stringify(wallets));
}

function loadWallets() {
  const raw = localStorage.getItem(KEY_WALLETS);
  wallets = raw ? JSON.parse(raw) : [];

  if (wallets.length === 0) {
    // Migrate legacy data (no‑wallet era) into a default wallet
    const legacyMain    = localStorage.getItem('daftarAirdrop_v1');
    const legacyArchive = localStorage.getItem('daftarAirdrop_arsip');
    const def = { id: genId(), name: 'Wallet Utama' };
    wallets.push(def);
    if (legacyMain)    localStorage.setItem(walletMainKey(def.id),    legacyMain);
    if (legacyArchive) localStorage.setItem(walletArchiveKey(def.id), legacyArchive);
    saveWallets();
  }

  const savedActive = localStorage.getItem(KEY_ACTIVE_W);
  activeWalletId = wallets.find(w => w.id === savedActive)
    ? savedActive
    : wallets[0].id;

  localStorage.setItem(KEY_ACTIVE_W, activeWalletId);
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
function addWallet() {
  const name = prompt('Nama wallet baru:');
  if (!name || !name.trim()) return;
  const w = { id: genId(), name: name.trim() };
  wallets.push(w);
  saveWallets();
  activeWalletId = w.id;
  localStorage.setItem(KEY_ACTIVE_W, activeWalletId);
  renderWalletSelect();
  load();
}

function editWallet() {
  const w = wallets.find(w => w.id === activeWalletId);
  if (!w) return;
  const name = prompt('Edit nama wallet:', w.name);
  if (!name || !name.trim()) return;
  w.name = name.trim();
  saveWallets();
  renderWalletSelect();
}

function deleteWallet() {
  if (wallets.length === 1) {
    alert('Minimal harus ada satu wallet.');
    return;
  }
  const w = wallets.find(w => w.id === activeWalletId);
  if (!confirm(`Hapus wallet "${w.name}" beserta semua datanya?`)) return;

  // Remove data
  localStorage.removeItem(walletMainKey(activeWalletId));
  localStorage.removeItem(walletArchiveKey(activeWalletId));

  wallets = wallets.filter(w => w.id !== activeWalletId);
  saveWallets();
  activeWalletId = wallets[0].id;
  localStorage.setItem(KEY_ACTIVE_W, activeWalletId);
  renderWalletSelect();
  load();
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
// linkData: string (legacy) | { url, type: 'normal'|'ref' }
function makeLink(linkData = '') {
  const isObj   = typeof linkData === 'object' && linkData !== null;
  const url     = isObj ? (linkData.url  || '') : linkData;
  const type    = isObj ? (linkData.type || 'normal') : 'normal';

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

    // Shift+click → edit URL
    if (e.shiftKey) {
      const nu = prompt('Edit URL:', a.dataset.url || '');
      if (nu === null) return;
      a.dataset.url = nu.trim();
      applyAppearance();
      save();
      return;
    }

    if (a.dataset.linkType === 'ref') {
      // Ref-link: copy to clipboard
      const txt = a.dataset.url || '';
      const flash = (ok) => {
        const prev = a.textContent;
        a.textContent = ok ? '✅' : '❌';
        setTimeout(() => { a.textContent = prev; }, 1300);
      };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(txt).then(() => flash(true)).catch(() => flash(false));
      } else {
        // Fallback execCommand
        const ta = document.createElement('textarea');
        ta.value = txt;
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); flash(true); } catch { flash(false); }
        document.body.removeChild(ta);
      }
    } else {
      // Normal link: open in new tab
      if (a.dataset.url) window.open(a.dataset.url, '_blank', 'noopener,noreferrer');
    }
  });

  // Right-click → toggle between normal ↔ ref
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
  const tds = tr.querySelectorAll('td');
  const grab = i =>
    Array.from(tds[i].querySelectorAll('.item'))
      .map(d => d.dataset.value?.trim() || d.textContent.trim())
      .filter(Boolean);
  return {
    nama: grab(0),
    deskripsi: grab(1),
    type: grab(2),
    status: tds[3].querySelector('input').checked,
    links: Array.from(tds[4].querySelectorAll('.link')).map(a => ({
      url:  a.dataset.url      || '',
      type: a.dataset.linkType || 'normal'
    }))
  };
}

// ── Row builder ──────────────────────────────────────────────────────────────
function createRow(data = null) {
  const d = data || sampleRow();
  const tr = document.createElement('tr');
  if (d.status) tr.classList.add('completed');

  const makeTd = (items) => {
    const td = document.createElement('td');
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
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = !!d.status;
  chk.addEventListener('change', () => {
    tr.classList.toggle('completed', chk.checked);
    save();
  });
  tdStatus.appendChild(chk);
  tr.appendChild(tdStatus);

  const tdLink = document.createElement('td');
  const linkContainer = document.createElement('div');
  linkContainer.className = 'cell';
  (d.links || []).forEach(u => linkContainer.appendChild(makeLink(u)));
  const addLink = document.createElement('span');
  addLink.className = 'add-item';
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

  const tdA = document.createElement('td');
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
function moveRow(tr, toArchive) {
  const fromKey = toArchive ? walletMainKey(activeWalletId)    : walletArchiveKey(activeWalletId);
  const toKey   = toArchive ? walletArchiveKey(activeWalletId) : walletMainKey(activeWalletId);
  const rowData = extractRowData(tr);

  const fromData = JSON.parse(localStorage.getItem(fromKey) || '[]')
    .filter(r => JSON.stringify(r) !== JSON.stringify(rowData));
  const toData = JSON.parse(localStorage.getItem(toKey) || '[]');

  localStorage.setItem(fromKey, JSON.stringify(fromData));
  toData.push(rowData);
  localStorage.setItem(toKey, JSON.stringify(toData));

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
    allOption.className = 'filter-option active';
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
      option.className = 'filter-option';
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
  localStorage.setItem(currentKey(), JSON.stringify(rows));
  toggleEmpty();
}

function load() {
  const raw = JSON.parse(localStorage.getItem(currentKey()) || '[]');
  body.innerHTML = '';
  raw.forEach(r => body.appendChild(createRow(r)));
  toggleEmpty();
  if (typeof updateFilterOptions === 'function') updateFilterOptions();
}

// ── Export / Import ──────────────────────────────────────────────────────────
document.getElementById('exportData').addEventListener('click', () => {
  // Export all wallets + their data
  const walletData = wallets.map(w => ({
    id: w.id,
    name: w.name,
    main:    JSON.parse(localStorage.getItem(walletMainKey(w.id))    || '[]'),
    archive: JSON.parse(localStorage.getItem(walletArchiveKey(w.id)) || '[]'),
  }));

  const payload = {
    version: 2,
    wallets: walletData,
    activeWalletId,
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
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
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);

      if (!confirm('Import akan menimpa data saat ini. Lanjutkan?')) return;

      if (data.version === 2 && Array.isArray(data.wallets)) {
        // New multi‑wallet format
        data.wallets.forEach(w => {
          localStorage.setItem(walletMainKey(w.id),    JSON.stringify(w.main    || []));
          localStorage.setItem(walletArchiveKey(w.id), JSON.stringify(w.archive || []));
        });
        wallets = data.wallets.map(({ id, name }) => ({ id, name }));
        saveWallets();
        activeWalletId = data.activeWalletId || wallets[0].id;
      } else if (data.main || data.archive) {
        // Legacy single‑wallet format → import into current wallet
        localStorage.setItem(walletMainKey(activeWalletId),    JSON.stringify(data.main    || []));
        localStorage.setItem(walletArchiveKey(activeWalletId), JSON.stringify(data.archive || []));
      } else {
        alert('Format file tidak valid');
        return;
      }

      localStorage.setItem(KEY_ACTIVE_W, activeWalletId);
      renderWalletSelect();
      load();
      alert('Import berhasil');
    } catch (err) {
      alert('Gagal membaca file JSON');
    }
  };

  reader.readAsText(file);
  e.target.value = '';
});

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadWallets();
  renderWalletSelect();
  load();
  setupFilter();

  // Wallet events
  walletSelect.addEventListener('change', () => {
    activeWalletId = walletSelect.value;
    localStorage.setItem(KEY_ACTIVE_W, activeWalletId);
    load();
  });

  document.getElementById('addWallet').addEventListener('click', addWallet);
  document.getElementById('editWallet').addEventListener('click', editWallet);
  document.getElementById('deleteWallet').addEventListener('click', deleteWallet);

  // Existing toolbar
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

  document.getElementById('clearAll').addEventListener('click', () => {
    if (confirm('Hapus semua data?')) {
      localStorage.removeItem(currentKey());
      body.innerHTML = '';
      toggleEmpty();
      updateFilterOptions();
    }
  });

  switchArchiveBtn.addEventListener('click', () => {
    isArchiveView = !isArchiveView;
    document.body.classList.toggle('archive-mode', isArchiveView);
    pageTitle.textContent = isArchiveView ? 'Arsip Airdrop' : 'Daftar Airdrop';
    switchArchiveBtn.textContent = isArchiveView ? '⬅ Kembali ke Utama' : '📁 Arsip';
    load();
  });
});