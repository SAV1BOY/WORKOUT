# Prompt de continuação — Treino do Terraço (ultraloop de polimento)

> Este arquivo é o prompt entregue ao próximo agente (GPT ou outro) para continuar o polimento do app com a metodologia do ultraloop até esvaziar a Fila do `PROGRESSO.md`. O texto abaixo é o prompt inteiro; cole-o como primeira mensagem.

---

Você é o engenheiro responsável por continuar o polimento do **Treino do Terraço**, um PWA de treino em casa cujo dono é o Miguel. O trabalho anterior foi feito por um loop automatizado (o "ultraloop") em rodadas de análise → construção → auditoria → correção → deploy verificado. Sua missão é **continuar exatamente com essa metodologia até zerar a Fila** registrada em `PROGRESSO.md`, publicando em produção cada lote aprovado e mantendo os registros do projeto.

## 1. Onde está tudo

- Repositório: `SAV1BOY/WORKOUT`. **Tudo está na branch `main`** (commit `3a690f5` em 22/09/2026); a branch `claude/academia-miguel-index-ekvwi0` é idêntica e pode ser ignorada. Trabalhe em branches curtas a partir de `main` (`polimento/lNN-<nome>`) e mescle em `main` por PR.
- Produção: `https://treino-terraco.vercel.app` — push em `main` = deploy automático na Vercel; `GET /versao` devolve `{ "commit": "<sha>" }` do build no ar. Previews da Vercel exigem login, então toda fumaça é em produção.
- Banco: Supabase (`wmqcqexijxtrgjzsrqwp`, região sa-east-1). Nunca a service role no cliente. Cota de contas (SPEC §21): 5, com 3 em uso pelo dono e dois amigos.
- Stack fechada (não trocar): Next.js 15 App Router · TypeScript estrito · React 19 · Tailwind 4 · shadcn/ui · Supabase (`@supabase/ssr`) · Vercel · PWA com Serwist · Zod · TanStack Query · Recharts · date-fns (pt-BR) · Vitest · Playwright · Dexie (IndexedDB).

## 2. Leia nesta ordem antes de escrever código

1. `CLAUDE.md` — regras do projeto (valem para você, mesmo não sendo o Claude).
2. `SPEC.md` — o produto; em especial a **§22 "Polimento contínuo"** (§22.0 decisões, §22.0.1 regras de qualidade, §22.1–§22.11 os lotes já publicados). Cada lote seu ganha uma **§22.N nova, escrita antes do código**.
3. `PROGRESSO.md`, seção **"## Ultraloop 20/09/2026 — polimento contínuo (madrugada)"**: "### Relatório para o dono (9h)" (o que já está no ar, em linguagem do dono), "### Como funcionou" (o método), as subseções "Rodada N — Lote M" (o formato de registro que você deve repetir) e **"### Fila (o que não coube)"** — a sua lista de trabalho.
4. `docs/ultraloop/` — a íntegra da fila e da análise:
   - `fila.json` — 97 itens `{id, origem, motivo}` (o item do lote 7 já foi publicado; ignore-o).
   - `fila-agrupada.json` — os mesmos itens agrupados por área/arquivo.
   - `lotes-r5.json` e `lotes-r6.json` — lotes planejados na análise e não executados (L9–L12 etc.), com linhas de código e proposta por item. O L12 precisa ser remontado: parte dele já entrou com os lotes 3 e 4.
   - `analise/*.json` — os achados originais por lente (ux-heuristicas, visual, a11y, performance, imagens, pwa-offline, copy, tela-relatorio-corpo-calendario, tela-explorar-fichas, tela-treino-player), com evidência, severidade, proposta e arquivos. As linhas citadas foram medidas na base `c82b744`; localize pelo trecho, não pelo número.
   - `deploys.json` — o histórico dos 9 deploys (formato a repetir).
   - `portoes.sh` — a cadeia de portões usada pelo loop (ver §5).
5. `data/*.json`, `supabase/schema.sql`, `assets/`, `docs/` — conteúdo, banco e material de referência.

## 3. Regras invioláveis

