/**
 * Seeded parcel generation. Everything here is a pure function of the RNG state
 * and the day profile, so a date seeds the identical set of parcels for every
 * player.
 */
import type { DayProfile } from './profiles.js';
import { nextInt, pick, shuffle, weightedPick } from './rng.js';
import type { RngState } from './rng.js';
import { buildWall, fits, sizeRank, slotCapacity } from './wall.js';
import type { Size, Slot } from './wall.js';

export type Colour = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet';
export type Sticker = 'none' | 'fragile' | 'arrow' | 'bang';

export const COLOURS: readonly Colour[] = ['red', 'orange', 'yellow', 'green', 'blue', 'violet'];
export const STICKERS: readonly Sticker[] = ['none', 'fragile', 'arrow', 'bang'];

export const CODE_LENGTH = 4;

export interface Parcel {
  readonly id: string;
  readonly size: Size;
  /** Four digits, no leading zero, unique within a day. */
  readonly code: string;
  readonly colour: Colour;
  readonly sticker: Sticker;
}

const SIZES: readonly Size[] = ['A', 'B', 'C'];

/** Guard against a pathological seed spinning the rejection sampler forever. */
const MAX_DRAWS = 20_000;

/**
 * Every distinct code reachable from `code` by swapping two neighbouring
 * digits. Swaps that change nothing or that would produce a leading zero are
 * left out, so the result is always a valid, different code.
 */
export function adjacentTranspositions(code: string): string[] {
  const digits = [...code];
  const result: string[] = [];
  for (let i = 0; i + 1 < digits.length; i += 1) {
    const a = digits[i];
    const b = digits[i + 1];
    if (a === undefined || b === undefined || a === b) {
      continue;
    }
    if (i === 0 && b === '0') {
      continue;
    }
    const swapped = [...digits];
    swapped[i] = b;
    swapped[i + 1] = a;
    result.push(swapped.join(''));
  }
  return result;
}

/** Two codes are look-alikes when one adjacent transposition turns one into the other. */
export function isLookalikePair(a: string, b: string): boolean {
  return a !== b && adjacentTranspositions(a).includes(b);
}

/** How many unordered look-alike pairs a set of codes contains. */
export function countLookalikePairs(codes: readonly string[]): number {
  let count = 0;
  for (let i = 0; i < codes.length; i += 1) {
    for (let j = i + 1; j < codes.length; j += 1) {
      const a = codes[i];
      const b = codes[j];
      if (a !== undefined && b !== undefined && isLookalikePair(a, b)) {
        count += 1;
      }
    }
  }
  return count;
}

function drawCode(state: RngState): [string, RngState] {
  let rng = state;
  const [lead, afterLead] = nextInt(rng, 9);
  rng = afterLead;
  let code = String(lead + 1);
  for (let i = 1; i < CODE_LENGTH; i += 1) {
    const [digit, afterDigit] = nextInt(rng, 10);
    rng = afterDigit;
    code += String(digit);
  }
  return [code, rng];
}

function generateCodes(
  state: RngState,
  count: number,
  lookalikePairs: number,
): [string[], RngState] {
  if (count < lookalikePairs * 2) {
    throw new RangeError(
      `cannot fit ${String(lookalikePairs)} look-alike pairs into ${String(count)} parcels`,
    );
  }
  let rng = state;
  const taken = new Set<string>();
  const codes: string[] = [];
  const pairsWithTaken = (code: string): boolean =>
    adjacentTranspositions(code).some((variant) => taken.has(variant));

  for (let made = 0; made < lookalikePairs; made += 1) {
    let placed = false;
    for (let attempt = 0; attempt < MAX_DRAWS && !placed; attempt += 1) {
      const [base, afterBase] = drawCode(rng);
      rng = afterBase;
      if (taken.has(base) || pairsWithTaken(base)) {
        continue;
      }
      const variants = adjacentTranspositions(base);
      if (variants.length === 0) {
        continue;
      }
      const [partner, afterPartner] = pick(rng, variants);
      rng = afterPartner;
      if (taken.has(partner)) {
        continue;
      }
      const partnerCollides = adjacentTranspositions(partner)
        .filter((variant) => variant !== base)
        .some((variant) => taken.has(variant));
      if (partnerCollides) {
        continue;
      }
      taken.add(base);
      taken.add(partner);
      codes.push(base, partner);
      placed = true;
    }
    if (!placed) {
      throw new Error('could not generate the requested look-alike pairs');
    }
  }

  for (let attempt = 0; codes.length < count; attempt += 1) {
    if (attempt >= MAX_DRAWS) {
      throw new Error('could not generate enough distinct parcel codes');
    }
    const [code, afterCode] = drawCode(rng);
    rng = afterCode;
    if (taken.has(code) || pairsWithTaken(code)) {
      continue;
    }
    taken.add(code);
    codes.push(code);
  }

  // Shuffle so the deliberate pairs are not the first parcels off the van.
  return shuffle(rng, codes);
}

