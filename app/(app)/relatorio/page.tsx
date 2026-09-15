import { TelaProgresso } from "@/components/progresso/tela-progresso";

export const metadata = { title: "Relatório — Treino do Terraço" };
export const dynamic = "force-dynamic";

/**
 * `/relatorio` (SPEC §13.5) substitui `/progresso`, que redireciona para cá.
 * O marco V1 traz a tela de progresso inteira (cards, gráficos e recordes);
 * contadores, histórico, sequências e IMC entram no marco V2.
 */
export default function Relatorio() {
  return <TelaProgresso />;
}
