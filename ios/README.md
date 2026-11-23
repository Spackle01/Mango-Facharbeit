# Mango Facharbeit für iPad (experimentell)

Die iPad-App besteht aus einem kleinen Swift-Rahmen (`App/`), der die Oberfläche von Mango in einer `WKWebView` zeigt, und dem
unveränderten Server von Mango, der als Node.js im selben Prozess läuft ([nodejs-mobile](https://github.com/nodejs-mobile/nodejs-mobile),
Node 18). Das Startskript `nodejs-project/main.js` stellt die Umgebung ein (`MANGO_IPAD`, `MANGO_NUR_API`, Datenordner in der App) und
startet den Server; die App wartet auf `laeuft.txt` bzw. `fehler.txt` im Datenordner.

- **Anbieter:** nur DeepSeek und OpenCode Go (API-Schlüssel). Claude Code und Antigravity brauchen eine Kommandozeile.
- **Dateien:** Arbeitsräume liegen in `Documents/` der App und sind in der Dateien-App unter „Auf meinem iPad“ → „Mango Facharbeit“ sichtbar.
  Was Mango „öffnet“ (Word, PDF, ZIP), wird geladen und über das Teilen-Menü angeboten (`WKDownloadDelegate` in `ViewController.swift`).
- **Hintergrund:** iOS hält die App an, wenn sie nicht im Vordergrund ist; eine laufende Antwort bekommt noch kurz Zeit.

## Bauen (Mac mit Xcode, XcodeGen, GitHub-CLI)

```sh
./ios/vorbereiten.sh          # Server nach ios/nodejs-project/, NodeMobile.framework nach ios/Frameworks/, Version eintragen
cd ios && xcodegen generate
xcodebuild -project MangoFacharbeit.xcodeproj -scheme MangoFacharbeit -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" build
```

Die CI (`.github/workflows/release.yml`, Job `ipad`) tut dasselbe und packt `Payload/MangoFacharbeit.app` zu
`Mango-Facharbeit-<Version>-iPad.ipa`. Die Datei ist **nicht signiert**: Zum Installieren braucht man Sideloadly oder AltStore (Apple-ID,
7 Tage gültig) bzw. ein Apple-Entwicklerkonto (TestFlight/App Store). Sie wurde bisher **nicht auf einem echten iPad getestet**.
