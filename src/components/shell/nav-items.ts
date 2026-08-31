import {
  Activity,
  Banknote,
  CheckCircle2,
  FileText,
  Grid3x3,
  Images,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/types/database";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Qual contador do menu aparece neste item, quando houver pendencia. */
  badge?: "approvals" | "contracts" | "chat" | "invoices";
  /**
   * So usado na area do cliente: item existe no menu de topo (desktop), mas
   * fica de fora da barra inferior do celular — ela ja esta no limite de
   * itens que cabem sem cortar em 360-375px.
   */
  hideOnMobileNav?: boolean;
}

/**
 * O admin nao opera clientes/conteudos diretamente — isso e trabalho do
 * profissional responsavel. O admin acompanha (Dashboard), fala com a
 * equipe (Chat), publica novidades (Mural) e, quando precisa entrar no
 * dia a dia de um cliente especifico, faz isso de dentro de Profissionais.
 */
function adminNavItems(): NavItem[] {
  return [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/chat", label: "Chat", icon: MessageCircle, badge: "chat" },
    { href: "/admin/updates", label: "Mural", icon: Megaphone },
    { href: "/admin/professionals", label: "Profissionais", icon: UserCog },
    // Consumo de banco e Storage e assunto de quem responde pela conta.
    { href: "/admin/platform", label: "Plataforma", icon: Activity },
    { href: "/admin/settings", label: "Configuracoes", icon: Settings },
  ];
}

function professionalNavItems(): NavItem[] {
  const base = "/professional";

  return [
    { href: `${base}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
    { href: `${base}/clients`, label: "Clientes", icon: Users },
    { href: `${base}/content`, label: "Conteudos", icon: Images },
    { href: `${base}/approvals`, label: "Aprovacoes", icon: CheckCircle2, badge: "approvals" },
    { href: `${base}/documents`, label: "Documentos", icon: FileText, badge: "contracts" },
    { href: `${base}/payments`, label: "Cobrancas", icon: Banknote, badge: "invoices" },
    { href: `${base}/feed`, label: "Feed", icon: Grid3x3 },
    { href: `${base}/chat`, label: "Chat", icon: MessageCircle, badge: "chat" },
    { href: `${base}/updates`, label: "Mural", icon: Megaphone },
    { href: `${base}/settings`, label: "Configuracoes", icon: Settings },
  ];
}

export function staffNavItems(role: UserRole): NavItem[] {
  return role === "admin" ? adminNavItems() : professionalNavItems();
}

export const clientNavItems: NavItem[] = [
  { href: "/client/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/client/content", label: "Conteudos", icon: Images, badge: "approvals" },
  { href: "/client/feed", label: "Feed", icon: Grid3x3 },
  { href: "/client/documents", label: "Documentos", icon: FileText, badge: "contracts" },
  { href: "/client/chat", label: "Chat", icon: MessageCircle, badge: "chat" },
  {
    href: "/client/payments",
    label: "Cobrancas",
    icon: Banknote,
    badge: "invoices",
    hideOnMobileNav: true,
  },
];
