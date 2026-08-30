#!/usr/bin/env node
/**
 * Teste de integracao ponta a ponta contra o Supabase real.
 *
 *   npm run e2e
 *
 * Cria dados proprios, exercita os tres papeis com sessoes de verdade
 * (portanto sob RLS e policies de Storage) e apaga tudo no final.
 * Nao depende do servidor Next: usa exatamente as mesmas chamadas que as
 * server actions fazem.
 */

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("\n  Faltam variaveis de ambiente. Rode via `npm run e2e`.\n");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const session = () =>
  createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${label}`);
  } else {
    failed += 1;
    console.log(`  FALHA ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Espera que a operacao seja recusada pelo banco. */
async function denied(label, promise) {
  const { error } = await promise;
  check(label, Boolean(error), error ? "" : "a operacao foi aceita");
}

function jpeg(seed) {
  // JPEG minimo valido (1x1). Basta para exercitar upload e policies.
  const base64 =
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
    "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA" +
    "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
  return { buffer: Buffer.from(base64, "base64"), name: `slide-${seed}.jpg` };
}

async function main() {
  const stamp = Date.now();
  const professionalEmail = `e2e-prof-${stamp}@teste.local`;
  const professionalPassword = `e2e-${randomUUID()}`;
  const created = { authUsers: [], clients: [] };

  console.log("\n  Content Portal — teste ponta a ponta\n");

  try {
    // ---------------------------------------------------------------------
    console.log("  [1] Cadastro de profissional e clientes");
    // ---------------------------------------------------------------------
    const { data: profAuth, error: profError } = await admin.auth.admin.createUser({
      email: professionalEmail,
      password: professionalPassword,
      email_confirm: true,
      app_metadata: { role: "professional" },
    });
    check("profissional criado no Auth", !profError && Boolean(profAuth?.user));
    created.authUsers.push(profAuth.user.id);

    await admin.from("users").insert({
      id: profAuth.user.id,
      name: "Profissional E2E",
      email: professionalEmail,
      role: "professional",
    });

    const prof = session();
    const { error: profSignIn } = await prof.auth.signInWithPassword({
      email: professionalEmail,
      password: professionalPassword,
    });
    check("profissional autentica com email e senha", !profSignIn);

    // Dois clientes, para provar isolamento cruzado.
    const clients = [];
    for (const company of ["Alfa Marcas E2E", "Beta Filmes E2E"]) {
      const { data: code } = await prof.rpc("generate_access_code", { p_seed: company });
      check(`codigo ${code} no formato AAA0000`, /^[A-Z]{3}\d{4}$/.test(code ?? ""));

      const authEmail = `${code.toLowerCase()}-${stamp}@clients.contentportal.app`;
      const authPassword = `${randomUUID()}${randomUUID()}`.replace(/-/g, "");
      const { data: clientAuth } = await admin.auth.admin.createUser({
        email: authEmail,
        password: authPassword,
        email_confirm: true,
        app_metadata: { role: "client" },
      });
      created.authUsers.push(clientAuth.user.id);

      const { data: row, error: rowError } = await prof
        .from("clients")
        .insert({
          name: `Contato ${company}`,
          company_name: company,
          access_code: code,
          professional_id: profAuth.user.id,
          auth_user_id: clientAuth.user.id,
        })
        .select("*")
        .single();
      check(`cliente ${company} criado pelo profissional`, !rowError && Boolean(row));
      created.clients.push(row.id);

      await admin
        .from("client_credentials")
        .insert({ client_id: row.id, auth_email: authEmail, auth_password: authPassword });

      clients.push({ ...row, authEmail, authPassword });
    }

    const [alfa, beta] = clients;

    // ---------------------------------------------------------------------
    console.log("\n  [2] Login do cliente por codigo de acesso");
    // ---------------------------------------------------------------------
    const { data: lookup } = await admin
      .from("clients")
      .select("id, status")
      .eq("access_code", alfa.access_code)
      .maybeSingle();
    check("codigo resolve para o cliente certo", lookup?.id === alfa.id);

    const { data: creds } = await admin
      .from("client_credentials")
      .select("auth_email, auth_password")
      .eq("client_id", alfa.id)
      .maybeSingle();

    const clientA = session();
    const { error: clientSignIn } = await clientA.auth.signInWithPassword({
      email: creds.auth_email,
      password: creds.auth_password,
    });
    check("codigo e trocado por sessao Supabase", !clientSignIn);

    const clientB = session();
    await clientB.auth.signInWithPassword({
      email: beta.authEmail,
      password: beta.authPassword,
    });

    // ---------------------------------------------------------------------
    console.log("\n  [3] Conteudos: imagem, video e carrossel de 10 slides");
    // ---------------------------------------------------------------------
    async function createContent({ title, type, files }) {
      const { data: content, error } = await prof
        .from("contents")
        .insert({
          client_id: alfa.id,
          professional_id: profAuth.user.id,
          title,
          type,
          status: "draft",
          caption: `Legenda de ${title}`,
        })
        .select("*")
        .single();

      if (error) throw new Error(`falha ao criar ${title}: ${error.message}`);

      const rows = [];
      for (const [index, file] of files.entries()) {
        const position = index + 1;
        const path = `${alfa.id}/${content.id}/${String(position).padStart(2, "0")}.jpg`;
        const { error: upErr } = await prof.storage
          .from("content")
          .upload(path, file.buffer, { contentType: "image/jpeg" });
        if (upErr) throw new Error(`falha no upload de ${title}: ${upErr.message}`);

        const thumbPath = `${alfa.id}/${content.id}/${String(position).padStart(2, "0")}.jpg`;
        await prof.storage
          .from("thumbnails")
          .upload(thumbPath, file.buffer, { contentType: "image/jpeg" });

        rows.push({
          content_id: content.id,
          file_path: path,
          thumbnail_path: thumbPath,
          position,
          file_type: "image/jpeg",
        });
      }

      const { error: filesError } = await prof.from("content_files").insert(rows);
      if (filesError) throw new Error(`falha nos arquivos de ${title}: ${filesError.message}`);

      await prof.from("contents").update({ status: "awaiting_approval" }).eq("id", content.id);
      await prof.from("approval_history").insert({
        content_id: content.id,
        user_id: profAuth.user.id,
        actor_name: "Profissional E2E",
        action: "Conteudo enviado para aprovacao",
      });

      return content;
    }

    const post = await createContent({ title: "Post E2E", type: "image", files: [jpeg(1)] });
    check("imagem enviada com 1 arquivo", Boolean(post));

    const reels = await createContent({ title: "Reels E2E", type: "video", files: [jpeg(1)] });
    check("video enviado com 1 arquivo", Boolean(reels));

    const carousel = await createContent({
      title: "Carrossel E2E",
      type: "carousel",
      files: Array.from({ length: 10 }, (_, i) => jpeg(i + 1)),
    });
    const { count: slideCount } = await prof
      .from("content_files")
      .select("id", { count: "exact", head: true })
      .eq("content_id", carousel.id);
    check("carrossel aceita exatamente 10 slides", slideCount === 10);

    await denied(
      "carrossel recusa o 11o slide",
      prof.from("content_files").insert({
        content_id: carousel.id,
        file_path: "x/11.jpg",
        position: 11,
        file_type: "image/jpeg",
      }),
    );

    // ---------------------------------------------------------------------
    // Arquivo por link externo (Drive, WeTransfer, OneDrive...)
    // ---------------------------------------------------------------------
    const linked = await prof
      .from("contents")
      .insert({
        client_id: alfa.id,
        professional_id: profAuth.user.id,
        title: "Video por link E2E",
        type: "video",
        status: "draft",
      })
      .select("*")
      .single();

    const { error: linkError } = await prof.from("content_files").insert({
      content_id: linked.data.id,
      file_path: null,
      external_url: "https://drive.google.com/file/d/e2e-teste/view",
      position: 1,
      file_type: "link",
    });
    check("aceita arquivo como link externo", !linkError, linkError?.message ?? "");

    await denied(
      "recusa link com esquema perigoso",
      prof.from("content_files").insert({
        content_id: linked.data.id,
        external_url: "javascript:alert(1)",
        position: 2,
        file_type: "link",
      }),
    );

    await denied(
      "recusa arquivo sem origem (nem caminho nem link)",
      prof.from("content_files").insert({
        content_id: linked.data.id,
        position: 3,
        file_type: "link",
      }),
    );

    await denied(
      "recusa caminho e link ao mesmo tempo",
      prof.from("content_files").insert({
        content_id: linked.data.id,
        file_path: "x/1.jpg",
        external_url: "https://exemplo.com/a.mp4",
        position: 4,
        file_type: "image/jpeg",
      }),
    );

    await prof.from("contents").update({ status: "awaiting_approval" }).eq("id", linked.data.id);

    const draft = await prof
      .from("contents")
      .insert({
        client_id: alfa.id,
        professional_id: profAuth.user.id,
        title: "Rascunho E2E",
        type: "image",
        status: "draft",
      })
      .select("*")
      .single();

    // ---------------------------------------------------------------------
    console.log("\n  [4] Isolamento entre clientes e entre papeis");
    // ---------------------------------------------------------------------
    const { data: alfaSees } = await clientA.from("contents").select("id, title, status");
    check(
      "cliente A ve os 4 conteudos enviados",
      alfaSees?.length === 4,
      `viu ${alfaSees?.length}`,
    );
    check(
      "cliente A ve o conteudo por link externo",
      alfaSees?.some((c) => c.title === "Video por link E2E"),
    );
    check(
      "cliente A nao ve o rascunho",
      !alfaSees?.some((c) => c.title === "Rascunho E2E"),
    );

    const { data: betaSees } = await clientB.from("contents").select("id");
    check("cliente B nao ve nada do cliente A", (betaSees?.length ?? 0) === 0);

    const { data: betaClients } = await clientB.from("clients").select("id, company_name");
    check(
      "cliente B so enxerga o proprio cadastro",
      betaClients?.length === 1 && betaClients[0].id === beta.id,
    );

    const { data: credsLeak } = await clientA.from("client_credentials").select("auth_email");
    check("cliente nao le client_credentials", (credsLeak?.length ?? 0) === 0);

    const { data: usersLeak } = await clientA.from("users").select("id");
    check("cliente nao le a tabela de usuarios", (usersLeak?.length ?? 0) === 0);

    // Storage
    const filePath = `${alfa.id}/${post.id}/01.jpg`;
    const { data: ownFile } = await clientA.storage.from("content").createSignedUrl(filePath, 60);
    check("cliente A gera URL assinada do proprio arquivo", Boolean(ownFile?.signedUrl));

    const { data: crossFile } = await clientB.storage
      .from("content")
      .createSignedUrl(filePath, 60);
    check("cliente B nao acessa o arquivo do cliente A", !crossFile?.signedUrl);

    const draftFile = `${alfa.id}/${draft.data.id}/01.jpg`;
    await prof.storage.from("content").upload(draftFile, jpeg(1).buffer, {
      contentType: "image/jpeg",
    });
    const { data: draftAccess } = await clientA.storage
      .from("content")
      .createSignedUrl(draftFile, 60);
    check("cliente nao acessa arquivo de rascunho", !draftAccess?.signedUrl);

    // ---------------------------------------------------------------------
    console.log("\n  [5] Aprovacao, reprovacao e solicitacao de alteracao");
    // ---------------------------------------------------------------------
    await clientA.rpc("submit_approval", { p_content_id: post.id, p_status: "approved" });
    await clientA.rpc("submit_approval", {
      p_content_id: carousel.id,
      p_status: "revision_requested",
      p_comment: "Trocar a foto do slide 2.",
    });
    await clientA.rpc("submit_approval", {
      p_content_id: reels.id,
      p_status: "rejected",
      p_comment: "O corte inicial ficou confuso.",
    });

    const { data: statuses } = await prof
      .from("contents")
      .select("title, status")
      .in("id", [post.id, carousel.id, reels.id]);
    const byTitle = Object.fromEntries((statuses ?? []).map((c) => [c.title, c.status]));
    check("aprovar muda o status para approved", byTitle["Post E2E"] === "approved");
    check(
      "solicitar alteracao muda para revision_requested",
      byTitle["Carrossel E2E"] === "revision_requested",
    );
    check("reprovar muda para rejected", byTitle["Reels E2E"] === "rejected");

    await denied(
      "reprovar sem comentario e recusado",
      clientA.rpc("submit_approval", { p_content_id: post.id, p_status: "rejected" }),
    );
    await denied(
      "cliente B nao responde conteudo do cliente A",
      clientB.rpc("submit_approval", { p_content_id: post.id, p_status: "approved" }),
    );

    const { data: history } = await prof
      .from("approval_history")
      .select("action, comment")
      .eq("content_id", carousel.id)
      .order("created_at");
    check("historico registra envio e retorno do cliente", (history?.length ?? 0) >= 2);
    check(
      "comentario do cliente fica salvo",
      history?.some((h) => h.comment?.includes("slide 2")),
    );

    const { data: approvals } = await prof.from("approvals").select("status");
    check("tres registros em approvals", approvals?.length === 3);

    // ---------------------------------------------------------------------
    console.log("\n  [6] Contrato");
    // ---------------------------------------------------------------------
    const { data: contract } = await prof
      .from("contracts")
      .insert({ client_id: alfa.id, title: "Contrato E2E", created_by: profAuth.user.id })
      .select("*")
      .single();

    const contractPath = `${alfa.id}/${contract.id}/contrato.pdf`;
    await prof.storage
      .from("contracts")
      .upload(contractPath, Buffer.from("%PDF-1.4\n% contrato de teste\n"), {
        contentType: "application/pdf",
      });
    await prof
      .from("contracts")
      .update({ original_file_path: contractPath, uploaded_at: new Date().toISOString() })
      .eq("id", contract.id);

    const { data: download } = await clientA.storage
      .from("contracts")
      .createSignedUrl(contractPath, 60);
    check("cliente baixa o contrato original", Boolean(download?.signedUrl));

    const signedPath = `${alfa.id}/${contract.id}/assinado.pdf`;
    const { error: signedUpload } = await clientA.storage
      .from("signed-contracts")
      .upload(signedPath, Buffer.from("%PDF-1.4\n% contrato assinado\n"), {
        contentType: "application/pdf",
      });
    check("cliente envia o contrato assinado", !signedUpload);

    await clientA.rpc("submit_signed_contract", {
      p_contract_id: contract.id,
      p_file_path: signedPath,
    });
    const { data: afterSign } = await prof
      .from("contracts")
      .select("status, signed_file_path")
      .eq("id", contract.id)
      .single();
    check("contrato passa a aguardar conferencia", afterSign.status === "under_review");
    check("caminho do assinado fica gravado", afterSign.signed_file_path === signedPath);

    await denied(
      "cliente B nao envia assinatura em contrato alheio",
      clientB.rpc("submit_signed_contract", {
        p_contract_id: contract.id,
        p_file_path: "x.pdf",
      }),
    );

    await prof.from("contracts").update({ status: "approved" }).eq("id", contract.id);
    const { data: reviewed } = await prof
      .from("contracts")
      .select("status")
      .eq("id", contract.id)
      .single();
    check("profissional confirma o recebimento", reviewed.status === "approved");

    // Documento que nao e contrato: entrega, sem devolucao assinada.
    const { data: brandbook } = await prof
      .from("contracts")
      .insert({
        client_id: alfa.id,
        title: "Brandbook E2E",
        kind: "brandbook",
        requires_signature: false,
        status: "delivered",
        created_by: profAuth.user.id,
      })
      .select("*")
      .single();
    check("documento sem assinatura e criado como entregue",
      brandbook?.kind === "brandbook" && brandbook?.status === "delivered");

    const { data: clientDocs } = await clientA
      .from("contracts")
      .select("id, kind")
      .eq("kind", "brandbook");
    check("cliente ve o documento entregue", clientDocs?.length === 1);

    await denied(
      "documento sem assinatura recusa devolucao assinada",
      clientA.rpc("submit_signed_contract", {
        p_contract_id: brandbook.id,
        p_file_path: `${alfa.id}/${brandbook.id}/assinado.pdf`,
      }),
    );

    // Assinatura via Gov.br: so pode ser habilitada junto com devolucao assinada.
    const { data: signable } = await prof
      .from("contracts")
      .insert({
        client_id: alfa.id,
        title: "Contrato Gov.br E2E",
        kind: "contract",
        requires_signature: true,
        allow_gov_br_signature: true,
        created_by: profAuth.user.id,
      })
      .select("*")
      .single();
    check("documento aceita habilitar assinatura via Gov.br",
      signable?.allow_gov_br_signature === true);

    const { data: clientSignable } = await clientA
      .from("contracts")
      .select("allow_gov_br_signature")
      .eq("id", signable.id)
      .single();
    check("cliente ve a assinatura via Gov.br habilitada",
      clientSignable?.allow_gov_br_signature === true);

    await denied(
      "recusa Gov.br habilitado sem pedir devolucao assinada",
      prof.from("contracts").insert({
        client_id: alfa.id,
        title: "Contrato invalido E2E",
        kind: "contract",
        requires_signature: false,
        allow_gov_br_signature: true,
        created_by: profAuth.user.id,
      }),
    );

    await denied(
      "profissional nao le a saude da plataforma",
      prof.rpc("platform_stats"),
    );
    await denied(
      "cliente nao le a saude da plataforma",
      clientA.rpc("platform_stats"),
    );
    await denied(
      "cliente nao lista arquivos orfaos",
      clientA.rpc("orphan_storage_objects"),
    );

    // ---------------------------------------------------------------------
    console.log("\n  [7] Feed");
    // ---------------------------------------------------------------------
    for (const id of [post.id, carousel.id, reels.id]) {
      await prof.rpc("add_feed_item", { p_client_id: alfa.id, p_content_id: id });
    }
    const { data: feed } = await prof
      .from("feed_items")
      .select("content_id, position")
      .eq("client_id", alfa.id)
      .order("position");
    check("tres itens no feed nas posicoes 1, 2 e 3",
      feed?.map((f) => f.position).join(",") === "1,2,3");

    await prof.rpc("reorder_feed", {
      p_client_id: alfa.id,
      p_content_ids: [reels.id, post.id, carousel.id],
    });
    const { data: reordered } = await prof
      .from("feed_items")
      .select("content_id, position")
      .eq("client_id", alfa.id)
      .order("position");
    check(
      "drag and drop persiste a nova ordem",
      reordered?.[0]?.content_id === reels.id && reordered?.[2]?.content_id === carousel.id,
    );

    const { data: clientFeed } = await clientA
      .from("feed_items")
      .select("position")
      .order("position");
    check("cliente visualiza o feed", clientFeed?.length === 3);

    await denied(
      "cliente nao reordena o feed",
      clientA.rpc("reorder_feed", {
        p_client_id: alfa.id,
        p_content_ids: [post.id, reels.id, carousel.id],
      }),
    );
    await denied(
      "cliente nao remove item do feed",
      clientA.from("feed_items").delete().eq("client_id", alfa.id).select("id").single(),
    );
    await denied(
      "profissional nao mexe no feed de cliente alheio",
      prof.rpc("add_feed_item", { p_client_id: beta.id, p_content_id: post.id }),
    );

    // ---------------------------------------------------------------------
    console.log("\n  [8] Perfil do Instagram");
    // ---------------------------------------------------------------------
    const { error: profileError } = await prof.from("client_profiles").upsert({
      client_id: alfa.id,
      display_name: "Alfa Marcas",
      username: "alfa.marcas",
      bio: "Estrategia e conteudo.",
      followers_count: 12400,
      following_count: 312,
      show_reels_tab: true,
    });
    check("profissional salva o perfil", !profileError, profileError?.message ?? "");

    await denied(
      "recusa @ com caractere invalido",
      prof.from("client_profiles").upsert({
        client_id: alfa.id,
        username: "alfa marcas!",
      }),
    );

    const { error: highlightsError } = await prof.from("profile_highlights").insert(
      Array.from({ length: 10 }, (_, i) => ({
        client_id: alfa.id,
        title: `Destaque ${i + 1}`,
        position: i + 1,
      })),
    );
    check("perfil aceita 10 destaques", !highlightsError, highlightsError?.message ?? "");

    await denied(
      "perfil recusa o 11o destaque",
      prof.from("profile_highlights").insert({
        client_id: alfa.id,
        title: "Excedente",
        position: 10,
      }),
    );

    const { data: seenProfile } = await clientA
      .from("client_profiles")
      .select("username, followers_count")
      .maybeSingle();
    check(
      "cliente le o proprio perfil",
      seenProfile?.username === "alfa.marcas" && seenProfile?.followers_count === 12400,
    );

    const { data: seenHighlights } = await clientA.from("profile_highlights").select("id");
    check("cliente le os destaques", seenHighlights?.length === 10);

    await denied(
      "cliente nao edita o proprio perfil",
      clientA
        .from("client_profiles")
        .update({ followers_count: 999999 })
        .eq("client_id", alfa.id)
        .select("client_id")
        .single(),
    );

    await denied(
      "cliente nao cria destaque",
      clientA.from("profile_highlights").insert({
        client_id: alfa.id,
        title: "Invasao",
        position: 1,
      }),
    );

    const { data: crossProfile } = await clientB.from("client_profiles").select("client_id");
    check("cliente B nao ve o perfil do cliente A", (crossProfile ?? []).length === 0);

    // ---------------------------------------------------------------------
    console.log("\n  [9] Notificacoes");
    // ---------------------------------------------------------------------
    const { error: subError } = await clientA.from("push_subscriptions").insert({
      user_id: alfa.auth_user_id,
      endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${stamp}`,
      p256dh: "chave-p256dh-fake",
      auth_key: "chave-auth-fake",
    });
    check("cliente cria a propria inscricao de push", !subError, subError?.message ?? "");

    await denied(
      "cliente nao cria inscricao para outra pessoa",
      clientA.from("push_subscriptions").insert({
        user_id: profAuth.user.id,
        endpoint: `https://fcm.googleapis.com/fcm/send/e2e-alheio-${stamp}`,
        p256dh: "x",
        auth_key: "x",
      }),
    );

    const { data: seenByOwner } = await clientA.from("push_subscriptions").select("id");
    check("cliente ve a propria inscricao", seenByOwner?.length === 1);

    const { data: seenByOther } = await clientB.from("push_subscriptions").select("id");
    check("cliente B nao ve a inscricao do cliente A", (seenByOther ?? []).length === 0);

    const { error: crossDelete, count: crossDeleteCount } = await clientB
      .from("push_subscriptions")
      .delete({ count: "exact" })
      .eq("user_id", alfa.auth_user_id);
    check(
      "cliente B nao apaga a inscricao do cliente A",
      !crossDelete && crossDeleteCount === 0,
    );

    const { error: promptError } = await clientA.rpc("mark_notifications_prompted");
    check("cliente marca o convite de notificacoes como respondido", !promptError);

    const { data: afterPrompt } = await admin
      .from("clients")
      .select("notifications_prompted_at")
      .eq("id", alfa.id)
      .single();
    check("marca fica gravada no cliente certo", Boolean(afterPrompt?.notifications_prompted_at));

    const { error: tourError } = await prof.rpc("mark_tour_seen");
    check("profissional marca o tour como visto", !tourError);

    const { data: profAfterTour } = await admin
      .from("users")
      .select("tour_seen_at")
      .eq("id", profAuth.user.id)
      .single();
    check("marca do tour fica gravada no profissional certo", Boolean(profAfterTour?.tour_seen_at));

    // ---------------------------------------------------------------------
    console.log("\n  [10] Limpeza");
    // ---------------------------------------------------------------------
  } finally {
    for (const id of created.clients) {
      const { data: objects } = await admin.storage.from("content").list(id, { limit: 100 });
      if (objects?.length) {
        // Objetos ficam em {client}/{content}/arquivo — remove recursivamente.
        for (const folder of objects) {
          const { data: inner } = await admin.storage
            .from("content")
            .list(`${id}/${folder.name}`, { limit: 100 });
          if (inner?.length) {
            await admin.storage
              .from("content")
              .remove(inner.map((f) => `${id}/${folder.name}/${f.name}`));
          }
        }
      }
      for (const bucket of ["thumbnails", "contracts", "signed-contracts"]) {
        const { data: folders } = await admin.storage.from(bucket).list(id, { limit: 100 });
        for (const folder of folders ?? []) {
          const { data: inner } = await admin.storage
            .from(bucket)
            .list(`${id}/${folder.name}`, { limit: 100 });
          if (inner?.length) {
            await admin.storage
              .from(bucket)
              .remove(inner.map((f) => `${id}/${folder.name}/${f.name}`));
          }
        }
      }
      await admin.from("clients").delete().eq("id", id);
    }
    for (const id of created.authUsers) await admin.auth.admin.deleteUser(id);
    await admin.from("users").delete().eq("email", professionalEmail);

    console.log(`\n  ${passed} verificacoes ok, ${failed} falha(s).\n`);
    process.exit(failed === 0 ? 0 : 1);
  }
}

main().catch((error) => {
  console.error(`\n  Erro inesperado: ${error.message}\n`);
  failed += 1;
  process.exit(1);
});
