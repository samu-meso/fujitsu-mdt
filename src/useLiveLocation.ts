import {useEffect,useState} from 'react'

export type LiveLocation={latitude:number;longitude:number;accuracy:number;timestamp:number}

export function useLiveLocation(){
  const [enabled,setEnabled]=useState(false)
  const [location,setLocation]=useState<LiveLocation|null>(null)
  const [error,setError]=useState('')
  useEffect(()=>{
    if(!enabled)return
    let active=true
    const watch=navigator.geolocation.watchPosition(position=>{
      if(!active)return
      setLocation({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,timestamp:position.timestamp})
      setError('')
    },reason=>{
      if(!active)return
      setError(reason.code===1?'Posizione negata. Consenti l’accesso alla posizione nelle impostazioni del browser.':reason.code===2?'Posizione non disponibile. Controlla che il GPS sia attivo.':'La posizione tarda ad arrivare. Rimango in attesa del GPS.')
      if(reason.code===1){setEnabled(false);setLocation(null)}
    },{enableHighAccuracy:true,maximumAge:5_000,timeout:20_000})
    return()=>{active=false;navigator.geolocation.clearWatch(watch)}
  },[enabled])

  function start(){
    if(!window.isSecureContext){setError('Per usare la posizione apri il sito in HTTPS.');return}
    if(!navigator.geolocation){setError('Questo browser non supporta la posizione.');return}
    setError('');setLocation(null);setEnabled(true)
  }
  function stop(){setEnabled(false);setLocation(null);setError('')}
  return {enabled,location,error,start,stop}
}
