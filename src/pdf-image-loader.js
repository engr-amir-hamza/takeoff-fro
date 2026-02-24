import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.worker.mjs';

async function canvasFromImage(file, onProgress) {
  onProgress?.('Loading image…');
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  onProgress?.('Image loaded');
  return [canvas];
}

async function canvasesFromPdf(file, onProgress) {
  onProgress?.('Reading PDF…');
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    onProgress?.(`Rendering page ${i}/${pdf.numPages}…`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    pages.push(canvas);
  }
  onProgress?.(`Loaded ${pdf.numPages} page(s)`);
  return pages;
}

export async function loadPagesFromFile(file, onProgress) {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return canvasesFromPdf(file, onProgress);
  }
  if (file.type.startsWith('image/')) {
    return canvasFromImage(file, onProgress);
  }
  throw new Error('Unsupported file type');
}
