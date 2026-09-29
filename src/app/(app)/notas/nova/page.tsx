import { requireActiveUser } from "@/lib/auth-helpers";
import { NovaNotaForm } from "./_nova-nota-form";

export default async function NovaNotaPage() {
  await requireActiveUser();
  return <NovaNotaForm />;
}
