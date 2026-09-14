# Casos de teste do motor de progressão e da montagem da barra

Use como base de `lib/progressao.test.ts` e `lib/montagem.test.ts` (Vitest). Cargas: barra = total com a barra maciça de 7,5 kg; halter = por halter com a barra de 1,5 kg; polia = kg no pino. Passo mínimo em todos os implementos com anilhas = 2 kg (1 kg em cada lado / ponta; 2 kg no pino).

## Cargas alcançáveis (montagem)

| Implemento | Fórmula | Exemplos válidos | Inválidos → devolve |
|---|---|---|---|
| barra maciça | 7,5 + 2 × S, S = soma inteira de anilhas de um lado, no máximo 2 de cada peso por lado | 7,5 · 9,5 · 11,5 · 25,5 (5·4) · 107,5 (10·10·5·5·4·4·3·3·2·2·1·1) | 26,5 → 25,5 · 8 → 7,5 · 110 → 107,5 |
| halteres (par) | 1,5 + 2 × S por halter, os dois halteres iguais → no máximo **1 de cada peso por ponta** (4 pontas usam as 4 anilhas de cada); capacidade da barra de halter 40 kg | 1,5 · 3,5 (1) · 5,5 (2) · 11,5 (5) · 21,5 (10) · 39,5 (10·5·4) | 4,5 → 3,5 · 6 → 5,5 · 41,5 → 39,5 |
| polia (pino) | S = qualquer soma do estoque (as anilhas do pino saem do mesmo estoque), capacidade 100 | 1 · 2 · 4 · 6 · 9 · 20 | 0,5 → 0 · 101 → 100 |
| barra W | 2,0 (a pesar) + 2 × S, capacidade 50 | | 52 → 50 |

`montagem(25.5, "barra_macica")` → `{ porLado: [5, 4], total: 25.5, exato: true }`
`montagem(26.5, "barra_macica")` → `{ porLado: [5, 4], total: 25.5, exato: false, diferenca: -1 }`
`montagem(5.5, "halteres")` → `{ porPonta: [2], total: 5.5, exato: true }` (cada halter)
`montagem(107.5, "barra_macica")` → `{ porLado: [10, 10, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1], total: 107.5, exato: true }`
`montagem(109.5, "barra_macica")` → não alcançável: devolve 107,5 e `aviso: "faltam anilhas de 10 kg"`

Guloso do maior para o menor respeitando o limite de unidades por lado resolve todos os casos: na barra (até 2 de cada por lado) os pesos 1, 2, 3, 4, 5, 10 cobrem todo inteiro de 1 a 50; nos halteres (1 de cada por ponta) cobrem todo inteiro de 1 a 25.

## Motor de progressão — `decidir(exercicio, estado, seriesTrabalho)`

Prescrição do exercício entre parênteses. "firme" = `ultima_firme = true`.

