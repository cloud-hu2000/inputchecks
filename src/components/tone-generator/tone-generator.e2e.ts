import { expect, test, type Page } from '@playwright/test';

const claim = /test your hearing|hearing test result|find your tinnitus|frequency-response curve|your hearing is normal|speaker quality score|plays the left speaker|plays the right speaker/i;

async function installFakeAudio(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __toneSampleRate?: number;
      __audioContexts: number;
      __oscillators: Array<{
        type: string;
        frequency: { value: number };
        started: boolean;
        stopped: boolean;
        connected: unknown;
      }>;
      __resumes: number;
      AudioContext: typeof AudioContext;
    };
    w.__audioContexts = 0;
    w.__oscillators = [];
    w.__resumes = 0;
    class FakeParam {
      value: number;
      constructor(value: number) { this.value = value; }
    }
    class FakeOsc {
      type = 'sine';
      frequency = new FakeParam(440);
      started = false;
      stopped = false;
      connected: unknown = null;
      connect(node: unknown) { this.connected = node; return node; }
      disconnect() { this.connected = null; }
      start() { this.started = true; }
      stop() {
        if (this.stopped) throw new Error('already stopped');
        this.stopped = true;
      }
    }
    class FakeGain {
      gain = new FakeParam(1);
      connected: unknown = null;
      connect(node: unknown) { this.connected = node; return node; }
      disconnect() { this.connected = null; }
    }
    class FakeContext {
      sampleRate: number;
      state = 'suspended';
      destination = { kind: 'destination' };
      constructor() {
        w.__audioContexts += 1;
        this.sampleRate = w.__toneSampleRate ?? 48000;
      }
      resume() {
        w.__resumes += 1;
        this.state = 'running';
        return Promise.resolve();
      }
      createOscillator() {
        const osc = new FakeOsc();
        w.__oscillators.push(osc);
        return osc;
      }
      createGain() { return new FakeGain(); }
      close() { return Promise.resolve(); }
    }
    w.AudioContext = FakeContext as unknown as typeof AudioContext;
  });
}

