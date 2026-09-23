/**
 * Schemas zod de tudo que vem de data/*.json.
 * Os JSON são a fonte da verdade: aqui só se descreve o formato,
 * nunca o conteúdo (exercícios, séries, regras ou textos).
 */
import { z } from "zod";

/* ---------------------------------------------------------------- enums */

export const grupoSchema = z.enum([
  "Peito",
  "Costas",
  "Ombros",
  "Bíceps",
  "Tríceps",
  "Pernas",
  "Core",
  "Cardio",
]);

export const origemSchema = z.enum(["guia", "aparelho"]);

export const subgrupoSchema = z.enum(["tatame", "corda", "band"]);

export const musculoSchema = z.enum([
  "trapezio",
  "ombro",
  "ombrop",
  "peito",
  "biceps",
  "triceps",
  "antebraco",
  "dorsal",
  "abdomen",
  "obliquo",
  "lombar",
  "gluteo",
  "quadriceps",
  "posterior",
  "adutor",
  "panturrilha",
]);

export const equipamentoTagSchema = z.enum([
  "anilhas",
  "banco",
  "barra-macica",
  "barra-w",
  "halteres",
  "cavalete",
  "barra-fixa",
  "cross-over",
  "puxadores",
  "tatame",
  "corda",
  "super-band",
]);

export const implementoSchema = z.enum([
  "barra_macica",
  "halteres",
  "barra_w",
  "polia",
  "barra_fixa",
  "peso_corporal",
  "anilha",
  "corda",
  "band",
]);

export const categoriaSchema = z.enum([
  "composto_pesado",
  "composto_moderado",
  "isolamento",
  "core_peso_corporal",
]);

export const prescricaoTipoSchema = z.enum([
  "reps",
  "tempo_s",
  "passos",
  "maximo",
  "ver_cardio_corda",
]);

export const progressaoTipoSchema = z.enum([
  "carga",
  "reps",
  "tempo",
  "assistencia",
  "reps_depois_lastro",
  "plano_corda",
]);

export const assistenciaSchema = z.enum([
  "pe_inteiro",
  "joelho",
  "joelho_dobrado",
  "sem",
]);

export const faseIdSchema = z.enum(["fase1", "fase2"]);

export const treinoIdSchema = z.enum(["A1", "B1", "SA", "IA", "SB", "IB"]);

export const diaSemanaSchema = z.enum([
  "seg",
  "ter",
  "qua",
  "qui",
  "sex",
  "sab",
  "dom",
]);

export const tipoDiaSchema = z.enum(["forca", "cardio", "descanso"]);

/* ----------------------------------------------------------- exercicios */

export const prescricaoSchema = z.object({
  series: z.number().int().positive().nullable(),
  tipo: prescricaoTipoSchema,
  min: z.number().nullable(),
  max: z.number().nullable(),
  unilateral: z.boolean(),
  texto: z.string(),
  descanso_s: z.number().int().nonnegative(),
});

export const cargaInicialSchema = z.object({
  kg: z.number().nonnegative(),
  nota: z.string(),
});

export const progressaoExercicioSchema = z.object({
  tipo: progressaoTipoSchema,
  incremento_kg: z.number().optional(),
  incremento_reps: z.number().optional(),
  incremento_s: z.number().optional(),
  regra: z.string(),
});

export const exercicioSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  grupo: grupoSchema,
  origem: origemSchema,
  subgrupo: subgrupoSchema.nullable(),
  musculos_primarios: z.array(musculoSchema),
  musculos_secundarios: z.array(musculoSchema),
  musculos_primarios_nome: z.array(z.string()),
  musculos_secundarios_nome: z.array(z.string()),
  equipamento_texto: z.string(),
  equipamento: z.array(equipamentoTagSchema),
  implemento: implementoSchema,
  montagem: z.string(),
  passos: z.array(z.string()).min(1),
  erro_comum: z.string(),
  prescricao_padrao: prescricaoSchema,
  categoria: categoriaSchema,
  carga_inicial: cargaInicialSchema,
  progressao: progressaoExercicioSchema,
  figura: z.string().nullable(),
  figura_animada: z.boolean(),
  fotos: z.array(z.string()),
  foto_fonte_id: z.string(),
});

