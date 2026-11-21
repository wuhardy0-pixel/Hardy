import subprocess, os, sys
from concurrent.futures import ThreadPoolExecutor
G="/Users/barbaratao/Documents/Hardy/company/products/games/elementum/tools/gemini_image.py"
rows=[l.rstrip("\n").split("\t") for l in open(os.path.join(os.path.dirname(__file__),"items.tsv")) if l.strip()]
def gen(r):
    k,d=r;out=f"items_raw/{k}.png"
    if os.path.exists(out) and os.path.getsize(out)>0: return k,"have"
    p=f"Product photo like an online shop listing: {d}. One single object, centered, the whole object visible with a little space around it, realistic, soft studio lighting, on a perfectly flat pure bright green (#00FF00) background, no shadow, no text, no other objects."
    import time
    for t in range(6):
        r=subprocess.run([sys.executable,G,out,p,"1:1","gemini-3.1-flash-image"],capture_output=True,text=True)
        if os.path.exists(out): time.sleep(4); return k,"ok"
        time.sleep(20*(t+1))
    return k,"FAIL "+r.stdout[-200:]
with ThreadPoolExecutor(2) as ex:
    for k,s in ex.map(gen,rows): print(k,s)
