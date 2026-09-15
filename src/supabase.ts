import { createClient } from '@supabase/supabase-js'

const url=import.meta.env.VITE_SUPABASE_URL
const key=import.meta.env.VITE_SUPABASE_ANON_KEY
if(!url||!key) console.warn('Configura VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')

export const supabase=createClient(url||'http://127.0.0.1:54321',key||'missing-anon-key',{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
})
