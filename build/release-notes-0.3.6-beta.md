DeepSeek schreibt bestellte Texte nicht mehr in lauter kurzen Sätzen, und Mango kontrolliert seine Schreibwerkzeuge.

## Behoben

- **Kurze Sätze nur im Gespräch:** Die Regel „höchstens drei kurze Sätze, jeder Satz höchstens 15 Wörter, einfache Wörter“ war für Antworten im Gespräch gedacht. Mango schickte sie aber bei jeder Nachricht mit, und kleine Modelle wie DeepSeek Flash wendeten sie auch auf Texte an, die du bestellt hast. Das ergab lauter gleich kurze Sätze. Jetzt gilt die Regel ausdrücklich nur für das Gespräch. Für Entwürfe, Absätze, Mails und Lerntagebuch-Einträge, auch wenn sie im Chat stehen, richten sich Länge und Satzbau nach deinem Auftrag und deiner Stimme.
- **Schreibwerkzeuge werden kontrolliert:** Bei Claude prüfte Mango schon, ob die Schreib-Skills genutzt wurden. Bei DeepSeek galt alles pauschal als gelesen, und das Modell konnte seine Werkzeuge einfach überspringen. Jetzt zählt Mango die Aufrufe (Stimmenprofil, Umschreib-Anleitung, Prüfung) und holt fehlende nach, auch bei Entwürfen im Chat.
- **Klare Beschriftungen:** Die Schreibwerkzeuge hießen im Chat „Schreibt eine Datei“ oder „Nutzt humanize_scan“. Jetzt steht dort zum Beispiel „Liest dein Stimmenprofil“, „Holt die Umschreib-Anleitung“ und „Prüft den Text auf Schablonen“. So siehst du, ob sie genutzt wurden. Unter der Antwort steht „Schreibwerkzeuge genutzt“ oder „nachgeholt“.

## Gut zu wissen

- Ein Ergebnis bei Erkennungsprogrammen wie GPTZero kann Mango nicht versprechen. Sie bewerten Stil, nicht Herkunft, und schwanken von Lauf zu Lauf. Diese Änderungen beheben Qualitätsfehler, mehr nicht. Der KI-Vermerk der Schule bleibt in deinen Dateien.
- Kleine Modelle halten sich schlechter an Regeln. Wenn DeepSeek weiter schwächelt: Stelle in den Einstellungen die Gründlichkeit auf „Gründlich“, oder nimm DeepSeek V4 Pro oder Claude.
- Das ist mit echtem DeepSeek noch nicht im Alltag erprobt. Zeigt sich ein Problem, steht der Fehler unter der Antwort.

## Download

- **Windows:** `Mango-Facharbeit-Setup-0.3.6-beta.exe` (Windows 10/11, 64 Bit)
- **Mac, Apple-Chip (M1 bis M4):** `Mango-Facharbeit-0.3.6-beta-Mac-arm64.dmg`
- **Mac, Intel:** `Mango-Facharbeit-0.3.6-beta-Mac-x64.dmg`
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
