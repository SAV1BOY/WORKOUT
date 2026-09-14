# PROGRESSO — Treino do Terraço

Andamento por marco (SPEC.md §12). O que está aqui é o estado real do
repositório, não um plano.

---

## Marco 1 — Base ✅

Scaffold do Next.js 15 dentro da pasta do kit (sem tocar em `data/`, `assets/`,
`docs/`, `supabase/`, `SPEC.md`, `CLAUDE.md`), dados tipados com zod, login com
e-mail permitido, shell com navegação inferior, PWA e o esqueleto do offline.

### O que foi feito

- **Scaffold** gerado com `create-next-app@15` numa pasta temporária e trazido
  para cá só o que faltava. Tailwind 4, ESLint (`eslint-config-next`),
  TypeScript estrito (`strict` + `noUncheckedIndexedAccess`), alias `@/*`.
- **shadcn/ui** inicializado (base neutra, estilo `radix-nova`, ícones lucide):
  `button, card, input, label, badge, sheet, dialog, tabs, switch, separator,
  skeleton, sonner` em `components/ui/`.
- **Dados tipados**: `lib/schemas.ts` (zod para os 6 JSON, com enums de grupo,
  implemento, categoria, `prescricao.tipo`, `progressao.tipo`, dia, tipo de dia,
  treinos A1/B1/SA/IA/SB/IB, assistência e fases) e `lib/dados.ts` (parse na
  carga do módulo, erro claro se algo estiver errado, índices
  `exercicioPorId` / `treinoPorId` / `fasePorId` e helpers pequenos).
- **Validação**: `npm run validar` (`scripts/validar-dados.ts`) confere os 6
  JSON, que todo `exercicio_id` do programa existe no catálogo, que toda
  figura/foto referenciada existe em `assets/` e que os 67 SVG e as 162 JPG
  estão todos referenciados. Sai com código ≠ 0 e lista os problemas.
- **Assets**: `npm run assets` (`scripts/copiar-assets.ts`) copia
  `assets/{figuras,fotos,itens,mapa-muscular}` para `public/` (idempotente);
  roda no `prebuild`. As quatro pastas ficam no `.gitignore`.
- **Formatação pt-BR**: `lib/formato.ts` (`formatarKg`, `formatarNumero`,
  `formatarCm`, `formatarKm`, `formatarData` dd/MM, `formatarDataLonga`,
  `formatarDuracao` mm:ss, `formatarMinutos`, `lerNumero` aceitando vírgula,
  `rotuloDaCarga` por implemento), com testes.
- **Supabase**: `lib/env.ts` (URL, chave anon/publishable, `ALLOWED_EMAIL`,
  `supabaseConfigurado()`), `lib/supabase/{client,server,middleware}.ts`
  (`cookies()` assíncrono do Next 15) e `middleware.ts` na raiz: sem sessão →
  `/login`; sessão com e-mail diferente → `signOut` + `/login?erro=app-pessoal`.
  Rotas públicas: `/login`, `/auth/callback`, `/~offline`, manifest, `sw.js` e
  os assets.
- **Login** (`app/(auth)/login/`): e-mail + senha com server actions "Entrar" e
  "Criar conta". Qualquer e-mail diferente de `ALLOWED_EMAIL` é recusado **antes**
  de chamar o Supabase, com "Este app é pessoal."; erros do Supabase traduzidos
  em `lib/erros-auth.ts`; sem variáveis de ambiente aparece o aviso
  "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY".
  `app/auth/callback/route.ts` troca o `code` por sessão. Botão "Sair" em `/mais`.
- **Seed do perfil**: `lib/queries/perfil.ts` — `montarSeedPerfil()` e
  `precisaSeed()` são puras e testadas; `garantirPerfil()` grava o upsert e é
  chamada no layout autenticado. Só faz seed enquanto o perfil está como o
  trigger do banco criou (sem altura/nome); não sobrescreve o que o usuário editar.
- **Shell**: `app/(app)/layout.tsx` com navegação inferior fixa de 5 itens
  (Hoje · Treinar · Progresso · Corpo · Mais), alvos ≥ 44 px, safe-area, e
  páginas placeholder para todas as rotas da arquitetura. Tema claro/escuro com
  `next-themes` (classe `dark`, escuro de verdade `#0a0a0a`, destaque laranja),
  classe `.numero` para os números grandes.
- **PWA**: `app/manifest.ts` ("Treino do Terraço" / "Treino", standalone,
  ícones 192/512 + maskable gerados por `scripts/gerar-icones.ts` com sharp, sem
  rede), `@serwist/next` com `app/sw.ts` (precache do shell, `defaultCache`,
  fallback `/~offline`), desligado em desenvolvimento.
- **Offline**: `lib/db.ts` (Dexie: `sessaoAtiva`, `outbox`, `cache`) e
  `lib/outbox.ts` (`enfileirar`, `processar` com retry exponencial de 2 s a
  5 min, listener de `online` e de volta à aba, flush ao iniciar). O enviador de
  verdade é registrado nos marcos 3+ (`definirEnviador`). `lib/types.ts` tem os
  tipos das linhas de `supabase/schema.sql`.
- **Testes**: Vitest (`vitest.config.mts`, ambiente node, alias `@/`) — 35 testes
  em `lib/formato.test.ts`, `lib/dados.test.ts` (os 6 JSON passam e o programa
  bate com o catálogo), `lib/queries/perfil.test.ts`, `lib/outbox.test.ts` e
  `lib/erros-auth.test.ts`.

### Estrutura de pastas real

