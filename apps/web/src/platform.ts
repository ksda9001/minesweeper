import { Capacitor } from '@capacitor/core';
import { validate, type Difficulty, type Config } from '../../../packages/game-core/src/index';
import type { BoardRenderer, Quality } from '../../../packages/renderer/src/index';
import type { Language, LanguageOption } from './i18n';
export interface Settings { language: LanguageOption; quality: Quality; reducedMotion: boolean; contrast: boolean; motionIntensity: number; sensitivity: number; master: number; effects: number; ambient: number; shortcuts: boolean }
export const defaults: Settings = { language: 'auto', quality: 'auto', reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, contrast: false, motionIntensity: 0.9, sensitivity: 1.2, master: 0.9, effects: 0.85, ambient: 0.18, shortcuts: true };
export function loadSettings(): Settings {
  try {
    const value = JSON.parse(localStorage.getItem('real-mines-settings') ?? '{}');
    const s = { ...defaults };
    if (['auto', 'zh', 'en'].includes(value.language)) s.language = value.language;
    if (['auto', 'low', 'medium', 'high', 'ultra'].includes(value.quality)) s.quality = value.quality;
    for (const key of ['reducedMotion', 'contrast', 'shortcuts'] as const) if (typeof value[key] === 'boolean') s[key] = value[key];
    for (const key of ['motionIntensity', 'sensitivity', 'master', 'effects', 'ambient'] as const) if (typeof value[key] === 'number' && Number.isFinite(value[key])) s[key] = Math.max(0, Math.min(key === 'sensitivity' ? 2 : 1, value[key]));
    return s;
  } catch { return { ...defaults }; }
}
export function saveSettings(settings: Settings): boolean {
  try { localStorage.setItem('real-mines-settings', JSON.stringify(settings)); return true; } catch { return false; }
}
export type Score = Config & { mode: Difficulty; seconds: number; finishedAt: string };
export function loadScores(): Score[] {
  try {
    const saved = JSON.parse(localStorage.getItem('real-mines-scores') ?? '[]');
    if (!Array.isArray(saved)) return [];
    return saved.filter((s): s is Score => s !== null && typeof s === 'object' && ['beginner', 'intermediate', 'expert', 'custom'].includes(s.mode) && !validate(s) && typeof s.seconds === 'number' && Number.isFinite(s.seconds) && s.seconds >= 0 && typeof s.finishedAt === 'string' && Number.isFinite(Date.parse(s.finishedAt)));
  } catch { return []; }
}
export function saveScores(scores: Score[]): boolean {
  // ponytail: localStorage history; use IndexedDB if records exceed the browser quota.
  try { localStorage.setItem('real-mines-scores', JSON.stringify(scores)); return true; } catch { return false; }
}
export async function enableMotion(renderer: BoardRenderer, language: Language): Promise<() => void> {
  if (!isSecureContext && !Capacitor.isNativePlatform()) throw new Error(language === 'zh' ? '设备姿态需要 HTTPS 或本机安全环境。' : 'Device tilt requires HTTPS or a secure local environment.');
  if (typeof DeviceOrientationEvent === 'undefined') throw new Error(language === 'zh' ? '此设备不支持姿态感应。' : 'Device tilt is not supported on this device.');
  const orientation = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
  if (orientation.requestPermission && await orientation.requestPermission() !== 'granted') throw new Error(language === 'zh' ? '姿态权限未获允许；可随时再次开启。' : 'Tilt permission was denied. You can enable it again anytime.');
  if (Capacitor.isNativePlatform()) {
    const { Motion } = await import('@capacitor/motion');
    const handle = await Motion.addListener('orientation', e => renderer.orientation(e.beta, e.gamma));
    return () => { void handle.remove(); renderer.stopMotion(); };
  }
  const listener = (e: DeviceOrientationEvent) => renderer.orientation(e.beta, e.gamma);
  window.addEventListener('deviceorientation', listener);
  return () => { window.removeEventListener('deviceorientation', listener); renderer.stopMotion(); };
}
export async function haptic(kind: 'reveal' | 'flag' | 'lost' | 'won') {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
      if (kind === 'lost' || kind === 'won') await Haptics.notification({ type: kind === 'won' ? NotificationType.Success : NotificationType.Error });
      else await Haptics.impact({ style: ImpactStyle.Light });
    } else if (kind !== 'reveal') navigator.vibrate?.(kind === 'lost' ? [80, 40, 80] : kind === 'won' ? [30, 40, 30] : 15);
  } catch { /* Haptics is optional. */ }
}
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wind: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private settings = defaults;
  private lastBlast = -Infinity;
  setSettings(settings: Settings) { this.settings = settings; if (this.ctx && this.master && this.wind) { this.master.gain.setTargetAtTime(settings.master, this.ctx.currentTime, 0.1); this.wind.gain.setTargetAtTime(settings.ambient * 0.045, this.ctx.currentTime, 0.4); } }
  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext(); this.master = this.ctx.createGain();
        const limiter = this.ctx.createDynamicsCompressor(); limiter.threshold.value = -6; limiter.knee.value = 6; limiter.ratio.value = 12; limiter.attack.value = .003; limiter.release.value = .12;
        this.master.connect(limiter); limiter.connect(this.ctx.destination);
        this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 3, this.ctx.sampleRate); const data = this.noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const source = this.ctx.createBufferSource(); source.buffer = this.noise; source.loop = true;
        const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 350;
        this.wind = this.ctx.createGain(); source.connect(filter); filter.connect(this.wind); this.wind.connect(this.master); source.start(); this.setSettings(this.settings);
      } catch { return; }
    }
    void this.ctx.resume().catch(() => {});
  }
  play(kind: 'reveal' | 'flag' | 'lost' | 'won') {
    if (kind === 'lost') { const now = performance.now(); if (now - this.lastBlast < 80) return; this.lastBlast = now; }
    this.unlock(); if (!this.ctx || !this.master || !this.noise) return;
    const now = this.ctx.currentTime, duration = kind === 'lost' ? 0.45 : 0.12;
    const source = this.ctx.createBufferSource(); source.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = kind === 'lost' ? 180 : kind === 'flag' ? 1300 : 800;
    const gain = this.ctx.createGain(); gain.gain.setValueAtTime(this.settings.effects * (kind === 'lost' ? .6 : .42), now); gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(now, Math.random()); source.stop(now + duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    if (kind === 'won') for (let i = 0; i < 3; i++) { const tone = this.ctx.createOscillator(), envelope = this.ctx.createGain(); tone.frequency.value = [523, 659, 784][i]; envelope.gain.setValueAtTime(0.13 * this.settings.effects, now + i * 0.1); envelope.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4); tone.connect(envelope); envelope.connect(this.master); tone.start(now + i * 0.1); tone.stop(now + i * 0.1 + 0.4); tone.onended = () => { tone.disconnect(); envelope.disconnect(); }; }
  }
  suspend() { void this.ctx?.suspend(); }
  dispose() { void this.ctx?.close(); }
}
