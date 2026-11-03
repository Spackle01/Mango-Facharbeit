# Wie KI schreibt: empirische Muster, Reichweite und offene Fragen

Stand und Abrufdatum: **30.10.2026**. Schwerpunkt: Forschung zu generierten und KI-überarbeiteten Texten. Die meisten verfügbaren Befunde betreffen Englisch; direkte deutsche Evidenz ist gesondert markiert. Quellenkarten: [KI-Schreibmuster](quellen/ki_schreibmuster_quellen.md).

## Ergebnis zuerst

**LLM-Texte können statistisch auffällige Schreibprofile haben. Diese Profile bestehen aus Merkmalskombinationen und Verteilungen, nicht aus einem verräterischen Einzelwort.** Ein Profil kann innerhalb einer Modellfamilie relativ stabil sein und sich zugleich mit Aufgabe, Sprache, Register, Prompt und Modellversion verändern. Ein Wortverbot oder das Entfernen von Gedankenstrichen ergibt deshalb weder ein vollständiges Stilmodell noch einen Herkunftsnachweis. Für die spätere Skill-Entwicklung ist ein passendes menschliches Vergleichskorpus entscheidend.

Die folgenden Aussagen verwenden vier Evidenzstufen:

- **Belegt:** in der genannten Studie beobachtet; gilt zunächst für deren Untersuchungsbedingungen.
- **Abgeleitet:** nachvollziehbare Konsequenz für dieses Projekt, hier noch nicht experimentell geprüft.
- **Hypothese:** plausibel, aber für den vorgesehenen deutschen Einsatz unbestätigt.
- **Offen:** Informationen oder Experimente fehlen.

## 1. Wortwahl: Überhäufigkeit statt verbotener Wörter

