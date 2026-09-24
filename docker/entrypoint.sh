#!/bin/sh
# Starts BrewCore. Migrations are NOT applied here: they run once in the
# separate `migrate` service, which the app waits for (NutriCore pattern).
set -eu
echo "Starting BrewCore..."
exec node server.js
