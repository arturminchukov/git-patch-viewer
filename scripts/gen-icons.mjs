// Generate the extension icons (PNG, RGBA) with no external dependencies.
// The mark is a rounded dark card with two rounded panels — red (removed) on
// the left, green (added) on the right — echoing the side-by-side diff.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(outDir, { recursive: true });

const CARD = [0x1b, 0x20, 0x27]; // dark card background
const DEL = [0xf8, 0x51, 0x49]; // removed panel
const ADD = [0x3f, 0xb9, 0x50]; // added panel
const LINE = [0x0d, 0x11, 0x17]; // hint "text" lines inside panels

const SS = 3; // supersampling factor for anti-aliasing

/** Signed test: is (u,v) inside a rounded rectangle [x0,y0,x1,y1] with radius r? */
function insideRoundRect(u, v, x0, y0, x1, y1, r) {
  if (u < x0 || u > x1 || v < y0 || v > y1) return false;
  const dx = Math.max(x0 + r - u, 0, u - (x1 - r));
  const dy = Math.max(y0 + r - v, 0, v - (y1 - r));
  return dx * dx + dy * dy <= r * r;
}

function sample(u, v) {
  // Outside the card → transparent.
  if (!insideRoundRect(u, v, 0.04, 0.04, 0.96, 0.96, 0.2)) return null;

  const panels = [
    { rect: [0.15, 0.16, 0.47, 0.84], color: DEL },
    { rect: [0.53, 0.16, 0.85, 0.84], color: ADD },
  ];
  for (const panel of panels) {
    const [x0, y0, x1, y1] = panel.rect;
    if (insideRoundRect(u, v, x0, y0, x1, y1, 0.05)) {
      // Three hint lines across the panel.
      for (const cy of [0.34, 0.5, 0.66]) {
        if (v > cy - 0.035 && v < cy + 0.035 && u > x0 + 0.05 && u < x1 - 0.05) {
          return LINE;
        }
      }
      return panel.color;
    }
  }
  return CARD;
}

function renderPixel(size, px, py) {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  for (let sy = 0; sy < SS; sy++) {
    for (let sx = 0; sx < SS; sx++) {
      const u = (px + (sx + 0.5) / SS) / size;
      const v = (py + (sy + 0.5) / SS) / size;
      const c = sample(u, v);
      if (c) {
        r += c[0];
        g += c[1];
        b += c[2];
        a += 255;
      }
    }
  }
  const n = SS * SS;
  const alpha = a / n;
  if (alpha === 0) return [0, 0, 0, 0];
  // Average only the covered subsamples so edges stay crisp, not muddy.
  const covered = a / 255;
  return [Math.round(r / covered), Math.round(g / covered), Math.round(b / covered), Math.round(alpha)];
}

function rawImage(size) {
  const rowLen = size * 4 + 1;
  const raw = Buffer.alloc(rowLen * size);
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = renderPixel(size, x, y);
      const off = y * rowLen + 1 + x * 4;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = a;
    }
  }
  return raw;
}

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
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
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

function encodePng(size) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const idat = deflateSync(rawImage(size), { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(outDir, `icon-${size}.png`), encodePng(size));
  console.log(`wrote icons/icon-${size}.png`);
}
