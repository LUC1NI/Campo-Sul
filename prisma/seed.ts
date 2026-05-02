import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@camposul.com.br";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123456";
  const senhaHash = await bcrypt.hash(password, 12);

  await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: {
      email,
      nome: "Administrador",
      senhaHash,
      role: Role.ADMIN,
    },
  });

  // Categorias iniciais
  const categorias = ["Rações", "Sementes", "Medicamentos", "Ferramentas", "Insumos", "Outros"];
  for (const nome of categorias) {
    await prisma.categoria.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
  }

  // Counters
  const counters = ["VENDA", "NOTA:1", "RECIBO:1"];
  for (const chave of counters) {
    await prisma.counter.upsert({
      where: { chave },
      update: {},
      create: { chave, valor: 0 },
    });
  }

  console.log("✅ Seed concluído");
  console.log(`   Admin: ${email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
