# Treino do Terraço — especificação do app

App pessoal de um usuário só (Miguel) para **fazer, registrar e evoluir** a rotina de treino do guia da garagem: o que fazer hoje, checkbox por série com repetições e carga, quando subir peso ou repetições, histórico completo, peso corporal, medidas e fotos. Português do Brasil, celular primeiro (é usado no terraço, com o celular na mão, entre uma série e outra).

Tudo que é conteúdo de treino — exercícios, programa, cardio, regras de progressão, equipamento — já está pronto em `data/*.json` e `assets/`. **O app não inventa conteúdo: lê os JSON.** O banco guarda só o que o usuário faz.

---

## 1. Decisões fechadas

| Tema | Decisão |
|---|---|
| Stack | Next.js 15 (App Router, TypeScript, React 19) · Tailwind · shadcn/ui · Supabase (Postgres, Auth, Storage) · Vercel |
| Forma | PWA instalável no celular (manifest + service worker), tema claro/escuro, funciona sem sinal durante o treino (ver §8) |
| Usuário | Contas com cota (**§21**, 17/09/2026): qualquer pessoa cria conta pela tela de login enquanto houver vaga, e o dono ajusta o limite em Mais → Contas. `ALLOWED_EMAIL` é o e-mail do **dono** — quem administra a cota. Login por e-mail + senha no Supabase Auth; RLS por `auth.uid()` isola os dados de cada conta |
| Conteúdo | Catálogo (81 exercícios), programa (2 fases, 6 treinos), cardio e regras vêm de `data/*.json` **embutidos no build** (importados como módulos tipados). Nada disso vai para o banco |
| Dados do usuário | Supabase, schema em `supabase/schema.sql` (11 tabelas + view + bucket, mais `app_config` — a cota da §21), RLS por `user_id` |
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
| `assets/mapa-muscular/` | Mapa anatômico SVG (`mapa-anatomico.svg`, MIT) com um grupo por músculo, o CSS das classes `p-<musculo>` / `s-<musculo>` e a licença | Componente `MapaAnatomico` (§7) |
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

**"Como usar o app"** é a primeira linha da lista e abre o guia de uso da §20.

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

A **semana da fase** deixa de ser lida direto do `programa.json` quando o usuário escolhe os seus dias de treino: quem manda no item 2 passa a ser a semana montada por `semanaPersonalizada()` a partir de `profiles.prefs.dias_de_treino` — ver **§17**.

### 5.3 Treino fora do dia
Treinar num dia de descanso ou cardio é permitido ("Treinar mesmo assim"): a sessão vale como o próximo treino da alternância e o calendário mostra o desvio. Corrida e treino de perna no mesmo dia: avisar (regra do guia: 6 h de intervalo, força primeiro), não bloquear.

### 5.4 Semana curta
Ao marcar um dia como "não vou treinar", o app reorganiza o resto da semana na ordem de sacrifício do guia: 1º corrida de sábado, 2º segunda sessão de cardio, 3º um treino de força — **nunca** o treino com agachamento/terra (A1, B1, IA, IB têm; se sobrar um dia só na semana, é o Treino A).

### 5.5 Semanas dos planos de cardio e barra fixa
`semana_corrida` avança quando as 2 sessões de corrida da semana civil foram concluídas; se a semana passar com 0 sessões, a semana do plano **não muda** (repete); com 1 sessão, repete também (regra "repita a semana anterior em vez de pular"). Igual para corda (`semana_corda`) e barra fixa (`semana_fixa`, 2 sessões). Tudo ajustável no perfil.

Quando a pausa passa de uma semana — viagem, gripe, a vida —, o que o app oferece ao voltar (continuar, recomeçar a semana, voltar mais leve ou recomeçar do zero, conforme os dias parado) está na **§18**.

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
- **MapaAnatomico**: `assets/mapa-muscular/mapa-anatomico.svg` inline no servidor, com as classes `p-<musculo>` e `s-<musculo>` do exercício; cores por CSS variables (ver `assets/mapa-muscular/README.md`). O sprite antigo do boneco (`#bf`/`#bb`) e o componente `MapaMuscular` saíram do app no lote 4 (§22.4 item 8).
- **TimerDescanso**: barra fixa no topo, contagem regressiva, vibração (`navigator.vibrate`) + som curto ao zerar, botão pular / +30 s.
- **TimerIntervalos** (cardio): blocos com cor por tipo, próximo bloco visível, fala opcional ("corrida", "caminhada") via `speechSynthesis` em pt-BR.
- **StepperNumerico**: − valor + com passo configurável e digitação direta; teclado numérico (`inputMode="decimal"`).
- Copiar os assets para `public/figuras`, `public/fotos`, `public/itens`, `public/mapa-muscular` no scaffold (script `scripts/copiar-assets.ts`).

Design: sóbrio, alto contraste, tipografia grande nos números (é lido a um braço de distância, no sol do terraço), tema escuro de verdade (não cinza), cor de destaque única. Sem confete, sem gamificação barata; a recompensa é o gráfico subindo. **Gamificação sóbria = §13 e §19**: contadores, números por tipo e conquistas derivadas dos registros — nunca confete, som, pontos, níveis, ranking ou compartilhamento.

---

## 8. Offline e sincronização

- Service worker (Serwist/`@serwist/next`) com precache do shell, das figuras e das fotos do programa atual; fotos do catálogo inteiro em cache sob demanda.
- **Sessão em andamento vive no cliente** (IndexedDB via Dexie ou `idb-keyval`): cada toque é salvo localmente na hora. Uma fila de saída (`outbox`) envia para o Supabase o que mudou (série concluída, sessão finalizada, peso, cardio). Se estiver sem rede, a fila espera e reenvia ao voltar (`online` event + retry com backoff). Nunca perder uma série registrada por falta de sinal.
- Leitura: TanStack Query com cache persistido; a tela Hoje abre com os dados da última sincronização e atualiza em segundo plano.
- Conflitos: um usuário, um aparelho por vez — última escrita vence; `sessions.id` gerado no cliente (uuid) para permitir criar offline.

---

## 9. Autenticação e segurança

