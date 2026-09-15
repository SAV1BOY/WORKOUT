import type { Musculo } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/** Boneco frente/costas com os músculos do exercício destacados. */
export function MapaMuscular({
  primarios,
  secundarios,
  className,
}: {
  primarios: Musculo[];
  secundarios: Musculo[];
  className?: string;
}) {
  const classes = [
    ...primarios.map((m) => `p-${m}`),
    ...secundarios.map((m) => `s-${m}`),
  ].join(" ");

  return (
    <figure className={cn("flex items-end gap-2", classes, className)}>
      <svg viewBox="0 0 50 88" className="h-28 w-auto" role="img" aria-label="Frente">
        <use href="#bf" />
      </svg>
      <svg viewBox="0 0 50 88" className="h-28 w-auto" role="img" aria-label="Costas">
        <use href="#bb" />
      </svg>
    </figure>
  );
}
