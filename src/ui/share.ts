/**
 * Share, with a fallback for every browser (design D8): the Web Share sheet if
 * it will take the payload, the clipboard if not, and a selectable text area if
 * neither is available. The caller is told which path worked so it can say so.
 */

/**
 * `dismissed` means the reader closed the share sheet: they made a choice, and
 * the right response is to do nothing rather than to quietly copy instead.
 */
export type ShareOutcome = 'shared' | 'dismissed' | 'copied' | 'manual';

export interface ShareTargets {
  readonly share?: ((data: ShareData) => Promise<void>) | undefined;
  readonly canShare?: ((data: ShareData) => boolean) | undefined;
  readonly writeText?: ((text: string) => Promise<void>) | undefined;
}

/** Reads the share and clipboard APIs off a navigator, if it has them. */
export function targetsFrom(source: Navigator | undefined): ShareTargets {
  if (source === undefined) {
    return {};
  }
  return {
    share: typeof source.share === 'function' ? source.share.bind(source) : undefined,
    canShare: typeof source.canShare === 'function' ? source.canShare.bind(source) : undefined,
    writeText:
      typeof source.clipboard?.writeText === 'function'
        ? source.clipboard.writeText.bind(source.clipboard)
        : undefined,
  };
}

/** `AbortError` is what browsers throw when the share sheet is dismissed. */
function isDismissal(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

/**
 * Tries each path in turn. A dismissed share sheet stops there — the reader
 * said no, and quietly copying to their clipboard instead is not what they
 * asked for. Anything else that goes wrong falls through to the next path.
 */
export async function shareText(text: string, targets: ShareTargets): Promise<ShareOutcome> {
  const payload: ShareData = { text };

  if (targets.share !== undefined && (targets.canShare?.(payload) ?? true)) {
    try {
      await targets.share(payload);
      return 'shared';
    } catch (error) {
      if (isDismissal(error)) {
        return 'dismissed';
      }
      // Refused for some other reason: fall through rather than leaving the
      // reader with no way to get the text out at all.
    }
  }

  if (targets.writeText !== undefined) {
    try {
      await targets.writeText(text);
      return 'copied';
    } catch {
      // Clipboard blocked without a gesture, or no permission.
    }
  }

  return 'manual';
}
