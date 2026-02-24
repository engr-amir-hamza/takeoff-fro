import { Tool } from './models.js';
import { polylineLength, polygonArea } from './math.js';

export class Viewer {
  constructor(canvas, onStatus) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onStatus = onStatus;
    this.pages = [];
    this.pageIndex = 0;
    this.zoom = 1;
    this.offset = { x: 40, y: 40 };
    this.tool = Tool.PAN;
    this.dragging = false;
    this.lastMouse = null;
    this.pending = [];
    this.takeoffs = [];
    this.calibrationByPage = {};
    this.currentStyle = { color: '#00bcd4', label: 'Item' };

    this.resize();
    this.bind();
    requestAnimationFrame(() => this.draw());
  }

  bind() {
    window.addEventListener('resize', () => this.resize());
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const world = this.toWorld(e.offsetX, e.offsetY);
      this.zoom = Math.max(0.1, Math.min(8, this.zoom * factor));
      this.offset.x = e.offsetX - world.x * this.zoom;
      this.offset.y = e.offsetY - world.y * this.zoom;
      this.draw();
    }, { passive: false });

    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', () => { this.dragging = false; this.lastMouse = null; });
    this.canvas.addEventListener('dblclick', () => this.commitPending());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  setPages(pages) {
    this.pages = pages;
    this.pageIndex = 0;
    this.fit();
  }

  setPage(index) {
    this.pageIndex = index;
    this.fit();
  }

  setTool(tool) {
    this.tool = tool;
    this.pending = [];
    this.onStatus(`Tool: ${tool}`);
    this.draw();
  }

  setCurrentStyle(style) {
    this.currentStyle = style;
  }

  setTakeoffs(takeoffs) {
    this.takeoffs = takeoffs;
    this.draw();
  }

  setCalibrationByPage(calibrationByPage) {
    this.calibrationByPage = calibrationByPage;
    this.draw();
  }

  toWorld(x, y) {
    return { x: (x - this.offset.x) / this.zoom, y: (y - this.offset.y) / this.zoom };
  }

  fit() {
    const page = this.pages[this.pageIndex];
    if (!page) return;
    const rect = this.canvas.getBoundingClientRect();
    this.zoom = Math.min(rect.width / page.width, rect.height / page.height) * 0.95;
    this.offset.x = (rect.width - page.width * this.zoom) / 2;
    this.offset.y = (rect.height - page.height * this.zoom) / 2;
    this.draw();
  }

  zoomBy(factor) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const world = this.toWorld(cx, cy);
    this.zoom = Math.max(0.1, Math.min(8, this.zoom * factor));
    this.offset.x = cx - world.x * this.zoom;
    this.offset.y = cy - world.y * this.zoom;
    this.draw();
  }

  onPointerDown(e) {
    const point = this.toWorld(e.offsetX, e.offsetY);
    if (this.tool === Tool.PAN) {
      this.dragging = true;
      this.lastMouse = { x: e.offsetX, y: e.offsetY };
      return;
    }
    if (this.tool === Tool.COUNT) {
      this.addTakeoff({ type: Tool.COUNT, points: [point], value: 1, units: 'ea' });
      return;
    }
    if ([Tool.CALIBRATE, Tool.LENGTH, Tool.AREA].includes(this.tool)) {
      this.pending.push(point);
      if (this.tool === Tool.CALIBRATE && this.pending.length === 2) {
        const pixels = polylineLength(this.pending);
        const real = Number(prompt('Enter real-world distance for calibration:', '10'));
        if (real > 0) {
          this.calibrationByPage[this.pageIndex] = { pixelsPerUnit: pixels / real };
          this.onStatus(`Calibrated: 1 unit = ${(pixels / real).toFixed(3)} px`);
        }
        this.pending = [];
      }
      this.draw();
    }
  }

  onPointerMove(e) {
    if (this.dragging && this.lastMouse) {
      const dx = e.offsetX - this.lastMouse.x;
      const dy = e.offsetY - this.lastMouse.y;
      this.offset.x += dx;
      this.offset.y += dy;
      this.lastMouse = { x: e.offsetX, y: e.offsetY };
      this.draw();
    }
  }

  commitPending() {
    if (this.tool === Tool.LENGTH && this.pending.length > 1) {
      const pxLen = polylineLength(this.pending);
      const scale = this.calibrationByPage[this.pageIndex]?.pixelsPerUnit || 1;
      this.addTakeoff({ type: Tool.LENGTH, points: [...this.pending], value: pxLen / scale, units: 'lf' });
    }
    if (this.tool === Tool.AREA && this.pending.length > 2) {
      const pxArea = polygonArea(this.pending);
      const scale = this.calibrationByPage[this.pageIndex]?.pixelsPerUnit || 1;
      this.addTakeoff({ type: Tool.AREA, points: [...this.pending], value: pxArea / (scale * scale), units: 'sf' });
    }
    this.pending = [];
    this.draw();
  }

  addTakeoff(base) {
    const item = {
      id: crypto.randomUUID(),
      page: this.pageIndex,
      color: this.currentStyle.color,
      label: this.currentStyle.label || `${base.type} item`,
      ...base
    };
    this.takeoffs.push(item);
    this.onTakeoffAdded?.(item, this.takeoffs);
    this.draw();
  }

  draw() {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    const page = this.pages[this.pageIndex];
    if (!page) return;

    this.ctx.save();
    this.ctx.translate(this.offset.x, this.offset.y);
    this.ctx.scale(this.zoom, this.zoom);
    this.ctx.drawImage(page, 0, 0);

    const drawPoints = (pts, close = false) => {
      this.ctx.beginPath();
      this.ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i += 1) this.ctx.lineTo(pts[i].x, pts[i].y);
      if (close) this.ctx.closePath();
      this.ctx.stroke();
    };

    for (const item of this.takeoffs.filter((t) => t.page === this.pageIndex)) {
      this.ctx.strokeStyle = item.color;
      this.ctx.fillStyle = item.color;
      this.ctx.lineWidth = 2 / this.zoom;
      if (item.type === Tool.COUNT) {
        const p = item.points[0];
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 5 / this.zoom, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (item.type === Tool.AREA) {
        drawPoints(item.points, true);
        this.ctx.globalAlpha = 0.15;
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
      } else {
        drawPoints(item.points, false);
      }
    }

    if (this.pending.length) {
      this.ctx.strokeStyle = '#ffd166';
      this.ctx.lineWidth = 2 / this.zoom;
      drawPoints(this.pending, this.tool === Tool.AREA && this.pending.length > 2);
    }

    this.ctx.restore();
  }
}