- **Conteúdo vem dos JSON** (`data/*.json`, tipos em `lib/schemas.ts`). Nunca copie exercícios, séries ou textos do guia para o código; se um dado estiver errado, corrija o JSON.
- **Motor intocado**: `lib/progressao.ts` e `lib/montagem.ts` não mudam (a menos que um item da fila peça e exista caso em `docs/casos-de-teste-progressao.md`). Confira com `git diff main -- lib/progressao.ts lib/montagem.ts` vazio antes de cada PR.
- **Celular primeiro**: tudo a 360 px de largura, uma mão, teclado numérico, alvos ≥ 44 px, zero rolagem lateral, os dois temas (claro/escuro).
- **Nunca perder um registro**: cada série vai para o IndexedDB na hora; envio ao Supabase assíncrono com fila e retry.
- **pt-BR** em toda a interface, vírgula decimal, datas dd/mm, semana começa na segunda.
- **Segurança**: RLS em tudo; `ALLOWED_EMAIL` é o dono; nunca a service role no cliente; nunca commitar segredos.
- **Banco**: só se um item exigir. Mesmo comando em `supabase/schema.sql` e em `supabase/migracoes/<AAAA-MM-DD>-<nome>.sql`, idempotente e **expand-only** (nada de drop/rename: o app velho e o rollback continuam funcionando); `revoke` das funções que o navegador não chama; teste no molde de `lib/migracao-contas.test.ts`; `scripts/mock-supabase.ts` e `lib/schemas.ts` cientes. **Não aplique você mesmo no projeto real e não publique código que dependa de migração não aplicada**: entregue o SQL, peça ao dono para aplicar (ou aplique se ele lhe der acesso e autorizar por escrito) e só então faça o deploy do lote.
- **Sem gamificação, sem feature fora de `SPEC.md`** (§11 e §22). Pequeno e sólido.
- **Git**: commits pequenos em português, um por item quando possível; nunca `--force`, `rebase` ou `amend` em branch já pushada; nunca push direto em `main` (sempre PR).
- **Fora de escopo por decisão do dono** (só se ele pedir): CSP completa, Lighthouse ≥ 90, `next@16`, recuperação de senha/magic link, coluna `rpe`, primeira carga sem rede.

## 4. Prioridades e critérios do dono

- Ordem de prioridade das telas: **Relatório / Corpo / Calendário**, depois **Explorar / fichas de exercício**, depois **Treino / player**. Login, guia, Mais e PWA vêm depois, mas entram.
- Ordem da Fila: **B → C → D** (A já foi publicado). Dentro de B, siga `lotes_propostos_ordem` de `fila.json` e os arquivos `lotes-r5.json`/`lotes-r6.json`.
- Deploy automático por lote aprovado, **com rede de proteção** (fumaça completa e rollback imediato se quebrar). Nunca "corrigir para frente" em produção sem rodada completa.
- O dono lê o "Relatório para o dono": escreva em linguagem simples, por tela, com "como ver no celular" (abrir, fechar e abrir de novo).

## 5. O método (uma rodada = um lote; repita até a Fila acabar)

**5.1 Montar o lote.** 6–10 itens da Fila, no máximo 3 "M" (médios), ≤ 12 arquivos, uma área principal, ≤ 6 telas esperadas para mudar. Se rodar dois lotes em paralelo (sub-agentes), os arquivos têm de ser disjuntos. Item que não couber é revertido antes dos portões (árvore verde) e volta à Fila como "parcial", com motivo.

**5.2 SPEC antes do código.** Escreva `SPEC.md` §22.N com: o problema medido, o que muda, o aceite verificável de cada item (como as §22.7–§22.11).

**5.3 Construir.** Regra pura + teste de unidade para toda decisão (como `lib/digitar-numero.ts`, `lib/estado-do-player.ts`, `lib/sw-servir-socorro.ts`); e2e Playwright para todo comportamento de tela (a 360×740, contra `scripts/mock-supabase.ts`, usando `e2e/fixtures.ts`: `sessaoNoMock`, `usuarioComPerfil`, `/__mock/seed`, `/__mock/estado`; nunca `/__mock/reset` em testes que rodam em paralelo). Use o que já existe: `Vazio`, `.foco`, `.flutuante`, esqueletos por forma, tokens de `app/globals.css`, `AlertDialog`, `e2e/auditoria-m6.spec.ts` (`alvosDe44px`, `nadaVazaALargura`).

**5.4 Portões completos no HEAD final, nesta ordem, todos verdes:**
```
npm run lint
npx tsc --noEmit
npm test                                  # Vitest (1.449 unitários hoje)
npm run build                             # valida os JSON antes
MOCK_SUPABASE_PORT=54321 npm run build:e2e   # assa a URL do mock no build
E2E_PORT=3100 MOCK_SUPABASE_PORT=54321 npm run e2e            # 426 e2e hoje (~16 min)
VARREDURA=1 E2E_PORT=3100 MOCK_SUPABASE_PORT=54321 npm run e2e -- --grep varredura   # 30 telas × 2 temas: rolagem lateral, 44 px, contraste, foco, reduced-motion
```
`docs/ultraloop/portoes.sh <checkout> <pasta-de-logs> lint tsc test build build:e2e e2e varredura` roda tudo em sequência, grava `<hash>.log` e `<hash>.status` (`ok` ou `falhou:<portão>`) e o `manifest-prod.json` do build. Só um build/e2e por vez na mesma máquina. Um teste instável que falha sob carga e passa sozinho duas vezes é anotado, não alterado; nunca pule, desative ou isole um teste para ficar verde.

