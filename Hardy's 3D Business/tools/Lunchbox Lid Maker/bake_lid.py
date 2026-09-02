"""Step 2 (run by Blender): bake the pixel map INTO the lid geometry.
A pocket in the exact shape of the picture+name is carved 1.2 mm into the
lid's top face, and one flush inlay body per color fills it. Prints as one
piece with the image baked in (assign filaments per part in the slicer).

Usage: Blender -b -P bake_lid.py -- <job folder>
Outputs into the job folder: Lid_Body.stl, Inlay_<Color>.stl, render.png
"""
import bpy, json, sys, os, math
from mathutils import Vector

job = sys.argv[sys.argv.index("--") + 1]
CAP = os.path.expanduser("~/Documents/3D/Lunchbox/upload/Lunchbox_Cap.stl")
DEPTH = 1.2  # inlay depth in mm

meta = json.load(open(os.path.join(job, "palette.json")))
GW, GH = meta["grid_mm"]
LEFT, TOP = meta["origin_mm"]  # world x of grid col 0, world y of grid row 0

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def load_stl(f):
    before = set(bpy.data.objects)
    try: bpy.ops.wm.stl_import(filepath=f)
    except AttributeError: bpy.ops.import_mesh.stl(filepath=f)
    return [o for o in bpy.data.objects if o not in before][0]

cap = load_stl(CAP)
bpy.context.view_layer.update()
cap_top = max((cap.matrix_world @ Vector(c)).z for c in cap.bound_box)

# read the index map
img = bpy.data.images.load(os.path.join(job, "indexed.png"))
W, H = img.size
p = list(img.pixels)  # RGBA floats, bottom row first
def index_at(col, row):  # row 0 = top of image
    v = p[((H - 1 - row) * W + col) * 4]
    return round(v * 255)

# build ONE welded, manifold solid from a set of grid cells (voxel surface:
# top/bottom per cell, side walls only on boundaries) — booleans need this
def cells_for(ci):
    return {(c, r) for r in range(H) for c in range(W) if index_at(c, r) == ci}

def mask_solid(name, cells, z0, z1):
    vidx, verts, faces = {}, [], []
    def v(col, row, z):
        key = (col, row, z)
        if key not in vidx:
            vidx[key] = len(verts)
            verts.append((LEFT + col, TOP - row, z))
        return vidx[key]
    for (c, r) in cells:
        # corners: (c,r)=top-left … y0 = bottom edge (row r+1), y1 = top edge (row r)
        a0, b0, b1, a1 = v(c, r+1, z0), v(c+1, r+1, z0), v(c+1, r, z0), v(c, r, z0)
        A0, B0, B1, A1 = v(c, r+1, z1), v(c+1, r+1, z1), v(c+1, r, z1), v(c, r, z1)
        faces.append((A0, B0, B1, A1))        # top (+z)
        faces.append((a1, b1, b0, a0))        # bottom (-z)
        if (c, r-1) not in cells: faces.append((b1, B1, A1, a1))  # north wall (+y)
        if (c, r+1) not in cells: faces.append((a0, A0, B0, b0))  # south wall (-y)
        if (c-1, r) not in cells: faces.append((a1, A1, A0, a0))  # west wall (-x)
        if (c+1, r) not in cells: faces.append((b0, B0, B1, b1))  # east wall (+x)
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob

z0, z1 = cap_top - DEPTH, cap_top
inlays = []
all_cells = set()
for ci, cname in enumerate(meta["names"]):
    cells = cells_for(ci)
    if not cells: continue
    inlays.append((cname, mask_solid(f"Inlay_{cname}", cells, z0, z1)))
    all_cells |= cells

pocket = mask_solid("pocket", all_cells, z0, z1 + 1.0)
mod = cap.modifiers.new("cut", "BOOLEAN")
mod.operation = "DIFFERENCE"
mod.object = pocket
mod.solver = "EXACT"
bpy.context.view_layer.objects.active = cap
bpy.ops.object.modifier_apply(modifier="cut")
bpy.data.objects.remove(pocket, do_unlink=True)

def export(ob, path):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    try: bpy.ops.wm.stl_export(filepath=path, export_selected_objects=True)
    except AttributeError: bpy.ops.export_mesh.stl(filepath=path, use_selection=True)

export(cap, os.path.join(job, "Lid_Body.stl"))
for cname, ob in inlays:
    export(ob, os.path.join(job, f"Inlay_{cname}.stl"))

# quick assembled render so Barbara can eyeball it before slicing
def mat(name, rgb, rough=0.45):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (rgb[0]/255, rgb[1]/255, rgb[2]/255, 1)
    b.inputs["Roughness"].default_value = rough
    return m
cap.data.materials.clear(); cap.data.materials.append(mat("body", (200, 200, 202)))
for (cname, ob), rgb in zip(inlays, [meta["rgb"][meta["names"].index(c)] for c, _ in inlays]):
    ob.data.materials.clear(); ob.data.materials.append(mat(cname, rgb))
objs = [cap] + [ob for _, ob in inlays]
pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
mn = Vector((min(q[i] for q in pts) for i in range(3)))
mx = Vector((max(q[i] for q in pts) for i in range(3)))
center = (mn + mx) / 2; diag = (mx - mn).length
bpy.ops.mesh.primitive_plane_add(size=diag*30, location=(center.x, center.y, mn.z - 0.1))
bpy.context.active_object.data.materials.append(mat("g", (230, 232, 230), 0.9))
for loc, e, s in [((center.x - diag, center.y - diag, diag*1.6), 8*diag**2, diag*1.6),
                  ((center.x + diag, center.y - diag*0.5, diag*1.2), 3*diag**2, diag*2)]:
    ld = bpy.data.lights.new("l", type="AREA"); ld.energy = e; ld.size = s
    lo = bpy.data.objects.new("l", ld); scene.collection.objects.link(lo); lo.location = loc
    lo.rotation_euler = (center - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
w = bpy.data.worlds.new("w"); scene.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.93, 0.93, 0.93, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.4
cd = bpy.data.cameras.new("c"); cd.lens = 50
cam = bpy.data.objects.new("c", cd); scene.collection.objects.link(cam)
cam.location = center + Vector((0.15, -0.55, 0.9)).normalized() * diag * 1.4
bpy.context.view_layer.update()
cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam
scene.render.engine = "CYCLES"; scene.cycles.samples = 64
scene.cycles.use_denoising = True; scene.cycles.device = "CPU"
scene.render.resolution_x, scene.render.resolution_y = 1100, 850
scene.render.filepath = os.path.join(job, "render.png")
scene.render.image_settings.file_format = "PNG"
bpy.ops.render.render(write_still=True)
print("BAKE_OK", job)
