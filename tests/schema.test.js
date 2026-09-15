import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const sql=readFileSync(new URL('../supabase/migrations/20260915000100_radiolog_schema.sql',import.meta.url),'utf8')
const api=readFileSync(new URL('../api/admin-users.js',import.meta.url),'utf8')
const upload=readFileSync(new URL('../api/upload.js',import.meta.url),'utf8')
const client=readFileSync(new URL('../src/api.ts',import.meta.url),'utf8')
test('all exposed application tables enable RLS',()=>{
  for(const table of ['profiles','report_types','dossiers','reports','attachments','audit_log','dossier_counters'])assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`))
})
test('anonymous access has no policies and authenticated policies check active profile',()=>{
  assert.doesNotMatch(sql,/to\s+anon/i);assert.match(sql,/current_profile_active\(\)/);assert.match(sql,/current_profile_admin\(\)/)
})
test('dossier codes use an atomic database counter',()=>{
  assert.match(sql,/on conflict\(year\) do update set value = public\.dossier_counters\.value \+ 1/);assert.match(sql,/FASC-%s-%s/)
})
test('roles and activation cannot be changed by the browser',()=>{
  assert.match(sql,/new\.role := old\.role/);assert.match(sql,/new\.active := old\.active/);assert.match(sql,/grant update\(username\)/)
  assert.match(sql,/grant select\(id,username,role,active,created_at,updated_at\) on public\.profiles/);assert.doesNotMatch(sql,/grant select on public\.profiles/)
})
test('storage remains private and constrained',()=>{
  assert.match(sql,/values \('attachments','attachments',false,10485760/);assert.match(sql,/allowed_mime_types/);assert.doesNotMatch(sql,/create policy storage_insert/);assert.match(upload,/validSignature/);assert.match(upload,/file\.size>max/)
})
test('service role key is absent from frontend',()=>{
  assert.doesNotMatch(client,/SERVICE_ROLE/);assert.match(api,/SUPABASE_SERVICE_ROLE_KEY/);assert.doesNotMatch(api,/VITE_SUPABASE_SERVICE_ROLE_KEY/)
})
test('admin function verifies JWT and admin role',()=>{
  assert.match(api,/auth\.getUser\(token\)/);assert.match(api,/caller\.role!==['"]admin['"]/);assert.match(api,/caller\?\.active/)
})
