# Elementum

Status: **step 5 live** at play.hardywu.com/play/elementum (sign-in at logelem.hardywu.com).

The new game Hardy started on 2026-10-27. The design it grows toward is the Elementum battle-royale design document
(Latin elemental powers + gunplay, see the GDD link in the company notes). This folder builds it one step at a time.

**Step 1 — a body that moves in a 3D world.** The world is gray on purpose: flat ground with a grid, gray blocks
(steps to climb, walls to walk around, a platform to jump onto, a ring of pillars). The body is a simple humanoid
(head, torso, arms and legs that swing when walking, a run lean, a jump pose, a soft shadow). Third-person camera
behind the body; you walk relative to where the camera looks.

**Step 2 — guns, a shooting range, health bars.** A gun in the body's hands (the three types from the design document in gray-world form): the **Magna Rifle** (automatic, 30 rounds), the **Chaos Shotgun** (10 pellets, 6 shells, short range) and the **Orator Staff** (a slow glowing bolt that explodes where it lands, 4 charges). Click / FIRE shoots where the crosshair points; every shot has a muzzle flash, a tracer, impact sparks, recoil on the gun and the camera. **R** / RELOAD reloads with a hand animation and a progress bar; an empty magazine reloads by itself. Six **dummies** with floating health bars stand on the range; hits flash, flinch and pop damage numbers (head hits count 1.5×, in gold); at 0 they fall over and get back up after 3 s. A **turret** on the right lobs red orbs when you are near, so your own **HP bar** (top-left) takes damage, flashes the screen edge red, refills after 4 s out of fire, and at 0 shows a respawn screen.

Controls
- Computer: W A S D / arrows walk, Shift runs, Space jumps, click the world to lock the mouse and look, click to shoot (hold for the rifle), R reloads, G drops what you hold, 1 / 2 / 3 pick the gun, Esc frees the mouse, P pauses.
- Phone: left joystick walks, drag on the right half looks, FIRE (hold for the rifle), RELOAD, GUN switches, JUMP and RUN. ⇄ swaps the camera shoulder.

Files: `index.html` (HUD, overlays, controls markup), `game.js` (world, body, input, collision, camera), `three.min.js` (Three.js r158). Served at /play/elementum/<file>.

**Look (2026-11-03) — designed with Gemini.** Barbara: "use gemini to make a character because the character is very ugly. Also make better dummies and backgrounds."
Gemini 3 Pro Image (Vertex AI on the hardywu-site-758a Google Cloud project, `tools/gemini_image.py`) drew the concept art in `concept/`
(hero turnaround, face, training dummy) and painted the textures in `art/` (grass, sandy path, travertine stone, burlap, a panoramic horizon of
hills, cypresses and Roman ruins). `look.js` models the hero and the dummy from that art in Three.js with cartoon (toon) shading and ink outlines,
and builds the world: sky gradient + the painted horizon on a far ring, grass ground, a sandy range yard, stone-textured blocks, the tall
blocks drawn as Roman columns, cypress trees, bushes and flowers. Pivots and sizes match the old body and dummies, so animation, collision and hits are unchanged.
- Hero: messy dark hair, big eyes, teal hooded capelet + back cape with gold trim, cream tunic, chest strap with a glowing orange crystal, bronze shoulder guard, fingerless gloves, belt and pouch, dark trousers, brown boots with bronze toe caps.
- Dummy: straw-stuffed burlap sack on a wooden post, rope ties, crossbar arms with straw tufts, button eyes and a stitched smile, red-and-white target on the chest, stone base with a glowing blue rune ring. The crossbar now counts as a hit too.

**Characters + walls (2026-11-17).** Barbara: "the character is ugly and change the attacker you know the black thing" and "the bullets are going
through the walls ... it should cause a dent in the wall and the dent gets bigger until it makes a hole, it shouldn't damage me".
- Hero = KayKit "Rogue_Hooded" (green hooded ranger; recoloured to match the game cover — cream tunic, dark trousers, plus a hair fringe from look.js), attacker = KayKit "Skeleton_Mage" — both by Kay Lousberg, CC0 (free for any use,
  credit appreciated: www.kaylousberg.com). Trimmed to the animations used into `models/hero.glb` and `models/skeleton_mage.glb`.
  `gltf-loader.js` is three.js r158's GLTFLoader made into a plain script. `LOOK.loadRig` plays them in layers: legs (idle / walk /
  run / backwards / strafe / jump) under arms (aim / shoot / reload), whole-body for hit, death and spells; the chest bends to the aim.
  The gun sits in the right hand and points where the camera aims. The shape-built hero is only a fallback while the model loads.
