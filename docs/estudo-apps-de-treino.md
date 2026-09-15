# Estudo: apps de treino de celular, open source e padrões de tela

Data: 15/09/2026. Três pesquisas encomendadas para a decisão da camada visual v2 do Treino do Terraço (ver `docs/analise-referencia-treino-em-casa.md` e `SPEC.md` §13–§14). Cada parte foi escrita por um pesquisador independente, com fontes; opiniões estão marcadas.

## Resumo executivo

1. **Apps comerciais.** Barra inferior de 3 a 5 abas, sempre com a primeira aba sendo "fazer o treino de hoje" e a descoberta separada da execução. Apps de força (Hevy, Strong, Fitbod, JEFIT, Caliber) registram por série, mostram o valor anterior ao lado do campo, disparam o descanso ao marcar a série e resolvem o relatório com calendário + gráficos + recordes. Apps guiados (Treino em Casa/Leap, Nike Training Club, Freeletics) usam um player que avança sozinho, sem carga. A síntese para nós: visual da referência + execução por série, num player unificado.
2. **Open source.** O casamento de stack mais próximo é o workout.cool (MIT, Next 16 + React 19 + Recharts 3): gráficos de e1RM/volume/peso e um heatmap SVG sem dependências valem copiar. Liftosaur, wger e openGym são AGPL: ler o algoritmo, não copiar código. Mídia de exercício "aberta" quase sempre é fechada na imagem (Gym Visual/ExerciseDB); as únicas fontes limpas são Wikimedia Commons/Everkinetic (CC BY-SA), o wger filtrado por licença por item e os 53 desenhos e 4 sons do Feeel (CC BY-SA / CC0). As 67 figuras SVG próprias são o ativo mais seguro do projeto.
3. **UX.** Alvos ≥ 44/48 px, contagem regressiva de 72–96 px com números tabulares, rótulos de uma palavra em caixa alta, timer de descanso sticky, retomar sessão sempre, sem kcal (erro de 27–93 % mesmo com sensor), IMC secundário, streak em semanas e não em dias, Explorar com busca sempre visível e listas densas, tema escuro com elevação por luminosidade. Dois tokens da paleta escura atual falham o contraste 3:1 (músculo secundário e bordas de campos) e precisam de ajuste.

---

# Parte 1 — Arquitetura de informação dos apps comerciais


**Escopo:** levantamento de IA (abas, telas-chave, formatos, engajamento, free/pago) de 11 apps, com fontes. **Data da pesquisa:** setembro de 2026.

**Limitações metodológicas (importante):** não foi possível instalar/abrir os apps. Tudo abaixo vem de documentação oficial (help centers, páginas de features), listagens de loja e reviews/teardowns publicados. Vários apps **não publicam a lista literal das abas inferiores** — quando a fonte não confirma, está escrito **"não encontrado"** em vez de suposição. Alguns help centers (Hevy Zendesk, Fitbod Zendesk, hotelgyms, Medium) retornaram 403/404 e não puderam ser lidos diretamente; nesses casos usei o resumo do buscador e marquei como *parcialmente verificado*.

---

## 1. Leap Fitness — "Home Workout – No Equipment" / "Treino em Casa" (referência visual do dono)

**Desenvolvedor:** Leap Fitness Group / Leap Health (pacote Android `homeworkout.homeworkouts.noequipment`).

### 1.1 Abas da navegação inferior
**Não encontrado em fonte pública verificável.** Nenhuma página oficial da Leap, listagem de loja ou review que consegui ler descreve a barra inferior com os rótulos *Workout · Discover · Report · Setting*. A única corroboração indireta que apareceu foi um trecho de resultado de busca afirmando que "the Report tab is used to calculate BMI and keep track of weight" — não consegui rastrear a página de origem, então trato como **não confirmado**. A estrutura que o dono descreve (Treino · Descobrir · Relatório · Definição) é consistente com o que as fontes dizem existir no app, mas os *nomes das abas* permanecem não verificados por fonte externa.

### 1.2 O que as fontes confirmam sobre cada área
- **Treino (conteúdo):** rotinas diárias por grupo muscular — abdômen, peito, pernas, braços, glúteos e corpo inteiro; níveis iniciante / intermediário / avançado; HIIT, calistenia, Pilates; planos de 4 semanas (a autora do review fez o "Full Body 7x4 Challenge", 7 dias × 4 semanas); desafios como o de prancha de 15 minutos. Rotinas de ~7 a 19 minutos.
- **Player de exercício:** exercícios aparecem como **"little animated images"** (figuras animadas); tocar na imagem abre um texto com dicas de técnica; durante a execução o app sugere notas de forma e **modificações para facilitar ou dificultar**; as pausas de descanso são ajustáveis "com um toque simples" (estender ou pular), e existe um botão de *boost rest*. Há **guia em vídeo e animação para cada exercício** e rotinas de aquecimento e alongamento.
- **Relatório/progresso:** registro automático do progresso de treino; gráfico de tendência de peso; **rastreador de peso e IMC embutido**; meta simples de "quantas vezes você quer treinar por semana", exibida na tela inicial; compartilhamento de progresso em redes sociais.
- **Engajamento:** lembretes/alarme de treino customizáveis ("meu celular acende às 20h todo dia mandando treinar"); planos de 4 semanas em que o objetivo é treinar diariamente e **manter o streak**; a Leap adicionou recentemente "Awards"/"Rewards" para "celebrar conquistas". **Sem recursos sociais** (não dá para seguir amigos).
- **Personalização:** o app gera um plano pessoal a partir de área de foco, meta semanal e nível. Um review aponta que **não há busca nem filtro** na biblioteca de treinos, e que não dá para customizar por nível/objetivo além do plano gerado.
- **Versão iOS 2026** (listagem atual): 500+ exercícios, "AI coach adjusts your workout plan over time", sincronização com Apple Health, Apple Watch e iPad.

### 1.3 Free vs. pago
Grátis com anúncios. Assinatura premium remove anúncios e libera todo o conteúdo: review independente cita **a partir de US$ 9,99/mês com teste de 7 dias**; a listagem da App Store informa faixas de **US$ 9,99–14,99/mês e US$ 23,99–69,99/ano**.

**Fontes:**
https://leaphealth.fitness/ · https://leap.app/ · https://apps.apple.com/us/app/home-workout-no-equipments/id1313192037 · https://www.dammitkaren.com/2019/10/fitness-app-review-home-workout-by-leap.html · https://www.makeuseof.com/leap-fitness-apps/ · https://www.compareworkoutapps.com/reviews/leap-home-workout-review/ · https://apkcombo.com/home-workout-no-equipment/homeworkout.homeworkouts.noequipment/ · https://home-workouts-leap-fitness-group.en.aptoide.com/app · https://home-workout-no-equipment-ikn.en.softonic.com/android

---

## 2. Hevy (força, registro por série) — o mais próximo do seu caso de uso

### 2.1 Abas
Confirmadas nominalmente pela documentação da própria Hevy: **Home** (feed social), **Workout**, **Profile**. A biblioteca de **Exercises** é alcançada *dentro* da aba Profile ("Profile tab and tap the Exercises button"), e a exploração de rotinas é um botão **Explore** *dentro* da aba Workout ("Explore button under Routines"). A lista literal e ordenada dos 5 itens da barra inferior **não encontrada** em fonte oficial.

### 2.2 Telas-chave
- **Home:** feed de treinos de quem você segue, com título, resumo, curtidas e comentários; usuários novos veem um feed de *Discovery* com recomendações.
- **Workout:** rotinas organizadas em **pastas**; tocar na rotina → *Start Routine*; ou **Start Empty Workout** em 2 toques (monta enquanto treina).
- **Registro por série (a tela central):** linhas de série mostrando **o valor anterior ("previous performance") ao lado do campo atual**; **checkmark por série** que marca concluída e **dispara o timer de descanso**; tipos de série (aquecimento, drop set, até a falha, normal); notas por exercício; supersets; adicionar/remover/trocar/reordenar exercícios no meio do treino; **notificação de recorde ao vivo** durante a sessão; timer de descanso customizável por exercício.
- **Tela de exercício:** 400+ exercícios com **animação demonstrativa** + instruções passo a passo; equipamento e músculos; histórico do exercício sessão a sessão; recordes (peso mais pesado, 1RM projetado ou real, melhor volume de série, total de reps); gráficos de progressão. Exercícios customizados (7 no grátis).
- **Relatório (Profile → Statistics):** *Last 7 Days Body Graph* (atividade + músculos treinados), **contagem de séries por grupo muscular** (semanal/mensal/anual), **gráfico de distribuição muscular com diagrama do corpo**, *Main Exercises*, *Set Records* (melhor marca por faixa de repetições), comparação de *Strength Level* para agachamento/supino/levantamento terra com barra, histórico de treino por exercício.
- **Calendário:** Profile → Calendar, com os dias treinados **circulados em azul**; toca na data e abre o treino.
- **Corpo:** medidas corporais e peso dentro do Profile.
- Widgets de tela inicial do celular e relatório mensal.

### 2.3 Engajamento
Feed social, seguir pessoas, curtir/comentar, copiar rotinas alheias, leaderboards, notificação de PR. **Sem badges/streak como mecânica central** — o reforço é o PR e a consistência no calendário.

### 2.4 Free vs. Pro
Grátis: **4 rotinas, 7 exercícios customizados, 3 meses de histórico nos gráficos**, logging ilimitado, biblioteca completa, feed social. **Hevy Pro: US$ 2,99/mês, US$ 23,99/ano, US$ 74,99 vitalício** → rotinas ilimitadas, histórico ilimitado nos gráficos, exercícios customizados ilimitados, medidas corporais avançadas, heatmaps de grupo muscular, e o **Hevy Trainer** (programas adaptativos com ajuste automático de carga).

**Fontes:**
https://www.hevyapp.com/hevy-tutorial/ · https://www.hevyapp.com/features/best-way-to-track-workouts/ · https://www.hevyapp.com/features/gym-performance/ · https://www.hevyapp.com/features/exercise-library/ · https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350 · https://www.sensai.fit/blog/hevy-vs-strong-2026 · https://repreturn.com/hevy-app-review/

---

## 3. Strong (força, registro por série)

### 3.1 Abas
Reviews convergem em **5 abas**: **Start Workout · History · Exercises · Measure · Profile** (*parcialmente verificado* — vem de dois reviews independentes, não de documentação oficial).

### 3.2 Telas-chave
- **Start Workout:** abre direto nos **templates de rotina organizados em pastas** (ex.: pasta "PPL split") + opção de treino vazio.
- **Tela de execução:** nome do exercício com as séries listadas abaixo; **as séries anteriores ficam visíveis** para comparação; notas por exercício; marcar série como aquecimento, falha ou drop set; supersets/agrupamento; **seletor de métrica de foco no canto superior direito** (volume total, aumento de volume, total de reps, peso por repetição); **timer de descanso** com duração padrão configurável e override por exercício; **calculadora de anilhas** e **calculadora de aquecimento**.
- **Tela de exercício — 4 abas internas:** **About** (vídeo ou imagem + instruções passo a passo), **History** (todos os treinos em que o exercício apareceu), **Charts** (só no PRO), **Records** (melhores marcas de todos os tempos, melhor desempenho em cada número de reps, e a melhor carga projetada para qualquer faixa de reps).
- **History:** **calendário** com os dias treinados; abrir um treino mostra duração, peso total movido e PRs batidos.
- **Measure:** peso, % de gordura e medidas, integrado ao Apple Health.
- **Profile:** **dashboard de widgets configuráveis** — *Workouts Per Week* (com meta semanal ajustável), *Calories This Week*, *Daily Macros*, *Exercise Charts* (gráfico de um exercício específico) e widgets de medida individual.
- Apple Watch: app completo e independente, com sync ao vivo e notificação do timer no pulso. Exportação CSV. Fotos de progresso e notas por treino.

### 3.3 Engajamento
Praticamente nulo por design: **"the gym's notebook" — zero recursos sociais, sem feed, sem follows, sem perfil público**. A motivação vem dos PRs, do calendário e do widget de treinos/semana.

### 3.4 Free vs. PRO
Grátis: logging ilimitado, **limite de 3 rotinas**. **PRO: US$ 4,99/mês, US$ 29,99/ano, US$ 99,99 vitalício** → rotinas ilimitadas, gráficos/analytics, calculadora de anilhas.

**Fontes:**
https://www.thenerdystudent.com/2021/08/strong-review/ · https://www.makeuseof.com/using-strong-app-to-track-gym-progress/ · https://help.strongapp.io/article/237-about-exercise-detail · https://help.strongapp.io/article/239-profile-widgets · https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577 · https://www.sensai.fit/blog/hevy-vs-strong-2026

---

## 4. Fitbod (força gerada por IA)

### 4.1 Abas
Confirmadas nominalmente pelo help center: **Workout**, **Log** (explicitamente "bottom right corner") e **Recovery**. Existe também **"Your Gym"** para perfis de equipamento. As **Settings ficam dentro da aba Log** (ícone de engrenagem no topo direito), o que sugere que **não há aba "Profile"** separada. Lista completa e ordenada **não encontrada**.

### 4.2 Telas-chave
- **Workout:** o treino já vem gerado; **cronômetro proeminente no topo**; lista de exercícios com **miniatura que abre o vídeo instrucional**; menu de três pontos por exercício/grupo/treino (ver instruções, substituir exercício, excluir); **+** no topo direito para adicionar exercício; **long-press + arrastar** para reordenar; edições rápidas posicionadas acima dos grupos musculares-alvo; salvar/compartilhar/ver próximos treinos; **X** para descartar. Séries e reps de cada exercício visíveis nessa aba.
- **Registro:** sugestão de carga e reps que o usuário pode ajustar durante a sessão; timers de descanso com notificação; demos em vídeo "rápidos de carregar".
- **Tela de exercício:** 1000+ exercícios com **vídeos em alta resolução e múltiplos ângulos** + instruções detalhadas, buscáveis por grupo muscular, equipamento ou palavra-chave; logs históricos para comparação; notas pessoais; "recomendar mais/menos vezes" ou excluir o exercício.
- **Recovery:** **heat map muscular** mostrando quais músculos já descansaram o suficiente desde os treinos anteriores — evita martelar peito 3 dias seguidos ou esquecer pernas por uma semana. Porcentagem de recuperação configurável.
- **Log:** lista de treinos passados; abrir um treino → abrir um exercício → tela de detalhes do exercício; editar séries, reps e ordem *a posteriori*; gráficos e recordes pessoais.
- **Your Gym:** múltiplos perfis de academia (casa/academia/viagem) com equipamentos marcados; o app regenera os treinos conforme o perfil.
- Integrações: Apple Health, Apple Watch, Strava, Fitbit.

### 4.3 Engajamento
Sem streak/badges destacados nas fontes. O gancho é o **heat map de recuperação** + "o treino de hoje já está pronto".

### 4.4 Free vs. pago
**3 treinos grátis** e depois assinatura: US$ 12,99–15,99/mês, US$ 79,99–95,99/ano. Praticamente tudo é pago.

**Fontes:**
https://fitbod.me/blog/a-better-workout-tab/ · https://help.fitbod.me/hc/en-us/articles/30721437384215-How-to-Navigate-the-Exercise-Details-Screen (título/URL; corpo bloqueado) · https://apps.apple.com/us/app/fitbod-gym-fitness-planner/id1041517543 · https://fitnessdrum.com/fitbod-review/ · https://www.indiehackers.com/post/fitbod-app-review-2026-honest-take-after-real-testing-45d5f07a1b

---

## 5. JEFIT (força, registro por série)

### 5.1 Abas
Confirmadas pelo FAQ oficial: **Workout**, **Discover**, **Progress**, mais uma área de **Profile** (implícita pela gestão de assinatura). Ordem literal **não encontrada**.

### 5.2 Telas-chave
- **Workout:** criar rotinas customizadas ou usar planos prontos (2.000+ programas da comunidade); selecionar **um dia do plano** e "Start workout". **BodyMap**: diagrama que mostra o engajamento muscular e identifica músculos subutilizados — toca no **+** sobre o músculo para adicionar um exercício.
- **Registro:** cada exercício rastreado com **séries, reps, peso e notas**; **o tempo de descanso é registrado automaticamente entre séries**; timer de descanso é forçado em todo treino (reclamação recorrente: "não há jeito simples de remover"). Crítica de UX relevante: **não há opção de retomar a sessão se você sair do app por acidente**.
- **Tela de exercício:** 1.400+ exercícios com **vídeos em HD**, grupo muscular alvo e instruções.
- **Progress:** **visão de calendário** onde se edita treinos passados para corrigir erros; estatísticas e recordes; **Analytics é exclusivo Elite**; fotos de progresso e medidas corporais.
- **Discover:** concursos/contests, "year in review" (retrospectiva anual) via banner ou card, rotinas da comunidade.

### 5.3 Engajamento
Contests e retrospectiva anual na aba Discover; rotinas compartilhadas e logs públicos da comunidade.

### 5.4 Free vs. Elite
Grátis com anúncios: logging básico, 1.400+ exercícios, comunidade, número limitado de *Instant Workouts*. **Elite US$ 12,99/mês, US$ 69,99/ano** → sem anúncios, Analytics completo, vídeos HD, smartwatch, rotinas e exercícios premium, Instant Workouts ilimitados.

**Fontes:**
https://www.jefit.com/support/faq · https://etechshout.com/jefit-app-review/ · https://play.google.com/store/apps/details?id=je.fit

---

## 6. Caliber (força + coaching humano)

### 6.1 Abas
**Não encontrado.** As fontes mencionam um **"home dashboard" com um botão "+"** para iniciar/registrar treino, mas nenhuma lista as abas inferiores.

### 6.2 Telas-chave
- **Planos:** 100+ planos de força e mobilidade desenhados por coaches credenciados, para todos os níveis e equipamentos.
- **Construtor:** 700+ exercícios (uma fonte diz 600+), supersets, exercícios customizados.
- **Registro:** "fast and intuitive logging experience"; **o vídeo de demonstração fica em auto-replay enquanto você registra**, e dá para desligar o autoplay; **calculadora de anilhas**; histórico rico de performances anteriores incluindo recordes pessoais na própria tela; sugestão de **exercícios similares** como substitutos.
- **Tela de exercício:** vídeo passo a passo + descrição escrita, decomposta em fases do movimento (ex.: fases do supino), com dicas dos coaches.
- **Relatório:** duas métricas algorítmicas próprias — **Strength Score** (força relativa ao seu potencial, por grupo muscular) e **Strength Balance** (equilíbrio do treino entre grupos musculares, ligado a postura e mobilidade); gráficos de 1RM e de estatísticas corporais; fotos de progresso; cardio; integração com wearables e apps de alimentação.
- **Coaching:** chat no app; você **grava vídeo se executando e envia ao coach**, que devolve correções.

