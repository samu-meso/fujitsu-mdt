export type EmergencyBase = {
  id:string; name:string; category:'fire'|'red-cross'|'green-cross'|'hospital'|'hq';
  label:string; symbol:string; address:string; latitude:number; longitude:number;
  sourceUrl:string; coordinateSourceUrl:string; details?:string;
}

// Verified on 2026-09-16: official addresses and mapped facility coordinates.
// Fixed facilities in the city of Reggio Emilia, separate from user reports.
export const emergencyBases:EmergencyBase[] = [
  {
    id:'hq-reggio',name:'HQ',category:'hq',label:'HQ',symbol:'HQ',
    address:'Via Marco Emilio Lepido, 4',latitude:44.6907536,longitude:10.6510969,
    details:'Sede del gruppo.',
    sourceUrl:'https://www.openstreetmap.org/node/7200791813',
    coordinateSourceUrl:'https://www.openstreetmap.org/node/7200791813',
  },
  {
    id:'vvf-reggio',name:'Comando Vigili del fuoco di Reggio Emilia',category:'fire',
    label:'Vigili del fuoco',symbol:'VVF',address:'Via della Canalina, 8',
    latitude:44.6876258,longitude:10.6180874,
    sourceUrl:'https://www.vigilfuoco.it/sedi-vvf/comando-vvf-di-reggio-emilia',
    coordinateSourceUrl:'https://www.openstreetmap.org/node/4525384101',
  },
  {
    id:'cri-reggio',name:'Croce Rossa Italiana — Comitato di Reggio Emilia',category:'red-cross',
    label:'Croce Rossa',symbol:'+',address:'Via della Croce Rossa, 1',
    latitude:44.7069525,longitude:10.6528608,
    sourceUrl:'https://www.cri.re.it/contatti/',
    coordinateSourceUrl:'https://www.openstreetmap.org/node/12807382490',
  },
  {
    id:'croce-verde-reggio',name:'Pubblica Assistenza Croce Verde — Reggio Emilia',category:'green-cross',
    label:'Croce Verde',symbol:'+',address:'Via della Croce Verde, 3',
    latitude:44.6748436,longitude:10.6030446,
    sourceUrl:'https://www.croceverde.re.it/contatti/',
    coordinateSourceUrl:'https://www.croceverde.re.it/contatti/',
  },
  {
    id:'ps-reggio',name:'Pronto soccorso — Arcispedale Santa Maria Nuova',category:'hospital',
    label:'Pronto soccorso',symbol:'PS',address:'Viale Risorgimento, 80',
    latitude:44.6838258,longitude:10.6314509,
    details:'Fabbricato E, gruppo salita 6, piano 0. Marker sull’ingresso del pronto soccorso da via Cesare Beccaria.',
    sourceUrl:'https://guidaservizi.fascicolo-sanitario.it/dettaglio/luogo/3155344/3152900',
    coordinateSourceUrl:'https://www.openstreetmap.org/node/4414695357',
  },
]
