import { expect, it } from 'vitest';
import { soilPatches, surroundingSoil } from '../packages/renderer/src/soil';

it('exposes upward-facing square soil patches with matching edges and a continuous unframed backdrop', () => {
  const data = soilPatches(2, 3), heights = new Map<string, number>();
  let shared = 0;
  expect(data.positions!.length / 3).toBe(6 * 25);
  for (let i = 0; i < data.positions!.length; i += 3) {
    expect(data.normals![i + 1]).toBeGreaterThan(.97);
    const key = `${data.positions![i].toFixed(6)},${data.positions![i + 2].toFixed(6)}`, height = data.positions![i + 1];
    if (heights.has(key)) { expect(height).toBeCloseTo(heights.get(key)!, 7); shared++; } else heights.set(key, height);
  }
  expect(shared).toBeGreaterThan(0);
  const flat = surroundingSoil();
  for (let i = 0; i < flat.positions!.length; i += 3) { expect(flat.positions![i + 1]).toBe(0); expect(flat.normals![i + 1]).toBe(1); }
  expect(flat.positions!.length / 3).toBe(4);
});
