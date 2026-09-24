# Perguntas ao dono — fila v3

Base `ef3ad97` (main = produção). Gerado em 2026-09-22T22:35:15Z junto de `fila-v3.json` e `lotes-plano-v3.json`.

Como ler: na **seção 1** estão os itens que só andam com uma decisão sua. Eles ficam em `fila-v3.json#descartados` com o motivo "depende de decisão do dono" e voltam para a fila se a resposta for sim — cada um diz para onde volta. Na **seção 2** estão os lotes que juntam itens de mais de uma área; os itens continuam no plano e a resposta só muda de lote. A **seção 3** é uma confirmação que a v2 deixou aberta.

## 1. Itens parados à espera de uma decisão (7)

### 1.1 `pwa-offline-09` — Versão nova troca por baixo do usuário (skipWaiting), até no meio do treino

**Pergunta:** Quando sair uma versão nova do app, ela deve continuar entrando sozinha na hora — como hoje, trocando por baixo mesmo no meio de um treino — ou o app deve mostrar um aviso 'Nova versão do app — tocar para atualizar' e só trocar quando você tocar, esperando o fim do treino se houver um em andamento?

**Opções:**

- **Sim** → volta a pendente no L23 'Instalação' no lugar do pwa-offline-08 (a composição da v2: 6 itens, 3 M, 12 arquivos); o pwa-offline-08 ('Instalar o app' em Mais) vai para o L24 'Mais', que já edita app/(app)/mais/page.tsx (8 itens, 1 M, 12 arquivos, exceção de área escrita).
- **Não** → fica como está (skipWaiting e clientsClaim automáticos, app/sw.ts:348-349) e sai da fila de vez.

_Hoje: app/sw.ts:348-349 `skipWaiting: true, clientsClaim: true`; nenhum 'updatefound'/SKIP_WAITING no cliente. A versão nova assume por baixo, inclusive no meio de um treino (as séries já estão no IndexedDB; o que muda é a troca sem aviso)._

### 1.2 `visual-14` — O laranja só aparece em texto pequeno; nenhum dado grande carrega a marca

**Pergunta:** O laranja deve sair dos links pequenos repetidos ('Ver todos (6)' vira cinza com chevron) e passar a marcar UM dado grande por tela — a meta da semana ('2/5') na aba Treino, o número em foco no Relatório, o dia de hoje na faixa? Muda a cara de Treino, Explorar, Relatório, Corpo e Mais. Sim = lote visual novo, tela a tela; não = fica como está.

**Opções:**

- **Sim** → vira um lote visual novo, uma tela por item (Treino, Explorar, Relatório, Corpo, Mais — 5 telas), depois do L25 e antes dos lotes só-C, com a regra 'o laranja marca um dado grande por tela' escrita na SPEC antes do código.
- **Não** → fica como está; o laranja continua nos links e rótulos pequenos (contraste AA já conferido no L3).

_Hoje: o laranja aparece em texto de 10–12 px ('Ver todos (N)' em components/explorar/tela-explorar.tsx:405, rótulos da barra de abas, datas de conquista); números e títulos grandes são neutros. Não é defeito de uso nem de contraste — é onde a marca aparece._

### 1.3 `performance-09` — Relatório: 1,8 s de long task somando o histórico no celular

**Pergunta:** Quer que o Relatório passe a somar no Supabase (uma view ou função nova, só acrescentando, que você mesmo aplica no painel) se uma medição nova no celular, com um ano de treinos semeado, mostrar o Relatório travando mais de 200 ms ao abrir? Sem esse sim, fica como está.

**Opções:**

- **Sim** → primeiro uma medição nova no celular com um ano de treinos semeado; se o Relatório travar mais de 200 ms ao abrir, vira item (esforço G, dividido em partes que caibam num lote) com o SQL expand-only entregue para você aplicar no painel antes do deploy; se não travar, fica como está mesmo com o sim.
- **Não** → fica como está; a parte barata (as leituras repetidas) segue no performance-08 (L26).

