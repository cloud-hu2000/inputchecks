import {
  calculateEdpi,
  calculateEffectiveDpi,
  formatDpi,
  formatInches,
  formatTravelPixels,
  pointerPathPixels,
  type DpiField,
  type EdpiOk,
  type EdpiOmitted,
  type EffectiveDpiOk,
  type FieldIssue,
  type PointerPoint,
} from './effective-dpi';

const root = document.querySelector<HTMLElement>('[data-dpi-tester]');

const FIELD_LABEL: Record<DpiField, string> = {
  physicalDistance: 'Physical distance',
  pixelTravel: 'On-screen travel',
  unit: 'Unit',
  dpi: 'DPI',
  sensitivity: 'Sensitivity',
};

function issueSentence(issue: FieldIssue): string {
  const label = FIELD_LABEL[issue.field];
  if (issue.code === 'missing') return `${label} is missing.`;
  if (issue.code === 'non_numeric') return `${label} must be a number.`;
  if (issue.code === 'non_finite') return `${label} must be a finite number.`;
  if (issue.code === 'negative') return `${label} cannot be negative.`;
  if (issue.code === 'zero') return `${label} must be greater than zero.`;
  return 'Unit must be inches, centimeters, or millimeters.';
}

function omittedSentence(result: EdpiOmitted): string {
  if (result.reason === 'dpi_only') {
    return 'Sensitivity was not entered, so no eDPI is shown. The missing factor was not guessed.';
  }
  if (result.reason === 'sensitivity_only') {
    return 'DPI was not entered, so no eDPI is shown. The missing factor was not guessed.';
  }
  return 'eDPI stays blank until you enter both DPI and sensitivity.';
}

if (root) {
  const form = root.querySelector<HTMLFormElement>('[data-dpi-form]');
  const distanceInput = root.querySelector<HTMLInputElement>('[data-dpi-distance]');
  const unitInput = root.querySelector<HTMLSelectElement>('[data-dpi-unit]');
  const pixelInput = root.querySelector<HTMLInputElement>('[data-dpi-pixels]');
  const dpiInput = root.querySelector<HTMLInputElement>('[data-dpi-native]');
  const sensitivityInput = root.querySelector<HTMLInputElement>('[data-dpi-sensitivity]');
  const pad = root.querySelector<HTMLElement>('[data-dpi-pad]');
  const readout = root.querySelector<HTMLElement>('[data-dpi-pad-readout]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-dpi-reset]');
  const statusEl = root.querySelector<HTMLElement>('[data-dpi-status]');

  if (
    form
    && distanceInput
    && unitInput
    && pixelInput
    && dpiInput
    && sensitivityInput
    && pad
    && readout
    && resetButton
    && statusEl
  ) {
    const fields: Record<DpiField, HTMLElement> = {
      physicalDistance: distanceInput,
      pixelTravel: pixelInput,
      unit: unitInput,
      dpi: dpiInput,
      sensitivity: sensitivityInput,
    };
    const readyText = 'Enter a physical distance and the on-screen travel in CSS pixels, then press Calculate. You can drag the pad to fill travel from the pointer path.';
    let points: PointerPoint[] = [];
    let activePointer: number | null = null;

    const setText = (name: 'effective' | 'inches' | 'edpi', value: string) => {
      const el = root.querySelector<HTMLElement>(`[data-dpi-${name}]`);
      if (el) el.textContent = value;
    };

    const clearValidity = () => {
      for (const field of Object.values(fields)) field.removeAttribute('aria-invalid');
    };

    const markIssues = (issues: readonly FieldIssue[]) => {
      for (const issue of issues) fields[issue.field].setAttribute('aria-invalid', 'true');
    };

    const paintCleared = () => {
      setText('effective', '—');
      setText('inches', '—');
      setText('edpi', '—');
      clearValidity();
      statusEl.textContent = readyText;
    };

    const describeEffective = (result: EffectiveDpiOk) => {
      const pixels = formatDpi(result.pixels);
      const inches = formatInches(result.inches);
      return `Effective DPI is ${pixels} CSS pixels divided by ${inches} inches.`;
    };

    const describeEdpi = (result: EdpiOk) => {
      return `eDPI is ${formatDpi(result.dpi)} × ${formatDpi(result.sensitivity)} = ${formatDpi(result.edpi)}.`;
    };

    const calculate = () => {
      clearValidity();
      const measured = calculateEffectiveDpi({
        physicalDistance: distanceInput.value,
        unit: unitInput.value,
        pixelTravel: pixelInput.value,
      });
      const edpi = calculateEdpi({
        dpi: dpiInput.value,
        sensitivity: sensitivityInput.value,
      });
      const sentences: string[] = [];

      if (measured.status === 'ok') {
        setText('effective', formatDpi(measured.effectiveDpi));
        setText('inches', formatInches(measured.inches));
        sentences.push(describeEffective(measured));
      } else {
        setText('effective', '—');
        setText('inches', '—');
        markIssues(measured.issues);
        sentences.push(...measured.issues.map(issueSentence));
        sentences.push('No effective DPI is shown.');
      }

      if (edpi.status === 'ok') {
        setText('edpi', formatDpi(edpi.edpi));
        sentences.push(describeEdpi(edpi));
      } else {
        setText('edpi', '—');
        if (edpi.status === 'error') {
          markIssues(edpi.issues);
          sentences.push(...edpi.issues.map(issueSentence));
          sentences.push('No eDPI is shown.');
        } else {
          sentences.push(omittedSentence(edpi));
        }
      }

      statusEl.textContent = sentences.join(' ');
    };

    const writePath = () => {
      const text = formatTravelPixels(pointerPathPixels(points));
      pixelInput.value = text;
      readout.textContent = `${text} CSS px`;
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      calculate();
    });

    resetButton.addEventListener('click', () => {
      form.reset();
      points = [];
      activePointer = null;
      readout.textContent = '0 CSS px';
      paintCleared();
    });

    pad.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      activePointer = event.pointerId;
      points = [{ x: event.clientX, y: event.clientY }];
      pad.setPointerCapture(event.pointerId);
      writePath();
    });

    pad.addEventListener('pointermove', (event) => {
      if (activePointer !== event.pointerId) return;
      points.push({ x: event.clientX, y: event.clientY });
      writePath();
    });

    const endDrag = (event: PointerEvent) => {
      if (activePointer !== event.pointerId) return;
      if (pad.hasPointerCapture(event.pointerId)) pad.releasePointerCapture(event.pointerId);
      activePointer = null;
      writePath();
    };

    pad.addEventListener('pointerup', endDrag);
    pad.addEventListener('pointercancel', endDrag);
  }
}
