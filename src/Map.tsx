import {useEffect,useRef,useState} from 'react'
import {Building2,LocateFixed} from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type {Report,ReportType} from './types'
import {date} from './api'
import {emergencyBases} from './emergencyBases'
import {baseIconSvg} from './baseIcons'
import {pingExpiresAt} from './pings'
import {useLiveLocation} from './useLiveLocation'
import {mapZones} from './mapZones'
import {useSharedLocations} from './useSharedLocations'

function resetCity(instance:L.Map){
  instance.fitBounds(emergencyBases.map(base=>[base.latitude,base.longitude] as L.LatLngTuple),{padding:[36,70],maxZoom:13})
}

export default function Map({userId,reports,types,onSelect,onCreate,large=false}:{userId:string;reports:Report[];types:ReportType[];onSelect:(id:string)=>void;onCreate:(lat:number,lng:number)=>void;large?:boolean}){
  const element=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null)
  const reportLayer=useRef<L.LayerGroup|null>(null),baseLayer=useRef<L.LayerGroup|null>(null),locationLayer=useRef<L.LayerGroup|null>(null)
  const membersLayer=useRef<L.LayerGroup|null>(null)
  const distanceLayer=useRef<L.LayerGroup|null>(null)
  const [selectedUserId,setSelectedUserId]=useState<string|null>(null)
  const [followGPS,setFollowGPS]=useState(false)
  const zoneLayer=useRef<L.LayerGroup|null>(null)
  const centered=useRef(false),callbacks=useRef({onSelect,onCreate})
  const [showBases,setShowBases]=useState(true)
  const [showZones,setShowZones]=useState(true)
  const {enabled,location,error,start,stop}=useLiveLocation()
  const {members,sharing,error:sharingError}=useSharedLocations(userId,enabled&&!error,location)
  const selectedMember=members.find(member=>member.user_id===selectedUserId)
  const distance=location&&selectedMember&&!error?L.latLng(location.latitude,location.longitude).distanceTo(L.latLng(selectedMember.latitude,selectedMember.longitude)):null
  const distanceText=distance===null?'':distance<1000?`${Math.round(distance)} m`:`${(distance/1000).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})} km`
  useEffect(()=>{callbacks.current={onSelect,onCreate}},[onSelect,onCreate])
  useEffect(()=>{
    if(!element.current)return
    const instance=L.map(element.current,{zoomControl:false})
    resetCity(instance)
    map.current=instance
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19}).addTo(instance)
    L.control.zoom({position:'bottomright'}).addTo(instance)
    instance.createPane('zones').style.zIndex='350'
    instance.getPane('zones')!.style.pointerEvents='none'
    instance.createPane('liveUsers').style.zIndex='710'
    instance.getPane('liveUsers')!.style.pointerEvents='none'
    zoneLayer.current=L.layerGroup().addTo(instance)
    reportLayer.current=L.layerGroup().addTo(instance)
    baseLayer.current=L.layerGroup().addTo(instance)
    locationLayer.current=L.layerGroup().addTo(instance)
    membersLayer.current=L.layerGroup().addTo(instance)
    distanceLayer.current=L.layerGroup().addTo(instance)
    instance.on('click',(event:L.LeafletMouseEvent)=>{
      const target=event.originalEvent?.target
      if(target instanceof Element&&target.closest('.leaflet-marker-icon,.leaflet-popup,.leaflet-control,.member-tooltip'))return
      callbacks.current.onCreate(event.latlng.lat,event.latlng.lng)
    })
    const observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(element.current)
    return()=>{observer.disconnect();instance.remove();map.current=null}
  },[])

  useEffect(()=>{
    zoneLayer.current?.clearLayers()
    if(!showZones)return
    mapZones.forEach(zone=>{
      L.polygon(zone.points,{pane:'zones',color:zone.color,weight:1.5,opacity:0.55,fillColor:zone.color,fillOpacity:0.12,interactive:false,className:'map-zone'}).addTo(zoneLayer.current!)
      const icon=L.divIcon({className:'zone-label',html:`<span style="--zone-color:${zone.color}">${zone.name.toUpperCase()}</span>`,iconSize:[70,24],iconAnchor:[35,12]})
      L.marker(zone.label,{icon,pane:'zones',interactive:false,keyboard:false}).addTo(zoneLayer.current!)
    })
  },[showZones])

  useEffect(()=>{
    reportLayer.current?.clearLayers()
    reports.forEach(report=>{
      const type=types.find(item=>item.id===report.typeId)
      const icon=L.divIcon({className:'custom-marker',html:`<span class="map-pin ${type?.icon==='triangle'?'red':''}"><span>${type?.icon==='triangle'?'!':'⌁'}</span></span>`,iconSize:[34,40],iconAnchor:[17,40]})
      const content=document.createElement('div');content.className='map-popup'
      const title=document.createElement('strong');title.textContent=report.title
      const meta=document.createElement('small');meta.textContent=`${type?.name} · ${date(report.eventDate)}`
      const description=document.createElement('p');description.textContent=report.description.slice(0,100)
      const expiresAt=pingExpiresAt(report.createdAt,report.pingDurationHours)
      const expiry=document.createElement('small');expiry.textContent=expiresAt===Infinity?'Segnalazione permanente':`Visibile fino al ${date(new Date(expiresAt).toISOString())}`
      const button=document.createElement('button');button.textContent='Apri dettagli →';button.onclick=()=>callbacks.current.onSelect(report.id)
      content.append(title,meta,description,expiry,button)
      L.marker([report.latitude,report.longitude],{icon,alt:report.title,title:report.title,bubblingMouseEvents:false}).bindPopup(content).addTo(reportLayer.current!)
    })
  },[reports,types])

  useEffect(()=>{
    baseLayer.current?.clearLayers()
    if(!showBases)return
    emergencyBases.forEach(base=>{
      const icon=L.divIcon({className:'base-marker',html:`<span class="base-pin ${base.category}">${baseIconSvg(base.category)}</span>${base.category==='hq'?'<span class="hq-marker-label">HQ</span>':''}`,iconSize:[40,48],iconAnchor:[20,44],popupAnchor:[0,-38]})
      const popup=document.createElement('div');popup.className='map-popup base-popup'
      const title=document.createElement('strong');title.textContent=base.name
      const address=document.createElement('p');address.textContent=`${base.address}, Reggio Emilia`
      popup.append(title,address)
      if(base.details){const details=document.createElement('small');details.textContent=base.details;popup.append(details)}
      const links=document.createElement('div');links.className='base-popup-links'
      for(const [label,url] of [[base.category==='hq'?'Posizione su OpenStreetMap':'Fonte ufficiale',base.sourceUrl],['Indicazioni',`https://www.google.com/maps/dir/?api=1&destination=${base.latitude},${base.longitude}`]]){
        const link=document.createElement('a');link.textContent=label;link.href=url;link.target='_blank';link.rel='noopener noreferrer';links.append(link)
      }
      popup.append(links)
      L.marker([base.latitude,base.longitude],{icon,alt:base.name,title:base.label,zIndexOffset:100,bubblingMouseEvents:false}).bindPopup(popup).addTo(baseLayer.current!)
    })
  },[showBases])

  useEffect(()=>{
    locationLayer.current?.clearLayers()
    if(!location){centered.current=false;return}
    const point:L.LatLngTuple=[location.latitude,location.longitude]
    L.circle(point,{radius:location.accuracy,color:'#67a9ff',fillColor:'#67a9ff',fillOpacity:0.12,weight:1,interactive:false}).addTo(locationLayer.current!)
    const icon=L.divIcon({className:'user-location-marker',html:'<span class="user-location-dot"></span>',iconSize:[22,22],iconAnchor:[11,11]})
    L.marker(point,{icon,alt:'La tua posizione',title:'La tua posizione',zIndexOffset:1000,bubblingMouseEvents:false}).on('click',event=>{L.DomEvent.stopPropagation(event.originalEvent)}).addTo(locationLayer.current!)
    if(!centered.current){map.current?.setView(point,16,{animate:false});centered.current=true}
  },[location])

  useEffect(()=>{if(followGPS&&location&&map.current){map.current.stop();map.current.setView([location.latitude,location.longitude],map.current.getZoom(),{animate:false})}},[followGPS,location])

  useEffect(()=>{
    membersLayer.current?.eachLayer(layer=>{if(layer instanceof L.Marker)layer.closeTooltip()})
    membersLayer.current?.clearLayers()
    members.forEach(member=>{
      const content=document.createElement('div')
      const dot=document.createElement('span');dot.className='shared-location-dot'
      const label=document.createElement('span');label.className='member-tooltip';label.textContent=member.profiles.username
      content.append(dot,label)
      const icon=L.divIcon({className:'shared-location-marker',html:content,iconSize:[36,36],iconAnchor:[18,18]})
      L.marker([member.latitude,member.longitude],{icon,pane:'liveUsers',alt:member.profiles.username,title:'Clicca per mostrare o nascondere la distanza',bubblingMouseEvents:false}).on('click',event=>{
        L.DomEvent.stopPropagation(event.originalEvent)
        map.current?.closePopup()
        setSelectedUserId(current=>current===member.user_id?null:member.user_id)
      }).addTo(membersLayer.current!)
    })
  },[members])

  useEffect(()=>{
    distanceLayer.current?.clearLayers()
    if(!location||!selectedMember||error)return
    L.polyline([[location.latitude,location.longitude],[selectedMember.latitude,selectedMember.longitude]],{color:'#73d5ab',weight:2,dashArray:'7 7',interactive:false,className:'user-distance-line'}).addTo(distanceLayer.current!)
  },[location,selectedMember,error])

  return <div className="map-section">
    <div className="map-toolbar">
      <button className={`button secondary ${enabled?'selected':''}`} aria-pressed={enabled} onClick={()=>{setFollowGPS(false);if(enabled)stop();else start()}}><LocateFixed size={16}/>{enabled?'Ferma posizione':'La mia posizione'}</button>
      {enabled&&<button className={`button secondary ${followGPS?'selected':''}`} aria-pressed={followGPS} disabled={!location} onClick={()=>setFollowGPS(value=>!value)}><LocateFixed size={16}/>Segui GPS</button>}
      <button className={`button secondary ${showBases?'selected':''}`} aria-pressed={showBases} onClick={()=>setShowBases(value=>!value)}><Building2 size={16}/>Presidi</button>
      <button className={`button secondary ${showZones?'selected':''}`} aria-pressed={showZones} onClick={()=>setShowZones(value=>!value)}>Zone</button>
      <span className="location-status" role="status">{location?`GPS attivo · ±${Math.round(location.accuracy)} m`:enabled?'Ricerca posizione…':'Attiva il GPS per condividere la posizione'}</span>
    </div>
    <span className="sharing-status" role="status">{sharing?'Posizione condivisa con il portale':enabled?'Condivisione in attesa del GPS':'Posizione non condivisa'} · {members.length} {members.length===1?'altro utente visibile':'altri utenti visibili'}</span>
    {selectedMember&&<div className="user-distance" role="status"><span><strong>{selectedMember.profiles.username}</strong> · {distance!==null?<>Distanza in linea d’aria: <strong>{distanceText}</strong></>:error?'GPS non disponibile':enabled?'In attesa della tua posizione…':'Attiva la tua posizione per calcolare la distanza'}</span><button className="button secondary" onClick={()=>setSelectedUserId(null)}>Chiudi</button></div>}
    {sharingError&&<p className="location-error" role="alert">{sharingError}</p>}
    {error&&<p className="location-error" role="alert">{error}</p>}
    <div className={`map-wrap ${large?'large':''}`}>
      <div ref={element} className="leaflet-map" aria-label="Mappa interattiva di Reggio Emilia e provincia"/>
      <div className="map-location"><span className="live-dot"/>Reggio Emilia</div>
      <button className="map-center" aria-label={location?'Ricentra sulla mia posizione':'Ricentra su Reggio Emilia'} title={location?'Ricentra sulla mia posizione':'Ricentra su Reggio Emilia'} onClick={()=>{if(!map.current)return;if(location)map.current.setView([location.latitude,location.longitude],16);else resetCity(map.current)}}><LocateFixed size={20}/></button>
      <div className="map-legend"><span><i className="dot blue"/>Scansione frequenze</span><span><i className="dot red"/>Emergenza</span></div>
    </div>
    {showBases&&<div className="bases-legend" aria-label="Legenda presidi">{emergencyBases.map(base=><span key={base.id}><i className={`base-key ${base.category}`} dangerouslySetInnerHTML={{__html:baseIconSvg(base.category)}}/>{base.label}</span>)}</div>}
    {showZones&&<div className="zones-legend" aria-label="Legenda zone">{mapZones.map(zone=><span key={zone.id}><i style={{backgroundColor:zone.color}}/>{zone.name}</span>)}<small>Settori indicativi dell’area urbana</small></div>}
  </div>
}
