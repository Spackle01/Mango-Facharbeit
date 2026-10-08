Vierte Testversion (Alpha) von **Mango Facharbeit**. Die App ist jetzt eine richtige Windows-App: aufgeräumter, einfacher, mit Drop-in und neuem Logo.

## Neu

- **Eigenes Fenster ohne Titelleiste.** Keine farbige Windows-Leiste und kein Konsolenfenster mehr. Minimieren, Maximieren und Schließen sitzen oben rechts in den Farben der App (hell und dunkel).
- **Installer statt EXE mit Konsole.** `Mango-Facharbeit-Setup-0.2.0-alpha.exe` installiert die App in Sekunden für dich (ohne Administratorrechte). Danach findest du sie im Startmenü und auf dem Desktop.
- **Drop-in:** Zieh alles, was du schon für deine Facharbeit gemacht hast, einfach ins Fenster: Entwürfe, Notizen, Quellen, Bilder oder ganze Ordner.
  - Mango sortiert alles in die passenden Ordner ein, wandelt Word-Dateien bei Bedarf wortgetreu in bearbeitbaren Text um und ergänzt z. B. die Literaturliste.
  - Arbeitsstand und Projektangaben werden aktualisiert.
  - Danach zeigt Mango eine Übersicht, was einsortiert wurde, was schon da ist und was noch fehlt.
  - Deine Originale bleiben schreibgeschützt und unverändert.
  - Nur an eine Nachricht anhängen: Datei auf das Eingabefeld ziehen.
- **Neues Mango-Logo** in App, Fenster, Taskleiste und Installer.
- **Sparsam unterwegs:**
  - Voreinstellung ist jetzt Sonnet mit der Gründlichkeit „Ausgewogen“.
  - Die Gründlichkeit (Sparsam, Ausgewogen, Gründlich) lässt sich im Modell-Dialog und in den Einstellungen wählen.
  - Der Assistent liest gezielter, schreibt beim Einsortieren keine Inhalte ab und probiert keine unnötigen Schritte.
- **Neue Modelle:** Haiku 5.5 in der Auswahl.

## Verbessert

- **Einfacher:** klare Startseite mit nächsten Schritten und Drop-in-Karte, Einrichtung ohne Pfadfeld (Speicherort nur bei Bedarf ändern), verständlichere Begriffe („Dateien“, „Einsortieren“).
- **Antworten des Assistenten:** keine Zwischenmeldungen oder Fachbegriffe der App mehr im Text, nur das Ergebnis.
- **Word-Umwandlung:** übernimmt Überschriften, Listen, Tabellen sowie Fett und Kursiv.
- **Kontextmenü** mit Rechtschreibvorschlägen, Ausschneiden, Kopieren und Einfügen; Zoomen mit Strg + Plus/Minus.

## Download

- **`Mango-Facharbeit-Setup-0.2.0-alpha.exe`** für Windows 10/11 (64 Bit).
- `….exe.sha256` enthält die Prüfsumme.

## Voraussetzung

Mindestens ein KI-Anbieter, installiert und einmal angemeldet:

- **Claude Code CLI:** in der PowerShell `irm https://claude.ai/install.ps1 | iex`, danach `claude auth login`
- **Antigravity CLI (agy):** in der PowerShell `irm https://antigravity.google/cli/install.ps1 | iex`, danach einmal `agy` starten und mit dem Google-Konto anmelden

## Installieren

1. Setup herunterladen und doppelklicken.
2. Windows SmartScreen meldet einen „unbekannten Herausgeber“, weil diese Alpha nicht signiert ist: **Weitere Informationen → Trotzdem ausführen**.
3. Die App installiert sich und startet. Deinstallieren über die Windows-Einstellungen; deine Projekte und Einstellungen bleiben erhalten.

Projekte und Einstellungen aus den früheren Versionen werden weiterverwendet. Die alte EXE (0.1.x) kann gelöscht werden.

## Bekannte Einschränkungen der Alpha

- Installer und App sind nicht signiert (SmartScreen-Hinweis).
- Welche festen Claude-Versionen dein Konto nutzen darf, kann die App vorab nicht prüfen. Nicht freigeschaltete Modelle meldet sie beim Senden.
- Die Antigravity-Anbindung wurde noch nicht mit einem echten Antigravity-Konto getestet.
- Für macOS und Linux gibt es keine fertige Datei; dort mit Node.js über `npm start` bzw. `npm run desktop` starten.
