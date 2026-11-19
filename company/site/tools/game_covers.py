# Painted game covers (2026-11-18): one Cozy (cute pastel) and one Space (neon) cover per game, painted by Gemini from real screenshots.
# Run: python3 game_covers.py [slug:cozy ...] — then resize to 800 px wide JPG as site/images/item_<slug>_<style>.jpg (server.py picks them up).
# Reference screenshots were taken with Playwright from each game; paths below point at that session's scratchpad — re-shoot for new runs.
import subprocess,sys,os
from concurrent.futures import ThreadPoolExecutor
S="/private/tmp/claude-501/-Users-barbaratao-Documents-Hardy/6c4bc451-db45-4fac-a566-8781b76e1955/scratchpad"
EL="/Users/barbaratao/Documents/Hardy/company/products/games/elementum/tools/gemini_image.py"
IMG="/Users/barbaratao/Documents/Hardy/company/site/images"
LA="/Users/barbaratao/Documents/Hardy/company/products/games/elemental-latin/art/chars"
GAMES={
 "football-sim":("FOOTBALL SIM","an original 3D football (soccer) match: players in red and blue kits sprinting for the ball, a striker about to shoot, a huge packed stadium with floodlights",[f"{S}/shots/fifa_b0.png"]),
 "nova-blast":("NOVA BLAST","a small arrow-shaped spaceship blasting glowing shots at a wave of raider ships and asteroids, power-up orbs, a big boss ship looming",[f"{S}/shots/nova_b3.png"]),
 "critter-quest":("CRITTER QUEST","four little starter creatures on an adventure together: Emberfox (an orange fire fox), Aquafin (a blue water creature), Leafcub (a green leaf cub), Sparkbat (a yellow electric bat), with a young trainer, a path through a green town",[f"{S}/shots/quest_0.png",f"{S}/shots/quest_c0.png"]),
 "zheng-shang-you":("争上游","the family card game Zheng Shang You: a fan of playing cards bursting out, a four-of-a-kind 'bomb' exploding with sparkles, two jokers, family members around a table (grandma, uncle, cousin) having fun. Under the big title, a smaller subtitle 'Zheng Shang You'",[f"{S}/shots/zsy_1.png"]),
 "elemental-latin":("ELEMENTAL LATIN","young elemental wizards casting spells: one throws fire, one bends water, one calls lightning, glowing Latin words floating in the air like magic runes",[f"{LA}/fire-lord.webp",f"{LA}/water-lady.webp",f"{LA}/thunder-prince.webp"]),
 "elementum":("ELEMENTUM","the small hooded adventurer in a green hood and cape casting a fireball with lightning and water swirling, a walled Roman town with red banners and a market stall behind, cute monsters (red demon, white yeti, mushroom king) outside the walls",[f"{S}/cover1.png",f"{S}/shots/elem_1.png"]),
 "nova-strike":("NOVA STRIKE","a sleek fighter spaceship on a mission, dodging and shooting through an alien fleet, glowing math-symbol power-ups (+, −, ×, ÷) floating as collectible orbs",[f"{IMG}/item_novastrike.png"]),
 "cmind-freecell":("FREECELL","a calm game of FreeCell solitaire: clearly recognizable real playing cards (white cards with red and black ranks and suits like A♥, K♠, Q♦, 7♣) laid out in neat cascading columns, an ace of hearts being placed on a foundation pile, a cup of tea nearby",[f"{IMG}/item_freecell.png"]),
 "pokemon-adventure":("POKÉMON ADVENTURE","a creature-catching adventure: a kid explorer with a backpack and a few ORIGINAL cute creatures of the explorer's own design (do NOT draw any real Pokémon characters and do NOT draw a Poké Ball), tall grass, a path to a far mountain",[f"{IMG}/item_pokemonadv.png"]),
}
STY={
 "cozy":"Style: VERY CUTE and cozy — a storybook / soft clay-toy look, soft pastel colors (peach, cream, mint, sky blue, warm orange), round chunky shapes, kawaii friendly faces, gentle warm sunny light, little sparkles, a warm cream tint overall. Title text '{t}' in a chunky rounded bubbly font, deep navy blue (#0b2d5c) letters with a thick white outline and a soft orange shadow.",
 "space":"Style: SUPER COOL sci-fi — a deep navy-to-black night sky with stars and a purple-blue nebula, glowing cyan (#22d3ee) neon rim lights and magenta accents, dramatic cinematic lighting, sleek and epic. Title text '{t}' in a bold futuristic tech font with cut corners, glowing cyan neon letters.",
}
def job(a):
  slug,th=a;t,subj,refs=GAMES[slug];out=f"{S}/covers/{slug}_{th}.png"
  if os.path.exists(out):return slug,th,"exists"
  p=(f"Paint a wide video-game cover for the game '{t}', based on the attached real picture(s) from the game — keep what the game really looks like (its characters, objects and setting). Scene: {subj}. "
     +STY[th].format(t=t)+" The title goes at the top center, fully visible with a margin. Keep the title and the main subject inside the middle 80% of the width. Polished, high detail, professional game key art. No other text, no logos, no watermark, no UI.")
  import time
  for k in range(8):
    r=subprocess.run(["python3",EL,out,p,"16:9","gemini-3-pro-image",*refs],capture_output=True,text=True,timeout=400)
    if os.path.exists(out) or "429" not in r.stdout:break
    time.sleep(40+20*k)
  return slug,th,"ok" if os.path.exists(out) else (r.stdout+r.stderr)[-300:]
todo=[(g,t) for g in GAMES for t in STY] if len(sys.argv)<2 else [tuple(x.split(":")) for x in sys.argv[1:]]
with ThreadPoolExecutor(1) as ex:
  for res in ex.map(job,todo):print(*res,flush=True)
