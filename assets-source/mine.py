"""External-only, nonfunctional disc-mine game prop. Run in background Blender."""
import bpy
import math
from pathlib import Path

root = Path(__file__).resolve().parents[1]
assets = root / 'apps/web/public/assets'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, metallic, roughness, textured=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_backface_culling = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if textured:
        tex = m.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(str(assets / 'mine-metal-arm.jpg'), check_existing=True)
        tex.image.colorspace_settings.name = 'Non-Color'
        channels = m.node_tree.nodes.new('ShaderNodeSeparateColor')
        m.node_tree.links.new(tex.outputs['Color'], channels.inputs['Color'])
        m.node_tree.links.new(channels.outputs['Green'], bsdf.inputs['Roughness'])
        paint_metal = m.node_tree.nodes.new('ShaderNodeMath')
        paint_metal.operation = 'MULTIPLY'
        paint_metal.inputs[1].default_value = .08
        m.node_tree.links.new(channels.outputs['Blue'], paint_metal.inputs[0])
        m.node_tree.links.new(paint_metal.outputs[0], bsdf.inputs['Metallic'])
        for filename, target in [('mine-metal-color.jpg', 'Base Color'), ('mine-metal-normal.jpg', 'Normal')]:
            tex = m.node_tree.nodes.new('ShaderNodeTexImage')
            tex.image = bpy.data.images.load(str(assets / filename), check_existing=True)
            if target == 'Normal':
                tex.image.colorspace_settings.name = 'Non-Color'
                normal = m.node_tree.nodes.new('ShaderNodeNormalMap')
                normal.inputs['Strength'].default_value = .75
                m.node_tree.links.new(tex.outputs['Color'], normal.inputs['Color'])
                m.node_tree.links.new(normal.outputs['Normal'], bsdf.inputs[target])
            else:
                m.node_tree.links.new(tex.outputs['Color'], bsdf.inputs[target])
    return m

paint = material('Weathered green painted steel', (.17,.23,.09), .08, .58, True)
paint_bsdf = next(n for n in paint.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
paint_bsdf.inputs['Coat Weight'].default_value = .22
paint_bsdf.inputs['Coat Roughness'].default_value = .32
edge = material('Exposed worn steel edge', (.48,.50,.43), .92, .29)
dark = material('Recessed seams', (.075,.055,.035), .05, .94)
letter = material('Faded warning paint', (.76,.68,.36), .05, .86)

def finish(obj, name, mat, bevel=.008):
    obj.name = name
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Rounded stamped edges', 'BEVEL')
        mod.width = bevel; mod.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in obj.data.polygons:
        poly.use_smooth = len(poly.vertices) <= 4
    return obj

def disc(name, radius, depth, z, mat, top=None):
    bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=radius, radius2=radius if top is None else top, depth=depth, location=(0,0,z))
    return finish(bpy.context.object, name, mat)

disc('RM_Mine_body', .38, .13, .085, paint, .34)
disc('RM_Mine_rolled_rim', .385, .025, .032, edge)
disc('RM_Mine_lid_seam', .321, .018, .153, dark)
disc('RM_Mine_top_plate', .305, .044, .174, paint, .29)
disc('RM_Mine_center_recess', .10, .016, .198, dark)
disc('RM_Mine_center_cap', .078, .032, .211, edge)
for radius, z in [(.275,.199), (.14,.2)]:
    bpy.ops.mesh.primitive_torus_add(major_segments=64, minor_segments=8, location=(0,0,z), major_radius=radius, minor_radius=.006)
    finish(bpy.context.object, 'RM_Mine_pressed_ring', edge, 0)
for i in range(6):
    a = i * math.tau / 6
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=.018, location=(.337*math.cos(a),.337*math.sin(a),.143))
    bolt = finish(bpy.context.object, 'RM_Mine_rivet', edge, 0)
    bolt.scale.z = .35
# A carrying loop folded against the outside shell; no internal parts.
curve = bpy.data.curves.new('RM_Mine_handle', 'CURVE')
curve.dimensions='3D'; curve.bevel_depth=.012; curve.bevel_resolution=3
sp=curve.splines.new('POLY'); sp.points.add(3)
for point, co in zip(sp.points, [(-.11,-.31,.095),(-.12,-.42,.08),(.12,-.42,.08),(.11,-.31,.095)]): point.co=(*co,1)
obj=bpy.data.objects.new('RM_Mine_handle',curve);bpy.context.collection.objects.link(obj);obj.data.materials.append(edge)
bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.convert(target='MESH');obj.select_set(False)
font=bpy.data.curves.new('RM_Mine_marking','FONT');font.body='MINE';font.align_x='CENTER';font.size=.07;font.extrude=.0006
obj=bpy.data.objects.new('RM_Mine_marking',font);bpy.context.collection.objects.link(obj);obj.location=(0,-.235,.201);obj.data.materials.append(letter)
bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.join()
obj=bpy.context.object;obj.name='RM_Mine';obj.data.name='RM_Mine'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets-source/mine.blend'))
bpy.ops.export_scene.gltf(filepath=str(assets/'mine.glb'),export_format='GLB',use_selection=True)
