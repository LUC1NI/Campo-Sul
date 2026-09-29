import { prisma } from "@/lib/prisma";

const JANELA_MS = 15 * 60 * 1000;      // 15 minutos
const MAX_POR_EMAIL = 5;               // 5 tentativas por e-mail na janela
const MAX_POR_IP = 20;                 // 20 tentativas por IP na janela

export type LoginRateLimitResult =
  | { permitido: true; marcarSucesso: () => Promise<void> }
  | { permitido: false; motivo: string; tentarEm: number };

/**
 * Registra a tentativa como falha ANTES de contar (rajadas simultâneas não
 * passam todas pelo limite) e verifica os limites. Chame ANTES de validar a
 * senha; em login OK chame `marcarSucesso()`.
 * Falha fechado: banco fora do ar → login negado.
 */
export async function checarLimiteLogin(
  email: string,
  ip: string | null
): Promise<LoginRateLimitResult> {
  const desde = new Date(Date.now() - JANELA_MS);
  const emailSan = email.toLowerCase().slice(0, 200);
  const ipSan = ip?.slice(0, 64) ?? null;

  try {
    const tentativa = await prisma.loginAttempt.create({
      data: { email: emailSan, ip: ipSan, sucesso: false },
      select: { id: true },
    });
    const [porEmail, porIp] = await Promise.all([
      prisma.loginAttempt.count({
        where: { email: emailSan, sucesso: false, createdAt: { gte: desde } },
      }),
      ipSan
        ? prisma.loginAttempt.count({
            where: { ip: ipSan, sucesso: false, createdAt: { gte: desde } },
          })
        : Promise.resolve(0),
    ]);

    // Contagens incluem a tentativa atual, por isso ">".
    if (porEmail > MAX_POR_EMAIL) {
      return { permitido: false, motivo: "Muitas tentativas falhas. Aguarde 15 minutos.", tentarEm: JANELA_MS };
    }
    if (porIp > MAX_POR_IP) {
      return { permitido: false, motivo: "Limite de tentativas excedido para sua rede.", tentarEm: JANELA_MS };
    }

    return {
      permitido: true,
      marcarSucesso: async () => {
        await prisma.loginAttempt
          .update({ where: { id: tentativa.id }, data: { sucesso: true } })
          .catch((err) => console.error("[rate-limit] erro ao marcar sucesso", err));
      },
    };
  } catch (err) {
    console.error("[rate-limit] erro ao checar", err);
    return { permitido: false, motivo: "Serviço indisponível. Tente em instantes.", tentarEm: 60_000 };
  }
}

/**
 * Limpa tentativas antigas. Chamado pelo cron de limpeza.
 */
export async function limparTentativasAntigas(): Promise<number> {
  const corte = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 dias
  const { count } = await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: corte } },
  });
  return count;
}

export const RATE_LIMIT_CONFIG = {
  JANELA_MS,
  MAX_POR_EMAIL,
  MAX_POR_IP,
};
