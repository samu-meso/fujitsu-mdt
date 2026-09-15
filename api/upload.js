import { createClient } from '@supabase/supabase-js'

const response=(body,status=200)=>Response.json(body,{status})
function validSignature(bytes,mime){
  if(mime==='image/png')return[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value)
  if(mime==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255
  if(mime==='image/webp')return new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'
  return mime==='application/pdf'&&new TextDecoder().decode(bytes.slice(0,5))==='%PDF-'
}
export async function POST(request){
  if(process.env.APP_ORIGIN&&request.headers.get('origin')!==process.env.APP_ORIGIN)return response({error:'Origine non consentita.'},403)
  const url=process.env.VITE_SUPABASE_URL,anon=process.env.VITE_SUPABASE_ANON_KEY,key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!anon||!key)return response({error:'Configurazione Supabase incompleta.'},500)
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');if(!token)return response({error:'Sessione mancante.'},401)
  const auth=createClient(url,anon,{auth:{persistSession:false}}),admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
  const verified=await auth.auth.getUser(token);if(verified.error||!verified.data.user)return response({error:'Sessione non valida.'},401)
  const user=verified.data.user,profile=await admin.from('profiles').select('active').eq('id',user.id).single();if(profile.error||!profile.data.active)return response({error:'Account disattivato.'},403)
  const form=await request.formData(),file=form.get('file'),kind=form.get('kind'),entityId=form.get('entityId')
  if(!(file instanceof File)||!['dossiers','reports'].includes(kind)||typeof entityId!=='string')return response({error:'Upload non valido.'},400)
  const allowed=['image/png','image/jpeg','image/webp','application/pdf'],max=Number(process.env.UPLOAD_MAX_MB||10)*1024*1024
  if(!allowed.includes(file.type)||file.size<=0||file.size>max||(kind==='reports'&&!file.type.startsWith('image/')))return response({error:'Formato o dimensione non consentiti.'},400)
  const bytes=new Uint8Array(await file.arrayBuffer());if(!validSignature(bytes,file.type))return response({error:'Il contenuto non corrisponde al formato dichiarato.'},400)
  const parent=await admin.from(kind).select('id').eq('id',entityId).single();if(parent.error)return response({error:'Destinazione non trovata.'},404)
  const id=crypto.randomUUID(),ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','application/pdf':'pdf'}[file.type],path=`${user.id}/${id}.${ext}`
  const stored=await admin.storage.from('attachments').upload(path,bytes,{contentType:file.type,upsert:false});if(stored.error)return response({error:stored.error.message},400)
  const row={id,original_name:file.name.slice(0,255),storage_path:path,mime_type:file.type,size:file.size,uploaded_by:user.id,dossier_id:kind==='dossiers'?entityId:null,report_id:kind==='reports'?entityId:null}
  const inserted=await admin.from('attachments').insert(row).select().single();if(inserted.error){await admin.storage.from('attachments').remove([path]);return response({error:inserted.error.message},400)}
  const [signed,download]=await Promise.all([
    admin.storage.from('attachments').createSignedUrl(path,3600),
    admin.storage.from('attachments').createSignedUrl(path,3600,{download:row.original_name})
  ])
  return response({id,originalName:row.original_name,size:row.size,mimeType:row.mime_type,createdAt:inserted.data.created_at,uploadedBy:user.id,storagePath:path,url:signed.data?.signedUrl||'',downloadUrl:download.data?.signedUrl||signed.data?.signedUrl||''},201)
}
