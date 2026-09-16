import {useEffect,useRef,useState} from 'react'
import {supabase} from './supabase'

export type OnlineMember={user_id:string;profiles:{username:string};updated_at:string}
export type PortalAlert={id:string;sender_id:string;recipient_id:string;kind:'emergency'|'info';message:string;created_at:string;read_at:string|null;profiles:{username:string}}

export function usePortalAlerts(userId:string){
  const [sessionId]=useState(()=>crypto.randomUUID())
  const [members,setMembers]=useState<OnlineMember[]>([])
  const [alerts,setAlerts]=useState<PortalAlert[]>([])
  const [error,setError]=useState('')
  const queue=useRef<Promise<void>>(Promise.resolve())
  const refreshInbox=useRef<()=>void>(()=>{})
  const acknowledged=useRef(new Set<string>())
  useEffect(()=>{
    let active=true,inboxBusy=false
    const inbox=async()=>{
      if(!active||inboxBusy)return
      inboxBusy=true
      try{
        const {data,error}=await supabase.from('portal_alerts').select('*,profiles!portal_alerts_sender_id_fkey(username)').eq('recipient_id',userId).is('read_at',null).order('created_at',{ascending:true}).limit(20)
        if(error)throw error
        if(active)setAlerts((data as unknown as PortalAlert[]).filter(alert=>!acknowledged.current.has(alert.id)))
      }catch{if(active)setError('Alert non disponibili. Controlla la connessione.')}finally{inboxBusy=false}
    }
    refreshInbox.current=()=>{void inbox()}
    const remove=async()=>{await supabase.from('portal_sessions').delete().eq('id',sessionId).eq('user_id',userId)}
    const presence=()=>{
      queue.current=queue.current.then(async()=>{
        if(!active)return
        try{
          if(document.visibilityState==='visible'){
            const {error}=await supabase.from('portal_sessions').upsert({id:sessionId,user_id:userId},{onConflict:'id'})
            if(error)throw error
          }else await remove()
          const {data,error}=await supabase.from('portal_sessions').select('user_id,updated_at,profiles!portal_sessions_user_id_fkey(username)').neq('user_id',userId)
          if(error)throw error
          const unique=new Map<string,OnlineMember>()
          for(const member of data as unknown as OnlineMember[])if(Date.now()-Date.parse(member.updated_at)<45_000)unique.set(member.user_id,member)
          if(active){setMembers([...unique.values()].sort((a,b)=>a.profiles.username.localeCompare(b.profiles.username)));setError('')}
        }catch{if(active){setMembers([]);setError('Utenti online non disponibili. Controlla la connessione.')}}
      })
    }
    presence();void inbox()
    const timer=setInterval(presence,10_000),inboxTimer=setInterval(()=>{void inbox()},2_000)
    const channel=supabase.channel(`portal-alerts-${sessionId}`).on('postgres_changes',{event:'*',schema:'public',table:'portal_alerts',filter:`recipient_id=eq.${userId}`},()=>{void inbox()}).subscribe(status=>{if(status==='SUBSCRIBED')void inbox()})
    const visibility=()=>{presence();void inbox()}
    document.addEventListener('visibilitychange',visibility)
    return()=>{
      active=false;clearInterval(timer);clearInterval(inboxTimer);document.removeEventListener('visibilitychange',visibility)
      void supabase.removeChannel(channel)
      queue.current=queue.current.then(remove)
    }
  },[userId,sessionId])
  async function send(recipientId:string,kind:'emergency'|'info',message:string){
    const {error}=await supabase.from('portal_alerts').insert({sender_id:userId,recipient_id:recipientId,kind,message:message.trim()})
    if(error)throw new Error('Invio non riuscito. Il destinatario potrebbe non essere più online: aggiorna e riprova.')
  }
  async function acknowledge(id:string){
    const {error}=await supabase.from('portal_alerts').update({read_at:new Date().toISOString()}).eq('id',id).eq('recipient_id',userId)
    if(error)throw new Error('Conferma non riuscita. Riprova.')
    acknowledged.current.add(id)
    setAlerts(previous=>previous.filter(alert=>alert.id!==id));refreshInbox.current()
  }
  return {members,alerts,error,send,acknowledge}
}
