"""Run in Blender 5.x. Rebuild the original game props without touching an existing scene."""
import bpy
import math
import random
import os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, 'apps', 'web', 'public', 'assets')
SCENE = 'RealMines_Woodland_Assets'
rng = random.Random(811)

def material(name, color, roughness=0.8):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    p = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) or m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
    output = next((n for n in m.node_tree.nodes if n.type == 'OUTPUT_MATERIAL'), None) or m.node_tree.nodes.new('ShaderNodeOutputMaterial')
    m.node_tree.links.new(p.outputs['BSDF'], output.inputs['Surface'])
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    return m

def mesh(scene, name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    data.materials.append(mat)
    for p in data.polygons:
        p.use_smooth = True
    return obj

def tube(vertices, faces, points, radii, sides=8):
    start = len(vertices)
    points = [Vector(p) for p in points]
    for i, p in enumerate(points):
        tangent = (points[min(i+1, len(points)-1)] - points[max(0, i-1)]).normalized()
        reference = Vector((0,0,1)) if abs(tangent.z) < .9 else Vector((0,1,0))
        right = tangent.cross(reference).normalized()
        up = tangent.cross(right).normalized()
        for j in range(sides):
            a = math.tau*j/sides
            q = p + (right*math.cos(a) + up*math.sin(a))*radii[i]
            vertices.append(tuple(q))
    for i in range(len(points)-1):
        for j in range(sides):
            a = start+i*sides+j
            b = start+i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.append(tuple(start+j for j in reversed(range(sides))))
    faces.append(tuple(start+(len(points)-1)*sides+j for j in range(sides)))

def heart_leaf(vertices, faces, center, angle, scale, cup=.009):
    start = len(vertices)
    x,y,z = center
    vertices.append((x,y,z+cup))
    for j in range(24):
        t = math.tau*j/24
        lx = 16*math.sin(t)**3*scale
        ly = (13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t))*scale
        vertices.append((x+lx*math.cos(angle)-ly*math.sin(angle),y+lx*math.sin(angle)+ly*math.cos(angle),z+math.sin(t*3)*.0018))
    for j in range(24):
        faces.append((start,start+1+j,start+1+(j+1)%24))

def make_clover(scene):
    leaves, leaf_faces, stems, stem_faces = [],[],[],[]
    for cx,cy,h,rotation in [(-.06,-.07,.17,.2),(.08,.055,.2,1.2),(-.085,.09,.14,2.0)]:
        tube(stems,stem_faces,[(cx,cy,0),(cx+.012,cy+.005,h*.55),(cx,cy,h)],[.002,.0016,.0012],5)
        for leaf in range(3):
            a = rotation+leaf*math.tau/3
            center = (cx+math.sin(a)*.045,cy+math.cos(a)*.045,h)
            heart_leaf(leaves,leaf_faces,center,-a,.0032)
            tube(stems,stem_faces,[(cx,cy,h-.004),center,(center[0]+math.sin(a)*.028,center[1]+math.cos(a)*.028,h+.002)],[.0016,.0012,.0005],5)
    mesh(scene,'RM_Clover_Leaves',leaves,leaf_faces,material('CloverLeaf',(.11,.25,.028),.82))
    mesh(scene,'RM_Clover_Stems',stems,stem_faces,material('LeafVeins',(.28,.38,.075),.9))

def make_daisy(scene):
    petals, petal_faces, stems, stem_faces, head, head_faces = [],[],[],[],[],[]
    tube(stems,stem_faces,[(0,0,0),(.018,0,.12),(0,0,.25)],[.0025,.0018,.0012],6)
    for i in range(12):
        a = math.tau*i/12
        start = len(petals)
        petals.append((math.cos(a)*.045,math.sin(a)*.045,.247))
        for j in range(16):
            t = math.tau*j/16
            r = .047+math.cos(t)*.027
            side = math.sin(t)*.0095
            petals.append((math.cos(a)*r-math.sin(a)*side,math.sin(a)*r+math.cos(a)*side,.245+math.cos(t)*.006+abs(math.sin(t))*.003))
        for j in range(16):
            petal_faces.append((start,start+j+1,start+(j+1)%16+1))
    for ring in range(7):
        t = math.pi*ring/6
        for j in range(16):
            a = math.tau*j/16
            head.append((math.sin(t)*math.cos(a)*.022,math.sin(t)*math.sin(a)*.022,.25+math.cos(t)*.008))
    for ring in range(6):
        for j in range(16):
            a = ring*16+j
            b = ring*16+(j+1)%16
            head_faces.append((a,b,b+16,a+16))
    mesh(scene,'RM_Daisy_Petals',petals,petal_faces,material('DaisyPetals',(.82,.8,.68),.7))
    mesh(scene,'RM_Daisy_Center',head,head_faces,material('DaisyPollen',(.75,.38,.025),.9))
    mesh(scene,'RM_Daisy_Stem',stems,stem_faces,material('DaisyStem',(.12,.21,.04),.9))

def make_branch(scene):
    v,f = [],[]
    points = [(i/14*1.85-.925,math.sin(i*.67)*.018,.095+math.sin(i*.4)*.022) for i in range(15)]
    radii = [.075*(.88+.12*math.sin(i*.73)) for i in range(15)]
    tube(v,f,points,radii,12)
    for start,sign in [(3,1),(7,-1),(11,1)]:
        x,y,z=points[start]
        tube(v,f,[(x,y,z),(x+.09,y+sign*.12,z+.025),(x+.19,y+sign*.22,z+.025)],[.027,.017,.004],7)
    mesh(scene,'RM_Branch_Bark',v,f,material('BranchBark',(.19,.12,.065),.95))

def create():
    scene = bpy.data.scenes.get(SCENE)
    if scene and len(scene.objects):
        raise RuntimeError('Asset scene already exists. Export it or rename it before rebuilding.')
    scene = scene or bpy.data.scenes.new(SCENE)
    make_clover(scene)
    make_daisy(scene)
    make_branch(scene)
    if bpy.context.window:
        bpy.context.window.scene=scene
    print('Created woodland props:',[o.name for o in scene.objects])

def export():
    scene=bpy.data.scenes[SCENE]
    previous=bpy.context.window.scene
    bpy.context.window.scene=scene
    try:
        with bpy.context.temp_override(scene=scene,view_layer=scene.view_layers[0]):
            for prefix,filename in [('RM_Clover','clover-patch.glb'),('RM_Daisy','daisy.glb'),('RM_Branch','branch.glb')]:
                for o in scene.objects:
                    o.select_set(False)
                selected=[o for o in scene.objects if o.name.startswith(prefix)]
                for o in selected:
                    o.select_set(True)
                scene.view_layers[0].objects.active=selected[0]
                bpy.ops.export_scene.gltf(filepath=os.path.join(DEST,filename),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False)
        bpy.data.libraries.write(os.path.join(ROOT,'assets-source','woodland.blend'),{scene},fake_user=True,compress=True)
        print('Exported local GLB props and woodland.blend')
    finally:
        bpy.context.window.scene=previous

if globals().get('STEP') == 'export':
    export()
else:
    create()