- The skeleton mage replaces the black turret: it turns to you, casts a spell and throws a red orb when you are within 22 m. It has
  150 HP and a health bar; shots make it flinch, at 0 it collapses and rises from the ground 4 s later.
- Walls: every hit leaves a dent that grows (rifle 1, shotgun pellet 0.4, enemy orb 2, staff bolt 3); at 6 it breaks into a hole
  (r 0.32 m) you can see and shoot through (depth-only masks cut the wall, a stone tunnel lines it). Enemy orbs and staff bolts stop
  at walls, so nothing reaches you through a wall. Small blocks and top faces only get deep dents.

**Spells (2026-11-17).** Barbara: "if we kill a dummy it drops a spell with uses. For example earth shield creates a wall. Brainstorm 5 different
new spells and search on the web for free animations." Every knocked-down dummy (and the skeleton mage) drops a random glowing spell
(spinning gem + name label, gone after 30 s). Walk over it to take it; F / E (phone: the ✦ button) casts; another pickup replaces it.
| Spell | Element | Uses | What it does |
|---|---|---|---|
| 🪨 Murus Terrae | earth | 3 | a 4.2 × 2.4 m stone wall rises 3 m ahead (snapped to the grid); it blocks orbs, takes dents and holes, crumbles after 15 s |
| 🔥 Pila Ignis | fire | 3 | a big fireball; 4 m explosion, up to 85 damage, burning |
| ⚡ Fulmen | lightning | 3 | lightning falls where you aim (60 m) after a warning ring; 90 damage within 2.8 m, chains on |
| 🌪️ Ventus Saltus | air | 4 | a gust throws you forward and up; dummies in front take 22 and stagger |
| 💧 Aqua Sanans | water | 2 | a 3 m healing spring for 6 s: +12 HP/s while you stand in it; soaks dummies in it |
Animations: KayKit's own clips on the same rig (Spellcast_Shoot / Spellcast_Raise / Spellcast_Long / Dodge_Forward / PickUp), so no
retargeting. Other free (CC0) sets found: KayKit Character Animations, Quaternius Universal Animation Library 1 + 2 (different rig — would need retargeting).

**Step 3 (2026-11-17) — inventory, mining, a math forge, monsters, 25 spells.** Barbara: "add inventory like minecraft where you now craft
weapons and crystal cores are mined and there are monsters who have their own spells. Add 20 more spells. For the crafting and picking the
right material use math … like the hardest math problem contest format 6-8th grade" + "you don't heal unless you have a spell", "make the
skeleton mage move", "dummies also have guns", and "lagging when lightning".
- **Inventory** (Minecraft-style): 9 hotbar slots + 27 in the bag. Click / FIRE uses what is in your hand (gun, spell, potion); 1–9 or the
  wheel pick a slot; E opens the bag (tap an item, tap a slot to move/swap) and the forge. Phone: tap the hotbar, NEXT, 🎒.
- **Mining**: 6 iron rocks (Ferrum) and 10 crystal veins (2 per core: Carbo, Nimbus, Silex, Aether, Electrum) near the monster homes. Shoot
  them to break them; they drop items you walk over to collect, and grow back after 45 s. Q only switches to crystals you own a core of.
- **The forge** (`craft.js`): 7 recipes (Chaos Shotgun, Orator Staff, Fulmen Repeater, Terra Cannon, Ventus Arcus, two healing potions).
  The forge never lists what it needs: each recipe is a MATHCOUNTS-style problem set whose answers are the amounts (some two-step: A − B,
  A + B) and the crystal core (cores are numbered 2, 3, 5, 7, 11; clues like "the smallest prime factor of 91" or "two primes that add up to 13").
  A wrong mix only says how many parts are right; materials are spent only on success; a new problem set is drawn after each success.
  `node craft.js`-style check: every generated problem is re-solved by an independent solver (6,400 problems, 24 patterns, 0 wrong).
