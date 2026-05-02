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
 * Calcula o impacto no estoque de uma venda.
 * Lança erro se estoque insuficiente.
 *
 * Para produtos fracionáveis: acumula saldoFracionado em unidade de fração (ex: kg).
 * Quando saldo >= pesoUnidade, desconta 1 unidade fechada do estoque.
 */
export function calcularFracionamento(
  produto: ProdutoFracionamento,
  qtdVendida: string | number
): ResultadoFracionamento {
  const qtd = new Decimal(qtdVendida);
  let novaQuantidade = new Decimal(produto.quantidade);
  let novoSaldo = new Decimal(produto.saldoFracionado);
  let unidadesFechadasConsumidas = new Decimal(0);

  if (!produto.podeFracionar) {
    if (novaQuantidade.lt(qtd)) {
      throw new Error(`Estoque insuficiente. Disponível: ${novaQuantidade.toFixed(4)}`);
    }
    novaQuantidade = novaQuantidade.minus(qtd);
    unidadesFechadasConsumidas = qtd;
  } else {
    const peso = new Decimal(produto.pesoUnidade ?? "1");
    // kg disponível total = unidades_em_estoque × peso_unidade − saldo_já_vendido
    const kgDisponivel = novaQuantidade.times(peso).minus(novoSaldo);
    if (qtd.gt(kgDisponivel)) {
      throw new Error(`Estoque insuficiente. Disponível: ${kgDisponivel.toFixed(4)} kg`);
    }
    novoSaldo = novoSaldo.plus(qtd);
    while (novoSaldo.gte(peso)) {
      novaQuantidade = novaQuantidade.minus(1);
      novoSaldo = novoSaldo.minus(peso);
      unidadesFechadasConsumidas = unidadesFechadasConsumidas.plus(1);
    }
  }

  return { novaQuantidade, novoSaldoFracionado: novoSaldo, unidadesFechadasConsumidas };
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
