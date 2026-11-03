# Skills: Herkunft und Einordnung

Die App kopiert diese Skills in jeden Arbeitsraum (`.agents/skills/` für Antigravity, `.claude/skills/` für Claude Code). Der Assistent erhält in seinen Regeln eine Übersicht, wann welcher Skill gilt.

| Skill in der App | Quelle | Was übernommen wurde | Was nicht übernommen wurde und warum |
|---|---|---|---|
| `stimmenprofil` | `Huminizer GER V2/stimmenprofil` | Vollständig und unverändert (`SKILL.md` und `references/`) | `agents/openai.yaml` (Metadaten für andere Systeme, die App nutzt sie nicht) |
| `natuerlich-schreiben` | `Huminizer GER V2/natuerlich-schreiben` | Vollständig und unverändert (`SKILL.md` und `references/`) | `agents/openai.yaml`, siehe oben |
| `stilrevision` | `Huminizer GER V2/stilrevision` | Vollständig und unverändert (`SKILL.md` und `references/`) | `agents/openai.yaml`, siehe oben |
| `textpruefung` | `Huminizer GER V2/textpruefung` | Vollständig und unverändert (`SKILL.md` und `references/`) | `agents/openai.yaml`, siehe oben |
| `quellenrecherche` | `Research God skill.md` („deep-invention“) | Begrenzte Rechercheschleifen, Quellenhierarchie, Belegtabelle (Belegt/Abgeleitet/Vermutung/Offene Frage), Umgang mit widersprüchlichen Quellen, Alternativenvergleich (für die Methodenwahl), Nachrechnen, Prüffragen, keine Umgehung von Zugangsbeschränkungen | Software-Leistung, Spielmechaniken, Sicherheitstests, Neuheitsprüfung von Erfindungen (für die Facharbeit nicht relevant) |
| `abgabe-pruefen` | neu, aus Handreichung, Zeitschiene, Bewertungsbögen und Lerntagebuch-Vorlage | Prüfpunkte zu Inhalt, Umfang, Zitieren, KI-Kennzeichnung, Bestandteilen, Form, Abgabe; Berichtsformat; Regeln für den Arbeitsstand | – |
| `bestehende-arbeit-uebernehmen` | neu, für die Übernahme bereits begonnener Arbeiten | Nur-lesen-Ablauf, Abgleich mit den Vorgaben, Regeln für „erledigt erst nach Prüfung“, Nachfragen bei unklaren Entwurfsständen, Ausgabeformat für Arbeitsstand und Zusammenfassung | – |

## Schreib-Skills: Paket „Huminizer GER V2“

Die vier Schreib-Skills ersetzen die früheren Skills `wissenschaftlich-schreiben` und `sprachpruefung` (aus `Humanize skills/SKILL-1.md` bis `SKILL-3.md` und `ai_tell_scan.py`). Die App entfernt die alten Skills beim Öffnen aus bestehenden Arbeitsräumen (nur von der App verwaltete Kopien, nie eigene Dateien).

- **Die Skills bleiben unverändert.** Einzige Ergänzung ist eine Verwaltungszeile direkt unter dem Kopfblock (`mango-facharbeit:verwaltet`), damit die App Änderungen nachziehen kann, ohne eigene Dateien zu überschreiben. Ein Test prüft, dass die Texte mit dem Ordner `Huminizer GER V2/` übereinstimmen.
- **Nicht mitgeliefert** werden `wissensbasis/` (Recherche zum Nachlesen), `START_HIER.md` und `PRUEFUNG.md`. Sie bleiben im Ordner `Huminizer GER V2/` des Projekts.
- **Alles Schulspezifische steht in `ressourcen/regeln.md`** (Abschnitte „Schreibregeln“ und „Menschlich schreiben“), nicht in den Skills: Vorrang der Schulvorgaben (Sprachregeln der Handreichung, Kurzbeleg), Textsorten der Facharbeit, KI-Vermerk, „kurz und einfach“. Die Skills sind bewusst allgemein gehalten und bekommen so keine Sonderregeln.
- **Pflicht bei jedem Text:** `stimmenprofil` (Stimme der Person), dann `natuerlich-schreiben` (neuer Text) oder `stilrevision` (vorhandener Text), dann `textpruefung`. Das gilt für Texte in Dateien und für Entwürfe im Chat. Der vollständige Wortlaut aller vier Skills wird beim Einrichten des Arbeitsraums an den Anfang der Regeln gesetzt (`regelnText()` in `server/workspace.js`), steht also vor allem anderen im Systemprompt. Nur wenn er fehlt, merkt die App (`server/schreibskills.js`, `server/runs.js`), welche Skills geladen wurden, und lässt fehlende nachholen.
- **Die automatische Prüfung** (`server/stil.js`) gibt Wortlisten und Floskeln nur noch als Prüfhinweise weiter, wie es `textpruefung` und `stilrevision` verlangen („Wortlisten sind höchstens Suchhilfen“). Nur Chatbot-Reste und falsche Anführungszeichen müssen immer geändert werden.

