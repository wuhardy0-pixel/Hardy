# Hardy's own fidgets, designed from scratch (2026-10-31). Millimetres, Z up, everything prints flat on the bed.
#  1. Cheeky Click Spinner: 3 arms ending in monster heads with eyes and a tongue sticking out. The hub is printed
#     captive inside the body (diamond-shaped waist, 0.45 mm gap) so it needs no bearing; 3 springy pawls click on 6 bumps.
#  2. Twisty Blep Ball: a barrel of 10 helical ribs between a base and a top cap; press the cap and the ribs twist it round.
#     The cap has a face: two eyes and a tongue hanging out. Ribs are 2.2 mm thick: PETG or TPU recommended, test-print first.
import math, sys, os, numpy as np
from manifold3d import Manifold, CrossSection
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
N = 96
def _hull(parts):
    acc = parts[0]
    for q in parts[1:]: acc = acc + q
    return acc.hull()

def save(m, name):
    mesh = m.to_mesh(); v = np.asarray(mesh.vert_properties)[:, :3].astype(np.float32); t = np.asarray(mesh.tri_verts).astype(np.uint32)
    v.tofile(f"{OUT}/{name}.pos.bin"); t.tofile(f"{OUT}/{name}.idx.bin")
    # STL for the printer
    tri = v[t]; n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]); n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    with open(f"{OUT}/{name}.stl", "wb") as f:
        f.write(b"Hardy Wu original design".ljust(80, b" ")); f.write(np.uint32(len(t)).tobytes())
        rec = np.zeros(len(t), dtype=[("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")]); rec["n"] = n; rec["v"] = tri; f.write(rec.tobytes())
    print(name, len(v), "verts", np.round(v.min(0), 1), np.round(v.max(0), 1), "volume cm3", round(m.volume() / 1000, 2))

def revolve(pts, segs=N):
    return Manifold.revolve(CrossSection([pts]), segs)

def at(m, r, ang, z=0):
    return m.translate([r * math.cos(math.radians(ang)), r * math.sin(math.radians(ang)), z])

# ---------------- 1. Cheeky Click Spinner ----------------
T, RA, G = 10.0, 33.0, 0.45
hub_prof = [(0, 0), (7.0, 0), (7.0, 2.0), (9.4, 5.0), (7.0, 8.0), (7.0, 10.0), (0, 10.0)]
hub = revolve(hub_prof)
for k in range(6):                                            # 6 click bumps on the hub's top band
    hub = hub + at(Manifold.cylinder(2.0, 0.9, 0.9, 24).translate([0, 0, 8.0]), 7.0, k * 60)
dimple = Manifold.sphere(16, N)
hub = hub - dimple.translate([0, 0, 10 + 15.2]) - dimple.translate([0, 0, -15.2])   # finger dimples top and bottom
bore_cs = CrossSection([hub_prof]).offset(G) ^ CrossSection.square([30, 40]).translate([0, -15])
bore = Manifold.revolve(bore_cs, N) + Manifold.cylinder(2.6, 8.4, 8.4, N).translate([0, 0, 7.6])   # roomy top band for the clicks

arms = CrossSection.circle(20.5, N)
for k in range(3):
    a = 90 + 120 * k
    lobe = CrossSection.circle(16, N).translate([RA * math.cos(math.radians(a)), RA * math.sin(math.radians(a))])
    arms = arms + _hull([CrossSection.circle(11, N), lobe])
body = Manifold.extrude(arms, T) - bore
# springy pawls: a curved slot frees a thin beam beside the bore; a nub on its free end rides over the bumps
for k in range(3):
    a0 = 30 + 120 * k
    slot = Manifold.revolve(CrossSection.square([0.7, 2.7]).translate([9.3, 0]), N, 70).rotate([0, 0, a0]).translate([0, 0, 7.5])
    cut = Manifold.cube([2.2, 0.7, 2.7]).translate([8.2, -0.35, 7.5]).rotate([0, 0, a0])
    body = body - slot - cut
    body = body + Manifold.cylinder(2.5, 0.55, 0.55, 20).translate([0, 0, 7.5]).translate([7.85 * math.cos(math.radians(a0 + 62)), 7.85 * math.sin(math.radians(a0 + 62)), 0])

