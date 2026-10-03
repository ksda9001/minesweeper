import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('bundles valid Blender props containing only the intended asset meshes', () => {
  for (const [name, prefix] of [['clover-patch', 'RM_Clover'], ['daisy', 'RM_Daisy'], ['branch', 'RM_Branch'], ['numbers', 'Number'], ['mine', 'RM_Mine']]) {
    const file = readFileSync(new URL(`../apps/web/public/assets/${name}.glb`, import.meta.url));
    expect(file.readUInt32LE(0)).toBe(0x46546c67); expect(file.readUInt32LE(4)).toBe(2); expect(file.readUInt32LE(8)).toBe(file.length);
    const data = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString());
    expect(data.meshes.length).toBeGreaterThan(0);
    expect(data.meshes.every((m: { name: string }) => m.name.startsWith(prefix))).toBe(true);
  }
});
it('bundles correctly sized launcher icons for Web, Android, and Windows', () => {
  for (const [path, size] of [['apps/web/public/icon-256.png', 256], ['apps/web/public/icon-512.png', 512], ['apps/mobile/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', 192], ['apps/mobile/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png', 432]] as const) {
    const png = readFileSync(new URL(`../${path}`, import.meta.url));
    expect(png.subarray(1, 4).toString()).toBe('PNG'); expect(png.readUInt32BE(16)).toBe(size); expect(png.readUInt32BE(20)).toBe(size);
  }
  const ico = readFileSync(new URL('../apps/desktop/src-tauri/icons/icon.ico', import.meta.url));
  expect(ico.readUInt16LE(2)).toBe(1); expect(ico.readUInt16LE(4)).toBe(7);
});
