#!/bin/bash
#
# MailMotion: Start all services locally
#
# Usage:
#   ./scripts/start-all.sh              # Start with mock GitHub (Path B)
#   ./scripts/start-all.sh supabase     # Start with Supabase storage (Path A)
#   ./scripts/start-all.sh prod         # Start production static export only
#   ./scripts/start-all.sh help         # Show this message
#

set -e

MODE="${1:-github}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}→${NC} $1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC}  $1"
}

show_help() {
  cat << 'EOF'
MailMotion startup script

Usage:
  ./scripts/start-all.sh              # Mock GitHub (Path B) + builder dev
  ./scripts/start-all.sh supabase     # Supabase storage (Path A) + builder dev
  ./scripts/start-all.sh prod         # Production static export only

Environment variables (for supabase mode):
  MM_STORAGE=supabase
  MM_S3_ENDPOINT=https://<project>.supabase.co/storage/v1/s3
  MM_S3_REGION=ap-northeast-2
  MM_S3_BUCKET=testing-bucket
  MM_S3_ACCESS_KEY_ID=<key>
  MM_S3_SECRET_ACCESS_KEY=<secret>
  MM_PUBLIC_BASE_URL=https://<project>.supabase.co/storage/v1/object/public/testing-bucket
  MM_ALLOWED_ORIGINS=http://localhost:3100

Services started:
  - Mock GitHub (port 8790)
  - Publish function (port 8788)
  - Builder dev server (port 3100) or prod static export (port 3200)

Logs:
  /tmp/mm-mock-github.log
  /tmp/mm-publish-fn.log
  /tmp/mm-storage-server.log (supabase mode only)

Stop all services:
  pkill -f "apps/mock-github|apps/publish-fn|apps/storage-server|@mailmotion/web"
EOF
}

cleanup_processes() {
  log_info "Stopping any existing services..."
  pkill -f "apps/mock-github" 2>/dev/null || true
  pkill -f "apps/publish-fn" 2>/dev/null || true
  pkill -f "apps/storage-server" 2>/dev/null || true
  sleep 2
}

start_mock_github() {
  log_info "Starting mock GitHub on :8790..."
  cd "$REPO_ROOT"
  nohup pnpm --filter @mailmotion/mock-github start > /tmp/mm-mock-github.log 2>&1 &
  sleep 2
  if curl -s http://localhost:8790/state > /dev/null 2>&1; then
    log_success "Mock GitHub running on http://localhost:8790"
  else
    log_warn "Mock GitHub may not be ready yet. Check /tmp/mm-mock-github.log"
  fi
}

start_publish_fn() {
  log_info "Starting publish function on :8788..."
  cd "$REPO_ROOT"
  GITHUB_APP_CLIENT_ID=mock-client-id \
  GITHUB_APP_CLIENT_SECRET=mock-secret \
  ALLOWED_ORIGINS=http://localhost:3100 \
  GITHUB_OAUTH_BASE=http://localhost:8790 \
  nohup pnpm --filter @mailmotion/publish-fn start > /tmp/mm-publish-fn.log 2>&1 &
  sleep 2
  if curl -s http://localhost:8788 > /dev/null 2>&1; then
    log_success "Publish function running on http://localhost:8788"
  else
    log_warn "Publish function may not be ready yet. Check /tmp/mm-publish-fn.log"
  fi
}

