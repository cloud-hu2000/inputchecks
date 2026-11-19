import {
  WAITING_LABEL,
  formatAzimuth,
  formatButtonReadout,
  formatPointerType,
  formatPressure,
  formatStatus,
  formatTilt,
  pressureStrokeNote,
  readStylusSample,
  strokeWidthPx,
  tiltMarker,
  tiltMarkerNote,
  tiltMarkerPercent,
  type StylusReading,
} from './reading';

const root = document.querySelector<HTMLElement>('[data-stylus-tester]');

if (root) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-stylus-surface]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-stylus-reset]');
  const statusEl = root.querySelector<HTMLElement>('[data-stylus-status]');
  const marker = root.querySelector<HTMLElement>('[data-stylus-tilt-marker]');

  if (canvas && resetButton && statusEl && marker) {
    const context = canvas.getContext('2d');
    const active = new Map<number, { x: number; y: number }>();
    const segments: Array<{ x1: number; y1: number; x2: number; y2: number; width: number }> = [];
    let latest: { pointerId: number; reading: StylusReading } | null = null;

    const setText = (name: string, value: string) => {
      const el = root.querySelector<HTMLElement>(`[data-stylus-${name}]`);
      if (el) el.textContent = value;
    };

    const cssPoint = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const redraw = () => {
      if (!context) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = '#176b67';
      context.fillStyle = '#176b67';
      for (const segment of segments) {
        context.beginPath();
        context.lineWidth = segment.width;
        if (segment.x1 === segment.x2 && segment.y1 === segment.y2) {
          context.arc(segment.x1, segment.y1, Math.max(segment.width / 2, 0.5), 0, Math.PI * 2);
          context.fill();
        } else {
          context.moveTo(segment.x1, segment.y1);
          context.lineTo(segment.x2, segment.y2);
          context.stroke();
        }
      }
    };

    const render = () => {
      if (!latest) {
        setText('pointer-type', WAITING_LABEL);
        setText('pressure', WAITING_LABEL);
        setText('tilt-x', WAITING_LABEL);
        setText('tilt-y', WAITING_LABEL);
        setText('azimuth', WAITING_LABEL);
        setText('buttons', WAITING_LABEL);
        setText('stroke', pressureStrokeNote(null));
        setText('tilt-note', tiltMarkerNote(null, null));
        statusEl.textContent = 'Draw with a stylus, finger, or mouse. Readings appear only after a pointer event arrives.';
        marker.hidden = true;
        return;
      }
      const { reading, pointerId } = latest;
      setText('pointer-type', formatPointerType(reading.pointerType));
      setText('pressure', formatPressure(reading.pressure));
      setText('tilt-x', formatTilt(reading.tiltX));
      setText('tilt-y', formatTilt(reading.tiltY));
      setText('azimuth', formatAzimuth(reading.azimuth));
      setText('buttons', formatButtonReadout(reading.buttons, reading.button));
      setText('stroke', pressureStrokeNote(reading.pressure));
      setText('tilt-note', tiltMarkerNote(reading.tiltX, reading.tiltY));
      statusEl.textContent = formatStatus(pointerId, active.size, reading);
      const markerPosition = tiltMarkerPercent(tiltMarker(reading.tiltX, reading.tiltY));
      if (!markerPosition) {
        marker.hidden = true;
        return;
      }
      marker.hidden = false;
      marker.style.left = markerPosition.left;
      marker.style.top = markerPosition.top;
    };

    const remember = (event: PointerEvent) => {
      const reading = readStylusSample({
        pointerType: 'pointerType' in event ? event.pointerType : undefined,
        pressure: 'pressure' in event ? event.pressure : undefined,
        tiltX: 'tiltX' in event ? event.tiltX : undefined,
        tiltY: 'tiltY' in event ? event.tiltY : undefined,
        azimuthAngle: 'azimuthAngle' in event ? event.azimuthAngle : undefined,
        buttons: 'buttons' in event ? event.buttons : undefined,
        button: 'button' in event ? event.button : undefined,
      });
      latest = { pointerId: event.pointerId, reading };
      return reading;
    };

    const addSegment = (from: { x: number; y: number }, to: { x: number; y: number }, width: number) => {
      segments.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, width });
      redraw();
    };

    const onPointer = (event: PointerEvent) => {
      const reading = remember(event);
      const point = cssPoint(event);
      const width = strokeWidthPx(reading.pressure).px;
      if (event.type === 'pointerdown') {
        active.set(event.pointerId, point);
        if (canvas.setPointerCapture) {
          try {
            canvas.setPointerCapture(event.pointerId);
          } catch {
            // A synthetic event may not be capturable. The sample is still recorded.
          }
        }
        addSegment(point, point, width);
      } else if ((event.type === 'pointermove' || event.type === 'pointerup') && active.has(event.pointerId)) {
        const previous = active.get(event.pointerId);
        if (previous) addSegment(previous, point, width);
        if (event.type === 'pointerup') active.delete(event.pointerId);
        else active.set(event.pointerId, point);
      } else if (event.type === 'pointercancel') {
        active.delete(event.pointerId);
      }
      if (event.cancelable && (event.type === 'pointerdown' || event.type === 'pointermove')) event.preventDefault();
      render();
    };

    canvas.addEventListener('pointerdown', onPointer);
    canvas.addEventListener('pointermove', onPointer);
    canvas.addEventListener('pointerup', onPointer);
    canvas.addEventListener('pointercancel', onPointer);

    resetButton.addEventListener('click', () => {
      latest = null;
      active.clear();
      segments.length = 0;
      redraw();
      render();
    });

    window.addEventListener('resize', redraw);
    redraw();
    render();
  }
}
