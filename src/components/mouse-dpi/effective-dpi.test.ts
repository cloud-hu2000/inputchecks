import { describe, expect, it } from 'vitest';
import {
  CM_PER_INCH,
  InvalidPointerPathError,
  MM_PER_INCH,
  calculateEdpi,
  calculateEffectiveDpi,
  formatDpi,
  formatTravelPixels,
  pointerPathPixels,
} from './effective-dpi';

describe('effective DPI from a measured path', () => {
  it('divides known pixel travel by known inches', () => {
    const result = calculateEffectiveDpi({ physicalDistance: 2, unit: 'in', pixelTravel: 1600 });
    expect(result).toEqual({
      status: 'ok',
      effectiveDpi: 800,
      inches: 2,
      pixels: 1600,
      formula: 'pixels_divided_by_inches',
    });
  });

  it('accepts numeric strings and surrounding spaces', () => {
    const result = calculateEffectiveDpi({ physicalDistance: '  1  ', unit: 'in', pixelTravel: '800' });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.effectiveDpi).toBe(800);
    expect(result.formula).toBe('pixels_divided_by_inches');
  });

  it('converts millimeters and centimeters with 25.4 mm per inch', () => {
    expect(MM_PER_INCH).toBe(25.4);
    expect(CM_PER_INCH).toBe(2.54);
    const fromMm = calculateEffectiveDpi({ physicalDistance: 25.4, unit: 'mm', pixelTravel: 800 });
    const fromCm = calculateEffectiveDpi({ physicalDistance: 2.54, unit: 'cm', pixelTravel: 800 });
    expect(fromMm).toMatchObject({ status: 'ok', effectiveDpi: 800, inches: 1, pixels: 800 });
    expect(fromCm).toMatchObject({ status: 'ok', effectiveDpi: 800, inches: 1, pixels: 800 });

    const tenMm = calculateEffectiveDpi({ physicalDistance: 10, unit: 'mm', pixelTravel: 100 });
    expect(tenMm.status).toBe('ok');
    if (tenMm.status !== 'ok') return;
    expect(tenMm.inches).toBeCloseTo(10 / 25.4, 12);
    expect(tenMm.effectiveDpi).toBeCloseTo(100 / (10 / 25.4), 8);
  });

  it('keeps a positive quotient for very small distances and pixel counts', () => {
    const result = calculateEffectiveDpi({ physicalDistance: 1e-9, unit: 'in', pixelTravel: 2e-9 });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.effectiveDpi).toBeCloseTo(2, 8);
    expect(result.effectiveDpi).toBeGreaterThan(0);
    expect(formatDpi(result.effectiveDpi)).not.toBe('0');
  });

  it('does not invent a DPI for zero distance or zero pixels', () => {
    const zeroDistance = calculateEffectiveDpi({ physicalDistance: 0, unit: 'in', pixelTravel: 1600 });
    expect(zeroDistance).toEqual({ status: 'error', issues: [{ field: 'physicalDistance', code: 'zero' }] });
    expect(zeroDistance).not.toHaveProperty('effectiveDpi');

    const zeroPixels = calculateEffectiveDpi({ physicalDistance: 2, unit: 'in', pixelTravel: 0 });
    expect(zeroPixels).toEqual({ status: 'error', issues: [{ field: 'pixelTravel', code: 'zero' }] });
    expect(JSON.stringify(zeroPixels)).not.toMatch(/"effectiveDpi"/);

    const signedZero = calculateEffectiveDpi({ physicalDistance: '-0', unit: 'mm', pixelTravel: '0.0' });
    expect(signedZero.status).toBe('error');
    if (signedZero.status !== 'error') return;
    expect(signedZero.issues).toEqual([
      { field: 'physicalDistance', code: 'zero' },
      { field: 'pixelTravel', code: 'zero' },
    ]);
  });

  it('rejects missing, non-numeric, negative, and non-finite measurement inputs', () => {
    const missing = calculateEffectiveDpi({ physicalDistance: '  ', unit: 'in', pixelTravel: '' });
    expect(missing.status).toBe('error');
    if (missing.status !== 'error') return;
    expect(missing.issues).toContainEqual({ field: 'physicalDistance', code: 'missing' });
    expect(missing.issues).toContainEqual({ field: 'pixelTravel', code: 'missing' });
    expect(missing).not.toHaveProperty('effectiveDpi');

    const nonNumeric = calculateEffectiveDpi({ physicalDistance: '12px', unit: 'in', pixelTravel: 'nope' });
    expect(nonNumeric.status).toBe('error');
    if (nonNumeric.status !== 'error') return;
    expect(nonNumeric.issues).toContainEqual({ field: 'physicalDistance', code: 'non_numeric' });
    expect(nonNumeric.issues).toContainEqual({ field: 'pixelTravel', code: 'non_numeric' });

    const negative = calculateEffectiveDpi({ physicalDistance: -2, unit: 'cm', pixelTravel: '-5' });
    expect(negative.status).toBe('error');
    if (negative.status !== 'error') return;
    expect(negative.issues).toContainEqual({ field: 'physicalDistance', code: 'negative' });
    expect(negative.issues).toContainEqual({ field: 'pixelTravel', code: 'negative' });

    const nonFinite = calculateEffectiveDpi({
      physicalDistance: Number.POSITIVE_INFINITY,
      unit: 'in',
      pixelTravel: Number.NaN,
    });
    expect(nonFinite.status).toBe('error');
    if (nonFinite.status !== 'error') return;
    expect(nonFinite.issues).toContainEqual({ field: 'physicalDistance', code: 'non_finite' });
    expect(nonFinite.issues).toContainEqual({ field: 'pixelTravel', code: 'non_finite' });

    const textInfinity = calculateEffectiveDpi({ physicalDistance: 'Infinity', unit: 'in', pixelTravel: 'NaN' });
    expect(textInfinity.status).toBe('error');
    if (textInfinity.status !== 'error') return;
    expect(textInfinity.issues).toContainEqual({ field: 'physicalDistance', code: 'non_finite' });
    expect(textInfinity.issues).toContainEqual({ field: 'pixelTravel', code: 'non_finite' });
    expect(JSON.stringify(textInfinity)).not.toMatch(/"effectiveDpi"/);
  });

  it('rejects an unknown or missing unit without assuming inches', () => {
    const missing = calculateEffectiveDpi({ physicalDistance: 1, unit: '', pixelTravel: 100 });
    expect(missing).toEqual({ status: 'error', issues: [{ field: 'unit', code: 'missing' }] });
    const invalid = calculateEffectiveDpi({ physicalDistance: 1, unit: 'inch', pixelTravel: 100 });
    expect(invalid).toEqual({ status: 'error', issues: [{ field: 'unit', code: 'invalid_unit' }] });
    expect(invalid).not.toHaveProperty('effectiveDpi');
  });
});

