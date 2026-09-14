# Treino do Terraço — especificação do app

App pessoal de um usuário só (Miguel) para **fazer, registrar e evoluir** a rotina de treino do guia da garagem: o que fazer hoje, checkbox por série com repetições e carga, quando subir peso ou repetições, histórico completo, peso corporal, medidas e fotos. Português do Brasil, celular primeiro (é usado no terraço, com o celular na mão, entre uma série e outra).

Tudo que é conteúdo de treino — exercícios, programa, cardio, regras de progressão, equipamento — já está pronto em `data/*.json` e `assets/`. **O app não inventa conteúdo: lê os JSON.** O banco guarda só o que o usuário faz.

---

## 1. Decisões fechadas

| Tema | Decisão |
|---|---|
| Stack | Next.js 15 (App Router, TypeScript, React 19) · Tailwind · shadcn/ui · Supabase (Postgres, Auth, Storage) · Vercel |
| Forma | PWA instalável no celular (manifest + service worker), tema claro/escuro, funciona sem sinal durante o treino (ver §8) |
| Usuário | Um só. Login por e-mail + senha no Supabase Auth; a variável `ALLOWED_EMAIL` bloqueia qualquer outro e-mail no login e no cadastro |
| Conteúdo | Catálogo (81 exercícios), programa (2 fases, 6 treinos), cardio e regras vêm de `data/*.json` **embutidos no build** (importados como módulos tipados). Nada disso vai para o banco |
| Dados do usuário | Supabase, schema em `supabase/schema.sql` (11 tabelas + view + bucket), RLS por `user_id` |
| Registro | **Por série**: repetições e carga (ou tempo, passos, assistência do elástico) em cada série, com checkbox de concluída e um toggle "última repetição firme?" por exercício |
| Corpo | Peso (1× por semana), medidas com fita (1× por mês) e fotos de progresso (frente/lado/costas, 1× por mês) com comparação lado a lado |
| Objetivo principal | Força e músculo: progressão de carga, volume semanal e recordes em primeiro plano; corrida, corda e barra fixa continuam no calendário |
| Idioma/unidades | pt-BR, vírgula decimal na tela (7,5 kg), datas dd/mm, semana começa na segunda, kg · cm · km |
| Início | Segunda-feira, 14/09/2026 — Fase 1, Treino A |

---

## 2. Arquivos de dados (a fonte da verdade)

| Arquivo | O que tem | Como o app usa |
|---|---|---|
| `data/exercicios.json` | 81 exercícios: `id` (slug), nome, grupo, músculos primários/secundários (chaves + nomes), equipamento (tags + texto), `implemento` (barra_macica · halteres · barra_w · polia · barra_fixa · peso_corporal · anilha · corda · band), montagem, passos, erro comum, `prescricao_padrao` (séries, tipo reps/tempo_s/passos/maximo, min, max, unilateral, descanso_s), `categoria`, `carga_inicial`, `progressao` (tipo e incremento), `figura` (SVG animado), `fotos` (2 jpg), `foto_fonte_id` | Catálogo, tela de exercício, defaults de séries/reps/descanso, motor de progressão, carga inicial no primeiro registro |
| `data/programa.json` | `fases[]` (fase1 corpo inteiro 3×, fase2 superior/inferior 4×) com a `semana` dia a dia, `treinos` (A1, B1, SA, IA, SB, IB) com exercícios em ordem, séries, faixa de reps, descanso, transição e tempo estimado; `aquecimento`, `seguranca`, `semana_curta`, `quando_mudar` | Calendário, tela Hoje, sessão de treino, sugestão de troca de fase |
| `data/cardio.json` | Corrida 12 semanas (blocos corrida/caminhada, km, pace alvo), corda (5 estágios), barra fixa 12 semanas (assistência do elástico, séries), grease the groove, teste da fala, regras de ordem | Sessão de cardio com timer de blocos, plano da barra fixa, contador de reps soltas |
| `data/progressao.json` | Princípio (dupla progressão), incrementos por tipo de exercício, carga inicial, tabela de falhas, faixas de reps/descanso por categoria, marcos | Motor de progressão (§6) e textos de ajuda |
| `data/equipamentos.json` | Anilhas (4 × 1, 2, 3, 4, 5, 10 kg), barras (pesos e capacidades), itens com specs e fotos, espaço do terraço, o que falta | Montagem da barra (anilhas por lado), limites de carga, tela Equipamento |
| `data/perfil.json` | Dados iniciais do Miguel (altura 1,90, iniciante, data de início, objetivos, preferências); peso e medidas em `null` para preencher no app | Seed do perfil no primeiro login |
| `assets/figuras/<id>.svg` | 67 figuras de execução (boneco lateral, posição inicial em cinza → final em destaque, seta), 66 animadas com SMIL; CSS e cores embutidos, respeitam `prefers-color-scheme` | `<img src>` ou inline; animação roda sozinha |
| `assets/fotos/<id>-1.jpg`, `-2.jpg` | 162 fotos de execução (início e fim) do free-exercise-db, domínio público | Tela de exercício e sessão |
| `assets/mapa-muscular/` | Sprite SVG do corpo (frente `#bf`, costas `#bb`), CSS das classes `p-<musculo>` / `s-<musculo>`, exemplo | Componente `MapaMuscular` (§7) |
| `assets/itens/<item>/` | Fotos reais dos 10 itens comprados + `ficha.md` | Tela Equipamento |
| `docs/` | O guia de treino completo (HTML), o manual da garagem e o catálogo dos itens — referência de tom e conteúdo | Leitura; não entra no bundle |

