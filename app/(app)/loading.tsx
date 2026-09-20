import { EsqueletoCard } from "@/components/carregando";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * O esqueleto do shell entre uma aba e outra (SPEC §22.4 item 9).
 *
 * Sem ele a troca de aba ficava com a tela do jeito que estava até o servidor
 * responder — no 4G do terraço isso é meio segundo de nada acontecendo, e a
 * segunda batida no ícone da aba era comum. O esqueleto desenha o que toda
 * tela tem: o título e dois cartões. Fica **dentro** do `Miolo`, então herda a
 * folga da barra de 5 abas e não mexe na navegação, que continua no lugar.
 */
export default function CarregandoShell() {
  return (
    <div
      role="status"
      aria-label="Carregando a tela"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <EsqueletoCard linhas={3} />
      <EsqueletoCard linhas={2} />
    </div>
  );
}
