# Reconciliação da fila — ledger canônico v3

Base `ef3ad97` (main = produção), lida em `/home/user/wt-c` (árvore limpa, só leitura). Gerado em 2026-09-22T22:35:15Z. Entradas: `fila-v2.json`, `lotes-plano.json`, `triagem-26.json`, `censo-analise.json`. Saídas: `fila-v3.json` (com o plano em `lotes_planejados` e o destino dos 227 achados em `censo`), `lotes-plano-v3.json`, `perguntas-ao-dono.md` e este arquivo. Scripts: `work/construir_v3.py`, `work/validar_v3.py`, `work/escrever_md.py`.

## Contagens v2 → v3

| | v2 | v3 | diferença |
|---|---:|---:|---|
| itens (pendente + candidato) | 112 | 138 | +10 triagem, +15 censo, +2 observações, −1 pwa-offline-09 |
| pendente | 105 | 131 | +27 −1 |
| candidato (L12 em construção) | 7 | 7 | os mesmos 7 |
| resolvidos | 23 | 91 | +5 triagem, +63 censo (os outros 6 publicados do censo viraram origem de resolvido) |
| descartados | 1 | 18 | +11 triagem, +4 censo, +visual-14, +pwa-offline-09 |
| canônicos | 136 | 247 |  |
| lotes planejados | 17 | 19 | +L19b do censo (L20), +L23b da triagem (L25) |

| seção | pendente | candidato | publicado | descartado | total |
|---|---:|---:|---:|---:|---:|
| B | 87 | 3 | 11 | 17 | 118 |
| C | 39 | 4 | 3 | 0 | 46 |
| D | 5 | 0 | 0 | 0 | 5 |
| legado | 0 | 0 | 77 | 1 | 78 |
| **total** | **131** | **7** | **91** | **18** | **247** |

v2 por seção: B 61/3/11/0 · C 39/4/3/0 · D 5/0/0/0 · legado 0/0/9/1. Na v3, B ganha os 27 pendentes novos e os 16 descartados novos da análise e perde o pwa-offline-09 (pendente → descartado); os publicados que nunca estiveram na fila (5 da triagem + 63 do censo) entram em 'legado', como os 7 do L9 planejado na v2. C e D não mudam de tamanho.

## O que entrou e por quê

**Triagem dos 26** (`triagem-26.json`):

- 5 publicados → resolvidos (seção legado, com sha/PR do lote que fechou e prova arquivo:linha):
  - `performance-02` — L2, #6 b6e8135
  - `a11y-04` — L3, #7 c7d947a
  - `pwa-offline-14` — L1, #6 b6e8135
  - `tela-explorar-fichas-17` — L3+L4, #7 c7d947a
  - `copy-27` — Marco V1, #2 7526f38
- 10 pendentes → itens (item completo da triagem):
  - `ux-heuristicas-20` → L25
  - `copy-28` → L16
  - `copy-24` → L25
  - `tela-explorar-fichas-08` → L13
  - `tela-explorar-fichas-13` → L13
  - `tela-explorar-fichas-11` → L13
  - `tela-relatorio-corpo-calendario-07` → L25
  - `performance-08` → L26
  - `copy-04` → L25
  - `copy-13` → L14
- 11 descartados, cada um com o motivo da triagem:
  - `performance-09` — depende de decisão do dono
  - `performance-15` — custo desproporcional + fora de escopo (Lighthouse ≥ 90)
  - `performance-14` — duplicata de item pendente — absorvido em `C-next-dynamic-rotas-pesadas`
  - `visual-07` — custo desproporcional
  - `visual-15` — contradiz a SPEC
  - `visual-18` — custo desproporcional
  - `visual-12` — custo desproporcional (o que sobra é desenho decidido)
  - `tela-explorar-fichas-27` — depende de decisão do dono
  - `tela-treino-player-15` — depende de decisão do dono
  - `tela-treino-player-23` — depende de decisão do dono
  - `copy-06` — depende de decisão do dono — absorvido em `tela-explorar-fichas-09 (parte de aparelho)`

**Censo dos 227 achados** (`censo-analise.json`), os 92 sem destino no ledger v2:

