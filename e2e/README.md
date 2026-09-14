# e2e/ — testes de ponta a ponta no celular

Testes Playwright que abrem o app **de verdade** (build de produção) num
Chromium emulando celular (360 × 740, touch, `deviceScaleFactor` 2, pt-BR,
America/Sao_Paulo) e falam com um **Supabase de mentira** que roda na máquina:
[`scripts/mock-supabase.ts`](../scripts/mock-supabase.ts).

Enquanto não existe um projeto Supabase de verdade (e `.env.local` não existe),
é assim que se testa login, sessão, gravação e storage sem inventar chaves.

## Rodar

```bash
npm run build && npm run e2e
```

`npm run e2e` **não builda**: ele sobe `next start -p 3100` com o que já está em
`.next/`. Se você mudou código, builde de novo antes.

O Playwright sobe sozinho dois servidores (`webServer`) e derruba no fim:

| servidor | porta | comando |
|---|---|---|
| mock do Supabase | 54321 | `npx tsx scripts/mock-supabase.ts` |
| app | 3100 | `npx next start -p 3100` |

com as três variáveis apontando para o mock:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-anon
ALLOWED_EMAIL=miguelgsaviotti29@gmail.com
```

Úteis:

```bash
npm run e2e -- --grep "login"       # só uns testes
npm run e2e -- --headed             # ver o navegador
npm run e2e -- --debug              # passo a passo
npx playwright show-trace test-results/<pasta>/trace.zip
MOCK_LOG=1 npm run e2e              # uma linha por requisição do mock
```

O Chromium já está instalado em `/opt/pw-browsers`
(`PLAYWRIGHT_BROWSERS_PATH`); o `@playwright/test` está **pregado em 1.56.0**
porque é a versão que casa com esse Chromium (revisão 1194). **Nunca** rode
`playwright install`.

> `reuseExistingServer` está ligado fora de CI: se já tiver alguma coisa
> escutando na 3100 ou na 54321, o Playwright reaproveita em vez de subir a
> sua. Se os testes falharem com a tela "Configure NEXT_PUBLIC_…", é um
> `next start` velho preso na 3100 — mate e rode de novo.

## Testar à mão no navegador (ou no celular)

Dois terminais:

```bash
# 1) o Supabase de mentira
npm run mock            # ou: MOCK_LOG=1 npm run mock

# 2) o app em desenvolvimento, apontando para ele
npm run dev:mock        # next dev com as três variáveis já preenchidas
```

Abra `http://localhost:3000`, clique em **Criar conta** com
`miguelgsaviotti29@gmail.com` e qualquer senha de 6+ caracteres: o mock já
devolve a sessão (não há confirmação de e-mail). Do celular na mesma rede use
`http://<ip-do-computador>:3000` — nesse caso troque `127.0.0.1` por esse mesmo
IP nas variáveis do `dev:mock`, senão o navegador do celular não acha o mock.

O estado do mock vive em memória:

```bash
curl -s localhost:54321/__mock/estado            # o que está guardado
curl -s -XPOST localhost:54321/__mock/reset      # zera tudo
curl -s -XPOST localhost:54321/__mock/seed -H 'content-type: application/json' \
  -d '{"usuarios":[{"email":"miguelgsaviotti29@gmail.com","senha":"senha123"}],
       "tabelas":{"body_weights":[{"data":"2026-09-01","peso_kg":80}]}}'
```

## Arquivos

| arquivo | o que é |
|---|---|
| `playwright.config.ts` | projeto único "celular", `webServer` do mock + do app |
| `fixtures.ts` | `resetarMock`, `semear`, `estadoDoMock`, `sessaoNoMock`, `login`, `fixarRelogio`, `semRolagemHorizontal` |
| `login.spec.ts` | e-mail de fora recusado, criar conta → Hoje, senha errada, sair, entrar de novo |
| `shell.spec.ts` | navegação inferior (5 itens, alvos ≥ 44 px), cada rota abre, nada rola para o lado, manifest válido |
| `mock.spec.ts` | o contrato do próprio mock (PostgREST, upsert, `v_records`, storage, RLS) |

`fixarRelogio(page)` congela o relógio **do navegador** em 14/09/2026 (a
segunda-feira em que o programa começa, SPEC §5). O servidor continua com a
data real — para testar um dia específico no servidor, semeie as linhas com a
data que você quer.

## O que o mock faz

