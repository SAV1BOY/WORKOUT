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

Como o **calendário** rotula cada dia da semana (passado pela sessão real; hoje e futuro pela projeção a partir de `ultimo_treino`, começando em hoje) está na **§16**.

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
- **Exercício sem nenhuma série registrada** (decisão de 16/09/2026, vale também na sessão **concluída**): não foi feito, então **não é avaliado** — nem `exercise_state`, nem `progression_events`, e `falhas_seguidas` não muda. O "não concluída" da §6.2 é falha dentro de um exercício que o dono *tentou* (alguma série de trabalho concluída); o bloco inteiro em branco é ausência, não fracasso. Sem esta regra, andar pelos exercícios com o "Próximo passo" da §14.1 e tocar em "Concluído" tiraria 10 % da carga de exercícios nunca tentados. O resumo do fim (§6.6 e §14.1.5) diz "Não foi feito nesta sessão, então não conta como falha: …" e as séries em branco continuam indo para o banco como sempre.

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

---

## 13. Camada visual v2 — decisão de 15/09/2026 (adendo)

Depois de o app ficar pronto (marcos 1–6 e auditoria final), o dono pediu que o site e o PWA tenham o apelo visual dos apps de treino de celular (cards com foto de capa, faixa da semana, vitrine de coleções, relatório com histórico) **sem perder o que é nosso**: registro por série com carga, motor de progressão, conteúdo dos JSON, offline. Este adendo **revoga parcialmente a §11** (entra gamificação sóbria, definida abaixo) e **substitui a §3** onde conflitar. Tudo o que não está aqui continua valendo.

### 13.1 Regras que não mudam
- Conteúdo só dos JSON. Coleções, desafios e "dificuldade" são **derivados** por código a partir de `data/*.json`; nada de rotinas inventadas nem texto de marketing. Fotos: só as de `assets/` (fotos de execução, fotos dos itens, figuras). Imagem de terceiros só nas condições da §15.
- Estilo: o **sóbrio atual** (tema escuro de verdade `#0a0a0a`, uma cor de destaque laranja, tema claro disponível), agora com cards arredondados, capas em foto com gradiente, números grandes, faixa da semana. Sem confete.
- Celular primeiro a 360 px, alvos ≥ 44 px, pt-BR com vírgula, dd/MM, semana na segunda; offline como na §8; motor e montagem intocados (§6).
- Não há vídeos no kit. A "demonstração" de cada exercício é a **figura animada** + as **duas fotos**. Fica preparado um vídeo **opcional** local: se existir `assets/videos/<id>.mp4` (copiado para `public/videos/` pelo `npm run assets`), a ficha e o bloco da sessão mostram um `<video muted loop playsinline>` no lugar da figura; sem o arquivo, nada muda. Nenhum vídeo é entregue.
- Sem kcal (não há sensor; seria chute). O relatório mostra treinos, minutos e volume, que são medidos.

### 13.2 Navegação (5 abas, mistura das duas referências)
`Treino · Explorar · Relatório · Corpo · Mais`
- **Treino** (`/`) substitui Hoje e absorve Treinar: é a aba mais importante.
- **Explorar** (`/explorar`) substitui o catálogo como porta de entrada; `/exercicios` e `/exercicios/[id]` continuam existindo (a ficha é a mesma).
- **Relatório** (`/relatorio`) substitui Progresso (`/progresso` redireciona) e ganha histórico, contadores e sequência.
- **Corpo** e **Mais** continuam; Corpo ganha o IMC.
- `/treinar`, `/treinar/[sessionId]`, `/cardio/[id]`, `/barra-fixa`, `/calendario` continuam como rotas (chegam pelos cards).

