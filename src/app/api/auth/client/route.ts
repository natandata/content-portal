import { NextResponse } from "next/server";
import { z } from "zod";

import { ACCESS_CODE_PATTERN } from "@/lib/domain";
import { pickLocale } from "@/lib/i18n/locale";
import { getLocale } from "@/lib/i18n/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const schema = z.object({
  code: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase().replace(/\s+/g, "")),
});

export async function POST(request: Request) {
  // Rota de API, nao Server Action -- o cookie de idioma tem que ser lido
  // aqui na mao. E exatamente a tela que o cliente internacional ve primeiro.
  const locale = await getLocale();
  const genericError = pickLocale(locale, "Codigo de acesso invalido.", "Invalid access code.");

  const limit = rateLimit(`client-login:${clientIp(request)}`, 10, 5 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: pickLocale(
          locale,
          `Muitas tentativas. Tente novamente em ${limit.retryAfterSeconds}s.`,
          `Too many attempts. Try again in ${limit.retryAfterSeconds}s.`,
        ),
      },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !ACCESS_CODE_PATTERN.test(parsed.data.code)) {
    return NextResponse.json({ error: genericError }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: client } = await admin
    .from("clients")
    .select("id, status")
    .eq("access_code", parsed.data.code)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: genericError }, { status: 401 });
  }

  if (client.status !== "active") {
    return NextResponse.json(
      {
        error: pickLocale(
          locale,
          "Este acesso esta desativado. Fale com o seu gestor de conteudo.",
          "This access has been deactivated. Contact your content manager.",
        ),
      },
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
      {
        error: pickLocale(
          locale,
          "Acesso ainda nao configurado. Fale com o seu gestor de conteudo.",
          "Access not set up yet. Contact your content manager.",
        ),
      },
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
    return NextResponse.json({ error: genericError }, { status: 401 });
  }

  return NextResponse.json({ redirect: "/client/dashboard" });
}
