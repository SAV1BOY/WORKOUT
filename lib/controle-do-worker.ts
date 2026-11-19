export const PEDIR_CONTROLE_DO_WORKER = "treino:controlar-pagina";

/**
 * Uma navegação pode ter começado antes da ativação, mas receber o HTML depois do
 * primeiro clients.claim(). O registro já existe e a página pode pedir o controle
 * sem recarregar o treino. Um worker anterior simplesmente ignora a mensagem.
 */
export function pedirControleDaPagina(
  container: Pick<ServiceWorkerContainer, "ready" | "controller"> | undefined,
  origem: string,
): () => void {
  if (!container || container.controller) return () => {};
  let montada = true;
  void container.ready.then((registro) => {
    const ativo = registro.active;
    if (!montada || container.controller || registro.scope !== origem + "/" ||
        ativo?.scriptURL !== origem + "/sw.js" || ativo.state === "redundant") return;
    ativo.postMessage(PEDIR_CONTROLE_DO_WORKER);
  }).catch(() => { /* O registro pode ter sido substituído durante a navegação. */ });
  return () => { montada = false; };
}
