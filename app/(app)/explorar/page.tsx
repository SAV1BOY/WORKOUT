import { TelaExplorar } from "@/components/explorar/tela-explorar";

export const metadata = { title: "Explorar — Treino do Terraço" };
export const dynamic = "force-dynamic";

/**
 * `/explorar` (SPEC §13.4 e §14.4): busca, destaque, as coleções derivadas dos
 * JSON e o catálogo dos 81.
 */
export default function Explorar() {
  return <TelaExplorar />;
}
