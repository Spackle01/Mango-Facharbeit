Die KI schreibt jetzt mit den neuen Schreib-Skills und nutzt sie bei jedem Text.

## Neu

- **Vier neue Schreib-Skills** ersetzen die alten: `stimmenprofil` (deine Schreibstimme aus eigenen Texten bestimmen), `natuerlich-schreiben` (neuer Text), `stilrevision` (vorhandenen Text überarbeiten) und `textpruefung` (Text prüfen und konkrete Schwächen beheben). Sie stammen aus dem Paket „Huminizer GER V2“ und sind unverändert übernommen.
- **Bei jedem Text Pflicht:** Die KI lädt zuerst `stimmenprofil`, dann `natuerlich-schreiben` oder `stilrevision` und prüft am Ende mit `textpruefung`. Das gilt für Lerntagebuch, Facharbeit, Exposé, Folien, E-Mails und auch für Entwürfe, die nur im Chat stehen.
- **Die App kontrolliert das:** Lädt die KI einen der Skills nicht, holt Mango das nach und lässt den Text überarbeiten. Bei Entwürfen im Chat ersetzt die neue Fassung die erste. Unter der Antwort steht „Schreib-Skills gelesen“, „nachgeholt“ oder „nicht vollständig geladen“.
- **Alte Skills verschwinden:** `wissenschaftlich-schreiben` und `sprachpruefung` werden beim Öffnen aus deinen Arbeitsräumen entfernt. Eigene Dateien fasst Mango nicht an.

## Geändert

- **Die automatische Sprachprüfung gibt Hinweise statt Befehle:** Floskeln, Stilwörter, Geviertstriche und lange Sätze sind nur Suchhilfen. Die KI prüft jede Stelle im Zusammenhang und ändert sie nur, wenn sie im Text schlechter ist. Chatbot-Reste und falsche Anführungszeichen werden weiter immer geändert.
- **Regeln der App:** Die Schulvorgaben (Sprachregeln, Kurzbeleg, Umfang), „kurz und einfach“ und der KI-Vermerk haben Vorrang vor den Skills. Der Vermerk steht weiter vor Texten, die die KI in deine Dateien schreibt.
- **Weiter wie bisher:** Die KI erfindet nichts, baut keine absichtlichen Fehler ein, schreibt nie „ohne KI entstanden“ und verspricht kein Ergebnis bei Erkennungsprogrammen.

## Download

- **Windows:** `Mango-Facharbeit-Setup-0.3.1-beta.exe` (Windows 10/11, 64 Bit)
- **Mac, Apple-Chip (M1 bis M4):** `Mango-Facharbeit-0.3.1-beta-Mac-arm64.dmg`
- **Mac, Intel:** `Mango-Facharbeit-0.3.1-beta-Mac-x64.dmg`
- Zu jeder Datei gehört eine `.sha256`-Datei mit der Prüfsumme.

## Voraussetzung

Mindestens ein KI-Zugang:

- **DeepSeek (Windows und Mac):** API-Schlüssel von [platform.deepseek.com](https://platform.deepseek.com/api_keys), Guthaben aufladen
- **Claude Code CLI (nur Windows)** ([Anleitung](https://code.claude.com/docs/en/setup)): in der PowerShell `irm https://claude.ai/install.ps1 | iex`, danach `claude auth login`
- **Antigravity CLI (agy) (nur Windows)** ([Anleitung](https://antigravity.google/docs/getting-started?tab=cli)): in der PowerShell `irm https://antigravity.google/cli/install.ps1 | iex`, danach einmal `agy` starten und anmelden

## Installieren

**Windows:** Setup herunterladen und doppelklicken. Es ersetzt die vorherige Beta, Projekte und Einstellungen bleiben erhalten. Bei der SmartScreen-Warnung: **Weitere Informationen → Trotzdem ausführen**.

**Mac:**
1. `.dmg` öffnen und **Mango Facharbeit** in den Ordner **Programme** ziehen.
2. Beim ersten Öffnen meldet macOS, dass die App nicht überprüft werden kann (sie ist nicht von Apple signiert). Öffne **Systemeinstellungen → Datenschutz & Sicherheit**, scrolle nach unten und klicke bei Mango Facharbeit auf **Trotzdem öffnen**.
3. Alternativ im Terminal: `xattr -dr com.apple.quarantine "/Applications/Mango Facharbeit.app"`, danach normal öffnen.

## Bekannte Einschränkungen der Beta

- Windows-Installer und Mac-App sind nicht signiert (Hinweise von SmartScreen bzw. Gatekeeper).
- Die Mac-Version habe ich nicht auf einem echten Mac ausprobiert, nur automatisch bauen und starten lassen. Meld dich, wenn etwas nicht klappt.
- DeepSeek wurde mit einer nachgebauten Gegenstelle getestet, nicht mit einem echten Schlüssel. Zeigt sich ein Problem, steht der Fehler unter der Antwort.
- Das Update per Knopf funktioniert nur unter Windows. Auf dem Mac zeigt der Knopf einen Link zur neuen Version.
- Die nachgezeichnete Folienansicht kommt dem Original sehr nahe, ist aber nicht identisch. Die Originalansicht über PowerPoint, Word oder LibreOffice gibt es auf dem Mac nur mit LibreOffice.
