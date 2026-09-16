import test from 'node:test'
import assert from 'node:assert/strict'
import {isActivePing,pingExpiresAt,PING_TTL_MS} from '../src/pings.ts'

test('ping expires exactly 48 hours after creation',()=>{
  const created='2026-09-14T10:00:00.000Z'
  const expiry=Date.parse('2026-09-16T10:00:00.000Z')
  assert.equal(PING_TTL_MS,172800000)
  assert.equal(pingExpiresAt(created),expiry)
  assert.equal(isActivePing(created,expiry-1),true)
  assert.equal(isActivePing(created,expiry),false)
  assert.equal(isActivePing(created,expiry+1),false)
})

test('expiry handles timezone offsets and invalid dates',()=>{
  assert.equal(pingExpiresAt('2026-09-14T12:00:00+02:00'),Date.parse('2026-09-16T10:00:00Z'))
  assert.equal(isActivePing('invalid'),false)
})

test('emergency duration can be 24 hours, 48 hours or permanent',()=>{
  const created='2026-09-14T10:00:00Z',day=Date.parse('2026-09-15T10:00:00Z')
  assert.equal(pingExpiresAt(created,24),day)
  assert.equal(isActivePing(created,day-1,24),true)
  assert.equal(isActivePing(created,day,24),false)
  assert.equal(isActivePing(created,day,48),true)
  assert.equal(pingExpiresAt(created,null),Infinity)
  assert.equal(isActivePing(created,day+365*86400000,null),true)
  assert.equal(isActivePing('invalid',day,null),false)
})
