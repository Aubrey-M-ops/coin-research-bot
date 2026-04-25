#!/usr/bin/env bash

set -euo pipefail

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-.env.deploy}"

if [[ -f "$DEPLOY_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV_FILE"
  set +a
fi

SSH_HOST="${SSH_HOST:-${1:-${VPS_USER:-root}@${VPS_HOST:-}}}"
SSH_PATH="${SSH_PATH:-${2:-${INSTALL_DIR:-}}}"
SSH_PORT="${SSH_PORT:-${VPS_PORT:-22}}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-$(git branch --show-current 2>/dev/null || echo unknown)}"
REMOTE_ENV_FILE="${REMOTE_ENV_FILE:-}"
REMOTE_SERVICE="${REMOTE_SERVICE:-bot}"

if [[ -z "$SSH_HOST" || -z "$SSH_PATH" ]]; then
  cat <<'EOF'
Usage:
  bun run deploy:ssh
  DEPLOY_ENV_FILE=.env.deploy bun run deploy:ssh
  SSH_HOST=user@server SSH_PATH=/opt/crypto-research-bot bash scripts/deploy-ssh.sh
  bash scripts/deploy-ssh.sh user@server /opt/crypto-research-bot

Optional env:
  DEPLOY_ENV_FILE=.env.deploy
  SSH_PORT=22
  REMOTE_SERVICE=bot
  REMOTE_ENV_FILE=/opt/crypto-research-bot/.env
  DEPLOY_BRANCH=current-branch-name

Supported keys inside DEPLOY_ENV_FILE:
  VPS_HOST=178.156.196.115
  VPS_USER=root
  VPS_PORT=22
  INSTALL_DIR=/opt/crypto-research-bot
EOF
  exit 1
fi

if [[ -z "$REMOTE_ENV_FILE" ]]; then
  REMOTE_ENV_FILE="${SSH_PATH}/.env"
fi

echo "==> Deploying branch ${DEPLOY_BRANCH} to ${SSH_HOST}:${SSH_PATH}"
echo "==> Using deploy config: ${DEPLOY_ENV_FILE}"

ssh -p "$SSH_PORT" "$SSH_HOST" "mkdir -p '$SSH_PATH'"

rsync \
  --archive \
  --compress \
  --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude '.DS_Store' \
  -e "ssh -p $SSH_PORT" \
  ./ "$SSH_HOST:$SSH_PATH/"

echo "==> Copying local .env to ${SSH_HOST}:${REMOTE_ENV_FILE}"
scp -P "$SSH_PORT" .env "$SSH_HOST:$REMOTE_ENV_FILE"

ssh -p "$SSH_PORT" "$SSH_HOST" "
  set -euo pipefail
  cd '$SSH_PATH'

  if [ ! -f '$REMOTE_ENV_FILE' ]; then
    echo 'Missing env file: $REMOTE_ENV_FILE' >&2
    exit 1
  fi

  if ! command -v docker >/dev/null 2>&1; then
    echo 'docker is not installed on remote host' >&2
    exit 1
  fi

  if ! docker compose version >/dev/null 2>&1; then
    echo 'docker compose is not available on remote host' >&2
    exit 1
  fi

  echo '==> Rebuilding and recreating service: $REMOTE_SERVICE'
  docker compose up -d --build --force-recreate '$REMOTE_SERVICE'

  echo '==> Restarting service on VPS: $REMOTE_SERVICE'
  docker compose restart '$REMOTE_SERVICE'

  echo '==> Current compose status'
  docker compose ps

  echo '==> Recent service logs'
  docker compose logs --tail=20 '$REMOTE_SERVICE' || true
"
