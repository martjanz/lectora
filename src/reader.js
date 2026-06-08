// Requires cleanup.js to be loaded first (pure functions in global scope).
// Requires vendor scripts: react, react-dom, reakit, djvu.js, djvu_viewer.js, villain.js, zip.min.js

const SUPPORTED = {
  pdfjs:     ['pdf'],
  foliatejs: ['epub', 'fb2', 'mobi', 'azw3'],
  djvujs:    ['djvu'],
  kthoom:    ['cbz', 'cbr'],
  villainjs: ['rar', 'zip'],
};

function displayError(msg) {
  document.getElementById('error-message').textContent = msg;
  document.getElementById('error-popup').style.display = 'flex';
}

function showViewer() {
  document.getElementById('drop-area').style.display = 'none';
  document.getElementById('viewer-container').style.display = 'block';
}

function attachFrameListener() {
  const iframe = document.querySelector('.viewer-frame');
  iframe.addEventListener('load', () => {
    try {
      const w = iframe.contentWindow;
      w.addEventListener('unhandledrejection', e => displayError(e.reason?.message));
      w.addEventListener('error', e => displayError((e.error || e).message));
      w.EventTarget.prototype.addEventListener = new Proxy(w.EventTarget.prototype.addEventListener, {
        apply(target, that, args) {
          if (args[0] === 'drop') return;
          return Reflect.apply(...arguments);
        }
      });
    } catch (_) {}
  });
}

function loadWithVillain(file) {
  showViewer();
  const root = ReactDOM.createRoot(document.getElementById('viewer-container'));
  root.render(React.createElement(window.villain, {
    source: file,
    style: { width: '100%', height: '100%' },
    options: { allowFullScreen: true, autoHideControls: false },
    workerUrl: '/libarchivejs/libarchivejs-1.3.0/dist/worker-bundle.js',
  }));
}

async function loadDjvuByFile(file) {
  showViewer();
  const buf = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsArrayBuffer(file);
  });
  const viewer = new DjVu.Viewer();
  viewer.render(document.getElementById('viewer-container'));
  viewer.loadDocument(buf);
}

window.fileInfoForMonkeyPatchedFetchFile = {};
window.fetchFile = async url => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const info = window.fileInfoForMonkeyPatchedFetchFile;
  if (url.startsWith('blob:') && info.name && info.type)
    return new File([await res.blob()], info.name, { type: info.type });
  return new File([await res.blob()], new URL(res.url).pathname);
};
window.addEventListener('message', e => {
  const f = document.getElementById('foliate-iframe');
  if (e.data === 'refocus-iframe' && f) f.contentWindow.focus();
});

async function loadViewerByUrl(url, ext) {
  const vc = document.getElementById('viewer-container');
  if (SUPPORTED.pdfjs.includes(ext)) {
    showViewer();
    vc.innerHTML = `<iframe src="/pdfjs/web/viewer.html?file=${encodeURI(url)}" class="viewer-frame" style="width:100%;height:100%;border:none"></iframe>`;
    attachFrameListener();
  } else if (SUPPORTED.foliatejs.includes(ext)) {
    showViewer();
    vc.innerHTML = `<iframe id="foliate-iframe" src="/foliatejs/reader.html?url=${encodeURI(url)}" class="viewer-frame" style="width:100%;height:100%;border:none"></iframe>`;
    attachFrameListener();
  } else if (SUPPORTED.kthoom.includes(ext)) {
    showViewer();
    vc.innerHTML = `<iframe src="/kthoom/index.html?bookUri=${encodeURI(url)}" class="viewer-frame" style="width:100%;height:100%;border:none"></iframe>`;
    attachFrameListener();
  } else if (ext === 'rar') {
    loadWithVillain(url);
  } else if (ext === 'zip') {
    const blob = await (await fetch(url)).blob();
    await loadZipOrBook(blob, url.split('/').pop() || '');
  } else {
    displayError('File type not supported');
  }
}

async function handleFileUpload(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (SUPPORTED.djvujs.includes(ext)) {
    await loadDjvuByFile(file);
    return;
  }
  window.fileInfoForMonkeyPatchedFetchFile = { name: file.name, type: file.type };
  if (ext === 'zip') {
    await loadZipOrBook(file, file.name);
  } else {
    await loadViewerByUrl(URL.createObjectURL(file), ext);
  }
}

const state = {
  pages: [],
  currentPage: 0,
  filename: '',
  mode: 'prose',
  fontSize: 18,
  dark: false,
};

function savePosition() {
  try { localStorage.setItem('lector_pos_' + state.filename, state.currentPage); }
  catch { /* best-effort */ }
}
function loadPosition(filename) {
  return parseInt(localStorage.getItem('lector_pos_' + filename)) || 0;
}

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem('lector_prefs')) || {}; }
  catch { return {}; }
}
function savePrefs() {
  try {
    localStorage.setItem('lector_prefs', JSON.stringify({
      fontSize: state.fontSize,
      dark: state.dark,
    }));
  } catch { /* storage unavailable — preferences are best-effort */ }
}
function applyPrefs() {
  document.body.setAttribute('data-dark', state.dark);
  document.documentElement.style.setProperty('--font-size', state.fontSize + 'px');
  document.getElementById('dark-btn').textContent = state.dark ? '☾' : '☀';
}

function renderCurrentPage() {
  const content = document.getElementById('page-content');
  const text = state.pages[state.currentPage] || '';
  content.className = state.mode;
  content.innerHTML = state.mode === 'prose' ? renderProse(text) : renderFaithful(text);
}

