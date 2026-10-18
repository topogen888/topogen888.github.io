import { test } from 'node:test';
import assert from 'node:assert/strict';
import { synchronizeVideos } from '../public/synchronized-videos.js';

class Element extends EventTarget {
  textContent = '';
  value = '0';
  attributes = {};
  setAttribute(name, value) { this.attributes[name] = value; }
  emit(name) { this.dispatchEvent(new Event(name)); }
}
class Video extends Element {
  currentTime = 0;
  duration = 6.53;
  readyState = 4;
  seeking = false;
  error = null;
  paused = true;
  rejectPlayback = false;
  plays = 0;
  loads = 0;
  load() { this.loads++; }
  play() {
    this.plays++;
    if (this.rejectPlayback) return Promise.reject(new Error('NotAllowedError'));
    this.paused = false;
    return Promise.resolve();
  }
  pause() { this.paused = true; }
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture(options = {}, unready = false) {
  const videos = [new Video(), new Video()];
  if (unready) videos[1].readyState = 2;
  const elements = Object.fromEntries(['play','restart','seek','clock','status'].map(name => [`[data-sync-${name}]`, new Element()]));
  const controls = { querySelector: selector => elements[selector] };
  const realInterval = globalThis.setInterval;
  const realClear = globalThis.clearInterval;
  let tick;
  let cleared = false;
  globalThis.setInterval = fn => { tick = fn; return 101; };
  globalThis.clearInterval = id => { assert.equal(id, 101); cleared = true; };
  const transport = synchronizeVideos(videos, controls, { duration: 6.53, ...options });
  return { videos, elements, transport, tick: () => tick(), cleanup: () => {
    transport.dispose();
    assert.equal(cleared, true);
    globalThis.setInterval = realInterval;
    globalThis.clearInterval = realClear;
  } };
}

test('only the shared play action starts both; pause and clicking a video are linked', async () => {
  const f = fixture();
  try {
    assert.deepEqual(f.videos.map(v => v.plays), [0, 0]);
    f.elements['[data-sync-play]'].emit('click');
    await flush();
    assert.deepEqual(f.videos.map(v => v.paused), [false, false]);
    f.videos[0].currentTime = 1.75;
    f.videos[1].currentTime = 1.77;
    f.videos[1].emit('click');
    assert.deepEqual(f.videos.map(v => v.paused), [true, true]);
    assert.deepEqual(f.videos.map(v => v.currentTime), [1.75, 1.75]);
  } finally { f.cleanup(); }
});

test('automatic selection waits for BOTH media streams and aligns after buffering', async () => {
  const f = fixture({ autoStart: true }, true);
  try {
    assert.deepEqual(f.videos.map(v => v.plays), [0, 0]);
    f.videos[1].readyState = 4;
    f.videos[1].emit('canplay');
    await flush();
    assert.deepEqual(f.videos.map(v => v.paused), [false, false]);
    f.videos[0].currentTime = 2.25;
    f.videos[1].currentTime = 2.0;
    f.videos[1].readyState = 2;
    f.videos[1].emit('waiting');
    assert.deepEqual(f.videos.map(v => v.paused), [true, true]);
    assert.deepEqual(f.videos.map(v => v.currentTime), [2.25, 2.25]);
    f.videos[1].readyState = 4;
    f.videos[1].emit('canplay');
    await flush();
    assert.deepEqual(f.videos.map(v => v.paused), [false, false]);
  } finally { f.cleanup(); }
});

test('shared scrubbing preserves playing/paused intent and absolute timestamps', async () => {
  const f = fixture({ autoStart: true });
  try {
    await flush();
    const slider = f.elements['[data-sync-seek]'];
    slider.value = '3.12';
    slider.emit('input');
    assert.deepEqual(f.videos.map(v => v.paused), [true, true]);
    assert.deepEqual(f.videos.map(v => v.currentTime), [3.12, 3.12]);
    slider.emit('change');
    await flush();
    assert.deepEqual(f.videos.map(v => v.paused), [false, false]);
    f.transport.pause();
    slider.value = '4.25';
    slider.emit('input');
    slider.emit('change');
    await flush();
    assert.deepEqual(f.videos.map(v => v.currentTime), [4.25, 4.25]);
    assert.deepEqual(f.videos.map(v => v.paused), [true, true]);
  } finally { f.cleanup(); }
});

test('drift correction, coordinated loop and restart use the same timeline', async () => {
  const f = fixture({ autoStart: true });
  try {
    await flush();
    f.videos[0].currentTime = 2;
    f.videos[1].currentTime = 1.8;
    f.tick();
    await flush();
    assert.deepEqual(f.videos.map(v => v.currentTime), [2, 2]);
    f.videos[1].emit('ended');
    await flush();
    assert.deepEqual(f.videos.map(v => v.currentTime), [0, 0]);
    assert.deepEqual(f.videos.map(v => v.paused), [false, false]);
    f.transport.pause();
    f.transport.seek(4);
    f.elements['[data-sync-restart]'].emit('click');
    await flush();
    assert.deepEqual(f.videos.map(v => v.currentTime), [0, 0]);
  } finally { f.cleanup(); }
});

test('blocked playback stops both and offers a retry; media errors stop the pair', async () => {
  const f = fixture();
  try {
    f.videos[1].rejectPlayback = true;
    f.transport.play();
    await flush();
    assert.deepEqual(f.videos.map(v => v.paused), [true, true]);
    assert.match(f.elements['[data-sync-status]'].textContent, /Click Play both/);
    f.videos[1].rejectPlayback = false;
    f.transport.play();
    await flush();
    f.videos[1].error = new Error('decode');
    f.videos[1].emit('error');
    assert.deepEqual(f.videos.map(v => v.paused), [true, true]);
    assert.match(f.elements['[data-sync-status]'].textContent, /could not load/);
  } finally { f.cleanup(); }
});

test('disposed pairs cannot resume after async playback or later media events', async () => {
  const f = fixture({ autoStart: true });
  f.cleanup();
  await flush();
  const plays = f.videos.map(v => v.plays);
  f.videos[1].emit('canplay');
  f.videos[0].emit('click');
  assert.deepEqual(f.videos.map(v => v.plays), plays);
  assert.deepEqual(f.videos.map(v => v.paused), [true, true]);
});
