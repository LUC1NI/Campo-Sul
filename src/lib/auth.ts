import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  checarLimiteLogin,
  registrarTentativaLogin,
} from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(6).max(72),
});

function getClientIp(request?: Request): string | null {
  if (!request) return null;
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? null;
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

        // 1. Rate limit (defesa contra brute force)
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

        if (!usuario || !usuario.ativo) {
          await registrarTentativaLogin(email, ip, false);
          return null;
        }

        const senhaOk = await bcrypt.compare(password, usuario.senhaHash);
        if (!senhaOk) {
          await registrarTentativaLogin(email, ip, false);
          return null;
        }

        await registrarTentativaLogin(email, ip, true);

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
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
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
