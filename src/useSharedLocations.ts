import {useEffect,useRef,useState} from 'react'
import {supabase} from './supabase'
import type {LiveLocation} from './useLiveLocation'

export type SharedLocation={user_id:string;latitude:number;longitude:number;accuracy:number;updated_at:string;profiles:{username:string}}
const freshness=45_000

export function useSharedLocations(userId:string,enabled:boolean,location:LiveLocation|null){
  const latest=useRef({enabled,location})
  const queue=useRef<Promise<void>>(Promise.resolve())
  const [members,setMembers]=useState<SharedLocation[]>([])
  const [sharing,setSharing]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>{latest.current={enabled,location}},[enabled,location])
  useEffect(()=>{
    let active=true,published=false
    const remove=async()=>{
      const {error}=await supabase.from('live_locations').delete().eq('user_id',userId)
      if(error)throw error
      published=false
    }
    const sync=()=>{
      queue.current=queue.current.then(async()=>{
        if(!active)return
        try{
          const current=latest.current
          // Stationary devices may not emit another GPS fix. Heartbeats track presence.
          const fresh=current.enabled&&current.location
          if(fresh&&current.location){
            const {latitude,longitude,accuracy,timestamp}=current.location
            const {error}=await supabase.from('live_locations').upsert({user_id:userId,latitude,longitude,accuracy,sampled_at:new Date(timestamp).toISOString()},{onConflict:'user_id'})
            if(error)throw error
            published=true
          }else if(published){await remove()}
          const {data,error}=await supabase.from('live_locations').select('user_id,latitude,longitude,accuracy,updated_at,profiles!live_locations_user_id_fkey(username)').neq('user_id',userId)
          if(error)throw error
          if(active){setMembers(previous=>{const next=(data as unknown as SharedLocation[]).filter(member=>Date.now()-Date.parse(member.updated_at)<freshness);return JSON.stringify(previous)===JSON.stringify(next)?previous:next});setSharing(Boolean(fresh));setError('')}
        }catch{
          if(active){setSharing(false);setMembers([]);setError('Condivisione GPS non disponibile. Controlla la connessione e la configurazione Supabase.')}
        }
      })
    }
    sync()
    const timer=setInterval(sync,5_000)
    window.addEventListener('location-sharing-change',sync)
    return()=>{
      active=false;clearInterval(timer);window.removeEventListener('location-sharing-change',sync)
      queue.current=queue.current.then(async()=>{if(published)try{await remove()}catch{/* The server hides disconnected positions after 45 seconds. */}})
    }
  },[userId])
  useEffect(()=>{window.dispatchEvent(new Event('location-sharing-change'))},[enabled,location])
  return {members,sharing,error}
}
