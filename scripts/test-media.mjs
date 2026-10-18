import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mountResults } from '../public/results-gallery.js';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const media = resolve(site, 'public/media');
const manifest = JSON.parse(readFileSync(resolve(media, 'manifest.json'), 'utf8'));
const tick = () => new Promise(resolve => setImmediate(resolve));

test('all scene recordings have matching viewer metadata and both entries share the PDF abstract', () => {
  for (const asset of manifest.assets.filter(a => a.path.endsWith('.viser'))) {
    assert.equal(asset.scene.version, '1.0.24');
    assert.equal(asset.scene.representation, 'point-cloud');
    assert.ok(asset.scene.duration > 0);
    for (const key of ['cameraPosition', 'cameraLookAt', 'cameraUp']) {
      assert.equal(asset.scene[key].length, 3);
      assert.ok(asset.scene[key].every(Number.isFinite));
    }
  }
  const html = readFileSync(resolve(site, 'index.html'), 'utf8');
  const react = readFileSync(resolve(site, 'app/page.tsx'), 'utf8');
  const normalize = text => text.trim().replace(/\s+/g, ' ');
  const original = html.match(/<p class="body-copy">([\s\S]*?)<\/p>/)[1];
  assert.equal(normalize(original), normalize(react.match(/<p className="body-copy">([\s\S]*?)<\/p>/)[1]));
  assert.match(original, /^Imitation learning \(IL\)/);
  assert.match(original, /both simulation and real-world environments\.$/);
});

test('paper diagrams use animated GIFs with static reduced-motion fallbacks', () => {
  const html = readFileSync(resolve(site, 'index.html'), 'utf8');
  const react = readFileSync(resolve(site, 'app/page.tsx'), 'utf8');
  for (const name of ['overview', 'method-pipeline']) {
    assert.ok(existsSync(resolve(site, `public/images/${name}.png`)));
    assert.ok(existsSync(resolve(site, `public/images/${name}-animated.gif`)));
    assert.match(html, new RegExp(`prefers-reduced-motion: reduce[\\s\\S]*?${name}\\.png[\\s\\S]*?${name}-animated\\.gif`));
    assert.match(react, new RegExp(`prefers-reduced-motion: reduce[\\s\\S]*?${name}\\.png[\\s\\S]*?${name}-animated\\.gif`));
  }
});

test('category, task, and example selection start all non-temporal videos muted', async () => {
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  globalThis.document = { activeElement: null, addEventListener() {} };
  globalThis.fetch = async () => ({ ok: true, json: async () => manifest });
  const handlers = {};
  let plays = 0;
  const clip = { muted: false, play() { assert.equal(this.muted, true); plays++; return Promise.resolve(); }, pause() {}, load() {}, removeAttribute() {} };
  const root = {
    innerHTML: '', contains: () => false, querySelectorAll: () => [clip, clip, clip], querySelector: () => null,
    addEventListener: (event, callback) => { handlers[event] = callback; }, replaceChildren() {},
  };
  try {
    const cleanup = mountResults(root);
    await tick();
    assert.equal(plays, 0);
    handlers.click({ target: { closest: () => ({ dataset: { mode: 'generation' } }) } });
    assert.equal(plays, 3);
    handlers.change({ target: { dataset: { choice: 'low' }, value: '1' } });
    assert.equal(plays, 6);
    handlers.click({ target: { closest: () => ({ dataset: { task: 'bread' } }) } });
    assert.equal(plays, 9);
    cleanup();
  } finally {
    globalThis.document = previousDocument;
    globalThis.fetch = previousFetch;
  }
});

test('all 320 source assets and 216 video posters exist', () => {
  assert.equal(manifest.assets.length, 320);
  assert.equal(new Set(manifest.assets.map(a => a.path)).size, 320);
  assert.equal(manifest.assets.filter(a => a.poster).length, 216);
  for (const asset of manifest.assets) {
    assert.match(asset.path, /^[a-zA-Z0-9_./-]+$/);
    assert.ok(!asset.path.split('/').includes('..'));
    assert.equal(statSync(resolve(media, asset.path)).size, asset.bytes);
    if (asset.path.endsWith('.mp4')) {
      assert.equal(asset.codec, 'h264');
      assert.ok(asset.duration > 0 && asset.width > 0 && asset.height > 0);
      assert.ok(existsSync(resolve(media, asset.poster)));
    }
  }
});

