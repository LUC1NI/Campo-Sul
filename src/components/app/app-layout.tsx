import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";

interface AppLayoutProps {
  children: React.ReactNode;
}

export async function AppLayout({ children }: AppLayoutProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <AppShell user={session.user} role={session.user.role}>
      {children}
    </AppShell>
  );
}
