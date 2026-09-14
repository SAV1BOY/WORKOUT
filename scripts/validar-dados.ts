/**
 * npm run validar — confere data/*.json e os assets referenciados.
 * Roda antes do build (prebuild). Sai com código != 0 e mensagem clara.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  cardioSchema,
  equipamentosSchema,
  exerciciosSchema,
  perfilSchema,
  programaSchema,
  progressaoJsonSchema,
  type Exercicio,
  type Programa,
} from "../lib/schemas";
import type { ZodType } from "zod";

const raiz = process.cwd();
const erros: string[] = [];

function ler(arquivo: string): unknown {
  const caminho = join(raiz, "data", arquivo);
  if (!existsSync(caminho)) {
    erros.push(`data/${arquivo} não existe`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(caminho, "utf8"));
  } catch (e) {
    erros.push(`data/${arquivo} não é JSON válido: ${(e as Error).message}`);
    return null;
  }
}

function validar<T>(schema: ZodType<T>, arquivo: string): T | null {
  const bruto = ler(arquivo);
  if (bruto === null) return null;
  const r = schema.safeParse(bruto);
  if (!r.success) {
    for (const issue of r.error.issues.slice(0, 10)) {
      erros.push(`data/${arquivo} → ${issue.path.join(".")}: ${issue.message}`);
    }
    return null;
  }
  return r.data;
}

const exercicios = validar(exerciciosSchema, "exercicios.json");
const programa = validar(programaSchema, "programa.json");
validar(cardioSchema, "cardio.json");
validar(progressaoJsonSchema, "progressao.json");
validar(equipamentosSchema, "equipamentos.json");
validar(perfilSchema, "perfil.json");

function conferirReferencias(exs: Exercicio[], prog: Programa) {
  const porId = new Map(exs.map((e) => [e.id, e]));

  // todo exercicio_id do programa existe no catálogo
  for (const [treinoId, treino] of Object.entries(prog.treinos)) {
    for (const item of treino.exercicios) {
      if (!porId.has(item.exercicio_id)) {
        erros.push(
          `programa.json → treino ${treinoId}: exercício "${item.exercicio_id}" não existe em exercicios.json`,
        );
      }
    }
  }

  // toda figura/foto referenciada existe em assets/
  const figurasUsadas = new Set<string>();
  const fotosUsadas = new Set<string>();
  for (const e of exs) {
    if (e.figura) {
      figurasUsadas.add(e.figura.split("/").pop() ?? "");
      if (!existsSync(join(raiz, e.figura))) {
        erros.push(`${e.id}: figura ausente em ${e.figura}`);
      }
    }
    for (const foto of e.fotos) {
      fotosUsadas.add(foto.split("/").pop() ?? "");
      if (!existsSync(join(raiz, foto))) {
        erros.push(`${e.id}: foto ausente em ${foto}`);
      }
    }
  }

  // nenhum asset sobrando (todo svg/jpg está referenciado)
  const svgs = readdirSync(join(raiz, "assets", "figuras")).filter((f) =>
    f.endsWith(".svg"),
  );
  const jpgs = readdirSync(join(raiz, "assets", "fotos")).filter((f) =>
    f.endsWith(".jpg"),
  );
  for (const f of svgs) {
    if (!figurasUsadas.has(f)) erros.push(`assets/figuras/${f} não é usado`);
  }
  for (const f of jpgs) {
    if (!fotosUsadas.has(f)) erros.push(`assets/fotos/${f} não é usado`);
  }

  console.log(
    `  ${exs.length} exercícios · ${figurasUsadas.size}/${svgs.length} figuras · ${fotosUsadas.size}/${jpgs.length} fotos`,
  );
}

if (exercicios && programa) conferirReferencias(exercicios, programa);

// assets fixos que o app usa direto (sprite do mapa muscular)
for (const arquivo of [
  "assets/mapa-muscular/corpo-sprite.svg",
  "assets/mapa-muscular/musculos.css",
]) {
  if (!existsSync(join(raiz, arquivo))) erros.push(`${arquivo} não existe`);
}

if (erros.length > 0) {
  console.error(`\n✗ ${erros.length} problema(s) nos dados:\n`);
  for (const e of erros.slice(0, 40)) console.error(`  - ${e}`);
  if (erros.length > 40) console.error(`  … e mais ${erros.length - 40}`);
  process.exit(1);
}

console.log("✓ dados e assets conferidos");
