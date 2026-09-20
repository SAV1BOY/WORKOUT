/**
 * `GET /versao` → `{ "commit": "…", "construidoEm": "…" }` (SPEC §22.1).
 *
 * É o que o teste de fumaça do deploy pergunta para saber se a URL já está
 * servindo o build da rodada — sem isso, a fumaça só consegue dizer "abriu",
 * não "abriu o que acabei de publicar". Rota pública (lib/supabase/middleware)
 * e `no-store`: uma resposta guardada em cache responderia pelo build anterior,
 * que é exatamente a pergunta que ela não pode errar.
 */
export const dynamic = "force-dynamic";

const COMMIT = process.env.NEXT_PUBLIC_COMMIT ?? "dev";
const CONSTRUIDO_EM = process.env.NEXT_PUBLIC_CONSTRUIDO_EM ?? null;

export function GET(): Response {
  return Response.json(
    { commit: COMMIT, construidoEm: CONSTRUIDO_EM },
    { headers: { "Cache-Control": "no-store" } },
  );
}
