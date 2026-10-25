# Elemental Latin — done and next

## 2026-10-23
- First version from Barbara's idea: 'superpowers and abilities with Latin names that teach Latin; you can make skills but with the right endings'. Nouns in 1st/2nd/3rd/5th declension with nom/acc/abl, verbs in 1st/2nd/3rd/3rd-io conjugation (s1, s2, s3, p1, imperative), rule-checker with teaching messages, element ring, 7 creatures, familiar + imperative at level 2, 'we' at level 3, ablative at level 5, spellbook, codex. Registered on the site games section.

- Barbara: 'no — it is humans, and the creatures are in the wild where you can try to tame'. Rebuilt: camp hub → arena (human rivals who cast Latin with translations) or wild (creatures; weaken, then call in the vocative + imperative *veni!* to tame; fainted creatures flee; tame chance shown). Familiars come only from taming; active one chosen at camp. XP-based levels.

- Barbara: 'make it like Fortnite and Prodigy'. Added a walkable world map (canvas, 15×11 biomes, D-pad/tap/arrows, biome-based wild encounters, towns with rival mages, the arena), an avatar with 6 outfits + hats on an XP reward track (crown only from a Royale win; look saved in the browser), and the Ludus Royale (six mages, shrinking ring, carried-over health, crown). Camp = wardrobe + track + familiars.

- Barbara: 'no — like Fortnite where it is 3D; the skills you spray, animations and effects'. Rebuilt the visuals in Three.js (vendored r158 + scene.js, served via a new /play/latin/<file> route): 3D terrain world with a chase camera, D-pad/tap/arrow walking with a hop, biome arenas, 3D mage (outfit colours, hats, staff with element orb) and creatures (body/head/legs/tail, spikes/wings/ears by species), rival mages in element robes, familiar beside you; particle sprays per element, bolts, beams, rocks, shield domes, heal/charge/fizzle/tame effects, flinch, camera shake, damage numbers, red hit vignette, Royale storm wall. The spell builder became four scrollable rows so Cast stays on screen on a phone. HTML HUD (hp bars, log, builder) is translucent over the scene.

- Hardy: 'use the new zips for the new game; also in the 260 zips generate 3D characters with the portraits'. From the 260-portrait pack: 30 heroes became cut-out cards (art/chars/*.webp, 20 cut with rembg, the rest from the pack's no-background set) — the player picks one of 12 as their hero on the reward track, 12 town rivals each have one, HUD and camp show the portraits; 11 cube tiles became terrain/arena textures (art/tiles). From Binbun3D's CC0 Godot VFX packs: the flame, comet projectile, impact sphere, hit stars, beam and cast-flare shaders were ported to GLSL ShaderMaterials with a generated tileable noise texture. Build script: tools/build_art.py.

## Next
- Ask Hardy which Latin he is learning (cases/tenses) so the levels match his class; add perfect tense and plural nouns.
- Sounds (casts, hits, the storm).
- Creature portraits: the pack has a dragon head and a werewolf — consider cards for Draco and Lupus.
- Confirm the 260-pack licence (where Hardy got it) before any paid release.
- Walk animation for the mage's legs; creature attack lunge; idle cloth sway.
- Performance pass on old phones (particle counts, pixel ratio) once Hardy tries it on his.
