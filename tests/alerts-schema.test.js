import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const sql=readFileSync(new URL('../supabase/migrations/20260916000400_portal_alerts.sql',import.meta.url),'utf8')
test('alerts protect recipients, sender identity and message contents',()=>{
  assert.match(sql,/alter table public\.portal_alerts enable row level security/)
  assert.match(sql,/revoke all on public\.portal_alerts from public,anon,authenticated/)
  assert.match(sql,/recipient_id=auth\.uid\(\) or sender_id=auth\.uid\(\)/)
  assert.match(sql,/sender_id=auth\.uid\(\)[\s\S]*s\.user_id=recipient_id and p\.active/)
  assert.match(sql,/grant update\(read_at\) on public\.portal_alerts/)
  assert.doesNotMatch(sql,/grant update on public\.portal_alerts/)
  assert.match(sql,/portal_alerts_acknowledge[\s\S]*using\(recipient_id=auth\.uid\(\)/)
})
test('presence has server timestamps, expires and supports separate browser tabs',()=>{
  assert.match(sql,/id uuid primary key,[\s\S]*user_id uuid not null/)
  assert.match(sql,/new\.updated_at = clock_timestamp\(\)/)
  assert.match(sql,/s\.updated_at>now\(\)-interval '45 seconds'/)
  assert.match(sql,/alter publication supabase_realtime add table public\.portal_alerts/)
})
