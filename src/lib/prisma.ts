import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Transação Serializable (regra do CLAUDE.md p/ venda/estoque) com timeout
 * adequado ao Supabase remoto e retry automático em conflito de concorrência
 * (P2034 — ex: dois caixas finalizando ao mesmo tempo disputam o Counter).
 */
export async function transacaoSerializavel<T>(fn: (tx: Tx) => Promise<T>, tentativas = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: "Serializable",
        timeout: 30000,
        maxWait: 10000,
      });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== "P2034" || i >= tentativas) throw err;
      await new Promise((r) => setTimeout(r, 50 * i + Math.random() * 100));
    }
  }
}
