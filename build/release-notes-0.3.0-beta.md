Mango gibt es jetzt auch für den Mac, und es läuft mit einem DeepSeek-API-Schlüssel.

## Neu

- **DeepSeek mit eigenem API-Schlüssel:** Ein dritter KI-Anbieter neben Claude Code und Antigravity. Du erstellst bei DeepSeek (platform.deepseek.com/api_keys) einen Schlüssel und fügst ihn in Mango ein, im Hinweis über dem Eingabefeld oder unter Einstellungen → KI-Anbieter. Mango prüft ihn und merkt ihn sich verschlüsselt auf deinem Computer. Es wird nichts installiert. DeepSeek rechnet nach Verbrauch ab, dafür brauchst du dort Guthaben.
- **Das neueste DeepSeek-Modell:** Voreingestellt ist DeepSeek V4.1 Flash. Zusätzlich gibt es DeepSeek V4 Pro. Bei der Gründlichkeit „Gründlich“ denkt das Modell länger nach.
- **Alles wie bei den anderen Anbietern:** DeepSeek liest und schreibt in deinen Dateien, nutzt die Schreib-Skills, trägt in Word ein, erstellt PDF und PowerPoint und räumt auf. Es kann zusätzlich Webseiten abrufen, aber nicht im Web suchen.
- **Mac-Version:** Mango gibt es als Image (.dmg) für Macs mit Apple-Chip (M1 bis M4) und für Intel-Macs. Auf dem Mac läuft Mango nur mit DeepSeek.

## Download

- **Windows:** `Mango-Facharbeit-Setup-0.3.0-beta.exe` (Windows 10/11, 64 Bit)
- **Mac, Apple-Chip (M1 bis M4):** `Mango-Facharbeit-0.3.0-beta-Mac-arm64.dmg`
- **Mac, Intel:** `Mango-Facharbeit-0.3.0-beta-Mac-x64.dmg`
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
