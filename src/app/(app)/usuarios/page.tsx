export const dynamic = "force-dynamic";
import { listarUsuarios } from "@/app/actions/usuarios";
import { UsuariosCliente } from "./usuarios-cliente";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function UsuariosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const usuarios = await listarUsuarios();

  return <UsuariosCliente usuarios={usuarios} currentUserId={session.user.id} />;
}
