import { addSample, createSession, getVerticalDirection, resultState } from './wheelAnalyzer';
import { drawSignal } from './wheelCanvas';
import { track } from '../../utils/analytics';
import type { WheelTestSession } from './types';

const root = document.querySelector<HTMLElement>('[data-scroll-tester]');
if (root) {
  const area = root.querySelector<HTMLElement>('[data-wheel-area]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const finishButton = root.querySelector<HTMLButtonElement>('[data-finish]')!;
  const resetButton = root.querySelector<HTMLButtonElement>('[data-reset]')!;
  const report = root.querySelector<HTMLElement>('[data-report]')!;
  const result = root.querySelector<HTMLElement>('[data-result]')!;
  const durationButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-duration]')];
  let session: WheelTestSession | null = null;
  let durationSeconds = 15;
  let state: 'idle' | 'running' | 'finished' = 'idle';
  let timer: number | undefined;
  let frame = 0;

  const setText = (key: string, value: string) => {
    const element = root.querySelector<HTMLElement>(`[data-${key}]`);
    if (element) element.textContent = value;
  };
  const formatDelta = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
  const modeName = (mode: number) => ['Pixels', 'Lines', 'Pages'][mode] ?? `Mode ${mode}`;
  const setStatus = (kind: string, heading: string, detail: string) => {
    result.className = `result-note ${kind}`;
    result.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = heading;
    const message = document.createElement('span');
    message.textContent = detail;
    result.append(title, message);
  };
  const queueGraph = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      drawSignal(canvas, session?.samples || []);
    });
  };
  const updateMetrics = () => {
    if (!session) return;
    const now = performance.now();
    const recentEvents = session.samples.filter((sample) => sample.timestamp > now - 1000).length;
    setText('total', String(session.totalEvents));
    setText('expected', String(session.expectedEvents));
    setText('reverse', String(session.reverseEvents));
    setText('rate', `${session.reverseRate.toFixed(2)}%`);
    setText('event-rate', String(state === 'running' ? recentEvents : 0));
    setText('gap', `${Math.round(session.longestGap)} ms`);
    setText('last-y', formatDelta(session.lastDeltaY));
    setText('last-x', formatDelta(session.lastDeltaX));
    setText('mode', modeName(session.lastDeltaMode));
    setText('horizontal', String(session.horizontalEvents));
    const remaining = state === 'running' ? Math.max(0, Math.ceil(durationSeconds - (now - session.startedAt) / 1000)) : 0;
    setText('time-left', state === 'running' ? `${remaining} seconds remaining` : 'Test complete');
  };
  const renderReport = (current: WheelTestSession) => {
    report.hidden = false;
    const quality = current.totalEvents < 20
      ? `Only ${current.totalEvents} vertical events were recorded, including ${current.reverseEvents} opposite-direction events. Repeat the test with steady scrolling for a more useful sample.`
      : current.reverseEvents
        ? `${current.reverseEvents} of ${current.totalEvents} vertical events opposed the first direction. Repeat the run and compare another browser or computer before judging the mouse.`
        : `All ${current.totalEvents} vertical events matched the first direction in this run. This does not rule out an intermittent problem.`;
    setText('report-summary', quality);
    setText('report-direction', current.expectedDirection === 'down' ? 'Down' : 'Up');
    setText('report-events', String(current.totalEvents));
    setText('report-horizontal', String(current.horizontalEvents));
    setText('report-peak', formatDelta(current.peakDeltaY));
    const rows = root.querySelector<HTMLTableSectionElement>('[data-report-rows]')!;
    rows.replaceChildren();
    for (const sample of current.samples.slice(-10).reverse()) {
      const row = document.createElement('tr');
      const values = [
        `${((sample.timestamp - current.startedAt) / 1000).toFixed(1)} s`,
        formatDelta(sample.deltaY),
        sample.direction === 'down' ? 'Down' : 'Up',
        sample.expected ? 'Matches' : 'Opposite',
      ];
      for (const value of values) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      rows.append(row);
    }
  };
  const finish = () => {
    if (state !== 'running' || !session) return;
    state = 'finished';
    window.clearInterval(timer);
    finishButton.disabled = true;
    durationButtons.forEach((button) => { button.disabled = false; });
    setText('chosen-direction', 'Test complete');
    area.querySelector('strong')!.textContent = 'Test complete — review your report below';
    updateMetrics();
    const outcome = resultState(session);
    if (outcome === 'collecting') setStatus('collecting', 'Limited sample', 'Fewer than 20 vertical events were recorded. Try another run for a clearer pattern.');
    else if (outcome === 'reverse') setStatus('warning', 'Opposite-direction input detected', 'Some events opposed your first scroll direction. Repeat the test to see whether the pattern persists.');
    else setStatus('success', 'Direction stayed consistent', 'No opposite-direction vertical events were recorded in this run.');
    renderReport(session);
    track('scroll_test_completed', { direction: session.expectedDirection, sample_bucket: session.totalEvents < 20 ? '0-19' : session.totalEvents < 100 ? '20-99' : '100+', reverse_detected: session.reverseEvents > 0 });
  };
  const start = (direction: 'up' | 'down') => {
    session = createSession(direction);
    state = 'running';
    root.dataset.active = 'true';
    report.hidden = true;
    finishButton.disabled = false;
    durationButtons.forEach((button) => { button.disabled = true; });
    setText('chosen-direction', direction === 'down' ? 'Testing downward scroll' : 'Testing upward scroll');
    setStatus('collecting', 'Test running', 'Keep scrolling steadily in the same direction until the timer ends.');
    timer = window.setInterval(() => {
      if (!session) return;
      if (performance.now() - session.startedAt >= durationSeconds * 1000) finish();
      else updateMetrics();
    }, 100);
    track('scroll_test_started', { direction, duration_seconds: durationSeconds });
  };
  const reset = () => {
    window.clearInterval(timer);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    session = null;
    state = 'idle';
    root.dataset.active = 'false';
    report.hidden = true;
    finishButton.disabled = true;
    durationButtons.forEach((button) => { button.disabled = false; });
    setText('chosen-direction', `Ready for a ${durationSeconds}-second test`);
    area.querySelector('strong')!.textContent = 'Scroll inside this area to begin';
    for (const key of ['total', 'expected', 'reverse', 'event-rate', 'last-y', 'last-x', 'horizontal']) setText(key, '0');
    setText('rate', '0.00%');
    setText('gap', '0 ms');
    setText('mode', '—');
    setText('time-left', `${durationSeconds} seconds remaining`);
    setStatus('collecting', 'Ready when you are', 'Choose a duration, then scroll inside the test area.');
    drawSignal(canvas, []);
  };

  area.addEventListener('wheel', (event) => {
    if (state === 'finished') return;
    event.preventDefault();
    if (!session) {
      const direction = getVerticalDirection(event.deltaY);
      if (direction !== 'up' && direction !== 'down') return;
      start(direction);
    }
    if (!session) return;
    session = addSample(session, { timestamp: performance.now(), deltaX: event.deltaX, deltaY: event.deltaY, deltaMode: event.deltaMode, inputType: 'unknown' });
    updateMetrics();
    queueGraph();
  }, { passive: false });
  finishButton.addEventListener('click', finish);
  resetButton.addEventListener('click', () => { reset(); track('scroll_test_reset'); });
  durationButtons.forEach((button) => button.addEventListener('click', () => {
    if (state === 'running') return;
    durationSeconds = Number(button.dataset.duration);
    durationButtons.forEach((choice) => choice.setAttribute('aria-pressed', String(choice === button)));
    reset();
  }));
  new ResizeObserver(queueGraph).observe(canvas);
  drawSignal(canvas, []);
}
