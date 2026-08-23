/**
 * Wall geometry. A column is 12 units tall and always laid out top to bottom as
 * A A A A B B C, where A, B and C span 1, 2 and 4 units. Only the column count
 * varies between day profiles.
 */

export type Size = 'A' | 'B' | 'C';

export interface Slot {
  /** `c{col}r{index}` — stable across a day and used as the DOM node key. */
  readonly id: string;
  readonly size: Size;
  /** Zero-based column. */
  readonly col: number;
  /** Zero-based index within the column, top to bottom. */
  readonly index: number;
  /** Unit offset of the slot's top edge within its column. */
  readonly row: number;
  /** Height of the slot in units. */
  readonly span: number;
}

export const COLUMN_LAYOUT: readonly Size[] = ['A', 'A', 'A', 'A', 'B', 'B', 'C'];

export const SIZE_SPAN: Readonly<Record<Size, number>> = { A: 1, B: 2, C: 4 };

const SIZE_RANK: Readonly<Record<Size, number>> = { A: 0, B: 1, C: 2 };

export const UNITS_PER_COLUMN = COLUMN_LAYOUT.reduce((sum, size) => sum + SIZE_SPAN[size], 0);

export const SLOTS_PER_COLUMN = COLUMN_LAYOUT.length;

/** A < B < C. */
export function sizeRank(size: Size): number {
  return SIZE_RANK[size];
}

/** A parcel fits a slot when it is no larger than the slot. */
export function fits(parcelSize: Size, slotSize: Size): boolean {
  return sizeRank(parcelSize) <= sizeRank(slotSize);
}

/** Every slot of an N-column wall, ordered column by column, top to bottom. */
export function buildWall(columns: number): Slot[] {
  if (!Number.isInteger(columns) || columns <= 0) {
    throw new RangeError(`buildWall needs a positive integer column count, got ${String(columns)}`);
  }
  const slots: Slot[] = [];
  for (let col = 0; col < columns; col += 1) {
    let row = 0;
    COLUMN_LAYOUT.forEach((size, index) => {
      slots.push({
        id: `c${String(col)}r${String(index)}`,
        size,
        col,
        index,
        row,
        span: SIZE_SPAN[size],
      });
      row += SIZE_SPAN[size];
    });
  }
  return slots;
}

/** How many slots of each size a wall has. */
export function slotCapacity(wall: readonly Slot[]): Record<Size, number> {
  const capacity: Record<Size, number> = { A: 0, B: 0, C: 0 };
  for (const slot of wall) {
    capacity[slot.size] += 1;
  }
  return capacity;
}
