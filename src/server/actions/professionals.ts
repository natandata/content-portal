"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, ok, type ActionResult } from "@/server/result";
import type { UserRow } from "@/types/database";

const createSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome"),
  email: z.email("Email invalido"),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres"),
});

const updateSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2, "Informe o nome"),
  status: z.enum(["active", "inactive"]),
  password: z.union([z.string().min(8, "A senha precisa ter ao menos 8 caracteres"), z.literal("")]).optional(),
});

export async function createProfessionalAction(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<UserRow>> {
  await requireAdmin();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const { name, email, password } = parsed.data;
  const admin = createAdminClient();
  const supabase = await createClient();

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true,
    app_metadata: { role: "professional" },
    user_metadata: { name },
  });

  if (authError || !created.user) {
    return fail(describeError(authError, "Nao foi possivel criar o profissional."));
  }

  const { data: profile, error: insertError } = await supabase
    .from("users")
    .insert({
      id: created.user.id,
      name,
      email: email.toLowerCase(),
      role: "professional",
    })
    .select("*")
    .single();

  if (insertError || !profile) {
    await admin.auth.admin.deleteUser(created.user.id);
    return fail(describeError(insertError, "Nao foi possivel salvar o profissional."));
  }

  revalidatePath("/admin/professionals");
  return ok(profile);
}

/** Admin aprova uma solicitacao de acesso: o usuario passa a poder entrar. */
export async function approveAccessRequestAction(
  userId: string,
): Promise<ActionResult<null>> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("users")
    .update({ status: "active" })
    .eq("id", userId)
    .eq("status", "pending");

  if (error) {
    return fail(describeError(error, "Nao foi possivel aprovar o acesso."));
  }

  revalidatePath("/admin/professionals");
  revalidatePath("/admin/dashboard");
  return done();
}

/**
 * Admin recusa uma solicitacao. Remove o perfil e o usuario de autenticacao —
 * deixar a conta orfa ocuparia o email e nao serviria para nada.
 */
export async function rejectAccessRequestAction(
  userId: string,
): Promise<ActionResult<null>> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("users")
    .select("id, status")
    .eq("id", userId)
    .maybeSingle();

  if (!target) return fail("Solicitacao nao encontrada.");
  if (target.status !== "pending") {
    return fail("Esta solicitacao ja foi resolvida.");
  }

  const { error } = await supabase.from("users").delete().eq("id", userId);
  if (error) {
    return fail(describeError(error, "Nao foi possivel recusar a solicitacao."));
  }

  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(userId);

  revalidatePath("/admin/professionals");
  revalidatePath("/admin/dashboard");
  return done();
}

export async function updateProfessionalAction(
  input: z.input<typeof updateSchema>,
): Promise<ActionResult<null>> {
  await requireAdmin();

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const { id, name, status, password } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("users").update({ name, status }).eq("id", id);
  if (error) {
    return fail(describeError(error, "Nao foi possivel atualizar o profissional."));
  }

  if (password) {
    const admin = createAdminClient();
    const { error: passwordError } = await admin.auth.admin.updateUserById(id, { password });
    if (passwordError) {
      return fail(describeError(passwordError, "Nao foi possivel alterar a senha."));
    }
  }

  revalidatePath("/admin/professionals");
  return done();
}
