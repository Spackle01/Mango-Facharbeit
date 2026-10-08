---
name: sprachpruefung
description: Einen Text der Facharbeit (Deutsch oder Englisch) auf Füllwörter, vage Belege, aufgeblähte Formulierungen und typische KI-Muster prüfen und eine konkrete Korrekturliste liefern. Enthält ein Prüfskript.
---

<!-- mango-facharbeit:verwaltet – übersetzt und angepasst aus „ai-tell-audit“ (Humanize skills/SKILL-3.md) und ai_tell_scan.py -->

# Sprachprüfung

Nutze diesen Skill, um einen Entwurf vor der Abgabe oder Konsultation zu prüfen, oder wenn die Person fragt, ob ihr Text „nach KI klingt“ oder zu ungenau ist. Ziel ist eine brauchbare Korrekturliste, kein Urteil darüber, wer den Text geschrieben hat. Kein einzelnes Merkmal beweist KI-Autorschaft, und Menschen verwenden all diese Muster auch. Auffällig sind Häufungen.

Die Prüfung ergänzt die Sprachregeln der Schule (Noll/Vode, `00_vorgaben/anforderungen.md`, Abschnitt 9): sachbezogen, belegt, neutral, präzise, kurz, formal. Sie dient der Qualität, nicht dem Verbergen von KI-Nutzung. Kennzeichnungspflichten bleiben bestehen.

## Ablauf

1. **Scannen.** In der App Mango Facharbeit stehen keine Befehle zur Verfügung: Prüfe direkt anhand der Listen unten, ohne ein Skript zu starten. Nur außerhalb der App (mit Terminal) kannst du das Skript nutzen: `python3 .claude/skills/sprachpruefung/scripts/ai_tell_scan.py entwurf.md`. Seine Zahlen sind nur ein Ausgangspunkt.
2. **Lesen, was ein Skript nicht findet** (Abschnitt „Inhaltliche Merkmale“): allgemeine Aussagen, aufgeblähte Bedeutung, fehlende Belege, keine eigene Position im Schluss, alles abgedeckt und nichts vertieft, Nominalstil.
3. **Bericht** in dieser Form:

```
Gesamteindruck: sauber / einige Stellen / wirkt durchgehend schablonenhaft (neu schreiben statt flicken)

Wichtigste Stellen (höchstens 10, schwerste zuerst)
1. „<Zitat aus dem Text>“: <welches Muster>. Vorschlag: <konkrete Neufassung oder „streichen“>
...

Rhythmus: Satzlänge im Mittel N Wörter, Spanne N–N, Variation (CV) 0,NN (unter 0,40 wirkt gleichförmig)
Beibehalten: <1–3 Dinge, die schon gut funktionieren>
```

4. **Nicht kleinlich sein.** Ein „zudem“ in 1.000 Wörtern ist in Ordnung. Markiere, was einer Leserin oder einem Leser auffallen würde.
5. Wirkt der Text durchgehend schablonenhaft, empfiehl eine Neufassung mit dem Skill `wissenschaftlich-schreiben`. Einzelne Wörter auszutauschen lässt das Gerüst stehen.
6. Die Prüfung ändert keine Dateien. Soll ein überarbeiteter Text gespeichert werden, als neue Version (`kapitel_v2.md`).

## Sofort auffällige Merkmale