**5.5 Capturas comparadas.** Antes do primeiro lote, gere a **linha de base** a partir de `main`: suba o mock e o app do `build:e2e` e rode `CAPTURAS_APP=http://127.0.0.1:3100 CAPTURAS_MOCK=http://127.0.0.1:54321 CAPTURAS_DIR=<pasta-base> npx tsx scripts/capturas-ultraloop.ts` (60 PNGs: 30 telas × 2 temas, semente própria, `reducedMotion`). Depois de cada lote, gere as capturas do HEAD e rode `npx tsx scripts/comparar-capturas.ts <base> <depois> --esperadas <telas-declaradas> --limiar 0.5`: telas esperadas mudam e você descreve a mudança olhando o diff; qualquer outra com Δ > 0,5 % é regressão até prova em contrário. Quando o lote for publicado, a base avança para as capturas do HEAD publicado.

**5.6 Auditoria independente (obrigatória, no máximo duas por lote).** Mude de chapéu (ou use outro agente) e audite com o roteiro da §6. Veredito: **aprovado só sem bloqueantes e sem importantes**. Reprovou → corrija, rode os portões de novo no HEAD final, segunda auditoria. Reprovou de novo → o lote volta à Fila com o veredito registrado; não force.

**5.7 Deploy com rede de proteção.**
1. Guarde o estado anterior: `deploymentId` atual na Vercel, o sha de `/versao` e o hash do CSS de `/login`.
2. `git merge --no-ff` da branch do lote numa branch de integração a partir de `main` (ou PR direto da branch do lote), corpo do PR no formato dos PRs #13–#16 (o que mudou por item com provas, portões, capturas, "Motor e montagem intocados", migrações: nenhuma/quais). Mescle em `main`.
3. Espere ≤ 12 min até `GET /versao` devolver o sha do merge; se passar, leia o log de build da Vercel e trate como quebrado.
4. **Fumaça em produção** (3 tentativas, 40 s entre elas; todas obrigatórias): `/login` 200 com "Treino do Terraço" e "Entrar", sem "Configure NEXT_PUBLIC_SUPABASE_URL" e sem "é secreta"; `/` → 307 `/login`; `/versao` == sha; `/sw.js` 200 com `/~offline`, `figuras/`, `Tentar de novo`, `Ir para o Treino`, `__regrasComSocorro` e o **mesmo** CSS do HTML de `/login`; `/manifest.webmanifest` com o nome e ícones 192/512; `/~offline` 200 com os dois botões; todo `<script src>` de `/login` → 200; marcadores do lote (o chunk da tela alterada, listado em `/sw.js`, contém o texto novo — o bundle escapa acentos como `\xe9`). Sonda opcional em Chromium a 360×740 em `/login` e `/~offline`: zero erro de console, `scrollWidth == clientWidth`.
5. **Quebrou** (qualquer item após 3 tentativas, build com erro, `/versao` não virou): rollback pelo painel/API da Vercel para o deployment anterior, confirme `/versao`, depois `git revert -m 1 <merge>` + PR + merge em `main` (o revert recoloca `main` = produção), registre o motivo e devolva o lote à Fila.
6. **Verificação logada em produção** a cada lote que mexe em tela: crie uma conta de teste pela tela "Criar conta" (`teste-gpt-<AAAAMMDD>@example.com`, senha forte; o e-mail é auto-confirmado), percorra as telas do lote a 360×740 nos dois temas em navegador real, e **ao terminar registre no PROGRESSO o e-mail para o dono apagar** (ou apague via SQL se tiver acesso autorizado: `delete from auth.users where email = …`, o schema faz cascade). Nunca envie fotos, nunca mexa nas três contas reais, nunca troque senhas.

**5.8 Registro (parte do lote, não opcional).**
- `PROGRESSO.md`: subseção `### Rodada N — Lote M — <nome>` com **O que mudou** (era → é, arquivos), **Provas** (unitários, e2e, varredura, tabela de capturas), **Portões** (`<hash>.log`: lint · tsc · N unitários · M e2e · varredura), **Deploy** (deployment anterior → novo, `/versao`, fumaça item a item, rollback: não/sim e por quê), **Como testar no celular**; atualize o "### Relatório para o dono" (bloco "Rodada N no ar") e a **Fila** (tire o que entrou; anote o que voltou e por quê).
- `SPEC.md` §22.N já escrita; ajuste se o código divergir do planejado.
- `docs/ultraloop/deploys.json`: acrescente a entrada da rodada; `docs/ultraloop/fila.json`: marque os itens como resolvidos (mova para `resolvidos` com o sha).
- Mensagem ao dono a cada deploy (curta, em português): o que entrou, o link, como ver no celular, o que ficou na fila.

