#!/bin/bash
#
# MailMotion: Start all services locally
#
# Usage:
#   ./scripts/start-all.sh              # Storage server (from .env) + builder — the default
#   ./scripts/start-all.sh github       # Mock GitHub + publish-fn + builder (Path B; not linked
#                                        # from the builder UI anymore, see docs/github-pages.md)
#   ./scripts/start-all.sh prod         # Production static export only
#   ./scripts/start-all.sh help         # Show this message
#
# Put your config in .env at the repo root (see .env.example) — this script loads it
# automatically. In particular, for the builder's "Upload images" button to do anything, set:
#   NEXT_PUBLIC_UPLOAD_ENDPOINT=http://localhost:8787
#   NEXT_PUBLIC_UPLOAD_TOKEN=<same as MM_UPLOAD_TOKEN>
#

set -e

MODE="${1:-storage}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Load repo-root .env if present, as defaults only: a variable already exported
# by the caller (e.g. `MM_STORAGE=disk ./scripts/start-all.sh`) is left alone.
if [ -f "$REPO_ROOT/.env" ]; then
  while IFS= read -r line; do
    case "$line" in
      ''|'#'*) continue ;;
    esac
    key="${line%%=*}"
    [ -z "${!key+x}" ] && export "$line"
  done < "$REPO_ROOT/.env"
fi

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
  ./scripts/start-all.sh              # Storage server (from .env) + builder (default)
  ./scripts/start-all.sh github       # Mock GitHub + publish-fn + builder (Path B, not linked
                                       # from the builder UI anymore — see docs/github-pages.md)
  ./scripts/start-all.sh prod         # Production static export only

Config lives in .env at the repo root (copy .env.example). Loaded automatically. Key variables:
  MM_STORAGE=disk|s3|r2|minio|supabase   # which backend the storage server writes to
  MM_UPLOAD_TOKEN                        # bearer token the builder uses to upload
  NEXT_PUBLIC_UPLOAD_ENDPOINT            # = http://localhost:8787, so the builder finds the server
  NEXT_PUBLIC_UPLOAD_TOKEN               # = same value as MM_UPLOAD_TOKEN

Services started:
  storage (default): storage server (:8787) + builder dev (:3100)
  github:            mock GitHub (:8790) + publish-fn (:8788) + builder dev (:3100)
  prod:              production static export (:3200) only

Logs:
  /tmp/mm-storage-server.log
  /tmp/mm-mock-github.log
  /tmp/mm-publish-fn.log

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
  GITHUB_APP_CLIENT_ID="${GITHUB_APP_CLIENT_ID:-mock-client-id}" \
  GITHUB_APP_CLIENT_SECRET="${GITHUB_APP_CLIENT_SECRET:-mock-secret}" \
  ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-http://localhost:3100}" \
  GITHUB_OAUTH_BASE="${GITHUB_OAUTH_BASE:-http://localhost:8790}" \
  nohup pnpm --filter @mailmotion/publish-fn start > /tmp/mm-publish-fn.log 2>&1 &
  sleep 2
  if curl -s http://localhost:8788 > /dev/null 2>&1; then
    log_success "Publish function running on http://localhost:8788"
  else
    log_warn "Publish function may not be ready yet. Check /tmp/mm-publish-fn.log"
  fi
}

start_storage_server() {
  log_info "Starting storage server (${MM_STORAGE:-disk}) on :8787..."
  cd "$REPO_ROOT"
  # MM_STORAGE, MM_S3_*, MM_PUBLIC_BASE_URL etc. are inherited from .env (or the caller's
  # environment) if set; the server falls back to disk storage on its own otherwise.
  MM_UPLOAD_TOKEN="${MM_UPLOAD_TOKEN:=$(openssl rand -hex 32)}" \
  MM_ALLOWED_ORIGINS="${MM_ALLOWED_ORIGINS:-http://localhost:3100}" \
  nohup pnpm --filter @mailmotion/storage-server start > /tmp/mm-storage-server.log 2>&1 &
  sleep 2
  if curl -s http://localhost:8787 > /dev/null 2>&1; then
    log_success "Storage server running on http://localhost:8787"
  else
    log_warn "Storage server may not be ready yet. Check /tmp/mm-storage-server.log"
  fi
  if [ -z "$NEXT_PUBLIC_UPLOAD_ENDPOINT" ] || [ -z "$NEXT_PUBLIC_UPLOAD_TOKEN" ]; then
    log_warn "NEXT_PUBLIC_UPLOAD_ENDPOINT / NEXT_PUBLIC_UPLOAD_TOKEN are not set in .env — the"
    log_warn "builder's Install step will show a notice instead of an Upload button. Set:"
    log_warn "  NEXT_PUBLIC_UPLOAD_ENDPOINT=http://localhost:8787"
    log_warn "  NEXT_PUBLIC_UPLOAD_TOKEN=$MM_UPLOAD_TOKEN"
  fi
}

start_builder_dev() {
  log_info "Starting builder dev server on :3100..."
  cd "$REPO_ROOT"
  pnpm --filter @mailmotion/web exec next dev -p 3100
}

start_builder_prod() {
  log_info "Starting production static export server on :3200..."
  cd "$REPO_ROOT"
  log_info "Building first-time production export (this may take a minute)..."
  pnpm --filter @mailmotion/web build
  PORT=3200 node apps/web/scripts/serve-out.mjs
}

start_storage_mode() {
  cleanup_processes
  start_storage_server
  log_info "Starting builder dev server..."
  log_info "→ Open http://localhost:3100 in your browser"
  log_info "→ Install → Upload images uploads straight to your configured bucket"
  echo
  start_builder_dev
}

start_github_mode() {
  cleanup_processes
  start_mock_github
  start_publish_fn
  log_info "Starting builder dev server..."
  log_info "→ Open http://localhost:3100 in your browser"
  log_info "→ Note: GitHub publishing is not currently linked from the Install step UI."
  log_info "→ See docs/github-pages.md to wire HostStep back up to it."
  echo
  start_builder_dev
}

start_prod_mode() {
  cleanup_processes
  log_info "Production mode: just the static export, no dynamic services"
  start_builder_prod
}

# Main entry point
case "$MODE" in
  help)
    show_help
    ;;
  storage|supabase)
    start_storage_mode
    ;;
  github)
    start_github_mode
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
