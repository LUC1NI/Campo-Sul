import { Decimal } from "decimal.js";

export interface ResultadoFracionamento {
  novaQuantidade: Decimal;
  novoSaldoFracionado: Decimal;
  unidadesFechadasConsumidas: Decimal;
}

export interface ProdutoFracionamento {
  podeFracionar: boolean;
  pesoUnidade: string | null; // Prisma.Decimal serializado
  quantidade: string;
  saldoFracionado: string;
}

/**
 * Calcula o impacto no estoque de uma venda. Permite estoque negativo.
 * - Venda inteira (ou produto não fracionável): `qtdVendida` está em unidades
 *   fechadas (ex: 2 SACOS) e sai direto de `quantidade`.
 * - Venda fracionada: `qtdVendida` está em unidade de fração (ex: kg) e acumula
 *   em saldoFracionado; quando saldo >= pesoUnidade, desconta 1 unidade fechada.
 */
export function calcularFracionamento(
  produto: ProdutoFracionamento,
  qtdVendida: string | number,
  vendaInteira = false
): ResultadoFracionamento {
  const qtd = new Decimal(qtdVendida);
  let novaQuantidade = new Decimal(produto.quantidade);
  let novoSaldo = new Decimal(produto.saldoFracionado);
  let unidadesFechadasConsumidas = new Decimal(0);

  if (!produto.podeFracionar || vendaInteira) {
    novaQuantidade = novaQuantidade.minus(qtd);
    unidadesFechadasConsumidas = qtd;
  } else {
    const peso = new Decimal(produto.pesoUnidade ?? "1");
    novoSaldo = novoSaldo.plus(qtd);
    while (novoSaldo.gte(peso)) {
      novaQuantidade = novaQuantidade.minus(1);
      novoSaldo = novoSaldo.minus(peso);
      unidadesFechadasConsumidas = unidadesFechadasConsumidas.plus(1);
    }
  }

  return { novaQuantidade, novoSaldoFracionado: novoSaldo, unidadesFechadasConsumidas };
}

/**
 * Desfaz exatamente o que `calcularFracionamento` fez com um item de venda
 * (usado no cancelamento). Se o saldo aberto ficar negativo, "desabre"
 * unidades fechadas em vez de perder a fração.
 */
export function reverterFracionamento(
  produto: ProdutoFracionamento,
  item: { quantidade: string; unidadesFechadasConsumidas: string; vendaInteira: boolean }
): { novaQuantidade: Decimal; novoSaldoFracionado: Decimal } {
  let novaQuantidade = new Decimal(produto.quantidade).plus(item.unidadesFechadasConsumidas);
  let novoSaldo = new Decimal(produto.saldoFracionado);

  if (produto.podeFracionar && !item.vendaInteira && produto.pesoUnidade) {
    // ponytail: usa o pesoUnidade atual; se o peso do saco mudou desde a venda, a devolução usa o novo
    const peso = new Decimal(produto.pesoUnidade);
    const fracao = new Decimal(item.quantidade).minus(
      new Decimal(item.unidadesFechadasConsumidas).times(peso)
    );
    novoSaldo = novoSaldo.minus(fracao);
    while (novoSaldo.lt(0)) {
      novoSaldo = novoSaldo.plus(peso);
      novaQuantidade = novaQuantidade.plus(1);
    }
  }

  return { novaQuantidade, novoSaldoFracionado: novoSaldo };
}

/** Calcula quantidade dado um valor em reais e o preço unitário */
export function calcularQuantidadePorValor(
  valorReais: string | number,
  precoUnitario: string | number
): Decimal {
  const valor = new Decimal(valorReais);
  const preco = new Decimal(precoUnitario);
  if (preco.lte(0)) throw new Error("Preço inválido");
  return valor.div(preco).toDecimalPlaces(4, Decimal.ROUND_DOWN);
}