function updateUI() {
  document.getElementById('reader-page-info').textContent =
    `${state.currentPage + 1} / ${state.pages.length}`;
  const pct = state.pages.length <= 1 ? 0
    : (state.currentPage / (state.pages.length - 1)) * 100;
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('mode-btn').textContent =
    state.mode === 'prose' ? 'Prose' : 'Faithful';
  document.getElementById('dark-btn').textContent = state.dark ? '☾' : '☀';
}

function navigate(delta) {
  const next = state.currentPage + delta;
  if (next < 0 || next >= state.pages.length) return;
  state.currentPage = next;
  renderCurrentPage();
  updateUI();
  savePosition();
}

async function loadZipOrBook(blob, filename) {
  const reader = new zip.ZipReader(new zip.BlobReader(blob));
  try {
    let entries = await reader.getEntries();
    entries.sort((a, b) => a.filename.localeCompare(b.filename));

    const textEntries = entries.filter(e =>
      !e.directory &&
      !e.filename.startsWith('__MACOSX') &&
      !e.filename.split('/').pop().startsWith('._')
    );
    if (textEntries.length === 0) { displayError('Zip file is empty.'); return; }
    if (!textEntries.every(e => e.filename.endsWith('.txt'))) {
      loadWithVillain(new File([blob], filename || 'archive.zip', { type: blob.type }));
      return;
    }

    const pages = [];
    for (const entry of textEntries) {
      const text = await entry.getData(new zip.TextWriter());
      if (!isBlankPage(text)) pages.push(text);
    }

    if (pages.length === 0) { displayError('No readable pages found in this zip.'); return; }

    showReader(pages, filename, extractTitle(filename));
  } finally {
    await reader.close();
  }
}

function showReader(pages, filename, title) {
  state.pages = pages;
  state.filename = filename;
  state.mode = 'prose';
  const prefs = loadPrefs();
  state.fontSize = prefs.fontSize || 18;
  state.dark = prefs.dark || false;
  applyPrefs();
  state.currentPage = loadPosition(filename);
  if (state.currentPage < 0 || state.currentPage >= pages.length) state.currentPage = 0;

  document.getElementById('drop-area').style.display = 'none';
  document.getElementById('reader').style.display = 'flex';
  document.getElementById('reader-title').textContent = title;

  renderCurrentPage();
  updateUI();
}

window.addEventListener('error', e => displayError(e.error?.message || e.message));
window.addEventListener('unhandledrejection', e => displayError(e.reason?.message || e.reason));

document.addEventListener('DOMContentLoaded', () => {
  const dropArea = document.getElementById('drop-area');
  const fileInput = document.getElementById('file-input');
  dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.classList.add('drag-over'); });
  dropArea.addEventListener('dragleave', () => dropArea.classList.remove('drag-over'));
  dropArea.addEventListener('drop', e => {
    e.preventDefault();
    dropArea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 1) { displayError('Please upload only one file.'); return; }
    if (files.length > 0) handleFileUpload(files[0]);
  });
  dropArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) handleFileUpload(fileInput.files[0]);
  });

  document.getElementById('error-close').addEventListener('click', () => {
    document.getElementById('error-popup').style.display = 'none';
  });

  document.getElementById('prev-btn').addEventListener('click', () => navigate(-1));
  document.getElementById('next-btn').addEventListener('click', () => navigate(1));
  document.getElementById('page-left-zone').addEventListener('click', () => navigate(-1));
  document.getElementById('page-right-zone').addEventListener('click', () => navigate(1));

  document.getElementById('mode-btn').addEventListener('click', () => {
    state.mode = state.mode === 'prose' ? 'faithful' : 'prose';
    renderCurrentPage();
    updateUI();
  });

  document.getElementById('font-dec').addEventListener('click', () => {
    if (state.fontSize > 14) { state.fontSize--; applyPrefs(); savePrefs(); }
  });
  document.getElementById('font-inc').addEventListener('click', () => {
    if (state.fontSize < 24) { state.fontSize++; applyPrefs(); savePrefs(); }
  });
  document.getElementById('dark-btn').addEventListener('click', () => {
    state.dark = !state.dark; applyPrefs(); savePrefs();
  });

  document.getElementById('progress-bar-container').addEventListener('click', e => {
    if (!state.pages.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    state.currentPage = Math.round(ratio * (state.pages.length - 1));
    renderCurrentPage();
    updateUI();
    savePosition();
  });

  document.addEventListener('keydown', e => {
    if (document.getElementById('reader').style.display === 'none') return;
    if (e.target.closest('button')) return;
    if      (['ArrowRight', 'l', ' '].includes(e.key)) { e.preventDefault(); navigate(1); }
    else if (['ArrowLeft',  'h'     ].includes(e.key)) { e.preventDefault(); navigate(-1); }
    else if (e.key === 'Home') { state.currentPage = 0; renderCurrentPage(); updateUI(); savePosition(); }
    else if (e.key === 'End')  { state.currentPage = state.pages.length - 1; renderCurrentPage(); updateUI(); savePosition(); }
    else if (e.key === 'f') { state.mode = state.mode === 'prose' ? 'faithful' : 'prose'; renderCurrentPage(); updateUI(); }
    else if (e.key === 'd') { state.dark = !state.dark; applyPrefs(); savePrefs(); }
    else if (e.key === '+' || e.key === '=') {
      if (state.fontSize < 24) { state.fontSize++; applyPrefs(); savePrefs(); }
    }
    else if (e.key === '-') {
      if (state.fontSize > 14) { state.fontSize--; applyPrefs(); savePrefs(); }
    }
  });
});
