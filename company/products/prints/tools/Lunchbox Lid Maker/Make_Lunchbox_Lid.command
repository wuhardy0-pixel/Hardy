#!/bin/zsh -l
# Double-click me after putting the customer's picture in Drop_Picture_Here
# and filling in order.txt. I make the print files for a baked-in lid.
cd "$(dirname "$0")"
echo "── Hardy's 3D · Lunchbox Lid Maker ──"
python3 make_lid.py || { echo; echo "Something went wrong (see message above)."; read -s -k "?Press any key to close."; exit 1; }
JOB=$(cat .last_job)
echo "Baking the picture into the lid (takes a minute)..."
/Applications/Blender.app/Contents/MacOS/Blender -b -P bake_lid.py -- "$JOB" 2>/dev/null | grep -E "BAKE_OK" >/dev/null || { echo "Baking failed."; read -s -k "?Press any key to close."; exit 1; }
echo "Done! Opening the folder with your print files..."
open "$JOB"
read -s -k "?Press any key to close."
