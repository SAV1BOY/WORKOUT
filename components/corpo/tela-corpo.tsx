"use client";

import { AbaFotos } from "@/components/corpo/aba-fotos";
import { AbaMedidas } from "@/components/corpo/aba-medidas";
import { AbaPeso } from "@/components/corpo/aba-peso";
import { Erro, EsqueletoCard } from "@/components/carregando";
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

  if (!hoje || !perfilQ.data || pesosQ.isPending) {
    return (
      <Tela>
        <EsqueletoCard linhas={4} />
      </Tela>
    );
  }

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

        <TabsContent value="peso" className="pt-3">
          <AbaPeso
            userId={userId}
            hoje={hoje}
            pesos={pesosQ.data ?? []}
            perfil={perfilQ.data}
          />
        </TabsContent>
        <TabsContent value="medidas" className="pt-3">
          <AbaMedidas userId={userId} hoje={hoje} medidas={medidasQ.data ?? []} />
        </TabsContent>
        <TabsContent value="fotos" className="pt-3">
          <AbaFotos userId={userId} hoje={hoje} fotos={fotosQ.data ?? []} />
        </TabsContent>
      </Tabs>
    </Tela>
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