_Hoje: a análise mediu 1,8 s de travadas ao abrir o Relatório, mas antes do L6; em ef3ad97 os Gráficos só montam quando você abre a seção (components/relatorio/tela-relatorio.tsx:77-86). Não foi re-medido. A proposta pede uma view/função nova no banco (só acrescentando)._

### 1.4 `tela-explorar-fichas-27` — Destaque do Explorar é o cartão grande da aba Treino e empurra a vitrine

**Pergunta:** No Explorar, o destaque do topo pode virar uma faixa de uma linha ('Hoje: Treino B →') em vez do mesmo cartão grande da aba Treino, para a vitrine subir uns 400 px? Isso muda as seções 13.4 e 14.4 da SPEC.

**Opções:**

- **Sim** → a SPEC §13.4 e §14.4 mudam antes do código e o item volta como pendente M de Explorar (arquivos components/explorar/tela-explorar.tsx); o L13 está em 10 itens, então entra no primeiro lote de Explorar ainda não montado ou abre, com os quatro de coleções do L13, o lote próprio de Explorar da alternativa do L13.
- **Não** → o destaque continua o mesmo cartão grande da aba Treino, como a SPEC manda.

_Hoje: o destaque do Explorar é o mesmo cartão grande da aba Treino (components/explorar/tela-explorar.tsx:246-250), como a SPEC manda (§13.4, SPEC.md:290; §14.4, SPEC.md:354)._

### 1.5 `tela-treino-player-15` — Filtros 'Core' e 'Cardio' repetem os chips de grupo em Parte do corpo

**Pergunta:** Na aba Treino → Parte do corpo, os filtros 'Core' e 'Cardio' repetem os chips de grupo Core e Cardio da fileira de cima (e, ligados, escondem os outros grupos). Posso tirar os dois da fileira de filtros, ficando só tempo e equipamento? Isso muda a lista de filtros da §14.3 da SPEC.

**Opções:**

- **Sim** → a §14.3 muda antes do código e o item volta como pendente P (lib/colecoes.ts:355-356, components/treino/parte-do-corpo.tsx:154-160, lib/colecoes.test.ts:308-310/:335), no primeiro lote B ainda não montado com folga que edite lib/colecoes.ts.
- **Não** → os seis filtros da §14.3 ficam.

_Hoje: 'Core' e 'Cardio' aparecem nos chips de grupo e de novo nos filtros (lib/colecoes.ts:355-356; components/treino/parte-do-corpo.tsx:141 e :154-160), como a §14.3 manda (SPEC.md:351)._

### 1.6 `tela-treino-player-23` — A faixa da semana desenha sete dias tocáveis, mas é um alvo só

**Pergunta:** Na aba Treino, cada dia da faixa da semana deve abrir o Calendário já naquele dia (sete destinos), em vez de a faixa inteira abrir a semana? Isso muda as seções 13.3 e 16.3 da SPEC.

**Opções:**

- **Sim** → a §13.3 e a §16.3 mudam antes do código e o item volta como pendente M (components/ui/faixa-semana.tsx, components/treino/cabecalho.tsx e o Calendário abrindo no dia), num lote B ainda não montado.
- **Não** → a faixa continua um alvo só que abre a semana no Calendário.

_Hoje: a faixa é um link só, 'Abrir o calendário da semana' (components/ui/faixa-semana.tsx:104), como a §13.3 (SPEC.md:280) e a §16.3 (SPEC.md:512-513) mandam._

### 1.7 `copy-06` — Subtítulo de coleção de aparelho/plano é ficha técnica ou lista de funções

**Pergunta:** Quer um resumo curto (até ~60 caracteres) para cada plano — corrida, corda e barra fixa — em data/cardio.json, para a vitrine do Explorar mostrar no lugar das funções da corda ('aquecimento: 2 min antes de todo treino de força…')? Se sim, você escreve ou aprova os que eu propuser?

