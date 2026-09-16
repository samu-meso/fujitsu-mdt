import type {LatLngTuple} from 'leaflet'

// Visual operating sectors of the urban area, not administrative boundaries.
const center:LatLngTuple=[44.698,10.630]
const nw:LatLngTuple=[44.735,10.565],ne:LatLngTuple=[44.735,10.695]
const sw:LatLngTuple=[44.660,10.565],se:LatLngTuple=[44.660,10.695]
export const mapZones:{id:string;name:string;color:string;points:LatLngTuple[];label:LatLngTuple}[]=[
  {id:'north',name:'Nord',color:'#74a7ff',points:[center,nw,ne],label:[44.720,10.630]},
  {id:'south',name:'Sud',color:'#ffb568',points:[center,se,sw],label:[44.676,10.630]},
  {id:'east',name:'Est',color:'#bc99ff',points:[center,ne,se],label:[44.698,10.673]},
  {id:'west',name:'Ovest',color:'#73d5ab',points:[center,sw,nw],label:[44.698,10.587]},
]
