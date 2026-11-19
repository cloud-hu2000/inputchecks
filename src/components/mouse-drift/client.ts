import {
  DEFAULT_RECORDING_MS,
  PLOT_SCALE,
  addSample,
  isRecordingOption,
  layoutTrail,
  phaseAt,
  rawFieldsFromEvent,
  readout,
  samplesFromMove,
  startSession,
  type RawPointerFields,
  type Session,
} from './session';

const root = document.querySelector<HTMLElement>('[data-drift-tester]');

if (root) {
  const startButton = root.querySelector<HTMLButtonElement>('[data-drift-start]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-drift-reset]');
  const canvas = root.querySelector<HTMLCanvasElement>('[data-drift-surface]');
  const durationButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-drift-duration]')];
  const statusEl = root.querySelector<HTMLElement>('[data-drift-status]');

  if (startButton && resetButton && canvas && statusEl && durationButtons.length > 0) {
    const context = canvas.getContext('2d');
    let selectedMs = DEFAULT_RECORDING_MS;
    let session: Session | null = null;
    let tickTimer = 0;

    const setText = (name: string, value: string) => {
      const el = root.querySelector<HTMLElement>(`[data-drift-${name}]`);
      if (el) el.textContent = value;
    };

    const clearTick = () => {
      if (tickTimer) window.clearTimeout(tickTimer);
      tickTimer = 0;
    };

    const draw = (trail: Array<{ dx: number; dy: number }>) => {
      if (!context) return { clamped: false };
      const rect = canvas.getBoundingClientRect();
      const cssWidth = Math.max(1, rect.width);
      const cssHeight = Math.max(1, rect.height);
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(cssWidth * dpr));
      const height = Math.max(1, Math.round(cssHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, cssWidth, cssHeight);
      context.strokeStyle = '#dce4ea';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(cssWidth / 2, 8);
      context.lineTo(cssWidth / 2, cssHeight - 8);
      context.moveTo(8, cssHeight / 2);
      context.lineTo(cssWidth - 8, cssHeight / 2);
      context.stroke();

      const layout = layoutTrail(trail, cssWidth, cssHeight, PLOT_SCALE);
      const first = layout.points[0];
      if (!first) return layout;
      context.strokeStyle = '#176b67';
      context.fillStyle = '#176b67';
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(first.x, first.y);
      for (const point of layout.points.slice(1)) context.lineTo(point.x, point.y);
      context.stroke();
      for (const point of layout.points) {
        context.beginPath();
        context.arc(point.x, point.y, 3, 0, Math.PI * 2);
        context.fill();
      }
      return layout;
    };

    const render = () => {
      const now = performance.now();
      const preview = readout(session, now, selectedMs, false);
      const layout = draw(preview.trail);
      const view = readout(session, now, selectedMs, layout.clamped);
      setText('period', view.period);
      setText('events', view.events);
      setText('movex', view.movementX);
      setText('movey', view.movementY);
      setText('steps', view.steps);
      setText('largest', view.largest);
      setText('net', view.net);
      setText('type', view.pointerType);
      setText('plot-note', view.plotNote);
      statusEl.textContent = view.status;
      const running = view.phase === 'countdown' || view.phase === 'recording';
      startButton.disabled = running;
      for (const button of durationButtons) button.disabled = running;
    };

    const schedule = () => {
      clearTick();
      tickTimer = window.setTimeout(() => {
        render();
        if (!session || phaseAt(session, performance.now()) === 'complete') return;
        schedule();
      }, 200);
    };

    const selectDuration = (ms: number) => {
      if (!isRecordingOption(ms)) return;
      selectedMs = ms;
      for (const button of durationButtons) {
        const on = Number(button.dataset.driftDuration) === ms;
        button.setAttribute('aria-pressed', on ? 'true' : 'false');
        button.classList.toggle('primary', on);
        button.classList.toggle('secondary', !on);
      }
      if (!session) render();
    };

    const expand = (event: PointerEvent): RawPointerFields[] => {
      let coalesced: RawPointerFields[] | null = null;
      if (typeof event.getCoalescedEvents === 'function') {
        try {
          const list = event.getCoalescedEvents();
          if (list.length > 0) coalesced = list.map((item) => rawFieldsFromEvent(item));
        } catch {
          coalesced = null;
        }
      }
      return samplesFromMove(rawFieldsFromEvent(event), coalesced);
    };

    window.addEventListener('pointermove', (event) => {
      if (!session || phaseAt(session, performance.now()) !== 'recording') return;
      let next = session;
      let accepted = false;
      const now = performance.now();
      for (const sample of expand(event)) {
        const result = addSample(next, sample, now);
        next = result.session;
        accepted = accepted || result.accepted;
      }
      session = next;
      if (accepted) render();
    });

    for (const button of durationButtons) {
      button.addEventListener('click', () => {
        if (session && phaseAt(session, performance.now()) !== 'complete') return;
        selectDuration(Number(button.dataset.driftDuration));
      });
    }

    startButton.addEventListener('click', () => {
      if (session && phaseAt(session, performance.now()) !== 'complete') return;
      const next = startSession(selectedMs, performance.now());
      if (!next) return;
      session = next;
      render();
      schedule();
    });

    resetButton.addEventListener('click', () => {
      clearTick();
      session = null;
      render();
    });

    window.addEventListener('resize', () => {
      render();
    });
    render();
  }
}
