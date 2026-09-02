#!/bin/sh
# Boot everything inside the container. All lasting data lives on the /data volume.
set -e
DATA="${DATA_ROOT:-/data}"
mkdir -p "$DATA/bookkeep" "$DATA/shop-uploads"
export BOOKKEEP_DATA_DIR="$DATA/bookkeep"
SHOP=$(echo /srv/Hardy*/app)
rm -rf "$SHOP/.uploads" && ln -s "$DATA/shop-uploads" "$SHOP/.uploads"

( cd "$SHOP" && exec npx next start -p 3010 ) &
( cd /srv/BookKeep && exec /srv/venv/bin/gunicorn -w 2 -b 127.0.0.1:5000 --timeout 120 --access-logfile - server:app ) &
exec caddy run --config /srv/Caddyfile --adapter caddyfile
