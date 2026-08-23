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
      'gen:fixtures',
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

  it('is the only page, and carries the four screens', () => {
    for (const id of ['screen-title', 'screen-howto', 'screen-game', 'screen-result']) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it('has the scenery slot in front of the wall', () => {
    expect(html.indexOf('class="scenery"')).toBeGreaterThan(0);
    expect(html.indexOf('class="scenery"')).toBeLessThan(html.indexOf('id="stage"'));
  });

  it('links the manifest, the favicon and the theme', () => {
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('/favicon.svg');
    expect(html).toContain('data-theme="signage"');
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
