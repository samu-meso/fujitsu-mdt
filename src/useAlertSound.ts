import {useCallback,useEffect,useRef,useState} from 'react'

type Kind='info'|'emergency'
export function useAlertSound(id:string|undefined,kind:Kind|undefined){
  const context=useRef<AudioContext|null>(null),played=useRef(new Set<string>())
  const pending=useRef<{id:string;kind:Kind}|null>(null)
  const [ready,setReady]=useState(false)
  const tone=useCallback((type:Kind)=>{
    const audio=context.current
    if(!audio||audio.state!=='running')return
    const notes=type==='emergency'?[880,660,880,660,880,660]:[740,990]
    notes.forEach((frequency,index)=>{
      const start=audio.currentTime+index*(type==='emergency'?0.24:0.2)
      const oscillator=audio.createOscillator(),gain=audio.createGain()
      oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,start)
      gain.gain.setValueAtTime(0.0001,start);gain.gain.exponentialRampToValueAtTime(type==='emergency'?0.16:0.12,start+0.015);gain.gain.exponentialRampToValueAtTime(0.0001,start+0.18)
      oscillator.connect(gain);gain.connect(audio.destination)
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()}
      oscillator.start(start);oscillator.stop(start+0.2)
    })
  },[])
  const flush=useCallback(()=>{
    if(context.current?.state!=='running')return
    setReady(true)
    const alert=pending.current
    if(alert&&!played.current.has(alert.id)){
      tone(alert.kind);played.current.add(alert.id);pending.current=null
    }
  },[tone])
  const unlock=useCallback(()=>{
    try{
      const Constructor=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext
      if(!Constructor)return Promise.resolve()
      if(!context.current||context.current.state==='closed'){
        const audio=new Constructor();context.current=audio
        audio.onstatechange=()=>{if(context.current===audio){setReady(audio.state==='running');flush()}}
      }
      const audio=context.current
      if(audio.state==='running'){flush();return Promise.resolve()}
      setReady(false)
      // Start an actual one-frame silent buffer inside the touch/click handler.
      // Calling resume alone, or starting playback after awaiting it, fails on some iPhones.
      if(audio.createBufferSource&&audio.createBuffer){
        const source=audio.createBufferSource();source.buffer=audio.createBuffer(1,1,audio.sampleRate||44100)
        source.connect(audio.destination);source.onended=()=>source.disconnect();source.start(0)
      }
      return audio.resume().then(()=>{if(context.current===audio)flush()}).catch(()=>{if(context.current===audio)setReady(false)})
    }catch{return Promise.resolve()}
  },[flush])
  useEffect(()=>{
    const activate=()=>{void unlock()}
    // Mobile touch activation is granted at touchend/click, not necessarily pointerdown.
    const events=['touchend','click','pointerup','keydown']
    events.forEach(event=>document.addEventListener(event,activate,true))
    const restore=()=>{if(document.visibilityState==='visible'&&context.current)activate()}
    document.addEventListener('visibilitychange',restore);window.addEventListener('focus',restore)
    if(navigator.userActivation?.hasBeenActive)activate()
    return()=>{
      events.forEach(event=>document.removeEventListener(event,activate,true))
      document.removeEventListener('visibilitychange',restore);window.removeEventListener('focus',restore)
      const audio=context.current;context.current=null
      if(audio){audio.onstatechange=null;void audio.close().catch(()=>{})}
    }
  },[unlock])
  useEffect(()=>{
    pending.current=id&&kind&&!played.current.has(id)?{id,kind}:null
    if(context.current?.state==='running')flush()
    else if(pending.current&&context.current)void unlock()
  },[id,kind,flush,unlock])
  async function preview(type:Kind){await unlock();tone(type)}
  return {ready,unlock,preview}
}
