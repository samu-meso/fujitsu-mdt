import {useEffect,useRef,useState} from 'react'
import {Building2,LocateFixed} from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type {Report,ReportType} from './types'
import {date} from './api'
import {emergencyBases} from './emergencyBases'
import {pingExpiresAt} from './pings'
import {useLiveLocation} from './useLiveLocation'

function resetCity(instance:L.Map){
  instance.fitBounds(emergencyBases.map(base=>[base.latitude,base.longitude] as L.LatLngTuple),{padding:[36,70],maxZoom:13})
}

export default function Map({reports,types,onSelect,onCreate,large=false}:{reports:Report[];types:ReportType[];onSelect:(id:string)=>void;onCreate:(lat:number,lng:number)=>void;large?:boolean}){
  const element=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null)
  const reportLayer=useRef<L.LayerGroup|null>(null),baseLayer=useRef<L.LayerGroup|null>(null),locationLayer=useRef<L.LayerGroup|null>(null)
  const centered=useRef(false),callbacks=useRef({onSelect,onCreate})
  const [showBases,setShowBases]=useState(true)
  const {enabled,location,error,start,stop}=useLiveLocation()
  useEffect(()=>{callbacks.current={onSelect,onCreate}},[onSelect,onCreate])
  useEffect(()=>{
    if(!element.current)return
    const instance=L.map(element.current,{zoomControl:false})
    resetCity(instance)
    map.current=instance
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19}).addTo(instance)
    L.control.zoom({position:'bottomright'}).addTo(instance)
    reportLayer.current=L.layerGroup().addTo(instance)
    baseLayer.current=L.layerGroup().addTo(instance)
    locationLayer.current=L.layerGroup().addTo(instance)
    instance.on('click',(event:L.LeafletMouseEvent)=>callbacks.current.onCreate(event.latlng.lat,event.latlng.lng))
    const observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(element.current)
    return()=>{observer.disconnect();instance.remove();map.current=null}
  },[])

  useEffect(()=>{
    reportLayer.current?.clearLayers()
    reports.forEach(report=>{
      const type=types.find(item=>item.id===report.typeId)
      const icon=L.divIcon({className:'custom-marker',html:`<span class="map-pin ${type?.icon==='triangle'?'red':''}"><span>${type?.icon==='triangle'?'!':'⌁'}</span></span>`,iconSize:[34,40],iconAnchor:[17,40]})
      const content=document.createElement('div');content.className='map-popup'
      const title=document.createElement('strong');title.textContent=report.title
      const meta=document.createElement('small');meta.textContent=`${type?.name} · ${date(report.eventDate)}`
      const description=document.createElement('p');description.textContent=report.description.slice(0,100)
      const expiry=document.createElement('small');expiry.textContent=`Visibile fino al ${date(new Date(pingExpiresAt(report.createdAt)).toISOString())}`
      const button=document.createElement('button');button.textContent='Apri dettagli →';button.onclick=()=>callbacks.current.onSelect(report.id)
      content.append(title,meta,description,expiry,button)
      L.marker([report.latitude,report.longitude],{icon,alt:report.title}).bindPopup(content).addTo(reportLayer.current!)
    })
  },[reports,types])

  useEffect(()=>{
    baseLayer.current?.clearLayers()
    if(!showBases)return
    emergencyBases.forEach(base=>{
      const icon=L.divIcon({className:'base-marker',html:`<span class="base-pin ${base.category}">${base.symbol}</span>`,iconSize:[34,34],iconAnchor:[17,17]})
      const popup=document.createElement('div');popup.className='map-popup base-popup'
      const title=document.createElement('strong');title.textContent=base.name
      const address=document.createElement('p');address.textContent=`${base.address}, Reggio Emilia`
      popup.append(title,address)
      if(base.details){const details=document.createElement('small');details.textContent=base.details;popup.append(details)}
      const links=document.createElement('div');links.className='base-popup-links'
      for(const [label,url] of [['Fonte ufficiale',base.sourceUrl],['Indicazioni',`https://www.google.com/maps/dir/?api=1&destination=${base.latitude},${base.longitude}`]]){
        const link=document.createElement('a');link.textContent=label;link.href=url;link.target='_blank';link.rel='noopener noreferrer';links.append(link)
      }
      popup.append(links)
      L.marker([base.latitude,base.longitude],{icon,alt:base.name,title:base.label,zIndexOffset:100}).bindPopup(popup).addTo(baseLayer.current!)
    })
  },[showBases])

  useEffect(()=>{
    locationLayer.current?.clearLayers()
    if(!location){centered.current=false;return}
    const point:L.LatLngTuple=[location.latitude,location.longitude]
    L.circle(point,{radius:location.accuracy,color:'#67a9ff',fillColor:'#67a9ff',fillOpacity:0.12,weight:1,interactive:false}).addTo(locationLayer.current!)
    const icon=L.divIcon({className:'user-location-marker',html:'<span class="user-location-dot"></span>',iconSize:[22,22],iconAnchor:[11,11]})
    const popup=document.createElement('div');popup.textContent=`La tua posizione · precisione ±${Math.round(location.accuracy)} m`
    L.marker(point,{icon,alt:'La tua posizione',title:'La tua posizione',zIndexOffset:1000}).bindPopup(popup).addTo(locationLayer.current!)
    if(!centered.current){map.current?.setView(point,16);centered.current=true}
  },[location])

  return <div className="map-section">
    <div className="map-toolbar">
      <button className={`button secondary ${enabled?'selected':''}`} aria-pressed={enabled} onClick={enabled?stop:start}><LocateFixed size={16}/>{enabled?'Ferma posizione':'La mia posizione'}</button>
      <button className={`button secondary ${showBases?'selected':''}`} aria-pressed={showBases} onClick={()=>setShowBases(value=>!value)}><Building2 size={16}/>Presidi</button>
      <span className="location-status" role="status">{location?`GPS attivo · ±${Math.round(location.accuracy)} m`:enabled?'Ricerca posizione…':'Posizione visibile solo a te'}</span>
    </div>
    {error&&<p className="location-error" role="alert">{error}</p>}
    <div className={`map-wrap ${large?'large':''}`}>
      <div ref={element} className="leaflet-map" aria-label="Mappa interattiva di Reggio Emilia e provincia"/>
      <div className="map-location"><span className="live-dot"/>Reggio Emilia</div>
      <button className="map-center" aria-label={location?'Ricentra sulla mia posizione':'Ricentra su Reggio Emilia'} title={location?'Ricentra sulla mia posizione':'Ricentra su Reggio Emilia'} onClick={()=>{if(!map.current)return;if(location)map.current.setView([location.latitude,location.longitude],16);else resetCity(map.current)}}><LocateFixed size={20}/></button>
      <div className="map-legend"><span><i className="dot blue"/>Scansione frequenze</span><span><i className="dot red"/>Emergenza</span></div>
    </div>
    {showBases&&<div className="bases-legend" aria-label="Legenda presidi">{emergencyBases.map(base=><span key={base.id}><i className={`base-key ${base.category}`}>{base.symbol}</i>{base.label}</span>)}</div>}
  </div>
}