1. Chatbot-Reste: „Gerne!“, „Gute Frage“, „Ich hoffe, das hilft“, „Lass mich wissen, wenn …“, „Stand meines letzten Updates“, „[Dein Name]“.
2. Geviertstriche (—) in großer Zahl; im Deutschen jeder Geviertstrich ohne Leerzeichen.
3. „Nicht nur X, sondern auch Y“ / „Es geht nicht um X, es geht um Y“ als Dauermuster.
4. Stichpunktlisten mit fetten Etiketten, Überschriften oder Emojis in Fließtext, E-Mail oder Lerntagebuch.
5. Alles in Dreiergruppen.
6. Aufwärm-Einstiege: „In der heutigen digitalen Welt“, „In einer Zeit, in der …“.
7. Zusammenfassung oder Moral am Absatzende: „Zusammenfassend lässt sich sagen“, „Letztendlich“, „Die Zukunft sieht vielversprechend aus“.
8. Stilwörter: nahtlos, ganzheitlich, Mehrwert, maßgeblich, facettenreich / delve, tapestry, pivotal, seamless, showcase, underscore.
9. Anhängsel: „…, was die Bedeutung unterstreicht“, „…, wodurch ein reibungsloser Ablauf gewährleistet wird“.
10. Durchgehend positiv und allgemein, ohne Zahlen, Belege oder eigene Bewertung.
11. Alle Absätze gleich lang und gleich gebaut.

## Vollständige Checkliste

### Inhaltliche Merkmale
- **Austauschbare Sätze**: Passt der Satz in jeden Text zum Thema? (Wikipedia nennt das „Regression zur Mitte“.)
- **Aufgeblähte Bedeutung**: „ist ein Zeugnis für“, „spielt eine entscheidende Rolle“, „markiert einen Meilenstein“, „nicht zu unterschätzen“, „von zentraler Bedeutung“.
- **Werbeton**: „atemberaubend“, „ein Muss“, „Erfolgsgeschichte“ (Noll/Vode: keine Werbesprache).
- **Vage Belege**: „Experten sagen“, „Studien zeigen“, „viele meinen“ ohne Quelle. In der Facharbeit immer ein Kurzbeleg `(Vgl. Autor Jahr, S. X)` oder streichen.
- **Absicherungsfloskeln**: „Es ist wichtig zu beachten“, „Es sei erwähnt“.
- **Scheinbare Ausgewogenheit**: Pro und Contra ohne Ergebnis. Ein Abschnitt „Herausforderungen“, gefolgt von „trotz dieser Herausforderungen sieht die Zukunft vielversprechend aus“.
- **Zu viel Breite**: jede Facette angetippt, keine vertieft. Gegen die Fragestellung prüfen.
- **Keine Haltung im Schluss**: Die Fragestellung wird nicht klar beantwortet.
- **Zu dicht**: substantivlastig, Nominalisierungen („die Durchführung der Umsetzung“), Partizipialketten (Reinhart et al., PNAS 2025).
- **Falsches Register**: eine Chatnachricht im Berichtston, ein Facharbeitskapitel mit Berater-Vokabular oder Umgangssprache.
- **Erfundene Details**: verdächtig runde Zahlen, Beispiele ohne echte Einzelheiten, nicht prüfbare Quellen. Unbedingt melden.
- **Noll/Vode**: Füllwörter („natürlich“, „eigentlich“, „allerdings“), wertende Wörter („leider“, „viel zu“), ungenaue Mengen („viele“, „einige“), mehrdeutige Adjektive, lange Umschreibungen statt Fachbegriff, übertrieben förmliche Wörter („dezidiert“).

### Strukturmerkmale
- Negativer Parallelismus („nicht X, sondern Y“).
- Dreierregel überall.
- Absatzschablone in Dauerschleife: Themensatz, Stütze, Stütze, Mini-Fazit.
- Enthüllungs-Tricks: „Das Ergebnis?“, „Der Clou:“.
- Scheinbare Spannweiten: „von … bis …“ ohne echte Skala.
- Synonym-Wechsel: „die Stadt … die Metropole … das urbane Zentrum“. In Fachtexten besonders störend, weil Begriffe eindeutig bleiben müssen.
- „Dies + Verb“ am Satzanfang: „Dies unterstreicht …“, „Dies zeigt …“.
- Wegweiser-Floskeln: „Tauchen wir ein“, „Schauen wir uns an“.
- Rhetorische Frage am Ende.

