# Prompt inicial para o Claude Code

Copie tudo abaixo da linha e cole como a primeira mensagem no Claude Code, aberto na pasta do kit.

---

Quero que você construa o app "Treino do Terraço" nesta pasta, seguindo `CLAUDE.md` e `SPEC.md` à risca. É um app pessoal, só meu, para fazer e registrar a minha rotina de treino no celular.

Antes de escrever código:
1. Leia `CLAUDE.md`, `SPEC.md` inteiro, `supabase/schema.sql`, `data/programa.json`, `data/progressao.json` e olhe a estrutura de `data/exercicios.json` (81 exercícios) e de `assets/`.
2. Me devolva um plano curto: a estrutura de pastas que vai criar, as bibliotecas com versões, e a lista dos 6 marcos da seção 12 da spec com o que cada um entrega. Não espere aprovação — depois de mostrar o plano, comece pelo marco 1.

Regras que não abro mão:
- O conteúdo (exercícios, treinos, cardio, regras) vem dos JSON em `data/`, importados com tipos Zod. Nada de copiar conteúdo para dentro do código.
- O motor de progressão (`lib/progressao.ts`) e a montagem da barra (`lib/montagem.ts`) são funções puras com testes Vitest escritos antes da UI, cobrindo os casos da seção 6 e do critério de aceite 4 e 5.
- Celular primeiro (360 px), registro por série com steppers e teclado numérico, timer de descanso que vibra, tela acesa durante a sessão, e nenhuma série se perde sem rede (IndexedDB + fila para o Supabase).
- Interface toda em português do Brasil, vírgula decimal, datas dd/mm.
- Ao fim de cada marco: `npm run lint`, `npm run build`, `npm test` verdes, um commit em português e um `PROGRESSO.md` atualizado dizendo o que foi feito e como eu testo no celular.

O banco já está criado no Supabase com o `schema.sql`. Vou colocar as chaves em `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ALLOWED_EMAIL`). Se o arquivo ainda não existir quando você precisar dele, crie um `.env.local.example` e me avise.

Comece hoje pelo marco 1 e vá até onde conseguir sem me perguntar nada que já esteja na spec. Quando terminar o marco 3 (sessão de força funcionando de ponta a ponta com o motor de progressão testado), pare e me mostre como testar.
