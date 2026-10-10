/**
 * Renders the PWA icons and the link-preview card from the same glyph as
 * `public/favicon.svg`, with no
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

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const CARD_UNIT = 6;
const CASE: Rgb = [0xb0, 0x26, 0x1f];
const BEZEL: Rgb = [0x26, 0x26, 0x26];
const LCD: Rgb = [0xb7, 0xbf, 0x9e];
const LCD_INK: Rgb = [0x1c, 0x21, 0x14];
const BUTTON: Rgb = [0xeb, 0xe5, 0xd3];

/** The handheld, 1200×630 at one unit per pixel / 6: case, screen, four buttons, parcels on the LCD. */
const CARD: Box[] = [
  { x: 0, y: 0, w: 200, h: 105, r: 0, fill: PAPER },
  { x: 22, y: 8, w: 156, h: 89, r: 10, fill: CASE },
  { x: 58, y: 16, w: 84, h: 64, r: 4, fill: BEZEL },
  { x: 62, y: 20, w: 76, h: 56, r: 2, fill: LCD },
  // Parcels sliding down the left and right chutes, the courier in the middle.
  { x: 70, y: 30, w: 5, h: 4, r: 1, fill: LCD_INK },
  { x: 78, y: 35, w: 5, h: 4, r: 1, fill: LCD_INK },
  { x: 120, y: 52, w: 5, h: 4, r: 1, fill: LCD_INK },
  { x: 96, y: 46, w: 8, h: 8, r: 4, fill: LCD_INK },
  { x: 97, y: 55, w: 6, h: 14, r: 1, fill: LCD_INK },
  // Round buttons, two each side.
  { x: 30, y: 30, w: 18, h: 18, r: 9, fill: BUTTON },
  { x: 30, y: 58, w: 18, h: 18, r: 9, fill: BUTTON },
  { x: 152, y: 30, w: 18, h: 18, r: 9, fill: BUTTON },
  { x: 152, y: 58, w: 18, h: 18, r: 9, fill: BUTTON },
];

/** RGBA pixels, 4× supersampled so the rounded corners do not look chewed. */
function rasterise(width: number, height: number, boxes: readonly Box[], scale: number): Buffer {
  const samples = 4;
  const pixels = Buffer.alloc(width * height * 4);

  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = (px + (sx + 0.5) / samples) / scale;
          const y = (py + (sy + 0.5) / samples) / scale;
          let hit: Rgb | null = null;
          for (const box of boxes) {
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
      const offset = (py * width + px) * 4;
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

function encodePng(width: number, height: number, pixels: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // truecolour with alpha
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
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

const write = (name: string, width: number, height: number, pixels: Buffer): void => {
  const target = fileURLToPath(new URL(`../public/${name}`, import.meta.url));
  writeFileSync(target, encodePng(width, height, pixels));
  process.stdout.write(`wrote ${target} (${String(width)}×${String(height)})\n`);
};

for (const [name, size] of targets) {
  write(name, size, size, rasterise(size, size, GLYPH, size / 64));
}
write('og.png', CARD_WIDTH, CARD_HEIGHT, rasterise(CARD_WIDTH, CARD_HEIGHT, CARD, CARD_UNIT));
