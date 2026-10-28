Mango aktualisiert sich jetzt selbst: Gibt es eine neue Version, erscheint oben rechts ein Knopf.

## Neu

- **Update-Knopf:** Beim Start (und alle paar Stunden) fragt Mango bei GitHub nach einer neueren Version. Gibt es eine, erscheint oben rechts ein kleiner Knopf mit Pfeil-Symbol. Ein Klick zeigt, was neu ist. Mit **Jetzt aktualisieren** lädt Mango die neue Setup-Datei herunter, prüft die Prüfsumme, installiert sie und startet sich neu. Projekte und Einstellungen bleiben erhalten. Ein neues Setup musst du nicht mehr selbst herunterladen.
- **Sicher:** Es wird nur auf deinen Klick installiert, und nur Dateien aus den Releases dieses Projekts auf GitHub werden akzeptiert. Läuft gerade eine Antwort der KI, wartet das Update.
- **Einstellungen → Updates:** Die Suche lässt sich ausschalten, und „Jetzt suchen“ prüft sofort.

## Wichtig

Den Update-Knopf hat erst diese Version. Wenn du von einer älteren Version kommst, installierst du dieses Setup noch einmal von Hand. Ab dann zeigt Mango neue Versionen selbst an.

## Download







- **`Mango-Facharbeit-Setup-0.2.9-beta.exe`** für Windows 10/11 (64 Bit).
- `….exe.sha256` enthält die Prüfsumme.

## Voraussetzung

Mindestens ein KI-Anbieter, installiert und einmal angemeldet:

- **Claude Code CLI** ([Anleitung](https://code.claude.com/docs/en/setup)): in der PowerShell `irm https://claude.ai/install.ps1 | iex`, danach `claude auth login`
- **Antigravity CLI (agy)** ([Anleitung](https://antigravity.google/docs/getting-started?tab=cli)): in der PowerShell `irm https://antigravity.google/cli/install.ps1 | iex`, danach einmal `agy` starten und mit dem Google-Konto anmelden. Ältere Versionen aktualisierst du mit `agy update`.

## Installieren

1. Setup herunterladen und doppelklicken. Es ersetzt die vorherige Beta, Projekte und Einstellungen bleiben erhalten.
2. Windows SmartScreen meldet einen „unbekannten Herausgeber“, weil diese Beta nicht signiert ist: **Weitere Informationen → Trotzdem ausführen**.

## Bekannte Einschränkungen der Beta

- Installer und App sind nicht signiert (SmartScreen-Hinweis). Das gilt auch für Updates; die stille Installation zeigt keine Rückfrage.
- Die nachgezeichnete Folienansicht kommt dem Original sehr nahe, ist aber nicht identisch (z. B. Effekte, Animationen, Diagramme und SmartArt fehlen; Diagramme erscheinen als Platzhalter). Das genaue Aussehen zeigt die Originalansicht oder „Im Programm öffnen“.
- Die Umwandlung über PowerPoint und Word ist neu und wurde nur mit LibreOffice getestet, nicht mit einer installierten Microsoft-Office-Version. Klappt sie nicht, bleibt die nachgezeichnete Ansicht.
- Word und Excel erscheinen ohne Office weiterhin vereinfacht.
- Für macOS und Linux gibt es keine fertige Datei. Dort startest du die App mit Node.js über `npm start` bzw. `npm run desktop`.
