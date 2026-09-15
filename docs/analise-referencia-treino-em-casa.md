# Análise da referência "Treino em Casa" e adaptação para o Treino do Terraço

Data: 15/09/2026. Base: 16 capturas de tela do app *Home Workout — No Equipment* (Leap Fitness, versão pt-BR "Treino em Casa") enviadas pelo dono, mais três pesquisas encomendadas para esta decisão (arquitetura de 11 apps comerciais, padrões de UX com medidas e fontes, e apps/bases open source — esta última em `docs/estudo-apps-de-treino.md`). O objetivo pedido: **o site e o PWA ficarem quase idênticos à referência**, mantendo o que é nosso (registro por série com carga, motor de progressão, conteúdo dos JSON, offline) e o estilo escuro com laranja já escolhido.

Este documento é a análise. O contrato para os agentes construírem fica em `SPEC.md` §14 (escrito a partir daqui).

---

## 1. O que a referência faz, tela a tela, e o que fazemos com cada uma

| # | Tela da referência | O que ela mostra | O que já temos | O que muda no nosso app | Decisão |
|---|---|---|---|---|---|
| A | **Treino** (home) | Título em caixa alta, chama da sequência, busca, card "Meta semanal 0/4" com lápis e faixa dom–sáb com hoje marcado, carrossel "Desafio" (capa em foto, "28 dias", botão "Iniciar o dia 1"), "Parte do corpo em foco" com chips e lista (foto, nome, min · nº exercícios, raios), chips de filtro, bloco "Personalizar treino" | Hoje com cards do dia, faixa da semana (V1), meta e sequência (V1) | Mesma ordem vertical: cabeçalho com chama e meta editável; **card do dia** (nossa versão do "1º DIA"); carrossel **Desafios** = os planos reais (barra fixa 12 semanas, 5 km em 12 semanas, Fase 1); **Parte do corpo em foco** = os 8 grupos com listas derivadas; chips = duração / com ou sem equipamento / cardio / core; **Personalizar** = sessão livre | Adotar. Faixa seg–dom (spec), não dom–sáb |
| B | **Card do dia "1º DIA"** | Foto grande, título, `9 min · 11 exercícios`, engrenagem, botão largo "Início", lista "Exercícios / Editar" com ilustração, nome, `00:20` ou `×16`, ícone ⇄, alças de arrastar, FAB "Ajustar" | Card do treino do dia com capa (V1), lista com miniatura + prescrição + carga (V1), substituir | Título vira "Treino A · semana 3 da Fase 1"; a linha mostra **reps e carga com o rótulo do implemento** (`3 × 5 · 9,5 kg na barra`), não só tempo; ⇄ abre os substitutos; **Editar** liga o modo reordenar (alças + setas ↑↓, ordem só desta sessão); **Ajustar** abre descanso padrão, preparação, voz, vibração, tela acesa | Adotar |
| C | **Ficha em folha** | Título + "Substituir"; mídia com abas **Vídeo · Músculos · Tutorial**; stepper **Duração** (−/+); **Instruções**; **Área de foco** em chips (ponto forte = primário, claro = secundário); mapa muscular frente/costas; navegação 1/11 (anterior/próximo); "Fechar" | Ficha com figura animada, 2 fotos, mapa muscular primário/secundário, passos, erro comum, histórico e recorde | Mesma folha e as mesmas três abas: **Vídeo** = figura animada (ou vídeo local opcional); **Músculos** = figura + mapa; **Tutorial** = vídeo do YouTube curado em `data/tutoriais.json`, carregado só ao tocar (miniatura + play) e escondido sem rede; stepper ajusta **a prescrição desta sessão** (reps, tempo ou séries), sem mexer no estado do motor; chips de foco vêm de `musculos_primarios/secundarios`; anterior/próximo percorre os exercícios do treino; histórico e recorde continuam abaixo | Adotar |
| D1 | **Preparação** | "PREPARADO PARA COMEÇAR", nome do exercício com "?", anel de contagem (12), seta para pular | Não existe | Tela de preparação de 10 s (ajustável em Ajustar) antes do 1º exercício e ao retomar; "?" abre a ficha por cima | Adotar |
| D2 | **Exercício** | Figura animada grande; ícones vídeo · música · configurações no topo; gostei/não gostei; barra fina de progresso do treino; nome + "?"; `×16` ou contagem regressiva; seletor "Repetições ⇄" (troca reps/tempo); botões anterior · ✓ · próximo | Página de sessão com rolagem, um bloco por exercício, linhas de série | **Player unificado** (§3 abaixo): a mesma coreografia; para barra, halteres e polia o passo mostra `Série 1 de 3 · 9,5 kg na barra · 5 reps` com steppers, e o ✓ conclui a série; para peso corporal, tempo, corda e elástico, igual à referência. Vídeo = abre a ficha; música = fora; configurações = Ajustar; gostei/não gostei = marca o exercício como "evitar" para as substituições | Adotar com a adaptação |
| D3 | **Descanso** | Tela cheia na cor de destaque: figura do próximo, "PRÓXIMO 2/11", nome × reps, "DESCANSO 00:18", "Editar tempo de descanso", "+20s", "Pular" | Barra de descanso fixa no topo | Tela cheia de descanso com o próximo exercício (ou a próxima série do mesmo) e os mesmos três controles; descanso vem de `descanso_s` do exercício; vibração + som ao zerar (som sempre, vibração onde existir) | Adotar. Cor: laranja escurecido, não azul |
| E | **Feedback** | "O que você achou do treino de hoje?" com 5 opções de "Muito fácil" a "Muito difícil"; "Concluído" | Sensação 1–5 no resumo | As 5 opções gravam `sessions.sensacao` 1–5; a pergunta por exercício "última repetição firme?" (que alimenta o motor) fica no fim de cada exercício do player, não aqui | Adotar |
| F | **Conclusão** | Capa em foto, "Excelente! Você concluiu…", contadores Exercícios · Caloria · Hora, card "SEMANA 1 · 1/7" com círculos e troféu, Peso (kg/lb), IMC com barra, "Próximo", lembrete, compartilhar, confete | Resumo com ↑ = ↓ por exercício, recordes, peso opcional | Capa (foto do 1º exercício), contadores **Exercícios · Minutos · Volume** (sem kcal), **o resumo do motor** (o que subiu, repetiu, voltou, recordes) logo abaixo porque é o nosso diferencial, card da semana com a meta (círculos seg–dom e o troféu quando fecha), peso do dia com IMC, "Próximo" volta para Treino | Adotar sem confete (SPEC §7), sem kg/lb, sem "agendar lembrete" (notificação push está fora do escopo §11) e sem compartilhar |
| G | **Descobrir** | Card-artigo com foto e texto, "Escolhas para você" (foto, título, `20 min • Iniciante`), card de coleção com foto ("5 treinos"), "Para iniciantes"… | Catálogo com busca e filtros | **Explorar** com a mesma cara: busca no topo, um destaque (o treino de hoje ou o plano da semana), listas de coleções derivadas com capa, `N exercícios · ~M min · raios`, e o catálogo dos 81 abaixo. Nenhum texto de marketing: as descrições são as do JSON (foco, subtítulo, regra) | Adotar |
| H | **Relatório** | Contadores treino · kcal · minuto; "Histórico" com faixa da semana e "Todos os registros"; "Sequência de dias"; Peso (Registrar, atual, maior/menor, gráfico); BMI (Editar, barra, "Saudável", altura) | Progresso com gráficos e recordes; Corpo com peso/medidas/fotos | Mesma ordem: contadores **treinos · minutos · volume**; histórico com faixa da semana, "Todos os registros" e sequências; cards de Peso e IMC (linkam para Corpo); os gráficos e recordes atuais abaixo | Adotar |
| — | **Definição** | Não enviada | Mais (perfil, equipamento, preferências, backup) | Ganha: meta semanal, tempo de preparação, descanso padrão, voz, "mostrar raios" | Manter |

