# Deutsch: direkte Befunde und passende Datengrundlagen

Stand: 30. Oktober 2026. Dieses Kapitel verhindert, dass englische Merkmale ungeprüft zu deutschen Regeln werden. Quellenkarten: [deutsch_quellen.md](quellen/deutsch_quellen.md).

## Was unmittelbar für Deutsch untersucht wurde

### R02: Generalisierung hängt von Generator und Textsorte ab

**B:** Irrgang et al. untersuchten deutsche Texte und mehrere damalige Generatoren. In Tabelle 2 erreicht der nur auf Llama-Daten trainierte Detektor F1=0,95 im Llama-Test, aber 0,59 im gemischten Test. Der Vergleich zeigt einen Übertragungsverlust im konkreten Aufbau; er ist kein aktueller Marktvergleich. Menschliche Referenztexte stammen aus der Zeit vor 2016; die Generatoren umfassen Llama 2, GPT-3.5 und damalige Varianten. [Originalstudie, insbesondere §3 und Tabelle 2](https://aclanthology.org/2024.konvens-main.27.pdf).

**A:** Ein Schreib-Skill sollte keine feste deutsche „KI-Sprache“ voraussetzen. Ein Modellwechsel erfordert neue Vergleiche. Die veralteten Modelle und unterschiedlichen Erhebungszeiten begrenzen den Transfer auf heutige Texte.

### R03: Gute deutsche Texte brauchen eine genrespezifische Prüfung

**B:** Drackert, Horbach und Peters vergleichen menschliche Prüfungstexte mit ChatGPT-3.5/4-Ausgaben. Der geprüfte Abstract nennt unter anderem Abweichungen bei Nominalisierungen, lexikalischer Dichte, Fachwortschatz, Beispielen, Passiv und aus dem Englischen übertragener unidiomatischer Sprache. **Hier wurde nur der Originalabstract geprüft.** [Veröffentlichung von 2025](https://doi.org/10.1017/S0267190525000066).

**A:** Die richtige Richtung einer Änderung hängt von der Textsorte ab. „Immer mehr aktive Verben“ und „immer weniger Fachwörter“ sind keine universellen Regeln für menschliches Deutsch.

### R04: Publikationsjahr ist nicht Modelljahr

**B:** Liebe et al. veröffentlichen 2026 einen Ansatz mit Stilometrie und Themenentwicklung. Die deutschen Daten wurden bereits März–April 2024 erhoben; der deutsche Test umfasst je 200 Texte von Menschen, GPT-4 und Gemini. [Originalartikel, Abschnitt Dataset](https://link.springer.com/article/10.1007/s42979-026-05131-0).

**A:** Für die spätere Entwicklung muss jede Quellenangabe zwei Zeitpunkte unterscheiden: Veröffentlichung und Datengenerierung. Ein 2026 erschienener Artikel belegt nicht automatisch Eigenschaften aktueller Modellstände.

### Weitere direkte Vergleiche

Für deutsche Erzählungen liegt ein kontrollierter Vergleich mit menschlichen Leserurteilen vor. Die Ergebnisse und Einschränkungen stehen in [03_direkter_vergleich.md](03_direkter_vergleich.md), Quellenkarte M08. Deutsche morphosyntaktische Muster werden außerdem in [01_ki_schreibmuster.md](01_ki_schreibmuster.md) behandelt. Die Textsorten unterscheiden sich; diese Befunde dürfen nicht zu einem einzigen Durchschnittsstil verschmolzen werden.

## Gedankenstriche im Deutschen

**B:** Der Gedankenstrich hat im amtlichen Regelwerk eine eigenständige kommunikative Funktion, etwa zur Kennzeichnung eingeschobener Zusätze. Er ist reguläre deutsche Zeichensetzung. [Rat für deutsche Rechtschreibung/IDS, Kapitel Zeichensetzung](https://grammis.ids-mannheim.de/rechtschreibung/6198), R05.

**A:** Seine bloße Anwesenheit belegt keine KI-Urheberschaft. Das Regelwerk sagt zugleich nichts darüber aus, ob bestimmte Modelle ihn in einem Korpus überdurchschnittlich häufig verwenden.

Für Messungen getrennt erfassen: Bindestrich `-` (U+002D), Halbgeviertstrich `–` (U+2013), Geviertstrich `—` (U+2014), Satzfunktion und umgebende Leerzeichen. Diese Trennung ist ein **Messvorschlag**, keine Aussage über ihren jeweiligen Erkennungswert. Eine automatische Normalisierung könnte relevante Unterschiede verdecken. Ein pauschales Ersetzen aller Striche beschädigt außerdem Komposita, Zahlenbereiche oder sinnvolle Einschübe.

## Datengrundlagen für die nächsten Schritte

### R01: DeHAT v1 – aktueller deutscher Vergleichskorpus

**B, Datensatzdokumentation:** Version 1.0.0 vom 25.09.2026 umfasst laut Veröffentlichung 226.092 Texte **und Schreibaufträge** aus 16.519 Textfamilien. Nicht alle Einträge sind menschliche oder KI-Fließtexte. Die Familien verbinden Ankertext, abgeleiteten Prompt, Modellfassungen und teils direkte Überarbeitung. [Datensatz](https://zenodo.org/records/22206304), [Dokumentation](https://miweru.github.io/dehat/).

**A:** Gut geeigneter Kandidat für register- und modellgetrennte Vergleiche. Zu beachten: modellgenerierte Schreibaufträge, quellenabhängige Zugangsrechte, unterschiedliche öffentliche/interne Teilmengen. Das Material wurde hier weder heruntergeladen noch ausgewertet. Ein Datensatz ist noch kein Nachweis für die Wirkung unseres späteren Skills.

### R06: KoGraUK – Referenz für geschriebene deutsche Sprache

**B:** Das IDS beschreibt KoGraUK als Teil des DeReKo-Release 2017-II mit Metadaten unter anderem zu Land, Region, Register, Medium und Domäne. [Offizielle Korpusdokumentation](https://grammis.ids-mannheim.de/korpusgrammatik/6615).

**A:** Für passende Vergleichsausschnitte geeignet; kein unverzerrter Maßstab für sämtliche heutigen deutschen Kommunikationsformen. Ein Pressetextkorpus ersetzt insbesondere keine Referenz für private Kurznachrichten.

### R07: Syntagmatikon – Wortverbindungen im Kontext prüfen

**B:** Das IDS-Angebot erschließt typische Wortverbindungen anhand von Korpusressourcen. [Offizielle Dokumentation](https://syntagmatikon.ids-mannheim.de/corpora/).

**A:** Nützlich für die Prüfung einzelner deutscher Wendungen. Ein seltener Ausdruck ist nicht automatisch falsch; Häufigkeit ist kein Ersatz für Bedeutung und passende Situation.

## Noch zu prüfende deutsche Merkmale

Die folgende Liste sind **H: Untersuchungskandidaten**, keine bereits nachgewiesenen KI-Marker:

- Anrede, Du/Sie, Höflichkeitsgrad und regionaler Standard;
- idiomatische Verb-Nomen-Verbindungen und Präpositionswahl;
- Modalpartikeln wie „doch“, „eben“ oder „mal“, jeweils in ihrer Funktion;
- Verteilung von Nebensätzen, Nominalgruppen und Passiv je Textsorte;
- Komposita, lange Wortformen und Fachterminologie;
- Satzanfänge, explizite Übergänge und Schlussformeln;
- Art und Funktion von Einschüben, Listen und Zwischenüberschriften.

Das Zählen eines Wortes allein genügt nicht. „Mal“ kann beispielsweise eine Partikel oder eine Zeitangabe sein. Häufigkeiten benötigen Längenabgleich, Kontextkontrolle und bei syntaktischen Kategorien eine überprüfte deutsche Analyse.

## Offene Fragen

Wie unterscheiden sich aktuelle Modelle in **deutschen** E-Mails, Essays, Ratgebern und Erzählungen bei identischem Auftrag? Wie stark verändert eine Redaktion die Merkmale? Wie unterscheiden sich Deutsch als Erst- und Zweitsprache sowie regionale Varianten? Dafür enthält diese Recherche keine eigenen Messwerte. Das Versuchsdesign steht in [08_validierungsplan.md](08_validierungsplan.md).
