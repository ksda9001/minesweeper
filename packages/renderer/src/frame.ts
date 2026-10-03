import { Scene } from '@babylonjs/core/scene';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';

// The bezel shares the game engine. A second scene provides a full-screen,
// physically lit relief around the board's viewport, without a second GPU context.
export class WoodlandFrame {
  readonly scene: Scene;
  private camera: ArcRotateCamera;
  private light: DirectionalLight;
  private bark: PBRMaterial;
  private wood: PBRMaterial;
  private width = 0;
  private height = 0;
  private layoutKey = '';
  constructor(engine: AbstractEngine, private canvas: HTMLCanvasElement) {
    this.scene = new Scene(engine); this.scene.autoClear = false;
    this.scene.autoClearDepthAndStencil = true;
    this.scene.imageProcessingConfiguration.exposure = 1;
    this.camera = new ArcRotateCamera('bezel camera', -Math.PI / 2, 0.001, 2000, Vector3.Zero(), this.scene);
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA; this.camera.maxZ = 5000;
    this.light = new DirectionalLight('bezel daylight', new Vector3(-0.5, -1, 0.35), this.scene); this.light.intensity = 1.3;
    const fill = new HemisphericLight('bezel bounce', Vector3.Up(), this.scene); fill.intensity = 0.28;
    this.bark = this.material('carved bark relief', '/assets/branch-relief.png', true);
    this.wood = this.material('rough sawn timber', '/assets/rough-planks.png', false);
  }
  private material(name: string, url: string, alpha: boolean) {
    const m = new PBRMaterial(name, this.scene); m.metallic = 0; m.roughness = 0.93;
    m.albedoTexture = new Texture(url, this.scene); m.albedoTexture.hasAlpha = alpha;
    m.useAlphaFromAlbedoTexture = alpha;
    if (alpha) { m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST; m.alphaCutOff = 0.25; }
    m.backFaceCulling = false; return m;
  }
  async ready() {
    // Derive tangent normals from texture detail. This is height-based relief,
    // not an inferred complete 3D reconstruction of the photograph.
    for (const [m, url] of [[this.bark, '/assets/branch-relief.png'], [this.wood, '/assets/rough-planks.png']] as const) {
      m.bumpTexture = await reliefNormal(url, this.scene, m.name);
      m.bumpTexture.level = m === this.bark ? 1.3 : 1.1;
    }
  }
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const field = this.canvas.parentElement!.querySelector('.field')!.getBoundingClientRect(), rect = this.canvas.getBoundingClientRect();
    const counters = [...this.canvas.parentElement!.querySelectorAll('.counter')].map(el => el.getBoundingClientRect());
    const key = JSON.stringify([w, h, field.top, field.bottom, counters.map(box => [box.left, box.top, box.width, box.height])]);
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    this.width = w; this.height = h;
    this.scene.meshes.slice().forEach(m => m.dispose());
    this.camera.orthoLeft = -w / 2; this.camera.orthoRight = w / 2; this.camera.orthoTop = h / 2; this.camera.orthoBottom = -h / 2;
    const border = parseFloat(getComputedStyle(this.canvas.parentElement!).paddingLeft);
    this.rim(0, 0, w, h, border * 1.28);
    for (const [start, end] of [[border * .6, field.top - rect.top + 5], [field.bottom - rect.top - 5, h - border * .6]]) {
      if (end <= start) continue;
      const panel = MeshBuilder.CreateGround('rough plank panel', { width: w - border * 1.2, height: end - start }, this.scene);
      panel.position.set(0, -6, h / 2 - (start + end) / 2); panel.material = this.wood; panel.isPickable = false;
      const uv = panel.getVerticesData(VertexBuffer.UVKind)!;
      for (let i = 0; i < uv.length; i += 2) { uv[i] *= (w - border * 2) / 360; uv[i + 1] *= (end - start) / 360; }
      panel.setVerticesData(VertexBuffer.UVKind, uv);
    }
    for (const counter of this.canvas.parentElement!.querySelectorAll('.counter')) {
      const box = counter.getBoundingClientRect(), size = 10;
      this.rim(box.left - rect.left - size, box.top - rect.top - size, box.width + size * 2, box.height + size * 2, size);
    }
    this.branchRail(border - 4, field.top - rect.top - 6, w - border * 2 + 8, 13);
    this.branchRail(border - 4, field.bottom - rect.top - 5, w - border * 2 + 8, 11);
  }
  private branchRail(x: number, y: number, width: number, height: number) {
    const pieces = Math.max(1, Math.round(width / (height * 5)));
    for (let i = 0; i < pieces; i++) {
      const mesh = MeshBuilder.CreateGround('board edge branch', { width: width / pieces + 1, height }, this.scene);
      mesh.position.set(x + (i + .5) * width / pieces - this.width / 2, 5, this.height / 2 - y - height / 2);
      const uv = mesh.getVerticesData(VertexBuffer.UVKind)!;
      for (let j = 0; j < uv.length; j += 2) { uv[j] = .19 + uv[j] * .62; uv[j + 1] = .825 + uv[j + 1] * .12; }
      mesh.setVerticesData(VertexBuffer.UVKind, uv); mesh.material = this.bark; mesh.isPickable = false;
    }
  }
  private rim(x: number, y: number, width: number, height: number, border: number) {
    const xs = [x, x + border, x + width - border, x + width], ys = [y, y + border, y + height - border, y + height], uv = [0, .24, .76, 1];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      if (row === 1 && col === 1) continue;
      const spanX = xs[col + 1] - xs[col], spanY = ys[row + 1] - ys[row];
      // Repeat the middle strips at their native proportions. Stretching them
      // across the whole screen flattened the branches into thin ribbons.
      // An odd number of mirrored repeats joins both end corners without a UV jump.
      const nx = col === 1 ? Math.max(1, 2 * Math.round((spanX / (border * 2.17) - 1) / 2) + 1) : 1;
      const ny = row === 1 ? Math.max(1, 2 * Math.round((spanY / (border * 2.17) - 1) / 2) + 1) : 1;
      for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
        const mesh = MeshBuilder.CreateGround(`bark ${row}:${col}:${a}:${b}`, { width: spanX / nx, height: spanY / ny, subdivisions: 12, updatable: true }, this.scene);
        mesh.position.set(xs[col] + (a + .5) * spanX / nx - this.width / 2, 3, this.height / 2 - ys[row] - (b + .5) * spanY / ny);
        const coords = mesh.getVerticesData(VertexBuffer.UVKind)!;
        for (let i = 0; i < coords.length; i += 2) { coords[i] = uv[col] + (a % 2 ? 1 - coords[i] : coords[i]) * (uv[col + 1] - uv[col]); coords[i + 1] = 1 - uv[row + 1] + (b % 2 ? 1 - coords[i + 1] : coords[i + 1]) * (uv[row + 1] - uv[row]); }
        mesh.updateVerticesData(VertexBuffer.UVKind, coords);
        const vertices = mesh.getVerticesData(VertexBuffer.PositionKind)!;
        for (let i = 0; i < vertices.length; i += 3) vertices[i + 1] = Math.min(5, border * .08) * Math.sin((vertices[i] + mesh.position.x + vertices[i + 2] + mesh.position.z) * .08);
        const normals: number[] = []; VertexData.ComputeNormals(vertices, mesh.getIndices()!, normals);
        mesh.updateVerticesData(VertexBuffer.PositionKind, vertices); mesh.updateVerticesData(VertexBuffer.NormalKind, normals); mesh.material = this.bark; mesh.isPickable = false;
      }
    }
  }
  render(roll: number, pitch: number) {
    this.resize(); applyTiltLight(this.light, roll, pitch, 1.75);
    this.light.diffuse = new Color3(1, 0.96, 0.88);
    this.scene.render();
  }
  dispose() { this.scene.dispose(); }
}

