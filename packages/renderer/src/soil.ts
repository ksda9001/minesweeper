import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { ShaderLanguage } from '@babylonjs/core/Materials/shaderLanguage';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { CreateGroundVertexData, CreateTiledGroundVertexData } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';

export function soilPatches(width: number, height: number) {
  const data = CreateTiledGroundVertexData({ xmin: -width / 2, xmax: width / 2, zmin: -height / 2, zmax: height / 2, subdivisions: { w: width, h: height }, precision: { w: 4, h: 4 } });
  const positions = data.positions!, uvs = data.uvs!;
  for (let i = 0, j = 0; i < positions.length; i += 3, j += 2) {
    const edge = Math.min(uvs[j], 1 - uvs[j], uvs[j + 1], 1 - uvs[j + 1]);
    // Adjacent square cells meet at the same shallow, irregular groove instead of a gap.
    positions[i + 1] = -.031 + Math.sin(Math.min(1, edge * 4) * Math.PI / 2) * .017
      + Math.sin(positions[i] * 19 + positions[i + 2] * 31) * Math.cos(positions[i + 2] * 13 - positions[i] * 11) * .0025;
    uvs[j] = .04 + uvs[j] * .92; uvs[j + 1] = .04 + uvs[j + 1] * .92;
  }
  VertexData.ComputeNormals(positions, data.indices!, data.normals!);
  return data;
}

export function surroundingSoil() { return CreateGroundVertexData({ width: 180, height: 180 }); }

// Blend independently rotated, offset crops of the original soil artwork.
// Crops stay inside its unframed center; adjacent regions share the same samples.
export class SoilBackdrop extends MaterialPluginBase {
  constructor(material: PBRMaterial) { super(material, 'SoilBackdrop', 200, {}, true, true); }
  isCompatible() { return true; }
  getClassName() { return 'SoilBackdrop'; }
  getCustomCode(type: string, language: ShaderLanguage) {
    if (type !== 'fragment') return null;
    if (language === ShaderLanguage.WGSL) return {
      CUSTOM_FRAGMENT_DEFINITIONS: `
fn soilCrop(p: vec2f, cell: vec2f) -> vec3f {
  let r = fract(sin(vec3f(dot(cell,vec2f(127.1,311.7)),dot(cell,vec2f(269.5,183.3)),dot(cell,vec2f(419.2,371.9)))) * 43758.5453);
  let a = floor(r.z*4.0)*1.5707963;
  let d = p-cell;
  let q = vec2f(cos(a)*d.x-sin(a)*d.y,sin(a)*d.x+cos(a)*d.y);
  return textureSample(albedoSampler,albedoSamplerSampler,vec2f(0.5)+q*0.25+(r.xy-vec2f(0.5))*0.14).rgb;
}
fn soilSurface(p: vec2f) -> vec3f {
  let cell = floor(p);
  let w = smoothstep(vec2f(0.0),vec2f(1.0),fract(p));
  return mix(mix(soilCrop(p,cell),soilCrop(p,cell+vec2f(1.0,0.0)),w.x),mix(soilCrop(p,cell+vec2f(0.0,1.0)),soilCrop(p,cell+vec2f(1.0)),w.x),w.y);
}`,
      CUSTOM_FRAGMENT_BEFORE_LIGHTS: `
let soilColor = soilSurface(fragmentInputs.vPositionW.xz*2.0);
surfaceAlbedo = toLinearSpaceVec3(soilColor)*uniforms.vAlbedoColor.rgb;
let soilHeight = dot(soilColor,vec3f(0.21,0.72,0.07));
let soilX = dpdx(fragmentInputs.vPositionW.xz);
let soilY = dpdy(fragmentInputs.vPositionW.xz);
let soilDX = dpdx(soilHeight);
let soilDY = dpdy(soilHeight);
let soilGradient = vec2f(soilDX*soilY.y-soilDY*soilX.y,soilX.x*soilDY-soilY.x*soilDX)/(soilX.x*soilY.y-soilX.y*soilY.x);
normalW = normalize(vec3f(-soilGradient.x*0.08,1.0,-soilGradient.y*0.08));`
    };
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `
vec3 soilCrop(vec2 p, vec2 cell) {
  vec3 r = fract(sin(vec3(dot(cell,vec2(127.1,311.7)),dot(cell,vec2(269.5,183.3)),dot(cell,vec2(419.2,371.9)))) * 43758.5453);
  float a = floor(r.z*4.0)*1.5707963;
  vec2 d = p-cell;
  vec2 q = vec2(cos(a)*d.x-sin(a)*d.y,sin(a)*d.x+cos(a)*d.y);
  return texture2D(albedoSampler,vec2(0.5)+q*0.25+(r.xy-vec2(0.5))*0.14).rgb;
}
vec3 soilSurface(vec2 p) {
  vec2 cell = floor(p);
  vec2 w = smoothstep(vec2(0.0),vec2(1.0),fract(p));
  return mix(mix(soilCrop(p,cell),soilCrop(p,cell+vec2(1.0,0.0)),w.x),mix(soilCrop(p,cell+vec2(0.0,1.0)),soilCrop(p,cell+vec2(1.0)),w.x),w.y);
}`,
      CUSTOM_FRAGMENT_BEFORE_LIGHTS: `
vec3 soilColor = soilSurface(vPositionW.xz*2.0);
surfaceAlbedo = toLinearSpace(soilColor)*vAlbedoColor.rgb;
float soilHeight = dot(soilColor,vec3(0.21,0.72,0.07));
vec2 soilX = dFdx(vPositionW.xz), soilY = dFdy(vPositionW.xz);
float soilDX = dFdx(soilHeight), soilDY = dFdy(soilHeight);
vec2 soilGradient = vec2(soilDX*soilY.y-soilDY*soilX.y,soilX.x*soilDY-soilY.x*soilDX)/(soilX.x*soilY.y-soilX.y*soilY.x);
normalW = normalize(vec3(-soilGradient.x*0.08,1.0,-soilGradient.y*0.08));`
    };
  }
}
