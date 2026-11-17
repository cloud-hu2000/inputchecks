import { estimateRefreshRate, InvalidFrameTimestampsError } from './estimate';

const SAMPLE_MS = 1200;
const STALL_MS = 250;
const root = document.querySelector<HTMLElement>('[data-refresh-tester]');

if (root) {
  const toggle = root.querySelector<HTMLButtonElement>('[data-refresh-toggle]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-refresh-reset]');
  const statusEl = root.querySelector<HTMLElement>('[data-refresh-status]');

  if (toggle && resetButton && statusEl) {
    let frames: number[] = [];
    let rafId = 0;
    let running = false;
    let stopReason: 'complete' | 'manual' | 'background' | 'stalled' | null = null;

    const setText = (name: string, value: string) => {
      const el = root.querySelector<HTMLElement>(`[data-refresh-${name}]`);
      if (el) el.textContent = value;
    };

    const paintCleared = () => {
      setText('hz', '—');
      setText('frames', '0');
      setText('duration', '—');
      setText('min', '—');
      setText('median', '—');
      setText('max', '—');
    };

    const paintProgress = () => {
      setText('hz', '—');
      setText('frames', String(frames.length));
      if (frames.length >= 2) {
        const duration = frames[frames.length - 1] - frames[0];
        setText('duration', `${(duration / 1000).toFixed(2)} s`);
      } else {
        setText('duration', '—');
      }
      setText('min', '—');
      setText('median', '—');
      setText('max', '—');
    };

    const insufficientMessage = (reason: string) => {
      if (stopReason === 'background') {
        return 'The tab was hidden before enough animation frames arrived. No hertz estimate is shown.';
      }
      if (stopReason === 'stalled') {
        return 'Animation frames stalled before enough intervals were collected. No hertz estimate is shown.';
      }
      if (reason === 'no_valid_intervals') {
        return 'The collected intervals were too sparse or too irregular to support a rate. No hertz estimate is shown.';
      }
      return 'Not enough animation frames were collected to estimate a rate. No hertz estimate is shown.';
    };

    const finish = () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      toggle.textContent = 'Start test';
      toggle.setAttribute('aria-pressed', 'false');
      try {
        const result = estimateRefreshRate(frames);
        setText('frames', String(result.frameCount));
        setText('duration', result.durationMs > 0 ? `${(result.durationMs / 1000).toFixed(2)} s` : '—');
        if (result.status === 'ok') {
          setText('hz', `${result.hz.toFixed(1)} Hz`);
          setText('min', `${result.minIntervalMs.toFixed(2)} ms`);
          setText('median', `${result.medianIntervalMs.toFixed(2)} ms`);
          setText('max', `${result.maxIntervalMs.toFixed(2)} ms`);
          const outlierNote = result.outlierCount === 0
            ? ''
            : ` ${result.outlierCount} outlier interval${result.outlierCount === 1 ? '' : 's'} excluded.`;
          const lead = stopReason === 'background'
            ? 'Sampling stopped because the tab was hidden. The figure uses only frames from before that, and it is still a frame-interval estimate.'
            : stopReason === 'stalled'
              ? 'Sampling stopped after a long gap between animation frames. The figure uses only the frames collected before that gap.'
              : `Median inlier interval ${result.medianIntervalMs.toFixed(2)} ms.`;
          statusEl.textContent = `${lead}${outlierNote}`;
          return;
        }
        setText('hz', '—');
        setText('min', '—');
        setText('median', '—');
        setText('max', '—');
        statusEl.textContent = insufficientMessage(result.reason);
      } catch (error) {
        setText('hz', '—');
        setText('min', '—');
        setText('median', '—');
        setText('max', '—');
        statusEl.textContent = error instanceof InvalidFrameTimestampsError
          ? 'The frame timestamps were not usable, so no hertz estimate is shown.'
          : 'The sample could not be read, so no hertz estimate is shown.';
      }
    };

    const step = (timestamp: number) => {
      if (!running) return;
      if (document.hidden) {
        stopReason = 'background';
        finish();
        return;
      }
      if (!Number.isFinite(timestamp)) {
        stopReason = 'stalled';
        finish();
        return;
      }
      if (frames.length > 0) {
        const gap = timestamp - frames[frames.length - 1];
        if (!(gap > 0) || gap > STALL_MS) {
          stopReason = 'stalled';
          finish();
          return;
        }
      }
      frames.push(timestamp);
      paintProgress();
      const elapsed = frames[frames.length - 1] - frames[0];
      if (frames.length >= 2 && elapsed >= SAMPLE_MS) {
        stopReason = 'complete';
        finish();
        return;
      }
      rafId = requestAnimationFrame(step);
    };

    toggle.addEventListener('click', () => {
      if (running) {
        stopReason = 'manual';
        finish();
        return;
      }
      if (document.hidden) {
        frames = [];
        stopReason = 'background';
        paintCleared();
        statusEl.textContent = 'This tab is in the background. Animation frames are throttled there, so no hertz estimate is shown until the tab is visible.';
        return;
      }
      frames = [];
      stopReason = null;
      running = true;
      toggle.textContent = 'Stop test';
      toggle.setAttribute('aria-pressed', 'true');
      statusEl.textContent = 'Sampling animation frames. Keep this tab visible.';
      paintProgress();
      rafId = requestAnimationFrame(step);
    });

    resetButton.addEventListener('click', () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      frames = [];
      stopReason = null;
      toggle.textContent = 'Start test';
      toggle.setAttribute('aria-pressed', 'false');
      paintCleared();
      statusEl.textContent = 'Press Start test. Keep this tab visible while frames are sampled.';
    });
  }
}
