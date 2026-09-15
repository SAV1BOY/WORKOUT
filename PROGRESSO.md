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

---

## Harness E2E — testar o app inteiro sem Supabase ✅

Ainda não existe projeto Supabase (nem `.env.local`), então nada do fluxo real
— login, RLS, gravação, storage — tinha sido testado de verdade. Este marco
fecha esse buraco com um **Supabase de mentira local** e testes Playwright num
Chromium emulando celular.

### O que foi feito

- **`scripts/mock-supabase.ts`** — servidor HTTP só com `node:http` (nenhuma
  dependência nova; roda com `tsx`), estado em memória, porta
  `MOCK_SUPABASE_PORT` (padrão 54321), `MOCK_LOG=1` para uma linha por
  requisição. **Fora de `app/`, `lib/` e `components/`**: nada do app o importa.
  - **Auth (GoTrue)**: `signup`, `token?grant_type=password`,
    `token?grant_type=refresh_token`, `GET|PUT /user`, `logout`, `settings`,
    `jwks.json`. O access token é um JWT HS256 de verdade (`sub`, `email`,
    `role: authenticated`, `exp` de 1 h) — supabase-js valida a expiração
    sozinho, então um token de mentira não serviria. Criar usuário dispara o
    equivalente ao trigger `handle_new_user`: nasce a linha em `profiles`.
  - **PostgREST**: todas as 11 tabelas de `supabase/schema.sql` e a view
    `v_records` (calculada de `session_sets`, somente leitura), com `select`,
    filtros `eq/neq/gt/gte/lt/lte/in/is/like/ilike` (+ `not.`), `order` com
    `nullsfirst/nullslast`, `limit`/`offset`/`Range`, `Prefer` (`return=`,
    `resolution=merge-duplicates` com `on_conflict` pelas **chaves reais**,
    `count=exact` → `Content-Range`), `Accept: …pgrst.object+json` (406 fora de
    1 linha) e os defaults do schema (uuid, `now()`, `current_date`, `status`,
    `prefs`…).
  - **RLS simulada**: sem token → 401; com token, leitura filtrada por `user_id`
    e escrita com o `user_id` da sessão (outro `user_id` → 403). No bucket, o
    caminho tem que começar com `<user_id>/`, como a policy do schema.
  - **Storage**: upload (`POST`/`PUT`), download `authenticated`/`sign`/`public`,
    URL assinada, `list`, `delete` e `remove` em lote.
  - **Controle**: `GET /__mock/health`, `GET /__mock/estado`,
    `POST /__mock/reset`, `POST /__mock/seed`.
  - **Nunca finge sucesso**: rota, tabela, coluna, operador ou `select` embutido
    desconhecido → 400 com `mock: … não implementado`.
- **`e2e/`** com `@playwright/test` **1.56.0 pregado** (é a versão que casa com o
  Chromium 141 / revisão 1194 já instalado em `/opt/pw-browsers`; nunca rodar
  `playwright install`).
  - `playwright.config.ts`: projeto único **"celular"** (360 × 740, `isMobile`,
    `hasTouch`, `deviceScaleFactor` 2, pt-BR, America/Sao_Paulo), `baseURL`
    `http://127.0.0.1:3100`, `webServer` subindo o mock **e** `next start -p 3100`
    com as três variáveis apontando para o mock, `reuseExistingServer` fora de CI.
  - `fixtures.ts`: `resetarMock`, `semear`, `estadoDoMock`, `sessaoNoMock`,
    `login(page)` (cria a conta permitida e entra), `fixarRelogio` (14/09/2026
    via `page.clock`) e `semRolagemHorizontal`.
  - `login.spec.ts` (6): e-mail de fora recusado com "Este app é pessoal." **e o
    mock sem receber nada**, criar conta → Hoje com o perfil semeado, senha
    errada traduzida, sair → login, rota protegida sem sessão → login, entrar de
    novo.
  - `shell.spec.ts` (8): navegação inferior com os 5 itens e alvos ≥ 44 px, cada
    rota abrindo com `aria-current` e sem rolagem horizontal, as rotas internas
    do marco 1, manifest válido (nome, `start_url`, `standalone`, ícones
    192/512/maskable existindo de verdade) e o `<link rel="manifest">`.
  - `mock.spec.ts` (8): o contrato do próprio mock, que os marcos 3+ vão usar —
    perfil do trigger, 401 sem token, 400 em recurso desconhecido, sessão de
    força com insert/filtros/ordem/`count`/`v_records`/PATCH, upsert por chave
    real e 406 do single, coluna fora do schema recusada, storage completo,
    semente e reset.
  - `e2e/README.md`: como rodar, como testar à mão no navegador e no celular, o
    que o mock faz e **as limitações** dele.
- **Scripts novos**: `npm run e2e` (`playwright test -c e2e/playwright.config.ts`),
  `npm run mock` (sobe só o mock) e `npm run dev:mock` (`next dev` já com
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `ALLOWED_EMAIL`
  apontando para o mock). `.gitignore` ganhou `test-results/`,
  `playwright-report/`, `blob-report/`.

### Decisões

- **O app não mudou uma linha.** Tudo que faltava para o fluxo real fechar foi
  implementado no mock (foi o combinado). O único ajuste fora de `e2e/` e
  `scripts/` foi o `package.json` e o `.gitignore`.
- **`npm run e2e` não builda.** Ele reaproveita o `.next/` e sobe `next start`,
  que é o que a gente quer testar (o service worker do Serwist só existe no
  build de produção). Ordem: `npm run build && npm run e2e`.
- **`@playwright/test` pregado em 1.56.0**, sem `^`: com `^` um `npm install`
  futuro traria uma versão que quer outra revisão de Chromium e não acharia o
  browser (a máquina não pode baixar nada).
- **`workers: 1` e `fullyParallel: false`**: o mock é um processo só, com estado
  global — dois testes em paralelo se atrapalhariam no `reset`.
- **O config usa `__dirname`, não `import.meta.url`**: o Playwright transpila o
  config para CJS e `import.meta` quebra o carregamento.
- **`reuseExistingServer` fora de CI** é conveniente mas morde: um `next start`
  velho preso na 3100 (sem as variáveis) faz *todos* os testes falharem na tela
  "Configure NEXT_PUBLIC_…". Está anotado no `e2e/README.md`.
- **`NEXT_PUBLIC_*` é lido em tempo de execução**, conferido no build: o bundle
  do servidor guarda `process.env.NEXT_PUBLIC_SUPABASE_URL` sem inlining, então
  o mesmo `.next/` serve para o mock e para a Vercel.

### O que falta