### 13.3 Treino (`/`)
1. **Cabeçalho**: saudação com o dia ("Terça, 15/09"), **sequência** (semanas seguidas com a meta cumprida, com o ícone de chama) e a **faixa da semana** seg–dom: dia de hoje em destaque, ✓ nos dias feitos, ponto nos planejados, cinza no faltou; abaixo, **"Meta semanal: 2/5"** (feitos ÷ meta). A meta padrão = sessões de força da fase (3 ou 4) + 2 de cardio; editável em Mais → Preferências (`prefs.meta_semanal`, inteiro). Tocar na faixa abre `/calendario`.
2. **Hoje**: um card por sessão do dia, **todas** (força, cardio, reps soltas de barra fixa no descanso, "treinar mesmo assim" nos dias sem força):
   - **Força**: capa em foto (a foto `-1.jpg` do primeiro exercício do treino, com gradiente escuro), nome do treino e subtítulo do JSON, `44 min · 6 exercícios`, raios de dificuldade, botão largo **"Começar treino"**. Se houver sessão aberta, o card vira "Continuar" com o progresso (séries feitas/total).
   - **Cardio**: capa (foto de `corrida-no-lugar-com-a-corda-1.jpg` para corda; para corrida, a figura de `salto-basico` ou um gradiente com ícone — nunca imagem de terceiros), "Corrida · semana 3 · 6 × (2 min / 2 min) · 34 min", "Começar", alternativa corda.
   - **Descanso**: card de reps soltas com "+1" e o total do dia; caminhada leve no domingo.
3. **Lista do treino do dia** (abaixo dos cards): um item por exercício com **miniatura** (figura animada, ou a foto `-1.jpg`), nome, prescrição e **carga de hoje** com o rótulo do implemento (`3 × 5 · 9,5 kg na barra`, `2 × 8–12 · 1,5 kg por halter`, `3 × 30–60 s`), raios de dificuldade, ícone ⇄ para substituir e toque para abrir a ficha. A linha "subiu +2 kg no treino de 12/09" continua (§6.6).
4. **Sessão** (`/treinar/[sessionId]`): mesma lógica de registro por série (§3.2), com o visual novo: cabeçalho do bloco com **capa em foto ou figura animada grande**, "próximo: …" no rodapé, timer de descanso como hoje. Nada muda no que é gravado.

### 13.4 Explorar (`/explorar`)
Vitrine de **coleções derivadas** dos JSON, cada uma com capa (foto de um exercício da coleção), título, `N exercícios · ~M min`, raios, e botão **"Começar"** que abre uma **sessão livre**:
- **Treino de hoje** em destaque no topo (o mesmo card da aba Treino).
- **Parte do corpo em foco**: chips dos 8 grupos (`grupo` de `exercicios.json`); cada um lista os exercícios do grupo e oferece "Começar" com os 6 primeiros do grupo que usam equipamento disponível (ordem: compostos primeiro, depois isolamento, como a tabela de faixas de `progressao.json`).
- **Por aparelho**: os 10 itens de `equipamentos.json` com a foto de `assets/itens/<item>/` e os exercícios que ele permite.
- **Circuitos** (os 14 exercícios de `origem = "aparelho"`): "Core no tatame" (8), "Corda" (3), "Elástico" (3). Abrem no **modo circuito guiado** (13.6).
- **Planos e desafios**: "Primeira barra fixa em 12 semanas" (`cardio.barra_fixa`), "Correr 5 km em 12 semanas" (`cardio.corrida`) e "Corda: 5 estágios" (`cardio.corda`), cada um com barra de progresso pela semana atual do perfil e o botão da sessão da semana. "Desafio" aqui é o plano real com progresso visível; não existe desafio inventado.
- **Treinos do programa**: A1, B1, SA, IA, SB, IB com "Fazer hoje" (vale como próximo da alternância, §5.3).
- **Busca** por nome de exercício e de coleção, sem acento.

**Sessão livre**: `sessions.workout_id = 'livre'`, com a lista de exercícios e prescrições guardada em `sessions.plano` (jsonb, coluna nova com migração idempotente em `supabase/schema.sql`, refletida em `lib/types.ts`, no mock e no backup). Registra por série como qualquer sessão; a progressão por exercício vale igual (§6), porque o estado é por exercício.

**Dificuldade (raios 1–3)**: derivada da `categoria` do exercício (`composto_pesado` = 3, `composto_moderado` = 2, `isolamento` e `core_peso_corporal` = 1); a coleção mostra a maior. Nunca editada à mão.

### 13.5 Relatório (`/relatorio`)
1. **Contadores** no topo: treinos concluídos (força + cardio) · minutos treinados · volume da semana (Σ reps × kg).
2. **Histórico**: faixa da semana (a mesma do Treino) com navegação por semanas; **"Todos os registros"**: lista por data (sessões de força com treino, duração, séries e ↑/=/↓; cardio com tipo, semana e duração; reps soltas), toque abre o resumo da sessão. **Sequência de dias** (dias seguidos com qualquer sessão) e **sequência de semanas** com meta cumprida.
3. Os gráficos e a lista de recordes da §3.7 continuam abaixo.
4. Card **Peso** (atual, maior, menor, gráfico pequeno) e card **IMC** com a escala colorida (15–40; faixas abaixo de 18,5 / 18,5–25 / 25–30 / 30–35 / 35+ com o rótulo em pt-BR) e a altura editável — ambos linkando para Corpo.