---

## 2. As três diferenças estruturais entre a referência e o nosso app

**1. Player que avança sozinho × registro por série com carga.** A pesquisa confirmou o que as capturas mostram: o player com contagem regressiva é exclusivo dos apps sem carga (Leap, Nike Training Club, Freeletics). Nenhum app de força com registro de série (Hevy, Strong, Fitbod, JEFIT, Caliber) usa esse fluxo, porque a carga e as repetições reais precisam ser digitadas. Solução: **um player unificado, com a coreografia da referência e o passo do exercício adaptado ao tipo** (§3). Assim o app fica quase idêntico no uso e continua registrando o que o motor precisa.

**2. Conteúdo fabricado × conteúdo derivado.** A referência vive de centenas de rotinas e textos escritos por uma equipe. Nós temos 81 exercícios, 6 treinos, 3 planos e as regras do guia em JSON, e a regra do projeto é não inventar conteúdo. As vitrines ("Desafio", "Parte do corpo em foco", "Escolhas para você") são recriadas **derivando coleções dos JSON**: os desafios são os planos reais com progresso pela semana do perfil; as coleções por grupo, por aparelho e por circuito saem dos campos `grupo`, `equipamento`, `origem` e `categoria`; a dificuldade em raios sai de `categoria`. Fotos de capa só de `assets/` (fotos de execução, itens do terraço, figuras). Nada de imagens da referência.

