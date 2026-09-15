import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Report, ReportType } from './types'
import { date } from './api'

export default function Map({reports,types,onSelect,onCreate,large=false}:{reports:Report[];types:ReportType[];onSelect:(id:string)=>void;onCreate:(lat:number,lng:number)=>void;large?:boolean}) {
  const element=useRef<HTMLDivElement>(null), map=useRef<L.Map|null>(null), layer=useRef<L.LayerGroup|null>(null)
  const callbacks=useRef({onSelect,onCreate})
  useEffect(()=>{callbacks.current={onSelect,onCreate}},[onSelect,onCreate])
  useEffect(()=>{
    if(!element.current) return
    const instance=L.map(element.current,{zoomControl:false}).setView([44.735,10.60],10)
    map.current=instance
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19}).addTo(instance)
    L.control.zoom({position:'bottomright'}).addTo(instance)
    layer.current=L.layerGroup().addTo(instance)
    instance.on('click',(e:L.LeafletMouseEvent)=>callbacks.current.onCreate(e.latlng.lat,e.latlng.lng))
    const observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(element.current)
    return ()=>{observer.disconnect();instance.remove();map.current=null}
  },[])
  useEffect(()=>{
    layer.current?.clearLayers()
    reports.forEach(report=>{
      const type=types.find(t=>t.id===report.typeId)
      const icon=L.divIcon({className:'custom-marker',html:`<span class="map-pin ${type?.icon==='triangle'?'red':''}">${type?.icon==='triangle'?'!':'⌁'}</span>`,iconSize:[34,40],iconAnchor:[17,40]})
      const content=document.createElement('div');content.className='map-popup'
      const title=document.createElement('strong');title.textContent=report.title
      const meta=document.createElement('small');meta.textContent=`${type?.name} · ${date(report.eventDate)}`
      const description=document.createElement('p');description.textContent=report.description.slice(0,100)
      const button=document.createElement('button');button.textContent='Apri dettagli →';button.onclick=()=>callbacks.current.onSelect(report.id)
      content.append(title,meta,description,button)
      L.marker([report.latitude,report.longitude],{icon,alt:report.title}).bindPopup(content).addTo(layer.current!)
    })
  },[reports,types])
  return <div className={`map-wrap ${large?'large':''}`}><div ref={element} className="leaflet-map" aria-label="Mappa interattiva di Reggio Emilia e provincia"/><div className="map-location"><span className="live-dot"/> Reggio Emilia e provincia</div><button className="map-center" title="Ricentra la mappa" onClick={()=>map.current?.setView([44.735,10.60],10)}>⌖</button><div className="map-legend"><span><i className="dot blue"/>Scansione frequenze</span><span><i className="dot red"/>Emergenza</span></div></div>
}
