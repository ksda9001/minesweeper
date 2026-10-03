import { test, expect } from '@playwright/test';
import { Game, PRESETS, type Config } from '../../packages/game-core/src/index';

test('records each won mode and exact time once, persists custom fields, and ignores losses', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    Math.random = () => 41 / 2 ** 32;
    localStorage.setItem('real-mines-settings', JSON.stringify({ quality: 'low', reducedMotion: true }));
    if (!localStorage.getItem('real-mines-scores')) localStorage.setItem('real-mines-scores', JSON.stringify([null, { mode: 'custom', width: 5, height: 5, mines: 30, seconds: 5, finishedAt: 'invalid' }]));
  });
  await page.goto('/'); await expect(page.locator('.field')).toHaveAttribute('aria-busy', 'false', { timeout: 45000 });
  await page.getByRole('button', { name: '计分板', exact: true }).click();
  await expect(page.getByText('还没有通关记录。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.clock.install({ time: new Date('2026-10-03T05:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-03T05:00:01Z'));
  const finish = async (config: Config, milliseconds: number) => {
    const game = new Game(config, 41); game.reveal(0, 0);
    await page.locator('canvas').focus(); await page.keyboard.press('Enter');
    await page.clock.fastForward(milliseconds);
    for (let i = 1; i < game.cells.length; i++) { await page.keyboard.press('ArrowRight'); if (!game.cells[i].mine) await page.keyboard.press('Enter'); }
    await expect(page.locator('.field')).toHaveAttribute('data-status', 'won');
  };
  await finish(PRESETS.beginner, 12340);
  await page.keyboard.press('Enter'); // A completed board cannot add a duplicate record.
  await page.getByLabel('难度', { exact: true }).selectOption('custom');
  for (const [label, value] of [['宽度', '5'], ['高度', '5'], ['地雷数量', '8']]) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  await finish({ width: 5, height: 5, mines: 8 }, 7500);
  await page.getByRole('button', { name: '计分板', exact: true }).click();
  await expect(page.locator('.scores tbody tr')).toHaveCount(2);
  await expect(page.locator('.scores tbody tr').first()).toContainText('自定义');
  await expect(page.locator('.scores tbody tr').first()).toContainText('5 × 5 · 8 雷');
  await expect(page.locator('.scores tbody tr').first()).toContainText('7.50 秒');
  await expect(page.locator('.scores tbody tr').last()).toContainText('基础');
  await expect(page.locator('.scores tbody tr').last()).toContainText('12.34 秒');
  await page.screenshot({ path: '../scoreboard.png' });
  await page.clock.resume();
  await page.reload(); await expect(page.locator('.field')).toHaveAttribute('aria-busy', 'false', { timeout: 45000 });
  await page.getByRole('button', { name: '计分板', exact: true }).click();
  await expect(page.locator('.scores tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.locator('canvas').focus(); await page.keyboard.press('Enter');
  const lost = new Game(PRESETS.beginner, 41); lost.reveal(0, 0);
  for (let i = 0; i < lost.cells.findIndex(c => c.mine); i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter'); await expect(page.locator('.field')).toHaveAttribute('data-status', 'lost');
  await page.getByRole('button', { name: '设置', exact: true }).click(); await page.getByLabel('语言', { exact: true }).selectOption('en');
  await page.getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('button', { name: 'Scores', exact: true }).click();
  await expect(page.locator('.scores tbody tr')).toHaveCount(2);
  await expect(page.locator('.scores tbody tr').first()).toContainText('Custom');
  await expect(page.locator('.scores tbody tr').last()).toContainText('Beginner');
  expect(errors).toEqual([]);
});
