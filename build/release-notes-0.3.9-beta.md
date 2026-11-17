Mango prüft die überarbeitete Fassung noch einmal, und unter der Antwort steht, was der Scan ergeben hat.

## Neu

- **Erneuter Scan nach der Überarbeitung:** Bisher scannte Mango einen Text einmal und ließ ihn einmal überarbeiten, ohne zu kontrollieren, ob er danach besser war. Jetzt scannt Mango die neue Fassung noch einmal. Bleibt sie auffällig, überarbeitet die KI ein zweites Mal. Mehr als zwei Durchläufe gibt es nicht. Das gilt für Texte in Dateien, für Word-Einträge und für Entwürfe im Chat.
- **Sichtbar unter der Antwort:** „Scan: unauffällig“, „Scan: n Stellen gefunden, Text überarbeitet“ oder „Scan: n Stellen noch auffällig“. So siehst du, dass der Scan gelaufen ist und wie es ausgegangen ist. In den Arbeitsschritten steht, ob ein zweiter Durchlauf nötig war.

## Gut zu wissen

- Der Scan prüft Muster und Rhythmus. Er sagt nichts darüber, was GPTZero, Turnitin oder Originality ausgeben. Steht „noch auffällig“ da, lohnt ein Blick in den Text oder eine Bitte an die KI, ihn weiter umzubauen.
- Ob die KI die Skills inhaltlich befolgt, kann Mango nicht messen. Die Skills stehen im Prompt, und der Scan prüft das Ergebnis.
- Das ist mit echtem Claude und DeepSeek noch nicht im Alltag erprobt, nur mit nachgebauten Gegenstellen. Zeigt sich ein Problem, steht der Fehler unter der Antwort.

## Download

- **Windows:** `Mango-Facharbeit-Setup-0.3.9-beta.exe` (Windows 10/11, 64 Bit)
- **Mac, Apple-Chip (M1 bis M4):** `Mango-Facharbeit-0.3.9-beta-Mac-arm64.dmg`
- **Mac, Intel:** `Mango-Facharbeit-0.3.9-beta-Mac-x64.dmg`
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
