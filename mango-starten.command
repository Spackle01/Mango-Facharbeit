#!/bin/sh
# Startet Mango Facharbeit (macOS: Doppelklick, Linux: sh mango-starten.command)
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js fehlt. Bitte die LTS-Version von https://nodejs.org installieren und erneut starten."
  exit 1
fi
exec node server/index.js
