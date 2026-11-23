OpenCode Go antwortet jetzt: Mango sendet die Sitzungskennung, die OpenCode verlangt.

## Behoben

- **OpenCode Go: „Request is missing x-opencode-session“:** OpenCode Go verlangt seit September 2026 bei jeder Anfrage eine stabile Sitzungskennung und lehnte Mangos Anfragen deshalb ab. Mango sendet sie jetzt mit. Sie ist gleich innerhalb einer Antwort und in allen Nachrichten eines Chats, in einem neuen Chat ist sie neu. DeepSeek ist nicht betroffen.

## Gut zu wissen

- Ich konnte das nicht mit der echten OpenCode-Schnittstelle prüfen, nur mit einer nachgebauten Gegenstelle, die die Kopfzeile wie OpenCode verlangt. Kommt trotzdem ein Fehler, steht er unter der Antwort. Schick ihn mir, dann kann ich nachsehen.
- Manche Modelle von OpenCode Go laufen nach Angaben aus mehreren Quellen nur über ein anderes Format und funktionieren in Mango nicht. Wähle dann ein anderes Modell aus der Liste.

## Download

- **Windows:** `Mango-Facharbeit-Setup-0.3.11-beta.exe` (Windows 10/11, 64 Bit)
- **Mac, Apple-Chip (M1 bis M4):** `Mango-Facharbeit-0.3.11-beta-Mac-arm64.dmg`
- **Mac, Intel:** `Mango-Facharbeit-0.3.11-beta-Mac-x64.dmg`
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
