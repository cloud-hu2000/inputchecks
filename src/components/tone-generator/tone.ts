export const MIN_HZ = 1;
export const MAX_HZ = 20000;
export const DEFAULT_HZ = 440;
export const DEFAULT_WAVEFORM = 'sine';
export const DEFAULT_GAIN_PERCENT = 30;
export const MAX_GAIN_PERCENT = 100;
export const MAX_LINEAR_GAIN = 0.5;

export const WAVEFORMS = ['sine', 'square', 'sawtooth', 'triangle'] as const;
export type Waveform = (typeof WAVEFORMS)[number];

export const NOT_STARTED = 'Not started';
export const NOT_PROVIDED = 'Not provided';
export const IDLE_STATUS = 'Set a frequency from 1 to 20000 Hz, choose sine, square, sawtooth, or triangle, then press Play. Nothing is playing.';
export const STOPPED_STATUS = 'Stopped. No oscillator is running. Press Play to start another one at the frequency and waveform selected above.';
export const MISSING_CONTEXT = 'This browser did not provide AudioContext. No oscillator was started.';
export const CONTEXT_FAILED = 'This browser did not start an AudioContext. No oscillator was started.';
export const RESUME_FAILED = 'This browser did not resume the AudioContext. No oscillator was started.';
export const START_FAILED = 'The oscillator did not start. No tone is playing.';

const FREQUENCY_REASON = 'Enter a whole number of hertz from 1 to 20000. The oscillator was not changed.';
const WAVEFORM_REASON = 'Choose sine, square, sawtooth, or triangle. The oscillator was not changed.';
const GAIN_REASON = 'Gain must be a whole number from 0 to 100. The oscillator was not changed.';

export interface ToneSelection {
  hz: number;
  waveform: Waveform;
  gainPercent: number;
  sampleRate: number | null;
  running: boolean;
}

export const INITIAL_SELECTION: ToneSelection = {
  hz: DEFAULT_HZ,
  waveform: DEFAULT_WAVEFORM,
  gainPercent: DEFAULT_GAIN_PERCENT,
  sampleRate: null,
  running: false,
};

export type ParseOk<T> = { ok: true; value: T };
export type ParseNo = { ok: false; reason: string };

export function linearGain(percent: number): number {
  return (percent * 5) / 1000;
}

export function formatGainPercent(percent: number): string {
  const thousandths = percent * 5;
  const whole = Math.trunc(thousandths / 1000);
  const fraction = thousandths % 1000;
  if (fraction === 0) return String(whole);
  return `${whole}.${String(fraction).padStart(3, '0').replace(/0+$/, '')}`;
}

export function formatHz(hz: number): string {
  return `${hz} Hz`;
}

export function formatSampleRate(sampleRate: number | null): string {
  if (sampleRate === null) return NOT_STARTED;
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) return NOT_PROVIDED;
  return `${sampleRate} Hz`;
}

export function formatOscillatorState(selection: ToneSelection): string {
  if (selection.running) return 'Playing';
  if (selection.sampleRate !== null) return 'Stopped';
  return NOT_STARTED;
}

export function parseFrequency(raw: string): ParseOk<number> | ParseNo {
  const text = raw.trim();
  if (!/^[0-9]+$/.test(text)) return { ok: false, reason: FREQUENCY_REASON };
  const hz = Number(text);
  if (!Number.isSafeInteger(hz) || hz < MIN_HZ || hz > MAX_HZ) return { ok: false, reason: FREQUENCY_REASON };
  return { ok: true, value: hz };
}

export function parseWaveform(raw: string): ParseOk<Waveform> | ParseNo {
  const text = raw.trim();
  if (text === 'sine' || text === 'square' || text === 'sawtooth' || text === 'triangle') {
    return { ok: true, value: text };
  }
  return { ok: false, reason: WAVEFORM_REASON };
}

export function parseGainPercent(raw: string): ParseOk<number> | ParseNo {
  const text = raw.trim();
  if (!/^[0-9]+$/.test(text)) return { ok: false, reason: GAIN_REASON };
  const percent = Number(text);
  if (!Number.isSafeInteger(percent) || percent > MAX_GAIN_PERCENT) return { ok: false, reason: GAIN_REASON };
  return { ok: true, value: percent };
}