### 13.6 Modo circuito guiado (só peso corporal, corda e elástico)
Player por tempo para as coleções "Circuitos" e para qualquer sessão livre composta só de exercícios com `implemento` em `peso_corporal · corda · band · anilha` (anilha = abdominal com anilha): tela cheia com figura animada grande, nome, **contagem regressiva** (exercícios de tempo) ou **contador de reps com "Feito"** (exercícios de reps), descanso entre exercícios com "próximo: …", voz opcional (`speechSynthesis` pt-BR, `prefs.cardio_voz`) e vibração, pausar/pular/voltar, tela acesa. Ao terminar grava a sessão (`workout_id 'livre'`, séries com tempo/reps) como qualquer outra — o registro passa pelo IndexedDB e pela fila. Exercícios com barra, halteres ou polia **nunca** entram no player: para eles vale o registro por série.

### 13.7 Corpo e Mais
- Corpo: aba Peso ganha o card IMC (mesmo da 13.5) com a altura editável; o resto igual.
- Mais → Preferências: "Meta semanal" (inteiro, padrão calculado pela fase), "Voz no circuito", "Mostrar raios de dificuldade" (liga/desliga).

### 13.8 Critérios de aceite do adendo
1. A 360 px, no escuro e no claro: Treino mostra a faixa da semana, a meta, todos os cards do dia e a lista com miniatura, prescrição e carga com o rótulo certo; nada corta, nada rola de lado, alvos ≥ 44 px.
2. Explorar lista as coleções derivadas (8 grupos, **9** aparelhos — o `kit-100kg` não habilita exercício nenhum sozinho: os exercícios trazem `anilhas`, `halteres` e `barra-w`, que não são ids de `equipamentos.json`, e coleção vazia não vira card —, 3 circuitos, 3 planos, 6 treinos) com capas vindas de `assets/`; o subtítulo das coleções de aparelho e de circuito é o campo `specs` do item (campo do JSON, como a §14.4 pede); "Começar" abre uma sessão livre que registra e progride; a busca funciona sem acento.
3. O circuito guiado roda um circuito de core do início ao fim com voz/vibração (mocks) e grava a sessão; nunca aceita exercício de barra/halter/polia.
4. Relatório mostra contadores, histórico com "todos os registros", sequências e IMC; `/progresso` redireciona.
5. Vídeo opcional: com um `assets/videos/<id>.mp4` de teste presente, a ficha mostra o vídeo; sem ele, a figura.
6. Nada de conteúdo inventado: nenhum nome de coleção, texto de capa ou dificuldade escrito à mão que não seja derivado dos JSON (os rótulos de UI como "Parte do corpo em foco" são UI, não conteúdo).
7. Lint, build, `npm test` e `npm run e2e` verdes, com e2e novos para 13.3–13.6; os e2e antigos ajustados às rotas novas sem afrouxar o que verificam.


---

## 14. Adaptação à referência "Treino em Casa" — decisão de 15/09/2026 (adendo v2.1)

O dono enviou 16 telas do app *Home Workout / Treino em Casa* (Leap Fitness) e pediu que o site e o PWA fiquem **quase idênticos** no uso, mantendo o que é nosso. A análise tela a tela está em `docs/analise-referencia-treino-em-casa.md`; o estudo dos apps e do open source em `docs/estudo-apps-de-treino.md`. Este adendo **complementa a §13 e prevalece sobre ela onde conflitar**. Continuam valendo §13.1 (regras que não mudam), a paleta escura com laranja, o conteúdo só dos JSON, o motor e a montagem intocados, o offline da §8.