### Rhythmusmerkmale
- Satzlängen zu gleichmäßig. Das Skript markiert einen Variationskoeffizienten unter 0,40; das ist eine Faustregel, kein veröffentlichter Grenzwert.
- Kaum kurze Sätze.
- Absätze alle etwa gleich lang.
- Viele Sätze beginnen mit demselben Wort.

### Formatierungsmerkmale
- Geviertstriche; Stichpunkte mit fetten Etiketten; Emojis; viel Fettdruck.
- Markdown-Zeichen (`**`, `#`) in Texten, die als reiner Text verschickt werden.
- Deutscher Text mit englischen Anführungszeichen ("…" oder “…”) statt „…“, oder mit Geviertstrich ohne Leerzeichen.

### Wortmerkmale
- Deutsch: maßgeblich, vielfältig, nahtlos, ganzheitlich, facettenreich, Meilenstein, unterstreicht, Bereicherung, Mehrwert, essenziell, zudem, somit, letztendlich, gewährleisten, Herausforderungen, Potenzial, innovativ, spannend, zukunftsweisend, wegweisend, darüber hinaus, des Weiteren, in diesem Zusammenhang.
- Englisch: delve, tapestry, testament, intricate, meticulous, pivotal, realm, showcase, underscore, crucial, vital, landscape, navigate, foster, leverage, robust, seamless, holistic, multifaceted, nuanced, comprehensive, elevate, empower, unlock, harness, embark, bustling, vibrant, boast, garner, resonate, interplay, enhance, streamline, cutting-edge, game-changer, paramount, noteworthy, invaluable, ever-evolving, synergy, spearhead, bolster, captivate, profound, beacon, myriad, plethora, nestled, renowned, transformative, groundbreaking, additionally, furthermore, moreover, notably.
- Quelle der englischen Kernliste: Kobak et al., Science Advances 2025 (überzählige Wörter in über 15 Mio. PubMed-Abstracts). Vollständige Liste: github.com/berenslab/llm-excess-vocab.

## Ausgabe des Skripts lesen

Das Skript `scripts/ai_tell_scan.py` ist unverändert übernommen und gibt englische Bezeichnungen aus. Es braucht nur die Python-Standardbibliothek. Bedeutung:

| Ausgabe | Bedeutung |
|---|---|
| `Words / sentences / paragraphs / language guess` | Wörter, Sätze, Absätze, vermutete Sprache |
| `RHYTHM`, `sentence length … variation (CV)` | Satzrhythmus; CV unter 0,40 = gleichförmig (`!! flat rhythm`) |
| `paragraphs too uniform` | Absätze zu gleich lang |
| `repeated sentence openers` | viele Sätze mit gleichem Anfang |
| `FORMATTING` | Geviertstriche, Fettdruck, Etiketten-Stichpunkte, Überschriften, Emojis, falsche Anführungszeichen |
| `RULE OF THREE` | Aufzählungen „X, Y und Z“ |
| `PATTERN HITS` | Treffer je Muster: `style word` (Stilwort), `vague attribution` (vager Beleg), `stock transition` (Floskel-Übergang), `summary / moral ending` (Schlussfloskel), `chatbot leftovers` (Chatbot-Reste), `DE: 'nicht nur ... sondern auch'` usw. |
| `VERDICT` | `reads clean` = unauffällig, `a few tells` = einige Stellen, `reads as AI` = durchgehend schablonenhaft |

Das Skript ist eine Heuristik. Ein sauberer Scan beweist nichts, ein auffälliger zeigt nur, wo du genauer hinsehen solltest. Fachbegriffe wie „Förderung“ oder „nachhaltig“ können im Thema korrekt sein; dann nicht markieren.

## Hinweis zur Herkunft

Der Abschnitt über die Funktionsweise kommerzieller KI-Detektoren wurde nicht übernommen. Für die Facharbeit zählt, dass KI-Nutzung gekennzeichnet ist und der Text die Sprachregeln der Schule erfüllt.