- 69 publicados: 63 viram entrada em resolvidos (L4 2, L5 16, L6 19, L7 16, L8 10) e 6 viram origem + duplicata do resolvido canônico que o censo apontou: imagens-15, performance-07 e visual-17 → `tela-explorar-fichas-01`; performance-06 → `imagens-03`; pwa-offline-10 → `tela-explorar-fichas-14`; tela-explorar-fichas-04 → `tela-explorar-fichas-02`.
- 15 pendentes novos → itens: `a11y-02` (L20), `a11y-07` (L25), `a11y-08` (L25), `a11y-15` (L20), `copy-08` (L14), `copy-19` (L18), `copy-22` (L20), `copy-25` (L14), `performance-16` (L24), `performance-18` (L20), `pwa-offline-02` (L25), `tela-treino-player-06` (L20), `tela-treino-player-07` (L20), `tela-treino-player-25` (L20), `visual-11` (L13).
- 3 pendentes somados a itens existentes (origem + duplicata, FAZER/ACEITE ampliados): `a11y-13` → `C-aviso-conquista-regiao-viva` (L26); `copy-23` e `ux-heuristicas-07` → `C-descanso-sinal-visivel` (L29).
- 4 descartados: `imagens-17` (custo desproporcional), `performance-10` (contradiz a SPEC + custo desproporcional), `performance-11` (custo desproporcional), `performance-17` (custo desproporcional).
- 1 depende do dono: `visual-14` (o laranja só em texto pequeno) → descartados, com a pergunta.

**Duas observações novas do censo → itens próprios** (PROBLEMA/FAZER/ACEITE/ESTADO medidos em ef3ad97):

