import { NextResponse } from "next/server";
import { z } from "zod";

import { ACCESS_CODE_PATTERN } from "@/lib/domain";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const schema = z.object({
  code: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase().replace(/\s+/g, "")),
});

const GENERIC_ERROR = "Codigo de acesso invalido.";

export async function POST(request: Request) {
  const limit = rateLimit(`client-login:${clientIp(request)}`, 10, 5 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Muitas tentativas. Tente novamente em ${limit.retryAfterSeconds}s.` },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !ACCESS_CODE_PATTERN.test(parsed.data.code)) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select("id, status")
    .eq("access_code", parsed.data.code)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  if (client.status !== "active") {
    return NextResponse.json(
      { error: "Este acesso esta desativado. Fale com o seu gestor de conteudo." },
      { status: 403 },
    );
  }

  const { data: credentials } = await admin
    .from("client_credentials")
    .select("auth_email, auth_password")
    .eq("client_id", client.id)
    .maybeSingle();

  if (!credentials) {
    return NextResponse.json(
      { error: "Acesso ainda nao configurado. Fale com o seu gestor de conteudo." },
      { status: 409 },
    );
  }

  // O codigo e a credencial: o servidor o troca por uma sessao Supabase real,
  // de modo que todo acesso posterior passa pelo RLS.
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.auth_email,
    password: credentials.auth_password,
  });

  if (error || !data.user) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  return NextResponse.json({ redirect: "/client/dashboard" });
}
