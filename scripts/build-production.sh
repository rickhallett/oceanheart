#!/usr/bin/env bash
set -euo pipefail

# Keep published archive routes and assets available during the redesign.
bash build.sh
npm run build --prefix website
node scripts/overlay-website.mjs
