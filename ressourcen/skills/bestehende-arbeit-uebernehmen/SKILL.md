---
name: bestehende-arbeit-uebernehmen
description: Eine außerhalb der App begonnene Facharbeit übernehmen. Mitgebrachte Entwürfe, Notizen, Quellen und Materialien lesen, den Stand gegen die Schulvorgaben abgleichen, Arbeitsstand und Projektangaben vorbereiten und eine dauerhafte Zusammenfassung liefern – ohne Dateien zu verändern.
---

<!-- mango-facharbeit:verwaltet – erstellt für die Übernahme bestehender Arbeiten -->

# Bestehende Arbeit übernehmen

Nutze diesen Skill, wenn die App eine Nachricht mit einem Block `<uebernahme …>` schickt oder die Person sagt, dass sie Material aus einer bereits begonnenen Facharbeit mitbringt. Ziel: Die Person kann direkt weiterarbeiten, ohne das Projekt neu erklären zu müssen.

## Grundregeln

- **Nur lesen.** Keine Datei ändern, umschreiben, verschieben, löschen oder neu anlegen. Die App speichert dein Ergebnis selbst und stellt veränderte Dateien wieder her.
- **Originale bleiben maßgeblich.** Fasse zusammen, was da ist. Verbessere oder ergänze keine Inhalte ungefragt.
- **Nichts erfinden.** Was du nicht gelesen hast oder nicht lesen konntest, ist „unsicher“ oder „nicht lesbar“, nicht „vorhanden“.
- **Erst prüfen, dann erledigt.** Eine Aufgabe ist nur `erledigt`, wenn der Inhalt vorhanden ist **und** du ihn gegen `00_vorgaben/anforderungen.md` geprüft hast (z. B. Exposé mit mindestens 400 Wörtern und allen Pflichtteilen). Vorhandene, aber ungeprüfte oder unvollständige Inhalte sind `in_arbeit`. Aufgaben außerhalb der App (Themenabgabe, Konsultationen, Unterschrift, Abgabe) schlägst du höchstens vor.
- **Bei unklaren Entwurfsständen nachfragen.** Gibt es mehrere Fassungen desselben Textes und ist nicht eindeutig, welche aktuell ist, wähle keine aus. Frag gezielt, z. B. „Ist `Facharbeit_v3.docx` (05.10.) oder `Facharbeit final.pdf` (02.10.) deine aktuelle Fassung?“
- **Sparsam fragen.** Höchstens drei Fragen, nur zu wichtigen fehlenden oder widersprüchlichen Angaben (z. B. Fach, Fragestellung, aktuelle Fassung). Was du aus den Dateien sicher erkennst, fragst du nicht ab.

## Ablauf

1. Inventar der App lesen (`.facharbeit/import/<id>/inventar.md`): Dateitypen, Daten, Umfang, Lesbarkeit, Duplikate, mögliche Entwurfsstände, bereits vorhandene Schulvorgaben.
2. Dateien lesen. Word, PDF, PowerPoint und Excel über die angegebenen Textauszüge. Reihenfolge bei vielen Dateien: Entwürfe der Facharbeit, Exposé, Lerntagebuch, Gliederung, Literaturliste, Eigenanteil (Fragebögen, Daten, Transkripte), Notizen. Schulvorgaben, die schon in `00_vorgaben/` liegen, nicht erneut auswerten.
3. Stand erfassen:
   - Thema, Arbeitstitel, Fragestellung oder These, Fach und Bezugsfach, Fachrichtung, Lehrkraft, Klasse, Name (nur was eindeutig in den Dateien steht)
   - Gliederung und welche Kapitel als Text vorliegen, mit ungefährem Umfang (Wörter, grobe Seitenzahl bei ca. 350–420 Wörtern pro Seite)
   - Quellen: Anzahl, Art (Fachbuch, Zeitschrift, Internet), ob vollständig angegeben
   - Eigenanteil: Methode, Stand der Durchführung, vorhandene Daten oder Ergebnisse
   - Arbeitsprozess: Mindmap, Lerntagebuch, Zeitplan, Konsultationen, KI-Kennzeichnung
