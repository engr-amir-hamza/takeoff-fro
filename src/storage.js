const DB_NAME = 'takeoff-fro';
const DB_VERSION = 1;
const PROJECT_STORE = 'projects';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProject(project) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readwrite');
    tx.objectStore(PROJECT_STORE).put(project);
    tx.oncomplete = () => resolve(project.id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadLatestProject() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE, 'readonly');
    const req = tx.objectStore(PROJECT_STORE).getAll();
    req.onsuccess = () => {
      const projects = req.result;
      projects.sort((a, b) => b.createdAt - a.createdAt);
      resolve(projects[0] || null);
    };
    req.onerror = () => reject(req.error);
  });
}
