DeepSeek bekommt eigene Schreib-Regeln und Schreibwerkzeuge.

## Neu

- **Eigene Anleitung für DeepSeek:** Claude hält sich an den langen Wortlaut der Schreib-Skills, DeepSeek nicht. Deshalb bekommt DeepSeek jetzt eine kurze eigene Anleitung ganz vorn in seinen Regeln. Der Ablauf bei jedem Text: Stimme klären, Entwurf schreiben, Umschreib-Anleitung holen und umsetzen, prüfen. Claude und Antigravity bleiben unverändert.
- **Sechs Schreibwerkzeuge für DeepSeek:** `voice_profile` und `voice_import` lernen deine Schreibweise aus deinen eigenen Texten. `humanize_scan` zeigt Stellen, die nach Schablone klingen (Floskeln, Stilwörter, gleichförmiger Rhythmus). `humanize_rewrite` und `voice_rewrite` geben eine Umschreib-Anleitung, nach der DeepSeek den Text selbst überarbeitet. `voice_score` misst, wie nah ein Text an deiner Schreibweise liegt.
- **Dein Stimmenprofil:** Es entsteht nur aus deinen eigenen Texten und liegt in deinem Arbeitsordner. Schuldokumente, interne Dateien und KI-Vermerke zählen nicht als Probe. Gib der KI ein paar frühere Einträge oder einen Aufsatz, dann schreibt sie näher an deinem Ton.
- Das Prinzip („nicht wie irgendein Mensch, sondern wie ich“) stammt aus [dsh-humanizer](https://github.com/lynote-ai/dsh-humanizer) (BSD-3-Clause), neu geschrieben für deutsche Texte.

## Gut zu wissen

- Die Werkzeuge rechnen nur, sie rufen kein Modell auf. Es gibt keinen KI-Prozentwert: Der Scan zeigt Stellen, der Wert misst Nähe zu deiner Schreibweise, nicht das Urteil eines Erkennungsprogramms. Ein Ergebnis dort kann Mango nicht versprechen. Der KI-Vermerk der Schule bleibt in deinen Dateien.
- Das ist neu und mit DeepSeek noch nicht im Alltag erprobt. Zeigt sich ein Problem, steht der Fehler unter der Antwort. Für Texte lohnt sich weiter ein größeres Modell (DeepSeek V4 Pro oder Claude).

## Download

- **Windows:** `Mango-Facharbeit-Setup-0.3.5-beta.exe` (Windows 10/11, 64 Bit)
- **Mac, Apple-Chip (M1 bis M4):** `Mango-Facharbeit-0.3.5-beta-Mac-arm64.dmg`
- **Mac, Intel:** `Mango-Facharbeit-0.3.5-beta-Mac-x64.dmg`
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