**Belegt, englische Wissenschaftssprache:** Kobak et al. untersuchen über 15 Millionen PubMed-Abstracts von 2010–2024. Nach dem Aufkommen verbreiteter LLMs steigen bestimmte Stilwörter abrupt an. Beispiele sind `delve`, `intricate`, `pivotal` und `comprehensive`. Das Verfahren schätzt eine Untergrenze von **13,5 % KI-bearbeiteter Abstracts für 2024**. Das ist eine Korpusschätzung; weder enthält jeder KI-Text diese Wörter noch weist ein einzelnes Vorkommen KI-Nutzung nach. [K01, Originalarbeit](https://arxiv.org/html/2406.07016)

**Abgeleitet für das Projekt:** Wörter als Prüfhinweise mit Kontext speichern: Sprache, Textsorte, Modell, Vergleichsgruppe, Zeitraum und gemessene Häufigkeit. Keine universelle schwarze Liste erstellen. Eine legitime Fachvokabel bleibt legitim, selbst wenn ein Modell sie oft verwendet.

### Sinnvolles Datenformat für eine spätere Wortliste

```yaml
ausdruck: "BEISPIEL — noch keine Messung"
sprache: de
textsorten: [essay]
modell_snapshot: "noch zu erheben"
prompt_bedingung: "noch zu erheben"
haeufigkeit_ki_pro_1000_woerter: null
haeufigkeit_mensch_pro_1000_woerter: null
beobachtete_dokumente: null
evidenz: hypothese
zulassung: "nur kontextbezogen prüfen"
```

Dieses Schema ist ein Projektvorschlag, kein aus einer Studie übernommener Datensatz.

## 2. Syntax: Auffälligkeiten reichen unter die Wortoberfläche

**Belegt, Englisch:** Reinhart et al. vergleichen GPT-4o/mini und vier Llama-3-Varianten mit menschlichen Paralleltexten. GPT-4o verwendet im untersuchten Korpus Partizipialklauseln **5,3-mal** und Nominalisierungen **2,1-mal** so häufig wie Menschen. Unterschiede betreffen auch die Anpassung an Register; größere Modelle beseitigen sie nicht automatisch. [K02, PNAS](https://doi.org/10.1073/pnas.2422455122)

**Abgeleitet:** Stilrevision sollte Satzbau und Informationsverteilung berücksichtigen. Nur auffällige Wörter auszutauschen lässt strukturelle Routinen möglicherweise bestehen. Die englischen Faktoren sind keine Zielwerte für deutsche Texte.

## 3. Direkte deutsche Evidenz: formelle Übergänge und Standardisierung

**Belegt, Deutsch und Englisch:** Shaitarova et al. untersuchen GPT-3.5-Turbo-16k mit drei Aufgaben und unterschiedlichen Personas. In deutschen Texten beobachten sie eine stärkere morphosyntaktische Vereinheitlichung und lexikalische Vereinfachung. Im deutschen wissenschaftlichen Teil bevorzugen akademisch instruierte Personas satzinitial unter anderem `darüber hinaus`, `allerdings` und `zusätzlich`. Die Verteilungen hängen von Aufgabe und Domäne ab. Die Generierungen stammen aus **September 2023**. [K03, SwissText 2024](https://aclanthology.org/2024.swisstext-1.9/)

**Abgeleitet:** Häufige formelle Übergänge sind ein sinnvoller deutscher Prüfkandidat, aber kein Grund, diese Wörter generell zu entfernen. Für aktuelle Modelle müssen die Befunde neu gemessen werden.

## 4. Hat jede KI ihren eigenen Schreibstil?

**Belegt unter Benchmarkbedingungen:** McGovern et al. finden in vier Datensätzen charakteristische Unterschiede bei Wort-, Zeichen- und Wortartenfolgen. Profile können innerhalb einer Modellfamilie über Größen und Domänen hinweg ähnlich bleiben. Der Transfer auf eine fremde Modellfamilie fällt deutlich schwerer aus. [K04, GenAIDetect 2025](https://aclanthology.org/2025.genaidetect-1.6/)

**Abgeleitet:** Die nützliche Einheit ist ein **Modell unter dokumentierten Bedingungen**, nicht die Marke „ChatGPT“, „Claude“ oder „Gemini“ als zeitlose Persönlichkeit. Ein Profil benötigt Versionsdatum, Systemanweisungen, Aufgabe und Generierungseinstellungen. Diese Recherche begründet keine vollständige aktuelle Rangliste aller Anbieter.

## 5. Vielfalt: einzelne Texte und ganze Textmengen auseinanderhalten

**Belegt, englisches Mehrdomänenkorpus:** Zanotto und Aroyehun analysieren Ausgaben von elf Modellen in acht Domänen mit unterschiedlichen Decodierungsbedingungen. Menschliche Texte variieren in ihren untersuchten Merkmalen stärker; ihre semantischen Inhalte sind vielfältiger und ihre Syntax im Mittel einfacher. Modell- und Domäneneffekte bleiben relevant. [K05, EMNLP 2025](https://aclanthology.org/2025.emnlp-main.1163/)

**Belegt, englische Nachrichten:** Gude et al. vergleichen zwei Modellgenerationen mit New-York-Times-Texten aus 2023 und 2025. Neuere instruierte Modelle zeigen in diesem Design weniger syntaktische und besonders weniger lexikalische Vielfalt. Alter, Architektur und Training ändern sich jedoch zusammen; daraus folgt kein isolierter universeller Kausaleffekt von Instruction-Tuning. [K07, ACL 2026](https://aclanthology.org/2026.acl-long.1803/)

**Abgeleitet:** Ein einzelner lebhafter Text kann Teil einer stark gleichförmigen Textserie sein. Spätere Qualitätsprüfungen müssen daher sowohl die Passung jedes Textes als auch wiederkehrende Routinen über viele Ausgaben hinweg betrachten.

## 6. Gedankenstrich: ein untersuchbarer Kandidat, kein Beweis

**Belegt als explorativer Korpusbefund, Englisch:** Czuma untersucht 146.239 US-Kongress-Pressemitteilungen von 2021–2025. Ungespacete Em-Dashes (`—`, U+2014) nehmen 2025 zu. Die Studie kennzeichnet die Interpretation ausdrücklich als explorativ: Eine vorregistrierte Validierungsschwelle wurde verfehlt; das Design erlaubt keinen kausalen Schluss und keine Herkunftsentscheidung für einzelne Mitteilungen. [K06, Preprint vom 06.08.2026](https://arxiv.org/abs/2608.05889)

**Abgeleitet:** Vor dem Zählen Zeichenarten und Funktion unterscheiden: `-`, `–`, `—`, Spatien, Einschub, Aufzählung, Bereichsangabe oder Layout. Ein Befund über amerikanische Em-Dashes darf nicht pauschal auf jeden deutschen Gedankenstrich übertragen werden.

**Offen:** Wie stark unterscheiden sich aktuelle deutsche Modelle von passend ausgewählten menschlichen Autoren bei diesen einzelnen Verwendungsarten? Hier wurde keine eigene Messung durchgeführt.

## 7. Überarbeitung durch KI ist eine eigene Entstehungsform

**Belegt, englische NLP-Fachtexte:** Miletić und Falk kombinieren ein historisches Korpus von über 37.000 Arbeiten mit 3.000 menschlichen Passagen und deren GPT-3.5-Überarbeitungen. Die Bearbeitungen verändern unter anderem Wortkomplexität und lexikalische Vielfalt. In einer kleinen Pilotbewertung mit 20 Fachleuten werden überarbeitete Texte insgesamt verständlicher und anregender bewertet. [K08, LREC 2026](https://aclanthology.org/2026.lrec-1.142/)

**Abgeleitet:** „KI-typisch“ und „schlecht geschrieben“ sind verschiedene Bewertungen. Für den Projektvergleich mindestens menschliche Originale, vollständig generierte Texte und KI-überarbeitete menschliche Texte getrennt erfassen. Gute redaktionelle Änderungen müssen nicht rückgängig gemacht werden, nur weil sie messbare Stilspuren hinterlassen.

## 8. Welche Merkmalsfamilien wirken robuster?

**Belegt innerhalb eines aktuellen Preprints:** El Attar et al. vergleichen 284 Merkmale über 27 Modelle und zehn englische Domänen. Lexikalischer Reichtum liefert in ihren Ablationen besonders konsistente Information; viele andere Merkmalsbereiche sind stark kontextabhängig. Die Datengrundlage umfasst dennoch nicht die neuesten Modelle. [K09, Preprint vom 02.06.2026](https://arxiv.org/abs/2606.04177)

**Abgeleitet:** Priorität verdienen längen- und domänenkontrollierte Untersuchungen der Wortschatzverwendung. Eine hohe Merkmalswichtigkeit im Klassifikator bedeutet weder, dass jedes KI-Dokument wenig Wortschatzvielfalt besitzt, noch dass ein mechanisches Erhöhen der Vielfalt gute Prosa erzeugt.

## 9. Neue Modelle können auch zu dicht schreiben

**Vorläufiger Befund, Englisch:** Clark et al. untersuchen aktuelle Modellfamilien und berichten ungewöhnliche Wortfolgen sowie bestimmte mit Verarbeitungsschwierigkeit verbundene Konstruktionen. Ein kleiner Trainingsversuch mit Längenstrafe unterstützt einen möglichen Mechanismus in Richtung sprachlicher Verdichtung. Er erklärt nicht kausal das gesamte Training kommerzieller Modelle. [K10, Preprint vom 21.10.2026](https://arxiv.org/abs/2610.29162)

**Abgeleitet:** „Kürzer“ und „verständlicher“ sollten getrennt geprüft werden. Wörter zu streichen kann Nominalketten oder überfüllte Sätze erzeugen. Der Preprint untersucht sprachliche Indikatoren; daraus folgt kein pauschaler experimenteller Nachweis längerer menschlicher Lesezeiten für alle Modelltexte.

## 10. Satzschablonen und kreative Routinen

**Belegt in spezifischen englischen Generierungsbedingungen:** Paech et al. messen modellspezifische Übernutzung von Wörtern, n-Grammen und Satzmustern. Die Antislop-Arbeit untersucht unter anderem kreative Texte und negative Parallelismen nach dem Muster `It's not X, it's Y`. Die menschliche Referenz kombiniert mehrere Quellen; extreme Häufigkeitsverhältnisse hängen auch von seltenen Baseline-Vorkommen ab. [K11, ICLR 2026](https://proceedings.iclr.cc/paper_files/paper/2026/hash/467746c8e15fbfca34dcf23be9ef9229-Abstract-Conference.html)

**Abgeleitet:** Wiederholte Schablonen über mehrere Texte sind ein sinnvoller Qualitätsprüfpunkt. Eine gelegentliche Antithese, Dreierfigur oder Metapher bleibt ein normales Stilmittel. Die Messung einzelner Muster ist kein Nachweis eines allgemein erfolgreichen Detektor-Bypasses.

## 11. Was noch keine belastbare Regel ist

Für folgende pauschale Behauptungen liefert die hier geprüfte Literatur **keine allgemeine Grundlage**:

| Behauptung | Forschungsstand für dieses Projekt |
|---|---|
| „Ein Gedankenstrich beweist KI.“ | Einzelmerkmal erlaubt keinen solchen Schluss. |
| „Menschen machen Fehler, KI nicht.“ | Kein brauchbares allgemeines Stilziel; Zielregister und Redaktion kontrollieren. |
| „Mehr Satzlängenvariation macht jeden Text menschlich.“ | Für die deutsche Zielanwendung ungetestete Vereinfachung. |
| „Hohe Perplexität bedeutet menschliche Urheberschaft.“ | Kein sprach- und modellunabhängiger Grenzwert festgelegt. |
| „Diese englische Wortliste funktioniert auch auf Deutsch.“ | Sprachtransfer muss geprüft werden; Übersetzung ist keine Replikation. |
| „Ein neues Modell hat denselben Stil wie sein Vorgänger.“ | Neue Version benötigt neue Stichprobe. |
| „Alle Überschriften, Listen und Schlussabsätze sind KI-Merkmale.“ | Ohne passendes Register und Referenzkorpus unbestimmt. |
| „Natürlich klingend bedeutet detectorfrei.“ | Leserurteil und Detektorscore sind unterschiedliche Messgrößen. |

Die Tabelle ist eine methodische Begrenzung der vorliegenden Recherche; sie behauptet nicht, dass zu jedem Kandidaten weltweit keinerlei Untersuchung existiert.

## 12. Konsequenzen für die spätere Skill-Sammlung

Diese Punkte sind **Projektableitungen**, keine bereits getesteten Erfolgsrezepte:

1. **Zuerst die Schreibsituation bestimmen:** Sprache, Land/Varietät, Leser, Medium, Textsorte, Zweck, verfügbare Fakten.
2. **Einen passenden menschlichen Maßstab wählen:** Ein Chatbeitrag, eine redigierte Reportage und eine Facharbeit verlangen unterschiedliche Sprache.
3. **Inhalt vor Oberflächenkosmetik prüfen:** konkrete Aussagen, nachvollziehbare Bezüge, angemessene Informationsdichte und begründete Auswahl.
4. **Wiederkehrende Routinen kontextbezogen prüfen:** Standardöffnungen, formelle Übergänge, Satzschablonen und gleichförmige Absatzfunktionen.
5. **Überrevision vermeiden:** Fachbegriffe, gewollte Wiederholungen und autorentypische Eigenheiten nicht durch zufällige Synonyme ersetzen.
6. **Neue Modelle neu vermessen:** Regeln als versionierte Hypothesen behandeln, nicht als dauerhafte Naturgesetze.
7. **Ergebnis durch Leser prüfen lassen:** Verständlichkeit, Angemessenheit, Glaubwürdigkeit und Stimmigkeit separat bewerten; Herkunftsraten ergänzend erfassen.

## 13. Kleinster nützlicher Folgetest

**Noch nicht ausgeführt.** Für ein enges deutsches Register dieselben Aufgaben und Fakten jeweils menschlich, mit mehreren dokumentierten Modellen und mit einem ersten Stil-Skill bearbeiten. Inhalt und Länge möglichst angleichen. Vorab wenige Merkmale festlegen: Wortschatzverwendung, satzinitiale Übergänge, Satzlängenverteilung, Zeichenarten sowie blinde Leserurteile. Aufgaben oder Autoren vollständig für die Prüfung zurückhalten, damit wiederverwendete Inhalte keine scheinbare Stilverbesserung erzeugen. Erst nach dieser Prüfung Regeln als bestätigt markieren.

Offen bleiben vor allem belastbare aktuelle deutsche Modellvergleiche, robuste Messung kurzer Texte, die Abgrenzung menschlicher Redaktion und die Stabilität von Regeln nach Modellupdates.