### 6.3 Engajamento
**Private circles** (grupos fechados com amigos) e **comunidades públicas**; notificações de PR; compartilhamento de treino.

### 6.4 Free vs. pago
**Versão gratuita generosa**: treinos ilimitados, 600–700 exercícios, treinar sozinho ou em grupo. Pago = **coaching** (grupo, ou 1-a-1 com treinador humano, plano customizado + revisão semanal).

**Fontes:**
https://caliberstrong.com/workout-app/ · https://fitnessdrum.com/caliber-app-review/ · https://www.garagegymreviews.com/caliber-app-review · https://barbend.com/caliber-fitness-app-review/

---

## 7. Gymshark Training (grátis, guiado + registro leve)

### 7.1 Abas
Reportadas como **Home · Plans · Custom (Create) · Progress · Settings** — *parcialmente verificado*: esse conjunto veio do resumo de um review de UX no Medium que não consegui carregar (403). A Gymshark confirma nominalmente **'Progress'** e **'Create' → 'Workouts' / 'Plans'** em seu material.

### 7.2 Telas-chave
- **Estilo visual:** "interface simples e clara, com **fotografia forte, títulos em caixa alta e layout limpo**" — é o app mais próximo do padrão "capa em foto" entre os de força.
- **Biblioteca:** busca e filtros por **tipo, duração, equipamento e grupo muscular**; também navegação **"BY BODY PART"**; preview do exercício com duração e nível de intensidade; rotinas de atletas patrocinados.
- **Custom/Create:** criar treinos próprios com **séries, reps e descanso personalizados**, escolhendo da biblioteca; e criar/editar planos (renomear, excluir/adicionar exercícios).
- **Execução:** vídeos passo a passo por exercício; rastreamento de treino no app.
- **Progress:** planos ativos + **recordes pessoais dos três levantamentos básicos (agachamento, supino, terra) em gráficos**, atualizados automaticamente ao bater um PR. **Crítica de UX explícita:** não existe visão de calendário mostrando em que dia você treinou cada grupo muscular — é preciso rolar a lista de treinos concluídos para ver as datas.

### 7.3 Free vs. pago
**100% gratuito**, sem custos ocultos — é o argumento principal do app. **Atenção:** a própria Gymshark avisa que o app **não receberá mais correções nem novos recursos**; a versão Android foi retirada e só o iOS continua disponível.

**Fontes:**
https://support.gymshark.com/en/articles/11185911-the-gymshark-training-app · https://apps.apple.com/us/app/gymshark-training-and-fitness/id1139151320 · https://medium.com/@n00213869/gymshark-training-mobile-app-re-design-project-17454c94a0f (título/resumo) · https://medium.com/design-bootcamp/ux-case-study-redesigning-gymshark-flow-for-creating-a-workout-plan-and-making-the-overall-99ae3eea2bd6 · https://www.tomsguide.com/wellness/fitness/gymshark-training-app-review-effective-workouts-for-free

---

## 8. Nike Training Club (guiado por tempo, grátis)

### 8.1 Abas
Confirmadas: **Home**, **Workouts**, **Activity**, mais perfil/conta. Uma aba **"Programs"** separada **não foi confirmada** — os programas aparecem como conteúdo destacado dentro de Home.

### 8.2 Telas-chave
- **Home:** mostra o conteúdo mais novo; **carrossel "Today's Picks"** com treinos recomendados a partir das preferências e do histórico; **Featured Programs** dando acesso às jornadas de várias semanas. Onboarding por quiz que já enfileira um programa.
- **Workouts:** biblioteca navegável com filtros por **grupo muscular** (abdômen, braços, pernas), **foco** (endurance, mobilidade, força, yoga) e **equipamento** (nenhum / básico / completo). Sessões temáticas com atletas famosos.
- **Detalhe do treino:** traz a **lista completa dos exercícios**, "so you'll know what's coming next".
- **Player:** **locução guiando a execução** — anuncia cada exercício, o número de reps e dá orientação de ritmo e esforço; atletas demonstram na tela; versão em **áudio breve** (gratuita, sobre vídeo demo) e versão em **vídeo completo**; integração com música (com ressalva: alguns vídeos de yoga bloqueiam a música do usuário).
- **Programas:** 4 a 6 semanas, divididos em **estágios que se constroem um sobre o outro**, até 5 treinos por estágio, 25–40 min incluindo aquecimento e volta à calma.
- **Activity:** histórico de todas as aulas feitas + **minutos/totais** + **troféus**.

### 8.3 Engajamento
**Troféus/achievements** por: completar um certo número de treinos, treinar várias vezes na semana, treinar em horários diferentes do dia etc. Sem assinatura, sem paywall.

### 8.4 Free vs. pago
**Totalmente gratuito.**

**Fontes:**
https://www.makeuseof.com/how-use-nike-training-club-app-next-level-fitness/ · https://www.reviewed.com/health/content/nike-training-club-review-workout-app · https://www.nike.com/gb/ntc-app · https://play.google.com/store/apps/details?id=com.nike.ntc

---

## 9. Freeletics (guiado + coach adaptativo)

### 9.1 Abas
O blog oficial da Freeletics afirma **3 abas: Community · Coach · Profile**. Um teardown de navegação (AppFuel) descreve **5 seções** (feed social, explorar treinos, iniciar exercício, conta, notificações) — **fontes conflitantes**; a oficial é mais recente e mais confiável. A **Explore** aparece como conteúdo *dentro* da aba Coach ("tap 'Explore all' from your current day in the Coach tab").

### 9.2 Telas-chave
- **Coach** (o núcleo, "a parte mais densa em informação do app"): a **Training Journey** (plano estruturado); **faixa/calendário com círculos sólidos nos dias de treino agendados** e um **contador de streak**; card da sessão do dia com **duração, equipamento necessário e foco muscular**; a sessão vem seccionada de **warm-up até cooldown**; botão **Start**; botão **"Adapt session"** para ajustar o treino a restrições do dia (tempo, dor, equipamento).
- **Feedback pós-treino:** ao terminar, o app pede avaliação; **o coach ajusta intensidade e/ou dificuldade das sessões futuras** com base nela — é o análogo direto de um motor de progressão.
- **Community:** feed social, publicar treinos, interagir, **desafios oficiais** e competições de grupo customizadas.
- **Profile:** **Daily Athlete Score** (métrica de performance baseada na melhor performance dos últimos 90 dias), progresso, leaderboards, configurações e conta.

### 9.3 Engajamento
Streak no calendário do Coach, Athlete Score, desafios oficiais e de grupo, leaderboards.

### 9.4 Free vs. pago
Versão gratuita limitada; a assinatura **Coach** desbloqueia o acesso completo e o "personal trainer digital". O teardown observa que **a tela de iniciar exercício é justamente o ponto onde o app empurra o upgrade**.

**Fontes:**
https://www.freeletics.com/en/blog/posts/getting-started-with-freeletics/ · https://help.freeletics.com/hc/en-us/articles/360002053060-Change-Your-Training-Journey · https://help.freeletics.com/hc/en-us/articles/360004928220-Is-the-app-free · https://www.theappfuel.com/examples/freeletics_navigation

---

## 10. Apple Fitness / Fitness+ (referência de "relatório")

### 10.1 Abas (iPhone)
**Summary · Fitness+ · Sharing** — três abas, confirmadas pelo suporte da Apple.

### 10.2 Telas-chave
- **Summary:** os **anéis de atividade** (Move vermelho = kcal ativas; Exercise verde = minutos de atividade intensa; Stand azul = horas em que você levantou e se moveu por ≥1 min), detalhes de treinos, prêmios/awards e mais. É **customizável**: "Edit Summary" deixa escolher quais métricas aparecem — um dashboard editável, não uma tela fixa.
- **Sharing:** highlights da atividade de amigos e competições amistosas.
- **Fitness+:** catálogo de treinos e meditações por assinatura.

**Lição de IA aplicável:** a tela de relatório da Apple é **um único indicador visual de esforço (os anéis) + um dashboard de cards editável abaixo**, não uma sopa de gráficos.

**Fontes:**
https://support.apple.com/guide/iphone/see-your-activity-summary-iph4c34a8a95/ios · https://support.apple.com/guide/iphone/share-your-activity-iph0b826155d/ios · https://support.apple.com/guide/iphone/adjust-your-activity-ring-goals-iph9a08e004e/ios · https://www.apple.com/apple-fitness-plus/

---

## 11. Sweat (opcional — guiado, referência de "Planner")

### 11.1 Abas
**Workouts · Food · Planner · Activity · Community** (5 abas; o suporte da Sweat confirma que **não existe** aba "Progress" separada — o progresso mora dentro de Activity).

### 11.2 Telas-chave
- **Workouts:** demonstrações em vídeo, timers e **pistas de áudio para a transição entre exercícios**.
- **Planner:** **calendário/agenda** derivado do programa escolhido, para criar rotina e evitar pular treinos; permite registrar treinos feitos fora do app.
- **Activity:** "one-stop shop" do progresso — progresso contra as **metas semanais**, progressão dentro do programa, **streaks e badges de treino**; no topo, **passos diários, distância, água e calorias ativas com metas ajustáveis**.
- **Community:** fóruns.

**Fontes:**
https://support.sweat.com/hc/en-us/articles/360001610515-How-do-I-navigate-the-Sweat-app (título/URL; corpo bloqueado) · https://support.sweat.com/hc/en-us/articles/115007115148-How-do-I-track-my-progress-with-the-Activity-tab · https://sweat.com/blogs/community/how-to-use-the-sweat-app

---

# SÍNTESE

## A. Padrões que quase todos seguem

