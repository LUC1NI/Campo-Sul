import { describe, it, expect } from "vitest";
import { parseNfeXml } from "@/lib/nfe-xml-parser";

const det = (n: number, cEAN: string, xProd: string) => `
  <det nItem="${n}"><prod>
    <cEAN>${cEAN}</cEAN><xProd>${xProd}</xProd><uCom>SC</uCom>
    <qCom>2.0000</qCom><vUnCom>89.9000000000</vUnCom><vProd>179.80</vProd>
  </prod></det>`;

const nfe = (dets: string, prefixo = "") => `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <${prefixo}NFe><${prefixo}infNFe Id="NFe41260500000000000100550010000012341000012345" versao="4.00">
    <ide><nNF>001234</nNF></ide>
    <emit><CNPJ>00000000000100</CNPJ><xNome>Fornecedor Teste Ltda</xNome></emit>
    ${dets}
    <total><ICMSTot><vNF>359.60</vNF></ICMSTot></total>
  </${prefixo}infNFe></${prefixo}NFe>
</nfeProc>`;

describe("parseNfeXml", () => {
  it("lê cabeçalho e itens preservando strings (sem virar float)", () => {
    const r = parseNfeXml(nfe(det(1, "07891234567895", "RACAO 25KG") + det(2, "SEM GTIN", "SAL MINERAL")));
    expect(r.chaveAcesso).toBe("41260500000000000100550010000012341000012345");
    expect(r.numeroNf).toBe("001234");
    expect(r.cnpjEmitente).toBe("00000000000100");
    expect(r.valorTotal).toBe("359.60");
    expect(r.itens).toHaveLength(2);
    expect(r.itens[0]).toEqual({
      gtin: "07891234567895",
      descricao: "RACAO 25KG",
      unidadeComercial: "SC",
      quantidade: "2.0000",
      valorUnitario: "89.9000000000",
      valorTotal: "179.80",
    });
    expect(r.itens[1].gtin).toBeNull();
  });

  it("NF-e com 1 item ainda vira array", () => {
    expect(parseNfeXml(nfe(det(1, "0", "UNICO"))).itens).toHaveLength(1);
  });

  it("aceita prefixo de namespace nas tags", () => {
    const xml = nfe(det(1, "SEM GTIN", "X"), "nfe:").replace(
      "<nfeProc ",
      '<nfeProc xmlns:nfe="http://www.portalfiscal.inf.br/nfe" '
    );
    expect(parseNfeXml(xml).numeroNf).toBe("001234");
  });

  it("não expande entidades (XXE / Billion Laughs)", () => {
    const xml = nfe(det(1, "SEM GTIN", "&xxe;")).replace(
      "<nfeProc",
      '<!DOCTYPE nfeProc [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>\n<nfeProc'
    );
    let descricao = "";
    try {
      descricao = parseNfeXml(xml).itens[0].descricao;
    } catch {
      return; // rejeitar o XML também é seguro
    }
    expect(descricao).not.toContain("root:");
  });

  it("rejeita XML que não é NF-e", () => {
    expect(() => parseNfeXml("<outro><x>1</x></outro>")).toThrow("estrutura NFe");
  });
});
