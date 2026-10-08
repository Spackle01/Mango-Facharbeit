---
name: abgabe-pruefen
description: Die Facharbeit oder einzelne Teile (Exposé, Kapitel, Verzeichnisse, Anhang) gegen die verbindlichen Schulvorgaben prüfen und einen Prüfbericht mit konkreten nächsten Schritten erstellen. Nutzen vor Konsultationen und vor der Abgabe.
---

<!-- mango-facharbeit:verwaltet – erstellt aus der Handreichung zur Facharbeit (SJ 2026/2027), der Zeitschiene und den Bewertungsbögen -->

# Abgabe prüfen

Nutze diesen Skill, wenn die Person wissen will, ob ihre Arbeit oder ein Teil davon den Vorgaben entspricht, und vor jeder Konsultation sowie vor der Abgabe am **07.12.2026 bis 16:00 Uhr**.

Grundlage ist `00_vorgaben/anforderungen.md`. Lies die Datei zuerst. Prüfe nur gegen Vorgaben, die dort stehen. Empfehlungen [E] meldest du als Hinweis, nicht als Fehler.

## 1. Material sammeln

- Entwurfsdateien in `05_facharbeit_entwurf/` (bei mehreren Versionen die neueste, z. B. `_v3` vor `_v2`; frag nach, wenn unklar ist, welche gilt).
- Exposé in `02_expose_und_zeitplan/`, Literaturliste in `03_literatur_und_quellen/`, Eigenanteil in `04_forschung_und_eigenanteil/`, KI-Nachweise in `07_ki_prompts_anhang/`.
- Liegt die Arbeit als Word- oder PDF-Datei vor, nutze den Textauszug unter `.facharbeit/extrakte/`.
- Fehlt ein Teil, ist das ein Befund („fehlt“), kein Grund abzubrechen.

## 2. Prüfpunkte

### Inhalt und Aufbau
- Zentrale Fragestellung oder These klar formuliert und im Schluss beantwortet bzw. bestätigt oder widerlegt.
- Bezug zu zwei Fächern, Profilfach durchgehend erkennbar.
- Einleitung: Problem, Relevanz, Abgrenzung, Methode, Überblick über die Gliederung.
- Hauptteil: Begriffsdefinitionen, fachliche Grundlagen, Methode, **Eigenanteil deutlich sichtbar**, Ergebnisse.
- Schluss: Zusammenfassung, Bewertung, ggf. Ausblick.
- Gliederung: Dezimal- oder gemischte Klassifikation; bei Untergliederung **mindestens zwei Unterpunkte**; kurze, inhaltsbezogene Überschriften.

### Umfang
- Einleitung, Hauptteil und Schluss zusammen **10 bis 15 Seiten**.
- Anteile: Einleitung **höchstens 10 %**, Hauptteil ca. 80 %, Schluss ca. 10 %.
- Aus Markdown lässt sich die Seitenzahl nur schätzen. Zähle die Wörter je Teil und rechne mit etwa 350 bis 420 Wörtern pro Seite (A4, 11 pt, 1,5-zeilig, Ränder nach Vorgabe). Kennzeichne das Ergebnis als Schätzung und empfiehl die Kontrolle in Word.
- Exposé: **mindestens 400 Wörter, höchstens zwei A4-Seiten**.

### Zitieren und Quellen
- Jede Übernahme belegt. Kurzbeleg im Text: `„…“ (Autor Jahr, S. X)` bzw. `(Vgl. Autor Jahr, S. X)`, `ebd.` bei direkter Wiederholung.
- Direkte Zitate in Anführungszeichen mit Seitenangabe.
- Jeder Kurzbeleg hat einen Eintrag im Literaturverzeichnis und umgekehrt (Abgleich als Liste ausgeben).
- Literaturverzeichnis alphabetisch, Format nach Handreichung 4.4.3, Internetquellen mit URL und Zugriffsdatum, ab vier Autoren „et al.“.
- Keine KI-Ausgabe als Beleg. Vage Belege („Studien zeigen“) ohne Quelle melden.
- Quellen, die nicht auffindbar wirken oder unvollständig sind, als „prüfen“ markieren. Nicht stillschweigend ergänzen.

### KI-Nutzung
- Kennzeichnung „Erstellt mithilfe von [KI-Tool]. Prompt 1: …“ an den betroffenen Stellen.
- KI-Tools im Literaturverzeichnis als Hilfsmittel (`Hilfsmittel (Name des KI-Tools): URL, Datum des letzten Zugriffs.`).
- Vollständige Gesprächsverläufe als Anlage vorhanden (die App exportiert sie nach `07_ki_prompts_anhang/`).

### Bestandteile
- Titelblatt ohne Seitenzahl mit: Schule, „Facharbeit im Fach … mit Bezug zum Fach …“, Titel, Verfasser, Klasse, Schuljahr, Betreuer, Ort, Datum.
- Inhaltsverzeichnis mit Seitenzahlen, inklusive Verzeichnissen und Anlagen.
- Quellen- und Literaturverzeichnis.
- Anlagenverzeichnis; jede Anlage mit Überschrift, nummeriert, im Text referenziert.
- Selbständigkeitserklärung im **unveränderten Wortlaut** der Handreichung 4.3.3 (Wort für Wort vergleichen), mit Ort, Datum und Unterschrift.

### Form (nur teilweise prüfbar)
- In Markdown sichtbar: Abbildungen mit Unterschrift und Tabellen mit Überschrift, jeweils nummeriert.
- Nur in Word prüfbar, deshalb als „in Word prüfen“ ausgeben: A4 einseitig; Arial 11 pt, Calibri 11 pt oder Times New Roman 12 pt; Zeilenabstand 1,5; Fußnoten 9 pt einzeilig; Rand links 2,5 cm, sonst 2,0 cm; Seitenzahl oben zentriert ab Einleitung; Silbentrennung.

### Sprache
- Fachsprache, sachlich, präzise; Ich-Form nur in Einleitung und Schluss passend. Für eine genaue Prüfung den Skill `sprachpruefung` verwenden.

### Abgabe (Hinweise, außerhalb der App)
- 1× gedruckt im Sekretariat; digital als Word **und** PDF mit allen Anhängen und eingescannter, unterschriebener Erklärung auf Teams; Nachweis- und Betreuungsheft.

## 3. Bericht

Gib den Bericht kompakt aus:

```
Prüfbericht <Teil oder Gesamtarbeit>, Stand <Datum>

Ergebnis: <ein Satz>

| Prüfpunkt | Ergebnis | Fundstelle | Nächster Schritt |
|---|---|---|---|
| … | erfüllt / teilweise / fehlt / in Word prüfen | Datei, Abschnitt | … |

Wichtigste drei Schritte bis zur Abgabe:
1. …
```

Biete an, den Bericht als Datei zu speichern (z. B. `05_facharbeit_entwurf/pruefbericht_2026-11-20.md`).

## 4. Arbeitsstand

Aktualisiere den Arbeitsstand nur für Prüfpunkte, die du tatsächlich geprüft hast:

- vollständig erfüllt und belegt → `erledigt` mit `nachweis` (Datei und Prüfergebnis);
- teilweise → `in_arbeit` mit kurzer Notiz, was fehlt;
- Aufgaben außerhalb der App (Unterschrift, Abgabe, Konsultationen) nie selbst auf `erledigt` setzen.
