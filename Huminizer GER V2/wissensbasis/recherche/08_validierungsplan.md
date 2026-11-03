# Validierungsplan für die nächste Projektphase

**Nicht durchgeführt.** Alle Stichprobengrößen, Bedingungen und Entscheidungskriterien unten sind Vorschläge. Diese Recherche enthält keine eigenen Detektorwerte oder gemessenen Skill-Verbesserungen.

## Die vier Zielgrößen

1. **Inhaltstreue:** Aussagen, Zahlen, Position, Bedingungen und offene Fragen bleiben korrekt.
2. **Leserwirkung:** Verständlichkeit, Angemessenheit und gewünschte Stimme.
3. **Sprachliche Verteilung:** Passung zum definierten Referenzbereich und Vielfalt über eine Textserie.
4. **Erkennung:** Leistung bestimmter benannter Detektoren bei festgehaltenem Stand und Schwellenwert.

Die Größen werden getrennt berichtet. Ein gemeinsamer Gesamtscore könnte verdecken, dass die Erkennung sinkt, während die Textqualität ebenfalls sinkt.

## Praktischer Pilot

**Eigener Planungsvorschlag:** Ein enges deutsches Register, zehn neue Schreibaufgaben, zwei menschliche Bearbeitungen je Aufgabe. Zwei dokumentierte Modelle bearbeiten dieselben Aufgaben mit drei Verfahren: Rohgenerierung, einfache Oberflächenregeln A und Profilansatz B. Je Bedingung zwei unabhängige Wiederholungen.

Rechenumfang: 10 Aufgaben × 2 menschliche Texte = **20 menschliche Texte**. 10 × 2 Modelle × 3 Verfahren × 2 Wiederholungen = **120 generierte Texte**, zusammen **140 Texte**.

Das ist ein Machbarkeitspilot. Die Zahl ist weder eine statistische Powerberechnung noch ausreichend für starke Aussagen über seltene Fehlalarme. Zuerst zeigt der Pilot, ob Aufgaben, Profile und Bewertungsfragen überhaupt funktionieren.

## Breiterer Versuch nach erfolgreichem Pilot

Vorgeschlagen werden drei Register mit je zehn Aufgaben, zwei menschlichen Bearbeitungen und drei Modellen. Bei drei Verfahren und zwei Wiederholungen entstehen **60 menschliche und 540 generierte Texte**, insgesamt 600. Der tatsächliche Bedarf richtet sich nach der Effektgröße des Piloten, Abhängigkeiten und gewünschter Unsicherheit.

Aufteilung vor der Entwicklung: sechs Aufgaben pro Register für Entwicklung, vier für Prüfung. Damit bleiben **12 Aufgaben**, **24 menschliche Texte** und **216 generierte Texte** vollständig für die erste Prüfung zurück. Verwandte Aufgaben, Paraphrasen und Textfamilien gehören immer in denselben Teil. Ein späterer zweiter Test verwendet neue Themen.

Die kleinen menschlichen Prüfgruppen sind ausdrücklich kein belastbarer Nachweis sehr niedriger Fehlalarmraten. Dafür braucht es einen zusätzlichen größeren Referenzsatz.

## Was der Grundversuch und was spätere Zusatzversuche prüfen

Der Grundversuch prüft Gesamtverfahren, nicht die isolierte Wirksamkeit jeder Komponente aus Datei 07. Für H1 braucht es einen ansonsten gleichen Auftrag mit und ohne passende Beispiele; ein generischer Auftrag „schreibe menschlicher“ ist eine weitere sinnvolle Ausgangsbedingung. Für H3 denselben Ablauf mit und ohne Erhaltungscheck vergleichen. Für H5 die Zahl der Revisionen kontrolliert variieren, beispielsweise null, eine und drei.

Diese Zusatzversuche sind **nicht** in den 140 beziehungsweise 600 Texten oben enthalten. Sie dürfen erst nach Ergänzung der Bedingungen, Mengenplanung und vorher festgelegten Auswertung als Tests dieser Einzelhypothesen bezeichnet werden.

## Referenztexte und Entstehung sauber dokumentieren

Menschliche Texte müssen eine nachvollziehbare Herkunft haben. „Im Internet gefunden“ genügt nicht als sichere Auskunft über ihre Entstehung. Alte Texte reduzieren manche Kontaminationsrisiken, führen aber einen Zeitunterschied ein. Neue eigens geschriebene Texte benötigen dokumentierte Hilfsmittel und Bearbeitungsschritte.

