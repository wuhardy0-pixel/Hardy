# Elemental Latin — how to prove it works

Open http://127.0.0.1:5000/play/latin (the app port serves games without the sign-in gate) in a
phone-sized window (390 × 844). `window.__latin` exposes `S`, `newRun`, `hub`, `judge`, `cast`, `set` for scripts.

The scene is WebGL (Three.js). In headless Chrome run with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.

Pass = all of these hold:

- **Set out** closes the intro and opens Camp. Camp shows the hero's portrait, the hero's name and element, a wardrobe of portrait thumbnails (locked ones dimmed with a padlock) and hats. Camp fits the width: nothing is cut off at the sides,
  the outfit row wraps, the reward track scrolls sideways on its own.
- At 120 XP (`__latin.S.xp=120; __latin.hub()`) Magus / Elf knight / Top hat are unlocked and the
  rest show a 🔒 and are dimmed; tapping a locked one explains the XP needed.
- **Explore the world** shows the 3D terrain from behind your mage: trees, ice spikes, volcano glow, houses,
  arena pillars, the camp fire. Arrows, taps on the ground and the keyboard move the player one tile with a
  hop; the camera follows; the strip under the view names the biome and **Go** does what it says.
- In a fight the 3D arena matches the biome (floor textured with the biome's tile); a rival mage is a portrait card with their face also in the top HUD strip; a creature is a 3D beast; the card or beast stands ahead, your familiar (if any) beside
  you. `ignem iacio` sprays fire from the staff to the target, a burst and a damage number appear at impact and
  the target flinches; `aquam voco` raises a blue dome around you that shatters when hit; a wrong ending puffs
  grey smoke; `me sano` sparkles green; the rival's spell flies back at you and the screen edge flashes red.
- The Cast button is on screen on a 390 × 844 phone without scrolling (the builder is four scrollable rows).
- Wild tile: a creature appears; a wrong ending fizzles with a reason; `Gryphe, veni!` can tame when
  it is weak; a tamed creature shows under Familiars at Camp.
- Town: the mage casts Latin back with a translation; winning gives XP and may level up.
- **Ludus Royale**: six mages, the ring shrinks, HP carries over; the winner gets the 👑 and it shows
  on the avatar and on the map.
- The 💬 feedback bubble sits bottom-right and never covers the title bar or the ⛺ 📖 ☰ buttons.
- No errors in the browser console.

A Playwright script (`_latin3d.js` in the session scratchpad while being worked on) covers: scene loaded, world
mode, WebGL context, wild fight starts, fireball damages, shield up, fizzle message, Royale arena, no page errors.
Copy it here as `tests/` when it settles. The newer `_latin4.js` also checks the camp portraits, a town duel with a portrait rival, that every art file loads (no 404 under /play/latin/), and that shader materials are released after effects end (`g3.shaders` stays small). Headless Chrome prints 'GPU stall due to ReadPixels' warnings when screenshots are taken; those are not game errors.
