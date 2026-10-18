/** Shared gallery for the React preview and the static GitHub Pages website. */
import { synchronizeVideos } from './synchronized-videos.js';
const modes = {
  temporal: 'Temporal Modeling',
  generation: 'Data Generation',
  appearance: 'Data Augmentation',
  policy: 'Policy Inference',
};
const labels = { block: 'Block', bread: 'Bread', fruit: 'Fruit', hanoi: 'Hanoi', pour: 'Pour', scan: 'Scan', serve: 'Serve', sweep: 'Sweep' };
const descriptions = {
  temporal: 'Human demonstrations and their topology-based temporal structure.',
  generation: 'Generated demonstrations under low, high, and fully randomized layouts, with the accompanying avoidance diagrams.',
  appearance: 'Background, viewpoint, lighting, and texture variations, alongside the combined augmentation.',
  policy: 'Policy rollouts in simulation and on the physical robot. Select examples independently; sample IDs are not paired.',
};
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sampleId = (asset) => asset.path.split('/').pop().replace('.mp4', '');

/** Mount an isolated gallery; return a cleanup function for React and route changes. */
export function mountResults(root, base = 'public/media/') {
  const controller = new AbortController();
  let disposed = false;
  let state = { task: 'block', mode: 'temporal', choices: {} };
  let manifest;
  let synchronized;
  const url = (path) => base + path.split('/').map(encodeURIComponent).join('/');
  const stopVideos = () => root.querySelectorAll('video').forEach(video => {
    video.pause();
    video.removeAttribute('src');
    video.load();
  });
  const find = (path) => manifest.assets.find(asset => asset.path === path);
  const clips = (prefix) => manifest.assets.filter(asset => asset.path.startsWith(prefix + '/') && asset.path.endsWith('.mp4'))
    .sort((a, b) => sampleId(a).localeCompare(sampleId(b), 'en', { numeric: true }));
  const video = (asset, title) => {
    if (!asset) return '<p class="media-error">This clip is not available.</p>';
    return `<div class="video-frame"><video ${state.mode === 'temporal' ? '' : 'controls loop'} muted playsinline preload="none" poster="${escape(url(asset.poster))}" src="${escape(url(asset.path))}" aria-label="${escape(labels[state.task] + ' — ' + title)}"></video></div>
      <p class="media-meta">${asset.width} × ${asset.height} · ${asset.duration.toFixed(1)} s <a href="${escape(url(asset.path))}" target="_blank" rel="noopener">Open video</a></p>
      <p class="media-error" hidden>Unable to play this clip here. Use “Open video” to view or download it.</p>`;
  };
  const card = (asset, title, extras = '', className = '') => `<article class="media-card ${className}"><h4>${escape(title)}</h4>${extras}${video(asset, title)}</article>`;
  const sample = (prefix, key) => {
    const entries = clips(prefix);
    const chosen = entries.find(entry => sampleId(entry) === state.choices[key]) || entries[0];
    if (!chosen) return { chosen: null, selector: '' };
    return { chosen, number: entries.indexOf(chosen) + 1, selector: `<label class="sample-choice">Example <select data-choice="${key}" aria-label="${escape(key + ' example')}">${entries.map((entry, index) => `<option value="${escape(sampleId(entry))}"${entry === chosen ? ' selected' : ''}>${index + 1}</option>`).join('')}</select></label>` };
  };
  const content = () => {
    const task = state.task;
    if (state.mode === 'temporal') {
      const scene = find(`temporal/3dgs/${task}.viser`);
      const viewerParams = new URLSearchParams({
        playbackPath: `../media/${scene.path}`,
        initialCameraPosition: scene.scene.cameraPosition.join(','),
        initialCameraLookAt: scene.scene.cameraLookAt.join(','),
        initialCameraUp: scene.scene.cameraUp.join(','),
      });
      const viewerUrl = `${base.replace(/media\/$/, 'viser/')}index.html?${viewerParams}`;
      return `<div class="sync-controls" aria-label="Synchronized video controls">
        <div class="sync-actions"><button type="button" data-sync-play>Play both</button><button type="button" data-sync-restart>Restart both</button><output data-sync-clock>0:00.00 / 0:00.00</output></div>
        <label class="sync-timeline">Shared timeline<input type="range" min="0" max="${find(`temporal/human/${task}.mp4`).duration}" step="0.01" value="0" data-sync-seek aria-label="Seek both videos"></label>
        <p data-sync-status role="status">Shared timeline · click either video to play both</p>
        </div><div class="temporal-layout"><div class="temporal-videos">${card(find(`temporal/human/${task}.mp4`), 'Human Demonstration')}${card(find(`temporal/graph/${task}.mp4`), 'Topology Graph')}</div>
        <article class="media-card scene-viewer"><h4>Interactive 3D Scene</h4>
          <iframe src="${escape(viewerUrl)}" title="${labels[task]} interactive 3D point-cloud recording" loading="lazy" allow="autoplay; fullscreen" allowfullscreen></iframe>
          <div class="scene-caption"><p>Drag to orbit · scroll to zoom. Point-cloud recording exported from the reconstructed scene; its playback timeline is independent of the videos.</p><div><a href="${escape(viewerUrl)}" target="_blank" rel="noopener">Open 3D viewer</a><a href="${escape(url(scene.path))}" download>Download .viser · ${(scene.bytes / 1048576).toFixed(1)} MB</a></div></div>
        </article></div>`;
    }
    if (state.mode === 'generation') {
      return `<div class="media-grid">${[['low', 'Low Randomization'], ['high', 'High Randomization'], ['total', 'Totally Randomization']].map(([level, title]) => {
        const { chosen, selector, number } = sample(`generation/${task}/${level}`, level);
        const diagram = chosen && find(chosen.path.replace('.mp4', '_avoid.png'));
        return `<article class="media-card"><h4>${title}</h4>${selector}${video(chosen, title)}${diagram ? `<div class="avoidance"><h5>Avoidance diagram</h5><a href="${escape(url(diagram.path))}" target="_blank" rel="noopener"><img src="${escape(url(diagram.path))}" loading="lazy" alt="${escape(labels[task] + ' — ' + title + ' — example ' + number + ' avoidance diagram')}"></a></div>` : ''}</article>`;
      }).join('')}</div>`;
    }
    if (state.mode === 'appearance') {
      return `<div class="media-grid appearance-grid">${[['back', 'Background'], ['cam', 'Viewpoint'], ['texture', 'Texture'], ['light', 'Lighting'], ['final', 'Combined Augmentation']].map(([id, title]) => card(find(`appearance/${task}/${id}.mp4`), title, '', `appearance-${id}`)).join('')}</div>`;
    }
    return `<div class="media-grid two-columns">${[['simulation', 'Simulation'], ['real', 'Real Robot']].map(([kind, title]) => {
      const { chosen, selector } = sample(`policy/${task}/${kind}`, kind);
      return card(chosen, title, selector);
    }).join('')}</div>`;
  };
  const render = (autoStart = false) => {
    const focusKey = root.contains(document.activeElement) && document.activeElement?.getAttribute('data-choice');
    synchronized?.dispose();
    synchronized = undefined;
    stopVideos();
    root.innerHTML = `<div class="gallery-controls">
      <div class="gallery-label" id="gallery-task-label">Task</div>
      <div class="result-tabs task-switcher" role="group" aria-labelledby="gallery-task-label">${manifest.tasks.map(task => `<button type="button" data-task="${task}" aria-pressed="${state.task === task}" class="${state.task === task ? 'is-active' : ''}">${labels[task]}</button>`).join('')}</div>
      <div class="mode-switcher" role="group" aria-label="Result category">${Object.entries(modes).map(([mode, label]) => `<button type="button" data-mode="${mode}" aria-pressed="${state.mode === mode}">${label}</button>`).join('')}</div>
      </div><div class="gallery-heading"><div><h3>${labels[state.task]} <span>/ ${modes[state.mode]}</span></h3><p>${descriptions[state.mode]}</p></div><button type="button" class="pause-videos">Pause videos</button></div>
      <p class="sr-only" role="status">Showing ${labels[state.task]}: ${modes[state.mode]}</p>${content()}`;
    const pair = Array.from(root.querySelectorAll('video'));
    const sharedControls = root.querySelector('.sync-controls');
    if (state.mode === 'temporal' && pair.length === 2 && sharedControls) {
      synchronized = synchronizeVideos(pair, sharedControls, { duration: find(`temporal/human/${state.task}.mp4`).duration, autoStart });
    } else if (autoStart) {
      pair.forEach(clip => {
        clip.muted = true;
        clip.play().catch(() => {
          // Native controls remain available if the browser blocks playback.
        });
      });
    }
    if (focusKey) root.querySelector(`[data-choice="${focusKey}"]`)?.focus();
  };
  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !manifest) return;
    if (button.dataset.task) {
      state.task = button.dataset.task;
      state.choices = {};
      render(true);
      root.querySelector(`[data-task="${state.task}"]`)?.focus();
    } else if (button.dataset.mode) {
      state.mode = button.dataset.mode;
      render(true);
      root.querySelector(`[data-mode="${state.mode}"]`)?.focus();
    } else if (button.classList.contains('pause-videos')) {
      synchronized?.pause();
      root.querySelectorAll('video').forEach(video => video.pause());
    }
  }, { signal: controller.signal });
  root.addEventListener('change', event => {
    const select = event.target;
    if (select.dataset.choice) {
      state.choices[select.dataset.choice] = select.value;
      render(true);
    }
  }, { signal: controller.signal });
  root.addEventListener('error', event => {
    if (event.target.tagName === 'VIDEO') {
      const message = event.target.closest('.media-card')?.querySelector('.media-error');
      if (message) message.hidden = false;
    }
  }, { capture: true, signal: controller.signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      synchronized?.pause();
      root.querySelectorAll('video').forEach(video => video.pause());
    }
  }, { signal: controller.signal });
  fetch(url('manifest.json'), { signal: controller.signal, cache: 'no-cache' }).then(response => {
    if (!response.ok) throw new Error('Cannot load results');
    return response.json();
  }).then(data => {
    if (disposed) return;
    manifest = data;
    render();
  }).catch(error => {
    if (error.name !== 'AbortError' && !disposed) root.innerHTML = '<p class="media-error">Results could not be loaded. Please refresh the page to retry.</p>';
  });
  return () => { disposed = true; controller.abort(); synchronized?.dispose(); stopVideos(); root.replaceChildren(); };
}
