import { resumoDeCardioNaUrl } from "@/lib/rota-de-cardio";
import { urlsDeAssets } from "@/lib/sw-assets";
import { CABECALHO_DO_BUILD, ehRsc, type PedidoDeNavegacao } from "@/lib/sw-navegacao";
import { ehAbaLocal, idDoPlayerNoCaminho } from "@/lib/vinculo-do-player";

/** A navegação do cache precisa ser entendida pelo roteador e hidratável com o que ficou no aparelho. */
export async function navegacaoGuardadaServe(
  pedido: PedidoDeNavegacao, resposta: Response, build: string, temAsset: (url: string) => Promise<boolean>,
): Promise<boolean> {
  if (resposta.type === "opaqueredirect") return true;
  const tipo = (resposta.headers.get("Content-Type") ?? "").split(";")[0]?.trim();
  const desteBuild = resposta.headers.get(CABECALHO_DO_BUILD) === build;
  if (ehRsc(pedido)) return desteBuild && tipo === "text/x-component";
  if (tipo !== "text/html" || !resposta.ok) return false;
  const url = new URL(pedido.url);
  // Estas telas podem ser remontadas pelo shell atual com o vínculo de login e os dados locais.
  if (!desteBuild && (ehAbaLocal(url.pathname) || idDoPlayerNoCaminho(url.pathname) || resumoDeCardioNaUrl(url))) return false;
  const assets = urlsDeAssets(await resposta.clone().text(), url.origin);
  return (await Promise.all(assets.map(temAsset))).every(Boolean);
}
