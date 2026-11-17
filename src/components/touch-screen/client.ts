import {
  GRID_COLUMNS,
  GRID_ROWS,
  applyTouchSample,
  classifyTouchCapability,
  createContactSnapshot,
  rejectNonTouchPointer,
  unhitCellKeys,
  type ContactSnapshot,
  type SurfaceContact,
  type TouchPhase,
} from './contacts';

const root = document.querySelector<HTMLElement>('[data-touch-tester]');

if (root) {
  const surface = root.querySelector<HTMLElement>('[data-touch-surface]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-touch-reset]');
  const statusEl = root.querySelector<HTMLElement>('[data-touch-status]');
  const capabilityEl = root.querySelector<HTMLElement>('[data-touch-capability]');
  const listEl = root.querySelector<HTMLElement>('[data-touch-list]');
  const markers = root.querySelector<HTMLElement>('[data-touch-markers]');

  if (surface && resetButton && statusEl && capabilityEl && listEl && markers) {
    let snapshot: ContactSnapshot = createContactSnapshot();
    const observedPointerTypes: string[] = [];
    const supportsTouchEvent = typeof TouchEvent !== 'undefined';
    const pointerContacts = new Map<number, SurfaceContact>();

    const setText = (name: string, value: string) => {
      const el = root.querySelector<HTMLElement>(`[data-touch-${name}]`);
      if (el) el.textContent = value;
    };

    const rememberPointer = (pointerType: string) => {
      if (!observedPointerTypes.includes(pointerType)) observedPointerTypes.push(pointerType);
    };

    const capabilityCopy = () => {
      const report = classifyTouchCapability({
        maxTouchPoints: navigator.maxTouchPoints ?? 0,
        observedPointerTypes,
      });
      if (report.support === 'unsupported' && report.reason === 'mouse-only') {
        return `This browser reports maxTouchPoints ${report.maxTouchPoints}. Only mouse, pen, or hover-only pointers have been seen, so a real multi-touch hardware check is unsupported.`;
      }
      if (report.support === 'unsupported') {
        return `This browser reports maxTouchPoints ${report.maxTouchPoints}. A real multi-touch hardware check is unsupported. Mouse and hover-only pointers are not counted as touch contacts.`;
      }
      return `This browser reports maxTouchPoints ${report.maxTouchPoints}. Only touch events that arrive are listed. This is not a hardware certification.`;
    };

    const render = () => {
      const rect = surface.getBoundingClientRect();
      setText('current', String(snapshot.active.length));
      setText('max', String(snapshot.maxSimultaneous));
      setText('hit', String(snapshot.hitCells.length));
      const missing = unhitCellKeys(snapshot);
      setText('unhit-count', snapshot.hitCells.length === 0 ? '—' : String(missing.length));
      const unhitEl = root.querySelector<HTMLElement>('[data-touch-unhit]');
      if (unhitEl) {
        unhitEl.textContent = snapshot.hitCells.length === 0
          ? 'No in-bounds touch has been stored yet, so unhit regions are not listed.'
          : `${missing.length} of ${GRID_COLUMNS * GRID_ROWS} regions received no touch event in this browser session. That is an unhit area of this test surface, not a diagnosis of a broken panel.`;
      }
      listEl.textContent = snapshot.active.length === 0
        ? 'No active touch contacts.'
        : snapshot.active.map((contact) => `Identifier ${contact.identifier} at ${contact.x.toFixed(1)}, ${contact.y.toFixed(1)}.`).join(' ');
      capabilityEl.textContent = capabilityCopy();

      root.querySelectorAll<HTMLElement>('[data-cell]').forEach((cell) => {
        const key = cell.dataset.cell ?? '';
        const hit = snapshot.hitCells.includes(key);
        cell.classList.toggle('is-hit', hit);
        cell.classList.toggle('is-unhit', snapshot.hitCells.length > 0 && !hit);
      });

      markers.replaceChildren();
      if (rect.width > 0 && rect.height > 0) {
        for (const contact of snapshot.active) {
          const dot = document.createElement('span');
          dot.className = 'touch-dot';
          dot.style.left = `${(contact.x / rect.width) * 100}%`;
          dot.style.top = `${(contact.y / rect.height) * 100}%`;
          dot.textContent = String(contact.identifier);
          dot.setAttribute('aria-hidden', 'true');
          markers.appendChild(dot);
        }
      }

      if (snapshot.lastRejection === 'non-touch') {
        statusEl.textContent = 'A non-touch pointer reached the surface. It is not counted as a touch contact and is not a multi-touch result.';
        return;
      }
      if (snapshot.lastRejection === 'invalid-contact') {
        statusEl.textContent = 'The latest sample had missing or invalid coordinates, so it was not stored as a touch contact.';
        return;
      }
      if (snapshot.active.length === 0 && snapshot.maxSimultaneous === 0) {
        statusEl.textContent = 'Place one or more fingers on the test surface. Contacts appear only when this browser delivers touch events.';
        return;
      }
      const noun = snapshot.active.length === 1 ? 'contact' : 'contacts';
      const hardware = classifyTouchCapability({
        maxTouchPoints: navigator.maxTouchPoints ?? 0,
        observedPointerTypes,
      }).support === 'unsupported'
        ? ' A real multi-touch hardware check is unsupported in this browser.'
        : ' This is not a hardware certification.';
      statusEl.textContent = `Showing ${snapshot.active.length} active ${noun} from events this page received.${hardware}`;
    };

    const pointFromTouch = (touch: Touch, rect: DOMRect): SurfaceContact => ({
      identifier: touch.identifier,
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    });

    const onTouch = (event: TouchEvent, phase: TouchPhase) => {
      rememberPointer('touch');
      const rect = surface.getBoundingClientRect();
      const contacts = [...event.touches].map((touch) => pointFromTouch(touch, rect));
      const changed = event.changedTouches[0];
      snapshot = applyTouchSample(snapshot, {
        phase,
        contacts,
        changedIdentifier: changed ? changed.identifier : undefined,
        changedPoint: changed ? pointFromTouch(changed, rect) : undefined,
        surfaceWidth: rect.width,
        surfaceHeight: rect.height,
      });
      if (event.cancelable && (phase === 'start' || phase === 'move')) event.preventDefault();
      render();
    };

    surface.addEventListener('touchstart', (event) => onTouch(event, 'start'), { passive: false });
    surface.addEventListener('touchmove', (event) => onTouch(event, 'move'), { passive: false });
    surface.addEventListener('touchend', (event) => onTouch(event, 'end'));
    surface.addEventListener('touchcancel', (event) => onTouch(event, 'cancel'));

    const onPointerTouch = (event: PointerEvent, phase: TouchPhase) => {
      if (event.pointerType !== 'touch' || supportsTouchEvent) return;
      rememberPointer('touch');
      const rect = surface.getBoundingClientRect();
      const point = {
        identifier: event.pointerId,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      if (phase === 'end' || phase === 'cancel') pointerContacts.delete(event.pointerId);
      else pointerContacts.set(event.pointerId, point);
      snapshot = applyTouchSample(snapshot, {
        phase,
        contacts: [...pointerContacts.values()],
        changedIdentifier: event.pointerId,
        changedPoint: point,
        surfaceWidth: rect.width,
        surfaceHeight: rect.height,
      });
      render();
    };

    surface.addEventListener('pointerdown', (event) => {
      rememberPointer(event.pointerType || 'mouse');
      if (event.pointerType === 'touch') {
        onPointerTouch(event, 'start');
        return;
      }
      snapshot = rejectNonTouchPointer(snapshot);
      render();
    });
    surface.addEventListener('pointermove', (event) => onPointerTouch(event, 'move'));
    surface.addEventListener('pointerup', (event) => onPointerTouch(event, 'end'));
    surface.addEventListener('pointercancel', (event) => onPointerTouch(event, 'cancel'));

    resetButton.addEventListener('click', () => {
      snapshot = createContactSnapshot();
      observedPointerTypes.length = 0;
      pointerContacts.clear();
      render();
    });

    render();
  }
}