Regra: se algo no JSON parecer errado, **corrija o JSON e mantenha o app lendo dele** — não duplique o conteúdo em código.

---

## 3. Telas (rotas)

Navegação inferior fixa no celular com 5 itens: **Hoje · Treinar · Progresso · Corpo · Mais**. Tudo funciona com uma mão; alvos de toque ≥ 44 px; inputs numéricos abrem o teclado numérico.

### 3.1 `/` — Hoje
O que fazer hoje, decidido pelo calendário (§5):
- **Dia de força**: card do treino (nome, foco, nº de exercícios, tempo estimado) → botão grande "Começar treino". Abaixo, a lista dos exercícios com a carga/reps que o motor vai pedir hoje (prévia).
- **Dia de cardio**: card da sessão da semana atual (ex.: "Corrida · semana 3 · 6 × (2 min corrida / 2 min caminhada) · 34 min") → "Começar". Alternativa "Fazer corda em vez de corrida" (chuva).
- **Descanso**: card "Descanso" + lembrete das reps soltas de barra fixa (grease the groove) com botão "+1" e o total do dia.
- Faixa de status: fase atual, semana da fase, sequência de treinos concluídos, peso mais recente e há quantos dias foi pesado (pede pesagem se > 7 dias).
- Se houver sessão em andamento não concluída → banner "Você tem um treino aberto de <data>" com Continuar / Descartar.

### 3.2 `/treinar` e `/treinar/[sessionId]` — sessão de força
Fluxo em uma página com rolagem, um bloco por exercício, na ordem do treino:
- Cabeçalho do bloco: nome, `séries × reps` alvo, descanso, **carga de hoje** (do motor, §6) com o botão "montagem" que mostra as anilhas por lado (§6.5). Ícone de ajuda abre a ficha (figura animada, 2 fotos, montagem, passos, erro comum, músculos).
- Aquecimento: no primeiro exercício pesado do treino, duas linhas de aquecimento pré-preenchidas (barra vazia × 5, metade da carga × 5) marcadas como `tipo = 'aquecimento'` — não contam para a progressão.
- Uma linha por série: `[✓] série 1 · reps [ 8 ] · kg [ 24,5 ]` com steppers − / + (reps ±1; carga ± incremento do exercício, ex.: 2 kg na barra, 2 kg no pino, 2 kg por halter) e digitação direta. Valores pré-preenchidos com a carga de hoje e o topo da faixa; a série anterior preenche a seguinte. Para `tempo_s` o campo é segundos (com cronômetro); para `passos`, passos; para `maximo`, só reps; para barra fixa assistida, seletor de assistência (pé inteiro / joelho / joelho dobrado / sem elástico); exercícios unilaterais registram o valor por lado (uma série = um lado + o outro).
- Marcar a série concluída inicia o **timer de descanso** (barra fixa no topo da tela, tempo do exercício; vibra e toca ao zerar; pode pular). Tela fica acesa durante a sessão (Wake Lock API).
- No fim do bloco: toggle "Última repetição saiu firme?" (padrão: sim se todas as séries chegaram ao topo da faixa) e campo de nota curta. É esse toggle que o motor usa.
- Rodapé: tempo total decorrido, séries feitas/total, "Concluir treino" → resumo (o que subiu, o que repetiu, recordes) + sensação 1–5 + peso do dia opcional → salva e volta para Hoje. "Abandonar" mantém o que foi registrado com `status = 'abandonada'`.
- Trocar exercício: em cada bloco, "substituir hoje" abre a lista de exercícios do mesmo grupo que usam equipamento disponível (registro fica com o exercício substituto; a progressão do original não muda).
- Tudo que é digitado é salvo localmente a cada mudança (§8); o envio ao Supabase acontece por série concluída e ao finalizar.

