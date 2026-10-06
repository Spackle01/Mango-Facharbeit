# Mango Facharbeit

Eine Agent-first-App, die Schülerinnen und Schüler der Fachoberschule durch ihre Facharbeit begleitet: von Mindmap und Themenfindung über Recherche und Schreiben bis zur Prüfung der vollständigen Abgabe. Der Chat steht im Mittelpunkt. Der Assistent kennt die Schulvorgaben, das eigene Projekt und den aktuellen Arbeitsstand – auch in neuen Chats.

Als KI-Anbieter lassen sich die **Claude Code CLI** und die **Antigravity CLI (`agy`)** wählen. Beide laufen lokal mit dem eigenen Konto; die App simuliert keine Antworten.

## Starten

### Windows-EXE (ohne Node.js)

Unter [Releases](https://github.com/Spackle01/Mango-Facharbeit/releases) liegt `Mango-Facharbeit-<version>-win-x64.exe`. Doppelklicken, fertig. Da die Alpha nicht signiert ist, meldet Windows SmartScreen beim ersten Start einen unbekannten Herausgeber („Weitere Informationen → Trotzdem ausführen“). Das Konsolenfenster muss offen bleiben; die App öffnet sich in einem eigenen Fenster. Beim ersten Start werden die Programmdateien nach `%LOCALAPPDATA%\Mango-Facharbeit\programm` entpackt.

Ein KI-Anbieter (siehe unten) wird weiterhin benötigt.

### Aus dem Quellcode

Voraussetzungen:

- [Node.js](https://nodejs.org) ab Version 18 (LTS). Weitere Pakete sind nicht nötig, `npm install` entfällt.
- Mindestens einer der beiden Anbieter, installiert und einmal angemeldet:
  - Claude Code: Windows `irm https://claude.ai/install.ps1 | iex`, macOS/Linux `curl -fsSL https://claude.ai/install.sh | bash`, danach `claude auth login`
  - Antigravity CLI: Windows `irm https://antigravity.google/cli/install.ps1 | iex`, macOS/Linux `curl -fsSL https://antigravity.google/cli/install.sh | bash`, danach einmal `agy` starten und mit dem Google-Konto anmelden

Start:

- **Windows:** Doppelklick auf `Mango starten.cmd`
- **macOS:** Doppelklick auf `mango-starten.command`
- **Alle Systeme:** `npm start` im Projektordner

Die App öffnet sich in einem eigenen Fenster (Edge/Chrome im App-Modus, sonst im Standardbrowser). Sie läuft nur lokal auf `127.0.0.1`. Das Terminalfenster muss offen bleiben.

Optionen: `--port 4317`, `--no-open`, `--data-dir <Ordner>`.

## Bedienung

- **Links:** Chats, „Neuer Chat“, Projektangaben und Einstellungen. Chats lassen sich umbenennen, als Markdown exportieren und löschen. Auf kleinen Bildschirmen wird die Seitenleiste eingeklappt.
- **Rechts:** der Chat. `Enter` sendet, `Umschalt + Enter` macht einen Zeilenumbruch. Während einer Antwort wird der Senden-Knopf zum Stopp-Knopf.
- **Anhänge:** Büroklammer (vom Computer oder aus dem Arbeitsraum), Drag-and-drop oder Einfügen. Vor dem Senden erscheinen sie als Chips mit Name, Typ und Entfernen-Knopf. Nicht lesbare Dateien werden markiert.
- **Oben rechts:** „Arbeitsstand“ (Aufgabenliste), „Arbeitsraum“ (Dateien, „Arbeitsraum öffnen“, Exporte) und „Projekt“ (Angaben, gemerkte Ergebnisse).
- **Anbieter:** unten im Eingabefeld. Punktfarbe: grün = angemeldet/verbunden, grau = wird geprüft bzw. noch nicht geprüft, gelb = Anmeldung oder Ordnerfreigabe nötig, rot = Fehler. Ist etwas einzurichten, steht der konkrete Befehl über dem Eingabefeld.
- **Darstellung:** Hell, Dunkel oder System (Einstellungen).

## Arbeitsraum

Jede Facharbeit hat einen eigenen Ordner (Vorschlag: `Dokumente/Facharbeit – <Titel>`). Ein vorhandener Ordner kann gewählt werden; vorhandene Dateien bleiben unverändert.

```
<Arbeitsraum>/
├── FACHARBEIT.md                  Übersicht: Angaben, Arbeitsstand, gemerkte Ergebnisse (von der App erzeugt)
├── 00_vorgaben/                   Schulvorgaben: anforderungen.md + Original-PDFs
├── 01_themenfindung_und_mindmap/  … bis 08_praesentation_verteidigung/ (Vorlagen)
├── anhaenge/JJJJ-MM-TT/           Dateien, die im Chat angehängt wurden
├── exporte/                       Word-Export der Gesamtarbeit
├── AGENTS.md, CLAUDE.md           kurze Hinweise für KI-Werkzeuge (nur angelegt, wenn nicht vorhanden)
├── .agents/rules/, .agents/skills/, .claude/skills/   Regeln und Skills für beide Anbieter
└── .facharbeit/                   projekt.json, arbeitsstand.json, chats/, versionen/, extrakte/, regeln.md
```

- **Versionen:** Ändert der Assistent eine vorhandene Datei, sichert die App die vorherige Fassung unter `.facharbeit/versionen/`. Im Chat steht „geändert“ mit Link zur alten Fassung; im Arbeitsraum gibt es „Frühere Fassungen“ und „Als Kopie wiederherstellen“. Der Assistent ist außerdem angewiesen, Überarbeitungen als `_v2`, `_v3` zu speichern.
- **Textauszüge:** Für Word, PowerPoint, Excel, OpenDocument und (falls `pdftotext` vorhanden) PDF erzeugt die App Textauszüge, damit beide Anbieter den Inhalt zuverlässig lesen.
- **Exporte:** Gesprächsverläufe für den Anhang (Markdown + Word) nach `07_ki_prompts_anhang/`, einzelne Markdown-Dateien als Word, die Gesamtarbeit als Word mit Schulformatierung (A4, Arial 11 pt, 1,5-zeilig, Ränder 2,5/2,0 cm, Titelblatt ohne Seitenzahl, Seitenzahl oben zentriert ab der Einleitung, Inhaltsverzeichnis als Word-Feld) und eine ZIP-Sicherung.

## Wie der Assistent Bescheid weiß

1. **Regeln** (`ressourcen/regeln.md`): Rolle, Ton, Schulvorgaben, KI-Regeln der Schule, Quellenregeln, Dateiregeln, Arbeitsstand-Protokoll. Claude erhält sie als Systemprompt-Ergänzung, Antigravity als Workspace-Regel (`.agents/rules/`).
2. **Projektkontext** vor jeder Nachricht: Projektangaben, Fristen, kompletter Arbeitsstand, gemerkte Ergebnisse, zuletzt geänderte Dateien. Unveränderter Kontext wird nicht erneut gesendet. Ein neuer Chat oder ein Anbieterwechsel bekommt den vollständigen Kontext (beim Wechsel zusätzlich den bisherigen Chatverlauf).
3. **Wissensbasis** `00_vorgaben/anforderungen.md`: alle Vorgaben aus Handreichung, Zeitschiene, KI-Leitfaden, Aufgaben zu Exposé und Mindmap, Lerntagebuch-Vorlage und Bewertungsbögen – mit Quelle und Kennzeichnung **[V] verbindlich / [E] Empfehlung / [B] Beispiel** sowie einer Liste von Widersprüchen, bei denen der Assistent nachfragt.
4. **Skills** (`ressourcen/skills/`, Herkunft in `ressourcen/skills/HERKUNFT.md`): `wissenschaftlich-schreiben`, `sprachpruefung` (mit `ai_tell_scan.py`), `quellenrecherche`, `abgabe-pruefen`.

## Arbeitsstand

Die Aufgabenliste (27 Aufgaben in 5 Phasen) ist aus den Schulvorgaben abgeleitet; jede Aufgabe nennt ihre Quelle und Frist. Es gibt genau drei Status, immer mit Symbol und Bezeichnung:

| Symbol | Status | Bedeutung |
|---|---|---|
| × | Offen | Noch nicht begonnen |
| ? | In Arbeit | Begonnen, aber noch nicht abgeschlossen oder geprüft |
| ✓ | Erledigt | Fertiggestellt und anhand der Vorgaben geprüft |

Der Assistent meldet Änderungen in einem unsichtbaren Block am Ende seiner Antwort. Die App prüft ihn:

- „Erledigt“ nur mit Nachweis; verweist der Nachweis auf eine Datei, muss sie existieren. Sonst wird „In Arbeit“ übernommen.
- Aufgaben außerhalb der App (Themenabgabe, Konsultationen, Unterschrift, Abgabe) setzt nur die Person selbst; der Assistent kann sie nur vorschlagen (Knopf „Als erledigt markieren“ im Chat).
- Der Status lässt sich jederzeit im Panel „Arbeitsstand“ ändern.

## Datenschutz und Sicherheit

- Alle Daten liegen lokal: Projektdaten im Arbeitsraum, App-Einstellungen unter `%APPDATA%\Mango-Facharbeit` (Windows), `~/Library/Application Support/Mango-Facharbeit` (macOS) bzw. `~/.config/mango-facharbeit` (Linux).
- Der Server lauscht nur auf `127.0.0.1`, prüft Host und Ursprung jeder Anfrage und verlangt ein Sitzungstoken.
- Dateizugriffe sind auf den Arbeitsraum beschränkt. Die App gibt dem Claude-Anbieter Datei-, Such- und Webwerkzeuge frei (`Read, Write, Edit, MultiEdit, Glob, Grep, WebSearch, WebFetch, TodoWrite, Skill`) im Modus `acceptEdits`, aber keine allgemeine Freigabe für Befehle. Antigravity läuft mit seinen Standardrechten im Headless-Modus (Lesen und Schreiben im Arbeitsraum, Befehle nur nach eigener Freigabe).

## Entwicklung

```
build/       EXE-Build (Node Single Executable Application), Symbol, Release-Notizen
server/      Node-Server ohne Abhängigkeiten (HTTP-API, Speicher, Anbieter, Kontext, Exporte)
public/      Oberfläche (HTML, CSS, JavaScript-Module, Schrift Inter)
ressourcen/  Regeln, Wissensbasis, Schulvorgaben, Vorlagen für den Arbeitsraum, Skills
test/        Unit- und API-Tests; test/fixtures/bin enthält Test-Doubles beider CLIs
```

Windows-EXE bauen: `npm run build:exe` (lädt das offizielle `node.exe` derselben Node-Version von nodejs.org, prüft dessen SHA-256, setzt Symbol und Versionsinfo mit `resedit` und fügt die App mit `postject` ein; Ergebnis in `dist/`). Mit `--target current` entsteht ein Programm für das aktuelle System zum Testen. Der Workflow `.github/workflows/release.yml` läuft bei jedem Push: Tests, Build, Starttest der EXE auf einem Windows-Runner. Gibt es für die Version aus `package.json` noch kein Release, legt er Tag `v<version>` und Release an (Versionen mit Bindestrich, z. B. `0.1.0-alpha`, als Vorabversion). Für ein neues Release also die Version erhöhen.

Tests: `npm test`. Die API-Tests laufen gegen Test-Doubles der beiden CLIs, damit sie ohne Konto und Netz reproduzierbar sind. Das Ereignisformat des Antigravity-Doubles folgt der [Headless-Dokumentation](https://antigravity.google/docs/cli/headless/).

Die Originalmaterialien liegen unverändert in `Facharbeit angaben und vorlagen etc/`. Personenbezogene Angaben daraus (Namen, Klassen, Lehrkräfte, Thema der begonnenen Arbeit) werden nicht als Standardwerte verwendet. Eine begonnene Facharbeit lässt sich weiterführen, indem man beim Einrichten ihren Ordner als Arbeitsraum wählt oder die Dateien im Chat anhängt.
