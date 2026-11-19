import { vinculoDoLoginAtual } from "@/lib/player-sem-rede";
import { clienteNavegador } from "@/lib/supabase/client";

export async function confirmarContaDoTreino(conta: string, mensagem: string): Promise<void> {
  const vinculo = await vinculoDoLoginAtual().catch(() => null);
  if (vinculo?.conta === conta) return;
  if (navigator.onLine !== false && !vinculo) {
    const { data } = await clienteNavegador().auth.getSession();
    if (data.session?.user.id === conta) return;
  }
  throw new Error(mensagem);
}