### 3.3 `/cardio/[id]` — sessão de cardio
- **Corrida**: timer de intervalos com os blocos da semana (corrida / caminhada), aquecimento e soltura; voz/vibração na troca de bloco; ao terminar pede distância (opcional, GPS não é necessário) e o teste da fala (fácil / moderado / forte). Registro em `cardio_sessions` com `feito` = blocos cumpridos.
- **Corda**: blocos × duração com descanso, contador aproximado de saltos (do plano), mesma finalização.
- **Caminhada leve / outro**: só duração e nota.
- A semana do plano avança quando as duas sessões da semana foram concluídas; pular uma semana inteira faz repetir a mesma (regra do guia); botões "repetir semana" e "avançar semana" no perfil para ajuste manual.

### 3.4 `/barra-fixa` — plano da primeira barra fixa
Tabela das 12 semanas com a semana atual destacada (assistência, séries, reps por semana), botão "Fazer sessão de barra fixa" (abre uma sessão de força só com "Barra fixa assistida" nas séries da semana) e o contador de repetições soltas do dia/semana (grease the groove) com histórico.

### 3.5 `/calendario` — semana e mês
Grade da semana (seg–dom) com o tipo de cada dia, o que foi feito (✓, parcial, faltou) e o que falta; navegação por semanas; mês em miniatura. Tocar num dia passado abre a sessão; num dia futuro permite trocar o tipo (`schedule_overrides`). Aplica a regra da semana curta (§5.4) ao marcar "não vou treinar hoje".

### 3.6 `/exercicios` e `/exercicios/[id]` — catálogo
Lista com busca e filtros (grupo, equipamento, implemento, "está no meu programa"). Detalhe: figura animada + 2 fotos (toque abre em tela cheia), mapa muscular, equipamento, montagem, passos numerados, erro comum, prescrição padrão, regra de progressão e carga inicial; **histórico do exercício**: carga atual, recorde (carga máxima, reps máximas, e1RM Epley), gráfico carga × data, últimas 10 sessões (séries feitas), eventos de progressão.

### 3.7 `/progresso`
- Cards: treinos concluídos (semana / mês / total), aderência (feitos ÷ planejados nas últimas 4 semanas), volume semanal (Σ reps × kg das séries de trabalho), recordes recentes.
- Gráficos (Recharts): carga dos três grandes (agachamento, terra, supino) + desenvolvimento militar por sessão; volume semanal (12 semanas); reps da barra fixa por semana; corrida: minutos correndo e km por semana.
- Lista de recordes por exercício (view `v_records`).

### 3.8 `/corpo`
- Peso: registrar (data, kg), gráfico com média móvel de 7 dias, variação por semana, meta opcional.
- Medidas: formulário com os 8 campos em cm (unique por data), tabela e gráfico por medida.
- Fotos: upload de frente/lado/costas por data (bucket privado `progresso`, redimensionar no cliente para ≤ 1600 px antes de subir), galeria por data e **comparação** de duas datas lado a lado com slider.

