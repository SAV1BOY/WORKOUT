import { notFound } from "next/navigation";
import { FotosAmpliaveis } from "@/components/exercicios/fotos-ampliaveis";
import { HistoricoExercicio } from "@/components/exercicios/historico-exercicio";
import { FiguraExercicio } from "@/components/exercicio/midia";
import { MapaMuscular } from "@/components/mapa-muscular";
import { Badge } from "@/components/ui/badge";
import { NOME_EQUIPAMENTO, treinosDoExercicio } from "@/lib/catalogo";
import { acharTreino, exercicioPorId, exercicios, urlFigura } from "@/lib/dados";
import { formatarDescanso, formatarKg, rotuloDaCarga } from "@/lib/formato";

/** As 81 fichas são conteúdo dos JSON: os ids saem do catálogo. */
export function generateStaticParams() {
  return exercicios.map((e) => ({ id: e.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exercicio = exercicioPorId.get(id);
  return { title: `${exercicio?.nome ?? "Exercício"} — Treino do Terraço` };
}

/**
 * `/exercicios/[id]` (SPEC §3.6): a ficha do exercício. Tudo que está escrito
 * aqui vem de `data/exercicios.json`; o histórico (embaixo) é do banco.
 */
export default async function FichaExercicio({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exercicio = exercicioPorId.get(id);
  if (!exercicio) notFound();

  const treinos = treinosDoExercicio(exercicio.id);
  const p = exercicio.prescricao_padrao;

  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {exercicio.nome}
        </h1>
        <p className="text-muted-foreground text-sm">
          {exercicio.grupo} · {exercicio.equipamento_texto}
        </p>
        {treinos.length > 0 ? (
          <p className="flex flex-wrap items-center gap-1">
            {treinos.map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">
                {acharTreino(t).nome}
              </Badge>
            ))}
          </p>
        ) : null}
      </header>

      {urlFigura(exercicio) ? <FiguraExercicio exercicio={exercicio} /> : null}
      <FotosAmpliaveis exercicio={exercicio} />

      <Secao titulo="Músculos">
        <div className="flex items-center gap-3">
          <MapaMuscular
            primarios={exercicio.musculos_primarios}
            secundarios={exercicio.musculos_secundarios}
          />
          <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
            <li>
              <span className="text-foreground font-medium">Principais:</span>{" "}
              {exercicio.musculos_primarios_nome.join(", ") || "—"}
            </li>
            <li>
              <span className="text-foreground font-medium">Ajudam:</span>{" "}
              {exercicio.musculos_secundarios_nome.join(", ") || "—"}
            </li>
          </ul>
        </div>
      </Secao>

      <Secao titulo="Equipamento">
        <p className="text-muted-foreground text-sm">{exercicio.equipamento_texto}</p>
        <ul className="flex flex-wrap gap-1 pt-1">
          {exercicio.equipamento.map((tag) => (
            <li key={tag}>
              <Badge variant="outline" className="text-[10px]">
                {NOME_EQUIPAMENTO[tag]}
              </Badge>
            </li>
          ))}
        </ul>
      </Secao>

      <Secao titulo="Montagem">
        <p className="text-muted-foreground text-sm text-balance">{exercicio.montagem}</p>
      </Secao>

      <Secao titulo="Passos">
        <ol className="text-muted-foreground flex list-decimal flex-col gap-1 pl-5 text-sm">
          {exercicio.passos.map((passo) => (
            <li key={passo}>{passo}</li>
          ))}
        </ol>
      </Secao>

      <section className="border-destructive/40 bg-destructive/5 flex flex-col gap-1 rounded-lg border p-3">
        <h2 className="text-sm font-semibold">Erro comum</h2>
        <p className="text-sm text-balance">{exercicio.erro_comum}</p>
      </section>

      <Secao titulo="Prescrição padrão">
        <p className="numero text-lg">{p.texto}</p>
        <p className="text-muted-foreground text-sm">
          Descanso de {formatarDescanso(p.descanso_s)}
          {p.unilateral ? " · um lado de cada vez" : ""}
        </p>
      </Secao>

      <Secao titulo="Carga inicial">
        <p className="numero text-lg">
          {exercicio.carga_inicial.kg > 0
            ? `${formatarKg(exercicio.carga_inicial.kg)} ${rotuloDaCarga(exercicio.implemento)}`
            : "peso do corpo"}
        </p>
        <p className="text-muted-foreground text-sm text-balance">
          {exercicio.carga_inicial.nota}
        </p>
      </Secao>

      <Secao titulo="Como progredir">
        <p className="text-muted-foreground text-sm text-balance">
          {exercicio.progressao.regra}
        </p>
      </Secao>

      <h2 className="pt-2 text-lg font-semibold">Seu histórico</h2>
      <HistoricoExercicio exercicioId={exercicio.id} />
    </article>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}
