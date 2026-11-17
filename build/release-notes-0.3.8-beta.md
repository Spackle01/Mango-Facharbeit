Neue Schreib-Skills für alle KI-Anbieter, und Mango prüft jeden Text mit einem Scan auf typische KI-Merkmale.

## Neu

- **Drei neue Schreib-Skills:** `human-voice` (neuer Text), `humanize-rewrite` (vorhandenen Text umbauen statt Wörter tauschen) und `ai-tell-audit` (prüfen). Sie ersetzen die bisherigen Skills komplett, auch die alten Anweisungen dazu sind entfernt. Der Wortlaut steht bei Claude, Antigravity und DeepSeek ganz vorn in den Regeln, die KI liest ihn also vor allem anderen. In bestehenden Arbeitsordnern räumt Mango die alten Skills beim Öffnen weg, eigene Dateien bleiben.
- **Scan nach jedem Text:** Das Skript `ai_tell_scan.py` des Prüf-Skills gibt es jetzt in der App (ohne Python). Mango lässt jeden Text, den die KI in eine Datei schreibt oder im Chat entwirft, durch den Scan laufen: Floskeln, „nicht nur …, sondern auch“, gehäufte Stilwörter, Dreierreihen, Chatbot-Reste, Geviertstriche, gleichförmige Satzlängen und Absätze. Bei auffälligen Texten geht die Fundliste einmal an die KI zurück, die den Text überarbeitet. Direkte Zitate, Überschriften und der KI-Vermerk zählen nicht.
- **DeepSeek:** bekommt dieselben Skills und ruft den Scan als Werkzeug `ai_tell_scan` auf. Mango zählt den Aufruf und holt ihn nach, wenn er fehlt. Die sechs bisherigen Stimmenprofil-Werkzeuge und die eigene DeepSeek-Anleitung entfallen.

## Gut zu wissen

- Der Scan ist eine Heuristik: Er zeigt Stellen zum Prüfen und rechnet keinen „KI-Wert“ aus. Was GPTZero, Turnitin oder Originality ausgeben, kann Mango nicht versprechen, das sagt auch der Skill selbst.
- Das Stimmenprofil entsteht bei DeepSeek jetzt wie bei Claude: Die KI nimmt deine eigenen Texte aus dem Arbeitsordner als Vorbild. Das alte gespeicherte Profil (`.facharbeit/stimme.json`) wird nicht mehr benutzt und kann liegen bleiben.
- Das ist mit echtem DeepSeek und Claude noch nicht im Alltag erprobt, nur mit nachgebauten Gegenstellen. Zeigt sich ein Problem, steht der Fehler unter der Antwort.

## Download

- **Windows:** `Mango-Facharbeit-Setup-0.3.8-beta.exe` (Windows 10/11, 64 Bit)
- **Mac, Apple-Chip (M1 bis M4):** `Mango-Facharbeit-0.3.8-beta-Mac-arm64.dmg`
- **Mac, Intel:** `Mango-Facharbeit-0.3.8-beta-Mac-x64.dmg`
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
