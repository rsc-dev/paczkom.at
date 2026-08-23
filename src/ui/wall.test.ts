// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { buildWall } from '../core/wall.js';
import { buildWallDom, doorColumnWide, panelColumnIndex, stageColumns } from './wall.js';

beforeEach(() => {
  document.body.innerHTML = '<div id="stage"></div>';
});

const stage = (): HTMLElement => {
  const element = document.querySelector<HTMLElement>('#stage');
  if (element === null) {
    throw new Error('no stage');
  }
  return element;
};

describe('panel placement', () => {
  it('puts the screen module between the door columns', () => {
    expect(panelColumnIndex(3)).toBe(2);
    expect(panelColumnIndex(2)).toBe(1);
    expect(panelColumnIndex(5)).toBe(3);
  });

  const trackCount = (template: string): number => template.split('minmax(').length - 1;

  it('inserts exactly one extra track for it', () => {
    expect(trackCount(stageColumns(3))).toBe(4);
    expect(trackCount(stageColumns(5))).toBe(6);
    expect(stageColumns(3)).toContain('minmax(11rem, 1.3fr)');
    // ... and exactly one of the tracks is the panel.
    expect(stageColumns(3).split('minmax(11rem').length - 1).toBe(1);
  });

  it('shifts the columns after the panel by one', () => {
    expect(doorColumnWide(0, 3)).toBe(1);
    expect(doorColumnWide(1, 3)).toBe(2);
    expect(doorColumnWide(2, 3)).toBe(4);
  });
});

describe('buildWallDom', () => {
  it('creates one button per slot, keyed by slot id', () => {
    const slots = buildWall(3);
    const doors = buildWallDom(stage(), slots, 3);

    expect(doors.size).toBe(21);
    expect(stage().querySelectorAll('button.door')).toHaveLength(21);
    for (const slot of slots) {
      expect(doors.get(slot.id)?.root.dataset['slot']).toBe(slot.id);
    }
  });

  it('starts every door empty and labels it with its size', () => {
    const doors = buildWallDom(stage(), buildWall(3), 3);
    const door = doors.get('c1r4');
    expect(door?.root.dataset['state']).toBe('empty');
    expect(door?.root.dataset['size']).toBe('B');
    expect(door?.root.type).toBe('button');
  });

  it('writes grid placement as custom properties for the stylesheet to use', () => {
    const doors = buildWallDom(stage(), buildWall(3), 3);
    const bottomRight = doors.get('c2r6')?.root;
    expect(bottomRight?.style.getPropertyValue('--col-narrow')).toBe('3');
    expect(bottomRight?.style.getPropertyValue('--col-wide')).toBe('4');
    expect(bottomRight?.style.getPropertyValue('--row')).toBe('9');
    expect(bottomRight?.style.getPropertyValue('--span')).toBe('4');
  });

  it('gives the stage its column tracks and the panel its own', () => {
    buildWallDom(stage(), buildWall(3), 3);
    expect(stage().style.getPropertyValue('--wall-columns')).toBe('3');
    expect(stage().style.getPropertyValue('--panel-column')).toBe('3');
    expect(stage().style.getPropertyValue('--stage-columns')).toBe(stageColumns(3));
  });

  it('gives every door a hit extender and a face', () => {
    const doors = buildWallDom(stage(), buildWall(2), 2);
    for (const door of doors.values()) {
      expect(door.root.querySelector('.door__hit')).not.toBeNull();
      expect(door.root.querySelector('.door__cavity')).not.toBeNull();
      expect(door.root.querySelector('.door__face')).not.toBeNull();
    }
  });

  it('keeps whatever the stage already held, such as the screen panel', () => {
    stage().innerHTML = '<section id="panel"></section>';
    buildWallDom(stage(), buildWall(2), 2);
    expect(stage().firstElementChild?.id).toBe('panel');
    expect(stage().querySelectorAll('.door')).toHaveLength(14);
  });
});
