import { Engine } from '@babylonjs/core/Engines/engine';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.dynamicTexture';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { WoodlandFrame, reliefNormal, applyTiltLight } from './frame';
import { MineExplosions, planDetonations } from './explosions';
import { soilPatches, surroundingSoil, SoilBackdrop } from './soil';
import { Vector3, Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { ShaderLanguage } from '@babylonjs/core/Materials/shaderLanguage';
import type { UniformBuffer } from '@babylonjs/core/Materials/uniformBuffer';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { HDRCubeTexture } from '@babylonjs/core/Materials/Textures/hdrCubeTexture';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Rendering/prePassRendererSceneComponent';
import '@babylonjs/core/Materials/Textures/Loaders/hdrTextureLoader';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import '@babylonjs/core/Meshes/instancedMesh';
import '@babylonjs/core/Culling/ray';
import { Game, seededRandom } from '../../game-core/src/index';

export type Quality = 'auto' | 'low' | 'medium' | 'high' | 'ultra';
export type Action = 'reveal' | 'flag' | 'chord';
export interface RenderSettings { quality: Quality; reducedMotion: boolean; contrast: boolean; motionIntensity: number; sensitivity: number; shortcuts: boolean }
const profiles = { low: { blades: 64, shadow: 0, scale: 1.25 }, medium: { blades: 120, shadow: 1024, scale: 1 }, high: { blades: 180, shadow: 2048, scale: 1 }, ultra: { blades: 280, shadow: 2048, scale: 0.8 } };
class GrassWind extends MaterialPluginBase {
  time = 0;
  constructor(material: PBRMaterial) { super(material, 'GrassWind', 200, {}, true, true); }
  isCompatible() { return true; }
  getClassName() { return 'GrassWind'; }
  getUniforms() { return { ubo: [{ name: 'windTime', size: 1, type: 'float' }] }; }
  bindForSubMesh(buffer: UniformBuffer) { buffer.updateFloat('windTime', this.time); }
  getCustomCode(type: string, language: ShaderLanguage) {
    if (type !== 'vertex') return null;
    const t = language === ShaderLanguage.WGSL ? 'uniforms.windTime' : 'windTime';
    const p = language === ShaderLanguage.WGSL ? 'vertexInputs.world3' : 'world3';
    return { CUSTOM_VERTEX_UPDATE_POSITION: `
      #ifdef INSTANCES
      positionUpdated.x += sin(${t} * 1.2 + ${p}.x * 1.1 + ${p}.z * 0.9) * positionUpdated.y * positionUpdated.y * 0.14;
      positionUpdated.z += cos(${t} * 0.8 + ${p}.z) * positionUpdated.y * positionUpdated.y * 0.08;
      #endif` };
  }
}
export async function createRenderer(canvas: HTMLCanvasElement, action: (index: number, kind: Action) => void, pressed: (value: boolean) => void, selected: (index: number) => void = () => {}, detonated: () => void = () => {}) {
  let engine: Engine | WebGPUEngine;
  try {
    if (!await WebGPUEngine.IsSupportedAsync) throw new Error('WebGPU unavailable');
    const gpu = new WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: false,
      glslangOptions: { jsPath: '/assets/glslang.js', wasmPath: '/assets/glslang.wasm' },
      twgslOptions: { jsPath: '/assets/twgsl.js', wasmPath: '/assets/twgsl.wasm' },
    });
    try { await gpu.initAsync(); engine = gpu; } catch (error) { gpu.dispose(); throw error; }
  } catch { engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: true }); }
  return new BoardRenderer(canvas, engine, action, pressed, selected, detonated);
}

