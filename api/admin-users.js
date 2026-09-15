import { createClient } from '@supabase/supabase-js'
import { isAllowedOrigin } from './origin.js'

const json=(response,status,body)=>response.status(status).json(body)

export default async function handler(request,response){
  if(!['GET','POST','PATCH'].includes(request.method))return json(response,405,{error:'Metodo non consentito.'})
  if(request.method!=='GET'&&!isAllowedOrigin(request.headers.origin))return json(response,403,{error:'Origine non consentita.'})
  const url=process.env.VITE_SUPABASE_URL,anon=process.env.VITE_SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!anon||!service)return json(response,500,{error:'Configurazione Supabase incompleta.'})
  const token=request.headers.authorization?.replace(/^Bearer\s+/i,'');if(!token)return json(response,401,{error:'Sessione mancante.'})
  const authClient=createClient(url,anon,{auth:{persistSession:false}}),admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:{user},error:userError}=await authClient.auth.getUser(token);if(userError||!user)return json(response,401,{error:'Sessione non valida.'})
  const {data:caller,error:callerError}=await admin.from('profiles').select('role,active').eq('id',user.id).single()
  if(callerError||!caller?.active||caller.role!=='admin')return json(response,403,{error:'Operazione riservata agli amministratori.'})
  if(request.method==='GET'){
    const {data,error}=await admin.from('profiles').select('id,username,email,role,active,created_at,updated_at').order('username')
    return error?json(response,400,{error:error.message}):json(response,200,data)
  }
  if(request.method==='POST'){
    const {username,email,password,role}=request.body||{}
    if(typeof username!=='string'||username.trim().length<3||typeof email!=='string'||!email.includes('@')||typeof password!=='string'||password.length<12||!['admin','user'].includes(role))return json(response,400,{error:'Dati utente non validi.'})
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username:username.trim()}})
    if(created.error||!created.data.user)return json(response,400,{error:created.error?.message||'Creazione non riuscita.'})
    const updated=await admin.from('profiles').update({role}).eq('id',created.data.user.id)
    if(updated.error){await admin.auth.admin.deleteUser(created.data.user.id);return json(response,400,{error:updated.error.message})}
    await admin.from('audit_log').insert({user_id:user.id,action:'Creazione',entity_type:'users',entity_id:created.data.user.id})
    return json(response,201,{id:created.data.user.id})
  }
  const {id,role,active}=request.body||{}
  if(typeof id!=='string'||id===user.id||!['admin','user'].includes(role)||typeof active!=='boolean')return json(response,400,{error:'Modifica utente non valida.'})
  const updated=await admin.from('profiles').update({role,active}).eq('id',id).select('id').single();if(updated.error)return json(response,400,{error:updated.error.message})
  const authUpdate=await admin.auth.admin.updateUserById(id,{ban_duration:active?'none':'876000h'});if(authUpdate.error){await admin.from('profiles').update({active:!active}).eq('id',id);return json(response,400,{error:authUpdate.error.message})}
  await admin.from('audit_log').insert({user_id:user.id,action:active?'Riattivazione':'Disattivazione',entity_type:'users',entity_id:id})
  return json(response,200,{ok:true})
}
