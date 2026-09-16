import { TelaRelatorio } from "@/components/relatorio/tela-relatorio";

export const metadata = { title: "Relatório — Treino do Terraço" };
export const dynamic = "force-dynamic";

/**
 * `/relatorio` (SPEC §13.5 e §14.4) substitui `/progresso`, que redireciona
 * para cá: contadores, histórico, sequências, Peso e IMC, e abaixo os gráficos
 * e recordes da §3.7.
 */
export default function Relatorio() {
  return <TelaRelatorio />;
}
