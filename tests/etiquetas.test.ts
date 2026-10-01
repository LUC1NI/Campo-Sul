import { describe, it, expect } from "vitest";
import { escolherCodigo, gtinValido, larguras, QUIET_ZONE } from "@/lib/codigo-barras";
import {
  LAYOUTS,
  buscarLayout,
  larguraModulo,
  medidasEtiqueta,
  paginaDoLayout,
  MODULO_MINIMO_MM,
} from "@/lib/etiquetas-layouts";

describe("escolherCodigo", () => {
  it("EAN-13 válido → ean13 com o próprio GTIN", () => {
    expect(escolherCodigo({ codigo: "X1", gtin: "7891000315507" })).toEqual({
      ok: true,
      simbologia: "ean13",
      texto: "7891000315507",
    });
  });

  it("EAN-8 e UPC-A válidos usam a simbologia certa", () => {
    expect(escolherCodigo({ codigo: "X", gtin: "96385074" })).toMatchObject({ simbologia: "ean8" });
    expect(escolherCodigo({ codigo: "X", gtin: "036000291452" })).toMatchObject({ simbologia: "upca" });
  });

  it("dígito verificador inválido ou 14 dígitos → Code 128 com o mesmo número", () => {
    expect(escolherCodigo({ codigo: "X", gtin: "7891000315508" })).toEqual({
      ok: true,
      simbologia: "code128",
      texto: "7891000315508",
    });
    expect(escolherCodigo({ codigo: "X", gtin: "17891000315504" })).toMatchObject({
      simbologia: "code128",
      texto: "17891000315504",
    });
  });

  it("sem GTIN → Code 128 com o código interno", () => {
    expect(escolherCodigo({ codigo: "ISCA-07", gtin: null })).toEqual({
      ok: true,
      simbologia: "code128",
      texto: "ISCA-07",
    });
    expect(escolherCodigo({ codigo: "42", gtin: "" })).toMatchObject({ texto: "42" });
  });

  it("recusa código com acento ou espaço nas pontas", () => {
    expect(escolherCodigo({ codigo: "AÇÚCAR", gtin: null }).ok).toBe(false);
    expect(escolherCodigo({ codigo: " A1", gtin: null }).ok).toBe(false);
  });
});

describe("gtinValido", () => {
  it("confere dígito verificador", () => {
    expect(gtinValido("7891000315507")).toBe(true);
    expect(gtinValido("7891000315500")).toBe(false);
    expect(gtinValido("123")).toBe(false);
  });
});

describe("larguras (bwip-js)", () => {
  it("EAN-13 tem 95 módulos e Code 128 é múltiplo de 11 + 2 (stop)", () => {
    const soma = (a: number[]) => a.reduce((s, n) => s + n, 0);
    expect(soma(larguras("ean13", "7891000315507"))).toBe(95);
    expect(soma(larguras("code128", "ISCA-07")) % 11).toBe(2);
  });
});

describe("paginaDoLayout", () => {
  it("rolo: uma etiqueta por página do tamanho exato", () => {
    expect(paginaDoLayout(buscarLayout("rolo-40x25")!)).toEqual({
      largura: 40,
      altura: 25,
      posicoes: [{ x: 0, y: 0 }],
    });
  });

  it("A4: grade com margens e espaçamentos, cabendo na folha", () => {
    const l = buscarLayout("a4-pimaco-a4356")!;
    const p = paginaDoLayout(l);
    expect(p.posicoes).toHaveLength(21);
    expect(p.posicoes[0]).toEqual({ x: 7.25, y: 15.15 });
    expect(p.posicoes[1]).toEqual({ x: 7.25 + 63.5 + 2.5, y: 15.15 });
    expect(p.posicoes[3]).toEqual({ x: 7.25, y: 15.15 + 38.1 });
    for (const l2 of LAYOUTS.filter((x) => x.tipo === "a4")) {
      const pg = paginaDoLayout(l2);
      for (const pos of pg.posicoes) {
        expect(pos.x + l2.largura).toBeLessThanOrEqual(210);
        expect(pos.y + l2.altura).toBeLessThanOrEqual(297);
      }
    }
  });
});

describe("medidas e legibilidade", () => {
  it("todo preset deixa altura de barra legível (>= 6 mm)", () => {
    for (const l of LAYOUTS) expect(medidasEtiqueta(l).alturaBarras).toBeGreaterThanOrEqual(6);
  });

  it("EAN-13 cabe legível em todos os presets", () => {
    const mods = 95 + 2 * QUIET_ZONE.ean13;
    for (const l of LAYOUTS) expect(larguraModulo(mods, l.largura, l.dpi)).not.toBeNull();
  });

  it("módulo é múltiplo de 1 ponto da impressora e respeita o mínimo", () => {
    const x = larguraModulo(113, 50, 203)!;
    expect(x).toBeGreaterThanOrEqual(MODULO_MINIMO_MM);
    expect(Math.abs((x / (25.4 / 203)) % 1)).toBeLessThan(1e-9);
    expect(larguraModulo(1000, 40, 203)).toBeNull();
  });
});