- Os testes cobrem o que existe (marco 1 + shell). Cada marco novo entra aqui
  com o seu `*.spec.ts` — a sessão de força (marco 3) é a próxima, e o mock já
  tem tudo de que ela precisa (`sessions`, `session_sets`, `exercise_state`,
  `progression_events`, upsert e `v_records`).
- Quando o projeto Supabase existir, rodar `supabase/schema.sql` e repetir os
  mesmos fluxos contra ele: o mock imita o schema, não o substitui.

### Como testar no celular

1. `npm run build && npm run e2e` — 22 testes verdes num Chromium de 360 × 740.
2. Para ver com os próprios olhos, dois terminais: `npm run mock` e
   `npm run dev:mock`; abra `http://<ip-do-computador>:3000` no celular (troque
   `127.0.0.1` por esse IP nas variáveis do `dev:mock`, senão o celular não acha
   o mock).
3. **Criar conta** com `miguelgsaviotti29@gmail.com` e uma senha de 6+
   caracteres: entra direto (o mock autoconfirma). Qualquer outro e-mail tem que
   dar "Este app é pessoal." sem sair do login.
4. Navegue pelos 5 itens do rodapé; nada pode rolar para o lado e todo alvo tem
   ≥ 44 px. Em Mais → Sair volta ao login e `/progresso` não abre mais.
5. `curl -s localhost:54321/__mock/estado` mostra o que foi gravado.

### Auditoria do harness (rodada 1) — o que o auditor achou e o que mudou

Auditoria independente do marco: os quatro portões rodados do zero (`npm run
lint`, `npm run build`, `npm test` 417/417, `npm run e2e` 22/22 duas vezes
seguidas, sem instabilidade), o mock lido linha a linha e o app dirigido à mão
no Chromium a 360 × 740 contra o mock. **Três defeitos reais**: dois no mock, do
mesmo tipo — ele fingia sucesso onde o PostgREST de verdade devolve 400 — e um
na configuração do Playwright, que podia rodar a suíte inteira contra um build
velho.

`scripts/mock-supabase.ts`

1. **Coluna inventada passava batido** em `select`, em filtro e em `order`. Só a
   escrita (`POST`/`PATCH`) conferia as colunas contra o `ESQUEMA`; a leitura
   não conferia nada. `?coluna_inventada=eq.1` devolvia `200 []`,
   `?select=user_id,coluna_inventada` devolvia `{"coluna_inventada": null}` e
   `?order=coluna_inventada.desc` devolvia a lista sem ordenar — quando o
   PostgREST devolve 400 (`42703`). É o pior tipo de defeito para este harness:
   um erro de digitação numa query dos marcos 3+ apareceria como "não tem dado"
   em vez de quebrar o teste, e o `e2e/README.md` já prometia o contrário
   ("qualquer … coluna … que ele não conhece responde 400"). Entrou
   `colunasDe(recurso)` (colunas do `ESQUEMA` para as tabelas, `COLUNAS_VIEWS`
   para a `v_records`) e `exigirColuna()`, chamado em `filtrar`, `projetar` e
   `ordenar` — que agora recebem o nome do recurso.
2. **Operador inventado só falhava se a tabela tivesse linha.** A checagem de
   operador morava dentro de `passaNoFiltro()`, chamado de dentro de
   `Array.filter`: com a tabela vazia — o caso normal no começo de um teste —
   `?fase=xpto.fase1` devolvia `200 []`. A análise da expressão saiu para
   `analisarFiltro()`, que roda **uma vez por parâmetro**, antes de qualquer
   linha, e recusa o que não estiver na lista de operadores. `or=`/`and=`
   compostos (que o mock não faz) passaram a ter a própria mensagem em vez de
   caírem como "coluna inexistente".

`e2e/playwright.config.ts`