### 3.9 `/mais`
Perfil (nome, altura, data de início, fase atual e desde quando, semanas de corrida/corda/fixa com botões de ajuste), equipamento (lista com fotos e specs, pesos das barras editáveis — a barra W e a reta oca ainda serão pesadas), preferências (tema, som/vibração do timer, manter tela acesa, incremento por exercício), **exportar backup** (JSON com tudo) e importar, sair.

---

## 4. Modelo de dados

O schema completo está em `supabase/schema.sql`. Resumo:

- `profiles` — 1 linha: fase atual, data de início, semanas dos planos de cardio/fixa, último treino de força, preferências (jsonb).
- `exercise_state` — estado por exercício: `carga_atual_kg` (barra total, ou por halter, ou pino), `reps_alvo`, `tempo_alvo_s`, `assistencia`, `incremento_kg` (override), `falhas_seguidas`, `desativado`.
- `sessions` + `session_sets` — a sessão de força e cada série (reps, carga, tempo, passos, assistência, concluída, `ultima_firme`, rpe opcional, `tipo` aquecimento/trabalho).
- `progression_events` — cada decisão do motor (de → para, motivo), para o histórico explicar "por que hoje é 26,5 kg".
- `cardio_sessions` — corrida/corda/caminhada com blocos planejados e feitos.
- `pullup_singles` — reps soltas de barra fixa (grease the groove).
- `body_weights`, `body_measurements`, `progress_photos` — corpo.
- `schedule_overrides` — exceções ao calendário padrão.
- `v_records` — melhor carga, e1RM e reps por exercício.

Convenção de carga: **barra** = peso total (barra 7,5 kg + anilhas); **halteres** = peso de um halter (barra 1,5 kg + anilhas); **polia** = kg no pino; **barra fixa com lastro** = kg na mochila; peso corporal = 0. O campo `implemento` do exercício diz qual convenção vale — mostrar sempre o rótulo certo na tela ("por halter", "no pino").

Tipos TypeScript: gerar de `exercicios.json` etc. com `zod` (schemas em `lib/schemas.ts`) e validar os JSON no build (`scripts/validar-dados.ts`).

---

## 5. Calendário e rotina

### 5.1 Fase
`profiles.fase_atual` e `fase_desde`. Fase 1 começa em 14/09/2026. O app sugere a Fase 2 quando: ≥ 12 semanas na Fase 1 **e** ≥ 30 sessões de força concluídas; o usuário aceita ou adia (a sugestão volta a cada 2 semanas). Ao trocar: `progression_events` com motivo `trocou_fase`; as cargas continuam as mesmas por exercício.

### 5.2 O que é hoje
1. Se existe `schedule_overrides` para a data → vale ele.
2. Senão, o dia da semana em `programa.fases[fase].semana` → tipo (`forca` / `cardio` / `descanso`).
3. Força, Fase 1: o treino é **o que não foi o último** (`profiles.ultimo_treino`): se o último foi A1, hoje é B1. Fase 2: o `treino` fixo do dia (SA seg, IA ter, SB qui, IB sex).
4. Cardio: `sessao` do dia ("corrida", "corrida ou corda", "corrida longa") + a semana do plano (`profiles.semana_corrida` / `semana_corda`).
5. Descanso: mostra o lembrete da barra fixa (qui) ou caminhada leve (dom).

### 5.3 Treino fora do dia
Treinar num dia de descanso ou cardio é permitido ("Treinar mesmo assim"): a sessão vale como o próximo treino da alternância e o calendário mostra o desvio. Corrida e treino de perna no mesmo dia: avisar (regra do guia: 6 h de intervalo, força primeiro), não bloquear.

### 5.4 Semana curta
Ao marcar um dia como "não vou treinar", o app reorganiza o resto da semana na ordem de sacrifício do guia: 1º corrida de sábado, 2º segunda sessão de cardio, 3º um treino de força — **nunca** o treino com agachamento/terra (A1, B1, IA, IB têm; se sobrar um dia só na semana, é o Treino A).

