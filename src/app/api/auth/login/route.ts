import { NextResponse } from "next/server";
import { z } from "zod";

import { adminEmail } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { HOME_BY_ROLE } from "@/lib/auth";
import type { UserRole } from "@/types/database";

const schema = z.object({
  identifier: z.string().trim().min(1, "Informe o usuario ou email"),
  password: z.string().min(1, "Informe a senha"),
});

const GENERIC_ERROR = "Usuario ou senha invalidos.";

export async function POST(request: Request) {
  const limit = rateLimit(`login:${clientIp(request)}`, 10, 5 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Muitas tentativas. Tente novamente em ${limit.retryAfterSeconds}s.` },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const { identifier, password } = parsed.data;

  // O admin entra com o usuario "Admin"; o email real vem do ambiente.
  const email = identifier.includes("@")
    ? identifier.toLowerCase()
    : identifier.toLowerCase() === "admin"
      ? adminEmail()
      : null;

  if (!email) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  let role = (data.user.app_metadata?.role ?? null) as UserRole | null;

  // Autocorrecao: usuario criado fora do app pode nao ter role no app_metadata.
  if (!role) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("role, status")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile) {
      role = profile.role;
      await admin.auth.admin.updateUserById(data.user.id, {
        app_metadata: { role: profile.role },
      });
    }
  }

  if (!role || role === "client") {
    await supabase.auth.signOut();
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile?.status === "inactive") {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "Acesso desativado. Fale com o administrador." }, { status: 403 });
  }

  return NextResponse.json({ redirect: HOME_BY_ROLE[role] });
}