## DeepSeek: eigene Schreib-Anleitung und Werkzeuge

Claude und Antigravity bekommen den Wortlaut der vier Schreib-Skills. DeepSeek bekommt etwas anderes, weil es lange Prosa-Regeln schlechter befolgt: eine kurze Anleitung (`ressourcen/deepseek/schreiben.md`) und sechs Werkzeuge (`server/stimme.js`). Die Regeln in `ressourcen/regeln.md` sind für beide Fälle gemeinsam; Blöcke `<!--NUR:standard-->` und `<!--NUR:deepseek-->` gelten nur für einen Anbieter.

| Quelle | Was übernommen wurde | Was nicht übernommen wurde und warum |
|---|---|---|
| [dsh-humanizer](https://github.com/lynote-ai/dsh-humanizer) (lynote-ai, BSD-3-Clause, Lizenztext in `ressourcen/deepseek/LIZENZ-dsh-humanizer.txt`) | Das Prinzip („nicht wie irgendein Mensch, sondern wie ich“), der Aufbau aus Muster-Scan, Stil-Fingerabdruck, Ähnlichkeitswert und Umschreib-Anleitung, die Gewichtung der Merkmale beim Ähnlichkeitswert, die Idee, dass die Werkzeuge nur rechnen und die KI selbst umschreibt | Der Code selbst (TypeScript, Plugin für das „DeepSeek Harness“): stattdessen für deutsche Texte neu geschrieben. Die englischen und chinesischen Regeln: stattdessen die deutschen Muster der automatischen Sprachprüfung (`server/stil.js`). Der „AI-Score“ von 0 bis 100: Er wäre ein Ziel, auf das sich ein Text trimmen ließe. Stattdessen gibt `humanize_scan` Befunde mit Textstelle aus und `voice_score` die Nähe zur Schreibweise der Person (Qualität, nicht das Urteil eines Erkennungsprogramms). Wie in `textpruefung` gibt es keinen Prozentwert für „KI“ |
| Schreib-Skills (Huminizer GER V2) | Die Regeln der Umschreib-Anleitung (Aussage zuerst, nichts Austauschbares, keine Floskeln in Serie, Inhalt statt Schema, ein Begriff bleibt ein Begriff, nichts erfinden, keine künstlichen Fehler) | Der volle Wortlaut: DeepSeek bekommt ihn nicht, sondern die kurze Fassung als Anleitung und als Ergebnis der Werkzeuge |

Das Stimmenprofil entsteht nur aus eigenen Texten der Person. Schuldokumente, interne Dateien und KI-Vermerke werden nicht als Proben genommen.

Weitere Ausgangsdateien:

- `agent.md`: Die Stilregeln (einfache Sprache, kurz, direkt, Struktur, Schritt für Schritt) sind in `ressourcen/regeln.md` eingeflossen. Das dort genannte Thema („Der Goldene Schnitt in der KI-Kunst“) ist Beispielmaterial einer begonnenen Facharbeit und wird nicht als Standard verwendet.
- `AGENTS.md` / `CLAUDE.md` der leeren Vorlage: Ordnerstruktur und Sitzungsablauf wurden übernommen. Aussagen, die den Schuldokumenten widersprechen oder dort fehlen (z. B. „Harvard/APA“, „Verlaufs-Zusammenfassungen genügen“, „Schutz vor Plagiatserkennung“, „gebunden“), wurden nicht übernommen. Verweise auf den nicht vorhandenen Skill `.agents/skills/humanize-writing/` sind durch die Schreib-Skills oben ersetzt.

Technische Bezeichner und Dateipfade sind unverändert.