**Opções:**

- **Sim** → você escreve (ou aprova, um a um) os três resumos em data/cardio.json; vira item P de conteúdo + vitrine (lib/colecoes.ts:243 passa a ler o resumo) no primeiro lote de Explorar ainda não montado.
- **Não** → a parte de aparelho continua no tela-explorar-fichas-09 (candidato do L12); a vitrine dos planos segue mostrando as funções da corda.

_Hoje: a vitrine mostra como subtítulo do plano Corda a junção das funções (lib/colecoes.ts:243). O app não inventa texto: um resumo novo precisa vir de você._

## 2. Lotes que juntam áreas (os itens ficam no plano)

Regra de cada lote: 6–10 itens, até 3 médios, até 12 arquivos, até 6 telas e **uma área**; item de outra área só com o motivo escrito no campo `excecao` do lote. Estes pedem o seu sim antes de o lote ser montado.

### L13 — Ficha: mídia e interação; coleções do Explorar

**Pergunta:** Posso juntar ao lote da Ficha (L13) quatro consertos das coleções do Explorar — a linha da coleção com duas alturas (tela-explorar-fichas-08), a capa do plano sem ícone (-13), a coleção de plano que é só um cartão, sem as semanas (-11), e os raios desalinhados do chevron (visual-11)? O lote fica com 10 itens.

- **Sim** → o plano fica como está.
- **Não** → abre-se um lote só de Explorar/catálogo logo depois do L14 (os quatro + copy-25 + OBS-elastico-x-super-band: 6 itens, 1 médio, 9 arquivos); o L13 volta a 6 itens, o L14 a 8, e os códigos dos lotes seguintes andam uma casa.

_Motivo escrito no lote: Explorar e as fichas são a mesma prioridade (2) do dono (SPEC.md:1354-1355, §22.0) e os quatro itens de coleções não fecham lote sozinhos (4 < 6). No L13 somam 4 arquivos (linha-colecao.tsx, tela-colecao.tsx, lib/colecoes.ts e o teste) e 2 telas (06-explorar, 07-colecao), e o lote fica em 10 itens, 2 M, 11 arquivos e 6 telas._

### L14 — Ficha: conteúdo e ações; nomes do catálogo e créditos

**Pergunta:** No lote da Ficha de conteúdo (L14) podem entrar também o texto dos Créditos da mídia (copy-08, Mais → Créditos) e o nome único da faixa elástica nos filtros do catálogo (OBS-elastico-x-super-band)?

- **Sim** → o plano fica como está.
- **Não** → os dois saem do L14 e esperam um lote com folga (os de textos, L24 e L25, estão no teto de 12 arquivos); se a resposta ao L13 também for não, o do elástico entra no lote próprio de Explorar/catálogo junto com o copy-25.

_Motivo escrito no lote: copy-08 (Mais → Créditos) é o texto do crédito da mídia que a ficha mostra (§15.1 itens 3 e 4); o lote dono da tela 24-creditos (L24, Mais) está no teto de 12 arquivos. OBS-elastico-x-super-band é do catálogo (Explorar), mas é o mesmo arquivo e a mesma troca de rótulo do copy-25 (lib/catalogo.ts), que o tela-explorar-fichas-21 deste lote usa nas tags da ficha (ficha-folha.tsx:144); separado, ficaria sem lote._

### L19 — Player: preparação e série; '%' colado nos textos

**Pergunta:** Posso pôr a correção do '%' separado do número (OBS-porcentagem-com-espaco: 7 textos em 5 arquivos, um caractere cada — retomada, ficha, guia e o conteúdo da progressão) no lote do player L19, o único com espaço?

- **Sim** → o plano fica como está.
- **Não** → o item fica pendente sem lote até um lote de textos com folga de 5 arquivos (ou entra no L25 com 17 arquivos, o que pede uma segunda exceção).