**3. Métricas.** Calorias sem sensor são chute (o estudo de Stanford citado na pesquisa mediu 27 % a 93 % de erro *com* sensor). Trocamos por minutos e volume, que são medidos. IMC entra porque é peso ÷ altura² e o dono pediu, com a ressalva de que sobe quando o treino está funcionando.

---

## 3. O player unificado (a peça central da adaptação)

Sequência para qualquer sessão (treino do programa, sessão livre, circuito, barra fixa):

1. **Preparação** (10 s, ajustável): anel de contagem, nome do 1º exercício, "?" para a ficha, pular.
2. **Exercício**, com o passo dependendo do tipo:
   - **Barra, halteres, polia, lastro** (`implemento` barra_macica · halteres · barra_w · polia · barra_fixa com lastro): a tela mostra a figura, o nome, `Série 1 de 3`, a **carga de hoje com o rótulo do implemento** e as **reps** em número grande, steppers − / + para os dois (passos de `progressao.incremento_kg` e 1 rep), toque no número abre o teclado numérico, "montagem" mostra as anilhas por lado. O **✓ conclui a série** (grava no IndexedDB na hora) e abre o **Descanso**; após a última série, a pergunta **"Última repetição saiu firme?"** (Fácil · Firme · Falhei) e o próximo exercício. Aquecimento (2 séries no 1º exercício pesado) aparece como passos "Aquecimento 1 de 2" antes das séries de trabalho. Unilateral: dois números (D/E). Anterior/próximo navegam entre exercícios; a série anterior pode ser corrigida pela **lista** (ícone no topo) que mostra a sessão inteira como hoje.
   - **Peso corporal e anilha com faixa de reps** (abdominais, flexões, elevação de pernas…): `×12` grande com − / + e o ✓ conclui a série; séries e descanso iguais.
   - **Tempo** (prancha, escalador, corrida no lugar): contagem regressiva grande, pausa, "Repetições ⇄ Tempo" quando o exercício aceita os dois.
   - **Máximo** (barra fixa, flexão até a falha): número de reps feitas com − / + e ✓.
   - **Assistida** (barra fixa com elástico): reps + seletor do degrau do elástico.
3. **Descanso** em tela cheia com o próximo passo (próxima série ou próximo exercício), "Editar tempo", "+20 s", "Pular"; som ao zerar e vibração onde existir; a tela fica acesa (Wake Lock).
4. **Feedback**: "O que você achou do treino de hoje?" (5 opções → `sensacao` 1–5).
5. **Conclusão**: capa, contadores, resumo do motor (↑ subiu · = repetiu · ↓ voltou · recordes), semana com a meta, peso do dia com IMC, "Próximo".

Regras que não mudam: cada toque grava no IndexedDB antes de qualquer animação; a fila envia ao Supabase; fechar e reabrir volta ao mesmo passo; sem rede tudo funciona; o motor (`lib/progressao.ts`) e a montagem (`lib/montagem.ts`) são os mesmos, só a tela muda.

---

## 4. Decisões, item a item

| Item da referência | Decisão | Motivo |
|---|---|---|
| Confete na conclusão | **Não** — animação curta e sóbria do anel/✓ | SPEC §7 ("sem confete"); o estilo escolhido é sóbrio |
| kcal | **Não** — minutos e volume | sem sensor é chute; pesquisa §5 |
| kg / lb | **Não** — só kg | pt-BR, um usuário |
| Agendar lembrete / notificação | **Não por ora** | push está fora do escopo (§11); no PWA, notificação agendada não é confiável no iPhone. Possível depois: "adicionar ao calendário" (.ics) |
| Compartilhar | **Não** | fora do escopo (social, §11) |
| Música | **Não** | o celular já toca música; o app não deve controlar áudio |
| Gostei / não gostei no exercício | **Sim, leve** | "não gosto" marca o exercício para aparecer por último nas substituições e no Explorar; nada mais |
| Tutorial no YouTube | **Sim** | um vídeo por exercício, curado em `data/tutoriais.json` (81 entradas, revisáveis), embed `youtube-nocookie` só ao tocar; sem rede a aba some |
| Vídeo próprio | **Opcional** | `assets/videos/<id>.mp4`, se existir, substitui a figura (SPEC §13.1) |
| Stepper de duração/reps na ficha | **Sim** | ajusta só a prescrição da sessão de hoje |
| Editar (reordenar) a lista do dia | **Sim** | ordem só desta sessão, com alças e setas ↑↓ |
| "Ajustar" (FAB) | **Sim** | descanso padrão, preparação, voz, vibração, tela acesa, raios |
| Chama de sequência | **Sim** | semanas seguidas com a meta cumprida (não dias) |
| Meta semanal editável | **Sim** | `prefs.meta_semanal`, padrão pela fase |
| Raios de dificuldade | **Sim** | derivados de `categoria` |
| Desafios | **Sim, os reais** | barra fixa 12 semanas, 5 km em 12 semanas, Fase 1 (12 semanas); progresso pela semana do perfil |
| Carrossel de desafios | **Sim, manual** | sem rotação automática (pesquisa §1) |
| Busca no topo do Treino | **Não** — só em Explorar | evita duplicar; a home é para começar |
| Chips de filtro (">15 min", "Alongamento", "Queime gordura"…) | **Parcial** | os que temos dado: duração estimada, com/sem equipamento, cardio, core |
| "PRO" | **Não** | não há assinatura |
| Faixa dom–sáb | **Não** — seg–dom | SPEC §1 (semana começa na segunda) |
| IMC com "Saudável" | **Sim** | com a faixa e a ressalva de uma linha |
| Cor azul | **Não** — escuro com laranja | decisão do dono em 15/09 |

