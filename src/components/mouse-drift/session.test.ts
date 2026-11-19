import { describe, expect, it } from 'vitest';
import {
  COUNTDOWN_MS,
  DEFAULT_RECORDING_MS,
  IDLE_STATUS,
  NOT_PROVIDED,
  NOT_RECORDING,
  NOT_STARTED,
  addSample,
  formatCssPx,
  formatQuantity,
  layoutTrail,
  phaseAt,
  readout,
  samplesFromMove,
  startSession,
  summarize,
} from './session';

const verdict = /sensor is damaged|sensor is broken|severe drift|no drift detected|replace your mouse|dirty sensor|hardware defect/i;

function record(recordingMs: number, samples: Array<Record<string, unknown>>, at = COUNTDOWN_MS) {
  let session = startSession(recordingMs, 0);
  if (!session) throw new Error('session did not start');
  for (const sample of samples) {
    const result = addSample(session, sample, at);
    session = result.session;
    expect(result.accepted).toBe(true);
  }
  return session;
}

describe('stationary pointer session', () => {
  it('totals the article example without equating movement and position', () => {
    const session = record(10000, [
      { pointerId: 1, pointerType: 'mouse', movementX: 3, movementY: 4, clientX: 10, clientY: 20 },
      { pointerId: 1, pointerType: 'mouse', movementX: 0, movementY: -2, clientX: 10, clientY: 18 },
    ]);
    const view = readout(session, COUNTDOWN_MS + 10000, DEFAULT_RECORDING_MS);
    expect(view.events).toBe('2');
    expect(view.movementX).toBe('3 CSS px');
    expect(view.movementY).toBe('2 CSS px');
    expect(view.steps).toBe('7 CSS px');
    expect(view.largest).toBe('5 CSS px');
    expect(view.net).toBe('Δx 0 CSS px, Δy -2 CSS px, distance 2 CSS px');
    expect(view.pointerType).toBe('mouse');
    expect(view.status).toContain('Sum of movementX 3 CSS px');
    expect(view.status).toContain('not a sensor fault verdict');
    expect(view.status).not.toMatch(verdict);
  });

  it('keeps a reported zero and does not treat a missing component as zero', () => {
    const zeros = record(5000, [
      { pointerId: 4, pointerType: 'mouse', movementX: 0, movementY: 0, clientX: 8, clientY: 8 },
      { pointerId: 4, pointerType: 'mouse', movementX: 0, movementY: -0, clientX: 8, clientY: 8 },
    ]);
    const zeroView = readout(zeros, COUNTDOWN_MS + 5000, 5000);
    expect(zeroView.movementX).toBe('0 CSS px');
    expect(zeroView.movementY).toBe('0 CSS px');
    expect(zeroView.steps).toBe('0 CSS px');
    expect(zeroView.net).toBe('Δx 0 CSS px, Δy 0 CSS px, distance 0 CSS px');

    const missing = record(5000, [
      { pointerId: 4, pointerType: '   ', movementX: Number.NaN, movementY: 6, clientX: 1, clientY: 1 },
      { pointerId: 4, pointerType: '   ', movementX: '5', movementY: 1, clientX: Number.POSITIVE_INFINITY, clientY: 2 },
    ]);
    const missingView = readout(missing, COUNTDOWN_MS + 5000, 5000);
    expect(missingView.events).toBe('2');
    expect(missingView.movementX).toBe(NOT_PROVIDED);
    expect(missingView.steps).toBe(NOT_PROVIDED);
    expect(missingView.net).toBe('Δx 0 CSS px, Δy 0 CSS px, distance 0 CSS px (one position)');
    expect(missingView.pointerType).toBe(NOT_PROVIDED);
    expect(missingView.status).toContain('2 samples were left out of the movement sums');
    expect(missingView.status).not.toMatch(verdict);
  });

  it('reports no movement figures when the period stored nothing', () => {
    const session = startSession(15000, 0);
    const view = readout(session, COUNTDOWN_MS + 15000, 15000);
    expect(view.phase).toBe('complete');
    expect(view.period).toBe('15 s');
    expect(view.events).toBe('0');
    expect(view.movementX).toBe(NOT_PROVIDED);
    expect(view.net).toBe(NOT_PROVIDED);
    expect(view.trail).toEqual([]);
    expect(view.status).toContain('Pointermove samples: 0');
    expect(view.status).not.toMatch(verdict);
  });

  it('ignores samples before, during, and after the recording window', () => {
    const started = startSession(5000, 100);
    expect(started).not.toBeNull();
    if (!started) return;
    expect(phaseAt(started, 100)).toBe('countdown');
    expect(phaseAt(started, 100 + COUNTDOWN_MS - 1)).toBe('countdown');
    expect(phaseAt(started, 100 + COUNTDOWN_MS)).toBe('recording');
    expect(phaseAt(started, 100 + COUNTDOWN_MS + 4999)).toBe('recording');
    expect(phaseAt(started, 100 + COUNTDOWN_MS + 5000)).toBe('complete');

    const duringCountdown = addSample(started, { movementX: 9, movementY: 9, clientX: 1, clientY: 1 }, 100 + 10);
    expect(duringCountdown.accepted).toBe(false);
    expect(duringCountdown.session.samples).toHaveLength(0);

    const recorded = addSample(started, { movementX: 1.5, movementY: -0.5, clientX: 4, clientY: 6, pointerId: 2, pointerType: 'mouse' }, 100 + COUNTDOWN_MS);
    expect(recorded.accepted).toBe(true);
    expect(started.samples).toHaveLength(0);

    const after = addSample(recorded.session, { movementX: 40, movementY: 0, clientX: 80, clientY: 6 }, 100 + COUNTDOWN_MS + 5000);
    expect(after.accepted).toBe(false);
    const view = readout(after.session, 100 + COUNTDOWN_MS + 5000, 5000);
    expect(view.events).toBe('1');
    expect(view.movementX).toBe('1.5 CSS px');
    expect(view.movementY).toBe('-0.5 CSS px');
    expect(view.status).not.toContain('40 CSS px');
    expect(view.status).not.toMatch(verdict);
  });

  it('rejects durations outside the three buttons and a non-finite clock', () => {
    expect(startSession(4000, 0)).toBeNull();
    expect(startSession(0, 0)).toBeNull();
    expect(startSession(10000.5, 0)).toBeNull();
    expect(startSession(DEFAULT_RECORDING_MS, Number.NaN)).toBeNull();
    expect(startSession(DEFAULT_RECORDING_MS, 0)?.recordingMs).toBe(10000);
  });

  it('uses coalesced events in place of the parent pointermove', () => {
    const parent = { movementX: 10, movementY: 0, clientX: 10, clientY: 0, pointerId: 1, pointerType: 'mouse' };
    const coalesced = [
      { movementX: 4, movementY: 0, clientX: 4, clientY: 0, pointerId: 1, pointerType: 'mouse' },
      { movementX: 6, movementY: 0, clientX: 10, clientY: 0, pointerId: 1, pointerType: 'mouse' },
    ];
    expect(samplesFromMove(parent, coalesced)).toEqual(coalesced);
    expect(samplesFromMove(parent, [])).toEqual([parent]);
    expect(samplesFromMove(parent, null)).toEqual([parent]);

    let session = startSession(10000, 0);
    if (!session) throw new Error('session did not start');
    for (const sample of samplesFromMove(parent, coalesced)) {
      session = addSample(session, sample, COUNTDOWN_MS).session;
    }
    const stats = summarize(session.samples);
    expect(stats.eventCount).toBe(2);
    expect(stats.sumMovementX).toBe(10);
    expect(stats.netX).toBe(6);
    expect(stats.stepSum).toBe(10);
  });

  it('keeps distinct pointer types and ids in arrival order', () => {
    const session = record(10000, [
      { pointerId: 3, pointerType: 'mouse', movementX: 1, movementY: 0, clientX: 0, clientY: 0 },
      { pointerId: 3, pointerType: 'mouse', movementX: 1, movementY: 0, clientX: 1, clientY: 0 },
      { pointerId: 1.5, pointerType: 'pen', movementX: 0, movementY: 1, clientX: 1, clientY: 1 },
      { pointerType: 'touch', movementX: 0, movementY: 0, clientX: 1, clientY: 2 },
    ]);
    const view = readout(session, COUNTDOWN_MS + 10000, 10000);
    expect(view.phase).toBe('complete');
    expect(view.pointerType).toBe('mouse, pen, touch');
    expect(view.status).toContain('Pointer ids 3');
    expect(view.status).toContain('Samples without a pointer id: 2');
  });

  it('shows the idle and countdown states before any total exists', () => {
    const idle = readout(null, 0, 10000);
    expect(idle.phase).toBe('idle');
    expect(idle.period).toBe('10 s selected');
    expect(idle.events).toBe(NOT_STARTED);
    expect(idle.movementX).toBe(NOT_STARTED);
    expect(idle.status).toBe(IDLE_STATUS);
    expect(idle.trail).toEqual([]);

    const started = startSession(5000, 50);
    const countdown = readout(started, 50, 5000);
    expect(countdown.phase).toBe('countdown');
    expect(countdown.period).toBe('5 s');
    expect(countdown.events).toBe(NOT_RECORDING);
    expect(countdown.status).toContain('Recording starts in 3 s');
    expect(countdown.plotNote).toContain('countdown');
  });

  it('rounds the printed CSS pixels and clamps only the plot', () => {
    expect(formatQuantity(0.1 + 0.2)).toBe('0.3');
    expect(formatQuantity(-0)).toBe('0');
    expect(formatQuantity(1.23456)).toBe('1.2346');
    expect(formatCssPx(null)).toBe(NOT_PROVIDED);
    expect(formatCssPx(40)).toBe('40 CSS px');

    const placed = layoutTrail([{ dx: 0, dy: 0 }, { dx: 10, dy: -4 }], 200, 100, 2);
    expect(placed.clamped).toBe(false);
    expect(placed.points[0]).toEqual({ x: 100, y: 50 });
    expect(placed.points[1]).toEqual({ x: 120, y: 42 });

    const overflow = layoutTrail([{ dx: 100, dy: 0 }], 200, 100, 2);
    expect(overflow.clamped).toBe(true);
    expect(overflow.points[0]?.x).toBe(198);
  });
});
