---
name: bestehende-arbeit-uebernehmen
description: Mitgebrachtes Material zur Facharbeit einsortieren (Drop-in). Dateien in die passenden Arbeitsordner einordnen lassen, vorhandene Arbeitsdateien ergänzen, Projektangaben und Arbeitsstand aktualisieren und eine dauerhafte Zusammenfassung liefern – Originale bleiben unverändert.
---

<!-- mango-facharbeit:verwaltet – erstellt für das Einsortieren mitgebrachter Arbeit -->

# Material einsortieren (Drop-in)

Nutze diesen Skill, wenn die App einen Block `<einsortieren …>` schickt oder die Person Dateien aus ihrer bisherigen Arbeit mitbringt. Ziel: Danach liegt alles ordentlich im Arbeitsraum, der Arbeitsstand stimmt, und die Person kann sofort weitermachen.

## Grundregeln

- **Originale nie ändern.** `uebernommen/` ist schreibgeschützt. Arbeitskopien entstehen in den Ordnern `01_` bis `08_`.
- **Einsortieren macht die App.** Du nennst im Block `einsortieren` nur Quelle und Ziel. Die App kopiert die Datei oder wandelt Word/Text wortgetreu in Markdown um. Schreib Inhalte dafür nicht selbst ab: Das kostet viel und verändert womöglich den Text der Person.
- **Sparsam lesen.** Inventar zuerst, dann gezielt Textauszüge. Identische Dateien nur einmal. Bilder nur ansehen, wenn sie für den Stand wichtig sind (z. B. Mindmap).
- **Nichts erfinden.** Was du nicht lesen konntest, ist „unsicher“, nicht „vorhanden“.
- **Erst prüfen, dann erledigt.** `erledigt` nur, wenn der Inhalt vorhanden ist und du ihn gegen `00_vorgaben/anforderungen.md` geprüft hast. Vorhandenes, aber Unvollständiges ist `in_arbeit`. Aufgaben außerhalb der App (Themenabgabe, Konsultationen, Unterschrift, Abgabe) höchstens vorschlagen.
- **Eigenanteil schützen.** Texte der Person nicht umformulieren oder „verbessern“. Ergänzen heißt: fehlende Einträge anfügen (z. B. Quellen, Termine), nicht umschreiben.
- **Sparsam fragen.** Höchstens drei Fragen, nur zu Wichtigem (z. B. aktuelle Fassung, Fach, Fragestellung).

## Wohin gehört was?

| Inhalt | Ordner |
|---|---|
| Themenideen, Notizen, Mindmap | `01_themenfindung_und_mindmap/` |
| Exposé, Zeitplan | `02_expose_und_zeitplan/` |
| Literaturliste, Exzerpte, Quellen-PDFs | `03_literatur_und_quellen/` |
| Fragebogen, Interviews, Messdaten, Auswertung | `04_forschung_und_eigenanteil/` |
| Gliederung, Kapitelentwürfe, Gesamtentwurf | `05_facharbeit_entwurf/` |
| Lerntagebuch, Konsultationsprotokolle | `06_lerntagebuch_und_konsultationen/` |
| KI-Protokolle, Prompt-Nachweise | `07_ki_prompts_anhang/` |
| Präsentation, Handout, Verteidigung | `08_praesentation_verteidigung/` |

Schulvorgaben, die schon in `00_vorgaben/` liegen (siehe Inventar „bereits vorhanden“), nicht einsortieren.

**Dateinamen:** kurz, klein, ohne Leerzeichen, z. B. `expose.md`, `gliederung.md`, `mindmap.png`, `lerntagebuch.docx`, `umfrage_ergebnisse.xlsx`. Vorlagen der App (`*_vorlage.md`, `README.md`) bleiben bestehen.

**Format:**
- Word-Entwürfe, an denen die Person in Word weiterschreibt: als `.docx` kopieren.
- Notizen, Exposé oder Gliederung aus Word oder Text: als `.md` umwandeln (`nach` endet auf `.md`). So kannst du später gezielt damit arbeiten.
- Bilder, PDFs, Tabellen, Präsentationen: im Originalformat kopieren.

**Neuere Fassung einer schon einsortierten Datei:** mit `"ersetzen": true` auf dasselbe Ziel. Die App sichert die bisherige Fassung. Ohne `ersetzen` legt sie `_v2`, `_v3` an.

