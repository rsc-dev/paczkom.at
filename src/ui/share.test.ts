import { describe, expect, it, vi } from 'vitest';
import { shareText, targetsFrom } from './share.js';

const TEXT = 'paczkom.at · Dzisiaj #12\n📦\n1240 pkt · 1:47\nhttps://www.paczkom.at';

describe('shareText', () => {
  it('uses the share sheet when the browser will take the payload', async () => {
    const share = vi.fn(async () => {
      await Promise.resolve();
    });
    const writeText = vi.fn(async () => {
      await Promise.resolve();
    });
    const outcome = await shareText(TEXT, { share, canShare: () => true, writeText });

    expect(outcome).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: TEXT });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('skips the share sheet when canShare refuses the payload', async () => {
    const share = vi.fn(async () => {
      await Promise.resolve();
    });
    const writeText = vi.fn(async () => {
      await Promise.resolve();
    });
    const outcome = await shareText(TEXT, { share, canShare: () => false, writeText });

    expect(outcome).toBe('copied');
    expect(share).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(TEXT);
  });

  it('falls back to the clipboard when there is no share API', async () => {
    const writeText = vi.fn(async () => {
      await Promise.resolve();
    });
    expect(await shareText(TEXT, { writeText })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(TEXT);
  });

  it('stops when the player dismisses the share sheet', async () => {
    const abort = Object.assign(new Error('share canceled'), { name: 'AbortError' });
    const share = vi.fn(async () => {
      await Promise.reject(abort);
    });
    const writeText = vi.fn(async () => {
      await Promise.resolve();
    });

    // Dismissing is a decision, not a failure: do not quietly copy instead.
    expect(await shareText(TEXT, { share, writeText })).toBe('dismissed');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls through to the clipboard when the share sheet fails for real', async () => {
    const share = vi.fn(async () => {
      await Promise.reject(new Error('NotAllowedError'));
    });
    const writeText = vi.fn(async () => {
      await Promise.resolve();
    });
    expect(await shareText(TEXT, { share, writeText })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(TEXT);
  });

  it('asks the caller to show the text when neither API is available', async () => {
    expect(await shareText(TEXT, {})).toBe('manual');
  });

  it('asks the caller to show the text when the clipboard is refused too', async () => {
    const writeText = vi.fn(async () => {
      await Promise.reject(new Error('NotAllowedError'));
    });
    expect(await shareText(TEXT, { writeText })).toBe('manual');
  });
});

describe('targetsFrom', () => {
  it('reads nothing from a browser with neither API', () => {
    expect(targetsFrom({} as Navigator)).toEqual({
      share: undefined,
      canShare: undefined,
      writeText: undefined,
    });
  });

  it('binds the APIs it does find', () => {
    const navigatorLike = {
      share: async () => {
        await Promise.resolve();
      },
      canShare: () => true,
      clipboard: {
        writeText: async () => {
          await Promise.resolve();
        },
      },
    } as unknown as Navigator;

    const targets = targetsFrom(navigatorLike);
    expect(typeof targets.share).toBe('function');
    expect(typeof targets.canShare).toBe('function');
    expect(typeof targets.writeText).toBe('function');
  });

  it('copes with no navigator at all', () => {
    expect(targetsFrom(undefined)).toEqual({});
  });
});