### 5.5 Semanas dos planos de cardio e barra fixa
`semana_corrida` avança quando as 2 sessões de corrida da semana civil foram concluídas; se a semana passar com 0 sessões, a semana do plano **não muda** (repete); com 1 sessão, repete também (regra "repita a semana anterior em vez de pular"). Igual para corda (`semana_corda`) e barra fixa (`semana_fixa`, 2 sessões). Tudo ajustável no perfil.

---

## 6. Motor de progressão (o coração do app)

Implementar em `lib/progressao.ts` como funções puras, testadas com Vitest. Entradas: exercício (JSON), `exercise_state`, as séries de trabalho da sessão. Saída: novo estado + evento.

### 6.1 Carga de hoje
- Primeira vez no exercício: `carga_inicial.kg` do JSON (barra 7,5; halter 1,5; pino 4; peso corporal 0) e reps/tempo alvo = mínimo da faixa.
- Depois: `exercise_state.carga_atual_kg` (ou `reps_alvo`, `tempo_alvo_s`, `assistencia`), já com a decisão do último treino aplicada.

### 6.2 Decisão ao concluir a sessão (por exercício, só séries `trabalho`)
Seja `alvo_max` o topo da faixa (`prescricao.max`; para "3 × 5" min = max = 5; para `maximo`, ver 6.3) e `alvo_min` o piso.
- **Sucesso** = todas as séries concluídas com `reps ≥ alvo_max` (ou `tempo_s ≥ max`, `passos ≥ max`) **e** `ultima_firme = true` → **sobe**: `carga += incremento` (tipo `carga`), ou `reps_alvo += incremento_reps` (tipo `reps`), ou `tempo_alvo += 5 s` (tipo `tempo`), ou próximo degrau de assistência (tipo `assistencia`). `falhas_seguidas = 0`. Evento `subiu`.
- **Manteve** = todas as séries com `reps ≥ alvo_min` mas alguma abaixo de `alvo_max`, ou `ultima_firme = false` → **repete** a carga. Evento `repetiu`. `falhas_seguidas` não muda.
- **Falha** = alguma série de trabalho com `reps < alvo_min` (ou não concluída) → `falhas_seguidas += 1`:
  - 1ª falha: repete a mesma carga (evento `repetiu`, marcado como falha).
  - 2ª seguida: `carga = arredondar(carga × 0,90)` e o **incremento passa a metade** até a próxima subida (evento `falha_2x_voltou_10`). Como o passo mínimo com estas anilhas é 2 kg, `incremento_reduzido = max(incremento ÷ 2, 2)`; quando cai no mínimo (exercícios de +2 kg), a exigência para subir passa a ser "topo da faixa **+ 1 rep** em todas as séries".
  - 3ª seguida: **semana leve**: próxima sessão com 60 % da carga, mesmas séries; depois volta à carga anterior à semana leve com o incremento normal (evento `semana_leve_60`). Zera `falhas_seguidas`.
- Os 22 casos de `docs/casos-de-teste-progressao.md` são a referência executável destas regras: implemente-os como testes antes da UI.
- Incremento por exercício: `progressao.incremento_kg` do JSON (4 kg agachamento/terra/stiff; 2 kg nos demais com barra; 2 kg por halter; 2 kg no pino) salvo override em `exercise_state.incremento_kg`.

### 6.3 Casos especiais
- **`maximo`** (barra fixa, flexão, mergulho): não há faixa; o alvo é "melhorar a média": sucesso = média de reps ≥ média da última sessão + 1 e nenhuma série abaixo da anterior. Barra fixa: quando 3 séries chegam a 10, sugerir "Barra fixa com lastro" (2 kg na mochila).
- **Assistência do elástico** (barra fixa assistida): degraus `pe_inteiro → joelho → joelho_dobrado → sem`. Sucesso no topo da faixa sobe um degrau; ao mudar de degrau as reps caem e isso é esperado (não conta como falha por 2 sessões).
- **Unilateral** (`unilateral = true`): a série registra os dois lados; vale o menor.
- **Peso corporal com faixa** (abdominais, elevação de pernas): progride em reps; acima de 20 reps em todas as séries, sugere anilha (2 kg) e volta ao piso da faixa.
- **Substituição de exercício** no dia: o substituto usa o próprio estado; o original não é avaliado.
- **Sessão abandonada**: só os exercícios com todas as séries registradas são avaliados; os demais não mudam.

