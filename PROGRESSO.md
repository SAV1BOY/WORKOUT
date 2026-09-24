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

### Auditoria do marco (16/09/2026)

Auditoria independente com o app rodando no Chromium a 360×740 contra o mock,
nos dois temas. Portões verdes antes e depois. Corrigido aqui:

1. **A aba Treino ficava parada no esqueleto** quando se saía do guia da
   primeira entrada por um "Ir" que volta para `/` (o passo "Começar o primeiro
   treino", a seção Treino, a miniatura da barra): a marca de módulo impedia um
   segundo desvio, mas o esqueleto continuava no lugar da tela — sem nada, para
   sempre, até recarregar. Agora o esqueleto é só da montagem que **de fato**
   desvia (`desviouAqui`); quem volta para `/` sem reconhecer o guia vê a aba
   Treino inteira e o guia reaparece no carregamento seguinte. E2E novo em
   `e2e/guia.spec.ts` prende o caso.
2. **"Desafios" prometia corda**: os três cards são barra fixa, corrida e a
   **fase do programa** (`lib/colecoes.ts: desafios()`). O texto do guia foi
   corrigido e passou a citar o botão real, "Fazer a sessão da semana".
3. **Duas funções da aba Treino faltavam** no guia: "Fazer corda em vez de
   corrida" (card de corrida) e "Começar caminhada leve" (card de descanso, no
   domingo). Entraram na seção Treino e na lista de cobertura do unitário.
4. **SPEC §20.2** dizia que os dois botões invalidam o cache do TanStack Query;
   o código (de propósito) só atualiza o perfil no cache. A §20.2 passou a
   descrever o que o código faz, e a §20.1 diz que o esqueleto é só da montagem
   que desvia.

Conferido e **sem ressalva**: contraste do guia ≥ 5,9:1 nos dois temas; nada
rola de lado e todo alvo tem 44 px; as cinco âncoras das Preferências param no
card certo; abrir por Mais não grava nada e não mostra "Pular por agora"; sem
rede o "Entendi, começar a treinar" volta para a aba Treino e a marca sobe
quando a rede volta; a miniatura da barra sai de `lib/abas.ts`; nenhuma frase do
`docs/` no guia; `lib/progressao.ts` e `lib/montagem.ts` intocados.

---

## Marco Contas (SPEC §21) — 17/09/2026 ✅

O dono pediu, com estas palavras: *"Quero fazer com que novas pessoas possam
cadastrar no app, mas, no total até 5 pessoas até que eu possa decidir se eu
aumento a cota de novos usuários ou não"*. O app deixou de ser de um usuário
só: qualquer pessoa cria conta pela tela de login **enquanto houver vaga**, e
quantas vagas existem é um número que o dono muda de dentro do app, sem deploy.

### O que foi feito

**Banco (`supabase/schema.sql`, tudo idempotente)**

- `public.app_config` — uma linha só (`id boolean primary key check (id)`),
  `max_contas int not null default 5 check (max_contas >= 1)`, `updated_at` com
  o trigger `set_updated_at`. Semeada com 5. RLS ligada e uma policy só:
  `app_config_dono`, `using (public.sou_o_dono()) with check (…)`.
- `public.sou_o_dono()` — compara o e-mail do JWT com `public.allowed_email()`
  e devolve **só um booleano**: o e-mail do dono não sai pelo PostgREST.
- `public.exigir_vaga_para_conta()` + trigger `on_auth_user_vaga`
  **`before insert on auth.users`**: o dono passa sempre; para os outros, se
  `count(auth.users) >= max_contas`, `raise exception 'Cadastro fechado: o
  limite de contas foi atingido.'`. BEFORE de propósito — aborta antes do AFTER
  que cria o perfil, então não sobra nem usuário nem perfil órfão.
- **Saíram** o trigger `on_auth_user_email_permitido` e a função
  `exigir_email_permitido()` (a regra de um usuário só, §9).
- `public.vagas_para_conta()` → `{"contas": N, "limite": L}`, liberada ao
  **anon** (é o que a tela de login pergunta antes de qualquer sessão).
- `public.contas_cadastradas()` → e-mail, criada em, último acesso, com
  `public.sou_o_dono()` **dentro** da consulta: para qualquer outra conta,
  zero linhas.
- `handle_new_user()` grava `nome = split_part(email, '@', 1)`, e
  `profiles.nome` perdeu o default `'Miguel'`.
- **Delta pronto para aplicar**: `supabase/migracoes/2026-09-17-contas.sql` —
  só o que muda em relação ao schema que está no ar, idempotente.
  `lib/migracao-contas.test.ts` confere comando a comando que o delta é um
  pedaço do `schema.sql` (nenhum dos dois pode andar sozinho).

**App**

- `lib/env.ts`: `emailPermitido()` virou **`ehDono()`**; `ALLOWED_EMAIL` deixou
  de ser "quem entra" e passou a ser "quem manda". Sem ele, o aviso de
  configuração continua (sem dono não há quem administre a cota).
- Middleware, `/auth/callback` e o layout autenticado só exigem **sessão**.
  `?erro=app-pessoal` não existe mais.
- **Login**: subtítulo "Entre com o seu e-mail ou crie a sua conta."; a página
  consulta `vagas_para_conta()` no servidor — com vaga, "Entrar" e "Criar
  conta"; sem vaga, só "Entrar" e o aviso (`role="status"`) "Cadastro fechado
  no momento: o limite de contas foi atingido.". `criarConta` exige senha de 8
  caracteres e pergunta a cota de novo antes do `signUp`.
- **Mais → Contas** (`/mais/contas`), só para o dono: card "Contas" com
  "N de L" e a lista (e-mail, criada em dd/MM/aaaa, último acesso dd/MM ou —)
  e card "Limite de contas" com stepper 1–99 e "Salvar" (toast "Limite salvo.").
  A linha em Mais só aparece para o dono, e a rota diz "Só o dono vê esta tela."
  para qualquer outra conta.
- **Guia** (§20): "Criar conta" em *Offline e conta* e "Contas (só o dono)" na
  seção *Mais*, com "Ir".
- **Perfil**: o nome vem do e-mail até a pessoa editar — `garantirPerfil` não
  sobrescreve mais o nome que o trigger gravou.

### Decisões

1. **Sem resposta do banco, a porta fica aberta.** Se `vagas_para_conta()`
   falhar (rede, função ainda não aplicada), o login mostra os dois botões e
   deixa o trigger decidir. Esconder "Criar conta" no escuro esconderia o
   problema — e "Entrar" nunca pode depender da cota.
2. **A cota é uma tabela, não uma variável de ambiente.** Mudar o limite não
   pede deploy nem painel do Supabase: é um stepper e um "Salvar".
3. **`app_config` não entra no backup nem no laço da RLS por `user_id`**: é do
   app, não de quem exporta. `lib/auditoria-seguranca.test.ts` separa as duas
   listas em vez de afrouxar a regra ("toda tabela tem `user_id`").
4. **Baixar o limite não expulsa ninguém**: quem já tem conta continua
   entrando; a cota só fecha a porta de quem ainda não tem.
5. **A tela Contas não vai para a fila** (como `/mais/senha`, §8): sem rede ela
   diz "Precisa de internet para mudar o limite." e não chama nada.
6. **O mock ficou fiel em mais um ponto**: o perfil criado pelo cadastro nasce
   **sem** `prefs.guia_visto`, como no schema — então toda conta nova cai no
   guia da primeira entrada (§20.1) também nos e2e.

### Portões

`npm run lint` · `npm run build` · `npm test` (51 arquivos, 1 283 testes) ·
`npm run build:e2e && npm run e2e` — verdes.
E2E novo: `e2e/contas.spec.ts` (critérios 1–4 e 6 da §21.5), com as leituras
cruzadas de `profiles` e `sessions` no mock e o `POST` direto em
`/auth/v1/signup` recusado. Ajustados sem afrouxar: `e2e/login.spec.ts`,
`e2e/auditoria.spec.ts`, `e2e/mock.spec.ts`, `e2e/guia.spec.ts`,
`lib/env.test.ts`, `lib/supabase/middleware.test.ts`, `lib/erros-auth.test.ts`,
`lib/auditoria-seguranca.test.ts`, `lib/guia.test.ts`.

Um vizinho apareceu no caminho e foi endurecido, não afrouxado: em
`e2e/retomada.spec.ts`, o teste da semana leve lia `progression_events` de uma
vez só, logo depois de o `exercise_state` chegar — e os eventos sobem pela fila
(§8), numa requisição sua. A leitura virou `expect.poll`; o que ele verifica
continua igual.

### O que o dono precisa saber

- **A cota começa em 5, contando a sua conta.** Com 5 contas o botão "Criar
  conta" some da tela de login e aparece o aviso. Para deixar mais gente entrar:
  **Mais → Contas** → suba o número → **Salvar**. Vale na hora, sem deploy.
- **Só você vê Mais → Contas** — é o e-mail de `ALLOWED_EMAIL`. Quem entrar com
  outra conta não vê a linha, e a tela não mostra lista nenhuma.
- **Quem esquecer a senha fala com você.** O app não manda e-mail de
  recuperação: a senha se redefine no painel do Supabase
  (*Authentication → Users*).
- **O nome vem do e-mail.** Quem criar conta com `joana.ferreira@exemplo.com`
  começa chamada de "joana.ferreira" e muda isso em Mais → Perfil.
- **Cada conta é uma ilha**: treinos, cargas, fotos e conquistas são de quem
  registrou. Você não vê os dados dos outros e eles não veem os seus.
- **Para aplicar no projeto real**: rode
  `supabase/migracoes/2026-09-17-contas.sql` no SQL Editor (é idempotente) e
  deixe *Allow new users to sign up* **ligado** — quem barra agora é a cota.

### Como testar no celular

1. **Entre com a sua conta.** Vá em **Mais** e confira a linha **Contas** (ela
   só aparece para você). Abra: "1 de 5" e a sua conta na lista.
2. **Suba o limite**: toque no **+**, depois em **Salvar** — o toast "Limite
   salvo." aparece e o "N de L" muda na hora.
3. **Saia** (Mais → Sair). Na tela de login estão "Entrar" e **"Criar conta"**.
4. **Crie uma conta de teste** com outro e-mail e uma senha de 8 caracteres:
   ela entra na hora e cai no **guia de uso**. Vá em Mais → Perfil: o nome é a
   parte do e-mail. Repare que essa conta **não** tem a linha Contas.
5. **Volte para a sua conta** e abra Mais → Contas: as duas estão na lista, com
   a data de criação e o último acesso.
6. **Feche a porta**: ponha o limite no número de contas que já existem e salve.
   Saia: o login agora mostra só "Entrar" e o aviso *"Cadastro fechado no
   momento: o limite de contas foi atingido."*.
7. Tudo a 360 px, nos dois temas, sem rolar de lado e com alvos de 44 px.

### Auditoria do marco Contas — 17/09/2026

Auditoria independente (portões rodados do zero, SQL lido linha a linha,
navegador a 360 × 740 nos dois temas). O que foi corrigido aqui:

1. **O trigger que cria o perfil tinha sumido do `supabase/schema.sql`.**
   Ao reescrever `handle_new_user()` para o nome vir do e-mail, o
   `create trigger on_auth_user_created after insert on auth.users` saiu junto.
   No banco que já está no ar nada quebra (o trigger de antes continua lá, e o
   delta `supabase/migracoes/2026-09-17-contas.sql` só troca a função), mas num
   **projeto novo** — que roda o `schema.sql` inteiro — nenhuma conta ganharia
   perfil: o nome não viria do e-mail e o `garantirPerfil` semearia o perfil do
   JSON. Nenhum teste pegava, porque o mock simula o trigger em código. O
   trigger voltou e `lib/auditoria-seguranca.test.ts` ganhou um teste que não
   deixa ele sumir de novo.
2. **Inglês na tela de Contas.** `components/mais/tela-contas.tsx` mostrava a
   mensagem crua do erro (`(e as Error).message`) — sem rede isso vira
   "Failed to fetch" na cara de quem usa. Agora passa por `traduzirErroAuth`
   com o recado da tela como padrão, como `/mais/senha` já fazia.
3. **Sobras de "app pessoal".** O rodapé de **Mais** dizia "Treino do Terraço ·
   app pessoal" e a `description` de `app/layout.tsx` dizia "App pessoal de
   treino" — as duas contradizem a §21 e são vistas por qualquer conta.
   Trocadas.
4. **Um e2e piscando (não é do marco).** `e2e/auditoria-offline.spec.ts` falhava
   uma vez a cada tantas com `route.abort: Route is already handled!`: quando o
   navegador desiste da requisição enquanto o `route.fetch()` do harness ainda
   corre, a rota já está tratada. O `abort` agora tolera isso; **nenhuma
   verificação do teste mudou** (continua exigindo uma linha só no servidor e a
   fila zerada). Rodado 5 vezes seguidas antes e depois.

Conferido e **sem problema**: nenhuma policy com `true`; `allowed_email()` sem
grant e sem vazar pelo PostgREST (só o booleano de `sou_o_dono()`);
`vagas_para_conta()` devolvendo só `contas` e `limite`; `contas_cadastradas()`
com o `sou_o_dono()` dentro da consulta (zero linhas para os outros, provado
pelo REST); `on_auth_user_vaga` BEFORE, com o dono sempre passando e a contagem
ignorando `deleted_at`; `app_config` com RLS e a policy exigindo o dono nos dois
lados; o delta idempotente e contido no `schema.sql`; `search_path` fixado e
`security definer` só onde precisa; `alter column nome set default ''` não
tocando no perfil que já existe. No navegador: contraste AA medido em todo o
texto do login (com e sem vaga) e de Contas, nos dois temas; nada rolando de
lado a 360 px; Contas sem rede avisando e **nada** entrando na fila (IndexedDB
vazio, nenhum PATCH no mock). Motor (`lib/progressao.ts`) e montagem
(`lib/montagem.ts`) intocados.

**Fica para depois** (fora do escopo da §21, anotado para não se perder):
`garantirPerfil` ainda semeia altura 190 cm e início 14/09/2026 — os dados do
dono, de `data/perfil.json` — em toda conta nova; e navegar **sem rede** para
uma tela de `/mais` (Contas, Trocar senha, Créditos, todas iguais) dá página em
branco em vez do `/~offline`.

Portões: lint · build · 1284 unitários · 303 e2e, todos verdes.

### Ajuste do orquestrador depois da auditoria (17/09/2026)

- **O seed de `data/perfil.json` passou a ser só do dono** (SPEC §21.3, item
  "menor" da auditoria). `garantirPerfil` recebe `{ dono: ehDono(e-mail) }`
  do layout: para uma conta nova ele só lê, e o perfil fica como o schema criou
  — nome vindo do e-mail, altura vazia (a aba Corpo pede), `data_inicio` e
  `fase_desde` no dia do cadastro, Fase 1, semanas 1. Antes, a altura (190 cm)
  e a data de início do Miguel eram gravadas em toda conta nova, o que dava um
  IMC errado e uma semana do programa contada a partir do começo dele. Provas:
  três casos novos em `lib/queries/perfil.test.ts` (dono recebe o seed; conta
  nova não recebe escrita nenhuma; sem opção continua o comportamento antigo).
- `CLAUDE.md` deixa de abrir com "app pessoal … um usuário só" (§21).
- Ficam anotados, fora do escopo deste marco: navegar **sem rede** direto para
  uma tela de `/mais` dá página em branco em vez do `/~offline` (comportamento
  antigo do service worker com a navegação RSC do App Router); e o caminho das
  capturas fixo no scratchpad da sessão em 7 specs de e2e.

### Vazamento fechado antes do deploy (17/09/2026)

Ao aplicar a migração no projeto real, uma sondagem pela API pública mostrou
que `POST /rest/v1/rpc/allowed_email` com a chave anônima **devolvia o e-mail
do dono** — desde a v2.1. Causa: o Supabase tem `alter default privileges`
dando EXECUTE a `anon`/`authenticated`/`service_role` em toda função nova, e
`revoke … from public` não desfaz esse grant explícito (o advisor 0028/0029 já
tinha levado as funções de trigger a revogar `anon, authenticated` pelo nome;
a constante e as funções novas do marco só revogavam `public`). Correção,
aplicada em produção (migração `revokes_anon_authenticated_funcoes`) e
espelhada no `schema.sql`, no delta e nos testes: `allowed_email()` e
`set_updated_at()` revogadas de `public, anon, authenticated`; `sou_o_dono()` e
`contas_cadastradas()` de `public, anon` (o app logado precisa delas). Medido
depois: as três respondem `401 permission denied` ao anon; só
`vagas_para_conta()` continua pública, com dois números. Um teste novo em
`lib/auditoria-seguranca.test.ts` prende cada revoke pelo nome e garante que a
única função com grant para `anon` é a da cota.

## Ultraloop 20/09/2026 — polimento contínuo (madrugada)

### Relatório para o dono (9h)

Primeira rodada no ar desde as 15:07 UTC de 20/09 (main `b6e8135`), sem
rollback. O que mudou no app que você abre no celular:

- **Sem rede o app não quebra mais.** Abrir Mais → Contas no modo avião agora
  leva a uma tela "Sem conexão" com "Tentar de novo" e "Ir para o Treino", em
  vez da página de erro do navegador.
- **O player ficou inteiro na tela.** Sumiu a faixa cinza embaixo do ✓, os dois
  polegares começam apagados (antes um parecia já escolhido) e, ao terminar o
  treino, se você já se pesou hoje ele mostra o peso em vez de perguntar de
  novo.
- **Quem liga "Reduzir movimento" no celular** agora tem as animações
  desligadas no app inteiro, e a ilustração do exercício fica parada até você
  tocar nela.
- **Relatório, Corpo e Explorar pararam de pular** enquanto carregam, os
  contadores do topo ficaram alinhados e dá para **apagar uma foto de
  progresso** enviada por engano, com confirmação.
- **Detalhes de conteúdo corrigidos**: "sáb" com acento, "Semana N de 12"
  batendo com a barra, o selo Circuito nas coleções, o cardio do dia de
  descanso com a sigla certa e o vídeo do exercício abrindo na ficha, fora do
  treino em andamento.

Portões antes de publicar: lint limpo, build ok, 1.318 testes unitários e 332
de ponta a ponta, mais a varredura das 30 telas nos dois temas. Nada de banco
mudou nesta rodada.

**Segunda rodada no ar desde as 21:35 UTC de 20/09** (main `c7d947a`), também
sem rollback. Esta foi a rodada da aparência e do peso das imagens:

- **Nada mais é pequeno demais para o dedo.** Todo botão do app nasce com
  44 px de altura (muitos tinham 32 px), e o texto miúdo passou a sair de um
  tamanho só, em vez de cinco tamanhos parecidos espalhados pelas telas.
- **Dá para usar o app pelo teclado sem se perder**: cards, listas, abas,
  campos e a barra de baixo desenham o mesmo anel laranja de foco, e a aba
  aberta agora tem um indicador, não só a cor do rótulo.
- **As telas vazias e os carregamentos ficaram iguais entre si** — oito textos
  soltos viraram um componente só, e o esqueleto imita a forma do que vem.
- **As fotos ficaram leves e pararam de empurrar a tela.** As 162 fotos e os
  itens de equipamento agora são WebP com versões menores (miniatura de 112 px
  e capa de 720 px), toda imagem tem altura reservada antes de carregar, e as
  imagens valem uma semana no cache do celular.
- **Instalado no iPhone, o app abre melhor**: ícone e tela de abertura
  próprios, e ao segurar o ícone aparecem os atalhos Treino, Relatório e Corpo.

Portões desta rodada: lint limpo, build ok, 1.355 testes unitários e 358 de
ponta a ponta, mais a varredura das 30 telas nos dois temas. Nada de banco
mudou nesta rodada.

**Terceira rodada no ar desde as 02:05 UTC de 21/09** (main `2826972`),
também sem rollback. Esta foi a rodada do player — a tela onde o treino é
registrado:

- **Não dá mais para descartar o treino sem querer.** Antes, "Abandonar"
  virava "Confirmar abandono" no mesmo ponto da tela: dois toques seguidos no
  mesmo lugar apagavam a sessão. Agora aparece uma pergunta que diz o que já
  está salvo ("Nenhuma série foi registrada ainda", "A 1 série já registrada
  continua salva" ou "As N séries...") e o botão seguro é o que nasce com o
  foco.
- **O treino é gravado assim que você chega na conclusão**, não no "Próximo"
  lá embaixo. O alto da tela diz "Treino salvo. Já está no histórico, mesmo
  que você saia agora", e o "Próximo" ficou fixo no rodapé. Fechar o app ali
  não deixa mais "EM ANDAMENTO" na aba Treino.
- **A Visão geral virou uma janela de verdade**: o Esc e o voltar do celular
  fecham a lista e o treino continua — antes o voltar podia tirar você do
  treino. E as três saídas têm nomes diferentes: "Continuar depois",
  "Descartar este treino" e "Fechar".
- **A pergunta "saiu firme?" chega sem resposta marcada.** Antes "Firme" já
  aparecia escolhido sem ninguém tocar; agora o palpite é só uma frase de
  apoio e o botão grande diz "Pular esta pergunta".
- **O descanso avisa quando acaba** (não só pelo bipe, que é um interruptor):
  os marcos de 30 s, 10 s e fim são anunciados, os botões de tempo dizem
  "−20 s" e "+20 s" em texto, o contador ganhou um anel e o "Pular descanso"
  deixou de ser o botão mais forte da tela.
- **Distância entre gravar e perder**: 24 px entre "Concluir série" e
  "Próximo passo" (eram 8 px, e "Próximo passo" pula sem gravar).

Portões desta rodada: lint limpo, build ok, 1.359 testes unitários e 366 de
ponta a ponta, mais a varredura das 30 telas nos dois temas. Nada de banco
mudou nesta rodada. O lote do Relatório foi reprovado na segunda auditoria e
não entrou: fica para a próxima rodada.

**Quarta rodada no ar desde as 06:41 UTC de 21/09** (main `3c9864a`), também
sem rollback. Esta foi a rodada do **Relatório**:

- **O Relatório abre rápido e não é mais um rolo sem fim.** Virou cinco
  seções que você abre e fecha, com o cabeçalho parado no topo; ele lembra o
  que você deixou aberto. A rolagem da tela caiu de 5.444 px para cerca de
  1.200 px e a tela parou de dançar enquanto carrega.
- **As Conquistas ficaram legíveis**: duas colunas de altura fixa, uma barra
  de progresso e os grupos "Conquistadas" e "A conquistar" — dá para ver de
  relance o que falta.
- **Sumiu o jargão.** Onde estava escrito "e1RM" agora está **"carga máxima
  estimada"**, no app inteiro; o resumo virou duas colunas e a constância diz
  "Constância (4 semanas)".
- **Os números ficaram honestos**: "SESSÕES" com til, os rótulos não quebram
  mais no meio e agora está escrito quando o número é "no total (força +
  cardio)" e quando é "só força".
- **A faixa da semana ganhou legenda** — "✓ feito · ◉ parcial · ○ a fazer ·
  ● faltou" — e o dia de hoje que você ainda não treinou é um **anel**, não
  uma bolinha cheia (bolinha cheia virou sinal de dia perdido).

Portões antes de publicar: lint limpo, build ok, 1.365 testes unitários e 384
de ponta a ponta. Nada de banco mudou nesta rodada. A aba Treino (lote 7) não
entrou: reprovou na auditoria e segue em correção.

**Quinta rodada no ar desde as 08:37 UTC de 21/09** (main `9d2c001`), também
sem rollback. Esta foi a rodada do **Calendário**:

- **"Fase 1 · semana 16 de 12" acabou.** Quem passa da semana 12 sem trocar de
  fase agora lê **"Fase 1 · 12 de 12 concluída"**, com o botão **"Passar para
  a Fase 2"** ao lado.
- **Todo dia do mês virou botão.** Tocar em qualquer dia abre a mesma janela
  do cartão da semana, e as setas ‹ › trocam de mês.
- **Nada mais vaza com o zoom em 200 %**: a faixa dos sete dias rola sozinha
  na horizontal em vez de empurrar a tela para o lado.
- **A semana ficou mais fácil de ler**: barra de três segmentos (feitos · a
  fazer · perdidos), "perdidos" só aparece quando existe algum, o intervalo da
  semana fica entre as setas e o "Hoje" só surge quando você saiu da semana
  atual. Embaixo da grade do mês, uma legenda de uma linha explica os desenhos.
- **Dias antes de você começar o programa não contam como perdidos** — o
  calendário parou de acusar falta em dia nenhum anterior à sua data de início.

Portões antes de publicar: lint limpo, build ok, 1.371 testes unitários e 391
de ponta a ponta, mais a varredura das telas nos dois temas. Nada de banco
mudou nesta rodada. A aba Treino (lote 7) e o Explorar (lote 9) seguem em
auditoria e entram numa segunda parte, se aprovados.

**Sexta rodada no ar desde as 10:01 UTC de 21/09** (main `8830fe5`), também
sem rollback — **este foi o último deploy da madrugada**. Esta foi a rodada do
**Explorar e do catálogo**:

- **O Explorar parou de despejar os 81 exercícios.** A página tinha doze telas
  de celular de altura (8.915 px); agora tem três (3.084 px): uma prévia de 12
  exercícios e o botão "Ver os 81 exercícios", que leva ao catálogo.
- **O catálogo abre 20 de cada vez**, com "Ver mais 20 de 81" — de 7.197 px
  para 2.187 px. Chegando pela busca, os filtros já vêm recolhidos.
- **A busca mostra os exercícios primeiro.** A linha "Exercícios (N) ·
  Coleções (N)" só aparece quando existem os dois blocos, e o número do título
  é sempre o mesmo da lista embaixo, com filtro ou sem.
- **Quem busca e não acha lê uma mensagem só**, citando o termo — antes vinham
  duas, uma para cada bloco.
- **Link velho não cai mais em tela inglesa.** Um atalho guardado no início,
  ou um exercício que mudou de nome, agora abre "Essa tela não existe mais."
  em português, com as saídas Hoje, Explorar e Exercícios.
- **As capas das coleções não se repetem mais** dentro da mesma seção, e os
  títulos ganharam régua ("Escolhas para você" virou um rótulo pequeno).

Portões antes de publicar: lint limpo, build ok, 1.378 testes unitários e 403
de ponta a ponta, mais a varredura das telas nos dois temas. Nada de banco
mudou nesta rodada. Fumaça em produção verde 21 de 21, duas vezes seguidas.

**Sétima rodada no ar desde as 12:11 UTC de 21/09** (main `d696b33`), também
sem rollback, e é a última: o loop acabou aqui. Ela levou um lote só, o que
tinha ficado faltando — a **aba Treino**:

- **O "Ajustar" saiu do botão flutuante** e foi para o cabeçalho, ao lado da
  data; a folha que ele abre grava sozinha, sem botão de salvar.
- **Com um treino começado, uma faixa fixa no alto** diz "Continuar — Treino A,
  3/12 séries" e é um botão inteiro: dá para tocar em qualquer parte dela, e o
  toque não atravessa mais para o cartão de trás (1.395 pontos varridos, 0 fora).
- **A lista ficou mais fácil de ler**: nome do exercício antes da carga, e o
  primeiro item não fica escondido embaixo da faixa quando você rola.
- **Os desafios viraram um carrossel com posição** ("2 de 5"), os chips ganharam
  degradê, o botão diz qual treino é ("Começar o Treino B") e, ao voltar do
  player com séries por gravar, o app avisa.

Portões antes de publicar: lint limpo, `tsc` limpo, build ok, 1.378 testes
unitários e 417 de ponta a ponta, mais a varredura do toque. Nada de banco
mudou nesta rodada. Fumaça em produção verde 20 de 20, duas vezes seguidas.

**Lote 7 no ar (rodada 7).** A **aba Treino** entrou em produção às 12:11 UTC
de 21/09. O que mudou: o **Ajustar** saiu do botão flutuante e foi para o
cabeçalho, **ao lado da data**; quando há treino começado, uma **faixa fixa no
alto** diz "Continuar — Treino A, 3/12 séries" e é **um botão inteiro** — dá
para tocar em qualquer parte dela, e o toque **não atravessa** para o cartão
que está atrás; na lista, o **nome do exercício vem antes da carga**; os
desafios viraram um **carrossel que mostra a posição** ("2 de 5"); quando não
há sessão em andamento, o botão diz **"Começar o Treino B"**, com o nome do
treino; e, ao **voltar do player** com séries por gravar, o app avisa. Como ver
no celular: abra o app, comece um treino, **feche e abra de novo** — a faixa
"Continuar" tem de estar no alto, e tocar em qualquer ponto dela leva ao
player; depois **role a lista da aba Treino com a sessão iniciada** — o
primeiro exercício não fica escondido embaixo da faixa.

**Rodada 8 no ar (21/09, 17:35 UTC — 14:35 em Brasília).** É a correção do
que você fotografou: no Brave, com WiFi ligado, o app abria numa tela preta
escrita "Sem conexão", **sem ícone e sem botão nenhum** — nem dava para tentar
de novo. Aquela não era a tela de "sem conexão" do app: era um texto de
emergência que vive dentro do próprio app, o último recurso quando tudo mais
sumiu do aparelho. **Por que ela aparecia:** quando você toca em **Sair**, o
app limpava tudo o que estava guardado no celular — e junto ia o próprio app
guardado para funcionar sem rede. Entre um "Sair" e a atualização seguinte, se
a rede oscilasse um segundo, você caía nesse beco. **O que mudou:** o "Sair"
continua apagando tudo que é seu (seus treinos, suas telas), mas **não apaga
mais o app guardado** — então a tela "Sem conexão" de verdade, com ícone e com
os botões **"Tentar de novo"** e **"Ir para o Treino"**, está sempre lá. Além
disso o app agora **guarda uma cópia sua dessa tela** e a repõe sozinho se ela
sumir, e **desiste mais rápido de uma rede ruim** (8 segundos) em vez de deixar
você olhando para o nada. **Se o seu celular ainda estiver preso na tela
antiga**, é o app velho ainda instalado: no Brave/Chrome faça ⋮ → Configurações
→ Configurações do site → `treino-terraco.vercel.app` → **Limpar e redefinir**,
e abra o app de novo — ele volta já com a correção. **O login foi conferido em
produção** depois deste deploy: a tela `/login` carrega sem erro nenhum, e o
"Entrar" chega ao banco e responde ("E-mail ou senha incorretos." quando a
senha está errada) — se o seu login não estava pegando, era esse app velho
preso no aparelho.

**Rodada 9 no ar (21/09, 21:48 UTC — 18:48 em Brasília).** Cinco acertos em
cima da rodada 8, achados olhando o app publicado num navegador de verdade:

- **Aparelho sem cache não trava mais em "Application error".** Se o celular
  apagar sozinho o que o app guardou (o navegador faz isso quando a memória
  aperta), ele agora se recompõe na primeira vez que abre com rede, em vez de
  mostrar a tela de erro branca.
- **O campo de carga parou de grudar os números.** Digitar 11,5 não vira mais
  "11,5,5".
- **A tela que ainda está carregando não diz mais "Não achei".** Antes, voltar
  para a aba ou reconectar fazia a sessão piscar entre "carregando" e "não
  existe"; agora ela só responde quando de fato terminou de buscar.
- **"Sair" só sai deste aparelho.** Sair no computador não derruba mais a sua
  sessão no celular.
- **O botão do player voltou a dizer "Concluir"** (estava "Concluído", como se
  já tivesse acontecido).

Nada de banco mudou e nenhuma tela mudou de aparência. Produção serve
`040908a`, igual à `main`, com fumaça verde 22 de 22 em duas execuções e
**sem rollback**.

**Rodada 11 no ar (23/09, 01:20 UTC — 22:20 de 22/09 em Brasília).** É o
lote 12: Explorar e o catálogo de exercícios ficaram mais fáceis de ler e de
filtrar.

- **Os filtros do catálogo foram para uma folha.** Na aba de exercícios, o
  botão "Filtros" abre uma folha com grupo, implemento, equipamento e "No meu
  programa". O botão de baixo diz quantos sobram ("Ver 12 exercícios") e leva
  direto ao primeiro. Com a folha fechada, o primeiro exercício já aparece na
  primeira tela.
- **A busca do Explorar explica o que achou.** Cada coleção diz "contém …"
  com os nomes na ordem em que você digitou, sem nome sobrando e sem cortar a
  frase no meio.
- **Os planos mostram o prazo mesmo antes de o perfil carregar.** "Primeira
  barra fixa" e "5 km sem parar" mostram o objetivo inteiro ("… em 8–12
  semanas"), e quando o perfil chega aparece "semana N de 12".
- **Por aparelho**, cada linha usa o nome curto do item ("Tatame EVA", "Super
  Band"), e "com ele" nunca fica sozinho na linha de baixo.

Como ver no celular: abra Explorar, digite "sentado panturrilha barra
declinado" na busca e veja o Cavalete citar os três exercícios inteiros; em
Exercícios, toque em "Filtros", escolha Peito e "No meu programa" e toque em
"Ver N exercícios" (N é quantos sobraram). Nada de banco mudou. Produção serve `1b37092`, igual à
`main`, com fumaça verde (18 de 18) e **sem rollback**.

**Rodada 13 no ar (23/09, 07:25 UTC — 04:25 em Brasília).** É o lote 13: a
ficha do exercício mostra a figura e as fotos do jeito certo, e as coleções
do Explorar ficaram arrumadas.

- **A figura do exercício aparece inteira e grande.** A caixa tem o formato
  do desenho: o agachamento goblet, que era um boneco espremido, ocupa a
  altura toda; a prancha ocupa a largura toda.
- **As fotos aparecem inteiras**, na proporção da foto, com "Início" e "Fim"
  embaixo. As fotos em pé (búlgaro, barras fixas) não são mais cortadas.
- **Tocar na figura do player abre o "Como fazer"**; para parar a animação,
  use o botãozinho redondo no canto. Ao passar para o próximo exercício com
  a ficha aberta, a figura recomeça do início.
- **Planos com as semanas.** Em Explorar → Planos, "5 km sem parar" e "Corda:
  5 estágios" mostram a lista das semanas (feitas, a atual e as próximas) e a
  barra do quanto já foi. As linhas do Explorar têm a mesma altura em cada
  seção.

Como ver no celular: abra Explorar → Exercícios → "goblet" e veja a figura
alta e centrada, com o botão de pausa no canto; role até as fotos do supino
reto, inteiras com "Início" e "Fim"; depois Explorar → Planos → "5 km sem
parar" e veja as 12 semanas. Nada de banco mudou. Produção serve `a0bcfcf`,
igual à `main`, com fumaça verde (18 de 18) e **sem rollback**.

**Rodada 16 no ar (23/09, 16:50 UTC — 13:50 em Brasília).** É o lote 14: a
ficha do exercício ficou mais limpa e ganhou ações, e as janelas que abrem
por cima da tela passaram a funcionar direito com teclado e leitor de tela.

- **A ficha tem "Voltar" e "Fazer agora".** Aberta pelo Explorar, a ficha
  do exercício tem "Voltar" no topo e, no fim, "Fazer agora", que abre um
  treino só com aquele exercício. As séries ficam guardadas no celular na
  hora, como no treino do dia.
- **Nada repetido na ficha.** A aba Músculos mostra só o mapa. Os aparelhos
  viram links para a coleção deles, os treinos aparecem em "Aparece em:", e
  a aba do vídeo se chama "Tutorial no YouTube". Exercício que você nunca
  fez mostra um cartão só, "Ainda sem histórico deste exercício", em vez de
  quatro vazios.
- **Nomes iguais no catálogo e créditos em português de gente.** Os filtros
  usam um nome só por aparelho ("Cross over", "Super Band"). Mais → Créditos
  não fala mais de "variáveis CSS".
- **Janelas por cima da tela.** Nas folhas, nos alertas, na foto ampliada e
  no "Apagar esta foto?", o que está atrás fica travado enquanto a janela
  está aberta, e ao fechar você volta ao botão que a abriu. O "Apagar esta
  foto?" já abre no "Cancelar".

Como ver no celular: abra Explorar → Exercícios → "supino reto". Veja o
"Voltar" no topo, a aba Músculos só com o mapa, os aparelhos como links e,
no fim, "Fazer agora". Toque nele: o treino abre só com o supino. Em Corpo →
Fotos, abra uma foto e toque em "Apagar": o cartão abre no "Cancelar", e
tocar fora fecha só o cartão. Nada de banco mudou. Produção serve `0f730c9`,
igual à `main`, com fumaça verde (18 de 18) e **sem rollback**.

**Rodada 18 no ar (23/09, 23:34 UTC — 20:34 em Brasília).** É o lote 34, a
primeira parte dos lembretes no celular: cada aparelho pode se inscrever
para receber avisos do app, e dá para mandar um lembrete de teste.

- **Mais → Lembretes.** Uma linha nova em Mais abre a tela dos lembretes. Nela
  você ativa ou desativa os lembretes neste aparelho, vê os aparelhos da sua
  conta (com "Remover") e toca em "Enviar um lembrete de teste".
- **Instruções quando o navegador trava.** Se o navegador recusar (Brave com
  o push desligado, permissão negada, iPhone fora da tela inicial), a tela
  diz o que fazer naquele aparelho. Ao voltar das configurações, a tela relê
  a permissão sozinha.
- **Tocar na notificação abre o app** na tela certa, e só dentro do app.
- **Banco:** uma tabela nova só com as inscrições dos aparelhos. Cada pessoa
  só vê e apaga as suas. Foi aplicada antes do deploy.

Como ver no celular: abra Mais → Lembretes. Toque em "Ativar lembretes neste
aparelho" e depois em Permitir. Em seguida toque em "Enviar um lembrete de
teste": a notificação chega e, ao tocar nela, o app abre. Se a tela disser
"Lembretes ainda não configurados neste servidor.", faltam as três variáveis
VAPID na Vercel (produção). Elas estão descritas na subseção do lote 34. Os
lembretes no horário escolhido chegam no lote 35. Produção serve `905815d`,
igual à `main`, com fumaça verde (21 de 21, três vezes) e **sem rollback**.

**Encerramento (10:25 UTC de 21/09, 07:25 em Brasília).** A pedido do dono, o loop parou com tudo o que estava 100 % aprovado já publicado: produção serve `8830fe5`, igual à `main`, com oito lotes no ar (L1–L6, L8 e L9) em seis deploys, todos com fumaça verde na primeira execução e nenhum rollback. Nenhuma migração de banco foi aplicada nesta madrugada. Desde o ponto de partida (`c82b744`) foram 71 commits e 181 arquivos alterados (+14.006/−1.169 linhas); os portões do head publicado são 1.378 testes unitários, 403 de ponta a ponta e a varredura das 30 telas nos dois temas. A auditoria de fechamento (regressão total contra a base inicial) foi interrompida antes de terminar; cada lote publicado já havia sido comparado contra a base do deploy anterior na própria auditoria. O que não coube está na seção **Fila (o que não coube)** abaixo, em ordem de prioridade, pronto para as próximas rodadas. Atualização (rodada 7, 12:11 UTC): o lote 7 entrou em produção em `d696b33`, nove lotes no ar, sete deploys, nenhum rollback; o loop está encerrado e nada ficou agendado.

### Como funcionou

Duas faixas de trabalho em paralelo, cada uma numa worktree própria com porta
de app e porta de mock só dela: a faixa A em `/home/user/wt-a` (3100/54321) e a
faixa B em `/home/user/wt-b` (3110/54331). Cada lote nasce de um branch
`ultraloop/lN-<nome>` e passa por três papéis — construtor, auditor, corretor —
antes de voltar para a faixa. Uma terceira worktree, `/home/user/wt-base`, fica
parada no commit do preparo servindo o app "antes": é contra ela que as
capturas novas são comparadas e é nela que os testes críticos rodam sem o
código do lote no caminho.

Os portões são sempre os mesmos e sempre pelo mesmo script
(`portoes.sh`): lint, `tsc --noEmit`, `vitest`, build, build de e2e, a bateria
de ponta a ponta e a varredura de 360 px / 44 px / contraste / foco /
reduced-motion. Os pesados correm sob um `flock` único, porque a máquina tem 4
CPUs e dois builds ao mesmo tempo só fazem os dois falharem por tempo.

Cada rodada aprovada vira um deploy: build de produção, publicação e um teste
de fumaça na URL. Fumaça vermelha = rollback imediato para o deploy anterior.
Nada entra em produção sem capturas comparadas contra a base e sem a lista de
telas que era esperado mudar.

### Rodada 1 — Lote 1 — player, offline e rótulos (faixa A) ✅

Branch `ultraloop/l1-player-offline`, oito itens. O que mudou, item a item:

**L1-1 · sem rede, `/mais/*` caía na página de erro do navegador.**
Era: o fallback do service worker (`app/sw.ts`) só cobria
`request.destination === "document"`; a navegação do App Router tem duas formas
— o documento e o `fetch` de RSC (`RSC: 1`, `?_rsc=…`) — e a segunda morria
antes de virar navegação. `/mais/contas`, `/mais/senha` e `/mais/creditos`
abriam em branco. É: uma regra própria, **antes** do `defaultCache`, atende
toda navegação de mesma origem (rede primeiro, cache depois) e, sem nem um nem
outro, devolve a `/~offline`; no caminho do RSC devolve um 503 sem corpo, que
faz o roteador desistir da navegação suave e recarregar a URL — a recarga é um
documento e cai na página de offline, com o endereço que o usuário pediu
intacto. Se o precache da `/~offline` tiver falhado, um HTML mínimo embutido
garante que a navegação nunca morra num erro do navegador.
Arquivos: `app/sw.ts`, `e2e/auditoria-offline.spec.ts`.

**L1-2 · a `/~offline` era um parágrafo solto.**
Era: título e uma frase, sem saída. É: ícone de rede cortada (lucide
`WifiOff`), "Sem conexão", a frase curta, **Tentar de novo** (recarrega) e **Ir
para o Treino** — alvos de 48 px, `max-w-lg`, área segura e os dois temas.
Arquivo: `app/~offline/page.tsx`.

**L1-3 · o player reservava 56 px para uma barra que não existe.**
Era: os controles (anterior · ✓ · próximo) e o rodapé da visão geral paravam em
`bottom-14`, o espaço da barra de abas — que o player devolve como `null`. Uma
faixa morta bem onde fica o polegar. É: `bottom-0` + `.pb-segura`
(`env(safe-area-inset-bottom)`) nos dois, a seção rolável com `pb-24` em vez de
`pb-40`, e o descanso e o FAB "Ajustar" somando a área segura ao respiro que já
tinham. Arquivos: `components/player/exercicio.tsx`,
`components/player/tela-player.tsx`, `components/player/descanso.tsx`,
`components/treino/fab-ajustar.tsx`, `components/treinar/visao-geral.tsx`.

**L1-4 · `prefers-reduced-motion` não era respeitado.**
Era: os esqueletos `animate-pulse` giravam para sempre mesmo com a preferência
ligada, e a ilustração de duas posições alternava sozinha. É: um bloco global no
fim de `app/globals.css` corta duração e repetição de toda animação CSS sob
`reduce`, e a `IlustracaoAlternada` nasce **parada** sob `reduce` ou com a aba
escondida (`visibilitychange`) — o botão continua mandando: quem tocar volta a
ver o movimento. Contagens e anel de progresso são JavaScript e não mudaram.
O `test.fixme` da varredura saiu. Arquivos: `app/globals.css`,
`components/exercicio/ilustracao-alternada.tsx`, `lib/preferencias.ts`
(`ilustracaoAlternando`, função pura com teste), `e2e/ultraloop-varredura.spec.ts`.

**L1-5 · o polegar para cima vinha "pressionado".**
Era: `aria-pressed={!evitado}` — o app afirmava, por escrito, um "gostei" que o
usuário nunca deu. É: três estados — nenhum (padrão, os dois polegares
neutros e **sem** `aria-pressed`), preferido (`prefs.preferidos`, novo no
jsonb) e evitado (`prefs.evitar_exercicios`, como antes). Tocar no polegar
aceso desfaz o voto; gostar de um exercício deixa de evitá-lo e vice-versa.
Arquivos: `components/player/exercicio.tsx`, `components/player/tela-player.tsx`,
`lib/preferencias.ts` (+ teste), `e2e/player.spec.ts`.

**L1-6 · a conclusão pedia de novo o peso já registrado.**
Era: `useState(false)` fixo — fechar e reabrir a tela trazia de volta o convite
"Registrar o peso de hoje", mesmo com a pesagem do dia no banco ou com o peso
digitado dois passos atrás. É: o campo nasce aberto quando há peso digitado
nesta sessão e, havendo a pesagem de hoje (`body_weights` com a data de hoje),
a tela mostra **"Peso de hoje: 82,4 kg"** com um "Corrigir" ao lado.
Arquivos: `components/player/conclusao.tsx`, `components/player/tela-player.tsx`,
`e2e/player.spec.ts`.

**L1-7 · "sab" sem acento na faixa da semana.**
Era: `format("EEEEEE", ptBR)` devolvia "sab" na faixa, ao lado de um calendário
que escreve "SÁB". É: um mapa de sete rótulos em `lib/formato.ts`, com teste que
prende a igualdade com o `diaCurto` do calendário em toda a semana.
Arquivos: `lib/formato.ts`, `lib/formato.test.ts`.

**L1-8 · não dava para saber qual build estava no ar.**
Era: a fumaça do deploy só conseguia dizer "abriu". É: `GET /versao` devolve
`{commit, construidoEm}` (rota pública, `Cache-Control: no-store`), com o commit
vindo de `VERCEL_GIT_COMMIT_SHA` ou do `git rev-parse` do build; o rodapé de
Mais → Créditos mostra "Versão abc1234". Arquivos: `app/versao/route.ts`,
`next.config.ts`, `lib/supabase/middleware.ts`,
`app/(app)/mais/creditos/page.tsx`, `e2e/shell.spec.ts`.

**Provas.** Portões completos pelo `portoes.sh` (lint · tsc · vitest · build de
produção · build de e2e · e2e · varredura). Unitários novos em
`lib/preferencias.test.ts` (polegar de três estados e a regra da ilustração) e
`lib/formato.test.ts` (os sete rótulos). E2E novos ou ajustados em
`e2e/ultraloop-a-r1.spec.ts` (controles colados no rodapé nos dois temas, a
`/~offline` com saída, `reduced-motion`), `e2e/auditoria-offline.spec.ts`
(`/mais/*` sem rede), `e2e/player.spec.ts` (polegar e peso do dia) e
`e2e/shell.spec.ts` (`/versao`). Capturas dos dois temas em
`rodada-1/l1/capturas/construtor/`.

**Capturas.** As trinta telas do gerador, nos dois temas, ficam em
`scratchpad/ultraloop/rodada-2/l3/capturas/construtor/` e foram comparadas com
a linha de base por `scripts/comparar-capturas.ts` (`diff/comparacao.md`).
Todas mudam de aparência — a paleta é a fundação do app —, e é isso que a lista
de esperadas do comparador declara.

**Como testar no celular.** Entre no treino do dia e vá até o primeiro
exercício: o ✓ agora encosta no rodapé, sem faixa cinza embaixo, e os dois
polegares no topo começam apagados — toque no de baixo e ele acende sozinho,
toque de novo e apaga. Termine o treino: se você já se pesou hoje, a conclusão
mostra o peso em vez de pedir de novo. Ligue "Reduzir movimento" nos ajustes do
celular e abra uma ficha de exercício: a ilustração fica parada até você tocar
nela. Por fim, ative o modo avião e abra Mais → Contas: em vez da tela de erro
do navegador aparece "Sem conexão", com "Tentar de novo" e "Ir para o Treino".

**Deploy.** No ar em 20/09/2026 às 15:07 UTC, junto com o lote 2, pelo PR #6
(main `b6e8135`). Produção saiu de `dpl_3GkqME59j2QWFvtJqfbPSzADzzTE` para
`dpl_4xNZ9sdTBX6PbdRjD8qrm12YSC57`; `GET /versao` passou a devolver
`{"commit":"b6e8135c28ac5fe1ba375b1b180427846398b9bb","construidoEm":"2026-09-20T15:05:54.343Z"}`
(antes a rota não existia e caía em 307) e o css de `/login` trocou de
`053059c178efbf99` para `12175adeeb38d042`. Fumaça verde na primeira tentativa,
item a item: `/login` 200 com "Treino do Terraço" e "Entrar" e sem aviso de
configuração — ok; `/` → 307 para `/login` — ok; `/versao` igual ao sha de main
— ok; `/sw.js` 200 com `/~offline`, `figuras/`, `_rsc` e o mesmo css do HTML de
`/login` — ok; `/manifest.webmanifest` 200 com "Treino do Terraço" — ok;
`/~offline` 200 com "Sem conexão", "Tentar de novo" e "Ir para o Treino" — ok;
os 12 scripts `/_next/static` de `/login` em 200 — ok. **Rollback: não.**

### Rodada 1 — Lote 2

**Relatório, Corpo, Calendário e Explorar** (branch
`ultraloop/l2-relatorio-corpo-calendario`, SPEC §22.2). Onze itens, cada um com
prova. O que mudou, era → é:

1. **Contadores (L2-1)** — era: em `/relatorio` o rótulo "VOLUME (KG)" não
   cabia numa das três colunas a 360 px, quebrava em duas linhas e o número
   descia meia linha em relação aos vizinhos ("BARRA FIXA", nos Números, fazia
   o mesmo). É: `components/ui/contador.tsx` desenha o rótulo numa linha de
   altura fixa que não quebra, e o total do volume virou "Volume" com a unidade
   no detalhe ("kg no total") em `components/relatorio/tela-relatorio.tsx`.
2. **Explorar (L2-2)** — era: `/explorar` montava sem o destaque e a tela
   pulava quando o perfil chegava. É: o lugar do `CardCapa` fica reservado por
   um esqueleto da mesma forma até perfil e overrides chegarem
   (`components/explorar/tela-explorar.tsx`).
3. **Apagar foto (L2-3)** — era: não havia como apagar uma foto de progresso,
   embora a policy `progresso_dono_delete` já existisse. É: um toque na foto da
   galeria abre a foto em tela cheia com **Apagar** e confirmação ("Apagar esta
   foto? Não dá para desfazer."); apagar tira o arquivo do bucket `progresso`,
   a linha de `progress_photos`, o blob do Dexie e o que ainda estivesse na
   fila de saída. Exige internet, como trocar a senha (`components/corpo/aba-fotos.tsx`,
   `components/exercicios/foto-ampliada.tsx`, `lib/queries/corpo.ts`).
4. **Esqueleto por aba (L2-4)** — era: só o esqueleto do topo cobria as
   pesagens; Medidas e Fotos apareciam vazias enquanto carregavam. É: cada aba
   espera a sua leitura com o esqueleto da própria forma
   (`components/corpo/tela-corpo.tsx`).
5. **Cardio no descanso (L2-5)** — era: um cardio feito num dia de descanso
   ganhava ✓ mas a faixa continuava dizendo "Desc.". É: `semanaCoerente()`
   passa a receber os cardios registrados e o dia vira o cardio que foi feito —
   "Corr."/"Corda"/"Cam." e "Corrida" no calendário (`lib/calendario.ts`,
   `lib/semana.ts`). "outro" não tem sessão no plano e não mexe no dia.
6. **Ilustração aproximada (L2-6)** — era: sete exercícios têm ilustração só
   aproximada e a nota que explica a diferença ficava só no JSON. É: a legenda
   ganha uma segunda linha com a nota (`notaDaIlustracao()` em `lib/midia.ts`,
   `components/exercicio/media-grande.tsx`); as sete notas de
   `data/ilustracoes.json` foram acentuadas (eram "colecao", "nao ha").
7. **Vídeo fora do player (L2-7)** — era: só o player passava `temVideo`, então
   a mesma ficha aberta pela lista do dia ou pela lista de uma coleção mostrava
   a ilustração mesmo havendo vídeo. É: o layout do app lê `public/videos` uma
   vez e a lista desce por contexto (`components/videos-do-app.tsx`,
   `app/(app)/layout.tsx`, `components/treino/lista.tsx`,
   `components/colecoes/lista-da-colecao.tsx`).
8. **Desafio (L2-8)** — era: "Semana 3 de 12" com a barra em 17 % — duas
   leituras brigando. É: "Semana 3 de 12 · 2 concluídas", barra e
   `aria-valuenow` nas semanas concluídas (`lib/colecoes.ts`,
   `components/treino/desafios.tsx`).
9. **Selo Circuito (L2-9)** — era: `Colecao.circuito` era calculado e só os
   testes liam. É: as 5 coleções que dão para rodar em circuito mostram um selo
   discreto na vitrine (`components/colecoes/linha-colecao.tsx`).
10. **Contraste da capa (L2-11)** — era: no tema claro o "Treino A" branco
    sobre o cartão claro media 1,13:1. É: o bloco de texto do `CardCapa` tem véu
    escuro próprio e passa de 4,5:1 nos dois temas
    (`components/ui/card-capa.tsx`); o `test.fixme` de contraste saiu da
    varredura.
11. **Régua de rolagem (L2-12)** — era: a régua de 360 px contava os 96 cartões
    dentro dos carrosséis de `/` e `/explorar` como vazamento. É: ela sobe até o
    ancestral que rola e ignora o que está dentro de rolagem intencional,
    continuando a exigir `scrollWidth == clientWidth` da página
    (`e2e/auditoria-helpers.ts`); o `test.fixme` de rolagem saiu da varredura.

**Provas.** Unitários novos/atualizados em `lib/semana.test.ts` (cardio no
descanso vira o dia; "outro" não; cardio futuro não reescreve),
`lib/calendario.test.ts` (`semanaCoerente` com cardio), `lib/midia.test.ts`
(nota só na correspondência aproximada) e `lib/colecoes.test.ts` (barra e
rótulo leem a mesma coisa). E2E: `e2e/ultraloop-b-r1.spec.ts` (contadores nos
dois temas, contraste da capa nos dois temas, selo de circuito, esqueleto do
destaque, desafio, nota da ilustração, apagar foto com e sem rede, esqueleto de
Medidas, vídeo na ficha aberta pela lista do dia e pela lista de uma coleção,
contraste dos botões da confirmação de apagar nos dois temas) e um caso novo em
`e2e/semana.spec.ts`. A varredura roda sem os dois `test.fixme` que eram deste
lote.

**Como testar no celular.** (1) Relatório: os três totais no topo, rótulo numa
linha e números alinhados — confira nos dois temas. (2) Corpo → Fotos: mande
uma foto, toque nela, **Apagar**, confirme; ela some da galeria e do comparador.
No modo avião o app avisa "Precisa de internet para apagar." e não apaga nada.
(3) Corpo → Medidas: entrando com a rede lenta, a aba mostra a forma dos campos
em vez de aparecer vazia. (4) Faça um cardio num dia de descanso: a faixa da
semana passa a mostrar "Corr." naquele dia, e o calendário diz "Corrida".
(5) Explorar: as coleções de circuito mostram o selo, e o destaque não pula
mais quando a tela abre. (6) Abra a ficha do face pull: sob a ilustração há a
nota dizendo que a figura é aproximada.

**Correções da auditoria (rodada 1).** Um auditor independente reprovou o lote
e os três problemas foram corrigidos:

1. **O selo cortado e a tarja por cima da foto de capa** (bloqueante). O véu do
   item 10 era pintado depois do selo e sem camada, então o "hoje"/"em
   andamento" aparecia cortado ao meio por uma linha reta, com a metade de
   baixo 32 % mais escura; e o véu (0,68 de preto) somava com a vinheta
   `--capa-*` (0,93 no claro, 0,96 no escuro, no pé), deixando a faixa do texto
   em ~0,98 de preto — a foto de capa sumia atrás de uma tarja com borda reta.
   Agora o selo tem `z-10`; o véu ganhou uma máscara de 28 px que apaga a borda
   (`.veu-capa` em `app/globals.css`, com o `background-color` intacto em
   `rgb(10 10 10 / 0.68)`, que é o que as réguas de contraste leem); e a
   vinheta desceu para 0,40 (claro) e 0,50 (escuro) no pé, de modo que a foto
   volta a aparecer sob o texto sem perder o AA.
2. **O botão que apaga a foto no tema escuro** (importante). `bg-destructive`
   com rótulo branco dava 2,77:1 no escuro, porque lá o `--destructive` é claro
   (`#f87171`) — e é o botão que apaga uma foto de progresso para sempre. O
   rótulo virou `text-background`: 6,5:1 no claro e 7,2:1 no escuro
   (`components/exercicios/foto-ampliada.tsx`).
3. **O item 7 sem teste** (importante). O vídeo na ficha aberta fora do player
   funcionava, mas nenhum teste o exercitava, embora o caminho passe pelo
   layout do shell autenticado. `e2e/ultraloop-b-r1.spec.ts` ganhou dois casos
   que escrevem um mp4 temporário em `public/videos` e abrem a ficha pela lista
   do dia em `/` (supino reto, o Treino A da quarta) e pela lista de
   `/explorar/treino/B1` (levantamento terra), exigindo o
   `video[data-video="<id>"]` com o arquivo e a ilustração sem ele — mais a
   asserção de contraste do item 2, nos dois temas.

**Deploy.** No ar em 20/09/2026 às 15:07 UTC, no mesmo merge do lote 1 (a faixa
B já continha a A), pelo PR #6 (main `b6e8135`). Produção saiu de
`dpl_3GkqME59j2QWFvtJqfbPSzADzzTE` para `dpl_4xNZ9sdTBX6PbdRjD8qrm12YSC57`;
`/versao` devolve `b6e8135c28ac5fe1ba375b1b180427846398b9bb`. Além dos sete
itens obrigatórios da fumaça (todos ok, descritos na subseção do lote 1), os
marcadores deste lote nos pacotes publicados: o chunk de `app/(app)/corpo`
contém "Apagar" — ok; o de `app/(app)/relatorio` contém "kg no total" (o
contador de volume reescrito) — ok; o de `app/(app)/explorar` contém "Circuito"
(o selo das coleções) — ok. O marcador previsto para
`app/(app)/mais/creditos` ("Vers") não se aplica: a página é server component,
então o texto não vai para o chunk do cliente — a prova equivalente é `/versao`
devolvendo o mesmo `NEXT_PUBLIC_COMMIT` que alimenta o "Versão b6e8135" da
tela. A sonda opcional de Playwright a 360 px contra a URL pública não rodou (o
Chromium local não confia na CA do proxy de saída); a régua de 360 px, 44 px,
contraste e foco já correra verde nas 30 telas no portão local.
**Rollback: não.**

### Rodada 2 — Lote 3 — fundação visual (faixa A) ✅

Branch `ultraloop/l3-fundacao-visual`, doze itens. Este lote mexe na base — a
escala dos controles, as cores das superfícies, o foco e o texto pequeno —,
então quase toda tela muda de aparência, ainda que nenhuma mude de lugar.

**L3-1 · o botão padrão tinha 32 px de altura.**
Era: `components/ui/button.tsx` vinha do shadcn com `default: h-8` (32 px),
`sm: h-7` (28 px) e `icon: size-8` — todos abaixo dos 44 px que a SPEC §3
exige —, e o app corrigia isso **à mão**, em 141 chamadas com `h-11`, `h-12`,
`h-14` e `alvo`. Quem esquecesse a classe entregava um alvo pequeno. É: a
escala é do projeto — `sm` 40 px, `default` **44 px**, `lg` 48 px, `xl` 56 px,
`icon` 44 px, `icon-sm` 40 px —, o `Input` nasce com 44 px e os tamanhos
`xs`/`icon-xs` (24 px) deixaram de existir. As 37 classes `h-11`/`size-11`
redundantes saíram das chamadas; as escolhidas de propósito (`h-12`, `h-14`)
ficaram. Arquivos: `components/ui/button.tsx`, `components/ui/input.tsx` e 24
arquivos de chamada.

**L3-2 · card e fundo eram a mesma cor.**
Era: medido, o card dava **1,07:1** contra o fundo no escuro (`#141414` sobre
`#0a0a0a`) e 1,04:1 no claro (`#ffffff` sobre `#fafafa`); a borda, 1,23–1,28:1.
Na prática não havia superfície: o app era uma folha só, com linhas quase
invisíveis. É: no escuro quem sobe é o card (`#262626`, **1,31:1**) com a borda
em `#424242` (**1,51:1**) e `secondary`/`muted`/`accent` acima do card — eram
mais escuros que ele e viravam buracos; no claro quem desce é o fundo
(`#e0e0dd`, **1,32:1**), o card segue branco e a borda vai a `#c8c8c4`
(**1,68:1**). O laranja do tema claro escureceu um degrau (`#b8400c` →
`#a03608`) para o pill `bg-primary/10` manter os 4,5:1 contra o próprio texto.
Arquivos: `app/globals.css`, `lib/tema.test.ts`.

**L3-3 · a borda dos campos sumia no escuro.**
Era: `--input: #2e2e2e` dava 1,36–1,46:1 contra o que cerca o campo — metade
do mínimo de 3:1 que a WCAG SC 1.4.11 pede para elemento de interface. É:
`--input` deixou de ser a cor dos separadores e virou a cor da **borda do
campo**: `#7a7a78` no escuro (3,52:1 contra o card, 4,60:1 contra o fundo) e
`#807f7d` no claro (4,00:1 e 3,02:1). Arquivos: `app/globals.css`,
`lib/tema.test.ts`.

**L3-4 · a placa das ilustrações ofuscava no escuro.**
Era: `--ilustracao-fundo: #e7e4e0` (78 % de luminância) virava uma janela acesa
de 328×208 px na ficha do exercício e seis quadrados brancos na lista de hoje.
É: `#cfcac4`, 59,5 % de luminância, com o traço preto ainda em 12,9:1. Inverter
o traço (`filter: invert(1)`) foi **descartado**: algumas ilustrações têm cor
de verdade — a prancha tem camisa vermelha — e a inversão as estragaria. No
tema claro a placa passou a ser a cor do card. Arquivo: `app/globals.css`.

**L3-5 · o que flutua não flutuava.**
Era: o FAB "Ajustar" e o play do tutorial usavam `shadow-lg` — sombra preta a
10 % —, que sobre `#0a0a0a` simplesmente não aparece. É: `--sombra-flutuante`
nos dois temas e o utilitário `.flutuante`: no claro sombra de verdade
(`0 10px 24px`); no escuro um **anel de 1 px** em `primary/75` (5,2:1 contra o
fundo) com glow curto, porque sombra preta sobre preto não existe. Arquivos:
`app/globals.css`, `components/treino/fab-ajustar.tsx`,
`components/exercicio/tutorial.tsx`.

**L3-6 · 43 tamanhos de texto escritos à mão.**
Era: `text-[11px]`, `text-[10px]`, `text-[9px]`, `text-[0.7rem]` e
`text-[0.8rem]` espalhados por 20 arquivos — inclusive um de **9 px**. É: dois
degraus com nome no `@theme` — `text-rotulo` (11 px) e `text-micro` (10 px) —,
e nada abaixo de 10 px. Arquivos: `app/globals.css` e os 20 pontos de uso.

*A armadilha, que os testes pegaram:* o mesclador de classes (`cn`) não
conhecia os dois nomes novos e os classificava como **cor** de texto — todo
`text-<algo>` desconhecido cai no grupo da cor. Numa chamada como
`cn("text-rotulo leading-none", aceso ? "text-primary" : "text-muted-foreground")`
ele jogava o tamanho fora, e a faixa da semana e a barra de abas voltavam aos
16 px herdados: a faixa passou a vazar 13 px dos 360. `lib/utils.ts` agora cria
o `cn` com `createCn({ extend: { classGroups: { "font-size": [{ text: ["rotulo",
"micro"] }] } } })`, os treze arquivos que importavam de `"cn"` passam por ele, e
`lib/utils.test.ts` prende o comportamento.

**L3-7 · o foco só existia em botão e campo.**
Era: o `<Link>` de um card, a linha de uma lista, o cartão do IMC de `/corpo` e
as abas de baixo não desenhavam **nada** ao receber Tab, e o anel dos botões e
campos era `ring-ring/50` — medido, 2,9:1 no escuro e 2,2:1 no claro, abaixo
dos 3:1. É: `app/globals.css` desenha `outline: 2px solid var(--ring)` em todo
focável (com `:where()`, para não roubar a vez de ninguém), há a utilitária
`.foco` para quem carrega `outline-none` do shadcn, e o anel dos botões e
campos passou a ser a cor cheia (8,7:1 no escuro, 5,2:1 no claro).
**O `test.fixme` da varredura saiu** — e o diagnóstico que o acompanhava
estava errado: não era o `:focus-visible` que deixava de casar (ele casa,
`el.matches(':focus-visible')` é verdadeiro e `--tw-ring-shadow` já vale
`0 0 0 3px #fb923c`), era o **relógio**. O `Button` do shadcn anima com
`transition-all` de 150 ms, então a leitura feita no mesmo tique do Tab pegava
o `box-shadow` ainda todo transparente; e a condição antiga
(`boxShadow !== "none"`) aceitava justamente essas sombras transparentes como
anel, o que no claro dava o verde falso. Medindo com espera, 0 de 85 focáveis
ficam sem anel; com espera zero voltam as 141 "falhas", idênticas nos dois
temas — e os próprios logs mostravam a instabilidade (revar2 reprovou e revar3,
no MESMO commit, passou). A varredura agora espera a transição assentar (até
400 ms, saindo assim que o anel aparece) e exige cor **não-transparente**, lida
pelo **canvas** (o Chromium devolve `oklab()` em toda sombra que passa por
`color-mix`; uma expressão regular de `rgb()` daria transparente para todas) —
e com isso as 141 "falhas" somem. Os DOIS focáveis que ainda sobravam em
`/corpo` caíram na segunda correção da auditoria (veja abaixo): o **painel** da
aba, que o Radix deixa focável e que o shadcn entregava com `outline-none`, e o
`input[type="date"]`, cujo último Tab entra no shadow DOM do navegador. **O
item está completo**: a varredura do foco passa nas doze rotas nos dois temas,
sem `fixme`.
Arquivos: `app/globals.css`, `components/ui/button.tsx`,
`components/ui/input.tsx`, `components/ui/tabs.tsx`,
`components/nav-inferior.tsx`, `e2e/ultraloop-varredura.spec.ts`.

**L3-8 · a aba acesa era só laranja.**
Era: `text-primary` e nada mais — quem não distingue a cor não sabia em que
aba estava. É: barra de 2 px no topo do item (`data-aba-ativa="barra"`) e
rótulo em semibold, além da cor. Os 44 px e a área segura não mudaram.
Arquivo: `components/nav-inferior.tsx`.

**L3-9 · oito estados vazios eram um `<p>` tracejado.**
Era: "Nenhum exercício com esses filtros." numa linha, sem dizer o que fazer.
É: `components/ui/vazio.tsx` — ícone, título curto, uma frase e a ação quando
ela existe — nos oito: catálogo e parte do corpo ("Limpar filtros"), Explorar e
treino personalizado ("Limpar busca"), histórico do Relatório ("Ver o histórico
completo" / "Ver o treino de hoje"), gráficos sem dado, conquistas ainda não
avaliadas e Mais → Contas. Textos de **interface**; nada de conteúdo de treino,
que só sai dos JSON. Arquivos: `components/ui/vazio.tsx` e os oito usos.

**L3-10 · um esqueleto genérico para telas de formas diferentes.**
Era: `EsqueletoCard` — três barras num retângulo — anunciando a aba Treino (que
abre com uma capa alta), o Relatório (três contadores lado a lado) e as listas
(miniatura + duas linhas). É: `EsqueletoCapa`, `EsqueletoGrade3` e
`EsqueletoLista` ao lado do genérico, usados em Treino, Relatório e no
histórico do exercício. Arquivo: `components/carregando.tsx`.

**L3-11 · texto cortado sem como ler o resto, e `title` de tooltip.**
Era: sete `line-clamp` cortavam rótulo, subtítulo e detalhe sem oferecer o
texto inteiro, e quatro `title` eram usados como tooltip — que no celular não
existe. É: todo `line-clamp` leva o texto completo no `title` e, quando o
elemento é clicável (linha do calendário, linha de coleção, card do exercício),
também no nome acessível; os `title` de tooltip viraram texto só-leitor (dia da
faixa da semana, dia da grade do mês) ou nome acessível de imagem (os raios de
dificuldade, agora `role="img"`). Arquivos: `components/calendario/grade.tsx`,
`components/treinar/timer-descanso.tsx`, `components/colecoes/linha-colecao.tsx`,
`components/treino/desafios.tsx`, `components/exercicios/lista-exercicios.tsx`,
`components/mais/linha-sincronizacao.tsx`, `components/ui/raios.tsx`,
`components/ui/faixa-semana.tsx`.

**L3-12 · o voltar de Mais era texto.**
Era: um `<Link>` de 14 px com `alvo`, sem cara de botão. É: botão fantasma com
`ChevronLeft` de 20 px e o rótulo "Mais", 44 px de altura, igual ao topo do
player. Arquivo: `components/mais/cabecalho.tsx`.

**Provas.** `lib/tema.test.ts` cresceu de 16 para 25 casos: o degrau
card/fundo e borda/card, a borda do campo com 3:1 contra quatro superfícies, o
anel de foco contra o `muted`, as linhas auxiliares dos gráficos, a placa das
ilustrações abaixo de 60 % de luminância e o anel da sombra flutuante — os
limiares **só sobem**. `e2e/ultraloop-a-r2.spec.ts` (11 testes) mede no
navegador, nos dois temas: nenhum `data-slot=button`/`input` abaixo de 44 px em
quatro rotas, o degrau das superfícies, a borda de todo `<input>` de `/corpo` e
`/mais/contas`, nenhuma superfície acima de 60 % de luz no escuro, o `box-shadow`
do FAB, nenhum texto abaixo de 10 px em cinco rotas, o anel de foco do card e
da aba, a barra da aba acesa, o vazio do catálogo com "Limpar filtros"
funcionando, o `aria-label`/`title` do card cortado e os 44 px do voltar de
Mais. **As cinco varreduras** — rolagem lateral, 44 px, contraste AA, anel de
foco e reduced-motion — passam nas doze rotas nos dois temas, sem `fixme`
nenhum (a do foco fechou na segunda correção da auditoria).

**Como testar no celular.** Abra o app no escuro: os cards agora se **separam**
do fundo (antes eram a mesma tinta), a ficha de um exercício não acende mais
uma placa branca atrás da ilustração e o botão redondo "Ajustar" da aba Treino
tem um contorno alaranjado. Toque em qualquer campo (Corpo → peso, Mais →
Contas): a borda dele aparece antes mesmo do toque. Na barra de baixo, a aba em
que você está tem uma barrinha no topo além do laranja. Em Mais → Preferências,
o "Mais" do topo é um botão de dedo, não uma palavra. No catálogo, busque
"zzzz": em vez de uma linha tracejada, aparece o cartão de vazio com **Limpar
filtros**. E qualquer botão do app, em qualquer tela, tem pelo menos 44 px.

**Correção da auditoria do lote (rodada 2).** Um auditor independente reprovou
o lote com cinco achados; todos foram corrigidos e cada um virou teste.

1. **O interruptor não dizia o estado no escuro** (SPEC §22.3 item 13). O
   trilho trazia `bg-input … group-data-checked:bg-primary … dark:bg-input/80`
   e a variante `dark:` (0,2,0) vencia a de estado (0,1,0): medido, o MESMO
   cinza `--input` a 80 % ligado e desligado. Só o polegar mudava — e ao
   contrário do tema claro: **preto** quando ligado. Como o item 3 do lote
   levou `--input` de `#2e2e2e` para `#7a7a78`, o que era um pill quase
   invisível virou um pill cinza-claro bem visível nos dois estados, e as seis
   chaves de Preferências passaram a ler "ligado" como "desligado". Agora cada
   estado tem a sua regra (nenhuma pega os dois) e o polegar é claro sempre; a
   borda de 1 px do polegar segura os 3:1 contra o laranja do tema escuro.
   Arquivo: `components/ui/switch.tsx`.
2. **A aba acesa ficou mais escura que as apagadas no claro** (item 14).
   `TabsTrigger` usava `data-active:bg-background` e o lote baixou
   `--background` de `#fafafa` para `#e0e0dd`: em `/corpo` a lista media
   `#efefec` e a aba ativa `#e0e0dd` — a cor da página, mais escura que a
   lista —, invertendo a leitura do estado; o mesmo nas abas da ficha de
   exercício. Passou a `data-active:bg-card` (o escuro segue com
   `input/30`). Arquivo: `components/ui/tabs.tsx`.
3. **O degrau do item 2 não chegou a `/mais` nem a `/mais/creditos`.** O bloco
   de menu e as seções de créditos eram transparentes: no escuro, preto sobre
   preto com uma borda — exatamente o defeito que o item dizia ter matado (a
   captura 18-mais-escuro mudou 2,62 % e a 24-creditos-escuro 1,83 %, só a
   borda). Levaram `bg-card`, e a varredura do repositório achou mais dois
   blocos `border-border` + `cartao` sem fundo próprio. Arquivos:
   `app/(app)/mais/page.tsx`, `app/(app)/mais/creditos/page.tsx`,
   `components/exercicio/ficha-folha.tsx`, `components/treino/cards.tsx`.
4. **O vazio de gráfico vazou para fotos e medidas** (item 15). O item 9
   trocou o `SemDados` por `Vazio` com ícone `ChartSpline` e título "Sem dados
   por enquanto", e a galeria de fotos vazia passou a anunciar isso com um
   gráfico de linha em cima de "Nenhuma foto ainda.". `SemDados` ganhou
   `icone` (o `ChartSpline` só como padrão) e frase opcional; a galeria usa
   `Camera`, o comparador `ImageOff` e a tabela de medidas `Ruler`, cada um
   com o seu título. Arquivos: `components/graficos/apoio.tsx`,
   `components/corpo/aba-fotos.tsx`, `components/corpo/aba-medidas.tsx`.
5. **O diagnóstico do `fixme` do foco estava errado** — veja L3-7 acima: a
   causa é o `transition-all` do `Button`, não o `:focus-visible`, e a régua
   aceitava sombra transparente como anel. O texto foi corrigido no teste, na
   SPEC §22.3 item 7 e aqui; com a medição consertada as 141 "falhas" somem e
   sobraram só dois focáveis de `/corpo`, que a **segunda** correção fechou.

Provas novas em `e2e/ultraloop-a-r2.spec.ts` (15 testes): trilho e polegar do
interruptor nos dois estados e nos dois temas, a aba acesa mais clara que a
lista em `/corpo` e na ficha do exercício, o fundo REAL do bloco de `/mais` e
das seções de `/mais/creditos` contra o fundo da página, e o título do vazio da
galeria de fotos.

**Segunda correção da auditoria do lote (rodada 2).** O auditor reprovou de
novo, com cinco achados. Todos corrigidos.

1. **O anel de foco fechou — o `fixme` saiu** (bloqueante do item 7). Medindo
   focável por focável em `/corpo`, os dois que faltavam não eram o que o
   relatório anterior dizia:
   - o **painel da aba** (`div[data-slot=tabs-content]`), que o Radix deixa
     focável com `tabindex="0"` para o teclado cair dentro do conteúdo. O
     `.textContent` dele começa em "IMC Editar altura…", o que o fazia passar
     por "cartão do IMC"; o `CardImc` é um `<section>` e nunca teve
     `tabindex`. Ele vinha com `outline-none` do shadcn — uma **utilitária**,
     que ganha da regra global de `app/globals.css` por estar numa camada
     acima —, então trocamos `outline-none` pela `.foco`.
   - o campo `#peso-data`, um `input[type="date"]`. O Chromium lhe dá shadow
     DOM: o Tab anda por dia, mês, ano **e ainda pelo ícone do calendário**.
     Nesse quarto passo o `document.activeElement` continua sendo o campo,
     mas quem tem o foco é um nó de dentro, então o host deixa de casar
     `:focus-visible` e o anel sumia. O `Input` ganhou
     `focus-within:ring-3 focus-within:ring-ring` ao lado do `focus-visible`;
     `:focus-within` casa com o host enquanto o foco estiver na sombra, e nos
     campos de texto os dois estados coincidem, então nada mais muda. O campo
     **tem** nome acessível (`<Label htmlFor="peso-data">` "Data"): o que o
     relatório leu como "sem nome" era o `textContent` vazio de um `<input>`.
   A régua também passou a ler a cor pelo **canvas** (`fillStyle` + um pixel),
   que aceita `rgb()`, `oklab()`, `oklch()` e `color()` — o Chromium devolve
   `oklab()` em toda sombra que passa por `color-mix`, e a expressão regular
   antiga dava transparente para elas. Arquivos: `components/ui/tabs.tsx`,
   `components/ui/input.tsx`, `e2e/ultraloop-varredura.spec.ts`.
2. **O polegar do interruptor tinha cor crua** (item 13).
   `shadow-[0_0_0_1px_rgb(10_10_10_/_0.22)]` virou
   `shadow-[0_0_0_1px_var(--polegar-borda)]`, com o token nos dois temas —
   `rgb(10 10 10 / 0.22)` no claro e `rgb(10 10 10 / 0.26)` no escuro, onde o
   trilho ligado é o laranja mais claro. Medido sobre o trilho ligado, a borda
   dá 3,5:1 contra o polegar no escuro e 9,2:1 no claro; `lib/tema.test.ts`
   prende a conta e proíbe a volta da cor crua. Arquivos:
   `components/ui/switch.tsx`, `app/globals.css`, `lib/tema.test.ts`.
3. **O corpo do mapa muscular sumia no claro** (item 16, novo). O item 2 baixou
   o fundo da página para `#e0e0dd` e `--mbody: #c8c8c4` ficou em 1,27:1 contra
   ele — e em `/exercicios/[id]` → Músculos a figura é desenhada **direto sobre
   a página**, sem card embaixo. É `#c0c0bc`: 1,38:1 contra o fundo, com o
   músculo principal ainda em 3,80:1 e o auxiliar em 3,25:1 contra o corpo.
   `lib/tema.test.ts` passou a medir o corpo contra a página também. Arquivos:
   `app/globals.css`, `lib/tema.test.ts`.
4. **A aba tinha anel de 1 px** (item 7). O `TabsTrigger` do shadcn trazia
   `focus-visible:outline-1 focus-visible:outline-ring`, utilitária que vencia
   os 2 px da regra global: saiu, e a aba passou a usar o mesmo anel do resto
   do app. Arquivo: `components/ui/tabs.tsx`.
5. **Indentação e contagem.** O vazio do comparador de fotos estava com o corpo
   indentado dois espaços a mais; e o relatório do lote e estes documentos
   divergiam sobre o item do foco. Fica dito: **o item do foco (`L3-7` aqui,
   `L3-4` na lista do lote) está completo**, assim como os esqueletos (`L3-10`
   aqui, `L3-7` na lista) — os doze itens do lote estão fechados. Arquivo:
   `components/corpo/aba-fotos.tsx`.

*Como testar no celular.* Em Corpo, com um teclado bluetooth (ou o Tab de um
navegador de mesa a 360 px), segure Tab: depois da aba "Peso" o **conteúdo
inteiro** ganha um contorno laranja de 2 px, e o campo de Data mantém o anel
nos quatro passos — dia, mês, ano e o ícone do calendário. Em Mais →
Preferências, o pontinho claro das chaves tem um fio escuro em volta nos dois
temas. Na ficha de um exercício, aba Músculos, a silhueta cinza aparece contra
o fundo da página no tema claro (antes ela quase sumia).

Provas novas em `e2e/ultraloop-a-r2.spec.ts` (17 testes): o painel da aba e os
quatro passos do campo de data com anel nos dois temas, e o nome acessível
"Data" do campo. Em `lib/tema.test.ts` (28 casos): a borda do polegar com 3:1
sobre o trilho ligado nos dois temas, a proibição da cor crua no `Switch` e o
corpo do mapa muscular contra a página.

**Deploy.** No ar em 20/09/2026 às 21:35 UTC, no mesmo merge do lote 4 (a
faixa B já continha a A), pelo PR #7 (main `c7d947a`). Produção saiu de
`dpl_4xNZ9sdTBX6PbdRjD8qrm12YSC57` para o deploy de `c7d947a`; `/versao`
devolve `c7d947ab088e21b0728bda7b482eae24f45982fb` (construído 21:34:12Z) e o
CSS de `/login` mudou de `12175adeeb38d042.css` para `57d136fb92e14898.css`.
Fumaça verde na primeira tentativa, item a item: `/login` 200 com "Treino do
Terraço" e "Entrar" e sem aviso de configuração — ok; `/` → 307 para `/login`
— ok; `/versao` igual ao sha de main — ok; `/sw.js` 200 com `/~offline`,
`figuras/` e o mesmo CSS do `/login` — ok; `/manifest.webmanifest` 200 com
"Treino do Terraço" — ok; `/~offline` 200 — ok; os 12 scripts
`/_next/static` do `/login` → 200 — ok. Marcadores deste lote: o CSS
publicado `57d136fb92e14898.css` contém `.text-rotulo{font-size:11px}` e
`.foco` — ok; e os chunks das telas mudadas trazem a classe nova (a home
`app/(app)/page` e `app/(app)/treinar/[sessionId]` contêm `text-rotulo`) —
ok. **Rollback: não.**

### Rodada 2 — Lote 4 — imagens, mídia e entrega (faixa B)

Branch `ultraloop/l4-imagens-midia-entrega`, a partir de
`ultraloop/l2-relatorio-corpo-calendario`. SPEC §22.4.

#### 1. Derivadas de imagem no prebuild (L4-1)

**Era:** `public/fotos` (11 MB, 162 JPEG de 850 px de largura) e `public/itens` (6,2 MB,
85 JPEG) só tinham o arquivo original, e o app nunca gerou derivada nenhuma.
A miniatura de 56 px recebia os 850 px inteiros — 7,6× o necessário, 71 kB
por linha de lista — e a capa de 326×160 recebia a mesma foto a 1,30×, que no
retina é mole.

**É:** `npm run assets` (prebuild) gera em `public/`, com `sharp` e cache por
data de modificação:

| derivada | tamanho | de quem | quem pede |
| --- | --- | --- | --- |
| `<nome>.webp` | até 1200 px, q78 | só as fotos | ficha do exercício e foto em tela cheia |
| `<nome>-mini.webp` | 112×112 | fotos, ilustrações e itens | miniaturas das listas |
| `<nome>-capa.webp` | 720×360 | as fotos `-1` que viram capa | cartões com capa |

635 arquivos na primeira vez, nada nas seguintes. A miniatura ficou com
**2,4 kB de média** (era 71 kB: 29×), a capa com 22 kB e a versão grande com
**44 kB** (era 70: −37 % na tela mais pesada de imagem do app).
`lib/midia.ts` (`urlWebp`, `urlMiniatura`) e `lib/capas.ts` (`urlCapa`) montam
o nome; a imagem cai sozinha no arquivo original quando a derivada falta
(`onError` em dois degraus), então um build sem `npm run assets` continua
desenhando. `scripts/validar-dados.ts` recusa um arquivo do kit chamado
`-mini`/`-capa` ou um `.webp` ao lado de um `.jpg` de mesmo nome — a derivada
o sobrescreveria em silêncio. Nada disso entra em `assets/` nem no git.

**Auditoria da rodada 2.** A versão grande era gerada (162 fotos + 85 itens) e
não era servida: `urlWebp` e `temDerivada` não tinham chamada fora do teste, e
a ficha continuava baixando o JPEG de 71 kB. Corrigido dos dois lados: as
quatro `<img>` de foto de execução (`components/exercicio/midia.tsx`,
`components/exercicio/media-grande.tsx`,
`components/exercicios/fotos-ampliaveis.tsx` e
`components/exercicios/foto-ampliada.tsx`) passaram a pedir `urlWebp(url)`, e o
item de equipamento — que nunca aparece maior que a caixa de 56 px — deixou de
ganhar a versão grande (85 arquivos e 3,5 MB a menos por deploy). O degrau da
reserva virou `fonteComReserva`/`reservaDaImagem` em
`components/ui/imagem.ts`: sem derivada para aquele caminho a reserva sai
`undefined`, e o `onError` não repete o mesmo pedido que acabou de falhar.
`temDerivada`, que ninguém chamava, saiu. Prova em
`e2e/ultraloop-b-r2.spec.ts` ("a ficha e a foto em tela cheia pedem a derivada
WebP"): em `/exercicios/agachamento-livre` toda foto da tela é `.webp` e
carrega (`naturalWidth > 0`), e a foto ampliada também.

Arquivos: `scripts/copiar-assets.ts`, `scripts/validar-dados.ts`,
`lib/midia.ts`, `lib/capas.ts`, `components/ui/imagem.ts`,
`components/ui/miniatura.tsx`, `components/ui/card-capa.tsx`,
`components/colecoes/linha-colecao.tsx`, `components/exercicio/midia.tsx`,
`components/exercicio/media-grande.tsx`,
`components/exercicios/fotos-ampliaveis.tsx`,
`components/exercicios/foto-ampliada.tsx`,
`components/mais/tela-equipamento.tsx`.

#### 2. Cache-Control da mídia (performance-05)

**Era:** `next.config.ts` devolvia só os cabeçalhos de segurança para
`/:caminho*`, então toda imagem saía com `max-age=0` — 12 revalidações 304
numa navegação pela aba Treino.
**É:** `/fotos`, `/ilustracoes`, `/itens`, `/figuras`, `/icons` e
`/mapa-muscular` saem com `public, max-age=604800, stale-while-revalidate=86400`.
Uma semana em vez de `immutable`: o nome do arquivo não tem hash e trocar uma
foto não pode ficar preso a um renomeio.

#### 3. Dimensões, lazy, decoding e prioridade (L4-2)

**Era:** 15 `<img>` sem `width`/`height` (com `data/ilustracoes.json` trazendo
largura e altura), sem `decoding` e, em vários casos, sem `loading`.
**É:** `midiaGrande()` devolve `largura`/`altura`; a ilustração, a figura, as
fotos do corpo, a foto ampliada, a miniatura do tutorial e as miniaturas das
listas levam tamanho, `loading` e `decoding="async"`. A capa da primeira dobra
(o cartão com selo "hoje"/"em andamento", um por tela) é `loading="eager"` +
`fetchpriority="high"`; as outras capas ficam `lazy`.

#### 4. Enquadramento e texto alternativo da miniatura (imagens-08)

**Era:** 52 dos 145 arquivos de ilustração são mais altos que largos
(proporção até 0,35) e apareciam encolhidos no meio da caixa quadrada, com
`object-contain`, enquanto a foto usava `object-cover` na mesma lista. O `alt`
repetia o nome do exercício que já estava escrito ao lado.
**É:** a derivada já nasce quadrada — a ilustração alta (proporção < 0,7) é
cortada pelo alto, o corpo ocupa a caixa — e foto e ilustração usam **um**
enquadramento só (`object-cover`). O `alt` inverteu o padrão: vazio quando há
texto ao lado (todos os usos de hoje), nome só com `sozinha`.

#### 5. Manifest e ícones (L4-3) — parcial

**Era:** o manifest não tinha atalhos nem maskable de 192, e
`scripts/gerar-icones.ts` desenhava com `#f97316` — um laranja que não existe
nos tokens do app.
**É:** o manifest ganhou os atalhos (Treino `/`, Relatório `/relatorio`, Corpo
`/corpo`) e o `icone-maskable-192`; o gerador lê `--primary` do bloco `.dark`
de `app/globals.css` (`#fb923c`).

**O que ficou de fora e por quê.** A `theme-color` seguir o tema **escolhido**
(e não o do aparelho) foi implementado, medido e **revertido**. Reescrever as
metas no cliente só cola enquanto ninguém navega: a cada troca de tela o Next
reescreve o `<head>` com o `viewport` do layout e devolve as duas cores por
`prefers-color-scheme`. Refazer no `usePathname` chega tarde em parte das
navegações, e a versão com `MutationObserver` no `<head>` — que funcionava —
custou caro: `e2e/guia.spec.ts` passou a estourar 20 s em três navegações para
`/mais*` (cada mutação de `<head>`, e o Next prefetch insere muitas, forçava um
recálculo de estilo). Fica para um lote que trate disso na raiz, provavelmente
escrevendo a meta no `viewport` a partir do tema lido no servidor.

#### 6. `/favicon.ico` responde imagem (imagens-14)

**Era:** 404 com 11 kB de HTML — o App Router só serve esse caminho a partir
de `app/favicon.ico`, e só havia `app/icon.png`.
**É:** `npm run icones` escreve `app/favicon.ico` (um PNG de 32 px dentro do
cabeçalho .ico, 355 bytes, sem dependência nova) e `app/layout.tsx` o declara.

#### 7. Região de avisos em português (a11y-11)

**Era:** `aria-label="Notifications alt+T"`, a única string em inglês do app.
**É:** `containerAriaLabel="Avisos"` em `components/ui/sonner.tsx`.

#### 8. Sprite órfão fora do layout (L4-5)

**Era:** `SpriteMuscular` injetava `corpo-sprite.svg` (o boneco `#bf`/`#bb`,
4,7 kB) no HTML de **toda** página, e o único componente que o usava,
`components/mapa-muscular.tsx`, não era importado por ninguém desde o marco
Mídia.
**É:** os dois saíram; o `MapaAnatomico` da ficha continua igual.

#### 9. Esqueleto do shell (L4-6) — revertido, fica na fila

`app/(app)/loading.tsx` foi escrito, funcionou (o esqueleto aparecia na troca
de aba, com o servidor atrasado de propósito) e **saiu**: um `loading.tsx` no
grupo `(app)` põe uma fronteira de Suspense em **todas** as rotas
autenticadas, e `e2e/auditoria-m5.spec.ts` (as 81 fichas) passou a ler a
página antes de o corpo chegar em 29 delas. O ganho é real, mas precisa de um
`loading.tsx` por rota, com o esqueleto daquela tela, em vez de um só no
grupo — e isso é trabalho de um lote inteiro.

#### 10. Bundle das rotas pesadas (L4-7) — revertido, fica na fila

`next/dynamic` para a ficha em folha (com o tutorial e o iframe do YouTube
dentro), para a folha de ajustes do player, para o bloco de recordes e
gráficos do Relatório e para Desafios/ParteDoCorpo/Personalizar. Medido no
build, antes → depois: `/explorar/[tipo]/[valor]` 377 → **346 kB**, `/treinar`
374 → 358, `/` 403 → 386, player 412 → 397, `/relatorio` 371 → 369.

Duas coisas mataram o item nesta rodada:

1. A meta de 350 kB só caiu numa rota. O que sobra não é código de tela: são
   os chunks de fornecedor que toda rota autenticada precisa na primeira carga
   — o cliente do Supabase (195 kB bruto, é ele que valida a sessão), o Dexie
   da fila offline (94 kB) e o runtime do React/Next.
2. `components/exercicio/ficha-folha.tsx` é importado **estaticamente** pela
   página `/exercicios/[id]` (o `ConteudoDaFicha`) e dinamicamente pelos
   quatro lugares que abrem a folha. Com o `next/dynamic`, a ficha em página
   inteira passou a renderizar só o cabeçalho: `e2e/auditoria-m5.spec.ts`
   acusou "0 imagens, 0 passos" em 29 das 81 fichas. Dividir esse módulo em
   dois (a folha e o conteúdo) resolve, e é o primeiro passo do lote que
   pegar este item.

Nada disso está no commit: a árvore ficou como estava, com as medições
anotadas aqui para quem continuar.

#### 11. Abertura do iPhone (L4-4)

**Era:** sem `apple-touch-startup-image`, o app instalado abria numa tela preta
vazia até o shell pintar.
**É:** `npm run icones` gera as seis aberturas comuns (1170×2532, 1284×2778,
1179×2556, 1290×2796, 828×1792, 750×1334) com fundo `#0a0a0a` e o ícone no
meio, e `app/layout.tsx` as declara com as media queries de cada aparelho. Elas
ficam **fora** do precache do service worker: o iOS as busca uma vez, na
instalação.

#### Segunda auditoria da rodada 2 — o que o corretor mudou

1. **O aquecimento da fase seguia pedindo os originais** (SPEC §8, o problema
   importante). `midiaDaFase()` listava `urlsDaIlustracao` + `urlFigura` +
   `urlFotos`, isto é, o JPEG do kit — enquanto a lista de hoje passou a pedir
   `-mini.webp`, o cartão `-capa.webp` e a ficha `.webp`. Sem rede, o treino
   do dia podia abrir sem exatamente as imagens que as telas buscam. Agora a
   lista é **o que as telas pedem**, com o mesmo degrau de
   `fonteComReserva`: a capa de cada treino da fase, a miniatura de cada
   exercício, as ilustrações e a figura (que a ficha usa como estão) e o WebP
   das fotos de execução — e nenhum `.jpg`. São 73 arquivos na fase 1 (eram
   73 originais). `lib/precache-do-programa.test.ts` monta a lista esperada
   chamando as funções dos próprios componentes (`fonteComReserva`, `urlCapa`,
   `urlMiniatura`, `urlWebp`) e compara item a item, nas duas fases, com um
   exercício de cada tipo de mídia (foto, ilustração, figura);
   `e2e/auditoria-offline.spec.ts` espera a miniatura da lista entrar no cache
   e, depois de cortar a rede, exige que ela **desenhe** (`naturalWidth > 0`).
2. **As quatro fotos de execução não diziam o tamanho.** `lib/midia.ts` ganhou
   `MEDIDA_DA_FIGURA` (o `viewBox` 132×100 das 67 figuras) e `medidaDaFoto()`,
   que devolve `null` para a foto do Corpo — essa vem do storage e ninguém
   sabe quanto mede. As quatro `<img>` de foto e as duas de figura passaram a
   levar `width`/`height`; o teste "§22.4-3" agora roda na aba Treino, na
   ficha `/exercicios/[id]`, na foto em tela cheia e em Mais → Equipamento.
   (A medida da foto era uma constante `MEDIDA_DA_FOTO` de 850×567 "igual nas
   162 fotos" — era falso, e a terceira auditoria abaixo desfez isso.)
3. **A queda da miniatura ficava presa.** Sem derivada (`mini === null`) o
   primeiro degrau já era o original e o segundo pedia o mesmo arquivo que
   acabara de falhar. `components/ui/miniatura.tsx` passou a montar os degraus
   com `fonteComReserva`: o que a tela pede, a reserva do kit **quando existe**
   e o ícone. O degrau continua em estado (e não pelo DOM, como o
   `reservaDaImagem`) porque o enquadramento muda junto — a derivada é
   quadrada, o original não.
4. **`/favicon.ico` era declarado três vezes** no `<head>`: o do App Router
   (`app/favicon.ico`), o de `icons.icon` e o de `icons.shortcut`. Ficou só o
   do App Router; o teste "§22.4-6" conta os `<link>` e continua exigindo
   200 com `content-type` de imagem. O comentário do `viewport` dizia que a
   `theme-color` é corrigida no cliente — isso foi revertido neste mesmo lote
   e o comentário agora descreve o que o código faz.
5. **Comentários apontando para um item que não existe.** `app/layout.tsx`,
   `next.config.ts` e `scripts/gerar-icones.ts` citavam "SPEC §22.4 item 11";
   a abertura do iPhone é o item **9**. E a tabela de assets da SPEC (§1) ainda
   mandava para o componente `MapaMuscular`, que saiu no item 8 — passou a
   descrever o mapa anatômico e o `MapaAnatomico`, e o §7 diz onde o sprite
   antigo foi parar.
6. **A foto do item do terraço estava a 1,75×.** A caixa era de 64 px para uma
   derivada de 112. Virou 56 px (`size-14`), a mesma das outras miniaturas —
   2× exatos, medidos no navegador pelo teste "a foto do item do terraço
   também tem o dobro da caixa" (`caixa === 56`, `naturalWidth ≥ 112`).

#### Provas

- `e2e/ultraloop-b-r2.spec.ts`: 13 testes, um por item que se vê — peso de
  imagem do Explorar, capa a 2× da caixa, zero revalidação 304, dimensões e
  `decoding` de toda imagem de exercício, capa da primeira dobra `eager`,
  enquadramento e ocupação da miniatura, atalhos do manifest, `/favicon.ico`,
  nenhum rótulo em inglês e o boneco antigo fora do HTML.
- `e2e/treino-v2.spec.ts` passou a exigir a **derivada** na capa do card do dia
  e na miniatura da lista (o nome sai do mesmo caminho do JSON, como antes): o
  que o teste verifica continua sendo "a tela pede a imagem certa e ela
  carrega", agora com o arquivo certo.
- Unitários novos em `lib/midia.test.ts` e `lib/capas.test.ts` para as funções
  puras das derivadas, e `lib/medidas-de-foto.test.ts` para as medidas (abre
  as 162 fotos e as derivadas com o `sharp`).

#### Terceira auditoria da rodada 2 — o que o corretor mudou

**O problema:** `MEDIDA_DA_FOTO = {850, 567}` era uma suposição, declarada no
comentário do próprio arquivo, na mensagem do commit, aqui no PROGRESSO e na
SPEC §22.4 como "a medida das 162 fotos do kit e da derivada WebP". Dez fotos
fogem dela: `agachamento-bulgaro-1/-2`, `barra-fixa-assistida-1/-2` e
`barra-fixa-com-lastro-1/-2` medem 850×1275 (a derivada, limitada a 1200 px no
maior lado, sai 800×1200) e `agachamento-goblet-1/-2` e `salto-basico-1/-2`
medem 850×569. Em três das quatro `<img>` o CSS escondia o erro
(`aspect-square`, `h-40`), mas em `components/exercicios/foto-ampliada.tsx` a
classe é `max-h-[80dvh] w-full max-w-lg object-contain`: com o `height:auto` do
preflight, quem manda antes de a foto chegar é a proporção dos atributos. A
caixa reservada era 344×229 e pulava para 344×516 quando a imagem carregava —
287 px de salto numa tela de 740 px, na imagem mais pesada do app, que é
exatamente o que o item 3 existe para eliminar. O teste "§22.4-3" só conferia
que `width`/`height` existiam, então passava com o dado errado.

**O que passou a valer:**

1. **A medida é medida, não suposta.** `scripts/copiar-assets.ts` já abre cada
   foto com o `sharp` para gerar as derivadas; agora grava também
   `data/medidas-de-foto.json` — 162 linhas com `kit` (o JPEG de
   `assets/fotos`) e `webp` (a derivada de `public/fotos`, que é o arquivo que
   a tela pede). É o mesmo papel que `data/ilustracoes.json` cumpre para as
   ilustrações: conteúdo em JSON, nada de medida escrita no código. O arquivo
   entra no git (as telas o importam por `lib/dados.ts`, com schema zod) e só é
   reescrito quando muda.
2. **`medidaDaFoto()` lê dali** e devolve a medida **do arquivo pedido**: a da
   derivada para `/fotos/x.webp`, a do kit para `/fotos/x.jpg`. As quatro
   `<img>` de foto passaram a perguntar pela URL que elas realmente pedem
   (`fonte.src`), e não pelo original. `MEDIDA_DA_FOTO` deixou de existir.
3. **Um unitário que teria pegado isto hoje.** `lib/medidas-de-foto.test.ts`
   percorre `assets/fotos` com o `sharp` e reprova se o JSON discordar de
   qualquer arquivo — do kit e da derivada —, se sobrar ou faltar foto, ou se a
   derivada perder a proporção do original. São 8 casos, 1 s.
   `npm run validar` também cobra o par (foto no kit ↔ medida no JSON) antes do
   build, com o recado "rode npm run assets".
4. **O e2e deixou de aceitar qualquer par de números.** O "§22.4-3" agora exige
   `width`/`height` **iguais** a `naturalWidth`/`naturalHeight` em toda foto do
   kit já carregada, e roda em duas fichas: `agachamento-livre` (850×567) e
   `agachamento-bulgaro` (a derivada de 800×1200). E há um teste novo que
   segura a foto na rede, mede a caixa vazia, solta a imagem e exige a mesma
   altura depois — a prova do item, na imagem mais pesada do app.
5. **Os textos.** SPEC §22.4 itens 1 e 3, este PROGRESSO e os comentários que
   afirmavam "igual nas 162 fotos" passaram a dizer o que é verdade: 152 fotos
   de 850×567, seis de 850×1275 e quatro de 850×569.

#### Como testar no celular

0. Abra **Explorar → agachamento búlgaro** e toque numa das duas fotos para
   ampliar: a foto abre já na altura final, sem a tela dar um pulo quando a
   imagem termina de carregar (antes o salto era de 287 px).
1. Abra a aba **Treino**. A capa do treino de hoje tem de aparecer nítida
   (é uma imagem de 720 px numa caixa de 326) e as linhas da lista já vêm com
   a miniatura sem aquele pisca de imagem grande chegando depois.
2. **Mais → Equipamento**: a lista de itens abre quase instantânea (as fotos
   agora são 2,4 kB em vez de 70 kB cada).
3. Abra a mesma tela duas vezes seguidas: na segunda não há rede nenhuma para
   as imagens (elas valem por uma semana).
4. Instale o app (Adicionar à tela de início). No iPhone, a abertura mostra o
   ícone sobre o fundo preto em vez da tela preta vazia; segurando o ícone,
   aparecem os atalhos Treino, Relatório e Corpo.


**Deploy.** No ar em 20/09/2026 às 21:35 UTC, pelo PR #7 (main `c7d947a`),
no mesmo merge do lote 3. Produção saiu de
`dpl_4xNZ9sdTBX6PbdRjD8qrm12YSC57` para o deploy de `c7d947a`; `/versao`
devolve `c7d947ab088e21b0728bda7b482eae24f45982fb`. Além dos sete itens
obrigatórios da fumaça (todos ok, listados na subseção do lote 3), os
marcadores deste lote nas rotas públicas: `/manifest.webmanifest` contém
`shortcuts` e `maskable` — ok; `/favicon.ico` → 200 `image/x-icon` — ok; o
HTML de `/login` contém `apple-touch-startup-image` — ok;
`/fotos/agachamento-bulgaro-1.webp` → 200 `image/webp` — ok;
`/fotos/agachamento-bulgaro-1-mini.webp` → 200 `image/webp` — ok; `/sw.js`
**não** contém `id="bf"` (o sprite órfão saiu) e o `/login` não cita
`mapa-muscular.tsx` — ok. No pacote publicado, o chunk compartilhado
`1580-7dcad54a8a41be73.js` traz a função que deriva o sufixo `-mini` e as
medidas padrão `{largura:132,altura:100}` — a prova das derivadas dentro do
bundle. A sonda opcional de Playwright a 360 px contra a URL pública não
rodou (o Chromium local não confia na CA do proxy de saída); a régua de
360 px, 44 px, contraste e foco já correra verde nas 30 telas no portão
local. **Rollback: não.**

### Rodada 3 — Lote 5 — player: gravar sem perder o treino (faixa A)

Branch `ultraloop/l5-player-gravar`, a partir de `ultraloop/l4-imagens-midia-entrega`.
SPEC §22.5. Dez itens, na ordem de prioridade do lote.

**Era → é, item a item**

1. **Descartar (`ux-heuristicas-01`).** Era: "Abandonar" virava "Confirmar
   abandono" no MESMO ponto (x 138,8–241,4 → x 71,6–241,4, mesma faixa de y) —
   dois toques seguidos descartavam a sessão sem diálogo nenhum. É: um
   `AlertDialog` ("Descartar este treino?" e, embaixo, o que já está salvo —
   "Nenhuma série foi registrada ainda." antes da primeira série, "A 1 série já
   registrada continua salva." ou "As N séries já registradas continuam
   salvas." · Cancelar / Descartar este treino), com o Cancelar nascendo com o
   foco e o clique fora sem efeito. O zero é o caso mais comum (abrir, mudar de
   ideia e sair antes de gravar) e tem frase própria — nunca "As 0 séries". O
   e2e do lote cobre os dois estados: um caso abre a Visão geral sem nada
   registrado e exige que a pergunta não fale em "0 séries"; o outro marca uma
   série na folha (o visto da própria Visão geral, que é o que move a contagem)
   e exige o singular. Arquivos: `components/ui/alert-dialog.tsx`
   (novo, sobre o pacote `radix-ui` que já estava nas dependências),
   `components/treinar/visao-geral.tsx`.
2. **Gravar ao entrar na conclusão (`tela-treino-player-01`).** Era: nada ia
   para o banco antes do "Próximo", que ficava a 2.244 px do topo de uma
   página de 2.464 px — e o topo já dizia "Excelente! Você concluiu o
   treino."; quem lia e saía deixava "EM ANDAMENTO · Continuar · 17/17 séries"
   na aba Treino. É: `finalizarSessao` roda ao ENTRAR no passo de conclusão
   (`salvar(..., { navegar: false })`), um `role="status"` no alto diz "Treino
   salvo. Já está no histórico, mesmo que você saia agora." e o "Próximo" está
   numa barra fixa no rodapé, com o padrão de `ControlesDoPlayer`. Se a
   gravação falhar, o rodapé vira "Tentar salvar de novo". Arquivos:
   `components/player/tela-player.tsx`, `components/player/conclusao.tsx`,
   `components/treinar/usar-sessao.ts` (a opção `navegar`).
3. **A Visão geral é um diálogo (`ux-heuristicas-03`).** Era: 5.700 px sem
   `role=dialog`, sem Esc, sem voltar do celular, com uma saída de 44 px no
   topo e um rodapé que só oferecia as duas saídas que terminam a sessão. É:
   `role="dialog"` + `aria-modal`, Escape e `popstate` fecham, o foco volta ao
   botão que a abriu e "Voltar ao treino" está repetido no rodapé fixo.
   Arquivos: `components/treinar/visao-geral.tsx`,
   `components/player/tela-player.tsx`, `components/player/exercicio.tsx`.
4. **A pergunta chega sem resposta (`ux-heuristicas-09/-10/-11`).** Era:
   "Firme" com `aria-checked="true"` sem ninguém tocar, e o toque avançava
   rápido demais para o marcado aparecer. É: escolha começa em `null`, o
   palpite vira dica em texto ("Pelas repetições, parece que saiu firme."), o
   primário se chama "Pular esta pergunta" enquanto ninguém responde e o
   avanço espera 350 ms. O feedback ganhou "(opcional)", o que a resposta faz
   e o primário "Concluir sem responder"; o peso da conclusão diz "(opcional)
   Entra no gráfico de peso e no IMC da aba Corpo." Arquivos:
   `components/player/firme.tsx`, `components/player/feedback.tsx`,
   `components/player/conclusao.tsx`.
5. **Opções com cor própria (`tela-treino-player-30`).** Era: `bg-background`
   — no tema claro, exatamente a cor da página (1,00:1), com uma borda de
   1,15:1 como única pista. É: `bg-card`, e o "Voltar" perdeu o tratamento
   idêntico ao das opções. Arquivos: `components/player/firme.tsx`,
   `components/player/feedback.tsx`.
6. **24 px entre gravar e perder (`tela-treino-player-10`).** Era: 8 px
   (`gap-2`) entre "Concluir série" e "Próximo passo", que pula sem gravar. É:
   `gap-6` (24 px) dos dois lados, setas nos 44 px padrão, ✓ com 56 px.
   Arquivo: `components/player/exercicio.tsx`.
7. **O fim do descanso anunciado (`a11y-02`, `ux-heuristicas-05/-07`,
   `tela-treino-player-05`).** Era: três `role="timer"` com `aria-live` off —
   o fim só existia no bipe, e o bipe é um interruptor. É: o número continua
   `role="timer"` e ao lado há um `role="status"` só-leitor que muda só em
   marcos (30 s, 10 s, fim); os botões de tempo dizem "−20 s" e "+20 s" em
   texto, com 56 px e nome acessível ("Tirar/Somar 20 segundos ao/do
   descanso"), na cor `--descanso-destaque`. Arquivos:
   `components/player/descanso.tsx`, `components/player/exercicio.tsx`.
8. **Hierarquia do descanso (`tela-treino-player-02/-03`).** Era: "Pular" era
   o botão mais forte da tela (branco cheio sobre o marrom) e o timer não
   tinha anel. É: "Pular descanso" em contorno
   (`border-descanso-foreground/40`) e o timer dentro do `AnelDeContagem`, com
   `fracaoRestante`. O `AnelDeContagem` ganhou `classeTrilho`/`classeArco`
   porque `--muted`/`--primary` não valem naquele fundo. Arquivos:
   `components/player/descanso.tsx`, `components/player/anel.tsx`.
9. **Três verbos (`ux-heuristicas-04`).** Era: um `LogOut` mudo, "Abandonar" e
   um par de ícones no cabeçalho. É: "Continuar depois" (com texto),
   "Descartar este treino", "Concluir" — e um botão só no cabeçalho,
   "Fechar". Arquivo: `components/treinar/visao-geral.tsx`.
10. **Gravar deixou de ser silencioso (`a11y-06`, `a11y-15`,
    `ux-heuristicas-08`, `copy-22/-23`).** Era: nenhum aviso, `progressbar`
    sem `aria-valuetext`, a única rota sem `h1`, nome acessível ("Concluir a
    série") diferente do texto ("Concluir série"), "NA BARRA" sozinho e duas
    grafias para a mesma posição ("Próximo 2/6" no descanso). É: um
    `role="status"` só-leitor com "Série 2 de 3 registrada: 5 repetições com
    7,5 kg na barra. Descanso de 2:30.", `aria-valuetext="exercício 2 de 6"`,
    um `h1` só-leitor, nome acessível igual ao texto, **"CARGA NA BARRA"** e
    "Aquecimento 2 de 2 · exercício 1 de 6" nas duas telas, com o caixa-alta
    por CSS. Arquivos: `components/player/exercicio.tsx`,
    `components/player/tela-player.tsx`, `components/player/descanso.tsx`.

**Provas**

- Portões verdes no HEAD do lote (lint · tsc · 1.359 testes de unidade ·
  build de produção · build:e2e · e2e · varredura).
- Capturas dos dois temas em
  `scratchpad/ultraloop/rodada-3/l5/capturas/construtor` (60 de 60) e
  comparador contra a base: **só** `28-player-exercicio`,
  `29-player-descanso` e `30-player-conclusao` mudaram — "nenhuma tela mudou
  fora do esperado".
- `lib/player.test.ts`: `avisoDoDescanso` — cala no meio, fala nos marcos de
  30 s e 10 s e no fim, e nunca promete um marco que não cabe no descanso
  (num descanso de 20 s ninguém ouve "faltam 30 segundos").
- `e2e/ultraloop-a-r3.spec.ts` (novo): o 2º toque no mesmo ponto não descarta;
  a conclusão grava ao entrar e a aba Treino não oferece retomar; Esc e o
  voltar fecham a Visão geral e devolvem o foco; nenhuma opção marcada antes
  do toque, nas duas telas; ≥ 24 px entre o ✓ e o "Próximo passo"; o `h1`, o
  `aria-valuetext` e o "CARGA NA BARRA"; o anel, os dois botões de 56 px e o
  "Pular descanso" em contorno.
- Testes antigos ajustados sem afrouxar: `e2e/treinar.spec.ts` (o descarte
  passa pelo `alertdialog`), `e2e/player.spec.ts` (a conclusão não reabre —
  voltar rodaria o motor duas vezes; a §22.1 continua cobrada), `e2e/v3.spec.ts`,
  `e2e/conquistas.spec.ts`, `e2e/ultraloop-a-r1.spec.ts`, `e2e/fixtures.ts`
  (nomes novos dos botões).

**Como testar no celular**

1. Comece o treino do dia. Na 1ª série, toque em **Concluir série** — o
   descanso abre com **anel**, com **−20 s** e **+20 s** e com **Pular
   descanso** em contorno. Com o VoiceOver/TalkBack ligado e o som do app
   desligado, o fim do descanso é falado.
2. Toque no ícone de lista (Visão geral). Aperte o **voltar** do aparelho: a
   lista fecha e o treino continua. No rodapé há **Voltar ao treino**,
   **Concluir**, **Continuar depois** e **Descartar este treino** — este
   último abre uma pergunta; toque duas vezes no mesmo lugar e nada é
   descartado.
3. Vá até o fim do treino. Em "Última repetição saiu firme?" **nenhuma opção
   está marcada** e o botão grande diz "Pular esta pergunta". Na conclusão, o
   alto já diz **"Treino salvo"** e o **Próximo** está fixo no rodapé — feche
   o app ali e volte: a aba Treino **não** oferece "Continuar".

**Deploy.** No ar em 21/09/2026 às 02:05 UTC, pelo PR #8 (main `2826972`).
Produção saiu de `dpl_8NHHgUvey1oBJCXj3CT5yp95YqLV` para o deploy de
`2826972`; `/versao` devolve
`28269724cf9b8b8d8b8daa496896e0b59d67bc83` (construído às 02:03:42Z) e o CSS
de `/login` foi de `57d136fb92e14898.css` para `220c01c1442d7833.css`.
Fumaça verde 9/9 na primeira execução útil, item a item: `/login` 200 com
"Treino do Terraço" e "Entrar", sem "Configure NEXT_PUBLIC_SUPABASE_URL" e
sem "é secreta" — ok; `/` → 307 para `/login` — ok; `/versao` igual ao sha de
main — ok; `/sw.js` 200 com `/~offline`, `figuras/` e o mesmo CSS do `/login`
— ok; `/manifest.webmanifest` 200 com "Treino do Terraço" — ok; `/~offline`
200 — ok; os 12 scripts `/_next/static` do `/login` → 200 — ok; marcador do
lote: o `/sw.js` lista o chunk novo do player
(`app/(app)/treinar/%5BsessionId%5D/page-1922983e9f6290b9.js`) — ok; e esse
chunk, baixado (200, 63.471 bytes), contém **"Descartar este treino"**,
**"Continuar depois"** e **"Pular esta pergunta"** — ok (o bundle escapa os
acentos, como em `Concluir s\xe9rie`, então os marcadores foram procurados sem
acento). A sonda opcional de Playwright a 360 px contra a URL pública não
rodou (o Chromium local não confia na CA do proxy de saída); a régua de 360 px,
44 px, contraste e foco já correu verde nas 30 telas no portão local.
**Rollback: não.**

### Rodada 3 — Lote 6 — Relatório: estrutura, números e conquistas (faixa B)

SPEC §22.6. Dez itens, todos na faixa B (`/home/user/wt-b`, portas 3110/54331).

**1. O Relatório em cinco seções dobráveis** (`components/relatorio/tela-relatorio.tsx`)
— era: um `<Tela>` só empilhando Totais, aviso, Números, Conquistas, Histórico,
sequências, Peso, IMC e a tela inteira de gráficos — **5.444 px** de rolagem, e
quem quisesse o Histórico rolava às cegas. É: cinco `<details>` — **Resumo**,
**Conquistas**, **Histórico**, **Corpo** e **Gráficos** —, cabeçalho `sticky`
com alvo de 44 px, estado lembrado em `localStorage` (`relatorio:secoes`) e
montagem preguiçosa (o conteúdo de uma seção fechada nunca é montado: a seção
Gráficos não pede consulta nem desenha Recharts enquanto ninguém a abrir).
Medido a 360 × 740: **1.211 px** de rolagem com a tela aberta como ela nasce
(Resumo aberto), contra 5.444.

**2. CLS 0,39/0,44 → 0,0016/0,0030** (`tela-relatorio.tsx`) — era: as ~10
leituras resolviam depois da primeira pintura e o **aviso de conquista** nascia
no alto da tela, empurrando 297 px de conteúdo já pintado para baixo (sozinho,
0,3155 de CLS). É: o aviso mora ao lado do assunto dele (entre o Resumo e a
seção Conquistas, fora da primeira dobra), cada seção reserva a própria caixa e
o esqueleto dos Números tem a forma dos Números (cabeçalho, seletor de período,
fileira de três, três linhas de detalhe, fileira de dois). Medido com
`PerformanceObserver('layout-shift')`: **0,0016 no escuro e 0,0030 no claro**.

**3 e 4. Conquistas em duas colunas, com progresso e separação**
(`components/relatorio/conquistas.tsx`) — era: `grid-cols-3` a 360 px (cartão de
~100 px, nome em três linhas, linhas de alturas diferentes) e um "7 de 26" solto
no cabeçalho. É: `grid-cols-2 sm:grid-cols-3`, cartão em
`grid-rows-[auto_1fr_auto]` com `line-clamp-2` no nome e `line-clamp-1` na
legenda (texto inteiro no `title` e no nome acessível, §22.3 item 11), barra
fina de progresso com `role="progressbar"` e dois grupos rotulados —
**Conquistadas** e **A conquistar**, cada um com a contagem.

**5. O aviso de conquista** (`components/relatorio/aviso-conquista.tsx`) — era:
uma linha por conquista nova, com descrição, sem limite, com a data sempre
visível (uma conquista de 1º de junho anunciada como novidade) e rotulada
"Conquistas", igual ao título da seção da mesma tela. É: `novas.slice(0, 3)` com
"e mais N conquistas · veja em Conquistas", **uma linha por conquista** (ícone,
nome, data), data **escondida quando é a de hoje**, `role="status"` na `<section>`
e o rótulo "Nova conquista" / "Novas conquistas".

**6. Rótulos que se contradiziam** (`tela-relatorio.tsx`,
`components/progresso/tela-progresso.tsx`) — era: "TREINOS / 51 / no total" no
topo e "6 no mês · 46 no total" no card de treinos, na mesma rolagem. É:
"SESSÕES / 51 / no total (força + cardio)" e "só força · 6 no mês · 46 de força
no total".

**7. Ladrilhos alinhados** (`components/relatorio/numeros.tsx`,
`components/ui/contador.tsx`) — cada contador é `grid-rows-[auto_1fr_auto]`
(rótulo, número, legenda colada no rodapé) e o ícone do rótulo subiu de 12 px
para 14 px (`size-3.5 shrink-0`). E nada recorta mais o rótulo na vertical: o
til de "SESSÕES" em versalete sobe acima da caixa de linha de 12 px, e o
`overflow: hidden` a cortava ("SESSOES"). Tirar o `overflow-hidden` do span de
FORA não resolveu — quem recortava era o `truncate` do span de DENTRO —, então
o de dentro passou a recortar só na horizontal (`overflow-x-clip` +
`overflow-y-visible` + `text-ellipsis`), mantendo o "…" de quem não cabe na
largura.

**8. Cabeçalho de seção com dois papéis separados** (`tela-relatorio.tsx`,
`numeros.tsx`) — era: título e frase de explicação na mesma linha (a 360 px a
frase comia metade da linha). É: contador curto ("7 de 26") na linha de base do
título e a explicação como subtítulo de 12 px `muted` na linha de baixo — e só
na seção **aberta**, para o cabeçalho recolhido ser uma linha de 56 px. O atalho
"Catálogo de exercícios" saiu de cima dos totais e foi para o fim da tela: o
Relatório começa pelos números.

**9. Sem sigla nem notação matemática** (`tela-progresso.tsx`, `numeros.tsx`,
`lib/formato.ts`) — "e1RM (Epley)" → "carga máxima estimada" (coluna
"Máx. estimada"); "Σ reps × kg, últimas 12 semanas" → "Soma de repetições ×
carga, nas últimas 12 semanas"; "Aderência (4 semanas)" → "Constância
(4 semanas)"; "reps × kg nas séries de trabalho" → "repetições × carga nas
séries de trabalho"; `${…} %` → `formatarPercentual()` ("78%", símbolo colado,
um formato só no app, com unitário em `lib/formato.test.ts`); "Treino B 1" →
"Treino B × 1" (e "Corrida × 1", na mesma lista); as linhas Força / Cardio /
Barra fixa viraram `grid-cols-[5.5rem_1fr]`, com o valor sempre no mesmo x.

**10. Legenda da faixa e cartão vazio de uma linha**
(`components/relatorio/historico.tsx`, `tela-progresso.tsx`) — a faixa da semana
ganhou "✓ feito · ○ a fazer · ● faltou · — descanso · hoje em destaque"; em
"Carga dos grandes" o exercício sem registro virou **uma linha** (nome + "sem
registro", 44 px) no lugar de um cartão de altura cheia com um vazio de gráfico
dentro.

**Provas.** Portões completos (lint, tsc, test, build, build:e2e, e2e,
varredura) pelo `portoes.sh`, logs em
`scratchpad/ultraloop/rodada-3/l6/logs`. Testes novos: `e2e/ultraloop-b-r3.spec.ts`
(10 casos — rolagem < 1.500 px, memória da seção, CLS < 0,1 nos dois temas,
duas colunas com linhas de mesma altura, o aviso de 3 linhas, rótulos que não se
contradizem, linha de base dos números, nenhuma sigla, legenda e cartão de uma
linha) e o bloco "porcentagem" em `lib/formato.test.ts`. Ajustados, sem
afrouxar: `e2e/v3.spec.ts`, `e2e/conquistas.spec.ts`, `e2e/relatorio.spec.ts`,
`e2e/retomada.spec.ts`, `e2e/auditoria-m5.spec.ts` (abrem a seção antes de
medir) e `e2e/fixtures.ts` (o ajudante `abrirSecaoDoRelatorio`). Capturas nos
dois temas em `scratchpad/ultraloop/rodada-3/l6/capturas/construtor`: mudaram só
`11-relatorio-topo`, `12-relatorio-numeros`, `13-relatorio-conquistas`,
`14-relatorio-historico` e `30-player-conclusao` — nenhuma tela fora da lista.

**Como testar no celular.** Abra `/relatorio`: a tela começa pelos três
acumulados ("SESSÕES · 51 · no total (força + cardio)") e pelos Números; os
outros quatro blocos são cabeçalhos de um toque. Abra "Conquistas": a barra de
progresso diz quantas faltam e os cartões vêm em duas colunas, separados entre
"Conquistadas" e "A conquistar". Feche o Resumo, saia da tela e volte: a
memória das seções é a sua. Abra "Histórico": a legenda da faixa está logo
abaixo dela. Abra "Gráficos": nada de sigla — "Constância (4 semanas)", "78%",
"carga máxima estimada" — e o exercício sem registro ocupa uma linha só.

#### Correção da auditoria do Lote 6 (21/09/2026)

Um auditor independente reprovou o lote por três defeitos — dois deles na
própria **instrumentação**, que é o pior tipo de portão verde: o que mede fica
cego e a rodada seguinte não vê a regressão.

1. **O til de "SESSÕES" continuava cortado** (`components/ui/contador.tsx`). O
   lote tirou o `overflow-hidden` do span de FORA (`[data-rotulo]`, 16 px de
   altura), mas quem recortava era o span de DENTRO: `truncate` traz
   `overflow: hidden` numa caixa de linha de 12 px (`text-micro`: 10 px ×
   1,2), e o acento do Õ em versalete mora acima dela. O `innerText` diz
   "SESSÕES" nos dois casos — por isso nenhum teste de texto pegava. Agora os
   **dois** spans recortam só na horizontal (`min-w-0` + `overflow-x-clip` +
   `overflow-y-visible`, com `text-ellipsis` no de dentro): o til pinta e o
   "…" de quem não cabe na largura fica. Tirar o recorte do span de FORA não
   era neutro, e essa foi a terceira passada do auditor: na fileira de
   Totais o ladrilho é uma **grade** (`grid-rows-[auto_1fr_auto]`), o span é
   um item de grade, e num item de grade o `min-width: auto` só vira 0
   quando o `overflow` do item não é `visible` — com os dois eixos `visible`
   o rótulo longo ia a 283 px dentro de um ladrilho de 95 px, sem "…", e o
   `documentElement.scrollWidth` subia de 360 para 427. Medido num Chromium
   isolado com o ladrilho em grade: `visible/visible` → 206 px e sem "…";
   `min-w-0` + `clip/visible` → 77 px, `encurtado: true` e `overflow-y`
   ainda `visible`.
   O teste que fecha isto (`e2e/ultraloop-b-r3.spec.ts`, §22.6-7) não é de
   texto e tem os dois lados: confere que nenhum `[data-rotulo]` — nem o
   span de fora, nem o de dentro — tem `overflow-y` diferente de `visible`,
   compara os PIXELS do rótulo com os do mesmo rótulo com o recorte forçado
   a `visible` (se algo cortasse o desenho, as duas fotos seriam
   diferentes) e, no caso NEGATIVO, injeta um rótulo longo em
   `[data-contador="Minutos"]` exigindo `scrollWidth > clientWidth`, largura
   dentro do ladrilho e `documentElement.scrollWidth === 360`.
2. **A régua visual ficou cega justamente nas telas do lote**
   (`scripts/capturas-ultraloop.ts`). Com a montagem preguiçosa, uma seção
   fechada nem existe no DOM: `rolarAte(region "Conquistas")` não achava nada
   e o `.catch(() => {})` engolia a falha, então `11-relatorio-topo`,
   `12-relatorio-numeros` e `13-relatorio-conquistas` saíam BYTE-IDÊNTICAS e
   `14-relatorio-historico` fotografava o rodapé. Agora cada tela do
   Relatório abre a SUA seção (`abrirRelatorioEm`, que ainda limpa
   `relatorio:secoes` para uma captura não vazar estado na seguinte),
   `rolarAte` não tem mais `catch` (a falha vai para o `indice.json` como
   `alcancada: false`) e o aviso do player é dispensado por
   `getByRole("status", …)`, o papel que o lote deu a ele — com `region` o
   "Ok" nunca era clicado.
3. **A varredura media só o Resumo** (`e2e/ultraloop-varredura.spec.ts`). Os
   cinco itens (rolagem lateral, alvo de 44 px, contraste AA, anel de foco,
   reduced-motion) deixaram de ver ~4/5 de `/relatorio` pelo mesmo motivo.
   `abrir()` agora chama `abrirTudo(page)`, genérico sobre
   `details[data-secao]`: vale para qualquer tela futura com conteúdo montado
   sob demanda.

Numa segunda passada o mesmo auditor achou mais um portão cego, do mesmo
feitio, e uma inconsistência de vocabulário:

4. **O "Σ" sobreviveu na folha de detalhe de uma conquista**
   (`lib/conquistas.ts`). A regra de volume dizia "Σ repetições × carga das
   séries de trabalho concluídas chega a 50.000 kg" — a um toque da grade que
   este lote refez. O teste §22.6-8 passava porque lia `body.textContent` com
   as folhas FECHADAS: a folha é um `Sheet` e o texto dela não está no
   documento enquanto ninguém a abre. A regra virou "**Soma de** repetições ×
   carga…", e agora dois testes fecham o buraco: um de unidade
   (`lib/conquistas.test.ts`) que varre `nome`, `descricao` e `regra` das **26**
   conquistas atrás de notação solta — o único jeito barato de cobrir todas —,
   e o e2e, que abre `[data-conquista="volume-50k"]`, espera o `role=dialog` e
   repete a medida sobre o texto do diálogo. O "×" fica de propósito: na tela
   ele lê "vezes", como em "4× por semana" e "Treino B × 1".
5. **"e1RM" saiu do app inteiro** (`lib/sessao.ts`,
   `components/exercicios/historico-exercicio.tsx`). O lote traduziu a sigla só
   em `/relatorio`, e o app passou a falar duas línguas para a mesma coisa: o
   gráfico dizia "carga máxima estimada" e "Máx. estimada", enquanto o card
   Recorde do histórico de um exercício dizia "e1RM (Epley)" e o recorde do
   resumo da sessão dizia "45 kg de e1RM". Agora são "Máx. estimada" e "45 kg
   de carga máxima estimada"; o discriminante interno `tipo: "e1rm"` fica (não
   é texto de tela) e `lib/sessao.test.ts` trava o texto do recorde.

E a SPEC §22.6 descrevia quatro coisas que a tela não fazia — descrição
errada é dívida igual a código errado, porque a próxima rodada audita contra
ela. Foram corrigidos: o item 2 (não existe `min-height` por seção; quem
reserva a altura é o esqueleto, que tem as medidas do conteúdo final), o
item 7 (a grade `grid-rows-[auto_1fr_auto]` vem do chamador, na fileira de
Totais; no `Contador` o que é fixo é a linha do rótulo, `h-4`), o item 8 (o
alcance real da tradução, incluindo a folha de detalhe) e o item 9 (a
legenda da faixa, que o texto descrevia por alto).

**Como testar no celular** (360 px): Relatório → "Conquistas" → toque em
qualquer cartão de volume ("10.000 kg" ou "50.000 kg"): a folha que sobe diz
"Como fecha: Soma de repetições × carga…", sem "Σ". Explorar → um exercício →
"Histórico": o card Recorde diz "Máx. estimada", não "e1RM (Epley)".

#### Correção da auditoria do Lote 6 — rodada 3 (21/09/2026)

A terceira auditoria reprovou o lote por dois defeitos, os dois visíveis na
tela que o dono elegeu como prioridade.

1. **"BARRA FIXA" saía "BARRA F…"** (`components/ui/contador.tsx`,
   `components/relatorio/tela-relatorio.tsx`). Pôr os Números dentro do
   `<details>` custou ~9 px por coluna — o ladrilho da fileira de três caiu de
   ~104 px (base publicada) para 95 px. Medido ao vivo a 360 px: a linha do
   rótulo tinha 73 px, o ícone de 14 px mais o `gap-1` levavam 18, sobravam
   **55 px para um texto de 62** — `scrollWidth 62 / clientWidth 55`, nos dois
   temas e também numa conta nova. O texto inteiro seguia no DOM (o leitor de
   tela lia "Barra fixa"), então o dano era só visual, e nenhum teste de texto
   o pegava. Os pixels voltaram em três lugares, todos medidos: o ladrilho usa
   `px-2` em vez de `px-2.5` (+4 px), o rótulo perdeu o `tracking-wide`
   (−2 px de texto, porque o custo é por letra e o rótulo mais comprido é
   quem mais paga) e o corpo de uma seção do Relatório usa `px-2` em vez de
   `px-3` (+2,7 px por coluna). São **64 px de linha para 60 px de texto**,
   4 px de folga onde faltavam 7. O grampo horizontal, o til de "SESSÕES" e
   as três bases alinhadas ficam como estavam — o que mudou foi a largura
   disponível, não a regra. Fecha um teste que MEDE: em `/relatorio`, com as
   cinco seções abertas, nenhum `[data-rotulo]` de rótulo real pode ter
   `scrollWidth > clientWidth` (o caso negativo, com um rótulo longo
   injetado, continua exigindo o contrário).

2. **A legenda da faixa explicava quatro glifos para cinco marcas, e um
   desenho valia duas coisas** (`components/relatorio/historico.tsx`,
   `components/ui/faixa-semana.tsx`, `lib/semana.ts`). Faltava "parcial" — que
   `montarGrade` emite de verdade quando a sessão do dia começou e não foi
   concluída — e, pior, o dia de HOJE ainda por fazer vinha como ponto
   **cheio** na cor primária: o mesmo desenho que a legenda ensinava para
   "faltou", no estado mais comum da tela (todo dia, até o treino sair).
   Agora: (a) a legenda sai de `LEGENDA_DA_FAIXA`, montada de
   `GLIFO_DA_MARCA` e `NOME_DA_MARCA`, ambos `Record<MarcaDoDia, …>` — uma
   marca nova quebra a compilação e entra na legenda no mesmo movimento —, e
   lê **"✓ feito · ◉ parcial · ○ a fazer · ● faltou · — descanso · hoje em
   destaque"**; (b) hoje por fazer é o mesmo **anel** dos outros dias por
   fazer, só que `border-primary`, e quem diz que o dia é hoje continua sendo
   o realce do ladrilho inteiro. O ponto cheio passa a ser de "faltou" e de
   mais ninguém. Cada marca leva `data-glifo` (no `<li>` o `data-marca` de
   hoje vira "hoje" e esconde o estado), três testes de unidade prendem a
   legenda ao conjunto `MarcaDoDia` e dois e2e medem o desenho — largura de
   borda e preenchimento —, não o texto.

**Como testar no celular** (360 px): Relatório → Resumo: "BARRA FIXA" aparece
inteiro no terceiro ladrilho dos Números, nos dois temas. Relatório →
"Histórico": a legenda embaixo da faixa cita seis coisas, "parcial" entre
elas, e o dia de hoje sem treino feito é um **anel** laranja, não uma bolinha
cheia — a bolinha cheia cinza é só dos dias que passaram em branco.

**Deploy.** No ar em 21/09/2026 às 06:41 UTC, pelo PR #9 (main `3c9864a`).
Produção saiu de `dpl_9Yp9Anq6C7YBMiLmCs6umXYmQRh5` para
`dpl_6jSLT4atYUX13YzAq8vST7URPYJj`; `/versao` devolve
`3c9864a73cd6ec405599b9f41f7a9c910b4e1faa` (construído às 06:40:23Z) e o CSS
de `/login` foi de `220c01c1442d7833.css` para `99b3cfc2eb0aa8b3.css`.
Fumaça verde 12/12 na primeira execução, item a item: `/login` 200 com
"Treino do Terraço" e "Entrar", sem "Configure NEXT_PUBLIC_SUPABASE_URL" e
sem "é secreta" — ok; `/` → 307 para `/login` — ok; `/versao` igual ao sha de
main — ok; `/sw.js` 200 (54.120 bytes) com `/~offline`, `figuras/` e o mesmo
CSS do `/login` — ok; `/manifest.webmanifest` 200 com "Treino do Terraço" —
ok; `/~offline` 200 — ok; os 12 scripts `/_next/static` do `/login` → 200 —
ok; marcador do lote: o `/sw.js` lista o chunk novo do Relatório
(`app/(app)/relatorio/page-cba3d6e954f0a519.js`) — ok; esse chunk, baixado
(200, 33.361 bytes), traz `Const\xe2ncia` e `carga m\xe1xima estimada` — ok
(o bundle escapa os acentos, então os marcadores foram procurados sem
acento); **"A conquistar"** e **"Conquistadas"** ficam no chunk compartilhado
`583-409c4bd3f534ac2f.js` (200, 41.287 bytes), que o `/sw.js` também
precacheia — ok; e **`e1RM` não aparece em nenhum** dos 74 chunks, nem no
HTML do `/login` nem no CSS — ok, que é a forma mais forte do marcador. A
sonda opcional de Playwright a 360 px contra a URL pública não rodou (o
Chromium local não confia na CA do proxy de saída); a régua de 360 px já
correu verde no portão local. Nenhuma migração de banco.
**Rollback: não.**


### Rodada 4 — Lote 7 — aba Treino: hierarquia e controle (faixa A)

Nove itens da auditoria da aba Treino (SPEC §22.7). Arquivos:
`components/treino/{tela-treino,cabecalho,fab-ajustar,lista,desafios,parte-do-corpo,cards,personalizar,retomada}.tsx`,
`components/mais/ajustes-do-treino.tsx`, `components/treinar/tela-treinar.tsx`,
`e2e/ultraloop-a-r4.spec.ts` (novo) e os specs que citavam os textos antigos.

**Era → é**

1. **Ajustar** (`fab-ajustar.tsx`, `cabecalho.tsx`, `tela-treino.tsx`) — era um
   FAB fixo que, com a lista rolada, ficava por cima do "Substituir" do 3º
   exercício (`elementFromPoint` devolvia o svg do FAB); é um botão de 44 px no
   **cabeçalho**, ao lado da data. A folha é a mesma. Com a retomada pendente
   ele continua saindo da tela (§18.3). O `pb-24` da aba saiu.
2. **Faixa fixa do dia** (`cabecalho.tsx`, `tela-treino.tsx`) — o caminho para o
   treino de hoje existia só no topo de 2.555 px de rolagem; agora, quando o
   card sai da tela, uma faixa fina no alto repete "Treino A · 0/17 séries ·
   Continuar" (ou o foco do treino + "Começar"). `IntersectionObserver` numa
   sentinela abaixo do card; as linhas da lista ganharam `scroll-mt-14`.
3. **Folha Ajustar** (`ajustes-do-treino.tsx`, `fab-ajustar.tsx`) — tinha dois
   botões "Salvar" convivendo com interruptores que gravam sozinhos; agora os
   dois campos gravam no blur e 700 ms depois da última tecla, sem botão
   nenhum. Placeholder "do exercí…" → "—"; "Nenhum. Eles aparecem…" → "Nenhum
   por enquanto. Quando você marcar algum, ele passa a aparecer por último nas
   listas."; a folha abre com foco no título (não no campo), sem teclado.
4. **Ladrilhos Fase e Peso** (`cabecalho.tsx`) — "Fase 1 · semana 16" numa linha
   e "72,5 kg há 4 dias" noutra, com alturas diferentes; agora os dois têm
   rótulo / valor / legenda em linhas de altura fixa, ancorados ao topo.
5. **Lista de hoje** (`lista.tsx`) — o olho batia em "Hoje:" (fonte de número)
   antes do nome, que disputava a largura com os raios; agora o nome é
   `font-semibold` e sozinho na linha, os raios foram para o fim da prescrição
   e a fonte de número ficou só no valor da carga. O nome segue quebrando em
   até duas linhas (`line-clamp-2`): a 360 px cinco dos seis nomes do Treino A
   passam da largura, e cortar apagaria o que distingue os três
   "Desenvolvimento …" e os dois "Supino inclinado …" — no celular não há
   `title` para consultar.
6. **Desafios** (`desafios.tsx`) — três cards com o mesmo CTA e nenhum sinal de
   que eram três; agora o `<ul>` tem nome, há "1 de 3" e pontinhos, cada CTA diz
   o destino e o botão tem `mt-auto` (não pula mais entre os cards).
7. **Chips** (`parte-do-corpo.tsx`) — "Pernas", "Core" e "Cardio" ficavam fora da
   tela sem sinal; as duas fileiras ganharam degradê na borda, só do lado em
   que há conteúdo escondido.
8. **Verbos** (`parte-do-corpo.tsx`, `personalizar.tsx`, `tela-treinar.tsx`) —
   "Começar Peito" → "Começar o treino de peito"; "Começar Treino B" →
   "Começar o Treino B"; "Começar (3)" → "Começar com 3 exercícios".
9. **Voltar do player** (`retomada.tsx`, `cards.tsx`, `tela-treino.tsx`) — o
   voltar do celular jogava para a aba Treino sem explicação; agora avisa
   "Treino guardado — toque em Continuar para retomar." por 4 s e destaca
   **quem tem o "Continuar" daquela sessão**: o card "em andamento" quando a
   sessão aberta é a do dia, e o banner "Você tem um treino aberto de …"
   quando é outra (sessão livre, a de ontem, dia de cardio ou descanso).
   Nunca o card que começaria um treino novo — era o que a correção da
   segunda auditoria arrumou.

**A faixa fixa não rouba mais o toque** (terceira auditoria). Ela é `fixed` no
alto e a lista rola por baixo: num documento que rola inteiro não existe
espaçador que resolva isso — reservar a altura no topo só muda onde o conteúdo
começa, e do primeiro dedo em diante as linhas voltam a passar por baixo. Então
a faixa deixou de ser tocável fora do próprio botão: `pointer-events-none` no
contêiner (a propriedade é herdada, o cartão inteiro fica transparente ao dedo)
e `pointer-events-auto` só no "Continuar"/"Começar". Um "Substituir" ou uma
"Ficha" que pare debaixo dela continua sendo quem responde ao toque no próprio
lugar — fora do retângulo do "Continuar"/"Começar" da faixa, que é um alvo
visível e fica com os próprios pixels. Para o salto por âncora e para o foco pelo teclado, a folga vem do
`scroll-padding-top` de 56 px do documento (`app/globals.css`).

**Provas**: `e2e/ultraloop-a-r4.spec.ts` (12 testes, um por aceite: toque em
cada "Substituir" — centralizado **e** varrendo a aba de 40 em 40 px com a
faixa fixa à vista, exigindo `elementFromPoint` no próprio botão em toda
parada —, faixa fixa com e sem sessão, aviso ao voltar do player nos
dois caminhos — a sessão do dia e uma sessão livre —,
gravação sem "Salvar", ladrilhos na mesma base, nome em até duas linhas, posição do
carrossel, degradê das duas fileiras, verbo com objeto). Os specs antigos que
citavam os textos trocados foram atualizados sem afrouxar o que verificavam
(`v3`, `treino`, `treinar`, `player`, `ultraloop-a-r2`).

**Como testar no celular**

1. Na aba Treino, o **Ajustar** está no alto, ao lado da data. Role até o fim:
   surge a **faixa fina** com o treino do dia e um toque para continuar; toque
   em qualquer **⇄ Substituir** da lista que esteja fora da faixa — abre a
   folha do próprio exercício, sem nada por cima. Toque na faixa em qualquer
   lugar, inclusive em cima do nome "Treino A": ela **inteira** é o botão e
   sempre faz a mesma coisa que anuncia. A linha que ficar escondida debaixo
   dela volta com um dedo de rolagem.
2. Toque em **Ajustar**: a folha abre **sem o teclado subir**. Mude o
   "Descanso padrão" e feche a folha sem procurar botão nenhum — reabra e o
   número está lá.
3. Comece o treino e aperte o **voltar** do aparelho: aparece "Treino guardado
   — toque em Continuar para retomar." e o card do dia fica destacado. Repita
   começando pela **Parte do corpo em foco** ("Começar o treino de peito"): o
   destaque vai para a faixa "Você tem um treino aberto de …", que é onde está
   o "Continuar" dessa sessão; o card do dia segue oferecendo "Começar treino".


#### Correção da auditoria do Lote 7 — rodada 4 (21/09/2026)

A quinta auditoria reprovou a **faixa fixa do dia**. Ela tinha sido deixada
inerte (`pointer-events-none` no contêiner, toque só no "Continuar"), e a sonda
independente mediu o preço disso: varrendo a largura da faixa de 24 em 24 px a
cada 60 px de rolagem, **341 pontos** (iguais nos dois temas) devolviam, em
`document.elementFromPoint`, um elemento **fora** da faixa — 33 dos 40
primeiros eram `Ficha: …` de exercícios escondidos embaixo. Quem tocasse em
"Treino A · agachamento no centro" abria a ficha de um exercício que nem via, e
o alvo escondido podia ser o "Começar o treino de <grupo>", que **cria** uma
sessão.

É: a faixa **inteira** virou o controle, como a barra do tocador de um app de
música (`components/treino/cabecalho.tsx`). O `aside` recebe
`pointer-events-auto` (o contêiner segue inerte só para não capturar o vazio
dos lados no desktop) e dentro dele há **um único** `Link`/`button`, que ocupa
a largura e a altura da faixa; o "Continuar"/"Começar" continua aparecendo,
mas só como aparência (`aria-hidden`, `pointer-events-none`), e o nome
acessível do controle é "Continuar — Treino A, 0/17 séries". Altura igual à de
antes: 53 px.

A **SPEC §22.7 item 2** foi reescrita com o aceite honesto: em toda posição de
rolagem com a faixa à vista, `elementFromPoint` em qualquer ponto do retângulo
dela devolve um elemento dentro dela; em troca, o que para debaixo da faixa
fica coberto **enquanto está ali** — nenhum controle fica permanentemente
inalcançável, um dedo de rolagem revela a linha.

No `e2e/ultraloop-a-r4.spec.ts`: a varredura do item 1 foi **invertida** (ela
exigia o contrário) e agora cobra o toque próprio de todo "Substituir"/"Ficha"
**fora** do retângulo da faixa; entraram dois casos novos — a varredura da
faixa nos moldes da sonda do auditor (24 px na largura, 60 px de rolagem, três
alturas: mais de 200 pontos, nenhum fora) e um caso que fixa a faixa como
controle único (um só `a`/`button`, largura inteira, ≥ 44 px, nome começando
com o verbo, e o toque **no nome do treino** levando ao player).

Junto, um menor da mesma auditoria: o `title={item.nome}` saiu do nome do
exercício na lista (`components/treino/lista.tsx`) — ele contradizia o próprio
comentário e a §22.7 item 5, que dizem que no celular não há `title` para
consultar. Esta branch também recebeu a **main publicada** (L6, L8 e L9) por
merge, resolvendo SPEC.md e PROGRESSO.md com os dois lados. Nenhuma migração de
banco, nenhuma dependência nova.

**Deploy (rodada 7, 21/09 12:11 UTC).** Publicado. Deployment anterior
`dpl_2eyW1Nm8SL3agTdRyptPnkXGqVbW` → novo `dpl_DzidCCiyUk1eNNkPaHXYVsS74VWB`;
`main` passou de `2e8b2e2` para `d696b3317da7585fd65298befc095c87e7c52576`
(PR #13) e `/versao` devolveu esse sha às 12:11:35, ~2,5 min depois do merge.
O merge na integração entrou **sem conflito** (a branch já tinha trazido a
`main` `2e8b2e2`) e a árvore ficou byte a byte igual à de `14ad203`, a que
passou nos portões — lint e `tsc` reconferidos no tree de integração, e2e não
repetido. Fumaça em produção **20 de 20, duas execuções seguidas** (12:12 e
12:13, 40 s de intervalo), item a item: `/login` 200 · com "Treino do Terraço"
· com "Entrar" · sem "Configure NEXT_PUBLIC_SUPABASE_URL" · sem "é secreta" ·
`/` → 307 para `/login` · `/versao` == sha do merge · `/sw.js` 200 (54.417 b) ·
com `/~offline` · com `figuras/` · com o mesmo CSS do HTML de `/login`
(`301bf89aee08a5c8`) · `/manifest.webmanifest` 200 com "Treino do Terraço" ·
`/~offline` 200 · os 14 scripts `/_next/static` de `/login` 200 · marcador: o
`/sw.js` lista `app/(app)/page-346b446c29f32d9a.js` · esse chunk 200 (74.467 b)
· contém `data-faixa-do-dia` · contém "Treino de hoje" · o CSS de `/login`
contém `:root:has([data-faixa-do-dia])` · contém `scroll-padding-top`.
Capturas: só `03-treino-topo` e `04-treino-lista` mudaram (46,65 % / 45,09 % e
29,50 % / 28,97 % nos dois temas); as outras 28 telas ficaram em 0,00 %.
Nenhuma migração de banco. **Rollback: não.**

### Fila (o que não coube) — lista para as próximas rodadas

**Fonte única desde 23/09: `docs/ultraloop/fila.json` (ledger versão 3).** Cada item tem id estável, seção (B, C, D), estado, área, detalhe com PROBLEMA / FAZER / ACEITE / ESTADO medido no código, arquivos, esforço e **todas as origens** (fila antiga, fila-agrupada, lotes-r5/r6, PROGRESSO, análise). Publicado exige prova (arquivo:linha ou teste) e sha do merge; descartado exige motivo individual. A reconciliação que chegou aqui está em `docs/ultraloop/reconciliacao-fila.md`; o censo dos 227 achados da análise, em `docs/ultraloop/censo-analise.json`; a triagem dos descartes de planejamento, em `docs/ultraloop/triagem-descartes-planejamento.json`; as decisões que só o dono pode tomar, em `docs/ultraloop/perguntas-ao-dono.md`.

**O que a reconciliação corrigiu na lista antiga (texto de 21/09, abaixo substituído):** o L7 aparecia como pendente e está publicado (PR #13); C tinha 63 numa fonte e 64 noutra (o 64º é o R9-C1, que também estava em D — agora uma entrada só); os seis itens de D não estavam no JSON; `lotes_propostos_ordem` começava por lotes já publicados; os dez itens do antigo "L12 superfícies" já estavam publicados pelos lotes 3 e 4 (com prova); 46 achados da remontagem das superfícies e 27 achados da análise nunca tinham entrado na fila — entraram; o nome L12 passou a ser o lote de Explorar e catálogo.

**Contagens em 2026-09-23T23:41Z:**

| seção | pendente | publicado | descartado |
| --- | ---: | ---: | ---: |
| B | 74 | 39 | 17 |
| C | 71 | 10 | 0 |
| D | 5 | 0 | 0 |
| legado | 0 | 77 | 1 |
| **total** | **150** | **126** | **18** |

Dos descartados, **7 dependem de decisão do dono** e voltam à fila se a resposta for sim (atualização do app com aviso, uso do laranja, Relatório somado no banco, destaque do Explorar, filtros Core/Cardio, faixa da semana com sete destinos, resumo curto dos planos) — perguntas em `docs/ultraloop/perguntas-ao-dono.md`.

**A. (publicado)** O lote 7 — aba Treino entrou em produção na rodada 7 (`d696b33`). **L12 (publicado)** Explorar e catálogo, rodada 11 (`1b37092`, PR #19). **L13 (publicado)** Ficha: mídia e interação; coleções do Explorar, rodada 13 (`a0bcfcf`, PR #21): os 10 itens foram para resolvidos; três observações não feitas entraram em C como pendentes (`C-l13-aceite-lcp-vs-ordem`, `C-plano-progresso-repete-desafio`, `C-busca-corda-capa-icone`) e o H1 → H3 da ficha ficou como nota no `tela-explorar-fichas-21` (L14), que já o cobre. **L14 (publicado)** Ficha: conteúdo e ações; nomes do catálogo e créditos, rodada 16 (`0f730c9`, PR #23): os 10 itens foram para resolvidos (`copy-25` e `tela-explorar-fichas-26` com o aceite ajustado na SPEC §22.14, com nota), e o `C-visao-geral-esc-camada` do L29, que o L14 resolveu na rodada 15, também. 15 itens C novos, todos com lote: os 9 menores da auditoria 1 em `a68ea7f`, 4 menores só registrados pelo construtor e os 2 itens novos declarados na SPEC §22.14 item 6 (`a11y-voltar-fecha-camada`, `a11y-visao-geral-foco-ao-abrir`). Vão para o L32 (fica com 10), o **L33** novo logo depois do L32 (6), o L29, o L16, o L28 e o L30.

**Plano dos lotes restantes** (ordem do dono: ficha, Corpo, casca/superfícies, C por área, D por último; regra de lote: 6–10 itens, até 3 médios, até 12 arquivos, uma área — exceção só com motivo escrito —, até 6 telas):

| lote | título | itens | ids |
| --- | --- | ---: | --- |
| L35 | Lembretes II: horário, disparo automático e calendário | 10 | LEM-horarios, LEM-regra-mensagem, LEM-disparo, LEM-ics, LEM-guia-spec-l34, LEM-painel-estado, C-l34-badge-monocromatico, C-l34-passo3-instrucoes-reverso, C-l34-sair-e-inscricao, C-l34-ativar-releitura-falha |
| L36 | Sobras do L34: lembretes (provas, textos e bordas) | 7 | C-l34-notificationclick-sem-aba, C-l34-rls-postgres-real, C-l34-e2e-volta-dois-temas, C-l34-spec-volta-permissao-e-sem-internet, C-l34-aviso-lista-internet-volta, C-l34-comentario-rota-teste, C-l34-progresso-frase-mutacao |
| L32 | Sobras das auditorias: ficha e coleções do Explorar | 10 | C-l13-key-musculos-sem-teste, C-media-grande-figura-quebrou-herdada, C-alt-execucao-genero, C-l13-aceite-lcp-vs-ordem, C-busca-linha-reservada-vazia, C-busca-corda-capa-icone, C-plano-progresso-repete-desafio, C-plano-lista-canto-reto, C-l14-inventario-ficha-folha-como-abre, C-l14-tag-equipamento-sem-sinal-visual |
| L33 | Sobras do L14: ficha, catálogo e camadas modais | 6 | C-l14-super-band-dois-filtros, C-l14-criterio-repeticao-numeros, C-l14-nada-repetido-espelho-dom, C-l14-historico-carregando-perfil, C-l14-veu-ramo-morto, a11y-voltar-fecha-camada |
| L15 | Corpo: peso, gráficos e campo de data | 6 | a11y-01, tela-relatorio-corpo-calendario-12, tela-relatorio-corpo-calendario-14, tela-relatorio-corpo-calendario-19, tela-relatorio-corpo-calendario-13, tela-relatorio-corpo-calendario-11 |
| L16 | Corpo: medidas, fotos, data no celular e um verbo só para salvar | 7 | tela-relatorio-corpo-calendario-17, tela-relatorio-corpo-calendario-18, tela-relatorio-corpo-calendario-16, a11y-14, D-input-date-pt-br, copy-28, C-l14-aviso-cobre-x-da-foto |
| L17 | Casca: carregamento, rotas pesadas, zoom e bloco de sincronização | 6 | C-loading-por-rota, C-next-dynamic-rotas-pesadas, C-nav-inferior-zoom-200, a11y-16, visual-19, copy-17 |
| L18 | Cardio e barra fixa | 7 | ux-heuristicas-17, ux-heuristicas-18, ux-heuristicas-19, copy-11, copy-12, copy-30, copy-19 |
| L19 | Player: preparação e série; '%' colado nos textos | 6 | ux-heuristicas-12, tela-treino-player-09, copy-21, tela-treino-player-12, ux-heuristicas-22, OBS-porcentagem-com-espaco |
| L20 | Player: descanso, preparação e o caminho até o player | 8 | tela-treino-player-06, tela-treino-player-07, tela-treino-player-25, a11y-02, a11y-15, copy-22, performance-18, ux-heuristicas-06 |
| L21 | Player: firme, conclusão e Visão geral | 6 | tela-treino-player-29, tela-treino-player-27, ux-heuristicas-15, ux-heuristicas-14, ux-heuristicas-13, visual-08 |
| L22 | Sem rede: sinal, fila, mensagens e sincronização | 6 | pwa-offline-01, pwa-offline-06, pwa-offline-07, pwa-offline-11, pwa-offline-12, pwa-offline-13 |
| L23 | Instalação, cache de mídia e cor da barra | 6 | pwa-offline-03, pwa-offline-04, pwa-offline-05, imagens-09, pwa-offline-08, C-theme-color-do-tema-escolhido |
| L24 | Mais: textos, linhas e prefetch | 7 | copy-02, copy-09, copy-16, copy-20, copy-29, visual-16, performance-16 |
| L25 | Copy e mensagens: dia da semana, intervalo, perfil, backup e login | 8 | copy-07, copy-24, tela-relatorio-corpo-calendario-07, copy-04, ux-heuristicas-20, a11y-07, a11y-08, pwa-offline-02 |
| L26 | Relatório: números, aviso, esqueleto e leituras repetidas | 7 | C-relatorio-no-total-3-linhas, C-aviso-conquista-regiao-viva, C-esqueleto-grade3-morto, C-relatorio-legendas-antes-de-pronto, C-relatorio-sticky-scroll-margin, C-legenda-faixa-aria-hidden, performance-08 |
| L27 | Calendário: faixa, legenda e semana navegada | 7 | C-dois-vocabularios-da-marca, C-legenda-faixa-ponto-orfao, C-legenda-do-mes-sem-tipo-exaustivo, C-calendario-fase2-semana-mostrada, C-marcar-dia-antes-no-futuro, C-progresso-legenda-quatro-glifos, C-cardio-semana-navegada |
| L28 | Aba Treino: cabeçalho, faixa fixa e avisos | 7 | C-treino-h1-data-duas-linhas, C-faixa-fixa-texto-cortado, C-aviso-volta-do-player-gatilho, C-ajustar-sob-toast, C-desafios-largura-inerte, C-ajustes-gravacao-700ms, C-l14-recomecar-do-zero-foco-inicial |
| L29 | Player: pendências das auditorias do L5 | 8 | C-descanso-sinal-visivel, C-rotulo-do-campo-de-carga, C-alert-dialog-fundacao, C-firme-primario-pular, C-progresso-do-player-valuetext, C-l14-comentario-voltar-visao-geral, C-l14-spec-voltar-resumo-gravando, a11y-visao-geral-foco-ao-abrir |
| L30 | Processo, testes e documentação | 9 | C-capturas-rotulos-antigos, C-fab-ajustar-nomes-e-docs, C-teste-item5-nunca-falha, C-elevacao-sem-teste-da-faixa, C-regua-base-de-head-diferente, C-higiene-pids-construtor, C-portoes-hash-curto, C-l14-nomes-das-rodadas, C-l14-ordem-commits-spec-antes |
| L31 | D: medidas antes/depois, processo e scripts | 6 | R9-C1, D-abertura-11s-aparelho-zerado, D-sessao-concluida-reabre-player, D-e2e-sair-pela-tela, D-sw-em-qualquer-cache, C-comparar-capturas-esperadas |

### Rodada 5 — Lote 8 — Calendário e faixa da semana (faixa C)

SPEC §22.8. Dez itens na faixa C (`/home/user/wt-c`, portas 3130/54351), em
cima do L6 (a faixa da semana com "hoje por fazer" como anel e a legenda com
"parcial" — nada disso foi desfeito).

**1. "Fase 1 · semana 16 de 12" acabou** (`lib/semana.ts`,
`components/calendario/tela-calendario.tsx`) — era: `rotuloDaFase()` somava a
semana da fase sem olhar o total, e quem não passou para a Fase 2 na semana 12
lia um numerador maior que o denominador. É: da semana 13 em diante o rótulo
vira **"Fase 1 · 12 de 12 concluída"**, e `faseCumprida()` — a mesma regra,
uma função só — avisa a tela, que mostra ao lado do chip o botão **"Passar
para a Fase 2"** (leva a `/mais/perfil`, onde a troca acontece). Até a semana
12 nada muda ("Fase 1 · semana 3 de 12"). Prova: dois casos novos em
`lib/semana.test.ts` (um deles varre todo "N de M" do rótulo e cobra N ≤ M) e
o e2e `§22.8-1`, que varre o `innerText` da tela inteira atrás de qualquer
fração impossível.

**2. O mês virou navegável de verdade** (`components/calendario/grade.tsx`,
`tela-calendario.tsx`) — era: uma grade de `<span>`s que não respondia a
toque, com um título que prometia um mês inteiro e nenhuma seta. É: cada dia é
um `<button>` de 44 px de altura que abre o **mesmo `DialogoDia`** do cartão
da semana (a `DiaDaGrade` do dia sai de `montarGrade()` na hora do toque —
mesma fonte, sem segunda montagem) e leva a semana de cima para a semana
daquele dia; ‹ › de mês ao lado do título. Prova: e2e `§22.8-2` (toca 18/09 no
mês, confere o diálogo com o formulário de troca e vai e volta de agosto).

**3. A faixa dos sete dias rola em vez de vazar** (`components/ui/faixa-semana.tsx`)
— era: sete colunas `flex-1` com largura mínima de texto; a 200 % de zoom
(180 px efetivos) a faixa media **264 px** contra 180 e empurrava a página
inteira para o lado. É: a lista é um carrossel (`overflow-x-auto` + `snap-x`,
o mesmo padrão dos desafios) com `min-w-9` por dia — a 360 px as sete casas
continuam preenchendo a largura sem rolagem nenhuma; abaixo disso quem rola é
a faixa. No Calendário, o cabeçalho e a linha de navegação ganharam
`flex-wrap` pelo mesmo motivo. Prova: e2e `§22.8-3` mede `/` e `/calendario` a
180 px (nenhum elemento do `main` passa da largura; em `/calendario` a rolagem
da página também é 0), confere que a faixa rola sozinha ali e que a 360 px ela
não rola. **Fica na fila**: a 180 px duas coisas `position: fixed` e de fora
deste lote ainda passam da tela em `/` — a barra de 5 abas
(`components/nav-inferior.tsx`, 26 px) e o botão flutuante da aba Treino.

**4. Um marcador, uma caixa** (`components/ui/faixa-semana.tsx`) — era: "feito"
e "parcial" pintavam 24 px, "faltou"/"a fazer" 10 px e "descanso" um traço de
12 × 2 — sete marcadores, sete pesos. É: todos ocupam **20 × 20** e só o
miolo muda (disco cheio com ✓ de 12 px; anel de 20 px com miolo de 8 px; anel
de 10 px, na cor primária quando é hoje; disco de 10 px; traço de 10 × 2).
Nenhum desenho trocou de significado. Prova: e2e `§22.8-4` mede os sete
`[data-glifo]` (largura, altura e topo iguais).

**5. "Hoje" também para quem não vê a cor** (`grade.tsx`) — era: o dia corrente
do mês só existia como `bg-primary/15` (falha WCAG 1.4.1) e sumia no leitor de
tela. É: `aria-current="date"` e a palavra "hoje" no nome acessível da casa.
O `<span class="sr-only">` pedido no item foi trocado pelo nome acessível de
propósito: texto `sr-only` entra no `getByText` da página como texto comum —
é o motivo registrado na §22.3 item 11, e a faixa da semana já resolve assim.
Prova: e2e `§22.8-5`.

**6. Legenda do mês, e forma antes de cor** (`grade.tsx`) — era: a marcação do
dia era um ponto de 6 px que mudava só de tom (primária, `foreground/40`,
`destructive/60`) e não tinha legenda nenhuma. É: uma legenda de uma linha sob
a grade, desenhada com o **mesmo** componente `GlifoDoMes` da grade (não um
texto à mão que possa passar a mentir): ● feito · ◉ parcial · ○ força a fazer
· ◇ cardio a fazer · ✕ perdido. Feito × planejado agora diferem por **forma**
(disco cheio × anel), força × cardio por forma (círculo × losango) e o dia
perdido é um ✕. Prova: e2e `§22.8-6` (a legenda inteira e o desenho medido:
o feito tem preenchimento e borda 0, o planejado tem borda e fundo
transparente).

**7. "0 perdidos" não é notícia** (`tela-calendario.tsx`) — era: "1 feito ·
3 a fazer · 0 perdidos" mesmo na semana perfeita. É: o trecho só aparece
quando há algum, e os três números ganharam uma barra de três segmentos
(feito / a fazer / perdido) logo abaixo da navegação. Prova: e2e `§22.8-7`
(a semana que ainda não começou lê exatamente "0 feitos · 5 a fazer").

**8. A semana mostrada entre as setas** (`tela-calendario.tsx`) — era: o
intervalo era o subtítulo da tela, longe dos ‹ › que o mudam, e o "Hoje"
ocupava a largura inteira mesmo já estando nela. É: "14/09 – 20/09" entre as
setas e um "Hoje" pequeno que **só aparece quando a semana na tela não é a
atual**. Prova: e2e `§22.8-8` (geometria: o intervalo está entre os dois
botões; o "Hoje" some e volta).

**9. "Não vou treinar hoje" presa ao dia** (`tela-calendario.tsx`) — era: a
ação flutuava depois da grade, sem nada dizendo a que dia ela se aplica. É:
logo abaixo da grade, separada por um divisor e pelo rótulo **"Se hoje
(16/09) não rolar"**, com a data de hoje escrita. Prova: e2e `§22.8-9`.

**10. Hierarquia do mês e cartões do mesmo tamanho** (`grade.tsx`) — era: o
mês era um rótulo `text-xs uppercase` e os cartões da semana variavam de
altura conforme o detalhe cabia em uma ou duas linhas. É: o mês é um título de
seção (`text-base font-semibold`, sem versalete), a linha da semana mostrada
ganha realce dentro da grade, e o rótulo e o detalhe do cartão têm
`line-clamp-1` com `min-h-9` na coluna de texto — os sete ficam idênticos e o
texto inteiro continua no `title` e no `DialogoDia`. Prova: e2e `§22.8-10`
(as sete alturas são o mesmo número; o `h2` mede 16 px e `text-transform:
none`).

**11. Antes do começo do programa não existe falta** (`lib/semana.ts`,
`grade.tsx`, `faixa-semana.tsx`, `tela-calendario.tsx`) — **correção da
auditoria deste lote**. Era: `marcarDia()` não conhecia
`profiles.data_inicio`, então todo dia planejado anterior ao começo do
programa e sem sessão virava "faltou"; com o item 6 acima isso deixou de ser
um ponto quase invisível e virou ✕ vermelho na grade do mês — dez deles em
setembro para o perfil que começou em 14/09 (31/08, 01, 02, 04, 05, 07, 08,
09, 11 e 12/09), com o nome acessível repetindo "faltou". É: a marca nova
**"antes"**, devolvida por `marcarDia()` para todo dia anterior a
`data_inicio` sem sessão gravada; ela não desenha nada (grade do mês, faixa
da semana e coluna do símbolo), diz "antes do começo" no nome acessível e sai
da contagem da semana — numa semana inteiramente anterior ao começo a linha
"N feitos · N a fazer · N perdidos" some. `MarcaVisivel`
(`Exclude<MarcaDoDia, "antes">`) segura o contrato da legenda (§22.6 item 9):
"antes" é a única marca fora dela, e qualquer outra nova continua quebrando a
compilação. Sessão gravada antes do começo continua "feito". Prova: e2e
`§22.8-11` (o mês de setembro tem exatamente dois `[aria-label*="faltou"]`,
14/09 e 15/09; 05/09 lê "05/09: antes do começo" e não desenha nada; a semana
de 07/09 não tem marca nem contagem) e `lib/semana.test.ts` ("o começo do
programa (SPEC §22.8 item 11)", quatro casos, incluindo o perfil sem
`data_inicio`, em que a regra antiga continua valendo).

**Como testar no celular** (360 px): Calendário → o topo lê "Calendário" e
"Fase 1 · semana 1 de 12"; a linha seguinte é "‹ 14/09 – 20/09 ›" e o "Hoje"
só aparece depois de tocar em ›. Abaixo, a barrinha de três segmentos com "0
feitos · 3 a fazer · 2 perdidos" (na semana que vem, sem a palavra
"perdidos"). Os sete cartões têm a mesma altura. Depois da grade, o divisor
com "Se hoje (16/09) não rolar" e o botão. No mês, toque em qualquer dia —
abre a mesma folha do cartão da semana —, as setas ‹ › trocam de mês, o dia de
hoje está marcado e a legenda embaixo explica os cinco desenhos. Nenhum dia
anterior ao começo do programa (o 14/09 do perfil) tem ✕: toque em 05/09 e o
leitor de tela lê "05/09: antes do começo"; ‹ na semana volta para 07/09 –
13/09, que fica sem marca nenhuma e sem a linha de contagem. Com o zoom do
navegador em 200 %, o Calendário não rola mais para o lado e a faixa dos sete
dias rola sozinha (na aba Treino ainda sobra a barra de abas do rodapé, que é
de outro lote).

**Deploy.** No ar em 21/09/2026 às 08:37 UTC, pelo PR #10 (main `9d2c001`).
Produção saiu de `dpl_6jSLT4atYUX13YzAq8vST7URPYJj` para
`dpl_Am2hPSTMigcpbZWkVgn1Fd3WEEXc`; `/versao` devolve
`9d2c0013e7e07b5f9eb50c5f9f07e4f2e96a2d70` (construído às 08:36:01Z) e o CSS
de `/login` foi de `99b3cfc2eb0aa8b3.css` para `8ffaaaf63ec77165.css`.
Fumaça verde **18/18 na primeira execução**, item a item: `/login` 200 — ok;
contém "Treino do Terraço" — ok; contém "Entrar" — ok; **não** contém
"Configure NEXT_PUBLIC_SUPABASE_URL" — ok; **não** contém "é secreta" — ok;
`/` → 307 para `/login` — ok; `/versao` igual ao sha do merge em main — ok;
`/sw.js` 200 (54.192 bytes) — ok; com `/~offline` — ok; com `figuras/` — ok;
com o **mesmo** CSS do HTML de `/login` (`8ffaaaf63ec77165.css`) — ok;
`/manifest.webmanifest` 200 com "Treino do Terraço" — ok; `/~offline` 200 —
ok; os 12 scripts `/_next/static` do `/login` → 200 — ok (12 conferidos, 0
fora de 200). Marcadores do lote: o `/sw.js` lista o chunk novo do Calendário
(`app/(app)/calendario/page-8e598b96822ac760.js`) — ok; esse chunk, baixado
(200, 22.753 bytes), contém **"Passar para a Fase 2"** — ok — e **"cardio a
fazer"** — ok (o bundle escapa os acentos, então os marcadores foram
procurados sem acento). A sonda opcional de Playwright a 360 px contra a URL
pública não rodou (o Chromium local não confia na CA do proxy de saída); a
régua de 360 px correu verde no portão local (varredura 5 passed). Nenhuma
migração de banco. **Rollback: não.**

### Rodada 5 — Lote 9 — Explorar e catálogo: achar o exercício (faixa B)

Branch `ultraloop/l9-explorar-catalogo`, a partir de `ultraloop/l6-relatorio-estrutura`.
SPEC §22.9. Dez itens; a régua de cada um está no aceite do próprio item.

1. **O catálogo saiu de dentro do Explorar** (`components/explorar/tela-explorar.tsx`,
   `components/exercicios/lista-exercicios.tsx`). **Era:** a vitrine despejava
   a `<ListaExercicios>` inteira abaixo das seções — os 81 exercícios, 81
   `<img>`, 78% de uma página de 8.922 px (doze telas de celular). **É:** uma
   **prévia de 12** (`PREVIA_DO_CATALOGO`) e o botão **"Ver os 81 exercícios"**
   levando a `/exercicios`; a `ListaExercicios` ganhou a prop `limite`, que
   corta a lista e esconde busca, filtros e contador — numa prévia eles não
   têm o que controlar. A página fecha **abaixo de 4.000 px**, medido no e2e.
2. **O catálogo monta 20 de cada vez** (`components/exercicios/lista-exercicios.tsx`).
   **Era:** `/exercicios` montava os 81 cartões — e as 81 miniaturas — numa
   tacada. **É:** `POR_PAGINA = 20` e um **"Ver mais 20 de 81"** que
   acrescenta outros 20. A contagem da tela ("81 exercícios", "40 de 81
   exercícios") continua dizendo o total **achado**, não o que está montado —
   é ela que os testes de filtro leem. Trocar a busca ou um filtro volta
   sozinho para os 20 primeiros, sem `useEffect`: o estado guarda a chave dos
   filtros que valiam quando o "Ver mais" foi tocado.
3. **A busca mostra o exercício primeiro** (`components/explorar/tela-explorar.tsx`).
   **Era:** com "supino", nove linhas de coleção na frente e o exercício em
   y=860 — fora do viewport de 740. **É:** **Exercícios primeiro, Coleções
   depois**, cada bloco com a sua contagem no título, e — quando os dois
   blocos existem (item 10) — um seletor de uma linha no topo ("Exercícios
   (6) · Coleções (9)") que pula para o bloco. O e2e mede a caixa do primeiro
   exercício a 360×740.
4. **Um vazio só, citando o termo** (`tela-explorar.tsx`, `lista-exercicios.tsx`).
   **Era:** busca sem resultado mostrava **dois** vazios empilhados, e o
   segundo — "Nenhum exercício com esses filtros" — mentia: não havia filtro
   nenhum. **É:** *Nada para «zzzz»* com **"Limpar busca"**, um só; a
   mensagem de filtro do catálogo só aparece quando `temFiltro(filtros)` é
   verdade ali dentro.
5. **Chegar por uma busca mostra resultado, não controle** (`lista-exercicios.tsx`).
   **Era:** o catálogo alimentado pela busca do Explorar abria com três
   selects e o botão "No meu programa" na frente dos resultados. **É:** com
   busca vinda de fora e não vazia, o bloco fica recolhido atrás do botão
   **"Filtros"**, que mostra em um selo quantos filtros estão ativos.
6. **`app/not-found.tsx`** (arquivo novo). **Era:** `/explorar/[tipo]/[valor]`
   e `/exercicios/[id]` chamavam `notFound()` e não havia página para receber
   — um atalho guardado na tela de início, ou um link velho depois de o PWA
   se atualizar, caía na tela crua do Next, em inglês e sem saída. **É:**
   *"Essa tela não existe mais."* em pt-BR, com **Voltar para Hoje**, **Ver o
   Explorar** e **Ver os exercícios**; a resposta continua sendo 404.
7. **Nenhuma capa repetida na mesma seção** (`lib/colecoes.ts`,
   `components/colecoes/linha-colecao.tsx`). **Era:** `montar()` dá a cada
   coleção a foto do primeiro exercício, e `supino-reto-com-barra-1.jpg` era a
   capa de quatro linhas da mesma tela (2 repetições em "Treinos do programa",
   4 em "Por aparelho"). **É:** cada seção da vitrine passa por
   `semCapasRepetidas()`, que dá à coleção a primeira foto **ainda não usada
   naquela seção**; sem nenhuma sobrando, a linha cai no **ícone do tipo**
   (halteres, chave, cronômetro, calendário, batimento) sobre um dos quatro
   tons do tema, escolhido por um hash do id. A coleção guardada não muda: a
   tela da coleção continua abrindo com a foto do primeiro exercício.
8. **Um degrau entre rótulo e seção** (`tela-explorar.tsx`). **Era:**
   "Escolhas para você" em 16 px semibold, igual aos títulos de seção logo
   abaixo, sem agrupar nada. **É:** overline de **11 px em caixa alta**, e os
   títulos de seção sobem para **16 px semibold com régua acima**.
9. **A rota da coleção é normalizada** (`lib/colecoes.ts`). **Era:**
   `hrefDaColecao` escrevia o id cru no segmento ("/explorar/grupo/Bíceps",
   com acento e maiúscula) e `colecaoDaRota` comparava texto cru: ida e volta
   divergiam. **É:** os dois lados passam por `segmentoDaColecao()`
   (minúscula, sem acento, espaço vira hífen) e a comparação é feita no
   segmento normalizado — os links antigos continuam abrindo. Um teste percorre
   **todas** as coleções: a URL que a vitrine gera volta na mesma coleção, e
   duas coleções nunca caem na mesma URL.
10. **O número do título é o da lista, e o seletor só aparece com dois blocos**
    (`tela-explorar.tsx`, `lista-exercicios.tsx`) — correção da auditoria.
    **Era:** (a) o `<p>` do seletor desenhava sempre os dois âncoras enquanto
    cada bloco só é montado com contagem > 0; buscar "tatame" (0 exercícios,
    2 coleções) deixava «Exercícios (0)» como link focável de 80×44 px para um
    id que não existia no documento — tocar não fazia nada, e com um bloco só
    o seletor não tinha escolha nenhuma a oferecer. (b) `quantosExercicios`
    era contado com o termo apenas, enquanto a `<ListaExercicios>` aplicava
    também o filtro recolhido atrás do botão "Filtros": buscar "supino" e
    escolher Grupo = Costas deixava na tela «Exercícios (6)», "0 de 81
    exercícios" e "Nenhum exercício com esses filtros" — e o 6 continuava
    mentindo na busca seguinte, porque o filtro sobrevivia à troca do termo.
    **É:** o seletor só é montado quando os **dois** blocos existem; os
    filtros moram no `TelaExplorar` e a `<ListaExercicios>` os recebe por prop
    (`filtros` + `aoMudarFiltros`, controlada só quando as duas vêm), então o
    número do título e a lista saem do mesmo `filtrarExercicios`. Com filtro
    ativo e zero achados o bloco fica de pé — é ele que carrega o "Limpar
    filtros" — e o vazio da busca inteira não aparece por cima; o contador
    "N de 81" some quando a busca vem do Explorar (o título logo acima já é o
    contador, e é ele que ganha `aria-live="polite"`). Apagar a busca solta os
    filtros — como já acontecia, porque a lista desmontava —, trocar só o
    termo os mantém.

**Fora dos arquivos do lote:** `lib/guia.ts` (uma linha — o caminho do guia
dizia "Explorar → Todos os exercícios", rótulo que saiu da tela; agora é
"Explorar → Exercícios") e `e2e/catalogo.spec.ts` (o teste do filtro "no meu
programa" conta os cartões; com a paginação ele abre a lista inteira no
"Ver mais 20" antes de contar — o que ele verifica não mudou).

**Provas:** `lib/colecoes.test.ts` ganhou 7 casos (normalização e ida e volta
de toda a vitrine, colisão de segmento, capas por seção);
`e2e/ultraloop-b-r5.spec.ts` tem 11 testes (os dois do item 10 afirmam que
todo `a[href^="#achados"]` visível tem destino no documento e que o número do
título é o da lista, com filtro e sem).

**Como testar no celular** (360 px):
- **Explorar**: a página acaba logo depois de "Exercícios" + "Ver os 81
  exercícios" — não tem mais catálogo dentro dela. Em "Por aparelho", nenhuma
  linha repete a foto da linha de cima.
- **Busca**: digite "supino" na barra do Explorar — os **exercícios** aparecem
  primeiro, sem rolar; digite "zzzz" — **uma** mensagem só, citando o termo.
  Digite "tatame": só coleções, e a linha "Exercícios (0) · Coleções (2)" não
  aparece mais. Com "supino", toque em "Filtros" e escolha Grupo = Costas: o
  título vira **Exercícios (0)** junto com o "Nenhum exercício com esses
  filtros" — nunca mais um número em cima e outro embaixo.
- **Catálogo**: em "Ver os 81 exercícios", role até o fim: há 20 cartões e um "Ver mais 20 de 81". Chegando pela busca, os filtros vêm recolhidos.
- **404**: abra `/exercicios/remada-curvada-com-barra` — a tela responde em
  português com as três saídas.

**Deploy.** No ar em 21/09/2026 às 10:01 UTC, pelo PR #11 (main `8830fe5`) —
**o último deploy da madrugada**. Produção saiu de
`dpl_Am2hPSTMigcpbZWkVgn1Fd3WEEXc` para `dpl_4GtXTGgY9LcUMCHhbLriBu3uP6gg`;
`/versao` devolve `8830fe53d170cf06d4b0c91116154d45a2b2270f` (construído às
09:59:56Z) e o CSS de `/login` foi de `8ffaaaf63ec77165.css` para
`28025654e892a608.css`. Fumaça verde **21/21, em duas execuções seguidas**,
item a item: `/login` 200 — ok; contém "Treino do Terraço" — ok; contém
"Entrar" — ok; **não** contém "Configure NEXT_PUBLIC_SUPABASE_URL" — ok;
**não** contém "é secreta" — ok; `/` → 307 para `/login` — ok; `/versao` igual
ao sha do merge em main — ok; `/sw.js` 200 (54.417 bytes) — ok; com
`/~offline` — ok; com `figuras/` — ok; com o **mesmo** CSS do HTML de `/login`
(`28025654e892a608.css`) — ok; `/manifest.webmanifest` 200 com "Treino do
Terraço" — ok; `/~offline` 200 — ok; os 14 scripts `/_next/static` do `/login`
→ 200 — ok (14 conferidos, 0 fora de 200). Marcadores do lote: o `/sw.js`
lista o chunk do 404 (`app/not-found-e3866b2d3fe0af9e.js`, 200, 233 bytes) e a
rota `/not-found` é **nova** — o `/sw.js` do deploy anterior não listava
nenhum `app/not-found-*.js` — ok; o `/sw.js` lista o chunk novo do Explorar
(`app/(app)/explorar/page-a203e7f3f86ed928.js`; o anterior era
`page-6eefbe762a193f3c.js`) — ok; esse chunk, baixado (200, 14.843 bytes),
contém **"Limpar busca"** — ok — e **"Exerc"** (o título "Exercícios (" tem o
acento escapado no bundle) — ok.

Um marcador da ficha do lote não pôde ser conferido como estava escrito: *"o
chunk `app/not-found-*.js` contém 'Voltar para Hoje'"*. Ele é **impossível por
construção**, não é falha de produção — `app/not-found.tsx` é Server
Component, então esse texto só existe no bundle do servidor. Provas: os 78
chunks do precache do `/sw.js` foram baixados e nenhum contém "Voltar para
Hoje" nem "Essa tela n"; o build local do mesmo HEAD (o que passou nos
portões) tem o mesmo chunk de 235 bytes, também sem o texto, que aparece só em
`.next/server/`; e a própria tela de 404 não é pública — `/rota-inexistente`
devolve 307 para `/login`, porque o middleware de autenticação vem antes. Foi
substituído pela prova equivalente e verificável acima (a rota `/not-found` é
nova em produção); quem cobre a redação do 404 é o e2e, com sessão. Nenhuma
migração de banco. **Rollback: não.**

**Linha de base regenerada.** `wt-base` avançou para `8830fe5` (o merge em
main), `build:e2e` com `MOCK_SUPABASE_PORT=54341` ("Compiled successfully in
13,3 s"), servidores de novo em 3120/54341, mock semeado com `max_contas: 50`
e **60/60 capturas** novas em `base/` (a antiga virou `base-r5`). O CSS
servido em `:3120/login` é `28025654e892a608.css` — o mesmo de produção. O
`indice.json` confirma os números do lote no HEAD publicado: `/explorar` com
**3.084 px** e `/exercicios` com **2.187 px** de altura.

### Rodada 8 — Sem conexão: socorro e retentativa

**O que o dono viu.** 21/09/2026, Brave no Android, WiFi ligado: fundo preto,
"Sem conexão" e a frase "O treino continua: …" — **sem ícone e sem botão
nenhum**. Não era a página `/~offline`: era o HTML de emergência embutido no
service worker, o único texto do app que existia sem saída.

**Por que ele aparece.** O socorro só é servido quando duas coisas acontecem
juntas: a navegação falhou na rede **e** `matchPrecache("/~offline")` devolveu
`undefined`. A segunda não é acidente raro — o próprio app a provoca: o "Sair"
apaga todos os caches menos o de mídia (`lib/db.ts`), inclusive o precache do
Serwist, que só é reposto na instalação seguinte. Entre um logout e a próxima
atualização do app, qualquer perda de rede levava ao beco. O servidor estava
sadio o tempo todo (`/login` 200, `/~offline` 200 com os dois botões, `/sw.js`
54 KB listando `/~offline`, zero erro de runtime na Vercel em 24 h), e os
`edge_logs` do Supabase não tinham nenhum `POST /auth/v1/token` no período —
nenhuma tentativa de login chegou a sair do aparelho, que é o que se espera de
um celular preso numa tela servida pelo worker.

**Medido em produção**, com Chromium a 360 px contra
`treino-terraco.vercel.app` (conta de teste criada pela própria tela "Criar
conta", dentro da cota da §21), cortando a rede DENTRO do worker
(`navigationPreload.disable()` + `self.fetch` rejeitando):

| cenário | o que veio |
| --- | --- |
| precache intacto, `/mais/contas` nunca visitada | `/~offline` inteira — ícone e os dois botões |
| precache intacto, cache `paginas` apagado, `/` e `/mais/creditos` | `/~offline` inteira |
| troca de tela por clique (RSC) sem rede | dois 503 "sem rede", o roteador recarrega e a `/~offline` aparece |
| **precache apagado** | **o socorro: `botoesELinks: 0`, `svgs: 0`** |
| rede de volta | a aba Treino inteira, `h1` "segunda, 21/09" |

Ou seja: **`matchPrecache` não tem defeito** — com o precache no lugar ele
sempre achou a página. O beco sem saída que o dono fotografou é o estado
"precache ausente", e a foto bate linha a linha com a última linha da tabela.
Por isso esta rodada mexe em duas coisas: tornar esse estado mais raro (a
escada e a autocura) e tornar a tela dele utilizável (os dois botões).

**O que mudou** (SPEC §22.10):

1. **O socorro virou tela.** O HTML saiu de dentro de `app/sw.ts` e virou
   `lib/sw-socorro.ts`, função pura com teste de unidade
   (`lib/sw-socorro.test.ts`, 8 casos). Mesmo título e mesma frase de antes,
   mais os **dois mesmos atos da `/~offline`**: "Tentar de novo"
   (`location.reload()`) e "Ir para o Treino" (`href="/"`), 48 px de altura e
   largura cheia. Dois temas por `prefers-color-scheme` com os tokens de
   `app/globals.css` (claro `rgb(224,224,221)` sobre `rgb(10,10,10)`, escuro o
   inverso), `viewport-fit=cover` com `env(safe-area-inset-*)`, `lang="pt-BR"`,
   ícone desenhado em SVG inline. **Nada vem de fora** — nem script, nem fonte,
   nem folha de estilo: é o HTML que tem de abrir com o aparelho vazio. 2,2 KB.
2. **Escada de fallback do documento**, em `semRede()`: (a) **mais uma ida à
   rede** com um pedido novo (`cache: "no-store"`, `credentials: "include"`,
   `redirect: "manual"`) — a queda de rede de um celular dura segundos, e a
   `NetworkFirst` desistia na primeira recusa; (b) o precache; (c)
   `caches.match("/~offline", { ignoreSearch, ignoreVary })` em **qualquer**
   cache; (d) o socorro. Degrau que falha é degrau que não existe: cada um vai
   num `try`, e o último sempre responde. Para o `fetch` de RSC continua o 503
   da §22.1 — é ele que faz o roteador recarregar a URL e cair no ramo do
   documento, mantendo o endereço que o usuário pediu.
3. **Autocura do precache.** No `activate`, se o precache não tiver a
   `/~offline`, o worker a busca (com prazo de 8 s, para não segurar a
   ativação) e guarda uma cópia num cache próprio, `socorro`, que o degrau (c)
   também consulta. Só guarda se a resposta for 200 e **não** redirecionada —
   guardar a tela de login como "sem conexão" seria pior do que não guardar
   nada. Idempotente e silencioso quando falha.
4. **O "Sair" poupa o cache `socorro`.** Pelo mesmo motivo que já poupava o de
   mídia: é página pública do app, sem nada do usuário — e apagá-la justamente
   no logout, que já leva o precache junto, devolveria o aparelho ao beco.

**Provas.** `e2e/sem-conexao.spec.ts` é o teste que faltava desde 20/09: ele
entra no service worker pelo `worker.evaluate` do Playwright, desliga o
navigation preload (que é o navegador quem dispara) e troca `self.fetch` por
uma função que rejeita — **é assim que se corta a rede de quem serve**, já que
`context.setOffline` e `context.route` só alcançam as requisições da página.
Com isso preso: uma rota nunca visitada (`/mais/contas`) dá "Sem conexão" com
os dois botões e vem mesmo do precache (a página do Next tem folha de estilo;
o socorro não tem nenhuma); o clique em "Ir para o Treino" passa pelo 503 do
RSC, recarrega e traz a aba Treino inteira do cache `paginas`; apagada **toda**
cópia da `/~offline` do aparelho, outra rota (`/mais/senha`) cai no socorro
embutido — e ele tem os dois botões, com 48 px de altura, sem rolagem lateral a
360 px; devolvida a rede ao worker, "Tentar de novo" traz a tela "Trocar
senha". O comentário de `e2e/auditoria-offline.spec.ts` que dizia que isso não
era possível foi corrigido; aquele teste continua como a lente barata de fora.

**Como testar no celular.** Com o app aberto, ligue o modo avião e toque numa
tela que você ainda não abriu nesta sessão (Mais → Contas, por exemplo): tem de
vir "Sem conexão" **com os dois botões**. Com a sessão aberta, "Ir para o
Treino" volta para a aba Treino com o que está guardado; se você tiver saído da
conta, ele leva a "/" e vem "Sem conexão" de novo — entrar exige rede, e é por
isso que o botão continua ali: assim que a rede voltar, ele abre o app.
Desligue o modo avião e "Tentar de novo" traz a tela pedida. O que você registrar sem rede continua indo para o IndexedDB e
subindo sozinho depois (SPEC §8).

**Se o celular ficar preso numa versão antiga do worker** (a tela de socorro
sem botões é justamente o sintoma): Brave ou Chrome → ⋮ → Configurações →
Configurações do site → `treino-terraco.vercel.app` → **Limpar e redefinir**;
depois feche a aba e abra o app de novo. Isso descarta o service worker velho e
o precache junto, e a próxima abertura com rede instala tudo outra vez.

**Portões (HEAD `0ab9cff`, 21/09 15:30–15:51 UTC):** lint ✓, tsc ✓, **1.386
unitários** em 55 arquivos ✓, build ✓, build:e2e ✓, **418 e2e** em 14,8 min ✓,
**5 de varredura** em 4,3 min ✓. O `public/sw.js` assado passou de 54 KB para
56.945 bytes e contém "Tentar de novo", "Ir para o Treino",
`rgb(224,224,221)`, `env(safe-area-inset-*)`, `location.reload`, o cache
`socorro` e o `ignoreVary` do degrau (c). **Capturas: 60 de 60 iguais à base**
(Δ 0,00 % em todas, limiar 0,5 %) — esta rodada mexe só no que o service
worker serve quando não há rede, e nenhuma tela do app mudou, nem a
`/~offline`, que não foi tocada. Motor e montagem intocados
(`git diff origin/main -- lib/progressao.ts lib/montagem.ts` vazio); nenhuma
migração de banco; nada de service role no cliente.

**Uma correção depois dos portões.** Ao renderizar o socorro a 360 px nos dois
temas, o "Tentar de novo" apareceu com contorno em vez de preenchido:
`.ato:first-of-type` e `.ato:last-of-type` casavam com os **dois** alvos —
um é `<button>` e o outro é `<a>`, e cada um é o primeiro *e* o último do seu
próprio tipo. Cada alvo passou a levar a sua classe, e o teste de unidade
prende as duas, o preenchimento do primeiro e a ausência dos dois seletores.
Medido no Chromium a 360 px, nos dois temas: alvos de **48 × 328 px**, fundo
`rgb(224,224,221)` no claro e `rgb(10,10,10)` no escuro, zero vazamento
lateral, 2.370 bytes. A cadeia de portões foi repetida inteira no HEAD final.

**Correção 2 — o que a auditoria das 16:22 UTC devolveu.** Três achados, todos
atendidos, e o principal era duro: a rodada tinha consertado o **sintoma** (a
tela do beco virou tela com saída) e descrito a **causa** sem removê-la.

1. **O "Sair" não leva mais o app junto.** `limparDadosLocais()` poupava o
   cache de mídia e o de socorro e apagava o precache do Serwist — 154 entradas
   medidas no Chromium, que é o app inteiro: shell, pedaços de JS e a própria
   `/~offline`. O Serwist só repõe o precache numa instalação nova, e o `sw.js`
   não muda de bytes sozinho: quem saísse da conta ficava sem PWA nenhum até o
   deploy seguinte. A regra passou a ser `ehCachePublico()`, em
   `lib/caches-do-worker.ts` — o único módulo que a página e o worker
   compartilham, porque o worker é um bundle à parte e não pode puxar o Dexie
   de `lib/db.ts`. Ficam o precache (`serwist-precache-*`), `midia-do-treino` e
   `socorro`, todos conteúdo público assado no build; vai embora tudo que é do
   usuário, inclusive o cache `paginas` com as telas autenticadas, que é o
   ponto da §8 (celular emprestado não pode mostrar o treino de ontem depois do
   logout).
2. **A autocura deixou de ser código inalcançável.** `curarOSocorro()` só
   rodava no `activate`, e ali o precache acabou de ser preenchido pelo
   `install`: a função saía no primeiro `if` sem guardar nada, e o cache
   `socorro` **nunca nascia** — a auditoria mediu o inventário de caches e ele
   não estava lá. Agora a decisão mora em `lib/sw-cura.ts` (ferramentas
   injetadas, 9 casos de unidade) e o worker mantém uma cópia **sua** da
   `/~offline`: na ativação ele a tira do precache recém-instalado, sem tocar
   na rede e em milissegundos (`renovar`, para a cópia ser sempre a do build
   novo), e depois de **cada navegação que chegou ao servidor** confere se ela
   ainda está lá — no `handlerDidComplete`, que roda com a tela já entregue,
   fora do caminho crítico. Se o precache sumiu (despejo do navegador,
   instalação pela metade), a reposição vem da rede, com prazo e com espera de
   60 s entre idas frustradas, para não insistir a cada toque.
3. **O e2e agora aperta o botão de verdade.** `e2e/sem-conexao.spec.ts` ganhou
   dois casos: um clica em **"Sair"** — o gatilho documentado, que o teste
   anterior nunca tocava — e lê `caches.keys()` dos dois lados, provando que o
   precache fica inteiro, que a cópia de socorro fica e que a aba Treino sai do
   cache `paginas`; depois corta a rede do worker e exige a `/~offline` **de
   verdade** (a do Next tem folha de estilo; o socorro embutido não tem
   nenhuma). O outro apaga toda cópia da `/~offline` **depois** da ativação e
   exige que a navegação seguinte reponha a cópia em `socorro` — é o caso que
   prende a autocura, e é o que teria pegado o código morto.

Junto foram os menores: a retentativa do degrau (a) ganhou prazo
(`AbortSignal.timeout`, 6 s) e a `NetworkFirst` das navegações ganhou
`networkTimeoutSeconds: 8`, para que rede que aceita a conexão e não responde
não segure a tela quando já há cópia no aparelho; o contorno do alvo secundário
do socorro subiu para 3,4:1 nos dois temas (WCAG 1.4.11 — era 1,3:1 no claro),
com o teste de unidade calculando a razão de contraste; e o prazo da cura na
ativação caiu de 8 s para 3 s, num caminho que no uso normal nem toca na rede.

**Como testar no celular (correção 2).** Entre no app com rede, vá em Mais →
**Sair**, ligue o modo avião e abra `treino-terraco.vercel.app`: tem de vir a
tela "Sem conexão" **com ícone e os dois botões** (é a `/~offline` do app, que
agora sobrevive ao logout) — antes vinha a tela sem ícone e sem botões da foto
de 21/09. Desligue o modo avião, entre de novo e confira que o treino de hoje
aparece igual.

**Deploy (rodada 8, 21/09 17:35 UTC).** Publicado. Deployment anterior
`dpl_DrVQwHNgEP6Uj5JLiAFYUiYKpQce` → novo `dpl_Aq8mLNXTUzZCdZERZJgkNX1U4Xcd`;
`main` passou de `739276d` para `1386cd07cf4cef4d7b5aa6f530acd5fb83821088`
(PR #15) e `/versao` devolveu esse sha às 17:35:11, ~2 min depois do merge. O
merge na integração entrou **sem conflito** (a branch nasceu de `739276d`) e a
árvore ficou igual à de `8d539e3`, a que passou na cadeia completa de portões —
lint e `tsc` reconferidos no tree de integração, e2e não repetido. Fumaça em
produção **20 de 20**, item a item: `/login` 200 · com "Treino do Terraço" ·
com "Entrar" · sem "Configure NEXT_PUBLIC_SUPABASE_URL" · sem "é secreta" ·
`/` → 307 para `/login` · `/versao` == sha do merge · `/sw.js` 200 · com
`/~offline` · com `figuras/` · com o mesmo CSS do HTML de `/login`
(`301bf89aee08a5c8`) · `/manifest.webmanifest` 200 com "Treino do Terraço" ·
`/~offline` 200 · os 14 scripts `/_next/static` de `/login` 200 · marcadores do
lote: `/sw.js` contém "Tentar de novo" e "Ir para o Treino" (o socorro novo),
contém o cache `socorro` e `networkTimeoutSeconds: 8`, e a `/~offline` servida
contém "Tentar de novo". Sonda a 360×740 (Chromium, duas execuções seguidas):
`/login` e `/~offline` sem erro de console e sem vazamento horizontal
(scrollWidth 360 = clientWidth), alvos de 328×48 px; e o **"Entrar" exercitado
com credencial falsa devolveu "E-mail ou senha incorretos."** — a ação de
servidor chega ao Supabase em produção. Capturas: nenhuma tela mudou (60 de 60
iguais à base, Δ 0,00 %), então a base não foi mexida. Nenhuma migração de
banco. **Rollback: não.**

*Nota de ambiente:* na primeira execução da fumaça três scripts e o `/` vieram
com código `000`/502 e `content-type: text/plain`. Era o proxy desta sessão,
não a produção: as mesmas URLs devolveram `200 application/javascript` em 12
idas seguidas, os 14 scripts passaram com repetição, e as duas execuções
seguintes da sonda em navegador não tiveram erro nenhum.

### Rodada 9 — aparelho despejado, campo de carga, sessão que chega e Sair local

A rodada 8 tirou a foto do dono do ar (o "Sair" não apaga mais o precache) e a
verificação dela em produção, num navegador de verdade, achou cinco coisas —
uma grave, três do dia a dia e um rótulo. SPEC §22.11.

1. **O socorro passou a ser autossuficiente.** Apagando TODO o Cache Storage
   (o que o navegador faz sozinho sob pressão de disco) e fazendo uma única
   navegação com rede, o aparelho ficava assim: precache do Serwist de volta
   com **zero** entradas — ele só enche no `install`, e o `sw.js` não muda de
   bytes fora de um deploy —, cache `socorro` com o HTML da `/~offline` reposto
   pela autocura, e os 14 pedaços de JS dessa página em cache nenhum. O degrau
   (c) servia o HTML, a hidratação morria em "Loading chunk 9954 failed" e a
   tela virava **"Application error: a client-side exception has occurred"**:
   sem ícone, sem botões, pior do que o socorro embutido — e assim até o deploy
   seguinte. Agora a regra é a mesma dos dois lados (`lib/sw-assets.ts`, pura e
   testada): a autocura só guarda a `/~offline` junto com **todos** os assets
   same-origin que o HTML dela referencia (`<script src>` e folha de estilo,
   no máximo 30, com prazo — um que falte invalida a cópia inteira, porque meia
   cópia é a tela quebrada), e o degrau (c) só serve a cópia quando todos eles
   estão em algum cache; senão desce para o socorro embutido (d), que não
   depende de nada. `jaTem()` passou a conferir a cópia inteira, então um asset
   despejado depois faz a navegação seguinte refazer a cópia.
2. **O campo de carga é do dedo de quem digita.** Digitando "12,5" depressa em
   CARGA NA BARRA, ao chegar em "12" o app ajustava para a anilha possível
   (11,5) e o efeito do `StepperNumerico` reescrevia o **texto** do campo no
   meio da digitação: as teclas "," e "5" caíam no texto novo e a tela mostrava
   "11,5,5". O valor gravado saía certo (o `onBlur` normaliza), mas o número
   impossível ficava no campo mais importante do player. Agora, com o campo
   focado, o efeito não reescreve nada — o ajuste chega no `blur` —, e a
   digitação recusa um segundo separador decimal (`lib/digitar-numero.ts`,
   `aceitarDigitacao`, com teste: ponto vira vírgula, vazio permitido, menos só
   onde o campo aceita negativo).
3. **"Não achei este treino" só quando é verdade.** Abrir a sessão em andamento
   logo depois do login, num aparelho sem nada no IndexedDB, mostrava o erro
   definitivo com a sessão existindo no banco (1 em 4 aberturas; "Tentar de
   novo" resolvia). A tela decidia com um único `carregando` que virava `false`
   antes de a linha chegar — ou antes de o motor ter o que precisa para refazer
   a sessão. A decisão virou função pura (`lib/estado-do-player.ts`,
   `decidirTela`): "não achei" só sai quando a busca no aparelho terminou sem
   sessão **e** o servidor terminou sem nada para montar; enquanto uma das duas
   corre, esqueleto. Erro de rede de verdade passou a ser o componente `Erro`,
   e o "Tentar de novo" dele refaz as consultas em vez de mandar o usuário para
   outra tela.
4. **Sair é deste aparelho.** `supabase.auth.signOut()` usava o escopo padrão
   `global` e revogava **todas** as sessões da conta (nos `edge_logs`: um
   `POST /auth/v1/logout?scope=global` seguido de 5 × `GET /auth/v1/user` 403
   nos outros contextos): o dono, com o celular e o navegador abertos, saía de
   um e derrubava o outro. Agora é `signOut({ scope: 'local' })`; os dados
   locais deste aparelho continuam sendo apagados (§8), e quem quiser derrubar
   todo mundo troca a senha.
5. **Rótulo.** O botão da última pergunta do feedback dizia "Concluído"
   (particípio) depois de escolhida a sensação; agora diz **"Concluir"** — e
   continua "Concluir sem responder" enquanto ninguém respondeu.

**Provas.** Unidade: `lib/sw-assets.test.ts` (14 scripts todos em cache →
serve; 1 faltando → não; sem scripts → serve; assets demais → não),
`lib/sw-cura.test.ts` (guarda o HTML **com** os assets; um asset que não vem
invalida a cópia; asset despejado depois não conta como "já tem"),
`lib/digitar-numero.test.ts`, `lib/estado-do-player.test.ts`. Ponta a ponta,
em `e2e/player.spec.ts`: digitar "12,5" tecla a tecla no campo de carga —
conferindo o campo a cada tecla, que é a única forma de prender a reescrita —
e a série gravada com o valor certo; e abrir `/treinar/<id>` com a sessão só no
banco e a resposta atrasada 2 s, exigindo esqueleto e depois o player, nunca
"Não achei".

**Como testar no celular.** (a) *Carga*: no player, toque no número da carga,
apague e digite **12,5** depressa — o campo nunca pode mostrar duas vírgulas; ao
tocar fora ele mostra a carga que o seu kit monta (11,5 kg com as anilhas do
terraço) e o ✓ grava esse valor. (b) *Sessão que chega*: comece um treino no
celular, entre no app pelo navegador do computador e abra o mesmo treino — tem
de aparecer o esqueleto e depois o player, nunca "Não achei este treino". (c)
*Sair*: com o app aberto nos dois aparelhos, aperte **Sair** num deles; o outro
tem de continuar logado. (d) *Sem conexão*: ligue o modo avião e abra uma tela
que você nunca visitou — tem de vir "Sem conexão" **com os dois botões**, nunca
"Application error".

#### Correção da auditoria (rodada 9, segunda passada)

A auditoria reproduziu o beco do aparelho despejado no HEAD anterior e mostrou
por quê: a cópia estava inteira no cache `socorro` — os 14 pedaços e a folha —,
a guarda passava, e mesmo assim o pedaço morria em `fetch`. **Faltava a outra
ponta: ninguém servia daquele cache.** Quem atende
`/_next/static/chunks/app/~offline/page-*.js` é a rota do **precache** do
Serwist (a URL está no manifesto do build); com o precache despejado ela ia à
rede e o erro subia direto para a hidratação.

Agora o cache `socorro` é servido: a estratégia do precache e as 20 estratégias
genéricas do `defaultCache` ganharam um último degrau que procura a URL ali
antes de desistir (`lib/sw-servir-socorro.ts`). Duas lições ficaram no código:
pendurar o degrau é por **forma** (a lista `plugins`) e não por `instanceof` —
o `@serwist/next` traz a sua própria cópia do `serwist`, e a primeira tentativa
não pendurou nada em lugar nenhum; e o caminho inteiro só aparece num navegador
de verdade, então ele virou e2e (`e2e/sem-conexao.spec.ts`, "aparelho
despejado": apagar todo o Cache Storage dentro do worker, uma navegação com
rede, cortar o `self.fetch` e abrir uma rota nunca visitada).

Outras duas da mesma auditoria: a autocura tira cada pedaço do precache e dos
caches do aparelho **antes** de ir à rede (numa ativação sem conexão ela
devolvia "sem-fonte" com os pedaços ali ao lado); e o − e o + soltam o campo de
carga, que até aqui só se reconciliava quando o foco saía — no Safari do iPhone
tocar num botão não move o foco, e o campo ficava mostrando o número velho.
O e2e exercita esse caminho com `dispatchEvent("click")`, que não mexe no foco.

#### Correção da auditoria 2 (rodada 9, terceira passada)

A auditoria 2 aceitou os cinco defeitos como corrigidos e apontou o que estava
**sem prova**: o Sair local. O código pedia `{ scope: "local" }` desde a
segunda passada, mas nenhum teste afirmava isso — e um `signOut()` pelado (o
padrão `global` do GoTrue) voltaria a derrubar o celular do dono quando ele
saísse no navegador, sem nada ficar vermelho.

A decisão saiu de `app/(auth)/login/acoes.ts` — arquivo `"use server"`, que o
Vitest não carrega (`vitest.config.ts` só inclui `lib/**` e `scripts/**`) — e
virou `lib/sair.ts`: uma função pura que recebe o cliente e chama
`signOut({ scope: "local" })`. A ação do servidor ficou de três linhas. O teste
(`lib/sair.test.ts`) afirma o escopo, que o argumento é **um só** e que ele tem
**uma chave só** — nada de `signOut()` nem de escopo extra passando despercebido.

Do lado do navegador, o mock passou a guardar cada logout com o `?scope=` que
veio na URL e a mostrá-lo em `GET /__mock/estado`; é a única forma de um e2e
dizer o que o app pediu, porque o escopo não aparece na tela nem na resposta.
São dois testes em `e2e/login.spec.ts`: um toca em **Sair** pela interface e lê
do mock que o escopo foi `local`; o outro abre duas sessões da mesma conta,
sai numa com `scope=local` e prova que a outra continua de pé (o refresh dela
ainda troca por um par novo, e o de quem saiu não troca mais). Para isso o mock
ficou fiel ao GoTrue: `local` derruba só a sessão de quem pediu, `global`
derruba todas da conta.

Mais duas da mesma auditoria. (a) `servidorRespondeu` incluía `!isFetching`:
qualquer refetch de fundo — voltar para a aba, reconectar — rebaixava um "não
achei" já decidido de volta para esqueleto, e a tela piscava sozinha. A regra
virou pura (`servidorTerminouDeBuscar`, em `lib/estado-do-player.ts`) e olha só
`isPending`, com o caso "refetch de fundo não rebaixa" no teste. (b) O e2e do
nome em duas linhas media a lista com um `page.evaluate` cru e já voltou `null`
uma vez; agora espera `ul[aria-label="Exercícios de hoje"]` visível antes.

**Como testar no celular** (o mesmo roteiro da passada anterior, mais o item
do Sair): com o app aberto no celular e no navegador com a mesma conta, aperte
**Sair** no navegador — o celular tem de continuar dentro, sem 403 e sem voltar
para a tela de login na primeira leitura.

**Fila (não feito de propósito):** `app/sw.ts`, `emQualquerCache()` relê o corpo
da `/~offline` a cada navegação sem rede — desperdício, não defeito.

**Deploy (rodada 9, 21/09 21:48 UTC).** Publicado. Deployment anterior
`dpl_Aq8mLNXTUzZCdZERZJgkNX1U4Xcd` → novo `dpl_4PC2euxoenjZHjbghrpWD9rGiy1K`;
`main` passou de `1386cd0` para `040908aa07b50b72a1dbdfce05ac012aa4c4e464`
(PR #16) e `/versao` devolveu esse sha às 21:48:55, ~2 min depois do merge
(build de 21:47:28Z). O merge na integração conflitou **só em `PROGRESSO.md`**
— a branch do lote nasceu de `1386cd0` e a integração já tinha o registro do
deploy da rodada 8 —, resolvido mantendo os dois lados; nenhum conflito de
código, e `git diff correcao/r9-socorro-player HEAD` mostra apenas
`PROGRESSO.md`. Portão final na integração: `lint` e `tsc --noEmit` limpos,
e2e não repetido (árvore de código idêntica à de `4bc7c7b`, que passou na
cadeia completa: 1.449 unitários, 426 e2e, `Compiled successfully`).

Fumaça em produção **22 de 22**, item a item: `/login` 200 · com "Treino do
Terraço" · com "Entrar" · sem "Configure NEXT_PUBLIC_SUPABASE_URL" · sem
"é secreta" · `/` → 307 para `/login` · `/versao` == sha do merge · `/sw.js`
200 · com `/~offline` · com `figuras/` · com o mesmo CSS do HTML de `/login`
(`301bf89aee08a5c8`) · `/manifest.webmanifest` 200 com "Treino do Terraço" ·
`/~offline` 200 · os 14 scripts `/_next/static` de `/login` 200 · marcadores
do lote: `/sw.js` contém "Tentar de novo", "Ir para o Treino", `/~offline` e
`__regrasComSocorro` (o socorro autossuficiente) · o chunk do player
`app/(app)/treinar/[sessionId]/page-02a58010c265ffeb.js` contém "Concluir sem
responder", contém "Concluir" (10 ocorrências) e **não** contém "Concluído"
nem a forma escapada `Conclu\xeddo` (a única grafia com "Conclu" restante é o
identificador `sessaoConcluida`). A fumaça rodou **duas vezes**, com 40 s de
intervalo, verde nas duas — sem a instabilidade de proxy da rodada 8. Sonda a
360×740 (Chromium): `/login` e `/~offline` sem erro de console e sem vazamento
horizontal (scrollWidth 360 = clientWidth). Capturas: nenhuma tela mudou de
aparência nesta rodada (as correções são de comportamento e de rótulo), então
a base não foi mexida. Nenhuma migração de banco. **Rollback: não.**

### Rodada 10 — Lote 12 — Explorar e catálogo: leitura e filtros

Branch `polimento/l12-explorar-catalogo`, a partir de `main` `ef3ad97`. SPEC
§22.12. Oito itens; o aceite de cada um está no próprio item da SPEC.

#### O que mudou

1. **Os filtros do catálogo moram numa folha** (`components/exercicios/lista-exercicios.tsx`,
   `lib/catalogo.ts`). **Era:** `/exercicios` gastava ~399 px em cabeçalho,
   busca, três selects e o botão "No meu programa" de largura inteira — 54% da
   tela de 740 antes do primeiro exercício; na busca do Explorar o mesmo bloco
   abria e fechava inline atrás de um botão com `aria-expanded` e sem
   `aria-controls`. **É:** na tela ficam a busca, o botão **"Filtros"** (selo =
   quantos filtros estão ligados, `quantosFiltrosLigados`) com o contador na
   mesma linha, e os **chips removíveis** do que está ligado ("Peito ×",
   `chipsDosFiltros` / `semOFiltro`). Os selects e o chip de alternância "No
   meu programa" vão para uma folha inferior (`Sheet` do shadcn = `Dialog` do
   Radix), com título e descrição, "Limpar" (solta os filtros e mantém a busca)
   e o CTA **"Ver N exercícios"** (`rotuloDoVerResultados`: "Ver 1 exercício",
   "Nenhum exercício"), que fecha a folha e leva ao primeiro resultado. O
   gatilho é o `SheetTrigger`: `aria-haspopup="dialog"`, `aria-expanded` e
   `aria-controls` saem do Radix. Vale para `/exercicios` e para a busca do
   Explorar.
2. **A linha da coleção lê de cima para baixo** (`components/colecoes/linha-colecao.tsx`,
   `lib/colecoes.ts`). **Era:** título → meta em negrito (`.numero`, 600) →
   subtítulo; o subtítulo de aparelho e circuito era a ficha técnica
   (`specs`: "7 posições de encosto · 4 de assento · dobrável · 200 kg · 104 ×
   32 cm…") e a meta repetia "30 exercícios · ~2 h". **É:** título (o único com
   peso) → subtítulo → motivo da busca → meta em peso normal (`tabular-nums`
   sem `.numero`). Aparelho e circuito sem `specs`; a coleção do aparelho diz
   **"N exercícios que dão para fazer com ele"** (`metaDoAparelho`, singular
   "1 exercício que dá…"), sem minutos, kg ou cm — conferido nos 9 aparelhos
   de `data/equipamentos.json` que têm exercício. **Correção da auditoria:**
   o título do aparelho era o `nome` do JSON, com medida e marca ("Tatame EVA
   20 mm", "Super Band 45 mm (Yangfit)", "Barra reta maciça 1,50 m"); agora é
   o `nome_curto` novo do item ("Tatame EVA", "Super Band", "Barra reta
   maciça"; opcional no Zod, `lib/schemas.ts`), e o nome completo fica em
   Mais → Equipamento.
3. **A busca diz por que achou** (`lib/colecoes.ts` `buscarColecoes`,
   `exerciciosResponsaveis`, `juntarNomes`). **Era:** as coleções saíam na
   ordem da vitrine e "supino" mostrava "Treino A" sem dizer que era pelo
   supino lá dentro. **É:** título > subtítulo > conteúdo; o casamento por
   exercício leva `motivoDaBusca` — "contém Supino reto com barra";
   "supino agachamento" → "contém Supino reto com barra e Agachamento livre"
   (na ordem dos termos); "supino reto" → um nome só; título e subtítulo não
   mostram "contém". **Correção da auditoria (bloqueante):** com 3 termos ou
   mais, o primeiro termo podia ir para outro exercício e sobrava um nome —
   "flexao inclinada supino" em Peito dizia "contém Flexão declinada, Flexão
   inclinada e Supino reto com barra". Agora, termo a termo, vence o
   exercício que contém o termo **e cobre mais termos ainda descobertos**
   (empate: o primeiro da coleção), e no fim sai quem ficou redundante: Peito
   diz "contém Flexão inclinada e Supino reto com barra"; "agachamento sumo
   stiff" na barra maciça, "contém Agachamento sumô e Stiff / terra romeno";
   "barra com remada" em Costas, "contém Barra fixa com lastro e Remada
   curvada pronada".
4. **Planos: título curto e a posição** (`lib/colecoes.ts` `planos`,
   `metaDoPlano`, `colecoesDePlano(posicao)`; `tela-explorar.tsx`,
   `tela-colecao.tsx`). **Era:** "Primeira barra fixa em 12 semanas", "5 km sem
   parar em 12 semanas" (o prazo repetido no objetivo) e a corda com "5
   semanas" (eram 5 estágios de 12 semanas). **É:** "Primeira barra fixa",
   "5 km sem parar" (a meta da última semana de `cardio.json`) e "Corda: 5
   estágios"; com perfil, a meta é "semana N de 12" (`semana_fixa` /
   `semana_corrida`, presa ao total — 99 vira 12); sem perfil, "12 semanas"
   (mudou na rodada 11: ver "Rodada 11 — retomada", item 4, e a "Correção da
   auditoria 1 (rodada 11)" — sem perfil, barra fixa e corrida ficam sem meta
   e mostram o objetivo inteiro, com o prazo);
   a corda mostra a duração do JSON (`ultimaSemanaDeCorda()` = 12). A tela da
   coleção do plano diz a mesma posição. **Correção da auditoria:** o card do
   desafio (carrossel da Treino e destaque do Explorar) ainda dizia "Primeira
   barra fixa em 12 semanas" enquanto a linha do mesmo plano dizia "Primeira
   barra fixa"; `desafios()` passa a usar o título de `planos()` — o prazo
   continua no card, em "Semana N de 12".
5. **Títulos em degraus** (`tela-explorar.tsx`). **Era:** "Exercícios" era `h3`
   irmão do `h2` "Escolhas para você". **É:** `h2`; os cinco do grupo de
   escolhas continuam `h3`.
6. **A tela da coleção tem `h1`** (`components/ui/card-capa.tsx` `nivelTitulo`,
   `components/colecoes/tela-colecao.tsx`). **Era:** a página não tinha `h1` — o
   título da capa era `h2`. **É:** exatamente um `h1` no `main`, também em
   `/explorar/grupo/Core` e `/explorar/grupo/B%C3%ADceps`.
7. **Uma fonte só para o CTA dos desafios** (`lib/colecoes.ts` `desafios`,
   `nomeCurtoDaFase`; `components/treino/desafios.tsx`). **Era:** a aba Treino
   reescrevia o rótulo por id (`acaoDoDesafio`: "Fazer a sessão de barra
   fixa") e o destaque do Explorar mostrava `desafio.acao` ("Fazer a sessão
   da semana") — o mesmo desafio com dois CTAs. **É:** o rótulo sai só de
   `desafios()` ("Fazer a sessão de barra fixa", "Fazer a corrida da semana
   N", "Fazer o treino da fase 1"); as duas telas mostram `desafio.acao`, e
   `acaoDoDesafio` não existe mais. **Correção da auditoria (importante):** a
   página da coleção de plano (`components/colecoes/tela-colecao.tsx`) ainda
   escrevia "Fazer a sessão da semana" e levava a corrida a `/cardio/corrida`
   sem a semana. O rótulo e o destino de barra fixa, corrida e corda saem de
   `ctaDoPlano()` (`lib/colecoes.ts`), que o próprio `desafios()` usa: em
   `/explorar/plano/barra_fixa`, "Fazer a sessão de barra fixa" →
   `/barra-fixa`; em `/explorar/plano/corrida`, "Fazer a corrida da semana N"
   → `/cardio/corrida?semana=N`, os mesmos do carrossel; a corda, que não é
   desafio, "Fazer a sessão de corda". Sem perfil, a corrida diz "Fazer a
   corrida" e leva à tela dela, sem inventar semana.
8. **Processo: o comparador casa o nome curto** (`scripts/comparar-capturas.ts`).
   **Era:** `--esperadas explorar` não casava `06-explorar-claro.png`
   (`startsWith`). **É:** `casaEsperada()` exportada: casa com o número
   ("06-explorar") ou sem ("explorar"), parando numa fronteira ("explo" não
   casa); o script só roda quando chamado pela linha de comando.

**Fora dos arquivos do lote:** `e2e/auditoria-m5.spec.ts`, `e2e/catalogo.spec.ts`,
`e2e/ultraloop-b-r5.spec.ts` e `e2e/v3.spec.ts` — os filtros agora abrem pela
folha, a coleção tem `h1` e o plano diz "semana N de 12"; o que cada teste
verifica não mudou. `lib/guia.ts` (uma frase): o guia prometia o botão
"Fazer a sessão da semana" no carrossel, rótulo que o carrossel não mostra
desde o lote 7; agora diz que o botão leva à sessão de cada desafio, com o
mesmo rótulo do destaque do Explorar.

#### Provas

- **Vitest (+23 casos; +19 na primeira entrega e +4 na correção da auditoria):** `lib/colecoes.test.ts` (+11 — todo aparelho sem
  specs/kg/cm/min e com a contagem uma vez; singular da meta; circuito sem
  ficha; títulos curtos dos planos; "semana N de T" com o perfil, preso no
  total, e a duração sem perfil; corda com 12 semanas; busca título >
  subtítulo > conteúdo; "contém" só por conteúdo; toda coleção achada por
  conteúdo cita o exercício; acento e caixa; dois termos no mesmo exercício →
  um nome; termos em exercícios diferentes → nomes na ordem dos termos; o CTA
  dos desafios sai de `desafios()` e nenhuma tela reescreve o rótulo),
  `lib/catalogo.test.ts` (+4 — selo conta filtros e não resultados, chips,
  tirar um chip, "Ver N exercícios" com singular) e
  `scripts/comparar-capturas.test.ts` (4 — casamento antigo mantido, nome sem
  número nos dois temas, a lista `explorar,colecao,catalogo` casa só as três
  telas, nada de meio de palavra).
- **e2e novo, `e2e/ultraloop-a-r10.spec.ts` (11 testes — 9 na primeira entrega e 2 na correção —, 360×740):** o primeiro
  cartão de `/exercicios` inteiro na primeira tela e os selects fora dela; o
  gatilho com `aria-haspopup="dialog"`, `aria-expanded` falso→verdadeiro e
  `aria-controls` igual ao `id` do `dialog` "Filtros" (com descrição); todo
  controle da folha e dos chips ≥ 44 px; Peito + Halteres → selo 2, CTA "Ver 5
  exercícios", contador "5 de 81", 5 cartões e o primeiro na tela; tirar
  "Peito" → selo 1, contador e cartões juntos; um par grupo+implemento com um
  exercício só → "Ver 1 exercício"; a mesma folha na busca do Explorar com o
  título «Exercícios (N)» igual aos cartões; os 9 aparelhos sem specs, kg, cm,
  "~" ou "min", com a contagem uma vez, a meta como última linha em peso 400 e
  o título ≥ 500; "supino" → banco sem motivo e primeiro, Treino A "contém
  Supino reto com barra", nenhuma coleção achada por conteúdo sem motivo;
  "supino agachamento" e "AGACHAMENTO SUPÍNO" com os dois nomes na ordem dos
  termos; "supino reto" com um nome; "zzzz" com um vazio só; planos com
  "semana 3 de 12", "semana 12 de 12" (perfil em 99) e a corda "12 semanas";
  Explorar com um `h1`, dois `h2` e os cinco `h3`; coleção com exatamente um
  `h1` no `main` em `/explorar/grupo/core`, `/Core`, `/B%C3%ADceps` e
  `/plano/corrida`, e o voltar; num domingo sem força, o CTA do destaque do
  Explorar é o mesmo texto e o mesmo `href` de um card do carrossel da aba
  Treino, e os três CTAs do carrossel são distintos.
- **O teste falharia sem a mudança:** o do desafio lê "Fazer a sessão da
  semana" no Explorar de `main` e não acha esse texto no carrossel; o do `h1`
  conta zero `h1` na coleção de `main`; o dos aparelhos acha "200 kg" no
  banco; o dos planos acha "12 semanas" onde espera "semana 3 de 12".

#### Correção da auditoria

Auditoria de regra em `bce5429` (reprovado: 1 bloqueante, 2 importantes, 7
menores). O que foi feito, commit a commit:

- **Bloqueante — busca com 3 termos citava um nome a mais** (`a6e6038`,
  `lib/colecoes.ts` `exerciciosResponsaveis`). Era: o atalho "um exercício
  com todos os termos" e, senão, o primeiro exercício de cada termo — o
  primeiro termo podia cair em outro exercício ("Flexão declinada" em
  "flexao inclinada supino"). É: termo a termo, o exercício que contém o
  termo e cobre mais termos ainda descobertos, e uma passada final que tira
  o redundante (item 3 acima; SPEC §22.12 item 3 reescrito em `f37c04b`).
  Os três casos reais da auditoria viraram teste, e o teste velho que
  esperava "Prancha frontal, Prancha lateral e Rosca direta" para
  "prancha lateral rosca" (o mesmo defeito) passou a esperar "Prancha
  lateral e Rosca direta".
- **Importante — teste de nomes únicos que não falharia.** Novos casos em
  `lib/colecoes.test.ts`: `["prancha","lateral","frontal"]` sobre "Prancha
  frontal"/"Prancha lateral" cita os dois uma vez só; e uma varredura sobre
  **todas** as coleções reais com consultas de 3 termos (2 palavras de um
  exercício + 1 de outro, em três ordens; mais de 1.000 consultas): nomes
  únicos, todo termo com quem responda por ele, todo nome citado com um termo
  só dele e no máximo dois nomes. Rodei esses testes contra o
  `lib/colecoes.ts` de `bce5429`: **3 falharam** (o velho, os casos reais e a
  varredura). Na regra nova, a guarda que a mutação M19 apagava deixou de
  existir como linha solta: um exercício já citado não cobre termo
  descoberto e por isso nunca é escolhido de novo.
- **Importante — o CTA do plano escrito à mão** (`0d03a21`). Item 7 acima:
  `ctaDoPlano()` é a fonte de `desafios()` e de
  `components/colecoes/tela-colecao.tsx`; a corrida leva a
  `/cardio/corrida?semana=N`. O teste de fonte única passou a cobrir também
  `tela-colecao.tsx`, e o e2e novo "a página do plano mostra o mesmo CTA do
  desafio" compara texto e `href` do carrossel com a página do plano, para
  barra fixa e corrida. `e2e/v3.spec.ts` agora espera "Fazer a sessão de
  barra fixa".
- **Menores feitos:** o título do aparelho sem medida nem marca
  (`nome_curto`, `7d3db49`); o título do desafio igual ao da linha do plano
  (`0d03a21`); o e2e novo "com a página rolada, 'Ver N exercícios' traz o
  primeiro resultado para a tela" (`f8c7df4`) rola até o fim antes de abrir a
  folha; o comentário de `lib/colecoes.ts` e a SPEC §14.3 não falam mais em
  "Fazer a sessão da semana"; esta seção cita o log do HEAD certo.
- **Sobre o e2e rolado:** tirei o `scrollIntoView` de `onCloseAutoFocus`
  numa cópia de trabalho (não comitada), refiz o `build:e2e` e rodei o teste:
  **continuou verde**. O Radix devolve o foco ao gatilho "Filtros", que fica
  no alto da lista, e o navegador rola até ele — o primeiro cartão já volta à
  tela por aí. O teste prova o comportamento pedido (página rolada → CTA →
  primeiro resultado na tela), não o `scrollIntoView` em si, que fica como
  reforço.
- **Menores não feitos:** sem perfil, a linha da corrida repete o prazo do
  objetivo na meta ("12 semanas") — com perfil, o caso normal, a meta é
  "semana N de 12"; e o teste de fonte única continua lendo o código-fonte
  (agora ao lado do e2e que compara os CTAs na tela).

#### Portões

Cadeia inteira no HEAD de código `7d3db49` (`r10/l12/logs/7d3db49.log`, das
21:52 às 22:14 UTC, **status ok**): `lint` limpo · `tsc --noEmit` limpo ·
`npm test` **63 arquivos, 1.472 testes, todos verdes** (eram 1.468 em
`bce5429`; +4: três da busca e um do CTA do plano) · `build` ("Compiled
successfully in 17.5s") · `build:e2e` ("Compiled successfully in 17.0s") ·
`e2e` **437 passaram, 5 pulados, 0 falharam** (442, 16,0 min; +2 do lote) ·
`varredura` **5 de 5** (4,3 min). A cadeia roda de novo, inteira, no commit
deste registro (só `PROGRESSO.md` muda), e o log dele fica em
`r10/l12/logs/<hash>.log`.

Antes da cadeia, uma execução parcial (`r10/l12/sonda-logs/f8c7df4.log`:
`build:e2e` + os 8 testes do lote e o do plano em `v3.spec.ts`) deu 8 de 8.

Histórico: `9a5c5f4.log` (falhou:e2e — 1 instável fora do lote, passou
sozinho 2×), `843944e.log` e `bce5429.log` (verdes, 1.468 testes, e2e 435 + 5
pulados).

#### Capturas

`capturas.sh` em `7d3db49`, depois da cadeia verde, contra a base real de
`main` (`base-ef3ad97`), com `--esperadas explorar,colecao,catalogo` — os
nomes curtos, sem número (item 8): as três telas saíram como **esperada =
sim**. 60 PNGs; **54 iguais** (Δ 0,00 %), nenhuma tela fora da lista mudou;
03 e 04 (aba Treino) iguais — o carrossel de desafios não aparece nessas
capturas (o título novo do card não entra nelas).

| tela | Δ claro | Δ escuro | o que mudou (olhando o diff) |
| --- | ---: | ---: | --- |
| 08-catalogo | 30,21 % | 28,35 % | os três selects e o "No meu programa" saíram; ficou "Filtros" com "81 exercícios" na mesma linha, e o primeiro cartão subiu de y≈392 para y≈222 (CSS px) — cinco cartões e meio na primeira tela, eram três e meio |
| 07-colecao | 6,82 % | 3,97 % | `/explorar/plano/corrida`: o título "5 km sem parar em 12 semanas" (duas linhas) virou "5 km sem parar" (uma), a meta "12 semanas" virou "semana 2 de 12" do perfil, e o botão "Fazer a sessão da semana" virou **"Fazer a corrida da semana 2"** (o mesmo do carrossel; era 6,13 % em `bce5429`, sem a troca do botão) |
| 06-explorar | 1,74 % | 1,77 % | nas linhas de "Treinos do programa" o subtítulo ("Empurrar e agachar") subiu para logo abaixo do título e a meta ("6 exercícios · ~44 min") desceu para a última linha, sem negrito |

#### Como testar no celular (360 px)

- **Catálogo** (Explorar → "Ver os 81 exercícios"): o primeiro exercício
  aparece sem rolar. Toque em **Filtros**: sobe uma folha com Grupo,
  Implemento, Equipamento e o chip "No meu programa". Escolha Peito e
  Halteres — o selo do botão vira **2** e o botão de baixo diz **"Ver 5
  exercícios"**; toque nele: a folha fecha, a lista mostra os 5 e, acima dela,
  os chips **Peito ×** e **Halteres ×**. Toque em "Peito ×": o selo vira 1 e a
  contagem sobe junto.
- **Busca no Explorar**: "supino" — o banco supino vem primeiro nas Coleções,
  sem "contém"; o Treino A diz **"contém Supino reto com barra"**. "supino
  agachamento" — o Treino A cita os dois exercícios, na ordem digitada.
- **Por aparelho** ("Ver todos"): nenhuma linha fala de kg, cm ou minutos;
  cada uma diz "N exercícios que dão para fazer com ele" uma vez só.
- **Planos**: "Primeira barra fixa" e "5 km sem parar", com "semana N de 12"
  embaixo; a corda diz "12 semanas". Toque na corrida: a tela do plano diz a
  mesma semana.
- **Desafios**: o botão da barra fixa no carrossel da aba Treino e o do
  destaque do Explorar (num dia sem treino de força) dizem a mesma coisa.
- **Página do plano** (Explorar → Planos → "5 km sem parar"): o botão diz
  "Fazer a corrida da semana N" — o mesmo do carrossel — e abre a corrida
  daquela semana; em "Primeira barra fixa", "Fazer a sessão de barra fixa".
- **Busca com três palavras**: "flexao inclinada supino" — a linha de Peito
  diz "contém Flexão inclinada e Supino reto com barra", sem a declinada.
- **Por aparelho**: os nomes vêm sem medida nem marca ("Tatame EVA", "Super
  Band", "Barra reta maciça"); em Mais → Equipamento o nome completo continua.

#### Rodada 10 — auditoria 2 reprovou; lote devolvido à fila

A segunda auditoria, em `06441e5`, aprovou a lente **tela** e reprovou a lente
**regra** por dois importantes: (1) nenhum teste cobria a passada final de
`exerciciosResponsaveis` (a que tira o nome redundante) — uma mutação que a
anula passava em 80/80, porque a varredura só montava consultas de 3 termos e,
com 3, a passada nunca age; com 4 ela é necessária ("sentado panturrilha barra
declinado" no Banco citava "Desenvolvimento sentado com barra" sobrando); e (2)
a SPEC se contradizia: a §13.8 item 2, critério de aceite, ainda pedia `specs`
como subtítulo de aparelho e circuito, enquanto a §22.12 item 2 e o código
dizem que não há subtítulo. Pela regra do dono (no máximo duas auditorias por
rodada), o lote voltou à fila ao fim da rodada 10.

#### Rodada 11 — retomada

Mesma branch, a partir de `06441e5`. Logs em `r11/l12/logs/`.

##### O que mudou

1. **Passada final da busca coberta por teste, com 4 termos** (`lib/colecoes.test.ts`).
   **Era:** só consultas de 3 termos; anular `if (redundante) finais.splice(…)`
   não derrubava nenhum teste. **É:** os três casos reais de 4 termos
   ("sentado panturrilha barra declinado" no Banco → "contém Elevação de
   panturrilha sentado e Supino declinado com barra"; "puxada remada polia
   com" e "puxada rosca com polia" no Cross over → "contém Puxada com
   triângulo e Remada baixa na polia" / "… e Rosca na polia baixa", sem a
   "Puxada alta na polia"), o sintético `[alfa, beta, gama, delta]` sobre
   `["alfa beta", "alfa gama", "beta delta"]` → `["alfa gama", "beta delta"]`,
   e a varredura de todas as coleções reais estendida a 4 termos (dois de cada
   exercício, em três ordens) além das de 3.
2. **A frase dos nomes na ordem dos termos** (`lib/colecoes.ts`
   `exerciciosResponsaveis`; menor (a)). **Era:** os nomes saíam na ordem da
   escolha gulosa — "barra direta supino" no Treino A dizia "Supino reto com
   barra e Rosca direta com barra"; "flexao braco declinada" em Peito,
   "Flexão declinada e Flexão de braço". **É:** cada nome vai para a posição
   do primeiro termo que ele cobre; dois que começam no mesmo termo, pelo
   primeiro termo que só ele cobre: "Rosca direta com barra e Supino reto com
   barra", "Flexão de braço e Flexão declinada". O conjunto citado não muda,
   só a ordem.
3. **SPEC sem contradição** (`SPEC.md`; importante 2 e menor (d)). §13.8 item 2
   diz que aparelho e circuito não têm subtítulo e remete à §22.12 item 2;
   §13.4 traz os títulos curtos dos planos ("Primeira barra fixa", "5 km sem
   parar") e a meta de aparelho; §14.4 diz que a meta de aparelho é "N
   exercícios que dão para fazer com ele" e a de plano, posição ou duração;
   §22.12 itens 2, 3 e 4 com a regra desta rodada e uma nota "Rodada 11 —
   correção da auditoria 2".
4. **Sem perfil, o plano não repete o prazo** (`lib/colecoes.ts` `metaDoPlano`,
   `textoDizOPrazo`, `Colecao.detalhe: string | null`;
   `components/colecoes/linha-colecao.tsx`; menor (e)). **Era:** sem perfil, a
   barra fixa dizia "a primeira barra fixa sem elástico em 8–12 semanas" e
   logo abaixo "12 semanas"; a corrida, "… em 12 semanas (≈35 min…)" e "12
   semanas". **É:** sem posição, a meta é "T semanas" só se o subtítulo (o
   objetivo do JSON) ainda não disser o prazo; se disser, a linha fica sem
   meta (a linha não desenha um vão vazio). Com perfil nada muda ("semana N
   de 12"); a corda continua "12 semanas". (A auditoria 1 da rodada 11 mediu
   que, cortado numa linha, o subtítulo escondia o prazo: a linha sem meta
   passou a mostrar o subtítulo inteiro — ver "Correção da auditoria 1
   (rodada 11)".)
5. **Uma fonte para a meta e para o nome da fase** (menores (b) e (c)).
   `components/treino/tela-treino.tsx` perdeu o `nomeCurtoDaFase` privado e
   importa o de `lib/colecoes.ts`; o destaque do Explorar
   (`components/explorar/tela-explorar.tsx`) tira a meta de `metaDoPlano()` em
   vez de montar "semana N de T" na tela. O texto na tela é o mesmo.
6. **"ele" nunca sozinho na linha de aparelho** (`metaDoAparelho`; menor (f)).
   **Era:** a 360 px, "8 exercícios que dão para fazer com ele" quebrava e
   deixava "ele" sozinho na segunda linha em 8 das 9 linhas. **É:** espaço
   inseguível (U+00A0) em "com ele" — "com ele" desce junto.

##### Correção da auditoria

- **Importante 1 (passada final sem teste):** item 1 acima. Prova de que o
  teste novo pega a mutação: com `if (redundante && false) …` no lugar da
  passada, `lib/colecoes.test.ts` dá **3 falhas** (casos reais de 4 termos,
  sintético e varredura 3+4 termos); sem ordenar a frase
  (`return finais.map…`), **4 falhas**. As mutações foram feitas no worktree e
  desfeitas antes do commit (nada delas foi comitado).
- **Importante 2 (SPEC §13.8 item 2):** item 3 acima.
- **Menores feitos:** (a) ordem da frase, item 2; (b) `nomeCurtoDaFase` único;
  (c) meta do destaque por `metaDoPlano`; (d) §13.4 e §14.4 alinhadas; (e)
  prazo sem perfil, item 4; (f) "com ele" inseguível, item 6.
- **Menores que ficam de fora (anotados):** o conjunto citado nem sempre é o
  menor possível (2 casos de "Puxada Remada polia com" em Costas citam 3
  nomes quando 2 bastariam — efeito do guloso, sem violar aceite); o teste de
  fonte única do CTA ainda lê o código-fonte por regex (o comportamento na
  tela segue coberto pelos 2 e2e do item 7); o título "5 km sem parar" repete
  o começo do subtítulo da corrida (regra de nada repetido do contrato B é de
  aparelho); a parte "fase" do contrato F não tem par no Explorar (o destaque
  só mostra barra fixa e corrida); o `scripts/validar-dados.test.ts` que
  renomeia um SVG enquanto roda (anterior ao lote, fora dele).

##### Provas

- **Vitest (+4 casos, 1.472 → 1.476):** `lib/colecoes.test.ts` ganhou "com 4
  termos, quem ficou redundante sai da frase (dados reais)", "a passada final
  tira o nome que os outros citados cobrem (sintético)", "a frase segue a
  ordem do primeiro termo que cada nome cobre" e "em toda coleção real, com 3
  e 4 termos: sem repetir, sem sobrar e na ordem dos termos" (> 2.000
  consultas, > 1.000 com 4 termos). Mudados: a meta do plano sem perfil
  (`null` para barra fixa e corrida, "12 semanas" para a corda, casos
  sintéticos de `textoDizOPrazo`), `metaDoAparelho` com U+00A0, e o caso
  "prancha lateral frontal", que agora espera "Prancha lateral, Prancha
  frontal" (ordem dos termos).
- **e2e (`e2e/ultraloop-a-r10.spec.ts`, teste dos aparelhos):** a meta de cada
  um dos 9 aparelhos contém "com ele", e a última linha da meta, lida
  palavra a palavra pela posição na tela a 360 px, tem mais de uma palavra.

##### Portões

Cadeia inteira no HEAD de código `59f92ce` (`r11/l12/logs/59f92ce.log`, das
23:01 às 23:23 UTC, **status ok**): `lint` limpo · `tsc --noEmit` limpo ·
`npm test` **63 arquivos, 1.476 testes, todos verdes** (eram 1.472 em
`06441e5`; +4 da busca) · `build` ("Compiled successfully in 18.7s") ·
`build:e2e` ("Compiled successfully in 18.5s") · `e2e` **437 passaram, 5
pulados, 0 falharam** (15,8 min; os 11 de `e2e/ultraloop-a-r10.spec.ts` ✓,
inclusive o dos aparelhos com a checagem nova) · `varredura` **5 de 5** (4,2
min). A cadeia roda de novo, inteira, no commit deste registro (muda só
`PROGRESSO.md`, a indentação da nota da rodada 11 na SPEC e dois comentários
em `tela-explorar.tsx` e `tela-colecao.tsx`), e o log fica em
`r11/l12/logs/<hash>.log`.

##### Capturas

`capturas.sh` em `59f92ce`, depois da cadeia verde, contra a base real de
`main` (`base-ef3ad97`), com `--esperadas explorar,colecao,catalogo`
(`r11/l12/capturas-59f92ce.md`). 60 PNGs; **54 iguais** (Δ 0,00 %), nenhuma
tela fora da lista mudou; 03 e 04 (aba Treino) iguais. As seis capturas que
mudam são **byte a byte iguais** às de `7d3db49` (md5): as mudanças desta
rodada não aparecem nas 60 telas da régua (nenhuma mostra as linhas de
aparelho nem um plano sem perfil). Olhei os diffs de 06, 07 e 08: são os
mesmos da rodada 10.

| tela | Δ claro | Δ escuro | o que mudou (olhando o diff) |
| --- | ---: | ---: | --- |
| 08-catalogo | 30,21 % | 28,35 % | igual à rodada 10: os selects saem, "Filtros" e o contador na mesma linha, o primeiro cartão sobe para a primeira tela |
| 07-colecao | 6,82 % | 3,97 % | igual à rodada 10: `/explorar/plano/corrida` com "5 km sem parar", "semana 2 de 12" e "Fazer a corrida da semana 2" |
| 06-explorar | 1,74 % | 1,77 % | igual à rodada 10: nas linhas dos Treinos, subtítulo antes da meta, sem negrito |

**Sonda das linhas de aparelho** (a régua não as mostra;
`r11/l12/sonda-aparelhos/sonda.cjs`, Chromium 360×740, DSF 2, nos dois
temas, com mock e app subidos por mim no `.next` de `59f92ce` e derrubados
pela árvore de PIDs): "Por aparelho" → "Ver todos" = 9 linhas; nas 9, nos
dois temas, a meta quebra em 2 linhas e a última é **"com ele"** (nunca
"ele" sozinho), o texto tem U+00A0 e `scrollWidth` = 360. Olhei
`aparelhos-1-light.png` e `aparelhos-2-dark.png`: "30 exercícios que dão
para fazer / com ele", sem corte nem sobreposição. **Observação:** a 360 px o
subtítulo do plano é cortado numa linha ("a primeira barra fixa sem elástico
e…"), então, sem perfil, a linha da barra fixa e a da corrida ficam sem o
prazo visível — ele continua no objetivo inteiro (no `title` da linha e na
página do plano). Com perfil, o caso normal, a meta "semana N de 12" diz o
prazo. (Corrigido na "Correção da auditoria 1 (rodada 11)", abaixo: a linha
sem meta mostra o subtítulo inteiro.)

##### Como testar no celular (360 px)

- **Por aparelho** ("Ver todos"): em nenhuma linha "ele" fica sozinho na
  segunda linha — quando a meta quebra, desce "com ele".
- **Busca na ordem digitada**: "barra direta supino" — o Treino A diz
  "contém Rosca direta com barra e Supino reto com barra"; "sentado
  panturrilha barra declinado" — o Banco cita só "Elevação de panturrilha
  sentado e Supino declinado com barra".
- **Planos**: com o perfil carregado, nada muda ("semana N de 12"). Sem perfil
  (logo ao abrir, antes de o perfil chegar), barra fixa e corrida mostram só
  o objetivo, sem "12 semanas" repetido embaixo — inteiro, com o prazo,
  desde a correção da auditoria 1 (abaixo).

##### Correção da auditoria 1 (rodada 11)

A auditoria 1 da rodada 11, em `ec07924`, **aprovou a lente regra** (só
menores) e **reprovou a lente tela** por um importante: sem perfil, a 360×740
e nos dois temas, as linhas "Primeira barra fixa" e "5 km sem parar" de
Planos não mostravam prazo nenhum. A meta tinha saído (item 4 acima, para
não repetir o prazo) e o subtítulo, cortado numa linha (`line-clamp-1`,
`scrollHeight` 32 contra `clientHeight` 16), parava antes de "8–12 semanas"
e de "12 semanas". Correção a partir de `ec07924`: `be81dee` (SPEC),
`dbdd44e` (lib), `ab7fdbc` (linha da coleção), `17ba741` (e2e) e o commit
deste registro.

###### O que mudou

1. **Sem perfil, o prazo volta a aparecer, uma vez só** (importante;
   `components/colecoes/linha-colecao.tsx`). **Era:** sem perfil, barra fixa
   e corrida ficavam sem meta, e na tela sobrava "a primeira barra fixa sem
   elástico e…" e "de caminhada a 5 km sem parar em…". **É:** a linha sem
   meta mostra o subtítulo **inteiro** (o corte de uma linha só vale quando
   há meta embaixo): "a primeira barra fixa sem elástico em 8–12 semanas" e
   "de caminhada a 5 km sem parar em 12 semanas (≈35 min, 7 min/km)", em 2
   linhas cada, no lugar das 2 linhas de subtítulo + meta. A linha não fica
   mais alta que a da corda. Continua valendo o contrato D: a duração total
   aparece, e não repetida. Com perfil nada muda ("semana N de 12" na meta,
   subtítulo numa linha).
2. **O motivo da busca aparece inteiro** (menor da tela; mesmo arquivo).
   **Era:** `line-clamp-2`, e "sentado panturrilha barra declinado" cortava o
   3º nome do Cavalete ("contém Desenvolvimento sentado com barra, Elevação
   de panturrilha em pé e Supino declinado com barra" precisa de 3 linhas a
   360 px). **É:** sem corte. O motivo cita no máximo um nome por termo, e
   por isso não cresce sem limite.
3. **O nome curto da fase numa função só** (menor da regra; `lib/dados.ts`
   `nomeCurtoDaFase`, `lib/semana.ts` `rotuloDaFase`; `lib/colecoes.ts`
   reexporta). **Era:** `rotuloDaFase` cortava o nome à mão
   (`acharFase(fase).nome.split("—")`), uma terceira cópia da regra. **É:** a
   função mora ao lado de `acharFase` e as três telas usam ela (CTA do
   desafio, aba Treino e cabeçalho do calendário). O texto na tela é o mesmo
   ("Fase 1 · semana 3 de 12").
4. **SPEC sem as lacunas de redação** (menores da regra; `SPEC.md`). §22.12
   item 3: o motivo inteiro, com aceite (`scrollHeight` ≤ `clientHeight` com
   4 termos). Item 4: a linha sem meta mostra o subtítulo inteiro, com
   aceite. Item 7: sem perfil, o botão da corrida é "Fazer a corrida" e leva
   a `/cardio/corrida`. Mais a nota "Rodada 11 — correção da auditoria 1".
   §13.4: barra fixa e corrida com a semana do perfil, a corda com a sua
   duração (ela não tem posição no perfil), e o objetivo inteiro quando não
   há meta. §14.4: o caso sem meta.
5. **PROGRESSO**: a rodada 10 (item 4, "sem perfil, '12 semanas'") e a
   rodada 11 (item 4 e a "Observação" das Capturas) apontam para esta
   correção.

###### Provas

- **e2e novos** (`e2e/ultraloop-a-r10.spec.ts`, 11 → 14 testes):
  - "D — planos sem perfil", em claro e escuro. Contexto novo sem o IndexedDB
    do cache, pedido de `/rest/v1/profiles` segurado e service worker
    bloqueado. Barra fixa e corrida sem `[data-linha="meta"]`, o prazo
    ("8–12 semanas" e "12 semanas") dentro da caixa visível do subtítulo
    (medido por `Range`), subtítulo sem texto escondido e "semanas" uma vez
    só no texto da linha. A corda com "12 semanas", as três linhas com a
    mesma altura (±1 px) e nenhuma rolagem lateral.
  - Busca com 4 termos: o motivo do Cavalete com os três nomes, nenhum
    motivo com texto escondido, e a frase em ≥ 3 linhas.
  - F no dia de cardio (terça 15/09): o destaque do Explorar é "Fazer a
    corrida da semana N", com o mesmo texto e `href` do carrossel da Treino.
    É o menor da regra, que só tinha o domingo.
- **Sonda** (`r11/l12/sonda-aud1/17ba741.log`): `build:e2e` e
  `e2e-grep:ultraloop-a-r10`, **14 passaram**.
- **Mutação** (`r11/l12/sonda-aud1-mutacao/17ba741.log`):
  `linha-colecao.tsx` de `ec07924` com os e2e novos dá **3 falhas** (busca
  de 4 termos: "motivo com texto escondido a 360 px"; sem perfil claro e
  escuro: `toEqual` das linhas). Arquivo restaurado e árvore limpa antes da
  cadeia.
- **Vitest (+1 caso, 1.476 → 1.477)**: "o nome curto da fase tem uma fonte
  só". Cobre a reserva pelo nome inteiro ("— sem nome curto", "  Fase 3  ")
  e que nenhum arquivo além de `lib/dados.ts` corta o nome com
  `split("—")`. Esse caso mata o mutante M22 da auditoria de regra (tirar o
  `|| nome.trim()`).
- **Menores que ficam de fora (anotados)**:
  - O conjunto citado nem sempre é o mínimo (258 de 845.780 consultas no
    oráculo da auditoria), sem violar o aceite.
  - O teste de fonte única do CTA lê o código-fonte por regex. O
    comportamento na tela está nos e2e de F, que agora cobrem os dois
    planos no destaque.
  - M6 e M20 são equivalentes, segundo a própria auditoria.
  - A mensagem da lente tela chegou cortada depois do primeiro menor (o
    motivo de 4 termos). Não vi os outros menores dela e por isso não os
    tratei.

###### Portões

Cadeia inteira no HEAD de código `17ba741` (`r11/l12/logs/17ba741.log`, das
00:11:49 às 00:33:30 UTC, **status ok**):

- `lint` limpo.
- `tsc --noEmit` limpo.
- `npm test`: **63 arquivos, 1.477 testes, todos verdes** (+1: o nome curto
  da fase).
- `build`: "Compiled successfully in 16.9s".
- `build:e2e`: "Compiled successfully in 16.9s".
- `e2e`: **440 passaram, 5 pulados, 0 falharam** (15,7 min). São +3 testes;
  os 14 de `e2e/ultraloop-a-r10.spec.ts` passaram.
- `varredura`: **5 de 5** (4,3 min).

A cadeia roda de novo, inteira, no commit deste registro, que muda só o
`PROGRESSO.md`. O log fica em `r11/l12/logs/<hash>.log`.

###### Capturas

`capturas.sh` em `17ba741`, depois da cadeia verde, contra a base real de
`main` (`base-ef3ad97`), com `--esperadas explorar,colecao,catalogo`
(`r11/l12/capturas-17ba741.md`):

- 60 PNGs, **54 iguais** (Δ 0,00 %). Nenhuma tela fora da lista mudou, e 03
  e 04 (aba Treino) ficaram iguais.
- As seis que mudam são **byte a byte iguais** às de `ec07924` e `59f92ce`
  (md5). As 60 telas da régua têm perfil e nenhuma busca, então não mostram
  a linha sem meta nem o motivo. Olhei os diffs de 06, 07 e 08: são os
  mesmos da rodada 10.

| tela | Δ claro | Δ escuro | o que mudou (olhando o diff) |
| --- | ---: | ---: | --- |
| 08-catalogo | 30,21 % | 28,35 % | igual à rodada 10: os selects saem, "Filtros" e o contador ficam na mesma linha, e o primeiro cartão sobe para a primeira tela |
| 07-colecao | 6,82 % | 3,97 % | igual à rodada 10: `/explorar/plano/corrida` com "5 km sem parar", "semana 2 de 12" e "Fazer a corrida da semana 2" |
| 06-explorar | 1,74 % | 1,77 % | igual à rodada 10: nas linhas dos Treinos, o subtítulo vem antes da meta, sem negrito |

**Sonda da tela da correção** (`r11/l12/sonda-aud1-tela/sonda.cjs`,
Chromium 360×740, DSF 2, nos dois temas). Subi mock e app no `.next` de
`17ba741` e derrubei os dois pela árvore de PIDs.

- **Sem perfil** (contexto novo, pedido do perfil segurado, service worker
  bloqueado, 1 pedido): as três linhas de Planos têm **72 px**.
  - "Primeira barra fixa | a primeira barra fixa sem elástico em 8–12
    semanas".
  - "5 km sem parar | de caminhada a 5 km sem parar em 12 semanas (≈35 min,
    7 min/km)".
  - "Corda: 5 estágios | … | 12 semanas | CIRCUITO".
  - `scrollWidth` 360.
- **Busca de 4 termos**: o motivo do Cavalete tem `scrollHeight` 48 =
  `clientHeight` 48 (3 linhas, nada escondido).
- Olhei `planos-sem-perfil-light.png` e `busca-4-termos-dark.png`. Os dois
  prazos aparecem na segunda linha do objetivo, sem reticências e sem "12
  semanas" repetido. No Cavalete, os três nomes vão até "Supino declinado
  com barra", e a meta "10 exercícios que dão para fazer / com ele" fica
  embaixo.

###### Como testar no celular (360 px)

- **Planos sem perfil** (logo ao abrir o Explorar, antes de o perfil chegar,
  ou com a rede lenta): "Primeira barra fixa" mostra o objetivo inteiro, até
  "em 8–12 semanas", e "5 km sem parar" até "em 12 semanas (≈35 min, 7
  min/km)". Nenhuma das duas tem "12 semanas" repetido embaixo. Quando o
  perfil chega, a linha volta a "semana N de 12".
- **Busca com 4 termos**: "sentado panturrilha barra declinado" no Explorar.
  O Cavalete diz os três exercícios inteiros, até "Supino declinado com
  barra", sem reticências.
- **Dia de cardio** (terça): o destaque do Explorar e o carrossel da Treino
  mostram o mesmo "Fazer a corrida da semana N".

#### Auditoria

- **Auditoria 1 em `ec07924`: reprovada** (bloqueantes 0, importantes 1,
  menores 12). O importante (sem perfil, barra fixa e corrida sem prazo
  visível a 360 px) e os menores tratados estão em "Correção da auditoria 1
  (rodada 11)", acima.
- **Auditoria 2 em `54b6853`: aprovada** (bloqueantes 0, importantes 0,
  menores 7). Nada foi comitado pelas auditorias.

Menores registrados (ficam na fila, nenhum quebra o aceite):

- **[regra]** O teste "o nome curto da fase tem uma fonte só"
  (`lib/colecoes.test.ts:815`) procura `.split("—")` só em 3 arquivos
  (`lib/semana.ts`, `lib/colecoes.ts` e `components/treino/tela-treino.tsx`).
  Um corte à mão novo em outro componente não seria pego. Hoje o grep em
  `lib/`, `components/`, `app/` e `scripts/` acha o corte só em
  `lib/dados.ts:165`, que é a fonte, então nada está quebrado.
- **[regra]** Mutante N7 sobrevive: trocar `|| nome.trim()` por `|| nome` em
  `nomeCurtoDaFase` (`lib/dados.ts`) não derruba teste. O caso "— sem nome
  curto" não tem espaço nas pontas, mas a doc diz "(aparado)". Trivial; não
  afeta os dados reais.
- **[regra]** A regra "um de cada vez" da passada final (SPEC §22.12 item 3)
  não é observável por teste. O mutante N2 (passada contra `citados`, não
  contra `finais`) passa no Vitest, mas é equivalente: saída idêntica em
  292.552 consultas reais e 203.259 sintéticas. Só registro.
- **[regra]** `e2e/ultraloop-a-r10.spec.ts`, teste "a busca diz contém…": o
  título é lido por `[data-linha="meta"]`.parentElement.firstElementChild;
  numa linha sem meta daria título vazio. Aqui há perfil, então não falha,
  mas `[data-linha="titulo"]` seria mais robusto.
- **[tela]** O termo "com" conta como termo de busca: com "puxada remada polia
  com", a coleção Costas cita "Barra fixa com lastro" só por causa do "com"
  ("contém Puxada alta na polia, Remada curvada pronada e Barra fixa com
  lastro"). (A mensagem com os menores chegou cortada neste ponto; os
  demais menores da lente tela não foram transcritos.)

**Deploy (rodada 11, 23/09 01:20 UTC).** Publicado. Deployment anterior
`dpl_55ubNHyLQbnRKa8SQaQSCc54EuHC` → novo `dpl_2HZ9YHKSNDm7NBizr4dFWeNE6Joy`;
`main` passou de `ef3ad97` para `1b37092b015f0064ce6fa724d0d5df211bed8761`
(PR #19; merge do lote na integração `2471456`, sem conflito, mais o veredito
da auditoria `fc6d7c4`) e `/versao` devolveu esse sha às 01:20:02, ~2,5 min
depois do merge (build de 01:18:36Z). O CSS de `/login` mudou de
`737ab7267490ea30` para `00c50b48cf624ca6`. Portão final na integração:
`lint` e `tsc --noEmit` limpos, 63 arquivos / 1.477 testes verdes; e2e não
repetido (código idêntico a `54b6853`: 440 e2e, 5 pulados, varredura 5/5).

Fumaça em produção **18 de 18**, item a item: `/login` 200 · com "Treino do
Terraço" · com "Entrar" · sem "Configure NEXT_PUBLIC_SUPABASE_URL" · sem
"é secreta" · `/` → 307 · para `/login` · `/versao` == sha do merge ·
`/sw.js` 200 · com `/~offline` · com `figuras/` · com o mesmo CSS do HTML de
`/login` · `/manifest.webmanifest` 200 · com "Treino do Terraço" ·
`/~offline` 200 · os 14 scripts `/_next/static` de `/login` 200 · marcadores
do lote pelo grafo de módulos a partir do chunk da página (o chunk de
`app/(app)/exercicios/page-*.js` só carrega a lista, que mora em chunks
compartilhados): o grafo de `/exercicios` contém `"Ver ".concat(`,
"Ver 1 exerc\xedcio" (chunk `1203`) e "Filtros" (chunk `9963`, módulo que a
página carrega) · o grafo de `/explorar` contém "que d\xe3o para fazer
com\xa0ele" (chunk `3014`, com o espaço inseguível). Foram seis execuções
(01:20, 01:23, 01:25, 01:26, 01:27 e 01:28 UTC, ≥ 40 s entre elas) e as 16
checagens de base passaram em todas. As falhas foram do meu script, não de
produção: na de 01:20 a checagem de marcador procurava só no chunk da página;
nas de 01:25 e 01:26 um escape errado (`\\xe3`) no marcador de `/explorar`.
Com o script corrigido, a fumaça completa deu 18 de 18 às 01:23, 01:27 e
01:28. Sonda a 360×740 (Chromium):
`/login` e `/~offline` sem erro de console e sem vazamento horizontal
(scrollWidth 360 = clientWidth). Capturas: 06/07/08 (claro e escuro) de
`capturas-54b6853` viraram a base visual (`base-ef3ad97`, `indice.json` com
head `1b37092`). Nenhuma migração de banco. **Rollback: não.**

### Rodada 12 — Lote 13 — Ficha: mídia e interação; coleções do Explorar

Branch `polimento/l13-ficha-midia`, a partir de `main` `763598a` (com o L12
publicado). SPEC §22.13. Dez itens: seis da ficha do exercício e quatro das
coleções do Explorar, que entram por **exceção de área** decidida pelo
orquestrador — Explorar e as fichas são a mesma prioridade (2) do dono
(§22.0), e os quatro itens de coleções (`tela-explorar-fichas-08`, `-13`,
`-11` e `visual-11`) não fecham lote sozinhos (4 < 6). O aceite de cada item
está no próprio item da SPEC.

#### O que mudou

1. **A caixa da ilustração tem a proporção da ilustração** (imagens-01;
   `lib/midia.ts`, `components/exercicio/media-grande.tsx`,
   `components/exercicio/ilustracao-alternada.tsx`,
   `components/exercicio/ficha-folha.tsx`). **Era:** caixa de altura fixa
   (`h-52` na página, `h-44` na folha) e largura inteira; o goblet (0,42:1)
   desenhava 81 px de figura numa caixa de 328, e a conta de antes deixa
   **100 das 145 medidas** (`h-52`, 208 px, na página) e **112** (`h-44`,
   176 px, na folha) abaixo de 60 % da coluna (correção da auditoria 2: o
   registro dizia "78+"). **É:** na aba Vídeo da ficha a
   área da figura usa o par largura/altura de `data/ilustracoes.json` como
   `aspect-ratio`, com teto de 432 px de altura de figura
   (`caixaDaIlustracao()`/`figuraNaCaixa()`, puras); a figura larga ocupa a
   coluna, a alta estreita a caixa e fica centrada. Player e capa do bloco
   na Visão geral do treino continuam com faixa de altura fixa (espaço
   vertical fixo, §13.8.1). Correção da auditoria: o segmento "Ilustração ·
   Figura · Fotos" passou para **acima** da mídia (embaixo, ele saltava até
   369 px ao trocar de vista), e o aceite dos 60 % é medido contra a
   **coluna** — os seis exercícios mais altos ficam abaixo, no teto (ver
   "Correção da auditoria").
2. **Fotos na proporção do arquivo, com legenda** (imagens-12;
   `components/exercicios/fotos-ampliaveis.tsx`,
   `components/exercicio/midia.tsx`). **Era:** `aspect-square` +
   `object-cover` cortava as fotos em quadrado (justamente a barra). As
   fotos não são uniformes (correção da auditoria 2 — o registro dizia "3:2"):
   dos 324 arquivos, 304 são 850×567, 8 são 850×569 e **12 são retrato 2:3**
   (agachamento búlgaro, barra fixa assistida e barra fixa com lastro:
   850×1275 no kit, 800×1200 na derivada). **É:** a caixa de cada foto tem a
   proporção do arquivo (`proporcaoDaFoto()`, de `data/medidas-de-foto.json`;
   3:2 na falta), a foto é `object-contain` (rodada 13: nem uma medida errada
   a cortaria) e ganha a legenda visível "Início" / "Fim" — na página e na
   opção Fotos da folha. Rodada 13: a faixa do player e da Visão geral, que
   mostra a foto dos 3 exercícios que só têm foto (escalador, salto básico,
   corrida no lugar com a corda), também passou de `object-cover` (cortava a
   foto 3:2 na faixa 2:1) para `object-contain` (`media-grande.tsx`).
3. **Só os links do crédito sublinhados** (imagens-13;
   `media-grande.tsx`). **Era:** o crédito inteiro ("Ilustração: Everkinetic
   (everkinetic.com), CC BY-SA 3.0") era um link sublinhado. **É:**
   "Ilustração: <autor> · <licença>" — o autor leva a `url_fonte`, a
   licença à página dela na Creative Commons (`urlDaLicenca()`, derivada do
   código do JSON); os dois com alvo de 44 px, o resto é texto, em 11 px.
4. **O segundo quadro espera o primeiro** (performance-13;
   `ilustracao-alternada.tsx`). **Era:** as duas posições eram `<img
   loading="lazy">` na mesma caixa visível e baixavam juntas. **É:** a
   segunda posição só entra no DOM depois que a primeira carregou e a
   ilustração vai alternar; parada (`prefers-reduced-motion`), só no toque
   em "Voltar a alternar". Rodada 13 (auditoria 2): a troca de 1,2 s só
   começa depois do `onLoad` do quadro 2, e "Voltar a alternar" só troca de
   posição na hora se ele já chegou — antes, com rede lenta ou parada, a
   caixa fazia o fade até ficar vazia. O aquecimento de mídia da fase (§8,
   `lib/precache-do-programa.ts`, por `fetch`, depois que o service worker
   assume) continua e fica fora do aceite.
5. **A figura não é o botão de pausa** (ux-heuristicas-21;
   `ilustracao-alternada.tsx`, `media-grande.tsx`,
   `components/player/exercicio.tsx`, `components/treinar/bloco.tsx`).
   **Era:** a ilustração inteira era o `<button>` "Parar em uma posição".
   **É:** a pausa é um botão redondo de 44×44 no canto de baixo à direita
   ("Parar a animação" / "Voltar a alternar", ícone Pause/Play); a figura
   diz a posição. No player e na Visão
   geral do treino, tocar na figura abre a ficha (o "Como fazer", como o "?"); na
   própria ficha a figura é `role="img"` ("Execução do …, posição 1 de 2") e
   o toque não faz nada. Rodada 13 (auditoria 2, `app/globals.css`): a
   figura-botão tem **anel de foco interno** (2 px, `outline-offset: -4px`,
   `--ring-placa` = `#a03608` nos dois temas) — o anel de fora saía cortado
   pelo `overflow-hidden` da caixa —, a pausa usa a mesma cor sobre a placa,
   e o **nome** da figura-botão é estável ("Execução do … — abre o Como
   fazer"), com a posição na **descrição**, congelada enquanto o foco está
   nela.
6. **O chip ativo do segmento se vê** (tela-explorar-fichas-18;
   `ficha-folha.tsx`). **Era:** `bg-background` sobre o trilho `bg-muted`
   (1,08:1 no claro). **É:** o ativo tem contorno de 2 px na cor do texto
   (`border-foreground`); o inativo tem o mesmo contorno transparente. O
   fundo não foi invertido: `bg-foreground` virava uma placa de 91 % de luz
   no escuro e reprovava o teste do §22.3 item 4 (visto na sonda).
7. **Linhas da vitrine com a mesma altura** (tela-explorar-fichas-08;
   `components/colecoes/linha-colecao.tsx`). **Era:** 72 ou 92 px conforme
   a coleção tinha subtítulo. **É:** a linha do subtítulo é reservada em
   toda linha (`h-4`), com ou sem texto; o subtítulo continua na vitrine.
   Com todas as seções abertas ("Ver todos"), as linhas de cada seção têm a
   mesma altura nos dois temas (e2e).
8. **A capa sem foto tem o ícone** (tela-explorar-fichas-13;
   `components/colecoes/tela-colecao.tsx`, `components/ui/card-capa.tsx`,
   `linha-colecao.tsx` exporta `ICONE_DO_TIPO`). **Era:** a capa do plano de
   corrida era um retângulo escuro; o ícone, quando havia, ficava centrado
   por baixo do véu. **É:** a tela da coleção passa o ícone do tipo (plano =
   calendário) em 48 px, que o `CardCapa` desenha no alto da capa, fora do
   véu, em `text-foreground` — só quando a tela pede (`iconeNoAlto`, correção
   da auditoria): os outros cartões sem foto, como o cardio do dia na aba
   Treino, seguem com o ícone centrado por trás e a mesma altura.
9. **A coleção de plano mostra as semanas** (tela-explorar-fichas-11;
   `lib/colecoes.ts`, `tela-colecao.tsx`). **Era:** só o cartão, ~700 px
   vazios. **É:** "Semanas do plano" com "Semana X de N · K concluídas" e a
   barra das concluídas (`progressbar`, a mesma leitura do card de
   desafio) e a lista de `data/cardio.json` — corrida semana a semana, corda
   e barra fixa por faixa —, cada linha com "feita" / "agora" / "a fazer"
   (texto e ícone), a atual com `aria-current="step"` e o link "Abrir a
   sessão desta semana" (o `href` de `ctaDoPlano()`). Regra pura
   `semanasDoPlano()` + `semanaDoPerfilNoPlano()` (corda pela
   `semana_corda`). Na faixa de semanas, "feitas" no plural (menor da
   auditoria 1).
10. **Uma marca só na coluna da direita** (visual-11; `linha-colecao.tsx`).
    **Era:** raios ao lado do título (centro a 18 px do topo) e chevron no
    meio (36 px). **É:** os raios vão no fluxo da linha da meta, **abrindo
    a meta**, antes de "N exercícios" (sem meta, ao fim do subtítulo); a
    coluna da direita tem só o chevron. Correção da auditoria: no fim da
    meta, eles caíam na 2ª linha nas 9 linhas de "Por aparelho" ("N
    exercícios que dão para fazer com ele" quebra em 2 a 360 px). O selo
    "Circuito" passou a abrir a linha do
    subtítulo: na meta, com os raios, ela quebrava (Cardio 84 px contra 72)
    e, ao lado do título, empurrava o nome da corda para 2 linhas (108
    contra 88) — os dois vistos na sonda. Rodada 13 (auditoria 2): quando o
    subtítulo é cortado numa linha (a linha tem meta — só "Corda: 5
    estágios" entre as de circuito), o selo **fecha a meta** ("12 semanas
    CIRCUITO"): abrindo o subtítulo, ele tomava ~64 px do texto cortado.

Testes que mudaram por causa do comportamento novo (não afrouxados):
`e2e/midia.spec.ts` (a pausa é o botão do canto; o crédito são dois links
com os dois `href` conferidos; o 2º quadro é esperado com `toHaveCount(2)`),
`e2e/ultraloop-a-r1.spec.ts` (reduced motion: "Voltar a alternar" no botão
do canto), `e2e/catalogo.spec.ts` e `e2e/player.spec.ts` (o nome da figura
da ficha passa a ter ", posição N de 2"). Rodada 13: `lib/midia.test.ts` (o
crédito não tem mais o campo `texto`) e o e2e do item 5 no player (nome
"… — abre o Como fazer" e a posição na descrição).

#### Correção da auditoria

Auditoria 1 em `f423151` (lentes regra e tela) reprovou; tudo o que ela
apontou como bloqueante ou importante foi atendido ou registrado:

- **Tela, bloqueante — raios na 2ª linha em "Por aparelho"** (visual-11).
  A meta "N exercícios que dão para fazer com ele" quebra em 2 linhas a
  360 px, e os raios, no fim dela, caíam na 2ª, longe de "exercícios". Os
  raios agora **abrem** a meta (`linha-colecao.tsx`), com o respiro em
  margem (a meta segue um texto só, que o e2e do L12 lê palavra a palavra).
  O e2e mede **toda** linha com raios — vitrine com todos os "Ver todos"
  abertos (as 9 de aparelho entram) e busca por "supino" e "corda": |centro
  dos raios − centro da palavra "exercícios"| ≤ 4 px.
- **Tela, importante — a busca não tem altura única** (tela-explorar-fichas-08).
  Medido 72 a 122 px. Não se cortou nada: a linha do motivo ("contém …")
  aparece inteira por decisão do §22.12 item 3, e a meta de aparelho
  quebra. A SPEC §22.13 item 7 foi corrigida: a reserva do subtítulo vale
  para toda linha, e a altura única, por seção da vitrine (o que o aceite
  mede).
- **Tela, importante — o segmento saltava ao trocar de vista** (efeito do
  item 1). Com a caixa na proporção da ilustração, a mídia muda de 130 a
  448 px de altura ao trocar Ilustração/Figura/Fotos, e o segmento, embaixo
  dela, saltava 180–369 px sob o dedo. O segmento passou para **acima** da
  mídia (`ficha-folha.tsx`). e2e novos: na página do goblet e na folha
  (Fotos → Figura → Ilustração), o topo do segmento fica a ≤ 1 px de onde
  estava.
- **Regra, importante — "≥ 60 % da caixa" era tautológico** (imagens-01).
  A caixa estreita até a figura, então a fração contra a caixa só falharia
  com caixa < 40 px. O Vitest e o e2e medem agora contra a **coluna** de
  328 px, e contra ela o teto de 432 px deixa **seis exercícios** abaixo de
  60 %: tríceps na corda 47 %, elevação frontal 49 %, extensão unilateral
  49 %, puxada com triângulo 52 %, pullover na polia 54 % e goblet 56 %
  (12 das 145 medidas). Para o tríceps chegar a 60 % (197 px de figura) ela
  teria 556 px de altura e não caberia na tela de 740 com o segmento: essa
  metade do aceite fica **registrada como inviável** para esses seis (SPEC
  §22.13 item 1). O teste lista os seis pelo id e exige que cada um esteja
  no teto (432 ± 2 px), e que toda figura ocupe a coluna ou bata no teto.
  Mutação (teto 100 px, revertida): 3 testes caem, entre eles o novo dos
  60 % contra a coluna — antes, o dos 60 % passava com teto 100. O goblet
  com 183 px (≥ 180) segue provado.
- **Regra, importante — o ícone da capa mudava o cardio do dia na aba
  Treino** (tela-explorar-fichas-13). A mudança no `CardCapa` valia para
  todo cartão sem foto, e o de corrida/caminhada crescia de 160 para ≈ 189
  px (estimativa da auditoria, pela conta do CSS). O ícone no alto passou a ser opção (`iconeNoAlto`), que só a tela da
  coleção liga; os outros cartões voltaram ao ícone centrado por trás, como
  em `main`.
- **Regra, importante — o toque na figura da Visão geral sem e2e, e a linha
  04 da tabela de capturas errada** (ux-heuristicas-21). e2e novo: na Visão
  geral do treino, tocar na figura do bloco abre a ficha (a aba "Vídeo") e
  não pausa. A tabela de capturas abaixo não diz mais que a 04 mostra a
  mídia: a 04 é a lista do treino (`components/treino/lista.tsx`), que não
  monta a `MediaGrande`.
- **Regra, importante — a SPEC se contradizia sobre a corda.** O §13.4 e o
  comentário de `metaDoPlano()` diziam que a corda "não tem posição no
  perfil"; ela tem (`profiles.semana_corda`), e a lista das semanas usa. Os
  dois textos agora dizem o que o código faz: a meta da vitrine e da capa é
  a duração; a posição aparece na lista das semanas.
- **Menores atendidos:** "Semanas 1–2 … feitas" no plural; o teste da folha
  foi renomeado ("aberta pelo Como fazer do player") e mede contra a
  coluna; SPEC e PROGRESSO dizem "Visão geral do treino" em vez de "lista
  do treino". **Menores não atendidos** (sem risco de regressão, ficam
  anotados): o nome acessível da figura muda a cada 1,2 s (atendido na
  rodada 13, ver "Correção da auditoria 2"); o bloco de
  progresso das semanas repete o do card de desafio (refatoração fora do
  lote); o aceite do item 4 fala em LCP e o e2e mede a ordem dos pedidos;
  `data-ilustracao="alternando"` antes da primeira posição carregar.

#### Rodada 12 — auditoria 2 reprovou; lote devolvido à fila

A auditoria 2, em `8d2fa10` (cadeia `r12/l13/logs/8d2fa10.log` ok: 1.494
unit, e2e 464 + 5 pulados, varredura 5/5), **aprovou a lente regra** (6
menores) e **reprovou a lente tela** por **1 bloqueante**: regressão de
acessibilidade (WCAG 2.4.7) trazida pelo item 5 — a figura virou um
`<button data-figura="abre">` que ocupa a caixa inteira, a caixa tem
`overflow-hidden`, e o anel global de foco (outline de 2 px com offset de
2 px, para fora) saía **inteiro cortado**: 0 px mudavam com o foco por Tab
no player e na Visão geral (em `main` a própria caixa era o botão e o anel
aparecia). Mais 4 menores de tela. Pela regra do dono, o lote foi
**devolvido à fila** ao fim da rodada 12. Vereditos:
`r12/l13/vereditos-auditoria-2.json`.

#### Rodada 13 — retomada

Ciclo novo sobre o HEAD `8d2fa10` da mesma branch, com a pasta de logs
nova `r13/l13/`. Commits: `5f8e8ee` (SPEC §22.13 primeiro), `bd630ab`
(figura-botão: anel interno, nome estável, troca depois do quadro 2),
`26f8b55` (fotos em `object-contain`), `8183b5f` (crédito sem o campo morto),
`1642ff2` (selo na meta), `f5dfbcc` (testes), `704ca40` (o teste de retrato
mede a página — o segmento da página não tem "Fotos", a 1ª sonda caiu nos 3
— e a medida do anel vai para o log). Sonda antes da cadeia
(`r13/l13/logs-parcial/f5dfbcc.log`): build:e2e + o spec do L13, 31 de 34 —
as 3 falhas eram esse teste novo de retrato.

#### Correção da auditoria 2

- **Tela, bloqueante — o anel de foco da figura-botão sumia** (item 5;
  `app/globals.css`, `ilustracao-alternada.tsx`). O anel de
  `[data-figura="abre"]` passou a ser **interno**: 2 px com
  `outline-offset: -4px`, dentro do respiro de 8 px (não cobre a figura), com
  o arredondado da caixa (`rounded-[inherit]`). A cor é um token novo,
  `--ring-placa` = `#a03608` nos dois temas: a placa da ilustração é clara
  nos dois (`#fff` / `#cfcac4`) e o `--ring` do escuro (`#fb923c`) mede 1,4:1
  contra `#cfcac4`; `#a03608` dá 6,9:1 contra o branco e 4,3:1 contra
  `#cfcac4`. O botão de pausa, por fora na mesma placa, passou à mesma cor
  (no escuro ele também dava 1,4:1). e2e novo, no player e na Visão geral,
  nos dois temas, com reduced motion (a figura parada): Tab até a figura,
  captura com e sem foco (`blur()`, sem mexer na rolagem) — mais de 500 px
  têm de mudar, e o pixel do anel (a 3 px da borda), lido na captura, mede
  ≥ 3:1 contra o mesmo pixel sem foco; o mesmo na pausa (mais de 100 px e
  ≥ 3:1 a 3 px por fora dela). **Mutação** (`r13/l13/logs-mutacao/`, a regra
  do anel interno trocada por um seletor que não casa, não comitada, depois
  restaurada): os 4 casos caem com **0 px** mudando na figura — o mesmo 0 px
  que a auditoria mediu —, e os 3 de retrato passam no mesmo build.
- **Tela, menor — nome acessível mudando a cada 1,2 s num focável.** A
  figura-botão tem nome **estável** ("Execução do … — abre o Como fazer") e a
  posição ("posição N de 2") vai na **descrição** (`aria-describedby`),
  congelada enquanto o foco está nela — o leitor de tela ouve a posição ao
  chegar e não repete o anúncio. Na ficha a figura não é focável e segue
  `role="img"` com a posição no nome. e2e novo: com o foco na figura, a
  posição troca e nome e descrição continuam iguais; sem o foco, a descrição
  volta a acompanhar a posição. SPEC §22.13 item 5 registra o motivo.
- **Tela, menor — o selo "Circuito" cortava o subtítulo da corda** (item
  10; `linha-colecao.tsx`). Com o subtítulo cortado numa linha (há meta), o
  selo fecha a meta; nos outros casos continua abrindo a linha do
  subtítulo. e2e novo em Planos e na busca "corda": o selo está na meta, o
  subtítulo começa na coluna do título (±1 px) e a meta fica numa linha.
- **Regra, menor — o quadro 2 e o intervalo** (item 4). A troca de 1,2 s
  só começa depois do `onLoad` do quadro 2, e "Voltar a alternar" só troca
  de posição na hora se ele já chegou. e2e novo (service worker bloqueado,
  quadro 2 atrasado 2,5 s pelo `route`): parada, depois do toque a posição
  fica na 1 enquanto o quadro 2 não chegou (mais de 3 amostras vistas) e
  passa à 2 depois.
- **Regra, menor — "as fotos são 3:2"** (item 2). Os dados têm 304 fotos
  850×567, 8 em 850×569 e 12 em retrato 2:3. As fotos passaram a
  `object-contain` (a caixa já tinha a proporção do arquivo: nenhuma era
  cortada, e agora nem uma medida errada cortaria), e a faixa do player e
  da Visão geral, que mostrava a foto de 3:2 em `object-cover` numa faixa
  2:1 nos 3 exercícios que só têm foto, também. Vitest novo: as 162 fotos de
  `data/exercicios.json` (324 arquivos, JPEG e WebP) com a proporção da
  caixa igual à do JPEG do kit lido do disco pelo `sharp` (±0,005), e 12
  em retrato — as dos três exercícios. e2e novo nos três em retrato: na
  página do exercício, as 2 fotos com caixa 2:3, `object-fit: contain` e
  altura ≥ 1,45 × a largura (na página o segmento não tem "Fotos"; a opção
  Fotos da folha usa a mesma conta e segue medida no supino). SPEC e este
  registro corrigidos.
- **Regra, menor — `credito().texto` morto.** Saiu de `lib/midia.ts` (e do
  tipo `CreditoDaMidia`); o rótulo "Ilustração:" existe só na legenda.
- **Regra, menor — a nota do plural no item errado.** Foi do item 10 para o
  item 9, onde estão as semanas do plano.
- **Regra, menor — "78+".** O registro, a SPEC e o teste dizem agora os
  números da conta: 100 de 145 com `h-52` (página) e 112 de 145 com `h-44`
  (folha); o teste exige os dois números exatos.
- **Regra, menor — o teste do teto não pegava teto errado.** Ele passava
  com 100, 500 ou 1000 px. Teste novo: o teto fica entre o mínimo que leva o
  goblet a 180 px (425) e o máximo que cabe na página a 360×740 com o
  segmento, o crédito e a barra de baixo (440); e um que prende a folga ao
  `p-2` do componente (com FOLGA 0 nenhum unitário caía).
- **Tela, menores não atendidos:** a ficha pula de H1 para H3 (pré-existente
  em `main`, fora do lote); a 28-player-exercicio sai com Δ 0,00 % porque a
  captura mascara a mídia animada — o anel e a pausa são medidos no e2e.

#### Correção da auditoria 3

A auditoria 3 (`73b9c23`) aprovou na lente da tela e reprovou na da regra
com um importante, sem bloqueantes. Atendidos o importante e três menores:

- **Regra, importante — a troca de exercício no lugar herdava o estado da
  ilustração** (item 4; `components/exercicio/media-grande.tsx`,
  `components/exercicio/ficha-folha.tsx`). Era: a ficha aberta no player
  troca de exercício sem fechar (‹ › e "Substituir"), e a
  `IlustracaoAlternada` (sem `key`) guardava a posição, "quadro 1 pronto",
  "quadro 2 pedido" e "quadro 2 chegou" do exercício anterior — o quadro 2
  novo era pedido junto com o 1, a troca começava na hora e, com a posição
  2 herdada, a caixa mostrava um quadro que ainda não tinha chegado (o
  "fade até a caixa vazia" que a auditoria 2 dizia resolvido). É: a
  ilustração tem `key` na lista de quadros (na aba Vídeo da ficha e na aba
  Músculos da folha) e nasce de novo a cada exercício — posição 1, o quadro
  2 esperando o 1 e a troca esperando o 2; a pausa volta a seguir a
  preferência do sistema. SPEC §22.13 item 4 ganhou a nota e o aceite.
- **Regra, menor — figura invisível ao passar para um exercício de um
  quadro** (anterior ao lote; mesma causa): a posição 2 herdada deixava a
  única `<img>` em `opacity-0`. Resolvido pela mesma `key`.
- **Regra, menor — quadro 2 que não chega** (`ilustracao-alternada.tsx`).
  Era: com o quadro 2 em erro (404, ou sem rede e fora do cache), a figura
  ficava "alternando" para sempre, com o botão dizendo "Parar a animação".
  É: `onError` no quadro 2 → a ilustração vira a imagem parada de um quadro,
  sem o botão de pausa (o nome volta a ser só o `alt`).
- **Regra, menor — a faixa do player e da Visão geral sem teste** (item 2).
  Unitário novo `lib/midia-faixa-l13.test.ts`: nos 3 exercícios só com
  foto, o `<img>` que a `MediaGrande` desenha (renderizado no servidor com
  `renderToStaticMarkup`) na faixa do player (`h-40`) e na capa do bloco
  (`h-36 rounded-none`) tem `object-contain` e não `object-cover`. Para o
  Vitest transformar o JSX do componente, `vitest.config.mts` ganhou
  `oxc: { jsx: { runtime: "automatic" } }` (o tsconfig é `"jsx":
  "preserve"`, do Next); nada muda no build do app.
- **Regra, menor — comentário velho** em `lib/midia.ts`
  (`proporcaoDaFoto` falava em `object-cover`): corrigido.
- **Não atendidos (registrados):** a ficha pula de H1 para H3 (já em `main`,
  e a mesma seção serve a folha, onde H2 → H3 está certo; mudar o nível
  pede um parâmetro em quatro componentes e mexe em seletores de e2e — fica
  para um lote de acessibilidade); o aceite do item 4 fala em LCP e o e2e
  mede a ordem dos pedidos (a ordem é o mecanismo; o LCP a 360 px com a
  mídia mascarada não é medível pela captura); o bloco de progresso das
  semanas repete o do card de desafio (é a mesma informação na tela do
  plano, pedida no item 9); "Corda: 5 estágios" com o ícone no lugar da
  foto na busca por "corda" (regra de capa sem repetição da §22.9 item 7,
  anterior ao lote).

#### Provas

- **Vitest (+17 casos):** `lib/midia-l13.test.ts` (11 — as 145 medidas do
  JSON contra a coluna de 328 px: só as 12 medidas dos seis exercícios mais
  altos ficam abaixo de 60 %, pelo id, e todas com a figura no teto
  (432 ± 2 px); toda figura ocupa a coluna ou bate no teto; a conta da caixa
  fixa de antes deixava abaixo de 60 % da coluna 100 das 145 (h-52) e 112
  (h-44) — "≥ 78" até a rodada 12; goblet ≥ 180 px; larga ocupa a coluna e alta para no teto; a
  proporção é o par do arquivo; toda foto de execução (JPEG e WebP) tem
  proporção de arquivo, não quadrada; 3:2 sem medida; toda licença do JSON
  vira `creativecommons.org/licenses/by-sa/N.0/`; código que não é CC fica
  sem link) e `lib/colecoes-l13.test.ts` (6 — `semanasDoPlano('corrida', 3)`
  com 12 linhas, 2 feitas, a 3ª atual e a descrição igual à do JSON; corda na
  semana 5 no estágio 5–6; barra fixa com séries e assistência do JSON; uma
  linha atual só, em todo plano e toda semana de −1 a total+3, faixas de 1
  ao total; sem perfil, sem estado; a semana do perfil por plano).
- **e2e (+24 casos, `e2e/ultraloop-l13.spec.ts`)**, a 360×740, contra o
  mock: goblet ≥ 180 px de figura e no teto, tríceps na corda (0,35:1) no
  teto, prancha (2,7:1) e supino ≥ 60 % da coluna, nos dois temas; na folha
  aberta pelo "Como fazer" do player, ≥ 60 % da coluna ou no teto; o topo
  do segmento parado (≤ 1 px) ao trocar de vista, na página do goblet e na
  folha (Fotos, Figura, Ilustração); fotos com |proporção da caixa − do arquivo| ≤ 0,02 e legendas
  "Início"/"Fim" visíveis, na página e na opção Fotos da folha; crédito com
  dois links sublinhados de ≥ 44×44, texto de fora sem sublinhado e 11 px,
  nos dois temas; o pedido de imagem do quadro 2 começa depois do fim do
  quadro 1, e com reduced motion nenhum pedido do quadro 2 até "Voltar a
  alternar"; no player o toque no meio da figura abre a ficha e ela segue
  alternando, o botão do canto (≥ 44×44, no canto de baixo à direita) pausa;
  na Visão geral do treino, o toque na figura do bloco abre a ficha e não
  pausa; na ficha o toque no meio não pausa; o contorno do chip ativo ≥ 3:1 contra o
  trilho e o texto ≥ 4,5:1, nos dois temas; em cada uma das cinco seções de
  "Escolhas para você", com "Ver todos" aberto, todas as linhas com a mesma
  altura (±1 px), nos dois temas; vitrine (todos os "Ver todos" abertos) e
  busca ("supino" e "corda") sem marca no canto de cima, chevron a ≤ 2 px
  do centro, raios dentro da meta e, em toda linha com raios (as 9 de
  aparelho incluídas), a ≤ 4 px do centro da palavra "exercícios"; `/explorar/plano/corrida` com o ícone ≥ 48 px
  acima do título e ≥ 3:1 lido na captura (sharp), `progressbar` com
  `aria-valuenow` 2 de 12, 12 linhas, 2 feitas, a 3ª com `aria-current` e o
  link `/cardio/corrida?semana=3`, `scrollHeight` > 740 e todo texto da
  lista ≥ 4,5:1; `/explorar/plano/corda` com `aria-valuenow` 4, 5 estágios e
  "Semanas 5–6" atual — nos dois temas.
- **Rodada 13 (correção da auditoria 2): Vitest +3, e2e +10.** Vitest
  (`lib/midia-l13.test.ts`): o teto entre 425 e 440 px; a folga presa ao
  `p-2`; as 162 fotos do JSON (324 arquivos) contra o JPEG do kit lido pelo
  `sharp`, 12 em retrato; e a conta da caixa de antes com os números exatos
  (100 e 112, no lugar de "≥ 78"). e2e (`e2e/ultraloop-l13.spec.ts`): anel
  da figura e da pausa por Tab no player e na Visão geral, nos dois temas (4
  — no log da cadeia: a figura muda ~7.230 a 7.550 px com o foco, e o anel
  mede **6,94:1** no claro e **4,26:1** no escuro; a pausa, 6,88:1 e
  4,22:1); nome e descrição estáveis com o foco na figura (1); quadro 2
  atrasado 2,5 s sem troca para o vazio (1); as fotos em retrato inteiras
  nos 3 exercícios (3); o selo na meta da "Corda: 5 estágios" em Planos e
  na busca (1). O e2e do item 5 no player passou a pedir o nome estável e a
  posição na descrição.
- **Rodada 13, correção da auditoria 3: Vitest +9, e2e +3.** Vitest
  (`lib/midia-faixa-l13.test.ts`, 9): os 3 exercícios só com foto, e cada
  um com `object-contain` (e sem `object-cover`) na faixa do player e na
  capa do bloco, com a altura de quem chama. e2e
  (`e2e/ultraloop-l13.spec.ts`, 3, com o service worker bloqueado para o
  `route` valer): na ficha aberta no player, com o agachamento livre na
  posição 2, › leva ao supino com o quadro 2 atrasado 2,5 s — o pedido do
  quadro 2 do supino começa depois do fim do pedido do quadro 1, e a
  posição fica na 1 em todas as amostras enquanto ele não chegou, passando
  à 2 depois; da posição 2 da rosca direta, › leva à elevação de pernas na
  barra fixa (um quadro) com a imagem carregada e opacidade 1; na página do
  supino com o pedido do quadro 2 abortado, a ilustração fica "parada", na
  posição 1, visível e sem botão de pausa. **Sonda** `r13/l13/logs-parcial/09d3ba5.log`
  (lint, tsc, build:e2e e os 3 novos): ok, 3 de 3. **Mutação**
  (`r13/l13/logs-mutacao/a1d2675.log`: sem a `key` na `MediaGrande` e sem o
  `onError` do quadro 2, não comitada, depois restaurada): os 3 caem —
  posição "2" herdada no supino, opacidade "0" na elevação de pernas e
  "alternando" com o quadro 2 abortado. O unitário novo, com a faixa em
  `object-cover` (mutação à mão, restaurada): 6 de 9 caem.
- **Sondas antes da cadeia** (`r12/l13/sonda/`): 1ª execução do spec novo
  derrubada pelo mock sem reset (signup 422) → `resetarMock()` no
  `beforeEach`, como os outros specs do ultraloop (config em série,
  `workers: 1`); 2ª: 114 de 116 nos specs tocados (L13, r10, midia, r1,
  catalogo, b-r1, player, treinar, auditoria-m5) — as 2 falhas eram a linha
  da corda/Cardio mais alta com o selo, corrigida no item 10; 3ª: 76 de 77
  (L13, r10, b-r1, treino-v2, a-r2) — a falha era o fundo invertido do chip
  (91 % de luz no escuro), corrigido no item 6; 4ª: 46 de 46 (L13, a-r2,
  midia).
- **Sondas da correção** (`r12/l13/sonda-aud/`): `9a6aec0` — lint e tsc
  limpos, build:e2e, 72 de 74 nos specs tocados (L13, r10, midia, catalogo,
  player, a-r1); as 2 falhas eram do spec novo — a folha ainda deslizava na
  1ª leitura do segmento (2,76 px; a leitura passou a esperar 3 medidas
  iguais) e, com a ficha por cima, a Visão geral sai da árvore de
  acessibilidade (o teste passou a achá-la por CSS); `0ce0ad0` — L13 24 de
  24. Mutação do teto (100 px, revertida): 3 testes do `midia-l13` caem.

#### Portões

**Rodada 13, correção da auditoria 3.** Cadeia inteira em `c58f69d` (o
HEAD com o código, os testes e a SPEC da correção;
`r13/l13/logs/c58f69d.log`, das 06:11:17 às 06:35:13 UTC, **status ok**):
`lint` limpo · `tsc --noEmit` limpo · `npm test` **66 arquivos, 1.506
testes, todos verdes** (+1 arquivo e +9 testes sobre `fcae02e`) · `build`
("Compiled successfully in 17.5s") · `build:e2e` ("Compiled successfully in
17.8s") · `e2e` **477 passaram, 5 pulados, 0 falharam** (17,8 min; +3 da
correção; os 5 pulados são os da varredura, que roda à parte) ·
`varredura` **5 de 5** (4,3 min). A cadeia roda de novo, inteira, no commit
deste registro (só `PROGRESSO.md` muda), e o log dele fica em
`r13/l13/logs/<hash>.log`.

**Rodada 13.** Cadeia inteira em `fcae02e` (o HEAD com todo o código e os
testes da correção da auditoria 2; `r13/l13/logs/fcae02e.log`, das
05:03:33 às 05:27:05 UTC, **status ok**): `lint` limpo · `tsc --noEmit`
limpo · `npm test` **65 arquivos, 1.497 testes, todos verdes** (+3 sobre a
rodada 12) · `build` ("Compiled successfully in 17.9s") · `build:e2e`
("Compiled successfully in 18.7s") · `e2e` **474 passaram, 5 pulados, 0
falharam** (17,4 min; +10 da correção; os 5 pulados são os da varredura,
que roda à parte) · `varredura` **5 de 5** (4,3 min). A cadeia roda de
novo, inteira, no commit deste registro (só `PROGRESSO.md` muda), e o log
dele fica em `r13/l13/logs/<hash>.log`.

**Rodada 12.** Cadeia inteira no HEAD de código da correção, `0ce0ad0`
(`r12/l13/logs/0ce0ad0.log`, das 03:44:55 às 04:07:04 UTC, **status ok**):
`lint` limpo · `tsc --noEmit` limpo · `npm test` **65 arquivos, 1.494
testes, todos verdes** (eram 63 / 1.477 em `763598a`; +2 arquivos, +17
testes) · `build` ("Compiled successfully in 16.5s") · `build:e2e`
("Compiled successfully in 15.9s") · `e2e` **464 passaram, 5 pulados, 0
falharam** (469, 16,2 min; +24 do lote) · `varredura` **5 de 5** (4,2 min).
Antes da auditoria, `32826d5` e `f423151` tinham dado 1.493 unit e e2e
461 + 5 pulados. A cadeia roda de novo, inteira, no commit deste registro
(só `PROGRESSO.md` muda), e o log dele fica em `r12/l13/logs/<hash>.log`.

#### Capturas

**Rodada 13, correção da auditoria 3.** `capturas.sh` em `c58f69d`, depois
da cadeia verde, contra a mesma base real de `main` (`base-ef3ad97`), com
as seis telas declaradas (`r13/l13/capturas-c58f69d.md`): 60 PNGs,
"Nenhuma tela mudou fora do esperado" — 48 fora da lista com Δ 0,00 %. As
60 capturas são **idênticas byte a byte** às de `fcae02e` (`cmp`, 60 de
60): a correção só muda o que acontece ao trocar de exercício no lugar e
com o quadro 2 em erro, e nenhuma das duas coisas aparece numa captura
parada. Diffs abertos (09 claro, 10 escuro, 06 escuro, 07 claro): os
mesmos da rodada 13, descritos abaixo.

| tela | Δ claro | Δ escuro | o que mudou na correção da auditoria 3 |
| --- | ---: | ---: | --- |
| 09-ficha-exercicio | 48,88 % | 46,83 % | nada (mesmo arquivo de `fcae02e`) |
| 07-colecao | 25,89 % | 36,36 % | nada (mesmo arquivo) |
| 10-ficha-folha | 5,00 % | 5,00 % | nada (mesmo arquivo; a aba Músculos ganhou a `key`, e a mídia dela sai mascarada) |
| 06-explorar | 1,17 % | 1,18 % | nada (mesmo arquivo) |
| 28-player-exercicio | 0,00 % | 0,00 % | nada: a mídia animada sai mascarada |
| 04-treino-lista | 0,00 % | 0,00 % | nada: não monta a `MediaGrande` |

**Rodada 13.** `capturas.sh` em `fcae02e`, depois da cadeia verde, contra
a mesma base real de `main` (`base-ef3ad97`), com as seis telas declaradas
(`r13/l13/capturas-fcae02e.md`): 60 PNGs; **nenhuma tela fora da lista
mudou** (52 com Δ 0,00 %, inclusive a 03-treino-topo), e as que mudaram
dão os mesmos Δ da rodada 12:

| tela | Δ claro | Δ escuro | o que mudou na rodada 13 (olhando o diff e a captura de `0ce0ad0`) |
| --- | ---: | ---: | --- |
| 09-ficha-exercicio | 48,88 % | 46,83 % | o mesmo da rodada 12 (abaixo). Contra a captura de `0ce0ad0`, 154 px (claro) e 206 px (escuro) diferem em no máximo 2 e 4 níveis de canal, todos na tira de fotos no pé (y 632–740 CSS px): a reamostragem de `object-contain` no lugar de `object-cover` numa caixa que já tinha a proporção do arquivo — invisível |
| 07-colecao | 25,89 % | 36,36 % | idêntica à de `0ce0ad0` (mesmo md5) |
| 10-ficha-folha | 5,00 % | 5,00 % | o mesmo da rodada 12; contra `0ce0ad0`, 146 e 205 px na tira de fotos, até 2 e 4 níveis (a mesma reamostragem) |
| 06-explorar | 1,17 % | 1,18 % | idêntica à de `0ce0ad0` (mesmo md5): a seção Planos, onde o selo da corda passou para a meta, fica abaixo da dobra; o selo é medido no e2e |
| 28-player-exercicio | 0,00 % | 0,00 % | a mídia animada sai mascarada; o anel interno da figura e o da pausa só aparecem com foco por teclado e são medidos no e2e (pixels e contraste) |
| 04-treino-lista | 0,00 % | 0,00 % | não monta a `MediaGrande` |

**Rodada 12.** `capturas.sh` em `0ce0ad0`, depois da cadeia verde, contra a base real de
`main` (`base-ef3ad97`, com 06/07/08 já do L12), com as seis telas
declaradas como esperadas (`r12/l13/capturas-0ce0ad0.md`). 60 PNGs;
**nenhuma tela mudou fora da lista** (as 48 fora dela deram Δ 0,00 %,
inclusive a 03-treino-topo).

| tela | Δ claro | Δ escuro | o que mudou (olhando a captura e o diff) |
| --- | ---: | ---: | --- |
| 09-ficha-exercicio | 48,88 % | 46,83 % | supino: o segmento "Ilustração · Figura" (o ativo com contorno de 2 px) subiu para logo abaixo das abas, **acima** da ilustração (correção da auditoria); a caixa da ilustração (mascarada em magenta pela captura, por ser animada) passou de 328×208 para 328×340 CSS px — a proporção do arquivo, 276:287; embaixo dela o crédito "Ilustração: Everkinetic (everkinetic.com) · CC BY-SA 3.0" com só os dois links sublinhados; o resto da página desceu (as fotos 3:2 começam no pé da tela) |
| 07-colecao | 25,89 % | 36,36 % | igual à captura de antes da auditoria (mesmo md5): `/explorar/plano/corrida` com o ícone de calendário no alto da capa, fora do véu, e abaixo "Semanas do plano" com "Semana 2 de 12 · 1 concluída", a barra e a lista (Semana 1 "feita", Semana 2 "agora" com "Abrir a sessão desta semana", Semana 3 "a fazer") |
| 10-ficha-folha | 5,00 % | 5,00 % | igual à de antes da auditoria (mesmo md5; a captura é a aba Músculos, sem o segmento): a tira das duas fotos no pé da tela em caixas 3:2 no lugar do quadrado |
| 06-explorar | 1,17 % | 1,18 % | nas linhas de "Treinos do programa" os raios saíram do canto de cima à direita e agora **abrem** a última linha, antes de "6 exercícios · ~44 min" (correção da auditoria: antes vinham depois); à direita só o chevron; a altura das linhas não mudou (72 px) |
| 28-player-exercicio | 0,00 % | 0,00 % | a caixa da ilustração é mascarada pela captura (animação), então o botão de pausa no canto não aparece nela; ele é medido no e2e do item 5 (≥ 44×44, canto de baixo à direita) |
| 04-treino-lista | 0,00 % | 0,00 % | a 04 é a lista do treino na aba Treino (`components/treino/lista.tsx`), que não monta a `MediaGrande`: nada deste lote aparece nela. O toque na figura da **Visão geral do treino** (`components/treinar/bloco.tsx`) abrindo a ficha é do e2e novo do item 5 |

#### Como testar no celular (360 px)

- **Ficha do agachamento goblet** (Explorar → Exercícios → "goblet"): a
  figura aparece grande, numa caixa estreita e alta, centrada — não mais
  espremida numa faixa larga. A prancha ocupa a largura toda, baixa.
- **Pausa no canto**: na mesma ficha, o botão redondo no canto de baixo à
  direita da ilustração para a animação ("Parar a animação") e volta a
  alternar. Tocar no meio da figura não pausa.
- **Player**: comece o treino do dia; no primeiro exercício, toque no meio
  da ilustração — abre a ficha ("Como fazer"), e a figura continua
  alternando. O botão do canto pausa.
- **Trocar de exercício na ficha do player** (correção da auditoria 3):
  com a ficha aberta, espere a figura alternar e toque em › — a figura do
  próximo aparece na posição de início e só começa a alternar depois que
  as duas posições carregaram; da rosca direta para a elevação de pernas na
  barra fixa (uma posição só), a figura aparece parada, nunca uma caixa
  vazia.
- **Fotos**: na ficha do supino reto, role até as duas fotos — inteiras, na
  proporção da foto (a barra aparece), com "Início" e "Fim" embaixo. Na
  folha (o "?" do player), a opção "Fotos" do segmento mostra o mesmo. Na
  ficha do agachamento búlgaro (e das duas barras fixas) as fotos são em pé
  (2:3): inteiras, mais altas que largas, sem corte.
- **Foco por teclado** (teclado Bluetooth no celular, ou no computador): no
  player, Tab até a ilustração — aparece um anel laranja-escuro por dentro
  da borda da caixa, nos dois temas; mais um Tab, o anel em volta do botão
  de pausa. O leitor de tela diz "Execução do … — abre o Como fazer" e a
  posição uma vez, sem repetir enquanto a figura alterna.
- **Crédito**: sob a ilustração, "Ilustração: Everkinetic (everkinetic.com)
  · CC BY-SA 3.0" — só o autor e a licença sublinhados; cada um abre a sua
  página.
- **Segmento Ilustração · Figura · Fotos** (folha): o escolhido tem
  contorno escuro no claro e claro no escuro. Ele fica acima da mídia: na
  ficha do goblet, toque "Figura" e depois "Ilustração" — o segmento não sai
  de baixo do dedo.
- **Visão geral do treino** (o ícone de lista no player): toque no meio da
  figura de um bloco — abre o "Como fazer" daquele exercício.
- **Explorar**: em cada seção de "Escolhas para você", as linhas têm a mesma
  altura; os raios abrem a última linha, antes de "N exercícios" — em
  "Por aparelho" também, na primeira das duas linhas da meta; à direita só
  o chevron. Cardio e os circuitos mostram o selo "Circuito" no começo da
  segunda linha; no plano "Corda: 5 estágios" (subtítulo cortado numa
  linha) o selo fecha a última, depois de "12 semanas", e o subtítulo começa
  na coluna do título.
- **Plano de corrida** (Explorar → Planos → "5 km sem parar"): a capa tem o
  ícone de calendário; embaixo, "Semanas do plano" com "Semana N de 12 · K
  concluídas", a barra e as 12 semanas, as anteriores "feita", a atual
  "agora" com "Abrir a sessão desta semana". Na corda, os 5 estágios.

#### Auditoria

- **Auditoria 1 em `73b9c23`: reprovada** (bloqueantes 0, importantes 1,
  menores 7). O importante (a ilustração herdava o estado ao trocar de
  exercício no lugar, na ficha do player) e três menores estão em "Correção
  da auditoria 3", acima.
- **Auditoria 2 em `b5d9db5`: aprovada** (bloqueantes 0, importantes 0,
  menores 6). Nada foi comitado pelas auditorias.

Menores registrados (ficam na fila, nenhum quebra o aceite):

- **[regra]** A key da aba Músculos da folha
  (`components/exercicio/ficha-folha.tsx:376-377`,
  `key={ilustracao.urls.join('|')}`) não tem teste: se ela sair, nenhum
  unitário nem e2e cai. A mutação do construtor (`logs-mutacao/a1d2675.log`)
  tirou só a key da MediaGrande e o `onError`. O e2e novo cobre só a seta ›;
  o caminho "Substituir", citado na SPEC §22.13 item 4, também não tem e2e.
  O mecanismo é o mesmo nos dois (a key remonta a ilustração), então o risco
  é baixo.
- **[regra]** Anterior ao lote e fora dele: o estado `figuraQuebrou` da
  MediaGrande (`components/exercicio/media-grande.tsx:59`) também passa de um
  exercício para o outro na troca no lugar (‹ › e Substituir da ficha no
  player), porque a MediaGrande não tem key. Se a figura do exercício A deu
  erro, o B, na vista "Figura", cai direto na foto. É raro: as figuras do
  programa estão no precache.
- **[regra]** Seguem valendo os menores já registrados com motivo no
  PROGRESSO: a ficha pula de H1 para H3 (igual em main); o aceite do item 4
  fala em LCP e o e2e mede a ordem dos pedidos; o bloco de progresso das
  semanas repete o do card de desafio; na busca por "corda", "Corda: 5
  estágios" aparece com o ícone, pela regra de capa sem repetição (§22.9
  item 7, anterior ao lote).
- **[tela]** A ficha pula de H1 para H3. Medido em
  `/exercicios/agachamento-goblet`: "H1: Agachamento goblet", depois "H3:
  Instruções … H3: Seu histórico". Já era assim em main (`git grep` em
  `763598a` mostra os mesmos `<h3>` em `components/exercicio/ficha-folha.tsx`
  126/178/199/446). Não é regressão.
- **[tela]** O alt "Execução do <nome>" erra o gênero nos nomes femininos
  ("Execução do Prancha"; "do" também na Remada, na Rosca e na Elevação de
  pernas). Vem de main (`lib/midia.ts:235`, `components/exercicio/midia.tsx:29`,
  `ficha-folha.tsx:362`); o L13 passou a usar esse texto no nome da
  figura-botão e da figura parada, então o leitor de tela o lê mais vezes.
  Sugestão para a fila: "Execução: <nome>".
- **[tela]** Na busca, a linha de coleção sem subtítulo mostra a linha
  reservada vazia entre o título e "contém …" (busca "corda" no escuro:
  "Tríceps", "Cross over de parede" e "Tatame EVA" com um vão de ~20 px). A
  §22.13 item 7 pede a reserva em todas as linhas, mas na busca a altura já
  varia de 72 a 122 px e a reserva só deixa o buraco. Cosmético.

**Deploy (rodada 13, 23/09 07:25 UTC).** Publicado. Deployment anterior
`dpl_J3FTSmxbXnhjUaGY5xbbg1tjiuYS` → novo `dpl_21Gkk1PeE5mQsknsdVCnbHHopfo2`;
`main` passou de `763598a` para `a0bcfcf7bb6e0bf20f9c8894a9c28a9fc9afde4d`
(PR #21; merge do lote na integração `b27846a`, sem conflito, árvore idêntica
a `b5d9db5`, mais o veredito da auditoria `18da577`) e `/versao` devolveu esse
sha às 07:25:34, ~1,7 min depois do merge (build de 07:24:36Z). O CSS de
`/login` mudou de `903fc57007f0a2ff` para `9e6c9d2acce91a00`. Portão final na
integração: `lint` e `tsc --noEmit` limpos, 66 arquivos / 1.506 testes
verdes; e2e não repetido (código idêntico a `b5d9db5`: 477 e2e, 5 pulados,
varredura 5/5).

Fumaça em produção **18 de 18** nas três execuções (07:25, 07:27 e 07:28 UTC,
≥ 40 s entre elas), item a item: `/login` 200 · com "Treino do Terraço" · com
"Entrar" · sem "Configure NEXT_PUBLIC_SUPABASE_URL" · sem "é secreta" · `/` →
307 · para `/login` · `/versao` == sha do merge · `/sw.js` 200 · com
`/~offline` · com `figuras/` · com o mesmo CSS do HTML de `/login` ·
`/manifest.webmanifest` 200 · com "Treino do Terraço" · `/~offline` 200 · os
14 scripts `/_next/static` de `/login` 200 · marcadores do lote pelo grafo de
módulos a partir do chunk da ficha (`app/(app)/exercicios/[id]/page-ff6df15d91c7fa46.js`,
33 chunks): o rótulo da pausa "Parar a anima…" e `data-figura` estão no
chunk compartilhado `2246-39655f92d5ce7921.js`. Sonda a 360×740 (Chromium):
`/login` e `/~offline` sem erro de console e sem vazamento horizontal
(scrollWidth 360 = clientWidth). Capturas: 06/07/09/10 (claro e escuro) de
`capturas-c58f69d` viraram a base visual (`base-ef3ad97`, `indice.json` com
head `a0bcfcf`; wt-base não avançado). Nenhuma migração de banco.
**Rollback: não.**

### Rodada 14 — Lote 14 — Ficha: conteúdo e ações; nomes do catálogo e créditos

Branch `polimento/l14-ficha-conteudo`, a partir de `main` `0d54e5f` (com o
L12 e o L13 publicados; construído sobre eles: segmento acima da mídia,
figura que abre o Como fazer, pausa própria, fotos na proporção do arquivo e
`key` por exercício continuam). SPEC §22.14. Dez itens: oito da ficha do
exercício e dois por **exceção de área** decidida pelo orquestrador —
`copy-08` (Mais → Créditos: é o crédito da mídia que a ficha mostra, §15.1
itens 3 e 4; o lote dono da tela 24 está no teto de 12 arquivos) e
`OBS-elastico-x-super-band` (catálogo: mesma troca de rótulo, no mesmo
`lib/catalogo.ts`, que o `copy-25` e as tags de equipamento da ficha usam).
`lib/progressao.ts` e `lib/montagem.ts`: `git diff 0d54e5f` vazio.

#### O que mudou

1. **A ficha em página tem volta e ação** (tela-explorar-fichas-19;
   `app/(app)/exercicios/[id]/page.tsx`, `components/exercicio/acoes-da-ficha.tsx`
   (novo), `lib/ficha.ts`). **Era:** só o `<h1>`, o subtítulo e a ficha — sem
   "Voltar" e sem nada a fazer com o exercício. **É:** "Voltar" no topo (link
   para `/exercicios`; o toque volta à página anterior quando ela é do app —
   `podeVoltarNoApp()`: `navigation.canGoBack`, que só conta entradas desta
   origem, ou o tamanho do histórico sem a Navigation API) e "Fazer agora"
   (56 px) no fim, que abre a sessão livre só com o exercício pelo
   `useSessaoLivre` das coleções; o player grava cada série no IndexedDB na
   hora. O rótulo não muda enquanto a sessão nasce (`aria-busy`).
2. **Um cartão só quando não há histórico** (tela-explorar-fichas-20;
   `components/exercicios/historico-exercicio.tsx`, `lib/ficha.ts`). **Era:**
   Recorde, Carga por sessão, Últimas sessões e O que o motor decidiu como
   quatro cartões vazios. **É:** com os quatro vazios (`historicoVazio()`), um
   cartão "Ainda sem histórico deste exercício — Ele começa na primeira série
   registrada."; a decisão espera os eventos do motor lidos. Na página, "Onde
   você está" de um exercício que o motor ainda não avaliou repetia a carga
   inicial e a prescrição padrão das seções acima ("7,5 kg na barra" duas
   vezes, pego pelo e2e na parcial) — ali ele só diz o que as seções não
   dizem (`ondeVoceEsta()`, depois da correção da auditoria, abaixo): a
   carga do motor quando ela não é a do JSON (barras pesadas, §3.9), com
   "Montada com o peso das suas barras (Mais → Equipamento).", e o elástico
   ou a semana leve na linha "Próxima sessão"; sem nada disso, sai. Na folha
   ele continua inteiro.
3. **Nada repetido na ficha e títulos em ordem** (tela-explorar-fichas-21,
   com -22, -23 e a parte da ficha do a11y-12;
   `components/exercicio/ficha-folha.tsx`, `lib/ficha.ts`). **Era:** a aba
   Músculos repetia a ilustração; a página tinha "Área de foco" (o que a aba
   Músculos diz) e a seção "Equipamento" repetia o `equipamento_texto` do
   subtítulo; os treinos eram badges soltos; as seções eram H3 sob o H1.
   **É:** Músculos = mapa + legenda; sem "Área de foco" na página (na folha
   fica); "Equipamento" = as tags, cada uma link para a coleção do aparelho
   quando existe (`tagsDoEquipamento()`/`hrefDoEquipamento()`; anilhas,
   halteres e barra W ficam texto), com alvo de 44 px; "Aparece em:" antes
   dos treinos, cada um link para `/explorar/treino/<id>`
   (`linksDosTreinos()`); o nível dos títulos vem de um contexto
   (`nivelDosTitulos()`): H2 na página, H3 na folha (onde o título da folha é
   o H2) — seções, "Erro comum", "Seu histórico" e "Só nesta sessão". Com
   carga 0, a nota da "Carga inicial" não repete "peso corporal" embaixo de
   "peso do corpo" (`notaDaCargaInicial()`), e o 3º passo do salto básico
   não repete a prescrição (`data/exercicios.json`) — ambos da correção da
   auditoria, abaixo.
4. **A aba do tutorial diz para onde leva** (tela-explorar-fichas-26;
   `ficha-folha.tsx`, `lib/ficha.ts`). **Era:** "Tutorial", oferecida sempre.
   **É:** "Tutorial no YouTube" (o ícone de link externo que entrou aqui
   saiu na rodada 15: com rede o vídeo toca dentro do app — abaixo), só
   quando `data/tutoriais.json` tem o vídeo (`abasDaFicha()`; hoje os 81
   têm), e as abas dividem a largura pelo rótulo (`flex-auto`) — em terços,
   o rótulo novo não cabia. Na rodada 14 `components/exercicio/tutorial.tsx`
   não mudou; na 15 o "Abrir no YouTube" da aba sem rede ganhou o ícone de
   saída (`data-icone-externo`, `data-sai-do-app`) e, na 16, o "(abre fora do
   app)" para o leitor de tela — abaixo.
5. **"Apagar esta foto?" com `.flutuante`** (flutuante-no-dialogo-da-foto;
   `components/exercicios/foto-ampliada.tsx`). **Era:** `shadow-lg`, que some
   sobre `#0a0a0a`. **É:** `.flutuante` (§22.3 item 5; no escuro, o anel de
   1 px).
6. **As folhas são modais de verdade** (a11y-05; `components/ui/sheet.tsx`,
   vale para todas). **Era:** sem `aria-modal`; `main`/`header`/`nav` só
   escondidos por `aria-hidden` num ancestral e alcançáveis; o primeiro foco
   no primeiro item da lista; nas folhas abertas por estado (a ficha no
   player) o foco caía no `<body>` ao fechar (medido na parcial). **É:**
   `aria-modal="true"`; enquanto aberta, os irmãos da folha até o `<body>`
   ficam `inert` (`inertizarForaDe()`, com os avisos `aria-live` e o véu de
   fora; ao fechar desmarca só o que marcou); o primeiro foco é o título
   (`tabIndex=-1`); ao fechar, o foco volta a quem o tinha ao abrir — o
   `onOpenAutoFocus`/`onCloseAutoFocus` de quem passa o próprio (o Ajustar, o
   catálogo) continua mandando.
7. **"Manutenção", não "repetição"** (copy-13; `historico-exercicio.tsx`).
   **Era:** "Cada subida, repetição ou volta de carga…". **É:** "Cada subida,
   manutenção ou volta de carga aparece aqui depois do treino." O motor e
   "repetiu a carga no treino de dd/mm" (`lib/hoje.ts`) não mudam.
8. **Uma grafia por equipamento** (copy-25; `lib/catalogo.ts`). **Era:**
   filtro "Cross-over", "Super band", "Peso do corpo". **É:** "Cross over",
   "Super Band", "Peso corporal" — a grafia de `equipamento_texto` e de
   `equipamentos.json`. Ficam "Halter"/"Halteres" e "Barra maciça"; "peso do
   corpo" como **carga** no player e no histórico é outra coisa e fica.
9. **Um nome só para a faixa elástica** (OBS-elastico-x-super-band;
   `lib/catalogo.ts`). **Era:** Implemento "Elástico" e Equipamento "Super
   band" para o mesmo objeto. **É:** os dois "Super Band"; o circuito
   "Elástico" do Explorar fica.
10. **Créditos em linguagem de gente** (copy-08;
    `app/(app)/mais/creditos/page.tsx`). **Era:** "…as cores viraram
    variáveis CSS" e "— anda junto do desenho, com a atribuição e o que foi
    feito com a geometria". **É:** "Nenhuma linha do desenho foi alterada; só
    reagrupamos os músculos e trocamos as cores." e "Texto completo da
    licença MIT, com a atribuição." Autor, licença, fonte e o link do texto
    da licença continuam.

Testes que mudaram por causa do comportamento novo (não afrouxados):
`e2e/catalogo.spec.ts` (na página, "Área de foco" ausente e os músculos na
aba Músculos; o histórico vazio é o cartão único, sem "Onde você está") e
`e2e/auditoria-m5.spec.ts` "as 81 fichas" (a espera conta as imagens que a
ficha deve ter: o quadro 2 da ilustração só entra no DOM depois do 1, §22.13
item 4, e a espera antiga podia passar antes de ele existir — falhou uma vez
na parcial com "3 de 4 imagens" no abdominal declinado e passou sozinho; a
asserção `naturalWidth > 0` de cada imagem é a mesma).

#### Provas

- **Vitest** (`lib/ficha.test.ts`, novo, 13 testes; `lib/catalogo.test.ts`,
  +4): abas sem tutorial = Vídeo e Músculos, e os **81** exercícios têm
  tutorial; nível H2/H3; em **todos os 81** exercícios, cada tag com coleção
  de aparelho leva a `/explorar/aparelho/<tag>` e a coleção contém o
  exercício, e anilhas/halteres/barra W não têm link; todo treino de todo
  exercício leva a `/explorar/treino/<id>` com o exercício dentro;
  `historicoVazio` só com os quatro vazios; `podeVoltarNoApp` (aba nova:
  `canGoBack` falso com `history.length` 2); `ondeVoceEsta` e
  `notaDaCargaInicial` e o critério de repetição nos 81 (ver a correção da
  auditoria). Catálogo, nos dados
  inteiros: "Cross over" nos **9** exercícios com a tag, "Super Band" nos
  **5** com a tag (e nos 2 de implemento `band`, que também têm a tag), os
  nomes batem com `equipamentos.json`; dos **13** de peso corporal, **11**
  dizem "peso corporal" e 2 não nomeiam o implemento (prancha → "Tatame",
  abdominal no banco declinado → "Banco"), nenhum "peso do corpo" — a
  metade "aparece no texto de todo exercício" do aceite do copy-25 é
  inviável para esses 2 sem reescrever `equipamento_texto`, o que o item
  proíbe (aceite ajustado na SPEC §22.14 item 8 e devolvido como não feito
  no retorno do lote); `NOME_IMPLEMENTO.band === NOME_EQUIPAMENTO['super-band']` e
  nenhum rótulo "Elástico".
- **Mutação** (cópia em `r14/l14/mut`): 9 de 9 mutantes derrubam teste —
  aba do tutorial sempre, nível fixo, `href` nulo, vazio ignorando eventos,
  "Cross-over", "Elástico", "Peso do corpo", "Super band", rótulo "Tutorial".
- **e2e** (`e2e/ultraloop-l14.spec.ts`, 19 testes na primeira cadeia, 27
  depois da correção da auditoria e **34** depois da rodada 15; 360×740
  contra o mock):
  Voltar do catálogo e numa aba nova; Fazer agora (≥ 44 px) → player, e, sem
  rede, a série concluída está na `sessaoAtiva` e na `outbox` do IndexedDB;
  cartão único sem histórico (1 cartão na página, nenhum dos 4 títulos);
  com séries semeadas e sem eventos, a frase nova sem "repetição"; página
  nos dois temas — títulos do `<main>` sem pular nível (H1 → H2), nenhum
  parágrafo/item visível repetido nem contido em outro, `equipamento_texto`
  uma vez, tags e treinos como links (44 px) que abrem a coleção, Músculos
  sem `<img>`; folha — título H2, seções H3, "Área de foco" e "Onde você
  está" presentes; foco por Tab em Voltar, tags, treinos e Fazer agora com
  anel e sem corte, nos dois temas; "Tutorial no YouTube" sem o ícone de
  saída (desde a rodada 15; o ícone fica no "Abrir no YouTube" sem rede), nada
  cortado (abas ≥ 44 px) na página e na folha; o cartão "Apagar esta foto?"
  com a mesma sombra de `.flutuante` nos dois temas (no escuro, o anel de
  1 px); folha da ficha no player, "Substituir hoje" e filtros do catálogo —
  `aria-modal`, `main`/`header`/`nav` inertes, foco no título, 30 Tabs sem
  sair, Esc fecha, o foco volta ao gatilho e nenhum `inert` sobra; filtro
  "Cross over" → só os 9 cards com "Cross over", opções sem "Elástico";
  Créditos sem "variáveis CSS"/"anda junto", com os dois links; contraste
  ≥ 4,5:1 nos dois temas de "Voltar", "Aparece em:", das tags, dos treinos,
  de "Fazer agora" e do cartão vazio (a ficha em página não está nas doze
  rotas da varredura: medida aqui, junto com o anel de foco acima).
- **Parciais antes da cadeia** (`r14/l14/parcial*`): em `35459b1`, 4 falhas
  que eram defeito do código e viraram correção — a aba nova tem
  `history.length` 2 (o "Voltar" voltaria ao about:blank), "7,5 kg na barra"
  duas vezes na página, e o foco não voltava ao "Como fazer" ao fechar a
  folha no player; em `cb05219`, 136 de 137 com o grep ampliado (a falha era
  a espera das 81 fichas, acima); `0117248` isolado: 4 de 4.

#### Correção da auditoria

Duas lentes auditaram `5258988` (regra e tela; vereditos em
`r14/l14/auditoria-1-*/veredito.json`): 2 bloqueantes e 5 importantes, todos
atendidos abaixo; dos menores, os que cabiam sem risco.

- **Bloqueante — a página escondia a carga real** (item 2). A regra
  `ondeVoceEstaRepete()` tirava "Onde você está" da página em toda primeira
  vez sem elástico nem semana leve, mas com as barras pesadas em Mais →
  Equipamento (§3.9) o motor sobe ou desce a carga inicial ao que dá para
  montar, e a seção "Carga inicial" mostra o número cru do JSON (a auditoria
  mediu 3 fichas com a barra W a 5 kg, 21 com a barra maciça a 8 kg e 23 com
  os halteres a 2 kg; ex.: rosca com barra W, seção "2 kg na barra", motor e
  player "5 kg na barra"). **Agora** `ondeVoceEsta()` (pura, `lib/ficha.ts`)
  só tira o cartão quando a carga do motor é a do JSON; quando não é, o
  cartão mostra a carga do motor e "Montada com o peso das suas barras (Mais
  → Equipamento)."; o elástico e a semana leve ficam na linha "Próxima
  sessão" sem repetir a carga; a "Próxima sessão" sem elástico nem semana
  leve (que seria a prescrição padrão) e a nota "Ainda sem registro" (que é
  a nota da seção) não aparecem na página. Na folha o cartão é o de sempre.
  O elástico sai por extenso ("pé inteiro", `nomeDaAssistencia()`; era "pe
  inteiro", menor da tela).
- **Bloqueante — "nada repetido" só valia no supino** (item 3). O critério
  do e2e aplicado às 81 fichas falhava em 9 (12 com as 3 do elástico):
  "peso corporal" da nota da carga inicial dentro do subtítulo "Core ·
  Tatame · peso corporal" (8 fichas), "peso do corpo" e "peso corporal" na
  mesma seção (23 fichas de carga 0), e a prescrição "6 × 30 s a 5 × 3 min"
  dentro do 3º passo do salto básico. **Agora**: `notaDaCargaInicial()` (com
  carga 0, só o complemento — "Anilha só quando passar de 15 limpas" — ou
  nada); o passo do salto básico corrigido no JSON ("Progrida pelo tempo de
  bloco, não pela velocidade."); e o Vitest aplica o mesmo critério aos
  textos da página das **81** fichas em 4 perfis (sem barras pesadas, barra
  W 5 kg, barra maciça 8 kg, halteres 2 kg) — ele mesmo pegou mais um caso
  que a auditoria não listou (farmer's walk com halteres de 2 kg: "3 × 30–40
  passos" dentro de "Próxima sessão: 3 × 30–40 passos"), resolvido pela
  regra da "Próxima sessão" acima.
- **Importante — o e2e não provava o `router.back()`** (item 1). A asserção
  "a busca continua lá" passava igual com um link simples, e a busca do
  catálogo é estado local que recomeça vazia (o texto do "Como testar"
  dizia o contrário). **Agora** o e2e confere o índice da entrada do
  histórico (`navigation.currentEntry.index`): do catálogo, a ficha empilha
  +1 e o "Voltar" devolve ao índice do catálogo; e um e2e novo abre a ficha
  pelo Relatório ("Carga dos grandes") e o "Voltar" — cujo `href` é
  `/exercicios` — leva a `/relatorio`, no índice de antes. O "Como testar"
  e a SPEC dizem que a busca recomeça vazia.
- **Importante — o clique na tag e no treino só conferia a URL** (item 3).
  Agora confere o H1 da coleção (`colecaoDoAparelho(tag).titulo`,
  `colecaoDoTreino(id).titulo`): uma rota 404 teria a mesma URL.
- **Importante — o anel do "Fazer agora" não era medido de verdade.**
  `boxShadow !== "none"` é sempre verdadeiro no Button do Tailwind 4 (cinco
  sombras transparentes). Agora o e2e exige uma sombra com cor de alfa > 0 e
  espalhamento ≥ 2 px e, no "Fazer agora", espera a transição terminar até o
  anel opaco aparecer (3 s no máximo), nos dois temas.
- **Importante — as 12 fichas repetidas da lente de tela**: as mesmas dos
  dois bloqueantes; e2e novos em abdominal supra, salto com joelho alto,
  salto básico, barra fixa assistida e flexão de braço (nada repetido no DOM
  real), no elástico ("elástico pé inteiro", "peso do corpo" uma vez só) e
  na rosca com barra W com a barra W de 5 kg no perfil ("5 kg na barra" em
  "Onde você está", "2 kg na barra" na seção, nada repetido).
- **Menores.** "Sem perfil o botão fica desabilitado" virou "enquanto o
  perfil e o dia carregam" (SPEC e comentário do `FazerAgora`: com perfil
  `null` o hook devolve pronto, e o layout cria o perfil antes). copy-25:
  o aceite ajustado ("todo texto que nomeia o implemento"; 11 de 13, os 2
  que não nomeiam ficam) está na SPEC §22.14 item 8 e vai como não feito no
  retorno. Os chips iguais "Super Band" (Implemento e Equipamento ligados
  juntos) seguem o padrão que já existia em "Barra fixa", "Halteres" e
  "Corda": só registro. Fora do diff do lote, só registro: o Esc da folha
  "substituir hoje" aberta de dentro da Visão geral fecha as duas
  (`visao-geral.tsx`); o ícone de link externo numa aba que, com rede,
  toca o vídeo embutido; o anel do Button primário na cor do próprio botão.
- **Provas da correção**: `lib/ficha.test.ts` passa de 13 para 28 testes;
  mutantes na cópia local, cada um derrubando teste — o JSON antigo do
  salto básico (4 falhas), a nota crua com carga 0 (7 falhas), a carga do
  motor ignorada em `ondeVoceEsta` (5 falhas).

#### Portões

Cadeia inteira em `0117248` (o HEAD com todo o código do lote;
`r14/l14/logs/0117248.log`, das 09:54:47 às 10:19:31 UTC, **status ok**):
`lint` limpo · `tsc --noEmit` limpo · `npm test` **67 arquivos, 1.523
testes, todos verdes** (eram 66 / 1.506 em `0d54e5f`: +1 arquivo, +17
testes) · `build` ("Compiled successfully in 21.4s") · `build:e2e`
("Compiled successfully in 17.7s") · `e2e` **494 passaram, 5 pulados, 0
falharam** (18,5 min; eram 477 + 5 em `0d54e5f`: +17 do lote; os 5 pulados
são os da varredura, que roda à parte) · `varredura` **5 de 5** (4,3 min).
Depois da cadeia entrou o e2e de contraste (2 testes, verdes sozinhos em
`r14/l14/parcial-contraste`, contra o mesmo build). A cadeia inteira rodou
de novo em `5258988` (`r14/l14/logs/5258988.log`, 10:23:22–10:48:19, **ok**:
1.523 unitários, e2e **496 + 5 pulados**, varredura 5 de 5) — o HEAD que as
auditorias leram.

**Depois da correção da auditoria**, cadeia inteira em `d85d0fa` (todo o
código, os testes e este texto da correção; `r14/l14/logs/d85d0fa.log`, das
11:20:59 às 11:46:05 UTC, **status ok**): `lint` limpo · `tsc --noEmit`
limpo · `npm test` **67 arquivos, 1.538 testes, todos verdes** (+15 em
`lib/ficha.test.ts`) · `build` ("Compiled successfully in 17.5s") ·
`build:e2e` ("Compiled successfully in 17.7s") · `e2e` **504 passaram, 5
pulados, 0 falharam** (18,9 min; +8 do e2e do L14: Relatório → Voltar, 5
fichas da auditoria, elástico, barra W pesada) · `varredura` **5 de 5**
(4,3 min). Antes dela, a parcial `r14/l14/parcial-corr` (build:e2e + grep
"22.14" em `8196ede`): 27 de 27. O commit deste registro só acrescenta estes
números e a tabela abaixo ao PROGRESSO; a cadeia roda de novo, inteira, nele
(`r14/l14/logs/<hash>.log`).

#### Capturas

`capturas.sh` em `0117248`, depois da cadeia verde, contra a base real de
`main` (`base-ef3ad97`), com as seis telas declaradas
(`r14/l14/capturas-0117248.md`): 60 PNGs, **"Nenhuma tela mudou fora do
esperado"** — as 48 fora da lista com Δ 0,00 %. (A primeira comparação
recebeu a lista separada por espaço e o comparador só casou a primeira tela;
refeita com vírgulas, que é o formato dele.) Diffs abertos: 09 claro, 10
escuro, 24 claro.

| tela | Δ claro | Δ escuro | o que mudou |
| --- | ---: | ---: | --- |
| 10-ficha-folha (página na aba Músculos) | 41,03 % | 42,15 % | "Voltar" no topo empurra tudo ~60 px (120 px na captura 2×); a aba Músculos sem a ilustração (só o mapa e a legenda); a terceira aba "Tutorial no YouTube ↗"; "Aparece em:" antes dos treinos |
| 09-ficha-exercicio | 26,94 % | 31,64 % | "Voltar" no topo e o deslocamento; as abas pelo tamanho do rótulo, "Tutorial no YouTube ↗" numa linha |
| 24-creditos | 2,70 % | 2,64 % | só o parágrafo do mapa muscular ("Nenhuma linha do desenho foi alterada; só reagrupamos os músculos e trocamos as cores.") |
| 04-treino-lista | 0,00 % | 0,00 % | nada: a folha "Substituir hoje" não está aberta na captura |
| 08-catalogo | 0,00 % | 0,00 % | nada: os rótulos novos estão na folha de filtros, fechada na captura |
| 17-corpo-fotos | 0,00 % | 0,00 % | nada: o cartão "Apagar esta foto?" não está aberto na captura |

**Capturas depois da correção**: `capturas.sh` em `d85d0fa`, depois da
cadeia verde, contra `base-ef3ad97` com as mesmas seis telas
(`r14/l14/capturas-d85d0fa.md`): 60 PNGs, **"Nenhuma tela mudou fora do
esperado"**, os mesmos Δ da tabela acima (09 26,94/31,64 %, 10
41,03/42,15 %, 24 2,70/2,64 %; 04, 08 e 17 0,00 %; 48 fora da lista
0,00 %), e os PNGs de 09, 10 e 24 são byte a byte iguais aos de `5258988`
(`cmp`): a correção mexe no fim da ficha ("Carga inicial" e "Onde você
está"), fora do quadro capturado, e o supino da captura tem carga no JSON e
nenhuma barra pesada. Diff aberto: 09 claro (o "Voltar" desloca o topo, as
abas novas, "Aparece em:").

Fora das capturas, medido ao vivo pelos e2e: a folha da ficha no player
(`/treinar`), o "Substituir hoje", os filtros abertos, o cartão de apagar a
foto e o histórico com séries semeadas.

#### Como testar no celular (360 px)

1. Exercícios → busque "supino reto" → abra a ficha: "Voltar" no topo volta
   ao catálogo (a busca recomeça vazia, como no voltar do celular). Abra a
   ficha pelo Relatório ("Carga dos grandes"): "Voltar" volta ao Relatório.
   Role até o fim: "Fazer agora" abre o player só com o supino; conclua uma
   série no modo avião — ela fica no aparelho e sobe depois.
2. Na mesma ficha, sem treino ainda: embaixo de "Seu histórico" há um cartão
   só ("Ainda sem histórico deste exercício"). A seção "Equipamento" mostra as
   tags; "Banco" abre a coleção do banco no Explorar; "Aparece em:" leva ao
   treino.
3. Aba Músculos: só o mapa e a legenda. A terceira aba se chama "Tutorial no
   YouTube", sem setinha de link externo (desde a rodada 15): com rede, o
   vídeo toca ali mesmo. No modo avião, a aba mostra "Abrir no YouTube" com a
   setinha — esse sim sai do app.
4. No player, toque no "?" (Como fazer): com leitor de tela, o primeiro
   anúncio é o nome do exercício; o fundo não é alcançável; ao fechar, o foco
   volta ao "?". O mesmo em "Substituir" na lista do dia e em "Filtros".
5. Exercícios → Filtros: Implemento e Equipamento dizem "Super Band" (nada de
   "Elástico"), "Cross over" e "Peso corporal".
6. Corpo → Fotos → abra uma foto → Apagar: no tema escuro, o cartão tem o
   contorno laranja fino.
7. Mais → Créditos → Mapa muscular: "Nenhuma linha do desenho foi alterada;
   só reagrupamos os músculos e trocamos as cores."
8. Mais → Equipamento → pese a barra W (ex.: 5 kg) → abra Rosca com barra W,
   sem treino: a seção "Carga inicial" diz o número do guia (2 kg) e "Onde
   você está" mostra 5 kg na barra, "Montada com o peso das suas barras".
   Sem barra pesada, esse cartão não aparece na página.
9. Abdominal supra (ou qualquer um de peso corporal): "Carga inicial" diz
   "peso do corpo", sem "peso corporal" embaixo. Barra fixa assistida:
   "Onde você está" diz "Próxima sessão: … · elástico pé inteiro", com
   acento e sem repetir "peso do corpo".

#### Rodada 14 — auditoria 2 reprovou; lote devolvido à fila

A auditoria 2, em `e3c1f22` (cadeia `r14/l14/logs/e3c1f22.log` ok: 1.538
unitários, e2e 504 + 5 pulados, varredura 5/5), **aprovou a lente regra**
(8 menores) e **reprovou a lente tela** por **1 importante**: a SPEC §22.14
item 6 diz que o contrato vale para toda folha, mas **dentro da Visão geral
do treino** o Esc na folha "substituir hoje" do bloco e na ficha aberta pelo
"Como fazer" fechava a folha **e** a Visão geral (medido a 360×740: antes do
Esc, dois diálogos; depois de um Esc, nenhum, e o gatilho fora do DOM). A
causa: `components/treinar/visao-geral.tsx` escuta o `keydown` no `window` e
fechava em qualquer Escape, sem olhar `defaultPrevented` — o Radix já tinha
tratado o Esc na captura do `document`. Preexistente (fora do diff do lote),
mas a SPEC nova afirmava a cobertura e nenhum e2e a exercitava. Pela regra do
dono, o lote foi **devolvido à fila** ao fim da rodada 14. Vereditos:
`r14/l14/vereditos-auditoria-2.json`.

#### Rodada 15 — retomada

Ciclo novo sobre `e3c1f22` da mesma branch, com a pasta de logs nova
`r15/l14/`. Commits: `6a3496f` (SPEC §22.14 primeiro: itens 4 e 6 e o item
11 novo), `ee20cde` (o Esc na Visão geral e na foto ampliada), `1e31955` (o
anel do botão primário), `f23b3a2` (a aba do tutorial sem o ícone de saída),
`48b7603` (dois textos do JSON da ficha), `32ab031` (e2e). Sonda antes da
cadeia (`r15/l14/parcial/`, build:e2e + grep dos itens 4, 6, 11 e do foco):
13 de 13.

#### Correção da auditoria 2

- **Tela, importante: o Esc na folha fechava a Visão geral junto** (item 6;
  `components/treinar/visao-geral.tsx`). **Era:** `if (evento.key !==
  "Escape") return;` — qualquer Esc fechava a lista, inclusive o que o Radix
  já tinha usado para fechar a folha de cima. **É:** `if (evento.key !==
  "Escape" || evento.defaultPrevented) return;`: o Esc fecha só a camada de
  cima. Vale para toda folha e diálogo do Radix aberto sobre a Visão geral:
  "substituir hoje", a ficha do "Como fazer", a montagem, e também o
  "Descartar este treino?" e o resumo do fim, que são do Radix. Sem folha, o
  Esc continua fechando a Visão geral.
- **Os outros Esc globais do app** (`grep Escape` em `app/`, `components/`,
  `lib/`): só há mais um, o da foto ampliada
  (`components/exercicios/foto-ampliada.tsx`). **Era:** fechava em qualquer
  Esc. **É:** a mesma regra — ignora o Esc já tratado e marca
  (`preventDefault`) o que trata, para ninguém embaixo fechar junto. Hoje não
  há folha por cima nem por baixo dela (as fotos ampliáveis só existem na
  ficha em página, `comoPagina`, e no Corpo, que é página), então o
  comportamento visível não muda; o e2e prova a regra com um Esc que outra
  camada gasta antes.
- **Menor: o anel do Button primário tinha a cor do botão** (item 11 novo;
  `components/ui/button.tsx`). **Era:** `ring-3 ring-ring` colado no botão,
  `--ring` igual a `--primary` — 1:1 contra ele; o foco só parecia o botão
  3 px maior (no "Fazer agora" e em todo `BotaoLargo`). **É:** no tom
  primário, o anel do app (§22.3 item 7): contorno sólido de 2 px na cor
  `--ring` com `outline-offset` de 2 px — o fundo aparece entre o anel e o
  botão. Medido pelo e2e (captura com e sem foco, 3 px por fora da borda):
  **5,25:1** no claro e **8,75:1** no escuro contra o fundo, e o vão de 1 px
  sem mudança (1,00:1). Os outros tons do Button já tinham anel de cor
  diferente da deles e ficam.
- **Menor: o ícone de link externo numa aba que toca o vídeo embutido**
  (item 4; `components/exercicio/ficha-folha.tsx`,
  `components/exercicio/tutorial.tsx`). **Era:** a aba "Tutorial no YouTube
  ↗", mas com rede a miniatura vira o `<iframe>` do `youtube-nocookie`
  dentro da ficha — o ícone prometia uma saída que não acontece. **É:** a aba
  "Tutorial no YouTube", sem ícone (o rótulo diz de onde vem o vídeo); o
  ícone fica no "Abrir no YouTube" da aba sem rede (`target="_blank"`), o
  único ponto da ficha que sai do app. O aceite do ledger ("o destino
  externo dito no rótulo") ficou assim na SPEC §22.14 item 4: o destino só é
  externo sem rede, e ali rótulo e ícone dizem isso.
- **Menor: dois destinos para o mesmo ajuste** (`data/exercicios.json`, 3
  fichas de barra W). **Era:** a nota da carga inicial dizia "pese na balança
  e corrija no perfil", e o cartão "Onde você está" logo abaixo diz "(Mais →
  Equipamento)", que é onde o peso das barras se ajusta. **É:** "… pese na
  balança e corrija em Mais → Equipamento".
- **Menor: nome de arquivo na tela** (`data/exercicios.json`, salto básico).
  **Era:** "Segue a progressão de corda de cardio.json (…)" em "Como
  progredir". **É:** "Segue a progressão do plano da corda (6 × 30 s → 5 × 3
  min em 12 semanas)." O Vitest novo varre os 81: nenhum texto visível com
  ".json" nem "corrija no perfil".
- **Menor: o total de testes do spec nas Provas** dizia 19; corrigido acima
  (34 agora).
- **Menores só registrados, com motivo:** (1) o critério "texto de 12
  caracteres ou mais contido em outro" dá falso positivo com números ("7,5 kg
  na barra" ⊂ "17,5 kg na barra"); nenhum dos 4 perfis dos testes cai nisso e
  mudar o critério agora afrouxaria o teste que pegou as repetições reais —
  fica para quando um perfil novo precisar. (2) O "nada repetido nos 81" do
  Vitest roda sobre o espelho `textosDaPagina()`, não sobre o DOM; o DOM é
  provado em 7 fichas no e2e — renderizar as 81 no e2e custaria minutos na
  cadeia. (3) `historico-exercicio.tsx`: `carregando` não espera o perfil, e
  com barras pesadas o cartão "Onde você está" nasce escondido e aparece
  quando o perfil chega; a carga já era calculada assim antes do lote, sem
  dado errado na tela, só a ordem de chegada. (4) Depois da primeira
  avaliação com manutenção, a carga inicial e a atual aparecem iguais em
  seções diferentes: são informações diferentes, e a SPEC limita o "nada
  repetido" ao histórico vazio. (5) O e2e do item 6 mede o contrato em 3
  folhas + as 2 da Visão geral; as outras (conquistas, montagem, personalizar,
  player) usam o mesmo `SheetContent` e passam nos e2e que já existiam. (6)
  `sheet.tsx`: um `ref` passado por quem usa a folha desligaria o `inert`;
  nenhum uso passa (grep), e o componente é interno. (7) A folha "Montagem"
  não foi medida pela auditoria (o gatilho não aparece com a semente usada);
  é o mesmo `SheetContent`.


#### Provas (rodada 15)

- **Vitest** (`lib/ficha.test.ts`, +2): nenhum dos 81 exercícios tem ".json"
  em texto visível (passos, erro comum, montagem, equipamento, nota da carga
  inicial, regra de progressão); nenhum manda corrigir "no perfil", e as 3
  notas da barra W dizem "Mais → Equipamento".
- **e2e** (`e2e/ultraloop-l14.spec.ts`, +7, 34 no total): dentro da Visão
  geral, nos dois temas, abrir pelo teclado a "substituir hoje" e a ficha do
  "Como fazer" do bloco → `aria-modal`, foco no título → **um** Esc fecha só
  a folha: a Visão geral continua visível, o foco volta ao gatilho e nenhum
  `inert` sobra; sem folha, o Esc seguinte fecha a Visão geral e o botão
  "Visão geral do treino" do player volta. Foto ampliada: um Esc que outra
  camada gasta antes (listener na captura do `window` com `preventDefault`)
  não a fecha; o seguinte fecha. Aba do tutorial: sem
  `[data-icone-externo]` na lista de abas (página e folha); com rede (a
  miniatura servida pela rota do teste), tocar a miniatura põe o `<iframe>`
  do `youtube-nocookie` dentro do `<main>`, na mesma rota; sem rede, o link
  "Abrir no YouTube" tem `target="_blank"` e o ícone. Anel do primário, nos
  dois temas: "Fazer agora" pelo Tab com contorno `solid` ≥ 2 px e
  `outline-offset` ≥ 2 px; captura com e sem foco — o anel 3 px por fora
  da borda muda **5,25:1** (claro) e **8,75:1** (escuro) contra o fundo, e o
  vão 1 px por fora não muda (1,00:1). O teste "Tab chega a … Fazer agora
  com anel inteiro" passou a esperar o contorno (o anel antigo era sombra).
- **Mutação** (`r15/l14/mut/`): com o `defaultPrevented` tirado da Visão
  geral, o e2e novo falha nos dois temas ("Visão geral do treino" não
  encontrada depois do Esc) — 2 falhas; a correção voltou.
- `git diff 0d54e5f -- lib/progressao.ts lib/montagem.ts`: vazio.

#### Portões (rodada 15)

Cadeia inteira em `32ab031` (todo o código e os testes da rodada 15;
`r15/l14/logs/32ab031.log`, das 12:42:12 às 13:07:33 UTC, **status ok**):
`lint` limpo · `tsc --noEmit` limpo · `npm test` **67 arquivos, 1.540
testes, todos verdes** (+2 em `lib/ficha.test.ts`; eram 1.538 em `e3c1f22`)
· `build` ("Compiled successfully in 18.9s") · `build:e2e` ("Compiled
successfully in 18.2s") · `e2e` **511 passaram, 5 pulados, 0 falharam**
(19,1 min; eram 504 + 5: +7 do spec do L14) · `varredura` **5 de 5**
(4,3 min). O log traz as medidas do anel do primário ("[anel-primario]
light: anel 5.25:1 · vão 1.00:1", "dark: anel 8.75:1 · vão 1.00:1"). O
commit deste registro só acrescenta estes números e a tabela abaixo ao
PROGRESSO; a cadeia roda de novo, inteira, nele (`r15/l14/logs/<hash>.log`).

#### Capturas (rodada 15)

`capturas.sh` em `32ab031`, depois da cadeia verde, contra a base real de
`main` (`base-ef3ad97`), com as seis telas declaradas
(`r15/l14/capturas-32ab031.md`): 60 PNGs, **"Nenhuma tela mudou fora do
esperado"** — as 48 fora da lista com Δ 0,00 %. Diffs abertos: 09 claro
(contra a base) e as capturas 09 claro e 10 escuro.

| tela | Δ claro | Δ escuro | o que mudou |
| --- | ---: | ---: | --- |
| 10-ficha-folha (página na aba Músculos) | 41,03 % | 42,15 % | o mesmo da rodada 14 ("Voltar", Músculos só com o mapa, "Aparece em:"), e a terceira aba agora é "Tutorial no YouTube" sem a setinha |
| 09-ficha-exercicio | 27,01 % | 31,66 % | o mesmo da rodada 14 ("Voltar", abas pelo rótulo), e a aba "Tutorial no YouTube" sem a setinha |
| 24-creditos | 2,70 % | 2,64 % | só o parágrafo do mapa muscular (PNG byte a byte igual ao de `d85d0fa`) |
| 04-treino-lista | 0,00 % | 0,00 % | nada: a folha "Substituir hoje" não está aberta na captura |
| 08-catalogo | 0,00 % | 0,00 % | nada: a folha de filtros está fechada na captura |
| 17-corpo-fotos | 0,00 % | 0,00 % | nada: o cartão "Apagar esta foto?" não está aberto na captura |

Contra as capturas de `d85d0fa` (rodada 14), 09 e 10 mudam só na faixa das
abas (px 284–374 da captura 2×, nos dois temas): sem o ícone, as três abas
`flex-auto` redistribuem a largura e os rótulos andam alguns pixels. O anel
do primário não aparece nas capturas (nenhum foco por teclado nelas); ele é
medido pelo e2e do item 11. A Visão geral com a folha aberta e o Esc são
medidos pelo e2e (nenhuma captura abre a Visão geral).

#### Como testar no celular (rodada 15)

1. Treino → Começar → no player, o ícone de lista (Visão geral) → num bloco,
   "substituir hoje" → feche a folha com o Esc (teclado Bluetooth): a folha
   fecha e a Visão geral continua aberta, com o foco no "substituir hoje". O
   mesmo com o "?" (Como fazer) do bloco. Sem folha aberta, o Esc fecha a
   Visão geral. (Em `4f55487` o **voltar do celular** com a folha aberta
   ainda fechava as duas — a auditoria 1 da rodada 15 mediu; corrigido na
   rodada 16, abaixo.)
2. Ficha do supino → aba "Tutorial no YouTube" (sem setinha): toque na
   miniatura e o vídeo toca ali mesmo. No modo avião, a aba mostra "Precisa
   de internet" e "Abrir no YouTube" com a setinha — esse abre o YouTube.
3. Com teclado (ou leitor de tela navegando por foco), chegue ao "Fazer
   agora": o anel laranja fica separado do botão por um vão da cor do fundo,
   nos dois temas.
4. Rosca com barra W (ou Rosca Scott improvisada, Tríceps testa): a nota da carga
   inicial diz "corrija em Mais → Equipamento". Salto básico → "Como
   progredir": "Segue a progressão do plano da corda (…)", sem nome de
   arquivo.

#### Rodada 16 — correção da auditoria 1 da rodada 15

As duas lentes da auditoria 1 sobre `4f55487` devolveram o lote com o
mesmo importante (0 bloqueantes): o **voltar do celular** com uma folha
aberta sobre a Visão geral fechava as duas camadas, e o "Como testar
(rodada 15)" item 1 mandava testar justamente assim. A lente de tela mediu
(360×740, dois temas, `page.goBack()`): "substituir hoje" ou "Como fazer"
abertos sobre a Visão geral → voltar → 0 folhas e 0 Visão geral, na mesma
rota. A causa: a folha não tem entrada no histórico, e o `popstate` da
Visão geral (§22.5 item 3) fechava a lista sem olhar se havia algo por
cima. Em vez de só corrigir o texto, o código passou a cumprir o que ele
prometia (SPEC §22.14 item 6, parágrafo novo). Commits: `c5c4171` (SPEC
primeiro), `8fb8569` (Visão geral), `f058c95` (foto ampliada), `25e55e9`
(tutorial), `bd88cbd` (e2e).

##### Correção da auditoria

- **Importante (as duas lentes): o voltar com folha sobre a Visão geral**
  (`components/treinar/visao-geral.tsx`). **Era:** `popstate` →
  `aoFechar()`, sempre. **É:** se há uma camada aberta por cima da lista
  (`[role=dialog]`/`[role=alertdialog]` que não é a própria lista nem a
  contém, e não está fechando — folha, alerta ou o resumo do fim; a foto
  ampliada não abre dentro da Visão geral, correção da rodada 17), o
  `popstate` devolve a entrada da lista ao histórico
  (`pushState`) e entrega um Esc à camada de cima, que fecha do jeito dela:
  o Radix fecha a folha e devolve o foco ao gatilho, e a lista ignora esse
  Esc porque ele já vem com `defaultPrevented` (rodada 15). Sem nada por
  cima, o voltar fecha a lista, como antes. Vale para o voltar do Android,
  o gesto de voltar do TalkBack/VoiceOver e o Alt+←, que são todos um
  `history.back()`.
- **Menor (regra): a metade "marca o Esc que trata" da foto ampliada não
  tinha teste.** e2e novo: um listener no `window`, em bolha (onde a Visão
  geral escuta), vê o Esc da foto com `defaultPrevented = true`.
- **Menor (tela): a foto ampliada não devolvia o foco**
  (`components/exercicios/foto-ampliada.tsx`). **Era:** fechar pelo Esc ou
  pelo X deixava o foco no `<body>`. **É:** a foto guarda quem tinha o foco
  ao abrir e devolve a ele ao fechar (Esc, X ou toque fora); se quem abriu
  sumiu (foto apagada no Corpo), não força nada.
- **Menor (tela): o "Abrir no YouTube" não dizia ao leitor de tela que sai
  do app** (`components/exercicio/tutorial.tsx`). **Era:** só o ícone
  (`aria-hidden`) dizia. **É:** `<span class="sr-only"> (abre fora do
  app)</span>` — o nome acessível é "Abrir no YouTube (abre fora do app)";
  nada muda na tela.
- **Menor (tela): o título do item 11 prometia outra cor.** SPEC e e2e:
  "O anel do botão primário fica a 2 px do botão" (a cor continua a
  `--ring`; o que mudou foi o vão de fundo entre o anel e o botão).
- **Menor (regra): espera cega no e2e do anel.** Os dois
  `waitForTimeout(400)` viraram um `expect.poll` até o "Fazer agora" não
  ter animação rodando (`getAnimations()`), e o segundo espera antes o
  botão perder o `:focus`.
- **Menor (regra): frases velhas no PROGRESSO.** "O que mudou" item 4 dizia
  que `tutorial.tsx` "não precisou mudar" e as Provas da rodada 14 diziam
  "'Tutorial no YouTube' com o ícone"; as duas foram alinhadas ao HEAD, e o
  item 1 do "Como testar (rodada 15)" diz só Esc, com a nota da rodada 16.
- **Achado na sonda desta rodada (e2e instável do item 4):** o teste "sem
  rede, o 'Abrir no YouTube' …" falhou 1 vez na sonda (`r16/l14/parcial/`):
  o service worker (Serwist, `NetworkFirst` para outra origem) busca a
  miniatura ele mesmo, e o que ele busca não passa pelo `page.route` — com
  o SW já no controle da página, a miniatura chegava de verdade e o "sem
  rede" não aparecia. O teste passa a bloquear o SW
  (`test.use({ serviceWorkers: "block" })`, como `ultraloop-b-r2.spec.ts`
  já faz pelo mesmo motivo) e ganhou a checagem do nome acessível. Nenhuma
  asserção afrouxou.
- **Menores só registrados, com motivo:** (1) as tags de equipamento com e
  sem link têm o mesmo visual (sublinhado só no hover) — a SPEC §22.14
  item 3(c) aceita a tag sem coleção como texto e o aceite está cumprido;
  dar sinal visual aos links é affordance, vai para o ledger. (2) O
  critério "12 caracteres contido em outro" com números ("7,5 kg na barra"
  ⊂ "17,5 kg na barra") — a auditoria confirmou 0 repetição real nos 345
  perfis. (3) tela-explorar-fichas-26: o FAZER do ledger ("ícone de link
  externo no próprio rótulo") foi revertido na rodada 15 com motivo (SPEC
  §22.14 item 4); o retorno do lote lista o item como aceite ajustado,
  junto do copy-25.

##### Provas (rodada 16)

- **e2e** (`e2e/ultraloop-l14.spec.ts`, +3, **37** no total): (1) dentro da
  Visão geral, nos dois temas, abrir pelo teclado a "substituir hoje" e a
  ficha do "Como fazer" do bloco → `history.back()` (o voltar do Android e
  do TalkBack) → a folha some, a Visão geral continua visível, o foco volta
  ao gatilho, a URL é a mesma, o índice do histórico
  (`navigation.currentEntry.index`) volta ao de antes do voltar e nenhum
  `inert` sobra; sem folha, o voltar seguinte fecha a Visão geral e o
  player (mesma URL) volta com o botão "Visão geral do treino". (2) Na
  ficha do supino, a foto ampliada aberta pelo teclado: foco no "Fechar a
  foto"; o Esc que ela trata chega ao `window` (em bolha, onde a Visão
  geral escuta) com `defaultPrevented = true`; o foco volta ao "Ampliar a
  foto do início" depois do Esc e depois do X. (3) O teste "sem rede" do
  item 4 ganhou `toHaveAccessibleName("Abrir no YouTube (abre fora do
  app)")` e o SW bloqueado. O e2e do anel (item 11) espera o fim da
  transição por `getAnimations()`, sem `waitForTimeout`.
- **Sondas** (não contam como cadeia): `r16/l14/parcial/` — build:e2e +
  grep dos itens 4, 6 e 11 = 13 de 14 (o "sem rede" do tutorial falhou
  pelo SW, acima); `r16/l14/parcial2/`, com o SW bloqueado no teste =
  **14 de 14**.
- **Mutação** (`r16/l14/mut/`, no worktree, sem commit, código restaurado
  depois): o `popstate` da Visão geral sem olhar a camada de cima, a foto
  sem devolver o foco e o link sem o `sr-only` → **4 falhas em 4** (o voltar
  claro e escuro: "element(s) not found" na Visão geral; o foco da foto:
  `toBeFocused`; o nome do link: `toHaveAccessibleName`). O teste antigo do
  §22.5 item 3 (`ultraloop-a-r3`, o voltar sem folha fecha a lista) passou
  com e sem o mutante — o caminho sem camada não mudou.
- `git diff 0d54e5f -- lib/progressao.ts lib/montagem.ts`: vazio.

##### Portões (rodada 16)

Cadeia inteira em `bd88cbd` (todo o código e os testes da rodada 16;
`r16/l14/logs/bd88cbd.log`, das 14:00:37 às 14:27:31 UTC, **status ok**):
`lint` limpo · `tsc --noEmit` limpo · `npm test` **67 arquivos, 1.540
testes, todos verdes** (a rodada 16 não mexeu em função pura) · `build`
("Compiled successfully in 21.2s") · `build:e2e` ("Compiled successfully
in 19.4s") · `e2e` **514 passaram, 5 pulados, 0 falharam** (20,4 min; eram
511 + 5 em `4f55487`: +3 do spec do L14, que tem 37 linhas ✓ no log) ·
`varredura` **5 de 5** (4,4 min). O log traz as medidas do anel do
primário ("[anel-primario] light: anel 5.25:1 · vão 1.00:1", "dark: anel
8.75:1 · vão 1.00:1"). O commit deste registro só acrescenta estes números
ao PROGRESSO; a cadeia roda de novo, inteira, nele
(`r16/l14/logs/<hash>.log`).

##### Capturas (rodada 16)

`capturas.sh` em `bd88cbd`, depois da cadeia verde, contra a base real de
`main` (`base-ef3ad97`), com as seis telas declaradas
(`r16/l14/capturas-bd88cbd.md`): 60 de 60 PNGs, **"Nenhuma tela mudou fora
do esperado"**. Os 60 PNGs são **byte a byte iguais** aos de `4f55487`
(`cmp`, 0 diferentes): a rodada 16 não muda nada que as capturas mostrem
(a Visão geral com folha, a foto ampliada e o "sem rede" não estão nelas;
o "(abre fora do app)" é `sr-only`). Diff aberto: 10 escuro contra a base
— "Voltar" no topo, o mapa sem a ilustração na aba Músculos e "Aparece
em:" com os dois chips, como na rodada 15.

| tela | Δ claro | Δ escuro | o que mudou (contra a base de `main`) |
| --- | ---: | ---: | --- |
| 10-ficha-folha (página na aba Músculos) | 41,03 % | 42,15 % | o mesmo da rodada 15 ("Voltar", Músculos só com o mapa, "Aparece em:", aba "Tutorial no YouTube" sem setinha) |
| 09-ficha-exercicio | 27,01 % | 31,66 % | o mesmo da rodada 15 ("Voltar", abas pelo rótulo) |
| 24-creditos | 2,70 % | 2,64 % | só o parágrafo do mapa muscular |
| 04-treino-lista | 0,00 % | 0,00 % | nada: a folha "Substituir hoje" não está aberta na captura |
| 08-catalogo | 0,00 % | 0,00 % | nada: a folha de filtros está fechada na captura |
| 17-corpo-fotos | 0,00 % | 0,00 % | nada: o cartão "Apagar esta foto?" não está aberto na captura |

##### Como testar no celular (rodada 16)

1. Treino → Começar → no player, o ícone de lista (Visão geral) → num bloco,
   "substituir hoje" → **voltar do celular** (botão ou gesto): só a folha
   fecha; a Visão geral continua aberta, no mesmo lugar. O mesmo com o "?"
   (Como fazer) do bloco. Sem folha aberta, o voltar fecha a Visão geral e
   você fica no player (não sai do treino). Com teclado Bluetooth, o Esc faz
   o mesmo que o voltar.
2. Com TalkBack/VoiceOver: na mesma folha, o gesto de voltar fecha só a
   folha e o foco volta ao "substituir hoje".
3. Ficha do supino (Explorar → Exercícios) → "Ampliar a foto do início" →
   feche pelo X (ou Esc): o foco volta ao botão da foto, não ao topo da
   página. (Rodada 17: isso se vê com teclado Bluetooth ou leitor de tela,
   que põem o foco no botão ao abrir; o toque com o dedo no Safari do
   iPhone não foca o botão, então não há foco para voltar.)
4. No modo avião, ficha → "Tutorial no YouTube": com o leitor de tela, o
   link lê "Abrir no YouTube (abre fora do app)"; na tela, nada mudou.

#### Rodada 15 — auditoria 2 reprovou por a regra da folha valer só na folha; lote devolvido à fila

A auditoria 2 sobre `1d41620` (cadeia verde: 1.540 unitários, 514 e2e + 5
pulados, varredura 5/5; capturas só 09, 10 e 24) reprovou nas **duas
lentes** pelo mesmo motivo de fundo, 0 bloqueantes: o contrato do lote e a
SPEC §22.14 item 6 prometiam a regra da folha (a11y-05: foco guardado e
devolvido a quem abriu, `aria-modal`, fundo inerte, Esc e voltar fecham só
a camada de cima) para **toda** camada modal, mas só `components/ui/sheet.tsx`
a cumpria. Medido: o alerta "Descartar este treino?" e o resumo do fim,
abertos por estado dentro da Visão geral, fechavam com o foco no `<body>`
e abriam sem `aria-modal` e com o fundo vivo; na foto ampliada, 6 de 6
Tabs saíam da camada (no Corpo, para a barra de baixo), e no "Apagar esta
foto?" também, até o aviso "Foto de frente guardada." por cima do véu.
Lote devolvido à fila. Vereditos: `r15/l14/vereditos-auditoria-2.json`.

#### Rodada 16 — retomada (segunda correção, logs em `r17/l14`)

Retomada sobre `1d41620`, na mesma branch; logs em `r17/l14/`. Commits:
`9cd961e` (a regra num lugar só e os três primitivos), `cb9845d` (foto
ampliada e cartão), o e2e e a SPEC (§22.14 item 6: inventário e regra).

##### O que mudou (era → é)

- **A regra da folha num lugar só** (`lib/camada-modal.ts` +
  `lib/camada-modal.test.ts`, `components/ui/camada-modal.ts`). **Era:** a
  regra morava dentro de `sheet.tsx` (`inertizarForaDe` e o `anterior`), e
  `dialog.tsx`/`alert-dialog.tsx` não tinham nada: o Radix devolve o foco
  só ao `Trigger`, e sem ele o foco caía no `<body>`. **É:** a parte que se
  decide sem DOM está em `lib/` (quais irmãos ficam inertes; marcas
  contadas por nó, para que fechar uma camada — a de cima ou a de baixo,
  em qualquer ordem — não libere o que outra ainda precisa inerte; quem
  recebe o foco na volta, com a cadeia de quem abriu a camada de baixo; o
  Tab preso nas bordas) e `components/ui/camada-modal.ts` aplica no DOM:
  `useCamadaModal` para os primitivos do Radix e `useCamadaPropria` para a
  camada própria da foto.
- **Folha, diálogo e alerta** (`components/ui/sheet.tsx`, `dialog.tsx`,
  `alert-dialog.tsx`). **Era:** só a folha era modal de verdade. **É:** os
  três usam o mesmo `useCamadaModal`: `aria-modal="true"`, fundo `inert`
  enquanto abertos e o foco de volta a quem abriu. Ganham com isso o
  "Descartar este treino?" e o resumo do fim da Visão geral, o fim do
  cardio, os dois diálogos do calendário e a retomada.
- **Foto ampliada e "Apagar esta foto?"**
  (`components/exercicios/foto-ampliada.tsx`). **Era:** foco no X e Esc
  próprios, mas o Tab saía da camada e o fundo não ficava inerte; o cartão
  nascia com o foco no "Apagar" (destrutivo) e, ao fechar, o foco caía no
  `<body>`. **É:** `useCamadaPropria` na foto e no cartão (agora um
  componente, `ConfirmarApagar`): fundo inerte (sob o cartão, a própria
  foto), Tab e Shift+Tab presos, foco de volta — o cartão ao "Apagar" da
  foto, a foto ao "Ver a foto"/"Ampliar a foto". O cartão nasce no
  **Cancelar**.
- **SPEC §22.14 item 6** ganhou o **inventário** de toda camada modal do
  app (19 linhas: 17 com a regra, a Visão geral em parte e a tela de
  descanso, que não é camada) e diz só o que o código faz. Fora, com
  motivo, e para a fila: o foco ao abrir a Visão geral
  (`a11y-visao-geral-foco-ao-abrir`) e o voltar fechando só a camada de
  cima fora da Visão geral (`a11y-voltar-fecha-camada`: nenhuma camada de
  página tem entrada no histórico). Também: o parágrafo da rodada 16 não
  põe mais a foto ampliada sobre a Visão geral (ela não abre lá) e diz que
  o voltar espera a gravação do resumo; o item 3 registra as duas
  correções de dado da rodada 15 (`48b7603`).

##### Correção da auditoria

- **Importante (tela): "Descartar este treino?" não devolvia o foco** →
  `alert-dialog.tsx` com `useCamadaModal`; e2e nos dois temas com Esc e
  com `history.back()`: foco no "Descartar este treino" do rodapé, Visão
  geral aberta, rota e índice do histórico os de antes, 0 `inert`.
- **Importante (tela): foto ampliada e "Apagar esta foto?" soltavam o Tab e
  o fundo** → `useCamadaPropria`; e2e: 12 Tabs e 4 Shift+Tabs dentro,
  nenhum focável fora sem `inert`, nos dois temas no Corpo e na ficha.
- **Importante (regra): a SPEC prometia foco devolvido no alerta e no
  diálogo** → os dois primitivos guardam quem abriu, têm `aria-modal` e
  fundo inerte, e há e2e do Esc e do voltar para o alerta e o resumo do
  fim, mais o caso empilhado (o alerta que some por baixo do resumo não
  libera o fundo).
- **Menores feitos:** o cartão nasce no Cancelar (tela); a foto sai da
  lista de camadas sobre a Visão geral na SPEC e no PROGRESSO (tela); o
  item 3 da SPEC registra as correções de dado da rodada 15 (regra); o
  "Como testar (rodada 16)" passo 3 diz que o foco de volta se vê pelo
  teclado ou leitor de tela (regra); a SPEC diz que o voltar com o resumo
  gravando espera a gravação (regra).
- **Menores registrados:** a Visão geral aberta pelo teclado deixa o foco
  no `<body>` (já existia, §22.5) → fila `a11y-visao-geral-foco-ao-abrir`;
  "Super Band" nomeia dois filtros com resultados diferentes (Implemento
  2, Equipamento 5) — é o FAZER literal do OBS-elastico e está no aceite.


##### Provas (rodada 16 — retomada)

- **Vitest** (`lib/camada-modal.test.ts`, novo, **13 testes**): o que fica
  inerte (main, header, nav, o portal de outra camada) e o que fica de fora
  (nós sem conteúdo, avisos `aria-live`, anunciador de rota, véu); marcas
  empilhadas — fechar a de cima não libera a de baixo, e a de baixo
  fechando antes (o alerta que some por baixo do resumo) não libera o fundo
  da de cima; os candidatos ao foco da volta (com a cadeia de quem abriu a
  camada de baixo) e o primeiro que ainda recebe foco; o Tab preso nas
  bordas, com foco fora da camada e com um focável só.
- **e2e** (`e2e/ultraloop-l14.spec.ts`, +6, **43** no total), cada um
  medindo `aria-modal="true"`, **nenhum focável fora da camada sem
  `inert`** (fora os avisos `aria-live` e as sentinelas do Radix), 12 Tabs
  e 4 Shift+Tabs dentro dela e o foco de volta no gatilho com 0 `inert`
  depois: (1) dentro da Visão geral, nos dois temas, o alerta "Descartar
  este treino?" e o resumo do fim, cada um fechado pelo Esc e pelo
  `history.back()` — a Visão geral continua, a URL e o índice do histórico
  são os de antes; (2) camadas empilhadas: "Descartar este treino" do
  alerta abre o resumo, o alerta some por baixo e o resumo continua modal
  com o fundo inerte; o Esc devolve o foco ao "Descartar este treino" do
  rodapé; (3) a foto ampliada da ficha do supino; (4) Corpo → Fotos, nos
  dois temas: a foto modal; o cartão "Apagar esta foto?" nasce no
  Cancelar, é modal com a foto inerte embaixo, e fecha pelo Esc, pelo
  toque fora e pelo Cancelar — cada vez a foto continua modal, com o foco
  no "Apagar"; o Esc seguinte fecha a foto e o foco volta ao "Ver a foto".
  A folha continua coberta pelos três casos da rodada 14.
- **Sondas** (não contam como cadeia; `r17/l14/parcial/`): `build:e2e` em
  `cb9845d` ok; grep "item 6" = 19 de 21 — os 2 do Corpo falharam no
  "toque fora" em (180, 60), que caía no aviso "Foto de frente guardada."
  (ele fica por cima do véu, fora da camada, de propósito: é `aria-live`);
  o toque passou a (180, 580), entre a foto e o cartão; grep "Apagar esta
  foto|Fotos" = **18 de 18** (inclui os specs antigos do Corpo e do item 5).
- **Mutação** (`r17/l14/mut/`, no worktree, sem commit, código restaurado
  com `git checkout` depois de cada uma): **m1** — `devolverFoco` sem efeito,
  Tab preso desligado na camada própria e as marcas sem contagem (cada
  camada solta tudo o que tocou) → **7 falhas em 7 esperadas**: folha da
  ficha no player, alerta/resumo claro e escuro (`toBeFocused`), empilhadas
  ("focáveis fora da camada sem inert", 176), foto da ficha ("Tab 1") e
  Corpo claro e escuro ("Tab 2"); as duas folhas com `SheetTrigger`
  passaram (o Radix devolve o foco ao Trigger sozinho — esperado). **m2** —
  sem `aria-modal` no diálogo e no alerta, e nada fica inerte → **9 falhas
  em 9**: as três folhas (`main` inerte), alerta/resumo claro e escuro e
  empilhadas (`aria-modal`), foto da ficha e Corpo claro e escuro
  ("focáveis fora da camada sem inert", 26 e 16).
- `git diff 0d54e5f -- lib/progressao.ts lib/montagem.ts`: vazio;
  `package.json`, `package-lock.json` e `supabase/` sem mudança; nenhum
  segredo no diff.

##### Como testar no celular (rodada 16 — retomada)

1. Treino → Começar → no player, o ícone de lista (Visão geral) → no
   rodapé, "Descartar este treino" → o alerta abre com o foco no
   "Cancelar". Feche pelo **voltar do celular**: só o alerta fecha, a
   Visão geral continua. Com teclado Bluetooth, o Esc faz o mesmo e o foco
   volta ao "Descartar este treino"; o Tab não sai do alerta.
2. Na mesma Visão geral, "Concluir" → o resumo do fim → voltar (ou Esc):
   só o resumo fecha, o foco volta ao "Concluir". Com TalkBack/VoiceOver,
   deslizar dentro do alerta ou do resumo não chega à lista de trás.
3. Corpo → Fotos → toque numa foto → "Apagar": o cartão abre com o foco no
   "Cancelar". Toque na parte escura acima do cartão: só o cartão fecha, a
   foto continua. Com teclado, o Tab fica entre "Cancelar" e "Apagar" no
   cartão, e entre o X e o "Apagar" na foto — nunca na barra de baixo.
4. Explorar → Exercícios → supino → "Ampliar a foto do início" → com
   teclado, o Tab fica no X; Esc fecha e o foco volta ao botão da foto.
   (O foco de volta se vê pelo teclado ou pelo leitor de tela: o toque do
   dedo no Safari não foca o botão.)

##### Portões (rodada 16 — retomada)

Cadeia inteira em `e1b7feb` (todo o código, os testes, a SPEC e o rascunho
deste registro; `r17/l14/logs/e1b7feb.log`, das 15:35:58 às 16:02:17 UTC,
**status ok**): `lint` limpo · `tsc --noEmit` limpo · `npm test` **68
arquivos, 1.553 testes, todos verdes** (eram 67 e 1.540: +1 arquivo e +13
testes, `lib/camada-modal.test.ts`) · `build` ("Compiled successfully in
19.0s"; `/exercicios/[id]` 389 kB de first load, era 388 — o hook não traz
o Radix para a ficha) · `build:e2e` ("Compiled successfully in 18.2s") ·
`e2e` **520 passaram, 5 pulados, 0 falharam** (20,0 min; eram 514 + 5: +6
do spec do L14, que tem **43** linhas ✓ no log, nenhuma ✘ nem flaky) ·
`varredura` **5 de 5** (4,3 min). Medidas do anel do primário no log:
"light: anel 5.25:1 · vão 1.00:1", "dark: anel 8.75:1 · vão 1.00:1". O
commit deste registro só acrescenta estes números ao PROGRESSO; a cadeia
roda de novo, inteira, nele (`r17/l14/logs/<hash>.log`).

##### Capturas (rodada 16 — retomada)

`capturas.sh` em `e1b7feb`, depois da cadeia verde, contra a base real de
`main` (`base-ef3ad97`), com as seis telas declaradas
(`r17/l14/capturas-e1b7feb.md`): 60 de 60 PNGs, **"Nenhuma tela mudou fora
do esperado"**, e os 60 são **byte a byte iguais** aos de `1d41620` (`cmp`,
0 diferentes): nenhuma captura tem camada aberta (folha, alerta, resumo,
foto ou cartão), e a regra muda atributos (`aria-modal`, `inert`) e foco,
não pixels. Diffs abertos contra a base: 09 escuro ("Voltar" no topo e as
abas pelo rótulo, como na rodada 15) e 24 claro (só o parágrafo do mapa
muscular).

| tela | Δ claro | Δ escuro | o que mudou (contra a base de `main`) |
| --- | ---: | ---: | --- |
| 10-ficha-folha (página na aba Músculos) | 41,03 % | 42,15 % | o mesmo da rodada 15 ("Voltar", Músculos só com o mapa, "Aparece em:", aba "Tutorial no YouTube" sem setinha) |
| 09-ficha-exercicio | 27,01 % | 31,66 % | o mesmo da rodada 15 ("Voltar", abas pelo rótulo) |
| 24-creditos | 2,70 % | 2,64 % | só o parágrafo do mapa muscular |
| 04-treino-lista | 0,00 % | 0,00 % | nada: a folha "Substituir hoje" não está aberta na captura |
| 08-catalogo | 0,00 % | 0,00 % | nada: a folha de filtros está fechada na captura |
| 17-corpo-fotos | 0,00 % | 0,00 % | nada: a foto e o cartão "Apagar esta foto?" não estão abertos na captura |

#### Auditoria

- **Auditoria 1 em `a68ea7f`: aprovada** (bloqueantes 0, importantes 0,
  menores 9: 6 da lente de regra e 3 da lente de tela). Pré-condições
  conferidas nas duas lentes (`a68ea7f.status` ok, 1.553 unitários, 520 e2e
  + 5 pulados, varredura 5/5, motor sem diff, árvore limpa). A lente de
  regra matou 5 de 5 mutantes de `lib/camada-modal.ts` e conferiu o
  inventário contra o grep (19 linhas, nenhuma camada modal fora). A lente
  de tela mediu as 17 camadas nos dois temas a 360×740 (aria-modal, 0
  focáveis soltos, 0 fugas de Tab, Esc, foco no gatilho, 0 `inert` depois),
  mais as empilhadas na Visão geral e no Corpo → Fotos. Nada foi comitado
  pelas auditorias (vereditos em `r17/l14/auditoria-1-regra/` e
  `r17/l14/auditoria-1-tela/`). As reprovações anteriores (auditoria 2 da
  rodada 14 e da rodada 15) estão acima, com as correções.

Menores registrados (ficam na fila, nenhum quebra o aceite):

- **[regra]** SPEC §22.14 item 6, inventário, linha de
  `components/exercicio/ficha-folha.tsx`: a coluna "Como abre" cita só o
  player e o "Como fazer" do bloco, mas a mesma folha também abre por
  estado em `components/treino/lista.tsx:148` (toque no exercício da lista
  do dia) e em `components/colecoes/lista-da-colecao.tsx:73` (lista de uma
  coleção do Explorar). A camada está na tabela e a regra vale para ela
  (`sheet.tsx`); só falta completar a descrição.
- **[regra]** `components/treinar/visao-geral.tsx`, comentário do
  `aoVoltarDoCelular`: ainda diz "Com uma folha, um alerta ou a foto
  ampliada aberta por cima da lista". A SPEC e o PROGRESSO já tiraram a
  foto dessa lista (ela não abre dentro da Visão geral). O comentário
  ficou velho.
- **[regra]** SPEC §22.14 item 6 diz que, com o resumo do fim gravando, "o
  voltar, que vira Esc, espera o fim dela". No código (`resumo.tsx` +
  `visao-geral.tsx`) o popstate repõe a entrada e o Esc é ignorado porque
  `aoFechar` não faz nada com `salvando`: o voltar é descartado, não fica
  pendente. Nenhum e2e cobre o caso. Melhor dizer "o voltar não faz nada
  enquanto grava".
- **[regra]** `components/ui/camada-modal.ts:54`: o ramo `data-veu` não é
  usado por ninguém (grep vazio em `app/` e `components/`). O teste
  `slot.endsWith('-overlay')` tira do `inert` o véu de qualquer camada
  irmã, não só "o véu da própria camada" que a SPEC descreve. Não faz mal
  (o véu não é focável e fica coberto pelo de cima), mas a SPEC diz menos
  do que o código faz.
- **[regra]** Nomes das rodadas: a SPEC chama esta correção de "rodada 17"
  (item 6) e o PROGRESSO a registra como "Rodada 16 — retomada (segunda
  correção, logs em `r17/l14`)", ao lado de outra "Rodada 16 — correção da
  auditoria 1 da rodada 15"; uma "Rodada 15 — auditoria 2 reprovou…"
  aparece depois de uma "Rodada 16". Quem lê não acha a mesma rodada pelo
  nome nos dois arquivos.
- **[regra]** Ordem dos commits na correção: a SPEC com o inventário
  (`febfbcd`) entrou depois do código (`9cd961e`, `cb9845d`); a regra pede
  a §22.14 antes do código. Atenuante: o item 6 já prometia a regra para
  toda camada desde a rodada 15; só o inventário veio depois.
- **[tela]** Anterior ao lote (mesma classe `absolute top-3 right-3` em
  `0d54e5f`): no Corpo → Fotos, logo depois de guardar a foto, o aviso
  "Foto de frente guardada." (sonner, top-center, fora do `inert` por ser
  `aria-live`) cobre o X "Fechar a foto" (304,12 44×44); um toque ali não
  fecha a foto e, com o ponteiro parado, o aviso não some (o sonner pausa
  no hover). Sugestão: o aviso não sobrepor o X da camada.
- **[tela]** Ficha em página, seção "Equipamento": a pílula sem coleção
  ("Anilhas", 54×20) tem cor, borda, fundo e sublinhado iguais às que são
  link ("Banco", "Barra maciça", "Cavalete", 44 px): nada diz qual abre a
  coleção. A SPEC §22.14 item 3(c) manda o texto sem link e o aceite passa;
  só falta a diferença visual.
- **[tela]** Anterior ao lote: o "Recomeçar do zero?" da Retomada
  (`dialog.tsx`) nasce com o foco em "Entendi, quero recomeçar" (primeiro
  botão, padrão do Radix), não em "Agora não". Não apaga nada na hora (há
  uma 2ª etapa), mas a §22.14 item 6 mudou o "Apagar esta foto?" para
  nascer na resposta que não destrói nada; fica para a fila, por coerência.

**Deploy (rodada 16, 23/09 16:50 UTC).** Publicado. O deployment passou de
`dpl_EpXGuzxJpDfZJKkxXC1sZEaHDEQk` para `dpl_HwhvXX4W8TJQ9ECiQKCgq7L7RwC7`, e
`main` passou de `0d54e5f` para `0f730c9f187152570b996c2801845ca8d31188f6`
(PR #23). O merge do lote na integração é `fa76e41`, sem conflito, com a
árvore idêntica a `a68ea7f`, mais o veredito da auditoria em `370411a`.
`/versao` devolveu esse sha às 16:50:59, ~2 min depois do merge (build de
16:49:33Z). O CSS de `/login` mudou de `9e6c9d2acce91a00` para
`e0156b4c4cac1bd9`. Portão final na integração: `lint` e `tsc --noEmit`
limpos, 68 arquivos e 1.553 testes verdes. O e2e não foi repetido, porque o
código é idêntico a `a68ea7f` (520 e2e, 5 pulados, varredura 5/5).

Fumaça em produção, item a item: `/login` 200 · com "Treino do Terraço" ·
com "Entrar" · sem "Configure NEXT_PUBLIC_SUPABASE_URL" · sem "é secreta" ·
`/` → 307 · para `/login` · `/versao` == sha do merge · `/sw.js` 200 · com
`/~offline` · com `figuras/` · com o mesmo CSS do HTML de `/login` ·
`/manifest.webmanifest` 200 · com "Treino do Terraço" · `/~offline` 200 ·
os 14 scripts `/_next/static` de `/login` 200 · marcadores do lote pelo
grafo de módulos a partir do chunk da ficha
(`app/(app)/exercicios/[id]/page-4f229de9a65b384f.js`, 36 chunks):
"Fazer agora" e "Voltar" no chunk compartilhado `2246-2d59e1bb7ef1dc4e.js`, e
"YouTube" em `2246-…` e `435-10b0a20ebecc3359.js`. Foram quatro execuções
(16:51, 16:52, 16:55 e 16:57 UTC, ≥ 40 s entre elas). A 1ª, a 3ª e a 4ª
deram **18 de 18**. A 2ª deu 16 de 18: `/versao` e um script voltaram sem
resposta HTTP (000, falha de transporte do proxy). Os dois itens deram 200
nas outras três, e o chunk que falhou deu 5 de 5 em 200 no reteste. Sonda
a 360×740 (Chromium): `/login` e `/~offline` sem erro de console e sem
vazamento horizontal (scrollWidth 360 = clientWidth). Capturas: 09, 10 e 24
(claro e escuro) de `r17/l14/capturas-a68ea7f` viraram a base visual
(`base-ef3ad97`, `indice.json` com head `0f730c9`; wt-base não avançado).
Nenhuma migração de banco. **Rollback: não.**

### Rodada 17 — Lote 34 — Lembretes I: inscrição no aparelho e notificação de teste

Branch `polimento/l34-lembretes-inscricao`, a partir de `main` `27eda74`.
SPEC §23 (escrita antes do código, commit `2153ea0`). Feature nova aprovada
pelo dono em 23/09: o app passa a avisar no celular por Web Push. Este lote
é a **parte I** — o aparelho se inscreve, o service worker mostra o aviso e
abre o app no lugar certo, e um botão manda um lembrete de teste. Horários e
disparo automático são o L35 (§23, "Lembretes II"): nada disso existe aqui.
`lib/progressao.ts` e `lib/montagem.ts`: `git diff 27eda74` vazio.

#### O que mudou

1. **Banco: `public.lembretes_inscricoes`** (LEM-banco-inscricoes;
   `supabase/schema.sql`, `supabase/migracoes/2026-09-23-lembretes-inscricoes.sql`
   (novo), `lib/migracao-lembretes.test.ts` (novo), `lib/sql.ts` (novo — o
   leitor de comandos SQL que estava dentro de `lib/migracao-contas.test.ts`,
   agora usado pelos dois testes), `lib/auditoria-seguranca.test.ts`,
   `scripts/mock-supabase.ts`, `lib/schemas.ts`). **Era:** nenhuma tabela de
   inscrição. **É:** uma linha por aparelho (`endpoint` único, `p256dh`,
   `auth`, `aparelho`, `criado_em`; `ultimo_envio_em` e `falhas` ficam para o
   L35), índice por `user_id`, RLS com três policies por `auth.uid()` (ler,
   inserir, apagar as suas; sem update) e `revoke all … from anon`. O mesmo SQL
   nos dois arquivos, idempotente e só de acréscimo. A tabela é **por
   aparelho**: fica fora do laço de RLS "for all" e fora do backup (a
   inscrição só vale no navegador que a criou) — a auditoria de segurança
   ganhou essa categoria com teste próprio. **Não aplicada no projeto real**
   (o orquestrador aplica antes do deploy).
2. **Service worker** (LEM-sw-push; `app/sw.ts`, `lib/lembretes.ts` (novo)).
   **Era:** sem `push` nem `notificationclick`. **É:** `push` monta a
   notificação por `opcoesDaNotificacao()` (título, corpo, ícone e badge
   `/icons/icone-192.png`, `tag` que substitui a anterior, `lang: "pt-BR"`,
   `data.url` só se for caminho do app); `notificationclick` fecha, leva uma
   aba do app já aberta à `url` (tenta o foco) ou abre uma nova.
3. **Mais → Lembretes** (LEM-pagina-lembretes; `app/(app)/mais/page.tsx`,
   `app/(app)/mais/lembretes/page.tsx` (novo),
   `components/mais/tela-lembretes.tsx` (novo)). **Era:** nada. **É:** a linha
   "Lembretes — Receber avisos no celular; ative em cada aparelho." em Mais
   (entre Preferências e Créditos) e a tela com o estado deste aparelho
   (`estadoDoAparelho()`: sem configuração · não suportado · bloqueado ·
   ativado · desativado), "Ativar lembretes neste aparelho"
   (`requestPermission` + `pushManager.subscribe` com a chave pública + a
   linha na tabela **com o `user_id` da sessão**, que a página recebe do
   servidor; se o `endpoint` já era de outra conta, cancela e pede uma
   inscrição nova), "Desativar neste aparelho", a lista "Aparelhos desta
   conta" com "Remover" e "Enviar um lembrete de teste". O servidor entrega
   ao navegador só a chave pública, lida do ambiente em tempo de execução.
4. **Lembrete de teste** (LEM-rota-teste; `app/api/lembretes/teste/route.ts`
   (novo), `lib/web-push.ts` (novo), `lib/supabase/middleware.ts`).
   **Era:** nenhuma rota de API. **É:** `POST /api/lembretes/teste` (runtime
   `nodejs`) lê as inscrições **com a sessão de quem pediu** (a RLS limita) e
   manda a cada uma o payload de teste cifrado `aes128gcm` (RFC 8291) com
   `Authorization: vapid t=<JWT ES256>, k=<pública>` (RFC 8292), `TTL`,
   `Urgency` e `Topic`; 404/410 apaga a inscrição; devolve o texto da tela
   ("Enviado para 1 aparelho."). Sem as variáveis VAPID, 503 "Lembretes ainda
   não configurados neste servidor."; tabela ausente, 503 com o aviso do
   banco. Só chama `endpoint` `https` de serviço de push conhecido (FCM,
   Mozilla, Apple, Windows) — a inscrição é dado do usuário, e sem isso a rota
   faria POST para qualquer endereço; o servidor falso dos testes entra só por
   `LEMBRETES_PUSH_DE_TESTE`, e só em 127.0.0.1/localhost. O middleware passou
   a responder **401 em JSON** às rotas `/api/*` sem sessão (antes seria o 307
   para `/login`).
5. **Instruções** (LEM-instrucoes-navegador; `lib/lembretes.ts`,
   `tela-lembretes.tsx`). `instrucoesDoAparelho()` segue a **tabela das 80
   combinações da SPEC §23.6** (desde a rodada 18; o Vitest lê a tabela do
   SPEC.md): Brave (`navigator.brave`) **fora do iPhone**, com a inscrição
   falhando ou a permissão negada → ligar "Usar os serviços do Google para
   mensagens push" em Configurações → Privacidade e segurança (nunca em "sem
   suporte" nem no iPhone, onde essa opção não existe); permissão negada →
   cadeado → Permissões → Notificações → Permitir (ou Configurações do
   Android → Apps → Treino do Terraço → Notificações) e, no iPhone, Ajustes
   → Notificações → Treino do Terraço → "Permitir Notificações"; iPhone fora
   da tela inicial → Compartilhar → Adicionar à Tela de Início (iOS 16.4+);
   sem suporte → Chrome ou Brave no Android, app instalado com iOS 16.4+ no
   iPhone; qualquer outra falha ao ativar (Chrome, app instalado no iPhone,
   permissão dispensada) → "Para tentar de novo" (a falha nunca fica só com
   a frase). Ao voltar das configurações, a tela confere de novo sozinha.
6. **SPEC §23 e guia** (LEM-spec-23; `SPEC.md`, `lib/guia.ts`). §23 com o
   desenho inteiro (I neste lote, II marcada para o L35), segurança e aceite;
   §11 anotada ("notificações push" revogado pela §23) e §20.5 cita
   Lembretes. O guia (Mais → Como usar o app → Mais) ganhou "Lembretes", com
   título, descrição e rota de `LINHA_LEMBRETES` — a mesma fonte da linha de
   Mais.

**A dependência `web-push` não entrou** (o contrato a permitia): o
`node_modules` desta máquina é um só para todas as faixas (symlink para
`/home/user/WORKOUT/node_modules`) e o `npm install web-push @types/web-push
--dry-run` listou 133 pacotes a acrescentar e dezenas de "change" em pacotes
existentes do diretório compartilhado. As duas RFCs cabem em
`lib/web-push.ts` (~250 linhas, só `node:crypto`), e o teste reproduz **byte
a byte o exemplo do Apêndice A da RFC 8291** (cabeçalho de 86 bytes e cifra).
`package.json` e `package-lock.json` não mudaram.

**Variáveis novas** (documentadas em `.env.local.example`, sem valor — é o
arquivo de exemplo que o projeto já tem; nenhum `.env.example` paralelo):
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` (65 bytes, base64url), `VAPID_PRIVATE_KEY`
(32 bytes, base64url, **segredo**: só no servidor, Sensitive na Vercel),
`VAPID_SUBJECT` (`mailto:` ou `https:`). O servidor confere se a pública é a
do par (`publicaDaPrivada`); se não for, trata como não configurado. Os
testes geram o par na hora (`e2e/playwright.config.ts`, Vitest).

#### Provas

- **Vitest** (novos; contagens do `vitest --reporter=json` do HEAD da rodada
  18, `r19/l34/vitest-4192cd5.json`): `lib/web-push.test.ts` (7: vetor da
  RFC 8291 byte a byte, decifragem, JWT ES256 conferido com a pública,
  cabeçalhos), `lib/web-push-prova.test.ts` (5, rodada 18: a prova
  independente pelo WebCrypto — JWT r‖s de 64 bytes em `subtle.verify`,
  cabeçalhos, decifra pela RFC 8291 escrita no teste), `lib/lembretes.test.ts`
  (36: notificação, estados, instruções — com a tabela da SPEC §23.6 como
  oráculo das 80 combinações —, aparelho, destino 404/410, textos, endpoints
  aceitos, configuração VAPID, fonte única Mais/guia; eram 29 em `ade3e6a` e
  33 em `96c2b5e`), `lib/migracao-lembretes.test.ts` (17: subconjunto do schema,
  idempotência, expand-only, RLS), `lib/supabase/middleware.test.ts` (+2:
  `/api` sem sessão = 401 JSON; com sessão passa), `lib/auditoria-seguranca.test.ts`
  (+1: tabela por aparelho com RLS própria, fora do backup).
- **Mutação** (cópia no scratchpad, `mut/mutar.py`): 21 mutações nas linhas
  que decidem — cifragem sem o `\0` do info, sem o delimitador `0x02`,
  assinatura DER, `//` aceito como url interna, `lang` "en", sem o estado
  bloqueado, sem a instrução do Brave, iPhone instalado recebendo instrução,
  `http` aceito, origem de teste fora do loopback, 404 sem vencer, plural
  sempre, par VAPID não conferido, migração sem `drop policy if exists`,
  índice sem `if not exists`, select com `using (true)`, `drop column`,
  policy de delete trocada por update no schema, `/api` indo para o login,
  guia com outro nome, Mais redigitando a linha — **as 21 derrubam algum
  teste**. A da origem de teste passava na primeira rodada (o teste usava a
  porta 80, que o `URL` normaliza); o teste foi corrigido para a porta 8080 e
  a mutação passou a cair.
- **e2e** `e2e/ultraloop-l34.spec.ts` (31 testes desde a rodada 18 — +11:
  a volta das configurações ×4, o `change` da permissão ×1, a frase na
  primeira dobra ×2, sem tabela ×2, sem VAPID ×2; eram 20 desde a correção
  da auditoria 1 e 12 em `ade3e6a`, com os 2 do anel de foco; Chromium no modo headless
  novo — `channel: "chromium"`: no headless shell padrão a permissão de
  notificação fica `denied` mesmo concedida e `showNotification` recusa,
  medido com um worker mínimo): ativar/desativar nos dois temas (a linha
  gravada com `user_id`, `endpoint`, chaves e "Chrome · Android"; o
  `subscribe` recebeu a chave pública do servidor com `userVisibleOnly`;
  recarregar mantém; desativar apaga a linha e a inscrição; alvos ≥ 44 px;
  sem rolagem lateral); o teste de envio (o mock recebe o POST com
  `Authorization: vapid` cujo JWT confere com a pública, `aud` = origem do
  endpoint, `aes128gcm`, corpo que **decifra** no payload; a tela diz
  "Enviado para 1 aparelho. 1 aparelho tinha a inscrição vencida e saiu da
  lista."; a de 410 some da tabela); 401 sem sessão; RLS no mock (B não vê,
  não apaga e não reaproveita o endpoint de A); aparelho que era de outra
  conta ganha inscrição nova; o worker real transforma um `PushEvent` em
  notificação (título, corpo, tag, ícone, `pt-BR`, `data.url`) e o
  `notificationclick` leva a aba a `/relatorio` e fecha a notificação;
  permissão negada (simulada: o Playwright só concede) → bloqueado com o
  caminho; Brave simulado (`navigator.brave` + `subscribe` com AbortError) →
  instrução do Brave; sem `PushManager` → não suportado. Em `ade3e6a` esses
  três estados rodavam num tema só (bloqueado e sem suporte no escuro, Brave
  no claro) e sem `alvosDe44` no Brave e no sem suporte; desde a correção,
  cada um roda **nos dois temas**, com alvos e rolagem, mais a falha
  genérica do Chrome e o teste sem entrega (500).
- **Anel de foco da linha nova** (`app/(app)/mais/page.tsx`): a lista de Mais
  tem `overflow-hidden` (os cantos) e o anel de fora (+2 px) saía cortado dos
  lados em toda linha — medido na linha Lembretes pelo e2e novo
  (`deslocamento + largura = 4 > 0`, 2 de 2 falhando contra o build sem a
  correção, `r18/l34/local/mutacao-foco-sem-correcao.log`). As linhas passam
  ao anel **interno** (`focus-visible:-outline-offset-4`); o e2e confere, nos
  dois temas, contorno sólido ≥ 2 px inteiro dentro da caixa e o pixel 3 px
  para dentro da borda mudando com contraste ≥ 3:1 ao focar.
- **Ao vivo, fora das capturas** (`r18/l34/ao-vivo/`, mock + `next start`
  sem as variáveis VAPID, 360×740, claro e escuro): `/mais/lembretes` diz
  "Lembretes ainda não configurados neste servidor.", nenhum botão, "Mais"
  (voltar) 74×44, sem rolagem lateral (`scrollWidth − clientWidth = 0`), e
  `POST /api/lembretes/teste` com sessão responde **503** com o mesmo texto.
  O estado "tabela ausente" (migração não aplicada) tinha, nesta rodada, só
  prova de unidade (`tabelaAusente()` com `PGRST205`/`42P01`). Desde a
  rodada 18 a tela tem e2e com o `PGRST205` por `page.route`, nos dois
  temas; desde a rodada 19 a rota tem Vitest do 503 `SEM_TABELA`
  (`lib/rota-lembretes-teste.test.ts`).

#### Correção da auditoria (1ª auditoria em `ade3e6a`: regra reprovada, tela aprovada)

Vereditos em `r18/l34/auditoria-1-{regra,tela}/veredito.json`. Todos os
bloqueantes e importantes atendidos; os menores, os que cabiam sem risco.

- **Bloqueante — ativar nunca gravava no banco real.** Era: o insert da tela
  mandava `endpoint`, `p256dh`, `auth` e `aparelho`, sem `user_id`; a coluna é
  `not null` sem default e a policy é `with check (user_id = auth.uid())`, e
  a auditoria provou no Postgres 16 o `null value in column "user_id"`. O e2e
  passava porque o mock punha o dono em toda inserção. É: a página
  (`app/(app)/mais/lembretes/page.tsx`) pega o id no servidor
  (`idDoUsuario()`, como Corpo/Treinar) e a tela
  (`components/mais/tela-lembretes.tsx`, `linhaDaInscricao`) manda `user_id`
  no insert, como todo insert do app. O mock (`scripts/mock-supabase.ts`)
  deixou de mascarar: nesta tabela, insert sem `user_id` → 403 `42501` (a
  policy reprova antes do `not null`), sem `endpoint`/`p256dh`/`auth` → 400
  `23502`, e `PATCH` não altera nada (sem policy de update). O e2e confere o
  **corpo do POST** que a tela manda (`page.waitForRequest`) e ganhou o teste
  "como no banco" (42501, 23502, PATCH inerte). Uma inscrição sem as duas
  chaves passou a ser falha do `subscribe` (não grava `''`).
- **Importante — url de outro host pelo `notificationclick`.** Era:
  `urlInterna()` testava só os prefixos `//` e `/\`, e `"/\t/evil"`,
  `"/\n/evil"`, `"/\r/evil"` passavam (o parser apaga TAB/LF/CR e sobra
  `//evil`). É: resolve com `new URL(limpa, "https://app.invalid")`, exige a
  mesma origem e devolve caminho + busca + âncora (`lib/lembretes.ts`);
  Vitest com `\t`, `\n`, `\r` e `\t\`; a sonda da auditoria
  (`auditoria-1-regra/url.ts`) contra o código novo dá `/` nos três
  (`r18/l34/url-correcao.out`).
- **Importante — a falha ao ativar ficava só com a frase.** Era: com
  `falhou` e o estado "desativado", 3 das 80 combinações não davam instrução
  — justamente Chrome/Android (e o iPhone instalado, e a permissão
  dispensada). É: a instrução "Para tentar de novo" (conferir a internet e
  tocar em Ativar, escolher Permitir, ver as notificações do navegador nas
  configurações do celular) entra quando há problema e nenhum caso especial;
  Vitest varre as 80 combinações ("com problema, nunca vazia"); e2e da falha
  do Chrome nos dois temas. SPEC §23.4 e §23.6 dizem isso.
- **Importante — PROGRESSO sem cadeia verde com números.** Os Portões abaixo
  trazem os números reais de `ade3e6a` e os da cadeia do HEAD da correção.
- **Menores atendidos:** o recado de "Remover" usa "Aparelho sem nome"
  quando a linha veio sem nome; o teste que não chegou a nenhum aparelho
  (500) continua `role="status"` mas com a cor de erro (`data-falha`); os
  estados bloqueado, Brave e sem suporte rodam **nos dois temas** com
  `alvosDe44` (eram um tema só cada); `/mais/lembretes` entrou nas ROTAS da
  varredura (contraste AA e anel de foco com guarda permanente); a contagem
  do spec e as capturas citadas no PROGRESSO corrigidas; a SPEC §23.6 anota
  para o L35 o "Sair" (hoje não mexe na inscrição do aparelho) e o badge
  colorido.
- **Menores não atendidos, com motivo:** a biblioteca `web-push` segue fora
  (o contrato permitia, não obrigava; o `node_modules` é compartilhado e esta
  faixa não roda `npm install`; a cifragem é conferida byte a byte contra a
  RFC 8291) · os trailers colados ao assunto em `9df421b` ficam como estão
  (não se reescreve histórico: sem amend/rebase) · o badge monocromático
  precisa de um desenho que o kit não tem · o `notificationclick` sem aba
  aberta não é medível aqui (o Chromium nega `openWindow` a um evento
  sintético sem gesto) · a RLS no Postgres real segue com prova estática (o
  Postgres `--single` não liga RLS).
- **Mutação da correção** (cópia em `r18/l34/mut-correcao`, Vitest): sem o
  teste de origem, devolvendo a url crua, sem a instrução genérica e com a
  genérica sempre — **4 de 4 derrubadas**.

#### Portões

Cadeia inteira em `9df421b` (todo o código do lote;
`r18/l34/logs/9df421b.log`, das 18:10:55 às 18:33:11 UTC, **falhou:e2e**):
`lint` limpo · `tsc --noEmit` limpo · `npm test` **71 arquivos, 1.609
testes, todos verdes** (eram 68 / 1.553 em `27eda74`: +3 arquivos, +56
testes) · `build` ("Compiled successfully in 19.8s") · `build:e2e`
("Compiled successfully in 17.7s") · `e2e` **530 passaram, 1 falhou, 5
pulados** (20,2 min). A falha: `e2e/guia.spec.ts` "a tabela de destinos
cobre todos os hrefs de lib/guia.ts" — o guia ganhou `/mais/lembretes` e a
tabela de títulos do próprio teste não tinha a rota. Corrigido em `d1cf096`
(a rota entra na tabela com o título "Lembretes"; o teste "Ir para
/mais/lembretes" abre a tela e acha o `<h1>`). Com o anel interno
(`bec0df8`), build:e2e local e os e2e afetados (`r18/l34/local/com-correcao.log`:
o spec do lote, o guia e Mais) — **27 de 27**.

Cadeia inteira em `ade3e6a` (o HEAD que foi à auditoria;
`r18/l34/logs/ade3e6a.log`, das 18:39:51 às 19:06:42 UTC, **ok**): `lint`
limpo · `tsc --noEmit` limpo · `npm test` **71 arquivos, 1.609 testes** ·
`build` ("Compiled successfully in 18.3s") · `build:e2e` ("Compiled
successfully in 18.1s") · `e2e` **533 passaram, 5 pulados** (20,6 min; os 5
pulados são a varredura, que roda à parte) · `varredura` **5 passaram**
(4,3 min). Uma cadeia começada em `857b888` foi interrompida por mim no `npm
test` para entrar o ajuste da SPEC antes (`857b888.log` diz isso no fim).

**Correção da auditoria.** Rodada local em `5ca73a7` (todo o código da
correção; `r18/l34/local2/5ca73a7.log`, 19:29–19:35 UTC, **ok**):
`build:e2e` ("Compiled successfully in 9.5s") · e2e do lote
(`ultraloop-l34`) **20 passaram** (42,8 s) · `varredura` **5 passaram**
(4,6 min, já com `/mais/lembretes` nas rotas) · `npm test` **71 arquivos,
1.613 testes** (+4 em `lib/lembretes.test.ts`).

Cadeia inteira em `65804cf` (todo o código da correção + o rascunho deste
registro; `r18/l34/logs/65804cf.log`, das 19:35:49 às 20:00:10 UTC,
**falhou:e2e** por um teste instável fora do lote): `lint` limpo · `tsc
--noEmit` limpo · `npm test` **71 arquivos, 1.613 testes** · `build`
("Compiled successfully in 18.3s") · `build:e2e` ("Compiled successfully in
18.5s") · `e2e` **540 passaram, 1 falhou, 5 pulados** (22,4 min; 541 executados = os 533 de
`ade3e6a` + 8 do spec do lote, que foi de 12 a 20 testes). A falha: `e2e/player.spec.ts:164` ("ao zerar, 'avançar sozinho'
passa ao próximo passo…"), que não toca em lembretes — o trace mostra
"Loading chunk 2636 failed" com `net::ERR_ABORTED` no **terceiro** pedido do
mesmo chunk ao navegar para `/mais/preferencias` com o relógio instalado
(`clock.install`); os dois pedidos anteriores do chunk deram 200. Sozinho,
**2 de 2 verdes** (4,2 s e 4,3 s; `r18/l34/player-sozinho-{a,b}/65804cf.log`):
instável sob carga, anotado, não bloqueia. A `varredura` não rodou nessa
cadeia (ela para no primeiro portão que falha); rodou verde na local acima e
roda na cadeia do HEAD final, `r18/l34/logs/<HEAD>.log`, que difere de
`65804cf` só neste PROGRESSO.md.

#### Capturas

`capturas.sh` com o `.next` do build:e2e da cadeia de `65804cf` (o código de
app da correção), contra a base real de `main` (`base-ef3ad97`), com a tela
declarada `18-mais` (`r18/l34/capturas-65804cf.md`): 60 PNGs, só `18-mais`
mudou; as outras 58 com Δ 0,00 %. Os 60 PNGs são **iguais byte a byte** aos
de `capturas-ade3e6a` (a correção não muda nenhuma das 60 telas). Diff
aberto: `18-mais-claro.diff.png`.

| tela | Δ claro | Δ escuro | o que mudou |
| --- | ---: | ---: | --- |
| 18-mais | 13,29 % | 13,27 % | a linha nova "Lembretes — Receber avisos no celular; ative em cada aparelho." (sino) entre Preferências e Créditos; Créditos, Backup e o cartão de sincronização descem uma linha (~81 px). Nada acima de Preferências muda. |

`/mais/lembretes` não está nas 60 capturas: medida pelos e2e do lote (todos
os estados nos dois temas desde a correção) e **ao vivo** no HEAD da
correção (`r18/l34/correcao-ao-vivo/`: mock novo + `next start` do `.next`
de `65804cf`, par VAPID gerado na hora, Chromium a 360×740, os dois temas,
pelo caminho Mais → Lembretes; script da auditoria de tela com o `user_id`
no insert semeado): **73 medidas, 0 falhas** — ativar grava a linha no mock
que agora recusa insert sem `user_id` ("Chrome · Linux", chaves do
aparelho), recarregar mantém, teste "Enviado para 1 aparelho.", desativar e
Remover zeram a tabela; bloqueado → instrução de permissão; Brave → só a do
Brave; sem suporte e iPhone → as deles; **o Chromium real sem serviço de
push (o caso que a auditoria viu só com a frase) mostra "Para tentar de
novo" nos dois temas**; o worker real mostra o push e leva a aba a
`/mais/lembretes`; url `//evil.example/a` → `/`; `scrollWidth` 360/360 em
todas, nenhum alvo < 44 px, contraste mínimo 4,58:1 (claro) e 5,85:1
(escuro); `POST /api/lembretes/teste` sem sessão → 401 JSON. Servidores
derrubados pelos PIDs (portas 3100 e 54321 → 000).

#### Como testar no celular (360 px)

Antes: o orquestrador aplica `supabase/migracoes/2026-09-23-lembretes-inscricoes.sql`
no projeto e cria na Vercel (production) `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY` (Sensitive) e `VAPID_SUBJECT`. Um par se gera, por
exemplo, com `node -e "const c=require('crypto').createECDH('prime256v1');c.generateKeys();console.log(c.getPublicKey('base64url'),c.getPrivateKey('base64url'))"`.

1. Mais → **Lembretes** (entre Preferências e Créditos). Sem as variáveis, a
   tela diz "Lembretes ainda não configurados neste servidor." e mais nada.
2. **Brave no Android** (o aparelho do dono): toque em "Ativar lembretes
   neste aparelho" → Permitir. Se o Brave estiver com o push desligado, a
   tela mostra "No Brave, os avisos só chegam com os serviços do Google
   ligados": Configurações do Brave → Privacidade e segurança → ligar "Usar
   os serviços do Google para mensagens push" → fechar e abrir o Brave →
   Ativar de novo. Deu certo: "Ativado neste aparelho." e o aparelho aparece
   em "Aparelhos desta conta" como "Brave · Android (este)".
3. "Enviar um lembrete de teste" → "Enviado para 1 aparelho." e, no celular,
   a notificação "Lembrete de teste — Se você está vendo isto, os lembretes
   chegam neste aparelho." Toque nela: o app abre em Mais → Lembretes.
   Mandar de novo não empilha (a mesma tag troca a anterior).
4. Se o navegador não conseguir ativar (Chrome, ou a pergunta da permissão
   fechada sem escolher), a tela diz o que houve e mostra "Para tentar de
   novo" — nunca só a frase.
5. Negou a permissão sem querer: a tela diz "Bloqueado pelo navegador." com
   o caminho (cadeado → Permissões → Notificações → Permitir; ou
   Configurações do Android → Apps → Treino do Terraço → Notificações).
   Libere por lá e **volte ao app sem recarregar**: a tela confere de novo
   sozinha e passa a "Desativado neste aparelho." com o botão "Ativar
   lembretes neste aparelho"; a frase "O navegador recusou…" e a instrução
   somem.
6. iPhone: no Safari a tela explica que é preciso instalar (Compartilhar →
   Adicionar à Tela de Início) e ativar pelo ícone (iOS 16.4+). Com o app
   instalado e a permissão negada, o caminho é o do iPhone (Ajustes →
   Notificações → Treino do Terraço → "Permitir Notificações"), sem o
   cadeado nem o Android e sem o conselho do Brave.
7. "Desativar neste aparelho" some com o aparelho da lista; "Remover" tira
   outro aparelho da conta. Os horários dos lembretes são o próximo lote
   (L35).

#### Rodada 17 — auditoria 2 reprovou; lote devolvido à fila

A 2ª auditoria, em `96c2b5e` (cadeia verde: 1.613 unitários, 541 e2e + 5
pulados, varredura 5/5; capturas: só `18-mais`), reprovou com **1
importante em cada lente** e nenhum bloqueante
(`r18/l34/vereditos-auditoria-2.json`):

- **regra** — `instrucoesDoAparelho()` e a SPEC §23.6 divergiam em 4 das 80
  combinações (Brave + navegador sem suporte); no iPhone, a tela mandava
  ligar uma opção do Brave que só existe no Android e no computador;
- **tela** — a tela não relia a permissão ao voltar das configurações: ficava
  em "Bloqueado pelo navegador.", sem o botão Ativar, com a instrução
  mandando tocar nele (medido nos dois temas, com e sem Brave).

Menores: a frase da recusa abaixo da dobra com Brave + recusa (duas
instruções); o `aria-label` do Remover sem o nome da lista; "sem
configuração" e "sem tabela" sem e2e na montagem; o PROGRESSO citava 29
testes em `lib/lembretes.test.ts` (eram 33). **Lote devolvido à fila.**

#### Rodada 18 — retomada (correção da auditoria 2)

Sobre `96c2b5e`, logs em `r19/l34/`. SPEC antes do código (`30ff9fc`).

- **Importante (regra) — a tabela é o oráculo.** Era: o Brave entrava em
  "sem suporte" e no iPhone; a SPEC dizia outra coisa em 4 combinações. É:
  a SPEC §23.6 tem a **tabela das 80 combinações** (estado × Brave × iPhone
  × instalado × falhou, 15 linhas com "·" = qualquer) e decide pelo que
  existe no aparelho — o ajuste do Brave só **fora do iPhone** e só com
  falha ao ativar ou permissão negada (ligar os serviços do Google não cria
  o `PushManager` que falta); no iPhone com a permissão negada entra a
  instrução nova `permissao-iphone` (Ajustes → Notificações → Treino do
  Terraço → "Permitir Notificações"), porque o cadeado e as Configurações do
  Android não existem lá; "sem suporte" no iPhone instalado (iOS antigo)
  cita o iOS 16.4. `lib/lembretes.test.ts` **lê a tabela do SPEC.md**,
  confere que cada combinação cai em exatamente uma linha e que o código
  devolve as mesmas instruções na mesma ordem (`b2aa2b6`). Mutação: com a
  regra antiga do Brave, o oráculo acusa **14 divergências** e cai.
- **Importante (tela) — a volta das configurações.** Era: `carregar()` só
  no mount. É: a tela relê permissão e inscrição em `visibilitychange`
  (visível), `focus`, `pageshow` e no `change` de
  `navigator.permissions.query({name: "notifications"})` quando existe; se
  a permissão mudou desde a última leitura, a frase e a falha antigas saem;
  não relê no meio de um Ativar/Desativar/Remover/teste (o pedido de
  permissão também tira e devolve o foco) — `d14f3e0`. O passo final das
  instruções de permissão diz "Volte aqui: a tela confere de novo e mostra
  “Ativar lembretes neste aparelho”". e2e (`51a099f`, `134efd0`), nos dois
  temas: a permissão **negada de verdade** no Chromium (CDP
  `Browser.setPermission`; o Playwright só sabe conceder) → "Bloqueado",
  instrução, sem Ativar → o contexto do Playwright concede → 400 ms sem
  mudar (não há leitura periódica) → `visibilitychange` (hidden → visible) →
  "Desativado", o Ativar aparece, as instruções somem, e o Ativar grava a
  linha; com a `navigator.permissions` desligada, para provar o caminho do
  `visibilitychange` sozinho. Mais: a recusa ao pedir some na volta (dois
  temas) e o `change` da permissão relê sem nenhuma volta (1 teste).
  Mutação: sem o ouvinte de `visibilitychange`, **3 de 3** testes da volta
  caem (`r19/l34/mutacao/volta.out`).
- **Menores atendidos.** A frase de ativar/desativar fica **no bloco "Este
  aparelho", abaixo do estado (e do botão Ativar/Desativar, quando há
  botão) e acima das instruções** — texto corrigido na rodada 19; e2e com Brave +
  recusa (duas instruções, `brave` e `permissao`) nos dois temas: a frase
  acima da primeira instrução, inteira acima da barra de abas, `scrollY` 0.
  O `aria-label` do Remover usa o nome da lista ("Remover Aparelho sem nome
  (desde dd/mm)"), conferido no e2e. "Sem tabela" na montagem: e2e com o
  PostgREST respondendo `PGRST205` (`page.route`), nos dois temas. "Sem
  configuração" na montagem: e2e com um **segundo `next start`** do mesmo
  build, sem as variáveis VAPID, numa porta livre, subido e derrubado pelo
  próprio spec (grupo do processo) — a tela diz "Lembretes ainda não
  configurados neste servidor.", sem botão, e `POST /api/lembretes/teste`
  responde **503** com o mesmo texto, nos dois temas. Os números de testes
  deste registro saem do `vitest --reporter=json` do HEAD (abaixo).
- **Prova da assinatura VAPID** (`lib/web-push-prova.test.ts`, `3cff8dc`,
  só WebCrypto): o JWT tem `alg: ES256`/`typ: JWT`, `aud` = origem do
  endpoint, `exp` ≤ 24 h e `sub` = `VAPID_SUBJECT`; a assinatura tem **64
  bytes (r‖s)** e confere em `crypto.subtle.verify` (ECDSA P-256/SHA-256)
  com a pública importada em formato raw; `Authorization: vapid t=…, k=…`
  com `k` = a pública (65 bytes, `0x04`); `Content-Encoding: aes128gcm`,
  `TTL`, `Urgency` e `Topic`; e o corpo **decifra** com a chave privada do
  assinante por uma implementação da RFC 8291 escrita no teste (HKDF, ECDH e
  AES-GCM do WebCrypto), a mesma que decifra o exemplo do Apêndice A; outra
  chave não decifra. Mutação: `dsaEncoding: "der"` em `lib/web-push.ts` →
  a prova cai ("expected … to have a length of 64 but got 71",
  `r19/l34/mutacao/der.out`). A biblioteca `web-push` segue fora (SPEC
  §23.5).

**Portões da rodada 18.** Cadeia inteira em `4192cd5` (todo o código da
correção + o rascunho deste registro; `r19/l34/logs/4192cd5.log`, das
21:05:22 às 21:33:40 UTC, **ok**): `lint` limpo · `tsc --noEmit` limpo ·
`npm test` **72 arquivos, 1.621 testes, todos verdes** (eram 71 / 1.613 em
`96c2b5e`: +1 arquivo `lib/web-push-prova.test.ts` com 5, +3 em
`lib/lembretes.test.ts`; o `vitest --reporter=json` do mesmo HEAD dá os
mesmos 1.621 — lembretes 36, web-push 7, web-push-prova 5,
migracao-lembretes 17, middleware 9, auditoria-seguranca 32,
`r19/l34/vitest-4192cd5.json`) · `build` ("Compiled successfully in
18.7s") · `build:e2e` ("Compiled successfully in 19.3s") · `e2e` **552
passaram, 5 pulados** (21,3 min; os 541 de `96c2b5e` + os 11 novos do spec
do lote, que tem 31 testes, todos ✓; nenhum ✘, nenhum instável) ·
`varredura` **5 passaram** (4,7 min, com `/mais/lembretes`). Antes da
cadeia, rodada local do spec do lote em `51a099f`
(`r19/l34/local/l34.log`): 28 de 31 — os 3 que negam a permissão falhavam
porque a sessão CDP se desligava e o Chromium desfazia a negação; com a
sessão aberta até o fim do teste (`134efd0`), **7 de 7** nos testes novos
(`r19/l34/local/l34-b.log`). Este PROGRESSO.md é o único arquivo que muda
depois de `4192cd5`.

**Capturas da rodada 18.** `capturas.sh` com o `.next` do build:e2e da
cadeia de `4192cd5`, contra a base real de `main` (`base-ef3ad97`), tela
declarada `18-mais` (`r19/l34/capturas-4192cd5.md`): 60 PNGs, só `18-mais`
mudou; as outras 58 com Δ 0,00 % ("Nenhuma tela mudou fora do esperado").
Os 60 PNGs são **iguais byte a byte** aos de `capturas-96c2b5e` — a correção
mexe só em `/mais/lembretes`, que não está nas 60. Diff aberto
(`18-mais-escuro.diff.png`): a linha "Lembretes" entre Preferências e
Créditos; Créditos, Backup e o cartão de sincronização descem uma linha;
nada acima de Preferências muda. Servidores derrubados pelo script (3100 e
54321 → 000).

| tela | Δ claro | Δ escuro | o que mudou |
| --- | ---: | ---: | --- |
| 18-mais | 13,29 % | 13,27 % | a linha nova "Lembretes" (a mesma de `96c2b5e`); nada mais |

**Como testar a correção no celular (360 px).** (a) Brave no Android: negue
a permissão ao tocar em Ativar → a frase "O navegador recusou as
notificações deste app." aparece logo abaixo do estado, **acima** das duas
instruções (Brave e permissão), sem rolar. (b) Libere pelo cadeado ou pelas
Configurações do Android → Apps → Treino do Terraço → Notificações e volte ao
app **sem recarregar** → "Desativado neste aparelho.", o botão "Ativar
lembretes neste aparelho" aparece e as instruções somem. (c) iPhone com o
app instalado e a permissão negada → só "O iPhone está bloqueando as
notificações deste app" (Ajustes → Notificações → Treino do Terraço), sem o
conselho do Brave. (d) Com o leitor de tela, o Remover de um aparelho sem
nome diz "Remover Aparelho sem nome (desde dd/mm)".

#### Rodada 19 — Correção da auditoria (1ª auditoria da rodada 18 em `8b54cf1`: regra reprovada, tela aprovada)

Vereditos em `r19/l34/auditoria-1-{regra,tela}/veredito.json`: regra
reprovada por **1 importante** (nenhum bloqueante), tela aprovada; 5 + 3
menores. Sobre `8b54cf1`, logs em `r19/l34/`. SPEC antes do código
(`6d4e759`).

- **Importante (regra) — `urlInterna()` devolvia `//outro.host`.** Era: a
  conferência rodava só sobre a **entrada** (prefixo `/`, sem `//` nem `/\`,
  e a URL resolvida contra `https://app.invalid` na mesma origem); o parser
  desfaz `.`, `..` e `%2e` depois, e a função devolvia o `pathname`
  normalizado sem conferir: `"/.//mal.example/x"` → `"//mal.example/x"`,
  `"/..//mal.example"`, `"/a/..//mal.example"`, `"/%2e//mal.example"`,
  `"/./\mal.example"` e `"\t/.//mal.example"` → `"//mal.example"`, e não era
  idempotente (1.014 saídas ruins em 43.904 entradas na varredura da
  auditoria). O `notificationclick` reaplicava a função e caía em `/`, então
  não havia exploração, mas o contrato da SPEC §23.3 falhava. É: a **saída**
  também é conferida — um caminho devolvido que começa com `//` vira `/`
  (`lib/lembretes.ts`, `ef9c163`); o caminho normalizado não tem TAB, LF, CR
  nem `\`, então basta isso. Vitest novo em `lib/lembretes.test.ts`: 11
  entradas com pontos antes da barra dupla (inclusive `%2E%2E`, `/..\/` e TAB
  no meio) → `/`, também em `opcoesDaNotificacao().opcoes.data.url`; uma
  **varredura** de 30 pedaços hostis combinados 3 a 3, com e sem sufixo
  (54.000 entradas), em que toda saída começa com `/`, não com `//` nem
  `/\`, fica na origem ao ser resolvida e é **idempotente**; e a
  idempotência dos caminhos que valem. Mutação: sem a conferência da saída,
  2 dos testes novos caem. A varredura da própria auditoria (`url2.ts`)
  contra o código novo: **43.904 entradas, 0 ruins**; `url-prova.ts`: as 6
  entradas → `/`, idempotente (`r19/l34/local/url2-ef9c163.out`,
  `url-prova-ef9c163.out`).
- **Menores (regra), todos atendidos.**
  - SPEC §23.4 e este PROGRESSO diziam "logo abaixo do estado"; com botão, a
    ordem é estado → botão → frase → instruções. Texto corrigido para
    "abaixo do estado (e do botão, quando há botão), acima das instruções"
    (SPEC, comentário do componente e rodada 18 acima). O aceite medido (a
    frase acima das instruções, na primeira dobra) não muda.
  - A frase velha "o mock não sabe esconder uma tabela" (rodada 17) foi
    atualizada; o 503 `SEM_TABELA` da **rota** ganhou prova:
    `lib/rota-lembretes-teste.test.ts` (8 testes, `d0910ea`), com o cliente
    do Supabase do servidor trocado — 503 `SEM_CONFIGURACAO` sem as
    variáveis e com o par errado (sem abrir o banco), 401 sem sessão (sem
    ler a tabela), 503 `SEM_TABELA` com `PGRST205` e com `42P01` (sem
    nenhum `fetch`), 502 com outro erro, 409 sem aparelho, e um endpoint
    fora dos serviços de push não é chamado e conta como não enviado.
    Mutação: sem o ramo `SEM_TABELA` na rota, os 2 testes do 503 caem.
  - SPEC §23.4 sem teste para `focus`, `pageshow`, a guarda do
    `emAndamento` e a volta sem internet. e2e novos (`398dc23`): a volta
    por `focus` e por `pageshow`, **cada um sozinho** (a permissão negada de
    verdade, concedida, 400 ms sem mudar, o evento → Desativado com Ativar e
    sem instruções); um **Ativar demorado** (`subscribe` de 2 s) com
    `visibilitychange`, `focus` e `pageshow` disparados no meio: nenhuma
    leitura da tabela antes do `DELETE`/`POST` da gravação; e a **volta sem
    internet**. Esta última mostrou um defeito, corrigido (`2e5f6c2`): era,
    uma volta com a leitura da lista falhando trocava a frase do aparelho
    ("O navegador recusou…") por "Não deu para ler os aparelhos agora.", e
    esse aviso ficava mesmo depois de uma leitura boa; é, a frase do
    aparelho fica (o aviso da lista só entra onde não há frase) e o aviso
    sai na próxima leitura que der certo. O "sem internet" é no `fetch` da
    página (a página é do service worker: nem `context.setOffline` nem
    `page.route` alcançam o que passa por ele), e o teste espera as **4
    tentativas** do postgrest-js (1 s, 2 s e 4 s de espera) antes de olhar a
    tela. Mutações (build:e2e de cada uma, `r19/l34/local/mut-a.log` e
    `mut-b.log`): sem manter a frase, sem limpar o aviso, sem o ouvinte de
    `pageshow` e sem a guarda → **4 de 4** caem (a guarda:
    "GET GET DELETE POST GET"); sem o ouvinte de `focus` → o teste do `focus` cai (1 de 1).
  - A prosa do `brave` (§23.6) falava em "a inscrição falhou ou a permissão
    está negada", e o Brave com a pergunta dispensada cai em `brave` sem
    nenhuma das duas. A prosa agora diz "o Ativar falhou — a inscrição
    falhou ou a pergunta da permissão foi dispensada sem escolher — ou a
    permissão está negada"; a tabela e o código já concordavam.
  - Pendências antigas, sem mudança: o `notificationclick` sem aba aberta
    (`clients.openWindow`), a RLS no Postgres real (prova estática e no
    mock) e o badge monocromático (L35).
- **Menores (tela).**
  - **Bloqueado → liberado com o aparelho ativado** volta direto a
    "Ativado neste aparelho" quando o navegador manteve a inscrição, e o
    passo 3 promete o Ativar. É melhor que o prometido e o Chrome costuma
    cancelar a inscrição ao bloquear; a SPEC §23.4 agora descreve os dois
    caminhos. O texto do passo não mudou (fica para o L35, que mexe na tela).
  - **iPhone fora da tela inicial com a permissão negada** dava
    `[permissao-iphone, iphone]`, mandando abrir os Ajustes antes de
    instalar. É `[iphone, permissao-iphone]`: instalar primeiro, porque a
    entrada "Treino do Terraço" nos Ajustes só existe com o app instalado
    (tabela da §23.6, prosa e `instrucoesDoAparelho()`, `ef9c163`; o
    oráculo das 80 combinações continua 0 divergências, e um caso explícito
    no Vitest).
  - `clients.openWindow` sem aba aberta: pendência antiga, sem medida.

**Portões da rodada 19.** Cadeia inteira em `e13a8ec` (todo o código da
correção + o rascunho deste registro; `r19/l34/logs/e13a8ec.log`, das
22:02:46 às 22:30:14 UTC, **ok**): `lint` limpo · `tsc --noEmit` limpo ·
`npm test` **73 arquivos, 1.632 testes, todos verdes** (eram 72 / 1.621 em
`4192cd5`: +1 arquivo `lib/rota-lembretes-teste.test.ts` com 8, +3 em
`lib/lembretes.test.ts`, que passa a 39) · `build` ("Compiled successfully
in 18.8s") · `build:e2e` ("Compiled successfully in 18.7s") · `e2e` **557
passaram, 5 pulados** (20,9 min; os 552 de `4192cd5` + os 5 novos; o spec
do lote tem 36 testes, todos ✓; nenhum ✘, nenhum instável, nenhuma nova
tentativa) · `varredura` **5 passaram** (4,6 min). Antes da cadeia, rodadas
locais do spec do lote (`r19/l34/local/`): `r19-a` 34 de 36 — os 2 da volta
sem internet usavam `page.route`, que não alcança o que passa pelo service
worker; reescritos no `fetch` da página, `r19-b` mostrou as 4 tentativas do
postgrest-js (~7 s) e `r19-c` deu **2 de 2**. `diff 27eda74 --
lib/progressao.ts lib/montagem.ts` vazio. Este PROGRESSO.md é o único
arquivo que muda depois de `e13a8ec`.

**Capturas da rodada 19.** `capturas.sh` com o `.next` do build:e2e da
cadeia de `e13a8ec`, contra a base real de `main` (`base-ef3ad97`), tela
declarada `18-mais` (`r19/l34/capturas-e13a8ec.md`): 60 PNGs, só `18-mais`
mudou; as outras 58 com Δ 0,00 % ("Nenhuma tela mudou fora do esperado").
Os 60 PNGs são **iguais byte a byte** aos de `capturas-4192cd5` (`cmp`, 0
diferentes): a correção mexe só em `/mais/lembretes` (que não está nas 60 e
é coberta pelo e2e) e na lib. Diff aberto (`18-mais-claro.diff.png`): de
"Como usar o app" a "Preferências" igual; em vermelho, a 5ª linha passa a
ser "Lembretes" (sino) e Créditos, Backup e o cartão "CONTA / Tudo
sincronizado" descem uma linha; a barra de abas não muda. Aberta também
`18-mais-escuro.png`: "Lembretes" entre Preferências e Créditos. Servidores
derrubados pelo script (3100 e 54321 → 000).

| tela | Δ claro | Δ escuro | o que mudou |
| --- | ---: | ---: | --- |
| 18-mais | 13,29 % | 13,27 % | a linha nova "Lembretes" (a mesma de `4192cd5`); nada mais |

**Como testar a correção no celular (360 px).** (a) Brave no Android:
toque em Ativar e negue → "O navegador recusou…" logo abaixo do estado;
ligue o modo avião, saia do app e volte → a frase continua (não vira "Não
deu para ler os aparelhos agora."). (b) Sem frase na tela, modo avião,
saia e volte → depois de uns 7 s aparece "Não deu para ler os aparelhos
agora."; desligue o modo avião, saia e volte → o aviso some. (c) Toque em
Ativar e, enquanto o navegador pergunta, troque de app e volte → a tela
termina em "Ativado neste aparelho." com uma linha só na lista. (d) iPhone
fora da tela inicial com as notificações negadas: a primeira instrução é
instalar (Adicionar à Tela de Início), a segunda os Ajustes.

#### Auditoria

- **Auditoria 1 em `8b54cf19053d1b3cb7cf0084dc54e50f69bd7901`: reprovada**
  (bloqueantes 0, importantes 1, menores 8). O importante (lente de regra):
  `urlInterna()` devolvia `//host` quando a entrada tinha segmentos de ponto
  antes da barra dupla (`/.//mal.example` → `//mal.example`); o service
  worker reaplicava a função e neutralizava, mas a saída não era conferida.
  Corrigido na rodada 19 (acima): a saída é conferida e a função é
  idempotente (`ef9c163`), com Vitest dos pontos e varredura.
- **Auditoria 2 em `96056ac0a30c7a865ce0e909241ca42b09ebefb9`: aprovada**
  (bloqueantes 0, importantes 0, menores 10). Pré-condições conferidas nas
  duas lentes (`96056ac.status` ok, 1.632 unitários, 557 e2e + 5 pulados,
  varredura 5/5, motor sem diff, árvore limpa). A lente de regra varreu
  924.776 entradas de url (0 ruins), conferiu a tabela 80/80 e os estados
  24/24 e matou 10 de 10 mutantes; a lente de tela mediu fluxo, estados,
  sem internet, caminho reverso, volta, guia, sem tabela e sem VAPID nos
  dois temas e rodou o e2e do lote (36 passed). Vereditos em
  `r19/l34/auditoria-2-regra/` e `r19/l34/auditoria-2-tela/`.

Menores registrados (ficam na fila, nenhum quebra o aceite):

- **[regra]** SPEC §23.7 item 7 é ambíguo sobre os temas: os e2e da volta
  por focus/pageshow e da volta sem internet rodam só num tema.
- **[regra]** PROGRESSO rodada 19 diz "um build:e2e por mutação"; o
  `mut-a.log` mostra outra organização (conferir a frase).
- **[regra]** SPEC §23.4 não diz o que acontece quando a volta encontra a
  permissão mudada E a leitura sem internet ao mesmo tempo.
- **[regra]** Borda antiga: no `ativar()`, se a gravação dá certo e a
  releitura (`carregar()`, linha 318) falha, a lista não é atualizada.
- **[regra]** `lib/rota-lembretes-teste.test.ts:41`: o comentário diz "um par
  qualquer", mas PRIVADA é a chave de exemplo da RFC 8291 (texto do
  comentário).
- **[regra]** Pendências antigas: notificationclick sem aba aberta sem
  medida; RLS no Postgres real só com prova estática.
- **[tela]** §23.7 item 7: sem frase do aparelho, o aviso da lista só sai na
  próxima leitura (evento), não sozinho quando a internet volta.
- **[tela]** Aceite 7 fala em e2e "nos dois temas"; os testes `:722`, `:781`
  e `:804` rodam só no claro.
- **[tela]** Caminho ativado → bloqueado → liberado volta direto a "Ativado
  neste aparelho."; o passo 3 das instruções promete "Ativar lembretes neste
  aparelho" (L35).
- **[tela]** notificationclick sem nenhuma aba: medida parcial com
  `about:blank` — o worker real chamou `clients.openWindow` com a URL
  interna.

**Deploy (rodada 18, 23/09 23:34 UTC).** Publicado. O deployment passou de
`dpl_HWcojHVZg4mN4AKYqv92Ha3q3kK9` para `dpl_5Mf1KbpBMicAu5TRhz4y6s9UopPJ`, e
`main` passou de `27eda74` para `905815d6a8a25ef546d256ad228f8e1982eeb15f`
(PR #25). O merge do lote na integração é `b275aa0`, sem conflito (a
integração estava igual a `origin/main` `27eda74`), e o código ficou idêntico
a `96056ac`. O veredito da auditoria está em `52168c3`. `/versao` devolveu esse sha
às 23:34:10, ~3 min depois do merge (build de 23:32:47Z). O CSS de `/login`
mudou de `e0156b4c4cac1bd9` para `0d00d758a656b055`. Portão final na
integração: `lint` e `tsc --noEmit` limpos, 73 arquivos e 1.632 testes
verdes. O e2e não foi repetido (557 e2e, 5 pulados, varredura 5/5 em
`96056ac`). Migração `2026_09_23_lembretes_inscricoes` aplicada pelo
orquestrador às 23:25 UTC, antes do merge: RLS ligada, 3 policies, anon sem
grant e advisors sem achado novo.

Fumaça em produção, item a item: `/login` 200 · com "Treino do Terraço" ·
com "Entrar" · sem "Configure NEXT_PUBLIC_SUPABASE_URL" · sem "é secreta" ·
`/` → 307 · para `/login` · `/versao` == sha do merge · `/sw.js` 200 · com
`/~offline` · com `figuras/` · com o mesmo CSS do HTML de `/login` ·
`/manifest.webmanifest` 200 · com "Treino do Terraço" · `/~offline` 200 ·
os 14 scripts `/_next/static` de `/login` 200 · `/sw.js` com
"notificationclick" · com "showNotification" · o chunk
`app/(app)/mais/lembretes/page-a4782e08023821d6.js` listado no `/sw.js` · com
"Ativar lembretes" · com "Enviar um lembrete de teste". Três execuções
(23:35, 23:36 e 23:37 UTC, ≥ 40 s entre elas), **21 de 21** em cada uma.
Sonda a 360×740 (Chromium): `/login` e `/~offline` sem erro de console e sem
vazamento horizontal (scrollWidth 360 = clientWidth). Capturas: 18-mais
(claro e escuro) de `r19/l34/capturas-e13a8ec` viraram a base visual
(`base-ef3ad97`, `indice.json` com head `905815d`; wt-base não avançado).
Não conferido daqui: se as variáveis VAPID existem na Vercel (produção). A
tela exige login, e o conector da Vercel recebeu 403 nas variáveis. Sem elas,
a tela diz "Lembretes ainda não configurados neste servidor." e a rota
devolve 503. **Rollback: não.**

**Verificação logada em produção (23/09, 23:44–23:58 UTC).** Conta de teste
`teste-l34-20260924@example.com` criada pela tela "Criar conta", navegador
real a 360×740 nos dois temas, `/versao` = `905815d`. Mais mostra "Lembretes"
(sino) entre Preferências e Créditos; o toque abre `/mais/lembretes` com h1
"Lembretes" e "‹ Mais" (73,8×44 px). As variáveis VAPID ainda não existem
na Vercel, então a tela mostra só "Lembretes ainda não configurados neste
servidor.", sem botão e sem consultar o banco. SELECT real em
`lembretes_inscricoes` com o token da sessão: 200 com `[]` (a tabela existe e
a RLS responde); só com a chave anon: 401 `42501 permission denied` (o anon
não tem grant). `POST /api/lembretes/teste` sem sessão: 401 JSON "Entre de
novo para continuar.", sem 500. `/sw.js` com `notificationclick` e
`showNotification`. Passe pelas abas Treino, Calendário, Explorar, Relatório,
Corpo e Mais: 0 rolagem lateral, 0 alvo < 44 px, 0 erro de console, 0
resposta ≥ 400, nos dois temas. Uma primeira tentativa do tema claro foi
descartada por falha do script de medida (o guia da primeira entrada abriu
depois da espera) e refeita inteira. **Conta de teste apagada** às 00:00 UTC
(ficam só as 3 contas reais).

### Rodada 21 — Lote 32 — Sobras das auditorias: ficha e coleções do Explorar

Faixa A, worktree `wt-a`, branch `polimento/l32-ficha-sobras` a partir de
`main` f813c41 (L34 publicado). SPEC §22.15 escrita e commitada antes do
código (`320ad47`). Dez sobras da seção C da fila, das auditorias e da
verificação em produção do L13 e do L14; os quatro itens de coleções do
Explorar entram pela exceção de área do plano (os mesmos arquivos do L13).
`git diff f813c41 -- lib/progressao.ts lib/montagem.ts` vazio.

#### O que mudou

1. **A figura nasce de novo também no "Substituir"**
   (C-l13-key-musculos-sem-teste). Era: o ledger pedia teste para a `key` da
   ilustração da aba Músculos, que **não existe mais** — o §22.14 item 3(a)
   tirou a ilustração dessa aba (grep de `urls.join` em `ficha-folha.tsx`:
   nada); a `key` que sobra, a da aba Vídeo em `media-grande.tsx`, só tinha
   e2e pela seta ›. É: e2e do "Substituir" com a figura do agachamento livre
   na posição 2 (o afundo começa na 1, o quadro 2 dele espera o 1) e da aba
   Músculos aberta atravessando › e "Substituir". Arquivos:
   `e2e/ultraloop-l32.spec.ts`. Código de app: nenhum.
2. **A figura quebrada não passa para o próximo exercício**
   (C-media-grande-figura-quebrou-herdada). Era: `figuraQuebrou` booleano na
   `MediaGrande`; com a figura de A abortada, › ou "Substituir" levavam à
   foto de B sem tentar a figura dele. É: a mídia guarda **qual** figura
   falhou (o endereço) e só cai na foto quando é a figura desenhada agora.
   Arquivo: `components/exercicio/media-grande.tsx`.
3. **"Execução: <nome>", sem artigo** (C-alt-execucao-genero). Era:
   "Execução do Prancha", "do Remada", "do Rosca", em dois lugares escritos à
   mão. É: `altDaExecucao()` em `lib/midia.ts`, usada por `midiaGrande()`
   (ilustração, figura, vídeo) e pela `FiguraExercicio`; a figura-botão do
   player vira "Execução: Agachamento livre — abre o Como fazer". Arquivos:
   `lib/midia.ts`, `components/exercicio/midia.tsx`; os e2e que liam o texto
   velho (`catalogo`, `player`, `treinar`, `ultraloop-l13`) passam ao novo.
4. **O aceite da ordem dos quadros** (C-l13-aceite-lcp-vs-ordem). Já
   cumprido antes do lote: o §22.13 item 4 mede a ordem dos pedidos, o mesmo
   que `e2e/ultraloop-l13.spec.ts` mede, e "LCP" não aparece no §22.13 (grep).
   O "LCP" era do texto original da fila. É: o §22.15 item 4 registra isso;
   nenhum código.
5. **Na busca, sem vão onde não há subtítulo** (C-busca-linha-reservada-vazia).
   Era: a linha reservada de 16 px entre o título e o motivo nas linhas sem
   subtítulo (busca "corda"). É: `LinhaColecao` com `reservarSubtitulo`
   (padrão `true`, a vitrine); a lista da busca passa `false`; o circuito
   sem subtítulo continua com a linha do selo. Arquivos:
   `components/colecoes/linha-colecao.tsx`, `components/explorar/tela-explorar.tsx`.
6. **Na busca, a coleção leva a capa da vitrine** (C-busca-corda-capa-icone).
   Era: a busca passava a lista inteira por `semCapasRepetidas()`, e "Corda:
   5 estágios" tinha o ícone na busca "corda" e a foto na seção Planos (144
   de 484 linhas de resultado com capa diferente da vitrine, nos 122 termos
   de 4 letras ou mais). É: `secoesDaVitrine()` (a tela desenha estas),
   `capasDaVitrine()` e `capasNaBusca()` em `lib/colecoes.ts`: cada coleção
   parte da capa da vitrine e só a perde se uma linha de cima do mesmo
   resultado já a mostra (66 de 484; planos de 4 para 2). Arquivos:
   `lib/colecoes.ts`, `components/explorar/tela-explorar.tsx`.
7. **A posição no plano aparece uma vez** (C-plano-progresso-repete-desafio).
   Era: com perfil, a capa dizia "semana 3 de 12" e o bloco logo abaixo
   "Semana 3 de 12 · 2 concluídas". É: a capa diz o que o plano é (a meta sem
   perfil, `detalheDaCapa()` em `lib/colecoes.ts`); a posição fica no bloco,
   com a barra e o "agora". Decisão tomada sem o dono (o ledger oferecia
   tirar a capa ou o bloco; nenhum dos dois: a capa é o `h1` e o botão).
   Arquivos: `lib/colecoes.ts`, `components/colecoes/tela-colecao.tsx`,
   `e2e/v3.spec.ts` (o teste da §22.12 item 4 passa a ler a posição no
   bloco), SPEC §22.13 item 9.
8. **A linha "agora" não cobre o canto do cartão** (C-plano-lista-canto-reto).
   Era: fundo de cantos retos sobre o cartão arredondado. É: a lista
   `overflow-hidden` recorta pelo raio (16,8 px); o link da semana fica a
   10 px ou mais da borda e o anel dele não é cortado. Arquivo:
   `components/colecoes/tela-colecao.tsx`.
9. **Inventário da ficha em folha** (C-l14-inventario-ficha-folha-como-abre).
   Era: a linha de `ficha-folha.tsx` na tabela do §22.14 item 6 citava só o
   player e a Visão geral. É: os quatro gatilhos (`tela-player.tsx`,
   `bloco.tsx`, `treino/lista.tsx`, `lista-da-colecao.tsx`), conferidos por um
   Vitest que faz o grep de `<FichaEmFolha`. Arquivo: `SPEC.md`.
10. **Tag de equipamento: link × texto** (C-l14-tag-equipamento-sem-sinal-visual).
    Era: "Anilhas" (sem coleção) com a mesma pílula de "Banco", "Barra
    maciça" e "Cavalete" (links). É: a tag-link é pílula com contorno,
    sublinhada sempre e com a seta (›); a tag-texto é texto simples em
    `text-muted-foreground`, sem pílula. Arquivo:
    `components/exercicio/ficha-folha.tsx`.

#### Provas

- **Vitest** `lib/l32.test.ts` (9 testes): os 81 exercícios com
  "Execução: <nome>" em toda opção de mídia (e a foto com "— início"); os
  nomes que davam "Execução do" (Prancha, Remada, Rosca, Elevação…); nenhum
  `.ts`/`.tsx` de `lib/` e `components/` monta "Execução do/da" em código;
  as cinco seções da vitrine sem capa repetida; "Corda: 5 estágios" com a
  capa da seção Planos na busca "corda" (e o ícone com a regra de antes);
  nos 122 termos, nenhuma foto repetida e toda coleção cuja capa da vitrine
  está livre fica com ela (484 linhas, 144 → 66 diferentes, planos 4 → 2);
  a capa do plano sem a posição para os três planos e as semanas 1 a 14; o
  grep de `<FichaEmFolha` (4 arquivos) contra a linha da tabela da SPEC.
- **Mutação Vitest** (cópia no scratchpad `l32-mut/`): capa da vitrine
  ignorada → 2 testes caem; `detalheDaCapa` com a posição → 1; alt de volta
  a "Execução do" → 3; `FiguraExercicio` com o texto à mão → 1; sem mutação,
  9 de 9.
- **e2e** `e2e/ultraloop-l32.spec.ts` (⟨N⟩ testes, 360×740): ⟨preencher⟩.
- **Mutação e2e** (cópia `l32-mut-e2e/`, build:e2e próprio, as oito
  mutações juntas): ⟨preencher⟩.

#### Portões

⟨preencher⟩

#### Capturas

⟨preencher⟩

#### Como testar no celular (360 px)

1. Treino → Começar → no player, "?" (Como fazer): escolha "Figura" no
   segmento, toque em "Substituir" e escolha outro exercício — a figura do
   novo aparece; com a Ilustração, ela recomeça na posição 1.
2. Na mesma folha, a aba Músculos aberta continua aberta ao trocar de
   exercício pela seta › e pelo "Substituir", com os músculos do novo.
3. Com o leitor de tela, a figura diz "Execução: Prancha" (nunca "do
   Prancha").
4. Explorar → buscar "corda": nenhuma linha com vão entre o título e o
   "contém …"; "Corda: 5 estágios" com a mesma foto que tem na seção Planos.
5. Explorar → Planos → "5 km sem parar": "semana N de 12" uma vez só (no
   bloco "Semanas do plano"); a linha "agora" sem canto reto sobre o cartão,
   nos dois temas.
6. Exercícios → Supino reto com barra → Equipamento: "Banco", "Barra
   maciça" e "Cavalete" sublinhados com a seta; "Anilhas" como texto.
