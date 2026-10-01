import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The site-shell guarantees that are properties of the repository rather than
 * of any module: what ships, and what it must not drag along with it.
 */

const root = process.cwd();
const read = (...parts: string[]): string => readFileSync(join(root, ...parts), 'utf8');

interface PackageJson {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly scripts?: Record<string, string>;
  readonly engines?: Record<string, string>;
}

const pkg = JSON.parse(read('package.json')) as PackageJson;

describe('zero runtime dependencies', () => {
  it('declares no dependencies at all', () => {
    expect(pkg.dependencies ?? {}).toEqual({});
  });

  it('keeps the toolchain in devDependencies', () => {
    for (const name of ['vite', 'typescript', 'vitest', 'eslint', '@playwright/test']) {
      expect(Object.keys(pkg.devDependencies ?? {})).toContain(name);
    }
  });

  it('offers the scripts the README documents', () => {
    for (const script of [
      'dev',
      'build',
      'preview',
      'typecheck',
      'lint',
      'test',
      'test:e2e',
      'gen:icons',
    ]) {
      expect(Object.keys(pkg.scripts ?? {})).toContain(script);
    }
  });

  it('states the Node range the README states', () => {
    const engines = pkg.engines?.['node'];
    expect(engines).toBeDefined();
    expect(read('README.md')).toContain(engines ?? '');
  });
});

describe('static assets', () => {
  it('ships a CNAME for the custom domain', () => {
    expect(read('public', 'CNAME').trim()).toBe('paczkom.at');
  });

  it('ships an installable manifest with icons', () => {
    const manifest = JSON.parse(read('public', 'manifest.webmanifest')) as {
      name: string;
      display: string;
      icons: { src: string; sizes: string }[];
    };
    expect(manifest.name).toBe('paczkom.at');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.map((icon) => icon.sizes)).toContain('192x192');
    expect(manifest.icons.map((icon) => icon.sizes)).toContain('512x512');
    for (const icon of manifest.icons) {
      expect(existsSync(join(root, 'public', icon.src.replace(/^\//, '')))).toBe(true);
    }
  });

  it('ships a favicon and the bundled typeface', () => {
    expect(existsSync(join(root, 'public', 'favicon.svg'))).toBe(true);
    for (const font of [
      'inter-latin-400-normal.woff2',
      'inter-latin-700-normal.woff2',
      'inter-latin-ext-400-normal.woff2',
      'inter-latin-ext-700-normal.woff2',
      'Inter-LICENSE.txt',
    ]) {
      expect(existsSync(join(root, 'public', 'fonts', font)), font).toBe(true);
    }
  });
});

describe('index.html', () => {
  const html = read('index.html');

  it('is the only page, and carries the five screens', () => {
    for (const id of ['screen-loading', 'screen-error', 'screen-picker', 'screen-card', 'screen-ranking']) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it('links the manifest and the favicon', () => {
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('/favicon.svg');
  });
});

describe('deployment', () => {
  it('has a CI workflow that runs every gate', () => {
    const ci = read('.github', 'workflows', 'ci.yml');
    for (const step of ['npm run typecheck', 'npm run lint', 'npm test', 'npm run build', 'npm run test:e2e']) {
      expect(ci, step).toContain(step);
    }
  });

  it('gates every push, on every branch, as well as pull requests', () => {
    const ci = read('.github', 'workflows', 'ci.yml');
    const triggers = ci.slice(ci.indexOf('\non:'), ci.indexOf('\njobs:'));
    expect(triggers).toContain('push:');
    expect(triggers).toContain('pull_request');
    // No branch filter on push: a red gate should show up before the PR exists.
    expect(triggers).not.toContain('branches');
  });

  it('has a deploy workflow wired to GitHub Pages on main', () => {
    const deploy = read('.github', 'workflows', 'deploy.yml');
    expect(deploy).toContain('actions/upload-pages-artifact');
    expect(deploy).toContain('actions/deploy-pages');
    expect(deploy).toContain('branches: [main]');
  });

  it('deploys the commit CI passed, not whatever main points at', () => {
    const deploy = read('.github', 'workflows', 'deploy.yml');
    expect(deploy).toContain('github.event.workflow_run.head_sha');
  });

  it('keeps the screenshots and the Playwright report as CI artefacts', () => {
    const ci = read('.github', 'workflows', 'ci.yml');
    expect(ci).toContain('test-results/screens/');
    expect(ci).toContain('playwright-report/');
    expect(ci).toContain('if: always()');
  });

  it('documents setup, running and deployment in the README', () => {
    const readme = read('README.md');
    for (const heading of ['## Requirements', '## Install', '## Develop', '## Test', '## Build', '## Deploy']) {
      expect(readme, heading).toContain(heading);
    }
    expect(readme).toContain('paczkom.at');
    expect(readme).toContain('LAUNCH_EPOCH');
  });
});

describe('link previews', () => {
  const html = read('index.html');
  const meta = (attr: 'property' | 'name', key: string): string | undefined =>
    new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`).exec(html)?.[1];

  it('describe the game to anything that unfurls a link', () => {
    expect(meta('property', 'og:title')).toBe('paczkom.at');
    expect(meta('property', 'og:description')).not.toBe('');
    expect(meta('property', 'og:url')).toBe('https://paczkom.at/');
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
  });

  it('point at an absolute image that ships, at the size they claim', () => {
    expect(meta('property', 'og:image')).toBe('https://paczkom.at/og.png');
    const png = readFileSync(join(root, 'public', 'og.png'));
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    // IHDR: width and height are the first two big-endian words after the tag.
    expect(png.readUInt32BE(16)).toBe(Number(meta('property', 'og:image:width')));
    expect(png.readUInt32BE(20)).toBe(Number(meta('property', 'og:image:height')));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });
});
