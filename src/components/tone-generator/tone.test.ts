import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GAIN_PERCENT,
  DEFAULT_HZ,
  DEFAULT_WAVEFORM,
  IDLE_STATUS,
  INITIAL_SELECTION,
  MAX_HZ,
  MIN_HZ,
  STOPPED_STATUS,
  applyFrequency,
  applyGain,
  applyWaveform,
  decidePlay,
  formatGainPercent,
  formatOscillatorState,
  formatSampleRate,
  linearGain,
  nyquistReason,
  playingStatus,
  statusFor,
} from './tone';

const claim = /tinnitus|frequency response|audiogram|hearing score|normal hearing|left channel|right channel|speaker quality/i;

describe('tone oscillator settings', () => {
  it('maps the gain slider in thousandths and keeps the documented examples', () => {
    expect(linearGain(30)).toBe(0.15);
    expect(formatGainPercent(30)).toBe('0.15');
    expect(formatGainPercent(100)).toBe('0.5');
    expect(formatGainPercent(0)).toBe('0');
    expect(formatGainPercent(1)).toBe('0.005');
    expect(formatGainPercent(2)).toBe('0.01');
    expect(DEFAULT_HZ).toBe(440);
    expect(DEFAULT_WAVEFORM).toBe('sine');
    expect(DEFAULT_GAIN_PERCENT).toBe(30);
    expect(linearGain(DEFAULT_GAIN_PERCENT)).toBe(0.15);
  });

  it('accepts a whole-number frequency inside 1 to 20000 and rejects everything else', () => {
    expect(decidePlay({ frequencyRaw: '440', waveformRaw: 'sine', gainRaw: '30', sampleRate: null })).toEqual({
      action: 'need-sample-rate',
      hz: 440,
      waveform: 'sine',
      gainPercent: 30,
    });
    expect(decidePlay({ frequencyRaw: '1', waveformRaw: 'triangle', gainRaw: '0', sampleRate: 48000 })).toMatchObject({
      action: 'ready',
      hz: 1,
      waveform: 'triangle',
      gainPercent: 0,
    });
    expect(decidePlay({ frequencyRaw: '20000', waveformRaw: 'sawtooth', gainRaw: '100', sampleRate: 48000 })).toMatchObject({
      action: 'ready',
      hz: MAX_HZ,
      waveform: 'sawtooth',
      gainPercent: 100,
    });
    expect(decidePlay({ frequencyRaw: ' 880 ', waveformRaw: 'square', gainRaw: '15', sampleRate: 44100 }).action).toBe('ready');

    for (const raw of ['', '440.5', '440Hz', '1e3', '+440', '-1', '0', '20001', '200000', '1.0', 'nan', 'Infinity']) {
      const decision = decidePlay({ frequencyRaw: raw, waveformRaw: 'sine', gainRaw: '30', sampleRate: 48000 });
      expect(decision.action).toBe('reject');
      if (decision.action === 'reject') expect(decision.reason).toContain(`${MIN_HZ}`);
    }
  });

  it('rejects an unknown waveform or gain before it asks for a sample rate', () => {
    const waveform = decidePlay({ frequencyRaw: '440', waveformRaw: 'custom', gainRaw: '30', sampleRate: null });
    expect(waveform).toMatchObject({ action: 'reject' });
    const gain = decidePlay({ frequencyRaw: '440', waveformRaw: 'sine', gainRaw: '101', sampleRate: null });
    expect(gain).toMatchObject({ action: 'reject' });
    const blankGain = decidePlay({ frequencyRaw: '440', waveformRaw: 'sine', gainRaw: '', sampleRate: 48000 });
    expect(blankGain.action).toBe('reject');
    const fractional = decidePlay({ frequencyRaw: '440', waveformRaw: 'sine', gainRaw: '30.5', sampleRate: 48000 });
    expect(fractional.action).toBe('reject');
  });

  it('refuses a frequency at or above half the reported sample rate', () => {
    expect(nyquistReason(1000, 2000, 'start')).toMatch(/1000 Hz is at or above half/);
    expect(nyquistReason(999, 2000, 'start')).toBeNull();
    expect(decidePlay({ frequencyRaw: '1000', waveformRaw: 'sine', gainRaw: '30', sampleRate: 2000 }).action).toBe('reject');
    expect(decidePlay({ frequencyRaw: '999', waveformRaw: 'sine', gainRaw: '30', sampleRate: 2000 })).toMatchObject({
      action: 'ready',
      hz: 999,
      sampleRate: 2000,
    });
    expect(decidePlay({ frequencyRaw: '20000', waveformRaw: 'sine', gainRaw: '30', sampleRate: 48000 }).action).toBe('ready');
    for (const sampleRate of [0, -48000, Number.NaN, Number.POSITIVE_INFINITY]) {
      const decision = decidePlay({ frequencyRaw: '440', waveformRaw: 'sine', gainRaw: '30', sampleRate });
      expect(decision.action).toBe('reject');
      if (decision.action === 'reject') expect(decision.reason).toContain('usable sample rate');
    }
  });

  it('keeps the playing frequency when a later value is rejected', () => {
    const playing = { ...INITIAL_SELECTION, sampleRate: 2000, running: true };
    const refused = applyFrequency(playing, '1000');
    expect(refused.selection.hz).toBe(440);
    expect(refused.message).toMatch(/was not applied/);
    expect(refused.message).toMatch(/still a sine wave at 440 Hz/);
    const applied = applyFrequency(playing, '999');
    expect(applied.selection.hz).toBe(999);
    expect(applied.message).toBeNull();
    const invalid = applyFrequency(playing, 'nope');
    expect(invalid.selection).toEqual(playing);
    expect(invalid.message).toMatch(/not changed/);
  });

  it('updates waveform and gain only from the allowed values', () => {
    const nextWave = applyWaveform(INITIAL_SELECTION, 'square');
    expect(nextWave.selection.waveform).toBe('square');
    const badWave = applyWaveform({ ...INITIAL_SELECTION, running: true, sampleRate: 48000 }, 'pulse');
    expect(badWave.selection.waveform).toBe('sine');
    expect(badWave.message).toMatch(/still a sine wave at 440 Hz/);
    const nextGain = applyGain(INITIAL_SELECTION, '100');
    expect(nextGain.selection.gainPercent).toBe(100);
    expect(formatGainPercent(nextGain.selection.gainPercent)).toBe('0.5');
    const badGain = applyGain(INITIAL_SELECTION, '-1');
    expect(badGain.selection.gainPercent).toBe(30);
  });

  it('describes playback as a browser oscillator and does not grade hearing', () => {
    const playing = { hz: 440, waveform: 'sine' as const, gainPercent: 30, sampleRate: 48000, running: true };
    const status = playingStatus(playing);
    expect(status).toBe('Playing a sine oscillator at 440 Hz. Linear gain 0.15. AudioContext sample rate 48000 Hz. This is a browser oscillator, not a hearing test.');
    expect(status).not.toMatch(claim);
    expect(statusFor(INITIAL_SELECTION, null)).toBe(IDLE_STATUS);
    expect(statusFor({ ...INITIAL_SELECTION, sampleRate: 48000, running: false }, null)).toBe(STOPPED_STATUS);
    expect(statusFor(playing, 'Enter a whole number of hertz from 1 to 20000. The oscillator was not changed.')).toContain('not changed');
    expect(formatOscillatorState(INITIAL_SELECTION)).toBe('Not started');
    expect(formatOscillatorState(playing)).toBe('Playing');
    expect(formatOscillatorState({ ...playing, running: false })).toBe('Stopped');
    expect(formatSampleRate(null)).toBe('Not started');
    expect(formatSampleRate(0)).toBe('Not provided');
    expect(formatSampleRate(48000)).toBe('48000 Hz');
    expect(IDLE_STATUS).not.toMatch(claim);
    expect(STOPPED_STATUS).not.toMatch(claim);
  });
});
