#!/bin/bash
# Auto-deploy SPSM: git pull -> build web_dash/ & server/ (spsm-api).
# Dipasang di cron tiap menit.
set -u
cd /home/basth/spsm-app || exit 0

before=$(git rev-parse HEAD 2>/dev/null) || exit 0
git pull --ff-only origin main >/dev/null 2>&1 || exit 0
after=$(git rev-parse HEAD)
[ "$before" = "$after" ] && exit 0

# 1. Rebuild web_dash bila ada perubahan di web_dash/
if git diff --name-only "$before" "$after" | grep -q '^web_dash/'; then
  docker run --rm -v /home/basth/spsm-app/web_dash:/app -w /app node:22-bookworm-slim \
    sh -c 'npm ci --no-audit --no-fund && npm run build' >/dev/null 2>&1 \
    && echo "$(date -Is) web_dash rebuilt ($after)" >> /home/basth/spsm-app/deploy.log
fi

# 2. Rebuild & restart backend api bila ada perubahan di server/
if git diff --name-only "$before" "$after" | grep -q '^server/'; then
  rsync -av --delete /home/basth/spsm-app/server/ /home/basth/spsm/ --exclude .env --exclude service-account.json >/dev/null 2>&1
  (cd /home/basth/spsm && docker compose build api && docker compose up -d api) >/dev/null 2>&1 \
    && echo "$(date -Is) spsm-api rebuilt & restarted ($after)" >> /home/basth/spsm-app/deploy.log
fi
