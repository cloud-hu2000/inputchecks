import { describe, expect, it } from 'vitest';
import {
  GRID_COLUMNS,
  GRID_ROWS,
  applyTouchSample,
  cellKeyForPoint,
  classifyTouchCapability,
  createContactSnapshot,
  rejectNonTouchPointer,
  unhitCellKeys,
  type ContactSnapshot,
  type SurfaceContact,
  type TouchSample,
} from './contacts';

const surface = { surfaceWidth: 800, surfaceHeight: 600 };

function point(identifier: number, x: number, y: number): SurfaceContact {
  return { identifier, x, y };
}

function sample(overrides: Partial<TouchSample> & Pick<TouchSample, 'phase' | 'contacts'>): TouchSample {
  return { ...surface, ...overrides };
}

function apply(state: ContactSnapshot, overrides: Partial<TouchSample> & Pick<TouchSample, 'phase' | 'contacts'>): ContactSnapshot {
  return applyTouchSample(state, sample(overrides));
}

describe('touch contact session', () => {
  it('stores several simultaneous contacts with identifiers and coordinates in identifier order', () => {
    const contacts = [point(10, 40.25, 12.5), point(2, 100, 80), point(7, 300.5, 200)];
    const result = apply(createContactSnapshot(), { phase: 'start', contacts });
    expect(result.active).toEqual([
      point(2, 100, 80),
      point(7, 300.5, 200),
      point(10, 40.25, 12.5),
    ]);
    expect(result.maxSimultaneous).toBe(3);
    expect(result.lastRejection).toBeNull();
    expect(result.rejectedCount).toBe(0);
  });

  it('keeps an empty sample at zero contacts', () => {
    const result = apply(createContactSnapshot(), { phase: 'start', contacts: [] });
    expect(result.active).toEqual([]);
    expect(result.maxSimultaneous).toBe(0);
    expect(result.endedIdentifiers).toEqual([]);
    expect(result.cancelledIdentifiers).toEqual([]);
    expect(unhitCellKeys(result)).toEqual([]);
  });

  it('stores a single contact', () => {
    const result = apply(createContactSnapshot(), { phase: 'start', contacts: [point(4, 12, 18)] });
    expect(result.active).toEqual([point(4, 12, 18)]);
    expect(result.maxSimultaneous).toBe(1);
    expect(result.hitCells).toEqual(['0,0']);
  });

  it('stores a large contact list and keeps the peak when contacts leave', () => {
    let state = createContactSnapshot();
    const many = Array.from({ length: 12 }, (_, index) => point(index + 1, 20 + index * 30, 40));
    state = apply(state, { phase: 'start', contacts: many });
    expect(state.active).toHaveLength(12);
    expect(state.active.map((contact) => contact.identifier)).toEqual(many.map((contact) => contact.identifier));
    expect(state.maxSimultaneous).toBe(12);

    state = apply(state, {
      phase: 'end',
      contacts: [point(3, 80, 40)],
      changedIdentifier: 1,
      changedPoint: point(1, 20, 40),
    });
    expect(state.active).toEqual([point(3, 80, 40)]);
    expect(state.maxSimultaneous).toBe(12);
    expect(state.endedIdentifiers).toEqual([1]);
  });

  it('removes an ended contact and keeps the earlier peak', () => {
    let state = apply(createContactSnapshot(), {
      phase: 'start',
      contacts: [point(1, 30, 40), point(8, 120, 90), point(5, 400, 300)],
    });
    expect(state.maxSimultaneous).toBe(3);
    state = apply(state, {
      phase: 'end',
      contacts: [point(5, 400, 300), point(8, 120, 90)],
      changedIdentifier: 1,
      changedPoint: point(1, 30, 40),
    });
    expect(state.active.map((contact) => contact.identifier)).toEqual([5, 8]);
    expect(state.maxSimultaneous).toBe(3);
    expect(state.endedIdentifiers).toEqual([1]);
    expect(state.cancelledIdentifiers).toEqual([]);
    expect(state.hitCells).toContain('0,0');
  });

  it('marks a cancelled contact and removes it from the active list', () => {
    let state = apply(createContactSnapshot(), {
      phase: 'start',
      contacts: [point(2, 50, 50), point(9, 500, 100)],
    });
    state = apply(state, {
      phase: 'cancel',
      contacts: [point(9, 510, 110)],
      changedIdentifier: 2,
      changedPoint: point(2, 50, 50),
    });
    expect(state.active).toEqual([point(9, 510, 110)]);
    expect(state.cancelledIdentifiers).toEqual([2]);
    expect(state.endedIdentifiers).toEqual([]);
    expect(state.maxSimultaneous).toBe(2);
  });

  it('marks ended identifiers when the remaining list is the only signal', () => {
    let state = apply(createContactSnapshot(), {
      phase: 'start',
      contacts: [point(1, 10, 10), point(2, 200, 10)],
    });
    state = apply(state, { phase: 'end', contacts: [point(2, 200, 10)] });
    expect(state.active.map((contact) => contact.identifier)).toEqual([2]);
    expect(state.endedIdentifiers).toEqual([1]);
    expect(state.maxSimultaneous).toBe(2);
  });

  it('does not list unhit regions until one cell has been hit', () => {
    const empty = createContactSnapshot();
    expect(unhitCellKeys(empty)).toEqual([]);
    const outside = apply(empty, { phase: 'start', contacts: [point(1, -4, 10)] });
    expect(outside.active).toEqual([point(1, -4, 10)]);
    expect(outside.hitCells).toEqual([]);
    expect(unhitCellKeys(outside)).toEqual([]);
  });

  it('lists the cells that received no in-bounds touch after another cell was hit', () => {
    const state = apply(createContactSnapshot(), { phase: 'move', contacts: [point(3, 10, 10)] });
    const missing = unhitCellKeys(state);
    expect(state.hitCells).toEqual(['0,0']);
    expect(missing).toHaveLength(GRID_COLUMNS * GRID_ROWS - 1);
    expect(missing).not.toContain('0,0');
    expect(missing[0]).toBe('1,0');
  });

  it('rejects missing or non-finite coordinates without storing them as contacts', () => {
    const before = apply(createContactSnapshot(), { phase: 'start', contacts: [point(6, 15, 15)] });
    const missing = applyTouchSample(before, sample({
      phase: 'move',
      contacts: [{ identifier: 6, x: undefined as unknown as number, y: 15 }],
    }));
    expect(missing.active).toEqual(before.active);
    expect(missing.maxSimultaneous).toBe(1);
    expect(missing.rejectedCount).toBe(1);
    expect(missing.lastRejection).toBe('invalid-contact');
    expect(before.rejectedCount).toBe(0);

    const nan = applyTouchSample(before, sample({
      phase: 'move',
      contacts: [point(6, Number.NaN, 15)],
    }));
    expect(nan.active).toEqual([point(6, 15, 15)]);
    expect(nan.maxSimultaneous).toBe(1);
    expect(nan.lastRejection).toBe('invalid-contact');
  });

  it('rejects duplicate identifiers and a non-array sample', () => {
    const before = createContactSnapshot();
    const duplicate = apply(before, {
      phase: 'start',
      contacts: [point(1, 10, 10), point(1, 20, 20)],
    });
    expect(duplicate.active).toEqual([]);
    expect(duplicate.maxSimultaneous).toBe(0);
    expect(duplicate.lastRejection).toBe('invalid-contact');
    expect(applyTouchSample(before, undefined).lastRejection).toBe('invalid-contact');
    expect(applyTouchSample(before, { phase: 'start', contacts: null as unknown as SurfaceContact[], ...surface }).active).toEqual([]);
  });

  it('rejects a changed point that does not match the changed identifier', () => {
    const before = apply(createContactSnapshot(), { phase: 'start', contacts: [point(1, 10, 10)] });
    const result = apply(before, {
      phase: 'end',
      contacts: [],
      changedIdentifier: 1,
      changedPoint: point(2, 10, 10),
    });
    expect(result.active).toEqual(before.active);
    expect(result.endedIdentifiers).toEqual([]);
    expect(result.lastRejection).toBe('invalid-contact');
  });

  it('does not treat a non-touch pointer as a multi-touch contact', () => {
    const before = apply(createContactSnapshot(), { phase: 'start', contacts: [point(4, 25, 25)] });
    const mouse = rejectNonTouchPointer(before);
    expect(mouse.active).toEqual(before.active);
    expect(mouse.maxSimultaneous).toBe(1);
    expect(mouse.rejectedCount).toBe(1);
    expect(mouse.lastRejection).toBe('non-touch');
    expect(before.rejectedCount).toBe(0);

    const onlyMouse = rejectNonTouchPointer(createContactSnapshot());
    expect(onlyMouse.active).toEqual([]);
    expect(onlyMouse.maxSimultaneous).toBe(0);
    expect(onlyMouse.lastRejection).toBe('non-touch');
  });

  it('classifies a browser with no touch points, and mouse-only pointers, as unsupported', () => {
    expect(classifyTouchCapability({ maxTouchPoints: 0 })).toEqual({
      support: 'unsupported',
      reason: 'no-touch-points',
      maxTouchPoints: 0,
    });
    expect(classifyTouchCapability({ maxTouchPoints: 0, observedPointerTypes: ['mouse'] })).toEqual({
      support: 'unsupported',
      reason: 'mouse-only',
      maxTouchPoints: 0,
    });
    expect(classifyTouchCapability({ maxTouchPoints: 5, observedPointerTypes: ['mouse', 'pen'] })).toEqual({
      support: 'unsupported',
      reason: 'mouse-only',
      maxTouchPoints: 5,
    });
    expect(classifyTouchCapability({ maxTouchPoints: Number.NaN })).toMatchObject({
      support: 'unsupported',
      maxTouchPoints: 0,
    });
  });

  it('reports a positive maxTouchPoints value without turning it into stored contacts', () => {
    const capability = classifyTouchCapability({ maxTouchPoints: 5 });
    expect(capability).toEqual({
      support: 'reported',
      reason: 'touch-points-reported',
      maxTouchPoints: 5,
    });
    const state = createContactSnapshot();
    expect(state.active).toEqual([]);
    expect(state.maxSimultaneous).toBe(0);
  });

  it('maps surface edges into the grid and leaves the far edge outside', () => {
    expect(cellKeyForPoint(0, 0, 800, 600)).toBe('0,0');
    expect(cellKeyForPoint(100, 0, 800, 600)).toBe('1,0');
    expect(cellKeyForPoint(799.9, 599.9, 800, 600)).toBe(`${GRID_COLUMNS - 1},${GRID_ROWS - 1}`);
    expect(cellKeyForPoint(800, 10, 800, 600)).toBeNull();
    expect(cellKeyForPoint(10, 600, 800, 600)).toBeNull();
    expect(cellKeyForPoint(10, 10, 0, 600)).toBeNull();
  });
});
