# Teamplaner

Eine kleine Web-App, mit der ein Team seine Gruppenarbeit organisiert:

- **Übersicht** mit Gesamtfortschritt, Abgabetermin, nächstem Treffen und Fortschritt jeder Person
- **Team**: Personen mit Rolle und E-Mail-Adresse
- **Aufgaben**: Zuteilung an Personen, Fälligkeit, Fortschritt (0–100 %) und **Abhängigkeiten** („Kapitel 1 kann erst starten, wenn die Gliederung fertig ist“). Die App zeigt, was bereit ist und was noch wartet, und verhindert Kreise (A wartet auf B, B auf A).
- **Formalia**: Seitenzahl, Wörter, Quellenanzahl (mit Mindest-/Höchstwert) sowie Ja/Nein-Vorgaben wie Schriftart, Zeilenabstand, Zitierstil. Die App zeigt, was noch fehlt.
- **Termine**: Abgabetermin und Gruppentreffen mit Aufgaben für alle („bis zum Treffen mindestens 3 Quellen finden“). Wer erledigt hat, wird per Klick abgehakt.
- **Erinnerung per E-Mail**: Einen Tag vor jedem Treffen bekommt jede Person eine Mail mit Termin, ihren noch offenen Treffen-Aufgaben und ihren offenen Projektaufgaben.

Es ist nichts zu installieren und keine Programmiersprache nötig, nur HTML, CSS und JavaScript.

---

## Schritt 1: Ausprobieren (2 Minuten, ohne Einrichtung)

1. Dieses Repository herunterladen (grüner Button **Code → Download ZIP**) und entpacken.
2. Die App muss über einen kleinen Webserver geöffnet werden (ein Doppelklick auf `index.html` genügt wegen Browser-Sicherheitsregeln nicht). Am einfachsten, wenn Node.js installiert ist: im Ordner `npx serve` ausführen und die angezeigte Adresse öffnen. Alternativ mit Python: `python3 -m http.server` und dann <http://localhost:8000> öffnen.
3. Auf **„Mit Beispieldaten ausprobieren“** klicken und alles ansehen.

In diesem **Demo-Modus** liegen die Daten nur in eurem Browser. Für die gemeinsame Arbeit folgt Schritt 2.

---

## Schritt 2: Gemeinsame Daten (einmalig, eine Person richtet ein)