- **Monsters** (Quaternius "Ultimate Monsters", CC0, from poly.pizza, `models/monsters/`): Demon (fire: Pila Ignis, Imber Ignis), Yeti (ice:
  Glacies Hasta, Gelu Campus), Mushroom King (earth: Spinae, Saxum), Ninja (air/shadow: Sagittae Venti, Umbra Gradus), Frog (lightning:
  Globus Fulguris, Fulmen), plus the KayKit Skeleton Mage (Pila Ossium), which now walks too. Each has a home, wanders, hunts you within
  24 m, keeps its distance, strafes, punches up close and casts its spells (25% of the player's damage; walls stop them). Beaten: drops its
  crystal core, its trophy (horn, fur, spores, shadow cloth, storm gem, bone dust) and often one of its spells; back 25 s later.
- **25 spells** (5 old + 20 new): wall, fireball, lightning, wind leap, healing spring, rain of fire, ring of fire, dragon breath, ice spear,
  frost field, snowstorm, tidal wave, bubble shield, healing light, boulder, earthquake (stun), stone spikes, tornado (pulls), wind wings
  (speed + jump), wind blades, thunder chain, ball lightning, shadow step, light shield (no damage 3 s), falling star.
- **No healing by itself** any more: only Aqua Sanans, Fons Vitae and potions heal. **Dummies have guns**: they turn to you within 24 m
  and fire every 3–5 s (2 damage, often miss); walls stop their bullets. Knocked down they drop 2 Lignum and sometimes a spell.
- **Lightning lag fixed**: effects started when another effect finished were being dropped from the effect timer (so lightning streaks and
  rings stayed forever and piled up); and every flash / comet added and removed a light, which makes every material rebuild. Now 6 lights
  stay in the scene and are borrowed for flashes. Fast bolts now test their whole path, so they can't skip through a thin wall or a target.

**Step 4 (2026-11-17) — the town, the market, adaptive math.** Barbara: "make no skeleton mage instead make a town with dummies but they don't
shoot fast and bullets are slow. In the town trade items for currency, currency buy items … how come it is not like hardest math problem …
town is safe zone and is surrounded with big walls, if go outside the gates there are the monsters. Add math more and harder unless you are
1st grade so that means you have to show the adaptive math".
- **Oppidum**: the town is the old range area, x −30…30, z −36…26, inside 6 m walls with 8 m towers and four 6 m gates (arches, red banners,
  signs: "🏰 Oppidum — safe inside these walls" / "⚔️ The wilds — monsters ahead"). Safe zone: monsters can't walk in (they treat the town
  as solid), don't hunt you while you're inside, and their spells can't hurt you there. You respawn in town.
- **No skeleton mage** (model and its bone-orb spell removed). The five Quaternius monsters moved out to homes 50–70 m away; crystal veins
  sit near them; three iron rocks are inside town.
- **Dummies' guns are slow**: one glowing bullet every 5–8 s that flies at 7 m/s (you can see and sidestep it), 2 damage, stopped by walls.
- **Coins and the market**: monsters drop 6–12 🪙, dummies 1–3. Mercator (KayKit barbarian, `models/merchant.glb`) at the stall north of
  the start buys anything (iron 2, wood 1, cores 6–8, trophies 10–12, spells 3 per use, weapons 8–50) and sells potions (20), iron, wood,
  every crystal core and 3 spells that change every 2 minutes. T or the "Trade" button opens the Market tab when you stand at the counter.
- **Adaptive math** (`craft.js`): 8 levels — Grade 1 (sums, take-aways), 2 (two-digit, sharing), 3 (times tables, division), 4 (missing
  factor, fractions of a number, perimeter, rates), 5 (order of operations, percent, mean, counting), 6 (factors, equations, GCF, sequences,
  probability, triangles), 7–8 (factorial zeros, units digits, systems, |x − a| < b, integer triangles, exponents) and Contest (ordered
  factor pairs, numbers with exactly 3 divisors, remainders of 1+…+k and 2^k, dice sums, Euler's φ, consecutive products). Higher levels
  chain two problems (A − B / A + B) more often; crystal clues go from "the number of days in a week" up to "the number of positive divisors
  of 1024". You pick a starting grade on the start screen; a forge right on the first try moves you up a level, two wrong tries move you down
  and draw easier problems. The forge shows the level and an 8-step meter. Kept in this browser (localStorage).
- Verified: an independent solver re-solves 16,800 generated problems across all 8 levels plus every crystal and two-crystal clue — 0 wrong
  (it caught two generator bugs on the way: leftover eggs that filled another box, and a system that asked for y instead of x).

**Step 5 (2026-11-17) — town life, packs, other players, fists.** Barbara: "make more of the town like foods that help you and your house and
also the dummies shoot at you only in the training center you need to build", "add multiplayer with name tag and monsters are swarming, add
more kinds and more spells if needed", "make the monsters stronger so the gun can't kill him and also add punches if you have nothing in your hand".
- **T uses what you stand next to** (a button shows on phones): Mercator's stall (market), the **Popina** food stall (KayKit rogue cook,
  `models/cook.glb`), your **bed**, your **chest**, the **training-center site**.
