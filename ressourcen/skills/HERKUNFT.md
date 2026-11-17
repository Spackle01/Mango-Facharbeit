# Skills: Herkunft und Einordnung

Die App kopiert diese Skills in jeden Arbeitsraum (`.agents/skills/` für Antigravity, `.claude/skills/` für Claude Code). Der Assistent erhält in seinen Regeln eine Übersicht, wann welcher Skill gilt.

| Skill in der App | Quelle | Was übernommen wurde | Was nicht übernommen wurde und warum |
|---|---|---|---|
| `human-voice` | `Humanize skills/SKILL-1.md` | Vollständig und unverändert | – |
| `humanize-rewrite` | Skill `humanize-rewrite` desselben Pakets (in `Humanize skills/` lag an der Stelle von `SKILL-2.md` eine zweite Kopie von `SKILL-1.md`) | Vollständig und unverändert | – |
| `ai-tell-audit` | `Humanize skills/SKILL-3.md` und `ai_tell_scan.py` | Vollständig und unverändert (`SKILL.md` und `scripts/ai_tell_scan.py`) | – |
| `quellenrecherche` | `Research God skill.md` („deep-invention“) | Begrenzte Rechercheschleifen, Quellenhierarchie, Belegtabelle (Belegt/Abgeleitet/Vermutung/Offene Frage), Umgang mit widersprüchlichen Quellen, Alternativenvergleich (für die Methodenwahl), Nachrechnen, Prüffragen, keine Umgehung von Zugangsbeschränkungen | Software-Leistung, Spielmechaniken, Sicherheitstests, Neuheitsprüfung von Erfindungen (für die Facharbeit nicht relevant) |
| `abgabe-pruefen` | neu, aus Handreichung, Zeitschiene, Bewertungsbögen und Lerntagebuch-Vorlage | Prüfpunkte zu Inhalt, Umfang, Zitieren, KI-Kennzeichnung, Bestandteilen, Form, Abgabe; Berichtsformat; Regeln für den Arbeitsstand | – |
| `bestehende-arbeit-uebernehmen` | neu, für die Übernahme bereits begonnener Arbeiten | Nur-lesen-Ablauf, Abgleich mit den Vorgaben, Regeln für „erledigt erst nach Prüfung“, Nachfragen bei unklaren Entwurfsständen, Ausgabeformat für Arbeitsstand und Zusammenfassung | – |

## Schreib-Skills: Paket „human-voice, humanize-rewrite, ai-tell-audit“

Die drei Schreib-Skills ersetzen alle früheren: `wissenschaftlich-schreiben` und `sprachpruefung` (erste Fassung) sowie `stimmenprofil`, `natuerlich-schreiben`, `stilrevision` und `textpruefung` (Paket „Huminizer GER V2“, zuletzt). Die App entfernt die alten Skills beim Öffnen aus bestehenden Arbeitsräumen (nur von der App verwaltete Kopien, nie eigene Dateien). Mit ihnen entfielen die eigene DeepSeek-Anleitung, die sechs DeepSeek-Werkzeuge für Stimmenprofil und Ähnlichkeitswert (`server/stimme.js`) und der Lizenzhinweis zu dsh-humanizer, weil dieser Code nicht mehr verwendet wird.

- **Die Skills bleiben unverändert.** Einzige Ergänzung ist eine Verwaltungszeile direkt unter dem Kopfblock (`mango-facharbeit:verwaltet`), damit die App Änderungen nachziehen kann, ohne eigene Dateien zu überschreiben. Ein Test prüft, dass `human-voice`, `ai-tell-audit` und `ai_tell_scan.py` mit den Dateien in `Facharbeit angaben und vorlagen etc/Humanize skills/` übereinstimmen.
- **Alles Schulspezifische steht in `ressourcen/regeln.md`** (Abschnitte „Schreibregeln“ und „Menschlich schreiben“), nicht in den Skills: Vorrang der Schulvorgaben (Sprachregeln der Handreichung, Kurzbeleg), Textsorten der Facharbeit, KI-Vermerk, „kurz und einfach“, Schreiben mit Lücken statt Rückfragen. Die Skills sind bewusst allgemein gehalten und bekommen so keine Sonderregeln.
- **Pflicht bei jedem Text:** `human-voice` (neuer Text) oder `humanize-rewrite` (vorhandener Text), dann `ai-tell-audit`. Das gilt für Texte in Dateien und für Entwürfe im Chat. Der vollständige Wortlaut der drei Skills wird beim Einrichten des Arbeitsraums an den Anfang der Regeln gesetzt (`regelnText()` in `server/workspace.js`), steht also vor allem anderen im Systemprompt. Beim Prüf-Skill fehlt dort nur das eingebettete Python-Skript. Nur wenn der Wortlaut fehlt, merkt die App (`server/schreibskills.js`, `server/runs.js`), welche Skills geladen wurden, und lässt fehlende nachholen.
- **Der Scan** (`ai_tell_scan.py`) läuft in Mango als JavaScript-Fassung (`server/aitell.js`), weil auf vielen Rechnern kein Python installiert ist und Claude und Antigravity in der App kein Terminal haben. Wortlisten, Muster, Kennzahlen und Berichtsformat entsprechen dem Skript; ein Test vergleicht beide Ausgaben. Mango führt ihn nach jedem Text aus (`server/stil.js`), DeepSeek ruft ihn als Werkzeug `ai_tell_scan` auf. Ergänzt hat Mango nur wenige deutsche Muster, die das Skript nicht kennt („Gerne!“, „Gute Frage“, „spielt Energie eine entscheidende Rolle“) und die Regel, dass Studienhinweise mit Kurzbeleg (Autor Jahr) nicht als vage Belege gelten.
- **Wie das Ergebnis genutzt wird** (`server/stil.js`): Treffer sind Suchhilfen, wie es der Skill verlangt. Nur Chatbot-Reste, Geviertstriche (der Skill verbietet sie) und falsche Anführungszeichen müssen immer geändert werden. Es gibt keinen „KI-Prozentwert“ und kein Ziel, auf das sich ein Text trimmen ließe; das Urteil des Skripts („reads clean / a few tells / reads as AI“) entscheidet nur, ob ein Text zur Überarbeitung zurückgeht. Der Skill selbst weist darauf hin: Kein Skript und kein Prompt garantiert ein Ergebnis bei GPTZero, Turnitin oder Originality.

Weitere Ausgangsdateien:

- `agent.md`: Die Stilregeln (einfache Sprache, kurz, direkt, Struktur, Schritt für Schritt) sind in `ressourcen/regeln.md` eingeflossen. Das dort genannte Thema („Der Goldene Schnitt in der KI-Kunst“) ist Beispielmaterial einer begonnenen Facharbeit und wird nicht als Standard verwendet.
- `AGENTS.md` / `CLAUDE.md` der leeren Vorlage: Ordnerstruktur und Sitzungsablauf wurden übernommen. Aussagen, die den Schuldokumenten widersprechen oder dort fehlen (z. B. „Harvard/APA“, „Verlaufs-Zusammenfassungen genügen“, „Schutz vor Plagiatserkennung“, „gebunden“), wurden nicht übernommen. Verweise auf den nicht vorhandenen Skill `.agents/skills/humanize-writing/` sind durch die Schreib-Skills oben ersetzt.

Technische Bezeichner und Dateipfade sind unverändert.