- Supabase Auth, e-mail + senha (magic link opcional). **Desde a §21** o app não é mais de um usuário só: o middleware só exige sessão, quem pode criar conta é decidido pela cota no banco (`on_auth_user_vaga`) e `ALLOWED_EMAIL` passou a significar *o dono* — quem vê e muda a cota em Mais → Contas. A regra antiga ("e-mail diferente → sair e mostrar 'app pessoal'") **não existe mais**; ver §21.
- RLS em todas as tabelas (`user_id = auth.uid()`; a única sem `user_id` é `app_config`, presa a `public.sou_o_dono()` — §21.2), bucket `progresso` privado com policy por pasta do usuário. Chaves `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no cliente; **nunca** a service role no cliente.
- Backup: exportar JSON de todas as tabelas do usuário; importar restaura (idempotente por id).

---

## 10. Critérios de aceite (o que precisa funcionar antes de dizer "pronto")

1. Login com o e-mail do dono; qualquer pessoa cria conta enquanto houver vaga na cota, e com a cota cheia o cadastro é recusado (critérios completos na §21.5).
2. No primeiro login **do dono** (§21.3; as outras contas nascem com os defaults do schema) o perfil é criado com `data/perfil.json` e a tela Hoje mostra "Treino A · 6 exercícios · 44 min" numa segunda-feira, com as cargas iniciais (7,5 kg na barra, 1,5 kg por halter, 4 kg no pino).
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
- Mais: a linha **"Como usar o app"** no topo da lista abre o guia de uso (§20).

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
Abaixo da lista do treino do dia: **Editar** (modo reordenar com alças e setas ↑↓; ordem só desta sessão, gravada em `sessions.plano` quando a sessão é criada; "voltar à ordem do programa"); **Ajustar** no cabeçalho, ao lado da data (descanso padrão, preparação, avançar sozinho, voz, vibração, tela acesa, mostrar raios); **Desafios** (carrossel manual, sem rotação automática, com os planos reais: "Primeira barra fixa em 12 semanas", "Correr 5 km em 12 semanas", "Fase 1 — 12 semanas"; capa de `assets/`, semana atual e progresso, botão "Fazer a sessão da semana"); **Parte do corpo em foco** (chips dos 8 grupos → lista com miniatura, `N exercícios · ~M min`, raios, "Começar" = sessão livre com os 6 primeiros do grupo, compostos antes de isolamento); chips de filtro derivados (≤ 15 min · 15–30 min · com equipamento · sem equipamento · core · cardio); **Personalizar treino** ("Crie o seu próprio": escolher exercícios do catálogo e começar uma sessão livre). Sem busca na Treino (fica em Explorar).

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
2. **Dias já vividos** (`data <= hoje` quando existe sessão no dia): vale a
   **sessão que existe naquele dia**, concluída ou parcial — o treino que de
   fato foi feito, inclusive no próprio dia de hoje depois de treinar. Num dia
   **passado** sem sessão, o dia é "não feito" e mostra **o treino que era
   esperado naquele momento**: o próximo da alternância depois da última sessão
   de força **anterior** àquela data. Sem nenhuma sessão anterior conhecida, o
   dia fica só "Treino de força".
3. **Hoje sem sessão e os dias futuros**: a projeção da alternância **a partir de hoje**,
   ancorada em `profiles.ultimo_treino` — nunca a partir da segunda. Cada dia de
   força projetado avança a âncora; um dia passado — e o dia de hoje que já tem
   sessão — **nunca** a avança (`ultimo_treino` já o contabilizou).
4. **Semanas seguintes** continuam a projeção **de onde a semana corrente
   terminou**: a âncora ao fim de uma semana é o ponto de partida da próxima, e
   assim por diante, semana após semana.
5. **Fase 2**: os treinos são **fixos por dia da semana** (SA seg, IA ter, SB
   qui, IB sex) — nada aqui muda nada.
6. **Semana curta** (§5.4) e overrides continuam valendo **por cima** do que
   esta regra produziu.
7. **Treino feito num dia que o plano dizia descanso ou cardio** ("Treinar mesmo
   assim", §5.3 — e, desde a §17, qualquer dia não escolhido): o dia mostra a
   **sigla do treino** e a marca de feito, não "Desc." sem marca. A sessão já
   contava na meta semanal e no Relatório; era só o histórico visual que a
   escondia (correção de 16/09/2026). Um **cardio** feito num dia de descanso
   ganha a marca de feito e mantém o rótulo do plano. Com **override** no dia,
   vale o override (item 1).

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
- **Antes do começo da fase** (navegar para trás passa de `fase_desde`) não há
  semana para contar: o cabeçalho mostra só **"Fase 1"** e os dias só o nome
  ("Treino de força", "Corrida") — nunca "semana 0" ou "semana −1".

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
   navegação entre semanas — sem "semana 0" ou negativa antes de `fase_desde`.
6. Override e semana curta continuam valendo por cima da rotulagem.
7. Lint, build, `npm test` e `npm run e2e` verdes, com e2e novos para esta seção
   e os antigos ajustados sem afrouxar o que verificam.

---

## 17. Dias de treino — decisão de 16/09/2026 (adendo, marco Dias)

O dono pediu, com estas palavras: *"ter a opção do usuario selecionar quais
dias ele vai treinar, tipo, segunda, terça, quarta, quinta, sexta e sabado,
domingo não e o plano ser personalizado desta forma, e ele vai ver no historico
quantas vezes o usuario treinou na semana e se voltar na proxima ele vai falar
qual treino ele deve fazer e o que deve fazer."*

Até aqui a semana era a do `programa.json` e ponto: seg/qua/sex de força,
ter/sáb de cardio, qui/dom de descanso (Fase 1). Quem treina sábado e não
segunda via o app dizer "descanso" no dia em que ia treinar. Este adendo põe os
**dias** nas mãos do usuário e faz o resto do app ler a semana que sai daí —
sem mudar o motor (§6), a montagem (§6.5) nem nada do que se grava no banco
além de `profiles.prefs`.

### 17.1 Onde se escolhe
- **Mais → Preferências**, card **"Dias de treino"**: sete chips `seg ter qua
  qui sex sáb dom`, cada um um alvo de ≥ 44 px que liga e desliga (`aria-pressed`),
  com a contagem do que a escolha produz por baixo ("3 de força · 2 de cardio ·
  1 livre"). Salva como as outras preferências: sobe pela fila (§8) e o cache do
  TanStack Query é invalidado, então a aba Treino e o `/calendario` mudam na hora.
- **Calendário**: um atalho **"Meus dias"** no cabeçalho leva ao mesmo card.
- Guardado em **`profiles.prefs.dias_de_treino`**: um array de `'seg' | 'ter' |
  'qua' | 'qui' | 'sex' | 'sab' | 'dom'`, na ordem da semana, sem repetição.
  Nada muda no `supabase/schema.sql` — `prefs` já é `jsonb`.
- **Ausente** (o padrão): vale a semana do `programa.json` tal como está, com as
  notas dos dias de descanso. Quem nunca mexer não vê diferença nenhuma. Os
  chips já nascem marcados nos dias que o programa da fase usa (Fase 1: seg ter
  qua sex sáb; Fase 2: seg ter qua qui sex sáb), e escolher exatamente esses
  dias reproduz o plano do JSON (os mesmos dias de força e de cardio; as notas
  de descanso só vão para os dias **escolhidos** que sobram, item 4).
- **Voltar ao padrão** é um botão do card: apaga a chave e a semana volta a ser
  a do programa.

### 17.2 A distribuição (`lib/dias.ts`, funções puras)
`semanaPersonalizada(fase, diasEscolhidos)` devolve os **sete dias** no mesmo
formato de `programa.fases[fase].semana` (`dia`, `tipo`, `treino` | `sessao`,
`min`, `nota`). Com `diasEscolhidos` ausente (`null`), devolve a semana do JSON
sem tocar em nada. Com uma lista, monta assim:

1. **Força primeiro**, nas quantidades da fase (`frequencia_forca`: 3 na Fase 1,
   4 na Fase 2). Entre todas as maneiras de escolher esses dias entre os
   escolhidos, vence:
   1. **a folga**, quando a fase pede folga — menos pares de dias de força em
      dias **consecutivos**. A fase "pede folga" quando a semana dela no
      `programa.json` não tem dois dias de força seguidos: é o caso da Fase 1
      (corpo inteiro, o guia pede 48 h entre sessões). A Fase 2 alterna superior
      e inferior e o próprio programa põe seg-ter e qui-sex seguidos, então ali
      a folga não pontua;
   2. **a semana do programa** — mais coincidências com os dias de força da
      fase no JSON. É o que faz "seg a sáb" na Fase 1 cair em seg/qua/sex e
      "seg a sáb" na Fase 2 cair em SA seg, IA ter, SB qui, IB sex;
   3. **o começo da semana** — empatado o resto, os dias mais cedo.
   Quando não há como evitar, os dias de força ficam **consecutivos** (a regra
   avisa, não bloqueia — §5.3).
2. **O treino de cada dia de força**: Fase 1 continua `"alternar"` (a escada do
   §5.2 item 3 e do §16.2 decide qual é qual); Fase 2 recebe os treinos da fase
   **na ordem** `SA, IA, SB, IB`.
3. **Cardio** nos dias escolhidos que sobraram, nas quantidades e com os nomes e
   minutos da fase ("corrida" e "corrida ou corda" na Fase 1; "corrida" e
   "corrida longa" na Fase 2), na ordem do programa. Entre os dias que sobraram
   vence: (a) mais coincidências com os dias de cardio da fase no JSON; (b)
   menos dias logo **depois** de um treino de perna (os treinos com agachamento
   ou terra, §5.4 — na Fase 1 os dois treinos têm, então o critério não separa
   ninguém); (c) os dias mais cedo.
4. **Sobra** (dia escolhido que não virou força nem cardio) → **descanso ativo**:
   `tipo: "descanso"` com as notas de descanso do programa, na ordem (1ª sobra:
   o lembrete da barra fixa "grease the groove"; 2ª: caminhada leve). Na tela é
   um **dia livre**, com o "Treinar mesmo assim" da §5.3.
5. **Dia não escolhido** → descanso, sem nota.
6. **Menos dias do que sessões**: corta na **ordem de sacrifício da §5.4** — 1º
   a última sessão de cardio da semana (a corrida de sábado), 2º a outra sessão
   de cardio, 3º um treino de força que **não** tenha agachamento nem terra
   (Fase 2: SB). Com duas correções, porque aqui a escolha é **permanente** e a
   §5.4 foi escrita para uma semana curta (decisão de 16/09/2026, depois da
   auditoria do marco):
   - o corte **nunca deixa a semana só com treinos de perna**: sobrando **dois**
     dias na Fase 2, é um superior e um inferior (**SA e IA**), não IA e IB —
     senão peito, costas e ombro ficariam de fora da semana inteira;
   - sobrando **um dia só**, na Fase 2 ele é o **Treino A** (`SA`); na **Fase 1**
     ele continua `"alternar"`, e é a alternância do §5.2 item 3 que diz se hoje
     é A1 ou B1 — prender o único dia no Treino A faria o levantamento terra do
     Treino B nunca chegar (`proximoTreinoAlternado(null)` já começa em A1 para
     quem está começando).

   Com zero dias escolhidos a semana é toda de descanso.

### 17.3 O que passa a ler a semana montada
`tipoDoDia()`, `montarDia()`, `treinoDeHoje()`, `sessaoCardioDeHoje()`,
`semanaDoPlano()`, `semanaCoerente()`/`semanaEEstado()` (§16.2),
`montarGrade()`/`montarMes()` (`lib/semana.ts`), a semana curta (§5.4) e
`oQueFaltaNaSemana()` passam a receber o **perfil** (que carrega `prefs`) em vez
da fase solta, e a fase é resolvida por `semanaDoPerfil(perfil)`. A regra de
rotulagem da §16.2 não muda: ela só passa a correr sobre os dias escolhidos.

- **Próximo treino**: a alternância da Fase 1 e a ordem fixa da Fase 2 continuam
  ancoradas em `profiles.ultimo_treino`, agora sobre os **dias de força
  escolhidos**. Abrir o app num dia escolhido de força mostra o card do dia com
  o treino certo e a lista do que fazer; num dia não escolhido mostra
  **"Descanso"** com **"Treinar mesmo assim"**.
- **Meta semanal** (§13.3): o padrão passa a ser o número de sessões da semana
  **montada** (força + cardio), a menos que `prefs.meta_semanal` esteja
  definido. `metaSemanalPadrao(fase, prefs)`.
- **Histórico**: a faixa da semana, a "Meta semanal N/M" da aba Treino e o
  Relatório (contadores da semana, sequência de semanas) contam contra a semana
  personalizada. Nada muda no que se grava em `sessions`, `cardio_sessions` ou
  `schedule_overrides`.
- **Overrides e semana curta** continuam valendo **por cima** da semana montada,
  como na §16.2 item 6.

### 17.4 Critérios de aceite
1. Sem `prefs.dias_de_treino` o app é idêntico ao de antes: a semana da Fase 1 é
   seg força · ter corrida · qua força · qui descanso (barra fixa) · sex força ·
   sáb corrida ou corda · dom descanso (caminhada leve).
2. Escolhendo **seg a sáb** na Fase 1: força em seg, qua e sex (nunca dois dias
   seguidos), cardio em ter e sáb, quinta como **dia livre** com a nota da barra
   fixa e domingo como descanso. A faixa da aba Treino e o `/calendario` dizem a
   mesma coisa.
3. Escolhendo **seg, qua e sex**: três dias de força e **nenhum** cardio (as
   duas sessões caíram na ordem da §5.4); a meta semanal padrão passa a ser 3.
4. Escolhendo **dois dias**: dois treinos de força e nenhum cardio (na Fase 2,
   SA e IA — nunca dois de perna). Escolhendo **um dia**: na Fase 2 o Treino A;
   na Fase 1 o dia é "alternar" e a alternância segue semana a semana.
5. Escolhendo os **sete dias**: as duas sobras viram dias livres com as notas do
   programa (barra fixa e caminhada leve).
6. Fase 2 com **seis dias**: SA, IA, SB e IB nos quatro dias de força mais as
   duas sessões de cardio. Fase 2 com **quatro dias**: só os quatro de força.
7. Abrir o app num dia **não escolhido** mostra "Descanso" e o botão "Treinar
   mesmo assim" — treinar ali continua valendo como o próximo da alternância
   (§5.3).
8. O card "Dias de treino" a 360 px: sete chips de ≥ 44 px, nada corta, nada
   rola para o lado, e a escolha sobe pela fila quando não há rede.
9. Lint, build, `npm test` e `npm run e2e` verdes, com unitários para cada caso
   da §17.2, a propriedade "nunca dois dias de força seguidos na Fase 1 quando
   havia alternativa", e e2e novos desta seção, os antigos ajustados sem
   afrouxar o que verificam.

---

## 18. Retomada — decisão de 16/09/2026 (adendo, marco Retomada)

O dono pediu, com estas palavras: *"se ele não finalizar a semana ou os dias,
ter a opção de resetar ou de continuar, dependendo de quantos dias foi desde o
ultimo treino"*

O guia tem uma regra só para isso, e é de cardio: *"se uma semana der errado —
viajou, gripou, doeu algo —, repita a semana anterior em vez de pular para a
seguinte"* (já é a §5.5). Para a força não há regra de volta de pausa escrita em
lugar nenhum — mas o motor já tem o mecanismo certo: a **semana leve** da §6.2
(60 % da carga, com `carga_antes_leve` para devolver a carga na sessão
seguinte). Este adendo usa esses dois mecanismos e **não muda uma linha do
motor** (§6) nem da montagem (§6.5): a semana leve passa a ser acionada por
**dados**, não por código novo.

### 18.1 Dias parado
`diasParado(hoje, sessoes, cardios, fixas)` em **`lib/retomada.ts`** (funções
puras, sem React nem Supabase): os **dias inteiros de calendário** entre hoje e
a última atividade — sessão de força **concluída** (`sessions.status =
'concluida'`, incluídas as de barra fixa, `workout_id = 'fixa'`), sessão de
cardio concluída (`cardio_sessions.concluida`) ou repetição solta de barra fixa
(`pullup_singles`). Sem nenhuma atividade o resultado é `null`: quem nunca
treinou não está voltando de pausa nenhuma, e o card não aparece.

A conta corre **ao abrir a aba Treino** e de novo a cada gesto que começa um
treino (§18.3).

Uma ressalva, e é ela que segura o card de pé: enquanto a pausa **não foi
decidida**, a atividade registrada **hoje** não a apaga. Sem isso, quem voltou
de 30 dias e tocou no "+1" da barra fixa antes de olhar o card veria a conta
cair para zero, o card sumir sozinho — sem decisão nenhuma gravada — e treinaria
no dia seguinte com a carga cheia, que é exatamente o que este adendo existe
para evitar. No dia seguinte a conta já é 1 e não há card nenhum.

### 18.2 As faixas e o que cada opção grava

| dias parado | o que o card oferece |
|---|---|
| 0–6 | nada de novo — os dias perdidos já aparecem no calendário e a semana do plano de cardio repete sozinha (§5.5). Semana parcial sem pausa longa é semana normal: continua. |
| 7–13 | **Continuar de onde parou** · **Recomeçar a semana** |
| 14–27 | **Continuar** · **Voltar mais leve** |
| 28 ou mais | **Continuar** · **Voltar mais leve** · **Recomeçar do zero** |

- **Continuar de onde parou** — não grava nada além de `prefs.retomada`. O
  próximo treino é o da alternância (Fase 1) ou o da ordem da fase (Fase 2), e
  as semanas dos planos ficam como estão, repetindo pela §5.5.
- **Recomeçar a semana** — `semana_corrida`, `semana_corda` e `semana_fixa`
  voltam **uma** semana, com o piso em **1**. A força não muda: a alternância
  continua de onde parou.
- **Voltar mais leve** — cada linha de `exercise_state` **com carga**
  (`carga_atual_kg` não nula e maior que zero, exercício não desativado) entra
  em semana leve **exatamente como a 3ª falha da §6.2**: `carga_antes_leve =
  carga_atual_kg`, `carga_atual_kg = arredondar(carga × 0,60)` e `semana_leve =
  true` — é isso que faz o motor devolver a carga cheia na sessão seguinte, sem
  nenhum código novo. `falhas_seguidas` **não muda**: pausa não é falha (na
  sessão seguinte o motor o zera, como zera no fim de qualquer semana leve —
  §6.2). Quem já estava em semana leve fica como está (o `carga_antes_leve` de
  antes não se perde), e quem já está no **piso do implemento** — sem nenhum
  degrau abaixo na escala da §6.4 — também fica: uma "semana leve" que não
  alivia nada só faria o motor devolver a mesma carga na sessão seguinte. Um
  `progression_events` por exercício com motivo **`retomada_leve`**.
  As semanas dos planos também voltam uma, como em "Recomeçar a semana".
- **Recomeçar do zero** (com **confirmação em duas etapas**) — cada linha de
  `exercise_state` volta ao estado inicial da §6.1: `carga_atual_kg =
  carga_inicial.kg` do JSON, `reps_alvo` / `tempo_alvo_s` / `assistencia` de
  volta a `null` (é assim que o motor guarda "nunca fez": na sessão seguinte
  valem o mínimo da faixa **daquele treino**, §6.1), `falhas_seguidas = 0`, `incremento_reduzido = false`,
  `exigir_rep_extra = false`, `semana_leve = false`, `carga_antes_leve = null`,
  `sessoes_graca = 0`. Continuam como estavam o override de incremento
  (`incremento_kg`), o `desativado` e as notas — são ajustes do equipamento e da
  pessoa, não progresso. Além disso: `semana_corrida = semana_corda =
  semana_fixa = 1`, `ultimo_treino = null` (o próximo treino volta a ser o
  Treino A da fase) e `fase_desde = hoje` — **a fase continua a mesma**. Um
  `progression_events` com motivo **`recomeco`** por exercício e mais um do
  programa (`exercise_id` nulo). **Nada é apagado**: sessões, séries, cardio,
  fotos e pesos continuam lá — o histórico é o que prova a pausa.

Tudo passa pela **fila de saída** (§8) e pelos caminhos que já existem: upsert
em `exercise_state`, insert em `progression_events`, update em `profiles`. No
`supabase/schema.sql` só mudam os dois motivos novos no comentário de
`progression_events.motivo`; nenhuma tabela, nenhuma coluna.

### 18.3 Onde o card aparece
Um card **no topo da aba Treino, acima do card do dia**: título **"Você ficou N
dias sem treinar"**, uma frase do que isso significa e os botões da faixa,
empilhados, com alvo ≥ 44 px a 360 px. "Recomeçar do zero" é destrutivo: abre um
diálogo que diz **o que se perde** (as cargas de todos os exercícios voltam ao
começo; o histórico fica) e só o **segundo** toque confirma.

"Voltar mais leve" e "Recomeçar do zero" mexem em **todas** as cargas, então só
ficam tocáveis depois de o app ler `exercise_state` inteiro; enquanto isso as
duas aparecem desligadas com uma linha dizendo por quê. **"Continuar de onde
parou" nunca desliga**: o card barra a aba Treino inteira (e leva o "Ajustar" junto),
e a primeira vez que ele é desenhado sem rede é justamente a primeira vez que a
leitura das cargas não chega — se ela desligasse tudo, a pausa trancaria o app
sem deixar nem decidir nem treinar.

Decidida a retomada, o card **some** e a aba Treino e o `/calendario` se
atualizam na hora (o cache do TanStack Query é **atualizado à mão**, não
invalidado: sem rede, invalidar refaria a leitura e jogaria a aba Treino na tela
de erro — §8).

Com o card pendente, **todo** gesto da aba Treino que começa um treino ou
registra atividade leva ao card, com foco, destaque e o aviso "Antes: escolha
como você quer voltar." — e não faz mais nada. São eles: **"Começar treino"** do
card de força, **"Começar"** do card de cardio (inclusive na alternativa de
corda), o **"+1"** das repetições soltas do dia de descanso, **"Começar
caminhada leve"** do domingo e **"Treinar mesmo assim"**. Decidir vem antes de
treinar, e vale para qualquer tipo de treino: no dia de cardio, começar sem
decidir correria a semana errada do plano; no dia de descanso, o "+1" grava na
hora e a própria atividade de hoje faria o card sumir (§18.1). Pelo mesmo
motivo, o **"Ajustar"**
da aba Treino (§14.3) **não aparece** enquanto a pausa não foi decidida: quando
ainda era um FAB ele era `fixed` e passava por cima do card, comendo o fim da frase de uma das opções e o
toque naquele canto.

### 18.4 Perguntar uma vez por pausa
A escolha vai para
**`profiles.prefs.retomada = { em: 'AAAA-MM-DD', dias: N, escolha: 'continuar' |
'semana' | 'leve' | 'zero' }`**. A pausa já decidida é reconhecida pela sua
**âncora** (`em` menos `dias` = o dia da última atividade de então): enquanto a
última atividade for aquela, o card não volta, nem recarregando o app. Uma
atividade **nova** seguida de um **novo** intervalo de 7 dias ou mais faz o card
aparecer outra vez.

### 18.5 No Relatório
Quando há `prefs.retomada`, o **Histórico** ganha uma linha na data da escolha:
**"Pausa de N dias · escolheu continuar"** (ou "recomeçou a semana", "voltou
mais leve", "recomeçou do zero"). É rótulo de tela, tirado das prefs: nenhuma
tabela nova, nenhum contador muda. As faltas já aparecem nos registros e nas
sequências.

### 18.6 Critérios de aceite
1. Última sessão concluída há **10 dias**: o card diz "Você ficou 10 dias sem
   treinar" e oferece **duas** opções. "Recomeçar a semana" baixa
   `semana_corrida`, `semana_corda` e `semana_fixa` em 1 (piso 1) e não mexe em
   `exercise_state`.
2. Há **20 dias**: o card oferece "Continuar" e "Voltar mais leve"; escolhendo
   "Voltar mais leve", todo exercício com carga fica com `semana_leve = true` e
   `carga_antes_leve` igual à carga de antes, e o treino seguinte mostra a carga
   a **60 %** — sem nenhuma mudança no motor.
3. Há **40 dias**: aparece também "Recomeçar do zero", que só grava depois da
   **confirmação em duas etapas**: cargas de volta à `carga_inicial` do JSON,
   semanas dos planos em 1, `ultimo_treino` nulo, `fase_desde` hoje e a fase
   igual.
4. "Continuar" grava **só** `prefs.retomada`.
5. Decidida a pausa, o card **não volta** ao recarregar; uma sessão nova e mais
   7 dias parado trazem o card de novo.
6. **0–6 dias** não mostram card nenhum.
7. Sem rede a escolha **entra na fila** e a tela responde na hora (§8).
8. Num dia de **cardio**, tocar em "Começar" com o card pendente **não** abre a
   sessão de cardio: leva ao card. Num dia de **descanso**, o "+1" da barra fixa
   **não** registra a repetição: leva ao card. E se alguma atividade de hoje já
   tiver sido registrada (de outra tela, do calendário), o card **continua** de
   pé até ele decidir (§18.1).
9. Sem as cargas lidas (a primeira vez do card sem rede), "Voltar mais leve" e
   "Recomeçar do zero" ficam desligadas com a linha que explica, e **"Continuar"
   continua tocável** — decidir e treinar nunca ficam trancados.
10. O card a 360 px: alvos ≥ 44 px, nada corta, nada rola para o lado, nos dois
    temas. Lint, build, `npm test` e `npm run e2e` verdes, com unitários das
    quatro faixas, das quatro escolhas e do "perguntar uma vez por pausa", e e2e
    novos desta seção.

---

## 19. Números e conquistas — decisão de 16/09/2026 (adendo, marco Números e Conquistas)

O dono pediu, com estas palavras: *"ele também vai ter o historico mostrando
quantos treinos fizemos quantos de força, cardio, barra, etc... gamificando o
site e plataforma"*

O Relatório já conta **treinos · minutos · volume** no total (§13.5 e §14.4).
Falta o que ele pediu: **quantos de cada coisa**, num período que ele escolhe, e
uma camada de **conquistas** — que aqui quer dizer marcos reais dos registros,
não pontos. Este adendo complementa a §13.5 e mantém intacto o que existe:
contadores, faixa da semana, "Todos os registros", sequências, Peso, IMC,
gráficos e recordes continuam onde estão.

**A gamificação continua sóbria** (§7 e §13.1): sem confete, sem som, sem
pontos, sem níveis, sem ranking, sem compartilhar. O que sobe é o número real.

### 19.1 Regras que não mudam
- Conteúdo só dos JSON: nome de treino sai de `programa.json`, tipo de cardio e
  alvo dos planos saem de `cardio.json`, exercício sai de `exercicios.json`
  (por `lib/dados.ts`). Os **limiares** das conquistas (1 · 10 · 25…) são a
  definição da conquista, que é desta seção — não são conteúdo de treino.
- Funções **puras** e testadas: `lib/numeros.ts` e `lib/conquistas.ts` sem
  React, sem Supabase, sem Dexie. Motor (§6) e montagem (§6.5) intocados.
- **Nada novo no banco**. A única gravação nova é
  `profiles.prefs.conquistas_vistas` (lista de ids já avisados), pela fila de
  saída da §8. Nenhuma tabela, nenhuma coluna, nenhuma view.
- Celular a 360 px, alvos ≥ 44 px, nada rola de lado; pt-BR, vírgula decimal,
  dd/MM; offline igual.
- **Sessão em andamento e sessão abandonada não contam** em número nenhum e em
  conquista nenhuma: só `sessions.status = 'concluida'` e
  `cardio_sessions.concluida`.

### 19.2 Números (`lib/numeros.ts`)
No Relatório, **logo abaixo dos contadores do topo**, uma seção "Números" com um
seletor de período de três botões (alvo ≥ 44 px cada):

| período | intervalo |
|---|---|
| **Semana** | a semana civil de hoje, segunda a domingo (§1) |
| **Mês** | o mês civil de hoje, do dia 1 ao último |
| **Tudo** | sem recorte |

Dentro do período, as contagens — todas derivadas das linhas do banco:

- **Força**: sessões de força concluídas (treinos do programa + sessões livres e
  circuitos). Detalhe **por treino**, com o nome de `programa.json`: Treino A,
  Treino B, Superior A, Inferior A, Superior B, Inferior B; e **Livres** à parte
  (sessões `workout_id = 'livre'`). As sessões de barra fixa (`workout_id =
  'fixa'`) **não** entram aqui — elas são o bloco Barra fixa, para nada ser
  contado duas vezes.
- **Cardio**: sessões de cardio concluídas, divididas por tipo (**Corrida**,
  **Corda**, e as demais somadas em **Outros**), **minutos** somados, **km**
  somados (só aparece quando há distância registrada) e **saltos** de corda
  somados (só aparece quando há saltos).
- **Barra fixa**: **sessões** de barra fixa concluídas (`workout_id = 'fixa'`),
  **repetições em sessão** (as séries concluídas de qualquer exercício de barra
  fixa — `implemento = 'barra_fixa'` e `grupo = 'Costas'` no catálogo —, em
  qualquer treino), **repetições soltas** (`pullup_singles`), o **total** das
  duas e a **melhor série** do período.
- **Minutos**: `sessions.duracao_s` das sessões de força concluídas (inclusive
  as de barra fixa) + `cardio_sessions.duracao_min`.
- **Volume**: Σ reps × kg das séries de **trabalho** concluídas, pelo dia da
  sessão (a mesma conta da §3.7).

A data de uma série é a da sessão dela (`lib/progresso.ts`), nunca o fuso do
`registrada_em`.

### 19.3 As conquistas (`lib/conquistas.ts`)
Lista **fixa** de 26 conquistas, cada uma com `id`, `nome` (curto, cabe na
grade), `descricao`, `regra` (a frase que a folha mostra), `icone` (nome de um
ícone lucide, resolvido na tela — a lib não importa React) e `grupo`. Cada uma é
avaliada sobre os registros e devolve: **atingida**, **em** (a data do registro
que a fechou), **atual/alvo** e **o que falta**.

| id | nome | fecha quando |
|---|---|---|
| `forca-1` | Primeiro treino | 1 sessão de força concluída |
| `forca-10` | 10 treinos | 10 sessões de força concluídas |
| `forca-25` | 25 treinos | 25 sessões de força concluídas |
| `forca-50` | 50 treinos | 50 sessões de força concluídas |
| `forca-100` | 100 treinos | 100 sessões de força concluídas |
| `semanas-2` | 2 semanas | 2 semanas civis seguidas com a meta semanal cumprida |
| `semanas-4` | 4 semanas | 4 semanas seguidas com a meta |
| `semanas-8` | 8 semanas | 8 semanas seguidas com a meta |
| `semanas-12` | 12 semanas | 12 semanas seguidas com a meta |
| `dias-3` | 3 dias seguidos | 3 dias de calendário seguidos com alguma sessão concluída |
| `dias-7` | 7 dias seguidos | 7 dias seguidos com alguma sessão |
| `semana-completa` | Semana completa | uma semana civil em que **todas** as sessões planejadas (força + cardio da semana da fase, §17.3) foram feitas |
| `corrida-1` | Primeira corrida | 1 sessão de corrida concluída |
| `corrida-20min` | 20 min correndo | uma corrida com um bloco contínuo de corrida ≥ 20 min em `cardio_sessions.feito` |
| `corrida-5km` | 5 km sem parar | uma corrida concluída com ≥ 5 km **sem bloco de caminhada** (é a semana 12 de `cardio.json`, "5 km sem parar") |
| `corda-1000` | 1.000 saltos | uma sessão de corda com ≥ 1.000 saltos |
| `fixa-sem-elastico` | Sem elástico | 1 repetição de barra fixa sem elástico: numa série com `assistencia = 'sem'`, ou num exercício que não é a barra fixa assistida (a pronada, a supinada e a com lastro não têm elástico). A **repetição solta** não tem exercício, então só conta com `assistencia = 'sem'` explícito |
| `fixa-5` | 5 numa série | uma série de barra fixa com ≥ 5 repetições |
| `fixa-10` | 10 numa série | uma série de barra fixa com ≥ 10 repetições |
| `fixa-100-soltas` | 100 soltas | 100 repetições soltas somadas (`pullup_singles`) |
| `carga-20` | 20 kg na barra | agachamento ou terra com ≥ 20 kg **na barra** (carga total) |
| `carga-40` | 40 kg na barra | o mesmo com ≥ 40 kg |
| `carga-60` | 60 kg na barra | o mesmo com ≥ 60 kg |
| `volume-10k` | 10.000 kg | volume acumulado ≥ 10.000 kg |
| `volume-50k` | 50.000 kg | volume acumulado ≥ 50.000 kg |
| `fase-2` | Fase 2 | `profiles.fase_atual = 'fase2'` (a data é `fase_desde`) |

"Agachamento ou terra" são os cinco exercícios de barra maciça do catálogo cujo
padrão é agachar ou levantar do chão: `agachamento-livre`, `agachamento-frontal`,
`agachamento-sumo`, `levantamento-terra`, `stiff-terra-romeno`. Os ids são
referências ao catálogo (como `lib/barra-fixa.ts` já faz); nome e carga saem do
JSON.

**Como cada tipo de regra acha a data e o que falta**
- **Acumulado** (treinos, soltas, volume): soma por data crescente; a data é a
  do registro em que o acumulado alcançou o alvo. Falta = alvo − acumulado.
- **Melhor registro** (reps numa série, saltos, km, minutos contínuos, carga): a
  data é a do primeiro registro que sozinho alcançou o alvo; o progresso é o
  maior registro até hoje.
- **Sequência** (dias, semanas): a data é a do último registro do dia/semana que
  fechou a N-ésima seguida; o progresso é a **maior** sequência já feita.
- **Semana completa**: a primeira semana civil cujos feitos ≥ planejados; a data
  é a do último registro daquela semana.

### 19.4 A tela
Seção **"Conquistas"** no Relatório, abaixo de "Números":
- Grade de **3 colunas** a 360 px. Cada célula é um botão com alvo ≥ 44 px:
  ícone num círculo, nome curto, e embaixo a **data** (dd/MM) quando
  desbloqueada, ou **o que falta** ("faltam 3 treinos") quando não.
  Desbloqueada em cor de destaque; bloqueada em cinza, com `aria-pressed`.
- O toque abre uma **folha** (`Sheet`) com o nome, a descrição, a **regra** e, se
  desbloqueada, "Conquistada em dd/MM/aaaa"; se não, o progresso ("12 de 25").
- Um resumo acima da grade: "N de 26 conquistadas".

### 19.5 O aviso de conquista nova
Uma conquista **atingida** e **ainda não avisada** (id fora de
`profiles.prefs.conquistas_vistas`) mostra um card sóbrio:

> **Conquista** · 10 treinos de força

com o ícone, a data e um botão **"Ok"**. Ele aparece em dois lugares:
1. **Relatório**, acima da seção "Números", ao abrir a tela.
2. **Conclusão** do player (§14.1.5), acima do "Próximo" — ali a sessão que
   acabou entra na conta antes de subir pela fila, como o card da semana já faz.

O **"Ok"** grava os ids listados em `prefs.conquistas_vistas` pela fila de saída
(§8) e o card some; sem rede, some na hora e a fila sobe depois. Enquanto não é
tocado, o card volta — é um aviso que espera ser reconhecido, não um pop-up.
Nunca há confete, som, pontos, níveis ou compartilhamento.

Quando há mais de uma conquista nova, o card lista todas (as mais recentes
primeiro) e o "Ok" marca todas de uma vez.

### 19.6 Aba Treino
Nada muda. O chip "N conquistas" ao lado da sequência foi **medido a 360 px** e
não cabe sem apertar a saudação e a chama, então não entra (a decisão do
orquestrador previa exatamente isso). As conquistas moram no Relatório.

### 19.7 Critérios de aceite
1. Com 12 sessões de força (8 do Treino A e 4 do Treino B), 3 corridas, 2
   sessões de barra fixa e repetições soltas semeadas: em **Tudo**, Números
   mostra Força **12** (Treino A 8 · Treino B 4), Cardio **3** (Corrida 3) com
   os minutos e os km somados, e Barra fixa com as sessões, as reps em sessão,
   as soltas e a melhor série; em **Semana**, só o que caiu na semana civil de
   hoje.
2. Conquistas mostra **"10 treinos" desbloqueada com a data** do 10º treino e
   **"25 treinos" bloqueada com "faltam 13"**; o toque abre a folha com a regra.
3. Uma sessão concluída que fecha **"Semana completa"** mostra o aviso na
   **Conclusão**; depois do "Ok" ele **não repete** — nem ali, nem no Relatório.
4. Sessão **em andamento** e sessão **abandonada** não entram em número nenhum
   nem em conquista nenhuma.
5. A 360 px, nos dois temas: seletor e grade com alvos ≥ 44 px, nada corta,
   nada rola para o lado.
6. Unitários cobrindo **cada** conquista com um caso que fecha e um que não
   fecha, os três períodos e o recorte por data; lint, build, `npm test` e
   `npm run e2e` verdes, com e2e novos desta seção.


---

## 20. Guia de uso — decisão de 16/09/2026 (adendo, marco Guia de uso)

O dono pediu, com estas palavras: *"Crie um guia para os iniciantes, tipo uma
aba de tutorial, onde ele mostra pra pessoa quando for a primeira vez ou quando
ela quer saber como usar a plataforma mostrando todas as abas e todas as funções
mostrando o caminho e onde clicar para ir em cada função."* E, logo depois:
*"ao invés de uma aba, esta parte do tutorial pode ser na primeira vez que
alguem criar a conta no app e na aba mais ter o botão de mostrar o tutorial"*.

O app tem cinco abas (§13.2) e muita coisa escondida atrás de um toque: a faixa
da semana leva ao calendário, o ⇄ troca um exercício, o "Ajustar" do cabeçalho
abre as preferências. O
guia é **uma tela que diz onde cada coisa está e leva até lá** — não é um passeio
com balões por cima da interface, não é vídeo e não é conteúdo de treino.

### 20.1 Onde ele aparece (não é uma aba nova)
A barra continua com **cinco** abas. O guia é a rota **`/mais/guia`**, dentro do
layout do app (barra visível), e chega por dois caminhos:

1. **Primeira entrada da conta.** A aba Treino (`/`), ao carregar o perfil sem
   `profiles.prefs.guia_visto`, faz `router.replace('/mais/guia?inicio=1')` —
   uma vez por carregamento, sem laço. Enquanto a decisão não é tomada a tela
   mostra o **esqueleto** que ela já mostra enquanto o perfil carrega: nada de
   piscar a aba Treino antes de sair dela. O esqueleto é **só da montagem que
   desvia**: quem volta para `/` sem ter reconhecido o guia (pelo "Ir" do
   próprio guia, por exemplo) vê a aba Treino inteira, e o guia reaparece no
   carregamento seguinte — nunca uma tela parada no esqueleto.
2. **Mais → "Como usar o app"**, a **primeira** linha da lista de ajustes (ícone
   lucide `CircleHelp`), sempre disponível.

### 20.2 `prefs.guia_visto`
**Nada muda no banco**: `profiles.prefs` já é `jsonb` (§4). A única gravação
nova é `prefs.guia_visto = true`, pela fila de saída (§8), no mesmo caminho de
`conquistas_vistas` (§19.5) e `dias_de_treino` (§17.1).

Só dois gestos gravam:
- **"Entendi, começar a treinar"**, no fim do guia;
- **"Pular por agora"**, no topo — que só existe no modo `?inicio=1`.

Os dois atualizam o perfil no cache do TanStack Query (é o que `salvarPrefs`
faz, sem `invalidateQueries`: reler o banco antes de a fila subir traria o
perfil velho e o guia de novo) e voltam para `/`. **Fechar o app
sem tocar em nenhum dos dois faz o guia aparecer de novo na próxima entrada** —
é o comportamento desejado: a marca é do reconhecimento, não da visita.

Aberto por Mais (sem `?inicio=1`), o guia **não redireciona e não grava nada**;
o botão do fim só volta para `/mais`.

### 20.3 O formato
**Uma página rolável** a 360 px (não é carrossel, não tem "próximo/anterior"):
- um **índice de chips** no topo que rola até cada seção (âncoras `#treino`,
  `#explorar`, …), com alvo ≥ 44 px;
