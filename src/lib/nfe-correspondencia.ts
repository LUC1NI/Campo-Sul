/**
 * Correspondência entre item de NF-e e produto já cadastrado (sem dependências de servidor —
 * usado também no navegador).
 *
 * Regra de ouro: nome parecido só SUGERE, nunca vincula sozinho. E números/medidas
 * diferentes nunca são sugeridos (MELOXINEW 1MG ≠ MELOXINEW 2MG).
 */
import { Decimal } from "decimal.js";

type Unidade = "UN" | "KG" | "L" | "SACO" | "CX" | "M";

const PALAVRAS_VAZIAS = new Set(["de", "da", "do", "das", "dos", "com", "c", "p", "para", "e", "a", "o", "em", "sem"]);
const UNIDADES_MEDIDA = "kg|kgs|g|gr|grs|mg|mcg|ml|l|lt|lts|ltr|un|und|cm|mm|m|mt|cx|cp|cps|comp|comprimido|comprimidos|capsulas|dose|doses";
const CANONICA: Record<string, string> = { kgs: "kg", gr: "g", grs: "g", lt: "l", lts: "l", ltr: "l", und: "un", mt: "m", cps: "cp", comp: "cp", comprimido: "cp", comprimidos: "cp", capsulas: "cp", doses: "dose" };

export interface NomeTokenizado {
  palavras: string[];
  /** Tokens com dígito (medidas, dosagens, quantidades) — precisam bater. */
  numeros: Set<string>;
}

export function tokenizarNome(nome: string): NomeTokenizado {
  const s = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2") // 11,4 → 11.4
    .replace(/(\d)\s*x\s*(\d)/g, "$1x$2") // 20 X 50 → 20x50
    .replace(new RegExp(`(\\d)\\s+(${UNIDADES_MEDIDA})\\b`, "g"), "$1$2"); // 25 KG → 25kg

  const palavras: string[] = [];
  const numeros = new Set<string>();
  for (const bruto of s.split(/[^a-z0-9.]+/)) {
    let t = bruto.replace(/^\.+|\.+$/g, "");
    if (!t || PALAVRAS_VAZIAS.has(t)) continue;
    if (/\d/.test(t)) {
      t = t.replace(/([a-z]+)$/, (u) => CANONICA[u] ?? u).replace(/\.0+(?=[a-z]|$)/, ""); // 25.0kg → 25kg
      numeros.add(t);
    }
    palavras.push(t);
  }
  return { palavras, numeros };
}

/** Mesma palavra, ou abreviação (prefixo com 3+ letras): "girass" ~ "girassol". */
function palavrasBatem(a: string, b: string) {
  if (a === b) return true;
  if (/\d/.test(a) || /\d/.test(b)) return /\d/.test(a) && /\d/.test(b) && numeroBate(a, b);
  const [curta, longa] = a.length <= b.length ? [a, b] : [b, a];
  return curta.length >= 3 && longa.startsWith(curta);
}

/** "10" (sem unidade) é compatível com "10cp"; "10mg" não é com "10kg". */
function numeroBate(a: string, b: string) {
  if (a === b) return true;
  const [curto, longo] = a.length <= b.length ? [a, b] : [b, a];
  return /^[\d.x]+$/.test(curto) && longo.startsWith(curto) && /^[a-z]+$/.test(longo.slice(curto.length));
}

function medidasBatem(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  const restantes = [...b];
  return [...a].every((x) => {
    const i = restantes.findIndex((y) => numeroBate(x, y));
    return i >= 0 && restantes.splice(i, 1).length > 0;
  });
}

/** 0 a 1. Zero se os dois nomes têm medidas e elas diferem. */
export function similaridade(a: NomeTokenizado, b: NomeTokenizado): number {
  if (!a.palavras.length || !b.palavras.length) return 0;

  let penalidade = 1;
  if (a.numeros.size && b.numeros.size) {
    if (!medidasBatem(a.numeros, b.numeros)) return 0;
  } else if (a.numeros.size || b.numeros.size) {
    penalidade = 0.85; // um lado não informa medida: ainda pode ser o mesmo, com menos confiança
  }

  const usados = new Set<number>();
  let iguais = 0;
  for (const pa of a.palavras) {
    const j = b.palavras.findIndex((pb, i) => !usados.has(i) && palavrasBatem(pa, pb));
    if (j >= 0) {
      usados.add(j);
      iguais++;
    }
  }
  return ((2 * iguais) / (a.palavras.length + b.palavras.length)) * penalidade;
}

export function mesmoNome(a: NomeTokenizado, b: NomeTokenizado): boolean {
  return a.palavras.length > 0 && [...a.palavras].sort().join(" ") === [...b.palavras].sort().join(" ");
}

export const SIMILARIDADE_MINIMA = 0.6;

// ponytail: compara contra o catálogo inteiro em memória (ok até ~20 mil produtos); acima disso, pg_trgm.
export function melhoresCandidatos<T extends { nome: string }>(
  nomeNota: string,
  produtos: (T & { tokens: NomeTokenizado })[],
  limite = 3
): (T & { score: number })[] {
  const alvo = tokenizarNome(nomeNota);
  return produtos
    .map((p) => ({ p, score: similaridade(alvo, p.tokens) }))
    .filter((x) => x.score >= SIMILARIDADE_MINIMA)
    .sort((x, y) => y.score - x.score)
    .slice(0, limite)
    .map(({ p, score }) => {
      const { tokens: _tokens, ...resto } = p;
      return { ...(resto as unknown as T), score: Math.round(score * 100) / 100 };
    });
}

export interface ProdutoUnidade {
  unidade: Unidade;
  podeFracionar: boolean;
  pesoUnidade: string | null;
  unidadeFracao: Unidade | null;
}

/**
 * Quanto entra no estoque (na unidade do produto) para `qtdNota` na unidade da nota.
 * null = unidades incompatíveis sem conversão conhecida → o usuário precisa informar.
 * `fatorHistorico` (estoque ÷ nota, aprendido em importações anteriores) tem prioridade.
 */
export function quantidadeParaEstoque(
  qtdNota: string,
  unidadeNota: Unidade,
  produto: ProdutoUnidade,
  fatorHistorico?: string | null
): string | null {
  const q = new Decimal(qtdNota);
  if (fatorHistorico) return q.times(fatorHistorico).toDecimalPlaces(4).toString();
  if (produto.unidade === unidadeNota) return q.toString();
  if (produto.podeFracionar && produto.unidadeFracao === unidadeNota && produto.pesoUnidade) {
    return q.div(produto.pesoUnidade).toDecimalPlaces(4).toString(); // 500 KG ÷ 25 = 20 SACOS
  }
  return null;
}
