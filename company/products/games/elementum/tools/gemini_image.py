# Ask Gemini (Vertex AI, Google Cloud project hardywu-site-758a, gcloud login barbaratao@gmail.com) for one picture.
# Used 2026-11-03 for the hero / dummy concept art and the art/ textures; prompts are in ../README.md.
import sys, json, base64, subprocess, urllib.request
out, prompt = sys.argv[1], sys.argv[2]
aspect = sys.argv[3] if len(sys.argv) > 3 else "1:1"
model = sys.argv[4] if len(sys.argv) > 4 else "gemini-3-pro-image"
refs = sys.argv[5:]
P = "hardywu-site-758a"
tok = subprocess.check_output(["gcloud", "auth", "print-access-token"]).decode().strip()
parts = [{"inlineData": {"mimeType": "image/png", "data": base64.b64encode(open(r, "rb").read()).decode()}} for r in refs]
parts.append({"text": prompt})
body = {"contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"], "imageConfig": {"aspectRatio": aspect}}}
url = f"https://aiplatform.googleapis.com/v1/projects/{P}/locations/global/publishers/google/models/{model}:generateContent"
req = urllib.request.Request(url, json.dumps(body).encode(), {"Authorization": "Bearer " + tok, "Content-Type": "application/json"})
try:
    d = json.load(urllib.request.urlopen(req, timeout=240))
except urllib.error.HTTPError as e:
    print("ERR", e.code, e.read()[:400].decode()); sys.exit(1)
for p in d["candidates"][0]["content"]["parts"]:
    if "inlineData" in p:
        open(out, "wb").write(base64.b64decode(p["inlineData"]["data"])); print("saved", out)
    elif "text" in p:
        print("text:", p["text"][:200])
