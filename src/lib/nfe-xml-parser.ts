import { XMLParser } from "fast-xml-parser";

export interface ItemNfe {
  gtin: string | null;
  descricao: string;
  unidadeComercial: string;
  quantidade: string;
  valorUnitario: string;
  valorTotal: string;
}

export interface NfeParseResult {
  chaveAcesso: string;
  numeroNf: string;
  cnpjEmitente: string;
  nomeEmitente: string;
  valorTotal: string;
  itens: ItemNfe[];
}

const GTIN_VAZIO = ["SEM GTIN", "0", "", null, undefined];

export function parseNfeXml(xmlContent: string): NfeParseResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
    isArray: (name: string) => name === "det",
  });

  const parsed = parser.parse(xmlContent);
  const nfe = parsed?.nfeProc?.NFe ?? parsed?.NFe;

  if (!nfe) throw new Error("XML inválido: estrutura NFe não encontrada");

  const infNFe = nfe.infNFe;
  const chaveAcesso = (infNFe?.["@_Id"] ?? "").replace("NFe", "");

  const ide = infNFe?.ide ?? {};
  const emit = infNFe?.emit ?? {};
  const total = infNFe?.total?.ICMSTot ?? {};

  const numeroNf = String(ide.nNF ?? "");
  const cnpjEmitente = String(emit.CNPJ ?? "");
  const nomeEmitente = String(emit.xNome ?? emit.xFant ?? "");
  const valorTotal = String(total.vNF ?? "0");

  const detRaw = infNFe?.det ?? [];
  const dets = Array.isArray(detRaw) ? detRaw : [detRaw];

  const itens: ItemNfe[] = dets.map((det: Record<string, unknown>) => {
    const prod = (det.prod ?? {}) as Record<string, unknown>;
    const gtinRaw = String(prod.cEAN ?? "");
    const gtin = GTIN_VAZIO.includes(gtinRaw) ? null : gtinRaw;

    return {
      gtin,
      descricao: String(prod.xProd ?? ""),
      unidadeComercial: String(prod.uCom ?? "UN"),
      quantidade: String(prod.qCom ?? "0"),
      valorUnitario: String(prod.vUnCom ?? "0"),
      valorTotal: String(prod.vProd ?? "0"),
    };
  });

  return { chaveAcesso, numeroNf, cnpjEmitente, nomeEmitente, valorTotal, itens };
}
