-- Database rows and Storage objects cannot be deleted atomically across services.
-- The client removes Storage first, then metadata. This RPC safely finds orphan rows;
-- schedule cleanup externally only if required after interrupted requests.
create or replace function public.list_attachment_paths(ids uuid[])
returns table(id uuid, storage_path text) language sql stable security invoker
as $$ select a.id,a.storage_path from public.attachments a where a.id=any(ids) $$;
revoke all on function public.list_attachment_paths(uuid[]) from public;
grant execute on function public.list_attachment_paths(uuid[]) to authenticated;