start_storage_server() {
  log_info "Starting storage server on :8787..."
  cd "$REPO_ROOT"
  MM_STORAGE="${MM_STORAGE:-supabase}" \
  MM_S3_ENDPOINT="${MM_S3_ENDPOINT}" \
  MM_S3_REGION="${MM_S3_REGION:-ap-northeast-2}" \
  MM_S3_BUCKET="${MM_S3_BUCKET}" \
  MM_S3_ACCESS_KEY_ID="${MM_S3_ACCESS_KEY_ID}" \
  MM_S3_SECRET_ACCESS_KEY="${MM_S3_SECRET_ACCESS_KEY}" \
  MM_PUBLIC_BASE_URL="${MM_PUBLIC_BASE_URL}" \
  MM_UPLOAD_TOKEN="${MM_UPLOAD_TOKEN:=$(openssl rand -hex 32)}" \
  MM_ALLOWED_ORIGINS="${MM_ALLOWED_ORIGINS:-http://localhost:3100}" \
  nohup pnpm --filter @mailmotion/storage-server start > /tmp/mm-storage-server.log 2>&1 &
  sleep 2
  if curl -s http://localhost:8787 > /dev/null 2>&1; then
    log_success "Storage server running on http://localhost:8787"
  else
    log_warn "Storage server may not be ready yet. Check /tmp/mm-storage-server.log"
  fi
}

start_builder_dev() {
  log_info "Starting builder dev server on :3100..."
  cd "$REPO_ROOT"
  NEXT_PUBLIC_GITHUB_APP_CLIENT_ID=mock-client-id \
  NEXT_PUBLIC_GITHUB_APP_SLUG=mailmotion-local \
  NEXT_PUBLIC_PUBLISH_FN_URL=http://localhost:8788 \
  NEXT_PUBLIC_GITHUB_OAUTH_BASE=http://localhost:8790 \
  NEXT_PUBLIC_GITHUB_API_BASE=http://localhost:8790 \
  NEXT_PUBLIC_GITHUB_PAGES_TEMPLATE='http://localhost:8790/pages/{owner}/{repo}' \
  pnpm --filter @mailmotion/web exec next dev -p 3100
}

start_builder_prod() {
  log_info "Starting production static export server on :3200..."
  cd "$REPO_ROOT"
  log_info "Building first-time production export (this may take a minute)..."
  pnpm --filter @mailmotion/web build
  PORT=3200 node apps/web/scripts/serve-out.mjs
}

start_github_mode() {
  cleanup_processes
  start_mock_github
  start_publish_fn
  log_info "Starting builder dev server..."
  log_info "→ Open http://localhost:3100 in your browser"
  log_info "→ Use GitHub Publish (Path B) to test end-to-end GitHub flow"
  log_info "→ Or manually enter http://localhost:8787 in Host step with your bearer token"
  echo
  start_builder_dev
}

start_supabase_mode() {
  if [ -z "$MM_S3_BUCKET" ]; then
    log_warn "Supabase mode requires MM_S3_* env vars. Example:"
    cat << 'EOF'
  MM_STORAGE=supabase \
  MM_S3_ENDPOINT=https://gpeovpvpqiiktgmmbynk.storage.supabase.co/storage/v1/s3 \
  MM_S3_REGION=ap-northeast-2 \
  MM_S3_BUCKET=testing-bucket \
  MM_S3_ACCESS_KEY_ID=<your key> \
  MM_S3_SECRET_ACCESS_KEY=<your secret> \
  MM_PUBLIC_BASE_URL=https://gpeovpvpqiiktgmmbynk.storage.supabase.co/storage/v1/object/public/testing-bucket \
  MM_ALLOWED_ORIGINS=http://localhost:3100 \
  ./scripts/start-all.sh supabase
EOF
    exit 1
  fi

  cleanup_processes
  start_storage_server
  log_info "Starting builder dev server..."
  log_info "→ Open http://localhost:3100 in your browser"
  log_info "→ Go to Install → Host → Your storage"
  log_info "→ Enter http://localhost:8787 and your bearer token"
  echo
  start_builder_dev
}

start_prod_mode() {
  cleanup_processes
  log_info "Production mode: no GitHub or Supabase, just the static export"
  start_builder_prod
}

# Main entry point
case "$MODE" in
  help)
    show_help
    ;;
  github)
    start_github_mode
    ;;
  supabase)
    start_supabase_mode
    ;;
  prod)
    start_prod_mode
    ;;
  *)
    echo "Unknown mode: $MODE"
    show_help
    exit 1
    ;;
esac
