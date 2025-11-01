const KEY_MAIN = 'daftarAirdrop_v1';
const KEY_ARCHIVE = 'daftarAirdrop_arsip';
let isArchiveView = false;

const body = document.getElementById('body');
const empty = document.getElementById('empty');
const pageTitle = document.getElementById('pageTitle');
const switchArchiveBtn = document.getElementById('switchArchive');

const sampleRow = () => ({
  nama: ['Contoh Airdrop'],
  deskripsi: ['Ringkasan singkat'],
  type: ['DeFi'],
  status: false,
  links: ['https://example.com']
});

function currentKey() {
  return isArchiveView ? KEY_ARCHIVE : KEY_MAIN;
}

// --- UI helper
function refreshPlusPosition(wrap) {
  const plus = wrap.querySelector('.add-item');
  if (plus && plus !== wrap.lastElementChild) wrap.appendChild(plus);
}

function toggleEmpty() {
  empty.classList.toggle('hidden', body.children.length > 0);
}

// --- ITEM
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
    if (e.key === 'Enter') {
      e.preventDefault();
      e.target.blur();
    }
  });

  return d;
}

// --- LINK (Shift+Click untuk edit)
function makeLink(url = '') {
  const a = document.createElement('a');
  a.className = 'link';
  a.href = url || '#';
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.dataset.url = url;
  a.textContent = '🔗';
  a.title = url || 'Shift + Klik untuk edit URL';

  a.addEventListener('click', e => {
    if (e.shiftKey) {
      e.preventDefault();
      const nu = prompt('Edit URL:', a.dataset.url || '');
      if (nu === null) return;
      a.dataset.url = nu.trim();
      a.href = nu.startsWith('http') ? nu : 'https://' + nu;
      a.title = a.dataset.url || 'Shift + Klik untuk edit URL';
      save();
    }
  });

  return a;
}

// --- Row extractor
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
    links: Array.from(tds[4].querySelectorAll('.link')).map(a => a.dataset.url || '')
  };
}

// --- Row builder
function createRow(data = null) {
  const d = data || sampleRow();
  const tr = document.createElement('tr');
  if (d.status) tr.classList.add('completed');

  const td = (items) => {
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

  tr.appendChild(td(d.nama));
  tr.appendChild(td(d.deskripsi));
  tr.appendChild(td(d.type));

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
    const url = prompt('URL:');
    if (url) {
      linkContainer.insertBefore(makeLink(url), addLink);
      save();
      refreshPlusPosition(linkContainer);
    }
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

// --- Arsip / utama
function moveRow(tr, toArchive) {
  const fromKey = toArchive ? KEY_MAIN : KEY_ARCHIVE;
  const toKey = toArchive ? KEY_ARCHIVE : KEY_MAIN;
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

// --- Filter Tipe
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
      const typeItems = tr.querySelectorAll('td:nth-child(3) .item');
      typeItems.forEach(item => {
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

// --- Save/load
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
  if (typeof updateFilterOptions === 'function') {
    updateFilterOptions();
  }
}

// --- Init
document.addEventListener('DOMContentLoaded', () => {
  load();
  setupFilter();

  document.getElementById('addRow').addEventListener('click', () => {
    body.appendChild(createRow());
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