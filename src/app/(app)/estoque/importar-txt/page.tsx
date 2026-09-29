import { requireAdminPage } from "@/lib/auth-helpers";
import { ImportarTxtForm } from "./_importar-txt-form";

export default async function ImportarTxtPage() {
  await requireAdminPage();
  return <ImportarTxtForm />;
}
