#!/usr/bin/env node
/**
 * Cria (ou atualiza) o usuario administrador inicial.
 *
 * Uso:
 *   npm run seed
 *
 * Le NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL e
 * ADMIN_INITIAL_PASSWORD do .env.local (via `node --env-file`).
 * O script e idempotente: rodar de novo nao duplica nada.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.ADMIN_EMAIL ?? "admin@contentportal.local").toLowerCase();
const password = process.env.ADMIN_INITIAL_PASSWORD;

function fatal(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

if (!url) fatal("NEXT_PUBLIC_SUPABASE_URL nao definido.");
if (!serviceRoleKey) fatal("SUPABASE_SERVICE_ROLE_KEY nao definido.");
if (!password) fatal("ADMIN_INITIAL_PASSWORD nao definido.");

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findAuthUserByEmail(target) {
  let page = 1;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fatal(`Falha ao listar usuarios: ${error.message}`);

    const found = data.users.find((user) => user.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 200) return null;

    page += 1;
  }

  return null;
}

async function main() {
  console.log(`\n  Content Portal — seed do administrador`);
  console.log(`  Projeto: ${url}`);
  console.log(`  Email:   ${email}\n`);

  const existing = await findAuthUserByEmail(email);
  let userId = existing?.id ?? null;

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: { ...existing.app_metadata, role: "admin" },
    });
    if (error) fatal(`Falha ao atualizar o admin: ${error.message}`);
    console.log("  Usuario de autenticacao ja existia — senha e role atualizadas.");
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "admin" },
      user_metadata: { name: "Admin" },
    });
    if (error || !data.user) fatal(`Falha ao criar o admin: ${error?.message}`);
    userId = data.user.id;
    console.log("  Usuario de autenticacao criado.");
  }

  const { error: profileError } = await supabase.from("users").upsert(
    {
      id: userId,
      name: "Admin",
      email,
      role: "admin",
      status: "active",
    },
    { onConflict: "id" },
  );

  if (profileError) fatal(`Falha ao gravar o perfil: ${profileError.message}`);

  console.log("  Perfil em public.users pronto.\n");
  console.log("  Entre em /login com:");
  console.log("    Usuario: Admin");
  console.log("    Senha:   (valor de ADMIN_INITIAL_PASSWORD)\n");
  console.log("  Troque a senha em Configuracoes apos o primeiro acesso.\n");
}

main().catch((error) => fatal(error instanceof Error ? error.message : String(error)));
