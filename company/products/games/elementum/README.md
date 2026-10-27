# Elementum

Status: **step 2 live** at play.hardywu.com/play/elementum (sign-in at logelem.hardywu.com).

The new game Hardy started on 2026-10-27. The design it grows toward is the Elementum battle-royale design document
(Latin elemental powers + gunplay, see the GDD link in the company notes). This folder builds it one step at a time.

**Step 1 — a body that moves in a 3D world.** The world is gray on purpose: flat ground with a grid, gray blocks
(steps to climb, walls to walk around, a platform to jump onto, a ring of pillars). The body is a simple humanoid
(head, torso, arms and legs that swing when walking, a run lean, a jump pose, a soft shadow). Third-person camera
behind the body; you walk relative to where the camera looks.

**Step 2 — guns, a shooting range, health bars.** A gun in the body's hands (the three types from the design document in gray-world form): the **Magna Rifle** (automatic, 30 rounds), the **Chaos Shotgun** (10 pellets, 6 shells, short range) and the **Orator Staff** (a slow glowing bolt that explodes where it lands, 4 charges). Click / FIRE shoots where the crosshair points; every shot has a muzzle flash, a tracer, impact sparks, recoil on the gun and the camera. **R** / RELOAD reloads with a hand animation and a progress bar; an empty magazine reloads by itself. Six **dummies** with floating health bars stand on the range; hits flash, flinch and pop damage numbers (head hits count 1.5×, in gold); at 0 they fall over and get back up after 3 s. A **turret** on the right lobs red orbs when you are near, so your own **HP bar** (top-left) takes damage, flashes the screen edge red, refills after 4 s out of fire, and at 0 shows a respawn screen.

Controls
- Computer: W A S D / arrows walk, Shift runs, Space jumps, click the world to lock the mouse and look, click to shoot (hold for the rifle), R reloads, 1 / 2 / 3 pick the gun, Esc frees the mouse, P pauses.
- Phone: left joystick walks, drag on the right half looks, FIRE (hold for the rifle), RELOAD, GUN switches, JUMP and RUN. ⇄ swaps the camera shoulder.

Files: `index.html` (HUD, overlays, controls markup), `game.js` (world, body, input, collision, camera), `three.min.js` (Three.js r158). Served at /play/elementum/<file>.
