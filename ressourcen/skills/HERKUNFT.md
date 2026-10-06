# Skills: Herkunft und Einordnung

Die App kopiert diese Skills in jeden Arbeitsraum (`.agents/skills/` für Antigravity, `.claude/skills/` für Claude Code). Der Assistent erhält in seinen Regeln eine Übersicht, wann welcher Skill gilt.

| Skill in der App | Quelle | Was übernommen wurde | Was nicht übernommen wurde und warum |
|---|---|---|---|
| `wissenschaftlich-schreiben` | `Humanize skills/SKILL-1.md` („human-voice“). `SKILL-2.md` ist inhaltlich identisch und wurde zusammengeführt. | Regeln gegen Floskeln, Aufblähung, Schablonen; Rhythmus; Wortlisten (Deutsch, Englisch); Ablauf mit Kürz-, Rhythmus- und Vorlesetest; Forschungsbelege | Kanal-Tabelle für WhatsApp/Reddit/Fiverr (ersetzt durch schulische Textsorten); Satzfragmente, Umgangssprache und Kurzformen (widersprechen der Wissenschaftssprache); Nachahmung eines persönlichen Stilprofils und Hinweise zum Bestehen von KI-Detektoren (widersprechen der Kennzeichnungspflicht der Schule) |
| `sprachpruefung` | `Humanize skills/SKILL-3.md` („ai-tell-audit“) und `Humanize skills/ai_tell_scan.py` | Prüfablauf, Berichtsformat, vollständige Checkliste, Skript unverändert unter `scripts/ai_tell_scan.py`, deutsche Erklärung der Skriptausgabe; ergänzt um die Kriterien nach Noll/Vode aus der Handreichung | Abschnitt über die Funktionsweise kommerzieller KI-Detektoren (nicht Ziel der Facharbeit) |
| `quellenrecherche` | `Research God skill.md` („deep-invention“) | Begrenzte Rechercheschleifen, Quellenhierarchie, Belegtabelle (Belegt/Abgeleitet/Vermutung/Offene Frage), Umgang mit widersprüchlichen Quellen, Alternativenvergleich (für die Methodenwahl), Nachrechnen, Prüffragen, keine Umgehung von Zugangsbeschränkungen | Software-Leistung, Spielmechaniken, Sicherheitstests, Neuheitsprüfung von Erfindungen (für die Facharbeit nicht relevant) |
| `abgabe-pruefen` | neu, aus Handreichung, Zeitschiene, Bewertungsbögen und Lerntagebuch-Vorlage | Prüfpunkte zu Inhalt, Umfang, Zitieren, KI-Kennzeichnung, Bestandteilen, Form, Abgabe; Berichtsformat; Regeln für den Arbeitsstand | – |
| `bestehende-arbeit-uebernehmen` | neu, für die Übernahme bereits begonnener Arbeiten | Nur-lesen-Ablauf, Abgleich mit den Vorgaben, Regeln für „erledigt erst nach Prüfung“, Nachfragen bei unklaren Entwurfsständen, Ausgabeformat für Arbeitsstand und Zusammenfassung | – |

Weitere Ausgangsdateien:

- `agent.md`: Die Stilregeln (einfache Sprache, kurz, direkt, Struktur, Schritt für Schritt) sind in `ressourcen/regeln.md` eingeflossen. Das dort genannte Thema („Der Goldene Schnitt in der KI-Kunst“) ist Beispielmaterial einer begonnenen Facharbeit und wird nicht als Standard verwendet.
- `AGENTS.md` / `CLAUDE.md` der leeren Vorlage: Ordnerstruktur und Sitzungsablauf wurden übernommen. Aussagen, die den Schuldokumenten widersprechen oder dort fehlen (z. B. „Harvard/APA“, „Verlaufs-Zusammenfassungen genügen“, „Schutz vor Plagiatserkennung“, „gebunden“), wurden nicht übernommen. Verweise auf den nicht vorhandenen Skill `.agents/skills/humanize-writing/` sind durch die Skills oben ersetzt.

Technische Bezeichner, Dateipfade und Befehle (z. B. `python3 scripts/ai_tell_scan.py entwurf.md`) sind unverändert.