_Motivo escrito no lote: Varredura de grafia sem dono de área: 7 linhas em 5 arquivos de quatro telas (retomada da aba Treino, ficha, Guia e conteúdo da progressão), um caractere por linha. Nenhum lote a recebe sem passar de 12 arquivos — os lotes de textos (L24 e L25) e os que já editam algum dos cinco (L14, L17, L28) estão em 11–12 — e ela sozinha não fecha lote (1 < 6). O L19 é o único lote B com folga para os cinco depois que o ux-heuristicas-06 foi para o L20 (descanso.tsx saiu) e os casos do lote passaram para e2e/player.spec.ts; o guarda vai em e2e/treino.spec.ts, que o copy-21 já edita. Nenhuma tela esperada a mais._

### L21 — Player: firme, conclusão e Visão geral

**Pergunta:** O visual-08 (três grafias do rótulo em caixa alta em Mais, Relatório, Guia, Calendário e na Visão geral do player) pode ir no lote do player L21, que já mexe na Visão geral? (pergunta que vem da v2)

- **Sim** → o plano fica como está.
- **Não** → o tela-treino-player-25 vem do L20 para o L21 (6 itens, 8 arquivos) e o visual-08 espera um lote de textos com folga.

_Motivo escrito no lote: os 15 itens de Mais/casca (3 C da remontagem, a11y-16 e os 11 do grupo a11y-10) pedem ~25 arquivos de código; com 6–10 itens e ≤ 12 arquivos por lote (SPEC.md e PROGRESSO.md contam) eles cabem em dois lotes só se dois itens forem para lotes que já editam um dos seus arquivos. O visual-08 (três versões do rótulo em caixa alta) completa o L21 porque também troca os rótulos da Visão geral do player (components/treinar/serie.tsx:223/:326), arquivo que o L21 já edita, e o L17 e o L24 estão no teto de 12 arquivos._

O L31 (os itens D por último, de várias áreas) não precisa de pergunta: é a ordem que você já deu.

## 3. Confirmação que a v2 deixou aberta

**Pergunta:** os grupos que o REMONTAR_L12 (docs/ultraloop/lotes-r6.json) mandou remontar e que não estavam na fila — a11y-10 (Mais/casca), pwa-offline-01 (rede e instalação), ux-heuristicas-17 (cardio e barra fixa), tela-treino-player-12/27 e ux-heuristicas-06/12/15 (player) — entram mesmo na fila? Hoje são 40 itens pendentes, em L14 (1), L17 (3), L18 (6), L19 (5), L20 (1), L21 (6), L22 (6), L23 (5), L24 (6), L25 (1).

- **Sim** → o plano fica como está (é o que a v2 e a v3 assumem).
- **Não** → esses itens vão para descartados com esse motivo e os lotes que os levam são refeitos (L17, L18, L19, L21, L22, L23 e L24 são quase só deles).

## 4. Decisão tomada sem o dono no L32 (24/09)

### L32 → L33 — A capa do plano deixou de dizer "semana N de 12"

**Pergunta:** Na tela de um plano do Explorar (por exemplo, Corrida em
/explorar/plano/corrida), a capa dizia "semana 2 de 12" e o bloco logo abaixo
dizia de novo "Semana 2 de 12 · 1 concluída". O L32 tirou a posição da capa:
agora ela aparece só no bloco. A capa continua com o título e o botão "Fazer a
corrida da semana N". Você aprova assim?

- **Sim** → fica como está (publicado em `b66e06c`). O L33 só troca o teste de
  unidade por um que confere com `data/cardio.json`.
- **Não** → a posição volta para a capa e sai do bloco, ou fica nos dois
  lugares, como você preferir. Isso vira um item B num lote do Explorar.

_Origem: o ledger pedia "decidir com o dono" (C-plano-progresso-repete-desafio).
A decisão foi tomada sem você e ficou registrada no item
C-l32-plano-capa-sem-o-dono (L33)._
