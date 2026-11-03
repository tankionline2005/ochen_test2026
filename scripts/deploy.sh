#!/bin/sh
# Build the site and put it, with the API, on the server.
#   sh scripts/deploy.sh            — site + API
#   sh scripts/deploy.sh web        — only the site
# Needs SSH access by key (KEY, HOST below). The OpenRouter key is not here: it lives in /opt/ochen/.env on the server.
set -e
HOST=${HOST:-root@82.47.62.72}
KEY=${KEY:-$HOME/.ssh/ochen_vps}
cd "$(dirname "$0")/.."

npm --prefix web run build
tar -czf dist.tgz -C web/dist .
scp -q -i "$KEY" dist.tgz "$HOST:/tmp/dist.tgz"
rm dist.tgz
ssh -i "$KEY" "$HOST" 'set -e
  rm -rf /var/www/ochen.new && mkdir /var/www/ochen.new
  tar -xzf /tmp/dist.tgz -C /var/www/ochen.new && rm /tmp/dist.tgz
  chmod -R a+rX /var/www/ochen.new
  rm -rf /var/www/ochen.old && mv /var/www/ochen /var/www/ochen.old && mv /var/www/ochen.new /var/www/ochen'
echo "site deployed"

[ "$1" = "web" ] && exit 0

scp -q -i "$KEY" server/app.py server/requirements.txt server/ochen-api.service "$HOST:/tmp/"
ssh -i "$KEY" "$HOST" 'set -e
  install -m 644 /tmp/app.py /tmp/requirements.txt /opt/ochen/server/
  install -m 644 /tmp/ochen-api.service /etc/systemd/system/ochen-api.service
  rm -f /tmp/app.py /tmp/requirements.txt /tmp/ochen-api.service
  /opt/ochen/venv/bin/pip install -q -r /opt/ochen/server/requirements.txt
  systemctl daemon-reload && systemctl restart ochen-api
  for i in 1 2 3 4 5 6 7 8 9 10; do curl -sf http://127.0.0.1:8000/api/health && break; sleep 1; done'
echo
echo "api deployed"
