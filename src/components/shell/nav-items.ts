import {
  Activity,
  CheckCircle2,
  FileText,
  Grid3x3,
  Images,
  LayoutDashboard,
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
  badge?: "approvals" | "contracts";
}

export function staffNavItems(role: UserRole): NavItem[] {
  const base = role === "admin" ? "/admin" : "/professional";

  const items: NavItem[] = [
    { href: `${base}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
    { href: `${base}/clients`, label: "Clientes", icon: Users },
    { href: `${base}/content`, label: "Conteudos", icon: Images },
    { href: `${base}/approvals`, label: "Aprovacoes", icon: CheckCircle2, badge: "approvals" },
    { href: `${base}/documents`, label: "Documentos", icon: FileText, badge: "contracts" },
    { href: `${base}/feed`, label: "Feed", icon: Grid3x3 },
  ];

  if (role === "admin") {
    items.push({ href: "/admin/professionals", label: "Profissionais", icon: UserCog });
    // Consumo de banco e Storage e assunto de quem responde pela conta.
    items.push({ href: "/admin/platform", label: "Plataforma", icon: Activity });
  }

  items.push({ href: `${base}/settings`, label: "Configuracoes", icon: Settings });

  return items;
}

export const clientNavItems: NavItem[] = [
  { href: "/client/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/client/content", label: "Conteudos", icon: Images, badge: "approvals" },
  { href: "/client/feed", label: "Feed", icon: Grid3x3 },
  { href: "/client/documents", label: "Documentos", icon: FileText, badge: "contracts" },
];
