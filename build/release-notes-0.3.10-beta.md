Neuer KI-Zugang OpenCode Go, und du kannst den KI-Scan selbst ein- und ausschalten.

## Neu

- **OpenCode Go als vierter KI-Anbieter:** Mit einem Abo bei OpenCode Go und deinem API-Schlüssel nutzt Mango dessen Modelle, ohne dass etwas installiert wird. Den Schlüssel verbindest du wie bei DeepSeek, in den Einstellungen oder im Hinweis im Chat. Die Modellliste holt Mango beim Anbieter selbst; ohne eigene Wahl gilt das erste Modell der Liste, im Eingabefeld und in den Einstellungen kannst du ein anderes wählen. Es gelten dieselben Schreib-Skills und derselbe Scan wie bei DeepSeek. Auf dem Mac gibt es jetzt DeepSeek und OpenCode Go.
- **Knopf „Scan: an/aus“:** Im Eingabefeld, neben dem Anbieter, schaltest du den KI-Scan ein und aus. Dasselbe geht unter Einstellungen → KI-Scan. Aus bedeutet: Mango prüft die Texte der nächsten Nachricht nicht und lässt nichts überarbeiten, und die KI prüft sie auch nicht selbst. Sie schreibt trotzdem nach den Schreib-Skills. Unter der Antwort steht „Scan: aus“. Standard ist an, und die Wahl gilt ab der nächsten Nachricht.

## Gut zu wissen

- OpenCode Go habe ich nur mit einer nachgebauten Gegenstelle getestet, nicht mit der echten Schnittstelle. Nach Angaben aus mehreren Quellen laufen manche Modelle dort nur über ein anderes Format und funktionieren in Mango nicht. Antwortet ein Modell mit einem Fehler, wähle ein anderes aus der Liste. Ein falscher Schlüssel fällt eventuell erst bei der ersten Nachricht auf.
- Der Scan prüft Muster und Rhythmus und sagt nichts darüber, was GPTZero, Turnitin oder Originality ausgeben.
- Zeigt sich ein Problem, steht der Fehler unter der Antwort.

## Download

- **Windows:** `Mango-Facharbeit-Setup-0.3.10-beta.exe` (Windows 10/11, 64 Bit)
- **Mac, Apple-Chip (M1 bis M4):** `Mango-Facharbeit-0.3.10-beta-Mac-arm64.dmg`
- **Mac, Intel:** `Mango-Facharbeit-0.3.10-beta-Mac-x64.dmg`
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
