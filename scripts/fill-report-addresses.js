import {createClient} from '@supabase/supabase-js'
import {reverseGeocode} from './lib/geocoding.js'
const db=createClient(process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const {data,error}=await db.from('reports').select('id,title,address,latitude,longitude').eq('address','')
if(error)throw error
for(const report of data){
  const address=await reverseGeocode(report.latitude,report.longitude)
  const {error}=await db.from('reports').update({address}).eq('id',report.id).eq('address','')
  if(error)throw error
  console.log(JSON.stringify({title:report.title,address}))
}
