"""Build welcome_bookkeep.html: big Open button + QR code for the phone URL."""
import base64
import io
import sys
from pathlib import Path

url = (sys.argv[1] if len(sys.argv) > 1 else "").strip()

qr_img = ""
if url:
    try:
        import qrcode
        buf = io.BytesIO()
        qrcode.make(url).save(buf, format="PNG")
        qr_img = f'<img class="qr" src="data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}" alt="QR code">'
    except Exception:
        qr_img = ""

phone_block = f"""
    <h2>On a phone</h2>
    <p>Open the camera and point it at this code:</p>
    {qr_img}
    <p class="small"><a href="{url}">{url}</a><br>
    {"This address is PERMANENT — bookmark it once." if ("ngrok" in url or "hardywu" in url) else "This address changes each time BookKeep is restarted — just scan again."}<br>
    Phones will ask who's using it — just type your name and your books open.</p>
""" if url else """
    <h2>On a phone</h2>
    <p>No internet address right now (the tunnel did not start).<br>
    On the same Wi-Fi you can still try the computer address above.</p>
"""

html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>BookKeep is running</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
 body{{font-family:-apple-system,sans-serif;background:#111827;color:#f4f6fb;text-align:center;padding:40px 20px}}
 .card{{max-width:520px;margin:0 auto;background:#1c2333;border-radius:16px;padding:28px}}
 a.button{{display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:22px;font-weight:700;
   padding:16px 34px;border-radius:12px;margin:12px 0}}
 .qr{{width:220px;height:220px;background:#fff;padding:10px;border-radius:12px;margin:10px auto}}
 .small{{color:#9aa4bd;font-size:13px;line-height:1.6}}
 h1{{margin:6px 0}} h2{{margin:26px 0 6px;color:#c9d3ea}}
</style></head><body>
  <div class="card">
    <h1>📒 BookKeep is running</h1>
    <h2>On this computer</h2>
    <a class="button" href="http://127.0.0.1:5000">Open BookKeep</a><br>
    <a class="button" style="background:#0ea5e9" href="http://127.0.0.1:5001">Open the hardywu.com website</a>
    <p class="small">The website button shows the real site — sections, the store and both games —
    even when your home Wi-Fi blocks the hardywu.com address.</p>
    {phone_block}
  </div>
</body></html>"""

Path(__file__).resolve().parent.joinpath("welcome_bookkeep.html").write_text(html)
print("welcome page written; url =", url or "(none)")
