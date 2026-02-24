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
  exportXlsxBtn: document.getElementById('exportXlsxBtn')
};

const viewer = new Viewer(document.getElementById('viewerCanvas'), (msg) => {
  els.statusBar.textContent = msg;
  els.zoomLabel.textContent = `${Math.round(viewer.zoom * 100)}%`;
});

let project = null;
let sourceFile = null;

viewer.onTakeoffAdded = () => renderTakeoffs();

function setToolButtons(active) {
  document.querySelectorAll('[data-tool]').forEach((btn) => {
    btn.style.outline = btn.dataset.tool === active ? '2px solid #00bcd4' : 'none';
  });
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
    li.textContent = `${item.label} | ${item.type} | Pg ${item.page + 1} | ${item.value.toFixed(2)} ${item.units}`;
    li.style.color = item.color;
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
    const pages = await loadPagesFromFile(sourceFile);
    project = createProjectMeta(sourceFile.name, sourceFile.type);
    project.pages = pages.map((p) => ({ width: p.width, height: p.height }));
    viewer.setPages(pages);
    viewer.setTakeoffs([]);
    viewer.setCalibrationByPage({});
    renderPages();
    renderTakeoffs();
    updateStatus(`Loaded ${sourceFile.name} (${pages.length} page(s))`);
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
    const loaded = await loadLatestProject();
    if (!loaded) return updateStatus('No saved project found');
    const file = new File([loaded.sourceBuffer], loaded.fileName, { type: loaded.fileType || 'application/octet-stream' });
    sourceFile = file;
    const pages = await loadPagesFromFile(file);
    project = loaded;
    viewer.setPages(pages);
    viewer.setTakeoffs(loaded.takeoffs || []);
    viewer.setCalibrationByPage(loaded.calibrationByPage || {});
    renderPages();
    renderTakeoffs();
    updateStatus(`Loaded project: ${loaded.fileName}`);
  };

  els.exportCsvBtn.onclick = () => exportCsv(viewer.takeoffs);
  els.exportXlsxBtn.onclick = () => exportXlsx(viewer.takeoffs);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') viewer.commitPending();
    if (e.key === 'Escape') viewer.pending = [];
  });
}

bind();
