# prints — done and next

## 2026-09-10
- Moved from `Hardy's 3D Business/` (assets, design, tools). No changes to the items.

## 2026-10-25
- Built a unicorn + violin multicolor lid for the downloaded "5050" lunch box through the Fusion 360 MCP bridge (sketch -> per-color inlays -> 1.2 mm pocket). Print files, .f3d, preview and README in `tools/Lunchbox Lid Maker/Print These/2026-10-25_Unicorn_Violin_5050-lid/`. Not yet test-printed.

- Revised the same day: Barbara can print one colour, or several but no Purple. Final files: `Print These/2026-10-25_Sophia_Unicorn_Violin_final/` (raised 1.2 mm, four colours White/Black/Blue/Orange, name "Sophia" in Blue clear of the violin) and `Print These/2026-10-25_Sophia_Unicorn_Violin_1color/` (two-level relief fused into the lid, one STL). Raised art means the lid prints picture-side up with supports, or the picture is printed flat and glued on. Not test-printed.

- 2026-10-26: Sophia unicorn-violin lid: combined all 47 raised pieces into ONE mesh body in Fusion (Combine Join splits non-touching pieces, so tessellated each island and used mesh Combine/Merge), raised the black line work to 1.8 mm over 1.2 mm fills so the eye/mouth/mane lines show inside the unicorn; wrote `Relief_All.stl` straight from the mesh data (Fusion's STL export silently skips mesh bodies) into `Print These/2026-10-25_Sophia_Unicorn_Violin_final/` with two new renders; README updated.

- 2026-10-27: Etsy market research (what sells, why, who buys; 3D-print shops and over-$30 bestsellers) written up in `research/2026-10-27_etsy_what_sells.md`. Etsy blocks scraping; numbers are from Alura/MakerWords/FindNiche and seller interviews.

- 2026-10-27: Sophia lid: Barbara asked to remove the triangles. Deleted the tessellate/mesh-combine steps so the relief is eight solid bodies again ("Relief part 1-8"), moved them with the same 180-degree flip she gave the lid, and rewrote `Relief_All.stl` (8 MB) from the solids; `Lid_Body.stl` and the four per-colour STLs re-exported/flipped to match; renders and .f3d refreshed; README updated. Fusion doc "Sophia Cover" not saved by me.

- 2026-10-27 (later): Barbara wants the picture cut INTO the lid for multicolour. Relief is now 47 solid inlay bodies (1.2 mm, named by colour) flush in a "Pocket for inlays" cut; black no longer raised. All STLs (Lid_Body with pocket, four colour files, Relief_All) rewritten picture-side up in one shared position; renders, render_pocket.png, .f3d and README refreshed. Fusion doc "Sophia Cover" still unsaved by me.

- 2026-10-27: Sophia lid: name is now one solid Blue body (black outline joined in); whole picture turned 180 degrees so it is upright when the box is carried by the handle (handle mounts on the latch side, opposite the hinge). Pocket re-cut, no overlaps; all STLs, renders (new render_as_carried.png), .f3d and README refreshed. Fusion doc not saved by me.

- 2026-10-27: Sophia lid redrawn on a 0.2 mm grid with smoothed edges (scratchpad compose_hd/trace_hd), rebuilt in Fusion as smooth inlays; name and music staff exported as their own files (Relief_Name, Relief_Music) so they can be White on the purple lid. README gives the colour plan for the filaments at home (blue, black, orange, red, white, purple).

- 2026-10-27: Sophia lid limited to four colours (Purple lid + White, Orange, Black): blue hair pieces joined back into the lid so the hair is lid purple inside the black outline; Relief_Blue.stl removed; lid STL, renders, .f3d, README refreshed.

- 2026-10-27: Sophia lid switched to a WHITE lid: face joined into the lid, hair + name Purple, music + outlines Black, horn/violin Orange. Files now Lid_Body + Relief_Purple/Orange/Black (+ Relief_All); old White/Blue/Name/Music STLs removed.

- 2026-10-27: Sophia lid STLs re-saved picture-face-down at z=0 (ready to print); overhang check: only the hinge knuckles need support (build plate only), ~2,400 mm2 of mostly 45-degree rim otherwise. README printing steps updated.

- 2026-10-27: Barbara moved the Lunchbox project folder to `Documents/Hardy/3d printing/Lunchbox` (Sophia's colour-named print files in `Sophia/`). Updated the cap path in Lunchbox Lid Maker (bake_lid.py, README) and the customizable-lunchbox note.

- 2026-10-27: Sophia lid: added `Sophia lid - combined.stl` (all four parts in one STL), `Sophia lid - 4 colours.3mf` (one object, four parts, filament slots 1-4) and `Sophia full lunchbox.3mf` (lid + Luke's 5050 box, handle, hinge rod, 14 small parts) in `Documents/Hardy/3d printing/Lunchbox/Sophia/`. Builder script in scratchpad kit/make_kit.py. Not yet opened in Creality Print by me.

- 2026-10-28: Toys fixed and rebuilt in Fusion 360 (files in ~/Documents/3D/<toy>/, old files in each toy's `work files/old version (before 2026-10-28)`): Paw Fidget Spinner (real paw prints, print-in-place V-race button, no overhangs), Flexi Caterpillar (9 segments + head, peg-in-socket joints 0.45 mm gap, ±20° swing, flat bottoms; old file had overlapping segments and ~2,700 loose fragments), Finger Skateboard (kicktail deck printed on its side, riser pads with pegs, two print-in-place trucks with wheels on V-ridge axles; old wheels floated with no axle), Flexi Skeleton (loose specks removed, centred). New photos, catalog text and info.md updated; shop rebuilt and restarted. Not test-printed yet. Build scripts: ~/Documents/3D/Fusion 360/Toy build scripts 2026-10-28/.

## Next
- 