## 6. Roteiro do auditor (use em toda auditoria)

1. Pré-condições: HEAD da branch == o hash auditado; `.status == ok` com o log contendo `Compiled successfully` e `passed`; `git diff main -- lib/progressao.ts lib/montagem.ts` vazio; árvore limpa; nenhuma dependência npm nova sem justificativa; nenhuma mudança em `supabase/` sem migração e teste.
2. Diff inteiro (`git diff main...HEAD`) com olho adversarial: o que quebraria em produção? Respostas do Supabase nunca cacheadas pelo service worker; nada de `pointer-events-none` em alvo que precisa de toque; nada de texto fora do pt-BR; nada de número sem vírgula; nada de `title` como única forma de ver um texto cortado.
3. Reproduza item a item nos dois temas a 360×740 no servidor local (`build:e2e` + mock): o aceite da §22.N é cumprido? Meça (alvos ≥ 44 px com `getBoundingClientRect`, `scrollWidth == clientWidth`, contraste AA, `elementFromPoint` onde há sobreposição).
4. Capturas: as esperadas mudaram como descrito; nenhuma inesperada com Δ > 0,5 %.
5. Cada regra nova tem teste de unidade; cada comportamento de tela tem e2e que exercita o caminho real (não só a presença do elemento).
6. Veredito com três listas: **bloqueantes** (quebra, regressão, portão vermelho, aceite não cumprido), **importantes** (sem teste, alvo < 44 px, SPEC/PROGRESSO ausentes, texto errado), **menores**. Aprovado só com as duas primeiras vazias.

## 7. Receitas que já funcionaram

- Service worker em navegador real (Playwright): `context.serviceWorkers()` / `context.waitForEvent('serviceworker')`; `worker.evaluate(() => …)` roda dentro do worker — listar/apagar caches, `self.registration.navigationPreload.disable()`, trocar `self.fetch` por uma função que rejeita simula "sem rede" para o worker (`context.setOffline` e `context.route` não alcançam o worker). Quem serviu a tela: 0 `<script src>` e 0 folha externa = socorro embutido; qualquer outra coisa = `/~offline` de verdade. Use rotas nunca visitadas para exercitar o fallback.
- Login é server action: o navegador não fala com o Supabase no login; o `POST /auth/v1/token` sai do servidor da Vercel. Para provar comportamento de sessão, use o destino dos refresh tokens ou dois contextos.
- `<input type="date">` mostra MM/DD no Chromium headless por idioma do navegador, não da página: confira num celular em português antes de tratar como defeito.
- Vercel pode devolver 000/502 transitórios pelo proxy do agente: repita até 3× antes de concluir; falha que não repete na mesma URL não é de produção.

## 8. Estado da Fila em 22/09/2026 (o que falta)

- **A** — publicado (lote 7, aba Treino).
- **B — 33 itens** planejados na análise e não executados (Explorar/catálogo, ficha do exercício/imagens, Relatório/Corpo, copy, a11y, performance, PWA). Detalhe em `lotes-r5.json`, `lotes-r6.json` e `analise/*.json`.
- **C — 64 pendências menores** apontadas pelas auditorias (nenhuma bloqueante), agrupadas por origem no `PROGRESSO.md`.
- **D — 6 observações da verificação em produção**: URL de sessão concluída reabre o player; ~11 s até o player em aparelho zerado; `GET /auth/v1/user` a cada render; `emQualquerCache()` relê a `/~offline`; e2e do Sair pela interface; máscara do `input type="date"`.

## 9. Critério de parada

Você termina quando **B, C e D estão vazios** — cada item ou entrou em produção com portões, auditoria aprovada, fumaça verde e registro, ou foi **descartado com motivo escrito** na Fila (por exemplo: contradiz a SPEC, custo desproporcional, depende de decisão do dono — nesse caso, formule a pergunta ao dono e siga com o resto). No fim: `main` verde, produção == `main` (`/versao`), "Relatório para o dono" atualizado com tudo o que entrou desde `3a690f5`, `docs/ultraloop/fila.json` com `itens` vazio e `resolvidos` completo, nenhuma conta de teste esquecida, e uma mensagem final ao dono com o link e a lista do que foi descartado e por quê.

Comece por: (1) ler os arquivos da §2; (2) gerar a linha de base de capturas a partir de `main`; (3) montar o primeiro lote a partir de B (Explorar/catálogo é o primeiro em `lotes_propostos_ordem`) e escrever a §22.12; (4) construir, auditar, publicar, registrar; (5) repetir.
