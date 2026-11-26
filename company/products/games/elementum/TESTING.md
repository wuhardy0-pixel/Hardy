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

Step 3 (inventory, forge, monsters, spells): `window.__el` adds INV, select(i), useHeld(first), addItem, castSpell(id), castAs(enemy,id),
ENEMIES, NODES, PICKUPS, toggleBag(open), drawFor(recipeId), tray, forgeNow(), forgeMsg.
- The hotbar shows the Magna Rifle in slot 1; 1–9 / wheel / tapping a slot changes the hand; the weapon panel follows (gun → ammo, spell → uses).
- Shooting an iron rock or crystal vein counts it down (⛏ number) and breaks it; the drop flies to you and lands in the bag; it grows back after 45 s.
- E opens the bag; tap-tap swaps slots. In the Forge, each recipe shows numbered problems + the crystal-number key; a wrong tray says
  "k of n parts are right" and keeps the materials; the right tray makes the item and draws new problems.
- Every spell in SPELLS casts from the hotbar (uses go down); every monster in ENEMIES casts each of its spells at you; walls stop them.
- Standing still with HP below 100 and nothing healing: HP stays the same. The dummies turn to you within 24 m and shoot.
- Casting Fulmen six times and shooting 20 Electrum rounds leaves no lines in the scene and the light count unchanged (the lightning-lag check).
- Craft problems: run the independent solver in the session scratchpad (`crafttest.js`) — 0 wrong.

Step 4 (town, market, adaptive math): `__el` adds COINS, sell(i), buy(k), OFFERS, MATH ({lv, wrong}), inTown(p), DSHOTS.
- The start screen shows 8 level buttons; the chosen one is used for the forge's first problems and remembered in this browser.
- Inside the walls a monster's spell does no damage; outside it does. A monster standing at a gate never steps inside.
- At the stall (2, 0, 10) the Trade button shows; selling one Ferrum gives 2 🪙; with 20+ 🪙 a potion can be bought.
- Forge right on the first try → MATH.lv + 1 and the forge says "level up"; two wrong tries → MATH.lv − 1 and new problems.
- Dummies fire one slow orange bullet every 5–8 s; it can be walked out of the way of; walls stop it.
- Math check: `crafttest2.js` (session scratchpad) re-solves every level's problems and clues — must print bad 0.

Step 5: `__el` adds useAct(), FOODS, CHEST, HOME, TRAIN, MP, inTraining(p).
- Standing at the Popina (−16, 11.5) the button reads "🍞 Buy food"; buying bread + fish and eating them heals and shows a 🐟 boost chip.
- At the chest (14, 21) items move both ways; at the bed (18.4, 20.4) sleeping restores 100 HP once a minute.
- Before building, the dummies never fire; after building (8 Lignum, 6 Ferrum, 25 🪙) they fire only while you are inside x −11…11, z −25…−6.
- Two windows on the same server (route /api/elementum/state to 127.0.0.1:5000 when testing from a static copy) see each other within a
  second, with name tags; "👥 2 playing" shows. The server keeps nothing on disk.
- With slot 6 empty, click punches; a dummy loses 9. The Magna Rifle does 1 to a monster and shows the "too tough" hint.

Potio Fortis + drop on death: `__el.drinkFortis()`.
- Three players in separate browsers (one browser each — tabs in one headless browser get throttled): A drinks; B at 5 m gets
  might + fast (~40 s) and sees A's gold glow; F at 25 m gets nothing.
- `hurt(999)` with items in the bag: the bag empties, as many pickups appear (life 300 s), coins unchanged, the down screen explains it;
  after Respawn, walking back to the spot refills the bag.

Rooms: `__el.newRoom()`, `__el.setRoom(code)`, `__el.toggleRoom(open)`, `__el.MP.room`.
- A makes a room (4-character code, URL gets ?room=CODE); B types the code and joins; A and B see each other, C (public) sees neither.
- The room screen lists you plus everyone in the room with health, town/wilds and distance; Copy invite link copies the ?room= link.

Multiplayer on the real site: test through the public host, not only 127.0.0.1 — `curl -X POST -H 'X-Forwarded-Proto: https' -H 'Host: play.hardywu.com'
-H 'Content-Type: application/json' -d '{"id":"abcdef123"}' http://127.0.0.1:5000/api/elementum/state` must answer 401 JSON (not a 302 redirect),
and `grep 'api/elementum/state' /tmp/com.hardywu.server.log | tail` must show 200s while someone plays.

Haggling, jobs, building plan (2026-11-18): `__el` adds haggleBuy(k), haggleSell(i), haggle(answer), HAG, workNow(villager, answer),
trainPlan(), buildTraining(), newQuest(v), cottageState(c, kind, state).
- Math check: `jobtest.js` (session scratchpad) re-solves every haggle deal and every roof / patch / fence job at all 8 levels from the
  words alone — must print wrong 0 unparsed 0.
- At the stall with 100 🪙: 🤝 on the Magna Rifle shows Mercator's deal; the right price buys it for that; a wrong price → "full price"
  and the 🤝 button for that item disappears. 🤝 on a stack of 6 Ferrum with the right total sells the stack for it.
- A villager's work job: the cottage shows dark holes (roof / wall) or a rope outline (fence); T at the 🔨 opens the job; a wrong number
  → "won't fit"; right with too little material → asks for more; right with enough → materials used, the repair shows, ✅ pays.
- Build tab: both amounts must be right before the walls go up; two wrong tries → easier plan.
- In town no monster health bars show (they used to show through the walls).

- Sync: open two browsers in one room. Everything one player does or makes must look the same for the other (every new feature too — Barbara, 2026-11-24).
- Saves: before shipping, fill localStorage with every kind of save (elementum.mycar, mycar2 with and without parts, myboat, myhouse with and without parts, placed, apartment, business), reload, click Start, and check there are no page errors and the clock moves. A fresh profile does not catch load-time errors.
- Experiment: BUILD.resembles(parts) ranks the library things; library designs stretched 18% with a part missing should still be top or in the draw for about 70 of 76. Two browsers: a pet follows its owner in both, also after the owner reloads.
- Experiment names: a jar named "drugs" becomes drugs (take some: HP drops about 45 over 10 s, dizzy 20 s, other players see it); a chair named "drugs" or a jar named "car" says it doesn't look like it and goes by looks; "bomb" explodes for both players; set-down "trash" makes the other player lose health slowly; after 20 s the screen is clear again.
- Bad effects: after feel() of something bad, W walks backward, D goes left, a car reverses; good things (coffee) don't change the keys; it wears off.
- Bad effects can knock you down: at 30 HP drugs (-45) end at 0 and down, the bag drops and the other player sees it; at 100 HP you end at 55; trash does it too; asleep or in jail nothing is lost; respawn clears every effect.
- Music: the test browser has no speakers, so the audio clock doesn't move; check with `__music.render(mood, 6)` (town/wild/night/fight must give rms above 0.03) and `__music.want()` at (0,0) town-or-night, (250,250) wild, the arena (-135,55) fight. 🎵 off is remembered after a reload. On a real computer: listen once.
- Spiked food (two browsers): A puts drugs in bread, drops it; B picks it up (it doesn't join B's clean bread), eats, and gets sick + backward keys. B sets down a bowl, A puts poison in it, B eats from it: sick, and the bowl is clean again for both.
- Gas can: BUILD.nameOffline("gas holder") is fuel, "gas" alone is still stinky gas. At the pump: Fill it up (needs coins), by a car: Pour it in; the other player sees the car's fuel change.
