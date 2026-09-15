import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Tudo menos os arquivos estáticos e as imagens copiadas de assets/.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|figuras/|fotos/|ilustracoes/|itens/|mapa-muscular/|videos/|sw.js|swe-worker-.*\\.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|mp4)$).*)",
  ],
};
