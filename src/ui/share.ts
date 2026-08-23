/**
 * Share, with a fallback for every browser (design D8): the Web Share sheet if
 * it will take the payload, the clipboard if not, and a selectable text area if
 * neither is available. The caller is told which path worked so it can say so.
 */

export type ShareOutcome = 'shared' | 'copied' | 'manual' | 'failed';

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

/**
 * Tries each path in turn. A share sheet the user dismisses counts as failed
 * here, and the caller falls through to showing the text.
 */
export async function shareText(text: string, targets: ShareTargets): Promise<ShareOutcome> {
  const payload: ShareData = { text };

  if (targets.share !== undefined && (targets.canShare?.(payload) ?? true)) {
    try {
      await targets.share(payload);
      return 'shared';
    } catch {
      // Dismissed or refused: fall through rather than leaving the player stuck.
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
