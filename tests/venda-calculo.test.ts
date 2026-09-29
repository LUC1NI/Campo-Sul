import { describe, it, expect } from "vitest";
import { calcularTotais, precoDeCatalogo, totalItem, parseDecimalBR } from "@/lib/venda-calculo";

const racao = {
  unidade: "SACO" as const, precoVenda: "100", podeFracionar: true,
  pesoUnidade: "25", unidadeFracao: "KG" as const, precoFracao: null,
};

describe("precoDeCatalogo", () => {
  it("inteiro usa precoVenda; fração usa precoVenda/peso", () => {
    expect(precoDeCatalogo(racao, "SACO").toNumber()).toBe(100);
    expect(precoDeCatalogo(racao, "KG").toNumber()).toBe(4);
    expect(precoDeCatalogo({ ...racao, precoFracao: "4.5" }, "KG").toNumber()).toBe(4.5);
  });
  it("rejeita unidade que o produto não vende", () => {
    expect(() => precoDeCatalogo(racao, "L")).toThrow();
    expect(() => precoDeCatalogo({ ...racao, podeFracionar: false }, "KG")).toThrow();
  });
});

describe("calcularTotais", () => {
  it("subtotal = soma dos itens arredondados (caso 1,005)", () => {
    const itens = [totalItem("1.005", "1"), totalItem("1.005", "1")];
    const r = calcularTotais(itens, 0, [{ metodo: "PIX", valor: "2.02" }]);
    expect(r.subtotal.toFixed(2)).toBe("2.02");
  });
  it("rejeita pagamento 1 centavo menor", () => {
    expect(() => calcularTotais(["10.00"], 0, [{ metodo: "PIX", valor: "9.99" }])).toThrow(/insuficiente/);
  });
  it("troco é abatido do dinheiro (não vira receita)", () => {
    const r = calcularTotais(["80"], 0, [{ metodo: "DINHEIRO", valor: "100" }]);
    expect(r.troco.toNumber()).toBe(20);
    expect(r.pagamentos).toHaveLength(1);
    expect(r.pagamentos[0].valor.toNumber()).toBe(80);
  });
  it("pagamento misto: troco sai do dinheiro, cartão fica intacto", () => {
    const r = calcularTotais(["80"], 0, [{ metodo: "CREDITO", valor: "50" }, { metodo: "DINHEIRO", valor: "50" }]);
    expect(r.pagamentos.map((p) => [p.metodo, p.valor.toNumber()])).toEqual([["CREDITO", 50], ["DINHEIRO", 30]]);
  });
  it("rejeita cartão acima do total (troco sem dinheiro)", () => {
    expect(() => calcularTotais(["80"], 0, [{ metodo: "DEBITO", valor: "100" }])).toThrow(/Troco/);
  });
  it("rejeita desconto maior que o subtotal", () => {
    expect(() => calcularTotais(["10"], "11", [{ metodo: "PIX", valor: "0.01" }])).toThrow(/desconto/);
  });
});

describe("parseDecimalBR", () => {
  it.each([
    ["12,50", 12.5], ["1.250,00", 1250], ["12.50", 12.5], ["2.125", 2.125], ["1250", 1250],
    ["R$ 5,00", 5], ["0,5", 0.5], ["", NaN], ["abc", NaN], ["1,2,3", NaN],
  ])("%s → %s", (entrada, esperado) => {
    expect(parseDecimalBR(entrada)).toBe(esperado);
  });
});

import { inicioDoDiaSP, inicioDoMesSP, diaDaSemanaSP, formatDataHora } from "@/lib/format";

describe("datas em horário de Brasília (servidor em UTC)", () => {
  // 28/09/2026 01:30 UTC = 27/09/2026 22:30 em Brasília
  const noite = new Date("2026-09-28T01:30:00Z");
  it("venda às 22h30 pertence ao dia 27, não ao 28", () => {
    expect(inicioDoDiaSP(noite).toISOString()).toBe("2026-09-27T03:00:00.000Z");
    expect(inicioDoDiaSP(noite, 1).toISOString()).toBe("2026-09-28T03:00:00.000Z");
  });
  it("início do mês e dia da semana", () => {
    expect(inicioDoMesSP(noite).toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(inicioDoMesSP(new Date("2026-01-15T12:00:00Z"), -1).toISOString()).toBe("2025-12-01T03:00:00.000Z");
    expect(diaDaSemanaSP(noite)).toBe(0); // 27/09/2026 é domingo
  });
  it("formata no horário de Brasília", () => {
    expect(formatDataHora(noite)).toBe("27/09/2026 22:30");
  });
});
