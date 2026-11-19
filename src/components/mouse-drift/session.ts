/**
 * Stationary-period totals from pointermove samples.
 *
 * movementX, movementY, clientX, and clientY are copied only when they are
 * finite numbers. A missing or non-finite component is left out of that sum.
 * It is not treated as zero. The totals are not a sensor verdict.
 */

export const COUNTDOWN_MS = 3000;
export const RECORDING_MS_OPTIONS = [5000, 10000, 15000] as const;
export const DEFAULT_RECORDING_MS = 10000;
export const PLOT_SCALE = 2;
export const NOT_STARTED = 'Not started';
export const NOT_RECORDING = 'Not recording yet';
export const NOT_PROVIDED = 'Not provided';

export const IDLE_STATUS = 'Choose 5, 10, or 15 seconds, then press Start. A 3-second countdown runs before pointermove events are stored. Leave the pointer still during the recording.';
export const IDLE_PLOT_NOTE = 'The plot stays empty until a recorded pointermove includes both clientX and clientY. The pointer can rest anywhere in this browser window.';

export type Phase = 'idle' | 'countdown' | 'recording' | 'complete';

export interface RawPointerFields {
  pointerId?: unknown;
  pointerType?: unknown;
  movementX?: unknown;
  movementY?: unknown;
  clientX?: unknown;
  clientY?: unknown;
}

export interface Sample {
  pointerId: number | null;
  pointerType: string | null;
  movementX: number | null;
  movementY: number | null;
  clientX: number | null;
  clientY: number | null;
}

export interface Session {
  recordingMs: number;
  startedAt: number;
  samples: Sample[];
}

export interface TrailPoint {
  dx: number;
  dy: number;
}

export interface Stats {
  eventCount: number;
  movementSampleCount: number;
  movementOmittedCount: number;
  positionSampleCount: number;
  sumMovementX: number | null;
  sumMovementY: number | null;
  stepSum: number | null;
  largestStep: number | null;
  netX: number | null;
  netY: number | null;
  netDistance: number | null;
  pointerTypes: string[];
  pointerIds: number[];
  missingPointerIdCount: number;
  trail: TrailPoint[];
}

export interface Readout {
  phase: Phase;
  period: string;
  events: string;
  movementX: string;
  movementY: string;
  steps: string;
  largest: string;
  net: string;
  pointerType: string;
  status: string;
  plotNote: string;
  trail: TrailPoint[];
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return NOT_PROVIDED;
  const negative = Object.is(value, -0) ? false : value < 0;
  const abs = Math.abs(value);
  const text = Number.isInteger(abs)
    ? String(abs)
    : abs.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return `${negative ? '-' : ''}${text}`;
}

export function formatCssPx(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return NOT_PROVIDED;
  return `${formatQuantity(value)} CSS px`;
}

export function formatSeconds(ms: number): string {
  const seconds = Math.max(0, ms) / 1000;
  if (!Number.isFinite(seconds)) return NOT_PROVIDED;
  if (Number.isInteger(seconds)) return `${seconds} s`;
  return `${seconds.toFixed(1)} s`;
}

export function isRecordingOption(value: number): value is (typeof RECORDING_MS_OPTIONS)[number] {
  return (RECORDING_MS_OPTIONS as readonly number[]).includes(value);
}

export function normalizeSample(raw: RawPointerFields): Sample {
  const pointerId = finiteNumber(raw.pointerId);
  const pointerType = typeof raw.pointerType === 'string' && raw.pointerType.trim() !== ''
    ? raw.pointerType
    : null;
  return {
    pointerId: pointerId !== null && Number.isSafeInteger(pointerId) ? pointerId : null,
    pointerType,
    movementX: finiteNumber(raw.movementX),
    movementY: finiteNumber(raw.movementY),
    clientX: finiteNumber(raw.clientX),
    clientY: finiteNumber(raw.clientY),
  };
}

export function rawFieldsFromEvent(event: {
  pointerId?: unknown;
  pointerType?: unknown;
  movementX?: unknown;
  movementY?: unknown;
  clientX?: unknown;
  clientY?: unknown;
}): RawPointerFields {
  return {
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    movementX: event.movementX,
    movementY: event.movementY,
    clientX: event.clientX,
    clientY: event.clientY,
  };
}

