import { describe, it, expect } from 'vitest';
import { Game, PRESETS, validate } from '../packages/game-core/src/index';
describe('classic rules', () => {
  it('validates custom bounds and keeps a safe opening at maximum density', () => {
    expect(validate({ width: 40, height: 30, mines: 1191 })).toBeNull();
    expect(new Game({ width: 5, height: 40, mines: 30 }).cells).toHaveLength(200);
    expect(validate({ width: 30, height: 40, mines: 1191 })).toBeNull();
    expect(validate({ width: 31, height: 31, mines: 10 })).not.toBeNull();
    for (const config of [{ width: 4, height: 9, mines: 10 }, { width: 9, height: 9, mines: 73 }, { width: NaN, height: 9, mines: 10 }, { width: 9, height: 9, mines: 1.5 }]) expect(validate(config)).not.toBeNull();
    for (let first = 0; first < 25; first++) {
      const g = new Game({ width: 5, height: 5, mines: 16 }, first);
      g.reveal(first, 100);
      expect([first, ...g.neighbors(first)].every(i => !g.cells[i].mine)).toBe(true);
      expect(g.cells.filter(c => c.mine)).toHaveLength(16);
    }
  });
  it('reproduces a board from seed and first click with correct neighbor counts', () => {
    const a = new Game(PRESETS.expert, 123), b = new Game(PRESETS.expert, 123);
    a.reveal(95, 1000); b.reveal(95, 1000);
    expect(a.cells).toEqual(b.cells);
    expect(a.cells.filter(c => c.mine)).toHaveLength(99);
    a.cells.forEach((c, i) => expect(c.adjacent).toBe(a.neighbors(i).filter(n => a.cells[n].mine).length));
    expect(a.neighbors(0)).toEqual([1, 30, 31]);
  });
  it('does not start the clock on flags or blocked clicks; reveals a flood', () => {
    const g = new Game(PRESETS.beginner, 7);
    g.flag(40); g.reveal(40, 1000);
    expect(g.status).toBe('ready'); expect(g.remaining).toBe(9); expect(g.elapsed(5000)).toBe(0);
    g.flag(40);
    expect(g.reveal(40, 2000).length).toBeGreaterThan(1);
    expect(g.elapsed(5500)).toBe(3.5);
    expect(g.flag(40)).toEqual([]);
  });
  it('wins on every safe cell and freezes the timer and actions', () => {
    const g = new Game(PRESETS.beginner, 2); g.reveal(40, 1000);
    g.cells.forEach((c, i) => { if (!c.mine) g.reveal(i, 9000); });
    expect(g.status).toBe('won'); expect(g.remaining).toBe(0); expect(g.elapsed(50000)).toBe(8);
    expect(g.flag(0)).toEqual([]); expect(g.reveal(0, 50000)).toEqual([]);
  });
  it('chords correctly and an incorrect flag can still cause a loss', () => {
    for (const correct of [true, false]) {
      const g = new Game(PRESETS.intermediate, 12); g.reveal(100, 100);
      const i = g.cells.findIndex((c, i) => c.revealed && c.adjacent > 0 && g.neighbors(i).filter(n => !g.cells[n].revealed && !g.cells[n].mine).length >= c.adjacent);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(g.chord(i, 200)).toEqual([]);
      const nearby = g.neighbors(i);
      nearby.filter(n => correct ? g.cells[n].mine : !g.cells[n].mine && !g.cells[n].revealed).slice(0, g.cells[i].adjacent).forEach(n => g.flag(n));
      expect(g.chord(i, 900).length).toBeGreaterThan(0);
      expect(g.status).toBe(correct ? 'playing' : 'lost');
      if (!correct) { expect(g.elapsed(9000)).toBe(0.8); expect(g.cells.filter(c => c.mine).every(c => c.revealed)).toBe(true); }
    }
  });
});
