#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${1:-/var/www/taxilao}"
cd "$APP_DIR"

echo "== TAXILAO deploy =="
echo "Directory: $(pwd)"

echo "== Git state before pull =="
git status --short

echo "== Pull latest code =="
git fetch origin main
git pull --ff-only origin main

echo "== Install dependencies =="
npm install

echo "== Verify API syntax =="
node --check apps/api/app.js

echo "== Build apps =="
npm run build --workspace @taxilao/api
npm run build --workspace @taxilao/web
npm run build --workspace @taxilao/admin

echo "== Restart PM2 =="
pm2 restart taxilao-api taxilao-web taxilao-admin --update-env
pm2 save
pm2 status

echo "== Smoke tests =="
curl -fsS https://api.taxilao.com/health >/tmp/taxilao-health.json
cat /tmp/taxilao-health.json
echo
curl -fsSI https://taxilao.com >/dev/null
curl -fsSI https://admin.taxilao.com >/dev/null
curl -fsS https://api.taxilao.com/vehicle-categories >/tmp/taxilao-vehicle-categories.json
head -c 300 /tmp/taxilao-vehicle-categories.json
echo

echo "== Deployed commit =="
git log -1 --oneline

echo "Deploy complete. If browser still shows old UI, hard refresh or purge Cloudflare cache."
