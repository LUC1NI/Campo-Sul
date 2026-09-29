import { PrismaClient } from "@prisma/client";

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Incrementa atomicamente o counter e retorna o próximo número.
 * DEVE ser chamado dentro de uma transação Prisma.
 */
export async function proximoNumero(
  tx: TxClient,
  chave: "VENDA" | "NOTA:1" | "RECIBO:1"
): Promise<number> {
  // Counter inexistente → P2025 ("Registro não encontrado"): rode o seed.
  const resultado = await tx.counter.update({
    where: { chave },
    data: { valor: { increment: 1 } },
    select: { valor: true },
  });
  return resultado.valor;
}