```
app/
  layout.tsx providers.tsx globals.css manifest.ts sw.ts icon.png
  (auth)/login/{page.tsx,formulario.tsx,acoes.ts}
  auth/callback/route.ts
  (app)/layout.tsx  page.tsx (Hoje)
        treinar/page.tsx  treinar/[sessionId]/page.tsx
        cardio/[id]/page.tsx  barra-fixa/page.tsx  calendario/page.tsx
        exercicios/page.tsx  exercicios/[id]/page.tsx
        progresso/page.tsx  corpo/page.tsx  mais/page.tsx
  ~offline/page.tsx
components/  ui/ (shadcn) nav-inferior.tsx em-construcao.tsx
             mapa-muscular.tsx alternar-tema.tsx botao-sair.tsx
lib/  env.ts schemas.ts dados.ts formato.ts erros-auth.ts types.ts
      db.ts outbox.ts utils.ts supabase/{client,server,middleware}.ts
      queries/perfil.ts  + *.test.ts
scripts/  validar-dados.ts copiar-assets.ts gerar-icones.ts
middleware.ts  next.config.ts  vitest.config.mts  components.json
```

### Versões instaladas

next 15.5.25 · react 19.1.0 · typescript 5.9.3 · tailwindcss 4.3.3 ·
@serwist/next 9.5.12 · serwist 9.5.12 · dexie 4.4.6 · zod 4.6.5 · vitest 5.0.0 ·
@tanstack/react-query 5.102.8 · @supabase/ssr 0.12.7 ·
@supabase/supabase-js 2.116.0 · date-fns 4.4.0 · recharts 3.10.1 ·
lucide-react 1.46.0 · next-themes 0.4.6 · eslint 9.39.5 · sharp 0.35.4 (dev).

### Decisões

- `npm run build` usa webpack (sem `--turbopack`): é o caminho suportado pelo
  `@serwist/next` 9 para gerar o service worker.
- O sprite do mapa muscular (`assets/mapa-muscular/corpo-sprite.svg`) é lido do
  disco no servidor e injetado uma vez no layout autenticado;
  `outputFileTracingIncludes` no `next.config.ts` garante o arquivo no deploy.
  As classes `p-<musculo>` / `s-<musculo>` foram declaradas em `globals.css`
  usando as variáveis de cor do tema (o `musculos.css` do asset usa
  `prefers-color-scheme` e brigaria com a classe `dark`).
- O layout autenticado é `force-dynamic`: ele lê cookies e nunca pode virar
  página estática.
- `tsconfig` com `noUncheckedIndexedAccess`: acesso a índice devolve
  `T | undefined` e obriga a tratar o caso.
- `reps_semana` do plano de barra fixa aceita número ou faixa em texto
  ("25–45" na semana 11–12) — é o que está no JSON.
- Nada de `next/font/google`: o build não depende de rede; a tipografia usa a
  pilha do sistema.

### O que falta (marcos 2–6)

2. **Hoje + calendário** (SPEC §3.1, §3.5): a tela Hoje com o card do dia e a
   grade da semana. A lógica (§5) já está em `lib/calendario.ts`.
3. **Sessão de força** (§3.2) com IndexedDB + outbox ligados. O **motor**
   (`lib/montagem.ts`, `lib/progressao.ts`, `lib/calendario.ts`) já está pronto
   e testado — ver a seção "Motor" no fim deste arquivo.
4. **Cardio e barra fixa** (§3.3, §3.4): timers de intervalo, plano de 12
   semanas, repetições soltas.
5. **Catálogo e ficha** (§3.6), **Progresso** (§3.7) e **Corpo** (§3.8):
   figuras, fotos, mapa muscular, gráficos Recharts, peso/medidas/fotos.
6. **Mais** (perfil, equipamento, backup), polimento offline, Lighthouse, deploy.

Pendências de ambiente (fora do código): ainda **não existe projeto Supabase**,
então `.env.local` não foi criado e o fluxo de login não pôde ser testado ponta a
ponta. Quando o projeto existir: rodar `supabase/schema.sql`, preencher
`.env.local` a partir de `.env.local.example` e conferir os critérios 1 e 2 da
SPEC §10.

### Como testar no celular (o que já dá para ver)

1. `npm install` e, se tiver as chaves, `cp .env.local.example .env.local` e
   preencha; sem as chaves o app abre igual, só não loga.
2. `npm run dev` e, no celular na mesma rede, abra
   `http://<ip-do-computador>:3000` (ou `npm run build && npm start`).
3. A tela de **login** deve caber em 360 px sem rolagem lateral, com os campos e
   os dois botões altos (≥ 44 px). Digite um e-mail diferente do permitido: tem
   que aparecer "Este app é pessoal." sem nem chamar o Supabase. Sem as
   variáveis, aparece o aviso de configuração.
4. Com as chaves e uma conta criada: depois de entrar, a **navegação inferior**
   fica fixa no rodapé com Hoje · Treinar · Progresso · Corpo · Mais; todas as
   telas abrem com o título e "em construção — marco N".
5. Em `/mais`, "Tema escuro/claro" alterna o tema (escuro é preto de verdade) e
   "Sair" volta para o login.
6. No build de produção o app é instalável (manifest + service worker):
   no Chrome, menu ⋮ → "Instalar app". Com o app aberto, ative o modo avião e
   navegue: a tela `/~offline` aparece no lugar do erro do navegador.


---

## Motor — progressão, montagem e calendário ✅

As três peças puras do marco 3, escritas com os testes primeiro. Nenhuma delas
importa React, Supabase ou Dexie: recebem dados e devolvem dados. 88 testes
novos (`npm test` fecha em 128).

### `lib/montagem.ts` — quais cargas o kit alcança

```ts
type ImplementoMontagem = Implemento | "barra_reta_oca";
cargasPossiveis(implemento, { pesoBarra? }): number[]          // escala crescente
alcancavelParaBaixo(kg, implemento, opcoes?): number           // SPEC §6.4
cargaMinima(implemento, opcoes?) · cargaMaxima(implemento, opcoes?)
montagem(kg, implemento, opcoes?): Montagem
// Montagem = { implemento, anilhas, porLado? | porPonta? | noPino? | naMochila?,
//              onde, pesoBarra, total, pedido, exato, diferenca?, aviso? }
PESO_BARRA_A_PESAR = 2
```

