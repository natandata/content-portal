/**
 * Tipagem do schema `public` usada pelo supabase-js.
 *
 * Mantida a mao para o repositorio funcionar sem um projeto Supabase provisionado.
 * Depois de aplicar as migrations, o arquivo pode ser regenerado com:
 *   npx supabase gen types typescript --project-id <ref> --schema public
 */

export type UserRole = "admin" | "professional" | "client";
export type UserStatus = "active" | "inactive" | "pending";
export type ClientStatus = "active" | "inactive";

export type ChatLinkTarget = "dashboard" | "content" | "documents" | "feed";

export type InvoiceMethod = "boleto" | "link" | "pix" | "stripe";
export type InvoiceStatus = "open" | "paid";
export type CurrencyCode = "BRL" | "USD" | "EUR" | "GBP";

export type ContractStatus =
  | "awaiting_signature"
  | "signed"
  | "under_review"
  | "approved"
  | "replaced"
  /** Documento que nao pede assinatura: foi entregue e pronto. */
  | "delivered"
  /** Gerado (ex.: relatorio automatico), mas ainda nao liberado pro cliente ver. */
  | "pending_delivery";

export type DocumentKind = "contract" | "strategy" | "brandbook" | "mockup" | "report" | "other";

export type ContentType = "image" | "video" | "carousel";

export type ContentStatus =
  | "draft"
  | "submitted"
  | "awaiting_approval"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "published";

export type ApprovalStatus = "approved" | "rejected" | "revision_requested";

export type TaskStatus = "pending" | "in_progress" | "waiting" | "done";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  requested_at: string | null;
  /** Quando esta pessoa concluiu (ou pulou) o tour de primeiro acesso. */
  tour_seen_at: string | null;
  /** Quando esta pessoa respondeu (ou dispensou) o convite de notificacoes. */
  notifications_prompted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientRow = {
  id: string;
  name: string;
  company_name: string;
  email: string | null;
  phone: string | null;
  access_code: string;
  professional_id: string | null;
  auth_user_id: string | null;
  status: ClientStatus;
  cover_path: string | null;
  cover_position_y: number;
  /** Chave da paleta em src/lib/cover-palette.ts — capa e so cor, sem upload. */
  cover_color: string;
  /** Rotulo livre exibido como etiqueta no card (segmento/nicho do cliente). */
  tag: string | null;
  tour_seen_at: string | null;
  notifications_prompted_at: string | null;
  /** "pt-BR" | "en" — sincronizado do cookie de idioma via `set_preferred_locale`. */
  preferred_locale: string;
  created_at: string;
  updated_at: string;
}

/** Sem policy de RLS de proposito -- guarda token de OAuth, so a serviceRole le. */
export type ProfessionalGoogleAccountRow = {
  user_id: string;
  google_email: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  calendar_id: string;
  connected_at: string;
}

/**
 * Sem policy de RLS de proposito -- guarda token de OAuth, so a serviceRole
 * le. Convive com `ProfessionalGoogleAccountRow`: um profissional pode ter
 * as duas contas conectadas, ou so uma, ou nenhuma.
 */
export type ProfessionalCalendlyAccountRow = {
  user_id: string;
  calendly_uri: string;
  calendly_email: string;
  scheduling_url: string;
  organization_uri: string | null;
  event_type_uri: string | null;
  event_type_name: string | null;
  event_type_scheduling_url: string | null;
  event_type_duration: number | null;
  webhook_subscription_uri: string | null;
  webhook_signing_key: string | null;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string | null;
  connected_at: string;
}

/** Idempotencia do webhook da Calendly -- mesmo padrao claim-then-process de `StripeEventRow`. */
export type CalendlyWebhookEventRow = {
  id: string;
  event_type: string;
  received_at: string;
  processed_at: string | null;
  error: string | null;
}

export type MeetingRequestedBy = "client" | "professional";
export type MeetingStatus = "pending" | "approved" | "declined" | "cancelled" | "scheduled";
export type MeetingMethod = "google_meet" | "calendly";

