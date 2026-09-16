import {useCallback,useEffect,useRef,useState} from 'react'

type Kind='info'|'emergency'
export function useAlertSound(id:string|undefined,kind:Kind|undefined){
  const players=useRef<Partial<Record<Kind,HTMLAudioElement>>>({})
  const played=useRef(new Set<string>()),pending=useRef<{id:string;kind:Kind}|null>(null)
  const attempt=useRef(0),priming=useRef(false),enabled=useRef(false)
  const [ready,setReady]=useState(false)
  const player=useCallback((type:Kind)=>{
    if(!players.current[type]){
      const audio=new Audio(`/sounds/${type}.wav`);audio.preload='auto'
      audio.addEventListener('error',()=>{enabled.current=false;setReady(false)})
      players.current[type]=audio
    }
    return players.current[type]!
  },[])
  const play=useCallback((type:Kind,alertId?:string)=>{
    const token=++attempt.current
    Object.values(players.current).forEach(audio=>audio.pause())
    const audio=player(type);audio.volume=1;audio.currentTime=0
    try{
      return audio.play().then(()=>{
        if(token!==attempt.current)return
        enabled.current=true;setReady(true)
        if(alertId){played.current.add(alertId);if(pending.current?.id===alertId)pending.current=null}
      }).catch(()=>{if(token===attempt.current){enabled.current=false;setReady(false)}})
    }catch{enabled.current=false;setReady(false);return Promise.resolve()}
  },[player])
  const unlock=useCallback(()=>{
    const alert=pending.current
    if(alert)return play(alert.kind,alert.id)
    if(enabled.current||priming.current)return Promise.resolve()
    priming.current=true
    const token=attempt.current
    // Start both media elements inside the gesture, before awaiting playback.
    const jobs=(['info','emergency'] as Kind[]).map(type=>{
      const audio=player(type);audio.volume=0
      try{return audio.play().then(()=>{if(token===attempt.current){audio.pause();audio.currentTime=0;audio.volume=1}return true}).catch(()=>false)}catch{return Promise.resolve(false)}
    })
    return Promise.all(jobs).then(results=>{
      priming.current=false
      if(token===attempt.current){enabled.current=results.every(Boolean);setReady(enabled.current)}
    })
  },[play,player])
  useEffect(()=>{
    const activate=(event:Event)=>{
      // Explicit sound controls call play themselves; avoid two competing starts.
      if((event.target as Element)?.closest?.('[data-sound-control]'))return
      void unlock()
    }
    const events=['touchend','click','keydown']
    events.forEach(event=>document.addEventListener(event,activate,true))
    const hide=()=>{
      if(document.visibilityState!=='visible'){
        ++attempt.current;Object.values(players.current).forEach(audio=>audio.pause())
        enabled.current=false;setReady(false)
      }
    }
    document.addEventListener('visibilitychange',hide)
    return()=>{
      ++attempt.current
      events.forEach(event=>document.removeEventListener(event,activate,true))
      document.removeEventListener('visibilitychange',hide)
      Object.values(players.current).forEach(audio=>{audio.pause();audio.removeAttribute('src');audio.load()})
      players.current={};enabled.current=false
    }
  },[unlock])
  useEffect(()=>{
    pending.current=id&&kind&&!played.current.has(id)?{id,kind}:null
    if(pending.current)void play(pending.current.kind,pending.current.id)
  },[id,kind,play])
  return {ready,unlock,preview:(type:Kind)=>play(type,id&&type===kind?id:undefined)}
}