export class BoardRenderer {
  private scene: Scene;
  private bezel: WoodlandFrame;
  private camera: ArcRotateCamera;
  private sun: DirectionalLight;
  private shadow: ShadowGenerator | null = null;
  private game: Game | null = null;
  private boardMeshes: AbstractMesh[] = [];
  private tileMeshes: AbstractMesh[] = [];
  private markers: (Mesh | null)[] = [];
  private flags: (Mesh | null)[] = [];
  private grass: Mesh | null = null;
  private matrices = new Float32Array();
  private grassMaterial: PBRMaterial;
  private wind: GrassWind;
  private bladeCount = 0;
  private turf: PBRMaterial;
  private earth: PBRMaterial;
  private backdrop: PBRMaterial;
  private flagRed: PBRMaterial;
  private poleMaterial: PBRMaterial;
  private mineMaterial: PBRMaterial;
  private mineSource: Mesh | null = null;
  private explosions: MineExplosions;
  private pendingDetonations: { index: number; at: number }[] = [];
  private digitMaterials: PBRMaterial[] = [];
  private solidDigits: PBRMaterial[] = [];
  private digitModels = new Map<number, Mesh>();
  private sources: { name: string; meshes: Mesh[]; perCell: number }[] = [];
  private foliage: { mesh: Mesh; matrices: Float32Array; perCell: number }[] = [];
  private propsLoaded = false;
  private bark: PBRMaterial;
  private digitSource: Mesh;
  private animations: { index: number; start: number }[] = [];
  private settings: RenderSettings = { quality: 'auto', reducedMotion: false, contrast: false, motionIntensity: 0.7, sensitivity: 1, shortcuts: true };
  private actualQuality: Exclude<Quality, 'auto'> = 'medium';
  private hover: Mesh;
  private collider: Mesh | null = null;
  private selected = 0;
  private roll = 0;
  private pitch = 0;
  private smoothRoll = 0;
  private smoothPitch = 0;
  private center: { beta: number; gamma: number } | null = null;
  private baseRadius = 20;
  private viewAspect = 1;
  private pointers = new Map<number, { x: number; y: number; startX: number; startY: number; dragged: boolean; cell: number; button: number; timer?: ReturnType<typeof setTimeout> }>();
  private abort = new AbortController();
  private resizeObserver: ResizeObserver;
  private benchmark: number[] = [];
  private autoMeasured = false;
  private lastFrame = performance.now();
  private frame = 0;
  readonly backend: string;
  constructor(private canvas: HTMLCanvasElement, private engine: Engine | WebGPUEngine, private action: (index: number, kind: Action) => void, private pressed: (value: boolean) => void, private onSelect: (index: number) => void, private onDetonate: () => void) {
    this.backend = engine instanceof WebGPUEngine ? 'WebGPU' : 'WebGL';
    this.scene = new Scene(engine);
    this.explosions = new MineExplosions(this.scene);
    this.bezel = new WoodlandFrame(engine, canvas);
    this.scene.clearColor = new Color4(0, 0, 0, 0);
    this.scene.imageProcessingConfiguration.exposure = 1;
    this.scene.imageProcessingConfiguration.contrast = 1.1;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = 1;
    this.scene.environmentTexture = new HDRCubeTexture('/assets/daylight.hdr', this.scene, 128, false, true, false, true);
    this.scene.environmentIntensity = 0.45;
    this.camera = new ArcRotateCamera('macro camera', -Math.PI / 2, 0.001, 20, Vector3.Zero(), this.scene);
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.minZ = 0.1; this.camera.maxZ = 200;
    this.camera.fov = 0.62;
    this.sun = new DirectionalLight('daylight', new Vector3(-0.6, -1, 0.4), this.scene);
    this.sun.position = new Vector3(12, 24, -12); this.sun.intensity = 1.55;
    const sky = new HemisphericLight('sky bounce', Vector3.Up(), this.scene); sky.intensity = 0.28; sky.groundColor = new Color3(0.2, 0.14, 0.08);
    this.earth = this.material('rich soil', '#ffffff', 0.96);
    this.earth.albedoTexture = new Texture('/assets/soil-relief.png', this.scene);
    this.earth.bumpTexture = new Texture('/assets/soil-normal.jpg', this.scene);
    this.earth.bumpTexture.level = 0.6;
    this.earth.metallicTexture = new Texture('/assets/soil-rough.jpg', this.scene);
    this.earth.useRoughnessFromMetallicTextureAlpha = false; this.earth.useRoughnessFromMetallicTextureGreen = true; this.earth.useMetallnessFromMetallicTextureBlue = false;
    this.turf = this.material('living turf', '#b5ce91', 0.98);
    this.turf.albedoTexture = new Texture('/assets/turf-detail.png', this.scene);
    this.turf.bumpTexture = new Texture('/assets/grass-normal.jpg', this.scene);
    this.turf.bumpTexture.level = 0.55;
    this.turf.metallicTexture = new Texture('/assets/grass-rough.jpg', this.scene);
    this.turf.useRoughnessFromMetallicTextureAlpha = false; this.turf.useRoughnessFromMetallicTextureGreen = true; this.turf.useMetallnessFromMetallicTextureBlue = false;
    for (const texture of [this.turf.albedoTexture, this.turf.bumpTexture, this.turf.metallicTexture]) { (texture as Texture).uScale = (texture as Texture).vScale = 1; }
    this.flagRed = this.material('red canvas flag', '#ffffff', 0.86);
    this.flagRed.backFaceCulling = false; this.flagRed.twoSidedLighting = true;
    this.flagRed.sheen.isEnabled = true; this.flagRed.sheen.intensity = .15; this.flagRed.sheen.color = new Color3(.9, .3, .17);
    const clothTexture = new DynamicTexture('woven red flag', { width: 512, height: 384 }, this.scene, true);
    const cloth = clothTexture.getContext() as CanvasRenderingContext2D;
    const dye = cloth.createLinearGradient(0, 0, 512, 384); dye.addColorStop(0, '#ed3b22'); dye.addColorStop(.5, '#b71d12'); dye.addColorStop(1, '#e83a23');
    cloth.fillStyle = dye; cloth.fillRect(0, 0, 512, 384);
    const weave = new DynamicTexture('flag cotton weave normal', { width: 512, height: 384 }, this.scene, true);
    const weaveCtx = weave.getContext() as CanvasRenderingContext2D, threads = weaveCtx.createImageData(512, 384);
    for (let y = 0; y < 384; y++) for (let x = 0; x < 512; x++) {
      const warp = Math.sin(x * Math.PI / 3), weft = Math.sin(y * Math.PI / 3), alternate = (Math.floor(x / 6) + Math.floor(y / 6)) % 2;
      const dx = warp * (alternate ? .3 : .65), dy = weft * (alternate ? .65 : .3), length = Math.hypot(dx, dy, 1);
      threads.data.set([128 + dx / length * 127, 128 + dy / length * 127, 128 + 127 / length, 255], (y * 512 + x) * 4);
      if (x % 6 === 0 || y % 6 === 0) { cloth.fillStyle = alternate ? '#3609002b' : '#ffca8d26'; cloth.fillRect(x, y, 1, 1); }
    }
    cloth.strokeStyle = '#6d160e'; cloth.lineWidth = 5; cloth.strokeRect(5, 5, 502, 374);
    cloth.setLineDash([3, 5]); cloth.strokeStyle = '#ffb795'; cloth.lineWidth = 1; cloth.strokeRect(8, 8, 496, 368);
    clothTexture.update(); this.flagRed.albedoTexture = clothTexture;
    weaveCtx.putImageData(threads, 0, 0); weave.update(); weave.gammaSpace = false; this.flagRed.bumpTexture = weave; weave.level = .65;
    this.poleMaterial = this.material('weathered wood stake', '#bd915c', .88);
    this.poleMaterial.albedoTexture = new Texture('/assets/wood-color.jpg', this.scene);
    this.poleMaterial.bumpTexture = new Texture('/assets/bark-normal.jpg', this.scene); this.poleMaterial.bumpTexture.level = .35;
    this.mineMaterial = this.material('scorched soil', '#342a1e', 1);
    this.mineMaterial.bumpTexture = this.earth.bumpTexture;
    this.grassMaterial = this.makeGrassMaterial();
    this.bark = this.material('willow bark', '#b69c73', 0.95);
    this.bark.albedoTexture = new Texture('/assets/bark-color.jpg', this.scene); this.bark.bumpTexture = new Texture('/assets/bark-normal.jpg', this.scene); this.bark.bumpTexture.level = 0.65;
    this.bark.metallicTexture = new Texture('/assets/bark-rough.jpg', this.scene); this.bark.useRoughnessFromMetallicTextureAlpha = false; this.bark.useRoughnessFromMetallicTextureGreen = true; this.bark.useMetallnessFromMetallicTextureBlue = false;
    this.wind = new GrassWind(this.grassMaterial);
    const surroundings = new Mesh('continuous surrounding soil', this.scene); surroundingSoil().applyToMesh(surroundings);
    surroundings.position.set(1.7, -.65, 2.3);
    this.backdrop = this.earth.clone('surrounding soil material')!; this.backdrop.albedoColor = new Color3(.82, .78, .72);
    this.backdrop.bumpTexture = null;
    new SoilBackdrop(this.backdrop);
    surroundings.material = this.backdrop; surroundings.receiveShadows = true; surroundings.isPickable = false;
    this.makeDigits();
    this.digitSource = MeshBuilder.CreateGround('number shader warmup', { width: 0.72, height: 0.72 }, this.scene); this.digitSource.isVisible = false;
    this.hover = MeshBuilder.CreateBox('focus outline', { width: 0.99, depth: 0.99, height: 0.008 }, this.scene);
    const hoverMaterial = new StandardMaterial('focus material', this.scene); hoverMaterial.emissiveColor = new Color3(1, 0.85, 0.4); hoverMaterial.alpha = 0.16;
    this.hover.material = hoverMaterial; this.hover.isPickable = false; this.hover.setEnabled(false);
    this.bindInput();
    this.resizeObserver = new ResizeObserver(() => {
      this.engine.resize();
      if (this.game) this.fit(false);
    }); this.resizeObserver.observe(canvas);
    this.engine.runRenderLoop(() => {
      if (document.hidden) return;
      const now = performance.now(), dt = Math.min((now - this.lastFrame) / 1000, 0.05); this.lastFrame = now;
      this.smoothRoll += (this.roll - this.smoothRoll) * (1 - Math.exp(-8 * dt)); this.smoothPitch += (this.pitch - this.smoothPitch) * (1 - Math.exp(-8 * dt));
      applyTiltLight(this.sun, this.smoothRoll, this.smoothPitch, 2.05);
      (this.scene.environmentTexture as HDRCubeTexture).rotationY = this.smoothRoll * .65;
      this.wind.time = this.settings.reducedMotion ? 0 : now / 1000;
      const detonations: number[] = [];
      while (this.pendingDetonations.length && this.pendingDetonations[0].at <= now) detonations.push(this.pendingDetonations.shift()!.index);
      if (detonations.length) this.update(detonations, false);
      for (const index of detonations) {
        const { x, z } = this.location(index);
        this.explosions.burst(new Vector3(x, .12, z), now); this.onDetonate();
      }
      this.explosions.tick(now);
      this.project();
      for (const animation of this.animations) {
        const t = Math.max(0, Math.min(1, (now - animation.start) / 220));
        this.tileMeshes[animation.index].position.y = 0.03 - t * 0.23;
        if (t >= 1) this.tileMeshes[animation.index].setEnabled(false);
      }
      this.animations = this.animations.filter(a => now - a.start < 220);
      this.scene.render();
      this.bezel.render(this.smoothRoll, this.smoothPitch);
      if (this.settings.quality === 'auto' && !this.autoMeasured && this.game?.status !== 'lost' && ++this.frame > 60) {
        this.benchmark.push(this.engine.getFps());
        if (this.benchmark.length === 90) {
          this.autoMeasured = true;
          const sorted = this.benchmark.sort((a, b) => a - b), median = sorted[45];
          this.actualQuality = median < 35 ? 'low' : median < 55 ? 'medium' : 'high';
          if (this.game) this.reset(this.game, this.settings);
        }
      }
    });
  }
  private material(name: string, hex: string, roughness: number, metallic = 0): PBRMaterial {
    const m = new PBRMaterial(name, this.scene); m.albedoColor = Color3.FromHexString(hex); m.roughness = roughness; m.metallic = metallic; return m;
  }
  private makeGrassMaterial(): PBRMaterial {
    const m = this.material('living grass blades', '#719529', 0.9);
    m.directIntensity = 0.85; m.environmentIntensity = 0.5;
    m.backFaceCulling = false; m.twoSidedLighting = true;
    m.subSurface.isTranslucencyEnabled = true; m.subSurface.translucencyIntensity = 0.12; m.subSurface.tintColor = new Color3(0.18, 0.3, 0.07);
    return m;
  }
  async loadProps() {
    if (this.propsLoaded) return;
    const mine = await LoadAssetContainerAsync('/assets/mine.glb', this.scene); mine.addAllToScene();
    for (const material of mine.materials) if (material instanceof PBRMaterial && material.name === 'Weathered green painted steel') material.albedoColor.scaleInPlace(1.65);
    // Preserve glTF's handedness and hierarchy so painted surfaces keep correct normals.
    this.mineSource = mine.meshes.find(mesh => !mesh.parent) as Mesh;
    this.mineSource.name = 'weathered disc mine source'; this.mineSource.setEnabled(false); this.mineSource.isPickable = false;
    const numbers = await LoadAssetContainerAsync('/assets/numbers.glb', this.scene); numbers.addAllToScene();
    for (const mesh of numbers.meshes) {
      const digit = Number(mesh.name.match(/RM_Number_(\d)/)?.[1]);
      if (!(mesh instanceof Mesh) || !digit) continue;
      mesh.bakeTransformIntoVertices(mesh.computeWorldMatrix(true)); mesh.parent = null; mesh.position.setAll(0); mesh.rotation.setAll(0); mesh.rotationQuaternion = null; mesh.scaling.setAll(1); mesh.isVisible = false; mesh.isPickable = false;
      this.digitModels.set(digit, mesh);
    }
    for (const [name, perCell] of [['clover-patch', 1], ['daisy', 1], ['branch', 0]] as const) {
      const container = await LoadAssetContainerAsync(`/assets/${name}.glb`, this.scene);
      container.addAllToScene();
      const meshes = container.meshes.filter((m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0);
      for (const mesh of meshes) {
        mesh.bakeTransformIntoVertices(mesh.computeWorldMatrix(true)); mesh.parent = null; mesh.position.setAll(0); mesh.rotation.setAll(0); mesh.rotationQuaternion = null; mesh.scaling.setAll(1);
        mesh.isVisible = false; mesh.isPickable = false;
        if (name === 'branch') mesh.material = this.bark;
        if (mesh.material instanceof PBRMaterial) { mesh.material.backFaceCulling = false; mesh.material.twoSidedLighting = true; }
      }
      this.sources.push({ name, meshes, perCell });
    }
    this.propsLoaded = true;
    if (this.game) this.reset(this.game, this.settings);
  }
  private placeProps(_random: () => number) {
    const game = this.game!, { width, height } = game.config, random = seededRandom(game.seed ^ 0xB10F);
    const matrix = new Matrix();
    for (const source of this.sources) {
      if (source.name === 'branch') continue;
      const perCell = source.name === 'clover-patch' && this.actualQuality === 'low' ? 1 : source.perCell;
      const matrices = new Float32Array(game.cells.length * perCell * 16);
      for (let i = 0; i < game.cells.length; i++) {
        const { x, z } = this.location(i);
        for (let j = 0; j < perCell; j++) {
          const scale = source.name === 'daisy' ? 0.8 + random() * 0.6 : 0.7 + random() * 0.65;
          const visible = random() < (source.name === 'daisy' ? 0.1 : 0.45);
          Matrix.ComposeToRef(new Vector3(visible ? scale : 0, visible ? scale : 0, visible ? scale : 0), Quaternion.RotationYawPitchRoll(random() * Math.PI * 2, 0, 0), new Vector3(x + (random() - .5) * .72, .13, z + (random() - .5) * .72), matrix);
          matrix.copyToArray(matrices, (i * perCell + j) * 16);
        }
      }
      for (const original of source.meshes) {
        const mesh = original.clone(`instanced ${original.name}`)!; mesh.isVisible = true; mesh.isPickable = false; mesh.receiveShadows = true;
        mesh.thinInstanceSetBuffer('matrix', matrices, 16, false); mesh.thinInstanceRefreshBoundingInfo(true);
        this.foliage.push({ mesh, matrices, perCell }); this.boardMeshes.push(mesh);
        if (this.actualQuality !== 'low') this.shadow?.addShadowCaster(mesh);
      }
    }
  }
  private makeDigits() {
    this.digitMaterials.forEach(m => { m.albedoTexture?.dispose(); m.dispose(); }); this.digitMaterials = [];
    this.solidDigits.forEach(m => m.dispose()); this.solidDigits = [];
    const colors = ['', '#276293', '#466d24', '#b53d27', '#7661a4', '#934425', '#369393', '#e2d9c2', '#b4b6aa', '#c9412b'];
    for (let n = 1; n <= 9; n++) {
      const texture = new DynamicTexture(`marker ${n}`, { width: 128, height: 128 }, this.scene, true);
      const ctx = texture.getContext() as CanvasRenderingContext2D; ctx.clearRect(0, 0, 128, 128); ctx.font = 'bold 100px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = this.settings.contrast ? 10 : 4; ctx.strokeStyle = '#28190e'; ctx.shadowColor = '#120b08b0'; ctx.shadowBlur = 4; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3; ctx.strokeText(n === 9 ? '×' : String(n), 64, 68);
      ctx.fillStyle = this.settings.contrast ? '#ffffff' : colors[n]; ctx.fillText(n === 9 ? '×' : String(n), 64, 68); texture.update(); texture.hasAlpha = true;
      const m = this.material(`painted number ${n}`, '#ffffff', 0.7); m.albedoTexture = texture; m.emissiveColor = new Color3(0.1, 0.1, 0.1); m.backFaceCulling = false; m.useAlphaFromAlbedoTexture = true; m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
      this.digitMaterials[n] = m;
      this.solidDigits[n] = this.material(`enamel number ${n}`, this.settings.contrast ? '#ffffff' : colors[n], 0.6);
      this.solidDigits[n].albedoColor = this.solidDigits[n].albedoColor.toLinearSpace();
    }
  }
  reset(game: Game, settings: RenderSettings) {
    const sameBoard = this.game === game, target = this.camera.target.clone(), zoom = this.camera.radius / this.baseRadius, selected = this.selected;
    this.settings = settings; this.game = game;
    if (settings.quality !== 'auto') this.actualQuality = settings.quality;
    const profile = profiles[this.actualQuality];
    this.engine.setHardwareScalingLevel(profile.scale / Math.min(window.devicePixelRatio, 1.5));
    this.shadow?.dispose(); this.shadow = profile.shadow ? new ShadowGenerator(profile.shadow, this.sun) : null;
    if (this.shadow) { this.shadow.usePercentageCloserFiltering = true; this.shadow.bias = 0.001; this.shadow.normalBias = 0.025; }
    this.animations = []; this.pendingDetonations = []; this.explosions.clear(); this.hover.setEnabled(false);
    this.boardMeshes.forEach(m => m.dispose()); this.boardMeshes = []; this.tileMeshes = []; this.markers = []; this.flags = []; this.foliage = [];
    this.makeDigits();
    const { width, height } = game.config;
    const slab = MeshBuilder.CreateBox('soil cross-section', { width: width + 0.12, depth: height + 0.12, height: 0.55 }, this.scene); slab.position.y = -0.32; slab.material = this.earth; slab.receiveShadows = true; this.boardMeshes.push(slab);
    const collider = MeshBuilder.CreateGround('interaction plane', { width, height: height }, this.scene); collider.position.y = 0.2; collider.isVisible = false; this.collider = collider; this.boardMeshes.push(collider);
    const random = seededRandom(game.seed ^ 0xABCD);
    const positions: number[] = [], indices: number[] = [], normals: number[] = [], colors: number[] = [];
    for (let step = 0; step <= 6; step++) {
      const t = step / 6, w = Math.sin(t * Math.PI) * 0.016 + 0.002 * (1 - t);
      positions.push(-w, t * 0.36, t * t * 0.3, w, t * 0.36, t * t * 0.3);
      for (let side = 0; side < 2; side++) colors.push(0.3 + t * 0.65, 0.4 + t * 0.55, 0.18 + t * 0.5, 1);
      if (step < 6) { const b = step * 2; indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    VertexData.ComputeNormals(positions, indices, normals);
    const blade = new Mesh('instanced grass blades', this.scene), data = new VertexData(); data.positions = positions; data.indices = indices; data.normals = normals; data.colors = colors; data.applyToMesh(blade); blade.material = this.grassMaterial; blade.isPickable = false;
    this.grass = blade; this.boardMeshes.push(blade); this.bladeCount = Math.min(profile.blades, Math.floor(180000 / game.cells.length));
    this.matrices = new Float32Array(game.cells.length * this.bladeCount * 16);
    const matrix = new Matrix();
    const turfSource = MeshBuilder.CreateBox('turf source', { width: 0.94, depth: 0.94, height: 0.16 }, this.scene); turfSource.material = this.turf; turfSource.isVisible = false; turfSource.receiveShadows = true; this.boardMeshes.push(turfSource);
    const soil = new Mesh('square revealed soil patches', this.scene); soilPatches(width, height).applyToMesh(soil);
    soil.material = this.earth; soil.receiveShadows = true; soil.isPickable = false; this.boardMeshes.push(soil);
    for (let i = 0; i < game.cells.length; i++) {
      const { x, z } = this.location(i);
      const tile = turfSource.createInstance(`grass patch ${i}`); tile.isVisible = true; tile.position.set(x, 0.03, z); tile.isPickable = false;
      tile.rotation.y = Math.floor(random() * 2) * Math.PI;
      this.shadow?.addShadowCaster(tile); this.tileMeshes.push(tile); this.boardMeshes.push(tile);
      this.markers.push(null); this.flags.push(null);
      for (let j = 0; j < this.bladeCount; j++) {
        const scale = 0.6 + random() * 0.6;
        Matrix.ComposeToRef(new Vector3(scale, scale, scale), Quaternion.RotationYawPitchRoll(random() * Math.PI * 2, 0, random() * 0.3 - 0.15), new Vector3(x + (random() - 0.5) * 0.72, 0.12, z + (random() - 0.5) * 0.72), matrix);
        matrix.copyToArray(this.matrices, (i * this.bladeCount + j) * 16);
      }
    }
    blade.thinInstanceSetBuffer('matrix', this.matrices, 16, false); blade.thinInstanceRefreshBoundingInfo(true);
    if (this.propsLoaded) this.placeProps(random);
    const pebbleSource = MeshBuilder.CreateIcoSphere('pebble source', { radius: 0.025, subdivisions: 1 }, this.scene); const stoneMaterial = this.material('pebbles', '#77583a', 1); stoneMaterial.albedoColor = stoneMaterial.albedoColor.toLinearSpace(); pebbleSource.material = stoneMaterial; pebbleSource.isVisible = false; this.boardMeshes.push(pebbleSource);
    for (let i = 0; i < Math.min(1200, game.cells.length * 3); i++) { const stone = pebbleSource.clone(`stone ${i}`)!; stone.isVisible = true; stone.position.set((random() - 0.5) * width, -0.002, (random() - 0.5) * height); stone.scaling.set(0.65 + random(), 0.7, 1); stone.rotation.y = random() * 6; stone.isPickable = false; this.boardMeshes.push(stone); }
    this.camera.target.set(0, 0, 0); this.fit(true); this.selected = 0; this.onSelect(0);
    if (sameBoard) { this.camera.target.copyFrom(target); this.camera.radius = this.baseRadius * zoom; this.showFocus(selected); }
    this.update(game.cells.map((_, i) => i), false);
  }
  private location(i: number) { const { width, height } = this.game!.config; return { x: i % width - width / 2 + 0.5, z: (height / 2 - Math.floor(i / width) - 0.5) }; }
  update(changed: number[], animate = true) {
    if (!this.game || !this.grass) return;
    const now = performance.now(), origin = changed[0] ?? 0, originPos = this.location(origin);
    const chain = animate && !this.settings.reducedMotion && this.game.status === 'lost';
    if (chain) this.pendingDetonations = planDetonations(changed.filter(i => this.game!.cells[i].mine), this.game.config.width, this.game.detonated).map(({ index, delay }) => ({ index, at: now + delay }));
    for (const i of changed) {
      const cell = this.game.cells[i], { x, z } = this.location(i);
      if (chain && cell.mine) continue;
      if (cell.revealed) {
        for (let j = 0; j < this.bladeCount; j++) { const offset = (i * this.bladeCount + j) * 16; this.matrices.fill(0, offset, offset + 12); }
        for (const foliage of this.foliage) for (let j = 0; j < foliage.perCell; j++) { const offset = (i * foliage.perCell + j) * 16; foliage.matrices.fill(0, offset, offset + 12); }
        if (animate && !this.settings.reducedMotion && this.tileMeshes[i].isEnabled()) this.animations.push({ index: i, start: now + Math.min(120, Math.hypot(x - originPos.x, z - originPos.z) * 9) });
        else this.tileMeshes[i].setEnabled(false);
        if (!this.markers[i] && cell.mine) this.markers[i] = this.makeMine(i);
        else if (!this.markers[i] && cell.adjacent) {
          const source = this.digitModels.get(cell.adjacent);
          const marker = source ? source.clone(`number ${i}`)! : MeshBuilder.CreateGround(`number ${i}`, { width: 0.72, height: 0.72 }, this.scene);
          if (source) { marker.rotation.y = Math.PI; marker.scaling.setAll(1.35); }
          marker.isVisible = true; marker.position.set(x, 0.018, z); marker.material = source ? this.solidDigits[cell.adjacent] : this.digitMaterials[cell.adjacent]; marker.isPickable = false; this.markers[i] = marker; this.boardMeshes.push(marker); if (source) this.shadow?.addShadowCaster(marker);
        }
      }
      if (cell.flagged && !cell.revealed && !this.flags[i]) this.flags[i] = this.makeFlag(i);
      if ((!cell.flagged || cell.revealed) && this.flags[i]) { this.flags[i]!.dispose(); this.flags[i] = null; }
      if (this.game.status === 'lost' && cell.flagged && !cell.mine && !this.markers[i]) {
        const cross = MeshBuilder.CreateGround(`wrong flag ${i}`, { width: 0.8, height: 0.8 }, this.scene); cross.position.set(x, 0.65, z); cross.material = this.digitMaterials[9]; cross.isPickable = false; this.markers[i] = cross; this.boardMeshes.push(cross);
      }
    }
    this.grass.thinInstanceBufferUpdated('matrix');
    this.foliage.forEach(f => f.mesh.thinInstanceBufferUpdated('matrix'));
  }
  private makeFlag(i: number): Mesh {
    const { x, z } = this.location(i);
    const pole = MeshBuilder.CreateCylinder(`flag ${i}`, { height: .95, diameterTop: .075, diameterBottom: .085, tessellation: 12 }, this.scene); pole.position.set(x - .29, .37, z + .03); pole.rotation.x = -.65; pole.material = this.poleMaterial; pole.isPickable = false;
    // The attached edge is vertical; the free cloth billows out into the top view.
    const paths: Vector3[][] = [];
    for (let row = 0; row <= 12; row++) {
      const v = row / 12, path: Vector3[] = [];
      for (let col = 0; col <= 20; col++) {
        const u = col / 20, fold = Math.sin(u * 8 - v * 2.5) * u;
        path.push(new Vector3(u * .67, .37 - v * .48 * (1 - u * .35) - u * .055 + fold * .08, v * .46 * Math.sin(u * Math.PI / 2) + fold * .105));
      }
      paths.push(path);
    }
    const cloth = MeshBuilder.CreateRibbon(`flag cloth ${i}`, { pathArray: paths, sideOrientation: Mesh.DOUBLESIDE }, this.scene); cloth.material = this.flagRed; cloth.parent = pole; cloth.isPickable = false;
    this.boardMeshes.push(pole); this.shadow?.addShadowCaster(pole, true); return pole;
  }
  private makeMine(i: number): Mesh {
    const { x, z } = this.location(i);
    const mine = this.mineSource!.clone(`mine prop ${i}`)!;
    mine.setEnabled(true); mine.isVisible = true; mine.position.set(x, .018, z); mine.rotationQuaternion = Quaternion.RotationYawPitchRoll(i * 2.399, .08, -.06).multiply(this.mineSource!.rotationQuaternion ?? Quaternion.Identity()); mine.isPickable = false;
    const scorch = MeshBuilder.CreateDisc(`blast mark ${i}`, { radius: .46, tessellation: 40 }, this.scene);
    scorch.rotation.x = Math.PI / 2; scorch.position.set(x, .003, z); scorch.material = this.mineMaterial; scorch.isPickable = false; this.boardMeshes.push(scorch);
    this.boardMeshes.push(mine); this.shadow?.addShadowCaster(mine, true); return mine;
  }
  private fit(reset: boolean) {
    if (!this.game) return;
    const field = this.canvas.parentElement!.querySelector('.field')!.getBoundingClientRect(), canvas = this.canvas.getBoundingClientRect();
    const overlap = Math.min(10, parseFloat(getComputedStyle(this.canvas.parentElement!).paddingLeft) * .2);
    this.camera.viewport = new Viewport((field.left - canvas.left - overlap) / canvas.width, 1 - (field.bottom - canvas.top + overlap) / canvas.height, (field.width + overlap * 2) / canvas.width, (field.height + overlap * 2) / canvas.height);
    this.viewAspect = (field.width + overlap * 2) / Math.max(1, field.height + overlap * 2);
    const zoom = this.camera.radius / this.baseRadius;
    this.baseRadius = Math.max(this.game.config.height + .05, (this.game.config.width + .05) / this.viewAspect) / (2 * Math.tan(this.camera.fov / 2));
    this.camera.radius = this.baseRadius * (reset ? 1 : zoom);
    this.project();
    this.engine.resize();
  }
  private project() {
    this.camera.orthoTop = this.camera.radius * Math.tan(this.camera.fov / 2); this.camera.orthoBottom = -this.camera.orthoTop;
    this.camera.orthoRight = this.camera.orthoTop * this.viewAspect; this.camera.orthoLeft = -this.camera.orthoRight;
  }
  recenter() { this.center = null; this.roll = this.pitch = 0; this.camera.target.set(0, 0, 0); this.fit(true); }
  stopMotion() { this.center = null; this.roll = this.pitch = 0; }
  setMotionSettings(intensity: number, sensitivity: number) { this.settings.motionIntensity = intensity; this.settings.sensitivity = sensitivity; }
  setShortcuts(enabled: boolean) { this.settings.shortcuts = enabled; }
  orientation(beta: number | null, gamma: number | null) {
    if (beta === null || gamma === null || this.settings.reducedMotion) return;
    this.center ??= { beta, gamma };
    const angle = (screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI / 180;
    const b = ((beta - this.center.beta + 540) % 360) - 180, g = ((gamma - this.center.gamma + 540) % 360) - 180;
    const dead = (v: number) => Math.abs(v) < 0.8 ? 0 : Math.max(-1, Math.min(1, v * this.settings.sensitivity / 18)) * this.settings.motionIntensity;
    this.pitch = dead(b * Math.cos(angle) - g * Math.sin(angle)); this.roll = dead(g * Math.cos(angle) + b * Math.sin(angle));
  }
  private pick(clientX: number, clientY: number) {
    if (!this.collider || !this.game) return -1;
    const rect = this.canvas.getBoundingClientRect();
    const point = this.scene.pick(clientX - rect.left, clientY - rect.top, m => m === this.collider)?.pickedPoint;
    if (!point) return -1;
    const { width, height } = this.game.config, x = Math.floor(point.x + width / 2), y = Math.floor(height / 2 - point.z);
    return x < 0 || x >= width || y < 0 || y >= height ? -1 : y * width + x;
  }
  private showFocus(index: number) { if (index < 0 || !this.game) { this.hover.setEnabled(false); return; } this.selected = index; this.onSelect(index); const { x, z } = this.location(index); this.hover.position.set(x, this.game.cells[index].revealed ? 0.025 : 0.14, z); this.hover.setEnabled(true); }
  private pan(dx: number, dy: number) {
    if (!this.game) return;
    const speed = this.camera.radius * Math.tan(this.camera.fov / 2) * 2 / (this.canvas.clientHeight * this.camera.viewport.height);
    this.camera.target.x = Math.max(-this.game.config.width / 2, Math.min(this.game.config.width / 2, this.camera.target.x - dx * speed));
    this.camera.target.z = Math.max(-this.game.config.height / 2, Math.min(this.game.config.height / 2, this.camera.target.z + dy * speed));
  }
  private bindInput() {
    const signal = this.abort.signal;
    this.canvas.addEventListener('focus', () => this.showFocus(this.selected), { signal });
    this.canvas.addEventListener('blur', () => this.hover.setEnabled(false), { signal });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault(), { signal });
    this.canvas.addEventListener('pointerdown', e => {
      e.preventDefault(); this.canvas.focus(); this.canvas.setPointerCapture(e.pointerId);
      const cell = this.pick(e.clientX, e.clientY), p = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, dragged: false, cell, button: e.button, timer: undefined as ReturnType<typeof setTimeout> | undefined };
      this.pointers.set(e.pointerId, p); this.pressed(true); this.showFocus(cell);
      if (this.pointers.size > 1) for (const pointer of this.pointers.values()) { pointer.dragged = true; clearTimeout(pointer.timer); }
      else if (e.pointerType !== 'mouse' && cell >= 0) p.timer = setTimeout(() => { if (!p.dragged) { p.dragged = true; this.action(cell, 'flag'); this.pressed(false); } }, 450);
    }, { signal });
    this.canvas.addEventListener('pointermove', e => {
      const p = this.pointers.get(e.pointerId);
      if (!p) { if (e.pointerType === 'mouse') this.showFocus(this.pick(e.clientX, e.clientY)); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > 8) { p.dragged = true; clearTimeout(p.timer); this.pressed(false); }
      if (this.pointers.size === 2) {
        const other = [...this.pointers.entries()].find(([id]) => id !== e.pointerId)![1];
        const before = Math.hypot(p.x - other.x, p.y - other.y), after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
        if (before > 10 && after > 10) this.camera.radius = Math.max(3, Math.min(this.baseRadius * 1.8, this.camera.radius * before / after));
        this.pan(dx / 2, dy / 2);
      } else if (p.dragged) this.pan(dx, dy);
      p.x = e.clientX; p.y = e.clientY;
    }, { signal });
    const finish = (e: PointerEvent, cancelled = false) => {
      const p = this.pointers.get(e.pointerId); if (!p) return;
      clearTimeout(p.timer); this.pointers.delete(e.pointerId); this.pressed(false);
      if (!cancelled && !p.dragged && p.cell >= 0) this.action(p.cell, p.button === 2 ? 'flag' : p.button === 1 ? 'chord' : 'reveal');
    };
    this.canvas.addEventListener('pointerup', e => finish(e), { signal }); this.canvas.addEventListener('pointercancel', e => finish(e, true), { signal }); this.canvas.addEventListener('lostpointercapture', e => finish(e, true), { signal });
    this.canvas.addEventListener('pointerleave', () => { if (!this.pointers.size) this.hover.setEnabled(false); }, { signal });
    this.canvas.addEventListener('dblclick', e => { const i = this.pick(e.clientX, e.clientY); if (i >= 0) this.action(i, 'chord'); }, { signal });
    this.canvas.addEventListener('wheel', e => { e.preventDefault(); this.camera.radius = Math.max(3, Math.min(this.baseRadius * 1.8, this.camera.radius * Math.exp(e.deltaY * 0.001))); }, { signal, passive: false });
    this.canvas.addEventListener('keydown', e => {
      if (!this.game || !this.settings.shortcuts) return;
      const { width } = this.game.config;
      const offset: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -width, ArrowDown: width };
      if (e.key in offset) { e.preventDefault(); this.showFocus(Math.max(0, Math.min(this.game.cells.length - 1, this.selected + offset[e.key]))); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.action(this.selected, e.shiftKey ? 'chord' : 'reveal'); }
      else if (e.key.toLowerCase() === 'f') { e.preventDefault(); this.action(this.selected, 'flag'); }
      else if (e.key.toLowerCase() === 'c') { e.preventDefault(); this.action(this.selected, 'chord'); }
      else if (e.key === 'Home') { e.preventDefault(); this.recenter(); }
    }, { signal });
  }
  get diagnostics() { return `${this.backend} · ${this.actualQuality} · ${Math.round(this.engine.getFps())} FPS`; }
  async ready() { const soil = await reliefNormal('/assets/soil-relief.png', this.scene, 'soil'); this.earth.bumpTexture?.dispose(); this.earth.bumpTexture = soil; this.mineMaterial.bumpTexture = soil; this.earth.bumpTexture.level = 1.05; await this.bezel.ready(); await Promise.all(this.digitMaterials.slice(1).map(m => m.forceCompilationAsync(this.digitSource))); await Promise.all([this.scene.whenReadyAsync(), this.bezel.scene.whenReadyAsync()]); }
  dispose() {
    this.abort.abort(); this.resizeObserver.disconnect(); for (const p of this.pointers.values()) clearTimeout(p.timer);
    this.engine.stopRenderLoop(); this.explosions.dispose(); this.bezel.dispose(); this.scene.dispose(); this.engine.dispose();
  }
}
