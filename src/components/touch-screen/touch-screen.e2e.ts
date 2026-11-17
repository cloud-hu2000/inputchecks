import { expect, test, type Page } from '@playwright/test';

interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

/**
 * Dispatches Touch Events on the test surface.
 * This is a synthetic browser event, not a physical touchscreen check.
 */
async function dispatchTouches(
  page: Page,
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  active: TouchPoint[],
  changed: TouchPoint[] = active,
) {
  await page.evaluate(({ type, active, changed }) => {
    const surface = document.querySelector('[data-touch-surface]');
    if (!(surface instanceof HTMLElement)) throw new Error('missing touch surface');
    if (typeof TouchEvent === 'undefined' || typeof Touch === 'undefined') {
      throw new Error('TouchEvent is not available in this browser');
    }
    const rect = surface.getBoundingClientRect();
    const make = (point: TouchPoint) => new Touch({
      identifier: point.id,
      target: surface,
      clientX: rect.left + point.x,
      clientY: rect.top + point.y,
    });
    const touches = active.map(make);
    const changedTouches = changed.map(make);
    surface.dispatchEvent(new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches,
      targetTouches: touches,
      changedTouches,
    }));
  }, { type, active, changed });
}

test('touch screen page records simulated contacts without calling them a hardware check', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/touch-screen-test');

  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('Touchscreen Multi-Touch Test');
  await expect(page).toHaveTitle('Touch Screen Test: Multi-Touch Contacts | InputChecks');
  const title = await page.title();
  expect(title.length).toBeLessThanOrEqual(60);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/touch-screen-test\/?$/);
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description).toBeTruthy();
  expect(description!.length).toBeGreaterThanOrEqual(140);
  expect(description!.length).toBeLessThanOrEqual(160);
  expect(description).not.toMatch(/certif(y|ies|ied) your/i);

  const surface = page.locator('[data-touch-surface]');
  await expect(surface).toBeVisible();
  const box = await surface.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThan(720);
  expect(box!.height).toBeGreaterThanOrEqual(200);
  expect(box!.y + 80).toBeLessThan(720);
  await expect(page.getByRole('button', { name: 'Reset test' })).toBeVisible();

  const disclaimer = page.locator('[data-touch-disclaimer]');
  await expect(disclaimer).toContainText(/desktop/i);
  await expect(disclaimer).toContainText(/no-touch-screen/i);
  await expect(disclaimer).toContainText(/hover-only/i);
  await expect(disclaimer).toContainText(/not a hardware certification/i);

  const maxTouchPoints = await page.evaluate(() => navigator.maxTouchPoints ?? 0);
  const capability = page.locator('[data-touch-capability]');
  await expect(capability).toContainText(new RegExp(`maxTouchPoints ${maxTouchPoints}`));
  await expect(capability).not.toContainText(/hardware check (passed|complete)/i);
  if (maxTouchPoints === 0) {
    await expect(capability).toContainText(/unsupported/i);
  }

  await dispatchTouches(page, 'touchstart', [
    { id: 7, x: 30, y: 40 },
    { id: 8, x: 180, y: 90 },
  ]);
  await expect(page.locator('[data-touch-current]')).toHaveText('2');
  await expect(page.locator('[data-touch-max]')).toHaveText('2');
  await expect(page.locator('[data-touch-list]')).toContainText('Identifier 7 at 30.0, 40.0');
  await expect(page.locator('[data-touch-list]')).toContainText('Identifier 8 at 180.0, 90.0');
  await expect(page.locator('[data-touch-status]')).toContainText(/unsupported|not a hardware certification/i);
  await expect(page.locator('[data-touch-status]')).not.toContainText(/test passed/i);
  await expect(page.locator('[data-touch-unhit]')).toContainText(/not a diagnosis of a broken panel/i);

  await dispatchTouches(
    page,
    'touchend',
    [{ id: 8, x: 180, y: 90 }],
    [{ id: 7, x: 30, y: 40 }],
  );
  await expect(page.locator('[data-touch-current]')).toHaveText('1');
  await expect(page.locator('[data-touch-max]')).toHaveText('2');
  await expect(page.locator('[data-touch-list]')).toContainText('Identifier 8');
  await expect(page.locator('[data-touch-list]')).not.toContainText('Identifier 7');

  await page.getByRole('button', { name: 'Reset test' }).click();
  await expect(page.locator('[data-touch-current]')).toHaveText('0');
  await expect(page.locator('[data-touch-max]')).toHaveText('0');
  await expect(page.locator('[data-touch-list]')).toHaveText('No active touch contacts.');
  await expect(page.locator('[data-touch-unhit]')).toContainText(/not listed/i);

  await surface.dispatchEvent('pointerdown', { pointerType: 'mouse', pointerId: 1, clientX: 40, clientY: 40, bubbles: true });
  await expect(page.locator('[data-touch-current]')).toHaveText('0');
  await expect(page.locator('[data-touch-max]')).toHaveText('0');
  await expect(page.locator('[data-touch-status]')).toContainText(/not counted as a touch contact/i);
});

test('touch screen controls and the no-touch disclaimer are in the static HTML', async ({ browser }) => {
  const page = await browser.newPage({
    javaScriptEnabled: false,
    baseURL: 'http://localhost:4321',
    viewport: { width: 390, height: 844 },
  });
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/touch-screen-test');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('main h1')).toHaveText('Touchscreen Multi-Touch Test');
    const surface = page.locator('[data-touch-surface]');
    await expect(surface).toBeVisible();
    const box = await surface.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeLessThan(844);
    expect(box!.height).toBeGreaterThanOrEqual(200);
    await expect(page.getByRole('button', { name: 'Reset test' })).toBeVisible();
    await expect(page.locator('[data-touch-disclaimer]')).toContainText(/no-touch-screen/i);
    await expect(page.locator('[data-touch-disclaimer]')).toContainText(/hover-only/i);
    await expect(page.locator('[data-touch-current]')).toHaveText('0');
    await expect(page.locator('[data-touch-capability]')).toContainText(/no touch points/i);
  } finally {
    await page.close();
  }
});
