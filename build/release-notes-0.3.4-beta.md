Die KI bekommt „Schreib immer wie ein Mensch“ als oberste Regel, bei jeder Nachricht.

## Behoben

- **Die Anweisung steht ganz oben:** Die allererste Regel im System-Prompt lautet jetzt: Jeden Text so schreiben, dass er klingt, als hätte ihn die Person selbst geschrieben. Direkt danach folgt der Wortlaut der vier Schreib-Skills, erst danach alles andere, auch die Rolle der KI. Am Ende der Regeln steht dieselbe Erinnerung noch einmal.
- **Bei jeder Nachricht:** Bisher schickte Mango die Erinnerung an die Schreib-Skills nur, wenn deine Nachricht bestimmte Wörter enthielt (schreiben, Lerntagebuch, Exposé …). Bei Antworten wie „im Chat“ fehlte sie. Jetzt steht sie bei jeder Nachricht dabei, bei allen drei KI-Anbietern.
- **Weniger Gerede:** Die KI soll keine Schritte mehr ankündigen („Ich lese kurz deine Texte …“) und nicht ungefragt über Erkennungsprogramme sprechen.

## Gut zu wissen

- Ein Ergebnis bei Erkennungsprogrammen wie GPTZero kann Mango nicht versprechen. Auch ein Text, der gut klingt, kann dort als KI gelten. Am meisten bringen eigene Texte von dir: Wirf ein paar frühere Einträge oder einen Aufsatz in den Chat, dann schreibt die KI in deinem Ton. Kleine, schnelle Modelle halten sich weniger genau an lange Regeln: Für Texte lohnt sich ein größeres Modell, zum Beispiel DeepSeek V4 Pro oder Claude. Der KI-Vermerk der Schule bleibt in deinen Dateien.

## Download

- **Windows:** `Mango-Facharbeit-Setup-0.3.4-beta.exe` (Windows 10/11, 64 Bit)
- **Mac, Apple-Chip (M1 bis M4):** `Mango-Facharbeit-0.3.4-beta-Mac-arm64.dmg`
- **Mac, Intel:** `Mango-Facharbeit-0.3.4-beta-Mac-x64.dmg`
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
