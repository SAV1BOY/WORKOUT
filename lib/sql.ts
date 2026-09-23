/**
 * Ler um arquivo .sql em comandos, para os testes de migração
 * (`lib/migracao-*.test.ts`) compararem a migração com o `schema.sql`.
 */

/** Um espaço só entre palavras, para comparar sem depender da indentação. */
export function normalizar(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/**
 * Os comandos de um arquivo .sql, sem os comentários.
 *
 * Uma varredura só, porque as três coisas se cruzam: o `;` que separa os
 * comandos não vale dentro de `$$ … $$` (o corpo das funções em plpgsql é
 * cheio deles) nem dentro de aspas, e um `--` só abre comentário fora dos
 * dois. Comentário dentro de `$$` fica: é corpo de função, e o corpo tem que
 * ser igual nos dois arquivos. Jogar fora só as linhas que COMEÇAM com `--`
 * não bastava: um "farmer's walk" no fim da linha desregulava a contagem de
 * aspas e o arquivo inteiro virava um comando só.
 */
export function comandos(sql: string): string[] {
  const saida: string[] = [];
  let atual = "";
  let dentroDoCorpo = false;
  let dentroDeAspas = false;
  for (let i = 0; i < sql.length; i += 1) {
    const c = sql[i] as string;
    if (!dentroDeAspas && c === "$" && sql[i + 1] === "$") {
      dentroDoCorpo = !dentroDoCorpo;
      atual += "$$";
      i += 1;
      continue;
    }
    if (!dentroDoCorpo && !dentroDeAspas && c === "-" && sql[i + 1] === "-") {
      const fim = sql.indexOf("\n", i);
      i = fim === -1 ? sql.length : fim;
      atual += " ";
      continue;
    }
    if (!dentroDoCorpo && c === "'") dentroDeAspas = !dentroDeAspas;
    if (c === ";" && !dentroDoCorpo && !dentroDeAspas) {
      const pronto = normalizar(atual);
      if (pronto !== "") saida.push(pronto);
      atual = "";
      continue;
    }
    atual += c;
  }
  const sobra = normalizar(atual);
  if (sobra !== "") saida.push(sobra);
  return saida;
}

/** create / drop / grant / revoke / alter table: o que muda a estrutura. */
export function estruturais(sql: string): string[] {
  return comandos(sql).filter((c) =>
    /^(create|drop|grant|revoke|alter table)\b/i.test(c),
  );
}
