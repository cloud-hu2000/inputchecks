import { describe, expect, it } from 'vitest';
import { addSample, createSession, getVerticalDirection, resultState } from '../src/tools/scroll-wheel/wheelAnalyzer';

function sample(session: ReturnType<typeof createSession>, deltaY: number, timestamp: number) { return addSample(session, { deltaX: 0, deltaY, deltaMode: 0, timestamp }); }
describe('wheel analyzer', () => {
  it('recognizes vertical direction and ignores zero', () => { expect(getVerticalDirection(1)).toBe('down'); expect(getVerticalDirection(-1)).toBe('up'); expect(getVerticalDirection(0)).toBe('none'); });
  it('records no reverse events for matching down events', () => { let session = createSession('down', 0); session = sample(session, 1, 10); session = sample(session, 5, 20); session = sample(session, 2, 30); expect(session.totalEvents).toBe(3); expect(session.reverseEvents).toBe(0); expect(session.reverseRate).toBe(0); });
  it('detects a reverse event in a down test', () => { let session = createSession('down', 0); session = sample(session, 1, 10); session = sample(session, 1, 20); session = sample(session, -1, 35); expect(session.expectedEvents).toBe(2); expect(session.reverseEvents).toBe(1); expect(session.reverseRate).toBeCloseTo(100 / 3); expect(session.longestGap).toBe(15); });
  it('detects a reverse event in an up test', () => { let session = createSession('up', 0); session = sample(session, -1, 10); session = sample(session, -2, 20); session = sample(session, 1, 30); expect(session.reverseEvents).toBe(1); });
  it('counts horizontal-only input without calling it a vertical reversal', () => {
    let session = createSession('down', 0);
    session = addSample(session, { deltaX: 12, deltaY: 0, deltaMode: 1, timestamp: 10 });
    session = addSample(session, { deltaX: -2, deltaY: 4, deltaMode: 1, timestamp: 20 });
    expect(session.horizontalEvents).toBe(2);
    expect(session.totalDeltaX).toBe(10);
    expect(session.totalEvents).toBe(1);
    expect(session.reverseEvents).toBe(0);
    expect(session.lastDeltaMode).toBe(1);
    expect(session.peakDeltaY).toBe(4);
  });
  it('requires 20 events before returning a health-oriented result', () => { let session = createSession('down', 0); for (let i = 0; i < 19; i++) session = sample(session, 1, i + 1); expect(resultState(session)).toBe('collecting'); session = sample(session, 1, 20); expect(resultState(session)).toBe('clear'); });
});
