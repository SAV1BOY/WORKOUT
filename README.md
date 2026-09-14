# Kit do app "Treino do Terraço" — como usar com o Claude Code

Este zip é tudo que o Claude Code precisa para construir o seu app de treino: a especificação (`SPEC.md`), as instruções para ele (`CLAUDE.md`), os dados prontos (`data/`), os assets (`assets/`), o banco (`supabase/schema.sql`) e o prompt inicial (`PROMPT-INICIAL.md`). Siga os passos na ordem. Tempo total de setup: uns 20 minutos, sem contar o tempo em que o Claude Code programa.

## O que tem aqui

```
kit-app-treino/
├── README.md              ← este arquivo
├── PROMPT-INICIAL.md      ← o texto que você cola no Claude Code
├── CLAUDE.md              ← instruções permanentes que o Claude Code lê sozinho
├── SPEC.md                ← a especificação completa do app
├── data/
│   ├── exercicios.json    ← 81 exercícios com tudo (músculos, passos, séries, progressão, figura, fotos)
│   ├── programa.json      ← Fase 1 e Fase 2, os 6 treinos, a semana dia a dia
│   ├── cardio.json        ← corrida (12 semanas), corda, barra fixa (12 semanas), teste da fala
│   ├── progressao.json    ← quando subir carga/reps, o que fazer quando falhar
│   ├── equipamentos.json  ← o que você tem, pesos e capacidades, anilhas, o terraço
│   └── perfil.json        ← seus dados iniciais (peso e medidas ficam para preencher no app)
├── assets/
│   ├── figuras/           ← 67 figuras de execução em SVG (66 animadas)
│   ├── fotos/             ← 162 fotos de execução (início e fim de cada exercício)
│   ├── mapa-muscular/     ← o boneco frente/costas com os músculos destacáveis
│   └── itens/             ← fotos e fichas dos 10 itens comprados
├── supabase/schema.sql    ← as tabelas, permissões e o bucket de fotos
└── docs/                  ← o guia de treino, o manual da garagem e o catálogo (referência)
```

## Passo 1 — Descompactar

1. Extraia o zip numa pasta sua, por exemplo `C:\Projetos\treino-terraco` (Windows) ou `~/Projetos/treino-terraco` (Mac/Linux).
2. Confira que dentro dela estão `CLAUDE.md`, `SPEC.md`, `data/`, `assets/`, `supabase/`. O Claude Code vai criar o projeto Next.js **nessa mesma pasta**, ao lado desses arquivos.

## Passo 2 — Criar o projeto no Supabase (grátis)

1. Abra https://supabase.com/dashboard e entre com a sua conta (ou crie uma com o e-mail miguelgsaviotti29@gmail.com).
2. Clique em **New project**. Preencha: *Name* `treino-terraco`, *Database Password* (crie uma senha forte e **guarde**), *Region* `South America (São Paulo)`. Clique em **Create new project** e espere o status ficar verde (1–2 min).
3. No menu esquerdo clique em **SQL Editor** → **New query**. Abra o arquivo `supabase/schema.sql` deste kit, copie **todo** o conteúdo, cole no editor e clique em **Run** (ou Ctrl+Enter). Deve aparecer "Success. No rows returned". Se aparecer erro, copie a mensagem e mande para o Claude Code corrigir.
4. Confira: menu **Table Editor** deve listar `profiles`, `sessions`, `session_sets`, `cardio_sessions`, `body_weights`, `progress_photos` e as demais. Menu **Storage** deve mostrar o bucket `progresso`.
5. Menu **Authentication → Providers → Email**: deixe *Enable Email provider* ligado e **desligue** *Confirm email* (é só você; evita o passo do e-mail de confirmação). Salve.
6. Menu **Project Settings** (engrenagem) → **API**. Copie e guarde num bloco de notas:
   - **Project URL** (algo como `https://xxxxxxxx.supabase.co`)
   - **anon public** key (a chave longa que começa com `eyJ...`)
   Não use a `service_role` em lugar nenhum do app.

