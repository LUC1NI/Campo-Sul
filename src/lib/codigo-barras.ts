import bwipjs from "bwip-js/node";

export type Simbologia = "ean13" | "ean8" | "upca" | "code128";

export type CodigoEtiqueta =
  | { ok: true; simbologia: Simbologia; texto: string }
  | { ok: false; erro: string };

/** Dígito verificador GS1 (vale para EAN-8, UPC-A, EAN-13 e GTIN-14). */
export function gtinValido(gtin: string): boolean {
  if (!/^\d{8,14}$/.test(gtin)) return false;
  const digitos = gtin.split("").map(Number);
  const dv = digitos.pop()!;
  const soma = digitos.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === dv;
}

const SIMBOLOGIA_GTIN: Record<number, Simbologia> = { 8: "ean8", 12: "upca", 13: "ean13" };

/**
 * O que vai no código de barras: o GTIN da embalagem (mesma simbologia do fabricante)
 * ou, sem GTIN, o código interno em Code 128. O PDV acha os dois por match exato.
 */
export function escolherCodigo(p: { codigo: string; gtin: string | null }): CodigoEtiqueta {
  const gtin = p.gtin?.trim();
  if (gtin && /^\d+$/.test(gtin)) {
    const simb = SIMBOLOGIA_GTIN[gtin.length];
    return { ok: true, simbologia: simb && gtinValido(gtin) ? simb : "code128", texto: gtin };
  }
  // O PDV faz trim() na busca: espaço nas pontas nunca daria match exato.
  if (!/^[\x20-\x7E]+$/.test(p.codigo) || p.codigo !== p.codigo.trim()) {
    return {
      ok: false,
      erro: `O código "${p.codigo}" tem caracteres que o leitor não consegue ler (acentos, espaços nas pontas ou símbolos especiais). Altere o código do produto para usar só letras sem acento, números, hífen ou ponto.`,
    };
  }
  return { ok: true, simbologia: "code128", texto: p.codigo };
}

/** Quiet zone mínima de cada lado, em módulos. */
export const QUIET_ZONE: Record<Simbologia, number> = { code128: 10, ean13: 11, ean8: 7, upca: 9 };

/** Larguras alternadas barra/espaço/barra… em módulos (começa por barra). */
export function larguras(simbologia: Simbologia, texto: string): number[] {
  const [r] = bwipjs.raw(simbologia, texto);
  if (!("sbs" in r)) throw new Error(`Simbologia não linear: ${simbologia}`);
  return r.sbs;
}
