/**
 * Read pointerType, pressure, tilt, azimuth, and buttons from one pointer event.
 *
 * A field is "not provided" only when it is absent, blank (pointerType), or not a
 * finite number. Specification defaults such as pressure 0.5, tilt 0, and azimuth 0
 * are values the browser sent, so they are shown as numbers. This module does not
 * decide whether a number came from a sensor or from that default, and it does not
 * name devices or classify intentional contact.
 *
 * Button names follow the Pointer Events button and buttons tables:
 * https://www.w3.org/TR/pointerevents/#the-buttons-property
 */

export const MISSING_LABEL = 'Not provided';
export const WAITING_LABEL = 'No pointer event yet';
export const FIXED_STROKE_PX = 2;
export const MIN_PRESSURE_STROKE_PX = 1;
export const MAX_PRESSURE_STROKE_PX = 16;

export interface PresentField<T> {
  status: 'value';
  value: T;
}

export interface MissingField {
  status: 'missing';
}

export type Field<T> = PresentField<T> | MissingField;

export interface StylusEventFields {
  pointerType?: unknown;
  pressure?: unknown;
  tiltX?: unknown;
  tiltY?: unknown;
  azimuthAngle?: unknown;
  buttons?: unknown;
  button?: unknown;
}

export interface StylusReading {
  pointerType: Field<string>;
  pressure: Field<number>;
  tiltX: Field<number>;
  tiltY: Field<number>;
  azimuth: Field<number>;
  buttons: Field<number>;
  button: Field<number>;
}

export interface TiltMarker {
  shown: boolean;
  /** -1 is fully left or up, 1 is fully right or down. Only the marker is clamped. */
  x: number;
  y: number;
}

const BUTTON_BITS: ReadonlyArray<readonly [number, string]> = [
  [1, 'contact'],
  [2, 'secondary'],
  [4, 'middle'],
  [8, 'back'],
  [16, 'forward'],
  [32, 'eraser'],
];

const BUTTON_CHANGES: Readonly<Record<number, string>> = {
  [-1]: 'no change',
  0: 'contact',
  1: 'middle',
  2: 'secondary',
  3: 'back',
  4: 'forward',
  5: 'eraser',
};

const KNOWN_BUTTON_MASK = BUTTON_BITS.reduce((mask, [bit]) => mask | bit, 0);

function missing(): MissingField {
  return { status: 'missing' };
}

function present<T>(value: T): PresentField<T> {
  return { status: 'value', value };
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

export function readStylusSample(raw: StylusEventFields): StylusReading {
  const pointerType = typeof raw.pointerType === 'string' && raw.pointerType.trim() !== ''
    ? present(raw.pointerType)
    : missing();
  const pressure = finiteNumber(raw.pressure);
  const tiltX = finiteNumber(raw.tiltX);
  const tiltY = finiteNumber(raw.tiltY);
  const azimuth = finiteNumber(raw.azimuthAngle);
  const buttons = finiteNumber(raw.buttons);
  const button = finiteNumber(raw.button);
  return {
    pointerType,
    pressure: pressure === undefined ? missing() : present(pressure),
    tiltX: tiltX === undefined ? missing() : present(tiltX),
    tiltY: tiltY === undefined ? missing() : present(tiltY),
    azimuth: azimuth === undefined ? missing() : present(azimuth),
    buttons: buttons === undefined ? missing() : present(buttons),
    button: button === undefined ? missing() : present(button),
  };
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return MISSING_LABEL;
  const negative = Object.is(value, -0) ? false : value < 0;
  const abs = Math.abs(value);
  if (Number.isInteger(abs)) return `${negative ? '-' : ''}${abs}`;
  const text = abs.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return `${negative ? '-' : ''}${text}`;
}

export function formatPointerType(field: Field<string>): string {
  return field.status === 'value' ? field.value : MISSING_LABEL;
}

export function formatPressure(field: Field<number>): string {
  return field.status === 'value' ? formatQuantity(field.value) : MISSING_LABEL;
}

export function formatTilt(field: Field<number>): string {
  return field.status === 'value' ? `${formatQuantity(field.value)}°` : MISSING_LABEL;
}

export function formatAzimuth(field: Field<number>): string {
  if (field.status !== 'value') return MISSING_LABEL;
  const degrees = field.value * (180 / Math.PI);
  return `${formatQuantity(field.value)} rad (${formatQuantity(degrees)}°)`;
}

export function formatButtonsValue(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) return formatQuantity(value);
  if (value === 0) return '0 (no bits set)';
  const labels: string[] = [];
  for (const [bit, label] of BUTTON_BITS) {
    if ((value & bit) !== 0) labels.push(label);
  }
  if ((value & ~KNOWN_BUTTON_MASK) !== 0) labels.push('other bits');
  return `${value} (${labels.join(', ')})`;
}

