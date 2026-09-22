#!/bin/sh
set -eu

REPOSITORY_URL=${MONEYPATH_REPOSITORY_URL:-https://github.com/70101520/MoneyPath.git}
INSTALL_DIR=${MONEYPATH_INSTALL_DIR:-/opt/moneypath}
BRANCH=${MONEYPATH_BRANCH:-main}

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this installer as root (for example: curl ... | sudo sh)." >&2
  exit 1
fi

if [ -z "${MONEYPATH_DOMAIN:-}" ]; then
  echo "Set MONEYPATH_DOMAIN to a DNS name that points to this server." >&2
  echo "Example: curl -fsSL <installer-url> | sudo MONEYPATH_DOMAIN=money.example.com sh" >&2
  exit 1
fi

case "$MONEYPATH_DOMAIN" in
  http://*|https://*|*/*|*:*)
    echo "MONEYPATH_DOMAIN must contain only a hostname, without scheme, path, or port." >&2
    exit 1
    ;;
esac

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git openssl

if ! command -v docker >/dev/null 2>&1; then
  apt-get install -y docker.io
fi
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-compose-v2 2>/dev/null || apt-get install -y docker-compose-plugin
fi
systemctl enable --now docker

if [ -e "$INSTALL_DIR" ]; then
  echo "$INSTALL_DIR already exists. Fresh installation stopped to protect existing data." >&2
  exit 1
fi
if docker volume inspect moneypath_postgres_data >/dev/null 2>&1; then
  echo "Docker volume moneypath_postgres_data already exists. Fresh installation stopped to protect existing data." >&2
  echo "Back up and deliberately remove or rename the old MoneyPath Compose project before retrying." >&2
  exit 1
fi

git clone --branch "$BRANCH" --single-branch "$REPOSITORY_URL" "$INSTALL_DIR"
cd "$INSTALL_DIR"
umask 077
POSTGRES_PASSWORD=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
SETUP_TOKEN=$(openssl rand -hex 32)
JOB_SECRET=$(openssl rand -hex 32)

cat > .env <<EOF
COMPOSE_PROJECT_NAME=moneypath
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
DATABASE_URL=postgresql://moneypath:$POSTGRES_PASSWORD@localhost:5432/moneypath
MONEYPATH_DOMAIN=$MONEYPATH_DOMAIN
APP_ORIGIN=https://$MONEYPATH_DOMAIN
APP_BIND_ADDRESS=127.0.0.1
APP_PORT=3000
DB_PORT=5432
ENCRYPTION_KEY=$ENCRYPTION_KEY
SETUP_TOKEN=$SETUP_TOKEN
ALLOW_INSECURE_COOKIE=false
AI_PROVIDER=ollama
OLLAMA_MODEL=qwen3.5:4b-q4_K_M
GPT_OSS_BASE_URL=http://gpt-oss:8000/v1
GPT_OSS_MODEL=openai/gpt-oss-20b
WHISPER_MODEL=small
WHISPER_LANGUAGE=auto
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
JOB_SECRET=$JOB_SECRET
NOTIFICATION_INTERVAL_MS=21600000
EOF

docker compose -f compose.yaml -f compose.production.yaml up --build -d

echo "Waiting for MoneyPath application and voice services..."
ready=false
for attempt in $(seq 1 120); do
  if curl -fsS http://127.0.0.1:3000/login >/dev/null 2>&1 && \
     docker compose -f compose.yaml -f compose.production.yaml exec -T voice \
       python -c "import urllib.request; urllib.request.urlopen('http://localhost:8090/health')" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 5
done
if [ "$ready" != true ]; then
  echo "MoneyPath did not become healthy in time." >&2
  docker compose -f compose.yaml -f compose.production.yaml ps >&2
  docker compose -f compose.yaml -f compose.production.yaml logs --tail=100 app voice migrate >&2
  exit 1
fi

owner_count=$(docker compose -f compose.yaml -f compose.production.yaml exec -T db \
  psql -U moneypath -d moneypath -Atc 'SELECT COUNT(*) FROM "User";')
if [ "$owner_count" != "0" ]; then
  echo "Fresh-database verification failed: owner table is not empty." >&2
  exit 1
fi

cat > /root/moneypath-owner-setup.txt <<EOF
MoneyPath URL: https://$MONEYPATH_DOMAIN
One-time owner setup token: $SETUP_TOKEN
Created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Delete this file after creating the owner account.
EOF
chmod 600 /root/moneypath-owner-setup.txt

echo
echo "MoneyPath is starting with a fresh database."
echo "Open: https://$MONEYPATH_DOMAIN"
echo "Owner setup token saved in: /root/moneypath-owner-setup.txt"
echo "DNS must point to this server and inbound TCP 80/443 must be open for HTTPS and microphone access."
echo
docker compose -f compose.yaml -f compose.production.yaml ps
