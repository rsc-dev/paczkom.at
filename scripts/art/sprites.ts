/**
 * Where each sprite sits on the owner's art board: [width, height, x, y] in
 * board pixels, plus rectangles (in the crop's own pixels) to blank out —
 * the locker's sign (no trade mark) and the hare standing on the balcony
 * roof (no borrowed characters). The house sits on a darker patch of the
 * board's screen, so it clears at a lower white point.
 */
export interface Sprite {
  readonly name: string;
  readonly board: string;
  readonly box: readonly [number, number, number, number];
  readonly blank?: readonly (readonly [number, number, number, number])[];
  /** ImageMagick `-level` black,white points; tones lighter than white become clear. */
  readonly level?: string;
}

const B1 = 'scripts/art/source/board-1.png';

export const SPRITES: readonly Sprite[] = [
  { name: 'parcel-a', board: B1, box: [47, 46, 29, 714] },
  { name: 'parcel-b', board: B1, box: [42, 48, 193, 720] },
  { name: 'parcel-c', board: B1, box: [42, 50, 272, 715] },
  { name: 'parcel-d', board: B1, box: [44, 46, 351, 720] },
  { name: 'parcel-e', board: B1, box: [44, 46, 479, 719] },
  { name: 'bird', board: B1, box: [66, 56, 591, 706] },
  { name: 'bird-perch', board: B1, box: [65, 58, 659, 720] },
  { name: 'drone', board: B1, box: [83, 67, 741, 702] },
  { name: 'tree', board: B1, box: [67, 96, 834, 690] },
  { name: 'lamp', board: B1, box: [31, 125, 1086, 661] },
  { name: 'bush', board: B1, box: [94, 106, 1115, 680] },
  { name: 'locker', board: B1, box: [151, 105, 920, 681], blank: [[25, 14, 125, 36]] },
  { name: 'house', board: B1, box: [150, 255, 55, 165], blank: [[60, 0, 150, 24]], level: '24%,60%' },
  { name: 'heart', board: B1, box: [22, 22, 612, 128] },
];
