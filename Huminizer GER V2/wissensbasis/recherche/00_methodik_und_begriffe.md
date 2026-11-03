# Auftrag, Methode und Begriffe

Stand und Abrufdatum: **30. Oktober 2026**. Sprache der Dokumentation: Deutsch. Schwerpunkt: deutschsprachige Anwendung; internationale Forschung wird mit ihrem tatsächlichen Sprachbereich erfasst.

## Ergebnis, das diese Recherche liefern soll

Eine nachvollziehbare Wissensbasis für ein späteres Set von Schreib-Skills: Welche Merkmale treten in untersuchten KI-Texten auf? Wie unterscheidet sich menschliches Schreiben? Was lässt sich daraus für natürliche, situationsgerechte Texte ableiten? Welche Schlussfolgerungen über KI-Erkennung sind belastbar?

Der Auftrag ist Recherche und strukturierte Ablage. Die vorgeschlagene Skill-Architektur ist ein Entwurf, kein bereits implementiertes oder empirisch bestätigtes Skill-System. Es wurden hier keine eigenen Modelltexte erzeugt, keine Detektoren getestet und keine veröffentlichten Experimente nachgerechnet.

Das Projektziel „jeden KI-Detektor nutzlos machen“ bleibt eine unbestätigte Universalbehauptung. Ein überprüfbares Entwicklungsziel ist: definierte Textsorten und Autorenprofile besser treffen, bei unveränderter sachlicher Qualität; Erkennungsleistungen separat und unter dokumentierten Bedingungen untersuchen.

## Rechercheweg

Vier parallele Arbeitsbereiche: KI-Muster; menschliche Schreibweisen und direkte Vergleiche; Detektionsverfahren und Grenzen; deutsche Sprache, Datengrundlagen und Zusammenführung. Ausgangspunkt war die vom Nutzer bereitgestellte Datei „Research God (1).md“ mit dem Skill „Deep Invention“. Ihre Anweisungen wurden als methodische Hilfe gelesen; der Nutzerauftrag bestimmt die Leistung.

Gesucht wurde vor allem über wissenschaftliche Originalveröffentlichungen, Konferenzarchive, institutionelle Quellen, Datensatzdokumentationen und offizielle technische Veröffentlichungen. Zentrale Suchbegriffe waren unter anderem:

- `LLM writing linguistic features human register variation`
- `German human AI generated texts corpus`
- `Features and Detectability of German Texts Generated`
- `AI text detection multilingual false positives generalization`
- `LLM em dash excess vocabulary lexical diversity`
- `human AI writing grammatical rhetorical styles 2025 2026`

Suchtreffer dienten zum Auffinden. Fachliche Befunde stützen sich auf die geöffneten Originalseiten oder verfügbaren Originaltexte. Der genaue Zugriffsumfang steht in jeder Quellenkarte. Eine Abstract-Prüfung wird nicht als Volltextlektüre ausgegeben. Neuere Preprints werden getrennt von begutachteten Veröffentlichungen behandelt.

Diese Arbeit ist eine **gezielte, breite Literaturrecherche**, kein systematisches Review mit vollständiger Datenbanksuche, vorregistriertem Auswahlverfahren und PRISMA-Flussdiagramm. Die Auswahl kann Publikations-, Zugangs- und Sprachverzerrungen enthalten. Sie beansprucht keine vollständige Erfassung jedes Modells, jedes Wortes oder jeder bis zum Stichtag erschienenen Studie.

## Einschluss und Ausschluss

Aufgenommen: nachvollziehbares Untersuchungsdesign; klarer Bezug zu sprachlicher Form, menschlicher Variation oder Erkennung; prüfbare Originalquelle; Veröffentlichung bis zum Stichtag. Ältere Grundlagen bleiben nützlich, wenn ihre historische Reichweite benannt wird.

Ausgeschlossen als Beleg: unbelegte Wortlisten, virale Behauptungen, Werbung für „Humanizer“, Ranglisten ohne überprüfbares Testdesign und Suchmaschinen-Zusammenfassungen ohne bestätigten Originalinhalt. Herstellerdokumentation ist für Herstellerfunktionen geeignet, aber kein unabhängiger Wirksamkeitsnachweis. Mehrere Veröffentlichungen über denselben Datensatz gelten nicht automatisch als unabhängige Replikationen.

