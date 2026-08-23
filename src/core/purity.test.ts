import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const coreDir = fileURLToPath(new URL('.', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

/**
 * The ESLint config enforces this too, but the spec states it as a property of
 * the core, so it gets a test that fails loudly regardless of lint config.
 */
describe('core purity', () => {
  const files = sourceFiles(coreDir);

  it('finds core source files to scan', () => {
    expect(files.length).toBeGreaterThan(4);
  });

  it.each([
    ['Math.random', /Math\s*\.\s*random/],
    ['Date.now', /Date\s*\.\s*now/],
    ['document', /\bdocument\s*\./],
    ['window', /\bwindow\s*\./],
    ['localStorage', /\blocalStorage\b/],
  ])('never uses %s', (_label, pattern) => {
    const offenders = files.filter((file) => pattern.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
