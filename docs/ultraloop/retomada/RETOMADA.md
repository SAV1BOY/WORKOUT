# Retomada — pausa de 24/09/2026 (22:40 UTC)

O dono pediu para parar o desenvolvimento e salvar tudo. Quando ele disser
**"OK, podemos voltar"**, o trabalho continua daqui. Este arquivo tem o
estado exato de cada lote, onde está o código que ainda não foi publicado e o
passo a passo para religar o ultraloop num container novo.

## 1. O que está no ar (não mudou com a pausa)

- Produção: https://treino-terraco.vercel.app — `main` = `a7b7d1b` (L19),
  deployment `dpl_Zyf24MAvTv4JYdYVqosMUu6XqxwN`; `/versao` devolve
  `a7b7d1bc5983db967437a430587419f3386fe0ae` (conferido às 22:40 UTC).
- Publicados nesta etapa: L34 (PR #25), L32 (PR #28), L19 (PR #32), todos
  com fumaça e verificação logada nos dois temas; contas de teste apagadas
  (restam só as 3 contas reais).
- Banco (Supabase `wmqcqexijxtrgjzsrqwp`): migrações `2026_09_23_lembretes_inscricoes`
  e `2026_09_23_lembretes_disparo` aplicadas; Vault com `lembretes_url` e
  `lembretes_segredo`; job `lembretes` do pg_cron a cada 5 min (a rota
  `/api/lembretes/disparar` existe em produção e responde 401 sem o segredo).
  **Não aplicada**: `2026-09-24-lembretes-tick-limitado` (é do L35; só entra
  junto com o deploy do L35).
- Branch de integração `claude/academia-miguel-index-ekvwi0`: igual a `main`
  em código. À frente só por documentos e por um par de commits que se anulam
  (merge do L33 `1f1b08e` + veredito `aa621a0`, tirados em `4b370b7` depois
  da revisão do Codex no PR #33).

## 2. Pendências do dono

1. **4 variáveis na Vercel (Production)** para os lembretes por push:
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
   `LEMBRETES_SEGREDO`. Os valores foram entregues ao dono no arquivo
   `variaveis-vercel-lembretes.env` (nunca no repositório). O conector da
   Vercel devolveu 403 ao criar variáveis de produção. Se o arquivo se
   perder: gerar um par VAPID novo e um segredo novo, e atualizar o segredo
   `lembretes_segredo` no Vault para o mesmo valor de `LEMBRETES_SEGREDO`.
2. **Capa do plano sem "semana N de 12"** — pergunta 4 de
   `docs/ultraloop/perguntas-ao-dono.md`, ainda sem resposta.

## 3. Lotes em andamento (código só nas branches locais → salvo em bundles)

As branches de lote nunca foram enviadas ao GitHub, para não gerar prévias da
Vercel. Para não perder nada, cada uma foi salva como `git bundle` em
`branches/` (só os commits que não estão em `origin/main`).

| Lote | Branch (head) | Faixa | Onde parou | Próximo passo |
|---|---|---|---|---|
| **L33** Ficha, catálogo e camadas modais (reintegração) | `polimento/l33-reintegrado` (`c22cee3`) | C | Rodada 34: correção do achado do Codex no PR #33 feita (erro de qualquer das 6 leituras do histórico → Erro com "Tentar de novo"; `historicoErro`/`leiturasQueFalharam` em `lib/ficha.ts`). Auditoria 1 reprovou só pelos e2e novos (a repetição do TanStack passava pelo SW e escapava do `page.route`); o corretor refez os e2e com `serviceWorkers: 'block'` (`808688c`). Falha `sem-conexao.spec.ts:334` diagnosticada como teste que corta a rede antes do HTML da cura; conserto do teste pronto em `lotes/l33-patch-semconexao.py` (não aplicado). | Rodar isolado 2× e a mutação m1b dos e2e novos; aplicar o patch do sem-conexão se o isolado confirmar; cadeia inteira; auditoria 2; deploy com `reintegrar: git revert --no-edit 4b370b7`. |
| **L35** Lembretes II: horário, disparo automático e calendário | `polimento/l35-lembretes-disparo` (`11ca3df`) | B | Rodada 31: os 2 importantes da auditoria 1 corrigidos (desfazer só volta ao que estava confirmado; aviso de `.ics` velho) + menores. Cadeia de `505079b` falhou só num e2e novo (instável: o bloco "Este aparelho" crescia depois do recado); teste corrigido em `daedc28`; a cadeia de `daedc28` foi interrompida pela pausa. PROGRESSO da rodada 31 commitado como rascunho. | Cadeia inteira no HEAD; capturas; auditoria 2. Se aprovado: branch nova de `origin/main` + `git revert 9db5a51` + merge da branch do L35 (o dono autorizou), ensaio e aplicação da migração `2026-09-24-lembretes-tick-limitado`, cadeia no código unido, publicar. |
| **L21** Player: séries feitas no Substituir (decisão do dono = b) | `polimento/l21-player` (`738c56b`) | D | Construção completa (cadeia final de `821aca7` estava no e2e quando parou). Auditoria 1 em andamento, **achados parciais da lente regra** (diário, 22:25–22:32): voltar A→B→A com séries não contíguas repete `set_index`; card "Continuar" mostra 19/16 depois da troca; A→B→A perde o "Falhei" e o motor sobe 7,5 → 11,5; `maximo` lê a sessão parcial como anterior; guarda "trocar para si mesmo" sem teste. | Refazer a auditoria 1 (as duas lentes) com a cadeia completa; esses achados quase certamente viram a correção. |
| **L15** Corpo: peso, gráficos e campo de data | `polimento/l15-corpo-peso` (`4275103`) | A | Auditoria 1: tela aprovada; regra reprovou com 2 importantes (data velha na virada do dia; limiares sem teste). Correção feita (`051dc68` SPEC, `fd72b19`, `60d5bae`, `4275103`; 12/12 mutações caem). A cadeia de `4275103` foi interrompida. | Cadeia inteira no HEAD; capturas; auditoria 2; deploy. |

Vereditos completos em `vereditos/`; definição de cada lote em `lotes/`
(`*-lote.json` = itens do ledger com PROBLEMA/FAZER/ACEITE; `*-args-do-fluxo.json`
= argumentos exatos do fluxo `wf-lote` de cada lote); diário completo do
orquestrador em `diario-orquestrador.md`; histórico de deploys em
`deploys-orquestrador.json`.

## 4. Fila (ledger `docs/ultraloop/fila.json`, v3)

151 itens pendentes (B 69 · C 77 · D 5), 19 lotes planejados, 7 dependem do
dono. Depois dos quatro lotes acima: L36 (depois do L35), L16, L17, L18, L20,
L22–L31, L37 (ficha) e L38 (processo). O script do ledger preparado para o
registro do L33 está descrito no `nota_deploy` de `lotes/l33-args-do-fluxo.json`
(foi criado no scratchpad e precisa ser refeito: ele move os 10 itens do L33
para resolvidos e cria os itens C dos menores).

## 5. Como religar (container novo)

```bash
cd /home/user/WORKOUT
git fetch origin && git checkout claude/academia-miguel-index-ekvwi0 && git pull
# 1) recuperar as branches dos lotes
for b in l15-corpo-peso l21-player l33-reintegrado l35-lembretes-disparo; do
  git fetch docs/ultraloop/retomada/branches/$b.bundle "polimento/$b:polimento/$b"
done
# 2) faixas (worktrees) com node_modules por symlink
npm ci
git worktree add ../wt-a polimento/l15-corpo-peso
git worktree add ../wt-b polimento/l35-lembretes-disparo
git worktree add ../wt-c polimento/l33-reintegrado
git worktree add ../wt-d polimento/l21-player
for w in wt-a wt-b wt-c wt-d; do ln -s /home/user/WORKOUT/node_modules ../$w/node_modules; done
# 3) harness no scratchpad novo: copiar harness/*, renomear *.js.txt → *.js e
#    trocar o caminho do scratchpad antigo (/tmp/claude-0/.../scratchpad/ultraloop)
#    pelo novo em todos os arquivos (sed). Base visual: gerar de novo contra main.
```

Faixas: A 3100/54321 · B 3110/54331 · C 3140/54361 · D 3130/54351 · base
3120/54341. `portoes.sh` roda `lint tsc test build build:e2e e2e varredura`
com `flock` num lock único para os portões pesados. Um lote só é publicado
com a cadeia inteira verde no HEAD exato, as 2 lentes aprovadas, o PR
revisado pelo Codex (até 10 min) e fumaça + verificação logada em produção.

Lições desta etapa, para não repetir:
- Quatro faixas disputando um lock único deixaram cada cadeia esperando mais
  de 1 h; com 3 faixas o ritmo foi melhor.
- Ler cada diff como o Codex lê (erro de leitura, `isPending` sem `error`,
  estado velho, corrida com recarregar) **antes** do PR: foi isso que devolveu
  o L35 (PR #30) e o L33 (PRs #31 e #33).
- e2e que simula falha de rede precisa bloquear o service worker
  (`serviceWorkers: 'block'`), senão a repetição escapa do `page.route`.

Depois de recuperar as branches, apagar `docs/ultraloop/retomada/branches/`
num commit de limpeza, para que os bundles não cheguem a `main`.
