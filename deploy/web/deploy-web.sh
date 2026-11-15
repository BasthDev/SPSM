#!/bin/bash
# Auto-deploy web SPSM: git pull -> build web_app/ (docker node) -> dist ter-serve nginx.
# Dipasang di cron tiap menit.
set -u
cd /home/basth/spsm-app || exit 0

before=$(git rev-parse HEAD 2>/dev/null) || exit 0
git pull --ff-only origin main >/dev/null 2>&1 || exit 0
after=$(git rev-parse HEAD)
[ "$before" = "$after" ] && exit 0

# Hanya rebuild bila ada perubahan di web_app/
git diff --name-only "$before" "$after" | grep -q '^web_app/' || exit 0

docker run --rm -v /home/basth/spsm-app/web_app:/app -w /app node:22-bookworm-slim \
  sh -c 'npm ci --no-audit --no-fund && npm run build' >/dev/null 2>&1 \
  && echo "$(date -Is) web rebuilt ($after)" >> /home/basth/spsm-app/deploy.log
