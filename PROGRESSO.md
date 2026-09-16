# PROGRESSO — Treino do Terraço

Andamento por marco (SPEC.md §12). O que está aqui é o estado real do
repositório, não um plano.

---

## Estado da entrega — v2.1 (camada visual) ✅

A camada visual está pronta no código: 5 abas, player unificado, ficha em
folha, ilustrações com licença livre e crédito, Explorar, Relatório, Corpo e
Mais. Fechada em três auditorias independentes (fidelidade à referência a
360 × 740 · dados, offline e segurança · SPEC linha a linha) e dois ciclos de
correção; o que sobrou está em "Conhecido, não corrigido" abaixo, tudo menor.
**O que falta não é código: é infraestrutura** — o projeto Supabase, as
variáveis na Vercel, o merge do PR #2 e a instalação no celular (a "Checklist
de infraestrutura" mais abaixo, revisada nesta etapa).

Os critérios do app v1 (SPEC §10) continuam na seção "Estado da entrega — v1"
logo depois desta, com a mesma tabela de antes.

**Mais → Trocar senha (`/mais/senha`)** — acrescentada depois da v2.1, por uma
necessidade da infraestrutura: a conta do Miguel vai ser criada **direto no
banco**, com uma senha temporária, porque o painel do Supabase não está ao
alcance dele. Sem esta tela ele ficaria preso à senha que outra pessoa
escolheu. Ela pede a senha nova duas vezes (mínimo de 8 caracteres, mais do que
os 6 do GoTrue), chama `supabase.auth.updateUser({ password })` pelo cliente do
navegador e volta para *Mais* 1,5 s depois de "Senha trocada."; os erros saem
traduzidos por `lib/erros-auth.ts` e **nada disso vai para a fila** (§8) — sem
rede a tela diz "Precisa de internet para trocar a senha" e não chama nada.
Nada de e-mail e nada de "esqueci a senha". Provas: `lib/senha.test.ts` (a
validação pura) e `e2e/mais.spec.ts` (troca a senha, sai, a antiga deixa de
entrar e a nova entra), com a rota também no varredor de 360 px/44 px de
`e2e/auditoria-m6.spec.ts`. Portões desta mudança, na ordem e numa janela
sozinha: `npm run lint` limpo · `npm run build` ✓ Compiled successfully ·
`npm test` 44 arquivos, 987 testes · `npm run e2e` 206 passed (8,1m).

### Critérios de aceite da camada visual — §13.8, §14.5 e §15.4

**18 de 18.** "Como foi provado" é medição desta rodada (Chromium a 360 × 740,
build de produção contra `scripts/mock-supabase.ts`, nos dois temas, com a
conta semeada: perfil, `exercise_state`, 6 sessões de força, 4 de cardio,
soltas, peso e medidas, hoje = segunda 28/09/2026, semana 3 da Fase 1).

#### SPEC §13.8 — camada visual v2

| # | Critério | Como foi provado | Teste que cobre |
|---|---|---|---|
| 13.8.1 | Treino a 360 px nos dois temas: faixa da semana, meta, cards do dia, lista com miniatura, prescrição e carga; nada corta, nada rola de lado, alvos ≥ 44 px | `getBoundingClientRect` em 30 telas: `scrollWidth == clientWidth` em todas (overflow horizontal 0), nenhum elemento com `right > 360` fora de carrossel, nenhum alvo interativo < 44 px, nenhum texto reprovado em contraste AA | `e2e/treino-v2.spec.ts` (11) · `e2e/shell.spec.ts` (`semRolagemHorizontal` em cada rota) · `lib/semana.test.ts` |
| 13.8.2 | Explorar com as coleções derivadas (8 grupos, 9 aparelhos, 3 circuitos, 3 planos, 6 treinos), capas de `assets/`, subtítulo do campo `specs`, "Começar" abrindo sessão livre, busca sem acento | Tela contada à mão: destaque, "Escolhas para você", 6 treinos, 8 grupos, 9 aparelhos, 3 circuitos, 3 planos, catálogo com 6 filtros; busca por "biceps" e "agachamento bulgaro" achou | `e2e/v3.spec.ts` ("destaque, coleções derivadas e busca sem acento", "a tela de uma coleção começa uma sessão livre", "a coleção de um plano leva ao plano") · `lib/colecoes.test.ts` · `lib/capas.test.ts` |
| 13.8.3 | Circuito de core do início ao fim, gravando a sessão; nunca exercício de barra/halter/polia | Um circuito de core rodado inteiro pelo player (passos de reps e de tempo) gravou sessão livre concluída com `plano = {titulo "Core", 6 itens}` e o motor aplicado por exercício | `e2e/v3.spec.ts` ("Começar abre uma sessão livre de core e grava plano e séries") · `e2e/player.spec.ts` ("o passo por reps tem ×N e o de tempo tem contagem regressiva") · `lib/livre.test.ts` |
| 13.8.4 | Relatório com contadores, "todos os registros", sequências e IMC; `/progresso` redireciona | Contadores conferidos à mão contra a semente: TREINOS 10 (6 força + 4 cardio), MINUTOS 387 (15 780 s + 124 min), VOLUME 1.003 (Σ reps × kg = 1002,5), com "no total"; "Todos os registros" com 12 linhas em dd/MM e "Ver mais"; DIAS SEGUIDOS 0 e SEMANAS SEGUIDAS 2; `/progresso` → `/relatorio` | `e2e/v3.spec.ts` ("contadores, registros, sequências, Peso e IMC", "Todos os registros mostra também o que está fora da semana", "o IMC aparece na aba Peso") · `e2e/treino-v2.spec.ts` ("/progresso redireciona") · `lib/relatorio.test.ts` · `lib/imc.test.ts` |
| 13.8.5 | Vídeo opcional: com `assets/videos/<id>.mp4` a ficha mostra o vídeo; sem ele, a figura | Com um mp4 de teste em `public/videos`, `/exercicios/agachamento-livre` e o player mostraram `<video>`; sem o arquivo, a ilustração (o arquivo foi removido; `public/videos` é gerado, não versionado) | `e2e/treino-v2.spec.ts` ("sem o arquivo é a ilustração; com o arquivo é o vídeo") · `lib/videos.test.ts` |
| 13.8.6 | Nada de conteúdo inventado: nome de coleção, capa e dificuldade sempre derivados dos JSON | Títulos e subtítulos de coleções e desafios rastreados até `cardio.json`, `programa.json` e `equipamentos.json`; varredura de strings em `app/`, `components/` e `lib/` sem texto de conteúdo solto | `lib/colecoes.test.ts` · `lib/dificuldade.test.ts` · `lib/dados.test.ts` · `lib/auditoria-spec.test.ts` |
| 13.8.7 | Lint, build, `npm test` e `npm run e2e` verdes, com e2e novos para 13.3–13.6 | Os quatro portões abaixo, rodados do zero numa janela sozinha | "Portões finais" abaixo |

#### SPEC §14.5 — adaptação à referência "Treino em Casa"

| # | Critério | Como foi provado | Teste que cobre |
|---|---|---|---|
| 14.5.1 | "Começar treino" cria a sessão e entra no player **sem tela no meio**; `/treinar` continua para escolher o outro treino da fase | Um toque no botão largo do card do dia foi de `/` a `/treinar/<uuid>` direto, na Preparação; `/treinar` aberta pela URL mostra os dois treinos da fase | `e2e/player.spec.ts` ("a preparação anuncia o 1º exercício e o ✓ abre o descanso com o próximo") · `e2e/treino-v2.spec.ts` ("segunda: card de força com capa, raios e a lista") · `e2e/treino.spec.ts` ("abrir /treinar direto na URL (carga fria) desenha os dois treinos") |
| 14.5.2 | No Treino A o player registra 3 séries com carga e reps, dispara o descanso, pergunta "firme?" e conclui com o resumo do motor; fechar e reabrir volta ao mesmo passo; offline nada se perde | Coreografia inteira percorrida: Preparação (anel de 10 s) → Exercício → ✓ → Descanso ("PRÓXIMO 6/6", 2:30, "Editar tempo", "+20 s", "Pular") → "Última repetição saiu firme?" → Feedback (5 opções) → Conclusão; fechar e reabrir voltou ao mesmo passo com a carga editada (17,5 kg) e o peso digitado; um toque em "Próximo" gravou `sessions.status = concluida`, `sensacao`, `peso_corporal`, 6 `progression_events`, `exercise_state`, `profiles.ultimo_treino` e a linha em `body_weights`. Passo de cada tipo encontrado: carga (steppers de 56 px, `inputmode` numérico, "anterior: …", chip de montagem), peso corporal (×15), tempo (prancha 1:00), máximo (barra fixa pronada), assistida (seletor de elástico) | `e2e/player.spec.ts` ("3 séries do agachamento, 'firme?', feedback e a subida no resumo", "fechar e reabrir no meio do descanso volta ao mesmo passo", "sem rede o player continua registrando e a fila sobe depois", "digitar o peso e tocar UMA vez conclui") · `lib/player.test.ts` (35) · `lib/sessao.test.ts` |
| 14.5.3 | Num circuito de core o player roda igual à referência e grava a sessão livre | Mesma prova do §13.8.3, ponta a ponta pelo player | `e2e/v3.spec.ts` ("§14.5.3") · `lib/livre.test.ts` |
| 14.5.4 | A ficha em folha abre de Treino, do player e de Explorar com Vídeo · Músculos · Tutorial; o Tutorial só carrega o YouTube ao tocar e some sem rede; o stepper muda só a sessão do dia | Aberta das três origens: Vídeo com a ilustração alternando 1↔2, botão de pausa e crédito ("Everkinetic… CC BY-SA 3.0" / "clafal, CC BY-SA 4.0"); Músculos com o mapa anatômico frente/costas; Tutorial com miniatura + título + canal (só `i.ytimg.com` é pedido até o toque; sem rede, "Precisa de internet" + "Abrir no YouTube"); stepper "Só nesta sessão" e Substituir | `e2e/player.spec.ts` ("as três abas, o Tutorial só ao tocar e o stepper só da sessão", "sem rede o Tutorial some e sobra o link do YouTube") · `e2e/midia.spec.ts` (8) · `lib/trocas.test.ts` |
| 14.5.5 | Editar/reordenar, Ajustar, gostei/não gosto, Desafios, Parte do corpo em foco e Personalizar funcionam; nenhum conteúdo inventado | Subir/Descer de 44 × 44 com "Voltar à ordem do programa" (ordem persistiu), FAB Ajustar completo, "não gosto" marcou a preferência e jogou o agachamento para o fim da coleção Pernas, 3 Desafios reais, 8 chips de parte do corpo, 6 chips de filtro, Personalizar | `e2e/v3.spec.ts` (6 testes: carrossel dos planos, chips dos 8 grupos, Personalizar, Editar/reordenar, FAB Ajustar, coleções) · `e2e/player.spec.ts` ("não gosto marca a preferência e joga o exercício para o fim") · `lib/ordem.test.ts` · `lib/preferencias.test.ts` |
| 14.5.6 | Relatório e Conclusão mostram Peso e IMC; nunca kcal; sem confete | Peso e IMC medidos nas duas telas (IMC recalculou para 22,8 com os 82,4 digitados); `grep` de "kcal", "lb" e "confete/confetti" vazio em `app/`, `components/` e `lib/` | `e2e/v3.spec.ts` ("contadores, registros, sequências, Peso e IMC") · `e2e/player.spec.ts` ("digitar o peso e tocar UMA vez conclui, grava o peso e o body_weights") · `lib/imc.test.ts` |
| 14.5.7 | Lint, build, `npm test` e `npm run e2e` verdes, com e2e novos para 14.1–14.4 | Os quatro portões abaixo | "Portões finais" abaixo |

#### SPEC §15.4 — mídia dos exercícios

| # | Critério | Como foi provado | Teste que cobre |
|---|---|---|---|
| 15.4.1 | Toda imagem de terceiro tem autor, licença e link no JSON, crédito sob a mídia e linha em Mais → Créditos | `npm run validar` no `prebuild` conta 77 ilustrações (145/145 arquivos), uma entrada por exercício em `data/ilustracoes.json` com autor, licença e link; o crédito aparece sob a mídia na ficha (alvo de 44 px) e cada fonte tem linha em Créditos com o link certo | `e2e/midia.spec.ts` ("o crédito da ilustração aparece sob a mídia, com link para a fonte", "lista as fontes, as licenças e os links") · `lib/midia.test.ts` · `scripts/validar-dados.ts` |
| 15.4.2 | Mais → Créditos abre o texto completo da licença MIT do mapa | A tela linka `/mapa-muscular/LICENCA-mapa-anatomico.md` ("Texto completo da licença MIT"), servido de `public/` | `e2e/midia.spec.ts` ("lista as fontes, as licenças e os links") |
| 15.4.3 | Exercício sem ilustração mostra a figura ou a foto, sem crédito e sem erro | As 81 fichas abertas uma a uma, cada imagem com `naturalWidth > 0` e nenhum 404; os 14 sem figura caem na ilustração ou nas fotos | `e2e/midia.spec.ts` ("sem ilustração a ficha continua com a figura animada") · `e2e/auditoria-m5.spec.ts` ("as 81 fichas", "os 14 sem figura") |
| 15.4.4 | Lint, build, `npm test` e `npm run e2e` verdes | Os quatro portões abaixo | "Portões finais" abaixo |

Fora da tabela, quatro coisas que valem registro:

- **O `ALLOWED_EMAIL` agora também é do banco** (SPEC §9): `supabase/schema.sql`
  tem a constante `public.allowed_email()` num bloco "AJUSTE AQUI" e o trigger
  `on_auth_user_email_permitido` (`before insert on auth.users`), que recusa
  qualquer outro e-mail antes de o perfil nascer. Com a chave anon pública, sem
  ele o projeto aceitaria contas estranhas mesmo com a RLS por `auth.uid()`
  isolando os dados. Provado num Postgres 16 local (detalhes no "ciclo 3").
- **O motor não foi tocado pela camada visual.** `git diff` de
  `lib/progressao.ts` e `lib/montagem.ts` entre `c3de09f` (o último commit que
  os alterou, anterior ao marco V1) e o HEAD desta entrega: **vazio**.
- **Mapa muscular**: contraste dos músculos contra o corpo medido em 6,60:1
  (primários) e 3,61:1 (secundários) no escuro; 4,33 e 3,07 no claro.
- **Fotos dos itens** (`assets/itens/`) são a única mídia sem licença livre, e
  ficam pela exceção escrita na **SPEC §15.3**: só no inventário (Mais →
  Equipamento), nunca como capa no Explorar, com procedência em
  `data/equipamentos.json` e bloco próprio em Mais → Créditos.

### Portões finais

Rodados do zero nesta etapa, nesta ordem, com a árvore limpa e numa janela
sozinha (sem build, vitest ou Playwright concorrente):

```
npm run lint   limpo (sem avisos)
npm run build  ✓ Compiled successfully in 6,6s · 119 páginas geradas · 26 rotas
npm test       Test Files 43 passed (43) · Tests 980 passed (980)
npm run e2e    203 passed (7,7m) — Chromium 360 × 740, contra scripts/mock-supabase.ts
```

(Números do HEAD: os quatro foram rodados de novo no ciclo 3, depois da trava
do e-mail no banco — ela trouxe 5 unitários e 1 de ponta a ponta.)

`git diff c3de09f HEAD -- lib/progressao.ts lib/montagem.ts` (o último commit
que tocou o motor, anterior ao marco V1): **vazio**. A camada visual inteira
não mudou uma linha do motor nem da montagem.

Números do build desta rodada: `/` 397 kB · `/treinar/[sessionId]` 403 kB (a
maior) · `/relatorio` 342 kB · `/explorar` 295 kB · `/exercicios/[id]` 319 kB
(SSG, 81 páginas) · `/explorar/[tipo]/[valor]` 374 kB (SSG, 29 páginas) ·
`/login` 118 kB · compartilhado 104 kB · middleware 95,1 kB. Os unitários são
43 arquivos (motor, montagem, calendário, player, sessão, coleções, mídia,
relatório, formato, backup, outbox, queries); os 203 de ponta a ponta rodam em
20 arquivos em `e2e/`.

### Conhecido, não corrigido (v2.1)

Nenhum destes impede treinar; cada um vem com o contorno. Os conhecidos do app
v1 (CSP completa, Lighthouse, splash do iOS, apagar foto, `<input type=date>`…)
continuam na seção "Estado da entrega — v1" e não se repetem aqui.

| # | O quê | Onde | Contorno |
|---|---|---|---|
| 1 | O FAB **Ajustar** (fixo, 56 px) cobre parte do botão ⇄ "Substituir" de uma linha da lista do dia conforme a rolagem (medido: 49 % no topo, 31 % a 600 px); um toque no centro daquele alvo abre a folha Ajustar | `components/treino/fab-ajustar.tsx` | Tocar na **linha** do exercício abre a ficha, que tem "Substituir" — nada fica inacessível |
| 2 | O passo de série de trabalho **com a linha "anterior: …"** mede `scrollHeight` 758 contra 740 de tela: 18 px de rolagem que a referência não tem | `components/player/exercicio.tsx` | Nada some — os controles e o chip de montagem ficam acima de 676 px; é só um balanço de rolagem |
| 3 | A faixa da semana escreve **"sab"** sem acento (`format(EEEEEE, ptBR)` do date-fns) enquanto o calendário escreve "SÁB" | `lib/formato.ts` (`formatarDiaCurto`) | Só o rótulo curto; a data completa e o calendário estão certos. `lib/hoje.ts` já tem o mapa com "sáb" para copiar |
| 4 | No player o **polegar para cima aparece pressionado** por padrão (`text-primary` e `aria-pressed` quando o exercício não está entre os evitados), afirmando uma escolha que o usuário não fez | `components/player/exercicio.tsx` | Tocar em qualquer um dos dois grava a escolha de verdade; o "não gosto" funciona |
| 5 | A ficha em folha aberta **fora do player** ignora o vídeo local opcional: `components/treino/lista.tsx` e `components/colecoes/lista-da-colecao.tsx` não passam `temVideo` (só `tela-player.tsx` passa) | `components/exercicio/ficha-folha.tsx` e os dois chamadores | A ficha em página (`/exercicios/[id]`) mostra o vídeo, que é o que a §13.8.5 cobra — e nenhum vídeo vem no kit |
| 6 | Os Desafios dizem "Semana 3 de 12" com a barra em 17 %: `progressoDoDesafio` é `(semanaAtual − 1) / semanas`, isto é semanas **concluídas** | `lib/colecoes.ts` + `components/treino/desafios.tsx` | A conta está certa, o rótulo é que não diz qual das duas leituras é; vale também para os planos do Explorar |
| 7 | No Relatório o rótulo "VOLUME (KG)" quebra em duas linhas a 360 px e desalinha a base dos três contadores do topo | `components/relatorio/tela-relatorio.tsx` | Só alinhamento; os três números estão certos e legíveis |
| 8 | Na Conclusão, depois de digitar o peso, fechar e reabrir volta a mostrar o convite "Registrar o peso de hoje" embora o valor esteja guardado (o IMC ao lado já usa o valor novo) | `components/player/conclusao.tsx` | Nada se perde: abrindo o campo, o valor digitado está lá |
| 9 | A ficha em folha **fora do player** não tem stepper "só nesta sessão" nem anterior/próximo (n/N) | `components/exercicio/ficha-folha.tsx` | São gestos de sessão em andamento; cada linha da lista já tem o seu "Substituir" ao lado |
| 10 | O subtítulo das coleções de **aparelho** e de **circuito** é o campo `specs` do item, que descreve o aparelho e não a coleção | `lib/colecoes.ts` | É campo do JSON (a §14.4 exige isso); a alternativa era subtítulo vazio. Registrado na §13.8.2 |
| 11 | `Colecao.circuito` continua calculado e testado sem nenhuma tela que o leia | `lib/colecoes.ts` | Código morto inofensivo; o player decide o passo pelo tipo da prescrição |
| 12 | `ultima_firme` fica parcial enquanto a sessão está em andamento | `lib/sessao.ts` | A conclusão reenvia o valor final e a reconstrução ignora o retrato parcial |

### Como testar no celular (v2.1)

Depois da "Checklist de infraestrutura" (abaixo), com o app instalado:

1. **Instalar**: abra a URL da Vercel no Chrome (Android, menu ⋮ → *Instalar
   app*) ou no Safari (iPhone, Compartilhar → *Adicionar à Tela de Início*).
   Fique alguns segundos na aba **Treino**: é quando as ilustrações e as fotos
   do seu programa entram no cache.
2. **O treino inteiro pelo player**: aba Treino → **"Começar treino"** (cai
   direto na Preparação, sem tela no meio; a barra de 5 abas some). Anel de
   10 s → **"Começar agora"** → registre a série e toque no **✓**: o descanso
   abre sozinho anunciando o próximo ("+20 s", "Editar tempo", "Pular"). No fim
   do exercício, **"Última repetição saiu firme?"** → Feedback → Conclusão.
   Digite `82,4` no peso do dia e toque **uma vez** em "Próximo".
3. **Fechar no meio**: com o treino aberto, feche o app e reabra — volta ao
   mesmo passo, com a carga que você editou. Em **modo avião** funciona igual e
   nada se perde; ao voltar a rede, Mais → *Sincronização* diz "Tudo
   sincronizado".
4. **Ficha do exercício**: toque no nome do exercício (na lista do dia, no
   player ou dentro de uma coleção): **Vídeo** (a ilustração alternando as duas
   posições, com o crédito e o link da licença embaixo), **Músculos** (o boneco
   frente/costas pintado) e **Tutorial** (a miniatura do YouTube; ele só carrega
   o vídeo quando você toca, e sem rede vira "Abrir no YouTube"). O stepper
   "Só nesta sessão" muda a carga do dia sem mexer no programa.
5. **Explorar**: destaque, "Escolhas para você", os 6 treinos, 8 grupos, 9
   aparelhos, 3 circuitos e 3 planos. Busque **"biceps"** sem acento. Abra uma
   coleção e toque em "Começar" para uma sessão livre — ela registra e progride
   como um treino normal.
6. **Relatório**: os três contadores do topo são o acumulado ("no total"); o
   card de baixo é "Esta semana". "Todos os registros" tem "Ver mais 12". Peso
   e IMC aparecem no fim, com o mesmo número da Conclusão.
7. **Corpo e Mais**: peso com vírgula, 8 medidas, fotos lado a lado; Mais →
   **Créditos** mostra de onde vem cada ilustração, o mapa muscular (com o
   texto completo da licença MIT) e as fotos dos itens do terraço.

---

## Estado da entrega — v1 (marcos 1–6, SPEC §10) ✅

O estado da **camada visual v2.1** está na seção acima; esta é a do app v1,
mantida como estava. O app está pronto no código. O que falta é **infraestrutura** (criar o projeto
Supabase, publicar na Vercel, instalar no celular) — o passo a passo executável
está no fim desta seção. Nada aqui depende de escrever mais código.

### Critérios de aceite (SPEC §10)

| # | Critério | Como foi verificado | Resultado |
|---|---|---|---|
| 1 | Login com o e-mail permitido; qualquer outro é recusado | `e2e/login.spec.ts` (6 testes) e `e2e/auditoria.spec.ts`: o e-mail de fora é recusado **antes** de qualquer requisição — o mock não recebe nada. Criar conta, entrar, sair, senha errada traduzida e rota protegida sem sessão → `/login` | ✅ contra o mock · **pendente de infra** contra o Supabase real |
| 2 | Perfil semeado de `data/perfil.json`; a Hoje mostra "Treino A · 6 exercícios · 44 min" numa segunda, com 7,5 kg na barra, 1,5 kg por halter e 4 kg no pino | `e2e/hoje.spec.ts` com o relógio fixado em 14/09/2026 (segunda) e o perfil criado pelo trigger do schema | ✅ contra o mock · **pendente de infra** contra o Supabase real |
| 3 | Sessão completa por série no celular sem teclado físico; timer de descanso ao concluir cada série; sobrevive a fechar/reabrir e a ficar sem rede | `e2e/treinar.spec.ts` e `e2e/auditoria-offline.spec.ts`: teclado numérico (`inputMode`), alvos ≥ 44 px medidos um a um, timer disparando, app fechado **sem rede** e reaberto com a sessão inteira, fila subindo ao voltar a rede | ✅ |
| 4 | Sobe no sucesso; 2 falhas seguidas = −10 % e incremento pela metade; 3 falhas = semana leve | `lib/progressao.test.ts` (os 22 casos de `docs/casos-de-teste-progressao.md`, um a um, com barra fixa, elástico, tempo e unilateral) + as 6 rodadas de auditoria adversarial do motor | ✅ |
| 5 | O motor só propõe carga alcançável (26,5 → 25,5) nos três implementos | `lib/montagem.test.ts`: escala inteira varrida (barra maciça 7,5→107,5, halteres 1,5→39,5, pino 0→100), limites de estoque e capacidade | ✅ |
| 6 | Calendário da Fase 1 com A/B alternando pelo último treino; corrida na terça na semana 1 com 8 × (1 min / 2 min) | `lib/calendario.test.ts`, `e2e/calendario.spec.ts` e `e2e/cardio.spec.ts` (o timer de intervalos rodando) | ✅ |
| 7 | Peso, medidas e fotos registrados e comparados; gráficos com 1 e com 30 pontos | `e2e/corpo.spec.ts` e `e2e/auditoria-m5.spec.ts`: 1 ponto, 30 pontos, eixo y com folga, foto de 2400 px redimensionada, subida ao bucket e comparação lado a lado | ✅ |
| 8 | As 81 fichas abrem com figura (ou fotos), músculos destacados, passos e histórico | `e2e/auditoria-m5.spec.ts`: as **81** abertas uma a uma, cada imagem com `naturalWidth > 0` e nenhum 404 | ✅ |
| 9 | `npm run build` sem erros, `npm run lint` limpo, `npm test` verde, PWA instalável, layout correto a 360 px | os quatro portões desta etapa (abaixo); `e2e/pwa.spec.ts` confere manifest, ícones 192/512/maskable e `sw.js`; rolagem horizontal e alvos de 44 px verificados em cada tela | ✅ · **Lighthouse em si: pendente de infra** (não há Chrome com Lighthouse nesta máquina; a última medição local deu PWA instalável e 78 de performance na Hoje) |
| 10 | Deploy na Vercel com as variáveis; instalação como PWA no Android/iPhone | — | **pendente de infra** — passo a passo no "Checklist de infraestrutura" abaixo e no README |

### Os quatro portões (rodados do zero nesta etapa, nesta ordem)

```
npm run lint   limpo (sem avisos)
npm run build  ✓ Compiled successfully in 22.9s · 90 páginas geradas · 25 rotas
npm test       Test Files 29 passed (29) · Tests 747 passed (747)
npm run e2e    151 passed (5.1m) — Chromium 360 × 740
```

Rodados numa janela sozinha (sem build/vitest/playwright concorrente), e o
`npm run e2e` rodado **duas vezes seguidas**, 151/151 nas duas — as duas
instabilidades das etapas anteriores estão resolvidas (abaixo).

- **Unitários: 747** em 29 arquivos (motor, montagem, calendário, sessão,
  agregações, formato, backup, outbox, queries).
- **Ponta a ponta: 151** em Chromium emulando celular (360 × 740), contra
  `scripts/mock-supabase.ts`.
- **Rotas do build** (First Load JS): `/` 320 kB · `/~offline` 104 kB ·
  `/barra-fixa` 324 kB · `/calendario` 333 kB · `/cardio/[id]` 334 kB ·
  `/corpo` 326 kB · `/exercicios` 176 kB · `/exercicios/[id]` 275 kB (SSG, 81
  páginas) · `/login` 118 kB · `/mais` 165 kB · `/mais/backup` 317 kB ·
  `/mais/equipamento` 320 kB · `/mais/perfil` 319 kB · `/mais/preferencias`
  330 kB · `/progresso` 272 kB · `/treinar` 320 kB · `/treinar/[sessionId]`
  344 kB (a maior) · compartilhado 104 kB · middleware 94,9 kB.

### Os dois testes instáveis viraram verdes de verdade

A primeira rodada de portões desta etapa reproduziu as duas instabilidades que
as etapas anteriores tinham registrado como "ruído de ambiente". Nenhuma das
duas era ruído, e nenhum teste foi pulado ou afrouxado para fechar o portão:

1. **`auditoria-m5 › as 81 fichas`** (falhou com "elevacao-lateral: 1 de 3
   imagens carregaram", sem nenhum erro HTTP). As duas fotos da ficha são
   `loading="lazy"` e, num viewport de 360 × 740, podem ainda nem ter começado
   a carregar quando o `load` da página dispara: o teste media uma corrida.
   Agora ele força `loading = "eager"` e espera o `complete` das imagens antes
   de medir (com teto de 10 s, para a mensagem detalhada continuar aparecendo
   se alguma falhar de verdade). `complete` também fica `true` quando a imagem
   falha, então a asserção continua sendo `naturalWidth > 0`. Três rodadas
   isoladas verdes.
2. **`/mais/preferencias › o incremento do agachamento`** — **defeito do app**,
   não do teste. `salvarIncremento()` (`lib/queries/mais.ts`) atualizava o
   cache do TanStack só quando o exercício **já tinha** linha em
   `exercise_state`; no caso mais comum (a primeira vez que se mexe no
   incremento) o cache guardava o estado antigo. Como esse cache é persistido
   no Dexie (§8) e o `staleTime` é de 30 s, recarregar a tela logo depois podia
   mostrar "programa 4 kg · usando 4 kg" com o campo vazio — o valor salvo
   sumia da tela por até meio minuto, embora estivesse gravado. O cache passa a
   receber a linha sintética que o upsert cria no banco (os defaults de
   `exercise_state` em `supabase/schema.sql`). Coberto por
   `lib/queries/mais.test.ts` (3 testes novos).

### Conhecido, não corrigido (consolidado)

Tudo com o motivo; nada disso impede treinar.

**Depende da infraestrutura**

1. **CSP completa** (`script/style/connect/img/worker`): só o `frame-ancestors`
   entrou. Uma CSP de verdade precisa liberar `connect-src` do domínio do
   projeto Supabase (rest, auth, storage, `wss` do realtime) — e o projeto
   ainda não existe. Medir com `Content-Security-Policy-Report-Only` depois do
   deploy e só então forçar.
2. **Lighthouse na Hoje: 78 de performance, LCP 4,3 s.** O shell autenticado
   carrega ~320 kB de JS antes da primeira leitura. Encostar em 90 pede
   renderizar o cabeçalho e o esqueleto no servidor — mexida grande na
   arquitetura, na véspera do deploy. Como o app é instalado e precacheado pelo
   Serwist, o custo real é só na primeira abertura.
3. **`npm audit --omit=dev`: 3 avisos de ferramenta de build** (`browserslist`,
   `postcss` aninhado em `node_modules/next`). Só exploráveis processando CSS
   ou config de terceiros durante o build; `npm audit fix` não muda nada e o
   `postcss` só sai com `next@16` (breaking). Deixar para uma atualização
   planejada do Next depois do deploy.

**Decisões de custo/benefício**

4. **Recordes numa sessão refeita noutro aparelho**: `v_records` já inclui as
   séries daquela sessão, então o resumo do fim não anuncia recordes novos dela.
   Corrigir exigiria varrer `session_sets` de dezenas de exercícios no cliente a
   cada abertura. O erro é para o lado seguro (deixa de anunciar, nunca inventa).
5. **Primeira carga do app sem rede** cai na tela de erro do navegador: o
   service worker ainda não assumiu o controle. Da segunda carga em diante — o
   caso do PWA instalado — tudo abre offline. É o ciclo de vida do SW.
6. **Sem IndexedDB o app não treina** (aba anônima do Firefox): `enfileirar()`
   lança e a tela mostra o erro, mas falta a checagem única na abertura com um
   aviso fixo no shell. No PWA instalado o IndexedDB existe sempre.
7. **Splash de iOS**: o Android usa o manifest (ícone 512 +
   `background_color`); o iPhone precisa de uma `apple-touch-startup-image` por
   tamanho de tela, que não foi gerada — ele abre com a tela preta do
   `background_color`.
8. **Apagar uma foto de progresso pela tela** não existe (o bucket e a tabela
   aceitam; falta o botão).
9. **`<input type="date">` mostra a data no idioma do navegador**: no Chromium
   do CI (en-US) sai `09/14/2026`; num celular em pt-BR sai dd/mm/aaaa. É
   ambiente, não defeito — trocar pelo seletor próprio custaria dois campos
   numéricos novos em Peso e Medidas.
10. **`progression_events.session_id` não é filtrado na importação do backup**
    como `session_sets.session_id` passou a ser: o evento pode existir sem a
    sessão (troca de fase, §5.1) e descartá-lo perderia a linha do tempo da
    §6.6. No banco de verdade a FK recusa sozinha a linha órfã.
11. **O aviso "faltam anilhas de 10 kg"** (diálogo da montagem) continua escrito
    no código: é a etiqueta de uma montagem, não texto de ajuda do motor, e não
    tem chave em `data/progressao.json`. Os avisos do **motor** vêm do JSON.

Quatro itens que constavam desta lista foram corrigidos na etapa "Pendências
das auditorias" e saíram daqui: a aderência agora para em `profiles.fase_desde`
(`lib/progresso.ts`), a sessão de barra fixa guarda `sessions.semana_plano` e é
refeita com a semana em que nasceu, o espaço reservado dos gráficos usa a
altura declarada (`components/graficos/index.tsx`) e `supabase/schema.sql`
terminou com um bloco de migrações idempotentes (`alter table … if not exists`).

**Ruído de ambiente (não é defeito do app)**

16. Rodar dois portões ao mesmo tempo (um `npm run build` durante o `npm run
    e2e`, por exemplo) corrompe a medição. Só vale o portão rodado numa janela
    sozinha. Atenção: `pkill -f "next start"` **não** mata o servidor — o
    processo se chama `next-server`, e as portas 3100/54321 ficam ocupadas por
    órfãos. (As duas falhas que as etapas anteriores atribuíam a esse ruído
    eram reais e foram corrigidas nesta etapa — ver acima.)

---

## Checklist de infraestrutura (passo a passo executável)

Para o dono fazer no ambiente dele, na ordem. Leva uns 30 minutos.

### 1. Criar o projeto no Supabase

1. Abra <https://supabase.com/dashboard> e entre (pode ser **qualquer conta** —
   o app só precisa da URL e da chave; nada está preso ao e-mail da conta).
   A conta `SAV1BOY` já está no limite do plano gratuito (2 projetos ativos:
   `ls-interbank-prod` e `satti-evolution-production`); a conta `miguelsaviotti`
   (sandra.saviotti110772@gmail.com) não tem projeto ativo e serve igual.
2. **New project**: *Name* `treino-terraco`, *Database Password* forte
   (guarde), *Region* **South America (São Paulo)**. Criar e esperar o status
   ficar verde (1–2 min).
3. **Antes de colar o schema, confira o e-mail da constante.** No topo de
   `supabase/schema.sql` tem o bloco **"AJUSTE AQUI"** com
   `public.allowed_email()` devolvendo `miguelgsaviotti29@gmail.com`: é o
   mesmo valor do `ALLOWED_EMAIL` do app. O trigger
   `on_auth_user_email_permitido` recusa qualquer outro e-mail **no banco**,
   então um valor errado aqui trava até o seu login.
4. **SQL Editor → New query**: cole **todo** o conteúdo de
   `supabase/schema.sql` e rode (Ctrl+Enter). Tem que aparecer
   "Success. No rows returned". O arquivo é idempotente: pode rodar de novo
   quantas vezes precisar (só sai aviso de "already exists").
5. Confira em **Table Editor** as 11 tabelas (`profiles`, `sessions`,
   `session_sets`, `exercise_state`, `progression_events`, `cardio_sessions`,
   `pullup_singles`, `body_weights`, `body_measurements`, `progress_photos`,
   `schedule_overrides`) e em **Storage** o bucket `progresso`.
6. **Authentication → Providers → Email**: *Enable Email provider* ligado e
   **Confirm email desligado**. Salvar. (O interruptor *Allow new users to sign
   up* fica **ligado por enquanto** — você ainda vai criar a conta do Miguel na
   etapa **5. Criar a conta e conferir** desta checklist; é lá que ele é
   desligado.)
7. **Project Settings → API**: copie a **Project URL**
   (`https://xxxx.supabase.co`) e a chave **anon public / publishable**
   (`eyJ...` ou `sb_publishable_...`). **Nunca** use a `service_role`.

### 2. Rodar localmente contra o Supabase de verdade (opcional, mas recomendado)

```bash
cp .env.local.example .env.local
# edite .env.local e cole a URL e a chave:
#   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
#   ALLOWED_EMAIL=miguelgsaviotti29@gmail.com
npm install
npm run build && npm start      # http://localhost:3000
```

Na tela de login: um e-mail qualquer tem que ser recusado com "Este app é
pessoal."; com o e-mail permitido, **Criar conta** → a **aba Treino** abre com
o perfil semeado de `data/perfil.json` (critérios §10.1 e §10.2 contra o banco
real). É a tela nova da v2.1: faixa da semana, meta, card do dia com capa e a
lista do treino.

### 3. Publicar na Vercel

1. O código de produção fica em **`main`** no repositório
   **`SAV1BOY/WORKOUT`**. O PR #1 (marcos 1–6 e auditoria final) já foi
   mesclado em 15/09/2026. A **camada visual v2.1** (marcos V1, V2, Mídia e V3,
   as três auditorias e os dois ciclos de correção) está na branch
   `claude/academia-miguel-index-ekvwi0`, no **PR #2** — nada dela chega ao
   celular antes do merge em `main`. **Mescle o PR #2** e espere o deploy de
   produção terminar.