| # | Exercício (faixa) | Estado antes | Séries feitas | Resultado esperado |
|---|---|---|---|---|
| 1 | Supino reto com barra (3 × 5–8) | 1ª sessão (sem estado) | carga 7,5; reps 8, 8, 8; firme | `subiu`: carga 9,5; falhas 0 |
| 2 | Supino reto (3 × 5–8) | carga 9,5 | 8, 8, 7; firme | `repetiu`: carga 9,5 (não chegou ao topo em todas) |
| 3 | Supino reto (3 × 5–8) | carga 9,5 | 8, 8, 8; **não** firme | `repetiu`: carga 9,5 |
| 4 | Supino reto (3 × 5–8) | carga 25,5, falhas 0 | 8, 6, 4 (4 < mínimo 5) | falha nº 1 → `repetiu`, carga 25,5, falhas 1 |
| 5 | Supino reto (3 × 5–8) | carga 25,5, falhas 1 | 7, 5, 3 | falha nº 2 → `falha_2x_voltou_10`: carga = alcançável ≤ 25,5 × 0,9 = 22,95 → **21,5**; incremento reduzido: 2 ÷ 2 = 1 < passo mínimo 2 → mantém 2 kg **e exige topo da faixa + 1 rep** (9, 9, 9) para a próxima subida; falhas 2 |
| 6 | Agachamento livre (3 × 5) | carga 39,5, falhas 1 | 5, 4, 3 | falha nº 2 → carga alcançável ≤ 35,55 → **35,5**; incremento 4 → **2** kg até a próxima subida; falhas 2 |
| 7 | Agachamento livre (3 × 5) | carga 35,5, falhas 2, incremento reduzido 2 | 5, 5, 5; firme | `subiu`: 37,5; falhas 0; incremento volta a 4 |
| 8 | Levantamento terra (3 × 5) | carga 47,5, falhas 2 | 4, 3, 3 | falha nº 3 → `semana_leve_60`: próxima sessão a alcançável ≤ 28,5 → **27,5**, mesmas séries; marca `semana_leve = true`; falhas 0 |
| 9 | Levantamento terra, sessão da semana leve | carga 27,5 (leve), `semana_leve` | 5, 5, 5 | fim da semana leve → volta a **47,5** (a carga de antes), incremento normal 4; evento `repetiu` com motivo `fim_semana_leve` |
| 10 | Rosca alternada, halteres (3 × 10–12 por braço) | carga 1,5 por halter | 12/12, 12/12, 12/11 (D/E) | menor lado vale: 3ª série 11 < 12 → `repetiu` |
| 11 | Rosca alternada, halteres | carga 1,5 | 12/12 nas 3; firme | `subiu`: **3,5** por halter (1 kg em cada ponta) |
| 12 | Puxada alta na polia (3 × 10–12) | 1ª sessão | 4 kg; 12, 12, 12; firme | `subiu`: 6 kg |
| 13 | Barra fixa assistida (4 × 5–8), assistência `pe_inteiro` | | 8, 8, 8, 8; firme | `subiu`: assistência → `joelho`; carga não muda; `sessoes_de_graca = 2` |
| 14 | Barra fixa assistida, `joelho`, 1ª sessão após mudar | | 5, 5, 4, 4 | dentro da graça → `repetiu`, **não** conta falha |
| 15 | Barra fixa pronada (3 × máximo) | média anterior 4,0 (4, 4, 4) | 5, 5, 5 | `subiu` (média +1, nenhuma série abaixo); quando 3 séries ≥ 10 → sugerir "Barra fixa com lastro" |
| 16 | Prancha (3 × 30–60 s) | tempo alvo 30 | 60, 60, 60 s; firme | `subiu`: tempo alvo 65 s (acima da faixa: sugerir variação) |
| 17 | Elevação de pernas na barra fixa (3 × 10–15) | reps alvo 10 | 15, 15, 15; firme | `subiu`: reps alvo 16; se todas passarem de 20 (SPEC §6.3 "acima de 20") → sugerir anilha de 2 kg entre os pés e voltar a 10 |
| 18 | Agachamento búlgaro (3 × 8–10 por perna), halteres 5,5 | | 10/10, 10/10, 10/9 | `repetiu` (menor lado) |
| 19 | Farmer's walk (3 × 30–40 passos), halteres 11,5 | | 40, 40, 40; firme | `subiu`: 13,5 por halter |
| 20 | Qualquer exercício, sessão `abandonada` com 1 série registrada | | 8 | não avalia: estado inalterado, sem evento |
| 21 | Supino reto substituído no dia por Supino inclinado com halteres | | halteres 12, 12, 12 firme | o inclinado com halteres sobe; o supino reto não muda |
| 22 | Supino reto, carga 107,5 (teto) | | 8, 8, 8; firme | `subiu` impossível → `repetiu` com aviso "faltam anilhas de 10 kg (marco do guia)" |

Regras derivadas dos casos:
- `alcancavel_para_baixo(x, implemento)` é aplicada em toda carga calculada (subida, −10 %, 60 %).
- Incremento reduzido = `max(incremento / 2, passo_minimo)`; quando a redução cai no passo mínimo, a exigência para subir passa a ser "topo da faixa + 1 rep em todas as séries". Volta ao incremento normal na próxima subida.
- Mudança de degrau de assistência dá 2 sessões de graça (quedas de reps não contam como falha).
- `maximo`: sucesso = média ≥ média anterior + 1 e nenhuma série menor que a anterior correspondente.
- Unilateral: vale o menor dos dois lados em cada série.