Einzelne fremde Beiträge oder private Texte werden nicht ohne passende Grundlage in Beispiele übernommen. Für die Studie reichen freiwillig bereitgestellte, selbst verfasste oder eindeutig passend nutzbare Texte. Es ist kein Hochladen in kommerzielle Detektoren erfolgt.

Geeignete Quellenkandidaten und ihre Grenzen stehen in [05](05_deutsche_sprache_und_datengrundlagen.md). In einem Familienkorpus muss die gesamte Familie zusammenbleiben, damit Schwesterfassungen nicht die Prüfung vereinfachen.

## Zwei unterschiedliche Aufgaben getrennt prüfen

**Neuschreiben:** Menschen und Modelle erhalten denselben Informationsstand, denselben Zweck und eine vergleichbare Umfangsvorgabe.

**Überarbeiten:** Derselbe Ausgangstext wird von Menschen oder Modellen redigiert. Original, Eingriff und Endfassung bleiben nachvollziehbar.

Diese Aufgaben nicht zu einem einzigen Label „KI“ vermengen. Ebenso getrennt erfassen: Rechtschreibkorrektur, Übersetzung, stilistische Überarbeitung und komplette Neufassung.

## Bedingungen festhalten

Pro Ausgabedatei mindestens dokumentieren:

```yaml
text_id: noch_zu_vergeben
aufgabenfamilie: noch_zu_vergeben
register: noch_zu_bestimmen
sprache_und_varietaet: de
entstehung: mensch_oder_dokumentierte_modellbedingung
modell_id_snapshot: null
generierungsdatum: null
systemanweisung: null
schreibauftrag: null
referenzprofil_version: null
verfahren: roh_oder_A_oder_B
sampling_parameter: null
wiederholung: null
eingriffe: []
zeichenzahl_und_woerter: null
datenteil: entwicklung_oder_pruefung
```

Dies ist ein leeres Erhebungsschema. Nicht verfügbare Modellparameter als „nicht offengelegt“ kennzeichnen, nicht aus dem Produktnamen erraten. Modellstände und Detektorstände gesondert versionieren.

## Leserbewertung

Reihenfolge randomisieren, Herkunft und Verfahren zunächst verbergen. Für jeden Text knapp bewerten lassen: Klarheit, Angemessenheit für den Anlass, Passung zur gewünschten Stimme, unnötige Formulierungen, Inhaltserhalt. Eine Skala von 1–5 ist ein möglicher Entwurf; die Anker müssen konkrete Beschreibungen enthalten.

Wenn dieselbe Person alle Fassungen einer Aufgabe sieht, kann sie Ähnlichkeiten erkennen. Deshalb Aufgaben und Fassungen sinnvoll auf Bewertende verteilen. Für ein Autorenprofil zusätzlich den tatsächlichen Autor befragen; dessen Urteil getrennt von unabhängigen Leserurteilen berichten.

„Wahrscheinlich KI?“ ist eine zusätzliche Frage. Sie darf den Eindruck bei der Qualitätsbewertung nicht vorab lenken. Ergebnisse mehrerer Bewertungen desselben Textes sind keine voneinander unabhängigen Texte.

## Merkmale messen

Vorab wenige Merkmale aus [06_merkmalskatalog.md](06_merkmalskatalog.md) auswählen. Messdefinition, Segmentierung und Normalisierung festhalten. Für deutsche Analysen zunächst eine kleine Stichprobe manuell prüfen: Satzgrenzen, Komposita, Wortarten, mehrdeutige Partikeln und Satzzeichenfunktionen.

Häufigkeiten bei variabler Länge zusätzlich pro 1.000 Wörter ausweisen. Ergänzend den Anteil von Texten mit dem Merkmal berichten; einzelne lange Dokumente dürfen den Gesamteindruck nicht unbemerkt bestimmen. Typen-Token-Verhältnisse nicht ohne Längenabgleich vergleichen. Effektgröße und Unsicherheit wichtiger nehmen als ein isoliertes Signifikanzetikett.

Erst nach vorheriger Auswahl bestätigen; zusätzliche nachträgliche Muster als explorativ kennzeichnen. Nicht aus hunderten Merkmalen nur die zufällig passenden herausgreifen.

