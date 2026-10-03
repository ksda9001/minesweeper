import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 430, height: 900 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });

test('device tilt changes lighting while screen coordinates keep selecting the same cells', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('real-mines-settings', JSON.stringify({
    language: 'zh', quality: 'low', reducedMotion: false, motionIntensity: 1, sensitivity: 2,
  })));
  await page.goto('/');
  await expect(page.locator('.field')).toHaveAttribute('aria-busy', 'false', { timeout: 45000 });
  await expect(page.getByText('三维渲染暂不可用')).toBeHidden();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: /开启姿态/ }).click();
  await expect(page.getByRole('button', { name: /关闭姿态/ })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('dialog').getByRole('button', { name: '关闭', exact: true }).click();

  const orientation = (beta: number, gamma: number) => page.evaluate(({ beta, gamma }) => {
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta, gamma, alpha: 0 }));
  }, { beta, gamma });
  await orientation(30, 0); // The first sensor reading establishes a neutral pose.
  await page.waitForTimeout(1000);
  const cabinet = (await page.locator('.cabinet').boundingBox())!;
  // This corner contains only the bezel and timber shelf, so swaying grass
  // cannot make a broken frame-lighting implementation appear to work.
  const clip = { x: cabinet.x, y: cabinet.y, width: 64, height: 64 };
  let neutral = await page.screenshot({ clip });
  await expect.poll(async () => { const image = await page.screenshot({ clip }); const stable = image.equals(neutral); neutral = image; return stable; }, { timeout: 10000, intervals: [300] }).toBe(true);
  await orientation(30, 0);
  await page.waitForTimeout(500);
  expect((await page.screenshot({ clip })).equals(neutral)).toBe(true);

  const field = (await page.locator('.field').boundingBox())!;
  const points = [[.21, .31], [.79, .69], [.39, .81]];
  const cells: string[] = [];
  for (const [x, y] of points) {
    await page.mouse.move(field.x + field.width * x, field.y + field.height * y);
    cells.push((await page.locator('#cell-description').textContent())!);
  }

  await orientation(45, 18);
  await page.waitForTimeout(650);
  expect((await page.screenshot({ clip })).equals(neutral)).toBe(false);
  for (const [i, [x, y]] of points.entries()) {
    await page.mouse.move(field.x + field.width * x, field.y + field.height * y);
    await expect(page.locator('#cell-description')).toHaveText(cells[i]);
  }
  await page.screenshot({ path: '../tilt-lighting-mobile.png' });
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const disable = page.getByRole('button', { name: /关闭姿态/ });
  await expect(disable).toHaveAttribute('aria-pressed', 'true');
  await disable.click();
  await expect(page.getByRole('button', { name: /开启姿态/ })).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});
