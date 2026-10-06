Zweite Testversion (Alpha) von **Mango Facharbeit**. Neu: Eine bereits begonnene Facharbeit lässt sich übernehmen, sodass du direkt weiterarbeiten kannst.

## Neu: Bestehende Arbeit übernehmen

- Beim ersten Start gibt es zwei gleichwertige Wege: **„Neu anfangen“** oder **„Bestehende Arbeit übernehmen“**. Später geht die Übernahme über die Büroklammer im Chat, über „Arbeit übernehmen“ im Arbeitsraum oder indem du einen Ordner in den Chat ziehst.
- Du kannst mehrere Dateien und ganze Ordner auswählen oder hineinziehen: Entwürfe, Notizen, Quellen, Lerntagebuch, Bilder.
- Die Originale bleiben unverändert. Die App kopiert sie nach `uebernommen/<Datum_Uhrzeit>/` und überschreibt nichts. Während der Analyse darf der Assistent nur lesen.
- Die App prüft Lesbarkeit, Umfang, doppelte Dateien und mögliche Entwurfsstände. Danach wertet der Assistent alles aus: Thema, Fragestellung, Gliederung, Texte, Quellen, Eigenanteil und Ergebnisse, abgeglichen mit den Schulvorgaben.
- Erkennbare Projektangaben werden übernommen. Bei Widersprüchen zu deinen Angaben fragt die App nach.
- Der Arbeitsstand wird aktualisiert. Vorhandenes gilt erst nach der Prüfung als erledigt.
- Am Ende steht eine kurze Übersicht im Chat:
  - „Das ist bereits vorhanden“, „Das fehlt noch“ und ein konkreter nächster Schritt
  - unsichere Einschätzungen
  - die Frage nach der aktuellen Fassung, beantwortbar per Knopf
  - nicht lesbare und doppelte Dateien
- Die Zusammenfassung wird gespeichert und in allen späteren Chats mitgegeben. Später nachgereichtes Material ergänzt den Stand.

## Verbessert

- Verständlichere Meldung, wenn der Anbieter überlastet ist.
- Hinweise zu Projektangaben und gemerkten Ergebnissen im Chat brechen sauber um.

## Download

- **`Mango-Facharbeit-0.1.1-alpha-win-x64.exe`** für Windows 10/11 (64 Bit). Node.js muss nicht installiert sein.
- `….exe.sha256` enthält die Prüfsumme.

## Voraussetzung

Mindestens ein KI-Anbieter, installiert und einmal angemeldet:

- **Claude Code CLI:** in der PowerShell `irm https://claude.ai/install.ps1 | iex`, danach `claude auth login`
- **Antigravity CLI (agy):** in der PowerShell `irm https://antigravity.google/cli/install.ps1 | iex`, danach einmal `agy` starten und mit dem Google-Konto anmelden

## Starten

1. EXE herunterladen und doppelklicken.
2. Windows SmartScreen meldet einen „unbekannten Herausgeber“, weil diese Alpha nicht signiert ist: **Weitere Informationen → Trotzdem ausführen**.
3. Ein Konsolenfenster öffnet sich und muss geöffnet bleiben. Die App erscheint in einem eigenen Edge- bzw. Chrome-Fenster. Zum Beenden das Konsolenfenster schließen.

Bestehende Projekte aus 0.1.0-alpha werden weiterverwendet.

## Bekannte Einschränkungen der Alpha

- Die EXE ist nicht signiert (SmartScreen-Hinweis beim ersten Start).
- Die Antigravity-Anbindung wurde noch nicht mit einem echten Antigravity-Konto getestet. Antigravity kennt keinen reinen Lesemodus; bei der Übernahme schützt dort nur die Wiederherstellung veränderter Dateien durch die App.
- Für macOS und Linux gibt es keine fertige Datei; dort mit Node.js über `npm start` starten.
- Textauszüge aus PDF-Dateien gibt es nur, wenn `pdftotext` installiert ist; sonst liest der Anbieter die PDF selbst.
