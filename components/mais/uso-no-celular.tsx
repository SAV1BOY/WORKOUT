"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CACHE_DO_CATALOGO, CACHE_DE_MIDIA } from "@/lib/caches-do-worker";
import { tamanhoDaMidia } from "@/lib/midia-no-aparelho";
import { aquecerMidiaDaFase, midiaDaFase } from "@/lib/precache-do-programa";
import { usePerfil } from "@/lib/queries/dados";
import { useRede } from "@/lib/usar-rede";
import { useInstalacao } from "@/lib/instalar-app";

export function UsoNoCelular() {
  const fase = usePerfil().data?.fase_atual;
  const online = useRede();
  const instalacao = useInstalacao();
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [tamanhos, setTamanhos] = useState<[number, number]>();
  const medir = useCallback(async () => {
    if (typeof caches === "undefined") return;
    setTamanhos(await Promise.all([tamanhoDaMidia(CACHE_DE_MIDIA), tamanhoDaMidia(CACHE_DO_CATALOGO)]));
  }, []);
  useEffect(() => { void medir().catch(() => {}); }, [medir]);
  async function baixar() {
    if (!fase) return;
    setOcupado(true);
    setMensagem("Baixando o treino…");
    try {
      const feitas = await aquecerMidiaDaFase(fase, (n, total) => setMensagem(`Baixando o treino · ${n} de ${total}`));
      setMensagem(feitas === midiaDaFase(fase).length ? "Treino baixado para usar sem rede." : "Download incompleto. Tente novamente com rede.");
      await medir();
    } catch {
      setMensagem("Não consegui baixar o treino agora.");
    } finally { setOcupado(false); }
  }
  async function liberar() {
    setOcupado(true);
    try {
      await caches.delete(CACHE_DO_CATALOGO);
      await medir();
      setMensagem("Espaço do catálogo liberado.");
    } catch { setMensagem("Não consegui liberar o espaço agora."); }
    finally { setOcupado(false); }
  }
  return (
    <section aria-labelledby="uso-no-celular" className="flex flex-col gap-2">
      <h2 id="uso-no-celular" className="text-base font-semibold">Uso no celular</h2>
      {instalacao.botao && <Button variant="outline" className="alvo" onClick={() => void instalacao.instalar()}>Instalar o aplicativo</Button>}
      {instalacao.instrucao && <p className="text-sm">{instalacao.instrucao}</p>}
      <Button variant="outline" className="alvo" disabled={!fase || !online || ocupado} onClick={() => void baixar()}>Baixar o treino para usar sem rede (≈4 MB)</Button>
      {tamanhos && <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>Mídia baixada · {((tamanhos[0] + tamanhos[1]) / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB</span>
        <Button variant="ghost" className="alvo" disabled={ocupado || tamanhos[1] === 0} onClick={() => void liberar()}>Liberar espaço do catálogo</Button>
      </div>}
      <p role="status" className="text-sm">{mensagem}</p>
    </section>
  );
}