Die Recherche wurde nach Abdeckung der entscheidenden Themen und wichtiger Gegenbefunde begrenzt: sprachliche Merkmale, Modellabhängigkeit, menschliche Variation, deutsche Daten, Fehlalarme, Generalisierung, Mischtexte und Wasserzeichen. Weitere Treffer würden den Überblick erweitern; die zentralen offenen Fragen benötigen überwiegend eigene, kontrollierte Messungen.

## Vier Evidenzstufen

| Kennzeichen | Bedeutung | Beispiel für zulässige Aussage |
|---|---|---|
| **B: belegt** | Direkt in der bezeichneten Quelle beobachtet oder dokumentiert | „In diesem deutschen Nachrichtenkorpus verschlechterte sich die Übertragung auf andere Generatoren.“ |
| **A: abgeleitet** | Nachvollziehbare Schlussfolgerung aus Befunden | „Deshalb muss ein neuer Modellstand erneut geprüft werden.“ |
| **H: Hypothese** | Plausibler, noch unbestätigter Vorschlag | „Referenztexte könnten die gewünschte Autorenstimme besser vermitteln als eine Wortverbotsliste.“ |
| **O: offen** | Mit der vorliegenden Recherche nicht beantwortbar | „Wie groß ist der Effekt bei heutigen deutschen Kundenmails?“ |

„Belegt“ bedeutet hier **im untersuchten Geltungsbereich**, nicht allgemeingültig oder kausal bewiesen. Ein statistischer Zusammenhang kann durch Thema, Textlänge, Erhebungszeit, Prompt, Redaktion oder Trainingsdaten mitverursacht sein.

## Begriffe, die nicht zusammenfallen

| Begriff | Arbeitsdefinition |
|---|---|
| Natürlichkeit | Situationsgerechtes, idiomatisches und für die Zielgruppe plausibles Schreiben; durch Leserurteile zu operationalisieren |
| Menschlich verfasst | Aussage über den Entstehungsprozess, nicht über eine bestimmte Wortwahl |
| Autorenstimme | Wiederkehrende Entscheidungen einer Person in einem bestimmten Kontext; kein unveränderliches Sprachprofil |
| Register | Sprachliche Ausprägung passend zu Situation, Medium, Zweck und Beziehung der Beteiligten |
| KI-Signal | Merkmal mit einer gemessenen Verteilungsabweichung im jeweiligen Vergleich |
| Detektorscore | Ausgabe eines bestimmten Verfahrens unter bestimmten Bedingungen; nicht automatisch eine kalibrierte Urheberschaftswahrscheinlichkeit |
| Provenienz | Nachvollziehbare Information über die Entstehung oder Bearbeitung eines Textes |
| Wasserzeichen | Beim Generieren eingebautes technisches Signal; nicht identisch mit sichtbaren Stilvorlieben |
| Mischtext | Text mit mehreren menschlichen oder maschinellen Bearbeitungsschritten |

## Warum ein einzelnes Merkmal keinen Beweis liefert

Ein Merkmalsunterschied betrifft zunächst bedingte Verteilungen: Wie häufig ist Merkmal F in den verglichenen Texten? Für eine Aussage „dieser Text ist KI“ wären zusätzlich unter anderem Ausgangshäufigkeiten, ein validiertes Verfahren und seine Fehler unter passenden Bedingungen nötig. Diese Umkehrung wird in [04_ki_detektoren.md](04_ki_detektoren.md) erklärt.

Ein Autor kann häufig Gedankenstriche verwenden. Ein Modell kann keine verwenden. Ein informativer Text kann formelhaft sein; ein frei erfundener Text kann lebendig wirken. Inhaltstreue, Lesbarkeit, Stilpassung und Herkunft werden deshalb getrennt geprüft.

## Leseschlüssel

Quellen-IDs: **K** für KI-Muster, **M** für menschliches Schreiben, **D** für Detektion und **R** für die deutsche Datengrundlage. Die Quellenkarten nennen Zugriffsumfang, Untersuchungsbereich und Grenzen. Direkte Weblinks stehen in den Fachkapiteln; die thematischen Quellenregister stehen in [quellen/README.md](quellen/README.md).
