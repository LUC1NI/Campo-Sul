import { requireActiveUser } from "@/lib/auth-helpers";
import { NovaNotaForm } from "./_nova-nota-form";

export default async function NovaNotaPage() {
  const user = await requireActiveUser();
  // Espelha gerarNotaAvulsa: só admin altera preço; funcionário usa o de catálogo
  return <NovaNotaForm precoLivre={user.role === "ADMIN"} />;
}
