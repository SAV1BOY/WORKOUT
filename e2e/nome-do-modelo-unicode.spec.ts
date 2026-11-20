import { expect, test } from "@playwright/test";
import type { ModeloDeTreino } from "../lib/modelo-de-treino";
import { entrarNoApp, fixarData, inserirNoMock, lerDoMock, resetarMock, usuarioComPerfil } from "./fixtures";
import { carregar, dialogo, editor } from "./montar-modelo";

test("o nome da cópia aceita 80 caracteres Unicode e conserva o texto durante a composição", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "O teclado de composição deste cenário usa o Chrome DevTools Protocol.");
  await resetarMock();
  await fixarData(page);
  const conta = await usuarioComPerfil();
  const original: ModeloDeTreino = {
    id: crypto.randomUUID(), user_id: conta.userId, nome: "💪".repeat(72),
    exercicios: ["flexao-de-braco"], equipamento_disponivel: [], series_por_exercicio: null, descansos_por_exercicio: null,
  };
  await inserirNoMock(conta, "modelos_de_treino", [{ ...original }]);
  await entrarNoApp(page);
  await carregar(page, original.nome);
  await editor(page).getByRole("button", { name: "Salvar como cópia", exact: true }).click();
  const folha = dialogo(page, "Salvar como cópia");
  const campo = folha.getByRole("textbox", { name: "Nome do treino" });
  const salvar = folha.getByRole("button", { name: "Salvar", exact: true });
  const prefixoDaCopia = "Cópia de ";
  const emojisNaSugestao = 80 - [...prefixoDaCopia].length;
  await expect(campo).toHaveValue(prefixoDaCopia + "💪".repeat(emojisNaSugestao));
  await campo.press("End");
  await campo.press("Backspace");
  await campo.press("a");
  const editado = prefixoDaCopia + "💪".repeat(emojisNaSugestao - 1) + "a";
  await expect(campo).toHaveValue(editado);

  await page.keyboard.insertText("💪");
  await expect(campo).toHaveValue(editado + "💪");
  await expect(campo).toHaveAccessibleDescription("Use até 80 caracteres no nome do treino.");
  await expect(campo).toHaveAttribute("aria-invalid", "true");
  await expect(salvar).toBeDisabled();
  await campo.press("Enter");
  await expect(folha).toBeVisible();

  const prefixo = "💪".repeat(79);
  await campo.fill(prefixo);
  await campo.press("End");
  const teclado = await context.newCDPSession(page);
  try {
    // Uma leitura fonética pode ser comprida antes de virar um só caractere.
    await teclado.send("Input.imeSetComposition", { text: "かい", selectionStart: 2, selectionEnd: 2 });
    await expect(campo).toHaveValue(prefixo + "かい");
    await expect(folha.getByRole("alert")).toHaveCount(0);
    await teclado.send("Input.insertText", { text: "界" });
  } finally {
    await teclado.detach();
  }
  const nomeFinal = prefixo + "界";
  await expect(campo).toHaveValue(nomeFinal);
  await expect(salvar).toBeEnabled();
  await salvar.click();
  await expect.poll(async () => (await lerDoMock<ModeloDeTreino>(conta, "modelos_de_treino"))
    .map(modelo => modelo.nome).sort()).toEqual([original.nome, nomeFinal].sort());
});
