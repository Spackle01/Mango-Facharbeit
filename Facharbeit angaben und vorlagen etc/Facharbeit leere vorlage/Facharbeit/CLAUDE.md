# CLAUDE.md – Leitfaden für Claude zur Betreuung der Facharbeit

Dieses Dokument verbindet Claude mit den Richtlinien der Facharbeit an der IBB Privaten Schule Dresden.

> 📖 **Vollständige Richtlinien**: Siehe [`AGENTS.md`](file:///c:/Users/pick_/Downloads/Facharbeit/AGENTS.md) für alle Details, Bewertungsraster und Zitierregeln.

---

## ⚡ Wichtigste Arbeitsregeln für Claude

1. **Projektstatus als Erstes prüfen & pflegen**:
   - Lies zu Beginn jeder Sitzung [`facharbeit_workspace/mein_facharbeit_projekt.md`](file:///c:/Users/pick_/Downloads/Facharbeit/facharbeit_workspace/mein_facharbeit_projekt.md) ein.
   - Wenn der Schüler Angaben zu Thema, Fachrichtung, Fragestellung oder Betreuer macht, **speichere diese Daten sofort direkt in `mein_facharbeit_projekt.md`**, damit alle zukünftigen Sessions den exakten Kontext kennen.
2. **Humanize-Writing-Skill anwenden**: Lies vor dem Verfassen oder Überarbeiten von Texten den Skill [`.agents/skills/humanize-writing/SKILL.md`](file:///c:/Users/pick_/Downloads/Facharbeit/.agents/skills/humanize-writing/SKILL.md) ein, um steife KI-Muster zu vermeiden.
3. **Aktive Co-Autorenschaft & Recherche**:
   - Schreibe konkrete Textentwürfe auf wissenschaftlichem Niveau (sachlich, präzise, passivischer Hauptteil, Fachbegriffe).
   - Achte auf die Einhaltung des Umfangs (10–15 reine Textseiten).
   - Nutze Harvard-Kurzbelege: `(Autor Jahr, S. X)` bzw. `(Vgl. Autor Jahr, S. X)`.
4. **Echte Fachquellen verwenden**:
   - Schlage verifizierbare Fachliteratur und Studien vor (z. B. SLUB Dresden, DBIS, DNB, Springer, Hanser, Vahlen etc.).
5. **Automatische Prompt-Dokumentation**:
   - Pflege nach relevanten Text- und Recherche-Generierungen automatisch die Tabelle in [`facharbeit_workspace/07_ki_prompts_anhang/ki_protokoll.md`](file:///c:/Users/pick_/Downloads/Facharbeit/facharbeit_workspace/07_ki_prompts_anhang/ki_protokoll.md), damit der Schüler formal abgesichert ist.
6. **Ordnung im Workspace halten**:
   - Speichere alle Zwischenergebnisse in den dafür vorgesehenen Ordnern `01_` bis `08_` in `facharbeit_workspace/`.
