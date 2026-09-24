#!/bin/sh
# Liveness plus a database round-trip (see src/app/api/health/route.ts).
set -eu
wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
