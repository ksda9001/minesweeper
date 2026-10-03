export type Difficulty = 'beginner' | 'intermediate' | 'expert' | 'custom';
export type Status = 'ready' | 'playing' | 'won' | 'lost';
export interface Config { width: number; height: number; mines: number }
export interface Cell { mine: boolean; revealed: boolean; flagged: boolean; adjacent: number }
export const PRESETS: Record<Exclude<Difficulty, 'custom'>, Config> = {
  beginner: { width: 9, height: 9, mines: 10 },
  intermediate: { width: 16, height: 16, mines: 40 },
  expert: { width: 30, height: 16, mines: 99 },
};
export function validate(config: Config, language: 'zh' | 'en' = 'zh'): string | null {
  const { width, height, mines } = config;
  if (![width, height, mines].every(Number.isInteger)) return language === 'zh' ? '请输入整数。' : 'Please enter whole numbers.';
  if (Math.min(width, height) < 5 || Math.min(width, height) > 30 || Math.max(width, height) > 40) return language === 'zh' ? '边长至少为 5，长边最多 40，短边最多 30。' : 'Each side must be at least 5; the longer side allows up to 40 and the shorter up to 30.';
  if (mines < 1 || mines > width * height - 9) return language === 'zh' ? `地雷须为 1–${width * height - 9}，为首次点击保留安全区域。` : `Mines must be 1–${width * height - 9}, leaving room for a safe first opening.`;
  return null;
}
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export class Game {
  readonly config: Config;
  readonly seed: number;
  cells: Cell[];
  status: Status = 'ready';
  startedAt: number | null = null;
  endedAt: number | null = null;
  detonated = -1;
  revision = 0;
  constructor(config: Config, seed = Math.floor(Math.random() * 2 ** 32)) {
    const error = validate(config);
    if (error) throw new Error(error);
    this.config = { ...config };
    this.seed = seed >>> 0;
    this.cells = Array.from({ length: config.width * config.height }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }));
  }
  neighbors(index: number): number[] {
    const { width, height } = this.config;
    const x = index % width, y = Math.floor(index / width), result: number[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height) result.push((y + dy) * width + x + dx);
    }
    return result;
  }
  get remaining(): number { return this.config.mines - this.cells.filter(c => c.flagged).length; }
  elapsed(now: number): number { return this.startedAt === null ? 0 : Math.max(0, ((this.endedAt ?? now) - this.startedAt) / 1000); }
  private generate(first: number): void {
    const safe = new Set([first, ...this.neighbors(first)]);
    const candidates = this.cells.map((_, i) => i).filter(i => !safe.has(i));
    const random = seededRandom(this.seed);
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (const i of candidates.slice(0, this.config.mines)) this.cells[i].mine = true;
    this.cells.forEach((c, i) => c.adjacent = this.neighbors(i).filter(n => this.cells[n].mine).length);
  }
  flag(index: number): number[] {
    const cell = this.cells[index];
    if (!cell || cell.revealed || this.status === 'won' || this.status === 'lost') return [];
    cell.flagged = !cell.flagged;
    this.revision++;
    return [index];
  }
  reveal(index: number, now: number): number[] {
    const cell = this.cells[index];
    if (!cell || cell.flagged || cell.revealed || this.status === 'won' || this.status === 'lost') return [];
    if (this.status === 'ready') {
      this.generate(index);
      this.status = 'playing';
      this.startedAt = now;
    }
    return this.open([index], now);
  }
  chord(index: number, now: number): number[] {
    const c = this.cells[index];
    if (!c || !c.revealed || c.adjacent === 0 || this.status !== 'playing') return [];
    const nearby = this.neighbors(index);
    if (nearby.filter(i => this.cells[i].flagged).length !== c.adjacent) return [];
    return this.open(nearby.filter(i => !this.cells[i].flagged && !this.cells[i].revealed), now);
  }
  private open(indices: number[], now: number): number[] {
    const queue = [...indices], changed: number[] = [];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const i = queue[cursor], c = this.cells[i];
      if (c.revealed || c.flagged) continue;
      c.revealed = true;
      changed.push(i);
      if (c.mine) {
        this.status = 'lost'; this.endedAt = now; this.detonated = i;
        this.cells.forEach((mine, j) => { if (mine.mine && !mine.revealed) { mine.revealed = true; changed.push(j); } });
        break;
      }
      if (c.adjacent === 0) queue.push(...this.neighbors(i));
    }
    if (this.status === 'playing' && this.cells.every(c => c.mine || c.revealed)) {
      this.status = 'won'; this.endedAt = now;
      this.cells.forEach((c, i) => { if (c.mine && !c.flagged) { c.flagged = true; changed.push(i); } });
    }
    if (changed.length) this.revision++;
    return [...new Set(changed)];
  }
}
