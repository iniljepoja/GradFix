// Generates the GradFix PWA app icons (a white map pin on the brand background) as PNGs, with no
// external dependencies — just Node's built-in zlib. Run: `node scripts/generate-icons.mjs`.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BRAND = [111, 79, 199]; // #6f4fc7
const WHITE = [255, 255, 255];

// --- minimal PNG encoder (8-bit RGBA, single None-filtered IDAT) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePng(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- pin geometry (normalised 0..1) ---
const HEAD = { cx: 0.5, cy: 0.40, r: 0.24 };
const HOLE_R = 0.095;
const TIP = { x: 0.5, y: 0.82 };
// Triangle from the pin head down to the tip.
const TRI = [{ x: 0.5 - HEAD.r * 0.78, y: 0.50 }, { x: 0.5 + HEAD.r * 0.78, y: 0.50 }, TIP];

function inCircle(x, y, c, r) { return (x - c.cx) ** 2 + (y - c.cy) ** 2 <= r * r; }
function inTriangle(px, py, [a, b, c]) {
  const sign = (p1, p2, p3) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const p = { x: px, y: py };
  const d1 = sign(p, a, b), d2 = sign(p, b, c), d3 = sign(p, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

function render(size) {
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) / size;
      const y = (py + 0.5) / size;
      const inPin = (inCircle(x, y, HEAD, HEAD.r) || inTriangle(x, y, TRI)) && !inCircle(x, y, HEAD, HOLE_R);
      const [r, g, b] = inPin ? WHITE : BRAND;
      const o = (py * size + px) * 4;
      buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = 255;
    }
  }
  return encodePng(size, buf);
}

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons');
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(resolve(outDir, `icon-${size}.png`), render(size));
  console.log(`wrote icon-${size}.png`);
}