3. **`reuseExistingServer` podia fazer a suíte inteira testar o build errado.**
   Estava ligado fora de CI nos dois servidores, e a pendência anotada pelo
   construtor ("um `next start` velho na 3100 faz tudo falhar na tela Configure
   NEXT_PUBLIC_…") era só o caso fácil. O caso difícil apareceu nesta auditoria:
   um `next start` órfão **com as variáveis certas**, mas de **antes do último
   `npm run build`, serve o HTML apontando para o hash antigo do CSS. A página
   abre sem estilo nenhum, e o que quebra são os testes de alvo de 44 px
   ("botão Entrar menor que 44 px: 21") — um sintoma que aponta para o CSS do
   app, não para o servidor errado. Os dois servidores passaram a
   `reuseExistingServer: false`: porta ocupada agora é um erro claro do
   Playwright em vez de um resultado errado. (Detalhe que ajudou a achar: o
   processo se chama `next-server`, então `pkill -f "next start"` mata só o
   wrapper do npm e deixa o servidor vivo — está no `e2e/README.md`.)

Acrescentado também ao mock, para os testes poderem provar o negativo:
`/__mock/estado` agora traz **`requisicoes`** — método e caminho de tudo que
chegou desde o último reset (sem contar `/__mock`). Sem isso, "o app não chamou
o Supabase" só dava para checar por efeito colateral (nenhum usuário criado), o
que não distingue "não chamou" de "chamou e deu erro".

`e2e/auditoria.spec.ts` (9 testes novos, 31 no total) cobre o que faltava:

- e-mail de fora recusado **com zero requisições em `/auth/v1`** — nos dois
  botões, provado pelo log do mock;
- o e-mail permitido de fato chega ao `/auth/v1/signup` e cai na Hoje;
- **recarregar mantém a sessão** (na raiz e em `/progresso`);
- **toda** rota protegida sem sessão volta ao login, inclusive a raiz
  (`shell.spec.ts` só testava `/progresso`);
- sair derruba a sessão e o botão "voltar" do navegador não a ressuscita;
- entrar depois de criar a conta usa `/auth/v1/token` (e o sair, `/auth/v1/logout`);
- os dois defeitos acima, em regressão: coluna inventada em filtro/select/order
  (inclusive na view), operador inventado **com a tabela vazia**, filtro
  composto, e o 406 do `single` com 0 **e** com 2 linhas.

Conferido à mão no Chromium a 360 × 740 contra o mock (fora dos testes): login e
as cinco telas sem rolagem horizontal, `<html lang="pt-BR">`, campo de e-mail com
`type="email"`/`inputMode="email"` e 48 px de altura, navegação inferior `fixed`
terminando no rodapé (y 679 + 62 px) com `padding-bottom: 96px` no `<main>` — não
cobre conteúdo — e **nenhum erro no console**.

Conferido também que o mock não vaza para o app: nada em `app/`, `lib/` ou
`components/` cita `scripts/mock-supabase.ts`, `__mock` ou as variáveis do mock,
e `.next/server` e `.next/static` não contêm `mock-anon` nem `127.0.0.1:54321`
(o único lugar onde essas strings aparecem é o cache do webpack, que é o texto do
script `dev:mock` do `package.json` — gitignorado e fora do deploy).

Fora do escopo deste marco, anotado para quem mexer no motor: `lib/progressao.ts`
tem duas sugestões escritas no código ("passe para a barra fixa com lastro…") que
parafraseiam a `progressao.regra` de `data/exercicios.json`. A regra que o motor
**aplica** vem do JSON; só o texto da sugestão é do código.

### Como testar no celular (auditoria)

Igual ao do marco (`npm run build && npm run e2e`, agora **31** testes), mais:
`curl -s localhost:54321/__mock/estado | head -c 400` durante o `npm run dev:mock`
mostra a lista `requisicoes` — digite um e-mail que não é o seu na tela de login
e confira que **nada** aparece em `/auth/v1`.

---

## Marco 2 — Hoje e calendário ✅

A tela **Hoje** (SPEC §3.1) e o **calendário** (§3.5, §5) ligados de verdade ao
Supabase, com leitura por TanStack Query, cache persistido e escrita pela fila
de saída. Ainda **sem** o registro de séries: "Começar treino" leva a `/treinar`,
que continua em construção (marco 3).

### O que foi feito

**Adaptadores puros (com testes)**

- `lib/hoje.ts` — tudo que a tela Hoje mostra, como função pura:
  `resumoDoTreino` ("Treino A · 6 exercícios · 44 min"), `previaDoTreino`
  (chama `cargaDeHoje` por exercício com o `exercise_state` do banco e devolve
  a carga com o rótulo do implemento), `textoDoAlvo`, `textoDaCarga`,
  `textoDoEvento` ("subiu +2 kg no treino de 12/09", §6.6),
  `ultimoEventoPorExercicio`, `textoDoCardio`/`descricaoDoCardio`,
  `alternativaDeCorda`, `statusDoPeso`, `sequenciaDeTreinos`, `totalDeSoltas`,
  `sessaoAberta`, `avisoCorridaEPerna`, `houveCardioHoje`, `estadoDaLinha` /
  `estadosPorExercicio` (linha do banco → estado do motor).
- `lib/semana.ts` — o calendário: `montarGrade` (marca `feito` / `parcial` /
  `faltou` / `aberto` / `descanso` por dia, com o id da sessão para abrir),
  `rotuloDoDia`, `detalheDoDia`, `montarMes` (mês em miniatura, semanas seg–dom),
  `overridesDaSemanaCurta` (o resultado de `semanaCurta()` virando linhas de
  `schedule_overrides`, só dos dias que mudaram e só a partir do dia marcado) e
  `intervaloDaSemana`.
- 44 testes novos (`lib/hoje.test.ts`, `lib/semana.test.ts`); `npm test` fecha
  em **461**.

**Leitura (TanStack Query)**

- `lib/queries/dados.ts` — `usePerfil`, `useOverrides(de, ate)`, `useSessoes`,
  `useSessoesAbertas`, `useCardio(de, ate)`, `useUltimoPeso`, `useSoltasDoDia`,
  `useEstados(ids)`, `useEventos(ids)`. Erros em pt-BR ("Não consegui carregar
  …"). As chaves ficam em `chaves`.
- `lib/persistencia-query.ts` — cache persistido no IndexedDB (tabela `cache` do
  Dexie) com `dehydrate`/`hydrate` do próprio TanStack Query, guardado no
  máximo 1× por segundo e descartado depois de 7 dias. A tela abre com a última
  sincronização e atualiza em segundo plano (SPEC §8).
- `lib/relogio.ts` — `useHoje()`: **quem decide o dia é o aparelho**. Devolve
  `null` no servidor e no primeiro render (esqueleto), e reavalia a cada minuto
  e quando a aba volta.

**Escrita (fila de saída)**

- `lib/outbox-supabase.ts` — o enviador da fila: cada item é
  `{ tabela, op, linha, onConflict, filtro }` e vira `insert` / `upsert` /
  `update` / `delete` no Supabase. Erro lançado = a fila tenta de novo.
- `lib/queries/acoes.ts` — `registrarSolta` (+1 de barra fixa),
  `gravarOverrides` / `apagarOverride` (troca de dia e semana curta) e
  `descartarSessao`. Todas gravam no IndexedDB na hora, atualizam o cache do
  Query na mesma chamada (a tela responde igual sem rede) e geram o id no
  cliente com `crypto.randomUUID`.

**Telas**

- `/` (`components/hoje/`): faixa de status (fase · semana da fase, sequência de
  treinos concluídos, peso e há quantos dias, com o pedido de pesagem depois de
  7 dias e o botão para `/corpo`); banner "Você tem um treino aberto de 12/09"
  com Continuar / Descartar; card de **força** (resumo, "Começar treino" de 56 px
  e a prévia dos exercícios com "Hoje: 7,5 kg na barra (subiu +2 kg no treino de
  12/09)"); card de **cardio** (texto da sessão da semana, detalhes do plano,
  "Começar", "Fazer corda em vez de corrida" e "Treinar mesmo assim (Treino A)");
  card de **descanso** (lembrete do grease the groove vindo do JSON, total do dia
  e o botão "+1"). Aviso de corrida + perna no mesmo dia (§5.3), sem bloquear.
- `/calendario` (`components/calendario/`): grade seg–dom com tipo, o que foi
  feito e o que falta, navegação por semanas (anterior / Hoje / próxima), resumo
  "1 feito · 3 a fazer · 1 perdido", mês em miniatura, diálogo do dia (passado →
  resumo e link para a sessão; hoje/futuro → trocar tipo, treino ou sessão de
  cardio, com motivo opcional e "Voltar ao programa") e "Não vou treinar hoje",
  que mostra o que a regra da semana curta vai mudar **antes** de gravar.

### Decisões

- **A configuração do Supabase chega do servidor.** As `NEXT_PUBLIC_*` são
  embutidas no bundle do navegador **no build**, e este projeto builda sem elas
  (não existe projeto Supabase ainda; o `npm run e2e` builda antes e só passa as
  variáveis no `next start`). Então `app/(app)/layout.tsx` — que é
  `force-dynamic` e lê o ambiente em tempo de execução — renderiza
  `<ConfigurarSupabase url chave />`, que grava a configuração no módulo
  `lib/supabase/client.ts` **durante o render**, antes dos filhos, e liga a fila
  de saída no efeito. São só a URL e a chave anon; a service role nunca sai do
  servidor (§9). Sem isso o cliente do navegador nascia sem URL e nada do marco 2
  funcionaria no deploy.
- **Sem `@tanstack/react-query-persist-client`.** `dehydrate`/`hydrate` já vêm no
  `@tanstack/react-query`; o persistidor cabe em 60 linhas e evita mais um pacote
  com versão para casar.
- **O dia é do navegador, não do servidor.** `useHoje()` devolve `null` na
  primeira passada para não brigar com a hidratação — daí os esqueletos
  aparecerem por um instante mesmo com cache.
- **Uma query por intervalo.** O calendário lê `schedule_overrides` e
  `cardio_sessions` no intervalo da **grade do mês** (seis semanas), que contém
  sempre a semana mostrada; `sessions` vem das 60 mais recentes.
- Os cards usam `CardTitle` do shadcn, que é um `div` — o `h1` de cada tela
  continua sendo "Hoje" / "Calendário".

### Dois defeitos antigos que este marco descobriu

1. **O formulário de login se apagava sozinho** (`app/(auth)/login/formulario.tsx`).
   O React 19 dá `form.reset()` automático quando uma ação de formulário
   termina: depois de um "Criar conta" recusado ("Essa conta já existe"), o
   e-mail e a senha sumiam e o toque seguinte em "Entrar" enviava o formulário
   vazio — o `required` do navegador barrava e **nada acontecia**, sem erro
   nenhum na tela. Os dois campos passaram a ser controlados. Regressão em
   `e2e/login.spec.ts`.
2. **A fila de saída engolia o que chegava durante uma rodada** (`lib/outbox.ts`).
   `processar()` saía na hora se já estivesse rodando (`rodando`), e quem
   enfileirasse nesse meio-tempo ficava parado até o próximo evento de rede —
   podia ser nunca. Aparece com três `schedule_overrides` seguidos (semana
   curta) e apareceria muito mais no marco 3, com uma série atrás da outra.
   Agora a chamada concorrente marca `repetir` e a rodada em andamento dá mais
   uma volta no fim (`umaRodada()`). Sem `fake-indexeddb` no projeto, quem prova
   isso é o e2e da semana curta (3 linhas gravadas, não 1).

### Testes

- **Unitários** (`npm test`, 461): `lib/hoje.test.ts` (29) e `lib/semana.test.ts`
  (15) cobrem o resumo do treino, a prévia com as cargas iniciais e com estado +
  evento, os rótulos por implemento, o texto do evento em carga/reps/tempo/
  elástico, o peso e a sequência, o aviso de corrida + perna, a grade da semana
  com A/B alternando, as marcações, o mês em miniatura e os overrides da semana
  curta.
- **E2E** (`npm run e2e`, **51**): `hoje.spec.ts` (11) e `calendario.spec.ts` (8)
  novos, mais a regressão do login. Com o relógio do navegador em 14/09/2026 a
  Hoje mostra "Treino A · 6 exercícios · 44 min" com 7,5 kg na barra, 1,5 kg por
  halter e peso do corpo; com `ultimo_treino = "A1"` vira o Treino B com 4 kg no
  pino; em 15/09 é "Corrida · semana 1 · 8 × (1 min corrida / 2 min caminhada) ·
  34 min" e a corda como alternativa; em 17/09 o "+1" grava em `pullup_singles`;
  o banner descarta a sessão (`status = abandonada` no banco); o calendário
  mostra a semana com A/B, marca feito/faltou, troca um dia futuro gravando
  `schedule_overrides` e aplica a semana curta (3 linhas).

### O que falta

- Marco 3: a sessão de força de verdade (`/treinar`), que é quem cria as
  `sessions`, grava as séries e chama `decidir()`. Hoje "Começar treino" e
  "Continuar" levam para a tela em construção.
- Marco 4: `/cardio/[id]` (o "Começar" do card de cardio leva para lá com a data
  no lugar do id) e `/barra-fixa`.
- O peso e as medidas (`/corpo`) — a faixa de status já pede a pesagem e leva
  para a rota, que ainda está em construção (marco 5).

### Como testar no celular (marco 2)

1. `npm run build && npm run e2e` — 55 testes verdes num Chromium de 360 × 740.
2. À mão: `npm run mock` num terminal e `npm run dev:mock` no outro (troque
   `127.0.0.1` pelo IP do computador nas três variáveis do `dev:mock` para abrir
   pelo celular). Crie a conta com `miguelgsaviotti29@gmail.com`.
3. Na **Hoje**: numa segunda tem que aparecer "Treino A · 6 exercícios · 44 min",
   o botão "Começar treino" ocupando a largura toda e a lista dos 6 exercícios
   com "Hoje: 7,5 kg na barra", "Hoje: 1,5 kg por halter" e "Hoje: peso do
   corpo". Nada pode rolar para o lado.
4. Num dia de **cardio** (terça ou sábado), o card traz a sessão da semana com os
   minutos; "Fazer corda em vez de corrida" troca o conteúdo do card.
   Num dia de **descanso** (quinta ou domingo), o "+1" aumenta o total na hora —
   ligue o modo avião antes de tocar: o número sobe do mesmo jeito e, ao voltar
   a rede, a linha aparece em `curl -s localhost:54321/__mock/estado`.
5. No **Calendário**: navegue entre as semanas, toque num dia futuro e troque o
   tipo (a grade muda na hora), e toque em "Não vou treinar hoje" para ver a
   lista do que vai mudar antes de confirmar.
6. Abra a Hoje, feche o app e abra de novo: o conteúdo aparece **antes** da rede
   responder (cache do TanStack Query no IndexedDB) e se atualiza em seguida.

### Auditoria do marco 2 (rodada 1) — o que o auditor achou e o que mudou

Auditoria independente: os quatro portões rodados do zero (`npm run lint` limpo,
`npm run build` sem erro, `npm test` 461/461, `npm run e2e` **51**/51 — o marco
dizia 50, era um a mais), o código lido e o app dirigido à mão no Chromium a
360 × 740 contra o mock. Confirmados no navegador, sem nenhum erro de console:

- **§10.2**: segunda 14/09/2026 → "Treino A · 6 exercícios · 44 min" com
  7,5 kg na barra (agachamento, supino, remada, rosca), 1,5 kg por halter
  (desenvolvimento) e peso do corpo (elevação de pernas); Treino B com 4 kg no
  pino; Fase 2 com Superior A na segunda e Inferior A na terça.
- **§5.2**: override vira a segunda em corrida (e o card traz a sessão da semana
  do plano, não os 44 min do treino); a alternância segue `ultimo_treino`;
  descanso de quinta traz "1 repetição solta de barra fixa (grease the groove)"
  e o de domingo "caminhada leve" — os dois textos vindos do `programa.json`.
- **§5.3/§5.4**: "Treinar mesmo assim (Treino A)" nos dias de cardio e descanso;
  marcando a segunda, a semana curta mostra `14/09 Treino A → Descanso`,
  `16/09 Treino B → Treino A`, `17/09 Descanso → Treino B` antes de gravar as
  três linhas — o Treino A (agachamento) continua na semana.
- **§3.5**: grade seg→dom, mês em miniatura também começando na segunda,
  ✓ / ~ / ✕ coerentes com as sessões semeadas, navegação entre semanas.
- **§8**: com `context.setOffline(true)`, recarregar mostra a Hoje inteira em
  **181 ms**, vinda do cache do IndexedDB.
- Layout: a 360 px nada rola para o lado, `<html lang="pt-BR">`, a barra inferior
  termina em y = 740 (o pé da tela) com `padding-bottom: 96px` no `<main>`, e
  todo botão/link das telas do marco tem ≥ 44 px.

**Quatro defeitos, todos corrigidos nesta auditoria** (nenhum teste foi apagado
ou afrouxado):

1. **Dia passado de cardio abria a rota de força**
   (`components/calendario/dialogos.tsx`, SPEC §3.3). O diálogo do dia usava
   sempre `/treinar/<sessaoId>` com o rótulo "Abrir o treino", mas em dia de
   cardio esse id é de `cardio_sessions`: tocar na terça de uma corrida feita
   levava para a sessão de força com o id errado. Agora um dia de cardio abre
   `/cardio/<id>` com "Abrir o cardio". Regressão em `e2e/calendario.spec.ts`.
2. **O X do diálogo tinha 28 px e dizia "Close"** (`components/ui/dialog.tsx`,
   e o mesmo em `components/ui/sheet.tsx`). É o único alvo abaixo de 44 px que
   sobrou nas telas do marco, e o rótulo de leitor de tela estava em inglês
   numa interface em pt-BR — os dois vinham do primitivo do shadcn. Ganhou a
   classe `.alvo` (44 × 44) e virou "Fechar". Regressão em
   `e2e/calendario.spec.ts`.
3. **A fila de saída podia não dar o flush de partida** (`lib/outbox-supabase.ts`,
   SPEC §8). `iniciarOutbox()` é idempotente por uma flag; quando o app abre no
   `/login`, o `Providers` já a liga **sem enviador** (o `ConfigurarSupabase` só
   existe dentro do shell autenticado). Depois de entrar, `registrarEnviador()`
   definia o enviador mas a chamada seguinte de `iniciarOutbox()` saía na hora —
   e o que estivesse na fila de uma sessão anterior ficava parado até o próximo
   `online`, `visibilitychange` ou nova escrita. `registrarEnviador()` passou a
   dar uma rodada (`void processar()`) logo depois de definir o enviador.
4. **O aviso de corrida + perna decidia por nome de exercício** (`lib/hoje.ts`,
   regra de conteúdo no código). `avisoCorridaEPerna()` testava
   `/^agachamento|terra|stiff|afundo|panturrilha/i` contra o **nome** do
   exercício — conteúdo duplicado fora do JSON, que já traz `grupo`. Além de
   frágil, deixava de fora "Flexora e glúteo na polia" (grupo Pernas, no IB).
   Agora o teste é `exercicio.grupo === "Pernas"`, com o valor tipado pelo enum
   de `lib/schemas.ts`. Teste novo em `lib/hoje.test.ts` fixando o resultado nos
   seis treinos (A1, B1, IA, IB avisam; SA e SB não).

**Testes acrescentados** (`npm test` 462, `npm run e2e` 55):

- `lib/hoje.test.ts`: o aviso de perna pelos seis treinos.
- `e2e/hoje.spec.ts`: recarregar **sem rede** (`context.setOffline(true)`) e a
  Hoje inteira ainda aparecer — era o que faltava para provar a §8 de ponta a
  ponta (o teste antigo só olhava a linha no IndexedDB); e o caso de erro de uma
  linha de `exercise_state` com `carga_atual_kg` nula, que tem de cair na
  `carga_inicial` do JSON (§6.1) em vez de sumir com a carga.
- `e2e/calendario.spec.ts`: a rota do dia passado de cardio e o alvo/rótulo do X.

**Anotado, sem correção neste marco** (não bloqueia):

- `lib/queries/acoes.ts` > `gravarOverrides()` gera um `id` novo a cada upsert do
  mesmo `(user_id, data)`, então a chave primária da linha troca a cada edição
  do dia. Hoje é inofensivo (nada referencia `schedule_overrides.id`); quando o
  backup/importação da §9 entrar, vale reaproveitar o id existente.
- `previaDoTreino()` ainda não recebe `OpcoesMontagem`: quando a barra W e a
  reta oca forem pesadas em `/mais` (§3.9), a prévia precisa passar os pesos
  para `cargaDeHoje` como a sessão vai fazer no marco 3.
- `lib/calendario.ts` > `treinosComAgachamentoOuTerra()` continua usando regex
  sobre o nome (`/^agachamento|terra/i`); é do motor, já auditado, e não há
  campo no JSON que marque "treino pesado" — fica registrado como o próximo
  candidato a virar dado.

### Como testar no celular (auditoria do marco 2)

1. `npm run build && npm run e2e` — **55** testes verdes num Chromium de
   360 × 740 (`npm test` fecha em 462).
2. À mão, com `npm run mock` + `npm run dev:mock`: no **Calendário**, toque num
   dia de cardio que já passou e confira que o botão diz "Abrir o cardio"
   (e não "Abrir o treino"); o X do diálogo agora é um alvo de 44 × 44.
3. Offline de verdade: abra a Hoje com rede, espere um segundo, ligue o modo
   avião e recarregue — a tela inteira volta na hora, do IndexedDB.

---

## Marco 3 — Sessão de força ✅

O coração do app (SPEC §3.2, §6.5, §6.6 e §8): começar o treino, registrar
série a série com o polegar, o timer de descanso, o motor decidindo no fim e
**nada se perdendo** — cada toque vai para o IndexedDB na hora e o Supabase
recebe pela fila de saída.

### O que foi feito

**Adaptador puro (`lib/sessao.ts`, com testes)**

A sessão inteira é um objeto de dados (`SessaoLocal`), e todas as regras da
tela são funções puras em cima dele. Nenhuma regra do motor foi reimplementada:
quem decide é `lib/progressao.ts`, quem monta as anilhas é `lib/montagem.ts`.

```ts
montarSessao({id, userId, data, treinoId, fase, estados, anteriores, recordes})
reconstruirSessao(linhaSessao, linhasDeSerie, {estados})   // sessão de outro aparelho
atualizarSerie · marcarSerie · definirFirme · definirNota  // cada toque
substituirExercicio(sessao, ordem, novoId, estado) · substitutosPara(id)
proximaCarga(atual, implemento, incremento, direcao)       // o ± da carga (§6.4)
progressoDaSessao · firmePadrao · textoDaCargaDoBloco · montagemDaCarga
escritaDaSessao · escritaDaSerie                           // itens da fila (§8)
avaliarSessao(sessao) · concluirSessao({sessao, agora})    // motor + escritas
recordesDoBloco · seriesAnterioresPorExercicio · notasDaSessao
```

- **O bloco carrega o que o motor vai precisar**: a prescrição do dia, o
  `AlvoDeHoje` de `cargaDeHoje()`, o `exercise_state` como estava no início, as
  séries da última sessão (tipo `maximo`) e os recordes da `v_records` — tudo
  congelado quando a sessão começa. Por isso **concluir funciona offline**: o
  motor roda inteiro no aparelho, sem reler nada.
- **Aquecimento** (§3.2): duas linhas (`tipo = 'aquecimento'`) no **primeiro**
  exercício `composto_pesado` do treino — barra vazia × 5 e metade da carga,
  as duas passadas por `alcancavelParaBaixo` (a metade de 43,5 é 21,5, não
  21,75). Não contam no rodapé nem no motor.
- **Pré-preenchimento**: carga de hoje e **topo** da faixa (`alvo_max`, não o
  `reps_alvo` do estado — a nota do marco do motor); concluir uma série copia os
  valores dela para a seguinte, se ainda estiver em branco e for do mesmo tipo.
- **Substituir hoje**: o bloco passa a ser do substituto (`exercise_id`,
  prescrição e descanso dele); o original não é avaliado. A lista sai de
  `equipamentoDisponivel()` (novo em `lib/dados.ts`, lido de
  `data/equipamentos.json`) cruzada com o grupo do exercício.

**Tela (`components/treinar/`, `app/(app)/treinar/`)**

- `/treinar`: com treino aberto (no aparelho ou em `sessions`), redireciona
  para ele; senão lista os treinos da fase com o de hoje em destaque, a prévia
  das cargas e "Começar Treino A".
- `/treinar/[sessionId]`: um bloco por exercício na ordem do programa, com
  nome, `séries × reps`, descanso (texto do `programa.json`), **carga de hoje**
  com o evento da §6.6 ("subiu +4 kg no treino de 14/09"), botão **montagem**
  (folha com os chips `10 · 5 · 2`, a carga alcançável, a diferença quando não
  fecha e o aviso de anilhas faltando) e o ícone de **ajuda** (figura animada,
  duas fotos, montagem, passos, erro comum, mapa muscular e a regra de
  progressão — tudo dos JSON).
- Linha de série: visto de 44 px · `StepperNumerico` de repetições (±1) ·
  carga (± o incremento do exercício, sempre caindo numa carga que a §6.5
  monta) · segundos com cronômetro (tempo) · passos · só reps (`maximo`) ·
  seletor de elástico (assistência) · dois campos D/E (unilateral). Digitação
  direta aceita vírgula (`lerNumero`) e `inputMode` numérico/decimal.
- `TimerDescanso`: barra fixa no topo, regressiva pelo descanso do exercício,
  vibração (`navigator.vibrate`) e bipe curto (WebAudio, sem arquivo de áudio)
  ao zerar, "pular" e "+30 s". `useTelaAcesa` (Wake Lock) durante a sessão, com
  re-aquisição ao voltar visível; as três preferências saem de `profiles.prefs`
  (`descanso_som`, `descanso_vibra`, `manter_tela`).
- Fim do bloco: toggle "Última repetição saiu firme?" (padrão calculado por
  `firmePadrao`) e nota curta. Rodapé fixo com tempo decorrido, séries
  feitas/total, "Abandonar" (com confirmação) e "Concluir" → resumo com
  ↑ subiu / = repetiu / ↓ voltou por exercício, avisos e sugestões do motor,
  recordes batidos, sensação 1–5 e o peso do dia (opcional) → salva e volta
  para a Hoje.

**Persistência (§8)**

- `lib/queries/sessao.ts`: `salvarSessaoLocal` grava no Dexie com debounce de
  **60 ms**, e `descarregarSessao()` grava na hora quando a aba some
  (`pagehide`, `visibilitychange`) ou ao concluir. Ids no cliente
  (`crypto.randomUUID`).
- A fila recebe, nesta ordem: criação da sessão (upsert por `id`), **cada série
  concluída** (upsert em `session_sets` por `id` — remarcar não duplica), e no
  fim `update sessions` + `upsert exercise_state` + `insert progression_events`
  + `update profiles.ultimo_treino` + `upsert body_weights` (peso opcional).
- Indicador discreto no cabeçalho: "3 para sincronizar" / "sincronizado".

**Duas correções em `lib/outbox.ts`** (defeitos reais que este marco expôs)

1. **Item em backoff podia ficar esperando para sempre.** `processar()` só
   mandava o que estava vencido e nada reagendava: se a rede voltasse no meio
   do backoff, o item esperava o próximo evento de fora (`online`,
   `visibilitychange`, outra escrita) — que pode não vir. Agora cada rodada
   agenda a próxima para quando o item mais próximo vencer.
2. **Voltar a rede não cancelava o backoff.** O motivo das falhas tinha acabado,
   mas o `proximaTentativa` continuava lá na frente. O listener de `online`
   passou a chamar `tentarAgora()`, que marca tudo como vencido e processa.
   Entrou também `esperarFila()`, usada depois de concluir o treino: a Hoje só
   relê `exercise_state`/`progression_events` **depois** que a fila esvazia
   (sem segurar a navegação), senão ela leria o estado velho.

### Decisões

- **A sessão guarda o `AlvoDeHoje` e o `exercise_state` de quando começou.** É o
  que permite concluir sem rede e o que garante que a tela e o motor decidam
  sobre a mesma carga. Se o estado mudar no banco no meio do treino (não
  acontece: um usuário, um aparelho), vale o que a sessão viu.
- **`session_sets.ultima_firme` grava o valor efetivo** (`ultimaFirme ?? firmePadrao`),
  não o `null` de "ainda não tocado": a coluna tem de explicar a decisão do motor.
- **O rodapé conta só as séries de trabalho** ("3/16 séries"): o aquecimento não
  está na prescrição e não entra na conta.
- **O `Switch` do shadcn foi trocado por um botão de linha inteira** no toggle
  "firme": o primitivo tem 18 px de altura e a §3 pede 44.
- **Em exercícios de tempo cada campo ocupa a linha inteira** — o botão do
  cronômetro come 44 px da coluna e a 360 px o número ficaria ilegível.
- **O campo de carga só aparece quando existe carga** (> 0) ou quando a
  progressão é por carga: prancha e elevação de pernas não ganham um campo de
  lastro que ninguém usa.
- **"Concluir"**, e não "Concluir treino", no rodapé: a 360 px o botão divide a
  linha com o tempo, as séries e o "Abandonar".
- **Abandonar não move `profiles.ultimo_treino`**: a alternância da §5.2 só anda
  com treino concluído. O motor continua avaliando os exercícios completos.
- `components/mapa-muscular.tsx` foi partido: `SpriteMuscular` (lê o SVG do
  disco, servidor) foi para `components/sprite-muscular.tsx`, e o
  `MapaMuscular` ficou puro — sem isso, a ficha do exercício levaria `node:fs`
  para o bundle do navegador.

### Testes

- **Unitários** (`npm test`, **497**): `lib/sessao.test.ts` (35) cobre a
  montagem das linhas do Treino A (ordem, aquecimento só no primeiro pesado,
  metade alcançável, topo da faixa, tempo/passos/unilateral/`maximo`, carga do
  estado), a cópia de valores para a série seguinte, `firmePadrao`, a
  substituição, `proximaCarga` nos três implementos, a montagem da §6.5, as
  escritas da fila, a conclusão (sobe / repete sem firme / falha com ↓ /
  abandono / peso do dia), os recordes, as séries anteriores do tipo `maximo` e
  a reconstrução a partir do banco.
- **E2E** (`npm run e2e`, **67**): `e2e/treinar.spec.ts` (12) começa o Treino A
  (6 blocos, aquecimento, cargas e rótulos da §10.2, a `sessions` no mock),
  registra três séries **só pelos steppers**, vê o timer de 2:30 aparecer,
  recarrega no meio (volta com o visto, a carga e a série seguinte herdada),
  fica **offline** (mais duas séries, indicador de pendentes, o banco intocado)
  e volta online (a fila esvazia e as três séries estão lá), conclui com tudo no
  topo e "firme" (resumo ↑ "7,5 → 11,5 kg na barra", recordes, `exercise_state`
  = 11,5, `progression_events` `subiu`, `ultimo_treino = A1`) e confere a §10.4
  na Hoje: "Hoje: 11,5 kg na barra (subiu +4 kg no treino de 14/09)". Mais:
  sem firme o exercício repete, abandonar guarda as séries sem avaliar o
  incompleto, a folha de montagem, a ficha com figura/fotos/mapa, a
  substituição registrando no substituto, e todo alvo do bloco ≥ 44 px sem
  rolagem lateral.
- Fixture nova: `fixarData()` (`page.clock.setFixedTime`) — o `install` do
  marco anterior congela também `setTimeout`/`setInterval`, e a sessão depende
  deles (debounce do IndexedDB, timer, fila).

### O que falta

- Marco 4: `/cardio/[id]` e `/barra-fixa` — a sessão de barra fixa da §3.4 vai
  reaproveitar `montarSessao` com um treino de um exercício só.
- `opcoesMontagem` da sessão está sempre em `{}`: quando a barra W e a reta oca
  forem pesadas em `/mais` (§3.9), é ela que passa a carregar os pesos — a
  sessão já os guarda e repassa a `cargaDeHoje`, `decidir` e `montagem`.
- A sessão aberta manda em `/treinar` mesmo sendo de outro dia: para começar
  outro treino é preciso descartá-la no banner da Hoje (§3.1). É o que a spec
  pede, mas vale um atalho quando o marco 6 for polir.
- O resumo mostra "conta como falha" quando o motor marca falha; a linha do
  tempo completa dos eventos é a ficha do exercício (marco 5).

### Como testar no celular (marco 3)

1. `npm run build && npm run e2e` — 67 testes verdes num Chromium de 360 × 740
   (`npm test` fecha em 497).
2. À mão: `npm run mock` num terminal e `npm run dev:mock` no outro (troque
   `127.0.0.1` pelo IP do computador nas três variáveis para abrir pelo
   celular). Entre com `miguelgsaviotti29@gmail.com`.
3. Na **Hoje** (numa segunda), toque em "Começar treino" → "Começar Treino A".
   O agachamento abre com duas linhas de aquecimento a 7,5 kg e três séries de
   3 × 5 a 7,5 kg.
4. Marque a série 1 **com o polegar**: o timer de 2:30 desce no topo da tela, o
   celular vibra e apita ao zerar. "+30 s" e "Pular" funcionam. A tela não
   apaga durante o treino.
5. Toque em "montagem": as anilhas por lado aparecem como chips; suba a carga
   para 25,5 kg e confira `5 · 4`. Peça 26,5 e veja "a mais próxima para baixo
   é 25,5 (−1 kg)".
6. Ligue o **modo avião** e continue marcando séries: o cabeçalho passa a dizer
   "n para sincronizar". Feche o app, abra de novo e volte para o treino: está
   tudo lá. Desligue o avião e o contador volta para "sincronizado"
   (`curl -s localhost:54321/__mock/estado` mostra as `session_sets`).
7. "Concluir" → o resumo diz o que sobe e o que repete, mostra os recordes,
   pede a sensação e (se quiser) o peso do dia. Salve: a Hoje volta com a
   carga nova na prévia do próximo treino.

### Auditoria do marco 3 (rodada 1) — o que o auditor achou e o que mudou

Auditoria independente: os quatro portões rodados do zero (`npm run lint` limpo,
`npm run build` sem erro, `npm test` 497/497, `npm run e2e` 67/67), o código
lido e o app dirigido à mão no Chromium a 360 × 740 contra o mock, com sondas
descartáveis em `e2e/` (offline, relógio falso, Wake Lock e `navigator.vibrate`
simulados).

**Confirmado no navegador** (nada disto veio do relatório do construtor):

- §10.3: o Treino A inteiro registrável só com o polegar (visto de 44 px,
  steppers de reps e de carga), timer de 2:30 no topo ao concluir a série,
  recarregar no meio volta com tudo, e com `setOffline(true)` as séries
  continuam entrando — o banco fica intocado e, ao voltar a rede, as três
  chegam. **Fechar a aba sem rede e abrir outra na mesma URL** também volta com
  as três séries (teste novo).
- §10.4: 3 × 5 no topo com "firme" → resumo ↑ "7,5 → 11,5 kg na barra",
  `exercise_state` 11,5, `progression_events` `subiu`, `profiles.ultimo_treino`
  = A1 e a Hoje com "Hoje: 11,5 kg na barra (subiu +4 kg no treino de 14/09)".
- Timer: conta 2:30, "+30 s" leva a 3:00, ao zerar diz "vai!" e chama
  `navigator.vibrate` uma vez; "Pular" fecha. Wake Lock é pedido ao abrir a
  sessão e **solto** ao sair (teste novo com as duas APIs simuladas).
- §3.2 nos outros tipos: Fase 2 traz "REPS (D)/REPS (E)" no búlgaro, no afundo,
  no serrote e na flexora; "SEGUNDOS" com cronômetro na prancha (contou 3 s e
  gravou `tempo_s = 3`); "PASSOS" no farmer's walk; e a barra fixa assistida
  (por substituição) traz os quatro degraus do elástico. Rótulos por implemento
  certos: "na barra", "por halter", "no pino", "na mochila".
- Aquecimento só no primeiro pesado, fora do rodapé ("0/16 séries" com as duas
  linhas marcadas) e fora do motor.
- Layout a 360 px: nada rola para o lado, o rodapé fixo não cobre o último
  bloco e a barra inferior termina no pé da tela.
- Nenhuma regra do motor dentro de `app/` ou `components/` (a única constante
  numérica é o `incremento_kg` que vem do próprio `AlvoDeHoje`), nenhum
  `console.log`, nenhum `any`, os dois `eslint-disable` justificados no lugar.

**Três defeitos corrigidos nesta auditoria:**

1. **A folha de montagem falava da carga do dia, não da que está na barra**
   (SPEC §6.5 e §10.5). `BotaoMontagem` recebia sempre `bloco.alvo.carga_kg`:
   subir a carga da série para 43,5 kg e tocar em "montagem" mostrava 7,5 kg e
   "Sem anilhas: só o implemento" — a resposta errada para a única pergunta que
   a folha existe para responder. Pior: como a carga do dia vem do motor e é
   sempre alcançável, o ramo "não fecha com estas anilhas / a mais próxima para
   baixo é…" era inalcançável na sessão. Entrou `cargaEmUso(bloco)` em
   `lib/sessao.ts` (a carga da próxima série a fazer; com tudo marcado, a da
   última feita), com teste unitário e regressão no e2e.
2. **Carga digitada que o kit não monta entrava em silêncio** (SPEC §6.4 e
   §10.5). O ± já anda pela escala (`proximaCarga`), mas o teclado aceitava
   qualquer número: digitar 26,5 na barra maciça gravava 26,5 em
   `session_sets.carga_kg` — uma carga que não existe no terraço. Agora a
   digitação passa por `alcancavelParaBaixo` e avisa: "26,5 kg não fecha com
   estas anilhas: ficou 25,5 kg na barra."
3. **O resumo do abandono dizia "Treino concluído"** (pt-BR/§3.2). `ResumoDoFim`
   tinha o título fixo; passou a receber `fim` e a dizer "Treino abandonado".

**Testes acrescentados** (`npm test` 498, `npm run e2e` 70):

- `lib/sessao.test.ts`: `cargaEmUso` em quatro situações.
- `e2e/treinar.spec.ts`: a folha de montagem seguindo a carga da série
  (43,5 kg → chips 10 · 5 · 3), a carga digitada inalcançável sendo ajustada e
  avisada (caso de erro), o timer zerando com vibração + "+30 s" + "Pular" e o
  Wake Lock pedido/solto, e fechar o app sem rede e voltar na mesma URL.

**Defeito aberto (bloqueia o marco)**

- **O exercício substituído não usa o próprio estado** (SPEC §6.3: "o
  substituto usa o próprio estado"). `tela-sessao.tsx` chama
  `substituirExercicio(..., novoId, null)` — sempre `null` —, e a sessão só
  carrega `exercise_state` dos exercícios do treino. Com 31,5 kg gravados no
  agachamento frontal, substituir o agachamento livre por ele mostra "Hoje:
  7,5 kg na barra" e, ao concluir, **sobrescreve** a linha do banco com 9,5 kg
  e `reps_alvo` nulo: a progressão real do exercício é perdida. O mesmo vale
  para `seriesAnteriores` (tipo `maximo`) e para os recordes do resumo, que
  chegam vazios. Correção: carregar os estados/recordes/séries anteriores
  também dos substituíveis (`substitutosPara` de cada bloco, ou a tabela
  inteira — são no máximo 81 linhas) e passá-los em `substituirExercicio`;
  enquanto o estado do substituto for desconhecido (offline sem cache), não
  gravar `exercise_state` nem `progression_events` daquele bloco.

**Anotado, sem correção nesta rodada** (não bloqueia):

- As séries já gravadas do exercício **original** continuam em `session_sets`
  depois da substituição (a folha promete "serão trocadas pelas do
  substituto"): a tela troca as linhas locais, mas as que já subiram ficam lá e
  vão aparecer no histórico e nos recordes do original no marco 5.
- Mudar a carga à mão na série não muda o que o motor decide: `decidir()`
  trabalha sobre `exercise_state.carga_atual_kg` (§6.1), então quem levanta
  11,5 num dia de 7,5 vê "7,5 → 11,5" e só repete a carga que já fez. É o que a
  §6.2 diz, mas vale um "usar esta carga a partir de hoje" no polimento.
- Na **primeira** carga do app num navegador (o service worker ainda não
  assumiu o controle), recarregar a sessão sem rede cai na tela de erro do
  Chromium — nem o `/~offline` aparece. Da segunda carga em diante (o caso do
  PWA instalado) a sessão volta inteira offline, como o teste novo mostra.
- Uma única execução do teste "sem rede as séries continuam sendo registradas e
  sobem depois" estourou os 15 s do poll; não repetiu em outras cinco
  execuções. Vale olhar de novo se voltar.

### Como testar no celular (auditoria do marco 3)

1. `npm run build && npm run e2e` — **70** testes verdes a 360 × 740
   (`npm test` fecha em 498).
2. À mão, com `npm run mock` + `npm run dev:mock`: no agachamento, suba a carga
   da série 1 para 25,5 kg e toque em "montagem" — os chips têm de ser 5 · 4 e
   o total 25,5 kg (antes mostrava 7,5 kg).
3. Ainda na série 1, digite 26,5 no campo da carga e toque fora: o campo volta
   com 25,5 e aparece o aviso "26,5 kg não fecha com estas anilhas".
4. Toque em "Abandonar" → "Confirmar abandono": o título do resumo é "Treino
   abandonado".
