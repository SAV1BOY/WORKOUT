"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { DetalhePorSessao, FolhaDasSeries } from "@/components/relatorio/detalhe-das-series";
import { formatarDataCompleta, formatarKm, formatarMinutos, horaDeInicio } from "@/lib/formato";
import { NOME_DO_CARDIO, tituloDaSessao } from "@/lib/relatorio";
import type { RegistroDoDia } from "@/lib/semana";

function apresentar(registro: RegistroDoDia) {
  if (registro.tipo === "forca") {
    const sessao = registro.sessao;
    const minutos = typeof sessao.duracao_s === "number" ? formatarMinutos(sessao.duracao_s / 60) : null;
    return {
      titulo: tituloDaSessao(sessao),
      acao: sessao.status === "em_andamento" ? "Retomar" : "Ver séries de",
      detalhe: [horaDeInicio(sessao.iniciada_em), minutos].filter(Boolean).join(" · "),
    };
  }
  const cardio = registro.sessao;
  return {
    titulo: NOME_DO_CARDIO[cardio.tipo],
    acao: "Abrir",
    detalhe: [
      typeof cardio.duracao_min === "number" ? formatarMinutos(cardio.duracao_min) : null,
      typeof cardio.distancia_km === "number" ? formatarKm(cardio.distancia_km) : null,
    ].filter(Boolean).join(" · "),
  };
}

const classeDaAcao = "alvo foco hover:bg-muted/50 flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left";

export function RegistrosDoDia({ conta, registros }: { conta: string; registros: readonly RegistroDoDia[] }) {
  // Com nomes e medidas iguais, o número distingue o registro também para o leitor de tela.
  const repeticoes = new Map<string, number>();
  const linhas = registros.map(registro => {
    const { titulo, detalhe, acao } = apresentar(registro);
    const chave = JSON.stringify([titulo, detalhe]);
    const posicao = (repeticoes.get(chave) ?? 0) + 1;
    repeticoes.set(chave, posicao);
    return { registro, titulo, detalhe, acao, chave, posicao };
  });
  return (
    <ul aria-label="Atividades registradas" className="divide-border border-border min-w-0 divide-y rounded-lg border px-1">
      {linhas.map(({ registro, titulo, detalhe, acao, chave, posicao }) => {
        const total = repeticoes.get(chave)!;
        const contexto = [detalhe, total > 1 && `Registro ${posicao} de ${total}`].filter(Boolean).join(" · ");
        const descricao = [titulo, contexto].filter(Boolean).join(" · ");
        const soCardio = registros.length === 1 && registro.tipo === "cardio";
        const aberta = registro.tipo === "forca" && registro.sessao.status === "em_andamento";
        const nome = soCardio ? "Abrir o cardio" : `${acao} ${descricao}`;
        const texto = aberta ? `Retomar ${titulo}` : titulo;
        const detalheId = `atividade-${registro.tipo}-${registro.sessao.id}`;
        const miolo = (
          <>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 wrap-anywhere">
              <span className="text-sm font-medium">{soCardio ? "Abrir o cardio" : texto}</span>
              {(soCardio || contexto) && (
                <span id={detalheId} className="numero text-muted-foreground text-xs">{soCardio ? descricao : contexto}</span>
              )}
            </span>
            <ChevronRight aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
          </>
        );
        const id = encodeURIComponent(registro.sessao.id);
        return (
          <li key={registro.tipo + ":" + registro.sessao.id} className="min-w-0">
            {registro.tipo === "forca" && registro.sessao.status === "concluida" ? (
              <FolhaDasSeries descricao={`${descricao} · ${formatarDataCompleta(registro.sessao.data)}`}
                gatilho={<button type="button" className={classeDaAcao} aria-label={nome}>{miolo}</button>}>
                <DetalhePorSessao sessao={registro.sessao} conta={conta} mostrarNota />
              </FolhaDasSeries>
            ) : (
              <Link className={classeDaAcao} aria-label={nome} aria-describedby={soCardio ? detalheId : undefined}
                href={registro.tipo === "cardio" ? `/cardio/${registro.sessao.tipo}?sessao=${id}` : `/treinar/${id}`}>
                {miolo}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
