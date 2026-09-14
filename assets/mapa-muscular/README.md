# Mapa muscular

`corpo-sprite.svg` tem dois símbolos: `#bf` (frente) e `#bb` (costas), viewBox 0 0 50 88. Cada região usa `fill="var(--m-<musculo>, var(--mbody))"`.
`musculos.css` define as classes `p-<musculo>` (principal → `--mprim`) e `s-<musculo>` (secundário → `--msec`) e as cores padrão (claro/escuro).

Uso: coloque o sprite inline uma vez na página (ou importe como componente), e para cada exercício renderize
`<figure class="p-peito s-triceps s-ombro"><svg viewBox="0 0 50 88"><use href="#bf"/></svg><svg viewBox="0 0 50 88"><use href="#bb"/></svg></figure>`
com as classes montadas a partir de `musculos_primarios` e `musculos_secundarios` de `data/exercicios.json`. `exemplo-supino.svg` mostra o resultado.

Músculos: trapezio, ombro, ombrop, peito, biceps, triceps, antebraco, dorsal, abdomen, obliquo, lombar, gluteo, quadriceps, posterior, adutor, panturrilha.