- Uma tabela de configuração por implemento (peso da barra, fator 1 ou 2,
  limite de unidades por lado, capacidade) e duas rotinas pequenas: o conjunto
  das somas possíveis (para a escala) e um guloso do maior para o menor **com
  volta atrás** (para as anilhas). O estoque e as capacidades vêm de
  `data/equipamentos.json`.
- Escalas: barra maciça 7,5 → 107,5 (51 cargas, passo 2); halteres 1,5 → 39,5
  por halter; polia e lastro 0 → 100 de 1 em 1; barra W 2 → 50; barra reta oca
  2 → 60.

### `lib/progressao.ts` — o motor (SPEC §6)

```ts
prescricaoPadrao(exercicio) · prescricaoDoTreino(itemDoPrograma, exercicio): Alvo
estadoInicial(exercicio, prescricao?): EstadoExercicio
incrementoDe(exercicio, estado?): number
cargaDeHoje(exercicio, estado | null, prescricao?, opcoes?): AlvoDeHoje
decidir(exercicio, estado | null, seriesTrabalho, contexto?): Decisao
// Decisao = { novoEstado, evento: { motivo, de, para, falha?, aviso?, sugestao? } | null }
// contexto = { prescricao?, ultimaFirme?, sessaoAbandonada?, seriesAnteriores?, montagem? }
PASSO_MINIMO_KG = 2 · SESSOES_DE_GRACA = 2 · DEGRAUS_ASSISTENCIA
```

`EstadoExercicio` é a linha de `exercise_state` sem as colunas de identidade, e
`SerieFeita` é o mínimo que o motor precisa de uma série (concluída, reps,
`reps_lado2`, tempo, `tempo_s_lado2`, passos, carga, assistência, tipo).

### `lib/calendario.ts` — o que é hoje (SPEC §5)

```ts
diaDaSemana · inicioDaSemana · diasDaSemana · iso · paraData · semanaDaFase
tipoDoDia(data, fase, overrides?) · proximoTreinoAlternado(ultimo)
treinoDeHoje(data, perfil, overrides?): DiaDoPlano
sessaoCardioDeHoje(data, perfil, overrides?): SessaoCardioDoDia | null
semanaDoPlano(data, perfil, overrides?): DiaDoPlano[]
avancarSemanaCardio(semanaAtual, sessoesDaSemanaCivil, opcoes?)
  + avancarSemanaDeCorrida / DeCorda / DeBarraFixa (com o teto de 12 semanas)
sugerirFase2(perfil, sessoesConcluidas, hoje) · adiarFase2(hoje)
treinosComAgachamentoOuTerra(): TreinoId[]
semanaCurta(diasIndisponiveis, semanaPlanejada): ResultadoSemanaCurta
oQueFaltaNaSemana(semanaPlanejada, realizados, hoje)
```

`PerfilCalendario` é um subconjunto de `profiles` (fase, último treino, semanas
dos planos, `prefs`), então a linha do banco serve direto.

### Decisões de interpretação (onde a spec deixava margem)

- **Topo efetivo da faixa.** Para os tipos `reps` e `tempo`, o alvo de subida é
  `max(topo da prescrição, alvo guardado no estado)`. É o que faz o caso 16
  fechar (prancha com alvo 30 e faixa 30–60 → 60 nas três séries → 65 s) e o
  caso 17 (elevação de pernas com alvo 10 e faixa 10–15 → 15 nas três → 16). Na
  primeira vez o estado guarda o **piso** da faixa, como diz a §6.1; a tela
  pré-preenche o topo (`AlvoDeHoje.alvo_max`).
- **Semana leve.** A 3ª falha já grava a carga leve em `carga_atual_kg` e
  guarda a anterior em `carga_antes_leve`; `cargaDeHoje` recalcula os 60 % a
  partir dela (mesmo resultado, à prova de estado inconsistente). A sessão da
  semana leve **sempre** termina com a volta à carga anterior (evento
  `fim_semana_leve`), independente de como ela foi — é o que diz o caso 9.
- **Mudança de degrau do elástico** emite motivo `subiu` (é o que o caso 13
  pede); `trocou_assistencia` fica reservado para a troca manual no perfil.
  Chegando em "sem elástico", a subida vira `repetiu` com a sugestão de passar
  para a barra fixa com lastro.
- **Graça** (`sessoes_graca`) é genérica: enquanto for > 0, uma queda vira
  "repetiu" em vez de falha, e cada sessão avaliada consome uma.
- **Exercícios sem carga** (peso corporal, reps, tempo, assistência) acumulam
  falhas mas não têm o que reduzir: a 2ª e a 3ª falha repetem o alvo e a 3ª zera
  o contador — não existe "60 % do peso do corpo".
- **`exigir_rep_extra`** só é ligado quando `incremento ÷ 2` cai abaixo do passo
  mínimo de 2 kg (caso 5: 2 kg continuam 2 kg, mas a subida passa a exigir topo
  + 1 rep). O agachamento (4 kg) só tem o incremento reduzido (caso 6).
- **Teto do kit**: a subida que não cabe na escala vira `repetiu` com
  `aviso: "faltam anilhas de 10 kg (marco do guia)"` (caso 22).
- **Tipo `maximo`**: sucesso = média ≥ média anterior + 1 **e** nenhuma série
  abaixo da correspondente; média igual ou maior sem isso = `repetiu`; média
  menor = falha. A sessão sem referência anterior só registra a média em
  `reps_alvo` e não gera evento. O comparativo série a série vem em
  `contexto.seriesAnteriores` (a última sessão do exercício), porque o banco não
  guarda isso no estado.
