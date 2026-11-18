import { expect, test, type Page } from "@playwright/test";
import { exercicios } from "../lib/dados";
import { itemDoExercicio, planoDaSessao } from "../lib/livre";
import {
  comecarNoPlayer, comecarOTreinoDoDia, entrarNoApp, fixarData,
  inserirNoMock, lerDoMock, resetarMock, usuarioComPerfil,
} from "./fixtures";

const INICIO = new Date("2026-09-14T08:00:00-03:00").getTime();

async function avancarRelogio(page: Page, segundos: number) {
  await page.clock.setFixedTime(new Date(INICIO + segundos * 1000));
}

test.beforeEach(async () => {
  await resetarMock();
});

for (const tema of ["light", "dark"] as const) {
  test(`preparação, foco e correção durante o descanso — ${tema}`, async ({ page }) => {
    const usuario = await usuarioComPerfil();
    await page.emulateMedia({ colorScheme: tema });
    await fixarData(page, new Date(INICIO).toISOString());
    await entrarNoApp(page);
    await comecarOTreinoDoDia(page);

    const preparacao = page.getByRole("region", { name: "Preparação" });
    await expect(preparacao.getByRole("status")).toHaveText("");
    await avancarRelogio(page, 7);
    await expect(preparacao.getByRole("status")).toHaveText("Começa em 3 segundos.");
    await comecarNoPlayer(page);

    const progresso = page.getByRole("progressbar", { name: "Progresso do treino" });
    await expect(progresso).toHaveAttribute("aria-valuenow", "0");
    await expect(progresso).toHaveAttribute("aria-valuetext", /^0 de \d+ séries feitas/);
    const ajustes = page.getByRole("button", { name: "Ajustar", exact: true });
    await ajustes.click();
    await expect(page.getByRole("heading", { name: "Ajustar" })).toBeFocused();
    await page.keyboard.press("Escape");
    const lista = page.getByRole("button", { name: "Visão geral do treino" });
    await lista.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog").getByRole("heading", { level: 1 })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(lista).toBeFocused();

    await page.getByRole("button", { name: "Concluir série" }).click();
    const descanso = page.getByRole("region", { name: "Descanso" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Treino A — descanso/);
    await expect(descanso.getByText("A seguir")).toBeVisible();
    await expect(descanso.getByRole("button", { name: "Somar 20 segundos ao descanso" })).toHaveText("+20 s");
    await expect(descanso.getByRole("button", { name: "Tirar 20 segundos do descanso" })).toHaveText("−20 s");
    const relogio = descanso.getByRole("timer");
    const inicial = await relogio.innerText();
    await descanso.getByRole("button", { name: /^Como fazer:/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await avancarRelogio(page, 17);
    await page.keyboard.press("Escape");
    await expect(relogio).not.toHaveText(inicial);
    const antes = await relogio.innerText();
    await descanso.getByRole("button", { name: /^Corrigir a série/ }).click();
    await expect(page.getByRole("button", { name: "Série feita" })).toBeVisible();
    const reps = page.getByRole("button", { name: "Aumentar repetições", exact: true });
    await reps.click();
    await page.getByRole("button", { name: "Série feita" }).click();
    await expect(relogio).toHaveText(antes);
    await expect.poll(async () => {
      const series = await lerDoMock<{ reps: number; tipo: string }>(usuario, "session_sets");
      return series.filter(s => s.tipo === "aquecimento").map(s => s.reps);
    }).toEqual([6]);
    await descanso.getByRole("button", { name: "Pular descanso" }).click();
    await expect(progresso).toHaveAttribute("aria-valuenow", "1");
  });
}

test("o voltar durante a gravação mantém o resumo aberto", async ({ page }) => {
  await usuarioComPerfil();
  await fixarData(page, new Date(INICIO).toISOString());
  await entrarNoApp(page);
  await comecarOTreinoDoDia(page);
  await comecarNoPlayer(page);
  await page.getByRole("button", { name: "Visão geral do treino" }).click();
  await page.getByRole("button", { name: "Concluir", exact: true }).click();

  // Uma transação legítima mantém a fila ocupada até o teste liberá-la.
  await page.evaluate(() => new Promise<void>((pronto, falhou) => {
    const abrir = indexedDB.open("treino-terraco");
    abrir.onerror = () => falhou(abrir.error);
    abrir.onsuccess = () => {
      const banco = abrir.result;
      const tx = banco.transaction("outbox", "readwrite");
      const fila = tx.objectStore("outbox");
      let livre = false;
      window.addEventListener("liberar-fila-do-teste", () => { livre = true; }, { once: true });
      const ocupar = () => {
        fila.get(0).onsuccess = () => {
          pronto();
          if (!livre) ocupar();
        };
      };
      ocupar();
      tx.oncomplete = () => banco.close();
    };
  }));
  const resumo = page.getByRole("dialog", { name: "Treino concluído" });
  await resumo.getByRole("button", { name: "Salvar e voltar" }).click();
  await expect(resumo.getByRole("button", { name: "Salvando…" })).toBeDisabled();
  await page.evaluate(() => new Promise<void>((resolve) => {
    window.addEventListener("popstate", () => resolve(), { once: true });
    window.history.back();
  }));
  await expect(resumo).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("liberar-fila-do-teste")));
  await page.waitForURL(url => url.pathname === "/");
});

test("uma falha local ao anotar o voto mantém o botão disponível para tentar de novo", async ({ page }) => {
  await usuarioComPerfil();
  await fixarData(page, new Date(INICIO).toISOString());
  await entrarNoApp(page);
  await comecarOTreinoDoDia(page);
  await comecarNoPlayer(page);
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (registro, chave) {
      if (this.name === "outbox" && registro.tipo === "perfil") {
        throw new DOMException("Falha local simulada", "QuotaExceededError");
      }
      return add.call(this, registro, chave);
    };
  });
  const gostei = page.getByRole("button", { name: "Gostei deste exercício" });
  await gostei.click();
  await expect(page.getByText("Voto não anotado. Tente novamente.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Desfazer" })).toHaveCount(0);
  await expect(gostei).not.toHaveAttribute("aria-pressed", "true");
});

