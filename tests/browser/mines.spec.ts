import { test, expect } from '@playwright/test';
import { Game, PRESETS } from '../../packages/game-core/src/index';

test('flags are visible, loss plays a chain, and restart cancels the remaining effects', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { Math.random = () => 41 / 2 ** 32; localStorage.setItem('real-mines-settings', JSON.stringify({ quality: 'high', reducedMotion: false })); });
  await page.goto('/');
  await expect(page.locator('.field')).toHaveAttribute('aria-busy', 'false', { timeout: 45000 });
  await expect(page.getByText('三维渲染暂不可用')).toBeHidden();
  const game = new Game(PRESETS.beginner, 41); game.reveal(0, 0);
  const mine = game.cells.findIndex(c => c.mine), canvas = page.locator('canvas');
  await canvas.focus(); await page.keyboard.press('Enter');
  for (let i = 0; i < mine; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('f');
  await expect(page.getByRole('status', { name: '剩余地雷 9', exact: true })).toBeVisible();
  await page.waitForTimeout(450);
  const field = (await page.locator('.field').boundingBox())!, cellSize = Math.min(field.width, field.height) / 9;
  const center = { x: field.x + (field.width - cellSize * 9) / 2 + (mine % 9 + .5) * cellSize, y: field.y + (field.height - cellSize * 9) / 2 + (Math.floor(mine / 9) + .5) * cellSize };
  const visibleColors = async (size: number) => page.evaluate(async encoded => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${encoded}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0); const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let sum = 0, red = 0;
    for (let i = 0; i < pixels.length; i += 4) { sum += pixels[i] + pixels[i + 1] + pixels[i + 2]; if (pixels[i] > 90 && pixels[i] > pixels[i + 1] * 1.7 && pixels[i] > pixels[i + 2] * 1.7) red++; }
    return { brightness: sum / (pixels.length * .75), redFraction: red / (pixels.length / 4) };
  }, (await page.screenshot({ clip: { x: center.x - size / 2, y: center.y - size / 2, width: size, height: size } })).toString('base64'));
  expect((await visibleColors(cellSize)).redFraction).toBeGreaterThan(.03);
  await page.screenshot({ path: '../flag-visibility.png' });
  await page.keyboard.press('f'); await page.keyboard.press('Enter');
  await expect(page.locator('.field')).toHaveAttribute('data-status', 'lost');
  const timer = await page.locator('.counter').last().getAttribute('aria-label');
  await page.waitForTimeout(500); await page.screenshot({ path: '../chain-explosion.png' });
  await page.waitForTimeout(2400); await page.screenshot({ path: '../realistic-mines.png' });
  // A reflected glTF root must remain intact; baking it used to turn the lid black.
  expect((await visibleColors(cellSize * .3)).brightness).toBeGreaterThan(45);
  expect(await page.locator('.counter').last().getAttribute('aria-label')).toBe(timer);
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await canvas.focus(); await page.keyboard.press('Enter');
  for (let i = 0; i < mine; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await page.waitForTimeout(1800);
  await expect(page.locator('.field')).toHaveAttribute('data-status', 'ready');
  await expect(page.getByRole('status', { name: '剩余地雷 10', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
