import { expect, test } from "@playwright/test";
import {
  abrirVisaoGeral, comecarNoPlayer, entrarNoApp, esperarAbaTreino, fixarData, lerDoMock, marcarSerieNaVisaoGeral,
  naFila, resetarMock, usuarioComPerfil,
} from "./fixtures";
import { ajustar, ajustes, campo, carregar, descanso, dialogo, editor, escolher, iniciar, personalizar, pronto } from "./montar-modelo";
import { geral, planoSalvo } from "./treino-livre-ativo";

test("cada sessão recebe os 95 segundos da rosca e mantém os 70 segundos da conta ao restaurar o descanso", async ({ page }) => {
  test.slow(); // Compara as contagens do player em duas sessões reais da mesma montagem.
  await resetarMock();
  await fixarData(page);
  const conta = await usuarioComPerfil({ prefs: { descanso_padrao_s: 70, preparacao_s: 0, avancar_sozinho: false } });
  const rosca = "Rosca com elástico";
  const remada = "Remada com elástico";
  const nome = "Puxadas de sexta";
  await entrarNoApp(page);
  await personalizar(page).press("Enter");
  await escolher(page, rosca);
  await escolher(page, remada);
  await ajustar(page).click();
  await expect(ajustes(page).getByText("Padrão da conta: 70 s", { exact: true })).toHaveCount(2);
  await expect(descanso(page, remada)).toHaveValue("");
  await campo(page, rosca).selectOption("4");
  await descanso(page, rosca).fill("95");
  await pronto(page);
  await expect(editor(page).getByRole("list", { name: "Escolhidos" }).getByRole("listitem").first()).toContainText("95 s de descanso");
  await editor(page).getByRole("button", { name: "Salvar treino", exact: true }).click();
  const formulario = dialogo(page, "Salvar treino");
  await formulario.getByRole("textbox", { name: "Nome do treino" }).fill(nome);
  await formulario.getByRole("button", { name: "Salvar", exact: true }).click();
  const modelos = () => lerDoMock(conta, "modelos_de_treino");
  const descansosDoModelo = { "rosca-com-elastico": 95 };
  await expect.poll(modelos).toMatchObject([{ nome, series_por_exercicio: { "rosca-com-elastico": 4 }, descansos_por_exercicio: descansosDoModelo }]);
  const modeloSalvo = await modelos();
  expect(modeloSalvo[0]?.descansos_por_exercicio).toEqual(descansosDoModelo);

  const primeira = await iniciar(page);
  await comecarNoPlayer(page);
  const concluir = page.getByRole("button", { name: "Concluir série", exact: true });
  const timer = page.getByRole("timer", { name: "Descanso", exact: true });
  const editar = page.getByRole("button", { name: "Editar tempo de descanso", exact: true });
  const pular = page.getByRole("button", { name: "Pular descanso", exact: true });
  await concluir.click();
  await expect(timer).toHaveText("1:35");
  await editar.click();
  await page.getByRole("textbox", { name: "tempo de descanso em segundos" }).fill("55");
  await page.getByRole("checkbox", { name: `Usar nas próximas séries de ${rosca}`, exact: true }).check();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await pular.click();
  await concluir.click();
  await expect(timer).toHaveText("0:55");
  await editar.click();
  await page.getByRole("button", { name: "Restaurar padrão para as próximas séries", exact: true }).click();
  // Restaurar preserva o intervalo já em curso. O descanso seguinte usa o perfil.
  await expect(timer).toHaveText("0:55");
  await pular.click();
  await concluir.click();
  await expect(timer).toHaveText("1:10");
  await pular.click();
  await abrirVisaoGeral(page);
  await marcarSerieNaVisaoGeral(
    geral(page).getByRole("checkbox", { name: `Série 1 concluída — ${remada}`, exact: true }),
  );
  const barra = geral(page).getByRole("timer", { name: "Descanso" });
  await expect(barra.getByText("1:10", { exact: true })).toBeVisible();
  await expect(barra).toContainText(remada);
  await barra.getByRole("button", { name: "Pular" }).click();
  await geral(page).getByRole("button", { name: "Concluir", exact: true }).click();
  await dialogo(page, "Treino concluído").getByRole("button", { name: "Salvar e voltar", exact: true }).click();
  await esperarAbaTreino(page);
  await expect.poll(() => naFila(page)).toBe(0);
  expect((await planoSalvo(conta, primeira))?.descansos_por_exercicio ?? {}).toEqual({});
  expect(await modelos()).toEqual(modeloSalvo);

  await page.reload();
  await carregar(page, nome);
  await ajustar(page).click();
  await expect(descanso(page, rosca)).toHaveValue("95");
  await expect(descanso(page, remada)).toHaveValue("");
  await pronto(page);
  const segunda = await iniciar(page);
  expect(segunda).not.toBe(primeira);
  await comecarNoPlayer(page);
  await concluir.click();
  await expect(timer).toHaveText("1:35");
  await expect.poll(() => planoSalvo(conta, segunda)).toMatchObject({ titulo: nome, descansos_por_exercicio: descansosDoModelo,
    itens: [{ exercicio_id: "rosca-com-elastico", descanso_s: 60 }, { exercicio_id: "remada-com-elastico", descanso_s: 60 }] });
  const [perfil] = await lerDoMock(conta, "profiles");
  expect(perfil?.prefs).toMatchObject({ descanso_padrao_s: 70 });
});