export function applyTiltLight(light: DirectionalLight, roll: number, pitch: number, intensity: number) {
  const azimuth = -.98 + roll * 1.55, elevation = Math.max(.38, Math.min(1.32, .95 - pitch * .57));
  light.direction.set(Math.sin(azimuth) * Math.cos(elevation), -Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
  light.position.copyFrom(light.direction).scaleInPlace(-32);
  light.intensity = intensity * (1 + pitch * .18);
}

export async function reliefNormal(url: string, scene: Scene, label: string) {
      const img = new Image(); img.src = url; await img.decode();
      const map = new DynamicTexture(`${label} normal`, { width: 512, height: 512 }, scene, true);
      const ctx = map.getContext() as CanvasRenderingContext2D; ctx.drawImage(img, 0, 0, 512, 512);
      const source = ctx.getImageData(0, 0, 512, 512), normal = ctx.createImageData(512, 512);
      const height = (x: number, y: number) => { const i = (Math.max(0, Math.min(511, y)) * 512 + Math.max(0, Math.min(511, x))) * 4; return (source.data[i] * 0.21 + source.data[i + 1] * 0.72 + source.data[i + 2] * 0.07) / 255; };
      for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
        const dx = (height(x - 1, y) - height(x + 1, y)) * 3, dy = (height(x, y - 1) - height(x, y + 1)) * 3;
        const length = Math.hypot(dx, dy, 1), i = (y * 512 + x) * 4;
        normal.data.set([128 + dx / length * 127, 128 + dy / length * 127, 128 + 127 / length, 255], i);
      }
      ctx.putImageData(normal, 0, 0); map.update(); map.gammaSpace = false; return map;
}
