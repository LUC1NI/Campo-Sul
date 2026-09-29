import { Decimal } from "decimal.js";

// Módulo puro (sem Prisma): usado no servidor (fonte da verdade) e no carrinho,
// para que o total mostrado no caixa bata centavo a centavo com o que é gravado.

type Unidade = "UN" | "KG" | "L" | "SACO" | "CX" | "M";
type Metodo = "DINHEIRO" | "DEBITO" | "CREDITO" | "PIX";
type Num = Decimal.Value;

export interface ProdutoPreco {
  unidade: Unidade;
  precoVenda: Num;
  podeFracionar: boolean;
  pesoUnidade: Num | null;
  unidadeFracao: Unidade | null;
  precoFracao: Num | null;
}

/** true quando a linha vende a unidade de estoque (ex: 1 SACO), não a fração (kg). */
export function ehVendaInteira(p: Pick<ProdutoPreco, "unidade">, unidadeVenda: Unidade) {
  return unidadeVenda === p.unidade;
}

/** Preço de catálogo para a unidade vendida, com 4 casas (igual ao banco). */
export function precoDeCatalogo(p: ProdutoPreco, unidadeVenda: Unidade): Decimal {
  if (ehVendaInteira(p, unidadeVenda)) return new Decimal(p.precoVenda);
  if (!p.podeFracionar || !p.pesoUnidade || unidadeVenda !== p.unidadeFracao) {
    throw new Error("Unidade de venda inválida para este produto.");
  }
  const preco = p.precoFracao != null
    ? new Decimal(p.precoFracao)
    : new Decimal(p.precoVenda).div(p.pesoUnidade);
  return preco.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

export const centavos = (v: Num) => new Decimal(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/** Total da linha, arredondado em centavos. */
export function totalItem(quantidade: Num, precoUnitario: Num, desconto: Num = 0): Decimal {
  const t = centavos(new Decimal(quantidade).times(precoUnitario)).minus(desconto);
  return Decimal.max(0, t);
}

export interface TotaisVenda {
  subtotal: Decimal;
  desconto: Decimal;
  total: Decimal;
  totalPago: Decimal;
  troco: Decimal;
  /** Pagamentos a gravar: o troco é abatido do dinheiro (não é receita). */
  pagamentos: { metodo: Metodo; valor: Decimal }[];
}

/**
 * Soma a venda e valida o pagamento. Lança erro (mensagem pt-BR) se:
 * pagamento insuficiente, desconto maior que o subtotal ou troco sem dinheiro.
 */
export function calcularTotais(
  totaisItens: Num[],
  desconto: Num,
  pagamentos: { metodo: Metodo; valor: Num }[]
): TotaisVenda {
  const subtotal = totaisItens.reduce<Decimal>((a, t) => a.plus(t), new Decimal(0));
  const desc = centavos(desconto);
  if (desc.gt(subtotal)) throw new Error("O desconto não pode ser maior que o subtotal.");
  const total = subtotal.minus(desc);
  const totalPago = pagamentos.reduce<Decimal>((a, p) => a.plus(centavos(p.valor)), new Decimal(0));

  if (totalPago.lt(total)) {
    throw new Error(
      `Pagamento insuficiente. Total: ${fmt(total)}, pago: ${fmt(totalPago)}.`
    );
  }

  const troco = totalPago.minus(total);
  const dinheiro = pagamentos
    .filter((p) => p.metodo === "DINHEIRO")
    .reduce<Decimal>((a, p) => a.plus(centavos(p.valor)), new Decimal(0));
  if (troco.gt(dinheiro)) {
    throw new Error("Pagamento em cartão/PIX maior que o total. Troco só é possível em dinheiro.");
  }

  // Abate o troco do(s) pagamento(s) em dinheiro, do último para o primeiro.
  let restante = troco;
  const liquidos = [...pagamentos].reverse().map((p) => {
    let valor = centavos(p.valor);
    if (p.metodo === "DINHEIRO" && restante.gt(0)) {
      const abate = Decimal.min(valor, restante);
      valor = valor.minus(abate);
      restante = restante.minus(abate);
    }
    return { metodo: p.metodo, valor };
  }).reverse().filter((p) => p.valor.gt(0));

  return { subtotal, desconto: desc, total, totalPago, troco, pagamentos: liquidos };
}

const fmt = (v: Decimal) => `R$ ${v.toFixed(2).replace(".", ",")}`;

/**
 * Converte texto digitado em número. Com vírgula, ela é o decimal e pontos são
 * milhar ("1.250,00" → 1250); sem vírgula, o ponto é decimal ("2.125" → 2.125,
 * importante para peso). Retorna NaN se inválido.
 */
export function parseDecimalBR(s: string): number {
  const t = s.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  const norm = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^-?\d+(\.\d+)?$/.test(norm)) return NaN;
  return Number(norm);
}
