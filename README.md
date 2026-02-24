# Takeoff Fro

Takeoff Fro is a lightweight, local-first construction takeoff app built for fast daily use.

## Features

- Load PDF plans (multi-page) and image files (PNG/JPG)
- High-performance canvas viewer with smooth pan/zoom
- Scale calibration by two-point reference
- Measurement tools:
  - Linear takeoff (multi-point polyline)
  - Area takeoff (polygon)
  - Count takeoff (point markers)
- Per-item metadata: name, type, page, value, units, color
- Bookmark-style page navigation with thumbnails
- Local project save/load via IndexedDB
- Export results to CSV and Excel (.xlsx)

## Stack

- Vanilla JavaScript (ES modules)
- HTML5 Canvas rendering for speed
- PDF.js loaded via ESM CDN
- IndexedDB for local persistence
- SheetJS (`xlsx`) loaded on demand for Excel export

## Run

Use any static server from the repository root.

### Option A: Python-free using Node

```bash
npm run serve
```

### Option B: VS Code Live Server

Open `index.html` with Live Server.

> The app uses module imports and browser APIs, so it should be served over HTTP (not `file://`).

## Usage

1. Click **Load PDF/Image** and choose a plan file.
2. Use **Pan** + mouse drag and wheel zoom for navigation.
3. Set scale with **Calibrate**:
   - Click two points on known distance.
   - Enter the real-world distance.
4. Choose a measurement tool:
   - **Length**: click points, then double-click (or Enter) to complete.
   - **Area**: click polygon vertices, then double-click (or Enter) to complete.
   - **Count**: click each marker to increment count items.
5. Set item label and color before drawing to organize takeoffs.
6. Save with **Save Project** (IndexedDB).
7. Export with **Export CSV** or **Export Excel**.

## Project Structure

- `index.html` – app shell and UI layout
- `src/app.js` – application orchestration and UI bindings
- `src/viewer.js` – canvas rendering engine, pan/zoom, tool interaction
- `src/pdf-image-loader.js` – PDF/image loading and page rasterization
- `src/storage.js` – IndexedDB save/load abstraction
- `src/exporters.js` – CSV/XLSX export utilities
- `src/math.js` – geometric measurement helpers
- `src/models.js` – enums and base project model
- `src/styles.css` – lightweight UI styling

## Notes

- PDF pages are rasterized into canvas pages for faster pan/zoom redraw.
- Accuracy depends on calibration and source plan quality.
- Data stays local in the browser storage.