export function formatButtonChange(value: number): string {
  if (!Number.isSafeInteger(value)) return formatQuantity(value);
  const label = BUTTON_CHANGES[value];
  return label ? `${value} (${label})` : formatQuantity(value);
}

export function formatButtonReadout(buttons: Field<number>, button: Field<number>): string {
  if (buttons.status === 'missing' && button.status === 'missing') return MISSING_LABEL;
  const parts: string[] = [];
  parts.push(buttons.status === 'value' ? formatButtonsValue(buttons.value) : MISSING_LABEL);
  if (button.status === 'value') parts.push(`button ${formatButtonChange(button.value)}`);
  return parts.join('; ');
}

export function strokeWidthPx(pressure: Field<number>): { px: number; usesPressure: boolean } {
  if (pressure.status !== 'value' || pressure.value < 0 || pressure.value > 1) {
    return { px: FIXED_STROKE_PX, usesPressure: false };
  }
  const span = MAX_PRESSURE_STROKE_PX - MIN_PRESSURE_STROKE_PX;
  return { px: MIN_PRESSURE_STROKE_PX + pressure.value * span, usesPressure: true };
}

export function pressureStrokeNote(pressure: Field<number> | null): string {
  if (pressure === null) return 'Stroke width stays fixed until a pointer event includes a pressure from 0 to 1.';
  if (pressure.status === 'missing') return 'Pressure was not provided, so the stroke width stays fixed.';
  if (pressure.value < 0 || pressure.value > 1) {
    return 'Pressure is outside 0–1, so the stroke width stays fixed. The number above is still the value this browser sent.';
  }
  return 'Stroke width follows the pressure value from this event.';
}

export function tiltMarker(tiltX: Field<number>, tiltY: Field<number>): TiltMarker {
  if (tiltX.status !== 'value' || tiltY.status !== 'value') return { shown: false, x: 0, y: 0 };
  const clamp = (degrees: number) => Math.min(1, Math.max(-1, degrees / 90));
  return { shown: true, x: clamp(tiltX.value), y: clamp(tiltY.value) };
}

export function tiltMarkerPercent(marker: TiltMarker): { left: string; top: string } | null {
  if (!marker.shown) return null;
  return {
    left: `${((marker.x + 1) / 2) * 100}%`,
    top: `${((marker.y + 1) / 2) * 100}%`,
  };
}

export function tiltMarkerNote(tiltX: Field<number> | null, tiltY: Field<number> | null): string {
  if (tiltX === null || tiltY === null) return 'The tilt marker appears after an event includes both tilt X and tilt Y.';
  if (tiltX.status !== 'value' || tiltY.status !== 'value') return 'The tilt marker is hidden because tilt X or tilt Y was not provided.';
  return 'The tilt marker plots the tilt X and tilt Y numbers from this event. Right is positive tilt X, down is positive tilt Y, and the center is 0°, 0°. The dot stops at 90° even if the number is larger.';
}

export function formatStatus(pointerId: number, activeCount: number, reading: StylusReading): string {
  const id = Number.isSafeInteger(pointerId) ? `Pointer id ${pointerId}.` : 'Pointer id was not a whole number.';
  const active = Number.isSafeInteger(activeCount) ? `Active pointers: ${activeCount}.` : 'Active pointers: not a whole number.';
  return [
    id,
    active,
    `Pointer type ${formatPointerType(reading.pointerType)}.`,
    `Pressure ${formatPressure(reading.pressure)}.`,
    `Tilt X ${formatTilt(reading.tiltX)}.`,
    `Tilt Y ${formatTilt(reading.tiltY)}.`,
    `Azimuth ${formatAzimuth(reading.azimuth)}.`,
    `Buttons ${formatButtonReadout(reading.buttons, reading.button)}.`,
  ].join(' ');
}