test('tone page plays the selected oscillator and refuses a hearing claim', async ({ page }) => {
  await installFakeAudio(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/tone-generator');

  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('Adjustable Frequency Tone Generator');
  await expect(page).toHaveTitle('Adjustable Frequency Tone Generator | InputChecks');
  const title = await page.title();
  expect(title.length).toBeLessThanOrEqual(60);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/tone-generator\/?$/);
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description).toBeTruthy();
  expect(description!.length).toBeGreaterThanOrEqual(140);
  expect(description!.length).toBeLessThanOrEqual(160);
  const hero = await page.locator('.page-hero p').innerText();
  expect(description).not.toBe(hero.trim());
  const firstParagraph = await page.locator('article p').first().innerText();
  expect(description).not.toBe(firstParagraph.trim());

  const play = page.getByRole('button', { name: 'Play', exact: true });
  await expect(play).toBeVisible();
  const playBox = await play.boundingBox();
  expect(playBox).not.toBeNull();
  expect(playBox!.y + playBox!.height).toBeLessThan(900);
  await expect(page.locator('#tone-frequency')).toHaveValue('440');
  await expect(page.locator('[data-tone-hz]')).toHaveText('440 Hz');
  await expect(page.locator('[data-tone-wave]')).toHaveText('sine');
  await expect(page.locator('[data-tone-gain-value]')).toHaveText('0.15');
  await expect(page.locator('[data-tone-state]')).toHaveText('Not started');
  await expect(page.locator('[data-tone-disclaimer]')).toContainText(/browser oscillator/i);
  await expect(page.locator('[data-tone-disclaimer]')).toContainText(/does not test hearing/i);
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(claim);
  expect(body).toMatch(/does not match tinnitus/i);
  expect(body).toMatch(/does not measure frequency response/i);

  const words = (await page.locator('article').innerText()).trim().split(/\s+/).length;
  expect(words).toBeGreaterThanOrEqual(800);

  await page.locator('#tone-frequency').fill('0');
  await play.click();
  await expect(page.locator('[data-tone-status]')).toContainText(/whole number of hertz from 1 to 20000/);
  await expect(page.locator('[data-tone-state]')).toHaveText('Not started');
  expect(await page.evaluate(() => (window as unknown as { __audioContexts: number }).__audioContexts)).toBe(0);

  await page.locator('#tone-frequency').fill('440');
  await expect(page.locator('[data-tone-hz]')).toHaveText('440 Hz');
  await play.click();
  await expect(page.locator('[data-tone-status]')).toContainText('Playing a sine oscillator at 440 Hz');
  await expect(page.locator('[data-tone-status]')).toContainText('not a hearing test');
  await expect(page.locator('[data-tone-status]')).toContainText('Linear gain 0.15');
  await expect(page.locator('[data-tone-rate]')).toHaveText('48000 Hz');
  await expect(page.locator('[data-tone-state]')).toHaveText('Playing');
  await expect(play).toBeDisabled();

  const started = await page.evaluate(() => {
    const osc = (window as unknown as { __oscillators: Array<{ type: string; frequency: { value: number }; started: boolean; connected: { gain: { value: number }; connected: { kind?: string } } }> }).__oscillators[0];
    return {
      count: (window as unknown as { __oscillators: unknown[] }).__oscillators.length,
      type: osc.type,
      hz: osc.frequency.value,
      started: osc.started,
      gain: osc.connected.gain.value,
      destination: osc.connected.connected.kind ?? '',
    };
  });
  expect(started).toEqual({ count: 1, type: 'sine', hz: 440, started: true, gain: 0.15, destination: 'destination' });

  await page.getByRole('radio', { name: 'Square' }).click();
  await page.locator('#tone-frequency').fill('880');
  await page.locator('#tone-gain').fill('100');
  await expect(page.locator('[data-tone-wave]')).toHaveText('square');
  await expect(page.locator('[data-tone-hz]')).toHaveText('880 Hz');
  await expect(page.locator('[data-tone-gain-value]')).toHaveText('0.5');
  await expect(page.locator('[data-tone-status]')).toContainText('Playing a square oscillator at 880 Hz');
  await expect(page.locator('[data-tone-status]')).toContainText('Linear gain 0.5');
  const updated = await page.evaluate(() => {
    const osc = (window as unknown as { __oscillators: Array<{ type: string; frequency: { value: number }; connected: { gain: { value: number } } }> }).__oscillators[0];
    return { type: osc.type, hz: osc.frequency.value, gain: osc.connected.gain.value };
  });
  expect(updated).toEqual({ type: 'square', hz: 880, gain: 0.5 });

  await page.locator('#tone-frequency').fill('0');
  await expect(page.locator('[data-tone-hz]')).toHaveText('880 Hz');
  await expect(page.locator('[data-tone-status]')).toContainText(/not changed/);
  await expect(page.locator('[data-tone-status]')).toContainText('still a square wave at 880 Hz');
  expect(await page.evaluate(() => (window as unknown as { __oscillators: Array<{ frequency: { value: number } }> }).__oscillators[0].frequency.value)).toBe(880);

  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('[data-tone-state]')).toHaveText('Stopped');
  await expect(page.locator('[data-tone-status]')).toContainText(/No oscillator is running/);
  await expect(play).toBeEnabled();
  expect(await page.evaluate(() => (window as unknown as { __oscillators: Array<{ stopped: boolean }> }).__oscillators[0].stopped)).toBe(true);

  await page.locator('#tone-frequency').fill('440');
  await page.getByRole('radio', { name: 'Sine' }).click();
  await play.click();
  await expect(page.locator('[data-tone-state]')).toHaveText('Playing');
  expect(await page.evaluate(() => (window as unknown as { __oscillators: unknown[] }).__oscillators.length)).toBe(2);
});

