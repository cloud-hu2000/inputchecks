/**
 * Effective / on-screen DPI from a user-measured path.
 *
 * Formula: effectiveDpi = pixelTravel / inches
 * inches = distance when the unit is "in"
 * inches = distance / 2.54 when the unit is "cm"
 * inches = distance / 25.4 when the unit is "mm"
 * (The international inch is exactly 25.4 millimeters.)
 *
 * eDPI = dpi × sensitivity, and only when both factors are supplied.
 * This module does not read a mouse sensor, HID report, or OS pointer-speed setting.
 */

export const MM_PER_INCH = 25.4;
export const CM_PER_INCH = 2.54;

export type DistanceUnit = 'in' | 'cm' | 'mm';

export type IssueCode = 'missing' | 'non_numeric' | 'non_finite' | 'negative' | 'zero' | 'invalid_unit';

export type DpiField = 'physicalDistance' | 'pixelTravel' | 'unit' | 'dpi' | 'sensitivity';

export interface FieldIssue {
  field: DpiField;
  code: IssueCode;
}

export class InvalidPointerPathError extends Error {
  readonly code = 'invalid_pointer_path' as const;

  constructor(message: string) {
    super(message);
    this.name = 'InvalidPointerPathError';
  }
}

export interface PointerPoint {
  x: number;
  y: number;
}

const NUMERIC = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

export function toInches(distance: number, unit: DistanceUnit): number {
  if (typeof distance !== 'number' || !Number.isFinite(distance)) {
    throw new Error('Distance must be a finite number.');
  }
  if (unit === 'in') return distance;
  if (unit === 'cm') return distance / CM_PER_INCH;
  if (unit === 'mm') return distance / MM_PER_INCH;
  throw new Error('Unit must be inches, centimeters, or millimeters.');
}

/** Sum of straight segments between pointer positions, in CSS pixels. An empty path is 0. */
export function pointerPathPixels(points: readonly PointerPoint[]): number {
  if (!Array.isArray(points)) {
    throw new InvalidPointerPathError('Pointer path must be an array.');
  }
  for (const point of points) {
    if (
      point === null
      || typeof point !== 'object'
      || typeof point.x !== 'number'
      || typeof point.y !== 'number'
      || !Number.isFinite(point.x)
      || !Number.isFinite(point.y)
    ) {
      throw new InvalidPointerPathError('Pointer positions must be finite numbers.');
    }
  }
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    total += Math.hypot(current.x - previous.x, current.y - previous.y);
  }
  return total;
}

function blank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function parsePositive(value: unknown, field: DpiField): { ok: true; value: number } | { ok: false; issue: FieldIssue } {
  if (blank(value)) return { ok: false, issue: { field, code: 'missing' } };

  let numeric: number;
  if (typeof value === 'number') {
    numeric = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^[+-]?infinity$/i.test(trimmed) || /^nan$/i.test(trimmed)) {
      return { ok: false, issue: { field, code: 'non_finite' } };
    }
    if (!NUMERIC.test(trimmed)) return { ok: false, issue: { field, code: 'non_numeric' } };
    numeric = Number(trimmed);
  } else {
    return { ok: false, issue: { field, code: 'non_numeric' } };
  }

  if (!Number.isFinite(numeric)) return { ok: false, issue: { field, code: 'non_finite' } };
  if (numeric < 0) return { ok: false, issue: { field, code: 'negative' } };
  if (numeric === 0) return { ok: false, issue: { field, code: 'zero' } };
  return { ok: true, value: numeric };
}

function parseUnit(value: unknown): { ok: true; unit: DistanceUnit } | { ok: false; issue: FieldIssue } {
  if (blank(value)) return { ok: false, issue: { field: 'unit', code: 'missing' } };
  if (value === 'in' || value === 'cm' || value === 'mm') return { ok: true, unit: value };
  return { ok: false, issue: { field: 'unit', code: 'invalid_unit' } };
}

