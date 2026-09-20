import { CabecalhoMais } from "@/components/mais/cabecalho";
import { acharExercicio, equipamentos, ilustracoes } from "@/lib/dados";

export const metadata = { title: "Créditos — Treino do Terraço" };

/**
 * Mais → Créditos (marco Mídia): quem fez cada imagem do app e sob que
 * licença. As ilustrações são CC BY-SA e o mapa muscular é MIT — as duas
 * exigem atribuição, e é esta a tela que cumpre isso. A lista sai de
 * `data/ilustracoes.json`; nada é escrito à mão aqui.
 */
export default function Creditos() {
  const porFonte = (fonte: "everkinetic" | "wger") =>
    ilustracoes.filter((i) => i.fonte === fonte);
  const everkinetic = porFonte("everkinetic");
  const wger = porFonte("wger");
  /* A licença mostrada sai do JSON, não de um texto escrito aqui. */
  const licencasDe = (lista: typeof ilustracoes) =>
    [...new Set(lista.map((i) => i.licenca))].sort().join(" e ");
  const fotos = equipamentos.fotos_dos_itens;

  return (
    <section className="flex flex-col gap-5">
      <CabecalhoMais
        titulo="Créditos"
        descricao="De onde vem cada imagem do app e sob que licença."
      />

      <Bloco
        titulo="Ilustrações dos exercícios"
        resumo={`${ilustracoes.length} exercícios (${everkinetic.length} Everkinetic · ${wger.length} wger). As imagens foram redimensionadas para caber no celular; as versões redimensionadas continuam sob CC BY-SA.`}
      >
        <Fonte
          nome="Everkinetic, via Wikimedia Commons"
          url="https://commons.wikimedia.org/wiki/Category:Everkinetic"
          licenca={licencasDe(everkinetic)}
          quantos={everkinetic.length}
        />
        <Fonte
          nome="wger (colaboradores)"
          url="https://wger.de/"
          licenca={licencasDe(wger)}
          quantos={wger.length}
        />
        <details className="text-muted-foreground text-xs">
          <summary className="alvo text-foreground flex items-center py-2 text-sm font-medium">
            Autor de cada ilustração
          </summary>
          {/*
            Uma linha por ilustração, e a linha inteira é o link: no celular o
            polegar precisa dos 44 px (§10.9), e um link de 16 px no meio de um
            parágrafo não os tem.
          */}
          <ul className="divide-border flex flex-col divide-y">
            {ilustracoes.map((i) => (
              <li key={i.exercicio_id}>
                <a
                  href={i.url_fonte}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="alvo flex min-h-11 w-full flex-col justify-center gap-0.5 py-1.5"
                >
                  <span className="text-foreground text-sm leading-tight font-medium">
                    {acharExercicio(i.exercicio_id).nome}
                  </span>
                  <span className="leading-tight">
                    {i.titulo_fonte} — {i.autor}, {i.licenca}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </details>
      </Bloco>

      <Bloco
        titulo="Mapa muscular"
        resumo="Geometria derivada de MuscleMap, de Melih Colpan (licença MIT), pela conversão publicada em openGym. Nenhum ponto do desenho foi alterado; os músculos foram reagrupados e as cores viraram variáveis CSS."
      >
        <Fonte
          nome="MuscleMap (Melih Colpan)"
          url="https://github.com/melihcolpan/MuscleMap"
          licenca="MIT"
        />
        <Fonte
          nome="openGym (Duarte Santos) — conversão da geometria"
          url="https://github.com/DuarteSantos8/openGym"
          licenca="MIT (a geometria; o resto do projeto é AGPL)"
        />
        {/*
          A MIT exige que o aviso de copyright viaje junto do que é
          distribuído: o arquivo é publicado com o desenho, e aqui ele é um
          link de verdade — não um caminho que só existe no repositório.
        */}
        <p className="text-sm">
          <a
            href="/mapa-muscular/LICENCA-mapa-anatomico.md"
            target="_blank"
            rel="noreferrer noopener"
            className="alvo inline-flex items-center font-medium underline underline-offset-2"
          >
            Texto completo da licença MIT
          </a>
          <span className="text-muted-foreground">
            {" "}
            — anda junto do desenho, com a atribuição e o que foi feito com a
            geometria
          </span>
        </p>
      </Bloco>

      <Bloco
        titulo="Fotos de execução"
        resumo="Duas por exercício: posição inicial e final."
      >
        <Fonte
          nome="free-exercise-db"
          url="https://github.com/yuhonas/free-exercise-db"
          licenca="domínio público (Unlicense)"
        />
      </Bloco>

      <Bloco
        titulo="Figuras animadas, textos e dados"
        resumo="Feitos para este app a partir do Guia de treino da garagem."
      />

      {/*
        SPEC §15.3: as fotos dos itens NÃO cumprem a §15.1 (não têm licença
        livre). Estão aqui porque a regra do app é dizer de onde vem cada
        imagem — inclusive a que entrou por exceção. A procedência sai de
        data/equipamentos.json; nada escrito à mão.
      */}
      <Bloco
        titulo="Fotos dos itens do terraço"
        resumo={`${equipamentos.itens.length} itens do terraço. Origem das fotos: ${fotos.origem}. Sem licença livre — ${fotos.uso}.`}
      />

      <p className="text-muted-foreground text-xs text-balance">
        CC BY-SA obriga a citar o autor e a manter a mesma licença nas obras
        derivadas: as imagens redimensionadas continuam sob CC BY-SA.
      </p>

      {/* SPEC §22.1: qual build está no ar — o mesmo commit de `/versao` */}
      <p className="text-muted-foreground numero text-xs">
        Versão {(process.env.NEXT_PUBLIC_COMMIT ?? "dev").slice(0, 7)}
      </p>
    </section>
  );
}

function Bloco({
  titulo,
  resumo,
  children,
}: {
  titulo: string;
  resumo: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card cartao flex flex-col gap-2 border p-3">
      <h2 className="font-semibold">{titulo}</h2>
      <p className="text-muted-foreground text-sm text-balance">{resumo}</p>
      {children}
    </section>
  );
}

function Fonte({
  nome,
  url,
  licenca,
  quantos,
}: {
  nome: string;
  url: string;
  licenca: string;
  quantos?: number;
}) {
  return (
    <p className="text-sm">
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="alvo inline-flex items-center font-medium underline underline-offset-2"
      >
        {nome}
      </a>
      <span className="text-muted-foreground">
        {" "}
        — {licenca}
        {quantos !== undefined ? ` · ${quantos} exercícios` : ""}
      </span>
    </p>
  );
}
