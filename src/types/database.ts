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

export type ContractStatus =
  | "awaiting_signature"
  | "signed"
  | "under_review"
  | "approved"
  | "replaced";

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

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  requested_at: string | null;
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
  caption: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ContentFileRow = {
  id: string;
  content_id: string;
  file_path: string;
  thumbnail_path: string | null;
  position: number;
  file_type: string;
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
      content_files: Table<
        ContentFileRow,
        'content_id' | 'file_path' | 'position' | 'file_type'
      >;
      approvals: Table<ApprovalRow, 'content_id' | 'client_id' | 'status'>;
      approval_history: Table<ApprovalHistoryRow, 'content_id' | 'action'>;
      feed_items: Table<FeedItemRow, 'client_id' | 'content_id' | 'position'>;
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
    };
    Enums: {
      user_role: UserRole;
      user_status: UserStatus;
      client_status: ClientStatus;
      contract_status: ContractStatus;
      content_type: ContentType;
      content_status: ContentStatus;
      approval_status: ApprovalStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
