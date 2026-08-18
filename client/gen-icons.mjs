import zlib from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SS = 4; // supersample factor
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function roundedDist(cx, cy, x, y, hw, hh, r) {
  const dx = Math.abs(x - cx) - (hw - r);
  const dy = Math.abs(y - cy) - (hh - r);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.hypot(ax, ay) - r + Math.min(Math.max(dx, dy), 0);
}

// signed distance of rounded rect; inside = negative
function roundRectSDF(x, y, x0, y0, x1, y1, r) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const hw = (x1 - x0) / 2, hh = (y1 - y0) / 2;
  return roundedDist(cx, cy, x, y, hw, hh, r);
}

function buildIcon(size) {
  const S = size * SS;
  const px = Buffer.alloc(S * S * 4);
  const c0 = [99, 102, 241];   // #6366f1
  const c1 = [139, 92, 246];   // #8b5cf6
  const white = [255, 255, 255];
  const whiteSoft = [226, 232, 240];

  const corner = size * 0.24;
  const x0 = 0, y0 = 0, x1 = S, y1 = S;

  // background gradient + rounded corners
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = roundRectSDF(x, y, x0, y0, x1, y1, corner * SS);
      const t = y / S;
      let r = lerp(c0[0], c1[0], t);
      let g = lerp(c0[1], c1[1], t);
      let b = lerp(c0[2], c1[2], t);
      let a = 1;
      if (d > 0) { a = clamp(1 - d, 0, 1); } // soft edge
      const i = (y * S + x) * 4;
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = Math.round(a * 255);
    }
  }

  // "boxes" logo: three rounded rects
  const rr = (bx0, by0, bx1, by1, rad, color) => {
    const px0 = bx0 * SS, py0 = by0 * SS, px1 = bx1 * SS, py1 = by1 * SS, rr2 = rad * SS;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const d = roundRectSDF(x, y, px0, py0, px1, py1, rr2);
        if (d <= 0) {
          const i = (y * S + x) * 4;
          px[i] = color[0]; px[i + 1] = color[1]; px[i + 2] = color[2]; px[i + 3] = 255;
        }
      }
    }
  };

  const s = size;
  // bottom big box
  rr(s * 0.16, s * 0.52, s * 0.84, s * 0.86, s * 0.055, white);
  // middle-left box
  rr(s * 0.16, s * 0.24, s * 0.52, s * 0.56, s * 0.05, whiteSoft);
  // top-right box
  rr(s * 0.46, s * 0.13, s * 0.84, s * 0.47, s * 0.05, white);
  // small highlight window on bottom box
  rr(s * 0.30, s * 0.60, s * 0.70, s * 0.74, s * 0.03, [129, 140, 248]);

  // downsample SS -> 1
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = ((y * SS + dy) * S + (x * SS + dx)) * 4;
          r += px[i]; g += px[i + 1]; b += px[i + 2]; a += px[i + 3];
        }
      }
      const n = SS * SS;
      const j = (y * size + x) * 4;
      out[j] = Math.round(r / n);
      out[j + 1] = Math.round(g / n);
      out[j + 2] = Math.round(b / n);
      out[j + 3] = Math.round(a / n);
    }
  }
  return out;
}

// --- minimal PNG encoder ---
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
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const outDir = join(__dirname, "public");
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const png = encodePNG(size, size, buildIcon(size));
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, png);
  console.log(`wrote ${file} (${png.length} bytes)`);
}
