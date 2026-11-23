#!/usr/bin/env bash
# Bereitet den Bau der iPad-App vor (auf einem Mac mit Xcode, XcodeGen und der GitHub-CLI `gh`):
#   1. kopiert den Server, die Oberfläche und die Ressourcen in ios/nodejs-project/ (kommt in die App),
#   2. lädt das Framework NodeMobile (Node.js für iOS, https://github.com/nodejs-mobile/nodejs-mobile) nach ios/Frameworks/,
#   3. trägt die Versionsnummer aus package.json ins Projekt ein.
# Danach: `xcodegen generate` und `xcodebuild` (siehe ios/README.md und .github/workflows/release.yml).
set -euo pipefail
cd "$(dirname "$0")"

VERSION="$(node -p "require('../package.json').version")"
echo "Version: $VERSION"

echo "Server, Oberfläche und Ressourcen in die App kopieren …"
rm -rf nodejs-project/server nodejs-project/public nodejs-project/ressourcen nodejs-project/package.json
cp -R ../server ../public ../ressourcen ../package.json nodejs-project/

echo "Versionsnummer eintragen …"
sed -i.bak "s/MARKETING_VERSION: '[0-9.]*'/MARKETING_VERSION: '${VERSION%%-*}'/" project.yml
rm -f project.yml.bak

if [ ! -d Frameworks/NodeMobile.framework ]; then
  echo "NodeMobile laden …"
  rm -rf tmp && mkdir -p tmp Frameworks
  (
    cd tmp
    gh release download --repo nodejs-mobile/nodejs-mobile --pattern '*ios*.zip' --clobber
    ls -la
    unzip -q ./*.zip
    echo "Gefundene Frameworks:"
    find . -name 'NodeMobile.framework' -maxdepth 4
  )
  # Für Geräte reicht die Fassung nur für iPhone/iPad (arm64); die „universelle“ enthält zusätzlich den Simulator.
  FW="$(find tmp -type d -name 'NodeMobile.framework' | grep -iE 'iphoneos|device' | head -1 || true)"
  [ -n "$FW" ] || FW="$(find tmp -type d -name 'NodeMobile.framework' | head -1)"
  [ -n "$FW" ] || { echo "NodeMobile.framework nicht gefunden"; exit 1; }
  echo "Verwende: $FW"
  cp -R "$FW" Frameworks/
fi
ls -la Frameworks