export const exerciciosSchema = z.array(exercicioSchema).min(1);

/* -------------------------------------------------------------- programa */

export const diaProgramaSchema = z.object({
  dia: diaSemanaSchema,
  tipo: tipoDiaSchema,
  treino: z.union([treinoIdSchema, z.literal("alternar")]).optional(),
  sessao: z.string().optional(),
  min: z.number().int().positive().optional(),
  nota: z.string().optional(),
});

export const faseSchema = z.object({
  id: faseIdSchema,
  nome: z.string(),
  periodo: z.string(),
  frequencia_forca: z.number().int().positive(),
  treinos: z.array(treinoIdSchema).min(1),
  alternancia: z.string(),
  semana: z.array(diaProgramaSchema).length(7),
  total_semana: z.string(),
  quando_mudar: z.string(),
});

export const repsProgramaSchema = z.object({
  tipo: prescricaoTipoSchema,
  min: z.number().nullable(),
  max: z.number().nullable(),
  texto: z.string(),
});

export const exercicioDoTreinoSchema = z.object({
  exercicio_id: z.string().min(1),
  nome: z.string(),
  series: z.number().int().positive(),
  reps: repsProgramaSchema,
  descanso_s: z.number().int().nonnegative(),
  descanso_texto: z.string(),
  transicao_s: z.number().int().nonnegative(),
  tempo_min: z.number().positive(),
});

export const treinoSchema = z.object({
  id: treinoIdSchema,
  nome: z.string(),
  foco: z.string(),
  subtitulo: z.string(),
  exercicios: z.array(exercicioDoTreinoSchema).min(1),
  duracao_min: z.number().positive(),
  aquecimento: z.string(),
});

export const programaSchema = z.object({
  inicio: z.string(),
  fase_inicial: faseIdSchema,
  semana_comeca: z.string(),
  fases: z.array(faseSchema).min(1),
  treinos: z.record(treinoIdSchema, treinoSchema),
  semana_curta: z.object({ regra: z.string() }),
  aquecimento: z.string(),
  seguranca: z.array(z.string()),
});

/* ---------------------------------------------------------------- cardio */

export const blocoCorridaSchema = z.object({
  corrida_min: z.number().positive(),
  caminhada_min: z.number().nonnegative(),
});

export const semanaCorridaSchema = z.object({
  semana: z.number().int().positive(),
  descricao: z.string(),
  aquecimento_min: z.number().nonnegative(),
  soltura_min: z.number().nonnegative(),
  blocos: z.array(blocoCorridaSchema).min(1),
  corrida_min: z.number().positive(),
  km_corridos: z.number().nonnegative(),
  km_total: z.number().nonnegative(),
  sessao_min: z.number().positive(),
  pace_alvo: z.string(),
});

export const estagioCordaSchema = z.object({
  semanas: z.string(),
  blocos: z.number().int().positive(),
  bloco_s: z.number().int().positive(),
  descanso_s: z.number().int().nonnegative(),
  corda_total_min: z.number().positive(),
  saltos_aprox: z.number().int().positive(),
  sessao_min: z.number().positive(),
});

export const semanaBarraFixaSchema = z.object({
  semanas: z.string(),
  assistencia: z.string(),
  por_sessao: z.string(),
  // número na maioria das semanas, faixa em texto ("25–45") na última
  reps_semana: z.union([z.number().int().positive(), z.string()]),
  treina: z.string(),
});

export const cardioSchema = z.object({
  corrida: z.object({
    objetivo: z.string(),
    sessoes_por_semana: z.number().int().positive(),
    regra_dia: z.string(),
    semanas: z.array(semanaCorridaSchema).min(1),
    regras: z.array(z.string()),
  }),
  corda: z.object({
    funcoes: z.array(z.string()),
    semanas: z.array(estagioCordaSchema).min(1),
    ajustes: z.array(z.string()),
  }),
  barra_fixa: z.object({
    objetivo: z.string(),
    sessoes_por_semana: z.number().int().positive(),
    regra: z.string(),
    semanas: z.array(semanaBarraFixaSchema).min(1),
    grease_the_groove: z.string(),
  }),
  esforco: z.object({
    teste_da_fala: z.array(
      z.object({
        nivel: z.string(),
        consegue: z.string(),
        onde: z.string(),
      }),
    ),
  }),
  ordem: z.array(z.string()),
});