### 14.1 Player unificado (substitui a tela de sessão com rolagem como caminho principal)
Toda sessão (treino do programa, sessão livre, circuito, sessão de barra fixa) roda no player, em `/treinar/[sessionId]`, com estas telas em sequência:
1. **Preparação**: "PREPARADO PARA COMEÇAR", nome do 1º exercício com "?" (abre a ficha por cima), anel de contagem (padrão 10 s, `prefs.preparacao_s`), botão pular. Aparece **ao começar**. **Decisão de 15/09/2026**: ao *retomar* uma sessão aberta ela **não** reaparece — vale a regra do fim desta seção ("fechar e reabrir volta ao mesmo passo"), que é o que não faz perder um descanso em andamento nem repetir uma contagem no meio do treino.
2. **Exercício** — a mesma tela para todos, com o passo dependendo do tipo (`implemento` e `prescricao.tipo`):
   - **Carga** (barra_macica · halteres · barra_w · polia · barra_fixa com lastro): figura animada grande (ou vídeo local), barra fina de progresso do treino, nome + "?", `Série 1 de 3`, **carga de hoje com o rótulo do implemento** e **reps** em números grandes (≥ 28 px, tabulares), steppers − / + para carga (passo = incremento do exercício, sempre alcançável via `lib/montagem.ts`) e reps (±1), toque no número abre teclado numérico, "montagem" mostra as anilhas, linha "anterior: 9,5 kg × 5" quando houver; o **✓ conclui a série** (grava no IndexedDB antes de qualquer animação) e abre o **Descanso**. As duas séries de aquecimento do 1º exercício pesado aparecem como passos "Aquecimento 1 de 2". Após a última série de trabalho: **"Última repetição saiu firme?"** com três botões (Fácil · Firme · Falhei → `ultima_firme` true/true/false; "Falhei" também marca a série como abaixo do piso se as reps ficaram abaixo) e nota curta opcional; depois o próximo exercício. Unilateral: dois números (D · E).
   - **Peso corporal / anilha por reps**: `×12` grande com − / +, ✓ conclui a série; séries e descanso iguais.
   - **Tempo** (tempo_s): contagem regressiva grande com pausar; ✓ aparece ao zerar (ou antes, para encerrar); "Repetições ⇄ Tempo" só quando a prescrição do exercício permite os dois (não inventar).
   - **Máximo**: reps feitas com − / + e ✓.
   - **Assistida**: reps + seletor do degrau do elástico.
   - Controles fixos no rodapé: **anterior · ✓ · próximo** (alvos ≥ 56 px); ícones no topo: lista da sessão (visão geral com todas as séries, editável — a tela atual de rolagem vira essa visão geral), ficha "?", **Ajustar** (engrenagem), gostei/não gostei (marca `prefs.evitar_exercicios[]`; "não gosto" joga o exercício para o fim das listas de substitutos e do Explorar).
3. **Descanso** em tela cheia na cor de destaque escurecida: figura do próximo passo, "PRÓXIMO 2/11" (ou "Série 2 de 3"), nome × prescrição, "DESCANSO 00:18" (≥ 72 px, tabular), "Editar tempo de descanso", "+20 s", "Pular". Duração de `descanso_s` do exercício (ou `prefs.descanso_padrao_s` quando definido). Ao zerar: som curto (WebAudio, sempre) + vibração onde existir + a tela avança sozinha para o próximo passo depois de 1 s (configurável: avançar sozinho / esperar toque).
4. **Feedback**: "O que você achou do treino de hoje?" com Muito fácil · Um pouco fácil · Na medida certa · Um pouco difícil · Muito difícil → `sessions.sensacao` 1–5 (5 = muito fácil? **Não**: 1 = muito difícil … 5 = muito fácil, documentar em PROGRESSO.md), botão "Concluído".
5. **Conclusão**: capa (foto -1 do 1º exercício) com "Excelente! Você concluiu o treino." e subtítulo (nome do treino · semana da fase); contadores **Exercícios · Minutos · Volume (kg)**; **resumo do motor** (↑ subiu · = repetiu · ↓ voltou por exercício, recordes, avisos/sugestões) — é o nosso diferencial e fica visível sem rolar muito; card **"Semana N · feitos/meta"** com os 7 círculos seg–dom (✓ nos feitos, hoje preenchido) e um troféu discreto quando a meta fecha; **Peso do dia** (kg, opcional) com o card **IMC** (barra colorida 15–40, faixa em pt-BR, altura editável); botão "Próximo" volta para Treino. Sem confete (§7), sem kcal, sem kg/lb, sem lembrete, sem compartilhar.
- Regras: fechar e reabrir volta ao mesmo passo (estado no Dexie); sem rede tudo funciona; Wake Lock ligado durante o player; nada muda no que é gravado (session_sets, exercise_state, progression_events, profiles.ultimo_treino).

