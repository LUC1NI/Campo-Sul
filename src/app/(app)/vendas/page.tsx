import { requireActiveUser } from "@/lib/auth-helpers";
import { PDV } from "@/components/pdv/pdv";

export default async function VendasPage() {
  await requireActiveUser();
  return <PDV />;
}
