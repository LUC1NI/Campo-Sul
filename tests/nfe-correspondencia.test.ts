import { describe, it, expect } from "vitest";
import {
  tokenizarNome,
  similaridade,
  mesmoNome,
  melhoresCandidatos,
  quantidadeParaEstoque,
  SIMILARIDADE_MINIMA,
} from "@/lib/nfe-correspondencia";

const sim = (a: string, b: string) => similaridade(tokenizarNome(a), tokenizarNome(b));

describe("similaridade de nomes", () => {
  it("medidas diferentes nunca são o mesmo produto (casos reais de NF)", () => {
    expect(sim("MELOXINEW 1MG 10 COMPRIMIDOS", "MELOXINEW 2MG 10 COMPRIMIDOS")).toBe(0);
    expect(sim("INVICTO 11,4 MG ATE 11,4 KG 20 COMPRIMIDOS", "INVICTO 57 MG 20 COMPRIMIDOS (11,4KG A 57KG)")).toBe(0);
    expect(sim("RACAO CAES 15KG", "RACAO CAES 25KG")).toBe(0);
  });

  it("mesma medida escrita diferente é igual", () => {
    expect(mesmoNome(tokenizarNome("RATOL GIRASSOL 1KG 20X50GR"), tokenizarNome("Ratol Girassol 1 kg 20 x 50 g"))).toBe(true);
    expect(mesmoNome(tokenizarNome("INVICTO 11,4 MG"), tokenizarNome("invicto 11.4mg"))).toBe(true);
    expect(mesmoNome(tokenizarNome("Ração Cães"), tokenizarNome("RACAO CAES"))).toBe(true);
  });

  it("fornecedor abreviou ou reordenou o nome → sugere", () => {
    expect(sim("RACAO P/ CAES ADULTO CARNE 15KG", "RAC CAES ADULTO CARNE 15 KG")).toBeGreaterThanOrEqual(SIMILARIDADE_MINIMA);
    expect(sim("SAL MINERAL BOVINO 30KG", "SAL MINERAL P/ BOVINOS 30KG")).toBeGreaterThanOrEqual(SIMILARIDADE_MINIMA);
    expect(sim("ARAME FARPADO 500M", "ARAME FARPADO MOTTO 500 M")).toBeGreaterThanOrEqual(SIMILARIDADE_MINIMA);
  });

  it("produtos diferentes sem medida não são sugeridos", () => {
    expect(sim("SEMENTE MILHO HIBRIDO", "SEMENTE SOJA TRANSGENICA")).toBeLessThan(SIMILARIDADE_MINIMA);
    expect(sim("VERMIFUGO BOVINO", "CARRAPATICIDA POUR ON")).toBe(0);
  });

  it("um lado sem medida ainda pode sugerir, com confiança menor", () => {
    const comMedida = sim("SAL MINERAL BOVINO 30KG", "SAL MINERAL BOVINO 30KG");
    const semMedida = sim("SAL MINERAL BOVINO 30KG", "SAL MINERAL BOVINO");
    expect(semMedida).toBeGreaterThanOrEqual(SIMILARIDADE_MINIMA);
    expect(semMedida).toBeLessThan(comMedida);
  });
});

describe("melhoresCandidatos", () => {
  const catalogo = ["MELOXINEW 1MG 10 COMP", "MELOXINEW 2MG 10 COMP", "MELOXINEW 4MG 10 COMP", "RACAO GATO 1KG"].map(
    (nome, i) => ({ id: String(i), nome, tokens: tokenizarNome(nome) })
  );

  it("entre variações de dosagem, só sugere a dosagem certa", () => {
    const r = melhoresCandidatos("MELOXINEW 2 MG 10 COMPRIMIDOS", catalogo);
    expect(r.map((c) => c.id)).toEqual(["1"]);
    expect(r[0]).not.toHaveProperty("tokens");
  });

  it("nada parecido → lista vazia", () => {
    expect(melhoresCandidatos("ENXADA LARGA", catalogo)).toEqual([]);
  });
});

describe("quantidadeParaEstoque", () => {
  const saco = { unidade: "SACO" as const, podeFracionar: true, pesoUnidade: "25", unidadeFracao: "KG" as const };
  const un = { unidade: "UN" as const, podeFracionar: false, pesoUnidade: null, unidadeFracao: null };

  it("mesma unidade: igual", () => expect(quantidadeParaEstoque("10", "UN", un)).toBe("10"));
  it("nota em KG, produto em SACO de 25 kg", () => expect(quantidadeParaEstoque("500", "KG", saco)).toBe("20"));
  it("unidades sem conversão conhecida: pede ao usuário", () => expect(quantidadeParaEstoque("3", "CX", un)).toBeNull());
  it("conversão aprendida tem prioridade (1 CX = 12 UN)", () => expect(quantidadeParaEstoque("3", "CX", un, "12")).toBe("36"));
});
