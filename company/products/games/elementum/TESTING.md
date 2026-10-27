# Elementum — how to prove it works

Open http://127.0.0.1:5000/play/elementum (the app port serves games without the sign-in gate). `window.__el` exposes
the body state `P` (pos, vel, onGround), `look`, `keys`, `start()`, `jump()`, `setStick(x,y)`.

Pass = all of these hold on a 390 × 844 phone-sized window and on a laptop window:
- The gray world renders (ground, grid, blocks) with the body standing in the middle and a camera behind it.
- Holding W (or pushing the joystick up) moves the body away from the camera; the legs swing; the position readout changes.
- Shift (or RUN) roughly doubles the speed.
- Space (or JUMP) lifts the body off the ground and it lands again; it cannot jump while in the air.
- Walking into a wall stops at the wall; walking up the steps raises y step by step; walking off a block falls to the ground.
- Dragging on the right half of the screen turns the camera; walking then goes the new way.
- Pause (☰ / P / Esc) freezes the body; Continue resumes. No errors in the console.

Step 2 (guns): `__el.G` is the gun state (id, ammo, reloading), `__el.DUMMIES` the range, `__el.fire()`, `__el.reload()`, `__el.equip(id)`, `__el.hurt(n)`.
- A gun is in the right hand at start; 1 / 2 / 3 (or GUN) switch the model and the ammo counter.
- Aim at Dummy C from z = −8 facing −z: a shot uses one bullet, pops a damage number, flashes the crosshair red, and the dummy's bar drops. Holding fire empties the rifle's 30 rounds, the dummy falls over (and stands up 3 s later), and the gun reloads by itself with the bar filling; R reloads early.
- The shotgun hits several pellets up close and little at 20 m; the staff bolt flies visibly and explodes with a ring and sparks, damaging dummies within 3 m.
- Standing near the turret (10, −18) gets you hit: HP drops, the screen edge flashes red, HP refills after 4 s out of fire; at 0 the 'You're down' screen appears and Respawn restores 100.
- Playwright: `_elem.js` (movement) and `_elem2.js` (guns) in the session scratchpad cover all of the above on phone and laptop sizes.
