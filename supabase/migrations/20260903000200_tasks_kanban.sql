-- =============================================================================
-- Tarefas vira quadro Kanban.
--
-- 4a coluna "Aguardando" entre Em Andamento e Concluida (pra tarefa parada
-- esperando algo de terceiros, sem estar "em progresso" nem "feita"), e uma
-- etiqueta livre (texto curto, cor atribuida por hash no client) pra
-- categorizar o card visualmente — igual as tags "Urgente"/"Evergreen" do
-- fluxo de conteudo.
-- =============================================================================

alter type public.task_status add value 'waiting' after 'in_progress';
alter table public.tasks add column tag text;
