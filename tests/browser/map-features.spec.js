import {test,expect} from '@playwright/test'

const userId='11111111-1111-4111-8111-111111111111'
const user={id:userId,email:'map-test@example.com',role:'authenticated',aud:'authenticated',created_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{username:'Map test'}}
const profile={id:userId,username:'Map test',role:'admin',active:true,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}

async function prepare(page,live={members:[],writes:[],deletes:0}){
  const now=Date.now()
  const reports=[
    {id:'22222222-2222-4222-8222-222222222222',title:'Ping attivo',created_at:new Date(now-3600000).toISOString()},
    {id:'33333333-3333-4333-8333-333333333333',title:'Ping scaduto',created_at:new Date(now-49*3600000).toISOString()},
    {id:'44444444-4444-4444-8444-444444444444',title:'Ping in scadenza',created_at:new Date(now-48*3600000+60000).toISOString()},
  ].map(report=>({...report,description:'Fixture locale',event_date:new Date(now).toISOString(),latitude:44.698,longitude:10.630,address:'Reggio Emilia',type_id:'radio',author_id:userId,dossier_id:null,updated_at:new Date(now).toISOString(),profiles:{username:'Map test'},...live.reportOverrides?.[report.title]}))
  await page.route('**/auth/v1/**',route=>{
    const path=new URL(route.request().url()).pathname
    if(path.endsWith('/user'))return route.fulfill({json:user})
    const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
    const access_token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:userId,role:'authenticated',exp:Math.floor(now/1000)+3600})}.test`
    return route.fulfill({json:{access_token,token_type:'bearer',expires_in:3600,expires_at:Math.floor(now/1000)+3600,refresh_token:'test-refresh',user}})
  })
  await page.route('**/api/report-address',route=>route.fulfill({json:{address:'Via di test, Reggio Emilia'}}))
  await page.routeWebSocket('**/realtime/v1/websocket**',socket=>{
    if(!live.realtime)return socket.close()
    socket.onMessage(raw=>{
      const value=JSON.parse(String(raw)),array=Array.isArray(value)
      const msg=array?{join_ref:value[0],ref:value[1],topic:value[2],event:value[3],payload:value[4]}:value
      const reply=payload=>socket.send(JSON.stringify(array?[msg.join_ref,msg.ref,msg.topic,'phx_reply',payload]:{...msg,event:'phx_reply',payload}))
      if(msg.event==='phx_join'){
        const bindings=msg.payload.config.postgres_changes.map((binding,index)=>({...binding,id:index+1}))
        reply({status:'ok',response:{postgres_changes:bindings}})
        live.pushRealtime=record=>{
          const payload={ids:[1],data:{schema:'public',table:'portal_alerts',type:'INSERT',commit_timestamp:new Date().toISOString(),columns:[],record,old_record:{},errors:null}}
          socket.send(JSON.stringify(array?[msg.join_ref,null,msg.topic,'postgres_changes',payload]:{join_ref:msg.join_ref,ref:null,topic:msg.topic,event:'postgres_changes',payload}))
        }
      }else reply({status:'ok',response:{}})
    })
  })
  await page.route('**/rest/v1/**',route=>{
    const url=new URL(route.request().url()),table=url.pathname.split('/').at(-1)
    if(table==='live_locations'){
      if(route.request().method()==='POST'){live.writes.push(route.request().postDataJSON());return route.fulfill({status:201,body:''})}
      if(route.request().method()==='DELETE'){live.deletes++;return route.fulfill({status:204,body:''})}
      return route.fulfill({json:live.members})
    }
    if(table==='portal_sessions'){
      if(route.request().method()==='POST'){(live.sessionWrites??=[]).push(route.request().postDataJSON());return route.fulfill({status:201,body:''})}
      if(route.request().method()==='DELETE'){live.sessionDeletes=(live.sessionDeletes||0)+1;return route.fulfill({status:204,body:''})}
      return route.fulfill({json:live.portalMembers||[]})
    }
    if(table==='portal_alerts'){
      if(route.request().method()==='POST'){
        const body=route.request().postDataJSON()
        if(!(live.portalMembers||[]).some(member=>member.user_id===body.recipient_id))return route.fulfill({status:403,json:{message:'Destinatario offline'}})
        ;(live.sentAlerts??=[]).push(body)
        return route.fulfill({status:201,body:''})
      }
      if(route.request().method()==='PATCH'){
        const id=url.searchParams.get('id')?.slice(3)
        ;(live.acknowledgements??=[]).push(id)
        for(const alert of live.inbox||[])if(alert.id===id)alert.read_at=new Date().toISOString()
        return route.fulfill({status:204,body:''})
      }
      return route.fulfill({json:(live.inbox||[]).filter(alert=>!alert.read_at)})
    }
    if(table==='profiles'&&route.request().method()==='PATCH'){live.profileAlias=route.request().postDataJSON().alias;live.profileWrite={body:route.request().postDataJSON(),id:url.searchParams.get('id')};return route.fulfill({status:204,body:''})}
    const currentProfile={...profile,alias:live.profileAlias||''}
    const data=table==='profiles'?(url.searchParams.has('id')?currentProfile:[currentProfile]):table==='reports'?reports:table==='report_types'?[{id:'radio',name:'Scansione frequenze',color:'#548bfb',icon:'radio',active:true},{id:'emergency',name:'Emergenza',color:'#ef6464',icon:'triangle',active:true}]:[]
    return route.fulfill({json:data})
  })
  // Every geolocation value is simulated; tests never use device GPS or real data.
  await page.addInitScript(()=>{
    let success,error
    window.__geoCleared=0
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
      watchPosition:(onSuccess,onError)=>{success=onSuccess;error=onError;return 7},
      clearWatch:()=>{window.__geoCleared++},
    }})
    window.__geoSet=(lat,lng)=>success?.({coords:{latitude:lat,longitude:lng,accuracy:20},timestamp:Date.now()})
    window.__geoDeny=()=>error?.({code:1})
  })
  await page.goto('/')
  await page.getByLabel('Email',{exact:true}).fill('map-test@example.com')
  await page.getByLabel('Password',{exact:true}).fill('test-only-password')
  await page.getByRole('button',{name:'Accedi al tuo spazio'}).click()
  await expect(page.getByRole('heading',{name:'Mappa',exact:true})).toBeVisible()
  await expect(page.locator('.map-footer')).toContainText('2 ping attivi')
}

test('presidi permanenti e ping scaduti con storico conservato',async({page})=>{
  await prepare(page)
  await expect(page.locator('.base-marker')).toHaveCount(5)
  await page.getByTitle('HQ',{exact:true}).click()
  await expect(page.locator('.base-popup')).toContainText('Via Marco Emilio Lepido, 4')
  await expect(page.locator('.base-popup a').first()).toHaveAttribute('href','https://www.openstreetmap.org/node/7200791813')
  await page.locator('.leaflet-popup-close-button').click()
  await expect(page.locator('.map-zone')).toHaveCount(4)
  await expect(page.locator('.zone-label')).toHaveCount(4)
  await page.getByRole('button',{name:'Zone',exact:true}).click()
  await expect(page.locator('.map-zone')).toHaveCount(0)
  await expect(page.locator('.base-marker')).toHaveCount(5)
  await page.getByRole('button',{name:'Zone',exact:true}).click()
  await expect(page.locator('.map-zone')).toHaveCount(4)
  await expect(page.locator('.custom-marker')).toHaveCount(2)
  await page.screenshot({path:'test-results/map-desktop.png',fullPage:true})
  await expect(page.getByAltText('Ping scaduto',{exact:true})).toHaveCount(0)
  await page.locator('.base-marker').filter({has:page.locator('.hospital')}).click()
  await expect(page.locator('.base-popup')).toContainText('Viale Risorgimento, 80')
  await expect(page.locator('.base-popup')).toContainText('via Cesare Beccaria')
  await expect(page.locator('.base-popup a').first()).toHaveAttribute('href',/fascicolo-sanitario/)
  await page.locator('.leaflet-popup-close-button').click()
  await page.getByRole('button',{name:'Presidi',exact:true}).click()
  await expect(page.locator('.base-marker')).toHaveCount(0)
  await page.getByRole('button',{name:'Presidi',exact:true}).click()
  await expect(page.locator('.base-marker')).toHaveCount(5)
  await page.getByRole('button',{name:'Segnalazioni',exact:true}).click()
  await expect(page.getByRole('button',{name:'Ping scaduto',exact:true})).toBeVisible()
})

test('GPS si aggiorna, si ferma e gestisce il permesso negato',async({page})=>{
  await prepare(page)
  await page.getByRole('button',{name:'La mia posizione',exact:true}).click()
  await expect(page.locator('.location-status')).toContainText('Ricerca posizione')
  await page.evaluate(()=>window.__geoSet(44.698,10.630))
  await expect(page.locator('.user-location-marker')).toHaveCount(1)
  await expect(page.locator('.location-status')).toContainText('GPS attivo · ±20 m')
  await page.waitForTimeout(400)
  const before=await page.locator('.user-location-marker').getAttribute('style')
  await page.evaluate(()=>window.__geoSet(44.699,10.631))
  await expect.poll(()=>page.locator('.user-location-marker').getAttribute('style')).not.toBe(before)
  await page.getByRole('button',{name:'Ferma posizione',exact:true}).click()
  await expect(page.locator('.user-location-marker')).toHaveCount(0)
  expect(await page.evaluate(()=>window.__geoCleared)).toBeGreaterThan(0)
  await page.getByRole('button',{name:'La mia posizione',exact:true}).click()
  await page.evaluate(()=>window.__geoDeny())
  await expect(page.getByRole('alert')).toContainText('Posizione negata')
  await expect(page.getByRole('button',{name:'La mia posizione',exact:true})).toBeVisible()
})

test('un ping scompare a scadenza senza ricaricare, i presidi restano',async({page})=>{
  await page.clock.install()
  await prepare(page)
  await page.clock.fastForward(65000)
  await expect(page.locator('.custom-marker')).toHaveCount(1)
  await expect(page.locator('.map-footer')).toContainText('1 ping attivo')
  await expect(page.locator('.base-marker')).toHaveCount(5)
})

test('mappa e controlli su mobile senza scorrimento orizzontale',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  await prepare(page)
  await expect(page.getByRole('button',{name:'La mia posizione',exact:true})).toBeVisible()
  await expect(page.locator('.bases-legend')).toBeVisible()
  const bounds=await page.locator('.leaflet-map').boundingBox()
  for(const marker of await page.locator('.base-marker').all()){
    const box=await marker.boundingBox()
    expect(box.x).toBeGreaterThan(bounds.x)
    expect(box.x+box.width).toBeLessThan(bounds.x+bounds.width)
    expect(box.y).toBeGreaterThan(bounds.y)
    expect(box.y+box.height).toBeLessThan(bounds.y+bounds.height)
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await page.screenshot({path:'test-results/map-mobile.png',fullPage:true})
})


test('segue il GPS e condivide solo quando attivo; mostra le posizioni recenti del gruppo',async({page})=>{
  const live={members:[
    {user_id:'55555555-5555-4555-8555-555555555555',latitude:44.698,longitude:10.630,accuracy:12,updated_at:new Date().toISOString(),profiles:{username:'Utente online'}},
    {user_id:'66666666-6666-4666-8666-666666666666',latitude:44.698,longitude:10.630,accuracy:12,updated_at:new Date(Date.now()-60000).toISOString(),profiles:{username:'Utente offline'}},
  ],writes:[],deletes:0}
  await prepare(page,live)
  await expect(page.locator('.shared-location-marker')).toHaveCount(1)
  await expect(page.locator('.member-tooltip')).toContainText('Utente online')
  expect(live.writes).toHaveLength(0)
  await page.getByRole('button',{name:'La mia posizione',exact:true}).click()
  await page.evaluate(()=>window.__geoSet(44.698,10.630))
  await expect(page.locator('.sharing-status')).toContainText('Posizione condivisa con il portale')
  expect(live.writes.at(-1)).toMatchObject({user_id:userId,latitude:44.698,longitude:10.630})
  await page.getByRole('button',{name:'Segui GPS',exact:true}).click()
  await page.evaluate(()=>window.__geoSet(44.710,10.650))
  await expect.poll(async()=>{
    const marker=await page.locator('.user-location-marker').boundingBox(),map=await page.locator('.leaflet-map').boundingBox()
    if(!marker||!map)return Infinity
    return Math.abs(marker.x+marker.width/2-map.x-map.width/2)+Math.abs(marker.y+marker.height/2-map.y-map.height/2)
  }).toBeLessThan(4)
  await expect.poll(()=>live.writes.at(-1)?.latitude).toBe(44.710)
  await page.getByRole('button',{name:'Segui GPS',exact:true}).click()
  await expect(page.getByRole('button',{name:'Segui GPS',exact:true})).toHaveAttribute('aria-pressed','false')
  await page.getByRole('button',{name:'Ferma posizione',exact:true}).click()
  await expect.poll(()=>live.deletes).toBeGreaterThan(0)
  await expect(page.locator('.sharing-status')).toContainText('Posizione non condivisa')
  await expect(page.locator('.shared-location-marker')).toHaveCount(1)
})

test('il GPS di un utente fermo resta condiviso; gli utenti disconnessi scadono',async({page})=>{
  await page.clock.install()
  const live={members:[{user_id:'55555555-5555-4555-8555-555555555555',latitude:44.698,longitude:10.630,accuracy:12,updated_at:new Date().toISOString(),profiles:{username:'Utente online'}}],writes:[],deletes:0}
  await prepare(page,live)
  await expect(page.locator('.shared-location-marker')).toHaveCount(1)
  await page.getByRole('button',{name:'La mia posizione',exact:true}).click()
  await page.evaluate(()=>window.__geoSet(44.698,10.630))
  await expect(page.locator('.sharing-status')).toContainText('Posizione condivisa')
  await page.clock.fastForward(60000)
  await expect(page.locator('.shared-location-marker')).toHaveCount(0)
  await expect.poll(()=>live.writes.length).toBeGreaterThan(1)
  await expect(page.locator('.sharing-status')).toContainText('Posizione condivisa')
  expect(live.deletes).toBe(0)
})

test('distanza in linea di aria aggiornata per entrambi e secondo clic per nasconderla',async({page})=>{
  const live={members:[{user_id:'55555555-5555-4555-8555-555555555555',latitude:44.700,longitude:10.630,accuracy:12,updated_at:new Date().toISOString(),profiles:{username:'Utente online'}}],writes:[],deletes:0}
  await prepare(page,live)
  const marker=page.locator('.shared-location-marker')
  await marker.click()
  await expect(page.locator('.user-distance')).toContainText('Attiva la tua posizione')
  await expect(page.getByRole('heading',{name:'Nuova segnalazione',exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'La mia posizione',exact:true}).click()
  await page.evaluate(()=>window.__geoSet(44.698,10.630))
  await expect(page.locator('.user-distance')).toContainText('222 m')
  await expect(page.locator('.user-distance-line')).toHaveCount(1)
  await page.evaluate(()=>window.__geoSet(44.699,10.630))
  await expect(page.locator('.user-distance')).toContainText('111 m')
  live.members[0]={...live.members[0],latitude:44.710,updated_at:new Date().toISOString()}
  await expect(page.locator('.user-distance')).toContainText('1,22 km',{timeout:8000})
  live.members[0]={...live.members[0],latitude:44.700,updated_at:new Date().toISOString()}
  await expect(page.locator('.user-distance')).toContainText('111 m',{timeout:8000})
  await marker.click()
  await expect(page.locator('.user-distance')).toHaveCount(0)
  await expect(page.locator('.user-distance-line')).toHaveCount(0)
  await marker.click()
  await expect(page.locator('.user-distance')).toContainText('111 m')
  live.members=[]
  await expect(page.locator('.user-distance')).toHaveCount(0,{timeout:8000})
  await expect(page.locator('.user-distance-line')).toHaveCount(0)
})

test('punti sovrapposti e nome utente non aprono precisione o nuova segnalazione',async({page})=>{
  const live={members:[{user_id:'55555555-5555-4555-8555-555555555555',latitude:44.698,longitude:10.630,accuracy:12,updated_at:new Date().toISOString(),profiles:{username:'Utente sovrapposto'}}],writes:[],deletes:0}
  await prepare(page,live)
  await page.getByRole('button',{name:'La mia posizione',exact:true}).click()
  await page.evaluate(()=>window.__geoSet(44.698,10.630))
  await expect(page.locator('.user-location-marker')).toHaveCount(1)
  await page.locator('.shared-location-dot').click()
  await expect(page.locator('.user-distance')).toContainText('0 m')
  await expect(page.locator('.leaflet-popup')).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.locator('.member-tooltip').click()
  await expect(page.locator('.user-distance')).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.locator('.member-tooltip').click()
  await expect(page.locator('.user-distance')).toContainText('0 m')
  await page.evaluate(()=>window.__geoSet(44.699,10.630))
  await page.locator('.user-location-marker').click()
  await expect(page.locator('.leaflet-popup')).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // Background clicks still allow creating a report.
  await page.locator('.leaflet-map').click({position:{x:100,y:150}})
  await expect(page.getByRole('dialog',{name:'Dettagli segnalazione'})).toBeVisible()
})

test('emergenze di 24 ore scadono, permanenti restano e il modulo offre tre durate',async({page})=>{
  const live={members:[],writes:[],deletes:0,reportOverrides:{
    'Ping attivo':{type_id:'emergency',ping_duration_hours:24,created_at:new Date(Date.now()-25*3600000).toISOString()},
    'Ping scaduto':{type_id:'emergency',ping_duration_hours:null,latitude:44.703,longitude:10.640},
  }}
  await prepare(page,live)
  await expect(page.getByTitle('Ping attivo',{exact:true})).toHaveCount(0)
  await page.getByTitle('Ping scaduto',{exact:true}).click()
  await expect(page.locator('.map-popup')).toContainText('Segnalazione permanente')
  await page.locator('.leaflet-popup-close-button').click()
  await page.getByRole('button',{name:'Nuova segnalazione',exact:true}).click()
  await expect(page.getByLabel('Durata sulla mappa')).toHaveCount(0)
  await page.locator('.detail-form select[name="typeId"]').selectOption('emergency')
  const duration=page.getByLabel('Durata sulla mappa')
  await expect(duration).toHaveValue('48')
  await duration.selectOption('24')
  await expect(duration).toHaveValue('24')
  await duration.selectOption('permanent')
  await expect(duration).toHaveValue('permanent')
  const submitted=[]
  await page.route('**/rest/v1/reports?**',async route=>{
    if(route.request().method()!=='POST')return route.fallback()
    submitted.push(route.request().postDataJSON())
    return route.fulfill({status:400,json:{message:'Salvataggio simulato per test'}})
  })
  await page.getByLabel('Titolo',{exact:true}).fill('Emergenza di test')
  await page.getByLabel('Descrizione',{exact:true}).fill('Descrizione di test')
  await page.getByRole('button',{name:'Salva segnalazione',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('Salvataggio simulato')
  expect(submitted.at(-1)).toMatchObject({type_id:'emergency',ping_duration_hours:null})
  await duration.selectOption('24')
  await page.getByRole('button',{name:'Salva segnalazione',exact:true}).click()
  await expect.poll(()=>submitted.at(-1)?.ping_duration_hours).toBe(24)
})

test('HQ conta i membri nel raggio e aggiorna colore per movimento e stop GPS',async({page})=>{
  const live={members:[{user_id:'55555555-5555-4555-8555-555555555555',latitude:44.6907536,longitude:10.6510969,accuracy:12,updated_at:new Date().toISOString(),profiles:{username:'Membro HQ'}}],writes:[],deletes:0}
  await prepare(page,live)
  await expect(page.locator('.hq-presence')).toContainText('Membri attivi: 1')
  await expect(page.locator('.base-marker.hq-active')).toHaveCount(1)
  await page.getByTitle('HQ',{exact:true}).click()
  await expect(page.locator('.hq-popup-presence')).toContainText('Membro HQ')
  await page.locator('.leaflet-popup-close-button').click()
  await page.getByRole('button',{name:'La mia posizione',exact:true}).click()
  await page.evaluate(()=>window.__geoSet(44.6907536,10.6510969))
  await expect(page.locator('.hq-presence')).toContainText('Membri attivi: 2')
  await expect(page.locator('.hq-presence')).toContainText('entro 25 m')
  await page.evaluate(()=>window.__geoSet(44.69096,10.6510969))
  await expect(page.locator('.hq-presence')).toContainText('Membri attivi: 2')
  await page.evaluate(()=>window.__geoSet(44.691,10.6510969))
  await expect(page.locator('.hq-presence')).toContainText('Membri attivi: 1')
  await page.evaluate(()=>window.__geoSet(44.6911,10.6510969))
  await expect(page.locator('.hq-presence')).toContainText('Membri attivi: 1')
  live.members=[]
  await expect(page.locator('.hq-presence')).toContainText('Membri attivi: 0',{timeout:8000})
  await expect(page.locator('.base-marker.hq-active')).toHaveCount(0)
  await page.evaluate(()=>window.__geoSet(44.6907536,10.6510969))
  await expect(page.locator('.hq-presence')).toContainText('Membri attivi: 1')
  await page.getByRole('button',{name:'Ferma posizione',exact:true}).click()
  await expect(page.locator('.hq-presence')).toContainText('Membri attivi: 0')
})

test('localita nella lista mobile e coordinate di riserva per indirizzi vuoti',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  await prepare(page,{members:[],writes:[],deletes:0,reportOverrides:{'Ping attivo':{address:'Via della Canalina, Reggio Emilia'},'Ping scaduto':{address:''}}})
  await page.getByRole('button',{name:'Segnalazioni',exact:true}).click()
  await expect(page.locator('.report-locality').filter({hasText:'Via della Canalina'})).toBeVisible()
  await expect(page.locator('.report-locality').filter({hasText:'44.69800, 10.63000'})).toBeVisible()
  await page.screenshot({path:'test-results/reports-locality-mobile.png',fullPage:true})
})

test('alert a membri online senza GPS, invio e ricezione sopra un altro dialog',async({page})=>{
  const peer='55555555-5555-4555-8555-555555555555'
  const member={user_id:peer,updated_at:new Date().toISOString(),profiles:{username:'Membro online'}}
  const live={members:[],writes:[],deletes:0,portalMembers:[member,{...member}],inbox:[]}
  await prepare(page,live)
  await expect(page.locator('.portal-alert-button i')).toHaveText('1')
  await expect(page.locator('.user-location-marker')).toHaveCount(0)
  await page.locator('.portal-alert-button').click()
  await page.getByLabel('Destinatario alert').selectOption(peer)
  await page.getByLabel('Messaggio alert').fill('  Emergenza in zona HQ  ')
  await page.getByRole('button',{name:'Invia alert',exact:true}).click()
  await expect(page.locator('.alert-success')).toContainText('Alert inviato')
  expect(live.sentAlerts).toEqual([{sender_id:userId,recipient_id:peer,kind:'emergency',message:'Emergenza in zona HQ'}])
  await page.getByRole('button',{name:'Chiudi alert',exact:true}).click()
  await page.getByRole('button',{name:'Nuova segnalazione',exact:true}).click()
  live.inbox.push({id:'77777777-7777-4777-8777-777777777777',sender_id:peer,recipient_id:userId,kind:'emergency',message:'Serve supporto immediato',created_at:new Date().toISOString(),read_at:null,profiles:{username:'Membro online'}})
  await expect(page.getByRole('dialog',{name:'Alert ricevuto'})).toBeVisible()
  await expect(page.locator('.received-alert-message')).toHaveText('Serve supporto immediato')
  await page.screenshot({path:'test-results/portal-alert.png',fullPage:true})
  await page.getByRole('button',{name:'Ho letto',exact:true}).click()
  await expect(page.getByRole('dialog',{name:'Alert ricevuto'})).not.toBeVisible()
  expect(live.acknowledgements).toContain('77777777-7777-4777-8777-777777777777')
  await expect(page.getByRole('dialog',{name:'Dettagli segnalazione'})).toBeVisible()
})

test('un alert non viene inviato se il destinatario si disconnette',async({page})=>{
  const peer='55555555-5555-4555-8555-555555555555'
  const live={members:[],writes:[],deletes:0,portalMembers:[{user_id:peer,updated_at:new Date().toISOString(),profiles:{username:'Membro online'}}]}
  await prepare(page,live)
  await page.locator('.portal-alert-button').click()
  await page.getByLabel('Destinatario alert').selectOption(peer)
  await page.getByLabel('Messaggio alert').fill('Richiesta di supporto')
  live.portalMembers=[]
  await page.getByRole('button',{name:'Invia alert',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('destinatario potrebbe non essere più online')
  expect(live.sentAlerts||[]).toHaveLength(0)
})

test('Realtime apre immediatamente un alert prima del controllo periodico',async({page})=>{
  await page.clock.install()
  const live={members:[],writes:[],deletes:0,inbox:[],realtime:true}
  await prepare(page,live)
  await expect.poll(()=>typeof live.pushRealtime).toBe('function')
  const alert={id:'88888888-8888-4888-8888-888888888888',sender_id:'55555555-5555-4555-8555-555555555555',recipient_id:userId,kind:'info',message:'Avviso via Realtime',created_at:new Date().toISOString(),read_at:null,profiles:{username:'Membro online'}}
  live.inbox.push(alert)
  live.pushRealtime(alert)
  // The page clock is frozen: no 2-second polling tick can deliver this alert.
  await expect(page.getByRole('dialog',{name:'Alert ricevuto'})).toBeVisible()
  await expect(page.locator('.received-alert-message')).toHaveText('Avviso via Realtime')
})

test('alert leggibile su mobile e avvisi non confermati recuperati alla riapertura',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  const live={members:[],writes:[],deletes:0,inbox:[]}
  await prepare(page,live)
  await expect(page.locator('.portal-alert-button')).toBeVisible()
  live.inbox.push({id:'99999999-9999-4999-8999-999999999999',sender_id:'55555555-5555-4555-8555-555555555555',recipient_id:userId,kind:'info',message:'Avviso da confermare',created_at:new Date().toISOString(),read_at:null,profiles:{username:'Membro online'}})
  await expect(page.getByRole('dialog',{name:'Alert ricevuto'})).toBeVisible()
  await page.reload()
  await expect(page.getByRole('dialog',{name:'Alert ricevuto'})).toBeVisible()
  await expect(page.locator('.received-alert-message')).toHaveText('Avviso da confermare')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await page.screenshot({path:'test-results/portal-alert-mobile.png',fullPage:true})
})

test('via ricavata dalle coordinate, manuale preservato e nuova ricerca dopo spostamento',async({page})=>{
  await prepare(page)
  const requests=[]
  await page.route('**/api/report-address',route=>{
    const point=route.request().postDataJSON();requests.push(point)
    return route.fulfill({json:{address:point.latitude===44.699?'Piazza Tricolore, Reggio Emilia':'Via Adua, Reggio Emilia'}})
  })
  await page.getByRole('button',{name:'Nuova segnalazione',exact:true}).click()
  const address=page.getByLabel('Indirizzo o località',{exact:true})
  await expect(address).toHaveValue('Via Adua, Reggio Emilia')
  expect(requests[0]).toMatchObject({latitude:44.698,longitude:10.632})
  await address.fill('Località inserita a mano')
  await expect(address).toHaveValue('Località inserita a mano')
  await page.getByText('Posizione e fascicolo collegato',{exact:true}).click()
  await page.getByLabel('Latitudine',{exact:true}).fill('44.699')
  await expect(address).toHaveValue('Piazza Tricolore, Reggio Emilia')
  await expect(page.getByRole('button',{name:'Trova via dalle coordinate'})).toBeEnabled()
  await page.screenshot({path:'test-results/report-address.png',fullPage:true})
})

test('geocodifica non disponibile permette comunque di salvare una segnalazione',async({page})=>{
  await prepare(page)
  await page.route('**/api/report-address',route=>route.fulfill({status:502,json:{error:'Ricerca indirizzo non disponibile'}}))
  let saved
  await page.route('**/rest/v1/reports?**',route=>{
    if(route.request().method()!=='POST')return route.fallback()
    saved=route.request().postDataJSON()
    return route.fulfill({status:400,json:{message:'Salvataggio simulato'}})
  })
  await page.getByRole('button',{name:'Nuova segnalazione',exact:true}).click()
  await expect(page.getByText('Ricerca indirizzo non disponibile',{exact:true})).toBeVisible()
  await page.getByLabel('Titolo',{exact:true}).fill('Segnalazione urgente')
  await page.getByLabel('Descrizione',{exact:true}).fill('Richiesta di supporto in zona')
  await page.getByRole('button',{name:'Salva segnalazione',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('Salvataggio simulato')
  expect(saved).toMatchObject({title:'Segnalazione urgente',address:'',latitude:44.698,longitude:10.632})
})

test('file audio reali riproducono avvisi ripetuti ed emergenze',async({page})=>{
  await page.addInitScript(()=>{
    window.__sounds=[]
    const play=HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play=function(){
      if(this.volume>0)this.addEventListener('ended',()=>window.__sounds.push(this.src.split('/').pop()),{once:true})
      return play.call(this)
    }
  })
  await prepare(page,{members:[],writes:[],deletes:0,inbox:[]})
  await page.locator('.portal-alert-button').click()
  await page.getByRole('button',{name:'Prova suono avviso'}).click()
  await expect.poll(()=>page.evaluate(()=>window.__sounds)).toEqual(['info.wav'])
  await page.getByRole('button',{name:'Prova suono avviso'}).click()
  await expect.poll(()=>page.evaluate(()=>window.__sounds)).toEqual(['info.wav','info.wav'])
  await page.getByRole('button',{name:'Prova suono emergenza'}).click()
  await expect.poll(()=>page.evaluate(()=>window.__sounds),{timeout:7000}).toEqual(['info.wav','info.wav','emergency.wav'])
})

test('mobile recupera un alert bloccato e riproduce anche il successivo senza ripetere il polling',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  await page.addInitScript(()=>{
    window.__sounds=[];window.__block=false
    HTMLMediaElement.prototype.play=function(){
      if(window.__block)return Promise.reject(new DOMException('Blocked','NotAllowedError'))
      if(this.volume>0)window.__sounds.push({file:this.src.split('/').pop(),time:this.currentTime})
      return Promise.resolve()
    }
    HTMLMediaElement.prototype.pause=function(){}
  })
  const live={members:[],writes:[],deletes:0,inbox:[]}
  await prepare(page,live)
  await page.locator('.portal-alert-button').click()
  await page.getByRole('button',{name:'Chiudi alert',exact:true}).click()
  await page.evaluate(()=>{window.__sounds=[];window.__block=true})
  const make=(id,kind)=>({id,sender_id:'55555555-5555-4555-8555-555555555555',recipient_id:userId,kind,message:'Test audio mobile',created_at:new Date().toISOString(),read_at:null,profiles:{username:'Membro online'}})
  live.inbox.push(make('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','emergency'))
  const received=page.getByRole('dialog',{name:'Alert ricevuto'})
  await expect(received).toBeVisible()
  await expect(received.getByText('Audio bloccato: tocca Riproduci suono.')).toBeVisible()
  expect(await page.evaluate(()=>window.__sounds)).toEqual([])
  await page.evaluate(()=>window.__block=false)
  await received.getByRole('button',{name:'Riproduci suono'}).click()
  await expect.poll(()=>page.evaluate(()=>window.__sounds)).toEqual([{file:'emergency.wav',time:0}])
  await page.waitForTimeout(2200)
  expect(await page.evaluate(()=>window.__sounds.length)).toBe(1)
  await received.getByRole('button',{name:'Ho letto',exact:true}).click()
  live.inbox.push(make('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','info'))
  await expect(received).toBeVisible()
  await expect.poll(()=>page.evaluate(()=>window.__sounds)).toEqual([{file:'emergency.wav',time:0},{file:'info.wav',time:0}])
  await received.getByRole('button',{name:'Riproduci suono'}).click()
  await expect.poll(()=>page.evaluate(()=>window.__sounds.length)).toBe(3)
})

 test('alias personale salvato, recuperato alla riapertura e cancellabile',async({page})=>{
  const live={members:[],writes:[],deletes:0}
  await prepare(page,live)
  const openProfile=async()=>{await page.getByRole('button',{name:'Menu account'}).click();await page.getByRole('button',{name:'Profilo',exact:true}).click()}
  await openProfile()
  await page.getByRole('textbox',{name:'Alias',exact:true}).fill('  Falco  ')
  await page.getByRole('button',{name:'Salva alias',exact:true}).click()
  await expect(page.getByRole('textbox',{name:'Alias',exact:true})).toHaveValue('Falco')
  expect(live.profileWrite).toEqual({body:{alias:'Falco'},id:`eq.${userId}`})
  await page.reload()
  await openProfile()
  await expect(page.getByRole('textbox',{name:'Alias',exact:true})).toHaveValue('Falco')
  await page.getByRole('textbox',{name:'Alias',exact:true}).fill('')
  await page.getByRole('button',{name:'Salva alias',exact:true}).click()
  await expect.poll(()=>live.profileAlias).toBe('')
 })
