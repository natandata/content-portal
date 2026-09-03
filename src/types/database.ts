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

export type InvoiceMethod = "boleto" | "link" | "pix";
export type InvoiceStatus = "open" | "paid";
export type CurrencyCode = "BRL" | "USD" | "EUR" | "GBP";

export type ContractStatus =
  | "awaiting_signature"
  | "signed"
  | "under_review"
  | "approved"
  | "replaced"
  /** Documento que nao pede assinatura: foi entregue e pronto. */
  | "delivered";

export type DocumentKind = "contract" | "strategy" | "brandbook" | "mockup" | "other";

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
  tour_seen_at: string | null;
  notifications_prompted_at: string | null;
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
  created_at: string;
  updated_at: string;
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
