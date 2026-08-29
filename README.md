# Content Portal

Portal privado de **contratos → conteúdos → aprovação → feed** entre um gestor de
conteúdo e seus clientes.

> **Local do projeto:** `C:\dev\content-portal`. O projeto **não** deve viver
> dentro do Google Drive — veja "Por que fora do Drive" no fim deste arquivo.

- **Stack:** Next.js 15 (App Router) · TypeScript strict · React 19 · Tailwind CSS 4 · Supabase (Postgres + Auth + Storage) · deploy na Vercel.
- **Três acessos:** Admin, Profissional (e-mail/senha) e Cliente (código `ABC1234`).
- **Segurança:** Row Level Security em todas as tabelas, buckets privados com policies por `client_id`, service role apenas no servidor.

---

## 1. Instalação

```bash
npm install
```

## 2. Configuração do Supabase

1. Crie um projeto em <https://supabase.com/dashboard>.
2. Em **Settings → API Keys**, aba **Publishable and secret API keys**, copie:
   - `Project URL` (em **Settings → General**) → `NEXT_PUBLIC_SUPABASE_URL`
   - a chave `sb_publishable_…` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - a chave `sb_secret_…` → `SUPABASE_SERVICE_ROLE_KEY` (nunca no cliente)

   Ignore a aba **Legacy anon, service_role API keys**. As chaves legadas
   (`eyJ…`) derivam do JWT secret do projeto e **não podem ser rotacionadas**
   individualmente; as novas podem ser criadas e revogadas uma a uma. Os nomes
   das variáveis foram mantidos para não quebrar deploys existentes — o que
   mudou é o valor.
3. Em **Authentication → Providers → Email**, mantenha e-mail/senha habilitado e
   **desative "Confirm email"** (os usuários são criados já confirmados pela API
   administrativa).
4. Recomendado: em **Authentication → Policies**, ative *Leaked password
   protection* (checagem contra o HaveIBeenPwned). É a única recomendação de
   segurança que os advisors do Supabase ainda apontam neste projeto, e depende
   de um ajuste no painel — não de migration.

## 3. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
ADMIN_EMAIL=admin@contentportal.local
ADMIN_INITIAL_PASSWORD=escolha-uma-senha-forte
```

`ADMIN_INITIAL_PASSWORD` é lida apenas pelo `npm run seed`, nunca em runtime —
não precisa existir na Vercel. Escolha uma senha forte: com a aplicação publicada,
qualquer pessoa pode tentar entrar como `Admin`.

`.env.local` está no `.gitignore` e nunca deve ser versionado. Na Vercel, cadastre
as três primeiras em **Settings → Environment Variables** (a senha do seed não é usada em runtime).

## 4. Migrations

As migrations estão em `supabase/migrations/`, na ordem:

| Arquivo | O que faz |
| --- | --- |
| `20260829000100_init.sql` | Tipos, tabelas, índices, triggers, limites (10 slides / 30 posições) e geração do código de acesso |
| `20260829000200_rls.sql` | Helpers de autorização, RLS de todas as tabelas e RPCs transacionais |
| `20260829000300_storage.sql` | Buckets privados e policies de Storage |
| `20260829000400_hardening.sql` | `search_path` fixo em todas as funções e `EXECUTE` revogado do papel `anon` |
| `20260829000500_hide_drafts_from_client.sql` | Rascunho invisível para o cliente também no banco e no Storage |

**Opção A — Supabase CLI (recomendado):**

```bash
npx supabase link --project-ref SEU_REF
```

```bash
npx supabase db push
```

**Opção B — SQL Editor:** cole o conteúdo dos cinco arquivos, na ordem, e execute.

As cinco já estão aplicadas no projeto `oocewkuseaiguxfcvlwz`.

## 5. Seed do administrador

```bash
npm run seed
```

Cria (ou atualiza) o usuário `ADMIN_EMAIL` com a senha `ADMIN_INITIAL_PASSWORD` e o
perfil correspondente em `public.users`. É idempotente.

Depois disso, o login do admin é:

```
Usuário: Admin
Senha:   (valor de ADMIN_INITIAL_PASSWORD)
```

A senha inicial **não** está no código: o formulário envia o usuário `Admin` e o
servidor resolve o e-mail a partir de `ADMIN_EMAIL`. Troque a senha em
**Configurações → Alterar senha** logo no primeiro acesso.

## 6. Execução local

```bash
npm run dev
```

Abra <http://localhost:3000>. Outros comandos:

```bash
npm run build
```

```bash
npm run start
```

```bash
npm run typecheck
```

```bash
npm run lint
```

## 7. Teste de integração

```bash
npm run e2e
```

`scripts/e2e.mjs` roda 41 verificações contra o Supabase real: cria um
profissional e dois clientes, exercita login por código, upload de imagem, vídeo
e carrossel de 10 slides, aprovação/reprovação/solicitação de alteração,
contrato assinado, feed com reordenação — e, principalmente, tenta violar cada
fronteira (cliente lendo dados de outro cliente, profissional mexendo em cliente
alheio, arquivo de rascunho, reprovação sem comentário) para confirmar que o RLS
recusa. Cria dados próprios e apaga tudo no final.

Ele fala com o banco de produção do projeto configurado no `.env.local` — rode
contra um projeto de desenvolvimento se não quiser tráfego no principal.

## 8. Deploy na Vercel

1. Suba o repositório para o GitHub/GitLab.
2. Importe o projeto na Vercel (o preset Next.js é detectado automaticamente).
3. Cadastre `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` e `ADMIN_EMAIL`. A senha do seed não entra aqui.
4. Deploy. Não há dependência de ambiente local nem de arquivos fora do repo.

---

## Como a autenticação funciona

Os três perfis usam **sessões reais do Supabase Auth** — é o que faz o RLS valer
tanto no navegador quanto no servidor.

| Perfil | Credencial digitada | O que o servidor faz |
| --- | --- | --- |
| Admin | `Admin` + senha | Resolve o e-mail via `ADMIN_EMAIL` e faz `signInWithPassword` |
| Profissional | e-mail + senha | `signInWithPassword` direto |
| Cliente | código `ABC1234` | Valida o código, busca o segredo em `client_credentials` (tabela sem policies, acessível só pela service role) e troca por uma sessão do usuário de autenticação daquele cliente |

Cada cliente tem um usuário de autenticação dedicado (`abc1234@clients.contentportal.app`)
com senha aleatória de 64 caracteres, criada no cadastro e nunca exibida. O código
de acesso é a única credencial que circula.

`src/middleware.ts` renova a sessão e bloqueia acesso cruzado entre áreas lendo a
role de `app_metadata` do JWT. A proteção real, porém, está no banco.

## Modelo de dados

```
users ──< clients ──< contracts
                 ├──< contents ──< content_files
                 │            ├──< approvals
                 │            └──< approval_history
                 └──< feed_items
