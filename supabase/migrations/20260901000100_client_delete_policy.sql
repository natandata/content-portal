-- =============================================================================
-- Allow professionals to delete their own clients
--
-- Previously only admins could delete clients. Now professionals can also
-- delete clients they are responsible for (professional_id = auth.uid()).
-- =============================================================================

drop policy if exists "clients_delete_admin" on public.clients;

create policy "clients_delete_staff" on public.clients
  for delete to authenticated
  using (public.can_manage_client(id));