- `OBS-porcentagem-com-espaco` (L19). O pedido falava em '7 arquivos'; o grep em ef3ad97 dá **7 ocorrências em 5 arquivos** (fora a do copy-19, data/cardio.json:332): data/progressao.json:48, :52, :68; components/treino/tela-treino.tsx:95; components/exercicios/historico-exercicio.tsx:104; lib/guia.ts:358; lib/retomada.ts:136. Os demais ' %' do grep são comentários e nomes de teste (listados no item). O falhas[] de data/progressao.json não aparece na tela hoje (só lib/schemas.ts:316 o lê), mas é conteúdo e entra.
- `OBS-elastico-x-super-band` (L14). Conferido em data/*.json: é um objeto só — data/equipamentos.json:115-118 ('super-band', 'Super Band 45 mm (Yangfit)'); os 2 exercícios de implemento 'band' também têm equipamento 'super-band' e todo equipamento_texto diz 'Super Band'. O filtro 'Elástico' (lib/catalogo.ts:54) é um subconjunto do 'Super band' (:69) com outro nome. Nenhum dado muda; só o rótulo.

**Outras junções:**

- `performance-14` (triagem: duplicata) somado ao `C-next-dynamic-rotas-pesadas` (L17): FAZER com a conclusão, o feedback e o 'firme?' do player (components/player/tela-player.tsx:7-16) e ACEITE com a linha de base de ef3ad97 (/treinar/[sessionId] < 428 kB de First Load, r10/base-build.log:86). A entrada performance-14 fica em descartados com `absorvido_em`.
- O defeito de `lib/queries/progresso.ts:74-86` (useSeriesTodas ascendente com limit 3000: passadas 3.000 séries o Relatório para de ver as novas) **coube dentro do `performance-08`** (L26): mesmo arquivo, já nos arquivos do item; o FAZER (4) pede as 3.000 mais recentes e o ACEITE ganhou o caso das 3.001 séries. Origem `C-series-todas-ascendente-3000` registrada; não virou item próprio.
- `copy-22`: item novo (chip 'montagem', L20); a parte 'NA BARRA' da Visão geral é origem do `C-rotulo-do-campo-de-carga` (L29).
- `copy-06` (dono) tem a parte de aparelho como origem do `tela-explorar-fichas-09` (candidato do L12).
- `pwa-offline-09` (aviso de versão nova em vez de skipWaiting) saiu de itens para descartados: 'depende de decisão do dono', com o item completo em `item_suspenso` e para onde volta se a resposta for sim.

## Plano final (lotes-plano-v3.json)

| # | código | antes | título | área | itens | B/C/D | M | arquivos | telas | exceção |
|---:|---|---|---|---|---:|---|---:|---:|---:|---|
| 1 | L13 | L13 | Ficha: mídia e interação; coleções do Explorar | ficha | 10 | 10/0/0 | 2 | 11 | 6 | área: tela-explorar-fichas-08, tela-explorar-fichas-13, tela-explorar-fichas-11, visual-11 |
| 2 | L14 | L14 | Ficha: conteúdo e ações; nomes do catálogo e créditos | ficha | 10 | 9/1/0 | 3 | 12 | 6 | área: copy-08, OBS-elastico-x-super-band; ordem: flutuante-no-dialogo-da-foto |
| 3 | L15 | L15 | Corpo: peso, gráficos e campo de data | corpo | 6 | 6/0/0 | 2 | 11 | 5 | — |
| 4 | L16 | L16 | Corpo: medidas, fotos, data no celular e um verbo só para salvar | corpo | 6 | 5/0/1 | 1 | 9 | 3 | ordem: D-input-date-pt-br |
| 5 | L17 | L17 | Casca: carregamento, rotas pesadas, zoom e bloco de sincronização | casca | 6 | 3/3/0 | 3 | 12 | 6 | ordem: C-loading-por-rota, C-next-dynamic-rotas-pesadas, C-nav-inferior-zoom-200 |
| 6 | L18 | L18 | Cardio e barra fixa | cardio | 7 | 7/0/0 | 2 | 11 | 5 | — |
| 7 | L19 | L19 | Player: preparação e série; '%' colado nos textos | player | 6 | 6/0/0 | 2 | 12 | 2 | área: OBS-porcentagem-com-espaco |
| 8 | L20 | L19b (censo) | Player: descanso, preparação e o caminho até o player | player | 8 | 8/0/0 | 2 | 12 | 3 | — |
| 9 | L21 | L20 | Player: firme, conclusão e Visão geral | player | 6 | 6/0/0 | 1 | 12 | 5 | área: visual-08 |
| 10 | L22 | L21 | Sem rede: sinal, fila, mensagens e sincronização | pwa | 6 | 6/0/0 | 3 | 12 | 3 | — |
| 11 | L23 | L22 | Instalação, cache de mídia e cor da barra | pwa | 6 | 5/1/0 | 3 | 12 | 3 | ordem: C-theme-color-do-tema-escolhido |
| 12 | L24 | L23 | Mais: textos, linhas e prefetch | mais | 7 | 7/0/0 | 0 | 12 | 6 | — |
| 13 | L25 | L23b (triagem-26) | Copy e mensagens: dia da semana, intervalo, perfil, backup e login | copy | 8 | 8/0/0 | 0 | 12 | 5 | — |
| 14 | L26 | L24 | Relatório: números, aviso, esqueleto e leituras repetidas | relatorio | 7 | 1/6/0 | 3 | 12 | 4 | — |
| 15 | L27 | L25 | Calendário: faixa, legenda e semana navegada | calendario | 7 | 0/7/0 | 2 | 12 | 4 | — |
| 16 | L28 | L26 | Aba Treino: cabeçalho, faixa fixa e avisos | treino | 6 | 0/6/0 | 0 | 11 | 3 | — |
| 17 | L29 | L27 | Player: pendências das auditorias do L5 | player | 6 | 0/6/0 | 0 | 11 | 3 | — |
| 18 | L30 | L28 | Processo, testes e documentação | processo | 7 | 0/7/0 | 0 | 12 | 0 | — |
| 19 | L31 | L29 | D: medidas antes/depois, processo e scripts | D | 6 | 0/2/4 | 3 | 12 | 3 | área: R9-C1, D-abertura-11s-aparelho-zerado, D-sessao-concluida-reabre-player, D-e2e-sair-pela-tela, D-sw-em-qualquer-cache, C-comparar-capturas-esperadas |

Ordem do dono: Ficha (mídia L13; conteúdo L14), Corpo (peso L15; medidas L16), casca (L17); depois os lotes B de cardio, player, rede/instalação, Mais e textos (L18–L25), o último lote com B (Relatório, L26), os só-C por área (L27–L30) e o D por último (L31). Todo pendente está em exatamente um lote; os 7 candidatos continuam no L12 em construção.

## Ajustes pedidos × o que foi feito

| ajuste pedido | feito | observação |
|---|---|---|
| L13 + visual-11, tela-explorar-fichas-08/-11/-13 | sim | cabe nas regras com exceção de área escrita (10 itens, 2 M, 11 arquivos, 6 telas): não se criou lote de Explorar; a alternativa está na exceção e em perguntas-ao-dono.md |
| L14 + copy-13, copy-25, copy-08 | sim | e + OBS-elastico-x-super-band (mesmo arquivo do copy-25): 10 itens, 3 M, 12 arquivos, 6 telas; exceção de área para copy-08 e o elástico |
| L16 com copy-28 no lugar do copy-07 | sim | e − pwa-offline-07 (ver abaixo): 6 itens, 1 M, 9 arquivos, sem exceção |
| L18 + copy-19 | sim | 7 itens, 2 M, 11 arquivos |
| L19b novo | sim → L20 | os 7 do censo + ux-heuristicas-06 (ver abaixo): 8 itens, 2 M, 12 arquivos |
| L23 + performance-16 | sim → L24 | 7 itens, 0 M, 12 arquivos |
| L23b novo (8 itens) | sim → L25 | exatamente os 8 pedidos: 0 M, 12 arquivos, 5 telas |
| L24 + performance-08 | sim → L26 | 7 itens (1 B + 6 C), 3 M, 12 arquivos; último lote com B |
| performance-14 no C-next-dynamic-rotas-pesadas | sim | FAZER/ACEITE ampliados; L17 sem arquivo novo |
| progresso.ts:74-86 no performance-08 ou item próprio | no performance-08 | cabe: mesmo arquivo |
| pwa-offline-09 e visual-14 em descartados (dono) | sim | e performance-09, tela-explorar-fichas-27, tela-treino-player-15/-23 e copy-06, que a triagem marcou com pergunta |

**Três ajustes meus, forçados pelas regras** (nenhum desfaz um ajuste pedido):

1. **Tirar o pwa-offline-09 deixava o lote de instalação com 5 itens.** O pwa-offline-08 ('Instalar o app' em Mais) passou do lote 'Sem rede' para o de instalação (L23; app/(app)/mais/page.tsx já estava lá), e o pwa-offline-07 (Corpo → Peso sem rede diz 'registrado') passou do L16 para o 'Sem rede' (L22), onde está lib/outbox.ts, o arquivo em que o par de mensagens é decidido. O -07 não era da ordem 4 do dono (entrava no L16 só pela área). L22: 6 itens, 3 M, 12 arquivos; L23: 6 itens, 3 M, 12 arquivos.
2. **O OBS-porcentagem-com-espaco não cabia em lote nenhum.** São 5 arquivos de quatro telas; os lotes de textos (L24, L25) e os que já editam um dos cinco (L14, L17, L28) estão em 11–12 arquivos, e o item sozinho não fecha lote. O ux-heuristicas-06 passou do L19 para o L20 (junto do tela-treino-player-06, que completa o mesmo topo do descanso — o próprio censo dizia que um completa o outro), o L19 deixou de precisar de descanso.tsx e do e2e novo (os casos vão para e2e/player.spec.ts), e o '%' entrou no L19 com exceção de área escrita: 6 itens, 2 M, 12 arquivos. O guarda do '%' fica em e2e/treino.spec.ts, que o L19 já edita.
3. **A alternativa da exceção do L21 (visual-08) foi refeita:** as duas saídas da v2 deixavam um lote com 5 itens; a nova é trazer o tela-treino-player-25 do L20 (L21 com 6 itens e 8 arquivos, L20 com 7).

## Renumeração

Estável e sem sufixo: L13 → L13 · L14 → L14 · L15 → L15 · L16 → L16 · L17 → L17 · L18 → L18 · L19 → L19 · L19b → L20 · L20 → L21 · L21 → L22 · L22 → L23 · L23 → L24 · L23b → L25 · L24 → L26 · L25 → L27 · L26 → L28 · L27 → L29 · L28 → L30 · L29 → L31. Os códigos de lote citados em `detalhe`/`nota` dos itens, no `motivo` dos descartados novos e nas observações dos lotes já estão na numeração v3; em `prova`, `origens` e nos resolvidos ficam os da fonte. Os e2e novos de cada lote seguem o código novo (`e2e/ultraloop-lNN.spec.ts`).

## Tabela final do censo: 227 = 109 cobertos + 26 triagem + 92 decididos

| situação no censo | decisão | n | destino na v3 |
|---|---|---:|---|
| coberto_no_ledger | coberto | 109 | descartados (entrada) 2, itens (duplicata) 15, itens (entrada) 63, itens (origem) 1, resolvidos (duplicata) 10, resolvidos (entrada) 18 |
| triagem26 | descartado | 11 | descartados (entrada) 11 |
| triagem26 | pendente | 10 | itens (entrada) 10 |
| triagem26 | publicado | 5 | resolvidos (entrada) 5 |
| sem_destino | depende de decisão do dono | 1 | descartados (entrada) 1 |
| sem_destino | descartado | 4 | descartados (entrada) 4 |
| sem_destino | pendente | 18 | itens (duplicata) 3, itens (entrada) 15 |
| sem_destino | publicado | 69 | resolvidos (duplicata) 6, resolvidos (entrada) 63 |
| **total** | | **227** | |

Destino na v3 somado: descartados (entrada) 18, itens (duplicata) 18, itens (entrada) 88, itens (origem) 1, resolvidos (duplicata) 16, resolvidos (entrada) 86. Todo achado tem destino; nenhuma decisão do censo ou da triagem diverge do destino (publicado → resolvidos, pendente → itens, descartado/dono → descartados). O único 'coberto' por origem é o a11y-09 (parcial, dentro do C-nav-inferior-zoom-200). Dos 109 cobertos na v2, o pwa-offline-09 mudou de itens para descartados. A lista completa, achado a achado, está em `fila-v3.json#censo.achados`.

## Validação (python3, `work/validar_v3.py`)

- JSON válido nos dois arquivos; `lotes_planejados` de fila-v3.json idêntico a lotes-plano-v3.json.
- 247 ids de entrada, todos únicos; nenhuma duplicata é também entrada; duplicata em duas entradas só com '(parte …)' (a11y-12).
- Todo pendente em exatamente um lote e com `lote_planejado` igual ao do plano; os 7 candidatos só no L12.
- Todos os 19 lotes com 6–10 itens, ≤ 3 M, ≤ 12 arquivos, ≤ 6 telas (nomes das 30 capturas); item fora da área só com `excecao` que o lista e tem motivo (L13, L14, L19, L21, L31); C antes do último lote com B só com `excecao_de_ordem` (L14, L17, L23); D só no último lote ou com `excecao_de_ordem` (L16); nenhum B depois do L26.
- Contagens e `por_secao` recalculadas e conferidas com os arrays; nada da v2 sumiu.
- Censo: 227 achados distintos, 109/26/92, todos com destino coerente com a decisão.
- As 7 linhas do '%' conferidas no código de ef3ad97, e o grep não acha outra string de interface além delas e da do copy-19.
- Todo arquivo dos lotes existe em ef3ad97, menos os marcados '(novo)'. Dois avisos esperados: os loading.tsx do C-loading-por-rota ainda não existem (são novos).

## O que continua aberto

- Sete itens esperam o dono (seção 1 de perguntas-ao-dono.md) e quatro lotes pedem o sim para a exceção de área (L13, L14, L19, L21) — cada exceção tem a alternativa escrita.
- Convenção de contagem de arquivos (a da v2): arquivos dos itens + e2e novo + e2e que afirmam texto trocado + SPEC.md + PROGRESSO.md. Unitários em arquivo de teste já existente que o ACEITE pede mas o item não lista (ex.: lib/outbox.test.ts do pwa-offline-07, lib/precache-do-programa.test.ts do pwa-offline-03, lib/usar-rede.test.ts do pwa-offline-01) não entram; se no começo do lote isso passar de 12, o item volta como parcial (PROMPT-CONTINUACAO §5.1).
- Sem medição nova (build, e2e e servidor proibidos): o '%' e o elástico foram medidos por leitura do código; performance-09 e performance-17 dependem das medidas da análise e do build.log de ef3ad97.
- O L12 em construção (wt-a, não publicado) muda linha-colecao.tsx e o detalhe da capa do plano; os quatro de Explorar do L13 são aplicados sobre o L12 publicado.