2. O projeto **`treino-terraco`** já existe na Vercel (time
   `saviboys-projects`), vinculado a `SAV1BOY/WORKOUT` com *Production Branch*
   `main`. O build é o `npm run build` do projeto — o `prebuild` roda `validar`
   e `assets`, então as figuras e as fotos vão para `public/` no deploy (a
   pasta é **gerada**, não versionada). O domínio de produção é
   **`https://treino-terraco.vercel.app`**.
   - **Deployment Protection** fica como está (*Standard Protection*): ela
     protege só os links internos de deploy e de preview; o domínio de
     produção abre sem login da Vercel (conferido em 16/09/2026). Use sempre
     o endereço acima no celular.
3. **Variáveis**: em 16/09/2026 elas passaram a ir **versionadas em
   `.env.production`** (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ALLOWED_EMAIL`), porque o conector da
   Vercel desta sessão não cria variáveis no painel. É seguro: a URL e a chave
   anon vão para o navegador de qualquer jeito (são públicas por desenho) e o
   e-mail já está em `supabase/schema.sql`; a `service_role` nunca entra no
   repositório. O Next.js lê o arquivo no `next build` da Vercel. Se um dia
   quiser trocar para variáveis do painel, apague o arquivo e cadastre as três
   em **Production e Preview** (Settings → Environment Variables ou
   `vercel env add`).
4. **Deploy**: cada push em `main` gera o deploy de produção. Para forçar um
   novo, Deployments → ⋯ → Redeploy.

### 4. Fechar o círculo no Supabase

**Authentication → URL Configuration**:

- *Site URL*: `https://SUA-URL.vercel.app`
- *Redirect URLs*: acrescente `https://SUA-URL.vercel.app/**`

Sem isso a volta do login cai no `localhost`.

### 5. Criar a conta e conferir

1. Abra `https://SUA-URL.vercel.app/login` e crie a conta com
   **miguelgsaviotti29@gmail.com**. Qualquer outro e-mail tem que ser recusado
   — na tela, com "Este app é pessoal.", e **no banco**, pelo trigger
   `on_auth_user_email_permitido` (a chave anon é pública, então o bloqueio não
   pode viver só no navegador). Se em vez disso você criar o usuário direto no
   banco (*Authentication → Users → Add user*), com uma **senha temporária**,
   entregue essa senha ao Miguel e peça para ele **trocar a senha em Mais →
   Trocar senha no primeiro acesso**: a tela `/mais/senha` existe justamente
   para isso, e depois dela o painel do Supabase não precisa mais estar ao
   alcance dele.
2. A aba **Treino** abre com o treino do dia e as cargas iniciais (§10.2), e a
   barra de baixo tem as **cinco abas** (Treino · Explorar · Relatório · Corpo ·
   Mais) — se só aparecerem as telas antigas, o PR #2 ainda não foi mesclado ou
   o deploy é anterior a ele.
3. **Com a conta criada, feche a porta**: *Authentication → Sign In /
   Providers* → desligue **"Allow new users to sign up"** e salve. Cinto e
   suspensório: o middleware (`ALLOWED_EMAIL`) já barra o e-mail de fora, o
   trigger do banco também, e agora nem cadastro novo o projeto aceita. Se um
   dia precisar de outra conta, é só religar.
4. `https://SUA-URL.vercel.app/sw.js` tem que responder **200** (é o service
   worker) e `/manifest.webmanifest` também.
5. O roteiro completo do que olhar no celular está em "Como testar no celular
   (v2.1)", no começo deste arquivo.

### 6. Instalar como PWA

- **Android (Chrome)**: menu ⋮ → *Instalar app*.
- **iPhone (Safari)**: Compartilhar → *Adicionar à Tela de Início*.

O ícone laranja aparece como um app e ele abre sem a barra do navegador.

### 7. O teste do terraço (modo avião)

1. Abra o app instalado e fique uns segundos na aba **Treino** (é quando as
   ilustrações e as fotos do seu programa entram no cache).
2. Ligue o **modo avião**.
3. Comece o treino do dia, registre duas séries, feche o app, abra de novo: a
   sessão volta inteira, com as figuras.
4. Conclua o treino ainda sem rede.
5. Desligue o modo avião: em segundos tudo sobe sozinho. Em **Mais** a linha
   *Sincronização* volta a dizer "Tudo sincronizado".

---

## Como rodar tudo localmente

```bash
npm install                 # Node 22, npm 10
npm run lint                # ESLint
npm run build               # valida os JSON, copia os assets e builda
npm test                    # Vitest (987 unitários)
npm run e2e                 # Playwright no celular emulado — exige o build antes
```

Os quatro verdes, nessa ordem, são o portão. `npm run e2e` **não builda**: ele
sobe `next start -p 3100` com o que está em `.next/`, mais o mock do Supabase
na 54321 (ver `e2e/README.md`).

Para ver o app com os próprios olhos **sem projeto Supabase**, dois terminais:

```bash
npm run mock        # o Supabase de mentira na 54321
npm run dev:mock    # next dev já apontando para ele → http://localhost:3000
```

Com `.env.local` preenchido, o normal: `npm run dev`.

## Como testar no celular na rede local

1. Descubra o IP do computador: `hostname -I | awk '{print $1}'` (Linux) ou
   `ipconfig getifaddr en0` (Mac) — algo como `192.168.0.12`.
2. Com `.env.local` preenchido (Supabase de verdade):

   ```bash
   npm run build && npm start -- -H 0.0.0.0
   ```

   e no celular, **na mesma rede Wi-Fi**, abra `http://192.168.0.12:3000`.
3. Sem Supabase, contra o mock, as três variáveis precisam apontar para o
   **IP**, não para `127.0.0.1` (senão o celular não acha o mock):

   ```bash
   npm run mock
   NEXT_PUBLIC_SUPABASE_URL=http://192.168.0.12:54321 \
   NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-anon \
   ALLOWED_EMAIL=miguelgsaviotti29@gmail.com \
   npx next dev -H 0.0.0.0
   ```

4. No celular, confira a 360 px: nenhuma tela rola para o lado e todo alvo é
   tocável com o polegar. O service worker (e portanto "Instalar app") só
   existe no **build de produção** — em `next dev` ele fica desligado.

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

**Defeito que bloqueou o marco** (corrigido na rodada 2, mais abaixo)

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

### Auditoria do marco 3 (rodada 2) — o que mudou

O auditor reprovou o marco pelo defeito bloqueante da rodada 1 (o substituto
sem o próprio estado) e confirmou como corrigido, ainda na auditoria dele, o
problema da folha de montagem + carga digitada (`cargaEmUso` em
`lib/sessao.ts`, `alcancavelParaBaixo` na digitação — nada a fazer aqui além de
manter os testes verdes).

**O substituto passou a usar o próprio estado** (SPEC §6.3)

O buraco era de ponta a ponta: a sessão só carregava `exercise_state` dos
exercícios **do treino** (e, na tela da sessão, nem isso — a consulta ficava
desligada quando a sessão vinha do aparelho), e `tela-sessao.tsx` chamava
`substituirExercicio(..., novoId, null)`, sempre `null`. Com 31,5 kg gravados
no agachamento frontal, trocar o agachamento livre por ele mostrava "Hoje:
7,5 kg na barra" e o fim do treino **sobrescrevia** a linha do banco com 9,5 kg
e `reps_alvo` nulo. O mesmo valia para as séries anteriores (tipo `maximo`) e
para os recordes, que chegavam nulos e faziam qualquer série virar recorde.

- `lib/sessao.ts` ganhou `idsComSubstitutos(ids)` (os blocos mais todos os
  substitutos possíveis de cada um — algumas dezenas de exercícios) e
  `idsQueComparamComAnterior(ids)` (só o tipo `maximo` precisa das séries
  anteriores; o programa nunca muda o tipo do catálogo, então o filtro é o
  `prescricao_padrao.tipo`).
- `components/treinar/tela-sessao.tsx` carrega `exercise_state`, séries
  anteriores e `v_records` **dessa lista ampliada** (as consultas passaram a
  valer também quando a sessão veio do IndexedDB) e passa o estado, as
  `anteriores` e o `recorde` do escolhido em `substituirExercicio`. As séries
  desta sessão são descartadas do cálculo das "anteriores" (`ignorarSessao`),
  senão o `maximo` se compararia consigo mesmo.
- A reconstrução da sessão a partir do banco (outro aparelho) também passou a
  receber `anteriores` e `recordes` — antes reconstruía sem nenhum dos dois.
- **Estado desconhecido não avalia**: `BlocoLocal.estadoConhecido` (e
  `EntradaMontagem.estadoConhecido`) distingue "nunca fez este exercício"
  (`estado: null`) de "não consegui ler `exercise_state`" (offline sem cache).
  Quando é `false`, `avaliarSessao` devolve o bloco como `naoAvaliado` com
  evento nulo, `recordesDoBloco` devolve vazio e `concluirSessao` **não grava**
  `exercise_state` nem `progression_events` daquele bloco — as séries sobem
  para o banco como sempre. Melhor não avaliar do que apagar a progressão.
  `/treinar` marca o mesmo quando começa um treino sem ter lido o estado.
  O teste é com `=== false`: uma sessão gravada no aparelho antes deste campo
  existir continua sendo avaliada.
- O resumo do fim lista, em uma linha, os exercícios que ficaram sem avaliação
  e diz que as séries foram guardadas.

**Testes** (`npm test` 504, `npm run e2e` 71)

- `lib/sessao.test.ts`: o substituto partindo de 31,5 kg e subindo para 33,5
  (com o upsert e o evento saindo de 31,5, e nada escrito no nome do exercício
  que saiu); as séries anteriores e os recordes do substituto chegando ao
  motor; o estado desconhecido não gerando `exercise_state`/`progression_events`
  nem recordes (mas gerando as séries); a sessão antiga sem o campo continuando
  a ser avaliada; `idsComSubstitutos` e `idsQueComparamComAnterior`.
- `e2e/treinar.spec.ts`: com `exercise_state` do agachamento frontal semeado em
  31,5 kg / `reps_alvo` 8, a sessão espera as leituras de `exercise_state` e
  `v_records` **com o id do substituto**, troca o exercício, confere "Hoje:
  31,5 kg na barra" e as três séries pré-preenchidas em 31,5 × 8, conclui com
  "31,5 → 33,5 kg na barra" e confere no banco `carga_atual_kg` 33,5,
  `reps_alvo` 8, o evento saindo de 31,5 e **nenhuma** linha para o
  agachamento livre. O teste falha com o código de antes (mostra 7,5 kg).

### Como testar no celular (auditoria do marco 3, rodada 2)

1. `npm run build && npm run e2e` — **71** testes verdes a 360 × 740
   (`npm test` fecha em 504).
2. À mão, com `npm run mock` + `npm run dev:mock`: grave uma carga no
   substituto antes de começar
   (`curl -X POST localhost:54321/rest/v1/exercise_state …` ou faça um treino
   com ele) e, no treino, toque em "substituir hoje" → "Agachamento frontal":
   o cabeçalho tem de abrir com a carga **dele**, não com 7,5 kg.
3. Conclua no topo da faixa: o resumo parte da carga do substituto e, na Hoje,
   a progressão do exercício original continua exatamente onde estava.

### Auditoria do marco 3 (rodada 3) — o que o auditor achou e o que mudou

Auditoria independente com os quatro portões rodados do zero (`npm run lint`
limpo, `npm run build` sem erro, `npm test` 504/504, `npm run e2e` 71/71), o
código lido e o app dirigido no Chromium a 360 × 740 contra o mock, com sondas
descartáveis em `e2e/` (Fase 2 inteira: `maximo`, unilateral D/E, passos, tempo
com cronômetro, substituição para a barra fixa assistida).

**Confirmado no navegador** (nada disto veio do relatório do construtor):

- §10.4 no **cabeçalho do bloco**, não só na Hoje: com `exercise_state` em
  11,5 kg e o evento semeado, o Treino A abre com "Hoje: 11,5 kg na barra
  (subiu +4 kg no treino de 12/09)" — vírgula decimal, data dd/MM e o rótulo do
  implemento certos.
- Rótulos por implemento em todos os blocos das Fases 1 e 2: "na barra",
  "por halter", "no pino", "peso do corpo"; `REPS (D)`/`REPS (E)` nos quatro
  unilaterais, `PASSOS` no farmer's walk, `SEGUNDOS` com cronômetro na prancha
  e os quatro degraus do elástico na barra fixa assistida (por substituição).
- Aquecimento só no primeiro `composto_pesado` do treino (também na Fase 2:
  militar no SB, terra no IB) e fora da conta do rodapé.
- A 360 px, em `IB` (o treino mais cheio): **nenhum** alvo abaixo de 44 px em
  nenhum bloco e nada rolando para o lado.
- O peso opcional do fim chega ao banco com vírgula decimal (84,3 → 84.3 em
  `body_weights`).
- Nenhuma regra de progressão dentro de `app/` ou `components/` (a única
  constante numérica é o `incremento_kg` que vem do `AlvoDeHoje`), nenhum
  `console.log`, nenhum `any`, nenhum `@ts-expect-error`, nenhum teste pulado.

**Dois defeitos corrigidos nesta auditoria:**

1. **O cronômetro desfazia o que era registrado enquanto ele corria**
   (SPEC §3.2 e §8 — "nunca perder um registro"). O `setInterval` de
   `CampoTempo` fechava sobre o `aoMudar` da renderização em que foi ligado, e
   esse `aoMudar` carrega a **sessão inteira** daquele instante (cada toque
   devolve uma sessão nova). Com o cronômetro da prancha correndo, marcar
   qualquer série — de outro bloco ou da própria prancha — voltava a "não
   feita" 250 ms depois, e o rodapé voltava a "0/20 séries": o visto sumia da
   tela e do IndexedDB, mas a série já tinha subido para `session_sets` com
   `concluida = true`. No fim do treino o motor decidiria sobre uma série que o
   banco diz que foi feita. Reproduzido no Chromium antes da correção (o visto
   nunca ficava marcado). O tique passou a chamar sempre o `aoMudar` da última
   renderização (ref) — o que também apagou o único
   `eslint-disable react-hooks/exhaustive-deps` do app — e marcar a série agora
   **para** o cronômetro: o número que subiu para o banco é o que fica na tela.
2. **"+30 s" recomeçava o descanso em vez de somar 30 s** (SPEC §3.2). O efeito
   do timer recalculava `fim = agora + (base + extra)` toda vez que `extra`
   mudava, jogando fora o tempo já decorrido: a 2:26 de um descanso de 2:30 o
   botão levava a **3:00**, e a 0:10 do fim levaria a 3:00 também. Só não
   aparecia nos testes porque eles clicavam o botão com o relógio parado no
   começo da contagem. Agora o componente guarda o **instante do fim** e o
   "+30 s" empurra esse instante (e reabilita o aviso, se o descanso já tinha
   zerado): 2:00 + 30 s = 2:30.

**Testes acrescentados** (`npm test` 504, `npm run e2e` **72**):

- `e2e/treinar.spec.ts` > "o cronômetro rodando não desfaz o que foi marcado":
  na Fase 2 (Inferior A), com o cronômetro da prancha ligado, marca uma série
  do agachamento e confere que ela continua marcada e que o rodapé conta
  "1/20 séries"; depois marca a própria série da prancha, confere que o
  cronômetro parou (o campo não muda mais) e que o `tempo_s` cronometrado
  chegou a `session_sets`. Falha com o código de antes.
- `e2e/treinar.spec.ts` > o teste do descanso ganhou o caso do "+30 s" no meio
  da contagem (1:00 corrido → 2:00 → +30 s → **2:30**, não 3:00).

**Anotado, sem correção** (não bloqueia):

- `reconstruirSessao` (sessão refeita a partir do banco, outro aparelho) lê os
  recordes **depois** de as séries desta sessão já terem subido, então nada
  conta como recorde novo no resumo. Só acontece quando o aparelho perde o
  IndexedDB no meio do treino.
- As séries já gravadas do exercício **original** continuam em `session_sets`
  depois de uma substituição (segue da rodada 1).
- O cronômetro grava no IndexedDB a cada 250 ms enquanto corre; é barato, mas
  vale um `throttle` se a prancha de 2 min ficar pesada no celular antigo.

### Como testar no celular (auditoria do marco 3, rodada 3)

1. `npm run build && npm run e2e` — **72** testes verdes a 360 × 740
   (`npm test` fecha em 504).
2. À mão, com `npm run mock` + `npm run dev:mock`, na Fase 2 (Inferior A):
   ligue o cronômetro da prancha, marque uma série do agachamento e espere
   alguns segundos — o visto tem de continuar marcado. Marque a série da
   prancha: o cronômetro para no número que foi para o banco.
3. Num descanso qualquer, espere passar meio minuto e toque em "+30 s": o
   relógio tem de ganhar 30 segundos, não voltar ao tempo cheio.

---

## Marco 4 — Cardio e barra fixa ✅

As duas telas que faltavam do plano semanal (SPEC §3.3 e §3.4): o timer de
intervalos da corrida e da corda, o cronômetro da caminhada, o registro em
`cardio_sessions`, o plano de 12 semanas da primeira barra fixa com a sessão da
semana e as repetições soltas do grease the groove — mais a regra das semanas
(§5.5) avançando sozinha.

### O que foi feito

**Adaptadores puros (com testes)**

- `lib/cardio.ts` — o plano da sessão virado em blocos de tempo e o relógio do
  timer como dado:

  ```ts
  planoDeCorrida(semana) · planoDeCorda(semana) · planoDeCardio(tipo, semana)
  // PlanoCardio = { tipo, semana, titulo, descricao, blocos, totalS,
  //                 repeticoes, sessaoMin, paceAlvo, kmTotal, saltosAprox, notas }
  // BlocoCardio = { indice, tipo, rotulo, voz, segundos, serie, trabalho }
  textoDoPlano · TIPOS_DE_CARDIO · ehTipoDeCardio
  timerInicial · avancar · pularBloco · pausar · retomar
  decorridoNoBloco · decorridoTotal · restanteDoBlocoS · restanteTotalS
  trabalhoCumprido · planejadoDaSessao · feitoDaSessao · duracaoEmMinutos
  saltosEstimados · niveisDeEsforco
  avancoDeSemana · sessoesDaSemanaCivil · CAMPO_DA_SEMANA · chaveDoAvanco
  ```

  O `EstadoTimer` é **dado puro** (`indice`, `acumuladoS`, `desdeMs`,
  `cumpridos`, `anterioresS`, `terminado`), e o "agora" entra por parâmetro:
  é isso que faz o timer caber no IndexedDB e sobreviver a recarregar a página.
  `avancar()` recalcula quantos blocos passaram desde a última vez — uma recarga
  no meio da corrida pode ter deixado quatro blocos para trás.
- `lib/barra-fixa.ts` — a tabela das 12 semanas (`linhasDoPlano`), a prescrição
  da sessão da semana lida de `por_sessao` ("4 × 5" → 4 séries de 5;
  "5 × máximo" → o tipo `maximo` do motor), `itemDaSessao(semana)` (o que a
  sessão de força precisa) e as soltas (`somarSoltas`, `historicoDeSoltas` de 14
  dias, `intervaloDoHistorico`, `soltasDaSemana`, `sessoesDeFixaNoIntervalo`).
- `lib/formato.ts` ganhou `formatarDescanso` (90 → "90 s", 150 → "2 min 30 s").

**Telas**

- `/cardio/[id]` com `id` = `corrida | corda | caminhada | outro` (`?semana=`
  para uma semana específica, `?sessao=` para abrir uma sessão já registrada):
  - **Corrida**: `TimerIntervalos` com os blocos da semana do plano
    (`profiles.semana_corrida`) — aquecimento em caminhada, os pares
    corrida/caminhada e a soltura. Bloco atual grande com cor por tipo (destaque
    para corrida/corda, contraste para caminhada/descanso), próximo bloco
    visível, tempo total restante, barra de progresso, **voz** pt-BR
    (`speechSynthesis`: "corrida", "caminhada") e **vibração** na troca,
    pausar / retomar / pular bloco e a tela acesa (Wake Lock) enquanto corre.
  - **Corda**: blocos × duração com o descanso do estágio da semana
    (`profiles.semana_corda` → estágio de `cardio.json`) e os saltos
    aproximados do plano na finalização.
  - **Caminhada leve / outro**: cronômetro simples, só duração e nota.
  - **Encerrar**: distância em km com vírgula (corrida), saltos (corda), o
    **teste da fala** com os textos do JSON (fácil / moderado / forte) e uma
    nota → `cardio_sessions` com `{tipo, semana_plano, planejado, feito,
    duracao_min, distancia_km, saltos, esforco, concluida, notas}` pela fila de
    saída, upsert por `id`.
- `/barra-fixa`: o card da semana (assistência, `4 × 5`, o que ela treina) com
  "Fazer sessão de barra fixa", o contador de soltas do dia e da semana com o
  "+1" de 56 px e o histórico em barras dos últimos 14 dias, e a tabela das 12
  semanas com a faixa atual destacada (`aria-current`) e a regra do JSON.

**A sessão de barra fixa é uma sessão de força**

`lib/sessao.ts` foi partido em dois: `montarSessao(treino)` continua igual e
agora delega para `montarSessaoAvulsa({ workoutId, itens })`, que monta os
blocos a partir de uma lista de `ItemDaSessao` em vez do `programa.json`. A
sessão da barra fixa é `workout_id = 'fixa'` com um item só ("Barra fixa
assistida") nas séries/reps da semana; o motor avalia normalmente (a progressão
do exercício é `assistencia`, e nas semanas 11–12 a prescrição vira `maximo`).

**Persistência (§8)**

- `lib/db.ts` ganhou a tabela `cardioAtivo` (Dexie v2; as tabelas da v1 não
  mudaram). `lib/queries/cardio.ts` guarda a sessão com o mesmo debounce de
  60 ms da sessão de força, com descarga em `pagehide`/`visibilitychange` e ao
  encerrar; `encerrarCardio()` monta a linha e a manda para a fila.
- `lib/queries/dados.ts`: `useSoltas(de, ate)` (histórico de 14 dias) e
  `useCardioPorId(id)` (o calendário abrindo um dia que já passou).

**Semanas dos planos (§5.5)**

`avancoDeSemana()` é puro e **idempotente**: além das 2 sessões concluídas na
semana civil, ele carimba a segunda-feira daquela semana em
`profiles.prefs.avanco_<plano>_em`. Assim a corrida/corda avança ao encerrar a
segunda sessão e a barra fixa avança quando a tela conta 2 sessões `fixa`
concluídas — sem nunca empurrar o plano duas vezes na mesma semana. Em
`lib/queries/perfil.ts` ficaram prontas, para o marco 6: `ajustarSemana` (pura,
±1 presa entre 1 e o teto), `gravarPerfil`, `repetirSemana`, `avancarSemana` e
`aplicarAvanco`.

### Decisões

- **A rota do cardio é por TIPO, não por data nem por id de sessão.** A Hoje
  linka `/cardio/corrida?semana=1` (ou `/cardio/corda` quando o Miguel troca no
  card) e o calendário, para um dia que já passou, linka
  `/cardio/corrida?sessao=<uuid>` — que abre o resumo só leitura. `lib/semana.ts`
  passou a devolver `sessaoTipo` na grade para isso.
- **A sessão nasce parada.** Chegar na tela não começa a correr: o botão grande
  diz "Começar" e só o toque põe o relógio para andar. Voltar depois continua de
  onde parou.
- **O relógio é um alvo em milissegundos, não uma soma de ticks.** Com a tela
  apagada o navegador atrasa o `setInterval`; somar ticks daria uma corrida mais
  longa que a pedida. `avancar()` recalcula tudo a partir de `Date.now()`.
- **"Pular bloco" não conta o bloco como cumprido**; o tempo que ele já correu
  conta na duração. É o que faz `feito.repeticoes_cumpridas` ser honesto.
- **A corda não ganha aquecimento inventado.** O `sessao_min` do JSON (13 min no
  estágio 1) inclui ~5 min de aquecimento/soltura que o plano não detalha em
  blocos; o timer mostra só os blocos que existem no JSON e o card continua
  mostrando o `sessao_min` do plano.
- **A assistência da barra fixa continua sendo do motor.** A coluna
  "assistência" das 12 semanas é texto do guia e aparece na tela como
  orientação; quem muda `exercise_state.assistencia` é a §6.3, não o plano —
  senão o plano e o motor brigariam a cada sessão.
- **`sessions.workout_id` aceita `'fixa'`** (a coluna é `text`; o comentário do
  `supabase/schema.sql` foi atualizado). `concluirSessao()` só move
  `profiles.ultimo_treino` para treinos do programa — `ehTreinoDoPrograma()`.
- **Reconstruir a sessão de barra fixa exige os itens.** O `programa.json` não
  tem esse treino: `reconstruirSessao()` recebe `itens` da tela (montados de
  `profiles.semana_fixa`) e, sem eles, devolve `null` em vez de inventar uma
  sessão diferente da registrada.

### Testes

- **Unitários** (`npm test`, 555): `lib/cardio.test.ts` (30) e
  `lib/barra-fixa.test.ts` (13) novos — os blocos da semana 1 (aquecimento 5 +
  8 × (1/2) + soltura 5 = **34 min**), as 12 semanas batendo com o `sessao_min`
  do JSON, a semana 8 sem bloco vazio, o estágio da corda, o relógio (troca de
  bloco, recarga com vários blocos de uma vez, pausar/retomar, pular, fim), o
  `planejado`/`feito`, os saltos, o teste da fala e o avanço de semana com 0, 1
  e 2 sessões, a idempotência da marca em `prefs` e o teto do plano. Mais a
  sessão avulsa em `lib/sessao.test.ts` (4), o `sessaoTipo` da grade em
  `lib/semana.test.ts` (1), `ajustarSemana` em `lib/queries/perfil.test.ts` (2)
  e `formatarDescanso` em `lib/formato.test.ts` (1).
- **E2E** (`npm run e2e`, 78): `e2e/cardio.spec.ts` (6) — da Hoje em
  15/09/2026 até a linha no mock: o link `/cardio/corrida?semana=1`, os 18
  blocos do plano (1:00 de corrida, 2:00 de caminhada), o timer parado em 5:00,
  `page.clock.runFor` andando pelo aquecimento e pela corrida 1, pausar
  congelando o número, pular indo para o bloco 2, e a `cardio_sessions` gravada
  com `planejado.total_s = 2040`, `feito.repeticoes_cumpridas = 1` e
  `esforco = 'facil'`; a sobrevivência do timer a um `reload`; as 2 sessões da
  semana civil virando `semana_corrida = 2`; a corda com 11 blocos e a caminhada
  como cronômetro; e `/barra-fixa` com a semana 1 destacada, o "+1" gravando
  duas linhas em `pullup_singles` e a sessão `workout_id = 'fixa'` com
  "0/4 séries".

### Um teste antigo que este marco consertou

`e2e/hoje.spec.ts` > "recarregar sem rede…" e "a leitura é guardada no
IndexedDB" não fixavam a data ("o cache é salvo por um `setTimeout`, que o
`page.clock.install` congela"). Os dois só passavam quando o **dia real** era de
força: rodando numa terça (15/09/2026) a Hoje mostra o card de corrida e o
"Começar treino" não existe. Passaram a usar `fixarData`
(`page.clock.setFixedTime`), que fixa a data **sem** congelar os timers — é
exatamente o que a fixture do marco 3 existe para fazer.

### O que falta

- Marco 5: catálogo e ficha (§3.6), progresso (§3.7) e corpo (§3.8).
- Marco 6: o perfil (§3.9) com "repetir semana" / "avançar semana" ligados em
  `lib/queries/perfil.ts`, a troca de degrau do elástico à mão, equipamento e
  backup.
- A **voz** do timer é lida de `profiles.prefs.cardio_voz` (ligada por padrão) e
  a vibração de `prefs.descanso_vibra`; o interruptor das duas na tela é do
  marco 6, junto com as outras preferências.
- A sessão de cardio só vai para o banco no "Encerrar": fechar o app no meio
  deixa tudo no IndexedDB (e voltar para `/cardio/<tipo>` retoma), mas o
  Supabase não vê a sessão até ela terminar.
- `/cardio/<tipo>?sessao=<id>` mostra o resumo em lista; quando o §3.7 entrar,
  vale mostrar ali o gráfico da evolução do plano.

### Como testar no celular (marco 4)

1. `npm run build && npm run e2e` — 78 testes verdes a 360 × 740
   (`npm test` fecha em 555).
2. À mão: `npm run mock` num terminal e `npm run dev:mock` no outro (troque
   `127.0.0.1` pelo IP do computador nas três variáveis para abrir pelo
   celular). Entre com `miguelgsaviotti29@gmail.com`.
3. Numa **terça**, a Hoje mostra "Corrida · semana 1 · 8 × (1 min corrida /
   2 min caminhada) · 34 min". Toque em "Começar": a tela abre parada no
   aquecimento de 5:00, com os 18 blocos listados embaixo.
4. Toque em "Começar" de novo: o relógio anda. Na troca de bloco o celular
   **vibra** e a voz fala "corrida" / "caminhada" (com o volume ligado). A tela
   não apaga. "Pausar" congela; "Pular bloco" passa para o próximo sem contar o
   atual.
5. Saia do app e volte (ou recarregue a página): a sessão continua de onde o
   relógio está — inclusive se vários blocos passaram.
6. "Encerrar e registrar": informe a distância (vírgula decimal), escolha o
   teste da fala e salve. Volte ao **calendário** e toque na terça: "Abrir o
   cardio" mostra duração, blocos cumpridos, distância e esforço.
7. Faça a segunda corrida da mesma semana civil: ao salvar aparece "Semana 2 do
   plano liberada" e a Hoje passa a mostrar a semana 2.
8. Em **Barra fixa**: a faixa "1–2" fica destacada na tabela; "+1" sobe o
   contador do dia na hora (ligue o modo avião antes: o número sobe igual e a
   linha chega ao mock quando a rede voltar) e a barra do dia cresce no
   histórico de 14 dias. "Fazer sessão de barra fixa" abre a sessão de força com
   um exercício só, 4 × 5, e ao concluir o motor decide a assistência.

## Auditoria do marco 4 (rodada 1) ✅

Conferência independente do marco 4, feita lendo o código e **usando o app** no
Chromium a 360 × 740 contra o mock (`scripts/mock-supabase.ts`).

### Os quatro portões

`npm run lint` limpo · `npm run build` compila (18 rotas) · `npm test` **556** ·
`npm run e2e` **84** (eram 78: seis testes novos, nenhum desabilitado).

### O que foi conferido de verdade

- **§10.6** — terça 15/09/2026: a Hoje mostra "Corrida · semana 1 · 8 × (1 min
  corrida / 2 min caminhada) · 34 min" e o "Começar" leva a
  `/cardio/corrida?semana=1`; o timer abre **parado** em 5:00 com os 18 blocos
  (aquecimento 5 min, 8 × 1:00/2:00, soltura 5 min). A troca de bloco **vibra**
  (`navigator.vibrate`) e **fala** em pt-BR ("corrida", "caminhada") — provado
  com espiões no `e2e/cardio.spec.ts`, e nada é falado só por abrir a tela.
  Pausar congela o número, retomar volta, pular passa o bloco sem contá-lo; o
  `cardio_sessions` grava `planejado.total_s = 2040` e
  `feito.repeticoes_cumpridas` honesto.
- **Corda e caminhada** — `semana_corda = 7` abre o estágio "6 × 120 s de corda
  (60 s de descanso)" e `?semana=1` volta para "6 × 30 s"; caminhada e "outro"
  são cronômetro simples. O "Fazer corda em vez de corrida" da Hoje troca o card
  e o "Começar" passa a apontar para `/cardio/corda?semana=…`.
- **§5.5** — testado com 0, 1 e 2 sessões na semana civil, para corrida e para
  barra fixa: com 1, `semana_corrida`/`semana_fixa` fica onde estava; com 2,
  sobe exatamente um degrau (a marca em `prefs.avanco_<plano>_em` impede o
  segundo empurrão na mesma semana).
- **§3.4** — a tabela vem inteira de `data/cardio.json` (6 faixas × 12 semanas),
  a faixa da vez tem `aria-current`, "Fazer sessão de barra fixa" cria
  `workout_id = 'fixa'` com um exercício só em 4 × 5, e o "+1" grava em
  `pullup_singles` com o total do dia/semana e o histórico de 14 dias.
- **§8** — recarregar no meio da corrida continua no bloco certo; sem rede o
  "Encerrar" volta para a Hoje, o banco continua vazio e a sessão sobe sozinha
  quando a rede volta.
- **Celular** — a 360 px, `/cardio/corrida`, `/cardio/corda`, `/cardio/caminhada`
  e `/barra-fixa` não rolam para o lado e **nenhum** alvo clicável fica abaixo
  de 44 px; a nav inferior não cobre conteúdo.
- **Conteúdo** — varredura em `app/`, `lib/` e `components/`: nenhum exercício,
  série, regra ou texto do guia copiado para o código; nenhum `any`,
  `console.log`, `TODO` ou `eslint-disable` sem justificativa.

### O que a auditoria consertou

1. **A sessão refeita noutro aparelho fixava "última firme: não"** (era o
   problema sério). `session_sets.ultima_firme` é gravado a cada série com o
   padrão **daquele instante** — quando a série 1 sobe, as outras ainda nem
   foram feitas, então vai `false`; só a conclusão grava o valor final.
   `reconstruirSessao()` herdava esse retrato parcial, e um treino refeito noutro
   celular (ou com os dados do site limpos) entrava com o toggle em "não" — o
   motor **repetia a carga em vez de subir**. Agora a sessão `em_andamento`
   volta com `ultimaFirme = null` e a tela recalcula o padrão; a sessão já
   terminada continua honrando o que está gravado. Coberto por
   `lib/sessao.test.ts` e por um e2e com dois aparelhos.
2. **`Esforço: facil`** aparecia cru na sessão de cardio registrada; agora sai o
   texto do JSON ("fácil", "moderado", "forte").
3. **No fim do plano, "Retomar" e "Pular bloco" não faziam nada** e continuavam
   na tela. Somem quando o timer termina — sobra "Encerrar e registrar".

### Testes novos (e2e)

`e2e/cardio.spec.ts` ganhou seis: a voz/vibração na troca de bloco, 1 corrida na
semana civil **não** avançando o plano, o "Encerrar" sem rede (caso de erro), o
calendário abrindo a corrida registrada com o esforço em pt-BR, 1 × 2 sessões de
barra fixa na semana civil e a sessão de fixa refeita noutro aparelho.

### O que fica para depois (não bloqueia o marco)

- Caminhada leve e "outro" mostram, no fim, "Distância (opcional)" e o teste da
  fala; a SPEC §3.3 pede "só duração e nota". Os campos são opcionais e não
  atrapalham, mas dá para enxugar no marco 6.
- O teto das semanas de corda e de barra fixa está como `12` no código
  (`lib/calendario.ts`, `lib/queries/perfil.ts`) em vez de ser lido da última
  faixa do JSON ("9–12", "11–12").
- `prescricaoDaSemana()` corta `por_sessao` em `/×|x/`: "5 × máximo" só cai no
  ramo certo porque "má**x**imo" tem um "x". Funciona, mas é frágil.
- Uma sessão de barra fixa antiga, refeita noutro aparelho, é remontada com a
  prescrição da semana **de hoje**, não com a da semana em que foi criada.

---

## Marco 5 — Catálogo, progresso e corpo ✅

As três telas que faltavam (SPEC §3.6, §3.7 e §3.8): o catálogo dos 81
exercícios com a ficha completa, a tela de progresso com os gráficos e a tela
do corpo com peso, medidas e fotos.

### O que foi feito

**Agregações puras (com testes)**

Nenhuma conta mora na tela. Três módulos novos, sem React, Supabase ou Dexie:

- `lib/catalogo.ts` — a busca e os filtros da §3.6:
  ```ts
  semAcento(texto) · idsDoPrograma() · treinosDoExercicio(id)
  filtrarExercicios(lista, filtros, doPrograma) · temFiltro · opcoesDoCatalogo()
  itemDoCatalogo(exercicio) · NOME_IMPLEMENTO · NOME_EQUIPAMENTO
  ```
  A busca casa **todas** as palavras digitadas contra o nome sem acento
  ("triceps" acha "Tríceps", "supino reto" acha o supino reto). Os filtros se
  somam; "está no meu programa" cruza com os `exercicio_id` de `programa.json`.
- `lib/progresso.ts` — as contas da §3.7, todas a partir das linhas cruas:
  ```ts
  datasDasSessoes · dataDaSerie · semanasAte · rotuloDaSemana
  serieDeTrabalho · repsDaSerie · volumeDaSerie · volumePorSemana · volumeDaSemana
  treinosConcluidos(sessoes, hoje) · aderencia({hoje, perfil, overrides, …})
  cargaPorSessao(series, porSessao, id) · e1rmEpley · sessoesDoExercicio
  idsDeBarraFixa · barraFixaPorSemana · minutosCorrendo · corridaPorSemana
  recordesRecentes · ordenarRecordes · diasDesde
  ```
- `lib/corpo.ts` — as contas da §3.8:
  ```ts
  pontosDePeso · mediaMovel(linhas, 7) · variacaoPorSemana · ultimoPeso
  metaDePeso(prefs) · faltaParaMeta · diasDesdeAPesagem
  MEDIDAS (os 8 campos) · serieDeMedida · medidasPorData · variacaoDaMedida
  ANGULOS · caminhoDaFoto(userId, data, angulo) · fotosPorData
  parDeComparacao · angulosEmComum · dimensoesReduzidas(w, h, 1600)
  ```

**Telas**

