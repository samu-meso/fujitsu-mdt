import sanitizeHtml from 'sanitize-html'
import { supabase } from './supabase'
import type { Activity, Attachment, Dossier, Report, ReportType, User } from './types'

const allowedMimes=['image/png','image/jpeg','image/webp','application/pdf']
const maxBytes=Number(import.meta.env.VITE_UPLOAD_MAX_MB||10)*1024*1024
type Json=Record<string,unknown>; type Row=Record<string,unknown>
const failure=(message?:string)=>new Error(message||'Richiesta non riuscita.')
const bodyOf=(options:RequestInit):Json=>typeof options.body==='string'?JSON.parse(options.body):{}
export function setCsrf(_token:string) { /* Supabase JWT e RLS sostituiscono le sessioni locali. */ }
function author(row:Row){const p=row.profiles as {username?:string}|{username?:string}[]|undefined;return Array.isArray(p)?p[0]?.username||'Utente':p?.username||'Utente'}
function profile(row:Row):User{return{id:String(row.id),username:String(row.username),alias:String(row.alias||''),email:String(row.email||''),role:row.role as User['role'],active:row.active?1:0,createdAt:String(row.created_at),updatedAt:String(row.updated_at)}}
function dossier(row:Row):Dossier{return{id:String(row.id),publicCode:String(row.public_code),title:String(row.title),content:String(row.content),status:row.status as Dossier['status'],notes:String(row.notes||''),authorId:String(row.author_id),author:author(row),createdAt:String(row.created_at),updatedAt:String(row.updated_at)}}
function report(row:Row):Report{return{pingDurationHours:row.ping_duration_hours===null?null:Number(row.ping_duration_hours??48) as 24|48,id:String(row.id),title:String(row.title),description:String(row.description),eventDate:String(row.event_date),latitude:Number(row.latitude),longitude:Number(row.longitude),address:String(row.address||''),typeId:String(row.type_id),authorId:String(row.author_id),author:author(row),dossierId:row.dossier_id?String(row.dossier_id):null,createdAt:String(row.created_at),updatedAt:String(row.updated_at)}}
function activity(row:Row):Activity{return{id:String(row.id),author:author(row),action:String(row.action),entityType:String(row.entity_type),entityId:String(row.entity_id),createdAt:String(row.created_at)}}
function attachment(row:Row,url='',downloadUrl=''):Attachment{return{id:String(row.id),originalName:String(row.original_name),size:Number(row.size),mimeType:String(row.mime_type),createdAt:String(row.created_at),uploadedBy:String(row.uploaded_by),storagePath:String(row.storage_path),url,downloadUrl}}
async function currentUser(){const {data:{user},error}=await supabase.auth.getUser();if(error||!user)throw failure('Accedi per continuare.');const result=await supabase.from('profiles').select('id,username,alias,role,active,created_at,updated_at').eq('id',user.id).single();if(result.error)throw failure(result.error.message);const value=profile({...result.data,email:user.email||''});if(!value.active){await supabase.auth.signOut();throw failure('Account disattivato.')}return value}
async function signed(rows:Row[]){if(!rows.length)return[];return Promise.all(rows.map(async row=>{const path=String(row.storage_path);const [view,download]=await Promise.all([supabase.storage.from('attachments').createSignedUrl(path,3600),supabase.storage.from('attachments').createSignedUrl(path,3600,{download:String(row.original_name)})]);return attachment(row,view.data?.signedUrl||'',download.data?.signedUrl||view.data?.signedUrl||'')}))}
function clean(html:string){return sanitizeHtml(html,{allowedTags:['p','br','h1','h2','h3','strong','em','s','ul','ol','li','blockquote','a','img'],allowedAttributes:{a:['href','target','rel'],img:['src','alt','title']},allowedSchemes:['https','http','radiolog'],transformTags:{a:sanitizeHtml.simpleTransform('a',{rel:'noopener noreferrer'})}})}
function dbValues(kind:'dossiers'|'reports',input:Json,userId:string){return kind==='dossiers'?{title:String(input.title).trim(),content:clean(String(input.content||'')),status:input.status,notes:String(input.notes||''),author_id:userId}:{title:String(input.title).trim(),description:String(input.description||'').trim(),event_date:input.eventDate,latitude:Number(input.latitude),longitude:Number(input.longitude),address:String(input.address||''),type_id:input.typeId,ping_duration_hours:input.typeId==='emergency'?(input.pingDurationHours===null?null:Number(input.pingDurationHours??48)):48,dossier_id:input.dossierId||null,author_id:userId}}
async function jsonResponse(response:Response){const text=await response.text();if(!text)throw failure(`Il servizio API non ha restituito dati (${response.status}). Avvia il progetto con npm run dev per includere le Vercel Functions.`);try{return JSON.parse(text) as Json}catch{throw failure(`Risposta API non valida (${response.status}). Avvia il progetto con npm run dev per includere le Vercel Functions.`)}}
async function admin(method:string,payload?:Json){const {data:{session}}=await supabase.auth.getSession();if(!session)throw failure('Accedi per continuare.');const response=await fetch('/api/admin-users',{method,headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined});const result=await jsonResponse(response);if(!response.ok)throw failure(String(result.error||'Operazione non riuscita.'));return result}
async function removeFiles(kind:'dossiers'|'reports',id:string){const column=kind==='dossiers'?'dossier_id':'report_id';const found=await supabase.from('attachments').select('storage_path').eq(column,id);if(found.error)throw failure(found.error.message);const paths=(found.data||[]).map(row=>row.storage_path);if(paths.length){const removed=await supabase.storage.from('attachments').remove(paths);if(removed.error)throw failure(removed.error.message)}}