export type MeetingRequestRow = {
  id: string;
  client_id: string;
  professional_id: string;
  requested_by: MeetingRequestedBy;
  method: MeetingMethod;
  contact_email: string;
  /** So preenchido no metodo google_meet — proposta manual de data/hora. */
  proposed_date: string | null;
  proposed_time: string | null;
  message: string | null;
  status: MeetingStatus;
  responded_at: string | null;
  google_event_id: string | null;
  meet_link: string | null;
  /** So preenchidos no metodo calendly, pelo webhook, quando a pessoa marca de verdade. */
  calendly_booking_url: string | null;
  calendly_event_uri: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type ContractRow = {
  id: string;
  client_id: string;
  title: string;
  notes: string | null;
  original_file_path: string | null;
  signed_file_path: string | null;
  status: ContractStatus;
  kind: DocumentKind;
  requires_signature: boolean;
  /** Mostra ao cliente o botao "Assinar com Gov.br" — redireciona, nao integra. */
  allow_gov_br_signature: boolean;
  /** Falso enquanto aguarda liberacao manual (ex.: relatorio recem-gerado) -- cliente so ve quando vira true. */
  client_visible: boolean;
  created_by: string | null;
  uploaded_at: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ContentRow = {
  id: string;
  client_id: string;
  professional_id: string | null;
  title: string;
  description: string | null;
  type: ContentType;
  status: ContentStatus;
  scheduled_date: string | null;
  /** Horario do post no dia agendado (HH:MM:SS). Nulo = sem hora definida. */
  scheduled_time: string | null;
  caption: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ContentFileRow = {
  id: string;
  content_id: string;
  /** Caminho no Storage. Nulo quando o arquivo mora atras de `external_url`. */
  file_path: string | null;
  /** Link externo (Drive, WeTransfer, OneDrive...). Exclusivo com `file_path`. */
  external_url: string | null;
  thumbnail_path: string | null;
  position: number;
  file_type: string;
  created_at: string;
}

export type PlatformSnapshotRow = {
  id: string;
  captured_at: string;
  database_bytes: number;
  storage_bytes: number;
  users_count: number;
  clients_count: number;
  contents_count: number;
}

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  user_agent: string | null;
  created_at: string;
}

export type ClientProfileRow = {
  client_id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_path: string | null;
  /** Numero exibido no cabecalho; nulo usa a contagem real do feed. */
  posts_count: number | null;
  followers_count: number;
  following_count: number;
  show_reels_tab: boolean;
  created_at: string;
  updated_at: string;
}

export type BrandArchetype =
  | "heroi"
  | "mago"
  | "sabio"
  | "criador"
  | "governante"
  | "cara_comum"
  | "amante"
  | "prestativo"
  | "inocente"
  | "explorador"
  | "rebelde"
  | "bobo_da_corte";

/** Ferramenta de estrategia da equipe — um registro por cliente, staff-only. */
export type ClientBrandingRow = {
  client_id: string;
  essence_persona: string | null;
  essence_defends: string | null;
  essence_rejects: string | null;
  essence_missed: string | null;
  essence_word: string | null;
  archetype: BrandArchetype | null;
  archetype_notes: string | null;
  voice_tone: string | null;
  color_palette: string | null;
  typography: string | null;
  visual_references: string | null;
  target_audience: string | null;
  value_proposition: string | null;
  differentiators: string | null;
  content_pillars: string | null;
  updated_at: string;
}

export type ProfileHighlightRow = {
  id: string;
  client_id: string;
  title: string;
  cover_path: string | null;
  position: number;
  created_at: string;
}

export type ApprovalRow = {
  id: string;
  content_id: string;
  client_id: string;
  status: ApprovalStatus;
  comment: string | null;
  created_by: string | null;
  created_at: string;
}

export type ApprovalHistoryRow = {
  id: string;
  content_id: string;
  user_id: string | null;
  actor_name: string | null;
  action: string;
  comment: string | null;
  created_at: string;
}

export type FeedItemRow = {
  id: string;
  client_id: string;
  content_id: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export type ClientCredentialRow = {
  client_id: string;
  auth_email: string;
  auth_password: string;
  created_at: string;
}

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  /** Colunas com default ou nulaveis sao opcionais no insert. */
  Insert: Pick<Row, Required> & Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type ChatThreadRow = {
  id: string;
  client_id: string;
  created_at: string;
}

export type ChatMessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  link_target_type: ChatLinkTarget | null;
  link_target_id: string | null;
  link_label: string | null;
  created_at: string;
}

export type ChatReadRow = {
  thread_id: string;
  user_id: string;
  last_read_at: string;
}

export type BulletinPostRow = {
  id: string;
  title: string;
  body: string;
  published: boolean;
  scheduled_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BulletinVoteRow = {
  post_id: string;
  user_id: string;
  vote: 1 | -1;
  created_at: string;
}

/** Retorno do RPC `bulletin_feed` — um post com contagem agregada e o voto de quem pediu. */
export type BulletinFeedRow = {
  id: string;
  title: string;
  body: string;
  scheduled_date: string | null;
  created_at: string;
  likes: number;
  dislikes: number;
  my_vote: 1 | -1 | null;
}

/** Retorno do RPC `bulletin_admin_report` — so admin. */
/** Retorno do RPC `chat_thread_messages` — mensagem com o nome do remetente ja resolvido. */
export type ChatThreadMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  is_staff: boolean;
  body: string;
  link_target_type: ChatLinkTarget | null;
  link_target_id: string | null;
  link_label: string | null;
  created_at: string;
}

/** Retorno do RPC `chat_inbox` — um item por cliente que a equipe gerencia. */
export type ChatInboxEntry = {
  client_id: string;
  company_name: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export type BulletinAdminReportRow = {
  post_id: string;
  title: string;
  published: boolean;
  scheduled_date: string | null;
  created_at: string;
  likes: number;
  dislikes: number;
  voters: { name: string; role: string; vote: 1 | -1 }[];
}

export type StaffChatMessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export type StaffChatThreadRow = {
  id: string;
  professional_id: string;
  created_at: string;
}

export type StaffChatReadRow = {
  thread_id: string;
  user_id: string;
  last_read_at: string;
}

/** Retorno do RPC `staff_chat_thread_messages`. */
export type StaffChatThreadMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  is_admin: boolean;
  body: string;
  created_at: string;
}

/** Retorno do RPC `staff_chat_inbox` — so admin, um item por profissional. */
export type StaffChatInboxEntry = {
  professional_id: string;
  professional_name: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export type InvoiceRow = {
  id: string;
  client_id: string;
  created_by: string | null;
  title: string;
  method: InvoiceMethod;
  amount: number;
  currency: CurrencyCode;
  due_date: string;
  boleto_file_path: string | null;
  payment_link: string | null;
  pix_key: string | null;
  status: InvoiceStatus;
  paid_at: string | null;
  paid_by: string | null;
  last_reminder_sent_on: string | null;
  /** Conta conectada que recebe esta cobranca. So preenchido em method 'stripe'. */
  stripe_account_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  /** "paid" | "processing" | "failed" — estado na Stripe, mais granular que `status`. */
  stripe_payment_status: string | null;
  /** Pagina de pagamento hospedada. Reaberta enquanto nao expira (boleto/Pix). */
  stripe_hosted_url: string | null;
  stripe_hosted_url_expires_at: string | null;
  application_fee_cents: number | null;
  amount_paid_cents: number | null;
  created_at: string;
  updated_at: string;
}

export type ProfessionalPaymentAccountRow = {
  user_id: string;
  stripe_account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements_disabled_reason: string | null;
  /** Nome da capacidade -> "active" | "pending" | "inactive". */
  capabilities: Record<string, string>;
  platform_fee_percent: number;
  onboarding_started_at: string | null;
  account_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Dedupe de webhook: a PK e o proprio id do evento na Stripe. */
export type StripeEventRow = {
  id: string;
  type: string;
  account_id: string | null;
  received_at: string;
  processed_at: string | null;
  error: string | null;
}

export type ClientServiceRow = {
  id: string;
  client_id: string;
  created_by: string | null;
  title: string;
  amount: number;
  currency: CurrencyCode;
  position: number;
  created_at: string;
  updated_at: string;
}

export type ClientActivityRow = {
  id: string;
  client_id: string;
  actor_name: string;
  action: string;
  created_at: string;
}

export type TaskRow = {
  id: string;
  professional_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  due_date: string | null;
  /** Etiqueta curta e livre pro card do quadro (ex.: "Urgente", "Financeiro"). */
  tag: string | null;
  created_at: string;
  updated_at: string;
}

/** Um item da lista `links` (jsonb) de `ideas`. */
export type IdeaLink = {
  label: string;
  url: string;
}

export type IdeaRow = {
  id: string;
  professional_id: string;
  /** Ideia solta (null) ou ligada a um cliente especifico. */
  client_id: string | null;
  title: string;
  notes: string | null;
  links: IdeaLink[];
  created_at: string;
  updated_at: string;
}

export type IdeaImageRow = {
  id: string;
  idea_id: string;
  file_path: string;
  created_at: string;
}

export type ClientMetricRow = {
  id: string;
  client_id: string;
  created_by: string | null;
  metric_name: string;
  metric_value: number;
  /** Mes de referencia (dia sempre 1). */
  period_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type InstagramReportStatus = "pending" | "running" | "done" | "failed";

/** Relatorio 1: scrape de um @ qualquer, sem login. So a serviceRole escreve. */
export type InstagramPublicReportRow = {
  id: string;
  client_id: string;
  username: string;
  status: InstagramReportStatus;
  apify_run_id: string | null;
  apify_dataset_id: string | null;
  /** Dados de perfil (seguidores, bio, etc.), brutos como a Apify devolve. */
  summary: Record<string, unknown> | null;
  /** `latestPosts[]` da Apify, brutos. */
  posts: unknown[] | null;
  requested_by: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

/**
 * Sem policy de RLS de proposito -- guarda so a referencia da conexao na
 * Composio, nunca um token de acesso. Dona e a conta Instagram do CLIENTE
 * (nao do profissional), conectada via OAuth.
 */
/** Um cliente pode ter mais de uma conta -- `is_principal` marca a que entra no relatorio automatico mensal. */
export type ClientInstagramConnectionRow = {
  id: string;
  client_id: string;
  composio_connection_id: string;
  /** Apelido digitado pelo usuario ao conectar (ex.: "Loja principal") -- a Composio nao garante devolver o username. */
  label: string | null;
  instagram_username: string | null;
  is_principal: boolean;
  connected_at: string;
}

/** Relatorio 2: insights autenticados (3/6/9 meses) via Composio. So a serviceRole escreve. */
export type InstagramInsightsReportRow = {
  id: string;
  client_id: string;
  /** Qual conta gerou este relatorio -- nulo se a conexao foi removida depois. */
  connection_id: string | null;
  period_months: 3 | 6 | 9;
  status: InstagramReportStatus;
  /** reach, accounts_engaged, total_interactions, etc. — janela do periodo inteiro. */
  account_metrics: Record<string, unknown> | null;
  /** Metricas por post dentro do periodo. */
  posts: unknown[] | null;
  /** Stories ATIVOS no momento da geracao -- a Meta nunca devolve historico de stories. */
  stories: unknown[] | null;
  /** Retrato atual do publico (idade/genero/cidade/pais) -- "agora", nao do periodo do relatorio. */
  audience: Record<string, unknown> | null;
  requested_by: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

/** Preferencia de relatorio automatico mensal, uma linha por cliente. Mesmo padrao de ClientBrandingRow. */
export type ClientInstagramReportSettingsRow = {
  client_id: string;
  auto_report_enabled: boolean;
  auto_report_period_months: 3 | 6 | 9;
  /** Dia do mes (1-28) em que o cron deve gerar o relatorio deste cliente. */
  auto_report_day: number;
  /** 'YYYY-MM' -- trava de idempotencia do cron. */
  last_auto_report_month: string | null;
  updated_at: string;
}

export type InstagramScheduledReportStatus = "pending" | "done" | "failed";

/** Agendamento avulso "gerar este relatorio nesta data", separado do automatico mensal recorrente. */
export type InstagramScheduledReportRow = {
  id: string;
  client_id: string;
  connection_id: string;
  period_months: 3 | 6 | 9;
  /** So data -- sem hora, o cron roda 1x/dia num horario que a Vercel escolhe. */
  scheduled_date: string;
  status: InstagramScheduledReportStatus;
  requested_by: string | null;
  error: string | null;
  created_at: string;
  processed_at: string | null;
}

export type Database = {
  public: {
    Tables: {
      users: Table<UserRow, 'id' | 'name' | 'email' | 'role'>;
      clients: Table<ClientRow, 'name' | 'company_name' | 'access_code'>;
      client_credentials: Table<
        ClientCredentialRow,
        'client_id' | 'auth_email' | 'auth_password'
      >;
      contracts: Table<ContractRow, 'client_id' | 'title'>;
      contents: Table<ContentRow, 'client_id' | 'title' | 'type'>;
      content_files: Table<ContentFileRow, 'content_id' | 'position' | 'file_type'>;
      push_subscriptions: Table<
        PushSubscriptionRow,
        'user_id' | 'endpoint' | 'p256dh' | 'auth_key'
      >;
      platform_snapshots: Table<
        PlatformSnapshotRow,
        'database_bytes' | 'storage_bytes' | 'users_count' | 'clients_count' | 'contents_count'
      >;
      client_profiles: Table<ClientProfileRow, 'client_id'>;
      client_branding: Table<ClientBrandingRow, 'client_id'>;
      professional_google_accounts: Table<ProfessionalGoogleAccountRow, 'user_id' | 'google_email' | 'refresh_token'>;
      professional_calendly_accounts: Table<
        ProfessionalCalendlyAccountRow,
        'user_id' | 'calendly_uri' | 'calendly_email' | 'scheduling_url' | 'access_token' | 'refresh_token'
      >;
      calendly_webhook_events: Table<CalendlyWebhookEventRow, 'id' | 'event_type'>;
      meeting_requests: Table<
        MeetingRequestRow,
        'client_id' | 'professional_id' | 'requested_by' | 'contact_email' | 'created_by'
      >;
      profile_highlights: Table<ProfileHighlightRow, 'client_id' | 'title' | 'position'>;
      approvals: Table<ApprovalRow, 'content_id' | 'client_id' | 'status'>;
      approval_history: Table<ApprovalHistoryRow, 'content_id' | 'action'>;
      feed_items: Table<FeedItemRow, 'client_id' | 'content_id' | 'position'>;
      chat_threads: Table<ChatThreadRow, 'client_id'>;
      chat_messages: Table<ChatMessageRow, 'thread_id' | 'sender_id'>;
      chat_reads: Table<ChatReadRow, 'thread_id' | 'user_id'>;
      bulletin_posts: Table<BulletinPostRow, 'title' | 'body'>;
      bulletin_votes: Table<BulletinVoteRow, 'post_id' | 'user_id' | 'vote'>;
      invoices: Table<InvoiceRow, 'client_id' | 'title' | 'method' | 'amount' | 'due_date'>;
      client_services: Table<ClientServiceRow, 'client_id' | 'title' | 'amount'>;
      client_activities: Table<ClientActivityRow, 'client_id' | 'actor_name' | 'action'>;
      staff_chat_threads: Table<StaffChatThreadRow, 'professional_id'>;
      staff_chat_messages: Table<StaffChatMessageRow, 'thread_id' | 'sender_id' | 'body'>;
      staff_chat_reads: Table<StaffChatReadRow, 'thread_id' | 'user_id'>;
      tasks: Table<TaskRow, 'professional_id' | 'title'>;
      ideas: Table<IdeaRow, 'professional_id' | 'title'>;
      idea_images: Table<IdeaImageRow, 'idea_id' | 'file_path'>;
      client_metrics: Table<
        ClientMetricRow,
        'client_id' | 'metric_name' | 'metric_value' | 'period_date'
      >;
      instagram_public_reports: Table<InstagramPublicReportRow, 'client_id' | 'username'>;
      client_instagram_connections: Table<
        ClientInstagramConnectionRow,
        'client_id' | 'composio_connection_id'
      >;
      instagram_insights_reports: Table<
        InstagramInsightsReportRow,
        'client_id' | 'period_months'
      >;
      client_instagram_report_settings: Table<ClientInstagramReportSettingsRow, 'client_id'>;
      instagram_scheduled_reports: Table<
        InstagramScheduledReportRow,
        'client_id' | 'connection_id' | 'period_months' | 'scheduled_date'
      >;
      professional_payment_accounts: Table<ProfessionalPaymentAccountRow, 'user_id'>;
      stripe_events: Table<StripeEventRow, 'id' | 'type'>;
    };
    Views: { [_ in never]: never };
    Functions: {
      generate_access_code: {
        Args: { p_seed?: string | null };
        Returns: string;
      };
      submit_signed_contract: {
        Args: { p_contract_id: string; p_file_path: string };
        Returns: ContractRow;
      };
      submit_approval: {
        Args: { p_content_id: string; p_status: ApprovalStatus; p_comment?: string | null };
        Returns: ContentRow;
      };
      add_feed_item: {
        Args: { p_client_id: string; p_content_id: string };
        Returns: FeedItemRow;
      };
      reorder_feed: {
        Args: { p_client_id: string; p_content_ids: string[] };
        Returns: FeedItemRow[];
      };
      mark_tour_seen: {
        Args: Record<string, never>;
        Returns: void;
      };
      mark_notifications_prompted: {
        Args: Record<string, never>;
        Returns: void;
      };
      set_preferred_locale: {
        Args: { p_locale: string };
        Returns: void;
      };
      set_client_avatar: {
        Args: { p_avatar_path: string | null };
        Returns: void;
      };
      platform_stats: {
        Args: Record<string, never>;
        Returns: PlatformStats;
      };
      orphan_storage_objects: {
        Args: Record<string, never>;
        Returns: { bucket_id: string; name: string; size: number }[];
      };
      send_chat_message: {
        Args: {
          p_client_id: string;
          p_body: string;
          p_link_target_type?: ChatLinkTarget | null;
          p_link_target_id?: string | null;
          p_link_label?: string | null;
        };
        Returns: ChatMessageRow;
      };
      unread_chat_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      chat_thread_messages: {
        Args: { p_client_id: string };
        Returns: ChatThreadMessage[];
      };
      mark_chat_read: {
        Args: { p_client_id: string };
        Returns: void;
      };
      chat_inbox: {
        Args: Record<string, never>;
        Returns: ChatInboxEntry[];
      };
      bulletin_feed: {
        Args: Record<string, never>;
        Returns: BulletinFeedRow[];
      };
      vote_on_bulletin_post: {
        Args: { p_post_id: string; p_vote: number };
        Returns: void;
      };
      bulletin_admin_report: {
        Args: Record<string, never>;
        Returns: BulletinAdminReportRow[];
      };
      send_staff_chat_message: {
        Args: { p_professional_id: string; p_body: string };
        Returns: StaffChatMessageRow;
      };
      staff_chat_thread_messages: {
        Args: { p_professional_id: string };
        Returns: StaffChatThreadMessage[];
      };
      mark_staff_chat_read: {
        Args: { p_professional_id: string };
        Returns: void;
      };
      staff_chat_inbox: {
        Args: Record<string, never>;
        Returns: StaffChatInboxEntry[];
      };
      unread_staff_chat_count: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: {
      chat_link_target: ChatLinkTarget;
      invoice_method: InvoiceMethod;
      invoice_status: InvoiceStatus;
      currency_code: CurrencyCode;
      document_kind: DocumentKind;
      user_role: UserRole;
      user_status: UserStatus;
      client_status: ClientStatus;
      contract_status: ContractStatus;
      content_type: ContentType;
      content_status: ContentStatus;
      approval_status: ApprovalStatus;
      task_status: TaskStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
}

/** Retorno do RPC `platform_stats` — painel de saude da plataforma. */
export type PlatformStats = {
  database_bytes: number;
  storage_bytes: number;
  postgres_version: string;
  tables: { name: string; bytes: number; rows: number }[];
  buckets: { name: string; files: number; bytes: number }[];
  counts: {
    users: number;
    clients: number;
    contents: number;
    content_files: number;
    documents: number;
    approvals: number;
    history: number;
    feed_items: number;
    highlights: number;
  };
  snapshots: {
    captured_at: string;
    database_bytes: number;
    storage_bytes: number;
    users_count: number;
    clients_count: number;
    contents_count: number;
  }[];
}
