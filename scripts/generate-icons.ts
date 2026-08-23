/**
 * Renders the PWA icons from the same glyph as `public/favicon.svg`, with no
 * image library: a handful of rounded rectangles rasterised into a PNG that is
 * assembled by hand (zlib is in Node; CRC-32 is twenty lines).
 *
 *   npm run gen:icons
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

type Rgb = readonly [number, number, number];

const INK: Rgb = [0x17, 0x15, 0x13];
const PAPER: Rgb = [0xf2, 0xef, 0xe8];
const ACCENT: Rgb = [0xff, 0x4f, 0x1f];

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly r: number;
  readonly fill: Rgb;
}

/** The glyph in a 64×64 design space, scaled to whatever size is asked for. */
const GLYPH: Box[] = [
  { x: 0, y: 0, w: 64, h: 64, r: 12, fill: INK },
  { x: 10, y: 10, w: 19, h: 8, r: 2, fill: PAPER },
  { x: 10, y: 21, w: 19, h: 8, r: 2, fill: PAPER },
  { x: 10, y: 32, w: 19, h: 8, r: 2, fill: PAPER },
  { x: 10, y: 43, w: 19, h: 11, r: 2, fill: PAPER },
  { x: 35, y: 10, w: 19, h: 8, r: 2, fill: PAPER },
  { x: 35, y: 21, w: 19, h: 8, r: 2, fill: ACCENT },
  { x: 35, y: 32, w: 19, h: 22, r: 2, fill: PAPER },
];

function insideRounded(box: Box, x: number, y: number): boolean {
  if (x < box.x || y < box.y || x >= box.x + box.w || y >= box.y + box.h) {
    return false;
  }
  const r = Math.min(box.r, box.w / 2, box.h / 2);
  const dx = Math.max(box.x + r - x, 0, x - (box.x + box.w - r));
  const dy = Math.max(box.y + r - y, 0, y - (box.y + box.h - r));
  return dx * dx + dy * dy <= r * r;
}

/** RGBA pixels, 4× supersampled so the rounded corners do not look chewed. */
function rasterise(size: number): Buffer {
  const scale = size / 64;
  const samples = 4;
  const pixels = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = (px + (sx + 0.5) / samples) / scale;
          const y = (py + (sy + 0.5) / samples) / scale;
          let hit: Rgb | null = null;
          for (const box of GLYPH) {
            if (insideRounded(box, x, y)) {
              hit = box.fill;
            }
          }
          if (hit !== null) {
            r += hit[0];
            g += hit[1];
            b += hit[2];
            a += 255;
          }
        }
      }
      const total = samples * samples;
      const offset = (py * size + px) * 4;
      const coverage = a / total;
      // Un-premultiply so edge pixels keep their colour instead of going dark.
      const weight = a === 0 ? 0 : 255 / a;
      pixels[offset] = Math.round(r * weight);
      pixels[offset + 1] = Math.round(g * weight);
      pixels[offset + 2] = Math.round(b * weight);
      pixels[offset + 3] = Math.round(coverage);
    }
  }
  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_unused, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size: number, pixels: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // truecolour with alpha
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const targets: [string, number][] = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];

for (const [name, size] of targets) {
  const target = fileURLToPath(new URL(`../public/${name}`, import.meta.url));
  writeFileSync(target, encodePng(size, rasterise(size)));
  process.stdout.write(`wrote ${target} (${String(size)}px)\n`);
}