function capacityAtLeast(capacity: Readonly<Record<Size, number>>, rank: number): number {
  return SIZES.filter((size) => sizeRank(size) >= rank).reduce(
    (sum, size) => sum + capacity[size],
    0,
  );
}

function countsAtLeast(counts: Readonly<Record<Size, number>>, rank: number): number {
  return SIZES.filter((size) => sizeRank(size) >= rank).reduce((sum, size) => sum + counts[size], 0);
}

/**
 * A size mix is placeable exactly when, for every rank, the parcels of that
 * rank or larger do not outnumber the slots of that rank or larger.
 */
function admits(
  counts: Readonly<Record<Size, number>>,
  capacity: Readonly<Record<Size, number>>,
  candidate: Size,
): boolean {
  const withCandidate = { ...counts, [candidate]: counts[candidate] + 1 };
  return SIZES.every(
    (size) => countsAtLeast(withCandidate, sizeRank(size)) <= capacityAtLeast(capacity, sizeRank(size)),
  );
}

function generateSizes(
  state: RngState,
  profile: DayProfile,
  capacity: Readonly<Record<Size, number>>,
): [Size[], RngState] {
  let rng = state;
  const counts: Record<Size, number> = { A: 0, B: 0, C: 0 };
  const sizes: Size[] = [];
  for (let i = 0; i < profile.pickups; i += 1) {
    const [drawn, afterDraw] = weightedPick(rng, profile.parcelSizeWeights);
    rng = afterDraw;
    // Downgrade rather than reject, so the draw stays a single RNG step and the
    // mix always fits the wall.
    let chosen: Size | null = null;
    for (let rank = sizeRank(drawn); rank >= 0; rank -= 1) {
      const candidate = SIZES[rank];
      if (candidate !== undefined && admits(counts, capacity, candidate)) {
        chosen = candidate;
        break;
      }
    }
    if (chosen === null) {
      throw new RangeError(
        `profile "${profile.id}" asks for ${String(profile.pickups)} parcels but the wall cannot hold them`,
      );
    }
    counts[chosen] += 1;
    sizes.push(chosen);
  }
  return [sizes, rng];
}

/** The pickup parcels for a day, in the order the courier unloads them. */
export function generateParcels(state: RngState, profile: DayProfile): [Parcel[], RngState] {
  const wall = buildWall(profile.columns);
  const capacity = slotCapacity(wall);
  let rng = state;

  const [sizes, afterSizes] = generateSizes(rng, profile, capacity);
  rng = afterSizes;

  const [codes, afterCodes] = generateCodes(rng, profile.pickups, profile.lookalikePairs);
  rng = afterCodes;

  const parcels: Parcel[] = [];
  for (let i = 0; i < profile.pickups; i += 1) {
    const size = sizes[i];
    const code = codes[i];
    if (size === undefined || code === undefined) {
      throw new Error('parcel generation produced fewer sizes or codes than requested');
    }
    const [colour, afterColour] = pick(rng, COLOURS);
    rng = afterColour;
    const [sticker, afterSticker] = pick(rng, STICKERS);
    rng = afterSticker;
    parcels.push({ id: `p${String(i)}`, size, code, colour, sticker });
  }

  return [parcels, rng];
}

/**
 * A concrete assignment of every parcel to a distinct fitting slot, or `null`
 * when none exists. Largest parcels first into the smallest slot that takes
 * them, which is optimal for this nested A ⊂ B ⊂ C size structure.
 */
export function planPlacement(
  parcels: readonly Parcel[],
  wall: readonly Slot[],
): Record<string, string> | null {
  const bySize = [...wall].sort((a, b) => sizeRank(a.size) - sizeRank(b.size));
  const used = new Set<string>();
  const largestFirst = [...parcels].sort((a, b) => sizeRank(b.size) - sizeRank(a.size));
  const placement: Record<string, string> = {};
  for (const parcel of largestFirst) {
    const slot = bySize.find((candidate) => !used.has(candidate.id) && fits(parcel.size, candidate.size));
    if (slot === undefined) {
      return null;
    }
    used.add(slot.id);
    placement[parcel.id] = slot.id;
  }
  return placement;
}
