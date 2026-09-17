import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigurado } from "@/lib/env";
import { destinoInterno } from "@/lib/rotas";
import { criarClienteServidor } from "@/lib/supabase/server";

/** Troca o `code` do Supabase por uma sessão e volta para o app. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  // o `next` vem da URL: só caminho interno (`lib/rotas.ts`)
  const proximo = destinoInterno(searchParams.get("next"));

  if (!supabaseConfigurado() || !code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await criarClienteServidor();
  // desde o marco Contas (SPEC §21) o callback só exige sessão: quem pode ter
  // conta é decidido pela cota, no banco
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return NextResponse.redirect(`${origin}/login`);

  return NextResponse.redirect(new URL(proximo, origin));
}
