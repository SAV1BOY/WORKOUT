/**
 * Redimensionar a foto no aparelho antes de subir (SPEC §3.8): o celular tira
 * 12 MP e o bucket não precisa disso. Só roda no navegador.
 */
"use client";

import { dimensoesReduzidas } from "@/lib/corpo";

/** O maior lado que vai para o bucket (SPEC §3.8: ≤ 1600 px). */
export const LADO_MAXIMO = 1600;
export const QUALIDADE = 0.82;
export const TIPO_SAIDA = "image/jpeg";

async function abrir(arquivo: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(arquivo);
  }
  const url = URL.createObjectURL(arquivo);
  try {
    return await new Promise<HTMLImageElement>((pronto, falhou) => {
      const img = new Image();
      img.onload = () => pronto(img);
      img.onerror = () => falhou(new Error("Não consegui ler essa imagem."));
      img.src = url;
    });
  } finally {
    // o canvas já copiou os pixels quando esta promessa resolve
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

function tamanho(imagem: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  if ("naturalWidth" in imagem) {
    return { w: imagem.naturalWidth, h: imagem.naturalHeight };
  }
  return { w: imagem.width, h: imagem.height };
}

/**
 * Devolve um JPEG com no máximo `max` px no maior lado. Se algo falhar
 * (navegador sem canvas, arquivo estranho), devolve o original: melhor subir
 * grande do que perder a foto.
 */
export async function reduzirFoto(arquivo: Blob, max = LADO_MAXIMO): Promise<Blob> {
  try {
    const imagem = await abrir(arquivo);
    const { w, h } = tamanho(imagem);
    const { largura, altura } = dimensoesReduzidas(w, h, max);

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) return arquivo;
    ctx.drawImage(imagem, 0, 0, largura, altura);
    if ("close" in imagem) imagem.close();

    const blob = await new Promise<Blob | null>((pronto) => {
      canvas.toBlob(pronto, TIPO_SAIDA, QUALIDADE);
    });
    return blob ?? arquivo;
  } catch {
    return arquivo;
  }
}
