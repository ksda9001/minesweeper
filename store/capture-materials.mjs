// Capture the real game and render store artwork using the existing icon, without changing it.
import { chromium, expect } from '@playwright/test';
import { Game, PRESETS } from '../packages/game-core/src/index.ts';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || 'store/artifacts/materials');
const data = JSON.parse(await fs.readFile(path.join(root, 'store/listings.json'), 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] });
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
try {
  for (const [locale, listing] of Object.entries(data.locales)) {
    const lang = locale === 'zh-CN' ? 'zh' : 'en';
    const shots = path.join(out, 'screenshots', locale);
    const art = path.join(out, 'artwork', locale);
    await fs.mkdir(shots, { recursive: true }); await fs.mkdir(art, { recursive: true });
    const text = [
      `Product name\n${data.productName}`, `Short description\n${listing.shortDescription}`,
      `Description\n${listing.description}`, `Product features (one per field)\n${listing.features.join('\n')}`,
      `Keywords (one per field)\n${listing.keywords.join('\n')}`, 'What\'s new\n[Leave blank for this first submission]',
      `Future update draft (do not paste on first submission)\n${listing.releaseNotesForFutureUpdate}`,
      `Developed by\n${data.publisher}`, 'Copyright\n© 2026 Norns Interactive. Third-party materials retain their respective licenses.',
      `Screenshot captions, 01–04\n${listing.screenshots.join('\n')}`, `Social copy (publish after launch)\n${listing.socialCopy}`,
      'Store link (may be unavailable until publication)\nhttps://apps.microsoft.com/detail/9P212988CNMK'
    ].join('\n\n') + '\n';
    await fs.writeFile(path.join(out, `listing-${locale}.txt`), text, 'utf8');
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale, deviceScaleFactor: 1 });
    await context.addInitScript(({ lang }) => {
      Math.random = () => 41 / 2 ** 32;
      localStorage.setItem('real-mines-settings', JSON.stringify({ language: lang, quality: 'high', reducedMotion: true }));
      localStorage.removeItem('real-mines-scores');
    }, { lang });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:5174/');
    await expect(page.locator('.field')).toHaveAttribute('aria-busy', 'false', { timeout: 60000 });
    await expect(page.getByText(lang === 'zh' ? '三维渲染暂不可用' : '3D rendering unavailable', { exact: false })).toBeHidden();
    await page.clock.install({ time: new Date('2026-10-08T04:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-08T04:00:01Z'));
    await page.locator('canvas').focus(); await page.keyboard.press('Enter');
    await page.clock.fastForward(56420);
    // Flag a mine from the same seed, using the actual keyboard controls.
    const game = new Game(PRESETS.beginner, 41); game.reveal(0, 0);
    const mine = game.cells.findIndex(c => c.mine);
    for (let i = 0; i < mine; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('f');
    await page.locator('canvas').evaluate(el => el.blur());
    await page.clock.runFor(300);
    await page.screenshot({ path: path.join(shots, '01-classic.png') });
    // Finish a real board, rather than fabricate score data for the screenshot.
    await page.locator('canvas').focus();
    for (let i = 0; i < mine; i++) await page.keyboard.press('ArrowLeft');
    for (let i = 1; i < game.cells.length; i++) {
      await page.keyboard.press('ArrowRight'); if (!game.cells[i].mine) await page.keyboard.press('Enter');
    }
    await expect(page.locator('.field')).toHaveAttribute('data-status', 'won');
    await page.getByRole('button', { name: lang === 'zh' ? '计分板' : 'Scores', exact: true }).click();
    await page.screenshot({ path: path.join(shots, '04-scores.png') });
    await page.getByRole('button', { name: lang === 'zh' ? '关闭' : 'Close', exact: true }).click();
    await page.locator('.menu-bar select').selectOption('expert');
    await page.locator('canvas').focus(); await page.keyboard.press('Enter');
    await page.locator('canvas').evaluate(el => el.blur()); await page.clock.runFor(500);
    await page.screenshot({ path: path.join(shots, '02-expert.png') });
    await page.locator('.menu-bar select').selectOption('custom');
    await page.screenshot({ path: path.join(shots, '03-custom.png') });
    assertListing(listing);
    if (errors.length) throw new Error(errors.join('\n'));
    await context.close();

    // These are native HTML compositions, with the untouched existing raster icon.
    const artPage = await browser.newPage();
    const icon = 'data:image/png;base64,' + (await fs.readFile(path.join(root, 'assets-source/app-icon.png'))).toString('base64');
    for (const [name, width, height] of [['poster-720x1080', 720, 1080], ['box-1080x1080', 1080, 1080]]) {
      await artPage.setViewportSize({ width, height });
      const imageSize = width === 720 ? 690 : 880;
      await artPage.setContent(`<html lang="${locale}"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{background:#11170e;color:#f0eddc;font-family:'Yu Gothic','Microsoft YaHei',Georgia,sans-serif;text-align:center}.title{position:absolute;top:52px;left:35px;right:35px;font-family:Georgia,serif;font-size:${width === 720 ? 57 : 68}px;line-height:1.06;font-weight:700}.tag{position:absolute;top:${width === 720 ? 195 : 150}px;left:24px;right:24px;font-size:${locale === 'ja-JP' ? 24 : 27}px;letter-spacing:1px;color:#d8d5ad}img{position:absolute;top:${width === 720 ? 255 : 190}px;left:50%;transform:translateX(-50%);width:${imageSize}px;height:${imageSize}px;object-fit:contain}</style><body><div class="title">realistic${width === 720 ? '<br>' : ' '}minesweeper</div><div class="tag">${escape(listing.tagline)}</div><img src="${icon}" alt=""></body></html>`);
      await artPage.locator('img').evaluate(el => el.decode()); await artPage.screenshot({ path: path.join(art, name + '.png') });
    }
    await artPage.close();
    console.log(`Captured ${locale}: four 1080p screenshots, poster, box art and text.`);
  }
  // Shared title-free hero: layout using the original icon, without a text overlay.
  const hero = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const icon = 'data:image/png;base64,' + (await fs.readFile(path.join(root, 'assets-source/app-icon.png'))).toString('base64');
  await hero.setContent(`<style>body{margin:0;background:#11170e;height:1080px;display:flex;justify-content:center}img{width:1080px;height:1080px;object-fit:contain}</style><img src="${icon}">`);
  await hero.locator('img').evaluate(el => el.decode()); await hero.screenshot({ path: path.join(out, 'artwork/hero-1920x1080.png') });
  await hero.close();
} finally { await browser.close(); }

function assertListing(listing) {
  if (listing.description.length > 10000 || listing.shortDescription.length > 270 || listing.features.length > 20 || listing.keywords.length > 7) throw new Error('Listing exceeds Store field limits');
  if (listing.features.some(x => x.length > 200) || listing.keywords.some(x => x.length > 40) || listing.screenshots.some(x => x.length > 200)) throw new Error('Listing item exceeds Store field limits');
}
