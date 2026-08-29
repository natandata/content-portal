"use server";

import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { describeError, done, fail, firstIssue, type ActionResult } from "@/server/result";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual"),
    newPassword: z.string().min(8, "A nova senha precisa ter ao menos 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "A confirmacao nao confere com a nova senha.",
    path: ["confirmPassword"],
  });

/** Troca de senha do admin/profissional (inclusive a senha inicial do admin). */
export async function changePasswordAction(
  input: z.input<typeof schema>,
): Promise<ActionResult<null>> {
  const actor = await requireStaff();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail(firstIssue(parsed.error.issues, "Dados invalidos."));
  }

  const email = actor.authUser.email;
  if (!email) return fail("Conta sem email associado.");

  const supabase = await createClient();

  // Reautentica antes de trocar: evita troca de senha por sessao sequestrada.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.currentPassword,
  });

  if (signInError) {
    return fail("A senha atual esta incorreta.");
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) {
    return fail(describeError(error, "Nao foi possivel alterar a senha."));
  }

  return done();
}
