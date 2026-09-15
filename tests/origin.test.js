import test from 'node:test'
import assert from 'node:assert/strict'
import {isAllowedOrigin} from '../api/origin.js'

test('accepts configured, production and current Vercel origins',()=>{
  const previous={app:process.env.APP_ORIGIN,production:process.env.VERCEL_PROJECT_PRODUCTION_URL,current:process.env.VERCEL_URL}
  process.env.APP_ORIGIN='http://localhost:5173, https://custom.example/'
  process.env.VERCEL_PROJECT_PRODUCTION_URL='fujitsu-mdt.vercel.app'
  process.env.VERCEL_URL='fujitsu-mdt-preview.vercel.app'
  try{
    assert.equal(isAllowedOrigin('http://localhost:5173'),true)
    assert.equal(isAllowedOrigin('https://custom.example'),true)
    assert.equal(isAllowedOrigin('https://fujitsu-mdt.vercel.app'),true)
    assert.equal(isAllowedOrigin('https://fujitsu-mdt-preview.vercel.app'),true)
    assert.equal(isAllowedOrigin('https://attacker.example'),false)
  }finally{
    for(const [key,value] of Object.entries({APP_ORIGIN:previous.app,VERCEL_PROJECT_PRODUCTION_URL:previous.production,VERCEL_URL:previous.current})){
      if(value===undefined)delete process.env[key]
      else process.env[key]=value
    }
  }
})
