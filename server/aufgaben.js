'use strict';
// Aufgabenliste für den Arbeitsstand. Abgeleitet aus den Schulvorgaben
// (siehe ressourcen/vorgaben/anforderungen.md). Jede Aufgabe nennt ihre Quelle.

const STATUS = ['offen', 'in_arbeit', 'erledigt'];

const STATUS_INFO = {
  offen: { symbol: '×', label: 'Offen', bedeutung: 'Noch nicht begonnen' },
  in_arbeit: { symbol: '?', label: 'In Arbeit', bedeutung: 'Begonnen, aber noch nicht abgeschlossen oder geprüft' },
  erledigt: { symbol: '✓', label: 'Erledigt', bedeutung: 'Fertiggestellt und anhand der Vorgaben geprüft' },
};

const PHASEN = [
  { id: 'vorbereitung', titel: 'Vorbereitung' },
  { id: 'konsultationen', titel: 'Exposé und Konsultationen' },
  { id: 'erarbeitung', titel: 'Eigenanteil und Schreiben' },
  { id: 'fertigstellung', titel: 'Fertigstellung und Abgabe' },
  { id: 'verteidigung', titel: 'Verteidigung' },
];

// frist: ISO-Datum (lokale Zeit) oder null. extern: Ergebnis entsteht außerhalb der App
// (Termin, Unterschrift, Abgabe) – der Assistent darf diese nicht selbst auf „erledigt“ setzen.
const AUFGABEN = [
  {
    id: 'mindmap', phase: 'vorbereitung', titel: 'Mindmap mit drei Themenbereichen',
    hilfe: 'Mindmap nach dem Leitfaden der Schule (Interessen, sichere Fächer, Stärken, Schwächen, Unterstützungsbedarf) und daraus drei mögliche Themenbereiche ableiten. Wird zur G1-Konsultation vorgelegt.',
    quelle: 'Aufgabe Mindmap; Lerntagebuch 1.1.3; Zeitschiene', frist: '2026-08-26T12:00',
  },
  {
    id: 'thema', phase: 'vorbereitung', titel: 'Arbeitsthema festlegen und abgeben',
    hilfe: 'Thema mit Bezug zu zwei Fächern und erkennbarem Profilfach-Bezug, mit Problemcharakter. Mit der Fachlehrkraft absprechen; die Schulleitung bestätigt. Digitale Abgabe des Arbeitsthemas.',
    quelle: 'Handreichung 1, 2, 3.1; Zeitschiene', frist: '2026-07-02T11:00', extern: true,
  },
  {
    id: 'fragestellung', phase: 'vorbereitung', titel: 'Fragestellung oder These formulieren',
    hilfe: 'Eine zentrale Fragestellung oder eine These, logisch aufgebaut und widerspruchsfrei. Thema sinnvoll eingrenzen (z. B. zeitlich, nach Personengruppe, Fallbeispiel).',
    quelle: 'Handreichung 3.4, 3.5; Zeitschiene', frist: null,
  },
  {
    id: 'zeitplan', phase: 'vorbereitung', titel: 'Arbeits- und Zeitplan erstellen',
    hilfe: 'Selbstständig erstellter Plan mit Meilensteinen bis zur Abgabe. Wird in der 1. Einzelkonsultation vorgelegt. Empfohlen: ALPEN-Methode.',
    quelle: 'Handreichung 3.3, 4.1; Zeitschiene', frist: null,
  },
  {
    id: 'recherche', phase: 'vorbereitung', titel: 'Literatur- und Quellenrecherche',
    hilfe: 'Empfohlen: mindestens zwei bis drei Standardwerke und weitere Fachzeitschriften. Im Lerntagebuch: Bibliotheksbesuch und mindestens drei Internetquellen mit URL und bibliografischer Angabe. Angaben sofort vollständig notieren.',
    quelle: 'Handreichung 3.7, 4.2; Lerntagebuch-Vorlage', frist: null,
  },
  {
    id: 'gliederung', phase: 'vorbereitung', titel: 'Gliederung erstellen',
    hilfe: 'Vorläufige Gliederung, später anpassen. Bei Untergliederung mindestens zwei Unterpunkte (2.1 und 2.2). Überschriften kurz und inhaltsbezogen.',
    quelle: 'Handreichung 4.3.1 C; Zeitschiene', frist: null,
  },
  {
    id: 'lerntagebuch', phase: 'vorbereitung', titel: 'Lerntagebuch fortlaufend führen',
    hilfe: 'Digital nach der Schulvorlage, unmittelbar nach jeder Aktivität aktualisieren, jederzeit für den Mentor einsehbar. In der Schreibphase nach jedem Arbeitstag: Datum, Arbeitszeit, Aufgaben, Notizen, Reflexion.',
    quelle: 'Handreichung 3.3; Lerntagebuch-Vorlage', frist: null,
  },
  {
    id: 'konsultation_g1', phase: 'konsultationen', titel: 'G1-Pflichtkonsultation (Gruppe)',
    hilfe: 'Mindmap, erste Recherchen und mögliche empirische Methoden vorlegen. Nächste Schritte im Nachweis- und Betreuungsheft dokumentieren.',
    quelle: 'Handreichung 3.2; Zeitschiene', frist: '2026-08-26T12:00', extern: true,
  },
  {
    id: 'expose', phase: 'konsultationen', titel: 'Exposé schreiben',
    hilfe: 'Mindestens 400 Wörter, höchstens zwei A4-Seiten. Was (Thema, Begründung, Zielstellung, Fragestellung), Wie (Methode, Theorie, vorläufige Gliederung, Quellenverzeichnis, Arbeits- und Zeitplan), Warum (Relevanz). Grundlage der 1. Einzelkonsultation.',
    quelle: 'Aufgabe Exposé; Handreichung Anhang 4; Lerntagebuch-Vorlage', frist: null,
  },
  {
    id: 'konsultation_1', phase: 'konsultationen', titel: '1. Einzelkonsultation',
    hilfe: 'Arbeitsplan und Exposé vorlegen, Lerntagebuch dokumentieren. Ergebnisse im Nachweis- und Betreuungsheft festhalten. Termin mit der Lehrkraft vereinbaren.',
    quelle: 'Handreichung 3.2; Zeitschiene', frist: '2026-11-27T23:59', extern: true,
  },
  {
    id: 'konsultation_2', phase: 'konsultationen', titel: '2. Einzelkonsultation',
    hilfe: 'Inhaltliche und formale Fragen zur Endfassung klären, Lerntagebuch dokumentieren, Nachweisheft. Letzter möglicher Konsultationstermin ist der 27.11.2026.',
    quelle: 'Handreichung 3.2; Zeitschiene', frist: '2026-11-27T23:59', extern: true,
  },
  {
    id: 'eigenanteil', phase: 'erarbeitung', titel: 'Eigenanteil durchführen und auswerten',
    hilfe: 'Eigene Untersuchung (z. B. Beobachtung, Experiment, Befragung, Interview) durchführen, analysieren und auswerten. Gütekriterien Objektivität, Reliabilität, Validität beachten.',
    quelle: 'Handreichung 3.6; Zeitschiene', frist: '2026-11-27T23:59',
  },
  {
    id: 'einleitung', phase: 'erarbeitung', titel: 'Einleitung schreiben',
    hilfe: 'Problem, Relevanz, Fragestellung oder These, Abgrenzung, Methode und Überblick über die Gliederung. Höchstens 10 % des Textes. Ich-Form möglich.',
    quelle: 'Handreichung 4.1, 4.3.1 D', frist: '2026-11-27T23:59',
  },
  {
    id: 'hauptteil', phase: 'erarbeitung', titel: 'Hauptteil schreiben',
    hilfe: 'Ca. 80 % des Textes: Begriffsdefinitionen, fachliche Grundlagen, methodisches Vorgehen, Eigenanteil, Ergebnisse zur Fragestellung. Belege als Kurzbeleg im Text, eher passivische Formulierungen.',
    quelle: 'Handreichung 4.1, 4.3.1 D, 4.4', frist: '2026-11-27T23:59',
  },
  {
    id: 'fazit', phase: 'erarbeitung', titel: 'Schluss und Fazit schreiben',
    hilfe: 'Ca. 10 % des Textes: Zusammenfassung, Beantwortung der Fragestellung bzw. Bestätigung oder Widerlegung der These, Bewertung, ggf. Ausblick.',
    quelle: 'Handreichung 4.3.1 D; Zeitschiene', frist: '2026-11-27T23:59',
  },
  {
    id: 'titelblatt', phase: 'fertigstellung', titel: 'Titelblatt',
    hilfe: 'Nach dem Muster der Schule, ohne Seitenzahl: Schule, „Facharbeit im Fach … mit Bezug zum Fach …“, Titel, Verfasser, Klasse, Schuljahr, Betreuer, Ort und Datum.',
    quelle: 'Handreichung 4.3.1 A', frist: '2026-12-05T23:59',
  },
  {
    id: 'inhaltsverzeichnis', phase: 'fertigstellung', titel: 'Inhaltsverzeichnis',
    hilfe: 'Alle wesentlichen Teile mit rechtsbündigen Seitenzahlen, die mit dem Text übereinstimmen, einschließlich Verzeichnissen und Anlagen.',
    quelle: 'Handreichung 4.3.1 C', frist: '2026-12-05T23:59',
  },
  {
    id: 'literaturverzeichnis', phase: 'fertigstellung', titel: 'Quellen- und Literaturverzeichnis',
    hilfe: 'Alphabetisch, vollständige Angaben im Format der Schule, Internetquellen mit Zugriffsdatum, KI-Tools als Hilfsmittel aufgeführt.',
    quelle: 'Handreichung 4.3.1 E, 4.4.3', frist: '2026-12-05T23:59',
  },
  {
    id: 'anlagen', phase: 'fertigstellung', titel: 'Anlagenverzeichnis und Anlagen',
    hilfe: 'Jede Anlage mit Überschrift, fortlaufend nummeriert, im Text referenziert (z. B. Fragebogen blanko, anonymisierte Transkripte, Diagramme).',
    quelle: 'Handreichung 4.3.1 F', frist: '2026-12-05T23:59',
  },
  {
    id: 'ki_nachweis', phase: 'fertigstellung', titel: 'KI-Nutzung kennzeichnen',
    hilfe: 'KI-Einsatz kennzeichnen („Erstellt mithilfe von … Prompt 1: …“), vollständige Gesprächsverläufe in den Anhang, KI-Tools im Literaturverzeichnis als Hilfsmittel. KI-Ergebnisse nicht als Beleg verwenden.',
    quelle: 'Handreichung 3.6, 4.4.3; KI-Unterstützung', frist: '2026-12-05T23:59',
  },
  {
    id: 'formatierung', phase: 'fertigstellung', titel: 'Formatierung nach Vorgaben',
    hilfe: 'A4 einseitig; Arial oder Calibri 11 pt bzw. Times New Roman 12 pt; Zeilenabstand 1,5; Fußnoten 9 pt einzeilig; Rand links 2,5 cm, sonst 2,0 cm; Seitenzahl oben zentriert ab Einleitung; Abbildungen mit Unterschrift, Tabellen mit Überschrift.',
    quelle: 'Handreichung 4.3.2', frist: '2026-12-05T23:59',
  },
  {
    id: 'umfang', phase: 'fertigstellung', titel: 'Umfang und Anteile prüfen',
    hilfe: 'Einleitung, Hauptteil und Schluss zusammen 10 bis 15 Seiten. Einleitung höchstens 10 %, Hauptteil ca. 80 %, Schluss ca. 10 %.',
    quelle: 'Handreichung 4.3.1 D; § 14 FOSO', frist: '2026-12-05T23:59',
  },
  {
    id: 'korrektur', phase: 'fertigstellung', titel: 'Reinschrift und Korrekturlesen',
    hilfe: 'Korrekturlesen und von einer dritten Person lesen lassen, Korrekturen einarbeiten, Zitate prüfen, digitalisieren, doppelte Datensicherung.',
    quelle: 'Zeitschiene; Handreichung 4.5', frist: '2026-12-05T23:59',
  },
  {
    id: 'erklaerung', phase: 'fertigstellung', titel: 'Selbstständigkeitserklärung',
    hilfe: 'Wortlaut der Schule mit Ort, Datum und Unterschrift; eingescannt für die digitale Abgabe.',
    quelle: 'Handreichung 4.3.3, 4.5', frist: '2026-12-07T16:00', extern: true,
  },
  {
    id: 'abgabe', phase: 'fertigstellung', titel: 'Abgabe',
    hilfe: 'Einmal gedruckt im Sekretariat; digital als Word und PDF mit allen Anhängen und eingescannter Erklärung auf Teams; Nachweis- und Betreuungsheft abgeben.',
    quelle: 'Handreichung 4.5; Zeitschiene', frist: '2026-12-07T16:00', extern: true,
  },
  {
    id: 'praesentation', phase: 'verteidigung', titel: 'Präsentation vorbereiten',
    hilfe: '15 Minuten Vortrag in Dreiteilung, mit Quellenangaben. Eigenes Endgerät mit HDMI; USB-Sticks und externe Festplatten sind nicht erlaubt.',
    quelle: 'Handreichung 5.2; Zeitschiene', frist: '2027-02-23T08:00',
  },
  {
    id: 'fachgespraech', phase: 'verteidigung', titel: 'Fachgespräch vorbereiten',
    hilfe: '15 Minuten Fragen von zwei Fachlehrern: Methode begründen, Ergebnisse reflektieren, Fehler selbst erkennen, Fachfragen sicher beantworten.',
    quelle: 'Handreichung 5.2, Anhang 6', frist: '2027-02-23T08:00',
  },
];

const AUFGABEN_BY_ID = new Map(AUFGABEN.map((a) => [a.id, a]));

module.exports = { STATUS, STATUS_INFO, PHASEN, AUFGABEN, AUFGABEN_BY_ID };
