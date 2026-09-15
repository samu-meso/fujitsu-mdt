# Architettura Supabase/Vercel

## Migrazione effettuata

Il precedente server Express accentrava cookie, SQLite, sanificazione e filesystem. È stato rimosso dal runtime. `src/api.ts` conserva il contratto usato dai componenti React, ma lo traduce in chiamate Supabase: questo mantiene mappa, filtri, CRUD, editor, collegamenti, allegati, profilo e audit senza riscrivere l'interfaccia.

Supabase Auth gestisce sessione persistente, refresh, logout e password. `profiles.id` coincide con `auth.users.id`; un trigger crea automaticamente il profilo. Username resta un attributo applicativo, mentre il login usa l'email perché Supabase Auth non autentica direttamente per username.

## Sicurezza

La chiave anon è pubblica per definizione. Tutte le tabelle esposte hanno RLS; non esistono policy `anon`. Le funzioni `current_profile_active()` e `current_profile_admin()` sono `SECURITY DEFINER` con `search_path` vuoto, così le policy bloccano immediatamente account disattivati e riservano le eliminazioni agli admin.

Il trigger `protect_profile_fields` impedisce a un browser di cambiare ruolo, stato, email o identità. La gestione utenti vive in `api/admin-users.js`, verifica il JWT con Supabase, rilegge ruolo e stato con service role e solo allora esegue Admin Auth. La service role non è importata da alcun file `src/`.

Contenuto TipTap viene sanificato nel client e un trigger PostgreSQL rifiuta tag eseguibili, attributi evento e schemi URL pericolosi. Titoli, lunghezze, coordinate, stati, MIME e relazioni hanno anche vincoli database.

Gli upload passano da `api/upload.js`. La function verifica JWT e profilo, legge i byte, impone limite e allowlist, controlla le firme PNG/JPEG/WebP/PDF e scrive con service role. Non esistono policy RLS che consentano upload diretto dal browser. Lettura e cancellazione restano protette da Storage RLS; l'app genera URL firmati di un'ora. Un oggetto viene rimosso prima dei metadati; in caso di interruzione tra servizi può restare un orfano da eliminare operativamente.

## Modello dati

- `profiles`: identità applicativa, ruolo e stato.
- `report_types`: tipi estendibili.
- `dossiers`: fascicoli, codice pubblico, documento, note e stato.
- `reports`: segnalazioni geografiche e `dossier_id` opzionale.
- `attachments`: metadati Storage con esattamente un genitore.
- `audit_log`: cronologia essenziale immutabile dal browser.
- `dossier_counters`: allocazione atomica per anno.

La relazione resta uno-a-molti, coerente con il comportamento precedente: un fascicolo può avere più segnalazioni, una segnalazione al massimo un fascicolo. Eliminando un fascicolo PostgreSQL imposta `reports.dossier_id` a null.

`prepare_dossier()` assegna codice e autore nel database. La riga annuale del contatore viene bloccata dalla scrittura PostgreSQL concorrente, evitando duplicati. Service role può preservare codici durante la migrazione e aggiorna il contatore al massimo importato.

## Audit e limiti

Trigger su fascicoli e segnalazioni registrano creazione, modifica ed eliminazione con autore e timestamp. Le azioni utente amministrative vengono registrate dalla Vercel Function. La cronologia è un registro di eventi, non conserva copie integrali di ogni versione.

Il piano gratuito Supabase può sospendere progetti inattivi e ha limiti di quota. Gli URL firmati scadono dopo un'ora e vengono rigenerati quando si riapre il dettaglio. Eventuali immagini incorporate nei documenti usano riferimenti stabili applicativi, non URL firmati persistiti.

## Test

I test statici verificano invarianti dello schema e isolamento dei segreti senza rete. Il test browser è predisposto solo per un progetto Supabase isolato e viene saltato in assenza di `E2E_*`. Le policy vanno inoltre provate localmente con Supabase CLI oppure in staging, usando account admin, utente attivo, utente disattivato e richieste anonime.