- **Sugestões não mexem no estado**: passar de 20 reps em todas as séries ou
  chegar a 3 × 10 na barra fixa gera `evento.sugestao` (anilha de 2 kg, lastro),
  e quem decide é o usuário.
- **Sessão abandonada**: só avalia o exercício se todas as séries prescritas
  estiverem registradas. Numa sessão **concluída**, série faltando ou sem
  repetições conta como falha.
- **Unilateral**: vale sempre o menor lado, em reps e em tempo.
- **Semana curta**: os dias disponíveis (inclusive os de descanso) são as vagas;
  o que cabe é remanejado (cada atividade fica no próprio dia quando dá, senão
  vai para o primeiro dia livre) e só se corta o que não couber, na ordem do
  guia — cardio de trás para a frente, depois força não protegida, e os treinos
  com agachamento/terra (`A1, B1, IA, IB`, derivados dos dados) por último.
  Sobrando um dia, o que resta é o Treino A.
- **Fase 2**: a sugestão exige 12 semanas civis completas e 30 sessões, e some
  por 2 semanas quando adiada (`prefs.fase2_adiada_ate`).
- **Barra W e barra reta oca** têm `peso_kg: null` no JSON; até serem pesadas
  valem 2,0 kg (`PESO_BARRA_A_PESAR`, o valor dos casos de teste) e toda função
  aceita `{ pesoBarra }` para quando o Miguel pesar.

### Mudanças no schema (`supabase/schema.sql`)

- `session_sets.tempo_s_lado2 int` — unilateral em tempo (prancha lateral)
  precisa dos dois lados, como `reps_lado2` faz para repetições.
- `exercise_state.sessoes_graca` passou a ter **default 0** (era 2): a graça só
  existe depois de mudar o degrau do elástico, e é o motor que põe 2.
- Correção em `lib/dados.ts`: `estagioDeCorda(semana)` estava usando a semana
  como índice da lista; agora casa com a faixa ("1–2", "3–4", … "9–12"), igual a
  `semanaDeBarraFixa`.

### Testes

- `lib/montagem.test.ts` (27): a tabela inteira de cargas válidas e inválidas,
  os 5 exemplos de chamada do documento, os limites de estoque e uma varredura
  da escala (7,5 → 107,5 e 1,5 → 39,5 sempre exatos; 1 kg acima cai para a
  vizinha inferior; todo inteiro de 0 a 100 fecha no pino).
- `lib/progressao.test.ts` (45): os 22 casos do documento, um a um e com o
  número do caso no nome, usando os exercícios reais do catálogo; mais tempo,
  passos, unilateral em tempo, `maximo` com queda, assistência até "sem
  elástico", semana leve seguida de subida, aquecimento ignorado e o estado
  recebido nunca sendo alterado.
- `lib/calendario.test.ts` (21): 14/09/2026 é segunda e é o Treino A1; terça é
  corrida da semana 1 (8 × 1/2 min); alternância A→B→A e B→A→B; override
  vencendo o programa; Fase 2 com SA/IA/SB/IB nos dias fixos; semana curta com
  os casos do guia; avanço de semana com 0, 1 e 2 sessões; sugestão da Fase 2.

### Auditoria (rodada 1) — o que os auditores acharam e o que mudou

Três auditorias adversariais independentes (`lib/auditoria-casos.test.ts`,
`lib/auditoria-spec.test.ts`, `lib/auditoria-bordas.test.ts`, 149 testes novos)
apontaram 6 defeitos reais. Em todos o motor estava errado; só um teste do
construtor codificava o erro e foi corrigido.

1. **Sugestão do lastro presa ao sucesso** (SPEC §6.3, caso 15). A sugestão
   "barra fixa com lastro" só saía dentro do ramo de sucesso de
   `decidirMaximo()`: quem empacava em 3 × 10 (média igual) nunca a via — o
   cenário em que ela mais serve. Agora ela depende só de 3 séries ≥ 10 e
   acompanha qualquer evento (`subiu`, `repetiu`, falha). Passou a valer apenas
   para a progressão `reps_depois_lastro` (barra fixa, conforme
   `data/exercicios.json`), não para flexão e mergulho.
2. **Sugestão da anilha presa ao sucesso** (SPEC §6.3, caso 17). Mesma causa em
   `subir()`. Saiu para `decidir()` em `sugestaoDaAnilha()`: acima de 20 reps em
   todas as séries a sugestão é emitida mesmo quando o exercício repetiu.
3. **`cargaDeHoje().tempo_alvo_s` e `.passos_alvo` traziam o topo da faixa**
   (SPEC §6.1). Os dois campos têm o nome da coluna `exercise_state` e agora
   carregam o mesmo valor que ela: o piso na primeira vez (prancha 30 s, farmer's
   walk 30 passos). O topo que a tela pré-preenche está em `alvo_max` (e no par
   `reps_alvo_min`/`reps_alvo_max`). `lib/progressao.test.ts` esperava 60 s e foi
   corrigido citando a §6.1.
4. **"faltam anilhas de 10 kg" em teto de capacidade** (SPEC §6.4). O aviso saía
   sempre que o pedido passava do teto, inclusive quando o teto é a capacidade
   da barra (halter 40 kg, barra W 50 kg, polia 100 kg) — mandando comprar
   anilhas que não sobem 1 kg. `lib/montagem.ts` ganhou `limiteDoImplemento()`
   ("estoque" quando o estoque inteiro ainda caberia na barra, "capacidade" caso
   contrário) e `capacidadeDoImplemento()`; a `Montagem` expõe `limite` e só
   emite o aviso quando faltam anilhas mesmo (109,5 na barra maciça). No motor,
   `avisoDeTeto()` escolhe entre "faltam anilhas de 10 kg (marco do guia)" e "no
   limite do implemento (capacidade X kg): comprar anilhas não sobe a carga".
