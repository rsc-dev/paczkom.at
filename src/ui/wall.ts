/**
 * Builds the door buttons once, from the wall geometry, and hands back a map
 * the renderer can address by slot id. Placement is expressed as CSS custom
 * properties so the stylesheet owns both the phone and the desktop layout.
 */
import type { Slot } from '../core/wall.js';
import { setVar } from './dom.js';

export interface DoorNodes {
  readonly root: HTMLButtonElement;
  readonly face: HTMLElement;
  readonly slot: Slot;
}

export type WallNodes = ReadonlyMap<string, DoorNodes>;

/**
 * Where the screen panel sits among the door columns on wide viewports: just
 * right of centre, the way a locker's screen module is built into the cabinet.
 * Zero-based, counted in door columns.
 */
export function panelColumnIndex(columns: number): number {
  return Math.ceil(columns / 2);
}

/** `grid-template-columns` for the wide layout, with the panel track inserted. */
export function stageColumns(columns: number): string {
  const panelAt = panelColumnIndex(columns);
  const tracks: string[] = [];
  for (let col = 0; col <= columns; col += 1) {
    tracks.push(col === panelAt ? 'minmax(11rem, 1.3fr)' : 'minmax(0, 1fr)');
  }
  return tracks.join(' ');
}

/** The 1-based grid column a door occupies on wide viewports. */
export function doorColumnWide(col: number, columns: number): number {
  return col + 1 + (col >= panelColumnIndex(columns) ? 1 : 0);
}

function doorElement(slot: Slot, columns: number): DoorNodes {
  const root = document.createElement('button');
  root.type = 'button';
  root.className = 'door';
  root.dataset['slot'] = slot.id;
  root.dataset['size'] = slot.size;
  root.dataset['state'] = 'empty';

  setVar(root, '--col-narrow', String(slot.col + 1));
  setVar(root, '--col-wide', String(doorColumnWide(slot.col, columns)));
  setVar(root, '--row', String(slot.row + 1));
  setVar(root, '--span', String(slot.span));

  const hit = document.createElement('span');
  hit.className = 'door__hit';
  hit.setAttribute('aria-hidden', 'true');

  const cavity = document.createElement('span');
  cavity.className = 'door__cavity';
  cavity.setAttribute('aria-hidden', 'true');

  const face = document.createElement('span');
  face.className = 'door__face';
  face.setAttribute('aria-hidden', 'true');

  const size = document.createElement('span');
  size.className = 'door__size';
  size.textContent = slot.size;

  // The glyph on a marked, outgoing or expired door is CSS content keyed on
  // `data-state`, so a theme owns it — and so the Week change's jam marker is a
  // CSS rule rather than a string in here.
  const mark = document.createElement('span');
  mark.className = 'door__mark';
  mark.setAttribute('aria-hidden', 'true');

  face.append(size, mark);
  root.append(hit, cavity, face);
  return { root, face, slot };
}

/**
 * Creates one button per slot inside the stage, after whatever is already there
 * (the screen panel), and returns them keyed by slot id.
 */
export function buildWallDom(stage: HTMLElement, slots: readonly Slot[], columns: number): WallNodes {
  const doors = new Map<string, DoorNodes>();
  const fragment = document.createDocumentFragment();
  for (const slot of slots) {
    const door = doorElement(slot, columns);
    doors.set(slot.id, door);
    fragment.append(door.root);
  }
  setVar(stage, '--wall-columns', String(columns));
  setVar(stage, '--stage-columns', stageColumns(columns));
  setVar(stage, '--panel-column', String(panelColumnIndex(columns) + 1));
  stage.append(fragment);
  return doors;
}