eyes = Manifold(); pupils = Manifold(); tongues = Manifold()
for k in range(3):
    a = 90 + 120 * k; c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    for side in (-1, 1):                                       # eyes: white domes, black pupils
        ex, ey = (RA + 3) * c - side * 5.6 * s, (RA + 3) * s + side * 5.6 * c
        eyes = eyes + (Manifold.sphere(3.4, 48).scale([1, 1, .55]).translate([ex, ey, T]))
        pupils = pupils + Manifold.sphere(1.5, 32).scale([1, 1, .6]).translate([ex + 1.2 * c, ey + 1.2 * s, T + 1.55])
    # tongue: a flat rounded tab sticking out of the head's edge, with a groove down the middle
    tcs = _hull([CrossSection.square([8, 8.5], True).translate([RA + 13, 0]), CrossSection.circle(4.25, 40).translate([RA + 22.5, 0])])
    tg = Manifold.extrude(tcs, 4.0) - Manifold.cube([11, 0.9, 1.0]).translate([RA + 15, -0.45, 3.2])
    tongues = tongues + tg.rotate([0, 0, a])
body = body + Manifold()            # (eyes/pupils/tongue are separate colour parts that touch the body)
save(body, "spinner_body"); save(hub, "spinner_hub"); save(eyes, "spinner_eyes"); save(pupils, "spinner_pupils"); save(tongues, "spinner_tongue")

# ---------------- 2. Twisty Blep Ball ----------------
H, BASE, CAP = 56.0, 8.0, 10.0
rz = lambda z: 15 + 10 * math.sin(math.pi * z / H)
prof_out = [(0, 0)] + [(rz(z), z) for z in np.linspace(0, H, 57)] + [(0, H)]
barrel = revolve(prof_out)
inner = revolve([(0, 0)] + [(max(1, rz(z) - 2.2), z) for z in np.linspace(0, H, 57)] + [(0, H)])
shell = barrel - inner
ribs_cs = CrossSection()
for k in range(10):
    ribs_cs = ribs_cs + CrossSection.square([24, 3.4]).translate([8, -1.7]).rotate(k * 36)
ribs = Manifold.extrude(ribs_cs, H - BASE - CAP + 2, 40, 140).translate([0, 0, BASE - 1])
body_mid = shell ^ ribs
base = barrel ^ Manifold.cube([80, 80, BASE]).translate([-40, -40, 0])
cap = (barrel ^ Manifold.cube([80, 80, CAP]).translate([-40, -40, H - CAP])) + Manifold.sphere(15, N).scale([1, 1, .45]).translate([0, 0, H])
ball = base + body_mid + cap
beyes = Manifold(); bpupils = Manifold()
zc = H - 4.5
for side in (-1, 1):                                          # face looks out along +x, just under the dome
    a = side * 22; r = rz(zc) - .4
    beyes = beyes + Manifold.sphere(3.6, 48).scale([.55, 1, 1]).translate([r * math.cos(math.radians(a)), r * math.sin(math.radians(a)), zc + 1])
    bpupils = bpupils + Manifold.sphere(1.6, 32).scale([.6, 1, 1]).translate([(r + 1.7) * math.cos(math.radians(a)), (r + 1.7) * math.sin(math.radians(a)), zc + .6])
# tongue: hangs down and out from the cap's lower edge at 30° from vertical (prints without support)
tcs = _hull([CrossSection.square([9, 2.6], True), CrossSection.circle(1.3, 24).translate([-3.2, -13]), CrossSection.circle(1.3, 24).translate([3.2, -13])])
tongue = Manifold.extrude(tcs.translate([0, 0]), 9).rotate([90, 0, 0])
tongue = Manifold.extrude(_hull([CrossSection.circle(4.5, 40).translate([0, -10]), CrossSection.square([9, 2], True)]), 2.6)
tongue = tongue.rotate([90, 0, 90]).rotate([0, -30, 0]).translate([rz(H - CAP) - 1.2, 0, H - CAP + 1])
tongue = tongue - Manifold.cube([12, 0.9, 1.2]).rotate([0, 60, 0]).translate([rz(H - CAP) + 0.6, -0.45, H - CAP - 9])
save(ball, "ball_body"); save(beyes, "ball_eyes"); save(bpupils, "ball_pupils"); save(tongue, "ball_tongue")
