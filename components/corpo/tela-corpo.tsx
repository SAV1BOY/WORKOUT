"use client";

import { AbaFotos } from "@/components/corpo/aba-fotos";
import { AbaMedidas } from "@/components/corpo/aba-medidas";
import { AbaPeso } from "@/components/corpo/aba-peso";
import { Erro, EsqueletoCard } from "@/components/carregando";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFotos, useMedidas, usePesos } from "@/lib/queries/corpo";
import { usePerfil } from "@/lib/queries/dados";
import { useHoje } from "@/lib/relogio";

/** `/corpo` (SPEC §3.8): Peso · Medidas · Fotos. */
export function TelaCorpo({ userId }: { userId: string }) {
  const hoje = useHoje();
  const perfilQ = usePerfil();
  const pesosQ = usePesos();
  const medidasQ = useMedidas();
  const fotosQ = useFotos();

  const erro = perfilQ.error ?? pesosQ.error ?? medidasQ.error ?? fotosQ.error;

  if (erro) {
    return (
      <Tela>
        <Erro
          mensagem={(erro as Error).message}
          aoTentarDeNovo={() => {
            void pesosQ.refetch();
            void medidasQ.refetch();
            void fotosQ.refetch();
          }}
        />
      </Tela>
    );
  }

  if (!hoje || !perfilQ.data) {
    return (
      <Tela>
        <EsqueletoCard linhas={4} />
      </Tela>
    );
  }

  const perfil = perfilQ.data;

  return (
    <Tela>
      <Tabs defaultValue="peso">
        <TabsList className="h-12 w-full">
          <TabsTrigger value="peso" className="alvo">
            Peso
          </TabsTrigger>
          <TabsTrigger value="medidas" className="alvo">
            Medidas
          </TabsTrigger>
          <TabsTrigger value="fotos" className="alvo">
            Fotos
          </TabsTrigger>
        </TabsList>

        {/*
          SPEC §22.2 item 4: cada aba espera a SUA leitura. Antes só o esqueleto
          do topo cobria as pesagens e as abas Medidas e Fotos apareciam vazias
          (como se não houvesse medida nenhuma) enquanto carregavam.
        */}
        <TabsContent value="peso" className="pt-3">
          {pesosQ.isPending ? (
            <EsqueletoDaAba forma="peso" />
          ) : (
            <AbaPeso userId={userId} hoje={hoje} pesos={pesosQ.data ?? []} perfil={perfil} />
          )}
        </TabsContent>
        <TabsContent value="medidas" className="pt-3">
          {medidasQ.isPending ? (
            <EsqueletoDaAba forma="medidas" />
          ) : (
            <AbaMedidas userId={userId} hoje={hoje} medidas={medidasQ.data ?? []} />
          )}
        </TabsContent>
        <TabsContent value="fotos" className="pt-3">
          {fotosQ.isPending ? (
            <EsqueletoDaAba forma="fotos" />
          ) : (
            <AbaFotos userId={userId} hoje={hoje} fotos={fotosQ.data ?? []} />
          )}
        </TabsContent>
      </Tabs>
    </Tela>
  );
}

/**
 * O esqueleto de cada aba tem a FORMA do que vem depois (SPEC §22.2 item 4):
 * o gráfico e o campo do peso, os pares de medidas, os três ângulos de foto.
 */
function EsqueletoDaAba({ forma }: { forma: "peso" | "medidas" | "fotos" }) {
  return (
    <div role="status" aria-label="Carregando" className="flex flex-col gap-4">
      <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4">
        <Skeleton className="h-5 w-2/5" />
        {forma === "peso" ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-40 w-full" />
          </>
        ) : null}
        {forma === "medidas" ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        ) : null}
        {forma === "fotos" ? (
          <>
            <Skeleton className="h-12 w-full" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] w-full" />
              ))}
            </div>
          </>
        ) : null}
      </div>
      <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

function Tela({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-semibold tracking-tight">Corpo</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Peso, fita métrica e as fotos de progresso.
        </p>
      </header>
      {children}
    </section>
  );
}