## Detektoren fair auswerten

Detektorname, Version/Abrufzeit, Sprache, zulässige Textlänge, Schwellenwert und genaue Bedeutung der Ausgabe festhalten. Wenn ein Anbieter nur „Score“ sagt, daraus keine Prozentwahrscheinlichkeit oder Wortanteile ableiten. Ohne benennbaren Stand bleiben Wiederholungen eingeschränkt vergleichbar.

Mit KI als positiver Klasse gelten:

- **TPR/Recall = TP / (TP + FN):** Anteil erkannter KI-Texte.
- **FPR = FP / (FP + TN):** Anteil menschlicher Texte mit Fehlalarm.
- **Präzision = TP / (TP + FP):** Anteil richtiger KI-Zuordnungen unter den Markierungen.

Die Präzision hängt von der KI-Häufigkeit im Anwendungsszenario ab. Die hypothetische Rechnung dazu steht in [04](04_ki_detektoren.md). AUROC, Accuracy und Macro-F1 separat benennen; sie beantworten unterschiedliche Fragen.

Schwellen nur mit Entwicklungsdaten wählen. Anschließend auf zurückgehaltenen Daten festhalten. Reines Optimieren auf einen einzelnen Anbieter kann dessen Eigenheiten ausnutzen, ohne allgemein bessere Texte zu erzeugen. Deshalb zusätzliche Verfahren, unbekannte Themen und spätere Modellstände gesondert prüfen. Wasserzeichen und nachvollziehbare Entstehungsdaten sind eine andere Nachweisebene.

## Warum wenige menschliche Texte keine niedrige Fehlalarmrate beweisen

**Eigene statistische Ableitung unter vereinfachenden Annahmen:** Bei n unabhängigen, passend ausgewählten menschlichen Texten und null Fehlalarmen lautet die einseitige obere 95%-Grenze für die Fehlalarmwahrscheinlichkeit:

`p_oben = 1 - 0,05^(1/n)`

Bei n=60 ist sie ungefähr **4,87 %**; bei n=24 ungefähr **11,73 %**. Für eine Grenze von höchstens 1 % braucht es bei weiterhin null Fehlalarmen mindestens **299 unabhängige Texte**. Rechnung: `n >= ln(0,05) / ln(0,99)`.

Das ist kein Nachweis tatsächlicher Detektorleistung. Es setzt unter anderem unabhängige, repräsentative Beobachtungen und eine feste Entscheidungsschwelle voraus. Viele Texte desselben Autors oder derselben Aufgabenfamilie erfüllen diese Vereinfachung nicht ohne Weiteres. Schon ein Fehlalarm verändert die Rechnung.

## Auswertung und Abbruchkriterien

Vergleiche nach Aufgabe paaren; Unsicherheit auf der Ebene unabhängiger Aufgaben beziehungsweise Autoren berücksichtigen. Ergebnisse pro Register, Modell und Verfahren zeigen. Modellwiederholungen sind keine neuen menschlichen Autoren.

Eine Variante nicht freigeben, wenn sie neue falsche Fakten ergänzt, Positionen verändert oder die gewünschte Stimme regelmäßig überschreibt. Wenn nur bereits verwendete Aufgaben besser werden, sind die Regeln möglicherweise überangepasst. Bei widersprüchlichen Qualitäts- und Detektorwerten beide berichten und den Zielkonflikt offenlassen.

## Vorlage für den späteren Ergebnisbericht

```text
Fragestellung und vorab festgelegte Hypothese:
Material, Herkunft, Sprachen, Register:
Modelle, Stände, Parameter und Verfahren:
Unabhängige Aufgaben / Autoren / Texte:
Entwicklungs- und Prüfaufteilung:
Leserurteile mit Unsicherheit:
Inhalts- und Stimmenabweichungen:
Sprachliche Merkmale:
Detektorergebnisse einschließlich Fehlalarmen:
Übertragung auf neue Themen oder Modelle:
Ungeprüfte Bereiche:
Entscheidung und begrenzter Geltungsbereich:
```

Eine solche Prüfung kann die Leistung unter ihren Bedingungen bestätigen oder widerlegen. Kein endlicher Test bestätigt „alle Detektoren“ oder „exakt wie alle Menschen“.
