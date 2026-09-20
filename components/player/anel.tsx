import { cn } from "@/lib/utils";

/**
 * O anel de contagem da preparação e do descanso (SPEC §14.1.1), em SVG puro —
 * nenhuma biblioteca nova. `fracao` é o que ainda falta (1 → 0).
 *
 * O anel é decorativo: quem anuncia o tempo é o número no meio, que fica no
 * fluxo do texto e é lido pelo leitor de tela.
 */
export function AnelDeContagem({
  fracao,
  tamanho = 220,
  espessura = 10,
  children,
  className,
  classeTrilho = "stroke-muted",
  classeArco = "stroke-primary",
}: {
  fracao: number;
  tamanho?: number;
  espessura?: number;
  children?: React.ReactNode;
  className?: string;
  /**
   * SPEC §22.5 item 8: o descanso é tela cheia com fundo próprio, onde
   * `--muted` e `--primary` não existem como contraste. Quem chama diz as
   * duas cores do anel; o padrão continua o da preparação.
   */
  classeTrilho?: string;
  classeArco?: string;
}) {
  const raio = (tamanho - espessura) / 2;
  const volta = 2 * Math.PI * raio;
  const preso = Math.min(1, Math.max(0, fracao));

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: tamanho, height: tamanho }}
    >
      <svg
        aria-hidden="true"
        width={tamanho}
        height={tamanho}
        viewBox={`0 0 ${tamanho} ${tamanho}`}
        className="-rotate-90"
      >
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          strokeWidth={espessura}
          className={classeTrilho}
        />
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={volta}
          strokeDashoffset={volta * (1 - preso)}
          className={cn(
            "transition-[stroke-dashoffset] duration-200 ease-linear",
            classeArco,
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        {children}
      </div>
    </div>
  );
}
