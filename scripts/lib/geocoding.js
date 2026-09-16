import {setTimeout as pause} from 'node:timers/promises'
const cache=new Map()
let queue=Promise.resolve(),lastRequest=0

export function formatAddress(address){
  const road=[address.road||address.pedestrian||address.footway||address.path,address.house_number].filter(Boolean).join(' ')
  return [...new Set([road,address.suburb||address.quarter||address.neighbourhood,address.city||address.town||address.village||address.municipality].filter(Boolean))].join(', ')
}

export function reverseGeocode(latitude,longitude){
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return Promise.reject(new Error('Coordinate non valide.'))
  const key=`${latitude.toFixed(5)},${longitude.toFixed(5)}`
  if(cache.has(key))return cache.get(key)
  const task=queue.then(async()=>{
    await pause(Math.max(0,1100-(Date.now()-lastRequest)))
    lastRequest=Date.now()
    const url=new URL('/reverse',process.env.NOMINATIM_URL||'https://nominatim.openstreetmap.org')
    url.search=new URLSearchParams({lat:String(latitude),lon:String(longitude),format:'jsonv2',zoom:'18','accept-language':'it'})
    const response=await fetch(url,{headers:{'User-Agent':'RadioLog/1.0 (https://github.com/samu-meso/fujitsu-mdt)'},signal:AbortSignal.timeout(10000)})
    if(!response.ok)throw new Error('Ricerca indirizzo non disponibile. Riprova.')
    const result=await response.json(),address=formatAddress(result.address||{})
    if(!address)throw new Error('Nessun indirizzo trovato per questo punto.')
    return address
  })
  queue=task.catch(()=>{})
  cache.set(key,task)
  task.catch(()=>cache.delete(key))
  if(cache.size>500)cache.delete(cache.keys().next().value)
  return task
}
