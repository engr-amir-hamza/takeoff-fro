import { loadPagesFromFile } from './pdf-image-loader.js';
import { Viewer } from './viewer.js';
import { Tool, createProjectMeta } from './models.js';
import { saveProject, loadLatestProject } from './storage.js';
import { exportCsv, exportXlsx } from './exporters.js';

const els = {
  fileInput: document.getElementById('fileInput'),
  saveProjectBtn: document.getElementById('saveProjectBtn'),
  loadProjectBtn: document.getElementById('loadProjectBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  zoomInBtn: document.getElementById('zoomInBtn'),
  fitBtn: document.getElementById('fitBtn'),
  zoomLabel: document.getElementById('zoomLabel'),
  statusBar: document.getElementById('statusBar'),
  itemLabelInput: document.getElementById('itemLabelInput'),
  itemColorInput: document.getElementById('itemColorInput'),
  pageList: document.getElementById('pageList'),
  takeoffList: document.getElementById('takeoffList'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  exportXlsxBtn: document.getElementById('exportXlsxBtn'),
  toggleBookmarksBtn: document.getElementById('toggleBookmarksBtn'),
  bookmarksPane: document.getElementById('bookmarksPane'),
  loader: document.getElementById('loader'),
  scalePresetSelect: document.getElementById('scalePresetSelect'),
  dpiInput: document.getElementById('dpiInput'),
  applyScaleBtn: document.getElementById('applyScaleBtn')
};

const viewer = new Viewer(document.getElementById('viewerCanvas'), (msg) => {
  els.statusBar.textContent = msg;
  els.zoomLabel.textContent = `${Math.round(viewer.zoom * 100)}%`;
});

let project = null;
let sourceFile = null;

viewer.onTakeoffAdded = () => renderTakeoffs();
viewer.onTakeoffSelected = () => renderTakeoffs();

function setLoading(loading, message = 'Loading…') {
  els.loader.classList.toggle('hidden', !loading);
  els.loader.textContent = message;
}

function setToolButtons(active) {
  document.querySelectorAll('[data-tool]').forEach((btn) => {
    btn.style.outline = btn.dataset.tool === active ? '2px solid #00bcd4' : 'none';
  });
}

function parseScalePreset(value) {
  if (!value.includes('/')) return null;
  const [num, den] = value.split('/').map(Number);
  if (!num || !den) return null;
  return num / den;
}

function renderPages() {
  els.pageList.innerHTML = '';
  viewer.pages.forEach((pageCanvas, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = `page-thumb ${index === viewer.pageIndex ? 'active' : ''}`;
    const thumb = document.createElement('canvas');
    thumb.width = 200;
    thumb.height = Math.max(100, Math.round((pageCanvas.height / pageCanvas.width) * 200));
    thumb.getContext('2d').drawImage(pageCanvas, 0, 0, thumb.width, thumb.height);
    const lbl = document.createElement('div');
    lbl.textContent = `Page ${index + 1}`;
    wrapper.append(thumb, lbl);
    wrapper.onclick = () => {
      viewer.setPage(index);
      renderPages();
      renderTakeoffs();
      updateStatus();
    };
    els.pageList.append(wrapper);
  });
}

function renderTakeoffs() {
  if (!project) return;
  els.takeoffList.innerHTML = '';
  project.takeoffs = viewer.takeoffs;

  for (const item of viewer.takeoffs) {
    const li = document.createElement('li');
    li.className = `takeoff-item ${viewer.selectedTakeoffId === item.id ? 'selected' : ''}`;
    li.style.borderLeftColor = item.color;

    const title = document.createElement('input');
    title.value = item.label;
    title.onchange = () => {
      viewer.renameTakeoff(item.id, title.value.trim());
      renderTakeoffs();
    };

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${item.type} | Pg ${item.page + 1} | ${item.value.toFixed(2)} ${item.units}`;

    li.onclick = () => viewer.selectTakeoff(item.id);
    li.append(title, meta);
    els.takeoffList.append(li);
  }
}

function updateStatus(msg = 'Ready') {
  els.statusBar.textContent = msg;
  els.zoomLabel.textContent = `${Math.round(viewer.zoom * 100)}%`;
}

function bind() {
  els.fileInput.onchange = async (e) => {
    sourceFile = e.target.files?.[0];
    if (!sourceFile) return;
    setLoading(true, 'Loading file…');
    try {
      const pages = await loadPagesFromFile(sourceFile, (progress) => setLoading(true, progress));
      project = createProjectMeta(sourceFile.name, sourceFile.type);
      project.pages = pages.map((p) => ({ width: p.width, height: p.height }));
      viewer.setPages(pages);
      viewer.setTakeoffs([]);
      viewer.setCalibrationByPage({});
      renderPages();
      renderTakeoffs();
      updateStatus(`Loaded ${sourceFile.name} (${pages.length} page(s))`);
    } finally {
      setLoading(false);
    }
  };

  document.querySelectorAll('[data-tool]').forEach((btn) => {
    btn.onclick = () => {
      viewer.setTool(btn.dataset.tool);
      setToolButtons(btn.dataset.tool);
    };
  });
  setToolButtons(Tool.PAN);

  els.zoomInBtn.onclick = () => { viewer.zoomBy(1.2); updateStatus(); };
  els.zoomOutBtn.onclick = () => { viewer.zoomBy(0.8); updateStatus(); };
  els.fitBtn.onclick = () => { viewer.fit(); updateStatus(); };

  els.itemColorInput.oninput = () => viewer.setCurrentStyle({ color: els.itemColorInput.value, label: els.itemLabelInput.value });
  els.itemLabelInput.oninput = () => viewer.setCurrentStyle({ color: els.itemColorInput.value, label: els.itemLabelInput.value });
  viewer.setCurrentStyle({ color: els.itemColorInput.value, label: els.itemLabelInput.value });

  els.applyScaleBtn.onclick = () => {
    const ratioInchesPerFoot = parseScalePreset(els.scalePresetSelect.value);
    const dpi = Number(els.dpiInput.value);
    if (!ratioInchesPerFoot || !dpi) {
      updateStatus('Choose a preset scale and valid DPI');
      return;
    }
    const pixelsPerFoot = dpi * ratioInchesPerFoot;
    viewer.applyPixelsPerUnit(pixelsPerFoot);
    updateStatus(`Preset scale applied (${els.scalePresetSelect.value}, ${dpi} DPI)`);
  };

  els.toggleBookmarksBtn.onclick = () => {
    const collapsed = els.bookmarksPane.classList.toggle('collapsed');
    els.toggleBookmarksBtn.textContent = collapsed ? 'Show Bookmarks' : 'Hide Bookmarks';
  };

  els.saveProjectBtn.onclick = async () => {
    if (!project) return;
    project.takeoffs = viewer.takeoffs;
    project.calibrationByPage = viewer.calibrationByPage;
    if (sourceFile) {
      project.sourceBuffer = await sourceFile.arrayBuffer();
      project.fileName = sourceFile.name;
      project.fileType = sourceFile.type;
    }
    await saveProject(project);
    updateStatus('Project saved to IndexedDB');
  };

  els.loadProjectBtn.onclick = async () => {
    setLoading(true, 'Loading saved project…');
    try {
      const loaded = await loadLatestProject();
      if (!loaded) return updateStatus('No saved project found');
      const file = new File([loaded.sourceBuffer], loaded.fileName, { type: loaded.fileType || 'application/octet-stream' });
      sourceFile = file;
      const pages = await loadPagesFromFile(file, (progress) => setLoading(true, progress));
      project = loaded;
      viewer.setPages(pages);
      viewer.setTakeoffs(loaded.takeoffs || []);
      viewer.setCalibrationByPage(loaded.calibrationByPage || {});
      renderPages();
      renderTakeoffs();
      updateStatus(`Loaded project: ${loaded.fileName}`);
    } finally {
      setLoading(false);
    }
  };

  els.exportCsvBtn.onclick = () => exportCsv(viewer.takeoffs);
  els.exportXlsxBtn.onclick = () => exportXlsx(viewer.takeoffs);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') viewer.commitPending();
    if (e.key === 'Escape') viewer.pending = [];
  });
}

bind();