- `/exercicios` (server) + `components/exercicios/lista-exercicios.tsx`
  (client): campo de busca com limpar, três seletores (grupo, implemento,
  equipamento), o botão "No meu programa" e a contagem viva ("12 de 81
  exercícios"). Cada card tem a figura (ou a primeira foto) em 56 px, nome,
  grupo · equipamento, a prescrição padrão e a etiqueta "no programa".
- `/exercicios/[id]` (server, **`generateStaticParams` com os 81 ids** — o
  build mostra `● (SSG)` e as 81 rotas): figura animada, as duas fotos (toque
  abre em tela cheia), mapa muscular com os nomes, equipamento, montagem,
  passos numerados, erro comum, prescrição padrão, carga inicial com o rótulo
  do implemento e a regra de progressão — **todo o texto vem do JSON**.
- `components/exercicios/historico-exercicio.tsx` (client) fecha a ficha com o
  histórico: "onde você está" (o `AlvoDeHoje` de `cargaDeHoje`, que já aplica os
  fallbacks da §6.1), o recorde da `v_records` (carga, reps e e1RM de Epley),
  o gráfico carga × data (reps × data quando o exercício não tem carga), as
  últimas 10 sessões com as séries feitas e a linha do tempo dos
  `progression_events` ("subiu +2 kg no treino de 14/09", §6.6).
- `/progresso` (client): quatro cards (treinos na semana/mês/total, aderência
  das últimas 4 semanas, volume da semana, recordes dos últimos 30 dias), a
  lista de recordes recentes, um gráfico de carga por sessão para cada um dos
  três grandes + desenvolvimento militar, volume semanal (12 semanas), barra
  fixa por semana (séries + soltas, barras empilhadas), corrida (minutos
  correndo e km por semana) e a tabela de recordes da `v_records`. No topo, o
  link para o catálogo — é por ele que se chega em `/exercicios` (o item
  "Progresso" do rodapé já acendia nessa rota desde o marco 1).
- `/corpo` (client) com abas **Peso · Medidas · Fotos**:
  - **Peso**: data (padrão hoje) + kg com vírgula, `unique (user_id, data)` →
    upsert; gráfico do peso com a média móvel de 7 dias **de calendário**;
    variação por semana civil; meta opcional guardada em `profiles.prefs.meta_peso`.
  - **Medidas**: os 8 campos em cm com a dica de onde passar a fita, upsert por
    data, seletor de medida + gráfico e a tabela dos últimos 12 registros.
  - **Fotos**: frente/lado/costas por data, reduzidas para ≤ 1600 px no próprio
    aparelho (`lib/imagem.ts`, canvas → JPEG 0,82), galeria por dia e a
    comparação de duas datas com `input[type=range]` e `clip-path`.

**Gráficos**

`components/graficos/grafico.tsx` (Recharts) tem os dois desenhos que o app
usa — linha e barras — com as cores do tema, eixo x ralo (uns 6 rótulos a
360 px), dica de toque em pt-BR e `isAnimationActive={false}`. Funcionam com
**1 ponto e com 30** (critério §10.7). `components/graficos/index.tsx` carrega
esse módulo com `next/dynamic` (`ssr: false`), e `apoio.tsx` tem o que não
depende da biblioteca (legenda e "sem dados"): o Recharts sozinho valia 110 kB
na primeira carga da ficha (462 → 352 kB).

**Fotos: do canvas ao bucket, sem perder nada (§3.8 + §8)**

1. A tela reduz a imagem e guarda o **blob no Dexie** (`bd().fotos`, v3 do
   banco local, chave = o caminho no bucket).
2. A fila de saída recebe dois itens: o envio do arquivo
   (`enfileirarArquivo`, tipo `foto`) e o upsert da linha em `progress_photos`.
3. `lib/outbox-supabase.ts` ganhou o ramo de Storage: lê o blob do Dexie, sobe
   com `upsert: true` e **só então** apaga o blob local. Se o app fechar no
   meio, o blob continua lá e a fila tenta de novo.
4. A galeria mostra a foto na hora pelo blob local; depois que ela sobe, a URL
   vem assinada (`createSignedUrl`, 1 h) do bucket privado.

**Leituras**

- `lib/queries/progresso.ts`: `useSessoesTodas()` (500 sessões), 
  `useSeriesDesde(de)` (as séries da janela de 12 semanas), 
  `useSeriesDoExercicio(id)` e `useTodosOsRecordes()` (`v_records`).
- `lib/queries/corpo.ts`: `usePesos`, `useMedidas`, `useFotos`,
  `useUrlsDasFotos` (blob local ou URL assinada) e as escritas
  `registrarPeso`, `registrarMedidas`, `enviarFoto` — todas pela fila.

### Decisões

- **As contas ficam em `lib/*.ts` puro; `lib/queries/*` só busca linha.** O
  pedido do marco era "consultas por agregação em `lib/queries/progresso.ts`
  com funções puras testadas": as consultas estão lá, e as agregações em
  `lib/progresso.ts` — importar o módulo de agregação num teste do Vitest não
  arrasta o TanStack Query nem o cliente do Supabase.
- **A data de uma série vem da sessão** (`sessions.data`), não de
  `registrada_em`: o mock (e o PostgREST) não fazem `select` embutido, então a
  tela lê as sessões e as séries em duas consultas e cruza os ids na memória.
  Sem a sessão na janela, vale o dia de `registrada_em` — que é sempre dela.
- **Volume conta os dois lados do unilateral** (Σ (reps + reps_lado2) × kg) e
  **não conta peso do corpo** (0 kg × reps = 0), como a §3.7 define.
- **Aderência = dias, não sessões**: para cada dia das últimas 4 semanas,
  `lib/calendario.semanaDoPlano` diz se era força ou cardio (descanso não
  conta), e o dia é "feito" se houver sessão concluída (ou cardio concluído)
  naquela data. Dias antes de `profiles.data_inicio` e dias no futuro ficam
  fora: o que ainda não aconteceu não é falta.
- **"Recorde recente" é o recorde que NASCEU na janela.** Para cada exercício
  se acha o melhor valor de todas as séries e o **primeiro** dia em que ele
  apareceu; repetir a mesma carga não vira recorde novo.
- **Minutos correndo saem dos blocos de corrida do `feito`** (o timer do marco
  4 grava bloco a bloco); sem blocos — sessão importada, caminhada
  cronometrada — cai na duração total.
- **A média móvel do peso é de 7 dias de calendário**, não das 7 últimas
  pesagens: quem pesa três vezes numa semana e some duas não vê a linha mentir.
- **Um gráfico por grande, não quatro linhas num só.** A 360 px quatro séries
  com datas diferentes viram rabisco; quatro gráficos de 140 px, cada um com a
  carga atual ao lado do nome, se leem de relance.
- **A ficha é estática e o histórico é client.** O layout autenticado continua
  `force-dynamic` (ele lê cookies), mas a página do exercício declara
  `generateStaticParams` e o build a prerenderiza para os 81 ids; o `middleware`
  continua mandando quem não tem sessão para `/login` (tem teste e2e).
- **A foto é guardada como JPEG**, sempre com o caminho
  `<user_id>/<data>-<angulo>.jpg` da policy do bucket: trocar a foto do mesmo
  dia e ângulo substitui o arquivo e reaproveita a linha em `progress_photos`
  (não existe `unique` nessa tabela — quem casa é o caminho).

### Um defeito do mock que este marco expôs

`scripts/mock-supabase.ts` guardava o **corpo cru** do upload. O supabase-js
manda o arquivo do navegador dentro de um `multipart/form-data` (um campo de
`cacheControl` e o arquivo); o Storage de verdade desembrulha e guarda só o
arquivo, com o tipo dele. O mock guardava o envelope inteiro e devolvia
`content-type: multipart/form-data` — a foto baixava "com sucesso" e nenhum
navegador a decodificava (`naturalWidth === 0`). Entrou `extrairDoMultipart()`,
com teste no contrato do mock (`e2e/mock.spec.ts`).

### Um teste antigo que este marco consertou

`e2e/treinar.spec.ts` > "fechar o app sem rede e abrir de novo" supunha que
**um `reload` bastava** para o service worker estar no controle. Não basta:
enquanto o precache não fecha, `navigator.serviceWorker.controller` é `null` e
a aba nova morre em `ERR_INTERNET_DISCONNECTED` sem nem chegar ao SW. O teste
passava por sorte e quebrou quando o precache cresceu com as telas deste marco.
Entrou a fixture `esperarServiceWorker(page)` (espera o controller aparecer —
uns 800 ms) e o teste passou a usá-la antes de cortar a rede. Nenhuma asserção
foi afrouxada.

### Testes

- **Unitários** (`npm test`, **612**): `lib/catalogo.test.ts` (13),
  `lib/progresso.test.ts` (26) e `lib/corpo.test.ts` (17) novos — a busca sem
  acento, os filtros somados e a conta do "no meu programa" contra
  `programa.json`; volume por semana (inclusive as vazias), unilateral e peso
  do corpo, aderência com dia trocado para descanso e com sessão abandonada,
  carga por sessão com 1 ponto, e1RM, as últimas sessões agrupadas, barra fixa
  (séries + soltas), minutos correndo com e sem blocos, recorde recente que
  nasceu antes da janela; média móvel de 7 dias de calendário, variação por
  semana, meta, as 8 medidas, o agrupamento das fotos, o par da comparação e o
  redimensionamento para 1600 px.
- **E2E** (`npm run e2e`, **99**): `e2e/catalogo.spec.ts` (5) — a lista com os
  81, a busca "triceps", a ficha com figura, as duas fotos, frente e costas do
  mapa, passos, prescrição e carga inicial; a foto em tela cheia; o filtro "no
  meu programa" batendo com `programa.json`; a rota protegida sem sessão; e a
  ficha com histórico, recorde, gráfico e "subiu +2 kg no treino de 14/09".
  `e2e/progresso.spec.ts` (4) — os cards (2 treinos na semana, 100 % de
  aderência em 3 dias, 193 kg de volume), os gráficos dos grandes (inclusive o
  vazio do desenvolvimento militar), volume, barra fixa, corrida e a tabela da
  `v_records`, a tela vazia sem nenhum treino e o link do recorde para a ficha.
  `e2e/corpo.spec.ts` (5) — peso com vírgula no gráfico e no banco (e o upsert
  do mesmo dia), a meta em `profiles.prefs`, as medidas na tabela e no banco, a
  foto (PNG gerado no teste) subindo para `progresso/<user_id>/<data>-frente.jpg`
  e aparecendo na galeria — com a URL assinada de verdade depois do reload — e
  a comparação de duas datas com o slider. Mais 1 teste novo no contrato do
  mock (upload multipart).

### O que falta

- Marco 6: `/mais` (perfil, equipamento com os pesos das barras, preferências,
  backup), polimento offline, Lighthouse e deploy.
- As fotos não têm como ser apagadas pela tela (o bucket e a tabela aceitam);
  entra no marco 6 junto com o resto do perfil.
- `/progresso` lê 12 semanas de séries numa consulta só (limite de 3000
  linhas). Um ano inteiro de treino ainda cabe, mas quando o histórico crescer
  vale trocar por uma view de agregação no Postgres.

### Como testar no celular (marco 5)

1. `npm run build && npm run e2e` — 99 testes verdes a 360 × 740
   (`npm test` fecha em 612).
2. À mão: `npm run mock` num terminal e `npm run dev:mock` no outro (troque
   `127.0.0.1` pelo IP do computador nas três variáveis para abrir pelo
   celular). Entre com `miguelgsaviotti29@gmail.com`.
3. **Progresso → Catálogo de exercícios**: digite "triceps" (sem acento) e veja
   os exercícios de tríceps; toque em "No meu programa" e a lista cai para os
   exercícios dos treinos. Nada pode rolar para o lado.
4. Abra **Supino reto com barra**: a figura anima sozinha, as duas fotos abrem
   em tela cheia no toque, o boneco destaca peitoral (primário) e tríceps e
   ombro (secundários), e embaixo estão montagem, passos, erro comum,
   "3 × 5–8", "7,5 kg na barra" e a regra de progressão.
5. Faça um treino (ou use o que já registrou) e volte à ficha: "onde você está"
   mostra a carga de hoje, o recorde aparece, o gráfico ganha um ponto por
   sessão e a linha do tempo explica "subiu +2 kg no treino de …".
6. Em **Progresso**, confira os quatro cards e role: um gráfico por grande,
   volume semanal, barra fixa (séries + soltas) e a corrida em minutos e km.
7. Em **Corpo → Peso**: registre `82,4` (vírgula) e veja o ponto no gráfico com
   a linha tracejada da média de 7 dias; guarde uma meta e o card passa a dizer
   quanto falta.
8. **Corpo → Medidas**: preencha cintura e peito, salve, e escolha "Cintura" no
   seletor para ver o gráfico; a tabela rola para o lado dentro do próprio card.
9. **Corpo → Fotos**: tire a foto de frente pelo celular — ela aparece na hora
   (ainda no aparelho) e sobe sozinha. Ligue o **modo avião** antes de tirar
   outra: a foto aparece igual e o envio espera a rede voltar. Com duas datas,
   a comparação abre com o slider; arraste e veja a foto antiga aparecendo.

---

## Auditoria do marco 5 (rodada 1) ✅

Auditoria independente do marco 5 contra a SPEC §3.6, §3.7, §3.8, §10.7 e
§10.8, lendo o código e **usando o app** num Chromium de 360 × 740 contra o
mock. Os quatro portões estavam verdes antes de começar (lint limpo, 612
testes, build com as 81 rotas `● SSG`, 99 testes e2e).

### O que a varredura confirmou

- **As 81 fichas** (§10.8) abrem em 200, com o `h1` igual ao `nome` do JSON,
  com **todas** as imagens carregando de verdade (`naturalWidth > 0`: figura +
  2 fotos, ou só as 2 fotos nos 14 exercícios sem figura), com o mapa muscular
  e com pelo menos os passos que o JSON tem. Nenhum 404 em
  `/figuras`, `/fotos`, `/itens` ou `/mapa-muscular` nas 81 navegações.
- **O mapa muscular** usa mesmo as classes `p-<musculo>` / `s-<musculo>` e o
  `<use href="#bf">` acha o símbolo do sprite injetado no layout.
- **Os gráficos** (§10.7) desenham com **1 ponto** (o `dot` aparece) e com
  **30** (as duas linhas do peso, eixo x ralo com ≤ 8 rótulos), sem rolagem
  lateral nos dois casos.
- **A foto** é reduzida no aparelho: um PNG de 2400 × 1200 chega ao bucket
  como **JPEG de 1600 × 800** no caminho `<user_id>/<data>-<angulo>.jpg` da
  policy.
- **A conta da §3.7 bate com a mão**: numa sexta com a semana planejada
  seg A1 · ter cardio · qua B1 · qui descanso · sex A1, com a força de segunda
  e a de quarta feitas, a tela mostra **50 % (2 de 4 dias)** — o descanso não
  conta, o sábado ainda não chegou — e **440 kg** de volume (o unilateral soma
  os dois lados, o peso do corpo soma 0, a série não concluída e o aquecimento
  ficam de fora).
- **Busca e filtros** (§3.6): "triceps" acha os de Tríceps, "supino reto" exige
  as duas palavras, grupo + implemento se somam e a lista vazia diz isso.
- **Rótulo da carga por implemento** (§4) na ficha: 7,5 kg **na barra**,
  1,5 kg **por halter**, 4 kg **no pino**, 5 kg **na anilha**, 2 kg na barra W
  e "peso do corpo" onde não há carga.
- Sem `console.log`, sem `any`, sem `@ts-ignore`; os 8 `eslint-disable` são
  todos `@next/next/no-img-element` com a justificativa na mesma linha. O
  commit do marco **não mexeu no `package.json`**: nenhuma dependência nova.
- Varredura de conteúdo copiado: nenhum nome, passo, erro comum, montagem ou
  regra de progressão de `data/exercicios.json` aparece dentro de `app/`,
  `lib/` ou `components/` (só em testes e num comentário).

### O que estava errado e foi corrigido

1. **A meta de peso só sabia descer** (SPEC §3.8 com `data/perfil.json`). O
   objetivo do perfil é *ganhar força e músculo*, então a meta fica **acima**
   do peso de hoje tanto quanto abaixo — e com meta de 90 kg pesando 82 o card
   dizia "Você passou da meta de 90 kg". `faltaParaMeta()` devolve a distância
   com sinal; a tela passou a usar o módulo dela ("Faltam 8 kg para a meta de
   90 kg") e ganhou o caso do empate ("Você está na meta"). Teste novo nos dois
   sentidos em `e2e/auditoria-m5.spec.ts`.
2. **`dataDaSerie()` jogava a série da noite para o dia seguinte**
   (SPEC §3.7). `registrada_em` é `timestamptz` (UTC); o fallback usado quando
   a sessão não está na janela lida fatiava os 10 primeiros caracteres, então
   uma série das 22 h de Nova Lima (UTC−3) virava 17/09 em vez de 16/09 — e ia
   para a semana errada do volume e dos recordes. Agora o dia sai do relógio
   local (`iso(new Date(...))`), com teste em `lib/progresso.test.ts`.
3. **Os testes unitários rodavam no fuso da máquina.** O app é todo de datas
   locais (§5) e o Playwright já fixa `America/Sao_Paulo`, mas o Vitest rodava
   em UTC nesta máquina: o defeito 2 passava despercebido e um teste de fuso
   passaria aqui e falharia no computador do dono. `vitest.config.mts` ganhou
   `env: { TZ: "America/Sao_Paulo" }` — os 612 testes continuam verdes (614 com
   os novos).
4. **Alvos de 20 px em `/progresso`** (CLAUDE.md, alvos ≥ 44 px). Os três
   caminhos que levam da tela de progresso para a ficha — o nome de cada um dos
   grandes, a lista de recordes recentes e a tabela de recordes — eram links de
   texto de 20 px de altura, sem a classe `.alvo` que o resto do app usa.
   Ganharam `alvo flex items-center`.
5. **"−0,0 kg" e "−0 cm"** nas variações (§3.8). Semana (ou medida) sem
   mudança caía no ramo do sinal negativo. Agora o empate tem texto próprio
   ("0 kg", "Igual ao registro anterior").
6. **O mock derrubava a sessão no meio da navegação** (harness). O
   `@supabase/ssr` renova a sessão no servidor e no navegador, e com o token
   vencido as duas chamadas saem quase juntas com o **mesmo** refresh token. O
   GoTrue de verdade tolera isso por uns segundos
   (`SECURITY_REFRESH_TOKEN_REUSE_INTERVAL`, 10 s); o mock apagava o token na
   primeira troca e devolvia 400 na segunda — o app caía no `/login` no meio de
   uma varredura de 81 páginas, um falso vermelho que poderia mascarar um
   defeito de verdade. `scripts/mock-supabase.ts` ganhou a janela de reuso, com
   teste de contrato em `e2e/mock.spec.ts`.

### O que ficou anotado (não bloqueia)

- **`components/graficos/index.tsx`**: o espaço reservado enquanto o Recharts
  carrega tem sempre 180 px, mesmo nos gráficos declarados com `altura={140}`
  ou `150` — um pulinho de layout nos gráficos dos grandes e da corrida. Para
  resolver, o `loading` precisa receber a altura (um wrapper por altura, ou
  `dynamic` dentro de um componente que já saiba o tamanho).
- **`lib/corpo.ts` → `MEDIDAS`**: o "onde passar a fita" de cada medida é
  microcópia escrita no código. Não é conteúdo do guia (nenhum JSON e nenhum
  `docs/` fala de fita métrica), mas se o dono quiser versionar esses textos
  junto com o resto, o lugar é um JSON em `data/`.
- **`aderencia()`** aplica o perfil de **hoje** (fase, semana do plano) às 4
  semanas da janela: quem mudar de fase vê as semanas passadas recalculadas
  pela fase nova. É consequência de não guardar o plano histórico e só aparece
  na virada de fase.

### Testes acrescentados

`e2e/auditoria-m5.spec.ts` (13): a varredura das 81 fichas, os 14 sem figura +
as classes do mapa, o gráfico com 1 e com 30 pontos, a foto de 2400 px virando
1600 px no bucket, o rótulo da carga por implemento, a meta nos dois sentidos,
o peso que não é número (caso de erro: nada é gravado), a busca sem acento com
os filtros somados e as três telas a 360 px (sem rolagem lateral, controles ≥
44 px, as três abas do corpo). `e2e/mock.spec.ts` (+1): a janela de reuso do
refresh token. `lib/progresso.test.ts` (+2): o dia da série no fuso local.

### Como testar no celular (auditoria)

1. `npm run lint && npm run build && npm test && npm run e2e` — 614 unitários e
   113 e2e verdes.
2. **Corpo → Peso**: registre `82,0`, guarde a meta `90,0` e confira
   "Faltam 8 kg para a meta de 90 kg" (antes dizia que você tinha passado
   dela). Troque a meta para `78,5` e a frase continua dizendo quanto falta.
3. **Progresso**: os nomes dos grandes, os recordes recentes e as linhas da
   tabela agora são alvos de 44 px — dá para acertar com o polegar andando.

---

## Marco 6 — Mais, offline de verdade e acabamento ✅

A tela que faltava (SPEC §3.9), o backup (§9), o offline como a §8 descreve e o
acabamento de PWA, textos e documentação.

### O que foi feito

**Peças puras novas (com testes)**

- `lib/preferencias.ts` — `profiles.prefs` lido e escrito sem perder as chaves
  que outras telas guardam lá (meta de peso §3.8, adiamento da Fase 2 §5.1,
  marca do avanço de semana §5.5):
  ```ts
  temaDasPrefs · temaDoNextThemes · temaDoTema · comTema · TEMAS
  ligado(prefs, chave) · comLigado · CHAVES_LIGADAS
  pesosDasBarras(prefs) · comPesoDaBarra · pesoDeBarraValido
  opcoesDeMontagem(prefs): OpcoesMontagem
  ```
- `lib/equipamento.ts` — o terraço para a tela, tudo de `equipamentos.json`:
  `itensDoTerraco()` (os 10 itens com a primeira foto da pasta),
  `barrasDoTerraco(prefs)` (peso que vale hoje + de onde ele veio),
  `anilhasDoKit()`, `totalDeAnilhasKg`, `notaDasAnilhas`, `presilhas`,
  `oQueFalta`.
- `lib/backup.ts` — exportar e importar (§9), idempotente por id:
  `TABELAS_BACKUP` (as 11), `CHAVE_DA_TABELA`, `COLUNAS_DA_TABELA`,
  `montarBackup`, `nomeDoArquivoBackup`, `textoDoBackup`, `lerBackup` (zod, com
  mensagem em pt-BR), `chaveDaLinha`, `previaDaImportacao`,
  `linhasParaImportar`, `emLotes`.
- `lib/precache-do-programa.ts` — `exerciciosDaFase(fase)` e `midiaDaFase(fase)`
  (puras) + `aquecerMidiaDaFase` (navegador, silenciosa).

**`lib/montagem.ts` ganhou o peso por barra**

`OpcoesMontagem` passou a ter `pesosBarras?: Partial<Record<BarraId, number>>`
além do `pesoBarra` (que continua vencendo). Era o que faltava para o §3.9
funcionar de verdade: uma sessão tem exercícios de barras diferentes, e um
`pesoBarra` só valeria para todas ao mesmo tempo. Agora pesar a barra W muda a
escala **dela** (4,8 · 6,8 · …) e a maciça continua 7,5 + 2k.

O `opcoesDeMontagem(perfil.prefs)` foi ligado em todos os lugares que chamam o
motor: Hoje (prévia), Treinar (criar a sessão), a sessão refeita noutro
aparelho, a sessão de barra fixa e o "onde você está" da ficha.

**`/mais` (SPEC §3.9)**

Um índice com quatro rotas próprias (cada uma com o seu título e o seu bundle):

- **`/mais/perfil`** — nome, altura e data de início; a fase atual com "desde
  quando", a semana e quantos treinos concluídos; a **sugestão da Fase 2**
  (§5.1) com *Passar para a Fase 2* e *Adiar 2 semanas*; e as semanas dos
  planos de corrida, corda e barra fixa com − e + (§5.5).
- **`/mais/equipamento`** — as 4 barras com o peso que vale hoje, a etiqueta
  "a pesar" nas duas que o JSON ainda não tem (barra W e reta oca) e o campo
  para anotar a balança; as anilhas do kit; os 10 itens com foto e specs; e o
  que ainda falta comprar.
- **`/mais/preferencias`** — tema (claro/escuro/automático), som e vibração do
  descanso, voz do cardio, manter a tela acesa, e o **incremento por
  exercício** (override em `exercise_state.incremento_kg`, com "programa 4 kg ·
  usando 6 kg").
- **`/mais/backup`** — *Exportar* baixa `treino-terraco-<data>.json` com as 11
  tabelas; *Importar* lê o arquivo, mostra a **prévia** (quantas linhas novas e
  quantas serão sobrescritas, por tabela) e só então grava.

**Offline como a §8 pede**

- **Precache da instalação**: o shell, os ícones, a página `/~offline` e as **67
  figuras** (700 kB). Antes ia tudo de `public/` — 18 MB, incluindo as 162 fotos
  do catálogo e as 6 MB de fotos do equipamento.
- **Fotos do programa da fase atual**: `components/aquecer-midia.tsx` aquece o
  cache assim que o service worker assume o controle da aba
  (`controllerchange`), uma vez por fase.
- **Fotos do catálogo**: `CacheFirst` sob demanda (`midia-do-treino`, 300
  entradas, 180 dias), em `app/sw.ts`.
- **Supabase nunca sai do cache**: uma regra `NetworkOnly` para
  `/(rest|auth|storage|realtime|functions)/v1/` **antes** do `defaultCache` —
  cujo último item é um `NetworkFirst` para tudo que é de outra origem, e que
  guardaria as respostas do PostgREST. Tem teste e2e varrendo todos os caches
  do navegador depois de navegar pelo app.

**Acabamento**

- `components/em-construcao.tsx` apagado: não sobrou nenhuma tela "em
  construção".
- `manifest` com `id`, e o `viewport.themeColor` (claro/escuro) e os ícones
  192/512/maskable + apple-touch já vinham do marco 1.
- README com **Testes**, **Deploy na Vercel** (as três variáveis, Site URL e
  Redirect URLs no Supabase) e **Instalar no celular**.
- `npm run validar` passou a conferir a foto de cada item do equipamento.

### Decisões

- **Sub-rotas em vez de uma página só.** `/mais` com quatro seções empilhadas
  passaria de 3 000 px a 360 px e carregaria o Recharts, os 81 exercícios e o
  leitor de backup de uma vez. Quatro rotas: cada uma tem o seu `<title>`, o seu
  bundle (o índice fecha em 122 kB) e o botão de voltar do celular funciona
  como o dedo espera.
- **`pesosBarras` por barra, não um `pesoBarra` global** (acima). O
  `pesoBarra` continua existindo porque é o que a montagem de um implemento só
  usa internamente e o que os testes do motor exercitam.
- **O tema mora nos dois lugares.** Quem pinta é o `next-themes`
  (localStorage, sem piscada na primeira renderização); quem manda é
  `profiles.prefs.tema`, aplicado uma vez por carregamento
  (`components/tema-do-perfil.tsx`) — assim o tema atravessa aparelhos e a
  reinstalação do app.
- **Importar é upsert pela chave primária**, em lotes de 200, pela fila de
  saída. Idempotente por id, como a §9 pede: o mesmo arquivo duas vezes deixa o
  banco igual (tem teste e2e). Colunas que não existem no schema são
  descartadas, e **todo `user_id` é recarimbado** com o de quem está importando
  — a RLS só aceita linha do dono, e o backup pode vir de outro projeto.
- **As fotos de progresso não entram no backup.** Elas vivem no bucket privado;
  o JSON levaria dezenas de MB em base64. O `progress_photos` (o caminho e a
  data) vai, então importar num projeto com o mesmo bucket reencontra as fotos.
- **O precache é montado à mão em `next.config.ts`.** O `additionalPrecacheEntries`
  do `@serwist/next` **substitui** o `globPublicPatterns` em vez de somar
  (`node_modules/@serwist/next/dist/index.mjs`, "if (!resolvedManifestEntries)"):
  passar só a `/~offline` deixaria o precache sem nenhum arquivo de `public/`.
  Então a lista das figuras e dos ícones (com o hash de cada arquivo) é montada
  no próprio config, com a `/~offline` no fim.
- **`/~offline` precisa estar no precache.** Sem ela, navegar sem rede para uma
  rota fora do app cai no erro do navegador. Com ela, o service worker serve o
  HTML da `/~offline`; numa rota que não existe o Next hidrata em cima e mostra
  o 404 dele — que é a resposta certa para uma rota que não existe.

### Mudança no schema (`supabase/schema.sql`)

- `progression_events.exercise_id` passou a **aceitar null**: a troca de fase
  (§5.1 manda registrar um evento `trocou_fase`) é do programa inteiro, não de
  um exercício. Quem lê eventos filtra por `exercise_id`, então essa linha não
  aparece em nenhuma ficha; `lib/hoje.ts` pula os nulos ao montar o "último
  evento por exercício".

### Testes

- **Unitários** (`npm test`, **659**): `lib/preferencias.test.ts` (13),
  `lib/equipamento.test.ts` (8), `lib/backup.test.ts` (16),
  `lib/precache-do-programa.test.ts` (4) e 4 novos em `lib/montagem.test.ts`.
  Cobrem: jsonb torto não vira override de peso; pesar a barra W muda só a
  escala dela; a foto de cada item existe em `assets/`; o backup recusa arquivo
  de outro app/versão e descarta tabela e coluna desconhecidas; a importação
  recarimba o `user_id`, ignora linha sem chave e é idempotente.
- **E2E** (`npm run e2e`, **131**): `e2e/mais.spec.ts` (13) — o índice com alvos de
  44 px; perfil gravado; semana do plano com − e +; a Fase 2 nos três estados
  (sem gatilho, adiada, aceita com o evento `trocou_fase` e a Hoje já no
  Superior A); os 10 itens com foto que **carrega de verdade**; pesar o halter
  em 1,4 kg mudando a Hoje de "1,5 kg por halter" para "1,4 kg por halter"; o
  tema mudando a classe `dark` e voltando depois do reload; o incremento virando
  `exercise_state.incremento_kg`; e o backup exportado, importado num mock
  zerado, reproduzindo sessão, séries, estado, peso e perfil — e importado de
  novo sem duplicar nada. `e2e/pwa.spec.ts` (5) — o `sw.js` com as figuras e a
  `/~offline` e **sem** as 162 fotos; o manifest com cor de tema e ícones que
  respondem 200; nenhuma resposta do Supabase em nenhum cache; as fotos da fase
  no cache depois do aquecimento; e o app abrindo sem rede.

### Critérios de aceite (SPEC §10)

| # | Critério | Como foi verificado |
|---|---|---|
| 1 | Login com o e-mail permitido; qualquer outro recusado | `e2e/login.spec.ts` (6) e `e2e/auditoria.spec.ts`: o e-mail de fora é recusado **sem nenhuma requisição** chegar ao Supabase. Contra o Supabase real: **pendente: infra** |
| 2 | Perfil semeado de `perfil.json` e a Hoje com "Treino A · 6 exercícios · 44 min" numa segunda, com 7,5 kg na barra, 1,5 kg por halter e 4 kg no pino | `e2e/hoje.spec.ts` com o relógio em 14/09/2026 |
| 3 | Sessão completa por série no celular, sem teclado físico; timer ao concluir; sobrevive a fechar/reabrir e a ficar sem rede | `e2e/treinar.spec.ts` (inclusive fechar o app sem rede e reabrir) |
| 4 | Sobe no sucesso; 2 falhas = −10 % e incremento pela metade; 3 falhas = semana leve | `lib/progressao.test.ts` (os 22 casos do doc) + 280 testes de auditoria |
| 5 | O motor só propõe carga alcançável (26,5 → 25,5), nos três implementos | `lib/montagem.test.ts` (escala inteira varrida) |
| 6 | Calendário da Fase 1 com A/B alternando e a corrida da terça na semana 1 com 8 × (1/2 min) | `e2e/calendario.spec.ts` e `e2e/cardio.spec.ts` |
| 7 | Peso, medidas e fotos registrados e comparados; gráficos com 1 e com 30 pontos | `e2e/corpo.spec.ts` e `e2e/auditoria-m5.spec.ts` |
| 8 | As 81 fichas abrem com figura (ou fotos), músculos, passos e histórico | `e2e/auditoria-m5.spec.ts`: as 81 abertas uma a uma, com `naturalWidth > 0` em cada imagem e nenhum 404 |
| 9 | `npm run build`, `npm run lint` e `npm test` verdes; PWA instalável; 360 px | build, lint e 659 testes verdes; `e2e/pwa.spec.ts` confere manifest, ícones e service worker; a rolagem lateral e os alvos de 44 px são verificados em cada tela. **Lighthouse em si: pendente: infra** (não há Chrome com Lighthouse nesta máquina) |
| 10 | Deploy na Vercel com as variáveis; instalação como PWA no Android/iPhone | **pendente: infra** — falta o projeto Supabase e o projeto na Vercel. O passo a passo está no README ("Deploy na Vercel" e "Instalar no celular") |

### O que falta

- **Infra** (fora do código): criar o projeto Supabase, rodar
  `supabase/schema.sql`, preencher as variáveis na Vercel, conferir Site URL e
  Redirect URLs, e repetir os critérios 1, 2, 9 (Lighthouse) e 10 contra o
  ambiente de verdade. O mock imita o schema, não o substitui.
- Apagar uma foto de progresso pela tela (o bucket e a tabela aceitam).
- Splash de iOS: o Android usa o manifest (ícone 512 + `background_color`); o
  iPhone precisa de uma `apple-touch-startup-image` por tamanho de tela, que
  não foi gerada — ele abre com a tela preta do `background_color`.

### Como testar no celular (marco 6)

1. `npm run lint && npm run build && npm test && npm run e2e`.
2. À mão: `npm run mock` num terminal e `npm run dev:mock` no outro (troque
   `127.0.0.1` pelo IP do computador nas três variáveis para abrir pelo
   celular).
3. **Mais → Preferências**: toque em *Escuro* — a tela vira preta na hora.
   Feche o app, abra de novo: continua escura (veio do perfil, não do
   aparelho). Desligue *Som no fim do descanso* e comece um treino: o timer
   zera calado.
4. **Mais → Equipamento**: role até *2 barras de halter* e digite `1,4` em
   "Peso na balança". Volte para a **Hoje**: o desenvolvimento com halteres
   agora pede **1,4 kg por halter** (antes 1,5) — a escala inteira do
   implemento se recalculou. Toque em *Limpar* para voltar ao kit.
5. **Mais → Preferências → Incremento por exercício**: ponha `6` no
   agachamento. A linha passa a dizer "programa 4 kg · usando 6 kg" e a próxima
   subida vai somar 6 kg.
6. **Mais → Perfil**: mude o nome e a altura e salve. Se já tiver 12 semanas e
   30 treinos, o cartão da fase oferece a Fase 2 — *Adiar 2 semanas* some com a
   pergunta até lá.
7. **Mais → Backup → Exportar backup**: o celular baixa
   `treino-terraco-<data>.json`. Abra *Importar*, escolha o arquivo e veja a
   prévia dizendo quantas linhas são novas antes de confirmar.
8. **Offline**: instale o app (Chrome ⋮ → *Instalar app*), espere uns segundos
   na Hoje (é quando as fotos do seu programa entram no cache), ligue o **modo
   avião** e navegue: a Hoje abre com os dados da última sincronização, o treino
   abre com as figuras e as fotos, e cada série registrada fica no aparelho.
   Desligue o modo avião: em segundos tudo sobe sozinho.

---

## Auditoria do marco 6 (rodada 1) ✅

Auditoria independente do marco 6: `npm run lint`, `npm run build`, `npm test`
(659) e `npm run e2e` (131) foram rodados do zero e voltaram **verdes**, sem
aviso no build. Depois o app foi percorrido no Chromium a 360 × 740 contra o
mock, tela por tela.

### O que foi conferido de verdade

- **`/mais` e as quatro sub-rotas**: perfil grava nome/altura/início; as semanas
  dos planos sobem e descem; a Fase 2 aparece com os dois gatilhos, adia por 2
  semanas e, ao aceitar, grava `fase2` + o evento `trocou_fase` com
  `exercise_id` nulo; equipamento mostra os 10 itens com foto que carrega e o
  peso medido muda a escala do implemento na Hoje; preferências aplicam tema,
  interruptores e incremento; sair funciona.
- **Backup**: o JSON exportado traz as 11 tabelas; importado num mock zerado
  reproduz sessão, séries, estado, peso e perfil, e importar de novo **não
  duplica** (conferido em `e2e/mais.spec.ts`, mais dois casos de erro novos).
- **Offline**: build de produção com o `sw.js` gerado; com o service worker no
  comando, a **Hoje recarregada sem rede** abre, a navegação inferior anda entre
  Hoje/Treinar/Mais e a figura do programa vem do cache — é o teste novo
  `e2e/auditoria-m6.spec.ts`, que faltava (o `pwa.spec.ts` só abria uma rota
  nova offline, nunca recarregava a Hoje).
- **360 px em todas as telas** (Hoje, calendário, treinar, sessão, cardio, barra
  fixa, exercícios, ficha, progresso, corpo ×3 abas, mais ×5): nenhum texto fora
  do pt-BR, nenhum número com ponto decimal, datas em dd/MM, rótulo de carga
  certo por implemento ("na barra", "por halter", "no pino", "peso do corpo"),
  nenhum alvo abaixo de 44 px e **nada vazando a largura** — medido elemento a
  elemento, porque o `overflow-x: hidden` do `body` esconde a rolagem lateral e
  o `scrollWidth` da página não a denuncia.
- Código: nenhum `console.log`, nenhum `any`, nenhum `eslint-disable` sem
  justificativa, nenhum "em construção", nenhum nome/série/regra de exercício
  copiado para dentro de `app/`, `lib/` ou `components/` (varredura dos 81 nomes
  do catálogo: só aparece num comentário de `lib/barra-fixa.ts`).

### O que foi corrigido nesta auditoria

1. **Fase 2 contava semana de dois jeitos** (`components/mais/tela-perfil.tsx`).
   O texto usava `semanaDaFase` (número da semana, começa em 1) e a regra usava
   `sugerirFase2` (semanas **cheias**, começa em 0). Com 11 semanas cheias a
   tela dizia "A Fase 2 é sugerida com 12 semanas … (você tem 12 e 30)" e mesmo
   assim não oferecia o botão. Agora os dois textos usam `sugestao.semanas`; o
   "semana N" do cabeçalho continua sendo o número da semana.
2. **O interruptor das preferências tinha 34 px de alvo**
   (`components/mais/tela-preferencias.tsx`). O `Switch` do shadcn é um pill de
   18 px com a área de toque no `::after`; a sessão de força já resolvia isso
   fazendo a linha inteira virar o botão (`components/treinar/bloco.tsx`), mas a
   tela nova usou o componente cru. A área de toque foi esticada para 44 px.

Os dois testes novos falham no código anterior (foi verificado) e passam agora.

### Testes acrescentados — `e2e/auditoria-m6.spec.ts` (10)

Hoje recarregada sem rede + nav + figura do cache · as 5 telas de `/mais` a
360 px com medição elemento a elemento e os interruptores na conta dos 44 px ·
o toque de polegar no interruptor · o limiar da Fase 2 nos dois lados (11 e 12
semanas cheias) · um backup de versão futura recusado sem gravar nada.

Total: **659 unitários** e **141 e2e**.

### Problemas que ficam registrados (nenhum bloqueante)

- **`pendente: infra`** — sem projeto Supabase e sem Vercel, os critérios §10.1
  e §10.2 contra o banco real, o §10.9 (Lighthouse) e o §10.10 (deploy +
  instalar no celular) continuam por verificar. O mock imita o schema, não o
  substitui.
- `supabase/schema.sql` usa `create table if not exists`: num banco onde o
  schema **antigo** já tivesse rodado, a mudança de `progression_events.
  exercise_id` para nulo não seria aplicada por reexecutar o arquivo (seria
  preciso um `alter table … alter column exercise_id drop not null`). Como o
  projeto ainda vai ser criado do zero, não afeta nada hoje.
- Números de conteúdo ainda escritos no código, em vez de derivados do JSON: o
  `maximo: 12` das semanas de corda e barra fixa em `tela-perfil.tsx`, o
  "As 12 semanas" de `tela-barra-fixa.tsx` (marco 4) e o `formatarKg(2)` da
  descrição das barras em `tela-equipamento.tsx` (é o `PESO_BARRA_A_PESAR`).
  Todos batem com `data/cardio.json` e `lib/montagem.ts` hoje.
- "0 de 1 dias" na aderência de `/progresso` (marco 5) — falta o singular.

> Os quatro itens acima (menos o `pendente: infra`) foram corrigidos depois, na
> varredura das pendências das auditorias — ver a última seção deste arquivo.

### Como testar no celular (auditoria do marco 6)

1. `npm run lint && npm run build && npm test && npm run e2e`.
2. `npm run mock` + `npm run dev:mock` e, no celular da mesma rede, abra
   `http://<ip>:3000`.
3. **Mais → Preferências**: toque **acima** do interruptor "Som no fim do
   descanso", não no pill — ele tem que virar do mesmo jeito.
4. **Mais → Perfil**: o texto da Fase 2 tem que dizer o mesmo número de semanas
   que a regra ("você tem N e M" com N = semanas cheias).
5. **Offline**: com o app instalado e a Hoje aberta uma vez, ligue o modo avião
   e **recarregue a Hoje** — ela abre, a barra de baixo continua navegando e as
   figuras do treino aparecem.

---

## Pendências das auditorias — varredura item a item ✅

As 19 anotações que os auditores dos marcos deixaram como "menor" (mais o
bloqueante do marco 3, já corrigido na rodada seguinte) foram conferidas uma a
uma no código. O que valia foi corrigido com teste; o que ficou está registrado
no fim, com o motivo.

### Conteúdo que saiu do código e foi para os JSON

- **As sugestões e os avisos do motor** (`lib/progressao.ts`) eram frases
  escritas em TypeScript: lastro da barra fixa, anilha no core, "sem elástico",
  tempo acima da faixa, incremento curto demais e os dois avisos de teto. Agora
  `data/progressao.json` tem os blocos `sugestoes` e `avisos` (validados em
  `lib/schemas.ts`), o motor devolve **chave + números**
  (`RefDeTexto = { chave, dados }`) e quem monta a frase é `textoDoMotor()` em
  `lib/dados.ts` — `{reps}` e `{kg}` trocados com vírgula decimal. `lib/sessao.ts`
  resolve o texto uma vez, no `ResultadoExercicio`, e a tela do resumo não mudou.
  Os ~30 testes que dependiam das strings passaram a comparar o **mesmo texto**
  resolvido por `txt(...)`, sem afrouxar nenhuma asserção; `lib/dados.test.ts`
  ganhou a varredura "toda chave vira frase" e o erro ruidoso da chave
  desconhecida.
- **A microcópia das medidas com fita** (`lib/corpo.ts`, "na altura do umbigo,
  sem prender a barriga"…) virou o bloco `medidas` de `data/perfil.json`, com
  `campoDeMedidaSchema` no zod; `MEDIDAS` agora é só um alias de
  `medidasDoCorpo` (lib/dados.ts) e `CampoDeMedida` vive em `lib/schemas.ts`.
- **Os tetos de 12 semanas** saíram do código: `ultimaSemanaDoPlano(faixas)` lê
  o fim da última faixa ("9–12" → 12) e alimenta `avancarSemanaDeCorda`,
  `avancarSemanaDeBarraFixa` (lib/calendario.ts), `maximoDoPlano`
  (lib/queries/perfil.ts), o `PLANOS` de `tela-perfil.tsx` e o "As N semanas" de
  `tela-barra-fixa.tsx`. `tela-equipamento.tsx` passou a escrever
  `formatarKg(PESO_BARRA_A_PESAR)` em vez de `formatarKg(2)`.

### Motor e sessão

- **A carga mudada à mão na série chega ao motor** (§3.2 × §6.1/§6.2). Quando
  **todas** as séries de trabalho trazem a mesma carga e ela não é a do
  `exercise_state`, é ela a carga da sessão: `decidir()` parte dela (subida e
  volta de 10 % sobre a carga certa), o evento registra `carga_usada` e o `de`
  da §6.6 mostra a carga levantada — quem faz 11,5 num dia de 7,5 vê
  "11,5 → 13,5 kg". Cargas diferentes entre as séries não dizem qual era a do
  dia: aí continua valendo o estado. A semana leve fica de fora (a sessão dela
  sempre volta à `carga_antes_leve`). 6 casos novos em `lib/progressao.test.ts`.
- **Substituir o exercício apaga as séries do original nesta sessão**
  (`escritaDeDescarte` + `descartarSeriesDoBloco`): a folha promete "as séries
  já registradas deste bloco serão trocadas pelas do substituto" e a §3.2 diz
  que "o registro fica com o exercício substituto". O delete por
  `session_id + exercise_id + ordem_ex` entra na fila de saída como qualquer
  escrita (funciona offline). Sem isso o original ficava com uma sessão
  fantasma no histórico e nos recordes (§3.6/§3.7).
- **A sessão de barra fixa guarda a semana do plano** (`sessions.semana_plano`,
  coluna nova). Refeita noutro aparelho, ela volta com a prescrição da semana em
  que foi criada, e não com a de hoje — o plano pode ter ido de 4 × 5 para 4 × 6
  no meio. `escritaDaSessao`, `montarSessaoAvulsa`, `reconstruirSessao`,
  `lib/backup.ts`, o mock e `lib/types.ts` acompanham.
- **O cronômetro não grava mais 4× por segundo**: o tique continua de 250 ms
  (parar é imediato), mas só avisa quando o **segundo** muda — de ~480
  gravações no IndexedDB numa prancha de 2 min para 120. Cada segundo continua
  salvo, então recarregar no meio não perde o valor.

### Telas

- `/cardio/caminhada` e "outro" mostram no fim **só duração e nota** (§3.3): a
  distância ficou para a corrida, os saltos para a corda e o teste da fala para
  as duas. O e2e da caminhada confere que o diálogo não tem distância nem
  esforço.
- `/progresso`: "0 de 1 **dia**" (singular) e a janela da aderência limitada às
  semanas a partir de `fase_desde`, com "· desde dd/MM" no card quando isso
  corta — a grade da fase de hoje não descreve as semanas da fase anterior
  (§5.1), então a aderência já mostrada não muda mais sozinha na virada.
- Os gráficos reservam a **altura declarada** enquanto o Recharts carrega (um
  wrapper por gráfico, em vez do `loading` de 180 px fixos do next/dynamic):
  acabou o pulinho de layout na primeira carga.
- `importarBackup()` espera a fila de saída drenar (`esperarFila()`) antes de
  invalidar as queries: o refetch não volta mais com os dados de antes da
  importação.

### Banco

- `supabase/schema.sql` ganhou um bloco de **migrações idempotentes** no fim
  (`alter table … drop not null` do `progression_events.exercise_id`, os
  `add column if not exists` de `session_sets.tempo_s_lado2`,
  `exercise_state.sessoes_graca/incremento_reduzido/exigir_rep_extra/
  carga_antes_leve` e `sessions.semana_plano`): num banco que já tenha uma
  versão anterior do schema, reexecutar o arquivo agora aplica as mudanças.
- Conferido por script: `lib/types.ts` e `scripts/mock-supabase.ts` têm
  exatamente as colunas de `supabase/schema.sql`, tabela por tabela.

### Já resolvido antes desta rodada (conferido no código)

- **Bloqueante do marco 3 — "o substituto usa o próprio estado" (§6.3)**: a
  tela carrega `exercise_state`, séries anteriores e recordes de todos os
  substitutos possíveis (`idsComSubstitutos`) e passa os do escolhido em
  `substituirExercicio(...)`; sem a leitura, o bloco fica `estadoConhecido:
  false` e não grava progressão. Coberto por `lib/sessao.test.ts` e pelo e2e
  "o substituto abre com a carga dele e a conclusão parte dela (§6.3)".

### Conhecido, não corrigido (com o motivo)

- **Recordes numa sessão refeita noutro aparelho** (marco 3, rodada 2):
  `v_records` já inclui as séries desta sessão (elas subiram antes da
  reconstrução), então o resumo do fim não anuncia recordes novos daquele
  treino. Corrigir de verdade exige ler os recordes **excluindo a sessão**, e
  isso não dá para fazer na view: seria varrer `session_sets` de dezenas de
  exercícios no cliente a cada abertura de sessão — caro no celular para uma
  linha do resumo. O erro é para o lado seguro (deixa de anunciar, nunca
  inventa um recorde) e só acontece quando a sessão foi perdida do aparelho.
- **Primeira carga do app sem rede** (marco 3): enquanto o service worker ainda
  não assumiu o controle da página, recarregar sem rede cai na tela de erro do
  Chromium. Da segunda carga em diante — o caso do PWA instalado, que é o do
  Miguel — a sessão volta inteira offline (coberto por e2e). É como o ciclo de
  vida do service worker funciona: o primeiro acesso precisa de rede.
- **O aviso de teto de `lib/montagem.ts`** ("faltam anilhas de 10 kg", no
  diálogo da montagem) continua escrito no código: é a etiqueta de uma
  montagem, não um texto de ajuda do motor, e não tem chave em
  `data/progressao.json`. Os avisos do **motor** (os do evento) já vêm do JSON.

### Testes

`npm test` fecha em **678** (eram 659): 6 casos da carga levantada à mão, 5 do
corte de `por_sessao`, 4 dos textos do motor/tetos/medidas em `dados.test.ts`,
2 da semana do plano e do descarte das séries em `sessao.test.ts` e 1 da
aderência limitada por `fase_desde`. O e2e continua em 141, com a asserção nova
do diálogo da caminhada.

### Como testar no celular (pendências)

1. `npm run lint && npm run build && npm test && npm run e2e`.
2. **Sessão de força**: num bloco com carga, mude o ± da carga em **todas** as
   séries, conclua no topo da faixa — o resumo tem que partir da carga que você
   levantou (ex.: "11,5 → 13,5 kg"), não da carga que o app tinha proposto.
3. **Substituir hoje** depois de marcar uma série: a série do exercício antigo
   some da tela e também do banco (o histórico dele não ganha a sessão).
4. **/cardio/caminhada** → "Encerrar e registrar": o diálogo tem só a nota.
5. **/progresso** numa semana com um dia planejado: "0 de 1 dia".

---

## Auditoria final — lente "offline, robustez e dados" ✅

Auditoria independente de `lib/db.ts`, `lib/outbox.ts`, `lib/outbox-supabase.ts`,
`lib/sessao.ts`, `lib/queries/**`, `components/treinar/**`, `components/cardio/**`,
`app/sw.ts` e `app/providers.tsx`, procurando o que acontece quando a escrita
**quase** dá certo. Seis achados, todos corrigidos aqui, com 4 testes e2e novos
(`e2e/auditoria-offline.spec.ts`) e 20 unitários — os três primeiros testes e2e
falham no código anterior, com o sintoma exato de cada achado.

### O que estava errado

1. **A conclusão do treino podia sumir** (SPEC §8). O fim da sessão era um
   `update` em `sessions` filtrado pelo id, e a criação da sessão é **outro
   item** da fila. Um `update` que não casa com nenhuma linha é **sucesso** no
   PostgREST (204, zero linhas): bastava o POST da criação falhar uma vez (um
   401 de token vencido ao voltar a rede, um timeout) para o `update` chegar
   antes, sair da fila como enviado e a sessão ficar `em_andamento` **para
   sempre** no banco — sem duração, sem sensação, sem notas, sem o peso do dia,
   e com o banner de "treino aberto" na Hoje até o Miguel descartar à mão.
   Agora a conclusão é um **upsert da linha inteira** (`escritaDaSessao` +
   os campos do fim): grava certo em qualquer ordem e pode ser repetida.
2. **Três escritas não eram idempotentes** (SPEC §8): `progression_events` (fim
   da sessão e troca de fase) e `pullup_singles` (+1 da barra fixa) iam como
   `insert` com o id gerado no cliente. Quando a rede cai **depois** de o
   servidor gravar e antes de a resposta voltar, o item continua na fila e o
   reenvio bate num 409 de chave repetida: um item envenenado para sempre,
   tentando de 5 em 5 minutos, numa fila que só aparece na tela de treino. As
   três viraram `upsert` por `id`.
3. **A fila não tinha ordem entre itens ligados** (SPEC §8 + as FK do
   `supabase/schema.sql`). A rodada mandava tudo que estivesse vencido: com a
   criação da sessão no backoff, a série e o evento de progressão iam na
   frente — e no Postgres de verdade `session_sets.session_id` e
   `progression_events.session_id` **recusam** a linha (a sessão ainda não
   existe). Cada item da fila agora carrega um `alvo` (`sessions:<uuid>`,
   derivado da própria escrita em `alvoDaEscrita`) e quem não sobe segura os
   que vieram depois com o mesmo alvo — sem gastar tentativa e sem girar em
   vazio (o item que espera adia para o mesmo instante de quem o segura).
   Itens de outros alvos seguem normais: um item envenenado nunca tranca a
   fila inteira. Os lotes do backup importado (§9) compartilham
   `sessions:lote`, então `sessions` sobe antes de `session_sets`.
4. **O relógio do aparelho andando para trás prendia a fila** (SPEC §8). O
   backoff é `Date.now() + atraso`; com o relógio corrigido para trás (NTP, o
   Miguel mexendo na hora) o item só venceria horas depois, sem nada na tela
   dizendo isso. `venceu()` trata como vencido qualquer item marcado para mais
   longe do que o atraso máximo (5 min).
5. **A rede voltando recarregava o app no meio do treino** (SPEC §3.2 e §8).
   `reloadOnOnline: true` no `next.config.ts` liga um `location.reload()` a
   **cada** evento `online` — no terraço, com o 4G indo e voltando, é o app
   recarregando com o Miguel embaixo da barra: o timer de descanso some, o
   cronômetro da prancha para sem avisar e a recarga ainda atropela o flush da
   fila (o `tentarAgora`, que roda no mesmo evento, é cortado pela metade — foi
   assim que o achado 1 apareceu no e2e). Passou a `false`: a leitura já vem do
   cache do TanStack Query e a escrita já vive na fila; versão nova entra pelo
   service worker (`skipWaiting` + `clientsClaim`) na próxima navegação.
6. **Rede de proteção**: um `update`/`delete` sem nenhum filtro seria aplicado
   pelo PostgREST na tabela inteira. Nenhuma escrita do app chega assim — e é
   por isso que um item desses só pode ser bug. `enviarItem` recusa.

### O que foi conferido e está certo

- Nada se perde na sessão: cada toque grava no IndexedDB com debounce de 60 ms
  e descarga em `pagehide`/`visibilitychange`; o cronômetro de tempo grava uma
  vez por segundo e usa sempre o `aoMudar` da última renderização.
- Ids gerados no cliente em tudo (sessão, série, cardio, peso, medidas, foto),
  upsert por id ou pela chave real — reenviar não duplica.
- Timers de descanso e de cardio andam por relógio de parede (`Date.now()`),
  não por soma de ticks: segundo plano e tela apagada não atrasam nem adiantam.
  O timer de cardio vive no Dexie e sobrevive à recarga.
- Wake Lock é solto no fim e repedido ao voltar à aba.
- Datas de sessão/peso/semana usam `format(..., "yyyy-MM-dd")` no fuso do
  aparelho (nunca `toISOString().slice(0,10)`), e a sessão congela a data em que
  começou: virar o dia no meio do treino não muda o registro.
- Cache do TanStack persistido no Dexie não briga com o que está na tela: o
  `hydrate` só sobrescreve dado mais velho.
- Cache do service worker: 177 arquivos de mídia sob demanda (163 fotos, 10
  itens, 4 do mapa) com teto de 300 entradas; as figuras e o shell vão no
  precache. Sem risco de estourar a cota.

### Conhecido, não corrigido (com o motivo)

- **A fila não aparece fora da tela de treino.** ~~O contador "N para
  sincronizar" só existe no cabeçalho da sessão.~~ **Corrigido** na correção
  final: `/mais` tem a linha "Sincronização" com quantos itens esperam, o erro
  do mais antigo e um "Tentar agora".
- **Sem IndexedDB o app não treina.** Em aba anônima do Firefox (onde
  `indexedDB.open` recusa), começar o treino falha com "Não consegui começar o
  treino agora."; ~~num navegador sem IndexedDB nenhum as escritas são
  descartadas em silêncio~~ — isso foi **corrigido** na correção final
  (`enfileirar` lança e a tela mostra o erro). Falta a checagem única na
  abertura com o aviso no shell. Para o PWA instalado do Miguel o caso não
  acontece.

---

## Correção final — os achados da auditoria final (4 lentes) ✅

A auditoria final (4 lentes) apontou 2 problemas importantes e 19 menores. Os
2 importantes e 15 dos menores foram corrigidos, cada um com teste. Os outros
4 estão em "Conhecido, não corrigido" no fim desta seção, com o motivo: a
auditoria de dependências, o Lighthouse da tela Hoje, o `<input type="date">` e
o achado operacional das etapas concorrentes.

### Importantes

1. **O eixo y de todos os gráficos começava no zero** (SPEC §3.8).
   O `YAxis` não recebia `domain` e o padrão do Recharts é `[0, "auto"]`: com
   30 pesagens entre 81 e 83 kg a aba Peso desenhava uma reta num eixo de 0 a
   100, com a série e a média de 7 dias sobrepostas — e a média móvel é
   exatamente o que a §3.8 pede para mostrar. O mesmo na aba Medidas (cintura
   de 88 cm num eixo de 0 a 100).
   `components/graficos/grafico.tsx` ganhou a prop opcional
   `dominioY?: [number | string, number | string]`, repassada ao `<YAxis
   domain>`; sem ela **nada muda** — os gráficos de barra (volume, reps,
   minutos) e a carga dos grandes continuam com a base zero, onde o zero é
   informação. Quem passa o domínio é a tela, a partir de
   `dominioFolgado(valores, folga)` em `lib/corpo.ts` (pura): `[floor(min) −
   folga, ceil(max) + folga]`, e `["auto", "auto"]` sem valor nenhum. Folga de
   1 kg no peso (com a média junto, para as duas linhas caberem) e de 2 cm nas
   medidas.
   De quebra, o último rótulo do eixo x saía cortado ("09/0" em vez de
   "09/09"): a margem direita do `LineChart` foi para 16 px e o `<XAxis>` do
   gráfico de linha ganhou `padding={{ left: 4, right: 12 }}`. Na barra a
   escala é de banda e o padding só desalinharia, então lá entra só a margem.

2. **`/exercicios/[id]` fechava em 353 kB de first load** (teto de 350 kB).
   A auditoria apontou o `Dialog` do Radix importado pela ficha; a causa real
   era outra e maior. Os componentes do shadcn importam do **pacote
   guarda-chuva** `radix-ui`, e `components/ui/badge.tsx` e `button.tsx` o
   usavam só para pegar o `Slot`. A ficha do exercício é a única página que
   renderiza `<Badge>` **direto num Server Component**: nessa fronteira o
   webpack não sacode o guarda-chuva e ele entrava inteiro — Accordion,
   Menubar, Popover, Avatar e o resto —, num chunk de 200 kB exclusivo da rota.
   Os dois arquivos passaram a importar `@radix-ui/react-slot` direto (agora
   dependência declarada; já vinha instalada como transitiva). A rota caiu de
   **353 para 275 kB** e nenhuma outra passa de 344 kB.
   Junto: o ampliador de fotos saiu do `Dialog` do Radix e virou uma camada
   própria (`components/exercicios/foto-ampliada.tsx`) com `role="dialog"`,
   `aria-modal`, foco no botão de fechar, Esc e toque fora fechando — é um
   overlay com uma imagem dentro, não precisava de 40 kB de primitivas.

### Menores corrigidos

3. **O middleware jogava fora os cookies do `signOut`** (`lib/supabase/middleware.ts`).
   Na recusa por e-mail não permitido o `signOut` escreve os cookies apagados
   na `resposta` que o `setAll` recria, e a função devolvia um
   `NextResponse.redirect()` novo: as deleções iam para o lixo e o aparelho
   ficava com os `sb-*` mortos até expirarem (não era bypass — a sessão já
   estava revogada no servidor). Os dois ramos de redirect passam por
   `irParaOLogin()`, que cria o redirect e copia os cookies escritos pelo
   cliente do Supabase — o padrão do `@supabase/ssr`, que também evita perder
   um token renovado.
4. **Nenhum cabeçalho de segurança** (`next.config.ts`). Entrou `async
   headers()` para `/:caminho*` com `Content-Security-Policy: frame-ancestors
   'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
   `Referrer-Policy: strict-origin-when-cross-origin` e uma `Permissions-Policy`
   enxuta (câmera, microfone, geolocalização e pagamento desligados;
   `screen-wake-lock=(self)`, que a §3.2 usa). A CSP completa ficou de fora de
   propósito — ver "Conhecido, não corrigido".
5. **A importação copiava dois campos que apontam para fora** (`lib/backup.ts`,
   §9). `progress_photos.storage_path` vinha do arquivo (um backup editado
   gravaria `<outro-uid>/2026-01-01-frente.jpg`) e `session_sets.session_id`
   podia referenciar a sessão de outra conta (a checagem de FK do Postgres não
   passa por RLS). Agora `linhasParaImportar` reescreve o `storage_path` com
   `caminhoDaFoto(userId, data, angulo)` — e descarta a foto sem data ou com
   ângulo inventado — e só aceita a série cuja sessão vem no mesmo arquivo.
6. **Inversão possível em `schedule_overrides`** (`lib/outbox-supabase.ts`, §8).
   Marcar um dia (upsert) e desmarcá-lo (delete com filtro `{data}`) na mesma
   janela offline, com o upsert falhando uma vez, fazia o delete — que não casa
   com linha nenhuma, logo "sucesso" — sair antes, e o upsert reenviado
   ressuscitava o dia. `alvoDaEscrita()` passou a devolver
   `schedule_overrides:<data>`; o resto do mecanismo (travados em `umaRodada`)
   já cuidava da ordem.
7. **A fila de saída não aparecia fora da sessão de força** (§8). `/mais` ganhou
   a linha "Sincronização" (`components/mais/linha-sincronizacao.tsx`): quantos
   itens esperam, o erro do item mais antigo e um botão "Tentar agora". O texto
   sai de `resumoDaFila()` (pura, em `lib/outbox.ts`), que aponta o item
   travado quando ele passou de `MAX_TENTATIVAS`.
8. **"Sair" deixava tudo no aparelho** (§8 com §2). O logout só revogava a
   sessão: o cache de leitura do TanStack (uma semana de validade), a
   sessão/cardio em andamento, os blobs das fotos e as cópias das páginas
   autenticadas no service worker ficavam no celular. `limparDadosLocais()`
   (`lib/db.ts`) apaga o Dexie e todos os caches menos o `midia-do-treino` (as
   figuras, para o app seguir instalável); o `BotaoSair` chama isso e o
   `queryClient.clear()` antes da server action. Com a fila cheia o primeiro
   toque avisa quantos registros ainda não subiram e vira "Sair mesmo assim".
9. **`enfileirar()` devolvia em silêncio sem IndexedDB** (`lib/outbox.ts`).
   Num navegador sem IndexedDB a tela mostrava o registro salvo (cache
   otimista) e a escrita nunca chegava ao Supabase — o contrário de "nada se
   perde". Agora lança, e as telas mostram o erro que já tratam.
10. **Linhas de uma linha só cortavam informação útil.** `truncate` virou
    `line-clamp-2` no calendário (`grade.tsx`: a corrida perdia o "· 34 min", a
    nota do grease the groove sumia), no catálogo (`lista-exercicios.tsx`: a
    lista de equipamento) e no rótulo do timer de descanso.
11. **O campo do stepper tinha 37 px de largura** (`components/stepper-numerico.tsx`).
    A regra do CLAUDE.md é alvo ≥ 44 px nas **duas** dimensões, e o campo é o
    alvo de quem digita em vez de usar o − e o +. `min-w-11` no campo e no
    invólucro, `gap-0.5` no modo compacto.
12. **A folha do dia estava no limite** (`components/calendario/dialogos.tsx`):
    312 px de conteúdo numa caixa de 296. Os chips Força/Cardio/Descanso viraram
    `grid grid-cols-3` (Corrida/Corda, `grid-cols-2`) e `Opcao` ganhou
    `min-w-0` — sem ele o `flex-1` não encolhe abaixo do texto.
13. **Sem `/robots.txt`** o Next devolvia o HTML do app nessa URL (Lighthouse
    marcava robots.txt inválido). Entrou `app/robots.ts` com `disallow: "/"` —
    o app é pessoal — e `/robots.txt` na lista de rotas públicas do middleware.
14. **O "Salvar" desabilitado sumia no tema escuro**
    (`components/mais/tela-equipamento.tsx`): `bg-primary` a 50 % de opacidade
    é marrom com texto quase preto. Enquanto está desabilitado ele usa
    `variant="outline"`. (O "Guardar" da meta em `aba-peso.tsx` já era outline e
    nunca fica desabilitado.)
15. **`lerLista` duplicado** em `lib/queries/progresso.ts` e
    `lib/queries/corpo.ts` — a única duplicação real da varredura. Foi para
    `lib/queries/ler.ts`.
16. **`clsx` e `tailwind-merge` declarados e não usados** (o helper `cn` vem do
    pacote `cn`; `lib/utils.ts` só o reexporta). Saíram do `package.json` e do
    lockfile.

### Testes acrescentados

- `lib/corpo.test.ts`: `dominioFolgado` com lista vazia, 1 ponto, 2 pontos, 30
  pesagens e folga de 2.
- `lib/backup.test.ts`: `storage_path` reescrito com o `user_id` de quem
  importa, foto sem data / com ângulo inventado descartada, série cuja sessão
  não vem no arquivo descartada.
- `lib/outbox.test.ts`: o alvo das duas pontas de um mesmo dia da agenda e os
  quatro estados de `resumoDaFila` (vazia, esperando, com erro, travada).
- `lib/supabase/middleware.test.ts` (novo, com o `@supabase/ssr` de mentira):
  sem sessão → login, e-mail permitido passa, rota pública passa, e-mail de
  fora vai para `?erro=app-pessoal` **e o redirect leva junto os cookies
  apagados pelo `signOut`**.
- `e2e/corpo.spec.ts`: com 30 pesagens semeadas entre 81 e 83 kg, o menor
  rótulo do eixo y do gráfico de peso é ≥ 70 (e o maior ≤ 90); o da cintura,
  ≥ 80.
- `e2e/shell.spec.ts`: os cinco cabeçalhos de segurança em `/login` e em
  `/robots.txt`; `/robots.txt` com `Disallow: /` e sem HTML.
- `e2e/mais.spec.ts`: a linha "Sincronização" com a fila vazia; e, offline, o
  peso registrado aparecendo como pendente e o "Tentar agora" subindo tudo.
- `e2e/treinar.spec.ts`: o teste "todo alvo da sessão tem 44 px" passou a medir
  também a **largura**, com o `aria-label` do alvo na mensagem de falha.

### Conhecido, não corrigido (com o motivo)

- **CSP completa (script/style/connect/img/worker).** Só o `frame-ancestors`
  entrou. Uma CSP de verdade precisa liberar `connect-src` do domínio do
  projeto Supabase (rest, auth, storage e o `wss` do realtime), `img-src` com
  `blob:` e `data:`, `worker-src 'self'` e o `'unsafe-inline'` que o Next usa
  em style/script — e o projeto Supabase **ainda não existe**. Medir com
  `Content-Security-Policy-Report-Only` depois do deploy e só então forçar.
- **`npm audit --omit=dev`: 3 avisos de ferramenta de build.** `browserslist`
  (2 high) e `postcss` aninhado em `node_modules/next` (4 avisos). Só são
  exploráveis processando CSS ou config de terceiros durante o build; este
  projeto compila o próprio CSS. `npm audit fix` (sem `--force`) foi executado
  e **não mudou nada** — a correção do browserslist não está alcançável a
  partir da árvore atual; o postcss só sai com `next@16`, que é breaking.
  Deixar para uma atualização planejada do Next **depois** do deploy.
- **Aviso na tela quando o navegador não deixa guardar nada.** `enfileirar()`
  já lança (item 9), mas falta a checagem única na abertura (`bancoUsavel()` no
  `Providers`) e o aviso fixo no shell ("saia do modo privado"). No PWA
  instalado, que é o caso do Miguel, o IndexedDB existe sempre.
- **Lighthouse na tela Hoje: 78 de performance, LCP 4,3 s.** O shell
  autenticado carrega ~320 kB de JS antes de qualquer leitura. Encostar em 90
  pede renderizar o cabeçalho e o esqueleto do card no servidor e adiar o que é
  só interativo — mexida grande na arquitetura das telas, na véspera do deploy.
  Como o app é instalado e precacheado pelo Serwist, o custo real é só na
  primeira abertura. (A medição rodou com o mock devolvendo 401 nas leituras,
  então o número mede o shell, não o caminho completo.)
- **`<input type="date">` mostra a data no idioma do navegador.** No Chromium
  do CI (UI em en-US) sai `09/14/2026`, contra a regra de dd/MM da interface.
  Num celular em pt-BR sai dd/mm/aaaa — é observação de ambiente, não defeito
  do app. Trocar pelo seletor próprio custaria dois campos numéricos novos nas
  abas Peso e Medidas sem ganho para o dono.
- **`progression_events.session_id` não é filtrado na importação** como
  `session_sets.session_id` passou a ser. O evento pode existir sem a sessão
  (troca de fase, §5.1) e descartá-lo perderia a linha do tempo da §6.6; no
  banco de verdade a FK recusa sozinha a linha que aponta para o que não
  existe.
- **Etapas irmãs editando o repositório ao mesmo tempo** (achado operacional,
  não é defeito do app). Durante a auditoria duas medições de portão foram
  corrompidas por um `npm run build` e por um arquivo de teste sendo escrito
  no meio da execução. Só vale o portão rodado em janela sem build/vitest/
  playwright concorrente. Lembrar que `pkill -f "next start"` não mata o
  servidor (o processo se chama `next-server`): a 3100 e a 54321 ficam
  ocupadas por órfãos e derrubam o `npm run e2e` com "is already used".

### Portões

`npm run lint` limpo · `npm run build` (nenhuma rota acima de 344 kB de first
load; `/exercicios/[id]` caiu de 353 para 275 kB) · `npm test` **744**
unitários · `npm run e2e` **151** no Chromium de 360 × 740.

Nota de flakiness: em duas das quatro rodadas de `npm run e2e` desta etapa o
teste `auditoria-m5 › as 81 fichas` (e, numa delas, `/mais/preferencias › o
incremento do agachamento`) falhou; os dois passam sozinhos e as duas rodadas
seguintes fecharam 151/151. Não foi possível reproduzir com o teste isolado —
é o mesmo padrão descrito no achado operacional: só vale o portão rodado em
janela sem build/vitest/playwright concorrente.

### Como testar no celular

1. `npm run build && npm run e2e` (ou `npm run mock` + `npm run dev:mock` em
   dois terminais e o IP do computador no celular).
2. **Corpo → Peso**: registre três pesos próximos (82,4 · 82,1 · 82,6). O
   gráfico tem que mostrar as duas linhas separadas, com o eixo y na faixa dos
   82 — não uma reta num eixo de 0 a 100. Na aba **Medidas**, idem com a
   cintura.
3. **Catálogo → qualquer ficha**: toque numa das duas fotos. Ela abre em tela
   cheia; Esc, o X ou um toque fora fecham. A ficha é a rota mais pesada do
   app e agora carrega 275 kB.
4. **Mais**: a linha "Sincronização" diz "Tudo sincronizado". Ative o modo
   avião, registre um peso em Corpo, volte para Mais: aparece "1 item
   esperando". Tire o avião e toque em "Tentar agora".
5. **Mais → Sair** com algo na fila: o primeiro toque avisa quantos registros
   não subiram e o botão vira "Sair mesmo assim". Depois de sair, o app não
   mostra mais nada do usuário nem offline.
6. **Calendário**: toque num dia futuro — os três chips (Força/Cardio/Descanso)
   cabem lado a lado sem nada escapar para o lado.

---

## Re-verificação final ✅

Conferência independente das duas correções "importantes" da auditoria final,
no código e no navegador (mock), com os quatro portões rodados do zero numa
janela sem build/vitest/playwright concorrente.

### Os dois importantes: conferidos

1. **Eixo y dos gráficos de linha** — real e completo. `Comum` tem
   `dominioY?: [number|string, number|string]`, `eixos()` repassa para
   `<YAxis domain>` e as duas abas passam `dominioFolgado()` (folga 1 no peso,
   2 nas medidas). Visto no navegador com 30 pesagens entre 81 e 83 kg: o eixo
   vai de **80 a 84** e a série e a média de 7 dias aparecem separadas, como a
   §3.8 pede. As barras (volume, reps de fixa, minutos) e as linhas de carga
   dos grandes continuam na base zero, que era o pedido.
2. **First load da ficha** — real. A rota `/exercicios/[id]` fecha em
   **275 kB** (era 353). A causa de raiz era mais funda do que a auditoria
   apontou: `badge.tsx` e `button.tsx` importavam o `Slot` pelo guarda-chuva
   `radix-ui` e, vindos de um Server Component, arrastavam a biblioteca inteira.
   O ampliador virou `components/exercicios/foto-ampliada.tsx`, uma camada
   própria (`role="dialog"`, `aria-modal`, foco no X, Esc e toque fora fecham),
   em vez do `Dialog` do Radix. Conferido no navegador: abre, fecha pelos três
   caminhos e a sobreposição escurece a barra de navegação junto com o resto da
   página (medido no pixel: 250 → 50). Nenhuma rota passa de 344 kB.

### Ajuste desta etapa

- `e2e/corpo.spec.ts` > "a foto sobe para o bucket e aparece na galeria" era
  **instável** (falhou 2 de 5 execuções). Não é defeito do app: a linha de
  `progress_photos` é um segundo item da fila, enfileirado **depois** do
  arquivo, então ver o blob no bucket não quer dizer que o upsert já subiu — o
  teste lia a tabela sem esperar. A leitura virou um `expect.poll`, como as
  outras asserções de banco do arquivo já faziam. Instrumentado antes de
  mexer: a linha chega, sempre; só chega um pouco depois do arquivo.
- O outro teste que falhou numa rodada cheia (`cardio.spec.ts` > "'Fazer sessão
  de barra fixa' abre a sessão da semana com 4 × 5") passou 5 de 5 isolado e
  nas duas rodadas cheias seguintes. Fica como o ruído de ambiente já descrito
  acima, sem alteração.

### Portões (rodados do zero, nesta ordem)

```
npm run lint   limpo
npm run build  ✓ Compiled successfully · 90 páginas · maior rota 344 kB
               /exercicios/[id] 275 kB · shared 104 kB
npm test       Test Files 28 passed (28) · Tests 744 passed (744)
npm run e2e    151 passed (5.1m)
```

---

## Camada visual v2 — Marco V1 ✅

SPEC §13.2 e §13.3 (mais o vídeo opcional da §13.1 e as preferências novas da
§13.7). O v1 do app continua inteiro por baixo: motor, montagem, offline e
registro por série não foram tocados — o que mudou foi a casca.

### O que foi feito

**1. Sistema visual v2** (`components/ui/`, `app/globals.css`)

Tokens novos em `globals.css`, dentro da paleta que já existia (escuro
`#0a0a0a`, laranja de destaque, claro disponível): `--raio-cartao` (20 px),
`--sombra-cartao` (discreta no claro, **nenhuma** no escuro — lá quem separa é
a borda) e as três paradas do gradiente das capas. Três classes: `.cartao`,
`.capa-gradiente` e `.numero-grande` (a `.numero` do v1 continua).

Seis componentes reutilizáveis, sem biblioteca nova:

| componente | o que é |
|---|---|
| `components/ui/card-capa.tsx` | `CardCapa`: foto de capa (de `assets/`) com gradiente escuro, título/subtítulo/detalhe/raios por cima e o conteúdo embaixo. Sem foto vira gradiente com ícone — nunca imagem de terceiros |
| `components/ui/faixa-semana.tsx` | `FaixaSemana`: seg–dom, hoje em destaque, ✓ feito, ponto planejado, cinza faltou, traço no descanso. Navegável (setas) quando o chamador pede — é o que o Relatório do V2 vai usar |
| `components/ui/raios.tsx` | `Raios`: 1–3 raios com rótulo acessível ("Dificuldade: pesado (3 de 3)") |
| `components/ui/contador.tsx` | `Contador`: número grande + rótulo (os contadores do Relatório no V2) |
| `components/ui/miniatura.tsx` | `Miniatura`: figura animada, foto `-1.jpg` ou ícone, nessa ordem |
| `components/ui/botao-largo.tsx` | `BotaoLargo`: 56 px de altura, largura toda |

**2. Navegação** (`components/nav-inferior.tsx`) — `Treino · Explorar ·
Relatório · Corpo · Mais`, ícones lucide. `/` é Treino e acende também em
`/treinar`, `/cardio`, `/barra-fixa` e `/calendario` (a aba absorveu Treinar,
§13.2). `/explorar` e `/relatorio` nasceram nesta etapa: Explorar é um lugar
honesto ("em construção — marco V2", com o atalho para o catálogo) e Relatório
recebeu a tela de progresso inteira. `/progresso` faz `permanentRedirect` para
`/relatorio`.

**3. Aba Treino (`/`)** — `components/treino/`:

- `cabecalho.tsx`: saudação ("Quarta, 16/09"), chama com as semanas seguidas
  com a meta cumprida, `FaixaSemana` da semana civil (toque abre `/calendario`),
  "Meta semanal 2/5" com barra, e as duas caixas de Fase e Peso (com o pedido de
  pesagem da §3.1, que a v2 não revoga).
- `cards.tsx`: um card por sessão do dia. Força com capa na foto `-1` do
  primeiro exercício, nome + foco do JSON, "45 min · 6 exercícios", raios e
  "Começar treino" — ou "Continuar" com `2/16 séries` quando a sessão aberta é
  a de hoje. Cardio com capa (a corda tem foto no kit), "Começar" e a
  alternativa da corda. Descanso com as reps soltas ("+1" e o total) e, no
  domingo, "Começar caminhada leve". "Treinar mesmo assim" nos dias sem força.
- `lista.tsx`: a lista do treino do dia com miniatura, nome, prescrição, carga
  de hoje com o rótulo do implemento, a linha "(subiu +4 kg no treino de
  11/09)" (§6.6), raios, ⇄ para substituir e toque que abre a ficha.

**4. Sessão** (`/treinar/[sessionId]`) — cabeçalho de cada bloco com a
demonstração grande (vídeo se existir, senão a figura animada, senão a foto) e
"próximo: Desenvolvimento militar em pé" no rodapé fixo. A lista de `/treinar`
virou `CardCapa`. Nada mudou no que é registrado nem no motor.

**5. Vídeo opcional (§13.1)** — `npm run assets` copia `assets/videos/*.mp4`
para `public/videos` se a pasta existir; `npm run validar` aceita a pasta
ausente e, se ela existir, exige `.mp4` de exercícios que existem. A ficha e o
bloco da sessão mostram `<video muted loop playsinline>` quando o arquivo
existe. Nenhum vídeo entra no repositório (`.gitignore`).

**6. Preferências (§13.7)** — "Meta semanal" (inteiro ≥ 1, vazio = o padrão da
fase) e "Mostrar raios de dificuldade" (ligado por padrão), em `profiles.prefs`
como as demais.

### Funções puras novas (todas com teste)

| arquivo | o que faz |
|---|---|
| `lib/dificuldade.ts` | `dificuldadeDe(exercicio)` pela `categoria` (§13.4) e `dificuldadeDaColecao` (a maior) |
| `lib/metas.ts` | `metaSemanalPadrao` (as sessões de força + cardio da semana da fase, tiradas do `programa.json`), `metaSemanal`/`comMetaSemanal` (prefs), `feitosNaSemana`, `progressoDaMeta`, `sequenciaDeSemanas`, `sequenciaDeDias` |
| `lib/capas.ts` | `capaDoExercicio`, `capaDoTreino`, `miniaturaDoExercicio`, `capaDoCardio` — todo caminho vem do JSON |
| `lib/trocas.ts` | a escolha do ⇄ guardada por (data, treino), à prova de storage estragado |
| `lib/videos.ts` | os ids com `public/videos/<id>.mp4` (lado servidor) e `lib/videos.cliente.ts` com a URL |
| `lib/semana.ts` | `faixaDaSemana(grade)` — a faixa deriva da mesma grade do calendário |
| `lib/hoje.ts` | `detalheDoTreino`, `progressoDaAberta` e o `trocas` de `previaDoTreino` |
| `lib/sessao.ts` | `comSubstituicoes` (aplica as trocas à sessão recém-montada) e `proximoExercicio` |
| `lib/formato.ts` | `formatarDiaEData` ("terça, 15/09") |

### Decisões desta etapa

1. **O ⇄ da aba Treino guarda a escolha** (`lib/trocas.ts` no `localStorage`,
   por data + treino) e `criarSessao` a aplica com o mesmo
   `substituirExercicio` da sessão (§3.2/§6.3): o substituto entra com o estado,
   a prescrição e o descanso **dele**, e o bloco continua sabendo quem era o
   original ("no lugar de …"). Era a alternativa mais fiel ao "mesmo fluxo da
   sessão" — a outra (sair da aba levando a troca na URL) tirava o Miguel da
   tela no meio da escolha. Sem storage a escolha ainda vale na tela, só não
   sobrevive ao "Começar treino".
2. **"Continuar" só para a sessão aberta de hoje.** Uma sessão aberta de outro
   dia continua no banner com Continuar **e** Descartar (§3.1): o card do dia
   não pode fingir que o treino de anteontem é o de hoje.
3. **Capa do cardio.** Corda usa a foto de execução que existe no kit; corrida
   e caminhada ficam com o gradiente e o ícone — não há foto de corrida em
   `assets/` e inventar uma seria imagem de terceiros (§13.1).
4. **A lista do dia só aparece em dia de força.** Em dia de cardio ou descanso
   o que existe é o card do dia mais o "Treinar mesmo assim"; listar um treino
   que não é o de hoje confundiria a leitura.
5. **O vídeo da ficha é decidido no build**, porque as 81 fichas são estáticas
   (SSG) — quem largar um `assets/videos/<id>.mp4` roda `npm run assets` e o
   build seguinte mostra. Na **sessão** (rota dinâmica) a lista é lida a cada
   render, e é por isso que o e2e do vídeo mexe na sessão: ele cria o mp4
   depois do build. Sem fallback por erro no `<video>`: quem disse que o
   arquivo existe foi o servidor, e um arquivo estragado tem de aparecer
   estragado.
6. **A tela de progresso mudou de endereço, não de conteúdo.** `/relatorio`
   mostra hoje exatamente o que `/progresso` mostrava (título "Relatório"); os
   contadores, o histórico, as sequências e o IMC da §13.5 são o marco V2.
7. **`components/hoje/` saiu** (tela, cards, faixa de status e prévia): tudo o
   que continuava valendo virou `components/treino/`, sem código morto.

### E2E

- **`e2e/treino-v2.spec.ts`** (11 testes, todos novos): faixa com ✓ nos dias
  semeados e `data-marca` por dia, meta 2/5, a chama aparecendo quando a meta
  baixa para 2, os cards de segunda/terça/quinta/domingo, a lista com
  miniatura + prescrição + carga com rótulo, o "Continuar" com `2/16 séries`, o
  ⇄ que chega na sessão, `/progresso` → `/relatorio`, Explorar honesto, os
  raios que a preferência desliga e o vídeo opcional (mp4 temporário, criado e
  apagado pelo teste).
- **Antigos ajustados sem afrouxar**: `hoje.spec.ts` → `treino.spec.ts` e
  `progresso.spec.ts` → `relatorio.spec.ts` (mesmas asserções, rótulos e rotas
  novas); `shell.spec.ts` com as cinco abas da §13.2; dois ajudantes novos em
  `fixtures.ts` — `esperarAbaTreino` (a tela `/` não tem mais o título "Hoje") e
  `irNaAba` (a lista do dia tem links cujo texto contém "peso do corpo", e um
  `getByRole("link", { name: "Corpo" })` solto casava com eles).

### Portões (rodados nesta ordem, janela sozinha)

```
npm run lint   limpo
npm run build  ✓ Compiled successfully · 90 páginas · 27 rotas
npm test       Test Files 34 passed (34) · Tests 806 passed (806)
npm run e2e    162 passed (5.5m) — Chromium 360 × 740
```

Unitários: 747 → **806** (+59). Ponta a ponta: 151 → **162** (+11).

### Como testar no celular

1. `npm run build && npm run mock` num terminal e `npm run dev:mock` noutro (ou
   `npx next start -p 3100` com as três variáveis).
2. No celular, `http://<ip-do-computador>:3000`: a aba **Treino** abre com a
   saudação do dia, a faixa da semana, a meta e o card do dia.
3. Toque na faixa → calendário. Toque num exercício da lista → ficha. Toque no
   ⇄ → escolha um substituto e comece o treino: o bloco já nasce com ele.
4. **Mais → Preferências**: mude a "Meta semanal" para 2 e volte à aba Treino —
   a barra e a chama mudam. Desligue "Mostrar raios de dificuldade" e os raios
   somem da lista e dos cards.
5. Para ver o vídeo opcional: ponha um `.mp4` em `assets/videos/<id>.mp4`, rode
   `npm run assets` e abra a sessão desse exercício (a ficha pede um build
   novo).

### Capturas da revisão

`scripts/capturas.ts` (ferramenta, não portão) sobe contra o mock semeado e
grava as telas a 360 × 740. Nesta etapa: `01-treino-escuro.png`,
`01-treino-escuro-completo.png`, `02-treino-claro.png`, `03-treino-lista.png`,
`04-sessao.png`, `05-treinar.png` e `06-mais-preferencias.png`.

### O que falta (marcos V2 e V3)

- **V2**: Explorar de verdade (coleções derivadas, §13.4), sessão livre com
  `sessions.plano`, circuito guiado (§13.6), Relatório completo (contadores,
  histórico, sequências, IMC) e o IMC no Corpo (§13.7).
- **V3**: auditoria da camada visual inteira (360 px nos dois temas, offline,
  conteúdo só dos JSON) e os critérios de aceite da §13.8.

### Auditoria independente do marco V1 (rodada 1)

Outro agente rodou os quatro portões de novo (lint limpo, build ✓, 806
unitários, 162 e2e) e usou o app no Chromium a 360 × 740 contra o mock semeado,
nos dois temas, em quatro dias (segunda de força, terça de cardio, quinta de
descanso, domingo de caminhada). Medido elemento a elemento: **nada vaza** dos
360 px, **nenhum alvo** abaixo de 44 px na aba Treino e **nenhum texto** abaixo
do contraste AA (4,5:1, ou 3:1 no texto grande) nos dois temas. A sessão foi
feita de ponta a ponta — steppers, timer de 2:30, recarregar no meio, uma série
registrada **sem rede** que subiu sozinha ao voltar, conclusão com o resumo,
seis `progression_events` e o `exercise_state` atualizado. O vídeo opcional foi
conferido de verdade: com `assets/videos/agachamento-livre.mp4` + `npm run
assets` + build, a **ficha** mostra o `<video>`; sem o arquivo, a figura — e o
console não tem nenhum 404.

Um defeito visual foi encontrado e corrigido nesta rodada:

- **O selo "hoje" passava por cima do título do card de cardio.** A caixa de
  texto da capa era `absolute bottom-0` dentro de uma capa de altura fixa: com
  o subtítulo e o detalhe em duas linhas, ela crescia para cima, saía da foto e
  batia no selo. Agora a capa é `min-h` com `justify-end` e a caixa de texto é
  `relative` (com espaço reservado para o selo), então a capa cresce em vez de
  transbordar — `components/ui/card-capa.tsx`.
- **O subtítulo do card de cardio era a regra de agenda do `cardio.json`**
  ("Corrida em dia de perna, nunca. Fase 1: cardio na terça…"), que já aparece
  logo abaixo como aviso e não descreve a sessão do dia. A §13.3 pede título,
  detalhe e botão — o subtítulo saiu (`components/treino/cards.tsx`).

E um e2e antigo foi endurecido (sem afrouxar o que ele verifica): em
`e2e/auditoria-offline.spec.ts`, "a conclusão não passa na frente" lia a ordem
dos POSTs sem esperar os `progression_events`, que são a última coisa que a
fila entrega — falhava uma vez a cada tantas rodadas. Agora espera a fila
terminar e confere a mesma ordem.

Pendências pequenas registradas, sem bloquear o marco: o link "Exercícios"
dentro do texto de `/explorar` tem 70 × 16 px (é um link em linha, e a tela
inteira é provisória — some no marco V2), e o pill do `Switch` continua com
18 px de altura com a área de toque no `::after` (herdado do v1, coberto por
e2e).

---

## Camada visual v2 — Marco V2 ✅

SPEC §14.1 (player unificado), §14.2 (ficha em folha), §14.4 (preferências novas
e o card de IMC que a conclusão usa). O v1 continua inteiro por baixo: o motor
(`lib/progressao.ts`), a montagem (`lib/montagem.ts`) e o que é gravado
(`session_sets`, `exercise_state`, `progression_events`, `profiles.ultimo_treino`)
não mudaram uma linha.

### Arquitetura do player

```
app/(app)/treinar/[sessionId]/page.tsx
  └── components/player/tela-player.tsx      (o container: passo atual + folhas)
        ├── components/treinar/usar-sessao.ts  (o estado da sessão, um só)
        ├── lib/player.ts                      (a sequência de passos, pura)
        ├── components/player/preparacao.tsx   passo "preparacao"
        ├── components/player/exercicio.tsx    passo "serie"  (+ controles)
        ├── components/player/descanso.tsx     passo "descanso" (tela cheia)
        ├── components/player/firme.tsx        passo "firme"
        ├── components/player/feedback.tsx     passo "feedback"
        ├── components/player/conclusao.tsx    passo "conclusao"
        └── components/treinar/visao-geral.tsx (a folha de rolagem, pelo ícone
                                                de lista — era a tela do v1)
```

`useSessaoDeTreino` (`components/treinar/usar-sessao.ts`) é o dono do estado:
carrega a sessão do Dexie (ou a refaz do banco, §8), grava cada toque,
enfileira as escritas e roda o motor no fim. O player e a visão geral são duas
telas da **mesma** sessão — não há duas cópias nem duas gravações concorrentes.

### A máquina de estados (`lib/player.ts`, pura, 35 testes)

`sequenciaDoPlayer(sessao, { preparacaoS, descansoPadraoS })` devolve a lista de
passos:

```
preparacao → [por exercício: aquecimentos → séries de trabalho → firme?]
           → feedback → conclusao
```

com um **descanso** entre séries do mesmo exercício e outro entre exercícios
(depois do "firme?"). No Treino A isso dá 18 passos de série (16 de trabalho +
2 de aquecimento), 6 perguntas "firme?" e 5 descansos entre exercícios.

| peça | o que faz |
|---|---|
| `Passo` | união de `preparacao · serie · descanso · firme · feedback · conclusao`, cada um com a **chave** estável que o identifica (`serie:<uuid da série>`) |
| `EstadoPlayer` | `{ chave, fimEm, totalS }` — onde estamos e quando a contagem acaba. Vive **dentro da sessão** (`SessaoLocal.player`), no Dexie; `escritaDaSessao` não o envia ao banco |
| `indiceDeRetomada` | sem passo salvo (sessão refeita noutro aparelho): preparação se nada foi marcado, a primeira série que falta se algo foi, feedback se tudo foi |
| `apos` / `seguinte` / `anterior` | o ✓ vai para o passo seguinte (o descanso); as setas **pulam** os descansos, que são passagem, não destino |
| `estadoDoPasso` / `restanteS` / `somarSegundos` / `definirDuracao` | o relógio, sempre ancorado em `Date.now()` — nunca uma soma de ticks. "+20 s" empurra o **fim** (a 0:10 de um descanso de 2:30 a resposta é 0:30, não 2:50) |
| `entradaDoPasso` | o bloco central por tipo: `carga · reps · tempo · passos · maximo · assistida`, mais `unilateral` (dois números, D e E) |
| `OPCOES_DE_FEEDBACK` | as 5 opções da referência → `sessions.sensacao` |
| `anterioresPorExercicio` / `serieAnteriorDe` | a linha "anterior: 9,5 kg × 5" |

**Mapeamento do feedback (SPEC §14.1.4):** `sessions.sensacao` é o esforço
percebido de baixo para cima — **1 = Muito difícil · 2 = Um pouco difícil ·
3 = Na medida certa · 4 = Um pouco fácil · 5 = Muito fácil**. Na tela as opções
aparecem na ordem da referência (do mais fácil para o mais difícil), por isso a
lista começa no 5. O resumo do fim (`components/treinar/resumo.tsx`, usado no
abandono e no "Concluir" da visão geral) passou a usar **as mesmas cinco
opções** — antes ele tinha uma escala própria ("péssimo… ótimo") na mesma
coluna, o que dava dois significados para o mesmo número.

### O que cada tela faz

1. **Preparação** — anel SVG próprio (`components/player/anel.tsx`, sem
   biblioteca nova), "PREPARADO PARA COMEÇAR", nome do 1º exercício com o "?",
   "Começar agora". Ao zerar, começa sozinha.
2. **Exercício** — figura animada grande (ou o vídeo local da §13.1), barra fina
   de progresso, nome + "?", `Série 2 de 3 · exercício 1 de 6`, o bloco central
   do tipo com números de 30 px tabulares e steppers − / + de 56 px, "anterior:
   9,5 kg × 5", "montagem", e no topo os ícones **lista · gostei · não gosto ·
   Ajustar**. Rodapé fixo **anterior · ✓ · próximo** (56 px).
3. **Descanso** — tela cheia no laranja escurecido (tokens `--descanso-*` em
   `globals.css`, texto AA nos dois temas), figura do próximo, "PRÓXIMO 2/6" ou
   "Série 2 de 3", nome × prescrição, contagem de 72 px, "Editar tempo de
   descanso", "+20 s", "Pular". Ao zerar: bipe (WebAudio) + vibração onde
   existir; com `prefs.avancar_sozinho` avança 1 s depois, senão espera o toque.
4. **"Última repetição saiu firme?"** — Fácil · Firme · Falhei (→ `ultima_firme`
   true/true/false) e a nota curta. Qual dos dois "sim" foi tocado fica só na
   tela: a coluna do banco é booleana.
5. **Feedback** — as cinco opções.
6. **Conclusão** — capa (foto `-1` do 1º exercício), "Excelente! Você concluiu o
   treino.", subtítulo (`Treino B · semana 2 da fase`), contadores
   **Exercícios · Minutos · Volume (kg)**, o **resumo do motor** (↑ = ↓,
   avisos, sugestões, recordes), o card **Semana N · feitos/meta** com os sete
   círculos e o troféu, **Peso de hoje** e o card **IMC**, e o "Próximo".

### Ficha em folha (§14.2)

`components/exercicio/ficha-folha.tsx` — um componente só, usado como bottom
sheet (aba Treino, player, catálogo) e como **página inteira** em
`/exercicios/[id]` (`comoPagina`): título + Substituir, abas **Vídeo ·
Músculos · Tutorial**, stepper **Repetições/Duração + Séries** (só com uma
sessão aberta), Instruções, Erro comum, **Área de foco** em chips (primário
forte, secundário claro), Montagem, Como progredir, histórico e recorde,
anterior/próximo (n/N) e Fechar.

- **Tutorial**: `data/tutoriais.json` (81 entradas, uma por exercício) passou a
  ser validado por `tutorialSchema` em `lib/schemas.ts` (id do YouTube com 11
  caracteres do alfabeto certo) e lido por `tutorialPorExercicio()` em
  `lib/dados.ts`; `npm run validar` confere que todo exercício tem tutorial e
  que nenhum id sobra. A aba mostra a miniatura
  `https://i.ytimg.com/vi/<id>/hqdefault.jpg` com o play e **só ao tocar** vira
  `<iframe src="https://www.youtube-nocookie.com/embed/<id>">`. Sem rede
  (`navigator.onLine` false ou a miniatura falhando) a aba vira "Precisa de
  internet" + "Abrir no YouTube".
- **Stepper**: `ajustarPrescricaoDaSessao()` (`lib/sessao.ts`) muda **só** as
  séries desta sessão — o valor pré-preenchido das que faltam e quantas são —
  nunca `exercise_state` nem o alvo do motor. Série concluída segura o corte.

### Preferências novas (§14.4)

`components/mais/ajustes-do-treino.tsx` é o mesmo bloco em **Mais →
Preferências** e no **Ajustar** (engrenagem) do player: preparação (s),
descanso padrão (s, vazio = o do exercício), avançar sozinho, som, vibração,
voz, tela acesa, mostrar raios e **limpar "não gosto"**. Tudo em
`profiles.prefs` (`preparacao_s`, `descanso_padrao_s`, `avancar_sozinho`,
`evitar_exercicios[]`), com as funções puras em `lib/preferencias.ts`.

**Gostei / não gosto**: o polegar para baixo no player grava
`prefs.evitar_exercicios[]`; `evitadosPorUltimo()` joga esses ids para o fim da
lista de substitutos (aba Treino, visão geral e ficha) e do catálogo dos 81,
com a etiqueta "você marcou como evitar". A ordem do treino do dia **não** é
mexida: ela é o programa.

### Decisões desta etapa

1. **A sessão só é gravada no "Próximo" da conclusão.** A tela de conclusão
   mostra `avaliarSessao(...)` — exatamente a decisão que `concluirSessao` vai
   gravar —, e o botão final chama o mesmo `finalizarSessao` de sempre, com a
   sensação e o peso do dia. Assim nada muda no que é gravado e o resumo nunca
   pode divergir do que subiu. Fechar o app na conclusão deixa a sessão aberta,
   como já acontecia com o diálogo do v1; reabrir volta na conclusão.
2. **A folha de rolagem virou a visão geral**, atrás do ícone de lista, com os
   mesmos componentes de série (edição de qualquer série, substituir, montagem,
   nota) e o mesmo rodapé de Concluir/Abandonar. Ela é um overlay que para em
   cima da barra de abas — a navegação continua alcançável.
3. **O passo atual mora dentro da sessão** (`SessaoLocal.player`), não numa
   tabela nova nem numa coluna do banco: é estado de aparelho. Sessão refeita
   noutro celular não tem passo salvo e usa `indiceDeRetomada`.
4. **Defeito real encontrado e corrigido:** `useSessaoDeTreino.mexer()` lia a
   sessão do fecho da renderização. O ✓ do player faz **duas** mudanças no
   mesmo toque (marcar a série e andar para o descanso), e a segunda partia do
   estado de antes da primeira — o registro que acabara de entrar sumia da
   sessão local (subia para o banco, mas a conclusão avaliava como se nada
   tivesse sido feito). Agora `mexer` parte de uma referência sempre atual
   (`ultima.current`).
5. **`useUltimasSeries`** é uma consulta separada da `useSeriesAnteriores`: uma
   alimenta a linha "anterior: …" do player (com carga e tempo), a outra
   alimenta o motor no tipo `maximo` e é pedida para o treino **mais todos os
   substitutos**. Misturar as duas mudaria o recorte de linhas que o motor vê.
6. **O aquecimento não mostra "anterior: …"** — a comparação é com a série de
   trabalho correspondente, e o aquecimento não é comparado com nada.
7. **Sem dependência nova**: o anel de contagem é um SVG de 60 linhas; o som
   continua sendo o `apitar()` da WebAudio.

### Testes

- **Unitários: 806 → 863** (+57). Novos: `lib/player.test.ts` (35 — sequência do
  Treino A com aquecimento, tipos carga/reps/tempo/passos/máximo/assistida/
  unilateral, retomada, pular, +20 s, editar tempo, feedback, "anterior"),
  `lib/imc.test.ts` (8), mais os de `ajustarPrescricaoDaSessao`,
  `contadoresDaSessao` e das preferências novas.
- **Ponta a ponta: 162 → 171** (+9), todos em `e2e/player.spec.ts`: a
  coreografia preparação → exercício → ✓ → descanso (+20 s, editar, pular);
  fechar e reabrir no meio do descanso voltando ao mesmo passo; offline no meio
  sem perder nada; o Treino A inteiro pelo player até a conclusão com a subida
  no resumo e o `exercise_state` gravado; o circuito de core (reps e tempo);
  a ficha com as três abas, o Tutorial só ao tocar (e sumindo sem rede) e o
  stepper que muda só a sessão; a visão geral; o gostei/não gosto.
- **Antigos ajustados, sem afrouxar**: `treinar.spec.ts`,
  `auditoria-offline.spec.ts` e `cardio.spec.ts` passam pelo player até a visão
  geral (`abrirVisaoGeral` em `fixtures.ts`) e continuam verificando as mesmas
  asserções; `catalogo.spec.ts` e `auditoria-m5.spec.ts` abrem a aba "Músculos"
  para o mapa (que agora mora nela) e leem "Instruções" no lugar de "Passos";
  `treino-v2.spec.ts` confere que a lista do dia abre a **folha** (§14.2);
  `auditoria-m6.spec.ts` rola até o interruptor (a tela de preferências cresceu).

### Portões (rodados nesta ordem, janela sozinha)

```
npm run lint   limpo
npm run build  ✓ Compiled successfully · 90 páginas · 27 rotas
npm test       Test Files 36 passed (36) · Tests 863 passed (863)
npm run e2e    171 passed (6.7m) — Chromium 360 × 740
```

> Números refeitos na auditoria independente (rodada 1, mais abaixo): com os
> três e2e novos (o "avançar sozinho" e os dois de contraste do descanso) a
> suíte passou a ter **174** testes, e os quatro portões ficaram verdes depois
> das quatro correções descritas lá.

### Como testar no celular

1. `npm run build`, `npm run mock` num terminal e `npm run dev:mock` noutro (ou
   `npx next start -p 3100` com as três variáveis).
2. No celular, `http://<ip-do-computador>:3000` → **Começar treino**. O player
   abre na preparação; toque em "Começar agora".
3. Toque no ✓: o descanso toma a tela inteira com o próximo passo. Experimente
   "+20 s", "Editar tempo de descanso" e "Pular"; espere zerar para ouvir o
   bipe e sentir a vibração.
4. **Feche o app no meio do descanso e abra de novo**: volta no mesmo passo,
   com o tempo certo (o relógio é o do sistema).
5. Toque no "?" → a ficha em folha; passeie pelas abas **Vídeo · Músculos ·
   Tutorial** (o Tutorial só busca o YouTube quando você toca no play) e mexa
   no stepper "Só nesta sessão".
6. Ícone de lista (canto superior esquerdo) → a folha com todas as séries;
   "Voltar ao treino" fecha.
7. Vá até o fim: "Última repetição saiu firme?" no fim de cada exercício, o
   feedback do treino e a conclusão com o resumo do motor, a semana e o IMC.
   O "Próximo" é quem grava.
8. **Mais → Preferências → Treino**: mude a preparação para 3 s e o descanso
   padrão para 45 s, desligue "Avançar sozinho" e comece outro treino.

### Capturas da revisão

`scripts/capturas.ts <pasta> v2` (ferramenta, não portão): `01-preparacao`,
`02-exercicio-carga` (+ `-claro`), `03-descanso`, `04-firme`,
`05-exercicio-tempo`, `06-feedback`, `07-conclusao` (+ `-completa` e `-claro`),
`08-ficha-video`, `09-ficha-musculos`, `10-ficha-tutorial`, `11-visao-geral` —
todas a 360 × 740. Sem internet na máquina de captura, a aba Tutorial aparece
no estado "Precisa de internet", que é exatamente o que o Miguel vê no modo
avião.

### O que falta (marco V3)

Explorar de verdade (coleções derivadas, §13.4 e §14.4), sessão livre com
`sessions.plano`, circuito guiado (§13.6), Relatório completo (contadores,
histórico, sequências, Peso e IMC), IMC também no Corpo, e os acréscimos da
§14.3 na aba Treino (Editar/reordenar, FAB Ajustar, Desafios, Parte do corpo em
foco, Personalizar). Depois, a auditoria final da §14.5.

### Auditoria independente do marco V2 (rodada 1)

Outro agente refez os quatro portões do zero e usou o app no Chromium a
360 × 740, **nos dois temas**, com sessões semeadas no mock e medindo elemento
a elemento. Quatro defeitos reais saíram daqui — dois do app, um da
suíte e um dos portões — e os quatro foram corrigidos.

**Defeito 1 (app): o descanso nunca avançava sozinho.** `prefs.avancar_sozinho`
vem ligado por padrão e a §14.1.3 manda a tela passar ao próximo passo 1 s
depois de zerar. O efeito de `components/player/descanso.tsx` tinha `aoPular`
na lista de dependências; como `aoPular` nasce de novo a cada renderização e o
player redesenha a cada 250 ms enquanto conta, o `setTimeout` de 1 s era
cancelado e recriado antes de disparar — na prática o descanso ficava parado em
0:00 esperando um toque, com ou sem a preferência ligada. Agora a função mora
numa referência (`pular.current`) e o efeito depende só de `acabou` e
`avancarSozinho`.

A regressão ficou guardada por um e2e novo em `e2e/player.spec.ts` ("ao zerar,
'avançar sozinho' passa ao próximo passo; desligado, espera"), que instala o
relógio (`page.clock.install`) e empurra o tempo com `runFor`. **O teste foi
conferido contra o código antigo**: com o `aoPular` de volta nas dependências
ele falha ("Expected: hidden / Received: visible"), e passa com a correção.

**Defeito 2 (suíte): o teste da ficha falhava na suíte inteira e passava
sozinho.** `e2e/player.spec.ts` serve a miniatura do YouTube por `page.route`,
mas **o `page.route` do Playwright não alcança o que o service worker busca**.
Assim que o Serwist assume a página (`skipWaiting` + `clientsClaim`), a
miniatura vira um `fetch` do worker: a rota falsa nunca é chamada e o pedido sai
para a internet de verdade, que não existe na máquina de testes. O `onError` do
`<img>` então trocava a miniatura pelo aviso "Precisa de internet" no meio do
teste e o toque caía num elemento que já saíra do DOM. Como o momento em que o
worker assume depende da carga da máquina, o teste passava sozinho e caía na
suíte inteira — foi medido: `page.route` chamada **0 vezes** depois de
`navigator.serviceWorker.controller` existir.

Correção: `test.use({ serviceWorkers: "block" })` **só** no `describe` da ficha,
que verifica o comportamento da ficha e não o do service worker (esse tem os
próprios testes em `e2e/pwa.spec.ts`). Nada foi afrouxado: o teste ganhou duas
asserções novas — que a rota falsa foi de fato usada e que o aviso "Precisa de
internet" **não** aparece — para que uma falha futura da miniatura apareça como
erro claro em vez de instabilidade.

**Defeito 3 (app, tema claro): o campo do "Editar tempo de descanso" sumia.**
O stepper e os botões de contorno são componentes do tema normal (fundo
`--background`, quase branco no claro), mas herdavam a cor do texto da tela de
descanso, que é `--descanso-texto` = `#ffffff`. Resultado: branco sobre
quase-branco — o número do tempo (e o − e o +) ficavam ilegíveis no tema claro.
No escuro passava despercebido porque lá o fundo do campo é escuro. A correção
é uma classe: a linha de edição em `components/player/descanso.tsx` volta a
`text-foreground`. Guardado por dois e2e novos ("o campo do 'Editar tempo de
descanso' é legível no tema dark/light"), que fazem a conta de contraste da
WCAG com as cores que o navegador **de fato** aplicou — não com os tokens do
CSS, que era justamente o que escondia o problema.

**Defeito 4 (portão): `npm run lint` virava loteria depois de um e2e com
falha.** O `eslint` varria `test-results/`, e o JS de terceiros que o Playwright
guarda dentro do `trace.zip` dispara `@typescript-eslint/no-this-alias` — 1
erro, portão vermelho, sem uma linha de código nossa envolvida. `test-results/**`
e `playwright-report/**` entraram nos `ignores` de `eslint.config.mjs`.

O que a auditoria mediu, tela a tela, nos dois temas:

- **Nada vaza para o lado e nada fica fora da tela** em preparação, exercício,
  descanso (inclusive editando o tempo), série de trabalho, "firme?", feedback
  e conclusão: `scrollWidth - clientWidth = 0` e nenhum retângulo com
  `right > 360`.
- **Nenhum alvo abaixo de 44 px** em nenhuma dessas telas, e os três controles
  do rodapé do player em **56 × 56** (o ✓ em 208 × 56), como a §14.1.2 pede.
- **Contraste do descanso**: branco sobre `#7a2a08` (claro) = 9,71:1 e
  `#f5f5f4` sobre `#2a1206` (escuro) = 16,21:1; o destaque dá 6,35:1 e 7,81:1.
  AA com folga nos dois temas — **depois** do defeito 3, que não estava nos
  tokens e sim na herança de cor dentro da tela.
- **Wake Lock** é pedido ao entrar no player e **liberado** ao sair pela barra
  de abas (stub de `navigator.wakeLock` contando `request`/`release`).
- **Tutorial**: com `page.on("request")` ligado, **nenhum** pedido ao YouTube
  antes de abrir a aba; com a aba aberta sai só a miniatura
  `i.ytimg.com/vi/<id>/hqdefault.jpg`, que é o que a §14.2 manda; o embed
  `youtube-nocookie.com` só depois do toque.
- **O stepper da ficha não encosta em `exercise_state`**: a tabela no mock fica
  byte a byte igual depois de mexer em Repetições e em Séries.
- **Preferências novas mandam no player**: `preparacao_s` 5 mostra "5" no anel
  e `descanso_padrao_s` 30 dá "0:30" no descanso.
- **`data/tutoriais.json` não é conteúdo inventado**: 81 entradas, uma por
  exercício, sem repetição; 12 `youtube_id` sorteados foram conferidos no
  oEmbed do YouTube e todos existem, com o canal batendo (duas "divergências"
  de título são só emoji e truncagem).
- **Motor e montagem intocados** (`git diff 0085878..HEAD` vazio em
  `lib/progressao.ts` e `lib/montagem.ts`) e **nenhuma dependência nova**
  (`package.json` e `package-lock.json` idem). Sem kcal, sem confete.
- A tela de "Repetições ⇄ Tempo" **não** existe, e está certo: nenhum dos 81
  exercícios tem prescrição que aceite os dois (§14.1.2, "não inventar").

Capturas em `capturas/v2/`: além das 16 do marco, a auditoria gerou o percurso
inteiro nos dois temas (`dark-01…07b` e `light-01…07b`), todas 360 × 740.

Conhecidos, para quem pegar o marco V3:

- **O chip "montagem" fica ~11 px por baixo da barra de controles** na série de
  trabalho que tem a linha "anterior: …" (medido: chip termina em 621,6 px, a
  barra começa em 611). A página rola 138 px e o chip aparece, mas a tela deixa
  de caber de uma vez. O orçamento vertical a 740 px é: ícones 16–64, barra de
  progresso 76–80, figura 92–268 (`h-44`), nome 280–324, "Série 1 de 3" 336–356,
  steppers 368–534, "anterior" 546–566, chip 578–622. Para caber mesmo com um
  nome de duas linhas não basta encolher a figura (`h-40` dá 5 px de folga):
  o jeito seguro é pôr "anterior: …" e o chip **na mesma linha**, que devolve
  32 px de uma vez.
- Na tela "Última repetição saiu firme?", tocar numa das três opções já avança:
  quem quiser escrever a **nota curta** tem de escrever antes de escolher.
- A tela de descanso mostra a prescrição do **bloco** ("3 × 5") mesmo quando o
  próximo passo é um aquecimento.
- §14.5.3 está meio provada: o circuito de core roda no player (reps e tempo,
  e2e), mas **gravar como sessão livre** não dá para provar ainda — não existe
  caminho para criar sessão livre, que é "Personalizar treino" / "Parte do
  corpo em foco" do marco V3.

## Camada visual v2.1 — Marco Mídia ✅

O app deixou de depender só das 67 figuras animadas do kit: 77 dos 81
exercícios passaram a ter **ilustração com licença livre** (Everkinetic e
wger, CC BY-SA), e o boneco do sprite antigo deu lugar a um **mapa anatômico**
de frente e costas (MuscleMap, MIT). É a decisão do dono de 15/09/2026, escrita na
**SPEC §15 ("Mídia dos exercícios")** e na tabela §4 de
`docs/analise-referencia-treino-em-casa.md`: usar imagem de terceiros só com
licença livre, com autor/licença/link no JSON, crédito sob a mídia e em
Mais → Créditos, e o texto da licença publicado quando ela exigir.

Nada do motor mudou: `lib/progressao.ts`, `lib/montagem.ts` e o que vai para o
banco (`session_sets`, `exercise_state`, `progression_events`) continuam iguais
ao v1. O marco é imagem e crédito, ponto.

### De onde veio cada ilustração

| fonte | correspondência exata | aproximada | total |
|---|---|---|---|
| Everkinetic (via Wikimedia Commons / opentraining-exercises) | 60 | 6 | **66** |
| wger (colaboradores, autor por arquivo) | 10 | 1 | **11** |
| **total com ilustração** | 70 | 7 | **77** |

Os **4 que seguem com a figura animada do kit**, porque não havia ilustração
livre que mostrasse o movimento: `farmer-s-walk` (tem figura), `escalador`,
`salto-basico` e `corrida-no-lugar-com-a-corda` (os três sem figura, com as
duas fotos). Na ficha deles nada mudou.

Os 7 "aproximada" (a ilustração mostra o movimento, não exatamente a nossa
variação) são `flexao-inclinada`, `barra-fixa-com-lastro`, `face-pull`,
`agachamento-goblet`, `abdominal-completo`, `barra-fixa-assistida` e
`good-morning-com-elastico`. A palavra fica gravada em `data/ilustracoes.json`
(`correspondencia`), não escondida.

São 145 arquivos em `assets/ilustracoes/` (30 SVG + 115 WebP, ~6,3 MB): duas
posições por exercício, menos 9 que só tinham uma boa imagem na fonte
(`remada-unilateral-serrote`, `face-pull`, `rosca-inversa`,
`agachamento-bulgaro`, `terra-romeno-com-halteres`,
`elevacao-de-pernas-na-barra-fixa`, `abdominal-com-anilha`, `russian-twist`,
`salto-com-joelho-alto`) — essas ficam paradas, sem alternância.

### As peças novas

| arquivo | o que faz |
|---|---|
| `scripts/importar-ilustracoes.ts` | `npm run ilustracoes <pasta>`: aplica a regra de escolha (Everkinetic exata → wger exata → Everkinetic aproximada → wger aproximada → nenhuma), converte PNG/JPEG/WebP para **WebP de no máximo 640 px** com `sharp` (SVG fica SVG), escreve `assets/ilustracoes/`, `data/ilustracoes.json` e `data/ilustracoes-creditos.md`. **Fora do build**: o resultado é versionado |
| `data/ilustracoes.json` | 77 entradas `{exercicio_id, fonte, correspondencia, arquivos[{arquivo,largura,altura}], autor, licenca, url_fonte, titulo_fonte, nota}`. Sem autor **e** licença a entrada não existe |
| `lib/schemas.ts` | `ilustracaoSchema`/`ilustracoesSchema` — o caminho só pode ser `assets/ilustracoes/*.webp|svg`, e autor, licença e link são obrigatórios |
| `lib/dados.ts` | `ilustracoes`, `ilustracaoPorExercicio(id)` |
| `lib/midia.ts` (puro, 22 testes) | **quem escolhe a imagem**: vídeo local → ilustração → figura → foto, para a mídia grande (`midiaGrande`), para as listas (`midiaDaMiniatura`), para o segmento da ficha (`opcoesDeMidia`) e para o precache (`urlsDaIlustracao`) |
| `components/exercicio/ilustracao-alternada.tsx` | as duas posições em **crossfade CSS de 1,2 s** (nenhum arquivo novo é gerado); um toque pausa/volta, com `data-ilustracao` e `data-posicao` para o e2e ler |
| `components/mapa-anatomico.tsx` + `lib/mapa-anatomico.ts` | o mapa frente/costas; o destaque continua sendo as classes `p-<musculo>`/`s-<musculo>` do `globals.css` |
| `components/sprite-muscular.tsx` | injeta os dois desenhos uma vez no layout: o sprite antigo (`#bf`/`#bb`, mantido para compatibilidade) e `#mapa-anatomico`, convertido em `<symbol>` na hora de ler o arquivo |
| `app/(app)/mais/creditos/page.tsx` | Mais → **Créditos**: fontes, licenças, links e o autor de cada ilustração — uma linha por exercício, e a linha inteira é o link (44 px) |
| `assets/mapa-muscular/mapa-anatomico.svg` + `LICENCA-mapa-anatomico.md` + `NOTICE-openGym-trecho.md` | o desenho e o texto MIT que precisa andar junto dele |
| `scripts/gerar-mapa-anatomico.py` | como o SVG foi feito a partir de `body-paths.js` (MuscleMap/openGym): reagrupa os caminhos nos 16 nomes do app e troca o `fill` pelas variáveis CSS, sem mexer em nenhum ponto. Fora do build, como o importador |

### O que mudou na tela

- **Ficha (folha e `/exercicios/[id]`), aba Vídeo:** a ilustração alterna as
  duas posições, com a legenda discreta "Ilustração: `<autor>`, `<licença>`"
  linkando a página da fonte. O segmento **"Ilustração · Figura · Fotos"**
  troca a demonstração; a figura animada do kit virou uma opção (e continua
  sendo o fallback de quem não tem ilustração). O vídeo local (§13.1) segue na
  frente quando `public/videos/<id>.mp4` existe. Na **página** inteira o
  "Fotos" sai do segmento: as duas fotos ampliáveis já estão logo abaixo, e
  repetir seria mostrar a mesma coisa duas vezes.
- **Aba Músculos:** mapa anatômico de frente e costas lado a lado, primários em
  `--mprim` e secundários em `--msec`, com a ilustração acima (como na
  referência) e a legenda em texto — cor nunca é a única pista. O `--msec`
  subiu para `#b46b2a` no escuro e `#c2691a` no claro: o tom antigo não
  chegava aos 3:1 pedidos pela auditoria de UX.
- **Miniaturas:** lista do treino do dia, catálogo, calendário, tutorial e a
  imagem grande do player e do descanso usam a ilustração (posição 1) quando
  existe; senão a figura; senão a foto. A escolha está num lugar só
  (`lib/midia.ts`), e a `Miniatura` marca `data-midia` com o que escolheu.
  *(Explorar continua a tela "em construção" do marco V3 — quando a vitrine
  existir, ela já nasce usando `Miniatura`.)*
- **Offline (§8):** `/ilustracoes/` entrou no cache de mídia do service worker
  e em `midiaDaFase`, então as ilustrações da fase descem junto com as figuras
  e as fotos do programa. `npm run assets` copia `assets/ilustracoes` para
  `public/ilustracoes` (que está no `.gitignore`, como as outras).
- **Créditos:** Mais → Créditos, e a seção "Créditos de mídia" do `README.md`.

### Testes

- `lib/midia.test.ts` (22) — a ordem de preferência, o crédito montado, o
  fallback dos 4 sem ilustração, e o casamento entre `data/ilustracoes.json` e
  os arquivos no disco.
- `scripts/validar-dados.test.ts` (2) — `npm run validar` passa como está e
  **falha** ("ilustração ausente") quando um arquivo listado some. O teste
  esconde o arquivo, roda o validador e o devolve no `afterEach`.
- `e2e/midia.spec.ts` (8) — a ficha alterna as posições e para no toque, o
  crédito aparece com link para a fonte, o segmento troca para a figura, quem
  não tem ilustração continua na figura, o mapa pinta peito (primário) e
  tríceps (secundário) do supino sem pintar a perna, a lista do dia e o player
  usam a ilustração, e Mais → Créditos lista as fontes.
- Ajustados sem afrouxar: `e2e/treino-v2.spec.ts` (a miniatura e a
  demonstração do agachamento agora são a ilustração — o caminho esperado é
  lido de `data/ilustracoes.json`, não escrito à mão) e `e2e/auditoria-m5.spec.ts`
  (a varredura das 81 fichas passou a contar as imagens da ilustração e a
  exigir que o mapa anatômico pinte **todos** os primários de cada exercício;
  a checagem dos 404 agora inclui `/ilustracoes/`).

### Como testar no celular

1. `npm run build && npm start` (ou a URL da Vercel) no celular.
2. **Treino → toque num exercício da lista**: a miniatura já é a ilustração; na
   ficha, a aba Vídeo mostra o desenho alternando início e fim do movimento.
   Toque na figura: ela para; toque de novo: volta a alternar. Sob ela, o
   crédito — toque e ele abre a página da fonte.
3. No segmento, toque em **Figura**: volta a animação SVG do kit. Em
   `farmer-s-walk` não há segmento: ele só tem a figura.
4. **Aba Músculos**: frente e costas lado a lado, laranja forte nos principais
   e laranja queimado nos auxiliares, com a lista de nomes embaixo.
5. **Começar treino**: a tela do exercício mostra a ilustração grande; no
   descanso, a miniatura do próximo passo também.
6. **Mais → Créditos**: as fontes com link, e "Autor de cada ilustração" abre a
   lista dos 77 — cada linha é um toque de 44 px para a página da obra.
7. Modo avião depois de abrir o treino do dia: as ilustrações continuam
   aparecendo (ficaram no cache do service worker).

### Conhecidos, para o marco V3

- `components/mapa-muscular.tsx` e `assets/mapa-muscular/corpo-sprite.svg` (o
  boneco compacto `#bf`/`#bb`) continuam no repositório e no layout, mas **não
  são usados por nenhuma tela** desde que a aba Músculos passou ao mapa
  anatômico. Ficaram de propósito, para compatibilidade; quando o V3 confirmar
  que ninguém mais precisa deles, dá para apagar os dois de uma vez.
- Os 3 exercícios sem figura **e** sem ilustração (`escalador`, `salto-basico`,
  `corrida-no-lugar-com-a-corda`) deixam a aba Vídeo da **página** vazia — as
  duas fotos estão logo abaixo, ampliáveis, e é assim desde o v1. Na ficha em
  folha eles mostram as fotos normalmente.
- As notas de correspondência em `data/ilustracoes.json` (por que uma
  ilustração é "aproximada") ainda não aparecem na tela; o texto existe e é
  curto, então cabe na legenda quando alguém quiser.

### Portões

`npm run lint` ✓ · `npm run build` ✓ (o `prebuild` valida os JSON e copia os
assets, ilustrações incluídas) · `npm test` **886 testes em 38 arquivos** ✓ ·
`npm run e2e` **183 testes** ✓ (7,0 min). Capturas em `capturas/midia/`:
`01-ficha-ilustracao`, `02-ficha-musculos` (as duas também no claro),
`03-treino-lista`, `04-player-exercicio` e `05-creditos`, todas 360 × 740.

### Auditoria independente do marco Mídia (rodada 1)

Conferido no Chromium a 360 × 740 contra o mock, **nos dois temas**, com dados
semeados — não só pelos testes:

- **`data/ilustracoes.json`**: 77 entradas, todas com autor, licença e link;
  145 arquivos listados = 145 no disco (nenhum órfão dos dois lados); 115 WebP
  (largura máxima **640 px**, como o importador promete) + 30 SVG; 6,6 MB no
  total. Nenhum `.mov`/`.mp4` e nenhuma fotografia de pessoa real entre os
  escolhidos.
- **A regra de escolha bate com os manifestos** nos cinco conferidos um a um:
  `supino-reto-com-barra` (Everkinetic exata), `agachamento-bulgaro` (a wger
  exata ganha da Everkinetic aproximada), `barra-fixa-assistida` (Everkinetic
  aproximada, porque no wger não há imagem), `farmer-s-walk` (nenhuma das duas
  fontes tem) e `abertura-de-ombros` (Everkinetic exata).
- **Nada foi recortado nem recolorido**: os SVG do repositório são
  byte a byte iguais aos do levantamento (md5 conferido em três deles) e os
  bitmaps só foram redimensionados e convertidos.
- **Ficha**: a ilustração alterna as duas posições (medido pelo `opacity` das
  duas imagens no meio do crossfade), o toque pausa, o segmento troca para a
  figura e volta, e o crédito linka a página da fonte.
- **Mapa anatômico**: pintura conferida **por pixel** na imagem renderizada de
  `supino-reto-com-barra`, `agachamento-livre` e `prancha`, nos dois temas — as
  duas cores aparecem nas três. Contraste do secundário contra o corpo:
  **3,61:1** no escuro e **3,07:1** no claro (≥ 3:1).
- **Miniaturas**: aba Treino, `/treinar`, catálogo e player usam a ilustração;
  no descanso ela volta como miniatura de 96 px.
- **360 px**: `scrollWidth == clientWidth == 360` e nenhum elemento fora da
  janela na aba Treino, na ficha (Vídeo e Músculos), no catálogo, nos créditos
  e no player; nenhum alvo abaixo de 44 px nessas telas; nenhuma resposta HTTP
  ≥ 400 em toda a varredura.

Dois ajustes pequenos saíram desta auditoria (o resto virou observação):

1. **A licença MIT do mapa agora é um link que abre** —
   `/mapa-muscular/LICENCA-mapa-anatomico.md` é publicado junto do desenho, mas
   a tela de créditos só citava o caminho `assets/…`, que não existe para quem
   usa o app. A MIT exige que o aviso viaje com o que é distribuído.
2. **A licença de cada fonte na tela de créditos sai do JSON** (`CC BY-SA 3.0`
   para a Everkinetic, `CC BY-SA 4.0` para o wger) em vez do texto fixo
   "CC BY-SA 3.0 e 4.0", que não batia com os dados. `e2e/midia.spec.ts` passou
   a conferir as duas coisas (o arquivo da licença responde 200 e contém o
   texto da MIT; a contagem por fonte é lida de `data/ilustracoes.json`).

Observações registradas, sem correção nesta rodada:

- O crédito sob a ilustração é um link de 13 px de altura. O alvo de 44 px
  existe em **Mais → Créditos** (uma linha por exercício), então o crédito da
  ficha é um atalho, não o único caminho.
- `agachamento-bulgaro` é a única ilustração com menos de 320 px de largura
  (308 × 164, o que o wger tem): no player ela sobe para 328 px e fica mole.
- Nos três sem figura **e** sem ilustração (`escalador`, `salto-basico`,
  `corrida-no-lugar-com-a-corda`) a aba Vídeo da **página** fica com altura
  zero. É de antes deste marco (`semFoto` na página já existia no V2) e as duas
  fotos aparecem logo abaixo.

Capturas desta auditoria em `capturas/midia/`: as cinco do marco (duas também
no claro) e `06-creditos-licenca-mit` (escuro e claro), com o link novo da
licença MIT medido em 212 × 44 px.

Portões rodados do zero nesta auditoria, com os dois ajustes acima aplicados:
`npm run lint` ✓ · `npm run build` ✓ · `npm test` **886 testes / 38 arquivos** ✓
· `npm run e2e` **183 testes em 7,1 min** ✓.

### Auditoria independente do marco Mídia (rodada 2) — a decisão virou texto

A rodada 2 apontou um problema só, e de contrato: o marco entrega **imagem de
terceiros** (145 arquivos CC BY-SA e o mapa MIT), mas a SPEC ainda dizia, na
§13.1, "Nenhuma imagem de terceiros", e a decisão do dono era citada num lugar
que não a continha (a §4 de `docs/analise-referencia-treino-em-casa.md`, que é
a tabela de decisões da referência). Como nos marcos anteriores a regra foi
escrever a SPEC **antes** de construir, a emenda foi escrita agora, antes do V3:

- **SPEC §15 — "Mídia dos exercícios"** (adendo novo, no formato da §13 e da
  §14): registra a decisão de 15/09/2026 e as **quatro condições** para usar
  imagem de terceiro (licença livre · autor, licença, link e título em
  `data/ilustracoes.json` · atribuição sob a mídia na ficha e em Mais →
  Créditos · texto da licença publicado quando ela exigir, o caso da MIT), a
  ordem de preferência **vídeo local → ilustração → figura → foto** (§15.2), o
  que **não** muda (capas continuam só com as fotos de `assets/`; motor e banco
  intocados) e os critérios de aceite. A §15 foi numerada como seção nova para
  não renumerar a §14.3/§14.4/§14.5, já citadas em código e em testes.
- **SPEC §13.1**: "Nenhuma imagem de terceiros" virou "Imagem de terceiros só
  nas condições da §15". O resto da §13.1 ficou igual; a §13.3 continua valendo
  ao pé da letra, porque **capa** nunca usa imagem de terceiro.
- **`docs/analise-referencia-treino-em-casa.md`**: a tabela da §4 ganhou as
  linhas "Ilustrações de exercício", "Mapa muscular anatômico" e "Imagem de
  terceiro sem licença ou sem crédito"; a tabela da §6 ganhou o marco **Mídia**
  entre o V2 e o V3 (e o V4 passou a auditar contra a §15 também).
- **Citações penduradas corrigidas** para apontar para a seção que agora
  existe: cabeçalho de `scripts/importar-ilustracoes.ts`, cabeçalho de
  `lib/midia.ts` e a abertura desta seção do PROGRESSO.

Nenhuma linha de app mudou nesta rodada — é texto de contrato —, então as
capturas de `capturas/midia/` continuam valendo sem regerar. Portões rodados
de novo do zero: `npm run lint` ✓ · `npm run build` ✓ · `npm test` **886
testes / 38 arquivos** ✓ · `npm run e2e` **183 testes em 6,9 min** ✓.

---

## Camada visual v2.1 — Marco V3 ✅

SPEC §14.3 (aba Treino completa), §14.4 (Explorar, Relatório, Corpo, Mais) e o
que faltava da §13.4–§13.7: **sessão livre**, coleções derivadas, circuitos,
histórico e as duas sequências. O v1 continua inteiro por baixo: o motor
(`lib/progressao.ts`), a montagem (`lib/montagem.ts`) e o que vai para o banco
não mudaram uma linha — a única coluna nova é `sessions.plano`, que a §13.4 já
previa.

### O que foi feito

**1. Sessão livre de verdade (§13.4)** — `sessions.workout_id = 'livre'` com a
lista de exercícios em **`sessions.plano` (jsonb)**, a coluna nova com migração
idempotente em `supabase/schema.sql`, refletida em `lib/types.ts`, no mock e no
backup. `lib/livre.ts` (puro) faz a ida e a volta: `planoDaSessao()` monta o
jsonb, `itensDoPlano()` o lê **sem confiar no formato** (item torto cai no
padrão do catálogo, plano vazio devolve `null`) e `reconstruirSessao()` passou a
aceitar um treino livre quando a lista chega — antes ela desistia sempre. Daí em
diante a sessão livre é uma sessão de força como qualquer outra: registro por
série, IndexedDB, fila, motor e recordes iguais (§6).

A mesma coluna guarda a **ordem desta sessão** quando o treino do dia é
reordenado — sem isso, uma sessão reordenada refeita noutro aparelho voltaria na
ordem do programa e as séries não casariam.

**2. Coleções derivadas (`lib/colecoes.ts`, puro)** — tudo sai dos JSON:

| coleção | de onde vem | quantas |
|---|---|---|
| Treinos do programa | `programa.treinos` (nome, subtítulo, `duracao_min`) | 6 |
| Parte do corpo | o campo `grupo` de `exercicios.json` | 8 |
| Circuitos | o campo `subgrupo` (`tatame` · `corda` · `band`) — os 14 de `origem = "aparelho"` | 3 (8 · 3 · 3) |
| Por aparelho | `equipamentos.itens`, com a foto `assets/itens/<id>/<id>_01.jpg` | 10 |
| Planos | `cardio.barra_fixa` · `cardio.corrida` · `cardio.corda` | 3 |

`~M min` é `séries × (reps médias × 3 s + descanso)` somado (o unilateral conta
os dois lados; quem não tem faixa — `máximo`, corda — usa uma série de 10 reps).
Os raios são a maior dificuldade do conjunto (§13.4). A tela da coleção é
`/explorar/[tipo]/[valor]`, **29 páginas estáticas** geradas no build.

**3. Aba Treino (§14.3)** — abaixo da lista do dia entraram:

- **Editar** (`components/treino/editar.tsx`): modo reordenar com a alça ⣿ e as
  setas ↑↓ (o alvo de toque é a seta: funciona com uma mão, sem arrastar),
  "Voltar à ordem do programa" e "Pronto". A ordem fica no aparelho por
  (data, treino) — `lib/ordem.ts`, o mesmo desenho de `lib/trocas.ts` — e entra
  em `sessions.plano` quando o treino começa.
- **Desafios**: carrossel **manual** (scroll-snap, sem rotação automática) com
  os planos reais — a primeira barra fixa e a corrida de `cardio.json` e a
  **fase em curso** do `programa.json` —, cada um com capa de `assets/`, semana
  atual, barra de progresso e "Fazer a sessão da semana".
- **Parte do corpo em foco**: chips dos 8 grupos, `N exercícios · ~M min`,
  raios, a lista com miniatura e o "Começar", que abre a sessão livre com os 6
  primeiros (compostos antes de isolamento, só o que o equipamento do terraço
  permite, "não gosto" por último).
- **Chips de filtro derivados** (≤ 15 min · 15–30 min · com/sem equipamento ·
  core · cardio).
- **Personalizar treino** ("Crie o seu próprio"): folha com busca sem acento
  sobre os 81, escolha numerada e "Começar (n)".
- **FAB Ajustar**: o mesmo bloco de `components/mais/ajustes-do-treino.tsx` do
  player e de Mais → Preferências.

**4. Explorar (§14.4)** — busca sempre visível no topo (uma só: ela também
alimenta o catálogo dos 81, que perdeu a caixa própria quando é controlado de
fora), **um destaque** (o treino de hoje ou a sessão da semana do plano),
"Escolhas para você" com as cinco seções e "Ver todos", e o catálogo embaixo. A
busca acha por título da coleção **e** por nome de exercício de dentro dela.

**5. Relatório (§13.5 e §14.4)** — `components/relatorio/`: contadores
**Treinos · Minutos · Volume** no topo; **Histórico** com a faixa da semana
navegável e "Todos os registros" (força com treino, duração, séries e ↑/=/↓;
cardio com tipo, semana e duração; reps soltas somadas por dia; toque abre o
resumo); **sequência de dias** e **de semanas com meta**; os cards **Peso**
(atual, maior, menor, gráfico) e **IMC**; e, abaixo, os gráficos e recordes da
§3.7, que continuam os mesmos.

**6. Corpo e Mais** — o card de IMC entrou na aba Peso do Corpo (o mesmo
componente do Relatório e da conclusão) e Preferências ganhou o link para
**Mais → Créditos**. O resto da §14.4 já existia desde o V2.

### Funções puras novas (todas com teste)

| arquivo | o que faz |
|---|---|
| `lib/livre.ts` | itens da sessão livre, `sessions.plano` (ida e volta), `podeCircuito`, a estimativa de minutos |
| `lib/colecoes.ts` | as 30 coleções derivadas, filtros, busca, `exerciciosParaSessao` (compostos → isolamento, equipamento, "não gosto") e os Desafios |
| `lib/ordem.ts` | `mover`/`subir`/`descer`, `aplicarOrdem` e o storage por (data, treino) |
| `lib/relatorio.ts` | contadores, "Todos os registros" e o ↑/=/↓ por sessão |

### Decisões desta etapa

1. **O rótulo do circuito é de UI, o conteúdo é do JSON.** "Core no tatame",
   "Corda" e "Elástico" são os três `subgrupo` de `exercicios.json` com um nome
   legível na frente (a §13.8.6 permite rótulo de UI). Quem manda em **quem
   está** em cada circuito é o JSON: 8 · 3 · 3, os 14 de `origem = "aparelho"`.
2. **O circuito do Elástico não roda no modo por tempo** — `barra-fixa-assistida`
   tem `implemento = barra_fixa`, e a §13.6 não deixa barra entrar. A coleção
   existe e abre sessão livre; o passo dela é o de carga/assistência de sempre.
3. **Os filtros de conteúdo encolhem a lista, não escondem o grupo.** "Sem
   equipamento" exigido da coleção inteira esvaziaria os oito grupos (todo grupo
   mistura barra e peso do corpo). Agora "com/sem equipamento", "core" e
   "cardio" filtram **exercício por exercício**, a contagem e os minutos são
   recalculados, e um grupo que fica sem nada some do chip (Bíceps não tem
   exercício de peso do corpo). Só "≤ 15 min" e "15–30 min" olham a coleção.
4. **Coleção de plano não abre sessão livre.** Os três planos de `cardio.json`
   têm prescrição por semana; mandar o Miguel para `/barra-fixa` ou
   `/cardio/corrida` respeita o plano em vez de improvisar uma sessão.
5. **O Desafio da fase é a fase, não um plano inventado.** O terceiro card do
   carrossel é `programa.fases[atual]` com as 12 semanas de
   `SEMANAS_PARA_FASE2` — o mesmo número que o app já usa para sugerir a Fase 2.
6. **A ordem de "Editar" vale para a sessão, não para o programa.** Ela some no
   dia seguinte (o par data+treino), é apagada quando a sessão começa e volta
   inteira no "Voltar à ordem do programa". O aquecimento acompanha: a sessão é
   montada a partir da lista **já reordenada**, então as duas séries de barra
   vazia entram no primeiro exercício pesado da ordem nova.
7. **`~M min` usa `formatarMinutos`**, o mesmo do resto do app: "~44 min" para
   um treino e "~1 h 19" para um grupo inteiro de 13 exercícios. Um "79 min"
   seria mais literal que a SPEC, mas menos parecido com as outras telas.
8. **Nada de contagem nova no banco.** Os contadores e o histórico saem de
   `sessions`, `session_sets`, `cardio_sessions`, `pullup_singles` e
   `progression_events` — as mesmas tabelas de sempre, lidas por uma consulta
   nova (`useEventosDesde`) que só pega `session_id` e `motivo`.

### Pendências do V2 que este marco fechou

- `components/player/exercicio.tsx`: "anterior: …" e o chip "montagem" passaram
  para a **mesma linha** (flex, centro). A 360 × 740 o chip ficava ~11 px sob a
  barra de controles quando o exercício tinha histórico; juntos cabem de uma vez.
- `components/player/firme.tsx`: a "Nota curta (opcional)" subiu para **cima**
  dos três botões. Tocar em Fácil/Firme/Falhei já responde e sai da tela (é o
  gesto da referência), então a nota tinha de vir antes na ordem de leitura.
- `components/player/descanso.tsx`: quando o próximo passo é **aquecimento**, a
  tela mostra o alvo da própria série ("5 × 7,5 kg na barra") em vez das séries
  de trabalho do bloco — antes lia-se "AQUECIMENTO 2 DE 2" acima de "3 × 5".
- **§14.5.3 inteira**: existia player de circuito, faltava o caminho que cria a
  sessão livre. O e2e novo sai da aba Treino → Parte do corpo (Core) → Começar,
  roda um passo de reps e um de tempo no player e confere no mock que `sessions`
  ganhou a linha `workout_id = 'livre'` com `plano` e `session_sets` as séries.

### Como testar no celular

1. **Aba Treino**: role até **Desafios** e arraste o carrossel para o lado — ele
   não gira sozinho. Cada card mostra a semana do seu perfil (`semana_fixa`,
   `semana_corrida`, a semana da fase) e o botão leva à sessão da semana.
2. Logo abaixo, **Parte do corpo em foco**: toque em "Core", confira
   `13 exercícios · ~1 h 19`, ligue "Sem equipamento" e veja a lista encolher.
   "Começar Core" abre o player com uma sessão livre de 6 exercícios.
3. **Editar** (acima dos Desafios): as setas ↑↓ reordenam, "Pronto" fecha, e o
   treino que você começar sai nessa ordem.
4. **Personalizar treino**: busque "abdominal", toque em três e "Começar (3)".
5. **Explorar**: busque "triceps" (sem acento) — a coleção do grupo aparece em
   cima e os exercícios embaixo. Toque numa coleção para ver a tela dela.
6. **Relatório**: os três contadores no topo, a faixa da semana com as setas,
   "Todos os registros" para ver tudo, as duas sequências, Peso e IMC.
7. **Corpo → Peso**: o IMC está no topo, com "Editar altura".
8. **Mais → Preferências**: tudo da §14.4 mais o link dos créditos.

### Testes

- **Unitários (Vitest)**: `lib/colecoes.test.ts` (34), `lib/livre.test.ts` (14),
  `lib/ordem.test.ts` (11) e `lib/relatorio.test.ts` (11) — as contagens por
  grupo/aparelho/circuito conferidas contra o próprio JSON (8 grupos = 81
  exercícios; 8 · 3 · 3 = os 14 de `origem = "aparelho"`), a estimativa de
  minutos exercício a exercício, a ordem compostos → isolamento, o "não gosto"
  por último, os filtros que encolhem a lista, a ida e a volta de
  `sessions.plano` (inclusive jsonb estragado) e o ↑/=/↓ do histórico.
  `lib/sessao.test.ts` ganhou o `plano: null` nas duas escritas de `sessions`.
- **E2E (`e2e/v3.spec.ts`, 10 testes)**: Desafios com a semana do perfil e o
  carrossel manual; Parte do corpo → Começar → **sessão livre** no player com um
  passo de reps e um de tempo, conferindo no mock `workout_id = 'livre'` +
  `plano` + `session_sets`; Personalizar com 3 exercícios; Editar que reordena e
  chega em `sessions.plano`; o FAB Ajustar (≥ 44 px); Explorar com as cinco
  seções, "Ver todos", a busca sem acento e a tela da coleção; a coleção de
  plano que leva ao plano; Relatório com registros semeados, sequências, Peso e
  IMC; "Todos os registros" fora da semana; IMC no Corpo com a altura gravando;
  Preferências com tudo da §14.4.
- **E2E antigos ajustados sem afrouxar**: `treino-v2.spec.ts` trocou
  "Em construção — marco V2" pelas coleções de verdade (continua provando que a
  aba abre pela navegação, tem o título e não rola para o lado) e
  `corpo.spec.ts` passou a pedir o título "Corpo" **exato** (a aba Treino agora
  tem "Parte do corpo em foco" e "Fase 1 — corpo inteiro…").

### Portões

`npm run lint` ✓ · `npm run build` ✓ (29 páginas de coleção estáticas, além das
81 fichas) · `npm test` **956 testes em 42 arquivos** ✓ · `npm run e2e`
**196 testes** ✓ (7,7 min). Capturas em `capturas/v3/`: `01-treino-desafios`,
`02-treino-parte-do-corpo`, `03-explorar`, `04-colecao`, `05-relatorio`,
`06-relatorio-registros`, `07-corpo-imc`, `08-preferencias` — e `01`, `03` e
`05` também no tema claro.

### O que falta

A auditoria final da §14.5 (marco V4), feita por outro agente: usar o app no
Chromium a 360 × 740 nos dois temas, refazer os quatro portões do zero e
conferir os sete critérios da §14.5 e os oito da §13.8 um a um.

---

## Auditoria do marco V3 (rodada 1) ✅

Outro agente refez os quatro portões do zero e usou o app no Chromium a
360 × 740, nos **dois temas**, com dados semeados no mock. Os sete critérios da
§14.5 e as quatro pendências herdadas do V2 foram conferidos um a um.

### O que a auditoria confirmou

- **§14.5.5** — Desafios com os **três planos reais** e a semana do perfil
  (barra fixa 3/12 · corrida 3/12 · Fase 1 1/12), carrossel **manual** (o
  `scrollLeft` não mexe sozinho em 4 s), FAB Ajustar de 56 px, os **8 grupos**
  em chips, os 6 filtros derivados (Core: 13 exercícios · ~1 h 19 → 8
  exercícios · ~46 min com "Sem equipamento", e os chips caem para os 3 grupos
  que ainda têm exercício), "Começar Core" criando a **sessão livre** com
  `sessions.plano`, Personalizar e Editar/reordenar.
- **Sessão livre offline** — a sessão de "Core no tatame" começada num
  navegador foi reaberta noutro **contexto limpo** e voltou em "Série 2 de 3 ·
  exercício 1 de 6": `reconstruirSessao` refaz mesmo o treino livre a partir
  do jsonb.
- **Modo por tempo** — só quatro exercícios do catálogo têm
  `prescricao_padrao.tipo = "tempo_s"` (prancha, escalador, prancha lateral,
  corrida no lugar com a corda) e os quatro são `peso_corporal` ou `corda`:
  barra, halteres e polia **não têm como** cair na contagem regressiva (§13.6).
- **Contadores do Relatório conferidos à mão** com a semente: 1 sessão de
  força (45 min) + 1 de cardio (34 min) + 1 sessão de outra semana (30 min) =
  **3 treinos · 109 minutos**; 3 × 5 × 20 kg + 2 × 8 × 30 kg = **780 kg**.
- **As 4 pendências do V2 fechadas**, medidas a 360 × 740 nos dois temas:
  o chip "montagem" termina em **615 px** e a barra de controles começa em
  **620 px** — cabe sem rolar mesmo no pior caso (nome de duas linhas +
  "anterior: 12,5 kg na barra × 18"); a nota do "firme?" está em 200 px e os
  três botões em 268 px (a nota vem **antes**); o descanso antes do
  aquecimento mostra "5 × 7,5 kg na barra" (o alvo da própria série); e o e2e
  da sessão livre de core grava `sessions.plano` e `session_sets` no mock.
- **Transversais** — nenhuma das 10 telas rola para o lado nem vaza elemento
  a 360 px; nenhum nome de exercício escrito em código (só comentários);
  nenhuma dependência nova, nenhum asset novo; `/progresso` → `/relatorio`;
  os gráficos e recordes da §3.7 continuam inteiros abaixo do novo Relatório.

### O que a auditoria corrigiu

1. **`components/relatorio/card-peso.tsx`** — o eixo x do gráfico de peso
   desenhava a data **ISO crua** ("2026-09-07"), porque o card passava
   `x="data"`. O gráfico do Corpo usa `x="rotulo"` (dd/MM) desde o marco 5; o
   card do Relatório passa a fazer o mesmo, com `formatarData`.
2. **`lib/colecoes.ts`** — a coleção de um **plano** mostrava
   "0 exercícios · ~1 min" na corrida (e "1 exercício · ~11 min" na barra
   fixa): a lista de um plano tem no máximo o exercício da capa, então contar
   exercícios era informação errada na tela. O detalhe passa a ser o tamanho
   do plano em semanas, que é de `cardio.json` ("12 semanas"). Coberto por
   dois testes novos em `lib/colecoes.test.ts` (o antigo "nenhuma coleção fica
   com 0 min" ficou **mais** exigente: as coleções de exercício continuam com
   minutos > 0 **e** com o detalhe no formato antigo) e por uma asserção nova
   no e2e da coleção de plano.
3. **`e2e/treinar.spec.ts`** — o teste do substituto lia `progression_events`
   **sem esperar a fila**: ele espera `exercise_state`, que a fila grava
   **antes** dos eventos (§8), e depois lia os eventos de uma vez. Na primeira
   rodada de portões desta auditoria ele falhou por isso (195/196); sozinho
   passa 3/3. A asserção é a mesma (`de.carga_kg` = 31,5), agora dentro de um
   `expect.poll`, como o teste vizinho já fazia com `profiles.ultimo_treino`.
4. **`e2e/player.spec.ts`** — a mesma classe de corrida no teste do "avançar
   sozinho": ele desligava o interruptor em Preferências e voltava para o
   player na hora. A preferência sobe pela **fila** (§8), então o player
   remontado podia reler o perfil antigo e avançar sozinho mesmo assim — com
   a máquina carregada isso aconteceu (194/196 na segunda rodada). O teste
   passa a esperar `prefs.avancar_sozinho = false` chegar ao mock antes de
   voltar; o que ele prova continua sendo o player obedecendo ao interruptor.

### Conhecido, não corrigido (para o marco V4 decidir)

- **Os contadores do topo do Relatório são acumulados**, não da semana: a
  §13.5.1 pede "volume da semana" e a tela mostra o volume de tudo (780 kg),
  com o card antigo "Volume da semana" (300 kg) logo abaixo. Dois números de
  volume na mesma tela. A §14.4 só diz "volume", e a referência mostra totais
  — é uma decisão de produto, não um defeito de código.
- **"Treinos" conta força de sempre + cardio das últimas 26 semanas**
  (`useSessoesTodas` e `useCardioDesde` têm janelas diferentes). Com o app
  começando em 14/09/2026 dá no mesmo; daqui a seis meses não dá.
- **"Todos os registros" mostra 12 e para** ("Mostrando 12 de N"), sem "ver
  mais": para ver o que ficou de fora é preciso navegar semana a semana.
- **`Colecao.circuito`** (de `podeCircuito`) é calculado e testado, mas
  nenhuma tela usa o campo — o player já decide o passo pelo tipo da
  prescrição.
- **O FAB Ajustar cobre o canto direito da última linha** da lista quando a
  tela está rolada até ele (é o comportamento de um FAB; a lista rola).

### Portões depois das correções

Rodados do zero, nesta ordem, numa janela sozinha:

```
npm run lint   limpo (sem avisos)
npm run build  ✓ 119 páginas estáticas geradas
npm test       Test Files 42 passed (42) · Tests 957 passed (957)
npm run e2e    196 passed (7.7m) — Chromium 360 × 740
```

Capturas em `capturas/v3/`, agora **nos dois temas**: `01-treino-desafios`,
`02-treino-parte-do-corpo`, `03-explorar`, `04-colecao`, `05-relatorio`,
`06-relatorio-registros`, `07-corpo-imc`, `08-preferencias`,
`09-relatorio-peso` (o eixo em dd/MM) e `10-colecao-plano` ("12 semanas"),
cada uma com o par `-claro`.

---

## Fechamento v2.1 — ciclo 1 de correções (três auditorias independentes) ✅

Três auditores varreram o app fechado (V1 · V2 · Mídia · V3) e levantaram um
bloqueante, seis importantes e doze menores. Esta etapa corrigiu os sete
primeiros e oito dos menores.

### Bloqueante

**O peso do dia na conclusão engolia o toque em "Próximo".** Digitar 82,4 e
tocar uma vez não concluía nada: o `StepperNumerico` só confirmava o valor no
`onBlur`, o blur acontecia no *mousedown* do botão, o card de IMC crescia de
98 px para 192 px e o "Próximo" descia 94 px entre o apertar e o soltar — o
clique nunca era disparado. A sessão ficava aberta, sem a decisão do motor, sem
`ultimo_treino` e sem o peso.

Corrigido em três camadas: (1) `components/stepper-numerico.tsx` passou a
confirmar o valor **a cada tecla** enquanto o texto já é um número dentro dos
limites (o `onBlur` continua para normalizar e prender nos limites), com o
efeito de sincronização preservando o que está escrito quando ele já vale o
mesmo número — senão a vírgula recém-digitada sumia; (2) o `CardImc` da
conclusão reserva `min-h-48`, a altura do estado com barra; (3) e2e novo em
`e2e/player.spec.ts` ("digitar o peso e tocar UMA vez conclui…"), que era
exatamente a lacuna por onde o defeito passou.

### Importantes

1. **"Começar treino" entra direto no player** (§14.5.1). O botão largo do card
   do dia era um link para `/treinar` — uma tela a mais antes da Preparação.
   Agora ele cria a sessão e vai para `/treinar/<id>`. A criação virou um lugar
   só, `lib/queries/comecar.ts` (`useComecarTreino`), usado pela aba Treino e
   por `/treinar`, que continua existindo para escolher o outro treino da fase
   (§5.3, coberto por e2e). A decisão está escrita na SPEC §14.5.1.
2. **Interruptores com 44 px.** `components/ui/switch.tsx` passou a desenhar o
   pill (32 × 18,4 px) dentro de um botão de 44 × 44 px — a caixa de toque é o
   próprio botão, que qualquer medição enxerga (antes ela morava num `::after`
   invisível ao `getBoundingClientRect`). Medido nos seis interruptores em
   Preferências **e** na folha do FAB Ajustar: 44 × 44 px em todos.
3. **HTML literal no JSON.** Cinco textos de `data/exercicios.json` traziam
   `<strong>` e apareciam crus na tela (flexora-e-gluteo-na-polia,
   puxada-alta-na-polia, triceps-na-corda). As tags saíram do dado e um teste
   novo em `lib/dados.test.ts` varre os seis JSON atrás de qualquer marcação.
4. **Contadores do Relatório** (decisão do orquestrador de 15/09). As três
   fontes passaram a ler a **mesma janela** (tudo: `useSessoesTodas`,
   `useSeriesTodas`, `useCardioTodos`), os três contadores do topo ganharam o
   subtítulo "no total", o card de baixo diz "só força" e a §14.4 registra a
   decisão. O histórico e as sequências recortam as 26 semanas dessas mesmas
   listas, sem uma segunda leitura.
5. **Treino começado sem rede volta a passar pelo motor.** A causa era a chave
   da consulta: `/treinar` pedia os ids de toda a fase e a aba Treino só os do
   dia, então o cache de uma não servia para a outra e, offline, a sessão
   inteira nascia "sem avaliar". Agora `useComecarTreino` monta a sessão a
   partir do **cache** (`estadosNoCache`/`recordesNoCache`/
   `seriesAnterioresNoCache` em `lib/queries/dados.ts`, que juntam todas as
   leituras bem-sucedidas, venham da chave que vierem) e a degradação é **por
   exercício**: só quem nunca foi lido fica sem avaliação (`conhecidos` em
   `lib/sessao.ts`). Dois defeitos vizinhos saíram junto: o persistidor
   guardava só `status === "success"` e apagava do cache, na primeira gravação
   offline, justamente as cargas atuais (a consulta rehidratada que falha ao
   revalidar fica "error" **com os dados ainda ali**); e a aba Treino não lia
   recordes nem séries anteriores. e2e novo em `e2e/auditoria-offline.spec.ts`.
6. **`e2e/auditoria-m5.spec.ts` respeita `MOCK_SUPABASE_PORT`.** A URL do mock
   estava escrita à mão numa linha (`54321`), e o portão ficava vermelho por
   motivo falso justamente no caminho de contorno que o README manda usar.
   Provado: `MOCK_SUPABASE_PORT=54332 E2E_PORT=3112 npm run e2e -- --grep "uma
   imagem de 2400 px"` → 1 passed.

### Menores corrigidos

- **Player em tela cheia** (§14.1): a barra de 5 abas some em `/treinar/<id>` e
  o miolo perde o `pb-24` que existia por causa dela
  (`components/miolo.tsx`). O passo do exercício, que rolava 130 px, agora cabe
  de uma vez a 360 × 740 (`scrollHeight` 740, chip "montagem" terminando em
  574 px contra a barra de controles em 612 px). A **saída** do treino passou a
  existir de verdade: "Sair do treino" na visão geral (a sessão continua aberta
  e volta pelo "Continuar" da aba Treino).
- **Figura do player** de `h-44` para `h-40`, que é o que faltava para o chip
  "montagem" não encostar na barra de controles.
- **FAB Ajustar**: a seção da aba Treino ganhou `pb-24` e o FAB subiu para
  `bottom-24`. Medido a 360 × 740, rolado até o fim: último cartão terminando
  em 548 px, FAB começando em 588 px — 40 px de folga, e nenhum alvo de 44 px
  coberto no topo.
- **Crédito da ilustração** (`components/exercicio/media-grande.tsx`): o link do
  `figcaption` agora tem caixa de 44 px (301 × 44 medidos), com o texto em
  11 px.
- **"Todos os registros"**: o "Mostrando 12 de N" virou botão **"Ver mais 12 de
  N"** (≥ 44 px), que zera ao trocar de semana ou de recorte.
- **Títulos dos Desafios** (§14.3): "Primeira barra fixa em 12 semanas" e
  "5 km sem parar em 12 semanas" — rótulo de UI com o número de semanas e a
  meta vindos de `cardio.json`; o `objetivo` em caixa baixa continua na tela,
  como subtítulo. Vale para os Desafios da aba Treino e para os planos do
  Explorar.
- **Contradição da §14.1.1**: a SPEC agora diz que a Preparação aparece **ao
  começar** e que retomar volta ao passo salvo (a regra do fim da seção), que é
  o que a implementação faz e o que não repete uma contagem no meio do treino.
- **`kit-100kg`**: a §13.8.2 agora diz **9** coleções por aparelho, com o
  motivo (nenhum exercício lista esse id; os exercícios usam `anilhas`,
  `halteres` e `barra-w`, que não são ids de `equipamentos.json`).

### Menores não corrigidos (com o motivo)

- **Ficha em folha fora do player** (lista do dia, Explorar) não tem
  "Substituir", stepper "só nesta sessão" nem anterior/próximo (n/N): o stepper
  e o n/N só fazem sentido dentro de uma sessão em andamento, e cada linha da
  lista já tem o seu botão "Substituir X" ao lado da ficha. A §14.5.4 cobra as
  três abas, que estão lá.
- **Subtítulo das coleções de aparelho e circuito** continua sendo o campo
  `specs` do item. É campo do JSON (a §14.4 pede "descrições só de campos do
  JSON") e `equipamentos.json` não tem `funcoes`; a alternativa era subtítulo
  nulo, que perde informação na tela da coleção. Registrado na §13.8.2.
- **`Colecao.circuito`** continua calculado sem tela que o leia.
- **CSP completa**: continua esperando o domínio do projeto Supabase para ser
  medida em `Report-Only` (item 1 dos conhecidos consolidados).
- **`ultima_firme` parcial** enquanto a sessão está em andamento: a conclusão
  reenvia o valor final e a reconstrução ignora o retrato parcial. Com o
  bloqueante corrigido, a sessão que não conclui virou caso raro.
- **O FAB cobre 13 % do botão "Começar treino"** com a página no topo. É o que
  um FAB fixo faz; o botão tem 328 px de largura e o centro está livre.

### Portões

Rodados nesta ordem, com a árvore limpa:

```
npm run lint   limpo (sem avisos)
npm run build  ✓ Compiled successfully
npm test       Test Files 43 passed (43) · Tests 971 passed (971)
npm run e2e    200 passed (7.4m) — Chromium 360 × 740
```

`git diff c3de09f..HEAD -- lib/progressao.ts lib/montagem.ts`: **vazio**
(`c3de09f`, "Aplica as pendências menores das auditorias dos marcos", é o
último commit que tocou o motor, ainda no v1 — a linha de base certa para a
camada visual). Contra o **marco 1** (`cb069e5`) o diff **não** é vazio, e nem
deveria ser: o motor mudou durante o v1, nas auditorias do motor e na conta das
barras (`pesosBarras`/`BarraId`).

### Como testar no celular

1. Aba Treino, segunda-feira: tocar em **"Começar treino"** — cai direto na
   Preparação, sem tela no meio. A barra de 5 abas some enquanto o treino roda;
   para sair, ícone de lista → **"Sair do treino"**.
2. No fim: Feedback → Conclusão → **"Registrar o peso de hoje"**, digitar
   `82,4` e tocar **uma vez** em "Próximo". Volta para a aba Treino com o
   treino concluído, o peso gravado e o resumo do motor aplicado.
3. Mais → Preferências: os seis interruptores têm 44 px de alvo (o mesmo vale
   no FAB **Ajustar** da aba Treino).
4. Modo avião **na aba Treino** (com o app já aberto uma vez com rede): começar
   e concluir o treino; ao voltar a rede, o Relatório mostra as setas ↑/=/↓ do
   motor — não mais "sem avaliar".
5. Relatório: os três contadores do topo dizem "no total"; o card de baixo diz
   "só força"; "Todos os registros" tem **"Ver mais 12"**.
6. Ficha de `puxada-alta-na-polia`: a Montagem não mostra mais `<strong>`.

---

## Fechamento v2.1 — ciclo 2 de correções (três auditorias independentes) ✅

Commits `fdea2db`, `cd54cb7` e `3c3f90d`. Três problemas importantes, todos
corrigidos, mais a explicação do que aconteceu com os "menores" desta rodada.

### 1. Exercício sem série registrada gravava falha (`fdea2db`)

O pior dos três, porque estragava sozinho o coração do app. Concluir uma sessão
com exercícios em branco escrevia `exercise_state` + `progression_events` com
`falhas_seguidas += 1` para cada um deles: a montagem já cria as `SerieLocal`
vazias, então a guarda `if (series.length === 0)` de `lib/progressao.ts` nunca
pegava e o motor lia "série não concluída" = falha (§6.2). Pelo acumulado, duas
sessões assim tiram 10 % da carga e cortam o incremento pela metade; a terceira
manda semana leve a 60 % — de exercícios nunca tentados. E com o player da
§14.1, em que andar pelos exercícios sem registrar é o gesto normal e
"Concluído" é a saída principal, isso ia acontecer sozinho.

- `avaliarSessao` (`lib/sessao.ts`) manda a lista **vazia** ao motor quando o
  bloco não tem nenhuma série de trabalho concluída. O resultado vira
  `naoAvaliado` com `motivoNaoAvaliado: "nao_feito"` — o mesmo caminho da §6.3
  que já existia para o estado desconhecido: nem estado, nem evento, nem falha.
- **O motor não foi tocado**: `lib/progressao.ts` e `lib/montagem.ts` continuam
  iguais ao `c3de09f` (o último commit que os alterou, ainda no v1 —
  `git diff c3de09f..HEAD -- lib/progressao.ts lib/montagem.ts` vazio; contra o
  marco 1 o diff não é vazio, o motor evoluiu durante o v1). A decisão de "o que
  é uma sessão feita" é da camada da sessão, não do motor.
- O resumo do fim (aba Treino e player) agora tem duas frases separadas: "Sem
  avaliar, porque não consegui ler a carga atual: …" e "Não foi feito nesta
  sessão, então não conta como falha: …".
- Testes: uma sessão concluída de 6 blocos com 1 preenchido dá **1** escrita de
  estado e **1** evento, e os outros 5 vêm com `falha: false`; e um exercício
  FEITO abaixo do piso continua sendo falha (o teste que impede a correção de
  virar anistia geral). Os dois falham sem a correção.
- Escrito na **SPEC §6.3**.

### 2. `/treinar` parada no esqueleto (`cd54cb7`)

A auditoria mediu ~10 % de cargas frias de `/treinar` presas no esqueleto para
sempre: HTML do servidor na tela, tudo em 200, console vazio, app nunca
interativo. **Não reproduziu contra um build fresco**: 0 travas em 90
navegações (20 seguidas com a conta cheia e o service worker no controle; 40 em
10 contextos novos com `clock.setFixedTime`, tema claro e escuro; 30 com a
semente cheia — perfil, 4 sessões, 24 séries por sessão, eventos, estado,
cardio e pesos). O que explica a medição é o ambiente: havia um `next start` de
**20:27** ainda de pé na 3101 servindo um build **anterior** às correções do
ciclo 1 (22:40), enquanto outros builds reescreviam `.next` por baixo dele — a
mesma máquina, dois agentes. A prova é que os "menores" desta rodada descrevem
exatamente o app **antes** do ciclo 1 (medições abaixo).

Mesmo assim o buraco é real e ficou tapado, porque quando a hidratação não
acontece **nenhum `useEffect` roda** — nenhuma tela de erro em React aparece —
e na Vercel um deploy no meio de uma navegação faz o mesmo estrago:

- **`lib/vigia.ts`**: script inline no `layout`, sem React, disparado no parse.
  Passados 12 s sem sinal de vida (`window.__appVivo`, que os Providers marcam
  ao hidratar), ele desenha à mão a faixa "O app não terminou de abrir." com um
  botão **Recarregar** de 44 px. Se o React acordar depois, `marcarAppVivo()`
  tira a faixa. **Não recarrega sozinho** — o mesmo motivo de
  `reloadOnOnline: false`.
- **`lib/espera.ts` + `/treinar`**: dez segundos no esqueleto sem perfil e sem
  erro trocam o `EsqueletoCard` pelo `Erro` com "Tentar de novo".
- **A lacuna de teste que deixou isso passar**: todos os e2e chegavam a
  `/treinar` por **clique**. Agora há um que abre a URL direto (carga fria,
  três voltas) exigindo os dois cards, e outro que corta o pacote principal do
  React (`serviceWorkers: "block"` + `page.route`) e exige a faixa do vigia, o
  alvo de 44 px e o app de volta depois do toque.

### 3. Fotos dos itens sem licença (`3c3f90d`)

As 95 fotos de `assets/itens/` são de anúncio dos produtos comprados — obra de
terceiro sem licença livre, contra as condições 1 e 2 da §15.1, e desde o V3
elas eram a **capa** das coleções por aparelho no Explorar. Decisão escrita na
**SPEC §15.3**: elas ficam, porque não são mídia de exercício e sim o registro
particular das compras do dono num app de um usuário só atrás de login — com
três condições, todas implementadas:

1. **Só no inventário.** `colecaoDoAparelho` não passa mais `capa`: a coleção
   por aparelho usa a mesma capa das outras (a foto de execução do primeiro
   exercício). `fotoDoItem` de `lib/colecoes.ts` saiu; o de `lib/equipamento.ts`
   (Mais → Equipamento) ficou.
2. **Procedência no JSON.** `fotos_dos_itens` em `data/equipamentos.json`
   (`pasta`, `origem`, `licenca: null`, `uso`), validado por Zod.
3. **Dito na cara.** Mais → Créditos ganhou o bloco "Fotos dos itens do
   terraço" montado desse JSON; a tabela "Créditos de mídia" do README ganhou a
   linha e a frase da linha 84 foi corrigida.

Testes: nenhuma coleção (aparelho, circuito ou grupo) com capa em `/itens/`; a
procedência no JSON; e a e2e de Mais → Créditos exigindo o bloco novo.

### Os "menores" desta rodada: medidos de novo no build atual

Sete dos onze já estavam corrigidos no ciclo 1 (`32ddee7`, `8f28fad`) e a
auditoria os viu no servidor velho. Medido agora, a 360 × 740, com a conta
semeada:

| o que a auditoria relatou | medido agora |
|---|---|
| FAB cobre 49 % do ⇄ da 1ª linha | **0 %** (FAB em 288/588, ⇄ em 300/696) |
| crédito da ilustração 300,7 × **13** px | 300,7 × **44** px |
| barra de 5 abas visível no player | **ausente** na preparação e no exercício |
| passo do exercício rola 130 px | `scrollHeight` **740** = `innerHeight` 740 |
| Desafios com o `objetivo` em caixa baixa como título | "Primeira barra fixa em 12 semanas" e "5 km sem parar em 12 semanas", com o `objetivo` de subtítulo |
| "Todos os registros" sem "ver mais" | botão "Ver mais 12 de N" |
| §14.1.1 contradiz "volta ao mesmo passo" | texto da SPEC já ajustado no ciclo 1 |

Os quatro que continuam de pé estão na lista de conhecidos do ciclo 1 e não
mudaram: ficha em folha fora do player sem stepper/n-N, subtítulo das coleções
de aparelho vindo de `specs`, `Colecao.circuito` calculado sem leitor, CSP
completa esperando o domínio do Supabase, e `ultima_firme` parcial enquanto a
sessão corre (com o item 1 corrigido, a sessão que nunca conclui virou caso
raro).

### Portões

Rodados nesta ordem, com a árvore limpa, numa janela sozinha:

```
npm run lint   limpo (sem avisos)
npm run build  ✓ Compiled successfully · 90 páginas
npm test       Test Files 43 passed (43) · Tests 975 passed (975)
npm run e2e    202 passed (7.3m) — Chromium 360 × 740
```

`git diff c3de09f..HEAD -- lib/progressao.ts lib/montagem.ts` (`c3de09f` é o
último commit que tocou o motor, ainda no v1): **vazio**.

> Nota de ambiente: o `npm run e2e` desta etapa rodou com `E2E_PORT=3110
> MOCK_SUPABASE_PORT=54340` porque a 3100/54321 e a 3101 estavam ocupadas por
> outro agente. **Antes de auditar, confira que o servidor que você está
> medindo é o do build atual** — compare o hash do CSS do HTML servido com
> `ls .next/static/css/`. Foi essa confusão que produziu sete achados falsos
> nesta rodada.

### Como testar no celular

1. Comece um treino, registre **só o primeiro exercício** e toque em
   "Concluído": o resumo diz "Não foi feito nesta sessão, então não conta como
   falha: …" com os outros cinco, e o Relatório não mostra ↓ nenhum para eles.
2. Registre um exercício **abaixo do piso** e conclua: esse continua com
   "conta como falha".
3. Explorar → "Por aparelho" → a capa do Banco agora é a foto de execução do
   primeiro exercício, não a foto do banco. Mais → Equipamento continua com as
   fotos dos itens, e Mais → Créditos explica de onde elas vêm.
4. Abra `/treinar` direto pela URL (atalho ou outra aba): os dois treinos da
   fase aparecem em menos de um segundo. Se um dia a tela ficar parada, depois
   de 12 s aparece a faixa "O app não terminou de abrir." com **Recarregar**.

---

## Fechamento v2.1 — ciclo 3 de correções (os três "importantes" que sobraram) ✅

Três itens vindos da auditoria final (rodada 3): a trava do e-mail no banco
(lente B, segurança) e duas frases de PROGRESSO.md que não correspondiam ao
repositório (lente C). Nenhuma linha de app/, components/ ou lib/ mudou de
comportamento — só `lib/erros-auth.ts` ganhou uma tradução nova.

### 1. `ALLOWED_EMAIL` também no banco (SPEC §9)

Até aqui o e-mail permitido só era checado no middleware. A chave anon é
pública (vai no navegador), então qualquer pessoa que a visse podia chamar o
`/auth/v1/signup` do projeto: a RLS por `auth.uid()` isolava os dados de cada
linha, mas o banco ficava aberto a contas estranhas — e o trigger
`handle_new_user` criava perfil para todas.

Em `supabase/schema.sql`, tudo idempotente (o arquivo continua podendo ser
colado inteiro, quantas vezes quiser):

- **A constante**, no topo, num bloco de comentário **"AJUSTE AQUI"**:
  `public.allowed_email()` — uma função `sql immutable` que devolve o literal
  `miguelgsaviotti29@gmail.com`. Escolhida em vez de uma tabela
  `public.app_config` porque é mais simples: não precisa de RLS e sai do
  PostgREST com um `revoke all on function public.allowed_email() from public`
  (o `anon` não consegue nem ler o e-mail por RPC — conferido no Postgres
  local: `ERROR: permission denied for function allowed_email`).
- **O bloqueio**: `public.exigir_email_permitido()` (`security definer`, para
  poder ler a constante revogada) e o trigger
  `on_auth_user_email_permitido` **`before insert on auth.users`**, que faz
  `raise exception 'Este app é pessoal: só o e-mail autorizado pode entrar.'`
  quando `lower(new.email)` é diferente de `lower(public.allowed_email())`.
  Como no Postgres todo BEFORE roda antes de qualquer AFTER, ele barra **antes**
  do `handle_new_user`, e a exceção aborta a transação inteira: não sobra linha
  nem em `auth.users` nem em `public.profiles`.
- **Policies**: nenhuma mudança era necessária, e foi conferido que não há
  nenhuma `using (true)` para `authenticated` — as 14 filtram por `auth.uid()`
  (11 por `user_id`, 3 pela primeira pasta do caminho no bucket). Agora tem
  teste: `lib/auditoria-seguranca.test.ts`.

**Como foi provado** (Postgres 16.13 local, com os stubs de `auth`/`storage` que
a lente B já usava — não existe Supabase real nesta máquina):

1. `schema.sql` aplicado do zero num banco novo: sem erro. Aplicado de novo:
   sem erro (só avisos de "already exists"). E uma terceira vez, já com dados:
   sem erro e sem perder linha.
2. `insert into auth.users (email) values ('miguelgsaviotti29@gmail.com')` →
   `usuarios=1 perfis=1` (o perfil nasceu pelo `handle_new_user`).
3. `insert into auth.users (email) values ('outra.pessoa@exemplo.com')` →
   `ERROR: Este app é pessoal: só o e-mail autorizado pode entrar.` e, depois
   dele, ainda `usuarios=1 perfis=1` — nada foi criado.
4. `'MIGUELGSAVIOTTI29@GMAIL.COM'` **passa** (a comparação é em `lower`) e
   `null` é recusado.

**No harness**: `scripts/mock-supabase.ts` ganhou a mesma trava e a **mesma
mensagem** — `exigirEmailPermitido()` é chamada no `criarUsuario` (que simula os
triggers de `auth.users`, então vale para `/auth/v1/signup` e para a semente) e
no `/auth/v1/token?grant_type=password`, devolvendo 403. `lib/erros-auth.ts`
traduz tanto a mensagem crua quanto o "Database error saving new user" com que
o GoTrue embrulha erros de trigger para o mesmo **"Este app é pessoal."** que a
tela de login já mostrava no bloqueio do middleware.

Cobertura nova: `e2e/mock.spec.ts` ("e-mail de fora não cria conta nem entra (o
trigger do schema)": signup 403, entrar 403, mesma mensagem, nenhum usuário e
nenhum perfil a mais), `lib/erros-auth.test.ts` (as duas formas da mensagem) e
`lib/auditoria-seguranca.test.ts` (4 testes: a constante bate com o
`ALLOWED_EMAIL` do `.env.local.example`, o trigger é `before insert` e levanta
exceção, a constante é revogada do `public`, nenhuma policy com `true`).

Cinto e suspensório na **Checklist de infraestrutura** e no **README**: conferir
o e-mail da constante antes de colar o schema, e desligar *Authentication →
Sign In / Providers → "Allow new users to sign up"* depois de criar a conta do
Miguel.

### 2 e 3. Duas frases erradas sobre o motor

- "`git diff` de `lib/progressao.ts` e `lib/montagem.ts` **contra o marco 1**:
  vazio" (ciclo 1) e "continuam **iguais ao commit do marco 1**" (marco Mídia)
  eram falsas: contra `cb069e5` são 477 inserções e 87 remoções nos 2
  arquivos (`git diff --stat cb069e5..HEAD -- …`), porque o
  motor evoluiu durante o v1 (auditorias do motor, `pesosBarras`/`BarraId`).
  O que é verdade — e é o que a camada visual promete — é o diff contra
  `c3de09f`, o último commit que tocou os dois arquivos, ainda no v1:
  `git diff c3de09f..HEAD -- lib/progressao.ts lib/montagem.ts` **vazio**.
  As duas frases agora dizem a linha de base e o comando.
- A terceira ("…: vazio", sem base, no ciclo 2) ganhou a mesma base explícita.
  As outras ocorrências foram conferidas uma a uma com
  `git diff --stat <base>..HEAD -- lib/progressao.ts lib/montagem.ts`: a do
  marco V2 (`git diff 0085878..HEAD`) e as duas do "Estado da entrega — v2.1"
  (`c3de09f`) estavam certas e ficaram como estavam.
- Os números do "Estado da entrega — v2.1" foram recontados no HEAD depois
  destas mudanças (ver "Portões" abaixo) e a seção "Estado da entrega — v1"
  continua rotulada como histórico, com a frase "esta é a do app v1, mantida
  como estava" logo no começo.

### Portões

Rodados nesta ordem, com a árvore limpa, numa janela sozinha:

```
npm run lint   limpo (sem avisos)
npm run build  ✓ Compiled successfully in 6,6s · 119 páginas geradas
npm test       Test Files 43 passed (43) · Tests 980 passed (980)
npm run e2e    203 passed (7,7m) — Chromium 360 × 740, portas 3100/54321
```

### Como testar no celular

Nada mudou na tela. O que dá para conferir, na hora de publicar:

1. Antes de colar `supabase/schema.sql` no SQL Editor, veja o bloco "AJUSTE
   AQUI" no topo: o e-mail ali tem que ser o mesmo do `ALLOWED_EMAIL` da
   Vercel. Se forem diferentes, o seu próprio "Criar conta" vai responder
   "Este app é pessoal.".
2. Depois de criar a conta do Miguel, desligue *Allow new users to sign up* em
   Authentication → Sign In / Providers. Tente criar outra conta de outro
   e-mail: o app recusa na tela, e mesmo quem falasse direto com o Supabase
   esbarraria no trigger.

---

## Marco Semana (SPEC §16) — 16/09/2026 ✅

O dono pediu: *"Quero que mostre os treinos dos dias e tenha também o app vai
saber que dia da semana é e que treino eu devo fazer em cada dia da semana,
segunda treino x, terça y, semana 3, segunda treino x3, etc... assim por diante
até eu progredir e ir evoluindo sempre."* O plano já existia em
`data/programa.json` e em `lib/calendario.ts`; o que faltava era a tela **dizer**
qual treino é o de cada dia — e o calendário estava **rotulando a semana
errada**. A regra nova está escrita em `SPEC.md §16`, com um ponteiro na §5.2.

### O defeito, com o caso

`semanaDoPlano(inicioDaSemana, perfil)` montava a semana **inteira** a partir de
`profiles.ultimo_treino` **começando na segunda**. Como `ultimo_treino` é o
estado de **agora** (já contando a sessão de segunda), a projeção saía um degrau
atrás. Reproduzido com o relógio em quarta 30/09/2026, `ultimo_treino = A1` e
uma sessão A1 concluída na segunda 28/09:

| dia | o que a aba Treino dizia | o que o calendário dizia | o certo |
|---|---|---|---|
| seg 28 | — | **Treino B ✓** | Treino A ✓ (foi A) |
| qua 30 | **HOJE Treino B** | **Treino A** | Treino B |
| sex 02 | — | **Treino B** | Treino A |

**A regra certa** (§16.2), num só lugar: `semanaCoerente()` /
`semanaEEstado()` em `lib/calendario.ts`, que `montarGrade()` (`lib/semana.ts`)
passou a usar — a mesma fonte para o calendário, para a faixa e para o card do
dia, de modo que as duas telas não podem mais discordar:

1. override com `workout_id` vale sempre;
2. **dia já vivido** (passado, e o próprio dia de hoje quando já existe sessão
   nele) = o treino da sessão que existe nele (concluída ou parcial); num dia
   passado sem sessão, o treino que era **esperado naquele momento** (o próximo
   depois da última sessão anterior àquela data) e, sem histórico nenhum, só
   "Treino de força";
3. **hoje sem sessão e o futuro** = a projeção a partir de **hoje**, ancorada em
   `ultimo_treino` — um dia passado (ou um hoje já treinado) nunca avança a
   âncora;
4. **as semanas seguintes** continuam de onde a corrente terminou;
5. na **Fase 2** os treinos são fixos por dia (nada muda);
6. **semana curta e overrides** continuam valendo por cima.

### O que mais foi feito

- **Faixa da semana com o treino de cada dia** (§16.3): sob o número, a sigla —
  `A`, `B` (ou `SA`, `IA`, `SB`, `IB` na Fase 2), `Corr.`, `Corda`, `Longa`,
  `Desc.`. O ✓/ponto/traço e o destaque de hoje continuam; o `aria-label` do dia
  passou a ser o nome completo ("quarta 16/09: Treino B, hoje"). Medido a
  360 px: sete colunas, fonte de 11 px, nada cortado, nada rolando de lado.
- **Semana da fase nos cards** (§16.4): o cabeçalho do `/calendario` mostra
  "Fase 1 · semana 1 de 12" (12 = `SEMANAS_PARA_FASE2`; na Fase 2, só "Fase 2 ·
  semana N") e acompanha a navegação entre semanas; cada dia de força na grade
  virou "Treino A · semana 1", cada dia de cardio "Corrida · semana 1 do plano";
  o card do dia na aba Treino ganhou "· semana N" no detalhe.
- **Nada mais mudou**: motor, montagem, offline, o que vai para o banco e o
  resto do Relatório e da aba Treino continuam iguais. Sem gamificação nova.

### Achado de fora do pedido: o build do e2e

`npm run e2e` estava falhando em **todo** teste que entra na conta — inclusive
os antigos, antes de qualquer mudança desta etapa. Causa: `.env.production`
(commit `624c9ec`) tem a URL e a chave do Supabase **de produção**, e as
variáveis `NEXT_PUBLIC_*` são assadas no build; um `npm run build` comum gerava
um app que falava com o Supabase real, o mock não recebia nada e o login morria
em "E-mail ou senha incorretos". Corrigido com um script novo,
**`npm run build:e2e`** (o mesmo build com as três variáveis apontando para o
mock, respeitando `MOCK_SUPABASE_PORT`), documentado em `e2e/README.md`.
`npm run build` continua sendo o portão de produção, intocado.

### Portões

Rodados nesta ordem, numa janela sozinha:

```
npm run lint      limpo (sem avisos)
npm run build     ✓ Compiled successfully · 119 páginas
npm test          Test Files 44 passed (44) · Tests 1009 passed (1009)
npm run build:e2e ✓ (o mesmo build apontando para o mock)
npm run e2e       214 passed (7,6m) — Chromium 360 × 740, portas 3100/54321
```

Provas novas: `lib/calendario.test.ts` (o caso do defeito, a semana seguinte e a
seguinte da seguinte, o dia passado sem sessão, sem histórico, Fase 2, override
e semana curta por cima), `lib/semana.test.ts` (a grade coerente, os rótulos com
a semana, as siglas da faixa nas duas fases) e `e2e/semana.spec.ts` (o caso no
navegador, nos dois temas, com as capturas).

### Como testar no celular

1. Abra a aba **Treino**. A faixa de cima agora diz, embaixo do número de cada
   dia, **qual treino é o daquele dia**: `A`, `B`, `Corr.`, `Desc.` — e o dia de
   hoje aparece em destaque com a sigla do treino que o card de baixo manda
   fazer. Os dois têm que bater **sempre**.
2. Toque na faixa: abre o **Calendário**. Logo abaixo do intervalo da semana
   está "Fase 1 · semana N de 12". Cada linha diz "Treino A · semana N" ou
   "Corrida · semana N do plano".
3. Confira o **passado**: o dia em que você treinou mostra o treino que você
   **fez** (com ✓), não o que a projeção acha. Um dia de força que você pulou
   mostra o treino que era para ser, com a marca de não feito.
4. Toque em **›** (próxima semana): a alternância continua de onde esta semana
   terminou — se a sexta é A, a segunda que vem é B — e a semana da fase sobe.
5. Depois de concluir um treino, volte à aba Treino: o dia de hoje vira ✓ e o
   próximo dia de força já mostra a outra letra.

---

## Auditoria do marco Semana (SPEC §16) — 16/09/2026

Auditoria independente do commit `c4bf82b`, com os quatro portões rodados do
zero e o app dirigido no Chromium a 360 × 740 contra o mock, nos dois temas.

### O que passou

- **O defeito da §16.1 está morto**: com a segunda 14/09 concluída em A1 e
  `ultimo_treino = A1`, com o relógio na quarta 16/09, a faixa da aba Treino, o
  card do dia e o `/calendario` dizem a mesma coisa — seg "Treino A ✓", qua
  "Treino B" (hoje), sex "Treino A" — nos dois temas. A semana seguinte segue
  B · A · B e a terceira A · B · A; voltar e avançar continua coerente.
- **Segunda sem sessão** vira "Treino de força ✕" na grade e "Força/faltou" na
  faixa: o calendário não inventa que foi feito.
- **Faixa a 360 px**: sete casas de 40,3 px dentro de um alvo de 314 × 89 px,
  sigla de 11 px, nada cortado, `scrollWidth == clientWidth == 360`, e o
  `aria-label` com o nome completo ("quarta 16/09: Treino B, hoje").
- **Fase 2** fixa por dia (SA · IA · Corr. · SB · IB · Longa · Desc.), override
  com treino escolhido e semana curta continuam valendo por cima.
- Motor e montagem intocados (`git diff` vazio em `lib/progressao.ts` e
  `lib/montagem.ts` contra `origin/main`).

### Corrigido nesta auditoria

- **"Fase 1 · semana 0 de 12"**: hoje é a semana 1 da fase, então um toque em
  "‹" no calendário já mostrava a semana anterior a `fase_desde` com "semana 0"
  no cabeçalho e "Treino de força · semana 0" nos cards (e "semana −1" mais
  atrás). Agora, antes do começo da fase, o cabeçalho mostra só "Fase 1" e o dia
  só o nome. Escrito na §16.4 e coberto por unitário.

### Corrigido na rodada 1 da auditoria (16/09/2026)

- **O dia de hoje depois de treinado** mostrava o treino da projeção, não o que
  foi feito. Com A1 na segunda e o B1 de hoje (quarta) concluído, o calendário
  mostrava "QUA 16 Treino A ✓" (foi B), fazia aparecer dois "Treino A" na mesma
  semana e empurrava a sexta para "Treino B" (deveria ser A) — a faixa e o
  diálogo do dia diziam o mesmo. Em `montarSemana()` (`lib/calendario.ts`) a
  rotulagem pelo que aconteceu passou a valer também para **hoje quando existe
  sessão no dia**: o dia mostra o treino feito e **não** avança a âncora (o
  `ultimo_treino` já o contabilizou), então a sexta volta a projetar A. Um dia
  de hoje **sem** sessão continua projetando de `ultimo_treino`. Escrito na
  §16.2 (itens 2 e 3), com unitários em `lib/calendario.test.ts` e
  `lib/semana.test.ts` e um e2e em `e2e/semana.spec.ts` que semeia a sessão de
  hoje.

### Como testar no celular

Na quarta, depois de concluir o treino do dia: o `/calendario` e a faixa da aba
Treino mostram o treino **que você fez** no dia de hoje (com ✓), e o próximo dia
de força da semana segue a alternância a partir dele.

### Rodada 2 da auditoria (16/09/2026)

Os quatro portões rodados do zero sobre `eded899`, nesta ordem, numa janela
sozinha: `npm run lint` limpo · `npm run build` ✓ (119 páginas) ·
`npm test` 44 arquivos, 1009 testes · `npm run build:e2e` ✓ · `npm run e2e`
**214 passed (7,6m)**. Depois, o app dirigido à mão no Chromium a 360 × 740
contra o mock, nos dois temas, refazendo o caso do defeito, a segunda sem
sessão, a Fase 2, o override e a semana curta: tudo confere com o que está
escrito acima (faixa de sete casas de 40,3 px num alvo de 314 × 89 px, sigla de
11 px, `scrollWidth == clientWidth == 360`, nada cortado).

Ficaram dois detalhes pequenos, anotados e **não** corrigidos aqui (não são do
pedido do dono e mexem em comportamento antigo):

- Um dia de **cardio** mostra sempre a semana do plano **do perfil**
  (`profiles.semana_corrida`, §5.5), então navegar para outra semana continua
  dizendo "Corrida · semana 1 do plano" enquanto os dias de força já dizem
  "semana 2", "semana 3". É o que a §16.4 escreve, mas vale rever quando o
  plano de cardio ganhar projeção por data.
- A faixa escreve o sábado como "sab" (`formatarDiaCurto`, de `EEEEEE`) e a
  grade do calendário como "SÁB" (`diaCurto`, em `lib/hoje.ts`) — duas grafias
  para o mesmo dia, herdadas do Marco 1.

---

## Marco Dias (SPEC §17) — 16/09/2026

O dono pediu: *"ter a opção do usuario selecionar quais dias ele vai treinar
[…] e o plano ser personalizado desta forma, e ele vai ver no historico quantas
vezes o usuario treinou na semana e se voltar na proxima ele vai falar qual
treino ele deve fazer e o que deve fazer."* Até aqui a semana era a do
`programa.json` e ponto — quem treinava sábado e não segunda via "descanso" no
dia em que ia treinar.

### O que foi feito

- **SPEC §17 escrita antes do código** (e uma frase na §5.2 apontando para ela):
  onde se escolhe, como a semana é distribuída, o que passa a ler a semana
  montada e nove critérios de aceite.
- **`lib/dias.ts`** (funções puras, sem React nem Supabase):
  `semanaPersonalizada(fase, dias)` devolve os sete dias no **mesmo formato** de
  `programa.fases[fase].semana`. Sem a preferência (`null`), devolve a semana do
  JSON tal como está. Com uma lista: força primeiro nas quantidades da fase
  (escolhida entre **todas** as combinações, minimizando dias consecutivos
  quando a fase pede folga e preferindo os dias do próprio programa), depois o
  cardio nos dias que sobram (com os nomes e minutos da fase), depois o dia
  livre com as notas de descanso do programa. Faltando dia, corta na ordem de
  sacrifício da §5.4; sobrando um dia só, é o Treino A.
  Junto: `diasDeTreinoDasPrefs`, `comDiasDeTreino`, `diasPadraoDaFase`,
  `resumoDosDias`, `treinosParaNDias`.
- **Ligado no calendário**: `tipoDoDia()` passa a receber o **perfil** (que
  carrega `prefs`) em vez da fase solta e lê `semanaDoPerfil()`; com isso
  `montarDia`, `treinoDeHoje`, `sessaoCardioDeHoje`, `semanaDoPlano`,
  `semanaCoerente`/`semanaEEstado`, `montarGrade`, `montarMes`, a semana curta
  e `oQueFaltaNaSemana` passam todos a ver a semana escolhida. Uma fase solta
  continua aceita (vale a semana do programa).
  `treinoDoDia()` passou a honrar um treino escrito no dia também na Fase 1 —
  é o que faz o "Treino A" da semana de um dia só valer.
- **Meta semanal**: `metaSemanalPadrao(fase, prefs)` conta as sessões da semana
  **montada**. `prefs.meta_semanal` continua mandando por cima.
- **UI**: card **"Dias de treino"** em Mais → Preferências
  (`components/mais/dias-de-treino.tsx`) com sete chips de ≥ 44 px em duas
  linhas, o resumo do que a escolha produz ("3 de força · 2 de cardio · 1 livre
  · meta semanal 5") e "Voltar aos dias do programa"; atalho **"Meus dias"** no
  cabeçalho do `/calendario`. Salva como as outras preferências: sobe pela fila
  (§8) e o cache do TanStack Query é invalidado, então a aba Treino e o
  calendário mudam na hora.

### Decisões

- **Quem manda no empate** entre distribuições: primeiro a folga (só nas fases
  que a pedem — a Fase 1, corpo inteiro; a Fase 2 já põe seg-ter e qui-sex
  juntos no próprio programa), depois os dias do programa, depois o começo da
  semana. É o que faz "seg a sáb" cair em seg/qua/sex na Fase 1 e em
  SA/IA/SB/IB na Fase 2, sem nada disso estar escrito no código.
- **Dia escolhido que sobra** é um dia livre com a nota do programa (barra fixa,
  depois caminhada leve); **dia não escolhido** é descanso seco, com "Treinar
  mesmo assim" (§5.3) sempre disponível.
- **Nada muda no banco**: só `profiles.prefs.dias_de_treino` (o `prefs` já é
  `jsonb`). `supabase/schema.sql` intocado, motor e montagem intocados.

### Como testar no celular

1. **Mais → Preferências → Dias de treino**: os chips já vêm marcados nos dias
   do programa. Toque em **qui** — a linha embaixo passa a dizer "3 de força ·
   2 de cardio · 1 livre · meta semanal 5".
2. Volte para **Treino**: a faixa da semana mostra `A · Corr. · B · Desc. ·
   A · Corr. · Desc.` e a meta continua em 5. Toque na faixa: o `/calendario`
   diz a mesma coisa, com a quinta como "Descanso — 1 repetição solta de barra
   fixa" e o domingo como descanso seco.
3. Desligue **ter** e **sáb**: sobram seg, qua e sex, o cardio some da semana e
   a meta semanal vira **3** (na aba Treino e no Relatório, em "Semanas
   seguidas · com a meta de 3").
4. Abra o app num **domingo** com essa escolha: o card do dia é "Descanso" com
   **"Treinar mesmo assim"** — treinar ali continua valendo como o próximo da
   alternância.
5. **"Voltar aos dias do programa"** apaga a escolha e a semana volta a ser a do
   `programa.json`.
6. No `/calendario`, o botão **"Meus dias"** no cabeçalho leva direto ao card.

### Portões

`npm run lint` limpo · `npm run build` ✓ · `npm test` **1062 testes**
(45 arquivos; 39 novos em `lib/dias.test.ts`, incluindo a propriedade sobre os
**127** conjuntos de dias: na Fase 1 nunca dois treinos de força seguidos
quando havia alternativa) · `npm run e2e` **222 passed (7,8 min)**, com
`e2e/dias.spec.ts` novo (9 testes, nos dois temas) e nenhum antigo afrouxado.
Capturas em `capturas/dias/`: `01-preferencias-dias.png` (+ claro),
`02-treino-faixa-6-dias.png` (+ claro), `03-calendario-6-dias.png`,
`04-domingo.png`.

### Auditoria independente (16/09/2026)

Portões rodados do zero (`lint` limpo · `build` ✓ · `npm test` **1062** ·
`npm run e2e` **230 passed**), a distribuição conferida **à mão** contra 14
combinações de dias nas duas fases e depois na tela, no Chromium a 360 × 740
contra o mock, nos dois temas.

- **Novo**: `e2e/dias-auditoria.spec.ts` (8 testes) cobre o que faltava — uma
  combinação **fora** dos dias do programa (seg, ter, qui, sex e sáb → força
  seg/qui/sáb e cardio ter/sex, quarta em descanso seco), a **Fase 2** com seis
  dias (SA · IA · Corr. · SB · IB · Longa) e com **quinta a domingo** (os quatro
  treinos na ordem, sem cardio, meta 4), a escolha que sobrevive a **recarregar**
  a página, a escolha feita **sem rede** (vai para a fila do §8 e sobe no
  "Tentar agora") e a alternância ancorada em `ultimo_treino` **sobre os dias
  escolhidos**, inclusive depois de treinar num dia que ele não escolheu — a
  sessão conta na meta da semana e o próximo dia de força é o outro treino.
- **Corrigido aqui**: `diaDoPrograma()` (`lib/dados.ts`) ficou sem nenhum uso
  depois do marco — quem lê o dia agora é `semanaDoPerfil()` — e foi removida.
- **Conferido**: sem `prefs.dias_de_treino` a semana é byte a byte a do
  `programa.json` (unitário) e os 222 e2e antigos passam sem um ajuste sequer;
  `git diff origin/main` vazio em `lib/progressao.ts` e `lib/montagem.ts`;
  `supabase/schema.sql` intocado; nada rola de lado a 360 px; tudo em pt-BR e
  sem nome inventado (treinos, sessões e notas saem do JSON).

### Visto e **não** corrigido (decisões para o dono)

1. **Fase 1 com um dia só** fica no **Treino A para sempre**: a §17.2 item 6
   escreve `A1` no dia e, com o `treinoDoDia()` novo, a alternância não roda
   mais ali — ele nunca faz o Treino B (o do terra). Deixar `"alternar"` no dia
   já daria "Treino A" para quem está começando (`ultimo_treino` vazio) e
   alternaria depois.
2. **Fase 2 com dois dias** sobra com **IA e IB** — dois treinos de perna e
   nenhum de superior —, porque a §5.4 só proíbe cortar quem tem agachamento ou
   terra. Um par superior + inferior (SA e IA) seria mais treino pelo mesmo
   tempo.
3. Uma sessão feita num **dia não escolhido** continua "Descanso" na faixa e na
   grade (sem ✓), embora conte na meta e no Relatório: a §16.2 só rotula pela
   sessão real os dias cujo tipo é força. É de antes deste marco, mas aparece
   muito mais agora que qualquer dia pode ser descanso.
4. O card "Dias de treino" escreve "meta semanal N" com o **padrão** da semana
   montada mesmo quando `prefs.meta_semanal` manda outro número no card logo
   abaixo ("usando N por semana") — dois números diferentes na mesma tela.

---

## Marco Dias — ajustes decididos depois da auditoria (16/09/2026) ✅

Os quatro itens da lista "Visto e **não** corrigido" acima, decididos pelo dono
e aplicados. Motor e montagem continuam intocados (`git diff origin/main` vazio
em `lib/progressao.ts` e `lib/montagem.ts`).

1. **Fase 1 com um dia só volta a alternar** (`lib/dias.ts`): o dia fica com
   `treino: "alternar"` em vez de `A1`, e a escada do §5.2 item 3 decide se hoje
   é A ou B. `proximoTreinoAlternado(null)` já começa em A1 para quem está
   começando, então nada muda no primeiro treino — e o Treino B (o do
   levantamento terra) passa a chegar. SPEC §17.2 item 6 e §17.4 item 4
   reescritos; unitários de `lib/dias.test.ts` e `lib/calendario.test.ts`
   ajustados (o de calendário agora exige B1 depois de um A1 e A1 para quem
   começa — mais forte do que o de antes, não mais frouxo).
2. **Fase 2 com dois dias vira SA + IA** (`treinosParaNDias`): o corte da §5.4
   nunca deixa a semana só com treinos de perna. A regra nova é "não corte o
   último leve enquanto sobrar mais de um pesado"; com três dias continua SA,
   IA, IB, como antes.
3. **Treino feito em dia de descanso aparece** (SPEC §16.2 item 7): em
   `montarSemana()` (`lib/calendario.ts`) um dia que o plano dizia descanso ou
   cardio, mas que tem uma sessão de força registrada, vira dia de força com a
   sigla do treino; em `marcarDia()` (`lib/semana.ts`) o descanso com sessão ou
   cardio concluído ganha ✓ (parcial quando a sessão ficou aberta). Com override
   no dia, vale o override. Quatro unitários novos em `lib/semana.test.ts` e o
   e2e `dias-auditoria` agora confere a quarta não escolhida com "A" e `feito`.
4. **"meta semanal N" do card "Dias de treino"** passa a usar
   `metaSemanal(prefs, fase)`: quando `prefs.meta_semanal` existe, os dois cards
   da mesma tela dizem o mesmo número.

**Conhecido, não corrigido**: um **cardio** feito num dia de descanso ganha o ✓,
mas o rótulo do dia continua "Desc." — mudar a sigla exigiria levar as sessões
de cardio para dentro de `semanaCoerente()`, que hoje só recebe as de força. A
marca já resolve o que incomodava: o dia treinado parecia vazio.

---

## Marco Retomada (SPEC §18) — 16/09/2026 ✅

O pedido do dono, literal: *"se ele não finalizar a semana ou os dias, ter a
opção de resetar ou de continuar, dependendo de quantos dias foi desde o ultimo
treino"*.

**SPEC §18 foi escrita antes do código** (faixas, opções, o que cada uma grava,
critérios de aceite), e a §5.5 ganhou a frase que aponta para ela.

### O que foi feito

- **`lib/retomada.ts`** (puro, sem React nem Supabase): `diasParado()` e
  `ultimaAtividade()` (força concluída, cardio concluído ou repetição solta de
  barra fixa), `faixaDaRetomada()` (0–6 nada · 7–13 continuar/semana · 14–27
  continuar/leve · 28+ continuar/leve/zero), `deveMostrarRetomada()` (a pausa é
  reconhecida pela **âncora** `em − dias`: a mesma pausa não pergunta duas
  vezes, uma pausa nova pergunta) e `escritasDaRetomada()`, que devolve as
  linhas a gravar sem tocar no banco. **27 unitários** em `lib/retomada.test.ts`.
- **O motor não mudou uma linha.** "Voltar mais leve" escreve nos exercícios
  exatamente os campos da 3ª falha da §6.2 (`semana_leve`, `carga_antes_leve`,
  60 % arredondados para baixo na escala do implemento) e é o motor de sempre
  que devolve a carga cheia na sessão seguinte. "Recomeçar do zero" escreve o
  estado inicial da §6.1 (`carga_inicial.kg` do JSON; reps/tempo/assistência de
  volta a `null`, que é como o motor guarda "nunca fez"), preservando o override
  de incremento, o `desativado` e as notas.
- **`lib/queries/retomada.ts`**: enfileira tudo pelos caminhos que já existiam —
  upsert em `exercise_state`, upsert por id em `progression_events` e update em
  `profiles` —, atualizando o cache do TanStack Query na hora. O perfil vai por
  último: é o `prefs.retomada` que faz o card sumir.
- **`components/treino/retomada.tsx`**: o card "Você ficou N dias sem treinar"
  no topo da aba Treino, acima do card do dia, com as opções da faixa (alvos de
  ≥ 44 px, texto em duas linhas, nada rola de lado a 360 px). "Recomeçar do
  zero" abre um diálogo de **duas etapas** (o que se perde → a confirmação).
  Tocar em "Começar treino" com o card pendente **não** começa o treino: rola
  até o card, põe o foco nele e destaca — decidir vem antes.
- **Relatório**: uma linha "Pausa de N dias · escolheu …" no Histórico quando há
  `prefs.retomada` (rótulo de tela, tirado das prefs — nenhuma tabela nova).
- **Banco**: nada novo. Só os dois motivos `retomada_leve` e `recomeco` no
  comentário de `progression_events.motivo` e o tipo `MotivoProgressao`.

### Portões

`npm run lint` limpo · `npm run build` ✓ · `npm test` **1097** ·
`npm run e2e` **240 passed** (11 novos em `e2e/retomada.spec.ts`).
Capturas em `capturas/retomada/`: 10 dias (escuro e claro), 20 dias, 40 dias e
o diálogo de confirmação.

### Como testar no celular

1. **Mais → Backup** não precisa de nada aqui; a pausa é calculada sozinha.
2. Fique **7 dias** sem registrar nada (ou registre a última sessão com data
   antiga pelo Supabase) e abra a aba **Treino**: o card aparece no topo com
   "Continuar de onde parou" e "Recomeçar a semana".
3. Toque em **Começar treino** antes de decidir: o app leva de volta ao card.
4. Com **14 dias ou mais**, "Voltar mais leve" põe todos os exercícios com carga
   a 60 %; a lista do dia já mostra a carga nova e o próximo treino abre com
   ela. Na sessão seguinte o motor devolve a carga cheia sozinho.
5. Com **28 dias ou mais** aparece "Recomeçar do zero", que só grava depois das
   duas confirmações. Depois dele, o Relatório mostra a linha da pausa e o
   próximo treino volta a ser o Treino A.
6. **Sem rede** a escolha vale na hora e sobe quando o sinal voltar (fila do §8).

### Conhecido, não corrigido

- Com **14 dias ou mais** e **nenhuma** leitura de `exercise_state` em cache
  (primeira abertura, sem rede, sem cache), os botões do card ficam
  desabilitados até as cargas carregarem: sem elas, "mais leve" e "do zero"
  gravariam vazio. Preferi travar a decisão a gravar errado. *(Corrigido na
  auditoria da rodada 2, abaixo: só "mais leve" e "do zero" desligam;
  "Continuar" nunca desliga.)*

---

## Auditoria do marco Retomada — rodada 1 (16/09/2026)

Portões rodados do zero: `npm run lint` limpo · `npm run build` ✓ ·
`npm test` **1097** · `npm run e2e` **240 passed (8.8 min)**. Motor e montagem
intocados (`git diff origin/main` vazio em `lib/progressao.ts` e
`lib/montagem.ts`); no schema só os dois motivos no comentário.

Conferido no Chromium a 360 × 740 contra o mock, nos dois temas, com dados
semeados: as quatro faixas nas bordas exatas (7, 13, 14, 27 e 28 dias), o que
cada escolha grava linha a linha no mock (`exercise_state`,
`progression_events`, `profiles.semana_*`, `prefs.retomada`, `ultimo_treino`,
`fase_desde`), a sessão em andamento que **não** conta, o card que some e não
volta para a mesma pausa mas volta numa pausa nova, e a linha da pausa no
Relatório.

### Corrigido aqui

1. **O FAB "Ajustar" cobria o card.** Ele é `fixed right-4 bottom-24` e caía em
   cima da opção "Voltar mais leve", comendo o fim da frase e o toque naquele
   canto. Com a pausa por decidir ele sai da tela (SPEC §18.3 ganhou a frase).
2. **SPEC §18.3 dizia "cache do TanStack Query invalidado"** e o código
   atualiza o cache **à mão** — de propósito, porque invalidar sem rede jogaria
   a aba Treino na tela de erro. A frase foi corrigida para o que o código faz.
3. **Seis e2e novos** em `e2e/retomada.spec.ts` (16 no total do arquivo): as
   bordas das faixas, a pausa nova que pergunta de novo, a sessão depois da
   semana leve devolvendo a carga cheia **sem contar falha** (`fim_semana_leve`,
   `falhas_seguidas = 0`), a linha do Relatório, o "Voltar mais leve" offline
   (as cargas vêm do cache persistido) e o FAB que some.

### Visto e **não** corrigido (vai para o dono decidir)

1. **Só "Começar treino" passa pelo card.** *(corrigido na rodada 1 de
   correção, abaixo.)* Num dia de **cardio**, o "Começar"
   é um `<Link>` para `/cardio/corrida?semana=N` e leva direto; num dia de
   **descanso**, o "+1" da barra fixa grava na hora. Como a conta de dias parado
   olha a **última atividade**, qualquer um dos dois zera a pausa e o card
   **some sem nunca ter sido decidido** — quem voltou de 30 dias e tocou no "+1"
   nunca recebe "Voltar mais leve". Confirmado no navegador. Conserto: passar os
   outros gestos da aba Treino pelo mesmo portão da §18.3 (o "Começar" do
   cardio, o "+1", o "Treinar mesmo assim" e a caminhada), ou fazer a conta
   ignorar a atividade **de hoje** enquanto a pausa não foi decidida.
2. **A pausa longa some da janela de 16 semanas.** `useCardioDesde`/`useSoltas`
   leem só as últimas 16 semanas: com **um cardio de 150 dias** como única
   atividade da vida, o card **não aparece**; com uma sessão de força de 200
   dias mais um cardio de 150, o card diz "200 dias" em vez de 150. As opções da
   faixa são as mesmas dos dois jeitos (28+), então só o número engana.
   Conserto: uma leitura própria da última atividade (um `order`+`limit 1` por
   tabela, sem janela) para `diasParado`.

---

## Correção da auditoria do marco Retomada — rodada 1 (16/09/2026)

O auditor reprovou o marco por **um** problema, e ele foi corrigido dos dois
jeitos que ele apontou — um fecha o buraco na interface, o outro fecha o mesmo
buraco nos dados, para quando a atividade chega de outra tela.

### O problema

O portão da §18.3 existia só no "Começar treino" do card de força. Num dia de
**cardio** o "Começar" era um `<Link>` e ia direto para `/cardio/<tipo>?semana=N`;
num dia de **descanso** o "+1" da barra fixa gravava na hora; "Treinar mesmo
assim" e a caminhada leve de domingo também eram links. Como a conta de dias
parado olha a **última atividade**, qualquer um desses gestos punha atividade em
hoje, a conta caía para zero e o card **sumia sem nunca ter sido decidido**:
quem voltou de 30 dias e tocou no "+1" nunca receberia "Voltar mais leve" e
treinaria no dia seguinte com a carga cheia.

### O que mudou

- **`components/treino/tela-treino.tsx`** — um `pedirDecisao()` só: com a pausa
  por decidir, ele rola até o card, põe o foco nele, destaca e avisa "Antes:
  escolha como você quer voltar.", devolvendo `true` para quem o chamou parar
  ali. Passam por ele o "Começar treino", o `somarUma()` do "+1" e (via
  `bloqueado` / `aoBloquear`) os botões dos cards de cardio e de descanso.
- **`components/treino/cards.tsx`** — `CardCardio` e `CardDescanso` aceitam
  `bloqueado` + `aoBloquear`. Bloqueados, o "Começar" do cardio, o "Começar
  caminhada leve" e o "Treinar mesmo assim" viram `<Button>` que chama o portão;
  sem pausa pendente continuam `<Link>`, para não perder o prefetch do Next.
- **`lib/retomada.ts`** — `pausaCorrente()`, a rede de segurança: enquanto a
  pausa **não foi decidida**, a atividade registrada **hoje** não entra na conta.
  Se algo for registrado de outra tela (calendário, outro aparelho, fila que
  subiu), o card continua de pé o dia inteiro e só some quando ele decide. No
  dia seguinte a conta já é 1 e não há card nenhum.
- **SPEC §18.1 e §18.3** ganharam as duas frases (quais gestos passam pelo card
  e a ressalva da atividade de hoje) e a §18.6 um critério de aceite novo (o 8).

### Testes

- **Unitários: 1097 → 1102** (+5, em `lib/retomada.test.ts`): a atividade de
  hoje que não apaga a pausa (barra fixa, cardio e força), a pausa já decidida
  que não volta, o dia seguinte com a conta em 1 e o caso sem pausa nenhuma.
- **Ponta a ponta: 250 passed**, com **4 testes novos** em
  `e2e/retomada.spec.ts` (16 → 20 no arquivo), um por gesto: o
  dia de cardio em que "Começar" e "Treinar mesmo assim" levam ao card e nada é
  gravado; o dia de descanso em que o "+1" leva ao card, **`pullup_singles`
  continua vazia** e, depois de decidir, o mesmo toque registra; o domingo com a
  caminhada leve; e a pausa que sobrevive a uma atividade de hoje vinda de fora.

### Portões

`npm run lint` limpo · `npm run build` ✓ · `npm test` **1102 em 46 arquivos** ·
`npm run e2e` **250 passed (9.3 min)**. Motor e montagem intocados. Capturas em
`capturas/retomada/`, agora com `05-dia-de-cardio-bloqueado.png` e
`06-dia-de-descanso-mais-um.png`.

### Como testar no celular

1. Fique 30 dias sem registrar nada e abra a aba **Treino** num **dia de
   cardio**: toque em "Começar" — o app rola até o card e pede a decisão.
2. Num **dia de descanso**, toque no **+1** da barra fixa: nada é somado e o
   card ganha o destaque. Escolha "Voltar mais leve" e toque no +1 de novo: aí
   sim o contador anda.
3. Registre alguma coisa hoje (por outra tela) e recarregue: o card **continua**
   lá com os mesmos N dias, até você decidir.

---

## Auditoria do marco Retomada — rodada 2 (16/09/2026)

Auditoria independente, do zero: `npm run lint` limpo · `npm run build` ✓ ·
`npm test` **1102 em 46 arquivos** · `npm run e2e` verde. Motor e montagem
intocados (`git diff origin/main` vazio em `lib/progressao.ts` e
`lib/montagem.ts`); no schema só os dois motivos no comentário.

Conferido usando o app no Chromium a 360 × 740 contra o mock, **nos dois
temas**, com dados semeados: a contagem de dias (sessão **em andamento** de hoje
não conta; um **cardio concluído** mais recente manda na conta; um cardio **não
concluído** não conta), as faixas e as opções, o diálogo de duas etapas dentro
dos 360 px com alvos ≥ 44 px, e o que cada escolha grava **linha a linha** no
mock:

- **leve** (20 dias) — `agachamento-livre` 39,5 → **23,5** com
  `carga_antes_leve = 39,5` e `semana_leve = true`; `supino-reto-com-barra`
  29,5 → **17,5**; `falhas_seguidas` **intacto** (1 e 0); semanas 3/2/4 → 2/1/3;
  dois `retomada_leve` com `dias_parado: 20`; `ultimo_treino` e `fase_desde`
  intactos. Na sessão seguinte o motor devolve a carga cheia (`fim_semana_leve`,
  sem falha).
- **zero** (40 dias) — as duas cargas de volta a **7,5** (`carga_inicial` do
  JSON), `reps_alvo`/`tempo_alvo_s`/`assistencia` nulos, `falhas_seguidas = 0`,
  `semana_leve = false`, `carga_antes_leve` nulo, `sessoes_graca = 0`,
  `desativado` e `incremento_kg` preservados; semanas 1/1/1,
  `ultimo_treino = null`, `fase_desde = hoje`, `fase_atual` igual; três
  `recomeco` (dois por exercício, um do programa com `exercise_id` nulo);
  `prefs.retomada = {em, dias: 40, escolha: "zero"}` e a linha no Relatório.

### Corrigido aqui

1. **A pausa sem rede trancava a aba Treino.** A leitura de **todas** as cargas
   (`estados-todos`) só roda quando a faixa tem "mais leve" — ou seja, a
   primeira vez que o card é desenhado é a primeira vez que essa leitura
   acontece. Sem rede ela fica pausada, e o card inteiro ficava desabilitado:
   com o card barrando todo gesto da §18.3 e o FAB fora da tela, não dava para
   decidir **nem treinar**. Reproduzido no navegador (com a leitura abortada:
   `continuar` e `leve` desabilitados, "Começar treino" barrado, FAB ausente).
   Agora só **"Voltar mais leve"** e **"Recomeçar do zero"** desligam, com uma
   linha dizendo por quê; **"Continuar de onde parou" nunca desliga**.
   `components/treino/retomada.tsx` (prop `semCargas`) e
   `components/treino/tela-treino.tsx`; SPEC §18.3 e o critério de aceite 9
   novo; e2e novo em `e2e/retomada.spec.ts` ("sem as cargas lidas, só
   'Continuar' fica de pé").

### Visto e **não** corrigido (fica para o dono)

1. **A janela de 16 semanas** (achado da rodada 1, ainda de pé):
   `useCardioDesde`/`useSoltas` leem só as últimas 16 semanas, então uma
   atividade mais antiga que isso não entra em `ultimaAtividade()`. Com um
   cardio de 150 dias como **única** atividade da vida o card não aparece; com
   uma sessão de força de 200 dias mais um cardio de 150, o card diz "200 dias".
   As opções da faixa são as mesmas (28+), então só o número engana. Conserto:
   uma leitura própria da última atividade (`order` + `limit 1` por tabela, sem
   janela) só para `diasParado`.
2. **Decidido é decidido, mesmo que a pausa cresça.** Quem escolhe "Continuar"
   aos 10 dias e fica outros 40 sem treinar não recebe mais nada — a âncora é a
   mesma pausa (SPEC §18.4, decisão do orquestrador). Está certo pela spec; só
   vale o dono saber.

### Como testar no celular

1. Ligue o modo avião **antes** de abrir o app depois de uma pausa de 14 dias ou
   mais: "Continuar de onde parou" funciona, as outras duas aparecem apagadas
   com a explicação, e dá para treinar depois de decidir.
2. Com rede, as três voltam a funcionar assim que as cargas carregam.

---

## Marco Números e Conquistas (SPEC §19) — 16/09/2026 ✅

O pedido do dono, literal: *"ele também vai ter o historico mostrando quantos
treinos fizemos quantos de força, cardio, barra, etc... gamificando o site e
plataforma"*.

**SPEC §19 foi escrita antes do código** (períodos, contagens, a tabela das 26
conquistas com a regra de cada uma, a tela, o aviso e os critérios de aceite), e
a §7 ganhou a frase que amarra as duas: *"gamificação sóbria = §13 e §19"* —
sem confete, som, pontos, níveis, ranking ou compartilhamento. O que sobe é o
número real.

### O que foi feito

- **`lib/numeros.ts`** (puro): `intervaloDoPeriodo()` (Semana civil seg–dom ·
  Mês civil · Tudo) e `numerosDoPeriodo()`, que devolve **Força** (sessões
  concluídas, por treino com o nome de `programa.json` e as livres à parte),
  **Cardio** (corrida · corda · outros, minutos, km, saltos), **Barra fixa**
  (sessões, reps em sessão, reps soltas, total e melhor série), **Minutos** e
  **Volume**. Os exercícios de barra fixa saem do catálogo (`implemento =
  'barra_fixa'` e `grupo = 'Costas'`), não de uma lista escrita à mão. Sessão
  em andamento ou abandonada não conta em nada. **22 unitários.**
- **`lib/conquistas.ts`** (puro): as **26 conquistas** da §19.3 com id, nome,
  descrição, regra, ícone (o *nome* do ícone lucide — a lib não importa React) e
  grupo, avaliadas em três formas de medir: **acumulado** (a data é a do
  registro que passou do alvo), **melhor registro** (a data é a do primeiro que
  sozinho alcançou) e **sequência** (a data é a do registro que fechou a
  N-ésima seguida). Cada uma devolve `atingida`, `em`, `atual/alvo` e o texto do
  que falta ("faltam 13 treinos"). **39 unitários**, com um caso que fecha e um
  que não fecha para cada conquista.
- **As 26**: força 1 · 10 · 25 · 50 · 100 · dias seguidos 3 e 7 · semanas com a
  meta 2 · 4 · 8 · 12 · Semana completa · primeira corrida · 20 min correndo ·
  5 km sem parar · 1.000 saltos de corda · primeira barra fixa sem elástico ·
  5 numa série · 10 numa série · 100 repetições soltas · 20, 40 e 60 kg na barra
  no agachamento ou terra · 10.000 e 50.000 kg de volume · Fase 2.
- **Relatório**: a seção **"Números"** logo abaixo dos contadores do topo, com o
  seletor de três botões (44 px cada) e a grade; e a seção **"Conquistas"**, com
  a grade de 3 colunas (desbloqueada em laranja com a data, bloqueada em cinza
  com o que falta) e a folha de detalhe com a descrição, a regra e o progresso.
  Os contadores acumulados do topo viraram a região **"Totais"**, para não se
  confundirem com os do período.
- **Aviso de conquista nova** (`components/relatorio/aviso-conquista.tsx`): card
  sóbrio "Conquista · Semana completa" com ícone, data e um botão **"Ok"** que
  grava `profiles.prefs.conquistas_vistas` pela fila (§8). Aparece no Relatório
  e na **Conclusão** do player, onde a sessão que acabou já conta antes de subir
  (como o card da semana da §14.1.5). Enquanto não recebe o "Ok", ele volta.
- **Cache**: concluir uma sessão agora invalida também as listas completas
  (`["progresso", …]`), e concluir um cardio ou registrar uma repetição solta
  atualiza `cardio-todos` e `soltas-todas`. Sem isso, os Números e as conquistas
  só veriam a sessão nova no carregamento seguinte.
- **Banco**: nada novo. A única gravação nova é `prefs.conquistas_vistas`.
- **Aba Treino**: nada muda. O chip "N conquistas" ao lado da sequência foi
  medido a 360 px e não cabe sem apertar a saudação e a chama (§19.6).

### Portões

`npm run lint` limpo · `npm run build` ✓ · `npm test` **1163** (61 novos:
22 em `lib/numeros.test.ts` e 39 em `lib/conquistas.test.ts`) ·
`npm run e2e` **258 passed** (7 novos em `e2e/conquistas.spec.ts`).
Capturas em `capturas/conquistas/`: `01-relatorio-numeros` e
`02-relatorio-conquistas` (escuro e claro), `03-conquista-detalhe` e
`04-conclusao-conquista`.

> **Lembrete do portão de e2e**: builde com `npm run build:e2e` antes de
> `npm run e2e` (o `npm run build` comum assa o `.env.production`, aponta o app
> para o Supabase de verdade e todo teste que entra na conta falha). Está em
> `e2e/README.md`.

### Auditoria (16/09/2026)

Conferido no Chromium a 360 × 740, nos dois temas, contra o mock com 12 sessões
de força, 2 de barra fixa, 3 corridas, soltas e uma sessão em andamento e uma
abandonada. As contagens dos três períodos batem com a conta à mão (Semana
Força 3 · Cardio 1 · Barra fixa 17 · 179 min · 200 kg; Mês 3 · 1 · 27 · 189 min;
Tudo 12 (A 8 · B 4) · 3 (89 min · 8,7 km) · 27 (2 sessões · 22 em sessão ·
5 soltas · melhor série 6) · 649 min), a sessão em andamento e a abandonada não
entram em nada, e as 26 conquistas mostram a data certa ou o "faltam N" certo.
As 26 células têm alvo ≥ 44 px, nenhuma corta texto e nada rola para o lado; o
"Fechar" da folha mede 44 × 44.

**Ajuste da auditoria**: a §19.7.6 pede um caso que fecha e um que não fecha
para **cada** conquista; `semanas-4`, `carga-60` e `volume-50k` só tinham o caso
que não fecha. Os três casos que fecham entraram em `lib/conquistas.test.ts`.

### Como testar no celular

1. Abra a aba **Relatório**. Logo abaixo de Treinos · Minutos · Volume está
   **Números**, com **Semana** selecionado.
2. Toque em **Mês** e em **Tudo**: as três linhas de detalhe mudam junto —
   "Força Treino A 8 · Treino B 4", "Cardio Corrida 3 · 89 min · 8,7 km",
   "Barra fixa 2 sessões · 16 em sessão · 5 soltas · melhor série 5".
3. Role até **Conquistas**: as conquistadas ficam em laranja com a data, as
   outras em cinza com "faltam N". Toque numa delas para abrir a folha com a
   regra e o progresso ("12 de 25").
4. Termine um treino. Se ele fechar uma conquista, a tela de **Conclusão**
   mostra o card sóbrio antes do "Próximo"; toque em **Ok** e ele não volta —
   nem ali, nem no Relatório.
5. **Sem rede** tudo funciona igual: as contas são locais e o "Ok" entra na fila.

---

## Marco Guia de uso (SPEC §20) — 16/09/2026 ✅

O dono pediu um tutorial "tipo uma aba", e logo corrigiu: *"ao invés de uma aba,
esta parte do tutorial pode ser na primeira vez que alguem criar a conta no app
e na aba mais ter o botão de mostrar o tutorial"*. Foi exatamente isso: **a
barra continua com cinco abas** e o guia é a rota `/mais/guia`.

### O que foi feito

- **SPEC §20** escrita antes do código, no formato dos adendos (§16–§19), com o
  pedido literal, onde o guia aparece, o formato, as nove seções, a cobertura,
  a chave `prefs.guia_visto` e os critérios de aceite. §3.9 e §13.7 ganharam um
  ponteiro de uma linha. **`supabase/schema.sql` intocado** (`prefs` já é jsonb).
- **`lib/abas.ts`** (novo): as cinco abas numa lista só — href, rótulo, **nome**
  do ícone lucide e prefixos, sem React. `components/nav-inferior.tsx` passou a
  desenhar essa lista (o ícone é resolvido por
  `components/icones-das-abas.tsx`), e o guia lê a mesma: os rótulos das abas
  **não** são redigitados em lugar nenhum. Um unitário prende isso.
- **`lib/guia.ts`** (novo, sem React/Supabase/Dexie): nove seções — Primeiros
  passos, A barra de abas, Treino, Explorar, Relatório, Corpo, Mais, Calendário,
  Sem internet e conta — com **80 funções**, cada uma com nome (o rótulo real da
  tela), uma frase, o caminho em chips e o `href` quando tem rota própria (com
  âncora: `/mais/preferencias#dias-de-treino`). A seção Treino vem em quatro
  blocos: "A tela", "No player", "Cardio" e "Barra fixa".
- **`lib/guia.test.ts`** (novo): todo `href` do guia tem um
  `app/(app)/<rota>/page.tsx` de verdade (o teste lê o disco), toda âncora é um
  `id=` que existe em alguma tela, toda seção tem função, nada vazio, ids únicos,
  e os nomes das abas são os de `lib/abas.ts` — mais a lista de cobertura da
  §20.5. Novas âncoras nas Preferências: `#tema`, `#meta`, `#treino`,
  `#incrementos` (o `#dias-de-treino` já existia, do marco Dias).
- **`components/mais/guia.tsx`** + `app/(app)/mais/guia/page.tsx` (novos): uma
  página rolável a 360 px com o índice de chips (rola até a seção), a
  **miniatura da barra de abas** desenhada com os mesmos ícones e rótulos da
  barra real, e as seções em cards. Cada função é uma linha com o caminho em
  chips e o botão **"Ir"** (44 px) quando tem rota.
- **Primeira entrada** (`components/treino/tela-treino.tsx`): perfil sem
  `prefs.guia_visto` → `router.replace("/mais/guia?inicio=1")`, **uma vez por
  carregamento** (marca de módulo, sem laço), com o esqueleto na tela até o
  desvio acontecer — a aba Treino não pisca.
- **Mais**: "Como usar o app" é a **primeira** linha da lista, com o ícone
  `CircleHelp`.
- **A marca**: só "Entendi, começar a treinar" (fim) e "Pular por agora" (topo,
  só no modo `?inicio=1`) gravam `prefs.guia_visto = true`, pela fila de saída
  (§8), e voltam para `/`. Abrir por Mais não grava nada e o botão do fim volta
  para Mais. Fechar o app sem tocar em nenhum dos dois faz o guia voltar na
  próxima entrada — é o comportamento desejado.
- **Mock e e2e**: `scripts/mock-supabase.ts` semeia `guia_visto: true` no perfil
  padrão e `usuarioComPerfil` (e2e/fixtures.ts) repõe a marca mesmo quando o
  teste passa `prefs` próprio — sem isso, todo e2e antigo cairia no guia. O spec
  novo escreve o perfil **sem** a chave para testar a primeira entrada.

### Decisões

- **Sem `invalidateQueries` depois de gravar a marca.** `salvarPrefs` já põe o
  perfil novo no cache do TanStack; invalidar releria o banco **antes** de a fila
  subir e traria o perfil velho — ou seja, o guia de novo. É o mesmo caminho de
  `conquistas_vistas`.
- **Player, Cardio e Barra fixa ficaram dentro da seção Treino**, em blocos: são
  fluxos que saem daquela aba, e a §20.4 fecha a lista de seções.
- **Ir só onde há rota própria.** Função de dentro de um fluxo ("Treinar mesmo
  assim", o card de retomada, registrar uma série) não tem "Ir": o caminho em
  chips já diz onde ela aparece.

### O que ficou de fora (não existe no app)

- **Mapa muscular na aba Corpo**: o mapa é a figura da ficha do exercício
  (§15), não tem nada em `/corpo`. O guia não promete.
- **`/progresso`**: é um redirecionamento para `/relatorio`, não uma tela; os
  gráficos e recordes estão listados dentro de Relatório.
- **Rotas com parâmetro** (`/cardio/[id]`, `/treinar/[sessionId]`,
  `/exercicios/[id]`, `/explorar/[tipo]/[valor]`): não abrem sozinhas, então não
  viram "Ir" — o caminho diz como chegar.

### Portões

`npm run lint` limpo · `npm run build` ✓ · `npm test` **1225** (62 novos:
`lib/guia.test.ts` e o bloco do guia em `lib/preferencias.test.ts`) ·
`npm run build:e2e && npm run e2e` **286 passed** (28 novos em
`e2e/guia.spec.ts`, incluindo um teste por "Ir" gerado a partir de
`lib/guia.ts`). Capturas em `capturas/guia/`: `01-guia-topo` (escuro e claro),
`02-guia-treino`, `03-guia-mais` e `04-primeira-entrada`.

### Como testar no celular

1. **Conta nova**: entre com uma conta que nunca viu o guia. A primeira tela é
   **Como usar o app**, com "Pular por agora" no canto de cima e a barra das
   cinco abas no rodapé.
2. Role: **Primeiros passos** (4 itens com "Ir"), a **miniatura da barra**, e
   uma seção por aba. Toque num chip do índice — a página pula para a seção.
3. Toque em qualquer **"Ir"**: ele abre a tela certa, com âncora quando existe
   (o "Ir" de *Dias de treino* cai direto no card das Preferências).
4. No fim, **"Entendi, começar a treinar"** volta para a aba Treino. Feche e
   abra o app: ele **não** manda mais para o guia.
5. **Mais → Como usar o app** abre o mesmo guia, sem "Pular por agora"; o botão
   do fim é "Entendi" e volta para Mais.
6. **Sem rede** funciona igual: a marca entra na fila e sobe depois.