1. **Barra inferior com 3 a 5 abas, nunca hamburger.** Freeletics 3, Apple 3, NTC 3(+conta), JEFIT 4, Strong 5, Sweat 5, Gymshark 5. A literatura de UX de apps fitness recomenda explicitamente **3–5 áreas centrais no máximo** e navegação rasa. (https://uxdworld.com/bottom-tab-bar-navigation-design-best-practices/ · https://dataconomy.com/2025/11/11/best-ux-ui-practices-for-fitness-apps-retaining-and-re-engaging-users/)
2. **A primeira aba é "fazer o treino de hoje", não "descobrir".** Hevy abre no feed mas o botão de ação vive na aba Workout; Strong abre em *Start Workout*; Fitbod em *Workout* com o treino já gerado; Freeletics em *Coach* com a sessão do dia. A recomendação corrente de UX é **começar um treino com um único toque**, sem passar por configuração.
3. **Descoberta é separada da execução.** Explore/Discover/Workouts/Plans é sempre uma aba (ou botão dedicado) distinta de onde se treina — ninguém mistura "navegar catálogo" com "estou treinando agora".
4. **Relatório = calendário + gráficos + recordes.** Praticamente todos têm uma visão de calendário dos dias treinados (Strong, JEFIT, Hevy, Sweat/Planner, Freeletics) e um conjunto pequeno de gráficos. Gymshark é o contraexemplo e é **criticado justamente por não ter o calendário**.
5. **O corpo aparece como mapa muscular.** Hevy (*Body Diagram* + distribuição muscular), Fitbod (*heat map* de recuperação), JEFIT (*BodyMap* clicável), Caliber (*Strength Balance*). É o gráfico que os usuários mais entendem sem legenda.
6. **A tela do exercício é um sheet com abas internas.** O padrão canônico é o do Strong: **About · History · Charts · Records**. Hevy, Fitbod e Caliber repetem a mesma estrutura com nomes diferentes (demonstração + instruções, histórico, recordes/1RM, gráficos).
7. **O timer de descanso dispara sozinho ao marcar a série como concluída.** Hevy, Strong, Fitbod, JEFIT. Ninguém pede um toque extra para iniciar o descanso.
8. **O valor anterior fica ao lado do campo atual.** Hevy ("previous performance" na linha), Strong ("previous sets, allowing you to see how you did last time"), Fitbod ("historical logs for comparison"), Caliber ("rich history of your past performances"). **É o recurso mais universal de todos os apps de força** — mais universal que o próprio timer.
9. **Registro nunca é a parte paga.** Hevy, Strong, JEFIT, Caliber e Gymshark deixam o logging ilimitado no grátis; o paywall cai sobre **número de rotinas, janela de histórico e analytics**. Fitbod é a exceção (3 treinos e acabou).
10. **Perfil/Configurações é sempre a última aba** — e, em vários apps, é também onde moram a biblioteca de exercícios e as estatísticas (Hevy) ou até as Settings (Fitbod, dentro do Log).

## B. Apps de força vs. apps guiados por tempo

| Dimensão | Força com registro por série (Hevy, Strong, Fitbod, JEFIT, Caliber) | Guiado por tempo (Leap, NTC, Freeletics, Sweat) |
|---|---|---|
| **Metáfora da tela de execução** | Planilha: linhas de série, campos numéricos, checkmarks | Palco: mídia em tela cheia, contagem regressiva gigante |
| **Quem dita o ritmo** | O usuário (o app só cronometra o descanso) | O app (avança sozinho, com locução/áudio) |
| **Papel da mídia** | Secundário: miniatura/toque para abrir vídeo ou animação | Primário: animação ou vídeo ocupa a tela inteira o tempo todo |
| **Unidade de dado** | Série = carga × reps (+ RPE/RIR, tipo de série) | Exercício = duração ou reps fixas, sem carga |
| **Progressão** | Comparação com a sessão anterior; 1RM; regra de carga | Plano de N semanas por dificuldade; feedback pós-sessão (Freeletics) |
| **Métricas do relatório** | Volume, séries por grupo muscular, 1RM, PRs, distribuição muscular | Nº de treinos, minutos, kcal, streak, peso, IMC |
| **Descoberta** | Biblioteca de rotinas + biblioteca de exercícios (texto/filtro) | Grade de capas em foto, desafios, programas de 4–6 semanas |
| **Engajamento** | PR ao vivo, calendário de consistência, feed social (Hevy/Caliber) | Streak, badges/troféus, meta semanal, desafios |
| **Onde fica o corpo** | Aba própria (Strong "Measure") ou dentro do perfil (Hevy) | Dentro do Relatório, junto com peso e IMC (Leap) |

**O ponto que mais importa para o seu redesign:** o app da Leap que o dono usa como referência visual é do lado **direito** da tabela (guiado por tempo, sem carga), mas o seu app é do lado **esquerdo** (registro por série com carga + motor de progressão). Copiar a *estética* da Leap (capas em foto, faixa da semana, relatório com peso/IMC, figuras animadas) é viável e desejável; copiar a *mecânica* de execução (player que avança sozinho) seria incompatível com registrar carga por série. A síntese correta é: **visual da Leap + tela de execução do Hevy/Strong**.

## C. Tabela comparativa

| App | Abas (barra inferior) | Tela de execução | Mídia do exercício | Métricas do relatório | Engajamento | Grátis? |
|---|---|---|---|---|---|---|
| **Leap Home Workout** | *não encontrado* (relatado: Treino · Descobrir · Relatório · Definição) | Player com contagem regressiva, tela de descanso, ajuste/pular descanso, dicas de forma e variação mais fácil/difícil | **Figura animada** + vídeo; toque abre texto de técnica | Treinos, tendência de peso, **IMC**, meta de treinos/semana | Streak nos planos de 4 semanas, desafios, lembretes, "Awards" | Freemium c/ anúncios (~US$9,99/mês) |
| **Hevy** | Home (feed) · Workout · Profile *(Exercises dentro de Profile; Explore dentro de Workout)* | Linhas de série c/ valor anterior, checkmark → timer, tipos de série, supersets, **PR ao vivo** | **Animação** + instruções passo a passo | Volume, séries/grupo muscular, distribuição muscular + diagrama, 1RM, recordes por reps, calendário | Feed social, follows, curtidas, copiar rotinas, leaderboards, PRs | Sim (4 rotinas, 3 meses de histórico); Pro US$2,99/mês |
| **Strong** | Start Workout · History · Exercises · Measure · Profile *(parc. verificado)* | Séries listadas, séries anteriores visíveis, seletor de métrica de foco, tags de série, **calculadora de anilhas e de aquecimento** | Vídeo ou imagem + instruções | Volume, 1RM projetado, PRs por faixa de reps, peso total, calendário, widgets configuráveis | **Nenhum** (sem social, sem badges) | Sim (3 rotinas); PRO US$4,99/mês |
| **Fitbod** | Workout · Log · Recovery *(+ Your Gym; Settings dentro de Log)* | Treino pré-gerado, cronômetro no topo, miniatura→vídeo, menu ⋮, arrastar p/ reordenar | **Vídeo hi-res multi-ângulo** | Recordes, gráficos, **heat map de recuperação muscular** | Heat map + "treino de hoje pronto" | Não (3 treinos); US$12,99–15,99/mês |
| **JEFIT** | Workout · Discover · Progress *(+ Profile)* | Séries/reps/peso/notas; descanso cronometrado **automaticamente** (obrigatório); **sem retomar sessão** | **Vídeo HD** | Calendário editável, stats e recordes; Analytics só Elite; fotos e medidas | Contests, retrospectiva anual, rotinas da comunidade | Sim c/ anúncios; Elite US$12,99/mês |
| **Caliber** | *não encontrado* (dashboard com "+") | Logging rápido, **vídeo em auto-replay ao lado do registro**, histórico e PRs na própria tela, substitutos sugeridos | Vídeo + descrição por **fases do movimento** | **Strength Score por músculo**, **Strength Balance**, 1RM, stats corporais, fotos | Círculos privados, comunidades públicas, notificação de PR | Sim (generoso); pago = coaching humano |
| **Gymshark Training** | Home · Plans · Custom · Progress · Settings *(parc. verificado)* | Vídeos passo a passo + tracking simples | Vídeo, preview c/ duração e intensidade | PRs de agachamento/supino/terra em gráficos; **sem calendário** (crítica) | Planos de atletas | **Totalmente grátis** (mas descontinuado) |
| **Nike Training Club** | Home · Workouts · Activity *(+ conta)* | **Player com locução**: anuncia exercício, reps, ritmo e esforço; atletas demonstram | Vídeo completo ou demo + áudio | Histórico de aulas, **minutos**, troféus | **Troféus** por volume, frequência e horário dos treinos | **Totalmente grátis** |
| **Freeletics** | Community · Coach · Profile *(Explore dentro de Coach)* | Sessão seccionada warm-up→cooldown, "Adapt session", **feedback pós-treino ajusta o futuro** | Vídeo/demonstração | **Daily Athlete Score** (melhor performance em 90 dias), progresso, leaderboards | **Streak** no calendário do Coach, desafios oficiais e de grupo | Limitado; Coach é pago |
| **Apple Fitness** | Summary · Fitness+ · Sharing | (n/a — Fitness+ é vídeo guiado) | Vídeo | **Anéis** Move/Exercise/Stand + dashboard **editável** de cards, awards | Anéis, awards, competições com amigos | App grátis; Fitness+ pago |
| **Sweat** | Workouts · Food · Planner · Activity · Community | Vídeo + timers + **pistas de áudio na transição** | Vídeo | Metas semanais, progressão no programa, passos/água/kcal com metas ajustáveis | **Streaks e badges** | Não (assinatura) |

---

# 10 RECOMENDAÇÕES PARA O APP PESSOAL DE FORÇA
### (abas: Treino · Explorar · Relatório · Corpo · Mais)

Priorizadas por impacto/esforço. Nada aqui inventa conteúdo: tudo sai de `data/*.json`, e nenhuma recomendação envolve usar imagem, vídeo ou texto de terceiros — os assets são os SVGs animados e o mapa muscular que já existem em `assets/`.

**Nota de conformidade:** o `CLAUDE.md` proíbe gamificação e qualquer feature fora da `SPEC.md` §11. As recomendações 7 e 9 tocam em terreno adjacente (consistência, metas) — estão formuladas deliberadamente como **informação factual sem recompensa**, não como streak/badge. Se mesmo assim divergirem da §11, prevalece a spec e cabe decisão do dono.

### P0 — fazem ou quebram o app

**1. A aba Treino abre no treino de hoje, com um único botão grande "Começar".**
Não abra em lista de programas nem em feed. O card do dia deve trazer, como o Freeletics faz: **nome do treino, duração estimada, equipamentos necessários e foco muscular**, e abaixo a lista dos exercícios (miniatura animada + séries × reps + carga sugerida pelo motor de progressão). Se não houver treino agendado hoje, mostre "Descanso" e o próximo treino, não uma tela vazia. Regra de UX corroborada: começar um treino em **um toque**, sem etapas de configuração.
*Fontes: https://www.freeletics.com/en/blog/posts/getting-started-with-freeletics/ · https://dataconomy.com/2025/11/11/best-ux-ui-practices-for-fitness-apps-retaining-and-re-engaging-users/*

**2. Tela de execução = linhas de série, com o valor da sessão anterior grudado no campo atual.**
Este é o padrão mais universal de todos os apps de força (Hevy, Strong, Fitbod, Caliber). Layout por linha em 360 px: `nº da série | anterior (cinza, 12kg × 8) | campo kg | campo reps | ✓`. O ✓ marca a série **e dispara o timer de descanso na mesma ação** — nunca dois toques. Teclado numérico, alvos ≥44 px, vírgula decimal. Steppers ±2,5 kg / ±1 rep ao lado dos campos para não abrir o teclado nos casos comuns. O ✓ é também o gatilho de gravação no IndexedDB (regra "nunca perder um registro").
*Fontes: https://www.hevyapp.com/hevy-tutorial/ · https://www.thenerdystudent.com/2021/08/strong-review/ · https://help.fitbod.me/hc/en-us/articles/30721437384215-How-to-Navigate-the-Exercise-Details-Screen*

**3. Timer de descanso persistente e não-modal, com o próximo exercício à vista.**
Faixa fixa no rodapé (acima da tab bar) com a contagem regressiva, +15 s / −15 s / pular — copiando a ideia do "boost rest" da Leap e do timer por exercício do Strong. Nunca bloqueie a tela: o usuário precisa poder corrigir a série anterior enquanto descansa. **Erro explícito a evitar:** o JEFIT força o timer em todo treino sem forma simples de desligar, e é a reclamação nº 1 nos reviews.
*Fontes: https://www.jefit.com/support/faq · https://etechshout.com/jefit-app-review/ · https://www.compareworkoutapps.com/reviews/leap-home-workout-review/*

**4. Retomar a sessão interrompida, sempre.**
A falha de UX mais citada do JEFIT é **não haver como retomar se você sai do app por acidente**. Num PWA isso é ainda mais crítico (aba descartada pelo SO, tela bloqueada, chamada recebida). Ao reabrir com sessão aberta no IndexedDB, a aba Treino deve mostrar "Treino em andamento — retomar / descartar" antes de qualquer outra coisa.
*Fonte: https://etechshout.com/jefit-app-review/*

### P1 — estrutura e leitura

**5. Ficha de exercício como bottom-sheet com 4 abas internas: Como fazer · Histórico · Gráfico · Recordes.**
É literalmente o padrão do Strong (*About / History / Charts / Records*), replicado por Hevy, Fitbod e Caliber. "Como fazer" = o SVG animado do `assets/` em loop + instruções do JSON + músculos destacados no mapa muscular. Acessível de três lugares, como no Strong: tocando no nome do exercício durante o treino, no botão de info ao adicionar exercício, e pela biblioteca em Explorar. Durante o treino ele abre **por cima** da sessão, sem perder o estado.
*Fontes: https://help.strongapp.io/article/237-about-exercise-detail · https://www.hevyapp.com/features/exercise-library/*

**6. A aba Relatório precisa de exatamente três blocos: calendário, volume por grupo muscular e recordes.**
- **Calendário/consistência:** dias treinados marcados, tocar no dia abre a sessão (Strong e Hevy fazem assim; a ausência disso é a crítica central ao Gymshark).
- **Séries ou volume por grupo muscular** na semana/mês — a métrica que o Hevy destaca como a que "importa para hipertrofia".
- **Recordes**: melhor carga, melhor volume de série e 1RM estimado por exercício, com a evolução em Recharts.
Resista a empilhar gráfico: a Apple resolve o relatório com **um indicador visual forte + cards**, e deixa o usuário escolher o que aparece.
*Fontes: https://www.hevyapp.com/features/gym-performance/ · https://support.apple.com/guide/iphone/see-your-activity-summary-iph4c34a8a95/ios · https://medium.com/design-bootcamp/ux-case-study-redesigning-gymshark-flow-for-creating-a-workout-plan-and-making-the-overall-99ae3eea2bd6*

**7. Faixa da semana no topo da aba Treino — como informação, não como recompensa.**
Sete pontinhos (seg→dom, semana começando na segunda), preenchidos nos dias treinados, com o dia de hoje destacado. É o elemento do Freeletics ("círculos sólidos nos dias agendados") e da Leap ("meta de treinos por semana exibida na home"), mas **sem contador de streak e sem celebração** — apenas "3 de 4 treinos da semana". Custa pouco, orienta a decisão do dia e não viola a regra de não-gamificação.
*Fontes: https://www.freeletics.com/en/blog/posts/getting-started-with-freeletics/ · https://www.compareworkoutapps.com/reviews/leap-home-workout-review/*

**8. A aba Corpo = mapa muscular + medidas, e o mapa muscular é o herói.**
Todos os quatro apps de força sérios têm um diagrama do corpo (Hevy *Body Diagram*, Fitbod *recovery heat map*, JEFIT *BodyMap*, Caliber *Strength Balance*) — é o gráfico que o usuário entende sem legenda. Use o sprite de `assets/mapa-muscular/` colorido por **volume de séries dos últimos 7 dias** (não por "recuperação", que exigiria um modelo que você não tem). Abaixo dele, peso corporal e medidas com gráfico de linha, no espírito do "Measure" do Strong. Torne o mapa **tocável**: tocar num músculo filtra os exercícios daquele grupo em Explorar (padrão do BodyMap do JEFIT).
*Fontes: https://www.hevyapp.com/features/gym-performance/ · https://www.jefit.com/support/faq · https://fitnessdrum.com/fitbod-review/ · https://caliberstrong.com/workout-app/*

### P2 — polimento e diferenciação

**9. Aba Explorar: capas em foto no topo (programas), lista densa embaixo (exercícios), com filtros por grupo muscular e equipamento.**
É a síntese do visual da Leap/Gymshark com a utilidade do Hevy/Strong. Os filtros que todos os apps oferecem e que seus JSON já permitem: **grupo muscular, equipamento, duração**. Use as fotos e as fichas de equipamento de `assets/` para as capas. A crítica documentada à Leap é **não ter busca nem filtro** na biblioteca — não repita esse erro. Nunca coloque o botão "começar treino" só aqui: descoberta e execução são abas distintas em todos os apps pesquisados.
*Fontes: https://www.compareworkoutapps.com/reviews/leap-home-workout-review/ · https://support.gymshark.com/en/articles/11185911-the-gymshark-training-app · https://www.makeuseof.com/how-use-nike-training-club-app-next-level-fitness/ · https://www.hevyapp.com/features/exercise-library/*

**10. Mostre o recorde no instante em que ele acontece, e a explicação da progressão junto da carga sugerida.**
O "live PR notification" do Hevy e a notificação de PR do Caliber são o único feedback positivo que os apps de força realmente usam — e é factual, não gamificado: um chip discreto na linha da série ("recorde: 12 kg × 8"). Complementarmente, como o seu app tem um **motor de progressão explícito** (coisa que nem Hevy nem Strong têm — o Strong não tem motor algum, e o adaptativo do Hevy é pago), **exponha o porquê**: ao lado da carga sugerida, uma linha como "+2,5 kg — você fechou 3×10 na última". O feedback pós-sessão do Freeletics ("como foi?" ajustando as próximas sessões) é o modelo a seguir para alimentar o motor com RPE/RIR sem burocratizar o registro. Isso é a sua vantagem competitiva real sobre todos os apps da tabela.
*Fontes: https://www.hevyapp.com/hevy-tutorial/ · https://caliberstrong.com/workout-app/ · https://www.sensai.fit/blog/hevy-vs-strong-2026 · https://www.freeletics.com/en/blog/posts/getting-started-with-freeletics/*

---

## Achados que contrariam a intuição (vale destacar)

- **Nenhum app de força sério usa um player que avança sozinho.** O player com contagem regressiva é exclusivo dos apps sem carga. Se o dono pedir "igual à Leap" na tela de execução, há um conflito real entre a referência visual e o modelo de dados do app — vale conversar antes de implementar.
- **O Strong, um dos apps de força mais respeitados, tem zero engajamento**: sem feed, sem badges, sem streak. Isso valida a regra "sem gamificação" do `CLAUDE.md` — é uma escolha de produto legítima e comercialmente comprovada, não uma limitação.
- **O Gymshark Training foi descontinuado** (sem novas correções, versão Android removida). Usá-lo como referência de padrão vivo é arriscado; como referência puramente estética (fotografia forte + layout limpo), continua válido.
- **Em quase todos os apps, o paywall nunca cai sobre registrar treino** — cai sobre rotinas, janela de histórico e analytics. Para um app de um usuário só isso não se aplica, mas explica por que "registro ilimitado e rápido" é considerado o mínimo, não um diferencial.

## Lacunas de pesquisa (o que não consegui confirmar)

1. **Nomes literais das abas do Leap Home Workout** — não documentados publicamente; nenhum review lido descreve a barra inferior.
2. **Lista completa e ordenada das abas do Hevy e do Fitbod** — confirmei os nomes individualmente (Home, Workout, Profile / Workout, Log, Recovery), mas não a barra inteira em uma fonte só.
3. **Abas do Caliber** — nenhuma fonte descreve a navegação inferior.
4. **Abas do Gymshark** — o conjunto Home/Plans/Custom/Progress/Settings veio de resumo de um review no Medium que retornou 403; trate como indicativo.
5. **Freeletics: 3 vs. 5 seções** — blog oficial diz 3 (Community/Coach/Profile); o teardown do AppFuel descreve 5. Provável diferença de versão.
6. Help centers do Hevy, Fitbod e Sweat, e o site hotelgyms, bloquearam acesso automatizado (403) — os dados deles vieram de páginas de produto e resumos de busca.


---

# Parte 2 — Apps e bases de dados open source


**Data da verificação: 15/09/2026.** Estrelas, licenças e datas de último push foram lidas da API do GitHub nesta data; licenças de mídia foram lidas dos arquivos `LICENSE`/`NOTICE`/`README` de cada repositório e, quando possível, das APIs públicas (wger) e do Wikimedia Commons. Onde não consegui confirmar, está escrito **não confirmado**.

Contexto do projeto para calibrar as recomendações (li o repositório): Next.js 15 + React 19 + Tailwind + shadcn/ui + Supabase + Serwist + Dexie + Recharts + Zod + TanStack Query + date-fns; 81 exercícios em `data/exercicios.json`, 67 figuras SVG próprias em `assets/figuras/`, 162 fotos do free-exercise-db em `assets/fotos/` (creditadas em `assets/fotos/CREDITOS.md`), sprite muscular próprio em `assets/mapa-muscular/corpo-sprite.svg`.

---

## 1. Apps de treino open source

### 1.1 O melhor casamento de stack — workout.cool

**[Snouzy/workout-cool](https://github.com/Snouzy/workout-cool)** · **MIT** · TypeScript · **8.472 ★** · 746 forks · último push 31/07/2026 · ativo
(o repo `nomiscientist/workout-cool` que aparece em buscas é um fork; o canônico é `Snouzy`.)

Clonei e inspecionei. Stack real do `package.json`: **Next 16.2.1, React 19.2.1, Recharts ^3.1.0, @tanstack/react-query ^5.74, Zod ^3.24, Radix UI + Tailwind 3 + daisyUI, Prisma/PostgreSQL, better-auth, zustand, dnd-kit, next-international**. É a arquitetura mais próxima da sua que existe em open source com licença permissiva.

**O que vale copiar (MIT permite, basta manter o aviso de copyright):**
- `src/features/statistics/components/OneRepMaxChart.tsx`, `WeightProgressionChart.tsx`, `VolumeChart.tsx` — gráficos Recharts prontos, com estado vazio e "skeleton data". Usa fórmula **Lombardi** para e1RM (`src/shared/constants/statistics.ts`); Epley/Brzycki/Lombardi são matemática, não há trava de licença sobre as fórmulas.
- `src/features/statistics/hooks/use-chart-theme.ts` — tema de cores dos gráficos ligado às variáveis CSS (resolve o claro/escuro do Recharts).
- `src/features/workout-session/ui/workout-session-heatmap.tsx` — heatmap estilo GitHub em **242 linhas de SVG puro, sem dependência nenhuma**. Melhor negócio que instalar `react-calendar-heatmap`.
- Padrão de tela: `workout-session-set.tsx` / `workout-session-sets.tsx` / `workout-session-header.tsx` — registro por série com cabeçalho fixo e progresso.

**O que NÃO vale copiar:**
- A persistência. `workout-session.store.ts` usa zustand + **localStorage** (`workout-session.local.ts`) e `use-sync-workout-sessions.ts` sincroniza por **polling de 5 em 5 minutos**. Seu Dexie + fila com retry é estritamente melhor; não regrida.
- `src/components/ui/timer.tsx` (47 linhas): `setInterval` incrementando um contador. Deriva e morre quando a aba vai para segundo plano. Não serve para descanso entre séries no celular.
- Os inputs de série usam `type="number"` **sem `inputMode`** — pior que o seu no teclado do celular.
- Prisma/Postgres, better-auth, daisyUI, next-international: não migre nada disso.

**Sobre os dados/mídia deles — importante:** o repositório contém apenas `data/sample-exercises.csv` (poucos exercícios, descrições em francês + inglês, coluna `full_video_url` apontando para vídeos externos). O README diz textualmente que *"exercise video licensing costs were prohibitively expensive"* — ou seja, **o código é MIT mas a mídia de exercícios não está no repositório e não é deles para licenciar**. Não há nada de mídia a aproveitar ali.

### 1.2 Motor de progressão e cálculo de carga — Liftosaur

**[astashov/liftosaur](https://github.com/astashov/liftosaur)** · **AGPL-3.0** · TypeScript/Preact PWA · **711 ★** · push 13/09/2026 · muito ativo

Clonei. É a referência técnica mais rica para o que você já construiu:
- `src/models/weight.ts` (726 linhas) — `Weight_calculatePlates`, `Weight_increment`, `Weight_round`, suporte a barra, halteres fixos (`isFixed`), multiplicador e exercícios assistidos. É exatamente o problema do seu `lib/montagem.ts`.
- `src/components/editProgramExercise/progressions/` — `linearProgressSettings.tsx`, **`doubleProgressSettings.tsx`** (minReps/maxReps), `sumRepsProgressSettings.tsx`, `customProgressSettings.tsx`. A UI de progressão dupla mais madura que encontrei.
- `src/liftoscript*.ts` + `src/planner.tsx` — DSL de programa com progressão scriptada, CodeMirror, gramática Lezer. Overkill para um app de um usuário só.
- `src/components/restTimer.tsx`, `setTimerBanner.tsx`, `screenTimers.tsx` — timers de descanso, inclusive com módulo nativo (`src/specs/NativeLiftosaurTimer.ts`).

**O que NÃO vale:** **não copie código**. AGPL-3.0 com cláusula de rede (§13): seu app roda na Vercel e é acessível via HTTP; copiar código AGPL te obriga a oferecer o fonte a quem acessa. Leia para **entender o algoritmo** (algoritmos não são protegidos por copyright) e reescreva. Suas 747 unitárias + os 22 casos de `docs/casos-de-teste-progressao.md` já cobrem o caso.

**Alerta de mídia:** existe `src/imageExtractorGymVisual.ts` no repo, com instruções para extrair imagens de **gymvisual.com**. As figuras do Liftosaur são compradas da Gym Visual. **Nada de mídia aproveitável.**

### 1.3 wger — a maior base aberta com licença por item

**[wger-project/wger](https://github.com/wger-project/wger)** · **AGPL-3.0-or-later** · Python/Django (+ app Flutter e frontend React) · **6.920 ★** · 1.019 forks · push 13/09/2026 · muito ativo

Código AGPL — mesmo problema do Liftosaur, e a stack é Django, então não há o que copiar de código. **O valor está nos dados**, e eles são de primeira qualidade jurídica. Verifiquei a API pública por `curl` (funciona; o site `wger.de` no navegador está atrás do Anubis, mas a API responde):

- `GET https://wger.de/api/v2/exerciseinfo/?format=json` → **865 exercícios**, cada um com campo `license` e `license_author` **por item**.
- `GET https://wger.de/api/v2/exerciseimage/?format=json` → **374 imagens**, também com licença por item.
- `GET https://wger.de/api/v2/video/?format=json` → **78 vídeos**.
- `GET https://wger.de/api/v2/language/` → 33 idiomas, **Português = id 7**.
- Fixture de licenças (`wger/core/fixtures/licenses.json`): CC-BY-SA 3.0, **CC-BY-SA 4.0**, CC0, CC-BY 4.0, ODbL.
- Distribuição real das licenças de imagem (amostra de 400): a maioria é CC-BY-SA 4 sem autor declarado; o segundo maior bloco é **83 imagens de autoria "Everkinetic" sob CC-BY-SA 3**.
- Muscle maps: cada músculo traz `image_url_main` / `image_url_secondary` apontando para SVGs (`https://wger.de/static/images/muscles/main/muscle-11.*.svg`).

**Cobertura em português: fraca.** Amostrei 100 exercícios via `exerciseinfo`: inglês 100/100, alemão 93, espanhol 93, francês 79, italiano 30, **português 10**. Não serve como fonte de texto pt-BR.

**O que vale:** é a única base grande onde você consegue provar a licença de cada imagem antes de baixar. Se um dia quiser mais fotos, filtre por `license` e guarde `license_author`. **O que NÃO vale:** o código (AGPL + Django) e o texto em português.

### 1.4 openGym — o melhor espelho de telas para um PWA de musculação

**[DuarteSantos8/openGym](https://github.com/DuarteSantos8/openGym)** · **AGPL-3.0** · React + Vite PWA + Node · **875 ★** · push 13/09/2026 · muito ativo · demo em https://opengym.duarte-santos.ch

Clonei. Tem séries, supersets, aquecimento, cardio, importação de FitNotes/Strong/Hevy, login por passkey, e uma visão de "músculo treinado / fatigado / destreinado". Telas maduras para copiar como **referência visual** (AGPL: não copie código).

Dois achados de altíssimo valor no `NOTICE.md` deles:

1. **Geometria do mapa muscular sob MIT.** `frontend/src/lib/body-paths.js` é derivado de **[melihcolpan/MuscleMap](https://github.com/melihcolpan/MuscleMap)** (MIT, 259 ★, Swift/SwiftUI, push 20/04/2026), convertido de Swift para JSON. O `NOTICE.md` do openGym declara explicitamente que **essa geometria continua sob MIT**, separada do AGPL do resto. Se um dia quiser trocar seu `corpo-sprite.svg`, é a alternativa livre mais limpa.
2. **A melhor análise de licença de mídia de exercícios que existe escrita.** Vale ler inteiro: https://github.com/DuarteSantos8/openGym/blob/main/NOTICE.md — resumido no §4 abaixo.

Também tem `scripts/exercise-name-sources/pt-BR.json` e `scripts/instruction-sources/pt-BR.json` — traduções **originais** para pt-BR feitas com LLM, declaradas como obra derivada do openGym e portanto **AGPL**. Não reutilizáveis sem contaminar.

### 1.5 Os demais — verificados um a um

| Projeto | Stack | ★ | Licença | Estado | Veredito |
|---|---|---|---|---|---|
| [jovandeginste/workout-tracker](https://github.com/jovandeginste/workout-tracker) | Go + Tailwind | 1.249 | **MIT** (confirmei no `LICENSE`; a API marcava NOASSERTION) | ativo 02/09/2026 | Focado em GPX/corrida. Stack incompatível. Nada. |
| [SamR1/FitTrackee](https://github.com/SamR1/FitTrackee) | Flask + Vue 3 + Leaflet + Chart.js | 1.162 | AGPL-3.0 | ativo 09/09/2026 | Cardio outdoor com GPX. Seu cardio é intervalado no terraço. Nada. |
| [LiamMorrow/LiftLog](https://github.com/LiamMorrow/LiftLog) | React Native + Expo + Redux Toolkit + Material 3 | 571 | AGPL-3.0 | ativo 03/09/2026 | **Web foi removido** ([commit d77d94e](https://github.com/LiamMorrow/LiftLog/commit/d77d94e5eeffd3a9a81af6f61f47e9c57fb91738)). Só telas como inspiração. |
| [itskovacs/wingfit](https://github.com/itskovacs/wingfit) | Angular 19 + FastAPI + SQLite | 523 | **CC BY-NC-SA 4.0** | 11/08/2025 | ⚠️ Não é licença de software nem OSI-approved, e proíbe uso comercial. **Evite tocar no código.** |
| [aree6/LiftShift](https://github.com/aree6/LiftShift) | TypeScript | 514 | AGPL-3.0-only | ativo 14/09/2026 | Visualizador de logs do Hevy/Strong. Só ideias de dashboard. |
| [aceberg/ExerciseDiary](https://github.com/aceberg/ExerciseDiary) | Go | 472 | **MIT** | 15/11/2024 (parado) | Heatmap anual estilo GitHub. Referência de layout; código em Go. |
| [brandonp2412/Flexify](https://github.com/brandonp2412/Flexify) | Flutter | 429 | **MIT** | ativo 15/09/2026 | **Sucessor oficial do Massive.** Offline-first, gráficos, rest timer. Ótima referência de UX de uma mão; Dart. |
| [Cawlumm/lyftr](https://github.com/Cawlumm/lyftr) | React + Go + SQLite | 338 | **MIT** | ativo 30/08/2026 | Self-hosted, mobile-friendly. MIT, mas React puro sem Next. Ideias de tela. |
| [InlitX/GymMane](https://github.com/InlitX/GymMane) | Flutter | 302 | GPL-3.0 | ativo 13/09/2026 | "Toque no músculo, registre as séries". Boa ideia de navegação por mapa muscular. |
| [karimknaebel/Iron](https://github.com/karimknaebel/Iron) | SwiftUI (iOS) | 229 | GPL-3.0 | 17/11/2024 | O "Strong open source" clássico. Referência de telas; iOS. |
| [LibreFitOrg/LibreFit](https://github.com/LibreFitOrg/LibreFit) | Kotlin/Jetpack Compose | 221 | GPL-3.0 | ativo 15/09/2026 | Material Expressive. Referência visual. |
| [WhyAsh5114/MyFit](https://github.com/WhyAsh5114/MyFit) | SvelteKit + shadcn-svelte + tRPC + Prisma | 139 | AGPL-3.0 | ativo 29/08/2026 | Inspirado no RP Hypertrophy: reps + carga + **RIR**, sobrecarga progressiva automática. O mais próximo do seu motor conceitualmente. AGPL + Svelte. |
| [Townzc/liftcut-tracker](https://github.com/Townzc/liftcut-tracker) | **Next.js + Supabase** + TS | 102 | **MIT** | 26/08/2026 | Único Next+Supabase MIT que achei. 0 forks, jovem. Vale só para comparar padrão de auth/RLS com o seu. |
| [TraceApps/lifttrace](https://github.com/TraceApps/lifttrace) | SvelteKit + Capacitor PWA + SQLite | 50 | AGPL-3.0 | ativo 15/09/2026 | Documenta suas fontes de exercício de forma honesta (citada no §4). |
| [EnjoyingFOSS/feeel](https://github.com/EnjoyingFOSS/feeel) | Flutter | 114 | **AGPL-3.0+ (código) / CC BY-SA 4.0 (mídia)** | 26/12/2024; espelho do GitLab | ⭐ **A única fonte de mídia limpa que achei.** Detalhes no §2.4. |
| [brandonp2412/Massive](https://github.com/brandonp2412/Massive) | React Native/TS | 31 | GPL-3.0 | **ARQUIVADO** | README: *"This app is now deprecated. Please install Flexify instead."* Ignore. |
| [oliexdev/openWorkout](https://github.com/oliexdev/openWorkout) | Java/Android | 152 | GPL-3.0 | **ARQUIVADO** | README: *"no longer actively maintained"*. Ignore. |
| [msimms/OpenWorkoutTracker](https://github.com/msimms/OpenWorkoutTracker) | Objective-C/iOS | 86 | não confirmado | ativo 24/08/2026 | Cardio + BLE. Fora de escopo. |
| [MakisChristou/verifit](https://github.com/MakisChristou/verifit) | Java/Android | 79 | — | **ARQUIVADO** | Clone do FitNotes. Ignore. |

**Coisas que você pediu e que eu verifiquei que NÃO existem:**
- **"Gym Routines"** — busquei em `search.f-droid.org`: *"F-Droid does not have any apps matching your search string"*. Não existe no F-Droid.
- **"OpenWorkout"/"OpenWorkOut"** no F-Droid — mesma resposta: não existe. O único `openWorkout` real é o do oliexdev, arquivado.
- **"Gymnastic"**, **"GymLog"**, **"Hercules"** como apps de musculação open source — busquei `hercules OR gymnastic OR gymlog weightlifting tracker` ordenado por estrelas: nada acima de ruído. Não existem como projetos sérios. O que existe com esses nomes é `GymLoga` (com.mbosse.gymloga) no F-Droid, e `fivethreeone_log` (método 5/3/1).
- **FitoTrack** — existe, mas é **[codeberg.org/jannis/FitoTrack](https://f-droid.org/en/packages/de.tadris.fitness/)**, GPL-3.0-or-later, Android/Java, e é **tracker de GPS para corrida/ciclismo/caminhada**. Nada a ver com séries e carga. Descarte.
- **Apps de calistenia open source** — busquei `calisthenics app open source workout`: os três resultados têm 6, 4 e 0 estrelas. **Não existe nada de qualidade.** No F-Droid há "Calisthenics Memory" (io.github.gonbei774.calisthenicsmemory, GPL-3.0-only), minúsculo.

**F-Droid, categoria Workout (30 apps, listagem completa verificada):** os relevantes são Flexify, GymMane, LibreFit, wger, FitoTrack, GymLoga, SimpleHIIT, Calisthenics Memory, TimeR Machine, fivethreeone_log, Gym Bott, Noir Gym, iTrack, C2K. Todos GPL/AGPL e todos Android nativo/Flutter. **Nenhum é PWA web.** Valem como referência de UX de uma mão, não como código.

---

## 2. Bases de dados abertas de exercícios

### 2.1 free-exercise-db (o que você já usa) — Unlicense declarada, mas com uma lacuna

**[yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db)** · **Unlicense** · **1.879 ★** · 490 forks · ativo 30/08/2026

Baixei `dist/exercises.json` e contei: **876 exercícios, 873 com imagens**. Categorias: strength 584, stretching 123, plyometrics 61, powerlifting 38, olympic weightlifting 35, strongman 21, cardio 14. Equipamentos: barbell 170, dumbbell 123, other 122, body only 111, cable 81, machine 67, kettlebells 56, bands 20.

**O ponto de atenção (leia com calma):**
- O arquivo é `LICENSE.md`, texto padrão da Unlicense, e ele diz *"released into the public domain… **this software**"*. Não há `NOTICE`, não há `CONTRIBUTING.md`, e **em lugar nenhum do repositório se afirma que as imagens também estão em domínio público** ou de onde elas vieram.
- O README declara que os dados vieram de **[wrkout/exercises.json](https://github.com/wrkout/exercises.json)**. Fui lá: o README do wrkout também diz "Open Public Domain", **mas não documenta a origem das imagens** e, na seção "Commercial Projects?", encaminha quem quer uso comercial para o produto pago em `wrkout.xyz` ("2.500+ exercícios, 10.000+ imagens, 3.500+ vídeos"). A cadeia de proveniência termina aí.
- Três issues pedindo a origem/licença das imagens — [#2](https://github.com/yuhonas/free-exercise-db/issues/2), [#12](https://github.com/yuhonas/free-exercise-db/issues/12), [#13](https://github.com/yuhonas/free-exercise-db/issues/13) — **estão sem resposta do mantenedor** (verifiquei as três páginas).

**Veredito prático:** para um app pessoal de um usuário só, com `assets/fotos/CREDITOS.md` creditando a fonte, o risco é baixo e você está fazendo a coisa certa. Mas **a Unlicense do repositório não é prova de que as 162 fotos são livres** — é a afirmação de um terceiro sobre imagens cuja origem ele não documenta. Se um dia o app for público, troque as fotos por mídia de proveniência rastreável (§2.3/§2.4) ou fique só com as suas 67 figuras SVG.

### 2.2 everkinetic — CC BY-SA, e o mesmo acervo está no Wikimedia Commons

**[everkinetic/data](https://github.com/everkinetic/data)** · **CC-BY-SA-4.0** · 122 ★ · push 21/01/2026. O README só diz "Open data project based on http://everkinetic.com created by Greg Priday" (site fora do ar). Não tem arquivo `LICENSE`, a licença vem do metadado do GitHub.

**O caminho melhor e verificável:** as ilustrações da Everkinetic estão no **Wikimedia Commons**. Confirmei:
- Busca por "everkinetic" no Commons: **1.089 resultados** (https://commons.wikimedia.org/w/index.php?search=everkinetic&title=Special:MediaSearch&type=image).
- Abri um arquivo exemplo, [File:Leg-press-2-1024x670.png](https://commons.wikimedia.org/wiki/File:Leg-press-2-1024x670.png): autor **"Everkinetic", fonte http://everkinetic.com/**, licença **Creative Commons Attribution-Share Alike 3.0 Unported**, upload 03/11/2010.

E existe uma versão **vetorizada**: **[chaosbastler/opentraining-exercises](https://github.com/chaosbastler/opentraining-exercises)** (28 ★, exercícios do app Open Training). O README declara textualmente:
> *"Currently all images are under a Creative Commons Attribution-ShareAlike 3.0 Unported license. Author/source is http://everkinetic.com/, Everkinetic. … Original images all were .gif or .png — that's bad when you have to change image size. So I tried to convert them to .svg"*

Cada `.xml` de exercício carrega o atributo `imageLicenseText="License: Creative Commons Attribution-Share Alike 3.0 Unported, Author: Everkinetic"`. Licença do repositório em si: **não confirmado** (só o README fala em licença, e só das imagens).

**Implicação do CC BY-SA:** exige **atribuição** e **ShareAlike**. O ShareAlike recai sobre a *imagem e suas obras derivadas*, não sobre o app que a exibe — você pode usar num app proprietário desde que credite e mantenha a imagem (e qualquer versão editada dela) sob CC BY-SA. Como seu `assets/fotos/CREDITOS.md` já existe, o padrão está montado.

### 2.3 Feeel — a fonte de mídia mais limpa que encontrei

**[EnjoyingFOSS/feeel](https://github.com/EnjoyingFOSS/feeel)** (espelho de https://gitlab.com/enjoyingfoss/feeel) · código **AGPL-3.0-or-later com app store exception** · **mídia CC BY-SA 4.0** · 114 ★ · push 26/12/2024.

Clonei e inventariei:
- `assets/exercise_images/` — **53 ilustrações low-poly em .webp** (exercícios em casa / peso do corpo)
- `assets/exercise_thumbs/` — as mesmas 53 em miniatura
- `assets/sounds/` — **`break.mp3`, `exercise.mp3`, `finish.mp3`, `tick.mp3`**
- `assets/json_supplements/local_exercise_images.json` — **atribuição por imagem**, ex.:
  > `"license": "Miroslav Mazel's \"Chair Dips\" is licensed under the [CC BY-SA 4.0 license]..."`
  > `"license": "Licensed under the [CC BY-SA 4.0 license]. Derived from United States Air Force's \"Top leaders unite for senior enlisted summit\", which is in the public domain."`

O `LICENSE` na raiz separa explicitamente:
> *"**# Exercise illustrations and descriptions** — All exercise descriptions and illustrations are released under the **CC BY-SA 4.0** license."*
> Sons: `break/exercise` derivam de freesound **CC0**; `finish` de freesound **CC BY 3.0** (actsofpaint); `tick` de soundbible **CC BY 3.0** (DeepFrozenApps). *"The CC BY-SA license should cover all of them."*

E o `CONTRIBUTING.md` explica a política de proveniência, que é modelo:
> *"You can take **CC0, CC BY, or CC BY-SA** photos and turn them into low-poly versions using the FOSStriangulator app. … Note that license of the source photo is extremely important here! Your contribution won't be accepted if it's based on a photo that isn't CC BY-SA-compatible."*

Feeel também puxa os dados de exercício **do wger**. Ou seja: é a ponta limpa da cadeia wger → Everkinetic/CC.

**O que vale:** os 4 sons de timer (CC0/CC BY — perfeitos para o descanso entre séries e para o cardio intervalado, que hoje você não tem áudio nenhum), e as 53 ilustrações se um dia precisar cobrir exercícios de peso corporal. **O que NÃO vale:** o código Flutter (AGPL) e o fork/nome (a licença proíbe forks usarem o nome "Feeel").

### 2.4 O que NÃO serve — e por quê

**[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)** · 1.324 exercícios com GIF + thumb + instruções em 10 idiomas (inclusive português) · **21.899 ★**. Parece o prêmio, **e não é**. O `LICENSE` tem uma "MEDIA EXCEPTION" explícita:
> *"The MIT license above covers **ONLY** the code, tooling, dataset structure, and instruction text/translations. It **DOES NOT** cover the exercise media in the `images/` and `videos/` directories. That media is **© Gym visual** … included here with the rights holder's written permission … **Cloning this repository does not grant you any license to the media; obtain your own from Gym visual.**"*

E o openGym, que usa esse dataset, rastreou a cadeia inteira e documentou o conflito no [NOTICE.md](https://github.com/DuarteSantos8/openGym/blob/main/NOTICE.md):
> *"That dataset is itself a redistribution: the content originates from **ExerciseDB v1** by **AscendAPI**. … The upstream dataset attributes them to © Gym visual, redistributed there with that rights holder's written permission — **a permission granted to that dataset and not transferable**. ExerciseDB/AscendAPI describes itself as 'the original creator and owner'. **These two claims contradict each other.** … **Until then, treat the media as third-party content licensed to neither openGym nor to you.** … If you want to reuse the media — in openGym or anywhere else, commercially or not — **clear it with the rights holder first**."*

**ExerciseDB / AscendAPI** — [ExerciseDB/exercisedb-api](https://github.com/ExerciseDB/exercisedb-api) tem 644 ★ e badge AGPL-3.0, mas o repositório tem **32 KB e um único README de marketing**: zero dados, zero código. O produto real é API paga em RapidAPI (https://exercisedb.dev, https://ascendapi.com), com tier "Free API" limitado. **Como você previu: não serve.** O mirror [bootstrapping-lab/exercisedb-api](https://github.com/bootstrapping-lab/exercisedb-api) (13 ★, AGPL) é a mesma mídia sob a mesma nuvem jurídica.

**[davejt/exercise](https://github.com/davejt/exercise)** ("An open exercise database API", 161 ★): **sem licença nenhuma** e último push em **10/05/2013**. Abandonado e juridicamente inutilizável (sem licença = todos os direitos reservados).

**exercemus**, **exercise-api**, **open-workout-database**: busquei os três nomes no GitHub. **Não existem** como projetos reais — a busca só devolve ruído (exercícios de SQL de bootcamp). Se você viu esses nomes em algum lugar, foram alucinados.

**Kaggle:** os datasets de exercício mais populares ("Fitness Exercises Dataset" da conta `exercisedb`, "The Ultimate Gym Exercises Dataset", "600K+ Fitness Exercise…") são **republicações da ExerciseDB/Gym Visual com GIFs**. A licença declarada no card do Kaggle (às vezes CC0) **não tem valor sobre mídia que o uploader não possui**. Achei apenas um com licença limpa e ela é inútil para você: *daily exercise dataset* (CC0) — são métricas diárias de fitness, não um catálogo de exercícios. **Veredito: nenhum dataset do Kaggle serve.**

**Bancos de GIFs/vídeos de exercício com licença livre:** você pediu para eu dizer se todos são proprietários. **Praticamente sim.** Os únicos acervos de mídia de exercício com licença verificável e livre que achei são:
1. Wikimedia Commons / Everkinetic — **CC BY-SA 3.0**, ~1.089 arquivos, GIF/PNG (e SVG via opentraining-exercises);
2. wger — **374 imagens e 78 vídeos** com licença declarada por item (CC-BY-SA 3/4, CC0, CC-BY 4);
3. Feeel — **53 ilustrações CC BY-SA 4.0**.
Todo o resto (Gym Visual, ExerciseDB/AscendAPI, wrkout.xyz, os GIFs animados bonitos que todo app usa) é **proprietário e licenciado por contrato**. Não existe um "banco de GIFs de exercício em domínio público". Suas 67 figuras SVG próprias são, de longe, o ativo mais valioso e mais seguro do projeto.

---

## 3. Componentes reaproveitáveis

Confirmei versão, licença e `peerDependencies` direto no registro do npm.

| Componente | Versão | Licença | peer React | ★ | Veredito |
|---|---|---|---|---|---|
| **[grubersjoe/react-activity-calendar](https://github.com/grubersjoe/react-activity-calendar)** | 3.2.1 | **MIT** | **`^18.0.0 \|\| ^19.0.0`** | 593 | ✅ Heatmap de constância. Único com React 19 declarado. Ativo (14/09/2026). |
| [kevinsqi/react-calendar-heatmap](https://github.com/kevinsqi/react-calendar-heatmap) | 1.10.0 | MIT | `>=0.14.0` | 1.297 | ⚠️ Mais estrelas, mas último push **fev/2025** e peer range de 2016. Prefira o de cima ou o SVG do workout-cool. |
| **[vydimitrov/react-countdown-circle-timer](https://github.com/vydimitrov/react-countdown-circle-timer)** | 3.2.1 | **MIT** | `>=16.8.0` | 717 | ✅ Anel de contagem regressiva em SVG. Ativo (27/07/2026). Melhor opção pronta para descanso e para o cardio intervalado. |
| [giavinh79/react-body-highlighter](https://github.com/giavinh79/react-body-highlighter) | 2.0.5 | **MIT** | `>=16` | 51 | Alternativa ao seu sprite. Ativo (13/09/2026). Poucas estrelas; os "forks" `lahaxearnaud`, `Plexapro`, `crmapache` têm 0 ★ e não são mantidos. |
| **[melihcolpan/MuscleMap](https://github.com/melihcolpan/MuscleMap)** | — | **MIT** | Swift | 259 | ✅ Melhor geometria de mapa muscular MIT. Use o `body-paths.js` do openGym, que já é a conversão para JSON (e o `NOTICE.md` deles confirma que continua MIT). |
| [serwist/serwist](https://github.com/serwist/serwist) | — | **MIT** | — | 1.478 | ✅ Já é sua escolha. Confirmado ativo e MIT. |
| [dexie/Dexie.js](https://github.com/dexie/Dexie.js) | — | **Apache-2.0** | — | 14.577 | ✅ Já é sua escolha. Apache-2.0 (não MIT — inclui cláusula de patentes; sem impacto para você). |
| Recharts | ^3.1.0 | MIT | — | — | ✅ Mesma versão do workout-cool → os gráficos deles colam direto. |

**Player de intervalos/circuito em React:** busquei `workout timer pwa interval` ordenado por estrelas. **Os 20 primeiros resultados têm 0 estrelas** — é tudo vibe-coding recente e descartável. Busquei também `react interval timer hiit component`: zero resultados acima de 50 estrelas. **Conclusão factual: não existe um componente React open source sério de timer de intervalos/circuito.** As opções reais são: (a) `react-countdown-circle-timer` (MIT) como base visual + sua própria máquina de estados; (b) reescrever a lógica olhando o `restTimer.tsx`/`setTimerBanner.tsx` do Liftosaur (AGPL — só leia). Em qualquer caso, **não use `setInterval` incremental** (o erro do workout-cool): ancore em `Date.now()` / `performance.now()`, some os sons do Feeel (CC0/CC BY) e trate `visibilitychange`, senão o timer morre quando a tela do celular apaga.

**Gráficos de força (e1RM):** não há biblioteca dedicada. O que existe é `OneRepMaxChart.tsx` do workout-cool (MIT, Recharts 3) — pegue como está. Fórmula deles é Lombardi (`1RM = peso × reps^0.10`); o tooltip do componente mostra Epley (`peso × (1 + reps/30)`). Fórmulas são domínio público.

---

## 4. Tabela-resumo

| # | Nome | URL | Licença | Stack | Estado (★) | Copiar | Não copiar |
|---|---|---|---|---|---|---|---|
| 1 | **workout-cool** | github.com/Snouzy/workout-cool | **MIT** | Next 16 / React 19 / Recharts 3 / Radix | ativo, 8.472 | Gráficos e1RM/volume/peso, heatmap SVG sem deps, hook de tema de gráfico, tela de série | localStorage + polling 5 min, timer com setInterval, Prisma, daisyUI, `type=number` sem inputMode |
| 2 | **Liftosaur** | github.com/astashov/liftosaur | AGPL-3.0 | TS/Preact PWA | ativo, 711 | **Só o algoritmo**: `Weight_calculatePlates`, progressão dupla min/maxReps, deload | Qualquer linha de código (AGPL §13 pega Vercel); imagens (Gym Visual) |
| 3 | **wger** | github.com/wger-project/wger | AGPL-3.0 | Django + Flutter | ativo, 6.920 | **Dados**: API pública, 865 exercícios / 374 imgs / 78 vídeos com licença **por item** | Código; texto em pt (só ~10% de cobertura) |
| 4 | **openGym** | github.com/DuarteSantos8/openGym | AGPL-3.0 | React+Vite PWA | ativo, 875 | Padrões de tela; `body-paths.js` (**MIT**); o `NOTICE.md` como modelo de due diligence | Código; mídia; traduções pt-BR (AGPL) |
| 5 | **Feeel** | github.com/EnjoyingFOSS/feeel | AGPL / **mídia CC BY-SA 4.0** | Flutter | 114, mantido no GitLab | **4 sons de timer (CC0/CC BY)**; 53 ilustrações CC BY-SA 4.0 com atribuição por arquivo | Código; o nome |
| 6 | free-exercise-db | github.com/yuhonas/free-exercise-db | Unlicense (⚠️ só "software") | JSON + Vue | ativo, 1.879 | 876 exercícios, metadados | Assumir que as 873 fotos são comprovadamente PD |
| 7 | everkinetic / Commons | github.com/everkinetic/data · commons.wikimedia.org | **CC BY-SA 3.0/4.0** | dados | 122 | ~1.089 imagens com autoria e licença verificáveis arquivo a arquivo | — |
| 8 | opentraining-exercises | github.com/chaosbastler/opentraining-exercises | imagens **CC BY-SA 3.0** | XML + SVG | 28 | **Versões SVG** das ilustrações Everkinetic | Licença do repo: não confirmado |
| 9 | MuscleMap | github.com/melihcolpan/MuscleMap | **MIT** | Swift | ativo, 259 | Geometria do mapa muscular | Código Swift |
| 10 | react-activity-calendar | github.com/grubersjoe/react-activity-calendar | **MIT** | React TS | ativo, 593 | Heatmap (React 19 ✓) | — |
| 11 | react-countdown-circle-timer | github.com/vydimitrov/react-countdown-circle-timer | **MIT** | React TS | ativo, 717 | Anel do timer | A máquina de estados (escreva a sua) |
| 12 | Flexify | github.com/brandonp2412/Flexify | **MIT** | Flutter | ativo, 429 | UX offline-first de uma mão | Dart |
| 13 | MyFit | github.com/WhyAsh5114/MyFit | AGPL-3.0 | SvelteKit | ativo, 139 | Conceito: reps+carga+RIR com sobrecarga automática | Código; Svelte |
| 14 | liftcut-tracker | github.com/Townzc/liftcut-tracker | **MIT** | Next.js + Supabase | 102, 0 forks | Comparar padrão de auth/RLS | Resto (jovem, sem tração) |
| 15 | hasaneyldrm/exercises-dataset | github.com/hasaneyldrm/exercises-dataset | MIT **+ mídia © Gym Visual** | JSON | 21.899 | Nada com segurança | ❌ **Toda a mídia** |
| 16 | ExerciseDB / AscendAPI | exercisedb.dev · ascendapi.com | API comercial | — | 644 (só README) | Nada | ❌ Não serve |
| 17 | wingfit | github.com/itskovacs/wingfit | **CC BY-NC-SA 4.0** | Angular 19 + FastAPI | 523 | Nada | ❌ Não-comercial, não é licença de software |
| 18 | davejt/exercise | github.com/davejt/exercise | **nenhuma** | — | 161, morto (2013) | Nada | ❌ Sem licença |
| 19 | Massive / openWorkout | (arquivados) | GPL-3.0 | RN / Java | ❌ arquivados | Nada | ❌ |
| 20 | FitoTrack / FitTrackee / workout-tracker | — | GPL/AGPL/MIT | Android / Flask+Vue / Go | ativos | Nada | ❌ Cardio por GPS, escopo errado |

---

## 5. Recomendação

### (a) Inspiração de telas — 3 melhores
1. **[workout-cool](https://github.com/Snouzy/workout-cool)** (MIT) — é literalmente a sua stack. Olhe `src/features/workout-session/ui/` para o fluxo de sessão e `src/features/statistics/` para a aba de progresso. Demo em https://workout.cool.
2. **[openGym](https://github.com/DuarteSantos8/openGym)** (AGPL — olhe, não copie) — demo em https://opengym.duarte-santos.ch. O PWA de musculação mais bem resolvido; veja a navegação por mapa muscular e a visão de músculo fatigado/destreinado.
3. **[Flexify](https://github.com/brandonp2412/Flexify)** (MIT, Flutter) — a melhor UX offline-first de uma mão. Sucessor do Massive, no F-Droid, fácil de instalar no celular e testar.
Bônus: **[Liftosaur](https://www.liftosaur.com)** para a tela de programa com progressão scriptada, e **[MyFit](https://myfit.fit)** para a apresentação de RIR/sobrecarga.

### (b) Componentes — 4 melhores
1. **`OneRepMaxChart` / `VolumeChart` / `WeightProgressionChart` + `use-chart-theme.ts` do workout-cool** (MIT, Recharts 3.1 = sua versão). Adaptação quase zero: trocar `useI18n` por texto pt-BR e `dayjs` por `date-fns`.
2. **`workout-session-heatmap.tsx` do workout-cool** (MIT, 242 linhas, zero dependências) — ou **`react-activity-calendar`** (MIT, React 19 ✓) se preferir pacote. Evite `react-calendar-heatmap` (parado desde fev/2025).
3. **`react-countdown-circle-timer`** (MIT) como visual do descanso/cardio + **máquina de estados sua** ancorada em `Date.now()` com `visibilitychange`. Sonorize com os **4 mp3 do Feeel** (CC0/CC BY, créditos no `LICENSE` deles).
4. **`body-paths.js` do openGym** (geometria MIT do MuscleMap) — só se algum dia quiser aposentar o `corpo-sprite.svg`. Hoje o seu sprite com `var(--m-<musculo>)` é mais leve e já integrado; **não troque sem motivo**.

### (c) Dados / mídia de exercícios — 3 melhores, nesta ordem
1. **Suas 67 figuras SVG próprias.** Proveniência 100% limpa, leves, tematizáveis. É o ativo mais forte do projeto. Cobrir os 14 exercícios que faltam com figuras suas é mais barato juridicamente do que qualquer importação.
2. **wger via API pública** (`https://wger.de/api/v2/exerciseinfo/`) — a única base grande onde você **filtra por `license` antes de baixar** e já recebe `license_author` para o crédito. Use se precisar expandir além dos 81.
3. **Everkinetic no Wikimedia Commons** (CC BY-SA 3.0, ~1.089 arquivos) e sua **versão SVG** em [opentraining-exercises](https://github.com/chaosbastler/opentraining-exercises) — ilustrações vetoriais com autoria rastreável, no estilo das suas. **Feeel** (CC BY-SA 4.0, 53 arquivos) para peso do corpo.

---

## 6. ⚠️ Alerta sobre licenças de imagens e vídeos

Este é o achado mais importante da pesquisa, e ele é contraintuitivo:

**Quase todo dataset "aberto" de exercícios é aberto nos metadados e fechado na mídia.** Os repositórios com mais estrelas do GitHub nessa categoria (21.899 ★ o `exercises-dataset`, 644 ★ o `exercisedb-api`) distribuem GIFs que **não pertencem a quem os publica**, e a licença MIT no `LICENSE` cobre só o JSON. As duas linhas que importam, do próprio arquivo de licença do dataset de 21.899 estrelas:

> *"It **DOES NOT** cover the exercise media… That media is **© Gym visual**… **Cloning this repository does not grant you any license to the media; obtain your own from Gym visual.**"*

**Regras práticas para o seu app:**

1. **Estrela não é licença.** Verifique sempre um `LICENSE`/`NOTICE` que fale de mídia **em separado** do código. Se o arquivo só diz "software", ele **não** licenciou as imagens. É exatamente o caso do free-exercise-db — cujo `LICENSE.md` diz "released into the public domain… this **software**" e cujas três issues perguntando a origem das fotos estão sem resposta.
2. **Baixe só mídia com autor e licença nomeados por arquivo.** Wikimedia Commons, wger (campo `license` + `license_author` por item) e Feeel (`local_exercise_images.json`) fazem isso. Gym Visual/ExerciseDB/Kaggle não.
3. **Permissão dada a terceiro não é transferível.** A Gym Visual autorizou *aquele dataset*; isso não te autoriza. O `NOTICE.md` do openGym é o melhor texto público sobre isso e vale como leitura: https://github.com/DuarteSantos8/openGym/blob/main/NOTICE.md
4. **CC BY-SA é usável, mas exige disciplina.** Pode usar num app pessoal e até comercial, desde que: credite o autor visivelmente (ou numa tela "Créditos"), aponte a licença, e mantenha a imagem — **e qualquer edição sua dela** — sob CC BY-SA. O ShareAlike **não** contamina o seu código; só a imagem.
5. **AGPL (wger, Liftosaur, openGym, LiftShift, MyFit, LiftLog, FitTrackee, lifttrace) contamina código, não telas.** Copiar componentes de um desses para um app que você publica na Vercel te obriga, pela §13, a oferecer o fonte a quem acessa. **Leia o algoritmo, escreva o seu.** Layouts, fluxos e ideias não são protegidos.
6. **CC BY-NC-SA (wingfit) é o pior dos mundos:** não-comercial, não é licença de software, não é OSI-approved. Não toque.
7. **O que você já tem está certo.** As 67 figuras próprias + o sprite muscular próprio + o `CREDITOS.md` para as fotos são a postura correta. **Se o dono não quer imagem de terceiro sem licença, a recomendação mais forte deste relatório é: complete o acervo com figuras SVG próprias e, se precisar de mais, puxe do wger filtrando por `license`, nunca de "datasets com GIF bonito" do GitHub ou do Kaggle.**

---

### Notas de método
- Metadados de repositório (★, forks, licença SPDX, `pushed_at`, `archived`) vieram da API de busca do GitHub via MCP, em 15/09/2026.
- Licenças ambíguas (`NOASSERTION`) foram resolvidas lendo o arquivo `LICENSE` bruto: `jovandeginste/workout-tracker` = MIT, `aree6/LiftShift` = AGPL-3.0-only, `itskovacs/wingfit` = CC BY-NC-SA 4.0 (declarada só no README; não há arquivo `LICENSE` no branch `main`), `EnjoyingFOSS/feeel` = AGPL-3.0+ com exceção de app store para código e CC BY-SA 4.0 para mídia.
- `workout-cool`, `liftosaur`, `openGym` e `feeel` foram clonados (`--depth 1`) e inspecionados arquivo a arquivo; os clones foram apagados do scratchpad ao final.
- A API do wger foi consultada por `curl` (o site no navegador está atrás do Anubis, a API não).
- Não confirmado: cobertura exata de traduções pt no wger (o filtro `?language=` no endpoint `exercise-translation` não é aplicado pelo servidor — os 10/100 vêm de amostragem em `exerciseinfo`); licença do repositório `chaosbastler/opentraining-exercises` em si; licença de `msimms/OpenWorkoutTracker`.
- Nenhum arquivo do projeto foi modificado.


---

# Parte 3 — Padrões de tela e boas práticas


Pesquisa com fontes primárias (Apple HIG, Material Design 3, W3C/WCAG, MDN, web.dev) e secundárias (NN/g, Smashing, Baymard, teardowns de apps de treino). Opiniões estão marcadas com **[opinião]**. Ao final: checklist de 20 itens auditáveis a 360 px, wireframes ASCII das 5 abas e uma auditoria de contraste dos tokens que já existem no repositório.

---

## 0. Números-âncora (valem para todas as telas)

| Medida | Valor | Fonte |
|---|---|---|
| Alvo de toque mínimo (iOS) | **44 × 44 pt** | [Apple HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) |
| Alvo de toque mínimo (Android) | **48 × 48 dp** (~9 mm físicos) | [Material — Accessibility](https://m2.material.io/design/usability/accessibility.html), [Android Accessibility Help](https://support.google.com/accessibility/android/answer/7101858?hl=en) |
| Espaço entre alvos | **≥ 8 dp** | [Material — Accessibility](https://m2.material.io/design/usability/accessibility.html) |
| Alvo mínimo legal (WCAG 2.2 AA, SC 2.5.8) | **24 × 24 CSS px** ou espaçamento equivalente | [W3C SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [wcag22aa.org](https://wcag22aa.org/new-criteria/target-size/) |
| Contraste de texto normal | **4,5:1** | [W3C SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) |
| Contraste de texto grande (≥ 18,5 px normal ou ≥ 24 px / 14 pt negrito) | **3:1** | idem |
| Contraste de elementos não-texto (bordas de controles, ícones informativos, séries de gráfico) | **3:1** | [W3C SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) |
| Nav inferior Material 3 | **80 dp** de altura, **3–5 destinos**, ícone 24 dp, indicador pílula 64 × 32 dp | [M3 Navigation bar](https://m3.material.io/components/navigation-bar/specs) |
| Uso com uma mão | **49 %** dos usuários seguram com uma mão; polegares dirigem **75 %** das interações; só o terço inferior da tela é "território sem esforço" | [Smashing — The Thumb Zone](https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/), [A List Apart — How We Hold Our Gadgets](https://alistapart.com/article/how-we-hold-our-gadgets/) |
| Leitura de relance | maior é melhor; **caixa alta é lida 26 % mais rápido** que caixa baixa e **fonte condensada custa +11,2 %** de tempo | [NN/g — Typography for Glanceable Reading](https://www.nngroup.com/articles/glanceable-fonts/) |

**Orçamento de largura a 360 px:** 360 − 2 × 16 px de margem = **328 px úteis**. Dois cards lado a lado com gap 12 px = **158 px** cada. Cinco abas na nav = **72 px** por aba (acima dos 48 dp exigidos).

---

## 1. Home "Treino do dia"

### Card de capa (foto + gradiente)

**Fazer**
- Proporção **16:9** (328 × 185 px) ou 4:3 (328 × 246 px); raio 16–20 px. O texto fica **sobre o terço inferior**, nunca centralizado sobre o meio da foto.
- **Scrim de verdade, não um overlay chapado.** Gradiente multi-stop de baixo para cima com easing: `rgba(0,0,0,.88) 0% → .55 30% → .12 60% → 0 78%`. Um gradiente de 40 % preto → transparente é o mínimo aceitável; a versão com 4 paradas acompanha melhor o comportamento da luz e não "suja" a foto.
- **Medir o contraste no pior pixel da foto**, não no gradiente teórico. O texto sobre a capa precisa dos mesmos 4,5:1 (ou 3:1 se ≥ 24 px).
- Hierarquia dentro da capa: **título do treino 24–28 px semibold** (ex.: "Treino A · Corpo inteiro"), e abaixo uma linha única de metadados em 14–15 px com separador `·`: `52 min · 7 exercícios · Fase 1 · Semana 1`.
- O botão **"Começar"** fica **fora da foto**, encostado embaixo dela: largura total 328 px, **altura 56 px**, raio 14–16 px, rótulo 17–18 px semibold. Motivo: fica na zona do polegar e não depende do contraste da imagem.

**Evitar**
- Texto sobre foto sem scrim ou com `text-shadow` como única defesa.
- Carrossel auto-rotativo de treinos na home: em mobile a usabilidade cai e as pessoas tratam o bloco como anúncio ("banner blindness").
- Botão primário no topo da tela (fora do alcance do polegar).

**Fontes:** [NN/g — Ensure High Contrast for Text Over Images](https://www.nngroup.com/articles/text-over-images/) · [Smashing — Designing Accessible Text Over Images](https://www.smashingmagazine.com/2023/08/designing-accessible-text-over-images-part1/) · [Baymard — Mobile Search & Category Navigation](https://baymard.com/blog/mobile-ecommerce-search-and-navigation)

### Faixa da semana (seg–dom)

**Fazer**
- 7 células de **40 × 56 px** (largura 40 = 7 × 40 + 6 × 8 de gap = 328 px exatos). Cada célula é um **alvo de toque real** (abre o dia no calendário) — 40 px de largura com 8 px de gap satisfaz a regra de espaçamento do SC 2.5.8; para conforto, estenda o alvo verticalmente até 48 px.
- **Nunca codificar estado só por cor.** Cada célula carrega três camadas: a letra do dia (S T Q Q S S D), um glifo de estado (✓ feito, ● planejado, — descanso, ⟳ em aberto) e a cor. Isso é o mesmo problema dos heatmaps de contribuição: "dia sem dado" e "dia com zero" não podem ter a mesma aparência.
- Marcar o **dia de hoje com um anel** (borda 2 px na cor de destaque), independente de estar feito ou não.
- Rótulo acessível por célula: `aria-label="quarta, 17/09 — Treino A concluído"`.

**Evitar**
- Bolinhas de 20 px sem área de toque expandida.
- Semana começando no domingo (a spec define segunda).

**Fontes:** [21st — Heatmaps and Contribution Graphs](https://21st.dev/blog/react-heatmap-calendar-components) · [Designing accessible charts (heat maps)](https://fionabaudner.medium.com/designing-accessible-charts-39ab0ff546b6)

### Meta semanal e streak — sem gamificação barata

Este é o ponto onde a maioria dos apps de treino erra. A pesquisa é clara nos dois sentidos:

- Streaks funcionam no começo por **aversão à perda** — a dor de quebrar é psicologicamente maior que o prazer de estender.
- Mas o mesmo mecanismo produz **ansiedade, culpa e o "what-the-hell effect"**: um dia perdido dispara "já estraguei, então tanto faz" e a pessoa abandona o hábito inteiro em vez de só retomar. Há relatos de gente treinando doente só para proteger o número.
- A alternativa com base teórica é a **teoria da autodeterminação** (autonomia, competência, relacionamento): o reforço deve vir de **evidência de competência** — "a barra subiu" —, não de um placar.

**Fazer**
- Trocar o herói "streak" por **meta semanal com folga**: `Semana: ██░ 2 de 3 treinos` — uma barra de 3 segmentos, 328 × 8 px, com o texto ao lado. Mostra progresso e **é reparável dentro da própria semana**.
- Manter o streak como **dado secundário, em texto pequeno (13 px, cor muted)**: "sequência de 5 semanas cumprindo a meta". Contar **semanas cumpridas**, não dias consecutivos — semana é a unidade natural do programa e absorve chuva, viagem e dor muscular sem quebrar.
- Prever um **"vale" explícito** (jokers / semana curta): a spec já tem `semana_curta` em `programa.json`. Use-a para que a meta se ajuste em vez de falhar.
- Quando a meta fecha: uma linha de texto sóbria e o gráfico subindo. **Nada de confete** (já é regra da SPEC §7).
- Frame de recuperação em vez de punição: se a sequência quebrou, a tela diz "retomando — 1 de 3 esta semana", não "você perdeu 34 dias".

**Evitar**
- Contador de dias consecutivos gigante no topo.
- Badges, níveis, pontos, ligas.
- Notificação de "sua sequência está em risco".

**Fontes:** [NN/g — Autonomy, Relatedness, and Competence in UX Design](https://www.nngroup.com/articles/autonomy-relatedness-competence/) · [The Decision Lab — Streak Creep: When Gamified Engagement Mechanics Backfire](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification) · [Yu-kai Chou — Streak Design: Motivation Without Burnout](https://yukaichou.com/gamification-analysis/streak-design-gamification-motivation-burnout/)

### Hierarquia da home (ordem vertical recomendada) **[opinião fundamentada]**

1. Banner de sessão em aberto (só quando existir) — 56 px, cor de destaque, dois botões (Continuar / Descartar).
2. Card de capa do treino do dia.
3. Botão "Começar" (56 px).
4. Faixa da semana + meta semanal.
5. Prévia dos exercícios de hoje (lista compacta, 3 primeiros + "ver todos os 7").
6. Faixa de status (fase, semana, peso mais recente) em texto pequeno.

Justificativa: 90 % das aberturas do app têm uma única intenção ("começar agora"), então o caminho para o botão tem que ser rolagem zero a 360 × 640 px.

---

## 2. Lista de exercícios do treino

### Anatomia da linha

Altura de **72 px** (acomoda miniatura 56 px + 8 px de respiro), separador de 1 px ou espaçamento de 8 px entre linhas.

```
[ miniatura 56×56 ]  Nome do exercício            [ ⋮ ]
                     3 × 8–10 · 20 kg · 90 s      44×44
```

- **Miniatura 56 × 56 px**, raio 12 px, fundo `--secondary` (a figura SVG do projeto é um boneco em linha — precisa de fundo próprio para não sumir no escuro). Use `loading="lazy"` e `decoding="async"`. Mídia em movimento na lista: **não** — anime só na ficha; na lista, o frame inicial. Respeite `prefers-reduced-motion: reduce` desligando o SMIL.
- **Nome**: 16 px medium, 1 linha com `text-overflow: ellipsis`.
- **Prescrição**: 14 px, cor muted, formato `3 × 8–10 · 20 kg · 90 s`. Use vírgula decimal (`7,5 kg`) e `font-variant-numeric: tabular-nums`.
- A linha inteira é o alvo para abrir a **ficha**; o `⋮` (44 × 44) abre o menu com **Trocar exercício** e **Ver ficha**. Dois alvos na mesma linha exigem 8 px de separação.

### Ações por item

- **Trocar exercício:** abrir um **bottom sheet** com alternativas filtradas pelo mesmo grupo muscular + equipamento disponível (dados de `exercicios.json` + `equipamentos.json`), não uma navegação para outra tela. O sheet deve dizer por que cada opção é equivalente ("mesmo primário: peitoral; usa halteres").
- **Não** use swipe como única forma de acionar troca/remoção: gesto sem affordance visível é invisível e não tem equivalente de teclado. Swipe pode existir como atalho, mas o `⋮` é o caminho canônico.

### Reordenar

- Modo de reordenação **explícito** ("Reordenar" no menu do topo), que transforma as linhas em handles `⣿` de **48 × 48 px** na borda direita (lado do polegar). Drag-and-drop em lista rolável no celular é frágil: exige auto-scroll nas bordas e feedback tátil.
- Ofereça **alternativa sem gesto**: setas ↑ ↓ de 44 px em cada linha durante o modo de reordenação (é também o que satisfaz SC 2.5.7 *Dragging Movements*, AA na WCAG 2.2).
- Reordenar não deve mudar o programa; salvar como "ordem desta sessão", com "voltar à ordem do programa".

**Fontes:** [W3C SC 2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) · [Material — Accessibility (alvos e espaçamento)](https://m2.material.io/design/usability/accessibility.html) · [Hevy — Set Row UI e rest timer por exercício](https://www.hevyapp.com/features/workout-rest-timer/)

---

## 3. Tela de execução

### 3a. Player guiado por tempo (cardio, corda, aquecimento)

**Estrutura vertical (de cima para baixo):**

```
barra de progresso do bloco (4 px, cor por tipo)
tipo do bloco            CORRIDA          ← 14 px, caixa alta, letter-spacing .06em
contagem regressiva      01:47            ← 72–96 px, tabular-nums, peso 600
progresso da sessão      bloco 3 de 12 · 12:30 restantes
                    [ próximo: CAMINHADA 2:00 ]
        ( ⏮ )        (  ⏸  PAUSAR  )        ( ⏭ )
          64px            72px                64px
```

- **Contagem regressiva 72–96 px** com `font-variant-numeric: tabular-nums` (evita o número "pular" a cada segundo). Peso 500–600, **nunca fonte fina** — a pesquisa de leitura de relance é explícita contra thin em ambiente de distração.
- **Rótulo do bloco em CAIXA ALTA** (26 % mais rápido de reconhecer) e **não condensada** (+11,2 % de tempo se condensada). Aplica-se a palavras isoladas, que é exatamente o caso.
- **Próximo exercício sempre visível**, com nome e duração — elimina a pergunta "o que vem agora?" no meio do esforço.
- **Lead-in de 5 s** ("PREPARAR 3… 2… 1…") antes de cada bloco de trabalho, com cor distinta.
- Controles: pausar é o alvo primário (**72 px**, centro, dentro do alcance do polegar); anterior/pular são 64 px nas laterais. Pular exige confirmação? **Não** — mas registre como "bloco pulado" no resumo.
- **Voz (`speechSynthesis`, pt-BR):** anuncie nome do bloco na virada e contagem 3-2-1. Regra de áudio: a fala deve **abaixar (duck) a música**, e os bipes podem tocar por cima, como faz navegação GPS.

**Armadilhas reais do iOS que precisam entrar no código:**

- `speechSynthesis.speak()` no iOS **só funciona dentro de uma cadeia síncrona originada em um gesto do usuário**. Um `setTimeout` no meio da cadeia quebra isso, e o enunciado é descartado em silêncio. Solução: no toque em "Começar", dispare um `speak()` de "aquecimento" (ou um utterance vazio/silencioso) para **desbloquear** o canal; a partir daí o agendamento por timer costuma funcionar na mesma sessão da página.
- A síntese **para quando o Safari vai para segundo plano**; `getVoices()` pode retornar vazio no Safari, então não dependa de escolher voz — configure só `lang = "pt-BR"` e tenha fallback silencioso + bipe.
- **`navigator.vibrate` não existe no Safari iOS** (Can I Use lista "não suportado" em todas as versões até a 27.1) e o Firefox removeu a partir da 129. Trate vibração como **progressive enhancement**: `if ("vibrate" in navigator)`, com **bipe curto via WebAudio** como fallback universal, e nunca como único sinal de fim de descanso.

**Manter a tela acesa:**

```js
let wakeLock = null;
try { wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { /* bateria baixa, modo economia */ }
document.addEventListener("visibilitychange", async () => {
  if (wakeLock !== null && document.visibilityState === "visible")
    wakeLock = await navigator.wakeLock.request("screen");
});
```
Exige **contexto seguro (HTTPS)** e documento ativo; o lock é liberado sozinho ao trocar de aba e um sentinel liberado **não pode ser reusado** — tem que pedir outro. Libere ao finalizar a sessão, e mostre um indicador discreto de "tela travada" com botão para desligar (autonomia).

**Fontes:** [MDN — Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) · [Chrome for Developers — Stay awake with the Screen Wake Lock API](https://developer.chrome.com/docs/capabilities/web-apis/wake-lock) · [Can I Use — navigator.vibrate](https://caniuse.com/mdn-api_navigator_vibrate) · [iOS Safari audio sessions — o requisito de gesto síncrono](https://samueleddy.com/writing/ios-safari-audio-sessions/) · [The State of Speech Synthesis in Safari](https://weboutloud.io/bulletin/speech_synthesis_in_safari/) · [NN/g — Glanceable Fonts](https://www.nngroup.com/articles/glanceable-fonts/)

### 3b. Registro por série (o coração do app)

**Timer de descanso fixo no topo** — padrão consolidado (é o que Hevy e Strong fazem): barra sticky de **48–56 px** logo abaixo do header, com `position: sticky; top: env(safe-area-inset-top, 0px)`.

```
┌────────────────────────────────────────┐
│ ⏱ 01:22   ███████████░░░░░   +30s  ✕  │  ← 52 px, cor de destaque
└────────────────────────────────────────┘
```
- Dispara **automaticamente ao marcar a série como concluída**, com a duração vinda de `prescricao_padrao.descanso_s` do próprio exercício (Hevy faz exatamente isso: o timer fica junto do movimento e o valor é por exercício).
- Botões `+30 s` e `✕` (pular) com **44 px** cada.
- **Descansos diferentes para aquecimento e série válida** — a ausência disso é a reclamação mais citada contra o Hevy. Se o app tiver série de aquecimento, dê a ela um descanso próprio.
- Ao zerar: bipe + `vibrate([200])` quando existir + a barra pisca uma vez. Se o app estiver em segundo plano, o áudio não vai tocar no iOS — por isso o aviso visual persistente ("descanso terminou há 0:14") ao voltar.

**Linha de série — grade a 360 px** (soma exata: 28+62+92+76+48 + 4 gaps de 4 px = **322 px**, cabe nos 328 úteis):

```
 #    anterior    carga        reps      ✓
 28     62          92          76       48
┌──┬──────┬───────────┬─────────┬──────┐
│1 │20×10 │  20,0 kg  │   10    │  ✓   │   ← altura 56 px
├──┼──────┼───────────┼─────────┼──────┤
│2 │20×10 │  20,0 kg  │   10    │  ○   │
├──┼──────┼───────────┼─────────┼──────┤
│3 │  —   │  20,0 kg  │  8–10   │  ○   │   ← alvo em itálico/muted
└──┴──────┴───────────┴─────────┴──────┘
```

- **Altura da linha 56 px.** A coluna `✓` é um alvo de **48 × 48** encostado na borda direita — lado do polegar para destro (67 % do uso de uma mão é com o polegar direito).
- **Coluna "anterior"** (o que foi feito na última sessão deste exercício) é o dado que mais reduz decisão no meio do treino. 12–13 px, muted.
- **Estados da linha:** pendente (fundo transparente), **ativa** (borda esquerda 3 px na cor de destaque + fundo `--secondary`), concluída (✓ preenchido + números em peso maior). Nunca distinga só por cor: o ✓ muda de forma (○ → ✓).
- **Steppers x digitação:** não caibam os dois inline a 360 px (um stepper decente são 3 alvos de 44 px = 132 px, só para a carga). Padrão recomendado **[opinião fundamentada]**: a linha ativa **expande** e mostra, abaixo dela, uma faixa de ajuste rápido de 56 px — `[ −2,5 ] [ −1 ] [ 20,0 kg ] [ +1 ] [ +2,5 ]` — com incrementos vindos de `progressao.json` (por tipo de exercício), e tocar no número abre teclado numérico. Isso dá o gesto de uma mão sem quebrar a densidade da tabela.
- **Inputs:** use `inputmode="decimal"` para carga (traz o ponto/vírgula) e `inputmode="numeric"` para repetições (só dígitos). Prefira `inputmode` a `type="number"`, que traz as setinhas do desktop e comportamentos estranhos de validação.
- **"Última repetição firme?"** — coloque no **rodapé do bloco do exercício**, não por série, como um segmented control de 3 estados e **altura 44 px**: `[ Fácil ] [ Firme ] [ Falhei ]`. É o que alimenta o motor de dupla progressão e substitui, de forma honesta, uma escala RPE de 10 pontos que ninguém calibra sozinho. Hevy usa uma escala RPE com cor; três estados são mais adequados a um iniciante **[opinião]**.
- **Salvar na hora:** cada toque no ✓ grava no IndexedDB antes de qualquer animação. O ✓ nunca fica em estado "carregando" — o feedback é local e imediato; a fila para o Supabase é invisível (só um ícone de nuvem discreto no header quando há pendências).

**Uso com uma mão — regras de posição**
- Tudo que se toca repetidamente (✓, steppers, pausar, próximo) **abaixo de 60 % da altura da tela**.
- Tudo que é destrutivo ou raro (descartar sessão, editar prescrição) **no topo**, onde o polegar não chega por acidente.
- Nada de ação primária no canto superior esquerdo.

**Fontes:** [Hevy — Automatic Workout Rest Timer](https://www.hevyapp.com/features/workout-rest-timer/) · [RepReturn — Hevy App Review 2026 (Set Row UI, limitação de descanso para warm-up)](https://repreturn.com/hevy-app-review/) · [CSS-Tricks — Finger-friendly numerical inputs with `inputmode`](https://css-tricks.com/finger-friendly-numerical-inputs-with-inputmode/) · [Smashing — The Thumb Zone](https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/)

---

## 4. Ficha do exercício

**Ordem da página** (a primeira dobra tem que responder "como faço isso?"):

1. **Mídia, 328 × 328** (quadrado) ou 328 × 246 (4:3), com `aspect-ratio` fixo para não haver layout shift.
   - Hierarquia de formatos: **animação SVG em loop** (é o que o projeto tem, 66 figuras com SMIL — leve, nítida em qualquer densidade, respeita `prefers-color-scheme`) → **fotos início/fim** lado a lado como fallback → vídeo só se existir.
   - Se houver vídeo: `<video muted loop playsinline autoplay preload="metadata">` com pôster. `playsinline` é obrigatório no iOS, senão entra em tela cheia.
   - **Controle de reprodução visível** (⏯ de 44 px) e pausa automática sob `prefers-reduced-motion: reduce`.
   - Toque na mídia alterna entre animação e as duas fotos ("ver fotos reais").
2. **Chips de resumo** logo abaixo: `Peito · Halteres · 3×8–10 · descanso 90 s`.
3. **Mapa muscular** — o sprite do projeto (`#bf` frente / `#bb` costas), lado a lado a 158 px cada a 360 px. Primário na cor de destaque, secundário numa versão atenuada **que ainda passe 3:1 contra o corpo** (ver auditoria na seção 8 — o token atual falha). Sempre com **legenda textual** ("Primários: peitoral maior, tríceps"), porque cor sozinha não comunica.
4. **Passos numerados** (de `exercicios.json`), lista ordenada, 16 px, `line-height: 1.5`.
5. **Erro comum** em um bloco de aviso com ícone + borda esquerda 3 px — não use vermelho de erro; é conselho, não falha.
6. **Montagem da barra** (anilhas por lado) como desenho, não texto.
7. **Histórico e recorde** no fim:
   - **Recorde em destaque**: `Melhor série · 22,5 kg × 9 · 02/09` e `e1RM 28,6 kg` (ver seção 5 sobre a confiabilidade do e1RM).
   - **Sparkline de carga** (328 × 64 px) das últimas 8–12 sessões, com pontos tocáveis.
   - **Últimas 5 sessões** como linhas compactas: `10/09 · 3×10 @ 20,0 kg · firme`.
   - Botão "ver tudo" abre o histórico completo.

**Evitar:** GIFs pesados (a animação SVG do projeto é ordens de grandeza menor); autoplay de vídeo com som; parede de texto acima da mídia; mapa muscular sem legenda.

**Fontes:** [MDN — `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) · [W3C SC 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) · [NN/g — Glanceable Fonts](https://www.nngroup.com/articles/glanceable-fonts/)

---

## 5. Relatório / estatísticas

### Quais métricas fazem sentido sem sensores

**A regra número um: não mostre calorias.** O estudo de Stanford (60 voluntários, 7 dispositivos com sensor óptico de frequência cardíaca) encontrou **erro mediano de 27,4 % no melhor aparelho e 92,6 % no pior** para gasto energético — e isso **com** sensores. Um PWA sem sensor nenhum só pode chutar pior. Os mesmos aparelhos acertaram a frequência cardíaca com erro < 5 %: o problema é específico de kcal.

**Métricas honestas, todas derivadas do que o usuário digitou:**

| Métrica | Como calcular | Por que |
|---|---|---|
| Treinos concluídos | contagem de sessões | o hábito |
| Minutos sob a barra | soma da duração das sessões | tempo real, medido |
| **Volume (tonelagem)** | Σ (séries × reps × carga) em kg | proxy direto de trabalho mecânico |
| **Séries válidas por músculo/semana** | contar séries por músculo primário | é a variável dose-resposta da literatura: > 10 séries/semana produziu hipertrofia significativamente maior que < 10 (meta-análise Schoenfeld, Ogborn & Krieger 2017) |
| **e1RM por exercício** | Epley / Brzycki | confiável em **1–5 reps** (concordam em 2–3 %) e razoável até ~10 reps (erro 2–10 %); **acima de 10 reps, degrada** — mostre com essa ressalva |
| Recordes | melhor carga, melhor reps na carga, melhor e1RM | evidência de competência |
| Aderência | treinos feitos ÷ planejados na semana | substitui o streak |
| Peso corporal | média móvel de 7 dias | a leitura crua oscila 1–2 kg por água |
| Medidas de fita | por região, 1×/mês | o que o IMC não vê |

**Sobre o IMC:** é peso ÷ altura², uma ferramenta de triagem populacional que **não distingue massa magra de gordura**. Para alguém de 1,90 m ganhando músculo, o IMC vai subir exatamente quando o treino está funcionando. Recomendação **[opinião]**: mostrar IMC como linha pequena e secundária na aba Corpo, com a faixa e um aviso de uma linha, e deixar peso + medidas + fotos como as métricas de primeira classe.

### Layout

- **Contadores no topo:** 3 cards em linha a 360 px = **104 px de largura cada** (3 × 104 + 2 × 8 = 328). Número em **28–32 px tabular-nums**, rótulo em 12 px caixa alta. Não caibam 4 — se precisar de mais, faça 2 × 2.
- **Seletor de período** como chips no topo: `Semana · Mês · 3 meses · Tudo`. Chip Material tem **32 dp de altura visual**, então adicione padding vertical para chegar a **48 px de alvo**; espaçamento de 8 px entre chips.
- **Gráficos (Recharts):**
  - Altura **180–220 px**, largura 328. Eixo Y com no máximo 4 ticks, eixo X com rótulos `dd/mm`.
  - **Séries com 3:1 de contraste contra o fundo e entre si** (SC 1.4.11) e **diferenciadas por mais do que cor**: linha sólida vs tracejada, marcadores diferentes.
  - **Não use tooltip de hover como único acesso ao valor** — no celular não há hover. Toque em um ponto deve fixar um rótulo, e deve haver uma tabela/lista equivalente acessível.
  - Carga: um gráfico por exercício (seletor), não todos empilhados.
  - Volume: barras semanais, com uma linha de média móvel de 4 semanas.
- **Calendário heatmap:**
  - A 360 px, a grade de 52 semanas × 7 dias não cabe legível (daria ~5 px por célula). **Use 12–16 semanas** com células de **16 × 16 px + 3 px de gap** (13 semanas × 19 = 247 px) e role horizontalmente com scroll-snap por mês, **ou** mostre um mês por vez em células de 40 px (que já são alvos de toque).
  - **5 níveis no máximo**, com **3:1 entre níveis adjacentes** e 3:1 contra o fundo — na prática é quase impossível conseguir 7 tons distinguíveis, então limite a escala.
  - **Distinga "sem treino planejado" de "treino planejado e não feito"** — dar a mesma cor aos dois é o erro clássico do gráfico de contribuições.
  - Marque cada célula como `role="gridcell"` com `aria-label` de data + valor; não dependa de tooltip.
  - Legenda textual: `menos ▢▢▣▣■ mais`.
- **Recordes** como lista de cartões pequenos, com "quando" e "o que mudou desde então".

**Fontes:** [CNBC — Stanford: fitness trackers são ruins em contar calorias](https://www.cnbc.com/2017/05/23/fitness-trackers-bad-at-calorie-counting-stanford-study.html) · [Shcherbina et al., *J Pers Med* 2017 (PMC5491979)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5491979/) · [Schoenfeld, Ogborn & Krieger 2017 — dose-resposta de volume (PubMed 27433992)](https://pubmed.ncbi.nlm.nih.gov/27433992/) · [Validação das equações de Brzycki e Epley (OpenSIUC)](https://opensiuc.lib.siu.edu/cgi/viewcontent.cgi?article=1744&context=gs_rp) · [Designing accessible charts — heat maps e 3:1](https://fionabaudner.medium.com/designing-accessible-charts-39ab0ff546b6)

---

## 6. Explorar / Descobrir — sem parecer loja

O que faz uma tela de descoberta "cheirar a loja": carrosséis auto-rotativos, cards grandes com foto + preço-like + CTA repetido, "destaques" curados por alguém que quer te vender algo, e badges tipo "NOVO".

**Fazer**
- **Busca no topo, sempre visível** (sticky, 48 px). Com 81 exercícios, a busca resolve mais rápido que qualquer vitrine. Busca por nome, músculo e equipamento, com resultados enquanto digita.
- **Chips de filtro em linha rolável** logo abaixo da busca: `Peito · Costas · Pernas · Ombros · Braços · Core` e um segundo grupo por implemento (`halteres · barra · elástico · peso do corpo`). Chips selecionados mostram um ✓ (não só mudam de cor). Altura de alvo 48 px, gap 8 px.
- **Listas densas em vez de vitrines.** Depois dos filtros, uma lista de exercícios com miniatura 48 px, nome e músculo primário — a mesma anatomia da seção 2. É um **catálogo de referência**, não uma prateleira.
- **Agrupamentos "temáticos" úteis**, que é o que Baymard recomenda para navegação: "o que dá pra fazer só com halteres", "substitutos do supino", "quando o ombro dói". Isso é conhecimento, não merchandising.
- **Entrada pelo mapa do corpo:** toque num músculo do sprite → lista de exercícios daquele músculo. É a navegação mais natural do domínio e não tem paralelo em e-commerce **[opinião]**.
- **Contagem visível**: "81 exercícios · 12 com halteres". Deixar claro o tamanho do acervo é uma das quatro recomendações do Baymard para navegação mobile.

**Evitar**
- Carrossel auto-rotativo (banner blindness + problemas de usabilidade em mobile — recomendação explícita do Baymard contra em mobile).
- Categorias estreitas e rasas (uma categoria com 2 itens).
- Cards grandes de "planos" e "desafios" com foto de capa ocupando a tela inteira: é exatamente a linguagem visual de app pago. Se houver planos, liste-os como **linhas** com uma linha de descrição.
- Conteúdo "recomendado para você" gerado por heurística fraca.

**Fontes:** [Baymard — The State of Mobile E-Commerce Search and Category Navigation](https://baymard.com/blog/mobile-ecommerce-search-and-navigation) · [Smashing — Usability Guidelines For Better Carousels UX](https://www.smashingmagazine.com/2022/04/designing-better-carousel-ux/) · [M3 — Chips specs](https://m3.material.io/components/chips/specs)

---

## 7. Tema escuro, tipografia, safe-area e PWA

### Tema escuro de verdade

- **Base:** o Material recomenda **#121212** em vez de preto puro, porque cinza escuro permite ver elevação/sombra e reduz o "brilho" de texto branco sobre preto absoluto. O projeto usa `#0a0a0a` — mais escuro que a recomendação, defensável em OLED (economiza bateria e dá preto infinito), desde que os **cards subam de tom** para criar hierarquia, que é o que já acontece (`--card: #141414`).
- **Elevação por luminosidade, não por sombra.** No escuro a sombra some. Escala sugerida: `#0a0a0a` (fundo) → `#141414` (card) → `#1c1c1c` (secondary/pressionado) → `#242424` (sheet/dialog).
- **Dessature o destaque.** Cores saturadas "vibram" sobre fundo escuro. A prática do Material é usar tons 200–300 no escuro em vez do tom 500 do claro. O projeto faz isso corretamente: `#b8400c` no claro → `#fb923c` no escuro.
- **Texto:** branco puro (#fff) sobre #0a0a0a dá 19,8:1 — desnecessariamente duro. Um off-white (#f5f5f4 → 18,15:1) é mais confortável e continua muito acima do exigido.
- **Limite grandes áreas da cor de destaque.** Um bloco de 328 × 200 px em laranja saturado cansa. A cor de destaque é para: botão primário, estado ativo, série do gráfico, músculo primário, anel do dia de hoje. Ponto.
- **Não force o tema escuro**: `prefers-color-scheme` + um toggle explícito (autonomia, e as figuras SVG do projeto já respondem a `prefers-color-scheme`).

**Fontes:** [Material — Dark theme](https://m2.material.io/design/color/dark-theme.html) · [Google Codelab — Design a dark theme with Material and Figma](https://codelabs.developers.google.com/codelabs/design-material-darktheme) · [Apple HIG — Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)

### Tipografia para números lidos a um braço de distância, no sol

- **Escala de números** (sempre `font-variant-numeric: tabular-nums`, peso 500–600):
  - Timer da sessão / contagem regressiva: **72–96 px**
  - Carga na linha ativa: **28–32 px**
  - Contadores do relatório: **28–32 px**
  - Valores em linhas de série: **20 px**
  - Metadados e rótulos: **13–15 px**
- **Corpo de texto:** 16 px mínimo (16 px web / 16 sp Android / 17 pt iOS), `line-height` 1.5.
- **Rótulos de uma palavra em CAIXA ALTA** com `letter-spacing: .04–.08em` (26 % mais rápido de reconhecer). Não aplique a frases.
- **Nunca condensada, nunca thin** em nada que seja lido em movimento (+11,2 % de tempo para condensada; a NN/g desaconselha thin explicitamente em ambientes de distração).
- **Sol forte = baixa visão funcional.** Trate o modo "terraço ao meio-dia" como caso de acessibilidade: tudo que for crítico em 3:1 ou mais; considere um **modo alto contraste** opcional que sobe o texto para branco puro, engrossa os pesos e desliga a foto de capa **[opinião]**.
- Respeite `Dynamic Type` / zoom do sistema: nada em `px` fixo travado que quebre a 200 % de zoom (SC 1.4.4).

**Fontes:** [NN/g — Typography for Glanceable Reading](https://www.nngroup.com/articles/glanceable-fonts/) · [W3C SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [W3C SC 1.4.4 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)

### Safe-area e nav inferior

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```
**Sem `viewport-fit=cover`, todos os `env(safe-area-inset-*)` resolvem para 0px** e o Safari letterboxa o conteúdo. É a condição de tudo o mais.

```css
.nav-inferior {
  position: fixed; inset-inline: 0; bottom: 0;
  height: calc(64px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
main { padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 16px); }
.timer-fixo { position: sticky; top: env(safe-area-inset-top, 0px); }
```
- Nav de **5 abas a 360 px = 72 px por aba** — confortável. Altura do M3 é 80 dp; 64 px + safe-area é um meio-termo razoável para PWA **[opinião]**.
- Estado ativo: ícone preenchido + rótulo + indicador (pílula 56 × 28 ou barra superior de 2 px). **Rótulos sempre visíveis** (5 abas sem rótulo é adivinhação).
- `aria-current="page"` na aba ativa.

### PWA instalável — checklist técnico

| Item | Detalhe | Fonte |
|---|---|---|
| Manifest | `display: "standalone"` (único suportado no iOS), `theme_color`, `background_color`, ícones 192/512 + um **maskable** | [web.dev — PWA enhancements](https://web.dev/learn/pwa/enhancements) |
| Splash iOS | iOS **não gera splash a partir do manifest**: precisa de `<link rel="apple-touch-startup-image">` por tamanho/orientação (25+ variações para cobertura total; gere com pwa-asset-generator) | idem |
| Barra de status iOS | `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` — desloca a origem do viewport para (0,0) físico, o que **exige** as env() de safe-area | idem |
| Atalhos | `shortcuts` no manifest — Chrome Android renderiza só os **3 primeiros**; ordene por importância ("Começar treino do dia", "+1 barra fixa", "Registrar peso") | idem |
| Wake lock | HTTPS + documento ativo + re-aquisição no `visibilitychange`; pode ser recusado por bateria baixa/economia de energia | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) |
| Vibração | **ausente no iOS**; feature-detect + fallback sonoro | [Can I Use](https://caniuse.com/mdn-api_navigator_vibrate) |
| Voz | `speechSynthesis` só dentro de cadeia síncrona de gesto no iOS; `getVoices()` pode vir vazio; para em background | [samueleddy.com](https://samueleddy.com/writing/ios-safari-audio-sessions/), [weboutloud.io](https://weboutloud.io/bulletin/speech_synthesis_in_safari/) |

---

## 8. Auditoria dos tokens atuais do repositório (calculada, não estimada)

Rodei os contrastes WCAG dos tokens em `/home/user/WORKOUT/app/globals.css` (bloco `.dark`, linhas 88–122):

| Par | Razão | Veredito |
|---|---|---|
| `#f5f5f4` sobre `#0a0a0a` (texto/fundo) | **18,15:1** | ✅ AAA |
| `#f5f5f4` sobre `#141414` (texto/card) | **16,89:1** | ✅ AAA |
| `#a1a1a0` sobre `#0a0a0a` (muted) | **7,66:1** | ✅ AAA |
| `#a1a1a0` sobre `#141414` (muted em card) | **7,12:1** | ✅ AAA |
| `#fb923c` sobre `#0a0a0a` (destaque) | **8,75:1** | ✅ AAA |
| `#0a0a0a` sobre `#fb923c` (texto do botão primário) | **8,75:1** | ✅ AAA |
| `#f87171` sobre `#0a0a0a` (destructive) | **7,16:1** | ✅ AAA |
| `#272727` sobre `#0a0a0a` (`--border`) | **1,33:1** | ⚠️ ok como separador decorativo; **falha os 3:1 do SC 1.4.11** se for a borda que identifica um controle (campo de input, card clicável, chip não selecionado) |
| `#2e2e2e` sobre `#0a0a0a` (`--input`) | **1,46:1** | ⚠️ mesmo problema: a borda do campo numérico precisa de **≥ 3:1** (≈ `#4d4d4d` ou mais claro) |
| `#7c4a1e` sobre `#272727` (`--msec` músculo secundário no mapa) | **2,03:1** | ❌ **falha 1.4.11** — o músculo secundário fica quase invisível. Subir para ~`#b46b2a`/`#a35f22` ou diferenciar por hachura/opacidade + legenda |
| `#fb923c` sobre `#272727` (`--mprim` músculo primário) | **6,60:1** | ✅ |

Achados acionáveis: **(a)** criar um token separado `--border-forte` ≥ 3:1 para bordas de controles (inputs, chips, checkbox da série) mantendo `--border` fraco para separadores; **(b)** corrigir `--msec`; **(c)** o resto da paleta escura está sólido e não precisa mexer.

Arquivos relevantes conferidos: `/home/user/WORKOUT/app/globals.css`, `/home/user/WORKOUT/components/nav-inferior.tsx` (as 5 abas já são Treino · Explorar · Relatório · Corpo · Mais), `/home/user/WORKOUT/components/treinar/` (`serie.tsx`, `timer-descanso.tsx`, `bloco.tsx`), `/home/user/WORKOUT/components/ui/` (`card-capa.tsx`, `faixa-semana.tsx`, `botao-largo.tsx`, `contador.tsx`, `miniatura.tsx`).

---

## 9. Checklist de auditoria — 20 itens verificáveis a 360 px

Cada item é falsificável com DevTools em 360 × 640, zoom 100 %, tema escuro.

1. **Sem rolagem horizontal** em nenhuma tela: `document.documentElement.scrollWidth === 360`.
2. **Margem lateral ≥ 16 px** em todo conteúdo; nenhum elemento com `min-width` > 328 px (exceto tabelas/gráficos em container próprio com `overflow-x: auto`).
3. **Todo alvo interativo ≥ 44 × 44 px** (medir a caixa do listener, não o ícone). Zero exceções em telas de execução.
4. **Espaçamento ≥ 8 px** entre alvos adjacentes; nenhum par de alvos com centros a menos de 24 px (regra de espaçamento do SC 2.5.8).
5. **Botão "Começar" visível sem rolar** na home a 360 × 640.
6. **Nav inferior**: 5 abas com rótulo visível, cada aba ≥ 64 px de largura, altura ≥ 56 px + `env(safe-area-inset-bottom)`, e `aria-current="page"` na ativa.
7. **`viewport-fit=cover` presente** e `env(safe-area-inset-*)` retornando valor > 0 em aparelho com notch (verificar em `getComputedStyle`).
8. **Nenhum conteúdo escondido atrás da nav**: o último elemento de cada página é totalmente visível ao rolar até o fim.
9. **Contraste ≥ 4,5:1** para todo texto < 24 px e **≥ 3:1** para texto ≥ 24 px — incluindo texto sobre a foto de capa, medido no pixel mais claro da imagem.
10. **Contraste ≥ 3:1** para bordas de inputs, checkbox de série, chips não selecionados, anel de foco e toda série de gráfico (SC 1.4.11).
11. **Nenhuma informação transmitida só por cor**: série concluída (✓), dia feito (glifo), chip selecionado (✓), nível do heatmap (legenda + `aria-label`), músculo primário/secundário (legenda textual).
12. **Anel de foco visível** em todos os controles ao navegar por teclado/Bluetooth, com ≥ 3:1 contra o fundo adjacente.
13. **Números com `tabular-nums`**: o timer de descanso não muda de largura entre 01:09 e 01:10.
14. **Timer de descanso fica sticky** abaixo do header ao rolar a sessão inteira, sem sobrepor a primeira linha de série.
15. **Teclado numérico correto**: campo de carga abre com separador decimal (`inputmode="decimal"`); campo de reps abre só dígitos (`inputmode="numeric"`).
16. **Persistência**: marcar uma série, matar o app (fechar a aba) e reabrir → a série continua marcada (IndexedDB), sem rede.
17. **Wake lock**: com a sessão aberta, a tela não apaga por 3 min; ao trocar de app e voltar, o lock é readquirido (log do `visibilitychange`).
18. **Degradação sem vibração/voz**: em iOS, o fim do descanso ainda avisa (som + sinal visual persistente) e a sessão não quebra com `speechSynthesis` mudo.
19. **`prefers-reduced-motion: reduce`** desliga animação SMIL das figuras, auto-scroll e transições de página; o conteúdo continua acessível.
20. **Zero kcal na interface** e nenhum elemento de gamificação fora do permitido (sem badges, pontos, níveis, confete); o streak aparece no máximo como uma linha de texto ≤ 14 px, e a meta semanal é a métrica em destaque.

---

## 10. Proposta de layout — wireframes das 5 abas

Largura representada ≈ 360 px (40 colunas ASCII ≈ 328 px úteis + margens).

### Aba 1 · **Treino** (`/`)

```
┌────────────────────────────────────────┐ ← env(safe-area-inset-top)
│ Segunda, 15/09        Fase 1 · Sem. 1 ☁│  40px  status + fila offline
├────────────────────────────────────────┤
│ ⟳ Treino aberto de 12/09               │  56px  (só se existir)
│      [ Continuar ]      [ Descartar ]  │        44px cada
├────────────────────────────────────────┤
│ ╔══════════════════════════════════════╗│
│ ║        (foto de capa 16:9)           ║│ 185px
│ ║ ░░░░░░░ scrim .88→0 ░░░░░░░░░░░░░░░░ ║│
│ ║ TREINO A · CORPO INTEIRO             ║│  26px semibold
│ ║ 52 min · 7 exercícios · descanso 90s ║│  14px muted
│ ╚══════════════════════════════════════╝│
│ ┌──────────────────────────────────────┐│
│ │           COMEÇAR TREINO             ││  56px, destaque
│ └──────────────────────────────────────┘│
├────────────────────────────────────────┤
│ Semana   ████████░░░░  2 de 3 treinos  │  barra 8px + 14px
│  S    T    Q    Q    S    S    D       │
│ [✓]  [●]  [—]  [●]  [—]  [○]  [—]      │  7 × 40×56, hoje com anel
├────────────────────────────────────────┤
│ HOJE VOCÊ VAI FAZER                    │  12px caixa alta
│ ▢ Agachamento     3×8–10 · 20,0 kg     │  72px
│ ▢ Supino halteres 3×8–10 · 12,5 kg     │  72px
│ ▢ Remada curvada  3×8–10 · 20,0 kg     │  72px
│              ver os 7 exercícios  ›    │  44px
├────────────────────────────────────────┤
│ 78,4 kg · pesado há 3 dias      Pesar ›│  13px muted
│ Barra fixa solta hoje: 6      [ +1 ]   │  48px
└────────────────────────────────────────┘
│ 🏋 Treino  🧭 Explorar  📈 Relatório  🧍 Corpo  ⋯ Mais │ 64px+inset
```

### Aba 1b · **Sessão em andamento** (`/treinar/[id]`)

```
┌────────────────────────────────────────┐
│ ‹  Treino A          28:14        ⋮    │ 48px (⋮ = descartar/reordenar)
├────────────────────────────────────────┤
│ ⏱ 01:22  ███████████░░░░░   +30s   ✕   │ 52px STICKY, cor destaque
├────────────────────────────────────────┤
│ [img] SUPINO COM HALTERES        ? ⋮   │ 64px  (? = ficha)
│ 3 × 8–10 · 12,5 kg · descanso 90 s     │
│ ┌──┬──────┬──────────┬────────┬──────┐ │
│ │1 │12×10 │ 12,5 kg  │   10   │  ✓   │ │ 56px
│ ├──┼──────┼──────────┼────────┼──────┤ │
│ │2 │12×10 │ 12,5 kg  │   10   │  ✓   │ │
│ ├──┼──────┼──────────┼────────┼──────┤ │
│ │3 │  —   │ 12,5 kg  │  8–10  │  ○   │ │ ← linha ativa
│ │  [ −1 ] [ −0,5 ] [ +0,5 ] [ +1 ]   │ │ 56px (só na ativa)
│ └──┴──────┴──────────┴────────┴──────┘ │
│ Última repetição:                      │
│ [  Fácil  ][   Firme   ][   Falhei  ]  │ 44px segmented
│                        + adicionar série│ 44px
├────────────────────────────────────────┤
│ [img] REMADA CURVADA             ? ⋮   │ (próximo bloco, colapsado)
│ 3 × 8–10 · 20,0 kg          0 de 3 ✓   │
└────────────────────────────────────────┘
│           [ FINALIZAR TREINO ]         │ 56px, fixo no rodapé
```

### Aba 2 · **Explorar** (`/explorar`)

```
┌────────────────────────────────────────┐
│ 🔎 Buscar exercício, músculo, item…    │ 48px STICKY
├────────────────────────────────────────┤
│ [Peito][Costas][Pernas][Ombro][Braço]› │ 48px alvo, chips roláveis
│ [halteres][barra][elástico][corpo]   › │ 48px
├────────────────────────────────────────┤
│ TOQUE UM MÚSCULO                       │ 12px caixa alta
│   ┌──────────┐      ┌──────────┐       │
│   │  frente  │      │  costas  │       │ 158×200 cada
│   │   (svg)  │      │   (svg)  │       │
│   └──────────┘      └──────────┘       │
├────────────────────────────────────────┤
│ 81 exercícios no catálogo              │ 13px muted
│ [img] Agachamento livre                │ 64px
│       Quadríceps · barra maciça        │
│ [img] Agachamento búlgaro              │ 64px
│       Quadríceps · halteres            │
│ …                                      │
├────────────────────────────────────────┤
│ POR SITUAÇÃO                           │ 12px caixa alta
│ › Só com halteres            12 exerc. │ 56px (linhas, não cards)
│ › Sem equipamento nenhum      9 exerc. │ 56px
│ › Substitutos do supino       4 exerc. │ 56px
│ › Plano de barra fixa (12 sem.)        │ 56px
└────────────────────────────────────────┘
```

### Aba 3 · **Relatório** (`/relatorio`)

```
┌────────────────────────────────────────┐
│ Relatório                              │ 48px
│ [Semana][Mês][3 meses][Tudo]           │ 48px chips
├────────────────────────────────────────┤
│ ┌───────┐ ┌───────┐ ┌───────┐          │ 104px cada, gap 8
│ │  12   │ │  614  │ │ 18,4 t│          │ número 30px
│ │TREINOS│ │MINUTOS│ │VOLUME │          │ rótulo 12px CAIXA
│ └───────┘ └───────┘ └───────┘          │
├────────────────────────────────────────┤
│ Meta semanal  ████████░░░░ 2 de 3      │ 8px + 14px
│ 5 semanas seguidas cumprindo a meta    │ 13px muted ← streak discreto
├────────────────────────────────────────┤
│ ÚLTIMAS 13 SEMANAS            ‹ role › │ 12px caixa alta
│ S ▢▣■▢▣■▢▣■▢▣■▢                        │ células 16px + gap 3
│ T ▢▢▣■▢▢▣■▢▢▣■▢                        │ role=gridcell + aria-label
│ …                                      │
│ menos ▢ ▢ ▣ ▣ ■ mais   ▫ = não previsto│ legenda textual
├────────────────────────────────────────┤
│ CARGA · Supino halteres        trocar ›│
│  kg ┤                        ╭─●       │ 200px altura
│     ┤            ╭──●───●────╯         │ tap fixa rótulo
│     ┤   ●───●────╯                     │
│     └─┬────┬────┬────┬────┬────┬──     │
│      12/08     26/08     09/09         │
├────────────────────────────────────────┤
│ VOLUME SEMANAL (kg)                    │
│     ▇  ▇  █  ▇  █  █  ▉   ─ média 4 sem│ 180px
├────────────────────────────────────────┤
│ SÉRIES VÁLIDAS POR MÚSCULO (semana)    │
│ Peito   ██████████ 12    alvo 10–20    │ barras 24px
│ Costas  ████████ 9                     │
├────────────────────────────────────────┤
│ RECORDES                               │
│ Supino halteres  12,5 kg × 10  · 09/09 │ 56px
│   e1RM 16,7 kg (estimado, 1–10 reps)   │ 12px muted + ressalva
└────────────────────────────────────────┘
```

### Aba 4 · **Corpo** (`/corpo`)

```
┌────────────────────────────────────────┐
│ Corpo                                  │ 48px
│ [ Peso ][ Medidas ][ Fotos ]           │ 48px tabs
├────────────────────────────────────────┤
│         78,4 kg                        │ 44px tabular-nums
│  média 7 dias 78,1 · −0,6 kg no mês    │ 14px muted
│ ┌──────────────────────────────────────┐│
│ │        [ REGISTRAR PESO ]            ││ 56px (pede se >7 dias)
│ └──────────────────────────────────────┘│
├────────────────────────────────────────┤
│ kg ┤      ╭╮   ╭─╮                     │ 200px, linha crua
│    ┤ ╭────╯╰───╯ ╰──╮  ── média móvel  │ + média móvel
│    └─┬────┬────┬────┬──                │
├────────────────────────────────────────┤
│ IMC 21,7 · altura 1,90 m               │ 13px muted, secundário
│ O IMC não separa músculo de gordura.   │ 12px, uma linha só
├────────────────────────────────────────┤
│ MEDIDAS · última em 01/09              │
│ Peito  102,0 cm   +1,5   ›             │ 56px
│ Braço D 35,5 cm   +0,5   ›             │ 56px
│ Cintura 84,0 cm   −1,0   ›             │ 56px
│            [ Nova medição ]            │ 48px
├────────────────────────────────────────┤
│ FOTOS                                  │
│ ┌────────┐ ┌────────┐   comparar ›     │ 158px cada
│ │ 01/08  │ │ 01/09  │                  │
│ └────────┘ └────────┘                  │
└────────────────────────────────────────┘
```

### Aba 5 · **Mais** (`/mais`)

```
┌────────────────────────────────────────┐
│ Mais                                   │ 48px
├────────────────────────────────────────┤
│ TREINO                                 │ 12px caixa alta
│ 🗓  Calendário e programa            › │ 56px
│ 🏃  Plano de corrida (semana 3)      › │ 56px
│ 🪢  Corda (estágio 2)                › │ 56px
│ 🤸  Barra fixa (semana 4)            › │ 56px
├────────────────────────────────────────┤
│ EQUIPAMENTO                            │
│ 🏋  Anilhas, barras e itens          › │ 56px
├────────────────────────────────────────┤
│ APARÊNCIA                              │
│ 🌓  Tema          [ Sistema ▾ ]        │ 56px
│ 🔆  Alto contraste (sol)      [ ○— ]   │ 56px switch 44px
│ 🔉  Voz nos timers            [ —● ]   │ 56px
│ 📳  Vibração         [ —● ] indisponível│ 56px (some no iOS)
│ 🔒  Manter tela acesa         [ —● ]   │ 56px
├────────────────────────────────────────┤
│ DADOS                                  │
│ ☁  Sincronização · tudo enviado      › │ 56px
│ ⬇  Exportar meus dados               › │ 56px
│ 📲  Instalar no celular              › │ 56px (some se standalone)
├────────────────────────────────────────┤
│ Perfil · miguel…@gmail.com           › │ 56px
│ Sair                                   │ 56px
└────────────────────────────────────────┘
```

---

## Fontes (consolidado)

**Guidelines oficiais**
- [Apple HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) · [Apple HIG — Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode) · [Apple HIG — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Material — Accessibility (48dp, 8dp)](https://m2.material.io/design/usability/accessibility.html) · [Material — Dark theme](https://m2.material.io/design/color/dark-theme.html) · [M3 — Navigation bar specs](https://m3.material.io/components/navigation-bar/specs) · [M3 — Chips specs](https://m3.material.io/components/chips/specs) · [Google Codelab — Dark theme](https://codelabs.developers.google.com/codelabs/design-material-darktheme)
- [Android Accessibility Help — Touch target size](https://support.google.com/accessibility/android/answer/7101858?hl=en)

**WCAG / W3C**
- [SC 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [SC 1.4.4 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) · [SC 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) · [SC 2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) · [SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) · [wcag22aa.org — Target Size](https://wcag22aa.org/new-criteria/target-size/)

**Pesquisa de UX**
- [NN/g — Typography for Glanceable Reading: Bigger Is Better](https://www.nngroup.com/articles/glanceable-fonts/)
- [NN/g — Autonomy, Relatedness, and Competence in UX Design](https://www.nngroup.com/articles/autonomy-relatedness-competence/)
- [NN/g — Ensure High Contrast for Text Over Images](https://www.nngroup.com/articles/text-over-images/)
- [Smashing — The Thumb Zone: Designing For Mobile Users](https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/) · [A List Apart — How We Hold Our Gadgets](https://alistapart.com/article/how-we-hold-our-gadgets/)
- [Smashing — Designing Accessible Text Over Images](https://www.smashingmagazine.com/2023/08/designing-accessible-text-over-images-part1/) · [Smashing — Usability Guidelines For Better Carousels UX](https://www.smashingmagazine.com/2022/04/designing-better-carousel-ux/)
- [Baymard — The State of Mobile E-Commerce Search and Category Navigation](https://baymard.com/blog/mobile-ecommerce-search-and-navigation)
- [LogRocket — All accessible touch target sizes](https://blog.logrocket.com/ux-design/all-accessible-touch-target-sizes/)

**Gamificação / streaks**
- [The Decision Lab — Streak Creep: When Gamified Engagement Mechanics Backfire](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification)
- [Yu-kai Chou — Streak Design: Motivation Without Burnout](https://yukaichou.com/gamification-analysis/streak-design-gamification-motivation-burnout/)
- [NerdSip — Gamification Gone Wrong: When Streaks and Badges Become the Point](https://nerdsip.com/blog/gamification-gone-wrong-when-streaks-become-the-point)

**Apps de treino (padrões concretos)**
- [Hevy — Automatic Workout Rest Timer](https://www.hevyapp.com/features/workout-rest-timer/) · [RepReturn — Hevy App Review 2026](https://repreturn.com/hevy-app-review/) · [Setgraph — Hevy vs Strong 2026](https://setgraph.app/ai-blog/hevy-vs-strong-app-comparison-2026)
- [Stormotion — Fitness App UI Design principles](https://stormotion.io/blog/fitness-app-ux/)

**Métricas / ciência do treino**
- [CNBC — Stanford: fitness trackers são ruins em contar calorias (erro 27–93 %)](https://www.cnbc.com/2017/05/23/fitness-trackers-bad-at-calorie-counting-stanford-study.html) · [Shcherbina et al. 2017, PMC5491979](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5491979/)
- [Schoenfeld, Ogborn & Krieger 2017 — dose-resposta de volume semanal (PubMed 27433992)](https://pubmed.ncbi.nlm.nih.gov/27433992/)
- [Validação de Brzycki e Epley (OpenSIUC)](https://opensiuc.lib.siu.edu/cgi/viewcontent.cgi?article=1744&context=gs_rp) · [Arvo — Epley & Brzycki explicadas](https://arvo.guru/resources/one-rep-max-formulas)

**Plataforma web / PWA**
- [MDN — Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) · [Chrome for Developers — Stay awake with the Screen Wake Lock API](https://developer.chrome.com/docs/capabilities/web-apis/wake-lock)
- [Can I Use — navigator.vibrate (sem suporte no iOS Safari)](https://caniuse.com/mdn-api_navigator_vibrate)
- [web.dev — Learn PWA: Enhancements (splash iOS, standalone, atalhos)](https://web.dev/learn/pwa/enhancements)
- [iOS Safari audio sessions: o gesto síncrono exigido pelo speechSynthesis](https://samueleddy.com/writing/ios-safari-audio-sessions/) · [The State of Speech Synthesis in Safari](https://weboutloud.io/bulletin/speech_synthesis_in_safari/)
- [CSS-Tricks — Finger-friendly numerical inputs with `inputmode`](https://css-tricks.com/finger-friendly-numerical-inputs-with-inputmode/) · [CSS-Tricks — Better Form Inputs for Better Mobile UX](https://css-tricks.com/better-form-inputs-for-better-mobile-user-experiences/)
- [MDN — `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [21st — Heatmaps and Contribution Graphs: A Chart Wearing a Calendar](https://21st.dev/blog/react-heatmap-calendar-components) · [Designing accessible charts (heat maps)](https://fionabaudner.medium.com/designing-accessible-charts-39ab0ff546b6)

---

### Três coisas que eu mudaria primeiro **[opinião]**

1. **Substituir o streak pela meta semanal com folga** na home e rebaixar o streak a uma linha de 13 px contando *semanas cumpridas*. É a mudança com maior retorno em aderência de longo prazo e a mais alinhada com a SPEC §7 ("sem gamificação barata").
2. **Consertar `--msec` (2,03:1) e criar `--border-forte` (≥ 3:1)** — são as duas únicas falhas objetivas de WCAG na paleta escura atual.
3. **Reprojetar a linha de série para a grade 28/62/92/76/48** com a coluna "anterior" e o ✓ de 48 px encostado à direita, com steppers aparecendo só na linha ativa. É o que torna o registro possível com uma mão a 360 px sem sacrificar densidade.
