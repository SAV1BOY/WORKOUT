/**
 * Para onde o app pode mandar o navegador depois de entrar.
 *
 * O `?next=` do `/auth/callback` vem da URL, e a URL vem de fora. Colar esse
 * pedaço na origem sem olhar abre um **open redirect**: `?next=@site.ruim`
 * vira `https://treino.app@site.ruim` e o navegador lê "treino.app" como nome
 * de usuário — o destino é `site.ruim`. `//site.ruim` e `/\site.ruim` fazem o
 * mesmo por outro caminho.
 *
 * Função pura, sem dependência de Next: só caminho interno passa.
 */

/** Controle, DEL e contrabarra: nada disso aparece num caminho deste app. */
function temCaractereProibido(texto: string): boolean {
  if (texto.includes("\\")) return true;
  for (const letra of texto) {
    const codigo = letra.codePointAt(0) ?? 0;
    // controle (quebra de linha inclusive: iria para o cabeçalho Location) e DEL
    if (codigo < 0x20 || codigo === 0x7f) return true;
  }
  return false;
}

/**
 * O caminho interno pedido, ou `/` quando ele sai do site (ou nem existe).
 * O que volta sempre começa com uma única barra.
 */
export function destinoInterno(pedido: string | null | undefined): string {
  if (typeof pedido !== "string") return "/";
  const caminho = pedido.trim();
  if (!caminho.startsWith("/")) return "/";
  // "//host" e "/\host" são endereços de outro site
  if (caminho.startsWith("//")) return "/";
  if (temCaractereProibido(caminho)) return "/";
  return caminho;
}