### 6.4 Arredondamento e limites
- Barra maciça: cargas possíveis = 7,5 + 2 × (soma de anilhas de um lado); passos de 2 kg (1 kg por lado). Teto 107,5 kg com o kit atual.
- Halteres: 1,5 + 2 × (anilhas de uma ponta), passos de 2 kg; teto 40 kg por halter; cada halter pode ter no máximo 2 anilhas de cada peso por ponta e os dois halteres têm que fechar com o estoque (4 de cada).
- Barra W: capacidade 50 kg. Reta oca: 60 kg. Polia: 100 kg no pino; as anilhas usadas no pino saem do mesmo estoque.
- `arredondar(x)` = a carga possível mais próxima **para baixo** na escala do implemento.
- Aviso quando a carga pedida exige mais anilhas de 10 kg do que existem (marco do guia: comprar duas de 10 kg).

### 6.5 Montagem da barra ("quantas anilhas de cada lado")
Função `montagem(carga_total, implemento)` → lista de anilhas por lado, guloso do maior para o menor, respeitando o estoque (4 de cada, logo no máximo 2 por lado) e o peso da barra. Exibir como chips: `10 · 5 · 2` por lado. Se não fechar exatamente, mostrar a carga alcançável mais próxima e a diferença.

### 6.6 Quando mostrar
- Na tela Hoje e no cabeçalho de cada bloco: "Hoje: 26,5 kg (subiu +2 kg no treino de 12/09)".
- No fim da sessão: resumo com ↑ subiu / = repetiu / ↓ voltou por exercício e os recordes (carga máxima, e1RM, reps).
- Na ficha do exercício: linha do tempo dos eventos.

---

## 7. Componentes visuais

- **FiguraExercicio**: `<img src={"/figuras/"+id+".svg"} />` (as figuras já trazem CSS e cores claro/escuro; a animação SMIL roda sozinha). Fallback: as duas fotos lado a lado.
- **FotosExercicio**: `-1.jpg` (início) → `-2.jpg` (fim), com toque para ampliar.
- **MapaMuscular**: sprite `assets/mapa-muscular/corpo-sprite.svg` inline uma vez (layout) + `<svg><use href="#bf"/></svg>` e `#bb`, com as classes `p-<musculo>` e `s-<musculo>` do exercício; cores por CSS variables (ver `assets/mapa-muscular/README.md`).
- **TimerDescanso**: barra fixa no topo, contagem regressiva, vibração (`navigator.vibrate`) + som curto ao zerar, botão pular / +30 s.
- **TimerIntervalos** (cardio): blocos com cor por tipo, próximo bloco visível, fala opcional ("corrida", "caminhada") via `speechSynthesis` em pt-BR.
- **StepperNumerico**: − valor + com passo configurável e digitação direta; teclado numérico (`inputMode="decimal"`).
- Copiar os assets para `public/figuras`, `public/fotos`, `public/itens`, `public/mapa-muscular` no scaffold (script `scripts/copiar-assets.ts`).

Design: sóbrio, alto contraste, tipografia grande nos números (é lido a um braço de distância, no sol do terraço), tema escuro de verdade (não cinza), cor de destaque única. Sem confete, sem gamificação barata; a recompensa é o gráfico subindo.

---

## 8. Offline e sincronização

- Service worker (Serwist/`@serwist/next`) com precache do shell, das figuras e das fotos do programa atual; fotos do catálogo inteiro em cache sob demanda.
- **Sessão em andamento vive no cliente** (IndexedDB via Dexie ou `idb-keyval`): cada toque é salvo localmente na hora. Uma fila de saída (`outbox`) envia para o Supabase o que mudou (série concluída, sessão finalizada, peso, cardio). Se estiver sem rede, a fila espera e reenvia ao voltar (`online` event + retry com backoff). Nunca perder uma série registrada por falta de sinal.
- Leitura: TanStack Query com cache persistido; a tela Hoje abre com os dados da última sincronização e atualiza em segundo plano.
- Conflitos: um usuário, um aparelho por vez — última escrita vence; `sessions.id` gerado no cliente (uuid) para permitir criar offline.

