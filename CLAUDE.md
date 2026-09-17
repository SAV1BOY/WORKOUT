# CLAUDE.md — Treino do Terraço

Você está construindo um app de treino cujo dono é o Miguel e que aceita outras contas dentro de uma cota que ele administra (SPEC §21). Este repositório começa com o **kit**: a especificação, os dados prontos e os assets. Seu trabalho é transformar isso no app descrito em `SPEC.md`.

## Leia nesta ordem antes de escrever código
1. `SPEC.md` — o que o app faz, telas, modelo de dados, motor de progressão, critérios de aceite, marcos.
2. `data/*.json` — o conteúdo (81 exercícios, programa, cardio, progressão, equipamentos, perfil). É a fonte da verdade; o app lê daqui.
3. `supabase/schema.sql` — o banco. Não invente tabelas paralelas; se precisar mudar o schema, edite este arquivo e diga o que mudou.
4. `assets/` — figuras animadas (SVG), fotos, mapa muscular, fotos dos itens. `assets/mapa-muscular/README.md` explica o sprite.
5. `docs/` — o guia de treino e o manual originais, só para entender o tom e tirar dúvidas de conteúdo.

## Stack (fechada — não trocar)
Next.js 15 App Router · TypeScript estrito · React 19 · Tailwind · shadcn/ui · Supabase (`@supabase/ssr`) · Vercel · PWA com Serwist · Zod · TanStack Query · Recharts · date-fns (pt-BR) · Vitest · Dexie (IndexedDB) para a sessão em andamento e a fila offline.

## Regras de trabalho
- **Conteúdo vem dos JSON.** Nunca copie exercícios, séries, regras ou textos do guia para dentro do código: importe `data/*.json` com tipos gerados por Zod (`lib/schemas.ts`) e valide no build. Se um dado estiver errado, corrija o JSON.
- **Motor de progressão = funções puras + testes.** `lib/progressao.ts` e `lib/montagem.ts` sem dependência de React ou Supabase, cobertos por Vitest antes de ligar na UI — os casos estão em `docs/casos-de-teste-progressao.md`.
- **Celular primeiro.** Tudo a 360 px de largura, uma mão, teclado numérico, alvos ≥ 44 px. Só depois o desktop.
- **Nunca perder um registro.** Cada série digitada vai para o IndexedDB na hora; o envio ao Supabase é assíncrono com fila e retry.
- **pt-BR em toda a interface**, vírgula decimal na tela, datas dd/mm, semana começa na segunda.
- Contas com cota (SPEC §21): RLS em tudo; `ALLOWED_EMAIL` é o **dono** — quem vê e muda o limite de contas em Mais → Contas. Nunca colocar a service role no cliente.
- Sem gamificação, sem feature fora de `SPEC.md` §11. Pequeno e sólido.
- Commits pequenos por marco (§12 da spec), mensagens em português, `npm run lint && npm run build && npm test` verdes antes de cada commit.
- Ao terminar cada marco, escreva em `PROGRESSO.md` o que foi feito, o que falta e como testar no celular.

## Quando perguntar e quando decidir
Decida sozinho tudo que for implementação (estrutura de pastas, componentes, nomes). Pergunte só se algo em `SPEC.md` for contraditório ou se faltar um dado que não dá para inferir. Nunca pergunte "posso continuar?": siga os marcos.

## Comandos que o projeto deve ter
```
npm run dev        # desenvolvimento
npm run build      # build de produção (valida os JSON antes)
npm run lint
npm test           # vitest
npm run validar    # scripts/validar-dados.ts — confere data/*.json e os assets referenciados
npm run assets     # scripts/copiar-assets.ts — copia assets/ para public/
```

## Variáveis de ambiente (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ALLOWED_EMAIL=miguelgsaviotti29@gmail.com
```
