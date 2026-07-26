# Hockey Coach V6

Spielerzugänge ohne Einladungs-E-Mail:

1. Coach hinterlegt die Spieler-E-Mail.
2. Coach klickt auf **Zugang erstellen**.
3. Coach vergibt ein Startpasswort.
4. Spieler meldet sich direkt an.
5. Beim ersten Login ändert der Spieler sein Passwort.

## Einmalige Einrichtung

- `supabase_v6_setup.sql` im Supabase SQL Editor ausführen.
- Edge Function `manage-player-user` mit dem Inhalt aus
  `supabase/functions/manage-player-user/index.ts` deployen.
- GitHub-Projekt hochladen.

Der `service_role`-Schlüssel wird nie im Browser oder in GitHub gespeichert.
