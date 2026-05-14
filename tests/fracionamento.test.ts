import { describe, it, expect } from "vitest";
import {
  calcularFracionamento,
  calcularQuantidadePorValor,
} from "@/lib/fracionamento";

const sacoRacao = {
  podeFracionar: true,
  pesoUnidade: "25",
  quantidade: "4",
  saldoFracionado: "0",
};

const produtoUn = {
  podeFracionar: false,
  pesoUnidade: null,
  quantidade: "10",
  saldoFracionado: "0",
};

describe("calcularFracionamento - produto unitário", () => {
  it("vende 3 unidades de 10", () => {
    const r = calcularFracionamento(produtoUn, "3");
    expect(r.novaQuantidade.toNumber()).toBe(7);
    expect(r.novoSaldoFracionado.toNumber()).toBe(0);
    expect(r.unidadesFechadasConsumidas.toNumber()).toBe(3);
  });

  it("permite venda que negativaria o estoque", () => {
    const r = calcularFracionamento(produtoUn, "11");
    expect(r.novaQuantidade.toNumber()).toBe(-1);
    expect(r.unidadesFechadasConsumidas.toNumber()).toBe(11);
  });
});

describe("calcularFracionamento - produto fracionável (saco 25kg)", () => {
  it("vende 7kg — não fecha nenhum saco", () => {
    const r = calcularFracionamento(sacoRacao, "7");
    expect(r.novaQuantidade.toNumber()).toBe(4);
    expect(r.novoSaldoFracionado.toNumber()).toBe(7);
    expect(r.unidadesFechadasConsumidas.toNumber()).toBe(0);
  });

  it("vende 25kg exatos — fecha 1 saco", () => {
    const r = calcularFracionamento(sacoRacao, "25");
    expect(r.novaQuantidade.toNumber()).toBe(3);
    expect(r.novoSaldoFracionado.toNumber()).toBe(0);
    expect(r.unidadesFechadasConsumidas.toNumber()).toBe(1);
  });

  it("vende 30kg — fecha 1 saco + 5kg de saldo", () => {
    const r = calcularFracionamento(sacoRacao, "30");
    expect(r.novaQuantidade.toNumber()).toBe(3);
    expect(r.novoSaldoFracionado.toNumber()).toBe(5);
    expect(r.unidadesFechadasConsumidas.toNumber()).toBe(1);
  });

  it("saldo acumulado + nova venda fecha saco", () => {
    const comSaldo = { ...sacoRacao, saldoFracionado: "20" };
    const r = calcularFracionamento(comSaldo, "10");
    // 20 + 10 = 30kg → fecha 1 saco, fica 5kg saldo
    expect(r.novaQuantidade.toNumber()).toBe(3);
    expect(r.novoSaldoFracionado.toNumber()).toBe(5);
  });

  it("vende 75kg (3 sacos) de 4 disponíveis — ok", () => {
    const r = calcularFracionamento(sacoRacao, "75");
    expect(r.novaQuantidade.toNumber()).toBe(1);
    expect(r.novoSaldoFracionado.toNumber()).toBe(0);
  });

  it("permite venda que esgota e negativaria unidades fechadas", () => {
    // 4 sacos × 25 = 100kg; vender 101kg → qty=0, saldo=1 (1kg além do estoque)
    const r101 = calcularFracionamento(sacoRacao, "101");
    expect(r101.novaQuantidade.toNumber()).toBe(0);
    expect(r101.novoSaldoFracionado.toNumber()).toBe(1);
    // vender 125kg (5 sacos completos de 4 disponíveis) → qty=-1, saldo=0
    const r125 = calcularFracionamento(sacoRacao, "125");
    expect(r125.novaQuantidade.toNumber()).toBe(-1);
    expect(r125.novoSaldoFracionado.toNumber()).toBe(0);
  });
});

describe("calcularQuantidadePorValor", () => {
  it("R$10 de ração a R$4/kg = 2.5kg", () => {
    const r = calcularQuantidadePorValor("10", "4");
    expect(r.toNumber()).toBe(2.5);
  });

  it("trunca para 4 casas decimais", () => {
    const r = calcularQuantidadePorValor("10", "3");
    // 10/3 = 3.3333...
    expect(r.toFixed(4)).toBe("3.3333");
  });

  it("lança erro com preço zero", () => {
    expect(() => calcularQuantidadePorValor("10", "0")).toThrow();
  });
});
