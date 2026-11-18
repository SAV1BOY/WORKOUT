import { EsqueletoGrade3 } from "@/components/carregando";

export default function CarregandoRelatorio() {
  return (
    <section role="status" aria-label="Carregando o relatório" className="flex flex-col gap-3">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-semibold tracking-tight">Relatório</h1>
        <p className="text-muted-foreground text-sm text-balance">O que já foi feito e para onde a carga está indo.</p>
      </header>
      <div className="cartao border-border bg-card border">
        <div className="border-border flex flex-col gap-0.5 border-b py-2.5 pr-10 pl-3">
          <h2 className="text-base font-semibold">Resumo</h2>
          <span className="text-muted-foreground text-xs text-balance">Os acumulados de sempre e os números do período.</span>
        </div>
        <div className="px-2 py-3"><EsqueletoGrade3 /></div>
      </div>
    </section>
  );
}
