# Ableitungen für ein späteres Set von Schreib-Skills

Status: **Entwurf und Hypothesen, nicht implementiert oder getestet.** Grundlage sind die Fachkapitel; dieses Dokument enthält eigene Entwicklungsentscheidungen. Es ist kein Nachweis, dass ein bestimmtes Promptrezept menschliches Schreiben exakt reproduziert.

## Empfohlenes Entwicklungsziel

Ein Text soll für eine bestimmte Person, Lesergruppe und Situation natürlich wirken, dabei Informationen, Position und gewünschte Eigenheiten erhalten. Das Ziel benötigt einen beschriebenen Maßstab. „Klingt menschlich“ allein ist zu unbestimmt.

Detektorergebnisse können zusätzlich gemessen werden. Sie dürfen eine schlechtere Aussage, erfundene Erfahrungen oder eine beschädigte Stimme nicht als Erfolg verdecken. Die Unterscheidung zwischen sichtbarem Stil, statistischer Klassifikation und Wasserzeichen steht in [04_ki_detektoren.md](04_ki_detektoren.md).

## Drei ernsthafte Ansätze im Vergleich

Die Erwartungen in dieser Tabelle sind **Prognosen für dieses Projekt**, keine aus einem Vergleichsexperiment gewonnenen Rangplätze.

| Ansatz | Mechanismus | Erwarteter Nutzen / Aufwand | Kleinster widerlegender Test | Zentrale Grenze |
|---|---|---|---|---|
| A: Oberflächenregeln | Kandidatenwörter und Formatmuster prüfen; wenige lokale Änderungen | Geringer Aufwand, reproduzierbare Ausgangsbasis | Leser erkennen keine Verbesserung oder Inhalt wird ungenauer | Satzbau, Gedankenauswahl und Stimme können unverändert bleiben |
| B: Register- und Stimmenprofil | Passende Referenztexte und klare Kommunikationssituation | Voraussichtlich bessere Situationspassung; Aufwand für gute Beispiele | Wirkung verschwindet bei neuen Themen oder Profil wird nur kopiert | Unpassende Beispiele und inhaltliches Nachahmen |
| C: Profil plus getrennte Entwurfs- und Prüfschritte | Inhalt planen, formulieren, passend revidieren, Erhalt prüfen | Größere Eingriffsmöglichkeiten; mehr Bearbeitung und Prüfaufwand | Kein Mehrwert gegenüber B oder messbare Verluste durch Überarbeitung | Zu viele Schritte können alles in denselben Redaktionsstil glätten |

**Auswahl:** B als erste Hauptvariante entwickeln, A als einfache Vergleichsbedingung behalten. C nur ergänzen, wenn er in zurückgehaltenen Aufgaben gegenüber B einen messbaren Zusatznutzen liefert. Die Zerlegung in prüfbare Schritte ist sinnvoll; sie beweist noch nicht, dass mehrere Modellaufrufe besser sind als einer.

## Vorgeschlagene Module

Die Namen sind Arbeitsnamen, keine bereits installierten Skills.

| Modul | Eingang | Ergebnis | Erhaltungsbedingung |
|---|---|---|---|
| 1. Schreibsituation | Anlass, Leser, Medium, Zweck, Fakten | Knappes Schreibbriefing | Offene Informationen als offen behandeln |
| 2. Stimmenprofil | Autorisierte Beispiele und explizite Wünsche | Wenige belegte Stilpräferenzen mit Kontext | Keine Persönlichkeit aus Stereotypen erraten |
| 3. Inhaltsplanung | Briefing und Ausgangsmaterial | Relevante Aussagen in zweckmäßiger Reihenfolge | Zahlen, Position und Einschränkungen erhalten |
| 4. Formulierung | Plan, Register, Profil | Erster zusammenhängender Text | Keine erfundenen Erlebnisse oder Belege |
| 5. Kontextrevision | Text und Prüfkatalog | Lokale Verbesserung mit klarer Begründung | Nur ändern, wenn die Änderung dem Zweck dient |
| 6. Fakten- und Stimmenprüfung | Ausgangsmaterial und Endfassung | Fundierte Abweichungsliste oder Freigabe | Stilpassung ersetzt keine Inhaltsprüfung |

Für einfache Nachrichten können mehrere Module in einem Arbeitsgang erfolgen. Bei längeren Texten kann eine getrennte Prüfung hilfreicher sein. Der Aufwand sollte mit der Aufgabe wachsen.

## Was in ein Stimmenprofil gehört

Das Profil dokumentiert Entscheidungen anhand von Beispielen: Direktheit, Distanz zum Leser, bevorzugte Begriffe, erklärungsbedürftiges Vorwissen, Satzgestaltung, Umgang mit Unsicherheit, typische Eröffnungen und die Funktion des Schlusses. Es beschreibt zugleich erlaubte Abweichungen nach Situation.

Einzelne auffällige Stellen werden nicht sofort zur Regel. Wenn sich drei Beispiele widersprechen, ist möglicherweise das Register verschieden oder die Datenlage zu klein. Das Profil benötigt dann eine Bedingung oder den Vermerk „offen“.

