import { expect, test, type Page } from '@playwright/test';

async function dispatchMove(page: Page, init: Record<string, number | string>) {
  await page.evaluate((fields) => {
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 100,
      clientY: 100,
      movementX: 0,
      movementY: 0,
      ...fields,
    }));
  }, init);
}

test('drift page records only the stationary period and does not grade the sensor', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/mouse-drift-test');

  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('Stationary Mouse Cursor Drift Test');
  await expect(page).toHaveTitle('Stationary Mouse Cursor Drift Test | InputChecks');
  const title = await page.title();
  expect(title.length).toBeLessThanOrEqual(60);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/mouse-drift-test\/?$/);
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description).toBeTruthy();
  expect(description!.length).toBeGreaterThanOrEqual(140);
  expect(description!.length).toBeLessThanOrEqual(160);
  expect(description).not.toContain('Press Start, leave the pointer still');

  const start = page.getByRole('button', { name: 'Start', exact: true });
  await expect(start).toBeVisible();
  const startBox = await start.boundingBox();
  expect(startBox).not.toBeNull();
  expect(startBox!.y).toBeLessThan(900);
  expect(startBox!.y + startBox!.height).toBeLessThan(900);
  await expect(page.locator('[data-drift-events]')).toHaveText('Not started');
  await expect(page.locator('[data-drift-disclaimer]')).toContainText(/not a sensor fault verdict/i);
  await expect(page.locator('article')).toContainText('does not mean a sensor is damaged');
  await expect(page.locator('article')).not.toContainText(/severe drift|no drift detected|dirty sensor|replace your mouse|hardware defect/i);

  const words = (await page.locator('article').innerText()).trim().split(/\s+/).length;
  expect(words).toBeGreaterThanOrEqual(800);

  await dispatchMove(page, { movementX: 9, movementY: 9, clientX: 4, clientY: 4 });
  await expect(page.locator('[data-drift-events]')).toHaveText('Not started');

  await page.getByRole('button', { name: '5 seconds', exact: true }).click();
  await expect(page.locator('[data-drift-period]')).toHaveText('5 s selected');

  await page.clock.install();
  await start.click();
  await expect(page.locator('[data-drift-status]')).toContainText(/Countdown/);
  await expect(page.locator('[data-drift-events]')).toHaveText('Not recording yet');
  await dispatchMove(page, { movementX: 8, movementY: 8, clientX: 2, clientY: 2 });
  await expect(page.locator('[data-drift-events]')).toHaveText('Not recording yet');

  await page.clock.fastForward(3000);
  await expect(page.locator('[data-drift-status]')).toContainText(/Recording a 5 s stationary period/);
  await dispatchMove(page, { movementX: 3, movementY: 4, clientX: 10, clientY: 20, pointerId: 1, pointerType: 'mouse' });
  await dispatchMove(page, { movementX: 0, movementY: -2, clientX: 10, clientY: 18, pointerId: 1, pointerType: 'mouse' });
  await expect(page.locator('[data-drift-events]')).toHaveText('2');
  await expect(page.locator('[data-drift-movex]')).toHaveText('3 CSS px');
  await expect(page.locator('[data-drift-movey]')).toHaveText('2 CSS px');
  await expect(page.locator('[data-drift-steps]')).toHaveText('7 CSS px');
  await expect(page.locator('[data-drift-largest]')).toHaveText('5 CSS px');
  await expect(page.locator('[data-drift-net]')).toHaveText('Δx 0 CSS px, Δy -2 CSS px, distance 2 CSS px');
  await expect(page.locator('[data-drift-type]')).toHaveText('mouse');

  await page.clock.fastForward(5000);
  await expect(page.locator('[data-drift-status]')).toContainText(/not a sensor fault verdict/i);
  await expect(page.locator('[data-drift-status]')).not.toContainText(verdictPattern());
  await dispatchMove(page, { movementX: 40, movementY: 0, clientX: 80, clientY: 18 });
  await expect(page.locator('[data-drift-movex]')).toHaveText('3 CSS px');
  await expect(page.locator('[data-drift-events]')).toHaveText('2');

  await page.getByRole('button', { name: 'Reset test' }).click();
  await expect(page.locator('[data-drift-events]')).toHaveText('Not started');
  await expect(page.locator('[data-drift-period]')).toHaveText('5 s selected');
  await expect(page.locator('[data-drift-status]')).toContainText(/press Start/i);
});

function verdictPattern() {
  return /severe drift|no drift detected|sensor is damaged|dirty sensor|replace your mouse/i;
}

test('drift controls stay inside a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/mouse-drift-test');
  const start = page.getByRole('button', { name: 'Start', exact: true });
  await expect(start).toBeVisible();
  const box = await start.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThan(844);
  expect(box!.width).toBeLessThanOrEqual(390);
  await expect(page.locator('[data-drift-surface]')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
