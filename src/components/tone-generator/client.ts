import {
  CONTEXT_FAILED,
  INITIAL_SELECTION,
  MISSING_CONTEXT,
  RESUME_FAILED,
  START_FAILED,
  applyFrequency,
  applyGain,
  applyWaveform,
  decidePlay,
  formatGainPercent,
  formatHz,
  formatOscillatorState,
  formatSampleRate,
  linearGain,
  statusFor,
  type ToneSelection,
} from './tone';

const root = document.querySelector<HTMLElement>('[data-tone-tester]');

if (root) {
  const playButton = root.querySelector<HTMLButtonElement>('[data-tone-play]');
  const stopButton = root.querySelector<HTMLButtonElement>('[data-tone-stop]');
  const frequencyInput = root.querySelector<HTMLInputElement>('[data-tone-frequency]');
  const gainInput = root.querySelector<HTMLInputElement>('[data-tone-gain]');
  const statusEl = root.querySelector<HTMLElement>('[data-tone-status]');
  const waveformInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="tone-waveform"]')];

  if (playButton && stopButton && frequencyInput && gainInput && statusEl && waveformInputs.length > 0) {
    let selection: ToneSelection = { ...INITIAL_SELECTION };
    let pending: string | null = null;
    let starting = false;
    let context: AudioContext | null = null;
    let oscillator: OscillatorNode | null = null;
    let gainNode: GainNode | null = null;

    const setText = (name: string, value: string) => {
      const el = root.querySelector<HTMLElement>(`[data-tone-${name}]`);
      if (el) el.textContent = value;
    };

    const checkedWaveform = () => waveformInputs.find((input) => input.checked)?.value ?? '';

    const render = () => {
      setText('hz', formatHz(selection.hz));
      setText('wave', selection.waveform);
      setText('gain-value', formatGainPercent(selection.gainPercent));
      setText('position', String(selection.gainPercent));
      setText('rate', formatSampleRate(selection.sampleRate));
      setText('state', formatOscillatorState(selection));
      statusEl.textContent = statusFor(selection, pending);
      playButton.disabled = selection.running || starting;
      stopButton.disabled = !selection.running;
      for (const input of waveformInputs) {
        if (input.value === selection.waveform) input.checked = true;
      }
    };

    const releaseNodes = () => {
      if (oscillator) {
        try {
          oscillator.stop();
        } catch {
          // A node that never started throws. Disconnect still runs.
        }
        oscillator.disconnect();
        oscillator = null;
      }
      if (gainNode) {
        gainNode.disconnect();
        gainNode = null;
      }
    };

    const writeLive = (next: ToneSelection) => {
      if (!oscillator || !gainNode || !selection.running) return true;
      const previousType = oscillator.type;
      const previousHz = oscillator.frequency.value;
      const previousGain = gainNode.gain.value;
      try {
        oscillator.type = next.waveform;
        oscillator.frequency.value = next.hz;
        gainNode.gain.value = linearGain(next.gainPercent);
        return true;
      } catch {
        try {
          oscillator.type = previousType;
          oscillator.frequency.value = previousHz;
          gainNode.gain.value = previousGain;
        } catch {
          // The status line still reports the last selection this page accepted.
        }
        pending = 'That value was not applied. The oscillator is still running.';
        return false;
      }
    };

    const applyAndRender = (next: { selection: ToneSelection; message: string | null }, live: boolean) => {
      if (next.message) {
        pending = next.message;
        render();
        return;
      }
      if (live && !writeLive(next.selection)) {
        render();
        return;
      }
      selection = next.selection;
      pending = null;
      render();
    };

    frequencyInput.addEventListener('input', () => {
      applyAndRender(applyFrequency(selection, frequencyInput.value), selection.running);
    });

    gainInput.addEventListener('input', () => {
      applyAndRender(applyGain(selection, gainInput.value), selection.running);
    });

    for (const input of waveformInputs) {
      input.addEventListener('change', () => {
        if (!input.checked) return;
        applyAndRender(applyWaveform(selection, input.value), selection.running);
      });
    }

    const failStart = (message: string, sampleRate: number | null) => {
      releaseNodes();
      selection = { ...selection, sampleRate, running: false };
      pending = message;
      render();
    };

    playButton.addEventListener('click', () => {
      if (selection.running || starting) return;
      const preview = decidePlay({
        frequencyRaw: frequencyInput.value,
        waveformRaw: checkedWaveform(),
        gainRaw: gainInput.value,
        sampleRate: null,
      });
      if (preview.action === 'reject') {
        pending = preview.reason;
        render();
        return;
      }

      const Ctx = window.AudioContext;
      if (typeof Ctx !== 'function') {
        selection = { ...selection, sampleRate: null, running: false };
        pending = MISSING_CONTEXT;
        render();
        return;
      }

      starting = true;
      playButton.disabled = true;
      void (async () => {
        try {
          try {
            if (!context) context = new Ctx();
          } catch {
            failStart(CONTEXT_FAILED, null);
            return;
          }
          try {
            if (context.state === 'suspended') await context.resume();
          } catch {
            failStart(RESUME_FAILED, sampleRateOrNull(context));
            return;
          }
          const decision = decidePlay({
            frequencyRaw: frequencyInput.value,
            waveformRaw: checkedWaveform(),
            gainRaw: gainInput.value,
            sampleRate: context.sampleRate,
          });
          if (decision.action !== 'ready') {
            const reason = decision.action === 'reject' ? decision.reason : CONTEXT_FAILED;
            failStart(reason, sampleRateOrNull(context));
            return;
          }
          try {
            releaseNodes();
            const osc = context.createOscillator();
            const amp = context.createGain();
            osc.type = decision.waveform;
            osc.frequency.value = decision.hz;
            amp.gain.value = linearGain(decision.gainPercent);
            osc.connect(amp);
            amp.connect(context.destination);
            osc.start();
            oscillator = osc;
            gainNode = amp;
            selection = {
              hz: decision.hz,
              waveform: decision.waveform,
              gainPercent: decision.gainPercent,
              sampleRate: context.sampleRate,
              running: true,
            };
            pending = null;
            render();
          } catch {
            failStart(START_FAILED, sampleRateOrNull(context));
          }
        } finally {
          starting = false;
          render();
        }
      })();
    });

    stopButton.addEventListener('click', () => {
      if (!selection.running) return;
      releaseNodes();
      selection = { ...selection, running: false };
      pending = null;
      render();
    });

    render();
  }
}

function sampleRateOrNull(context: AudioContext | null): number | null {
  if (!context) return null;
  return Number.isFinite(context.sampleRate) ? context.sampleRate : null;
}
