# hardywu.com in one container: Caddy (front door, splits traffic by hostname)
#   shop.hardywu.com            -> Next.js store on :3010
#   everything else             -> Flask (site + BookKeep + games) on :5000
# (the store folder has an apostrophe in its name, which Docker's COPY can't
#  parse — so the whole project is copied at once and reached via a glob)
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=caddy:2 /usr/bin/caddy /usr/bin/caddy
WORKDIR /srv
COPY . /srv/

# the store
RUN cd /srv/Hardy*/app && npm ci --no-audit --no-fund && npm run build

# the site, BookKeep and the games
RUN python3 -m venv /srv/venv \
    && /srv/venv/bin/pip install --no-cache-dir -r /srv/BookKeep/requirements.txt

RUN chmod +x /srv/start.sh
ENV NODE_ENV=production PORT=8080 DATA_ROOT=/data
EXPOSE 8080
CMD ["/srv/start.sh"]