export function sampleRateUsable(sampleRate: number): boolean {
  return Number.isFinite(sampleRate) && sampleRate > 0;
}

export function nyquistReason(hz: number, sampleRate: number, mode: 'start' | 'update'): string | null {
  const ending = mode === 'start' ? 'The oscillator was not started.' : 'That value was not applied.';
  if (!sampleRateUsable(sampleRate)) {
    return `This AudioContext did not provide a usable sample rate. ${ending}`;
  }
  if (hz >= sampleRate / 2) {
    return `${hz} Hz is at or above half of this AudioContext sample rate (${sampleRate} Hz). ${ending}`;
  }
  return null;
}

export interface PlayInput {
  frequencyRaw: string;
  waveformRaw: string;
  gainRaw: string;
  sampleRate: number | null;
}

export type PlayDecision =
  | { action: 'reject'; reason: string }
  | { action: 'need-sample-rate'; hz: number; waveform: Waveform; gainPercent: number }
  | { action: 'ready'; hz: number; waveform: Waveform; gainPercent: number; sampleRate: number };

export function decidePlay(input: PlayInput): PlayDecision {
  const frequency = parseFrequency(input.frequencyRaw);
  if (!frequency.ok) return { action: 'reject', reason: frequency.reason };
  const waveform = parseWaveform(input.waveformRaw);
  if (!waveform.ok) return { action: 'reject', reason: waveform.reason };
  const gain = parseGainPercent(input.gainRaw);
  if (!gain.ok) return { action: 'reject', reason: gain.reason };
  if (input.sampleRate === null) {
    return { action: 'need-sample-rate', hz: frequency.value, waveform: waveform.value, gainPercent: gain.value };
  }
  const block = nyquistReason(frequency.value, input.sampleRate, 'start');
  if (block) return { action: 'reject', reason: block };
  return {
    action: 'ready',
    hz: frequency.value,
    waveform: waveform.value,
    gainPercent: gain.value,
    sampleRate: input.sampleRate,
  };
}

function withRunningNote(selection: ToneSelection, reason: string): string {
  if (!selection.running) return reason;
  return `${reason} The oscillator is still a ${selection.waveform} wave at ${selection.hz} Hz.`;
}

export function applyFrequency(selection: ToneSelection, raw: string): { selection: ToneSelection; message: string | null } {
  const parsed = parseFrequency(raw);
  if (!parsed.ok) return { selection, message: withRunningNote(selection, parsed.reason) };
  if (selection.running) {
    if (selection.sampleRate === null || !sampleRateUsable(selection.sampleRate)) {
      return {
        selection,
        message: 'The sample rate was not provided. That frequency was not applied. The oscillator is still running.',
      };
    }
    const block = nyquistReason(parsed.value, selection.sampleRate, 'update');
    if (block) return { selection, message: withRunningNote(selection, block) };
  }
  return { selection: { ...selection, hz: parsed.value }, message: null };
}

export function applyWaveform(selection: ToneSelection, raw: string): { selection: ToneSelection; message: string | null } {
  const parsed = parseWaveform(raw);
  if (!parsed.ok) return { selection, message: withRunningNote(selection, parsed.reason) };
  return { selection: { ...selection, waveform: parsed.value }, message: null };
}

export function applyGain(selection: ToneSelection, raw: string): { selection: ToneSelection; message: string | null } {
  const parsed = parseGainPercent(raw);
  if (!parsed.ok) return { selection, message: withRunningNote(selection, parsed.reason) };
  return { selection: { ...selection, gainPercent: parsed.value }, message: null };
}

export function playingStatus(selection: ToneSelection): string {
  const sampleRate = selection.sampleRate ?? 0;
  return `Playing a ${selection.waveform} oscillator at ${selection.hz} Hz. Linear gain ${formatGainPercent(selection.gainPercent)}. AudioContext sample rate ${sampleRate} Hz. This is a browser oscillator, not a hearing test.`;
}

export function statusFor(selection: ToneSelection, pendingMessage: string | null): string {
  if (pendingMessage) return pendingMessage;
  if (selection.running && selection.sampleRate !== null && sampleRateUsable(selection.sampleRate)) return playingStatus(selection);
  if (!selection.running && selection.sampleRate !== null) return STOPPED_STATUS;
  return IDLE_STATUS;
}
