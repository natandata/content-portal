-- =============================================================================
-- Branding do cliente — ferramenta de estrategia da equipe, um registro por
-- cliente. Mesmo padrao de client_profiles: so a equipe le e escreve
-- (can_view_client / can_manage_client); nao e algo que o cliente preenche
-- ou ve na propria area.
-- =============================================================================

create table if not exists public.client_branding (
  client_id uuid primary key references public.clients (id) on delete cascade,

  -- Conceituacao: essencia da marca
  essence_persona text,
  essence_defends text,
  essence_rejects text,
  essence_missed text,
  essence_word text,

  -- Conceituacao: arquetipo (os 12 arquetipos de marca classicos)
  archetype text
    constraint client_branding_archetype_values check (
      archetype is null or archetype in (
        'heroi', 'mago', 'sabio', 'criador', 'governante', 'cara_comum',
        'amante', 'prestativo', 'inocente', 'explorador', 'rebelde', 'bobo_da_corte'
      )
    ),
  archetype_notes text,

  -- Expressao
  voice_tone text,
  color_palette text,
  typography text,
  visual_references text,

  -- Estrategia
  target_audience text,
  value_proposition text,
  differentiators text,
  content_pillars text,

  updated_at timestamptz not null default now()
);

-- Trava de bom senso contra colar um documento inteiro num campo pensado
-- para uma resposta curta.
do $$
declare
  col text;
begin
  for col in
    select unnest(array[
      'essence_persona', 'essence_defends', 'essence_rejects', 'essence_missed',
      'essence_word', 'archetype_notes', 'voice_tone', 'color_palette',
      'typography', 'visual_references', 'target_audience', 'value_proposition',
      'differentiators', 'content_pillars'
    ])
  loop
    execute format(
      'alter table public.client_branding add constraint client_branding_%s_length check (char_length(%I) <= 2000)',
      col, col
    );
  end loop;
end $$;

create trigger client_branding_set_updated_at
  before update on public.client_branding
  for each row execute function public.set_updated_at();

alter table public.client_branding enable row level security;

create policy "client_branding_select" on public.client_branding
  for select to authenticated
  using (public.can_view_client(client_id));

create policy "client_branding_insert" on public.client_branding
  for insert to authenticated
  with check (public.can_manage_client(client_id));

create policy "client_branding_update" on public.client_branding
  for update to authenticated
  using (public.can_manage_client(client_id))
  with check (public.can_manage_client(client_id));

create policy "client_branding_delete" on public.client_branding
  for delete to authenticated
  using (public.can_manage_client(client_id));
