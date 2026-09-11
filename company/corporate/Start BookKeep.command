#!/bin/sh
# Double-click to start BookKeep: backend + phone link, then opens the welcome page.
cd "$(dirname "$0")"

echo "Starting BookKeep..."

# 1) Backend (also serves the app).
if ! curl -s --max-time 2 http://127.0.0.1:5000/api/health >/dev/null; then
  nohup .venv/bin/python server.py >/tmp/bookkeep_server.log 2>&1 &
  for i in 1 2 3 4 5 6 7 8 9 10; do
    curl -s --max-time 2 http://127.0.0.1:5000/api/health >/dev/null && break
    sleep 1
  done
fi

# 2) Internet address: hardywu.com via the named Cloudflare tunnel (permanent,
# free). The old ngrok address is kept alive so old bookmarks/QRs still work.
URL="https://books.hardywu.com"
if ! pgrep -f "cloudflared tunnel run bookkeep" >/dev/null 2>&1; then
  if [ -f "$HOME/.cloudflared/config.yml" ] && command -v cloudflared >/dev/null 2>&1; then
    nohup cloudflared tunnel run bookkeep >/tmp/bookkeep_cf_named.log 2>&1 &
    sleep 4
  else
    URL=""
  fi
fi
# Legacy permanent address (old links keep working).
if command -v ngrok >/dev/null 2>&1 && ! pgrep -f "ngrok http" >/dev/null 2>&1; then
  nohup ngrok http 5000 --url https://blaming-germless-baffle.ngrok-free.dev --log /tmp/bookkeep_ngrok.log >/dev/null 2>&1 &
fi
# Last-resort fallback: temporary cloudflare quick tunnel.
if [ -z "$URL" ] && command -v cloudflared >/dev/null 2>&1; then
  pkill -f "cloudflared tunnel --url" 2>/dev/null
  rm -f /tmp/bookkeep_tunnel.log
  nohup cloudflared tunnel --url http://127.0.0.1:5000 --no-autoupdate >/tmp/bookkeep_tunnel.log 2>&1 &
  for i in $(seq 1 30); do
    URL=$(grep -o "https://[a-z0-9-]*\.trycloudflare\.com" /tmp/bookkeep_tunnel.log 2>/dev/null | tail -1)
    [ -n "$URL" ] && break
    sleep 1
  done
fi

# 2a) Keep the Mac awake while it's serving the site (it sleeps after 1 minute otherwise).
pgrep -x caffeinate >/dev/null || (nohup caffeinate -i -s >/dev/null 2>&1 &)

# 2b) The live-preview shop (shop.hardywu.com).
if ! curl -s --max-time 2 http://127.0.0.1:3010 >/dev/null; then
  (cd "../Hardy's 3D Business/app" && PORT=3010 nohup npm run start -- -p 3010 >/tmp/hardyshop.log 2>&1 &)
fi

# 3) Welcome page with a big Open button and a QR code for the phone.
.venv/bin/python make_welcome.py "$URL"
open welcome_bookkeep.html
echo "Done. You can close this window."
