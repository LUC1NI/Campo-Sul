import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LOGIN_SESSAO_EXPIRADA } from "@/lib/sessao";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "FUNCIONARIO";
};

export type ActionError = { ok: false; erro: string };
export type ActionOk<T = void> = T extends void ? { ok: true } : { ok: true; data: T };
export type ActionResult<T = void> = ActionOk<T> | ActionError;

export function erroAction(erro: string): ActionError {
  return { ok: false, erro };
}

/**
 * Garante sessão válida. `auth()` já revalida no banco a cada request
 * (ver callback `jwt` em lib/auth.ts): usuário desativado ou editado depois
 * do login não passa, e `role` vem sempre do banco.
 * Sessão inválida → redireciona pro /login.
 */
export async function requireActiveUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect(LOGIN_SESSAO_EXPIRADA);
  return session.user as SessionUser;
}

/**
 * Exige role ADMIN. Para mutations sensíveis (usuários, NF,
 * importação XML, cancelamento de venda).
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireActiveUser();
  if (user.role !== "ADMIN") {
    throw new ActionPermissionError("Apenas administradores podem executar essa ação.");
  }
  return user;
}

/**
 * Guarda para page.tsx de admin: funcionário é mandado pro dashboard.
 * Toda página do (app) chama um guarda próprio — o layout não é suficiente,
 * pois em navegação client-side o Next pode renderizar só a página.
 */
export async function requireAdminPage(): Promise<SessionUser> {
  const user = await requireActiveUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

/**
 * Erro de permissão controlado — pego pelo wrapper `runAction`
 * e convertido em `{ok:false, erro}` antes de chegar no client.
 */
export class ActionPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionPermissionError";
  }
}

/**
 * Wrapper para Server Actions: converte qualquer throw em
 * `{ok:false, erro}`, evita vazar stack traces em produção e
 * loga internamente. Use em todas as actions.
 */
export async function runAction<T>(
  escopo: string,
  fn: () => Promise<T>
): Promise<{ ok: true; data: T } | ActionError> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, erro: mensagemErroSegura(err, escopo) };
  }
}

/**
 * Sanitiza mensagem de erro: erros conhecidos (Zod, Prisma P2002/P2025,
 * ActionPermissionError) viram texto pt-BR amigável; erros desconhecidos
 * são logados internamente e o cliente recebe mensagem genérica.
 */
export function mensagemErroSegura(err: unknown, escopo: string): string {
  if (err instanceof ActionPermissionError) return err.message;

  // Zod
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: { message: string }[] }).issues;
    if (Array.isArray(issues) && issues.length > 0) {
      return issues.map((i) => i.message).join(" · ");
    }
  }

  // Prisma known errors — verificamos pelo code sem importar tipo
  // (evita acoplar mais módulos no client)
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: string }).code;
    const meta = (err as { meta?: { target?: string[] } }).meta;
    if (code === "P2002") {
      const campos = meta?.target ?? [];
      if (campos.includes("codigo")) return "Já existe um produto com esse código.";
      if (campos.includes("gtin")) return "Já existe um produto com esse GTIN/EAN.";
      if (campos.includes("email")) return "Já existe um usuário com esse e-mail.";
      if (campos.includes("nome")) return "Já existe um registro com esse nome.";
      if (campos.includes("chaveAcesso")) return "Esta NF-e já foi importada anteriormente.";
      if (campos.includes("numero")) return "Já existe um documento com esse número.";
      return "Já existe um registro com esse valor único.";
    }
    if (code === "P2025") return "Registro não encontrado.";
    if (code === "P2003") return "Há registros vinculados que impedem essa operação.";
  }

  // Mensagens "seguras" — explicitamente lançadas no código
  if (err instanceof Error && err.message && err.message.length < 200) {
    // Heurística: mensagens curtas em pt-BR são intencionais
    // (rejeitamos stacks/SQL longos)
    if (!/\b(prisma|sql|postgres|select|insert)\b/i.test(err.message)) {
      return err.message;
    }
  }

  // Fallback: log interno + mensagem genérica
  console.error(`[action:${escopo}]`, err);
  return "Não foi possível concluir a operação. Tente novamente.";
}