export function samplesFromMove(
  parent: RawPointerFields,
  coalesced: readonly RawPointerFields[] | null | undefined,
): RawPointerFields[] {
  if (coalesced && coalesced.length > 0) return [...coalesced];
  return [parent];
}

export function startSession(recordingMs: number, now: number): Session | null {
  if (!isRecordingOption(recordingMs) || !Number.isFinite(now)) return null;
  return { recordingMs, startedAt: now, samples: [] };
}

export function phaseAt(session: Session, now: number): Phase {
  const elapsed = now - session.startedAt;
  if (!(elapsed >= COUNTDOWN_MS)) return 'countdown';
  if (elapsed < COUNTDOWN_MS + session.recordingMs) return 'recording';
  return 'complete';
}

export function addSample(
  session: Session,
  raw: RawPointerFields,
  now: number,
): { session: Session; accepted: boolean } {
  if (phaseAt(session, now) !== 'recording') return { session, accepted: false };
  return {
    session: { ...session, samples: [...session.samples, normalizeSample(raw)] },
    accepted: true,
  };
}

export function summarize(samples: readonly Sample[]): Stats {
  let sumMovementX = 0;
  let sumMovementY = 0;
  let stepSum = 0;
  let largestStep = 0;
  let movementSampleCount = 0;
  let movementOmittedCount = 0;
  let missingPointerIdCount = 0;
  const pointerTypes: string[] = [];
  const pointerIds: number[] = [];
  const positions: Array<{ x: number; y: number }> = [];

  for (const sample of samples) {
    if (sample.pointerType !== null && !pointerTypes.includes(sample.pointerType)) {
      pointerTypes.push(sample.pointerType);
    }
    if (sample.pointerId === null) missingPointerIdCount += 1;
    else if (!pointerIds.includes(sample.pointerId)) pointerIds.push(sample.pointerId);

    if (sample.movementX === null || sample.movementY === null) {
      movementOmittedCount += 1;
    } else {
      movementSampleCount += 1;
      sumMovementX += sample.movementX;
      sumMovementY += sample.movementY;
      const step = Math.hypot(sample.movementX, sample.movementY);
      stepSum += step;
      if (step > largestStep) largestStep = step;
    }

    if (sample.clientX !== null && sample.clientY !== null) {
      positions.push({ x: sample.clientX, y: sample.clientY });
    }
  }

  const first = positions[0];
  const last = positions[positions.length - 1];
  const hasMovement = movementSampleCount > 0;
  const hasPosition = positions.length > 0;
  return {
    eventCount: samples.length,
    movementSampleCount,
    movementOmittedCount,
    positionSampleCount: positions.length,
    sumMovementX: hasMovement ? sumMovementX : null,
    sumMovementY: hasMovement ? sumMovementY : null,
    stepSum: hasMovement ? stepSum : null,
    largestStep: hasMovement ? largestStep : null,
    netX: hasPosition && first && last ? last.x - first.x : null,
    netY: hasPosition && first && last ? last.y - first.y : null,
    netDistance: hasPosition && first && last ? Math.hypot(last.x - first.x, last.y - first.y) : null,
    pointerTypes,
    pointerIds,
    missingPointerIdCount,
    trail: first ? positions.map((point) => ({ dx: point.x - first.x, dy: point.y - first.y })) : [],
  };
}

export function formatNet(stats: Stats): string {
  if (stats.positionSampleCount === 0 || stats.netX === null || stats.netY === null || stats.netDistance === null) {
    return NOT_PROVIDED;
  }
  const single = stats.positionSampleCount === 1 ? ' (one position)' : '';
  return `Δx ${formatQuantity(stats.netX)} CSS px, Δy ${formatQuantity(stats.netY)} CSS px, distance ${formatQuantity(stats.netDistance)} CSS px${single}`;
}

export function layoutTrail(
  trail: readonly TrailPoint[],
  width: number,
  height: number,
  scale = PLOT_SCALE,
): { points: Array<{ x: number; y: number }>; clamped: boolean } {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(scale) || scale <= 0) {
    return { points: [], clamped: false };
  }
  const inset = 2;
  const centerX = width / 2;
  const centerY = height / 2;
  let clamped = false;
  const points = trail.map((point) => {
    const rawX = centerX + point.dx * scale;
    const rawY = centerY + point.dy * scale;
    const x = Math.min(width - inset, Math.max(inset, rawX));
    const y = Math.min(height - inset, Math.max(inset, rawY));
    if (Math.abs(x - rawX) > 0.01 || Math.abs(y - rawY) > 0.01) clamped = true;
    return { x, y };
  });
  return { points, clamped };
}

