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
  const unlock=useCallback(async()=>{
    try{
      context.current??=new AudioContext()
      if(context.current.state==='suspended')await context.current.resume()
      if(context.current.state!=='running')return
      setReady(true)
      if(pending.current&&!played.current.has(pending.current.id)){
        played.current.add(pending.current.id);tone(pending.current.kind);pending.current=null
      }
    }catch{/* Visual alerts remain available if audio is unsupported or blocked. */}
  },[tone])
  useEffect(()=>{
    const activate=()=>{void unlock()}
    document.addEventListener('pointerdown',activate,true);document.addEventListener('keydown',activate,true)
    if(navigator.userActivation?.hasBeenActive)activate()
    return()=>{document.removeEventListener('pointerdown',activate,true);document.removeEventListener('keydown',activate,true);void context.current?.close();context.current=null}
  },[unlock])
  useEffect(()=>{
    pending.current=id&&kind&&!played.current.has(id)?{id,kind}:null
    if(pending.current&&context.current?.state==='running'){
      played.current.add(pending.current.id);tone(pending.current.kind);pending.current=null
    }
  },[id,kind,tone])
  async function preview(type:Kind){await unlock();tone(type)}
  return {ready,unlock,preview}
}
