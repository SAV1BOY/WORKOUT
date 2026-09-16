# Treino do Terraço

App pessoal de treino, de um usuário só (Miguel), para o terraço de casa:
Next.js 15 + Supabase, instalável como PWA, feito para um celular de 360 px e
para funcionar sem rede. Todo o conteúdo — 81 exercícios, o programa das duas
fases, os planos de cardio e de barra fixa, as regras de progressão e o
equipamento — vem dos JSON em `data/`; o código não escreve treino nenhum.

A especificação é `SPEC.md` (§13, §14 e §15 são a camada visual v2.1). O
andamento marco a marco, os portões e o passo a passo da infraestrutura estão
em `PROGRESSO.md`.

## O que tem aqui

```
WORKOUT/
├── SPEC.md · CLAUDE.md · PROGRESSO.md     a spec, as regras de trabalho, o andamento
├── app/                    rotas (App Router): as 5 abas, o player, login, offline
├── components/             telas e peças (player/, treino/, explorar/, relatorio/, corpo/, mais/, ui/)
├── lib/                    o motor e as funções puras + os testes ao lado
│   ├── progressao.ts       quando subir carga/reps e o que fazer na falha (§6)
│   ├── montagem.ts         quais cargas o kit alcança, anilha por anilha (§6.5)
│   ├── player.ts           a máquina de estados do treino guiado (§14.1)
│   ├── colecoes.ts         as coleções do Explorar, derivadas dos JSON (§13.4)
│   └── midia.ts            qual imagem cada exercício mostra e de quem é (§15.2)
├── data/                   a fonte da verdade (exercícios, programa, cardio, progressão,
│                           equipamentos, perfil, tutoriais, ilustrações)
├── assets/                 figuras SVG, fotos de execução, ilustrações, mapa muscular, itens
├── e2e/                    Playwright num Chromium de 360 × 740 contra o mock do Supabase
├── scripts/                validar-dados, copiar-assets, importar-ilustracoes, mock-supabase
├── supabase/schema.sql     as tabelas, o RLS e o bucket de fotos
└── docs/                   o guia de treino original e a análise da referência
```

## Como usar (o app por dentro)

Cinco abas na barra de baixo:

| Aba | O que faz |
|---|---|
| **Treino** | o dia de hoje: faixa da semana, meta, o card do treino com capa e a lista dos exercícios (miniatura, prescrição e a carga de hoje com o rótulo do implemento). "Começar treino" entra direto no player. Traz também os Desafios, a "Parte do corpo em foco", Editar/reordenar e o FAB **Ajustar** |
| **Explorar** | as coleções derivadas dos JSON: 6 treinos, 8 grupos musculares, 9 aparelhos, 3 circuitos e 3 planos, mais o catálogo dos 81 com filtros e busca sem acento. "Começar" abre uma **sessão livre**, que registra e progride como um treino do programa |
| **Relatório** | os contadores do acumulado (treinos, minutos, volume), o card da semana, o histórico com "todos os registros", as sequências, os recordes, os gráficos e o peso com o IMC |
| **Corpo** | peso (com vírgula e média móvel), as 8 medidas, as fotos de progresso lado a lado e o IMC |
| **Mais** | perfil, equipamento, preferências, backup, sincronização e **Créditos** |

O **player** (`/treinar/[sessionId]`) é o caminho principal de um treino:
Preparação → Exercício → ✓ → Descanso com o próximo → … → "firme?" →
Feedback → Conclusão. Cada série digitada vai para o IndexedDB na hora e sobe
por uma fila com retry: fechar o app, ficar sem rede ou trocar de aba não perde
nada, e reabrir volta ao mesmo passo. O ícone de lista abre a visão geral com
todas as séries e a saída do treino.

A **ficha em folha** abre da lista do dia, do player e de dentro de uma coleção,
com três abas: **Vídeo** (a ilustração alternando as duas posições, com o
crédito e o link da licença embaixo), **Músculos** (o boneco anatômico
frente/costas pintado) e **Tutorial** (a miniatura do YouTube, que só carrega o
vídeo quando você toca e some sem rede). O stepper "Só nesta sessão" muda a
carga do dia sem mexer no programa.

