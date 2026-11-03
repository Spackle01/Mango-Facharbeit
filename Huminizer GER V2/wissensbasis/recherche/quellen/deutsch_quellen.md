# Quellenkarten: Deutsch und Datengrundlagen

Alle Quellen abgerufen am 30.10.2026. Karten beschreiben den tatsächlich geprüften Zugriff. „B“ gilt nur für den dokumentierten Bereich.

## R01 — Ruppert, Michael W. (2026): DeHAT v1

- **Typ:** Datensatz, Version 1.0.0, 25.09.2026; keine hier nachgewiesene Begutachtung.
- **Links:** [Zenodo](https://zenodo.org/records/22206304), [Projekt](https://miweru.github.io/dehat/).
- **Geprüft:** Veröffentlichungsseite und HTML-Dokumentation; Archive nicht heruntergeladen, Analysen nicht ausgeführt.
- **Design:** Deutsche Textfamilien; verschiedene Register und dokumentierte Modellbedingungen.
- **Nutzen:** Vergleich und kontrollierte Aufteilung zusammengehöriger Fassungen.
- **Grenzen:** Promptableitung durch ein Modell, quellenabhängige Rechte und Teilmengen, dokumentierte Bereinigung technischer Reste. „Spoken“ enthält laut Dokumentation auch schriftliche Beispielsatzgruppen und ist daher kein spontanes Gesprächskorpus.

## R02 — Irrgang et al. (2024): Features and Detectability of German Texts Generated with Large Language Models

- **Typ:** KONVENS-Konferenzbeitrag, S. 264–280.
- **Links:** [Metadaten](https://aclanthology.org/2024.konvens-main.27/), [Original-PDF](https://aclanthology.org/2024.konvens-main.27.pdf).
- **Geprüft:** Original-PDF, insbesondere Datendesign §3, Ergebnisse §4 und Tabelle 2.
- **Design:** Deutsche Genres; mehrere Generatoren; Tests mit unbekannter Quelle/Textart.
- **Befund:** Hohe Leistung innerhalb einer bekannten Quelle lässt sich nicht einfach auf andere übertragen.
- **Grenzen:** Historische Generatoren, unterschiedliche Sampling-Einstellungen, ältere menschliche Texte. F1-Werte aus unterschiedlichen Testmischungen sind keine allgemein gültigen Erfolgsquoten.

## R03 — Drackert, Horbach & Peters (2025): How good are LLMs in generating input texts for reading tasks in German as a foreign language?

- **Typ:** Forschungsartikel, Annual Review of Applied Linguistics 45, S. 222–252; online 11.09.2025.
- **Link:** [DOI/Originalseite](https://doi.org/10.1017/S0267190525000066).
- **Geprüft:** Englischer und deutscher Originalabstract; Volltextzugriff nicht erreicht.
- **Design:** Deutsche Prüfungstexte versus ChatGPT 3.5/4; linguistische Analyse und drei Expertinnen.
- **Befund:** Anpassungsbedarf gegenüber den Referenztexten in mehreren sprachlichen Bereichen.
- **Grenzen:** Abstract erlaubt keine eigenständige Prüfung von Effektgrößen, Stichprobenabgrenzung oder vollständiger Methodik. Keine Verallgemeinerung auf alle deutschen Texte.

## R04 — Liebe et al. (2026): Detecting and Comparing LLM Capabilities to Human Writers Through Linguistic Analysis

- **Typ:** Original Research, SN Computer Science 7, Artikel 621; 01.07.2026.
- **Link:** [Originalartikel](https://link.springer.com/article/10.1007/s42979-026-05131-0).
- **Geprüft:** Volltextabschnitte zu Methode, Dataset, Ergebnissen und Grenzen.
- **Design:** unCover, Nachrichten auf Englisch/Deutsch; Stilometrie mit Zeichen-, Wort- und syntaktischen Trigrammen sowie Themenentwicklung.
- **Befund:** Erklärbare Klassifikation ist unter den untersuchten Bedingungen möglich.
- **Grenzen:** Nachrichten und begrenzte menschliche Autorenbasis; deutsche Daten von 2024; kein Beleg für aktuelle Detektoren oder allgemeine deutsche Autorenschaftserkennung.

## R05 — Rat für deutsche Rechtschreibung / IDS (2024): Amtliches Regelwerk, E Zeichensetzung

- **Typ:** Normative Primärquelle, keine KI-Studie.
- **Link:** [Regelwerk im IDS-System](https://grammis.ids-mannheim.de/rechtschreibung/6198).
- **Geprüft:** Offizielle Einleitung zur Zeichensetzung und Inhaltsgliederung; direkte Gedankenstrich-Unterseite wiederholt nicht abrufbar.
- **Befund:** Zeichensetzung gliedert grammatisch und kommunikativ; Gedankenstriche sind reguläre Zeichen für entsprechende Funktionen.
- **Grenzen:** Keine empirische Häufigkeitsanalyse, keine Aussage über KI-Detektion. Die Norm belegt die sprachliche Funktion, nicht die Verteilung zwischen Autoren oder Modellen.

## R06 — Leibniz-Institut für Deutsche Sprache: Korpus des Projekts Korpusgrammatik

- **Typ:** Institutionelle Datendokumentation; Seite zuletzt geändert 09.09.2021.
- **Link:** [KoGraUK](https://grammis.ids-mannheim.de/korpusgrammatik/6615).
- **Geprüft:** Originalseite.
- **Design:** DeReKo-Ausschnitt, Release 2017-II; stratifizierte Dokumentmetadaten.
- **Nutzen:** Menschliche Referenztexte nach dokumentierten Merkmalen auswählen.
- **Grenzen:** Diese konkrete Ressource ist zeitgebunden und keine Gesamtbeschreibung aller menschlichen deutschen Schreibweisen; Daten hier nicht abgefragt oder ausgewertet.

## R07 — Steyer & Brunner / IDS (2025): Syntagmatikon, Korpora

- **Typ:** Institutionelle Beschreibung einer Korpusressource.
- **Link:** [Korpora im Syntagmatikon](https://syntagmatikon.ids-mannheim.de/corpora/).
- **Geprüft:** Originalseite zu Datengrundlage und Verfahren.
- **Design:** Ressourcen zu wiederkehrenden Ausdrücken und Gebrauchsmustern, überwiegend auf DeReKo-Teilkorpora.
- **Nutzen:** Idiomatik und typische Wortverbindungen im Kontext untersuchen.
- **Grenzen:** Teilkorpus, Zeitraum und Abfragesystem beeinflussen Treffer. Hier erfolgten keine einzelnen Korpusabfragen. Kein KI-Detektor und kein universeller Qualitätsmaßstab.
