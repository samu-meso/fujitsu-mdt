import { createClient } from '@supabase/supabase-js'

const {VITE_SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:key,ADMIN_EMAIL:email,ADMIN_PASSWORD:password,ADMIN_USERNAME:username}=process.env
if(!url||!key||!email||!username||!password||password.length<12)throw new Error('Configura URL, service role e credenziali ADMIN_* (password di almeno 12 caratteri).')
const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const created=await supabase.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username}})
if(created.error)throw created.error
const updated=await supabase.from('profiles').update({role:'admin',active:true}).eq('id',created.data.user.id)
if(updated.error)throw updated.error
console.log(`Amministratore creato: ${email} (${created.data.user.id})`)