```

Regras garantidas pelo banco, não só pela interface:

- `clients.access_code` — `CHECK (access_code ~ '^[A-Z]{3}[0-9]{4}$')` + `UNIQUE`.
- `content_files` — trigger `AFTER INSERT` limita a 10 arquivos em carrossel e 1 em imagem/vídeo.
- `feed_items` — `position` entre 1 e 30, único por cliente (constraint `DEFERRABLE` para permitir reordenação em uma transação) e no máximo 30 itens.
- Comentário obrigatório em reprovação e solicitação de alteração (`submit_approval`).

### RPCs

| Função | Quem chama | Por que existe |
| --- | --- | --- |
| `generate_access_code(seed)` | equipe | Gera `ABC1234` único, tentando as 3 primeiras letras da empresa |
| `submit_signed_contract(contract, path)` | cliente | Grava o PDF assinado sem dar UPDATE amplo na tabela |
| `submit_approval(content, status, comment)` | cliente | Approval + status + histórico em uma transação |
| `add_feed_item(client, content)` | equipe | Encontra a primeira posição livre de 1 a 30 |
| `reorder_feed(client, content_ids[])` | equipe | Reescreve todas as posições em uma transação |

## Storage

Quatro buckets **privados**. O primeiro segmento do caminho é sempre o `client_id`,
e é sobre ele que as policies decidem o acesso:

```
contracts/{client_id}/{contract_id}/arquivo.pdf
signed-contracts/{client_id}/{contract_id}/arquivo.pdf
content/{client_id}/{content_id}/01-<timestamp>.jpg
thumbnails/{client_id}/{content_id}/01-<timestamp>.jpg
```

Nada é público: a leitura acontece por URLs assinadas geradas no servidor, com
validade de 1 hora. Uploads vão direto do navegador para o Storage (sujeitos às
mesmas policies), o que evita passar arquivos grandes pelo servidor Next.

As miniaturas são geradas no navegador — `canvas` para imagens e o primeiro frame
do `<video>` para vídeos —, então não há dependência de ffmpeg no servidor.

## PWA

A aplicação é instalável no celular: no Android, "Adicionar à tela inicial" no
Chrome; no iPhone, Compartilhar → "Adicionar à Tela de Início" no Safari. Aberta
assim, roda em tela cheia, sem barra do navegador — o que importa para a área do
cliente, que é onde o uso mobile acontece.

| Peça | Arquivo |
| --- | --- |
| Manifest | `src/app/manifest.ts` |
| Ícones (192, 512, apple-touch) | `public/icons/`, gerados por `scripts/generate-icons.mjs` |
| Service worker | `public/sw.js` |
| Registro | `src/components/pwa/service-worker.tsx` (só em produção) |
| Tela offline | `src/app/offline/page.tsx` |

O service worker é **deliberadamente conservador**. Esta é uma aplicação
autenticada: HTML de página e resposta de API nunca entram em cache, porque
servir a página de um cliente para outro seria pior do que não ter offline. Ele
guarda apenas assets imutáveis (`/_next/static`, `/icons`) e a tela de offline,
usada como fallback quando a navegação falha por falta de rede.

Para regenerar os ícones depois de mudar a identidade visual:

```bash
node scripts/generate-icons.mjs
```

## Estrutura

```
src/
  app/                 rotas (admin, professional, client, api/auth, login)
  components/          UI reutilizável (ui, content, contracts, clients, feed, shell)
  features/            páginas compostas, compartilhadas entre admin e profissional
  lib/                 supabase, auth, storage, upload, domínio, utilidades
  server/              server actions e queries
  types/               tipagem do schema
