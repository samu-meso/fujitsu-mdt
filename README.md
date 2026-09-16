# RadioLog

Applicazione privata e minimale per un piccolo gruppo di radioamatori: mappa Leaflet/OpenStreetMap, segnalazioni, fascicoli TipTap, allegati e gestione utenti. Il frontend React/Vite è pubblicabile su Vercel; dati, accesso e file sono gestiti da Supabase. Il progetto non rappresenta enti reali e non sostituisce i servizi di emergenza.

## Architettura

- Il browser usa Supabase Auth e interroga PostgreSQL con la chiave anonima. Le policy RLS sono il confine di sicurezza.
- Le normali operazioni CRUD non richiedono un server sempre acceso.
- `api/admin-users.js` è una Vercel Function: verifica il JWT e il ruolo admin prima di usare la service role per creare, disattivare o modificare utenti.
- `api/upload.js` è una Vercel Function: verifica JWT, account attivo, dimensione, MIME e firma binaria prima di scrivere nel bucket privato.
- Gli allegati vengono mostrati tramite URL firmati della durata di un'ora. Nel contenuto TipTap si salva un riferimento stabile `radiolog://attachment/UUID`, sostituito a runtime con l'URL corrente.
- Non esistono più dipendenze runtime da Express, SQLite, sessioni locali, `DATA_DIR` o filesystem Vercel. I vecchi `data/app.sqlite` e `data/uploads` restano esclusi da Git e servono solo come sorgente facoltativa di migrazione.

