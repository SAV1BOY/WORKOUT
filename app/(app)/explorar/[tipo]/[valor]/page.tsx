import { notFound } from "next/navigation";
import { TelaColecao } from "@/components/colecoes/tela-colecao";
import { colecaoDaRota, hrefDaColecao, todasAsColecoes } from "@/lib/colecoes";

/**
 * A tela de uma coleção derivada (SPEC §14.4). As coleções saem dos JSON, então
 * a lista é conhecida no build: cada uma vira uma página estática.
 */
export function generateStaticParams() {
  return todasAsColecoes().map((c) => {
    const [tipo = "", valor = ""] = hrefDaColecao(c).split("/").slice(2);
    return { tipo, valor };
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tipo: string; valor: string }>;
}) {
  const { tipo, valor } = await params;
  const colecao = colecaoDaRota(tipo, valor);
  return {
    title: colecao ? `${colecao.titulo} — Treino do Terraço` : "Treino do Terraço",
  };
}

export default async function Colecao({
  params,
}: {
  params: Promise<{ tipo: string; valor: string }>;
}) {
  const { tipo, valor } = await params;
  const colecao = colecaoDaRota(tipo, valor);
  if (!colecao) notFound();
  return <TelaColecao colecao={colecao} />;
}
