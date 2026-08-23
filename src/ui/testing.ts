/**
 * Test support: mounts the real `index.html` skeleton into jsdom, so the view
 * tests run against the markup that actually ships rather than a fixture that
 * can drift away from it.
 *
 * Imported only by tests; nothing in the app graph references it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Resolved from the working directory rather than `import.meta.url`: under the
// jsdom environment module URLs are http, not file.
const INDEX = join(process.cwd(), 'index.html');

/** Replaces the document body with the shipped skeleton, minus the entry script. */
export function mountApp(): HTMLElement {
  const html = readFileSync(INDEX, 'utf8');
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1];
  if (body === undefined) {
    throw new Error('index.html has no body');
  }
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
  const app = document.querySelector<HTMLElement>('#app');
  if (app === null) {
    throw new Error('index.html has no #app');
  }
  return app;
}

/** Records every attribute mutation under `root` until the returned stop is called. */
export function recordMutations(root: Node): {
  changed(): string[];
  stop(): void;
} {
  const seen: string[] = [];
  const collect = (records: MutationRecord[]): void => {
    for (const record of records) {
      if (record.type === 'attributes' && record.target instanceof Element) {
        const owner = record.target.closest('[data-slot]');
        const id = owner?.getAttribute('data-slot') ?? record.target.tagName.toLowerCase();
        seen.push(`${id}:${record.attributeName ?? '?'}`);
      }
    }
  };
  const observer = new MutationObserver(collect);
  observer.observe(root, { attributes: true, subtree: true, characterData: true });
  return {
    // Mutation callbacks are asynchronous; drain the queue so a synchronous
    // render can be inspected right after it happened.
    changed: () => {
      collect(observer.takeRecords());
      return [...seen];
    },
    stop: () => {
      observer.disconnect();
    },
  };
}
