# KI-Textdetektoren: Was sie erkennen und was ihre Ergebnisse bedeuten

Recherchestand: 30.10.2026. Literaturauswertung, keine eigenen Detektortests. Quellenkarten: [Detektoren](quellen/detektoren_quellen.md).

## Ergebnis für das Projekt

Ein Schreib-Skill kann die Qualität, Natürlichkeit und Passung eines Textes verbessern. Aus einem niedrigen Detektorwert folgt jedoch weder menschliche Urheberschaft noch eine Garantie für andere Detektoren. Umgekehrt belegt ein hoher Wert keine bestimmte Entstehungsgeschichte. Diese Schlussfolgerung ergibt sich aus den unterschiedlichen Zielgrößen, Verteilungswechseln und Mischtextbefunden der unten dokumentierten Arbeiten.

Die zwei pauschalen Behauptungen „KI-Texte sind immer erkennbar“ und „Detektoren sind grundsätzlich nutzlos“ werden durch die ausgewertete Literatur nicht getragen. Prüfbare Projektziele sind enger: Qualität für eine festgelegte Zielgruppe, Treue zu einem vorgegebenen Autorenprofil und dokumentierte Ergebnisse für ausdrücklich benannte Prüfbedingungen.

## 1. Vier verschiedene Fragen

| Verfahren | Tatsächlich untersuchte Frage | Aussagegrenze |
|---|---|---|
| Textklassifikation | Ähnelt der Text Beispielen aus der menschlichen oder maschinellen Vergleichsverteilung? | Eine statistische Zuordnung rekonstruiert keinen Schreibprozess. |
| Generatives Wasserzeichen | Passt die Tokenfolge zum Signal eines bestimmten Generators und Schlüssels? | Nicht alle Generatoren verwenden dasselbe Verfahren oder denselben Schlüssel. |
| Abgleich gespeicherter Ausgaben | Findet sich eine entsprechende Ausgabe in einem zugänglichen Register? | Der Nachweis hängt von Abdeckung und Zugriff ab. |
| Signierte Herkunftsmetadaten in Dateien | Welche Dateibearbeitung bescheinigt eine überprüfbare Signatur? | Eine vorhandene Bescheinigung und ein fehlender Eintrag haben unterschiedliche Beweiskraft; gewöhnlicher Fließtext trägt nicht automatisch solche Dateimetadaten. |

