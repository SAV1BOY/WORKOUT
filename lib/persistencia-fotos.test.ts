import { dehydrate, QueryClient } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { guardarCache, lerCache } from "@/lib/db";
import { persistirQueryClient } from "@/lib/persistencia-query";

vi.mock("@/lib/db", () => ({
  temIndexedDB: () => true,
  guardarCache: vi.fn().mockResolvedValue(undefined),
  lerCache: vi.fn(),
}));

afterEach(() => vi.useRealTimers());

it("descarta URL de outro documento ao restaurar e ao salvar, preservando a URL assinada", async () => {
  vi.useFakeTimers();
  const locais = ["corpo", "fotos-url", "frente"];
  const assinadas = ["corpo", "fotos-url", "lado"];
  const fotoEnviada = { lado: "https://supabase.test/storage/v1/object/sign/lado" };
  const antes = new QueryClient();
  antes.setQueryData(locais, { frente: "blob:https://app.test/documento-anterior" });
  antes.setQueryData(assinadas, fotoEnviada);
  vi.mocked(lerCache).mockResolvedValue({ salvoEm: Date.now(), estado: dehydrate(antes) });

  const atual = new QueryClient();
  const parar = persistirQueryClient(atual);
  try {
    await vi.advanceTimersByTimeAsync(0);
    expect(atual.getQueryData(locais)).toBeUndefined();
    expect(atual.getQueryData(assinadas)).toEqual(fotoEnviada);
    atual.setQueryData(locais, { frente: "blob:https://app.test/novo-documento" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(guardarCache).toHaveBeenCalledWith("react-query-v1", expect.objectContaining({
      estado: expect.objectContaining({ queries: [expect.objectContaining({ queryKey: assinadas })] }),
    }));
  } finally {
    parar();
    antes.clear();
    atual.clear();
  }
});