Ein sinnvolles Entwicklungsartefakt wäre:

```text
Zielkontext:
Passende Referenztexte:
Gesicherte Stilpräferenzen mit Beispielstellen:
Situationsabhängige Varianten:
Zu erhaltende Begriffe und Eigenheiten:
Bekannte Verständnishürden:
Unbelegte Annahmen:
Zuletzt an neuen Aufgaben geprüft:
```

Die Vorlage ist ein eigener Entwurf. Sie wurde nicht aus einer Personenstudie als validiertes Messinstrument übernommen.

## Regeln, die aus der Forschung nicht automatisch folgen

- Kein Sollwert für Tippfehler, Gedankenstriche, Pronomen oder Satzlängenwechsel.
- Keine Pflicht, alle Sätze zu verkürzen oder jeden Fachausdruck zu ersetzen.
- Keine universelle Liste unerlaubter Wörter.
- Keine erfundenen persönlichen Geschichten als Natürlichkeitsersatz.
- Keine Pflicht, Absätze absichtlich ungleichmäßig oder Argumente unvollständig zu machen.
- Keine Annahme, dass ein niedriger Detektorscore die passende Stimme bestätigt.

Diese Grenzen sind eigene Qualitätsanforderungen, gestützt auf die Reichweiten und Gegenbefunde der Recherche. Die detaillierten empirischen Nachweise werden in den Fachkapiteln behandelt.

## Priorisierte Hypothesen

| Hypothese | Erwartete Beobachtung | Was sie widerlegen würde |
|---|---|---|
| H1: Passende Beispiele helfen mehr als ein generischer Auftrag „menschlicher“ | Bessere blinde Urteile zu Stimme und Angemessenheit | Kein reproduzierbarer Vorteil bei neuen Aufgaben |
| H2: Die richtige Schreibsituation ist wichtiger als Wortverbote allein | B schlägt A bei identischem Informationsmaterial | Nur die Wortregel erreicht denselben Nutzen mit weniger Fehlern |
| H3: Ein expliziter Erhaltungscheck reduziert Bedeutungsverschiebungen | Weniger sachliche/positionelle Abweichungen als ohne Check | Kein Unterschied oder zusätzliche Überarbeitung erzeugt Fehler |
| H4: Regeln müssen je Register ausgewählt werden | Unterschiedliche hilfreiche Eingriffe je Textsorte | Gleiche Regeln funktionieren in allen untersuchten Registern gleich gut |
| H5: Zu viel Revision glättet Stimmen | Nach mehreren Durchläufen sinkt die Unterscheidbarkeit passender Profile | Profile bleiben stabil und Qualitätsurteile steigen weiter |

Der Grundversuch in Datei 08 vergleicht zunächst die gesamten Ansätze A und B. Er isoliert nicht den Beitrag einzelner Komponenten. **H1, H3 und H5 benötigen spätere Zusatzexperimente:** passende Beispiele gegenüber einem ansonsten gleichen Auftrag, Erhaltungscheck mit/ohne und eine festgelegte Anzahl von Revisionsdurchläufen. Diese Zusatzbedingungen sind in den dortigen Mengenrechnungen nicht enthalten.

## Abnahmekriterien vor der Freigabe eines Skills

Die Kriterien sind **vorgeschlagene Projektentscheidungen**. Zahlenwerte müssen vor dem Hauptversuch festgelegt werden.

1. Unveränderte Pflichtinformationen und Position; keine neuen unbelegten Aussagen.
2. Verbesserung einer vorher benannten Leserbewertung gegenüber der Ausgangsbedingung.
3. Kein wesentlicher Verlust auf den anderen Qualitätsdimensionen.
4. Nachvollziehbare Wirkung auf zurückgehaltenen Aufgaben und mindestens einem zweiten Modellstand oder einer ausdrücklich begrenzten Modellfreigabe.
5. Dokumentierte Grenzen, insbesondere kurze Texte, unpassende Beispiele und unbekannte Textsorten.

Eine überprüfbare Freigabe lautet beispielsweise: „Für deutsche Supportantworten unter diesen Eingaben besser bewertet als die dokumentierte Ausgangsbedingung.“ Sie behauptet keine Ununterscheidbarkeit gegenüber allen Menschen oder Detektoren.

## Eigener Beitrag dieser Recherche

Die sprachlichen Beobachtungen stammen aus den Quellen. Neu für dieses Projekt zusammengestellt wurden der Merkmalskatalog, die Modulaufteilung, der Vergleich der Entwicklungswege und der Validierungsplan. Globale Neuheit wurde nicht festgestellt; die Elemente ähneln bekannten Verfahren aus Schreibdidaktik, Korpuslinguistik und Evaluation.

Nächster sachlicher Schritt: einen einzigen Zielkontext auswählen, passende Referenzen sammeln und A gegen B prüfen. Ablauf: [08_validierungsplan.md](08_validierungsplan.md).
