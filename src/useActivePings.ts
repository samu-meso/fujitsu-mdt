import {useEffect,useState} from 'react'
import type {Report} from './types'
import {isActivePing,pingExpiresAt} from './pings'

export function useActivePings(reports:Report[]){
  const [now,setNow]=useState(Date.now)
  useEffect(()=>{
    const refresh=()=>setNow(Date.now())
    const remaining=reports.map(r=>pingExpiresAt(r.createdAt)-Date.now()).filter(value=>value>0)
    // Schedule at the next expiry; also refresh when returning to a background tab.
    const timer=remaining.length?window.setTimeout(refresh,Math.min(...remaining,60_000)):undefined
    document.addEventListener('visibilitychange',refresh)
    window.addEventListener('focus',refresh)
    return()=>{
      if(timer!==undefined)window.clearTimeout(timer)
      document.removeEventListener('visibilitychange',refresh)
      window.removeEventListener('focus',refresh)
    }
  },[reports,now])
  return reports.filter(r=>isActivePing(r.createdAt,Math.max(now,Date.now())))
}