`scripts/mock-supabase.ts` é um servidor HTTP só com `node:http` (nenhuma
dependência nova). Estado em memória, por processo.

- **Auth (GoTrue)** — `POST /auth/v1/signup`,
  `POST /auth/v1/token?grant_type=password|refresh_token`,
  `GET|PUT /auth/v1/user`, `POST /auth/v1/logout`, `GET /auth/v1/settings`,
  `GET /auth/v1/.well-known/jwks.json`. Access token é um JWT HS256 de verdade
  (`sub`, `email`, `role: authenticated`, `exp` de 1 h). Criar usuário dispara o
  equivalente ao trigger `handle_new_user` do schema: nasce a linha em
  `profiles` com os defaults.
- **PostgREST** — `GET/HEAD/POST/PATCH/DELETE /rest/v1/<tabela>` para **todas** as
  tabelas de `supabase/schema.sql` e a view `v_records` (calculada de
  `session_sets`, somente leitura). Suporta `select` (colunas e `*`), filtros
  `eq/neq/gt/gte/lt/lte/in/is/like/ilike` (com prefixo `not.`), `order`
  (`asc`/`desc`, `nullsfirst`/`nullslast`), `limit`/`offset`/`Range`,
  `Prefer: return=representation|minimal`, `resolution=merge-duplicates` com
  `on_conflict` pelas chaves reais (`profiles.user_id`,
  `exercise_state(user_id, exercise_id)`, `body_weights(user_id, data)`,
  `body_measurements(user_id, data)`, `schedule_overrides(user_id, data)`, e o
  `id` uuid das demais), `Accept: application/vnd.pgrst.object+json` (406 se não
  vier exatamente 1 linha), `count=exact` (`Content-Range`) e os defaults do
  schema (uuid, `now()`, `current_date`, `status`, `prefs`…).
- **RLS simulada** — sem token, 401. Com token, toda linha lida é filtrada por
  `user_id` e toda linha gravada recebe o `user_id` da sessão; gravar com outro
  `user_id` dá 403. No bucket, o caminho tem que começar com `<user_id>/`.
- **Storage** — `POST|PUT|DELETE /storage/v1/object/progresso/<caminho>`,
  `GET /storage/v1/object/authenticated|sign|public/progresso/<caminho>`,
  `POST /storage/v1/object/sign/...` (URL assinada de mentira),
  `POST /storage/v1/object/list/progresso`, `DELETE /storage/v1/object/progresso`
  com `{prefixes:[…]}`.
- **Controle** — `GET /__mock/health`, `GET /__mock/estado`,
  `POST /__mock/reset`, `POST /__mock/seed`.
- **Porta** — `MOCK_SUPABASE_PORT` (padrão 54321). `MOCK_LOG=1` loga cada
  requisição.

Qualquer rota, tabela, coluna, operador ou `select` embutido que ele não conhece
responde **400 com `mock: … não implementado`**. Ele nunca finge sucesso: se um
teste quebrar com essa mensagem, é para implementar no mock — nunca para mudar o
app até caber nele.

## Limitações (o que o mock **não** é)

- Não é Postgres: não há SQL, tipos, `check`, chave estrangeira (apagar uma
  `session` não apaga as `session_sets`), transação, trigger de verdade nem
  `numeric(6,2)` — os números são `number` de JavaScript.
- A RLS é imitada no código, não são as policies de `supabase/schema.sql`. O
  schema continua sendo a fonte da verdade; o mock precisa ser atualizado à mão
  quando ele mudar (colunas fora do schema já são recusadas, o que ajuda a
  perceber).
- PostgREST pela metade: sem recursos embutidos (`select=a,b(c)`), sem `or`/`and`
  compostos, sem `rpc`, sem full-text, sem `upsert` com `missing=default`.
- Auth pela metade: só e-mail + senha, sempre autoconfirmado. Sem magic link,
  OAuth, recuperação de senha, MFA, captcha ou rate limit. A senha fica em texto
  puro na memória — é um mock de teste, nunca sai da máquina.
- Storage pela metade: sem transformação de imagem, sem `move`/`copy`, sem
  validação de tamanho/tipo, e a "URL assinada" não expira nem confere token.
- Estado em memória: reiniciar o processo apaga tudo, e não há concorrência —
  os testes rodam com `workers: 1` de propósito.
- `page.clock` muda só o relógio do navegador; o servidor (e o `current_date` do
  mock) segue a data real da máquina.
