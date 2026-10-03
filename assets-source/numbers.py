"""Beveled physical number tokens. Run in a separate background Blender."""
import bpy
from pathlib import Path

root = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
font = bpy.data.fonts.load('C:/Windows/Fonts/georgiab.ttf')
for number in range(1, 9):
    curve = bpy.data.curves.new(f'Number{number}', 'FONT')
    curve.body = str(number)
    curve.font = font
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.size = 0.72
    curve.extrude = 0.022
    curve.bevel_depth = 0.009
    curve.bevel_resolution = 2
    curve.resolution_u = 6
    obj = bpy.data.objects.new(f'RM_Number_{number}', curve)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
bpy.ops.wm.save_as_mainfile(filepath=str(root / 'assets-source/numbers.blend'))
bpy.ops.export_scene.gltf(filepath=str(root / 'apps/web/public/assets/numbers.glb'), export_format='GLB', use_selection=False)