- **Food** (eat from the hotbar): apple +8, bread +20, grapes (+10, high jumps 30 s), honey cake (+15, fast 30 s), porridge (+3 HP/s 15 s),
  cheese (25% less damage 45 s), grilled fish (+25% damage 45 s). Active boosts show as chips under the coins.
- **Domus, your house** (north-east): walls with a door, a roof, a bed (full health, once a minute; you come back at your door after you
  have slept there) and an 18-slot chest.
- **Palaestra, the training center**: a roped-off site around the dummies; build it with 8 Lignum, 6 Ferrum and 25 🪙 and low walls rise
  with a gate. The dummies only shoot (slow bullets) while you are inside it — never before it is built, never elsewhere.
- Also: a fountain in the square and four KayKit knight guards (`models/guard.glb`) at the gates.
- **Multiplayer** (`/api/elementum/state` in corporate/server.py, in memory only, gone 10 s after a player leaves): every player sends their
  position ~7×/s and sees the others as hooded heroes with a name tag ("Name ❤ HP", first name from the sign-in), walk/run/jump animation,
  muzzle flashes, punches and spell names. "👥 n playing" in the corner. Monsters stay each player's own.
- **Packs**: 9 kinds now (Demon, Yeti, Mushroom King, Ninja, Frog + Orc, Dino, Monkroose, Blue Demon — Quaternius CC0), each a chief
  (bigger, 2.8× health, casts often) and three followers (1× health, rush in, cast a third as often). When one sees you, the whole pack comes.
  Far-away monsters rest (no animation or AI beyond 80 m) to keep phones fast.
- **Tougher**: the starter Magna Rifle only scratches monsters (1 damage, with a hint) — craft a weapon or use spells.
- **Fists**: an empty hand punches (two punch animations): 9 to dummies, 4 to monsters, and it breaks rocks slowly.
- **3 more spells (28)**: Nox (shadow bolt that slows), Tenebrae (darkness zone), Radius Solis (sun ray). Monsters can now also use dragon
  breath, ring of fire, earthquake, tornado and the sun ray. New trophies: Orc tusk, Dino scale, Monkroose feather, Shadow ash.
- Models are now trimmed properly (animation data of dropped clips was left in the files) and compressed (KHR_mesh_quantization):
  the hero 2.4 MB → 0.85 MB, each KayKit townsperson ~0.25 MB, each monster ~0.2 MB; all models 3.6 MB.

**Potio Fortis + dropping your things (2026-11-17).** Barbara: "add a potion that can make you stronger and faster and it should be
multiplayer", "make you drop your items when you die and stop the message that tells you that the skeleton mage killed".
- ⚗️ **Potio Fortis**: +50% damage and fast feet for 40 s, with a golden ring and sparkles. Drinking it also gives it to every other player
  within 12 m (they see "⚗️ Name shared a Potio Fortis!"); boosted players glow gold for everyone (the server passes a `bf` flag).
  Buy it from Mercator (30 🪙, sells back for 12) or forge it (wood, a Demon horn and a crystal core, hidden in math like every recipe).
- **Beaten = you drop everything you carry** where you fell (it stays 5 minutes, then vanishes); coins and the house chest stay safe.
  You come back with empty hands (fists) and walk back to collect it. The "You're down" screen says this instead of naming a monster.

**Multiplayer rooms (2026-11-17).** Barbara: "add a multiplayer room where I can see other active players and a code".
- The 👥 button (top right; or M) opens the room screen: the room code in big letters, everyone playing in that room right now (name,
  health, in town / in the wilds, how far away), Copy invite link (`?room=CODE`), Join room (type a code), New private room, Back to the
  public world. Players only see others in the same room. The room is remembered in this browser and in the address bar.
