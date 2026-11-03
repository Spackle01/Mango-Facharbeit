# Merkmalskatalog für spätere Analysen

Stand: 30.10.2026. Dieser Katalog macht die Recherche für die Entwicklung nutzbar. Er ist **kein fertiger KI-Detektor**. Er verbindet in der Literatur untersuchte Merkmalsfamilien mit eigenen Messvorschlägen. Ein vorhandener Forschungshinweis bestätigt nicht automatisch jedes hier vorgeschlagene Detailmaß.

Empirische Einzelbefunde und ihre Reichweite stehen in [01](01_ki_schreibmuster.md), [03](03_direkter_vergleich.md) und [05](05_deutsche_sprache_und_datengrundlagen.md). Quellenkarten: [Register](quellen/README.md).

## So ist der Katalog zu lesen

- **F:** In den Fachkapiteln findet sich Forschung zur Merkmalsfamilie. Die konkrete deutsche Operationalisierung bleibt zu validieren.
- **H:** Eigener Untersuchungskandidat; hier nicht als trennscharfer KI-Marker belegt.
- **Q:** Qualitätskriterium für Texte; keine Herkunftseigenschaft.

Es gibt absichtlich keine Spalte „ab diesem Wert KI“. Dafür fehlen kalibrierte, zielgruppengerechte Messungen. Gezählt werden Verteilungen, keine Schuldindikatoren.

## Wortwahl und wiederkehrende Formulierungen

| ID | Kandidat | Status / Einstieg | Vorgeschlagene Messung | Wichtigster Störfaktor |
|---|---|---|---|---|
| W01 | Einzelne überrepräsentierte Wörter | F; K01/K03 | Relative Häufigkeit und Anteil betroffener Dokumente | Thema und Fachsprache |
| W02 | Wortfolgen und Satzschablonen | F; K04/K11 | n-Gramme pro Text und über die Sammlung | Zitierte oder vorgeschriebene Formulierungen |
| W03 | Wortschatzvielfalt | F; K05/K09, Gegenbefund M06 | Mehrere längenkontrollierte Maße; zusätzlich Wiederholungsverteilung | Textlänge, Lemmatisierung, Kompetenz |
| W04 | Häufige grammatische Wörter | F; M02 | Pronomen-, Artikel-, Präpositions- und Konjunktionsprofile | Gesprächspartner und Aufgabe |
| W05 | Satzinitiale Übergänge | F; K03 | Lemma, Satzposition und tatsächliche Funktion | Wissenschaftliches Register |
| W06 | Ungewöhnliche Wortverbindungen | F; K10; Hilfsmittel R07 | Kontextprüfung plus Referenzkorpus | Neue Fachbegriffe und absichtliche Originalität |
| W07 | Unnötige Synonymwechsel | H/Q | Mehrere Bezeichnungen für denselben Gegenstand markieren | Gewollte Variation oder Bedeutungsunterschied |
| W08 | Verstärker und Wertungsadjektive | H/Q | Aussagebeitrag je Verwendung prüfen | Werbung, Rezension, persönliche Begeisterung |
| W09 | Modalpartikeln im Deutschen | H | Funktion statt bloßer Zeichenfolge bestimmen | Mehrdeutigkeit und regionale Unterschiede |

## Satzbau und Informationsverteilung

| ID | Kandidat | Status / Einstieg | Vorgeschlagene Messung | Wichtigster Störfaktor |
|---|---|---|---|---|
| S01 | Satzlängenverteilung | F; M08 als Gegenbefund | Median, Quantile und Verteilung je Text | Abkürzungen und Segmentierungsfehler |
| S02 | Nominalisierungen | F; K02/R03 | Häufigkeit mit manuell geprüften Fällen | Fachsprache; Endungen allein reichen nicht |
| S03 | Komplexe Nominalgruppen | F; K10 | Dichte und Verschachtelung | Komposita und Parserfehler |
| S04 | Abhängigkeitslängen | F; K10 | Parsermaß plus Stichprobenkontrolle | Sprach- und Parserabhängigkeit |
| S05 | Wiederkehrende Satzgerüste | F; K04/K11 | Wortarten-/Konstruktionsfolgen | Thema und vorgegebene Formate |
| S06 | Aktiv und Passiv | F; R03 | Anteil und Funktion nach Textsorte | Unterschiedliche kommunikative Aufgaben |
| S07 | Satzfragmente und Ellipsen | H | Kontextbezogene Kodierung | Chat versus redigierter Fließtext |
| S08 | Informationsdichte | F/Q; K10 | Begriffsballung und Verständnishürden getrennt prüfen | Kürze allein misst keine Verständlichkeit |
| S09 | Eindeutige Bezüge | Q | Pronomenbezüge, handelnde Personen, Ursachen | Erzählstil und bewusstes Offenlassen |

## Aufbau, Rhetorik und Haltung

| ID | Kandidat | Status / Einstieg | Vorgeschlagene Messung | Wichtigster Störfaktor |
|---|---|---|---|---|
| A01 | Gleiche Einleitung über viele Texte | H/Q | Wiederkehrende Funktion und Wortfolge | Serienformat oder redaktionelle Vorgabe |
| A02 | Wiederholender Schluss | H/Q | Neue Information gegenüber vorherigem Absatz | Zusammenfassung kann erwünscht sein |
| A03 | Kontrastschablonen | F; K11 | Konstruktion und Häufigkeit in einer Sammlung | Legitime argumentative Gegenüberstellung |
| A04 | Listen und Zwischenüberschriften | H | Format getrennt von sprachlichem Inhalt zählen | Medium und expliziter Schreibauftrag |
| A05 | Aufzählungen gleicher Länge | H | Verteilung der Listenlängen je Serie | Inhaltlicher Bedarf |
| A06 | Konnektoren ohne passende Beziehung | Q | Prüfen, ob Gegensatz, Folge oder Ergänzung wirklich vorliegt | Bewusst implizite Argumentation |
| A07 | Positive oder negative Emotionssprache | F; M08 | Kategorien und Einzelkontext | Thema, Genre und Klassifikationswörterbuch |
| A08 | Umgang mit Gewissheit | Q | Belege, Einschränkungen und Behauptungsstärke abgleichen | Fachgebiet und Textzweck |
| A09 | Eigene Position statt Standardausgleich | H/Q | Antwortet der Text auf den tatsächlichen Konflikt? | Neutralität kann ausdrücklich verlangt sein |

