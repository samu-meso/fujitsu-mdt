import {test,expect} from '@playwright/test'

const userId='11111111-1111-4111-8111-111111111111'
const user={id:userId,email:'map-test@example.com',role:'authenticated',aud:'authenticated',created_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{username:'Map test'}}
const profile={id:userId,username:'Map test',role:'admin',active:true,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}

async function prepare(page){
  const now=Date.now()
  const reports=[
    {id:'22222222-2222-4222-8222-222222222222',title:'Ping attivo',created_at:new Date(now-3600000).toISOString()},
    {id:'33333333-3333-4333-8333-333333333333',title:'Ping scaduto',created_at:new Date(now-49*3600000).toISOString()},
    {id:'44444444-4444-4444-8444-444444444444',title:'Ping in scadenza',created_at:new Date(now-48*3600000+60000).toISOString()},
  ].map(report=>({...report,description:'Fixture locale',event_date:new Date(now).toISOString(),latitude:44.698,longitude:10.630,address:'Reggio Emilia',type_id:'radio',author_id:userId,dossier_id:null,updated_at:new Date(now).toISOString(),profiles:{username:'Map test'}}))
  await page.route('**/auth/v1/**',route=>{
    const path=new URL(route.request().url()).pathname
    if(path.endsWith('/user'))return route.fulfill({json:user})
    const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
    const access_token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:userId,role:'authenticated',exp:Math.floor(now/1000)+3600})}.test`
    return route.fulfill({json:{access_token,token_type:'bearer',expires_in:3600,expires_at:Math.floor(now/1000)+3600,refresh_token:'test-refresh',user}})
  })
  await page.route('**/rest/v1/**',route=>{
    const url=new URL(route.request().url()),table=url.pathname.split('/').at(-1)
    const data=table==='profiles'?(url.searchParams.has('id')?profile:[profile]):table==='reports'?reports:table==='report_types'?[{id:'radio',name:'Scansione frequenze',color:'#548bfb',icon:'radio',active:true}]:[]
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
  await expect(page.locator('.base-marker')).toHaveCount(4)
  await expect(page.locator('.map-zone')).toHaveCount(4)
  await expect(page.locator('.zone-label')).toHaveCount(4)
  await page.getByRole('button',{name:'Zone',exact:true}).click()
  await expect(page.locator('.map-zone')).toHaveCount(0)
  await expect(page.locator('.base-marker')).toHaveCount(4)
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
  await expect(page.locator('.base-marker')).toHaveCount(4)
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
  await expect(page.locator('.base-marker')).toHaveCount(4)
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