function waitingMeasurement(phase: Phase, value: string): string {
  if (phase === 'idle') return NOT_STARTED;
  if (phase === 'countdown') return NOT_RECORDING;
  return value;
}

export function plotNote(phase: Phase, positionCount: number, clamped: boolean): string {
  if (phase === 'idle') return IDLE_PLOT_NOTE;
  if (phase === 'countdown') return 'The plot stays empty during the countdown. Recording has not started.';
  if (positionCount === 0) return 'No recorded event included both clientX and clientY, so the plot has no points.';
  if (clamped) return 'A point was drawn on the edge because it did not fit. The numbers above are not clamped. 1 CSS pixel of change is 2 pixels on the plot.';
  return 'The center is the first client position. 1 CSS pixel of change is 2 pixels on the plot.';
}

function statusFor(session: Session | null, now: number, stats: Stats, phase: Phase): string {
  if (!session || phase === 'idle') return IDLE_STATUS;
  if (phase === 'countdown') {
    const left = COUNTDOWN_MS - (now - session.startedAt);
    return `Countdown. Recording starts in ${formatSeconds(left)}. Pointer movement is not stored yet.`;
  }
  if (phase === 'recording') {
    const left = session.startedAt + COUNTDOWN_MS + session.recordingMs - now;
    return `Recording a ${session.recordingMs / 1000} s stationary period. ${formatSeconds(left)} left. ${stats.eventCount} pointermove samples stored.`;
  }
  const omitted = stats.movementOmittedCount > 0
    ? ` ${stats.movementOmittedCount} samples were left out of the movement sums because movementX or movementY was not a finite number.`
    : '';
  const types = stats.pointerTypes.length > 0 ? stats.pointerTypes.join(', ') : NOT_PROVIDED;
  const ids = stats.pointerIds.length > 0 ? stats.pointerIds.join(', ') : NOT_PROVIDED;
  const missingIds = stats.missingPointerIdCount > 0 ? ` Samples without a pointer id: ${stats.missingPointerIdCount}.` : '';
  return `Stationary period of ${session.recordingMs / 1000} s ended. Pointermove samples: ${stats.eventCount}.${omitted} Sum of movementX ${formatCssPx(stats.sumMovementX)}. Sum of movementY ${formatCssPx(stats.sumMovementY)}. Sum of step lengths ${formatCssPx(stats.stepSum)}. Largest step ${formatCssPx(stats.largestStep)}. Net position ${formatNet(stats)}. Pointer type ${types}. Pointer ids ${ids}.${missingIds} These figures are the pointermove samples from this period. They are not a sensor fault verdict.`;
}

export function readout(session: Session | null, now: number, selectedMs: number, clamped = false): Readout {
  const phase: Phase = session ? phaseAt(session, now) : 'idle';
  const stats = summarize(session?.samples ?? []);
  const period = session ? `${session.recordingMs / 1000} s` : `${selectedMs / 1000} s selected`;
  const movementReady = phase === 'recording' || phase === 'complete';
  return {
    phase,
    period,
    events: waitingMeasurement(phase, String(stats.eventCount)),
    movementX: waitingMeasurement(phase, movementReady ? formatCssPx(stats.sumMovementX) : NOT_PROVIDED),
    movementY: waitingMeasurement(phase, movementReady ? formatCssPx(stats.sumMovementY) : NOT_PROVIDED),
    steps: waitingMeasurement(phase, movementReady ? formatCssPx(stats.stepSum) : NOT_PROVIDED),
    largest: waitingMeasurement(phase, movementReady ? formatCssPx(stats.largestStep) : NOT_PROVIDED),
    net: waitingMeasurement(phase, movementReady ? formatNet(stats) : NOT_PROVIDED),
    pointerType: waitingMeasurement(phase, stats.pointerTypes.length > 0 ? stats.pointerTypes.join(', ') : NOT_PROVIDED),
    status: statusFor(session, now, stats, phase),
    plotNote: plotNote(phase, stats.positionSampleCount, clamped),
    trail: movementReady ? stats.trail : [],
  };
}