## Zeichensetzung, Stimme und Variation

| ID | Kandidat | Status / Einstieg | Vorgeschlagene Messung | Wichtigster Störfaktor |
|---|---|---|---|---|
| Z01 | Gedankenstriche | F; K06/R05 | Unicode-Zeichen, Abstand und Satzfunktion getrennt | Redaktionssoftware und Typografie |
| Z02 | Doppelpunkte und Semikola | H | Funktion und Häufigkeit je Register | Fach-/Listenformat |
| Z03 | Anführungszeichen und Hervorhebungen | H | Zeichenform und kommunikative Funktion | Exportformat und Hausstil |
| P01 | Referenzen auf Personen | F; M08 | Pronomen und konkrete Bezugsperson getrennt | Perspektive der Aufgabe |
| P02 | Raum-, Zeit- und Bewegungsbezüge | F; M08 | Inhalt und Wörterbuchkategorie unterscheiden | Stoff der Erzählung |
| P03 | Belegte konkrete Details | Q | Detail gegen Ausgangsmaterial prüfen | Erfundenes Detail kann oberflächlich plausibel wirken |
| P04 | Angemessene Anrede und Distanz | H/Q | Übereinstimmung mit Briefing und Beispielen | Kultur, Beziehung, Medium |
| P05 | Erhalt individueller Eigenheiten | F/Q; M04 | Profil vor/nach Revision, Autorurteil | Gewünschte Verständlichkeitsverbesserung |
| V01 | Vielfalt zwischen mehreren Texten | F; M07/K05 | Wiederkehrende Ideen und Muster über die Sammlung | Identische Ausgangsaufgaben |

## Kandidatenliste deutscher Formulierungen

**Belegte Beispiele aus einem historischen deutschen Studiendesign** sind in K03 dokumentiert. Ihre Reichweite dort lesen. Die folgende erweiterte Liste ist dagegen ein **redaktioneller Prüfvorrat H/Q**: keine empirisch bestätigte Häufigkeitsliste und keine Verbotsliste.

| Funktion | Zu prüfende Beispiele | Prüffrage |
|---|---|---|
| Allgemeiner Einstieg | „In der heutigen Zeit“, „In einer zunehmend … Welt“ | Braucht der konkrete Text diese Rahmung? |
| Bedeutung behaupten | „spielt eine entscheidende Rolle“, „von zentraler Bedeutung“, „maßgeblich“ | Wird die behauptete Bedeutung gezeigt? |
| Metakommentar | „Es ist wichtig zu beachten“, „An dieser Stelle sei erwähnt“ | Kann die eigentliche Aussage unmittelbar stehen? |
| Ergänzung | „darüber hinaus“, „zusätzlich“, „zudem“, „des Weiteren“ | Ist die Ergänzung nötig und der Übergang passend? |
| Ausgleich | „einerseits … andererseits“, „sowohl … als auch“ | Sind wirklich zwei relevante Seiten gemeint? |
| Kontrast | „nicht nur … sondern auch“, „Es geht nicht um X, sondern um Y“ | Trägt der Gegensatz einen Gedanken oder füllt er Raum? |
| Zusammenfassung | „Zusammenfassend lässt sich sagen“, „Abschließend kann festgehalten werden“ | Liefert der Schluss Nutzen für diese Textsorte? |
| Werbliche Aufwertung | „innovativ“, „nahtlos“, „ganzheitlich“, „bahnbrechend“ | Welche überprüfbare Eigenschaft wird bezeichnet? |
| Unbestimmtheit | „diverse Aspekte“, „zahlreiche Möglichkeiten“, „vielschichtig“ | Kann die Aussage konkretisiert werden? |
| Dramatisierung | „eröffnet neue Horizonte“, „verändert die Spielregeln“ | Passt dieses Bild zum tatsächlichen Vorgang? |

Das Auftreten eines Eintrags löst eine **Kontextprüfung** aus. Ein Fachwort, ein treffender Gegensatz oder ein gewünschter formeller Schluss kann erhalten bleiben. Aus dem Prüfvorrat darf kein Herkunftsurteil erzeugt werden.

## Minimale Karte für ein später bestätigtes Merkmal

```yaml
id: W00
bezeichnung: noch_zu_bestimmen
status: hypothese
sprache: de
register: noch_zu_bestimmen
modell_und_version: noch_zu_erheben
prompt_und_parameter: noch_zu_erheben
menschliche_referenz: noch_zu_erheben
messdefinition: noch_zu_definieren
stichprobe_dokumente: null
effektgroesse_und_unsicherheit: null
kontrollen: [laenge, thema, autor, quelle, zeitpunkt]
gegenbeispiele: []
replikation: nicht_durchgefuehrt
geeignet_fuer: kontextpruefung
```

Das Schema ist eine Vorlage. `null` bedeutet fehlende Messung und darf nicht als Nullunterschied interpretiert werden.
