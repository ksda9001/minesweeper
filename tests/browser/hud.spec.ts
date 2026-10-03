import { test, expect } from '@playwright/test';

for (const width of [1100, 390, 320]) test(`counters stay fixed and the clover casts a shadow without a selection overlay at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1100 ? 900 : 844 });
  await page.addInitScript(() => localStorage.setItem('real-mines-settings', JSON.stringify({ quality: 'low', reducedMotion: true })));
  await page.goto('/'); await expect(page.locator('.field')).toHaveAttribute('aria-busy', 'false', { timeout: 45000 });
  await expect(page.locator('.bottom-panel, .status-bar')).toHaveCount(0);
  const digits = page.locator('.wood-digit');
  const layout = () => digits.evaluateAll(elements => elements.map(el => {
    const { x, y, width, height } = el.getBoundingClientRect(), style = getComputedStyle(el);
    return { x, y, width, height, background: style.backgroundPosition, transform: style.transform };
  }));
  const fixed = await layout();
  const reset = page.getByRole('button', { name: '重新开始', exact: true }), box = (await reset.boundingBox())!;
  const left = (await page.locator('.counter').first().boundingBox())!, right = (await page.locator('.counter').last().boundingBox())!;
  expect(left.x + left.width).toBeLessThanOrEqual(box.x); expect(box.x + box.width).toBeLessThanOrEqual(right.x);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await expect(reset).toHaveCSS('box-shadow', 'none'); await expect(reset).toHaveCSS('transform', 'none');
  expect(await reset.boundingBox()).toEqual(box);
  await expect(reset.locator('img')).toHaveCSS('filter', 'drop-shadow(rgba(23, 14, 7, 0.6) 0px 6px 3px)');
  await expect(reset.locator('img')).toHaveAttribute('draggable', 'false');
  expect(await reset.evaluate(el => getComputedStyle(el).getPropertyValue('-webkit-tap-highlight-color'))).toBe('rgba(0, 0, 0, 0)');
  await page.mouse.up();
  await page.clock.install();
  await page.locator('canvas').focus(); await page.keyboard.press('f');
  await expect(page.getByRole('status', { name: '剩余地雷 9', exact: true })).toBeVisible();
  expect(await layout()).toEqual(fixed);
  await page.keyboard.press('f'); await page.keyboard.press('Enter');
  await page.clock.fastForward(12340);
  await expect(page.locator('.counter').last()).toHaveAttribute('aria-label', '时间（秒） 12');
  expect(await layout()).toEqual(fixed);
  await page.getByRole('button', { name: '帮助', exact: true }).click();
  await expect(page.locator('.help')).not.toContainText(/账号|在线排行|后端/);
});