- **uma seção por assunto**, com ícone, nome, uma frase de "para que serve" e,
  quando a seção é uma tela, o botão **"Ir"**;
- dentro da seção, a **lista de funções**. Cada função é uma linha com: nome,
  uma frase do que faz, o **caminho em chips** (`Treino → Começar treino →
  Player`, `Mais → Preferências → Dias de treino`) e o botão **"Ir"** quando a
  função tem rota própria — com âncora quando existe
  (`/mais/preferencias#dias-de-treino`).

Função que só existe **dentro de um fluxo** (registrar uma série no player,
"Treinar mesmo assim", o card de retomada, o aviso de conquista) **não tem
"Ir"**: o caminho já diz onde ela aparece.

Estilo: o sóbrio do app (§7, §13.1) — cards, chips, ícones lucide, nos dois
temas, alvos ≥ 44 px, nada corta nem rola de lado a 360 px. Sem ilustração
inventada, sem GIF, sem imagem de terceiros, sem confete e sem "parabéns".

### 20.4 As seções, nesta ordem
1. **Primeiros passos** — quatro itens com "Ir": marcar os dias de treino
   (Mais → Preferências → Dias de treino), conferir o equipamento e o peso das
   barras (Mais → Equipamento), instalar o app no celular (Android: menu do
   Chrome → "Instalar app"; iPhone: Safari → Compartilhar → "Adicionar à Tela
   de Início" — este não tem "Ir", é o navegador) e começar o primeiro treino
   (Treino → "Começar treino").
2. **A barra de abas** — uma **miniatura da barra real**, com os mesmos ícones e
   rótulos da barra de baixo, e uma frase por aba. A lista das abas é **uma
   só** no código (`lib/abas.ts`, lida por `components/nav-inferior.tsx` e pelo
   guia): o guia nunca redigita os rótulos.
3. **Treino** (`/`) — com os blocos "A tela", "No player", "Cardio" e
   "Barra fixa", que são os fluxos que saem dessa aba.
4. **Explorar** (`/explorar`).
5. **Relatório** (`/relatorio`).
6. **Corpo** (`/corpo`).
7. **Mais** (`/mais`).
8. **Calendário** (`/calendario`) — não é aba: chega-se pela faixa da semana.
9. **Sem internet e conta** — o app offline, a fila de envio, trocar senha e sair.

### 20.5 Cobertura
O guia cobre **o que existe, e só o que existe**. Os rótulos escritos nele são
os **rótulos reais** das telas, com a mesma grafia, e o caminho é o caminho real.
O que não existir no código fica **de fora** — nada de função inventada.

Em particular: Treino (saudação e sequência, faixa da semana com a sigla do
treino e o ✓, meta semanal, fase e peso, "Pesar", card do dia com "Começar
treino"/"Continuar", cardio com "Fazer corda em vez de corrida", descanso com
"Começar caminhada leve" no domingo, repetições soltas, "Treinar mesmo
assim", lista do dia com carga e ⇄, ficha em folha, "Editar", "Ajustar",
"Personalizar treino", "Parte do corpo em foco", "Desafios", card de retomada,
banner do treino aberto); Player (preparação, série a série, "Última
repetição", carga de hoje, descanso, visão geral, "O que muda no próximo
treino", Conclusão e o aviso de conquista); Cardio (timer de intervalos,
cronômetro, "Encerrar e registrar" com distância, saltos e esforço); Barra fixa
("Fazer sessão de barra fixa" e as repetições soltas); Explorar (busca sem
acento, destaque de hoje, "Escolhas para você" — Treinos do programa, Parte do
corpo, Circuitos, Por aparelho, Planos —, "Começar" da sessão livre, "Todos os
exercícios"); Relatório (Totais, Números com Semana · Mês · Tudo, Conquistas e a
folha, Histórico e "Todos os registros", Sequências, Peso, IMC, gráficos e
recordes); Corpo (Peso com média de 7 dias, variação e meta, Medidas, Fotos com
Comparar, IMC com a altura); Calendário (semana em lista, resumo "N feitos · N a
fazer · N perdidos", mês em miniatura, tocar num dia, "Não vou treinar hoje",
"Meus dias", setas e "Hoje"); Mais (Como usar o app, Perfil, Equipamento,
Preferências — tema, dias de treino, meta semanal, treino/player, incrementos —,
Créditos, Backup, sincronização, Trocar senha, Sair).

**O mapa muscular não aparece na aba Corpo** — ele é a figura da ficha do
exercício (§15) —, então o guia não o promete ali.

### 20.6 Onde mora o código
- **`lib/abas.ts`** — as cinco abas (href, rótulo, nome do ícone, prefixos):
  fonte única da barra e do guia, sem React.
- **`lib/guia.ts`** — os dados do guia (seções, funções, caminho, href, âncora),
  tipados, **sem React e sem Supabase**.
- **`lib/guia.test.ts`** — todo `href` do guia corresponde a uma página que
  existe em `app/(app)/` (o teste lê o sistema de arquivos), toda seção tem ao
  menos uma função, nenhum texto vazio e os nomes das abas são os de
  `lib/abas.ts` (a mesma lista que `nav-inferior.tsx` desenha).
- **`components/mais/guia.tsx`** — a tela.

O texto do guia é **copy de interface**, escrita aqui: não é conteúdo de treino
e **não sai do `docs/`**. Nenhuma frase do guia de treino é copiada.

### 20.7 Critérios de aceite
1. Conta nova (perfil sem `prefs.guia_visto`): entrar cai em `/mais/guia?inicio=1`
   com "Pular por agora" no topo, sem piscar a aba Treino e sem laço de
   redirecionamento.
2. "Entendi, começar a treinar" grava `prefs.guia_visto = true` e volta para `/`;
   recarregar não redireciona mais. "Pular por agora" faz o mesmo.
3. **Mais → "Como usar o app"** abre o mesmo guia **sem** "Pular por agora", não
   grava nada ao abrir, e o botão do fim volta para Mais.
4. **Todo** botão "Ir" leva a uma página existente do app (nenhum link morto), e
   o índice de chips rola até a seção certa.
5. A 360 px, nos dois temas: nada corta, nada rola para o lado, alvos ≥ 44 px.
6. Nada de novo no banco (`supabase/schema.sql` intocado), motor (§6) e montagem
   (§6.5) intocados; lint, build, `npm test` e `npm run e2e` verdes, com e2e
   novos desta seção.

---

## 21. Cadastro com limite de contas — decisão de 17/09/2026 (adendo, marco Contas)

O dono pediu, com estas palavras: *"Quero fazer com que novas pessoas possam
cadastrar no app, mas, no total até 5 pessoas até que eu possa decidir se eu
aumento a cota de novos usuários ou não"*.

Até aqui o app era de um usuário só (§1, §9): um trigger em `auth.users` e o
middleware barravam qualquer e-mail diferente de `ALLOWED_EMAIL`. Este adendo
**substitui essa regra**: qualquer pessoa pode criar conta pela tela de login
**enquanto houver vaga**, e o número de vagas é uma **cota** que o dono ajusta
de dentro do app, sem deploy. Os dados continuam isolados por RLS — nada muda
nas policies das 11 tabelas nem no storage (§9). "Até 5 pessoas" é lido como
**5 contas no total, contando a do dono**; como a cota é ajustável pelo próprio
dono, o número certo é decisão dele a qualquer momento.

### 21.1 Os papéis
- **Dono**: o e-mail de `ALLOWED_EMAIL` (env, servidor) e de
  `public.allowed_email()` (schema) — continuam obrigatórios e iguais. O dono
  sempre pode entrar, é uma das contas da cota e é o único que vê e altera a
  cota (Mais → Contas).
- **Usuário comum**: qualquer outro e-mail cuja conta foi criada enquanto havia
  vaga. Usa o app inteiro; só não vê a tela Contas. Cada um tem perfil, estado
  por exercício, sessões, cardio, corpo, fotos e conquistas próprios (RLS por
  `auth.uid()`, como sempre).

### 21.2 A cota, no banco (`supabase/schema.sql`, idempotente)
1. **`public.app_config`** — uma linha só (`id boolean primary key default true
   check (id)`), `max_contas int not null default 5 check (max_contas >= 1)`,
   `updated_at` com o trigger `set_updated_at`. Semeada com `5` (`insert … on
   conflict do nothing`). RLS ligada; policy `app_config_dono` `for all to
   authenticated using (public.sou_o_dono()) with check (public.sou_o_dono())`.
2. **`public.sou_o_dono()`** `returns boolean`, `stable security definer set
   search_path = public`: compara `lower(auth.jwt() ->> 'email')` com
   `lower(public.allowed_email())`. `revoke all … from public`; `grant execute …
   to authenticated`. Devolve só verdadeiro/falso — o e-mail não vaza.
3. **Trigger `on_auth_user_vaga` `before insert on auth.users`**, função
   `public.exigir_vaga_para_conta()` (`security definer`): se `new.email` é o do
   dono, passa; senão conta `auth.users where deleted_at is null` e, se o total
   já é `>= max_contas`, `raise exception 'Cadastro fechado: o limite de contas
   foi atingido.' using errcode = '42501'`. BEFORE, para abortar antes do AFTER
   que cria o perfil. **Substitui** `on_auth_user_email_permitido` /
   `exigir_email_permitido()` (`drop trigger if exists`, `drop function if
   exists`). `revoke all … from public, anon, authenticated`.
4. **`public.vagas_para_conta()`** `returns jsonb` `{"contas": N, "limite": L}`,
   `stable security definer`; `revoke all … from public`, `grant execute … to
   anon, authenticated`. É o que a tela de login consulta antes de oferecer
   "Criar conta". Devolve só dois números.
   **Atenção aos grants padrão do Supabase**: o projeto dá EXECUTE a
   `anon`/`authenticated` em toda função nova, e `revoke … from public` não
   desfaz isso — cada função que o navegador não deve chamar revoga `anon` (e
   `authenticated`, quando nem o app logado precisa) **pelo nome**:
   `allowed_email()` e `set_updated_at()` de `public, anon, authenticated`;
   `sou_o_dono()` e `contas_cadastradas()` de `public, anon`. Só
   `vagas_para_conta()` fica aberta ao `anon`.
5. **`public.contas_cadastradas()`** `returns table (email text, criada_em
   timestamptz, ultimo_acesso timestamptz)`, `stable security definer`: lê
   `auth.users` (`deleted_at is null`, ordem de criação) **só quando
   `public.sou_o_dono()`**; para qualquer outro, zero linhas. `revoke all …
   from public`, `grant execute … to authenticated`.
6. **`handle_new_user()`** passa a gravar `nome` = a parte do e-mail antes do
   `@` (`split_part(new.email, '@', 1)`), e `profiles.nome` deixa de ter o
   default `'Miguel'` (`alter column nome set default ''`). O perfil novo nasce
   sem `prefs.guia_visto`, então o guia (§20) abre na primeira entrada.
7. A mesma mudança é aplicada no projeto real como migração **pelo
   orquestrador, depois do ok do dono** — o agente que constrói não toca no
   projeto real.

### 21.3 O app
- **Middleware** (`lib/supabase/middleware.ts`) e **`/auth/callback`**: só
  exigem sessão. A regra "e-mail diferente → sair" e o `?erro=app-pessoal`
  deixam de existir. `lib/env.ts`: `emailPermitido()` vira **`ehDono()`**;
  `ALLOWED_EMAIL` ausente continua sendo aviso de configuração (sem dono não há
  quem administre a cota).
- **Login** (`/login`): subtítulo "Entre com o seu e-mail ou crie a sua conta.".
  A página consulta `vagas_para_conta()` no servidor: **com vaga**, os botões
  "Entrar" e "Criar conta"; **sem vaga**, só "Entrar" e o aviso (`role="status"`)
  **"Cadastro fechado no momento: o limite de contas foi atingido."**.
  `criarConta`: senha com **≥ 8 caracteres** ("A senha precisa ter pelo menos 8
  caracteres."), consulta a cota de novo antes do `signUp` (se fechou no meio, o
  trigger barra e a mensagem traduzida é a mesma); com sessão → `redirect("/")`;
  sem sessão (confirmação de e-mail ligada no projeto) → "Conta criada. Confirme
  o e-mail e depois entre com a sua senha." (já existe). `entrar` não checa
  e-mail nenhum. `lib/erros-auth.ts`: "database error saving new user" e
  "limite de contas" → **"Cadastro fechado no momento: o limite de contas foi
  atingido."**; a tradução "Este app é pessoal." some.
- **Mais → Contas** (`/mais/contas`, `components/mais/tela-contas.tsx`), **só
  para o dono**: a linha "Contas" da lista de Mais (ícone `Users`, descrição
  curta) só aparece quando `ehDono(e-mail da sessão)`; para um usuário comum a
  rota mostra apenas "Só o dono vê esta tela." (e o RPC devolve vazio de
  qualquer jeito). A tela: card **"Contas"** com **"N de L"** e a lista
  (e-mail, "criada em dd/MM/aaaa", "último acesso dd/MM" ou "—"); card
  **"Limite de contas"** com stepper numérico (1–99, alvos ≥ 44 px) e
  **"Salvar"** (PATCH em `app_config` pela RLS; toast "Limite salvo."). Precisa
  de internet: sem rede, "Precisa de internet para mudar o limite." e **nada
  vai para a fila** (como `/mais/senha`, §8). Depois de salvar, "N de L" e o
  login refletem o novo limite na hora.
- **Guia** (§20): "Offline e conta" ganha **"Criar conta"** (caminho `Login →
  Criar conta`, sem "Ir"); a seção Mais ganha **"Contas (só o dono)"** com "Ir"
  para `/mais/contas`; a lista de cobertura do unitário acompanha.
- **Perfil**: o nome vem do e-mail até a pessoa editar (a edição já existe).
  O **seed de `data/perfil.json`** (§2, §10 item 2: altura, data de início,
  fase) **é só do dono** — `garantirPerfil` recebe `{ dono }` do layout e, para
  qualquer outra conta, apenas lê. Uma conta nova fica com o que o schema deu:
  altura vazia (a aba Corpo pede para ver o IMC), `data_inicio` e `fase_desde`
  no dia do cadastro, Fase 1, semanas 1 dos planos. Os dados do Miguel nunca
  vão parar no perfil de outra pessoa.
- **Mock** (`scripts/mock-supabase.ts`): tabela `app_config` semeada com 5 (o
  reset do `__mock` volta a 5); `/auth/v1/signup` conta os usuários e recusa
  com a mensagem do trigger quando não há vaga; `token?grant_type=password`
  deixa de exigir o e-mail permitido; `rpc/vagas_para_conta` (anon) e
  `rpc/contas_cadastradas` (vazio sem o JWT do dono); `PATCH app_config` só com
  o JWT do dono. Os helpers do `__mock` que as fixtures usam para criar
  usuários **não** passam pela cota (são a semente dos testes, não o cadastro).
- **Docs**: §1 (linha "Usuário"), §9 e §10 item 1 apontam para esta seção;
  `CLAUDE.md` (regra "Um usuário…" vira "Contas com cota, §21: RLS em tudo;
  `ALLOWED_EMAIL` é o dono"); `README.md` (instalação e "Problemas");
  `.env.local.example`; `PROGRESSO.md`.

### 21.4 O que não muda
RLS das 11 tabelas e do storage; o backup exporta e importa só as tabelas de
quem está logado; motor (§6), montagem (§6.5), conteúdo (§2), offline (§8),
guia (§20). Nada de e-mail transacional novo, nada de "esqueci a senha"
(quem esquecer fala com o dono, que redefine no painel do Supabase).

### 21.5 Critérios de aceite
1. Com 1 conta (o dono) e limite 5, o login mostra "Criar conta"; criar conta
   com um e-mail novo entra direto, cai no guia da primeira entrada (§20), tem
   perfil com `nome` = parte do e-mail e prefs padrão. O dono não vê os dados
   dela e ela não vê os do dono (provado no mock por leituras cruzadas de
   `profiles` e `sessions`).
2. Com 5 contas, "Criar conta" some e o aviso aparece; um `POST` direto em
   `/auth/v1/signup` é recusado com a mensagem do trigger; a 6ª conta não
   existe e não há perfil órfão.
3. O dono vê Mais → Contas com "5 de 5" e a lista, sobe o limite para 6 e
   salva; o login volta a mostrar "Criar conta"; a 6ª conta entra. Um usuário
   comum não vê a linha Contas, e `/mais/contas` para ele não mostra a lista.
4. Um usuário comum logado navega em tudo; sem sessão qualquer rota vai para
   `/login`; não existe mais `?erro=app-pessoal`.
5. Unitários: `env` (`ehDono`), `middleware`, `erros-auth`,
   `auditoria-seguranca` (trigger novo `before insert`, policy de `app_config`
   por `sou_o_dono()`, nenhuma policy `true`, `revoke`/`grant` de cada função,
   `vagas_para_conta` liberada ao anon e devolvendo só dois números),
   `mock.spec`.
6. A 360 px nos dois temas: login e Contas sem cortar nem rolar de lado, alvos
   ≥ 44 px, contraste AA.
7. Lint, build, `npm test`, `npm run build:e2e && npm run e2e` verdes, com e2e
   novos desta seção e os antigos ("Este app é pessoal") ajustados para a
   regra nova sem afrouxar o que verificam.

## 22. Polimento contínuo — decisão de 20/09/2026 (adendo, ultraloop)

O pedido do dono, literal:

> "Utilize o fable 5.1 e delegue os workflows para o opus 5 Max e melhore
> completamente tudo o que pode no app, interface, uxui, design, imagens, tudo
> o que for possível..."

### 22.0 O que foi decidido

- **Deploy automático por rodada auditada.** Cada rodada de lotes só vai para
  produção depois dos portões (lint, tsc, teste, build de produção, e2e) e de
  um teste de fumaça na URL publicada; se a fumaça falhar, **rollback** para o
  deploy anterior, sem discussão e sem tentar consertar no ar.
- **Amplitude máxima, inclusive banco.** Nada está fora do alcance — telas,
  componentes, tipografia, ilustrações, cópia, e também `supabase/schema.sql`.
  Toda mudança de banco segue o **protocolo expand-only**: só acrescentar
  (coluna nova, tabela nova, valor novo), nunca renomear nem apagar enquanto o
  código antigo ainda estiver no ar; a remoção, se um dia vier, é um marco
  próprio depois de o app novo estar publicado e estável.
- **Prioridades, nesta ordem:** (1) Relatório, Corpo e Calendário; (2) Explorar
  e as fichas de exercício; (3) Treino e o player.

### 22.0.1 Regras de qualidade (valem para todo lote)

1. **360 px, uma mão.** Nada rola para o lado; nada vaza a largura.
2. **Alvos ≥ 44 px**, interruptores incluídos.
3. **Contraste AA** de todo texto visível contra o fundo efetivo — 4,5:1, ou
   3:1 só para texto ≥ 24 px ou negrito ≥ 19 px.
4. **`prefers-reduced-motion: reduce` respeitado**: nenhuma animação infinita
   continua rodando.
5. **Dois temas.** Escuro e claro conferidos lado a lado, sempre.
6. **Capturas comparadas.** `scripts/capturas-ultraloop.ts` gera a mesma lista
   fixa de telas antes e depois; `scripts/comparar-capturas.ts` diz o que
   mudou. Tela que mudou sem estar na lista de esperadas reprova o lote.
7. **Motor intocado.** `lib/progressao.ts` e `lib/montagem.ts` não mudam: o
   polimento é da casca, não da regra de treino.
8. **Conteúdo só dos JSON** (`data/*.json`) e nenhuma imagem de terceiros.

A varredura que mede 1–4 em doze rotas × dois temas é
`e2e/ultraloop-varredura.spec.ts` (`VARREDURA=1`). O que hoje reprova está
marcado com `test.fixme` e o motivo; tirar o fixme é tarefa do lote que arruma
a tela — afrouxar o limite não é uma opção.

### 22.1 Lote 1 — Player, offline e rótulos

1. **Sem rede, qualquer rota cai na `/~offline`.** O fallback do service worker
   deixava de fora a navegação do App Router (o `fetch` de RSC e o documento que
   não chega a ser um `destination: "document"`): `/mais/contas`, `/mais/senha` e
   `/mais/creditos` abriam a página de erro do navegador. Agora uma regra própria
   atende toda navegação de mesma origem — documento **ou** RSC — e, quando não
   há rede nem cache, entrega a `/~offline`; no caminho do RSC ela devolve uma
   resposta que não é payload, o que faz o roteador desistir da navegação suave e
   recarregar a URL, que aí cai na página de offline.
2. **A `/~offline` tem identidade e saída:** ícone de rede cortada, "Sem
   conexão", "Tentar de novo" (recarrega) e "Ir para o Treino".
3. **O player usa a tela inteira.** A barra de abas não existe no player, então
   os controles (anterior · ✓ · próximo) e o overlay da visão geral deixam de
   reservar os 56 px dela e passam a respeitar a área segura do aparelho
   (`env(safe-area-inset-bottom)`), como o descanso e o botão "Ajustar".
4. **`prefers-reduced-motion: reduce` é respeitado em todo o app**: nenhuma
   animação CSS se repete para sempre (os esqueletos de carregamento incluídos) e
   a ilustração de duas posições nasce **parada** — sob `reduce` ou com a aba
   escondida. O botão de pausar/retomar continua mandando: quem tocar volta a
   alternar. Contagens e anéis de progresso são JavaScript e não mudam.
5. **O polegar para cima deixa de vir "pressionado".** A avaliação do exercício
   vira de três estados — nenhum (padrão), preferido (`prefs.preferidos`) e
   evitado (`prefs.evitar_exercicios`) — e nenhum dos dois botões afirma um
   estado (`aria-pressed`) antes do primeiro toque.
6. **A conclusão não reoferece o peso já registrado**: havendo pesagem de hoje
   (ou peso digitado nesta sessão), a tela mostra "Peso de hoje: 82,4 kg" com um
   "Corrigir" em vez do convite "Registrar o peso de hoje".
7. **"sáb" com acento** na faixa da semana, igual ao calendário.
8. **`/versao`** devolve `{commit, construidoEm}` (rota pública, `no-store`) e o
   rodapé de Mais → Créditos mostra "Versão abc1234": é o que o teste de fumaça
   do deploy compara para saber qual build está no ar.

### 22.2 Lote 2 — Relatório, Corpo, Calendário e Explorar

1. **Contadores numa linha só.** O rótulo do contador (`components/ui/contador.tsx`)
   nunca quebra em duas linhas: o texto fica numa linha e os contadores de uma
   mesma faixa compartilham a base. No Relatório o total de volume é
   "Volume" com a unidade no detalhe ("kg no total"), não "Volume (kg)".
2. **Explorar com esqueleto.** Enquanto o perfil não chega, `/explorar` mostra
   um esqueleto com a forma do destaque e das seções, no lugar de montar a tela
   sem o destaque e empurrá-la quando o perfil chega.
3. **Apagar foto de progresso.** Na galeria de Corpo → Fotos um toque abre a
   foto em tela cheia; ali há **Apagar**, com confirmação ("Apagar esta foto?
   Não dá para desfazer."). Apagar remove o arquivo do bucket `progresso` e a
   linha de `progress_photos`, e a galeria e o comparador deixam de mostrá-la.
   É a única escrita do app que **exige internet** (como trocar a senha): sem
   rede o botão avisa "Precisa de internet para apagar" e nada é apagado.
4. **Esqueleto por aba no Corpo.** Medidas e Fotos têm o esqueleto da própria
   forma enquanto carregam, em vez de aparecerem vazias.
5. **Cardio num dia de descanso aparece como cardio.** Um cardio registrado num
   dia que o plano dizia descanso passa a valer como o dia (§16.2, como já
   valia para a força): o rótulo vira Corrida/Corda/Caminhada e a sigla da
   faixa vira "Corr."/"Corda"/"Cam." no lugar de "Desc.".
6. **Ilustração aproximada avisa.** Quando `data/ilustracoes.json` marca a
   correspondência como "aproximada", a legenda da ilustração ganha uma segunda
   linha discreta com a nota do JSON (§15.2). Nenhum texto novo em código.
7. **Vídeo na ficha aberta fora do player.** A ficha em folha aberta pela lista
   do dia e pela lista de uma coleção recebe o mesmo `temVideo` que o player já
   passava — com vídeo em `public/videos/<id>.mp4`, as três telas mostram vídeo.
8. **Desafio com uma leitura só.** O card do desafio diz "Semana 3 de 12 · 2
   concluídas" e a barra mede as semanas **concluídas** — o rótulo e a barra
   param de discordar.
9. **Selo "Circuito".** A coleção que dá para rodar como circuito guiado (§13.6)
   mostra um selo discreto na vitrine; o campo `circuito` deixa de ser calculado
   sem leitor.
10. **Texto sobre a capa com contraste AA.** O texto branco do `CardCapa` fica
    sobre um véu escuro próprio, nos dois temas, com pelo menos 4,5:1 — sem
    passar por cima do selo ("hoje", "em andamento"), que continua inteiro, e
    sem apagar a foto: a borda de cima do véu é esfumada, em vez de cortar o
    cartão com uma linha reta, e a vinheta decorativa da capa não soma com ele
    até virar tarja.
11. **Régua de rolagem ciente de carrossel.** A auditoria de 360 px
    (`e2e/auditoria-helpers.ts`) não conta como vazamento o que está dentro de
    uma faixa que rola sozinha (`overflow-x: auto/scroll`); a rolagem da página
    continua tendo de ser zero.

### 22.3 Lote 3 — Fundação visual

1. **44 px é o padrão, não a exceção.** A escala do `Button` passa a ser do
   projeto: `sm` 40 px (sempre com `alvo`), `default` **44 px**, `lg` 48 px,
   `xl` 56 px, `icon` 44 px e `icon-sm` 40 px; o `Input` nasce com 44 px. Os
   tamanhos `xs`/`icon-xs` do shadcn (24 px) deixam de existir. Nenhum controle
   da tela fica abaixo de 44 px — a varredura mede.
2. **Um degrau real entre card e fundo.** O card mede **≥ 1,3:1** contra o
   fundo e a borda **≥ 1,5:1** contra o card, nos dois temas — e isso vale
   para **todo bloco que se apoia na página**, não só para o `Card`: o menu de
   `/mais` e as seções de `/mais/creditos` levam `bg-card` junto com a borda,
   senão no escuro sobra preto sobre preto com um fio em volta. No escuro quem
   sobe é o card (`#141414` → `#262626`, com `secondary`/`muted`/`accent`
   acima dele); no claro quem desce é o fundo (`#fafafa` → `#e0e0dd`), com o
   card seguindo branco. O laranja do tema claro escurece um degrau
   (`#b8400c` → `#a03608`) para o pill `bg-primary/10` manter os 4,5:1.
3. **Borda de campo visível.** `--input` deixa de ser a mesma cor dos
   separadores e passa a valer como elemento de interface (WCAG SC 1.4.11):
   **≥ 3:1** contra card, fundo e superfície secundária, nos dois temas.
4. **Ilustrações sem placa acesa.** No tema escuro a placa clara atrás das
   ilustrações de traço não passa de **60 % de luminância** (`#e7e4e0` →
   `#cfcac4`); no claro ela é a cor do card. O traço continua com ≥ 4,5:1.
5. **Elevação que existe nos dois temas.** O que flutua (o FAB "Ajustar", o
   play do tutorial) usa `--sombra-flutuante`/`.flutuante` no lugar de
   `shadow-lg`: sombra no tema claro, anel de 1 px na cor de destaque mais
   glow curto no escuro, onde sombra preta sobre preto não aparece.
6. **Texto pequeno com nome.** `text-rotulo` (11 px) e `text-micro` (10 px)
   substituem os 43 `text-[11px]`/`[10px]`/`[9px]`/`[0.7rem]`/`[0.8rem]`
   soltos. Nenhum texto da interface fica abaixo de 10 px. Todo tamanho de
   fonte criado no `@theme` tem de ser declarado ao mesclador de classes em
   `lib/utils.ts` (`createCn({ extend: { classGroups: { "font-size": … } } })`):
   sem isso ele lê `text-<nome>` como COR e descarta o tamanho quando a mesma
   chamada traz uma cor de texto.
7. **Anel de foco em tudo que recebe foco.** `app/globals.css` desenha
   `outline: 2px solid var(--ring)` em todo focável — link de card, linha de
   lista, o cartão do IMC, as abas de baixo —, e o anel dos botões e campos
   deixa de ser meio transparente (`ring-ring/50`) para ser a cor cheia. O
   anel mede ≥ 3:1 contra o fundo nos dois temas. Quem mede tem de **esperar
   a transição**: o `Button` do shadcn anima com `transition-all` de 150 ms e,
   lido no mesmo tique do Tab, o `box-shadow` do anel ainda está todo
   transparente — daí a varredura esperar até 400 ms e exigir cor
   **não-transparente** no `outline` ou no `box-shadow` (aceitar
   `box-shadow !== "none"` deixava passar cinco sombras transparentes). A cor
   é lida pelo **canvas**, não por expressão regular: o Chromium devolve
   `oklab()` em toda sombra que passa por `color-mix`, e uma régua que só
   entende `rgb()` daria transparente para todas elas. Nenhum controle pode
   levar um anel próprio mais fino que o padrão — o `TabsTrigger` do shadcn
   trazia `focus-visible:outline-1`, uma utilitária, que vencia os 2 px da
   regra global. Dois focáveis exigem cuidado extra, e são a razão de o
   `fixme` só ter saído agora: o **painel** da aba (`[data-slot=tabs-content]`,
   que o Radix deixa focável com `tabindex="0"`) carregava `outline-none` do
   shadcn e recebia o foco sem desenhar nada; e o `input[type="date"]` tem
   shadow DOM — o Tab anda por dia, mês, ano e ainda pelo ícone do calendário,
   e nesse último passo quem tem o foco é um nó de dentro, então o host deixa
   de casar `:focus-visible` (o `Input` ganhou `focus-within` ao lado dele).
   **Fechado**: a varredura do foco passa nas doze rotas nos dois temas, sem
   `fixme`.
8. **Aba acesa com forma, não só cor.** O item aceso da barra de baixo ganha
   uma barra de 2 px no topo e o rótulo em semibold, além do laranja.
9. **Estado vazio com saída.** `components/ui/vazio.tsx` (ícone, título curto,
   frase e ação opcional) substitui os `<p>` tracejados de uma linha nos oito
   vazios secos, cada um com a ação útil quando existe ("Limpar filtros",
   "Limpar busca", "Ver o histórico completo", "Ver o treino de hoje").
10. **Esqueleto com a forma da tela.** Além do `EsqueletoCard`, há
    `EsqueletoCapa` (a capa do dia da aba Treino), `EsqueletoGrade3` (os três
    contadores do Relatório) e `EsqueletoLista` (linhas com miniatura).
11. **Texto cortado continua legível.** Todo `line-clamp` leva o texto inteiro
    no `title` e, quando o elemento é clicável, também no nome acessível. Os
    `title` que serviam só de tooltip (raios de dificuldade, dia da faixa da
    semana, dia da grade do mês) viram texto só-leitor — no celular não existe
    passar o mouse.
12. **Voltar de Mais é botão.** O "Mais" do topo das telas de dentro de
    `/mais` é um botão de ícone de 44 px com rótulo, padronizado com o topo do
    player.
13. **O interruptor diz o estado nos dois temas.** O trilho do `Switch` é
    cinza (`--input`) desligado e laranja (`--primary`) ligado, nos dois
    temas; o polegar é **claro sempre**. Nenhuma regra pode pegar os dois
    estados: `dark:bg-input/80` pesa (0,2,0) contra os (0,1,0) da variante de
    estado e apagava a diferença no escuro, onde só o polegar mudava — e
    mudava ao contrário do tema claro (preto quando ligado). A borda de 1 px
    que separa o polegar do trilho sai do token **`--polegar-borda`** (um por
    tema, em `app/globals.css`), nunca de uma cor crua na classe do
    componente, e mede **≥ 3:1** contra o polegar sobre o trilho ligado —
    3,5:1 no escuro, onde o laranja é mais claro, e 9,2:1 no claro.
14. **A aba acesa é mais clara que a lista.** O `TabsTrigger` aceso usa
    `bg-card`, não `bg-background`: com o fundo da página em `#e0e0dd` a aba
    ativa ficava da cor da PÁGINA, mais escura que a lista `bg-muted`. Nos
    dois temas a luminância da aba acesa é **maior** que a da lista, com
    contraste **≥ 1,15**.
15. **O vazio de gráfico não vaza para o resto.** `SemDados` tem ícone e
    título de gráfico só como PADRÃO; galeria de fotos, comparador e tabela de
    medidas passam os seus (`Camera`, `ImageOff`, `Ruler`), senão a tela anuncia
    "Sem dados por enquanto" debaixo de um gráfico de linha que ninguém pediu.
16. **O corpo do mapa muscular existe contra a página.** Em
    `/exercicios/[id]` → Músculos a figura é desenhada **direto sobre a
    página**, sem card embaixo: `--mbody` mede **≥ 1,3:1** contra
    `--background` nos dois temas, sem perder os 3:1 que o músculo principal
    e o auxiliar precisam ter contra ela. Com o fundo claro em `#e0e0dd` o
    corpo `#c8c8c4` dava 1,27:1 — a silhueta sumia; é `#c0c0bc` (1,38:1).

### 22.4 Lote 4 — Imagens, mídia e entrega

1. **Derivadas de imagem no prebuild.** `npm run assets` passou a gerar, dentro
   de `public/` (que continua fora do git), três derivadas com `sharp`, com
   cache por data de modificação: `<nome>.webp` (qualidade 78, no máximo
   1200 px no maior lado) para as fotos de execução, `<nome>-mini.webp` de
   112×112 (2× a caixa de 56 px) para fotos, ilustrações e itens, e
   `<nome>-capa.webp` de 720×360 para as fotos `-1` que viram capa de cartão.
   Cada derivada existe porque uma tela a pede: a grande é o que a ficha do
   exercício e a foto em tela cheia baixam (44 kB no lugar dos 70 do JPEG do
   kit, a tela mais pesada de imagem do app), a mini é das listas e a capa é
   dos cartões. O item de equipamento nunca aparece maior que a caixa de 56 px
   — a mesma das outras miniaturas, 2× a derivada — e por isso só ganha a
   miniatura. Se a derivada faltar (um build sem o
   prebuild), o `data-reserva` da `<img>` devolve o arquivo original — nenhuma
   imagem nova, nenhum arquivo de terceiros a mais. O mesmo script, que já abre
   cada foto com o `sharp`, grava em `data/medidas-de-foto.json` (este sim no
   git) a medida **medida** de cada foto do kit e da derivada dela: as 162
   fotos não são uniformes — 152 medem 850×567, seis medem 850×1275 (derivada
   800×1200, pelo limite de 1200 px) e quatro medem 850×569.
2. **Cache da mídia.** `/fotos`, `/ilustracoes`, `/itens`, `/figuras`, `/icons` e
   `/mapa-muscular` saem com `Cache-Control: public, max-age=604800,
   stale-while-revalidate=86400`. Uma semana: a segunda navegação não revalida
   mais nada e ainda dá para trocar uma foto sem renomear o arquivo.
3. **Toda imagem diz o tamanho — o tamanho certo.** As imagens de exercício
   levam `width`/`height`, `decoding="async"` e `loading="lazy"` — menos a capa
   da primeira dobra, que é `eager` com `fetchpriority="high"`. As dimensões
   são as **do arquivo que aquela `<img>` pede**: as da ilustração saem de
   `data/ilustracoes.json`, as da foto de execução saem de
   `data/medidas-de-foto.json` (a derivada quando ela existe, o JPEG do kit
   quando a `<img>` cai na reserva), a figura tem o `viewBox` 132×100 e as
   derivadas de lista e de capa têm medida fixa (112×112 e 720×360). Um par de
   números qualquer não serve: o navegador reserva a caixa pela proporção dos
   atributos, e declarar 850×567 numa foto que chega 800×1200 trocava um salto
   de layout por outro. Quem garante isso é `lib/medidas-de-foto.test.ts`, que
   abre foto por foto com o `sharp`, e o teste "§22.4-3", que cobra no
   navegador `width`/`height` iguais a `naturalWidth`/`naturalHeight`.
4. **Miniatura enquadrada.** A miniatura usa a derivada quadrada de 112 px, com
   um enquadramento só para foto e ilustração; a ilustração alta é cortada pelo
   alto (o corpo aparece) em vez de encolher no meio da caixa. O texto
   alternativo virou o contrário: vazio quando o nome do exercício já está
   escrito ao lado, nome só quando a miniatura aparece sozinha.
5. **Manifest e ícones.** O `manifest` ganhou atalhos (Treino, Relatório,
   Corpo) e um ícone maskable de 192; os ícones são gerados na cor `--primary`
   do tema escuro, em vez de um laranja escrito à mão fora dos tokens. A
   `theme-color` continua presa ao `prefers-color-scheme` — segui-la pelo tema
   escolhido ficou para outro lote (ver PROGRESSO.md).
6. **`/favicon.ico` responde imagem**, em vez do HTML de 404.
7. **Avisos em português.** A região do Sonner se chama "Avisos" — não sobrou
   nenhum rótulo acessível em inglês.
8. **Sprite antigo fora do layout.** O boneco `#bf`/`#bb` e o `MapaMuscular` que
   ninguém usava saíram; o `MapaAnatomico` da ficha continua igual.
9. **Abertura do iPhone.** O app declara `apple-touch-startup-image` nos
    tamanhos comuns, com o fundo `#0a0a0a` e o ícone no meio — o app instalado
    para de abrir com a tela preta.

### 22.5 Lote 5 — Player: gravar sem perder o treino

1. **Descartar um treino pede uma pergunta.** "Abandonar" virava "Confirmar
   abandono" **no mesmo ponto** da tela (x 138,8–241,4 → x 71,6–241,4, na
   mesma faixa de y): dois toques seguidos jogavam a sessão fora sem nenhum
   diálogo. A confirmação em linha saiu; o descarte passa por um
   `AlertDialog` ("Descartar este treino?" + o que já está salvo — "Nenhuma
   série foi registrada ainda." antes da primeira, "A 1 série já registrada
   continua salva." ou "As N séries já registradas continuam salvas." ·
   Cancelar / Descartar este treino), com o Cancelar nascendo com o foco. O componente é `components/ui/alert-dialog.tsx`,
   escrito sobre o pacote `radix-ui` que o projeto já usa — **nenhuma
   dependência nova**.
2. **A conclusão grava ao ENTRAR, não 2.244 px abaixo.** O topo dizia
   "Excelente! Você concluiu o treino." e nada tinha sido gravado: quem só
   lia a tela e saía deixava a aba Treino mostrando "EM ANDAMENTO ·
   Continuar · 17/17 séries". Agora `finalizarSessao` roda ao entrar no passo
   de conclusão (`salvar(..., { navegar: false })`), a tela diz em
   `role="status"` que o treino está salvo e o "Próximo" mora numa **barra
   fixa no rodapé**, com o mesmo padrão de `ControlesDoPlayer`. Consequências
   assumidas: não há mais "Voltar ao treino" na conclusão (voltar rodaria o
   motor duas vezes) e o peso do dia, digitado depois da gravação, vai pelo
   caminho do Corpo (`registrarPeso`, upsert em `user_id,data`) mais uma
   atualização de `sessions.peso_corporal` — mexer na sessão gravada a
   devolveria ao Dexie como sessão em andamento, que é justamente o defeito.
3. **A Visão geral é um diálogo de verdade.** `role="dialog"` +
   `aria-modal="true"`, fecha no **Escape** e no **voltar do celular**
   (`history.pushState` ao abrir; o `popstate` consome a entrada, e quem fecha
   pelo botão a desfaz — só quando ela ainda é a do topo, senão sair do treino
   voltaria para dentro dele) e devolve o foco ao botão que a abriu. O rodapé
   deixou de ter só as duas saídas que terminam a sessão: "Voltar ao treino"
   está repetido nele.
4. **A pergunta que decide a carga não vem respondida.** "Última repetição
   saiu firme?" chegava com "Firme" em `aria-checked="true"` sem ninguém
   responder. A escolha começa em `null`, o palpite do motor aparece como
   **dica em texto** ("Pelas repetições, parece que saiu firme."), o primário
   se chama "Pular esta pergunta" enquanto ninguém responde e o toque numa
   opção espera 350 ms antes de virar a tela — antes o avanço era no mesmo
   tique e ninguém via o que tinha escolhido. O feedback do treino ganhou o
   mesmo tratamento: "(opcional)", o que a resposta faz e o primário
   "Concluir sem responder"; o peso do dia da conclusão diz "(opcional)" e
   para onde vai.
5. **As opções deixaram de ser pintadas com a cor da página.** `bg-background`
   é exatamente `--background` no tema claro (1,00:1): a única pista de que
   havia cinco alvos tocáveis era uma borda de 1,15:1. As opções de "firme?" e
   do feedback usam `bg-card`, e o "Voltar" perdeu o tratamento idêntico ao
   das opções (h-14, cantos 2xl) que o fazia parecer mais uma delas.
6. **24 px entre gravar a série e perdê-la.** "Próximo passo" (que pula a
   série sem gravar) ficava a 8 px do "Concluir série". A barra passa a
   `gap-6`; as setas descem para os 44 px padrão do projeto e o ✓ segue sendo
   o único alvo de 56 px.
7. **O fim do descanso é anunciado sem som.** Os timers usam `role="timer"`,
   que tem `aria-live` desligado — quem usa leitor de tela só descobria o fim
   pelo bipe, e o bipe é um interruptor que ele pode ter desligado. Ao lado do
   número (que continua `role="timer"`) há um `<p role="status" class="sr-only">`
   que só muda em **marcos**: "Faltam 30 segundos de descanso.", "Faltam 10
   segundos de descanso.", "Descanso terminado, próxima série." A contagem dos
   exercícios de tempo ganhou o equivalente. Os botões de tempo dizem o sinal
   em texto: "−20 s" e "+20 s", dois alvos de 56 px na cor da própria tela
   (`--descanso-destaque`), com nome acessível dizendo o que fazem.
8. **O descanso tem anel, e "Pular descanso" não é o botão mais forte.** O
   timer do descanso passou para dentro do `AnelDeContagem` que a preparação
   já usava (`fracaoRestante`), com as cores da tela de descanso — o
   `AnelDeContagem` recebeu `classeTrilho`/`classeArco` porque `--muted` e
   `--primary` não existem como contraste ali. "Pular" virou "Pular descanso"
   em **contorno** sobre o marrom (`border-descanso-foreground/40`): um app de
   treino não empurra ninguém a cortar o descanso.
9. **Três saídas, três verbos.** O ícone `LogOut` mudo virou "Continuar
   depois" com texto visível, "Abandonar" virou "Descartar este treino" e o
   par de ícones do cabeçalho virou um botão só, "Fechar" — sair preservando
   mora no rodapé, junto do "Concluir".
10. **Gravar a série deixou de ser silencioso.** Depois do ✓, um
    `<p role="status" class="sr-only">` diz "Série 2 de 3 registrada: 5
    repetições com 7,5 kg na barra. Descanso de 2:30."; a `progressbar` ganhou
    `aria-valuetext` ("exercício 2 de 6") junto do `aria-valuenow`/`valuemax`;
    o player ganhou um `h1` só-leitor ("Treino A — exercício 1 de 6") — era a
    única rota sem `h1`; o nome acessível do primário passou a ser o texto
    escrito ("Concluir série"/"Série feita", sem `aria-label` divergente); e os
    rótulos visíveis foram fixados: **"CARGA NA BARRA"** no lugar de "NA
    BARRA", e uma só grafia de "Aquecimento 2 de 2 · exercício 1 de 6" no
    exercício e no descanso (que dizia "Próximo 2/6"), com o caixa-alta feito
    por CSS.

### 22.6 Lote 6 — Relatório: estrutura, números e conquistas

1. **O Relatório vira cinco seções dobráveis.** Os 5.444 px de rolagem de uma
   `<Tela>` só passam a cinco `<details>` — **Resumo** (totais, Números e
   sequências), **Conquistas**, **Histórico**, **Corpo** (peso e IMC) e
   **Gráficos** — cada um com o cabeçalho grudado no topo (`sticky`) e o
   estado lembrado em `localStorage` (`relatorio:secoes`). A tela **abre com
   o Resumo** e as outras recolhidas: menos de 1.500 px de rolagem a
   360 × 740, e todo bloco a um toque do cabeçalho. O conteúdo de uma seção
   só é montado quando ela abre pela primeira vez — a seção Gráficos não
   pede as consultas nem desenha os Recharts enquanto ninguém a abrir.
2. **A caixa vem antes do dado.** Quem reserva a altura é o **esqueleto**,
   não um `min-height` por seção: o do Resumo tem a forma e as medidas do
   Resumo pronto (três contadores, o seletor de período, a grade de números
   com `h-[4.75rem]` por ladrilho — a mesma altura do ladrilho final — e as
   duas sequências), em vez de um esqueleto genérico que empurrava tudo
   quando as ~10 leituras chegavam. Seção recolhida não tem altura a
   reservar, e a aberta já está do tamanho certo antes de o dado chegar.
   Alvo: **CLS < 0,1** em `/relatorio` nos dois temas (antes da mudança:
   0,3895 no escuro e 0,4430 no claro).
3. **Cabeçalho de seção com dois papéis separados.** O contador curto
   ("7 de 26") fica na linha de base do título, à direita; a frase de
   explicação desce para um subtítulo de 12 px `muted`. Nenhum título de
   seção divide a linha com uma frase — a 360 px uma frase de 203 px ao lado
   do título roubava a leitura. O atalho "Catálogo de exercícios" sai de
   cima dos totais e vai para o fim da tela: o Relatório **começa pelos
   números**.
4. **Contadores sem rótulos que se contradizem.** O contador acumulado do
   topo passa a ser **"Sessões · no total (força + cardio)"** (51) e o card de
   treinos do bloco de gráficos diz **"só força · 6 no mês · 46 de força no
   total"** (46): o mesmo rótulo "no total" não devolve mais dois números
   diferentes na mesma rolagem.
5. **Conquistas em duas colunas, com progresso e separação.** A grade é
   `grid-cols-2 sm:grid-cols-3` (a 360 px três colunas espremiam o cartão),
   o subtítulo tem `line-clamp-2` com o texto inteiro no `title` (§22.3
   item 11) e a altura do cartão é travada. Sob o título entram uma barra
   fina de progresso ("7 de 26") e dois grupos rotulados — **Conquistadas**
   e **A conquistar** —, para saber quantas faltam sem contar cartão por
   cartão.
6. **O aviso de conquista não vira lista.** No máximo **3** linhas, com
   "e mais N" quando houver mais; a data **só aparece quando não é a de
   hoje** (anunciar como novidade uma conquista de 1º de junho tira a
   credibilidade); a `<section>` leva `role="status"` para o leitor de tela
   anunciar quando ela surge; e o rótulo passa a ser **"Nova conquista"**,
   que não colide com o título da seção "Conquistas" da mesma tela.
7. **Ladrilho de número alinhado.** No `Contador` o que é fixo é a **linha
   do rótulo** (`h-4`, uma linha só, sem quebra): é ela que impede um rótulo
   comprido de empurrar o número para baixo, em qualquer tela. O alinhamento
   da legenda no rodapé precisa de mais e vem do chamador: os três
   contadores da fileira de Totais recebem
   `className="grid grid-rows-[auto_1fr_auto]"` — rótulo na primeira linha,
   número crescendo na do meio, legenda colada no rodapé —, e é aí que os
   números de uma fileira caem na mesma linha de base mesmo quando um rótulo
   é mais longo. O ícone do rótulo sobe de 12 px para 14 px
   (`size-3.5`, `shrink-0`): a 12 px ele sumia ao lado de um número de
   24–30 px. E **nada recorta o rótulo na vertical**: o til de "SESSÕES" em
   versalete sobe acima da caixa de linha de 12 px (`text-micro`: 10 px ×
   1,2), e qualquer `overflow` que recorte em y come o acento — a linha saía
   "SESSOES". Mas tirar o recorte dos dois eixos também não serve: nesta
   fileira o ladrilho é uma **grade**, e num item de grade o `min-width:
   auto` só vira 0 quando o `overflow` do item não é `visible` — com os dois
   eixos `visible` um rótulo maior que o ladrilho de 95 px não encolhe nem
   encurta, **estoura**, e a página passa a rolar para o lado a 360 px. Os
   **dois** spans do rótulo (o de fora e o de dentro, que desenha o "…")
   levam então `min-w-0` + `overflow-x-clip` + `overflow-y-visible`, a única
   combinação que o CSS deixa conviver com `visible`: o til pinta e o que
   não cabe na largura continua encurtando com "…". Como o `innerText` diz
   "SESSÕES" nos dois casos, o teste que fecha isto não é de texto: mede o
   recorte computado de todo `[data-rotulo]`, compara os pixels do rótulo
   com e sem o recorte forçado a `visible` e — o caso negativo — injeta um
   rótulo longo num ladrilho e exige que ele encurte, caiba no ladrilho e
   não alargue a página além dos 360 px. O encurtamento, porém, é a **rede**,
   não o normal: **nenhum rótulo real do app pode chegar nela**. Dentro do
   `<details>` a fileira de três perdeu ~9 px por coluna (o ladrilho caiu de
   ~104 px para 95 px) e "BARRA FIXA" — 62 px de texto para 55 px de linha —
   saía "BARRA F…", cortado nos dois temas e também numa conta nova. Os
   pixels voltam em três lugares: o ladrilho do `Contador` usa `px-2` (8 px,
   e não 10), o rótulo perde o `tracking-wide` (a 10 px ele custava 0,25 px
   por letra, justo no rótulo mais comprido) e o corpo de uma seção do
   Relatório usa `px-2` no lugar de `px-3`, o que devolve ~2,7 px a cada
   coluna de três. São **64 px de linha para 60 px de texto** onde faltavam
   7 px. O teste que fecha este lado também mede: em `/relatorio`, com as
   cinco seções abertas, nenhum `[data-rotulo]` de rótulo REAL pode ter
   `scrollWidth > clientWidth`.
8. **Sem sigla nem notação sem tradução.** "e1RM" sai do app **inteiro**,
   não só de `/relatorio`: o gráfico diz "carga máxima estimada" e "Máx.
   estimada", o card Recorde do histórico de um exercício diz "Máx.
   estimada" e o recorde do resumo da sessão diz "45 kg de carga máxima
   estimada". "Σ reps × kg" vira "soma de repetições × carga, nas últimas 12
   semanas" no gráfico e "Soma de repetições × carga das séries de trabalho
   concluídas chega a 50.000 kg" na folha de detalhe de uma conquista de
   volume (`lib/conquistas.ts`) — a folha está a um toque da grade, e com
   ela fechada nenhum teste de texto da página a alcança, então quem fecha
   isto para as 26 conquistas é um teste de unidade sobre `nome`,
   `descricao` e `regra`, e o e2e abre uma folha antes de medir. O "×"
   fica: na tela ele lê "vezes" ("4× por semana", "Treino B × 1").
   "Aderência" vira "Constância (4 semanas)" e a contagem se separa
   do nome do treino ("Treino B × 1", não "Treino B 1"). A porcentagem tem um
   formato só no app — `formatarPercentual()` em `lib/formato.ts`, com o
   símbolo colado ("78%") —, no lugar do `${…} %` escrito à mão. As linhas
   Força / Cardio / Barra fixa viram uma grade `grid-cols-[5.5rem_1fr]`, com
   o valor sempre no mesmo x.
9. **Legenda da faixa e cartão vazio de uma linha.** O histórico ganha uma
   legenda de uma linha sob a faixa da semana: **"✓ feito · ◉ parcial ·
   ○ a fazer · ● faltou · — descanso · hoje em destaque"**. A legenda não é
   escrita à mão — sai de `LEGENDA_DA_FAIXA` (`lib/semana.ts`), montada de
   `GLIFO_DA_MARCA` e `NOME_DA_MARCA`, ambos `Record<MarcaDoDia, …>`: a
   versão à mão explicava **quatro** glifos para as **cinco** marcas que a
   faixa desenha e deixava "parcial" de fora (a sessão começada e não
   concluída, que `montarGrade` emite de verdade). Com o `Record`, uma marca
   nova quebra a compilação e entra na legenda no mesmo movimento, e os
   nomes são os que o leitor de tela já lê no dia. **E nenhum desenho serve a
   duas marcas**: o dia de HOJE ainda por fazer era um ponto **cheio** na cor
   primária — o mesmo desenho que a legenda ensina para "faltou", e o estado
   mais comum da tela, todo dia até o treino sair. Hoje por fazer passa a ser
   o mesmo **anel** dos outros dias por fazer, só que `border-primary`; quem
   diz que o dia é hoje é o realce do ladrilho inteiro (`bg-primary/15` +
   `ring`), não a forma da marca. O ponto cheio fica sendo de "faltou" e de
   mais ninguém. Cada marca leva `data-glifo` (no `<li>` o `data-marca` de
   hoje vira "hoje" e esconde o estado), e o teste que fecha isto mede o
   desenho — largura de borda e preenchimento —, não o texto. Em "Carga dos
   grandes" o exercício sem registro encolhe para uma linha (nome + "sem
   registro"), em vez de um cartão de altura cheia com um vazio de gráfico
   dentro.

### 22.8 Lote 8 — Calendário e faixa da semana

1. **Nunca um numerador maior que o denominador.** Passadas as
   `SEMANAS_PARA_FASE2` semanas, `rotuloDaFase()` (`lib/semana.ts`) parava de
   contar junto: dizia "Fase 1 · semana 16 de 12". Agora, da semana 13 em
   diante, ele devolve **"Fase 1 · 12 de 12 concluída"** — sem fração
   impossível — e `faseCumprida()` (o mesmo módulo, mesma regra) diz à tela
   que a Fase 1 já cobriu o plano. O Calendário usa as duas: o chip da fase
   mostra o texto novo e, quando a fase está cumprida, aparece ao lado um
   atalho **"Passar para a Fase 2"** para o card do perfil que faz a troca
   (`/mais/perfil`) — a sugestão da §5.1 deixa de existir só no perfil. Até a semana 12 nada muda ("Fase 1 · semana 3 de 12").
2. **O mês da miniatura fica navegável de verdade.** Cada dia da grade do mês
   passa a ser um `<button>` que abre o **mesmo `DialogoDia`** do cartão da
   semana (a `DiaDaGrade` do dia sai de `montarGrade()` na hora do toque, pela
   mesma fonte), e o toque também leva a semana de cima para a semana daquele
   dia. Ao lado do título entram as setas **‹ ›** de mês. Cada casa tem 44 px
   de altura e ≥ 44 px de largura a 360 px.
3. **A faixa dos sete dias rola em vez de vazar.** `components/ui/faixa-semana.tsx`
   era sete colunas `flex-1` com largura mínima de texto: a 200 % de zoom
   (180 px efetivos) ela media 264 px e empurrava a página inteira para o
   lado. A lista vira um carrossel (`overflow-x-auto` + `snap-x`, o mesmo
   padrão dos desafios), com `min-w-9` por dia: a 360 px as sete casas
   continuam preenchendo a largura sem rolagem nenhuma; abaixo disso quem
   rola é a faixa, não a página. No Calendário, o cabeçalho e a navegação da
   semana passam a quebrar linha (`flex-wrap`) pelo mesmo motivo. A 180 px o
   `/calendario` deixa de rolar para o lado; na aba Treino continuam passando
   da largura duas coisas **presas na tela** (`position: fixed`) e de fora
   deste lote — a barra de 5 abas (`components/nav-inferior.tsx`) e o botão
   flutuante —, registradas na fila.
4. **Um só desenho de marcador, uma só linha de base.** Os cinco estados da
   faixa desenhavam caixas diferentes (disco de 24 px para "feito", anel de
   24 px para "parcial", pontos de 8–10 px para o resto). Agora todos ocupam
   a mesma caixa de **20 × 20** e mudam só o que há dentro: feito = disco
   cheio com ✓ de 12 px; parcial = anel de 20 px com miolo de 8 px; a fazer
   = anel de 10 px (na cor primária quando é hoje, §22.6 item 9); faltou =
   disco de 10 px; descanso = traço de 10 × 2. Nenhum desenho muda de
   significado — a legenda de `LEGENDA_DA_FAIXA` continua valendo.
5. **"Hoje" também para quem não vê a cor.** O dia corrente da grade do mês
   leva `aria-current="date"` e a palavra "hoje" no nome acessível da casa
   (em vez de um `<span class="sr-only">`, que entraria no `getByText` da
   página como texto — o mesmo motivo da §22.3 item 11), além do realce de
   fundo que já existia.
6. **Legenda da grade do mês, e forma antes de cor.** Sob a grade entra uma
   legenda de uma linha, desenhada com os **mesmos** glifos da grade
   (`GlifoDoMes`, não um texto à mão): ● feito · ◉ parcial · ○ força a fazer
   · ◇ cardio a fazer · ✕ perdido. Feito e planejado passam a diferir por
   **forma** (disco cheio × anel), força e cardio por forma (círculo ×
   losango) e o dia perdido por um ✕ — nada depende mais do tom.
7. **A contagem da semana vira barra, e "perdidos" some quando é zero.** A
   linha "1 feito · 3 a fazer · 0 perdidos" ganha uma barra de três segmentos
   (feito / a fazer / perdido) logo abaixo da navegação, e o trecho
   "perdidos" só aparece quando há algum: a semana perfeita lê
   "3 feitos · 2 a fazer".
8. **A semana mostrada fica entre as setas.** O intervalo ("14/09 – 20/09")
   sai do cabeçalho e entra entre ‹ e ›; o "Hoje", que ocupava a largura
   inteira, vira um botão pequeno que **só aparece quando a semana na tela
   não é a atual**.
9. **"Não vou treinar hoje" presa ao dia.** A ação deixa de flutuar no fim da
   tela: fica logo abaixo da grade, separada por um divisor e pelo rótulo
   "Se hoje (16/09) não rolar", com a data de hoje no próprio rótulo.
10. **Hierarquia do mês e cartões do dia da mesma altura.** O nome do mês
    passa a ser um título de seção (`text-base font-semibold`, sem
    versalete), a linha da semana mostrada acima ganha realce dentro da
    grade, e os cartões da semana usam `line-clamp-1` no rótulo e no detalhe
    com altura mínima fixa — os sete ficam do mesmo tamanho e o texto
    inteiro continua no `DialogoDia`.
11. **Antes do começo do programa não existe falta.** `marcarDia()`
    (`lib/semana.ts`) não conhecia `profiles.data_inicio`: qualquer dia de
    força ou cardio ANTERIOR ao começo do programa e sem sessão virava
    "faltou" — com o item 6 acima, um ✕ vermelho na grade do mês (dez deles
    em setembro, para quem começou no dia 14) e a palavra "faltou" no nome
    acessível. Entra a marca **"antes"**: o dia anterior a `data_inicio` não
    desenha nada, anuncia-se como **"antes do começo"** e fica de fora da
    contagem da semana — a linha "N perdidos" some junto, e a semana inteira
    anterior ao começo não escreve contagem nenhuma. "antes" é a ausência de
    marca, então não entra na legenda: `MarcaVisivel`
    (`Exclude<MarcaDoDia, "antes">`) guarda o contrato da §22.6 item 9 —
    qualquer OUTRA marca nova continua quebrando a compilação de
    `GLIFO_DA_MARCA`/`ORDEM_DA_LEGENDA`. Uma sessão gravada antes do começo
    (quem mudou a data de início depois de já ter treinado) continua valendo
    como feita. É a §11 na prática: o app não cobra dias em que o usuário
    ainda não existia.

### 22.9 Lote 9 — Explorar e catálogo: achar o exercício

1. **O catálogo sai de dentro do Explorar.** `/explorar` media 8.922 px porque
   despejava a `<ListaExercicios>` inteira — os 81 exercícios, 78% da página —
   abaixo da vitrine. No lugar dela entra uma **prévia de 12** (os doze
   primeiros do catálogo) com **"Ver os 81 exercícios"** levando a
   `/exercicios`. A tela fecha abaixo de 4.000 px.
2. **O catálogo monta 20 de cada vez.** `/exercicios` montava os 81 cartões —
   e os 81 `<img>` — numa tacada. Agora mostra **20** e um **"Ver mais 20 de
   81"** que acrescenta mais 20 (a mesma forma do "Ver mais" do Histórico do
   Relatório); a contagem da tela ("81 exercícios",
   "40 de 81 exercícios") continua dizendo o total achado, não o que está
   montado. Trocar a busca ou um filtro volta para os 20 primeiros.
3. **A busca mostra o exercício primeiro.** Buscar "supino" punha nove linhas
   de coleção na frente e o exercício caía em y=860, fora da tela. O resultado
   passa a ser **Exercícios primeiro, Coleções depois**, cada bloco com a sua
   contagem no título; quando os dois blocos existem, um seletor no topo
   ("Exercícios (6) · Coleções (9)") pula direto para o bloco (item 10).
4. **Um vazio só, citando o termo.** Busca sem nenhum resultado mostrava dois
   vazios empilhados, e o segundo ("Nenhum exercício com esses filtros")
   mentia — não havia filtro nenhum. Agora é **um** vazio: *Nada para
   «zzzz»* com **"Limpar busca"**. A mensagem de filtro do catálogo só
   aparece quando há mesmo filtro (`temFiltro`).
5. **Chegar por uma busca mostra resultado, não controle.** No catálogo com
   busca vinda de fora e não vazia, o bloco de filtros fica recolhido atrás do
   botão **"Filtros"** (com o número de filtros ativos); tocar abre.
6. **`app/not-found.tsx`.** Duas rotas chamam `notFound()` e não havia página
   para receber: um atalho guardado ou um link velho depois de uma atualização
   do PWA caía na tela crua do Next, em inglês. Agora responde uma página em
   pt-BR — *"Essa tela não existe mais."* — com três saídas: **Voltar para
   Hoje**, **Ver o Explorar**, **Ver os exercícios**.
7. **Nenhuma capa repetida na mesma seção.** `supino-reto-com-barra-1.jpg` era
   a capa de quatro coleções da mesma tela. Cada seção da vitrine passa por
   `semCapasRepetidas()`: a coleção pega a primeira foto **ainda não usada
   naquela seção** e, se não sobrar nenhuma, fica com o ícone do seu tipo em
   cima da cor do grupo — que a 56 px distingue melhor do que a quarta cópia
   da mesma foto. A capa guardada em `montar()` não muda: a tela da coleção
   continua com a foto do primeiro exercício.
8. **Um degrau entre rótulo e seção.** "Escolhas para você" não agrupava nada
   e competia com os títulos: vira **overline de 11 px em caixa alta**, e os
   títulos de seção sobem para **16 px semibold com régua acima**.
9. **A rota da coleção é normalizada.** `hrefDaColecao` escrevia o segmento
   como o id ("/explorar/grupo/Core", com acento e maiúscula) e `colecaoDaRota`
   comparava texto cru: ida e volta divergiam em acento e caixa. Os dois lados
   passam por `segmentoDaColecao()` (minúscula, sem acento, espaço vira
   hífen) — os links antigos continuam abrindo, porque a comparação normaliza
   o que chega.
10. **O número do título é o da lista, e o seletor só aparece com dois
    blocos.** Duas afirmações falsas saíam do mesmo resultado de busca.
    (a) O `<p>` do seletor desenhava **sempre** os dois âncoras, mas cada
    bloco só é montado com contagem > 0: "tatame" acha 0 exercícios e 2
    coleções, e «Exercícios (0)» ficava sendo um link focável de 80×44 px
    para um id **fora do documento** — tocar nele não fazia nada. O seletor
    passa a ser montado só quando os **dois** blocos existem; com um bloco só
    não há escolha a oferecer, e a linha some.
    (b) A contagem do título saía de uma conta com o **termo apenas**,
    enquanto a lista embaixo aplicava também o filtro recolhido atrás do botão
    "Filtros" (item 5): buscar "supino" e escolher Grupo = Costas deixava
    «Exercícios (6)» em cima, "0 de 81 exercícios" no meio e "Nenhum exercício
    com esses filtros" embaixo — três números, e o 6 falso. Os filtros passam
    a morar no `TelaExplorar`, e a `<ListaExercicios>` os recebe por prop
    (`filtros` + `aoMudarFiltros`): número e lista saem do **mesmo** filtro.
    Com filtro ativo e zero achados o bloco dos exercícios continua montado —
    é ele que carrega o "Limpar filtros" — e o vazio da busca inteira (item 4)
    não aparece; o contador "N de 81" some quando a busca vem do Explorar,
    porque o título logo acima já é o contador, e é o título que ganha
    `aria-live`. Apagar a busca solta os filtros; trocar só o termo os mantém,
    com o selo do botão "Filtros" dizendo quantos são.

### 22.7 Lote 7 — Aba Treino: hierarquia e controle

A aba Treino tem 2.555 px de rolagem e concentrava tudo no topo. Este lote
muda **o que fica ao alcance do polegar** e **quem manda no toque**.

1. **O "Ajustar" saiu do meio da lista.** Era um botão flutuante fixo no canto
   inferior direito: com a lista rolada, `elementFromPoint` sobre o
   "Substituir" do 3º exercício devolvia o svg do FAB (sobreposições de
   3 × 21 px e 15 × 21 px). Ele passa a morar no **cabeçalho da aba**, ao lado
   da data, como botão de contorno de 44 px — a folha que abre é a mesma.
   Continua valendo §18.3: com a retomada por decidir, o "Ajustar" sai da tela.
   A folga de 96 px no fim da aba (`pb-24`), que só existia por causa do FAB,
   saiu junto.
2. **A sessão de hoje deixa de sumir ao rolar.** Quando o card do dia passa
   para cima da tela, uma **faixa fixa fina** assume o mesmo caminho no alto
   ("Treino A · 0/17 séries · Continuar", ou o foco do treino e "Começar"
   quando ainda não há sessão). Vale nos dias de força, onde a aba é longa; a
   sentinela que a liga fica logo abaixo do card. As linhas da lista ganharam
   `scroll-mt-14` para a faixa não comer a linha recém-rolada.
   A faixa **inteira é o controle**, como a barra do tocador de um app de
   música: ela é um cartão opaco, com contorno e sombra, escrito "Treino A", e
   por isso cada pixel dela faz a coisa que ela anuncia. Deixá-la inerte
   (`pointer-events-none` no cartão, toque só no botão) foi tentado e
   **descartado**: os pixels voltavam para a lista de baixo e tocar no nome do
   treino abria a ficha de um exercício escondido debaixo da faixa.
   Aceite: **em toda posição de rolagem com a faixa à vista,
   `document.elementFromPoint` em qualquer ponto do retângulo dela devolve um
   elemento DENTRO dela** — varrido de 24 em 24 px na largura, a cada 60 px de
   rolagem, nos dois temas. Em troca, o que para debaixo da faixa fica coberto
   enquanto está ali: nenhum controle fica permanentemente inalcançável —
   **rolar um dedo revela qualquer linha que pare debaixo da faixa** —, e o
   aceite do item 1 ("o toque em cada Substituir chega no próprio botão") vale
   para toda linha fora das duas barras fixas — esta, no alto, e a barra de
   abas, embaixo (§14.1). Para o salto por âncora e o foco pelo teclado a folga
   vem do `scroll-padding-top` do documento.
3. **A folha "Ajustar" grava sozinha.** "Preparação" e "Descanso padrão"
   gravam no sair do campo (e 700 ms depois de parar de digitar), como os
   interruptores ao lado; os dois botões "Salvar" sumiram — dois modelos de
   gravação na mesma folha faziam duvidar se o interruptor tinha pegado. O
   texto pela metade no campo do descanso ("do exercí…") virou "—", o vazio do
   "não gosto" ganhou antecedente ("Nenhum por enquanto. Quando você marcar
   algum…") e a folha abre com o foco no **título**, não no primeiro campo:
   abrir ajustes não abre mais o teclado numérico.
4. **Os ladrilhos Fase e Peso têm a mesma gramática.** Rótulo, valor e legenda,
   cada um numa linha de altura fixa, ancorados ao topo: "Fase 1" com a legenda
   "semana 16" (como PESO já fazia com "há 4 dias"), valor em linha só com
   `text-nowrap`. Os dois ladrilhos têm a mesma altura e os valores caem na
   mesma linha de base.
5. **O nome do exercício vem antes da carga.** Na lista de hoje o nome está em
   `font-semibold` e sozinho na linha; os raios de dificuldade desceram para o
   fim da prescrição ("3 × 8-12 ⚡⚡") e o "Hoje:" perdeu a fonte de número (que
   ficou só no valor). O nome continua podendo **quebrar em duas linhas**
   (`line-clamp-2`): a 360 px cinco dos seis nomes do Treino A não cabem numa
   linha, e cortar apagaria justamente o que separa "Desenvolvimento com
   halteres" de "Desenvolvimento militar em pé" ou os dois "Supino inclinado
   com …" — num celular não há `title` para consultar, e logo abaixo, em "Parte
   do corpo em foco", os mesmos nomes aparecem inteiros.
6. **O carrossel de Desafios diz que tem três.** O `<ul>` ganhou nome
   ("Desafios"), a posição aparece em texto ("1 de 3") e em três pontinhos, e
   cada CTA diz o destino ("Fazer a sessão de barra fixa", "Fazer a corrida da
   semana 2", "Fazer o treino da fase 1") em vez de três "Fazer a sessão da
   semana" iguais. O botão ganhou `mt-auto`: não pula mais de altura de um card
   para o outro quando o subtítulo tem duas linhas.
7. **As fileiras de chips avisam que continuam.** As duas listas horizontais de
   "Parte do corpo em foco" ganharam máscara de degradê na borda — só do lado
   em que há conteúdo fora da tela, e nenhuma quando tudo cabe.
8. **Verbo com objeto.** "Começar Peito" virou "Começar o treino de peito";
   "Começar Treino B", "Começar o Treino B"; "Começar (3)", "Começar com 3
   exercícios". O card do dia continua "Começar treino".
9. **Voltar do player não é mais mudo.** O gesto do sistema não é bloqueado: ao
   voltar do player com a sessão aberta, a aba Treino avisa ("Treino guardado —
   toque em Continuar para retomar.", 4 s) e destaca **o elemento que tem o
   "Continuar" daquela sessão**: o card "em andamento" quando a sessão aberta é
   a do dia, e o banner "Você tem um treino aberto de …" quando é outra — uma
   sessão livre, a de ontem, ou um dia de cardio/descanso. Nunca o card que
   começaria um treino novo. Vale também para o "Continuar depois" da Visão
   geral, que sai pelo mesmo caminho.
