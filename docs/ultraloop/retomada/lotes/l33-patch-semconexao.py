import sys
p = "/home/user/wt-c/e2e/sem-conexao.spec.ts"
s = open(p, encoding="utf-8").read()
velho1 = """    const worker = await workerDoApp(context);
    await expect
      .poll(async () => (await inventarioDeCaches(worker)).socorro ?? 0, { timeout: 20_000 })
      .toBeGreaterThan(0);

    // ---- o aparelho perde TODA cópia, inclusive a própria -------------
"""
novo1 = """    const worker = await workerDoApp(context);
    /*
     * Espera a cura TERMINAR, não começar: ela grava os pedaços primeiro e o
     * HTML por último (`lib/sw-cura.ts`), então quem diz que acabou é o
     * `/~offline` no `socorro`, como no teste do aparelho despejado abaixo.
     * Contar entradas (`socorro > 0`) passava no primeiro pedaço gravado.
     */
    await expect
      .poll(async () => await caminhosDoCache(worker, "socorro"), { timeout: 20_000 })
      .toContain("/~offline");

    // ---- o aparelho perde TODA cópia, inclusive a própria -------------
"""
velho2 = """    await page.goto("/mais", { waitUntil: "domcontentloaded" });
    await expect
      .poll(async () => (await inventarioDeCaches(worker)).socorro ?? 0, { timeout: 30_000 })
      .toBeGreaterThan(0);
"""
novo2 = """    await page.goto("/mais", { waitUntil: "domcontentloaded" });
    /*
     * De novo o HTML, e não o número de entradas: com `socorro > 0` o teste
     * cortava a rede entre o primeiro pedaço e o HTML, a `/~offline` ainda
     * não estava lá e a tela vinha do degrau (d), o socorro embutido, sem
     * folha de estilo (cadeia `35ba0cd`, rodada 34, sob carga).
     */
    await expect
      .poll(async () => await caminhosDoCache(worker, "socorro"), {
        timeout: 30_000,
        message: "a autocura tem de repor a /~offline e os pedaços dela",
      })
      .toContain("/~offline");
"""
assert s.count(velho1) == 1, "velho1"
assert s.count(velho2) == 1, "velho2"
s = s.replace(velho1, novo1).replace(velho2, novo2)
open(p, "w", encoding="utf-8").write(s)
print("ok")
