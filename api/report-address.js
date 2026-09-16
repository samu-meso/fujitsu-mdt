import {createClient} from '@supabase/supabase-js'
import {isAllowedOrigin} from './origin.js'
import {reverseGeocode} from '../scripts/lib/geocoding.js'

export default async function handler(request,response){
  if(request.method!=='POST')return response.status(405).json({error:'Metodo non consentito.'})
  if(!isAllowedOrigin(request.headers.origin))return response.status(403).json({error:'Origine non consentita.'})
  const token=request.headers.authorization?.replace(/^Bearer\s+/i,'')
  if(!token)return response.status(401).json({error:'Sessione mancante.'})
  const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_ANON_KEY
  if(!url||!key)return response.status(500).json({error:'Configurazione Supabase incompleta.'})
  const db=createClient(url,key,{auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${token}`}}})
  const {data:{user},error}=await db.auth.getUser(token)
  if(error||!user)return response.status(401).json({error:'Sessione non valida.'})
  const {data:profile}=await db.from('profiles').select('active').eq('id',user.id).single()
  if(!profile?.active)return response.status(403).json({error:'Account non attivo.'})
  const {latitude,longitude}=request.body||{}
  if(typeof latitude!=='number'||typeof longitude!=='number'||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return response.status(400).json({error:'Coordinate non valide.'})
  try{return response.status(200).json({address:await reverseGeocode(latitude,longitude)})}catch(e){return response.status(502).json({error:e.message})}
}