---

## 9. Autenticação e segurança

- Supabase Auth, e-mail + senha (magic link opcional). `ALLOWED_EMAIL` (env) checado no middleware e num trigger/policy simples: se o e-mail logado for outro, sair e mostrar "app pessoal".
- RLS em todas as tabelas (`user_id = auth.uid()`), bucket `progresso` privado com policy por pasta do usuário. Chaves `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no cliente; **nunca** a service role no cliente.
- Backup: exportar JSON de todas as tabelas do usuário; importar restaura (idempotente por id).

---

## 10. Critérios de aceite (o que precisa funcionar antes de dizer "pronto")

1. Login com o e-mail permitido; qualquer outro e-mail é recusado.
2. No primeiro login o perfil é criado com `data/perfil.json` e a tela Hoje mostra "Treino A · 6 exercícios · 44 min" numa segunda-feira, com as cargas iniciais (7,5 kg na barra, 1,5 kg por halter, 4 kg no pino).
3. Uma sessão completa do Treino A pode ser registrada por série no celular sem usar teclado físico; o timer de descanso dispara ao concluir cada série; a sessão sobrevive a fechar e reabrir o app e a ficar sem rede.
4. Ao concluir com todas as séries no topo da faixa e "última firme", a próxima sessão mostra a carga + incremento; duas falhas seguidas reduzem 10 % e o incremento cai pela metade; três falhas geram a semana leve — tudo coberto por testes unitários em `lib/progressao.test.ts` (mínimo 12 casos, incluindo barra fixa, elástico, tempo, unilateral).
5. Montagem da barra: o motor só propõe cargas alcançáveis. Na barra maciça toda carga é 7,5 + 2 × (soma inteira de anilhas de um lado), ou seja 9,5, 11,5, 13,5, …; para um pedido impossível (26,5 kg) a função devolve a alcançável mais próxima para baixo (25,5 = 5 · 4 por lado) e mostra a diferença. Nos halteres: 1,5 + 2 × (anilhas de uma ponta) por halter, os dois iguais, fechando com o estoque de 4 anilhas de cada peso. Testes cobrem os três implementos (barra, halter, pino).
6. Calendário mostra a semana da Fase 1 com A/B alternando conforme o último treino; corrida na terça com a semana 1 do plano e o timer de 8 × (1 min / 2 min).
7. Peso, medidas e fotos podem ser registrados e comparados; gráficos renderizam com 1 e com 30 pontos.
8. Ficha de cada um dos 81 exercícios abre com figura (ou fotos), músculos destacados, passos e histórico.
9. `npm run build` sem erros, `npm run lint` limpo, `npm test` verde, Lighthouse PWA instalável, layout correto a 360 px de largura.
10. Deploy na Vercel com as variáveis de ambiente; instalação como PWA no Android/iPhone testada.

---

## 11. Fora do escopo (por enquanto)

Vários usuários, social, IA de sugestão de treino, nutrição, integração com relógio/GPS, notificações push. Não implementar nem deixar preparado — manter o app pequeno.

---

## 12. Ordem sugerida de construção (marcos)

1. **Base**: scaffold, Tailwind + shadcn, Supabase client, auth com e-mail permitido, schema aplicado, seed do perfil, leitura tipada dos JSON (zod), assets copiados, PWA básico.
2. **Hoje + calendário** (§3.1, §3.5, §5) sem registro ainda.
3. **Sessão de força** (§3.2) com salvamento local e outbox; motor de progressão com testes (§6).
4. **Cardio e barra fixa** (§3.3, §3.4).
5. **Catálogo e ficha** (§3.6), **Progresso** (§3.7), **Corpo** (§3.8).
6. **Mais** (perfil, equipamento, backup), polimento offline, Lighthouse, deploy.

Cada marco termina com build + lint + testes verdes e um commit.
