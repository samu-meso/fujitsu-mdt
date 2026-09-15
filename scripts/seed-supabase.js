import { createClient } from '@supabase/supabase-js'
const {VITE_SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:key,SEED_AUTHOR_ID:author}=process.env
if(!url||!key||!author)throw new Error('Configura VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SEED_AUTHOR_ID in un progetto di test.')
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const existing=await db.from('dossiers').select('id').eq('title','Monitoraggio frequenze VHF — Demo').maybeSingle()
if(existing.error)throw existing.error
if(existing.data){console.log('Seed già presente: nessuna modifica.');process.exit(0)}
const dossier=await db.from('dossiers').insert({title:'Monitoraggio frequenze VHF — Demo',content:'<h2>Attività dimostrativa</h2><p>Annotazioni senza valore ufficiale.</p>',status:'aperto',notes:'Dati demo.',author_id:author}).select().single()
if(dossier.error)throw dossier.error
const reports=await db.from('reports').insert([{title:'Scansione VHF — Demo',description:'Prova dimostrativa.',event_date:new Date().toISOString(),latitude:44.698,longitude:10.632,address:'Reggio Emilia',type_id:'radio',dossier_id:dossier.data.id,author_id:author},{title:'Osservazione — Demo',description:'Scenario esclusivamente dimostrativo.',event_date:new Date().toISOString(),latitude:44.644,longitude:10.599,address:'Rivalta',type_id:'emergency',dossier_id:dossier.data.id,author_id:author}]).select('id')
if(reports.error)throw reports.error
console.log(`Creati 1 fascicolo e ${reports.data.length} marker demo.`)