/* ------------------------------------------------------------ progressao */

export const progressaoJsonSchema = z.object({
  principio: z.string(),
  incrementos: z.array(
    z.object({
      exercicios: z.string(),
      incremento: z.string(),
      anilhas: z.string(),
    }),
  ),
  carga_inicial: z.string(),
  falhas: z.array(z.object({ situacao: z.string(), acao: z.string() })),
  faixas: z.array(
    z.object({
      tipo: categoriaSchema,
      exemplos: z.string(),
      reps: z.string(),
      descanso: z.string(),
      entre_exercicios: z.string(),
    }),
  ),
  marcos: z.array(z.string()),
  /*
   * Os textos que o motor sugere no fim da sessão (SPEC §6.3 e §6.6). O motor
   * devolve só a chave e os números; quem monta a frase é `lib/dados.ts`
   * (`textoDoMotor`), para que o conteúdo continue morando no JSON.
   * `{reps}` e `{kg}` são trocados pelos valores da decisão.
   */
  sugestoes: z.object({
    anilha_no_core: z.string().min(1),
    barra_fixa_com_lastro: z.string().min(1),
    sem_elastico_lastro: z.string().min(1),
    sem_elastico_variacao: z.string().min(1),
    tempo_acima_da_faixa: z.string().min(1),
    incremento_curto: z.string().min(1),
  }),
  /** Avisos do teto do kit (SPEC §6.4), na mesma convenção das sugestões. */
  avisos: z.object({
    teto_anilhas: z.string().min(1),
    teto_capacidade: z.string().min(1),
  }),
});

/* ---------------------------------------------------------- equipamentos */

export const anilhaSchema = z.object({
  kg: z.number().positive(),
  qtd: z.number().int().positive(),
  diametro_mm: z.number().int().positive(),
});

export const barraSchema = z.object({
  id: z.string(),
  nome: z.string(),
  peso_kg: z.number().positive().nullable(),
  diametro_mm: z.number().int().positive().optional(),
  capacidade_kg: z.number().positive(),
  uso: z.string(),
});

export const equipamentosSchema = z.object({
  anilhas: z.object({
    total_kg: z.number().positive(),
    furo_mm: z.number().positive(),
    pecas: z.array(anilhaSchema).min(1),
    nota: z.string(),
  }),
  barras: z.array(barraSchema).min(1),
  presilhas: z.number().int().nonnegative(),
  itens: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      /*
       * O nome da vitrine do Explorar (SPEC §22.12 item 2): sem marca nem
       * medida ("Tatame EVA", não "Tatame EVA 20 mm"). Sem ele, vale `nome`.
       */
      nome_curto: z.string().min(1).optional(),
      specs: z.string(),
      fotos: z.string(),
    }),
  ),
  /*
   * As 95 fotos de `assets/itens/` são fotografia de terceiro (anúncio do
   * produto), não obra de licença livre: elas NÃO passam pelas condições da
   * §15.1 e por isso a procedência delas mora aqui, no JSON, e a §15.3 escreve
   * a exceção — inventário particular, atrás de login, fora das capas.
   */
  fotos_dos_itens: z.object({
    pasta: z.string(),
    origem: z.string(),
    licenca: z.string().nullable(),
    uso: z.string(),
  }),
  espaco: z.object({
    local: z.string(),
    parede_fundo_m: z.number().positive(),
    parede_esquerda_m: z.number().positive(),
    viga_m: z.number().positive(),
    layout: z.string(),
  }),
  faltam: z.array(z.string()),
});

/* -------------------------------------------------------------- tutoriais */

/**
 * Um tutorial do YouTube por exercício (SPEC §14.2). O `youtube_id` tem
 * exatamente 11 caracteres do alfabeto de ids do YouTube — a miniatura e o
 * embed são montados a partir dele, então um id torto vira URL quebrada.
 */
export const tutorialSchema = z.object({
  exercicio_id: z.string().min(1),
  youtube_id: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  titulo: z.string().min(1),
  canal: z.string().min(1),
  idioma: z.string().min(2),
  url: z.string().url(),
  /** Duração em segundos, quando se sabe. */
  duracao: z.number().positive().nullable(),
  nota: z.string().optional(),
});

