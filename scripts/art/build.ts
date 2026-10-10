/**
 * Cuts every sprite out of its board and turns it into black ink on
 * transparency: opacity comes from how dark each pixel is, so outlines,
 * hatching and stippling survive exactly as drawn. Needs ImageMagick.
 *
 *   npm run gen:art
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { SPRITES } from './sprites.js';

mkdirSync('public/sprites', { recursive: true });
for (const sprite of SPRITES) {
  const [w, h, x, y] = sprite.box;
  const blanks = (sprite.blank ?? []).flatMap(([x1, y1, x2, y2]) => [
    '-fill', 'white', '-draw', `rectangle ${String(x1)},${String(y1)} ${String(x2)},${String(y2)}`,
  ]);
  execFileSync('magick', [
    sprite.board,
    '-crop', `${String(w)}x${String(h)}+${String(x)}+${String(y)}`, '+repage',
    '-colorspace', 'gray',
    ...blanks,
    // Light board tones become fully clear; ink stays opaque.
    '-level', sprite.level ?? '24%,68%',
    '-negate', '-alpha', 'copy', '-fill', 'black', '-colorize', '100',
    `public/sprites/${sprite.name}.png`,
  ]);
  process.stdout.write(`${sprite.name}\n`);
}
