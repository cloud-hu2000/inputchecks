/** Browser-received touch contacts. Not a digitizer certification or a factory calibration. */

export const GRID_COLUMNS = 8;
export const GRID_ROWS = 6;

export interface SurfaceContact {
  identifier: number;
  /** CSS pixels relative to the top-left of the test surface. */
  x: number;
  y: number;
}

export interface ContactSnapshot {
  /** Active touch contacts, sorted by identifier. */
  active: SurfaceContact[];
  /** Peak count of active contacts stored in one sample. */
  maxSimultaneous: number;
  endedIdentifiers: number[];
  cancelledIdentifiers: number[];
  /** "column,row" cells that received an in-bounds touch. Sorted row-major. */
  hitCells: string[];
  rejectedCount: number;
  lastRejection: 'non-touch' | 'invalid-contact' | null;
}

export type TouchPhase = 'start' | 'move' | 'end' | 'cancel';

export interface TouchSample {
  phase: TouchPhase;
  /** Contacts the browser still lists as active after this event. */
  contacts: readonly SurfaceContact[];
  changedIdentifier?: number;
  /** Last position of the contact that ended or cancelled, when the browser still reports it. */
  changedPoint?: SurfaceContact;
  surfaceWidth: number;
  surfaceHeight: number;
}

export interface CapabilityInput {
  maxTouchPoints: number;
  observedPointerTypes?: readonly string[];
}

export type CapabilityReport =
  | { support: 'unsupported'; reason: 'no-touch-points' | 'mouse-only'; maxTouchPoints: number }
  | { support: 'reported'; reason: 'touch-points-reported'; maxTouchPoints: number };

export function createContactSnapshot(): ContactSnapshot {
  return {
    active: [],
    maxSimultaneous: 0,
    endedIdentifiers: [],
    cancelledIdentifiers: [],
    hitCells: [],
    rejectedCount: 0,
    lastRejection: null,
  };
}

function isValidContact(contact: SurfaceContact | undefined | null): contact is SurfaceContact {
  return !!contact
    && Number.isInteger(contact.identifier)
    && Number.isFinite(contact.x)
    && Number.isFinite(contact.y);
}

export function cellKeyForPoint(
  x: number,
  y: number,
  surfaceWidth: number,
  surfaceHeight: number,
  columns = GRID_COLUMNS,
  rows = GRID_ROWS,
): string | null {
  if (!(surfaceWidth > 0) || !(surfaceHeight > 0)) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || y < 0 || x >= surfaceWidth || y >= surfaceHeight) return null;
  const column = Math.min(columns - 1, Math.floor((x / surfaceWidth) * columns));
  const row = Math.min(rows - 1, Math.floor((y / surfaceHeight) * rows));
  return `${column},${row}`;
}

function sortCells(keys: Iterable<string>): string[] {
  return [...keys].sort((left, right) => {
    const [leftColumn, leftRow] = left.split(',').map(Number);
    const [rightColumn, rightRow] = right.split(',').map(Number);
    return leftRow - rightRow || leftColumn - rightColumn;
  });
}

