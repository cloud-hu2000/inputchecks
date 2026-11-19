import { describe, expect, it } from 'vitest';
import {
  FIXED_STROKE_PX,
  MAX_PRESSURE_STROKE_PX,
  MIN_PRESSURE_STROKE_PX,
  MISSING_LABEL,
  WAITING_LABEL,
  formatAzimuth,
  formatButtonReadout,
  formatPointerType,
  formatPressure,
  formatQuantity,
  formatStatus,
  formatTilt,
  pressureStrokeNote,
  readStylusSample,
  strokeWidthPx,
  tiltMarker,
  tiltMarkerNote,
  tiltMarkerPercent,
} from './reading';

const pen = {
  pointerType: 'pen',
  pressure: 0.72,
  tiltX: 15,
  tiltY: -10,
  azimuthAngle: Math.PI / 6,
  buttons: 1,
  button: 0,
};

describe('stylus pointer reading', () => {
  it('shows the pointer fields a pen event actually carried', () => {
    const reading = readStylusSample(pen);
    expect(formatPointerType(reading.pointerType)).toBe('pen');
    expect(formatPressure(reading.pressure)).toBe('0.72');
    expect(formatTilt(reading.tiltX)).toBe('15°');
    expect(formatTilt(reading.tiltY)).toBe('-10°');
    expect(formatAzimuth(reading.azimuth)).toBe('0.5236 rad (30°)');
    expect(formatButtonReadout(reading.buttons, reading.button)).toBe('1 (contact); button 0 (contact)');
    expect(formatStatus(7, 1, reading)).toBe(
      'Pointer id 7. Active pointers: 1. Pointer type pen. Pressure 0.72. Tilt X 15°. Tilt Y -10°. Azimuth 0.5236 rad (30°). Buttons 1 (contact); button 0 (contact).',
    );
  });

  it('keeps specification defaults as numbers instead of calling them missing', () => {
    const reading = readStylusSample({
      pointerType: 'mouse',
      pressure: 0.5,
      tiltX: 0,
      tiltY: 0,
      azimuthAngle: 0,
      buttons: 1,
      button: 0,
    });
    expect(formatPointerType(reading.pointerType)).toBe('mouse');
    expect(formatPressure(reading.pressure)).toBe('0.5');
    expect(formatTilt(reading.tiltX)).toBe('0°');
    expect(formatTilt(reading.tiltY)).toBe('0°');
    expect(formatAzimuth(reading.azimuth)).toBe('0 rad (0°)');
    expect(reading.pressure).toEqual({ status: 'value', value: 0.5 });
  });

  it('marks absent, blank, and non-finite fields as not provided', () => {
    const reading = readStylusSample({
      pointerType: '   ',
      pressure: Number.NaN,
      tiltX: undefined,
      tiltY: Number.POSITIVE_INFINITY,
      azimuthAngle: undefined,
      buttons: undefined,
      button: undefined,
    });
    expect(formatPointerType(reading.pointerType)).toBe(MISSING_LABEL);
    expect(formatPressure(reading.pressure)).toBe(MISSING_LABEL);
    expect(formatTilt(reading.tiltX)).toBe(MISSING_LABEL);
    expect(formatTilt(reading.tiltY)).toBe(MISSING_LABEL);
    expect(formatAzimuth(reading.azimuth)).toBe(MISSING_LABEL);
    expect(formatButtonReadout(reading.buttons, reading.button)).toBe(MISSING_LABEL);
    expect(WAITING_LABEL).toBe('No pointer event yet');
  });

  it('shows a vendor pointer type unchanged and still shows a partial event', () => {
    const reading = readStylusSample({ pointerType: ' example-pen ', pressure: 0.25, button: -1 });
    expect(formatPointerType(reading.pointerType)).toBe(' example-pen ');
    expect(formatPressure(reading.pressure)).toBe('0.25');
    expect(formatTilt(reading.tiltX)).toBe(MISSING_LABEL);
    expect(formatAzimuth(reading.azimuth)).toBe(MISSING_LABEL);
    expect(formatButtonReadout(reading.buttons, reading.button)).toBe(`${MISSING_LABEL}; button -1 (no change)`);
  });

  it('decodes button bits without inventing a name for unknown bits', () => {
    expect(formatButtonReadout({ status: 'value', value: 0 }, { status: 'missing' })).toBe('0 (no bits set)');
    expect(formatButtonReadout({ status: 'value', value: 33 }, { status: 'value', value: 5 })).toBe(
      '33 (contact, eraser); button 5 (eraser)',
    );
    expect(formatButtonReadout({ status: 'value', value: 6 }, { status: 'value', value: 2 })).toBe(
      '6 (secondary, middle); button 2 (secondary)',
    );
    expect(formatButtonReadout({ status: 'value', value: 64 }, { status: 'value', value: 9 })).toBe(
      '64 (other bits); button 9',
    );
    expect(formatButtonReadout({ status: 'value', value: 1.5 }, { status: 'value', value: 1.25 })).toBe(
      '1.5; button 1.25',
    );
    expect(formatButtonReadout({ status: 'value', value: -2 }, { status: 'missing' })).toBe('-2');
  });

  it('uses pressure for stroke width only inside 0 to 1', () => {
    expect(strokeWidthPx({ status: 'missing' })).toEqual({ px: FIXED_STROKE_PX, usesPressure: false });
    expect(strokeWidthPx({ status: 'value', value: 0 })).toEqual({ px: MIN_PRESSURE_STROKE_PX, usesPressure: true });
    expect(strokeWidthPx({ status: 'value', value: 1 })).toEqual({ px: MAX_PRESSURE_STROKE_PX, usesPressure: true });
    expect(strokeWidthPx({ status: 'value', value: 0.5 })).toEqual({ px: 8.5, usesPressure: true });
    expect(strokeWidthPx({ status: 'value', value: 1.2 })).toEqual({ px: FIXED_STROKE_PX, usesPressure: false });
    expect(strokeWidthPx({ status: 'value', value: -0.1 })).toEqual({ px: FIXED_STROKE_PX, usesPressure: false });
    expect(pressureStrokeNote(null)).toMatch(/stays fixed/i);
    expect(pressureStrokeNote({ status: 'missing' })).toMatch(/not provided/i);
    expect(pressureStrokeNote({ status: 'value', value: 1.4 })).toMatch(/outside 0–1/i);
    expect(pressureStrokeNote({ status: 'value', value: 0.2 })).toMatch(/follows the pressure/i);
  });

  it('plots tilt only when both angles are numbers and clamps the dot at 90 degrees', () => {
    const straight = tiltMarker({ status: 'value', value: 0 }, { status: 'value', value: 0 });
    expect(straight).toEqual({ shown: true, x: 0, y: 0 });
    expect(tiltMarkerPercent(straight)).toEqual({ left: '50%', top: '50%' });

    const leaned = tiltMarker({ status: 'value', value: 90 }, { status: 'value', value: -90 });
    expect(leaned).toEqual({ shown: true, x: 1, y: -1 });
    expect(tiltMarkerPercent(leaned)).toEqual({ left: '100%', top: '0%' });

    const pastRange = tiltMarker({ status: 'value', value: 180 }, { status: 'value', value: -180 });
    expect(pastRange).toEqual({ shown: true, x: 1, y: -1 });
    expect(formatTilt({ status: 'value', value: 180 })).toBe('180°');

    expect(tiltMarker({ status: 'missing' }, { status: 'value', value: 10 }).shown).toBe(false);
    expect(tiltMarkerNote(null, null)).toMatch(/appears after/i);
    expect(tiltMarkerNote({ status: 'missing' }, { status: 'value', value: 1 })).toMatch(/not provided/i);
    expect(tiltMarkerNote({ status: 'value', value: 15 }, { status: 'value', value: -10 })).toMatch(/0°, 0°/);
  });

  it('formats quantities without changing the sign or inventing precision', () => {
    expect(formatQuantity(0)).toBe('0');
    expect(formatQuantity(-0)).toBe('0');
    expect(formatQuantity(-10.5)).toBe('-10.5');
    expect(formatQuantity(0.72)).toBe('0.72');
  });
});
