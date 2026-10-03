import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { PointLight } from '@babylonjs/core/Lights/pointLight';

// Visual order only: the game has already ended and its timer is frozen.
export function planDetonations(indices: number[], width: number, origin: number) {
  const distance = (i: number) => Math.hypot(i % width - origin % width, Math.floor(i / width) - Math.floor(origin / width));
  const ordered = [...indices].sort((a, b) => distance(a) - distance(b) || a - b);
  return ordered.map((index, rank) => ({ index, delay: rank * Math.min(160, 3200 / Math.max(1, ordered.length - 1)) }));
}

export class MineExplosions {
  private texture: DynamicTexture;
  private light: PointLight;
  private active: { systems: ParticleSystem[]; end: number }[] = [];
  private lastFlash = -Infinity;
  constructor(private scene: Scene) {
    this.texture = new DynamicTexture('soft dust particle', 64, scene, false);
    const ctx = this.texture.getContext() as CanvasRenderingContext2D;
    const glow = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    glow.addColorStop(0, '#ffffffff'); glow.addColorStop(.35, '#ffffffcc'); glow.addColorStop(1, '#ffffff00');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 64, 64); this.texture.update(); this.texture.hasAlpha = true;
    this.light = new PointLight('blast glow', Vector3.Zero(), scene);
    this.light.diffuse = new Color3(1, .43, .09); this.light.range = 2.2; this.light.intensity = 0;
  }
  burst(position: Vector3, now: number) {
    // Bound particle work on dense custom boards; the full reveal wave still plays.
    if (this.active.length >= 10) this.active.shift()!.systems.forEach(p => p.dispose(false));
    const systems: ParticleSystem[] = [];
    for (const ember of [false, true]) {
      const p = new ParticleSystem(ember ? 'blast embers' : 'soil and smoke', ember ? 24 : 34, this.scene);
      p.particleTexture = this.texture; p.emitter = position.clone();
      p.minEmitBox = new Vector3(-.13, .04, -.13); p.maxEmitBox = new Vector3(.13, .13, .13);
      p.direction1 = new Vector3(-1.3, .6, -1.3); p.direction2 = new Vector3(1.3, 2.2, 1.3);
      p.minEmitPower = ember ? 1.3 : .45; p.maxEmitPower = ember ? 2.6 : 1.15;
      p.gravity = new Vector3(0, ember ? -4 : .25, 0);
      p.minLifeTime = ember ? .18 : .65; p.maxLifeTime = ember ? .5 : 1.05;
      p.minSize = ember ? .035 : .18; p.maxSize = ember ? .11 : .38;
      p.color1 = ember ? new Color4(1, .65, .13, 1) : new Color4(.26, .19, .10, .65);
      p.color2 = ember ? new Color4(1, .18, .025, 1) : new Color4(.10, .085, .065, .48);
      p.colorDead = new Color4(.08, .06, .035, 0);
      p.blendMode = ember ? ParticleSystem.BLENDMODE_ADD : ParticleSystem.BLENDMODE_STANDARD;
      p.addSizeGradient(0, .3); p.addSizeGradient(.35, 1); p.addSizeGradient(1, ember ? .05 : 2.1);
      p.manualEmitCount = ember ? 24 : 34; p.emitRate = 0; p.updateSpeed = .012;
      p.start(); systems.push(p);
    }
    this.active.push({ systems, end: now + 1250 });
    this.light.position.copyFrom(position); this.light.position.y += .6; this.lastFlash = now;
  }
  tick(now: number) {
    this.light.intensity = Math.max(0, 1 - (now - this.lastFlash) / 180) * 1.8;
    this.active = this.active.filter(burst => { if (now < burst.end) return true; burst.systems.forEach(p => p.dispose(false)); return false; });
  }
  clear() { this.active.forEach(b => b.systems.forEach(p => p.dispose(false))); this.active = []; this.light.intensity = 0; this.lastFlash = -Infinity; }
  dispose() { this.clear(); this.light.dispose(); this.texture.dispose(); }
}
