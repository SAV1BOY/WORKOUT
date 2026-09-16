import { permanentRedirect } from "next/navigation";

/** SPEC §13.2: Progresso virou Relatório; o endereço antigo continua valendo. */
export default function Progresso() {
  permanentRedirect("/relatorio");
}
