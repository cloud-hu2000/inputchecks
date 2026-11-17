import { expect, test } from '@playwright/test';

test('mouse DPI page calculates a measured path and does not claim a sensor reading', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/mouse-dpi-test');

  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('Effective Mouse DPI Test');
  await expect(page).toHaveTitle('Mouse DPI Test: Effective On-Screen DPI | InputChecks');
  const title = await page.title();
  expect(title.length).toBeLessThanOrEqual(60);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/mouse-dpi-test\/?$/);
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description).toBeTruthy();
  expect(description!.length).toBeGreaterThanOrEqual(140);
  expect(description!.length).toBeLessThanOrEqual(160);
  expect(description).not.toMatch(/sensor dpi is \d/i);

  const distance = page.getByLabel('Physical distance');
  await expect(distance).toBeVisible();
  const distanceBox = await distance.boundingBox();
  expect(distanceBox).not.toBeNull();
  expect(distanceBox!.y + distanceBox!.height).toBeLessThan(720);

  const disclaimer = page.locator('[data-dpi-disclaimer]');
  await expect(disclaimer).toContainText(/cannot auto-read real hardware or sensor DPI/i);
  await expect(disclaimer).toContainText(/measurements/i);
  await expect(disclaimer).toContainText(/OS cursor settings/i);
  await expect(disclaimer).toContainText(/scaling/i);
  await expect(disclaimer).toContainText(/not a sensor specification reading/i);
  await expect(page.locator('body')).not.toContainText(/read your sensor dpi/i);

  await distance.fill('2');
  await page.getByLabel('Unit').selectOption('in');
  await page.getByLabel('On-screen travel (CSS pixels)').fill('1600');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.locator('[data-dpi-effective]')).toHaveText('800');
  await expect(page.locator('[data-dpi-inches]')).toHaveText('2');
  await expect(page.locator('[data-dpi-edpi]')).toHaveText('—');
  await expect(page.locator('[data-dpi-status]')).toContainText(/1600 CSS pixels divided by 2 inches/i);
  await expect(page.locator('[data-dpi-status]')).toContainText(/not guessed|stays blank/i);

  await page.getByLabel('DPI', { exact: true }).fill('800');
  await page.getByLabel('Sensitivity', { exact: true }).fill('0.5');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.locator('[data-dpi-effective]')).toHaveText('800');
  await expect(page.locator('[data-dpi-edpi]')).toHaveText('400');
  await expect(page.locator('[data-dpi-status]')).toContainText(/800 × 0\.5 = 400/);
  await expect(page.locator('[data-dpi-status]')).not.toContainText(/sensor dpi is/i);

  await page.getByRole('button', { name: 'Reset test' }).click();
  await expect(page.locator('[data-dpi-effective]')).toHaveText('—');
  await expect(page.locator('[data-dpi-edpi]')).toHaveText('—');
  await expect(distance).toHaveValue('');
  await expect(page.getByLabel('On-screen travel (CSS pixels)')).toHaveValue('');
  await expect(page.locator('[data-dpi-pad-readout]')).toHaveText('0 CSS px');

  const pad = page.locator('[data-dpi-pad]');
  await pad.scrollIntoViewIfNeeded();
  const padBox = await pad.boundingBox();
  expect(padBox).not.toBeNull();
  const startX = padBox!.x + 30;
  const startY = padBox!.y + padBox!.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 200, startY, { steps: 1 });
  await page.mouse.up();
  const travel = page.getByLabel('On-screen travel (CSS pixels)');
  await expect(travel).toHaveValue('200');
  await distance.fill('1');
  await page.getByLabel('Unit').selectOption('in');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.locator('[data-dpi-effective]')).toHaveText('200');
  await expect(page.locator('[data-dpi-edpi]')).toHaveText('—');
  await expect(page.locator('[data-dpi-status]')).not.toContainText(/hardware dpi is/i);

  await distance.fill('0');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.locator('[data-dpi-effective]')).toHaveText('—');
  await expect(page.locator('[data-dpi-status]')).toContainText(/Physical distance must be greater than zero/);
  await expect(page.locator('[data-dpi-status]')).toContainText(/No effective DPI is shown/);

  await distance.fill('2');
  await travel.fill('1600');
  await page.getByLabel('DPI', { exact: true }).fill('800');
  await page.getByLabel('Sensitivity', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.locator('[data-dpi-effective]')).toHaveText('800');
  await expect(page.locator('[data-dpi-edpi]')).toHaveText('—');
  await expect(page.locator('[data-dpi-status]')).toContainText(/Sensitivity was not entered/);
  await expect(page.locator('[data-dpi-status]')).toContainText(/not guessed/);
});

test('mouse DPI controls and disclaimer are in the static HTML', async ({ browser }) => {
  const page = await browser.newPage({
    javaScriptEnabled: false,
    baseURL: 'http://localhost:4321',
    viewport: { width: 390, height: 844 },
  });
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/mouse-dpi-test');
    await expect(page.locator('main h1')).toHaveText('Effective Mouse DPI Test');
    const distance = page.getByLabel('Physical distance');
    await expect(distance).toBeVisible();
    const box = await distance.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThan(844);
    await expect(page.getByLabel('On-screen travel (CSS pixels)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset test' })).toBeVisible();
    await expect(page.locator('[data-dpi-disclaimer]')).toContainText(/cannot auto-read real hardware or sensor DPI/i);
    await expect(page.locator('[data-dpi-effective]')).toHaveText('—');
    await expect(page.locator('[data-dpi-edpi]')).toHaveText('—');
  } finally {
    await page.close();
  }
});
