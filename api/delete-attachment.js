import { createClient } from '@supabase/supabase-js'
const reply=(body,status=200)=>Response.json(body,{status})
export async function DELETE(request){
  if(process.env.APP_ORIGIN&&request.headers.get('origin')!==process.env.APP_ORIGIN)return reply({error:'Origine non consentita.'},403)
  const url=process.env.VITE_SUPABASE_URL,anon=process.env.VITE_SUPABASE_ANON_KEY,key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!anon||!key)return reply({error:'Configurazione Supabase incompleta.'},500)
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');if(!token)return reply({error:'Sessione mancante.'},401)
  const auth=createClient(url,anon,{auth:{persistSession:false}}),admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),verified=await auth.auth.getUser(token)
  if(verified.error||!verified.data.user)return reply({error:'Sessione non valida.'},401)
  const user=verified.data.user,profile=await admin.from('profiles').select('role,active').eq('id',user.id).single();if(profile.error||!profile.data.active)return reply({error:'Account disattivato.'},403)
  const {id}=await request.json();const found=await admin.from('attachments').select('*').eq('id',id).single();if(found.error)return reply({error:'Allegato non trovato.'},404)
  if(found.data.uploaded_by!==user.id&&profile.data.role!=='admin')return reply({error:'Non puoi eliminare questo allegato.'},403)
  const removed=await admin.storage.from('attachments').remove([found.data.storage_path]);if(removed.error)return reply({error:removed.error.message},400)
  const deleted=await admin.from('attachments').delete().eq('id',id);if(deleted.error)return reply({error:deleted.error.message},400)
  return reply({ok:true})
}
