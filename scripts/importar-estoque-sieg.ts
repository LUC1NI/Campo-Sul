/**
 * Importa produtos do arquivo ESTOQUE.TXT exportado pelo SIEG.
 * Agrupamento por GTIN — deduplicação automática.
 * Nome temporário = GTIN (editar depois em /estoque).
 *
 * Uso: npx tsx scripts/importar-estoque-sieg.ts
 */
import { PrismaClient, Unidade } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

type Produto = {
  gtin: string;
  codigo: string;
  quantidade: number;
  preco: number;
};

function parseLinha(linha: string): { gtin: string; quantidade: number; preco: number } | null {
  const tokens = linha.trim().split(/\s+/);
  if (tokens.length < 4) return null;

  const gtin = tokens[3];
  // Aceita EAN-8, EAN-13 e GTIN-14 (8–14 dígitos, não pode ser tudo zeros)
  if (!/^\d{8,14}$/.test(gtin) || /^0+$/.test(gtin)) return null;

  // Preço: campo de 60 chars zero-padded em tokens[2]; dividir por 100000 = R$
  const priceField = tokens[2] ?? "";
  const significativo = priceField.replace(/^0+/, "") || "0";
  const preco = parseFloat((parseInt(significativo, 10) / 100000).toFixed(2));
  if (preco <= 0) return null;

  // Quantidade: 9 dígitos após o "-" no tokens[0]
  let quantidade = 0;
  const t0 = tokens[0] ?? "";
  const dashIdx = t0.indexOf("-");
  if (dashIdx !== -1) {
    const afterDash = t0.substring(dashIdx + 1);
    if (afterDash.length >= 9) {
      quantidade = parseInt(afterDash.substring(0, 9), 10) || 0;
    }
  } else {
    // Formato sem "-": quantidade na posição 18–26 do token0
    if (t0.length >= 27) {
      quantidade = parseInt(t0.substring(18, 9), 10) || 0;
    }
  }
  if (quantidade <= 0) quantidade = 1; // mínimo 1 unidade

  return { gtin, quantidade, preco };
}

function parsearArquivo(filePath: string): Map<string, Produto> {
  const content = fs.readFileSync(filePath, "latin1"); // SIEG exporta em Latin-1
  const linhas = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  console.log(`📂 ${linhas.length} linhas lidas.`);

  // Agrupa por GTIN: mantém maior quantidade e último preço
  const mapa = new Map<string, Produto>();

  for (const linha of linhas) {
    const parsed = parseLinha(linha);
    if (!parsed) continue;

    const { gtin, quantidade, preco } = parsed;
    const existente = mapa.get(gtin);

    if (existente) {
      // Mantém a maior quantidade encontrada (evita somar duplicatas)
      existente.quantidade = Math.max(existente.quantidade, quantidade);
      existente.preco = preco; // atualiza com o preço mais recente
    } else {
      mapa.set(gtin, {
        gtin,
        codigo: `SIEG-${gtin}`,
        quantidade,
        preco,
      });
    }
  }

  return mapa;
}

async function main() {
  const filePath = path.resolve(__dirname, "../docs/ESTOQUE.TXT");

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }

  const produtos = parsearArquivo(filePath);
  console.log(`✅ ${produtos.size} produtos únicos identificados.\n`);

  let criados = 0;
  let ignorados = 0;
  let erros = 0;

  for (const p of produtos.values()) {
    try {
      // Verifica se já existe por GTIN ou código
      const existente = await prisma.produto.findFirst({
        where: { OR: [{ gtin: p.gtin }, { codigo: p.codigo }] },
        select: { id: true, nome: true },
      });

      if (existente) {
        ignorados++;
        continue;
      }

      await prisma.produto.create({
        data: {
          codigo: p.codigo,
          gtin: p.gtin,
          nome: p.gtin, // nome temporário — editar em /estoque
          unidade: Unidade.UN,
          precoCusto: p.preco.toFixed(4),
          precoVenda: p.preco.toFixed(4),
          quantidade: p.quantidade.toFixed(4),
          ativo: true,
        },
      });
      criados++;

      if (criados % 50 === 0) {
        process.stdout.write(`  → ${criados} criados...\r`);
      }
    } catch (err) {
      erros++;
      console.warn(`  ⚠️  Erro no GTIN ${p.gtin}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n✅ Importação concluída:`);
  console.log(`   • ${criados} produtos criados`);
  console.log(`   • ${ignorados} já existiam (ignorados)`);
  if (erros > 0) console.log(`   • ${erros} erros`);
  console.log(`\n⚠️  Produtos importados com nome = GTIN. Edite os nomes em /estoque.\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
