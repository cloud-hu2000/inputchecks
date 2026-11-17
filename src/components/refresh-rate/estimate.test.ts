import { describe, expect, it } from 'vitest';
import {
  ABS_MAX_INTERVAL_MS,
  ABS_MIN_INTERVAL_MS,
  InvalidFrameTimestampsError,
  MIN_DURATION_MS,
  MIN_VALID_INTERVALS,
  estimateRefreshRate,
} from './estimate';

function fromIntervals(intervals: number[], start = 0): number[] {
  const stamps = [start];
  for (const gap of intervals) stamps.push(stamps[stamps.length - 1] + gap);
  return stamps;
}

function uniform(intervalMs: number, frames: number): number[] {
  return Array.from({ length: frames }, (_, index) => index * intervalMs);
}

describe('refresh rate frame-interval estimate', () => {
  it('maps a uniform 1000/60 ms series to about 60 Hz within 0.5 Hz', () => {
    const intervalMs = 1000 / 60;
    const result = estimateRefreshRate(uniform(intervalMs, 61));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(Math.abs(result.hz - 60)).toBeLessThan(0.5);
    expect(result.method).toBe('median_of_inlier_intervals');
    expect(result.frameCount).toBe(61);
    expect(result.intervalCount).toBe(60);
    expect(result.outlierCount).toBe(0);
    expect(result.durationMs).toBeCloseTo(1000, 5);
    expect(result.medianIntervalMs).toBeCloseTo(intervalMs, 5);
  });

  it('returns insufficient data for an empty series', () => {
    const result = estimateRefreshRate([]);
    expect(result).toEqual({
      status: 'insufficient',
      reason: 'empty',
      frameCount: 0,
      intervalCount: 0,
      validIntervalCount: 0,
      outlierCount: 0,
      durationMs: 0,
    });
    expect('hz' in result).toBe(false);
  });

  it('returns insufficient data for one frame', () => {
    const result = estimateRefreshRate([12]);
    expect(result.status).toBe('insufficient');
    if (result.status !== 'insufficient') return;
    expect(result.reason).toBe('too_few_frames');
    expect(result.frameCount).toBe(1);
    expect('hz' in result).toBe(false);
  });

  it('returns insufficient data for two frames', () => {
    const result = estimateRefreshRate([0, 1000 / 60]);
    expect(result.status).toBe('insufficient');
    if (result.status !== 'insufficient') return;
    expect(result.reason).toBe('too_few_frames');
    expect(result.frameCount).toBe(2);
    expect('hz' in result).toBe(false);
  });

  it('returns insufficient data for a very short sample', () => {
    const result = estimateRefreshRate(uniform(1000 / 60, 5));
    expect(result.status).toBe('insufficient');
    if (result.status !== 'insufficient') return;
    expect(result.reason).toBe('too_few_frames');
    expect(result.durationMs).toBeLessThan(MIN_DURATION_MS);
    expect(result.frameCount).toBeLessThan(MIN_VALID_INTERVALS + 1);
    expect('hz' in result).toBe(false);
  });

  it('uses the median of inlier intervals and drops deterministic outliers', () => {
    const typical = 1000 / 60;
    const intervals = Array.from({ length: 20 }, () => typical);
    intervals[4] = 80;
    intervals[13] = 90;
    const result = estimateRefreshRate(fromIntervals(intervals));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(Math.abs(result.hz - 60)).toBeLessThan(0.5);
    expect(result.outlierCount).toBe(2);
    expect(result.validIntervalCount).toBe(18);
    expect(result.maxIntervalMs).toBeLessThan(ABS_MAX_INTERVAL_MS / 2);
    expect(result.meanIntervalMs).toBeCloseTo(typical, 5);
    expect(result.hz).toBeCloseTo(1000 / result.medianIntervalMs, 8);
  });

  it('keeps irregular but plausible intervals and reports their median', () => {
    const intervals = [15, 16, 17, 18, 15.5, 16.5, 17.5, 18.5, 15, 16, 17, 18];
    const result = estimateRefreshRate(fromIntervals(intervals));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const sorted = [...intervals].sort((left, right) => left - right);
    const expectedMedian = (sorted[5] + sorted[6]) / 2;
    expect(result.medianIntervalMs).toBeCloseTo(expectedMedian, 8);
    expect(result.hz).toBeCloseTo(1000 / expectedMedian, 8);
    expect(result.outlierCount).toBe(0);
    expect(result.minIntervalMs).toBe(Math.min(...intervals));
    expect(result.maxIntervalMs).toBe(Math.max(...intervals));
  });

  it('does not invent a rate from stalled gaps', () => {
    const result = estimateRefreshRate(uniform(500, 12));
    expect(result.status).toBe('insufficient');
    if (result.status !== 'insufficient') return;
    expect(result.reason).toBe('no_valid_intervals');
    expect('hz' in result).toBe(false);
  });

  it('rejects non-finite timestamps', () => {
    expect(() => estimateRefreshRate([0, Number.NaN])).toThrow(InvalidFrameTimestampsError);
    expect(() => estimateRefreshRate([0, Number.POSITIVE_INFINITY])).toThrow(InvalidFrameTimestampsError);
    expect(() => estimateRefreshRate([0, Number.NEGATIVE_INFINITY, 20])).toThrow(/finite/);
  });

  it('rejects timestamps that are not strictly increasing', () => {
    expect(() => estimateRefreshRate([0, 16, 16])).toThrow(InvalidFrameTimestampsError);
    expect(() => estimateRefreshRate([20, 10])).toThrow(/strictly increasing/);
  });

  it('rejects a non-array sample', () => {
    expect(() => estimateRefreshRate(undefined as unknown as number[])).toThrow(InvalidFrameTimestampsError);
  });

  it('documents the absolute interval window used to drop glitches', () => {
    expect(ABS_MIN_INTERVAL_MS).toBe(1);
    expect(ABS_MAX_INTERVAL_MS).toBe(100);
  });
});
