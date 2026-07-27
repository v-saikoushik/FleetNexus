#!/usr/bin/env bash
# Bootstrap local development: copy env, start Postgres, install deps, generate Prisma client.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

pnpm install
pnpm docker:up
pnpm prisma:generate

echo "FleetNexus foundation is ready."
echo "  Web:  pnpm dev:web"
echo "  API:  pnpm dev:api"
echo "  Both: pnpm dev"