5. **Séries de trabalho além da prescrição eram descartadas** (SPEC §6 e §6.2).
   `decidir()` lia só as `prescricao.series` primeiras: uma 4ª série de 3 reps
   (piso 5) ou não concluída sumia e o exercício ainda subia de carga —
   alcançável na Fase 2, que pede 4 séries onde o catálogo pede 3. Agora avalia
   `max(prescricao.series, séries registradas)`.
6. **Média do tipo `maximo` comparada em ponto flutuante** (SPEC §6.3). Com
   dízima (10/3 + 1 > 13/3 em binário), +1 rep em **todas** as séries não subia
   em ~1/3 das sessões da barra fixa. A comparação passou a ser inteira:
   `somaAgora × nAntes ≥ (somaAntes + nAntes) × nAgora`.
7. **`carga_atual_kg` null na 2ª falha** (SPEC §6.1 + §6.2). `subir()` caía na
   `carga_inicial` do JSON e `falhar()` tratava como exercício sem carga, então
   a 2ª falha seguida não aplicava os −10 %. `falhar()` passou a ler o estado do
   mesmo jeito que `subir()`.

Nenhum teste de auditoria foi apagado ou afrouxado.

### Auditoria (rodada 2) — o que os auditores acharam e o que mudou

Segunda rodada adversarial sobre os mesmos três arquivos (349 testes no total).
Foram 10 achados e **nos 10 o motor estava errado**: nenhum teste de auditoria
foi corrigido, apagado ou afrouxado.

`lib/calendario.ts`

1. **Semana curta não garantia o Treino A** (SPEC §5.4 + `programa.json`
   `semana_curta.regra`). Sobrando uma vaga só, `semanaCurta()` mantinha o que
   caiu na segunda-feira; na Fase 1 esse treino sai da alternância, então com
   `ultimo_treino = "A1"` o único dia da semana virava B1 — o treino do
   levantamento terra. Agora, sobrando **um único treino de força na Fase 1**,
   ele é o Treino A completo (`realinharAlternancia()`).
2. **O remanejamento quebrava a alternância** (SPEC §5.2 item 3). Mover a
   atividade do dia indisponível para o primeiro dia livre mantinha o treino já
   calculado: marcando só a segunda, o A1 ia para a quinta e a sexta continuava
   A1 — dois Treinos A seguidos. A mesma `realinharAlternancia()` refaz a
   alternância em ordem cronológica a partir do primeiro treino que ficou.
3. **Minutos do cardio vinham do dia, não da semana do plano** (SPEC §3.1
   "card da sessão da semana atual … 34 min" + §5.2 item 4). `min` saía sempre
   do valor fixo de `programa.fases[].semana[]`; da semana 7 em diante o plano
   diverge (31, 33, 30, 34, 40, 45 min) e com corda a diferença é maior ainda.
   Passou a vir de `cardio.json` (`sessao_min` da semana de corrida ou do
   estágio de corda), caindo no valor do dia só quando o plano não tem sessão.
4. **Override herdava `min` e `nota` do dia substituído** (SPEC §5.2 item 1).
   Uma segunda virada em cardio reportava os 44 min do Treino A; uma quinta
   virada em força carregava a nota do grease the groove, que a §5.2 item 5
   prende ao descanso. Com override, `nota` é `null` e `min` vem de quem manda
   no dia: `treino.duracao_min` (44 no A1, como pede a §10.2) ou a sessão de
   cardio da semana.

`lib/progressao.ts`

5. **Uma falha podia AUMENTAR a carga** (SPEC §6.2 + §6.4).
   `alcancavelParaBaixo()` devolve o mínimo da escala quando o alvo fica abaixo
   dela, então com uma carga do banco abaixo da barra vazia (5 kg na maciça) a
   2ª falha "caía" para 7,5, e com a barra W pesada (`{ pesoBarra: 4.8 }`) a 2ª
   falha e a semana leve subiam de 2,0 para 4,8 kg. `falhar()` ganhou
   `reduzir(fator) = min(carga, alcancavelParaBaixo(carga × fator))`: reduzir
   nunca sobe.
6. **`cargaDeHoje()` ignorava o fallback da §6.1** que `decidir()` aplica.
   `exercise_state.carga_atual_kg` e `.assistencia` são anuláveis no schema;
   a tela ficava sem carga, sem chips de anilhas e sem degrau do elástico
   enquanto o motor subia para 9,5 kg "a partir do nada". Agora a carga cai na
   `carga_inicial.kg` do JSON e a assistência em `pe_inteiro`, exatamente como
   `subir()`/`falhar()`/`proximoDegrau()` já faziam.
7. **A carga do dia podia não existir na escala** (SPEC §6.4 + §6.5 + §10.5).
   Com a barra W pesada na balança a escala vira 4,8 + 2k, mas a carga inicial
   de 2,0 kg do JSON não era reprojetada: a tela mostrava "2,0 kg" com a
   montagem de 4,8 (`exato: false`, diferença +2,8) — uma carga que não se
   monta. `cargaDeHoje()` passou a projetar a carga do dia (inclusive a da
   semana leve) com `alcancavelParaBaixo` nas mesmas opções da montagem.
8. **3 × 10 na primeira sessão não sugeria o lastro** (SPEC §6.3, caso 15). O
   atalho "sem referência anterior" de `decidirMaximo()` saía antes do cálculo
   de `tresNoTeto` e devolvia `evento: null` — o mesmo acoplamento que a rodada
   1 desfez nos outros ramos. A sugestão foi movida para antes do atalho; sem
   sugestão o evento continua nulo (a primeira sessão só registra a média).

Achados 1 e 6 do relatório eram o mesmo defeito visto por duas lentes (semana
curta / Treino A), assim como 5 e 9 (carga inicial fora da escala do implemento
depois de pesar a barra).

### Auditoria (rodada 3) — o que os auditores acharam e o que mudou

