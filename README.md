# Mango Facharbeit

Eine Agent-first-App, die Schülerinnen und Schüler der Fachoberschule durch ihre Facharbeit begleitet: von Mindmap und Themenfindung über Recherche und Schreiben bis zur Prüfung der vollständigen Abgabe. Der Chat steht im Mittelpunkt. Der Assistent kennt die Schulvorgaben, das eigene Projekt und den aktuellen Arbeitsstand – auch in neuen Chats.

Als KI-Anbieter lassen sich die **Claude Code CLI** und die **Antigravity CLI (`agy`)** wählen. Beide laufen lokal mit dem eigenen Konto; die App simuliert keine Antworten.

**Webseite mit Download:** https://spackle01.github.io/Mango-Facharbeit/ (Quelle: Ordner `docs/`, in den Repository-Einstellungen unter „Pages“ aktivieren: Deploy from a branch, Ordner `/docs`).

## Starten

### Windows (Installer)

Unter [Releases](https://github.com/Spackle01/Mango-Facharbeit/releases) liegt `Mango-Facharbeit-Setup-<version>.exe`. Doppelklicken: Die App installiert sich in wenigen Sekunden für den aktuellen Benutzer (ohne Administratorrechte), legt Verknüpfungen im Startmenü und auf dem Desktop an und startet. Da die Alpha nicht signiert ist, meldet Windows SmartScreen einen unbekannten Herausgeber („Weitere Informationen → Trotzdem ausführen“). Deinstallieren über die Windows-Einstellungen; Projekte und Einstellungen bleiben dabei erhalten.

Die App läuft als eigenes Fenster ohne Titelleiste und ohne Konsolenfenster. Minimieren, Maximieren und Schließen sitzen oben rechts in den Farben der App. Ein KI-Anbieter (siehe unten) wird weiterhin benötigt.

### Aus dem Quellcode

Voraussetzungen:

- [Node.js](https://nodejs.org) ab Version 18 (LTS). Weitere Pakete sind nicht nötig, `npm install` entfällt.
- Mindestens einer der beiden Anbieter, installiert und einmal angemeldet:
  - Claude Code ([Anleitung](https://code.claude.com/docs/en/setup)): Windows `irm https://claude.ai/install.ps1 | iex`, macOS/Linux `curl -fsSL https://claude.ai/install.sh | bash`, danach `claude auth login`
  - Antigravity CLI ([Anleitung](https://antigravity.google/docs/getting-started?tab=cli)): Windows `irm https://antigravity.google/cli/install.ps1 | iex`, macOS/Linux `curl -fsSL https://antigravity.google/cli/install.sh | bash`, danach einmal `agy` starten und mit dem Google-Konto anmelden
  - Ist keiner installiert, zeigt die App beide Wege mit Anleitung und Befehl zum Kopieren. Nach der Installation genügt „Erneut prüfen“.

Start:

- **Windows:** Doppelklick auf `Mango starten.cmd`
- **macOS:** Doppelklick auf `mango-starten.command`
- **Alle Systeme:** `npm start` im Projektordner

Die App öffnet sich in einem eigenen Fenster (Edge/Chrome im App-Modus, sonst im Standardbrowser). Sie läuft nur lokal auf `127.0.0.1`. Das Terminalfenster muss offen bleiben. Als Desktop-App wie im Installer: `npm install` und danach `npm run desktop`.

Optionen: `--port 4317`, `--no-open`, `--data-dir <Ordner>`.

## Bedienung

- **Links:** Chats, „Neuer Chat“, Projektangaben und Einstellungen. Chats lassen sich umbenennen, als Markdown exportieren und löschen. Auf kleinen Bildschirmen wird die Seitenleiste eingeklappt.
- **Rechts:** der Chat. `Enter` sendet, `Umschalt + Enter` macht einen Zeilenumbruch. Während einer Antwort wird der Senden-Knopf zum Stopp-Knopf.
- **Drop-in:** Dateien oder Ordner irgendwo ins Fenster ziehen. Mango sortiert sie in die Facharbeit ein (siehe unten). Dasselbe geht über „Dateien einsortieren“ links und über die Karte auf der Startseite.
- **Anhänge:** Auf das Eingabefeld gezogen oder über die Büroklammer, hängt eine Datei nur an die nächste Nachricht an. Vor dem Senden erscheinen sie als Chips mit Name, Typ und Entfernen-Knopf. Nicht lesbare Dateien werden markiert.
- **Oben rechts:** „Arbeitsstand“ (Aufgabenliste), „Dateien“ (Arbeitsraum, „Arbeitsraum öffnen“, Exporte) und „Projekt“ (Angaben, gemerkte Ergebnisse, Zusammenfassung).
- **Modell:** ebenfalls über den Anbieter-Knopf im Eingabefeld oder in den Einstellungen, getrennt je Anbieter.
  - **Claude Code:** Sonnet (Voreinstellung, sparsam und stark), Fable, Opus und Haiku (immer die neueste Version), „Standard“ (Voreinstellung der CLI), feste Versionen wie Opus 5.5 oder Sonnet 4.6 oder eine eigene Modell-ID.
  - **Antigravity:** Die Liste kommt aus `agy models`; eine eigene Modell-ID ist ebenfalls möglich.
  - Die Auswahl gilt ab der nächsten Nachricht, auch in laufenden Chats, und wird als `--model` an die CLI übergeben. Unter jeder Antwort steht, welches Modell geantwortet hat.
  - Ist ein Modell für das Konto nicht verfügbar, erscheint ein Hinweis mit „Modell wählen“.
- **Gründlichkeit:** Sparsam, Ausgewogen (Voreinstellung) oder Gründlich – im Modell-Dialog und in den Einstellungen. Wird als `--effort low|medium|high` an beide CLIs übergeben und bestimmt, wie lange der Assistent nachdenkt und wie viel er verbraucht. Trägt ein Antigravity-Modell die Denkstufe schon im Namen (z. B. `gemini-3.1-pro-high`), gilt diese Stufe und `--effort` entfällt.
- **Automatische Wahl:** Beim Start sucht die App beide Anbieter. Ist Claude Code bereit, nutzt sie Claude Code mit der neuesten Sonnet-Version. Ist nur Antigravity installiert, wechselt sie zu Antigravity und nimmt das beste Gemini-Modell aus `agy models` (Pro vor Flash, neueste Version, höchste Denkstufe). Selbst gewählte Anbieter und Modelle bleiben erhalten, solange der gewählte Anbieter installiert ist. Lehnt die CLI ein automatisch gewähltes Modell ab, wiederholt die App die Anfrage einmal mit der Voreinstellung der CLI (ohne `--model` und `--effort`) und bleibt danach bei der Voreinstellung. Nachrichten, die während der Anbieterprüfung gesendet werden, warten deren Ergebnis ab.
- **Anbieter:** unten im Eingabefeld. Punktfarbe: grün = angemeldet/verbunden, grau = wird geprüft bzw. noch nicht geprüft, gelb = Anmeldung oder Ordnerfreigabe nötig, rot = Fehler. Ist etwas einzurichten, steht der konkrete Befehl über dem Eingabefeld.
- **Darstellung:** Hell, Dunkel oder System (Einstellungen).

## Drop-in: alles reinziehen, Mango sortiert ein

Was schon für die Facharbeit entstanden ist (Entwürfe, Notizen, Quellen, Bilder, ganze Ordner), zieht man einfach ins Fenster. Beim ersten Start gibt es dafür „Ich habe schon angefangen“ (mit denselben Angaben wie beim Neuanfang: Name, Klasse, Titel, Fach, Lehrkraft, Abgabedatum; leere Felder ergänzt Mango aus den Dateien), später die Startseiten-Karte, „Dateien einsortieren“ links oder einfach Ziehen.

- **Ablauf:** Hochladen und Prüfen mit Fortschrittsanzeige unten rechts, danach sortiert der Assistent in einem eigenen Chat ein. Grenzen: 2000 Dateien, 200 MB je Datei, 1 GB insgesamt. Systemdateien (`.DS_Store`, `Thumbs.db`, `~$…`) werden übersprungen.
- **Originale bleiben unverändert:** Die App legt alles mit Ordnerstruktur und Änderungsdatum schreibgeschützt in `uebernommen/<Datum_Uhrzeit>/` ab. Ändert der Assistent dort trotzdem etwas, stellt die App die Datei wieder her („zurückgesetzt“).
- **Prüfung durch die App:** Textauszüge, Lesbarkeit, Umfang, vermutliche Art mit Ordnervorschlag, identische Dateien, mögliche Entwurfsstände und schon vorhandene Schulvorgaben (`.facharbeit/import/<id>/inventar.md`). Dateien, die nicht ankamen, stehen als „nicht übernommen“ in der Übersicht.
- **Einsortieren:** Der Assistent (Skill `bestehende-arbeit-uebernehmen`) entscheidet nur, wohin jede Datei gehört, und gibt das als Block `einsortieren` zurück. Die App kopiert dann bzw. wandelt Word und Text wortgetreu in Markdown um (Überschriften, Listen, Tabellen, Fett/Kursiv). Ziele sind nur die Ordner `01_` bis `08_` und `abgabe/` (ein eigenes, schon ausgefülltes Lerntagebuch oder eine eigene Facharbeit ersetzt dort die leere Datei und bleibt Word). Vorhandenes wird nie ungesichert überschrieben: neue Fassung `_v2`, bei „ersetzen“ mit Sicherung der alten. Das spart Verbrauch und verhindert, dass Texte der Person umformuliert werden.
- **Aktualisieren:** Vorhandene Arbeitsdateien ergänzt der Assistent gezielt (z. B. Quellen in der Literaturliste). Erkennbare Projektangaben kommen in leere Felder; Abweichungen zeigt der Chat mit „Übernehmen“. Der Arbeitsstand wird aktualisiert, „Erledigt“ nur nach Prüfung mit der einsortierten Datei als Nachweis.
- **Übersicht im Chat:** „Einsortiert“ (Original → Ziel), „Das ist bereits vorhanden“, „Das fehlt noch“, nächster Schritt („Damit anfangen“), Unsicheres, Frage nach der aktuellen Fassung (Auswahl per Knopf, danach sortiert der Assistent genau diese ein), nicht lesbare und doppelte Dateien.
- **Dauerhafte Zusammenfassung:** im Projekt-Panel und in `.facharbeit/uebernahme.md`, in jedem späteren Chat dabei. Neues Material ergänzt den Stand; getroffene Entscheidungen bleiben.
- **Auch für Anhänge:** Der Block `einsortieren` funktioniert in jedem Chat, z. B. für eine angehängte Datei, die in die Facharbeit gehört.

## Arbeitsraum

Jede Facharbeit hat einen eigenen Ordner (Vorschlag: `Dokumente/Facharbeit – <Titel>`). Ein vorhandener Ordner kann gewählt werden; vorhandene Dateien bleiben unverändert.

```
<Arbeitsraum>/
├── FACHARBEIT.md                  Übersicht: Angaben, Arbeitsstand, gemerkte Ergebnisse (von der App erzeugt)
├── abgabe/                        Abgabe-Dateien, hier wird gearbeitet: Lerntagebuch_<Name>.docx (Kopie der Schulvorlage,
│                                  Deckblatt ausgefüllt) und Facharbeit_<Name>.docx (Schulformat, Kapitelgerüst)
├── 00_vorgaben/                   Originale der Schule (PDFs, Lerntagebuch-Vorlage, schreibgeschützt) + anforderungen.md
├── 01_themenfindung_und_mindmap/  … bis 08_praesentation_verteidigung/ (Notizen, Material, Vorlagen)
├── anhaenge/JJJJ-MM-TT/           Dateien, die im Chat angehängt wurden
├── uebernommen/<Datum_Uhrzeit>/   per Drop-in mitgebrachte Originale (schreibgeschützt)
├── exporte/                       Word-Export der Gesamtarbeit
├── AGENTS.md, CLAUDE.md           kurze Hinweise für KI-Werkzeuge (nur angelegt, wenn nicht vorhanden)
├── .agents/rules/, .agents/skills/, .claude/skills/   Regeln und Skills für beide Anbieter
└── .facharbeit/                   projekt.json, arbeitsstand.json, chats/, versionen/, extrakte/, import/, uebernahme.md, regeln.md
```

- **Originale und Arbeitskopien:** Was die Schule vorgibt, liegt unverändert in `00_vorgaben/` (schreibgeschützt; ändert der Assistent dort etwas, setzt die App es zurück). Gearbeitet wird in den Kopien in `abgabe/` – das sind die Dateien, die am Ende abgegeben werden. Der Assistent legt dafür keine Markdown-Kopien an.
- **Word-Dateien bearbeiten:** Word-Dateien kann der Assistent nicht selbst schreiben. Die App erstellt für jede Word-Datei in `abgabe/` (und `01_`–`08_`) eine Fassung mit Absatznummern (`.facharbeit/extrakte/…docx.txt`, Pfad im Projektkontext). Der Assistent nennt Änderungen im Block `word` (Absatz ersetzen, Teiltext wie „...“ ersetzen, Absätze einfügen, Tabellenzeile anhängen, Bild einfügen, Absatz löschen); die App trägt sie ein und behält Schrift, Abstände, Tabellen und Deckblatt der Vorlage. Vorher wird die alte Fassung gesichert. Unter der Antwort steht „In Word eingetragen“; ist die Datei gerade in Word geöffnet, gibt es „Erneut eintragen“. Eine vom Assistenten als Text überschriebene (also kaputte) Word-Datei setzt die App zurück; in Word gespeicherte Änderungen der Person bleiben.
- **Versionen:** Ändert der Assistent eine vorhandene Datei, sichert die App die vorherige Fassung unter `.facharbeit/versionen/`. Im Chat steht „geändert“ mit Link zur alten Fassung; im Arbeitsraum gibt es „Frühere Fassungen“ und „Als Kopie wiederherstellen“. Der Assistent ist außerdem angewiesen, Überarbeitungen als `_v2`, `_v3` zu speichern.
- **Word, PDF, PowerPoint, Excel erstellen:** Der Assistent hat kein Terminal. Für neue Dateien nennt er im Block `erstellen` Zielpfad und Inhalt als Markdown; die App erzeugt daraus ohne zusätzliche Programme eine Word-Datei, ein PDF (A4, Arial-Optik), eine PowerPoint-Datei (16:9, Folien durch `---` getrennt, Sprechernotizen mit `>`, Tabellen, Bilder) oder eine Excel-Datei (je Markdown-Tabelle ein Blatt). Ein PDF kann auch direkt aus einer Word- oder Markdown-Datei entstehen (`"aus"`). Vorhandenes wird nicht überschrieben (außer mit `"ersetzen": true`, dann mit Sicherung). Unter der Antwort steht eine Karte mit **Ansehen** (Vorschau in der App) und **Öffnen** (im passenden Programm). **Vorschau:** PDF im eingebauten Viewer; PowerPoint-Folien zeichnet Mango selbst nach (`server/pptxrender.js`: Positionen, Farben, Schriften, Aufzählungen, Tabellen, Bilder, Platzhalter aus Layout und Folienmaster), sodass sie ungefähr wie in PowerPoint aussehen; Word und Excel erscheinen vereinfacht. Ist Microsoft PowerPoint/Word (Windows, über PowerShell) oder LibreOffice installiert, wandelt Mango Word- und PowerPoint-Dateien im Hintergrund in ein PDF um (`server/konvertieren.js`, gespeichert in `.facharbeit/vorschau/`) und zeigt dann die **Originalansicht**.
- **Ordnung:** Die App prüft vor jeder Nachricht, ob etwas nicht am Platz liegt (lose Dateien im Hauptordner, Entwürfe in `abgabe/`, ältere Fassungen `_v1`, Kopien, Platzhalter-Namen) und gibt das dem Assistenten als „Aufräumen nötig“ mit. Der Assistent räumt mit dem Block `aufraeumen` auf (verschieben oder archivieren); die App führt das sicher aus: nur in `abgabe/` und `01_`–`08_`, nie in den Originalen, nie die Abgabe-Dateien, nichts wird gelöscht (Aussortiertes liegt in `.facharbeit/papierkorb/`), **Rückgängig** unter der Antwort. Reste (`~$…`, `.tmp`) und leere Ordner entfernt die App selbst. Dateien, die schon vor dem Projekt im Ordner lagen, fasst sie nicht ungefragt an. Im Dateien-Panel gibt es **Arbeitsordner öffnen** und **Aufräumen**; oben rechts öffnet das Ordner-Symbol den Arbeitsordner.
- **Pflicht-Skills:** Beim Schreiben für eine Datei muss der Assistent `wissenschaftlich-schreiben` und `sprachpruefung` laden. Die App erkennt das an den Werkzeugaufrufen; fehlt einer, lässt sie ihn in einem stillen Durchlauf nachholen und den Text überarbeiten („Schreib-Skills gelesen/nachgeholt“ unter der Antwort).
- **Kurze Antworten:** Bei jeder Nachricht erinnert die App an den Antwortstil (höchstens drei kurze Sätze, einfache Wörter, keine Listen).
- **Textauszüge:** Für Word, PowerPoint, Excel, OpenDocument und (falls `pdftotext` vorhanden) PDF erzeugt die App Textauszüge, damit beide Anbieter den Inhalt zuverlässig lesen.
- **Exporte:** Gesprächsverläufe für den Anhang (Markdown + Word) nach `07_ki_prompts_anhang/`, einzelne Markdown-Dateien als Word, bei älteren Arbeitsräumen mit Kapiteln in `05_facharbeit_entwurf/` die Gesamtarbeit als Word mit Schulformatierung (A4, Arial 11 pt, 1,5-zeilig, Ränder 2,5/2,0 cm, Titelblatt ohne Seitenzahl, Seitenzahl oben zentriert ab der Einleitung, Inhaltsverzeichnis als Word-Feld) und eine ZIP-Sicherung.

## Wie der Assistent Bescheid weiß

1. **Regeln** (`ressourcen/regeln.md`): „Kurz und einfach“ als oberste Regel (Chat-Antworten meist zwei bis fünf Sätze, Lerntagebuch-Einträge zwei bis fünf Sätze, Sätze höchstens 25 Wörter), die Schreibregeln der Humanize-Skills als Kurzfassung (gelten immer, auch ohne Skill-Aufruf), Rolle, Schulvorgaben, KI-Regeln der Schule, Quellenregeln, Dateiregeln, Arbeitsstand-Protokoll. Claude erhält sie als Systemprompt-Ergänzung, Antigravity als Workspace-Regel (`.agents/rules/`).
2. **Projektkontext** vor jeder Nachricht: Projektangaben, Fristen, kompletter Arbeitsstand, gemerkte Ergebnisse, zuletzt geänderte Dateien. Unveränderter Kontext wird nicht erneut gesendet. Ein neuer Chat oder ein Anbieterwechsel bekommt den vollständigen Kontext (beim Wechsel zusätzlich den bisherigen Chatverlauf).
3. **Wissensbasis** `00_vorgaben/anforderungen.md`: alle Vorgaben aus Handreichung, Zeitschiene, KI-Leitfaden, Aufgaben zu Exposé und Mindmap, Lerntagebuch-Vorlage und Bewertungsbögen – mit Quelle und Kennzeichnung **[V] verbindlich / [E] Empfehlung / [B] Beispiel** sowie einer Liste von Widersprüchen, bei denen der Assistent nachfragt.
4. **Skills** (`ressourcen/skills/`, Herkunft in `ressourcen/skills/HERKUNFT.md`): `wissenschaftlich-schreiben`, `sprachpruefung` (mit `ai_tell_scan.py`), `quellenrecherche`, `abgabe-pruefen`.
5. **Schreib-Skills sind Pflicht:** Vor jedem Text für eine Datei lädt der Assistent `wissenschaftlich-schreiben` und prüft danach mit `sprachpruefung`. Erkennt die App eine Schreibaufgabe (schreiben, eintragen, überarbeiten, Lerntagebuch, Exposé, Kapitel …), erinnert sie im Prompt zusätzlich daran.
6. **Automatische Sprachprüfung** (`server/stil.js`): Jeder Text, den der Assistent in eine Datei schreibt (Word-Block oder Markdown, nicht beim wortgetreuen Einsortieren), wird nach den Listen der Skills geprüft: Floskeln („in der heutigen Zeit“, „darüber hinaus“, „spielt eine entscheidende Rolle“), gehäufte Stilwörter, vage Belege ohne Kurzbeleg, Chatbot-Reste, Geviertstriche, englische Anführungszeichen, Sätze über 25 Wörter. Direkte Zitate bleiben unangetastet. Gefundene Stellen überarbeitet der Assistent einmal in derselben Sitzung (ohne zusätzliche Antwort im Chat). Unter der Antwort steht „Sprachprüfung: unauffällig“, „… überarbeitet“ oder welche Stellen noch zu prüfen sind.

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
- Dateizugriffe sind auf den Arbeitsraum beschränkt. Die App gibt dem Claude-Anbieter Datei-, Such- und Webwerkzeuge frei (`Read, Write, Edit, MultiEdit, Glob, Grep, WebSearch, WebFetch, TodoWrite, Skill`) im Modus `acceptEdits`, aber keine Freigabe für Befehle. Originale (`uebernommen/`, `anhaenge/`) sind schreibgeschützt und werden nach jedem Durchlauf geprüft und bei Bedarf wiederhergestellt. Antigravity läuft im Headless-Modus mit `--mode accept-edits`: Dateiänderungen im Arbeitsraum sind freigegeben, Befehle und andere Aktionen ohne Freigabe werden verweigert und unter der Antwort als „Nicht erlaubt“ angezeigt. Bricht agy wegen eines Verbindungs- oder Modellfehlers ab (Exit-Code 3, Zeile `AGY_ERROR` auf stderr) oder kommt eine leere Antwort, sendet die App die Nachricht einmal neu.

## Entwicklung

```
electron/    Desktop-App (Fenster ohne Titelleiste, native Dialoge, Starttest)
build/       Symbol für Windows, Release-Notizen
server/      Node-Server ohne Abhängigkeiten (HTTP-API, Speicher, Anbieter, Kontext, Einsortieren, Exporte)
public/      Oberfläche (HTML, CSS, JavaScript-Module, Schrift Inter)
ressourcen/  Regeln, Wissensbasis, Schulvorgaben, Vorlagen für den Arbeitsraum, Skills
test/        Unit- und API-Tests; test/fixtures/bin enthält Test-Doubles beider CLIs
```

Desktop-App: `npm install`, dann `npm run desktop` (Electron). Windows-Installer bauen: `npm run dist:win` (electron-builder, NSIS, Ergebnis in `dist/`). Starttest ohne Fenster: `"Mango Facharbeit.exe" --smoke-test=<ergebnis.json>`. Der Workflow `.github/workflows/release.yml` läuft bei jedem Push: Tests, Bau des Installers auf einem Windows-Runner, Starttest der gebauten und der still installierten App. Gibt es für die Version aus `package.json` noch kein Release, legt er Tag `v<version>` und Release an (Versionen mit Bindestrich, z. B. `0.2.0-beta`, als Vorabversion). Für ein neues Release also die Version erhöhen.

Tests: `npm test`. Die API-Tests laufen gegen Test-Doubles der beiden CLIs, damit sie ohne Konto und Netz reproduzierbar sind. Das Ereignisformat des Antigravity-Doubles folgt der [Headless-Dokumentation](https://antigravity.google/docs/cli/headless/).

Die Originalmaterialien liegen unverändert in `Facharbeit angaben und vorlagen etc/`. Personenbezogene Angaben daraus (Namen, Klassen, Lehrkräfte, Thema der begonnenen Arbeit) werden nicht als Standardwerte verwendet. Eine begonnene Facharbeit bringt man per Drop-in mit.
