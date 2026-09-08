-- Assinatura via Autentique -- terceira opcao por documento, ao lado do
-- upload manual e do link do Gov.br (nenhum dos dois muda). Ver
-- src/server/actions/autentique-documents.ts e src/lib/autentique/client.ts.

alter type contract_status add value if not exists 'sent_for_signature';
