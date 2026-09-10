import type { Direction, WheelSample, WheelTestSession } from './types';
export function getVerticalDirection(deltaY: number): Direction { return deltaY > 0 ? 'down' : deltaY < 0 ? 'up' : 'none'; }
export function createSession(expectedDirection: 'up' | 'down', startedAt = performance.now()): WheelTestSession { return { expectedDirection, startedAt, samples: [], totalEvents: 0, expectedEvents: 0, reverseEvents: 0, reverseRate: 0, longestGap: 0 }; }
export function addSample(session: WheelTestSession, input: Omit<WheelSample, 'direction' | 'expected'>): WheelTestSession {
  const direction = getVerticalDirection(input.deltaY); if (direction === 'none') return session;
  const expected = direction === session.expectedDirection;
  const previous = session.samples.at(-1); const longestGap = previous ? Math.max(session.longestGap, input.timestamp - previous.timestamp) : session.longestGap;
  const samples = [...session.samples, { ...input, direction, expected }].slice(-500);
  const totalEvents = session.totalEvents + 1; const expectedEvents = session.expectedEvents + Number(expected); const reverseEvents = session.reverseEvents + Number(!expected);
  return { ...session, samples, totalEvents, expectedEvents, reverseEvents, reverseRate: (reverseEvents / totalEvents) * 100, longestGap };
}
export function resultState(session: WheelTestSession): 'collecting' | 'clear' | 'reverse' { if (session.totalEvents < 20) return 'collecting'; return session.reverseEvents ? 'reverse' : 'clear'; }