4. Mit den Vorgaben abgleichen: Was ist erfüllt, was teilweise, was fehlt? Fristen aus dem Projektkontext beachten.
5. Antwort schreiben (kurz, siehe unten) und die zwei Blöcke anhängen.

## Antwort

Zwei bis vier Sätze Einschätzung in einfacher Sprache, danach höchstens drei gezielte Fragen. Keine langen Listen im Text – die stehen in den Blöcken und zeigt die App als Übersicht an.

## Block 1: Arbeitsstand

Wie in den Arbeitsregeln beschrieben:

```arbeitsstand
{"aufgaben":[
  {"id":"expose","status":"in_arbeit","notiz":"Exposé vorhanden (ca. 350 Wörter), Zeitplan fehlt","nachweis":"uebernommen/2026-10-06_1517/Expose.docx"},
  {"id":"mindmap","status":"erledigt","notiz":"Geprüft: drei Themenbereiche abgeleitet","nachweis":"uebernommen/2026-10-06_1517/Mindmap.png"}
 ],
 "projekt":{"titel":"…","fach":"…","bezugsfach":"…","forschungsfrage":"…","methode":"…"},
 "merken":["Aktuelle Fassung laut Dateidatum: uebernommen/…/Facharbeit_v3.docx (noch zu bestätigen)"]}
```

- `projekt`: alle Angaben, die eindeutig in den eigenen Dateien der Person stehen, z. B. Arbeitstitel oder festgelegtes Thema als `titel`, Name und Klasse vom Deckblatt des eigenen Lerntagebuchs oder Entwurfs, Fach, Bezugsfach, Lehrkraft, Fragestellung, Methode. Nicht eintragen: Platzhalter („Name:“, „…“), Musternamen und Beispieldaten aus Vorlagen der Schule (z. B. „Max Mustermann“) und alles, was sich widerspricht – das gehört unter `unsicher` bzw. in eine Frage. Die App trägt die Angaben nur in leere Felder ein und zeigt Widersprüche zu vorhandenen Angaben zur Bestätigung an.
- `merken`: wenige, wichtige Erkenntnisse für spätere Chats (ein Satz je Eintrag).

## Block 2: Übernahme

```uebernahme
{"zusammenfassung":"Markdown, 8–20 Zeilen: Thema, Fragestellung, Fächer, Gliederung, vorhandene Texte mit Umfang, Quellenlage, Eigenanteil, Arbeitsprozess, wichtigste Lücken. Mit Dateipfaden.",
 "vorhanden":["Exposé (ca. 350 Wörter) – uebernommen/…/Expose.docx","…"],
 "fehlt":["Zeitplan nach Vorgabe","Mindestens zwei Standardwerke (Empfehlung)","…"],
 "naechsterSchritt":"Ein konkreter, sofort machbarer Schritt, z. B. „Exposé um den Zeitplan ergänzen (fehlt für die 1. Einzelkonsultation).“",
 "unsicher":["Unklar, ob die Gliederung mit der Lehrkraft abgestimmt ist","…"],
 "versionen":[{"dateien":["uebernommen/…/Facharbeit_v2.docx","uebernommen/…/Facharbeit final.pdf"],"frage":"Welche Fassung ist aktuell?"}]}
```

- `vorhanden` und `fehlt`: je höchstens zehn kurze Punkte, wichtigste zuerst, mit Bezug zu den Vorgaben.
- `unsicher`: Einschätzungen, die du nicht sicher belegen kannst, und Dateien, die du nicht lesen konntest.
- `versionen`: nur Gruppen, bei denen die aktuelle Fassung wirklich unklar ist.
- Die `zusammenfassung` wird dauerhaft gespeichert und in späteren Chats mitgegeben. Sie muss ohne die Originaldateien verständlich sein.

## Später nachgereichtes Material

Bringt die Person später weitere Dateien mit (neue Übernahme), gleiche sie mit der bestehenden Zusammenfassung im Projektkontext ab und liefere eine aktualisierte, vollständige `zusammenfassung`.
