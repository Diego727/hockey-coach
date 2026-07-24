# Hockey Team Coach

Dies ist die modulare GitHub-Version der SC-Altstadt-Coach-App.

## Dateien

- `index.html`: Grundaufbau
- `assets/styles.css`: Design
- `assets/app.js`: Funktionen und Supabase
- `assets/icon.svg`: App-Symbol
- `manifest.webmanifest`: Installation auf Handy/Tablet
- `.github/workflows/deploy.yml`: automatische Veröffentlichung

## Einmalige Einrichtung

1. Den gesamten Inhalt dieses Projekts in das Repository `hockey-coach` laden.
2. In GitHub `Settings → Pages` öffnen.
3. Bei `Source` die Option `GitHub Actions` wählen.
4. Unter `Actions` warten, bis der Workflow `App veröffentlichen` grün ist.

Die Adresse bleibt:

https://diego727.github.io/hockey-coach/

## Bestehende Daten

Die Cloud-Daten liegen weiterhin in Supabase. Spieler, Trainings, Abwesenheiten,
Aufstellungen und Logins werden durch den Projektumbau nicht gelöscht.


## V4.1

- Dashboard
- zentraler Menüpunkt Verfügbarkeiten
- Abwesenheiten für den ganzen Kader erfassen
- automatische Übernahme in Trainings, Spiele und Trainingslager
- Positionsübersicht für den nächsten Termin