### 14.2 Ficha em folha (bottom sheet) — `components/exercicio/ficha-folha.tsx`
Abre por cima de qualquer tela (Treino, player, Explorar) sem perder estado: título + **Substituir** (mesmo fluxo de substitutos); mídia com três abas **Vídeo · Músculos · Tutorial**: Vídeo = figura animada (ou vídeo local) com botão de pausa; Músculos = figura + mapa frente/costas com primários fortes e secundários claros; **Tutorial** = vídeo do YouTube de `data/tutoriais.json` (81 entradas: `exercicio_id`, `youtube_id`, `titulo`, `canal`, `idioma`, `url`, `nota`; validado em `lib/schemas.ts`, lido por `lib/dados.ts`), mostrado como miniatura `https://i.ytimg.com/vi/<id>/hqdefault.jpg` + play, e só ao tocar vira `<iframe src="https://www.youtube-nocookie.com/embed/<id>">` (sem rede a aba mostra "Precisa de internet" e o botão "Abrir no YouTube"); stepper **Duração / Repetições / Séries** que ajusta **só a prescrição desta sessão** (nunca `exercise_state`); **Instruções** (passos do JSON) e **Erro comum**; **Área de foco** em chips (primário = ponto forte, secundário = claro) a partir de `musculos_*_nome`; histórico e recorde abaixo (como hoje); navegação **anterior/próximo (n/N)** dentro do treino; **Fechar**. A rota `/exercicios/[id]` continua existindo e usa o mesmo componente em página inteira.

### 14.3 Aba Treino — acréscimos à §13.3
Abaixo da lista do treino do dia: **Editar** (modo reordenar com alças e setas ↑↓; ordem só desta sessão, gravada em `sessions.plano` quando a sessão é criada; "voltar à ordem do programa"); FAB **Ajustar** (descanso padrão, preparação, avançar sozinho, voz, vibração, tela acesa, mostrar raios); **Desafios** (carrossel manual, sem rotação automática, com os planos reais: "Primeira barra fixa em 12 semanas", "Correr 5 km em 12 semanas", "Fase 1 — 12 semanas"; capa de `assets/`, semana atual e progresso, botão "Fazer a sessão da semana"); **Parte do corpo em foco** (chips dos 8 grupos → lista com miniatura, `N exercícios · ~M min`, raios, "Começar" = sessão livre com os 6 primeiros do grupo, compostos antes de isolamento); chips de filtro derivados (≤ 15 min · 15–30 min · com equipamento · sem equipamento · core · cardio); **Personalizar treino** ("Crie o seu próprio": escolher exercícios do catálogo e começar uma sessão livre). Sem busca na Treino (fica em Explorar).

### 14.4 Explorar, Relatório, Corpo, Mais — como na §13.4, §13.5 e §13.7, com estes ajustes
- **Explorar**: cabeçalho "Explorar" com busca sempre visível; **um destaque** no topo (o treino de hoje ou a sessão da semana do plano); **"Escolhas para você"** = lista com capa, título, `N exercícios · ~M min · nível (raios)` das coleções derivadas (grupos, aparelhos, circuitos, planos, treinos do programa), com "Ver todos"; catálogo dos 81 abaixo com filtros; toque em coleção → tela da coleção (capa, lista, "Começar"); nada de texto de marketing; descrições só de campos do JSON (foco, subtítulo, regra, funções).
- **Relatório**: contadores treinos · minutos · volume; histórico com faixa da semana, "Todos os registros" e sequências (dias e semanas). **Decisão de 15/09/2026**: os três contadores do topo são **totais acumulados** ("no total": todo o histórico, com as três fontes — sessões de força, cardio e séries — lendo a mesma janela, sem o corte de 26 semanas), e a semana fica no card "Esta semana" logo abaixo (onde vive o volume da semana da §13.5.1); o card da semana conta **só força**, e o diz. **cards Peso e IMC** como na referência (Registrar, atual, maior/menor, gráfico; IMC com barra e "Saudável"/faixa, altura editável); gráficos e recordes; `/progresso` redireciona.
- **Corpo**: IMC na aba Peso; resto igual.
- **Mais → Preferências**: meta semanal, preparação (s), descanso padrão (s, vazio = do exercício), avançar sozinho após o descanso, voz, vibração, tela acesa, mostrar raios, limpar "não gosto".

