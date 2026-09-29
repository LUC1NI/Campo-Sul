export const dynamic = "force-dynamic";
import { listarUsuarios } from "@/app/actions/usuarios";
import { UsuariosCliente } from "./usuarios-cliente";
import { requireAdminPage } from "@/lib/auth-helpers";

export default async function UsuariosPage() {
  const user = await requireAdminPage();

  const usuarios = await listarUsuarios();

  return <UsuariosCliente usuarios={usuarios} currentUserId={user.id} />;
}