test('gallery renders every task/category/example with valid static and preview URLs', async () => {
  // Rendering/event unit test, without driving a browser or downloading video bodies.
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  globalThis.document = { activeElement: null, addEventListener() {} };
  try {
    for (const base of ['public/media/', 'media/']) {
      globalThis.fetch = async (url) => {
        assert.equal(url, base + 'manifest.json');
        return { ok: true, json: async () => manifest };
      };
      const handlers = {};
      const root = {
        innerHTML: '', contains: () => false, querySelectorAll: () => [], querySelector: () => null,
        addEventListener: (event, callback) => { handlers[event] = callback; },
        replaceChildren() { this.innerHTML = ''; },
      };
      const cleanup = mountResults(root, base);
      await tick();
      const seen = new Set();
      const check = () => {
        assert.ok(!root.innerHTML.includes('not available'));
        assert.ok(!root.innerHTML.includes('undefined'));
        assert.ok(!/<video[^>]*autoplay/.test(root.innerHTML));
        assert.ok(!root.innerHTML.includes('<details'));
        for (const [, options] of root.innerHTML.matchAll(/<select[^>]*>([\s\S]*?)<\/select>/g)) {
          const numbers = [...options.matchAll(/<option[^>]*>(\d+)<\/option>/g)].map(match => Number(match[1]));
          assert.deepEqual(numbers, numbers.map((_, i) => i + 1));
        }
        if (root.innerHTML.includes('class="temporal-layout"')) {
          assert.match(root.innerHTML, /<iframe /);
          const source = root.innerHTML.match(/<iframe src="([^"]+)"/)[1].replaceAll('&amp;', '&');
          const viewer = new URL(source, 'http://localhost/');
          assert.match(viewer.pathname, /\/viser\/index.html$/);
          assert.ok(existsSync(resolve(site, 'public/viser/index.html')));
          assert.ok(existsSync(resolve(site, 'public/viser', viewer.searchParams.get('playbackPath'))));
          assert.equal(viewer.searchParams.get('initialCameraPosition').split(',').length, 3);
        }
        const videoCount = [...root.innerHTML.matchAll(/<video /g)].length;
        assert.equal([...root.innerHTML.matchAll(/preload="none"/g)].length, videoCount);
        assert.equal([...root.innerHTML.matchAll(/aria-pressed="true"/g)].length, 2);
        for (const [, link] of root.innerHTML.matchAll(/(?:src|href|poster)="([^"]+)"/g)) {
          if (!link.startsWith(base)) continue;
          const relative = decodeURIComponent(link.slice(base.length));
          assert.ok(existsSync(resolve(media, relative)), `Broken link: ${link}`);
          seen.add(relative);
        }
      };
      const click = (dataset) => {
        handlers.click({ target: { closest: () => ({ dataset, classList: { contains: () => false } }) } });
        check();
      };
      check();
      for (const task of manifest.tasks) {
        click({ task });
        for (const mode of ['temporal', 'generation', 'appearance', 'policy']) {
          click({ mode });
          const selects = [...root.innerHTML.matchAll(/<select data-choice="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)];
          for (const [, choice, options] of selects) {
            for (const [, value] of options.matchAll(/<option value="([^"]+)"/g)) {
              handlers.change({ target: { dataset: { choice }, value } });
              check();
            }
          }
        }
      }
      for (const asset of manifest.assets) assert.ok(seen.has(asset.path), `Unreachable asset: ${asset.path}`);
      cleanup();
      assert.equal(root.innerHTML, '');
    }
  } finally {
    globalThis.document = previousDocument;
    globalThis.fetch = previousFetch;
  }
});

test('failed manifest requests show a readable error', async () => {
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  globalThis.document = { addEventListener() {} };
  globalThis.fetch = async () => ({ ok: false });
  const root = { innerHTML: '', addEventListener() {}, querySelectorAll: () => [], replaceChildren() {} };
  try {
    const cleanup = mountResults(root);
    await tick();
    assert.match(root.innerHTML, /Results could not be loaded/);
    cleanup();
  } finally {
    globalThis.document = previousDocument;
    globalThis.fetch = previousFetch;
  }
});
