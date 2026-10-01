import { describe, it, expect } from "vitest";
import { codigoBate, melhorCodigoExato } from "@/lib/utils";

describe("codigoBate (leitor com Caps Lock)", () => {
  it("ignora maiúsculas/minúsculas no código e no GTIN", () => {
    expect(codigoBate({ codigo: "ISCA-07", gtin: null }, "isca-07")).toBe(true);
    expect(codigoBate({ codigo: "isca-07", gtin: null }, "ISCA-07")).toBe(true);
    expect(codigoBate({ codigo: "X", gtin: "7891000315507" }, "7891000315507")).toBe(true);
    expect(codigoBate({ codigo: "ISCA-07", gtin: null }, "ISCA-070")).toBe(false);
  });

  it("prefere o produto com caixa idêntica quando há dois", () => {
    const a = { codigo: "ABC", gtin: null };
    const b = { codigo: "abc", gtin: null };
    expect(melhorCodigoExato([a, b], "abc")).toBe(b);
    expect(melhorCodigoExato([a, b], "ABC")).toBe(a);
    expect(melhorCodigoExato([a], "aBc")).toBe(a);
    expect(melhorCodigoExato([], "abc")).toBeUndefined();
  });
});