### 14.5 Critérios de aceite do adendo (além dos da §13.8)
1. Alguém que conhece a referência reconhece cada gesto: Começar → Preparação → Exercício → ✓ → Descanso com o próximo → … → Feedback → Conclusão — **sem tela intermediária**: o botão largo do card do dia cria a sessão e entra no player (`/treinar` continua como rota para escolher o outro treino da fase, §5.3 e §13.2). Verificado no Chromium a 360×740, nos dois temas, com sessões semeadas.
2. Num treino de barra (Treino A), o player registra 3 séries do agachamento com carga e reps, dispara o descanso ao ✓, pergunta "firme?" no fim, e a conclusão mostra o resumo do motor com a subida; fechar o app no meio e reabrir volta ao mesmo passo; offline nada se perde (e2e).
3. Num circuito de core (peso corporal/tempo), o player roda igual à referência (reps com ✓, tempo com contagem) e grava a sessão livre.
4. A ficha em folha abre de Treino, do player e de Explorar com Vídeo · Músculos · Tutorial; o Tutorial só carrega o YouTube ao tocar e some sem rede; o stepper muda só a sessão do dia.
5. Editar/reordenar, Ajustar, gostei/não gostei, Desafios, Parte do corpo em foco e Personalizar existem e funcionam como descrito; nenhum conteúdo inventado (toda string de coleção/desafio vem de campos do JSON ou é rótulo de UI).
6. Relatório e Conclusão mostram Peso e IMC como na referência; nunca kcal; sem confete.
7. Lint, build, `npm test` e `npm run e2e` verdes, com e2e novos para 14.1–14.4 e os antigos ajustados sem afrouxar.

---

## 15. Mídia dos exercícios — decisão de 15/09/2026 (adendo v2.1, marco Mídia)

