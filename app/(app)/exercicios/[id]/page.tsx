import { notFound } from "next/navigation";
import { VoltarDaFicha } from "@/components/exercicio/acoes-da-ficha";
import { ConteudoDaFicha } from "@/components/exercicio/ficha-folha";
import { exercicioPorId, exercicios } from "@/lib/dados";
import { idsComVideo } from "@/lib/videos";

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
 * `/exercicios/[id]` (SPEC §3.6 e §14.2): a mesma ficha da folha, em página
 * inteira. Tudo que está escrito aqui vem de `data/exercicios.json` e de
 * `data/tutoriais.json`; o histórico (embaixo) é do banco. "Voltar" no topo e
 * "Fazer agora" no fim (SPEC §22.14 item 1).
 */
export default async function FichaExercicio({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exercicio = exercicioPorId.get(id);
  if (!exercicio) notFound();

  /*
   * SPEC §13.1: vídeo é opcional e nenhum vem no kit. A lista sai de
   * `public/videos` no build destas 81 páginas estáticas — quem largar um
   * `assets/videos/<id>.mp4` roda `npm run assets` e o build seguinte o mostra.
   */
  const comVideo = idsComVideo().includes(exercicio.id);

  return (
    <article className="flex flex-col gap-4">
      <VoltarDaFicha />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {exercicio.nome}
        </h1>
        <p className="text-muted-foreground text-sm">
          {exercicio.grupo} · {exercicio.equipamento_texto}
        </p>
      </header>

      <ConteudoDaFicha exercicioId={exercicio.id} temVideo={comVideo} comoPagina />
    </article>
  );
}