export const tutoriaisSchema = z.object({
  gerado_em: z.string().min(1),
  criterio: z.string().min(1),
  tutoriais: z.array(tutorialSchema),
});

/* ------------------------------------------------------------ ilustrações */

/**
 * Uma ilustração de exercício com licença livre (marco Mídia): as duas
 * posições do movimento, o autor e a licença. O crédito é obrigatório — é o
 * que a CC BY-SA exige e o que a tela Mais → Créditos mostra. Sem autor e
 * licença a entrada não existe: `scripts/importar-ilustracoes.ts` deixa o
 * exercício de fora e ele segue com a figura animada do kit.
 */
export const arquivoDeIlustracaoSchema = z.object({
  /** Caminho a partir da raiz: `assets/ilustracoes/<id>-1.webp`. */
  arquivo: z.string().regex(/^assets\/ilustracoes\/[\w.-]+\.(webp|svg)$/),
  largura: z.number().int().positive(),
  altura: z.number().int().positive(),
});

export const ilustracaoSchema = z.object({
  exercicio_id: z.string().min(1),
  fonte: z.enum(["everkinetic", "wger"]),
  correspondencia: z.enum(["exata", "aproximada"]),
  /** Posição 1 (início) e, quando existe, posição 2 (fim). */
  arquivos: z.array(arquivoDeIlustracaoSchema).min(1).max(2),
  autor: z.string().min(1),
  licenca: z.string().min(1),
  url_fonte: z.string().url(),
  titulo_fonte: z.string().min(1),
  nota: z.string(),
});

export const ilustracoesSchema = z.array(ilustracaoSchema);

/* ------------------------------------------------------- medidas da foto */

/**
 * `data/medidas-de-foto.json` (SPEC §22.4 item 3): a medida **medida** de cada
 * foto de execução do kit e da derivada WebP que as telas pedem. O arquivo é
 * gerado por `npm run assets` — quem abre as imagens com o sharp é
 * `scripts/copiar-assets.ts` — e `lib/medidas-de-foto.test.ts` confere foto
 * por foto. Ninguém escreve medida à mão: as fotos do kit não são uniformes
 * (auditoria do lote 4).
 */
export const parDeMedidasSchema = z.tuple([
  z.number().int().positive(),
  z.number().int().positive(),
]);

export const medidaDeFotoSchema = z.object({
  /** O JPEG de `assets/fotos/<nome>.jpg`, que é a reserva do `onError`. */
  kit: parDeMedidasSchema,
  /** A derivada `public/fotos/<nome>.webp` — o arquivo que a `<img>` pede. */
  webp: parDeMedidasSchema,
});

export const medidasDeFotoSchema = z.object({
  gerado_por: z.string().min(1),
  formato: z.string().min(1),
  fotos: z.record(z.string().regex(/^[\w-]+$/), medidaDeFotoSchema),
});

/* ---------------------------------------------------------------- perfil */

/** As colunas de `body_measurements` que a tela preenche (SPEC §3.8). */
export const campoDeMedidaSchema = z.enum([
  "peito_cm",
  "cintura_cm",
  "quadril_cm",
  "braco_dir_cm",
  "braco_esq_cm",
  "coxa_dir_cm",
  "coxa_esq_cm",
  "panturrilha_cm",
]);

export const perfilSchema = z.object({
  nome: z.string().min(1),
  altura_cm: z.number().positive(),
  nivel: z.string(),
  treina: z.string(),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fase_inicial: faseIdSchema,
  primeiro_treino: treinoIdSchema,
  objetivo_principal: z.string(),
  objetivos_secundarios: z.array(z.string()),
  corpo: z.object({
    peso_kg: z.number().positive().nullable(),
    medidas_cm: z.record(z.string(), z.number().positive().nullable()),
    nota: z.string(),
  }),
  preferencias: z.object({
    idioma: z.string(),
    unidades: z.string(),
    semana_comeca: z.string(),
    registro_por_serie: z.boolean(),
    tema: z.string(),
  }),
  /**
   * As 8 medidas de `body_measurements` (SPEC §3.8) com o nome na tela e onde
   * passar a fita — a microcópia do formulário mora aqui, não no código.
   */
  medidas: z
    .array(
      z.object({
        campo: campoDeMedidaSchema,
        nome: z.string().min(1),
        onde: z.string().min(1),
      }),
    )
    .length(8),
});

