# Quellenkarten: KI-Textdetektoren

Geprüft am 30.10.2026. Primärquellen; keine vollständige systematische Literaturübersicht. „Geprüft“ bezeichnet das tatsächlich geöffnete Material, nicht die Reproduktion der Experimente. Die Karten und der [Fachtext](../04_ki_detektoren.md) paraphrasieren die Befunde knapp. Es wurden keine Detektordienste mit Nutzertexten beschickt.

## D01 · DetectGPT

- **Titel / Autoren / Jahr:** *DetectGPT: Zero-Shot Machine-Generated Text Detection using Probability Curvature*. Eric Mitchell, Yoonho Lee, Alexander Khazatsky, Christopher D. Manning, Chelsea Finn; ICML 2023.
- **Original:** [PMLR-Veröffentlichung](https://proceedings.mlr.press/v202/mitchell23a.html).
- **Geprüft:** Offizielle Veröffentlichungsseite mit Abstract und Metadaten; keine eigenständige Detailprüfung sämtlicher PDF-Tabellen.
- **Design und Befund:** Wahrscheinlichkeitsvergleich zwischen Originalpassage und Modellvarianten; unter anderem englische GPT-NeoX-Nachrichtentexte. Die Auswertung zeigt einen Vorteil gegenüber einer einfachen Vergleichsmethode.
- **Grenzen:** Modellzugriff und experimentelle Bedingungen sind Teil des Ergebnisses. Kein allgemeiner Menschlichkeitswert; begrenzte Aktualität für heutige Modelle.

## D02 · Binoculars

- **Titel / Autoren / Jahr:** *Spotting LLMs With Binoculars: Zero-Shot Detection of Machine-Generated Text*. Abhimanyu Hans, Avi Schwarzschild, Valeriia Cherepanova, Hamid Kazemi, Aniruddha Saha, Micah Goldblum, Jonas Geiping, Tom Goldstein; 2024.
- **Original:** [arXiv v3, 13.10.2024](https://arxiv.org/html/2401.12070v3).
- **Geprüft:** HTML-Volltext, insbesondere §§ 3–6: Mechanismus, Sprachvergleiche und Einschränkungen.
- **Design und Befund:** Zwei Referenzmodelle; Nachrichten, kreatives Schreiben, Aufsätze und zusätzliche mehrsprachige Daten. Hohe Erkennung bei niedrigen Fehlalarmen in den Haupttests.
- **Grenzen:** Schwache Sensitivität in mehreren zusätzlichen Sprachen; keine gezielte adversarielle Evaluation. Referenzmodelle und Vergleichsdaten begrenzen die Übertragung.

## D03 · RAID

- **Titel / Autoren / Jahr:** *RAID: A Shared Benchmark for Robust Evaluation of Machine-Generated Text Detectors*. Liam Dugan, Alyssa Hwang, Filip Trhlik, Josh Magnus Ludan, Andrew Zhu, Hainiu Xu, Daphne Ippolito, Chris Callison-Burch; ACL 2024.
- **Original:** [ACL-PDF](https://aclanthology.org/2024.acl-long.674.pdf), [Publikationsseite](https://aclanthology.org/2024.acl-long.674/).
- **Geprüft:** PDF, besonders §§ 3–6 sowie Kalibrierung und Anhangstabellen.
- **Design und Befund:** Großes Robustheitsbenchmark mit verschiedenen Generatoren, Domänen und Einstellungen; zwölf Detektoren. Leistung ist stark bedingungsabhängig.
- **Grenzen:** Versionsstand 2024; kein heutiger Produktvergleich. RAID-extra enthält auch deutsche und tschechische Nachrichten, aber keine umfassende deutsche Textsortenabdeckung.

## D04 · Nichtmuttersprachliches Englisch

- **Titel / Autoren / Jahr:** *GPT detectors are biased against non-native English writers*. Weixin Liang, Mert Yuksekgonul, Yining Mao, Eric Wu, James Zou; Patterns 2023.
- **Original:** [Autoren-Volltext v3, 10.07.2023](https://arxiv.org/html/2304.02819v3), [Zeitschriften-DOI](https://doi.org/10.1016/j.patter.2023.100779).
- **Geprüft:** Volltext, besonders Ergebnisse und Vergleichsgruppen.
- **Design und Befund:** Sieben damalige Detektoren; 91 TOEFL-Texte gegenüber 88 US-Schulaufsätzen. Hohe Fehlalarmrate in der TOEFL-Gruppe.
- **Grenzen:** Kleine, unterschiedlich gewonnene Gruppen; Englisch und damalige Werkzeuge. Kein Nachweis einer unveränderlichen Eigenschaft aller Detektoren oder Sprachen.

## D05 · Nachuntersuchung 2026

- **Titel / Autoren / Jahr:** *Different Time, Different Language: Revisiting the Bias Against Non-Native Speakers in GPT Detectors*. Adnan Al Ali, Jindřich Helcl, Jindřich Libovický; EACL Student Research Workshop, März 2026.
- **Original:** [ACL-PDF](https://aclanthology.org/2026.eacl-srw.20.pdf).
- **Geprüft:** PDF, Datentabelle 1, § 5 mit kommerzieller Teilstichprobe und englischem Zusatzvergleich, Schlussfolgerungen.
- **Design und Befund:** Tschechische Texte, drei Detektorfamilien; kein systematischer Nachteil nichtmuttersprachlicher Gruppen unter den geprüften Bedingungen.
- **Grenzen:** Sprache und Zeit ändern sich gleichzeitig; kein isolierter Kausalvergleich zu 2023. Kommerzieller Test eingeschränkt; kein Nachweis vollständiger Bias-Freiheit.

## D06 · Theoretische Grenze und Belastungstests

- **Titel / Autoren / Jahr:** *Can AI-Generated Text be Reliably Detected?* Vinu Sankar Sadasivan, Aounon Kumar, Sriram Balasubramanian, Wenxiao Wang, Soheil Feizi; Erstfassung 2023, geprüfte Revision 17.01.2025; arXiv nennt TMLR-Veröffentlichung.
- **Original:** [Volltext v4](https://arxiv.org/html/2303.11156v4).
- **Geprüft:** Abstract, Einleitung, § 4, Theorem 1 und zugehörige Annahmen.
- **Design und Befund:** Empirische Überarbeitungstests sowie theoretischer Zusammenhang zwischen Verteilungsdistanz und bestmöglicher Trennung.
- **Grenzen:** Echte Textverteilungen sind schwer messbar. Die Theorie bescheinigt keinem konkreten Prompt universelle Unerkennbarkeit; getestete Systeme sind zeitgebunden.

## D07 · Möglichkeit bei ausreichender Datenmenge

- **Titel / Autoren / Jahr:** *Position: On the Possibilities of AI-Generated Text Detection*. Souradip Chakraborty, Amrit Bedi, Sicheng Zhu, Bang An, Dinesh Manocha, Furong Huang; ICML 2024.
- **Original:** [PMLR-Konferenzfassung](https://proceedings.mlr.press/v235/chakraborty24a.html), [ältere ausführliche Autorenfassung v3](https://arxiv.org/html/2304.04736v3).
- **Geprüft:** Konferenzabstract und Metadaten; ergänzend ältere HTML-Fassung zu Datenmenge und Abhängigkeiten. Das Konferenz-PDF war im Webwerkzeug nicht auslesbar.
- **Design und Befund:** Informationstheoretische Analyse und Experimente mit mehreren englischen Datensätzen/Generatoren; zusätzliche Beobachtungen können verbleibende Verteilungsunterschiede nutzbar machen.
- **Grenzen:** Annahmen über Daten und Verteilungen; keine Garantie für einen kurzen Einzeltext.

## D08 · Mehrsprachiger Shared Task

- **Titel / Autoren / Jahr:** *GenAI Content Detection Task 1: English and Multilingual Machine-Generated Text Detection: AI vs. Human*. Yuxia Wang, Artem Shelmanov et al.; COLING-Workshop 2025.
- **Original:** [ACL-PDF](https://aclanthology.org/2025.genaidetect-1.27.pdf).
- **Geprüft:** PDF §§ 1–4, Tabellen 3, 4 und 6 sowie Sprachbeschreibung.
- **Design und Befund:** Getrennte englische und mehrsprachige Aufgabe; insgesamt 21 Sprachen über die Datenteile, zahlreiche Domänen und neuere Generatoren. Herausforderungen der Übertragung auf unbekannte Daten sind sichtbar.
- **Grenzen:** Aggregierte Aufgabenwerte; kein deutscher Einzelfallnachweis und keine kalibrierte Urheberschaftswahrscheinlichkeit. Trainings- und Testsprachen sind nicht identisch abgedeckt.

## D09 · MIXSET und gemeinsame Redaktion

- **Titel / Autoren / Jahr:** *LLM-as-a-Coauthor: Can Mixed Human-Written and Machine-Generated Text Be Detected?* Qihui Zhang, Chujie Gao, Dongping Chen et al.; Findings of NAACL 2024.
- **Original:** [ACL-PDF](https://aclanthology.org/2024.findings-naacl.29.pdf).
- **Geprüft:** PDF, insbesondere Datenerzeugung §§ 3–4 und Evaluation.
- **Design und Befund:** 3.600 überwiegend englische Mischtextbeispiele mit verschiedenen Überarbeitungen; GPT-4, Llama 2 und manuelle Eingriffe. Probleme herkömmlicher Detektoren bei feinen Änderungen und Stiladaption.
- **Grenzen:** Konstruiertes Korpus, teilweise automatisierte Bearbeitung; begrenzte Modell- und Sprachabdeckung. Die genaue Definition des Ziel-Labels bleibt für die Interpretation wesentlich.

## D10 · Generatives Wasserzeichen

- **Titel / Autoren / Jahr:** *Scalable watermarking for identifying large language model outputs*. Sumanth Dathathri, Abigail See et al.; Nature, 23.10.2024, 634:818–823.
- **Original:** [Volltext im PMC-Archiv](https://pmc.ncbi.nlm.nih.gov/articles/PMC11499265/), [DOI](https://doi.org/10.1038/s41586-024-08025-4).
- **Geprüft:** Archivierter Volltext, Mechanismus, Methoden und Qualitätsauswertung. Direkter Nature-Abruf scheiterte an einer Zugangsumleitung; der identische Artikel ist im Archiv zugänglich.
- **Design und Befund:** SynthID-Text; Modelltests und groß angelegter Gemini-Nutzervergleich. Die Auswahl während der Generierung trägt ein statistisches Signal.
- **Grenzen:** Entwicklerstudie; Qualitätsgleichheit bedeutet nicht perfekte Nachweisbarkeit. Modell, verfügbare Auswahlmöglichkeiten und Textmenge beeinflussen die Erkennung.

## D11 · Historische Ankündigung zu Claude-Textwasserzeichen

- **Titel / Herausgeber / Datum:** *How Claude’s text watermark works*. Anthropic; veröffentlicht 14.08.2026, aktualisiert 01.09.2026.
- **Original:** [Offizielle Systembeschreibung](https://www.anthropic.com/news/claude-text-watermark).
- **Geprüft:** Vollständige Seite, insbesondere Mechanismus, Einschränkungen, Nachweiszugang und ältere Modelle.
- **Design und Befund:** Technische Herstellerdokumentation einer angekündigten/ausgerollten SynthID-Text-Variante; keine unabhängig reproduzierte Evaluation.
- **Grenzen:** Beschreibt Beteiligungsnachweis statt binärer menschlicher Urheberschaft. Status kann sich ändern; Einführungsdetails nicht auf alle älteren oder zukünftigen Ausgaben übertragen. Juristische Begründungen des Herstellers wurden hier nicht rechtlich geprüft.

## D12 · Aktueller Herstellerstand zur Modellabdeckung

- **Titel / Herausgeber:** *How Claude marks AI-generated content*, Claude Help Center / Anthropic.
- **Original:** [Offizielle Dokumentation](https://support.claude.com/en/articles/16266773-how-claude-marks-ai-generated-content).
- **Geprüft:** Originalseite am 30.10.2026, Modellabdeckung, Nachweisgrenzen und Dateimetadaten; Aktualisierung nur relativ als „gestern“ angezeigt.
- **Nutzen:** Aktueller Ausrollungsstand ergänzt die ältere Ankündigung D11.
- **Grenzen:** Veränderliche Herstellerdokumentation, keine unabhängige Wirksamkeitsmessung. Textwasserzeichen und signierte Dateimetadaten sind getrennte Verfahren. Die aufgeführten Modelle unterstützen nicht durchgehend dieselben Markierungen. Rechtliche Aussagen wurden nicht bewertet.

## Auswahl- und Übertragungsgrenzen

Die Auswahl deckt unterschiedliche Mechanismen und widersprechende Befunde ab, statt aus älteren Schwachstellen auf sämtliche aktuellen Produkte zu schließen. Herstellerseiten wurden ausschließlich für Aussagen über das eigene System verwendet. Stichtag und geprüfte Version gehören zu jedem späteren Vergleich. Eigene Benchmarks, kommerzielle Ranglisten und behauptete universelle Umgehungsraten sind nicht Bestandteil dieser Recherche.