Dettagli e decisioni di sicurezza sono in [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Funzioni della mappa

- **La mia posizione** attiva il GPS del dispositivo con il permesso del browser. Il punto blu si aggiorna durante gli spostamenti e il cerchio mostra la precisione stimata. **Ferma posizione** interrompe il rilevamento; anche uscire dalla pagina Mappa interrompe il GPS. La posizione resta nel browser e non viene salvata in Supabase né condivisa con il gruppo. Richiede HTTPS o localhost.
- **Presidi** mostra/nasconde quattro sedi permanenti nella città di Reggio Emilia. Ogni popup contiene indirizzo, fonte ufficiale e collegamento alle indicazioni. L'ingresso del pronto soccorso è distinto dall'ingresso generale dell'ospedale. Le sedi non vengono modificate dai filtri sulle segnalazioni.
- I **ping** spariscono dalla mappa esattamente 48 ore dopo `createdAt`, anche mentre la pagina è aperta. Modificare un ping o la data dell'evento non prolunga la durata. I report rimangono nello storico Segnalazioni e nei fascicoli collegati; i presidi permanenti non scadono. Non serve una nuova migrazione SQL o un cron di cancellazione.

Presidi verificati il 16 settembre 2026, dati in [emergencyBases.ts](src/emergencyBases.ts):

| Presidio | Indirizzo ufficiale | Fonte |
| --- | --- | --- |
| Comando Vigili del fuoco | Via della Canalina, 8 | [Corpo Nazionale VVF](https://www.vigilfuoco.it/sedi-vvf/comando-vvf-di-reggio-emilia) |
| Croce Rossa — Comitato di Reggio Emilia | Via della Croce Rossa, 1 | [CRI Reggio Emilia](https://www.cri.re.it/contatti/) |
| Croce Verde — Pubblica Assistenza | Via della Croce Verde, 3 | [Croce Verde Reggio Emilia](https://www.croceverde.re.it/contatti/) |
| Pronto soccorso — Santa Maria Nuova | Viale Risorgimento, 80, fabbricato E, piano 0 | [Guida regionale ai servizi sanitari](https://guidaservizi.fascicolo-sanitario.it/dettaglio/luogo/3155344/3152900) |

Le coordinate derivano dai punti dei presidi OpenStreetMap e, per Croce Verde, dalla mappa incorporata nella sua pagina Contatti. Per il pronto soccorso è stato verificato il nodo OSM `emergency_ward_entrance` da via Cesare Beccaria. La ricerca è limitata alla città: non include le sedi degli altri comuni della provincia.

`npm run test:map` esegue quattro test browser isolati con backend e GPS simulati: presidi/ping/storico, aggiornamento e stop GPS/permesso negato, scadenza senza reload e layout mobile. Non richiede credenziali E2E e non modifica dati reali.

## 1. Creare il progetto Supabase
M7VRa54Czcuv$As
password db
1. Crea un progetto gratuito su Supabase e conserva la password del database.
2. In **Project Settings → API** copia Project URL, anon/publishable key e service role key.
3. In **Authentication → URL Configuration** imposta inizialmente `http://localhost:5173` come Site URL e Redirect URL.
4. In **Authentication → Sign In / Providers → Email** lascia attivo il provider Email e disabilita soltanto la registrazione pubblica. Gli account vengono creati dall'amministratore.
5. Copia `.env.example` in `.env` e configura almeno:

```dotenv
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=chiave_anon_o_publishable
SUPABASE_SERVICE_ROLE_KEY=chiave_service_role
APP_ORIGIN=http://localhost:5173
VITE_UPLOAD_MAX_MB=10
UPLOAD_MAX_MB=10
```

La service role non deve mai avere prefisso `VITE_`, essere inserita nel browser o pubblicata su GitHub.

## 2. Applicare lo schema SQL

Il file da eseguire è [20260915000100_radiolog_schema.sql](supabase/migrations/20260915000100_radiolog_schema.sql), seguito da [20260915000200_attachment_cleanup.sql](supabase/migrations/20260915000200_attachment_cleanup.sql).

Metodo consigliato con Supabase CLI:

```powershell
npx supabase login
npx supabase link --project-ref IL_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

In alternativa incolla i file, in ordine, nel **SQL Editor** del progetto. La prima migrazione crea schema, indici, trigger, RLS, policy e il bucket privato `attachments`. Non serve creare il bucket a mano. Controlla in **Storage** che `attachments` mostri `Public: false`, limite 10 MB e i quattro MIME consentiti.

La funzione database `prepare_dossier()` aggiorna una riga contatore con `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` nella stessa transazione dell'inserimento. Due richieste simultanee non ricevono lo stesso codice.

## 3. Creare il primo amministratore

Completa nel solo `.env`:

```dotenv
ADMIN_USERNAME=tuo_username
ADMIN_EMAIL=tuo_indirizzo@example.com
ADMIN_PASSWORD=una_password_univoca_di_almeno_12_caratteri
```

Poi esegui:

```powershell
npm run admin:create
```

Lo script usa la service role, crea l'utente Auth confermato, lascia al trigger la creazione del profilo e assegna `admin`. Non contiene password predefinite. Rimuovi le variabili `ADMIN_*` dall'ambiente dopo l'uso. Gli altri account si creano dalla pagina **Utenti**.

## 4. Avvio locale

Prerequisiti: Node.js 24 LTS e npm.

```powershell
npm ci
npm run dev
```

Apri `http://localhost:5173`. Login solo tramite email e password. La sessione Supabase persiste e viene aggiornata automaticamente. `npm run dev` usa Vercel CLI e avvia sia Vite sia le funzioni `/api`, necessarie per gestione utenti e allegati. `npm run dev:frontend` avvia soltanto Vite ed è utile per lavorare sull'interfaccia, ma in quella modalità le operazioni `/api` non sono disponibili.

## 5. Dati demo

Usa soltanto un progetto locale/test. Inserisci in `.env` l'UUID di un profilo esistente:

```dotenv
SEED_AUTHOR_ID=uuid-del-profilo-test
```

Poi esegui `npm run db:seed`. Lo script crea un fascicolo e due marker e salta il seed se riconosce il fascicolo demo. Non eseguirlo in produzione.

## 6. Migrare i dati SQLite esistenti

Esegui prima le migrazioni Supabase e crea un backup di `data/`. Configura service role e percorsi, quindi:

```powershell
npm run data:migrate
```

Lo script [migrate-sqlite-to-supabase.js](scripts/migrate-sqlite-to-supabase.js):

- associa utenti esistenti per email o crea utenti Auth con password casuale;
- mantiene username, ruolo, stato, codici fascicolo, UUID di fascicoli/segnalazioni/allegati, date e relazioni;
- carica i file nel bucket privato;
- usa upsert/controlli per evitare duplicati e stampa conteggi ed errori;
- non parte durante build o deploy.

Gli hash SQLite non sono compatibili con Supabase Auth. Gli utenti creati dalla migrazione devono ricevere una nuova password tramite la console Auth o un flusso amministrativo. Lo script non stampa password. Se un upload fallisce, rimuove il file appena caricato; può essere rilanciato.

## 7. Test

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` verifica staticamente RLS, contatore atomico, protezione di ruolo, bucket e isolamento della service role. Per il test end-to-end crea un progetto Supabase separato, applica le migrazioni, crea un admin e configura:

```dotenv
E2E_EMAIL=admin-test@example.com
E2E_PASSWORD=password-del-solo-progetto-test
```

Poi usa `npm run test:e2e`. Il test crea, modifica ed elimina record e file: viene saltato se manca la configurazione e non deve mai puntare alla produzione.

Per verificare tutto localmente con Docker e Supabase CLI: `npx supabase start`, `npx supabase db reset`, usa URL/anon/service role mostrate dalla CLI nel `.env`, crea l'admin e avvia i test. `db reset` è distruttivo per l'istanza locale indicata.

## 8. Pubblicare su GitHub e Vercel

Ordine esatto:

1. Verifica che `.env`, `data/` e backup siano ignorati; non commettere segreti.
2. Crea un repository GitHub e pubblica la cartella `fujitsu`.
3. Su Vercel scegli **Add New → Project**, importa il repository e imposta come Root Directory `fujitsu` solo se il repository include la cartella padre.
4. Vercel rileva Vite; `vercel.json` imposta `npm run build`, output `dist` e fallback SPA.
5. In **Vercel → Project Settings → Environment Variables** aggiungi per Production e Preview: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ORIGIN`, `VITE_UPLOAD_MAX_MB`, `UPLOAD_MAX_MB`. `APP_ORIGIN` deve essere l'origine esatta, per esempio `https://radiolog.vercel.app`, senza slash finale.
6. Esegui il deploy.
7. In Supabase **Authentication → URL Configuration**, sostituisci Site URL con il dominio Vercel e aggiungi il dominio alle Redirect URLs. Aggiungi anche eventuale dominio personalizzato e URL Preview che decidi di autorizzare.
8. Aggiorna `APP_ORIGIN` se cambi dominio e ridistribuisci.
9. Accedi, crea un fascicolo, un marker e un allegato, poi prova logout e un account utente normale.

Le Preview Vercel hanno URL variabili: per mantenerle sicure usa un progetto Supabase di staging e una `APP_ORIGIN` precisa per l'ambiente. La function rifiuta mutazioni con Origin diverso.

## 9. Dove vedere i dati

- **Database → Table Editor**: `profiles`, `report_types`, `reports`, `dossiers`, `attachments`, `audit_log`, `dossier_counters`.
- **Authentication → Users**: account, email, conferma e ban.
- **Storage → attachments**: oggetti privati organizzati in cartelle per UUID utente.
- **Database → Roles/Policies** o Table Editor: RLS e policy.
- **Logs**: errori Auth, Database, Storage e Functions.

## 10. Backup e ripristino

Per PostgreSQL usa i backup disponibili dal piano Supabase oppure `pg_dump` con la connection string del progetto. Conserva schema e dati cifrati fuori dal repository. Ripristina in un progetto vuoto con `pg_restore`, quindi verifica Auth e UUID dei profili. Le tabelle `auth.*` sono gestite da Supabase: consulta la procedura di backup del piano prima di un ripristino completo.

Storage richiede un backup separato: scarica ricorsivamente gli oggetti del bucket privato tramite uno script con service role e conserva anche la tabella `attachments`. Per ripristinare, carica ogni oggetto con lo stesso `storage_path`, poi ripristina i metadati PostgreSQL. Testa periodicamente il ripristino in un progetto separato.

## Comandi

| Comando | Uso |
| --- | --- |
| `npm run dev` | Vite e Vercel Functions in locale |
| `npm run dev:frontend` | solo frontend Vite, senza operazioni `/api` |
| `npm run build` | typecheck e build `dist` |
| `npm run db:migrate` | invia migrazioni al progetto Supabase collegato |
| `npm run admin:create` | crea il primo admin |
| `npm run db:seed` | demo per ambiente test |
| `npm run data:migrate` | migrazione facoltativa da SQLite/Filesystem |
| `npm test` | controlli architetturali isolati |
| `npm run test:e2e` | test distruttivo sul solo progetto di test |

Riferimenti: [migrazioni Supabase](https://supabase.com/docs/guides/local-development/database-migrations), [workflow CLI](https://supabase.com/docs/guides/local-development/cli-workflows), [creazione utenti server-side](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [Vite su Vercel](https://vercel.com/docs/frameworks/frontend/vite).
