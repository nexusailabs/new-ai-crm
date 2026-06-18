#!/bin/bash
#
# AI-CRM Deploy Script
# Builds locally and deploys to remote server
#
# Usage: ./scripts/deploy.sh
#
# Created: 2025-12-28
# Mission: MISSION-20251228-L7WFOB (TASK-005)

set -e

PROJECT_DIR="/home/kei/new-ai-crm"
REMOTE_USER="kei"
REMOTE_HOST="neu.tplinkdns.com"
REMOTE_DIR="~/www/ai-crm"
REMOTE_PASS="${REMOTE_PASS:?Set REMOTE_PASS in your shell or CI secret store}"

echo "=== AI-CRM Deployment ==="
echo ""

# 1. Build locally
echo "[1/4] Building locally..."
cd $PROJECT_DIR
npm run build
echo "Build complete."
echo ""

# 2. Sync to remote
echo "[2/4] Syncing to remote server..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.next/cache' \
  -e "sshpass -p '$REMOTE_PASS' ssh -o StrictHostKeyChecking=no" \
  ./ $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/
echo "Sync complete."
echo ""

# 3. Install dependencies on remote
echo "[3/4] Installing dependencies on remote..."
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST "
  cd $REMOTE_DIR
  export PATH=/opt/homebrew/bin:\$PATH
  npm install --production
"
echo "Dependencies installed."
echo ""

# 4. Restart PM2 service
echo "[4/4] Restarting PM2 service..."
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST "
  cd $REMOTE_DIR
  export PATH=/opt/homebrew/bin:\$PATH
  pm2 restart ai-crm 2>/dev/null || pm2 start ecosystem.config.js
  pm2 save
"
echo "Service restarted."
echo ""

echo "=== Deployment Complete ==="
echo "Production URL: https://bkf.app/ai-crm"