/* ----------------------------------------------------------------- tipos */

export type Grupo = z.infer<typeof grupoSchema>;
export type Subgrupo = z.infer<typeof subgrupoSchema>;
export type Musculo = z.infer<typeof musculoSchema>;
export type EquipamentoTag = z.infer<typeof equipamentoTagSchema>;
export type Implemento = z.infer<typeof implementoSchema>;
export type Categoria = z.infer<typeof categoriaSchema>;
export type PrescricaoTipo = z.infer<typeof prescricaoTipoSchema>;
export type ProgressaoTipo = z.infer<typeof progressaoTipoSchema>;
export type Assistencia = z.infer<typeof assistenciaSchema>;
export type FaseId = z.infer<typeof faseIdSchema>;
export type TreinoId = z.infer<typeof treinoIdSchema>;
export type DiaSemana = z.infer<typeof diaSemanaSchema>;
export type TipoDia = z.infer<typeof tipoDiaSchema>;
export type Prescricao = z.infer<typeof prescricaoSchema>;
export type Exercicio = z.infer<typeof exercicioSchema>;
export type Programa = z.infer<typeof programaSchema>;
export type Fase = z.infer<typeof faseSchema>;
export type DiaPrograma = z.infer<typeof diaProgramaSchema>;
export type Treino = z.infer<typeof treinoSchema>;
export type ExercicioDoTreino = z.infer<typeof exercicioDoTreinoSchema>;
export type Cardio = z.infer<typeof cardioSchema>;
export type SemanaCorrida = z.infer<typeof semanaCorridaSchema>;
export type EstagioCorda = z.infer<typeof estagioCordaSchema>;
export type SemanaBarraFixa = z.infer<typeof semanaBarraFixaSchema>;
export type ProgressaoJson = z.infer<typeof progressaoJsonSchema>;
export type Equipamentos = z.infer<typeof equipamentosSchema>;
export type Anilha = z.infer<typeof anilhaSchema>;
export type Barra = z.infer<typeof barraSchema>;
export type Perfil = z.infer<typeof perfilSchema>;
export type CampoDeMedida = z.infer<typeof campoDeMedidaSchema>;
export type Tutorial = z.infer<typeof tutorialSchema>;
export type Tutoriais = z.infer<typeof tutoriaisSchema>;
export type Ilustracao = z.infer<typeof ilustracaoSchema>;
export type ArquivoDeIlustracao = z.infer<typeof arquivoDeIlustracaoSchema>;
export type MedidaDeFoto = z.infer<typeof medidaDeFotoSchema>;
export type MedidasDeFoto = z.infer<typeof medidasDeFotoSchema>;
export type MedidaDoCorpo = Perfil["medidas"][number];
/** Chave de um texto do motor em `data/progressao.json` (SPEC §6.3/§6.4). */
export type ChaveDeSugestao = keyof ProgressaoJson["sugestoes"];
export type ChaveDeAviso = keyof ProgressaoJson["avisos"];

/**
 * O que o motor devolve no lugar de uma frase: a chave do texto no JSON e os
 * números que entram nela. Quem monta a frase é `textoDoMotor` (lib/dados.ts),
 * então o motor continua puro e o texto continua sendo conteúdo.
 */
export interface RefDeTexto<C extends string = ChaveDeSugestao | ChaveDeAviso> {
  chave: C;
  dados?: Readonly<Record<string, number | string>>;
}

/* ------------------------------------------------ lembretes (SPEC §23.2) */

/**
 * Uma linha de `public.lembretes_inscricoes` como o app a lê e grava (o
 * `user_id` quem põe é a sessão; a RLS confere). A mesma forma que o mock
 * (`scripts/mock-supabase.ts`) conhece.
 */
export const inscricaoLembreteSchema = z.object({
  id: z.string().min(1),
  endpoint: z.string().regex(/^https?:\/\/\S+$/),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  aparelho: z.string(),
  criado_em: z.string(),
});
export type InscricaoLembrete = z.infer<typeof inscricaoLembreteSchema>;
