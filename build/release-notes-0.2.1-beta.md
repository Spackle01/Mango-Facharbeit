Fehlerbehebung für die Beta: Mango wählt den KI-Anbieter und das Modell beim Start jetzt selbst.

## Behoben

- **„Claude Code nicht verfügbar“, obwohl Antigravity installiert ist.** Ist nur Antigravity installiert, wechselt Mango beim Start automatisch zu Antigravity. Die Verbindung wird dabei gleich geprüft.

## Neu

- **Automatische Wahl von Anbieter und Modell:**
  - Ist Claude Code bereit, nutzt Mango Claude Code mit der neuesten Sonnet-Version.
  - Ist nur Antigravity installiert, nimmt Mango das beste Gemini-Modell aus deinem Konto: Pro vor Flash, dann die neueste Version, dann die höchste Denkstufe (z. B. Gemini 3.1 Pro (High)).
  - Was du selbst eingestellt hast, bleibt. Mango wechselt nur, wenn dein gewählter Anbieter gar nicht installiert ist.
- **Kein Anbieter installiert?** Über dem Eingabefeld erscheint eine Einrichtungskarte mit beiden Wegen:
  - Claude Code und Antigravity mit Link zur offiziellen Anleitung.
  - Ein kurzer Hinweis, welches Konto du brauchst.
  - Der Installationsbefehl zum Kopieren.
  - Nach der Installation genügt „Erneut prüfen“. Mango richtet den Anbieter sofort ein, ohne Neustart.
- **Einstellungen:** Bei einem fehlenden Anbieter steht dort jetzt auch der Link zur Installationsanleitung.

## Download

- **`Mango-Facharbeit-Setup-0.2.1-beta.exe`** für Windows 10/11 (64 Bit).
- `….exe.sha256` enthält die Prüfsumme.

## Voraussetzung

Mindestens ein KI-Anbieter, installiert und einmal angemeldet:

- **Claude Code CLI** ([Anleitung](https://code.claude.com/docs/en/setup)): in der PowerShell `irm https://claude.ai/install.ps1 | iex`, danach `claude auth login`
- **Antigravity CLI (agy)** ([Anleitung](https://antigravity.google/docs/getting-started?tab=cli)): in der PowerShell `irm https://antigravity.google/cli/install.ps1 | iex`, danach einmal `agy` starten und mit dem Google-Konto anmelden

## Installieren

1. Setup herunterladen und doppelklicken. Es ersetzt die 0.2.0-beta, Projekte und Einstellungen bleiben erhalten.
2. Windows SmartScreen meldet einen „unbekannten Herausgeber“, weil diese Beta nicht signiert ist: **Weitere Informationen → Trotzdem ausführen**.

## Bekannte Einschränkungen der Beta

- Installer und App sind nicht signiert (SmartScreen-Hinweis).
- Welche festen Claude-Versionen dein Konto nutzen darf, kann die App vorab nicht prüfen. Nicht freigeschaltete Modelle meldet sie beim Senden.
- Die Antigravity-Anbindung wurde noch nicht mit einem echten Antigravity-Konto getestet.
- Für macOS und Linux gibt es keine fertige Datei; dort mit Node.js über `npm start` bzw. `npm run desktop` starten.
