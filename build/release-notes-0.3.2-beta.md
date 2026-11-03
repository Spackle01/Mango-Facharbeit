Mango hat eine neue Optik und eine Suche für deine Chats.

## Neu

- **Neue Oberfläche:** Ruhige Grautöne mit grünem Akzent, in Hell und Dunkel. Das Eingabefeld ist stärker abgerundet und hat einen runden Senden-Knopf. Antworten zeigen das Mango-Logo und den Namen, im leeren Chat steht das Logo über der Begrüßung. Als Vorbild diente [LibreChat](https://github.com/LibreChat-AI/librechat) (MIT-Lizenz), übernommen sind nur Stil und Aufbau.
- **Chats nach Datum:** Die Liste links ist gruppiert in Heute, Gestern, Letzte 7 Tage, Letzte 30 Tage und Älter.
- **Chats suchen:** Über der Liste steht ein Suchfeld. Mit Strg+K springst du hinein, mit Esc leerst du es.

## Behoben

- **Handy-Ansicht:** Im leeren Chat war die Begrüßung nach unten gescrollt und oben abgeschnitten. Sie steht jetzt oben.

## Gleich geblieben

- Alles andere funktioniert wie bisher: Chats, Word-Dateien, Schreib-Skills, Vorschau, Update-Knopf. Deine Projekte und Einstellungen bleiben erhalten.

## Download

- **Windows:** `Mango-Facharbeit-Setup-0.3.2-beta.exe` (Windows 10/11, 64 Bit)
- **Mac, Apple-Chip (M1 bis M4):** `Mango-Facharbeit-0.3.2-beta-Mac-arm64.dmg`
- **Mac, Intel:** `Mango-Facharbeit-0.3.2-beta-Mac-x64.dmg`
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
