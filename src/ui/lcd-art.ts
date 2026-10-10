/**
 * The LCD scene, laid out like the owner's art board: a balcony and house on
 * the left where the thrower stands, trees and a lamp along the street, the
 * parcel locker at the right. Scenery is the faint print; everything that
 * moves is a fixed segment the game lights or darkens. Most segments are
 * sprites cut from the board (public/sprites); the digits are drawn.
 * No colours here: CSS paints `.lcd-print`, `[data-seg]` and `[data-seg][data-on]`.
 */
import { DROP_STEPS, POSITIONS, SPOTS, THROW_STEPS } from '../core/game.js';

/** Courier positions 1–5 (centre x); 5 stands at the locker. */
export const POSITION_X: readonly number[] = [128, 180, 232, 284, 352];
const GROUND = 214;
const CATCH_Y = GROUND - 36;
/** Where a parcel sits at the catch moment: just above the crate. */
const LAND_Y = CATCH_Y - 14;
const HAND: readonly [number, number] = [88, 70];
const n = (v: number): string => v.toFixed(1).replace(/\.0$/, '');

const sprite = (name: string, x: number, y: number, w: number, h: number, extra = ''): string =>
  `<image href="/sprites/${name}.png" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${extra}/>`;
const seg = (id: string, body: string): string => `<g data-seg="${id}">${body}</g>`;

/** A throw's centre at step i (0–4): a parabola from the hand to the catch point. */
function arcPoint(spot: number, i: number): readonly [number, number] {
  const tx = POSITION_X[spot] ?? 0;
  const t = (i + 1) / THROW_STEPS;
  const x = HAND[0] + (tx - HAND[0]) * t;
  const y = HAND[1] + (LAND_Y - HAND[1]) * t - 46 * 4 * t * (1 - t);
  return [x, y];
}

const PARCEL_FRAMES = ['parcel-b', 'parcel-c', 'parcel-d', 'parcel-e', 'parcel-a'];

const throwSegments = Array.from({ length: SPOTS }, (_, spot) =>
  Array.from({ length: THROW_STEPS }, (_, i) => {
    const [x, y] = arcPoint(spot, i);
    return seg(`p-${String(spot)}-${String(i)}`, sprite(PARCEL_FRAMES[i] ?? 'parcel-a', x - 11, y - 11, 22, 22));
  }).join(''),
).join('');

const dropSegments = Array.from({ length: SPOTS }, (_, spot) =>
  Array.from({ length: DROP_STEPS }, (_, i) => {
    const x = POSITION_X[spot] ?? 0;
    const y = 56 + ((LAND_Y - 56) * (i + 1)) / DROP_STEPS;
    return seg(`q-${String(spot)}-${String(i)}`, sprite('parcel-a', x - 10, y - 10, 20, 20));
  }).join(''),
).join('');

const drones = Array.from({ length: SPOTS }, (_, spot) =>
  seg(`drone-${String(spot)}`, sprite('drone', (POSITION_X[spot] ?? 0) - 19, 18, 38, 31)),
).join('');

const birds = Array.from({ length: SPOTS }, (_, spot) => {
  const [x, y] = arcPoint(spot, 2);
  return seg(`bird-${String(spot)}`, sprite('bird', x - 14, y - 30, 28, 24));
}).join('');

const broken = Array.from({ length: SPOTS }, (_, spot) =>
  seg(
    `b-${String(spot)}`,
    sprite('parcel-c', (POSITION_X[spot] ?? 0) - 12, GROUND - 16, 24, 18) +
      `<path d="M${n((POSITION_X[spot] ?? 0) - 10)} ${n(GROUND - 22)}l-4 -6M${n(POSITION_X[spot] ?? 0)} ${n(GROUND - 24)}v-7M${n((POSITION_X[spot] ?? 0) + 10)} ${n(GROUND - 22)}l4 -6" class="lcd-stroke"/>`,
  ),
).join('');

/**
 * Placeholder courier and thrower until the owner's second board arrives:
 * simple ink silhouettes holding a crate. Replacing them is a matter of
 * sprite names in COURIER_SPRITE / THROWER_SPRITE.
 */
const COURIER_SPRITE: string | null = null;
const THROWER_SPRITE: readonly (string | null)[] = [null, null];

/** The courier stands just right of his crate, holding it out towards the thrower. */
function courierBody(x: number): string {
  if (COURIER_SPRITE !== null) {
    return sprite(COURIER_SPRITE, x - 24, GROUND - 64, 48, 64);
  }
  const bx = x + 18;
  return (
    `<circle cx="${n(bx)}" cy="${n(GROUND - 54)}" r="8"/>` +
    `<path d="M${n(bx - 9)} ${n(GROUND - 57)}a9 9 0 0 1 18 0z"/>` +
    `<path d="M${n(bx - 9)} ${n(GROUND - 44)}h19l3 24h-25z"/>` +
    `<path d="M${n(bx - 7)} ${n(GROUND - 20)}h7l-1 20h-8zM${n(bx + 3)} ${n(GROUND - 20)}h7l2 20h-8z"/>` +
    `<path d="M${n(bx - 6)} ${n(GROUND - 38)}L${n(x + 10)} ${n(CATCH_Y + 2)}" class="lcd-stroke lcd-thick"/>` +
    `<path d="M${n(x - 15)} ${n(CATCH_Y - 6)}v14h29v-14" class="lcd-stroke lcd-crate"/>`
  );
}

