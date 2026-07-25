# Hockey Coach V5

Saubere Projektbasis für die SC-Altstadt-Coach-App.

## Struktur

```text
index.html
assets/
  app.js
  styles.css
  icon.svg
manifest.webmanifest
player_portal_setup.sql
.github/
  workflows/
    deploy.yml
```

## Enthalten

- Supabase-Login und gemeinsame Vereins-Cloud
- SC Altstadt 2. Liga und 3. Liga
- Spieler, Trainings, Spiele und Trainingslager
- Anwesenheiten und Verfügbarkeiten
- Aufstellungen mit Drag-and-drop
- Coachboard
- PDF-Rapporte
- Dashboard
- Spielerportal mit eigenem Login

## Wichtig

Es gibt absichtlich nur:

- eine `index.html`
- eine `assets/app.js`
- eine `assets/styles.css`

Keine ZIP-Dateien, keine `index[1].html` und keine zweite `app.js` im Hauptordner.

## Veröffentlichung

1. Den gesamten Inhalt dieses Ordners in das GitHub-Repository laden.
2. In GitHub `Settings → Pages` öffnen.
3. Als Quelle `GitHub Actions` wählen.
4. Unter `Actions` warten, bis „Hockey Coach veröffentlichen“ grün ist.

App-Adresse:

https://diego727.github.io/hockey-coach/