- Server: `/api/elementum/state` now takes `room` (letters/digits, up to 6; empty = PUBLIC) and only returns players in that room;
  `POST /api/elementum/room` hands out a 4-character code nobody is using (no look-alike letters). Still memory only.

**Build-up start, houses, trees, villagers (2026-11-17).** Barbara: "you should not start with anything, you build up. To get resources chop
woods and help other villagers out to get money. Add the double houses if someone else is with you — they just have a name tag and can lock
and unlock the door. Only themselves can get in if the door is locked. And put their name over the house. Expand town area if needed".
- You start with nothing (fists, 0 coins). Mercator now sells the Magna Rifle (30 🪙) as your first gun.
- **Trees**: 18 inside the walls (an east and a west grove) and 14 in the wilds. Punch or shoot them (35 HP); they fall and drop 2–4 Lignum,
  and grow back after 45 s.
- **Villagers** (Livia, Marcus, Felix, Octavia — KayKit mage, `models/villager.glb`) each have a job: bring wood / iron / a crystal core,
  knock down dummies, or beat some of a monster kind. ❗ = new job, 💬 = in progress, ✅ = ready to hand in; T opens the job (📜 Help tab),
  accepted jobs show on the left with progress; handing in pays 6–42 🪙 and they think of a new one.
- **Houses**: the town grew to x −45…45, z −36…42; a row of six houses along the north wall replaces the single Domus. The server gives
  every player in a room one house (`houses` in the /api/elementum/state answer, freed when they leave); the owner's name is over the door
  (yours in green). At your door T locks / unlocks it; a locked door stops everyone but its owner (it swings open only for them). Your bed
  and chest are in your house. Offline you get the first house.

### More math: haggling, roofs, patching, building (2026-11-18)
Barbara asked: "add math more like bargaining percentages and fixing roofs and patching and building".
- **Haggling** (`CRAFT.deal(price, level, dir)`): at Mercator's stall every offer of 10+ 🪙 has a 🤝 button, and every stack of 3+
  materials can be haggled to sell all at once. Mercator names a deal in words (Grade 1: "3 coins off"; Grade 3: "a third off";
  Grade 5–6: "25% off", "pay only 60%"; Grade 7: two discounts in a row; Contest: "raised 25% this morning, now 20% off"). Type the price:
  right → the deal is yours; wrong → full price for that item (or no stack deal) until the stall restocks.
- **Cottages with jobs** (`CRAFT.job(kind, level)`): each villager has a cottage with a garden next to them. 42% of their jobs are now
  work jobs — fix the roof (🪵 planks; storm holes show on the roof), patch the wall (🔩 iron plates; holes show in the wall), or build the
  garden fence (🪵 posts). Go to the 🔨 at the cottage, press T, and work out how many: counting at Grade 1, area and perimeter at Grade 4–5,
  fractions/percents/L-shapes at 5–6, Pythagoras, triangles, scale drawings at 7, trapezoids, π = 22/7, area-to-perimeter at Contest.
  Right → the materials are used and the repair shows (plank patches, grey iron plates, a fence that rises); then hand in for 14–34 🪙.
- **Building the training center**: its plan no longer lists the cost; two forge-style problems give the wood and iron amounts.
- Haggling, jobs and building share the adaptive level: two first-try right answers in a row → up a level; two wrong → down, with an
  easier problem.
- Fixed: monster health bars showed through the town walls (a comment had swallowed the line's code).
- **Magna Rifle recipe** (2026-11-18): the first recipe in the forge — Ferrum and Lignum, amounts hidden in math as usual — so you can make
  your first gun instead of buying it from Mercator for 30 🪙.

## Town rules (2026-11-18)
- 🏆 Try Your Hardest board (grades 5–8 story problems + writing; AMC 8 / MATHCOUNTS style tiers) east of the start.
- 📚 Forge math book: US or China standard (grade-by-grade, in English).
- The Forge makes everything that isn't gathered: weapons, potions, all foods, a spell scroll of each element. 📖 Guide tab: how to get every item.
- Hurting townspeople brings the guards; they jail you in Carcer for 30–90 s.
