import { SpriteMuscular } from "@/components/sprite-muscular";
import { idsComVideo } from "@/lib/videos";
import { Socorro } from "./socorro";

/** Só recursos públicos do app podem entrar no HTML de socorro do precache. */
export default function Offline() {
  return <Socorro videos={idsComVideo()}><SpriteMuscular /></Socorro>;
}
