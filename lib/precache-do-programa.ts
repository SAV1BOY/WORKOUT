/**
 * "Figuras e fotos do programa atual no cache" (SPEC §8).
 *
 * O precache da instalação não sabe em que fase o Miguel está — ele é montado
 * no build. Então o shell e as figuras vão no precache (next.config.ts) e as
 * **imagens dos exercícios da fase atual** são aquecidas aqui, uma vez, depois
 * que o service worker assume: um `fetch` comum já cai na regra de cache do
 * `app/sw.ts`.
 *
 * A parte que decide *o que* entra é pura e testada; a que busca vive no
 * navegador e nunca lança.
 */
import { capaDoTreino, urlCapa } from "@/lib/capas";
import { acharExercicio, acharFase, acharTreino, urlFigura, urlFotos } from "@/lib/dados";
import { midiaDaMiniatura, urlWebp, urlsDaIlustracao } from "@/lib/midia";
import type { FaseId } from "@/lib/schemas";

/** Os exercícios dos treinos de uma fase, sem repetir, na ordem do programa. */
export function exerciciosDaFase(fase: FaseId): string[] {
  const ids: string[] = [];
  const vistos = new Set<string>();
  for (const treinoId of acharFase(fase).treinos) {
    for (const item of acharTreino(treinoId).exercicios) {
      if (vistos.has(item.exercicio_id)) continue;
      vistos.add(item.exercicio_id);
      ids.push(item.exercicio_id);
    }
  }
  return ids;
}

/**
 * **Exatamente** o que as telas da fase pedem ao servidor, na ordem em que
 * aparecem — e nada mais.
 *
 * Desde as derivadas do prebuild (SPEC §22.4 item 1) o arquivo que a tela pede
 * não é mais o do kit: o cartão pede `-capa.webp`, a lista pede `-mini.webp` e
 * a ficha pede o `.webp` grande, com o original só de reserva no `onError`.
 * Aquecer os originais deixaria o treino de hoje sem imagem justamente sem
 * rede, que é para o que este aquecimento existe. A regra de cada degrau é a
 * mesma de `components/ui/imagem.ts` (`fonteComReserva`): a derivada quando
 * existe, senão o próprio arquivo do kit — e `lib/precache-do-programa.test.ts`
 * compara esta lista com o que os componentes montam.
 */
export function midiaDaFase(fase: FaseId): string[] {
  const urls: string[] = [];
  const juntar = (url: string | null | undefined) => {
    if (url && !urls.includes(url)) urls.push(url);
  };

  // as capas dos cartões dos treinos da fase (aba Treino e Explorar)
  for (const treinoId of acharFase(fase).treinos) {
    const capa = capaDoTreino(treinoId);
    juntar(capa && (urlCapa(capa) ?? capa));
  }

  for (const id of exerciciosDaFase(fase)) {
    const exercicio = acharExercicio(id);

    // a miniatura das listas (lista de hoje, Explorar, descanso do player)
    const { url, mini } = midiaDaMiniatura(id);
    juntar(url && (mini ?? url));

    // a ficha: ilustração e figura são o próprio arquivo do kit…
    for (const ilustracao of urlsDaIlustracao(id)) juntar(ilustracao);
    juntar(urlFigura(exercicio));
    // …e a foto de execução é a derivada WebP
    for (const foto of urlFotos(exercicio)) juntar(urlWebp(foto) ?? foto);
  }
  return urls;
}

/** Quantos downloads ao mesmo tempo (celular no 4G do terraço). */
const EM_PARALELO = 4;

let aquecida: FaseId | null = null;

/**
 * Baixa em segundo plano o que falta da fase atual. Idempotente por fase e
 * silenciosa: sem service worker, sem rede ou com o download falhando, o app
 * segue igual (a foto aparece quando houver rede).
 */
export async function aquecerMidiaDaFase(fase: FaseId): Promise<number> {
  if (typeof window === "undefined" || aquecida === fase) return 0;
  if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) {
    return 0;
  }
  if (navigator.onLine === false) return 0;
  aquecida = fase;

  const urls = midiaDaFase(fase);
  let baixadas = 0;

  const fila = [...urls];
  const trabalhador = async () => {
    for (let url = fila.shift(); url !== undefined; url = fila.shift()) {
      try {
        await fetch(url, { cache: "no-cache" });
        baixadas += 1;
      } catch {
        // sem rede no meio: o que faltar entra na próxima vez que for aberto
        return;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(EM_PARALELO, fila.length) }, trabalhador),
  );
  return baixadas;
}

/** Só para os testes: esquece que a fase já foi aquecida. */
export function esquecerAquecimento(): void {
  aquecida = null;
}