Terceira rodada adversarial sobre `lib/auditoria-casos.test.ts`,
`lib/auditoria-spec.test.ts` e `lib/auditoria-bordas.test.ts`. Foram 6 achados:
**nos 6 o motor estava errado**. Três testes de auditoria de rodadas anteriores
codificavam o limiar antigo da anilha e foram corrigidos (nenhum apagado nem
afrouxado), porque contrariavam a SPEC §6.3.

`lib/progressao.ts`

1. **A anilha era sugerida COM 20 reps, não acima de 20** (SPEC §6.3 "acima de
   20 reps em todas as séries" + `progressao.regra` do JSON, "quando passar de
   20"). Com `>= 20` a sugestão saía no piso da faixa 20–30 do abdominal
   bicicleta ("volte ao piso da faixa" para quem já está nele), na primeira
   sessão perfeita do russian twist (3 × 20 fechado, e ele já segura uma anilha
   de 5 kg) e uma repetição cedo em outros quatro exercícios. Agora o gatilho é
   `> 20`. O `≥ 20` do caso 17 de `docs/casos-de-teste-progressao.md` era uma
   abreviação e ficou explícito no doc ("se todas passarem de 20").
2. **Aviso de teto falso com incremento curto** (SPEC §6.4 + §3.9). `subir()`
   tratava qualquer subida que não mudasse de degrau na escala como teto do
   implemento: com um override em `exercise_state.incremento_kg` menor que o
   passo (0, 1 ou 1,5 kg numa escala de 2 kg) o app dizia "faltam anilhas de
   10 kg (marco do guia)" com a barra vazia a 7,5 kg, e "no limite do implemento
   (capacidade 40 kg)" com o halter a 11,5 kg. O aviso da §6.4 passou a
   depender de a carga estar de fato no topo da escala
   (`cargaMaxima(implemento)`); fora do topo sai uma **sugestão** explicando que
   o incremento não chega ao próximo degrau e quantos kg faltam — a carga
   continua a mesma (os dois achados, lente spec e lente bordas, eram o mesmo
   defeito).
3. **Exercício de elástico recebia conselho de barra fixa** (SPEC §6.3 + regra
   do JSON). No degrau "sem", o ramo `assistencia` mandava "passe para a barra
   fixa com lastro" para qualquer exercício — inclusive `abertura-de-ombros` e
   `good-morning-com-elastico` (implemento `band`), cujo JSON só fala em reduzir
   a ajuda do elástico. A saída para o lastro ficou restrita ao implemento
   `barra_fixa`; nos demais a sugestão é trocar por uma variação mais difícil.
4. **Semana leve: a tela pedia uma carga e o estado guardava outra** (SPEC §6.2,
   §6.4 e §6.6). `cargaDeHoje()` recalculava os 60 % a partir de
   `carga_antes_leve` sem o teto "reduzir nunca sobe" que `falhar()` aplica
   desde a rodada 2, e ainda projetava o resultado na escala. Com a carga
   guardada abaixo da escala atual (barra W pesada depois, §3.9, ou linha antiga
   do banco) dava estado 2 kg × tela 6 kg. Agora os 60 % da tela usam o mesmo
   `min(carga_antes_leve, alcancavelParaBaixo(...))` do evento gravado.

`lib/calendario.ts`

5. **Fase 2: dia trocado para força ficava sem treino** (SPEC §3.5, §5.2 e
   §5.3). `treinoDoDia()` lia só o treino fixo do dia da semana; num
   `schedule_override` de tipo `forca` com `workout_id` nulo (quarta de cardio,
   domingo de descanso) o dia voltava com `treinoId: null` e a tela Hoje ficava
   com um card de força sem treino, sem exercícios e sem tempo. Entrou
   `proximoTreinoDaFase(fase, ultimo)` — o próximo treino da lista da fase
   depois de `ultimo_treino` (§5.3) — usado como fallback na Fase 2 e como base
   de `proximoTreinoAlternado()` na Fase 1 (mesmo comportamento de antes).

Testes de auditoria corrigidos (com a citação da §6.3 no comentário): caso 17 em
`auditoria-casos.test.ts` (duas ocorrências) e caso 17 em
`auditoria-bordas.test.ts` — todos passaram de "20 sugere" para "21 sugere, 20
não".

### Auditoria (rodada 4) — o que os auditores acharam e o que mudou

Quarta rodada adversarial sobre os mesmos três arquivos. Foram 6 achados
(um deles com três testes) e **nos 6 o motor estava errado**: nenhum teste de
auditoria foi corrigido, apagado ou afrouxado.

`lib/progressao.ts`

1. **Tipo `maximo` subia sem a "última repetição firme"** (SPEC §6.2 + §3.2).
   `decidirMaximo()` ignorava `contexto.ultimaFirme`: com o toggle desligado o
   supino repetia (certo) e a barra fixa pronada subia (errado), em 5 exercícios
   do catálogo. O preâmbulo da §6.2 manda consultar a §6.3 só para definir
   `alvo_max` do tipo `maximo`; o "e `ultima_firme = true`" do Sucesso vale para
   todos os tipos, e a §3.2 diz que "é esse toggle que o motor usa". Agora
   `firme` é calculado antes do desvio do tipo `maximo` e entra na condição de
   sucesso dele: sem firme a sessão vira `repetiu` e a média nova não é gravada.
2. **O motor decidia sobre o valor cru do banco, a tela sobre a escala**
   (SPEC §6.2, §6.4, §3.9, §10.5 — uma causa, três sintomas). `cargaDeHoje()`
   projeta a carga com `alcancavelParaBaixo` desde a rodada 2; `subir()` e
   `falhar()` partiam de `exercise_state.carga_atual_kg` como veio do banco.
   Com a barra W pesada (§3.9) a sessão perfeita "subia" para a mesma carga de
   hoje (4,8 → 4,8; 5,2 → 5,2) e o evento da §6.6 publicava "de 2 kg"; com a
   linha em 120 kg a tela mostrava 107,5 e o estado guardava 120; com 5 kg na
   maciça a subida ia de 7,5 para 7,5 em vez de 9,5; e a 2ª falha gravava 4 kg,
   fora da escala 5,2 · 7,2 · … Agora `decidir()` projeta `carga_atual_kg` e
   `carga_antes_leve` na escala **uma vez**, antes de qualquer conta, foto ou
   evento (mesmas `opcoes` de montagem que a tela usa), e os fallbacks de
   `carga_inicial.kg` em `subir()`/`falhar()` também passam pela escala. Um
   treino inteiro de sucesso deixou de se perder em cada exercício de barra W.

`lib/calendario.ts`

3. **A semana curta desfazia o treino escolhido à mão** (SPEC §5.2 item 1 com
   §5.4 e §3.5). `realinharAlternancia()` reescrevia `treinoId` e `min` de todos
   os dias de força da Fase 1, inclusive o que veio de um `schedule_override`
   com `workout_id` explícito — mesmo sem cortar nem remanejar o dia: a quarta
   escolhida como B1 (45 min) voltava a A1 (44 min) em silêncio. Agora
   `DiaDoPlano` carrega `treinoEscolhido` (override **com** `workout_id`; um
   override sem `workout_id` continua valendo "o próximo treino", §5.3), esses
   dias são âncoras fixas e a alternância se reencadeia ao redor deles — para
   trás e para frente, para não deixar dois treinos iguais seguidos.
4. **Acima do teto do plano, cumprir as 2 sessões DIMINUÍA a semana**
   (SPEC §5.5 com §3.3/§3.9). Com a semana ajustada à mão no perfil (13 num
   plano de 12), `avancarSemanaCardio(13, 2)` devolvia 12 e `(13, 0)` devolvia
   13 — fazer valia menos que não fazer, nas três funções (corrida, corda, barra
   fixa). O clamp agora é `max(semanaAtual, min(semanaAtual + 1, maximo))`:
   segura o avanço no teto, nunca puxa a semana para trás.

Testes do construtor acrescentados (nenhum corrigido): `maximo` sem firme e a
carga projetada em `lib/progressao.test.ts`; override fixo, override sem
`workout_id` e o teto do plano em `lib/calendario.test.ts`.

### Auditoria (rodada 5) — o que os auditores acharam e o que mudou

Quinta rodada adversarial sobre os mesmos arquivos. Foram 4 achados e **nos 4 o
motor estava errado**; um teste do construtor codificava o defeito do achado A e
foi corrigido citando a seção (nenhum teste de auditoria apagado ou afrouxado).

`lib/progressao.ts`

1. **Semana leve: os 60 % saíam do valor CRU de `carga_antes_leve`**
   (SPEC §6.4 + §6.5 + §10.5 + §6.6, cenário da §3.9). `decidir()` projeta
   `carga_atual_kg` e `carga_antes_leve` na escala desde a rodada 4, mas essa
   projeção nunca chegou ao ramo da semana leve de `cargaDeHoje()`: o
   `Math.min(carga_antes_leve, alcancavelParaBaixo(carga_antes_leve × 0,6))`
   devolvia o próprio valor cru quando ele estava **abaixo** da escala. Com a
   barra W pesada na balança (4,8 kg, §3.9) e a linha gravada antes com 2 kg, a
   tela pedia 2 kg e a montagem da §6.5 vinha com `exato: false` e diferença
   **positiva** (+2,8) — contra o contrato "diferença sempre ≤ 0" — enquanto
   `decidir()` gravava 4,8 (§6.6 quebrada). O mesmo com linha importada de
   backup (§9, 5 kg na maciça → 7,5) e com linha acima do teto do kit (120 →
   107,5 → 60 % = 64,5 → **63,5**, e não 71,5). Agora `carga_antes_leve` passa
   por `alcancavelParaBaixo` (mesmas `opcoes` da montagem) **antes** do `× 0,6`
   e do `min`, exatamente como `decidir()` faz.

`lib/calendario.ts`

2. **Depois da semana curta o primeiro treino repetia o último feito**
   (SPEC §5.2 item 3 com §5.4). `realinharAlternancia()` ancorava a escada da
   Fase 1 no treino que sobrou no **primeiro dia disponível** depois do remanejo
   (`forca[0].treinoId`). Quando o dia marcado como "não vou treinar" é o
   primeiro dia de força da semana, o segundo treino da escada virava a âncora:
   com `ultimo_treino = "B1"` a semana planejada A1(seg)/B1(qua)/A1(sex) virava
   B1(qua)/A1(qui)/B1(sex) — B1 logo depois de um B1, e a semana com dois
   treinos de terra e um de agachamento. É o defeito que a rodada 2 (achado 2)
   corrigiu **dentro** da semana, atravessando a virada da semana. `semanaCurta()`
   passa agora a âncora que a semana **planejada** já tinha derivado de
   `profiles.ultimo_treino` (o primeiro dia de força da Fase 1 de
   `semanaPlanejada`); o override com `workout_id` continua tendo prioridade
   (rodada 4) e "sobrou um dia só → Treino A" também (rodada 2).
3. **O treino do dia marcado era remarcado para um dia que já passou**
   (SPEC §3.5 com §5.4). O remanejo mandava a atividade para
   `disponiveis.find(x => !ocupado.has(x.dia))` — o primeiro dia livre na ordem
   seg→dom, **inclusive antes** do dia marcado. Como o gatilho é marcar "não vou
   treinar **hoje**", esse dia já passou: marcando a sexta na Fase 1, o treino
   ia para a quinta e o domingo (livre, depois da sexta) ficava vazio. Agora o
   remanejo prefere um dia livre **posterior** ao dia marcado e só cai num
   anterior quando não existe nenhum depois (o laço de corte já garante a
   capacidade).

`lib/formato.ts` + `lib/montagem.ts` (fora dos três arquivos do motor, mesmo
defeito de convenção)

4. **O implemento `anilha` era rotulado "na barra"** (SPEC §4: "mostrar sempre o
   rótulo certo na tela"). `rotuloDaCarga()` tratava halteres, polia, barra fixa
   e peso corporal e mandava todo o resto para o default "na barra" — inclusive
   os três exercícios de `anilha` do catálogo (abdominal com anilha e russian
   twist com 5 kg, mergulho no banco com 0), em que a carga é a anilha segurada
   contra o peito e não existe barra nenhuma. Agora `anilha` → "na anilha",
   `band` → "com elástico", `corda` → "peso do corpo", e `lib/montagem.ts` ganhou
   o lugar `naAnilha` (antes `anilha` era classificada como `naMochila`, o lastro
   da barra fixa).

Teste do construtor corrigido: `lib/calendario.test.ts` > "override sem
`workout_id` segue a alternância" esperava `["A1", "B1", "A1"]` com
`ultimo_treino = "A1"` — a semana recomeçando pelo treino já feito, exatamente o
achado 2. Passou a esperar `["B1", "A1", "B1"]` com a citação da §5.2 item 3 no
comentário. Testes do construtor acrescentados: semana leve projetada em
`lib/progressao.test.ts`, âncora da alternância e remanejo para dia posterior em
`lib/calendario.test.ts`, rótulo do `anilha` em `lib/formato.test.ts`.

### Auditoria (rodada 6, a segunda da rodada final) — o que os auditores acharam e o que mudou

Três achados da lente "bordas". **Em dois o motor estava errado** e num terceiro
o motor estava certo pela metade: o defeito era real, mas o valor esperado pelo
auditor contrariava a própria §6.1 que ele citava — o teste foi corrigido com a
citação no comentário (nenhum teste apagado ou afrouxado).

`lib/progressao.ts`

1. **A foto do evento lia as colunas anuláveis de `exercise_state` cruas**
   (SPEC §4 + §6.6 com §6.1). `foto()` era o único ponto do motor sem os
   fallbacks da §6.1 que `cargaDeHoje()` (rodada 2) e `subir()`/`falhar()`
   (rodada 1) já aplicavam, e a projeção na escala da rodada 4 não a alcançava
   porque estava atrás de `if (antes.carga_atual_kg !== null)`. Com
   `carga_atual_kg = null` a tela mostrava 7,5 kg e o evento gravado saía
   `de: {carga_kg: null}`; no ramo `repetiu`, `de` e `para` saíam os dois nulos
   **e o estado continuava nulo**, então a linha do tempo da §6.6 não registrava
   nada e o caso se repetia em toda sessão seguinte. A §4 exige que
   `progression_events` explique "por que hoje é 26,5 kg", e `de: null` não
   explica nada. Agora `decidir()` aplica, antes de qualquer conta ou foto, os
   fallbacks das **quatro** colunas anuláveis (`carga_atual_kg`, `reps_alvo`,
   `tempo_alvo_s`, `assistencia`) a partir de `estadoInicial()`: a linha com a
   coluna nula passa a se comportar exatamente como a linha que ainda não
   existe.

`lib/montagem.ts`

2. **No teto do lastro o app mandava não comprar anilhas** (SPEC §6.4). No
   lastro (`barra_fixa`, `peso_corporal`, `anilha`) não existe barra nem pino: a
   "capacidade" do `Config` era literalmente `equipamentos.anilhas.total_kg`
   (100 kg = o estoque inteiro), e o empate `estoque === capacidade` caía no
   lado errado do `<` de `limiteDoImplemento()`. Resultado: `montagem(101,
   "barra_fixa")` devolvia as 24 anilhas do estoque com `limite: "capacidade"` e
   **sem aviso**, e a barra fixa com lastro a 100 kg numa sessão perfeita dizia
   "no limite do implemento (capacidade 100 kg): comprar anilhas não sobe a
   carga" — o contrário do que a §6.4 manda, porque na mochila comprar anilhas
   sobe a carga. O `Config` ganhou `capacidadePropria`: `false` no lastro e na
   anilha segurada (o teto é o estoque, sempre `"estoque"`), `true` nas barras,
   nos halteres e na polia — onde o mesmo empate 100 == 100 continua
   `"capacidade"`, porque lá o teto é do pino (§6.4 "Polia: 100 kg no pino").

Teste do auditor corrigido (motor certo): em
`lib/auditoria-bordas.test.ts` > "ACHADO A — o mesmo com `assistencia`,
`reps_alvo` e `tempo_alvo_s` nulos", o achado esperava
`de: {reps_alvo: 15}` e `de: {tempo_alvo_s: 60}` (o **topo** da faixa). A §6.1
diz "Primeira vez no exercício: … reps/tempo alvo = **mínimo** da faixa",
`estadoInicial()` grava o mínimo e o próprio `cargaDeHoje()` citado no achado
devolve `tempo_alvo_s: base.tempo_alvo_s ?? prescricao.min` (30, não 60). O
esperado virou `{reps_alvo: 10}` e `{tempo_alvo_s: 30}`, com a citação no
comentário e com a asserção extra de que a coluna nula dá o mesmo evento que
`estado = null`. A parte real do achado (o `null`) foi corrigida no motor; o
topo (15 / 60) continua sendo o alvo a bater, que aparece em `para` somado ao
incremento (16 / 65).

### Como testar

`npm test` (417 testes: 137 do construtor + 280 das três auditorias, seis
rodadas) e
`npm run build`. Ainda não há tela ligada ao motor: a sessão de força (marco 3)
é quem vai chamar `cargaDeHoje` no cabeçalho de cada bloco e `decidir` ao
concluir o treino. Atenção na UI: para pré-preencher reps/tempo/passos use
`alvo_max`, não `tempo_alvo_s`/`passos_alvo` (que são o estado, §6.1).
