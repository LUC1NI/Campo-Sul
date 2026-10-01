import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Código/EAN bate com o que o leitor digitou? Ignora maiúsculas (leitor com Caps Lock ligado). */
export function codigoBate(p: { codigo: string; gtin: string | null }, q: string): boolean {
  const alvo = q.toLowerCase();
  return p.codigo.toLowerCase() === alvo || p.gtin?.toLowerCase() === alvo;
}

/** Entre candidatos que batem sem caixa, prefere o de caixa idêntica ("ABC" vs "abc" são produtos distintos). */
export function melhorCodigoExato<T extends { codigo: string; gtin: string | null }>(
  candidatos: T[],
  q: string
): T | undefined {
  return candidatos.find((p) => p.codigo === q || p.gtin === q) ?? candidatos.find((p) => codigoBate(p, q));
}
