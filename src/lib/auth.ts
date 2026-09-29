import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { checarLimiteLogin } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email().toLowerCase().max(200),
  password: z.string().min(1).max(200),
});

// Hash de uma senha qualquer: comparar contra ele quando o e-mail não existe
// faz a resposta levar o mesmo tempo (não revela quais e-mails são cadastrados).
const HASH_FALSO = "$2a$12$1Gd2Kz5nJS60iQzVF2M4JuTgQ8hcCTa2GONcN2qSN4jUfRI2YG11K";

/**
 * IP real do cliente. Só cabeçalhos que a Vercel sobrescreve (cliente não forja).
 * NÃO usar cf-connecting-ip: sem Cloudflare na frente, ele vem direto do cliente.
 * x-forwarded-for: usa o ÚLTIMO item (adicionado pelo proxy), não o primeiro.
 */
function getClientIp(request?: Request): string | null {
  if (!request) return null;
  const h = request.headers;
  const plataforma = h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip");
  if (plataforma) return plataforma.trim();
  const fwd = h.get("x-forwarded-for");
  return fwd ? fwd.split(",").pop()!.trim() : null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const ip = getClientIp(request as Request | undefined);

        // 1. Rate limit (defesa contra brute force) — registra a tentativa antes
        // de contar, para rajadas simultâneas não passarem todas pelo limite.
        const limite = await checarLimiteLogin(email, ip);
        if (!limite.permitido) {
          // Não distinguimos "bloqueado" de "credenciais inválidas"
          // para o atacante — ele só vê falha.
          console.warn(`[auth] bloqueado por rate limit: ${email} / ${ip ?? "?"}`);
          return null;
        }

        // 2. Busca usuário
        let usuario;
        try {
          usuario = await prisma.usuario.findUnique({ where: { email } });
        } catch (err) {
          console.error("[auth] Erro ao consultar banco:", err);
          return null;
        }

        const senhaOk = await bcrypt.compare(password, usuario?.senhaHash ?? HASH_FALSO);
        if (!usuario || !usuario.ativo || !senhaOk) return null;

        await limite.marcarSucesso();

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.nome,
          role: usuario.role,
        };
      },
    }),
  ],
  callbacks: {
    /**
     * Roda em todo auth(). Revalida o usuário no banco a cada request:
     * - desativado → sessão morre na hora (não espera os 30 dias do JWT);
     * - role vem do banco (rebaixar um admin vale imediatamente);
     * - admin editou o usuário (senha/role/ativo) depois do login → sessão
     *   antiga é invalidada e ele precisa entrar de novo.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = (user as { role: string }).role;
        token.loginEm = Date.now();
        return token;
      }
      const id = token.id as string | undefined;
      const loginEm = token.loginEm as number | undefined;
      if (!id) return null;
      const u = await prisma.usuario.findUnique({
        where: { id },
        select: { ativo: true, role: true, updatedAt: true },
      });
      if (!u || !u.ativo) return null;
      if (!loginEm || u.updatedAt.getTime() > loginEm) return null;
      token.role = u.role;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
});
