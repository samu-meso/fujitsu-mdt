import test from 'node:test'
import assert from 'node:assert/strict'
import {formatAddress,reverseGeocode} from '../scripts/lib/geocoding.js'
test('address formatter uses street, optional civic number and actual municipality',()=>{
  assert.equal(formatAddress({road:'Via Emilia',house_number:'41',suburb:'Ospizio',city:'Reggio Emilia'}),'Via Emilia 41, Ospizio, Reggio Emilia')
  assert.equal(formatAddress({pedestrian:'Piazza Tricolore',city:'Reggio Emilia'}),'Piazza Tricolore, Reggio Emilia')
  assert.equal(formatAddress({road:'Vicolo Squallore',town:'Modena'}),'Vicolo Squallore, Modena')
  assert.equal(formatAddress({suburb:'Modena',city:'Modena'}),'Modena')
})
test('invalid coordinates are rejected without contacting a geocoder',async()=>{
  await assert.rejects(reverseGeocode(NaN,10),/Coordinate/)
  await assert.rejects(reverseGeocode(91,10),/Coordinate/)
  await assert.rejects(reverseGeocode(44,181),/Coordinate/)
})