## Passo 3 — Abrir o Claude Code na pasta

1. Abra o terminal na pasta do kit (no Windows: botão direito na pasta → "Abrir no Terminal"; no VS Code: Terminal → New Terminal).
2. Rode `claude` (o Claude Code precisa estar instalado: `npm install -g @anthropic-ai/claude-code`). Node 20+ é necessário: confira com `node -v`.
3. Ele vai ler o `CLAUDE.md` sozinho. Cole o conteúdo de `PROMPT-INICIAL.md` como a primeira mensagem e envie.
4. Quando ele pedir as chaves, crie o arquivo `.env.local` na raiz da pasta com:
   ```
   NEXT_PUBLIC_SUPABASE_URL=cole_a_Project_URL_aqui
   NEXT_PUBLIC_SUPABASE_ANON_KEY=cole_a_anon_key_aqui
   ALLOWED_EMAIL=miguelgsaviotti29@gmail.com
   ```
   (ou peça a ele para criar o arquivo e cole os valores). Esse arquivo não vai para o Git.
5. Deixe-o trabalhar pelos marcos. A cada marco ele deve rodar build, lint e testes e escrever `PROGRESSO.md`. Se ele perguntar algo que está em `SPEC.md`, responda "está na spec, seção X".

## Passo 4 — Testar no computador

1. `npm run dev` → abra http://localhost:3000.
2. Crie a sua conta na tela de login com **o e-mail permitido** e uma senha. Qualquer outro e-mail tem que ser recusado.
3. A tela Hoje deve mostrar o treino do dia (segunda = Treino A). Faça um treino de teste registrando 2 ou 3 séries e conclua; abra Progresso e Histórico e veja se apareceu. Depois apague a sessão de teste no Histórico (ou mantenha, se foi treino de verdade).

## Passo 5 — Publicar na Vercel e instalar no celular

1. Crie um repositório no GitHub (privado) e suba a pasta: `git init`, `git add .`, `git commit -m "kit + app"`, e siga as instruções do GitHub para o `git remote add` e `git push`. O Claude Code faz isso se você pedir.
2. Em https://vercel.com/new importe o repositório. Em **Environment Variables** adicione as três variáveis do `.env.local`. Clique em **Deploy**. No fim aparece a URL (`https://treino-terraco.vercel.app` ou parecida).
3. No Supabase, menu **Authentication → URL Configuration**: em *Site URL* coloque a URL da Vercel e em *Redirect URLs* adicione `https://SUA-URL.vercel.app/**`. Salve.
4. No celular, abra a URL no Chrome (Android) ou Safari (iPhone) e faça login. **Android**: menu ⋮ → "Instalar app" (ou "Adicionar à tela inicial"). **iPhone**: botão Compartilhar → "Adicionar à Tela de Início". O ícone aparece como um app.
5. Teste no terraço: abra o treino, coloque o celular em modo avião, registre duas séries, tire do modo avião — nada pode se perder.

## Se algo der errado

- "Invalid API key" ou tela em branco após login: as variáveis de ambiente estão erradas ou faltam na Vercel. Confira o `.env.local` e o painel da Vercel (Settings → Environment Variables) e faça **Redeploy**.
- Login recusado com o e-mail certo: confira `ALLOWED_EMAIL` (sem espaços) e se o *Confirm email* está desligado no Supabase.
- Erro ao rodar o `schema.sql` de novo: ele pode ser executado mais de uma vez (usa `if not exists`); se der conflito de policy, rode de novo — as policies são recriadas.
- Fotos não sobem: o bucket `progresso` precisa existir (o SQL cria) e o arquivo precisa ser JPG/PNG de até 5 MB; o app redimensiona antes de subir.
- Qualquer outro erro: cole a mensagem inteira no Claude Code.

## Créditos dos assets

Fotos de execução: free-exercise-db (domínio público). Figuras, mapa muscular, textos e dados: feitos para este projeto a partir do *Guia de treino da garagem* (setembro de 2026). Fotos dos itens: anúncios dos produtos comprados.