Die Einteilung ist eine eigene Zusammenfassung der in [D06](https://arxiv.org/html/2303.11156v4), [D10](https://pmc.ncbi.nlm.nih.gov/articles/PMC11499265/), [D11](https://www.anthropic.com/news/claude-text-watermark) und [D12](https://support.claude.com/en/articles/16266773-how-claude-marks-ai-generated-content) beschriebenen Mechanismen. D12 beschreibt auch signierte Metadaten für unterstützte Dateien. Ein gewöhnlicher Gedankenstrich ist kein generatives Wasserzeichen.

## 2. Funktionsweise statistischer Detektoren

**Perplexität** beschreibt vereinfacht, wie überraschend eine Tokenfolge für ein bestimmtes Referenzmodell ist. Sie ist eine Eigenschaft des Textes **unter diesem Modell**, kein direkt gemessener Menschlichkeitswert. Tokenisierung, Sprache und Referenzmodell gehören deshalb zur Messdefinition.

**DetectGPT** bewertet, wie sich die Log-Wahrscheinlichkeit einer Passage gegenüber automatisch erzeugten kleinen Varianten verhält. Das Verfahren verwendet Wahrscheinlichkeiten des interessierenden Sprachmodells und ein weiteres Modell für die Varianten; es ist kein Wörterbuch auffälliger Formulierungen. Die Originalarbeit berichtet unter anderem einen Vorteil gegenüber einer einfachen statistischen Vergleichsmethode auf GPT-NeoX-Nachrichtentexten. Das ist ein experimentgebundener Befund. [D01, ICML 2023](https://proceedings.mlr.press/v202/mitchell23a.html)

**Binoculars** setzt Bewertungen durch zwei verwandte Sprachmodelle ins Verhältnis. Die Autoren berichten in ihren Testbedingungen mehr als 90 % erkannte maschinelle Texte bei 0,01 % Fehlalarmen. Zugleich dokumentieren sie schwache Erkennungsraten in mehreren weniger gut abgedeckten Sprachen und untersuchen keine gezielten Umgehungsversuche. Hohe Leistung in diesem Benchmark ist daher mit relevanten Grenzen vereinbar. [D02, Version 13.10.2024, §§ 3–6](https://arxiv.org/html/2401.12070v3)

**Trainierte Klassifikatoren** lernen die Trennung anhand gelabelter Beispiele, etwa durch Anpassung eines Sprachmodells. Ihre Merkmale können Wortfolgen und komplexere Repräsentationen umfassen. Die Annahme, jeder Detektor messe lediglich Perplexität oder Satzlängenschwankungen, ist zu eng. [D08, § 2](https://aclanthology.org/2025.genaidetect-1.27.pdf)

**Für die Skill-Entwicklung abgeleitet:** Das Entfernen einiger Wörter oder Satzzeichen ist kein vollständiges Modell dessen, was ein Detektor auswertet. Auch ein überzeugender Autorenstil und ein niedriger Klassifikatorwert sind verschiedene Messziele.

## 3. Robuste Befunde und ihre Reichweite

### 3.1 Unbekannte Modelle, Textsorten und Generierungseinstellungen

RAID umfasst über sechs Millionen generierte Varianten aus elf Modellen, acht Domänen, vier Decodierungsstrategien und elf Arten veränderter Texte. Die Auswertung von zwölf Detektoren zeigt deutliche Abhängigkeiten von Generator, Domäne und Generierungseinstellungen. Das Kernexperiment vergleicht Treffer bei einem auf menschlichen Vergleichstexten kalibrierten Zielwert von 5 % Fehlalarmen. Diese Kalibrierung ist keine allgemeine Einsatzempfehlung für eine akzeptable Fehlerquote. [D03, ACL 2024, §§ 3–6](https://aclanthology.org/2024.acl-long.674.pdf)

**Einordnung:** Eine Herstellerzahl und eine wissenschaftliche Kennzahl sind nur dann vergleichbar, wenn Testmenge, Modellstand, Schwelle und Fehlerdefinition passen. RAID belegt Schwächen der dort geprüften Versionen; es ist keine aktuelle Rangliste kommerzieller Produkte.

### 3.2 Nichtmuttersprachliche Texte: wichtiger Befund, keine universelle Regel

Liang et al. prüften 2023 sieben damalige Detektoren an 91 englischen TOEFL-Aufsätzen und 88 Aufsätzen US-amerikanischer Achtklässler. Bei den TOEFL-Texten betrug die durchschnittliche Falsch-Positiv-Rate 61,22 %. Die Gruppen unterscheiden sich allerdings auch in Schreibaufgabe und Herkunft des Korpus; die Studie allein isoliert keine allgemeine Wirkung der Muttersprache. [D04, Ergebnisabschnitt](https://arxiv.org/html/2304.02819v3)

Eine Nachuntersuchung von 2026 kommt für **Tschechisch** und die dort geprüften Detektorfamilien zu keinem systematischen Nachteil nichtmuttersprachlicher Autoren. Ihre Daten umfassen unter anderem je 450 nichtmuttersprachliche und jugendliche muttersprachliche Aufsätze; beim kommerziellen Detektor wurden aus Zugriffsgründen kleinere Teilmengen geprüft. In einem englischen Zusatzvergleich blieb dagegen eine Differenz bestehen. Eine Übertragung auf andere Sprachen muss deshalb gesondert geprüft werden; die englische Warnung bleibt relevant. [D05, §§ 3, 5 und 7](https://aclanthology.org/2026.eacl-srw.20.pdf)

**Abgeleitet:** Deutsch, Englisch, Sprachlernertexte und regionale Varietäten brauchen getrennte Prüfungen. Weder „Sprachlerner werden immer benachteiligt“ noch „das Problem wurde gelöst“ ist eine tragfähige Zusammenfassung.

### 3.3 Mehrsprachige Leistung

Der GenAI-Shared-Task von 2025 nutzt über Training und Evaluation hinweg 21 Sprachen und mehrere Domänen sowie Generatoren. Die jeweils besten offiziellen Ergebnisse betrugen 83,07 Macro-F1 für Englisch und 79,16 für die mehrsprachige Aufgabe. Das sind aggregierte Benchmarkwerte, keine Wahrscheinlichkeit für die Urheberschaft eines einzelnen deutschen Textes. [D08, Tabellen 4 und 6](https://aclanthology.org/2025.genaidetect-1.27.pdf)

Deutsch muss zusätzlich nach Textsorte und Textlänge untersucht werden. Das gilt auch dann, wenn es in einem mehrsprachigen Benchmark vertreten ist. Die vertiefte deutsche Evidenz steht in [05_deutsche_sprache_und_datengrundlagen.md](05_deutsche_sprache_und_datengrundlagen.md).

### 3.4 Redaktion und Mischtexte

MIXSET umfasst 3.600 Mischtextbeispiele: unter anderem KI-Überarbeitung menschlicher Vorlagen und menschliche Eingriffe in generierte Texte. Die getesteten Detektoren hatten besonders bei feinen Änderungen und Stilwechseln Schwierigkeiten. Teile der Überarbeitung wurden automatisiert mit GPT-4 und Llama 2 erzeugt; die Ergebnisse bilden deshalb nicht jeden menschlichen Redaktionsprozess ab. [D09, §§ 3–5](https://aclanthology.org/2024.findings-naacl.29.pdf)

**Abgeleitet:** Vor jedem Test muss das Ziel-Label feststehen. „Irgendeine KI-Beteiligung“, „überwiegend generiert“, „sprachlich korrigiert“ und „menschlich verantworteter Inhalt“ sind keine austauschbaren Kategorien. Ohne diese Festlegung bleibt sogar die Bedeutung eines Fehlalarms unklar.

## 4. Kennzahlen: Warum ein hoher Score leicht falsch gelesen wird

Die folgenden Definitionen und Rechnungen sind eine eigene methodische Darstellung:

- **TPR / Sensitivität:** Anteil tatsächlich generierter Texte, die erkannt werden.
- **FPR / Falsch-Positiv-Rate:** Anteil menschlicher Texte, die fälschlich markiert werden.
- **Präzision / positiver Vorhersagewert:** Anteil tatsächlich generierter Texte unter allen markierten Texten.
- **AUROC:** Trennleistung über verschiedene Schwellen. Sie sagt nicht direkt, wie viele Fehlalarme eine ausgewählte Schwelle produziert.
- **F1:** Verknüpft Präzision und Sensitivität. Macro-F1 mittelt Klassenwerte; die Kennzahl ersetzt weder gruppenspezifische Fehlerquoten noch Kalibrierung.
- **Kalibrierung:** Ein als Wahrscheinlichkeit ausgegebener Wert soll zu beobachteten Häufigkeiten passen. Ein bloßer Rohscore oder ein markierter Textanteil ist nicht automatisch eine kalibrierte Wahrscheinlichkeit.

### Rechenbeispiel zum Basisratenproblem

**Vollständig hypothetisch, kein Test eines realen Produkts.** Angenommen, ein Detektor erkennt 90 % der KI-Texte und markiert 5 % der menschlichen Texte falsch. Bei 10.000 Dokumenten ergibt sich:

| Tatsächlicher KI-Anteil | Richtig markierte KI-Texte | Falsch markierte menschliche Texte | Tatsächliche KI-Texte unter den Markierungen |
|---|---:|---:|---:|
| 1 % | 90 | 495 | 15,38 % |
| 5 % | 450 | 475 | 48,65 % |
| 50 % | 4.500 | 250 | 94,74 % |

Für den ersten Fall: 100 KI-Texte × 0,9 = 90 Treffer; 9.900 menschliche Texte × 0,05 = 495 Fehlalarme. Präzision = 90 / (90 + 495) = 15,38 %.

Allgemein, mit KI-Anteil `p`, Sensitivität `t` und Fehlalarmrate `f`:

`Präzision = (p × t) / ((p × t) + ((1 − p) × f))`.

Die Grundgesamtheit verändert die Bedeutung einer Markierung erheblich, obwohl die angenommenen Detektoreigenschaften gleich bleiben. Die Rechnung wurde rechnerisch nachvollzogen; daraus folgt kein empirischer Produktbefund.

## 5. Theoretische Grenzen: zwei scheinbar widersprüchliche Ergebnisse

Sadasivan et al. begrenzen die maximal mögliche AUROC anhand der Totalvariationsdistanz zwischen menschlicher und maschineller Textverteilung. Je ähnlicher diese Verteilungen unter den mathematischen Annahmen sind, desto enger wird die Grenze. Die Arbeit enthält außerdem empirische Belastungstests. Entscheidend: Sie misst nicht, dass ein heute verfügbarer Schreib-Skill bereits eine hinreichend kleine Distanz zur gesamten menschlichen Verteilung erreicht. [D06, Version 17.01.2025, § 4](https://arxiv.org/html/2303.11156v4)

Chakraborty et al. betonen die Gegenrichtung: Solange Unterschiede verbleiben, kann unter ihren Annahmen ausreichend viel Text oder eine ausreichende Zahl von Beobachtungen eine Trennung ermöglichen. Sie analysieren Datenmengen und Textlängen und ergänzen dies mit Experimenten. Die Aussage ist keine Zusicherung, dass ein beliebiger kurzer Einzeltext korrekt erkannt wird. [D07, ICML 2024](https://proceedings.mlr.press/v235/chakraborty24a.html)

**Auflösung, abgeleitet:** Ähnlichere Verteilungen erschweren die Erkennung bei gegebenen Beobachtungen; zusätzliche geeignete Beobachtungen können verbleibende Unterschiede besser sichtbar machen. „Es gibt theoretische Grenzen“ bedeutet deshalb weder „jedes Verfahren scheitert“ noch „es existiert ein universeller Umgehungs-Skill“.

## 6. Wasserzeichen und Herkunftssignale sind ein eigener Fall

SynthID-Text verändert die Auswahl während der Generierung und hinterlässt ein mit passendem Schlüssel prüfbares statistisches Signal. Es benötigt keinen sichtbaren Stilmarker. Die Nature-Arbeit von 2024 untersucht Qualität und Erkennbarkeit in mehreren Modellen sowie Nutzerfeedback aus nahezu 20 Millionen Gemini-Antworten. Diese Qualitätsprüfung ist kein Nachweis unfehlbarer Erkennung beliebiger Texte. [D10, Methoden und Ergebnisse](https://pmc.ncbi.nlm.nih.gov/articles/PMC11499265/)

Anthropic beschreibt in seiner Ankündigung vom 14.08.2026, aktualisiert am 01.09.2026, eine SynthID-Text-Variante ohne versteckte Zeichen. Die Ankündigung ist als historischer Einführungsstand zu lesen. Sie beschreibt eine Nachweis-API in privater Vorschau für berechtigte Organisationen. [D11, Systembeschreibung](https://www.anthropic.com/news/claude-text-watermark)

**Aktualisierung zum Abruf am 30.10.2026:** Das Help Center weist bereits mehrere neuere und ältere Modellversionen mit aktiven Textwasserzeichen aus; der Status gilt je Modell und unterstützter Oberfläche. Ein erkanntes Signal kann auf Claude-Beteiligung hinweisen, bestätigt aber nicht die vollständige Entstehungsgeschichte oder menschliche Urheberschaft. Fehlender Nachweis schließt KI-Beteiligung nicht aus. Das sind **Herstellerangaben**, hier nicht unabhängig getestet. [D12, aktuelle Modellliste und Grenzen](https://support.claude.com/en/articles/16266773-how-claude-marks-ai-generated-content)

**Abgeleitet:** Natürlich klingendes Schreiben und das Fehlen sichtbarer KI-Muster schließen ein Herkunftssignal nicht aus. Ein Skill, der allein Stilmerkmale verändert, kann deshalb keine Aussage über sämtliche Nachweisverfahren tragen.

## 7. Anforderungen an eine spätere Projektevaluation

Die folgenden Anforderungen sind eine eigene Synthese; sie wurden hier noch nicht experimentell umgesetzt:

1. **Zielkategorie definieren:** Vollgeneration, Korrektur, Übersetzung und gemeinsame Redaktion separat erfassen.
2. **Menschliche Referenzen sichern:** Entstehung und erlaubte Hilfsmittel dokumentieren; öffentliche Texte nach 2022 nicht automatisch als ausschließlich menschlich behandeln.
3. **Aufgaben vergleichbar halten:** Sprache, Thema, Textsorte, Zielgruppe und Länge abstimmen. Keine Trennung zwischen menschlichen Chats und maschinellen wissenschaftlichen Aufsätzen als allgemeinen Erfolg verkaufen.
4. **Autoren und Themen trennen:** Varianten derselben Vorlage gehören in denselben Datensplit. Autoren und Themen für spätere Prüfungen zurückhalten.
5. **Schwellen vorher festlegen:** Auf separaten Daten kalibrieren. Detektoren, Modellversionen und Prüfdatum protokollieren.
6. **Fehler vollständig berichten:** Konfusionsmatrix, TPR, FPR und Unsicherheit; zusätzlich getrennte Ergebnisse für Sprache, Textsorte, Länge und relevante Autorengruppen.
7. **Übertragbarkeit prüfen:** Neue Themen und Modelle sowie eine spätere Messrunde zurückhalten. Ein einzelner Detektor darf nicht zugleich Optimierungsziel und einziger Erfolgsnachweis sein.
8. **Qualität unabhängig bewerten:** Blindurteile zu Verständlichkeit, Inhaltstreue, Register und Autorenprofil; Detektorwerte separat dokumentieren.

## Evidenzstatus und offene Fragen

| Status | Aussage |
|---|---|
| **Belegt, begrenzter Geltungsbereich** | Es gibt leistungsfähige Detektionsverfahren und dokumentierte Robustheitsprobleme. Beide Aussagen treffen je nach Bedingungen zu. |
| **Belegt, sprachabhängig** | Der englische Bias-Befund von 2023 und die tschechische Nachuntersuchung von 2026 dürfen nicht zu einem universellen Sprachgesetz verschmolzen werden. |
| **Abgeleitet** | Ein positiver Einzelwert braucht Kontext; ein negativer Einzelwert garantiert keine menschliche Herkunft. |
| **Hypothese für das Projekt** | Ein aus Referenztexten abgeleitetes Autorenprofil könnte die wahrgenommene Natürlichkeit besser steigern als allgemeine Verbotslisten. Das muss unabhängig geprüft werden. |
| **Offen** | Wie wirken spätere Skills auf deutsche Kurztexte, längere Artikel, persönliche Profile und Mischtexte bei unbekannten aktuellen Detektoren? |
| **Nicht geleistet** | Keine aktuellen kommerziellen Detektoren auf eigenen Texten geprüft; keine menschliche Blindstudie und kein eigener Wasserzeichentest durchgeführt. |

Der belastbare Anspruch des Projekts lautet damit: überprüfbar bessere, kontextgerechte Texte mit dokumentierten Messbedingungen. Eine Garantie für „jeden KI-Detektor“ bleibt unbelegt.
