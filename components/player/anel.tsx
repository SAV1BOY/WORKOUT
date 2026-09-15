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
}: {
  fracao: number;
  tamanho?: number;
  espessura?: number;
  children?: React.ReactNode;
  className?: string;
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
          className="stroke-muted"
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
          className="stroke-primary transition-[stroke-dashoffset] duration-200 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        {children}
      </div>
    </div>
  );
}