## Ablauf

1. Inventar lesen: `.facharbeit/import/<id>/inventar.md`
2. Wichtige Dateien lesen (Textauszug): Entwürfe, Exposé, Lerntagebuch, Gliederung, Literatur, Eigenanteil
3. Plan für `einsortieren` aufstellen
4. Arbeitsdateien bei Bedarf gezielt ergänzen (Edit), z. B. neue Quellen in die Literaturliste
5. Stand mit den Vorgaben abgleichen, Antwort schreiben, drei Blöcke anhängen

## Antwort

Zwei bis vier Sätze in einfacher Sprache: Was ist da, was fehlt, was ist der nächste Schritt. Danach höchstens drei Fragen. Keine langen Listen im Text, denn die Übersicht zeigt die App. Keine Ankündigungen von Zwischenschritten und kein Hinweis auf die Blöcke.

## Block 1: Einsortieren

```einsortieren
[
 {"von":"uebernommen/2026-10-08_1530/Meine Facharbeit/Expose_v2.docx","nach":"02_expose_und_zeitplan/expose.md"},
 {"von":"uebernommen/2026-10-08_1530/Meine Facharbeit/Mindmap.png","nach":"01_themenfindung_und_mindmap/mindmap.png"},
 {"von":"uebernommen/2026-10-08_1530/Meine Facharbeit/Facharbeit.docx","nach":"05_facharbeit_entwurf/facharbeit_entwurf.docx"}
]
```

## Block 2: Arbeitsstand

```arbeitsstand
{"aufgaben":[
  {"id":"expose","status":"in_arbeit","notiz":"Exposé vorhanden (ca. 350 Wörter), Zeitplan fehlt","nachweis":"02_expose_und_zeitplan/expose.md"},
  {"id":"mindmap","status":"erledigt","notiz":"Geprüft: drei Themenbereiche","nachweis":"01_themenfindung_und_mindmap/mindmap.png"}
 ],
 "projekt":{"titel":"…","fach":"…","forschungsfrage":"…"},
 "merken":["Aktuelle Exposé-Fassung: 02_expose_und_zeitplan/expose.md (aus Expose_v2.docx)"]}
```

- `nachweis`: die einsortierte Datei (Ziel aus Block 1).
- `projekt`: was eindeutig in den eigenen Dateien steht: Arbeitstitel oder Thema als `titel`, Name und Klasse vom Deckblatt des eigenen Lerntagebuchs oder Entwurfs, Fach, Bezugsfach, Lehrkraft, Fragestellung, Methode. Nicht übernehmen: Platzhalter („Name:“, „…“), Musternamen und Beispieldaten aus Vorlagen der Schule, Widersprüchliches (das gehört zu `unsicher` oder in eine Frage). Die App füllt nur leere Felder und fragt bei Abweichungen selbst nach.

## Block 3: Übernahme

```uebernahme
{"zusammenfassung":"Markdown, 8–15 Zeilen: Thema, Fragestellung, Fächer, Gliederung, vorhandene Texte mit Umfang, Quellenlage, Eigenanteil, Arbeitsprozess, wichtigste Lücken – mit den neuen Dateipfaden.",
 "vorhanden":["Exposé (ca. 350 Wörter) – 02_expose_und_zeitplan/expose.md","…"],
 "fehlt":["Zeitplan nach Vorgabe","…"],
 "naechsterSchritt":"Ein konkreter, sofort machbarer Schritt.",
 "unsicher":["Unklar, ob die Gliederung mit der Lehrkraft abgestimmt ist"],
 "versionen":[{"dateien":["uebernommen/…/Facharbeit_v2.docx","uebernommen/…/Facharbeit final.pdf"],"frage":"Welche Fassung ist aktuell?"}]}
```

- `vorhanden` und `fehlt`: je höchstens zehn kurze Punkte, wichtigste zuerst.
- `versionen`: nur, wenn die aktuelle Fassung wirklich unklar ist. Wählt die Person später eine Fassung, sortiere genau diese im nächsten Schritt mit einem `einsortieren`-Block ein.
- Die `zusammenfassung` wird dauerhaft gespeichert und in späteren Chats mitgegeben. Sie muss ohne die Originale verständlich sein.