## Rodar

```bash
npm install                        # Node 22, npm 10
cp .env.local.example .env.local   # e preencha as chaves do Supabase
npm run dev                        # http://localhost:3000
```

| Comando | O que faz |
|---|---|
| `npm run dev` | desenvolvimento (o service worker fica desligado) |
| `npm run build` | build de produção — o `prebuild` roda `validar` e `assets` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (o motor, a montagem, o calendário, o player, as coleções, as agregações) |
| `npm run e2e` | Playwright num celular emulado — exige `npm run build` antes |
| `npm run validar` | confere `data/*.json` contra os schemas Zod e cada asset referenciado |
| `npm run assets` | copia `assets/` para `public/` (a pasta `public/` é **gerada**, não versionada) |
| `npm run mock` | sobe o Supabase de mentira local (`scripts/mock-supabase.ts`) |
| `npm run dev:mock` | `next dev` já apontando para esse mock |
| `npm run icones` | regenera os ícones PNG do PWA |
| `npm run ilustracoes` | reimporta as ilustrações de licença livre (fora do build) |

Sem as variáveis de ambiente o app compila e abre: a tela de login mostra o
aviso de configuração em vez de quebrar. Para ver o app inteiro **sem projeto
Supabase**, dois terminais:

```bash
npm run mock        # o Supabase de mentira na 54321
npm run dev:mock    # next dev já apontando para ele → http://localhost:3000
```

Crie a conta com o e-mail permitido (o mock não pede confirmação). Do celular na
mesma rede Wi-Fi, troque `127.0.0.1` pelo IP do computador nas três variáveis —
senão o navegador do celular não acha o mock (`e2e/README.md`).

## Testar

```bash
npm run lint
npm run build
npm test
npm run e2e
```

Os quatro verdes, nessa ordem e numa janela sozinha, são o portão de cada
marco. `npm run e2e` **não builda**: ele sobe `next start -p 3100` com o que
está em `.next/` mais o mock na 54321, então rode `npm run build` antes. Nada
precisa de rede nem de chaves. Detalhes, variáveis de porta (`E2E_PORT`,
`MOCK_SUPABASE_PORT`) e como depurar: `e2e/README.md`.

O motor (`lib/progressao.ts`) e a montagem (`lib/montagem.ts`) são funções
puras, sem React e sem Supabase, cobertas pelos 22 casos de
`docs/casos-de-teste-progressao.md`. Nenhuma camada visual os altera.

## Publicar

> O passo a passo completo (Supabase + Vercel + PWA + o teste do terraço), em
> ordem e com os comandos, está em **`PROGRESSO.md` → "Checklist de
> infraestrutura"**. O resumo:

1. **Supabase**: novo projeto, rodar `supabase/schema.sql` inteiro no SQL
   Editor, conferir as 11 tabelas e o bucket `progresso`, e em *Authentication →
   Providers → Email* deixar **Confirm email desligado**. Copiar a *Project URL*
   e a chave **anon public** (a `service_role` nunca sai do painel).
2. **Repositório**: o código de produção fica em `main`, no repositório privado
   `SAV1BOY/WORKOUT`. A camada visual v2.1 está no **PR #2** — sem o merge, o
   celular continua com o app antigo.
3. **Vercel**: importar o repositório com *Production Branch* `main` e criar as
   três variáveis em **Production e Preview**:

   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | a *Project URL* do Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a chave **anon public** |
   | `ALLOWED_EMAIL` | `miguelgsaviotti29@gmail.com` |

   As duas `NEXT_PUBLIC_*` são lidas em tempo de execução: mudar o valor e dar
   **Redeploy** basta. Em *Settings → Deployment Protection*, a proteção da
   Vercel tem que ficar em **Only Preview Deployments** — em *All Deployments*
   ela manda o celular para o login da Vercel.
4. **Supabase → Authentication → URL Configuration**: *Site URL* = a URL da
   Vercel e *Redirect URLs* = `https://SUA-URL.vercel.app/**`. Sem isso a volta
   do login cai no `localhost`.
