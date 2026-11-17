/** Browser frame-interval estimate. Not a panel, EDID, or hardware refresh-rate reading. */

export const MIN_VALID_INTERVALS = 8;
export const MIN_DURATION_MS = 200;
/** Ignore gaps faster than 1000 Hz. Sub-millisecond gaps are not treated as a display interval. */
export const ABS_MIN_INTERVAL_MS = 1;
/** Ignore gaps slower than 10 Hz. Longer gaps are treated as stalls, not a refresh interval. */
export const ABS_MAX_INTERVAL_MS = 100;
/** Drop intervals outside median/spread … median*spread after the absolute window. */
export const OUTLIER_SPREAD = 1.75;

export class InvalidFrameTimestampsError extends Error {
  readonly code = 'invalid_timestamps' as const;

  constructor(message: string) {
    super(message);
    this.name = 'InvalidFrameTimestampsError';
  }
}

export type InsufficientReason = 'empty' | 'too_few_frames' | 'too_short' | 'no_valid_intervals';

export interface InsufficientRefreshEstimate {
  status: 'insufficient';
  reason: InsufficientReason;
  frameCount: number;
  intervalCount: number;
  validIntervalCount: number;
  outlierCount: number;
  durationMs: number;
}

export interface RefreshEstimateOk {
  status: 'ok';
  /** 1000 / median inlier interval (ms). A frame-interval estimate, not a certified mode. */
  hz: number;
  method: 'median_of_inlier_intervals';
  frameCount: number;
  intervalCount: number;
  validIntervalCount: number;
  outlierCount: number;
  durationMs: number;
  minIntervalMs: number;
  medianIntervalMs: number;
  meanIntervalMs: number;
  maxIntervalMs: number;
}

export type RefreshEstimate = RefreshEstimateOk | InsufficientRefreshEstimate;

function assertTimestamps(timestamps: readonly number[]): void {
  for (let index = 0; index < timestamps.length; index += 1) {
    const value = timestamps[index];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new InvalidFrameTimestampsError('Frame timestamps must be finite numbers.');
    }
    if (index > 0 && value <= timestamps[index - 1]) {
      throw new InvalidFrameTimestampsError('Frame timestamps must be strictly increasing.');
    }
  }
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function insufficient(
  reason: InsufficientReason,
  frameCount: number,
  intervalCount: number,
  validIntervalCount: number,
  outlierCount: number,
  durationMs: number,
): InsufficientRefreshEstimate {
  return { status: 'insufficient', reason, frameCount, intervalCount, validIntervalCount, outlierCount, durationMs };
}

/**
 * Estimate a rate from animation-frame timestamps.
 * Uniform 1000/60 ms spacing is expected to land within 0.5 Hz of 60 when the sample is long enough.
 * Empty, one-frame, two-frame, and other short samples return status "insufficient" and no Hz.
 */
export function estimateRefreshRate(timestamps: readonly number[]): RefreshEstimate {
  if (!Array.isArray(timestamps)) {
    throw new InvalidFrameTimestampsError('Frame timestamps must be an array.');
  }
  assertTimestamps(timestamps);

  if (timestamps.length === 0) {
    return insufficient('empty', 0, 0, 0, 0, 0);
  }

  const durationMs = timestamps.length < 2 ? 0 : timestamps[timestamps.length - 1] - timestamps[0];
  if (timestamps.length < MIN_VALID_INTERVALS + 1 || durationMs < MIN_DURATION_MS) {
    const reason = timestamps.length < 3 || timestamps.length < MIN_VALID_INTERVALS + 1 ? 'too_few_frames' : 'too_short';
    return insufficient(reason, timestamps.length, Math.max(0, timestamps.length - 1), 0, 0, durationMs);
  }

  const intervals: number[] = [];
  for (let index = 1; index < timestamps.length; index += 1) {
    intervals.push(timestamps[index] - timestamps[index - 1]);
  }

  const inAbsolute = intervals.filter((gap) => gap >= ABS_MIN_INTERVAL_MS && gap <= ABS_MAX_INTERVAL_MS);
  if (inAbsolute.length < MIN_VALID_INTERVALS) {
    return insufficient('no_valid_intervals', timestamps.length, intervals.length, inAbsolute.length, intervals.length - inAbsolute.length, durationMs);
  }

  const seedMedian = median(inAbsolute);
  const inliers = inAbsolute.filter((gap) => gap >= seedMedian / OUTLIER_SPREAD && gap <= seedMedian * OUTLIER_SPREAD);
  const outlierCount = intervals.length - inliers.length;
  if (inliers.length < MIN_VALID_INTERVALS) {
    return insufficient('no_valid_intervals', timestamps.length, intervals.length, inliers.length, outlierCount, durationMs);
  }

  const medianIntervalMs = median(inliers);
  return {
    status: 'ok',
    hz: 1000 / medianIntervalMs,
    method: 'median_of_inlier_intervals',
    frameCount: timestamps.length,
    intervalCount: intervals.length,
    validIntervalCount: inliers.length,
    outlierCount,
    durationMs,
    minIntervalMs: Math.min(...inliers),
    medianIntervalMs,
    meanIntervalMs: mean(inliers),
    maxIntervalMs: Math.max(...inliers),
  };
}