O kit trouxe 67 figuras animadas para 81 exercícios e nenhum vídeo. Faltava
imagem em 14 exercícios e o boneco do sprite muscular era esquemático demais
para mostrar o que cada exercício trabalha. Em 15/09/2026 o dono decidiu:
**imagem de terceiros é permitida**, com as condições abaixo. Este adendo
**altera a §13.1** (a frase "Nenhuma imagem de terceiros" passa a ser "Imagem
de terceiros só nas condições da §15") e complementa a §14.2; tudo o mais da
§13.1 continua valendo.

### 15.1 Condições (as quatro, juntas — sem qualquer uma delas a imagem não entra)
1. **Licença livre.** Só obra com licença livre e compatível com o uso no app
   (hoje: CC BY-SA 3.0 e 4.0 nas ilustrações, MIT no mapa muscular). Nada de
   "achado no Google", nada de fotografia de pessoa real, nada sem licença.
2. **Procedência gravada no JSON.** `autor`, `licenca`, `url_fonte` e
   `titulo_fonte` de cada arquivo ficam em `data/ilustracoes.json` (validado
   por Zod em `lib/schemas.ts`, lido por `lib/dados.ts`) e no
   `data/ilustracoes-creditos.md` gerado junto. Nenhum crédito escrito à mão
   dentro de componente.
3. **Atribuição visível.** O crédito aparece **sob a mídia na ficha** (folha e
   `/exercicios/[id]`) e a lista completa em **Mais → Créditos**, com o link
   para a obra de origem. Obra derivada de CC BY-SA (redimensionar, converter
   para WebP) mantém a mesma licença.
4. **Texto da licença publicado junto** quando a licença exige que ele
   acompanhe a obra — é o caso da MIT do mapa muscular, cujo aviso de
   copyright é servido em `/mapa-muscular/LICENCA-mapa-anatomico.md` e
   linkado em Mais → Créditos.

### 15.2 Ordem de preferência da mídia de um exercício (`lib/midia.ts`, funções puras)
`vídeo local` (`assets/videos/<id>.mp4`, opcional, §13.1) → **ilustração**
(`data/ilustracoes.json`) → **figura animada** do kit (`assets/figuras/<id>.svg`)
→ **foto de execução** (`assets/fotos/<id>-1.jpg`). Quem não tem ilustração
continua exatamente como antes. Todo caminho sai do JSON; nenhum caminho
escrito à mão.

### 15.3 O que não muda
- **Capas** (cards de treino, cardio, coleções) continuam só com as fotos de
  `assets/` — a §13.3 segue valendo ao pé da letra para elas.

**A exceção das fotos dos itens (decisão de 16/09/2026).** As 95 fotos de
`assets/itens/` (os 10 itens comprados para o terraço) são fotografia de
**anúncio do produto**: obra de terceiro, sem licença livre. Elas não cumprem
a condição 1 da §15.1 e nunca vão cumprir — mas também não são mídia de
exercício: são o **registro particular das compras do dono**, num app de um
usuário só, atrás de login, sem página pública. Ficam no app sob três
condições, e só elas:
1. **Só no inventário.** Aparecem em **Mais → Equipamento** e em mais lugar
   nenhum. Desde 16/09/2026 elas **não são capa** de coleção no Explorar (a
   capa de "Por aparelho" é a mesma das outras coleções, a foto de execução do
   primeiro exercício) — a vitrine do app não mostra imagem sem licença.
2. **Procedência no JSON.** `fotos_dos_itens` em `data/equipamentos.json`
   (`pasta`, `origem`, `licenca`, `uso`), validado em `lib/schemas.ts` e lido
   por `lib/dados.ts`. `licenca` é `null` de propósito: é o que diz que não há
   licença livre aqui.
3. **Dito na cara.** **Mais → Créditos** tem o bloco "Fotos dos itens do
   terraço", montado desse JSON, e a tabela "Créditos de mídia" do README tem a
   linha correspondente. Se um dia o app virar público, ou estas fotos são
   refeitas pelo dono (aí a exceção some) ou saem.
- O motor (§6), a montagem e o que vai para o banco continuam intocados: o
  marco é imagem e crédito, nada mais.
- `npm run validar` continua conferindo que todo arquivo citado nos JSON
  existe, agora incluindo as ilustrações e o mapa.
- A importação (`npm run ilustracoes`, `scripts/importar-ilustracoes.ts`) é
  ferramenta de uma vez só, fora do build e dos portões; o que vale é o
  resultado versionado.

### 15.4 Critérios de aceite
1. Toda imagem de terceiro no app tem autor, licença e link no JSON, crédito
   sob a mídia na ficha e linha em Mais → Créditos (e2e).
2. Mais → Créditos abre o texto completo da licença MIT do mapa.
3. Exercício sem ilustração mostra a figura ou a foto, sem crédito e sem erro.
4. Lint, build, `npm test` e `npm run e2e` verdes.

---

## 16. Semana visível — decisão de 16/09/2026 (adendo, marco Semana)

O dono pediu, com estas palavras: *"Quero que mostre os treinos dos dias e
tenha também o app vai saber que dia da semana é e que treino eu devo fazer em
cada dia da semana, segunda treino x, terça y, semana 3, segunda treino x3,
etc... assim por diante até eu progredir e ir evoluindo sempre."*

O plano já existia (`programa.json` §5, `lib/calendario.ts`), mas a tela não o
dizia: a faixa da semana da aba Treino mostrava só ✓/ponto/traço, sem o nome do
treino de cada dia, e o calendário **rotulava a semana errada** — ver §16.1.
Este adendo complementa a §3.5, a §5.2 e a §13.3; nada muda no que é gravado no
banco, no motor (§6) nem na montagem.

### 16.1 O defeito: a semana corrente projetada da segunda
`semanaDoPlano(inicioDaSemana, perfil)` montava a semana **inteira** a partir de
`profiles.ultimo_treino` **começando na segunda**. Como `ultimo_treino` é o
estado de **agora** (já contando a sessão de segunda), a projeção saía deslocada
um degrau para trás. Caso reproduzido: hoje é quarta 30/09/2026,
`ultimo_treino = A1`, uma sessão A1 concluída na segunda 28/09. A aba Treino
dizia "HOJE Treino B" (certo) e o calendário dizia seg 28 "Treino B ✓" (foi A),
qua 30 "Treino A" (é B) e sex 02 "Treino B" (será A) — as duas telas discordando
sobre o mesmo dia.

### 16.2 A regra de rotulagem da semana (§3.5 e §5.2 item 3)
Numa semana da **Fase 1** (treino "alternar"), dia a dia, de segunda a domingo:
1. **Override com `workout_id`** (§3.5): vale ele, em qualquer dia — passado,
   hoje ou futuro.
2. **Dias passados** (`data < hoje`): vale a **sessão que existe naquele dia**,
   concluída ou parcial — o treino que de fato foi feito. Sem sessão, o dia é
   "não feito" e mostra **o treino que era esperado naquele momento**: o próximo
   da alternância depois da última sessão de força **anterior** àquela data. Sem
   nenhuma sessão anterior conhecida, o dia fica só "Treino de força".
3. **Hoje e os dias futuros**: a projeção da alternância **a partir de hoje**,
   ancorada em `profiles.ultimo_treino` — nunca a partir da segunda. Cada dia de
   força projetado avança a âncora; um dia passado **nunca** a avança
   (`ultimo_treino` já o contabilizou).
4. **Semanas seguintes** continuam a projeção **de onde a semana corrente
   terminou**: a âncora ao fim de uma semana é o ponto de partida da próxima, e
   assim por diante, semana após semana.
5. **Fase 2**: os treinos são **fixos por dia da semana** (SA seg, IA ter, SB
   qui, IB sex) — nada aqui muda nada.
6. **Semana curta** (§5.4) e overrides continuam valendo **por cima** do que
   esta regra produziu.

Implementação: `semanaCoerente()` / `semanaEEstado()` em `lib/calendario.ts`
(funções puras). `semanaDoPlano()` continua existindo para quem projeta uma
semana solta, e recebe o ponto de partida certo. `montarGrade()` (`lib/semana.ts`)
passa a montar a semana por `semanaCoerente()`, com `hoje` e as sessões do
período — é a mesma fonte para o calendário, para a faixa e para o card do dia,
de modo que **as duas telas nunca discordam**.

### 16.3 A faixa da semana com o treino de cada dia (§13.3 item 1)
Sob o número do dia, um **rótulo curto** derivado do plano daquele dia:
- **força** → a sigla do treino: `A`, `B` (Fase 1), `SA`, `IA`, `SB`, `IB`
  (Fase 2); sem treino conhecido, `Força`;
- **cardio** → `Corr.`, `Corda`, `Longa` ou `Cam.`, conforme a sessão do dia;
- **descanso** → `Desc.`

Continuam o ✓/ponto/traço e o destaque de hoje; tocar na faixa continua abrindo
`/calendario`. O `title`/`aria-label` do dia passa a trazer o nome completo:
`"quarta 30/09: Treino B, hoje"`. A 360 px são sete colunas de ≥ 44 px, fonte
≥ 11 px, nada corta e nada rola de lado.

### 16.4 A semana da fase nos cards (§3.5 e §13.3)
- Cabeçalho do `/calendario`: **"Fase 1 · semana 3 de 12"** (12 =
  `SEMANAS_PARA_FASE2`, o ponto em que o app sugere a Fase 2, §5.1); na Fase 2,
  só **"Fase 2 · semana N"**. Navegar para outra semana mostra a semana **daquela**
  semana.
- Cada dia de força na grade: **"Treino A · semana 3"** (a semana da fase).
- Cada dia de cardio na grade: **"Corrida · semana 3 do plano"** (a semana do
  plano de corrida/corda do perfil, §5.5).
- O card do dia na aba Treino ganha a mesma semana da fase; o card de cardio já
  trazia "semana N" do plano (§13.3 item 2).

### 16.5 Critérios de aceite
1. Com uma sessão A1 concluída na segunda e hoje na quarta, a faixa da aba
   Treino, o card do dia e o `/calendario` dizem **a mesma coisa**: seg "Treino
   A ✓", qua "Treino B" (hoje), sex "Treino A". A semana seguinte começa em
   "Treino B", qua "A", sex "B" (unitário e e2e, nos dois temas).
2. Um dia passado sem sessão mostra o treino que era esperado naquele momento e
   a marca de não feito; sem nenhuma sessão anterior, só "Treino de força".
3. A faixa mostra a sigla do treino de cada dia a 360 px sem cortar e sem
   rolagem lateral, com alvos ≥ 44 px, e o `aria-label` traz o nome completo.
4. Na Fase 2 a faixa e o calendário mostram SA · IA · corrida · SB · IB ·
   corrida longa · descanso, fixos, em qualquer semana.
5. O cabeçalho do calendário mostra a fase e a semana da fase, e acompanha a
   navegação entre semanas.
6. Override e semana curta continuam valendo por cima da rotulagem.
7. Lint, build, `npm test` e `npm run e2e` verdes, com e2e novos para esta seção
   e os antigos ajustados sem afrouxar o que verificam.
