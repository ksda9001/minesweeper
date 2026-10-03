import { test, expect } from '@playwright/test';

test.use({ launchOptions: { args: ['--enable-unsafe-webgpu'] } });
test('WebGPU initializes dynamic textures, relief frame, and playable board', async ({ page }) => {
  await page.goto('/');
  const supported = await page.evaluate(async () => Boolean(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()));
  test.skip(!supported, 'This host has no WebGPU adapter');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await expect(page.locator('.field')).toHaveAttribute('aria-busy', 'false', { timeout: 45000 });
  await expect(page.getByText('三维渲染暂不可用')).toBeHidden();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expect(page.locator('.diagnostics')).toContainText('WebGPU');
  await expect(page.getByText('设置仅保存在本机。', { exact: true })).toBeVisible();
  await expect(page.getByText('关闭页面后本局结束。')).toHaveCount(0);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.locator('canvas').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.field')).toHaveAttribute('data-status', 'playing');
  await page.screenshot({ path: '../minesweeper-webgpu.png' });
  expect(errors).toEqual([]);
});
