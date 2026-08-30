import { NextResponse } from "next/server";
import { z } from "zod";

import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sendPushToAdmins } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome"),
  email: z.email("Email invalido"),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres"),
  note: z.string().trim().max(500).optional(),
});

/**
 * Resposta unica, dada tanto para um cadastro novo quanto para um email que ja
 * existe. Sem isso a rota vira um oraculo de "esse email tem conta aqui?".
 */
const NEUTRAL = {
  message:
    "Solicitacao registrada. Voce podera entrar assim que o administrador aprovar o acesso.",
};

export async function POST(request: Request) {
  const limit = rateLimit(`signup:${clientIp(request)}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Muitas tentativas. Tente novamente em ${limit.retryAfterSeconds}s.` },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados invalidos." },
      { status: 400 },
    );
  }

  const { name, email, password, note } = parsed.data;
  const admin = createAdminClient();
  const normalizedEmail = email.toLowerCase();

  // O usuario de autenticacao e criado agora, mas nasce travado: o login exige
  // status 'active' e os helpers de RLS tambem. A senha fica com o Supabase
  // Auth — nunca passa por tabela da aplicacao.
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    app_metadata: { role: "professional" },
    user_metadata: { name, note: note || null },
  });

  if (authError || !created.user) {
    // Email ja cadastrado cai aqui. Responder igual evita enumeracao.
    return NextResponse.json(NEUTRAL, { status: 202 });
  }

  const { error: profileError } = await admin.from("users").insert({
    id: created.user.id,
    name,
    email: normalizedEmail,
    role: "professional",
    status: "pending",
    requested_at: new Date().toISOString(),
  });

  if (profileError) {
    // Sem o perfil o usuario de autenticacao nao serve para nada.
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { error: "Nao foi possivel registrar a solicitacao. Tente novamente." },
      { status: 500 },
    );
  }

  await sendPushToAdmins({
    title: "Nova solicitacao de acesso",
    body: `${name} pediu acesso como profissional.`,
    url: "/admin/professionals",
    tag: "access-request",
  }).catch(() => {});

  return NextResponse.json(NEUTRAL, { status: 201 });
}
