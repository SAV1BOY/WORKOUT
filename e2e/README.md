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

> **O Playwright sempre sobe os seus dois servidores** (`reuseExistingServer:
> false`). Se a 3100 ou a 54321 estiver ocupada ele para com "is already used"
> — é para matar o que está lá e rodar de novo. Reaproveitar era pior do que
> parece: um `next start` órfão de antes do último `npm run build` serve o HTML
> apontando para o CSS antigo, a página abre **sem estilo** e os testes de
> 44 px falham como se o app estivesse quebrado. Cuidado ao matar: o processo
> se chama `next-server`, não `next start` — `pkill -f "next start"` deixa o
> servidor vivo.

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
curl -s localhost:54321/__mock/estado            # o que está guardado + requisicoes
curl -s -XPOST localhost:54321/__mock/reset      # zera tudo
curl -s -XPOST localhost:54321/__mock/seed -H 'content-type: application/json' \
  -d '{"usuarios":[{"email":"miguelgsaviotti29@gmail.com","senha":"senha123"}],
       "tabelas":{"body_weights":[{"data":"2026-09-01","peso_kg":80}]}}'
```

## Arquivos

| arquivo | o que é |
|---|---|
| `playwright.config.ts` | projeto único "celular", `webServer` do mock + do app |
| `fixtures.ts` | `resetarMock`, `semear`, `estadoDoMock`, `requisicoesDoMock`, `sessaoNoMock`, `usuarioComPerfil`, `inserirNoMock`, `atualizarNoMock`, `lerDoMock`, `login`, `entrarNoApp`, `esperarAbaTreino`, `irNaAba`, `fixarRelogio`, `fixarData`, `esperarServiceWorker`, `semRolagemHorizontal` |
| `login.spec.ts` | e-mail de fora recusado, criar conta → aba Treino, senha errada, sair, entrar de novo |
| `shell.spec.ts` | navegação inferior (Treino · Explorar · Relatório · Corpo · Mais, alvos ≥ 44 px), cada rota abre, nada rola para o lado, manifest válido |
| `mock.spec.ts` | o contrato do próprio mock (PostgREST, upsert, `v_records`, storage, RLS) |
| `treino.spec.ts` | a aba Treino (`/`): Treino A com as cargas iniciais, Treino B pela alternância, a carga que veio do estado com o evento que a explica, corrida da semana 1 + corda, descanso com o "+1", faixa de status, banner do treino aberto e o cache persistido |
| `calendario.spec.ts` | a grade da semana (A/B alternando, marcações, o que falta), navegação entre semanas, troca de tipo de um dia futuro e a regra da semana curta |
| `treinar.spec.ts` | a sessão de força série a série, o timer de descanso, offline, recarregar no meio, concluir com o motor decidindo |
| `cardio.spec.ts` | o timer de intervalos da corrida (`page.clock.runFor`), a corda, o cronômetro da caminhada, o registro em `cardio_sessions`, o avanço da semana do plano (§5.5) e a tela `/barra-fixa` (semana destacada, "+1", sessão `workout_id = 'fixa'`) |
| `catalogo.spec.ts` | o catálogo dos 81 (busca sem acento, filtros, "no meu programa" batendo com `programa.json`), a ficha com figura/fotos/mapa/passos e o histórico com a linha do tempo do motor |
| `relatorio.spec.ts` | os cards (treinos, aderência, volume, recordes), os gráficos dos grandes, volume, barra fixa e corrida, a tabela da `v_records` e a tela vazia |
| `corpo.spec.ts` | peso (vírgula, upsert por data, média móvel), meta em `prefs`, as 8 medidas, a foto subindo para o bucket (URL assinada depois do reload) e a comparação com slider |
| `treino-v2.spec.ts` | a camada visual v2 (SPEC §13.2–§13.4): faixa da semana com ✓, meta semanal e sequência, os cards de segunda/terça/quinta/domingo, a lista com miniatura e carga, o "Continuar" da sessão aberta, o ⇄ que vale para a sessão que começa, `/progresso` → `/relatorio`, os raios e o vídeo opcional |
| `auditoria.spec.ts` | o que os outros não provavam: nenhuma requisição ao Supabase com e-mail de fora, recarregar mantém a sessão, toda rota protegida volta ao login, e o mock recusando coluna/operador/filtro composto inventados |

A camada visual v2 (SPEC §13.3) tirou o título "Hoje" da tela `/`: quem espera
a tela usa `esperarAbaTreino(page)` (a região "Treino"), e quem troca de aba usa
`irNaAba(page, "Corpo")` — a lista do dia tem links cujo texto contém "peso do
corpo", e um `getByRole("link", { name: "Corpo" })` solto casaria com eles.

`fixarRelogio(page)` congela o relógio **do navegador** em 14/09/2026 (a
segunda-feira em que o programa começa, SPEC §5). O servidor continua com a
data real — para testar um dia específico no servidor, semeie as linhas com a
data que você quer. **Quem decide o dia é o navegador** (`lib/relogio.ts`), então
`fixarRelogio(page, "2026-09-17T08:00:00-03:00")` antes de entrar é o que muda a
aba Treino de força para descanso.

`usuarioComPerfil({ ultimo_treino: "A1" })` cria a conta permitida direto no mock
e deixa o perfil como `garantirPerfil` deixaria (nome, altura, `data_inicio`
14/09/2026), já com os ajustes pedidos — depois é só `entrarNoApp(page)`, que vai
direto no botão "Entrar" em vez de passar por "Criar conta".

Atenção com `page.clock`, que tem três usos diferentes:

- `fixarRelogio(page, quando)` = `page.clock.install`: fixa a **data** e permite
  empurrar o tempo com `page.clock.runFor(ms)` — é assim que a corrida de 34 min
  do `cardio.spec.ts` cabe num teste. Entre um `runFor` e outro o relógio
  continua andando junto com o tempo real, então asserte **qual bloco está
  valendo**, não o segundo exato.
- `fixarData(page, quando)` = `page.clock.setFixedTime`: fixa só a data e deixa
  os temporizadores correndo de verdade. É o que os testes que dependem de
  `setTimeout` (cache do TanStack Query, debounce do IndexedDB) precisam.
`esperarServiceWorker(page)` espera `navigator.serviceWorker.controller` deixar
de ser `null` — é o que "o app instalado" quer dizer. Registrar o SW não basta:
enquanto o precache não fecha, uma navegação offline morre em
`ERR_INTERNET_DISCONNECTED` sem nem chegar ao service worker. Chame antes de
`context.setOffline(true)` em qualquer teste que dependa do app abrir sem rede.

- **Nunca** `page.clock.pauseAt` neste app: com o relógio totalmente parado o
  Dexie não responde e a tela fica no esqueleto para sempre.

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
  com `{prefixes:[…]}`. O upload do navegador chega como `multipart/form-data`
  (é o que o supabase-js manda com um `Blob`): o mock desembrulha e guarda só o
  arquivo, com o `Content-Type` da parte — como o Storage de verdade faz.
- **Controle** — `GET /__mock/health`, `GET /__mock/estado`,
  `POST /__mock/reset`, `POST /__mock/seed`. O `/estado` traz também
  `requisicoes`: tudo que chegou ao mock desde o último reset (sem contar
  `/__mock`), que é como os testes provam o **negativo** — "o app não chamou o
  Supabase" (`requisicoesDoMock()` em `fixtures.ts`).
- **Porta** — `MOCK_SUPABASE_PORT` (padrão 54321). `MOCK_LOG=1` loga cada
  requisição.

Qualquer rota, tabela, coluna (em `select`, em filtro ou em `order`), operador,
filtro composto (`or=`/`and=`) ou `select` embutido que ele não conhece responde
**400**, mesmo quando a tabela está vazia — a validação não depende de haver
linha para filtrar. Ele nunca finge sucesso: se um
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
  compostos, sem apelido no select (`select=apelido:coluna`), sem `rpc`, sem
  full-text, sem `upsert` com `missing=default`. Tudo isso dá 400, não silêncio.
- Auth pela metade: só e-mail + senha, sempre autoconfirmado. Sem magic link,
  OAuth, recuperação de senha, MFA, captcha ou rate limit. A senha fica em texto
  puro na memória — é um mock de teste, nunca sai da máquina.
- Storage pela metade: sem transformação de imagem, sem `move`/`copy`, sem
  validação de tamanho/tipo, e a "URL assinada" não expira nem confere token.
- Estado em memória: reiniciar o processo apaga tudo, e não há concorrência —
  os testes rodam com `workers: 1` de propósito.
- `page.clock` muda só o relógio do navegador; o servidor (e o `current_date` do
  mock) segue a data real da máquina.
