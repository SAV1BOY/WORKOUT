import { NextResponse, type NextRequest } from "next/server";
import { emailPermitido, supabaseConfigurado } from "@/lib/env";
import { criarClienteServidor } from "@/lib/supabase/server";

/** Troca o `code` do Supabase por uma sessão e volta para o app. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const proximo = searchParams.get("next") ?? "/";

  if (!supabaseConfigurado() || !code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return NextResponse.redirect(`${origin}/login`);

  if (!emailPermitido(data.user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?erro=app-pessoal`);
  }

  return NextResponse.redirect(`${origin}${proximo}`);
}
