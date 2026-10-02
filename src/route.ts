/** What the URL asks for. Pure, so the boot logic is testable without a browser. */
export interface Route {
  readonly slug: string | null;
  /** An old game link (`?week=`): say the game is gone, then carry on. */
  readonly retired: boolean;
}

export function parseRoute(pathname: string, search: string): Route {
  const match = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(pathname);
  const slug = match?.[1] ?? null;
  return { slug: slug === 'index' ? null : slug, retired: new URLSearchParams(search).has('week') };
}

/**
 * A shared town wins for this visit but never replaces the reader's own; a
 * slug that no longer exists (list regenerated, typo) falls through.
 */
export function resolveInitialTown(
  routeSlug: string | null,
  savedSlug: unknown,
  known: ReadonlySet<string>,
): { slug: string; shared: boolean } | null {
  const saved = typeof savedSlug === 'string' && known.has(savedSlug) ? savedSlug : null;
  if (routeSlug !== null && known.has(routeSlug)) {
    return { slug: routeSlug, shared: routeSlug !== saved };
  }
  return saved === null ? null : { slug: saved, shared: false };
}
