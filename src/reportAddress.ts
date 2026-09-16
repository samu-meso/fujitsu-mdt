import {supabase} from './supabase'
const cache=new Map<string,Promise<string>>()
export function reportAddress(latitude:number,longitude:number){
  const key=`${latitude},${longitude}`
  if(cache.has(key))return cache.get(key)!
  const task=(async()=>{
    const {data:{session}}=await supabase.auth.getSession()
    if(!session)throw new Error('Accedi per cercare la via.')
    const response=await fetch('/api/report-address',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({latitude,longitude})})
    const text=await response.text()
    let result:{address?:string;error?:string}
    try{result=JSON.parse(text)}catch{throw new Error('Ricerca via non disponibile. Puoi inserire la località a mano.')}
    if(!response.ok||!result.address)throw new Error(result.error||'Via non trovata.')
    return result.address
  })()
  cache.set(key,task);task.catch(()=>cache.delete(key))
  if(cache.size>100)cache.delete(cache.keys().next().value!)
  return task
}
