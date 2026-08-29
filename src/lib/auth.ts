import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { ClientRow, UserRole, UserRow } from "@/types/database";

export interface Actor {
  authUser: User;
  role: UserRole;
  profile: UserRow | null;
  client: ClientRow | null;
  displayName: string;
}

export const HOME_BY_ROLE: Record<UserRole, string> = {
  admin: "/admin/dashboard",
  professional: "/professional/dashboard",
  client: "/client/dashboard",
};

/** Prefixo das rotas de workspace conforme a role (admin ou profissional). */
export function basePath(role: UserRole): string {
  return role === "admin" ? "/admin" : "/professional";
}

export async function getActor(): Promise<Actor | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const role = (user.app_metadata?.role ?? null) as UserRole | null;
  if (!role) return null;

  if (role === "client") {
    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!client) return null;

    return {
      authUser: user,
      role,
      profile: null,
      client,
      displayName: client.name,
    };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // Defesa em profundidade: o login ja barra quem nao esta ativo, mas uma
  // sessao emitida antes de uma desativacao nao pode continuar valendo.
  if (profile && profile.status !== "active") return null;

  return {
    authUser: user,
    role,
    profile,
    client: null,
    displayName: profile?.name ?? user.email ?? "Usuario",
  };
}

/** Exige um usuario de equipe (admin ou profissional). */
export async function requireStaff(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role === "client") redirect(HOME_BY_ROLE.client);
  return actor;
}

export async function requireAdmin(): Promise<Actor> {
  const actor = await requireStaff();
  if (actor.role !== "admin") redirect(HOME_BY_ROLE.professional);
  return actor;
}

/** Exige um cliente autenticado por codigo de acesso. */
export async function requireClientActor(): Promise<Actor & { client: ClientRow }> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "client" || !actor.client) redirect(HOME_BY_ROLE[actor.role]);
  return actor as Actor & { client: ClientRow };
}
