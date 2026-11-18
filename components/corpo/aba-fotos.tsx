"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Camera, ImageOff } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { SemDados } from "@/components/graficos/apoio";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CampoData, useDataDoRegistro } from "@/components/ui/campo-data";
import {
  ANGULOS,
  NOME_ANGULO,
  angulosEmComum,
  fotosPorData,
  parDeComparacao,
  type FotoBruta,
} from "@/lib/corpo";
import { FotoAmpliada } from "@/components/exercicios/foto-ampliada";
import { formatarData } from "@/lib/formato";
import { apagarFoto, enviarFoto, useUrlsDasFotos } from "@/lib/queries/corpo";
import type { AnguloFoto } from "@/lib/types";
import { cn } from "@/lib/utils";

const AVISO_FOTO_REGISTRADA = "foto-de-progresso-registrada";

/**
 * Aba Fotos (SPEC §3.8): upload de frente/lado/costas por data (reduzidas no
 * aparelho), galeria por data e a comparação de duas datas com slider.
 */
export function AbaFotos({
  userId,
  hoje,
  fotos,
}: {
  userId: string;
  hoje: string;
  fotos: FotoBruta[];
}) {
  const cliente = useQueryClient();
  // a data fica depois de enviar (os três ângulos do mesmo dia); a virada do dia a devolve para hoje
  const { data, escolher } = useDataDoRegistro(hoje);
  const [enviando, setEnviando] = useState<AnguloFoto | null>(null);
  /** A foto aberta em tela cheia (onde fica o Apagar, SPEC §22.2 item 3). */
  const [aberta, setAberta] = useState<{ foto: FotoBruta; titulo: string } | null>(null);
  const [apagando, setApagando] = useState(false);

  const dias = useMemo(() => fotosPorData(fotos), [fotos]);
  const caminhos = useMemo(() => fotos.map((f) => f.storage_path), [fotos]);
  const urlsQ = useUrlsDasFotos(caminhos);
  const urls = urlsQ.data ?? {};

  const receber = async (angulo: AnguloFoto, arquivo: File | undefined) => {
    if (!arquivo) return;
    setEnviando(angulo);
    try {
      const existente =
        fotos.find((f) => f.data === data && f.angulo === angulo) ?? null;
      await enviarFoto({ userId, data, angulo, arquivo, cliente, existente });
      toast.success(`Foto de ${NOME_ANGULO[angulo].toLowerCase()} registrada.`, { id: AVISO_FOTO_REGISTRADA });
    } catch {
      toast.error("Não consegui registrar essa foto.");
    } finally {
      setEnviando(null);
    }
  };

  const apagar = async () => {
    if (!aberta) return;
    setApagando(true);
    try {
      await apagarFoto({ foto: aberta.foto, cliente });
      setAberta(null);
      toast.success("Foto apagada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui apagar essa foto.");
    } finally {
      setApagando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">{dias.length ? "Fotos do dia" : "Registre sua primeira foto"}</CardTitle>
          <CardDescription>
            Mesma luz, mesma distância, mesma pose. Só você tem acesso às suas fotos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <CampoData id="fotos-data" valor={data} hoje={hoje} aoMudar={escolher} />

          <div className="flex flex-col gap-2">
            {ANGULOS.map((angulo) => (
              <label
                key={angulo}
                className="alvo border-input hover:bg-accent flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 focus-within:ring-2"
              >
                <Camera className="size-5" aria-hidden="true" />
                <span className="text-xs font-medium">{NOME_ANGULO[angulo]}</span>
                <span className="text-primary ml-auto flex min-h-11 items-center text-sm">
                  {enviando === angulo ? "enviando…" : "escolher"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label={`Foto de ${NOME_ANGULO[angulo].toLowerCase()}`}
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0];
                    e.target.value = "";
                    void receber(angulo, arquivo);
                  }}
                />
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {dias.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-base">Galeria</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-4">
              {dias.map((dia) => (
                <li key={dia.data} className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{formatarData(dia.data)}</span>
                  <div className="grid grid-cols-3 gap-2">
                    {ANGULOS.map((angulo) => {
                      const foto = dia.fotos[angulo];
                      const url = foto ? urls[foto.storage_path] : undefined;
                      return (
                        <figure key={angulo} className="flex flex-col gap-1">
                          {url && foto ? (
                            // um toque abre a foto em tela cheia, onde fica o Apagar (§22.2)
                            <button
                              type="button"
                              onClick={() => {
                                toast.dismiss(AVISO_FOTO_REGISTRADA);
                                setAberta({
                                  foto,
                                  titulo: `${NOME_ANGULO[angulo]} em ${formatarData(dia.data)}`,
                                });
                              }}
                              // "Ver a foto: Frente em 16/09" — sem repetir o
                              // rótulo do input de upload ("Foto de frente")
                              aria-label={`Ver a foto: ${NOME_ANGULO[angulo]} em ${formatarData(dia.data)}`}
                              className="alvo block w-full"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- blob local ou URL assinada do bucket */}
                              <img
                                src={url}
                                alt={`${NOME_ANGULO[angulo]} em ${formatarData(dia.data)}`}
                                loading="lazy"
                                decoding="async"
                                className="bg-muted aspect-[3/4] w-full rounded-lg object-cover"
                              />
                            </button>
                          ) : (
                            <span
                              aria-hidden="true"
                              className="bg-muted flex aspect-[3/4] w-full items-center justify-center rounded-lg text-xs"
                            >
                              {foto ? "…" : "—"}
                            </span>
                          )}
                          <figcaption className="text-muted-foreground text-center text-micro">
                            {NOME_ANGULO[angulo]}
                          </figcaption>
                        </figure>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {dias.length > 0 ? <Comparacao dias={dias} urls={urls} /> : null}

      {aberta && urls[aberta.foto.storage_path] ? (
        <FotoAmpliada
          url={urls[aberta.foto.storage_path] ?? ""}
          titulo={aberta.titulo}
          aoFechar={() => setAberta(null)}
          aoApagar={() => void apagar()}
          apagando={apagando}
        />
      ) : null}
    </div>
  );
}

/** Duas datas lado a lado, com o slider revelando a mais antiga (SPEC §3.8). */
function Comparacao({
  dias,
  urls,
}: {
  dias: ReturnType<typeof fotosPorData>;
  urls: Record<string, string>;
}) {
  // Só guardamos escolhas feitas pela pessoa. Antes disso, o par acompanha
  // as fotos que acabam de entrar ou sair da galeria.
  const [antes, setAntes] = useState<string | null>(null);
  const [depois, setDepois] = useState<string | null>(null);
  const [posicao, setPosicao] = useState(50);

  const par = parDeComparacao(dias, { antes, depois });
  const diaAntes = dias.find((d) => d.data === par.antes) ?? null;
  const diaDepois = dias.find((d) => d.data === par.depois) ?? null;
  const comuns = angulosEmComum(diaAntes, diaDepois);
  const [angulo, setAngulo] = useState<AnguloFoto>("frente");
  const anguloAtivo = comuns.includes(angulo) ? angulo : (comuns[0] ?? null);

  const urlAntes = anguloAtivo
    ? urls[diaAntes?.fotos[anguloAtivo]?.storage_path ?? ""]
    : undefined;
  const urlDepois = anguloAtivo
    ? urls[diaDepois?.fotos[anguloAtivo]?.storage_path ?? ""]
    : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="text-base">Comparar</CardTitle>
        <CardDescription>Arraste para revelar a foto mais antiga.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {dias.length < 2 ? (
          <SemDados icone={ImageOff} titulo="Só um dia com foto">
            A comparação precisa de fotos de dois dias diferentes.
          </SemDados>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground text-rotulo tracking-wide uppercase">
                  Antes
                </span>
                <select
                  value={diaAntes?.data ?? ""}
                  onChange={(e) => {
                    if (e.target.value === par.depois) setDepois(par.antes);
                    setAntes(e.target.value);
                  }}
                  className="alvo border-input bg-background h-11 rounded-md border px-2 text-sm"
                >
                  {dias.map((d) => (
                    <option key={d.data} value={d.data}>
                      {formatarData(d.data)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground text-rotulo tracking-wide uppercase">
                  Depois
                </span>
                <select
                  value={diaDepois?.data ?? ""}
                  onChange={(e) => {
                    if (e.target.value === par.antes) setAntes(par.depois);
                    setDepois(e.target.value);
                  }}
                  className="alvo border-input bg-background h-11 rounded-md border px-2 text-sm"
                >
                  {dias.map((d) => (
                    <option key={d.data} value={d.data}>
                      {formatarData(d.data)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {comuns.length === 0 ? (
              <SemDados icone={ImageOff} titulo="Sem ângulo em comum">
                Essas duas datas não têm o mesmo ângulo de foto.
              </SemDados>
            ) : (
              <>
                <div className="flex gap-2" role="group" aria-label="Ângulo da comparação">
                  {comuns.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAngulo(a)}
                      aria-pressed={a === anguloAtivo}
                      className={cn(
                        "alvo h-11 flex-1 rounded-md border text-sm",
                        a === anguloAtivo
                          ? "bg-primary text-primary-foreground border-transparent"
                          : "border-input",
                      )}
                    >
                      {NOME_ANGULO[a]}
                    </button>
                  ))}
                </div>

                <div className="bg-muted relative aspect-[3/4] w-full overflow-hidden rounded-lg">
                  {urlDepois ? (
                    // eslint-disable-next-line @next/next/no-img-element -- blob local ou URL assinada
                    <img
                      src={urlDepois}
                      alt={`Depois — ${formatarData(diaDepois?.data ?? "")}`}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : null}
                  {urlAntes ? (
                    // eslint-disable-next-line @next/next/no-img-element -- blob local ou URL assinada
                    <img
                      src={urlAntes}
                      alt={`Antes — ${formatarData(diaAntes?.data ?? "")}`}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 size-full object-cover"
                      style={{ clipPath: `inset(0 ${100 - posicao}% 0 0)` }}
                    />
                  ) : null}
                  <span
                    aria-hidden="true"
                    className="bg-primary absolute inset-y-0 w-0.5"
                    style={{ left: `${posicao}%` }}
                  />
                </div>

                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={posicao}
                  onChange={(e) => setPosicao(Number(e.target.value))}
                  aria-label="Quanto mostrar da foto mais antiga"
                  className="alvo accent-primary w-full"
                />
                <p className="text-muted-foreground flex justify-between text-xs">
                  <span>{formatarData(diaAntes?.data ?? "")}</span>
                  <span>{formatarData(diaDepois?.data ?? "")}</span>
                </p>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
