import { expect, it } from 'vitest';
import { planDetonations } from '../packages/renderer/src/explosions';

it('propagates the visual chain from the hit mine outward with a bounded duration', () => {
  const chain = planDetonations([80, 20, 21, 0], 9, 20);
  expect(chain.map(e => e.index)).toEqual([20, 21, 0, 80]);
  expect(chain[0].delay).toBe(0);
  expect(chain.every((e, i) => i === 0 || e.delay > chain[i - 1].delay)).toBe(true);
  const dense = planDetonations(Array.from({ length: 1191 }, (_, i) => i), 40, 20);
  expect(dense).toHaveLength(1191); expect(dense.at(-1)!.delay).toBeCloseTo(3200, 6);
  expect(planDetonations([], 9, 0)).toEqual([]);
});
