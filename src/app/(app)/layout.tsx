import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LOGIN_SESSAO_EXPIRADA } from "@/lib/sessao";
import { AppShell } from "@/components/app/app-shell";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect(LOGIN_SESSAO_EXPIRADA);

  return (
    <AppShell user={session.user} role={session.user.role}>
      {children}
    </AppShell>
  );
}
