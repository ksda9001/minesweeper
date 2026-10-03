import { test, expect } from '@playwright/test';

test('default effects are audible, limited, and mute follows the volume control', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('real-mines-settings', JSON.stringify({ language: 'en', quality: 'low' }));
    const connect = AudioNode.prototype.connect;
    Object.defineProperty(AudioNode.prototype, 'connect', { value: function (this: AudioNode, destination: AudioNode | AudioParam, ...ports: number[]) {
      const result = Reflect.apply(connect, this, [destination, ...ports]);
      if (destination instanceof AudioDestinationNode) {
        const meter = this.context.createAnalyser(); meter.fftSize = 2048; Reflect.apply(connect, this, [meter]);
        Object.defineProperty(window, '__audioMeter', { value: meter, configurable: true });
      }
      return result;
    } });
  });
  await page.goto('/'); await expect(page.locator('.field')).toHaveAttribute('aria-busy', 'false', { timeout: 45000 });
  const peak = () => page.evaluate(() => {
    const meter = (window as Window & { __audioMeter?: AnalyserNode }).__audioMeter;
    if (!meter) return 0;
    const samples = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(samples);
    return Math.max(...samples.map(Math.abs));
  });
  await page.locator('canvas').focus(); await page.keyboard.press('f');
  await expect.poll(peak, { timeout: 2000, intervals: [10] }).toBeGreaterThan(.05);
  expect(await peak()).toBeLessThan(1);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Master volume', { exact: true })).toHaveValue('0.9');
  await expect(page.getByLabel('Effects', { exact: true })).toHaveValue('0.85');
  await page.getByLabel('Master volume', { exact: true }).focus(); await page.keyboard.press('Home');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.waitForTimeout(800); await page.locator('canvas').focus(); await page.keyboard.press('f');
  expect(await peak()).toBeLessThan(.002);
});
