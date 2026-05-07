import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.produto.deleteMany({
    where: { codigo: { startsWith: "SIEG-" } },
  });
  console.log(`✅ ${result.count} produtos SIEG removidos.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
