import { prisma } from "@/lib/prisma";

const JANELA_MS = 15 * 60 * 1000;      // 15 minutos
const MAX_POR_EMAIL = 5;               // 5 tentativas por e-mail na janela
const MAX_POR_IP = 20;                 // 20 tentativas por IP na janela
const LOCKOUT_MIN_MS = 30 * 1000;      // após bloqueio, no mínimo 30s antes do próximo OK

export type LoginRateLimitResult =
  | { permitido: true }
  | { permitido: false; motivo: string; tentarEm: number };

/**
 * Verifica se a tentativa de login está dentro dos limites.
 * Chame ANTES de validar a senha.
 */
export async function checarLimiteLogin(
  email: string,
  ip: string | null
): Promise<LoginRateLimitResult> {
  const desde = new Date(Date.now() - JANELA_MS);

  try {
    const [porEmail, porIp] = await Promise.all([
      prisma.loginAttempt.count({
        where: { email, sucesso: false, createdAt: { gte: desde } },
      }),
      ip
        ? prisma.loginAttempt.count({
            where: { ip, sucesso: false, createdAt: { gte: desde } },
          })
        : Promise.resolve(0),
    ]);

    if (porEmail >= MAX_POR_EMAIL) {
      return {
        permitido: false,
        motivo: "Muitas tentativas falhas. Aguarde 15 minutos.",
        tentarEm: JANELA_MS,
      };
    }
    if (porIp >= MAX_POR_IP) {
      return {
        permitido: false,
        motivo: "Limite de tentativas excedido para sua rede.",
        tentarEm: JANELA_MS,
      };
    }

    return { permitido: true };
  } catch (err) {
    // Banco indisponível? Não trava o login — apenas loga
    console.error("[rate-limit] erro ao checar", err);
    return { permitido: true };
  }
}

/**
 * Registra a tentativa (sucesso ou falha) para futuras checagens.
 * Falhas silenciosas — rate limit é defesa em profundidade.
 */
export async function registrarTentativaLogin(
  email: string,
  ip: string | null,
  sucesso: boolean
): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: { email: email.toLowerCase().slice(0, 200), ip: ip?.slice(0, 64) ?? null, sucesso },
    });
  } catch (err) {
    console.error("[rate-limit] erro ao registrar", err);
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
  LOCKOUT_MIN_MS,
};
