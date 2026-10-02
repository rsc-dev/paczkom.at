import { describe, expect, it } from 'vitest';
import { parseRoute, resolveInitialTown } from './route.js';

describe('parseRoute', () => {
  it.each<[string, string, string | null, boolean]>([
    ['/', '', null, false],
    ['/krakow', '', 'krakow', false],
    ['/nowy-targ/', '', 'nowy-targ', false],
    ['/', '?week=k3j9x', null, true],
    ['/Kraków/', '', null, false],
    ['/a/b', '', null, false],
    ['/index.html', '', null, false],
  ])('%s%s → slug %s, retired %s', (path, search, slug, retired) => {
    expect(parseRoute(path, search)).toEqual({ slug, retired });
  });
});

describe('resolveInitialTown', () => {
  const known = new Set(['krakow', 'gdansk']);

  it('opens a shared town without making it the reader’s own', () => {
    expect(resolveInitialTown('gdansk', 'krakow', known)).toEqual({ slug: 'gdansk', shared: true });
  });

  it('treats a shared link to your own town as your town', () => {
    expect(resolveInitialTown('krakow', 'krakow', known)).toEqual({ slug: 'krakow', shared: false });
  });

  it('falls back to the saved town, then to the picker', () => {
    expect(resolveInitialTown(null, 'krakow', known)).toEqual({ slug: 'krakow', shared: false });
    expect(resolveInitialTown(null, undefined, known)).toBeNull();
  });

  it('ignores a saved or shared town that no longer exists', () => {
    expect(resolveInitialTown(null, 'atlantyda', known)).toBeNull();
    expect(resolveInitialTown('atlantyda', 'krakow', known)).toEqual({ slug: 'krakow', shared: false });
    expect(resolveInitialTown(null, 42, known)).toBeNull();
  });
});
