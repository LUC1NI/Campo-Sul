/**
 * Integração: Server Actions de venda/cancelamento contra Postgres real
 * (PGlite exposto via socket — Prisma conecta como num banco normal, sem Docker).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { execSync } from "child_process";
import { randomUUID } from "crypto";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const sessao = { user: { id: "", role: "ADMIN" as "ADMIN" | "FUNCIONARIO", email: "", name: "" } };
vi.mock("@/lib/auth", () => ({ auth: async () => sessao }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const PORTA = 54329;
let db: PGlite;
let srv: PGLiteSocketServer;
let prisma: typeof import("@/lib/prisma").prisma;
let acoes: typeof import("@/app/actions/vendas");
let racaoId: string; // SACO de 25 kg, fracionável
let marteloId: string; // UN

async function estoque(id: string) {
  const p = await prisma.produto.findUniqueOrThrow({ where: { id } });
  return { quantidade: p.quantidade.toString(), saldo: p.saldoFracionado.toString() };
}

function vender(
  itens: { produtoId: string; unidadeVenda: "SACO" | "KG" | "UN"; quantidade: number; precoUnitario?: number }[],
  total: number,
  chave?: string
) {
  return acoes.finalizarVenda({
    itens,
    pagamentos: [{ metodo: "PIX", valor: total }],
    chaveIdempotencia: chave,
  });
}

beforeAll(async () => {
  db = await PGlite.create();
  srv = new PGLiteSocketServer({ db, port: PORTA, host: "127.0.0.1" });
  await srv.start();
  await db.exec(
    execSync("npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script", {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString()
  );
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORTA}/postgres?connection_limit=1&sslmode=disable`;

  ({ prisma } = await import("@/lib/prisma"));
  acoes = await import("@/app/actions/vendas");

  const admin = await prisma.usuario.create({
    data: { email: "admin@teste", nome: "Admin", senhaHash: "x", role: "ADMIN" },
  });
  sessao.user.id = admin.id;
  await prisma.counter.createMany({ data: [{ chave: "VENDA" }, { chave: "NOTA:1" }, { chave: "RECIBO:1" }] });
  racaoId = (
    await prisma.produto.create({
      data: {
        codigo: "R1", nome: "Ração 25kg", unidade: "SACO", precoCusto: "70", precoVenda: "100",
        podeFracionar: true, pesoUnidade: "25", unidadeFracao: "KG", precoFracao: "5", quantidade: "10",
      },
    })
  ).id;
  marteloId = (
    await prisma.produto.create({
      data: { codigo: "M1", nome: "Martelo", unidade: "UN", precoCusto: "20", precoVenda: "30", quantidade: "5" },
    })
  ).id;
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await srv?.stop();
  await db?.close();
});

describe("finalizarVenda", () => {
  it("venda inteira baixa estoque, grava movimento e numera", async () => {
    const r = await vender([{ produtoId: racaoId, unidadeVenda: "SACO", quantidade: 2 }], 200);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await estoque(racaoId)).toEqual({ quantidade: "8", saldo: "0" });

    const venda = await prisma.venda.findUniqueOrThrow({ where: { id: r.data.vendaId } });
    expect(venda.total.toString()).toBe("200");
    const mov = await prisma.movimentoEstoque.findMany({ where: { referenciaId: venda.id } });
    expect(mov).toHaveLength(1);
    expect(mov[0].quantidade.toString()).toBe("-2");
  });

  it("venda fracionada acumula saldo e abre saco quando passa do peso", async () => {
    const antes = await estoque(racaoId);
    const r = await vender([{ produtoId: racaoId, unidadeVenda: "KG", quantidade: 30 }], 150);
    expect(r.ok).toBe(true);
    const depois = await estoque(racaoId);
    // 30 kg = 1 saco (25) + 5 kg de saldo aberto
    expect(Number(depois.quantidade)).toBe(Number(antes.quantidade) - 1);
    expect(Number(depois.saldo)).toBe(5);
  });

  it("ignora preço enviado pelo cliente (vale o catálogo)", async () => {
    const r = await vender([{ produtoId: marteloId, unidadeVenda: "UN", quantidade: 1, precoUnitario: 0.01 }], 30);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = await prisma.venda.findUniqueOrThrow({ where: { id: r.data.vendaId } });
    expect(v.total.toString()).toBe("30");
  });

  it("mesma chave de idempotência não duplica venda nem baixa estoque duas vezes", async () => {
    const chave = randomUUID();
    const antes = await estoque(marteloId);
    const a = await vender([{ produtoId: marteloId, unidadeVenda: "UN", quantidade: 1 }], 30, chave);
    const b = await vender([{ produtoId: marteloId, unidadeVenda: "UN", quantidade: 1 }], 30, chave);
    expect(a.ok && b.ok && a.data.vendaId === b.data.vendaId).toBe(true);
    expect(Number((await estoque(marteloId)).quantidade)).toBe(Number(antes.quantidade) - 1);
    expect(await prisma.venda.count({ where: { chaveIdempotencia: chave } })).toBe(1);
  });

  it("produto desativado bloqueia a venda sem mexer no estoque", async () => {
    await prisma.produto.update({ where: { id: marteloId }, data: { ativo: false } });
    const antes = await estoque(marteloId);
    const r = await vender([{ produtoId: marteloId, unidadeVenda: "UN", quantidade: 1 }], 30);
    await prisma.produto.update({ where: { id: marteloId }, data: { ativo: true } });
    expect(r.ok).toBe(false);
    expect(await estoque(marteloId)).toEqual(antes);
  });
});

describe("cancelarVenda", () => {
  it("devolve exatamente o estoque (inteiro + fracionado) e não cancela duas vezes", async () => {
    const antes = await estoque(racaoId);
    const r = await vender(
      [
        { produtoId: racaoId, unidadeVenda: "SACO", quantidade: 1 },
        { produtoId: racaoId, unidadeVenda: "KG", quantidade: 22 },
      ],
      210
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await estoque(racaoId)).not.toEqual(antes);

    expect((await acoes.cancelarVenda(r.data.vendaId)).ok).toBe(true);
    const depois = await estoque(racaoId);
    expect(Number(depois.quantidade)).toBe(Number(antes.quantidade));
    expect(Number(depois.saldo)).toBe(Number(antes.saldo));

    const denovo = await acoes.cancelarVenda(r.data.vendaId);
    expect(denovo).toEqual({ ok: false, erro: "Esta venda já foi cancelada." });
  });

  it("funcionário não pode cancelar", async () => {
    const r = await vender([{ produtoId: marteloId, unidadeVenda: "UN", quantidade: 1 }], 30);
    if (!r.ok) throw new Error(r.erro);
    sessao.user.role = "FUNCIONARIO";
    const c = await acoes.cancelarVenda(r.data.vendaId);
    sessao.user.role = "ADMIN";
    expect(c.ok).toBe(false);
    expect((await prisma.venda.findUniqueOrThrow({ where: { id: r.data.vendaId } })).status).toBe("CONCLUIDA");
  });
});