5. **Conferir**: `/login` recusa qualquer outro e-mail **antes** de falar com o
   Supabase; entrar cria o perfil a partir de `data/perfil.json`; a barra de
   baixo tem as cinco abas; e `https://SUA-URL/sw.js` responde 200.

## Instalar no celular

1. Abra a URL da Vercel no **Chrome** (Android) ou no **Safari** (iPhone) e
   entre com o e-mail permitido.
2. **Android**: menu ⋮ → *Instalar app*. **iPhone**: Compartilhar → *Adicionar à
   Tela de Início*. O ícone laranja aparece como um app e ele abre sem a barra
   do navegador.
3. Na primeira abertura o app guarda sozinho o shell, as ilustrações dos
   exercícios e as fotos do programa da sua fase (uns 5 MB). O resto do catálogo
   entra no cache conforme você abre as fichas.
4. Teste o terraço antes de precisar dele: com o app aberto, ligue o **modo
   avião**, comece o treino, registre duas séries, feche e reabra o app, conclua
   o treino — nada se perde; ao desligar o modo avião tudo sobe em segundos e
   Mais → *Sincronização* volta a dizer "Tudo sincronizado".

## Se algo der errado

- "Invalid API key" ou tela em branco depois do login: as variáveis de ambiente
  estão erradas ou faltam na Vercel (Settings → Environment Variables) — corrija
  e faça **Redeploy**.
- Login recusado com o e-mail certo: confira `ALLOWED_EMAIL` (sem espaços) e se
  o *Confirm email* está desligado no Supabase.
- O `schema.sql` pode ser rodado mais de uma vez (usa `if not exists` e recria
  as policies).
- Fotos não sobem: o bucket `progresso` precisa existir (o SQL cria) e o arquivo
  precisa ser JPG/PNG de até 5 MB; o app redimensiona antes de subir.
- A tela ficou parada abrindo: passados 12 s aparece a faixa "O app não terminou
  de abrir." com **Recarregar** (`lib/vigia.ts`).
- Falta de imagem depois de mexer em `assets/` ou `data/`: `npm run validar`
  aponta o arquivo que não existe, e `npm run assets` recopia para `public/`.

## Créditos dos assets

O app mostra imagens de terceiros, e todas exigem atribuição. Ela está dentro
do app, em **Mais → Créditos**, e sob cada ilustração na ficha do exercício.

| O quê | De onde | Licença |
|---|---|---|
| Ilustrações de 77 dos 81 exercícios (`assets/ilustracoes/`) | Everkinetic, via Wikimedia Commons (66), e colaboradores do wger (11) | CC BY-SA 3.0 / 4.0 |
| Mapa muscular anatômico (`assets/mapa-muscular/mapa-anatomico.svg`) | MuscleMap, de Melih Colpan, pela conversão publicada em openGym | MIT |
| Fotos de execução (`assets/fotos/`) | free-exercise-db | Unlicense (domínio público) |
| Figuras animadas, textos e dados | feitos para este projeto a partir do *Guia de treino da garagem* | — |
| Fotos dos 10 itens do terraço (`assets/itens/`) | anúncios dos produtos comprados pelo dono | **sem licença livre** — exceção da SPEC §15.3: inventário particular, atrás de login, fora das capas do Explorar |

Quem é o autor de cada ilustração está em `data/ilustracoes.json` (uma entrada
por exercício, com autor, licença e link para a página da fonte) e em
`data/ilustracoes-creditos.md`, que é a mesma lista em texto. As de bitmap
foram reduzidas a 640 px de largura e convertidas para WebP (as vetoriais
continuam SVG); **as versões redimensionadas continuam sob CC BY-SA**, com o
mesmo autor. O texto da licença MIT do mapa anda junto do desenho, em
`assets/mapa-muscular/LICENCA-mapa-anatomico.md`, que também explica como o SVG
foi derivado (`scripts/gerar-mapa-anatomico.py`) e que o app abre em Mais →
Créditos.

Para refazer a importação a partir de um levantamento novo:
`npm run ilustracoes <pasta>` (`scripts/importar-ilustracoes.ts` — escolhe uma
ilustração por exercício, converte, e reescreve `data/ilustracoes.json` e os
créditos). O resultado é versionado; o script não roda no build.
