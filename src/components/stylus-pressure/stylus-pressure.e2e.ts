import { expect, test, type Page } from '@playwright/test';

async function dispatchPointer(
  page: Page,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  init: Record<string, unknown>,
) {
  await page.evaluate(({ type, init }) => {
    const surface = document.querySelector('[data-stylus-surface]');
    if (!(surface instanceof HTMLCanvasElement)) throw new Error('missing stylus surface');
    const rect = surface.getBoundingClientRect();
    surface.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 48,
      clientY: rect.top + 36,
      isPrimary: true,
      ...init,
    }));
  }, { type, init });
}

test('stylus page shows pointer fields and does not certify hardware', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/stylus-pressure-test');

  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('Stylus Pen Pressure and Tilt Test');
  await expect(page).toHaveTitle('Stylus Pen Pressure and Tilt Test | InputChecks');
  const title = await page.title();
  expect(title.length).toBeLessThanOrEqual(60);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/stylus-pressure-test\/?$/);
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description).toBeTruthy();
  expect(description!.length).toBeGreaterThanOrEqual(140);
  expect(description!.length).toBeLessThanOrEqual(160);
  expect(description).not.toContain('Read the pointer type');

  const surface = page.locator('[data-stylus-surface]');
  await expect(surface).toBeVisible();
  const box = await surface.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThan(720);
  expect(box!.y + 80).toBeLessThan(720);
  expect(box!.height).toBeGreaterThanOrEqual(200);
  await expect(page.getByRole('button', { name: 'Reset test' })).toBeVisible();
  await expect(page.locator('[data-stylus-pressure]')).toHaveText('No pointer event yet');

  const disclaimer = page.locator('[data-stylus-disclaimer]');
  await expect(disclaimer).toContainText(/not provided/i);
  await expect(disclaimer).toContainText(/not a hardware certification/i);
  await expect(page.locator('article')).not.toContainText(/palm rejection/i);
  await expect(page.locator('article')).not.toContainText(/wacom|apple pencil|huion|xp-pen/i);

  await dispatchPointer(page, 'pointerdown', {
    pointerId: 7,
    pointerType: 'pen',
    pressure: 0.72,
    tiltX: 15,
    tiltY: -10,
    azimuthAngle: Math.PI / 6,
    buttons: 1,
    button: 0,
  });
  await dispatchPointer(page, 'pointermove', {
    pointerId: 7,
    pointerType: 'pen',
    pressure: 0.72,
    tiltX: 15,
    tiltY: -10,
    azimuthAngle: Math.PI / 6,
    buttons: 1,
    button: -1,
  });

  await expect(page.locator('[data-stylus-pointer-type]')).toHaveText('pen');
  await expect(page.locator('[data-stylus-pressure]')).toHaveText('0.72');
  await expect(page.locator('[data-stylus-tilt-x]')).toHaveText('15°');
  await expect(page.locator('[data-stylus-tilt-y]')).toHaveText('-10°');
  await expect(page.locator('[data-stylus-azimuth]')).toHaveText('0.5236 rad (30°)');
  await expect(page.locator('[data-stylus-buttons]')).toHaveText('1 (contact); button -1 (no change)');
  await expect(page.locator('[data-stylus-status]')).toContainText('Pointer id 7');
  await expect(page.locator('[data-stylus-stroke]')).toContainText(/follows the pressure/i);
  await expect(page.locator('[data-stylus-tilt-marker]')).toBeVisible();
  await expect(page.locator('[data-stylus-disclaimer]')).not.toContainText(/passed|certified your/i);

  const painted = await page.evaluate(() => {
    const canvas = document.querySelector('[data-stylus-surface]');
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] !== 0) return true;
    }
    return false;
  });
  expect(painted).toBe(true);

  await dispatchPointer(page, 'pointermove', {
    pointerId: 4,
    pointerType: 'mouse',
    pressure: 0.5,
    tiltX: 0,
    tiltY: 0,
    azimuthAngle: 0,
    buttons: 0,
    button: -1,
  });
  await expect(page.locator('[data-stylus-pointer-type]')).toHaveText('mouse');
  await expect(page.locator('[data-stylus-pressure]')).toHaveText('0.5');
  await expect(page.locator('[data-stylus-tilt-x]')).toHaveText('0°');
  await expect(page.locator('[data-stylus-azimuth]')).toHaveText('0 rad (0°)');
  await expect(page.locator('[data-stylus-status]')).not.toContainText(/fail|unsupported pen|incompatible/i);

  await page.getByRole('button', { name: 'Reset test' }).click();
  await expect(page.locator('[data-stylus-pressure]')).toHaveText('No pointer event yet');
  await expect(page.locator('[data-stylus-pointer-type]')).toHaveText('No pointer event yet');
  await expect(page.locator('[data-stylus-tilt-marker]')).toBeHidden();
});

test('stylus controls stay in the mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/stylus-pressure-test');
  const surface = page.locator('[data-stylus-surface]');
  await expect(surface).toBeVisible();
  const box = await surface.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThan(844);
  expect(box!.width).toBeLessThanOrEqual(390);
  await expect(page.getByRole('button', { name: 'Reset test' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