test('tone page refuses a frequency at half the reported sample rate', async ({ page }) => {
  await installFakeAudio(page);
  await page.goto('/tone-generator');
  await page.evaluate(() => { (window as unknown as { __toneSampleRate: number }).__toneSampleRate = 2000; });
  await page.locator('#tone-frequency').fill('1000');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('[data-tone-status]')).toContainText('1000 Hz is at or above half of this AudioContext sample rate (2000 Hz)');
  await expect(page.locator('[data-tone-state]')).toHaveText('Stopped');
  expect(await page.evaluate(() => (window as unknown as { __oscillators: unknown[] }).__oscillators.length)).toBe(0);
  await expect(page.locator('[data-tone-rate]')).toHaveText('2000 Hz');

  await page.locator('#tone-frequency').fill('999');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('[data-tone-status]')).toContainText('Playing a sine oscillator at 999 Hz');
  await expect(page.locator('[data-tone-rate]')).toHaveText('2000 Hz');
  expect(await page.evaluate(() => (window as unknown as { __oscillators: unknown[] }).__oscillators.length)).toBe(1);
});

test('tone page reports a missing AudioContext instead of inventing a tone', async ({ page }) => {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'AudioContext');
    Object.defineProperty(window, 'AudioContext', { configurable: true, writable: true, value: undefined });
    void descriptor;
  });
  await page.goto('/tone-generator');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('[data-tone-status]')).toHaveText('This browser did not provide AudioContext. No oscillator was started.');
  await expect(page.locator('[data-tone-state]')).toHaveText('Not started');
});

test('tone page starts a real OscillatorNode', async ({ page }) => {
  await page.addInitScript(() => {
    const Real = window.AudioContext;
    if (typeof Real !== 'function') return;
    const w = window as unknown as {
      __realStarts: number;
      __realStops: number;
      __realTypes: string[];
      __realHz: number[];
      __realGains: number[];
    };
    w.__realStarts = 0;
    w.__realStops = 0;
    w.__realTypes = [];
    w.__realHz = [];
    w.__realGains = [];
    class Wrapped extends Real {
      createOscillator() {
        const osc = super.createOscillator();
        const start = osc.start.bind(osc);
        const stop = osc.stop.bind(osc);
        osc.start = ((when?: number) => {
          w.__realStarts += 1;
          w.__realTypes.push(osc.type);
          w.__realHz.push(osc.frequency.value);
          return start(when);
        }) as OscillatorNode['start'];
        osc.stop = ((when?: number) => {
          w.__realStops += 1;
          return stop(when);
        }) as OscillatorNode['stop'];
        return osc;
      }
      createGain() {
        const amp = super.createGain();
        const connect = amp.connect.bind(amp) as (destination: AudioNode) => AudioNode;
        amp.connect = ((destination: AudioNode) => {
          w.__realGains.push(amp.gain.value);
          return connect(destination);
        }) as GainNode['connect'];
        return amp;
      }
    }
    window.AudioContext = Wrapped as typeof AudioContext;
  });
  await page.goto('/tone-generator');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('[data-tone-status]')).toContainText('Playing a sine oscillator at 440 Hz');
  await expect(page.locator('[data-tone-status]')).toContainText('not a hearing test');
  const started = await page.evaluate(() => {
    const w = window as unknown as { __realStarts: number; __realTypes: string[]; __realHz: number[]; __realGains: number[] };
    return { starts: w.__realStarts, type: w.__realTypes[0], hz: w.__realHz[0], gain: w.__realGains[0] };
  });
  expect(started.starts).toBe(1);
  expect(started.type).toBe('sine');
  expect(started.hz).toBe(440);
  expect(started.gain).toBeCloseTo(0.15, 6);
  await expect(page.locator('[data-tone-gain-value]')).toHaveText('0.15');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('[data-tone-state]')).toHaveText('Stopped');
  expect(await page.evaluate(() => (window as unknown as { __realStops: number }).__realStops)).toBe(1);
});

test('tone controls stay inside a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tone-generator');
  const play = page.getByRole('button', { name: 'Play', exact: true });
  await expect(play).toBeVisible();
  const box = await play.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThan(844);
  expect(box!.width).toBeLessThanOrEqual(390);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
