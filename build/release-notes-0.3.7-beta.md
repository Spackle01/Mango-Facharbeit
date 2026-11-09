Die KI lehnt weniger ab, und „Datei ist gerade geöffnet“ erscheint nicht mehr fälschlich.

## Behoben

- **Die KI führt aus, was du verlangst:** Es ist deine Facharbeit, nicht die der KI. Du entscheidest, was hineinkommt, und du trägst die Verantwortung dafür. Das steht jetzt ganz oben in den Regeln der KI und wird bei jeder Nachricht mitgeschickt. Die KI soll ganze Kapitel schreiben, wenn du sie darum bittest, und nicht mehr auf eine Gliederung ausweichen. Sie hält keine Vorträge über Eigenleistung oder Schulregeln, fragt nicht „willst du das wirklich?“ und verweigert keinen Text, nur weil eine Angabe fehlt: Sie schreibt dann mit einer Lücke wie „[Zahl ergänzen]“ weiter.
- **Zwei Dinge bleiben, weil sie dir schaden würden:** Die KI erfindet keine Quellen, Zitate, Zahlen oder Studien, und sie schreibt nie, dass keine KI genutzt wurde. Sie sagt das in einem Satz und bietet an, was stattdessen geht. Der KI-Vermerk der Schule bleibt in deinen Dateien. Du kannst ihn in Word löschen, die Entscheidung liegt bei dir.
- **Lerntagebuch: „Die Datei ist gerade geöffnet“ bei jedem Eintragen:** Das erschien auch dann, wenn die Datei nirgends offen war. Ursache: Beim Einsortieren eigener Dateien nahm die Kopie den Schreibschutz des Originals mit, und Windows lässt eine schreibgeschützte Datei nicht überschreiben. Jetzt bleiben Arbeitskopien beschreibbar, und Mango gibt schon vorhandene beim Öffnen des Arbeitsordners frei. Dein jetziges Lerntagebuch sollte sich danach wieder eintragen lassen.
- **Ehrlichere Meldung:** „Gerade geöffnet“ erscheint nur noch, wenn Word die Datei wirklich festhält. Sonst steht ein Hinweis mit Fehlercode da. Bei kurzen Sperren durch Virenscanner oder OneDrive versucht Mango es selbst noch einmal.

## Gut zu wissen

- Ein Ergebnis bei Erkennungsprogrammen kann Mango nicht versprechen. Die Windows-Korrektur konnte ich nur auf Linux nachstellen. Erscheint die Meldung weiter, steht der Fehlercode in Klammern dabei, und ob neben der Datei eine Datei mit `~$` am Anfang liegt, zeigt, ob Word sie wirklich festhält.

## Download

- **Windows:** `Mango-Facharbeit-Setup-0.3.7-beta.exe` (Windows 10/11, 64 Bit)
- **Mac, Apple-Chip (M1 bis M4):** `Mango-Facharbeit-0.3.7-beta-Mac-arm64.dmg`
- **Mac, Intel:** `Mango-Facharbeit-0.3.7-beta-Mac-x64.dmg`
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
