# Licença e atribuição — mapa muscular anatômico

Arquivo gerado: `mapa-anatomico.svg` (frente + costas, viewBox `39 82 1370 1275`).

## Origem

A **geometria** (todos os contornos de músculos, cabeça, mãos, pés) vem de
**[MuscleMap](https://github.com/melihcolpan/MuscleMap)**, de **Melih Colpan**, publicado sob a
**licença MIT**. O MuscleMap distribui os caminhos como código Swift, não como `.svg`.

A conversão desses caminhos para JSON/JS foi feita pelo projeto
**[openGym](https://github.com/DuarteSantos8/openGym)**, de Duarte Santos, no arquivo
`frontend/src/lib/body-paths.js`. O `NOTICE.md` do openGym declara explicitamente que **essa
geometria continua sob a MIT do MuscleMap**, separada da AGPL v3 que cobre o resto do openGym
(trecho literal em `NOTICE-openGym-trecho.md`; o NOTICE.md completo está no repositório do openGym).

Somente `body-paths.js` foi baixado do openGym. **Nenhum outro arquivo do openGym foi copiado**,
e nada do dataset de exercícios/mídia citado no mesmo NOTICE (ExerciseDB / Gym Visual) foi usado —
aquela mídia tem procedência não resolvida e está fora do escopo deste projeto.

## O que foi feito com a geometria

- só a variante **masculina** (`male.front` + `male.back`); a feminina foi descartada;
- caminhos reagrupados em `<g id="m-<nome>">` com os 16 nomes do app;
- `viewBox` recalculado a partir do bounding box real dos caminhos (+14 de margem);
- `fill` trocado por `var(--m-<nome>, var(--mbody))`, `stroke` por `var(--mline)`;
- nenhum ponto/curva foi alterado.

O script que faz isso é `scripts/gerar-mapa-anatomico.py` (nosso, sem licença herdada).

## Texto da licença MIT (obrigatório manter junto)

```
MIT License

Copyright (c) 2026 Melih Colpan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Atribuição a exibir no app

Sugestão para a tela "Mais → Créditos" (e para `assets/mapa-muscular/README.md`):

> Mapa muscular: geometria derivada de **MuscleMap**, de Melih Colpan (licença MIT), via a
> conversão publicada em **openGym** (`frontend/src/lib/body-paths.js`), também sob MIT.
> Texto completo da licença em `LICENCA.md`.

Se o SVG for redistribuído (o app é público na Vercel), **o bloco MIT acima precisa ir junto** —
basta manter este `LICENCA.md` no repositório e o `<desc>` dentro do próprio `mapa-anatomico.svg`.

## Mapeamento MuscleMap → 16 músculos do app

| vista | parte no MuscleMap | grupo no app |
|---|---|---|
| frente | `trapezius` | `m-trapezio` |
| frente | `deltoids` | `m-ombro` |
| frente | `chest` | `m-peito` |
| frente | `biceps` | `m-biceps` |
| frente | `triceps` | `m-triceps` |
| frente | `forearm` | `m-antebraco` |
| frente | `abs` | `m-abdomen` |
| frente | `obliques` | `m-obliquo` |
| frente | `quadriceps` | `m-quadriceps` |
| frente | `adductors` | `m-adutor` |
| frente | `calves` | `m-panturrilha` |
| frente | `tibialis` | `m-panturrilha` (¹) |
| costas | `trapezius` | `m-trapezio` |
| costas | `deltoids` | `m-ombrop` |
| costas | `upper-back` | `m-dorsal` (²) |
| costas | `triceps` | `m-triceps` |
| costas | `forearm` | `m-antebraco` |
| costas | `lower-back` | `m-lombar` |
| costas | `gluteal` | `m-gluteo` |
| costas | `hamstring` | `m-posterior` |
| costas | `adductors` | `m-adutor` |
| costas | `calves` | `m-panturrilha` |

**Os 16 nomes do sprite atual têm correspondência (16/16).**

(¹) `tibialis` é o tibial anterior, não a panturrilha; foi juntado a `m-panturrilha` porque o
sprite atual já pinta a perna de frente quando `panturrilha` é acionado. Se preferir, é um `<g>`
separado de 2 caminhos e pode virar `m-tibial`.

(²) `upper-back` cobre dorsal + romboides; é o mais próximo de `dorsal`.

Sem correspondência, ficam no `#corpo-base` (nunca pintados): `serratus`, `hip-flexors`.
Partes inertes (também no corpo base): `head`, `hair`, `neck`, `hands`, `knees`, `ankles`, `feet`.
