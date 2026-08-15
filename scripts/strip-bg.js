const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// Flood-fill from the image borders: any near-white pixel reachable from an edge
// becomes transparent. Interior white regions (like the counter of an "S") are
// preserved because they're enclosed by non-white pixels.

const SRC = path.resolve(__dirname, '..', 'assets', 'icon.png');
const OUT = SRC;

const WHITE_THRESHOLD = 235;   // min channel value to consider "background white"
const SOFT_THRESHOLD  = 195;   // below this, keep fully opaque; between: fade alpha

const buf = fs.readFileSync(SRC);
const png = PNG.sync.read(buf);
const { width, height, data } = png;

const isBgWhite = (i) => {
  const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
  if (a === 0) return true; // already transparent
  return Math.min(r, g, b) >= WHITE_THRESHOLD;
};

const softAlpha = (i) => {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const min = Math.min(r, g, b);
  if (min >= WHITE_THRESHOLD) return 0;
  if (min >= SOFT_THRESHOLD) {
    const t = (min - SOFT_THRESHOLD) / (WHITE_THRESHOLD - SOFT_THRESHOLD);
    return Math.round(data[i + 3] * (1 - t));
  }
  return data[i + 3];
};

// BFS from every border pixel
const visited = new Uint8Array(width * height);
const stack = [];

const push = (x, y) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const idx = y * width + x;
  if (visited[idx]) return;
  const i = idx * 4;
  if (!isBgWhite(i)) return;
  visited[idx] = 1;
  stack.push(idx);
};

for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }

// Fully clear alpha for every reachable bg pixel
while (stack.length) {
  const idx = stack.pop();
  const i = idx * 4;
  data[i + 3] = 0;
  const x = idx % width;
  const y = (idx - x) / width;
  push(x + 1, y);
  push(x - 1, y);
  push(x, y + 1);
  push(x, y - 1);
}

// Now soften the edge: any opaque pixel adjacent to a transparent one
// gets its alpha faded proportional to how close it is to white.
// This kills the pale halo without eating into the solid strokes.
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = y * width + x;
    const i = idx * 4;
    if (data[i + 3] === 0) continue;
    let touchesBg = false;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (visited[ny * width + nx]) { touchesBg = true; break; }
    }
    if (touchesBg) data[i + 3] = softAlpha(i);
  }
}

fs.writeFileSync(OUT, PNG.sync.write(png));

let cleared = 0;
for (let i = 3; i < data.length; i += 4) if (data[i] === 0) cleared++;
const total = width * height;
console.log(`Wrote ${width}x${height} → ${OUT}`);
console.log(`Cleared ${cleared}/${total} pixels (${(cleared * 100 / total).toFixed(1)}%) to transparent.`);
