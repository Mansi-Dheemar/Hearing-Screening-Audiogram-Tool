/**
 * audiogram.js
 * Real-time audiogram rendering using the HTML5 Canvas API.
 *
 * Standard audiometric format:
 *   X-axis: Frequencies 250, 500, 1000, 2000, 4000, 8000 Hz
 *   Y-axis: Hearing Level −10 dB HL (top) → 100 dB HL (bottom)
 *   Left ear : Blue  × symbol
 *   Right ear: Red   ○ symbol
 */

const Audiogram = (() => {
  const FREQUENCIES = [250, 500, 1000, 2000, 4000, 8000];
  const DB_MIN      = -10;
  const DB_MAX      = 100;

  // Colours matching clinical convention
  const COLOUR_LEFT  = '#1a6fb5';  // blue
  const COLOUR_RIGHT = '#c0392b';  // red
  const COLOUR_GRID  = '#d1d5db';
  const COLOUR_AXIS  = '#374151';

  // WHO grade shading bands
  const WHO_BANDS = [
    { min: -10, max: 25,  label: 'Normal',   fill: 'rgba(34,197,94,0.07)'  },
    { min: 25,  max: 40,  label: 'Mild',     fill: 'rgba(234,179,8,0.10)'  },
    { min: 40,  max: 60,  label: 'Moderate', fill: 'rgba(249,115,22,0.10)' },
    { min: 60,  max: 80,  label: 'Severe',   fill: 'rgba(239,68,68,0.10)'  },
    { min: 80,  max: 100, label: 'Profound', fill: 'rgba(127,29,29,0.12)'  },
  ];

  let canvas = null;
  let ctx    = null;
  // Margins (px) — will be recalculated on draw
  const M = { top: 30, right: 30, bottom: 50, left: 65 };

  function init(canvasEl) {
    canvas = canvasEl;
    ctx    = canvas.getContext('2d');
    resizeCanvas();
    drawEmpty();
  }

  function resizeCanvas() {
    // Responsive: fill container width while keeping aspect ratio
    const parentWidth = canvas.parentElement.clientWidth || 700;
    const scale       = Math.min(1, parentWidth / 700);
    canvas.style.width  = (700 * scale) + 'px';
    canvas.style.height = (400 * scale) + 'px';
  }

  function freqToX(freq) {
    const plotW = canvas.width  - M.left - M.right;
    const idx   = FREQUENCIES.indexOf(freq);
    if (idx === -1) return M.left;
    return M.left + (idx / (FREQUENCIES.length - 1)) * plotW;
  }

  function dbToY(db) {
    const plotH = canvas.height - M.top - M.bottom;
    return M.top + ((db - DB_MIN) / (DB_MAX - DB_MIN)) * plotH;
  }

  function drawEmpty() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawGrid();
    drawAxes();
  }

  function drawBackground() {
    // WHO grade shading
    WHO_BANDS.forEach(band => {
      const y1 = dbToY(band.min);
      const y2 = dbToY(band.max);
      ctx.fillStyle = band.fill;
      ctx.fillRect(M.left, y1, canvas.width - M.left - M.right, y2 - y1);
      // Label
      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(band.label, canvas.width - M.right - 55, y1 + 12);
    });
  }

  function drawGrid() {
    ctx.strokeStyle = COLOUR_GRID;
    ctx.lineWidth   = 1;

    // Horizontal lines every 20 dB
    for (let db = DB_MIN; db <= DB_MAX; db += 20) {
      const y = dbToY(db);
      ctx.beginPath();
      ctx.moveTo(M.left, y);
      ctx.lineTo(canvas.width - M.right, y);
      ctx.stroke();
    }

    // Vertical lines per frequency
    FREQUENCIES.forEach(freq => {
      const x = freqToX(freq);
      ctx.beginPath();
      ctx.moveTo(x, M.top);
      ctx.lineTo(x, canvas.height - M.bottom);
      ctx.stroke();
    });
  }

  function drawAxes() {
    ctx.strokeStyle = COLOUR_AXIS;
    ctx.lineWidth   = 2;
    ctx.fillStyle   = COLOUR_AXIS;

    // Left axis
    ctx.beginPath();
    ctx.moveTo(M.left, M.top);
    ctx.lineTo(M.left, canvas.height - M.bottom);
    ctx.stroke();

    // Bottom axis
    ctx.beginPath();
    ctx.moveTo(M.left, canvas.height - M.bottom);
    ctx.lineTo(canvas.width - M.right, canvas.height - M.bottom);
    ctx.stroke();

    // Y-axis labels (dB HL)
    ctx.font      = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (let db = DB_MIN; db <= DB_MAX; db += 20) {
      const y = dbToY(db);
      ctx.fillText(db + ' dB', M.left - 6, y + 4);
    }

    // Y-axis title
    ctx.save();
    ctx.translate(14, (canvas.height) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('Hearing Level (dB HL)', 0, 0);
    ctx.restore();

    // X-axis labels
    ctx.textAlign = 'center';
    ctx.font = '11px system-ui, sans-serif';
    FREQUENCIES.forEach(freq => {
      const x = freqToX(freq);
      const label = freq >= 1000 ? (freq / 1000) + 'k' : freq;
      ctx.fillText(label + ' Hz', x, canvas.height - M.bottom + 18);
    });

    // X-axis title
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('Frequency (Hz)', M.left + (canvas.width - M.left - M.right) / 2, canvas.height - 6);
  }

  /** Draw an × symbol for left ear */
  function drawX(x, y, colour) {
    const s = 7;
    ctx.strokeStyle = colour;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s);
    ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
    ctx.stroke();
  }

  /** Draw an ○ symbol for right ear */
  function drawCircle(x, y, colour) {
    ctx.strokeStyle = colour;
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  /** Draw a connecting line between two points */
  function drawLine(x1, y1, x2, y2, colour) {
    ctx.strokeStyle = colour;
    ctx.lineWidth   = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  /**
   * Render all recorded thresholds onto the audiogram.
   * @param {{ left: Object, right: Object }} thresholds
   *   e.g. { left: {250: 20, 500: 25, …}, right: {250: 30, …} }
   */
  function render(thresholds) {
    drawEmpty(); // redraw axes/grid cleanly

    ['left', 'right'].forEach(ear => {
      const data   = thresholds[ear];
      const colour = ear === 'left' ? COLOUR_LEFT : COLOUR_RIGHT;
      const freqs  = FREQUENCIES.filter(f => data[f] !== undefined);

      // Lines first
      for (let i = 0; i < freqs.length - 1; i++) {
        const x1 = freqToX(freqs[i]);
        const y1 = dbToY(data[freqs[i]]);
        const x2 = freqToX(freqs[i + 1]);
        const y2 = dbToY(data[freqs[i + 1]]);
        drawLine(x1, y1, x2, y2, colour);
      }

      // Symbols on top
      freqs.forEach(freq => {
        const x = freqToX(freq);
        const y = dbToY(data[freq]);
        if (ear === 'left')  drawX(x, y, colour);
        else                  drawCircle(x, y, colour);
      });
    });
  }

  /** Export the canvas as a PNG data URL */
  function exportPNG() {
    return canvas.toDataURL('image/png');
  }

  return { init, render, drawEmpty, exportPNG };
})();