---

## 5. O que vai em cada aba

- **Treino** (`/`): cabeçalho (título, chama, meta), banner de sessão aberta, **card do dia** (capa, título, min · exercícios, raios, "Começar"), demais cards do dia (cardio, reps soltas, treinar mesmo assim), **lista do treino** (miniatura, nome, prescrição + carga, ⇄, Editar/reordenar, Ajustar), **Desafios** (carrossel manual dos planos), **Parte do corpo em foco** (chips + lista), **Personalizar** (sessão livre).
- **Explorar** (`/explorar`): busca; destaque; **Escolhas** (coleções derivadas com capa); por aparelho; circuitos; planos; treinos do programa; catálogo dos 81.
- **Relatório** (`/relatorio`): contadores; histórico (faixa da semana, todos os registros, sequências); Peso e IMC; gráficos e recordes.
- **Corpo** (`/corpo`): peso (com IMC), medidas, fotos.
- **Mais** (`/mais`): perfil, equipamento, preferências (meta, preparação, descanso, voz, vibração, tela acesa, raios), backup, sair.

---

## 6. Ordem de construção

| Marco | Entrega | Estado |
|---|---|---|
| V1 | Sistema visual v2, navegação, aba Treino (cards, faixa, meta, lista), sessão restilizada, vídeo opcional, preferências | em construção (workflow D1) |
| V2 | **Player unificado** (preparação, exercício por tipo, descanso em tela cheia, feedback, conclusão), **ficha em folha** com Vídeo · Músculos · Tutorial, stepper, foco, anterior/próximo; reordenar; Ajustar; gostei/não gostei | próximo |
| V3 | Treino: Desafios, Parte do corpo em foco, Personalizar; **Explorar**; **Relatório**; Corpo com IMC; `data/tutoriais.json` e a aba Tutorial; Mais | depois |
| V4 | Auditoria final a 360 px nos dois temas contra este documento e a §14, aceite, fechamento | por último |

Critério de "quase idêntico": alguém que conhece a referência reconhece cada tela e cada gesto (começar, preparar, fazer, descansar, próximo, avaliar, concluir) sem explicação; o que difere é a paleta, a ausência de kcal/confete/lembrete/PRO, e a presença da carga e do resumo do motor.

---

## 7. O que a pesquisa acrescentou a esta decisão

- **Valor anterior ao lado do campo** é o recurso mais universal dos apps de força (Hevy, Strong, Fitbod, Caliber): o passo da série mostra "anterior: 9,5 kg × 5".
- **Timer de descanso dispara sozinho** ao marcar a série (todos os apps de força). Já fazemos; o player mantém.
- **Retomar sessão interrompida** é a falha mais citada do JEFIT; já resolvido pelo IndexedDB e continua obrigatório no player.
- **Medidas** (pesquisa de UX): alvos ≥ 44 px (iOS) / 48 px (Android), contagem regressiva 72–96 px com `tabular-nums`, rótulos de uma palavra em caixa alta, nada condensado ou fino; nav de 5 abas a 72 px cada; 3 contadores de 104 px; gráficos 180–220 px; heatmap com 12–16 semanas, não 52.
- **iPhone**: `navigator.vibrate` não existe (som via WebAudio como fallback), `speechSynthesis` só destrava dentro do toque em "Começar", Wake Lock precisa ser readquirido ao voltar para a aba.
- **Streak**: contar semanas com a meta cumprida, não dias; nunca "sua sequência está em risco".
- **Explorar sem cara de loja**: busca sempre visível, listas densas, coleções úteis, sem carrossel automático, sem "recomendado para você".
- **Tokens atuais**: a paleta escura passa AAA; corrigir `--msec` (músculo secundário, 2,03:1) e criar uma borda forte ≥ 3:1 para campos e chips.
