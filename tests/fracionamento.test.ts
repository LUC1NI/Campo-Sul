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

  it("lança erro se estoque insuficiente", () => {
    expect(() => calcularFracionamento(produtoUn, "11")).toThrow();
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

  it("lança erro se esgota unidades fechadas", () => {
    // 4 sacos × 25 = 100kg; tentar vender 101kg
    expect(() => calcularFracionamento(sacoRacao, "101")).toThrow();
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
