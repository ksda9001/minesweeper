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
