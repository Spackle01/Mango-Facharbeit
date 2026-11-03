# Schreib-Skills

Dieses Paket enthält vier eigenständig nutzbare Skills für natürliche deutsche Texte. Es ist vollständig in diesem Ordner abgelegt; die ursprüngliche Projekt-Recherche wird zum Nachlesen mitgeliefert.

## Den passenden Skill wählen

| Aufgabe | Einstieg |
|---|---|
| Einen neuen Text schreiben | [natuerlich-schreiben/SKILL.md](natuerlich-schreiben/SKILL.md) |
| Die eigene Schreibstimme aus Beispielen beschreiben | [stimmenprofil/SKILL.md](stimmenprofil/SKILL.md) |
| Einen bestehenden Text überarbeiten | [stilrevision/SKILL.md](stilrevision/SKILL.md) |
| Einen Text beurteilen und konkrete Schwächen finden | [textpruefung/SKILL.md](textpruefung/SKILL.md) |

Jeder Unterordner enthält eine `SKILL.md`, die zugehörigen Referenzen und Metadaten für Systeme mit Skill-Unterstützung. Es wurde nichts global installiert und keine bestehende Konfiguration verändert.

## Direkt anwenden

Gib der KI Zugriff auf den passenden Skill-Unterordner und fordere sie auf, zuerst dessen `SKILL.md` zu lesen. Die dort verlinkten Referenzen werden nur bei Bedarf gelesen. Das Paket benötigt weder einen kostenpflichtigen Dienst noch eine Detektorverbindung. Wenn ein Modell keine lokalen Dateien lesen kann, müssen die Anleitung und die für den Auftrag nötigen Referenzen in dessen Kontext bereitgestellt werden; das bloße Nennen eines lokalen Pfads überträgt keine Dateien.

Beispielaufträge bei eingebundenen Skills:

```text
Nutze $natuerlich-schreiben für eine kurze, freundliche Mail an einen
Geschäftspartner. Die folgenden Fakten und Bedingungen müssen erhalten bleiben: …

Nutze $stimmenprofil, um aus diesen von mir geschriebenen Beispielen
ein Profil für berufliche E-Mails abzuleiten: …

Nutze $stilrevision für den folgenden Text. Erhalte meine Position,
alle Zahlen und den formellen Ton. Kürze nur, wo keine Information verloren geht: …

Nutze $textpruefung und nenne nur relevante Probleme mit konkreten
Textstellen. Zielgruppe und Anlass sind: …
```

Die Reihenfolge ist frei. Für einen normalen Text reicht der passende einzelne Skill. Ein gespeichertes Stimmenprofil kann später zusammen mit einem neuen Auftrag verwendet werden. Ein Review ist optional und schreibt den Text nicht ungefragt um.

## Was das Paket leisten soll

- Sprache an Leser, Anlass, Medium und gewünschte Stimme anpassen.
- Gedankenführung, Wortwahl, Satzbau, Rhythmus und Zeichensetzung im Zusammenhang bearbeiten.
- Floskeln nach ihrer tatsächlichen Funktion prüfen und sinnvolle Formulierungen erhalten.
- Zahlen, Aussagen, Bedingungen, Unsicherheit und persönliche Eigenheiten bewahren.
- Ohne erfundene Erlebnisse, absichtliche Fehler oder künstliche Zeichenstörungen auskommen.

## Wissensbasis und Prüfung

Die [vollständige Recherche](wissensbasis/README.md) enthält 37 eigenständige Quellen mit Prüfgrenzen. Sie ist als unveränderter Stand **vor Erstellung dieses Pakets** mitgeliefert. Ihre Aussagen über damals noch nicht gebaute Skills beziehen sich auf diesen früheren Stand. Sie ist für Nachweise und Weiterentwicklung gedacht; die KI muss sie nicht vor jeder Nachricht vollständig lesen. Die einzelnen Skills enthalten die für ihre Aufgabe nötigen Arbeitsanweisungen selbst.

Das Paket behauptet keine garantierte Ununterscheidbarkeit und keine Wirksamkeit gegen sämtliche Detektoren. Natürlichkeit, Inhaltstreue und technische Herkunftssignale sind unterschiedliche Größen. Aktueller Prüfstatus und Grenzen stehen in [PRUEFUNG.md](PRUEFUNG.md).
