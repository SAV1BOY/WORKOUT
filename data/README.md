# data/ — os dados do app (fonte da verdade)

Todos os arquivos são UTF-8, JSON com indentação, chaves em português sem acento nos nomes de campo. Tudo aqui é conteúdo editorial — se precisar mudar um exercício, uma série ou uma regra, mude aqui —, com uma exceção anotada no fim: `medidas-de-foto.json` é **gerado** por `npm run assets`.

## exercicios.json — lista de 81 exercícios

| Campo | Tipo | Significado |
|---|---|---|
| `id` | string (slug) | identificador estável, usado em `programa.json`, nos nomes das figuras/fotos e no banco (`exercise_id`) |
| `nome` | string | nome em pt-BR como aparece na tela |
| `grupo` | Peito · Costas · Ombros · Bíceps · Tríceps · Pernas · Core · Cardio | seção do catálogo |
| `origem` | `guia` (67, do guia de treino) ou `aparelho` (14, do guia por aparelho: tatame, corda, elástico) | |
| `subgrupo` | `tatame` · `corda` · `band` ou null | só para os 14 de origem `aparelho` |
| `musculos_primarios` / `musculos_secundarios` | arrays de chaves | chaves do mapa muscular: trapezio, ombro, ombrop, peito, biceps, triceps, antebraco, dorsal, abdomen, obliquo, lombar, gluteo, quadriceps, posterior, adutor, panturrilha |
| `musculos_*_nome` | arrays de strings | os mesmos, por extenso |
| `equipamento` | array de tags | anilhas, banco, barra-macica, barra-w, halteres, cavalete, barra-fixa, cross-over, puxadores, tatame, corda, super-band |
| `equipamento_texto` | string | como o guia escreve ("Barra · Banco · Cavalete") |
| `implemento` | barra_macica · halteres · barra_w · polia · barra_fixa · peso_corporal · anilha · corda · band | decide a convenção da carga (barra = total; halteres = por halter; polia = kg no pino) e os passos de incremento |
| `montagem` | string | como preparar (banco, alturas, pegada) |
| `passos` | array de strings | execução, em ordem |
| `erro_comum` | string | o erro típico e por quê |
| `prescricao_padrao` | objeto | `series` (int), `tipo` (reps · tempo_s · passos · maximo · ver_cardio_corda), `min`, `max`, `unilateral` (bool), `texto` (ex. "3 × 8–12"), `descanso_s` |
| `categoria` | composto_pesado · composto_moderado · isolamento · core_peso_corporal | define a faixa de reps/descanso da tabela do guia |
| `carga_inicial` | `{kg, nota}` | com que carga começar na primeira sessão |
| `progressao` | objeto | `tipo` (carga · reps · tempo · assistencia · reps_depois_lastro · plano_corda), `incremento_kg` / `incremento_reps` / `incremento_s`, `regra` (texto) |
| `figura` | caminho ou null | `assets/figuras/<id>.svg` (67 têm) |
| `figura_animada` | bool | se o SVG tem animação SMIL (66) |
| `fotos` | array de 2 caminhos | `assets/fotos/<id>-1.jpg` (início) e `-2.jpg` (fim) |
| `foto_fonte_id` | string | id no free-exercise-db |

Exemplo (resumido):
```json
{
  "id": "supino-reto-com-barra",
  "nome": "Supino reto com barra",
  "grupo": "Peito",
  "musculos_primarios": [
    "peito"
  ],
  "musculos_secundarios": [
    "triceps",
    "ombro"
  ],
  "equipamento": [
    "anilhas",
    "banco",
    "barra-macica",
    "cavalete"
  ],
  "implemento": "barra_macica",
  "prescricao_padrao": {
    "series": 3,
    "tipo": "reps",
    "min": 5,
    "max": 8,
    "unilateral": false,
    "texto": "3 × 5–8",
    "descanso_s": 150
  },
  "categoria": "composto_pesado",
  "carga_inicial": {
    "kg": 7.5,
    "nota": "barra maciça vazia (7,5 kg)"
  },
  "progressao": {
    "tipo": "carga",
    "incremento_kg": 2,
    "regra": "+2 kg (uma anilha de 1 kg em cada lado) quando completar todas as séries no topo da faixa com a última repetição firme."
  },
  "figura": "assets/figuras/supino-reto-com-barra.svg",
  "fotos": [
    "assets/fotos/supino-reto-com-barra-1.jpg",
    "assets/fotos/supino-reto-com-barra-2.jpg"
  ]
}
```

## programa.json
`inicio` (data), `fase_inicial`, `fases[]` (id, nome, período, `frequencia_forca`, `treinos` (ids), `alternancia`, `semana[]` com um objeto por dia — `dia` seg…dom, `tipo` forca/cardio/descanso, `treino` (id ou "alternar"), `sessao` (cardio), `min`, `nota` —, `total_semana`, `quando_mudar`), `treinos{}` (por id: nome, foco, subtítulo, `exercicios[]` com `exercicio_id`, séries, `reps` {tipo, min, max, texto}, `descanso_s`, `descanso_texto`, `transicao_s`, `tempo_min`; `duracao_min`; `aquecimento`), `semana_curta`, `aquecimento`, `seguranca[]`.

## cardio.json
`corrida` (objetivo, `semanas[]` 1–12 com `blocos[]` {corrida_min, caminhada_min}, aquecimento/soltura, km, `sessao_min`, `pace_alvo`, regras), `corda` (`semanas[]` por estágio: blocos, `bloco_s`, `descanso_s`, saltos, `sessao_min`; funções; ajustes), `barra_fixa` (`semanas[]` 1–12: assistência do elástico, `por_sessao`, `reps_semana`, o que treina; `grease_the_groove`), `esforco.teste_da_fala[]`, `ordem[]`.

## progressao.json
`principio`, `incrementos[]` (exercícios, incremento, anilhas), `carga_inicial`, `falhas[]` (situação → ação), `faixas[]` (por categoria: reps, descanso, entre exercícios), `marcos[]`.

## equipamentos.json
`anilhas` (total, furo, `pecas[]` kg/qtd/diâmetro), `barras[]` (id, nome, `peso_kg` — null = ainda não pesada —, capacidade, uso), `presilhas`, `itens[]` (id, nome, specs, pasta de fotos), `espaco` (medidas e layout do terraço), `faltam[]`.

## perfil.json
Dados iniciais do usuário para o seed do perfil: nome, altura, nível, data de início, fase e treino iniciais, objetivos, `corpo` (peso e medidas em null — o app pede), `preferencias`.

## medidas-de-foto.json — gerado, não editar à mão

A medida real de cada foto de execução do kit e da derivada WebP que as telas pedem (SPEC §22.4 item 3). Quem escreve é `npm run assets` (`scripts/copiar-assets.ts`), que já abre cada arquivo com o `sharp` para gerar as derivadas: `<nome>: { "kit": [largura, altura], "webp": [largura, altura] }`.

Existe porque as 162 fotos do kit **não** têm todas a mesma medida — 152 são 850×567, seis são 850×1275 (derivada 800×1200, pelo limite de 1200 px no maior lado) e quatro são 850×569 —, e a `<img>` só reserva a caixa certa se disser o tamanho do arquivo que ela pede. Quem lê na tela é `medidaDaFoto()` (`lib/midia.ts`); `lib/medidas-de-foto.test.ts` confere foto por foto contra os arquivos, e `npm run validar` cobra que nenhuma foto entre ou saia do kit sem o arquivo ser refeito.