test("nome longo e aviso de voto deixam os controles livres a 360 px", async ({ page }) => {
  const exercicio = exercicios.reduce((maior, e) => e.nome.length > maior.nome.length ? e : maior);
  const usuario = await usuarioComPerfil({ prefs: { preparacao_s: 0 } });
  const id = crypto.randomUUID();
  await inserirNoMock(usuario, "sessions", [{
    id, user_id: usuario.userId, data: "2026-09-14", workout_id: "livre",
    iniciada_em: new Date(INICIO).toISOString(), fase: "fase1", status: "em_andamento",
    plano: planoDaSessao([itemDoExercicio(exercicio)]),
  }]);
  await fixarData(page, new Date(INICIO).toISOString());
  await entrarNoApp(page);
  await page.goto(`/treinar/${id}`);
  await comecarNoPlayer(page);
  await expect(page.getByRole("heading", { name: exercicio.nome, exact: true })).toBeVisible();
  const montagem = page.getByRole("button", { name: "Ver a montagem", exact: true });
  const concluir = page.getByRole("button", { name: "Concluir série", exact: true });
  const chip = await montagem.boundingBox();
  const rodape = await concluir.boundingBox();
  expect(chip).not.toBeNull();
  expect(rodape).not.toBeNull();
  expect(chip!.y + chip!.height).toBeLessThanOrEqual(rodape!.y);
  await montagem.click();
  await expect(page.getByRole("dialog", { name: "Montagem" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Gostei deste exercício" }).click();
  await expect(page.getByRole("button", { name: "Desfazer" })).toBeVisible();
  for (const nome of ["Ajustar", "Visão geral do treino", "Gostei deste exercício", "Não gosto deste exercício"]) {
    const recebeToque = await page.getByRole("button", { name: nome, exact: true }).evaluate(el => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(x + width / 2, y + height / 2));
    });
    expect(recebeToque, nome).toBe(true);
  }

  const proximo = page.getByRole("button", { name: "Próximo passo" });
  for (let i = 0; i < 12 && await proximo.isVisible(); i++) await proximo.click();
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toContainText("esforço");
  const pular = page.getByRole("button", { name: "Pular esta pergunta" });
  await expect(pular).toHaveAttribute("data-variant", "outline");
  await pular.click();
  await expect(h1).toHaveCount(1);
  await expect(h1).toContainText("avaliação");
  const finalizar = page.getByRole("button", { name: "Concluir sem responder" });
  await expect(finalizar).toHaveAttribute("data-variant", "outline");
  await finalizar.click();
  await expect(h1).toHaveCount(1);
  await expect(h1).toContainText("conclusão");
});