supabase/migrations/   SQL versionado
scripts/seed.mjs       seed do admin
```

`/admin/*` e `/professional/*` compartilham os mesmos componentes de `features/`;
as rotas são apenas invólucros finos. O admin enxerga todos os clientes, o
profissional apenas os que estão sob sua responsabilidade — a diferença é imposta
pelo RLS, não pelo layout.

## Decisões que fogem literalmente do PRD

- **`original_file_path` / `signed_file_path`** em vez de `..._url`: os buckets são
  privados, então a coluna guarda o caminho do objeto e a URL assinada é gerada sob
  demanda. Guardar uma URL assinada no banco criaria um link que expira.
- **`client_credentials`** é uma tabela extra, não prevista no PRD, necessária para
  trocar o código de acesso por uma sessão Supabase real. Sem policies: só a service
  role lê.
- **`approval_history.actor_name`** guarda o nome de quem agiu no momento da ação,
  para o histórico continuar legível se o usuário for removido.
- **Limite de tentativas de login** é feito em memória (`src/lib/rate-limit.ts`).
  Em serverless o estado vive por instância — serve contra força bruta trivial, não
  como limite global. Para algo definitivo, troque por uma tabela no Postgres.

## Ferramentas de desenvolvimento

`.mcp.json` registra o **Magic MCP** do [21st.dev](https://21st.dev), usado para
gerar componentes de UI durante o desenvolvimento. Ele lê a chave da variável de
ambiente `TWENTYFIRST_API_KEY` — o arquivo versionado nunca contém o segredo.

A chave fica em `.env.local` (ignorado pelo Git). Para o MCP enxergá-la, ela
precisa estar no ambiente do shell antes de abrir o Claude Code:

```bash
export TWENTYFIRST_API_KEY=sua_chave
```

No PowerShell:

```bash
$env:TWENTYFIRST_API_KEY = 'sua_chave'
```

Como alternativa, registre o servidor no escopo de usuário (fora do repositório):

```bash
claude mcp add --scope user magic --env API_KEY=sua_chave -- npx -y @21st-dev/magic@latest
```

Nada disso afeta o build nem o runtime da aplicação.

## Por que fora do Google Drive

O projeto nasceu em `G:\Meu Drive\apps\social` e foi movido para `C:\dev\content-portal`.
O sistema de arquivos virtual do Google Drive não aguenta a escrita concorrente do
npm: `npm install` falha com `EBADF: bad file descriptor, write` e
`TAR_ENTRY_ERROR`, e o Drive também recusa junctions
(`mklink /J` → "volumes NTFS locais são necessários"), então não dá para apontar
`node_modules` para fora.

Além da instalação, `node_modules` e `.next` somam dezenas de milhares de
arquivos que o Drive tentaria sincronizar a cada build. Para backup e histórico,
use Git — não a sincronização de arquivos.

## Fora do escopo (por decisão do PRD)

Cobrança, NF, CRM, WhatsApp, assinatura digital, analytics, calendário editorial,
IA, publicação automática no Instagram, métricas, chat em tempo real e app nativo.
