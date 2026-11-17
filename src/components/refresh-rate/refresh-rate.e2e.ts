import { expect, test } from '@playwright/test';

/**
 * Stubs requestAnimationFrame with a fixed 1000/60 ms timestamp series.
 * This does not read a monitor, EDID, or a hardware refresh rate.
 * The assertion is only that the page UI produces a numeric frame-interval estimate from those timestamps.
 */
async function stubAnimationFrames(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const interval = 1000 / 60;
    let next = 0;
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      next += interval;
      const stamp = next;
      return window.setTimeout(() => callback(stamp), 0) as unknown as number;
    };
    window.cancelAnimationFrame = (handle: number) => {
      window.clearTimeout(handle);
    };
  });
}

test('refresh rate page exposes the frame-interval tool without claiming a hardware reading', async ({ page }) => {
  await stubAnimationFrames(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/refresh-rate-test');

  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('Browser Display Refresh Rate Test');
  await expect(page).toHaveTitle('Refresh Rate Test: Frame Interval Estimate | InputChecks');
  const title = await page.title();
  expect(title.length).toBeLessThanOrEqual(60);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/refresh-rate-test\/?$/);
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description).toBeTruthy();
  expect(description!.length).toBeGreaterThanOrEqual(140);
  expect(description!.length).toBeLessThanOrEqual(160);
  expect(description).not.toMatch(/your monitor is/i);

  const start = page.getByRole('button', { name: 'Start test' });
  await expect(start).toBeVisible();
  const box = await start.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThan(720);

  const disclaimer = page.locator('[data-refresh-disclaimer]');
  await expect(disclaimer).toContainText(/requestAnimationFrame/i);
  await expect(disclaimer).toContainText(/not the monitor EDID or panel refresh rate/i);
  await expect(disclaimer).toContainText(/not a hardware specification/i);
  await expect(disclaimer).toContainText(/throttl/i);

  await start.click();
  await expect(page.locator('[data-refresh-hz]')).toHaveText(/\d+\.\d Hz/, { timeout: 15000 });
  await expect(page.locator('[data-refresh-frames]')).not.toHaveText('0');
  await expect(page.locator('[data-refresh-median]')).toContainText('ms');
  await expect(page.locator('[data-refresh-status]')).not.toHaveText(/your monitor is/i);

  await page.getByRole('button', { name: 'Reset test' }).click();
  await expect(page.locator('[data-refresh-hz]')).toHaveText('—');
  await expect(page.locator('[data-refresh-frames]')).toHaveText('0');
  await expect(page.getByRole('button', { name: 'Start test' })).toBeVisible();
});

test('refresh rate controls and disclaimer are in the static HTML', async ({ browser }) => {
  const page = await browser.newPage({
    javaScriptEnabled: false,
    baseURL: 'http://localhost:4321',
    viewport: { width: 390, height: 844 },
  });
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/refresh-rate-test');
    await expect(page.locator('main h1')).toHaveText('Browser Display Refresh Rate Test');
    const start = page.getByRole('button', { name: 'Start test' });
    await expect(start).toBeVisible();
    const box = await start.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThan(844);
    await expect(page.locator('[data-refresh-disclaimer]')).toContainText(/not the monitor EDID or panel refresh rate/i);
    await expect(page.locator('[data-refresh-hz]')).toHaveText('—');
  } finally {
    await page.close();
  }
});