Damit alle im Team dieselben Daten sehen, speichert die App in einer kostenlosen Datenbank bei [Supabase](https://supabase.com).

1. Bei Supabase ein Konto anlegen und ein **neues Projekt** erstellen (Name und Datenbank-Passwort frei wählen, Region z. B. Frankfurt).
2. Im Projekt links auf **SQL Editor** klicken, den Inhalt von `supabase/schema.sql` einfügen und **vorher** an den zwei Stellen `HIER-EUREN-TEAM-CODE` ein langes, zufälliges Passwort eintragen. Das ist euer **Team-Code**. Dann **Run**.
3. Unter **Project Settings → API** die **Project URL** und den **anon public key** (bzw. „Publishable key“) kopieren und in `config.js` eintragen.
4. Änderung auf GitHub hochladen (committen).

**Warum ein Team-Code?** Die Webseite ist öffentlich, und URL und Key stehen sichtbar im Code. Ohne Team-Code könnte jeder, der die Adresse findet, eure Daten und E-Mail-Adressen lesen oder ändern. Mit dem Code sieht die Datenbank für Fremde einfach „leer“ aus. Den Code gebt ihr nur im Team weiter (nicht ins Repository schreiben!). Beim ersten Öffnen fragt die App danach und merkt ihn sich im Browser.

### Webseite veröffentlichen (GitHub Pages)

1. Im GitHub-Repository: **Settings → Pages**
2. Bei **Branch** `main` und Ordner `/ (root)` wählen, **Save**.
3. Nach ein bis zwei Minuten ist die App unter `https://<euer-name>.github.io/<repo-name>/` erreichbar. Diese Adresse schickt ihr an alle im Team.

Hinweis: GitHub Pages ist öffentlich erreichbar (bei kostenlosen Konten muss das Repository dafür öffentlich sein). Die Daten selbst sind durch den Team-Code geschützt, der Programmcode ist aber sichtbar. Schreibt deshalb keine Passwörter in Dateien im Repository.

---

## Schritt 3: E-Mail-Erinnerungen einrichten

Ein kleines Skript (`scripts/send-reminders.js`) läuft jeden Tag automatisch bei GitHub (Datei `.github/workflows/erinnerungen.yml`, standardmäßig um 16:00 UTC, also 17:00 Uhr im Winter und 18:00 Uhr im Sommer). Findet am nächsten Tag ein Treffen statt, werden die Mails verschickt.

Ihr braucht dafür ein E-Mail-Konto, über das gesendet wird (z. B. ein eigenes Gmail-Konto nur für das Projekt). Bei Gmail muss die Bestätigung in zwei Schritten aktiv sein, dann erzeugt ihr unter <https://myaccount.google.com/apppasswords> ein **App-Passwort** (nicht das normale Passwort verwenden!).

Im GitHub-Repository unter **Settings → Secrets and variables → Actions → New repository secret** diese Einträge anlegen:

| Name | Inhalt (Beispiel für Gmail) |
|---|---|
| `SUPABASE_URL` | dieselbe Project URL wie in `config.js` |
| `SUPABASE_KEY` | derselbe Key wie in `config.js` |
| `TEAM_CODE` | euer Team-Code aus Schritt 2 |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | die Gmail-Adresse |
| `SMTP_PASS` | das App-Passwort |
| `MAIL_FROM` | z. B. `Teamplaner <deine.adresse@gmail.com>` |

**Testen:** Unter **Actions → Erinnerungen per E-Mail → Run workflow**. Der Lauf sendet nur dann Mails, wenn am Folgetag ein Treffen eingetragen ist. Zum Ausprobieren also ein Treffen für morgen anlegen und beim Team mindestens eine E-Mail-Adresse hinterlegen.

Gut zu wissen:

- GitHub startet geplante Läufe manchmal ein paar Minuten später.
- In Repositories ohne jede Aktivität schaltet GitHub geplante Läufe nach etwa 60 Tagen ab. Wenn das passiert, in **Actions** wieder aktivieren.
- Im öffentlichen Log stehen nur Vornamen, keine E-Mail-Adressen.

### Und WhatsApp?

Bewusst nicht enthalten: WhatsApp erlaubt automatische Nachrichten nur über die kostenpflichtige Business-API (mit Firmenverifizierung). Wer das später möchte, kann in `scripts/send-reminders.js` neben `sendMail` einen zweiten Versandweg ergänzen. Die fertig formulierten Texte liefert `remindersFor()` aus `src/logic.js`.

---

## Wie arbeitet ihr gemeinsam am Programm? (GitHub für Einsteiger)

- Jede Änderung am Programm wird ein **Commit**. Kleine Änderungen direkt auf der GitHub-Webseite: Datei öffnen → Stift-Symbol → ändern → **Commit changes**.
- Für größere Änderungen: einen **Branch** anlegen und einen **Pull Request** eröffnen, damit jemand anderes kurz draufschaut, bevor es in `main` kommt.
- Bei jedem Hochladen laufen die automatischen **Tests** (`.github/workflows/tests.yml`). Ein grüner Haken heißt: Die Rechenlogik funktioniert noch.

### Aufbau des Projekts

```
index.html              Gerüst der Seite
style.css               Aussehen
config.js               Einstellungen (Supabase-URL und -Key)
src/logic.js            Rechenlogik: Fortschritt, Abhängigkeiten, Formalia, Erinnerungstexte
src/storage.js          Speichern/Laden (Browser oder Supabase)
src/app.js              Oberfläche (Ansichten, Formulare, Klicks)
scripts/send-reminders.js   verschickt die E-Mails
supabase/schema.sql     Datenbank-Einrichtung
test/logic.test.js      Tests für src/logic.js
.github/workflows/      automatische Läufe (Erinnerungen, Tests)
```

Gute Einstiegsaufgaben für Anfänger: Texte in `src/app.js` anpassen, Farben in `style.css` ändern (die Werte ganz oben unter `:root`), neue typische Vorgaben in `REQUIREMENT_PRESETS` in `src/logic.js` ergänzen.

Tests lokal ausführen (mit Node.js ab Version 20): `node --test`

Erinnerungstext ausprobieren, ohne zu senden: in der App **Daten exportieren**, dann
`DRY_RUN=1 TODAY=2026-11-11 STATE_FILE=teamplaner-2026-11-07.json node scripts/send-reminders.js`
(`TODAY` ist der Tag vor dem Treffen; unter Windows PowerShell die Variablen vorher mit `$env:DRY_RUN=1` usw. setzen).

---

## Grenzen dieser ersten Version

- **Gleichzeitiges Bearbeiten:** Wenn zwei Personen im selben Moment speichern, gewinnt die erste, und die zweite bekommt einen Hinweis, die Änderung zu wiederholen. Die Ansicht aktualisiert sich alle 30 Sekunden von selbst.
- **Formalia werden von Hand eingetragen:** Die App liest keine Word-Datei ein. Aktuelle Seiten- und Wortzahl tragt ihr selbst ein (Word zeigt beides unten links bzw. unter „Überprüfen → Wörter zählen“).
- **Gesamtfortschritt** ist der Durchschnitt aller Aufgaben (jede zählt gleich viel).
- **Zeitzone** der Erinnerungen ist fest auf Europe/Vienna eingestellt (`TIME_ZONE` in `src/logic.js`).