export interface EffectiveDpiOk {
  status: 'ok';
  effectiveDpi: number;
  inches: number;
  pixels: number;
  formula: 'pixels_divided_by_inches';
}

export interface EffectiveDpiError {
  status: 'error';
  issues: FieldIssue[];
}

export function calculateEffectiveDpi(input: {
  physicalDistance: unknown;
  unit: unknown;
  pixelTravel: unknown;
}): EffectiveDpiOk | EffectiveDpiError {
  const distance = parsePositive(input.physicalDistance, 'physicalDistance');
  const pixels = parsePositive(input.pixelTravel, 'pixelTravel');
  const unit = parseUnit(input.unit);
  const issues: FieldIssue[] = [];
  if (!distance.ok) issues.push(distance.issue);
  if (!unit.ok) issues.push(unit.issue);
  if (!pixels.ok) issues.push(pixels.issue);
  if (!distance.ok || !unit.ok || !pixels.ok) return { status: 'error', issues };

  const inches = toInches(distance.value, unit.unit);
  return {
    status: 'ok',
    effectiveDpi: pixels.value / inches,
    inches,
    pixels: pixels.value,
    formula: 'pixels_divided_by_inches',
  };
}

export type EdpiOmitReason = 'not_supplied' | 'dpi_only' | 'sensitivity_only';

export interface EdpiOk {
  status: 'ok';
  dpi: number;
  sensitivity: number;
  edpi: number;
  formula: 'dpi_times_sensitivity';
}

export interface EdpiOmitted {
  status: 'omitted';
  reason: EdpiOmitReason;
}

export interface EdpiError {
  status: 'error';
  issues: FieldIssue[];
}

export function calculateEdpi(input: { dpi: unknown; sensitivity: unknown }): EdpiOk | EdpiOmitted | EdpiError {
  const dpiBlank = blank(input.dpi);
  const sensitivityBlank = blank(input.sensitivity);
  if (dpiBlank && sensitivityBlank) return { status: 'omitted', reason: 'not_supplied' };

  if (dpiBlank) {
    const sensitivity = parsePositive(input.sensitivity, 'sensitivity');
    if (!sensitivity.ok) return { status: 'error', issues: [sensitivity.issue] };
    return { status: 'omitted', reason: 'sensitivity_only' };
  }

  if (sensitivityBlank) {
    const dpi = parsePositive(input.dpi, 'dpi');
    if (!dpi.ok) return { status: 'error', issues: [dpi.issue] };
    return { status: 'omitted', reason: 'dpi_only' };
  }

  const dpi = parsePositive(input.dpi, 'dpi');
  const sensitivity = parsePositive(input.sensitivity, 'sensitivity');
  const issues: FieldIssue[] = [];
  if (!dpi.ok) issues.push(dpi.issue);
  if (!sensitivity.ok) issues.push(sensitivity.issue);
  if (!dpi.ok || !sensitivity.ok) return { status: 'error', issues };

  return {
    status: 'ok',
    dpi: dpi.value,
    sensitivity: sensitivity.value,
    edpi: dpi.value * sensitivity.value,
    formula: 'dpi_times_sensitivity',
  };
}

/** Display a positive finite DPI without turning a tiny positive value into 0. */
export function formatDpi(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('A DPI figure must be a positive finite number.');
  }
  const abs = Math.abs(value);
  if (abs < 0.01 || abs >= 1_000_000) return value.toPrecision(6);
  const rounded = Math.round(value * 100) / 100;
  if (rounded === 0) return value.toPrecision(6);
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0$/, '');
}

export function formatInches(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('Inches must be a positive finite number.');
  }
  const rounded = Math.round(value * 10000) / 10000;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

/** Round path length to 0.01 CSS pixel for the text field. A length that rounds to 0 stays "0". */
export function formatTravelPixels(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new InvalidPointerPathError('Path length must be a non-negative finite number.');
  }
  const rounded = Math.round(value * 100) / 100;
  if (rounded === 0) return '0';
  return formatDpi(rounded);
}
