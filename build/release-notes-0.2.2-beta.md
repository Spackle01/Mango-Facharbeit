Fehlerbehebungen für die Beta: Antigravity antwortet zuverlässiger, und beim Drop-in gibst du deine Angaben gleich mit ein.

## Behoben

- **„Invalid model“ bei Antigravity:** Lehnt Antigravity das eingestellte Modell ab, wiederholt Mango die Anfrage sofort so, wie die Antigravity CLI im Terminal startet (ohne Modell- und Gründlichkeitsangabe). Du bekommst trotzdem eine Antwort.
  - Hatte Mango das Modell automatisch gewählt, bleibt es danach bei der Voreinstellung von Antigravity.
  - Hast du es selbst gewählt, bleibt deine Wahl. Unter der Antwort steht ein Hinweis mit „Modell wählen“.
- **Denkstufe im Modellnamen:** Bei Modellen wie „Gemini 3.8 Flash (High)“ steht die Denkstufe schon im Namen. Mango schickt dann keine abweichende Gründlichkeit mehr mit.
- **Drop-in direkt nach dem Start:** Nachrichten und das Einsortieren warten jetzt, bis die Prüfung der KI-Anbieter fertig ist, statt gleichzeitig zu starten.

## Verbessert

- **„Ich habe schon angefangen“** fragt jetzt direkt nach Name, Klasse, Titel, Fach, Lehrkraft und Abgabedatum. Was du leer lässt, ergänzt Mango aus deinen Dateien. Was du einträgst, bleibt so.

## Download

- **`Mango-Facharbeit-Setup-0.2.2-beta.exe`** für Windows 10/11 (64 Bit).
- `….exe.sha256` enthält die Prüfsumme.

## Voraussetzung

Mindestens ein KI-Anbieter, installiert und einmal angemeldet:

- **Claude Code CLI** ([Anleitung](https://code.claude.com/docs/en/setup)): in der PowerShell `irm https://claude.ai/install.ps1 | iex`, danach `claude auth login`
- **Antigravity CLI (agy)** ([Anleitung](https://antigravity.google/docs/getting-started?tab=cli)): in der PowerShell `irm https://antigravity.google/cli/install.ps1 | iex`, danach einmal `agy` starten und mit dem Google-Konto anmelden

## Installieren

1. Setup herunterladen und doppelklicken. Es ersetzt die vorherige Beta. Projekte und Einstellungen bleiben erhalten.
2. Windows SmartScreen meldet einen „unbekannten Herausgeber“, weil diese Beta nicht signiert ist: **Weitere Informationen → Trotzdem ausführen**.

## Bekannte Einschränkungen der Beta

- Installer und App sind nicht signiert (SmartScreen-Hinweis).
- Welche Modelle dein Konto nutzen darf, kann die App vorab nicht prüfen. Abgelehnte Modelle fängt sie wie oben beschrieben ab.
- Die Antigravity-Anbindung wurde mit einer nachgebauten CLI getestet, noch nicht mit einem echten Antigravity-Konto.
- Für macOS und Linux gibt es keine fertige Datei. Dort startest du die App mit Node.js über `npm start` bzw. `npm run desktop`.