const crateFill = (pos: number, k: number): string => {
  const x = (POSITION_X[pos - 1] ?? 0) - 12 + (k - 1) * 8.5;
  return seg(`k-${String(pos)}-${String(k)}`, `<rect x="${n(x)}" y="${n(CATCH_Y - 3)}" width="7" height="9" rx="1"/>`);
};

const couriers = Array.from({ length: POSITIONS }, (_, i) => {
  const pos = i + 1;
  return seg(`c-${String(pos)}`, courierBody(POSITION_X[i] ?? 0)) + [1, 2, 3].map((k) => crateFill(pos, k)).join('');
}).join('');

function throwerBody(frame: 0 | 1): string {
  const s = THROWER_SPRITE[frame] ?? null;
  if (s !== null) {
    return sprite(s, 52, 26, 44, 56);
  }
  const arm = frame === 0 ? 'M72 54l10 -10' : 'M72 54l18 8';
  return (
    '<circle cx="66" cy="40" r="8"/><path d="M57 50h18l2 24h-22z"/>' +
    `<path d="${arm}" class="lcd-stroke lcd-thick"/>` +
    (frame === 0 ? sprite('parcel-a', 76, 30, 14, 14) : '')
  );
}

/* digits: mitred seven-segment numerals, as before */
const DIGIT_X: readonly number[] = [300, 320, 346, 366];
const W = 13;
const H = 13;
const T = 2.8;
const hz = (x: number, y: number): string =>
  `M${n(x + 1.4)} ${n(y)}l${n(T / 2)} ${n(-T / 2)}H${n(x + W - 1.4 - T / 2)}l${n(T / 2)} ${n(T / 2)}l${n(-T / 2)} ${n(T / 2)}H${n(x + 1.4 + T / 2)}Z`;
const vt = (x: number, y: number): string =>
  `M${n(x)} ${n(y + 1.4)}l${n(T / 2)} ${n(T / 2)}V${n(y + H - 1.4 - T / 2)}l${n(-T / 2)} ${n(T / 2)}l${n(-T / 2)} ${n(-T / 2)}V${n(y + 1.4 + T / 2)}Z`;
const DIGIT_SEGMENTS: Readonly<Record<string, (x: number, y: number) => string>> = {
  a: (x, y) => hz(x, y), b: (x, y) => vt(x + W, y), c: (x, y) => vt(x + W, y + H),
  d: (x, y) => hz(x, y + 2 * H), e: (x, y) => vt(x, y + H), f: (x, y) => vt(x, y), g: (x, y) => hz(x, y + H),
};
const digit = (i: number): string =>
  Object.entries(DIGIT_SEGMENTS)
    .map(([name, shape]) => seg(`d${String(i)}${name}`, `<path d="${shape(DIGIT_X[i] ?? 0, 12)}"/>`))
    .join('');
const colon = seg('colon', '<circle cx="341" cy="21" r="1.5"/><circle cx="339.6" cy="32" r="1.5"/>');

const hearts = [0, 1, 2].map((i) => seg(`h-${String(i)}`, sprite('heart', 300 + i * 22, 46, 18, 18))).join('');
const levels = [1, 2, 3, 4, 5].map((l) => seg(`lv-${String(l)}`, `<circle cx="${String(298 + l * 9)}" cy="98" r="2.6"/>`)).join('');
const labels =
  '<text x="337" y="86" text-anchor="end" class="lcd-text lcd-label" data-t="lcd.game"></text>' +
  seg('lbl-A', '<text x="342" y="86" class="lcd-text">A</text>') +
  seg('lbl-B', '<text x="356" y="86" class="lcd-text">B</text>');

const PRINT = [
  sprite('house', 0, 60, 84, 143),
  sprite('tree', 96, 150, 40, 57),
  sprite('lamp', 300, 128, 15, 86),
  sprite('bush', 250, 168, 40, 46),
  sprite('locker', 322, 150, 78, 54),
  `<path d="M0 ${String(GROUND)}H400" class="lcd-stroke"/>`,
].join('');

export const SEGMENT_IDS: readonly string[] = [
  't-0', 't-1',
  ...Array.from({ length: SPOTS }, (_, s) => Array.from({ length: THROW_STEPS }, (_, i) => `p-${String(s)}-${String(i)}`)).flat(),
  ...Array.from({ length: SPOTS }, (_, s) => Array.from({ length: DROP_STEPS }, (_, i) => `q-${String(s)}-${String(i)}`)).flat(),
  ...Array.from({ length: SPOTS }, (_, s) => [`drone-${String(s)}`, `bird-${String(s)}`, `b-${String(s)}`]).flat(),
  ...Array.from({ length: POSITIONS }, (_, i) => [`c-${String(i + 1)}`, ...[1, 2, 3].map((k) => `k-${String(i + 1)}-${String(k)}`)]).flat(),
  'h-0', 'h-1', 'h-2', 'lv-1', 'lv-2', 'lv-3', 'lv-4', 'lv-5',
  ...[0, 1, 2, 3].flatMap((d) => Object.keys(DIGIT_SEGMENTS).map((s) => `d${String(d)}${s}`)),
  'colon', 'lbl-A', 'lbl-B',
];

export function lcdMarkup(): string {
  return [
    '<svg id="lcd-svg" viewBox="0 0 400 240" role="img" data-t-label="lcd.label" xmlns="http://www.w3.org/2000/svg">',
    `<g class="lcd-print">${PRINT}</g>`,
    labels, levels, hearts,
    [0, 1, 2, 3].map(digit).join(''), colon,
    seg('t-0', throwerBody(0)), seg('t-1', throwerBody(1)),
    drones, birds, throwSegments, dropSegments, couriers, broken,
    '</svg>',
  ].join('');
}
