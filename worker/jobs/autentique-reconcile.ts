import { reconcileAutentiqueDocuments } from "../../src/server/autentique/reconcile";

async function main() {
  const result = await reconcileAutentiqueDocuments();
  console.log(`[autentique-reconcile] processed=${result.processed} completed=${result.completed}`);
}

// Sem process.exit(0) no sucesso de proposito -- forcar saida imediata
// junto com handles assincronos do fetch/undici ainda fechando causou um
// crash de libuv especifico do Windows em teste local (src/win/async.c);
// deixar o processo terminar sozinho quando a fila de eventos esvazia e'
// mais seguro em qualquer SO. So o erro precisa de saida explicita.
main().catch((err) => {
  console.error("[autentique-reconcile] failed:", err);
  process.exit(1);
});
