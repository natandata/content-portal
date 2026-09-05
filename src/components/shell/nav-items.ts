import {
  Activity,
  Banknote,
  Calendar,
  FileText,
  Lightbulb,
  Grid3x3,
  Images,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Settings,
  UserCog,
  Users,
  BarChart3,
  CheckSquare,
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

export interface NavGroup {
  label?: string;
  items: NavItem[];
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

function professionalNavItems(): NavGroup[] {
  const base = "/professional";

  return [
    {
      label: "VISÃO GERAL",
      items: [
        { href: `${base}/dashboard`, label: "Visão Geral", icon: LayoutDashboard },
        { href: `${base}/tasks`, label: "Tarefas", icon: CheckSquare },
      ],
    },
    {
      label: "PLANEJAMENTO",
      items: [
        { href: `${base}/calendar`, label: "Calendário", icon: Calendar },
        { href: `${base}/ideas`, label: "Banco de Ideias", icon: Lightbulb },
      ],
    },
    {
      label: "GESTÃO",
      items: [
        { href: `${base}/clients`, label: "Clientes", icon: Users },
        { href: `${base}/payments`, label: "Cobranças", icon: Banknote, badge: "invoices" },
        { href: `${base}/documents`, label: "Documentos", icon: FileText, badge: "contracts" },
        { href: `${base}/reports`, label: "Relatórios", icon: BarChart3 },
      ],
    },
    {
      label: "CONFIGURAÇÕES",
      items: [
        { href: `${base}/settings`, label: "Configurações", icon: Settings },
      ],
    },
  ];
}

export function staffNavItems(role: UserRole): NavItem[] | NavGroup[] {
  return role === "admin" ? adminNavItems() : professionalNavItems();
}

export const clientNavItems: NavItem[] = [
  { href: "/client/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/client/content", label: "Conteudos", icon: Images, badge: "approvals" },
  { href: "/client/feed", label: "Feed", icon: Grid3x3 },
  {
    href: "/client/calendar",
    label: "Calendario",
    icon: Calendar,
    hideOnMobileNav: true,
  },
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
