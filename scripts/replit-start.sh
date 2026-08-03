#!/usr/bin/env bash
set -euo pipefail

export NODE_ENV=production
export PORT="${PORT:-8000}"
npm run start --workspace backend