export async function api<T=Json>(path:string,options:RequestInit={}):Promise<T>{
 try{const method=(options.method||'GET').toUpperCase(),input=bodyOf(options)
  if(path==='/login'){const auth=await supabase.auth.signInWithPassword({email:String(input.login),password:String(input.password)});if(auth.error){if(auth.error.code==='email_provider_disabled')throw failure('Il login Email è disattivato nel progetto Supabase. Attivalo in Authentication → Sign In / Providers.');throw failure('Credenziali non valide.')}try{return{user:await currentUser(),csrf:''} as T}catch(e){await supabase.auth.signOut();throw e}}
  if(path==='/logout'){await supabase.auth.signOut();return{ok:true} as T}
  if(path==='/me')return{user:await currentUser(),csrf:''} as T
  const user=await currentUser()
  if(path==='/profile'&&method==='PATCH'){
    const value=bodyOf(options).alias
    if(typeof value!=='string'||value.trim().length>40)throw failure('L?alias pu? contenere al massimo 40 caratteri.')
    const user=await currentUser()
    const result=await supabase.from('profiles').update({alias:value.trim()}).eq('id',user.id)
    if(result.error)throw failure(result.error.message)
    return {user:await currentUser()} as T
  }
  if(path==='/data'){const [rs,ds,ps,ts,logs]=await Promise.all([supabase.from('reports').select('*,profiles!reports_author_id_fkey(username)').order('event_date',{ascending:false}),supabase.from('dossiers').select('*,profiles!dossiers_author_id_fkey(username)').order('updated_at',{ascending:false}),supabase.from('profiles').select('id,username,alias,role,active,created_at,updated_at').order('username'),supabase.from('report_types').select('*'),supabase.from('audit_log').select('*,profiles!audit_log_user_id_fkey(username)').order('created_at',{ascending:false}).limit(20)]);const e=[rs,ds,ps,ts,logs].find(x=>x.error)?.error;if(e)throw failure(e.message);return{reports:(rs.data||[]).map(report),dossiers:(ds.data||[]).map(dossier),users:(ps.data||[]).map(profile),types:(ts.data||[]).map((r:Row)=>({id:String(r.id),name:String(r.name),color:String(r.color),icon:String(r.icon),active:r.active?1:0} as ReportType)),activity:(logs.data||[]).map(activity),uploadConfig:{maxBytes,allowed:allowedMimes}} as T}
  if(path==='/password'){const auth=await supabase.auth.getUser();if(!auth.data.user?.email)throw failure('Email non disponibile.');const checked=await supabase.auth.signInWithPassword({email:auth.data.user.email,password:String(input.currentPassword)});if(checked.error)throw failure('Password attuale non corretta.');const updated=await supabase.auth.updateUser({password:String(input.password)});if(updated.error)throw failure(updated.error.message);return{ok:true} as T}
  if(path==='/users'&&method==='POST')return await admin('POST',input) as T
  if(path==='/users'&&method==='GET')return await admin('GET') as T
  const userPath=path.match(/^\/users\/([0-9a-f-]+)$/);if(userPath&&method==='PATCH')return await admin('PATCH',{id:userPath[1],...input}) as T
  const attachmentPath=path.match(/^\/attachments\/([0-9a-f-]+)$/);if(attachmentPath&&method==='DELETE'){
   const {data:{session}}=await supabase.auth.getSession();if(!session)throw failure('Accedi per continuare.')
   const response=await fetch('/api/delete-attachment',{method:'DELETE',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({id:attachmentPath[1]})});const result=await jsonResponse(response);if(!response.ok)throw failure(String(result.error||'Eliminazione non riuscita.'));return result as T
  }  const upload=path.match(/^\/(dossiers|reports)\/([0-9a-f-]+)\/attachments$/);if(upload&&method==='POST'){
   const file=(options.body as FormData).get('file') as File|null;if(!file)throw failure('Seleziona un file.')
   const {data:{session}}=await supabase.auth.getSession();if(!session)throw failure('Accedi per continuare.')
   const form=new FormData();form.append('file',file);form.append('kind',upload[1]);form.append('entityId',upload[2])
   const response=await fetch('/api/upload',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:form});const result=await jsonResponse(response);if(!response.ok)throw failure(String(result.error||'Upload non riuscito.'));return result as T
  }  const entity=path.match(/^\/(dossiers|reports)(?:\/([0-9a-f-]+))?$/);if(entity){const kind=entity[1] as 'dossiers'|'reports',id=entity[2]
   if(method==='GET'&&id){const [item,files,history]=await Promise.all([supabase.from(kind).select(`*,profiles!${kind}_author_id_fkey(username)`).eq('id',id).single(),supabase.from('attachments').select('*').eq(kind==='dossiers'?'dossier_id':'report_id',id).order('created_at'),supabase.from('audit_log').select('*,profiles!audit_log_user_id_fkey(username)').eq('entity_type',kind).eq('entity_id',id).order('created_at',{ascending:false})]);if(item.error)throw failure(item.error.message);if(files.error)throw failure(files.error.message);if(history.error)throw failure(history.error.message);return{...(kind==='dossiers'?dossier(item.data):report(item.data)),attachments:await signed(files.data||[]),history:(history.data||[]).map(activity)} as T}
   if(method==='POST'){const inserted=await supabase.from(kind).insert(dbValues(kind,input,user.id) as never).select().single();if(inserted.error)throw failure(inserted.error.message);return(kind==='dossiers'?dossier(inserted.data):report(inserted.data)) as T}
   if(method==='PUT'&&id){const payload=dbValues(kind,input,user.id);delete(payload as {author_id?:string}).author_id;const updated=await supabase.from(kind).update(payload as never).eq('id',id).select().single();if(updated.error)throw failure(updated.error.message);return(kind==='dossiers'?dossier(updated.data):report(updated.data)) as T}
   if(method==='DELETE'&&id){await removeFiles(kind,id);const deleted=await supabase.from(kind).delete().eq('id',id);if(deleted.error)throw failure(deleted.error.message);return{ok:true} as T}}
  throw failure('Risorsa non trovata.')
 }catch(e){const message=e instanceof Error?e.message:'Richiesta non riuscita.';if(/JWT|Accedi|session/i.test(message))window.dispatchEvent(new Event('session-expired'));throw failure(message)}}
export const date=(value:string,short=false)=>new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',...(short?{}:{hour:'2-digit',minute:'2-digit'})}).format(new Date(value))


