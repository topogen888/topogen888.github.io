/** A shared transport for timestamp-aligned temporal demonstration pairs. */
export function synchronizeVideos(videos, controls, { duration: initialDuration = 0, autoStart = false } = {}) {
  const events = new AbortController();
  const playButton = controls.querySelector('[data-sync-play]');
  const restartButton = controls.querySelector('[data-sync-restart]');
  const seekBar = controls.querySelector('[data-sync-seek]');
  const clock = controls.querySelector('[data-sync-clock]');
  const status = controls.querySelector('[data-sync-status]');
  let wanted = false;
  let phase = 'paused';
  let target = 0;
  let duration = initialDuration;
  let loaded = false;
  let disposed = false;
  let attempt = 0;
  let scrubbing = false;
  let resumeAfterScrub = false;
  let timer;
  const stamp = (seconds) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
  const position = () => phase === 'playing' ? videos[0].currentTime : target;
  const draw = () => {
    if (disposed) return;
    playButton.textContent = wanted ? 'Pause both' : 'Play both';
    playButton.setAttribute('aria-label', wanted ? 'Pause both videos' : 'Play both videos');
    seekBar.max = String(duration);
    if (!scrubbing) seekBar.value = String(Math.min(position(), duration));
    seekBar.setAttribute('aria-valuetext', `${stamp(position())} of ${stamp(duration)}`);
    clock.textContent = `${stamp(position())} / ${stamp(duration)}`;
    const messages = { paused: 'Shared timeline · click either video to play both', waiting: 'Waiting for both videos…', starting: 'Starting both videos…', playing: 'Synchronized playback', blocked: 'Click Play both to start playback.', error: 'A video could not load. Use Open video below, or switch tasks to retry.' };
    if (status.textContent !== messages[phase]) status.textContent = messages[phase];
  };
  const stop = () => {
    attempt++;
    videos.forEach(video => video.pause());
  };
  const align = () => {
    const durations = videos.map(video => video.duration);
    if (durations.every(value => Number.isFinite(value) && value > 0)) duration = Math.min(...durations);
    target = Math.max(0, Math.min(target, duration));
    for (const video of videos) {
      if (video.readyState >= 1 && Math.abs(video.currentTime - target) > .015) video.currentTime = target;
    }
  };
  const ready = () => videos.every(video => video.readyState >= 3 && !video.seeking && !video.error);
  const resume = () => {
    if (disposed || !wanted || scrubbing || phase === 'starting' || phase === 'playing' || phase === 'error') return;
    align();
    if (!ready()) { draw(); return; }
    phase = 'starting';
    const id = ++attempt;
    draw();
    Promise.all(videos.map(video => video.play())).then(() => {
      if (disposed || id !== attempt || !wanted) return;
      phase = 'playing';
      draw();
    }).catch(() => {
      if (disposed || id !== attempt) return;
      wanted = false;
      stop();
      phase = 'blocked';
      draw();
    });
  };
  const load = () => {
    if (loaded) return;
    loaded = true;
    videos.forEach(video => { video.preload = 'auto'; video.load(); });
  };
  const play = () => {
    if (disposed || phase === 'error') return;
    if (target >= duration - .025) target = 0;
    wanted = true;
    phase = 'waiting';
    load();
    resume();
    draw();
  };
  const pause = () => {
    if (disposed) return;
    target = position();
    wanted = false;
    scrubbing = false;
    stop();
    if (phase !== 'error') phase = 'paused';
    align();
    draw();
  };
  const toggle = () => wanted ? pause() : play();
  const seek = (seconds) => {
    if (disposed) return;
    stop();
    target = Math.max(0, Math.min(Number(seconds) || 0, duration));
    phase = wanted ? 'waiting' : 'paused';
    load();
    align();
    resume();
    draw();
  };
  const waitTogether = () => {
    if (disposed || !wanted || (phase !== 'playing' && phase !== 'starting')) return;
    target = videos[0].currentTime;
    stop();
    phase = 'waiting';
    align();
    draw();
  };
  const loop = () => {
    if (wanted && phase === 'playing') seek(0);
  };
  const on = (element, name, callback) => element.addEventListener(name, callback, { signal: events.signal });
  videos.forEach(video => {
    // No independent native controls or native loops: this pair has one transport.
    video.controls = false;
    video.loop = false;
    video.muted = true;
    video.playbackRate = 1;
    video.tabIndex = 0;
    on(video, 'click', toggle);
    on(video, 'keydown', event => {
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); toggle(); }
    });
    on(video, 'waiting', waitTogether);
    on(video, 'canplay', resume);
    on(video, 'seeked', resume);
    on(video, 'loadedmetadata', () => { align(); resume(); draw(); });
    on(video, 'ended', loop);
    on(video, 'error', () => { wanted = false; stop(); phase = 'error'; draw(); });
  });
  on(playButton, 'click', toggle);
  on(restartButton, 'click', () => { wanted = true; seek(0); });
  on(seekBar, 'input', () => {
    if (!scrubbing) { resumeAfterScrub = wanted; scrubbing = true; }
    wanted = false;
    seek(seekBar.value);
  });
  on(seekBar, 'change', () => {
    scrubbing = false;
    wanted = resumeAfterScrub;
    seek(seekBar.value);
  });
  on(seekBar, 'blur', () => {
    if (scrubbing) { scrubbing = false; wanted = resumeAfterScrub; seek(seekBar.value); }
  });
  timer = setInterval(() => {
    if (phase === 'playing') {
      if (!ready()) { waitTogether(); return; }
      if (videos[0].currentTime >= duration - .025) { loop(); return; }
      // Use media timestamps, not elapsed wall time. Correct drift > 80 ms.
      if (Math.abs(videos[1].currentTime - videos[0].currentTime) > .08) {
        waitTogether();
        resume();
      }
    } else if (phase === 'waiting') resume();
    draw();
  }, 50);
  draw();
  if (autoStart) play();
  return { play, pause, seek, dispose: () => {
    disposed = true;
    wanted = false;
    clearInterval(timer);
    events.abort();
    stop();
  } };
}