describe('eDPI is DPI times sensitivity only when both are supplied', () => {
  it('multiplies 800 DPI by 0.5 sensitivity', () => {
    expect(calculateEdpi({ dpi: 800, sensitivity: 0.5 })).toEqual({
      status: 'ok',
      dpi: 800,
      sensitivity: 0.5,
      edpi: 400,
      formula: 'dpi_times_sensitivity',
    });
  });

  it('does not invent the missing factor when only DPI or only sensitivity is present', () => {
    const dpiOnly = calculateEdpi({ dpi: 800, sensitivity: '   ' });
    expect(dpiOnly).toEqual({ status: 'omitted', reason: 'dpi_only' });
    expect(dpiOnly).not.toHaveProperty('edpi');

    const sensitivityOnly = calculateEdpi({ dpi: null, sensitivity: 0.5 });
    expect(sensitivityOnly).toEqual({ status: 'omitted', reason: 'sensitivity_only' });
    expect(sensitivityOnly).not.toHaveProperty('edpi');

    const neither = calculateEdpi({ dpi: undefined, sensitivity: '' });
    expect(neither).toEqual({ status: 'omitted', reason: 'not_supplied' });
    expect(neither).not.toHaveProperty('edpi');
  });

  it('does not invent eDPI from a missing, non-numeric, negative, zero, or non-finite factor', () => {
    const negative = calculateEdpi({ dpi: -800, sensitivity: 0.5 });
    expect(negative).toEqual({ status: 'error', issues: [{ field: 'dpi', code: 'negative' }] });
    expect(negative).not.toHaveProperty('edpi');

    const zero = calculateEdpi({ dpi: 800, sensitivity: 0 });
    expect(zero).toEqual({ status: 'error', issues: [{ field: 'sensitivity', code: 'zero' }] });

    const nonNumeric = calculateEdpi({ dpi: 'fast', sensitivity: '0.5x' });
    expect(nonNumeric.status).toBe('error');
    if (nonNumeric.status !== 'error') return;
    expect(nonNumeric.issues).toEqual([
      { field: 'dpi', code: 'non_numeric' },
      { field: 'sensitivity', code: 'non_numeric' },
    ]);
    expect(JSON.stringify(nonNumeric)).not.toMatch(/"edpi"/);

    const nonFinite = calculateEdpi({ dpi: Number.NaN, sensitivity: Number.POSITIVE_INFINITY });
    expect(nonFinite.status).toBe('error');
    if (nonFinite.status !== 'error') return;
    expect(nonFinite.issues).toContainEqual({ field: 'dpi', code: 'non_finite' });
    expect(nonFinite.issues).toContainEqual({ field: 'sensitivity', code: 'non_finite' });

    const invalidAlone = calculateEdpi({ dpi: '', sensitivity: -1 });
    expect(invalidAlone).toEqual({ status: 'error', issues: [{ field: 'sensitivity', code: 'negative' }] });
    expect(invalidAlone).not.toHaveProperty('edpi');
  });
});

describe('pointer path length', () => {
  it('sums segment lengths and treats an empty or single-point path as zero', () => {
    expect(pointerPathPixels([])).toBe(0);
    expect(pointerPathPixels([{ x: 4, y: 9 }])).toBe(0);
    expect(pointerPathPixels([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBe(5);
    expect(pointerPathPixels([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 4 },
    ])).toBe(7);
  });

  it('keeps a very small segment instead of rounding it away', () => {
    expect(pointerPathPixels([{ x: 0, y: 0 }, { x: 1e-8, y: 0 }])).toBeCloseTo(1e-8, 18);
  });

  it('rejects a non-finite point', () => {
    expect(() => pointerPathPixels([{ x: 0, y: Number.NaN }])).toThrow(InvalidPointerPathError);
    expect(() => pointerPathPixels([{ x: Number.POSITIVE_INFINITY, y: 1 }])).toThrow(/finite/);
  });

  it('rounds travel for the text field and writes 0 when the path rounds away', () => {
    expect(formatTravelPixels(200)).toBe('200');
    expect(formatTravelPixels(200.126)).toBe('200.13');
    expect(formatTravelPixels(0)).toBe('0');
    expect(formatTravelPixels(0.004)).toBe('0');
    expect(formatDpi(800)).toBe('800');
    expect(formatDpi(400)).toBe('400');
    expect(() => formatDpi(0)).toThrow(/positive finite/);
    expect(() => formatDpi(Number.NaN)).toThrow(/positive finite/);
  });
});
