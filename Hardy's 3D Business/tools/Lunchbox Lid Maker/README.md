# Lunchbox Lid Maker

Turns a customer's picture + name into a lunchbox lid with the image **baked
into the geometry** — a pocket is carved into the lid's top face and flush
color pieces fill it, so it prints as one solid piece.

## For each order (2 minutes)

1. Save the picture from the order email into **Drop_Picture_Here**.
2. Open **order.txt** — type the customer's name and name color from the email.
3. Double-click **Make_Lunchbox_Lid.command**.
4. A folder opens in "Print These" containing:
   - `render.png` — look at this first: it shows the finished lid.
   - `Lid_Body.stl` — the lid, print in the customer's LID color.
   - `Inlay_<Color>.stl` — one per picture color.
   - `preview.png` — the flattened picture as it will print.
5. In the slicer: import ALL the STL files together **as one object with
   multiple parts** (Bambu/Orca ask this when you select several files —
   answer Yes). Assign each part its filament color. Slice and print
   top-face-up. No supports needed for the lid plate.

The picture is automatically simplified to at most the number of colors in
order.txt (MAX_COLORS) chosen from the shop palette: White, Black, Purple,
Blue, Orange, Red. Black usually matters most — it carries the outlines.

Requires Blender installed at /Applications/Blender.app (already true on this
Mac). The lid model comes from Documents/3D/Lunchbox/upload/Lunchbox_Cap.stl.