function uniqueSorted(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function copySnapshot(state: ContactSnapshot, patch: Partial<ContactSnapshot>): ContactSnapshot {
  return {
    active: (patch.active ?? state.active).map((contact) => ({ ...contact })),
    maxSimultaneous: patch.maxSimultaneous ?? state.maxSimultaneous,
    endedIdentifiers: [...(patch.endedIdentifiers ?? state.endedIdentifiers)],
    cancelledIdentifiers: [...(patch.cancelledIdentifiers ?? state.cancelledIdentifiers)],
    hitCells: [...(patch.hitCells ?? state.hitCells)],
    rejectedCount: patch.rejectedCount ?? state.rejectedCount,
    lastRejection: patch.lastRejection === undefined ? state.lastRejection : patch.lastRejection,
  };
}

function reject(state: ContactSnapshot, reason: 'non-touch' | 'invalid-contact'): ContactSnapshot {
  return copySnapshot(state, {
    rejectedCount: state.rejectedCount + 1,
    lastRejection: reason,
  });
}

/** Mouse, pen, and other non-touch pointers are classified and are not stored as contacts. */
export function rejectNonTouchPointer(state: ContactSnapshot): ContactSnapshot {
  return reject(state, 'non-touch');
}

export function classifyTouchCapability(input: CapabilityInput): CapabilityReport {
  const maxTouchPoints = typeof input.maxTouchPoints === 'number' && Number.isFinite(input.maxTouchPoints)
    ? Math.max(0, Math.trunc(input.maxTouchPoints))
    : 0;
  const observed = (input.observedPointerTypes ?? []).filter((item): item is string => typeof item === 'string');
  const sawOnlyNonTouch = observed.length > 0 && observed.every((item) => item !== 'touch');

  if (maxTouchPoints === 0) {
    return {
      support: 'unsupported',
      reason: sawOnlyNonTouch ? 'mouse-only' : 'no-touch-points',
      maxTouchPoints,
    };
  }
  if (sawOnlyNonTouch) {
    return { support: 'unsupported', reason: 'mouse-only', maxTouchPoints };
  }
  return { support: 'reported', reason: 'touch-points-reported', maxTouchPoints };
}

/**
 * Store one browser touch sample.
 * The same contacts always produce the same active list, identifiers, and coordinates.
 * Invalid coordinates, duplicate identifiers, and non-finite geometry are rejected and do not change the active contacts.
 */
export function applyTouchSample(state: ContactSnapshot, sample: TouchSample | null | undefined): ContactSnapshot {
  if (!sample || !Array.isArray(sample.contacts)) return reject(state, 'invalid-contact');
  if (sample.contacts.some((contact) => !isValidContact(contact))) return reject(state, 'invalid-contact');
  const identifiers = sample.contacts.map((contact) => contact.identifier);
  if (new Set(identifiers).size !== identifiers.length) return reject(state, 'invalid-contact');
  if (sample.changedIdentifier !== undefined && !Number.isInteger(sample.changedIdentifier)) {
    return reject(state, 'invalid-contact');
  }
  if (!Number.isFinite(sample.surfaceWidth) || !Number.isFinite(sample.surfaceHeight)) {
    return reject(state, 'invalid-contact');
  }
  if (sample.changedPoint) {
    if (!isValidContact(sample.changedPoint)) return reject(state, 'invalid-contact');
    if (sample.changedIdentifier !== undefined && sample.changedPoint.identifier !== sample.changedIdentifier) {
      return reject(state, 'invalid-contact');
    }
  }

  const active = sample.contacts
    .map((contact) => ({ identifier: contact.identifier, x: contact.x, y: contact.y }))
    .sort((left, right) => left.identifier - right.identifier);

  const previousIds = new Set(state.active.map((contact) => contact.identifier));
  const nextIds = new Set(active.map((contact) => contact.identifier));
  let endedIdentifiers = state.endedIdentifiers;
  let cancelledIdentifiers = state.cancelledIdentifiers;
  if (sample.phase === 'end' || sample.phase === 'cancel') {
    const departed = sample.changedIdentifier !== undefined
      ? [sample.changedIdentifier]
      : [...previousIds].filter((identifier) => !nextIds.has(identifier));
    if (sample.phase === 'end') endedIdentifiers = uniqueSorted([...endedIdentifiers, ...departed]);
    else cancelledIdentifiers = uniqueSorted([...cancelledIdentifiers, ...departed]);
  }

  const hit = new Set(state.hitCells);
  const mark = (contact: SurfaceContact) => {
    const key = cellKeyForPoint(contact.x, contact.y, sample.surfaceWidth, sample.surfaceHeight);
    if (key) hit.add(key);
  };
  for (const contact of active) mark(contact);
  if (sample.changedPoint) mark(sample.changedPoint);

  return copySnapshot(state, {
    active,
    maxSimultaneous: Math.max(state.maxSimultaneous, active.length),
    endedIdentifiers,
    cancelledIdentifiers,
    hitCells: sortCells(hit),
    lastRejection: null,
  });
}

/** Cells with no stored touch while at least one other cell was hit. An empty session lists none. */
export function unhitCellKeys(state: ContactSnapshot, columns = GRID_COLUMNS, rows = GRID_ROWS): string[] {
  if (state.hitCells.length === 0) return [];
  const hit = new Set(state.hitCells);
  const missing: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const key = `${column},${row}`;
      if (!hit.has(key)) missing.push(key);
    }
  }
  return missing;
}
