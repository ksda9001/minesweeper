import { test, expect } from '@playwright/test';

for (const width of [1100, 390, 320]) test(`original carved cards stay aligned and the clover presses without a selection overlay at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1100 ? 900 : 844 });
  await page.addInitScript(() => localStorage.setItem('real-mines-settings', JSON.stringify({ quality: 'low', reducedMotion: true })));
  await page.goto('/'); await expect(page.locator('.field')).toHaveAttribute('aria-busy', 'false', { timeout: 45000 });
  await expect(page.locator('.bottom-panel, .status-bar')).toHaveCount(0);
  const digits = page.locator('.wood-digit');
  await expect(digits.locator('.wood-card')).toHaveCount(6);
  await expect(digits.locator('.carved-number')).toHaveCount(6);
  for (const image of await digits.locator('image').all()) await expect(image).toHaveAttribute('href', '/assets/counter-cards.png');
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
  await expect(reset.locator('img')).toHaveCSS('filter', 'drop-shadow(rgba(23, 14, 7, 0.6) 0px 2px 1px)');
  await expect(reset.locator('img')).toHaveCSS('transform', 'matrix(0.97, 0, 0, 0.97, 0, 3)');
  await expect(reset.locator('img')).toHaveAttribute('draggable', 'false');
  expect(await reset.evaluate(el => getComputedStyle(el).getPropertyValue('-webkit-tap-highlight-color'))).toBe('rgba(0, 0, 0, 0)');
  await page.mouse.up();
  await expect(reset.locator('img')).toHaveCSS('transform', 'none');
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

test('a quick clover click visibly depresses and rebounds without moving its slot', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => localStorage.setItem('real-mines-settings', JSON.stringify({ quality: 'low', reducedMotion: false })));
  await page.goto('/'); await expect(page.locator('.field')).toHaveAttribute('aria-busy', 'false', { timeout: 45000 });
  const reset = page.getByRole('button', { name: '重新开始', exact: true }), token = reset.locator('img'), box = await reset.boundingBox();
  await token.evaluate(img => {
    // Pause the real browser animation so a quick tap's poses can be checked deterministically.
    const animate = img.animate.bind(img);
    img.animate = (...args) => { const animation = animate(...args); animation.pause(); return animation; };
  });
  await reset.click();
  const press = await token.evaluate(img => {
    const animation = img.getAnimations().find(a => !(a instanceof CSSTransition));
    if (!animation) throw new Error('The clover click did not start an animation.');
    animation.currentTime = 0;
    const start = new DOMMatrix(getComputedStyle(img).transform);
    animation.currentTime = Number(animation.effect!.getTiming().duration) / 2;
    const middle = new DOMMatrix(getComputedStyle(img).transform);
    animation.finish();
    return { start: start.m42, middle: middle.m42 };
  });
  expect(press.start).toBe(3); expect(press.middle).toBeGreaterThan(0); expect(press.middle).toBeLessThan(press.start);
  await expect(token).toHaveCSS('transform', 'none');
  expect(await reset.boundingBox()).toEqual(box);
});
